// rotorraid/world.mjs: mission 1 map + sprite models (original: no names, art or layout from any real game).
// Map = 32 x 32 tiles; a tile is a 16 x 8 px diamond (sc 8). Sprites use sc 2 (1 unit = 1/4 tile): the helicopter
// (a generic twin-engine utility helicopter, Blackhawk-like, no markings) is ~12 px, people 8 px tall.
import { render, makePalette, spans, crop, hash } from './art.mjs';

export const MW = 32, MH = 32, IW = 512, IH = 288, MOX = 256, MOY = 24, MSC = 8;
export const T = { OCEAN: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, ROAD: 5, CONCRETE: 6, PAD: 7, RUNWAY: 8, HOUSE: 9, HANGAR: 10 };
const ISLANDS = [ // [cx, cy, r, seed]
  [6, 24, 4.6, 1], // home: Fort Puddle
  [22, 9, 7.2, 2], // Grubb Island (enemy)
  [12, 13, 2.2, 3], // the accountants' sandbar
];
export const FACTORIES = [[19.5, 6.5], [25.5, 9.5], [20.5, 12.5]];
export const GUNS = [[17.5, 8.5], [23.5, 5.5], [27.5, 12.5], [18.5, 11.5], [23.5, 8.5], [22.5, 14.5]];
export const TANKS = [[[19.5, 9.5], [25.5, 9.5]], [[21.5, 6.5], [21.5, 12.5]]]; // patrol segments on the roads
export const PEOPLE = [[11.5, 12.5], [12.5, 12.5], [11.5, 13.5], [12.5, 13.5]];
export const START = [5.5, 23.5]; // on helipad 1
const PADS = [[5, 23], [7, 25]], RUNWAY = [[3, 27], [9, 27]], HANGAR = [[2, 24]], HOUSES = [[8, 22], [4, 21], [9, 24]];

export function makeTiles() {
  const t = new Array(MW * MH).fill(T.OCEAN), at = (x, y) => (x >= 0 && y >= 0 && x < MW && y < MH ? t[y * MW + x] : T.OCEAN);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) for (const [cx, cy, r, s] of ISLANDS) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (hash(x * 7 + s, y * 13 + s) - 0.5) * 1.6;
    if (d < r) t[y * MW + x] = T.GRASS;
  }
  const land = (x, y) => at(x, y) !== T.OCEAN && at(x, y) !== T.SHALLOW;
  const t2 = t.slice();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (land(x, y) && nb.some(([a, b]) => !land(x + a, y + b))) t2[y * MW + x] = T.SAND;
    if (!land(x, y) && nb.concat([[1, 1], [-1, -1], [1, -1], [-1, 1]]).some(([a, b]) => land(x + a, y + b))) t2[y * MW + x] = T.SHALLOW;
  }
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < MW && y < MH) t2[y * MW + x] = v; };
  // forests on the grass, roads joining the factories on Grubb Island
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (t2[y * MW + x] === T.GRASS && hash(x, y) < 0.28) t2[y * MW + x] = T.FOREST;
  for (let x = 19; x <= 25; x++) set(x, 9, T.ROAD);
  for (let y = 6; y <= 12; y++) set(21, y, T.ROAD);
  for (const [fx, fy] of FACTORIES) for (let a = -1; a <= 0; a++) for (let b = -1; b <= 0; b++) set(Math.floor(fx) + a + 1, Math.floor(fy) + b + 1, T.CONCRETE);
  for (const [gx, gy] of GUNS) set(Math.floor(gx), Math.floor(gy), T.CONCRETE);
  // home base
  for (let x = 2; x <= 9; x++) for (let y = 22; y <= 27; y++) if (land(x, y)) set(x, y, T.GRASS);
  for (let x = RUNWAY[0][0]; x <= RUNWAY[1][0]; x++) set(x, RUNWAY[0][1], T.RUNWAY);
  for (const [x, y] of PADS) set(x, y, T.PAD);
  for (const [x, y] of HANGAR) set(x, y, T.HANGAR);
  for (const [x, y] of HOUSES) set(x, y, T.HOUSE);
  for (let x = 3; x <= 8; x++) set(x, 26, T.ROAD);
  return t2;
}

const C = { deep: [36, 74, 140], shallow: [58, 120, 176], sand: [222, 200, 140], grass: [92, 150, 70], grass2: [80, 136, 62], tree: [44, 100, 52], trunk: [100, 70, 40],
  road: [110, 108, 104], conc: [168, 166, 160], pad: [150, 150, 150], mark: [250, 250, 250], asph: [70, 70, 74], wall: [214, 196, 160], roof: [170, 70, 50],
  hangar: [150, 156, 160], door: [60, 62, 66] };
