// Clear plan for a deployed city (2026-10-26): ClearRegion only takes bricks ENTIRELY inside a box and a box
// holding ~1,800+ bricks silently clears nothing, so the old city's bricks are cleared in passes of growing
// grid boxes (160, 320, ... units, full height): each pass takes what lies inside its cells, the next takes
// what straddled the last pass's lines. Simulated here so every box holds < LIMIT bricks and every brick goes.
//   node mapgen/cityclear.mjs OLD_OUTDIR out.json   -> [[cx, cy, cz, hx, hy, hz], ...] in pass order
import fs from 'fs';
import path from 'path';
import { worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [dir, out] = process.argv.slice(2);
const LIMIT = 1500;
let left = JSON.parse(fs.readFileSync(path.join(dir, 'bricks.json'), 'utf8')).map(b => worldBox(b, FIXED));
const boxes = [];
let pass = 0;
for (const S of [160, 320, 640, 1280, 2560, 160, 320, 640, 1280, 2560, 5120, 10240, 20480]) {
  if (!left.length) break;
  // each pass shifts its grid (lines at 0 would be lines of every power-of-two pass)
  const off = Math.round(((pass++ * 0.37) % 1) * S / 10) * 10;
  const cells = new Map();
  for (const bx of left) {
    const [lo, hi] = bx, gx = Math.floor((lo[0] - off) / S), gy = Math.floor((lo[1] - off) / S);
    if (hi[0] - off <= (gx + 1) * S && hi[1] - off <= (gy + 1) * S) { const k = gx + ',' + gy; (cells.get(k) ?? cells.set(k, []).get(k)).push(bx); }
  }
  const taken = new Set();
  for (const [k, list] of cells) {
    if (list.length >= LIMIT) continue;
    const [gx, gy] = k.split(',').map(Number);
    let z1 = 0; for (const [, hi] of list) z1 = Math.max(z1, hi[2]);
    boxes.push([gx * S + off + S / 2, gy * S + off + S / 2, (z1 + 10) / 2, S / 2, S / 2, (z1 + 10) / 2]);
    list.forEach(b => taken.add(b));
  }
  left = left.filter(b => !taken.has(b));
  console.error(`pass ${S}+${off}: ${boxes.length} boxes so far, ${left.length} bricks left`);
}
if (left.length) throw new Error(`${left.length} bricks never fit a box`);
fs.writeFileSync(out, JSON.stringify(boxes));
console.error(`${boxes.length} ClearRegions -> ${out}`);
