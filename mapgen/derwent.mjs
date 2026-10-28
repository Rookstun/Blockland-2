// Derwent House, Park Lane East, Reigate RH2 8LR (2026-10-27, owner: Zoopla uprn 68142855 = Flat 9, 'research
// this house ... then build it'). A c.1984 purpose-built two-storey block of 1-bed flats: buff/orange brick,
// white vertical cladding over the stair entrances, white uPVC windows, green spandrel panels, shallow
// concrete-tile gable roof, post-and-rail fence on the pavement (listing photo). Footprint from OSM way
// 550484738 (~38 x 9.3 m, next to the RH2 8LR postcode point), 1 stud = 1 ft. Each flat follows the listing's
// floorplan (490 sq ft): kitchen, bath, walk-in store along the front, entrance hall, lounge + bedroom behind.
//   x 0..1200 (F1 | core A | F2 F3 | core B | F4, flats mirrored about their core), y 0 = front (road at -y).
//   derwent() -> { bricks }     node mapgen/derwent.mjs [out.json]
import fs from 'fs';
import { makeBuilder } from './builder.mjs';
import { orientFor } from './orient.mjs';

const BRICK = [190, 126, 86], PLASTER = [226, 222, 212], CEIL = [240, 240, 236], WHITE = [244, 244, 240];
const ROOF = [92, 78, 70], GREEN = [126, 150, 112], CONC = [150, 148, 142], GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const FLOORC = { kitchen: [70, 70, 76], bath: [214, 218, 220], store: [150, 150, 150], hall: [196, 160, 110], lounge: [196, 160, 110], bed: [196, 182, 160], core: [110, 116, 128] };
const shade = (c, f) => c.map(v => Math.round(v * f));
const FL = [16, 112], CL = [100, 196]; // floor tops, ceiling bottoms per storey

