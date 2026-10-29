// node farm/dump.mjs file.brz  -> paths, bricks, components, wires
import fs from 'fs';
const m = await import(new URL('../tools/brs4/dist.mjs', import.meta.url));
const r = m.WorldReader.from(fs.readFileSync(process.argv[2]));
console.log('paths', r.fs.listPaths());
for (const g of r.gridIds()) for (const c of r.brickChunkIndex(g)) {
  try { const b = r.brickChunk(g, c.index); console.log('GRID', g, 'chunk', JSON.stringify(c.index), 'bricks', JSON.stringify(b, (k, v) => typeof v === 'bigint' ? String(v) : v).slice(0, 4000)); } catch (e) { console.log('brickerr', e.message); }
  try { for (const comp of r.componentChunk(g, c.index).components) console.log(' COMP', comp.typeName, JSON.stringify(comp.data, (k, v) => typeof v === 'bigint' ? String(v) : v)?.slice(0, 600)); } catch (e) { console.log(' comperr', e.message); }
  try { const w = r.wireChunk?.(g, c.index); if (w) console.log(' WIRES', JSON.stringify(w).slice(0, 2000)); } catch (e) { console.log(' wireerr', e.message); }
}
