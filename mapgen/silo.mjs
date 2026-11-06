// To-scale rocket silo (Third Gender, 2026-11-06), scaled to the 60-unit player (1.8 m -> 33 units a metre):
// a concrete shaft ~26 m deep (860 units, 5.4 m inside), here standing on the plate inside an earth berm since the
// plate cannot be dug; an original white rocket (~19 m) on its pad, catwalk rings, blast doors on top (half open),
// a ground-level door into a side control room with glowing consoles. Voxels on the castle.mjs canvas (10 x 10 x 6).
// node mapgen/silo.mjs X Y Z > job.json
import { canvas } from './castle.mjs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000510e', name: 'Claude Silo', display_name: 'Claude Silo' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const c = canvas();
const CON = [150, 150, 146], CON2 = [128, 128, 124], EARTH = [96, 84, 64], GRASS = [86, 120, 64], STEEL = [80, 84, 92];
const WHITE = [236, 236, 232], RED = [190, 50, 40], BLACK = [30, 30, 34], GLOWG = [80, 230, 120];
const RIN = 8, RW = 2, HK = 143; // shaft inner radius (vox), wall, height (vz = 6 units)
const disc = (R, fn) => { for (let i = -R - 1; i <= R + 1; i++) for (let j = -R - 1; j <= R + 1; j++) { const d = Math.hypot(i + 0.5, j + 0.5); fn(i, j, d); } };
// earth berm: stepped rings around the shaft, grass on top
disc(RIN + RW + 18, (i, j, d) => { const top = Math.round(HK - (d - RIN - RW) * 5); if (d > RIN + RW) for (let k = 0; k < Math.min(top, HK); k++) c.set(i, j, k, k >= top - 1 || k === HK - 1 ? GRASS : EARTH); });
// shaft wall (concrete, banded every 10 m)
disc(RIN + RW, (i, j, d) => { if (d > RIN && d <= RIN + RW) for (let k = 0; k < HK; k++) c.set(i, j, k, Math.floor(k / 55) % 2 ? CON2 : CON); });
// floor, launch pad ring, catwalk rings (an inner ledge, one voxel wide) every ~6 m
disc(RIN, (i, j) => { c.set(i, j, 0, CON2); c.set(i, j, 1, CON2); });
for (let k = 30; k < HK - 10; k += 33) disc(RIN, (i, j, d) => { if (d > RIN - 1.2) c.set(i, j, k, STEEL); });
// rocket: cylinder r 3.5 vox (35 units ~ 2.1 m across... x2 = 4.2 m) from the pad up ~19 m (105 vz), stripes, cone, fins
const RK = 2, RT = RK + 105;
disc(3, (i, j, d) => { if (d <= 3.6) for (let k = RK; k < RT - 12; k++) c.set(i, j, k, (k - RK) % 30 < 3 ? RED : k > RT - 30 && k < RT - 26 ? BLACK : WHITE); });
for (let k = RT - 12; k < RT; k++) { const r = 3.6 * (RT - k) / 12; disc(3, (i, j, d) => { if (d <= r + 0.3) c.set(i, j, k, k > RT - 3 ? RED : WHITE); }); }
for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let s = 4; s <= 6; s++) for (let k = RK; k < RK + 14 - (s - 4) * 4; k++) c.set(di * s, dj * s, k, RED);
// blast doors on the top: two slabs, the east one slid aside (half open)
for (let i = -RIN - RW; i <= RIN + RW; i++) for (let j = -RIN - RW; j <= RIN + RW; j++) {
  if (i < 0) { c.set(i, j, HK, STEEL); c.set(i, j, HK + 1, STEEL); }
  else { c.set(i + RIN + RW + 2, j, HK, STEEL); c.set(i + RIN + RW + 2, j, HK + 1, STEEL); }
}
// ground door through berm + wall (south, -y), a corridor, and the control room beside it
for (let j = -(RIN + RW + 20); j <= -RIN; j++) for (let i = -2; i <= 1; i++) for (let k = 2; k < 13; k++) c.del(i, j, k);
for (let j = -(RIN + RW + 20); j <= -RIN; j++) for (let i = -2; i <= 1; i++) c.set(i, j, 1, CON2);
for (let i = 3; i <= 12; i++) for (let j = -26; j <= -18; j++) for (let k = 1; k < 15; k++) {
  const edge = i === 3 || i === 12 || j === -26 || j === -18 || k === 1 || k === 14;
  if (edge) c.set(i, j, k, k === 1 ? CON2 : CON); else c.del(i, j, k);
}
for (let j = -23; j <= -21; j++) for (let k = 2; k < 12; k++) c.del(3, j, k); // control room door off the corridor
for (let i = 5; i <= 10; i += 1) { c.set(i, -25, 2, STEEL); c.set(i, -25, 3, STEEL); c.set(i, -25, 4, (i % 2) ? GLOWG : [220, 180, 60], { material: 'BMC_Glow' }); } // console row
const B = makeBuilder();
for (const b of c.bricks()) B.add(b, 'silo');
if (B.dropped.length) throw new Error(`silo: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`silo: ${bricks.length} bricks, shaft ${HK * 6} units deep, rocket ${(RT - RK) * 6} tall, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 6000, bricks }] }));
