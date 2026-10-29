// Bridge: lets an outside process (Claude over SSH) drive the server.
// Drop a job JSON into ~/omegga-server/bridge/inbox/<id>.json and the
// result appears in ~/omegga-server/bridge/outbox/<id>.json.
//
// Job: { ops: [ ...op ] }, ops run in order, results come back in the same order.
//   { op: 'players' }                        -> [{ name, id, pos }]
//   { op: 'cmd', line, captureMs? }          -> console lines seen during captureMs
//   { op: 'bricks', bricks, at, owner?, absolute? } -> loads bricks as a prefab
//       a brick may carry owner: { id, name } (several owners in one load)
//       absolute: true places bricks at their own coordinates and ignores `at`
//       bricks: [{ position:[x,y,z], size:[hx,hy,hz], color:[r,g,b], asset?, material? }]
//               in game units (stud = 10, plate = 4), size is half-extents
//       at: [x,y,z] or { player, dx?, dy?, dz?, ground? } (ground: true puts z at 0)
//   { op: 'clear', owner? }                  -> removes bricks placed by that bridge owner
//   { op: 'say', msg }                       -> broadcast to chat
//   { op: 'emit', event, args }              -> fire an Omegga event (e.g. 'cmd:playvideo', player, ...args)
//
// Unsafe (plain node) plugin, same approach as the terrain plugin: writes
// .brz prefabs and sends br.* console commands.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(process.env.HOME || '/home/max', 'omegga-server', 'bridge');
const INBOX = path.join(ROOT, 'inbox');
const OUTBOX = path.join(ROOT, 'outbox');
// Stable owner ids so `clear` removes only what the bridge placed.
const OWNERS = {
  default: { id: '3f9b2d71-6c4e-4a8b-9e15-7d20c1a4b5e6', name: 'Claude Build' },
};
const ownerFor = name => {
  // a real player: { id, name }
  if (name && typeof name === 'object' && name.id) return { id: name.id, name: name.name ?? name.id };
  if (!name || name === 'default') return OWNERS.default;
  // derive a deterministic uuid from the name
  let h = 2166136261;
  const hex = [];
  for (let i = 0; i < 32; i++) {
    h ^= (name.charCodeAt(i % name.length) + i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
    hex.push((h & 0xf).toString(16));
  }
  const s = hex.join('');
  return { id: `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`, name: `Claude ${name}` };
};

module.exports = class Plugin {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    this.brs = await import(pathToFileURL(path.join(__dirname, 'lib/brs.mjs')).href);
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    for (const d of [INBOX, OUTBOX, this.prefabDir]) fs.mkdirSync(d, { recursive: true });
    this.running = false;
    this.timer = setInterval(() => this.poll(), 300);
    return { registeredCommands: [] };
  }

  async poll() {
    if (this.running) return;
    let files;
    try {
      files = fs.readdirSync(INBOX).filter(f => f.endsWith('.json')).sort();
    } catch {
      return;
    }
    if (!files.length) return;
    this.running = true;
    try {
      for (const f of files) {
        const src = path.join(INBOX, f);
        let job, out;
        try {
          job = JSON.parse(fs.readFileSync(src, 'utf8'));
        } catch (e) {
          continue; // still being written; next poll
        }
        fs.rmSync(src, { force: true });
        try {
          const results = [];
          for (const op of job.ops ?? [job]) results.push(await this.run(op));
          out = { ok: true, results };
        } catch (e) {
          out = { ok: false, error: String(e?.stack ?? e) };
        }
        const tmp = path.join(OUTBOX, f + '.tmp');
        fs.writeFileSync(tmp, JSON.stringify(out));
        fs.renameSync(tmp, path.join(OUTBOX, f));
      }
    } finally {
      this.running = false;
    }
  }

  async run(op) {
    switch (op.op) {
      case 'players': {
        const players = this.omegga.getPlayers();
        return Promise.all(
          players.map(async p => {
            let pos = null;
            try {
              pos = await Promise.race([
                this.omegga.getPlayer(p.name)?.getPosition(),
                new Promise(r => setTimeout(() => r(null), 3000)),
              ]);
            } catch {}
            return { name: p.name, id: p.id, pos };
          })
        );
      }
      case 'cmd': {
        const lines = [];
        const onLine = l => lines.push(l);
        if (op.captureMs) this.omegga.on('line', onLine);
        this.omegga.writeln(op.line);
        if (op.captureMs) {
          await new Promise(r => setTimeout(r, op.captureMs));
          this.omegga.off('line', onLine);
        }
        return lines;
      }
      case 'sleep':
        await new Promise(r => setTimeout(r, op.ms ?? 0));
        return true;
      case 'say':
        this.omegga.writeln(`br.Chat.Broadcast ${op.msg}`);
        return true;
      case 'clear': {
        const owner = ownerFor(op.owner);
        this.omegga.writeln(`br.Bricks.Clear ${owner.id} 1`);
        return owner;
      }
      case 'bricks':
        return this.loadBricks(op);
      case 'emit':
        return { listeners: this.omegga.listenerCount(op.event), handled: this.omegga.emit(op.event, ...(op.args ?? [])) };
      default:
        throw new Error(`unknown op ${op.op}`);
    }
  }

  async resolveAt(at) {
    if (Array.isArray(at)) return at.map(Number);
    if (at && at.player) {
      const p = this.omegga.getPlayer(at.player);
      const pos = p && (await p.getPosition());
      if (!pos) throw new Error(`no position for player ${at.player}`);
      const snap = v => Math.round(v / 10) * 10;
      return [
        snap(pos[0] + (at.dx ?? 0)),
        snap(pos[1] + (at.dy ?? 0)),
        at.ground ? (at.dz ?? 0) : Math.round(pos[2] + (at.dz ?? 0)),
      ];
    }
    return [0, 0, 0];
  }

  async loadBricks({ bricks, at, owner: ownerName, absolute, captureMs, externalAssets }) {
    if (!Array.isArray(bricks) || !bricks.length) throw new Error('no bricks');
    const owner = ownerFor(ownerName);
    const [x, y, z] = absolute ? [0, 0, 0] : await this.resolveAt(at);
    const assets = [], materials = [];
    const index = (list, name) => {
      let i = list.indexOf(name);
      if (i === -1) i = list.push(name) - 1;
      return i;
    };
    // a brick's own `owner` ({ id, name }) puts several owners in one load (each build wipeable by Bricks.Clear)
    const owners = [owner];
    const ownerIndex = o => {
      if (!o) return 1;
      const w = ownerFor(o);
      const i = owners.findIndex(q => q.id === w.id);
      return (i === -1 ? owners.push(w) - 1 : i) + 1;
    };
    const out = bricks.map(({ asset, material, owner: brickOwner, ...b }) => ({
      // colors pass straight through as RGB (swapping to BGR turned grass blue in-game)
      ...b,
      asset_name_index: index(assets, asset ?? 'PB_DefaultBrick'),
      material_index: index(materials, material ?? 'BMC_Plastic'),
      owner_index: ownerIndex(brickOwner),
    }));
    const counts = owners.map((_, i) => out.filter(b => b.owner_index === i + 1).length);
    const save = { brick_assets: assets, materials, brick_owners: owners.map((o, i) => ({ ...o, bricks: counts[i] })), bricks: out };
    const ref = `omegga_bridge_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    // externalAssets: [{ type, name }] that component data refers to by index (e.g. a TextDisplay Font: BrickFontDescriptor/MonaspaceXenon)
    fs.writeFileSync(file, this.brs.writeBrzLegacy(save, externalAssets ? { externalAssets } : {}));
    // atOriginalPosition (1 = bricks keep their saved coordinates),
    // orientation=16 (upright), same as the terrain plugin
    const lines = [];
    const onLine = l => /Prefab|[Bb]rick|rror|arning/.test(l) && !/DetailsInspection|LogNet|Bundles: Auto-closing/.test(l) && lines.push(l);
    this.omegga.on('line', onLine);
    this.omegga.writeln(`br.Prefab.Load "${ref}" ${x} ${y} ${z} ${absolute ? 1 : 0} 16`);
    await new Promise(r => setTimeout(r, captureMs ?? 1000));
    this.omegga.off('line', onLine);
    setTimeout(() => fs.rmSync(file, { force: true }), 10000);
    return { count: out.length, at: [x, y, z], owner, log: lines.slice(0, 20) };
  }

  async stop() {
    clearInterval(this.timer);
  }
};
