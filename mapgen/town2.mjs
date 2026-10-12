// A semi-freeform town (owner 2026-10-12: "the grid sucks ... semi freeform like real world with
// grids and lines and non uniform or concave geometry"). Replaces the suburb grid.
//   node town2.mjs [--seed 1] [--out out_town2]
// -> OUT/chunk_NNN.json (bridge jobs, world coordinates) for the server's chunk loader.
//
// 1. an island with a wobbly, bayed coastline (beach round the edge)
// 2. main roads: a few long lines each way at uneven spacing, gently wandering
// 3. side streets branch off them and wander (smooth random curvature); one that runs into
//    another road joins it (a loop), one that gets too close to a parallel road or the shore
//    ends in a cul-de-sac
// 4. everything is drawn on a 20-unit cell grid (stair-stepped like the terrain): asphalt,
//    pavement round it
// 5. lots of random size line both sides of every road, each facing its road (a simhouse
//    SIM_LOT house or park, turned in quarter turns), pushed back where a curve is in the way,
//    with a front path and a driveway out to the pavement; blocks come out irregular
// 6. what's left is lawn with trees; the skyscraper stands on a main road
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBuilder } from './builder.mjs';
import { planSewer, buildSewer, SEW } from './sewer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const SEED = +arg('seed', 1), OUT = join(here, arg('out', 'out_town2'));
const BASE = 380, GROUND = 270, PAD_H = Math.floor((BASE - GROUND - 12) / 4) * 4;
const C = 20, RX = 10400, RY = 8400;                      // cell size; island half extents
const NX = Math.ceil(2 * (RX + 600) / C), NY = Math.ceil(2 * (RY + 600) / C), OX0 = -NX * C / 2, OY0 = -NY * C / 2;
const ART_HW = 150, RES_HW = 100, WALK = 40;               // half widths of the asphalt; pavement width
let rs = SEED * 9301 + 49297;
const rand = () => { rs = (rs * 233280 + 49297 + 0x9e3779b9) % 4294967296; rs = Math.imul(rs ^ (rs >>> 15), 2246822519) >>> 0; return rs / 4294967296; };
const R = (a, b) => a + rand() * (b - a);
const snap = (v, g = C) => Math.round(v / g) * g;

// ---- cells: class + road id
const SEA = 9, EMPTY = 0, ROAD = 1, PAVE = 2, LOT = 3, TOWER = 4, PATH = 5, DRIVE = 6, BEACH = 7;
const cls = new Uint8Array(NX * NY), rid = new Int16Array(NX * NY).fill(-1);
const ci = (x, y) => { const i = Math.floor((x - OX0) / C), j = Math.floor((y - OY0) / C); return i < 0 || j < 0 || i >= NX || j >= NY ? -1 : j * NX + i; };
const cx = i => OX0 + (i % NX) * C + C / 2, cy = i => OY0 + Math.floor(i / NX) * C + C / 2;
// island: an ellipse whose radius wobbles with the angle (bays and headlands)
const ph = [R(0, 6.28), R(0, 6.28), R(0, 6.28), R(0, 6.28)];
const shore = (x, y) => { const t = Math.atan2(y / RY, x / RX), r = Math.hypot(x / RX, y / RY);
  return r / (1 + 0.09 * Math.sin(3 * t + ph[0]) + 0.07 * Math.sin(5 * t + ph[1]) + 0.05 * Math.sin(8 * t + ph[2]) + 0.03 * Math.sin(13 * t + ph[3])); };
for (let i = 0; i < NX * NY; i++) { const s = shore(cx(i), cy(i)); cls[i] = s > 1 ? SEA : s > 0.965 ? BEACH : EMPTY; }

