// Live terrain demo: generates a landscape patch next to the player and
// streams it into the running server strip by strip, so everyone watches
// it rise. Bricks are owned by a dedicated "Terrain Demo" owner, so
// `!terrain clear` removes only what this plugin placed.
//
// This is an unsafe (plain node) plugin: it writes .brz prefabs itself and
// sends the current game's br.* console commands (Prefab.Load, Bricks.Clear,
// Chat.Broadcast, Chat.Whisper), so it works on current Brickadia even with
// Omegga versions that still send the pre-rename command names.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const OWNER = { id: '7e3a1c52-9d4b-4f0e-8a61-2b5c0d7f9e13', name: 'Terrain Demo' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = file => import(pathToFileURL(path.join(__dirname, file)).href);
const EVENTS = ['chatcmd:terrain', 'cmd:terrain']; // "!terrain" and "/terrain"

module.exports = class Plugin {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.busy = false;
  }

  async init() {
    this.terrain = await load('terrain.mjs');
    this.brs = await load('lib/brs.mjs');
    // Saved/Builds sits next to Saved/Prefabs
    this.prefabDir = path.join(path.dirname(this.omegga.savePath), 'Prefabs');
    fs.mkdirSync(this.prefabDir, { recursive: true });

    this.handler = (name, ...args) =>
      this.command(name, args).catch(err => {
        console.error('terrain:', err);
        this.whisper(name, `<color="f55">Terrain failed: ${err.message ?? err}</>`);
        this.busy = false;
      });
    // Unsafe plugins share Omegga's event emitter, so handlers from earlier
    // loads of this plugin would otherwise keep firing after a reload.
    for (const e of EVENTS) {
      this.omegga.removeAllListeners(e);
      this.omegga.on(e, this.handler);
    }
    return { registeredCommands: ['terrain'] };
  }

  broadcast(msg) {
    this.omegga.writeln(`br.Chat.Broadcast ${msg}`);
  }

  whisper(name, msg) {
    this.omegga.writeln(`br.Chat.Whisper "${name}" ${msg}`);
  }

  allowed(player) {
    if (player.isHost()) return true;
    return (this.config.authorized ?? []).some(p => p.id === player.id);
  }

  /** Write bricks as a temporary prefab and load it into the live world. */
  loadBricks(bricks, offX, offY, offZ) {
    const ref = `omegga_terrain_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const file = path.join(this.prefabDir, ref + '.brz');
    fs.writeFileSync(file, this.brs.writeBrzLegacy(this.terrain.toLegacySave(bricks, OWNER)));
    // last two args: atOriginalPosition=0, orientation=16 (Z_Positive_0, upright;
    // orientation is direction*4+rotation and 0 would lay it on its side)
    this.omegga.writeln(`br.Prefab.Load "${ref}" ${offX} ${offY} ${offZ} 0 16`);
    setTimeout(() => fs.rmSync(file, { force: true }), 10000);
  }

  async command(name, args) {
    const player = this.omegga.getPlayer(name);
    if (!player || !this.allowed(player)) {
      this.whisper(name, 'You are not allowed to use !terrain.');
      return;
    }
    if (args[0] === 'clear') {
      this.omegga.writeln(`br.Bricks.Clear ${OWNER.id} 1`);
      this.broadcast('<b>Terrain demo cleared.</>');
      return;
    }
    if (this.busy) {
      this.whisper(name, 'Terrain is still building, hold on.');
      return;
    }

    const seed = args[0] && /^\d+$/.test(args[0]) ? Number(args[0]) : Math.floor(Math.random() * 1e9);
    const pos = await player.getPosition();
    if (!pos) {
      this.whisper(name, 'Spawn in first so I know where to build.');
      return;
    }

    this.busy = true;
    const size = this.config.size ?? 96;
    const cell = 2;
    const { bricks, plots } = this.terrain.makeTerrain({
      seed, size, cell,
      plots: Math.max(1, Math.round((size / 96) ** 2 * 2)),
      plotSize: 24,
    });

    // Patch starts 20 studs east (+X) of the player, on the ground plate,
    // snapped to the stud grid so it lines up with normal building.
    const half = (size * cell * 10) / 2;
    const offX = Math.round((pos[0] + half + 200) / 10) * 10;
    const offY = Math.round(pos[1] / 10) * 10;
    const offZ = this.config['base-z'] ?? 0;

    this.broadcast(
      `<b>${name}</> is growing terrain (seed <b>${seed}</>, ${bricks.length} bricks, ${plots.length} house plots) east of them...`
    );

    // Stream west -> east in strips.
    const strips = Math.max(1, this.config.strips ?? 12);
    const band = (half * 2) / strips;
    const groups = Array.from({ length: strips }, () => []);
    for (const b of bricks) {
      const s = Math.floor((b.position[0] + half) / band);
      groups[Math.min(strips - 1, Math.max(0, s))].push(b);
    }
    const delay = this.config['strip-delay-ms'] ?? 400;
    for (const group of groups) {
      if (!group.length) continue;
      this.loadBricks(group, offX, offY, offZ);
      await sleep(delay);
    }

    this.broadcast(
      `Terrain done. Grey studded pads are house plots. <b>!terrain clear</> removes it.`
    );
    this.busy = false;
  }

  async stop() {
    for (const e of EVENTS) this.omegga.off(e, this.handler);
  }
};
