// A horse of about 6.5 tonnes (Third Gender, 2026-11-06): a big draft horse is ~0.9 t, so 7.2x the mass = 1.93x every
// length (cube root): ~3.1 m at the withers, ~4.6 m long at the 60-unit-player scale (33 units a metre).
// Voxels on the castle.mjs canvas (10 x 10 x 6 units), greedy-merged. node mapgen/bighorse.mjs X Y Z   (head toward +x)
import { canvas } from './castle.mjs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000065a0', name: 'Claude Big Horse', display_name: 'Claude Big Horse' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const c = canvas();
const COAT = [120, 78, 44], DARK = [60, 40, 26], HOOF = [40, 34, 30], WHITE = [230, 226, 216], EYE = [15, 15, 15];
const ell = (ci, cj, ck, ri, rj, rk, col) => { // ellipsoid in voxels (k in 6-unit layers)
  for (let i = Math.floor(ci - ri); i <= ci + ri; i++) for (let j = Math.floor(cj - rj); j <= cj + rj; j++) for (let k = Math.floor(ck - rk); k <= ck + rk; k++)
    if (((i - ci) / ri) ** 2 + ((j - cj) / rj) ** 2 + ((k - ck) / rk) ** 2 <= 1) c.set(i, j, k, col);
};
const legH = 9; // legs up to ~55 units (voxel rows of 6)
// body barrel, chest, rump
ell(0, 0, legH + 6, 8, 3.6, 6.5, COAT);
ell(5, 0, legH + 6, 3.5, 3.4, 5.5, COAT);
ell(-5, 0, legH + 7, 3.8, 3.6, 5.8, COAT);
// legs: four columns with a feathered (white) fetlock and dark hooves
for (const [li, lj] of [[5, -2], [5, 2], [-5.5, -2], [-5.5, 2]]) for (let k = 0; k < legH + 3; k++) {
  const r = k < 2 ? 1.4 : k < 4 ? 1.6 : 1.2;
  for (let i = Math.floor(li - r); i <= li + r; i++) for (let j = Math.floor(lj - r); j <= lj + r; j++)
    if (Math.hypot(i - li, j - lj) <= r) c.set(i, j, k, k < 1 ? HOOF : k < 3 ? WHITE : COAT);
}
// neck rising forward, head angled down, ears, mane, eyes, blaze
for (let s = 0; s <= 10; s++) ell(8 + s * 0.55, 0, legH + 9 + s * 1.3, 2.4 - s * 0.05, 1.9, 2.6, COAT);
ell(15, 0, legH + 21, 3.2, 1.6, 2.6, COAT); // head
ell(17.5, 0, legH + 19.5, 1.8, 1.4, 1.8, COAT); // muzzle
for (const s of [-1, 1]) { c.set(13, s, legH + 25, COAT); c.set(13, s, legH + 26, COAT); c.set(15, s * 2, legH + 22, EYE); }
for (let k = legH + 18; k <= legH + 23; k++) c.set(18, 0, k, WHITE); // blaze down the face
for (let s = 0; s <= 10; s++) { const i = Math.round(7.5 + s * 0.55), k = Math.round(legH + 11 + s * 1.3); c.set(i - 1, 0, k + 2, DARK); c.set(i - 1, 0, k + 3, DARK); } // mane
// tail hanging from the rump
for (let k = 0; k < 9; k++) for (let j = -1; j <= 1; j++) c.set(-9 - Math.floor(k / 4), j, legH + 10 - k, DARK);
const B = makeBuilder();
for (const b of c.bricks()) B.add(b, 'horse');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`bighorse: ${bricks.length} bricks (${B.dropped.length} skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
