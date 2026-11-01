// A sushi platter on a wooden tray (a player's wish, 2026-11-01): nigiri, maki, wasabi, ginger, chopsticks.
//   node mapgen/sushi.mjs X Y Z job.json     (tray centre; ground z)
import fs from 'fs';
import { makeBuilder } from './builder.mjs';
const [X, Y, Z] = process.argv.slice(2, 5).map(Number);
const OWNER = { id: '5a5a1000-0000-4b0b-9a11-00000000a5a1', name: 'Sushi', display_name: 'Sushi' };
const B = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, color, label) => B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color }, label);
const RICE = [246, 246, 240], NORI = [22, 28, 24];
box(-60, -30, 0, 60, 30, 4, [150, 100, 60], 'tray');
box(-56, -26, 4, 56, -24, 6, [120, 78, 46], 'tray rim');
// nigiri row: rice mound + topping draped over it
[[-48, [250, 120, 90]], [-24, [190, 40, 50]], [0, [250, 190, 60]], [24, [250, 120, 90]]].forEach(([x, c], i) => {
  box(x - 8, -2, 4, x + 8, 8, 12, RICE, 'rice');
  box(x - 9, -3, 12, x + 9, 9, 16, c, 'topping');
  if (i === 2) box(x - 2, -3, 16, x + 2, 9, 18, NORI, 'nori band');
});
// maki: nori cylinders (boxes) with a rice top and a coloured centre
[[-44, [90, 170, 70]], [-20, [250, 120, 90]], [4, [190, 40, 50]], [28, [250, 190, 60]]].forEach(([x, c]) => {
  box(x - 8, -24, 4, x + 8, -10, 14, NORI, 'maki');
  box(x - 6, -22, 14, x + 6, -12, 16, RICE, 'maki rice');
  box(x - 2, -18, 16, x + 2, -16, 18, c, 'maki filling');
});
box(40, -22, 4, 54, -10, 10, [120, 180, 60], 'wasabi');
box(40, 12, 4, 54, 24, 8, [250, 170, 190], 'ginger');
box(-30, 18, 4, 30, 20, 6, [200, 150, 90], 'chopstick');
box(-30, 22, 4, 30, 24, 6, [200, 150, 90], 'chopstick');
console.error(`${B.bricks.length} bricks, dropped ${B.dropped.length}`, B.dropped.slice(0, 4).join(' / '));
const bricks = B.bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
fs.writeFileSync(process.argv[5], JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 3000, bricks }] }));
