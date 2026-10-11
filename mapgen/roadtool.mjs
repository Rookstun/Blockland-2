// A street on flat ground, town style: finds the flattest open site near a
// point, levels it (fill only, never cuts terrain) and lays it in plate
// layers like the town: grass 1 plate, road 2 plates, stone 3 plates
// (sidewalks, house pads, walks), lamps along the sidewalks, and houses
// from shapedhouse.mjs on both sides facing the street.
//
//   node roadtool.mjs --near x,y [--lots 3] [--seed 1] [--search 3000]
//                     [--map out] [--job street_job.json] [--clear street_clear.json]
//
// --lots is houses per side. The street runs along the site's long axis
// (x or y, whichever gives the flattest site). The site is a rectangle of
// 40-unit terrain cells: [lot row | sidewalk | road (3) | sidewalk | lot row].
// Every terrain column in it is filled up to the site level Z (its highest
// column), so the search scores sites by the fill they need and rejects
// water, steep spots (dungeon pits) and the town.
//
// Run --clear first (trees, plants, smoothing wedges on the site), wait for
// the clears to finish, then --job (one brick load).

import fs from 'fs';
import path from 'path';
import { worldBox, turnBrick } from './orient.mjs';
import { makeBuilder, FIXED } from './builder.mjs';
import { shapedHouse } from './shapedhouse.mjs';

const CELL = 40, P = 4, WATER_Z = 270, MAX_SPREAD = +(process.argv.includes("--spread") ? process.argv[process.argv.indexOf("--spread") + 1] : 96);
const GRASS = [92, 150, 62], ROAD = [96, 92, 88], STONE = [196, 190, 180], FILL = [110, 96, 80];
const TOWN = [-13260, -10300, -8060, -5100]; // (town is pinned) // keep out (x0, y0, x1, y1)

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const [NX, NY] = opt('near', '').split(',').map(Number);
if (!Number.isFinite(NX)) throw new Error('--near x,y');
const LOTS = +opt('lots', 3), SEED = +opt('seed', 1), SEARCH = +opt('search', 3000), MAP = opt('map', 'out');