export function mapImage(tiles, pal) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < MW && y < MH ? tiles[y * MW + x] : T.OCEAN);
  // above-ground solids per tile type, in tile-local coords (fx, fy in 0..1)
  const tall = (X, Y, Z) => {
    const tx = Math.floor(X), ty = Math.floor(Y), fx = X - tx, fy = Y - ty, k = at(tx, ty);
    if (k === T.FOREST) for (const [ox, oy] of [[0.3, 0.35], [0.7, 0.68]]) { const d = Math.hypot(fx - ox, fy - oy), hgt = 1.3 + hash(tx * 3 + ox * 10, ty) * 0.5; if (Z < 0.25 && d < 0.06) return 'trunk'; if (Z >= 0.25 && Z < hgt && d < 0.26 * (hgt - Z) / (hgt - 0.25)) return 'tree'; }
    if (k === T.HOUSE && fx > 0.15 && fx < 0.85 && fy > 0.2 && fy < 0.8) { if (Z < 0.9) return 'wall'; const ridge = 0.9 + 0.5 * (1 - Math.abs(fy - 0.5) / 0.3); if (Z < ridge) return 'roof'; }
    if (k === T.HANGAR && fx > 0.05 && fx < 0.95 && fy > 0.1 && fy < 0.9) { const arch = 1.4 * Math.sqrt(Math.max(0, 1 - ((fx - 0.5) / 0.45) ** 2)); if (Z < arch) return fy < 0.16 && Math.abs(fx - 0.5) < 0.3 && Z < 1 ? 'door' : 'hangar'; }
    return null;
  };
  const solid = (X, Y, Z) => Z <= 0 || tall(X, Y, Z) != null;
  const mat = (X, Y, Z) => {
    if (Z > 0) return C[tall(X, Y, Z)];
    const tx = Math.floor(X), ty = Math.floor(Y), fx = X - tx, fy = Y - ty, k = at(tx, ty);
    if (k === T.OCEAN) return C.deep;
    if (k === T.SHALLOW) return C.shallow;
    if (k === T.SAND) return C.sand;
    if (k === T.GRASS || k === T.FOREST || k === T.HOUSE) return (tx + ty) % 2 ? C.grass : C.grass2;
    if (k === T.ROAD) return C.road;
    if (k === T.CONCRETE || k === T.HANGAR) return C.conc;
    if (k === T.PAD) { const u = fx - 0.5, v = fy - 0.5, H = (Math.abs(u) < 0.25 && Math.abs(v) < 0.06) || (Math.abs(v) < 0.28 && Math.abs(Math.abs(u) - 0.22) < 0.05); return H ? C.mark : Math.hypot(u, v) > 0.42 ? C.conc : C.pad; }
    if (k === T.RUNWAY) return Math.abs(fy - 0.5) < 0.05 && fx > 0.2 && fx < 0.6 ? C.mark : C.asph;
    return C.grass;
  };
  const px = render({ w: IW, h: IH, ox: MOX, oy: MOY, sc: MSC, zmax: 2, dz: 1 / 16, solid, mat });
  return spans(px, IW, IH, pal);
}

