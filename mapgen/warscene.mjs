// Heroic battle diorama (Third Gender, 2026-11-06: "lots of horses and bears and swords"): an original scene, no real
// armies, flags or emblems. A grassy hill with a giant hero sword planted on top; horses charging across the field from
// one side, bears rearing and lumbering from the other; swords stuck in the ground everywhere; plain-coloured banners.
// Voxels on the castle.mjs canvas (10 x 10 x 6 units), greedy-merged. node mapgen/warscene.mjs X Y Z
import { canvas } from './castle.mjs';
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000ba77', name: 'Claude War Scene', display_name: 'Claude War Scene' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const c = canvas();
const rand = rng(1415);
const GRASS = [86, 124, 62], GRASS2 = [74, 110, 54], DIRT = [110, 88, 62], STEEL = [190, 194, 202], GOLD = [210, 170, 60], GRIP = [70, 44, 30];
const ell = (ci, cj, ck, ri, rj, rk, col) => {
  for (let i = Math.floor(ci - ri); i <= ci + ri; i++) for (let j = Math.floor(cj - rj); j <= cj + rj; j++) for (let k = Math.max(0, Math.floor(ck - rk)); k <= ck + rk; k++)
    if (((i - ci) / ri) ** 2 + ((j - cj) / rj) ** 2 + ((k - ck) / rk) ** 2 <= 1) c.set(i, j, k, col);
};
// ---- ground: a wide field with a low round hill in the middle
const R = 60, HILL = 14;
const ground = (i, j) => { const d = Math.hypot(i, j); return d < 22 ? Math.round(HILL * Math.cos((d / 22) * Math.PI / 2)) + 1 : 1; };
for (let i = -R; i <= R; i++) for (let j = -40; j <= 40; j++) {
  const h = ground(i, j);
  for (let k = 0; k < h; k++) c.set(i, j, k, k === h - 1 ? ((i + j) & 3 ? GRASS : GRASS2) : DIRT);
}
// ---- a sword: blade point-down into the ground (or lying), crossguard, grip, pommel; s = size
const sword = (i, j, s = 1, tilt = 0) => {
  const g = ground(i, j), blade = Math.round(9 * s), grip = Math.max(2, Math.round(3 * s)), w = s >= 2 ? 1 : 0;
  for (let k = 0; k < blade; k++) for (let d = -w; d <= w; d++) c.set(i + Math.round(tilt * k), j + d, g + k, STEEL);
  const top = g + blade, ti = i + Math.round(tilt * blade);
  for (let d = -Math.round(2 * s); d <= Math.round(2 * s); d++) c.set(ti, j + d, top, GOLD); // crossguard
  for (let k = 1; k <= grip; k++) c.set(ti, j, top + k, GRIP);
  c.set(ti, j, top + grip + 1, GOLD); // pommel
};
// hero sword on the hilltop, swords scattered across the field
sword(0, 0, 3);
for (let n = 0; n < 22; n++) sword(Math.round((rand() - 0.5) * 2 * (R - 4)), Math.round((rand() - 0.5) * 70), 0.7 + rand() * 0.4, (rand() - 0.5) * 0.3);
// ---- horses charging from the west (head toward +x), in two loose ranks
const COATS = [[120, 78, 44], [60, 40, 28], [200, 196, 186], [150, 110, 70], [30, 28, 26]];
const horse = (hi, hj, coat) => {
  const g = ground(hi, hj), L = 5;
  ell(hi, hj, g + L + 3, 4, 1.8, 3, coat); // barrel
  for (const [a, b] of [[2.5, -1], [2.5, 1], [-2.5, -1], [-2.5, 1]]) for (let k = 0; k < L + 1; k++) c.set(Math.round(hi + a + (k < 2 ? (a > 0 ? 1 : -1) : 0)), hj + b, g + k, k === 0 ? [40, 34, 30] : coat); // legs mid-gallop
  for (let s = 0; s <= 5; s++) ell(hi + 4 + s * 0.5, hj, g + L + 5 + s * 1.2, 1.3, 1, 1.4, coat); // neck
  ell(hi + 7.5, hj, g + L + 11, 1.8, 0.9, 1.4, coat); // head
  for (let k = 0; k < 4; k++) c.set(hi - 4 - Math.floor(k / 2), hj, g + L + 5 - k, [40, 30, 24]); // tail streaming back
};
for (let n = 0; n < 11; n++) horse(-50 + (n % 2) * 9 + Math.round(rand() * 4), -30 + n * 6, COATS[n % COATS.length]);
// ---- bears from the east (facing -x): most on all fours, three rearing up
const BEARS = [[92, 64, 40], [60, 44, 32], [36, 30, 28]];
const bear = (bi, bj, coat, rear) => {
  const g = ground(bi, bj);
  if (rear) {
    ell(bi, bj, g + 10, 2.6, 2.4, 6, coat); // upright body
    ell(bi - 0.5, bj, g + 17, 1.8, 1.8, 1.8, coat); // head
    c.set(bi - 2, bj, g + 16, [30, 24, 20]); // snout
    for (const s of [-1, 1]) { c.set(bi, bj + 2 * s, g + 19, coat); for (let k = 0; k < 4; k++) c.set(bi - 2 - Math.floor(k / 2), bj + 2 * s, g + 13 + k, coat); } // ears, raised paws
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) c.set(bi, bj + s, g + k, coat); // legs
  } else {
    ell(bi, bj, g + 5, 4.5, 2.6, 3.4, coat); // body
    ell(bi - 4.5, bj, g + 6, 1.9, 1.7, 1.7, coat); // head
    c.set(bi - 6, bj, g + 5, [30, 24, 20]);
    for (const s of [-1, 1]) c.set(bi - 4, bj + s, g + 8, coat); // ears
    for (const [a, b] of [[2.5, -1.5], [2.5, 1.5], [-2.5, -1.5], [-2.5, 1.5]]) for (let k = 0; k < 3; k++) c.set(Math.round(bi + a), Math.round(bj + b), g + k, coat);
  }
};
for (let n = 0; n < 9; n++) bear(40 + (n % 3) * 5 + Math.round(rand() * 3), -28 + n * 7, BEARS[n % BEARS.length], n % 3 === 1);
// ---- banners: plain colours on poles on both sides and on the hill
for (const [bi, bj, col] of [[-56, -36, [180, 40, 40]], [-56, 36, [180, 40, 40]], [56, -36, [40, 70, 160]], [56, 36, [40, 70, 160]], [-6, 6, [220, 200, 60]], [6, -6, [220, 200, 60]]]) {
  const g = ground(bi, bj);
  for (let k = 0; k < 22; k++) c.set(bi, bj, g + k, [90, 70, 50]);
  for (let k = 0; k < 7; k++) for (let d = 1; d <= 4; d++) c.set(bi, bj + d, g + 21 - k, col);
}
const B = makeBuilder({ cell: 200 });
for (const b of c.bricks()) B.add(b, 'scene');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`warscene: ${bricks.length} bricks (${B.dropped.length} skipped), 11 horses, 9 bears, 23 swords, 6 banners, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 6000, bricks }] }));
