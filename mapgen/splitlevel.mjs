// Split-level ranch (2026-10-17, owner photo: "make houses that can look like this"):
// a two-storey block (brick garage below, lap siding above, two windows) beside a
// one-storey wing half a level up (stone front, picture window, front door on a
// stoop with steps), both under shallow hip roofs with deep eaves and white fascia,
// a brick chimney on the wing's outer end, a concrete driveway to the garage, and a
// flat-roofed kitchen addition behind the wing.
//
// PLAYER SCALE (owner: "counters shoulder height ... adjust scale to reflect"; BUILDING.md):
// a player is ~54 units tall, so everything is real size x 0.31 units/cm: ceilings 76,
// doors 62 x 30, sills 26, window heads 62, counters 28, stair risers 6 on 1-stud treads.
//
// Inside: the front door opens into the living room (main level, the wing). A doorway in
// the shared wall leads onto landing L0; half a flight up (7 risers) along the garage
// partition to the hall / bedroom / bathroom level, half a flight down along the back
// wall to the family room behind the garage. The flights run flush against the walls.
// Every room is finished (owner: "wallpaper the house ... baseboards, chair rails, door
// casing ... crown molding using micro blocks"): wallpaper is laid in pattern columns /
// cells so every brick seam falls on a colour change (no merged-slab seams), trims in
// micro bricks, casings round every door and window, ceilings face-down tiles.
//
//   splitLevel({ seed, mirror }) -> { bricks, W, D, door } local units, front face on
//   y = 0 looking -y, x from 0 to (W + 1) * 10, y from 0 to (D + 1) * 10 (shapedTown's frame);
//   door = the front door's x in studs
//   node mapgen/splitlevel.mjs [seed] [out.json]   (bricks for isoview.mjs)

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { townCourses } from './roofs.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [240, 240, 234], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const METAL = { color: [190, 190, 196], material: 'BMC_Metallic' };

const BRICKS = [[150, 70, 50], [138, 62, 44], [160, 84, 60], [124, 66, 52], [170, 100, 72]];
const SIDING = [[214, 204, 178], [226, 218, 196], [196, 204, 196], [210, 196, 170], [188, 196, 206], [232, 226, 214]];
const STONE = [[[132, 128, 120], [112, 108, 102], [150, 144, 132], [96, 94, 90]], [[150, 134, 112], [128, 114, 96], [168, 152, 126], [110, 98, 86]], [[120, 124, 128], [100, 104, 110], [140, 144, 146], [88, 90, 96]]];
const ROOFS = [[92, 86, 82], [110, 100, 90], [74, 74, 78], [120, 96, 78], [96, 104, 112]];
const GDOOR = [[244, 244, 240], [236, 232, 220], [200, 196, 188], [120, 90, 64]];
const FDOOR = [[120, 70, 44], [90, 52, 36], [60, 80, 60], [140, 40, 36], [40, 56, 84]];
// wallpapers: a repeat of [width, colour] columns, or cells (check); every seam is a colour change
const PAPERS = [
  { kind: 'stripe', cols: [[6, [214, 196, 160]], [4, [196, 174, 136]]] },
  { kind: 'stripe', cols: [[8, [190, 206, 196]], [2, [236, 236, 226]]] },
  { kind: 'stripe', cols: [[10, [222, 206, 186]], [10, [206, 186, 166]]] },
  { kind: 'stripe', cols: [[6, [170, 186, 210]], [2, [230, 230, 236]], [2, [150, 166, 196]], [2, [230, 230, 236]]] },
  { kind: 'stripe', cols: [[4, [150, 60, 60]], [4, [196, 160, 120]]] },
  { kind: 'check', w: 10, h: 12, colors: [[220, 214, 196], [204, 196, 176]] },
  { kind: 'check', w: 10, h: 12, colors: [[200, 216, 226], [184, 202, 214]] },
  { kind: 'stripe', cols: [[8, [226, 220, 200]], [2, [180, 140, 90]]] },
  { kind: 'paint', color: [232, 226, 210] },
  { kind: 'paint', color: [196, 214, 200] },
];
const WAINS = [
  { kind: 'stripe', cols: [[2, [236, 234, 226]], [2, [222, 220, 212]]] },  // beadboard
  { kind: 'stripe', cols: [[4, [120, 86, 58]], [4, [108, 76, 50]]] },      // wood panelling
  { kind: 'paint', color: [120, 140, 120] },
  { kind: 'paint', color: [236, 232, 222] },
];
const TILEWAINS = [
  { kind: 'check', w: 10, h: 6, colors: [[244, 244, 240], [228, 232, 232]] },
  { kind: 'check', w: 10, h: 6, colors: [[176, 210, 214], [160, 198, 204]] },
  { kind: 'check', w: 10, h: 12, colors: [[236, 236, 232], [70, 110, 150]] },
];
const TRIMS = [[244, 242, 236], [236, 230, 216], [120, 84, 54], [92, 62, 40]];

