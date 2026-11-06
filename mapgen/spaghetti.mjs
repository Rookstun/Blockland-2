// Spaghetti, Claude's take on the !ai "spaghetti" build (comfycookie, 2026-11-06): a white plate heaped with
// wandering noodles, red sauce, three meatballs, a fork planted in the top. node mapgen/spaghetti.mjs X Y Z > job.json
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000059a6', name: 'Claude Spaghetti', display_name: 'Claude Spaghetti' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const rand = rng(42);
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const PLATE = m([245, 245, 240]), RIM = m([200, 60, 50]), NOODLE = [m([240, 210, 120]), m([230, 195, 100]), m([250, 220, 140])];
const SAUCE = m([180, 35, 25]), BALL = m([110, 60, 40]), FORK = m([200, 200, 205], { material: 'BMC_Metallic' }), BASIL = m([60, 140, 50]);
const c = (cx, cy, hx, hy, z0, z1, mat, l) => B.box(cx - hx, cy - hy, z0, cx + hx, cy + hy, z1, mat, l);
// plate: rim ring and dish
c(0, 0, 30, 30, 0, 2, PLATE, 'plate base');
for (const [x0, y0, x1, y1] of [[-34, -34, 34, -30], [-34, 30, 34, 34], [-34, -30, -30, 30], [30, -30, 34, 30]]) B.box(x0, y0, 0, x1, y1, 4, RIM, 'rim');
// noodles: random-walk strands in a dome, 2-unit thick, each segment its own micro box (overlaps skip)
for (let s = 0; s < 40; s++) {
  let x = Math.round((rand() - 0.5) * 36), y = Math.round((rand() - 0.5) * 36);
  for (let k = 0; k < 14; k++) {
    const r = Math.hypot(x, y), top = Math.max(4, Math.round((20 - r * 0.6) / 2) * 2);
    const z = 2 + 2 * Math.floor(rand() * (top / 2));
    const horiz = rand() < 0.5, len = 4 + 2 * Math.floor(rand() * 3);
    if (horiz) B.box(x, y, z, x + len, y + 2, z + 2, NOODLE[s % 3], 'noodle');
    else B.box(x, y, z, x + 2, y + len, z + 2, NOODLE[s % 3], 'noodle');
    x = Math.max(-28, Math.min(24, x + (horiz ? len : 0) - 2 * Math.round(rand() * 2)));
    y = Math.max(-28, Math.min(24, y + (horiz ? 0 : len) - 2 * Math.round(rand() * 2)));
  }
}
// sauce cap and meatballs on top
c(0, 0, 10, 10, 22, 24, SAUCE, 'sauce');
for (const [x, y] of [[-6, -4], [6, -2], [0, 7]]) { c(x, y, 3, 3, 24, 30, BALL, 'meatball'); c(x, y, 2, 2, 30, 32, BALL, 'meatball top'); }
c(-2, 4, 1, 2, 30, 32, BASIL, 'basil');
// fork planted at an angle-ish: handle up, tines in the pile
c(10, 8, 1, 1, 24, 56, FORK, 'fork handle');
for (const dy of [-2, 0, 2]) c(10, 8 + dy, 1, 1, 18, 24, FORK, 'tine');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`spaghetti: ${bricks.length} bricks (${B.dropped.length} overlaps skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
