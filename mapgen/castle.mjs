// Castle kit (2026-10-15, owner: "the castles look like shit"). The old town
// castle was a square ring of plain stone pillars round an office-block keep.
// This builds its stonework on a voxel canvas (10 x 10 x 6 units: a stud
// across, half a brick up) and greedy-merges it into micro bricks, so towers
// can be really round and roofs really pitched:
//   - ROUND shafts: every outer step of a rasterized circle gets a vertical
//     side micro wedge, so a tower reads as a smooth polygon, not a staircase;
//   - roofs: cells flagged with a `rise` get a micro wedge / outer corner /
//     corner piece on top toward the higher neighbour (cones, pyramids, the
//     battered plinths), like the terrain smoothing;
//   - coursed masonry: block tones per course, staggered; hidden core voxels
//     share one colour so they merge into big bricks.
// Everything is micro bricks, so no studded undersides anywhere (corbels,
// eaves, arch soffits). Pieces: curtain walls with battered plinths, corbelled
// machicolated parapets and merlons; round towers (crenellated or under a
// slate cone with an eave), a square tower under a tiled pyramid, a twin-D
// gatehouse with a pointed arch and a raised portcullis, keep dressing
// (plinth, corbelled parapet, bartizans, a tall stair tower).
//
// canvas() -> { set, get, del, has, box, cyl, ring, cone, pyramid, bricks() }
// castleStone(seed) -> brick list (local units, z 0 = courtyard ground) of the
// town castle's walls, towers and gatehouse; keepDress(...) adds the keep's.
import { orientFor } from './orient.mjs';

