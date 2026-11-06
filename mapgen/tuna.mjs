// Massive bluefin tuna you can walk through (Third Gender, 2026-11-06: "build a massive Bluefin Tuna and make it so you
// can walk through its digestive system"). Voxels on the castle.mjs canvas (10 x 10 x 6 units), greedy-merged.
// Body: a fusiform solid ~85 studs long (dark blue back, silver belly, fins, yellow finlets, crescent tail); a tunnel is
// carved through it at one floor height: open MOUTH -> esophagus -> big STOMACH chamber -> zigzag INTESTINE -> out a
// vent on the flank near the tail. Tunnel walls are lined pink/red; 3 voxels wide (30 units), 13 high (78 units).
// node mapgen/tuna.mjs X Y Z > job.json   (head toward +x)
import { canvas, VX, VZ } from './castle.mjs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000707a', name: 'Claude Bluefin', display_name: 'Claude Bluefin' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const c = canvas();
const L = 84, HY = 10, HZ = 26, FLOOR = 4, TW = 1, TH = 13; // length (voxels), half width, half height (vz), tunnel floor k
const prof = i => { const t = i / (L - 1); return Math.pow(Math.sin(Math.PI * Math.min(Math.max((t - 0.04) / 0.96, 0), 1)), 0.62); }; // 0 at the tail, fat middle, round snout
const BACK = [28, 44, 86], SIDE = [70, 96, 130], BELLY = [196, 202, 210], FIN = [36, 52, 92], GOLD = [230, 190, 60];
const kc = HZ + 1; // body centre height (voxels) so the belly sits on the ground
// ---- solid body ----
for (let i = 0; i < L; i++) {
  const p = prof(i), hy = HY * p, hz = HZ * p;
  if (hy < 0.6) continue;
  for (let j = -Math.ceil(hy); j <= Math.ceil(hy); j++) for (let k = Math.floor(kc - hz); k <= Math.ceil(kc + hz); k++) {
    const e = (j / hy) ** 2 + ((k - kc) / hz) ** 2;
    if (e > 1) continue;
    const up = (k - kc) / hz;
    c.set(i, j, k, up > 0.25 ? BACK : up > -0.2 ? SIDE : BELLY);
  }
}
// eye: a dark disc with a gold ring on each side near the head
for (const s of [-1, 1]) for (let di = -2; di <= 2; di++) for (let dk = -3; dk <= 3; dk++) {
  const r = Math.hypot(di, dk / 1.6), i = L - 9 + di, k = kc + 6 + dk;
  if (r > 2.2) continue;
  let j = 0; while (c.has(i, s * (j + 1), k)) j++;
  c.set(i, s * j, k, r < 1.2 ? [15, 15, 20] : GOLD);
}
// ---- fins (thin, 1 voxel) ----
const fin = (pts, j) => pts.forEach(([i, k]) => c.set(i, j, k, FIN));
const tri = (i0, k0, len, h, dir, j = 0) => { const out = []; for (let a = 0; a < len; a++) for (let b = 0; b < Math.round(h * (1 - a / len)); b++) out.push([i0 - a, k0 + dir * b]); fin(out, j); };
tri(Math.round(L * 0.62), kc + HZ - 2, 10, 14, 1); // first dorsal
tri(Math.round(L * 0.42), kc + Math.round(HZ * prof(Math.round(L * 0.42))) - 1, 8, 10, 1); // second dorsal
tri(Math.round(L * 0.42), kc - Math.round(HZ * prof(Math.round(L * 0.42))) + 1, 8, 10, -1); // anal fin
for (const s of [-1, 1]) for (let a = 0; a < 14; a++) for (let b = 0; b < 2; b++) c.set(Math.round(L * 0.66) - a, s * (HY + 1 + Math.floor(a / 4)), kc - 2 - b - Math.floor(a / 3), FIN); // pectoral fins, swept back
// finlets: little gold flags along the back and belly toward the tail
for (let n = 0; n < 7; n++) { const i = Math.round(L * 0.3) - n * 3; const hz = Math.round(HZ * prof(i)); for (const d of [1, -1]) for (let b = 1; b <= 3; b++) c.set(i, 0, kc + d * (hz + b), GOLD); }
// crescent tail: two swept lobes from the narrow stalk
for (let a = 0; a < 22; a++) {
  const w = Math.round(3 * Math.sin(Math.PI * a / 22)) + 1;
  for (let t = 0; t < w; t++) for (const d of [1, -1]) c.set(-1 - Math.floor(a / 3) - t, 0, kc + d * (2 + a), FIN);
}
// ---- digestive tunnel, carved at one floor height ----
const hole = (i, j) => { for (let k = FLOOR; k < FLOOR + TH; k++) c.del(i, j, k); };
const corridor = (i, j0, j1) => { for (let j = Math.min(j0, j1) - TW; j <= Math.max(j0, j1) + TW; j++) hole(i, j); };
// mouth: open the snout from the floor up and run the esophagus back
for (let i = L - 1; i >= L - 20; i--) corridor(i, 0, 0);
for (let i = L + 2; i >= L - 6; i--) for (let j = -3; j <= 3; j++) for (let k = FLOOR; k < FLOOR + TH + 2; k++) c.del(i, j, k); // gaping mouth
// stomach: a tall rounded chamber
const SI = L - 30;
for (let i = SI - 9; i <= SI + 9; i++) for (let j = -7; j <= 7; j++) for (let k = FLOOR; k < FLOOR + 30; k++)
  if (((i - SI) / 9.5) ** 2 + (j / 7.5) ** 2 + ((k - FLOOR) / 30) ** 2 <= 1) c.del(i, j, k);
// intestine: zigzag across the body from the back of the stomach toward the tail
let i = SI - 10, j = 0;
const zig = [];
for (let n = 0; i > 18; n++) {
  const side = n % 2 ? -5 : 5;
  corridor(i, j, side); zig.push([i, j, side]);
  for (let s = 0; s < 4 && i > 18; s++) { i--; corridor(i, side, side); }
  j = side;
}
// vent: from the end of the intestine straight out through the +y flank
for (let jj = j; jj <= HY + 2; jj++) for (let di = -TW; di <= TW; di++) hole(i + di, jj);
// line every cavity wall voxel: pink in the gut, deep red in the stomach
const lining = [[220, 120, 130], [190, 70, 80], [170, 50, 60]];
const all = [];
for (let ii = -10; ii < L + 4; ii++) for (let jj = -HY - 4; jj <= HY + 4; jj++) for (let k = 0; k < 2 * HZ + 30; k++) if (c.has(ii, jj, k)) all.push([ii, jj, k]);
for (const [ii, jj, k] of all) {
  if (k < FLOOR - 1 || k > FLOOR + 31) continue;
  const air = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, d]) => !c.has(ii + a, jj + b, k + d) && Math.abs(jj + b) < HY * prof(Math.max(ii + a, 0)) - 0.5 && k + d >= FLOOR && k + d < FLOOR + 30);
  if (!air) continue;
  const inStomach = Math.abs(ii - SI) <= 10;
  c.set(ii, jj, k, inStomach ? lining[2] : lining[(ii + jj + k) & 1]);
}
const raw = c.bricks();
const B = makeBuilder();
for (const b of raw) B.add(b, 'tuna');
if (B.dropped.length) throw new Error(`tuna: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`tuna: ${bricks.length} bricks, ${L * VX} units long, ${(2 * HZ + 2) * VZ} tall; mouth at +x, vent on the +y flank at i ${i}; ${zig.length} intestine turns, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 6000, bricks }] }));
