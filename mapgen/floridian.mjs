// руся's wish (2026-11-02, granted by the owner's "everyone gets 1 free build wish"): a 1400 sq ft Floridian concrete home.
// 40 x 35 ft concrete-block ranch (1 ft = 10 units), stucco walls, low terracotta hip roof, columned entry porch,
// screened east lanai, three bedrooms, one bath, open living/kitchen. Front faces -y; origin = front-left corner of the walls.
//   node mapgen/floridian.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000002', name: 'floridian', display_name: 'floridian' };

export function floridian() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`floridian: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const STUCCO = [238, 228, 200], WHITE = [250, 250, 246], GREY = [168, 168, 164], TILE = [212, 202, 182], GLASS = [150, 200, 220];
  const TERRA = [196, 98, 64], TERRA2 = [180, 86, 56], GREEN = [60, 130, 56], GREEN2 = [44, 104, 46], BROWN = [110, 72, 44], WOOD = [150, 108, 64];
  const glass = { material: 'BMC_Glass' };
  const ZB = 4, ZT = 100;       // wall base / top

  // wall along x between y0..y1, openings [{x0,x1,z0,z1,glass?}] (even coordinates)
  function wallX(xa, xb, y0, y1, ops, color = STUCCO) {
    let c = xa;
    for (const o of [...ops].sort((p, q) => p.x0 - q.x0)) {
      if (o.x0 > c) box(c, y0, ZB, o.x0, y1, ZT, color, 'wall');
      if (o.z0 > ZB) box(o.x0, y0, ZB, o.x1, y1, o.z0, color, 'sill');
      if (o.z1 < ZT) box(o.x0, y0, o.z1, o.x1, y1, ZT, color, 'lintel');
      if (o.glass) box(o.x0, (y0 + y1) / 2 - 1, o.z0, o.x1, (y0 + y1) / 2 + 1, o.z1, GLASS, 'window', glass);
      c = o.x1;
    }
    if (xb > c) box(c, y0, ZB, xb, y1, ZT, color, 'wall');
  }
  // wall along y between x0..x1, openings [{y0,y1,z0,z1,glass?}]
  function wallY(ya, yb, x0, x1, ops, color = STUCCO) {
    let c = ya;
    for (const o of [...ops].sort((p, q) => p.y0 - q.y0)) {
      if (o.y0 > c) box(x0, c, ZB, x1, o.y0, ZT, color, 'wall');
      if (o.z0 > ZB) box(x0, o.y0, ZB, x1, o.y1, o.z0, color, 'sill');
      if (o.z1 < ZT) box(x0, o.y0, o.z1, x1, o.y1, ZT, color, 'lintel');
      if (o.glass) box((x0 + x1) / 2 - 1, o.y0, o.z0, (x0 + x1) / 2 + 1, o.y1, o.z1, GLASS, 'window', glass);
      c = o.y1;
    }
    if (yb > c) box(x0, c, ZB, x1, yb, ZT, color, 'wall');
  }
  const win = (a, b) => ({ x0: a, x1: b, y0: a, y1: b, z0: 36, z1: 84, glass: true });
  const door = (a, b) => ({ x0: a, x1: b, y0: a, y1: b, z0: ZB, z1: 84 });

  // slab, extended under the porch; the lanai gets its own
  box(0, 0, 0, 400, 350, ZB, GREY, 'slab');
  box(150, -60, 0, 250, 0, ZB, TILE, 'porch slab');
  box(400, 0, 0, 520, 180, ZB, TILE, 'lanai slab');
  box(180, -200, 0, 220, -60, 2, GREY, 'walk');

  // exterior walls (10 thick)
  wallX(0, 400, 0, 10, [door(180, 220), win(30, 130), win(270, 370)]);
  wallX(0, 400, 340, 350, [win(30, 110), win(290, 370)]);
  wallY(10, 340, 0, 10, [win(60, 120), win(210, 290)]);
  wallY(10, 340, 390, 400, [door(60, 130), win(210, 290)]);
  // interior walls
  wallX(10, 390, 170, 180, [door(50, 90), door(190, 230), door(310, 350)]);
  wallY(180, 340, 150, 160, []);
  wallY(180, 340, 240, 250, []);
  wallX(160, 240, 270, 280, [door(190, 220)]);

  // trim round the front windows and the door
  for (const [a, b] of [[30, 130], [270, 370]]) {
    box(a - 4, -2, 84, b + 4, 0, 88, WHITE, 'trim'); box(a - 4, -2, 32, b + 4, 0, 36, WHITE, 'trim');
    box(a - 4, -2, 36, a, 0, 84, WHITE, 'trim'); box(b, -2, 36, b + 4, 0, 84, WHITE, 'trim');
  }
  box(176, -2, 84, 224, 0, 88, WHITE, 'trim'); box(176, -2, ZB, 180, 0, 84, WHITE, 'trim'); box(220, -2, ZB, 224, 0, 84, WHITE, 'trim');
  box(0, -2, 96, 400, 0, 100, WHITE, 'fascia band');

  // ceiling (tile-grade: no studs below)
  box(10, 10, ZT, 390, 340, ZT + 4, WHITE, 'ceiling');
  box(0, 0, ZT, 400, 10, ZT + 4, STUCCO, 'cap'); box(0, 340, ZT, 400, 350, ZT + 4, STUCCO, 'cap');
  box(0, 10, ZT, 10, 340, ZT + 4, STUCCO, 'cap'); box(390, 10, ZT, 400, 340, ZT + 4, STUCCO, 'cap');

  // porch: two columns and a flat roof beam, then the main eaves meet it
  for (const x of [154, 236]) box(x, -56, ZB, x + 10, -46, ZT - 4, WHITE, 'column');
  box(146, -60, ZT - 4, 258, -30, ZT + 4, WHITE, 'porch beam');
  box(146, -60, ZT + 4, 258, -30, ZT + 8, TERRA2, 'porch roof');

  // hip roof: 11 courses of 6, each inset 20, a micro wedge on each ledge so it reads as one slope
  const X0 = -30, X1 = 430, Y0 = -30, Y1 = 380;
  for (let i = 0; i <= 10; i++) {
    const s = 20 * i, z0 = 104 + 6 * i, c = i % 2 ? TERRA2 : TERRA;
    box(X0 + s, Y0 + s, z0, X1 - s, Y1 - s, z0 + 6, c, `roof course ${i}`);
    if (i === 10) break;
    const n = s + 20, zt = z0 + 6, ex = { color: c };
    B.wedge(X0 + n, Y0 + s, zt, X1 - n, Y0 + n, zt + 6, 0, 1, { asset: 'PB_DefaultMicroWedge', ...ex }, 'roof south');
    B.wedge(X0 + n, Y1 - n, zt, X1 - n, Y1 - s, zt + 6, 0, -1, { asset: 'PB_DefaultMicroWedge', ...ex }, 'roof north');
    B.wedge(X0 + s, Y0 + n, zt, X0 + n, Y1 - n, zt + 6, 1, 0, { asset: 'PB_DefaultMicroWedge', ...ex }, 'roof west');
    B.wedge(X1 - n, Y0 + n, zt, X1 - s, Y1 - n, zt + 6, -1, 0, { asset: 'PB_DefaultMicroWedge', ...ex }, 'roof east');
    for (const [cx, cy] of [[X0 + s, Y0 + s], [X1 - n, Y0 + s], [X0 + s, Y1 - n], [X1 - n, Y1 - n]]) box(cx, cy, zt, cx + 20, cy + 20, zt + 4, c, 'hip corner');
  }

  // screened lanai (east): posts, top beam, glass screens with a gap for the slider door
  box(400, -4, ZT - 4, 524, 184, ZT + 4, WHITE, 'lanai beam'); box(430, -4, ZT + 4, 524, 184, ZT + 8, TERRA2, 'lanai roof');
  for (const [x, y] of [[510, -4], [510, 174], [510, 90], [400, 174], [400, -4]]) box(x, y, ZB, x + 10, y + 10, ZT - 4, WHITE, 'lanai post');
  box(520, -4, ZB, 522, 184, ZT - 4, GLASS, 'screen', glass);
  box(400, 184, ZB, 522, 186, ZT - 4, GLASS, 'screen', glass);
  box(400, -6, ZB, 522, -4, ZT - 4, GLASS, 'screen', glass);

  // furniture
  const FUR = [92, 120, 150], RUG = [168, 70, 60];
  box(40, 130, ZB, 140, 160, 22, FUR, 'sofa'); box(40, 158, 22, 140, 168, 40, FUR, 'sofa back');
  box(60, 80, ZB, 120, 100, 14, WOOD, 'coffee table');
  box(150, 70, 26, 230, 100, 30, WOOD, 'dining table');
  for (const [x, y] of [[154, 74], [222, 74], [154, 92], [222, 92]]) box(x, y, ZB, x + 4, y + 4, 26, WOOD, 'table leg');
  box(280, 12, ZB, 380, 40, 36, WHITE, 'kitchen counter'); box(280, 12, 36, 380, 40, 38, [60, 60, 66], 'counter top');
  box(270, 70, ZB, 350, 90, 36, WHITE, 'island'); box(270, 70, 36, 350, 90, 38, [60, 60, 66], 'island top');
  box(280, 40, ZB, 320, 54, 70, [210, 212, 216], 'fridge');
  // bedrooms: frame, mattress, pillows, rug
  for (const bx of [30, 290]) {
    box(bx, 230, ZB, bx + 80, 330, 14, WOOD, 'bed frame'); box(bx, 230, 14, bx + 80, 326, 22, WHITE, 'mattress');
    box(bx + 10, 300, 22, bx + 36, 324, 28, [230, 230, 236], 'pillow'); box(bx + 44, 300, 22, bx + 70, 324, 28, [230, 230, 236], 'pillow');
    box(bx - 10, 330, 14, bx + 90, 334, 50, WOOD, 'headboard');
    box(bx + 10, 196, ZB, bx + 90, 216, 6, RUG, 'rug');
  }
  // bath
  box(165, 328, ZB, 235, 338, 22, WHITE, 'tub'); box(172, 286, ZB, 186, 302, 20, WHITE, 'toilet'); box(196, 286, ZB, 216, 296, 34, WHITE, 'sink');

  // palms and hedge by the entry
  for (const [px, py] of [[-80, -90], [480, -100], [-70, 400]]) {
    box(px, py, 0, px + 12, py + 12, 40, BROWN, 'palm trunk'); box(px - 2, py - 2, 40, px + 14, py + 14, 80, BROWN, 'palm trunk'); box(px, py, 80, px + 12, py + 12, 120, BROWN, 'palm trunk');
    box(px - 46, py + 2, 120, px + 58, py + 10, 124, GREEN, 'frond'); box(px + 2, py - 46, 124, px + 10, py + 58, 128, GREEN2, 'frond');
    box(px - 30, py + 10, 128, px + 42, py + 14, 132, GREEN2, 'frond'); box(px + 10, py - 30, 132, px + 14, py + 42, 136, GREEN, 'frond');
  }
  box(100, -40, 0, 146, -20, 20, GREEN2, 'hedge'); box(260, -40, 0, 306, -20, 20, GREEN2, 'hedge');
  return B.bricks;
}

if (process.argv[1]?.endsWith('floridian.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'floridian.json';
  const bricks = floridian().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`floridian: ${bricks.length} bricks`);
}
