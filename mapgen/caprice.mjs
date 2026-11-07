// 1993 Chevrolet Caprice as a New York taxi (VAUX, 2026-11-06), from memory, no logos/badges: the rounded "bubble"
// sedan in taxi yellow, black lower trim, a lit roof sign, tinted glass, chrome bumpers, four wheels.
// ~5.4 x 1.95 x 1.45 m at the 60-unit-player scale = 178 x 64 x 48 units. node mapgen/caprice.mjs X Y Z (front +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-000000001993', name: 'Claude Taxi', display_name: 'Claude Taxi' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const YEL = m([245, 190, 30], { material: 'BMC_Metallic' }), BLK = m([25, 25, 28]), CHROME = m([200, 200, 205], { material: 'BMC_Metallic' });
const GLASS = m([50, 60, 70], { material: 'BMC_Glass' }), TIRE = m([22, 22, 22]), HEAD = m([255, 250, 230], { material: 'BMC_Glow', material_intensity: 2 });
const TAIL = m([200, 20, 20], { material: 'BMC_Glow', material_intensity: 2 }), SIGN = m([255, 240, 200], { material: 'BMC_Glow', material_intensity: 2 });
const L = 88, W = 32;
for (const wx of [-54, 56]) for (const s of [-1, 1]) for (let z = 0; z < 26; z += 2) { const dz = z + 1 - 13, hw = Math.floor(Math.sqrt(169 - dz * dz) / 2) * 2; if (hw >= 2) B.box(wx - hw, s > 0 ? W : -W - 8, z, wx + hw, s > 0 ? W + 8 : -W, z + 2, Math.abs(dz) < 6 && hw > 6 ? CHROME : TIRE, 'wheel'); }
B.box(-L, -W, 6, L, W, 14, BLK, 'lower trim');
B.box(-L, -W, 14, L, W, 30, YEL, 'body');
B.box(L, -W, 8, L + 4, W, 16, CHROME, 'front bumper'); B.box(-L - 4, -W, 8, -L, W, 16, CHROME, 'rear bumper');
for (const s of [-1, 1]) { B.box(L, s > 0 ? 14 : -26, 18, L + 2, s > 0 ? 26 : -14, 24, HEAD, 'headlight'); B.box(-L - 2, s > 0 ? 18 : -28, 18, -L, s > 0 ? 28 : -18, 26, TAIL, 'tail light'); }
// rounded greenhouse: windscreen and rear glass as wedges, side glass, roof
B.wedge(14, -28, 30, 34, 28, 46, -1, 0, [50, 60, 70], 'windscreen');
B.box(-36, -28, 30, 14, 28, 46, GLASS, 'cabin glass');
B.wedge(-56, -28, 30, -36, 28, 46, 1, 0, [50, 60, 70], 'rear glass');
B.box(-36, -28, 46, 14, 28, 48, YEL, 'roof');
B.box(-16, -12, 48, -4, 12, 56, SIGN, 'roof sign'); B.box(-18, -14, 48, -16, 14, 54, BLK, 'sign end'); B.box(-4, -14, 48, -2, 14, 54, BLK, 'sign end');
for (const s of [-1, 1]) B.box(-60, s > 0 ? W : -W - 2, 18, 60, s > 0 ? W + 2 : -W, 20, BLK, 'checker strip');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`caprice: ${bricks.length} bricks (${B.dropped.length} skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
