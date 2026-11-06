// Tour bus with a detailed interior (Third Gender, 2026-11-06): a band-style coach, real size at the 60-unit-player
// scale (13 x 2.6 x 3.7 m -> 430 x 86 x 122 units), original two-tone livery, no logos. Walk-in door at the front right;
// inside, front to back: driver seat + dash, front lounge (two sofas, a table, a TV), kitchenette (counter, sink,
// fridge, microwave), a bunk corridor (3 x 2 bunks each side with curtains), a rear lounge (U sofa, TV), bathroom.
// Hollow shell of micro bricks, tinted windows, six wheels. node mapgen/tourbus.mjs X Y Z   (front toward +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000070b5', name: 'Claude Tour Bus', display_name: 'Claude Tour Bus' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const BODY = m([30, 32, 40], { material: 'BMC_Metallic' }), STRIPE = m([170, 40, 50], { material: 'BMC_Metallic' }), GLASS = m([40, 50, 60], { material: 'BMC_Glass' });
const FLOOR = m([110, 80, 60]), SOFA = m([60, 50, 46]), CUSH = m([150, 120, 90]), WOOD = m([140, 100, 64]), STEEL = m([180, 184, 190], { material: 'BMC_Metallic' });
const TIRE = m([22, 22, 22]), HUB = m([170, 170, 175], { material: 'BMC_Metallic' }), CURTAIN = m([90, 30, 40]), SCREEN = m([20, 30, 40], { material: 'BMC_Glow', material_intensity: 1 });
const LIGHT = m([255, 245, 220], { material: 'BMC_Glow', material_intensity: 2 }), RED = m([200, 20, 20], { material: 'BMC_Glow', material_intensity: 2 });
const L = 215, Wd = 42, F = 24, H = 122; // half length, half width, floor top, roof top
const box = (x0, y0, z0, x1, y1, z1, mt, l) => B.box(x0, y0, z0, x1, y1, z1, mt, l);
// ---- wheels (6) and chassis
for (const wx of [150, -110, -150]) for (const s of [-1, 1]) {
  box(wx - 18, s > 0 ? Wd : -Wd - 8, 0, wx + 18, s > 0 ? Wd + 8 : -Wd, 36, TIRE, 'tyre'); // outside the walls
  box(wx - 8, s > 0 ? Wd + 8 : -Wd - 10, 10, wx + 8, s > 0 ? Wd + 10 : -Wd - 8, 26, HUB, 'hub');
}
box(-L, -Wd + 4, 8, L, Wd - 4, 20, m([40, 40, 44]), 'chassis');
box(-L, -Wd, 20, L, Wd, F, FLOOR, 'floor');
// ---- shell: walls with a window band, a red stripe, the door gap at the front right (+y side), windscreen, roof
const winZ0 = 58, winZ1 = 96;
for (const s of [-1, 1]) {
  const y0 = s > 0 ? Wd - 2 : -Wd, y1 = s > 0 ? Wd : -Wd + 2;
  const doorGap = x => s > 0 && x >= 170 && x < 200; // door: x 170..200 on the +y side
  for (let x = -L; x < L; x += 10) {
    if (doorGap(x)) continue;
    box(x, y0, F, x + 10, y1, winZ0 - 6, BODY, 'wall low');
    box(x, y0, winZ0 - 6, x + 10, y1, winZ0, STRIPE, 'stripe');
    box(x, y0, winZ0, x + 10, y1, winZ1, (x / 10) % 6 === 0 ? BODY : GLASS, 'window band'); // pillars every 60
    box(x, y0, winZ1, x + 10, y1, H - 4, BODY, 'wall high');
  }
}
box(170, Wd - 2, H - 30, 200, Wd, H - 4, BODY, 'over door');
box(L - 2, -Wd, F, L, Wd, 52, BODY, 'front low');
box(L - 2, -Wd, 52, L, Wd, H - 8, GLASS, 'windscreen');
box(-L, -Wd, F, -L + 2, Wd, H - 4, BODY, 'rear wall');
box(-L, -Wd, H - 4, L, Wd, H, BODY, 'roof');
for (const y of [-34, 26]) { box(L, y, 30, L + 2, y + 8, 38, LIGHT, 'headlight'); box(-L - 2, y, 40, -L, y + 8, 56, RED, 'tail light'); }
// ---- interior, front to back
box(180, -34, F, 200, -14, 40, SOFA, 'driver seat'); box(180, -34, 40, 184, -14, 62, SOFA, 'driver back');
box(200, -38, F, 210, 38, 50, m([50, 50, 54]), 'dash'); box(196, -30, 50, 200, -18, 58, m([30, 30, 30]), 'wheel');
for (const s of [-1, 1]) { box(110, s > 0 ? 18 : -38, F, 160, s > 0 ? 38 : -18, 36, SOFA, 'front sofa'); box(110, s > 0 ? 34 : -38, 36, 160, s > 0 ? 38 : -34, 58, SOFA, 'sofa back'); box(112, s > 0 ? 20 : -34, 36, 158, s > 0 ? 32 : -22, 38, CUSH, 'cushion'); }
box(128, -6, F, 142, 6, 42, WOOD, 'table');
box(108, -20, 66, 110, 20, 92, SCREEN, 'front tv');
box(60, 22, F, 104, 38, 52, WOOD, 'counter'); box(70, 26, 52, 80, 34, 54, STEEL, 'sink');
box(60, -38, F, 76, -20, 110, STEEL, 'fridge'); box(80, -38, 60, 96, -24, 72, STEEL, 'microwave');
for (const s of [-1, 1]) for (let b = 0; b < 3; b++) for (const lvl of [0, 1]) { // bunks: 3 along x, 2 high, curtains
  const x0 = -50 + b * 34, z0 = F + 4 + lvl * 44;
  box(x0, s > 0 ? 16 : -38, z0, x0 + 32, s > 0 ? 38 : -16, z0 + 6, WOOD, 'bunk');
  box(x0 + 2, s > 0 ? 18 : -36, z0 + 6, x0 + 30, s > 0 ? 36 : -18, z0 + 10, CUSH, 'mattress');
  box(x0, s > 0 ? 14 : -16, z0 + 10, x0 + 32, s > 0 ? 16 : -14, z0 + 38, CURTAIN, 'curtain');
}
box(-190, -38, F, -120, 38, 36, SOFA, 'rear sofa'); box(-196, -38, 36, -190, 38, 60, SOFA, 'rear sofa back');
box(-120, -14, F, -110, 14, 40, WOOD, 'rear table');
box(-212, -20, 66, -210, 20, 92, SCREEN, 'rear tv');
box(-104, -38, F, -84, -12, 110, m([200, 200, 205]), 'bathroom wall'); box(-100, -34, F, -90, -24, 40, m([240, 240, 245]), 'toilet');
for (let x = -200; x < 200; x += 50) box(x, -4, H - 8, x + 10, 4, H - 4, LIGHT, 'ceiling light');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`tourbus: ${bricks.length} bricks (${B.dropped.length} skipped), ${2 * L} long, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 5000, bricks }] }));
