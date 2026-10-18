// Tiled floors that read as tiles (2026-10-17, owner: "floor tiles work like tiles ... 1x1 or 2x2
// or 1x2 by 1x2+1 or diagonal wedges or herringbone or bevel or carpet"): every tile is its own
// micro brick inset from a darker grout bed, so the joints show. All in game units.
//
//   tileFloor(add, rect [x0, y0, x1, y1], top z, style, rnd)   add(x0, y0, z0, x1, y1, z1, brick, label)
//   addWedge(...) is passed in add.wedge for the diagonal (harlequin) pattern
//
// The floor fills z top-4 .. top (top-4 .. top-2 grout bed, tiles top-2 .. top); bevel tiles
// carry a lighter raised face (top .. top+2). Styles: grid1 grid2 checker offset herringbone
// diagonal bevel planks carpet concrete. ROOM_STYLES = the pools per room kind.

export const ROOM_STYLES = {
  kitchen: ['checker', 'diagonal', 'grid2', 'bevel', 'herringbone'],
  bathroom: ['grid1', 'offset', 'diagonal', 'bevel', 'checker'],
  living: ['planks', 'carpet', 'herringbone'],
  bedroom: ['carpet', 'planks'],
  hall: ['planks', 'offset'],
  family: ['carpet', 'planks'],
  garage: ['concrete'],
};
// colour sets per style: [tile colours..., grout]
const PAL = {
  grid1: [[[236, 236, 232], [222, 226, 230]], [[150, 196, 210], [236, 240, 240]], [[214, 230, 214], [244, 244, 238]]],
  grid2: [[[214, 204, 186], [200, 190, 172]], [[180, 180, 184], [196, 196, 200]], [[226, 216, 196], [210, 200, 180]]],
  checker: [[[236, 232, 222], [40, 40, 44]], [[226, 220, 206], [150, 40, 36]], [[236, 236, 236], [70, 110, 160]]],
  offset: [[[244, 244, 240], [232, 236, 236]], [[170, 210, 214], [190, 224, 226]], [[64, 66, 72], [80, 82, 88]]],
  herringbone: [[[196, 112, 76], [184, 104, 70], [206, 124, 86]], [[150, 104, 64], [136, 94, 58], [162, 114, 72]]],
  diagonal: [[[236, 232, 222], [52, 52, 56]], [[226, 214, 190], [168, 62, 48]], [[232, 236, 240], [90, 130, 170]]],
  bevel: [[[238, 238, 234]], [[176, 206, 196]], [[210, 196, 170]]],
  planks: [[[150, 104, 64], [138, 94, 58], [160, 114, 72]], [[188, 150, 106], [176, 138, 96], [198, 160, 114]], [[110, 74, 48], [100, 66, 42], [120, 82, 52]]],
  carpet: [[[150, 140, 120]], [[120, 60, 56]], [[70, 90, 120]], [[110, 120, 92]], [[196, 186, 168]]],
  concrete: [[[168, 166, 160], [160, 158, 152], [174, 172, 166]]],
};
const GROUT = { grid1: [190, 192, 194], grid2: [120, 116, 110], checker: [150, 148, 144], offset: [170, 172, 172], herringbone: [96, 84, 74], diagonal: [140, 136, 130], bevel: [150, 150, 148], planks: [62, 44, 30], concrete: [120, 118, 114] };
const TILE_C = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

export function pickRoomStyle(room, rnd) {
  const pool = ROOM_STYLES[room];
  return pool[Math.floor(rnd() * pool.length)];
}

