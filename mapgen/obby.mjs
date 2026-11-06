// "A physical mini game" (Kraken, 2026-11-06): a jump course: a start pad, 16 stepping platforms spiralling up
// (gaps of 3 to 4 studs, one plate-and-a-brick up each), a glowing finish pad with a flag. Original layout.
// node mapgen/obby.mjs X Y Z [hard] > job.json   (hard = Kraken's 'very hard climbing mini game that goes very high':
// 60 small platforms, wider gaps, 2 plates up each, every 5th a single stud; own owner)
import { makeBuilder } from './builder.mjs';

const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number);
const HARD = process.argv[5] === 'hard';
const OWNER = HARD
  ? { id: 'c1a0de00-0000-4b0b-9a11-0000000000bc', name: 'Claude Hard Climb', display_name: 'Claude Hard Climb' }
  : { id: 'c1a0de00-0000-4b0b-9a11-0000000000bb', name: 'Claude Jump Course', display_name: 'Claude Jump Course' };
const N = HARD ? 60 : 16, RISE = HARD ? 20 : 16, STEP = HARD ? 0.5 : 0.62, R0 = HARD ? 110 : 90, RG = HARD ? 1.5 : 6;
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const COLS = [[230, 80, 80], [240, 160, 60], [240, 220, 80], [100, 200, 100], [80, 170, 230], [150, 110, 220]];
const STONE = { asset: MB, color: [110, 108, 104] };
B.box(-40, -40, 0, 40, 40, 8, STONE, 'start pad');
B.box(-40, -44, 8, 40, -40, 12, { asset: MB, color: [80, 200, 90], material: 'BMC_Glow', material_intensity: 2 }, 'start line');
let last = [0, 0, 8];
for (let k = 0; k < N; k++) {
  const a = k * STEP, r = R0 + k * RG, z = 8 + (k + 1) * RISE;
  const x = Math.round((Math.cos(a) * r) / 2) * 2, y = Math.round((Math.sin(a) * r) / 2) * 2, h = HARD ? (k % 5 === 4 ? 5 : 8) : k % 4 === 3 ? 10 : 14; // easy: every 4th smaller; hard: 8 half, every 5th one stud
  B.box(x - h, y - h, z - 4, x + h, y + h, z, { asset: MB, color: COLS[k % COLS.length] }, 'platform');
  B.box(x - 2, y - 2, 0, x + 2, y + 2, z - 4, { asset: MB, color: [60, 60, 66] }, 'post');
  last = [x, y, z];
}
// finish: a wider glowing pad one step past the last platform, with a pole and a flag
const fa = N * STEP, fr = R0 + N * RG, fz = 8 + (N + 1) * RISE;
const fx = Math.round((Math.cos(fa) * fr) / 2) * 2, fy = Math.round((Math.sin(fa) * fr) / 2) * 2;
B.box(fx - 24, fy - 24, fz - 6, fx + 24, fy + 24, fz, { asset: MB, color: [250, 210, 60], material: 'BMC_Glow', material_intensity: 2 }, 'finish pad');
B.box(fx - 2, fy - 2, 0, fx + 2, fy + 2, fz - 6, { asset: MB, color: [60, 60, 66] }, 'finish post');
B.box(fx - 1, fy - 1, fz, fx + 1, fy + 1, fz + 60, { asset: MB, color: [220, 220, 225], material: 'BMC_Metallic' }, 'flag pole');
B.box(fx + 1, fy - 1, fz + 40, fx + 25, fy + 1, fz + 58, { asset: MB, color: [217, 119, 87] }, 'flag');
if (B.dropped.length) throw new Error(`obby: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`obby: ${bricks.length} bricks, top ${fz} at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
