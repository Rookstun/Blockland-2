// Ambulocetus, the walking whale (comfycookie, 2026-11-06; soygrl's favourite): a long low four-legged
// proto-whale with a crocodile snout and a thick tail, on a rock. node mapgen/ambulocetus.mjs X Y Z > job.json  (faces +x)
import { makeBuilder } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, COUNT = 1] = process.argv.slice(2).map(Number);
// COUNT > 1 = a stack of them, each rock on the one below's head height (comfycookie), own owner
const OWNER = COUNT > 1
  ? { id: 'c1a0de00-0000-4b0b-9a11-00000000a3b1', name: 'Claude Ambulocetus Stack', display_name: 'Claude Ambulocetus Stack' }
  : { id: 'c1a0de00-0000-4b0b-9a11-00000000a3b0', name: 'Claude Ambulocetus', display_name: 'Claude Ambulocetus' };
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const HIDE = m([110, 95, 80]), BELLY = m([170, 155, 130]), DARK = m([70, 60, 50]), ROCK = m([105, 105, 100]), EYE = m([20, 20, 20]), TOOTH = m([235, 230, 210]);
B.box(-110, -40, 0, 110, 40, 8, ROCK, 'rock');
// legs: short and splayed, big webbed hind feet
for (const [x, w] of [[50, 8], [-50, 12]]) for (const s of [-1, 1]) {
  const y0 = s > 0 ? 14 : -24;
  B.box(x - w, y0 - (s > 0 ? 0 : 6), 8, x + w, y0 + 10 + (s > 0 ? 6 : 0), 12, DARK, 'foot');
  B.box(x - 5, y0, 12, x + 5, y0 + 10, 30, HIDE, 'leg');
}
// body: belly band under a humped back, tapering at both ends
for (const [x0, x1, hy, z0, z1] of [[-60, 70, 18, 30, 34], [-70, 76, 20, 34, 50], [-60, 70, 18, 50, 56], [-40, 50, 14, 56, 60]])
  B.box(x0, -hy, z0, x1, hy, z1, z0 === 30 ? BELLY : HIDE, 'body');
// neck and long head with a crocodile snout, eyes high up
B.box(76, -14, 36, 92, 14, 54, HIDE, 'neck');
B.box(92, -12, 40, 112, 12, 54, HIDE, 'skull');
B.box(98, -12, 54, 108, -6, 58, HIDE, 'brow');
B.box(98, 6, 54, 108, 12, 58, HIDE, 'brow');
B.box(102, -10, 58, 106, -8, 62, EYE, 'eye');
B.box(102, 8, 58, 106, 10, 62, EYE, 'eye');
B.box(112, -8, 44, 150, 8, 50, HIDE, 'upper jaw');
B.box(112, -7, 40, 146, 7, 44, BELLY, 'lower jaw');
for (let x = 116; x < 146; x += 6) for (const y of [-8, 6]) B.box(x, y, 38, x + 2, y + 2, 40, TOOTH, 'tooth');
// tail: thick, tapering to the ground behind
for (const [x0, x1, h, z0, z1] of [[-90, -70, 14, 34, 48], [-112, -90, 10, 28, 42], [-134, -112, 7, 20, 34], [-154, -134, 5, 10, 24], [-170, -154, 3, 8, 14]])
  B.box(x0, -h, z0, x1, h, z1, HIDE, 'tail');
if (B.dropped.length) throw new Error(`ambulocetus: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const one = B.bricks.map(({ label, ...b }) => b);
const bricks = [];
for (let k = 0; k < COUNT; k++) for (const b of one) bricks.push({ ...b, position: [b.position[0], b.position[1], b.position[2] + k * 62] }); // 62 = eye top
process.stderr.write(`ambulocetus: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