export function tileFloor(add, [x0, y0, x1, y1], top, style, rnd) {
  const pal = PAL[style][Math.floor(rnd() * PAL[style].length)];
  const shadeOf = c => TILE_C(c, [1, 0.96, 1.03, 0.98][Math.floor(rnd() * 4)]);
  const bed = (c, z0 = top - 4, z1 = top - 2) => add(x0, y0, z0, x1, y1, z1, { color: c }, 'floor bed');
  // a tile clipped to the rect; the joint (g = 2, the grout showing) is on its +x / +y side so
  // every piece stays on the 2-unit micro grid
  const tile = (a0, b0, a1, b1, c, g = 2, z0 = top - 2, z1 = top) => {
    const p0 = Math.max(x0, a0), q0 = Math.max(y0, b0), p1 = Math.min(x1, a1 - g), q1 = Math.min(y1, b1 - g);
    if (p1 > p0 && q1 > q0) add(p0, q0, z0, p1, q1, z1, { color: c }, 'floor tile');
  };
  if (style === 'carpet') { // a border band a stud wide, the field inside, both a little pile-shaded
    const c = pal[0], b = TILE_C(c, 0.72);
    add(x0, y0, top - 4, x1, y1, top - 2, { color: TILE_C(c, 0.6) }, 'carpet pad');
    add(x0, y0, top - 2, x1, y0 + 10, top, { color: b }, 'carpet border');
    add(x0, y1 - 10, top - 2, x1, y1, top, { color: b }, 'carpet border');
    add(x0, y0 + 10, top - 2, x0 + 10, y1 - 10, top, { color: b }, 'carpet border');
    add(x1 - 10, y0 + 10, top - 2, x1, y1 - 10, top, { color: b }, 'carpet border');
    for (let x = x0 + 10; x < x1 - 10; x += 60) for (let y = y0 + 10; y < y1 - 10; y += 60) add(x, y, top - 2, Math.min(x1 - 10, x + 60), Math.min(y1 - 10, y + 60), top, { color: c }, 'carpet');
    return;
  }
  if (style !== 'diagonal') bed(GROUT[style]);
  if (style === 'grid1' || style === 'grid2' || style === 'checker' || style === 'concrete' || style === 'bevel') {
    const s = style === 'grid1' ? 10 : style === 'concrete' ? 40 : 20;
    for (let a = Math.floor(x0 / s) * s; a < x1; a += s) for (let b = Math.floor(y0 / s) * s; b < y1; b += s) {
      const par = ((a / s + b / s) % 2 + 2) % 2;
      const c = style === 'checker' ? pal[par] : style === 'grid1' ? pal[(Math.floor(rnd() * 9) === 0) ? 1 : 0] : shadeOf(pal[par % pal.length]);
      if (style === 'bevel') { tile(a, b, a + s, b + s, TILE_C(c, 0.86)); tile(a + 4, b + 4, a + s - 2, b + s - 2, c, 2, top, top + 2); }
      else tile(a, b, a + s, b + s, c);
    }
    return;
  }
  if (style === 'offset') { // 1 x 2 subway tiles, each row shifted half a tile
    for (let b = Math.floor(y0 / 10) * 10, row = 0; b < y1; b += 10, row++)
      for (let a = Math.floor(x0 / 20) * 20 - (row % 2 ? 10 : 0); a < x1; a += 20) tile(a, b, a + 20, b + 10, shadeOf(pal[Math.floor(rnd() * pal.length)]));
    return;
  }
  if (style === 'planks') { // boards a stud wide along x, 6-12 studs long, joints staggered
    for (let b = y0; b < y1; b += 10) {
      let a = x0 - Math.floor(rnd() * 6) * 10;
      while (a < x1) { const L = 60 + Math.floor(rnd() * 7) * 10; tile(a, b, a + L, b + 10, shadeOf(pal[Math.floor(rnd() * pal.length)])); a += L; }
    }
    return;
  }
  if (style === 'herringbone') { // 1 x 2 bricks in zigzag: per 2 x 2 block, a vertical then a horizontal pair, offset each row
    for (let b = Math.floor(y0 / 20) * 20, row = 0; b < y1; b += 20, row++)
      for (let a = Math.floor(x0 / 20) * 20, col = 0; a < x1; a += 20, col++) {
        const c = () => shadeOf(pal[Math.floor(rnd() * pal.length)]);
        if ((col + row) % 2) { tile(a, b, a + 10, b + 20, c()); tile(a + 10, b, a + 20, b + 20, c()); }
        else { tile(a, b, a + 20, b + 10, c()); tile(a, b + 10, a + 20, b + 20, c()); }
      }
    return;
  }
  if (style === 'diagonal') { // harlequin: each 2 x 2 cell cut on a diagonal into two flat micro wedges,
    // diagonals alternating so the triangles round every other corner make a diamond
    const S = 20;
    for (let a = Math.ceil(x0 / S) * S; a + S <= x1; a += S) for (let b = Math.ceil(y0 / S) * S; b + S <= y1; b += S) {
      const i = a / S, j = b / S, t = ((i + j) % 2 + 2) % 2;
      // the two triangles: rotation r of a native side wedge (solid where local x + y <= 0) owns one corner
      const tris = t === 0 ? [[0, -1, -1], [2, 1, 1]] : [[1, 1, -1], [3, -1, 1]];
      // two triangles can't share a cell's box: the cell is a plate in the second triangle's colour
      // (top-4 .. top-2) with the first triangle (a flat wedge) on it, a 2-unit step between them
      const col = ([, sx, sy]) => { const cx = i + (sx > 0 ? 1 : 0), cy = j + (sy > 0 ? 1 : 0); return pal[(((cx - cy) / 2) % 2 + 2) % 2 === 0 ? 0 : 1] ?? pal[0]; };
      add(a, b, top - 4, a + S, b + S, top - 2, { color: col(tris[1]) }, 'floor cell');
      add.wedge(a, b, top - 2, a + S, b + S, top, tris[0][0], col(tris[0]));
    }
    // a plain border where the 2-stud cells don't reach the walls
    const ia0 = Math.ceil(x0 / S) * S, ib0 = Math.ceil(y0 / S) * S, ia1 = ia0 + Math.floor((x1 - ia0) / S) * S, ib1 = ib0 + Math.floor((y1 - ib0) / S) * S;
    const bc = TILE_C(pal[1] ?? pal[0], 0.9);
    for (const [p0, q0, p1, q1] of [[x0, y0, x1, ib0], [x0, ib1, x1, y1], [x0, ib0, ia0, ib1], [ia1, ib0, x1, ib1]]) if (p1 > p0 && q1 > q0) add(p0, q0, top - 4, p1, q1, top, { color: bc }, 'floor border');
    return;
  }
  throw new Error('tilefloors: unknown style ' + style);
}
