// Dutch Colonial (2026-10-18, owner photos of a white clapboard house: "make this house in brickadia as a
// procgen house"): a two-storey side-gabled house under a GAMBREL roof (steep lower slopes, shallow upper
// ones), the front upper storey a full-width SHED DORMER (two shuttered windows) with the steep lower
// slope left showing as a flare at each gable end; a full-width front porch under a shallow shed roof on
// white columns, navy shutters, white trim, a brick chimney up the outside of one gable to the ridge, and
// a detached front-gabled garage set back beside the house at the end of the driveway (basketball hoop
// on its gable).
//
// Scale as splitlevel.mjs (BUILDING.md PLAYER SCALE): ceilings 72 clear, doors 62 x 30, sills 26, heads
// 62; storey 80 = 8 stair courses of 10 on 12-deep treads (BUILDING.md: stairs are coursed brickwork).
//
// Inside: centre-hall plan. The front door opens into the hall, the stair rises along the hall's far
// wall to the upstairs hall; dining room at the front and kitchen behind it on one side, the living
// room with a fireplace on the chimney gable on the other. Upstairs (full height under the dormer, a knee
// wall at the back): a bedroom over the dining room / kitchen, a front bedroom and the bathroom on the
// living room side, the attic above the ceiling with a small window in one gable.
//
//   dutchColonial({ seed, mirror }) -> { bricks, W, D, door } local units, front on y = 0 looking -y,
//   x 0..(W + 1) * 10, y 0..(D + 1) * 10 (shapedTown's frame); door = the front door's x in studs
//   node mapgen/dutchcolonial.mjs [seed] [out.json] [mirror]   (bricks for isoview.mjs)

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [242, 242, 238], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const METAL = { color: [190, 190, 196], material: 'BMC_Metallic' };

// mostly white like the photo; now and then a neighbour's pale yellow / sage / grey-blue
const SIDING = [[238, 238, 232], [236, 234, 226], [240, 240, 236], [232, 226, 196], [206, 214, 196], [200, 208, 214]];
const SHUTTERS = [[44, 58, 88], [36, 46, 64], [40, 40, 44], [58, 78, 60], [110, 40, 36]];
const ROOFS = [[92, 92, 90], [84, 82, 80], [104, 100, 94], [74, 76, 80], [96, 90, 84]];
const BRICKS = [[150, 70, 50], [138, 62, 44], [160, 84, 60], [124, 66, 52]];
const DOORS = [[44, 58, 88], [120, 40, 36], [36, 36, 40], [120, 84, 54], [60, 80, 60]];
const DECKS = [[150, 150, 148], [128, 104, 80], [110, 110, 112]];
const PAPERS = [
  { kind: 'stripe', cols: [[6, [214, 196, 160]], [4, [196, 174, 136]]] },
  { kind: 'stripe', cols: [[8, [190, 206, 196]], [2, [236, 236, 226]]] },
  { kind: 'stripe', cols: [[6, [170, 186, 210]], [2, [230, 230, 236]], [2, [150, 166, 196]], [2, [230, 230, 236]]] },
  { kind: 'stripe', cols: [[8, [226, 220, 200]], [2, [180, 140, 90]]] },
  { kind: 'check', w: 10, h: 12, colors: [[220, 214, 196], [204, 196, 176]] },
  { kind: 'check', w: 10, h: 12, colors: [[200, 216, 226], [184, 202, 214]] },
  { kind: 'paint', color: [232, 226, 210] },
  { kind: 'paint', color: [196, 214, 200] },
  { kind: 'paint', color: [236, 232, 224] },
];
const WAINS = [
  { kind: 'stripe', cols: [[2, [236, 234, 226]], [2, [222, 220, 212]]] },
  { kind: 'stripe', cols: [[4, [120, 86, 58]], [4, [108, 76, 50]]] },
  { kind: 'paint', color: [120, 140, 120] },
  { kind: 'paint', color: [236, 232, 222] },
];
const TILEWAINS = [
  { kind: 'check', w: 10, h: 6, colors: [[244, 244, 240], [228, 232, 232]] },
  { kind: 'check', w: 10, h: 6, colors: [[176, 210, 214], [160, 198, 204]] },
];
const TRIMS = [[244, 242, 236], [236, 230, 216], [120, 84, 54]];

