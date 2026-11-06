// Miniature Mont Saint-Michel from the smallest cubes only (Kraken, 2026-11-06; v2 after "entry missing, no path, no
// garden, no shop, the eglise is bad": gatehouse, Grande Rue, shops, parish church, gardens, nave/choir/Merveille/spire): every brick is a 2-unit
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
  if (Math.abs(a - 1.5 * Math.PI) < 0.09) continue; // the gate (built below)
  for (const r of [46, 47]) { const i = Math.round(Math.cos(a) * r), j = Math.round(Math.sin(a) * r); for (let k = 1; k <= 12; k++) set(i, j, k, DARK); if (t % 8 < 4) set(i, j, 13, DARK); }
}
for (let n = 0; n < 9; n++) {
  const a = (n / 9) * 2 * Math.PI + 0.2, ci = Math.round(Math.cos(a) * 47), cj = Math.round(Math.sin(a) * 47);
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) if (i * i + j * j <= 16) { for (let k = 1; k <= 16; k++) set(ci + i, cj + j, k, GRANITE); if (i * i + j * j >= 9 && (i + j) % 2 === 0) set(ci + i, cj + j, 17, GRANITE); }
}
// ---- entry: gatehouse where the causeway meets the ramparts: twin towers, an arched opening ----
const COBBLE = [150, 142, 130], GREEN = [92, 140, 70], LEAF = [70, 120, 60], TRUNK = [96, 70, 46];
for (const s2 of [-1, 1]) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i * i + j * j <= 9) { for (let k = 1; k <= 19; k++) set(s2 * 7 + i, -47 + j, k, GRANITE); if ((i + j) % 2 === 0 && i * i + j * j >= 4) set(s2 * 7 + i, -47 + j, 20, GRANITE); }
box(-4, -50, 9, 5, -44, 18, DARK); // lintel block over the gate
for (let i = -3; i <= 3; i++) for (let k = 9; k < 12; k++) if (i * i + (k - 8) ** 2 <= 10) for (let j = -50; j < -44; j++) V.delete(key(i, j, k)); // round arch
box(-3, -50, 1, 4, -44, 2, COBBLE);
// ---- Grande Rue: a cobbled street spiralling up from the gate (east side first) to the abbey steps ----
const street = [];
for (let t = 0; t <= 1; t += 0.002) {
  const a = 1.5 * Math.PI + t * 1.7 * Math.PI, r = 43 - t * 27; // from the gate, round the east and north
  const ci = Math.round(Math.cos(a) * r), cj = Math.round(Math.sin(a) * r), h = Math.round(rockH(r, a)) + 1;
  street.push([ci, cj, h, a, r]);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    for (let k = h; k <= h + 9; k++) V.delete(key(ci + di, cj + dj, k)); // cut into the rock
    set(ci + di, cj + dj, h - 1, COBBLE);
  }
}
// ---- houses and shops along the street (shops get a coloured awning + sign on the street side) ----
const AWN = [[200, 60, 60], [60, 120, 190], [220, 170, 50], [90, 150, 80], [160, 80, 150]];
for (let n = 0; n < street.length; n += 22) {
  const [ci, cj, h, a, r] = street[n];
  for (const side of [-1, 1]) {
    const rr = r + side * 5, hi = Math.round(Math.cos(a) * rr), hj = Math.round(Math.sin(a) * rr);
    if (Math.hypot(hi, hj) > 44 || Math.hypot(hi, hj) < 12) continue;
    const base = Math.round(rockH(rr, a)) + 1, w = 3, d = 3, hh = 5 + ((n / 22 + side) & 1);
    box(hi - 1, hj - 1, base, hi + w - 1, hj + d - 1, base + hh, CREAM);
    for (let st = 0; st < 2; st++) box(hi - 2 + st, hj - 2 + st, base + hh + st, hi + w - st, hj + d - st, base + hh + st + 1, SLATE);
    const shop = side < 0; // the street-side (inner) row are shops
    const fi = Math.round(Math.cos(a) * (rr - side * 2)), fj = Math.round(Math.sin(a) * (rr - side * 2));
    set(fi, fj, base + 1, [70, 50, 40]); // door facing the street
    if (shop) { const c = AWN[(n / 22) % AWN.length]; set(fi, fj, base + 3, c); set(fi + 1, fj, base + 3, c); set(fi, fj + 1, base + 3, c); set(fi, fj, base + 4, GOLD); }
  }
}
// ---- parish church (Saint-Pierre) partway up the street: small nave + little spire ----
{ const [ci, cj, , a, r] = street[Math.floor(street.length * 0.42)], rr = r + 6, pi = Math.round(Math.cos(a) * rr), pj = Math.round(Math.sin(a) * rr), base = Math.round(rockH(rr, a)) + 1;
  box(pi - 2, pj - 4, base, pi + 3, pj + 5, base + 7, GRANITE); box(pi - 1, pj - 1, base + 7, pi + 2, pj + 2, base + 12, GRANITE);
  for (let st = 0; st < 5; st++) set(pi, pj, base + 12 + st, SLATE); }
