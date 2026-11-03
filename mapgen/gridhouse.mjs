// Pixel-grid floor plan -> house. Yellow = wall, red = room, green = door, anything else = outside.
//   node mapgen/gridhouse.mjs PLAN X Y Z job.json [scale]
// PLAN: a .png, a .txt grid (Y/R/G/. per char, row 0 = lowest y), or a SaveRegion read (liveedit/region.mjs
// json) of tiles drawn in game by owner index 0 (its origin is then taken from the drawing, X Y ignored).
// One pixel = scale studs. Resolvers:
//   rooms    flood fill of room pixels (doors split rooms); each room gets a STYLE (floor, wallpaper, ceiling)
//   normals  each wall face looking into a room takes that room's wallpaper; faces toward doors get plaster
//   outline  strips along a room's wall faces at any height: baseboard, chair rail, crown molding
//   pattern  any (x, y) -> piece key function rastered on the 2-unit micro grid and covered with rectangles,
//            used for floors (herringbone, planks, checker) and ceilings; wedges = two triangles per pixel
// A room pixel touching outside gets a wall there, so open drawings still close.
import fs from 'fs';
import zlib from 'zlib';
import { makeBuilder } from './builder.mjs';
import { worldBox } from './orient.mjs';

const [plan, ax, ay, az, out, sc = '1'] = process.argv.slice(2);
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile', WEDGE = 'PB_DefaultMicroWedge', RAMP = 'PB_DefaultMicroRamp', CORNER = 'PB_DefaultMicroWedgeCorner';
const OWNER = { id: 'a0e50000-0000-4b0b-9a11-0000000067d1', name: 'Grid House', display_name: 'Grid House' };
const C = 10 * +sc, H = 96, DOOR_H = 64, SKIN = 2, FLOOR = 4, RAIL = 28;
const PLASTER = [232, 222, 200], SIDING = [150, 110, 80], TRIM = [70, 48, 34], LINTEL = [120, 84, 56], CEIL = [240, 236, 228];

// one entry per room, cycled; floor / wall / ceil name the pattern functions below
const STYLES = [
  { floor: 'herringbone', wall: 'stripes', ceil: 'beams' },
  { floor: 'wedges', wall: 'harlequin', ceil: 'plain' },
  { floor: 'checker', wall: 'wainscot', ceil: 'checker' },
  { floor: 'planks', wall: 'plain', ceil: 'beams' },
];
const hash = (...v) => { let h = 2166136261; for (const x of v) h = Math.imul(h ^ (x | 0), 16777619); return (h >>> 0) / 4294967296; };
const tone = (c, t) => c.map(v => Math.max(0, Math.min(255, Math.round(v * t))));

// floor / ceiling patterns: (x, y) world units -> [piece key, color, asset]
const HB_W = 4, HB_L = 12; // herringbone plank 12 x 4
function herringbone(x, y) {
  // chains of H/V planks along the (1,1) diagonal, repeated every (L, -L)
  const k0 = Math.floor((x - y) / (2 * HB_L));
  for (let k = k0 - 2; k <= k0 + 2; k++) {
    const X = x - k * HB_L, Y = y + k * HB_L;
    let i = Math.floor(Y / HB_W);
    if (X >= i * HB_W && X < i * HB_W + HB_L) return [`h${k},${i}`, tone([176, 128, 82], 0.9 + 0.15 * hash(k, i, 1)), MB];
    i = Math.floor(X / HB_W) + 1;
    if (Y >= i * HB_W && Y < i * HB_W + HB_L) return [`v${k},${i}`, tone([150, 104, 64], 0.9 + 0.15 * hash(k, i, 2)), MB];
  }
  throw new Error(`herringbone gap at ${x},${y}`);
}
const PATTERNS = {
  herringbone,
  planks: (x, y) => { const r = Math.floor(y / 8), p = Math.floor((x + 13 * r) / 40); return [`p${r},${p}`, tone([160, 110, 70], 0.88 + 0.2 * hash(r, p)), MB]; },
  checker: (x, y) => { const c = (Math.floor(x / 10) + Math.floor(y / 10)) & 1; return [`c${c}`, c ? [30, 30, 34] : [235, 235, 230], TILE]; },
  plain: () => ['plain', CEIL, MB],
  ceilchecker: (x, y) => { const c = (Math.floor(x / 20) + Math.floor(y / 20)) & 1; return [`c${c}`, c ? [200, 190, 170] : CEIL, MB]; },
};
// wallpapers: (u along the face, z) -> [key, color]
const PAPERS = {
  plain: () => ['plain', PLASTER],
  stripes: u => { const c = Math.floor(u / 6) & 1; return [`s${c}`, c ? [190, 160, 120] : [214, 196, 160]]; },
  harlequin: (u, z) => { const c = (Math.floor(u / 10) + Math.floor(z / 10)) & 1; return [`q${c}`, c ? [170, 40, 60] : [205, 175, 95]]; },
  wainscot: (u, z) => z < RAIL ? ['panel', [110, 70, 45]] : ['paper', [200, 214, 190]],
};

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
function kind([r, g, b]) { return r > 150 && g > 150 && b < 120 ? 'Y' : r > 150 && g < 100 ? 'R' : g > 120 && r < 120 ? 'G' : '.'; }

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

