// Pixel-grid floor plan -> house walls. Yellow = wall, red = room, green = door, anything else = outside.
//   node mapgen/gridhouse.mjs PLAN X Y Z job.json [scale]
// PLAN: a .png, a .txt grid (Y/R/G/. per char, row 0 = lowest y), or a SaveRegion read (liveedit/region.mjs
// json) of tiles drawn in game by owner index 0 (its origin is then taken from the drawing, X Y ignored).
// One pixel = scale studs. Each wall face knows its normal: faces toward a room or door get the interior
// skin and (rooms only) a micro brick baseboard; the rest of the cell is the exterior core. A room pixel
// touching outside gets a wall there, so open drawings still close.
import fs from 'fs';
import zlib from 'zlib';
import { makeBuilder } from './builder.mjs';
import { worldBox } from './orient.mjs';

const [plan, ax, ay, az, out, sc = '1'] = process.argv.slice(2);
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const OWNER = { id: 'a0e50000-0000-4b0b-9a11-0000000067d1', name: 'Grid House', display_name: 'Grid House' };
const C = 10 * +sc, H = 96, DOOR_H = 64, SKIN = 2, BASE_H = 6, FLOOR = 4;
const PLASTER = [232, 222, 200], SIDING = [150, 110, 80], BASE = [70, 48, 34], WOOD = [176, 128, 82], LINTEL = [120, 84, 56];

const kind = ([r, g, b]) => r > 150 && g > 150 && b < 120 ? 'Y' : r > 150 && g < 100 ? 'R' : g > 120 && r < 120 ? 'G' : '.';

function readPng(buf) {
  let w, h, ct, idat = [];
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] || ![2, 6].includes(ct)) throw new Error('png: 8-bit RGB/RGBA, non-interlaced only'); }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? px[y * st + x - bpp] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      px[y * st + x] = src[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
    }
  }
  // image rows run top-down; plan row 0 is the lowest y, so flip
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => kind(px.subarray(((h - 1 - y) * w + x) * bpp)) ).join(''));
}

function readCapture(d) {
  const bx = d.bricks.filter(b => b.owner === 0).map(b => ({ b, box: worldBox(b, {}) }));
  const x0 = Math.min(...bx.map(q => q.box[0][0])), y0 = Math.min(...bx.map(q => q.box[0][1]));
  const W = (Math.max(...bx.map(q => q.box[1][0])) - x0) / 10, Hh = (Math.max(...bx.map(q => q.box[1][1])) - y0) / 10;
  const g = Array.from({ length: Hh }, () => Array(W).fill('.'));
  for (const { b, box: [lo, hi] } of bx) for (let x = lo[0]; x < hi[0]; x += 10) for (let y = lo[1]; y < hi[1]; y += 10) g[(y - y0) / 10][(x - x0) / 10] = kind(b.color);
  return { rows: g.map(r => r.join('')), x0, y0, z: Math.max(...bx.map(q => q.box[1][2])) };
}

let rows, X = +ax, Y = +ay, Z = +az;
if (plan.endsWith('.png')) rows = readPng(fs.readFileSync(plan));
else if (plan.endsWith('.json')) ({ rows, x0: X, y0: Y, z: Z } = readCapture(JSON.parse(fs.readFileSync(plan))));
else rows = fs.readFileSync(plan, 'utf8').split(/\r?\n/).filter(Boolean);

// pad by one so auto-closing walls have room, then close every room pixel that touches outside
const g = ['', ...rows, ''].map(r => ('.' + r.padEnd(Math.max(...rows.map(r => r.length))) + '.').replaceAll(' ', '.').split(''));
X -= C; Y -= C;
const at = (i, j) => g[j]?.[i] ?? '.';
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++)
  if (at(i, j) === '.' && N4.some(([di, dj]) => at(i + di, j + dj) === 'R')) g[j][i] = 'y'; // y = auto wall
