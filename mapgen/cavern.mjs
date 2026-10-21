// Caverns (2026-10-16, owner: "the limestone caves look like crap. more wedges, natural geometry,
// gems that you can mine that give you money, high ceilings, cavern").
//
// A cave is a set of nodes (tunnel beads along branching worms + lobed caverns with domes up to
// ~40 bricks high). The nodes define two height fields on a 2 x 2-stud tile grid (corners every TS
// units): a floor (flat in the middle, curling up at the walls) and a ceiling (a dome, drippy
// noise). mapgen carves its coarse voxels (4 x 4 studs x 1 brick) round the air, then per tile:
//  - floor: micro brick fill up to the tile's lowest corner + one cap to the highest (micro wedge /
//    wedge corner / outer corner by the corner pattern: the ride surface's pieces), so the floor and
//    the walls rising out of it are continuous slopes, never 1-brick steps
//  - ceiling: the same, hanging from the carved ceiling, caps turned upside down
//  - rock tiles in carved cells (the rim): filled only where some air can see them
// Fills are split on limestone strata (horizontal bands) and merged into rectangles; nothing is
// built where no air can see it. Formations: wedge spikes (a column, a skirt ring of wedges, a
// four-wedge pyramid tip) as stalactites, stalagmites and columns, big ones in the caverns. Gems
// (pots/gemgen.mjs prefabs) on flat floor near the walls, rarer the deeper you go; warm uplights.
import { orientFor, ORIENT } from './orient.mjs';

export const TS = 10; // tile size, units (1 stud: 2-stud tiles left flat slab walls on the steep dome sides)
const SOFT = { soft: 1 }; // give way to anything else at output (mapgen drops soft pieces that overlap)

// half a turn about x: a cap or tip upside down (y mirrored, so callers pick y-mirrored patterns)
export const FLIP = o => {
  const c = o.direction * 4 + o.rotation, ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const want = ax.map(v => { const [a, b, d] = ORIENT[c](v); return [a + 0, -b + 0, -d + 0].join(); });
  const c2 = ORIENT.findIndex(f => ax.every((v, i) => f(v).map(q => q + 0).join() === want[i]));
  return { ...o, direction: c2 >> 2, rotation: c2 & 3 };
};

/**
 * Nodes of one cave from its door.
 * ctx: { CELL, VZ, X0, Y0, rnd() in [0,1), roofAt(wx, wy) world z (-Infinity = forbidden), floorMin,
 *        doorH (door floor world z), doorHu, len (main worm steps), branch, cavern (chance per step) }
 * returns { nodes: [{ x, y, zf, r, hu, door }], caverns: [{ x, y, zf, R }] }
 */
