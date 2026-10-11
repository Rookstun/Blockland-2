// Duel arena: a sandstone colosseum floating in the sky (Al Kharid style).
//   node arena/arenagen.mjs > arena/arena_bricks.json
// Sand pit (60 x 40 studs) walled 6 bricks high, red gate/pad at -x, blue at
// +x, five tiers of stands with aisle steps on the long sides, crenellated back
// wall, four corner towers with braziers, a floating rock underneath (tile
// undersides). The duel plugin (omegga-duel) uses PIT below: keep them in sync.
// Loaded by bridge/tools/loadextras.py (bricks op, map owner).
import { makeBuilder } from '../mapgen/builder.mjs';

export const CENTER = [-8200, -9400], FLOOR = 8000; // pit floor top
export const PIT = [300, 200]; // pit half extents
const [PX, PY] = PIT, W = 20, T = 5, D = 40, R = 24;
const OX = PX + W + D * T, OY = PY + W + D * T; // stands' outer edge
const TW = 80; // tower size
const B0 = FLOOR - 4; // top of the base slab, under the pit tiles

const C = {
  sand: [226, 200, 150], sandDark: [196, 160, 108], line: [150, 110, 70],
  stone: [214, 180, 120], stone2: [190, 154, 102], trim: [160, 124, 82],
  rock: [112, 96, 80], rock2: [96, 82, 70], iron: [38, 38, 44],
  red: [190, 40, 36], blue: [40, 80, 190], gold: [230, 180, 60],
};
const m = (color, asset) => (asset ? { color, asset } : { color });

const bd = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, color, label, asset) => bd.slab(x0, y0, z0, x1, y1, z1, m(color, asset), label);
/** brick body with a smooth tile cap on top */
const capped = (x0, y0, z0, x1, y1, z1, color, cap, label) => {
  box(x0, y0, z0, x1, y1, z1 - 4, color, label);
  box(x0, y0, z1 - 4, x1, y1, z1, cap ?? color, label + ' cap', 'PB_DefaultTile');
};
/** face-down tile (smooth underside) */
const under = (x0, y0, z0, x1, y1, color, label) => {
  for (let x = x0; x < x1; x += 400) for (let y = y0; y < y1; y += 400) {
    const a = Math.min(x1, x + 400), b = Math.min(y1, y + 400);
    bd.add({ asset: 'PB_DefaultTile', color, direction: 5, rotation: 0, size: [(a - x) / 2, (b - y) / 2, 2], position: [(x + a) / 2, (y + b) / 2, z0 + 2] }, label);
  }
};
/** greedy-merged tile layer over a 10-unit grid, colour per cell centre (null = skip) */
function tiles(x0, y0, x1, y1, z0, z1, colorAt, label) {
  const nx = (x1 - x0) / 10, ny = (y1 - y0) / 10, grid = [];
  for (let j = 0; j < ny; j++) {
    grid.push([]);
    for (let i = 0; i < nx; i++) grid[j].push(colorAt(x0 + i * 10 + 5, y0 + j * 10 + 5));
  }
  const done = grid.map(r => r.map(() => false)), key = c => (c ? c.join() : '');
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (done[j][i] || !grid[j][i]) continue;
      const k = key(grid[j][i]);
      let w = 1;
      while (i + w < nx && w < 40 && !done[j][i + w] && key(grid[j][i + w]) === k) w++;
      let h = 1;
      while (j + h < ny && h < 40 && [...Array(w)].every((_, q) => !done[j + h][i + q] && key(grid[j + h][i + q]) === k)) h++;
      for (let a = 0; a < h; a++) for (let q = 0; q < w; q++) done[j + a][i + q] = true;
      bd.box(x0 + i * 10, y0 + j * 10, z0, x0 + (i + w) * 10, y0 + (j + h) * 10, z1, m(grid[j][i], 'PB_DefaultTile'), label);
    }
}

