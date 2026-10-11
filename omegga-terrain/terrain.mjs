#!/usr/bin/env node
// Brickadia terrain generator.
//
// Builds a natural landscape (hills, mountains, rivers, lakes, beaches,
// forests) with flattened, studded house plots joined by dirt paths and
// bridges, and writes it as a Brickadia world (.brdb) or bundle (.brz).
// A top-down preview PNG is written next to the output.
//
//   node terrain.mjs                          -> terrain-<seed>.brdb
//   node terrain.mjs --seed 42 --plots 10
//   node terrain.mjs --size 384 --out big.brdb
//   node terrain.mjs --out island.brz
//
// Options:
//   --seed N         random seed (default: random)
//   --size N         map width in cells (default 256)
//   --cell N         studs per cell (default 2) -> map is size*cell studs wide
//   --plots N        number of house plots (default 8)
//   --plot-size N    plot width in studs (default 32)
//   --water N        water level in plates (default 26)
//   --relief N       height multiplier (default 1)
//   --no-island      don't slope the map edges down into the sea
//   --no-trees       skip trees, bushes, rocks and flowers
//   --out PATH       output file, .brdb or .brz (default terrain-<seed>.brdb)
//   --force          overwrite the output if it already exists

import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- options

export function defaultOptions(overrides = {}) {
  return {
    seed: Math.floor(Math.random() * 1e9),
    size: 256,
    cell: 2,
    plots: 8,
    plotSize: 32,
    water: 26,
    relief: 1,
    island: true,
    trees: true,
    out: null,
    force: false,
    ...overrides,
  };
}

function parseArgs(argv) {
  const opts = defaultOptions();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const num = () => {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v)) throw new Error(`${a} expects a number`);
      return v;
    };
    if (a === '--seed') opts.seed = num();
    else if (a === '--size') opts.size = Math.round(num());
    else if (a === '--cell') opts.cell = Math.round(num());
    else if (a === '--plots') opts.plots = Math.round(num());
    else if (a === '--plot-size') opts.plotSize = Math.round(num());
    else if (a === '--water') opts.water = Math.round(num());
    else if (a === '--relief') opts.relief = num();
    else if (a === '--no-island') opts.island = false;
    else if (a === '--no-trees') opts.trees = false;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'usage: node terrain.mjs [--seed N] [--size N] [--cell N] [--plots N]\n' +
          '       [--plot-size N] [--water N] [--relief N] [--no-island]\n' +
          '       [--no-trees] [--out file.brdb|file.brz] [--force]'
      );
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  if (opts.cell < 1) throw new Error('--cell must be >= 1');
  if (opts.size < 32) throw new Error('--size must be >= 32');
  opts.out ??= `terrain-${opts.seed}.brdb`;
  return opts;
}