export const VX = 10, VZ = 6; // voxel size: across, up
const MB = 'PB_DefaultMicroBrick';
const hash = (...a) => { let h = 2166136261; for (const v of a) { h = Math.imul(h ^ (v | 0), 16777619); h ^= h >>> 13; } h = Math.imul(h, 2246822519); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const K = (i, j, k) => ((i + 512) * 1024 + (j + 512)) * 1024 + k;
const UK = key => { const k = key % 1024, ij = (key - k) / 1024, j = (ij % 1024) - 512, i = Math.floor(ij / 1024) - 512; return [i, j, k]; };

export function canvas() {
  const vox = new Map();   // key -> palette index
  const rise = new Map();  // key -> max wedge voxels on top (roofs, plinths)
  const round = new Set(); // keys whose outer steps get side wedges
  const pal = [], palIx = new Map();
  const col = (color, material) => { const s = color.join() + (material ?? ''); if (!palIx.has(s)) { palIx.set(s, pal.length); pal.push({ color: color.map(v => Math.max(0, Math.min(255, Math.round(v)))), material }); } return palIx.get(s); };
  const c = {
    col,
    set(i, j, k, color, { r = 0, rnd = false, material } = {}) {
      if (k < 0) return;
      const key = K(i, j, k);
      vox.set(key, typeof color === 'number' ? color : col(color, material));
      if (r) rise.set(key, r); else rise.delete(key);
      if (rnd) round.add(key); else round.delete(key);
    },
    has: (i, j, k) => vox.has(K(i, j, k)),
    del(i, j, k) { const key = K(i, j, k); vox.delete(key); rise.delete(key); round.delete(key); },
    /** voxel box [i0, i1) x [j0, j1) x [k0, k1); color(i, j, k) or an rgb */
    box(i0, j0, k0, i1, j1, k1, color, o) {
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++)
        c.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color, o);
    },
    /** cells of a disc of radius R round the voxel corner (ci, cj) (a half-integer centre for odd widths) */
    disc(ci, cj, R, fn) {
      const n = Math.ceil(R) + 1;
      for (let i = Math.floor(ci) - n; i <= Math.ceil(ci) + n; i++) for (let j = Math.floor(cj) - n; j <= Math.ceil(cj) + n; j++)
        if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 <= R * R) fn(i, j);
    },
    /** solid cylinder k0..k1 (round = side wedges on its outline) */
    cyl(ci, cj, R, k0, k1, color, o = {}) { c.disc(ci, cj, R, (i, j) => { for (let k = k0; k < k1; k++) c.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color, o); }); },
    /** ring of cells with r0 < d <= R (d from the centre to the cell centre) */
    ring(ci, cj, r0, R, k0, k1, color, o = {}) {
      c.disc(ci, cj, R, (i, j) => { if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 <= r0 * r0) return; for (let k = k0; k < k1; k++) c.set(i, j, k, typeof color === 'function' ? color(i, j, k) : color, o); });
    },
    /** conical roof: discs shrinking a voxel per level, `step` voxels per level, wedges on every step; returns the apex k */
    cone(ci, cj, R, k0, step, color) {
      let k = k0;
      for (let r = R; r > 0.6; r -= 1, k += step) c.cyl(ci, cj, r, k, k + step, typeof color === 'function' ? (i, j, kk) => color(i, j, kk, (kk - k0) / step | 0) : color, { r: step });
      return k;
    },
    /** square pyramid over [i0, i1) x [j0, j1), `step` voxels per course */
    pyramid(i0, j0, i1, j1, k0, step, color) {
      let k = k0;
      for (; i1 - i0 > 0 && j1 - j0 > 0; i0++, j0++, i1--, j1--, k += step) c.box(i0, j0, k, i1, j1, k + step, typeof color === 'function' ? (i, j, kk) => color(i, j, kk, (kk - k0) / step | 0) : color, { r: step });
      return k;
    },
    /** merge + smoothing -> micro bricks in local units */
    bricks({ core = null } = {}) {
      const S = key => vox.has(key);
      // hidden voxels share the core colour so they merge into big bricks
      if (core != null) {
        const ci = col(core);
        const hid = [];
        for (const key of vox.keys()) {
          const [i, j, k] = UK(key);
          if (S(K(i + 1, j, k)) && S(K(i - 1, j, k)) && S(K(i, j + 1, k)) && S(K(i, j - 1, k)) && S(K(i, j, k + 1)) && (k === 0 || S(K(i, j, k - 1)))) hid.push(key);
        }
        for (const key of hid) vox.set(key, ci);
      }
      const out = [];
      // greedy merge per colour (x, then y, then z)
      const done = new Set();
      const keys = [...vox.keys()].map(UK).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      const ok = (i, j, k, cc) => { const s = K(i, j, k); return !done.has(s) && vox.get(s) === cc; };
      for (const [i, j, k] of keys) {
        if (done.has(K(i, j, k))) continue;
        const cc = vox.get(K(i, j, k));
        let x1 = i + 1; while (x1 - i < 120 && ok(x1, j, k, cc)) x1++;
        let y1 = j + 1; while (y1 - j < 120 && (() => { for (let x = i; x < x1; x++) if (!ok(x, y1, k, cc)) return false; return true; })()) y1++;
        let z1 = k + 1; while ((() => { for (let x = i; x < x1; x++) for (let y = j; y < y1; y++) if (!ok(x, y, z1, cc)) return false; return true; })()) z1++;
        for (let x = i; x < x1; x++) for (let y = j; y < y1; y++) for (let z = k; z < z1; z++) done.add(K(x, y, z));
        out.push({ asset: MB, size: [(x1 - i) * VX / 2, (y1 - j) * VX / 2, (z1 - k) * VZ / 2], position: [(i + x1) * VX / 2, (j + y1) * VX / 2, (k + z1) * VZ / 2], ...pal[cc] });
      }
      const used = new Set(vox.keys()), blk = c.blocked ?? (() => false);
      // side wedges on round outlines: an empty cell with solid round cells on two
      // orthogonal sides (and the diagonal) and open on the other two gets the
      // vertical half toward them; vertical runs merge into one wedge
      const side = new Map(); // "i,j" -> [{k, rot, cc}]
      for (const key of round) {
        if (!vox.has(key)) continue;
        const [i, j, k] = UK(key);
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ei = i + a, ej = j + b; // a candidate empty cell next to this one
          for (const [sx, sy] of a ? [[-a, 1], [-a, -1]] : [[1, -b], [-1, -b]]) {
            // the empty cell's solid neighbours lie toward (sx, 0), (0, sy)
            const n1 = K(ei + sx, ej, k), n2 = K(ei, ej + sy, k), nd = K(ei + sx, ej + sy, k);
            if (used.has(K(ei, ej, k)) || blk(ei, ej, k) || !round.has(n1) || !round.has(n2) || !vox.has(nd)) continue;
            if (vox.has(K(ei - sx, ej, k)) || vox.has(K(ei, ej - sy, k))) continue;
            const rot = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 }[sx + ',' + sy];
            const ck = ei + ',' + ej;
            if (!side.has(ck)) side.set(ck, new Map());
            side.get(ck).set(k, { rot, cc: vox.get(n1) });
          }
        }
      }
      for (const [ck, ks] of side) {
        const [i, j] = ck.split(',').map(Number);
        const sorted = [...ks.keys()].sort((a, b) => a - b);
        for (let n = 0; n < sorted.length;) {
          const k0 = sorted[n], { rot, cc } = ks.get(k0);
          let k1 = k0 + 1; n++;
          while (n < sorted.length && sorted[n] === k1 && ks.get(k1).rot === rot && ks.get(k1).cc === cc) { k1++; n++; }
          for (let k = k0; k < k1; k++) used.add(K(i, j, k));
          out.push({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, size: [VX / 2, VX / 2, (k1 - k0) * VZ / 2], position: [(i + 0.5) * VX, (j + 0.5) * VX, (k0 + k1) * VZ / 2], ...pal[cc] });
        }
      }
      // top smoothing: in the empty cells over a flagged voxel, a wedge toward one
      // higher orthogonal side, an outer corner into two, a corner piece toward a
      // higher diagonal; height = how far the neighbour stands up (<= the flag)
      const tall = (i, j, k, n) => { let d = 0; while (d < n && vox.has(K(i, j, k + 1 + d))) d++; return d; };
      for (const [key, n] of rise) {
        if (!vox.has(key)) continue;
        const [i, j, k] = UK(key);
        if (vox.has(K(i, j, k + 1))) continue;
        const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [a, b, tall(i + a, j + b, k, n)]).filter(o => o[2] > 0);
        let piece = null, d = 0;
        if (orth.length === 1) { d = orth[0][2]; piece = { asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [orth[0].slice(0, 2)], [VX / 2, VX / 2, 0]) }; }
        else if (orth.length === 2 && orth[0][0] !== -orth[1][0] && orth[0][1] !== -orth[1][1]) { d = Math.min(orth[0][2], orth[1][2]); piece = { asset: 'PB_DefaultMicroWedgeOuterCorner', ...orientFor('PB_DefaultMicroWedgeOuterCorner', orth.map(o => o.slice(0, 2)), [VX / 2, VX / 2, 0]) }; }
        else if (orth.length === 0) {
          const dg = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a, b, tall(i + a, j + b, k, n)]).find(o => o[2] > 0);
          if (dg) { d = dg[2]; piece = { asset: 'PB_DefaultMicroWedgeCorner', ...orientFor('PB_DefaultMicroWedgeCorner', [[dg[0], 0], [0, dg[1]]], [VX / 2, VX / 2, 0]) }; }
        }
        if (!piece) continue;
        let free = true; for (let z = k + 1; z <= k + d; z++) if (used.has(K(i, j, z)) || blk(i, j, z)) free = false;
        if (!free) continue;
        for (let z = k + 1; z <= k + d; z++) used.add(K(i, j, z));
        // orientFor permuted the size: put the height on whichever local axis maps to z
        const size = piece.size.map(v => (v === 0 ? d * VZ / 2 : v));
        out.push({ ...piece, size, position: [(i + 0.5) * VX, (j + 0.5) * VX, (k + 1) * VZ + d * VZ / 2], ...pal[vox.get(key)] });
      }
      return out;
    },
  };
  return c;
}

