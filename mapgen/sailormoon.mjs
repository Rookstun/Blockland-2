// "Sailor moon" (comfycookie, 2026-11-06), taken literally (no copyrighted character): a crescent moon in a sailor cap,
// with an anchor on a plinth. node mapgen/sailormoon.mjs X Y Z > job.json   (faces +x; moon drawn in the y-z plane)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-000000005a11', name: 'Claude Sailor Moon', display_name: 'Claude Sailor Moon' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const MOON = m([250, 230, 140], { material: 'BMC_Glow', material_intensity: 2 }), WHITE = m([245, 245, 245]), NAVY = m([30, 40, 90]);
const STONE = m([120, 120, 130]), BRASS = m([200, 160, 60], { material: 'BMC_Metallic' });
B.box(-24, -40, 0, 24, 40, 8, STONE, 'plinth');
B.box(-6, -6, 8, 6, 6, 30, STONE, 'post');
// crescent: big disc minus an offset disc, 4-unit pixels in y-z, rows merged; 8 thick in x
const R = 70, CZ = 30 + R + 4, P = 4;
const inMoon = (y, z) => Math.hypot(y, z) < R && Math.hypot(y - 34, z - 14) > R * 0.8;
for (let j = -R / P; j < R / P; j++) {
  let run = null;
  for (let i = -R / P; i <= R / P; i++) {
    const on = i < R / P && inMoon(i * P + 2, j * P + 2);
    if (on && run === null) run = i;
    if (!on && run !== null) { B.box(-4, run * P, CZ + j * P, 4, i * P, CZ + j * P + P, MOON, 'moon'); run = null; }
  }
}
// face on the inner edge: eye and smile (front, +x)
B.box(4, -46, CZ + 14, 6, -40, CZ + 20, NAVY, 'eye');
B.box(4, -50, CZ - 14, 6, -38, CZ - 10, NAVY, 'smile');
// sailor cap perched on the top horn: white crown, navy band, black brim
const hy = -28;
let hz = 0; // sit on the highest moon pixel under the cap's footprint
for (let y = hy - 16; y < hy + 16; y += 2) for (let z = R; z > -R; z -= 2) if (inMoon(y, z)) { hz = Math.max(hz, Math.ceil((CZ + z) / 4) * 4 + 4); break; }
B.box(-10, hy - 14, hz, 10, hy + 14, hz + 4, NAVY, 'cap band');
B.box(-12, hy - 16, hz + 4, 12, hy + 16, hz + 12, WHITE, 'cap crown');
B.box(6, hy - 10, hz - 2, 16, hy + 10, hz, m([20, 20, 25]), 'cap brim');
B.box(-2, hy - 2, hz + 12, 2, hy + 2, hz + 14, NAVY, 'cap button');
// anchor leaning on the plinth front
B.box(26, -2, 12, 30, 2, 34, BRASS, 'anchor shank');
B.box(26, -3, 36, 30, 3, 40, BRASS, 'anchor ring');
B.box(26, -10, 34, 30, 10, 36, BRASS, 'anchor stock');
B.box(26, -14, 8, 30, 14, 12, BRASS, 'anchor arms');
for (const s of [-1, 1]) B.box(26, s > 0 ? 10 : -14, 12, 30, s > 0 ? 14 : -10, 18, BRASS, 'anchor fluke');
if (B.dropped.length) throw new Error(`sailormoon: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`sailormoon: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
