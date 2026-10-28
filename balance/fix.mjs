// /fix (owner 2026-10-20: "fixes npcs, reloads npcs interaction placement reloads and re places shops").
// Server tool beside balance.mjs in ~/omegga-server/bridge/balance/ (the balance plugin runs it on /fix).
//   node fix.mjs [all|npcs|shops] [dry]
//   npcs:  1. quest NPC bodies (bot spawner + talk-rod chip, owner NPC Talk): br.Bricks.Clear that owner
//             (= the bodies + questchip + questhud, nothing else is theirs), then load questchip, questhud
//             and qnpc_<id> at each plugins/quests/npcs.json spot -> fresh bots + rods that follow them
//          2. shopkeepers / staff (live spawners whose BotName is one of the npc_<role> prefabs): clear the
//             spawner (25 25 8) and load a homed copy (live MoveTarget) at the same spot, lifted on overlap
//   shops: every stand in stands.json with a shop button live at its spot: clear (box per stand kind),
//          reload the same prefab (only where the clear removed something)
// Then World.Save. Lines starting with '#' are whispered to whoever typed /fix.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { DatabaseSync } from 'node:sqlite';

const HOME = process.env.HOME, SRV = path.join(HOME, 'omegga-server');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PREFABS = path.join(SRV, 'data/Saved/Prefabs'), WORLDS = path.join(SRV, 'data/Saved/Worlds');
const BRIDGE = path.join(SRV, 'bridge'), TOOLS = path.join(BRIDGE, 'tools');
const brs = await import(path.join(SRV, 'plugins/bridge/lib/brs.mjs'));
const brs4 = await import(path.join(HERE, 'sd/tools/brs4/dist.mjs'));
const say = s => console.log('# ' + s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => (typeof v === 'bigint' ? Number(v) : v);

const NPC_TALK = 'ea32a1c0-0000-4b0b-9a11-00000000a1c0';
const QUEST_NPCS = path.join(SRV, 'plugins/quests/npcs.json');
const QUEST_CHIPS = [['questchip', -8000, -12000, 8000], ['questhud', -7000, -12000, 8000]];

const [mode = 'all', flag] = process.argv.slice(2);
const DRY = mode === 'dry' || flag === 'dry';
const DO_NPCS = ['all', 'dry', 'npcs', 'npc'].includes(mode), DO_SHOPS = ['all', 'dry', 'shops', 'shop'].includes(mode);

async function job(ops, tag) {
  const id = `${Date.now()}_${process.pid}_fix_${tag}.json`;
  fs.writeFileSync(path.join(BRIDGE, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(BRIDGE, 'inbox', id + '.tmp'), path.join(BRIDGE, 'inbox', id));
  const out = path.join(BRIDGE, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 600) throw new Error('bridge gave no result for ' + id); await sleep(500); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res.results ?? [];
}
const cmd = (line, captureMs = 150) => ({ op: 'cmd', line, captureMs });
const bad = r => /overlapping|Missing brick|not found|Failed/i.test(JSON.stringify(r ?? ''));

// live spawners [{name, pos, move}] (brs-js 4, brs-js 3 for chunks it can't read)
function liveSpawners(file) {
  const out = [], seen = new Set();
  const add = (r, idx, cc) => {
    const rel = r.brickChunkSoa(1, idx).RelativePositions;
    for (const c of cc.components) if (c.typeName === 'Component_BotSpawn' && c.data && rel[c.brickIndex]) {
      const p = rel[c.brickIndex], pos = [idx.x * 2048 + 1024 + p.X, idx.y * 2048 + 1024 + p.Y, idx.z * 2048 + 1024 + p.Z];
      const key = pos.join(','); if (seen.has(key)) continue; seen.add(key);
      out.push({ name: c.data.BotName, pos, move: c.data.MoveTarget });
    }
  };
  const w4 = new brs4.WorldReader(new brs4.Brdb(new DatabaseSync(file, { readOnly: true })));
  const miss = [];
  for (const { index } of w4.brickChunkIndex(1)) { try { add(w4, index, w4.componentChunk(1, index)); } catch { miss.push(index); } }
  if (miss.length) {
    const w3 = new brs.Brdb(new DatabaseSync(file, { readOnly: true })).worldReader();
    for (const idx of miss) { try { add(w3, idx, w3.componentChunk(1, idx)); } catch { } }
  }
  return out;
}
function liveButtons(file) {
  const w = new brs4.WorldReader(new brs4.Brdb(new DatabaseSync(file, { readOnly: true })));
  const A = w.brickAssets().map(a => a?.name ?? a), out = [];
  for (const { index } of w.brickChunkIndex(1)) {
    let s; try { s = w.brickChunkSoa(1, index); } catch { continue; }
    s.BrickTypeIndices.forEach((t, i) => { if (/Button/i.test(A[t])) { const p = s.RelativePositions[i]; out.push([index.x * 2048 + 1024 + p.X, index.y * 2048 + 1024 + p.Y, index.z * 2048 + 1024 + p.Z]); } });
  }
  return out;
}
// BotName -> npc_<role> prefab
function npcPrefabs() {
  const out = {};
  for (const f of fs.readdirSync(PREFABS).filter(f => /^npc_[a-z]+\.brz$/.test(f))) {
    try {
      const r = brs.WorldReader.from(fs.readFileSync(path.join(PREFABS, f)));
      for (const p of r.fs.listPaths()) {
        const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
        if (!m) continue;
        for (const c of r.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] }).components)
          if (c.typeName === 'Component_BotSpawn' && c.data?.BotName) out[c.data.BotName] ??= f.replace(/\.brz$/, '');
      }
    } catch { }
  }
  return out;
}
const DIRS = { 16: [0, -1], 17: [1, 0], 18: [0, 1], 19: [-1, 0] };
function standBoxes(s) {
  const [x, y, z] = s.at, [dx, dy] = DIRS[s.orient] ?? [0, -1];
  if (/_case$|_cab$/.test(s.prefab)) {
    const h = (a, c) => (dx ? [a, c] : [c, a]);
    const [h1x, h1y] = h(18, 18), [h2x, h2y] = h(12, 11), [h3x, h3y] = h(17, 11);
    const low = /_cab$/.test(s.prefab) ? [[x + 4 * dx, y + 4 * dy, z - 57, h3x, h3y, 7]] : []; // _cab: spawn brick + button 57 down (barestand CAB)
    return [[x + 4 * dx, y + 4 * dy, z, h1x, h1y, 13], [x - 2 * dx, y - 2 * dy, z, h2x, h2y, 14], ...low];
  }
  if (/_bare$/.test(s.prefab)) return [[x, y, z + 8, 16, 16, 22]];
  return [[x, y, z, 13, 13, 13]];
}