// --- pit floor: sand with a centre ring, halfway line and the two start pads
tiles(-PX, -PY, PX, PY, B0, FLOOR, (x, y) => {
  const r = Math.hypot(x, y);
  if (Math.abs(x + 240) < 30 && Math.abs(y) < 30) return Math.abs(x + 240) > 20 || Math.abs(y) > 20 ? C.gold : C.red;
  if (Math.abs(x - 240) < 30 && Math.abs(y) < 30) return Math.abs(x - 240) > 20 || Math.abs(y) > 20 ? C.gold : C.blue;
  if (r > 70 && r < 85) return C.line;
  if (r < 25) return C.line;
  if (Math.abs(x) < 10 && r >= 85) return C.sandDark;
  if (Math.abs(x) > PX - 20 || Math.abs(y) > PY - 20) return C.sandDark; // dark rim
  return (Math.floor(x / 40) + Math.floor(y / 40)) & 1 ? C.sand : [220, 193, 142];
}, 'floor');

// --- pit wall (to 8072: a one-brick parapet in front of tier 0), gates at the ends
const WT = FLOOR + 72;
capped(-PX - W, PY, B0, PX + W, PY + W, WT, C.stone2, C.trim, 'wall +y');
capped(-PX - W, -PY - W, B0, PX + W, -PY, WT, C.stone2, C.trim, 'wall -y');
for (const s of [-1, 1]) {
  const [xa, xb] = s < 0 ? [-PX - W, -PX] : [PX, PX + W];
  capped(xa, -PY, B0, xb, -40, WT, C.stone2, C.trim, 'wall end');
  capped(xa, 40, B0, xb, PY, WT, C.stone2, C.trim, 'wall end');
  // recessed iron gate, team-coloured lintel
  const [ra, rb] = s < 0 ? [-PX - W, -PX - 10] : [PX + 10, PX + W];
  box(ra, -40, B0, rb, 40, FLOOR + 56, C.iron, 'gate');
  box(xa, -40, FLOOR + 56, xb, 40, FLOOR + 60, s < 0 ? C.red : C.blue, 'lintel', 'PB_DefaultMicroBrick');
  capped(xa, -40, FLOOR + 60, xb, 40, WT, C.stone2, C.trim, 'over gate');
  // gate jambs: poles in the recess mouth
  for (const y of [-35, 35]) bd.pole(s < 0 ? -PX - 5 : PX + 5, y, FLOOR, FLOOR + 56, 5, m(C.trim), 'jamb');
}

// --- stands: ring i from the wall outward, top FLOOR + 60 + R*i; aisles on the long sides
for (let i = 0; i < T; i++) {
  const a = W + D * i, b = a + D, top = FLOOR + 60 + R * i, col = i & 1 ? C.stone2 : C.stone;
  const ix = PX + a, iy = PY + a, ox = PX + b, oy = PY + b;
  for (const s of [-1, 1]) {
    // ends (x), full ring depth
    capped(s < 0 ? -ox : ix, -iy, B0, s < 0 ? -ix : ox, iy, top, col, C.sand, 'tier end');
    // long sides (y), split for the aisle at |x| < 20
    const [y0, y1] = s < 0 ? [-oy, -iy] : [iy, oy];
    capped(-ox, y0, B0, -20, y1, top, col, C.sand, 'tier side');
    capped(20, y0, B0, ox, y1, top, col, C.sand, 'tier side');
    if (i === 0) capped(-20, y0, B0, 20, y1, top, col, C.sand, 'tier aisle');
    else {
      // two 1-brick steps per tier: front half low, back half high
      const mid = s < 0 ? -(iy + D / 2) : iy + D / 2;
      const [f0, f1, b0, b1] = s < 0 ? [mid, y1, y0, mid] : [y0, mid, mid, y1];
      capped(-20, f0, B0, 20, f1, top - 12, C.trim, C.sandDark, 'step');
      capped(-20, b0, B0, 20, b1, top, C.trim, C.sandDark, 'step');
    }
  }
}

