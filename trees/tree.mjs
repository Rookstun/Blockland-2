// Dynamic tree builder (2026-10-12): every run grows a new tree (or a grove)
// from a species recipe + seed and loads it LIVE through the bridge as one
// absolute bricks op. No world load, no plugin reload.
//
//   node trees/tree.mjs [--kind oak|pine|birch|willow|palm|dead|cherry|autumn|random]
//        [--seed N] [--size S] [--at X Y [Z] | --here [player]]
//        [--forest N --radius R] [--preview F.png] [--gallery] [--deploy] [--undo [N]]
//   --gallery: one of each species (preview only)
//
// Growth: a recursive branch skeleton (tapered capsules, wobble, gravity/light
// bend, species rules for whorls, fronds and hanging curtains) + leaf clumps
// (noisy ellipsoids). Wood voxelizes at 4 units, leaves at 8; each material is
// greedy-merged into PB_DefaultMicroBrick boxes, so a tree never overlaps
// itself. Ground z comes from the live map's chunks (mapgen/out_rebuild by
// default, --map DIR), the highest brick under the trunk footprint (poles
// = old trees and lamps are ignored; groves skip spots near them and steep spots).
// Each tree gets its own owner ("Tree <kind> <seed>") so --undo can remove it
// with br.Bricks.Clear without touching the map. Log: trees/placed.jsonl.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { worldBox } from '../mapgen/orient.mjs';
import { FIXED } from '../mapgen/builder.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const HOST = 'pzedlo.hopto.org';
const NODE = '~/node22/bin/node';
const LOG = path.join(HERE, 'placed.jsonl');