export function planCave(s, ctx) {
  const { CELL, X0, Y0, rnd, roofAt, floorMin } = ctx;
  const nodes = [], caverns = [];
  const STEP = 32;
  // lowest roof over a disc (samples every ~CELL)
  const roofOver = (x, y, r) => {
    let m = roofAt(x, y);
    const n = Math.max(1, Math.ceil(r / CELL));
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
      if (a * a + b * b > n * n) continue;
      m = Math.min(m, roofAt(x + (a * r) / n, y + (b * r) / n));
    }
    return m;
  };
  const cavern = (cx, cy, zf, angIn) => {
    for (let tryN = 0; tryN < 3; tryN++) {
      const R = (150 + rnd() * 150) * Math.pow(0.72, tryN);
      const roof = roofOver(cx, cy, R);
      if (!isFinite(roof)) continue;
      let hu = 260 + rnd() * 180;
      let zc = Math.min(zf, roof - hu - 12);
      if (zc < zf - 0.35 * hu) { zc = zf - 0.35 * hu; hu = roof - zc - 12; }
      zc = Math.max(zc, floorMin); hu = Math.min(hu, roof - zc - 12);
      if (hu < 180) continue;
      zc = Math.round(zc);
      nodes.push({ x: cx, y: cy, zf: zc, r: R, hu });
      const lobes = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < lobes; k++) {
        const a = angIn + Math.PI * (0.25 + rnd() * 1.5) * (rnd() < 0.5 ? -1 : 1), d = R * (0.45 + rnd() * 0.4);
        const lx = cx + Math.cos(a) * d, ly = cy + Math.sin(a) * d, lr = R * (0.35 + rnd() * 0.3);
        const lroof = roofOver(lx, ly, lr);
        const lz = Math.max(floorMin, zc + Math.round((rnd() - 0.3) * 30));
        const lhu = Math.min(hu * (0.5 + rnd() * 0.35), lroof - lz - 12);
        if (isFinite(lroof) && lhu >= 120) nodes.push({ x: lx, y: ly, zf: lz, r: lr, hu: lhu });
      }
      caverns.push({ x: cx, y: cy, zf: zc, R, hu });
      return { R, zc, hu };
    }
    return null;
  };
  const worm = (px, py, zf, ang, len, depth, main) => {
    let slope = -0.15, turn = 0, since = 0;
    for (let i = 0; i < len; i++) {
      const door = main && i < 4;
      turn = turn * 0.85 + (rnd() - 0.5) * 0.35;
      if (!door) {
        // lean toward higher ground (more rock over the tunnel: room for the caverns)
        const L = roofAt(px + Math.cos(ang + 0.6) * 140, py + Math.sin(ang + 0.6) * 140), Rr = roofAt(px + Math.cos(ang - 0.6) * 140, py + Math.sin(ang - 0.6) * 140);
        if (isFinite(L) && isFinite(Rr) && Math.abs(L - Rr) > 24) turn += 0.05 * Math.sign(L - Rr);
        ang += turn;
      }
      slope = Math.max(-0.6, Math.min(0.35, slope + (rnd() - 0.55) * 0.25));
      const nx = px + Math.cos(ang) * STEP, ny = py + Math.sin(ang) * STEP;
      const r = door ? 52 : 58 + rnd() * 28;
      let hu = door ? ctx.doorHu : 110 + rnd() * 50;
      let nz = door ? zf : zf + slope * 12;
      const roof = door ? roofAt(nx, ny) : roofOver(nx, ny, r * 0.8);
      if (!isFinite(roof)) { if (door) continue; break; }
      if (!door && nz + hu > roof - 6) nz = roof - hu - 6; // too shallow: dive
      if (!door) nz = Math.max(nz, zf - 14, floorMin);    // at most ~24 degrees down per step
      if (!door && nz > zf + 10) nz = zf + 10;
      if (!door && nz + hu > roof - 6) hu = roof - 6 - nz;
      if (!door && hu < 84) break; // no room left: the tunnel ends
      px = nx; py = ny; zf = nz; since++;
      nodes.push({ x: px, y: py, zf: Math.round(zf), r, hu, door });
      if (!door && i > 8 && since > 18 && rnd() < ctx.cavern) {
        // of a fan of spots ahead, the one under the most rock
        let best = null;
        for (let k = 0; k < 9; k++) {
          const a = ang + (k % 3 - 1) * 0.7, dd = 160 + Math.floor(k / 3) * 110, x = px + Math.cos(a) * dd, y = py + Math.sin(a) * dd;
          const room = roofOver(x, y, 160) - Math.max(floorMin, zf - 120);
          if (!best || room > best.room) best = { x, y, a, room };
        }
        const c = best.room >= 220 ? cavern(best.x, best.y, zf, best.a) : null;
        if (c) {
          for (let m = 1; m < 6; m++) { const q = m / 6; nodes.push({ x: px + (best.x - px) * q, y: py + (best.y - py) * q, zf: Math.round(zf + (c.zc - zf) * q), r: 70, hu: Math.max(100, Math.min(160, roofAt(px + (best.x - px) * q, py + (best.y - py) * q) - (zf + (c.zc - zf) * q) - 10)) }); }
          ang = best.a; px = best.x; py = best.y;
          // carry on from the far side of the bowl, a little up its rim
          ang += (rnd() - 0.5) * 1.6;
          px += Math.cos(ang) * c.R * 1.2; py += Math.sin(ang) * c.R * 1.2;
          zf = c.zc + 0.08 * c.hu; since = 0;
          continue;
        }
      }
      if (!door && depth < 2 && rnd() < ctx.branch)
        worm(px, py, zf, ang + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.8), Math.round(len * (0.25 + rnd() * 0.3)), depth + 1, false);
    }
    // every main tunnel ends in a cavern
    if (main) cavern(px + Math.cos(ang) * 140, py + Math.sin(ang) * 140, zf, ang);
    // (the bead chain above fills the way to a fan-picked cavern; this one sits right ahead)
    return [px, py];
  };
  worm(X0 + (s.x + 0.5 - s.dx) * CELL, Y0 + (s.y + 0.5 - s.dy) * CELL, ctx.doorH, Math.atan2(s.dy, s.dx), ctx.len, 0, true);
  return { nodes, caverns };
}

