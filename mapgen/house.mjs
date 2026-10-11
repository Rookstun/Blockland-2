// An intricate manor on a fenced lot, built from plain bricks.
//
// buildHouse() returns bricks in lot-local game units: x/y from the lot
// centre, z = 0 on the lot's grass/path surface. The front faces +x.
// Every brick goes through an overlap guard (the game rejects overlapping
// bricks); anything the guard refuses is listed in `dropped`.
//
// Units: stud 10, brick 12, plate 4. Procedural sizes stay on the grid:
// lengths in multiples of 10, heights in multiples of 4; thin trim uses
// micro bricks, which only need whole half-extents.
//
//   lot        x, y in [-500, 500]; picket fence on the edge, gate at the front
//   house      main block x [-200, 160] y [-280, 280]; floors at z 24 and 152
//   porch      x [160, 280] y [-170, 170]; its roof is the balcony
//   tower      x [0, 140] y [-420, -280]; three storeys, battlements, a spire
//   chimney    x [-100, -40] y [300, 360], outside the right gable

import { orientFor, worldBox } from './orient.mjs';

const C = {
  stone: [[128, 124, 118], [116, 112, 108], [138, 132, 124], [122, 118, 110]],
  quoin: [[198, 192, 178], [186, 180, 166]],
  footing: [96, 92, 88],
  timber: [64, 44, 30],
  timber2: [88, 60, 40],
  plaster: [238, 230, 212],
  roof: [[92, 52, 44], [104, 60, 50], [82, 46, 40]],
  ridge: [60, 36, 30],
  floor: [[150, 104, 64], [136, 92, 56]],
  deck: [[160, 120, 80], [146, 108, 70]],
  shutter: [46, 92, 70],
  glass: [176, 214, 232],
  grass: [[92, 150, 62], [84, 140, 56]],
  path: [[170, 164, 150], [150, 146, 134]],
  soil: [96, 70, 48],
  hedge: [52, 108, 46],
  leaf: [[58, 120, 48], [70, 134, 54]],
  bark: [92, 64, 40],
  cloth: [[200, 60, 60], [60, 110, 190], [230, 190, 60], [240, 240, 236], [120, 170, 90]],
  flowers: [[230, 60, 80], [250, 200, 60], [180, 90, 210], [250, 140, 60], [240, 240, 250]],
  books: [[150, 40, 40], [40, 80, 140], [50, 110, 60], [160, 120, 40], [90, 50, 110], [180, 160, 130]],
  metal: [50, 48, 46],
  brass: [200, 160, 70],
};
const GLASS = { color: C.glass, material: 'BMC_Glass' };
const GLOW = (color, i = 5) => ({ color, material: 'BMC_Glow', material_intensity: i });
const TIMBER = { color: C.timber };
// fixed-size assets, half extents (Omegga's brickSizeMap)
const FIXED = {
  B_SpawnPoint: [20, 20, 2], B_1x1_Round: [5, 5, 6], B_2x2_Round: [10, 10, 6], B_4x4_Round: [20, 20, 6],
  B_1x1_Cone: [5, 5, 6], B_Jar: [9, 9, 12], B_Cauldron: [10, 10, 10], B_Chalice: [5, 5, 10], B_Flame: [5, 5, 10],
  B_Flower: [10, 10, 2], B_Small_Flower: [5, 5, 2], B_Fern: [10, 10, 2], B_Pumpkin: [10, 10, 7],
};

export const FLOOR = 24;   // ground floor height above the lot
const STOREY = 120;        // 10 bricks floor to floor
const G0 = FLOOR, G1 = FLOOR + STOREY;   // ground floor walls 24..144
const U0 = G1, U1 = G1 + STOREY;         // upper floor walls 144..264
const BOARD0 = FLOOR - 8;                // floorboards 16..24 on the footing
const S1 = G1 + 8;                       // upper floor top (slab 144..152)

