// City grid (2026-10-26, owner: "make a grid out of [the road prefabs] that's like a city, off the roads the
// houses we made, just split and dutch colonial"): a road lattice of the owner's 32x32-stud road tiles
// (citygrid/prefabs/{straight,turn,t,cross}.brz, bricks copied + turned per junction) with blocks of
// split-level / Dutch colonial lots fronting the east-west streets, back to back.
// FIELDS (cityfields.mjs, owner: income / population / R-C-I zoning triangle): population sets street
// density (rural drops most streets: big blocks, deep blocks with an empty middle) and lot width; income
// widens lots and picks the Dutch colonial (the big house) over the split-level; the zoning triangle makes
// residential lots houses and commercial / industrial lots empty paved plots for sale (no generators for
// those yet). Every lot gets a real estate price (land + house floor area, x income, x population).
//   node mapgen/citygrid.mjs [--cols 8] [--rows 6] [--ox 3000] [--oy -3000] [--seed 1] [--out DIR]
// Output: DIR/bricks.json, DIR/add.json (every brick, ONE bricks op), DIR/city.json,
// DIR/plots.json (realestate plots format + zoning/density/income/population/house), DIR/fields.png.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { makeBuilder, rng } from './builder.mjs';
import { turnBrick, worldBox } from './orient.mjs';
import { dutchColonial } from './dutchcolonial.mjs';
import { splitLevel } from './splitlevel.mjs';
import { tavistock } from './tavistock.mjs';
import { EXTERNAL_ASSETS } from './ruins.mjs';
import { cityFields } from './cityfields.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 8), ROWS = +arg('rows', 6), OX = +arg('ox', 3000), OY = +arg('oy', -3000);
const SEED = +arg('seed', 1), OUT = arg('out', path.join(HERE, 'out_citygrid'));
const T = 320, DEPTH = 6; // tile size (units); block depth in tiles = two 960-deep lots back to back (Tavistock needs 820 + setback)

// ---- road tiles: the owner's prefabs, local to the tile centre, with the sides each one opens to
const SIDE = { '1,0': 'E', '-1,0': 'W', '0,1': 'N', '0,-1': 'S' };
async function loadTiles() {
  const brs = await import('../tools/brs4/dist.mjs');
  const tiles = {};
  for (const [name, open] of [['straight', ['N', 'S']], ['turn', ['E', 'S']], ['t', ['S', 'E', 'W']], ['cross', ['N', 'S', 'E', 'W']]]) {
    const r = brs.WorldReader.from(fs.readFileSync(path.join(HERE, '../citygrid/prefabs', name + '.brz')));
    const g = r.globalData(), names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
    const raw = [...r.bricks()];
    const lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (const b of raw) { const [l, h] = worldBox(b); for (const i of [0, 1]) { lo[i] = Math.min(lo[i], l[i]); hi[i] = Math.max(hi[i], h[i]); } }
    const c = [Math.round((lo[0] + hi[0]) / 2), Math.round((lo[1] + hi[1]) / 2)];
    if (hi[0] - lo[0] !== T || hi[1] - lo[1] !== T) throw new Error(`${name} is not a ${T} tile`);
    tiles[name] = {
      open, bricks: raw.map(b => ({
        asset: names[b.asset_name_index], size: [...b.size], position: [b.position[0] - c[0], b.position[1] - c[1], b.position[2]],
        direction: b.direction, rotation: b.rotation, color: [...b.color], material: g.MaterialAssetNames[b.material_index], material_intensity: b.material_intensity,
      })),
    };
  }
  return tiles;
}
const turnSide = (s, r) => { const v = { E: [1, 0], N: [0, 1], W: [-1, 0], S: [0, -1] }[s]; let [x, y] = v; for (let i = 0; i < r; i++) [x, y] = [-y, x]; return SIDE[x + ',' + y]; };
function tileFor(tiles, open) {
  const want = [...open].sort().join();
  for (const name of ['cross', 't', 'straight', 'turn']) for (let r = 0; r < 4; r++)
    if (tiles[name].open.map(s => turnSide(s, r)).sort().join() === want) return { name, r };
  throw new Error('no road tile opens to ' + want);
}

