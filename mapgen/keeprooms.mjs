// Surface keep rooms (2026-10-25, owner: "all the other rooms have no other
// features. They're flat, they're boring", "none of the other rooms retain the
// tiles"). Every room and corridor tile gets a smooth-tile flagstone floor (7 x 7
// flags in two tones, darker joints on the wall lines); every room ceiling
// beams, wall sconces and furniture by its kind:
//   barracks  beds along the walls (frame, mattress, pillow, headboard), foot chests
//   dining    a long table with benches, candles
//   library   bookcases along the walls (books of every colour), a reading table
//   shrine    an altar on the far wall, candles, a glowing relic, a runner, kneelers
//   armory    weapon racks with swords, shields, a training dummy
//   store     crates and barrels in the corners, sacks
// Furniture never goes in front of a doorway (4 studs clear) or on the room's
// spawner; each piece is a group the caller adds only where it fits.
// Keep-frame studs; z units over the paving top; heights for a 60-tall player
// (tables 24, benches 12, beds 16, shelves 72).
import { GOLD, IRON, LIGHT, minus } from './greathall.mjs';
const MB = 'PB_DefaultMicroBrick', SMOOTH = 'PB_DefaultSmoothTile';
const FL = 4;
const WOOD = [[110, 72, 44], [96, 62, 38], [124, 84, 52]], DARKWOOD = [70, 46, 30];
const CLOTH = [[150, 40, 40], [40, 70, 140], [60, 110, 60], [140, 110, 50], [110, 50, 120]];
const BOOK = [[150, 40, 40], [40, 70, 140], [60, 110, 60], [160, 130, 60], [90, 50, 110], [120, 80, 50], [40, 40, 40], [180, 170, 150]];
export const KINDS = ['barracks', 'dining', 'library', 'shrine', 'armory', 'store'];

// tiles = [{ tx, ty, room }] non-solid grid tiles (room -1 = corridor), sh = [shx, shy],
// TILE studs, wallAt(x, y) course-0 wall test (keep frame), skip(x0, y0, x1, y1) -> rects to leave bare
export function floors({ tiles, sh: [shx, shy], TILE, wallAt, keepOut, T, rng }) {
  const out = [];
  const pal = new Map();
  const tone = room => {
    if (!pal.has(room)) {
      const f = T.floor ?? { border: T.base, a: T.trim, b: T.mould };
      const opts = [[f.a, f.b, f.border], [f.b, f.a, f.border], [T.trim, f.a, T.dado], [f.a, T.mould, f.border]];
      pal.set(room, opts[Math.floor(rng() * opts.length)]);
    }
    return pal.get(room);
  };
  const add = (x0, y0, x1, y1, color) => { for (const r of keepOut.reduce((rs, k) => rs.flatMap(q => minus(q, k)), [[x0, y0, x1, y1]])) out.push([...r, 0, FL, { asset: SMOOTH, color }]); };
  for (const { tx, ty, room } of tiles) {
    const X = shx + tx * TILE, Y = shy + ty * TILE, [a, b, joint] = tone(room);
    add(X + 1, Y + 1, X + TILE, Y + TILE, (tx + ty) % 2 ? a : b);
    // the wall lines: free runs (doorways, open joins) get joint-coloured strips
    const strip = (cells, mk) => { let s = null; cells.forEach((free, i) => { if (free && s === null) s = i; if ((!free || i === cells.length - 1) && s !== null) { const e = free ? i + 1 : i; mk(s, e); s = null; } }); };
    strip(Array.from({ length: TILE - 1 }, (_, i) => !wallAt(X, Y + 1 + i)), (s, e) => add(X, Y + 1 + s, X + 1, Y + 1 + e, joint));
    strip(Array.from({ length: TILE - 1 }, (_, i) => !wallAt(X + 1 + i, Y)), (s, e) => add(X + 1 + s, Y, X + 1 + e, Y + 1, joint));
    if (!wallAt(X, Y)) add(X, Y, X + 1, Y + 1, joint);
  }
  return out;
}