// room resolver: 4-connected room pixels; doors are not part of any room
const roomOf = g.map(r => r.map(() => -1)), rooms = [];
for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
  if (at(i, j) !== 'R' || roomOf[j][i] >= 0) continue;
  const id = rooms.length, cells = [], stack = [[i, j]];
  roomOf[j][i] = id;
  while (stack.length) {
    const [a, b] = stack.pop(); cells.push([a, b]);
    for (const [di, dj] of N4) if (at(a + di, b + dj) === 'R' && roomOf[b + dj][a + di] < 0) { roomOf[b + dj][a + di] = id; stack.push([a + di, b + dj]); }
  }
  rooms.push({ id, cells, style: STYLES[id % STYLES.length] });
}
const room = (i, j) => rooms[roomOf[j]?.[i]] ?? null;

// collect boxes per material, merge runs along z (so split wall bands rejoin), then x, then y
const boxes = new Map();
const put = (m, x0, y0, z0, x1, y1, z1) => { const k = JSON.stringify(m); (boxes.get(k) ?? boxes.set(k, []).get(k)).push([x0, y0, z0, x1, y1, z1]); };
function merge(list, axes = [2, 0, 1]) {
  for (const ax of axes) {
    const key = b => [0, 1, 2].filter(a => a !== ax).flatMap(a => [b[a], b[a + 3]]).join(), out = [];
    list.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a[ax] - b[ax]);
    for (const b of list) {
      const p = out.at(-1);
      if (p && key(p) === key(b) && p[ax + 3] === b[ax] && p[ax + 3] - p[ax] < 400) p[ax + 3] = b[ax + 3]; else out.push([...b]);
    }
    list = out;
  }
  return list;
}
// cover a set of 2-unit raster cells ("a,b" keys) with rectangles: row runs, stacked while identical
function cover(set) {
  const byRow = new Map();
  for (const k of set) { const [a, b] = k.split(',').map(Number); (byRow.get(b) ?? byRow.set(b, []).get(b)).push(a); }
  const open = new Map(), done = [];
  for (const b of [...byRow.keys()].sort((p, q) => p - q)) {
    const xs = byRow.get(b).sort((p, q) => p - q), runs = [];
    for (const a of xs) { const r = runs.at(-1); if (r && r[1] === a) r[1]++; else runs.push([a, a + 1]); }
    const next = new Map();
    for (const [a0, a1] of runs) {
      const o = open.get(`${a0},${a1}`);
      if (o && o[3] === b) { o[3]++; next.set(`${a0},${a1}`, o); open.delete(`${a0},${a1}`); } else next.set(`${a0},${a1}`, [a0, b, a1, b + 1]);
    }
    done.push(...open.values());
    open.clear(); for (const [k, v] of next) open.set(k, v);
  }
  return [...done, ...open.values()];
}

