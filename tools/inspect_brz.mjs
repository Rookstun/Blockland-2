// node tools/inspect_brz.mjs file.brz : dump grids, bricks, components, wires
import fs from 'fs';
const m = await import(new URL('./brs4/dist.mjs', import.meta.url));
const r = m.WorldReader.from(fs.readFileSync(process.argv[2]));
const A = r.brickAssets(), M = r.materials();
const ents = [...r.entities()];
console.log('entities', ents.map(e => `${e.persistentIndex}:${e.typeName}@${JSON.stringify(e.location)}`).join('\n '));
for (const g of [1, ...ents.map(e => e.persistentIndex)]) {
  let bs; try { bs = [...r.bricks(g)]; } catch (e) { continue; }
  if (!bs.length) continue;
  console.log(`grid ${g}: ${bs.length} bricks`);
  for (const b of bs) console.log(' ', A[b.asset_name_index]?.name ?? A[b.asset_name_index], JSON.stringify(b.size), JSON.stringify(b.position), b.direction, b.rotation, JSON.stringify(b.color), M[b.material_index]?.name ?? '', b.visibility === false ? 'INVIS' : '');
  try { for (const c of r.components(g)) console.log('  C', JSON.stringify(c).slice(0, 400)); } catch (e) { console.log('  comp err', e.message); }
  try { for (const w of r.wires(g)) console.log('  W', JSON.stringify(w).slice(0, 300)); } catch (e) {}
}
