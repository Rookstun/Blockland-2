// Miniature Mont Saint-Michel from the smallest cubes only (Kraken, 2026-11-06): every brick is a 2-unit
// PB_DefaultMicroBrick cube; only cubes with an open face are placed (the inside stays empty). Sand flat + causeway
// south, granite rock, ramparts with round towers and merlons, a village of cream houses with slate roofs on the
// slopes, the abbey on the summit (nave, transept, tower, spire, gold statue on top). node mapgen/montstmichel.mjs X Y Z
import { rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000057be', name: 'Claude Mont St Michel', display_name: 'Claude Mont St Michel' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const rand = rng(1066);
const V = new Map(); // "i,j,k" -> [r,g,b]
const key = (i, j, k) => `${i},${j},${k}`;
const set = (i, j, k, c) => { if (k >= 0) V.set(key(i, j, k), c); };
const box = (i0, j0, k0, i1, j1, k1, c) => { for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++) set(i, j, k, typeof c === 'function' ? c(i, j, k) : c); };
const SAND = [214, 196, 150], WET = [176, 160, 122], GRANITE = [128, 122, 114], DARK = [98, 94, 88], CREAM = [222, 210, 186], SLATE = [64, 70, 82], GOLD = [235, 190, 60];
const rockH = (r, a) => Math.max(0, 40 * (1 - (r / 44) ** 1.6) + 2 * Math.sin(a * 5) + 1.5 * Math.sin(a * 9 + 1)); // hill height at radius r
// sand flat with wet rings, causeway south
for (let i = -72; i <= 72; i++) for (let j = -72; j <= 72; j++) { const r = Math.hypot(i, j); if (r <= 72) set(i, j, 0, r > 60 ? WET : SAND); }
box(-3, -72, 1, 4, -44, 2, GRANITE);
// rock
for (let i = -45; i <= 45; i++) for (let j = -45; j <= 45; j++) {
  const r = Math.hypot(i, j), a = Math.atan2(j, i), h = Math.round(rockH(r, a));
  for (let k = 1; k <= h; k++) set(i, j, k, (i * 7 + j * 3 + k) % 5 ? GRANITE : DARK);
}
// ramparts: a ring wall with merlons, round towers every 40 degrees
for (let t = 0; t < 720; t++) {
  const a = (t / 720) * 2 * Math.PI;
  for (const r of [46, 47]) { const i = Math.round(Math.cos(a) * r), j = Math.round(Math.sin(a) * r); for (let k = 1; k <= 12; k++) set(i, j, k, DARK); if (t % 8 < 4) set(i, j, 13, DARK); }
}
for (let n = 0; n < 9; n++) {
  const a = (n / 9) * 2 * Math.PI + 0.2, ci = Math.round(Math.cos(a) * 47), cj = Math.round(Math.sin(a) * 47);
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) if (i * i + j * j <= 16) { for (let k = 1; k <= 16; k++) set(ci + i, cj + j, k, GRANITE); if (i * i + j * j >= 9 && (i + j) % 2 === 0) set(ci + i, cj + j, 17, GRANITE); }
}
// village: small houses stepping up the slopes (avoid the causeway gate and the summit)
for (let n = 0; n < 70; n++) {
  const a = rand() * 2 * Math.PI, r = 24 + rand() * 18;
  if (Math.abs(a - 1.5 * Math.PI) < 0.25) continue;
  const ci = Math.round(Math.cos(a) * r), cj = Math.round(Math.sin(a) * r), base = Math.round(rockH(r, a)) + 1;
  const w = 3 + Math.floor(rand() * 2), d = 3 + Math.floor(rand() * 2), h = 4 + Math.floor(rand() * 3);
  box(ci, cj, base, ci + w, cj + d, base + h, CREAM);
  for (let s = 0; s < 3; s++) box(ci - 1 + s, cj - 1 + s, base + h + s, ci + w + 1 - s, cj + d + 1 - s, base + h + s + 1, SLATE); // stepped slate roof
  set(ci + Math.floor(w / 2), cj - 0, base + 1, [70, 50, 40]); // door
}
// abbey on the summit
const top = Math.round(rockH(0, 0)) + 1;
box(-6, -15, top - 6, 7, 16, top, GRANITE); // terrace
box(-4, -14, top, 5, 15, top + 16, (i, j, k) => (k - top) % 4 === 3 && Math.abs(i) < 4 ? DARK : GRANITE); // nave
box(-10, -3, top, 11, 4, top + 14, GRANITE); // transept
for (let s = 0; s < 5; s++) box(-4 + s, -14, top + 16 + s, 5 - s, 15, top + 17 + s, SLATE); // nave roof
box(-3, -3, top + 16, 4, 4, top + 34, GRANITE); // tower
for (let s = 0; s < 22; s++) { const w = Math.max(0, 3 - Math.floor(s / 7)); box(-w, -w, top + 34 + s, w + 1, w + 1, top + 35 + s, SLATE); } // spire
box(0, 0, top + 56, 1, 1, top + 62, GOLD); // the archangel, gold, on the tip
set(-1, 0, top + 60, GOLD); set(1, 0, top + 60, GOLD); // arms (wings)
// keep only cubes with at least one empty neighbour
const bricks = [];
for (const [k, c] of V) {
  const [i, j, z] = k.split(',').map(Number);
  const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, d]) => z + d >= 0 && !V.has(key(i + a, j + b, z + d)));
  if (open) bricks.push({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [i * 2 + 1, j * 2 + 1, z * 2 + 1], color: c });
}
if (bricks.some(b => b.position.some(v => !Number.isInteger(v)))) throw new Error('off grid');
process.stderr.write(`montstmichel: ${bricks.length} cubes (of ${V.size} voxels), ${(top + 62) * 2} units tall, 290 across, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 8000, bricks }] }));
