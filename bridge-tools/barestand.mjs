// Stand prefabs without their pedestal (2026-10-16, owner on the armory stands:
// "take these off their pedestals"): for every shop_*/gun_*/bow_* stand, writes
// <name>_bare.brz with the pedestal bricks (B_2x2_Round column, B_2x2F_Octo_Converter
// top) invisible and without collision. The item spawn, price button and chip are
// untouched, so the weapon floats where the octagon top was; mapgen stands these
// on stall counters in the weapon shops.
// (2026-10-16, owner screenshot of the spawn gunsmith: "this looks very wrong": the hidden
// pedestal still held the weapon ~2 bricks over a low table) the display pickup now hangs
// from the pedestal top (PickupOffsetDirection Z+ since 2026-10-21, owner: "item face set to -z when it needs to be +z"; was Z-, PICKUP_DROP units, bob PICKUP_BOB),
// so it rests just over the counter the stand stands on; env overrides for tuning.
//
//   node barestand.mjs            (server: reads/writes data/Saved/Prefabs)
//
// Only the brick chunk files of the main grid change (visibility + collision bit
// masks); every other file in the bundle is copied through, and each output is
// read back and checked.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const PICKUP_DIR = Number(process.env.PICKUP_DIR ?? 4), PICKUP_DROP = Number(process.env.PICKUP_DROP ?? 6), PICKUP_BOB = Number(process.env.PICKUP_BOB ?? 1);
// CASE=1 (2026-10-16, the owner's glass gun case in the spawn gunsmith): writes <name>_case.brz
// instead, the same plus the price button moved BUTTON_OUT units further out and BUTTON_DOWN down,
// so it sits on the case's front glass (mapgen gunCase: stand 13 units behind the glass centre)
// CAB=1 (2026-10-21, owner re-placed the spawn armory's black longsword by hand: "fix the rest of the swords so it is
// positioned like the black longsword"): <name>_cab.brz for the armory wall cabinets = CASE plus the item spawn brick
// SPAWN_DOWN 60 lower (on the cabinet's felt floor, the weapon standing up from it, Z+) and the button 50 lower again (1
// over the spawn brick: mid glass). Chip + hidden round stay up in the cabinet.
const CAB = !!process.env.CAB, SPAWN_DOWN = Number(process.env.SPAWN_DOWN ?? (CAB ? 60 : 0));
const CASE = !!process.env.CASE || CAB, BUTTON_OUT = Number(process.env.BUTTON_OUT ?? 4), BUTTON_DOWN = Number(process.env.BUTTON_DOWN ?? (CAB ? 56 : 6));
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const PEDESTAL = new Set(['B_2x2_Round', 'B_2x2F_Octo_Converter']);
const FLAGS = ['CollisionFlags_Player', 'CollisionFlags_Player1', 'CollisionFlags_Player2', 'CollisionFlags_Player3', 'CollisionFlags_Weapon',
  'CollisionFlags_Interaction', 'CollisionFlags_Physics', 'VisibilityFlags'];

