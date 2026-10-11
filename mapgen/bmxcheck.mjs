// BMX check (2026-10-06, owner: "ensure that the paths are bmx compatible"):
// samples the riding surface every stud over every path cell (roads, town
// streets and squares, hamlet lanes) from the generated bricks, wedges and
// ramps counted as the slopes they are, and reports the steps a bike would
// hit between neighbouring samples.
//
//   node mapgen.mjs --seed S --scale K --preview P.bin   (marks path cells, flag 128)
//   node bmxcheck.mjs P.bin OUT_DIR [--step 4] [--list 20]

import fs from 'fs';
import path from 'path';
import { worldBox, ORIENT } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [pvFile, outDir, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? Number(rest[i + 1]) : d; };
const STEP = opt('--step', 4), LIST = opt('--list', 20);

// preview: mask of path cells (generator frame) and the live shift
const b = fs.readFileSync(pvFile), hl = b.readUInt32LE(4), h = JSON.parse(b.subarray(8, 8 + hl)), base = 8 + hl;
const sec = n => { const s = h.sections.find(q => q.name === n); const T = { Int16Array, Uint8Array }[s.type]; return new T(b.buffer.slice(b.byteOffset + base + s.offset, b.byteOffset + base + s.offset + s.length * T.BYTES_PER_ELEMENT)); };
const { N, CELL, X0, Y0 } = h, [SX, SY] = h.shift, flags = sec('flags');
const isPath = (cx, cy) => cx >= 0 && cy >= 0 && cx < N && cy < N && (flags[cy * N + cx] & 128) !== 0;

// samples: one per stud (10 units), indexed by live-frame stud coords
const R = 10, PER = CELL / R;
const gx0 = X0 + SX, gy0 = Y0 + SY; // live coords of the map corner
const W = N * PER;
// every surface top per sample with what sits on it, then the rideable one nearest the path's level
const tops = new Map(); // sample -> [[z, zBottomOfPiece], ...]
const rideL = sec('ride');
const top = new Float32Array(W * W).fill(-1e9), sloped = new Uint8Array(W * W);
const toS = (lx, ly) => [Math.floor((lx - gx0) / R), Math.floor((ly - gy0) / R)];
const sIsPath = (sx, sy) => isPath(Math.floor(sx / PER), Math.floor(sy / PER));

// the top surface of the smoothing pieces mapgen lays (see mapgen smoothing and
// orient.mjs): a wedge ramps along one direction; MicroWedgeCorner rises only
// where both slopes meet (min); the outer corner is a cube with its low corner
// cut off (full height except there: min(1, t1 + t2)); the triangle cap is the
// tetrahedron at its high corner (max(0, t1 + t2 - 1))
const DIAG = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // CORNER_ROT / TRI_ROT: rotation -> the corner it rises toward
const downAxes = (b2, n) => {
  const f = ORIENT[(b2.direction ?? 4) * 4 + (b2.rotation ?? 0)];
  const ax = [f([1, 0, 0]), f([0, 1, 0]), f([0, 0, 1])].slice(0, n);
  if (!ax.some(v => v[2] === 1)) return null; // not standing upright
  return ax.filter(v => v[2] === 0).map(v => [-v[0], -v[1]]); // rising directions
};
const along = ([dx, dy], lo, hi, px, py) => {
  const L = Math.abs(dx) * (hi[0] - lo[0]) + Math.abs(dy) * (hi[1] - lo[1]) || 1;
  const t = ((dx > 0 ? px - lo[0] : dx < 0 ? hi[0] - px : 0) * Math.abs(dx) + (dy > 0 ? py - lo[1] : dy < 0 ? hi[1] - py : 0) * Math.abs(dy)) / L;
  return Math.max(0, Math.min(1, t));
};
const shapeOf = b2 => {
  const a = b2.asset ?? '';
  if (a === 'PB_DefaultMicroWedge') { const d = downAxes(b2, 2); return d && d.length === 1 ? (lo, hi, px, py) => along(d[0], lo, hi, px, py) : null; }
  if (a === 'PB_DefaultMicroWedgeOuterCorner') { const d = downAxes(b2, 3); return d && d.length === 2 ? (lo, hi, px, py) => Math.min(1, along(d[0], lo, hi, px, py) + along(d[1], lo, hi, px, py)) : null; }
  if (a === 'PB_DefaultMicroWedgeCorner' && (b2.direction ?? 4) === 4) { const [dx, dy] = DIAG[b2.rotation ?? 0]; return (lo, hi, px, py) => Math.min(along([dx, 0], lo, hi, px, py), along([0, dy], lo, hi, px, py)); }
  if (a === 'PB_DefaultMicroWedgeTriangleCorner' && (b2.direction ?? 4) === 4) { const [dx, dy] = DIAG[b2.rotation ?? 0]; return (lo, hi, px, py) => Math.max(0, along([dx, 0], lo, hi, px, py) + along([0, dy], lo, hi, px, py) - 1); }
  return null;
};

