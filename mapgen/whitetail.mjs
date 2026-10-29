// 718 White Tail Ridge Dr, Fairlawn (Akron) OH 44333 (2026-10-28, owner: Zillow zpid 35332899, "design and build
// this house", then "use the Tavistock template"). A 1992 custom all-brick "Georgian Colonial", 4,424 sq ft + a
// finished lower level, built on the tavistock.mjs template (1 stud = 1 ft, walls laid by hand on the stud grid off
// the listing's own 3D-tour blueprint, refs/whitetail_bp.json; the plan's floors registered as in notes/houses.md):
//   tower  x 20..31, y 0..26: tall brick entry gable, round-arched open portal in front of a recessed front door
//          with sidelites + transom, the two-storey foyer and the stair behind it.
//   W wing x 0..21, y 0..48: one storey, front gable: panelled office (fireplace, outside chimney), owner's suite
//          (bedroom, two walk-in closets off a hall, bath).
//   main   x 30..58, y 3..35: two storeys, side gable, tan stucco gable ends. Ground: dining, laundry + mud room,
//          kitchen (open to the family room), powder room, hall to the basement stair. Up: two bedrooms on a
//          Jack-and-Jill bath at the front, a back bedroom with its own bath, hall + stair gallery.
//   B      x 20..40, y 26..59: one storey great room (double-sided fireplace with the family room, French doors) and
//          the covered back terrace (white columns, brick knee wall, ceiling under the roof).
//   F      x 39..62, y 35..48: one storey family room behind the kitchen.
//   garage x 49..72, y -13..19: 3 cars, doors in its +x side (side-loading), front gable with a gable window.
//   basement under the house: rec room (wet bar, fireplace under the office's), gym, bath, unfinished.
// Built in PLAN coordinates (garage on the right seen from the street, front at y = 0, back toward +y), mirrored
// at output (left-handed world). Grade = 100: the lot is a pad with a wedge rim, the basement is buried.
//
//   whitetail() -> { bricks, fixtures, lot }        node mapgen/whitetail.mjs [out.json]
//   fixtures (lamps, switches, doors): node mapgen/tavistock_fixtures.mjs --house whitetail --owner ID NAME --out F

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const PLASTER = [222, 218, 210], WHITE = [242, 242, 238], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const BRICK = [170, 92, 64], STUCCO = [214, 198, 164], ROOF = [96, 88, 82], CONC = [170, 168, 162], STONE = [196, 188, 172];
const PAPERS = [
  { kind: 'paint', color: [150, 40, 46] },             // dining red
  { kind: 'paint', color: [214, 200, 170] },           // foyer cream
  { kind: 'paint', color: [150, 140, 126] },           // greige
  { kind: 'paint', color: [130, 150, 136] },           // sage
  { kind: 'paint', color: [178, 184, 214] },           // blue-grey
  { kind: 'paint', color: [226, 226, 222] },           // white
  { kind: 'stripe', cols: [[6, [120, 82, 50]], [2, [100, 66, 40]]] },   // library oak panelling
];
const WAINS = [{ kind: 'stripe', cols: [[2, [244, 244, 240]], [2, [230, 230, 226]]] }, { kind: 'paint', color: [244, 244, 240] }];

// z: basement floor 24, its ceiling 96..100 | grade + ground floor 100..104 (G), ceiling 176 | upper floor 184 (U),
// ceiling 256 | eave 264 (TOP); one-storey walls end at WT
const BF = 24, BC = 96, GRADE = 100, G = 104, GC = 176, U = 184, UC = 256, TOP = 264, WT = 184;
const DOOR = 62, SILL = 26, HEAD = 62;

