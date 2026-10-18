// Floors on the stud grid (2026-10-17, owner: "the world is on a grid and grids are repetitive and
// there's a stylistic opportunity there. remove gaps in the tiles"): flush tiles, one micro brick
// each, laid so every seam between bricks falls where the colour changes (or between two tiles of
// a varied shade), so the brick joints ARE the pattern. All in game units; a floor fills top-4..top.
//
//   tileFloor(add, rect [x0, y0, x1, y1], top, style, rnd)   add(x0, y0, z0, x1, y1, z1, brick, label)
//   add.wedge(x0, y0, z0, x1, y1, z1, rotation, color) lays a flat side wedge (diagonal pattern)
//
// Styles: checker1 checker2 offset herringbone basketweave diagonal planks carpet concrete; tiled
// styles may get a border band (a stud wide, corner squares in a third colour).

export const ROOM_STYLES = {
  kitchen: ['checker2', 'diagonal', 'herringbone', 'basketweave', 'checker1'],
  bathroom: ['checker1', 'offset', 'diagonal', 'basketweave'],
  living: ['planks', 'carpet', 'herringbone'],
  bedroom: ['carpet', 'planks'],
  hall: ['planks', 'offset', 'checker2'],
  family: ['carpet', 'planks'],
  garage: ['concrete'],
};
const PAL = {
  checker1: [[[236, 236, 232], [70, 110, 150]], [[240, 238, 230], [40, 40, 44]], [[214, 230, 214], [120, 160, 130]]],
  checker2: [[[236, 232, 222], [40, 40, 44]], [[226, 220, 206], [150, 40, 36]], [[236, 236, 236], [70, 110, 160]]],
  offset: [[[244, 244, 240], [228, 232, 232], [236, 238, 236]], [[170, 210, 214], [154, 196, 202], [184, 220, 222]], [[64, 66, 72], [76, 78, 84], [56, 58, 64]]],
  herringbone: [[[196, 112, 76], [176, 98, 66], [210, 128, 88]], [[150, 104, 64], [128, 88, 54], [166, 118, 76]], [[214, 206, 190], [190, 182, 166], [226, 218, 202]]],
  basketweave: [[[230, 226, 214], [200, 194, 180]], [[180, 120, 80], [150, 96, 62]], [[150, 150, 156], [120, 120, 128]]],
  diagonal: [[[236, 232, 222], [52, 52, 56]], [[226, 214, 190], [168, 62, 48]], [[232, 236, 240], [90, 130, 170]]],
  planks: [[[150, 104, 64], [134, 92, 56], [164, 116, 72], [142, 98, 60]], [[188, 150, 106], [172, 136, 94], [200, 162, 116], [180, 142, 100]], [[110, 74, 48], [96, 64, 40], [122, 84, 54], [104, 70, 44]]],
  carpet: [[[150, 140, 120], [142, 132, 112]], [[120, 60, 56], [112, 54, 50]], [[70, 90, 120], [64, 84, 112]], [[110, 120, 92], [102, 112, 86]], [[196, 186, 168], [188, 178, 160]]],
  concrete: [[[168, 166, 160], [158, 156, 150]]],
};
const BORDERS = [[[40, 40, 44], [190, 160, 90]], [[150, 40, 36], [236, 232, 222]], [[60, 90, 130], [236, 236, 236]], [[110, 90, 70], [214, 200, 170]]];
const sh = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

export function pickRoomStyle(room, rnd) {
  const pool = ROOM_STYLES[room];
  return pool[Math.floor(rnd() * pool.length)];
}