// ---- roads
const roads = [];
const stampDisc = (x, y, r, k, id) => {
  const n = Math.ceil(r / C);
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const px = x + a * C, py = y + b * C;
    if (Math.hypot(a * C, b * C) > r) continue;
    const i = ci(px, py);
    if (i < 0 || cls[i] === SEA) continue;
    if (k === ROAD) { cls[i] = ROAD; rid[i] = id; }
    else if (cls[i] !== ROAD) { cls[i] = PAVE; if (rid[i] < 0) rid[i] = id; }
  }
};
function stampRoad(road) {
  const { pts, hw, id } = road;
  for (const pass of [PAVE, ROAD]) for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= L; t += 10) stampDisc(ax + (bx - ax) * t / L, ay + (by - ay) * t / L, pass === ROAD ? hw : hw + WALK, pass, id);
  }
  if (road.culdesac) { const [ex, ey] = pts[pts.length - 1]; stampDisc(ex, ey, 240 + WALK, PAVE, id); stampDisc(ex, ey, 240, ROAD, id); }
}
const inIsland = (x, y) => shore(x, y) < 0.94;
// main roads: 3 roughly east-west, 3 roughly north-south, uneven spacing, wandering a little
for (const [horiz, offs] of [[true, [-0.55, 0.02, 0.5]], [false, [-0.6, -0.05, 0.48]]]) {
  for (const o of offs) {
    const id = roads.length, pts = [], base = horiz ? 0 : Math.PI / 2;
    let x = horiz ? -RX - 400 : (o + R(-0.08, 0.08)) * RX, y = horiz ? (o + R(-0.08, 0.08)) * RY : -RY - 400, h = base, dh = 0;
    while (horiz ? x < RX + 400 : y < RY + 400) {
      pts.push([snap(x), snap(y)]);
      dh = dh * 0.8 + R(-0.03, 0.03); h = base + (h - base) * 0.92 + dh;
      x += Math.cos(h) * 200; y += Math.sin(h) * 200;
    }
    roads.push({ id, pts, hw: ART_HW, main: true });
  }
}
for (const r of roads) stampRoad(r);
// side streets
const otherRoadNear = (x, y, rad, id) => {
  const n = Math.ceil(rad / C);
  for (let a = -n; a <= n; a += 2) for (let b = -n; b <= n; b += 2) {
    if (a * a + b * b > n * n) continue;
    const i = ci(x + a * C, y + b * C);
    if (i >= 0 && (cls[i] === ROAD || cls[i] === PAVE) && rid[i] !== id) return true;
  }
  return false;
};
function growStreet(parent, k, side) {
  const [px, py] = parent.pts[k], [qx, qy] = parent.pts[Math.min(k + 1, parent.pts.length - 1)];
  const ph0 = Math.atan2(qy - py, qx - px), id = roads.length;
  let h = ph0 + side * Math.PI / 2 + R(-0.2, 0.2), curv = R(-0.035, 0.035);
  let x = px + Math.cos(h) * (parent.hw - 20), y = py + Math.sin(h) * (parent.hw - 20);
  const pts = [[snap(x), snap(y)]];
  let joined = false, steps = 0;
  const maxSteps = Math.round(R(30, 90));
  while (steps++ < maxSteps) {
    if (rand() < 0.12) curv = R(-0.045, 0.045);
    h += curv;
    const nx = x + Math.cos(h) * 100, ny = y + Math.sin(h) * 100;
    if (!inIsland(nx, ny)) break;
    const i = ci(nx, ny);
    if (steps > 4 && i >= 0 && cls[i] === ROAD && rid[i] !== id && rid[i] !== parent.id) { pts.push([snap(nx), snap(ny)]); joined = true; break; }
    // too close to a road alongside (not straight ahead): stop here
    if (steps > 6) {
      const lx = -Math.sin(h), ly = Math.cos(h);
      let blocked = false;
      for (const sg of [-1, 1]) for (let d = RES_HW + WALK + 60; d <= 1400; d += 120) {
        const ii = ci(nx + lx * sg * d, ny + ly * sg * d);
        if (ii >= 0 && cls[ii] === ROAD && rid[ii] !== id && rid[ii] !== parent.id) { blocked = true; break; }
      }
      if (blocked) break;
    }
    // a road coming up ahead: carry on and join it
    x = nx; y = ny; pts.push([snap(x), snap(y)]);
  }
  if (pts.length < 6 || (!joined && pts.length < 12)) return null; // no stubby dead ends: a cul-de-sac runs at least ~1100
  const road = { id, pts, hw: RES_HW, culdesac: !joined };
  if (road.culdesac) { // room for the turning circle?
    const [ex, ey] = pts[pts.length - 1];
    if (!inIsland(ex, ey) || otherRoadNear(ex, ey, 520, id) && !joined) { pts.splice(-3); if (pts.length < 6) return null; }
  }
  roads.push(road); stampRoad(road);
  return road;
}
const queue = roads.slice();
for (let gen = 0; gen < 4; gen++) {
  const next = [];
  for (const parent of queue) {
    for (let k = 3; k < parent.pts.length - 3; k += Math.round(R(8, 14))) {
      if (!inIsland(...parent.pts[k])) continue;
      for (const side of [-1, 1]) {
        if (rand() < [0.1, 0.2, 0.35, 0.5][gen]) continue;
        if (otherRoadNear(parent.pts[k][0] + side * 300, parent.pts[k][1] + side * 300, 260, parent.id)) continue;
        const r = growStreet(parent, k, side);
        if (r) next.push(r);
      }
    }
  }
  queue.length = 0; queue.push(...next);
}
console.error(`${roads.length} roads (${roads.filter(r => r.culdesac).length} cul-de-sacs)`);