/**
 * The floor / ceiling fields of a cave and the coarse voxels to carve.
 * ctx: { CELL, VZ, X0, Y0, N, roofCell(cx, cy) world z (-Infinity = no carving), floorMin, noise(x, y, z) ~[-1, 1], seed }
 * returns { tiles: Map(tk -> { i, j, F[4], C[4], air, cell }), cells: Map(cc -> [f, t]), TW }
 * corner order 00 10 01 11 (as the ride surface)
 */
export function caveField(nodes, ctx) {
  const { CELL, VZ, X0, Y0, N, roofCell, floorMin, noise, seed } = ctx;
  const PER = CELL / TS, TW = N * PER, CW = TW + 1;
  const corners = new Map(); // ck -> [F, C, door]
  for (const nd of nodes) {
    const reach = nd.r * 1.35;
    const i0 = Math.max(0, Math.floor((nd.x - reach - X0) / TS)), i1 = Math.min(TW, Math.ceil((nd.x + reach - X0) / TS));
    const j0 = Math.max(0, Math.floor((nd.y - reach - Y0) / TS)), j1 = Math.min(TW, Math.ceil((nd.y + reach - Y0) / TS));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const x = X0 + i * TS, y = Y0 + j * TS;
      const w = noise(x / 110, y / 110, seed * 0.37 + 3.1) + 0.35 * noise(x / 33, y / 33, seed * 0.41 + 8.3);
      const rr = nd.r * (1 + (nd.door ? 0.08 : 0.28) * w);
      const d = Math.hypot(x - nd.x, y - nd.y) / rr;
      if (d >= 1) continue;
      // floor: flat to half way, then an S-curve up to 0.4 of the height at the rim (scree slopes);
      // ceiling: a low-shouldered dome ((1 - d^2)^0.7) meeting it: the walls are wedge slopes, not cliffs
      const sm = Math.min(1, Math.max(0, (d - 0.5) / 0.5)), curl = sm * sm * (3 - 2 * sm);
      const f = nd.zf + nd.hu * (nd.door ? 0.3 * d * d * d : 0.4 * curl);
      const c = nd.zf + nd.hu * (nd.door ? Math.sqrt(1 - Math.pow(d, 4)) : Math.pow(1 - d * d, 0.7));
      const k = i * CW + j, o = corners.get(k);
      if (!o) corners.set(k, [f, c, nd.door ? 1 : 0]);
      else { o[0] = Math.min(o[0], f); o[1] = Math.max(o[1], c); if (nd.door) o[2] = 1; }
    }
  }
  // the roof limit per corner: each cell's roof, rising ROOF_SLOPE units per unit away from the cell
  // (forbidden cells count as a roof under the floor), lowest of all cells within 3: the ceiling slopes
  // down into low ground and forbidden cells instead of being cut off there (sheer box walls)
  const roofs = new Map();
  const roofOf = (cx, cy) => { const c = cx * N + cy; if (!roofs.has(c)) { const r = cx < 0 || cy < 0 || cx >= N || cy >= N ? -Infinity : roofCell(cx, cy); roofs.set(c, isFinite(r) ? r : floorMin - 80); } return roofs.get(c); };
  const ROOF_SLOPE = 1.6;
  const roofLimit = (x, y) => {
    const gx = (x - X0) / CELL, gy = (y - Y0) / CELL, cx0 = Math.floor(gx - 1e-6), cy0 = Math.floor(gy - 1e-6);
    let m = Infinity;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const cx = cx0 + a, cy = cy0 + b;
      if (ctx.openWall?.(cx, cy)) continue; // the shelf in front of a cave mouth (tiered mountains): the passage may break out there
      const dx = Math.max(0, cx * CELL - (x - X0), (x - X0) - (cx + 1) * CELL), dy = Math.max(0, cy * CELL - (y - Y0), (y - Y0) - (cy + 1) * CELL);
      m = Math.min(m, roofOf(cx, cy) + ROOF_SLOPE * Math.hypot(dx, dy));
    }
    return m;
  };
  for (const [k, o] of corners) {
    const i = Math.floor(k / CW), j = k % CW, x = X0 + i * TS, y = Y0 + j * TS;
    o[1] = Math.min(o[1], roofLimit(x, y));
    if (!o[2]) {
      o[0] += 7 * noise(x / 70, y / 70, seed * 0.11 + 7.7);
      o[1] += 18 * noise(x / 60, y / 60, seed * 0.13 + 1.3) - 14 * Math.abs(noise(x / 38, y / 38, seed * 0.17 + 5.9));
    }
    o[0] = Math.ceil(Math.max(o[0], floorMin) / 2) * 2;
    o[1] = Math.floor(Math.min(o[1], roofLimit(x, y)) / 2) * 2;
  }
  const tiles = new Map(), cells = new Map();
  const ck = (i, j) => i * CW + j;
  const tileSet = new Set();
  for (const k of corners.keys()) { const i = Math.floor(k / CW), j = k % CW; for (const [a, b] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (i + a >= 0 && j + b >= 0 && i + a < TW && j + b < TW) tileSet.add((i + a) * TW + j + b); }
  for (const tk of tileSet) {
    const i = Math.floor(tk / TW), j = tk % TW, cx = Math.floor(i / PER), cy = Math.floor(j / PER);
    const roof = roofCell(cx, cy);
    if (!isFinite(roof)) continue;
    const cs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => corners.get(ck(i + a, j + b)));
    if (cs.some(c => !c)) continue;
    const F = cs.map(c => c[0]), C = cs.map(c => Math.min(c[1], roof)); // a tile's ceiling never goes over its own cell's roof
    const air = Math.min(...C) - Math.max(...F) >= 30;
    if (!air) continue;
    tiles.set(tk, { i, j, F, C, air: true, cell: cx * N + cy, door: cs.some(c => c[2]) });
  }
  // carve range per cell: just under the lowest floor .. just over the highest ceiling of its air tiles
  for (const t of tiles.values()) {
    const lo = Math.min(...t.F), hi = Math.max(...t.C), o = cells.get(t.cell);
    if (!o) cells.set(t.cell, [lo, hi]); else { o[0] = Math.min(o[0], lo); o[1] = Math.max(o[1], hi); }
  }
  for (const [c, o] of cells) cells.set(c, [Math.floor(o[0] / VZ) - 1, Math.ceil(o[1] / VZ) - 1]);
  return { tiles, cells, TW, PER };
}