// ---- lattice: blocks 5-7 tiles wide, DEPTH deep; street segments then dropped by population
const rnd = rng(SEED);
const colW = Array.from({ length: COLS }, () => 5 + Math.floor(rnd() * 3));
const xLines = [0]; for (const w of colW) xLines.push(xLines.at(-1) + w + 1); // tile index of each N-S road
const yLines = [0]; for (let j = 0; j < ROWS; j++) yLines.push(yLines.at(-1) + DEPTH + 1);
const NX = xLines.at(-1) + 1, NY = yLines.at(-1) + 1;
const EXT = [OX, OY, OX + NX * T, OY + NY * T];
const F = cityFields(SEED, EXT);
const wx = tx => OX + tx * T, wy = ty => OY + ty * T;
// segments: 'v,i,j' = N-S line i between E-W lines j, j+1; 'h,i,j' = E-W line j between N-S lines i, i+1
const seg = new Set();
for (let i = 0; i <= COLS; i++) for (let j = 0; j < ROWS; j++) seg.add(`v,${i},${j}`);
for (let i = 0; i < COLS; i++) for (let j = 0; j <= ROWS; j++) seg.add(`h,${i},${j}`);
const ends = k => { const [t, i, j] = k.split(','), a = +i, b = +j; return t === 'v' ? [[a, b], [a, b + 1]] : [[a, b], [a + 1, b]]; };
const around = ([i, j]) => [`v,${i},${j}`, `v,${i},${j - 1}`, `h,${i},${j}`, `h,${i - 1},${j}`];
const deg = e => around(e).filter(k => seg.has(k)).length;
const connected = () => {
  const seen = new Set(['0,0']), q = [[0, 0]];
  while (q.length) for (const k of around(q.pop())) if (seg.has(k)) for (const e of ends(k)) if (!seen.has(e + '')) { seen.add(e + ''); q.push(e); }
  return [...seg].every(k => ends(k).every(e => seen.has(e + '')));
};
const DROP = { v: { urban: 0.05, suburb: 0.35, rural: 0.7 }, h: { urban: 0, suburb: 0.08, rural: 0.45 } };
const dropped = [];
for (const k of [...seg].sort(() => rnd() - 0.5)) {
  const [t, i, j] = k.split(','), a = +i, b = +j;
  if (t === 'v' ? a === 0 || a === COLS : b === 0 || b === ROWS) continue; // outer ring stays
  const [p, q] = ends(k).map(([ii, jj]) => [wx(xLines[ii]) + T / 2, wy(yLines[jj]) + T / 2]);
  if (rnd() >= DROP[t][F.density((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)]) continue;
  seg.delete(k);
  if (ends(k).some(e => deg(e) < 2) || !connected()) { seg.add(k); continue; }
  dropped.push(k);
}
const road = new Set();
for (const k of seg) {
  const [t, i, j] = k.split(','), a = +i, b = +j;
  if (t === 'v') for (let ty = yLines[b]; ty <= yLines[b + 1]; ty++) road.add(xLines[a] + ',' + ty);
  else for (let tx = xLines[a]; tx <= xLines[a + 1]; tx++) road.add(tx + ',' + yLines[b]);
}

const tiles = await loadTiles();
const B = makeBuilder();
const tally = {};
for (const k of road) {
  const [tx, ty] = k.split(',').map(Number);
  const open = Object.entries({ E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] }).filter(([, [dx, dy]]) => road.has(tx + dx + ',' + (ty + dy))).map(([s]) => s);
  if (open.length < 2) throw new Error(`dead end at ${k}`);
  const { name, r } = tileFor(tiles, open);
  tally[name] = (tally[name] ?? 0) + 1;
  const cx = OX + tx * T + T / 2, cy = OY + ty * T + T / 2;
  for (const b of tiles[name].bricks) {
    const t = turnBrick(b, r);
    if (!B.add({ ...t, position: [cx + t.position[0], cy + t.position[1], t.position[2]] }, 'road ' + name)) throw new Error('road overlap ' + k);
  }
}