const F = Z + FLOOR, TOP = F + H, R2 = 2; // raster step
const B = makeBuilder(), lamps = [];
// pattern resolver: fill a room's pixels on [z0, z1) with a named pattern; skip(x, y) keeps a raster cell empty
function fillPattern(cells, name, z0, z1, skip = () => false) {
  const pieces = new Map();
  for (const [i, j] of cells) for (let x = X + i * C; x < X + (i + 1) * C; x += R2) for (let y = Y + j * C; y < Y + (j + 1) * C; y += R2) {
    if (skip(x, y, i, j)) continue;
    const [key, color, asset] = PATTERNS[name](x + 1, y + 1);
    const k = JSON.stringify([key, color, asset]);
    (pieces.get(k) ?? pieces.set(k, new Set()).get(k)).add(`${x / R2},${y / R2}`);
  }
  for (const [k, set] of pieces) {
    const [, color, asset] = JSON.parse(k);
    for (const [a0, b0, a1, b1] of cover(set)) put({ asset, color }, a0 * R2, b0 * R2, z0, a1 * R2, b1 * R2, z1);
  }
}
// outline resolver: strips t thick along every wall face of the room pixels, on [z0, z1); x-facing strips step aside at corners
// (isW = isWallOrDoor for strips that also run over door openings, like the crown)
function outline(cells, z0, z1, t, m, isW = isWall) {
  for (const [i, j] of cells) {
    const x0 = X + i * C, y0 = Y + j * C, x1 = x0 + C, y1 = y0 + C, s = isW(i, j - 1), n = isW(i, j + 1);
    if (s) put(m, x0, y0, z0, x1, y0 + t, z1);
    if (n) put(m, x0, y1 - t, z0, x1, y1, z1);
    if (isW(i - 1, j)) put(m, x0, y0 + (s ? t : 0), z0, x0 + t, y1 - (n ? t : 0), z1);
    if (isW(i + 1, j)) put(m, x1 - t, y0 + (s ? t : 0), z0, x1, y1 - (n ? t : 0), z1);
  }
}
const isWallOrDoor = (i, j) => isWall(i, j) || at(i, j) === 'G';
// distance (in units) from a point in pixel (i, j) to the nearest wall face (or wall over a door) of that pixel
const wallGap = (x, y, i, j, w = isWallOrDoor) => Math.min(
  w(i - 1, j) ? x - (X + i * C) : 1e9, w(i + 1, j) ? X + (i + 1) * C - x : 1e9,
  w(i, j - 1) ? y - (Y + j * C) : 1e9, w(i, j + 1) ? Y + (j + 1) * C - y : 1e9);

for (const r of rooms) {
  const { floor, wall, ceil } = r.style;
  if (floor === 'wedges') {
    // interlocking triangles: each pixel split on a diagonal that flips every pixel; complementary upright micro wedges share a box
    for (const [i, j] of r.cells) {
      const flip = (i + j) & 1, cx = X + i * C + C / 2, cy = Y + j * C + C / 2;
      for (const [rot, color] of [[flip, [220, 214, 200]], [flip + 2, [60, 70, 90]]])
        B.add({ asset: WEDGE, direction: 4, rotation: rot, size: [C / 2, C / 2, FLOOR / 2], position: [cx, cy, Z + FLOOR / 2], color, group: `w${i},${j}` }, 'wedge floor');
    }
  } else fillPattern(r.cells, floor, Z, F);
  outline(r.cells, F, F + 6, 2, { asset: MB, color: TRIM }); // baseboard
  outline(r.cells, TOP - 4, TOP, 2, { asset: MB, color: TRIM }, isWallOrDoor); // crown, over doors too
  if (wall === 'wainscot') outline(r.cells, F + RAIL - 2, F + RAIL + 2, 2, { asset: MB, color: TRIM }); // chair rail
  fillPattern(r.cells, ceil === 'checker' ? 'ceilchecker' : 'plain', TOP, TOP + 4);
  // beams hang under the ceiling across the short axis, clear of the crown; the lamp sits between them
  if (ceil === 'beams') {
    const xs = r.cells.map(c => c[0]), ys = r.cells.map(c => c[1]), alongX = Math.max(...xs) - Math.min(...xs) < Math.max(...ys) - Math.min(...ys);
    fillBeams(r.cells, alongX);
  }
  const [cx, cy] = r.cells.reduce((s, c) => [s[0] + c[0] / r.cells.length, s[1] + c[1] / r.cells.length], [0, 0]);
  const [li, lj] = r.cells.reduce((b, c) => Math.hypot(c[0] - cx, c[1] - cy) < Math.hypot(b[0] - cx, b[1] - cy) ? c : b);
  lamps.push([X + li * C + C / 2, Y + lj * C + C / 2]);
}
function fillBeams(cells, alongX) {
  // beam = 4 wide where (world coord mod 30) in [28, 32), running along the room's short axis; lamps (pixel centre +-2) stay clear
  const pieces = new Set();
  for (const [i, j] of cells) for (let x = X + i * C; x < X + (i + 1) * C; x += R2) for (let y = Y + j * C; y < Y + (j + 1) * C; y += R2) {
    const v = ((alongX ? y : x) % 30 + 30) % 30;
    if ((v >= 28 || v < 2) && wallGap(x + 1, y + 1, i, j) > 2) pieces.add(`${x / R2},${y / R2}`);
  }
  for (const [a0, b0, a1, b1] of cover(pieces)) put({ asset: MB, color: LINTEL }, a0 * R2, b0 * R2, TOP - 6, a1 * R2, b1 * R2, TOP);
}

