// Chateau Reve, 10 Beverly Ridge Ter, Beverly Hills CA 90210 (2026-10-29, owner: Zillow zpid 465674284, "research
// house use tavistock model to create a new mapgen"). Built 2012, 24,592 sq ft, 9 bed / 15 bath, $57M, on 19 gated
// acres. The listing has no floorplan, so the plan comes from its 35 photos (aerials p01 back / p34 front, front p03,
// pool + loggia p09 / p29, foyer p04) and the description's room list. It is a Tuscan villa: tan stucco, red tile HIP
// roofs with flat decks in the middle (seen in the aerials), cupola chimneys, a pedimented portico in the centre of
// the front, and an arched loggia across the back facing a long pool. The "symmetrical butterfly plan" (wings angled
// round the motor court) is squared to the stud grid: a centre block between two wings, the garage pavilion forward
// on one side and a taller pavilion on the other.
// Same template as tavistock.mjs / whitetail.mjs: 1 stud = 1 ft, walls laid by hand on the stud grid in PLAN
// coordinates (front at y = 0, back toward +y, garage on the left seen from the court), mirrored at output.
//   GAR  x 300..700,   y -700..0  one storey, 6 cars, three overhead doors facing the motor court (+x)
//   L    x 300..900,   y 0..500   service wing: laundry, staff room, butler's pantry, kitchen | up: staff, guests 3 + 4
//   C    x 900..1700,  y 0..700   taller centre: dining, two-storey foyer with twin stairs, study (library panelling),
//                                 family, living (fireplace, French doors to the loggia), music hall | up: bedrooms
//                                 5 + 6, gallery, bar lounge, theater, game room
//   R    x 1700..2300, y 0..500   guest suites 1 + 2 (bath + walk-in each) on a back hall | up: primary bedroom
//                                 (fireplace) + sitting room
//   RP   x 2300..2600, y -200..700 taller pavilion: gym, wine room | up: the primary's two baths, two walk-ins,
//                                 massage + salon rooms
//   loggia x 1000..1600, y 700..890: arcade of round arches under a hipped roof; terrace and lap pool behind,
//   motor court with a fountain in front.
// No basement (grade = 0, floors at 8: it sits on the owner's flat world like houses_flat.mjs expects).
//
//   chateaureve() -> { bricks, fixtures, lot }        node mapgen/chateaureve.mjs [out.json]
//   fixtures (lamps, switches, doors): node mapgen/tavistock_fixtures.mjs --house chateaureve --owner ID NAME --out F

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
const PLASTER = [226, 218, 200], TRIM = [236, 226, 204], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const STUCCO = [222, 198, 158], ROOF = [166, 80, 54], STONE = [212, 200, 178], DECK = [150, 140, 128], PAVE = [190, 168, 136];
const PAPERS = {
  cream: { kind: 'paint', color: [236, 222, 190] }, gold: { kind: 'paint', color: [222, 196, 140] },
  sage: { kind: 'paint', color: [170, 178, 140] }, terra: { kind: 'paint', color: [196, 132, 96] },
  red: { kind: 'paint', color: [130, 30, 34] }, white: { kind: 'paint', color: [236, 234, 226] },
  panel: { kind: 'stripe', cols: [[6, [104, 56, 34]], [2, [84, 44, 26]]] },          // library / bar mahogany
  silk: { kind: 'stripe', cols: [[4, [214, 196, 150]], [4, [200, 180, 134]]] },      // striped silk (p14, p17)
};
const WAINS = [{ kind: 'stripe', cols: [[2, [244, 240, 228]], [2, [230, 224, 210]]] }, { kind: 'paint', color: [242, 236, 222] }, PAPERS.panel];

// z: ground floor 4..8 (G), ceiling 104 | upper floor 112 (U), ceiling 192 in the wings, 232 in the taller centre and
// pavilion | eaves: wings 200 (TOP), centre + pavilion 240 (TOPC), garage + loggia 128
const G = 8, GC = 104, U = 112, UC = 192, UCC = 232, TOP = 200, TOPC = 240, GT = 128, LT = 128;
const DOOR = 62;