// ------------------------------------------------------------ randomness

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRADS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** Seeded 2D Perlin noise, roughly in [-1, 1]. */
function perlin(rng) {
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (h, x, y) => {
    const g = GRADS[h & 7];
    return g[0] * x + g[1] * y;
  };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const X = xi & 255, Y = yi & 255;
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const x1 = dot(aa, xf, yf) + u * (dot(ba, xf - 1, yf) - dot(aa, xf, yf));
    const x2 =
      dot(ab, xf, yf - 1) + u * (dot(bb, xf - 1, yf - 1) - dot(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.4;
  };
}

function fbm(noise, x, y, octaves, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f + o * 17.3, y * f - o * 9.1) * amp;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Ridged multifractal in [0, 1]: sharp crests for mountain ranges. */
function ridged(noise, x, y, octaves) {
  let sum = 0, amp = 0.5, f = 1, weight = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise(x * f + o * 31.7, y * f + o * 11.3));
    n *= n * weight;
    weight = Math.min(1, Math.max(0, n * 2));
    sum += n * amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return Math.min(1, sum * 1.1);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- palette

const C = {
  seabed: [128, 116, 84],
  sand: [222, 204, 150],
  grassLight: [112, 168, 68],
  grass: [92, 150, 58],
  grassDark: [74, 128, 48],
  forestFloor: [62, 108, 42],
  dirt: [118, 86, 58],
  path: [156, 126, 88],
  rock: [122, 122, 126],
  rockDark: [98, 98, 104],
  stone: [104, 102, 106],
  snow: [242, 246, 250],
  plot: [184, 184, 178],
  plotEdge: [140, 140, 136],
  water: [52, 128, 196],
  bark: [96, 66, 42],
  plank: [140, 100, 62],
  post: [80, 58, 40],
  lamp: [255, 214, 140],
  leaves: [[70, 138, 52], [58, 122, 44], [88, 150, 60], [78, 132, 40]],
  pine: [[40, 90, 52], [34, 78, 46], [48, 100, 58]],
  autumn: [[196, 120, 40], [178, 70, 38], [214, 170, 60]],
  flowers: [[230, 60, 60], [250, 220, 70], [245, 245, 245], [170, 90, 210]],
};

// Surface types
const T = {
  SEABED: 0, BEACH: 1, GRASS: 2, FOREST: 3, ROCK: 4, SNOW: 5, PATH: 6,
  PLOT: 7, PLOT_EDGE: 8,
};

// Brick units: 1 stud = 10 wide, 1 plate = 4 tall, 1 brick = 12 tall
const STUD = 10;
const PLATE = 4;
const BRICK = 12;

// ---------------------------------------------------------------- terrain

function generate(opts) {
  const { size: N, water: W, relief } = opts;
  const rng = mulberry32(opts.seed);
  const nBase = perlin(rng), nWarpX = perlin(rng), nWarpY = perlin(rng);
  const nRidge = perlin(rng), nMount = perlin(rng), nRiver = perlin(rng);
  const nLake = perlin(rng), nForest = perlin(rng), nTint = perlin(rng);
  const nDetail = perlin(rng);

  // Map scale stays constant in studs, so larger maps get more features.
  const scale = (N * opts.cell) / 512;
  const H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * scale, v = (y / N) * scale;
      const wx = u + 0.12 * fbm(nWarpX, u * 3, v * 3, 3);
      const wy = v + 0.12 * fbm(nWarpY, u * 3, v * 3, 3);

      let h = 0.42 + 0.3 * fbm(nBase, wx * 3, wy * 3, 5);
      h += 0.02 * fbm(nDetail, u * 24, v * 24, 2);

      // mountain ranges where the mountain mask is high
      const mount = smoothstep(0.05, 0.45, fbm(nMount, u * 1.6, v * 1.6, 2));
      h += mount * ridged(nRidge, wx * 2.5, wy * 2.5, 5) * 0.75;

      // lakes: occasional deep basins
      const lake = smoothstep(0.35, 0.6, fbm(nLake, u * 2.2, v * 2.2, 3));
      h = lerp(h, 0.08, lake * (1 - mount));

      // rivers: carve along the zero line of a noise field
      const r = Math.abs(fbm(nRiver, wx * 1.8, wy * 1.8, 3));
      const river = 1 - smoothstep(0.015, 0.05, r);
      const bank = 1 - smoothstep(0.05, 0.1, r);
      h = lerp(h, Math.min(h, 0.26), bank * 0.5 * (1 - mount * 0.8));
      h = lerp(h, 0.1, river * (1 - mount * 0.9));

      if (opts.island) {
        const dx = x / N - 0.5, dy = y / N - 0.5;
        const d =
          Math.max(Math.abs(dx), Math.abs(dy)) * 1.6 +
          Math.hypot(dx, dy) * 0.4 +
          0.05 * fbm(nDetail, u * 6, v * 6, 2);
        const edge = smoothstep(0.72, 1.0, d);
        h = lerp(h, 0.02, edge);
      }
      H[y * N + x] = h;
    }
  }

  // to plates; water sits at plate W
  const top = new Int32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const h = H[i];
    const above = h - 0.3;
    top[i] =
      above > 0
        ? Math.round(W + 2 + above * 160 * relief)
        : Math.max(3, Math.round(W + 2 + above * 70));
  }
  // a light blur takes the edge off single-cell spikes
  const blurred = new Int32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0, n = 0;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const xx = x + ox, yy = y + oy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          const w = ox === 0 && oy === 0 ? 4 : 1;
          s += top[yy * N + xx] * w;
          n += w;
        }
      blurred[y * N + x] = Math.round(s / n);
    }
  return {
    N, W, top: blurred, rng,
    forest: (x, y) => fbm(nForest, (x / N) * scale * 4, (y / N) * scale * 4, 3),
    tint: (x, y) => fbm(nTint, (x / N) * scale * 10, (y / N) * scale * 10, 2),
  };
}