const normals = {}, DOOR_TOP = F + DOOR_H, COURSE = 10;
const solid = (i, j) => isWall(i, j) || at(i, j) === 'G', outside = (i, j) => !solid(i, j) && at(i, j) !== 'R';
const SIDES = [[-1, 0, 2], [1, 0, 0], [0, -1, 3], [0, 1, 1]]; // outward normal, siding ramp rotation

// window resolver: straight outside walls with a room behind them, kept 2 pixels clear of doors; windows WIN_N pixels
// wide, one per ~6 pixels of run, with a pixel of wall at each run end. Sill and head sit on siding course lines.
const WIN_N = 2, WIN_Z0 = Z + 3 * COURSE, WIN_Z1 = Z + 7 * COURSE, GLASS = [170, 210, 230];
const windows = new Map(); // "i,j" -> { dx, dy, lo, hi } (lo / hi: this pixel ends the window on that side)
for (const [dx, dy] of SIDES) {
  const cand = (i, j) => isWall(i, j) && outside(i + dx, j + dy) && at(i - dx, j - dy) === 'R' && isWall(i + dy, j + dx) && isWall(i - dy, j - dx)
    && ![-2, -1, 0, 1, 2].some(a => [-2, -1, 0, 1, 2].some(b => at(i + a, j + b) === 'G'));
  for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
    if (!cand(i, j) || cand(i - Math.abs(dy), j - Math.abs(dx))) continue; // start of a run (runs go +y for x faces, +x for y faces)
    let n = 0; while (cand(i + n * Math.abs(dy), j + n * Math.abs(dx))) n++;
    const m = n - 2, k = Math.floor((m + 4) / 6);
    for (let t = 0; t < k; t++) {
      const s0 = 1 + Math.floor(m * (t + 0.5) / k - WIN_N / 2);
      for (let q = 0; q < WIN_N; q++)
        windows.set(`${i + (s0 + q) * Math.abs(dy)},${j + (s0 + q) * Math.abs(dx)}`, { dx, dy, lo: q === 0, hi: q === WIN_N - 1 });
    }
  }
}
for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
  const x0 = X + i * C, y0 = Y + j * C, c = at(i, j);
  if (c === 'G') put({ asset: MB, color: TRIM }, x0, y0, Z, x0 + C, y0 + C, F); // threshold
  if (c === 'G' || isWall(i, j)) put({ asset: MB, color: CEIL }, x0, y0, TOP, x0 + C, y0 + C, TOP + 4);
  if (c === 'G') wallCell(i, j, true);
  if (!isWall(i, j)) continue;
  const nk = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => inner(i + di, j + dj)) ? `${inner(i + 1, j) - inner(i - 1, j)},${inner(i, j + 1) - inner(i, j - 1)}` : 'outside';
  normals[nk] = (normals[nk] ?? 0) + 1;
  wallCell(i, j, false);
}
// one wall pixel, or the wall over a door pixel (from DOOR_TOP, plaster soffit underneath). normals: faces toward a room
// take that room's wallpaper; a wall pixel's faces toward a door are plaster jambs below DOOR_TOP and no face above it
// (the wall over the door abuts there, so the room skins run through to the corner)
function wallCell(i, j, door) {
  const w = windows.get(`${i},${j}`);
  if (w) {
    const f = (a, b) => at(a, b) === 'R' ? room(a, b) : null;
    wallBand(i, j, Z, WIN_Z0, f); wallBand(i, j, WIN_Z1, TOP, f);
    return windowBand(i, j, w);
  }
  if (door) return wallBand(i, j, DOOR_TOP, TOP, (a, b) => at(a, b) === 'R' ? room(a, b) : null, true);
  wallBand(i, j, Z, DOOR_TOP, (a, b) => at(a, b) === 'R' ? room(a, b) : at(a, b) === 'G' ? 'jamb' : null);
  wallBand(i, j, DOOR_TOP, TOP, (a, b) => at(a, b) === 'R' ? room(a, b) : null);
}
// a window pixel between the sill and head: sill + head across the wall and the siding strip, jambs at the window ends,
// a 2-thick pane in the middle of the wall
function windowBand(i, j, { dx, dy, lo, hi }) {
  const x0 = X + i * C, y0 = Y + j * C, trim = { asset: MB, color: TRIM }, glass = { asset: MB, color: GLASS, material: 'BMC_Glass' };
  // r = along the wall, t = across it (out = outward side); box(r0, r1, t0, t1, z0, z1) in world terms
  const [r0, t0] = dx ? [y0, x0] : [x0, y0], r1 = r0 + C, t1 = t0 + C, out = dx || dy;
  const box = (m, a0, a1, b0, b1, z0, z1) => dx ? put(m, b0, a0, z0, b1, a1, z1) : put(m, a0, b0, z0, a1, b1, z1);
  const [s0, s1] = out < 0 ? [t0 - SKIN, t1] : [t0, t1 + SKIN];
  box(trim, r0, r1, s0, s1, WIN_Z0, WIN_Z0 + 2); box(trim, r0, r1, s0, s1, WIN_Z1 - 2, WIN_Z1);
  if (lo) box(trim, r0, r0 + 2, t0, t1, WIN_Z0 + 2, WIN_Z1 - 2);
  if (hi) box(trim, r1 - 2, r1, t0, t1, WIN_Z0 + 2, WIN_Z1 - 2);
  const mid = t0 + C / 2;
  box(glass, r0 + (lo ? 2 : 0), r1 - (hi ? 2 : 0), mid - 1, mid + 1, WIN_Z0 + 2, WIN_Z1 - 2);
}
function wallBand(i, j, z0, z1, face, soffit = false) {
  const x0 = X + i * C, y0 = Y + j * C, x1 = x0 + C, y1 = y0 + C;
  const fw = face(i - 1, j), fe = face(i + 1, j), fs_ = face(i, j - 1), fn = face(i, j + 1);
  const cx0 = x0 + (fw ? SKIN : 0), cx1 = x1 - (fe ? SKIN : 0), cy0 = y0 + (fs_ ? SKIN : 0), cy1 = y1 - (fn ? SKIN : 0);
  put({ asset: MB, color: SIDING }, cx0, cy0, soffit ? z0 + SKIN : z0, cx1, cy1, z1);
  if (soffit) put({ asset: MB, color: PLASTER }, cx0, cy0, z0, cx1, cy1, z0 + SKIN);
  const skin = (f, axis, u0, u1, t) => paper(f === 'jamb' ? null : f, axis, u0, u1, t, z0, z1);
  if (fs_) skin(fs_, 0, x0, x1, [y0, cy0]);
  if (fn) skin(fn, 0, x0, x1, [cy1, y1]);
  if (fw) skin(fw, 1, cy0, cy1, [x0, cx0]);
  if (fe) skin(fe, 1, cy0, cy1, [cx1, x1]);
}
// wallpaper resolver: a skin running along u (axis 0 = x, 1 = y) from u0 to u1 and z0 to z1, t = its [lo, hi] across the face
function paper(r, axis, u0, u1, [t0, t1], z0, z1) {
  const fn = PAPERS[r?.style.wall ?? 'plain'], pieces = new Map();
  for (let u = u0; u < u1; u += R2) for (let z = z0; z < z1; z += R2) {
    const [key, color] = fn(u + 1, z + 1 - F), k = JSON.stringify([key, color]);
    (pieces.get(k) ?? pieces.set(k, new Set()).get(k)).add(`${u / R2},${z / R2}`);
  }
  for (const [k, set] of pieces) for (const [a0, b0, a1, b1] of cover(set)) {
    const m = { asset: MB, color: JSON.parse(k)[1] };
    if (axis === 0) put(m, a0 * R2, t0, b0 * R2, a1 * R2, t1, b1 * R2); else put(m, t0, a0 * R2, b0 * R2, t1, a1 * R2, b1 * R2);
  }
}