let nb = 0;
for (const f of fs.readdirSync(outDir).filter(f => /^chunk_\d+\.json$/.test(f)).sort())
  for (const op of JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')).ops)
    for (const br of op.bricks) {
      if (br.collision === false || (br.asset ?? '').startsWith('B_')) continue; // wade-through water, plants, props
      // obstacles you ride round, not over: poles (wells, fountains, posts, lamps) and rail-thin pieces
      if (br.asset === 'PB_DefaultPole') continue;
      const [lo, hi] = worldBox(br, FIXED);
      if (Math.min(hi[0] - lo[0], hi[1] - lo[1]) <= 10 && hi[2] - lo[2] >= 12) continue; // rails (4) and parapets (10) along the edges
      const [s0x, s0y] = toS(lo[0], lo[1]), [s1x, s1y] = toS(hi[0] - 0.01, hi[1] - 0.01);
      let any = false;
      for (let sx = s0x; sx <= s1x && !any; sx += PER) for (let sy = s0y; sy <= s1y && !any; sy += PER) any = sIsPath(sx, sy);
      if (!any && !sIsPath(s1x, s1y)) continue;
      nb++;
      const shape = shapeOf(br);
      for (let sx = Math.max(0, s0x); sx <= Math.min(W - 1, s1x); sx++)
        for (let sy = Math.max(0, s0y); sy <= Math.min(W - 1, s1y); sy++) {
          if (!sIsPath(sx, sy)) continue;
          const px = gx0 + (sx + 0.5) * R, py = gy0 + (sy + 0.5) * R;
          const z = shape ? lo[2] + (hi[2] - lo[2]) * shape(lo, hi, px, py) : hi[2];
          if (z <= lo[2] + 0.01) continue; // no material over this point (a cap's low side)
          const i = sy * W + sx;
          (tops.get(i) ?? tops.set(i, []).get(i)).push([z, lo[2], z, shape ? 1 : 0]); // the piece fills lo..z here
        }
    }

// rideable: a top with nothing within 40 units over it (bricks whose span crosses that gap)
const HEAD = 20; // a plate's gap or less over a top: something sits on it (40 caught flower boxes over street edges)
for (const [i, list] of tops) {
  const sx = i % W, sy = (i / W) | 0, want = rideL[Math.floor(sy / PER) * N + Math.floor(sx / PER)];
  let best = -1e9, bd = Infinity, bs = 0;
  for (const [j, [z, , , sh]] of list.entries()) {
    if (list.some(([, lz, hz], o) => o !== j && lz < z + HEAD && hz > z + 0.5)) continue; // something else above, too close
    const d = Math.abs(z - want);
    if (d < bd) { bd = d; best = z; bs = sh; }
  }
  if (bd <= 60) { top[i] = best; sloped[i] = bs; } // otherwise no surface near the path level here (left out)
  if (process.env.BMX_DEBUG) { const [qx, qy] = process.env.BMX_DEBUG.split(',').map(Number), [tx, ty] = toS(qx, qy); if (tx === sx && ty === sy) console.error('debug', qx, qy, 'want', want, 'tops', JSON.stringify(list), 'picked', top[i]); }
}
// where a step is: classify by the generator cell's flags and the features
const f = h.features, tcx = f.town.fx + f.town.cells / 2, tcy = f.town.fy + f.town.cells / 2;
const classOf = (cx, cy) => {
  const fl = flags[cy * N + cx];
  if (fl & 16) return 'tunnel';
  if (fl & 1) return 'river bridge';
  if (Math.abs(cx - tcx) <= f.town.cells / 2 && Math.abs(cy - tcy) <= f.town.cells / 2) return 'town';
  if ((f.villages || []).some(v => Math.hypot(v.x - cx, v.y - cy) < 24)) return 'hamlet';
  if (sec('height')[cy * N + cx] <= h.SEA) return 'sea bridge';
  return 'road';
};
const steps = [], cls = {};
let pairs = 0;
for (let sy = 0; sy < W - 1; sy++)
  for (let sx = 0; sx < W - 1; sx++) {
    const a = top[sy * W + sx];
    if (a < -1e8) continue;
    for (const [ox, oy] of [[1, 0], [0, 1]]) {
      const c = top[(sy + oy) * W + sx + ox];
      if (c < -1e8) continue;
      pairs++;
      const dz = Math.abs(a - c);
      if (dz <= STEP) continue;
      // a lip: the jump is between two flat tops (no ramp on either side); else a steep ramp
      const lip = !sloped[sy * W + sx] && !sloped[(sy + oy) * W + sx + ox];
      const cx = Math.floor(sx / PER), cy = Math.floor(sy / PER), k = classOf(cx, cy);
      const e = (cls[k] ??= { lips: 0, bigLips: 0, steep: 0 });
      if (lip) { e.lips++; if (dz > 12) e.bigLips++; } else e.steep++;
      steps.push({ dz: Math.round(dz), lip, at: [Math.round(gx0 + (sx + 0.5) * R), Math.round(gy0 + (sy + 0.5) * R), Math.round(Math.max(a, c))], k });
    }
  }
steps.sort((p, q) => q.lip - p.lip || q.dz - p.dz);
console.log(JSON.stringify({ bricksOnPaths: nb, samplePairs: pairs, stepsOver: STEP, steps: steps.length, byPlace: cls }, null, 1));
for (const s of steps.slice(0, LIST)) console.log(`${s.dz}u ${s.lip ? 'LIP' : 'steep'} ${s.k} at live ${s.at.join(',')}`);
fs.writeFileSync(path.join(outDir, 'bmx_steps.json'), JSON.stringify(steps));