// ------------------------------------------------------------- house plots

function placePlots(map, opts) {
  const { N, W, top, rng } = map;
  const P = Math.max(4, Math.round(opts.plotSize / opts.cell));
  const M = Math.max(3, Math.round(8 / opts.cell)); // blend margin
  const snowline = W + 90;
  const candidates = [];
  const stride = Math.max(2, Math.floor(P / 4));
  for (let y0 = M + 2; y0 + P + M + 2 < N; y0 += stride) {
    for (let x0 = M + 2; x0 + P + M + 2 < N; x0 += stride) {
      let lo = Infinity, hi = -Infinity, ok = true;
      for (let y = y0 - M; y < y0 + P + M && ok; y++)
        for (let x = x0 - M; x < x0 + P + M; x++) {
          const h = top[y * N + x];
          if (h < W + 4 || h > snowline - 30) { ok = false; break; }
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      if (!ok || hi - lo > 22) continue;
      candidates.push({ x0, y0, score: hi - lo + rng() * 4 });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  const gap = M * 2 + Math.round(12 / opts.cell);
  const plots = [];
  for (const c of candidates) {
    if (plots.length >= opts.plots) break;
    const clash = plots.some(
      p =>
        c.x0 < p.x0 + P + gap && p.x0 < c.x0 + P + gap &&
        c.y0 < p.y0 + P + gap && p.y0 < c.y0 + P + gap
    );
    if (!clash) plots.push({ ...c, size: P });
  }

  // flatten each plot and blend its surroundings into the new level
  const type = new Int8Array(N * N).fill(-1);
  const reserved = new Uint8Array(N * N); // no trees here
  for (const p of plots) {
    const hs = [];
    for (let y = p.y0; y < p.y0 + P; y++)
      for (let x = p.x0; x < p.x0 + P; x++) hs.push(top[y * N + x]);
    hs.sort((a, b) => a - b);
    p.level = Math.max(W + 4, hs[hs.length >> 1]);
    const R = M + 3;
    for (let y = p.y0 - R; y < p.y0 + P + R; y++)
      for (let x = p.x0 - R; x < p.x0 + P + R; x++) {
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const dx = Math.max(p.x0 - x, 0, x - (p.x0 + P - 1));
        const dy = Math.max(p.y0 - y, 0, y - (p.y0 + P - 1));
        const d = Math.max(dx, dy);
        const i = y * N + x;
        reserved[i] = 1;
        if (d === 0) {
          top[i] = p.level;
          const border =
            x === p.x0 || y === p.y0 || x === p.x0 + P - 1 || y === p.y0 + P - 1;
          type[i] = border ? T.PLOT_EDGE : T.PLOT;
        } else {
          const t = smoothstep(0, 1, d / R);
          top[i] = Math.round(lerp(p.level, top[i], t));
        }
      }
  }
  return { plots, type, reserved };
}

/** Connect plots with a minimum spanning tree of dirt paths. */
function placePaths(map, plots, type, reserved, opts) {
  const { N, W, top } = map;
  const bridge = new Uint8Array(N * N);
  if (plots.length < 2) return bridge;
  const centers = plots.map(p => [p.x0 + (p.size >> 1), p.y0 + (p.size >> 1)]);
  const inTree = [0];
  const edges = [];
  while (inTree.length < centers.length) {
    let best = null;
    for (const a of inTree)
      for (let b = 0; b < centers.length; b++) {
        if (inTree.includes(b)) continue;
        const d = Math.hypot(
          centers[a][0] - centers[b][0], centers[a][1] - centers[b][1]
        );
        if (!best || d < best.d) best = { a, b, d };
      }
    inTree.push(best.b);
    edges.push([centers[best.a], centers[best.b]]);
  }

  const halfW = Math.max(1, Math.round(2 / opts.cell));
  for (const [[x0, y0], [x1, y1]] of edges) {
    // gentle S-curve so paths don't look ruler-drawn
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    const nx = -(y1 - y0), ny = x1 - x0;
    const len = Math.hypot(nx, ny) || 1;
    const bend = (map.rng() - 0.5) * 0.25 * len;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const off = Math.sin(t * Math.PI) * bend;
      const cx = Math.round(lerp(x0, x1, t) + (nx / len) * off);
      const cy = Math.round(lerp(y0, y1, t) + (ny / len) * off);
      for (let oy = -halfW; oy <= halfW; oy++)
        for (let ox = -halfW; ox <= halfW; ox++) {
          const x = cx + ox, y = cy + oy;
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const i = y * N + x;
          if (type[i] === T.PLOT || type[i] === T.PLOT_EDGE) continue;
          reserved[i] = 1;
          if (top[i] <= W) bridge[i] = 1;
          else type[i] = T.PATH;
        }
    }
  }
  return bridge;
}

// ------------------------------------------------------------- surface types

function classify(map, type) {
  const { N, W, top } = map;
  const snowline = W + 90;
  const at = (x, y) => top[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (type[i] !== -1) continue;
      const h = top[i];
      const slope = Math.max(
        Math.abs(h - at(x - 1, y)), Math.abs(h - at(x + 1, y)),
        Math.abs(h - at(x, y - 1)), Math.abs(h - at(x, y + 1))
      );
      const jitter = map.tint(x, y) * 10;
      if (h <= W) type[i] = T.SEABED;
      else if (h <= W + 3) type[i] = T.BEACH;
      else if (h > snowline + jitter && slope < 8) type[i] = T.SNOW;
      else if (slope >= 6 || h > snowline - 18 + jitter) type[i] = T.ROCK;
      else if (map.forest(x, y) > 0.08) type[i] = T.FOREST;
      else type[i] = T.GRASS;
    }
}

function surfaceColor(map, t, x, y) {
  const tint = map.tint(x, y);
  switch (t) {
    case T.SEABED: return C.seabed;
    case T.BEACH: return C.sand;
    case T.FOREST: return tint > 0.1 ? C.grassDark : C.forestFloor;
    case T.GRASS: return tint > 0.2 ? C.grassLight : tint < -0.2 ? C.grassDark : C.grass;
    case T.ROCK: return tint > 0 ? C.rock : C.rockDark;
    case T.SNOW: return C.snow;
    case T.PATH: return C.path;
    case T.PLOT: return C.plot;
    case T.PLOT_EDGE: return C.plotEdge;
  }
}

function bodyColor(t) {
  if (t === T.SEABED || t === T.BEACH) return C.sand;
  if (t === T.ROCK || t === T.SNOW) return C.stone;
  if (t === T.PLOT || t === T.PLOT_EDGE) return C.stone;
  return C.dirt;
}

// ------------------------------------------------------------ brick output

/** Greedy-merge a grid of keys into rectangles of identical keys. */
function greedyRects(N, keyAt, maxSpan) {
  const used = new Uint8Array(N * N);
  const rects = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (used[i]) continue;
      const k = keyAt(x, y);
      if (k === null) continue;
      let w = 1;
      while (
        x + w < N && w < maxSpan && !used[i + w] && keyAt(x + w, y) === k
      ) w++;
      let h = 1;
      grow: while (y + h < N && h < maxSpan) {
        for (let xx = x; xx < x + w; xx++)
          if (used[(y + h) * N + xx] || keyAt(xx, y + h) !== k) break grow;
        h++;
      }
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) used[yy * N + xx] = 1;
      rects.push({ x, y, w, h, key: k });
    }
  return rects;
}

