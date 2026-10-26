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
const PLASTER = [222, 218, 210], WHITE = [242, 242, 238], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
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
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label, zSign = 1) => {
    const asset = 'PB_DefaultMicroWedge', ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext, zSign), _m: { asset, ups, ext, zSign }, color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`tavistock: ${label} dropped: ${B.dropped.at(-1)}`);
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
  function course(axis, line, a0, a1, z, zt, openings, color, label, t = 10) {
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
    for (const c of pcs) if (c.q > c.p && c.zt > c.z) piece(axis, line, c.p, c.q, c.z, c.zt, color, label, t);
  }
  // shade by height, so laps of neighbouring walls line up at corners (owner: 'fix seam splitting')
  const lapColor = z => shade(sidingC, Math.floor((z - 20) / 6) % 2 ? 0.93 : 1);
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall', lap = 6, caps = [false, false]) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings });
    if (skin === 'paint') return course(axis, line, a0, a1, z0, z1, openings, [200, 196, 188], label);
    let z = z0;
    if (z < 20) { course(axis, line, a0, a1, z, Math.min(20, z1), openings, [170, 168, 162], label + ' foundation'); z = 20; }
    // owner 2026-10-26: siding showed inside (stair wall, fireplace, door reveals). Siding is a 4-deep outer skin
    // over a 6-deep plaster core; skin 'siding-' / 'siding+' = the outside is toward -/+; 'plaster' = indoors both
    // sides; 'siding+high' = indoors under the wing roof (z < WT), siding above it
    const out = skin.startsWith('siding-') ? -1 : 1;
    // the core (and a plaster skin) goes up in one piece: per-lap bricks drew lap seams indoors (owner, garage)
    // caps: an end that shows outside at a corner gets 4 of siding over the core's end (the core showed as a strip)
    const ca0 = a0 + (caps[0] ? 4 : 0), ca1 = a1 - (caps[1] ? 4 : 0), cl = out < 0 ? line + 4 : line;
    course(axis, cl, ca0, ca1, z, z1, openings, PLASTER, label + ' core', 6);
    for (let zz = z; zz < z1; zz += lap) for (const [p, q] of [[a0, ca0], [ca1, a1]]) if (q > p) course(axis, cl, p, q, zz, Math.min(z1, zz + lap), [], lapColor(zz), label + ' corner', 6);
    const zp = skin === 'plaster' ? z1 : skin === 'siding+high' ? Math.min(z1, WT) : z;
    if (zp > z) course(axis, out < 0 ? line : line + 6, a0, a1, z, zp, openings, PLASTER, label + ' skin', 4);
    for (z = zp; z < z1; z += lap) course(axis, out < 0 ? line : line + 6, a0, a1, z, Math.min(z1, z + lap), openings, lapColor(z), label + ' siding', 4);
  }
  function windowIn(axis, line, out, o, shutters = false, sill = true) {
    const T = { color: WHITE };
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    // slim frame (owner 2026-10-26: windows read too thick): 2-wide, set in the outer half of the wall
    const f0 = out < 0 ? line : line + 4, f1 = f0 + 6;
    pb(o.a0, o.a1, o.z0, o.z0 + 2, T, 'window frame', f0, f1);
    pb(o.a0, o.a1, o.z1 - 2, o.z1, T, 'window frame', f0, f1);
    pb(o.a0, o.a0 + 2, o.z0 + 2, o.z1 - 2, T, 'window frame', f0, f1);
    pb(o.a1 - 2, o.a1, o.z0 + 2, o.z1 - 2, T, 'window frame', f0, f1);
    const mz = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
    pb(o.a0 + 2, o.a1 - 2, mz - 2, mz, T, 'meeting rail', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, o.z0 + 2, mz - 2, GLASS, 'glass', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, mz, o.z1 - 2, GLASS, 'glass', line + 4, line + 6);
    if (sill) pb(o.a0 - 2, o.a1 + 2, o.z0 - 2, o.z0, { color: WHITE }, 'sill', out < 0 ? line - 2 : line + 10, out < 0 ? line : line + 12);
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
        // a band crossing an opening is cut there, but keeps its pieces under the stool / over the casing head
        // (owner 2026-10-26: whole-band cuts left holes in the paneling under windows)
        const cutSpans = (sp, p0, p1) => sp.flatMap(([p, q]) => (p1 <= p || p0 >= q) ? [[p, q]] : [[p, p0], [p1, q]].filter(([u, v]) => v > u));
        let spans = [[a0, a1]];
        const parts = [];
        for (const o of ops) {
          const door = o.z0 <= R.z0 + 2;
          const oz0 = door ? R.z0 : o.z0 - 2, oz1 = Math.max(o.z1, Math.min(R.z1 - 6, o.z1 + 4));
          if (!(oz0 < z1 && oz1 > z0)) continue;
          spans = cutSpans(spans, o.a0 - 4, o.a1 + 4);
          const p = Math.max(a0, o.a0 - 4), q = Math.min(a1, o.a1 + 4);
          if (z0 < oz0) parts.push([p, q, z0, Math.min(z1, oz0)]);
          if (z1 > oz1) parts.push([p, q, Math.max(z0, oz1), z1]);
        }
        const all = [...spans.map(([p, q]) => [p, q, z0, z1]), ...parts].flatMap(([p, q, u, v]) => {
          let sp = [[p, q]];
          for (const [p0, p1] of skip[side] ?? []) sp = cutSpans(sp, p0, p1);
          return sp.map(([a, b]) => [a, b, u, v]);
        });
        for (const [p, q, u, v] of all) {
          if (kind === 'paper' || kind === 'wains') patterned(kind === 'paper' ? paper : wains, p, q, u, v, (s0, s1, zz, zt, c) => facePiece(side, R, s0, s1, zz, zt, t, c, 'wall ' + kind));
          else facePiece(side, R, p, q, u, v, t, kind === 'crown' && t === 6 ? shade(trimC, 0.96) : trimC, kind);
        }
      }
      for (const o of ops) {
        if ((skip[side] ?? []).some(([p0, p1]) => o.a0 < p1 && o.a1 > p0)) continue;
        const door = o.z0 <= R.z0 + 2;
        const jz0 = door ? R.z0 : o.z0, top = Math.min(R.z1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, 4, trimC, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, 4, trimC, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, 4, trimC, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 4, trimC, 'stool');
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
      for (let zz = z; zz < zt; zz += 6) if (a1 > a0) course(axis, line, a0, a1, zz, Math.min(zt, zz + 6), ops, lapColor(zz), 'gable');
    }
  }
  // main block: side gable, ridge along x at y 120..140, 13 courses of 6 on 10 from the eave at TOP
  const MRY0 = 140, MRY1 = 160, MP = 6, MN = 15, MRZ = TOP + MP * MN;
  lay('y', courses(MRY0, MRZ, -1, MN, MP, 10), -10, 310, -1, 'roof');
  lay('y', courses(MRY1, MRZ, 1, MN, MP, 10), -10, 310, 1, 'roof');
  box(-10, MRY0, MRZ - MP, 310, MRY1, MRZ, { color: shade(roofC, 0.9) }, 'ridge');
  box(-10, MRY0 - 4, MRZ, 310, MRY1 + 4, MRZ + 4, { color: shade(roofC, 0.8) }, 'ridge cap');
  box(10, 0, TOP, 290, 10, TOP + MP, { color: WHITE }, 'frieze');
  box(10, 290, TOP, 290, 300, TOP + MP, { color: WHITE }, 'frieze');
  // wing: front gable, ridge along y at x 380..390, 10 courses of 8 on 10 from the eave at WT; skips where the
  // main block's wall stands (x < 300, y 0..300) and the chimney (x >= 480, y 190..230)
  const WRX0 = 380, WRX1 = 390, WP = 8, WN = 10, WRZ = WT + WP * WN, WY0 = -210, WY1 = 400;
  const wl = courses(WRX0, WRZ, -1, WN, WP, 10), wr = courses(WRX1, WRZ, 1, WN, WP, 10);
  lay('x', wl, WY0, 0, -1, 'wing roof'); lay('x', wl, 0, 300, -1, 'wing roof', b => b.a0 >= 300); lay('x', wl, 300, WY1, -1, 'wing roof');
  lay('x', wr, WY0, 190, 1, 'wing roof'); lay('x', wr, 190, 230, 1, 'wing roof', b => b.a1 <= 480); lay('x', wr, 230, WY1, 1, 'wing roof');
  box(WRX0, WY0, WRZ - WP, WRX1, WY1, WRZ, { color: shade(roofC, 0.9) }, 'wing ridge');
  box(WRX0 - 4, WY0, WRZ, WRX1 + 4, WY1, WRZ + 4, { color: shade(roofC, 0.8) }, 'wing ridge cap');
  box(290, -190, WT, 300, 0, WT + WP, { color: WHITE }, 'wing frieze');
  box(290, 300, WT, 300, 380, WT + WP, { color: WHITE }, 'wing frieze');
  box(470, -190, WT, 480, 380, WT + WP, { color: WHITE }, 'wing frieze');

  // ------------------------------------------------------- main block --
  const fd = op(220, 250, G, G + DOOR);
  const bay = [op(46, 82, G + SILL - 6, G + HEAD), op(92, 128, G + SILL - 6, G + HEAD), op(138, 174, G + SILL - 6, G + HEAD)];
  const upF = [op(40, 76, U + SILL, U + HEAD), op(110, 146, U + SILL, U + HEAD), op(196, 230, U + SILL, U + HEAD)];
  wall('x', 0, 0, 300, 0, TOP, 'siding-', [{ ...fd, z1: fd.z1 + 4 }, ...bay, ...upF], 'front', 6, [true, false]);
  WALLS.at(-1).openings = [fd, ...bay, ...upF];
  bay.forEach(w => windowIn('x', 0, -1, w, false, false)); upF.forEach(w => windowIn('x', 0, -1, w, true));
  for (const [a, b] of [[32, 44], [176, 188]]) box(a, -2, bay[0].z0, b, 0, bay[0].z1, { color: shutC }, 'shutter');
  box(42, -10, G + SILL - 14, 178, 0, G + SILL - 10, { color: WHITE }, 'bay sill');
  box(40, -12, G + HEAD, 180, 0, G + HEAD + 6, { color: WHITE }, 'bay head');
  box(fd.a0, 0, fd.z1, fd.a1, 10, fd.z1 + 4, { color: WHITE }, 'door head');
  box(fd.a0 - 4, -4, fd.z0, fd.a0, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a1, -4, fd.z0, fd.a1 + 4, 0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a0 - 6, -6, fd.z1 + 4, fd.a1 + 6, 0, fd.z1 + 8, { color: WHITE }, 'door cornice');
  box(fd.a0 - 4, 14, fd.z0, fd.a0, 44, fd.z1 - 18, { color: doorC }, 'front door (open)');
  box(fd.a0 - 4, 14, fd.z1 - 6, fd.a0, 44, fd.z1, { color: doorC }, 'front door (open)');
  for (const [a, b] of [[14, 18], [26, 28], [36, 44]]) box(fd.a0 - 4, a, fd.z1 - 18, fd.a0, b, fd.z1 - 6, { color: doorC }, 'front door (open)');
  for (const [a, b] of [[18, 26], [28, 36]]) box(fd.a0 - 3, a, fd.z1 - 18, fd.a0 - 1, b, fd.z1 - 6, GLASS, 'door lite');
  box(fd.a1 + 6, -6, G + 40, fd.a1 + 12, 0, G + 52, GLOW([255, 236, 190], 3), 'coach light');
  // sides: sitting room + primary / back bedroom windows on the left, nothing on the wing side
  const leftG = [op(200, 236, G + SILL, G + HEAD)], leftU = [op(60, 96, U + SILL, U + HEAD), op(228, 264, U + SILL, U + HEAD)];
  const attic = op(136, 164, 200, 224);
  wall('y', 0, 10, 290, 0, TOP, 'siding-', [...leftG, ...leftU], 'left');
  [...leftG, ...leftU].forEach(w => windowIn('y', 0, -1, w));
  gable('y', 0, MRY0, MRY1, MRZ, MP, 10, MN - 1, 0, 300, [attic]);
  windowIn('y', 0, -1, attic);
  const kitOpen = op(170, 230, G, G + DOOR + 6);
  wall('y', 290, 10, 290, 0, TOP, 'siding+high', [kitOpen], 'right');
  gable('y', 290, MRY0, MRY1, MRZ, MP, 10, MN - 1, 0, 300);
  // back: sitting room, kitchen (over the sink), the nook slider; upstairs one window per bedroom
  const slider = op(220, 280, G, G + 64);
  const backW = [op(40, 76, G + SILL, G + HEAD), op(160, 196, G + 32, G + HEAD), op(50, 86, U + SILL, U + HEAD), op(210, 246, U + SILL, U + HEAD)];
  wall('x', 290, 0, 300, 0, TOP, 'siding+', [slider, ...backW], 'back', 6, [true, true]);
  backW.forEach(w => windowIn('x', 290, 1, w, w.z0 > U));
  box(slider.a0 + 2, 294, G, slider.a0 + 28, 296, slider.z1, GLASS, 'slider glass');
  box(slider.a0 + 30, 292, G, slider.a1 - 2, 294, slider.z1, GLASS, 'slider glass');
  for (const x of [slider.a0, slider.a0 + 28, slider.a1 - 2]) box(x, 290, G, x + 2, 300, slider.z1, { color: WHITE }, 'slider frame');

  // ground: dining | foyer front, sitting | kitchen back
  const SX0 = 250, SX1 = 290, SY0 = 44, SY1 = 140;     // the stair: 40 wide, 8 courses of 10 on 12 from y 44 (landing 10..44) up to the hall
  wall('y', 200, 10, 140, 20, GC, 'paint', [op(30, 110, G, G + DOOR + 6)], 'dining partition');
  wall('x', 140, 10, 290, 20, GC, 'paint', [op(30, 100, G, G + DOOR + 6), op(220, 250, G, G + DOOR)], 'cross partition');
  wall('y', 130, 150, 290, 20, GC, 'paint', [op(170, 210, G, G + DOOR + 6)], 'sitting partition');
  floor('living', [10, 10, 200, 140], G, 'dining');
  floor('hall', [210, 10, 290, 140], G, 'foyer');
  floor('living', [10, 150, 130, 290], G, 'sitting');
  floor('kitchen', [140, 150, 290, 290], G);
  const TREAD = [140, 96, 60];
  for (let k = 1; k <= 8; k++) box(SX0, SY0 + 12 * (k - 1), G + 10 * (k - 1), SX1, SY1, G + 10 * k, { color: shade(TREAD, k % 2 ? 1 : 0.9) }, 'stair course');
  // owner 2026-10-26 'railings need wedges': a sloped handrail and an open-side stringer, each segment a hanging
  // wedge under a standing one (a 10-high parallelogram band rising 10 per 12-unit tread)
  const band = (x0, x1, y, z, color, label) => {
    wedge(x0, y, z, x1, y + 12, z + 10, [[0, -1]], color, label, -1);
    wedge(x0, y, z + 10, x1, y + 12, z + 20, [[0, 1]], color, label);
  };
  const RAILC = [120, 76, 44];
  for (let k = 1; k <= 8; k++) {
    const y = SY0 + 12 * (k - 1);
    box(SX0, y, G + 10 * k, SX0 + 2, y + 2, G + 10 * k + 18, { color: WHITE }, 'baluster');
    band(SX0, SX0 + 2, y, G + 10 * k + 18, RAILC, 'handrail'); // 2 wide (owner: 'a little thick'); 10 high is the least a rise-10 wedge pair gives
    if (k <= 6) band(SX0 - 4, SX0, y, G + 10 * (k - 1), shade(TREAD, 0.8), 'stringer');
    else if (k === 7) wedge(SX0 - 4, y, G + 60, SX0, y + 12, G + 70, [[0, -1]], shade(TREAD, 0.8), 'stringer', -1);
  }
  for (const [a, b, c, d] of [[10, 10, 250, 140], [10, 140, 290, 290]]) box(a, b, GC, c, d, GC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'ceiling');

  // upstairs
  wall('x', 130, 10, 250, 100, UC, 'paint', [op(110, 140, U, U + DOOR), op(190, 220, U, U + DOOR)], 'hall partition');
  wall('y', 160, 10, 130, 100, UC, 'paint', [op(24, 54, U, U + DOOR)], 'ensuite partition');
  wall('x', 70, 170, 240, 100, UC, 'paint', [], 'bath partition');
  wall('y', 240, 10, 130, 100, UC, 'paint', [], 'stairwell partition');
  wall('x', 190, 10, 290, 100, UC, 'paint', [op(90, 120, U, U + DOOR), op(200, 230, U, U + DOOR)], 'back hall partition');
  wall('y', 140, 200, 290, 100, UC, 'paint', [], 'bedroom partition');
  floor('bedroom', [10, 10, 160, 130], U, 'primary');
  floor('bathroom', [170, 10, 240, 70], U, 'ensuite');
  floor('bathroom', [170, 80, 240, 130], U, 'bath');
  floor('hall', [10, 140, 290, 190], U, 'uphall');
  floor('bedroom', [10, 200, 140, 290], U, 'bedA');
  floor('bedroom', [150, 200, 290, 290], U, 'bedB');
  box(10, 10, UC, 290, 290, UC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'upper ceiling');

  // -------------------------------------------------------------- wing --
  // front row y 10..130: closet | powder (x 300..330) | hall (340..380, door to the garage) | laundry
  wall('x', 0, 300, 470, 0, WT, 'plaster', [op(360, 390, G, G + DOOR)], 'garage wall');
  const laundryW = op(50, 86, G + SILL, G + HEAD);
  wall('y', 470, 0, 280, 0, WT, 'siding+', [laundryW], 'wing side');
  windowIn('y', 470, 1, laundryW);
  const porchDoor = op(310, 340, G, G + DOOR), livW = [op(370, 406, G + SILL, G + HEAD), op(414, 450, G + SILL, G + HEAD)];
  wall('x', 280, 300, 480, 0, WT, 'siding+', [porchDoor, ...livW], 'wing back', 6, [false, true]);
  livW.forEach(w => windowIn('x', 280, 1, w));
  box(porchDoor.a0 - 4, 290, G, porchDoor.a0, 320, G + DOOR, { color: WHITE }, 'porch door (open)');
  wall('x', 130, 300, 470, 20, GC, 'paint', [op(360, 390, G, G + DOOR)], 'wing partition');
  wall('y', 340, 10, 130, 20, GC, 'paint', [op(24, 54, G, G + DOOR), op(90, 120, G, G + DOOR)], 'powder partition');
  wall('x', 64, 300, 340, 20, GC, 'paint', [], 'closet partition');
  wall('y', 400, 10, 130, 20, GC, 'paint', [op(30, 60, G, G + DOOR)], 'laundry partition');
  floor('hall', [300, 10, 340, 64], G, 'closet');
  floor('bathroom', [300, 74, 340, 130], G, 'powder');
  floor('hall', [350, 10, 400, 130], G, 'winghall');
  floor('hall', [410, 10, 470, 130], G, 'laundry');
  floor('living', [300, 140, 470, 280], G, 'living');
  box(300, 10, GC, 470, 280, GC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'wing ceiling');
  // the wing's front gable (over the garage doors) and back gable (over the porch)
  gable('x', -200, WRX0, WRX1, WRZ, WP, 10, WN - 1, 290, 480);
  gable('x', 380, WRX0, WRX1, WRZ, WP, 10, WN - 1, 290, 480);

  // ------------------------------------------------------------ rooms --
  const P = PAPERS;
  finishRoom({ x0: 10, y0: 10, x1: 200, y1: 140, z0: G, z1: GC }, { paper: P[0], wains: WAINS[0] });
  finishRoom({ x0: 210, y0: 10, x1: 290, y1: 140, z0: G, z1: GC }, { paper: P[1], wains: WAINS[0], skip: { x1: 'all', y1: [[248, 290]] } });
  finishRoom({ x0: 10, y0: 150, x1: 130, y1: 290, z0: G, z1: GC }, { paper: P[0], wains: WAINS[1] });
  finishRoom({ x0: 140, y0: 150, x1: 290, y1: 290, z0: G, z1: GC }, { paper: P[5], wains: WAINS[1], });
  finishRoom({ x0: 300, y0: 140, x1: 470, y1: 280, z0: G, z1: GC }, { paper: P[0], wains: WAINS[1], skip: { x1: [[172, 248]] } });
  finishRoom({ x0: 350, y0: 10, x1: 400, y1: 130, z0: G, z1: GC }, { paper: P[1], wains: WAINS[0] });
  finishRoom({ x0: 410, y0: 10, x1: 470, y1: 130, z0: G, z1: GC }, { paper: { kind: 'paint', color: [110, 120, 140] }, wains: WAINS[1] });
  finishRoom({ x0: 300, y0: 74, x1: 340, y1: 130, z0: G, z1: GC }, { paper: P[5], wains: { kind: 'paint', color: [226, 214, 196] } });
  finishRoom({ x0: 10, y0: 10, x1: 160, y1: 130, z0: U, z1: UC }, { paper: P[2] });
  finishRoom({ x0: 170, y0: 10, x1: 240, y1: 70, z0: U, z1: UC }, { paper: P[4], wains: { kind: 'paint', color: [160, 120, 84] } });
  finishRoom({ x0: 170, y0: 80, x1: 240, y1: 130, z0: U, z1: UC }, { paper: { kind: 'paint', color: [190, 196, 206] }, wains: { kind: 'stripe', cols: [[10, [244, 244, 240]], [10, [236, 236, 232]]] } });
  finishRoom({ x0: 10, y0: 140, x1: 290, y1: 190, z0: U, z1: UC }, { paper: P[1], skip: { y0: [[246, 290]] } });
  finishRoom({ x0: 10, y0: 200, x1: 140, y1: 290, z0: U, z1: UC }, { paper: P[3] });
  finishRoom({ x0: 150, y0: 200, x1: 290, y1: 290, z0: U, z1: UC }, { paper: pick([P[2], { kind: 'stripe', cols: [[6, [60, 60, 64]], [4, [230, 230, 226]]] }]) });

  // ------------------------------------------------------------ lights --
  // owner 2026-10-26: an empty house, no furniture or fixtures; the fireplace is built in and stays
  light(105, 75, GC); light(230, 80, GC); light(250, 200, GC); light(70, 200, GC); light(200, 220, GC);
  light(390, 210, GC); light(440, 70, GC); light(375, 70, GC);
  light(85, 70, UC); light(75, 245, UC); light(220, 245, UC); light(150, 165, UC); light(270, 90, UC);
  light(205, 40, UC); light(205, 105, UC);
  // living room: white painted brick fireplace on the wing side with a long wood mantel
  const FPY0 = 176, FPY1 = 244;
  for (let z = G, k = 0; z < G + 36; z += 6, k++) {
    const c = { color: shade(brickC, k % 2 ? 0.95 : 1) };
    if (z >= G + 6 && z < G + 24) { box(456, FPY0, z, 470, 200, z + 6, c, 'fireplace'); box(456, 220, z, 470, FPY1, z + 6, c, 'fireplace'); }
    else box(456, FPY0, z, 470, FPY1, z + 6, c, 'fireplace');
  }
  box(466, 200, G + 6, 470, 220, G + 24, { color: [30, 28, 28] }, 'firebox');
  box(452, FPY0 - 4, G + 36, 470, FPY1 + 4, G + 40, { color: [112, 70, 40] }, 'mantel');
  box(436, FPY0, G, 456, FPY1, G + 4, { color: shade(brickC, 0.9) }, 'hearth');
  box(458, 202, G + 6, 466, 218, G + 8, GLOW([255, 120, 40], 3), 'embers');

  // ------------------------------------------------------------ garage --
  box(300, -190, 0, 470, 0, 4, { asset: TILE, color: [168, 166, 160] }, 'garage floor');
  box(300, -190, GC, 470, 0, GC + 4, { asset: TILE, color: [240, 240, 236], direction: 5 }, 'garage ceiling');
  box(360, -14, 4, 390, 0, 14, { color: [170, 168, 162] }, 'garage step');
  const gd = [op(306, 380, 4, 76), op(390, 464, 4, 76)], gWin = op(-120, -84, 40, 66);
  wall('x', -200, 290, 480, 0, WT, 'siding-', gd, 'garage front', 6, [true, true]);
  wall('y', 290, -190, 0, 0, WT, 'siding-', [gWin], 'garage side');
  windowIn('y', 290, -1, gWin);
  wall('y', 470, -190, 0, 0, WT, 'siding+', [], 'garage side');
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

  // ------------------------------------------------------ chimney (outside the living room) --
  for (let z = 0, k = 0; z < 228; z += 12, k++) box(480, 190, z, 516, 230, z + 12, { color: shade([150, 76, 56], [1, 0.93, 1.05, 0.97][k % 4]) }, 'chimney');
  box(478, 188, 228, 518, 232, 234, { color: [120, 118, 114] }, 'chimney cap');

  // ------------------------------------------------------- screened porch --
  box(300, 290, 0, 480, 300, 20, { color: WHITE }, 'porch skirt'); box(290, 300, 0, 480, 390, 20, { color: WHITE }, 'porch skirt');
  for (let x = 290, k = 0; x < 480; x += 10, k++) box(x, x < 300 ? 300 : 290, 20, x + 10, 390, 24, { color: shade([128, 84, 56], [1, 0.94, 1.04][k % 3]) }, 'porch board');
  const posts = [[290, 330], [290, 380], [470, 290], [470, 330], [470, 380], [380, 380]];
  for (const [x, y] of posts) box(x, y, G, x + 10, y + 10, 96, { color: WHITE }, 'porch post');
  box(290, 300, 96, 300, 380, WT, { color: WHITE }, 'porch beam'); box(470, 300, 96, 480, 380, WT, { color: WHITE }, 'porch beam');
  box(470, 290, 96, 480, 300, WT, { color: WHITE }, 'porch beam');
  box(290, 380, 96, 480, 390, WT, { color: WHITE }, 'porch beam');
  for (const [a, b] of [[300, 330]]) box(294, a, G, 296, b, 96, SCREEN, 'screen');
  for (const [a, b] of [[300, 330], [340, 380]]) box(474, a, G, 476, b, 96, SCREEN, 'screen');
  for (const [a, b] of [[300, 380], [390, 470]]) box(a, 384, G, b, 386, 96, SCREEN, 'screen');
  light(385, 335, 150, [255, 236, 190]);

  // ------------------------------------------------------------ the deck + yard --
  box(40, 300, 0, 290, 440, 20, { color: [120, 84, 60] }, 'deck skirt');
  for (let x = 40, k = 0; x < 290; x += 10, k++) box(x, 300, 20, x + 10, 440, 24, { color: shade([150, 82, 70], [1, 0.94, 1.05, 0.97][k % 4]) }, 'deck board');
  const RAIL = [130, 84, 56];
  for (let y = 310; y < 440; y += 30) box(40, y, G, 44, y + 4, G + 30, { color: RAIL }, 'rail post');
  box(40, 300, G + 30, 44, 440, G + 34, { color: RAIL }, 'rail');
  for (const [a, b] of [[44, 150], [190, 290]]) { box(a, 436, G + 30, b, 440, G + 34, { color: RAIL }, 'rail'); for (let x = a; x + 4 <= b; x += 30) box(x, 436, G, x + 4, 440, G + 30, { color: RAIL }, 'rail post'); }
  box(150, 440, 0, 190, 452, 16, { color: RAIL }, 'deck step'); box(150, 452, 0, 190, 464, 8, { color: RAIL }, 'deck step');
  box(40, 450, 0, 140, 540, 4, { asset: TILE, color: [150, 120, 100] }, 'pavers');
  const TUBC = { color: [150, 130, 90] };
  box(60, 460, 4, 120, 520, 26, TUBC, 'hot tub shell');
  box(60, 460, 26, 120, 466, 34, TUBC, 'hot tub rim'); box(60, 514, 26, 120, 520, 34, TUBC, 'hot tub rim');
  box(60, 466, 26, 66, 514, 34, TUBC, 'hot tub rim'); box(114, 466, 26, 120, 514, 34, TUBC, 'hot tub rim');
  box(66, 466, 26, 114, 514, 32, { color: [120, 200, 220], material: 'BMC_Glass' }, 'hot tub water');

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
    return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext, _m.zSign) } : nb;
  });
  return { bricks, W: total / 10, D: (Y0 + 540) / 10, door: [Math.round((total - X0 - (fd.a0 + fd.a1) / 2) / 10)], count: bricks.length };
}

if (process.argv[1]?.endsWith('tavistock.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'tavistock.json';
  const h = tavistock({ seed });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`tavistock seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}`);
}