// ---- gardens: terraces on the west and north slopes with paths and small trees ----
for (const [a0, a1] of [[0.75 * Math.PI, 1.15 * Math.PI], [0.35 * Math.PI, 0.6 * Math.PI]]) for (let a = a0; a < a1; a += 0.03) for (let r = 18; r < 40; r += 1) {
  const i = Math.round(Math.cos(a) * r), j = Math.round(Math.sin(a) * r), h = Math.round(rockH(r, a));
  if (V.get(key(i, j, h)) === GRANITE || V.get(key(i, j, h)) === DARK) set(i, j, h, (r % 6 === 0) ? COBBLE : GREEN);
}
for (let n = 0; n < 16; n++) { const a = (n % 2 ? 0.95 : 0.47) * Math.PI + (rand() - 0.5) * 0.3, r = 20 + rand() * 18, i = Math.round(Math.cos(a) * r), j = Math.round(Math.sin(a) * r), h = Math.round(rockH(r, a)) + 1;
  if (V.has(key(i, j, h))) continue; box(i, j, h, i + 1, j + 1, h + 3, TRUNK); box(i - 1, j - 1, h + 3, i + 2, j + 2, h + 6, LEAF); }
// ---- abbey on the summit ----
const top = Math.round(rockH(0, 0)) + 1;
box(-7, -17, top - 6, 8, 18, top, GRANITE); // platform
box(-6, -22, top - 2, 7, -16, top, GRANITE); // west terrace
box(-2, -22, top - 12, 3, -16, top - 2, COBBLE); // grand stair up to the terrace
// Romanesque nave (west half): round-headed windows in dark
box(-4, -16, top, 5, 1, top + 14, (i, j, k) => (Math.abs(i) === 4 || i === 4) && (j % 4 === 0) && k > top + 6 && k < top + 11 ? DARK : GRANITE);
// Gothic choir (east half): taller, lancets, pinnacle buttresses
box(-5, 1, top, 6, 16, top + 20, (i, j, k) => (i === -5 || i === 5) && j % 3 === 0 && k > top + 4 && k < top + 17 ? DARK : GRANITE);
for (let j = 2; j < 16; j += 3) for (const i of [-7, 7]) { box(i, j, top, i + 1, j + 1, top + 16, GRANITE); set(i, j, top + 16, GRANITE); set(i, j, top + 17, GRANITE); }
box(-10, -3, top, 11, 4, top + 14, GRANITE); // transept
for (let st = 0; st < 5; st++) box(-4 + st, -16, top + 14 + st, 5 - st, 1, top + 15 + st, SLATE); // nave roof
for (let st = 0; st < 6; st++) box(-5 + st, 1, top + 20 + st, 6 - st, 16, top + 21 + st, SLATE); // choir roof
// La Merveille: the tall three-storey block on the north face, buttressed
box(-14, -10, top - 26, -6, 12, top + 8, (i, j, k) => j % 4 === 0 && k % 10 > 3 && k % 10 < 8 && i === -14 ? DARK : GRANITE);
for (let j = -10; j < 12; j += 4) box(-16, j, top - 26, -14, j + 1, top + 6, GRANITE);
for (let st = 0; st < 3; st++) box(-14 + st, -10, top + 8 + st, -6 - st, 12, top + 9 + st, SLATE);
// crossing tower and the slim spire with the archangel
box(-3, -3, top + 14, 4, 4, top + 32, (i, j, k) => (Math.abs(i) === 3 || i === 3) && k > top + 26 && k < top + 30 ? DARK : GRANITE);
for (let s3 = 0; s3 < 26; s3++) { const w = Math.max(0, 2 - Math.floor(s3 / 9)); box(-w, -w, top + 32 + s3, w + 1, w + 1, top + 33 + s3, SLATE); }
box(0, 0, top + 58, 1, 1, top + 64, GOLD);
set(-1, 0, top + 62, GOLD); set(1, 0, top + 62, GOLD);
// keep only cubes with at least one empty neighbour
const bricks = [];
for (const [k, c] of V) {
  const [i, j, z] = k.split(',').map(Number);
  const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, d]) => z + d >= 0 && !V.has(key(i + a, j + b, z + d)));
  if (open) bricks.push({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [i * 2 + 1, j * 2 + 1, z * 2 + 1], color: c });
}
if (bricks.some(b => b.position.some(v => !Number.isInteger(v)))) throw new Error('off grid');
process.stderr.write(`montstmichel: ${bricks.length} cubes (of ${V.size} voxels), ${(top + 64) * 2} units tall, 290 across, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 8000, bricks }] }));