const isWall = (i, j) => 'Yy'.includes(at(i, j)), inner = (i, j) => 'RG'.includes(at(i, j));

// collect boxes per material, merge runs along x then along y
const boxes = new Map();
const put = (m, x0, y0, z0, x1, y1, z1) => (boxes.get(m) ?? boxes.set(m, []).get(m)).push([x0, y0, z0, x1, y1, z1]);
function merge(list) {
  for (const ax of [0, 1]) {
    const o = 1 - ax, key = b => [b[o], b[o + 3], b[2], b[5]].join(), out = [];
    list.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a[ax] - b[ax]);
    for (const b of list) {
      const p = out.at(-1);
      if (p && key(p) === key(b) && p[ax + 3] === b[ax] && p[ax + 3] - p[ax] < 400) p[ax + 3] = b[ax + 3]; else out.push([...b]);
    }
    list = out;
  }
  return list;
}

const F = Z + FLOOR, TOP = F + H;
const normals = {};
for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
  const x0 = X + i * C, y0 = Y + j * C, x1 = x0 + C, y1 = y0 + C, c = at(i, j);
  if (c === 'R' || c === 'G') put('floor', x0, y0, Z, x1, y1, F);
  if (c === 'G') put('lintel', x0, y0, F + DOOR_H, x1, y1, TOP);
  if (c === 'R') {
    // baseboard along each wall face of this room pixel; x-facing strips step aside for y-facing ones at corners
    const s = isWall(i, j - 1), n = isWall(i, j + 1);
    if (s) put('base', x0, y0, F, x1, y0 + SKIN, F + BASE_H);
    if (n) put('base', x0, y1 - SKIN, F, x1, y1, F + BASE_H);
    if (isWall(i - 1, j)) put('base', x0, y0 + (s ? SKIN : 0), F, x0 + SKIN, y1 - (n ? SKIN : 0), F + BASE_H);
    if (isWall(i + 1, j)) put('base', x1 - SKIN, y0 + (s ? SKIN : 0), F, x1, y1 - (n ? SKIN : 0), F + BASE_H);
  }
  if (!isWall(i, j)) continue;
  // normals: which faces of this wall pixel look into the house
  const fw = inner(i - 1, j), fe = inner(i + 1, j), fs_ = inner(i, j - 1), fn = inner(i, j + 1);
  const nx = fe - fw, ny = fn - fs_;
  const nk = fw + fe + fs_ + fn ? `${nx},${ny}` : 'outside';
  normals[nk] = (normals[nk] ?? 0) + 1;
  const cx0 = x0 + (fw ? SKIN : 0), cx1 = x1 - (fe ? SKIN : 0), cy0 = y0 + (fs_ ? SKIN : 0), cy1 = y1 - (fn ? SKIN : 0);
  put('core', cx0, cy0, Z, cx1, cy1, TOP);
  if (fs_) put('skin', x0, y0, Z, x1, cy0, TOP);
  if (fn) put('skin', x0, cy1, Z, x1, y1, TOP);
  if (fw) put('skin', x0, cy0, Z, cx0, cy1, TOP);
  if (fe) put('skin', cx1, cy0, Z, x1, cy1, TOP);
}

const MAT = {
  floor: { asset: TILE, color: WOOD }, lintel: { asset: MB, color: LINTEL }, base: { asset: MB, color: BASE },
  core: { asset: MB, color: SIDING }, skin: { asset: MB, color: PLASTER },
};
const B = makeBuilder();
for (const [m, list] of boxes) for (const b of merge(list)) B.box(...b, MAT[m], m);
console.error(`${g.length - 2}x${g[0].length - 2} plan, ${B.bricks.length} bricks, dropped ${B.dropped.length}${B.dropped.slice(0, 4).map(d => ', ' + d).join('')}`);
console.error('wall normals (inward x,y: pixels)', normals);
const bricks = B.bricks.map(({ label, ...b }) => b);
fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