export function dutchColonial({ seed = 1, mirror = false } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  // ---------------------------------------------------------------- frame --
  const HW = 340, HD = 290;                          // house 34 x 29 studs, front wall y 0..10
  const G = 24, GC = 96, U = 104, UC = 176;          // ground floor top / ceiling, upper floor top / ceiling
  const DOOR = 62, SILL = 26, HEAD = 62;
  const PD = 90;                                     // porch depth
  const GX0 = -180, GX1 = -20, GY0 = 140, GY1 = 360; // the garage, beside the house, set back half its depth
  const X0 = 200, Y0 = 112;                          // local origin: room for the garage eave and the front walk
  const sidingC = r() < 0.6 ? SIDING[Math.floor(r() * 3)] : pick(SIDING);
  const shutC = pick(SHUTTERS), roofC = pick(ROOFS), brickC = pick(BRICKS), doorC = pick(DOORS), deckC = pick(DECKS);
  const trimC = pick(TRIMS);
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const F = [1, 0.93, 1.05, 0.97, 1.02, 0.9];
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`dutchcolonial: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label) => {
    const asset = 'PB_DefaultMicroWedge', ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext), _m: { asset, ups, ext }, color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`dutchcolonial: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('dutchcolonial: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {};
  const floor = (room, rect, top) => tileFloor(fadd, rect, top, style[room] ??= pickRoomStyle(room, r), r);
  const op = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });

  // ------------------------------------------------------------ walls --
  // one course of a wall (axis 'x': runs along x at y line..line+10; 'y': along y at x line..line+10),
  // a0..a1 x z..zt, cut round the openings (the bricks over / under an opening stay)
  const WALLS = [];
  const piece = (axis, line, a, b, z, zt, color, label, t = 10) => axis === 'x'
    ? box(a, line, z, b, line + t, zt, { color }, label) : box(line, a, z, line + t, b, zt, { color }, label);
  function course(axis, line, a0, a1, z, zt, openings, color, label) {
    let pcs = [{ p: a0, q: a1, z, zt }];
    for (const o of openings) {
      if (o.z0 >= zt || o.z1 <= z) continue;
      pcs = pcs.flatMap(c => {
        if (o.a1 <= c.p || o.a0 >= c.q) return [c];
        const out = [];
        if (o.a0 > c.p) out.push({ ...c, q: o.a0 });
        if (o.a1 < c.q) out.push({ ...c, p: o.a1 });
        const m0 = Math.max(c.p, o.a0), m1 = Math.min(c.q, o.a1);
        if (o.z0 > c.z) out.push({ p: m0, q: m1, z: c.z, zt: Math.min(c.zt, o.z0) });
        if (o.z1 < c.zt) out.push({ p: m0, q: m1, z: Math.max(c.z, o.z1), zt: c.zt });
        return out;
      });
    }
    for (const c of pcs) if (c.q > c.p && c.zt > c.z) piece(axis, line, c.p, c.q, c.z, c.zt, color, label);
  }
  // laps of clapboard (6 high, two shades), a concrete foundation course under z 20; skin 'paint' = a partition
  let lapK = 0;
  const lapColor = () => shade(sidingC, lapK++ % 2 ? 0.93 : 1);
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall', lap = 6) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings });
    if (skin === 'paint') return course(axis, line, a0, a1, z0, z1, openings, [200, 196, 188], label);
    let z = z0;
    if (z < 20) { course(axis, line, a0, a1, z, Math.min(20, z1), openings, [170, 168, 162], label + ' foundation'); z = 20; }
    for (; z < z1; z += lap) course(axis, line, a0, a1, z, Math.min(z1, z + lap), openings, lapColor(), label + ' siding');
  }
  // a double-hung window in an opening: white frame, meeting rail, glass, a sill proud of the outside (out -1 / +1)
  function windowIn(axis, line, out, o, shutters = false) {
    const T = { color: WHITE };
    const lo = out < 0 ? line - 4 : line + 10, hi = lo + 4;
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    pb(o.a0, o.a1, o.z0, o.z0 + 4, T, 'window frame');
    pb(o.a0, o.a1, o.z1 - 4, o.z1, T, 'window frame');
    pb(o.a0, o.a0 + 4, o.z0 + 4, o.z1 - 4, T, 'window frame');
    pb(o.a1 - 4, o.a1, o.z0 + 4, o.z1 - 4, T, 'window frame');
    const mz = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
    pb(o.a0 + 4, o.a1 - 4, mz - 2, mz, T, 'meeting rail', line + 3, line + 7);
    pb(o.a0 + 4, o.a1 - 4, o.z0 + 4, mz - 2, GLASS, 'glass', line + 4, line + 6);
    pb(o.a0 + 4, o.a1 - 4, mz, o.z1 - 4, GLASS, 'glass', line + 4, line + 6);
    pb(o.a0 - 4, o.a1 + 4, o.z0 - 4, o.z0, { color: WHITE }, 'sill', lo, hi);
    if (!shutters) return;
    const s0 = out < 0 ? line - 2 : line + 10, s1 = s0 + 2;
    for (const [a, b] of [[o.a0 - 12, o.a0], [o.a1, o.a1 + 12]]) {
      pb(a, b, o.z0, o.z1, { color: shutC }, 'shutter', s0, s1);
      const mid = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
      pb(a + 2, b - 2, mid - 2, mid, { color: shade(shutC, 0.75) }, 'shutter rail', out < 0 ? s0 - 2 : s1, out < 0 ? s0 : s1 + 2);
    }
  }

  // ---------------------------------------------------- interior finishes --
  const bands = (z0, z1) => [
    [z0, z0 + 6, 4, 'base'], [z0 + 6, z0 + 22, 2, 'wains'], [z0 + 22, z0 + 26, 4, 'rail'],
    [z0 + 26, z1 - 6, 2, 'paper'], [z1 - 6, z1 - 4, 4, 'crown'], [z1 - 4, z1, 6, 'crown'],
  ];
  function patterned(pat, a0, a1, z0, z1, put) {
    if (pat.kind === 'paint') return put(a0, a1, z0, z1, pat.color);
    if (pat.kind === 'check') {
      for (let a = Math.floor(a0 / pat.w) * pat.w; a < a1; a += pat.w) for (let z = Math.floor(z0 / pat.h) * pat.h; z < z1; z += pat.h) {
        const p = Math.max(a0, a), q = Math.min(a1, a + pat.w), u = Math.max(z0, z), v = Math.min(z1, z + pat.h);
        if (q > p && v > u) put(p, q, u, v, pat.colors[((a / pat.w + z / pat.h) % 2 + 2) % 2]);
      }
      return;
    }
    const per = pat.cols.reduce((s, [w]) => s + w, 0);
    let a = Math.floor(a0 / per) * per, k = 0;
    while (a < a1) { const [w, c] = pat.cols[k % pat.cols.length]; const p = Math.max(a0, a), q = Math.min(a1, a + w); if (q > p) put(p, q, z0, z1, c); a += w; k++; }
  }
  const SIDES = { y0: ['x', 1], y1: ['x', -1], x0: ['y', 1], x1: ['y', -1] };
  function faceWall(side, R) {
    const [axis] = SIDES[side];
    const f = R[side];
    const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
    return WALLS.filter(w => w.axis === axis && (side.endsWith('0') ? w.line + 10 === f : w.line === f) && w.a0 < hi && w.a1 > lo && w.z0 < R.z1 && w.z1 > R.z0);
  }
  function facePiece(side, R, a, b, z, zt, t, color, label) {
    const [axis, d] = SIDES[side];
    const f = R[side];
    const [c0, c1] = d > 0 ? [f, f + t] : [f - t, f];
    if (axis === 'x') box(a, c0, z, b, c1, zt, { color }, label); else box(c0, a, z, c1, b, zt, { color }, label);
  }
  function finishRoom(R, { paper, wains, skip = {} } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0;
    for (const side of Object.keys(SIDES)) {
      if (!has[side]) continue;
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ops = faceWall(side, R).flatMap(w => w.openings).filter(o => o.z0 < R.z1 && o.z1 > R.z0 && o.a0 < hi && o.a1 > lo);
      for (const [z0, z1, t, kind] of bands(R.z0, R.z1)) {
        let a0 = lo, a1 = hi;
        if (axis === 'y') { if (has.y0) a0 += t; if (has.y1) a1 -= t; }
        let spans = [[a0, a1]];
        const cut = (p0, p1) => { spans = spans.flatMap(([p, q]) => (p1 <= p || p0 >= q) ? [[p, q]] : [[p, p0], [p1, q]].filter(([u, v]) => v > u)); };
        for (const o of ops) {
          const door = o.z0 <= R.z0 + 2;
          const oz0 = door ? R.z0 : o.z0 - 2, oz1 = o.z1 + 4;
          if (oz0 < z1 && oz1 > z0) cut(o.a0 - 4, o.a1 + 4);
        }
        for (const [p0, p1] of skip[side] ?? []) cut(p0, p1);
        for (const [p, q] of spans) {
          if (kind === 'paper' || kind === 'wains') patterned(kind === 'paper' ? paper : wains, p, q, z0, z1, (u, v, zz, zt, c) => facePiece(side, R, u, v, zz, zt, t, c, 'wall ' + kind));
          else facePiece(side, R, p, q, z0, z1, t, kind === 'crown' && t === 6 ? shade(trimC, 0.96) : trimC, kind);
        }
      }
      for (const o of ops) {
        if ((skip[side] ?? []).some(([p0, p1]) => o.a0 < p1 && o.a1 > p0)) continue;
        const door = o.z0 <= R.z0 + 2;
        const jz0 = door ? R.z0 : o.z0, top = Math.min(R.z1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, 4, trimC, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, 4, trimC, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, 4, trimC, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 6, trimC, 'stool');
      }
    }
  }
  const light = (x, y, z, c = [255, 240, 210]) => box(x - 8, y - 8, z - 2, x + 8, y + 8, z, GLOW(c), 'ceiling light');

  // --------------------------------------------------------- the roof --
  // courses from the ridge outward: each a 4-high lip with a micro wedge on it (BUILDING.md coursed roofs);
  // bands { y0, y1, zb, zt } in y (house) or x (garage)
  function courses(start, zTop, dir, segs) {
    const out = [];
    let a = start, z = zTop;
    for (const { n, per, w } of segs) for (let i = 0; i < n; i++) {
      out.push({ y0: dir < 0 ? a - w : a, y1: dir < 0 ? a : a + w, zb: z - per, zt: z });
      a += dir * w; z -= per;
    }
    return out;
  }
  function layY(bandsY, x0, x1, dir, label) { // bands along x, sloping in y; dir -1 = the front side
    bandsY.forEach((b, i) => {
      const eave = i === bandsY.length - 1;
      box(x0, b.y0, b.zb, x1, b.y1, b.zb + 4, { color: eave ? WHITE : shade(roofC, 0.82) }, label + ' lip');
      wedge(x0, b.y0, b.zb + 4, x1, b.y1, b.zt, [[0, -dir]], shade(roofC, [1, 0.95, 1.03][i % 3]), label);
    });
  }
  // gambrel: the ridge band y 128..160 at z 216..224; upper slopes 5 courses of 8 on 18 (shallow), lower
  // slopes courses of 10 high on 6 wide (steep)
  const RY0 = 128, RY1 = 160, RZ = 224;
  const frontEnd = courses(RY0, RZ, -1, [{ n: 5, per: 8, w: 18 }, { n: 7, per: 10, w: 6 }]);  // down to y -4, z 114
  const middle = courses(RY0, RZ, -1, [{ n: 5, per: 8, w: 28 }]);                             // the dormer roof, to y -12, z 184
  const back = courses(RY1, RZ, 1, [{ n: 5, per: 8, w: 18 }, { n: 8, per: 10, w: 6 }]);       // out to y 298, z 104
  const EW = 20;                                     // the flared ends: x -10..EW (rake + wall + a stud)
  layY(frontEnd, -10, EW, -1, 'roof end');
  layY(frontEnd, HW - EW, HW + 10, -1, 'roof end');
  layY(middle, EW, HW - EW, -1, 'dormer roof');
  layY(back, -10, HW + 10, 1, 'roof');
  box(-10, RY0, RZ - 8, HW + 10, RY1, RZ, { color: shade(roofC, 0.9) }, 'ridge');
  box(-10, RY0 - 4, RZ, HW + 10, RY1 + 4, RZ + 4, { color: shade(roofC, 0.8) }, 'ridge cap');
  // rows under a pair of band lists: wall y from the front list's inner edge to the back list's
  const rowsUnder = (lists, z0, z1, extra = []) => {
    const zs = new Set([z0, z1, ...extra]);
    for (const L of lists) for (const b of L) for (const v of [b.zb, b.zt]) if (v > z0 && v < z1) zs.add(v);
    return [...zs].sort((a, b) => a - b);
  };
  const inner = (L, zt, side) => { // side 'front': max y1 of bands below zt; 'back': min y0
    const bs = L.filter(b => b.zb < zt);
    if (!bs.length) return null;
    return side === 'front' ? Math.max(...bs.map(b => b.y1)) : Math.min(...bs.map(b => b.y0));
  };
  const laps = (z, zt) => zt - z === 10 ? [[z, z + 6], [z + 6, zt]] : zt - z === 8 ? [[z, z + 4], [z + 4, zt]] : [[z, zt]];

  // ------------------------------------------------------------- walls --
  const doorX0 = 130, HX0 = 120, HX1 = 180;          // hall x 120..180 between partitions 110..120 and 180..190
  const fd = op(doorX0, doorX0 + 30, G, G + DOOR);
  const frontWin = [op(40, 76, G + SILL, G + HEAD), op(208, 244, G + SILL, G + HEAD), op(280, 316, G + SILL, G + HEAD)];
  wall('x', 0, 0, HW, 0, U, 'siding', [{ ...fd, z1: fd.z1 + 4 }, ...frontWin], 'front');
  WALLS.at(-1).openings = [fd, ...frontWin];
  for (const x0 of [0, HW - EW]) for (let z = U; z < 114; z += 6) box(x0, 0, z, x0 + EW, 10, Math.min(114, z + 6), { color: lapColor() }, 'front wall end'); // up to the flare's eave
  frontWin.forEach(w => windowIn('x', 0, -1, w, true));
  box(fd.a0, 0, fd.z1, fd.a1, 10, fd.z1 + 4, { color: WHITE }, 'door head');
  box(fd.a0 - 4, -4, fd.z0, fd.a0, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a1, -4, fd.z0, fd.a1 + 4, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a0 - 6, -6, fd.z1 + 4, fd.a1 + 6, 0, fd.z1 + 8, { color: WHITE }, 'door cornice');
  box(fd.a0, 10, fd.z0, fd.a0 + 4, 40, fd.z1, { color: doorC }, 'front door (open)');
  // gable ends (x 0 and HW-10): ground storey windows, upstairs two windows, a small attic window in the
  // gable away from the chimney; above the walls the gable is laid in laps under the roof courses
  const sideG = { x0: [op(40, 76, G + SILL, G + HEAD), op(200, 236, G + SILL, G + HEAD)], x1: [op(40, 76, G + SILL, G + HEAD), op(212, 248, G + SILL, G + HEAD)] };
  const sideU = [op(76, 112, U + SILL, U + HEAD), op(164, 200, U + SILL, U + HEAD)];
  const attic = op(134, 154, 188, 204);
  const CHIM = 'x1';                                 // the living room's gable (mirror puts it on the other side)
  for (const [side, xl] of [['x0', 0], ['x1', HW - 10]]) {
    wall('y', xl, 10, HD - 10, 0, U, 'siding', sideG[side], 'gable');
    sideG[side].forEach(w => windowIn('y', xl, side === 'x0' ? -1 : 1, w));
    const ops = [...sideU, ...(side !== CHIM ? [attic] : [])];
    const zs = rowsUnder([frontEnd, back], U, RZ - 8);
    for (let i = 0; i + 1 < zs.length; i++) for (const [z, zt] of laps(zs[i], zs[i + 1])) {
      let y0 = inner(frontEnd, zt, 'front') ?? 10, y1 = inner(back, zt, 'back') ?? HD - 10;
      if (z < 114) { y0 = Math.max(10, y0); y1 = Math.min(HD - 10, y1); }
      if (y1 > y0) course('y', xl, y0, y1, z, zt, ops, lapColor(), 'gable');
    }
    ops.forEach(w => windowIn('y', xl, side === 'x0' ? -1 : 1, w));
  }
  // back wall: kitchen window (over the counter), living room window, the back door from the hall
  const bd = op(134, 164, G, G + DOOR);
  const backWin = [op(40, 76, G + 32, G + HEAD), op(230, 266, G + SILL, G + HEAD)];
  wall('x', HD - 10, 0, HW, 0, 114, 'siding', [bd, ...backWin], 'back');
  backWin.forEach(w => windowIn('x', HD - 10, 1, w));
  box(-10, HD, 104, HW + 10, HD + 2, 114, { color: WHITE }, 'soffit');
  box(bd.a0 + 26, HD - 40, G, bd.a1, HD - 10, G + DOOR, { color: shade(doorC, 0.9) }, 'back door (open)');
  box(bd.a0 - 10, HD, 0, bd.a1 + 10, HD + 30, 20, { color: [170, 168, 162] }, 'back stoop');
  box(bd.a0 - 10, HD + 30, 0, bd.a1 + 10, HD + 42, 10, { color: [170, 168, 162] }, 'back step');
  // the shed dormer: full-height front wall upstairs, cheeks at x EW..EW+10 up to the dormer roof
  const dWin = [op(56, 92, U + SILL, U + HEAD), op(248, 284, U + SILL, U + HEAD)];
  wall('x', 0, EW + 10, HW - EW - 10, U, 184, 'siding', dWin, 'dormer', 8);
  dWin.forEach(w => windowIn('x', 0, -1, w, true));
  for (const cx of [EW, HW - EW - 10]) {
    const zs = rowsUnder([middle, frontEnd], U, RZ - 8, [UC]);
    for (let i = 0; i + 1 < zs.length; i++) for (const [z, zt] of laps(zs[i], zs[i + 1])) {
      let y0 = 0, y1 = 10;
      if (zt > UC) { y0 = Math.max(0, inner(middle, zt, 'front') ?? 0); y1 = Math.min(RY0, inner(frontEnd, zt, 'front') ?? 10); }
      if (y1 > y0) piece('y', cx, y0, y1, z, zt, lapColor(), 'dormer cheek');
    }
  }
  // upstairs linings inside the gables (the rooms are x 30..HW-30 under the flares) and the back knee wall
  const linOps = sideU.map(o => ({ ...o }));
  wall('y', EW, 10, 210, 100, UC, 'paint', linOps, 'lining');
  wall('y', HW - EW - 10, 10, 210, 100, UC, 'paint', linOps, 'lining');
  for (const x of [10, HW - 20]) course('y', x, 68, 210, 100, UC, linOps, [200, 196, 188], 'lining fill');
  wall('x', 210, 10, HW - 10, 100, UC, 'paint', [], 'knee wall');

  // --------------------------------------------------------------- floors --
  // ground: dining (front) + kitchen (back) | hall | living room; partitions from the crawl (z 20)
  const SX0 = 150, SY0 = 60, SY1 = 160;              // stairwell x 150..180 y 60..160: 8 treads of 12 from y 64, top landing 160..190
  const dinDoor = op(70, 100, G, G + DOOR), kitDoor = op(200, 230, G, G + DOOR), livOpen = op(20, 56, G, G + DOOR + 6);
  wall('y', 110, 10, HD - 10, 20, GC, 'paint', [dinDoor, kitDoor], 'west partition');
  wall('y', 180, 10, HD - 10, 20, GC, 'paint', [livOpen], 'east partition');
  wall('x', 140, 10, 110, 20, GC, 'paint', [op(30, 80, G, G + DOOR + 6)], 'kitchen partition');
  floor('living', [10, 10, 110, 140], G);
  floor('kitchen', [10, 150, 110, HD - 10], G);
  floor('hall', [HX0, 10, HX1, HD - 10], G);
  floor('living', [190, 10, HW - 10, HD - 10], G);
  // the stair: coursed (BUILDING.md), each 10-high course runs from its step to the top
  const TREAD = [128, 90, 58];
  for (let k = 1; k <= 8; k++) box(SX0, SY0 + 4 + 12 * (k - 1), G + 10 * (k - 1), HX1, SY1, G + 10 * k, { color: shade(TREAD, k % 2 ? 1 : 0.9) }, 'stair course');
  // ceilings (face-down tiles) with the stairwell open
  for (const [a, b, c, d] of [[10, 10, HW - 10, SY0], [10, SY0, SX0, SY1], [HX1, SY0, HW - 10, SY1], [10, SY1, HW - 10, HD - 10]])
    box(a, b, GC, c, d, GC + 4, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'ground ceiling');
  // upstairs: bedroom over the west | hall | front bedroom + bathroom on the east
  const bed1Door = op(170, 200, U, U + DOOR), bed2Door = op(20, 50, U, U + DOOR), bathDoor = op(160, 190, U, U + DOOR);
  wall('y', 110, 10, 210, 100, UC, 'paint', [bed1Door], 'upper west partition');
  wall('y', 180, 10, 210, 100, UC, 'paint', [bed2Door, bathDoor], 'upper east partition');
  wall('x', 120, 190, HW - 30, 100, UC, 'paint', [], 'bathroom partition');
  floor('bedroom', [30, 10, 110, 210], U);
  for (const rc of [[HX0, 10, HX1, SY0], [HX0, SY0, SX0, SY1], [HX0, SY1, HX1, 210]]) floor('hall', rc, U);
  tileFloor(fadd, [190, 10, HW - 30, 120], U, pickRoomStyle('bedroom', r), r);
  floor('bathroom', [190, 130, HW - 30, 210], U);
  box(10, 10, 100, EW, 68, 104, { color: [150, 146, 140] }, 'flare floor');
  box(HW - EW, 10, 100, HW - 10, 68, 104, { color: [150, 146, 140] }, 'flare floor');
  box(10, 220, 100, HW - 10, HD - 10, 104, { color: [150, 146, 140] }, 'attic floor');
  box(30, 10, UC, HW - 30, 210, UC + 4, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'upper ceiling');
  for (let y = SY0; y + 2 <= SY1 - 6; y += 6) box(SX0 - 4, y, U, SX0 - 2, y + 2, U + 24, { color: trimC }, 'baluster');
  box(SX0 - 6, SY0, U + 24, SX0, SY1 - 6, U + 28, { color: shade(trimC, 0.8) }, 'handrail');

  // ------------------------------------------------------------- rooms --
  const paperOf = () => pick(PAPERS);
  const hallPaper = paperOf();
  finishRoom({ x0: 10, y0: 10, x1: 110, y1: 140, z0: G, z1: GC }, { paper: paperOf(), wains: pick(WAINS) });
  finishRoom({ x0: 10, y0: 150, x1: 110, y1: HD - 10, z0: G, z1: GC }, { paper: paperOf(), wains: pick(WAINS), skip: { y1: [[10, 110]] } });
  finishRoom({ x0: HX0, y0: 10, x1: HX1, y1: HD - 10, z0: G, z1: GC }, { paper: hallPaper, wains: pick(WAINS), skip: { x1: [[SY0, SY1]] } });
  const FPY0 = 120, FPY1 = 168;                      // fireplace on the chimney gable
  finishRoom({ x0: 190, y0: 10, x1: HW - 10, y1: HD - 10, z0: G, z1: GC }, { paper: paperOf(), wains: pick(WAINS), skip: { x1: [[FPY0 - 4, FPY1 + 4]] } });
  finishRoom({ x0: 30, y0: 10, x1: 110, y1: 210, z0: U, z1: UC }, { paper: paperOf(), wains: pick(WAINS) });
  finishRoom({ x0: HX0, y0: 10, x1: HX1, y1: 210, z0: U, z1: UC }, { paper: hallPaper, wains: pick(WAINS) });
  finishRoom({ x0: 190, y0: 10, x1: HW - 30, y1: 120, z0: U, z1: UC }, { paper: paperOf(), wains: pick(WAINS) });
  finishRoom({ x0: 190, y0: 130, x1: HW - 30, y1: 210, z0: U, z1: UC }, { paper: paperOf(), wains: pick(TILEWAINS) });
  // fireplace: brick breast, black firebox with embers, a mantel shelf
  for (let z = G, k = 0; z < GC; z += 12, k++) {
    const zt = Math.min(GC, z + 12);
    if (z < G + 36) {
      box(HW - 30, FPY0, z, HW - 10, FPY0 + 12, zt, { color: shade(brickC, F[k % 6]) }, 'fireplace');
      box(HW - 30, FPY1 - 12, z, HW - 10, FPY1, zt, { color: shade(brickC, F[(k + 3) % 6]) }, 'fireplace');
    } else box(HW - 30, FPY0, z, HW - 10, FPY1, zt, { color: shade(brickC, F[k % 6]) }, 'chimney breast');
  }
  box(HW - 18, FPY0 + 12, G, HW - 10, FPY1 - 12, G + 36, { color: [30, 28, 28] }, 'firebox');
  box(HW - 30, FPY0 + 12, G + 24, HW - 18, FPY1 - 12, G + 36, { color: [30, 28, 28] }, 'firebox lintel');
  box(HW - 26, FPY0 + 14, G, HW - 20, FPY1 - 14, G + 4, GLOW([255, 120, 40], 3), 'embers');
  box(HW - 36, FPY0 - 4, G + 36, HW - 30, FPY1 + 4, G + 40, { color: trimC }, 'mantel');
  box(HW - 50, FPY0 - 4, G - 4 + 4, HW - 30, FPY1 + 4, G + 2, { color: [150, 70, 50] }, 'hearth');
  // living room: sofa facing the fire, a low table
  const sofaC = pick([[120, 60, 56], [70, 90, 120], [110, 120, 92], [150, 140, 120]]);
  box(214, FPY0 - 20, G, 230, FPY1 + 20, G + 10, { color: sofaC }, 'sofa seat');
  box(206, FPY0 - 20, G, 214, FPY1 + 20, G + 22, { color: shade(sofaC, 0.85) }, 'sofa back');
  box(244, FPY0 + 4, G, 270, FPY1 - 4, G + 12, { color: [110, 76, 50] }, 'coffee table');
  light(260, 70, GC); light(260, 220, GC);
  // dining room: table and four chairs
  box(40, 56, G, 80, 94, G + 22, { color: [120, 84, 54] }, 'dining table');
  for (const [x0, y0] of [[48, 44], [64, 44], [48, 98], [64, 98]]) box(x0, y0, G, x0 + 8, y0 + 8, G + 12, { color: [96, 66, 42] }, 'chair');
  light(60, 76, GC);
  // kitchen: counter run on the back wall under the window, fridge in the corner
  const KB = HD - 10, CAB = pick([[230, 226, 214], [120, 150, 130], [150, 110, 76]]), TOP = pick([[60, 60, 64], [226, 222, 214]]);
  box(14, KB - 26, G, 36, KB - 4, G + 56, { color: [236, 236, 236] }, 'fridge');
  box(32, KB - 28, G + 30, 34, KB - 26, G + 48, METAL, 'fridge handle');
  for (let x = 40, k = 0; x < 106; x += 22, k++) box(x, KB - 20, G, Math.min(106, x + 22), KB, G + 26, { color: shade(CAB, k % 2 ? 0.94 : 1) }, 'base cabinet');
  box(40, KB - 22, G + 26, 106, KB, G + 30, { color: TOP }, 'worktop');
  box(48, KB - 18, G + 30, 68, KB - 6, G + 32, METAL, 'sink');
  box(84, KB - 18, G + 30, 102, KB - 4, G + 32, { color: [36, 36, 38] }, 'hob');
  light(60, 210, GC, [255, 244, 220]);
  light(150, 30, GC); light(135, 220, GC);
  // bedrooms: beds against the knee wall / partition, a rug, a dresser
  const bed = (x0, y0, x1, y1, head, c) => {
    box(x0, y0, U, x1, y1, U + 10, { color: [110, 76, 50] }, 'bed frame');
    box(x0 + 2, y0 + 2, U + 10, x1 - 2, y1 - 2, U + 14, { color: c }, 'bedspread');
    const [hx0, hy0, hx1, hy1] = head;
    box(hx0, hy0, U, hx1, hy1, U + 28, { color: [96, 66, 42] }, 'headboard');
  };
  bed(52, 150, 88, 200, [52, 200, 88, 204], pick([[180, 60, 60], [70, 100, 150], [210, 200, 170]]));
  box(36, 20, U, 60, 32, U + 30, { color: [120, 84, 54] }, 'dresser');
  light(70, 110, UC);
  bed(250, 20, 286, 70, [250, 16, 286, 20], pick([[120, 150, 110], [200, 160, 120], [90, 90, 140]]));
  light(250, 70, UC);
  light(150, 190, UC); light(135, 35, UC);
  // bathroom: tub on the lining wall, toilet, vanity on the knee wall
  const TUB = [244, 244, 240], BL = U, BX = HW - 30;
  box(BX - 26, 134, BL, BX - 4, 186, BL + 2, { color: TUB }, 'tub bottom');
  box(BX - 26, 134, BL + 2, BX - 4, 138, BL + 16, { color: TUB }, 'tub end');
  box(BX - 26, 182, BL + 2, BX - 4, 186, BL + 16, { color: TUB }, 'tub end');
  box(BX - 26, 138, BL + 2, BX - 22, 182, BL + 16, { color: TUB }, 'tub side');
  box(BX - 8, 138, BL + 2, BX - 4, 182, BL + 16, { color: TUB }, 'tub side');
  box(BX - 22, 138, BL + 2, BX - 8, 182, BL + 8, { color: [150, 200, 220], material: 'BMC_Glass' }, 'bath water');
  box(200, 190, BL, 210, 200, BL + 8, { color: TUB }, 'toilet base');
  box(198, 186, BL + 8, 212, 202, BL + 12, { color: TUB }, 'toilet seat');
  box(200, 198, BL + 12, 210, 204, BL + 24, { color: TUB }, 'toilet tank');
  box(226, 192, BL, 250, 204, BL + 24, { color: [120, 86, 60] }, 'vanity');
  box(224, 190, BL + 24, 252, 204, BL + 26, { color: [232, 230, 226] }, 'vanity top');
  box(232, 194, BL + 26, 244, 200, BL + 28, METAL, 'basin');
  light(250, 170, UC, [255, 244, 220]);

  // ------------------------------------------------------------- porch --
  // full width: skirt + plank deck (boards running out from the house), columns, beam, face-down ceiling,
  // a shallow shed roof of three courses up to the wall under the dormer windows
  box(0, -PD, 0, HW, 0, 16, { color: WHITE }, 'porch skirt');
  for (let x = 0, k = 0; x < HW; x += 10, k++) box(x, -PD, 16, x + 10, 0, 20, { color: shade(deckC, F[k % 6]) }, 'porch board');
  const doorC0 = (fd.a0 + fd.a1) / 2;
  const cols = [10, doorC0 - 40, doorC0 + 40, HW - 10];
  if (HW - 10 - (doorC0 + 40) > 140) cols.splice(3, 0, Math.round((doorC0 + 40 + HW - 10) / 20) * 10);
  for (const cx of cols) {
    box(cx - 6, -PD, 20, cx + 6, -PD + 12, 24, { color: WHITE }, 'column base');
    box(cx - 4, -PD + 2, 24, cx + 4, -PD + 10, 74, { color: WHITE }, 'column');
    box(cx - 6, -PD, 74, cx + 6, -PD + 12, 78, { color: WHITE }, 'column capital');
  }
  box(-10, -PD - 2, 78, HW + 10, -PD + 10, 90, { color: WHITE }, 'porch beam');
  box(0, -PD + 10, 86, HW, -4, 90, { asset: TILE, color: [214, 226, 232], direction: 5 }, 'porch ceiling'); // haint blue
  box(0, -4, 86, fd.a0 - 4, 0, 90, { color: WHITE }, 'porch ceiling trim');
  box(fd.a1 + 4, -4, 86, HW, 0, 90, { color: WHITE }, 'porch ceiling trim');
  const porch = [{ y0: -30, y1: 0, zb: 106, zt: 114 }, { y0: -60, y1: -30, zb: 98, zt: 106 }, { y0: -PD - 2, y1: -60, zb: 90, zt: 98 }];
  layY(porch, -10, HW + 10, -1, 'porch roof');
  for (const xe of [-10, HW]) for (const b of porch) box(xe, Math.max(b.y0, -PD + 10), 78, xe + 10, b.y1, b.zb, { color: WHITE }, 'porch end board');
  box(doorC0 - 30, -PD - 12, 0, doorC0 + 30, -PD, 10, { color: [176, 172, 166] }, 'porch step');
  box(doorC0 - 20, -Y0, 0, doorC0 + 20, -PD - 12, 4, { asset: TILE, color: [184, 180, 172] }, 'front walk');
  light(doorC0, -40, 86, [255, 236, 190]);

  // ----------------------------------------------------------- chimney --
  // up the outside of the living room gable to above the ridge; the breast fills in under the rake
  const CY0 = 118, CY1 = 158;
  for (let z = 0, k = 0; z < 260; z += 12, k++) {
    const zt = Math.min(260, z + 12), c = shade(brickC, F[k % 6]);
    box(HW + 10, CY0, z, HW + 50, CY1, zt, { color: c }, 'chimney');
    if (zt <= RZ - 8) box(HW, CY0, z, HW + 10, CY1, zt, { color: c }, 'chimney breast');
  }
  box(HW + 8, CY0 - 2, 260, HW + 52, CY1 + 2, 266, { color: [120, 118, 114] }, 'chimney cap');
  box(HW + 22, CY0 + 12, 266, HW + 38, CY1 - 12, 274, { color: [150, 80, 60] }, 'chimney pot');

  // ------------------------------------------------------------ garage --
  // detached, front-gabled, siding to match; panelled door, a side door toward the house, a hoop on the gable
  const GD = op(GX0 + 20, GX1 - 20, 4, 68);
  box(GX0 + 10, GY0 + 10, 0, GX1 - 10, GY1 - 10, 4, { asset: TILE, color: [166, 164, 158] }, 'garage floor');
  const gSide = [op(220, 256, 36, 62)], gDoor = op(300, 330, 4, 66);
  wall('x', GY0, GX0, GX1, 0, 90, 'siding', [GD], 'garage front');
  wall('x', GY1 - 10, GX0, GX1, 0, 90, 'siding', [op(GX0 + 60, GX0 + 96, 36, 62)], 'garage back');
  wall('y', GX0, GY0 + 10, GY1 - 10, 0, 90, 'siding', gSide, 'garage side');
  wall('y', GX1 - 10, GY0 + 10, GY1 - 10, 0, 90, 'siding', [gDoor], 'garage side');
  windowIn('y', GX0, -1, gSide[0]); windowIn('x', GY1 - 10, 1, op(GX0 + 60, GX0 + 96, 36, 62));
  box(GX1 - 40, gDoor.a0, 4, GX1 - 10, gDoor.a0 + 4, gDoor.z1, { color: doorC }, 'garage side door (open)');
  for (let z = GD.z0; z < GD.z1 - 4; z += 16) { const zt = Math.min(GD.z1 - 4, z + 16); box(GD.a0 + 4, GY0 + 3, z, GD.a1 - 4, GY0 + 7, zt - 2, { color: WHITE }, 'garage door'); box(GD.a0 + 4, GY0 + 5, zt - 2, GD.a1 - 4, GY0 + 7, zt, { color: shade(WHITE, 0.85) }, 'garage door groove'); }
  box(GD.a0, GY0 - 2, GD.z1 - 4, GD.a1, GY0, GD.z1, { color: WHITE }, 'garage trim');
  const gc = (GX0 + GX1) / 2;
  const gL = courses(gc, 170, -1, [{ n: 9, per: 10, w: 10 }]), gR = courses(gc, 170, 1, [{ n: 9, per: 10, w: 10 }]);
  for (const [L, dir] of [[gL, -1], [gR, 1]]) L.forEach((b, i) => {
    const eave = i === L.length - 1;
    box(b.y0, GY0 - 10, b.zb, b.y1, GY1 + 10, b.zb + 4, { color: eave ? WHITE : shade(roofC, 0.82) }, 'garage roof lip');
    wedge(b.y0, GY0 - 10, b.zb + 4, b.y1, GY1 + 10, b.zt, [[-dir, 0]], shade(roofC, [1, 0.95, 1.03][i % 3]), 'garage roof');
  });
  box(gc - 6, GY0 - 10, 170, gc + 6, GY1 + 10, 174, { color: shade(roofC, 0.8) }, 'garage ridge cap');
  for (const yl of [GY0, GY1 - 10]) for (let i = 1; i < 8; i++) { // gables under the courses
    const zb = 160 - 10 * i;
    for (const [z, zt] of laps(zb, zb + 10)) piece('x', yl, gc - 10 * i, gc + 10 * i, z, zt, lapColor(), 'garage gable');
  }
  box(gc - 24, GY0 - 4, 96, gc + 24, GY0, 124, { color: WHITE }, 'backboard');
  for (const [a0, z0, a1, z1] of [[-10, 100, 10, 102], [-10, 112, 10, 114], [-10, 102, -8, 112], [8, 102, 10, 112]]) box(gc + a0, GY0 - 6, z0, gc + a1, GY0 - 4, z1, { color: [220, 90, 40] }, 'backboard square');
  box(gc - 10, GY0 - 22, 98, gc + 10, GY0 - 20, 100, { color: [230, 100, 30] }, 'rim');
  box(gc - 10, GY0 - 20, 98, gc - 8, GY0 - 6, 100, { color: [230, 100, 30] }, 'rim');
  box(gc + 8, GY0 - 20, 98, gc + 10, GY0 - 6, 100, { color: [230, 100, 30] }, 'rim');
  box(GX1 - 50, GY1 - 30, 4, GX1 - 14, GY1 - 10, 30, { color: [120, 84, 54] }, 'workbench');
  box(GD.a0 - 10, -Y0, 0, GD.a1 + 10, GY0, 4, { asset: TILE, color: [96, 96, 98] }, 'driveway');
  box(GD.a0 + 30, GY0 - 2, 70, GD.a0 + 38, GY0, 80, GLOW([255, 236, 190], 3), 'garage light');

  // ------------------------------------------------------------- output --
  const Wst = Math.ceil((X0 + HW + 52) / 10) - 1, Dst = Math.ceil((Y0 + GY1 + 10) / 10) - 1;
  const total = (Wst + 1) * 10;
  let bricks = B.bricks.map(({ label, ...b }) => b);
  let doorX = X0 + doorC0;
  if (mirror) {
    bricks = bricks.map(({ _m, _tri, ...b }) => {
      const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
      if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] };
      return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
    });
    doorX = total - doorX;
  } else bricks = bricks.map(({ _m, _tri, ...b }) => b);
  return { bricks, W: Wst, D: Dst, door: [Math.round(doorX / 10)], count: bricks.length };
}

if (process.argv[1]?.endsWith('dutchcolonial.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'dutchcolonial.json';
  const h = dutchColonial({ seed, mirror: process.argv[4] === 'mirror' });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`dutch colonial seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}`);
}
