// "Something ethical" (comfycookie, 2026-11-06): a little free library on a post: take a book, leave a book.
// node mapgen/freelibrary.mjs X Y Z > job.json   (door faces +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000011b0', name: 'Claude Library', display_name: 'Claude Library' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const WOOD = m([150, 100, 60]), DARK = m([100, 65, 40]), RED = m([180, 50, 45]), GLASS = m([170, 210, 230], { material: 'BMC_Glass' });
B.box(-12, -12, 0, 12, 12, 4, m([110, 110, 110]), 'footing');
B.box(-4, -4, 4, 4, 4, 50, DARK, 'post');
B.box(-16, -20, 50, 16, 20, 54, WOOD, 'floor');
B.box(-16, -20, 54, -12, 20, 80, WOOD, 'back');
for (const y of [-20, 16]) B.box(-12, y, 54, 12, y + 4, 80, WOOD, 'side');
B.box(12, -16, 54, 14, 16, 80, GLASS, 'glass door');
B.box(14, 10, 64, 16, 12, 70, m([200, 170, 60], { material: 'BMC_Metallic' }), 'handle');
B.box(-12, -16, 66, 12, 16, 68, WOOD, 'shelf');
// books: upright spines on both shelves
const cols = [[200, 60, 60], [60, 120, 200], [230, 200, 80], [80, 160, 90], [150, 80, 170], [240, 140, 60], [60, 60, 70]];
let y = -16;
for (let k = 0; y < 14; k++) { const w = 2 + 2 * (k % 2); B.box(-8, y, 54, 6, y + w, 54 + 8 + 2 * (k % 3), m(cols[k % cols.length]), 'book'); y += w; }
y = -16;
for (let k = 3; y < 14; k++) { const w = 2 + 2 * (k % 2); B.box(-8, y, 68, 6, y + w, 68 + 6 + 2 * (k % 3), m(cols[k % cols.length]), 'book'); y += w; }
// gable roof from two micro wedges, rising toward the ridge
B.box(-18, -22, 80, 18, 22, 82, RED, 'eave');
B.wedge(-18, -22, 82, 18, 0, 92, 0, 1, { color: [180, 50, 45] }, 'roof');
B.wedge(-18, 0, 82, 18, 22, 92, 0, -1, { color: [180, 50, 45] }, 'roof');
if (B.dropped.length) throw new Error(`library: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`library: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