function buildBricks(map, opts, plots, type, reserved, bridge) {
  const { N, W, top, rng } = map;
  const bricks = [];
  const cellU = opts.cell * STUD;
  const origin = (N * cellU) / 2;
  const maxSpan = Math.max(1, Math.floor(1000 / cellU)); // <=100 studs per brick
  const colorOf = new Map();
  const ck = c => {
    const k = c.join(',');
    colorOf.set(k, c);
    return k;
  };
  const counts = {};
  const decor = []; // non-terrain bricks, drawn on the preview
  const add = (label, brick) => {
    counts[label] = (counts[label] ?? 0) + 1;
    bricks.push(brick);
    if (!['ground', 'surface', 'plot', 'water'].includes(label)) decor.push(brick);
  };
  const box = (rect, z0, z1) => ({
    size: [(rect.w * cellU) / 2, (rect.h * cellU) / 2, ((z1 - z0) * PLATE) / 2],
    position: [
      ((2 * rect.x + rect.w) * cellU) / 2 - origin,
      ((2 * rect.y + rect.h) * cellU) / 2 - origin,
      ((z0 + z1) * PLATE) / 2,
    ],
  });
  const cellCenter = (x, y) => [
    x * cellU + cellU / 2 - origin,
    y * cellU + cellU / 2 - origin,
  ];

  // Ground body: one column per merged rect from z=0 up to 2 plates below top
  for (const r of greedyRects(N, (x, y) => {
    const i = y * N + x;
    return top[i] > 2 ? `${ck(bodyColor(type[i]))}|${top[i] - 2}` : null;
  }, maxSpan)) {
    const [c, zt] = r.key.split('|');
    add('ground', { ...box(r, 0, +zt), color: colorOf.get(c), asset: 'PB_DefaultTile' });
  }

  // Surface layer: 2 plates; plots get studs so they read as build spots
  for (const r of greedyRects(N, (x, y) => {
    const i = y * N + x;
    const plot = type[i] === T.PLOT || type[i] === T.PLOT_EDGE;
    return `${plot ? 'S' : 'T'}|${ck(surfaceColor(map, type[i], x, y))}|${top[i]}`;
  }, maxSpan)) {
    const [a, c, zt] = r.key.split('|');
    add(a === 'S' ? 'plot' : 'surface', {
      ...box(r, Math.max(0, zt - 2), +zt),
      color: colorOf.get(c),
      asset: a === 'S' ? 'PB_DefaultBrick' : 'PB_DefaultTile',
    });
  }

  // Water: translucent glass from the seabed up to the water line
  for (const r of greedyRects(N, (x, y) => {
    const h = top[y * N + x];
    return h < W ? String(h) : null;
  }, maxSpan)) {
    add('water', {
      ...box(r, +r.key, W),
      color: C.water,
      material: 'BMC_Glass',
      material_intensity: 4,
      asset: 'PB_DefaultTile',
      collision: { player: false, weapon: false, interaction: false, physics: false },
    });
  }

  // Bridges where paths cross water, with support posts
  for (const r of greedyRects(N, (x, y) => (bridge[y * N + x] ? 'b' : null), maxSpan)) {
    add('bridge', { ...box(r, W + 1, W + 2), color: C.plank, asset: 'PB_DefaultBrick' });
  }
  for (let y = 0; y < N; y += 4)
    for (let x = 0; x < N; x += 4) {
      const i = y * N + x;
      if (!bridge[i]) continue;
      const [px, py] = cellCenter(x, y);
      const z0 = top[i] * PLATE, z1 = (W + 1) * PLATE;
      add('bridge', {
        size: [5, 5, (z1 - z0) / 2], position: [px, py, (z0 + z1) / 2],
        color: C.post, asset: 'PB_DefaultBrick',
      });
    }

  // Plot corner lamp posts
  for (const p of plots) {
    const zBase = p.level * PLATE;
    const P = p.size;
    for (const [cx, cy] of [[p.x0, p.y0], [p.x0 + P - 1, p.y0], [p.x0, p.y0 + P - 1], [p.x0 + P - 1, p.y0 + P - 1]]) {
      const [px, py] = cellCenter(cx, cy);
      add('lamps', { size: [5, 5, BRICK * 1.5], position: [px, py, zBase + BRICK * 1.5], color: C.post });
      add('lamps', {
        size: [5, 5, 5], position: [px, py, zBase + BRICK * 3 + 5],
        color: C.lamp, material: 'BMC_Glow', material_intensity: 6,
      });
    }
  }

  if (opts.trees) placeFlora(map, opts, type, reserved, add, cellCenter);
  return { bricks, counts, decor };
}

