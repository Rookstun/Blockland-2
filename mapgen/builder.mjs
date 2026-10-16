// Overlap-guarded brick builder shared by the dungeon (and future) generators.
//
// The game rejects a brick whose box overlaps another, so every brick goes
// through add(), which drops (and records) anything that would collide with
// a brick already placed. Boxes are given by corners in game units; a box
// off the stud/plate grid becomes a micro brick automatically.

import { orientFor, worldBox } from './orient.mjs';

export const FIXED = {
  B_SpawnPoint: [20, 20, 2], B_CheckPoint: [20, 20, 2], B_1x1_Round: [5, 5, 6], B_2x2_Round: [10, 10, 6], B_4x4_Round: [20, 20, 6],
  B_1x1_Cone: [5, 5, 6], B_Jar: [9, 9, 12], B_Cauldron: [10, 10, 10], B_Chalice: [5, 5, 10], B_Flame: [5, 5, 10],
  // plants: collision half extents measured in-game (sky probes, 2026-10-02)
  B_Flower: [10, 10, 2], B_Small_Flower: [6, 6, 2], B_Fern: [10, 10, 2], B_Pumpkin: [10, 10, 8], B_Tulip: [6, 6, 6], B_Rose: [6, 6, 4],
  // props measured in-game by overlap probes (2026-10-16)
  B_1x2_MetalIngot: [10, 5, 2], B_Turkey_Body: [14, 10, 7], B_Turkey_Leg: [10, 5, 3], B_Sausage: [10, 5, 2], B_Fork: [4, 10, 2], B_Spoon: [4, 10, 2],
  B_Bush: [14, 14, 16], B_Leaf_Bush: [26, 26, 20], B_Pine_Tree: [16, 16, 38], B_Branch: [20, 10, 2], B_Lotus_1x1: [6, 6, 4], B_Lotus_2x2: [10, 10, 6],
};

export function makeBuilder({ cell = 100 } = {}) {
  const bricks = [], boxes = [], grid = new Map(), dropped = [];
  const cellsOf = ([lo, hi]) => {
    const out = [];
    for (let gx = Math.floor(lo[0] / cell); gx <= Math.floor((hi[0] - 1) / cell); gx++)
      for (let gy = Math.floor(lo[1] / cell); gy <= Math.floor((hi[1] - 1) / cell); gy++) out.push(gx + ',' + gy);
    return out;
  };
  function add(b, label = '') {
    const bx = worldBox(b, FIXED);
    const [lo, hi] = bx;
    if (lo.some((v, i) => v >= hi[i])) throw new Error(`empty brick ${label} ${JSON.stringify(b)}`);
    const keys = cellsOf(bx);
    for (const k of keys)
      for (const j of grid.get(k) ?? []) {
        const [a0, a1] = boxes[j];
        if (b.group != null && bricks[j].group === b.group) continue; // one captured model's own pieces interlock (town.mjs prop)
        if (lo[0] < a1[0] && a0[0] < hi[0] && lo[1] < a1[1] && a0[1] < hi[1] && lo[2] < a1[2] && a0[2] < hi[2]) {
          dropped.push(`${label} ${JSON.stringify(bx)} hits ${bricks[j].label} ${JSON.stringify(boxes[j])}`);
          return false;
        }
      }
    const i = bricks.push({ ...b, label }) - 1;
    boxes.push(bx);
    for (const k of keys) (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
    return true;
  }
  function box(x0, y0, z0, x1, y1, z1, m, label) {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
    const b = { ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] };
    const offGrid = [x1 - x0, y1 - y0].some(v => v % 10) || (z1 - z0) % 4;
    if (!b.asset && offGrid) b.asset = 'PB_DefaultMicroBrick';
    if (b.size.some(v => !Number.isInteger(v)) || b.position.some(v => !Number.isInteger(v))) throw new Error(`off-grid ${label} ${JSON.stringify(b)}`);
    return add(b, label);
  }
  /** a box split into pieces no longer than `max` along x and y (big slabs) */
  function slab(x0, y0, z0, x1, y1, z1, m, label, max = 400) {
    for (let x = x0; x < x1; x += max) for (let y = y0; y < y1; y += max) box(x, y, z0, Math.min(x1, x + max), Math.min(y1, y + max), z1, m, label);
  }
  const pole = (x, y, z0, z1, r, m, label) => add({ asset: 'PB_DefaultPole', ...m, size: [r, r, (z1 - z0) / 2], position: [x, y, (z0 + z1) / 2] }, label);
  const asset = (name, x, y, z, m, label) => add({ asset: name, size: [0, 0, 0], ...m, position: [x, y, z] }, label);
  function wedge(x0, y0, z0, x1, y1, z1, dx, dy, m, label) {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    return add({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext), ...m, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label);
  }
  /** true if the world box [lo, hi] touches nothing added so far (read only) */
  function free(lo, hi) {
    for (const k of cellsOf([lo, hi]))
      for (const j of grid.get(k) ?? []) {
        const [a0, a1] = boxes[j];
        if (lo[0] < a1[0] && a0[0] < hi[0] && lo[1] < a1[1] && a0[1] < hi[1] && lo[2] < a1[2] && a0[2] < hi[2]) return false;
      }
    return true;
  }
  return { bricks, dropped, add, box, slab, pole, asset, wedge, free };
}

export function rng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.pick = list => list[Math.floor(next() * list.length)];
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return next;
}
