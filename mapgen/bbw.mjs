// The bbw (owner gag: no-go builds get "ask for a bbw instead"; comfycookie asked, 2026-11-06):
// a cheerful, fully clothed big lady statue in a sundress and sun hat, holding a pie.
// node mapgen/bbw.mjs X Y Z > job.json   (faces +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000bb01', name: 'Claude Statue', display_name: 'Claude Statue' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = color => ({ asset: MB, color });
const SKIN = m([224, 172, 140]), DRESS = m([90, 150, 210]), DOT = m([250, 240, 120]), HAIR = m([110, 60, 30]);
const HAT = m([235, 215, 160]), BAND = m([220, 70, 90]), SHOE = m([60, 40, 40]), PIE = m([200, 140, 70]), CRUST = m([230, 190, 120]);
const EYE = m([30, 30, 40]), SMILE = m([170, 60, 60]), PLINTH = m([130, 126, 120]);
// centred box: half extents (hx, hy) around (cx, cy), z from z0 to z1
const c = (cx, cy, hx, hy, z0, z1, mat, l) => B.box(cx - hx, cy - hy, z0, cx + hx, cy + hy, z1, mat, l);
c(0, 0, 40, 40, 0, 8, PLINTH, 'plinth');
for (const s of [-1, 1]) {
  c(4, s * 12, 10, 8, 8, 12, SHOE, 'shoe');
  c(0, s * 12, 6, 6, 12, 30, SKIN, 'leg');
}
// bell-shaped sundress, widest at the hips
const rows = [[30, 34, 22], [34, 34, 26], [38, 34, 28], [42, 32, 28], [46, 30, 26], [50, 28, 24], [54, 26, 22], [58, 24, 20], [62, 24, 20]];
for (const [z, hx, hy] of rows) c(0, 0, hx, hy, z, z + 4, DRESS, 'dress');
rows.forEach(([z, hx], k) => k % 2 || c(hx + 1, k % 4 ? 10 : -10, 1, 3, z, z + 4, DOT, 'polka dot')); // dots on the front of every other row
c(0, 0, 20, 18, 66, 82, DRESS, 'bodice');
c(0, 0, 6, 6, 82, 86, SKIN, 'neck');
// arms forward holding a pie at the belly
for (const s of [-1, 1]) {
  c(0, s * 24, 6, 6, 66, 80, SKIN, 'upper arm');
  B.box(6, s > 0 ? 18 : -26, 70, 20, s > 0 ? 26 : -18, 76, SKIN, 'elbow');
  B.box(20, s > 0 ? 14 : -22, 70, 30, s > 0 ? 22 : -14, 74, SKIN, 'forearm');
}
c(32, 0, 10, 14, 70, 74, PIE, 'pie');
c(32, 0, 8, 12, 74, 76, CRUST, 'crust');
// head, hair, face, sun hat
c(0, 0, 12, 12, 86, 108, SKIN, 'head');
B.box(-16, -14, 90, -12, 14, 112, HAIR, 'hair back');
B.box(-12, -12, 108, 12, 12, 112, HAIR, 'hair top');
for (const s of [-1, 1]) B.box(-12, s > 0 ? 12 : -14, 96, 4, s > 0 ? 14 : -12, 108, HAIR, 'hair side');
c(13, -5, 1, 2, 100, 104, EYE, 'eye');
c(13, 5, 1, 2, 100, 104, EYE, 'eye');
c(13, 0, 1, 5, 92, 94, SMILE, 'smile');
c(0, 0, 26, 26, 112, 114, HAT, 'hat brim');
c(0, 0, 13, 13, 114, 118, BAND, 'hat band');
c(0, 0, 13, 13, 118, 126, HAT, 'hat crown');
if (B.dropped.length) throw new Error(`bbw: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`bbw: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