// ---------------------------------------------------------------- bricks --
const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // corners 00 10 01 11 from the tile centre
/** the cap over a tile's lowest corner: [asset, dirs] by which corners are up (null = flat / saddle) */
function capOf(h) {
  const lo = Math.min(...h), hi = Math.max(...h), d = hi - lo;
  if (!d) return null;
  const up = h.map(v => v - lo >= d / 2), n = up.filter(Boolean).length;
  if (n === 1) { const [sx, sy] = CORNER[up.indexOf(true)]; return ['PB_DefaultMicroWedgeCorner', [[sx, 0], [0, sy]]]; }
  if (n === 3) { const [lx, ly] = CORNER[up.indexOf(false)]; return ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]]]; }
  const [a, b] = up.map((u, k) => (u ? k : -1)).filter(k => k >= 0);
  const [ax, ay] = CORNER[a], [bx, by] = CORNER[b];
  if (ax === bx) return ['PB_DefaultMicroWedge', [[ax, 0]]];
  if (ay === by) return ['PB_DefaultMicroWedge', [[0, ay]]];
  return null; // saddle
}

/**
 * Bricks of one cave. ctx: { VZ, X0, Y0, N, BAND, band(k) -> [r,g,b], hash(a, b, c) -> [0,1), surfaceAt(x, y) world z, gemKinds, out(brick) }
 * returns { gems: [{ at: [x, y, z], prefab }], n } (gem origin = floor under its centre)
 */
