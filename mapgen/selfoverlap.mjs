// Counts bricks in a mapgen out dir that overlap another brick of the same
// dir (the game rejects one of each pair on load), grouped by asset and area.
//   node selfoverlap.mjs OUTDIR [--list FILE]
import fs from 'fs';
import { worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';
const dir = process.argv[2], CELL = 200;
const boxes = [], bricks = [];
for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f)).sort())
  for (const o of JSON.parse(fs.readFileSync(`${dir}/${f}`)).ops) for (const b of o.bricks || []) { bricks.push(b); boxes.push(worldBox(b, FIXED)); }
const grid = new Map(), hits = [];
for (let i = 0; i < boxes.length; i++) {
  const [lo, hi] = boxes[i];
  const seen = new Set();
  let hit = -1;
  for (let x = Math.floor(lo[0] / CELL); x <= Math.floor((hi[0] - 1) / CELL) && hit < 0; x++)
    for (let y = Math.floor(lo[1] / CELL); y <= Math.floor((hi[1] - 1) / CELL) && hit < 0; y++)
      for (const j of grid.get(x + ',' + y) ?? []) {
        if (seen.has(j)) continue; seen.add(j);
        const [a0, a1] = boxes[j];
        if (lo[0] < a1[0] && a0[0] < hi[0] && lo[1] < a1[1] && a0[1] < hi[1] && lo[2] < a1[2] && a0[2] < hi[2]) { hit = j; break; }
      }
  if (hit >= 0) { hits.push([i, hit]); continue; } // a rejected brick doesn't take space
  for (let x = Math.floor(lo[0] / CELL); x <= Math.floor((hi[0] - 1) / CELL); x++)
    for (let y = Math.floor(lo[1] / CELL); y <= Math.floor((hi[1] - 1) / CELL); y++) { const k = x + ',' + y; (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
}
const g = {};
for (const [i, j] of hits) { const b = bricks[i], k = `${b.asset ?? 'brick'} vs ${bricks[j].asset ?? 'brick'} @${Math.round(b.position[0] / 1000)}k,${Math.round(b.position[1] / 1000)}k`; g[k] = (g[k] ?? 0) + 1; }
console.log(`${dir}: ${bricks.length} bricks, ${hits.length} overlap`);
console.log(Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 12));
if (process.argv[3] === '--list') fs.writeFileSync(process.argv[4], JSON.stringify(hits.map(([i]) => bricks[i])));