// ---- sprites (sc 2: 1 unit = 1/4 tile). Each model: solid(x, y, z) -> colour or null, in its own frame
const box = (x, y, z, x0, y0, z0, x1, y1, z1) => x >= x0 && x < x1 && y >= y0 && y < y1 && z >= z0 && z < z1;
const rot = (x, y, a) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];
const HELI = { body: [64, 70, 60], dark: [44, 48, 42], glass: [90, 140, 170], rotor: [26, 26, 28] };
// HS = length scale (Rookstun: 14 px long, was ~12), HZ = height scale (+2 px taller)
const HS = 16 / 12, HZ = 1.25; // 16 px long (Rookstun: 2 more)
function heli(d, f) {
  const a = d * Math.PI / 4;
  return (x0, y0, z0) => {
    const x = x0 / HS, y = y0 / HS, z = z0 / HZ;
    const [u, v] = rot(x, y, a);
    if (z >= 1.6 && z < 1.72) { const [p, q] = rot(u, v, f ? Math.PI / 4 : 0); if ((Math.abs(p) < 2.7 && Math.abs(q) < 0.16) || (Math.abs(q) < 2.7 && Math.abs(p) < 0.16)) return HELI.rotor; } // thin blades (Rookstun), still >= 1 px
    if (box(u, v, z, -0.25, -0.25, 1.25, 0.25, 0.25, 1.55)) return HELI.dark; // mast
    if (box(u, v, z, 0.9, -0.5, 0.45, 1.7, 0.5, 1.15) && u - 0.9 > (z - 0.45) * 0.4 - 0.2) return HELI.glass; // cockpit glazing
    if (box(u, v, z, -1.2, -0.62, 0.35, 1.7, 0.62, 1.25)) return HELI.body;
    if (box(u, v, z, -0.9, -0.75, 1.0, 0.4, 0.75, 1.3)) return HELI.dark; // engines
    if (box(u, v, z, -3.6, -0.18, 0.8, -1.2, 0.18, 1.1)) return HELI.body; // tail boom
    if (box(u, v, z, -3.7, -0.12, 1.1, -3.3, 0.12, 1.9)) return HELI.body; // fin
    if (box(u, v, z, -3.5, -0.8, 0.85, -3.1, 0.8, 0.95)) return HELI.dark; // stabiliser
    if (box(u, v, z, -0.6, -0.7, 0.1, 0.9, -0.55, 0.35) || box(u, v, z, -0.6, 0.55, 0.1, 0.9, 0.7, 0.35)) return HELI.rotor; // wheels/gear
    return null;
  };
}
const person = f => (x, y, z) => {
  if (box(x, y, z, -0.35, -0.3, 0, 0.35, 0.3, 1.5)) return [50, 60, 110];
  if (box(x, y, z, -0.45, -0.35, 1.5, 0.45, 0.35, 3)) return [236, 236, 228];
  if (box(x, y, z, -0.3, -0.3, 3, 0.3, 0.3, 4)) return [228, 180, 140];
  if (f && (box(x, y, z, -0.15, -0.65, 2.4, 0.15, -0.35, 4.2) || box(x, y, z, -0.15, 0.35, 2.4, 0.15, 0.65, 4.2))) return [236, 236, 228];
  return null;
};
const tank = d => (x, y, z) => {
  const [u, v] = rot(x, y, d * Math.PI / 2);
  if (box(u, v, z, -1.3, -0.95, 0, 1.3, -0.5, 0.5) || box(u, v, z, -1.3, 0.5, 0, 1.3, 0.95, 0.5)) return [40, 40, 36];
  if (box(u, v, z, -1.2, -0.6, 0.15, 1.2, 0.6, 0.65)) return [110, 104, 64];
  if (box(u, v, z, -0.55, -0.45, 0.65, 0.45, 0.45, 1.05)) return [96, 92, 56];
  if (box(u, v, z, 0.45, -0.1, 0.8, 1.9, 0.1, 0.95)) return [60, 60, 50];
  return null;
};
const gun = dead => (x, y, z) => {
  const r = Math.hypot(x, y);
  if (dead) return z < 0.2 && r < 1 ? [40, 36, 32] : null;
  if (z < 0.45 && r < 0.95) return [120, 116, 100];
  if (z >= 0.45 && z < 0.9 && r < 0.55) return [96, 92, 70];
  for (const s of [-0.22, 0.22]) if (Math.abs(y - s) < 0.09 && x > 0 && x < 1.3 && Math.abs(z - (0.75 + x * 0.6)) < 0.1) return [60, 60, 54];
  return null;
};
const factory = dead => (x, y, z) => {
  if (dead) { const hgt = 0.35 + hash(Math.floor(x * 2) + 40, Math.floor(y * 2)) * 0.9; return box(x, y, z, -3.6, -3.6, 0, 3.6, 3.6, hgt) ? (hash(Math.floor(x * 3), Math.floor(y * 3)) < 0.5 ? [70, 62, 56] : [44, 40, 38]) : null; }
  if (box(x, y, z, -3.6, -3.2, 0, 3.4, 3.2, 3)) return z > 2.2 && z < 2.6 && y < -3 ? [140, 60, 150] : [176, 150, 132];
  if (box(x, y, z, -3.6, -3.2, 3, 3.4, 3.2, 4)) { const saw = (x + 3.6) % 1.75; return z - 3 < saw * 0.55 ? [120, 120, 128] : null; } // sawtooth roof
  for (const [sx, sy] of [[-2.2, 2.2], [1.8, 2.2]]) if (Math.hypot(x - sx, y - sy) < 0.5 && z < 7.2) return z > 6.6 ? [180, 60, 50] : [120, 70, 60];
  return null;
};
const flat = (col, rx, ry) => (x, y, z) => (z < 0.05 && (x / rx) ** 2 + (y / ry) ** 2 < 1 ? col : null);
const ball = (col, col2, r) => (x, y, z) => { const d = Math.hypot(x, y, z - r); return d < r ? (d < r * 0.6 ? col2 : col) : null; };
const bolt = (col, len, wid) => (x, y, z) => (Math.abs(x) < len && Math.abs(y) < wid && z >= 0 && z < 0.25 ? col : null);