async function snapshot() {
  await job([cmd('br.World.Save', 5000)], 'save');
  await sleep(8000);
  const world = fs.readdirSync(WORLDS).filter(f => f.endsWith('.brdb')).map(f => [f, fs.statSync(path.join(WORLDS, f)).mtimeMs]).sort((a, b) => b[1] - a[1])[0][0];
  const copy = '/tmp/fix_scan.brdb';
  fs.copyFileSync(path.join(WORLDS, world), copy);
  say(`world "${world.replace(/\.brdb$/, '')}"`);
  return copy;
}

async function fixQuestNpcs() {
  const npcs = JSON.parse(fs.readFileSync(QUEST_NPCS, 'utf8'));
  const loads = [...QUEST_CHIPS, ...npcs.map(n => [`qnpc_${n.id}`, ...n.at])].filter(([p]) => fs.existsSync(path.join(PREFABS, p + '.brz')));
  if (DRY) { say(`quest NPCs: would reload ${npcs.length} bodies + questchip + questhud`); return; }
  await job([cmd(`br.Bricks.Clear ${NPC_TALK} 1`, 3000)], 'qclr');
  return say('quest NPCs: quests are off (owner 2026-10-27), bodies cleared, none reloaded');
  await sleep(2500);
  const res = await job(loads.map(([p, x, y, z]) => cmd(`br.Prefab.Load "${p}" ${x} ${y} ${z} 0 16`, 600)), 'qld');
  const fails = loads.filter((l, k) => bad(res[k]));
  say(`quest NPCs: ${loads.length - fails.length}/${loads.length} reloaded (bodies, talk rods, quest chips)${fails.length ? ', problems: ' + fails.map(l => l[0]).join(' ') : ''}`);
}

