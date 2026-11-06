// "What gemini looks like" (dirt, 2026-11-06): the twins, two identical boxy robots back to back,
// each sure the other one is the real one. node mapgen/gemini.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000a3e1', name: 'Claude Twins', display_name: 'Claude Twins' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const BODY = m([90, 120, 220]), DARK = m([50, 60, 110]), FACE = m([30, 30, 40]), EYE = m([120, 220, 255], { material: 'BMC_Glow', material_intensity: 3 });
const TIP = m([255, 220, 90], { material: 'BMC_Glow', material_intensity: 3 }), PLINTH = m([130, 126, 120]);
B.box(-40, -30, 0, 40, 30, 6, PLINTH, 'plinth');
// one robot facing +x at x offset ox; s = +1 faces +x, -1 faces -x
const robot = (ox, s) => {
  const c = (x0, y0, z0, x1, y1, z1, mat, l) => B.box(ox + Math.min(s * x0, s * x1), y0, z0, ox + Math.max(s * x0, s * x1), y1, z1, mat, l);
  for (const y of [-10, 4]) c(-4, y, 6, 4, y + 6, 26, DARK, 'leg');
  c(-10, -14, 26, 10, 14, 60, BODY, 'body');
  c(10, -6, 36, 12, 6, 50, DARK, 'chest panel');
  for (const y of [-20, 14]) c(-4, y, 34, 4, y + 6, 58, DARK, 'arm');
  c(-4, -4, 60, 4, 4, 64, DARK, 'neck');
  c(-12, -12, 64, 12, 12, 88, BODY, 'head');
  c(12, -9, 70, 14, 9, 84, FACE, 'visor');
  c(14, -7, 76, 16, -3, 80, EYE, 'eye');
  c(14, 3, 76, 16, 7, 80, EYE, 'eye');
  c(-1, -1, 88, 1, 1, 100, DARK, 'antenna');
  c(-2, -2, 100, 2, 2, 104, TIP, 'antenna tip');
};
robot(14, 1);
robot(-14, -1);
if (B.dropped.length) throw new Error(`gemini: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`gemini: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
