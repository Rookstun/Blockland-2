// A really tiny house for a really tiny person (FlavouredGames 2026-11-08). Sized for a player at the cupcake table's
// smallest scale (0.5 = 30 units tall): door 18 x 34, ceiling 38, table top 14, bed, chair, a lamp, a window box, a
// chimney. Door faces +y. node mapgen/tinyhouse.mjs X Y Z > job.json   (Z = ground)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000710e', name: 'Claude Tiny House', display_name: 'Claude Tiny House' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 100 });
const m = (color, x) => ({ asset: 'PB_DefaultMicroBrick', color, ...x });
const WALL = m([238, 220, 190]), TRIM = m([120, 80, 50]), ROOF = m([170, 70, 60]), ROOF2 = m([150, 60, 52]), FLOOR = m([150, 110, 74]);
const GLASS = m([160, 200, 220], { material: 'BMC_Glass' }), GLOW = m([255, 210, 140], { material: 'BMC_Glow', material_intensity: 2 });
const box = (x0, y0, z0, x1, y1, z1, mt, l = '') => B.box(x0, y0, z0, x1, y1, z1, mt, l);
const W = 34, D = 26, H = 40; // half width (x), half depth (y), wall top
box(-W - 2, -D - 2, 0, W + 2, D + 2, 2, TRIM, 'base');
box(-W, -D, 2, W, D, 4, FLOOR, 'floor');
const DOOR = [-8, 10, 4, 38], WIN = [[-28, -14, 16, 30], [16, 28, 16, 30]];
// walls with holes (split into hole-free slabs)
function wall(axis, t0, t1, a0, a1, holes) {
  const cuts = [...new Set([a0, a1, ...holes.flatMap(h => [h[0], h[1]])])].sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], hs = holes.filter(h => h[0] <= a && h[1] >= b);
    let z = 4;
    for (const h of [...hs, [0, 0, H - 2, H - 2]]) { if (h[2] > z) axis === 'x' ? box(a, t0, z, b, t1, h[2], WALL, 'wall') : box(t0, a, z, t1, b, h[2], WALL, 'wall'); z = Math.max(z, h[3]); }
  }
}
wall('x', D - 2, D, -W, W, [DOOR, ...WIN]);
wall('x', -D, -D + 2, -W, W, [[-6, 6, 16, 30]]);
wall('y', -W, -W + 2, -D + 2, D - 2, []);
wall('y', W - 2, W, -D + 2, D - 2, [[-6, 6, 16, 30]]);
for (const [a, b, z0, z1] of WIN) { box(a, D - 2, z0, b, D, z1, GLASS, 'glass'); box(a - 2, D, z0 - 2, b + 2, D + 4, z0, TRIM, 'window box'); for (let x = a; x < b; x += 4) box(x, D, z0, x + 2, D + 2, z0 + 2, m(x % 8 ? [230, 80, 120] : [250, 210, 60]), 'flower'); }
box(-6, -D, 16, 6, -D + 2, 30, GLASS, 'back glass'); box(W - 2, -6, 16, W, 6, 30, GLASS, 'side glass');
box(-10, D, 38, 12, D + 2, 40, TRIM, 'lintel'); box(10, D - 14, 4, 12, D - 2, 36, TRIM, 'open door');
box(-10, D + 2, 0, 12, D + 8, 2, TRIM, 'step');
// gable roof along x
for (let i = 0; i < 14; i++) { const o = D + 6 - 2 * i; if (o <= 0) break; box(-W - 4, -o, H + 2 * i, W + 4, o, H + 2 * i + 2, i % 2 ? ROOF : ROOF2, 'roof'); }
box(-W, -D, H - 2, W, D, H, TRIM, 'ceiling'); // closes the top under the roof
box(W + 4, -6, 0, W + 10, 6, H + 30, m([140, 90, 80]), "chimney"); // against the gable, outside the roof overhang
// inside, tiny-person sized
box(-24, -16, 4, -6, -6, 14, TRIM, 'table base'); box(-26, -18, 14, -4, -4, 16, m([170, 120, 80]), 'table top');
box(-14, -2, 4, -8, 4, 10, TRIM, 'stool');
box(14, -22, 4, 30, -6, 10, TRIM, 'bed'); box(16, -22, 10, 30, -10, 12, m([90, 120, 200]), 'blanket'); box(16, -10, 10, 22, -6, 14, m([245, 245, 240]), 'pillow');
box(-30, 10, 4, -26, 14, 22, TRIM, 'lamp post'); box(-31, 9, 22, -25, 15, 26, GLOW, 'lamp');
box(-22, -12, 16, -20, -10, 20, GLOW, 'candle');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`tinyhouse: ${bricks.length} bricks (${B.dropped.length} skipped: ${B.dropped.map(d => d.label ?? JSON.stringify(d).slice(0, 60)).join(' | ')}) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 3000, bricks }] }));
