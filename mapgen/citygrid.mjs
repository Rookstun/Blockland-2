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
import { EXTERNAL_ASSETS } from './ruins.mjs';
import { cityFields } from './cityfields.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 8), ROWS = +arg('rows', 6), OX = +arg('ox', 3000), OY = +arg('oy', -3000);
const SEED = +arg('seed', 1), OUT = arg('out', path.join(HERE, 'out_citygrid'));
const T = 320, DEPTH = 4; // tile size (units); block depth in tiles = two 640-deep lots back to back

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

const plots = [], houses = [], zoneTally = {};
let hseed = SEED * 1000;
for (const L of lots) {
  const cxl = (L.x0 + L.x1) / 2, cyl = (L.y0 + L.y1) / 2, lw = L.x1 - L.x0, ld = L.y1 - L.y0;
  const z = F.zone(cxl, cyl), dens = F.density(cxl, cyl), inc = F.income(cxl, cyl), pop = F.pop(cxl, cyl), kind = z.kind;
  zoneTally[kind + ' ' + dens] = (zoneTally[kind + ' ' + dens] ?? 0) + 1;
  let house = null, floor = 0;
  if (kind === 'residential' && !(dens === 'rural' && rnd() < 0.3)) {
    const big = rnd() < Math.min(0.95, Math.max(0.05, inc * 1.3 - 0.15));
    const hk = big ? 'dutchcolonial' : 'splitlevel', seed = hseed++, mirror = rnd() < 0.5;
    const h = big ? dutchColonial({ seed, mirror }) : splitLevel({ seed, mirror });
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
    floor = h.W * h.D * (big ? 2 : 1.6);
    house = { kind: hk, seed, mirror, centre: [cx, cy], W: h.W, D: h.D, bricks: h.count };
    houses.push(house);
  } else if (kind !== 'residential') {
    // empty plot for sale: commercial = light concrete flush with the sidewalk, industrial = dark gravel yard
    const pad = kind === 'commercial' ? { color: [168, 166, 160], z: 4, h: 4 } : { color: [86, 82, 76], z: 2, h: 2 };
    B.add({ asset: 'PB_DefaultTile', size: [lw / 2 - 10, ld / 2 - 10, pad.h], position: [cxl, cyl, pad.z], direction: 4, rotation: 0, color: pad.color }, kind + ' pad');
  }
  const id = plots.length + 1;
  plots.push({
    id, name: `${kind === 'residential' ? (house ? 'Lot' : 'Vacant Lot') : kind === 'commercial' ? 'Commercial Lot' : 'Industrial Lot'} ${id}`,
    x: cxl, y: cyl, ground: 0, surface: kind === 'commercial' ? 8 : 0, half: Math.min(lw, ld) / 2, studs: Math.round(lw / 10),
    price: F.price(cxl, cyl, lw, ld, floor, kind), zone: { x0: L.x0, x1: L.x1, y0: L.y0, y1: L.y1, z0: 0, z1: 1300 },
    zoning: kind, weights: { r: +z.r.toFixed(3), c: +z.c.toFixed(3), i: +z.i.toFixed(3) }, density: dens, income: +inc.toFixed(3), population: +pop.toFixed(3),
    house: house && { kind: house.kind, seed: house.seed, W: house.W, D: house.D },
  });
}

const bricks = B.bricks.map(({ label, ...b }) => b);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT).filter(f => /^add_\d+\.json$/.test(f))) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'bricks.json'), JSON.stringify(bricks));
// owner: NEVER queue bricks: one file, one bricks op
fs.writeFileSync(path.join(OUT, 'add.json'), JSON.stringify({ bricks, externalAssets: EXTERNAL_ASSETS }));
fs.writeFileSync(path.join(OUT, 'plots.json'), JSON.stringify(plots, null, 1));
fs.writeFileSync(path.join(OUT, 'city.json'), JSON.stringify({ seed: SEED, extent: EXT, downtown: F.downtown, colW, dropped, tiles: tally, zones: zoneTally, houses }, null, 1));
writeFieldMap(path.join(OUT, 'fields.png'));
const pr = plots.map(p => p.price).sort((a, b) => a - b);
console.error(`city ${COLS}x${ROWS}, extent ${EXT.join(',')}, ${dropped.length} streets dropped, road tiles ${JSON.stringify(tally)}, ${lots.length} lots ${JSON.stringify(zoneTally)}, ${houses.length} houses (${houses.filter(h => h.kind === 'dutchcolonial').length} Dutch), prices ${pr[0]}..${pr.at(-1)} (median ${pr[pr.length >> 1]}), ${bricks.length} bricks -> ${OUT}`);

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