// lap siding (owner's sample, 2026-11-03): every outside face gets 10-high courses of a 2-thick micro ramp rising into
// the wall (rotation r rises toward -x, -y, +x, +y for r = 0..3), a micro wedge corner capping each outside corner.
// Over doors only whole courses above DOOR_TOP, with a flat trim under them; x-facing runs step aside at inside corners.
for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
  if (!solid(i, j)) continue;
  const door = at(i, j) === 'G', x0 = X + i * C, y0 = Y + j * C, x1 = x0 + C, y1 = y0 + C;
  const zs = []; for (let z = Z; z + COURSE <= TOP; z += COURSE) if ((!door || z >= DOOR_TOP) && !(windows.has(`${i},${j}`) && z >= WIN_Z0 && z < WIN_Z1)) zs.push(z);
  for (const [dx, dy, rot] of SIDES) {
    if (!outside(i + dx, j + dy)) continue;
    let [a0, a1, b0, b1] = dx ? [dx < 0 ? x0 - SKIN : x1, dx < 0 ? x0 : x1 + SKIN, y0, y1] : [x0, x1, dy < 0 ? y0 - SKIN : y1, dy < 0 ? y0 : y1 + SKIN];
    if (dx) { if (solid(i + dx, j - 1)) b0 += SKIN; if (solid(i + dx, j + 1)) b1 -= SKIN; }
    for (const z of zs) put({ asset: RAMP, direction: 4, rotation: rot, color: SIDING }, a0, b0, z, a1, b1, z + COURSE);
    if (door) put({ asset: MB, color: TRIM }, a0, b0, DOOR_TOP, a1, b1, zs[0]);
  }
  // outside corners: both side faces and the diagonal are outside
  for (const [cx, cy, rot] of [[-1, -1, 2], [1, -1, 3], [1, 1, 0], [-1, 1, 1]])
    if (outside(i + cx, j) && outside(i, j + cy) && outside(i + cx, j + cy)) {
      const px = cx < 0 ? x0 - SKIN : x1, py = cy < 0 ? y0 - SKIN : y1;
      for (const z of zs) put({ asset: CORNER, direction: 4, rotation: rot, color: SIDING }, px, py, z, px + SKIN, py + SKIN, z + COURSE);
    }
}