// ------------------------------------------------------------------ flora

function placeFlora(map, opts, type, reserved, add, cellCenter) {
  const { N, W, top, rng } = map;
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const cellU = opts.cell * STUD;
  const occupied = new Uint8Array(N * N);
  const clear = (x, y, r) => {
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) return false;
        const i = yy * N + xx;
        if (occupied[i] || reserved[i]) return false;
      }
    return true;
  };
  const mark = (x, y, r) => {
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++)
        if (xx >= 0 && yy >= 0 && xx < N && yy < N) occupied[yy * N + xx] = 1;
  };
  const leafBrick = (cx, cy, z0, hx, hy, hz, color) =>
    add('trees', { size: [hx, hy, hz], position: [cx, cy, z0 + hz], color });

  const oak = (cx, cy, z, autumn) => {
    const trunk = BRICK * ri(3, 6);
    add('trees', { size: [10, 10, trunk / 2], position: [cx, cy, z + trunk / 2], color: C.bark });
    const leaf = autumn && rng() < 0.6 ? pick(C.autumn) : pick(C.leaves);
    const hw = STUD * ri(3, 4);
    const cz = z + trunk - BRICK;
    leafBrick(cx, cy, cz, hw, hw, BRICK * 1.5, leaf);
    leafBrick(cx, cy, cz + BRICK * 3, hw - STUD, hw - STUD, BRICK / 2, leaf);
    for (let k = ri(2, 4); k > 0; k--) {
      const ang = rng() * Math.PI * 2;
      const ox = Math.round((Math.cos(ang) * hw) / 5) * 5;
      const oy = Math.round((Math.sin(ang) * hw) / 5) * 5;
      leafBrick(cx + ox, cy + oy, cz + BRICK * ri(0, 1), STUD * 2, STUD * 2, BRICK, leaf);
    }
  };
  const pine = (cx, cy, z) => {
    const trunk = BRICK * ri(1, 2);
    add('trees', { size: [10, 10, trunk / 2], position: [cx, cy, z + trunk / 2], color: C.bark });
    const leaf = pick(C.pine);
    const layers = ri(4, 6);
    let lz = z + trunk;
    for (let k = 0; k < layers; k++) {
      const hw = STUD * Math.max(1, layers - k) * 0.9;
      const half = Math.max(5, Math.round(hw / 5) * 5);
      leafBrick(cx, cy, lz, half, half, BRICK / 2 + 2, leaf);
      lz += BRICK + 2;
    }
    leafBrick(cx, cy, lz, 5, 5, BRICK / 2, leaf);
  };
  const bush = (cx, cy, z) => {
    const hw = STUD * ri(1, 2) + 5;
    leafBrick(cx, cy, z, hw, hw, ri(2, 3) * PLATE, pick(C.leaves));
  };
  const rock = (cx, cy, z) => {
    const c = rng() < 0.5 ? C.rock : C.rockDark;
    const hx = STUD * ri(1, 3), hy = STUD * ri(1, 3), hz = (BRICK / 2) * ri(1, 2);
    // sunk one plate so rocks sit in the ground on uneven cells
    add('rocks', { size: [hx, hy, hz], position: [cx, cy, z + hz - PLATE], color: c });
  };

  // shuffled cell order so density is even
  const order = new Uint32Array(N * N);
  for (let i = 0; i < order.length; i++) order[i] = i;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const area = opts.cell * opts.cell; // studs^2 per cell
  const treeR = Math.max(2, Math.round(6 / opts.cell));
  for (const i of order) {
    const x = i % N, y = (i - x) / N;
    const ty = type[i];
    const h = top[i];
    const [cx, cy] = cellCenter(x, y);
    const z = h * PLATE;
    const r = rng();
    if (ty === T.FOREST) {
      if (r < 0.02 * area && clear(x, y, treeR)) {
        mark(x, y, treeR);
        (h > W + 45 || map.forest(x, y) > 0.3 ? pine : oak)(cx, cy, z, map.tint(x, y) > 0.35);
      }
    } else if (ty === T.GRASS) {
      if (r < 0.0015 * area && clear(x, y, treeR)) {
        mark(x, y, treeR);
        (h > W + 55 ? pine : oak)(cx, cy, z, false);
      } else if (r < 0.004 * area && clear(x, y, 1)) {
        mark(x, y, 1);
        bush(cx, cy, z);
      } else if (r < 0.012 * area && !reserved[i] && !occupied[i]) {
        const jx = ri(-1, 1) * Math.floor(cellU / 4), jy = ri(-1, 1) * Math.floor(cellU / 4);
        add('flowers', { size: [5, 5, 2], position: [cx + jx, cy + jy, z + 2], color: pick(C.flowers) });
      }
    } else if (ty === T.ROCK) {
      if (r < 0.004 * area && clear(x, y, 1)) {
        mark(x, y, 1);
        rock(cx, cy, z);
      } else if (h < W + 70 && r < 0.006 * area && clear(x, y, treeR)) {
        mark(x, y, treeR);
        pine(cx, cy, z);
      }
    } else if (ty === T.BEACH && r < 0.002 * area && clear(x, y, 1)) {
      mark(x, y, 1);
      rock(cx, cy, z);
    }
  }
}