export function caveBricks(field, ctx) {
  const { VZ, X0, Y0, BAND, band, hash, out } = ctx;
  const { tiles, cells, TW, PER } = field;
  let n = 0;
  const push = b => { out({ ...b, ...SOFT }); n++; };
  const wx = i => X0 + i * TS, wy = j => Y0 + j * TS;
  const T = (i, j) => tiles.get(i * TW + j);
  const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const segs = new Map(); // "z0,z1,colourKey" -> Set of tile keys (fills, merged later)
  const addFill = (i, j, z0, z1) => {
    // split on strata
    let z = z0;
    while (z < z1) {
      const k = Math.floor(z / BAND), top = Math.min(z1, (k + 1) * BAND);
      if (top - z >= 2) { const key = `${z},${top},${k}`; (segs.get(key) ?? segs.set(key, new Set()).get(key)).add(i * TW + j); }
      z = top;
    }
  };
  const caps = []; // { i, j, asset, dirs, base, d, flip, k }
  for (const [cc, [f, t]] of cells) {
    const cx = Math.floor(cc / ctx.N), cy = cc % ctx.N, Z0 = (f + 1) * VZ, Z1 = (t + 1) * VZ;
    for (let a = 0; a < PER; a++) for (let b = 0; b < PER; b++) {
      const i = cx * PER + a, j = cy * PER + b, me = T(i, j);
      const nbs = NB8.map(([p, q]) => T(i + p, j + q)).filter(Boolean);
      const lowNb = Math.min(...nbs.map(o => Math.min(...o.F))), highNb = Math.max(...nbs.map(o => Math.max(...o.C)));
      if (!me) { // rock tile at the rim: only where neighbouring air can see it
        if (nbs.length) addFill(i, j, Math.max(Z0, lowNb), Math.min(Z1, highNb));
        continue;
      }
      const fLo = Math.min(...me.F), fHi = Math.max(...me.F), cLo = Math.min(...me.C), cHi = Math.max(...me.C);
      addFill(i, j, Math.max(Z0, Math.min(lowNb, fLo)), fLo);
      addFill(i, j, cHi, Math.min(Z1, Math.max(highNb, cHi)));
      const fc = capOf(me.F);
      if (fc) caps.push({ i, j, asset: fc[0], dirs: fc[1], base: fLo, d: fHi - fLo, flip: false, k: Math.floor((fLo + fHi) / 2 / BAND) });
      else if (fHi > fLo) addFill(i, j, fLo, fHi); // saddle: flat at the top
      // ceiling: corners hanging lowest = "up" for the flipped piece; corner (sx, sy) lands at (sx, -sy)
      const neg = me.C.map(v => -v), cap = capOf([neg[2], neg[3], neg[0], neg[1]]); // y mirrored: rows swap
      if (cap) caps.push({ i, j, asset: cap[0], dirs: cap[1], base: cLo, d: cHi - cLo, flip: true, k: Math.floor((cLo + cHi) / 2 / BAND) });
      else if (cHi > cLo) addFill(i, j, cLo, cHi); // saddle: flat at the lowest
    }
  }
  // fills: greedy rectangles per (z0, z1, stratum)
  for (const [key, set] of segs) {
    const [z0, z1, k] = key.split(',').map(Number), col = band(k);
    const keys = [...set].sort((p, q) => p - q);
    for (const t0 of keys) {
      if (!set.has(t0)) continue;
      const i = Math.floor(t0 / TW), j = t0 % TW;
      let l = 1; while (l < 32 && set.has(i * TW + j + l)) l++;
      let w = 1; grow: while (w < 32) { for (let b = 0; b < l; b++) if (!set.has((i + w) * TW + j + b)) break grow; w++; }
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) set.delete((i + a) * TW + j + b);
      push({ asset: 'PB_DefaultMicroBrick', position: [wx(i) + (w * TS) / 2, wy(j) + (l * TS) / 2, (z0 + z1) / 2], size: [(w * TS) / 2, (l * TS) / 2, (z1 - z0) / 2], color: col });
    }
  }
  // caps: micro wedges merged along runs across their slope (same base, height, direction, stratum)
  const capAt = new Map(caps.map(c => [(c.flip ? 'c' : 'f') + (c.i * TW + c.j), c]));
  const sig = c => c && `${c.asset}${c.dirs.join(';')}|${c.base}|${c.d}|${c.k}`;
  for (const c of caps) {
    if (c.used) continue;
    let len = 1, px = 0, py = 0;
    if (c.asset === 'PB_DefaultMicroWedge') {
      [px, py] = c.dirs[0][0] ? [0, 1] : [1, 0];
      while (len < 32) { const o = capAt.get((c.flip ? 'c' : 'f') + ((c.i + px * len) * TW + c.j + py * len)); if (!o || o.used || sig(o) !== sig(c)) break; len++; }
    }
    for (let m = 0; m < len; m++) capAt.get((c.flip ? 'c' : 'f') + ((c.i + px * m) * TW + c.j + py * m)).used = true;
    const ext = [px ? (len * TS) / 2 : TS / 2, py ? (len * TS) / 2 : TS / 2, c.d / 2];
    let o = orientFor(c.asset, c.dirs, ext);
    if (c.flip) o = FLIP(o);
    push({ asset: c.asset, ...o, position: [wx(c.i) + ext[0], wy(c.j) + ext[1], c.base + c.d / 2], color: band(c.k) });
  }

  // ------------------------------------------------------------ formations --
  const tint = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  const used = new Set();
  const interior = t => NB8.every(([p, q]) => T(t.i + p, t.j + q));
  const ev = v => Math.max(2, Math.round(v / 2) * 2);
  // a wedge spike at (x, y) from zBase growing `dir` (+1 up, -1 down), base half width a, length L:
  // column (half c), a skirt ring of wedges round its foot (outer half a), a 4-wedge pyramid tip
  const spike = (x, y, zBase, dir, a, L, color, tipColor) => {
    a = ev(a); L = Math.max(8, Math.floor(L / 4) * 4); // (down: a column's two halves must not cross)
    const c = a >= 10 ? ev(a * 0.45) : a, hc = Math.round((a >= 10 ? 0.6 : 0.4) * L / 2) * 2, ht = L - hc, hs = a >= 10 ? Math.max(4, Math.round(L * 0.22 / 2) * 2) : 0;
    const put = (asset, dirs, ext, px, py, z0, z1, col) => {
      const zc = dir > 0 ? (z0 + z1) / 2 : 2 * zBase - (z0 + z1) / 2;
      if (asset === 'PB_DefaultMicroBrick') { push({ asset, size: ext, position: [px, py, zc], color: col }); return; }
      let o = orientFor(asset, dirs, ext);
      if (dir < 0) o = FLIP(o);
      push({ asset, ...o, position: [px, py, zc], color: col });
    };
    const ys = dir > 0 ? 1 : -1; // flipped pieces mirror y: pick y-mirrored dirs
    put('PB_DefaultMicroBrick', null, [c, c, hc / 2], x, y, zBase, zBase + hc, color);
    const q = c / 2;
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
      put('PB_DefaultMicroWedgeCorner', [[-sx, 0], [0, -sy * ys]], [q, q, ht / 2], x + sx * q, y + sy * q, zBase + hc, zBase + L, tipColor);
    if (hs) {
      const s = (a - c) / 2; // skirt ring width (half)
      for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ext = sx ? [s, c, hs / 2] : [c, s, hs / 2];
        put('PB_DefaultMicroWedge', [[-sx, -sy * ys]], ext, x + sx * (c + s), y + sy * (c + s), zBase, zBase + hs, color);
      }
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
        put('PB_DefaultMicroWedgeCorner', [[-sx, 0], [0, -sy * ys]], [s, s, hs / 2], x + sx * (c + s), y + sy * (c + s), zBase, zBase + hs, color);
    }
  };
  const order = [...tiles.values()].sort((p, q) => hash(p.i, p.j, 41) - hash(q.i, q.j, 41));
  const gems = [];
  // blocks of n x n tiles centred on tile t's low corner (an even grid point): all air and inside, or null
  const blockOf = (t, n) => {
    const out = [];
    for (let p = -n / 2; p < n / 2; p++) for (let q = -n / 2; q < n / 2; q++) { const o = T(t.i + p, t.j + q); if (!o || o.door || used.has(o.i * TW + o.j)) return null; out.push(o); } // no formations in doorways
    return out;
  };
  const span = blk => [Math.max(...blk.flatMap(o => o.F)), Math.min(...blk.flatMap(o => o.C)), Math.min(...blk.flatMap(o => o.F))];
  const take = blk => { for (const o of blk) used.add(o.i * TW + o.j); };
  const inside = blk => blk.every(interior);
  for (const t of order) {
    if (used.has(t.i * TW + t.j)) continue;
    const r = hash(t.i, t.j, 42), x = wx(t.i), y = wy(t.j);
    const stone = band(Math.floor(Math.min(...t.C) / BAND)), pale = tint(stone, 1.1), deep = tint(stone, 0.85);
    if (r < 0.012) { // big formation on a 6 x 6-tile block (caverns)
      const blk = blockOf(t, 6);
      if (!blk || !inside(blk)) continue;
      const [fl, ce] = span(blk), gap = ce - fl;
      if (gap < 140) continue;
      const a = Math.min(28, 12 + gap * 0.04), r2 = hash(t.i, t.j, 43);
      if (gap <= 280 && r2 < 0.45) { // column: the two meet
        const mid = Math.round((fl + gap * (0.42 + 0.16 * hash(t.i, t.j, 44))) / 4) * 4;
        spike(x, y, ce, -1, a * 0.8, ce - mid, stone, pale);
        spike(x, y, fl, 1, a, mid - fl, deep, stone);
      } else {
        const up = Math.min(gap * 0.4, 70 + 110 * r2), down = Math.min(gap * 0.3, 50 + 90 * hash(t.i, t.j, 45));
        if (r2 < 0.8) spike(x, y, fl, 1, a, up, deep, stone);
        if (r2 > 0.25 && down >= 24) spike(x, y, ce, -1, a * 0.75, Math.min(down, gap - up - 24), stone, pale);
      }
      take(blk);
    } else if (r < 0.05) { // small stalactite / stalagmite on a 2 x 2 block
      const blk = blockOf(t, 2);
      if (!blk || !inside(blk)) continue;
      const [fl, ce] = span(blk), gap = ce - fl;
      if (gap < 70) continue;
      if (r < 0.04) spike(x, y, ce, -1, 4 + 4 * hash(t.i, t.j, 46), Math.min(gap * 0.32, 16 + 56 * hash(t.i, t.j, 47)), stone, pale);
      else spike(x, y, fl, 1, 4 + 4 * hash(t.i, t.j, 48), Math.min(gap * 0.25, 12 + 40 * hash(t.i, t.j, 49)), deep, stone);
      take(blk);
    }
  }
  // gems: a 2 x 2-tile block of near-flat floor, open above, near a wall (rock within 3 tiles), 120+ apart;
  // the gem stands on the block's highest corner (the caps under it are lower)
  const nearWall = t => { for (let p = -4; p <= 3; p++) for (let q = -4; q <= 3; q++) if (!T(t.i + p, t.j + q)) return true; return false; };
  const want = Math.min(70, Math.max(3, Math.round(tiles.size / 450))); // (all caves are one field)
  for (const t of order) {
    if (gems.length >= want) break;
    const blk = blockOf(t, 2);
    if (!blk) continue;
    const [fz, ce, flo] = span(blk);
    if (fz - flo > 6 || ce - fz < 76 || !nearWall(t)) continue;
    const x = wx(t.i), y = wy(t.j);
    if (gems.some(g => Math.hypot(g.at[0] - x, g.at[1] - y) < 120)) continue;
    const depth = Math.max(0, (ctx.surfaceAt(x, y) - fz) / VZ - 12); // bricks of rock overhead, past the first 12
    const wts = [60, 25 + depth, 10 + depth / 2, 3 + depth / 4], sum = wts.reduce((p, q) => p + q, 0);
    let roll = hash(t.i, t.j, 50) * sum, kind = 0;
    while (roll >= wts[kind]) { roll -= wts[kind]; kind++; }
    gems.push({ at: [x, y, fz], prefab: `gem_${ctx.gemKinds[kind]}` });
    take(blk);
  }
  // warm uplights on flat floor (a 6 x 6 glow stone on a tile)
  for (const t of order) {
    const k = t.i * TW + t.j;
    if (used.has(k) || !t.F.every(v => v === t.F[0]) || hash(t.i, t.j, 51) > 0.012) continue;
    push({ asset: 'PB_DefaultMicroBrick', position: [wx(t.i) + TS / 2, wy(t.j) + TS / 2, t.F[0] + 2], size: [3, 3, 2], color: [255, 176, 92], material: 'BMC_Glow', material_intensity: 8 });
    used.add(k);
  }
  return { gems, n };
}
