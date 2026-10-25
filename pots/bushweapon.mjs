// (owner 2026-10-25: "bushes in the swamp have nocollide enabled. change it so it can be hit") the owner's
// bush chip drove bVisibility / bCollisionEnabled / _Player / _Interaction of the bush's BrickPropertyChanger
// but not _Weapon, whose stored value is false: shots went through every bush. Adds the missing wire
// (same source as the others: shown = stopwatch Time >= Limit), like the pots (potgen6.mjs).
//   node pots/bushweapon.mjs pots/bush.brz pots/bush.brz
import fs from 'fs';
const m = await import(new URL('../tools/brs4/dist.mjs', import.meta.url));
const [IN, OUT] = process.argv.slice(2);
const r = m.WorldReader.from(fs.readFileSync(IN));
const g = r.globalData(), PORT = 'bCollisionEnabled_Weapon';
const paths = r.fs.listPaths();
const files = new Map(paths.map(p => [p, r.fs.readFile(p)]));
let pi = g.ComponentWirePortNames.indexOf(PORT);
if (pi < 0) { // the prefab's port name table lacks it: append
  const gd = r.decode(r.path('GlobalData.mps'), r.path('GlobalData.schema'), 'BRSavedGlobalDataSoA');
  pi = gd.ComponentWirePortNames.push(PORT) - 1;
  files.set(r.path('GlobalData.mps'), new Uint8Array(Buffer.from(r.schemaAt(r.path('GlobalData.schema'), 0).encode('BRSavedGlobalDataSoA', gd))));
  g.ComponentWirePortNames.push(PORT);
}
let added = 0;
for (const p of paths) {
  if (!/^World\/0\/Bricks\/Grids\/\d+\/Wires\/.*\.mps$/.test(p)) continue;
  const w = r.decode(p, r.path('Bricks/WiresShared.schema'), 'BRSavedWireChunkSoA');
  const name = t => g.ComponentWirePortNames[t.PortIndex];
  const vis = w.RemoteWireTargets.findIndex(t => name(t) === 'bVisibility' && g.ComponentTypeNames[t.ComponentTypeIndex] === 'Component_BrickPropertyChanger');
  if (vis < 0) continue;
  if (w.RemoteWireTargets.some(t => name(t) === PORT)) { console.log('already wired', p); continue; }
  w.RemoteWireSources.push({ ...w.RemoteWireSources[vis], ChunkIndex: { ...w.RemoteWireSources[vis].ChunkIndex } });
  w.RemoteWireTargets.push({ ...w.RemoteWireTargets[vis], PortIndex: pi });
  const schema = r.schemaAt(r.path('Bricks/WiresShared.schema'), 0);
  files.set(p, new Uint8Array(Buffer.from(schema.encode('BRSavedWireChunkSoA', w))));
  added++;
}
if (added !== 1) throw new Error('wires added: ' + added);
const root = new Map();
for (const [p, content] of files) { const parts = p.split('/'); let node = root; for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); } node.set(parts.at(-1), content); }
const toNodes = mp => [...mp].map(([name, v]) => [name, v instanceof Map ? m.brdb.folder(toNodes(v)) : m.brdb.file(v)]);
const out = m.brdb.writeBrzContainer(toNodes(root));
const chk = m.WorldReader.from(out);
for (const gid of chk.gridIds()) for (const c of chk.brickChunkIndex(gid)) for (const x of chk.wireChunk(gid, c.index).remote) if (x.target.componentType === 'Component_BrickPropertyChanger') console.log('wire ->', x.target.port);
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, out.length, 'bytes');