async function fixShopkeepers(world) {
  const map = npcPrefabs();
  const questNames = new Set(JSON.parse(fs.readFileSync(QUEST_NPCS, 'utf8')).map(n => n.name));
  const todo = liveSpawners(world).filter(s => map[s.name] && !questNames.has(s.name));
  if (DRY || !todo.length) { say(`shopkeepers/staff: ${todo.length}${DRY ? ' would be re-placed' : ''}`); return; }
  let placed = 0; const lost = [];
  for (let i = 0; i < todo.length; i += 15) {
    const part = todo.slice(i, i + 15);
    part.forEach((s, k) => {
      const m = s.move && (s.move.X || s.move.Y || s.move.Z) ? [s.move.X, s.move.Y, s.move.Z] : s.pos;
      s.prefab = `fix_npc_${i + k}`;
      execFileSync(process.execPath, ['homes.mjs', 'prefab', path.join(PREFABS, map[s.name] + '.brz'), path.join(PREFABS, s.prefab + '.brz'), ...m.map(v => String(num(v)))], { cwd: TOOLS, stdio: 'pipe' });
    });
    await job(part.map(s => cmd(`br.World.ClearRegion ${s.pos.join(' ')} 25 25 8`, 120)), 'nclr' + i);
    await sleep(1500);
    let left = part;
    for (const lift of [0, 12, 24, 36]) {
      if (!left.length) break;
      const res = await job(left.map(s => cmd(`br.Prefab.Load "${s.prefab}" ${s.pos[0]} ${s.pos[1]} ${s.pos[2] + lift} 0 16`, 400)), `nld${i}_${lift}`);
      const ok = left.filter((s, k) => !JSON.stringify(res[k] ?? '').includes('Component_BotSpawn'));
      placed += ok.length; left = left.filter(s => !ok.includes(s));
    }
    lost.push(...left);
  }
  say(`shopkeepers/staff: ${placed}/${todo.length} re-placed${lost.length ? ', not placed: ' + lost.map(s => s.name + ' ' + s.pos.join(',')).join('; ') : ''}`);
}

async function fixStands(world) {
  const btn = liveButtons(world);
  const all = JSON.parse(fs.readFileSync(path.join(HERE, 'stands.json'), 'utf8'));
  const stands = all.filter(s => fs.existsSync(path.join(PREFABS, s.prefab + '.brz'))
    && btn.some(p => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) < 30 && Math.abs(p[2] - s.at[2] + (/_cab$/.test(s.prefab) ? 57 : 0)) < 40));
  if (DRY) { say(`shops: ${stands.length} stands would be re-placed`); return; }
  say(`re-placing ${stands.length} shop stands...`);
  let done = 0, rejects = 0;
  for (let i = 0; i < stands.length; i += 10) {
    const part = stands.slice(i, i + 10), boxes = part.map(standBoxes);
    const res = await job(boxes.flat().map(([x, y, z, a, b, c]) => cmd(`br.World.ClearRegion ${x} ${y} ${z} ${a} ${b} ${c}`, 150)), 'sclr' + i);
    let k = 0;
    const was = boxes.map(bx => bx.map(() => JSON.stringify(res[k++] ?? '')).some(t => !t.includes('No bricks to clear')));
    const go = part.filter((s, j) => was[j]);
    await sleep(1500);
    if (go.length) {
      const r = await job(go.map(s => cmd(`br.Prefab.Load "${s.prefab}" ${s.at[0]} ${s.at[1]} ${s.at[2]} 0 ${s.orient}`, 250)), 'sld' + i);
      r.forEach((x, j) => { if (bad(x)) { rejects++; console.log('REJECT', go[j].prefab, go[j].at.join(',')); } });
      done += go.length;
    }
    if ((i / 10) % 6 === 5) say(`shops ${Math.min(i + 10, stands.length)}/${stands.length}`);
  }
  say(`shops: ${done} stands re-placed${rejects ? `, ${rejects} rejected` : ''}`);
}

const world = await snapshot();
if (DO_NPCS) { await fixQuestNpcs(); await fixShopkeepers(world); }
if (DO_SHOPS) await fixStands(world);
if (!DRY) await job([cmd('br.World.Save', 5000)], 'save2');
say(DRY ? 'dry run, nothing changed' : 'done, world saved');