// ---------------------------------------------------------------- palette --
export const LIME = [156, 150, 140]; // warm limestone
const SH = [1, 0.93, 1.06, 0.97, 1.03, 0.9, 1.09];
/** coursed masonry tone: blocks 3 voxels long, staggered every course (2 voxels), a darker plinth */
export function stone(base = LIME, seed = 0) {
  return (i, j, k) => {
    const course = k >> 1, blk = Math.floor((i + j + (course & 1) * 2 + 99) / 3);
    const f = SH[Math.floor(hash(course, blk, seed) * SH.length)] * (k < 4 ? 0.88 : 1);
    return base.map(v => v * f);
  };
}
const SLATE = [[74, 82, 100], [66, 74, 92], [84, 92, 110]];
const TILE_RED = [[156, 74, 52], [140, 64, 46], [168, 86, 60]];
const slate = (i, j, k, lvl) => SLATE[(lvl + (hash(i, j, lvl) < 0.2 ? 1 : 0)) % 3];
const tiles = (i, j, k, lvl) => TILE_RED[(lvl + (hash(i, j, lvl) < 0.25 ? 1 : 0)) % 3];
const DARK = [44, 42, 40], COPING = [188, 182, 170], GOLD = [222, 182, 64];

/**
 * round tower at voxel corner (ci, cj), radius R, shaft top kTop.
 * kind 'crenel' (corbelled parapet, merlons) | 'cone' (eave + slate cone) ;
 * returns extra non-voxel pieces via `extra` (finials, flags) in local units
 */