export function splitLevel({ seed = 1, mirror = false } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  // ---------------------------------------------------------------- frame --
  // built with the split block on the left (x 0..SW); mirror flips x at the end
  const SW = 260;                                   // split block width 26 studs
  const WW = 280;                                   // wing width 28 studs (the house fits the 15-cell flat of a roadside lot)
  const DD = 270;                                   // depth 27 studs (back wall 260..270)
  const WF = 20;                                    // the wing stands 2 studs back from the split block's front
  const OV = 20;                                    // eaves
  const EXT = 120 + Math.floor(r() * 3) * 20;       // kitchen addition depth behind the wing
  const STEPS = 7;                                  // front steps (6-unit risers from the main floor)
  const X0 = OV, Y0 = 30 + STEPS * 10 + 10;         // local origin: room for the eave (left) and the steps (front)
  // levels: floor tops and ceiling undersides (player scale: 76 clear, 84 a storey, a half level 42)
  const L = { slab: 4, main: 46, upper: 88, lowCeil: 80, mainCeil: 122, upCeil: 164, upTop: 168, wingTop: 126, kCeil: 118, kTop: 122 };
  const DOOR = 62, SILL = 26, HEAD = 62;
  const brickC = pick(BRICKS), sidingC = pick(SIDING), stone = pick(STONE), roofC = pick(ROOFS);
  const gdoorC = pick(GDOOR), fdoorC = pick(FDOOR), stoneFront = r() < 0.7, wingSiding = r() < 0.5;
  const trimC = pick(TRIMS);
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const F = [1, 0.93, 1.05, 0.97, 1.02, 0.9];
  let nk = 0;
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`splitlevel: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  // floors (tilefloors.mjs): add() in local units, flat diagonal wedges carry _tri for the mirror
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('splitlevel: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {}; // one floor style per room kind
  const floor = (room, rect, top) => tileFloor(fadd, rect, top, style[room] ??= pickRoomStyle(room, r), r);

  // ------------------------------------------------------------ walls --
  // wall(axis 'x' | 'y', line (the wall's low face), a0, a1, z0, z1, skin, openings [{a0, a1, z0, z1}])
  // skins: brick (running bond, 12 courses), siding (6-high laps, two shades), stone (random blocks),
  // paint (interior partitions: plain, the rooms' finishes cover them). Every wall is registered so
  // the room finishes find their faces and openings.
  const WALLS = [];
  const piece = (axis, line, a, b, z, zt, color, label) => axis === 'x'
    ? box(a, line, z, b, line + 10, zt, { color }, label) : box(line, a, z, line + 10, b, zt, { color }, label);
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall') {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings });
    const row = skin === 'siding' ? 6 : skin === 'paint' ? 1000 : 12;
    for (let z = z0, k = 0; z < z1; z += row, k++) {
      const zt = Math.min(z1, z + row);
      // pieces of this course: the full run, then each opening cuts its a-range; where the opening
      // only covers part of the course height the bricks over / under it stay (shorter), the rest
      // of the course runs on at full height
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
      for (const { p, q, z: pz, zt: pzt } of pcs) {
        if (q <= p || pzt <= pz) continue;
        if (skin === 'siding') { piece(axis, line, p, q, pz, pzt, shade(sidingC, k % 2 ? 0.94 : 1), label + ' siding'); continue; }
        if (skin === 'paint') { piece(axis, line, p, q, pz, pzt, [200, 196, 188], label); continue; }
        // bricks keep the course's bond: joints at fixed places along the wall (offset every other course)
        const off = skin === 'brick' ? (k % 2 ? 20 : 0) : 0;
        let a = p;
        while (a < q) {
          let b = skin === 'brick' ? Math.floor((a - a0 - off) / 40) * 40 + a0 + off + 40 : a + 20 + Math.floor(r() * 4) * 10;
          if (q - b < 10) b = q;
          const c = skin === 'brick' ? shade(brickC, F[(Math.floor((a - a0 + off) / 40) * 7 + k * 3) % F.length]) : stone[Math.floor(r() * stone.length)];
          piece(axis, line, a, Math.min(q, b), pz, pzt, c, label + ' ' + skin);
          a = Math.min(q, b);
        }
      }
    }
  }
  // a window in an opening: white frame, glass pane, a sill proud of the outside face (out = -1 / +1 from line)
  function windowIn(axis, line, out, o) {
    const T = { color: WHITE };
    const lo = out < 0 ? line - 4 : line + 10, hi = lo + 4;
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    pb(o.a0, o.a1, o.z0, o.z0 + 4, T, 'window frame');
    pb(o.a0, o.a1, o.z1 - 4, o.z1, T, 'window frame');
    pb(o.a0, o.a0 + 4, o.z0 + 4, o.z1 - 4, T, 'window frame');
    pb(o.a1 - 4, o.a1, o.z0 + 4, o.z1 - 4, T, 'window frame');
    const mids = o.a1 - o.a0 >= 80 ? [o.a0 + Math.round((o.a1 - o.a0) / 3 / 2) * 2, o.a1 - Math.round((o.a1 - o.a0) / 3 / 2) * 2] : o.a1 - o.a0 >= 50 ? [Math.round((o.a0 + o.a1) / 4) * 2] : [];
    for (const m of mids) pb(m - 2, m + 2, o.z0 + 4, o.z1 - 4, T, 'mullion', line + 3, line + 7);
    let a = o.a0 + 4;
    for (const m of [...mids, o.a1 - 2]) { pb(a, m - 2, o.z0 + 4, o.z1 - 4, GLASS, 'glass', line + 4, line + 6); a = m + 2; }
    pb(o.a0 - 4, o.a1 + 4, o.z0 - 4, o.z0, { color: [200, 196, 188] }, 'sill', lo, hi);
  }
  const op = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });

  // ---------------------------------------------------- interior finishes --
  // layer bands up a wall face, from the floor top z0 to the ceiling z1: [z from, z to, thickness, kind]
  const bands = (z0, z1) => [
    [z0, z0 + 6, 4, 'base'], [z0 + 6, z0 + 22, 2, 'wains'], [z0 + 22, z0 + 26, 4, 'rail'],
    [z0 + 26, z1 - 6, 2, 'paper'], [z1 - 6, z1 - 4, 4, 'crown'], [z1 - 4, z1, 6, 'crown'],
  ];
  // pattern pieces of one band: along a (a0..a1), z (z0..z1); put(a, b, z, zt, colour)
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
  // the faces of a room rect: side, axis of the wall, face coordinate, inward sign
  const SIDES = { y0: ['x', 1], y1: ['x', -1], x0: ['y', 1], x1: ['y', -1] };
  function faceWall(side, R) {
    const [axis] = SIDES[side];
    const f = { y0: R.y0, y1: R.y1, x0: R.x0, x1: R.x1 }[side];
    const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
    return WALLS.filter(w => w.axis === axis && (side.endsWith('0') ? w.line + 10 === f : w.line === f) && w.a0 < hi && w.a1 > lo && w.z0 < R.z1 && w.z1 > R.z0);
  }
  // a layer piece on a face: along a..b, z..zt, thickness t from the face
  function facePiece(side, R, a, b, z, zt, t, color, label) {
    const [axis, d] = SIDES[side];
    const f = { y0: R.y0, y1: R.y1, x0: R.x0, x1: R.x1 }[side];
    const [c0, c1] = d > 0 ? [f, f + t] : [f - t, f];
    if (axis === 'x') box(a, c0, z, b, c1, zt, { color }, label); else box(c0, a, z, c1, b, zt, { color }, label);
  }
  // finish a room: R = { x0, y0, x1, y1, z0 floor top, z1 ceiling }, paper, wains, skip { side: [[a0, a1], ...] }
  function finishRoom(R, { paper, wains, skip = {}, noCasing = [] } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0;
    for (const side of Object.keys(SIDES)) {
      if (!has[side]) continue;
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ops = faceWall(side, R).flatMap(w => w.openings).filter(o => o.z0 < R.z1 && o.z1 > R.z0 && o.a0 < hi && o.a1 > lo);
      for (const [z0, z1, t, kind] of bands(R.z0, R.z1)) {
        // the run along the face, shortened at the corners where the crossing face carries the same band
        let a0 = axis === 'x' ? R.x0 : R.y0, a1 = axis === 'x' ? R.x1 : R.y1;
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
      // casings: jambs and a head round every opening, a stool under windows
      for (const o of ops) {
        if (noCasing.some(([s, a]) => s === side && a === o.a0)) continue;
        if ((skip[side] ?? []).some(([p0, p1]) => o.a0 < p1 && o.a1 > p0)) continue; // that run finishes itself
        const door = o.z0 <= R.z0 + 2;
        const jz0 = door ? R.z0 : o.z0, top = Math.min(R.z1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, 4, trimC, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, 4, trimC, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, 4, trimC, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 6, trimC, 'stool');
      }
    }
  }
  // plain wallpaper on a face run (the stairwell: no trims, the stairs stand flush on it)
  function paperRun(side, R, a0, a1, z0, z1, paper) {
    const ops = faceWall(side, R).flatMap(w => w.openings).filter(o => o.a0 < a1 && o.a1 > a0 && o.z0 < z1 && o.z1 > z0);
    const as = [...new Set([a0, a1, ...ops.flatMap(o => [o.a0, o.a1]).filter(v => v > a0 && v < a1)])].sort((u, v) => u - v);
    for (let i = 0; i + 1 < as.length; i++) {
      const p = as[i], q = as[i + 1], cover = ops.filter(o => o.a0 <= p && o.a1 >= q);
      const zs = [...new Set([z0, z1, ...cover.flatMap(o => [o.z0, o.z1]).filter(v => v > z0 && v < z1)])].sort((u, v) => u - v);
      for (let k = 0; k + 1 < zs.length; k++) {
        if (cover.some(o => o.z0 <= zs[k] && o.z1 >= zs[k + 1])) continue;
        patterned(paper, p, q, zs[k], zs[k + 1], (u, v, zz, zt, c) => facePiece(side, R, u, v, zz, zt, 2, c, 'stairwell paper'));
      }
    }
  }
  const paperOf = () => pick(PAPERS);

  // ------------------------------------------------------- split block --
  const lx0 = SW - 50;                                                 // L0 x lx0..SW-12 (38 wide), flights -x from it
  const PY = 170, HY = 180, BY = DD - 10;                              // partition y PY..HY, back wall face BY
  const BXW = SW - 170;                                                // bathroom wall x BXW..BXW+10 (upper level)
  const GD = op(30, SW - 30, L.slab, L.slab + 64);                     // garage door opening
  const upWin = [op(30, 90, L.upper + SILL, L.upper + HEAD), op(SW - 90, SW - 30, L.upper + SILL, L.upper + HEAD)];
  floor('garage', [10, 10, SW - 10, PY], L.slab);
  box(10, PY, 0, SW - 10, HY, L.slab, { color: [150, 148, 144] }, 'partition footing');
  floor('family', [10, HY, SW - 10, BY], L.slab);
  // front: brick to the upper floor, siding above
  wall('x', 0, 0, SW, 0, L.lowCeil + 4, 'brick', [GD], 'split front');
  wall('x', 0, 0, SW, L.lowCeil + 4, L.upTop, 'siding', upWin, 'split front');
  upWin.forEach(w => windowIn('x', 0, -1, w));
  for (let z = GD.z0; z < GD.z1 - 4; z += 14) { const zt = Math.min(GD.z1 - 4, z + 14); box(GD.a0 + 4, 3, z, GD.a1 - 4, 7, zt - 2, { color: gdoorC }, 'garage door'); box(GD.a0 + 4, 5, zt - 2, GD.a1 - 4, 7, zt, { color: shade(gdoorC, 0.85) }, 'garage door groove'); }
  box(GD.a0, 0, GD.z1 - 4, GD.a1, 10, GD.z1, { color: WHITE }, 'garage trim');
  box(GD.a0, 0, GD.z0, GD.a0 + 4, 10, GD.z1 - 4, { color: WHITE }, 'garage trim');
  box(GD.a1 - 4, 0, GD.z0, GD.a1, 10, GD.z1 - 4, { color: WHITE }, 'garage trim');
  box(SW - 22, -4, 38, SW - 14, 0, 50, GLOW([255, 236, 190], 3), 'coach light');
  // outer side (x 0): family room window below, bedroom + bathroom windows above
  const sideLow = [op(200, 240, L.slab + SILL, L.slab + HEAD)];
  const sideUp = [op(60, 110, L.upper + SILL, L.upper + HEAD), op(200, 240, L.upper + SILL, L.upper + HEAD)];
  wall('y', 0, 10, DD, 0, L.lowCeil + 4, 'brick', sideLow, 'split side');
  wall('y', 0, 10, DD, L.lowCeil + 4, L.upTop, 'siding', sideUp, 'split side');
  [...sideLow, ...sideUp].forEach(w => windowIn('y', 0, -1, w));
  // back: family room window below, bathroom window above
  const backLow = [op(40, 80, L.slab + SILL, L.slab + HEAD)], backUp = [op(20, 50, L.upper + SILL, L.upper + HEAD)];
  const yardDoor = op(100, 130, L.slab, L.slab + DOOR); // owner 2026-10-17: "basement needs backyard exit"
  wall('x', BY, 10, SW - 10, 0, L.lowCeil + 4, 'brick', [...backLow, yardDoor], 'split back');
  box(yardDoor.a0 - 4, BY + 10, yardDoor.z0, yardDoor.a0, BY + 14, yardDoor.z1 + 4, { color: WHITE }, 'yard door case');
  box(yardDoor.a1, BY + 10, yardDoor.z0, yardDoor.a1 + 4, BY + 14, yardDoor.z1 + 4, { color: WHITE }, 'yard door case');
  box(yardDoor.a0, BY + 10, yardDoor.z1, yardDoor.a1, BY + 14, yardDoor.z1 + 4, { color: WHITE }, 'yard door case');
  box(yardDoor.a0 - 10, BY + 14, 0, yardDoor.a1 + 10, BY + 44, 4, { asset: TILE, color: [168, 166, 160] }, 'yard pad');
  box(yardDoor.a0, BY - 30, L.slab, yardDoor.a0 + 4, BY, yardDoor.z1, { color: pick(FDOOR) }, 'yard door (open)');
  wall('x', BY, 10, SW - 10, L.lowCeil + 4, L.upTop, 'siding', backUp, 'split back');
  [...backLow, ...backUp].forEach(w => windowIn('x', BY, 1, w));
  // shared wall (x SW-10): the doorway from the living room onto L0
  const l0Door = op(190, 220, L.main, L.main + DOOR);
  wall('y', SW - 10, 10, DD, 0, L.upTop, 'siding', [l0Door], 'shared wall');
  // partitions: garage / family room (lower), bedroom / hall (upper), bathroom / hall (upper)
  const gDoor = op(30, 60, L.slab, L.slab + DOOR), bedDoor = op(lx0 - 100, lx0 - 70, L.upper, L.upper + DOOR), bathDoor = op(222, 252, L.upper, L.upper + DOOR);
  wall('x', PY, 10, SW - 10, L.slab, L.lowCeil, 'paint', [gDoor], 'garage partition');
  wall('x', PY, 10, SW - 10, L.upper, L.upCeil, 'paint', [bedDoor], 'bedroom partition');
  wall('y', BXW, HY, BY, L.upper, L.upCeil, 'paint', [bathDoor], 'bathroom partition');
  // stairs, flush on the stairwell paper (2 thick): L0 x lx0..SW-12, y HY+2..BY-2; up flight along the
  // partition (y HY+2..220), down flight along the back wall (y 220..BY-2), both 6 treads going -x
  const SY = HY + 2, SM = 220, SB = BY - 2;
  box(lx0, SY, L.slab, SW - 12, SB, L.main - 4, { color: [150, 146, 140] }, 'L0 base');
  const TREAD = [128, 90, 58], RISER = shade(TREAD, 0.86);
  box(lx0, SY, L.main - 4, SW - 12, SB, L.main, { color: TREAD }, 'L0 floor');
  for (let k = 1; k <= 6; k++) {
    const xa = lx0 - 10 * k, xb = xa + 10;
    box(xa, SY, L.slab, xb, SM, L.main + 6 * k - 2, { color: RISER }, 'up step');
    box(xa, SY, L.main + 6 * k - 2, xb, SM, L.main + 6 * k, { color: TREAD }, 'up tread');
    box(xa, SM, L.slab, xb, SB, L.main - 6 * k - 2, { color: RISER }, 'down step');
    box(xa, SM, L.main - 6 * k - 2, xb, SB, L.main - 6 * k, { color: TREAD }, 'down tread');
  }
  // floor sandwich: lower ceiling (80..84) + upper floors (84..88), open over the stairwell
  const HOLE = [lx0 - 60, HY, SW - 10, BY];
  box(10, 10, L.lowCeil, SW - 10, HY, L.lowCeil + 4, { color: [232, 230, 224] }, 'lower ceiling');
  box(10, HY, L.lowCeil, HOLE[0], BY, L.lowCeil + 4, { color: [232, 230, 224] }, 'lower ceiling');
  floor('bedroom', [10, 10, SW - 10, PY], L.upper);
  box(10, PY, L.upper - 4, SW - 10, HY, L.upper, { color: [150, 112, 78] }, 'partition sill');
  floor('bathroom', [10, HY, BXW, BY], L.upper);
  box(BXW, HY, L.upper - 4, BXW + 10, BY, L.upper, { color: [150, 112, 78] }, 'partition sill');
  floor('hall', [BXW + 10, HY, HOLE[0], BY], L.upper);
  box(10, 10, L.upCeil, SW - 10, BY, L.upTop, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'upper ceiling');
  // balustrade where the hall looks down the stairwell (not across the top of the up flight)
  const RX = HOLE[0] - 2;
  for (let y = SM; y + 2 <= BY - 4; y += 6) box(RX, y, L.upper, RX + 2, y + 2, L.upper + 24, { color: trimC }, 'baluster');
  box(RX - 2, SM, L.upper + 24, RX + 2, BY - 4, L.upper + 28, { color: shade(trimC, 0.8) }, 'handrail');
  // finishes
  const famPaper = paperOf(), wellPaper = paperOf();
  finishRoom({ x0: 10, y0: HY, x1: SW - 10, y1: BY, z0: L.slab, z1: L.lowCeil }, { paper: famPaper, wains: pick(WAINS), skip: { y0: [[HOLE[0], SW]], y1: [[HOLE[0], SW]], x1: [[0, 1000]] } });
  const well = { x0: HOLE[0], y0: HY, x1: SW - 10, y1: BY, z0: L.slab, z1: L.upCeil };
  paperRun('y0', well, HOLE[0], SW - 10, L.slab, L.upCeil, wellPaper);
  paperRun('y1', well, HOLE[0], SW - 10, L.slab, L.upCeil, wellPaper);
  paperRun('x1', well, HY + 2, BY - 2, L.slab, L.upCeil, wellPaper);
  finishRoom({ x0: 10, y0: 10, x1: SW - 10, y1: PY, z0: L.upper, z1: L.upCeil }, { paper: paperOf(), wains: pick(WAINS) });
  finishRoom({ x0: BXW + 10, y0: HY, x1: HOLE[0], y1: BY, z0: L.upper, z1: L.upCeil }, { paper: wellPaper, wains: pick(WAINS) });
  finishRoom({ x0: 10, y0: HY, x1: BXW, y1: BY, z0: L.upper, z1: L.upCeil }, { paper: paperOf(), wains: pick(TILEWAINS) });
  // bathroom: tub along the outer wall, toilet on the partition, vanity on the back wall (4 off the trims)
  const TUB = [244, 244, 240], BL = L.upper;
  box(14, HY + 4, BL, 36, HY + 56, BL + 2, { color: TUB }, 'tub bottom');
  box(14, HY + 4, BL + 2, 36, HY + 8, BL + 16, { color: TUB }, 'tub end');
  box(14, HY + 52, BL + 2, 36, HY + 56, BL + 16, { color: TUB }, 'tub end');
  box(32, HY + 8, BL + 2, 36, HY + 52, BL + 16, { color: TUB }, 'tub side');
  box(14, HY + 8, BL + 2, 18, HY + 52, BL + 16, { color: TUB }, 'tub side');
  box(18, HY + 8, BL + 2, 32, HY + 52, BL + 8, { color: [150, 200, 220], material: 'BMC_Glass' }, 'bath water');
  box(18, HY + 52, BL + 16, 22, HY + 56, BL + 22, METAL, 'tap');
  box(BXW - 18, HY + 12, BL, BXW - 8, HY + 22, BL + 8, { color: TUB }, 'toilet base');
  box(BXW - 22, HY + 8, BL + 8, BXW - 6, HY + 26, BL + 12, { color: TUB }, 'toilet seat');
  box(BXW - 10, HY + 10, BL + 12, BXW - 4, HY + 24, BL + 24, { color: TUB }, 'toilet tank');
  box(56, BY - 16, BL, 76, BY - 4, BL + 24, { color: [120, 86, 60] }, 'vanity');
  box(54, BY - 18, BL + 24, 78, BY - 4, BL + 26, { color: [232, 230, 226] }, 'vanity top');
  box(60, BY - 14, BL + 26, 72, BY - 8, BL + 28, METAL, 'basin');
  const light = (x, y, z, c = [255, 240, 210]) => box(x - 8, y - 8, z - 2, x + 8, y + 8, z, GLOW(c), 'ceiling light');
  light(Math.round((10 + BXW) / 20) * 10, 220, L.upCeil, [255, 244, 220]);
  light(Math.round(SW / 20) * 10, 90, L.upCeil);
  light(BXW + 30, 240, L.upCeil);
  light(60, 220, L.lowCeil);
  light(Math.round(SW / 20) * 10, 90, L.lowCeil);

  // ---------------------------------------------------------------- wing --
  // two layouts (owner 2026-10-18: "make this kitchen and the old kitchen a variant"):
  //   split: the rear addition holds the kitchen (WX0..WK) beside the second bedroom (WK..WX1)
  //   full:  the kitchen spans the whole rear addition; the second bedroom takes the wing's end
  //          (WL..WX1) behind a partition, the living room narrower (WX0..WL)
  const FULL = r() < 0.5;
  const WX0 = SW, WX1 = SW + WW, WY0 = WF, WY1 = DD;
  const WK = WX1 - 120, WL = WX1 - 120;                               // split: kitchen / bedroom; full: living / bedroom
  const LX1 = FULL ? WL - 10 : WX1 - 10;                              // the living room's far face
  const fd = op(WX0 + 30, WX0 + 60, L.main, L.main + DOOR);
  const pic = FULL ? op(WX0 + 80, LX1 - 20, L.main + 24, L.main + HEAD) : op(WX0 + 100, Math.min(WX1 - 40, WX0 + 220), L.main + 24, L.main + HEAD);
  const bedFront = FULL ? [op(WL + 30, WL + 80, L.main + SILL, L.main + HEAD)] : [];
  const wingSkin = wingSiding ? 'siding' : 'brick';
  wall('x', WY0, WX0, WX1, 0, L.wingTop, stoneFront ? 'stone' : wingSkin, [{ ...fd, z1: fd.z1 + 4 }, pic, ...bedFront], 'wing front');
  WALLS.at(-1).openings = [fd, pic, ...bedFront]; // the finishes see the real door (the head brick fills the top 4)
  [pic, ...bedFront].forEach(w => windowIn('x', WY0, -1, w));
  box(fd.a0, WY0, fd.z1, fd.a1, WY0 + 10, fd.z1 + 4, { color: WHITE }, 'door head');
  box(fd.a0 - 4, WY0 - 4, fd.z0, fd.a0, WY0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a1, WY0 - 4, fd.z0, fd.a1 + 4, WY0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a0, WY0 + 10, fd.z0, fd.a0 + 4, WY0 + 40, fd.z1, { color: fdoorC }, 'door (open)'); // swung in against the jamb
  // the living room opens into the kitchen through a wide arch; the second bedroom's door is off the living room
  const arch = op(WX0 + 40, (FULL ? LX1 : WK) - 50 + (FULL ? 10 : 0), L.main, L.main + DOOR + 8);
  const bed2Door = FULL ? op(WY1 - 80, WY1 - 50, L.main, L.main + DOOR) : op(WK + 30, WK + 60, L.main, L.main + DOOR);
  wall('x', WY1 - 10, WX0, WX1, 0, L.wingTop, wingSkin, FULL ? [arch] : [arch, bed2Door], 'wing back');
  if (FULL) wall('y', WL - 10, WY0 + 10, WY1 - 10, L.main, L.mainCeil, 'paint', [bed2Door], 'bedroom 2 partition');
  const ws = [op(WY0 + 40, WY0 + 80, L.main + SILL, L.main + HEAD), op(WY1 - 80, WY1 - 40, L.main + SILL, L.main + HEAD)];
  wall('y', WX1 - 10, WY0 + 10, WY1 - 10, 0, L.wingTop, wingSkin, ws, 'wing end');
  ws.forEach(w => windowIn('y', WX1 - 10, 1, w));
  box(WX0, WY0 + 10, L.main - 8, WX1 - 10, WY1 - 10, L.main - 4, { color: [140, 136, 130] }, 'wing joists');
  floor('living', [WX0, WY0 + 10, LX1, WY1 - 10], L.main);
  if (FULL) {
    box(WL - 10, WY0 + 10, L.main - 4, WL, WY1 - 10, L.main, { color: [150, 112, 78] }, 'partition sill');
    tileFloor(fadd, [WL, WY0 + 10, WX1 - 10, WY1 - 10], L.main, pickRoomStyle('bedroom', r), r);
  }
  box(WX0, WY0 + 10, L.mainCeil, WX1 - 10, WY1 - 10, L.wingTop, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'wing ceiling');
  finishRoom({ x0: WX0, y0: WY0 + 10, x1: LX1, y1: WY1 - 10, z0: L.main, z1: L.mainCeil }, { paper: paperOf(), wains: pick(WAINS) });
  light(Math.round((WX0 + LX1) / 20) * 10, 140, L.mainCeil);
  if (FULL) {
    finishRoom({ x0: WL, y0: WY0 + 10, x1: WX1 - 10, y1: WY1 - 10, z0: L.main, z1: L.mainCeil }, { paper: paperOf(), wains: pick(WAINS) });
    light(Math.round((WL + WX1) / 20) * 10, 140, L.mainCeil);
  }
  // stoop + steps (6-unit risers) down to the ground in front of the door
  const sx0 = fd.a0 - 10, sx1 = fd.a1 + 10;
  box(sx0, WY0 - 30, 0, sx1, WY0, L.main - 4, { color: [176, 172, 166] }, 'stoop');
  box(sx0, WY0 - 30, L.main - 4, sx1, WY0, L.main, { asset: TILE, color: [190, 186, 180] }, 'stoop top');
  for (let i = 1; i <= STEPS; i++) box(sx0, WY0 - 30 - i * 10, 0, sx1, WY0 - 30 - (i - 1) * 10, L.main - 6 * i, { color: [176, 172, 166] }, 'step');
  // the addition: one storey, flat roof under the wing's eave
  const KY0 = WY1, KY1 = WY1 + EXT, KF = L.main, KB = KY1 - 10;
  const KX1 = FULL ? WX1 - 10 : WK - 10;                              // the kitchen's far face
  const kWin = [op(WX0 + 60, WX0 + 100, KF + 32, KF + HEAD), ...(FULL ? [op(WX1 - 130, WX1 - 90, KF + 32, KF + HEAD)] : [])];
  const bWin = FULL ? [] : [op(WK + 30, WK + 80, KF + SILL, KF + HEAD)], bEnd = [op(KY0 + 30, KY0 + 70, KF + SILL, KF + HEAD)];
  wall('y', WX0, KY0, KY1, 0, L.kTop, wingSkin, [], 'kitchen side');
  wall('x', KB, WX0 + 10, WX1, 0, L.kTop, wingSkin, [...kWin, ...bWin], 'addition back');
  wall('y', WX1 - 10, KY0, KB, 0, L.kTop, wingSkin, bEnd, 'addition end');
  if (!FULL) wall('y', WK - 10, KY0, KB, KF, L.kCeil, 'paint', [], 'kitchen / bedroom partition');
  [...kWin, ...bWin].forEach(w => windowIn('x', KB, 1, w));
  bEnd.forEach(w => windowIn('y', WX1 - 10, 1, w));
  box(WX0 + 10, KY0, L.main - 8, WX1 - 10, KB, L.main - 4, { color: [140, 136, 130] }, 'addition joists');
  floor('kitchen', [WX0 + 10, KY0, KX1, KB], L.main);
  if (!FULL) {
    box(WK - 10, KY0, L.main - 4, WK, KB, L.main, { color: [150, 112, 78] }, 'partition sill');
    tileFloor(fadd, [WK, KY0, WX1 - 10, KB], L.main, pickRoomStyle('bedroom', r), r);
  }
  box(WX0 + 10, KY0, L.kCeil, WX1 - 10, KB, L.kTop, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'addition ceiling');
  box(WX0, KY0, L.kTop, WX1, KY1, L.wingTop, { color: shade(roofC, 0.8) }, 'addition roof');
  box(WX0, KY1, L.kTop, WX1 + 10, KY1 + 10, L.wingTop, { color: WHITE }, 'addition fascia');
  box(WX1, KY0, L.kTop, WX1 + 10, KY1, L.wingTop, { color: WHITE }, 'addition fascia');
  if (!FULL) {
    finishRoom({ x0: WK, y0: KY0, x1: WX1 - 10, y1: KB, z0: KF, z1: L.kCeil }, { paper: paperOf(), wains: pick(WAINS) });
    light(Math.round((WK + WX1) / 20) * 10, KY0 + 50, L.kCeil);
  }
  // the counter run along the kitchen's back wall (its own finish: cabinets, worktop, tiled splashback, wall cabinets)
  const run0 = WX0 + 40, run1 = KX1 - 6; // clear of the far wall's crown (6 deep)
  finishRoom({ x0: WX0 + 10, y0: KY0, x1: KX1, y1: KB, z0: KF, z1: L.kCeil }, { paper: paperOf(), wains: pick(WAINS), skip: { y1: [[run0, run1]] } });
  const CAB = pick([[230, 226, 214], [120, 150, 130], [150, 110, 76], [70, 86, 110]]), TOP = pick([[60, 60, 64], [226, 222, 214], [150, 130, 110]]);
  const splash = pick(TILEWAINS);
  const winSpan = kWin.map(o => [o.a0 - 4, o.a1 + 4]);
  const runs = (p0, p1, gaps) => { let s = [[p0, p1]]; for (const [g0, g1] of gaps) s = s.flatMap(([p, q]) => (g1 <= p || g0 >= q) ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v > u)); return s; };
  for (let x = run0, k = 0; x < run1; x += 20, k++) box(x, KB - 20, KF, Math.min(run1, x + 20), KB, KF + 4, { color: [40, 36, 34] }, 'plinth'), box(x, KB - 20, KF + 4, Math.min(run1, x + 20), KB, KF + 24, { color: shade(CAB, k % 2 ? 0.94 : 1) }, 'base cabinet');
  box(run0, KB - 22, KF + 24, run1, KB, KF + 28, { color: TOP }, 'worktop');
  for (const [p, q] of runs(run0, run1, winSpan)) patterned(splash, p, q, KF + 28, KF + 42, (u, v, zz, zt, c) => box(u, KB - 2, zz, v, KB, zt, { color: c }, 'splashback'));
  for (const o of kWin) { // below the window the splashback stops at the stool; casing round the window
    patterned(splash, o.a0 - 4, o.a1 + 4, KF + 28, o.z0 - 2, (u, v, zz, zt, c) => box(u, KB - 2, zz, v, KB, zt, { color: c }, 'splashback'));
    box(o.a0 - 4, KB - 6, o.z0 - 2, o.a1 + 4, KB, o.z0, { color: trimC }, 'stool');
    box(o.a0 - 4, KB - 4, o.z0, o.a0, KB, o.z1 + 4, { color: trimC }, 'casing');
    box(o.a1, KB - 4, o.z0, o.a1 + 4, KB, o.z1 + 4, { color: trimC }, 'casing');
    box(o.a0, KB - 4, o.z1, o.a1, KB, o.z1 + 4, { color: trimC }, 'casing head');
    box(o.a0 - 4, KB - 2, o.z1 + 4, o.a1 + 4, KB, L.kCeil, { color: shade(CAB, 0.9) }, 'pelmet');
  }
  for (const [p, q] of runs(run0, run1, winSpan)) for (let x = p, k = 0; x < q; x += 20, k++) box(x, KB - 10, KF + 42, Math.min(q, x + 20), KB, L.kCeil, { color: shade(CAB, k % 2 ? 0.94 : 1) }, 'wall cabinet');
  const sinkX = Math.round((kWin[0].a0 + kWin[0].a1) / 20) * 10;
  box(sinkX - 12, KB - 18, KF + 28, sinkX + 12, KB - 6, KF + 30, METAL, 'sink');
  box(sinkX - 2, KB - 10, KF + 30, sinkX + 2, KB - 8, KF + 38, METAL, 'faucet');
  const stX = run1 - 14; // the hob at the far end of the run, clear of the window's stool
  box(stX - 12, KB - 18, KF + 28, stX + 12, KB - 4, KF + 30, { color: [36, 36, 38] }, 'hob');
  for (const [dx, dy] of [[-6, 6], [6, 6], [-6, 12], [6, 12]]) box(stX + dx - 2, KB - 18 + dy - 2, KF + 30, stX + dx + 2, KB - 18 + dy + 2, KF + 32, { color: [160, 40, 20], material: 'BMC_Glow', material_intensity: 1 }, 'burner');
  box(WX0 + 14, KB - 26, KF, WX0 + 36, KB - 4, KF + 56, { color: [236, 236, 236] }, 'fridge');
  box(WX0 + 32, KB - 28, KF + 30, WX0 + 34, KB - 26, KF + 48, METAL, 'fridge handle');
  light(Math.round((WX0 + KX1) / 20) * 10, KY0 + 50, L.kCeil, [255, 244, 220]);
  // chimney on the wing's outer end, standing clear of the eave
  const cy0 = Math.round((WY0 + WY1) / 2 / 10) * 10 - 20;
  for (let z = 0, k = 0; z < 200; z += 12, k++) box(WX1, cy0, z, WX1 + 40, cy0 + 40, Math.min(200, z + 12), { color: shade(brickC, F[k % F.length] * 0.95) }, 'chimney');
  box(WX1 - 2, cy0 - 2, 200, WX1 + 42, cy0 + 42, 206, { color: [120, 118, 114] }, 'chimney cap');

  // --------------------------------------------------------------- roofs --
  function hip(x0, y0, x1, y1, zBase, rise, opts = {}) {
    const LIP = 4, S = Math.min((x1 - x0) * (opts.flatW ? 2 : 1), y1 - y0) / 2; // flatW slopes from one end only
    const { widths, per } = townCourses(S, rise, LIP);
    const lipC = shade(roofC, 0.82);
    let e = 0, k = 0;
    const seg = (ax0, ay0, ax1, ay1, z, ups) => {
      if (ax1 <= ax0 || ay1 <= ay0) return;
      box(ax0, ay0, z, ax1, ay1, z + LIP, { color: k === 0 ? WHITE : lipC }, k === 0 ? 'fascia' : 'roof lip');
      const asset = ups.length === 2 ? 'PB_DefaultMicroWedgeCorner' : 'PB_DefaultMicroWedge';
      const ext = [(ax1 - ax0) / 2, (ay1 - ay0) / 2, (per - LIP) / 2];
      if (!B.add({ asset, ...orientFor(asset, ups, ext), _m: { asset, ups, ext }, color: shade(roofC, [1, 0.95, 1.03][k % 3]), position: [X0 + (ax0 + ax1) / 2, Y0 + (ay0 + ay1) / 2, z + LIP + (per - LIP) / 2] }, 'roof')) throw new Error('splitlevel: roof dropped ' + B.dropped.at(-1));
    };
    for (const w of widths) {
      const ax0 = x0 + (opts.flatW ? 0 : e), ax1 = x1 - e, ay0 = y0 + e, ay1 = y1 - e, z = zBase + k * per;
      if (ax1 <= ax0 || ay1 <= ay0) break;
      const wx = Math.min(w, (ax1 - ax0) / 2), wy = Math.min(w, (ay1 - ay0) / 2);
      const lx = opts.flatW ? 0 : wx; // flatW: the -x side abuts a wall (no hip there)
      seg(ax0 + lx, ay0, ax1 - wx, ay0 + wy, z, [[0, 1]]);
      seg(ax0 + lx, ay1 - wy, ax1 - wx, ay1, z, [[0, -1]]);
      if (!opts.flatW) seg(ax0, ay0 + wy, ax0 + wx, ay1 - wy, z, [[1, 0]]);
      seg(ax1 - wx, ay0 + wy, ax1, ay1 - wy, z, [[-1, 0]]);
      if (!opts.flatW) { seg(ax0, ay0, ax0 + wx, ay0 + wy, z, [[1, 0], [0, 1]]); seg(ax0, ay1 - wy, ax0 + wx, ay1, z, [[1, 0], [0, -1]]); }
      seg(ax1 - wx, ay0, ax1, ay0 + wy, z, [[-1, 0], [0, 1]]);
      seg(ax1 - wx, ay1 - wy, ax1, ay1, z, [[-1, 0], [0, -1]]);
      e += w; k++;
    }
    return zBase + k * per;
  }
  hip(-OV, -OV, SW + OV, DD + OV + 10, L.upTop, 44); // spans even: the back eave 10 deeper
  hip(SW, WY0 - OV, WX1, WY1 + OV + 10, L.wingTop, 36, { flatW: true });

  // ------------------------------------------------------------ driveway --
  box(GD.a0 - 10, -Y0, 0, GD.a1 + 10, 0, 4, { asset: TILE, color: [158, 156, 150] }, 'driveway');
  box(sx0, -Y0, 0, sx1, WY0 - 30 - STEPS * 10, 4, { asset: TILE, color: [176, 172, 166] }, 'front walk');

  // ------------------------------------------------------------- output --
  const Wst = Math.ceil((X0 + WX1 + 40) / 10) - 1, Dst = Math.ceil((Y0 + DD + EXT + 10) / 10) - 1; // studs: (W+1)*10 covers it
  const total = (Wst + 1) * 10;
  let bricks = B.bricks.map(({ label, ...b }) => b);
  let doorX = X0 + (fd.a0 + fd.a1) / 2;
  if (mirror) {
    // x -> total - x: wedge / corner orientations re-derived from their mirrored ups
    bricks = bricks.map(({ _m, _tri, ...b }) => {
      const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
      if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] }; // a flat triangle's owned corner flips in x
      return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
    });
    doorX = total - doorX;
  } else bricks = bricks.map(({ _m, _tri, ...b }) => b);
  return { bricks, W: Wst, D: Dst, door: [Math.round(doorX / 10)], count: bricks.length };
}

if (process.argv[1]?.endsWith('splitlevel.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'splitlevel.json';
  const h = splitLevel({ seed });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`split-level seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}`);
}
