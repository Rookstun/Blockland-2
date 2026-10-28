// Landmarks (2026-10-28, owner: "make world props like altars to gods, broken directional sign posts,
// libraries, warehouses marked as legacy"): lone props scattered over the wilds, a few cells each.
//
//   LANDMARKS[kind] = { w, d }: footprint in 40-unit cells (w along the front, d deep)
//   buildLandmark(kind, { seed, rnd, put, orientFor, facing, god, name }) -> { pots }
//
// Built through put(brick, x, y, z) in local units: footprint corner at (0, 0), ground z 0, the front
// (door, plaque) toward facing [dx, dy]. Every piece is laid out in a frame (u along the front,
// v from the front inward) and mapped to the world: boxes swap their extents, wedges turn their slope.
import { plaque } from './ruins.mjs';

const MB = 'PB_DefaultMicroBrick', WEDGE = 'PB_DefaultMicroWedge';
const STONE = [[132, 128, 120], [118, 114, 108], [146, 142, 134], [104, 100, 96]];
const DARK = [[86, 82, 78], [74, 70, 66]];
const TIMBER = [[92, 66, 44], [78, 56, 38], [104, 76, 50]];
const PLANK = [[138, 112, 80], [120, 96, 66], [150, 122, 88]];
const TIN = [[118, 124, 128], [104, 108, 110], [96, 84, 72]]; // last = rust
const BOOKS = [[120, 40, 36], [44, 70, 110], [60, 96, 54], [150, 120, 60], [90, 50, 90], [180, 160, 120], [40, 40, 44], [140, 80, 40]];
const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const pick = (list, u) => list[Math.floor(u * list.length) % list.length];

export const LANDMARKS = { altar: { w: 3, d: 3 }, brokensign: { w: 1, d: 1 }, library: { w: 5, d: 4 }, warehouse: { w: 6, d: 5, apron: 1 } };
// apron: cells of open ground in front (crates, the boarded door); the frame's v = 0 is behind it

// KoL-ish lines (in-game writing style: CLAUDE.md)
const SIGN_LINES = [['< Somewhere', 'Elsewhere >'], ['< Town (allegedly)', 'Not Town >'], ['< Danger', 'Mild Danger >'], ['< Back', 'Also Back >'], ['< Left', 'Right >'], ['< Your House', 'Not Your House >']];
const LIB_LINES = ['Overdue since forever', 'Quiet. Quieter. No.', 'Books: 3 read, 400 judged', 'No food. No fun. No refunds.'];
const WARE_LINES = ['Archived. Do not un-archive.', 'Kept for reasons nobody remembers.', 'Contents: deprecated. Also crates.', 'Scheduled for removal since forever.'];

