// Volcano (vix asked "for claude only: build a volcano", 2026-11-06).
// node mapgen/volcano.mjs X Y Z > job.json   (X Y Z = base centre, world units; Z = ground)
// 1-stud columns on a cone with a crater; every column steps down to its lowest neighbour
// with a micro wedge rising toward its highest one (smooth slope, no stair steps).
// The skirt runs 40 below Z: columns that hit hillside get rejected by the game, which sinks it in.
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000b01c', name: 'Claude Volcano', display_name: 'Claude Volcano' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const R = 170, RC = 45, H = 220, SKIRT = -40; // radius, crater radius, rim height (units)
const B = makeBuilder();
const rand = rng(7);
const snap = v => Math.round(v / 4) * 4;
const N = R / 10;
const height = (cx, cy) => {
  const r = Math.hypot(cx, cy);
  if (r > R) return null;
  if (r < RC - 15) return H - 50; // lava lake
  if (r < RC) return snap(H - 50 + (50 * (r - (RC - 15))) / 15); // inner crater wall
  return snap(H * Math.pow(1 - (r - RC) / (R - RC), 1.25) + 4);
};
const hs = new Map();
for (let i = -N; i < N; i++) for (let j = -N; j < N; j++) { const h = height(i * 10 + 5, j * 10 + 5); if (h != null && h > 0) hs.set(`${i},${j}`, h); }
const hAt = (i, j) => hs.get(`${i},${j}`) ?? 0;
// three lava streaks down the outside
const streaks = [0.6, 2.7, 4.4];
const onStreak = (cx, cy) => {
  const r = Math.hypot(cx, cy), a = Math.atan2(cy, cx);
  return r > RC && r < R * 0.85 && streaks.some(s => Math.abs(((a - s + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * r < 9 + (r - RC) * 0.05);
};
const rock = () => { const v = 38 + Math.floor(rand() * 18); return { color: [v, v - 4, v - 6] }; };
const ash = { color: [92, 86, 80] };
const LAVA = { color: [255, 96, 16], material: 'BMC_Glow', material_intensity: 4 };
for (const [k, h] of hs) {
  const [i, j] = k.split(',').map(Number);
  const x0 = i * 10, y0 = j * 10, cx = x0 + 5, cy = y0 + 5, r = Math.hypot(cx, cy);
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [a, b, hAt(i + a, j + b)]);
  const lo = Math.min(...nb.map(n => n[2]));
  const up = nb.reduce((m, n) => (n[2] > m[2] ? n : m));
  const lake = r < RC - 15;
  const top = lake || onStreak(cx, cy) ? LAVA : h > H * 0.75 ? ash : rock();
  const step = h - lo;
  if (lake) {
    B.box(x0, y0, SKIRT, x0 + 10, y0 + 10, h - 4, rock(), 'crater floor');
    B.box(x0, y0, h - 4, x0 + 10, y0 + 10, h, LAVA, 'lava');
  } else if (step >= 4 && step <= 72 && up[2] > h - 1) {
    B.box(x0, y0, SKIRT, x0 + 10, y0 + 10, Math.max(lo, SKIRT + 4), rock(), 'core');
    B.wedge(x0, y0, Math.max(lo, SKIRT + 4), x0 + 10, y0 + 10, h, up[0], up[1], top, 'slope');
  } else {
    B.box(x0, y0, SKIRT, x0 + 10, y0 + 10, h - 4, rock(), 'core');
    B.box(x0, y0, h - 4, x0 + 10, y0 + 10, h, top, 'top');
  }
}
B.asset('B_Flame', 0, 0, H - 50 + 10, LAVA, 'flame');
if (B.dropped.length) throw new Error(`volcano: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`volcano: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