// ------------------------------------------------------------------ random --
function rng(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(r.range(a, b + 1));
  r.pick = a => a[Math.floor(r() * a.length)];
  return r;
}
const hash3 = (x, y, z, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + k * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// smooth 3D value noise for leaf clump edges
function vnoise(x, y, z, k) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(fx), v = s(fy), w = s(fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, l) => hash3(xi + i, yi + j, zi + l, k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ------------------------------------------------------------------ vectors --
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = a => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// rotate dir away from itself by angle `tilt`, around it by azimuth `az`
function tiltDir(d, tilt, az) {
  const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(d, ref)), v = cross(d, u);
  const side = add(mul(u, Math.cos(az)), mul(v, Math.sin(az)));
  return norm(add(mul(d, Math.cos(tilt)), mul(side, Math.sin(tilt))));
}
const deg = Math.PI / 180;

// ------------------------------------------------------------------ species --
// colors are RGB; leaf palettes are picked per clump
const SPECIES = {
  oak: { bark: [[92, 66, 44], [80, 58, 40], [100, 74, 50]], leaves: [[58, 112, 44], [70, 128, 50], [48, 98, 40], [82, 138, 56]], h: 150, r: 15, depth: 4, kids: [2, 3], spread: [28, 52], lenK: 0.72, rK: 0.62, up: 0.15, clump: [34, 26], wobble: 0.22 },
  autumn: { base: 'oak', leaves: [[214, 112, 34], [196, 62, 34], [232, 170, 48], [170, 80, 30]] },
  cherry: { base: 'oak', bark: [[74, 48, 44], [64, 42, 40]], leaves: [[246, 182, 206], [240, 160, 192], [252, 214, 228], [228, 140, 176]], h: 120, spread: [40, 64], up: 0.05, clump: [30, 20] },
  birch: { bark: [[232, 228, 218], [220, 216, 206]], mark: [40, 38, 36], leaves: [[120, 168, 64], [140, 184, 72], [104, 152, 56]], h: 190, r: 9, depth: 3, kids: [2, 3], spread: [22, 38], lenK: 0.62, rK: 0.6, up: 0.4, clump: [30, 26], wobble: 0.15, leader: true },
  pine: { kind: 'pine', bark: [[84, 60, 42], [72, 52, 38]], leaves: [[40, 82, 50], [34, 72, 46], [48, 92, 56]], h: 230, r: 12 },
  palm: { kind: 'palm', bark: [[150, 120, 82], [126, 98, 66]], leaves: [[74, 140, 52], [62, 124, 46], [88, 150, 60]], nut: [92, 64, 34], h: 210, r: 9 },
  willow: { base: 'oak', bark: [[86, 70, 52], [76, 62, 46]], leaves: [[118, 160, 70], [100, 146, 60], [132, 172, 80]], h: 140, spread: [30, 48], up: 0.3, clump: [26, 20], curtain: true },
  dead: { base: 'oak', bark: [[110, 104, 96], [92, 88, 82], [124, 118, 108]], leaves: null, depth: 5, kids: [2, 3], spread: [30, 58], lenK: 0.7, rK: 0.6, wobble: 0.4 },
};
const spec = k => { const s = SPECIES[k]; return s.base ? { ...SPECIES[s.base], ...s } : s; };

// ------------------------------------------------------------------ growth --
// output: segs [{a, b, ra, rb, c}] and clumps [{p, rx, ry, rz, c}] in units, base at (0,0,0)
function grow(kind, seed, size) {
  const R = rng(seed * 2654435761 + kind.length * 97);
  const S = spec(kind);
  const segs = [], clumps = [];
  const bark = () => R.pick(S.bark);
  const leaf = () => R.pick(S.leaves);
  const H = S.h * size * R.range(0.85, 1.15), R0 = S.r * size * R.range(0.9, 1.15);

  // a curved limb: n pieces from p along d, bending toward `pull` (gravity or light)
  function limb(p, d, len, ra, rb, c, wob, pull = [0, 0, 0], n = 4) {
    let q = p, dir = d;
    for (let i = 0; i < n; i++) {
      dir = norm(add(add(dir, mul([R.range(-1, 1), R.range(-1, 1), R.range(-1, 1)], wob)), mul(pull, 1 / n)));
      const e = add(q, mul(dir, len / n));
      segs.push({ a: q, b: e, ra: ra + (rb - ra) * i / n, rb: ra + (rb - ra) * (i + 1) / n, c });
      q = e;
    }
    return { end: q, dir };
  }
  // root flare: short limbs out along the ground, kept above z 0
  const roots = R.int(4, 6);
  for (let i = 0; i < roots; i++) {
    const az = (i / roots) * 2 * Math.PI + R.range(-0.3, 0.3);
    const d = [Math.cos(az), Math.sin(az), 0];
    segs.push({ a: [0, 0, R0 * 0.8], b: [d[0] * R0 * 2.4, d[1] * R0 * 2.4, 2], ra: R0 * 0.55, rb: R0 * 0.2, c: bark() });
  }

  if (S.kind === 'pine') {
    // straight leader, whorls of drooping branches shorter toward the top, needle pads along them
    const top = limb([0, 0, 0], [0, 0, 1], H, R0, R0 * 0.25, bark(), 0.02, [0, 0, 0], 6).end;
    const whorls = Math.round(H / (26 * size));
    for (let w = 0; w < whorls; w++) {
      const t = 0.22 + 0.74 * w / whorls, z = H * t, reach = (1 - t) * H * 0.42 + 14 * size;
      const n = R.int(4, 6), az0 = R() * 6.28;
      for (let i = 0; i < n; i++) {
        const az = az0 + i * 6.28 / n + R.range(-0.3, 0.3);
        const d = norm([Math.cos(az), Math.sin(az), R.range(-0.35, -0.05)]);
        const { end } = limb([0, 0, z], d, reach, Math.max(2.5, R0 * 0.3 * (1 - t)), 2, bark(), 0.05, [0, 0, -0.15], 2);
        const c = leaf();
        for (let k = 1; k <= 3; k++) {
          const p = add([0, 0, z], mul(add(end, [0, 0, -z]), k / 3));
          const s = (0.6 + 0.4 * k / 3) * (12 + reach * 0.25);
          clumps.push({ p: add(p, [0, 0, -2]), rx: s, ry: s, rz: s * 0.45, c });
        }
      }
    }
    clumps.push({ p: add(top, [0, 0, -6]), rx: 14 * size, ry: 14 * size, rz: 22 * size, c: leaf() });
  } else if (S.kind === 'palm') {
    // leaning curved trunk, a crown of arched fronds, coconuts under it
    const lean = R() * 6.28;
    const d0 = norm([Math.cos(lean) * 0.25, Math.sin(lean) * 0.25, 1]);
    const { end: crown } = limb([0, 0, 0], d0, H, R0, R0 * 0.8, null, 0.04, [-d0[0] * 0.4, -d0[1] * 0.4, 0.4], 7);
    const fronds = R.int(7, 10), az0 = R() * 6.28;
    for (let i = 0; i < fronds; i++) {
      const az = az0 + i * 6.28 / fronds + R.range(-0.2, 0.2), L = R.range(70, 100) * size, c = leaf();
      const rise = R.range(0.3, 0.8);
      for (let k = 1; k <= 9; k++) {
        const t = k / 9, out = L * t, up = L * (rise * t - (rise + 0.7) * t * t);
        const p = add(crown, [Math.cos(az) * out, Math.sin(az) * out, up]);
        const w = (1 - Math.abs(t - 0.45) * 1.5) * 16 * size + 5;
        clumps.push({ p, rx: w, ry: w, rz: 6, c, flat: true });
      }
    }
    for (let i = 0; i < R.int(2, 4); i++) {
      const az = R() * 6.28;
      clumps.push({ p: add(crown, [Math.cos(az) * 9, Math.sin(az) * 9, -10]), rx: 6, ry: 6, rz: 7, c: S.nut, wood: true });
    }
  } else {
    // broadleaf: trunk -> recursive forks (birch keeps a leader), clumps at the twig ends
    const trunkLen = H * R.range(0.38, 0.5);
    const tr = limb([0, 0, 0], tiltDir([0, 0, 1], R.range(0, 8) * deg, R() * 6.28), trunkLen, R0, R0 * 0.8, bark(), S.wobble * 0.3, [0, 0, 0], 4);
    const branch = (p, d, len, r, depth) => {
      const isTwig = depth === 0 || r < 2.2;
      const pull = S.curtain ? [0, 0, -0.2] : [0, 0, S.up];
      const { end, dir } = limb(p, d, len, r, Math.max(1.5, r * S.rK), bark(), S.wobble, pull, 3);
      if (isTwig) {
        if (!S.leaves) return;
        const s = S.clump[0] * size * R.range(0.8, 1.25);
        const c = leaf();
        clumps.push({ p: end, rx: s, ry: s, rz: S.clump[1] * size * R.range(0.8, 1.2), c });
        if (S.curtain) {
          // willow: strands hanging from the clump toward the ground
          for (let k = 0; k < R.int(5, 8); k++) {
            const az = R() * 6.28, rr = s * R.range(0.4, 1.0);
            const top = add(end, [Math.cos(az) * rr, Math.sin(az) * rr, 0]);
            const drop = Math.min(top[2] - 16, R.range(0.45, 0.85) * top[2]);
            clumps.push({ p: top, strand: drop, c });
          }
        }
        return;
      }
      const n = R.int(...S.kids), az0 = R() * 6.28;
      for (let i = 0; i < n; i++) {
        const leader = S.leader && i === 0;
        const nd = leader ? tiltDir(dir, R.range(0, 10) * deg, R() * 6.28) : tiltDir(dir, R.range(...S.spread) * deg, az0 + i * 6.28 / n + R.range(-0.5, 0.5));
        branch(end, nd, len * S.lenK * R.range(0.85, 1.15) * (leader ? 1.1 : 1), r * S.rK * (leader ? 1.15 : 1), depth - (leader ? 0.5 : 1));
      }
    };
    const n = R.int(2, 3) + (S.leader ? 0 : 1), az0 = R() * 6.28;
    for (let i = 0; i < n; i++) {
      const leader = S.leader && i === 0;
      const nd = leader ? tr.dir : tiltDir(tr.dir, R.range(...S.spread) * deg, az0 + i * 6.28 / n);
      branch(tr.end, nd, H * 0.34 * (leader ? 1.2 : 1), R0 * 0.7, S.depth - 1);
    }
  }
  return { segs, clumps, S };
}

// ------------------------------------------------------------------ voxels --
const WV = 4, LV = 8; // wood / leaf voxel sizes (units)
function voxelize({ segs, clumps, S }, seed) {
  const wood = new Map(), leaves = new Map(); // key "i,j,k" -> color index
  const colors = [], cidx = c => { const k = c.join(); let i = colors.findIndex(x => x.join() === k); if (i < 0) i = colors.push(c) - 1; return i; };
  const K = (i, j, k) => i + ',' + j + ',' + k;
  const birch = !!S.mark;
  for (const s of segs) {
    const r = Math.max(s.ra, s.rb) + WV;
    const lo = [0, 1, 2].map(a => Math.floor((Math.min(s.a[a], s.b[a]) - r) / WV)), hi = [0, 1, 2].map(a => Math.ceil((Math.max(s.a[a], s.b[a]) + r) / WV));
    const ab = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = Math.max(0, lo[2]); k <= hi[2]; k++) {
      const p = [(i + 0.5) * WV, (j + 0.5) * WV, (k + 0.5) * WV];
      let t = ((p[0] - s.a[0]) * ab[0] + (p[1] - s.a[1]) * ab[1] + (p[2] - s.a[2]) * ab[2]) / L2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p[0] - s.a[0] - ab[0] * t, p[1] - s.a[1] - ab[1] * t, p[2] - s.a[2] - ab[2] * t);
      if (d > Math.max(WV * 0.55, s.ra + (s.rb - s.ra) * t)) continue;
      let c = s.c ?? (k % 4 < 2 ? S.bark[0] : S.bark[1]); // palm: ringed trunk
      if (birch && s.ra > 3 && hash3(Math.floor(Math.atan2(p[1], p[0]) * 2), Math.floor(k / 2), 0, seed) < 0.12) c = S.mark;
      wood.set(K(i, j, k), cidx(c));
    }
  }
  const woodIn = (i, j, k) => { // any 4-unit wood voxel inside leaf cell (i,j,k)?
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) if (wood.has(K(i * 2 + a, j * 2 + b, k * 2 + c))) return true;
    return false;
  };
  for (const cl of clumps) {
    const ci = cidx(cl.c);
    if (cl.wood) { // coconut: wood grid sphere
      for (let i = Math.floor((cl.p[0] - cl.rx) / WV); i <= Math.ceil((cl.p[0] + cl.rx) / WV); i++)
        for (let j = Math.floor((cl.p[1] - cl.ry) / WV); j <= Math.ceil((cl.p[1] + cl.ry) / WV); j++)
          for (let k = Math.floor((cl.p[2] - cl.rz) / WV); k <= Math.ceil((cl.p[2] + cl.rz) / WV); k++) {
            const q = [((i + 0.5) * WV - cl.p[0]) / cl.rx, ((j + 0.5) * WV - cl.p[1]) / cl.ry, ((k + 0.5) * WV - cl.p[2]) / cl.rz];
            if (q[0] ** 2 + q[1] ** 2 + q[2] ** 2 <= 1 && !wood.has(K(i, j, k)) && !leaves.has(K(Math.floor(i / 2), Math.floor(j / 2), Math.floor(k / 2)))) wood.set(K(i, j, k), ci);
          }
      continue;
    }
    if (cl.strand) { // one leaf column, broken now and then
      const i = Math.floor(cl.p[0] / LV), j = Math.floor(cl.p[1] / LV), k1 = Math.floor(cl.p[2] / LV), k0 = Math.max(1, Math.floor((cl.p[2] - cl.strand) / LV));
      for (let k = k0; k <= k1; k++) if (hash3(i, j, k, seed + 7) > 0.12 && !woodIn(i, j, k) && !leaves.has(K(i, j, k))) leaves.set(K(i, j, k), ci);
      continue;
    }
    const pad = LV;
    for (let i = Math.floor((cl.p[0] - cl.rx - pad) / LV); i <= Math.ceil((cl.p[0] + cl.rx + pad) / LV); i++)
      for (let j = Math.floor((cl.p[1] - cl.ry - pad) / LV); j <= Math.ceil((cl.p[1] + cl.ry + pad) / LV); j++)
        for (let k = Math.max(1, Math.floor((cl.p[2] - cl.rz - pad) / LV)); k <= Math.ceil((cl.p[2] + cl.rz + pad) / LV); k++) {
          const p = [(i + 0.5) * LV, (j + 0.5) * LV, (k + 0.5) * LV];
          const q = [(p[0] - cl.p[0]) / cl.rx, (p[1] - cl.p[1]) / cl.ry, (p[2] - cl.p[2]) / cl.rz];
          const d = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2);
          const n = cl.flat ? 0 : (vnoise(p[0] / 18, p[1] / 18, p[2] / 18, seed) - 0.5) * 0.7;
          if (d > 1 + n || leaves.has(K(i, j, k)) || woodIn(i, j, k)) continue;
          // flat bottoms read as cartoon trees: thin the underside a little
          if (!cl.flat && q[2] < -0.55 && hash3(i, j, k, seed + 3) < 0.5) continue;
          leaves.set(K(i, j, k), ci);
        }
  }
  return { wood, leaves, colors };
}