// one room: R interior [x0, y0, x1, y1) keep frame, doors [{ side: 'S'|'N'|'W'|'E', a0, a1 }]
// (spans on R's walls), kind, top (ceiling underside), centre spawn [x, y] or null
// -> groups (arrays of put() argument lists)
export function furnish({ R, doors, kind, top, T, rng, spawn, hole }) {
  const groups = [];
  const [x0, y0, x1, y1] = R, W = x1 - x0, D = y1 - y0;
  const reserved = [];
  for (const d of doors) {
    const w0 = d.a0 - 2, w1 = d.a1 + 2;
    reserved.push(d.side === 'S' ? [w0, y0, w1, y0 + 5] : d.side === 'N' ? [w0, y1 - 5, w1, y1] : d.side === 'W' ? [x0, w0, x0 + 5, w1] : [x1 - 5, w0, x1, w1]);
  }
  if (spawn) reserved.push([spawn[0] - 2, spawn[1] - 2, spawn[0] + 2, spawn[1] + 2]);
  if (hole) reserved.push(hole);
  const hits = (a, b, c, d) => reserved.some(([p, q, r, s]) => a < r && p < c && b < s && q < d);
  const G = (list, foot) => { if (foot && hits(...foot)) { if (process.env.KEEPDBG) console.error("  furnish skip", kind, foot.map(v => +v.toFixed(1)).join(","), "reserved", reserved.filter(([p, q, r, s]) => foot[0] < r && p < foot[2] && foot[1] < s && q < foot[3]).map(r => r.join(",")).join(" ")); return false; } groups.push(list); if (foot) reserved.push(foot); return true; };
  const wood = () => WOOD[Math.floor(rng() * WOOD.length)];
  // walls as frames: o(along, depth) -> keep x, y for each side
  const walls = [
    { side: 'S', len: W, at: (a, d) => [x0 + a, y0 + d] }, { side: 'N', len: W, at: (a, d) => [x0 + a, y1 - d] },
    { side: 'W', len: D, at: (a, d) => [x0 + d, y0 + a] }, { side: 'E', len: D, at: (a, d) => [x1 - d, y0 + a] },
  ];
  const wbox = (w, a0, d0, a1, d1, z0, z1, b) => { const [p, q] = w.at(a0, d0), [r, s] = w.at(a1, d1); return [Math.min(p, r), Math.min(q, s), Math.max(p, r), Math.max(q, s), z0, z1, b]; };
  const foot = list => [Math.min(...list.map(l => l[0])), Math.min(...list.map(l => l[1])), Math.max(...list.map(l => l[2])), Math.max(...list.map(l => l[3]))];
  // ceiling beams across the shorter span, every 4 studs, clear of the lamp in the middle
  const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2;
  let cx = cx0, cy = cy0;
  if (W >= D) { for (let x = x0 + 3; x + 1 <= x1 - 2; x += 4) if (Math.abs(x + 0.5 - cx0) > 2) groups.push([[x, y0, x + 1, y1, top - 8, top, { asset: MB, color: DARKWOOD }]]); }
  else for (let y = y0 + 3; y + 1 <= y1 - 2; y += 4) if (Math.abs(y + 0.5 - cy0) > 2) groups.push([[x0, y, x1, y + 1, top - 8, top, { asset: MB, color: DARKWOOD }]]);
  // sconces every ~9 studs along each wall, clear of doorways: bracket, cup, flame, light
  for (const w of walls) for (let a = 4; a <= w.len - 4; a += 9) {
    const [px, py] = w.at(a, 0);
    if (doors.some(d => d.side === w.side && Math.abs((w.side === 'S' || w.side === 'N' ? px : py) - (d.a0 + d.a1) / 2) < 5)) continue;
    groups.push([wbox(w, a - 0.2, 0, a + 0.2, 0.6, 96, 104, { ...IRON }), wbox(w, a - 0.4, 0.4, a + 0.4, 1, 104, 108, { asset: MB, color: GOLD }),
      wbox(w, a - 0.2, 0.5, a + 0.2, 0.9, 108, 116, { asset: MB, color: [255, 170, 80], material: 'BMC_Glow', material_intensity: 8, components: [LIGHT([255, 180, 110], 300, 3)] })]);
  }
  const alongWalls = (step, depth, make) => { for (const w of walls) for (let a = 2; a + step <= w.len - 2; a += step) { const l = make(w, a); G(l, foot(l)); } };
  if (kind === 'barracks') {
    alongWalls(5, 6, (w, a) => {
      const c = CLOTH[Math.floor(rng() * CLOTH.length)], wd = wood();
      return [wbox(w, a, 0, a + 3, 5.5, FL, FL + 8, { asset: MB, color: wd }), wbox(w, a + 0.2, 0.4, a + 2.8, 5.3, FL + 8, FL + 14, { asset: MB, color: c }),
        wbox(w, a + 0.4, 0.4, a + 2.6, 1.4, FL + 14, FL + 18, { asset: MB, color: [230, 226, 214] }), wbox(w, a, 0, a + 3, 0.4, FL + 8, FL + 30, { asset: MB, color: wd }),
        wbox(w, a + 0.4, 5.6, a + 2.6, 7, FL, FL + 10, { asset: MB, color: DARKWOOD })];
    });
  } else if (kind === 'library') {
    alongWalls(5, 2, (w, a) => {
      const l = [wbox(w, a, 0, a + 0.4, 1.6, FL, FL + 72, { asset: MB, color: DARKWOOD }), wbox(w, a + 3.6, 0, a + 4, 1.6, FL, FL + 72, { asset: MB, color: DARKWOOD }),
        wbox(w, a + 0.4, 0, a + 3.6, 0.2, FL, FL + 72, { asset: MB, color: WOOD[1] })];
      for (const z of [0, 18, 36, 54]) {
        l.push(wbox(w, a + 0.4, 0.2, a + 3.6, 1.6, FL + z, FL + z + 2, { asset: MB, color: DARKWOOD }));
        let b = a + 0.4;
        while (b < a + 3.4) { const t = 0.2 + Math.floor(rng() * 2) * 0.2, h = 10 + 2 * Math.floor(rng() * 3); if (b + t > a + 3.6) break; l.push(wbox(w, b, 0.4, b + t, 1.4, FL + z + 2, FL + z + 2 + h, { asset: MB, color: BOOK[Math.floor(rng() * BOOK.length)] })); b += t; }
      }
      l.push(wbox(w, a, 0, a + 4, 1.6, FL + 72, FL + 74, { asset: MB, color: DARKWOOD }));
      return l;
    });
  }
  const centre = list => G(list, foot(list));
  const table = (tx0, ty0, tx1, ty1, zt) => {
    const l = [[tx0, ty0, tx1, ty1, zt - 2, zt, { asset: MB, color: wood() }]];
    for (const [a, b] of [[tx0 + 0.2, ty0 + 0.2], [tx1 - 0.6, ty0 + 0.2], [tx0 + 0.2, ty1 - 0.6], [tx1 - 0.6, ty1 - 0.6]]) l.push([a, b, a + 0.4, b + 0.4, FL, zt - 2, { asset: MB, color: DARKWOOD }]);
    return l;
  };
  // centre pieces stand off the spawner: the first offset across the room that fits
  const OFFS = (W >= D ? [[0, 4.5], [0, -4.5], [0, 7], [0, -7], [5, 4.5], [-5, -4.5]] : [[4.5, 0], [-4.5, 0], [7, 0], [-7, 0], [4.5, 5], [-4.5, -5]]);
  const place = make => { for (const [dx, dy] of OFFS) { cx = cx0 + dx; cy = cy0 + dy; if (centre(make())) return true; } return false; };
  if (kind === 'dining' && W >= 10 && D >= 10) place(() => {
    const along = W >= D, L = (along ? W : D) - 10;
    const [t0, t1] = along ? [cx - L / 2, cy - 1.5] : [cx - 1.5, cy - L / 2], [t2, t3] = along ? [cx + L / 2, cy + 1.5] : [cx + 1.5, cy + L / 2];
    const l = table(t0, t1, t2, t3, FL + 24);
    for (let s = 0; s < 2; s++) {
      const bx = along ? [t0 + 0.6, s ? t3 + 0.6 : t1 - 1.8, t2 - 0.6, s ? t3 + 1.8 : t1 - 0.6] : [s ? t2 + 0.6 : t0 - 1.8, t1 + 0.6, s ? t2 + 1.8 : t0 - 0.6, t3 - 0.6];
      l.push([...bx, FL + 10, FL + 12, { asset: MB, color: wood() }]);
      for (const e of [0.2, (along ? bx[2] - bx[0] : bx[3] - bx[1]) - 0.6]) l.push(along ? [bx[0] + e, bx[1] + 0.4, bx[0] + e + 0.4, bx[3] - 0.4, FL, FL + 10, { asset: MB, color: DARKWOOD }] : [bx[0] + 0.4, bx[1] + e, bx[2] - 0.4, bx[1] + e + 0.4, FL, FL + 10, { asset: MB, color: DARKWOOD }]);
    }
    for (let k = 2; k < L - 1; k += 4) { const [a, b] = along ? [t0 + k, cy] : [cx, t1 + k]; l.push([a - 0.2, b - 0.2, a + 0.2, b + 0.2, FL + 24, FL + 32, { asset: MB, color: [236, 228, 210] }], [a - 0.2, b - 0.2, a + 0.2, b + 0.2, FL + 32, FL + 36, { asset: MB, color: [255, 200, 110], material: 'BMC_Glow', material_intensity: 10, ...(k === 2 ? { components: [LIGHT([255, 190, 120], 360, 3)] } : {}) }]); }
    return l;
  });
  if (kind === 'library' && W >= 10 && D >= 10) place(() => {
    const l = table(cx - 2, cy - 1.5, cx + 2, cy + 1.5, FL + 24);
    l.push([cx - 0.8, cy - 0.6, cx + 0.8, cy + 0.6, FL + 24, FL + 26, { asset: MB, color: [200, 190, 160] }]);
    l.push([cx + 1.2, cy - 1, cx + 1.6, cy - 0.6, FL + 24, FL + 32, { asset: MB, color: [255, 200, 110], material: 'BMC_Glow', material_intensity: 10, components: [LIGHT([255, 190, 120], 300, 3)] }]);
    return l;
  });
  // the far wall from the first door
  const far = (() => { const d = doors[0]?.side; return walls.find(w => w.side === ({ S: 'N', N: 'S', W: 'E', E: 'W' }[d] ?? 'N')); })();
  if (kind === 'shrine') {
    const order = [far, ...walls.filter(w => w !== far)];
    for (const wall of order) {
      const a = wall.len / 2, depth = wall.side === 'S' || wall.side === 'N' ? D : W;
      const l = [wbox(wall, a - 3, 0, a + 3, 3, FL, FL + 30, { asset: MB, color: T.trim }), wbox(wall, a - 3.2, 0, a + 3.2, 3.2, FL + 30, FL + 34, { asset: MB, color: T.mould }),
        wbox(wall, a - 2.6, 3.2, a + 2.6, 3.4, FL + 14, FL + 34, { asset: MB, color: [140, 30, 40] }),
        wbox(wall, a - 0.6, 0.8, a + 0.6, 2, FL + 34, FL + 46, { asset: MB, color: GOLD, material: 'BMC_Metallic' }),
        wbox(wall, a - 0.4, 1, a + 0.4, 1.8, FL + 46, FL + 54, { asset: MB, color: T.glow, material: 'BMC_Glow', material_intensity: 10, components: [LIGHT(T.glow, 420, 4)] })];
      for (const sg of [-2.4, 2.4]) l.push(wbox(wall, a + sg - 0.2, 1, a + sg + 0.2, 1.4, FL + 34, FL + 42, { asset: MB, color: [236, 228, 210] }), wbox(wall, a + sg - 0.2, 1, a + sg + 0.2, 1.4, FL + 42, FL + 46, { asset: MB, color: [255, 200, 110], material: 'BMC_Glow', material_intensity: 10 }));
      if (!G(l, foot(l))) continue;
      groups.push([wbox(wall, a - 1.5, 5, a + 1.5, Math.min(depth - 6, 14), FL, FL + 2, { asset: MB, color: [128, 34, 30] })]);
      for (const sg of [-1, 1]) { const k = wbox(wall, a + sg * 3 - 1, 7, a + sg * 3 + 1, 8.4, FL, FL + 8, { asset: MB, color: [110, 40, 40] }); G([k], foot([k])); }
      break;
    }
  }
  if (kind === 'armory') {
    alongWalls(6, 2, (w, a) => {
      const l = [wbox(w, a, 0, a + 4, 0.6, FL + 20, FL + 24, { asset: MB, color: DARKWOOD }), wbox(w, a, 0, a + 4, 0.6, FL + 56, FL + 60, { asset: MB, color: DARKWOOD })];
      for (let s = 0; s < 3; s++) { const b = a + 0.8 + s * 1.2; l.push(wbox(w, b, 0.8, b + 0.2, 1, FL + 30, FL + 70, { asset: MB, color: [176, 180, 186], material: 'BMC_Metallic' }), wbox(w, b - 0.4, 0.6, b + 0.6, 1.2, FL + 26, FL + 30, { asset: MB, color: GOLD }), wbox(w, b, 0.8, b + 0.2, 1, FL + 14, FL + 26, { asset: MB, color: DARKWOOD })); }
      return l;
    });
    place(() => [[cx - 0.2, cy + 3 - 0.2, cx + 0.2, cy + 3 + 0.2, FL, FL + 30, { asset: MB, color: DARKWOOD }], [cx - 0.8, cy + 3 - 0.5, cx + 0.8, cy + 3 + 0.5, FL + 30, FL + 52, { asset: MB, color: [190, 170, 120] }],
      [cx - 2, cy + 3 - 0.2, cx + 2, cy + 3 + 0.2, FL + 44, FL + 48, { asset: MB, color: DARKWOOD }], [cx - 0.5, cy + 3 - 0.5, cx + 0.5, cy + 3 + 0.5, FL + 52, FL + 62, { asset: MB, color: [190, 170, 120] }]]);
  }
  if (kind === 'store' || kind === 'armory' || kind === 'barracks') {
    // crates and barrels in the corners
    for (const [ax, ay, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      if (kind !== 'store' && rng() < 0.5) continue;
      const crate = (p, q, s, z0) => { const [a, b] = [Math.min(p, p + sx * s), Math.min(q, q + sy * s)]; return [[a, b, a + s, b + s, z0, z0 + 10 * s, { asset: MB, color: wood() }], [a - 0.2, b + s / 2 - 0.2, a + s + 0.2, b + s / 2 + 0.2, z0 + 2, z0 + 10 * s - 2, { asset: MB, color: DARKWOOD }]]; };
      const l = [...crate(ax + sx * 0.4, ay + sy * 0.4, 2.4, FL)];
      if (rng() < 0.6) l.push(...crate(ax + sx * 0.8, ay + sy * 0.8, 1.6, FL + 24));
      const bx = ax + sx * 3.6, by = ay + sy * 0.6, [a, b] = [Math.min(bx, bx + sx * 2), Math.min(by, by + sy * 2)];
      l.push([a, b, a + 2, b + 2, FL, FL + 28, { asset: MB, color: WOOD[2] }], [a - 0.2, b - 0.2, a + 2.2, b + 2.2, FL + 6, FL + 8, { ...IRON }], [a - 0.2, b - 0.2, a + 2.2, b + 2.2, FL + 20, FL + 22, { ...IRON }]);
      G(l, foot(l));
    }
    if (kind === 'store') for (let n = 0; n < 4; n++) {
      const a = x0 + 4 + rng() * (W - 8), b = y0 + 4 + rng() * (D - 8), ax = Math.round(a * 5) / 5, ay = Math.round(b * 5) / 5;
      const l = [[ax, ay, ax + 1.6, ay + 1.2, FL, FL + 14, { asset: MB, color: [196, 176, 130] }], [ax + 0.4, ay + 0.2, ax + 1.2, ay + 1, FL + 14, FL + 18, { asset: MB, color: [176, 156, 110] }]];
      G(l, foot(l));
    }
  }
  // banners midway between the sconces (last: wherever furniture left the wall free): a gold rod, cloth, a swallowtail
  const BAN = [T.frieze?.[1] ?? [60, 90, 140], T.frieze?.[2] ?? [140, 50, 40]];
  for (const w of walls) for (let a = 8.5; a <= w.len - 4; a += 9) {
    const [px, py] = w.at(a, 0), c = BAN[Math.floor(rng() * 2)];
    if (doors.some(d => d.side === w.side && Math.abs((w.side === 'S' || w.side === 'N' ? px : py) - (d.a0 + d.a1) / 2) < 6)) continue;
    groups.push([wbox(w, a - 1.4, 0, a + 1.4, 0.4, 112, 114, { asset: MB, color: GOLD }), wbox(w, a - 1.2, 0, a + 1.2, 0.2, 56, 112, { asset: MB, color: c }),
      wbox(w, a - 1.2, 0, a - 0.2, 0.2, 48, 56, { asset: MB, color: c }), wbox(w, a + 0.2, 0, a + 1.2, 0.2, 48, 56, { asset: MB, color: c }),
      wbox(w, a - 0.4, 0.2, a + 0.4, 0.4, 76, 92, { asset: MB, color: GOLD })]);
  }
  return groups;
}