export function roundTower(c, ci, cj, R, kTop, kind, seed, extra, { plinth = true, roof = slate, slits = true, base = LIME } = {}) {
  const st = stone(base, seed);
  c.cyl(ci, cj, R, 0, kTop, st, { rnd: true });
  if (plinth) c.ring(ci, cj, R, R + 1, 0, 3, st, { r: 2, rnd: true }); // battered plinth, wedged up into the shaft
  // arrow slits: dark 1-voxel slots on the outline at a few bearings, two tiers
  if (slits) for (let a = 0; a < 4; a++) {
    const ang = ((a + 0.5) * Math.PI) / 2 + hash(seed, a) * 0.4;
    const i = Math.floor(ci + Math.cos(ang) * (R - 0.5)), j = Math.floor(cj + Math.sin(ang) * (R - 0.5));
    for (const [k0, k1] of [[10, 16], [kTop - 14, kTop - 8]]) for (let k = k0; k < k1; k++) if (c.has(i, j, k)) c.set(i, j, k, DARK, { rnd: true });
  }
  // corbel table: brackets every other cell round the top, then the overhang
  c.disc(ci, cj, R + 1, (i, j) => {
    const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj);
    if (d <= R) return;
    if ((i + j) % 2 === 0) c.set(i, j, kTop - 2, st(i, j, kTop - 2));
    c.set(i, j, kTop - 1, st(i, j, kTop - 1));
  });
  if (kind === 'crenel') {
    c.ring(ci, cj, R - 1, R + 1, kTop, kTop + 4, st, { rnd: true }); // parapet
    c.cyl(ci, cj, R - 1, kTop, kTop + 1, [120, 116, 110]); // roof deck
    // merlons: by bearing, 2 on 1 off
    const n = Math.max(8, Math.round((2 * Math.PI * (R + 0.5)) / 2.6));
    c.ring(ci, cj, R, R + 1, kTop + 4, kTop + 8, (i, j, k) => {
      const seg = Math.floor(((Math.atan2(j + 0.5 - cj, i + 0.5 - ci) + Math.PI) / (2 * Math.PI)) * n);
      return seg % 2 ? null : k === kTop + 7 ? COPING : st(i, j, k);
    });
    return kTop + 8;
  }
  // cone: an eave ring a voxel out, then the roof
  c.ring(ci, cj, R - 1, R + 1, kTop, kTop + 1, st);
  c.cyl(ci, cj, R - 1, kTop, kTop + 1, st);
  const apex = c.cone(ci, cj, R + 1.6, kTop + 1, 3, roof);
  extra.push({ finial: [ci * VX, cj * VX, apex * VZ] });
  return apex;
}

/** a canvas that refuses voxels where skip(i, j, k) (other buildings' space) */
export function masked(c, skip) {
  const set = c.set;
  c.set = (i, j, k, color, o) => { if (skip(i, j, k)) return; set(i, j, k, color, o); };
  c.blocked = skip; // smoothing pieces stay out too
  return c;
}

