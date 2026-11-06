// "AI build: do your worst 10x" redone in Claude's style (comfycookie, 2026-11-06). Same cast as the !ai build
// (two-tone platform, green pyramid, yellow tower with a pink top, white tower, red slabs, blue tower, a yellow
// diagonal), at a fifth of the size, muted palette, wedge-smoothed pyramid, the diagonal turned into a ramp.
// node mapgen/worst_redux.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000a058', name: 'Claude Worst Redux', display_name: 'Claude Worst Redux' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const PLUM = m([120, 70, 110]), TEAL = m([70, 130, 130]), MOSS = m([90, 130, 70]), OCHRE = m([210, 170, 70]);
const ROSE = m([230, 130, 150], { material: 'BMC_Glow', material_intensity: 2 }), BONE = m([225, 220, 205]), BRICK = m([160, 70, 60]);
const SLATE = m([70, 90, 150]), STONE = m([110, 108, 104]);
// platform: plum slab with a teal inset, stone lip
B.box(-200, -180, 0, 200, 180, 8, STONE, 'lip');
B.box(-196, -176, 8, 196, 176, 14, PLUM, 'platform');
// top course: teal inset framed in plum, flush, so everything stands at z 16
B.box(-120, -100, 14, 120, 100, 16, TEAL, 'inset');
B.box(-196, -176, 14, 196, -100, 16, PLUM, 'frame');
B.box(-196, 100, 14, 196, 176, 16, PLUM, 'frame');
B.box(-196, -100, 14, -120, 100, 16, PLUM, 'frame');
B.box(120, -100, 14, 196, 100, 16, PLUM, 'frame');
// green pyramid, west end: 8 courses, each a box with micro wedges on all four faces
const PX = -140, PY = 90;
for (let k = 0; k < 8; k++) {
  const h = 50 - k * 6, z0 = 16 + k * 16, z1 = z0 + 12;
  B.box(PX - h + 6, PY - h + 6, z0, PX + h - 6, PY + h - 6, z1 + 4, MOSS, 'course');
  if (h > 8) {
    B.wedge(PX - h, PY - h + 6, z0, PX - h + 6, PY + h - 6, z1, 1, 0, { color: [90, 130, 70] }, 'face');
    B.wedge(PX + h - 6, PY - h + 6, z0, PX + h, PY + h - 6, z1, -1, 0, { color: [90, 130, 70] }, 'face');
    B.wedge(PX - h + 6, PY - h, z0, PX + h - 6, PY - h + 6, z1, 0, 1, { color: [90, 130, 70] }, 'face');
    B.wedge(PX - h + 6, PY + h - 6, z0, PX + h - 6, PY + h, z1, 0, -1, { color: [90, 130, 70] }, 'face');
  }
}
// yellow tower with a glowing rose lantern
B.box(-40, 60, 16, -20, 80, 200, OCHRE, 'yellow tower');
B.box(-44, 56, 200, -16, 84, 204, OCHRE, 'gallery');
B.box(-38, 62, 204, -22, 78, 224, ROSE, 'lantern');
B.box(-42, 58, 224, -18, 82, 228, OCHRE, 'cap');
// white obelisk, centre
B.box(10, -10, 16, 30, 10, 140, BONE, 'obelisk');
B.box(14, -6, 140, 26, 6, 152, BONE, 'obelisk tip');
// red slabs along the south edge, stepping up
for (let k = 0; k < 4; k++) B.box(-100 + k * 60, -170, 16, -60 + k * 60, -130, 16 + 8 * (k + 1), BRICK, 'red slab');
// blue tower, east end, with battlements
B.box(130, -40, 16, 170, 0, 180, SLATE, 'blue tower');
for (const [x, y] of [[130, -40], [154, -40], [130, -16], [154, -16]]) B.box(x, y, 180, x + 16, y + 16, 190, SLATE, 'merlon');
// the yellow diagonal as a ramp of steps from the platform up to the blue tower's side
for (let k = 0; k < 20; k++) B.box(100 - 2 * (19 - k), 4, 16 + k * 8, 128 - 2 * (19 - k), 20, 20 + k * 8, OCHRE, 'ramp step');
if (B.dropped.length) throw new Error(`worst redux: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`worst redux: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