// ---- reserve cells of a rect (world units, [x0,y0,x1,y1)) if all free
const rectCells = ([x0, y0, x1, y1]) => { const out = []; for (let y = y0 + C / 2; y < y1; y += C) for (let x = x0 + C / 2; x < x1; x += C) out.push(ci(x, y)); return out; };
const rectFree = r => rectCells(r).every(i => i >= 0 && cls[i] === EMPTY);
const reserve = (r, k) => { for (const i of rectCells(r)) cls[i] = k; };
// the rect of a lot whose front edge faces direction -d from front-centre f; d in {+x,-x,+y,-y}
const lotRect = (fx, fy, d, W, D) => {
  const [dx, dy] = d;
  if (dx) return dx > 0 ? [fx, fy - W / 2, fx + D, fy + W / 2] : [fx - D, fy - W / 2, fx, fy + W / 2];
  return dy > 0 ? [fx - W / 2, fy, fx + W / 2, fy + D] : [fx - W / 2, fy - D, fx + W / 2, fy];
};

// ---- the skyscraper: a 1400 x 1500 plaza on the south side of a main east-west road, near the middle
const TW = 1400, TD = 1500;
let towerAt = null;
{
  const r = roads[1];
  const ks = r.pts.map((_, k) => k).sort((a, b) => Math.abs(r.pts[a][0]) - Math.abs(r.pts[b][0]));
  for (const k of ks) {
    const [x, y] = r.pts[k];
    for (let gap = 0; gap <= 300 && !towerAt; gap += C) {
      const rect = [snap(x - TW / 2), snap(y - ART_HW - WALK - gap - TD), snap(x + TW / 2), snap(y - ART_HW - WALK - gap)];
      if (rectFree(rect)) { reserve(rect, TOWER); towerAt = rect; }
    }
    if (towerAt) break;
  }
  console.error(towerAt ? `skyscraper plaza at ${towerAt}` : 'no room for the skyscraper');
}

// ---- lots along every road
const lots = [];
for (const road of roads) {
  const { pts, hw } = road;
  // resample the road every 20 units, with headings
  const S = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let t = 0; t < L; t += 20) S.push([ax + (bx - ax) * t / L, ay + (by - ay) * t / L, Math.atan2(by - ay, bx - ax)]);
  }
  for (const side of [-1, 1]) {
    let s = Math.round(R(0, 20));
    while (s < S.length) {
      const [x, y, h] = S[s];
      const nx = -Math.sin(h) * side, ny = Math.cos(h) * side;
      const d = Math.abs(nx) > Math.abs(ny) ? [Math.sign(nx), 0] : [0, Math.sign(ny)];
      const W = snap(R(600, 860), 40), D = snap(R(680, 800), 40), park = rand() < 0.08; // multiples of 40: lot edges on the 20 grid
      let placed = null;
      for (let gap = 0; gap <= 360 && !placed; gap += C) for (const sh of [0, -80, 80, -160, 160]) {
        if (placed) break;
        const off = hw + WALK + gap;
        const f = [d[0] ? snap(x + d[0] * off) : snap(x + sh), d[1] ? snap(y + d[1] * off) : snap(y + sh)];
        const rect = lotRect(f[0], f[1], d, W, D);
        if (rectFree(rect)) placed = { rect, f, d, W, D, park, gap };
      }
      if (placed) { reserve(placed.rect, LOT); lots.push(placed); s += Math.round((placed.W + R(20, 120)) / 20); }
      else s += 4;
    }
  }
}
console.error(`${lots.length} lots (${lots.filter(l => l.park).length} parks)`);

