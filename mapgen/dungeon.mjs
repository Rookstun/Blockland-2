// Zelda-style temple dungeons: a stack of floors, each a 5 x 5 grid of rooms
// joined by arched doorways at the wall centres, tied together by grand
// atriums (2 x 2 rooms wide, 3 floors tall) with galleries, balustrades and
// a staircase climbing their walls. No props: the detail is architectural.
//
// Rooms vary: most are one cell, some merge into 2 x 1 halls or a 2 x 2 great
// hall, and each gets an interior (plain, a colonnade of piers, a stepped
// dais or a reflecting basin), a floor pattern (checker, rings, stripes,
// diagonals) and a ceiling (coffers, heavy cross beams, a glowing lantern).
//
// Every wall, per storey, from the floor up (heights above the floor top):
//   0..24    plinth course, with a skirting moulding standing proud
//   24..60   dado, a dado rail on top (60..68)
//   60..120  coursed ashlar field, pilasters (base, shaft, capital) proud of it
//   120..144 frieze: a repeating band of three stones
//   144..168 cornice: two stepped courses of entablature
// Doorways have a stepped arch, architrave jambs and a keystone. Walls facing
// rock get tall arched light windows (glowing glass, mullion, sill, hood);
// walls between rooms get arched interior windows with a baluster rail.
// Floors: a border, a checkerboard and a diamond medallion. Ceilings:
// coffered beams with a rosette; atriums get a glowing oculus instead.
//
// Local frame: x, y in [0, 2040] (a 20-unit margin round a 5 x 5 grid of
// 400-unit cells), z from 0 at the bottom; floor k (0 = deepest) spans
// [k*STOREY, (k+1)*STOREY]. The top floor's ceiling is the surface.

import { makeBuilder, rng } from './builder.mjs';

export const STOREY = 192;      // 16 bricks: 12 floor slab, 168 clear, 12 ceiling
export const CELL = 400, GRID = 5, MARGIN = 20, SIZE = 2 * MARGIN + GRID * CELL;
const W = 20;                   // wall thickness

export const THEMES = {
  crypt: {
    base: [70, 74, 70], dado: [96, 104, 96], field: [[120, 126, 118], [112, 118, 110], [128, 132, 124]],
    frieze: [[150, 150, 140], [80, 110, 90], [60, 80, 66]], trim: [168, 166, 154], mould: [186, 184, 170],
    floor: { border: [60, 64, 60], a: [134, 136, 128], b: [106, 110, 102], medal: [[60, 110, 80], [180, 170, 140], [40, 70, 56]] },
    glow: [140, 255, 190], rock: [66, 64, 66], plaza: [150, 146, 134],
  },
  keep: {
    base: [140, 110, 76], dado: [176, 144, 100], field: [[200, 172, 128], [190, 162, 118], [210, 182, 140]],
    frieze: [[230, 214, 170], [60, 120, 150], [150, 60, 50]], trim: [236, 224, 190], mould: [246, 238, 210],
    floor: { border: [120, 90, 60], a: [210, 190, 150], b: [170, 140, 100], medal: [[50, 110, 150], [230, 214, 170], [150, 60, 50]] },
    glow: [150, 210, 255], rock: [90, 80, 70], plaza: [196, 176, 140],
  },
  deep: {
    base: [40, 36, 38], dado: [58, 52, 52], field: [[72, 66, 64], [64, 58, 58], [80, 72, 70]],
    frieze: [[120, 60, 30], [180, 120, 40], [50, 44, 44]], trim: [96, 88, 84], mould: [118, 108, 100],
    floor: { border: [36, 32, 32], a: [84, 76, 72], b: [60, 54, 52], medal: [[200, 90, 30], [230, 170, 60], [90, 40, 24]] },
    glow: [255, 160, 70], rock: [48, 44, 46], plaza: [110, 100, 96],
  },
};

const SIDES = ['S', 'N', 'W', 'E'];
const STEP = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] };
const OPP = { S: 'N', N: 'S', W: 'E', E: 'W' };

/**
 * buildDungeon({ levels, seed, theme, spawnChance })
 *   -> { bricks, dropped, spawns: [{ at: [x, y, z], level }], entrance: { slot, top }, rooms }
 * levels: 3..5. Floors 0..levels-1, the top one opens to the surface.
 */
export function buildDungeon(opts) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { return buildOnce({ ...opts, seed: opts.seed + attempt * 7919 }); }
    catch (e) { if (!(e instanceof LayoutError)) throw e; }
  }
  throw new Error('no dungeon layout found');
}
class LayoutError extends Error {}

