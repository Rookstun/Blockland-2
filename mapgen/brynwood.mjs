// 4453 Brynwood Dr, Naples FL 34119 (Quail West), rebuilt 2026-11-01 on the White Tail / Tavistock template (owner:
// "white tail is the best one, why are so many elements so terribly formed in brynwood. there are millions of
// microbricks for no purpose" -> "Rebuild it"). The first build (brynwood_raster.mjs) meshed a 2-unit raster of the
// cm plan: walls off the stud grid came out as 2-wide slivers, floors as one brick per pattern tile, roofs as rings.
// Here the plan (refs/brynwood_bp.json, the listing's 3D-tour blueprint, same frames) is snapped to the 1 ft stud
// grid (10 units) and laid with the template's pieces:
//   walls  straight runs -> wall(): one plaster core, a coursed stucco skin on the outside faces, framed windows with
//          sills + keystone lintels, room trim bands (finishRoom). 45 degree walls (and the turrets' octagons) ->
//          one box per stud step plus a micro wedge in each notch, so both faces read as flat diagonals.
//   floors tilefloors.mjs per room rectangle, ceilings face-down tiles, one slab per storey.
//   roofs  coursed like White Tail's (4-high lip + micro wedge per stud, white eave lip) from a distance field over
//          each storey's roofed cells, hips as corner wedges, low decks capped flat.
//   fixtures lamps / switches / doors for tavistock_fixtures.mjs --house brynwood.
// Built straight in world coordinates (the plan's x is mirrored by T for the left-handed world).
//   brynwood() -> { bricks, fixtures, lot, count }      node mapgen/brynwood.mjs [job.json] [--at X,Y]
import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { piece as furnPiece, footprint, facing, placeFurniture } from './rusfurniture.mjs';

let BP = JSON.parse(fs.readFileSync(new URL('./refs/brynwood_bp.json', import.meta.url)));
const K = 0.32808;                                   // units per cm
const T = (x, y, off) => [-(x + off[0]) * K, (y + off[1]) * K];
let FLOORS = { F1: { name: 'Floor 1', off: [0, 0] }, A: { name: 'Floor 2 A', off: [734, -450] }, B: { name: 'Separate Entry Floor 2 B', off: [-1730, -590] } };

// stud grid: cell (i, j) = [X0 + 10 i, +10] x [Y0 + 10 j, +10]
const C = 10;
let X0 = -900, Y0 = -700, NI = 180, NJ = 140, NC = NI * NJ;
const ci = x => Math.floor((x - X0) / C), cj = y => Math.floor((y - Y0) / C);
const xOf = i => X0 + i * C, yOf = j => Y0 + j * C;
const inG = (i, j) => i >= 0 && j >= 0 && i < NI && j < NJ;

// z: pad 0..36 | F1 floor 36..40, walls ..170 | slab 170..176, F2 floor ..180 | F2 walls ..290 | roofs from 180 / 290
let FL1 = 40, TOP1 = 170, FL2 = 180, TOP2 = 290;
const PER = 8, NMAX = 12;
const DOOR = 62, SILL = 26;
let HEAD = 96;
const GLASS = { color: [176, 212, 228], material: 'BMC_Glass' };
const GLOW = (color, i = 3) => ({ color, material: 'BMC_Glow', material_intensity: i });
const PLASTER = [228, 222, 210], WHITE = [244, 240, 232], STUCCO = [238, 226, 204], STONE = [214, 202, 180], IRON = [58, 44, 36];
const ROOF = [184, 92, 58], PAD = [222, 208, 184], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const PAPERS = [[236, 226, 206], [226, 214, 190], [214, 200, 172], [200, 210, 196], [222, 210, 196], [240, 236, 228]].map(color => ({ kind: 'paint', color }));
const WAINS = [{ kind: 'paint', color: [246, 242, 234] }, { kind: 'paint', color: [236, 230, 218] }];

function pip(P, x, y) {
  let c = false;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const [xi, yi] = P[a], [xj, yj] = P[b];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const pts = (a, off) => { const P = []; for (let k = 0; k < a.length; k += 2) P.push(T(a[k], a[k + 1], off)); return P; };

// ------------------------------------------------------------------ plan on the stud grid --
// fp: footprint, room: room index per cell, wall: 1 = wall cell, rail: thin (rail) walls, segs: snapped wall segments
// with their openings
export function plan(key) {
  const fd = FLOORS[key], f = BP.find(q => q.n === fd.name), off = fd.off;
  const fp = new Uint8Array(NC), room = new Int16Array(NC).fill(-1), wall = new Uint8Array(NC), rail = new Uint8Array(NC);
  const fpP = pts(f.fp, off);
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) if (pip(fpP, xOf(i) + 5, yOf(j) + 5)) fp[j * NI + i] = 1;
  const rooms = f.r.map(([id, type, , poly], n) => {
    const P = pts(poly, off), notes = f.t.filter(t => t[0] === id).map(t => t[1]);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    for (let j = Math.max(0, cj(Math.min(...ys))); j <= Math.min(NJ - 1, cj(Math.max(...ys))); j++)
      for (let i = Math.max(0, ci(Math.min(...xs))); i <= Math.min(NI - 1, ci(Math.max(...xs))); i++) if (pip(P, xOf(i) + 5, yOf(j) + 5)) room[j * NI + i] = n;
    return { id, type, n, notes, name: notes[0] ?? type };
  });
  const segs = [];
  for (const [x0, y0, x1, y1, tc, ...ks] of f.w) {
    const A = T(x0, y0, off), B = T(x1, y1, off), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 3) continue;
    const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90;
    const kind = ang < 22.5 ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : ang > 67.5 ? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y') : 'd';
    const cells = [];
    if (kind === 'x') { const j = cj((A[1] + B[1]) / 2); for (let i = ci(Math.min(A[0], B[0]) + 1); i <= ci(Math.max(A[0], B[0]) - 1); i++) cells.push([i, j]); }
    else if (kind === 'y') { const i = ci((A[0] + B[0]) / 2); for (let j = cj(Math.min(A[1], B[1]) + 1); j <= cj(Math.max(A[1], B[1]) - 1); j++) cells.push([i, j]); }
    else {
      const ia = ci(A[0]), ja = cj(A[1]), n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy)) / C)), sx = Math.sign(dx), sy = Math.sign(dy);
      for (let s = 0; s <= n; s++) cells.push([ia + sx * s, ja + sy * s]);
    }
    const ops = ks.map(([t, ox, oy, wc]) => ({ t, c: T(ox, oy, off), w: wc * K }));
    const seg = { kind, cells: cells.filter(([i, j]) => inG(i, j)), ops, A, B, L, ux: dx / L, uy: dy / L, rail: tc < 6 };
    // screen-cage / fence lines out in the yard (no footprint within a stud) are not built
    const near = ([i, j]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inG(i + a, j + b) && fp[(j + b) * NI + i + a]);
    if (seg.cells.filter(near).length * 2 < seg.cells.length) continue;
    for (const [i, j] of seg.cells) (seg.rail ? rail : wall)[j * NI + i] = 1;
    segs.push(seg);
  }
  for (let k = 0; k < NC; k++) if (wall[k]) rail[k] = 0;
  return { key, fp, room, rooms, wall, rail, segs };
}

// another house on this template: house({ bp, floors, upper: [keys], grid: [X0, Y0, NI, NJ], z: [FL1, TOP1, FL2, TOP2],
// head, lanai: room id, stairs(P1, P2) -> [{ hole, build }] })
const BRYNWOOD = { bp: BP, floors: FLOORS, upper: ['A', 'B'], grid: [-900, -700, 180, 140], z: [40, 170, 180, 290], head: 96, lanai: '7eaf0', stairs: (P1, P2) => stairPlan(P1, P2) };
export const brynwood = ({ seed = 4453 } = {}) => house(BRYNWOOD, seed);