// greedy 3D box merge of one voxel map -> [{lo:[i,j,k], hi:[i,j,k] exclusive, c}]
function merge(vox) {
  const out = [], done = new Set();
  const keys = [...vox.keys()].map(s => s.split(',').map(Number)).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const K = (i, j, k) => i + ',' + j + ',' + k;
  const ok = (i, j, k, c) => { const s = K(i, j, k); return !done.has(s) && vox.get(s) === c; };
  for (const [i, j, k] of keys) {
    if (done.has(K(i, j, k))) continue;
    const c = vox.get(K(i, j, k));
    let x1 = i + 1; while (ok(x1, j, k, c)) x1++;
    let y1 = j + 1; while ((() => { for (let x = i; x < x1; x++) if (!ok(x, y1, k, c)) return false; return true; })()) y1++;
    let z1 = k + 1; while ((() => { for (let x = i; x < x1; x++) for (let y = j; y < y1; y++) if (!ok(x, y, z1, c)) return false; return true; })()) z1++;
    for (let x = i; x < x1; x++) for (let y = j; y < y1; y++) for (let z = k; z < z1; z++) done.add(K(x, y, z));
    out.push({ lo: [i, j, k], hi: [x1, y1, z1], c });
  }
  return out;
}

export function buildTree(kind, seed, size = 1) {
  const g = grow(kind, seed, size);
  const { wood, leaves, colors } = voxelize(g, seed);
  const bricks = [];
  for (const [vox, V] of [[wood, WV], [leaves, LV]])
    for (const b of merge(vox)) {
      const lo = b.lo.map(v => v * V), hi = b.hi.map(v => v * V);
      bricks.push({ asset: 'PB_DefaultMicroBrick', position: [0, 1, 2].map(a => (lo[a] + hi[a]) / 2), size: [0, 1, 2].map(a => (hi[a] - lo[a]) / 2), color: colors[b.c] });
    }
  return bricks;
}