/** the ring() above writes null colours for crenels: drop them */
export function wrapNull(c) {
  const set = c.set;
  c.set = (i, j, k, color, o) => { if (color == null) return; set(i, j, k, color, o); };
  return c;
}

/**
 * curtain wall run along x (axis 'x': i0..i1 at rows j0..j0+T) or y; `out` = +-1
 * the outer side. Battered plinth, corbels, projecting parapet, merlons.
 */
export function curtain(c, axis, a0, a1, b0, T, kTop, out, seed) {
  const st = stone(LIME, seed);
  const P = (a, b, k, color, o) => (axis === 'x' ? c.set(a, b, k, color, o) : c.set(b, a, k, color, o));
  const S = (a, b, k) => st(axis === 'x' ? a : b, axis === 'x' ? b : a, k);
  const outer = out > 0 ? b0 + T - 1 : b0, beyond = outer + out;
  for (let a = a0; a < a1; a++) {
    for (let b = b0; b < b0 + T; b++) for (let k = 0; k < kTop; k++) P(a, b, k, S(a, b, k));
    for (let k = 0; k < 3; k++) P(a, beyond, k, S(a, beyond, k), { r: 2 }); // battered plinth
    if (a % 2 === 0) P(a, beyond, kTop - 2, S(a, beyond, kTop - 2)); // corbels
    P(a, beyond, kTop - 1, S(a, beyond, kTop - 1));
    for (const b of [outer, beyond]) for (let k = kTop; k < kTop + 4; k++) P(a, b, k, S(a, b, k)); // parapet
    if (((a % 3) + 3) % 3 !== 2) for (const b of [outer, beyond]) for (let k = kTop + 4; k < kTop + 8; k++) P(a, b, k, k === kTop + 7 ? COPING : S(a, b, k));
    // wall walk: a paler top course
    for (let b = b0; b < b0 + T; b++) if (b !== outer) P(a, b, kTop - 1, [128, 124, 116]);
  }
}

/**
 * The town castle's stonework (local voxel frame, castle centre at the origin,
 * gate toward -y). keep = { i0, j0, i1, j1, kTop } of the keep building (built
 * by town.mjs building()); stays clear of it below kTop. -> { bricks, extra }
 */