// ---- build the lots (simhouse SIM_LOT), paths and driveways out to the pavement
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let nChunk = 0, total = 0;
const write = bricks => { fs.writeFileSync(join(OUT, `chunk_${String(nChunk).padStart(3, '0')}.json`), JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], bricks }] })); nChunk++; total += bricks.length; };
const YAW = { '0,1': 90, '0,-1': 270, '1,0': 0, '-1,0': 180 };
const LAT = { '0,1': [1, 0], '0,-1': [-1, 0], '1,0': [0, -1], '-1,0': [0, 1] }; // where simhouse local +x ends up
let batch = [];
lots.forEach((lot, n) => {
  const { f, d, W, D, park } = lot, key = d.join();
  const O = [f[0] - 340 * d[0], f[1] - 340 * d[1]];
  const env = { ...process.env, SIM_SEED: String(SEED * 10000 + n + 1), SIM_LOT: '1', SIM_LOT_W: String(W), SIM_LOT_D: String(D) };
  if (park) env.SIM_PARK = '1';
  const out = JSON.parse(execFileSync(process.execPath, [join(here, 'simhouse.mjs'), O[0], O[1], YAW[key], BASE, GROUND], { env, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }));
  batch.push(...out.ops.find(o => o.op === 'bricks').bricks);
  // the front path at the door, the driveway in front of the garage: cells from the lot front out to the pavement
  const lat = LAT[key], strips = [];
  if (!park) strips.push([out.meta.doorX - 30, out.meta.doorX + 30, PATH]);
  else strips.push([-20, 20, PATH]);
  if (out.meta.garage) strips.push([out.meta.garage[0] + 10, out.meta.garage[1] - 10, DRIVE]);
  for (const [a0, a1, k] of strips) {
    for (let a = a0 + C / 2; a < a1; a += C) for (let t = C / 2; t < 400; t += C) {
      const x = f[0] + lat[0] * a - d[0] * t, y = f[1] + lat[1] * a - d[1] * t, i = ci(x, y);
      if (i < 0 || cls[i] === ROAD || cls[i] === PAVE || cls[i] === SEA) break;
      if (cls[i] === EMPTY || cls[i] === BEACH) cls[i] = k;
      else break;
    }
  }
  if (batch.length > 60000) { write(batch); batch = []; }
  if ((n + 1) % 40 === 0) console.error(`${n + 1}/${lots.length} lots`);
});
if (batch.length) write(batch);

// ---- the skyscraper (its own plaza; the town's ground goes under it)
if (towerAt) {
  const [x0, y0, x1, y1] = towerAt;
  const out = JSON.parse(execFileSync(process.execPath, [join(here, 'skyscraper.mjs'), (x0 + x1) / 2, (y0 + y1) / 2, BASE, GROUND, '--nopad'], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }));
  write(out.ops.find(o => o.op === 'bricks').bricks);
}

// ---- the sewer under spawn (its own random stream: the town above stays identical)
const SEWP = arg('nosewer', null) ? null : planSewer({ cls, ci, cx, cy, NX, NY, C, roads, K: { LOT, TOWER, SEA, ROAD, PAVE } }, { seed: SEED });
const sewAt = i => SEWP && i >= 0 ? SEWP.sew[i] : 0;
if (SEWP) console.error(`sewer: ${SEWP.lines} stretches, ${SEWP.chambers.length} chambers, ${SEWP.rooms.length} side rooms (${SEWP.rooms.map(o => o.kind).join(', ')}), ${SEWP.stairs.length} stairways, ${SEWP.rats.length} rats`);

// ---- --preview FILE.bmp: the cell plan as a picture (one pixel per cell)
if (arg('preview', null)) {
  const COL = { [SEA]: [40, 90, 160], [EMPTY]: [92, 156, 68], [ROAD]: [50, 50, 54], [PAVE]: [200, 200, 196], [LOT]: [200, 120, 80], [TOWER]: [120, 60, 160], [PATH]: [230, 220, 150], [DRIVE]: [150, 150, 150], [BEACH]: [226, 210, 160] };
  const row = (NX * 3 + 3) & ~3, buf = Buffer.alloc(54 + row * NY);
  buf.write('BM'); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10); buf.writeUInt32LE(40, 14); buf.writeInt32LE(NX, 18); buf.writeInt32LE(NY, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(row * NY, 34);
  const SCOL = { 1: [60, 120, 60], 2: [150, 90, 200], 3: [90, 40, 120], 4: [200, 120, 230], 5: [150, 90, 200], 7: [255, 230, 0], 8: [255, 140, 0] };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const sw = sewAt(j * NX + i), c = (sw && SCOL[sw]) || COL[cls[j * NX + i]] || [255, 0, 255], o = 54 + j * row + i * 3; buf[o] = c[2]; buf[o + 1] = c[1]; buf[o + 2] = c[0]; }
  fs.writeFileSync(arg('preview', null), buf);
}