// ---- lots: along every E-W street face; a run of cells merged by dropped N-S streets is one frontage.
// South-face lots front -y (r 0), north-face lots +y (r 2).
const LOT_W = { urban: 640, suburb: 760, rural: 1050 };
const lots = [];
for (let j = 0; j < ROWS; j++) for (const side of ['S', 'N']) {
  const line = side === 'S' ? j : j + 1;
  let i = 0;
  while (i < COLS) {
    if (!seg.has(`h,${i},${line}`)) { i++; continue; }
    let i1 = i + 1;
    while (i1 < COLS && !seg.has(`v,${i1},${j}`) && seg.has(`h,${i1},${line}`)) i1++;
    const x0 = wx(xLines[i] + 1), x1 = wx(xLines[i1]);
    const y0 = side === 'S' ? wy(yLines[j] + 1) : wy(yLines[j + 1]) - DEPTH * T / 2, y1 = y0 + DEPTH * T / 2;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const n = Math.max(1, Math.floor((x1 - x0) / (LOT_W[F.density(mx, my)] + F.income(mx, my) * 180)));
    const edges = Array.from({ length: n + 1 }, (_, k) => Math.round((x0 + (x1 - x0) * k / n) / 10) * 10);
    for (let k = 0; k < n; k++) lots.push({ x0: edges[k], x1: edges[k + 1], y0, y1, side });
    i = i1;
  }
}