// id order is the bus contract with gen.mjs
export const SPR = {}; let SID = 0; const SPRITES = [];
const add = (name, fn, zmax = 8) => { SPR[name] = SID++; SPRITES.push({ name, fn, zmax }); };
for (let d = 0; d < 8; d++) for (let f = 0; f < 2; f++) add(`heli${d}_${f}`, heli(d, f));
add('shadow', flat([36, 46, 40], 1.9, 1.9));
// people are hand-drawn pixels (Rookstun: "people should be 3 pixels tall"): head, shirt, legs; waving = arms up
const PX = { h: [228, 180, 140], s: [236, 236, 228], l: [50, 60, 110], a: [228, 180, 140], H: [70, 80, 50], o: [90, 100, 60], g: [10, 10, 10], L: [60, 66, 40], b: [184, 164, 112], B: [150, 132, 92], x: [40, 36, 32] };
const addPix = (name, rows) => { SPR[name] = SID++; SPRITES.push({ name, rows }); };
// 2 wide x 4 tall (Rookstun): head, shirt x2, legs
addPix('person0', ['hh', 'ss', 'ss', 'll']); addPix('person1', ['ahha', '.ss.', '.ss.', '.ll.']);
for (let d = 0; d < 4; d++) add(`tank${d}`, tank(d));
// sandbag post: a 3 px soldier (helmet, body, legs) with a 1 px black gun, bags around his legs (Rookstun)
addPix('gun', ['..HH..', '..oog.', '..oo..', 'bBLLBb']); addPix('gunDead', ['......', '......', '..xx..', 'bxBBxb']);
add('factory', factory(false), 8); add('factoryDead', factory(true), 3);
// tracers: 4 px lines pointing the way they fly, bright pixel at the front (Rookstun), one per heading d (world angle d*45 deg)
// tracers: 4 px lines along the screen direction of each of 16 world headings (22.5 deg apart: gives true screen
// diagonals too, Rookstun), bright pixel at the front
export const NTR = 16;
function tracer(k, dim, mid, hot) {
  const a = k * 2 * Math.PI / NTR, wx = Math.cos(a), wy = Math.sin(a), sx = wx - wy, sy = (wx + wy) / 2, m = Math.max(Math.abs(sx), Math.abs(sy));
  const pts = [0, 1, 2, 3].map(i => [Math.round(i * sx / m), Math.round(i * sy / m)]);
  const x0 = Math.min(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), w = Math.max(...pts.map(p => p[0])) - x0 + 1, h = Math.max(...pts.map(p => p[1])) - y0 + 1;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  pts.forEach(([x, y], i) => { g[y - y0][x - x0] = i === 3 ? hot : i === 0 ? dim : mid; });
  return g.map(r => r.join(''));
}
Object.assign(PX, { 1: [200, 170, 60], 2: [255, 230, 90], 3: [255, 255, 220], 4: [170, 50, 40], 5: [240, 90, 60], 6: [255, 210, 160] });
for (let k = 0; k < NTR; k++) addPix(`bullet${k}`, tracer(k, '1', '2', '3'));
for (let k = 0; k < NTR; k++) addPix(`ebullet${k}`, tracer(k, '4', '5', '6'));
add('missile', bolt([240, 240, 240], 0.8, 0.18));
add('boom0', ball([250, 140, 40], [255, 236, 130], 1.3)); add('boom1', ball([200, 80, 40], [250, 170, 60], 2.1));
addPix('person_board', ['hh', 'ss', 'ss', 'll']);
// target lock marker (right mouse cycles targets): 4 corner pixels around the locked target
Object.assign(PX, { 7: [255, 60, 60] }); addPix('lock', ['7......7', '........', '........', '........', '........', '7......7']); // spare id for people walking to the helicopter

export function sprites(pal) {
  return SPRITES.map(({ name, fn, zmax, rows }) => {
    if (rows) { // pixel sprite: anchor = bottom centre (feet on the ground point)
      const w = rows[0].length, h = rows.length, px = rows.flatMap(r => [...r].map(c => (c === '.' ? null : PX[c])));
      return { name, px, w, h, ax: Math.floor(w / 2), ay: h, rows: spans(px, w, h, pal) };
    }
    const W = 72, H = 72, ox = 36, oy = 54;
    const px = render({ w: W, h: H, ox, oy, sc: 2, zmax, zmin: 0, dz: 0.04, solid: (x, y, z) => fn(x, y, z) != null, mat: (x, y, z) => fn(x, y, z) });
    const c = crop(px, W, H, ox, oy);
    return { name, ...c, rows: spans(c.px, c.w, c.h, pal) };
  });
}
export { makePalette };
