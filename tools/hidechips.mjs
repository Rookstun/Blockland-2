// Hide every B_1x1_Microchip brick of a prefab's world grid (owner 2026-10-15: microchips are invisible:
// visibility off, no player/weapon/interaction/physics collision). Only the brick chunk files change.
//   node tools/hidechips.mjs in.brz out.brz
import fs from 'node:fs';
const m = await import(new URL('./brs4/dist.mjs', import.meta.url));
const [IN, OUT] = process.argv.slice(2);
const r = m.WorldReader.from(fs.readFileSync(IN));
const assets = r.brickAssets().map(a => a.name ?? a);
const schema = r.schemaAt(r.path('Bricks/ChunksShared.schema'), 0);
const FLAGS = ['CollisionFlags_Player', 'CollisionFlags_Player1', 'CollisionFlags_Player2', 'CollisionFlags_Player3', 'CollisionFlags_Weapon',
  'CollisionFlags_Interaction', 'CollisionFlags_Physics', 'VisibilityFlags'];
const clearBits = (flags, idx) => ({ ...flags, Flags: flags.Flags.map((byte, k) => { let b = byte; for (const i of idx) if ((i >> 3) === k) b &= ~(1 << (i & 7)); return b; }) });
const paths = r.fs.listPaths();
const files = new Map(paths.map(p => [p, r.fs.readFile(p)]));
let n = 0;
for (const p of paths) {
  const mm = p.match(/^World\/0\/Bricks\/Grids\/1\/Chunks\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
  if (!mm) continue;
  const soa = r.brickChunkSoa(1, { x: +mm[1], y: +mm[2], z: +mm[3] });
  const idx = soa.BrickTypeIndices.map((t, i) => (assets[t] === 'B_1x1_Microchip' ? i : -1)).filter(i => i >= 0);
  if (!idx.length) continue;
  const copy = { ...soa };
  for (const k of FLAGS) if (soa[k]) copy[k] = clearBits(soa[k], idx);
  files.set(p, new Uint8Array(schema.encode('BRSavedBrickChunkSoA', copy)));
  n += idx.length;
}
const root = new Map();
for (const [p, content] of files) { const parts = p.split('/'); let node = root; for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); } node.set(parts.at(-1), content); }
const toNodes = mp => [...mp].map(([name, v]) => [name, v instanceof Map ? m.brdb.folder(toNodes(v)) : m.brdb.file(v)]);
const out = m.brdb.writeBrzContainer(toNodes(root));
fs.writeFileSync(OUT, out);
const chk = m.WorldReader.from(out);
const hidden = [...chk.bricks(1)].filter(b => assets[b.asset_name_index] === 'B_1x1_Microchip');
console.log(`${n} chip bricks hidden; read back: ${hidden.map(b => `vis ${b.visibility} col ${b.collision.player}`).join(', ')}; files ${chk.fs.listPaths().length}/${paths.length}`);
