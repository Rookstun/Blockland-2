// Big beautiful woman statue (clothed, wholesome): voxel ellipsoids -> row-merged micro bricks.
// node statue/bbw.mjs CX CY Z0 out.json   (faces -y; ~260 units tall)
import fs from 'fs';
import { makeBuilder } from '../mapgen/builder.mjs';

const [CX, CY, Z0, out] = process.argv.slice(2).map((v, i) => (i < 3 ? +v : v));
const C = 8; // voxel size (units); even half-size keeps micro bricks on the 2-unit snap
const SKIN = [224, 172, 140], DRESS = [196, 40, 70], HAIR = [70, 40, 25], SHOE = [30, 30, 34], EYE = [20, 20, 20], PEARL = [240, 236, 228], LIP = [170, 40, 60];
const ell = (cx, cy, cz, rx, ry, rz) => (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
// parts in priority order (first hit wins); local coords, front = -y, feet at z 0
const parts = [
  [ell(-12, -27, 220, 5, 5, 6), EYE], [ell(12, -27, 220, 5, 5, 6), EYE], [ell(0, -27, 196, 10, 5, 4), LIP],
  [(x, y, z) => ell(0, 4, 222, 30, 28, 30)(x, y, z) && (y > -6 || z > 236), HAIR],
  [ell(0, 0, 210, 26, 28, 30), SKIN],
  [(x, y, z) => Math.abs(Math.hypot(x, y + 4) - 30) < 4 && Math.abs(z - 178) < 4 && y < 0, PEARL],
  [ell(-66, -6, 128, 18, 18, 50), SKIN], [ell(66, -6, 128, 18, 18, 50), SKIN],
  [ell(0, 0, 150, 62, 48, 36), DRESS], [ell(0, 0, 100, 74, 56, 52), DRESS],
  [(x, y, z) => z >= 40 && z < 80 && Math.hypot(x, y) <= 70 - (80 - z) * -0.2, DRESS],
  [ell(-26, 0, 24, 18, 18, 40), SKIN], [ell(26, 0, 24, 18, 18, 40), SKIN],
  [ell(-26, -10, 6, 18, 26, 8), SHOE], [ell(26, -10, 6, 18, 26, 8), SHOE],
];
const b = makeBuilder();
const R = 96;
let n = 0;
for (let z = 0; z < 264; z += C) for (let y = -R; y < R; y += C) {
  let run = null;
  const flush = xe => { if (run) { b.box(CX + run.x0, CY + y, Z0 + z, CX + xe, CY + y + C, Z0 + z + C, { color: run.col, material: 'BMC_Plastic' }, 'v'); n++; run = null; } };
  for (let x = -R; x < R; x += C) {
    const p = parts.find(([f]) => f(x + C / 2, y + C / 2, z + C / 2));
    const col = p?.[1];
    if (run && run.col !== col) flush(x);
    if (col && !run) run = { x0: x, col };
  }
  flush(R);
}
if (b.dropped.length) throw new Error(`self-check: ${b.dropped.length} overlaps`);
// plinth
b.box(CX - 100, CY - 100, Z0 - 20, CX + 100, CY + 100, Z0, { color: [200, 196, 186], material: 'BMC_Plastic' }, 'plinth');
fs.writeFileSync(out, JSON.stringify(b.bricks.map(({ label, ...r }) => r)));
console.log(`${b.bricks.length} bricks`);