// ---------------------------------------------------------------- preview

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(width, height, rgb) {
  const chunk = (tag, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(tag, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++)
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Top-down hillshaded map with trees, lamps and bridges drawn on top.
 * Image +Y (up) is world +Y. */
function preview(map, type, decor, cellU) {
  const { N, W, top } = map;
  const S = Math.max(1, Math.round(512 / N));
  const size = N * S;
  const img = Buffer.alloc(size * size * 3);
  const put = (px, py, c) => {
    if (px < 0 || py < 0 || px >= size || py >= size) return;
    const o = ((size - 1 - py) * size + px) * 3;
    img[o] = clamp(c[0], 0, 255);
    img[o + 1] = clamp(c[1], 0, 255);
    img[o + 2] = clamp(c[2], 0, 255);
  };
  const at = (x, y) => top[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let c = surfaceColor(map, type[i], x, y);
      const shade = clamp(1 + (at(x - 1, y) - at(x + 1, y) + at(x, y - 1) - at(x, y + 1)) * 0.035, 0.55, 1.35);
      c = c.map(v => v * shade);
      if (top[i] < W) {
        const depth = clamp((W - top[i]) / 20, 0, 1);
        c = c.map((v, k) => lerp(v, C.water[k] * 0.8, 0.55 + depth * 0.4));
      }
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) put(x * S + sx, y * S + sy, c);
    }

  // decorations, lowest first so canopies cover trunks
  const pxPerUnit = S / cellU;
  const origin = (N * cellU) / 2;
  const sorted = [...decor].sort(
    (a, b) => a.position[2] + a.size[2] - (b.position[2] + b.size[2])
  );
  for (const b of sorted) {
    const x0 = Math.floor((b.position[0] - b.size[0] + origin) * pxPerUnit);
    const x1 = Math.ceil((b.position[0] + b.size[0] + origin) * pxPerUnit);
    const y0 = Math.floor((b.position[1] - b.size[1] + origin) * pxPerUnit);
    const y1 = Math.ceil((b.position[1] + b.size[1] + origin) * pxPerUnit);
    const c = b.color ?? [255, 255, 255];
    for (let py = y0; py < Math.max(y1, y0 + 1); py++)
      for (let px = x0; px < Math.max(x1, x0 + 1); px++) {
        const edge = px === x0 || py === y0;
        put(px, py, edge ? c.map(v => v * 0.75) : c);
      }
  }
  return png(size, size, img);
}

// -------------------------------------------------------------------- api

/** Generate a landscape. Returns World-builder brick inputs (asset and
 * material by name) plus the plots and a preview PNG. */
export function makeTerrain(overrides = {}) {
  const opts = defaultOptions(overrides);
  const map = generate(opts);
  const { plots, type, reserved } = placePlots(map, opts);
  const bridge = placePaths(map, plots, type, reserved, opts);
  classify(map, type);
  const { bricks, counts, decor } = buildBricks(map, opts, plots, type, reserved, bridge);
  return {
    opts, bricks, counts, plots,
    preview: () => preview(map, type, decor, opts.cell * STUD),
  };
}

/** The game shows colors written by brs-js with red and blue swapped
 * (seen in-game on CL15729: brown dirt rendered navy), so bricks get
 * their color channels reversed on the way out. Preview PNGs use the
 * unswapped palette. */
export const forGame = b => (b.color ? { ...b, color: [b.color[2], b.color[1], b.color[0]] } : b);

/** Convert makeTerrain bricks into the legacy save object that
 * writeBrzLegacy (and Omegga's loadSaveData) take. With an owner
 * {id, name}, every brick belongs to it so it can be cleared later. */
export function toLegacySave(bricks, owner) {
  const assets = [], materials = [];
  const index = (list, name) => {
    let i = list.indexOf(name);
    if (i === -1) i = list.push(name) - 1;
    return i;
  };
  const out = bricks.map(({ asset, material, ...b }) => ({
    ...forGame(b),
    asset_name_index: index(assets, asset ?? 'PB_DefaultBrick'),
    material_index: index(materials, material ?? 'BMC_Plastic'),
    owner_index: owner ? 1 : 0,
  }));
  return {
    brick_assets: assets,
    materials,
    brick_owners: owner ? [{ ...owner, bricks: out.length }] : [],
    bricks: out,
  };
}

// ------------------------------------------------------------------- main

async function main() {
  const { World, Brdb } = await import(
    new URL('./brs-js-master/dist/dist.mjs', import.meta.url).href
  );
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  if (existsSync(opts.out) && !opts.force)
    throw new Error(`${opts.out} already exists (use --force to overwrite)`);

  const { bricks, counts, plots, preview: render } = makeTerrain(opts);
  const world = new World();
  for (const b of bricks) world.addBrick(forGame(b));

  const thumb = render();
  const pngPath = opts.out.replace(/\.(brdb|brz)$/i, '') + '.png';
  writeFileSync(pngPath, thumb);

  const writeOpts = {
    environment: 'Plate',
    thumbnail: thumb,
    bundle: {
      name: `Terrain ${opts.seed}`,
      description: `Generated terrain (seed ${opts.seed}) with ${plots.length} house plots`,
    },
  };
  if (/\.brz$/i.test(opts.out)) {
    writeFileSync(opts.out, world.toBrz(writeOpts));
  } else {
    if (existsSync(opts.out)) rmSync(opts.out);
    const db = await Brdb.create(opts.out);
    db.save(`Generated terrain seed ${opts.seed}`, world, writeOpts);
    db.close();
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const studs = opts.size * opts.cell;
  console.log(`seed ${opts.seed}: ${studs}x${studs} studs, ${plots.length} house plots`);
  console.log('bricks:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '), `(total ${total})`);
  console.log(`wrote ${opts.out} and ${pngPath} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