// ---- owner's buildings (citygrid/stealme/*.brz, client Saved/Prefabs/stealme, 2026-10-26: "take all of those
// models, integrate them into the GTA world"): packed onto the commercial / industrial lots, spanning
// neighbouring and back-to-back lots (most are 1000-2000 wide, a lot is 640-1050 x 960). The three too big for
// a block (mall, weed, grid) stand in a row south of the outer ring road. Bricks only: the prefabs' wire
// gates, joints and hidden bricks are left out, like the city Tavistocks' fixtures.
for (const L of lots) L.kind = F.zone((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2).kind;
const SKIP = /^B_1x1_Gate|Reroute|Joint|Switch/;
const DUPES = new Set(['dairy queef']); // same build as dairyqueen.brz
const BIG = ['mall', 'weed', 'grid'];
const brs4 = await import('../tools/brs4/dist.mjs');
const models = fs.readdirSync(path.join(HERE, '../citygrid/stealme')).filter(f => f.endsWith('.brz')).map(f => f.slice(0, -4)).filter(n => !DUPES.has(n)).map(name => {
  const r = brs4.WorldReader.from(fs.readFileSync(path.join(HERE, '../citygrid/stealme', name + '.brz')));
  const g = r.globalData(), names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
  const raw = [...r.bricks()].filter(b => b.visibility !== false && !SKIP.test(names[b.asset_name_index]));
  const lo = [1e9, 1e9], hi = [-1e9, -1e9];
  const bricks = raw.map(b => ({
    asset: names[b.asset_name_index], size: [...b.size], position: [...b.position],
    direction: b.direction, rotation: b.rotation, color: [...b.color], material: g.MaterialAssetNames[b.material_index], material_intensity: b.material_intensity,
  }));
  for (const b of bricks) { const [l, h] = worldBox(b); for (const i of [0, 1]) { lo[i] = Math.min(lo[i], l[i]); hi[i] = Math.max(hi[i], h[i]); } }
  const c = [Math.round((lo[0] + hi[0]) / 20) * 10, Math.round((lo[1] + hi[1]) / 20) * 10];
  for (const b of bricks) { b.position[0] -= c[0]; b.position[1] -= c[1]; }
  return { name, bricks, w: Math.ceil((hi[0] - lo[0]) / 20) * 20, d: Math.ceil((hi[1] - lo[1]) / 20) * 20 };
});
const buildings = [];
let modelGroup = 1e6;
const placeModel = (m, cx, cy, r, lotIds) => {
  const group = ++modelGroup; // the owner's own pieces may interlock: builder skips clashes within one model
  let bad = 0;
  for (const b of m.bricks) { const t = turnBrick(b, r); if (!B.add({ ...t, group, position: [cx + t.position[0], cy + t.position[1], t.position[2]] }, m.name)) bad++; }
  if (bad) throw new Error(`${m.name} at ${cx},${cy}: ${bad} bricks dropped`);
  buildings.push({ name: m.name, centre: [cx, cy], r, lots: lotIds });
};
// free ground = every non-residential lot, 40-unit cells
const C = 40, freeCell = new Set();
lots.forEach((L, li) => { if (L.kind !== 'residential') for (let x = L.x0; x < L.x1; x += C) for (let y = L.y0; y < L.y1; y += C) freeCell.add(Math.floor(x / C) + ',' + Math.floor(y / C)); });
const cellsIn = (x0, y0, x1, y1) => { const out = []; for (let x = Math.floor(x0 / C); x < Math.ceil(x1 / C); x++) for (let y = Math.floor(y0 / C); y < Math.ceil(y1 / C); y++) out.push(x + ',' + y); return out; };
const lotsUnder = (x0, y0, x1, y1) => lots.flatMap((L, li) => L.x0 < x1 && x0 < L.x1 && L.y0 < y1 && y0 < L.y1 ? [li] : []);
const usedLot = new Set();
const pool = models.filter(m => !BIG.includes(m.name)).sort((a, b) => b.w * b.d - a.w * a.d);
for (let placed = true; placed;) { // round robin: every building once per pass, until nothing fits
  placed = false;
  for (const m of pool) {
    if (buildings.filter(q => q.name === m.name).length >= 3) continue; // no street of nine churches
    let spot = null;
    for (const L of lots) {
      if (L.kind === 'residential' || spot) continue;
      const face = L.side === 'S' ? 0 : 2;
      for (const r of [face, face + 1, (face + 3) % 4, (face + 2) % 4]) {
        const [w, d] = r % 2 ? [m.d, m.w] : [m.w, m.d];
        const y0 = L.side === 'S' ? L.y0 + 40 : L.y1 - 40 - d; // set back 40 from the sidewalk
        for (let x0 = L.x0 + 40; x0 + w <= L.x1 + 2000 && !spot; x0 += C)
          if (cellsIn(x0 - 40, y0 - 40, x0 + w + 40, y0 + d + 40).every(k => freeCell.has(k))) spot = { x0, y0, w, d, r };
        if (spot) break;
      }
    }
    if (!spot) continue;
    const { x0, y0, w, d, r } = spot;
    for (const k of cellsIn(x0 - 40, y0 - 40, x0 + w + 40, y0 + d + 40)) freeCell.delete(k);
    const under = lotsUnder(x0, y0, x0 + w, y0 + d);
    for (const li of under) usedLot.add(li);
    placeModel(m, x0 + w / 2, y0 + d / 2, r, under.map(li => li + 1));
    placed = true;
  }
}
{ // the big three (and any building no lot fitted), side by side south of the outer ring, long side along the road
  let x = OX + 200;
  for (const m of models.filter(q => BIG.includes(q.name) || !buildings.some(b => b.name === q.name))) {
    const r = m.d > m.w ? 1 : 0, [w, d] = r ? [m.d, m.w] : [m.w, m.d];
    placeModel(m, x + w / 2, OY - 120 - d / 2, r, []);
    x += w + 240;
  }
}

const plots = [], houses = [], zoneTally = {};
let hseed = SEED * 1000;
for (const [li, L] of lots.entries()) {
  const cxl = (L.x0 + L.x1) / 2, cyl = (L.y0 + L.y1) / 2, lw = L.x1 - L.x0, ld = L.y1 - L.y0;
  const z = F.zone(cxl, cyl), dens = F.density(cxl, cyl), inc = F.income(cxl, cyl), pop = F.pop(cxl, cyl), kind = z.kind;
  zoneTally[kind + ' ' + dens] = (zoneTally[kind + ' ' + dens] ?? 0) + 1;
  let house = null, floor = 0;
  if (kind === 'residential' && !(dens === 'rural' && rnd() < 0.3)) {
    const big = rnd() < Math.min(0.95, Math.max(0.05, inc * 1.3 - 0.15));
    // a third of the houses are Tavistock colonials (seed picks the siding colour; owner 2026-10-26)
    const hk = rnd() < 0.33 ? 'tavistock' : big ? 'dutchcolonial' : 'splitlevel', seed = hseed++, mirror = rnd() < 0.5;
    const h = hk === 'tavistock' ? tavistock({ seed }) : big ? dutchColonial({ seed, mirror }) : splitLevel({ seed, mirror });
    const fw = (h.W + 1) * 10, fd = (h.D + 1) * 10;
    if (fw > lw - 20 || fd > ld - 30) throw new Error(`${hk} ${seed} ${fw}x${fd} does not fit a ${lw}x${ld} lot`);
    const jit = Math.floor((rnd() - 0.5) * Math.max(0, lw - fw - 40) / 10) * 10;
    const cx = Math.round((cxl + jit) / 10) * 10;
    const set = Math.min(ld - fd - 20, 30 + Math.floor(rnd() * 6) * 10);
    const r = L.side === 'S' ? 0 : 2;
    const cy = L.side === 'S' ? L.y0 + set + fd / 2 : L.y1 - set - fd / 2;
    const lx = Math.round(fw / 2 / 10) * 10, ly = Math.round(fd / 2 / 10) * 10;
    let bad = 0;
    for (const b of h.bricks) {
      const t = turnBrick({ ...b, position: [b.position[0] - lx, b.position[1] - ly, b.position[2]] }, r);
      if (!B.add({ ...t, position: [cx + t.position[0], cy + t.position[1], t.position[2]] }, hk)) bad++;
    }
    if (bad) throw new Error(`${hk} ${seed}: ${bad} bricks dropped`);
    floor = h.W * h.D * (hk === 'splitlevel' ? 1.6 : 2);
    house = { kind: hk, seed, mirror, centre: [cx, cy], r, origin: [cx - (r ? -lx : lx), cy - (r ? -ly : ly)], W: h.W, D: h.D, bricks: h.count };
    houses.push(house);
  } else if (kind !== 'residential' && !usedLot.has(li)) {
    // empty plot for sale: commercial = light concrete flush with the sidewalk, industrial = dark gravel yard
    const pad = kind === 'commercial' ? { color: [168, 166, 160], z: 4, h: 4 } : { color: [86, 82, 76], z: 2, h: 2 };
    B.add({ asset: 'PB_DefaultTile', size: [lw / 2 - 10, ld / 2 - 10, pad.h], position: [cxl, cyl, pad.z], direction: 4, rotation: 0, color: pad.color }, kind + ' pad');
  }
  const id = plots.length + 1;
  plots.push({
    id, name: `${kind === 'residential' ? (house ? 'Lot' : 'Vacant Lot') : kind === 'commercial' ? 'Commercial Lot' : 'Industrial Lot'} ${id}`,
    building: buildings.find(q => q.lots.includes(li + 1))?.name ?? null,
    x: cxl, y: cyl, ground: 0, surface: kind === 'commercial' ? 8 : 0, half: Math.min(lw, ld) / 2, studs: Math.round(lw / 10),
    price: F.price(cxl, cyl, lw, ld, floor, kind), zone: { x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1, z0: 0, z1: 1300 },
    zoning: kind, weights: { r: +z.r.toFixed(3), c: +z.c.toFixed(3), i: +z.i.toFixed(3) }, density: dens, income: +inc.toFixed(3), population: +pop.toFixed(3),
    house: house && { kind: house.kind, seed: house.seed, W: house.W, D: house.D },
  });
}

// ---- barriers between houses (owner 2026-10-26: "hedge picket and wood chain and tree barriers between
// houses"): one kind per lot line (side lines between neighbours, back lines between back-to-back lots),
// residential on both sides; richer streets get hedges / trees, poorer ones chain link. Pieces that would
// touch a house frame are skipped, so a line can stop short of a garage.
const BARRIERS = ['chain', 'wood', 'picket', 'hedge', 'trees'];
const pickBarrier = (x, y) => BARRIERS[Math.min(4, Math.max(0, Math.floor(F.income(x, y) * 4 + rnd() * 2 - 0.5)))];
const nearHouse = (x0, y0, x1, y1) => houses.some(h => { const hw = (h.W + 1) * 5 + 20, hd = (h.D + 1) * 5 + 20; return x0 < h.centre[0] + hw && h.centre[0] - hw < x1 && y0 < h.centre[1] + hd && h.centre[1] - hd < y1; });
const barrierTally = {};
function barrier(kind, along, e, a, b) { // a line at x = e (along 'y') or y = e (along 'x'), from a to b
  const P = (u0, u1, v0, v1) => along === 'y' ? [v0, u0, v1, u1] : [u0, v0, u1, v1];
  const put = (u0, u1, v0, v1, z0, z1, m) => { const [x0, y0, x1, y1] = P(u0, u1, v0, v1); return B.box(x0, y0, z0, x1, y1, z1, m, 'barrier ' + kind); };
  const unit = (u0, u1, w, pieces) => { const [x0, y0, x1, y1] = P(u0, u1, e - w, e + w); if (nearHouse(x0, y0, x1, y1)) return; for (const p of pieces) if (!p()) return; barrierTally[kind] = (barrierTally[kind] ?? 0) + 1; };
  const M = c => ({ asset: 'PB_DefaultBrick', color: c });
  const leaf = [[46, 86, 38], [58, 98, 42], [40, 74, 34]];
  if (kind === 'hedge') for (let u = a; u + 60 <= b; u += 60) // box hedge, 4 bricks tall, 2 studs thick
    unit(u, u + 60, 10, [() => put(u, u + 60, e - 10, e + 10, 0, 48, M(leaf[(u / 60) % 3 | 0]))]);
  if (kind === 'trees') for (let u = a + 30; u + 90 <= b; u += 140) // round-ish trees: trunk, wide crown, small top
    unit(u, u + 60, 30, [() => put(u, u + 60, e - 30, e + 30, 48, 96, M(leaf[(u / 140) % 3 | 0])), () => put(u + 20, u + 40, e - 5, e + 5, 0, 48, M([92, 64, 40])), () => put(u + 10, u + 50, e - 20, e + 20, 96, 112, M(leaf[1]))]);
  if (kind === 'picket') for (let u = a; u + 20 <= b; u += 20) // white pickets with two rails between them
    unit(u, u + 20, 5, [() => put(u, u + 10, e - 5, e + 5, 0, 40, M([236, 234, 226])), () => put(u + 10, u + 20, e - 5, e + 5, 12, 16, M([236, 234, 226])), () => put(u + 10, u + 20, e - 5, e + 5, 28, 32, M([236, 234, 226]))]);
  if (kind === 'wood') for (let u = a; u + 100 <= b; u += 100) // privacy fence, player height: post + 8 studs of boards
    unit(u, u + 100, 10, [() => put(u, u + 20, e - 10, e + 10, 0, 64, M([96, 66, 42])), () => put(u + 20, u + 100, e - 5, e + 5, 0, 60, M([134, 96, 60]))]);
  if (kind === 'chain') for (let u = a; u + 100 <= b; u += 100) // metal posts + see-through mesh
    unit(u, u + 100, 5, [() => put(u, u + 10, e - 5, e + 5, 0, 60, { asset: 'PB_DefaultBrick', color: [150, 152, 156], material: 'BMC_Metallic' }),
      () => put(u + 10, u + 100, e - 1, e + 1, 0, 56, { asset: 'PB_DefaultMicroBrick', color: [140, 142, 146], material: 'BMC_Glass' }),
      () => put(u + 10, u + 100, e - 5, e + 5, 56, 60, { asset: 'PB_DefaultBrick', color: [150, 152, 156], material: 'BMC_Metallic' })]);
}
const res = L => L.kind === 'residential';
for (const [i, L] of lots.entries()) {
  const R = lots[i + 1];
  // side line to the next lot on the same face; stop 40 short of the back line (that line's barrier)
  if (R && R.side === L.side && R.y0 === L.y0 && R.x0 === L.x1 && res(L) && res(R))
    barrier(pickBarrier(L.x1, (L.y0 + L.y1) / 2), 'y', L.x1, L.side === 'S' ? L.y0 : L.y0 + 40, L.side === 'S' ? L.y1 - 40 : L.y1);
  // back line to every north lot behind a south lot
  if (L.side === 'S' && res(L)) for (const N of lots) if (N.side === 'N' && N.y0 === L.y1 && res(N) && N.x0 < L.x1 && L.x0 < N.x1)
    barrier(pickBarrier((Math.max(L.x0, N.x0) + Math.min(L.x1, N.x1)) / 2, L.y1), 'x', L.y1, Math.max(L.x0, N.x0) + 20, Math.min(L.x1, N.x1) - 20);
}
console.error('barriers', JSON.stringify(barrierTally));

const bricks = B.bricks.map(({ label, ...b }) => b);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT).filter(f => /^add_\d+\.json$/.test(f))) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'bricks.json'), JSON.stringify(bricks));
// owner: NEVER queue bricks: one file, one bricks op
fs.writeFileSync(path.join(OUT, 'add.json'), JSON.stringify({ bricks, externalAssets: EXTERNAL_ASSETS }));
fs.writeFileSync(path.join(OUT, 'plots.json'), JSON.stringify(plots, null, 1));
fs.writeFileSync(path.join(OUT, 'city.json'), JSON.stringify({ seed: SEED, extent: EXT, downtown: F.downtown, colW, dropped, tiles: tally, zones: zoneTally, houses, buildings }, null, 1));
writeFieldMap(path.join(OUT, 'fields.png'));
const pr = plots.map(p => p.price).sort((a, b) => a - b);
console.error(`city ${COLS}x${ROWS}, extent ${EXT.join(',')}, ${dropped.length} streets dropped, road tiles ${JSON.stringify(tally)}, ${lots.length} lots ${JSON.stringify(zoneTally)}, ${houses.length} houses (${houses.filter(h => h.kind === 'dutchcolonial').length} Dutch, ${houses.filter(h => h.kind === 'tavistock').length} Tavistock), ${buildings.length} owner buildings ${JSON.stringify(Object.fromEntries(models.map(m => [m.name, buildings.filter(q => q.name === m.name).length])))}, prices ${pr[0]}..${pr.at(-1)} (median ${pr[pr.length >> 1]}), ${bricks.length} bricks -> ${OUT}`);

