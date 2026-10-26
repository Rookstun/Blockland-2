// 313 Tavistock Dr, Medford NJ (2026-10-26, owner: Zillow link, "build a prototype of this, use floorplan and
// house photos as reference"). A 1972 blue clapboard colonial, built 1 stud = 1 foot off the listing's
// CubiCasa plans:
//   main block 30 x 26 ft, two storeys, side-gabled. Ground: dining (front, triple window) | foyer with the
//   stair rising front-to-back along the garage-side wall; sitting room | kitchen + breakfast nook (slider
//   to the deck) behind. Upstairs: primary bedroom (front) + ensuite, hall bath, stair; hall; walk-in
//   closets; two back bedrooms.
//   wing (garage side), one storey under ONE front-gabled roof running from the two-door garage (projecting
//   20 ft forward) over closet / powder room / hall / laundry and the living room (white brick fireplace,
//   chimney outside) to the screened porch at the back. Deck behind the main block, hot tub off its corner.
// Reuses dutchcolonial.mjs's wall / window / finishRoom / coursed-roof machinery (copied: it closes over B).
// Built in PLAN coordinates (garage on the right seen from the street), then mirrored: the world is
// left-handed, so a viewer facing +y has +x on the left.
//
//   tavistock({ seed }) -> { bricks, W, D, door } local units, front on y = 0 looking -y
//   node mapgen/tavistock.mjs [seed] [out.json]

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const SCREEN = { color: [50, 54, 56], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [242, 242, 238], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const METAL = { color: [190, 190, 196], material: 'BMC_Metallic' };
const PAPERS = [
  { kind: 'paint', color: [178, 184, 214] },          // the dining / living lavender-blue
  { kind: 'paint', color: [214, 190, 150] },          // foyer tan
  { kind: 'paint', color: [150, 140, 126] },          // bedroom greige
  { kind: 'paint', color: [190, 160, 210] },          // the purple bedroom
  { kind: 'paint', color: [120, 150, 130] },          // ensuite green
  { kind: 'paint', color: [226, 226, 222] },
];
const WAINS = [{ kind: 'stripe', cols: [[2, [244, 244, 240]], [2, [230, 230, 226]]] }, { kind: 'paint', color: [244, 244, 240] }];

export function tavistock({ seed = 1 } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  // ---------------------------------------------------------------- frame --
  const G = 24, GC = 96, U = 104, UC = 176, TOP = 184; // ground floor top / ceiling, upper floor / ceiling, eave
  const WT = 104;                                      // the wing's wall top
  const DOOR = 62, SILL = 26, HEAD = 62;
  const X0 = 30, Y0 = 270;                             // local origin: overhang + the driveway in front of the garage
  const sidingC = [128, 160, 204], shutC = [244, 244, 240], roofC = [92, 94, 98], doorC = [138, 82, 40];
  const brickC = [226, 222, 214], trimC = [244, 242, 236];
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`tavistock: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label) => {
    const asset = 'PB_DefaultMicroWedge', ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext), _m: { asset, ups, ext }, color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`tavistock: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('tavistock: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {};
  const floor = (room, rect, top, key = room) => tileFloor(fadd, rect, top, style[key] ??= pickRoomStyle(room, r), r);
  const op = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });

  // ------------------------------------------------------------ walls --
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
  let lapK = 0;
  const lapColor = () => shade(sidingC, lapK++ % 2 ? 0.93 : 1);
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall', lap = 6) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings });
    if (skin === 'paint') return course(axis, line, a0, a1, z0, z1, openings, [200, 196, 188], label);
    let z = z0;
    if (z < 20) { course(axis, line, a0, a1, z, Math.min(20, z1), openings, [170, 168, 162], label + ' foundation'); z = 20; }
    for (; z < z1; z += lap) course(axis, line, a0, a1, z, Math.min(z1, z + lap), openings, lapColor(), label + ' siding');
  }
  function windowIn(axis, line, out, o, shutters = false, sill = true) {
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
    if (sill) pb(o.a0 - 4, o.a1 + 4, o.z0 - 4, o.z0, { color: WHITE }, 'sill', lo, hi);
    if (!shutters) return;
    const s0 = out < 0 ? line - 2 : line + 10, s1 = s0 + 2;
    for (const [a, b] of [[o.a0 - 12, o.a0], [o.a1, o.a1 + 12]]) {
      pb(a, b, o.z0, o.z1, { color: shutC }, 'shutter', s0, s1);
      const mid = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
      pb(a + 2, b - 2, mid - 2, mid, { color: shade(shutC, 0.85) }, 'shutter rail', out < 0 ? s0 - 2 : s1, out < 0 ? s0 : s1 + 2);
    }
  }

  // ---------------------------------------------------- interior finishes --
  const bands = (z0, z1) => [
    [z0, z0 + 6, 4, 'base'], [z0 + 6, z0 + 22, 2, 'wains'], [z0 + 22, z0 + 26, 4, 'rail'],
    [z0 + 26, z1 - 6, 2, 'paper'], [z1 - 6, z1 - 4, 4, 'crown'], [z1 - 4, z1, 6, 'crown'],
  ];
  function patterned(pat, a0, a1, z0, z1, put) {
    if (pat.kind === 'paint') return put(a0, a1, z0, z1, pat.color);
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
  function finishRoom(R, { paper, wains = WAINS[0], skip = {} } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0 && !(skip[s] === 'all');
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

  // --------------------------------------------------------- the roofs --
  // coursed (BUILDING.md): each course a 4-high lip with a micro wedge on it, from the ridge outward
  function courses(start, zTop, dir, n, per, w) {
    const out = [];
    for (let i = 0, a = start, z = zTop; i < n; i++, a += dir * w, z -= per) out.push({ a0: dir < 0 ? a - w : a, a1: dir < 0 ? a : a + w, zb: z - per, zt: z });
    return out;
  }
  // slopeAxis 'y': bands run along x (x0..x1) and fall toward -y (dir -1) or +y; 'x': along y, fall in x
  function lay(slopeAxis, bandsL, s0, s1, dir, label, keep = () => true) {
    bandsL.forEach((b, i) => {
      if (!keep(b, i)) return;
      const eave = i === bandsL.length - 1, c = shade(roofC, [1, 0.95, 1.03][i % 3]);
      if (slopeAxis === 'y') {
        box(s0, b.a0, b.zb, s1, b.a1, b.zb + 4, { color: eave ? WHITE : shade(roofC, 0.82) }, label + ' lip');
        wedge(s0, b.a0, b.zb + 4, s1, b.a1, b.zt, [[0, -dir]], c, label);
      } else {
        box(b.a0, s0, b.zb, b.a1, s1, b.zb + 4, { color: eave ? WHITE : shade(roofC, 0.82) }, label + ' lip');
        wedge(b.a0, s0, b.zb + 4, b.a1, s1, b.zt, [[-dir, 0]], c, label);
      }
    });
  }
  // gable laps under a coursed roof: row i spans the ridge band widened by i courses, clipped to [lo, hi]
  function gable(axis, line, r0, r1, rz, per, w, n, lo, hi, ops = []) {
    for (let i = 1; i <= n; i++) {
      const z = rz - per * (i + 1), zt = rz - per * i;
      const a0 = Math.max(lo, r0 - w * i), a1 = Math.min(hi, r1 + w * i);
      for (let zz = z; zz < zt; zz += 6) if (a1 > a0) course(axis, line, a0, a1, zz, Math.min(zt, zz + 6), ops, lapColor(), 'gable');
    }
  }
  // main block: side gable, ridge along x at y 120..140, 13 courses of 6 on 10 from the eave at TOP
  const MRY0 = 120, MRY1 = 140, MP = 6, MN = 13, MRZ = TOP + MP * MN;
  lay('y', courses(MRY0, MRZ, -1, MN, MP, 10), -10, 310, -1, 'roof');
  lay('y', courses(MRY1, MRZ, 1, MN, MP, 10), -10, 310, 1, 'roof');
  box(-10, MRY0, MRZ - MP, 310, MRY1, MRZ, { color: shade(roofC, 0.9) }, 'ridge');
  box(-10, MRY0 - 4, MRZ, 310, MRY1 + 4, MRZ + 4, { color: shade(roofC, 0.8) }, 'ridge cap');
  box(10, 0, TOP, 290, 10, TOP + MP, { color: WHITE }, 'frieze');
  box(10, 250, TOP, 290, 260, TOP + MP, { color: WHITE }, 'frieze');
  // wing: front gable, ridge along y at x 380..390, 10 courses of 8 on 10 from the eave at WT; skips where the
  // main block's wall stands (x < 300, y 0..260) and the chimney (x >= 480, y 190..230)
  const WRX0 = 380, WRX1 = 390, WP = 8, WN = 10, WRZ = WT + WP * WN, WY0 = -210, WY1 = 400;
  const wl = courses(WRX0, WRZ, -1, WN, WP, 10), wr = courses(WRX1, WRZ, 1, WN, WP, 10);
  lay('x', wl, WY0, 0, -1, 'wing roof'); lay('x', wl, 0, 260, -1, 'wing roof', b => b.a0 >= 300); lay('x', wl, 260, WY1, -1, 'wing roof');
  lay('x', wr, WY0, 190, 1, 'wing roof'); lay('x', wr, 190, 230, 1, 'wing roof', b => b.a1 <= 480); lay('x', wr, 230, WY1, 1, 'wing roof');
  box(WRX0, WY0, WRZ - WP, WRX1, WY1, WRZ, { color: shade(roofC, 0.9) }, 'wing ridge');
  box(WRX0 - 4, WY0, WRZ, WRX1 + 4, WY1, WRZ + 4, { color: shade(roofC, 0.8) }, 'wing ridge cap');
  box(290, -190, WT, 300, 0, WT + WP, { color: WHITE }, 'wing frieze');
  box(290, 260, WT, 300, 380, WT + WP, { color: WHITE }, 'wing frieze');
  box(470, -190, WT, 480, 380, WT + WP, { color: WHITE }, 'wing frieze');

  // ------------------------------------------------------- main block --
  const fd = op(220, 250, G, G + DOOR);
  const bay = [op(46, 82, G + SILL - 6, G + HEAD), op(92, 128, G + SILL - 6, G + HEAD), op(138, 174, G + SILL - 6, G + HEAD)];
  const upF = [op(40, 76, U + SILL, U + HEAD), op(110, 146, U + SILL, U + HEAD), op(200, 236, U + SILL, U + HEAD)];
  wall('x', 0, 0, 300, 0, TOP, 'siding', [{ ...fd, z1: fd.z1 + 4 }, ...bay, ...upF], 'front');
  WALLS.at(-1).openings = [fd, ...bay, ...upF];
  bay.forEach(w => windowIn('x', 0, -1, w, false, false)); upF.forEach(w => windowIn('x', 0, -1, w, true));
  for (const [a, b] of [[32, 44], [176, 188]]) box(a, -2, bay[0].z0, b, 0, bay[0].z1, { color: shutC }, 'shutter');
  box(42, -10, G + SILL - 14, 178, 0, G + SILL - 10, { color: WHITE }, 'bay sill');
  box(40, -12, G + HEAD, 180, 0, G + HEAD + 6, { color: WHITE }, 'bay head');
  box(fd.a0, 0, fd.z1, fd.a1, 10, fd.z1 + 4, { color: WHITE }, 'door head');
  box(fd.a0 - 4, -4, fd.z0, fd.a0, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a1, -4, fd.z0, fd.a1 + 4, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a0 - 6, -6, fd.z1 + 4, fd.a1 + 6, 0, fd.z1 + 8, { color: WHITE }, 'door cornice');
  box(fd.a0, 10, fd.z0, fd.a0 + 4, 40, fd.z1 - 18, { color: doorC }, 'front door (open)');
  box(fd.a0, 10, fd.z1 - 6, fd.a0 + 4, 40, fd.z1, { color: doorC }, 'front door (open)');
  for (const [a, b] of [[10, 14], [22, 24], [32, 40]]) box(fd.a0, a, fd.z1 - 18, fd.a0 + 4, b, fd.z1 - 6, { color: doorC }, 'front door (open)');
  for (const [a, b] of [[14, 22], [24, 32]]) box(fd.a0 + 1, a, fd.z1 - 18, fd.a0 + 3, b, fd.z1 - 6, GLASS, 'door lite');
  box(fd.a1 + 6, -6, G + 40, fd.a1 + 12, 0, G + 52, GLOW([255, 236, 190], 3), 'coach light');
  // sides: sitting room + primary / back bedroom windows on the left, nothing on the wing side
  const leftG = [op(180, 216, G + SILL, G + HEAD)], leftU = [op(60, 96, U + SILL, U + HEAD), op(190, 226, U + SILL, U + HEAD)];
  const attic = op(116, 144, 196, 220);
  wall('y', 0, 10, 250, 0, TOP, 'siding', [...leftG, ...leftU], 'left');
  [...leftG, ...leftU].forEach(w => windowIn('y', 0, -1, w));
  gable('y', 0, MRY0, MRY1, MRZ, MP, 10, MN - 1, 0, 260, [attic]);
  windowIn('y', 0, -1, attic);
  const kitOpen = op(170, 230, G, G + DOOR + 6);
  wall('y', 290, 10, 250, 0, TOP, 'siding', [kitOpen], 'right');
  gable('y', 290, MRY0, MRY1, MRZ, MP, 10, MN - 1, 0, 260);
  // back: sitting room, kitchen (over the sink), the nook slider; upstairs one window per bedroom
  const slider = op(220, 280, G, G + 64);
  const backW = [op(40, 76, G + SILL, G + HEAD), op(160, 196, G + 32, G + HEAD), op(50, 86, U + SILL, U + HEAD), op(210, 246, U + SILL, U + HEAD)];
  wall('x', 250, 0, 300, 0, TOP, 'siding', [slider, ...backW], 'back');
  backW.forEach(w => windowIn('x', 250, 1, w, w.z0 > U));
  box(slider.a0 + 2, 254, G, slider.a0 + 28, 256, slider.z1, GLASS, 'slider glass');
  box(slider.a0 + 30, 252, G, slider.a1 - 2, 254, slider.z1, GLASS, 'slider glass');
  for (const x of [slider.a0, slider.a0 + 28, slider.a1 - 2]) box(x, 250, G, x + 2, 260, slider.z1, { color: WHITE }, 'slider frame');

  // ground: dining | foyer front, sitting | kitchen back
  const SX0 = 260, SX1 = 290, SY0 = 34, SY1 = 130;     // the stair: 8 courses of 10 on 12 from y 34 up to the hall
  wall('y', 200, 10, 140, 20, GC, 'paint', [op(30, 110, G, G + DOOR + 6)], 'dining partition');
  wall('x', 140, 10, 290, 20, GC, 'paint', [op(30, 100, G, G + DOOR + 6), op(220, 250, G, G + DOOR)], 'cross partition');
  wall('y', 130, 150, 250, 20, GC, 'paint', [op(170, 210, G, G + DOOR + 6)], 'sitting partition');
  floor('living', [10, 10, 200, 140], G, 'dining');
  floor('hall', [210, 10, 290, 140], G, 'foyer');
  floor('living', [10, 150, 130, 250], G, 'sitting');
  floor('kitchen', [140, 150, 290, 250], G);
  const TREAD = [140, 96, 60];
  for (let k = 1; k <= 8; k++) box(SX0, SY0 + 12 * (k - 1), G + 10 * (k - 1), SX1, SY1, G + 10 * k, { color: shade(TREAD, k % 2 ? 1 : 0.9) }, 'stair course');
  for (let k = 1; k <= 8; k++) box(SX0, SY0 + 12 * (k - 1) + 4, G + 10 * k, SX0 + 2, SY0 + 12 * (k - 1) + 6, G + 10 * k + 30, { color: WHITE }, 'baluster');
  box(SX0 - 8, SY0 - 8, G, SX0, SY0, G + 40, { color: [120, 76, 44] }, 'newel');
  for (const [a, b, c, d] of [[10, 10, 260, 130], [10, 130, 290, 250]]) box(a, b, GC, c, d, GC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'ceiling');

  // upstairs
  wall('x', 130, 10, 260, 100, UC, 'paint', [op(30, 60, U, U + DOOR), op(140, 170, U, U + DOOR), op(200, 230, U, U + DOOR)], 'hall partition');
  wall('y', 180, 10, 130, 100, UC, 'paint', [op(20, 50, U, U + DOOR)], 'ensuite partition');
  wall('x', 60, 190, 250, 100, UC, 'paint', [], 'bath partition');
  wall('y', 250, 10, 130, 100, UC, 'paint', [], 'stairwell partition');
  wall('y', 80, 140, 170, 100, UC, 'paint', [], 'closet partition');
  wall('x', 170, 10, 290, 100, UC, 'paint', [op(100, 130, U, U + DOOR), op(150, 170, U, U + DOOR), op(200, 230, U, U + DOOR)], 'back hall partition');
  wall('y', 140, 180, 250, 100, UC, 'paint', [], 'closet partition');
  wall('y', 170, 180, 250, 100, UC, 'paint', [], 'closet partition');
  floor('bedroom', [10, 10, 180, 130], U, 'primary');
  floor('bathroom', [190, 10, 250, 60], U, 'ensuite');
  floor('bathroom', [190, 70, 250, 130], U, 'bath');
  for (const rc of [[10, 140, 80, 170], [90, 140, 290, 170], [260, 130, 290, 140]]) floor('hall', rc, U, 'uphall');
  floor('bedroom', [10, 180, 140, 250], U, 'bedA');
  floor('hall', [150, 180, 170, 250], U, 'uphall');
  floor('bedroom', [180, 180, 290, 250], U, 'bedB');
  box(10, 10, UC, 290, 250, UC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'upper ceiling');

  // -------------------------------------------------------------- wing --
  // front row y 10..130: closet | powder (x 300..330) | hall (340..380, door to the garage) | laundry
  wall('x', 0, 300, 480, 0, WT, 'siding', [op(350, 380, G, G + DOOR)], 'garage wall');
  const laundryW = op(50, 86, G + SILL, G + HEAD);
  wall('y', 470, 10, 280, 0, WT, 'siding', [laundryW], 'wing side');
  windowIn('y', 470, 1, laundryW);
  wall('y', 290, 260, 280, 0, WT, 'siding', [], 'wing side');
  const porchDoor = op(310, 340, G, G + DOOR), livW = [op(370, 406, G + SILL, G + HEAD), op(414, 450, G + SILL, G + HEAD)];
  wall('x', 280, 290, 480, 0, WT, 'siding', [porchDoor, ...livW], 'wing back');
  livW.forEach(w => windowIn('x', 280, 1, w));
  box(porchDoor.a0, 290, G, porchDoor.a0 + 4, 320, G + DOOR, { color: WHITE }, 'porch door (open)');
  wall('x', 130, 300, 470, 20, GC, 'paint', [op(350, 380, G, G + DOOR)], 'wing partition');
  wall('y', 330, 10, 130, 20, GC, 'paint', [op(24, 54, G, G + DOOR), op(90, 120, G, G + DOOR)], 'powder partition');
  wall('x', 64, 300, 330, 20, GC, 'paint', [], 'closet partition');
  wall('y', 390, 10, 130, 20, GC, 'paint', [op(30, 60, G, G + DOOR)], 'laundry partition');
  floor('hall', [300, 10, 330, 64], G, 'closet');
  floor('bathroom', [300, 74, 330, 130], G, 'powder');
  floor('hall', [340, 10, 390, 130], G, 'winghall');
  floor('hall', [400, 10, 470, 130], G, 'laundry');
  floor('living', [300, 140, 470, 280], G, 'living');
  box(300, 10, GC, 470, 280, GC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'wing ceiling');
  // the wing's front gable (over the garage doors) and back gable (over the porch)
  gable('x', -200, WRX0, WRX1, WRZ, WP, 10, WN - 1, 290, 480);
  gable('x', 380, WRX0, WRX1, WRZ, WP, 10, WN - 1, 290, 480);

  // ------------------------------------------------------------ rooms --
  const P = PAPERS;
  finishRoom({ x0: 10, y0: 10, x1: 200, y1: 140, z0: G, z1: GC }, { paper: P[0], wains: WAINS[0] });
  finishRoom({ x0: 210, y0: 10, x1: 290, y1: 140, z0: G, z1: GC }, { paper: P[1], wains: WAINS[0], skip: { x1: 'all' } });
  finishRoom({ x0: 10, y0: 150, x1: 130, y1: 250, z0: G, z1: GC }, { paper: P[0], wains: WAINS[1] });
  finishRoom({ x0: 140, y0: 150, x1: 290, y1: 250, z0: G, z1: GC }, { paper: P[5], wains: WAINS[1], skip: { y1: [[140, 214]], x0: [[224, 250]] } });
  finishRoom({ x0: 300, y0: 140, x1: 470, y1: 280, z0: G, z1: GC }, { paper: P[0], wains: WAINS[1], skip: { x1: [[152, 268]] } });
  finishRoom({ x0: 340, y0: 10, x1: 390, y1: 130, z0: G, z1: GC }, { paper: P[1], wains: WAINS[0] });
  finishRoom({ x0: 400, y0: 10, x1: 470, y1: 130, z0: G, z1: GC }, { paper: { kind: 'paint', color: [110, 120, 140] }, wains: WAINS[1] });
  finishRoom({ x0: 300, y0: 74, x1: 330, y1: 130, z0: G, z1: GC }, { paper: P[5], wains: { kind: 'paint', color: [226, 214, 196] } });
  finishRoom({ x0: 10, y0: 10, x1: 180, y1: 130, z0: U, z1: UC }, { paper: P[2] });
  finishRoom({ x0: 190, y0: 10, x1: 250, y1: 60, z0: U, z1: UC }, { paper: P[4], wains: { kind: 'paint', color: [160, 120, 84] } });
  finishRoom({ x0: 190, y0: 70, x1: 250, y1: 130, z0: U, z1: UC }, { paper: { kind: 'paint', color: [190, 196, 206] }, wains: { kind: 'stripe', cols: [[10, [244, 244, 240]], [10, [236, 236, 232]]] } });
  finishRoom({ x0: 90, y0: 140, x1: 290, y1: 170, z0: U, z1: UC }, { paper: P[1] });
  finishRoom({ x0: 10, y0: 180, x1: 140, y1: 250, z0: U, z1: UC }, { paper: P[3] });
  finishRoom({ x0: 180, y0: 180, x1: 290, y1: 250, z0: U, z1: UC }, { paper: pick([P[2], { kind: 'stripe', cols: [[6, [60, 60, 64]], [4, [230, 230, 226]]] }]) });

  // ---------------------------------------------------------- furniture --
  const WOOD = [110, 70, 44], DARK = [70, 46, 30];
  // dining: trestle table, six chairs, drum pendant
  box(70, 56, G, 140, 94, G + 22, { color: WOOD }, 'dining table');
  for (const x of [76, 100, 124]) for (const y of [44, 98]) box(x, y, G, x + 10, y + 8, G + 14, { color: [176, 160, 136] }, 'chair');
  light(105, 75, GC); light(250, 80, GC); light(250, 200, GC);
  box(214, 120, G, 240, 134, G + 28, { color: DARK }, 'foyer chest');
  // sitting room: sofa, TV stand on the left wall
  box(60, 214, G, 120, 240, G + 10, { color: [140, 130, 116] }, 'sofa seat');
  box(60, 240, G, 120, 244, G + 22, { color: shade([140, 130, 116], 0.85) }, 'sofa back');
  box(14, 176, G, 26, 224, G + 20, { color: DARK }, 'tv stand');
  box(16, 186, G + 20, 18, 214, G + 42, { color: [20, 20, 22] }, 'tv');
  light(70, 200, GC);
  // kitchen: white cabinets, granite, stainless; the counter run on the back wall, fridge by the partition,
  // a peninsula with stools facing the nook
  const CAB = [244, 244, 240], TOPC = [56, 44, 40], KB = 250;
  box(144, 154, G, 170, 180, G + 58, METAL, 'fridge');
  for (let x = 144, k = 0; x < 214; x += 14, k++) box(x, KB - 22, G, x + 14, KB, G + 26, { color: shade(CAB, k % 2 ? 0.96 : 1) }, 'base cabinet');
  box(144, KB - 24, G + 26, 214, KB, G + 30, { color: TOPC }, 'worktop');
  box(170, KB - 18, G + 30, 186, KB - 6, G + 32, METAL, 'sink');
  box(194, KB - 20, G + 30, 210, KB - 4, G + 32, { color: [30, 30, 32] }, 'range top');
  box(144, KB - 4, G + 30, 214, KB, G + 50, { color: [190, 110, 70] }, 'backsplash');
  box(144, KB - 14, G + 58, 158, KB, GC, { color: CAB }, 'wall cabinet');
  box(200, KB - 14, G + 58, 214, KB, GC, { color: CAB }, 'wall cabinet');
  box(190, 176, G, 270, 192, G + 28, { color: CAB }, 'peninsula');
  box(186, 174, G + 28, 274, 196, G + 32, { color: TOPC }, 'peninsula top');
  for (const x of [200, 224, 248]) box(x, 202, G, x + 10, 212, G + 22, { color: [214, 206, 190] }, 'stool');
  light(200, 220, GC, [255, 244, 220]);
  // living room: white painted brick fireplace on the wing side with a long wood mantel, two blue sofas
  const FPY0 = 176, FPY1 = 244;
  for (let z = G, k = 0; z < G + 36; z += 6, k++) {
    const c = { color: shade(brickC, k % 2 ? 0.95 : 1) };
    if (z >= G + 6 && z < G + 24) { box(456, FPY0, z, 470, 200, z + 6, c, 'fireplace'); box(456, 220, z, 470, FPY1, z + 6, c, 'fireplace'); }
    else box(456, FPY0, z, 470, FPY1, z + 6, c, 'fireplace');
  }
  box(466, 200, G + 6, 470, 220, G + 24, { color: [30, 28, 28] }, 'firebox');
  box(452, FPY0 - 20, G + 36, 470, FPY1 + 20, G + 40, { color: [112, 70, 40] }, 'mantel');
  box(436, FPY0, G, 456, FPY1, G + 4, { color: shade(brickC, 0.9) }, 'hearth');
  box(458, 202, G + 6, 466, 218, G + 8, GLOW([255, 120, 40], 3), 'embers');
  const BLUE = [52, 72, 120];
  box(340, 170, G, 366, 250, G + 10, { color: BLUE }, 'sofa seat'); box(330, 170, G, 340, 250, G + 22, { color: shade(BLUE, 0.85) }, 'sofa back');
  box(370, 260, G, 430, 274, G + 10, { color: BLUE }, 'sofa seat'); box(370, 274, G, 430, 276, G + 22, { color: shade(BLUE, 0.85) }, 'sofa back');
  box(380, 196, G, 420, 230, G + 12, { color: WOOD }, 'coffee table');
  light(390, 210, GC);
  // laundry: washer + dryer under white cabinets; powder room pedestal sink + toilet
  for (const x of [410, 436]) { box(x, 104, G, x + 24, 126, G + 26, { color: [244, 244, 244] }, 'washer'); box(x + 6, 102, G + 8, x + 18, 104, G + 20, { color: [60, 70, 80], material: 'BMC_Glass' }, 'porthole'); }
  box(410, 110, G + 50, 460, 124, GC - 6, { color: CAB }, 'laundry cabinet');
  light(430, 70, GC); light(360, 70, GC);
  box(304, 108, G, 314, 118, G + 8, { color: CAB }, 'toilet'); box(304, 106, G + 8, 316, 120, G + 12, { color: CAB }, 'toilet seat');
  box(316, 80, G, 322, 86, G + 26, { color: CAB }, 'pedestal'); box(312, 78, G + 26, 326, 90, G + 30, { color: CAB }, 'basin');
  // bedrooms: primary bed against the hall wall, back bedrooms on their partitions
  const bed = (x0, y0, x1, y1, head, c) => {
    box(x0, y0, U, x1, y1, U + 10, { color: WOOD }, 'bed frame');
    box(x0 + 2, y0 + 2, U + 10, x1 - 2, y1 - 2, U + 14, { color: c }, 'bedspread');
    box(...head.slice(0, 2), U, ...head.slice(2), U + 28, { color: DARK }, 'headboard');
  };
  bed(70, 70, 120, 122, [70, 122, 120, 126], [214, 206, 190]);
  box(30, 16, U, 70, 30, U + 22, { color: [176, 146, 104] }, 'dresser');
  light(95, 60, UC);
  bed(84, 196, 132, 236, [132, 196, 136, 236], [140, 170, 210]);
  box(16, 230, U, 44, 244, U + 34, { color: WHITE }, 'desk hutch');
  light(75, 215, UC);
  bed(230, 196, 282, 236, [282, 196, 286, 236], [220, 220, 216]);
  box(186, 190, U, 198, 230, U + 50, { color: WHITE }, 'bookshelf');
  light(235, 215, UC);
  light(190, 155, UC); light(275, 90, UC);
  // ensuite: double floating vanity in wood on the stairwell wall, glass shower; hall bath: tub, vanity, toilet
  box(232, 18, U + 12, 246, 52, U + 28, { color: [170, 120, 80] }, 'floating vanity');
  box(232, 18, U + 28, 246, 52, U + 30, { color: [244, 244, 240] }, 'vanity top');
  box(196, 26, U, 220, 54, U + 2, { color: [230, 230, 230] }, 'shower tray');
  box(220, 26, U, 222, 54, U + 64, GLASS, 'shower glass');
  box(196, 14, U, 206, 24, U + 12, { color: CAB }, 'toilet');
  const TUB = [244, 244, 240];
  box(194, 74, U, 246, 96, U + 2, { color: TUB }, 'tub bottom');
  box(194, 74, U + 2, 246, 78, U + 16, { color: TUB }, 'tub side'); box(194, 92, U + 2, 246, 96, U + 16, { color: TUB }, 'tub side');
  box(194, 78, U + 2, 198, 92, U + 16, { color: TUB }, 'tub end'); box(242, 78, U + 2, 246, 92, U + 16, { color: TUB }, 'tub end');
  box(198, 78, U + 2, 242, 92, U + 8, { color: [150, 200, 220], material: 'BMC_Glass' }, 'bath water');
  box(228, 104, U, 246, 124, U + 28, { color: CAB }, 'vanity'); box(226, 102, U + 28, 246, 126, U + 30, { color: [232, 230, 226] }, 'vanity top');
  box(194, 104, U, 204, 114, U + 12, { color: CAB }, 'toilet');
  light(220, 35, UC, [255, 244, 220]); light(215, 110, UC, [255, 244, 220]);

  // ------------------------------------------------------------ garage --
  box(300, -190, 0, 470, 0, 4, { asset: TILE, color: [168, 166, 160] }, 'garage floor');
  const gd = [op(306, 380, 4, 76), op(390, 464, 4, 76)], gWin = op(-120, -84, 40, 66);
  wall('x', -200, 290, 480, 0, WT, 'siding', gd, 'garage front');
  wall('y', 290, -190, 0, 0, WT, 'siding', [gWin], 'garage side');
  windowIn('y', 290, -1, gWin);
  wall('y', 470, -190, 0, 0, WT, 'siding', [], 'garage side');
  for (const g of gd) {
    for (let z = g.z0, k = 0; z < g.z1; z += 18, k++) {
      const zt = Math.min(g.z1, z + 18);
      box(g.a0, -197, z, g.a1, -193, zt - 2, { color: WHITE }, 'garage door');
      box(g.a0, -195, zt - 2, g.a1, -193, zt, { color: shade(WHITE, 0.85) }, 'garage door groove');
      if (k === 3) for (let x = g.a0 + 6; x + 10 <= g.a1 - 4; x += 16) box(x, -199, z + 6, x + 10, -197, z + 14, GLASS, 'garage door lite');
    }
    box(g.a0 - 4, -204, g.z0, g.a0, -200, g.z1 + 4, { color: WHITE }, 'garage trim'); box(g.a1, -204, g.z0, g.a1 + 4, -200, g.z1 + 4, { color: WHITE }, 'garage trim');
    box(g.a0, -204, g.z1, g.a1, -200, g.z1 + 4, { color: WHITE }, 'garage trim');
  }
  box(296, -206, 60, 302, -200, 72, GLOW([255, 236, 190], 3), 'garage light'); box(468, -206, 60, 474, -200, 72, GLOW([255, 236, 190], 3), 'garage light');
  box(440, -40, 4, 466, -10, 34, { color: WOOD }, 'workbench');

  // ------------------------------------------------------ chimney (outside the living room) --
  for (let z = 0, k = 0; z < 228; z += 12, k++) box(480, 190, z, 516, 230, z + 12, { color: shade([150, 76, 56], [1, 0.93, 1.05, 0.97][k % 4]) }, 'chimney');
  box(478, 188, 228, 518, 232, 234, { color: [120, 118, 114] }, 'chimney cap');

  // ------------------------------------------------------- screened porch --
  box(290, 290, 0, 480, 390, 20, { color: WHITE }, 'porch skirt');
  for (let x = 290, k = 0; x < 480; x += 10, k++) box(x, 290, 20, x + 10, 390, 24, { color: shade([128, 84, 56], [1, 0.94, 1.04][k % 3]) }, 'porch board');
  const posts = [[290, 290], [290, 330], [290, 380], [470, 290], [470, 330], [470, 380], [380, 380]];
  for (const [x, y] of posts) box(x, y, G, x + 10, y + 10, 96, { color: WHITE }, 'porch post');
  box(290, 300, 96, 300, 380, WT, { color: WHITE }, 'porch beam'); box(470, 300, 96, 480, 380, WT, { color: WHITE }, 'porch beam');
  box(290, 290, 96, 300, 300, WT, { color: WHITE }, 'porch beam'); box(470, 290, 96, 480, 300, WT, { color: WHITE }, 'porch beam');
  box(290, 380, 96, 480, 390, WT, { color: WHITE }, 'porch beam');
  for (const [a, b] of [[300, 330]]) box(294, a, G, 296, b, 96, SCREEN, 'screen');
  for (const [a, b] of [[300, 330], [340, 380]]) box(474, a, G, 476, b, 96, SCREEN, 'screen');
  for (const [a, b] of [[300, 380], [390, 470]]) box(a, 384, G, b, 386, 96, SCREEN, 'screen');
  light(385, 335, 150, [255, 236, 190]);

  // ------------------------------------------------------------ the deck + yard --
  box(40, 260, 0, 290, 400, 20, { color: [120, 84, 60] }, 'deck skirt');
  for (let x = 40, k = 0; x < 290; x += 10, k++) box(x, 260, 20, x + 10, 400, 24, { color: shade([150, 82, 70], [1, 0.94, 1.05, 0.97][k % 4]) }, 'deck board');
  const RAIL = [130, 84, 56];
  for (let y = 270; y < 400; y += 30) box(40, y, G, 44, y + 4, G + 30, { color: RAIL }, 'rail post');
  box(40, 260, G + 30, 44, 400, G + 34, { color: RAIL }, 'rail');
  for (const [a, b] of [[44, 150], [190, 290]]) { box(a, 396, G + 30, b, 400, G + 34, { color: RAIL }, 'rail'); for (let x = a; x + 4 <= b; x += 30) box(x, 396, G, x + 4, 400, G + 30, { color: RAIL }, 'rail post'); }
  box(150, 400, 0, 190, 412, 16, { color: RAIL }, 'deck step'); box(150, 412, 0, 190, 424, 8, { color: RAIL }, 'deck step');
  box(40, 410, 0, 140, 500, 4, { asset: TILE, color: [150, 120, 100] }, 'pavers');
  const TUBC = { color: [150, 130, 90] };
  box(60, 420, 4, 120, 480, 26, TUBC, 'hot tub shell');
  box(60, 420, 26, 120, 426, 34, TUBC, 'hot tub rim'); box(60, 474, 26, 120, 480, 34, TUBC, 'hot tub rim');
  box(60, 426, 26, 66, 474, 34, TUBC, 'hot tub rim'); box(114, 426, 26, 120, 474, 34, TUBC, 'hot tub rim');
  box(66, 426, 26, 114, 474, 32, { color: [120, 200, 220], material: 'BMC_Glass' }, 'hot tub water');

  // ------------------------------------------------------------ front --
  box(200, -40, 0, 260, 0, 16, { color: [176, 172, 166] }, 'stoop');
  box(200, -64, 0, 260, -40, 8, { color: [176, 172, 166] }, 'stoop step');
  box(180, -100, 0, 290, -64, 4, { color: [160, 74, 56] }, 'brick walk');
  box(290, -Y0, 0, 480, -204, 4, { color: [184, 180, 172] }, 'driveway');
  box(250, -Y0, 0, 290, -100, 4, { asset: TILE, color: [160, 74, 56] }, 'brick walk');

  // ------------------------------------------------------------- output --
  // mirror into the left-handed world (plan x -> total - x)
  const total = X0 + 540;
  const bricks = B.bricks.map(({ label, _m, _tri, ...b }) => {
    const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
    if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] };
    return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
  });
  return { bricks, W: total / 10, D: (Y0 + 500) / 10, door: [Math.round((total - X0 - (fd.a0 + fd.a1) / 2) / 10)], count: bricks.length };
}

if (process.argv[1]?.endsWith('tavistock.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'tavistock.json';
  const h = tavistock({ seed });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`tavistock seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}`);
}
