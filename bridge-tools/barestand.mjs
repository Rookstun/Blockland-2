// Stand prefabs without their pedestal (2026-10-16, owner on the armory stands:
// "take these off their pedestals"): for every shop_*/gun_*/bow_* stand, writes
// <name>_bare.brz with the pedestal bricks (B_2x2_Round column, B_2x2F_Octo_Converter
// top) invisible and without collision. The item spawn, price button and chip are
// untouched, so the weapon floats where the octagon top was; mapgen stands these
// on stall counters in the weapon shops.
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

const names = fs.readdirSync(PREFABS).filter(f => /^(shop|gun|bow)_[a-z0-9_]+\.brz$/.test(f) && !/_bare\.brz$|_copy\.brz$|pre_/.test(f));
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
    files.set(p, new Uint8Array(schema.encode(structName, copy)));
    hidden += idx.length;
  }
  if (hidden !== 2) { console.log(`${f}: ${hidden} pedestal bricks (expected 2), skipped`); continue; }
  const out = bundle(files);
  const check = brs.WorldReader.from(Buffer.from(out));
  const vis = [...check.bricks(1)].map(b => `${assets[b.asset_name_index] ?? b.asset_name_index}:${b.visibility ? 'v' : '-'}${b.collision?.player ? 'c' : '-'}`);
  if (vis.some(v => /^(B_2x2_Round|B_2x2F_Octo_Converter):(v|.c)/.test(v)) || !vis.some(v => /^B_Button_Square:vc/.test(v))) throw new Error(`${f}: read back wrong: ${vis.join(' ')}`);
  for (const p of paths) if (!/\/Grids\/1\/Chunks\//.test(p) && !Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`${f}: ${p} changed`);
  const name = f.replace(/\.brz$/, '_bare.brz');
  fs.writeFileSync(path.join(PREFABS, name), out);
  console.log(`${name}: ${vis.join(' ')}`);
}
