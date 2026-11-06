// "Build what you think of the other bot" (comfycookie, 2026-11-06): a gold trophy for !ai, fastest builder on the
// server, with a blue first-place rosette. node mapgen/trophy.mjs X Y Z > job.json   (faces +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000070f7', name: 'Claude Trophy', display_name: 'Claude Trophy' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const GOLD = { asset: MB, color: [230, 180, 50], material: 'BMC_Metallic' }, WOOD = { asset: MB, color: [80, 50, 30] };
const BLUE = { asset: MB, color: [40, 80, 200] }, WHITE = { asset: MB, color: [240, 240, 240] };
const c = (hx, hy, z0, z1, m, l) => B.box(-hx, -hy, z0, hx, hy, z1, m, l);
c(30, 30, 0, 12, WOOD, 'base');
c(24, 24, 12, 20, WOOD, 'base top');
c(14, 14, 20, 24, GOLD, 'foot');
c(4, 4, 24, 44, GOLD, 'stem');
c(10, 10, 44, 48, GOLD, 'knop');
// cup flaring upward
[[14, 48], [18, 54], [20, 60], [22, 66], [22, 72], [24, 78]].forEach(([h, z]) => c(h, h, z, z + 6, GOLD, 'cup'));
c(26, 26, 84, 86, GOLD, 'rim');
// handles
for (const s of [-1, 1]) {
  B.box(-2, s > 0 ? 24 : -36, 70, 2, s > 0 ? 36 : -24, 74, GOLD, 'handle top');
  B.box(-2, s > 0 ? 32 : -36, 54, 2, s > 0 ? 36 : -32, 70, GOLD, 'handle side');
  B.box(-2, s > 0 ? 22 : -32, 54, 2, s > 0 ? 32 : -22, 58, GOLD, 'handle bottom');
}
// rosette on the base front
B.box(30, -8, 2, 32, 8, 18, BLUE, 'rosette');
B.box(32, -4, 6, 34, 4, 14, WHITE, 'rosette centre');
B.box(30, -6, -2, 32, -2, 2, BLUE, 'ribbon');
if (B.dropped.length) throw new Error(`trophy: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`trophy: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