// ------------------------------------------------------------------ ground --
function groundAt(points, mapDir, foot = 20) {
  const res = points.map(() => ({ z: -Infinity, poleNear: false, zc: -Infinity, zw: -Infinity }));
  for (const f of fs.readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f))) {
    for (const op of JSON.parse(fs.readFileSync(path.join(mapDir, f), 'utf8')).ops) {
      if (op.op !== 'bricks') continue;
      for (const b of op.bricks) {
        const [lo, hi] = worldBox(b, FIXED);
        points.forEach(([x, y], n) => {
          if (b.asset === 'PB_DefaultPole') {
            if (lo[0] < x + 90 && hi[0] > x - 90 && lo[1] < y + 90 && hi[1] > y - 90) res[n].poleNear = true;
            return;
          }
          if (lo[0] < x + 80 && hi[0] > x - 80 && lo[1] < y + 80 && hi[1] > y - 80) res[n].zw = Math.max(res[n].zw, hi[2]);
          if (lo[0] < x + foot && hi[0] > x - foot && lo[1] < y + foot && hi[1] > y - foot) {
            res[n].z = Math.max(res[n].z, hi[2]);
            if (lo[0] <= x && hi[0] >= x && lo[1] <= y && hi[1] >= y) res[n].zc = Math.max(res[n].zc, hi[2]);
          }
        });
      }
    }
  }
  return res;
}