export function castleStone(seed, keep) {
  const c = wrapNull(canvas()), extra = [];
  const T = 4, KW = 28; // curtain thickness (voxels), wall walk at 168
  // curtain: south (split round the gatehouse), east, north, west in two
  // stretches with a jog round a square tower (not a plain square)
  curtain(c, 'x', -41, -8, -44, T, KW, -1, seed + 1);
  curtain(c, 'x', 8, 41, -44, T, KW, -1, seed + 2);
  curtain(c, 'y', -41, 41, 38, T, KW, 1, seed + 3);   // east, x 380..420
  curtain(c, 'x', -32, 41, 40, T, KW, 1, seed + 4);   // north, y 400..440
  curtain(c, 'y', -41, 8, -42, T, KW, -1, seed + 5);  // west lower, x -420..-380
  curtain(c, 'x', -42, -32, 8, T, KW, 1, seed + 6);   // jog along y 80..120
  curtain(c, 'y', 12, 41, -34, T, KW, -1, seed + 7);  // west upper, x -340..-300
  // towers: front corners crenellated, back ones under slate cones, a square
  // tower at the jog under a red-tiled pyramid
  roundTower(c, -40, -42, 7, 40, 'crenel', seed + 11, extra);
  roundTower(c, 40, -42, 7, 40, 'crenel', seed + 12, extra);
  roundTower(c, 40, 42, 8, 50, 'cone', seed + 13, extra);
  roundTower(c, -32, 42, 6, 44, 'cone', seed + 14, extra);
  {
    const st = stone(LIME, seed + 15), [i0, j0, i1, j1] = [-45, 4, -35, 14], kT = 42;
    c.box(i0 - 1, j0 - 1, 0, i1 + 1, j1 + 1, 3, st, { r: 2 });
    c.box(i0, j0, 0, i1, j1, kT, st);
    for (let i = i0 - 1; i <= i1; i++) for (const j of [j0 - 1, j1]) { if ((i + j) % 2 === 0) c.set(i, j, kT - 2, st(i, j, kT - 2)); c.set(i, j, kT - 1, st(i, j, kT - 1)); }
    for (let j = j0; j < j1; j++) for (const i of [i0 - 1, i1]) { if ((i + j) % 2 === 0) c.set(i, j, kT - 2, st(i, j, kT - 2)); c.set(i, j, kT - 1, st(i, j, kT - 1)); }
    // eave course a voxel out, then the pyramid
    c.box(i0 - 2, j0 - 2, kT, i1 + 2, j1 + 2, kT + 1, [110, 104, 96]);
    const apex = c.pyramid(i0 - 2, j0 - 2, i1 + 2, j1 + 2, kT + 1, 2, tiles);
    extra.push({ finial: [(i0 + i1) * VX / 2, (j0 + j1) * VX / 2, apex * VZ] });
    for (const j of [j0 + 2, j1 - 3]) for (let k = 14; k < 20; k++) c.set(i0, j, k, DARK);
  }
  // gatehouse: a block over the passage between two D towers, taller than the wall
  {
    const st = stone(LIME, seed + 21), KG = 38;
    c.box(-10, -48, 0, 10, -37, KG, st);
    for (const sx of [-1, 1]) {
      const ci = sx * 9;
      c.box(ci - 5, -46, 0, ci + 5, -37, KG + 4, st);
      roundTower(c, ci, -46, 5, KG + 4, 'crenel', seed + 22 + sx, extra, { slits: true });
    }
    // machicolation box over the arch: corbels and a projecting parapet with merlons
    for (let i = -6; i < 6; i++) {
      if (i % 2 === 0) c.set(i, -49, KG - 2, st(i, -49, KG - 2));
      c.set(i, -49, KG - 1, st(i, -49, KG - 1));
      for (let k = KG; k < KG + 4; k++) for (const j of [-49, -48]) c.set(i, j, k, st(i, j, k));
      if (((i % 3) + 3) % 3 !== 2) for (let k = KG + 4; k < KG + 8; k++) for (const j of [-49, -48]) c.set(i, j, k, k === KG + 7 ? COPING : st(i, j, k));
    }
    // the passage with a pointed arch (half width 5 to k 14, then 4, 3, 2)
    const halfAt = k => (k < 14 ? 5 : k < 16 ? 4 : k < 17 ? 3 : k < 18 ? 2 : 0);
    for (let k = 0; k < 18; k++) for (let i = -halfAt(k); i < halfAt(k); i++) for (let j = -60; j < -36; j++) c.del(i, j, k);
    // arch ring: pale voussoirs round the opening on both faces
    for (const j of [-49, -37]) for (let k = 0; k < 19; k++) for (const sgn of [-1, 1]) {
      const h = halfAt(k), i = sgn < 0 ? -h - 1 : h;
      if (k >= 12 && c.has(i, j + (j < -40 ? 1 : -1), k)) c.set(i, j + (j < -40 ? 1 : -1), k, COPING);
    }
    // portcullis, raised: iron bars in the arch head, a slot in the vault
    for (let i = -4; i < 4; i++) for (let k = 13; k < 18; k++) if (i >= -halfAt(k) && i < halfAt(k) && (i % 2 === 0 || k === 14)) c.set(i, -44, k, [52, 50, 48], { material: 'BMC_Metallic' });
    // the two gate leaves, swung open against the passage sides
    for (const sx of [-1, 1]) for (let j = -42; j < -38; j++) for (let k = 0; k < 13; k++) c.set(sx < 0 ? -5 : 4, j, k, k % 4 === 3 ? [60, 56, 52] : [104, 72, 44]);
  }
  // keep's battered plinth and corbelled parapet; bartizans; the stair tower
  if (keep) keepDress(c, keep, seed + 40, extra);
  return { bricks: c.bricks({ core: LIME.map(v => v * 0.85) }), extra };
}

