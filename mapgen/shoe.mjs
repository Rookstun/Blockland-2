// A boot you can live in (owner 2026-11-01: "build me a shoe to live in just raw dog it": plain boxes, no house generator).
// Toe at +x, 400 x 160 footprint from the origin, ankle opening open to the sky at the back, laced roof sloping to the
// toe, a door and eyelet windows in the side wall, a bed, table, stove-lamp inside. Everything in ONE bricks op.
//   node mapgen/shoe.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const [AX, AY, AZ] = process.argv.slice(2, 5).map(Number);
const OWNER = { id: '5e0e0000-0000-4b0b-9a11-00000000005e', name: 'The Shoe', display_name: 'The Shoe' };
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const B = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, m, label = 'b') => { if (x1 > x0 && y1 > y0 && z1 > z0) B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label); };
const LEATHER = [[150, 92, 52], [140, 84, 48], [158, 98, 56]], SOLE = [58, 40, 30], TAN = [190, 140, 86], WHITE = [240, 236, 226];
const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const L = 400, Wd = 160, WALL = 10, FLOOR = 12, SEG = 20;
// roof height by x: flat ankle, then sloping to the toe, a little lower at the very tip
const top = x => x < 110 ? 152 : Math.max(88, 152 - 6 * Math.round((x - 110) / SEG));
// openings in the y = 0 (front) side wall: [x0, x1, z0, z1]
const OPEN = [[180, 220, FLOOR + 4, FLOOR + 76, 'door'], [56, 76, 72, 108, 'win'], [260, 280, 56, 84, 'win']];
const solid = (x0, x1, h) => {                                    // z intervals of a wall segment, openings cut out
  let iv = [[FLOOR, h]];
  for (const [a, b, z0, z1] of OPEN) if (x0 < b && a < x1) iv = iv.flatMap(([lo, hi]) => z1 <= lo || z0 >= hi ? [[lo, hi]] : [[lo, Math.min(hi, z0)], [Math.max(lo, z1), hi]].filter(([p, q]) => q > p));
  return iv;
};
let k = 0;
const col = () => ({ color: LEATHER[k++ % 3] });

// sole + heel
box(-10, -10, 0, L + 10, Wd + 10, FLOOR, { color: SOLE }, 'sole');
// floor boards inside
box(WALL, WALL, FLOOR, L - WALL, Wd - WALL, FLOOR + 4, { asset: TILE, color: [168, 120, 76] }, 'floor');
// side walls, back wall, toe wall
for (let x = 0; x < L; x += SEG) {
  const h = top(x + SEG / 2);
  for (const [y0, y1, front] of [[0, WALL, true], [Wd - WALL, Wd, false]]) {
    for (const [lo, hi] of front ? solid(x, x + SEG, h) : [[FLOOR, h]]) box(x, y0, lo, x + SEG, y1, hi, col(), 'wall');
  }
}
box(0, WALL, FLOOR, WALL, Wd - WALL, 152, col(), 'back');
box(L - WALL, WALL, FLOOR, L, Wd - WALL, 88, col(), 'toe');
// roof from the tongue to the toe, tile underside; the ankle (x 10..110) stays open to the sky
for (let x = 110; x < L; x += SEG) { const h = top(x + SEG / 2); box(x, WALL, h - 4, Math.min(L - WALL, x + SEG), Wd - WALL, h, { asset: TILE, color: x >= 340 ? TAN : LEATHER[0] }, 'roof'); }
box(100, 30, 152, 110, 130, 172, { color: TAN }, 'tongue');
box(100, 30, 172, 110, 130, 176, { color: LEATHER[1] }, 'tongue top');
// laces: white bars across the roof with eyelet studs at the sides
for (let x = 120; x < 260; x += 30) {
  const h = top(x + 3);
  box(x, 24, h, x + 6, Wd - 24, h + 4, { color: WHITE }, 'lace');
  box(x, WALL, h, x + 6, 22, h + 2, { color: [210, 190, 90] }, 'eyelet');
  box(x, Wd - 22, h, x + 6, Wd - WALL, h + 2, { color: [210, 190, 90] }, 'eyelet');
}
// glass in the windows, step at the door
for (const [a, b, z0, z1, kind] of OPEN) if (kind === 'win') box(a, 2, z0, b, 6, z1, GLASS, 'glass');
box(184, -10, FLOOR, 216, 0, FLOOR + 4, { color: SOLE }, 'step');
// inside: bed, pillow, table, stool, lamp
box(WALL + 4, WALL + 4, FLOOR + 4, 110, 64, FLOOR + 22, { color: [120, 80, 50] }, 'bed frame');
box(WALL + 6, WALL + 6, FLOOR + 22, 108, 62, FLOOR + 30, { color: [200, 70, 70] }, 'blanket');
box(WALL + 6, WALL + 6, FLOOR + 30, 40, 62, FLOOR + 36, { color: WHITE }, 'pillow');
box(230, 100, FLOOR + 4, 290, 140, FLOOR + 34, { color: [110, 76, 48] }, 'table');
box(225, 95, FLOOR + 34, 295, 145, FLOOR + 38, { asset: TILE, color: [220, 200, 150] }, 'table top');
box(250, 112, FLOOR + 38, 260, 122, FLOOR + 44, { color: [60, 60, 66] }, 'lamp base');
box(248, 110, FLOOR + 44, 262, 124, FLOOR + 58, { color: [255, 196, 120], material: 'BMC_Glow', material_intensity: 6 }, 'lamp');
box(300, 100, FLOOR + 4, 316, 116, FLOOR + 20, { color: [90, 60, 40] }, 'stool');
box(L - 60, WALL + 4, FLOOR + 4, L - 14, 50, FLOOR + 40, { color: [70, 70, 76] }, 'stove');
box(L - 56, WALL + 8, FLOOR + 40, L - 18, 46, FLOOR + 44, { color: [30, 30, 34] }, 'stove top');

console.error(`${B.bricks.length} bricks, dropped ${B.dropped.length}${B.dropped.slice(0, 4).map(d => ', ' + d).join('')}`);
const bricks = B.bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + AX, b.position[1] + AY, b.position[2] + AZ] }));
fs.writeFileSync(process.argv[5], JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