export function house(H, seed) {
  ({ bp: BP, floors: FLOORS } = H);
  [X0, Y0, NI, NJ] = H.grid; NC = NI * NJ;
  [FL1, TOP1, FL2, TOP2] = H.z; HEAD = H.head;
  const r = rng(seed);
  const B = makeBuilder({ cell: 40 });
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const hash = (a, b) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // trim / finish pieces may lose a corner to a diagonal wall's wedge; anything structural that drops is a bug
  const SOFT = /^(base|wains|rail|F[12] balustrade|F[12] balustrade cap|paper|crown|casing|casing head|stool|wall paper|wall wains|sill|lintel|keystone|doorstep|column|column capital)$/;
  const soft = {};
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return true;
    if (B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label)) return true;
    if (SOFT.test(label)) { soft[label] = (soft[label] ?? 0) + 1; return false; }
    throw new Error(`brynwood: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label, zSign = 1, asset = 'PB_DefaultMicroWedge') => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext, zSign), color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`brynwood: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  // an upright side wedge filling the triangle of cell [x0..x0+10]x[y0..y0+10] with its right angle at corner
  // (sx, sy) (-1 = low side, +1 = high side)
  const notch = (x0, y0, z0, z1, sx, sy, m, label) => {
    const rot = sx < 0 ? (sy < 0 ? 0 : 3) : (sy < 0 ? 1 : 2);
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, size: [5, 5, (z1 - z0) / 2], ...m, position: [x0 + 5, y0 + 5, (z0 + z1) / 2] }, label)) throw new Error(`brynwood: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('brynwood: floor triangle dropped ' + B.dropped.at(-1));
  };
  const ceiling = (x0, y0, x1, y1, z, label = 'ceiling') => box(x0, y0, z, x1, y1, z + 4, { asset: TILE, color: [242, 240, 234], direction: 5 }, label);
  const op = (a0, a1, z0, z1, extra) => ({ a0, a1, z0, z1, ...extra });

  // ------------------------------------------------------------ template walls (whitetail.mjs) --
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
  // stucco is smooth: one skin piece between openings (8-high courses read as siding and cost 15x the bricks)
  const stuccoRows = (axis, line, a0, a1, z0, z1, openings, t, label) => course(axis, line, a0, a1, z0, z1, openings, shade(STUCCO, 0.98 + 0.04 * hash(line, a0)), label, t);
  // a wall on [line, line + 10]: plaster core in one piece, a 4-deep stucco skin on each outside face (neg / pos =
  // the z it starts from, null = indoors)
  function wall(axis, line, a0, a1, z0, z1, { neg = null, pos = null, ops = [], label = 'wall' } = {}) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings: ops });
    if (neg == null && pos == null) return course(axis, line, a0, a1, z0, z1, ops, PLASTER, label);
    const c0 = line + (neg != null ? 4 : 0), c1 = line + 10 - (pos != null ? 4 : 0);
    course(axis, c0, a0, a1, z0, z1, ops, PLASTER, label + ' core', c1 - c0);
    for (const [from, t0] of [[neg, line], [pos, line + 6]]) {
      if (from == null) continue;
      if (from > z0) course(axis, t0, a0, a1, z0, Math.min(z1, from), ops, PLASTER, label + ' skin', 4);
      if (from < z1) stuccoRows(axis, t0, a0, a1, Math.max(z0, from), z1, ops, 4, label + ' stucco');
    }
  }
  // white frame in the outer half, meeting rail, glass, stone sill, a white lintel with a keystone
  function windowIn(axis, line, out, o, { mull = [] } = {}) {
    const W = { color: WHITE };
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    const f0 = out < 0 ? line : line + 4, f1 = f0 + 6;
    pb(o.a0, o.a1, o.z0, o.z0 + 2, W, 'window frame', f0, f1);
    pb(o.a0, o.a1, o.z1 - 2, o.z1, W, 'window frame', f0, f1);
    pb(o.a0, o.a0 + 2, o.z0 + 2, o.z1 - 2, W, 'window frame', f0, f1);
    pb(o.a1 - 2, o.a1, o.z0 + 2, o.z1 - 2, W, 'window frame', f0, f1);
    const mz = o.z0 + Math.round((o.z1 - o.z0) / 4) * 2;
    pb(o.a0 + 2, o.a1 - 2, mz - 2, mz, W, 'meeting rail', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, o.z0 + 2, mz - 2, GLASS, 'glass', line + 4, line + 6);
    pb(o.a0 + 2, o.a1 - 2, mz, o.z1 - 2, GLASS, 'glass', line + 4, line + 6);
    for (const m of mull) pb(m, m + 2, o.z0 + 2, o.z1 - 2, W, 'mullion', out < 0 ? line + 2 : line + 6, out < 0 ? line + 4 : line + 8);
    const p0 = out < 0 ? line - 2 : line + 10, p1 = p0 + 2;
    pb(o.a0 - 2, o.a1 + 2, o.z0 - 4, o.z0, { color: STONE }, 'sill', p0, p1);
    pb(o.a0 - 4, o.a1 + 4, o.z1, o.z1 + 6, W, 'lintel', p0, p1);
    const mid = Math.round((o.a0 + o.a1) / 4) * 2;
    pb(mid - 4, mid + 4, o.z1 - 2, o.z1 + 8, W, 'keystone', out < 0 ? p0 - 2 : p1, out < 0 ? p0 : p1 + 2);
  }
  // a glazed door (French doors / sliders onto the lanai): frames + glass leaves, the panes split every ~40
  function glassDoor(axis, line, o) {
    const pb = (a, b, z, zt, m, lab, t0, t1) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    const n = Math.max(2, Math.round((o.a1 - o.a0) / 40)), w = (o.a1 - o.a0) / n;
    const stiles = [o.a0, ...Array.from({ length: n - 1 }, (_, k) => Math.round((o.a0 + w * (k + 1)) / 2) * 2), o.a1 - 2];
    for (const s of stiles) pb(s, s + 2, o.z0, o.z1 - 2, { color: WHITE }, 'door frame', line + 2, line + 8);
    pb(o.a0, o.a1, o.z1 - 2, o.z1, { color: WHITE }, 'door frame', line + 2, line + 8);
    for (let k = 0; k < stiles.length - 1; k++) pb(stiles[k] + 2, stiles[k + 1], o.z0, o.z1 - 2, GLASS, 'door glass', line + 4, line + 6);
  }

  // --------------------------------------------- interior finishes (whitetail finishRoom) --
  const trimC = [246, 244, 238];
  // thin (strict, necks under 50 wide): every band 2 deep, so the room keeps its papering without eating the passage
  const bands = (z0, z1, thin) => [
    [z0, z0 + 6, 4, 'base'], [z0 + 6, z0 + 26, 2, 'wains'], [z0 + 26, z0 + 30, 4, 'rail'],
    [z0 + 30, z1 - 6, 2, 'paper'], [z1 - 6, z1 - 4, 4, 'crown'], [z1 - 4, z1, 6, 'crown'],
  ].map(([a, b, t, k]) => [a, b, thin ? 2 : t, k]).filter(([a, b], i, all) => !thin || i !== 4);
  function patterned(pat, a0, a1, z0, z1, put) {
    if (pat.kind === 'paint') return put(a0, a1, z0, z1, pat.color);
    const per = pat.cols.reduce((s, [w]) => s + w, 0);
    let a = Math.floor(a0 / per) * per, k = 0;
    while (a < a1) { const [w, c] = pat.cols[k % pat.cols.length]; const p = Math.max(a0, a), q = Math.min(a1, a + w); if (q > p) put(p, q, z0, z1, c); a += w; k++; }
  }
  const SIDES = { y0: ['x', 1], y1: ['x', -1], x0: ['y', 1], x1: ['y', -1] };
  function faceWall(side, R) {
    const [axis] = SIDES[side], f = R[side];
    const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
    return WALLS.filter(w => w.axis === axis && (side.endsWith('0') ? w.line + 10 === f : w.line === f) && w.a0 < hi && w.a1 > lo && w.z0 < R.z1 && w.z1 > R.z0);
  }
  function facePiece(side, R, a, b, z, zt, t, color, label) {
    const [axis, d] = SIDES[side], f = R[side];
    const [c0, c1] = d > 0 ? [f, f + t] : [f - t, f];
    if (axis === 'x') box(a, c0, z, b, c1, zt, { color }, label); else box(c0, a, z, c1, b, zt, { color }, label);
  }
  function finishRoom(R, { paper, wains = WAINS[0], thin = false } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0;
    const cutSpans = (sp, p0, p1) => sp.flatMap(([p, q]) => (p1 <= p || p0 >= q) ? [[p, q]] : [[p, p0], [p1, q]].filter(([u, v]) => v > u));
    for (const side of Object.keys(SIDES)) {
      if (!has[side]) continue;
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ws = faceWall(side, R);
      const ops = ws.flatMap(w => w.openings).filter(o => o.z0 < R.z1 && o.z1 > R.z0 && o.a0 < hi && o.a1 > lo);
      for (const [z0, z1, t, kind] of bands(R.z0, R.z1, thin)) {
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
        for (const [p, q, u, v] of [...spans.map(([p, q]) => [p, q, z0, z1]), ...parts]) {
          if (kind === 'paper' || kind === 'wains') patterned(kind === 'paper' ? paper : wains, p, q, u, v, (s0, s1, zz, zt, c) => facePiece(side, R, s0, s1, zz, zt, t, c, 'wall ' + kind));
          else facePiece(side, R, p, q, u, v, t, kind === 'crown' && t === 6 ? shade(trimC, 0.96) : trimC, kind);
        }
      }
      for (const o of ops) {
        if (o.a0 - 4 <= lo || o.a1 + 4 >= hi) continue;
        const door = o.z0 <= R.z0 + 2, jz0 = door ? R.z0 : o.z0, top = Math.min(R.z1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, thin ? 2 : 4, trimC, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, thin ? 2 : 4, trimC, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, thin ? 2 : 4, trimC, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 4, trimC, 'stool');
      }
    }
  }

  // greedy rectangles of a cell mask (rows first, then grown down while the run repeats)
  function rects(mask, keyOf = k => mask[k]) {
    const used = new Uint8Array(NC), out = [];
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = j * NI + i, v = keyOf(k);
      if (!v || used[k]) continue;
      let i1 = i;
      while (i1 + 1 < NI && !used[k + i1 + 1 - i] && keyOf(j * NI + i1 + 1) === v) i1++;
      let j1 = j;
      grow: while (j1 + 1 < NJ) {
        for (let q = i; q <= i1; q++) { const kk = (j1 + 1) * NI + q; if (used[kk] || keyOf(kk) !== v) break grow; }
        j1++;
      }
      for (let jj = j; jj <= j1; jj++) for (let q = i; q <= i1; q++) used[jj * NI + q] = 1;
      out.push({ v, x0: xOf(i), y0: yOf(j), x1: xOf(i1 + 1), y1: yOf(j1 + 1) });
    }
    return out;
  }

  // ------------------------------------------------------------------ plans --
  const P1 = plan('F1');
  // the two upper plans share one storey
  const P2 = { fp: new Uint8Array(NC), room: new Int16Array(NC).fill(-1), rooms: [], wall: new Uint8Array(NC), rail: new Uint8Array(NC), segs: [] };
  for (const Q of H.upper.map(plan)) {
    const base = P2.rooms.length;
    P2.rooms.push(...Q.rooms.map(q => ({ ...q, n: q.n + base, wing: Q.key })));
    for (let k = 0; k < NC; k++) {
      if (Q.fp[k]) P2.fp[k] = 1;
      if (Q.room[k] >= 0 && P2.room[k] < 0) P2.room[k] = Q.room[k] + base;
      if (Q.wall[k]) P2.wall[k] = 1;
      if (Q.rail[k]) P2.rail[k] = 1;
    }
    P2.segs.push(...Q.segs);
  }
  for (let k = 0; k < NC; k++) if (P2.wall[k]) P2.rail[k] = 0;
  // strict: a 30 x 20 clear patch each side of every door (wall stubs / necks narrower than the 30-wide door go)
  if (H.strict) for (const P of [P1, P2]) for (const s of P.segs) if (s.kind !== 'd' && !s.rail) for (const o of s.ops) {
    if (o.t === 'w') continue;
    const [cx, cy] = o.c, j0 = cj(cy), i0 = ci(cx);
    for (let n = -2; n <= 2; n++) for (let a = -15; a <= 15; a += 5) {
      if (!n) continue;
      const k = s.kind === 'x' ? (j0 + n) * NI + ci(cx + a) : cj(cy + a) * NI + i0 + n;
      if (k >= 0 && k < NC && P.fp[k]) P.wall[k] = 0;
    }
  }
  const kindAt = (P, k) => (P.room[k] >= 0 ? P.rooms[P.room[k]].type : null);
  const indoor = (P, k) => P.fp[k] && !['outdoor'].includes(kindAt(P, k));

  // lanai (the F1 outdoor room round the pool), open sky = lanai cells 8+ studs from the house, pool 2+ inside it
  const lanaiN = P1.rooms.find(q => q.id === H.lanai)?.n;
  const bfs = (seed, diag = true) => {
    const d = new Int16Array(NC).fill(9999), q = [];
    for (let k = 0; k < NC; k++) if (seed[k]) { d[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % NI, j = (k - i) / NI;
      for (const [di, dj] of diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (!inG(a, b)) continue;
        const kk = b * NI + a;
        if (d[kk] > d[k] + 1) { d[kk] = d[k] + 1; q.push(kk); }
      }
    }
    return d;
  };
  const lanai = new Uint8Array(NC), house = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) if (P1.fp[k]) { if (P1.room[k] === lanaiN) lanai[k] = 1; else if (kindAt(P1, k) !== 'outdoor') house[k] = 1; }
  const dHouse = bfs(house), sky = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) if (lanai[k] && dHouse[k] >= 8 && !P2.fp[k] && !P1.wall[k]) sky[k] = 1;
  const dSky = bfs(sky.map(v => v ? 0 : 1)), pool = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) if (sky[k] && dSky[k] >= 3) pool[k] = 1;

  // ---------------------------------------------------------- walls from the snapped plan --
  // each wall cell joins its longer straight run (rows vs columns); cells in no run of 2+ are steps of a diagonal
  function buildWalls(P, fl, top, tag) {
    const z0 = fl - 4, W = P.wall;
    const hl = new Int16Array(NC), vl = new Int16Array(NC);
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI;) { if (!W[j * NI + i]) { i++; continue; } let e = i; while (e < NI && W[j * NI + e]) e++; for (let q = i; q < e; q++) hl[j * NI + q] = e - i; i = e; }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ;) { if (!W[j * NI + i]) { j++; continue; } let e = j; while (e < NJ && W[e * NI + i]) e++; for (let q = j; q < e; q++) vl[q * NI + i] = e - j; j = e; }
    const as = new Uint8Array(NC);           // 1 = x run, 2 = y run, 3 = single (diagonal step)
    for (let k = 0; k < NC; k++) if (W[k]) as[k] = hl[k] >= vl[k] && hl[k] >= 2 ? 1 : vl[k] >= 2 ? 2 : 3;
    const out = (k) => !inG(k % NI, Math.floor(k / NI)) || !P.fp[k] || kindAt(P, k) === 'outdoor' || (P === P1 && sky[k]);
    // openings of a segment along a run axis: [a0, a1] on 2s, the z band per type
    const opsFor = (axis, line, a0, a1, cells) => {
      const res = [];
      for (const s of P.segs) {
        if (s.kind !== axis || s.rail) continue;
        if (!s.cells.some(([i, j]) => cells.has(j * NI + i))) continue;
        for (const o of s.ops) {
          const c = axis === 'x' ? o.c[0] : o.c[1];
          let p = Math.round((c - o.w / 2) / 2) * 2, q = Math.round((c + o.w / 2) / 2) * 2;
          const k = axis === 'x' ? cj(o.c[1]) * NI + ci(c) : ci(o.c[0]) + cj(c) * NI;
          const sides = axis === 'x' ? [k - NI, k + NI] : [k - 1, k + 1];
          const outside = sides.filter(out).length;
          const garage = sides.some(kk => kindAt(P, kk) === 'garage');
          // upstairs, an opening onto a lower roof would sit behind its courses (whitetail trap): none there
          if (P === P2 && sides.some(kk => out(kk) && !P2.fp[kk] && P1.fp[kk] && !sky[kk])) continue;
          // (checked along the whole opening plus its trim, and the lower roof's eave stud beside it)
          const lowRoof = kk => out(kk) && !P2.fp[kk] && !sky[kk] && [0, 1, -1, NI, -NI].some(d => P1.fp[kk + d] && !P2.fp[kk + d]);
          if (P === P2 && H.strict && [...Array(Math.ceil((q - p + 12) / 10) + 1).keys()].some(n => {
            const a = Math.min(p - 6 + 10 * n, q + 6), kk = axis === 'x' ? cj(o.c[1]) * NI + ci(a) : ci(o.c[0]) + cj(a) * NI;
            return (axis === 'x' ? [kk - NI, kk + NI] : [kk - 1, kk + 1]).some(lowRoof);
          })) continue;
          let t = o.t === 'w' ? 'w' : garage && o.w >= 66 ? 'g' : outside === 1 && o.w > 40 ? 'gd' : 'd';
          if (t === 'd') { const m = Math.round(c / 2) * 2; p = m - 16; q = m + 14; }     // leaf doors: 30 wide (fixture panel)
          // strict: a leaf door is never trimmed under the 30-wide panel, it slides along its run instead (or is skipped)
          if (H.strict && t === 'd') { p = Math.min(Math.max(a0 + 6, p), a1 - 36); q = p + 30; }
          p = Math.max(a0 + 6, p); q = Math.min(a1 - 6, q);
          if (q - p < (H.strict && t === 'd' ? 30 : 14) || res.some(e => e.a0 < q + 4 && e.a1 > p - 4)) continue;
          const z = t === 'w' ? [fl + SILL, fl + HEAD] : t === 'g' ? [fl, fl + 84] : t === 'gd' ? [fl, fl + 84] : [fl, fl + DOOR];
          res.push(op(p, q, z[0], z[1], { t, outside: outside === 1 }));
        }
      }
      return res;
    };
    const runs = [];
    for (const [axis, code] of [['x', 1], ['y', 2]]) {
      const seen = new Uint8Array(NC);
      for (let k = 0; k < NC; k++) {
        if (as[k] !== code || seen[k]) continue;
        const i = k % NI, j = (k - i) / NI, cells = new Set();
        let e = axis === 'x' ? i : j;
        while (true) { const kk = axis === 'x' ? j * NI + e : e * NI + i; if (!inG(axis === 'x' ? e : i, axis === 'x' ? j : e) || as[kk] !== code) break; seen[kk] = 1; cells.add(kk); e++; }
        const line = axis === 'x' ? yOf(j) : xOf(i), a0 = axis === 'x' ? xOf(i) : yOf(j), a1 = axis === 'x' ? xOf(e) : yOf(e);
        let nOut = 0, pOut = 0;
        for (const kk of cells) { if (out(axis === 'x' ? kk - NI : kk - 1)) nOut++; if (out(axis === 'x' ? kk + NI : kk + 1)) pOut++; }
        runs.push({ axis, line, a0, a1, cells, neg: nOut * 2 > cells.size, pos: pOut * 2 > cells.size });
      }
    }
    const doors = [];
    for (const R of runs) {
      const ops = opsFor(R.axis, R.line, R.a0, R.a1, R.cells);
      wall(R.axis, R.line, R.a0, R.a1, z0, top, { neg: R.neg ? z0 : null, pos: R.pos ? z0 : null, ops, label: tag + ' wall' });
      R.ops = ops;
    }
    // window / door dressing after every wall core is in (a sill or lintel may stand into a neighbour's skin: dropped)
    const dress = () => { for (const R of runs) for (const o of R.ops) {
        if (o.t === 'w') { if (R.neg || R.pos) windowIn(R.axis, R.line, R.neg ? -1 : 1, o, { mull: o.a1 - o.a0 > 50 ? [Math.round((o.a0 + o.a1) / 4) * 2 - 1] : [] }); else glassDoor(R.axis, R.line, o); }
        else if (o.t === 'gd') glassDoor(R.axis, R.line, o);
        else if (o.t === 'g') garageDoor(R.axis, R.line, R.neg ? -1 : 1, o);
        else doors.push({ axis: R.axis, line: R.line, a0: o.a0, a1: o.a1, z0: o.z0, outside: R.neg || R.pos });
    } };
    // diagonal steps: one box per cell (windows / doors cut by z), a wedge in each free notch so both faces are flat
    const dOp = new Map();
    for (const s of P.segs) if (s.kind === 'd' && !s.rail) for (const o of s.ops) for (const [i, j] of s.cells) {
      const u = (xOf(i) + 5 - s.A[0]) * s.ux + (yOf(j) + 5 - s.A[1]) * s.uy, uc = (o.c[0] - s.A[0]) * s.ux + (o.c[1] - s.A[1]) * s.uy;
      if (Math.abs(u - uc) < (H.strict && o.t !== 'w' ? Math.max(o.w / 2, 24) : o.w / 2)) dOp.set(j * NI + i, o.t);   // strict: diagonal doors 48+ along the wall
    }
    const bandsOf = k => { const t = dOp.get(k); return t === 'w' ? [[z0, fl + SILL, 0], [fl + SILL, fl + HEAD, 1], [fl + HEAD, top, 0]] : t === 'd' ? [[fl + 84, top, 0]] : [[z0, top, 0]]; };
    const taken = new Set();
    for (let k = 0; k < NC; k++) {
      if (as[k] !== 3) continue;
      const i = k % NI, j = (k - i) / NI, ext = out(k + 1) || out(k - 1) || out(k + NI) || out(k - NI);
      for (const [a, b, g] of bandsOf(k)) box(xOf(i), yOf(j), a, xOf(i) + 10, yOf(j) + 10, b, g ? GLASS : { color: ext ? STUCCO : PLASTER }, tag + ' diagonal');
    }
    for (let k = 0; k < NC; k++) {
      if (!W[k]) continue;
      const i = k % NI, j = (k - i) / NI;
      for (const [di, dj] of [[1, 1], [1, -1]]) {
        if (!inG(i + di, j + dj)) continue;
        const k2 = (j + dj) * NI + i + di;
        if (!W[k2] || W[j * NI + i + di] || W[(j + dj) * NI + i]) continue;
        if (as[k] !== 3 && as[k2] !== 3 && (as[k] === as[k2])) continue;
        const bnd = (dOp.has(k) ? bandsOf(k) : dOp.has(k2) ? bandsOf(k2) : [[z0, top, 0]]).map(([a, b, g]) => [Math.max(a, fl), Math.min(b, top - 4), g]).filter(([a, b]) => b > a);
        // notch (i+di, j): its horizontal neighbour is k (side -di), vertical is k2 (side +dj); notch (i, j+dj) the reverse
        for (const [nk, ni, nj, sx, sy] of [[j * NI + i + di, i + di, j, -di, dj], [(j + dj) * NI + i, i, j + dj, di, -dj]]) {
          if (taken.has(nk) || P.rail[nk]) continue;
          taken.add(nk);
          const ext = out(nk);
          for (const [a, b, g] of bnd) notch(xOf(ni), yOf(nj), a, b, sx, sy, g ? GLASS : { color: ext ? STUCCO : PLASTER }, tag + ' notch');
        }
      }
    }
    dress();
    // rails (thin walls in the plan: gallery and balcony balustrades), white, merged runs
    // strict: ground-floor thin walls are porch / lanai edges, left open (steps up to them below)
    if (H.strict && P === P1) return { runs, doors, notches: taken };
    for (const R of rects(P.rail)) box(R.x0, R.y0, fl, R.x1, R.y1, fl + 34, { color: WHITE }, tag + ' balustrade');
    for (const R of rects(P.rail)) box(R.x0, R.y0, fl + 34, R.x1, R.y1, fl + 38, { color: STONE }, tag + ' balustrade cap');
    return { runs, doors, notches: taken };
  }
  function garageDoor(axis, line, out, g) {
    const t0 = out < 0 ? line : line + 8, pb = (a, b, z, zt, m, lab) => axis === 'x' ? box(a, t0, z, b, t0 + 2, zt, m, lab) : box(t0, a, z, t0 + 2, b, zt, m, lab);
    for (let z = g.z0; z < g.z1; z += 20) {
      const zt = Math.min(g.z1, z + 20);
      pb(g.a0, g.a1, z, zt - 2, { color: [232, 226, 212] }, 'garage door');
      pb(g.a0, g.a1, zt - 2, zt, { color: [206, 198, 182] }, 'garage door groove');
    }
  }

  // --------------------------------------------------------------- stairs (holes) --
  // STAIR = the grand stair, STAIR_B = the apartment's; filled in after the rooms (see stairs below)
  const stairCells = new Uint8Array(NC);
  const STAIRS = H.stairs(P1, P2, { cj, ci, NI });
  for (const s of STAIRS) for (const [x0, y0, x1, y1] of s.hole) for (let y = y0; y < y1; y += 10) for (let x = x0; x < x1; x += 10) stairCells[cj(y) * NI + ci(x)] = 1;
  // strict: wall cells cleared for doors / stairs belong to no room -> no floor, ceiling or paper (holes): give each the
  // room of a neighbour
  if (H.strict) for (const P of [P1, P2]) for (let pass = 0, more = true; more && pass < 6; pass++) {
    more = false;
    for (let k = 0; k < NC; k++) {
      if (!P.fp[k] || P.wall[k] || P.rail[k] || P.room[k] >= 0) continue;
      const n = [k + 1, k - 1, k + NI, k - NI].find(q => q >= 0 && q < NC && P.room[q] >= 0 && !P.wall[q]);
      if (n !== undefined) { P.room[k] = P.room[n]; more = true; }
    }
  }

  // ----------------------------------------------------------------- ground floor --
  const W1 = buildWalls(P1, FL1, TOP1, 'F1');
  // stairs before the floors' trim (a band standing into a tread is the band's loss)
  for (const s of STAIRS) s.build({ box });
  // pad: the whole footprint, pool cut out; outside the walls the lanai / porches are pavers on the same pad
  const padM = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) if (P1.fp[k] && !pool[k]) padM[k] = 1;
  for (const R of rects(padM)) B.slab(R.x0, R.y0, 0, R.x1, R.y1, FL1 - 4, { color: PAD }, 'pad');
  for (const R of rects(pool)) { B.slab(R.x0, R.y0, 0, R.x1, R.y1, 6, { color: [118, 186, 212] }, 'pool floor'); B.slab(R.x0, R.y0, 6, R.x1, R.y1, 34, { color: [60, 150, 200], material: 'BMC_Glass', collision: false }, 'pool water'); }
  // room floors and finishes
  const catOf = q => {
    const t = (q.notes.join(' ') + ' ' + q.type).toLowerCase();
    return /bath|powder/.test(t) ? 'bathroom' : /kitchen|laundry|pantry|wine/.test(t) ? 'kitchen' : /garage/.test(t) ? 'garage' : /bed|den|office|closet|movie|media|theat|bonus|safe/.test(t) ? 'bedroom' : /hall|foyer|entry|gallery|stair/.test(t) ? 'hall' : 'living';
  };
  // floor finishes after the listing photos, laid on world-aligned grids so neighbouring rectangles share joints:
  // travertine 3 ft squares, Brazilian cherry 6 ft planks staggered, white marble 4 ft checker, beige 2 ft bath
  // tile, garage epoxy 4 ft, lanai pavers 4 ft running bond
  const FIN = {
    TRV: { w: 30, h: 30, c: [[226, 212, 186], [216, 200, 172], [232, 221, 199]] },
    MAR: { w: 40, h: 40, c: [[240, 238, 234], [222, 220, 216]], checker: true },
    BTH: { w: 20, h: 20, c: [[212, 198, 172], [200, 186, 160]] },
    GAR: { w: 40, h: 40, c: [[156, 156, 152], [148, 148, 144]] },
    PAV: { w: 40, h: 40, c: [[224, 208, 180], [210, 192, 162], [232, 218, 194]], bond: true },
    WOD: { w: 60, h: 10, c: [[122, 62, 38], [134, 74, 46], [110, 55, 33]], bond: 3 },
  };
  function finFloor([x0, y0, x1, y1], top, f) {
    const F = FIN[f], z0 = top - 4;
    for (let y = Math.floor(y0 / F.h) * F.h; y < y1; y += F.h) {
      const row = Math.round(y / F.h), off = F.bond === true ? (row & 1) * F.w / 2 : F.bond ? ((row % F.bond) + F.bond) % F.bond * 20 : 0;
      for (let x = Math.floor((x0 - off) / F.w) * F.w + off; x < x1; x += F.w) {
        const p = Math.max(x0, x), q = Math.min(x1, x + F.w), a = Math.max(y0, y), b = Math.min(y1, y + F.h);
        if (q <= p || b <= a) continue;
        const c = F.checker ? F.c[(Math.round(x / F.w) + row) & 1] : F.c[Math.floor(hash(x, y) * F.c.length)];
        box(p, a, z0, q, b, top, { color: c }, 'floor ' + f);
      }
    }
  }
  function floors(P, fl, top, W, tag, ceilings = true) {
    const notchSet = W.notches;
    const cell = k => !P.wall[k] && !P.rail[k] && P.room[k] >= 0 && !pool[k] && !(P === P2 && stairCells[k]) && kindAt(P, k) !== 'open-to-below' ? P.room[k] + 1 : 0;
    const rs = rects(null, cell);
    for (const R of rs) {
      const q = P.rooms[R.v - 1], cat = q.type === 'outdoor' ? 'outdoor' : catOf(q);
      finFloor([R.x0, R.y0, R.x1, R.y1], fl, { outdoor: 'PAV', bathroom: q.notes.some(t => /primary/i.test(t)) ? 'MAR' : 'BTH', garage: 'GAR', bedroom: 'WOD', kitchen: 'TRV', hall: 'TRV', living: 'TRV' }[cat]);
    }
    // ceilings over indoor cells (not over stair wells / open-to-below on the floor above), notches stop 4 under them
    if (ceilings) {
      // strict: the top storey's ceiling also closes over its stair well and open-to-below (else the roof shows)
      const top2 = k => H.strict && P === P2 && P.fp[k] && !P.wall[k] && !P.rail[k] && kindAt(P, k) !== 'outdoor';
      const cc = k => top2(k) || (cell(k) && kindAt(P, k) !== 'outdoor' && !(P === P1 && (stairCells[k] || kindAt(P2, k) === 'open-to-below'))) ? 1 : 0;
      for (const R of rects(null, cc)) ceiling(R.x0, R.y0, R.x1, R.y1, top - 4, tag + ' ceiling');
    }
    // trim bands on the rooms' rectangles (a band only where a straight wall face backs it)
    const paper = {};
    for (const R of rs) {
      const q = P.rooms[R.v - 1];
      if (q.type === 'outdoor' || q.type === 'garage' || (!H.strict && (R.x1 - R.x0) * (R.y1 - R.y0) < 900)) continue;
      finishRoom({ x0: R.x0, y0: R.y0, x1: R.x1, y1: R.y1, z0: fl, z1: top - 4 }, { paper: paper[q.n] ??= PAPERS[Math.floor(r() * PAPERS.length)], wains: WAINS[q.n % 2], thin: H.strict && Math.min(R.x1 - R.x0, R.y1 - R.y0) < 50 });
    }
    void notchSet;
    return rs;
  }
  const R1 = floors(P1, FL1, TOP1, W1, 'F1');

  // covered lanai: white columns along the open sky, every 7+ studs
  const cols = [];
  for (let k = 0; k < NC; k++) {
    if (!lanai[k] || sky[k] || P1.wall[k] || P1.rail[k]) continue;
    if (!(sky[k + 1] || sky[k - 1] || sky[k + NI] || sky[k - NI])) continue;
    const x = xOf(k % NI), y = yOf(Math.floor(k / NI));
    if (cols.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) < 70)) continue;
    cols.push([x, y]);
  }

  // --------------------------------------------------------------------- slab --
  const hole2 = k => sky[k] || stairCells[k] || kindAt(P2, k) === 'open-to-below';
  const slabM = new Uint8Array(NC), deckM = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) {
    if (!(P1.fp[k] || P2.fp[k]) || hole2(k) || pool[k]) continue;
    slabM[k] = 1;
    if (!P2.fp[k] && !P2.wall[k] && !P2.rail[k]) deckM[k] = 1;
  }
  for (const R of rects(slabM)) B.slab(R.x0, R.y0, TOP1, R.x1, R.y1, FL2 - 4, { color: WHITE }, 'slab');
  for (const R of rects(deckM)) B.slab(R.x0, R.y0, FL2 - 4, R.x1, R.y1, FL2, { color: WHITE }, 'deck');
  for (const [x, y] of cols) {
    if (!B.free([x, y, FL1], [x + 10, y + 10, TOP1])) continue;
    box(x, y, FL1, x + 10, y + 10, TOP1 - 10, { color: WHITE }, 'column');
    box(x - 2, y - 2, TOP1 - 10, x + 12, y + 12, TOP1, { color: STONE }, 'column capital');
  }

  // ------------------------------------------------------------------- upper floor --
  const W2 = buildWalls(P2, FL2, TOP2, 'F2');
  const R2 = floors(P2, FL2, TOP2, W2, 'F2');


  // ---------------------------------------------------------------------- roofs --
  // course c (0 = eave) covers the roof cells c+1 studs (chebyshev) in from the eave line: a 4-high lip (white at the
  // eave) and a micro wedge rising PER over the stud toward the higher course; two lower sides = a hip corner wedge;
  // runs along a row with the same slope merge into one lip + one wedge. Past NMAX courses the deck is capped flat.
  function roof(mask, high, base, tag) {
    // the eave: one stud out from the roofed cells (not into a higher storey or the sky over the pool)
    const R = new Uint8Array(NC);
    for (let k = 0; k < NC; k++) if (mask[k]) R[k] = 1;
    for (let k = 0; k < NC; k++) if (!R[k] && !high[k] && !sky[k]) {
      const i = k % NI;
      if ([k + 1, k - 1, k + NI, k - NI, k + NI + 1, k + NI - 1, k - NI + 1, k - NI - 1].some(q => q >= 0 && q < NC && mask[q] && Math.abs((q % NI) - i) <= 1)) R[k] = 2;
    }
    const seed = new Uint8Array(NC);
    for (let k = 0; k < NC; k++) seed[k] = !R[k] && !high[k] ? 1 : 0;
    const d = bfs(seed);
    const lvl = k => (R[k] ? Math.min(d[k], NMAX + 1) : high[k] ? 99 : 0);
    const kindOf = new Array(NC);
    for (let k = 0; k < NC; k++) {
      if (!R[k]) continue;
      const L = lvl(k);
      if (L > NMAX) { kindOf[k] = 'flat'; continue; }
      const lo = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => lvl(k + di + dj * NI) < L);
      // a step of a 45 degree eave: only a diagonal neighbour is lower -> a corner wedge falling toward it
      const dl = lo.length ? [] : [[1, 1], [1, -1], [-1, 1], [-1, -1]].filter(([di, dj]) => lvl(k + di + dj * NI) < L);
      if (dl.length === 1) { kindOf[k] = `c${[dl[0][0], 0]}|${[0, dl[0][1]]}`; continue; }
      kindOf[k] = lo.length === 1 ? `s${lo[0]}` : lo.length === 2 && lo[0][0] !== -lo[1][0] && lo[0][1] !== -lo[1][1] ? `c${lo[0]}|${lo[1]}` : 'flat';
    }
    // flat cells (the capped deck, 1-stud ridges) as rectangles per level
    for (let L = 1; L <= NMAX + 1; L++) {
      const zb = base + Math.min(L - 1, NMAX) * PER;
      for (const Q of rects(null, k => R[k] && kindOf[k] === 'flat' && lvl(k) === L ? 1 : 0)) {
        box(Q.x0, Q.y0, zb, Q.x1, Q.y1, zb + 4, { color: L === 1 ? WHITE : shade(ROOF, 0.82) }, tag + ' lip');
        box(Q.x0, Q.y0, zb + 4, Q.x1, Q.y1, zb + PER, { color: shade(ROOF, [1, 0.95, 1.04][L % 3]) }, tag + ' deck');
        for (let y = Q.y0; y < Q.y1; y += 10) for (let x = Q.x0; x < Q.x1; x += 10) kindOf[cj(y) * NI + ci(x)] = undefined;
      }
    }
    for (let k = 0; k < NC; k++) {
      if (!R[k] || kindOf[k] === undefined) continue;
      const i = k % NI, j = (k - i) / NI, L = lvl(k), kd = kindOf[k];
      const zb = base + Math.min(L - 1, NMAX) * PER, zt = zb + PER;
      const lip = { color: L === 1 ? WHITE : shade(ROOF, 0.82) }, col = shade(ROOF, [1, 0.95, 1.04][L % 3] * (0.97 + 0.06 * hash(i, j)));
      if (kd === 'flat') {
        let e = i;
        while (e + 1 < NI && R[k + e + 1 - i] && kindOf[k + e + 1 - i] === 'flat' && lvl(k + e + 1 - i) === L) e++;
        for (let q = i; q <= e; q++) kindOf[j * NI + q] = undefined;
        box(xOf(i), yOf(j), zb, xOf(e + 1), yOf(j) + 10, zb + 4, lip, tag + ' lip');
        box(xOf(i), yOf(j), zb + 4, xOf(e + 1), yOf(j) + 10, zt, { color: col }, tag + ' deck');
        continue;
      }
      if (kd[0] === 's') {
        const [di, dj] = kd.slice(1).split(',').map(Number);
        // a run along the edge (x for a y slope, y for an x slope)
        const [si, sj] = dj ? [1, 0] : [0, 1];
        let e = 0;
        while (true) { const q = k + (e + 1) * (si + sj * NI); if (!inG(i + (e + 1) * si, j + (e + 1) * sj) || !R[q] || kindOf[q] !== kd || lvl(q) !== L) break; e++; }
        for (let s = 0; s <= e; s++) kindOf[k + s * (si + sj * NI)] = undefined;
        const x1 = xOf(i + e * si + 1), y1 = yOf(j + e * sj + 1);
        box(xOf(i), yOf(j), zb, x1, y1, zb + 4, lip, tag + ' lip');
        wedge(xOf(i), yOf(j), zb + 4, x1, y1, zt, [[-di, -dj]], col, tag);
        continue;
      }
      const [[a, b], [c, e2]] = kd.slice(1).split('|').map(s => s.split(',').map(Number));
      kindOf[k] = undefined;
      box(xOf(i), yOf(j), zb, xOf(i) + 10, yOf(j) + 10, zb + 4, lip, tag + ' lip');
      wedge(xOf(i), yOf(j), zb + 4, xOf(i) + 10, yOf(j) + 10, zt, [[-a - c, 0], [0, -b - e2]], col, tag + ' hip', 1, 'PB_DefaultMicroWedgeCorner');
    }
  }
  const roof1 = new Uint8Array(NC), roof2 = new Uint8Array(NC), high1 = new Uint8Array(NC), none = new Uint8Array(NC);
  for (let k = 0; k < NC; k++) {
    if (P2.fp[k] || P2.wall[k] || P2.rail[k]) { high1[k] = 1; if ((P2.fp[k] && kindAt(P2, k) !== 'outdoor') || P2.wall[k]) roof2[k] = 1; }
    else if (P1.fp[k] && !sky[k] && !pool[k]) roof1[k] = 1;
  }
  // the upper walls' diagonal notches stand outside the plan's cells: under the upper roof, clear of the lower one
  for (const k of W2.notches) { high1[k] = 1; roof1[k] = 0; roof2[k] = 1; }
  // outdoor F2 rooms (balconies, roof terraces) are open: their walls stop at the balustrade, no roof over them
  for (let k = 0; k < NC; k++) if (P2.fp[k] && kindAt(P2, k) === 'outdoor' && !P2.wall[k]) high1[k] = 1;
  roof(roof1, high1, FL2, 'roof');
  roof(roof2, none, TOP2, 'upper roof');

  // ------------------------------------------------------------------- doorsteps --
  // three 12-high steps off the pad in front of every outside F1 door (pad 36 above the ground)
  for (const d of W1.doors.filter(q => q.outside)) {
    const k = d.axis === 'x' ? cj(d.line - 1) * NI + ci((d.a0 + d.a1) / 2) : cj((d.a0 + d.a1) / 2) * NI + ci(d.line - 1);
    const dir = P1.fp[k] ? 1 : -1;                      // the outside side: +line if the cell before the wall is inside
    for (let s = 1; s <= 3; s++) {
      const n0 = dir > 0 ? d.line + 10 + 10 * (s - 1) : d.line - 10 * s;
      const [x0, y0, x1, y1] = d.axis === 'x' ? [d.a0 - 6, n0, d.a1 + 6, n0 + 10] : [n0, d.a0 - 6, n0 + 10, d.a1 + 6];
      if (B.free([x0, y0, 0], [x1, y1, FL1 - 4 - 12 * (s - 1)])) box(x0, y0, 0, x1, y1, FL1 - 4 - 12 * (s - 1), { color: STONE }, 'doorstep');
    }
  }

  // strict: two 12-high step rings round the F1 outdoor rooms' open (rail) edges, so a player walks up onto the porch
  if (H.strict) {
    const open = new Uint8Array(NC);
    for (let k = 0; k < NC; k++) if (P1.fp[k] && kindAt(P1, k) === 'outdoor' && !P1.wall[k]) open[k] = 1;
    const d = bfs(open, false);
    for (const [ring, zt] of [[1, FL1 - 16], [2, FL1 - 28]]) {
      for (const R of rects(null, k => d[k] === ring && !P1.fp[k] && !P1.wall[k] && !P2.fp[k] ? 1 : 0)) {
        if (B.free([R.x0, R.y0, 0], [R.x1, R.y1, zt])) box(R.x0, R.y0, 0, R.x1, R.y1, zt, { color: STONE }, 'doorstep');
      }
    }
  }

  // ------------------------------------------------------------------ furniture --
  // H.furnish: руся's pieces (rusfurniture.mjs) against straight walls of each room's biggest rectangle, back to the wall,
  // clear of every opening on that wall by 14 and of the room's doors by 40, at most a third of the floor taken so the
  // middle stays open; per room kind a list of groups, the first piece of a group that fits is placed
  const FURNISH = {
    living: [['sofa', 'sofa_cream', 'loveseat', 'loveseat_cream'], ['armchair', 'armchair_grey', 'armchair_low'], ['tv_console'], ['plant_tall', 'tree_plant', 'planter', 'plant_pot']],
    bedroom: [['bed_queen', 'bed_double', 'bed_headboard'], ['end_table', 'lamp_small'], ['tall_cabinet', 'desk_set']],
    bathroom: [['toilet'], ['bathtub']],
    kitchen: [['fridge'], ['stove'], ['kitchen_unit']],
    laundry: [['washer']],
  };
  const furnished = [];
  if (H.furnish) for (const [P, rs, fl, top] of [[P1, R1, FL1, TOP1], [P2, R2, FL2, TOP2]]) {
    const big = new Map();
    for (const R of rs) { const a = (R.x1 - R.x0) * (R.y1 - R.y0), q = P.rooms[R.v - 1]; if (!big.has(q.n) || a > big.get(q.n).a) big.set(q.n, { R, a, q }); }
    for (const { R, a, q } of big.values()) {
      if (q.type === 'outdoor' || q.type === 'garage' || q.type === 'stairs') continue;
      const t = (q.notes.join(' ') + ' ' + q.type).toLowerCase(), kind = /laundry/.test(t) ? 'laundry' : catOf(q);
      const groups = FURNISH[kind];
      if (!groups) continue;
      const Rz = { ...R, z0: fl, z1: top - 4 }, doorOps = Object.keys(SIDES).flatMap(sd => faceWall(sd, Rz).flatMap(w => w.openings.filter(o => o.z0 <= fl + 2).map(o => ({ ...o, axis: SIDES[sd][0] }))));
      let used = 0;
      for (const group of groups) {
        let done = false;
        for (const key of group) {
          if (done || !furnPiece(key)) continue;
          for (const side of ['y1', 'x0', 'x1', 'y0']) {
            if (done) break;
            const ws = faceWall(side, Rz);
            if (!ws.length) continue;
            const turn = facing(key, { x0: 'x0', x1: 'x1', y0: 'y0', y1: 'y1' }[side]), [fw, fd] = footprint(key, turn);
            const along = side[0] === 'y' ? fw : fd, deep = side[0] === 'y' ? fd : fw;
            if (used + fw * fd > a / 3) continue;
            const [axis, dirIn] = SIDES[side], lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
            const ops = ws.flatMap(w => w.openings);
            for (let c = lo + along / 2 + 6; c <= hi - along / 2 - 6 && !done; c += 10) {
              if (!ws.some(w => w.a0 <= c - along / 2 && w.a1 >= c + along / 2)) continue;
              if (ops.some(o => o.a0 - 14 < c + along / 2 && o.a1 + 14 > c - along / 2)) continue;
              const n = R[side] + dirIn * (5 + deep / 2);   // 5 off the face: past the 4-deep base trim
              const [x, y] = axis === 'x' ? [c, n] : [n, c];
              const px0 = x - fw / 2, px1 = x + fw / 2, py0 = y - fd / 2, py1 = y + fd / 2;
              // keep 40 clear in front of any door of this rectangle
              if (doorOps.some(o => { const [dx0, dx1, dy0, dy1] = o.axis === 'x' ? [o.a0, o.a1, R.y0 - 40, R.y1 + 40] : [R.x0 - 40, R.x1 + 40, o.a0, o.a1]; const near = o.axis === 'x' ? [o.a0 - 40, o.a1 + 40] : [o.a0 - 40, o.a1 + 40];
                return o.axis === 'x' ? px1 > near[0] && px0 < near[1] && (Math.abs(py0 - R.y0) < 50 || Math.abs(py1 - R.y1) < 50) && dx0 < dx1 && dy0 < dy1 : py1 > near[0] && py0 < near[1] && (Math.abs(px0 - R.x0) < 50 || Math.abs(px1 - R.x1) < 50); })) continue;
              if (placeFurniture(B, key, Math.round(x), Math.round(y), fl, turn)) { done = true; used += fw * fd; furnished.push(`${P === P1 ? 'F1' : 'F2'} ${q.name}: ${key}`); }
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------- fixtures --
  // a lamp at the middle of each indoor room's biggest rectangle; its switch on a straight wall face of that rectangle
  // 10+ clear of openings; every leaf door (30 wide) of both floors
  const fixtures = { rooms: [], doors: [] };
  for (const [P, rs, fl, top] of [[P1, R1, FL1, TOP1], [P2, null, FL2, TOP2]]) {
    const byRoom = new Map();
    for (const R of rs ?? rects(null, k => !P.wall[k] && !P.rail[k] && P.room[k] >= 0 && !(P === P2 && stairCells[k]) && kindAt(P, k) !== 'open-to-below' ? P.room[k] + 1 : 0)) {
      const a = (R.x1 - R.x0) * (R.y1 - R.y0), q = P.rooms[R.v - 1];
      if (q.type === 'outdoor' || q.type === 'open-to-below' || a < 1600 || Math.min(R.x1 - R.x0, R.y1 - R.y0) < 30) continue;
      // strict: no lamp in a stair room or over a tread (руся 2026-11-02: 'a light in the middle of the stairs i cant get up')
      if (H.strict && (q.type === 'stairs' || [...Array((R.x1 - R.x0) / 10 * (R.y1 - R.y0) / 10).keys()].some(n => stairCells[cj(R.y0 + 10 * Math.floor(n / ((R.x1 - R.x0) / 10))) * NI + ci(R.x0 + 10 * (n % ((R.x1 - R.x0) / 10)))]))) continue;
      if (!byRoom.has(q.n) || a > byRoom.get(q.n).a) byRoom.set(q.n, { R, a, q });
    }
    for (const { R, q } of byRoom.values()) {
      const lx = R.x0 + Math.floor((R.x1 - R.x0) / 20) * 10 + 5, ly = R.y0 + Math.floor((R.y1 - R.y0) / 20) * 10 + 5;   // a cell centre inside the rectangle
      let sw = null;
      for (const side of ['y0', 'y1', 'x0', 'x1']) {
        const Rz = { ...R, z0: fl, z1: top - 4 };
        const ws = faceWall(side, Rz);
        if (!ws.length) continue;
        const [axis] = SIDES[side], lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
        const ops = ws.flatMap(w => w.openings);
        for (let a = lo + 16; a <= hi - 16 && !sw; a += 2) {
          if (!ws.some(w => w.a0 <= a - 6 && w.a1 >= a + 6) || ops.some(o => o.a0 - 14 < a && o.a1 + 14 > a)) continue;
          const f = R[side], n = { y0: [0, 1], y1: [0, -1], x0: [1, 0], x1: [-1, 0] }[side];
          sw = { at: axis === 'x' ? [a, f, fl] : [f, a, fl], normal: n };
        }
        if (sw) break;
      }
      if (!sw) continue;
      fixtures.rooms.push({ name: `${P === P1 ? 'F1' : 'F2'} ${q.name}`.slice(0, 40), lamps: [{ at: [lx, ly, top - 4] }], switch: sw });
    }
  }
  for (const d of [...W1.doors, ...W2.doors]) {
    const at = (a, z) => d.axis === 'x' ? [a, d.line + 5, z] : [d.line + 5, a, z];
    fixtures.doors.push({ name: `door ${fixtures.doors.length}`, color: d.outside ? [120, 70, 40] : undefined, z0: d.z0, z1: d.z0 + DOOR, a0: at(d.a0, d.z0), a1: at(d.a1, d.z0) });
  }

  const bricks = B.bricks.map(({ label, ...b }) => (process.env.LABELS ? { ...b, label } : b));
  const xs = [], ys = [];
  for (let k = 0; k < NC; k++) if (P1.fp[k] || P2.fp[k]) { xs.push(xOf(k % NI)); ys.push(yOf(Math.floor(k / NI))); }
  const lot = [Math.min(...xs) - 60, Math.min(...ys) - 60, Math.max(...xs) + 70, Math.max(...ys) + 70];
  return { bricks, fixtures, lot, count: bricks.length, soft, furnished };
}

// ------------------------------------------------------------------------ stairs --
// The grand stair (the plan's curved one, squared up): from the upper hall at x -300 a flight of 5 treads (10 rise,
// 10 run) down -x to a 5x4 stud landing at 120, then 7 treads down +y into the ground-floor hall (landing 3+ studs of
// open floor at y 110..). The apartment (2B) stair: an outdoor square switchback round a stucco core (8x8 studs at
// x 430..510, y -540..-460), 18 risers of 10, the last one the NE corner beside the 2B balcony. Each stair: slab
// holes (F2 floor + slab), walls / rails it clears on either floor, and a builder.
function stairPlan(P1, P2) {
  const clear = (P, x0, y0, x1, y1) => { for (let y = y0; y < y1; y += 10) for (let x = x0; x < x1; x += 10) { const k = cj(y) * NI + ci(x); P.wall[k] = 0; P.rail[k] = 0; } };
  const TR = [[226, 212, 186], [214, 198, 170]], RAILC = IRON;
  // ---- grand stair
  clear(P1, -400, 0, -300, 140); clear(P2, -400, 0, -300, 110);
  const grand = {
    hole: [[-400, 0, -300, 40], [-400, 40, -360, 110]],
    build({ box }) {
      for (let k = 1; k <= 5; k++) { const x = -300 - 10 * k, zt = FL2 - 10 * k; box(x, 0, zt - 10, x + 10, 40, zt, { color: TR[k % 2] }, 'stair tread'); }
      box(-400, 0, 110, -350, 40, 120, { color: TR[0] }, 'stair landing');
      for (let k = 1; k <= 7; k++) { const y = 40 + 10 * (k - 1), zt = 120 - 10 * k; box(-400, y, k >= 6 ? FL1 : zt - 10, -360, y + 10, zt, { color: TR[k % 2] }, 'stair tread'); }
      // iron balusters + a stone handrail on the open sides: the upper flight's y 40 side (past the landing), the
      // lower flight's x -360 side, the landing's two open sides
      const post = (x, y, z, h = 34) => box(x, y, z, x + 2, y + 2, z + h, { color: RAILC }, 'baluster');
      for (let k = 1; k <= 5; k++) post(-300 - 10 * k + 4, 38, FL2 - 10 * k);
      box(-350, 36, FL2 - 10 + 34, -300, 40, FL2 - 10 + 38, { color: STONE }, 'handrail');
      for (let k = 1; k <= 7; k++) post(-362, 40 + 10 * (k - 1) + 4, 120 - 10 * k);
      box(-364, 40, 120 - 10 + 34, -360, 110, 120 - 10 + 38, { color: STONE }, 'handrail');
      box(-400, 36, 120, -360, 40, 154, { color: RAILC }, 'landing rail');
    },
  };
  // ---- apartment stair
  const AX0 = 430, AY0 = -540, ring = [
    [0, 0, 30, 30], [30, 0, 40, 30], [40, 0, 50, 30], [50, 0, 80, 30], [50, 30, 80, 40], [50, 40, 80, 50],
    [50, 50, 80, 80], [40, 50, 50, 80], [30, 50, 40, 80], [0, 50, 30, 80], [0, 40, 30, 50], [0, 30, 30, 40],
  ].map(([a, b, c, d]) => [AX0 + a, AY0 + b, AX0 + c, AY0 + d]);
  const at = n => ring[n % 12];
  clear(P2, 500, -500, 520, -450);
  const apt = {
    hole: [],
    build({ box }) {
      box(AX0 + 30, AY0 + 30, 0, AX0 + 50, AY0 + 50, FL2 + 10, { color: STUCCO }, 'stair core');
      box(AX0 + 28, AY0 + 28, FL2 + 10, AX0 + 52, AY0 + 52, FL2 + 14, { color: STONE }, 'stair core cap');
      for (let n = 1; n <= 18; n++) {
        const [x0, y0, x1, y1] = at(n), zt = 10 * n;
        box(x0, y0, n <= 2 ? 0 : zt - 10, x1, y1, zt, { color: TR[n % 2] }, 'outdoor stair');
        // rail on the piece's outer sides (not the top piece's balcony side)
        const ya = y0 === AY0 ? y0 + 2 : y0, yb = y1 === AY0 + 80 ? y1 - 2 : y1;   // x-side rails stop at the y-side ones
        const sides = [[y0 === AY0, [x0, y0, x1, y0 + 2]], [y1 === AY0 + 80, [x0, y1 - 2, x1, y1]], [x0 === AX0, [x0, ya, x0 + 2, yb]], [x1 === AX0 + 80 && n !== 18, [x1 - 2, ya, x1, yb]]];
        for (const [on, [a, b, c, d]] of sides) if (on) box(a, b, zt, c, d, zt + 34, { color: RAILC }, 'outdoor stair rail');
      }
    },
  };
  return [grand, apt];
}

if (process.argv[1]?.endsWith('brynwood.mjs')) {
  const t0 = Date.now(), h = brynwood();
  const ai = process.argv.indexOf('--at'), at = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [0, 0];
  const counts = {};
  for (const b of h.bricks) counts[b.asset] = (counts[b.asset] ?? 0) + 1;
  console.error(`brynwood: ${h.count} bricks ${JSON.stringify(counts)}, soft drops ${JSON.stringify(h.soft)}, ${h.fixtures.rooms.length} rooms / ${h.fixtures.doors.length} doors, ${Date.now() - t0} ms`);
  const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (out) {
    const owner = { id: 'c1770000-0000-4b0b-9a11-0000004453b0', name: 'Brynwood Estate', display_name: 'Brynwood Estate' };
    const bs = h.bricks.map(b => ({ ...b, asset: b.asset ?? 'PB_DefaultBrick', position: [b.position[0] + at[0], b.position[1] + at[1], b.position[2]] }));
    fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner, captureMs: 15000, bricks: bs }] }));
  }
}