function bundle(files) {
  const root = new Map();
  for (const [p, content] of files) {
    const parts = p.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) { if (!node.has(dir)) node.set(dir, new Map()); node = node.get(dir); }
    node.set(parts.at(-1), content);
  }
  const toNodes = m => [...m].map(([name, v]) => [name, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}
const clearBits = (flags, idx) => ({ ...flags, Flags: flags.Flags.map((byte, k) => { let b = byte; for (const i of idx) if ((i >> 3) === k) b &= ~(1 << (i & 7)); return b; }) });

const names = fs.readdirSync(PREFABS).filter(f => /^(shop|gun|bow)_[a-z0-9_]+\.brz$/.test(f) && !/_bare\.brz$|_case\.brz$|_cab\.brz$|_copy\.brz$|pre_/.test(f) && (!ONLY || ONLY.test(f)));
for (const f of names) {
  const reader = brs.WorldReader.from(fs.readFileSync(path.join(PREFABS, f)));
  const paths = reader.fs.listPaths();
  const schema = reader.schemaAt(reader.path('Bricks/ChunksShared.schema'), 0);
  const structName = Object.keys(schema.structs ?? {}).find(n => /BrickChunkSoA/i.test(n)) ?? 'BRSavedBrickChunkSoA';
  const assets = reader.brickAssets().map(a => a.name ?? a);
  const files = new Map(paths.map(p => [p, reader.fs.readFile(p)]));
  let hidden = 0;
  for (const p of paths) {
    const m = p.match(/^World\/0\/Bricks\/Grids\/1\/Chunks\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (!m) continue;
    const soa = reader.brickChunkSoa(1, { x: +m[1], y: +m[2], z: +m[3] });
    // BrickTypeIndices index the asset list; procedural bricks (index >= ProceduralBrickStartingIndex) are never pedestals
    const idx = soa.BrickTypeIndices.map((t, i) => (PEDESTAL.has(assets[t]) ? i : -1)).filter(i => i >= 0);
    if (!idx.length) continue;
    const copy = { ...soa };
    for (const k of FLAGS) copy[k] = clearBits(soa[k], idx);
    if (CASE) {
      // the button stands out from the stand centre along one axis: push it further that way
      const bi = soa.BrickTypeIndices.findIndex(t => assets[t] === 'B_Button_Square'), ci = soa.BrickTypeIndices.findIndex(t => assets[t] === 'B_2x2_Round');
      if (bi < 0 || ci < 0) throw new Error(`${f}: no button/round in ${p}`);
      const B = soa.RelativePositions[bi], C = soa.RelativePositions[ci];
      const dx = B.X - C.X, dy = B.Y - C.Y;
      if ((dx !== 0) === (dy !== 0)) throw new Error(`${f}: button not on one axis (${dx},${dy})`);
      const oi = soa.BrickTypeIndices.findIndex(t => assets[t] === 'B_2x2F_Octo_Converter');
      copy.RelativePositions = soa.RelativePositions.map((q, i) => i === bi ? { X: q.X + Math.sign(dx) * BUTTON_OUT, Y: q.Y + Math.sign(dy) * BUTTON_OUT, Z: q.Z - BUTTON_DOWN }
        : i === oi ? { ...q, Z: q.Z - SPAWN_DOWN } : q);
      if (copy.RelativePositions.some(q => q.Z < -1024 || q.Z >= 1024)) throw new Error(`${f}: moved brick left its chunk`);
    }
    files.set(p, new Uint8Array(schema.encode(structName, copy)));
    hidden += idx.length;
  }
  if (hidden !== 2) { console.log(`${f}: ${hidden} pedestal bricks (expected 2), skipped`); continue; }
  // the display pickup: down from the pedestal top onto the counter
  const cschema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
  let moved = 0;
  for (const p of paths) {
    const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (!m) continue;
    const chunk = reader.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] });
    if (!chunk.components.some(c => c.typeName === 'Component_ItemSpawn')) continue;
    for (const c of chunk.components) if (c.typeName === 'Component_ItemSpawn') {
      c.data.PickupOffsetDirection = PICKUP_DIR; c.data.PickupOffsetDistance = PICKUP_DROP; c.data.PickupBobHeight = PICKUP_BOB; moved++;
    }
    const parts = [cschema.encode('BRSavedComponentChunkSoA', chunk.soa)];
    for (const c of chunk.components) if (c.structName) parts.push(cschema.encode(c.structName, c.data));
    files.set(p, new Uint8Array(Buffer.concat(parts.map(x => Buffer.from(x)))));
  }
  if (moved !== 1) { console.log(`${f}: ${moved} item spawns (expected 1), skipped`); continue; }
  const out = bundle(files);
  const check = brs.WorldReader.from(Buffer.from(out));
  const vis = [...check.bricks(1)].map(b => `${assets[b.asset_name_index] ?? b.asset_name_index}:${b.visibility ? 'v' : '-'}${b.collision?.player ? 'c' : '-'}`);
  if (vis.some(v => /^(B_2x2_Round|B_2x2F_Octo_Converter):(v|.c)/.test(v)) || !vis.some(v => /^B_Button_Square:vc/.test(v))) throw new Error(`${f}: read back wrong: ${vis.join(' ')}`);
  for (const p of paths) { const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/); if (m) for (const c of check.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] }).components) if (c.typeName === 'Component_ItemSpawn' && (c.data.PickupOffsetDirection !== PICKUP_DIR || c.data.PickupOffsetDistance !== PICKUP_DROP)) throw new Error(`${f}: pickup offset read back wrong`); }
  for (const p of paths) if (!/\/Grids\/1\/(Chunks|Components)\//.test(p) && !Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`${f}: ${p} changed`);
  const name = f.replace(/\.brz$/, CAB ? '_cab.brz' : CASE ? '_case.brz' : '_bare.brz');
  fs.writeFileSync(path.join(PREFABS, name), out);
  console.log(`${name}: ${vis.join(' ')}`);
}