/**
 * Dress a keep built by town.mjs building() (voxel rect [i0, i1) x [j0, j1),
 * deck top at kTop, door centred on the j0 side): battered plinth (not under
 * the door step), a corbelled parapet a voxel out with merlons, round
 * bartizans with slate cones on three corners, a tall round stair tower under
 * a cone on the fourth.
 */
export function keepDress(c, { i0, j0, i1, j1, kTop, doorHalf = 5 }, seed, extra) {
  const st = stone([154, 150, 142], seed);
  const inside = (i, j) => i >= i0 && i < i1 && j >= j0 && j < j1;
  // plinth: a ring a voxel out, 3 high, wedged up into the wall (not at the door)
  for (let i = i0 - 1; i <= i1; i++) for (let j = j0 - 1; j <= j1; j++) {
    if (inside(i, j)) continue;
    if (j === j0 - 1 && Math.abs(i + 0.5 - (i0 + i1) / 2) < doorHalf + 1) continue;
    for (let k = 0; k < 3; k++) c.set(i, j, k, st(i, j, k), { r: 2 });
  }
  // corbel table + parapet over the wall line and a voxel out, merlons 2 on 1 off
  for (let i = i0 - 1; i <= i1; i++) for (let j = j0 - 1; j <= j1; j++) {
    const edgeOut = !inside(i, j), edgeIn = inside(i, j) && (i === i0 || i === i1 - 1 || j === j0 || j === j1 - 1);
    if (!edgeOut && !edgeIn) continue;
    if (edgeOut) { if ((i + j) % 2 === 0) c.set(i, j, kTop - 2, st(i, j, kTop - 2)); c.set(i, j, kTop - 1, st(i, j, kTop - 1)); }
    for (let k = kTop; k < kTop + 4; k++) c.set(i, j, k, st(i, j, k));
    const along = edgeOut ? (j === j0 - 1 || j === j1 ? i : j) : (j === j0 || j === j1 - 1 ? i : j);
    if (((along % 3) + 3) % 3 !== 2) for (let k = kTop + 4; k < kTop + 8; k++) c.set(i, j, k, k === kTop + 7 ? COPING : st(i, j, k));
  }
  // bartizans on three corners: corbelled out from below the parapet, slate cones
  const corners = [[i0, j0, -1, -1], [i1, j0, 1, -1], [i0, j1, -1, 1]];
  for (const [ci0, cj0, sx, sy] of corners) {
    const ci = ci0 + sx * 2.5, cj = cj0 + sy * 2.5, R = 3.2;
    // corbelled base: discs widening upward under the turret, outside the keep only
    [[1.6, kTop - 8], [2.4, kTop - 6], [R, kTop - 4]].forEach(([r, k]) => c.disc(ci, cj, r, (i, j) => { if (!inside(i, j)) for (let z = k; z < kTop; z++) c.set(i, j, z, st(i, j, z), { rnd: true }); }));
    c.disc(ci, cj, R, (i, j) => { if (!inside(i, j)) for (let z = kTop; z < kTop + 12; z++) c.set(i, j, z, st(i, j, z), { rnd: true }); });
    c.disc(ci, cj, R + 1, (i, j) => { if (!inside(i, j)) c.set(i, j, kTop + 12, [110, 104, 96]); });
    const apex = c.cone(ci, cj, R + 1.4, kTop + 13, 3, slate);
    extra.push({ finial: [ci * VX, cj * VX, apex * VZ] });
    // a slit facing out
    const si = Math.floor(ci + sx * (R - 0.5)), sj = Math.floor(cj);
    for (let z = kTop + 4; z < kTop + 9; z++) if (c.has(si, sj, z)) c.set(si, sj, z, DARK, { rnd: true });
  }
  // stair tower on the back corner (i1, j1): from the ground, well over the keep
  // (centred off the corner so it never reaches into the keep or its stair landing)
  roundTower(c, i1 + 5, j1 + 5, 5, kTop + 26, 'cone', seed + 9, extra, { roof: slate });
  extra[extra.length - 1].flag = true;
}