export function derwent() {
  const B = makeBuilder();
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`derwent: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const wedge = (x0, y0, z0, x1, y1, z1, ups, color, label) => {
    const asset = 'PB_DefaultMicroWedge', ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    if (!B.add({ asset, ...orientFor(asset, ups, ext), color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label)) throw new Error(`derwent: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  // rect [a0,a1]x[z0,z1] minus openings {a0,a1,z0,z1} -> pieces (tavistock.mjs course())
  function cut(a0, a1, z0, z1, openings) {
    let pcs = [{ p: a0, q: a1, z: z0, zt: z1 }];
    for (const o of openings) {
      if (o.z0 >= z1 || o.z1 <= z0) continue;
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
    return pcs.filter(c => c.q > c.p && c.zt > c.z);
  }
  // a wall slab along `axis` ('x': runs along x at y t0..t1), a0..a1, z0..z1, minus openings
  const slabPiece = (axis, t0, t1, c, color, label) => axis === 'x' ? box(c.p, t0, c.z, c.q, t1, c.zt, color, label) : box(t0, c.p, c.z, t1, c.q, c.zt, color, label);
  const plain = (axis, t0, t1, a0, a1, z0, z1, ops, color, label) => cut(a0, a1, z0, z1, ops).forEach(c => slabPiece(axis, t0, t1, c, color, label));
  // brick skin in 12-high courses (alternate courses a shade darker), skipping `skip` ranges (cladding bays)
  function brickSkin(axis, t0, t1, a0, a1, ops, skip = []) {
    for (let z = 0; z < 200; z += 12) {
      const color = shade(BRICK, (z / 12) % 2 ? 0.94 : 1);
      plain(axis, t0, t1, a0, a1, z, Math.min(200, z + 12), [...ops, ...skip.map(([p, q]) => ({ a0: p, a1: q, z0: 0, z1: 200 }))], color, 'brick');
    }
  }
  // window / door furniture inside an opening through a 10-thick wall at t0..t0+10; out = -1/+1 (outside side)
  function windowIn(axis, t0, out, o, spandrel = false) {
    const pb = (a, b, z, zt, color, lab, s0 = t0, s1 = t0 + 10, m) => axis === 'x' ? box(a, s0, z, b, s1, zt, color, lab, m) : box(s0, a, z, s1, b, zt, color, lab, m);
    let z0 = o.z0;
    if (spandrel) { pb(o.a0, o.a1, z0, o.sill, GREEN, 'spandrel'); z0 = o.sill; }
    pb(o.a0, o.a1, z0, z0 + 2, WHITE, 'frame'); pb(o.a0, o.a1, o.z1 - 2, o.z1, WHITE, 'frame');
    pb(o.a0, o.a0 + 2, z0 + 2, o.z1 - 2, WHITE, 'frame'); pb(o.a1 - 2, o.a1, z0 + 2, o.z1 - 2, WHITE, 'frame');
    // top-hung fanlights over fixed panes: a transom a third down, mullions every <= 50
    const tz = o.z1 - 2 - Math.round((o.z1 - z0) / 6) * 2, n = Math.ceil((o.a1 - o.a0 - 4) / 50);
    const xs = [o.a0 + 2]; for (let i = 1; i < n; i++) xs.push(o.a0 + 2 + Math.round((o.a1 - o.a0 - 4) * i / n / 2) * 2);
    xs.push(o.a1 - 2);
    // glass one pane per opening, the transom + mullions as 2-deep bars on its outer face
    const g = out < 0 ? t0 + 2 : t0 + 6;
    pb(o.a0 + 2, o.a1 - 2, z0 + 2, o.z1 - 2, null, 'glass', t0 + 4, t0 + 6, GLASS);
    pb(o.a0 + 2, o.a1 - 2, tz - 2, tz, WHITE, 'transom', g, g + 2);
    for (let i = 1; i < xs.length - 1; i++) pb(xs[i] - 1, xs[i] + 1, z0 + 2, tz - 2, WHITE, 'mullion', g, g + 2), pb(xs[i] - 1, xs[i] + 1, tz, o.z1 - 2, WHITE, 'mullion', g, g + 2);
    pb(o.a0 - 2, o.a1 + 2, z0 - 2, z0, CONC, 'sill', out < 0 ? t0 - 2 : t0 + 10, out < 0 ? t0 : t0 + 12);
  }

  // ------------------------------------------------------------------- plan --
  const CORES = [260, 860];                      // core interiors x c..c+80 (walls c-10..c, c+80..c+90)
  const FLATS = [[10, 250, +1], [350, 596, -1], [604, 850, +1], [950, 1190, -1]]; // interior x, core side (+1 = at x1)
  const front = [], back = [], ends = { 0: [], 1: [] }; // exterior openings {a0,a1,z0,z1,kind}
  const win = (list, a0, a1, z0, z1, F, kind = 'win', sill) => list.push({ a0, a1, z0: F + z0, z1: F + z1, kind, sill: sill && F + sill });
  for (const [xa, xb, side] of FLATS) {
    const W = xb - xa, X = (u0, u1) => side > 0 ? [xa + u0, xa + u1] : [xb - u1, xb - u0];
    for (const F of FL) {
      const C = F + 84; // this storey's ceiling bottom
      // floor finish (kitchen | front row bath, store | hall | lounge | bedroom), then the room walls
      for (const [u0, u1, y0, y1, k] of [[0, 70, 10, 124, 'kitchen'], [70, 164, 10, 72, 'bath'], [164, W, 10, 72, 'store'], [70, W, 72, 124, 'hall'], [0, 124, 124, 290, 'lounge'], [124, W, 124, 290, 'bed']]) {
        const [x0, x1] = X(u0, u1);
        box(x0, y0, F - 4, x1, y1, F, FLOORC[k], k + ' floor');
      }
      const D = (a0, a1) => ({ a0, a1, z0: F, z1: F + 62 });
      const iw = (u0, u1, y0, y1, ops, axis) => {
        const [x0, x1] = X(u0, u1);
        if (axis === 'x') plain('x', y0, y1, x0, x1, F, C, ops.map(o => { const [p, q] = X(o.a0, o.a1); return { ...o, a0: p, a1: q }; }), PLASTER, 'room wall');
        else plain('y', x0, x1, y0, y1, F, C, ops, PLASTER, 'room wall');
      };
      iw(0, W, 122, 128, [D(78, 118), D(160, 200)], 'x');   // hall/kitchen | lounge/bedroom
      iw(66, 72, 10, 122, [D(78, 118)], 'y');                // kitchen | hall (kitchen door)
      iw(72, W, 68, 74, [D(96, 136), D(180, 220)], 'x');     // bath/store | hall
      iw(160, 166, 10, 68, [], 'y');                         // bath | store
      iw(122, 128, 128, 290, [], 'y');                       // lounge | bedroom
      // ceiling + the floor above (upper storey: the roof void's plaster ceiling)
      box(xa, 10, C, xb, 290, C + 8 - (F === FL[1] ? 4 : 0), CEIL, 'ceiling');
      // exterior openings
      win(front, ...X(16, 56), 28, 70, F); win(front, ...X(100, 130), 44, 70, F); win(front, ...X(180, 216), 44, 70, F);
      win(back, ...X(20, 104), 6, 70, F, 'win', 28); win(back, ...X(146, 226), 6, 70, F, 'win', 28);
      if ((side > 0 && xa === 10) || (side < 0 && xb === 1190)) {
        const e = ends[xa === 10 ? 0 : 1];
        win(e, 30, 100, 28, 70, F); win(e, 160, 260, 6, 70, F, 'win', 28);
      }
    }
  }
  // ------------------------------------------------------------- stair cores --
  const CORE_ST = [244, 244, 240];
  for (const c of CORES) {
    // party walls of the core (flat doors both storeys, y 77..117)
    for (const wx of [c - 10, c + 80]) plain('y', wx, wx + 10, 10, 290, 12, 200, FL.map(F => ({ a0: 78, a1: 118, z0: F, z1: F + 62 })), PLASTER, 'core wall');
    box(c, 10, 12, c + 80, 130, 16, FLOORC.core, 'core hall floor');
    for (let k = 0; k < 6; k++) box(c, 130 + 10 * k, 12, c + 40, 140 + 10 * k, 24 + 8 * k, shade(FLOORC.core, k % 2 ? 0.9 : 1), 'flight A');
    box(c, 190, 12, c + 80, 290, 64, FLOORC.core, 'mid landing');
    for (let k = 0; k < 6; k++) {
      box(c + 40, 180 - 10 * k, 12, c + 80, 190 - 10 * k, 72 + 8 * k, shade(FLOORC.core, k % 2 ? 0.9 : 1), 'flight B');
      if (k < 5) box(c + 38, 180 - 10 * k, 72 + 8 * k + 10, c + 40, 190 - 10 * k, 72 + 8 * k + 40, WHITE, 'flight rail'); // over flight A's lower end
    }
    box(c, 10, 100, c + 80, 130, 108, CEIL, 'landing ceiling'); box(c, 10, 108, c + 80, 130, 112, FLOORC.core, 'landing floor');
    box(c, 130, 112, c + 38, 132, 148, WHITE, 'landing rail');
    box(c, 10, 196, c + 80, 290, 200, CEIL, 'core ceiling');
    front.push({ a0: c + 40, a1: c + 80, z0: 16, z1: 78, kind: 'door' }, { a0: c + 10, a1: c + 70, z0: 136, z1: 180, kind: 'win' });
    back.push({ a0: c + 10, a1: c + 70, z0: 80, z1: 130, kind: 'win' });
    box(c + 36, -24, 0, c + 84, 0, 8, CONC, 'step');
    box(c + 32, -30, 84, c + 88, 0, 88, WHITE, 'canopy');
  }
  // party wall F2 | F3
  plain('y', 596, 604, 10, 290, 12, 200, [], PLASTER, 'party wall');
  box(10, 10, 0, 1190, 290, 12, CONC, 'ground slab');
  // ------------------------------------------------------------ outer walls --
  const clad = CORES.map(c => [c - 10, c + 90]);
  brickSkin('x', 0, 6, 0, 1200, front, clad);
  brickSkin('x', 294, 300, 0, 1200, back);
  brickSkin('y', 0, 6, 6, 294, ends[0]); brickSkin('y', 1194, 1200, 6, 294, ends[1]);
  plain('x', 6, 10, 6, 1194, 0, 200, front, PLASTER, 'plaster'); plain('x', 290, 294, 6, 1194, 0, 200, back, PLASTER, 'plaster');
  plain('y', 6, 10, 10, 290, 0, 200, ends[0], PLASTER, 'plaster'); plain('y', 1190, 1194, 10, 290, 0, 200, ends[1], PLASTER, 'plaster');
  // white vertical boarding over the entrances (photo), boards 10 wide in two shades
  for (const [p, q] of clad) for (let x = p; x < q; x += 10) plain('x', 0, 6, x, x + 10, 0, 200, front, shade(CORE_ST, (x / 10) % 2 ? 0.94 : 1), 'cladding');
  for (const o of front) if (o.kind === 'win') windowIn('x', 0, -1, o);
  for (const o of back) windowIn('x', 290, 1, o, !!o.sill);
  for (const [i, x] of [[0, 0], [1, 1190]]) for (const o of ends[i]) windowIn('y', x, i ? 1 : -1, o, !!o.sill);
  // ------------------------------------------------------------------ roof --
  // shallow gable: 8 courses of 20 x 12 either side (~31 deg), solid brick void under it (gables show brick)
  const segs = [[-10, 190], [190, 400], [400, 600], [600, 800], [800, 1000], [1000, 1210]];
  for (let k = 0; k < 8; k++) for (const [s, dir] of [[-10 + 20 * k, 1], [290 - 20 * k, -1]]) {
    const z = 200 + 12 * k, c = shade(ROOF, [1, 0.94, 1.04][k % 3]);
    if (k) box(0, s, 200, 1200, s + 20, z, shade(BRICK, 0.97), 'gable');
    for (const [p, q] of segs) wedge(p, s, z, q, s + 20, z + 12, [[0, dir]], c, 'roof');
  }
  for (const [p, q] of segs) box(p, 140, 296, q, 160, 300, shade(ROOF, 0.8), 'ridge');
  for (const [y0, y1] of [[-12, -10], [310, 312]]) box(-10, y0, 190, 1210, y1, 204, WHITE, 'fascia');
  for (const [y0, y1] of [[-10, 0], [300, 310]]) box(0, y0, 196, 1200, y1, 200, WHITE, 'soffit');
  for (const [y0, y1] of [[-18, -12], [312, 318]]) box(-10, y0, 194, 1210, y1, 200, [60, 62, 64], 'gutter');
  for (const x of [13, 600, 1187]) box(x - 3, -6, 0, x + 3, 0, 194, [60, 62, 64], 'downpipe');
  // ------------------------------------------------------- pavement + fence --
  box(-60, -100, 0, 1260, -62, 2, [176, 174, 168], 'pavement');
  for (const c of CORES) box(c + 36, -62, 0, c + 84, -24, 2, [176, 174, 168], 'path');
  const gaps = CORES.map(c => [c + 30, c + 90]);
  const inGap = (a, b) => gaps.some(([p, q]) => a < q && b > p);
  const WOOD = [150, 128, 96];
  for (let x = -40; x <= 1240; x += 80) if (!inGap(x - 4, x + 4)) box(x - 4, -60, 2, x + 4, -52, 44, shade(WOOD, 0.9), 'fence post');
  for (let x = -40; x < 1240; x += 80) for (const z of [12, 32]) {
    let p = x + 4, q = x + 76;
    for (const [g0, g1] of gaps) { if (p < g1 && q > g0) { if (p < g0) box(p, -58, z, g0 - 4, -54, z + 8, WOOD, 'rail'); p = g1 + 4; } }
    if (q > p && !inGap(p, q)) box(p, -58, z, q, -54, z + 8, WOOD, 'rail');
  }
  const bricks = B.bricks.map(({ label, ...b }) => b);
  return { bricks, count: bricks.length };
}

if (process.argv[1]?.endsWith('derwent.mjs')) {
  const out = process.argv[2] ?? 'derwent.json', h = derwent();
  fs.writeFileSync(out, JSON.stringify({ bricks: h.bricks }));
  console.error(`derwent: ${h.count} bricks`);
}
