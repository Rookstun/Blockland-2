// Claude self-portrait (dirt asked "for claude only: build a self-portrait", 2026-11-06):
// an upright orange starburst on a stone pedestal. node mapgen/selfportrait.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000a171', name: 'Claude Portrait', display_name: 'Claude Portrait' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick', P = 2, RAD = 150, CZ = 70 + RAD; // pixel, burst radius, burst centre height
const ORANGE = { asset: MB, color: [217, 119, 87] };
const STONE = { asset: MB, color: [120, 116, 110] };
// plinth: stepped base, column, cap, a brass plaque on the front
const LIGHT = { asset: MB, color: [240, 150, 110] }, DEEP = { asset: MB, color: [190, 95, 65] }, BRASS = { asset: MB, color: [200, 160, 60], material: 'BMC_Metallic' };
B.box(-60, -30, 0, 60, 30, 8, STONE, 'base');
B.box(-50, -24, 8, 50, 24, 14, STONE, 'step');
B.box(-36, -18, 14, 36, 18, 58, { asset: MB, color: [150, 146, 140] }, 'column');
B.box(-44, -24, 58, 44, 24, 64, STONE, 'cap');
B.box(-14, -20, 30, 14, -18, 42, BRASS, 'plaque');
B.box(-10, -8, 64, 10, 8, 70, STONE, 'post');
// 11 rays of uneven length, tapering, plus a round core; rasterised in the x-z plane, rows merged into runs.
// Layers: deep back slab, main body, then a lighter raised ridge down the middle of each ray and on the core.
const rays = Array.from({ length: 11 }, (_, k) => ({ a: (k / 11) * 2 * Math.PI + 0.2, len: RAD * (0.74 + 0.26 * ((k * 7) % 5) / 4) }));
const shape = scale => (x, z) => {
  if (Math.hypot(x, z) < 26 * scale) return true;
  return rays.some(({ a, len }) => {
    const along = x * Math.cos(a) + z * Math.sin(a), across = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
    return along > 0 && along < len * (scale < 1 ? 0.9 : 1) && across < (14 * (1 - along / len) + 2) * scale;
  });
};
const N = RAD / P;
const layer = (inside, y0, y1, mat, label) => {
  for (let j = -N; j < N; j++) {
    let run = null;
    for (let i = -N; i <= N; i++) {
      const on = i < N && inside(i * P + P / 2, j * P + P / 2);
      if (on && run === null) run = i;
      if (!on && run !== null) {
        const z0 = CZ + j * P;
        if (z0 >= 70) B.box(run * P, y0, z0, i * P, y1, z0 + P, mat, label);
        run = null;
      }
    }
  }
};
layer(shape(1), 2, 6, DEEP, 'back');
layer(shape(1), -4, 2, ORANGE, 'body');
layer(shape(0.45), -6, -4, LIGHT, 'ridge');
if (B.dropped.length) throw new Error(`portrait: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`portrait: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