function buildOnce({ levels: L, seed, theme = 'crypt', spawnChance = 0.35 }) {
  const T = THEMES[theme];
  const R = rng(seed);
  const B = makeBuilder();
  const { box, slab, pole } = B;
  const cellX = i => MARGIN + i * CELL, cellY = j => MARGIN + j * CELL;

  // --------------------------------------------------------------- layout --
  // atriums: 2 x 2 cells, three floors. One for 3 floors; two overlapping
  // ones for 4 or 5 floors, so every floor reaches every other.
  const atria = [];
  const spans = L === 3 ? [[0, 2]] : [[0, 2], [L - 3, L - 1]];
  for (const [k0, k1] of spans) {
    for (let tries = 0; ; tries++) {
      const i = R.int(0, GRID - 2), j = R.int(0, GRID - 2);
      const clash = atria.some(a => a.k0 <= k1 && k0 <= a.k1 && Math.abs(a.i - i) < 2 && Math.abs(a.j - j) < 2);
      if (!clash || tries > 200) { atria.push({ i, j, k0, k1, id: 'A' + atria.length }); break; }
    }
  }
  const atriumAt = (i, j, k) => atria.find(a => k >= a.k0 && k <= a.k1 && i >= a.i && i <= a.i + 1 && j >= a.j && j <= a.j + 1);
  // atrium staircases: floor k0 -> k0+1 climbs the W wall (+y), k0+1 -> k0+2 the S wall (-x),
  // so these doorway slots are blocked by stairs: [k, side, slot] with slot 0 = the first cell along the side
  const blocked = a => [[a.k0, 'W', 0], [a.k0 + 1, 'W', 0], [a.k0 + 1, 'S', 0], [a.k0 + 2, 'S', 0]];

  // per floor: which node fills each cell ('A0' for an atrium, 'r:k:c' for a
  // room, c its lowest cell); rooms bigger than one cell are in rects as cell
  // ranges [i0, j0, i1, j1)
  const floors = [];
  const rects = new Map();
  for (let k = 0; k < L; k++) {
    const node = new Array(GRID * GRID).fill(null);
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) { const a = atriumAt(i, j, k); if (a) node[i * GRID + j] = a.id; }
    const free = () => [...Array(GRID * GRID).keys()].filter(c => !node[c]);
    const seeds = [];
    if (k === L - 1) { // the entrance room, on the edge so one wall backs onto rock
      const edge = free().filter(c => { const i = Math.floor(c / GRID), j = c % GRID; return i === 0 || j === 0 || i === GRID - 1 || j === GRID - 1; });
      if (!edge.length) throw new LayoutError('no edge cell for the entrance');
      const c = R.pick(edge);
      node[c] = `r:${k}:${c}`; seeds.push(c);
    }
    // grow rooms outward from the atriums and the entrance
    const target = 9 + R.int(0, 3);
    let count = seeds.length;
    for (let guard = 0; count < target && guard < 500; guard++) {
      const taken = [...Array(GRID * GRID).keys()].filter(c => node[c]);
      const c = R.pick(taken), i = Math.floor(c / GRID), j = c % GRID;
      const [di, dj] = R.pick(Object.values(STEP));
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID || node[ni * GRID + nj]) continue;
      node[ni * GRID + nj] = `r:${k}:${ni * GRID + nj}`;
      count++;
    }
    // halls: maybe one 2 x 2 great hall, then some 2 x 1 halls, merged from
    // single rooms (never the entrance)
    const single = c => node[c] === `r:${k}:${c}` && !rects.has(node[c]) && !seeds.includes(c);
    const rectCells = (i0, j0, i1, j1) => { const out = []; for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) out.push(i * GRID + j); return out; };
    const merge = (i0, j0, i1, j1) => {
      const id = `r:${k}:${i0 * GRID + j0}`;
      for (const c of rectCells(i0, j0, i1, j1)) node[c] = id;
      rects.set(id, [i0, j0, i1, j1]);
    };
    if (R() < 0.55) {
      const opts = [];
      for (let i = 0; i < GRID - 1; i++) for (let j = 0; j < GRID - 1; j++) if (rectCells(i, j, i + 2, j + 2).every(single)) opts.push([i, j]);
      if (opts.length) { const [i, j] = R.pick(opts); merge(i, j, i + 2, j + 2); }
    }
    for (let c = 0; c < GRID * GRID; c++) {
      if (!single(c) || R() > 0.3) continue;
      const i = Math.floor(c / GRID), j = c % GRID;
      const [di, dj] = R() < 0.5 ? [1, 0] : [0, 1];
      if (i + di < GRID && j + dj < GRID && single((i + di) * GRID + j + dj)) merge(i, j, i + di + 1, j + dj + 1);
    }
    floors.push({ node, entrance: k === L - 1 ? seeds[0] : null });
  }

  // doors: a spanning tree over each floor's rooms and atriums, plus a few loops.
  // An edge is a shared cell edge [cell, side] between two different nodes.
  const doorKey = (k, c, side) => `${k}:${c}:${side}`;
  const doors = new Set();
  for (let k = 0; k < L; k++) {
    const { node } = floors[k];
    const edges = [];
    for (let i = 0; i < GRID; i++)
      for (let j = 0; j < GRID; j++)
        for (const side of ['E', 'N']) {
          const [di, dj] = STEP[side], ni = i + di, nj = j + dj;
          if (ni >= GRID || nj >= GRID) continue;
          const a = node[i * GRID + j], b = node[ni * GRID + nj];
          if (!a || !b || a === b) continue;
          if (isBlocked(k, i, j, side) || isBlocked(k, ni, nj, OPP[side])) continue;
          edges.push({ c: i * GRID + j, side, a, b, w: R() });
        }
    edges.sort((u, v) => u.w - v.w);
    const parent = new Map();
    const find = x => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
    for (const e of edges) {
      const ra = find(e.a), rb = find(e.b);
      if (ra !== rb) { parent.set(ra, rb); doors.add(doorKey(k, e.c, e.side)); }
      else if (R() < 0.18) doors.add(doorKey(k, e.c, e.side));
    }
    // rooms not linked to an atrium (only blocked edges) become rock; the
    // atriums on one floor must link to each other so the floors chain up
    const here = atria.filter(a => k >= a.k0 && k <= a.k1).map(a => find(a.id));
    if (new Set(here).size > 1) throw new LayoutError('atriums not linked on floor ' + k);
    for (let c = 0; c < GRID * GRID; c++) if (node[c] && !node[c].startsWith('A') && find(node[c]) !== here[0]) node[c] = null;
    if (floors[k].entrance !== null && !node[floors[k].entrance]) throw new LayoutError('entrance cut off');
  }
  function isBlocked(k, i, j, side) {
    const a = atriumAt(i, j, k);
    if (!a) return false;
    const atSide = { W: i === a.i, E: i === a.i + 1, S: j === a.j, N: j === a.j + 1 }[side];
    if (!atSide) return false;
    const slot = side === 'W' || side === 'E' ? j - a.j : i - a.i;
    return blocked(a).some(([bk, bs, bslot]) => bk === k && bs === side && bslot === slot);
  }
  const hasDoor = (k, i, j, side) => {
    if (doors.has(doorKey(k, i * GRID + j, side))) return true;
    const [di, dj] = STEP[side];
    return doors.has(doorKey(k, (i + di) * GRID + (j + dj), OPP[side]));
  };
  const nodeAt = (k, i, j) => (i < 0 || j < 0 || i >= GRID || j >= GRID ? null : floors[k].node[i * GRID + j]);

  // ------------------------------------------------------------ walls --
  // A rectangle R = [X0, Y0, X1, Y1]. Side geometry: the band is the outer
  // 20 units; p runs along the side; d measures from the wall face into the room.
  const sideSpan = (Rr, s) => (s === 'S' || s === 'N' ? [Rr[0], Rr[2]] : [Rr[1] + W, Rr[3] - W]);
  function band(Rr, s, p0, p1, b0, b1, z0, z1, m, label) {
    if (p1 - p0 > 400) { const mid = p0 + Math.round((p1 - p0) / 20) * 10; band(Rr, s, p0, mid, b0, b1, z0, z1, m, label); return band(Rr, s, mid, p1, b0, b1, z0, z1, m, label); }
    const [X0, Y0, X1, Y1] = Rr;
    if (s === 'S') return box(p0, Y0 + b0, z0, p1, Y0 + b1, z1, m, label);
    if (s === 'N') return box(p0, Y1 - b1, z0, p1, Y1 - b0, z1, m, label);
    if (s === 'W') return box(X0 + b0, p0, z0, X0 + b1, p1, z1, m, label);
    return box(X1 - b1, p0, z0, X1 - b0, p1, z1, m, label);
  }
  const proud = (Rr, s, p0, p1, d0, d1, z0, z1, m, label) => band(Rr, s, p0, p1, W + d0, W + d1, z0, z1, m, label);
  // a protrusion running the whole side, trimmed at the corners by its own depth on W/E
  // (W/E trim rounds up to a whole stud so lengths stay on the grid)
  const runSpan = (Rr, s, d) => { const t = Math.ceil(d / 10) * 10; return s === 'S' || s === 'N' ? [Rr[0] + W, Rr[2] - W] : [Rr[1] + W + t, Rr[3] - W - t]; };
  const minus = ([a, b], gaps) => {
    const out = [];
    let p = a;
    for (const [g0, g1] of [...gaps].sort((u, v) => u[0] - v[0])) {
      if (g1 <= p || g0 >= b) continue;
      if (g0 > p) out.push([p, g0]);
      p = Math.max(p, g1);
    }
    if (p < b) out.push([p, b]);
    return out;
  };

  // opening shapes (along-wall centre c, floor top f): stacked rectangles making a stepped arch
  const SHAPE = {
    door: c => [[c - 40, c + 40, 0, 84], [c - 30, c + 30, 84, 96], [c - 20, c + 20, 96, 108]],
    light: c => [[c - 30, c + 30, 36, 108], [c - 20, c + 20, 108, 120], [c - 10, c + 10, 120, 132]],
    view: c => [[c - 30, c + 30, 48, 108], [c - 20, c + 20, 108, 120], [c - 10, c + 10, 120, 132]],
  };

  /**
   * One storey of one side of a room or atrium.
   *   zb..zt: the band's own extent (the wall starts on the floor slab, or
   *   carries on through a gallery slab); f: this storey's floor top.
   *   openings: [{ c, kind: 'door' | 'light' | 'view', rail }]
   */
  function wallStorey(Rr, s, zb, zt, f, openings, { cap = false } = {}) {
    const [a, b] = sideSpan(Rr, s);
    const holes = openings.flatMap(o => SHAPE[o.kind](o.c).map(([p0, p1, z0, z1]) => ({ p0, p1, z0: f + z0, z1: f + z1 })));
    // the band, course by course
    for (let z = zb; z < zt; z += 12) {
      const r = z - f;
      const runs = minus([a, b], holes.filter(h => h.z0 <= z && h.z1 >= z + 12).map(h => [h.p0, h.p1]));
      for (const [r0, r1] of runs) {
        if (r >= 60 && r < 120) {
          // ashlar: staggered blocks in three shades
          let q = r0, first = (r / 12) % 2 ? 30 : 50;
          while (q < r1) {
            let len = first || R.pick([40, 50, 60, 40]);
            first = 0;
            if (r1 - (q + len) < 30) len = r1 - q;
            band(Rr, s, q, q + len, 0, W, z, z + 12, { color: R.pick(T.field) }, 'ashlar');
            q += len;
          }
        } else if (r >= 120 && r < 144) {
          // frieze: a fixed rhythm of 20-unit stones keyed to absolute position
          for (let q = r0; q < r1;) {
            const e = Math.min(r1, (Math.floor(q / 20) + 1) * 20);
            const k3 = ((Math.floor(q / 20) % 4) + 4) % 4;
            const color = r < 132 ? T.frieze[[0, 1, 0, 2][k3]] : T.frieze[[0, 2, 0, 1][k3]];
            band(Rr, s, q, e, 0, W, z, z + 12, { color }, 'frieze');
            q = e;
          }
        } else {
          const color = r < 0 || r >= 144 ? T.trim : r < 24 ? T.base : T.dado;
          for (let q = r0; q < r1; q += 200) band(Rr, s, q, Math.min(r1, q + 200), 0, W, z, z + 12, { color }, 'wall');
        }
      }
    }
    // window glass, mullions and rails inside the openings
    for (const o of openings) {
      if (o.kind === 'light') {
        for (const [p0, p1, z0, z1] of SHAPE.light(o.c)) {
          const zz0 = f + z0, zz1 = f + z1;
          if (z0 === 36) {
            band(Rr, s, p0, p0 + 20, 0, 10, zz0, zz1, GLOWING(T), 'light window');
            band(Rr, s, p0 + 20, p1 - 20, 0, 10, zz0, zz1, { color: T.mould }, 'mullion');
            band(Rr, s, p1 - 20, p1, 0, 10, zz0, zz1, GLOWING(T), 'light window');
          } else band(Rr, s, p0, p1, 0, 10, zz0, zz1, GLOWING(T), 'light window');
        }
      }
      if (o.kind === 'view' && o.rail) {
        for (let p = o.c - 20; p <= o.c + 20; p += 20) bandPole(Rr, s, p, 10, f + 48, f + 72, 5, { color: T.mould }, 'window baluster');
        band(Rr, s, o.c - 30, o.c + 30, 5, 15, f + 72, f + 76, { color: T.trim }, 'window rail');
      }
    }
    if (!(f >= zb && f < zt)) return; // a band with no floor in it (gallery slab course) has no mouldings
    // pilasters, avoiding openings
    const [ia, ib] = runSpan(Rr, s, 0);
    // pilasters 8 studs either side of each cell's slot (openings sit at slot centres)
    const pils = [];
    const c0 = s === 'S' || s === 'N' ? Rr[0] : Rr[1], c1 = s === 'S' || s === 'N' ? Rr[2] : Rr[3];
    for (let q = c0; q < c1; q += CELL) for (const p of [q + 80, q + 320]) if (p - 20 >= ia + 20 && p + 20 <= ib - 20 && !openings.some(o => Math.abs(o.c - p) < 70)) pils.push(p);
    // the owner's pilaster design: a flared base of two ramp corners (two
    // bricks tall) and a capital of two inverted ones, sloping into the room
    // and away from the shaft
    const inward = { S: [0, 1], N: [0, -1], W: [1, 0], E: [-1, 0] }[s];
    const along = s === 'S' || s === 'N' ? [1, 0] : [0, 1];
    for (const p of pils) {
      for (const sg of [-1, 1]) {
        const out = [inward[0] + sg * along[0], inward[1] + sg * along[1]];
        const [q0, q1] = sg < 0 ? [p - 20, p] : [p, p + 20];
        flare(bandBox(Rr, s, q0, q1, W, W + 20), f, f + 24, out, false, { color: T.mould }, 'pilaster base');
        flare(bandBox(Rr, s, q0, q1, W, W + 20), f + 128, f + 140, out, true, { color: T.mould }, 'capital');
      }
      proud(Rr, s, p - 10, p + 10, 0, 10, f + 24, f + 128, { color: T.trim }, 'pilaster');
    }
    const doorsHere = openings.filter(o => o.kind === 'door');
    const winHere = openings.filter(o => o.kind !== 'door');
    // skirting and dado rail
    for (const [p0, p1] of minus(runSpan(Rr, s, 6), [...doorsHere.map(o => [o.c - 50, o.c + 50]), ...pils.map(p => [p - 20, p + 20])]))
      proud(Rr, s, p0, p1, 0, 6, f, f + 24, { color: T.mould }, 'skirting');
    for (const [p0, p1] of minus(runSpan(Rr, s, 4), [...doorsHere.map(o => [o.c - 50, o.c + 50]), ...winHere.map(o => [o.c - 40, o.c + 40]), ...pils.map(p => [p - 20, p + 20])]))
      proud(Rr, s, p0, p1, 0, 4, f + 60, f + 68, { color: T.mould }, 'dado rail');
    // cornice: two stepped courses, and a cap under a gallery above
    for (const [p0, p1] of [runSpan(Rr, s, 10)]) proud(Rr, s, p0, p1, 0, 10, f + 144, f + 156, { color: T.trim }, 'cornice');
    for (const [p0, p1] of [runSpan(Rr, s, 16)]) proud(Rr, s, p0, p1, 0, 16, f + 156, f + 168, { color: T.mould }, 'cornice');
    if (cap) for (const [p0, p1] of [runSpan(Rr, s, 16)]) proud(Rr, s, p0, p1, 0, 16, f + 168, f + 180, { color: T.trim }, 'gallery corbel');
    // door architraves and keystones; window sills and hoods
    for (const o of doorsHere) {
      proud(Rr, s, o.c - 50, o.c - 40, 0, 6, f, f + 84, { color: T.mould }, 'architrave');
      proud(Rr, s, o.c + 40, o.c + 50, 0, 6, f, f + 84, { color: T.mould }, 'architrave');
      proud(Rr, s, o.c - 10, o.c + 10, 0, 10, f + 108, f + 132, { color: T.mould }, 'keystone');
      proud(Rr, s, o.c - 40, o.c - 20, 0, 6, f + 96, f + 108, { color: T.trim }, 'voussoir');
      proud(Rr, s, o.c + 20, o.c + 40, 0, 6, f + 96, f + 108, { color: T.trim }, 'voussoir');
    }
    for (const o of winHere) {
      if (o.kind === 'light') proud(Rr, s, o.c - 40, o.c + 40, 0, 10, f + 28, f + 36, { color: T.mould }, 'sill');
      proud(Rr, s, o.c - 20, o.c + 20, 0, 6, f + 132, f + 140, { color: T.mould }, 'hood');
    }
  }
  /** plan rectangle [x0, y0, x1, y1] of a band piece (like band(), without placing it) */
  function bandBox([X0, Y0, X1, Y1], s, p0, p1, b0, b1) {
    if (s === 'S') return [p0, Y0 + b0, p1, Y0 + b1];
    if (s === 'N') return [p0, Y1 - b1, p1, Y1 - b0];
    if (s === 'W') return [X0 + b0, p0, X0 + b1, p1];
    return [X1 - b1, p0, X1 - b0, p1];
  }
  /**
   * A ramp corner filling plan rect r between z0 and z1, sloping down toward
   * the diagonal `out` ([±1, ±1]); inverted for capitals. Rotation (about +Z)
   * read off the owner's in-game pillar: rotation 1 slopes toward (-x, +y),
   * 2 toward (-x, -y), each step a quarter turn anticlockwise.
   */
  function flare([x0, y0, x1, y1], z0, z1, out, inverted, m, label) {
    const rotation = [[1, 1], [-1, 1], [-1, -1], [1, -1]].findIndex(([a, b]) => a === out[0] && b === out[1]);
    return B.add({ asset: inverted ? 'PB_DefaultRampCornerInverted' : 'PB_DefaultRampCorner', direction: 4, rotation, ...m,
      size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label);
  }
  function bandPole(Rr, s, p, b, z0, z1, r, m, label) {
    const [X0, Y0, X1, Y1] = Rr;
    const [x, y] = s === 'S' ? [p, Y0 + b] : s === 'N' ? [p, Y1 - b] : s === 'W' ? [X0 + b, p] : [X1 - b, p];
    return pole(x, y, z0, z1, r, m, label);
  }

  // ----------------------------------------------------------- floors --
  // top layer of a floor slab: border, checkerboard, diamond medallion at 20-unit resolution, merged
  function floorTop(Rr, z0, z1, medalR, pattern = 'checker') {
    const [X0, Y0, X1, Y1] = Rr, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
    const nx = (X1 - X0) / 20, ny = (Y1 - Y0) / 20;
    const col = (i, j) => {
      const x = X0 + i * 20 + 10, y = Y0 + j * 20 + 10;
      const edge = Math.min(x - X0, X1 - x, y - Y0, Y1 - y);
      if (edge < 60) return edge < 20 ? 'B' : edge < 40 ? 'M1' : 'B';
      const dd = Math.abs(x - cx) + Math.abs(y - cy);
      if (dd < medalR) { const ring = Math.floor(dd / 40) % 3; return 'M' + ring; }
      if (pattern === 'rings') return Math.floor(Math.max(Math.abs(x - cx), Math.abs(y - cy)) / 40) % 2 ? 'A' : 'C';
      if (pattern === 'stripes') return Math.floor((X1 - X0 >= Y1 - Y0 ? y - Y0 : x - X0) / 40) % 2 ? 'A' : 'C';
      if (pattern === 'diag') return (Math.floor((x - X0) / 20) + Math.floor((y - Y0) / 20)) % 4 < 2 ? 'A' : 'C';
      return (Math.floor((x - X0) / 40) + Math.floor((y - Y0) / 40)) % 2 ? 'A' : 'C';
    };
    const COL = { B: T.floor.border, A: T.floor.a, C: T.floor.b, M0: T.floor.medal[0], M1: T.floor.medal[1], M2: T.floor.medal[2] };
    const used = new Uint8Array(nx * ny);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        if (used[i * ny + j]) continue;
        const c = col(i, j);
        let w = 1;
        while (i + w < nx && w < 20 && !used[(i + w) * ny + j] && col(i + w, j) === c) w++;
        let h = 1;
        grow: while (j + h < ny && h < 20) {
          for (let a = 0; a < w; a++) if (used[(i + a) * ny + j + h] || col(i + a, j + h) !== c) break grow;
          h++;
        }
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) used[(i + a) * ny + j + b] = 1;
        box(X0 + i * 20, Y0 + j * 20, z0, X0 + (i + w) * 20, Y0 + (j + h) * 20, z1, { asset: 'PB_DefaultTile', color: COL[c] }, 'floor tile');
      }
  }
  /** coffered ceiling: beams below the slab on lines symmetric about the centre, a rosette in the middle */
  function coffers(Rr, zTop, avoid, rosette, mode = 'coffers') {
    const [X0, Y0, X1, Y1] = Rr, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
    // beams 2 studs wide on lines 4, 12, 20... studs either side of the centre, inside the cornice
    const ix0 = X0 + W + 20, ix1 = X1 - W - 20, iy0 = Y0 + W + 20, iy1 = Y1 - W - 20;
    const lines = (c, lo, hi) => { const out = []; for (let o = 40; c - o - 10 > lo || c + o + 10 < hi; o += 80) { if (c - o - 10 > lo) out.push(c - o); if (c + o + 10 < hi) out.push(c + o); } return out.sort((u, v) => u - v); };
    if (mode === 'beams') {
      // heavy beams two bricks deep across the short way, every 8 studs
      const alongY = X1 - X0 >= Y1 - Y0;
      for (const l of alongY ? lines(cx, ix0, ix1) : lines(cy, iy0, iy1)) {
        const cuts = avoid.filter(([a0, b0, a1, b1]) => (alongY ? l - 10 < a1 && a0 < l + 10 : l - 10 < b1 && b0 < l + 10)).map(([a0, b0, a1, b1]) => (alongY ? [b0 - 10, b1 + 10] : [a0 - 10, a1 + 10]));
        for (const [p0, p1] of minus(alongY ? [iy0, iy1] : [ix0, ix1], cuts))
          for (let q = p0; q < p1; q += 400) {
            const q1 = Math.min(p1, q + 400);
            if (alongY) box(l - 10, q, zTop - 24, l + 10, q1, zTop, { color: T.trim }, 'ceiling beam');
            else box(q, l - 10, zTop - 24, q1, l + 10, zTop, { color: T.trim }, 'ceiling beam');
          }
      }
      return;
    }
    const ys = lines(cy, iy0, iy1), xs = lines(cx, ix0, ix1);
    const clear = (x0, y0, x1, y1) => !avoid.some(([a0, b0, a1, b1]) => x0 < a1 && a0 < x1 && y0 < b1 && b0 < y1);
    for (const y of ys) for (const [p0, p1] of minus([ix0, ix1], avoid.filter(([, b0, , b1]) => y - 10 < b1 && b0 < y + 10).map(([a0, , a1]) => [a0 - 10, a1 + 10])))
      for (let q = p0; q < p1; q += 400) box(q, y - 10, zTop - 12, Math.min(p1, q + 400), y + 10, zTop, { color: T.trim }, 'coffer beam');
    for (const x of xs) {
      const cuts = [...ys.map(y => [y - 10, y + 10]), ...avoid.filter(([a0, , a1]) => x - 10 < a1 && a0 < x + 10).map(([, b0, , b1]) => [b0 - 10, b1 + 10])];
      for (const [p0, p1] of minus([iy0, iy1], cuts)) for (let q = p0; q < p1; q += 400) box(x - 10, q, zTop - 12, x + 10, Math.min(p1, q + 400), zTop, { color: T.trim }, 'coffer beam');
    }
    if (mode === 'lantern' && clear(cx - 30, cy - 30, cx + 30, cy + 30)) box(cx - 30, cy - 30, zTop - 4, cx + 30, cy + 30, zTop, GLOWING(T, 3), 'ceiling lantern');
    else if (rosette && clear(cx - 25, cy - 25, cx + 25, cy + 25)) {
      pole(cx, cy, zTop - 4, zTop, 25, { color: T.mould }, 'ceiling rosette');
    }
  }

  // ------------------------------------------------------------ rooms --
  const spawns = [];
  const rooms = [];
  let entranceSlot = null, entranceSide = null;
  const nodeRect = (n, k) => {
    if (n.startsWith('A')) { const a = atria.find(x => x.id === n); return [cellX(a.i), cellY(a.j), cellX(a.i + 2), cellY(a.j + 2)]; }
    if (rects.has(n)) { const [i0, j0, i1, j1] = rects.get(n); return [cellX(i0), cellY(j0), cellX(i1), cellY(j1)]; }
    const c = Number(n.split(':')[2]), i = Math.floor(c / GRID), j = c % GRID;
    return [cellX(i), cellY(j), cellX(i + 1), cellY(j + 1)];
  };
  // openings on one side of a node at floor k: one slot per cell edge along that side
  function sideOpenings(n, k, s, Rr, f) {
    const out = [];
    const cellsAlong = [];
    const [X0, Y0, X1, Y1] = Rr;
    const ci = x => Math.round((x - MARGIN) / CELL);
    if (s === 'S' || s === 'N') for (let x = X0; x < X1; x += CELL) cellsAlong.push([ci(x), ci(s === 'S' ? Y0 : Y1 - CELL), x + CELL / 2]);
    else for (let y = Y0; y < Y1; y += CELL) cellsAlong.push([ci(s === 'W' ? X0 : X1 - CELL), ci(y), y + CELL / 2]);
    cellsAlong.forEach(([i, j, c], slot) => {
      const [di, dj] = STEP[s];
      const other = nodeAt(k, i + di, j + dj);
      if (n.startsWith('A')) {
        const a = atria.find(x => x.id === n);
        if (blocked(a).some(([bk, bs, bslot]) => bk === k && bs === s && bslot === slot)) return;
      }
      if (other && other.startsWith('A') && !n.startsWith('A') && isBlocked(k, i + di, j + dj, OPP[s])) return; // the atrium's stair wall
      if (other && other !== n && hasDoor(k, i, j, s)) out.push({ c, kind: 'door' });
      else if (other && other !== n) {
        // a view window between neighbours; the node with the smaller id carries the rail
        out.push({ c, kind: 'view', rail: n < other });
      } else if (!other) out.push({ c, kind: 'light' });
    });
    return out;
  }

  const built = new Set();
  for (let k = 0; k < L; k++) {
    const { node, entrance } = floors[k];
    for (const n of new Set(node.filter(Boolean))) {
      if (built.has(n)) continue;
      built.add(n);
      const atrium = n.startsWith('A') ? atria.find(x => x.id === n) : null;
      const k0 = atrium ? atrium.k0 : k, k1 = atrium ? atrium.k1 : k;
      const Rr = nodeRect(n, k);
      const [X0, Y0, X1, Y1] = Rr, Z0 = k0 * STOREY, Z1 = (k1 + 1) * STOREY;
      const isEntrance = !atrium && entrance !== null && n === `r:${k}:${entrance}`;
      // the entrance stair: 15 steps along a side with no opening, up through the ceiling
      let stairSide = null, slot = null;
      if (isEntrance) {
        const opts = SIDES.filter(s => sideOpenings(n, k, s, Rr, Z0 + 12).every(o => o.kind === 'light'));
        stairSide = opts[0] ?? null;
        if (!stairSide) throw new Error('entrance room has no free wall for its stair');
        const [a] = sideSpan(Rr, stairSide);
        const start = (stairSide === 'S' || stairSide === 'N' ? X0 : Y0) + 40;
        slot = stairBox(Rr, stairSide, start, start + 300);
        entranceSlot = slot;
        entranceSide = stairSide;
        void a;
      }
      // this room's character: interior feature, floor pattern, ceiling
      const cellsIn = ((X1 - X0) / CELL) * ((Y1 - Y0) / CELL);
      const feature = atrium || isEntrance ? 'plain' : pickWeighted(cellsIn === 1
        ? { plain: 3, colonnade: 2.5, dais: 2, basin: 2.5 }
        : cellsIn === 2 ? { plain: 1.5, colonnade: 5, dais: 1.5, basin: 2 } : { colonnade: 5, dais: 3, basin: 2 });
      const pattern = atrium ? 'checker' : R.pick(['checker', 'rings', 'stripes', 'diag']);
      const ceiling = atrium ? 'coffers' : R.pick(['coffers', 'coffers', 'beams', 'lantern']);
      // floor slab and its patterned top
      slab(X0, Y0, Z0, X1, Y1, Z0 + 8, { color: T.base }, 'floor slab');
      floorTop(Rr, Z0 + 8, Z0 + 12, atrium || cellsIn === 4 ? 240 : 120, pattern);
      const inner = interior(feature, Rr, Z0 + 12);
      // ceiling slab (the top floor's is paved on top for the surface), coffers below
      const top = k1 === L - 1;
      const holes = slot ? [slot] : [];
      const oculus = atrium ? [(X0 + X1) / 2 - 80, (Y0 + Y1) / 2 - 80, (X0 + X1) / 2 + 80, (Y0 + Y1) / 2 + 80] : null;
      for (const [x0, y0, x1, y1] of rectMinus([X0, Y0, X1, Y1], [...holes, ...(oculus ? [oculus] : [])])) {
        slab(x0, y0, Z1 - 12, x1, y1, top ? Z1 - 4 : Z1, { color: T.trim }, 'ceiling');
        if (top) slab(x0, y0, Z1 - 4, x1, y1, Z1, { asset: 'PB_DefaultTile', color: T.plaza }, 'surface paving');
      }
      if (oculus) box(oculus[0], oculus[1], Z1 - 12, oculus[2], oculus[3], Z1, GLOWING(T, 3), 'oculus');
      coffers(Rr, Z1 - 12, holes.map(([x0, y0, x1, y1]) => [x0, y0, x1, y1]).concat(oculus ? [oculus] : [], inner.avoid), !atrium, ceiling);
      // walls, storey by storey
      for (let kk = k0; kk <= k1; kk++) {
        const f = kk * STOREY + 12;
        const zb = kk === k0 ? kk * STOREY + 12 : kk * STOREY;
        const zt = kk === k1 ? (kk + 1) * STOREY - 12 : (kk + 1) * STOREY;
        for (const s of SIDES) {
          let open = sideOpenings(n, kk, s, Rr, f);
          if (s === stairSide) open = [];
          wallStorey(Rr, s, zb, zt, f, open, { cap: kk < k1 });
        }
      }
      if (atrium) galleries(atrium, Rr);
      // spawn spots: room centres (offset off the medallion), the atrium floor
      if (!isEntrance) {
        spawns.push({ at: inner.spots[0], spots: inner.spots, level: k0, node: n, area: (X1 - X0) * (Y1 - Y0) });
      }
      if (isEntrance) entranceStairs(Rr, stairSide, Z0 + 12, Z1);
      rooms.push({ n, rect: Rr, z: Z0 + 12, k: k0, atrium: !!atrium, entrance: isEntrance, feature, pattern, ceiling });
    }
  }

  function pickWeighted(w) {
    let t = R() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [key, v] of Object.entries(w)) if ((t -= v) < 0) return key;
    return Object.keys(w)[0];
  }

  /**
   * A room's interior feature on floor top f. Returns ceiling areas the
   * coffers must avoid and three spawner spots (the first is the room's own).
   */
  function interior(feature, Rr, f) {
    const [X0, Y0, X1, Y1] = Rr, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
    const hx = (X1 - X0) / 2 - W, hy = (Y1 - Y0) / 2 - W; // half the clear floor
    const avoid = [];
    // default spots: just off the medallion, clear of any piers
    let spots = [[cx + 60, cy, f + 2], [cx - 60, cy, f + 2], [cx, cy + 80, f + 2]];
    if (feature === 'colonnade') {
      // a pier 10 studs either side of every cell centre, after the owner's
      // pilaster: square shaft, base and capital of four ramp corners flaring
      // out on every side, an impost block carrying the ceiling
      for (let x = X0 + CELL / 2; x < X1; x += CELL)
        for (let y = Y0 + CELL / 2; y < Y1; y += CELL)
          for (const [px, py] of [[x - 100, y - 100], [x + 100, y - 100], [x - 100, y + 100], [x + 100, y + 100]]) {
            for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
              const r = [Math.min(px, px + 30 * sx), Math.min(py, py + 30 * sy), Math.max(px, px + 30 * sx), Math.max(py, py + 30 * sy)];
              flare(r, f, f + 24, [sx, sy], false, { color: T.mould }, 'pier base');
              flare(r, f + 132, f + 144, [sx, sy], true, { color: T.mould }, 'pier capital');
            }
            box(px - 20, py - 20, f + 24, px + 20, py + 20, f + 132, { color: T.trim }, 'pier');
            box(px - 20, py - 20, f + 144, px + 20, py + 20, f + 168, { color: T.trim }, 'pier impost');
            avoid.push([px - 30, py - 30, px + 30, py + 30]);
          }
    } else if (feature === 'dais') {
      // three tiers of two plates, 6 studs in from the walls then 4 more per tier
      const tx = hx - 60, ty = hy - 60;
      for (let t = 0; t < 3; t++)
        slab(cx - tx + 40 * t, cy - ty + 40 * t, f + 8 * t, cx + tx - 40 * t, cy + ty - 40 * t, f + 8 * (t + 1), { color: t === 1 ? T.trim : T.mould }, 'dais');
      // on top, and on the floor either side across the short way
      spots = tx >= ty
        ? [[cx, cy, f + 26], [cx, cy - ty - 28, f + 2], [cx, cy + ty + 28, f + 2]]
        : [[cx, cy, f + 26], [cx - tx - 28, cy, f + 2], [cx + tx + 28, cy, f + 2]];
    } else if (feature === 'basin') {
      // a pool: a two-brick curb round still water, a lit spout in a great hall
      const bx = hx - 80, by = hy - 80;
      const curb = { color: T.mould };
      slab(cx - bx, cy - by, f, cx + bx, cy - by + 20, f + 24, curb, 'basin curb');
      slab(cx - bx, cy + by - 20, f, cx + bx, cy + by, f + 24, curb, 'basin curb');
      slab(cx - bx, cy - by + 20, f, cx - bx + 20, cy + by - 20, f + 24, curb, 'basin curb');
      slab(cx + bx - 20, cy - by + 20, f, cx + bx, cy + by - 20, f + 24, curb, 'basin curb');
      slab(cx - bx + 20, cy - by + 20, f, cx + bx - 20, cy + by - 20, f + 16, { color: [70, 120, 150], material: 'BMC_Glass' }, 'basin water');
      if (bx >= 200 && by >= 200) {
        pole(cx, cy, f + 16, f + 72, 20, { color: T.trim }, 'basin spout');
        pole(cx, cy, f + 72, f + 84, 25, GLOWING(T, 5), 'basin spout light');
      }
      spots = [[cx + bx + 40, cy, f + 2], [cx - bx - 40, cy, f + 2], [cx, cy + by + 40, f + 2]];
    }
    return { avoid, spots };
  }

  // stair footprint along side s, from p0 to p1 along it, 40..100 off the wall
  function stairBox(Rr, s, p0, p1) {
    const [X0, Y0, X1, Y1] = Rr;
    if (s === 'S') return [p0, Y0 + 40, p1, Y0 + 100];
    if (s === 'N') return [p0, Y1 - 100, p1, Y1 - 40];
    if (s === 'W') return [X0 + 40, p0, X0 + 100, p1];
    return [X1 - 100, p0, X1 - 40, p1];
  }
  function entranceStairs(Rr, s, f, top) {
    const [x0, y0, x1, y1] = stairBox(Rr, s, (s === 'S' || s === 'N' ? Rr[0] : Rr[1]) + 40, (s === 'S' || s === 'N' ? Rr[0] : Rr[1]) + 340);
    const n = (top - f) / 12;
    for (let i = 0; i < n; i++) {
      if (s === 'S' || s === 'N') box(x0 + 20 * i, y0, f, x0 + 20 * (i + 1), y1, f + 12 * (i + 1), { color: i % 2 ? T.trim : T.mould }, 'entrance stair');
      else box(x0, y0 + 20 * i, f, x1, y0 + 20 * (i + 1), f + 12 * (i + 1), { color: i % 2 ? T.trim : T.mould }, 'entrance stair');
    }
  }
  function rectMinus(r, holes) {
    // split rectangle r into pieces avoiding the holes (holes inside r)
    let pieces = [r];
    for (const h of holes) {
      const next = [];
      for (const [x0, y0, x1, y1] of pieces) {
        if (h[0] >= x1 || h[2] <= x0 || h[1] >= y1 || h[3] <= y0) { next.push([x0, y0, x1, y1]); continue; }
        if (h[0] > x0) next.push([x0, y0, h[0], y1]);
        if (h[2] < x1) next.push([h[2], y0, x1, y1]);
        const mx0 = Math.max(x0, h[0]), mx1 = Math.min(x1, h[2]);
        if (h[1] > y0) next.push([mx0, y0, mx1, h[1]]);
        if (h[3] < y1) next.push([mx0, h[3], mx1, y1]);
      }
      pieces = next;
    }
    return pieces;
  }

  // ------------------------------------------------------- galleries --
  // ring ledges 100 deep at each upper floor of an atrium, balustrades on the
  // inner edge, and the two staircases (W wall up to k0+1, S wall up to k0+2)
  function galleries(a, Rr) {
    const [X0, Y0, X1, Y1] = Rr;
    const flight1 = [X0 + 40, Y0 + 120, X0 + 100, Y0 + 440]; // W wall, rising +y
    const flight2 = [X0 + 120, Y0 + 40, X0 + 440, Y0 + 100]; // S wall, rising -x
    for (let k = a.k0 + 1; k <= a.k1; k++) {
      const z = k * STOREY;
      const ring = [
        { r: [X0 + W, Y0 + W, X1 - W, Y0 + 120], edge: 'S' },
        { r: [X0 + W, Y1 - 120, X1 - W, Y1 - W], edge: 'N' },
        { r: [X0 + W, Y0 + 120, X0 + 120, Y1 - 120], edge: 'W' },
        { r: [X1 - 120, Y0 + 120, X1 - W, Y1 - 120], edge: 'E' },
      ];
      const omit = k === a.k0 + 1 ? [X0 + W, Y0 + 120, X0 + 120, Y0 + 440] : k === a.k0 + 2 ? [X0 + 120, Y0 + W, X0 + 440, Y0 + 120] : null;
      for (const { r } of ring) for (const [x0, y0, x1, y1] of rectMinus(r, omit ? [omit] : [])) slab(x0, y0, z, x1, y1, z + 12, { color: T.trim }, 'gallery');
      // balustrades along the inner edges, skipping the stair openings
      const rail = (x0, y0, x1, y1, alongX) => {
        const len = alongX ? x1 - x0 : y1 - y0;
        for (let p = 10; p < len; p += 20) pole(alongX ? x0 + p : (x0 + x1) / 2, alongX ? (y0 + y1) / 2 : y0 + p, z + 12, z + 36, 5, { color: T.mould }, 'baluster');
        box(x0, y0, z + 36, x1, y1, z + 40, { color: T.trim }, 'handrail');
      };
      const edges = [
        [X0 + 120, Y0 + 110, X1 - 120, Y0 + 120, true],
        [X0 + 120, Y1 - 120, X1 - 120, Y1 - 110, true],
        [X0 + 110, Y0 + 120, X0 + 120, Y1 - 120, false],
        [X1 - 120, Y0 + 120, X1 - 110, Y1 - 120, false],
      ];
      for (const [x0, y0, x1, y1, alongX] of edges) {
        const cut = omit && (alongX ? [omit[0], omit[2]] : [omit[1], omit[3]]);
        const overlaps = omit && x0 < omit[2] && omit[0] < x1 && y0 < omit[3] && omit[1] < y1 + 1;
        const segs = cut && overlaps ? minus(alongX ? [x0, x1] : [y0, y1], [cut]) : [alongX ? [x0, x1] : [y0, y1]];
        for (const [p0, p1] of segs) if (p1 - p0 >= 40) rail(alongX ? p0 : x0, alongX ? y0 : p0, alongX ? p1 : x1, alongX ? y1 : p1, alongX);
      }
    }
    // flight 1: atrium floor -> gallery k0+1, along the W wall, rising toward +y
    const f0 = a.k0 * STOREY + 12;
    for (let i = 0; i < 16; i++) box(flight1[0], flight1[1] + 20 * i, f0, flight1[2], flight1[1] + 20 * (i + 1), f0 + 12 * (i + 1), { color: i % 2 ? T.trim : T.mould }, 'grand stair');
    // flight 2: gallery k0+1 -> gallery k0+2, along the S wall, rising toward -x
    const f1 = (a.k0 + 1) * STOREY + 12;
    for (let i = 0; i < 16; i++) box(flight2[2] - 20 * (i + 1), flight2[1], f1, flight2[2] - 20 * i, flight2[3], f1 + 12 * (i + 1), { color: i % 2 ? T.trim : T.mould }, 'grand stair');
  }

  // ------------------------------------------------------------- rock --
  // every cell no room uses, per floor (merged up to three floors), the margin
  // ring, all capped with surface paving on top
  const top = L * STOREY;
  const solid = (x0, y0, z0, x1, y1, z1) => {
    for (let z = z0; z < z1; z += 576) {
      const zz = Math.min(z1, z + 576);
      const capped = zz === top;
      slab(x0, y0, z, x1, y1, capped ? zz - 12 : zz, { color: T.rock }, 'rock');
      if (capped) slab(x0, y0, zz - 12, x1, y1, zz, { asset: 'PB_DefaultTile', color: T.plaza }, 'surface paving');
    }
  };
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      let k = 0;
      while (k < L) {
        if (floors[k].node[i * GRID + j]) { k++; continue; }
        let k2 = k;
        while (k2 + 1 < L && !floors[k2 + 1].node[i * GRID + j]) k2++;
        solid(cellX(i), cellY(j), k * STOREY, cellX(i + 1), cellY(j + 1), (k2 + 1) * STOREY);
        k = k2 + 1;
      }
    }
  for (const [x0, y0, x1, y1] of [[0, 0, SIZE, MARGIN], [0, SIZE - MARGIN, SIZE, SIZE], [0, MARGIN, MARGIN, SIZE - MARGIN], [SIZE - MARGIN, MARGIN, SIZE, SIZE - MARGIN]])
    solid(x0, y0, 0, x1, y1, top);

  // nothing on the surface: the map buries the dungeon and cuts a trench down
  // to the entrance stairwell (which rises toward +x on an S/N wall, +y on W/E)

  // spawners: a share of rooms, three in the deepest floor's biggest room
  const chosen = [];
  const deepest = spawns.filter(sp => sp.level === 0).sort((u, v) => v.area - u.area)[0];
  for (const sp of spawns) {
    if (sp === deepest) for (const at of sp.spots) chosen.push({ at, level: sp.level });
    else if (R() < spawnChance) chosen.push({ at: sp.at, level: sp.level });
  }
  return { bricks: B.bricks, dropped: B.dropped, spawns: chosen, entrance: entranceSlot, entranceSide, atria, floors, rooms };
}

function GLOWING(T, intensity = 4) { return { color: T.glow, material: 'BMC_Glow', material_intensity: intensity }; }