export function whitetail({ seed = 1 } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label)) throw new Error(`whitetail: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label, zSign = 1, asset = 'PB_DefaultMicroWedge') => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext, zSign), _m: { asset, ups, ext, zSign }, color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`whitetail: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('whitetail: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {};
  const floor = (room, rect, top, key = room) => tileFloor(fadd, rect, top, style[key] ??= pickRoomStyle(room, r), r);
  // a face-down tile; off the 10 grid (tiles only come in whole studs: 'Missing brick type') a micro brick
  const ceiling = (x0, y0, x1, y1, z, label = 'ceiling') => box(x0, y0, z, x1, y1, z + 4, [x0, y0, x1, y1].every(v => v % 10 === 0) ? { asset: TILE, color: [240, 240, 236], direction: 5 } : { color: [240, 240, 236] }, label);
  const op = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });
  const hash = (a, b) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

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
  // BRICKWORK SHOWS (BUILDING.md): 6-high courses of 3-stud blocks, joints staggered half a block per course, each
  // block its own shade
  function brickRows(axis, line, a0, a1, z0, z1, openings, t, label, base = BRICK) {
    for (let z = z0; z < z1; z += 6) {
      const zt = Math.min(z1, z + 6), off = (Math.floor(z / 6) % 2) * 14;
      for (let a = Math.floor((a0 - off) / 30) * 30 + off; a < a1; a += 30) {
        const p = Math.max(a0, a), q = Math.min(a1, a + 30);
        if (q > p) course(axis, line, p, q, z, zt, openings, shade(base, 0.88 + 0.18 * hash(a, z)), label, t);
      }
    }
  }
  function stuccoRows(axis, line, a0, a1, z0, z1, openings, t, label) {
    for (let z = z0; z < z1; z += 8) course(axis, line, a0, a1, z, Math.min(z1, z + 8), openings, shade(STUCCO, Math.floor(z / 8) % 2 ? 0.97 : 1), label, t);
  }
  // a wall: 10 deep on [line, line + 10]. neg / pos = the z from which that face is outside brick (a 4-deep skin
  // on the -/+ side; plaster below it), null = indoors; stucco = tan stucco instead of brick. The core is plaster in
  // one piece (no seams indoors); caps = brick over an end only where that end shows OUTSIDE (a plaster core end
  // showed as a strip at corners: tavistock pass 8; capping every end put brick strips inside rooms, owner 10-28)
  function wall(axis, line, a0, a1, z0, z1, { neg = null, pos = null, ops = [], label = 'wall', paint = false, caps = [false, false], stucco = false, trim = null } = {}) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings: trim ?? ops });   // trim: the openings room trim sees (an arch = its bounding box)
    if (paint || (neg == null && pos == null)) return course(axis, line, a0, a1, z0, z1, ops, paint ? [200, 196, 188] : PLASTER, label);
    const c0 = line + (neg != null ? 4 : 0), c1 = line + 10 - (pos != null ? 4 : 0);
    const ca0 = a0 + (caps[0] ? 4 : 0), ca1 = a1 - (caps[1] ? 4 : 0);
    course(axis, c0, ca0, ca1, z0, z1, ops, PLASTER, label + ' core', c1 - c0);
    for (const [p, q] of [[a0, ca0], [ca1, a1]]) if (q > p) brickRows(axis, c0, p, q, z0, z1, ops, c1 - c0, label + ' cap');
    for (const [from, t0] of [[neg, line], [pos, line + 6]]) {
      if (from == null) continue;
      if (from > z0) course(axis, t0, a0, a1, z0, Math.min(z1, from), ops, PLASTER, label + ' skin', 4);
      if (from < z1) (stucco ? stuccoRows : brickRows)(axis, t0, a0, a1, Math.max(z0, from), z1, ops, 4, label + ' brick');
    }
  }
  // windows (tavistock windowIn): slim white frame in the outer half, meeting rail, glass, stone sill; on brick a
  // white lintel with a keystone over the head
  function windowIn(axis, line, out, o, { sill = true, lintel = true, mull = [] } = {}) {
    const T = { color: WHITE };
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    const f0 = out < 0 ? line : line + 4, f1 = f0 + 6;
    pb(o.a0, o.a1, o.z0, o.z0 + 2, T, 'window frame', f0, f1);
    pb(o.a0, o.a1, o.z1 - 2, o.z1, T, 'window frame', f0, f1);
    pb(o.a0, o.a0 + 2, o.z0 + 2, o.z1 - 2, T, 'window frame', f0, f1);
    pb(o.a1 - 2, o.a1, o.z0 + 2, o.z1 - 2, T, 'window frame', f0, f1);
    const mz = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
    pb(o.a0 + 2, o.a1 - 2, mz - 2, mz, T, 'meeting rail', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, o.z0 + 2, mz - 2, GLASS, 'glass', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, mz, o.z1 - 2, GLASS, 'glass', line + 4, line + 6);
    for (const m of mull) pb(m, m + 2, o.z0 + 2, o.z1 - 2, T, 'mullion', out < 0 ? line + 2 : line + 6, out < 0 ? line + 4 : line + 8);
    const p0 = out < 0 ? line - 2 : line + 10, p1 = p0 + 2;
    if (sill) pb(o.a0 - 2, o.a1 + 2, o.z0 - 4, o.z0, { color: STONE }, 'sill', p0, p1);
    if (lintel) {
      pb(o.a0 - 4, o.a1 + 4, o.z1, o.z1 + 6, T, 'lintel', p0, p1);
      const mid = Math.round((o.a0 + o.a1) / 4) * 2;
      pb(mid - 4, mid + 4, o.z1 - 2, o.z1 + 8, T, 'keystone', out < 0 ? p0 - 2 : p1, out < 0 ? p0 : p1 + 2);
    }
  }

  // ---------------------------------------------------- interior finishes (tavistock) --
  const trimC = [244, 242, 236];
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
  // tavistock finishRoom, except a band only runs where the face has wall behind it (rooms here open onto stairs,
  // the kitchen onto the family room, fireplaces stand in walls)
  function finishRoom(R, { paper, wains = WAINS[0], skip = {} } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0 && !(skip[s] === 'all');
    const cutSpans = (sp, p0, p1) => sp.flatMap(([p, q]) => (p1 <= p || p0 >= q) ? [[p, q]] : [[p, p0], [p1, q]].filter(([u, v]) => v > u));
    for (const side of Object.keys(SIDES)) {
      if (!has[side]) continue;
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ws = faceWall(side, R);
      const ops = ws.flatMap(w => w.openings).filter(o => o.z0 < R.z1 && o.z1 > R.z0 && o.a0 < hi && o.a1 > lo);
      for (const [z0, z1, t, kind] of bands(R.z0, R.z1)) {
        let a0 = lo, a1 = hi;
        if (axis === 'y') { if (has.y0) a0 += t; if (has.y1) a1 -= t; }
        // spans of neighbouring walls merged: a band split at a wall joint showed as a seam (owner screenshot 10-28)
        let spans = ws.filter(w => w.z0 <= z0 && w.z1 >= z1).map(w => [Math.max(a0, w.a0), Math.min(a1, w.a1)]).filter(([p, q]) => q > p).sort((u, v) => u[0] - v[0])
          .reduce((m, sp) => (m.length && sp[0] <= m.at(-1)[1] ? (m.at(-1)[1] = Math.max(m.at(-1)[1], sp[1]), m) : [...m, [...sp]]), []);
        const parts = [];
        for (const o of ops) {
          const door = o.z0 <= R.z0 + 2;
          const oz0 = door ? R.z0 : o.z0 - 2, oz1 = Math.max(o.z1, Math.min(R.z1 - 6, o.z1 + 4));
          if (!(oz0 < z1 && oz1 > z0)) continue;
          const p = Math.max(a0, o.a0 - 4), q = Math.min(a1, o.a1 + 4);
          if (!spans.some(([u, v]) => p < v && q > u)) continue;
          spans = cutSpans(spans, o.a0 - 4, o.a1 + 4);
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
        if (o.a0 - 4 <= lo || o.a1 + 4 >= hi) continue;   // a casing in a corner would hit the crossing wall's bands
        const door = o.z0 <= R.z0 + 2;
        const jz0 = door ? R.z0 : o.z0, top = Math.min(R.z1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, 4, trimC, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, 4, trimC, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, 4, trimC, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 4, trimC, 'stool');
      }
    }
  }

  // --------------------------------------------------------- the roofs --
  // coursed (BUILDING.md): each course a 4-high lip with a micro wedge on it, from the ridge outward; spans(b) =
  // the stretches a course is laid over (another mass, a chimney cut out)
  function courses(start, zTop, dir, n, per, w = 10) {
    const out = [];
    for (let i = 0, a = start, z = zTop; i < n; i++, a += dir * w, z -= per) out.push({ a0: dir < 0 ? a - w : a, a1: dir < 0 ? a : a + w, zb: z - per, zt: z, i, n });
    return out;
  }
  function lay(slopeAxis, bandsL, spans, dir, label) {
    for (const b of bandsL) for (const [s0, s1] of spans(b)) {
      if (s1 <= s0) continue;
      const eave = b.i === b.n - 1, c = shade(ROOF, [1, 0.95, 1.03][b.i % 3]), lip = { color: eave ? WHITE : shade(ROOF, 0.82) };
      if (slopeAxis === 'y') { box(s0, b.a0, b.zb, s1, b.a1, b.zb + 4, lip, label + ' lip'); wedge(s0, b.a0, b.zb + 4, s1, b.a1, b.zt, [[0, -dir]], c, label); }
      else { box(b.a0, s0, b.zb, b.a1, s1, b.zb + 4, lip, label + ' lip'); wedge(b.a0, s0, b.zb + 4, b.a1, s1, b.zt, [[-dir, 0]], c, label); }
    }
  }
  // gable rows under a coursed roof: row i spans the ridge band widened by i courses, clipped to [lo, hi]
  function gable(axis, line, r0, r1, rz, per, n, lo, hi, ops = [], base = STUCCO) {
    for (let i = 1; i <= n; i++) {
      const z = rz - per * (i + 1), zt = rz - per * i;
      const a0 = Math.max(lo, r0 - 10 * i), a1 = Math.min(hi, r1 + 10 * i);
      if (a1 <= a0) continue;
      if (base === BRICK) brickRows(axis, line, a0, a1, z, zt, ops, 10, 'gable');
      else for (let zz = z; zz < zt; zz += 8) course(axis, line, a0, a1, zz, Math.min(zt, zz + 8), ops, shade(base, Math.floor(zz / 8) % 2 ? 0.96 : 1), 'gable');
    }
  }
  const ridge = (x0, y0, x1, y1, z, per, label) => {
    box(x0, y0, z - per, x1, y1, z, { color: shade(ROOF, 0.9) }, label + ' ridge');
    const alongY = y1 - y0 > x1 - x0;
    box(alongY ? x0 - 4 : x0, alongY ? y0 : y0 - 4, z, alongY ? x1 + 4 : x1, alongY ? y1 : y1 + 4, z + 4, { color: shade(ROOF, 0.8) }, label + ' ridge cap');
  };
  const minus = (s0, s1, cuts) => cuts.reduce((sp, [p, q]) => sp.flatMap(([a, b]) => (q <= a || p >= b) ? [[a, b]] : [[a, p], [q, b]].filter(([u, v]) => v > u)), [[s0, s1]]);
  const hit = (b, lo, hi) => b.a0 < hi && b.a1 > lo;

  // M: main block x 300..580, y 30..350, side gable, ridge band y 180..200, 10 per course; the kitchen / great room
  // flue (x 390..430, y 330..350) goes up through the back slope
  const MRZ = TOP + 10 * 16, FLUE = [390, 330, 430, 350];
  // the front cross gable over the dining room / bedroom 1 (x 330..440, ridge band 380..390): M's front courses
  // i >= 11 give way to it (M course 10 + k meets its course k), so the two slopes meet in valleys
  const CRZ = TOP + 10 * 5;
  lay('y', courses(180, MRZ, -1, 16, 10), b => b.i >= 11 ? minus(300, 580, [[380 - 10 * (b.i - 10), 390 + 10 * (b.i - 10)]]) : [[300, 580]], -1, 'main roof');
  lay('x', courses(380, CRZ, -1, 5, 10), b => [[20, 70 - 10 * b.i]], -1, 'cross gable roof');
  lay('x', courses(390, CRZ, 1, 5, 10), b => [[20, 70 - 10 * b.i]], 1, 'cross gable roof');
  ridge(380, 20, 390, 70, CRZ, 10, 'cross gable');
  lay('y', courses(200, MRZ, 1, 15, 10), b => hit(b, FLUE[1], FLUE[3]) ? minus(300, 580, [[FLUE[0], FLUE[2]]]) : [[300, 580]], 1, 'main roof');
  ridge(300, 180, 580, 200, MRZ, 10, 'main');
  box(300, 30, TOP, 340, 40, TOP + 10, { color: WHITE }, 'frieze'); box(430, 30, TOP, 580, 40, TOP + 10, { color: WHITE }, 'frieze');
  box(300, 340, TOP, 390, 350, TOP + 10, { color: WHITE }, 'frieze'); box(430, 340, TOP, 580, 350, TOP + 10, { color: WHITE }, 'frieze');
  // tower: x 200..310, y -20..260, front gable, ridge band x 250..260, 14 per course; left slope over the W roof,
  // right slope stops at M's gable wall (x 300) except in front of M (y < 30)
  const TRZ = TOP + 14 * 6;
  lay('x', courses(250, TRZ, -1, 6, 14), () => [[-20, 260]], -1, 'tower roof');
  lay('x', courses(260, TRZ, 1, 6, 14), b => b.a1 <= 300 ? [[-20, 260]] : b.a1 <= 310 ? [[-20, 30]] : [[-20, 20]], 1, 'tower roof');
  ridge(250, -20, 260, 260, TRZ, 14, 'tower');
  // W wing: x 0..210, y -10..490, front gable, ridge band x 100..110, 8 per course; the right slope runs onto the
  // W|B wall line (200..210) behind the tower; the office chimney (x -40..0, y 50..130) cuts the left eave
  const WRZ = WT + 8 * 11;
  lay('x', courses(100, WRZ, -1, 11, 8), b => hit(b, -40, 0) ? minus(-10, 490, [[50, 130]]) : [[-10, 490]], -1, 'wing roof');
  lay('x', courses(110, WRZ, 1, 10, 8), b => b.a1 <= 200 ? [[-10, 490]] : [[260, 490]], 1, 'wing roof');
  ridge(100, -10, 110, 490, WRZ, 8, 'wing');
  // B: great room + terrace, x 210..390, y 260..590, ridge band x 290..300, valleys with W (210) and F (390); its
  // right slope only behind M (y >= 350)
  const BRZ = WT + 8 + 8 * 9;
  lay('x', courses(290, BRZ, -1, 8, 8), () => [[260, 590]], -1, 'great room roof');
  lay('x', courses(300, BRZ, 1, 9, 8), () => [[350, 590]], 1, 'great room roof');
  ridge(290, 350, 300, 590, BRZ, 8, 'great room');   // in front of that it dies into M's left wall: cap on one side only
  box(290, 260, BRZ - 8, 300, 350, BRZ, { color: shade(ROOF, 0.9) }, 'great room ridge'); box(286, 260, BRZ, 300, 350, BRZ + 4, { color: shade(ROOF, 0.8) }, 'great room ridge cap');
  // F: family room x 390..630, y 350..490, ridge band x 500..510
  const FRZ = WT + 8 + 8 * 10;
  lay('x', courses(500, FRZ, -1, 11, 8), () => [[350, 490]], -1, 'family roof');
  lay('x', courses(510, FRZ, 1, 12, 8), b => b.a0 >= 580 ? [[340, 490]] : [[350, 490]], 1, 'family roof');
  ridge(500, 350, 510, 490, FRZ, 8, 'family');
  // garage: front gable x 480..730, y -140..200, ridge band x 600..610; its left slope only in front of M (y < 30) or
  // right of it (low enough by M that bedroom 2's small front window clears it, as in the photos)
  const GRZ = WT + 8 * 12;
  lay('x', courses(600, GRZ, -1, 12, 8), b => b.a0 >= 580 ? [[-140, 200]] : [[-140, 30]], -1, 'garage roof');
  lay('x', courses(610, GRZ, 1, 12, 8), () => [[-140, 200]], 1, 'garage roof');
  ridge(600, -140, 610, 200, GRZ, 8, 'garage');

  // ------------------------------------------------------- basement (z 0..100) --
  const P = PAPERS, D = (a0, a1, z = G) => op(a0, a1, z, z + DOOR);
  const BW = (axis, line, a0, a1, ops = [], label = 'basement wall') => wall(axis, line, a0, a1, 0, BC + 4, { ops, label });
  BW('x', 0, 0, 310); BW('x', 30, 310, 500); BW('y', 0, 10, 470); BW('x', 470, 0, 210); BW('y', 200, 440, 470); BW('x', 430, 200, 400);
  BW('y', 390, 440, 470); BW('x', 470, 390, 580); BW('y', 570, 190, 470); BW('x', 180, 500, 580); BW('y', 490, 40, 210);
  BW('y', 300, 10, 200, [D(100, 130, BF)], 'rec|gym');
  BW('x', 200, 300, 490, [], 'gym|stair'); BW('x', 250, 300, 570, [D(400, 430, BF)], 'stair|unfinished');
  BW('y', 300, 260, 430, [], 'rec|unfinished');
  BW('x', 370, 10, 300, [D(30, 60, BF), D(130, 160, BF), D(240, 270, BF)], 'rec back');
  BW('y', 90, 380, 470, [], 'storage|bath'); BW('y', 200, 380, 430, [], 'bath|closet');
  const SX0 = 284, SX1 = 380, SY0 = 210, SY1 = 250;        // down flight: basement 24 -> ground 104, top at x 380
  const bFloors = [
    ['rec', [10, 10, 300, 370], 'living'], ['gym', [310, 40, 490, 200], 'garage'], ['bbath', [100, 380, 200, 470], 'bathroom'],
    ['storage', [10, 380, 90, 470], 'garage'], ['bcloset', [210, 380, 300, 430], 'garage'], ['unfinished', [310, 260, 570, 430], 'garage'],
    ['unfinished', [400, 430, 570, 470], 'garage'], ['bhall', [380, 210, 490, 250], 'garage'], ['bhall', [500, 190, 570, 250], 'garage'],
  ];
  for (const [n, R, f] of bFloors) floor(f, R, BF, 'b' + n);
  for (const R of [[10, 10, 300, 210], [10, 210, SX0, 250], [10, 250, 300, 370], [310, 40, 490, 200], [100, 380, 200, 470], [10, 380, 90, 470],
    [210, 380, 300, 430], [310, 260, 570, 430], [400, 430, 570, 470], [380, 210, 490, 250], [500, 190, 570, 250]]) ceiling(...R, BC, 'basement ceiling');
  finishRoom({ x0: 10, y0: 10, x1: 300, y1: 370, z0: BF, z1: BC }, { paper: P[4], wains: WAINS[1], skip: { x0: [[56, 124], [166, 294]] } });
  finishRoom({ x0: 310, y0: 40, x1: 490, y1: 200, z0: BF, z1: BC }, { paper: P[5], wains: WAINS[1] });
  finishRoom({ x0: 100, y0: 380, x1: 200, y1: 470, z0: BF, z1: BC }, { paper: P[3], wains: WAINS[1] });
  // wet bar on the rec room's left wall
  box(10, 170, BF, 50, 290, BF + 32, { color: [92, 60, 40] }, 'bar cabinet'); box(10, 166, BF + 32, 54, 294, BF + 36, { color: [40, 40, 44] }, 'bar top');
  box(10, 170, BF + 50, 22, 290, BF + 54, { color: [92, 60, 40] }, 'bar shelf');
  for (let y = 180, k = 0; y < 280; y += 12, k++) box(12, y, BF + 54, 18, y + 6, BF + 66, { color: [[60, 120, 70], [110, 40, 40], [200, 180, 120]][k % 3], material: 'BMC_Glass' }, 'bottle');
  // brick fireplace on a wall: plinth, jambs round a dark firebox with embers on the room side, breast, wood mantel
  const fireplace = (x0, y0, x1, y1, z, label) => {
    box(x0, y0, z, x1, y1, z + 6, { color: shade(BRICK, 0.9) }, label + ' plinth');
    box(x0, y0, z + 6, x1, y0 + 10, z + 30, { color: BRICK }, label + ' jamb'); box(x0, y1 - 10, z + 6, x1, y1, z + 30, { color: BRICK }, label + ' jamb');
    box(x0, y0 + 10, z + 6, x1 - 4, y1 - 10, z + 30, { color: [30, 28, 28] }, label + ' firebox');
    box(x1 - 4, y0 + 12, z + 6, x1, y1 - 12, z + 8, GLOW([255, 120, 40], 3), label + ' embers');
    box(x0, y0, z + 30, x1, y1, z + 36, { color: shade(BRICK, 0.95) }, label + ' breast');
    box(x1, y0 - 4, z + 32, x1 + 4, y1 + 4, z + 36, { color: [112, 70, 40] }, label + ' mantel');
  };
  fireplace(10, 60, 24, 120, BF, 'rec fireplace');

  // ------------------------------------------------------- ground floor exterior --
  // W wing: office front (2 windows), left side (bedroom 2, bath 1), back (bath)
  const offW = op(50, 150, G + SILL - 10, G + HEAD + 4);   // the photos: one wide window across the office front
  wall('x', 0, 0, 200, GRADE, WT, { neg: GRADE, ops: [offW], label: 'office front', caps: [true, false] }); windowIn('x', 0, -1, offW, { mull: [82, 116] });
  gable('x', 0, 100, 110, WRZ, 8, 10, 0, 200);
  const sideW = [op(170, 206, G + SILL, G + HEAD), op(254, 290, G + SILL, G + HEAD), op(400, 436, G + SILL, G + HEAD)];
  wall('y', 0, 10, 470, GRADE, WT, { neg: GRADE, ops: sideW, label: 'wing left', caps: [false, false] }); sideW.forEach(o => windowIn('y', 0, -1, o));
  const wbW = [op(130, 166, G + SILL + 10, G + HEAD)];
  wall('x', 470, 0, 210, GRADE, WT, { pos: GRADE, ops: wbW, label: 'wing back', caps: [true, true] }); wbW.forEach(o => windowIn('x', 470, 1, o));
  gable('x', 470, 100, 110, WRZ, 8, 10, 0, 210);
  // tower: the portal (a round arch laid course by course, stone imposts + keystone), the recessed front door wall,
  // the side walls to TOP (outside above the wing roof), the back wall over the great room
  const ARCH = { c: 256, r: 30, spring: G + 70 };
  const archOps = [];
  for (let z = GRADE; z < ARCH.spring + ARCH.r; z += 6) {
    const dz = Math.max(0, z + 3 - ARCH.spring), hw = Math.round(Math.sqrt(Math.max(0, ARCH.r * ARCH.r - dz * dz)) / 2) * 2;
    if (hw > 0) archOps.push(op(ARCH.c - hw, ARCH.c + hw, z, z + 6));
  }
  wall('x', -10, 200, 310, GRADE, TOP, { neg: GRADE, pos: GRADE, ops: archOps, label: 'portal', caps: [true, true] });
  box(ARCH.c - ARCH.r - 6, -14, ARCH.spring - 6, ARCH.c - ARCH.r + 2, -10, ARCH.spring, { color: STONE }, 'impost');
  box(ARCH.c + ARCH.r - 2, -14, ARCH.spring - 6, ARCH.c + ARCH.r + 6, -10, ARCH.spring, { color: STONE }, 'impost');
  box(ARCH.c - 4, -14, ARCH.spring + ARCH.r - 4, ARCH.c + 4, -10, ARCH.spring + ARCH.r + 10, { color: STONE }, 'arch keystone');
  gable('x', -10, 250, 260, TRZ, 14, 5, 200, 310, [], BRICK);   // no window up here (owner: 'isnt even there')
  const fd = op(240, 270, G, G + DOOR), lites = [op(214, 232, G, G + DOOR), op(278, 296, G, G + DOOR)], transom = op(214, 296, G + DOOR + 4, G + DOOR + 18);
  wall('x', 100, 210, 300, GRADE, TOP, { neg: GRADE, ops: [fd, ...lites, transom], label: 'front door wall', caps: [false, false] });
  for (const o of [...lites, transom]) box(o.a0, 104, o.z0, o.a1, 106, o.z1, GLASS, 'sidelite');
  for (const x of [232, 236, 270, 274]) box(x, 96, G, x + 4, 100, G + DOOR, { color: WHITE }, 'door casing');
  box(214, 96, G + DOOR, 296, 100, G + DOOR + 4, { color: WHITE }, 'door head');
  box(210, 94, G + DOOR + 18, 300, 100, G + DOOR + 22, { color: WHITE }, 'door cornice');
  box(210, 0, GRADE, 300, 94, G, { color: STONE }, 'portal floor');
  ceiling(210, 0, 300, 100, TOP - 4, 'portal ceiling');
  box(250, 40, TOP - 12, 260, 50, TOP - 4, GLOW([255, 226, 170], 3), 'portal lantern');
  wall('y', 200, 0, 100, GRADE, TOP, { neg: WT, pos: GRADE, label: 'tower left (portal)' });
  wall('y', 200, 100, 260, GRADE, TOP, { neg: WT, ops: [D(120, 150), D(160, 190)], label: 'tower left' });
  wall('y', 300, 0, 30, GRADE, TOP, { neg: GRADE, pos: GRADE, label: 'tower right', caps: [false, false] });
  wall('x', 250, 210, 300, G - 4, TOP, { pos: WT, ops: [op(214, 254, G, G + DOOR + 6)], label: 'tower back', caps: [false, false] });
  gable('x', 250, 250, 260, TRZ, 14, 5, 200, 300);
  // M: front (dining, laundry, the upper floor), sides, back above the great room / kitchen
  // the photos: a tan stucco centre gable (x 330..440) with a triple window below and a tall round-arched window up
  // under the gable; brick either side: the laundry window, the Jack-and-Jill's and bedroom 2's small windows
  const dinW = op(350, 420, G + SILL - 10, G + HEAD), lauW = op(452, 478, G + SILL + 10, G + HEAD);
  const jjW = op(456, 474, U + SILL + 10, U + HEAD), b2W = op(502, 518, U + 40, U + 62);
  const AW = { c: 384, r: 30, spring: U + 40 }, archW = [op(354, 414, U + 20, AW.spring)];
  const archHw = z => Math.round(Math.sqrt(Math.max(0, AW.r * AW.r - (z - AW.spring) ** 2)) / 2) * 2;
  for (let z = AW.spring; z < AW.spring + AW.r; z += 6) { const hw = archHw(z + 3); if (hw > 0) archW.push(op(AW.c - hw, AW.c + hw, z, z + 6)); }
  wall('x', 30, 300, 330, GRADE, TOP, { neg: GRADE, label: 'main front', caps: [true, false] });
  wall('x', 30, 330, 440, GRADE, TOP, { neg: GRADE, stucco: true, ops: [dinW, ...archW], trim: [dinW, op(354, 414, U + 20, AW.spring + AW.r)], label: 'main front gable' });
  wall('x', 30, 440, 500, GRADE, TOP, { neg: GRADE, ops: [lauW, jjW], label: 'main front' });
  wall('x', 30, 500, 580, GC + 4, TOP, { neg: GC + 4, ops: [b2W], label: 'main front over garage', caps: [false, true] });
  windowIn('x', 30, -1, dinW, { mull: [372, 396] }); [lauW, jjW, b2W].forEach(o => windowIn('x', 30, -1, o));
  for (const o of archW) box(o.a0, 34, o.z0, o.a1, 36, o.z1, GLASS, 'arched window glass');
  for (const o of archW) for (const m of [364, 384, 404]) if (m >= o.a0 && m + 2 <= o.a1) box(m, 32, o.z0, m + 2, 34, o.z1, { color: WHITE }, 'arched window mullion');
  box(350, 26, archW[0].z0 - 4, 418, 30, archW[0].z0, { color: STONE }, 'arched window sill');
  gable('x', 30, 380, 390, CRZ, 10, 4, 330, 440);
  wall('y', 300, 40, 210, G - 4, TOP, { paint: true, ops: [op(120, 190, G, G + DOOR + 10)], label: 'foyer|dining' });
  wall('y', 300, 250, 340, GC + 4, TOP, { neg: GC + 4, label: 'main left over great room', caps: [false, false] });   // (from 250: it closes the stair hole's back corner)
  gable('y', 300, 180, 200, MRZ, 10, 15, 40, 340);
  const kitW = op(250, 290, G + 34, G + HEAD), bed3W = op(260, 296, U + SILL, U + HEAD), mgW = op(180, 200, MRZ - 60, MRZ - 30);
  wall('y', 570, 40, 180, GC + 4, TOP, { pos: GC + 4, label: 'main right over garage', caps: [false, false] });
  wall('y', 570, 180, 190, WT, TOP, { pos: WT, label: 'main right over the garage back wall' });   // was a slot to the sky (owner 10-28)
  wall('y', 570, 190, 340, G - 4, TOP, { pos: GRADE, ops: [kitW, bed3W], label: 'main right', caps: [false, false] });
  [kitW, bed3W].forEach(o => windowIn('y', 570, 1, o));
  gable('y', 570, 180, 200, MRZ, 10, 15, 40, 340, [mgW]); windowIn('y', 570, 1, mgW, { lintel: false });
  // (no upper windows at the back: the family room roof rises against this wall)
  wall('x', 340, 300, 390, GC + 4, TOP, { pos: WT, label: 'main back', caps: [true, false] });
  wall('x', 340, 430, 580, GC + 4, TOP, { pos: WT, label: 'main back', caps: [false, true] });
  // garage: front (window + gable window), left, the +x side with its two overhead doors, back
  // the photos: the garage's stucco front gable with one tall window running up into it
  const garW = op(584, 626, GRADE + 30, WT + 30);
  wall('x', -130, 490, 720, GRADE, WT, { neg: GRADE, ops: [garW], label: 'garage front', caps: [true, true] }); windowIn('x', -130, -1, garW, { mull: [604] });
  gable('x', -130, 600, 610, GRZ, 8, 11, 490, 720, [garW]);
  wall('y', 490, -120, 30, GRADE, WT, { neg: GRADE, label: 'garage left', caps: [false, false] });
  const gd = [op(-110, -30, GRADE + 4, GRADE + 76), op(0, 160, GRADE + 4, GRADE + 76)];
  wall('y', 710, -120, 180, GRADE, WT, { pos: GRADE, ops: gd, label: 'garage side', caps: [false, false] });
  const gbd = op(660, 690, GRADE + 4, GRADE + 4 + DOOR);
  wall('x', 180, 570, 720, GRADE, WT, { pos: GRADE, ops: [gbd], label: 'garage back', caps: [false, true] });
  gable('x', 180, 600, 610, GRZ, 8, 11, 580, 720);
  for (const g of gd) {
    for (let z = g.z0, k = 0; z < g.z1; z += 20, k++) {
      const zt = Math.min(g.z1, z + 20);
      box(713, g.a0, z, 717, g.a1, zt - 2, { color: [196, 182, 120] }, 'garage door');
      box(713, g.a0, zt - 2, 715, g.a1, zt, { color: [170, 156, 100] }, 'garage door groove');
      if (k === 2) for (let y = g.a0 + 6; y + 10 <= g.a1 - 4; y += 16) box(717, y, z + 6, 719, y + 10, z + 14, GLASS, 'garage door lite');
    }
    box(720, g.a0 - 4, g.z0, 724, g.a0, g.z1 + 4, { color: WHITE }, 'garage trim'); box(720, g.a1, g.z0, 724, g.a1 + 4, g.z1 + 4, { color: WHITE }, 'garage trim');
    box(720, g.a0, g.z1, 724, g.a1, g.z1 + 4, { color: WHITE }, 'garage trim');
  }
  for (const y of [-124, -24, 164]) box(720, y, GRADE + 60, 726, y + 6, GRADE + 72, GLOW([255, 236, 190], 3), 'garage light');
  // great room back (two French doors to the terrace), the W|B wall, the family room walls
  const fr = [op(230, 270, G, G + DOOR + 4), op(310, 350, G, G + DOOR + 4)];
  wall('x', 440, 210, 390, GRADE, WT, { pos: GRADE, ops: fr, label: 'great room back', caps: [false, false] });
  for (const o of fr) {
    const m = (o.a0 + o.a1) / 2;
    box(o.a0 + 2, 444, G, m - 2, 446, o.z1 - 2, GLASS, 'french door glass'); box(m + 2, 444, G, o.a1 - 2, 446, o.z1 - 2, GLASS, 'french door glass');
    for (const [x0, x1] of [[o.a0, o.a0 + 2], [m - 2, m + 2], [o.a1 - 2, o.a1]]) box(x0, 440, G, x1, 450, o.z1 - 2, { color: WHITE }, 'french door frame');
    box(o.a0, 440, o.z1 - 2, o.a1, 450, o.z1, { color: WHITE }, 'french door frame');
  }
  wall('y', 200, 260, 440, G - 4, WT, { pos: WT, label: 'wing|great room', caps: [false, false] });
  wall('y', 200, 440, 470, G - 4, WT, { pos: GRADE, label: 'wing|terrace', caps: [false, false] });
  const famW = [op(420, 456, G + SILL, G + HEAD), op(470, 506, G + SILL, G + HEAD), op(520, 556, G + SILL, G + HEAD), op(570, 600, G + SILL, G + HEAD)];
  wall('x', 470, 390, 620, GRADE, WT, { pos: GRADE, ops: famW, label: 'family back', caps: [true, true] }); famW.forEach(o => windowIn('x', 470, 1, o));
  const famR = [op(370, 406, G + SILL, G + HEAD), op(420, 456, G + SILL, G + HEAD)];
  wall('y', 610, 350, 470, GRADE, WT, { pos: GRADE, ops: famR, label: 'family right', caps: [false, false] }); famR.forEach(o => windowIn('y', 610, 1, o));
  wall('x', 340, 580, 620, GRADE, WT, { neg: GRADE, label: 'family front', caps: [false, true] });
  wall('x', 340, 570, 580, G - 4, GC + 4, { label: 'kitchen corner' });   // was an open slot by the kitchen window wall
  gable('x', 340, 500, 510, FRZ, 8, 10, 580, 630);
  gable('x', 470, 500, 510, FRZ, 8, 10, 390, 630);
  wall('y', 390, 370, 440, G - 4, WT, { neg: WT, ops: [op(380, 430, G, G + DOOR + 10)], label: 'great room|family', caps: [false, false] });
  wall('y', 390, 440, 470, G - 4, WT, { neg: GRADE, label: 'family|terrace' });
  gable('x', 580, 290, 300, BRZ, 8, 9, 200, 400);
  // fireplaces: the office's (on the left wall, outside chimney); the two-sided one between the great room and the
  // family room, its flue up through the upper floor and M's back slope
  fireplace(10, 60, 24, 120, G, 'office fireplace');
  for (let z = GRADE, k = 0; z < WRZ + 30; z += 12, k++) box(-40, 50, z, 0, 130, Math.min(WRZ + 30, z + 12), { color: shade(BRICK, [1, 0.93, 1.05, 0.97][k % 4]) }, 'chimney');
  box(-42, 48, WRZ + 30, 2, 132, WRZ + 36, { color: STONE }, 'chimney cap');
  for (let z = G - 4, k = 0; z < G + 38; z += 6, k++) {
    const c = { color: shade(BRICK, k % 2 ? 0.95 : 1) };
    if (z >= G + 8 && z < G + 32) { box(380, 310, z, 440, 324, z + 6, c, 'fireplace'); box(380, 356, z, 440, 370, z + 6, c, 'fireplace'); box(406, 324, z, 414, 356, z + 6, c, 'fireplace'); }
    else box(380, 310, z, 440, 370, z + 6, c, 'fireplace');
  }
  for (const [a, b] of [[380, 406], [414, 440]]) { box(a, 324, G + 10, b, 356, G + 32, { color: [30, 28, 28] }, 'firebox'); box(a + 2, 326, G + 8, b - 2, 354, G + 10, GLOW([255, 120, 40], 3), 'embers'); box(a, 324, G + 8, a + 2, 356, G + 10, { color: [30, 28, 28] }, 'firebox'); box(b - 2, 324, G + 8, b, 356, G + 10, { color: [30, 28, 28] }, 'firebox'); }
  box(376, 310, G + 38, 444, 370, G + 42, { color: [112, 70, 40] }, 'mantel');
  for (let z = G + 42, k = 0; z < GC; z += 12, k++) box(380, 310, z, 440, 370, Math.min(GC, z + 12), { color: shade(BRICK, [1, 0.93, 1.05, 0.97][k % 4]) }, 'chimney breast');   // owner: no gap over the mantel
  for (let z = GC, k = 0; z < MRZ - 20; z += 12, k++) box(FLUE[0], FLUE[1], z, FLUE[2], FLUE[3], Math.min(MRZ - 20, z + 12), { color: shade(BRICK, [1, 0.93, 1.05, 0.97][k % 4]) }, 'flue');
  box(FLUE[0] - 2, FLUE[1] - 2, MRZ - 20, FLUE[2] + 2, FLUE[3] + 2, MRZ - 14, { color: STONE }, 'flue cap');

  // ------------------------------------------------------- ground floor interior --
  const pw = (axis, line, a0, a1, ops = [], label = 'partition', z1 = GC) => wall(axis, line, a0, a1, G - 4, z1, { paint: true, ops, label });
  pw('x', 150, 10, 200, [], 'office|bedroom');
  pw('x', 300, 10, 200, [D(90, 120)], 'bedroom|closets');
  pw('y', 70, 310, 360, [D(320, 350)], 'closet A'); pw('y', 130, 310, 360, [D(320, 350)], 'closet B');
  pw('x', 360, 10, 200, [D(90, 120)], 'closets|bath');
  pw('x', 200, 310, 440, [D(400, 430)], 'dining back');
  pw('y', 430, 40, 200, [], 'dining|laundry');
  pw('x', 130, 440, 490, [D(450, 480)], 'laundry|mud');
  pw('y', 490, 40, 180, [D(150, 180)], 'mud|garage');
  pw('x', 180, 490, 570, [], 'garage|kitchen');
  pw('x', 250, 300, 440, [D(400, 430)], 'stair|great room, hall|powder');
  pw('y', 390, 260, 310, [], 'great room|powder');
  pw('y', 440, 260, 310, [], 'powder|kitchen');
  // floors (the down flight's hole stays open), ceilings
  const F1 = [
    ['office', [10, 10, 200, 150], 'living'], ['bedroom', [10, 160, 200, 300], 'bedroom'], ['closetA', [10, 310, 70, 360], 'hall'], ['whall', [80, 310, 130, 360], 'hall'],
    ['closetB', [140, 310, 200, 360], 'hall'], ['bath', [10, 370, 200, 470], 'bathroom'], ['foyer', [210, 110, 300, 210], 'hall'], ['foyer', [210, 210, SX0, 250], 'hall'],
    ['dining', [310, 40, 430, 200], 'living'], ['laundry', [440, 40, 490, 130], 'hall'], ['mud', [440, 140, 490, 190], 'hall'], ['hall', [380, 210, 440, 250], 'hall'],
    ['hall', [440, 190, 450, 260], 'hall'], ['powder', [400, 260, 440, 310], 'bathroom'], ['kitchen', [450, 190, 570, 350], 'kitchen'], ['kitchen', [440, 310, 450, 350], 'kitchen'],
    ['family', [440, 350, 610, 370], 'living'], ['family', [400, 370, 610, 470], 'living'], ['great', [210, 260, 380, 440], 'living'], ['great', [380, 260, 390, 310], 'living'],
    ['great', [380, 370, 390, 440], 'living'],
  ];
  for (const [k, R, f] of F1) floor(f, R, G, k);
  for (const R of [[10, 10, 200, 150], [10, 160, 200, 300], [10, 310, 70, 360], [80, 310, 130, 360], [140, 310, 200, 360], [10, 370, 200, 470], [310, 40, 430, 200],
    [440, 40, 490, 130], [440, 140, 490, 190], [360, 210, 440, 250], [440, 190, 450, 260], [400, 260, 440, 310], [210, 260, 390, 440], [450, 190, 570, 340],
    [440, 310, 450, 340], [440, 340, 570, 350], [390, 310, 440, 330], [430, 330, 440, 350]]) ceiling(...R, GC);
  ceiling(400, 350, 610, 470, WT - 4, 'family ceiling'); ceiling(390, 350, 400, 370, WT - 4, 'family ceiling');
  ceiling(210, 110, 300, 250, TOP - 4, 'foyer ceiling');
  finishRoom({ x0: 10, y0: 10, x1: 200, y1: 150, z0: G, z1: GC }, { paper: P[6], wains: P[6], skip: { x0: [[56, 124]] } });
  finishRoom({ x0: 10, y0: 160, x1: 200, y1: 300, z0: G, z1: GC }, { paper: P[2] });
  finishRoom({ x0: 10, y0: 370, x1: 200, y1: 470, z0: G, z1: GC }, { paper: P[3], wains: { kind: 'paint', color: [236, 236, 230] } });
  finishRoom({ x0: 210, y0: 110, x1: 300, y1: 250, z0: G, z1: TOP - 4 }, { paper: P[1], skip: { y1: [[256, 300]] } });
  finishRoom({ x0: 310, y0: 40, x1: 430, y1: 200, z0: G, z1: GC }, { paper: P[0] });
  finishRoom({ x0: 440, y0: 40, x1: 490, y1: 130, z0: G, z1: GC }, { paper: P[5], wains: WAINS[1] });
  finishRoom({ x0: 400, y0: 260, x1: 440, y1: 310, z0: G, z1: GC }, { paper: P[3], wains: WAINS[1] });
  finishRoom({ x0: 210, y0: 260, x1: 390, y1: 440, z0: G, z1: GC }, { paper: P[4] });
  finishRoom({ x0: 400, y0: 350, x1: 610, y1: 470, z0: G, z1: WT - 4 }, { paper: P[1], wains: WAINS[1] });
  // kitchen: cherry cabinets along the right wall and the garage wall, granite tops, island, fridge
  const CAB = { color: [120, 46, 34] }, GRAN = { color: [60, 56, 54] }, STEEL = { color: [190, 192, 196], material: 'BMC_Metallic' };
  box(554, 206, G, 570, 340, G + 28, CAB, 'base cabinets'); box(552, 206, G + 28, 570, 340, G + 32, GRAN, 'counter');
  box(480, 190, G, 570, 206, G + 28, CAB, 'base cabinets'); box(480, 190, G + 28, 570, 206, G + 32, GRAN, 'counter');
  box(560, 206, G + 48, 570, 246, G + 70, CAB, 'wall cabinets'); box(560, 296, G + 48, 570, 340, G + 70, CAB, 'wall cabinets');
  box(480, 260, G, 530, 290, G + 28, CAB, 'island'); box(476, 256, G + 28, 534, 294, G + 32, GRAN, 'island top');
  box(456, 190, G, 476, 206, G + 56, STEEL, 'fridge');

  // ------------------------------------------------------------ stairs --
  // up: from the foyer landing (210..264) 8 courses of 10 on 12-deep treads rising +x along y 210..250 to the upper
  // hall at x 360; treads from 3 on are 10-thick slabs, so the basement flight runs under them (headroom >= 84)
  const TREAD = [140, 96, 60], RAILC = [120, 76, 44], UX0 = 264;
  for (let k = 1; k <= 8; k++) box(UX0 + 12 * (k - 1), SY0, k <= 2 ? G : G + 10 * (k - 1), UX0 + 12 * k, SY1, G + 10 * k, { color: shade(TREAD, k % 2 ? 1 : 0.9) }, 'stair tread');
  // down: 8 courses of 10 from the hall at x 380 to the basement floor at x 284, solid from the basement floor
  for (let k = 1; k <= 8; k++) box(SX0 + 12 * (k - 1), SY0, BF + 10 * (k - 1), SX1, SY1, BF + 10 * k, { color: shade(TREAD, k % 2 ? 0.95 : 0.88) }, 'basement stair');
  // handrail on the open foyer side, tavistock's way (a hanging wedge under a standing one, 10 per 12)
  const band = (x, y0, y1, z, color, label) => { wedge(x, y0, z, x + 12, y1, z + 10, [[-1, 0]], color, label, -1); wedge(x, y0, z + 10, x + 12, y1, z + 20, [[1, 0]], color, label); };
  for (let k = 1; k <= 3; k++) {
    const x = UX0 + 12 * (k - 1);
    box(x, SY0, G + 10 * k, x + 2, SY0 + 2, G + 10 * k + 18, { color: WHITE }, 'baluster');
    band(x, SY0, SY0 + 2, G + 10 * k + 18, RAILC, 'handrail');
  }
  box(UX0 - 4, SY0, G, UX0, SY0 + 4, G + 40, { color: RAILC }, 'newel');
  // gallery rail along the stair hole on the upper hall side
  for (let x = 314; x < 360; x += 12) box(x, 206, U, x + 2, 208, U + 32, { color: WHITE }, 'gallery baluster');
  box(310, 204, U + 32, 360, 210, U + 36, { color: RAILC }, 'gallery rail');

  // ------------------------------------------------------- upper floor --
  const uw = (axis, line, a0, a1, ops = [], label = 'partition') => wall(axis, line, a0, a1, U - 4, UC, { paint: true, ops, label });
  const DU = (a0, a1) => D(a0, a1, U);
  uw('x', 160, 310, 570, [DU(380, 410), DU(500, 530)], 'bedrooms|hall');
  uw('y', 430, 40, 160, [DU(80, 110)], 'bed 1|bath'); uw('y', 490, 40, 160, [DU(80, 110)], 'bath|bed 2');
  uw('x', 220, 440, 570, [DU(460, 490)], 'hall|bed 3');
  uw('x', 250, 310, 440, [], 'hall|attic, hall|ensuite');
  uw('y', 380, 260, 340, [], 'attic|ensuite');
  uw('y', 440, 230, 340, [DU(290, 320)], 'ensuite|bed 3');
  const F2 = [
    ['bed1', [310, 40, 430, 160], 'bedroom'], ['jj', [440, 40, 490, 160], 'bathroom'], ['bed2', [500, 40, 570, 160], 'bedroom'], ['uhall', [360, 170, 440, 250], 'hall'],
    ['uhall', [310, 170, 360, 210], 'hall'], ['uhall', [440, 170, 570, 220], 'hall'], ['bed3', [450, 230, 570, 340], 'bedroom'], ['ensuite', [390, 260, 440, 330], 'bathroom'],
    ['ensuite', [430, 330, 440, 340], 'bathroom'], ['attic', [310, 260, 380, 340], 'garage'],
  ];
  for (const [k, R, f] of F2) floor(f, R, U, 'u' + k);
  for (const R of [[310, 40, 430, 160], [440, 40, 490, 160], [500, 40, 570, 160], [310, 170, 440, 250], [440, 170, 570, 220], [450, 230, 570, 340], [390, 260, 440, 330], [310, 260, 380, 340]]) ceiling(...R, UC);
  ceiling(500, -120, 710, 180, GC, 'garage ceiling');
  finishRoom({ x0: 310, y0: 40, x1: 430, y1: 160, z0: U, z1: UC }, { paper: P[4] });
  finishRoom({ x0: 440, y0: 40, x1: 490, y1: 160, z0: U, z1: UC }, { paper: P[3], wains: { kind: 'stripe', cols: [[10, [244, 244, 240]], [10, [236, 236, 232]]] } });
  finishRoom({ x0: 500, y0: 40, x1: 570, y1: 160, z0: U, z1: UC }, { paper: pick([P[2], P[3]]) });
  finishRoom({ x0: 450, y0: 230, x1: 570, y1: 340, z0: U, z1: UC }, { paper: P[2] });
  finishRoom({ x0: 390, y0: 260, x1: 440, y1: 330, z0: U, z1: UC }, { paper: P[5], wains: WAINS[1] });
  finishRoom({ x0: 440, y0: 170, x1: 570, y1: 220, z0: U, z1: UC }, { paper: P[1] });

  // ------------------------------------------------------------ garage --
  box(500, -120, GRADE, 710, 180, GRADE + 4, { asset: TILE, color: CONC }, 'garage floor');

  // ------------------------------------------------------- covered terrace --
  box(210, 450, GRADE, 390, 580, G, { color: STONE }, 'terrace slab');
  box(200, 480, GRADE, 210, 580, G, { color: STONE }, 'terrace slab'); box(390, 480, GRADE, 400, 580, G, { color: STONE }, 'terrace slab');
  const posts = [[200, 570], [260, 570], [330, 570], [390, 570], [200, 516], [390, 516]];
  for (const [x, y] of posts) { box(x, y, G, x + 10, y + 10, WT - 14, { color: WHITE }, 'terrace column'); box(x - 2, y - 2, WT - 14, x + 12, y + 12, WT - 8, { color: WHITE }, 'column capital'); }
  box(200, 580, WT - 8, 400, 590, WT, { color: WHITE }, 'terrace beam'); box(200, 480, WT - 8, 210, 580, WT, { color: WHITE }, 'terrace beam'); box(390, 480, WT - 8, 400, 580, WT, { color: WHITE }, 'terrace beam');
  for (const [a, b] of [[210, 260], [340, 390]]) { brickRows('x', 572, a, b, G, G + 24, [], 6, 'knee wall'); box(a, 570, G + 24, b, 580, G + 28, { color: STONE }, 'knee cap'); }
  for (const x of [200, 390]) for (const [a, b] of [[480, 516], [526, 570]]) { brickRows('y', x + 2, a, b, G, G + 24, [], 6, 'knee wall'); box(x, a, G + 24, x + 10, b, G + 28, { color: STONE }, 'knee cap'); }
  box(210, 450, WT - 4, 390, 580, WT, { asset: TILE, color: [210, 200, 186], direction: 5 }, 'terrace ceiling');
  box(270, 580, GRADE, 330, 596, GRADE + 2, { color: STONE }, 'terrace step');
  box(296, 506, WT - 10, 304, 514, WT - 4, GLOW([255, 236, 190], 3), 'terrace light');

  // ------------------------------------------------------------ the lot --
  // pad at grade round the basement; the drive from the garage's side doors out to the street, a brick walk to the
  // portal; a wedge rim drops the pad to 0 round the lot
  const LOT = [-250, -400, 960, 720], GREEN = [84, 122, 58];
  const pad = (x0, y0, x1, y1) => {
    for (let x = x0; x < x1; x += 400) for (let y = y0; y < y1; y += 400) box(x, y, 0, Math.min(x1, x + 400), Math.min(y1, y + 400), GRADE, { color: shade(GREEN, 0.96 + 0.08 * hash(x, y)) }, 'pad');
  };
  pad(LOT[0], LOT[1], 0, LOT[3]); pad(580, LOT[1], LOT[2], LOT[3]); pad(0, LOT[1], 500, 0); pad(500, LOT[1], 580, 180);
  pad(0, 480, 580, LOT[3]); pad(210, 440, 390, 480); pad(310, 0, 500, 30);
  const PAV = [[196, 176, 150], [184, 164, 138], [206, 188, 160]];
  box(730, -140, GRADE, 900, 190, GRADE + 4, { color: CONC }, 'apron'); box(780, LOT[1], GRADE, 900, -140, GRADE + 4, { color: CONC }, 'drive');
  for (let y = LOT[1], k = 0; y < -50; y += 10, k++) for (let x = 230 - (k % 2 ? 10 : 0); x < 280; x += 20) { const a = Math.max(230, x), b = Math.min(280, x + 20); if (b > a) box(a, y, GRADE, b, y + 10, GRADE + 4, { color: PAV[Math.floor(hash(x, y) * 3)] }, 'paver'); }
  box(210, -50, GRADE, 300, -10, GRADE + 2, { color: STONE }, 'stoop');
  for (const [a, b, y] of [[10, 190, -24], [320, 480, 4]]) for (let x = a, k = 0; x < b; x += 10, k++) box(x, y, GRADE, Math.min(b, x + 10), y + 12, GRADE + (k % 3 ? 16 : 20), { color: k % 2 ? [56, 92, 48] : [48, 84, 42] }, 'boxwood');
  box(204, -120, GRADE + 4, 210, -114, GRADE + 64, { color: [30, 30, 32] }, 'lamp post'); box(200, -124, GRADE + 64, 214, -110, GRADE + 80, GLOW([255, 226, 170], 3), 'lamp');
  {
    const h = GRADE, run = 100, [x0, y0, x1, y1] = LOT, W = 'PB_DefaultMicroWedge';
    for (let a = x0; a < x1; a += 400) {
      const b = Math.min(x1, a + 400);
      wedge(a, y0 - run, 0, b, y0, h, [[0, 1]], GREEN, 'rim'); wedge(a, y1, 0, b, y1 + run, h, [[0, -1]], GREEN, 'rim');
    }
    for (let a = y0; a < y1; a += 400) {
      const b = Math.min(y1, a + 400);
      wedge(x0 - run, a, 0, x0, b, h, [[1, 0]], GREEN, 'rim'); wedge(x1, a, 0, x1 + run, b, h, [[-1, 0]], GREEN, 'rim');
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ax = sx < 0 ? x0 - run : x1, ay = sy < 0 ? y0 - run : y1;
      wedge(ax, ay, 0, ax + run, ay + run, h, [[-sx, 0], [0, -sy]], GREEN, 'rim corner', 1, 'PB_DefaultMicroWedgeCorner');
    }
    void W;
  }

  // ----------------------------------------------------------- fixtures --
  // for tavistock_fixtures.mjs --house whitetail: room lamps [x, y, ceiling], a switch on a wall face beside the door
  // (normal into the room, 10+ clear of door casings: on a casing the switch is rejected and its wires fail), every
  // hinged door (opening on a wall line, hinge a0)
  const ROOMS = [
    { name: 'office', lamps: [[105, 80]], c: GC, sw: [200, 106, '-x', G] },
    { name: 'owner bedroom', lamps: [[105, 230]], c: GC, sw: [200, 206, '-x', G] },
    { name: 'owner hall', lamps: [[105, 335]], c: GC, sw: [128, 300, '-y', G] },
    { name: 'owner bath', lamps: [[105, 420]], c: GC, sw: [130, 370, '+y', G] },
    { name: 'foyer', lamps: [[255, 180, TOP - 4]], c: GC, sw: [210, 206, '+x', G] },
    { name: 'dining', lamps: [[370, 120]], c: GC, sw: [310, 106, '+x', G] },
    { name: 'laundry', lamps: [[465, 85]], c: GC, sw: [440, 120, '+x', G] },
    { name: 'kitchen', lamps: [[505, 240], [505, 310]], c: GC, sw: [450, 285, '+x', G] },
    { name: 'family', lamps: [[505, 410]], c: WT - 4, sw: [406, 470, '-y', G] },
    { name: 'great room', lamps: [[300, 350]], c: GC, sw: [210, 290, '+x', G] },
    { name: 'powder', lamps: [[420, 285]], c: GC, sw: [440, 290, '-x', G] },
    { name: 'garage', lamps: [[560, 20], [650, 20], [650, 120]], c: GC, sw: [500, 140, '+x', GRADE] },
    { name: 'terrace', lamps: [[300, 530]], c: WT - 4, sw: [290, 450, '+y', G] },
    { name: 'bedroom 1', lamps: [[370, 100]], c: UC, sw: [420, 160, '-y', U] },
    { name: 'jack and jill', lamps: [[465, 100]], c: UC, sw: [440, 124, '+x', U] },
    { name: 'bedroom 2', lamps: [[535, 100]], c: UC, sw: [540, 160, '-y', U] },
    { name: 'upper hall', lamps: [[400, 210], [505, 195]], c: UC, sw: [364, 170, '+y', U] },
    { name: 'bedroom 3', lamps: [[510, 285]], c: UC, sw: [500, 230, '+y', U] },
    { name: 'ensuite', lamps: [[415, 295]], c: UC, sw: [440, 274, '-x', U] },
    { name: 'rec room', lamps: [[150, 120], [150, 280]], c: BC, sw: [300, 144, '-x', BF] },
    { name: 'gym', lamps: [[400, 120]], c: BC, sw: [310, 144, '+x', BF] },
    { name: 'basement bath', lamps: [[150, 425]], c: BC, sw: [170, 380, '+y', BF] },
    { name: 'unfinished', lamps: [[440, 360]], c: BC, sw: [440, 260, '+y', BF] },
  ];
  const DOORS = [
    { name: 'front', axis: 'x', line: 100, a0: fd.a0, a1: fd.a1, z0: G, color: [110, 30, 36] },
    { name: 'office', axis: 'y', line: 200, a0: 120, a1: 150, z0: G },
    { name: 'owner bedroom', axis: 'y', line: 200, a0: 160, a1: 190, z0: G },
    { name: 'owner hall', axis: 'x', line: 300, a0: 90, a1: 120, z0: G },
    { name: 'closet A', axis: 'y', line: 70, a0: 320, a1: 350, z0: G },
    { name: 'closet B', axis: 'y', line: 130, a0: 320, a1: 350, z0: G },
    { name: 'owner bath', axis: 'x', line: 360, a0: 90, a1: 120, z0: G },
    { name: 'laundry', axis: 'x', line: 130, a0: 450, a1: 480, z0: G },
    { name: 'mud', axis: 'y', line: 490, a0: 150, a1: 180, z0: G },
    { name: 'powder', axis: 'x', line: 250, a0: 400, a1: 430, z0: G },
    { name: 'garage back', axis: 'x', line: 180, a0: gbd.a0, a1: gbd.a1, z0: gbd.z0 },
    { name: 'bedroom 1', axis: 'x', line: 160, a0: 380, a1: 410, z0: U },
    { name: 'bedroom 2', axis: 'x', line: 160, a0: 500, a1: 530, z0: U },
    { name: 'jj to bedroom 1', axis: 'y', line: 430, a0: 80, a1: 110, z0: U },
    { name: 'jj to bedroom 2', axis: 'y', line: 490, a0: 80, a1: 110, z0: U },
    { name: 'bedroom 3', axis: 'x', line: 220, a0: 460, a1: 490, z0: U },
    { name: 'ensuite', axis: 'y', line: 440, a0: 290, a1: 320, z0: U },
    { name: 'gym', axis: 'y', line: 300, a0: 100, a1: 130, z0: BF },
    { name: 'basement storage', axis: 'x', line: 370, a0: 30, a1: 60, z0: BF },
    { name: 'basement bath', axis: 'x', line: 370, a0: 130, a1: 160, z0: BF },
    { name: 'basement closet', axis: 'x', line: 370, a0: 240, a1: 270, z0: BF },
    { name: 'unfinished', axis: 'x', line: 250, a0: 400, a1: 430, z0: BF },
  ];

  // ------------------------------------------------------------- output --
  // mirror into the left-handed world (plan x -> TOTAL - x)
  const TOTAL = 720;
  const bricks = B.bricks.map(({ label, _m, _tri, ...b }) => {
    const nb = { ...b, position: [TOTAL - b.position[0], b.position[1], b.position[2]] };
    if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] };
    return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext, _m.zSign) } : nb;
  });
  const PW = (x, y, z) => [TOTAL - x, y, z];
  const N = n => ({ '+x': [-1, 0], '-x': [1, 0], '+y': [0, 1], '-y': [0, -1] })[n];
  const fixtures = {
    rooms: ROOMS.map(q => ({ name: q.name, lamps: q.lamps.map(([x, y, c = q.c]) => ({ at: PW(x, y, c) })), switch: { at: PW(q.sw[0], q.sw[1], q.sw[3]), normal: N(q.sw[2]) } })),
    doors: DOORS.map(d => {
      const at = (a, t, z) => d.axis === 'x' ? PW(a, d.line + t, z) : PW(d.line + t, a, z);
      return { name: d.name, color: d.color, z0: d.z0, z1: d.z0 + DOOR, a0: at(d.a0, 5, d.z0), a1: at(d.a1, 5, d.z0) };
    }),
  };
  const lot = [TOTAL - LOT[2] - 100, LOT[1] - 100, TOTAL - LOT[0] + 100, LOT[3] + 100];
  return { bricks, fixtures, lot, count: bricks.length };
}

if (process.argv[1]?.endsWith('whitetail.mjs')) {
  const out = process.argv[2] ?? 'whitetail.json', h = whitetail();
  fs.writeFileSync(out, JSON.stringify({ bricks: h.bricks }));
  console.error(`whitetail: ${h.count} bricks, lot (output frame) ${h.lot.join(',')}`);
}
