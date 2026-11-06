// Miniature fighter jet (2008nickcody, 2026-11-06): a generic original twin-tail jet on a little stand, grey with a
// glass canopy and glowing afterburner. ~6 studs long. node mapgen/minijet.mjs X Y Z   (nose toward +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000f1e7', name: 'Claude Mini Jet', display_name: 'Claude Mini Jet' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const GREY = m([120, 128, 138]), DARK = m([70, 76, 86]), GLASS = m([60, 90, 120], { material: 'BMC_Glass' }), FIRE = m([255, 150, 50], { material: 'BMC_Glow', material_intensity: 3 }), STAND = m([40, 40, 44]);
B.box(-8, -8, 0, 8, 8, 2, STAND, 'stand base'); B.box(-1, -1, 2, 1, 1, 18, STAND, 'stand post');
B.box(-24, -3, 18, 22, 3, 24, GREY, 'fuselage');
B.wedge(22, -3, 18, 32, 3, 24, -1, 0, [120, 128, 138], 'nose');
B.box(2, -2, 24, 14, 2, 28, GLASS, 'canopy');
for (const s of [-1, 1]) {
  for (let k = 0; k < 6; k++) B.box(-16 + k * 4, s > 0 ? 3 : -3 - (14 - k * 2), 20, -12 + k * 4, s > 0 ? 3 + (14 - k * 2) : -3, 22, GREY, 'wing'); // swept delta: 6 non-overlapping chords
  B.box(-24, s > 0 ? 2 : -4, 24, -18, s > 0 ? 4 : -2, 34, DARK, 'tail fin');
  B.box(-26, s > 0 ? 3 : -11, 20, -20, s > 0 ? 11 : -3, 22, DARK, 'tailplane');
}
B.box(-28, -2, 19, -24, 2, 23, FIRE, 'afterburner');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`minijet: ${bricks.length} bricks (${B.dropped.length} skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