// ------------------------------------------------------------- houses --
const rnd = (a, b = 0) => { let h = Math.imul(SEED * 7919 + a, 2654435761) ^ Math.imul(b + 1, 40503); h = Math.imul(h ^ (h >>> 15), 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const KINDS = [
  { shape: 'rect', W: 32, D: 20, E: 0 }, { shape: 'rect', W: 40, D: 24, E: 0 },
  { shape: 'L', W: 40, D: 20, E: 12 }, { shape: 'L', W: 44, D: 24, E: 16 }, { shape: 'T', W: 44, D: 20, E: 12 },
];
const plans = [];
for (let n = 0; n < LOTS * 2; n++) {
  const kind = KINDS[Math.floor(rnd(n, 1) * KINDS.length)];
  const h = shapedHouse({ ...kind, storeys: 1 + Math.floor(rnd(n, 2) * 2), attic: true, seed: 1 + ((SEED * 5 + n) % 5) });
  // footprint incl. 1-stud overhang: local x -10..w-10, y -10..d-10
  plans.push({ n, kind, h, w: (kind.W + 1) * 10 + 20, d: (kind.shape === 'rect' ? kind.D + 1 : kind.D + kind.E + 1) * 10 + 20 });
}
const lotLen = p => Math.ceil(p.w / CELL) + 2;
const sideLen = s => plans.filter(p => p.n % 2 === s).reduce((a, p) => a + lotLen(p), 0);
const LEN = Math.max(sideLen(0), sideLen(1)) + 2;
const ROW = Math.max(...plans.map(p => Math.ceil(p.d / CELL))) + 3; // house + walk + back margin
const ACROSS = ROW * 2 + 5;                                            // + sidewalk, road 3, sidewalk

// ------------------------------------------------------------ terrain --
const lo = [NX - SEARCH - LEN * CELL, NY - SEARCH - LEN * CELL], hi = [NX + SEARCH + LEN * CELL, NY + SEARCH + LEN * CELL];
const onCells = v => ((v % CELL) + CELL) % CELL === 20;
const top = new Map(), decor = [], built = new Set(), solid = [], terr = [];
const ck = (gx, gy) => gx + ',' + gy;
for (const f of fs.readdirSync(MAP).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(fs.readFileSync(path.join(MAP, f))).ops) if (op.op === 'bricks') for (const b of op.bricks) {
    const box = worldBox(b, FIXED), [a, c] = box;
    if (c[0] < lo[0] || a[0] > hi[0] || c[1] < lo[1] || a[1] > hi[1]) continue;
    const terrain = (!b.asset || b.asset === 'PB_DefaultTile') && onCells(a[0]) && onCells(a[1]) && onCells(c[0]) && onCells(c[1]) && a[2] % 12 === 0 && c[2] % 12 === 0;
    if (!terrain) {
      decor.push(box);
      // anything but plants and terrain wedges is a structure: sites must avoid it
      const natural = (b.asset?.startsWith('B_') && !/CheckPoint|SpawnPoint/.test(b.asset)) || /Wedge|Ramp/.test(b.asset ?? '');
      if (!natural) solid.push(box);
      continue;
    }
    terr.push({ b, box });
    for (let gx = Math.round((a[0] + 20) / CELL); gx * CELL < c[0]; gx++)
      for (let gy = Math.round((a[1] + 20) / CELL); gy * CELL < c[1]; gy++) top.set(ck(gx, gy), Math.max(top.get(ck(gx, gy)) ?? -Infinity, c[2]));
  }

// structures: per cell, the top of anything built there (houses, villages, buried
// dungeon roofs); a site is rejected if any of it would reach the levelled ground
const solidTop = new Map();
for (const [a, c] of solid)
  for (let gx = Math.round((a[0] + 20) / CELL) - 1; gx * CELL < c[0] + 40; gx++) for (let gy = Math.round((a[1] + 20) / CELL) - 1; gy * CELL < c[1] + 40; gy++)
    solidTop.set(ck(gx, gy), Math.max(solidTop.get(ck(gx, gy)) ?? -Infinity, c[2]));

// --------------------------------------------------------------- site --
let best = null;
for (const alongX of [true, false]) {
  const [sx, sy] = alongX ? [LEN, ACROSS] : [ACROSS, LEN];
  for (let gx0 = Math.round((NX - SEARCH) / CELL); gx0 <= Math.round((NX + SEARCH) / CELL) - sx; gx0 += 2)
    for (let gy0 = Math.round((NY - SEARCH) / CELL); gy0 <= Math.round((NY + SEARCH) / CELL) - sy; gy0 += 2) {
      const x0 = gx0 * CELL - 20, y0 = gy0 * CELL - 20, x1 = x0 + sx * CELL, y1 = y0 + sy * CELL;
      if (x0 < TOWN[2] + 200 && TOWN[0] - 200 < x1 && y0 < TOWN[3] + 200 && TOWN[1] - 200 < y1) continue;
      const ts = []; let sTop = -Infinity, ok = true;
      for (let i = 0; i < sx && ok; i++) for (let j = 0; j < sy; j++) {
        const k = ck(gx0 + i, gy0 + j), t = top.get(k);
        if (t === undefined) { ok = false; break; }
        ts.push(t); sTop = Math.max(sTop, solidTop.get(k) ?? -Infinity);
      }
      if (!ok) continue;
      ts.sort((p, q) => p - q);
      const Z = Math.round(ts[ts.length >> 1] / 12) * 12;
      if (Z < WATER_Z + 36) continue;
      if (ts[ts.length - 1] - ts[0] > MAX_SPREAD || sTop > Z - 12) continue;
      const cost = ts.reduce((s, t) => s + Math.abs(t - Z), 0);
      if (!best || cost < best.fill) best = { gx0, gy0, sx, sy, alongX, Z, fill: cost, spread: ts[ts.length - 1] - ts[0] };
    }
}
console.error('built cells', solidTop.size, 'site', LEN, 'x', ACROSS);
if (!best) throw new Error(`no site within ${SEARCH} of ${NX},${NY} with under ${MAX_SPREAD} of spread`);
const { gx0, gy0, sx, sy, alongX, Z } = best;

// ---------------------------------------------------------------- lay --
const B = makeBuilder();
const cellBox = (i0, j0, i1, j1) => [(gx0 + i0) * CELL - 20, (gy0 + j0) * CELL - 20, (gx0 + i1) * CELL - 20, (gy0 + j1) * CELL - 20];
// local frame: u along the street (0..LEN), v across (0..ACROSS)
const rect = (u0, v0, u1, v1) => alongX ? cellBox(u0, v0, u1, v1) : cellBox(v0, u0, v1, u1);
// cut: every terrain brick in the site rising above Z is cleared and put back
// without the part above Z (its parts outside the site go back whole)
const S = cellBox(0, 0, sx, sy), cutClears = [], cutBack = [];
for (const { b, box: [a, c] } of terr) {
  if (c[2] <= Z || c[0] <= S[0] || a[0] >= S[2] || c[1] <= S[1] || a[1] >= S[3]) continue;
  cutClears.push([a, c]);
  const piece = (x0, y0, x1, y1, z0, z1) => { if (x1 > x0 && y1 > y0 && z1 > z0) cutBack.push({ ...b, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }); };
  const ix0 = Math.max(a[0], S[0]), ix1 = Math.min(c[0], S[2]), iy0 = Math.max(a[1], S[1]), iy1 = Math.min(c[1], S[3]);
  piece(a[0], a[1], ix0, c[1], a[2], c[2]); piece(ix1, a[1], c[0], c[1], a[2], c[2]);       // outside, west / east
  piece(ix0, a[1], ix1, iy0, a[2], c[2]); piece(ix0, iy1, ix1, c[1], a[2], c[2]);           // outside, south / north
  piece(ix0, iy0, ix1, iy1, a[2], Math.min(c[2], Z));                                        // inside, below Z
}
for (let i = 0; i < sx; i++) for (let j = 0; j < sy; j++) { const k = ck(gx0 + i, gy0 + j); top.set(k, Math.min(top.get(k), Z)); }
// fill every column up to Z, merged where the ground matches
const groups = new Map();
for (let i = 0; i < sx; i++) for (let j = 0; j < sy; j++) {
  const t = top.get(ck(gx0 + i, gy0 + j));
  if (t < Z) (groups.get(t) ?? groups.set(t, []).get(t)).push([i, j]);
}
for (const [t, cells] of groups) {
  const set = new Set(cells.map(c => c.join(','))), done = new Set();
  for (const [i, j] of cells) {
    if (done.has(i + ',' + j)) continue;
    let w = 1; while (w < 10 && set.has((i + w) + ',' + j) && !done.has((i + w) + ',' + j)) w++;
    let h = 1;
    grow: while (h < 10) { for (let a = 0; a < w; a++) if (!set.has((i + a) + ',' + (j + h)) || done.has((i + a) + ',' + (j + h))) break grow; h++; }
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) done.add((i + a) + ',' + (j + b));
    const [x0, y0, x1, y1] = cellBox(i, j, i + w, j + h);
    for (let z = t; z < Z; z += 480) B.box(x0, y0, z, x1, y1, Math.min(Z, z + 480), { color: FILL }, 'fill');
  }
}
// surface layers over Z (plates): road 2, stone 3 (sidewalks, pads, walks), grass 1
const used = new Set(); // u,v cells with a stone or road layer
const layer = (u0, v0, u1, v1, plates, color, label) => {
  const [x0, y0, x1, y1] = rect(u0, v0, u1, v1);
  B.slab(x0, y0, Z, x1, y1, Z + plates * P, { asset: 'PB_DefaultTile', color }, label, 400);
  for (let u = u0; u < u1; u++) for (let v = v0; v < v1; v++) used.add(u + ',' + v);
};
const vS0 = ROW, vRoad = ROW + 1, vS1 = ROW + 4;
layer(0, vRoad, LEN, vRoad + 3, 2, ROAD, 'road');
layer(0, vS0, LEN, vS0 + 1, 3, STONE, 'sidewalk');
layer(0, vS1, LEN, vS1 + 1, 3, STONE, 'sidewalk');
const houses = [], lots = [];
for (const side of [0, 1]) {
  let u = 1;
  for (const p of plans.filter(q => q.n % 2 === side)) {
    const lu = lotLen(p), dC = Math.ceil(p.d / CELL), wC = Math.ceil(p.w / CELL);
    const pu0 = u + Math.floor((lu - wC) / 2);
    const pv0 = side === 0 ? vS0 - 2 - dC : vS1 + 3, pv1 = pv0 + dC;
    layer(pu0, pv0, pu0 + wC, pv1, 3, STONE, 'pad');
    // front (local -y) toward the street
    const r = alongX ? (side === 0 ? 2 : 0) : (side === 0 ? 1 : 3);
    const [bx0, by0, bx1, by1] = rect(pu0, pv0, pu0 + wC, pv1);
    const cs = [[-10, -10], [p.w - 10, p.d - 10]].map(([x, y]) => turnBrick({ position: [x, y, 0] }, r).position);
    const fcx = (cs[0][0] + cs[1][0]) / 2, fcy = (cs[0][1] + cs[1][1]) / 2;
    const ox = Math.round(((bx0 + bx1) / 2 - fcx) / 10) * 10, oy = Math.round(((by0 + by1) / 2 - fcy) / 10) * 10;
    const zH = Z + 3 * P;
    for (const b of p.h.bricks) { const t = turnBrick(b, r); houses.push({ ...t, position: [t.position[0] + ox, t.position[1] + oy, t.position[2] + zH] }); }
    // walk, 2 cells wide, from the sidewalk to the front door
    const door = turnBrick({ position: [p.h.door[0] * 10, 0, 0] }, r).position;
    const dAlong = alongX ? door[0] + ox : door[1] + oy;
    const du = Math.round((dAlong - ((alongX ? gx0 : gy0) * CELL - 20)) / CELL);
    if (side === 0) layer(du - 1, pv1, du + 1, vS0, 3, STONE, 'walk');
    else layer(du - 1, vS1 + 1, du + 1, pv0, 3, STONE, 'walk');
    lots.push({ kind: `${p.kind.shape} ${p.kind.W}x${p.kind.D}${p.kind.E ? '+' + p.kind.E : ''}`, at: [ox, oy, zH], turn: r });
    u += lu;
  }
}
// grass everywhere else, merged along each row
for (let v = 0; v < ACROSS; v++) {
  let a = null;
  for (let u = 0; u <= LEN; u++) {
    const free = u < LEN && !used.has(u + ',' + v);
    if (free && a === null) a = u;
    if (!free && a !== null) { const [x0, y0, x1, y1] = rect(a, v, u, v + 1); B.slab(x0, y0, Z, x1, y1, Z + P, { asset: 'PB_DefaultTile', color: GRASS }, 'grass', 400); a = null; }
  }
}
// lamps on both sidewalks every 6 cells
for (let u = 2; u < LEN - 1; u += 6) for (const v of [vS0, vS1]) {
  const [x0, y0, x1, y1] = rect(u, v, u + 1, v + 1);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z0 = Z + 3 * P;
  B.pole(cx, cy, z0, z0 + 96, 5, { color: [46, 44, 42], material: 'BMC_Metallic' }, 'lamp');
  B.pole(cx, cy, z0 + 96, z0 + 108, 10, { color: [255, 190, 100], material: 'BMC_Glow', material_intensity: 6 }, 'lamp');
}
if (B.dropped.length) throw new Error(`street: ${B.dropped.length} overlapping pieces, e.g. ${B.dropped[0]}`);

// ------------------------------------------------------------ output --
const site = cellBox(0, 0, sx, sy);
const out = [...cutBack, ...B.bricks.map(({ label, ...b }) => b), ...houses];
const clears = decor.filter(([a, c]) => a[0] < site[2] && site[0] < c[0] && a[1] < site[3] && site[1] < c[1] && c[2] > Z - 200);
const clearOps = [...clears, ...cutClears].map(([a, c]) => ({ op: 'cmd', line: `br.World.ClearRegion ${a.map((v, k) => (v + c[k]) / 2).join(' ')} ${a.map((v, k) => (c[k] - v) / 2 + 1).join(' ')}` }));
if (clearOps.length) clearOps[clearOps.length - 1].captureMs = 4000;
const QUOTE = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';
fs.writeFileSync(opt('clear', 'street_clear.json'), JSON.stringify({ ops: clearOps }));
fs.writeFileSync(opt('job', 'street_job.json'), JSON.stringify({ ops: [
  { op: 'say', msg: `<size="40"><color="ff4040"><b>${QUOTE}</></></>` },
  { op: 'bricks', at: [0, 0, 0], owner: opt('owner', 'street'), captureMs: 15000, bricks: out },
] }));
console.log(JSON.stringify({ site, along: alongX ? 'x' : 'y', Z, spread: best.spread, fillVolume: best.fill, cells: [sx, sy], lots, decorCleared: clears.length, terrainCut: cutClears.length, bricks: out.length }));
