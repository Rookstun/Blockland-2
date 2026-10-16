// The smashable bush = the owner's own build (2026-10-16, owner: "make this the new bush also i dont
// want it to be an entity just place it"; clipboard kept as pots/bush_owner.brz): the B_Bush itself is
// the Target and hides itself (BrickPropertyChanger), a sound emitter and the chip sit in it; the chip
// sends `pot.smashed` with its location (pot_pool rolls the loot), plays a random-pitched creak, logs
// "[bush] smashed" and regrows after its 120 s stopwatch. All world-grid bricks (Prefab.Load places them,
// no dynamic grid; only the chip's own grid is an entity, as with every microchip).
// Here only the stopwatch is set to "ready" (the copy was mid-countdown, 82 of 120 s).
//   node pots/bushown.mjs pots/bush_owner.brz pots/bush.brz     (brs-js 4 dist in tools/brs4)
import fs from 'fs';
const m = await import(new URL('../tools/brs4/dist.mjs', import.meta.url));
const [IN, OUT] = process.argv.slice(2);
const r = m.WorldReader.from(fs.readFileSync(IN));
const paths = r.fs.listPaths();
const files = new Map(paths.map(p => [p, r.fs.readFile(p)]));
let patched = 0;
for (const p of paths) {
  const mm = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
  if (!mm) continue;
  const ch = r.componentChunk(+mm[1], { x: +mm[2], y: +mm[3], z: +mm[4] });
  const sw = ch.components.find(c => c.typeName === 'BrickComponentType_Stopwatch');
  if (!sw) continue;
  sw.data.Time = sw.data.Limit; sw.data.bRunning = false;
  const schema = r.schemaAt(r.path('Bricks/ComponentsShared.schema'), 0);
  const parts = [schema.encode('BRSavedComponentChunkSoA', ch.soa), ...ch.components.filter(c => c.structName).map(c => schema.encode(c.structName, c.data))];
  files.set(p, new Uint8Array(Buffer.concat(parts.map(x => Buffer.from(x)))));
  patched++;
}
if (patched !== 1) throw new Error('stopwatch chunks: ' + patched);
const root = new Map();
for (const [p, content] of files) { const parts = p.split('/'); let node = root; for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); } node.set(parts.at(-1), content); }
const toNodes = mp => [...mp].map(([name, v]) => [name, v instanceof Map ? m.brdb.folder(toNodes(v)) : m.brdb.file(v)]);
const out = m.brdb.writeBrzContainer(toNodes(root));
const chk = m.WorldReader.from(out);
for (const g of chk.gridIds()) for (const c of chk.brickChunkIndex(g)) for (const comp of chk.componentChunk(g, c.index).components) if (comp.typeName === 'BrickComponentType_Stopwatch') console.log('stopwatch', JSON.stringify(comp.data));
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, out.length, 'bytes');