/** three panels, north up, roads darkened: income (dark -> gold) | density (urban red, suburb sand,
 *  rural green; brighter = more people) | zoning triangle blend (R green, C blue, I orange) */
function writeFieldMap(file) {
  const U = 40, w = Math.ceil((EXT[2] - EXT[0]) / U), hgt = Math.ceil((EXT[3] - EXT[1]) / U), PW = w * 3 + 20, row = PW * 3 + 1;
  const px = Buffer.alloc(row * hgt);
  for (let yy = 0; yy < hgt; yy++) for (let xx = 0; xx < w; xx++) {
    const X = EXT[0] + (xx + 0.5) * U, Y = EXT[3] - (yy + 0.5) * U;
    const m = road.has(Math.floor((X - OX) / T) + ',' + Math.floor((Y - OY) / T)) ? 0.5 : 1;
    const inc = F.income(X, Y), p = F.pop(X, Y), z = F.zone(X, Y);
    const cols = [
      [40 + 215 * inc, 30 + 180 * inc, 20 + 40 * inc],
      { urban: [200, 60, 60], suburb: [220, 190, 90], rural: [90, 150, 70] }[F.density(X, Y)].map(c => c * (0.6 + 0.4 * p)),
      [255 * (0.15 * z.r + 0.1 * z.c + z.i), 255 * (0.8 * z.r + 0.45 * z.c + 0.55 * z.i), 255 * (0.25 * z.r + 0.95 * z.c + 0.1 * z.i)],
    ];
    cols.forEach((c, k) => { const o = yy * row + 1 + (k * (w + 10) + xx) * 3; for (let q = 0; q < 3; q++) px[o + q] = Math.min(255, c[q] * m); });
  }
  const tab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = tab[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(PW, 0); ih.writeUInt32BE(hgt, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
}
