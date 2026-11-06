// "Something gruesome" (dirt, 2026-11-06): a fresh grave, cracked headstone, a green hand clawing out.
// node mapgen/grave.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000d1e5', name: 'Claude Grave', display_name: 'Claude Grave' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, extra) => ({ asset: MB, color, ...extra });
const DIRT = m([92, 64, 40]), DIRT2 = m([70, 48, 30]), STONE = m([140, 140, 145]), MOSS = m([70, 110, 60]), CRACK = m([40, 40, 45]);
const ZOMBIE = m([120, 160, 90]), NAIL = m([60, 60, 40]), SLEEVE = m([60, 50, 70]);
// mound, rounded by stacked shrinking boxes
for (const [z, hx, hy] of [[0, 30, 14], [4, 28, 12], [8, 24, 10], [12, 18, 7]]) B.box(-hx, -hy, z, hx, hy, z + 4, z % 8 ? DIRT2 : DIRT, 'mound');
// headstone at the -x end, a little crooked chunk missing
B.box(-44, -16, 0, -36, 16, 40, STONE, 'headstone');
B.box(-44, -12, 40, -36, 12, 46, STONE, 'headstone top');
B.box(-44, -6, 46, -36, 6, 48, STONE, 'headstone cap');
B.box(-36, -10, 28, -34, 10, 30, CRACK, 'epitaph line');
B.box(-36, -8, 22, -34, 8, 24, CRACK, 'epitaph line');
B.box(-36, 4, 32, -34, 6, 40, CRACK, 'crack');
B.box(-44, -16, 48, -38, -6, 50, MOSS, 'moss');
// hand: sleeve cuff out of the dirt, palm, four fingers and a thumb reaching up
B.box(4, -4, 16, 12, 4, 22, SLEEVE, 'sleeve');
B.box(5, -3, 22, 11, 3, 32, ZOMBIE, 'wrist');
B.box(4, -5, 32, 12, 5, 40, ZOMBIE, 'palm');
for (const [y, h] of [[-4, 12], [-1.5, 16], [1.5, 14], [4, 10]]) B.box(6, Math.round(y) - 1, 40, 10, Math.round(y) + 1, 40 + h, ZOMBIE, 'finger');
B.box(12, -6, 34, 16, -2, 40, ZOMBIE, 'thumb');
B.box(16, -6, 38, 18, -2, 46, ZOMBIE, 'thumb tip');
B.box(10, -5, 50, 12, -3, 52, NAIL, 'nail');
// scattered clods
for (const [x, y] of [[24, 20], [30, -22], [-14, 22], [36, 4]]) B.box(x, y, 0, x + 4, y + 4, 4, DIRT, 'clod');
if (B.dropped.length) throw new Error(`grave: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`grave: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