// ------------------------------------------------------------------ preview --
function png(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// side (x-z, lit from the left) + top views of several trees side by side
function preview(file, trees) {
  const px = 2, cellW = 260, H = 340, W = cellW * trees.length;
  const img = Buffer.alloc(W * (H + cellW) * 3);
  for (let i = 0; i < img.length; i += 3) { img[i] = 196; img[i + 1] = 222; img[i + 2] = 240; }
  trees.forEach(({ bricks, label }, t) => {
    const zb = new Float32Array(W * (H + cellW)).fill(-1e9);
    const plot = (X, Y, depth, c, shade) => {
      if (X < t * cellW || X >= (t + 1) * cellW || Y < 0 || Y >= H + cellW) return;
      const n = Y * W + X; if (depth <= zb[n]) return; zb[n] = depth;
      for (let a = 0; a < 3; a++) img[n * 3 + a] = Math.min(255, c[a] * shade);
    };
    for (let i = 0; i < 4 * px * cellW; i++) { const n = (H - 4 + Math.floor(i / cellW / px)) * W + t * cellW + (i % cellW); if (n < W * H) img.set([110, 150, 70], n * 3); }
    for (const b of bricks) {
      const lo = b.position.map((p, a) => p - b.size[a]), hi = b.position.map((p, a) => p + b.size[a]);
      for (let x = lo[0]; x < hi[0]; x += px) for (let z = lo[2]; z < hi[2]; z += px)
        plot(t * cellW + cellW / 2 + Math.floor(x / px), H - 4 - Math.floor(z / px), -lo[1], b.color, 0.8 + 0.2 * (x - lo[0]) / (hi[0] - lo[0] + 1));
      for (let x = lo[0]; x < hi[0]; x += px) for (let y = lo[1]; y < hi[1]; y += px)
        plot(t * cellW + cellW / 2 + Math.floor(x / px), H + cellW / 2 + Math.floor(y / px), hi[2], b.color, 0.6 + 0.4 * Math.min(1, hi[2] / 250));
    }
    void label;
  });
  png(file, W, H + cellW, img);
}

// ------------------------------------------------------------------ bridge --
function job(ops) {
  const out = execFileSync('ssh', [HOST, `cd ~/omegga-server/bridge/tools && ${NODE} job.mjs`], { input: JSON.stringify({ ops }), maxBuffer: 64 << 20 }).toString();
  return JSON.parse(out);
}
const uuidFor = s => { const h = crypto.createHash('sha1').update('tree:' + s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

// ------------------------------------------------------------------ cli --
function main() {
  const argv = process.argv.slice(2), opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const vals = []; while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) vals.push(argv[++i]);
    opt[a.slice(2)] = vals.length ? vals : true;
  }
  const one = (k, d) => (opt[k] === undefined ? d : opt[k] === true ? true : opt[k][0]);

  if (opt.undo) {
    const n = +(one('undo', 1) === true ? 1 : one('undo', 1));
    const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
    const gone = lines.splice(-n);
    job(gone.map(l => ({ op: 'cmd', line: `br.Bricks.Clear ${JSON.parse(l).owner.id} 1` })));
    fs.writeFileSync(LOG, lines.map(l => l + '\n').join(''));
    console.log(`removed ${gone.length} tree(s)`);
    return;
  }

  const kinds = Object.keys(SPECIES);
  const kindArg = one('kind', 'random'), size = +one('size', 1);
  const seed0 = +one('seed', Math.floor(Math.random() * 1e9));
  const R = rng(seed0 + 1);
  const count = +one('forest', 1);
  // random = one species for the whole grove, mixed = any species per tree
  const groveKind = kindArg === 'random' ? R.pick(kinds) : kindArg;
  const pickKind = () => (kindArg === 'mixed' ? R.pick(kinds) : groveKind);

  // where: --at X Y [Z], --here [player] (player's x y), else a preview at the origin
  let centre = null, z0 = null;
  if (opt.at) { centre = opt.at.slice(0, 2).map(Number); if (opt.at[2] !== undefined) z0 = +opt.at[2]; }
  if (opt.here) {
    const who = opt.here === true ? 'soapstain22' : opt.here.join(' ');
    const ps = job([{ op: 'players' }]).results[0];
    const p = ps.find(q => q.name.toLowerCase().includes(who.toLowerCase())) ?? ps.find(q => q.id === '891c4675-d18a-4ce1-a465-f4193ffe8b39') ?? ps[0];
    if (!p) throw new Error('nobody online');
    centre = [p.pos[0], p.pos[1]];
    console.log(`at ${p.name}: ${p.pos.map(Math.round).join(' ')}`);
  }

  // spots: one tree at the centre, or a grove scattered round it (keeps 1.6 canopies apart)
  const spots = [];
  if (centre) {
    const rad = +one('radius', 600);
    for (let tries = 0; spots.length < count && tries < count * 40; tries++) {
      const a = R() * 6.28, d = count === 1 ? 0 : Math.sqrt(R()) * rad;
      const xy = [Math.round((centre[0] + Math.cos(a) * d) / 2) * 2, Math.round((centre[1] + Math.sin(a) * d) / 2) * 2];
      if (spots.some(s => Math.hypot(s.xy[0] - xy[0], s.xy[1] - xy[1]) < 170 * size)) continue;
      spots.push({ xy, kind: pickKind(), seed: seed0 + spots.length * 7919 });
    }
    if (z0 === null) {
      const g = groundAt(spots.map(s => s.xy), path.resolve(ROOT, one('map', 'mapgen/out_rebuild')));
      if (opt.debug) console.log(g);
      spots.forEach((s, n) => { s.z = g[n].z; s.bad = !isFinite(g[n].z) || (count > 1 && (g[n].poleNear || g[n].z - g[n].zc > 26 || g[n].zw > g[n].z + 60)); });
    } else spots.forEach(s => { s.z = z0; });
  } else if (opt.gallery) kinds.forEach((kind, i) => spots.push({ xy: [0, 0], z: 0, kind, seed: seed0 + i * 7919 }));
  else for (let i = 0; i < count; i++) spots.push({ xy: [0, 0], z: 0, kind: pickKind(), seed: seed0 + i * 7919 });

  const trees = spots.filter(s => !s.bad).map(s => ({ ...s, bricks: buildTree(s.kind, s.seed, size) }));
  for (const t of trees) console.log(`${t.kind} seed ${t.seed}: ${t.bricks.length} bricks${centre ? ` at ${t.xy.join(' ')} z ${t.z}` : ''}`);
  if (spots.length > trees.length) console.log(`skipped ${spots.length - trees.length} spot(s): steep, off the map or next to an old tree`);
  if (opt.preview) { preview(one('preview'), trees.slice(0, 8)); console.log('preview', one('preview')); }
  if (!opt.deploy) return;
  if (!centre) throw new Error('--deploy needs --at or --here');

  const ops = [];
  for (const t of trees) {
    const owner = { id: uuidFor(`${t.kind}:${t.seed}:${t.xy}`), name: `Tree ${t.kind} ${t.seed}` };
    const zb = t.z;
    ops.push({ op: 'bricks', at: [0, 0, 0], owner, captureMs: 600, bricks: t.bricks.map(b => ({ ...b, position: [b.position[0] + t.xy[0], b.position[1] + t.xy[1], b.position[2] + zb] })) });
    t.owner = owner;
  }
  const res = job(ops);
  trees.forEach((t, n) => {
    const r = res.results[n];
    const rej = (r?.log ?? []).join(' ').match(/overlapping[^(]*\((\d+)\)/);
    console.log(`  ${t.kind}: loaded ${r?.count}${rej ? `, ${rej[1]} rejected (overlap)` : ''}`);
    fs.appendFileSync(LOG, JSON.stringify({ kind: t.kind, seed: t.seed, at: [...t.xy, t.z], owner: t.owner, bricks: t.bricks.length, when: new Date().toISOString() }) + '\n');
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