// ---- the ground and the surfaces: greedy rectangles over the cell classes
const B = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, b, label) => { if (x1 > x0 && y1 > y0 && z1 > z0) B.add({ asset: 'PB_DefaultMicroBrick', ...b, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, BASE + (z0 + z1) / 2] }, label); };
const pole = (x, y, z0, z1, r, b, label) => B.add({ asset: 'PB_DefaultPole', ...b, size: [r, r, (z1 - z0) / 2], position: [x, y, BASE + (z0 + z1) / 2] }, label);
function rects(test, maxCells) { // greedy: runs along x, grown down while the run repeats; capped at maxCells per side
  const used = new Uint8Array(NX * NY), out = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    if (used[k] || !test(k)) continue;
    let w = 1; while (i + w < NX && w < maxCells && !used[k + w] && test(k + w)) w++;
    let h = 1;
    grow: while (j + h < NY && h < maxCells) { for (let a = 0; a < w; a++) { const q = (j + h) * NX + i + a; if (used[q] || !test(q)) break grow; } h++; }
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) used[(j + b) * NX + i + a] = 1;
    out.push([OX0 + i * C, OY0 + j * C, OX0 + (i + w) * C, OY0 + (j + h) * C]);
  }
  return out;
}
// a rect minus hole cells (greedy inside the rect): keeps every untouched rect as it was
function splitRect(r, hole) {
  const [x0, y0, x1, y1] = r, w = (x1 - x0) / C, h = (y1 - y0) / C, i0 = (x0 - OX0) / C, j0 = (y0 - OY0) / C;
  let any = false; for (let b = 0; b < h && !any; b++) for (let a = 0; a < w; a++) if (hole((j0 + b) * NX + i0 + a)) { any = true; break; }
  if (!any) return [r];
  const used = new Uint8Array(w * h), out = [], ok = (a, b) => !used[b * w + a] && !hole((j0 + b) * NX + i0 + a);
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) {
    if (!ok(a, b)) continue;
    let rw = 1; while (a + rw < w && ok(a + rw, b)) rw++;
    let rh = 1; grow: while (b + rh < h) { for (let q = 0; q < rw; q++) if (!ok(a + q, b + rh)) break grow; rh++; }
    for (let v = 0; v < rh; v++) for (let q = 0; q < rw; q++) used[(b + v) * w + a + q] = 1;
    out.push([x0 + a * C, y0 + b * C, x0 + (a + rw) * C, y0 + (b + rh) * C]);
  }
  return out;
}
const sewHole = k => sewAt(k) !== 0, pitHole = k => sewAt(k) === SEW.OPEN;
// sand + pad under everything that is not a lot (lots carry their own ground, basements and all); the sewer cuts the pad
for (const R0 of rects(k => cls[k] !== SEA && cls[k] !== LOT, 14)) {
  for (const [x0, y0, x1, y1] of splitRect(R0, sewHole)) box(x0, y0, -12 - PAD_H, x1, y1, -12, { asset: 'PB_DefaultBrick', color: [190, 172, 128] }, 'pad');
  for (const [x0, y0, x1, y1] of splitRect(R0, pitHole)) box(x0, y0, -12, x1, y1, 0, { asset: 'PB_DefaultBrick', color: [214, 196, 142] }, 'sand');
}
const SURF = {
  [ROAD]: [0, 4, { color: [58, 58, 62] }], [PAVE]: [0, 8, { asset: 'PB_DefaultTile', color: [196, 194, 188] }],
  [PATH]: [0, 4, { asset: 'PB_DefaultTile', color: [176, 170, 160] }], [DRIVE]: [0, 4, { asset: 'PB_DefaultTile', color: [150, 148, 144] }],
  [EMPTY]: [0, 4, { asset: 'PB_DefaultBrick', color: [92, 156, 68] }], [BEACH]: [0, 4, { asset: 'PB_DefaultBrick', color: [226, 210, 160] }],
};
for (const [k, [z0, z1, b]] of Object.entries(SURF)) for (const r0 of rects(q => cls[q] === +k, 25)) for (const r of splitRect(r0, pitHole)) box(r[0], r[1], z0, r[2], r[3], z1, b, 'surface');

