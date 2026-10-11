import fs from 'fs';
import * as brs from '../mapgen/lib/brs.mjs';
const r = brs.WorldReader.from(fs.readFileSync(process.argv[2]));
console.log('owners', JSON.stringify(r.owners?.()));
for (const g of r.gridIds()) for (const { index: idx } of r.brickChunkIndex(g)) {
  try { for (const c of r.componentChunk(g, idx).components) console.log(g, c.typeName, JSON.stringify(c.data)?.slice(0, 300)); } catch (e) { console.log('err', e.message); }
  try { const w = r.wireChunk?.(g, idx); if (w) console.log('wires', JSON.stringify(w).slice(0, 1500)); } catch {}
}