export function buildHouse({ seed = 1 } = {}) {
  let rs = seed >>> 0;
  const rnd = () => ((rs = (Math.imul(rs ^ (rs >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
  const pick = list => list[Math.floor(rnd() * list.length)];

  // ------------------------------------------------------- overlap guard --
  const bricks = [], boxes = [], grid = new Map(), dropped = [];
  const G = 100;
  const cellsOf = ([lo, hi]) => {
    const out = [];
    for (let gx = Math.floor(lo[0] / G); gx <= Math.floor((hi[0] - 1) / G); gx++)
      for (let gy = Math.floor(lo[1] / G); gy <= Math.floor((hi[1] - 1) / G); gy++) out.push(gx + ',' + gy);
    return out;
  };
  function add(b, label = '') {
    const bx = worldBox(b, FIXED);
    const [lo, hi] = bx;
    if (lo.some((v, i) => v >= hi[i])) throw new Error(`empty brick ${label} ${JSON.stringify(b)}`);
    for (const k of cellsOf(bx))
      for (const j of grid.get(k) ?? []) {
        const [a0, a1] = boxes[j];
        if ([0, 1, 2].every(i => lo[i] < a1[i] && a0[i] < hi[i])) {
          dropped.push(`${label} ${JSON.stringify(bx)} hits ${bricks[j].label} ${JSON.stringify(boxes[j])}`);
          return false;
        }
      }
    const i = bricks.push({ ...b, label }) - 1;
    boxes.push(bx);
    for (const k of cellsOf(bx)) (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
    return true;
  }
  /** axis-aligned box from two corners; a micro brick when off the stud/plate grid */
  function box(x0, y0, z0, x1, y1, z1, m, label) {
    const b = { ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] };
    const offGrid = [x1 - x0, y1 - y0].some(v => v % 10) || (z1 - z0) % 4;
    if (!b.asset && offGrid) b.asset = 'PB_DefaultMicroBrick';
    if (b.size.some(v => !Number.isInteger(v)) || b.position.some(v => !Number.isInteger(v))) throw new Error(`off-grid ${label} ${JSON.stringify(b)}`);
    return add(b, label);
  }
  const pole = (x, y, z0, z1, r, m, label) => add({ asset: 'PB_DefaultPole', ...m, size: [r, r, (z1 - z0) / 2], position: [x, y, (z0 + z1) / 2] }, label);
  const asset = (name, x, y, z, m, label) => add({ asset: name, size: [0, 0, 0], ...m, position: [x, y, z] }, label);
  function wedge(x0, y0, z0, x1, y1, z1, dx, dy, m, label) {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    return add({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext), ...m, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label);
  }
  /** a rectangle in alternating strips (floorboards, decking); strips run along x if alongX */
  function strips(x0, y0, x1, y1, z0, z1, alongX, width, colors, label) {
    for (let p = alongX ? y0 : x0, k = 0; p < (alongX ? y1 : x1); p += width, k++) {
      const q = Math.min(p + width, alongX ? y1 : x1);
      const m = { color: colors[k % colors.length] };
      if (alongX) box(x0, p, z0, x1, q, z1, m, label); else box(p, y0, z0, q, y1, z1, m, label);
    }
  }
  // A wall is a band [c0, c1] across its axis, running a..b along it:
  // axis 'x' runs along x (band in y), 'y' runs along y (band in x).
  const wallBox = (axis, c0, c1, p0, p1, z0, z1, m, label) =>
    axis === 'x' ? box(p0, c0, z0, p1, c1, z1, m, label) : box(c0, p0, z0, c1, p1, z1, m, label);

  // ------------------------------------------------------------- walls --
  /** coursed stone, 1-brick courses with staggered joints and light quoins at free ends */
  function masonry(axis, c0, c1, a, b, z0, z1, openings, label, quoins = [true, true]) {
    for (let z = z0, course = 0; z < z1; z += 12, course++) {
      const holes = openings.filter(o => o.z0 <= z && o.z1 >= z + 12).sort((u, v) => u.p0 - v.p0);
      const runs = [];
      let p = a;
      for (const h of holes) { if (h.p0 > p) runs.push([p, h.p0]); p = Math.max(p, h.p1); }
      if (p < b) runs.push([p, b]);
      for (const [r0, r1] of runs) {
        let q = r0, first = course % 2 ? 30 : 50;
        while (q < r1) {
          let len = first || pick([40, 50, 60, 40, 30]);
          first = 0;
          if (r1 - (q + len) < 30) len = r1 - q; // no slivers at the end of a run
          const e = q + len;
          const atEnd = (q === a && quoins[0]) || (e === b && quoins[1]);
          wallBox(axis, c0, c1, q, e, z, z + 12, { color: atEnd ? C.quoin[course % 2] : pick(C.stone) }, label);
          q = e;
        }
      }
    }
  }
  /** a stone base course under a wall band, from the boards' bottom to the floor, minus doorways */
  function baseCourse(axis, c0, c1, a, b, doors, label) {
    let p = a;
    for (const [d0, d1] of [...doors].sort((u, v) => u[0] - v[0])) {
      if (d0 > p) wallBox(axis, c0, c1, p, d0, BOARD0, FLOOR, { color: C.footing }, label);
      wallBox(axis, c0, c1, d0, d1, BOARD0, FLOOR, { color: C.quoin[0] }, label + ' threshold');
      p = d1;
    }
    if (p < b) wallBox(axis, c0, c1, p, b, BOARD0, FLOOR, { color: C.footing }, label);
  }
  /** mullioned stone window: two panes and a transom, a sill and lintel sticking out a stud */
  function stoneWindow(axis, c0, c1, outer, cm, zb, h, label) {
    const w0 = cm - 30, w1 = cm + 30, mid = (c0 + c1) / 2;
    const [g0, g1] = outer > 0 ? [c0, mid] : [mid, c1]; // glass in the inner half: a deep reveal
    const lower = 36;
    for (const [p0, p1] of [[w0, w0 + 20], [w1 - 20, w1]]) {
      wallBox(axis, g0, g1, p0, p1, zb, zb + lower, GLASS, label + ' glass');
      wallBox(axis, g0, g1, p0, p1, zb + lower, zb + lower + 4, TIMBER, label + ' transom');
      wallBox(axis, g0, g1, p0, p1, zb + lower + 4, zb + h, GLASS, label + ' glass');
    }
    wallBox(axis, g0, g1, w0 + 20, w1 - 20, zb, zb + h, TIMBER, label + ' mullion');
    const s0 = outer > 0 ? c1 : c0 - 10, s1 = outer > 0 ? c1 + 10 : c0;
    wallBox(axis, s0, s1, w0 - 10, w1 + 10, zb - 8, zb, { color: C.quoin[0] }, label + ' sill');
    wallBox(axis, s0, s1, w0 - 10, w1 + 10, zb + h, zb + h + 12, { color: C.quoin[1] }, label + ' lintel');
  }
  /**
   * Timber framing over recessed plaster. A sill beam and top plate span the
   * whole band; posts stand at the ends and either side of every opening;
   * plaster fills the inner half of the band, so posts and frames stand
   * proud. Plain bays get a mid rail. Windows: two panes and a mullion in the
   * plaster plane, a frame in the outer plane, shutters and maybe a flower box
   * outside. `outer` = +1 when the band's outside face is c1.
   * openings: [{ cm, kind: 'window' | 'door' }], centres on the 10 grid and
   * 100 apart (a shared post) or at least 120 apart.
   */
  function timberWall(axis, c0, c1, outer, a, b, z0, z1, openings, label, { flowerBoxes = false } = {}) {
    const mid = (c0 + c1) / 2;
    const [inA, inB] = outer > 0 ? [c0, mid] : [mid, c1];
    const [outA, outB] = outer > 0 ? [mid, c1] : [c0, mid];
    const [f0, f1] = outer > 0 ? [c1, c1 + 4] : [c0 - 4, c0];       // shutters
    const [k0, k1] = outer > 0 ? [c1, c1 + 16] : [c0 - 16, c0];     // flower boxes
    wallBox(axis, c0, c1, a, b, z0, z0 + 12, TIMBER, label + ' sill beam');
    wallBox(axis, c0, c1, a, b, z1 - 12, z1, TIMBER, label + ' top plate');
    const zA = z0 + 12, zB = z1 - 12;
    const posts = new Set([a, b - 20]);
    for (const o of openings) { posts.add(o.cm - 60); posts.add(o.cm + 40); }
    const list = [...posts].sort((u, v) => u - v);
    for (const p of list) wallBox(axis, c0, c1, p, p + 20, zA, zB, TIMBER, label + ' post');
    for (let i = 0; i + 1 < list.length; i++) {
      const p0 = list[i] + 20, p1 = list[i + 1];
      if (p1 <= p0) continue;
      const o = openings.find(oo => oo.cm - 40 === p0 && oo.cm + 40 === p1);
      if (!o) {
        wallBox(axis, inA, inB, p0, p1, zA, zB, { color: C.plaster }, label + ' panel');
        const zr = Math.round((zA + zB) / 8) * 4;
        wallBox(axis, outA, outB, p0, p1, zr - 4, zr + 4, { color: C.timber2 }, label + ' rail');
        continue;
      }
      const w0 = o.cm - 30, w1 = o.cm + 30;
      const door = o.kind === 'door';
      const wb = door ? zA : zA + 36, wt = zA + 84;
      // plaster round the opening
      wallBox(axis, inA, inB, p0, w0, zA, zB, { color: C.plaster }, label + ' panel');
      wallBox(axis, inA, inB, w1, p1, zA, zB, { color: C.plaster }, label + ' panel');
      if (wb > zA) wallBox(axis, inA, inB, w0, w1, zA, wb, { color: C.plaster }, label + ' panel');
      wallBox(axis, inA, inB, w0, w1, wt, zB, { color: C.plaster }, label + ' panel');
      // frame in the outer plane (inside the bay, which is 10 wider each side)
      wallBox(axis, outA, outB, p0, w0, wb, wt + 8, TIMBER, label + ' jamb');
      wallBox(axis, outA, outB, w1, p1, wb, wt + 8, TIMBER, label + ' jamb');
      wallBox(axis, outA, outB, w0, w1, wt, wt + 8, TIMBER, label + ' head');
      if (door) continue;
      wallBox(axis, outA, outB, w0, w1, wb - 8, wb, TIMBER, label + ' sill');
      wallBox(axis, inA, inB, w0, w0 + 20, wb, wt, GLASS, label + ' glass');
      wallBox(axis, inA, inB, w0 + 20, w1 - 20, wb, wt, TIMBER, label + ' mullion');
      wallBox(axis, inA, inB, w1 - 20, w1, wb, wt, GLASS, label + ' glass');
      // shutters, except where a neighbouring opening is too close to fit them
      const near = d => openings.some(oo => oo !== o && Math.sign(oo.cm - o.cm) === d && Math.abs(oo.cm - o.cm) < 130);
      if (!near(-1)) wallBox(axis, f0, f1, o.cm - 64, o.cm - 40, wb, wt, { color: C.shutter }, label + ' shutter');
      if (!near(1)) wallBox(axis, f0, f1, o.cm + 40, o.cm + 64, wb, wt, { color: C.shutter }, label + ' shutter');
      if (flowerBoxes) {
        wallBox(axis, k0, k1, w0 - 6, w1 + 6, wb - 24, wb - 8, { color: C.timber2 }, label + ' flower box');
        const kc = (k0 + k1) / 2;
        for (let f = 0; f < 4; f++) {
          const fp = w0 + 4 + f * 16;
          wallBox(axis, kc - 4, kc + 4, fp - 4, fp + 4, wb - 8, wb + 2, { asset: 'PB_DefaultMicroBrick', color: pick(C.flowers) }, label + ' flower');
        }
      }
    }
  }
  /** plaster partition with doorways [[g0, g1]] (96 high downstairs, 88 up) */
  function partition(axis, c0, c1, a, b, z0, z1, gaps, label, gh = 96) {
    let p = a;
    for (const [g0, g1] of gaps) {
      if (g0 > p) wallBox(axis, c0, c1, p, g0, z0, z1, { color: C.plaster }, label);
      wallBox(axis, c0, c1, g0, g1, z0 + gh, z1, { color: C.plaster }, label + ' over door');
      p = g1;
    }
    if (p < b) wallBox(axis, c0, c1, p, b, z0, z1, { color: C.plaster }, label);
  }

  // ------------------------------------------------------- the surface --
  // 10-unit raster: grass, the path, flower beds, the vegetable plot and the
  // well yard; cells under the house, porch, tower, chimney and steps are left
  // for their footings.
  const R = 10, N = 100;
  const kind = new Array(N * N).fill('grass');
  const area = (x0, y0, x1, y1, k) => {
    for (let i = (x0 + 500) / R; i < (x1 + 500) / R; i++) for (let j = (y0 + 500) / R; j < (y1 + 500) / R; j++) kind[i * N + j] = k;
  };
  area(320, -40, 500, 40, 'path');
  area(-500, -40, -200, 40, 'path');
  area(180, -300, 260, -180, 'bed');
  area(180, 180, 260, 300, 'bed');
  area(-440, 100, -300, 400, 'soil');
  area(-440, -400, -280, -120, 'gravel');
  area(-200, -280, 160, 280, 'house');
  area(160, -170, 280, 170, 'house');
  area(0, -420, 140, -280, 'house');
  area(-100, 300, -40, 360, 'house');
  area(280, -40, 320, 40, 'house');
  const used = new Uint8Array(N * N);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const k = kind[i * N + j];
      if (used[i * N + j] || k === 'house') continue;
      let w = 1;
      while (i + w < N && w < 20 && kind[(i + w) * N + j] === k && !used[(i + w) * N + j]) w++;
      let h = 1;
      grow: while (j + h < N && h < 20) {
        for (let a = 0; a < w; a++) if (kind[(i + a) * N + j + h] !== k || used[(i + a) * N + j + h]) break grow;
        h++;
      }
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) used[(i + a) * N + j + b] = 1;
      const x0 = i * R - 500, y0 = j * R - 500;
      const color = k === 'grass' ? C.grass[((i >> 1) + (j >> 1)) % 2] : k === 'path' ? C.path[((i >> 1) + (j >> 1)) % 2] : k === 'gravel' ? [128, 122, 114] : C.soil;
      box(x0, y0, -4, x0 + w * R, y0 + h * R, 0, { color, ...(k === 'path' || k === 'gravel' ? { asset: 'PB_DefaultTile' } : {}) }, 'surface ' + k);
    }

  // ---------------------------------------------------------- footings --
  box(-200, -280, -4, 160, 280, BOARD0, { color: C.footing }, 'footing');
  box(160, -170, -4, 280, 170, BOARD0, { color: C.footing }, 'porch footing');
  box(0, -420, -4, 140, -280, BOARD0, { color: C.footing }, 'tower footing');
  box(-100, 300, -4, -40, 360, FLOOR, { color: C.footing }, 'chimney footing');
  box(300, -40, -4, 320, 40, 12, { color: C.quoin[1] }, 'step');
  box(280, -40, -4, 300, 40, FLOOR, { color: C.quoin[0] }, 'step');

  // ------------------------------------------------------------- floors --
  strips(-180, -260, 140, 260, BOARD0, FLOOR, true, 20, C.floor, 'floorboards');
  strips(160, -170, 280, 170, BOARD0, FLOOR, false, 20, C.deck, 'porch deck');
  strips(20, -400, 120, -300, BOARD0, FLOOR, false, 20, C.floor, 'tower floor');

  // ------------------------------------------------- ground floor walls --
  const door = (p0, p1, h = 96) => ({ p0, p1, z0: G0, z1: G0 + h });
  const win = cm => ({ p0: cm - 30, p1: cm + 30, z0: G0 + 36, z1: G0 + 96, cm });
  const walls = [
    // [axis, c0, c1, outer, a, b, openings, quoins, label]
    ['y', 140, 160, +1, -280, 280, [door(-30, 30), win(-210), win(-110), win(110), win(210)], [true, true], 'front wall'],
    ['y', -200, -180, -1, -280, 280, [door(-30, 30), win(-200), win(-110), win(120), win(210)], [true, true], 'back wall'],
    ['x', -280, -260, -1, -180, 140, [win(-130), win(-50), door(40, 80)], [false, false], 'left wall'],
    ['x', 260, 280, +1, -180, 140, [win(-150), win(20), win(100)], [false, false], 'right wall'],
  ];
  for (const [axis, c0, c1, outer, a, b, open, q, label] of walls) {
    baseCourse(axis, c0, c1, a, b, open.filter(o => o.z0 === G0).map(o => [o.p0, o.p1]), label + ' base');
    masonry(axis, c0, c1, a, b, G0, G1, open, label, q);
    for (const o of open) if (o.cm !== undefined) stoneWindow(axis, c0, c1, outer, o.cm, o.z0, 60, label + ' window');
  }
  // front door surround: pilasters, lintel, lanterns; the door stands open
  box(160, -50, G0, 170, -30, G0 + 108, { color: C.quoin[0] }, 'pilaster');
  box(160, 30, G0, 170, 50, G0 + 108, { color: C.quoin[0] }, 'pilaster');
  box(160, -60, G0 + 108, 170, 60, G0 + 120, { color: C.quoin[1] }, 'door pediment');
  box(160, -60, G0 + 60, 170, -50, G0 + 72, GLOW([255, 196, 110], 6), 'door lantern');
  box(160, 50, G0 + 60, 170, 60, G0 + 72, GLOW([255, 196, 110], 6), 'door lantern');
  box(80, -30, FLOOR, 140, -26, G0 + 96, { color: [110, 60, 36] }, 'front door');
  box(-180, -30, FLOOR, -120, -26, G0 + 96, { color: [110, 60, 36] }, 'back door');

  // partitions: the hall runs front to back between y -60 and 60
  partition('x', -70, -60, -180, 140, FLOOR, G1, [[-120, -80], [60, 100]], 'hall wall left');
  partition('x', 60, 70, -180, 140, FLOOR, G1, [[-140, -100], [0, 40]], 'hall wall right');
  partition('y', -30, -20, -260, -70, FLOOR, G1, [], 'kitchen wall');
  partition('y', -30, -20, 70, 260, FLOOR, G1, [], 'study wall');

  // ceiling beams under the upper floor, spanning each room
  const beams = (x0, y0, x1, y1) => { for (let x = x0 + 40; x + 10 <= x1 - 30; x += 60) box(x, y0, G1 - 12, x + 10, y1, G1, { color: C.timber2 }, 'beam'); };
  beams(-20, -260, 140, -70);
  beams(-20, 70, 140, 260);
  beams(-180, -260, -30, -70);
  beams(-180, 70, -30, 260);

  // upper floor slab: boards everywhere inside except the stairwell (x -100..100, y 30..60)
  for (const [x0, y0, x1, y1] of [[-180, -260, 140, 30], [-180, 30, -100, 60], [100, 30, 140, 60], [-180, 60, 140, 260]])
    strips(x0, y0, x1, y1, G1, S1, true, 20, C.floor, 'upper floor');

  // staircase: ten steps along the hall's right side, rising toward the back
  for (let i = 0; i < 10; i++) box(100 - 20 * (i + 1), 30, FLOOR, 100 - 20 * i, 60, FLOOR + 12 * (i + 1), { color: C.floor[i % 2] }, 'stair');
  for (let i = 0; i <= 6; i += 2) { // posts stop below the upper floor
    const zt = FLOOR + 12 * (i + 1);
    pole(90 - 20 * i, 25, zt, zt + 36, 5, TIMBER, 'banister post');
  }

  // ---------------------------------------------------- upper floor --
  timberWall('y', 140, 160, +1, -280, 280, U0, U1, [{ cm: -220 }, { cm: -120 }, { cm: 0, kind: 'door' }, { cm: 120 }, { cm: 220 }], 'front upper', { flowerBoxes: true });
  timberWall('y', -200, -180, -1, -280, 280, U0, U1, [{ cm: -220 }, { cm: -100 }, { cm: 100 }, { cm: 220 }], 'back upper');
  timberWall('x', -280, -260, -1, -180, 140, U0, U1, [{ cm: -100 }, { cm: 60, kind: 'door' }], 'left upper');
  timberWall('x', 260, 280, +1, -180, 140, U0, U1, [{ cm: -120 }, { cm: 60 }], 'right upper');
  partition('x', -70, -60, -180, 140, S1, U1, [[-120, -80], [0, 40]], 'upper hall wall left', 88);
  partition('x', 60, 70, -180, 140, S1, U1, [[-150, -110], [0, 40]], 'upper hall wall right', 88);
  partition('y', -30, -20, -260, -70, S1, U1, [], 'bath wall', 88);
  partition('y', -30, -20, 70, 260, S1, U1, [], 'spare wall', 88);

  // -------------------------------------------------------------- roof --
  // gable, ridge along y; 2 studs of eave overhang front and back, 2 on the
  // right gable, none on the left where the tower stands; shingle bands of
  // three shades, 4 studs wide, a ridge cap and fascia boards
  const RISE = 200, rx0 = -220, rx1 = 180, rm = (rx0 + rx1) / 2, ry0 = -280, ry1 = 300;
  for (let y = ry0, k = 0; y < ry1; y += 40, k++) {
    const y1 = Math.min(ry1, y + 40), c = { color: C.roof[k % 3] };
    wedge(rx0, y, U1, rm, y1, U1 + RISE, 1, 0, c, 'roof back');
    wedge(rm, y, U1, rx1, y1, U1 + RISE, -1, 0, c, 'roof front');
  }
  box(rm - 10, ry0, U1 + RISE, rm + 10, ry1, U1 + RISE + 8, { color: C.ridge }, 'ridge cap');
  box(160, ry0, U1 - 8, rx1, ry1, U1, TIMBER, 'fascia');
  box(rx0, ry0, U1 - 8, -200, ry1, U1, TIMBER, 'fascia');

  // ----------------------------------------------------------- chimney --
  const CH = FLOOR + 12 * Math.ceil((U1 + RISE + 60 - FLOOR) / 12);
  masonry('y', -100, -40, 300, 360, FLOOR, CH, [], 'chimney', [false, false]);
  box(-110, 290, CH, -30, 370, CH + 12, { color: C.quoin[1] }, 'chimney cap');
  pole(-85, 330, CH + 12, CH + 36, 10, { color: [150, 80, 60] }, 'chimney pot');
  pole(-55, 330, CH + 12, CH + 28, 10, { color: [150, 80, 60] }, 'chimney pot');

  // ------------------------------------------------------------- tower --
  const T1 = FLOOR + 3 * STOREY; // 384
  const slits = (floors, cm) => floors.map(f => ({ p0: cm - 10, p1: cm + 10, z0: FLOOR + f * STOREY + 36, z1: FLOOR + f * STOREY + 84 }));
  const tdoor = { p0: 40, p1: 80, z0: G0, z1: G0 + 96 }, tdoorUp = { p0: 30, p1: 90, z0: U0 + 12, z1: U0 + 96 };
  const tower = [
    ['y', 120, 140, -420, -280, slits([0, 1, 2], -350), [true, true], 'tower front'],
    ['y', 0, 20, -420, -280, slits([1, 2], -350), [true, true], 'tower back'],
    ['x', -420, -400, 20, 120, slits([0, 1, 2], 70), [false, false], 'tower side'],
    ['x', -300, -280, 20, 120, [tdoor, tdoorUp], [false, false], 'tower inner'],
  ];
  for (const [axis, c0, c1, a, b, open, q, label] of tower) {
    baseCourse(axis, c0, c1, a, b, open.filter(o => o.z0 === G0).map(o => [o.p0, o.p1]), label + ' base');
    masonry(axis, c0, c1, a, b, FLOOR, T1, open, label, q);
    for (const o of open) if (o.p1 - o.p0 === 20) wallBox(axis, (c0 + c1) / 2 - 5, (c0 + c1) / 2 + 5, o.p0, o.p1, o.z0, o.z1, GLASS, label + ' slit');
  }
  strips(20, -400, 120, -300, G1, S1, false, 20, C.floor, 'tower floor 2');
  strips(20, -400, 120, -300, U1, U1 + 8, false, 20, C.floor, 'tower floor 3');
  for (let p = 0; p < 140; p += 40) {
    box(p, -420, T1, p + 20, -400, T1 + 24, { color: C.quoin[0] }, 'merlon');
    box(p, -300, T1, p + 20, -280, T1 + 24, { color: C.quoin[0] }, 'merlon');
  }
  for (let p = -380; p < -300; p += 40) {
    box(0, p, T1, 20, p + 20, T1 + 24, { color: C.quoin[0] }, 'merlon');
    box(120, p, T1, 140, p + 20, T1 + 24, { color: C.quoin[0] }, 'merlon');
  }
  let sz = T1;
  for (const [hw, h, k] of [[50, 12, 0], [45, 24, 1], [35, 24, 2], [30, 24, 0], [20, 24, 1], [10, 24, 2], [5, 24, 0]]) {
    box(70 - hw, -350 - hw, sz, 70 + hw, -350 + hw, sz + h, { color: C.roof[k] }, 'spire');
    sz += h;
  }
  pole(70, -350, sz, sz + 40, 5, { color: C.metal, material: 'BMC_Metallic' }, 'finial');
  pole(70, -350, sz + 40, sz + 52, 10, GLOW([255, 220, 120], 8), 'finial light');

  // ------------------------------------------------- porch and balcony --
  for (const y of [-150, -90, 90, 150]) pole(255, y, FLOOR, G1, 10, { color: C.quoin[0] }, 'porch column');
  box(160, -170, G1, 290, 170, G1 + 12, { color: C.timber2 }, 'porch roof');
  const BZ = G1 + 16;
  strips(160, -170, 290, 170, G1 + 12, BZ, false, 20, C.deck, 'balcony deck');
  for (const [x0, y0, x1, y1, alongY] of [[280, -170, 290, 170, true], [160, -170, 280, -160, false], [160, 160, 280, 170, false]]) {
    const len = alongY ? y1 - y0 : x1 - x0;
    for (let p = 0; p + 10 <= len; p += 20) {
      const px = alongY ? (x0 + x1) / 2 : x0 + p + 5, py = alongY ? y0 + p + 5 : (y0 + y1) / 2;
      pole(px, py, BZ, BZ + 24, 5, { color: C.plaster }, 'baluster');
    }
    box(x0, y0, BZ + 24, x1, y1, BZ + 32, TIMBER, 'balcony rail');
  }
  for (const [y0, y1] of [[-150, -90], [90, 150], [-90, -40], [40, 90]]) {
    for (let y = y0 + 10; y + 5 <= y1 - 5; y += 20) pole(275, y, FLOOR, FLOOR + 28, 5, { color: C.plaster }, 'porch baluster');
    box(270, y0 + 10, FLOOR + 28, 280, y1 - 10, FLOOR + 36, TIMBER, 'porch rail');
  }
  pole(220, 0, G1 - 24, G1, 5, { color: C.metal }, 'lantern chain');
  pole(220, 0, G1 - 36, G1 - 24, 10, GLOW([255, 200, 120], 6), 'porch lantern');

  furnish({ box, pole, asset, pick });
  yard({ box, pole, asset, pick });
  return { bricks, dropped };
}

// ------------------------------------------------------------ interior --
function furnish({ box, pole, asset, pick }) {
  const W = { color: C.timber2 }, D = { color: C.timber }, zF = FLOOR, zU = S1;
  const micro = color => ({ asset: 'PB_DefaultMicroBrick', color });
  const rug = (x0, y0, x1, y1, z, c1, c2) => {
    box(x0, y0, z, x1, y1, z + 2, micro(c1), 'rug');
    box(x0 + 10, y0 + 10, z + 2, x1 - 10, y1 - 10, z + 4, micro(c2), 'rug');
  };
  // hangs from zTop: chain, brass ring, four candles
  const chandelier = (x, y, zTop) => {
    pole(x, y, zTop - 32, zTop, 5, { color: C.metal, material: 'BMC_Metallic' }, 'chandelier chain');
    pole(x, y, zTop - 40, zTop - 32, 25, { color: C.brass, material: 'BMC_Metallic' }, 'chandelier ring');
    for (const [dx, dy] of [[-20, 0], [20, 0], [0, -20], [0, 20]]) pole(x + dx, y + dy, zTop - 52, zTop - 40, 5, GLOW([255, 214, 140], 6), 'candle');
  };
  const bookcase = (x0, y0, x1, y1, z0, levels, alongX, label) => {
    box(x0, y0, z0, x1, y1, z0 + 4, D, label);
    for (let l = 0; l < levels; l++) {
      const zb = z0 + 4 + l * 28;
      for (let p = alongX ? x0 : y0, end = alongX ? x1 : y1; p < end;) {
        const w = Math.min(end - p, pick([4, 6, 4, 8, 6])), bh = pick([16, 20, 24, 18]);
        if (alongX) box(p, y0, zb, p + w, y1, zb + bh, micro(pick(C.books)), label + ' book');
        else box(x0, p, zb, x1, p + w, zb + bh, micro(pick(C.books)), label + ' book');
        p += w;
      }
      box(x0, y0, zb + 24, x1, y1, zb + 28, D, label + ' shelf');
    }
  };
  // a chair whose back is on side (bx, by)
  const chair = (x, y, z, bx, by) => {
    box(x - 10, y - 10, z + 20, x + 10, y + 10, z + 24, W, 'chair seat');
    for (const [dx, dy] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) box(x + dx - 2, y + dy - 2, z, x + dx + 2, y + dy + 2, z + 20, micro(C.timber), 'chair leg');
    const x0 = bx > 0 ? x + 6 : bx < 0 ? x - 10 : x - 10, x1 = bx > 0 ? x + 10 : bx < 0 ? x - 6 : x + 10;
    const y0 = by > 0 ? y + 6 : by < 0 ? y - 10 : y - 10, y1 = by > 0 ? y + 10 : by < 0 ? y - 6 : y + 10;
    box(x0, y0, z + 24, x1, y1, z + 52, micro(C.timber), 'chair back');
  };
  const table = (x0, y0, x1, y1, z, label) => {
    box(x0, y0, z + 28, x1, y1, z + 32, { asset: 'PB_DefaultTile', color: C.timber2 }, label);
    for (const [px, py] of [[x0 + 5, y0 + 5], [x1 - 5, y0 + 5], [x0 + 5, y1 - 5], [x1 - 5, y1 - 5]]) pole(px, py, z, z + 28, 5, D, label + ' leg');
  };
  const bed = (x0, y0, x1, y1, z, blanket, label) => {
    box(x0, y0, z, x1, y1, z + 16, D, label + ' frame');
    box(x0, y0, z + 16, x1, y1, z + 24, { color: [240, 240, 236] }, label + ' mattress');
    box(x0, y0 + 30, z + 24, x1, y1, z + 28, micro(blanket), label + ' blanket');
    box(x0 + 4, y0 + 6, z + 24, x1 - 4, y0 + 24, z + 32, micro([250, 250, 250]), label + ' pillow');
  };

  // parlour (front left): sofa, coffee table, rug, bookcase, lamp, chandelier
  rug(10, -220, 120, -100, zF, [130, 40, 40], [170, 70, 50]);
  box(10, -250, zF, 110, -230, zF + 24, { color: [90, 40, 50] }, 'sofa seat');
  box(10, -258, zF, 110, -250, zF + 48, { color: [80, 34, 44] }, 'sofa back');
  box(0, -258, zF, 10, -230, zF + 32, { color: [80, 34, 44] }, 'sofa arm');
  box(110, -258, zF, 120, -230, zF + 32, { color: [80, 34, 44] }, 'sofa arm');
  table(40, -200, 90, -170, zF + 4, 'coffee table');
  bookcase(-10, -258, 0, -100, zF, 3, false, 'parlour bookcase');
  pole(125, -100, zF, zF + 60, 5, { color: C.brass, material: 'BMC_Metallic' }, 'floor lamp');
  pole(125, -100, zF + 60, zF + 72, 10, GLOW([255, 220, 160], 4), 'lamp shade');
  chandelier(60, -160, G1 - 12);

  // dining (front right): long table, six chairs, sideboard with chalices
  rug(0, 100, 120, 230, zF, [40, 60, 110], [70, 90, 140]);
  table(20, 130, 100, 200, zF + 4, 'dining table');
  for (const x of [30, 60, 90]) { chair(x, 120, zF + 4, 0, -1); chair(x, 210, zF + 4, 0, 1); }
  box(-10, 232, zF, 50, 258, zF + 36, W, 'sideboard');
  for (const x of [0, 20, 40]) asset('B_Chalice', x, 245, zF + 36 + 10, { color: C.brass, material: 'BMC_Metallic' }, 'chalice');
  chandelier(60, 165, G1 - 12);

  // kitchen (back left): counter, stove, cauldron, jars, table, pot rack
  box(-180, -250, zF, -150, -80, zF + 36, W, 'counter');
  box(-180, -250, zF + 36, -150, -80, zF + 40, { asset: 'PB_DefaultTile', color: [200, 196, 186] }, 'counter top');
  box(-140, -258, zF, -100, -228, zF + 36, { color: C.metal }, 'stove');
  for (const x of [-130, -110]) pole(x, -243, zF + 36, zF + 40, 5, GLOW([255, 90, 30], 6), 'burner');
  asset('B_Cauldron', -60, -230, zF + 10, { color: [40, 40, 40] }, 'cauldron');
  const jarColors = [[120, 160, 200], [200, 140, 80], [140, 200, 120], [220, 200, 120], [180, 120, 160]];
  [-240, -210, -180, -150, -120].forEach((y, i) => asset('B_Jar', -166, y, zF + 40 + 12, { color: jarColors[i], material: 'BMC_Glass' }, 'jar'));
  table(-130, -170, -70, -120, zF, 'kitchen table');
  chair(-140, -145, zF, -1, 0);
  chair(-60, -145, zF, 1, 0);
  pole(-100, -250, G1 - 40, G1 - 12, 5, { color: C.metal }, 'pot rack chain');
  box(-120, -256, G1 - 48, -80, -244, G1 - 40, { color: C.metal, material: 'BMC_Metallic' }, 'pot rack');

  // study (back right): fireplace on the chimney wall, bookcases, desk, globe
  box(-110, 240, zF, -100, 260, zF + 64, { color: C.quoin[0] }, 'fireplace jamb');
  box(-40, 240, zF, -30, 260, zF + 64, { color: C.quoin[0] }, 'fireplace jamb');
  box(-110, 232, zF + 64, -30, 260, zF + 76, { color: C.quoin[1] }, 'mantle');
  box(-100, 252, zF, -40, 260, zF + 48, { color: [30, 26, 24] }, 'firebox back');
  box(-100, 240, zF, -40, 252, zF + 4, { color: [40, 34, 30] }, 'hearth');
  box(-110, 220, zF, -30, 232, zF + 4, { color: C.quoin[1] }, 'hearth stone');
  for (const x of [-86, -54]) asset('B_Flame', x, 246, zF + 4 + 10, GLOW([255, 120, 30], 10), 'fire');
  box(-76, 240, zF + 4, -64, 252, zF + 10, micro(C.bark), 'log');
  for (const x of [-90, -50]) asset('B_Chalice', x, 246, zF + 76 + 10, { color: C.brass, material: 'BMC_Metallic' }, 'candlestick');
  bookcase(-178, 80, -168, 240, zF, 3, false, 'study bookcase');
  bookcase(-160, 70, -40, 80, zF, 3, true, 'study bookcase');
  table(-150, 140, -100, 200, zF, 'desk');
  asset('B_2x2_Round', -125, 180, zF + 32 + 6, { color: [60, 110, 180] }, 'globe');
  chair(-125, 125, zF, 0, -1);
  rug(-90, 120, -40, 200, zF, [100, 70, 40], [140, 100, 60]);

  // hall: runner, coat stand, grandfather clock, chandelier
  box(-110, -40, zF, 70, -20, zF + 2, micro([120, 40, 40]), 'hall runner');
  pole(-150, 10, zF, zF + 56, 5, D, 'coat stand');
  box(-160, 0, zF + 56, -140, 20, zF + 60, D, 'coat stand top');
  box(-40, -58, zF, -20, -46, zF + 96, { color: [90, 56, 36] }, 'grandfather clock');
  box(-36, -46, zF + 70, -24, -44, zF + 82, micro([240, 230, 200]), 'clock face');
  chandelier(110, 10, G1);

  // upstairs (floor at zU, the roof's underside at U1)
  bed(10, -240, 70, -150, zU, [120, 40, 60], 'big bed');
  for (const [x, y] of [[5, -245], [75, -245], [5, -145], [75, -145]]) pole(x, y, zU, zU + 96, 5, D, 'bedpost');
  box(0, -250, zU + 96, 80, -140, zU + 100, { color: [140, 40, 60] }, 'bed canopy');
  box(100, -258, zU, 136, -228, zU + 88, W, 'wardrobe');
  box(10, -140, zU, 70, -126, zU + 20, W, 'blanket chest');
  rug(0, -120, 120, -80, zU, [60, 80, 60], [90, 120, 80]);
  chandelier(60, -100, U1);
  bed(10, 200, 50, 258, zU, [60, 90, 160], 'small bed');
  bed(80, 200, 120, 258, zU, [160, 120, 50], 'small bed');
  box(-10, 80, zU, 40, 100, zU + 36, W, 'dresser');
  asset('B_Small_Flower', 15, 90, zU + 36 + 2, { color: [230, 80, 120] }, 'flower');
  chandelier(60, 150, U1);
  // bath
  box(-180, -250, zU, -120, -200, zU + 24, { color: [230, 230, 236] }, 'tub');
  box(-176, -246, zU + 24, -124, -204, zU + 28, { color: [80, 150, 220], material: 'BMC_Glass' }, 'tub water');
  pole(-150, -120, zU, zU + 32, 5, { color: [230, 230, 236] }, 'basin stand');
  pole(-150, -120, zU + 32, zU + 40, 15, { color: [230, 230, 236] }, 'basin');
  box(-180, -130, zU + 50, -178, -110, zU + 80, { asset: 'PB_DefaultMicroBrick', color: [200, 220, 230], material: 'BMC_Metallic' }, 'mirror');
  // spare room / workshop
  box(-180, 100, zU, -150, 220, zU + 32, W, 'workbench');
  for (const y of [120, 160, 200]) asset('B_Jar', -165, y, zU + 32 + 12, { color: [150, 110, 70] }, 'jar');
  for (const x of [-110, -80]) pole(x, 240, zU, zU + 36, 10, { color: [120, 84, 50] }, 'barrel');
  box(-60, 220, zU, -40, 240, zU + 20, { color: [150, 110, 70] }, 'crate');
  // landing by the balcony door
  box(100, -50, zU, 136, -30, zU + 20, W, 'landing bench');
  chandelier(30, -10, U1);
  // tower: a reading nook downstairs
  box(30, -390, zF, 50, -310, zF + 20, { color: [90, 40, 50] }, 'nook seat');
  bookcase(100, -398, 118, -300, zF, 2, false, 'tower bookcase');
}

// ------------------------------------------------------------------ yard --
function yard({ box, pole, asset, pick }) {
  const WHITE = { color: [236, 232, 220] };
  // picket fence round the lot edge, a post every 4 pickets, gate gap at the front
  const fence = (axis, c, a, b) => {
    for (let p = a; p < b; p += 20) {
      const post = (p - a) % 80 === 0;
      const m = post ? { color: C.timber2 } : WHITE, h = post ? 48 : 40;
      if (axis === 'x') box(p, c - 5, 0, p + 10, c + 5, h, m, post ? 'fence post' : 'picket');
      else box(c - 5, p, 0, c + 5, p + 10, h, m, post ? 'fence post' : 'picket');
    }
  };
  fence('x', -485, -490, 490);
  fence('x', 485, -490, 490);
  fence('y', -485, -470, 480);
  fence('y', 485, -470, -60);
  fence('y', 485, 70, 480);
  for (const y of [-50, 50]) {
    pole(485, y, 0, 60, 10, { color: C.quoin[0] }, 'gate post');
    pole(485, y, 60, 72, 15, GLOW([255, 200, 120], 6), 'gate lamp');
  }
  pole(430, 70, 0, 36, 5, D(), 'mailbox post');
  box(420, 64, 36, 440, 76, 52, { color: [60, 90, 150] }, 'mailbox');
  // flower beds either side of the porch
  for (const [y0, y1] of [[-300, -180], [180, 300]])
    for (let x = 190; x < 260; x += 20)
      for (let y = y0 + 10; y < y1; y += 20) asset(pick(['B_Flower', 'B_Small_Flower', 'B_Fern']), x, y, 2, { color: pick(C.flowers) }, 'flower');
  // hedges inside the front fence, either side of the path
  for (const [y0, y1] of [[-440, -80], [80, 440]]) box(440, y0, 0, 470, y1, 36, { color: C.hedge }, 'hedge');
  const tree = (x, y, h) => {
    pole(x, y, 0, h, 10, { color: C.bark }, 'trunk');
    let z = h;
    for (const [r, t] of [[40, 12], [60, 24], [70, 24], [60, 24], [40, 12], [20, 12]]) {
      pole(x, y, z, z + t, r, { color: pick(C.leaf) }, 'leaves');
      z += t;
    }
  };
  tree(400, -400, 120);
  tree(400, 400, 132);
  tree(-400, 400, 108);
  tree(-220, 400, 96);
  // vegetable plot
  for (let x = -430; x < -300; x += 30)
    for (let y = 110; y < 360; y += 30) asset(pick(['B_Fern', 'B_Fern', 'B_Small_Flower']), x + 10, y + 10, 2, { color: pick([[90, 160, 60], [70, 130, 50], [200, 160, 60]]) }, 'crop');
  asset('B_Pumpkin', -280, 380, 7, { color: [230, 120, 30] }, 'pumpkin');
  asset('B_Pumpkin', -280, 340, 7, { color: [230, 120, 30] }, 'pumpkin');
  // the well
  const wx = -360, wy = -260;
  box(wx - 40, wy - 40, 0, wx + 40, wy - 30, 36, { color: C.stone[0] }, 'well');
  box(wx - 40, wy + 30, 0, wx + 40, wy + 40, 36, { color: C.stone[1] }, 'well');
  box(wx - 40, wy - 30, 0, wx - 30, wy + 30, 36, { color: C.stone[2] }, 'well');
  box(wx + 30, wy - 30, 0, wx + 40, wy + 30, 36, { color: C.stone[3] }, 'well');
  box(wx - 30, wy - 30, 0, wx + 30, wy + 30, 24, { color: [40, 80, 120], material: 'BMC_Glass' }, 'well water');
  pole(wx - 35, wy, 36, 96, 5, D(), 'well post');
  pole(wx + 35, wy, 36, 96, 5, D(), 'well post');
  box(wx - 30, wy - 5, 76, wx + 30, wy + 5, 80, D(), 'well axle');
  box(wx - 50, wy - 30, 96, wx + 50, wy + 30, 100, { color: C.roof[0] }, 'well roof');
  pole(wx, wy, 44, 76, 5, { color: [120, 84, 50] }, 'bucket rope');
  // clothesline with laundry
  pole(-300, -430, 0, 72, 5, D(), 'line post');
  pole(-300, -130, 0, 72, 5, D(), 'line post');
  box(-302, -425, 70, -298, -135, 72, { asset: 'PB_DefaultMicroBrick', color: [220, 220, 220] }, 'line');
  for (let y = -410, k = 0; y < -160; y += 50, k++) box(-302, y, 40, -298, y + 30, 70, { asset: 'PB_DefaultMicroBrick', color: C.cloth[k % C.cloth.length] }, 'laundry');
  // woodpile and a bench
  for (let k = 0; k < 4; k++) box(-470, -200 + k * 30, 0, -440, -170 + k * 30, k % 2 ? 36 : 48, { color: C.bark }, 'woodpile');
  box(360, 120, 16, 380, 200, 20, { color: C.timber2 }, 'bench seat');
  box(380, 120, 16, 384, 200, 40, { asset: 'PB_DefaultMicroBrick', color: C.timber2 }, 'bench back');
  for (const y of [125, 195]) box(365, y - 5, 0, 375, y + 5, 16, D(), 'bench leg');
  for (const y of [-55, 55]) {
    pole(360, y, 0, 72, 5, { color: C.metal, material: 'BMC_Metallic' }, 'path lamp');
    pole(360, y, 72, 84, 10, GLOW([255, 200, 120], 5), 'path lamp light');
  }
  function D() { return { color: C.timber }; }
}