// ---- lane lines along the roads (dashed yellow; clear of junctions), lamp posts on the pavements
for (const road of roads) {
  const { pts, hw, id } = road;
  let along = 0, lampNext = R(100, 300), side = 1;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay) || 1, h = Math.atan2(by - ay, bx - ax);
    for (let t = 0; t < L; t += 20, along += 20) {
      const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L;
      if (along % 120 === 0 && !otherRoadNear(x, y, hw + 120, id)) {
        const i = ci(x, y);
        if (i >= 0 && cls[i] === ROAD) {
          const horiz = Math.abs(Math.cos(h)) > Math.abs(Math.sin(h)), X = snap(x, 10), Y = snap(y, 10);
          if (horiz) box(X - 20, Y - 4, 4, X + 20, Y + 4, 6, { color: [236, 196, 50] }, 'lane'); else box(X - 4, Y - 20, 4, X + 4, Y + 20, 6, { color: [236, 196, 50] }, 'lane');
        }
      }
      if (along >= lampNext) {
        const nx = -Math.sin(h) * side, ny = Math.cos(h) * side, lx = snap(x + nx * (hw + 20), 10), ly = snap(y + ny * (hw + 20), 10), i = ci(lx, ly);
        if (i >= 0 && cls[i] === PAVE && sewAt(i) !== SEW.OPEN && sewAt(i) !== SEW.RAIL) {
          pole(lx, ly, 8, 108, 3, { color: [60, 62, 66], material: 'BMC_Metallic' }, 'lamp post');
          box(lx - 6, ly - 6, 108, lx + 6, ly + 6, 118, { color: [255, 236, 190], material: 'BMC_Glow', material_intensity: 5 }, 'lamp');
          lampNext = along + R(360, 480); side = -side;
        } else lampNext = along + 40;
      }
    }
  }
}
// ---- trees on the open lawn (only where a 160 x 160 patch is all lawn)
const lawnPatch = (x, y) => { for (let a = -80; a <= 80; a += C) for (let b = -80; b <= 80; b += C) { const i = ci(x + a, y + b); if (i < 0 || cls[i] !== EMPTY || sewAt(i) === SEW.OPEN || sewAt(i) === SEW.RAIL) return false; } return true; };
let trees = 0;
for (let tries = 0; tries < 9000; tries++) {
  const x = snap(R(-RX, RX), 10), y = snap(R(-RY, RY), 10);
  if (!lawnPatch(x, y)) continue;
  pole(x, y, 4, 76, 10, { color: [92, 64, 40] }, 'trunk');
  let z = 76; const g = [[58, 120, 48], [70, 136, 56], [52, 108, 60]][trees % 3];
  for (const [rr, t] of [[34, 1], [46, 2], [40, 2], [24, 1]]) { pole(x, y, z, z + t * 12, rr, { color: g }, 'canopy'); z += t * 12; }
  for (let a = -80; a <= 80; a += C) for (let b = -80; b <= 80; b += C) { const i = ci(x + a, y + b); if (i >= 0) cls[i] = 99; } // keep trees apart
  trees++;
}
if (SEWP) buildSewer(SEWP, { box, pole, rects, cls, ci, K: { PAVE }, add: (b, l) => B.add({ ...b, position: [b.position[0], b.position[1], BASE + b.position[2]] }, l) });
if (B.dropped.length) console.error(`${B.dropped.length} town pieces dropped for overlapping, e.g.\n${B.dropped.slice(0, 5).join('\n')}`);
write(B.bricks.map(({ label, ...b }) => b));
fs.writeFileSync(join(OUT, 'town2.json'), JSON.stringify({ seed: SEED, roads: roads.length, lots: lots.length, trees, bricks: total, chunks: nChunk }));
console.log(JSON.stringify({ roads: roads.length, lots: lots.length, parks: lots.filter(l => l.park).length, trees, bricks: total, out: OUT }));
