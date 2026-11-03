// TI&und;musta's wish (2026-11-02, granted by renderman: "claude grant mustas wish"): a modern luxury cubist mansion with a pool.
// Two-storey multi-block layout: ground-floor living block + east wing under one wide flat black roof slab, a cantilevered upper
// volume with its own overhanging black roof, limestone facade, big glass walls, warm soffit lights, interior stair, raised pool at the back.
// Front faces -y; origin = front-left of the ground block.
//   node mapgen/cubistmansion.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000009', name: 'cubistmansion', display_name: 'cubistmansion' };

export function mansion() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`mansion: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const LIME = [226, 220, 206], LIME2 = [206, 200, 186], BLACK = [24, 24, 28], GLASS = [150, 200, 220], WOOD = [120, 86, 58], TILE = [196, 202, 208], WATER = [60, 150, 220], LIGHT = [255, 232, 160];
  const glass = { material: 'BMC_Glass' };
  const wallX = (xa, xb, y0, y1, zb, zt, ops, color = LIME) => {
    let c = xa;
    for (const o of [...ops].sort((p, q) => p.x0 - q.x0)) {
      if (o.x0 > c) box(c, y0, zb, o.x0, y1, zt, color, 'wall');
      if (o.z0 > zb) box(o.x0, y0, zb, o.x1, y1, o.z0, color, 'sill');
      if (o.z1 < zt) box(o.x0, y0, o.z1, o.x1, y1, zt, color, 'lintel');
      if (o.glass) box(o.x0, (y0 + y1) / 2 - 1, o.z0, o.x1, (y0 + y1) / 2 + 1, o.z1, GLASS, 'glass', glass);
      c = o.x1;
    }
    if (xb > c) box(c, y0, zb, xb, y1, zt, color, 'wall');
  };
  const wallY = (ya, yb, x0, x1, zb, zt, ops, color = LIME) => {
    let c = ya;
    for (const o of [...ops].sort((p, q) => p.y0 - q.y0)) {
      if (o.y0 > c) box(x0, c, zb, x1, o.y0, zt, color, 'wall');
      if (o.z0 > zb) box(x0, o.y0, zb, x1, o.y1, o.z0, color, 'sill');
      if (o.z1 < zt) box(x0, o.y0, o.z1, x1, o.y1, zt, color, 'lintel');
      if (o.glass) box((x0 + x1) / 2 - 1, o.y0, o.z0, (x0 + x1) / 2 + 1, o.y1, o.z1, GLASS, 'glass', glass);
      c = o.y1;
    }
    if (yb > c) box(x0, c, zb, x1, yb, zt, color, 'wall');
  };
  const gx = (a, b, z0, z1) => ({ x0: a, x1: b, z0, z1, glass: true }), gy = (a, b, z0, z1) => ({ y0: a, y1: b, z0, z1, glass: true });
  const open = (a, b, z0, z1) => ({ x0: a, x1: b, y0: a, y1: b, z0, z1 });

  // foundation terrace
  box(-20, -20, 0, 640, 600, 4, LIME2, 'terrace');
  // ground block A (x0..400, y60..320) and east wing B (x400..620, y140..400), walls z4..100
  wallX(0, 400, 60, 70, 4, 100, [open(180, 220, 4, 92), gx(30, 170, 12, 92), gx(230, 370, 12, 92)]);
  wallX(0, 400, 310, 320, 4, 100, [gx(30, 180, 12, 92), gx(200, 370, 12, 92)]);
  wallY(70, 310, 0, 10, 4, 100, [gy(110, 270, 12, 92)]);
  wallY(70, 310, 390, 400, 4, 100, [open(180, 260, 4, 92)]);
  wallX(400, 620, 140, 150, 4, 100, [gx(480, 600, 12, 92)]);
  wallX(400, 620, 390, 400, 4, 100, [gx(440, 580, 12, 92)]);
  wallY(150, 390, 610, 620, 4, 100, [gy(190, 350, 12, 92)]);
  wallY(320, 390, 400, 410, 4, 100, []);
  // the one wide black roof slab (floor of the upper volume), a hole for the stair at x420..460 y190..282
  const slab = (x0, y0, x1, y1, c = BLACK) => box(x0, y0, 100, x1, y1, 108, c, 'roof slab');
  slab(-20, 40, 420, 420); slab(460, 40, 640, 420); slab(420, 40, 460, 190); slab(420, 282, 460, 420);
  // interior stair in the east wing: 8 steps, top flush with the upper floor (z108), 40 wide, 30-deep landing below
  const tops = [12, 26, 40, 52, 66, 80, 92, 104];
  tops.forEach((h, i) => box(420, 170 + 14 * i, 4, 460, 184 + 14 * i, 4 + h, WOOD, 'stair'));
  box(418, 188, 108, 420, 282, 140, GLASS, 'stair rail', glass); box(460, 188, 108, 462, 282, 140, GLASS, 'stair rail', glass); box(420, 188, 108, 460, 190, 140, GLASS, 'stair rail', glass);
  // front balcony rail on the slab
  box(100, 40, 108, 520, 42, 140, GLASS, 'balcony rail', glass);
  // upper volume C (x100..520, y80..320), walls z108..204
  wallX(100, 520, 80, 90, 108, 204, [gx(120, 300, 116, 196), gx(330, 500, 116, 196)]);
  wallX(100, 520, 310, 320, 108, 204, [gx(120, 300, 116, 196), gx(320, 500, 116, 196)]);
  wallY(90, 310, 100, 110, 108, 204, [gy(120, 280, 116, 196)]);
  wallY(90, 310, 510, 520, 108, 204, [gy(120, 280, 116, 196)]);
  box(80, 60, 204, 540, 340, 212, BLACK, 'upper roof');
  // warm soffit lights under both overhangs
  box(-16, 44, 96, 636, 48, 100, LIGHT, 'soffit light'); box(-16, 48, 96, -12, 416, 100, LIGHT, 'soffit light'); box(632, 48, 96, 636, 416, 100, LIGHT, 'soffit light');
  box(84, 62, 200, 536, 66, 204, LIGHT, 'upper soffit'); box(82, 66, 200, 86, 334, 204, LIGHT, 'upper soffit'); box(534, 66, 200, 538, 334, 204, LIGHT, 'upper soffit');
  // pool deck, raised pool with water, loungers
  box(-20, 420, 4, 640, 600, 8, LIME, 'deck');
  box(60, 450, 8, 440, 460, 24, TILE, 'pool wall'); box(60, 550, 8, 440, 560, 24, TILE, 'pool wall'); box(60, 460, 8, 70, 550, 24, TILE, 'pool wall'); box(430, 460, 8, 440, 550, 24, TILE, 'pool wall');
  box(70, 460, 8, 430, 550, 20, WATER, 'pool water', glass);
  for (const x of [480, 540]) { box(x, 480, 8, x + 40, 560, 20, [240, 240, 236], 'lounger'); box(x, 560, 8, x + 40, 580, 36, [240, 240, 236], 'lounger back'); }
  // furniture: ground floor
  box(40, 200, 4, 140, 230, 24, [70, 76, 88], 'sofa'); box(40, 228, 24, 140, 236, 44, [70, 76, 88], 'sofa back'); box(60, 130, 4, 120, 160, 14, WOOD, 'coffee table');
  box(250, 150, 4, 350, 170, 36, LIME2, 'kitchen island'); box(250, 150, 36, 350, 170, 38, BLACK, 'island top'); box(240, 240, 26, 340, 280, 30, WOOD, 'dining table');
  // upper floor: bed, headboard
  box(130, 220, 108, 230, 300, 120, WOOD, 'bed'); box(130, 220, 120, 230, 296, 128, [236, 236, 240], 'mattress'); box(126, 300, 108, 234, 306, 160, WOOD, 'headboard');
  return B.bricks;
}

if (process.argv[1]?.endsWith('cubistmansion.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'cubistmansion.json';
  const bricks = mansion().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`mansion: ${bricks.length} bricks`);
}
