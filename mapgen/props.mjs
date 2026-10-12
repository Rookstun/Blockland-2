// props.mjs: placing props into existing geometry (owner 2026-10-12: "make a
// handler for embedding or smoothing geometry with placed props").
//
//   const occ = makeOccupancy(bricks)          // spatial index of what is built
//   occ.hits(lo, hi) / occ.add(brick) / occ.topBelow(x0, y0, x1, y1, z)
//
//   placeVoxelProp(occ, { grids: [{ vox, V, colors }], origin }, opts) -> bricks
//     vox: Map "i,j,k" -> colour index, V voxel size (units), origin [x, y, z]
//     (on every grid's lattice). Many props can share grids (a forest): pass
//     the pooled maps with origin [0, 0, 0].
//   placeBrickProp(occ, bricks, opts) -> bricks
//
// Modes (opts.mode):
//   'embed'  : parts inside existing geometry are cut away (voxels) or dropped
//              (bricks); the rest is placed as is
//   'smooth' : embed, then every bottom voxel/brick within opts.skirt units of
//              what lies below gets a filler down to it, so the prop sits flush
//              (trunks on slopes, rocks on uneven ground)
//   'sink'   : bricks only: the whole prop is lowered onto what is below it
//              (its lowest contact), then embedded
// opts.keep(lo, hi) -> bool: an extra veto per voxel/brick (e.g. stay clear of paths low down)
// opts.mayHit(lo, hi) -> bool: false = nothing built can be there (skips the index; speed only)
// opts.skirtGrid(grid) -> bool: which voxel grids get skirt fillers in 'smooth' (e.g. wood only)
// opts.fillColor(colourOfBottom) -> colour for skirt fillers (default the bottom piece's colour)
// Everything placed is added to occ, so later props see it.
import { worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';
import { mergeVoxels } from '../trees/tree.mjs';

const CELL = 200;

export function makeOccupancy(bricks = []) {
  const grid = new Map(), boxes = [];
  const key = (x, y) => x + ',' + y;
  const add = b => {
    const [lo, hi] = Array.isArray(b) ? b : worldBox(b, FIXED);
    const n = boxes.push([lo, hi]) - 1;
    for (let x = Math.floor(lo[0] / CELL); x <= Math.floor((hi[0] - 1) / CELL); x++)
      for (let y = Math.floor(lo[1] / CELL); y <= Math.floor((hi[1] - 1) / CELL); y++)
        (grid.get(key(x, y)) ?? grid.set(key(x, y), []).get(key(x, y))).push(n);
  };
  const each = (lo, hi, fn) => {
    const seen = new Set();
    for (let x = Math.floor(lo[0] / CELL); x <= Math.floor((hi[0] - 1) / CELL); x++)
      for (let y = Math.floor(lo[1] / CELL); y <= Math.floor((hi[1] - 1) / CELL); y++)
        for (const n of grid.get(key(x, y)) ?? []) {
          if (seen.has(n)) continue;
          seen.add(n);
          const [a, b] = boxes[n];
          if (a[0] < hi[0] && lo[0] < b[0] && a[1] < hi[1] && lo[1] < b[1]) if (fn(a, b) === false) return;
        }
  };
  const hits = (lo, hi) => {
    let hit = false;
    each(lo, hi, (a, b) => { if (a[2] < hi[2] && lo[2] < b[2]) { hit = true; return false; } });
    return hit;
  };
  // the highest top at or below z under the footprint (-Infinity if nothing)
  const topBelow = (x0, y0, x1, y1, z) => {
    let t = -Infinity;
    each([x0, y0, 0], [x1, y1, 0], (a, b) => { if (b[2] <= z && b[2] > t) t = b[2]; });
    return t;
  };
  for (const b of bricks) add(b);
  return { add, hits, topBelow, size: () => boxes.length };
}

const micro = (lo, hi, color) => ({ asset: 'PB_DefaultMicroBrick', position: [0, 1, 2].map(a => (lo[a] + hi[a]) / 2), size: [0, 1, 2].map(a => (hi[a] - lo[a]) / 2), color });

export function placeVoxelProp(occ, { grids, origin = [0, 0, 0] }, { mode = 'embed', skirt = 24, keep = () => true, fillColor = c => c, mayHit = () => true, skirtGrid = () => true } = {}) {
  const out = [], stats = { cut: 0, skirts: 0 };
  const boxOf = (i, j, k, V) => [[origin[0] + i * V, origin[1] + j * V, origin[2] + k * V], [origin[0] + (i + 1) * V, origin[1] + (j + 1) * V, origin[2] + (k + 1) * V]];
  // embed: cut voxels inside existing geometry (or vetoed); finer grids first
  // so a coarse voxel holding a finer one of another grid gives way
  const order = [...grids].sort((a, b) => a.V - b.V);
  const kept = [];
  for (const g of order) {
    for (const key of [...g.vox.keys()]) {
      const [i, j, k] = key.split(',').map(Number), [lo, hi] = boxOf(i, j, k, g.V);
      let clash = !keep(lo, hi) || (mayHit(lo, hi) && occ.hits(lo, hi));
      if (!clash) for (const f of kept) if (f.V < g.V) { // finer voxels already kept inside this one
        const r = g.V / f.V;
        for (let a = 0; a < r && !clash; a++) for (let b = 0; b < r && !clash; b++) for (let c = 0; c < r; c++) if (f.vox.has((i * r + a) + ',' + (j * r + b) + ',' + (k * r + c))) { clash = true; break; }
      }
      if (clash) { g.vox.delete(key); stats.cut++; }
    }
    kept.push(g);
  }
  if (mode === 'smooth') {
    // bottom voxels (nothing of the prop right under them) within `skirt` of what
    // is below: the gap is filled with voxels of the same grid and colour, so the
    // skirts greedy-merge with the prop (gaps must be whole voxels)
    for (const g of order.filter(skirtGrid))
      for (const key of [...g.vox.keys()]) {
        const [i, j, k] = key.split(',').map(Number);
        if (order.some(h => { const r = g.V / h.V; return r >= 1 ? h.vox.has(i * r + ',' + j * r + ',' + (k * r - 1)) : h.vox.has(Math.floor(i * r) + ',' + Math.floor(j * r) + ',' + Math.floor((k * g.V - 1) / h.V)); })) continue;
        const [lo, hi] = boxOf(i, j, k, g.V);
        const t = occ.topBelow(lo[0], lo[1], hi[0], hi[1], lo[2]);
        const gap = lo[2] - t;
        if (!(gap > 0 && gap <= skirt) || gap % g.V) continue;
        const flo = [lo[0], lo[1], t], fhi = [hi[0], hi[1], lo[2]];
        if (occ.hits(flo, fhi) || !keep(flo, fhi)) continue;
        // the prop's other grids (e.g. low leaves) may already fill part of the gap
        const taken = kk => order.some(h => h !== g && (h.V >= g.V
          ? h.vox.has(Math.floor(i * g.V / h.V) + ',' + Math.floor(j * g.V / h.V) + ',' + Math.floor(kk * g.V / h.V))
          : (() => { const r = g.V / h.V; for (let x = 0; x < r; x++) for (let y = 0; y < r; y++) for (let z = 0; z < r; z++) if (h.vox.has((i * r + x) + ',' + (j * r + y) + ',' + (kk * r + z))) return true; return false; })()));
        let blocked = false;
        for (let kk = k - gap / g.V; kk < k; kk++) if (taken(kk)) { blocked = true; break; }
        if (blocked) continue;
        const c = g.colors.indexOf(fillColor(g.colors[g.vox.get(key)]));
        for (let kk = k - gap / g.V; kk < k; kk++) g.vox.set(i + ',' + j + ',' + kk, c < 0 ? g.vox.get(key) : c);
        stats.skirts++;
      }
  }
  for (const g of order)
    for (const b of mergeVoxels(g.vox)) {
      const lo = [0, 1, 2].map(a => origin[a] + b.lo[a] * g.V), hi = [0, 1, 2].map(a => origin[a] + b.hi[a] * g.V);
      out.push(micro(lo, hi, g.colors[b.c]));
      occ.add([lo, hi]);
    }
  out.stats = stats;
  return out;
}

export function placeBrickProp(occ, bricks, { mode = 'embed', skirt = 24, keep = () => true, fillColor = c => c } = {}) {
  let list = bricks.map(b => ({ ...b, position: [...b.position] }));
  const boxes = () => list.map(b => worldBox(b, FIXED));
  if (mode === 'sink') {
    // lower everything by the smallest gap between a brick's bottom and what is below it
    let drop = Infinity;
    for (const [lo, hi] of boxes()) {
      const t = occ.topBelow(lo[0], lo[1], hi[0], hi[1], lo[2]);
      if (t > -Infinity) drop = Math.min(drop, lo[2] - t);
    }
    if (drop > 0 && drop < Infinity) for (const b of list) b.position[2] -= drop - (drop % 2);
  }
  const out = [];
  const placed = [];
  for (const [n, [lo, hi]] of boxes().entries()) {
    if (occ.hits(lo, hi) || !keep(lo, hi)) continue;
    out.push(list[n]); placed.push([lo, hi, list[n]]);
    occ.add([lo, hi]);
  }
  if (mode === 'smooth') {
    for (const [lo, hi, b] of placed) {
      const t = occ.topBelow(lo[0], lo[1], hi[0], hi[1], lo[2]);
      const gap = lo[2] - t;
      if (!(gap > 0 && gap <= skirt) || gap % 2) continue;
      // under a non-box asset fill a footprint-sized micro brick
      const flo = [lo[0], lo[1], t], fhi = [hi[0], hi[1], lo[2]];
      if (occ.hits(flo, fhi) || !keep(flo, fhi)) continue;
      out.push(micro(flo, fhi, fillColor(b.color)));
      occ.add([flo, fhi]);
    }
  }
  return out;
}