// --- back wall with merlons, team pennant poles over each gate
const BT = FLOOR + 60 + R * (T - 1) + 48;
const merlons = (x0, y0, x1, y1) => {
  const alongX = x1 - x0 > y1 - y0, len = alongX ? x1 - x0 : y1 - y0;
  for (let p = 10; p + 20 <= len - 10; p += 40) {
    if (alongX) capped(x0 + p, y0, BT, x0 + p + 20, y1, BT + 16, C.stone, C.trim, 'merlon');
    else capped(x0, y0 + p, BT, x1, y0 + p + 20, BT + 16, C.stone, C.trim, 'merlon');
  }
};
capped(-OX, OY, B0, OX, OY + W, BT, C.stone, C.trim, 'back wall');
capped(-OX, -OY - W, B0, OX, -OY, BT, C.stone, C.trim, 'back wall');
capped(OX, -OY, B0, OX + W, OY, BT, C.stone, C.trim, 'back wall');
capped(-OX - W, -OY, B0, -OX, OY, BT, C.stone, C.trim, 'back wall');
merlons(-OX, OY, OX, OY + W);
merlons(-OX, -OY - W, OX, -OY);
merlons(OX, -OY, OX + W, OY);
merlons(-OX - W, -OY, -OX, OY);
for (const s of [-1, 1]) {
  const x = s * (OX + W / 2);
  for (const y of [-60, 60]) {
    bd.pole(x, y, BT, BT + 120, 2, m(C.iron), 'flagpole');
    // pennant: a thin coloured slab hanging off the pole toward the arena
    bd.box(s < 0 ? x + 2 : x - 42, y - 1, BT + 80, s < 0 ? x + 42 : x - 2, y + 1, BT + 116, m(s < 0 ? C.red : C.blue, 'PB_DefaultMicroBrick'), 'pennant');
  }
}

// --- corner towers: banded, crenellated, brazier on top
const TT = BT + 60;
for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
  const x0 = sx < 0 ? -OX - TW : OX, y0 = sy < 0 ? -OY - TW : OY, x1 = x0 + TW, y1 = y0 + TW;
  const bands = [FLOOR + 96, BT];
  let z = B0;
  for (const bz of bands) {
    box(x0, y0, z, x1, y1, bz, C.stone2, 'tower');
    // cornice band: 2 units proud, micro bricks (smooth underside)
    bd.box(x0 - (sx < 0 ? 2 : 0), y0 - (sy < 0 ? 2 : 0), bz, x1 + (sx > 0 ? 2 : 0), y1 + (sy > 0 ? 2 : 0), bz + 8, m(C.trim, 'PB_DefaultMicroBrick'), 'band');
    z = bz + 8;
  }
  capped(x0, y0, z, x1, y1, TT, C.stone2, C.trim, 'tower top');
  for (const [mx, my] of [[0, 0], [60, 0], [0, 60], [60, 60], [30, 0], [0, 30], [60, 30], [30, 60]])
    capped(x0 + mx, y0 + my, TT, x0 + mx + 20, y0 + my + 20, TT + 24, C.stone, C.trim, 'tower merlon');
  bd.asset('B_Cauldron', x0 + 40, y0 + 40, TT + 10, m(C.iron), 'brazier');
  bd.asset('B_Flame', x0 + 40, y0 + 40, TT + 30, m([255, 140, 40]), 'flame');
}

// --- base slab under everything, then a floating rock tapering down
const EX = OX + TW, EY = OY + TW;
box(-EX, -EY, B0 - 44, EX, EY, B0, C.stone2, 'base');
under(-EX, -EY, B0 - 48, EX, EY, C.trim, 'base under');
let z = B0 - 48;
for (const [inset, h] of [[40, 48], [100, 60], [170, 72], [250, 72], [330, 60]]) {
  const x = EX - inset, y = EY - inset;
  if (x <= 40 || y <= 40) break;
  // jagged footprint: shift each layer a little so it doesn't read as a perfect pyramid
  const jx = (inset % 3) * 10 - 10, jy = (inset % 7) * 10 - 30;
  box(-x + jx, -y + jy, z - h + 4, x + jx, y + jy, z, inset % 2 ? C.rock : C.rock2, 'rock');
  under(-x + jx, -y + jy, z - h, x + jx, y + jy, C.rock2, 'rock under');
  z -= h;
}

if (bd.dropped.length) throw new Error(`dropped ${bd.dropped.length}:\n` + bd.dropped.slice(0, 10).join('\n'));
const [cx, cy] = CENTER;
const bricks = bd.bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + cx, b.position[1] + cy, b.position[2]] }));
process.stdout.write(JSON.stringify({ bricks }));
console.error(`arena: ${bricks.length} bricks, pit floor z ${FLOOR}, centre ${CENTER}`);
