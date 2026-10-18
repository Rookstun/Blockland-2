// Terrace demo (owner 2026-10-18 photo: broad flat micro brick plateaus, slanted banks between
// them, contours at any angle, a path winding across): a standalone 64 x 64-stud patch.
//   node mapgen/terracedemo.mjs OUT.json [cx cy z] [seed]
// Heights: smooth field -> terraces every STEP units -> each terrace edge widened into a bank
// falling 8 per 16-unit tile (Euclidean reach, so diagonal edges stay diagonal). Per 16 tile:
// flat, or one 8x8x4 micro cap (2 corners up = micro wedge, 1 = wedge corner, 3 = outer corner),
// wedges merged along their run. Columns: rock, a dirt band, a grass skin (all micro bricks,
// greedy merged per layer). The path is a colour band (darker kerb) over the same geometry.
import fs from 'fs';
import { orientFor } from './orient.mjs';

const [OUT = 'terracedemo.json', CX = -3000, CY = -12000, Z0 = 8000, SEED = 7] = process.argv.slice(2);
const cx = +CX, cy = +CY, z0 = +Z0, seed = +SEED;
const TS = 16, NT = 40, RISE = 8, STEP = 24, REACH = 3; // tile, tiles per side, cap rise, terrace step, bank reach (tiles)
const GRASS = [[96, 128, 58], [104, 136, 62]], BANK = [96, 128, 58], DIRT = [110, 80, 54], ROCK = [112, 108, 102], PATH = [150, 116, 78], KERB = [120, 92, 62];

// smooth field (sum of rotated waves + a seeded bump field)
let s = seed >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const waves = Array.from({ length: 5 }, () => ({ a: R() * Math.PI * 2, k: 1 / (110 + R() * 220), p: R() * 9, w: 16 + R() * 18 }));
const field = (x, y) => 40 + waves.reduce((v, q) => v + q.w * Math.sin((x * Math.cos(q.a) + y * Math.sin(q.a)) * q.k + q.p), 0);
const NV = NT + 1, L = new Float64Array(NV * NV), Hh = new Float64Array(NV * NV);
for (let i = 0; i < NV; i++) for (let j = 0; j < NV; j++) L[i * NV + j] = Math.max(0, Math.floor(field(i * TS, j * TS) / STEP) * STEP);
for (let i = 0; i < NV; i++) for (let j = 0; j < NV; j++) {
  let h = L[i * NV + j];
  for (let a = -REACH; a <= REACH; a++) for (let b = -REACH; b <= REACH; b++) {
    const u = i + a, v = j + b; if (u < 0 || v < 0 || u >= NV || v >= NV) continue;
    h = Math.max(h, L[u * NV + v] - RISE * Math.round(Math.hypot(a, b)));
  }
  Hh[i * NV + j] = h;
}
// path: a winding curve across the patch
const pathD = (x, y) => Math.abs(y - (NT * TS) / 2 - 120 * Math.sin(x / 150 + 1) - 40 * Math.sin(x / 61));
const tileCol = (ti, tj, top) => { const d = pathD((ti + 0.5) * TS, (tj + 0.5) * TS); return d < 14 ? PATH : d < 22 ? KERB : top ? GRASS[0] : BANK; };

const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const tiles = [];
for (let ti = 0; ti < NT; ti++) for (let tj = 0; tj < NT; tj++) {
  const k = [Hh[ti * NV + tj], Hh[(ti + 1) * NV + tj], Hh[ti * NV + tj + 1], Hh[(ti + 1) * NV + tj + 1]];
  const mx = Math.max(...k), mn = Math.min(...k);
  let cap = null, base = mx;
  if (mx > mn) {
    base = mx - RISE;
    const up = k.map(v => v === mx), n = up.filter(Boolean).length;
    if (n === 1) { const [sx, sy] = CORNER[up.indexOf(true)]; cap = ['PB_DefaultMicroWedgeCorner', [[sx, 0], [0, sy]]]; }
    else if (n === 3) { const [lx, ly] = CORNER[up.indexOf(false)]; cap = ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]]]; }
    else {
      const [p, q] = up.map((u, i) => (u ? i : -1)).filter(i => i >= 0), [ax, ay] = CORNER[p], [bx, by] = CORNER[q];
      if (ax === bx) cap = ['PB_DefaultMicroWedge', [[ax, 0]]]; else if (ay === by) cap = ['PB_DefaultMicroWedge', [[0, ay]]]; else base = mx;
    }
  }
  tiles.push({ ti, tj, base, cap, col: tileCol(ti, tj, !cap) });
}
const bricks = [], X0 = cx - (NT * TS) / 2, Y0 = cy - (NT * TS) / 2;
const at = t => tiles[t.ti * NT + t.tj];
// caps: wedges merged along the run (same base, piece, colour)
const used = new Set(), key = t => t.cap && t.cap[0] + JSON.stringify(t.cap[1]) + t.base + t.col;
for (const t of tiles) {
  if (!t.cap || used.has(t)) continue;
  let len = 1, px = 0, py = 0;
  if (t.cap[0] === 'PB_DefaultMicroWedge') {
    [px, py] = t.cap[1][0][0] ? [0, 1] : [1, 0];
    while (t.ti + px * len < NT && t.tj + py * len < NT) { const o = at({ ti: t.ti + px * len, tj: t.tj + py * len }); if (used.has(o) || key(o) !== key(t)) break; len++; }
  }
  for (let m = 0; m < len; m++) used.add(at({ ti: t.ti + px * m, tj: t.tj + py * m }));
  const ext = [px ? (len * TS) / 2 : TS / 2, py ? (len * TS) / 2 : TS / 2, RISE / 2];
  bricks.push({ asset: t.cap[0], ...orientFor(t.cap[0], t.cap[1], ext), position: [X0 + t.ti * TS + ext[0], Y0 + t.tj * TS + ext[1], z0 + t.base + RISE / 2], color: t.col });
}
// columns: rock [0, base-12), dirt [base-12, base-4), skin [base-4, base) in the tile's colour; greedy per layer
const layer = (lo, hi, col) => {
  const done = new Uint8Array(NT * NT);
  for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) {
    const t = tiles[i * NT + j], z = [lo(t), hi(t)], c = col(t);
    if (done[i * NT + j] || z[1] <= z[0]) continue;
    const same = (a, b) => { if (i + a >= NT || j + b >= NT || done[(i + a) * NT + j + b]) return false; const o = tiles[(i + a) * NT + j + b]; return lo(o) === z[0] && hi(o) === z[1] && col(o) === c; };
    let l = 1; while (same(0, l)) l++;
    let w = 1; grow: for (;;) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
    for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) done[(i + a) * NT + j + b] = 1;
    bricks.push({ asset: 'PB_DefaultMicroBrick', size: [(w * TS) / 2, (l * TS) / 2, (z[1] - z[0]) / 2], position: [X0 + i * TS + (w * TS) / 2, Y0 + j * TS + (l * TS) / 2, z0 + (z[0] + z[1]) / 2], color: c });
  }
};
layer(() => -24, t => t.base - 12, () => ROCK);
layer(t => Math.max(-24, t.base - 12), t => t.base - 4, () => DIRT);
layer(t => t.base - 4, t => t.base, t => t.col);
fs.writeFileSync(OUT, JSON.stringify(bricks));
console.log(`terrace demo: ${bricks.length} bricks (${used.size} capped tiles of ${NT * NT}), centre ${cx},${cy},${z0}`);
