// Zjenks's wish (2026-11-02, granted by the owner): an original friendly blue tank engine with a face (no named
// character: own livery, no number). Front (face) at +x, 170 long from x -85, wheels on the ground.
//   node mapgen/tankengine.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

export function tankEngine() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => { if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`tank engine: ${label} dropped: ${B.dropped.at(-1)}`); };
  const BLUE = [38, 96, 196], RED = [196, 40, 36], BLACK = [26, 26, 28], GREY = [96, 98, 104], WHITE = [246, 246, 240], SKIN = [214, 214, 210];
  // wheels: three a side, each a stepped disc (cross of two boxes) with a red hub
  for (const y of [-34, 26]) for (const x of [-52, -4, 44]) {
    box(x - 16, y, 6, x + 16, y + 8, 30, BLACK, 'wheel');
    box(x - 10, y, 0, x + 10, y + 8, 6, BLACK, 'wheel');
    box(x - 10, y, 30, x + 10, y + 8, 36, BLACK, 'wheel');
    box(x - 4, y + (y < 0 ? -2 : 8), 14, x + 4, y + (y < 0 ? 0 : 10), 22, RED, 'hub');
  }
  // running board / frame + buffer beams
  box(-80, -26, 36, 80, 26, 44, RED, 'frame');
  box(80, -30, 30, 86, 30, 44, RED, 'buffer beam');
  box(-86, -30, 30, -80, 30, 44, RED, 'buffer beam');
  for (const y of [-22, 14]) { box(86, y, 34, 92, y + 8, 40, BLACK, 'buffer'); box(-92, y, 34, -86, y + 8, 40, BLACK, 'buffer'); }
  // boiler (stepped round) and side tanks
  box(-10, -16, 44, 70, 16, 88, BLUE, 'boiler');
  box(-10, -20, 50, 70, -16, 82, BLUE, 'boiler'); box(-10, 16, 50, 70, 20, 82, BLUE, 'boiler');
  box(-10, -26, 44, 56, -20, 74, BLUE, 'tank'); box(-10, 20, 44, 56, 26, 74, BLUE, 'tank');
  box(-10, -26, 74, 56, -20, 76, RED, 'tank line'); box(-10, 20, 74, 56, 26, 76, RED, 'tank line');
  // smokebox + the face on its front
  box(70, -18, 44, 80, 18, 88, GREY, 'smokebox');
  box(80, -14, 50, 82, 14, 84, SKIN, 'face');
  box(82, -10, 72, 84, -4, 78, WHITE, 'eye'); box(82, 4, 72, 84, 10, 78, WHITE, 'eye');
  box(84, -8, 72, 86, -6, 76, BLACK, 'pupil'); box(84, 6, 72, 86, 8, 76, BLACK, 'pupil');
  box(82, -10, 80, 84, -4, 82, GREY, 'brow'); box(82, 4, 80, 84, 10, 82, GREY, 'brow');
  box(82, -6, 58, 84, 6, 60, [120, 40, 40], 'smile'); box(82, -8, 60, 84, -6, 62, [120, 40, 40], 'smile'); box(82, 6, 60, 84, 8, 62, [120, 40, 40], 'smile');
  box(82, -2, 64, 84, 2, 68, [200, 200, 196], 'nose');
  // funnel, dome, whistle
  box(60, -6, 88, 72, 6, 112, BLACK, 'funnel'); box(58, -8, 112, 74, 8, 116, BLACK, 'funnel lip');
  box(26, -8, 88, 42, 8, 98, BLUE, 'dome'); box(30, -6, 98, 38, 6, 100, [212, 170, 60], 'dome cap', { material: 'BMC_Metallic', material_intensity: 6 });
  box(8, -2, 88, 12, 2, 98, [212, 170, 60], 'whistle', { material: 'BMC_Metallic', material_intensity: 6 });
  // cab: blue box, a window each side and at the front, black roof with overhang
  for (const y of [-26, 22]) {   // side walls round the window
    box(-70, y, 44, -54, y + 4, 116, BLUE, 'cab'); box(-30, y, 44, -10, y + 4, 116, BLUE, 'cab');
    box(-54, y, 44, -30, y + 4, 84, BLUE, 'cab'); box(-54, y, 104, -30, y + 4, 116, BLUE, 'cab');
  }
  box(-74, -26, 44, -70, 26, 116, BLUE, 'cab back'); box(-14, -22, 88, -10, 22, 116, BLUE, 'cab front');
  for (const y of [-26, 22]) box(-54, y, 84, -30, y + 4, 104, [176, 212, 228], 'cab window', { material: 'BMC_Glass' });
  box(-78, -30, 116, -6, 30, 122, BLACK, 'roof');
  box(-70, -22, 44, -14, 22, 48, [120, 80, 50], 'cab floor');
  return B.bricks;
}

if (process.argv[1]?.endsWith('tankengine.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'tankengine.json';
  const bricks = tankEngine().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify(bricks));
  console.error(`tank engine: ${bricks.length} bricks`);
}