export function buildLandmark(kind, { seed, rnd, put, orientFor, facing: [fx, fy], god, name }) {
  const R = (k, i = 0) => rnd(seed, k, i);
  const { w, d, apron = 0 } = LANDMARKS[kind], A = apron * 40, W = w * 40, D = d * 40 - A;
  // frame: u along the front, v inward; the front (v = 0) faces (fx, fy)
  const V = [-fx, -fy], U = [fy, -fx];
  const toW = (u, v) => [U[0] * u + V[0] * v, U[1] * u + V[1] * v];
  const shift = [0, 1].map(a => -Math.min(0, U[a] * W) - Math.min(0, V[a] * (D + A)));
  const P = (u, v) => { const p = toW(u, v + A); return [p[0] + shift[0], p[1] + shift[1]]; };
  const box = (u0, v0, z0, u1, v1, z1, m) => {
    if (u1 <= u0 || v1 <= v0 || z1 <= z0) return false;
    const a = P(u0, v0), b = P(u1, v1), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    return put({ asset: MB, ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  // a micro wedge rising toward frame direction (du, dv)
  const wedge = (u0, v0, z0, u1, v1, z1, du, dv, m) => {
    const a = P(u0, v0), b = P(u1, v1), x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const dir = toW(du, dv);
    return put({ asset: WEDGE, ...orientFor(WEDGE, [dir], [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2]), ...m }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  const glow = (u, v, z, r, h, color) => box(u - r, v - r, z, u + r, v + r, z + h, { color, material: 'BMC_Glow', material_intensity: 6 });
  // a text board on the face toward frame direction (du, dv); dir = world normal
  const board = (u, v, z, du, dv, text, opt = {}) => { const [x, y] = P(u, v); return plaque({ put, text, facing: toW(du, dv), x, y, z, ...opt }); };
  const pots = [];
  const potAt = (u, v) => pots.push(P(u, v));

  if (kind === 'altar') {
    // a stepped stone dais, the altar block at the back, two braziers burning in the god's colour, an idol
    const c = god.colour, S = (k, i) => shade(pick(STONE, R(k, i)), 0.94 + R(k + 1, i) * 0.12);
    box(0, 0, 0, W, D, 4, { color: S(1, 0) });
    box(10, 10, 4, W - 10, D - 10, 8, { color: S(3, 0) });
    box(20, 30, 8, W - 20, D - 10, 12, { color: S(5, 0) });
    // the altar block, a dark top slab overhanging it (micro: no underside shows), the plaque on its front
    box(36, 60, 12, W - 36, D - 30, 40, { color: S(7, 0) });
    box(32, 56, 40, W - 32, D - 26, 44, { color: DARK[0] });
    board(W / 2, 59, 26, 0, -1, `${god.name} ${god.epithet}\n${god.title} of ${god.spheres.join(' & ')}`, { w: 22, h: 10, color: DARK[1] });
    // the idol: a plinth and a figure-ish stack in the god's colour, a crown of light
    box(W / 2 - 8, 68, 44, W / 2 + 8, 84, 50, { color: STONE[2] });
    box(W / 2 - 5, 71, 50, W / 2 + 5, 81, 70, { color: shade(c, 0.8) });
    box(W / 2 - 7, 72, 70, W / 2 + 7, 80, 74, { color: shade(c, 0.7) });
    box(W / 2 - 4, 72, 74, W / 2 + 4, 80, 82, { color: shade(c, 0.85) });
    glow(W / 2, 76, 82, 2, 4, c);
    // braziers on stone posts at the front corners of the top step
    for (const u of [28, W - 28]) {
      box(u - 4, 36, 12, u + 4, 44, 44, { color: S(9, u) });
      box(u - 7, 33, 44, u + 7, 47, 48, { color: DARK[1] });
      glow(u, 40, 48, 4, 6, c);
    }
    // offerings: a coin heap, a candle stub or two
    box(W / 2 - 4, 46, 12, W / 2 + 4, 52, 14, { color: [230, 190, 60], material: 'BMC_Metallic' });
    for (const [u, v] of [[50, 50], [W - 50, 52]]) { box(u - 1, v - 1, 12, u + 1, v + 1, 18, { color: [236, 230, 210] }); glow(u, v, 18, 1, 2, [255, 200, 120]); }
    potAt(16, D - 16); potAt(W - 16, D - 16);
  }

  else if (kind === 'brokensign') {
    // a fingerpost snapped half way: the stump with one board still nailed on, the top lying in the grass
    const lines = pick(SIGN_LINES, R(1)), post = TIMBER[0];
    box(16, 16, 0, 24, 24, 4, { color: STONE[3] });
    box(18, 18, 4, 22, 22, 40, { color: post });
    // the splintered top of the stump: two uneven slivers
    box(18, 18, 40, 20, 22, 46, { color: shade(post, 1.15) });
    box(20, 20, 40, 22, 22, 44, { color: shade(post, 1.1) });
    // the surviving board on the stump, text both faces (one lies, one admits it)
    for (const s of [1, -1]) board(20, 20 - s * 3, 30, 0, -s, s > 0 ? lines[0] : lines[1], { w: 18, h: 6, color: PLANK[1] });
    // the fallen top: the rest of the post lying along u, its second board flat on the ground
    box(2, 30, 0, 38, 34, 4, { color: shade(post, 0.9) });
    box(6, 2, 0, 30, 12, 2, { color: shade(PLANK[0], 0.85) });
  }

  else if (kind === 'library') {
    // stone walls, a door in the front, windows in the sides only (never next to the door), a flat
    // roof with a parapet, shelves of books along the back and sides, a lectern with the rules on it
    const T = 10, Hw = 72, S = (k, i) => shade(pick(STONE, R(k, i)), 0.95 + R(k + 1, i) * 0.1);
    const doorL = W / 2 - 16, doorR = W / 2 + 16, doorH = 64;
    box(0, 0, 0, W, D, 4, { color: DARK[0] }); // floor slab
    // front wall round the door, lintel above it
    box(0, 0, 4, doorL, T, Hw, { color: S(1, 0) });
    box(doorR, 0, 4, W, T, Hw, { color: S(1, 1) });
    box(doorL, 0, doorH, doorR, T, Hw, { color: STONE[2] });
    // back wall
    box(0, D - T, 4, W, D, Hw, { color: S(3, 0) });
    // side walls with two windows each (sill 28, head 52)
    for (const [u0, u1, k] of [[0, T, 5], [W - T, W, 7]]) {
      let v = T;
      for (const [w0, w1] of [[40, 64], [96, 120]]) {
        box(u0, v, 4, u1, w0, Hw, { color: S(k, w0) });
        box(u0, w0, 4, u1, w1, 28, { color: S(k, w0 + 1) });
        box(u0, w0, 52, u1, w1, Hw, { color: S(k, w0 + 2) });
        v = w1;
      }
      box(u0, v, 4, u1, D - T, Hw, { color: S(k, 999) });
    }
    // roof slab, parapet, cornice band
    box(0, 0, Hw, W, D, Hw + 4, { color: DARK[1] });
    for (const [u0, v0, u1, v1] of [[0, 0, W, 4], [0, D - 4, W, D], [0, 4, 4, D - 4], [W - 4, 4, W, D - 4]]) box(u0, v0, Hw + 4, u1, v1, Hw + 12, { color: STONE[2] });
    board(W / 2, -1, Hw - 2, 0, -1, `Library of ${name}\n${pick(LIB_LINES, R(9))}`, { w: 34, h: 6, color: DARK[0] });
    // shelves: a timber case 10 deep, shelf boards every 20, books of random width and height between them
    const shelf = (u0, v0, u1, v1, alongU, k) => {
      box(u0, v0, 4, u1, v1, 6, { color: TIMBER[1] });
      for (const z of [24, 44, 64]) box(u0, v0, z, u1, v1, z + 2, { color: TIMBER[1] });
      for (const z0 of [6, 26, 46]) {
        const L = alongU ? u1 - u0 : v1 - v0;
        for (let p = 0, q = 0; p < L; q++) {
          const bw = Math.min(L - p, 4 + Math.floor(R(k + z0, q) * 4) * 2), bh = 10 + Math.floor(R(k + z0 + 1, q) * 4) * 2;
          if (R(k + z0 + 2, q) < 0.12) { p += bw; continue; } // a gap where a book went missing
          const m = { color: shade(pick(BOOKS, R(k + z0 + 3, q)), 0.85 + R(k + z0 + 4, q) * 0.3) };
          if (alongU) box(u0 + p, v0, z0, u0 + p + bw, v1, z0 + bh, m); else box(u0, v0 + p, z0, u1, v0 + p + bw, z0 + bh, m);
          p += bw;
        }
      }
    };
    shelf(T, D - T - 10, W - T, D - T, true, 20);
    shelf(T, T + 30, T + 10, 40, false, 40);         // short runs between the side windows only
    shelf(T, 64, T + 10, 96, false, 50);
    shelf(W - T - 10, 64, W - T, 96, false, 60);
    shelf(W - T - 10, T + 30, W - T, 40, false, 70);
    // reading table + lectern
    box(W / 2 - 30, 70, 4, W / 2 + 30, 100, 26, { color: TIMBER[0] });
    box(W / 2 - 30, 70, 26, W / 2 + 30, 100, 28, { color: TIMBER[2] });
    box(W / 2 - 6, 40, 4, W / 2 + 6, 46, 34, { color: TIMBER[0] });
    box(W / 2 - 10, 38, 34, W / 2 + 10, 48, 38, { color: TIMBER[2] });
    box(W / 2 - 8, 40, 38, W / 2 + 8, 46, 40, { color: [230, 222, 200] }); // the open book
    glow(W / 2 - 22, 85, 28, 2, 4, [255, 200, 120]);
    potAt(30, 30); potAt(W - 30, 30);
  }

  else if (kind === 'warehouse') {
    // a timber-framed plank shed under a tin gable roof, its big door boarded shut and stencilled LEGACY
    const T = 6, Hw = 60, ridge = 44;
    const doorL = W / 2 - 40, doorR = W / 2 + 40;
    box(0, 0, 0, W, D, 4, { color: DARK[0] });
    // corner and mid posts, plank walls between them (a few planks missing high up)
    const posts = [0, W / 2 - 46, W / 2 + 40, W - 6];
    for (const u of posts) for (const v of [0, D - 6]) if (v === 0 || u === 0 || u === W - 6) box(u, v, 4, u + 6, v + 6, Hw, { color: TIMBER[1] });
    const plankWall = (u0, v0, u1, v1, k) => {
      for (let z = 4, q = 0; z < Hw; z += 8, q++) {
        if (z > 36 && R(k, q) < 0.15) continue; // missing plank: a gap up high
        box(u0, v0, z, u1, v1, Math.min(Hw, z + 8), { color: shade(pick(PLANK, R(k + 1, q)), 0.85 + R(k + 2, q) * 0.2) });
      }
    };
    plankWall(6, 1, W / 2 - 46, 5, 10);
    plankWall(W / 2 + 46, 1, W - 6, 5, 20);
    plankWall(6, D - 5, W - 6, D - 1, 30);
    plankWall(1, 6, 5, D - 6, 40);
    plankWall(W - 5, 6, W - 1, D - 6, 50);
    // the doorway: a lintel, two hanging door leaves, boards nailed across the opening
    box(W / 2 - 40, 0, 52, W / 2 + 40, 6, Hw, { color: TIMBER[1] });
    box(W / 2 - 40, 2, 4, W / 2, 6, 52, { color: PLANK[2] });
    box(W / 2, 2, 4, W / 2 + 40, 6, 52, { color: shade(PLANK[2], 0.92) });
    for (const z of [14, 40]) box(W / 2 - 44, -4, z, W / 2 + 44, 0, z + 6, { color: TIMBER[2] });
    board(W / 2, -3, 28, 0, -1, `LEGACY\n${pick(WARE_LINES, R(9))}`, { w: 36, h: 8, color: [190, 160, 40], style: { Color: { R: 20, G: 20, B: 20, A: 255 }, OutlineWidth: 0 } });
    // the tin roof: two wedges meeting at a ridge along u, ends closed by the wedges' own triangles
    box(0, 0, Hw, W, D, Hw + 2, { color: TIMBER[1] });
    wedge(0, 0, Hw + 2, W, D / 2, Hw + 2 + ridge, 0, 1, { color: pick(TIN, R(60)) });
    wedge(0, D / 2, Hw + 2, W, D, Hw + 2 + ridge, 0, -1, { color: pick(TIN, R(61)) });
    // crates stacked outside the front corner
    const crate = (u, v, z, s, k) => box(u, v, z, u + s, v + s, z + s, { color: shade(pick(PLANK, R(k)), 0.8 + R(k + 1) * 0.2) });
    crate(W - 50, -40, 0, 20, 70); crate(W - 28, -38, 0, 20, 72); crate(W - 46, -36, 20, 16, 74);
    potAt(30, -20);
  }
  return { pots };
}
