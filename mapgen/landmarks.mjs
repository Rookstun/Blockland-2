// Landmarks (2026-10-28, owner: "make world props like altars to gods, broken directional sign posts,
// libraries, warehouses marked as legacy"; libraries + warehouses removed 2026-10-28): lone props, a few cells each.
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
const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const pick = (list, u) => list[Math.floor(u * list.length) % list.length];

export const LANDMARKS = { altar: { w: 3, d: 3 }, brokensign: { w: 1, d: 1 } };
// (2026-10-28, owner: "when I said archive, I said remove") the libraries and LEGACY-stencilled warehouses are gone

// KoL-ish lines (in-game writing style: CLAUDE.md)
const SIGN_LINES = [['< Somewhere', 'Elsewhere >'], ['< Town (allegedly)', 'Not Town >'], ['< Danger', 'Mild Danger >'], ['< Back', 'Also Back >'], ['< Left', 'Right >'], ['< Your House', 'Not Your House >']];

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

  return { pots };
}