export function tileFloor(add, rect, top, style, rnd) {
  const pal = PAL[style][Math.floor(rnd() * PAL[style].length)];
  let [x0, y0, x1, y1] = rect;
  const z0 = top - 4;
  // a border band (tiled styles, about half the rooms) a stud wide, corner squares in a third colour
  if (!['planks', 'concrete', 'carpet'].includes(style) && x1 - x0 >= 60 && y1 - y0 >= 60 && rnd() < 0.55) {
    const [bc, cc] = BORDERS[Math.floor(rnd() * BORDERS.length)];
    for (const [a, b] of [[x0, y0], [x1 - 10, y0], [x0, y1 - 10], [x1 - 10, y1 - 10]]) add(a, b, z0, a + 10, b + 10, top, { color: cc }, 'floor corner');
    // the band in 1-stud tiles alternating two shades (the joints show as a rhythm)
    for (let a = x0 + 10, k = 0; a < x1 - 10; a += 10, k++) { add(a, y0, z0, a + 10, y0 + 10, top, { color: sh(bc, k % 2 ? 0.9 : 1) }, 'floor border'); add(a, y1 - 10, z0, a + 10, y1, top, { color: sh(bc, k % 2 ? 0.9 : 1) }, 'floor border'); }
    for (let b = y0 + 10, k = 0; b < y1 - 10; b += 10, k++) { add(x0, b, z0, x0 + 10, b + 10, top, { color: sh(bc, k % 2 ? 0.9 : 1) }, 'floor border'); add(x1 - 10, b, z0, x1, b + 10, top, { color: sh(bc, k % 2 ? 0.9 : 1) }, 'floor border'); }
    x0 += 10; y0 += 10; x1 -= 10; y1 -= 10;
  }
  // a tile clipped to the field
  const tile = (a0, b0, a1, b1, c, lab = 'floor tile') => {
    const p0 = Math.max(x0, a0), q0 = Math.max(y0, b0), p1 = Math.min(x1, a1), q1 = Math.min(y1, b1);
    if (p1 > p0 && q1 > q0) add(p0, q0, z0, p1, q1, top, { color: c }, lab);
  };
  const par = (a, b) => ((a + b) % 2 + 2) % 2;
  if (style === 'checker1' || style === 'checker2' || style === 'concrete' || style === 'carpet') {
    // carpet = 4-stud carpet tiles in two close shades, concrete = 4-stud slabs
    const s = style === 'checker1' ? 10 : style === 'checker2' ? 20 : 40;
    for (let a = Math.floor(x0 / s) * s; a < x1; a += s) for (let b = Math.floor(y0 / s) * s; b < y1; b += s) tile(a, b, a + s, b + s, pal[par(a / s, b / s)], style);
    return;
  }
  if (style === 'offset') { // 1 x 2 tiles in running bond, three shades so neighbours differ
    for (let b = Math.floor(y0 / 10) * 10, row = 0; b < y1; b += 10, row++)
      for (let a = Math.floor(x0 / 20) * 20 - (row % 2 ? 10 : 0), k = 0; a < x1; a += 20, k++) tile(a, b, a + 20, b + 10, pal[(k + row * 2) % pal.length]);
    return;
  }
  if (style === 'herringbone') { // dominoes by u = (x - y) mod 4: u 0 starts a horizontal one, u 3 a vertical one
    for (let i = Math.floor(x0 / 10) - 1; i * 10 < x1; i++) for (let j = Math.floor(y0 / 10) - 1; j * 10 < y1; j++) {
      const u = ((i - j) % 4 + 4) % 4;
      if (u === 0) tile(i * 10, j * 10, i * 10 + 20, j * 10 + 10, pal[par(i, j) ? 0 : 2]);
      else if (u === 3) tile(i * 10, j * 10, i * 10 + 10, j * 10 + 20, pal[1]);
    }
    return;
  }
  if (style === 'basketweave') { // 2 x 2 blocks of two dominoes, turned block by block
    for (let a = Math.floor(x0 / 20) * 20; a < x1; a += 20) for (let b = Math.floor(y0 / 20) * 20; b < y1; b += 20) {
      if (par(a / 20, b / 20)) { tile(a, b, a + 10, b + 20, pal[0]); tile(a + 10, b, a + 20, b + 20, pal[1]); }
      else { tile(a, b, a + 20, b + 10, pal[1]); tile(a, b + 10, a + 20, b + 20, pal[0]); }
    }
    return;
  }
  if (style === 'planks') { // boards a stud wide along x, 6-12 studs long, joints staggered, shades cycling
    for (let b = Math.floor(y0 / 10) * 10, row = 0; b < y1; b += 10, row++) {
      let a = x0 - (row * 3 % 7) * 10, k = row;
      while (a < x1) { const L = 60 + ((row * 5 + k * 3) % 7) * 10; tile(a, b, a + L, b + 10, pal[k % pal.length]); a += L; k++; }
    }
    return;
  }
  if (style === 'diagonal') { // harlequin: per 2 x 2 cell a plate in one colour and ONE flat wedge (two
    // triangles can't share a cell's box); the diagonals alternate so the triangles round every
    // other corner make diamonds
    const S = 20;
    const ia0 = Math.ceil(x0 / S) * S, ib0 = Math.ceil(y0 / S) * S, ia1 = ia0 + Math.max(0, Math.floor((x1 - ia0) / S)) * S, ib1 = ib0 + Math.max(0, Math.floor((y1 - ib0) / S)) * S;
    for (let a = ia0; a < ia1; a += S) for (let b = ib0; b < ib1; b += S) {
      const i = a / S, j = b / S, t = par(i, j);
      const tris = t === 0 ? [[0, -1, -1], [2, 1, 1]] : [[1, 1, -1], [3, -1, 1]];
      const col = ([, sx, sy]) => { const cx = i + (sx > 0 ? 1 : 0), cy = j + (sy > 0 ? 1 : 0); return pal[(((cx - cy) / 2) % 2 + 2) % 2 === 0 ? 0 : 1]; };
      add(a, b, z0, a + S, b + S, top - 2, { color: col(tris[1]) }, 'floor cell');
      add.wedge(a, b, top - 2, a + S, b + S, top, tris[0][0], col(tris[0]));
    }
    const bc = sh(pal[1], 0.9);
    for (const [p0, q0, p1, q1] of [[x0, y0, x1, ib0], [x0, ib1, x1, y1], [x0, ib0, ia0, ib1], [ia1, ib0, x1, ib1]]) if (p1 > p0 && q1 > q0) add(p0, q0, z0, p1, q1, top, { color: bc }, 'floor edge');
    return;
  }
  throw new Error('tilefloors: unknown style ' + style);
}
