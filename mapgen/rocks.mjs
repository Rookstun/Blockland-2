// Rock tool (owner 2026-10-13: "make a rock tool that generates stones and use it as a
// natural wall to lower and raise water levels that stray too much").
//
// A rock = a union of noisy ellipsoid blobs voxelized at RV units, every voxel a stone
// tone from 3D noise (moss on some top faces), greedy-merged per colour into
// PB_DefaultMicroBrick boxes (trees/tree.mjs merge), so a rock never overlaps itself.
// `allow(x, y, z)` (world units, voxel min corner) keeps voxels out of the ground or
// anything else; mapgen uses it for the river weirs.
//
//   node mapgen/rocks.mjs --at X Y Z | --here [player]  [--size R] [--count N] [--seed S]
//                         [--deploy] [--undo [N]]
//   --size: blob radius in units (default 40), --count: blobs in the pile (default 3).
//   Without --deploy it only prints what it would build. Each pile has its own owner
//   ("Rock <seed>") so --undo removes it (log mapgen/rocks_placed.jsonl).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { mergeVoxels } from '../trees/tree.mjs';
import { orientFor } from './orient.mjs';

export const RV = 10; // voxel size (units): 1-stud micro bricks (owner 2026-10-13: "make them 1.0 microbricks with wedges corners and ramps")
export const STONE = [[128, 124, 118], [112, 108, 104], [140, 136, 128], [98, 96, 94], [150, 146, 136]];
const MOSS = [[86, 112, 60], [72, 98, 52]];
const RAMP_ROT = { '-1,0': 0, '0,-1': 1, '1,0': 2, '0,1': 3 }; // micro ramp rotation 0 rises toward -x

const hash3 = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t);
export function noise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), a = sm(x - xi), b = sm(y - yi), c = sm(z - zi);
  const L = (p, q, t) => p + (q - p) * t, v = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
  return L(L(L(v(0, 0, 0), v(1, 0, 0), a), L(v(0, 1, 0), v(1, 1, 0), a), b), L(L(v(0, 0, 1), v(1, 0, 1), a), L(v(0, 1, 1), v(1, 1, 1), a), b), c);
}

/**
 * blobs: [{ c: [x, y, z], r: [rx, ry, rz], seed }] in world units.
 * opts: { allow(x, y, z) -> bool, seed, moss (0..1 share of top faces), palette }
 * Returns micro bricks in world coordinates.
 */
export function buildRocks(blobs, { allow = () => true, seed = 1, moss = 0.35, palette = STONE } = {}) {
  const vox = new Map(), K = (i, j, k) => i + ',' + j + ',' + k;
  for (const bl of blobs) {
    const [cx, cy, cz] = bl.c, [rx, ry, rz] = bl.r, s = bl.seed ?? seed;
    const i0 = Math.floor((cx - rx * 1.3) / RV), i1 = Math.ceil((cx + rx * 1.3) / RV);
    const j0 = Math.floor((cy - ry * 1.3) / RV), j1 = Math.ceil((cy + ry * 1.3) / RV);
    const k0 = Math.floor((cz - rz * 1.3) / RV), k1 = Math.ceil((cz + rz * 1.3) / RV);
    for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) for (let k = k0; k < k1; k++) {
      const x = (i + 0.5) * RV, y = (j + 0.5) * RV, z = (k + 0.5) * RV;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
      // lumpy surface: two octaves of noise push the radius in and out; flatter under, rounder on top
      const n = noise(x / 26, y / 26, z / 26, s) * 0.55 + noise(x / 13, y / 13, z / 13, s + 7) * 0.25;
      if (d > 0.75 + n * 0.7) continue;
      if (!allow(i * RV, j * RV, k * RV)) continue;
      vox.set(K(i, j, k), 0);
    }
  }
  return rocksFromVoxels(vox, { allow, seed, moss, palette });
}

/** vox: Map 'i,j,k' -> any (voxel grid RV, i = floor(x / RV)); colours, merges and caps it like buildRocks */
export function rocksFromVoxels(vox, { allow = () => true, seed = 1, moss = 0.35, palette = STONE } = {}) {
  const K = (i, j, k) => i + ',' + j + ',' + k;
  // colours: banded stone tones from low-frequency noise, moss where the top is open
  const pal = [...palette, ...MOSS];
  for (const key of vox.keys()) {
    const [i, j, k] = key.split(',').map(Number);
    const t = noise(i / 4.4, j / 4.4, k / 2.4, seed + 3); // broad bands: fewer, bigger merged pieces
    let c = Math.min(palette.length - 1, Math.floor(t * palette.length));
    if (!vox.has(K(i, j, k + 1)) && hash3(i, j, k, seed + 11) < moss * noise(i / 3, j / 3, 0, seed + 5) * 1.6) c = palette.length + (hash3(i, j, k, seed) < 0.5 ? 0 : 1);
    vox.set(key, c);
  }
  const out = mergeVoxels(vox).map(b => {
    const lo = b.lo.map(v => v * RV), hi = b.hi.map(v => v * RV);
    return { asset: 'PB_DefaultMicroBrick', position: [0, 1, 2].map(a => (lo[a] + hi[a]) / 2), size: [0, 1, 2].map(a => (hi[a] - lo[a]) / 2), color: pal[b.c] };
  });
  // smoothing on top of every column, like the terrain: in the empty voxel over a column's
  // top, a micro wedge rising toward one higher side, an outer corner into two, a corner
  // piece toward a higher diagonal; opposite or three higher sides fill flat
  const tops = new Map(); // "i,j" -> highest solid k
  for (const key of vox.keys()) { const [i, j, k] = key.split(',').map(Number); const c = i + ',' + j; if (!(tops.get(c) >= k)) tops.set(c, k); }
  const T = (i, j) => tops.get(i + ',' + j) ?? -Infinity;
  const half = [RV / 2, RV / 2, RV / 2];
  for (const [c, k] of tops) {
    const [i, j] = c.split(',').map(Number);
    if (vox.has(K(i, j, k + 1))) continue;
    if (!allow(i * RV, j * RV, (k + 1) * RV)) continue;
    const up = (di, dj) => T(i + di, j + dj) >= k + 1 && vox.has(K(i + di, j + dj, k + 1));
    const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => up(a, b));
    const color = pal[vox.get(K(i, j, k))];
    const pos = [(i + 0.5) * RV, (j + 0.5) * RV, (k + 1.5) * RV];
    let piece = null;
    if (orth.length === 1) {
      // a slope that carries on downhill (the column on the other side is lower): a micro
      // ramp (rotation = the side it rises toward, BUILDING.md), else a wedge
      const [a, b] = orth[0];
      piece = T(i - a, j - b) < k
        ? { asset: 'PB_DefaultMicroRamp', direction: 4, rotation: RAMP_ROT[a + ',' + b], size: half }
        : { asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [orth[0]], half) };
    }
    else if (orth.length === 2 && orth[0][0] !== -orth[1][0] && orth[0][1] !== -orth[1][1]) piece = { asset: 'PB_DefaultMicroWedgeOuterCorner', ...orientFor('PB_DefaultMicroWedgeOuterCorner', orth, half) };
    else if (orth.length >= 2) piece = { asset: 'PB_DefaultMicroBrick', size: half };
    else {
      const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]].find(([a, b]) => up(a, b));
      if (diag) piece = { asset: 'PB_DefaultMicroWedgeCorner', ...orientFor('PB_DefaultMicroWedgeCorner', [[diag[0], 0], [0, diag[1]]], half) };
    }
    if (piece) out.push({ ...piece, position: pos, color });
  }
  return out;
}

