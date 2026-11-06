// Little car (comfycookie asked "for claude only: build a car", 2026-11-06).
// node mapgen/claudecar.mjs X Y Z > job.json   (Z = ground under it)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000ca12', name: 'Claude Car', display_name: 'Claude Car' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const PAINT = { asset: MB, color: [180, 30, 40] }, TRIM = { asset: MB, color: [40, 40, 44] }, CHROME = { asset: MB, color: [200, 200, 205], material: 'BMC_Metallic' };
const GLASS = { asset: MB, color: [150, 200, 230], material: 'BMC_Glass' };
const glow = c => ({ asset: MB, color: c, material: 'BMC_Glow', material_intensity: 3 });
// wheels: 2x2 rounds turned on their side (direction Y+), tyres outside the body
for (const x of [-30, 30]) for (const s of [-1, 1]) B.add({ asset: 'B_2x2_Round', direction: 2, rotation: 0, size: [0, 0, 0], color: [25, 25, 25], position: [x, s * 26, 10] }, 'wheel');
B.box(-46, -20, 6, 46, 20, 10, TRIM, 'chassis');
B.box(-46, -20, 10, 46, 20, 24, PAINT, 'body');
B.box(-50, -20, 8, -46, 20, 14, CHROME, 'rear bumper');
B.box(46, -20, 8, 50, 20, 14, CHROME, 'front bumper');
B.box(46, -16, 16, 48, -8, 22, glow([255, 245, 200]), 'headlight');
B.box(46, 8, 16, 48, 16, 22, glow([255, 245, 200]), 'headlight');
B.box(-48, -16, 16, -46, -8, 22, glow([255, 30, 20]), 'tail light');
B.box(-48, 8, 16, -46, 16, 22, glow([255, 30, 20]), 'tail light');
// cabin: windscreen wedge, glass box, back wedge, roof
B.wedge(14, -18, 24, 26, 18, 42, -1, 0, { color: [150, 200, 230], material: 'BMC_Glass' }, 'windscreen');
B.box(-24, -18, 24, 14, 18, 42, GLASS, 'cabin glass');
B.wedge(-34, -18, 24, -24, 18, 42, 1, 0, { color: [180, 30, 40] }, 'back');
B.box(-24, -18, 42, 14, 18, 44, PAINT, 'roof');
B.box(-20, -2, 44, -16, 2, 48, glow([255, 140, 40]), 'claude light');
if (B.dropped.length) throw new Error(`car: ${B.dropped.join('; ')}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`car: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