export function chateaureve({ seed = 1 } = {}) {
  const r = rng(seed);
  const B = makeBuilder();
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label)) throw new Error(`chateaureve: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label, zSign = 1, asset = 'PB_DefaultMicroWedge') => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext, zSign), _m: { asset, ups, ext, zSign }, color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`chateaureve: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('chateaureve: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {};
  const floor = (room, rect, top, key = room) => tileFloor(fadd, rect, top, style[key] ??= pickRoomStyle(room, r), r);
  const flat = (x0, y0, x1, y1) => [x0, y0, x1, y1].every(v => v % 10 === 0);
  const ceiling = (x0, y0, x1, y1, z, label = 'ceiling') => box(x0, y0, z, x1, y1, z + 4, flat(x0, y0, x1, y1) ? { asset: TILE, color: [244, 238, 224], direction: 5 } : { color: [244, 238, 224] }, label);
  const op = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });
  const hash = (a, b) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ------------------------------------------------------------ walls --
  const WALLS = [], DOORS = [];
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
  function stuccoRows(axis, line, a0, a1, z0, z1, openings, t, label) {
    for (let z = z0; z < z1; z += 8) course(axis, line, a0, a1, z, Math.min(z1, z + 8), openings, shade(STUCCO, Math.floor(z / 8) % 2 ? 0.97 : 1), label, t);
  }
  // whitetail wall(): 10 deep on [line, line + 10]; neg / pos = the z from which that face is outside (a 4-deep
  // stucco skin on that side, plaster below), null = indoors. Plaster core in one piece; caps = stucco over an end
  // that shows outside. Outside walls also get a stone string course at the floor line and a cornice under the eave
  // (sc / cornice false where another mass's roof meets the face)
  function wall(axis, line, a0, a1, z0, z1, { neg = null, pos = null, ops = [], label = 'wall', paint = false, caps = [false, false], trim = null, sc = true, cornice = true } = {}) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings: trim ?? ops });
    if (paint || (neg == null && pos == null)) return course(axis, line, a0, a1, z0, z1, ops, paint ? [214, 206, 190] : PLASTER, label);
    const c0 = line + (neg != null ? 4 : 0), c1 = line + 10 - (pos != null ? 4 : 0);
    const ca0 = a0 + (caps[0] ? 4 : 0), ca1 = a1 - (caps[1] ? 4 : 0);
    course(axis, c0, ca0, ca1, z0, z1, ops, PLASTER, label + ' core', c1 - c0);
    for (const [p, q] of [[a0, ca0], [ca1, a1]]) if (q > p) stuccoRows(axis, c0, p, q, z0, z1, ops, c1 - c0, label + ' cap');
    for (const [from, t0, f] of [[neg, line, line], [pos, line + 6, line + 10]]) {
      if (from == null) continue;
      if (from > z0) course(axis, t0, a0, a1, z0, Math.min(z1, from), ops, PLASTER, label + ' skin', 4);
      if (from < z1) stuccoRows(axis, t0, a0, a1, Math.max(z0, from), z1, ops, 4, label + ' stucco');
      if (from > 0) continue;
      // cut round openings and their keystones (a door's fanlight rises through the string course)
      const wide = ops.map(o => ({ ...o, a0: o.a0 - 6, a1: o.a1 + 6, z1: o.z1 + 10 }));
      const out = (p0, t, zz0, zz1, color, lab) => course(axis, f === line ? line - t : line + 10, a0 + (axis === 'y' ? t : 0), a1 - (axis === 'y' ? t : 0), zz0, zz1, wide, color, lab, t);   // side walls stop short: inside corners
      if (sc && z1 > GC + 6) out(0, 2, GC, GC + 6, STONE, label + ' string course');
      if (cornice) { out(0, 4, z1 - 8, z1 - 4, TRIM, label + ' cornice'); out(0, 2, z1 - 4, z1, shade(TRIM, 0.94), label + ' cornice'); }
    }
  }
  // a door in a wall: 30 wide, hinge at a0; recorded for the fixtures (the owner's working door)
  const D = (a0, z = G) => ({ ...op(a0, a0 + 30, z, z + DOOR), door: true });
  // an arched opening: a rectangle up to the spring, then 4-high rows of a half circle (BUILDING.md: arched heads)
  const ARCH = (c, rad, z0, spring, door = false) => {
    const ops = [op(c - rad, c + rad, z0, spring)];
    for (let z = spring; z < spring + rad; z += 4) {
      const dz = z + 2 - spring, hw = Math.floor(Math.sqrt(Math.max(0, rad * rad - dz * dz)) / 2) * 2;
      if (hw > 0) ops.push(op(c - hw, c + hw, z, z + 4));
    }
    return { ops, rows: ops.slice(1), box: op(c - rad, c + rad, z0, ops.at(-1).z1), c, rad, z0, spring, door };
  };
  const gw = c => ARCH(c, 16, G + 16, G + 66);           // ground window
  const uw = c => ARCH(c, 16, U + 16, U + 50);           // wing upper window
  const cw = c => ARCH(c, 16, U + 24, U + 80);           // centre / pavilion upper window (taller storey)
  // arched glazing: frame sides + bottom in the outer 6, glass in the middle, a centre mullion, stone sill (not on
  // doors), keystone; a door's fanlight is glass from the spring up
  function drawArch(axis, line, out, w) {
    const pb = (a, b, z, zt, m, lab, t0, t1) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    const f0 = out < 0 ? line : line + 4, f1 = f0 + 6, g0 = line + 4, g1 = line + 6, a0 = w.c - w.rad, a1 = w.c + w.rad;
    const top = w.box.z1, T = { color: TRIM };
    if (w.door) {
      for (const o of w.rows) pb(o.a0, o.a1, o.z0, o.z1, GLASS, 'fanlight', g0, g1);
    } else {
      pb(a0, a1, w.z0, w.z0 + 2, T, 'window frame', f0, f1);
      pb(a0, a0 + 2, w.z0 + 2, w.spring, T, 'window frame', f0, f1); pb(a1 - 2, a1, w.z0 + 2, w.spring, T, 'window frame', f0, f1);
      pb(a0 + 2, a1 - 2, w.z0 + 2, w.spring, GLASS, 'glass', g0, g1);
      for (const o of w.rows) pb(o.a0, o.a1, o.z0, o.z1, GLASS, 'arch glass', g0, g1);
      pb(w.c - 1, w.c + 1, w.z0 + 2, top - 4, T, 'mullion', out < 0 ? line + 2 : line + 6, out < 0 ? line + 4 : line + 8);
      const p0 = out < 0 ? line - 2 : line + 10;
      if (w.z0 > G + 2) pb(a0 - 2, a1 + 2, w.z0 - 4, w.z0, { color: STONE }, 'sill', p0, p0 + 2);
    }
    const k0 = out < 0 ? line - 2 : line + 10;
    pb(w.c - 4, w.c + 4, top - 2, top + 8, { color: STONE }, 'keystone', k0, k0 + 2);
  }
  // an outside wall with its openings: plain ops (doors), ARCH windows (drawn after the wall)
  function ext(axis, line, a0, a1, z1, side, from, list, opts = {}) {
    const ops = list.flatMap(w => w.ops ?? [w]), trim = list.map(w => w.box ?? w);
    wall(axis, line, a0, a1, 0, z1, { [side]: from, ops, trim, ...opts });
    for (const w of list) if (w.ops) drawArch(axis, line, side === 'neg' ? -1 : 1, w);
    for (const o of ops) if (o.door) DOORS.push({ axis, line, a0: o.a0, a1: o.a1, z0: o.z0 });
  }
  // partitions: ground G-4..GC, upper U-4..z1 (painted plaster)
  function pw(axis, line, a0, a1, ops = [], z0 = G - 4, z1 = GC, label = 'partition') {
    wall(axis, line, a0, a1, z0, z1, { paint: true, ops, label });
    for (const o of ops) if (o.door) DOORS.push({ axis, line, a0: o.a0, a1: o.a1, z0: o.z0 });
  }
  const up = (axis, line, a0, a1, ops = [], z1 = UC) => pw(axis, line, a0, a1, ops, U - 4, z1, 'upper partition');

  // ---------------------------------------------------- interior finishes (tavistock / whitetail) --
  const trimC = [244, 240, 228];
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
        if (o.a0 - 4 <= lo || o.a1 + 4 >= hi) continue;
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
  // coursed (BUILDING.md) HIP roofs: ring k from the eave inward is a 4-high lip with a micro wedge on it, 20 run per
  // 8 rise (a low tile pitch), corner wedges at the hips; after n rings a flat ridge deck (the aerials show small flat
  // decks along the ridges). open.x0 / x1 / y0 / y1: that side runs into a taller wall (no slope there)
  // n defaults to rings up to a ridge deck 20 wide
  function hip(x0, y0, x1, y1, zE, { n, w = 20, per = 8, open = {}, label = 'roof' } = {}) {
    n ??= Math.floor((Math.min(x1 - x0, y1 - y0) / 2 - 10) / w);
    for (let k = 0; k < n; k++) {
      const zb = zE + per * k, zt = zb + per, c = shade(ROOF, [1, 0.94, 1.05][k % 3]), lip = { color: k === 0 ? TRIM : shade(ROOF, 0.8) };
      const X0 = open.x0 ? x0 : x0 + w * k, X1 = open.x1 ? x1 : x1 - w * k, Y0 = open.y0 ? y0 : y0 + w * k, Y1 = open.y1 ? y1 : y1 - w * k;
      const pc = (a0, b0, a1, b1, ups, corner) => {
        box(a0, b0, zb, a1, b1, zb + 4, lip, label + ' lip');
        wedge(a0, b0, zb + 4, a1, b1, zt, ups, c, label, 1, corner ? 'PB_DefaultMicroWedgeCorner' : undefined);
      };
      const fx0 = open.x0 ? X0 : X0 + w, fx1 = open.x1 ? X1 : X1 - w, sy0 = open.y0 ? Y0 : Y0 + w, sy1 = open.y1 ? Y1 : Y1 - w;
      if (!open.y0) pc(fx0, Y0, fx1, Y0 + w, [[0, 1]]);
      if (!open.y1) pc(fx0, Y1 - w, fx1, Y1, [[0, -1]]);
      if (!open.x0) pc(X0, sy0, X0 + w, sy1, [[1, 0]]);
      if (!open.x1) pc(X1 - w, sy0, X1, sy1, [[-1, 0]]);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        if (open[sx < 0 ? 'x0' : 'x1'] || open[sy < 0 ? 'y0' : 'y1']) continue;
        const ax = sx < 0 ? X0 : X1 - w, ay = sy < 0 ? Y0 : Y1 - w;
        pc(ax, ay, ax + w, ay + w, [[-sx, 0], [0, -sy]], true);
      }
    }
    const d = [open.x0 ? x0 : x0 + w * n, open.y0 ? y0 : y0 + w * n, open.x1 ? x1 : x1 - w * n, open.y1 ? y1 : y1 - w * n], z = zE + per * n;
    for (let x = d[0]; x < d[2]; x += 400) for (let y = d[1]; y < d[3]; y += 400) {
      const q = [x, y, Math.min(d[2], x + 400), Math.min(d[3], y + 400)];
      box(q[0], q[1], z - 4, q[2], q[3], z, flat(...q) ? { asset: TILE, color: DECK } : { color: DECK }, label + ' deck');
    }
    return { d, z };
  }
  // gable courses (whitetail lay), for the portico
  function courses(start, zTop, dir, n, per, w = 10) {
    const out = [];
    for (let i = 0, a = start, z = zTop; i < n; i++, a += dir * w, z -= per) out.push({ a0: dir < 0 ? a - w : a, a1: dir < 0 ? a : a + w, zb: z - per, zt: z, i, n });
    return out;
  }
  function lay(bandsL, s0, s1, dir, label) {   // slopes along x
    for (const b of bandsL) {
      const eave = b.i === b.n - 1, c = shade(ROOF, [1, 0.94, 1.05][b.i % 3]);
      box(b.a0, s0, b.zb, b.a1, s1, b.zb + 4, { color: eave ? TRIM : shade(ROOF, 0.8) }, label + ' lip');
      wedge(b.a0, s0, b.zb + 4, b.a1, s1, b.zt, [[-dir, 0]], c, label);
    }
  }
  // a cupola chimney on a roof deck: stucco stack, four corner posts, a little hipped cap (the photos' chimneys)
  function chimney(x0, y0, x1, y1, z) {
    for (let zz = z, k = 0; zz < z + 36; zz += 12, k++) box(x0, y0, zz, x1, y1, zz + 12, { color: shade(STUCCO, [1, 0.96, 1.03][k % 3]) }, 'chimney');
    box(x0 - 2, y0 - 2, z + 36, x1 + 2, y1 + 2, z + 40, { color: STONE }, 'chimney band');
    for (const [a, b] of [[x0, y0], [x1 - 8, y0], [x0, y1 - 8], [x1 - 8, y1 - 8]]) box(a, b, z + 40, a + 8, b + 8, z + 56, { color: STUCCO }, 'cupola post');
    hip(x0 - 6, y0 - 6, x1 + 6, y1 + 6, z + 56, { n: 2, w: 10, label: 'cupola' });
  }

  // the wings hip down at their ends under the taller blocks' eaves (whose walls are stucco from the wing eave up)
  hip(280, -720, 720, 0, GT, { label: 'garage roof' });
  const rL = hip(280, -20, 900, 520, TOP, { label: 'service wing roof' });
  const rC = hip(880, -20, 1720, 720, TOPC, { label: 'centre roof' });
  const rR = hip(1700, -20, 2300, 520, TOP, { label: 'guest wing roof' });
  const rP = hip(2280, -220, 2620, 720, TOPC, { label: 'pavilion roof' });
  hip(980, 700, 1620, 920, LT, { n: 5, open: { y0: true }, label: 'loggia roof' });   // low: the theater's windows clear it
  // chimneys astride the ridge decks
  const onRidge = ({ d, z }, f) => {
    const alongX = d[2] - d[0] >= d[3] - d[1], at = (a, b, t) => Math.round((a + (b - a) * t) / 10) * 10;
    const cx = alongX ? at(d[0], d[2], f) : at(d[0], d[2], 0.5), cy = alongX ? at(d[1], d[3], 0.5) : at(d[1], d[3], f);
    chimney(cx - 20, cy - 20, cx + 20, cy + 20, z);
  };
  onRidge(rL, 0.5); onRidge(rC, 0); onRidge(rC, 1); onRidge(rR, 0.5); onRidge(rP, 0.55);

  // ------------------------------------------------------- outside walls --
  const FD = [D(1270), D(1300)];                          // front double door under a fanlight
  const frontDoor = { ...ARCH(1300, 30, G, G + DOOR, true) }; frontDoor.ops = [...FD, ...frontDoor.rows];
  const LD = [D(1270), D(1300)];                          // loggia double door, glazed doors either side
  const logDoor = { ...ARCH(1300, 30, G, G + DOOR, true) }; logDoor.ops = [...LD, ...logDoor.rows];
  const glazed = c => ARCH(c, 24, G, G + 66);
  // garage pavilion
  ext('x', -700, 300, 700, GT, 'neg', 0, [400, 600].map(c => ARCH(c, 16, 30, 76)), { caps: [true, true], sc: false });
  ext('y', 300, -690, 0, GT, 'neg', 0, [-520, -180].map(c => ARCH(c, 16, 30, 76)), { sc: false });
  const gd = [op(-650, -490, 4, 84), op(-430, -270, 4, 84), op(-210, -50, 4, 84)];
  ext('y', 690, -690, 0, GT, 'pos', 0, gd, { sc: false });
  for (const g of gd) {
    for (let z = g.z0, k = 0; z < g.z1; z += 20, k++) {
      const zt = Math.min(g.z1, z + 20);
      box(693, g.a0, z, 697, g.a1, zt - 2, { color: [120, 74, 44] }, 'garage door');
      box(693, g.a0, zt - 2, 695, g.a1, zt, { color: [96, 58, 34] }, 'garage door groove');
      if (k === 3) for (let y = g.a0 + 8; y + 12 <= g.a1 - 4; y += 20) box(697, y, z + 6, 699, y + 12, z + 14, GLASS, 'garage door lite');
    }
    box(700, g.a0 - 4, g.z0, 704, g.a0, g.z1 + 4, { color: TRIM }, 'garage trim'); box(700, g.a1, g.z0, 704, g.a1 + 4, g.z1 + 4, { color: TRIM }, 'garage trim');
    box(700, g.a0, g.z1, 704, g.a1, g.z1 + 4, { color: TRIM }, 'garage trim');
    box(700, g.a0 + 70, g.z1 + 8, 706, g.a0 + 90, g.z1 + 20, GLOW([255, 226, 170], 3), 'garage lantern');
  }
  // service wing: its front behind the garage is outside only above the garage roof (tiny high windows clear it)
  const hiW = c => ARCH(c, 6, U + 62, U + 68);
  ext('x', 0, 300, 700, TOP, 'neg', GT, [D(350), ...[400, 520].map(hiW)], { caps: [true, false], sc: false });
  ext('x', 0, 700, 900, TOP, 'neg', 0, [...[760, 840].map(gw), ...[760, 840].map(uw)]);
  ext('y', 300, 10, 490, TOP, 'neg', 0, [...[100, 300, 420].map(gw), ...[120, 370].map(uw)]);
  ext('x', 490, 300, 900, TOP, 'pos', 0, [...[400, 580, 700, 820].map(gw), ...[400, 520, 700, 820].map(uw)], { caps: [true, false] });
  // centre block
  ext('x', 0, 900, 1700, TOPC, 'neg', 0, [...[970, 1070, 1190, 1410, 1530, 1630].map(gw), frontDoor, ...[970, 1070, 1190, 1410, 1530, 1630].map(cw)], { caps: [false, false] });
  const theaterW = c => ARCH(c, 10, U + 80, U + 92);      // over the loggia roof
  ext('x', 690, 900, 1700, TOPC, 'pos', 0, [gw(950), glazed(1200), logDoor, glazed(1400), gw(1646), cw(950), ...[1200, 1300, 1400].map(theaterW), cw(1646)], { caps: [false, false], sc: false });   // the loggia covers it
  ext('y', 900, 10, 500, TOPC, 'neg', TOP, [D(150), D(430), D(440, U)], { sc: false, cornice: false });
  ext('y', 900, 500, 690, TOPC, 'neg', 0, [gw(550), gw(640), cw(600)]);
  ext('y', 1690, 10, 500, TOPC, 'pos', TOP, [D(430), D(440, U)], { sc: false, cornice: false });
  ext('y', 1690, 500, 690, TOPC, 'pos', 0, [gw(550), gw(640), cw(600)]);
  // guest wing
  ext('x', 0, 1700, 2300, TOP, 'neg', 0, [...[1760, 1830, 1946, 2060, 2170, 2240].map(gw), ...[1780, 1880, 2000, 2120, 2220].map(uw)]);
  ext('x', 490, 1700, 2300, TOP, 'pos', 0, [...[1800, 1950, 2100, 2200].map(gw), ...[1800, 1950, 2100, 2200].map(uw)]);
  // pavilion
  ext('x', -200, 2300, 2600, TOPC, 'neg', 0, [...[2400, 2500].map(gw), ...[2376, 2520].map(cw)], { caps: [true, true] });
  ext('x', 690, 2300, 2600, TOPC, 'pos', 0, [2376, 2520].map(cw), { caps: [true, true] });
  ext('y', 2590, -190, 690, TOPC, 'pos', 0, [...[-100, 50, 200, 350, 570].map(gw), ...[-100, 100, 520, 620].map(cw)]);
  ext('y', 2300, -190, 0, TOPC, 'neg', 0, [gw(-100), cw(-100)]);
  ext('y', 2300, 0, 500, TOPC, 'neg', TOP, [D(460), D(150, U), D(460, U)], { sc: false, cornice: false });
  ext('y', 2300, 500, 690, TOPC, 'neg', 0, [cw(600)]);

  // portico: four columns, entablature, a coursed front gable with a stone pediment; steps, lanterns
  box(1210, -130, 0, 1390, 0, G, { color: STONE }, 'portico floor');
  box(1210, -150, 0, 1390, -130, 4, { color: STONE }, 'portico step');
  for (const x of [1220, 1250, 1330, 1360]) {
    box(x - 2, -122, G, x + 22, -98, G + 6, { color: STONE }, 'column base');
    box(x, -120, G + 6, x + 20, -100, 112, { color: TRIM }, 'portico column');
    box(x - 2, -122, 112, x + 22, -98, 120, { color: STONE }, 'column capital');
  }
  box(1210, -130, 120, 1390, 0, 136, { color: TRIM }, 'entablature');
  lay(courses(1290, 192, -1, 7, 8), -120, 0, -1, 'portico roof'); lay(courses(1310, 192, 1, 7, 8), -120, 0, 1, 'portico roof');
  box(1290, -120, 184, 1310, 0, 192, { color: shade(ROOF, 0.9) }, 'portico ridge'); box(1286, -120, 192, 1314, 0, 196, { color: shade(ROOF, 0.8) }, 'portico ridge cap');
  for (let j = 0; j < 7; j++) box(1220 + 10 * j, -130, 136 + 8 * j, 1380 - 10 * j, -120, 144 + 8 * j, { color: shade(STONE, j % 2 ? 0.97 : 1) }, 'pediment');
  for (const x of [1252, 1340]) box(x, -6, G + 48, x + 8, -2, G + 60, GLOW([255, 226, 170], 3), 'door lantern');
  box(1296, -60, 116, 1304, -52, 120, GLOW([255, 226, 170], 3), 'portico light');

  // loggia: an arcade of six round arches on the back line, an arch at each end, stone floor, tiled ceiling
  const bays = [0, 1, 2, 3, 4, 5].map(i => ARCH(1070 + 100 * i, 40, G, G + 56));
  stuccoRows('x', 880, 1000, 1600, 0, LT, bays.flatMap(b => b.ops), 10, 'arcade');
  for (const x of [1000, 1590]) stuccoRows('y', x, 700, 880, 0, LT, ARCH(790, 40, G, G + 56).ops, 10, 'arcade end');
  box(1000, 890, LT - 8, 1600, 892, LT, { color: TRIM }, 'arcade cornice');
  box(1010, 700, 0, 1590, 880, G, { color: STONE }, 'loggia floor');
  ceiling(1010, 700, 1590, 880, LT - 4, 'loggia ceiling');
  for (const b of bays) box(b.c - 4, 890, G + 92, b.c + 4, 892, G + 102, { color: STONE }, 'arcade keystone');

  // ------------------------------------------------------- partitions --
  // service wing
  pw('y', 500, 10, 490, [D(150), D(300)]);
  pw('x', 200, 310, 500, [D(400)]); pw('x', 200, 510, 900, [D(800)]);
  up('y', 600, 10, 490, [D(100, U), D(400, U)]); up('x', 250, 310, 600);
  // centre: the walls round the two-storey foyer run full height (no slot between the storeys)
  pw('y', 1140, 10, 400, [D(300), D(320, U)], G - 4, UCC); pw('y', 1450, 10, 400, [D(300), D(320, U)], G - 4, UCC);
  const foyerArch = op(1250, 1350, G, G + 80);
  pw('x', 400, 1140, 1460, [foyerArch, D(1284, U)], G - 4, UCC);
  pw('x', 400, 910, 1140, [D(1000)]); pw('x', 400, 1460, 1690, [D(1580)]);
  up('x', 400, 910, 1140, [D(1000, U)], UCC); up('x', 400, 1460, 1690, [D(1580, U)], UCC);
  pw('y', 1100, 410, 690, [D(600)]); pw('y', 1500, 410, 690, [D(600)]);
  up('y', 1100, 410, 690, [D(600, U)], UCC); up('y', 1500, 410, 690, [D(600, U)], UCC);
  // guest wing
  pw('y', 1880, 10, 390, [D(100), D(260)]); pw('x', 200, 1890, 2000); pw('y', 2000, 10, 390);
  pw('y', 2110, 10, 390, [D(100), D(260)]); pw('x', 200, 2010, 2110);
  pw('x', 390, 1700, 2300, [D(1750), D(2200)]);
  up('x', 330, 1700, 2300, [D(2000, U)]);
  // pavilion
  pw('x', 440, 2310, 2590, [D(2430)]);
  up('y', 2440, -190, 240, [D(100, U)], UCC); up('y', 2440, 250, 440, [], UCC); up('y', 2440, 450, 690, [D(560, U)], UCC);
  up('x', 240, 2310, 2590, [D(2360, U), D(2500, U)], UCC); up('x', 440, 2310, 2590, [], UCC);

  // ------------------------------------------------------------ rooms --
  // [name, rect, level, floor style, paper, wains?] ; level g = ground, u = wing upper, c = centre/pavilion upper
  const P = PAPERS;
  const ROOMS = [
    ['laundry', [310, 10, 500, 200], 'g', 'hall', P.white, WAINS[1]], ['staff room', [310, 210, 500, 490], 'g', 'kitchen', P.cream],
    ['pantry', [510, 10, 900, 200], 'g', 'kitchen', P.cream, WAINS[1]], ['kitchen', [510, 210, 900, 490], 'g', 'kitchen', P.cream, WAINS[1]],
    ['dining', [910, 10, 1140, 400], 'g', 'living', P.silk], ['study', [1460, 10, 1690, 400], 'g', 'living', P.panel, P.panel],
    ['family', [910, 410, 1100, 690], 'g', 'family', P.gold], ['living', [1110, 410, 1500, 690], 'g', 'living', P.cream],
    ['music hall', [1510, 410, 1690, 690], 'g', 'living', P.sage],
    ['guest suite 1', [1700, 10, 1880, 390], 'g', 'bedroom', P.gold], ['guest bath 1', [1890, 10, 2000, 200], 'g', 'bathroom', P.white, WAINS[1]],
    ['guest closet 1', [1890, 210, 2000, 390], 'g', 'hall', P.cream], ['guest bath 2', [2010, 10, 2110, 200], 'g', 'bathroom', P.white, WAINS[1]],
    ['guest closet 2', [2010, 210, 2110, 390], 'g', 'hall', P.cream], ['guest suite 2', [2120, 10, 2300, 390], 'g', 'bedroom', P.sage],
    ['guest hall', [1700, 400, 2300, 490], 'g', 'hall', P.cream], ['gym', [2310, -190, 2590, 440], 'g', 'hall', P.white, WAINS[1]],
    ['wine room', [2310, 450, 2590, 690], 'g', 'hall', P.terra, P.panel],
    ['staff bedroom', [310, 10, 600, 250], 'u', 'bedroom', P.cream], ['guest suite 4', [310, 260, 600, 490], 'u', 'bedroom', P.sage],
    ['guest suite 3', [610, 10, 900, 490], 'u', 'bedroom', P.gold],
    ['bedroom 5', [910, 10, 1140, 400], 'c', 'bedroom', P.sage], ['bedroom 6', [1460, 10, 1690, 400], 'c', 'bedroom', P.gold],
    ['gallery', [1150, 290, 1450, 400], 'c', 'hall', P.cream], ['bar lounge', [910, 410, 1100, 690], 'c', 'living', P.panel, P.panel],
    ['theater', [1110, 410, 1500, 690], 'c', 'family', P.red, P.panel], ['game room', [1510, 410, 1690, 690], 'c', 'living', P.silk],
    ['primary bedroom', [1700, 10, 2300, 330], 'u', 'bedroom', P.gold], ['sitting room', [1700, 340, 2300, 490], 'u', 'living', P.silk],
    ['primary bath A', [2310, -190, 2440, 240], 'c', 'bathroom', P.cream, WAINS[1]], ['primary bath B', [2450, -190, 2590, 240], 'c', 'bathroom', P.cream, WAINS[1]],
    ['closet A', [2310, 250, 2440, 440], 'c', 'hall', P.white], ['closet B', [2450, 250, 2590, 440], 'c', 'hall', P.white],
    ['massage room', [2310, 450, 2440, 690], 'c', 'bathroom', P.sage], ['salon', [2450, 450, 2590, 690], 'c', 'bathroom', P.terra],
  ];
  const LEVEL = { g: [G, GC], u: [U, UC], c: [U, UCC] };
  const SKIP = {
    kitchen: { y0: [[510, 790]] }, living: { x0: [[496, 604]] }, 'primary bedroom': { x0: [[116, 224]] },
  };
  for (const [name, [x0, y0, x1, y1], lv, fl, paper, wains] of ROOMS) {
    const [z0, z1] = LEVEL[lv];
    floor(fl, [x0, y0, x1, y1], z0, name);
    ceiling(x0, y0, x1, y1, z1);
    finishRoom({ x0, y0, x1, y1, z0, z1 }, { paper, wains, skip: SKIP[name] });
  }
  // foyer: floor, the void up to the centre ceiling, a ceiling under the gallery; trim round the flights' walls skipped
  floor('hall', [1150, 10, 1450, 400], G, 'foyer');
  ceiling(1150, 10, 1450, 290, UCC, 'foyer ceiling'); ceiling(1150, 290, 1450, 400, GC, 'under gallery');
  finishRoom({ x0: 1150, y0: 10, x1: 1450, y1: 400, z0: G, z1: GC }, { paper: P.cream, skip: { x0: [[124, 400]], x1: [[124, 400]] } });
  finishRoom({ x0: 1150, y0: 10, x1: 1450, y1: 290, z0: U, z1: UCC }, { paper: P.cream });
  box(1290, 190, UCC - 30, 1310, 210, UCC - 22, GLOW([255, 226, 170], 3), 'chandelier');
  box(1298, 198, UCC - 22, 1302, 202, UCC, { color: [180, 150, 70], material: 'BMC_Metallic' }, 'chandelier chain');
  // garage
  floor('garage', [310, -690, 690, 0], 4, 'garage'); ceiling(310, -690, 690, 0, GT - 4, 'garage ceiling');

  // ------------------------------------------------------------ stairs --
  // twin flights up the foyer's side walls (p04's sweeping pair, squared): 13 treads of 8 on 12 from y 134 to the
  // gallery at y 290; 3x3 landing at the foot (y 10..134), the gallery at the top. Wedge handrails (tavistock band)
  const TREAD = [230, 222, 206], RAILC = [40, 30, 26];
  for (const [fx0, fx1, rx] of [[1150, 1200, 1196], [1400, 1450, 1400]]) {
    for (let k = 1; k <= 13; k++) {
      const y = 134 + 12 * (k - 1), top = G + 8 * k;
      box(fx0, y, top - 8, fx1, y + 12, top, { color: shade(TREAD, k % 2 ? 1 : 0.95) }, 'stair tread');
      box(rx, y, top, rx + 4, y + 2, top + 28, { color: RAILC, material: 'BMC_Metallic' }, 'baluster');
      wedge(rx, y, top + 28, rx + 4, y + 12, top + 36, [[0, -1]], RAILC, 'handrail', -1);
      wedge(rx, y, top + 36, rx + 4, y + 12, top + 44, [[0, 1]], RAILC, 'handrail');
    }
  }
  for (let x = 1206; x < 1396; x += 12) box(x, 290, U, x + 2, 292, U + 32, { color: RAILC, material: 'BMC_Metallic' }, 'gallery baluster');
  box(1200, 288, U + 32, 1400, 294, U + 36, { color: RAILC }, 'gallery rail');

  // ------------------------------------------------------- furnishings --
  // stone fireplaces (living, primary bedroom), the kitchen's counter run + island (p12)
  const fireplace = (x0, y0, x1, y1, z, top, label) => {
    box(x0, y0, z, x1, y1, z + 6, { color: shade(STONE, 0.92) }, label + ' hearth');
    box(x0, y0, z + 6, x1, y0 + 10, z + 34, { color: STONE }, label + ' jamb'); box(x0, y1 - 10, z + 6, x1, y1, z + 34, { color: STONE }, label + ' jamb');
    box(x0, y0 + 10, z + 6, x1 - 4, y1 - 10, z + 34, { color: [30, 28, 28] }, label + ' firebox');
    box(x1 - 4, y0 + 12, z + 6, x1, y1 - 12, z + 8, GLOW([255, 120, 40], 3), label + ' embers');
    box(x0, y0, z + 34, x1, y1, z + 40, { color: shade(STONE, 1.04) }, label + ' lintel');
    box(x1, y0 - 4, z + 36, x1 + 4, y1 + 4, z + 40, { color: TRIM }, label + ' mantel');
    box(x0, y0 + 10, z + 40, x1 - 4, y1 - 10, top, { color: shade(STONE, 0.98) }, label + ' overmantel');
  };
  fireplace(1110, 500, 1124, 600, G, GC, 'living fireplace');
  fireplace(1700, 120, 1714, 220, U, UC, 'primary fireplace');
  const CAB = { color: [96, 50, 30] }, GRAN = { color: [190, 172, 140] };
  box(520, 210, G, 780, 226, G + 28, CAB, 'base cabinets'); box(520, 210, G + 28, 780, 228, G + 32, GRAN, 'counter');
  box(620, 320, G, 780, 370, G + 28, CAB, 'island'); box(616, 316, G + 28, 784, 374, G + 32, GRAN, 'island top');

  // ------------------------------------------------------------ the lot --
  // motor court (pavers, 20-grid round holes) with a fountain; back terrace with the lap pool and red umbrellas
  function pave(x0, y0, x1, y1, holes, color = PAVE) {
    const inHole = (a, b, c, d) => holes.some(([h0, h1, h2, h3]) => a < h2 && c > h0 && b < h3 && d > h1);
    for (let x = x0; x < x1; x += 100) for (let y = y0; y < y1; y += 100) {
      const q = [x, y, Math.min(x1, x + 100), Math.min(y1, y + 100)];
      if (!inHole(...q)) { box(q[0], q[1], 0, q[2], q[3], 4, { color: shade(color, 0.94 + 0.1 * hash(x, y)) }, 'paving'); continue; }
      for (let a = q[0]; a < q[2]; a += 20) for (let b = q[1]; b < q[3]; b += 20) if (!inHole(a, b, a + 20, b + 20)) box(a, b, 0, a + 20, b + 20, 4, { color: shade(color, 0.94 + 0.1 * hash(x, y)) }, 'paving');
    }
  }
  const FOUNT = [1220, -560, 1380, -400];
  pave(700, -800, 2300, -160, [FOUNT]);
  for (const [a, b, c, d] of [[1220, -560, 1380, -540], [1220, -420, 1380, -400], [1220, -540, 1240, -420], [1360, -540, 1380, -420]]) box(a, b, 0, c, d, 20, { color: STONE }, 'fountain basin');
  // shortcut: pool + fountain water is collision-off blue glass, not a real water zone (town.mjs WATER_ZONE_TOWN); swap in the zone if the owner wants swimming
  const WATER = { color: [60, 140, 190], material: 'BMC_Glass', collision: NOCOL };
  for (const [a, b, c, d] of [[1240, -540, 1360, -490], [1240, -470, 1360, -420], [1240, -490, 1290, -470], [1310, -490, 1360, -470]]) box(a, b, 0, c, d, 14, WATER, 'fountain water');
  box(1290, -490, 0, 1310, -470, 50, { color: STONE }, 'fountain pedestal');
  box(1276, -504, 50, 1324, -456, 56, { color: STONE }, 'fountain bowl');
  box(1296, -484, 56, 1304, -476, 76, GLOW([200, 230, 255], 2), 'fountain jet');
  const POOL = [1000, 1100, 1600, 1300];
  pave(800, 890, 1800, 1500, [[980, 1080, 1620, 1320]], STONE);
  for (const [a, b, c, d] of [[980, 1080, 1620, 1100], [980, 1300, 1620, 1320], [980, 1100, 1000, 1300], [1600, 1100, 1620, 1300]]) box(a, b, 0, c, d, 8, { color: shade(STONE, 1.04) }, 'pool coping');
  box(...POOL.slice(0, 2), 0, ...POOL.slice(2), 4, { asset: TILE, color: [40, 110, 150] }, 'pool floor');
  box(POOL[0], POOL[1], 4, POOL[2], POOL[3], 8, WATER, 'pool water');
  for (const [x, y] of [[880, 1000], [1720, 1000], [880, 1400], [1720, 1400]]) {
    box(x - 2, y - 2, 4, x + 2, y + 2, 64, { color: [60, 50, 40] }, 'umbrella pole');
    box(x - 30, y - 30, 64, x + 30, y + 30, 68, { color: [190, 30, 34] }, 'umbrella'); box(x - 20, y - 20, 68, x + 20, y + 20, 72, { color: [170, 26, 30] }, 'umbrella');
  }

  // ----------------------------------------------------------- fixtures --
  // tavistock_fixtures.mjs --house chateaureve: a lamp per ~25 studs of the room's long side, the switch on the first
  // wall face with a clear 15 either side of it (no openings: on a casing the switch is rejected), every hinged door
  function switchFor(R) {
    for (const side of ['y0', 'x0', 'y1', 'x1']) {
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ws = faceWall(side, R), ops = ws.flatMap(w => w.openings);
      for (let a = lo + 20; a <= hi - 20; a += 5) {
        if (!ws.some(w => w.a0 <= a - 10 && w.a1 >= a + 10 && w.z0 <= R.z0 && w.z1 >= R.z0 + 50)) continue;
        if (ops.some(o => o.a0 - 15 < a + 5 && o.a1 + 15 > a - 5)) continue;
        const n = { y0: '+y', y1: '-y', x0: '+x', x1: '-x' }[side];
        return axis === 'x' ? [a, R[side], n, R.z0] : [R[side], a, n, R.z0];
      }
    }
    throw new Error(`chateaureve: no switch spot in ${R.name}`);
  }
  const lampsFor = ([x0, y0, x1, y1]) => {
    const alongX = x1 - x0 >= y1 - y0, len = alongX ? x1 - x0 : y1 - y0, n = Math.ceil(len / 250);
    return Array.from({ length: n }, (_, i) => alongX ? [Math.round(x0 + len * (i + 0.5) / n), Math.round((y0 + y1) / 2)] : [Math.round((x0 + x1) / 2), Math.round(y0 + len * (i + 0.5) / n)]);
  };
  const FIX = ROOMS.map(([name, [x0, y0, x1, y1], lv]) => {
    const [z0, z1] = LEVEL[lv];
    return { name, lamps: lampsFor([x0, y0, x1, y1]), c: z1, sw: switchFor({ name, x0, y0, x1, y1, z0, z1 }) };
  });
  FIX.push({ name: 'foyer', lamps: [[1300, 100, UCC], [1300, 345, GC]], c: GC, sw: switchFor({ name: 'foyer', x0: 1150, y0: 10, x1: 1450, y1: 400, z0: G, z1: GC }) });
  FIX.push({ name: 'garage', lamps: lampsFor([310, -690, 690, 0]), c: GT - 4, sw: switchFor({ name: 'garage', x0: 310, y0: -690, x1: 690, y1: 0, z0: 4, z1: GT - 4 }) });
  FIX.push({ name: 'loggia', lamps: lampsFor([1010, 700, 1590, 880]), c: LT - 4, sw: switchFor({ name: 'loggia', x0: 1010, y0: 700, x1: 1590, y1: 880, z0: G, z1: LT - 4 }) });

  // ------------------------------------------------------------- output --
  // mirror into the left-handed world (plan x -> TOTAL - x)
  const TOTAL = 2600;
  const bricks = B.bricks.map(({ label, _m, _tri, ...b }) => {
    const nb = { ...b, position: [TOTAL - b.position[0], b.position[1], b.position[2]] };
    if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] };
    return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext, _m.zSign) } : nb;
  });
  const PW = (x, y, z) => [TOTAL - x, y, z];
  const N = n => ({ '+x': [-1, 0], '-x': [1, 0], '+y': [0, 1], '-y': [0, -1] })[n];
  const fixtures = {
    rooms: FIX.map(q => ({ name: q.name, lamps: q.lamps.map(([x, y, c = q.c]) => ({ at: PW(x, y, c) })), switch: { at: PW(q.sw[0], q.sw[1], q.sw[3]), normal: N(q.sw[2]) } })),
    doors: DOORS.map(d => {
      const at = (a, t, z) => d.axis === 'x' ? PW(a, d.line + t, z) : PW(d.line + t, a, z);
      return { name: `door ${d.axis}${d.line} ${d.a0}`, z0: d.z0, z1: d.z0 + DOOR, a0: at(d.a0, 5, d.z0), a1: at(d.a1, 5, d.z0), color: d.line === 0 && d.a0 >= 1270 && d.a0 <= 1300 ? [90, 50, 30] : undefined };
    }),
  };
  const lot = [TOTAL - 2620 - 100, -800 - 100, TOTAL - 280 + 100, 1500 + 100];
  return { bricks, fixtures, lot, count: bricks.length };
}

if (process.argv[1]?.endsWith('chateaureve.mjs')) {
  const out = process.argv[2] ?? 'chateaureve.json', h = chateaureve();
  fs.writeFileSync(out, JSON.stringify({ bricks: h.bricks }));
  console.error(`chateaureve: ${h.count} bricks, ${h.fixtures.rooms.length} rooms, ${h.fixtures.doors.length} doors, lot (output frame) ${h.lot.join(',')}`);
}