for (const [k, list] of boxes) for (const b of merge(list, /Ramp|Corner/.test(k) ? [0, 1] : undefined)) { // siding courses stay separate
  const m = JSON.parse(k);
  if (m.asset === RAMP || m.asset === CORNER) { // rotated pieces take local sizes: odd rotations swap x and y
    const sz = [(b[3] - b[0]) / 2, (b[4] - b[1]) / 2, (b[5] - b[2]) / 2];
    B.add({ ...m, size: m.rotation & 1 ? [sz[1], sz[0], sz[2]] : sz, position: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] }, 'siding');
  } else B.box(...b, m, 'piece');
}
for (const [x, y] of lamps) B.box(x - 2, y - 2, TOP - 2, x + 2, y + 2, TOP, { asset: MB, color: [255, 220, 160], material: 'BMC_Glow', material_intensity: 8 }, 'lamp');
console.error(`${g.length - 2}x${g[0].length - 2} plan, ${rooms.length} rooms (${rooms.map(r => `${r.cells.length}px ${r.style.floor}/${r.style.wall}/${r.style.ceil}`).join(', ')})`);
console.error(`${B.bricks.length} bricks, dropped ${B.dropped.length}${B.dropped.slice(0, 4).map(d => ', ' + d).join('')}`);
console.error('wall normals (inward x,y: pixels)', normals);
const bricks = B.bricks.map(({ label, group, ...b }) => b);
fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
