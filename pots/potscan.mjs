// live entity pots: node potscan.mjs world.brdb out.json
import fs from 'fs'; import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const r = new m.WorldReader(new m.Brdb(new DatabaseSync(process.argv[2], { readOnly: true })));
const A = r.brickAssets();
const jarGrids = new Map();
for (const g of r.gridIds()) { if (g === 1) continue;
  let bs; try { bs = [...r.bricks(g)]; } catch { continue; }
  const names = bs.map(b => A[b.asset_name_index]?.name ?? A[b.asset_name_index]);
  if (names.includes('B_Jar') || names.includes('B_Bush')) jarGrids.set(g, names.join(','));
}
console.log('jar/bush grids', jarGrids.size, [...new Set(jarGrids.values())].slice(0, 5));
let ents; try { ents = [...r.entities()]; } catch (e) { console.log('entities err', e.message); }
console.log('entities', ents?.length, JSON.stringify(ents?.[0]).slice(0, 600));
const out = [];
for (const e of ents ?? []) { const id = e.persistentIndex ?? e.PersistentIndex ?? e.index ?? e.id; if (jarGrids.has(id)) out.push({ id, kind: jarGrids.get(id), e }); }
console.log('matched', out.length, JSON.stringify(out[0]).slice(0, 600));
fs.writeFileSync(process.argv[3], JSON.stringify(out));