/** a natural pile of `count` blobs of radius ~size round (x, y), sitting on ground z */
export function pile(x, y, z, size = 40, count = 3, seed = 1) {
  const R = i => hash3(seed, i, 0, 99);
  const blobs = [];
  for (let n = 0; n < count; n++) {
    const a = R(n * 3) * 6.283, d = n ? size * (0.6 + R(n * 3 + 1) * 0.6) : 0, s = size * (n ? 0.55 + R(n * 3 + 2) * 0.4 : 1);
    blobs.push({ c: [x + Math.cos(a) * d, y + Math.sin(a) * d, z + s * 0.35], r: [s, s * (0.8 + R(n + 50) * 0.4), s * (0.6 + R(n + 60) * 0.3)], seed: seed + n });
  }
  return blobs;
}

// ------------------------------------------------------------------ cli --
const HERE = path.dirname(fileURLToPath(import.meta.url)), LOG = path.join(HERE, 'rocks_placed.jsonl');
const job = ops => JSON.parse(execFileSync('ssh', ['pzedlo.hopto.org', 'cd ~/omegga-server/bridge/tools && ~/node22/bin/node job.mjs'], { input: JSON.stringify({ ops }), maxBuffer: 64 << 20 }).toString());
function main() {
  const argv = process.argv.slice(2), opt = {};
  for (let i = 0; i < argv.length; i++) { if (!argv[i].startsWith('--')) continue; const v = []; while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) v.push(argv[++i]); opt[argv[i - v.length].slice(2)] = v.length ? v : true; }
  const one = (k, d) => (opt[k] === undefined ? d : opt[k] === true ? true : opt[k][0]);
  if (opt.undo) {
    const n = one('undo', 1) === true ? 1 : +one('undo', 1);
    const lines = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean) : [];
    const gone = lines.splice(-n);
    if (gone.length) job(gone.map(l => ({ op: 'cmd', line: `br.Bricks.Clear ${JSON.parse(l).owner.id} 1` })));
    fs.writeFileSync(LOG, lines.map(l => l + '\n').join(''));
    return console.log(`removed ${gone.length} pile(s)`);
  }
  let at = opt.at?.map(Number);
  if (opt.here) {
    const ps = job([{ op: 'players' }]).results[0], who = opt.here === true ? '' : opt.here.join(' ').toLowerCase();
    const p = ps.find(q => who && q.name.toLowerCase().includes(who)) ?? ps.find(q => q.id === '891c4675-d18a-4ce1-a465-f4193ffe8b39') ?? ps[0];
    if (!p) throw new Error('nobody online');
    at = [Math.round(p.pos[0] + 120), Math.round(p.pos[1]), Math.round(p.pos[2] - 26)]; // a little in front, at the feet
  }
  if (!at || at.length < 3) throw new Error('--at X Y Z or --here');
  const size = +one('size', 40), count = +one('count', 3), seed = +one('seed', Math.floor(Math.random() * 1e9));
  // nothing below the ground plane given
  const bricks = buildRocks(pile(at[0], at[1], at[2], size, count, seed), { seed, allow: (x, y, z) => z >= at[2] });
  console.log(`rock pile seed ${seed}: ${bricks.length} bricks at ${at.join(' ')}`);
  if (!opt.deploy) return;
  const h = crypto.createHash('sha1').update('rock:' + seed + at).digest('hex');
  const owner = { id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`, name: `Rock ${seed}` };
  const r = job([{ op: 'bricks', at: [0, 0, 0], owner, captureMs: 800, bricks }]).results[0];
  const rej = (r?.log ?? []).join(' ').match(/overlapping[^(]*\((\d+)\)/);
  console.log(`loaded ${r?.count}${rej ? `, ${rej[1]} rejected (overlap)` : ''}`);
  fs.appendFileSync(LOG, JSON.stringify({ seed, at, size, count, owner, bricks: bricks.length, when: new Date().toISOString() }) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
