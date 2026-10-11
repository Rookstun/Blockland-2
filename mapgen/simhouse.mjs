// Sims-style houses on a little street (owner 2026-10-08: "use your worldgen
// wall generator to build sims like houses ... in front of me").
//
//   node simhouse.mjs X Y YAW BASE GROUND > job.json
//
// X, Y: the player's position, YAW their view (degrees, Unreal: 0 = +x, 90 = +y),
// BASE: world z of the lot's top (above any water), GROUND: world z of the
// terrain under it (the island pad fills down to it). Writes a bridge job
// ({ ops }) that loads every brick at its own world coordinates.
//
// Local frame: x across, +y away from the player (the way they face), z up
// from the pad top. A road and a pavement run across in front, then three
// fenced lots, each with a wallgen house (wallhouse.mjs buildFromPlan: walls,
// windows, floors, stairs) facing the road: a living room and a kitchen at the
// front, bedrooms / bath / dining / study behind (and upstairs on two-storey
// houses), furnished room by room, ceiling lights, a gable roof, a porch,
// flower beds, a path, a mailbox, trees and a picket fence.

import { buildFromPlan, H, V, door, win, even } from './wallhouse.mjs';
import { makeBuilder } from './builder.mjs';
import { orientFor, turnBrick } from './orient.mjs';
import { floorPieces } from './floors.mjs';
import { townCourses } from './roofs.mjs';

const [PX, PY, YAW, BASE, GROUND] = process.argv.slice(2).map(Number);
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 5) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [240, 240, 236], WOOD = [126, 86, 54], DARK = [52, 48, 46];

const B = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, b, label = 'box') => {
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
  B.add({ asset: MB, ...b, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label);
};
const pole = (x, y, z0, z1, r, b, label = 'pole') => B.add({ asset: 'PB_DefaultPole', ...b, size: [r, r, (z1 - z0) / 2], position: [x, y, (z0 + z1) / 2] }, label);
const asset = (name, x, y, z, b) => B.add({ asset: name, size: [0, 0, 0], ...b, position: [x, y, z] }, name);
let seed = 1;
const rnd = (...k) => { let h = seed | 0; for (const v of k) { h = Math.imul(h ^ Math.round(v * 977), 2654435761); h ^= h >>> 15; } h = Math.imul(h, 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
const pick = (list, ...k) => list[Math.floor(rnd(...k) * list.length)];

// -------------------------------------------------------------- the plans --
// (owner 2026-10-08: "incorporate hallways, give more space"). A plan returns
// wallgen runs and its rooms: { rect: [x0, x1, y0, y1] interior stud cells
// (y back from the front face), t: [ground type, upstairs type] }, plus fd,
// the front door's stud x. Doors keep 5 studs off any wall junction.
const clearOf = (p, js) => { for (let k = 0; k < 8 && js.some(j => Math.abs(j - p) < 5); k++) p += 2; return p; };
const HW = 8; // hallway width, studs
// windows centred in each room's stretch of an outside wall (owner 2026-10-08:
// "uncentered windows"): js are the junctions along the wall [a, b]; a stretch
// holding a door gets none; 1-3 per stretch, evenly spaced, in the house's
// window width (WW), 2 where the stretch is narrow. Wallgen keeps openings on
// even studs, so a window can sit half a stud off a room's true centre.
let WW = 2;
function wins(a, b, js, doors = []) {
  const cuts = [...new Set([a, b, ...js])].sort((p, q) => p - q), out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1], len = s1 - s0 - 1; // interior studs s0+1 .. s1
    if (doors.some(d => d > s0 && d < s1)) continue;
    const w = len >= WW + 4 ? WW : 2;
    if (len < w + 4) continue;
    const n = Math.max(1, Math.min(3, Math.floor((len + 4) / (w + 10))));
    for (let k = 0; k < n; k++) out.push(win(even(s0 + 1 + (len * (k + 0.5)) / n), w));
  }
  return out;
}
// cross hall: living | foyer (front door) | kitchen across the front, a
// hallway right across the house behind them, bedrooms and a bath off it
function crossPlan(W, D, r) {
  const f = even(D * (0.38 + 0.06 * r(1))), g = f + HW;
  const a1 = even(W * (0.34 + 0.04 * r(2))), a2 = a1 + even(W * 0.24);
  const fd = even((a1 + a2) / 2);
  const bs = W >= 46 ? [even(W * 0.38), even(W * 0.62)] : [even(W * 0.56)];
  const backL = [0, ...bs, W];
  const backDoors = backL.slice(0, -1).map((l, i) => clearOf(even((l + backL[i + 1]) / 2), backL));
  const runs = [
    H(0, 0, W, [door(fd, 4), ...wins(0, W, [a1, a2], [fd])]),
    H(D, 0, W, wins(0, W, bs)),
    V(0, 0, D, wins(0, D, [f, g])),
    V(W, 0, D, wins(0, D, [f, g])),
    H(f, 0, W, [door(fd, a2 - a1 - 6), door(clearOf(even((a2 + W) / 2), [a2, W]), 4)]),
    H(g, 0, W, backDoors.map(p => door(p, 4))),
    V(a1, 0, f, [door(even(f / 2), 6)]),
    V(a2, 0, f, []),
    ...bs.map(x => V(x, g, D, [])),
  ];
  const back2 = bs.length === 2 ? [['bed', 'bed'], ['bath', 'bath'], ['study', 'bed']] : [['bed', 'bed'], ['bath', 'bath']];
  const rooms = [
    { rect: [1, a1, 1, f], t: ['living', 'bed'] },
    { rect: [a1 + 1, a2, 1, f], t: ['foyer', 'hall'] },
    { rect: [a2 + 1, W, 1, f], t: ['kitchen', 'study'] },
    { rect: [1, W, f + 1, g], t: ['hall', 'hall'] },
    ...backL.slice(0, -1).map((l, i) => ({ rect: [l + 1, backL[i + 1], g + 1, D], t: back2[i] })),
  ];
  rooms.fd = fd; rooms.runs = runs; // buildFromPlan passes only runs and rooms through
  return { runs, rooms };
}
// centre hall: a corridor from the front door to a back door, living room and
// a bedroom on the left, kitchen, bath and a bedroom on the right
function centrePlan(W, D, r) {
  const c0 = even(W / 2 - HW / 2 + (r(1) - 0.5) * 4), c1 = c0 + HW;
  const L1 = even(D * (0.5 + 0.06 * r(2))), R1 = even(D * 0.4), R2 = even(D * 0.64);
  const fd = c0 + HW / 2;
  const runs = [
    H(0, 0, W, [door(fd, 4), ...wins(0, W, [c0, c1], [fd])]),
    H(D, 0, W, [door(fd, 4), ...wins(0, W, [c0, c1], [fd])]),
    V(0, 0, D, wins(0, D, [L1])),
    V(W, 0, D, wins(0, D, [R1, R2])),
    V(c0, 0, D, [door(clearOf(even(L1 / 2), [0, L1, D]), 6), door(clearOf(even((L1 + D) / 2), [0, L1, D]), 4)]),
    V(c1, 0, D, [door(clearOf(even(R1 / 2), [0, R1]), 6), door(clearOf(even((R1 + R2) / 2), [R1, R2]), 4), door(clearOf(even((R2 + D) / 2), [R2, D]), 4)]),
    H(L1, 0, c0, []), H(R1, c1, W, []), H(R2, c1, W, []),
  ];
  const rooms = [
    { rect: [1, c0, 1, L1], t: ['living', 'bed'] },
    { rect: [1, c0, L1 + 1, D], t: ['bed', 'bed'] },
    { rect: [c0 + 1, c1, 1, D], t: ['hall', 'hall'] },
    { rect: [c1 + 1, W, 1, R1], t: ['kitchen', 'study'] },
    { rect: [c1 + 1, W, R1 + 1, R2], t: ['bath', 'bath'] },
    { rect: [c1 + 1, W, R2 + 1, D], t: ['dining', 'bed'] },
  ];
  rooms.fd = fd; rooms.runs = runs; // buildFromPlan passes only runs and rooms through
  return { runs, rooms };
}
// open plan (owner 2026-10-08: "open floor plan housing"): the front of the
// house is one great room, living | dining (front door) | kitchen as zones with
// no walls between them, and the bedrooms and the bath open straight off it.
// The zones are rooms for floors and furniture only (rooms.great is the whole
// space, for the stairs); a zone's open side is just where its furniture stops.
function openPlan(W, D, r) {
  const g = even(D * (0.52 + 0.06 * r(1)));
  const a1 = even(W * (0.36 + 0.04 * r(2))), a2 = even(W * (0.64 + 0.04 * r(3)));
  const fd = even((a1 + a2) / 2);
  const bs = W >= 46 ? [even(W * 0.38), even(W * 0.62)] : [even(W * 0.56)];
  const backL = [0, ...bs, W];
  const backDoors = backL.slice(0, -1).map((l, i) => clearOf(even((l + backL[i + 1]) / 2), backL));
  const runs = [
    H(0, 0, W, [door(fd, 4), ...wins(0, W, [a1, a2], [fd])]),
    H(D, 0, W, wins(0, W, bs)),
    V(0, 0, D, wins(0, D, [g])),
    V(W, 0, D, wins(0, D, [g])),
    H(g, 0, W, backDoors.map(p => door(p, 4))),
    ...bs.map(x => V(x, g, D, [])),
  ];
  const back = bs.length === 2 ? [['bed', 'bed'], ['bath', 'bath'], ['study', 'bed']] : [['bed', 'bed'], ['bath', 'bath']];
  const rooms = [
    { rect: [1, a1, 1, g], t: ['living', 'bed'] },
    { rect: [a1, a2, 1, g], t: ['dining', 'study'] },
    { rect: [a2, W, 1, g], t: ['kitchen', 'bed'] },
    ...backL.slice(0, -1).map((l, i) => ({ rect: [l + 1, backL[i + 1], g + 1, D], t: back[i] })),
  ];
  rooms.fd = fd; rooms.runs = runs; rooms.great = [1, W, 1, g];
  return { runs, rooms };
}
const PLANS = { cross: crossPlan, centre: centrePlan, open: openPlan };

// -------------------------------------------------------------- furniture --
// An item draws itself in a footprint against a wall: u along the wall (0..w
// studs), v out from the wall (0..d), z up from the floor top; fb() maps that
// onto the stud rect and its facing.
const FABRIC = [[180, 70, 70], [70, 110, 170], [90, 140, 90], [200, 160, 70], [130, 90, 150], [90, 90, 96]];
const CAB = [[236, 232, 222], [120, 150, 170], [150, 110, 76], [96, 120, 96]];
const WORKTOP = [[60, 60, 66], [220, 216, 206], [150, 140, 128]];
const STEEL = { color: [196, 200, 206], material: 'BMC_Metallic' }, BLACK = { color: [30, 30, 34] };
const BOOKS = [[150, 40, 40], [40, 80, 140], [50, 110, 60], [160, 120, 40], [90, 50, 110], [180, 160, 130], [200, 90, 50], [60, 60, 70]];
// a 2 x 2 chair at (u0, v0), its back on side `back` (the side away from the table or desk)
function chair(fb, u0, v0, back, c) {
  for (const [du, dv] of [[0, 0], [1.6, 0], [0, 1.6], [1.6, 1.6]]) fb(u0 + du, v0 + dv, u0 + du + 0.4, v0 + dv + 0.4, 0, 16, { color: c });
  fb(u0, v0, u0 + 2, v0 + 2, 16, 20, { color: c });
  if (back === 'v0') fb(u0, v0, u0 + 2, v0 + 0.4, 20, 44, { color: c });
  if (back === 'v1') fb(u0, v0 + 1.6, u0 + 2, v0 + 2, 20, 44, { color: c });
}
// kitchen run (owner 2026-10-08: "counters need to be bigger"): base cabinets on
// a toe kick, door seams and handles, an overhanging worktop with a sink and a
// tap, and wall cabinets above
function counterRun(w) {
  return { w, d: 3, draw(fb, s) {
    const cab = { color: pick(CAB, s, 1) }, top = { color: pick(WORKTOP, s, 2) };
    fb(0, 0, w, 2.6, 0, 4, BLACK);                                  // toe kick
    fb(0, 0, w, 3, 4, 36, cab);                                     // base cabinets
    for (let k = 0; k < w / 2; k++) {
      if (k) fb(k * 2, 3, k * 2 + 0.2, 3.2, 6, 34, BLACK);           // door seams
      fb(k * 2 + 0.8, 3, k * 2 + 1.2, 3.2, 26, 30, STEEL);           // handles
    }
    fb(0, 0, w, 3.2, 36, 40, top);                                  // worktop
    const m = Math.floor(w / 4) * 2;
    fb(m - 1, 0.6, m + 1, 2.4, 40, 42, STEEL);                      // sink
    fb(m - 0.2, 0.2, m + 0.2, 0.6, 40, 52, STEEL); fb(m - 0.2, 0.6, m + 0.2, 1.2, 48, 52, STEEL); // tap
    fb(0, 0, w, 1.6, 80, 108, cab);                                 // wall cabinets
    for (let k = 1; k < w / 2; k++) fb(k * 2, 1.6, k * 2 + 0.2, 1.8, 82, 106, BLACK);
  } };
}
const ITEMS = {
  bed: { w: 6, d: 8, draw(fb, s) {
    const blanket = pick(FABRIC, s, 1);
    fb(0, 0, 6, 1, 0, 32, { color: WOOD });                     // headboard
    fb(0, 1, 6, 8, 0, 8, { color: WOOD });                      // frame
    fb(0, 1, 6, 8, 8, 16, { color: WHITE });                    // mattress
    fb(1, 1, 3, 2, 16, 20, { color: [250, 250, 250] }); fb(3, 1, 5, 2, 16, 20, { color: [250, 250, 250] }); // pillows
    fb(0, 3, 6, 8, 16, 18, { color: blanket });                 // blanket
  } },
  nightstand: { w: 2, d: 2, draw(fb) { fb(0, 0, 2, 2, 0, 20, { color: WOOD }); fb(0.6, 0.6, 1.4, 1.4, 20, 28, GLOW([255, 220, 170], 3)); } },
  wardrobe: { w: 4, d: 2, draw(fb) {
    fb(0, 0, 4, 2, 0, 80, { color: [150, 110, 76] });
    fb(1.8, 2, 2.2, 2.2, 4, 76, { color: [96, 66, 42] });       // the doors' seam
    fb(1.4, 2, 1.6, 2.2, 36, 48, STEEL); fb(2.4, 2, 2.6, 2.2, 36, 48, STEEL);
  } },
  sofa: { w: 8, d: 3, draw(fb, s) {
    const c = pick(FABRIC, s, 2);
    fb(0, 0, 8, 1, 0, 32, { color: c }); fb(0, 1, 1, 3, 0, 20, { color: c }); fb(7, 1, 8, 3, 0, 20, { color: c });
    fb(1, 1, 7, 3, 0, 12, { color: c.map(v => Math.round(v * 0.85)) });
  } },
  tv: { w: 6, d: 2, draw(fb) {
    fb(0, 0, 6, 2, 0, 16, { color: WOOD });
    fb(1, 0, 5, 1, 16, 40, { color: [20, 20, 24], material: 'BMC_Metallic' });
    fb(1.2, 1, 4.8, 1.2, 18, 38, GLOW([90, 140, 220], 2));
  } },
  // (owner 2026-10-08: "bookshelves look like garbage") a case with sides, a
  // back and four shelves, filled with single books of mixed widths and
  // heights in shelf-worn colours, with the odd gap
  bookshelf: { w: 4, d: 1, draw(fb, s) {
    const wood = { color: [110, 76, 48] };
    fb(0, 0, 0.2, 1, 0, 88, wood); fb(3.8, 0, 4, 1, 0, 88, wood);       // sides
    fb(0.2, 0, 3.8, 0.2, 0, 88, wood);                                  // back
    const boards = [0, 28, 56, 84];
    for (const z of boards) fb(0.2, 0.2, 3.8, 1, z, z + 4, wood);       // shelves, in front of the back
    for (let k = 0; k + 1 < boards.length; k++) {
      let u = 2;                                                        // units from the left side
      for (let j = 0; u < 38; j++) {
        const bw = [4, 4, 6, 6, 8][Math.floor(rnd(s, k, j, 1) * 5)], bh = [14, 16, 18, 20, 22][Math.floor(rnd(s, k, j, 2) * 5)];
        if (u + bw > 38) break;
        if (rnd(s, k, j, 3) < 0.12) { u += 4; continue; }               // a gap
        fb(u / 10, 0.2, (u + bw) / 10, 0.8, boards[k] + 4, boards[k] + 4 + bh, { color: pick(BOOKS, s, k, j) });
        u += bw;
      }
    }
  } },
  counter: counterRun(12),
  counterS: counterRun(8),
  stove: { w: 3, d: 3, draw(fb) {
    fb(0, 0, 3, 3, 0, 40, STEEL);
    fb(0, 0, 3, 3, 40, 42, BLACK);
    for (const [u, v] of [[0.4, 0.8], [1.8, 0.8], [0.4, 2], [1.8, 2]]) fb(u, v, u + 0.8, v + 0.8, 42, 44, { color: [70, 66, 64] });
    fb(0, 0, 3, 0.6, 42, 56, STEEL);                                     // backsplash
    fb(0.4, 3, 2.6, 3.2, 8, 30, BLACK);                                  // oven door glass
    fb(0.4, 3, 2.6, 3.4, 32, 34, { color: [140, 140, 146], material: 'BMC_Metallic' });
  } },
  // (owner 2026-10-08: "fridges look wack") two doors, a seam between them, flush handles, trim on top
  fridge: { w: 3, d: 3, draw(fb) {
    const body = { color: [222, 224, 228] }, seam = { color: [120, 122, 128] }, handle = { color: [80, 82, 88], material: 'BMC_Metallic' };
    fb(0, 0, 3, 3, 0, 52, body); fb(0, 0, 3, 3, 52, 56, seam); fb(0, 0, 3, 3, 56, 88, body); fb(0, 0, 3, 3, 88, 90, seam);
    fb(0.4, 3, 0.6, 3.2, 28, 48, handle); fb(0.4, 3, 0.6, 3.2, 58, 76, handle);
  } },
  // (owner 2026-10-08: "tables are very small", "chairs placed funky") a 6 x 4
  // table with four chairs on the long sides, backs away from it
  table: { w: 8, d: 8, center: true, draw(fb, s) {
    const c = pick([WOOD, [170, 130, 90], [236, 232, 222]], s, 3), ch = pick([WOOD, [96, 66, 42], [200, 190, 170]], s, 4);
    fb(1, 2, 7, 6, 28, 32, { color: c });
    for (const [u, v] of [[1.2, 2.2], [6.4, 2.2], [1.2, 5.4], [6.4, 5.4]]) fb(u, v, u + 0.4, v + 0.4, 0, 28, { color: c });
    for (const u of [1.6, 4.4]) { chair(fb, u, 0, 'v0', ch); chair(fb, u, 6, 'v1', ch); }
  } },
  tableS: { w: 6, d: 6, center: true, draw(fb, s) {
    const c = pick([WOOD, [170, 130, 90], [236, 232, 222]], s, 3), ch = pick([WOOD, [96, 66, 42], [200, 190, 170]], s, 4);
    fb(1, 2, 5, 4, 28, 32, { color: c });
    for (const [u, v] of [[1.2, 2.2], [4.4, 2.2], [1.2, 3.4], [4.4, 3.4]]) fb(u, v, u + 0.4, v + 0.4, 0, 28, { color: c });
    chair(fb, 2, 0, 'v0', ch); chair(fb, 2, 4, 'v1', ch);
  } },
  rugtable: { w: 8, d: 6, center: true, draw(fb, s) {
    fb(0, 0, 8, 6, 0, 2, { color: pick(FABRIC, s, 4) });
    fb(1.6, 2, 6.4, 4, 12, 16, { color: WOOD });
    for (const [u, v] of [[1.8, 2.2], [5.8, 2.2], [1.8, 3.4], [5.8, 3.4]]) fb(u, v, u + 0.4, v + 0.4, 2, 12, { color: WOOD });
  } },
  tub: { w: 6, d: 3, draw(fb) {
    fb(0, 0, 6, 3, 0, 8, { color: WHITE });
    fb(0, 0, 6, 0.4, 8, 20, { color: WHITE }); fb(0, 2.6, 6, 3, 8, 20, { color: WHITE });
    fb(0, 0.4, 0.4, 2.6, 8, 20, { color: WHITE }); fb(5.6, 0.4, 6, 2.6, 8, 20, { color: WHITE });
    fb(0.4, 0.4, 5.6, 2.6, 8, 16, { color: [110, 170, 220], material: 'BMC_Glass' });
  } },
  toilet: { w: 2, d: 3, draw(fb) { fb(0, 0, 2, 1, 0, 32, { color: WHITE }); fb(0.2, 1, 1.8, 3, 0, 16, { color: WHITE }); fb(0.2, 1, 1.8, 3, 16, 18, { color: [220, 220, 216] }); } },
  basin: { w: 2, d: 2, draw(fb) { fb(0.6, 0, 1.4, 1, 0, 28, { color: WHITE }); fb(0, 0, 2, 2, 28, 32, { color: WHITE }); fb(0.6, 0, 1.4, 0.4, 32, 40, STEEL); } },
  // a desk with its chair tucked in front of it, facing it
  desk: { w: 4, d: 5, draw(fb, s) {
    fb(0, 0, 4, 2, 28, 32, { color: WOOD }); fb(0, 0, 0.4, 2, 0, 28, { color: WOOD }); fb(3.6, 0, 4, 2, 0, 28, { color: WOOD });
    fb(1, 0.2, 3, 0.6, 32, 50, { color: [20, 20, 24] }); fb(1.2, 0.6, 2.8, 0.8, 34, 48, GLOW([120, 170, 230], 2));
    chair(fb, 1, 2.6, 'v1', pick([[40, 40, 44], [96, 66, 42]], s, 5));
  } },
  lamp: { w: 1, d: 1, draw(fb) { fb(0.4, 0.4, 0.6, 0.6, 0, 56, { color: DARK }); fb(0, 0, 1, 1, 56, 68, GLOW([255, 220, 170], 3)); } },
  console: { w: 4, d: 1, draw(fb, s) {
    fb(0, 0, 4, 1, 28, 32, { color: WOOD }); fb(0, 0, 0.4, 1, 0, 28, { color: WOOD }); fb(3.6, 0, 4, 1, 0, 28, { color: WOOD });
    fb(1.4, 0.2, 2, 0.8, 32, 44, { color: pick(FABRIC, s, 9) }); fb(2.6, 0.2, 3.4, 0.8, 32, 36, { color: [230, 210, 120], material: 'BMC_Metallic' });
  } },
  coatrack: { w: 1, d: 1, draw(fb) { fb(0.4, 0.4, 0.6, 0.6, 0, 64, { color: WOOD }); fb(0, 0.4, 0.4, 0.6, 56, 60, { color: WOOD }); fb(0.6, 0.4, 1, 0.6, 56, 60, { color: WOOD }); fb(0.4, 0, 0.6, 0.4, 48, 52, { color: WOOD }); fb(0.4, 0.6, 0.6, 1, 48, 52, { color: WOOD }); } },
  plant: { w: 2, d: 2, draw(fb) { fb(0.4, 0.4, 1.6, 1.6, 0, 12, { color: [170, 90, 60] }); fb(0.2, 0.2, 1.8, 1.8, 12, 24, { color: [70, 140, 70] }); fb(0.6, 0.6, 1.4, 1.4, 24, 32, { color: [84, 156, 80] }); } },
  // (owner 2026-10-08: "random breakfast bars") a counter with an overhanging
  // top and three bar stools under its far side
  breakfastbar: { w: 8, d: 5, center: true, draw(fb, s) {
    fb(0.2, 0.2, 7.8, 2.4, 0, 36, { color: pick(CAB, s, 11) });
    fb(0, 0, 8, 3.2, 36, 40, { color: pick(WORKTOP, s, 12) });
    for (const u of [0.8, 3.4, 6]) {
      fb(u + 0.4, 3.6, u + 0.8, 4, 0, 24, STEEL);                                         // post
      fb(u, 3.2, u + 1.2, 4.4, 24, 28, { color: pick([[40, 40, 44], [170, 40, 40], [120, 84, 52]], s, 13) }); // seat
    }
  } },
  // ---- the artist's
  easel: { w: 2, d: 2, draw(fb, s) {
    const wood = { color: [150, 110, 70] };
    fb(0.2, 0.8, 0.4, 1.2, 0, 64, wood); fb(1.6, 0.8, 1.8, 1.2, 0, 64, wood); fb(0.8, 1.6, 1.2, 2, 0, 56, wood);
    fb(0.4, 0.8, 1.6, 1, 24, 28, wood);                                                  // ledge
    fb(0.4, 1, 1.6, 1.2, 28, 56, { color: [240, 236, 226] });                            // canvas
    for (let k = 0; k < 3; k++) fb(0.6 + k * 0.4 - (k === 2 ? 0.2 : 0), 1.2, 0.8 + k * 0.4 - (k === 2 ? 0.2 : 0), 1.4, 32 + k * 8, 40 + k * 8, { color: pick([[220, 60, 60], [60, 120, 220], [240, 200, 60], [80, 170, 90], [170, 80, 200]], s, k) });
  } },
  canvasstack: { w: 3, d: 1, draw(fb, s) {
    for (let k = 0; k < 3; k++) fb(0.2 + k * 0.2, 0.2 + k * 0.2, 2.8 - k * 0.2, 0.4 + k * 0.2, 0, 44 - k * 8, { color: pick([[200, 70, 60], [70, 110, 190], [230, 190, 70], [90, 160, 110], [240, 236, 226]], s, k, 3) });
  } },
  painttable: { w: 4, d: 2, draw(fb, s) {
    fb(0, 0, 4, 2, 28, 32, { color: [150, 110, 70] }); fb(0, 0, 0.4, 2, 0, 28, { color: [150, 110, 70] }); fb(3.6, 0, 4, 2, 0, 28, { color: [150, 110, 70] });
    for (let k = 0; k < 5; k++) fb(0.4 + k * 0.6, 0.6, 0.8 + k * 0.6, 1, 32, 36, { color: pick([[220, 60, 60], [60, 120, 220], [240, 200, 60], [80, 170, 90], [170, 80, 200], [240, 240, 240]], s, k, 9) });
    fb(3.2, 0.4, 3.4, 1.6, 32, 36, { color: [150, 110, 70] });                            // a brush
  } },
  // ---- the baker's
  oven2: { w: 3, d: 3, draw(fb) {
    fb(0, 0, 3, 3, 0, 96, STEEL);
    fb(0.4, 3, 2.6, 3.2, 12, 40, BLACK); fb(0.4, 3, 2.6, 3.2, 52, 80, BLACK);
    fb(0.4, 3, 2.6, 3.4, 42, 44, STEEL); fb(0.4, 3, 2.6, 3.4, 82, 84, STEEL);
  } },
  island: { w: 6, d: 4, center: true, draw(fb, s) {
    fb(0.4, 0.4, 5.6, 3.6, 0, 36, { color: pick(CAB, s, 6) });
    fb(0, 0, 6, 4, 36, 40, { color: [176, 136, 92] });                                // butcher block
    fb(1, 1, 2, 2, 40, 44, { color: [236, 220, 190] }); fb(3.6, 2, 4.4, 2.8, 40, 44, { color: [230, 212, 178] }); // dough
    fb(2.4, 1.2, 4.4, 1.6, 40, 42, { color: [190, 150, 104] });                         // rolling pin
    fb(1, 2.4, 2.6, 3.4, 40, 42, { color: [246, 244, 238] });                           // flour on the block
  } },
  breadrack: { w: 4, d: 2, draw(fb, s) {
    fb(0, 0, 0.2, 2, 0, 76, STEEL); fb(3.8, 0, 4, 2, 0, 76, STEEL);
    // shelves 4 thick (thinner ones vanish when furniture heights are scaled, FZ)
    for (const [k, z] of [4, 26, 48, 72].entries()) {
      fb(0.2, 0, 3.8, 2, z, z + 4, STEEL);
      for (let j = 0; j < 3; j++) fb(0.4 + j * 1.2, 0.4, 1.4 + j * 1.2, 1.6, z + 4, z + 12, { color: pick([[196, 136, 70], [176, 112, 56], [214, 170, 104], [150, 96, 50]], s, k, j) });
    }
  } },
  flour: { w: 2, d: 2, draw(fb) {
    fb(0.2, 0.2, 1.8, 1.8, 0, 24, { color: [232, 224, 204] }); fb(0.6, 0.6, 1.4, 1.4, 24, 30, { color: [220, 210, 186] });
    fb(0.6, 1.8, 1.4, 2, 8, 16, { color: [180, 60, 50] });
  } },
  // ---- the musician's
  piano: { w: 6, d: 4, draw(fb) {
    const lacquer = { color: [24, 22, 24] };
    fb(0, 0, 6, 2, 0, 64, lacquer);                                                    // case
    fb(0, 2, 6, 3, 0, 24, lacquer);                                                    // key bed
    fb(0.2, 2, 5.8, 3, 24, 28, { color: [244, 242, 236] });                             // keys
    for (const u of [0.6, 1.2, 2.2, 2.8, 3.4, 4.4, 5]) fb(u, 2, u + 0.2, 2.6, 28, 32, lacquer);
    fb(1, 2, 5, 2.2, 40, 52, lacquer);                                                 // music desk
    fb(1.6, 3.2, 4.4, 4, 0, 18, lacquer);                                              // bench
  } },
  guitar: { w: 1, d: 1, draw(fb, s) {
    fb(0.2, 0.2, 0.8, 0.8, 0, 4, BLACK);
    fb(0.2, 0.2, 0.8, 0.8, 4, 22, { color: pick([[180, 40, 40], [30, 30, 34], [200, 150, 80], [40, 90, 160], [240, 240, 236]], s, 7) });
    fb(0.4, 0.4, 0.6, 0.6, 22, 48, { color: [120, 84, 52] }); fb(0.2, 0.4, 0.8, 0.6, 48, 54, { color: [60, 40, 28] });
  } },
  drums: { w: 5, d: 4, draw(fb, s) {
    const shell = { color: pick([[170, 30, 40], [30, 60, 140], [30, 30, 34], [200, 200, 200]], s, 8) }, brass = { color: [214, 180, 80], material: 'BMC_Metallic' };
    fb(1.6, 0.4, 3.4, 1.6, 0, 24, shell); fb(1.6, 0, 3.4, 0.4, 2, 22, { color: WHITE });  // bass drum and its head
    fb(1.6, 0.6, 2.4, 1.4, 24, 30, shell); fb(2.6, 0.6, 3.4, 1.4, 24, 30, shell);         // toms
    fb(0.2, 1.8, 1.2, 2.8, 0, 26, shell);                                              // floor tom
    fb(4, 2.2, 4.2, 2.4, 0, 28, STEEL); fb(3.6, 1.8, 4.6, 2.8, 28, 34, { color: WHITE }); // snare
    fb(0.6, 0.4, 0.8, 0.6, 0, 48, STEEL); fb(0.2, 0, 1.2, 1, 48, 50, brass);              // crash
    fb(4.4, 0.4, 4.6, 0.6, 0, 52, STEEL); fb(4, 0, 5, 1, 52, 56, brass);                  // ride
    fb(2, 3, 3, 4, 0, 16, BLACK);                                                      // stool
  } },
  amp: { w: 2, d: 2, draw(fb) {
    fb(0, 0, 2, 2, 0, 28, BLACK); fb(0.2, 2, 1.8, 2.2, 4, 20, { color: [64, 62, 60] });
    for (const u of [0.4, 0.8, 1.2]) fb(u, 2, u + 0.2, 2.2, 22, 24, STEEL);
  } },
  speaker: { w: 2, d: 2, draw(fb) {
    fb(0, 0, 2, 2, 0, 48, BLACK);
    fb(0.4, 2, 1.6, 2.2, 8, 20, { color: [90, 90, 96] }); fb(0.6, 2, 1.4, 2.2, 30, 38, { color: [90, 90, 96] });
  } },
  mixdesk: { w: 6, d: 5, draw(fb, s) {
    const dark = { color: [40, 40, 44] };
    fb(0, 0, 6, 2.6, 28, 32, dark); fb(0, 0, 0.4, 2.6, 0, 28, dark); fb(5.6, 0, 6, 2.6, 0, 28, dark);
    fb(1.4, 1, 4.6, 2.4, 32, 34, BLACK);                                               // the mixer
    for (let u = 1.6; u < 4.4; u += 0.6) for (let v = 1.2; v < 2.2; v += 0.6) fb(u, v, u + 0.2, v + 0.2, 34, 36, { color: pick([[220, 60, 60], [240, 200, 60], [80, 180, 230], [230, 230, 230]], s, u * 10, v * 10) });
    fb(0.2, 0.2, 1, 1, 32, 46, BLACK); fb(5, 0.2, 5.8, 1, 32, 46, BLACK);                // monitor speakers
    fb(2, 0.2, 4, 0.6, 36, 50, BLACK); fb(2.2, 0.6, 3.8, 0.8, 38, 48, GLOW([120, 200, 140], 2)); // screen
    fb(2.8, 0.2, 3.2, 0.6, 32, 36, BLACK);
    chair(fb, 2, 3, 'v1', [40, 40, 44]);
  } },
  // ---- the programmer's
  pcdesk: { w: 6, d: 5, draw(fb, s) {
    const dark = { color: [30, 30, 34] };
    fb(0, 0, 6, 2.4, 28, 32, dark); fb(0, 0, 0.4, 2.4, 0, 28, dark); fb(5.6, 0, 6, 2.4, 0, 28, dark);
    for (const u of [0.4, 2.2, 4]) {
      fb(u + 0.6, 0.2, u + 1, 0.6, 32, 34, BLACK);                                     // stand
      fb(u, 0.2, u + 1.6, 0.6, 34, 50, BLACK);                                         // monitor
      fb(u + 0.2, 0.6, u + 1.4, 0.8, 36, 48, GLOW(pick([[90, 160, 240], [120, 220, 150], [200, 120, 230]], s, u * 10), 2));
    }
    fb(2, 1.2, 4, 1.8, 32, 34, BLACK); fb(4.4, 1.2, 4.8, 1.8, 32, 34, BLACK);           // keyboard, mouse
    fb(0, 2.4, 6, 2.6, 26, 28, GLOW([230, 60, 200], 4));                                 // RGB strip
    fb(4.6, 0.4, 5.4, 1.8, 0, 24, BLACK); fb(4.6, 1.8, 5.4, 2, 4, 20, GLOW([60, 220, 230], 3)); // tower
    chair(fb, 2, 3, 'v1', [170, 30, 40]); fb(2, 4.6, 4, 5, 44, 56, BLACK);               // gaming chair, headrest
  } },
  serverrack: { w: 2, d: 2, draw(fb, s) {
    fb(0, 0, 2, 2, 0, 84, BLACK);
    for (let z = 8; z + 4 <= 80; z += 8) {
      fb(0.2, 2, 1.8, 2.2, z, z + 4, { color: [50, 50, 56] });
      for (const u of [0.4, 0.8, 1.2]) if (rnd(s, z, u * 10) < 0.7) fb(u, 2.2, u + 0.2, 2.4, z + 2, z + 4, GLOW(pick([[60, 230, 90], [80, 160, 255], [255, 170, 40]], s, z, u * 10), 4));
    }
  } },
  tvbig: { w: 8, d: 2, draw(fb) {
    fb(0, 0, 8, 2, 0, 16, { color: WOOD });
    fb(3.6, 0.4, 4.4, 0.6, 16, 20, BLACK);
    fb(0.6, 0.2, 7.4, 0.8, 20, 56, BLACK); fb(0.8, 0.8, 7.2, 1, 22, 54, GLOW([90, 140, 220], 2));
    fb(0.4, 1, 2, 1.8, 16, 20, { color: [20, 20, 24] }); fb(0.4, 1.8, 2, 2, 16, 18, GLOW([80, 230, 120], 3)); // games console
  } },
};
// per room type, in order; a list is alternatives, biggest first
const FURNISH = {
  living: ['sofa', 'tv', 'rugtable', 'bookshelf', 'lamp', 'plant'],
  kitchen: [['counter', 'counterS'], 'fridge', 'stove', ['table', 'tableS']],
  bed: ['bed', 'nightstand', 'wardrobe', 'lamp', 'plant'],
  bath: ['tub', 'toilet', 'basin'],
  dining: [['table', 'tableS'], 'bookshelf', 'plant', 'lamp'],
  study: ['desk', 'bookshelf', 'lamp', 'plant'],
  foyer: ['console', 'coatrack', 'plant'],
  hall: ['plant', 'console', 'plant', 'lamp'],
  bakerkitchen: [['counter', 'counterS'], 'oven2', 'fridge', 'breadrack', ['island', 'tableS']],
  bakery: ['breadrack', 'breadrack', 'flour', 'flour', 'flour', ['island', 'tableS']],
  musicliving: ['sofa', 'piano', 'rugtable', 'guitar', 'lamp', 'plant'],
  musicroom: ['drums', 'amp', 'speaker', 'speaker', 'guitar', 'guitar', 'guitar'],
  studio: ['mixdesk', 'speaker', 'speaker', 'guitar', 'bookshelf'],
  gamerliving: ['sofa', 'tvbig', 'rugtable', 'bookshelf', 'plant'],
  battlestation: ['pcdesk', 'serverrack', 'bookshelf', 'lamp', 'plant'],
  serverroom: ['serverrack', 'serverrack', 'serverrack', 'serverrack', 'desk'],
  artstudio: ['easel', 'easel', 'canvasstack', 'painttable', 'lamp', 'plant'],
  artliving: ['sofa', 'tv', 'rugtable', 'easel', 'canvasstack', 'plant'],
};
// (owner 2026-10-08: "consider what these people do for a living and factor
// that in to their house") a job per household: which rooms it takes over,
// ground floor (g) and upstairs (u), and what it puts in the back yard
const JOBS = {
  baker: { g: { kitchen: 'bakerkitchen', study: 'bakery' }, u: {}, yard: 'breadoven' },
  musician: { g: { living: 'musicliving', dining: 'musicroom' }, u: { study: 'studio' }, yard: 'stage' },
  programmer: { g: { living: 'gamerliving', study: 'battlestation' }, u: { study: 'serverroom' }, yard: 'dish' },
  artist: { g: { living: 'artliving', study: 'artstudio' }, u: { study: 'artstudio' }, yard: 'sculpture' },
};

// --------------------------------------------------------------- windows --
// (owner 2026-10-08: "unique windows") each house its own: width (studs), sill
// and opening heights (wallgen courses), glazing bars (columns x rows), frame
// colour, and outside either shutters, a flower box or a stone ledge
const WINDOW_STYLES = [
  { name: 'colonial', w: 4, sill: 4, open: 6, bars: [2, 3], frame: WHITE, outside: 'shutters', shutter: [46, 92, 70] },
  { name: 'picture', w: 6, sill: 3, open: 7, bars: [3, 1], frame: [56, 56, 60], outside: 'flowers' },
  { name: 'tall', w: 4, sill: 2, open: 9, bars: [2, 4], frame: [236, 232, 220], outside: 'ledge' },
  { name: 'cottage', w: 2, sill: 4, open: 5, bars: [1, 2], frame: [110, 78, 50], outside: 'shutters', shutter: [130, 50, 46] },
];
// a glazed opening, local world units: along `axis` from a0 to a1, through the
// wall from t0 to t1, z0..z1; frame and bars 2 wide, panes between
// (owner 2026-10-08: "windows need to be thinner") a 2-thick pane in the middle
// of the wall, frame and bars 4 deep round it; a narrow window gets fewer bars
function panes(axis, a0, a1, t0, t1, z0, z1, st, label = 'window') {
  const A = a1 - a0, Hh = z1 - z0;
  const cols = Math.max(1, Math.min(st.bars[0], Math.floor(A / 20))), rows = Math.max(1, Math.min(st.bars[1], Math.floor(Hh / 24)));
  const tm = (t0 + t1) / 2;
  // bar k spans [m, m + 2], m even, so every pane edge stays on whole units
  const bars = (L, n) => [...Array(Math.max(0, n - 1))].map((_, i) => Math.round(((L * (i + 1)) / n - 1) / 2) * 2);
  const cutsOf = (L, n) => [...new Set([0, 2, L - 2, L, ...bars(L, n).flatMap(m => [m, m + 2])])].sort((p, q) => p - q);
  const isBar = (L, n, lo) => lo < 2 || lo >= L - 2 || bars(L, n).includes(lo);
  const cu = cutsOf(A, cols), cv = cutsOf(Hh, rows);
  for (let i = 0; i + 1 < cu.length; i++) for (let j = 0; j + 1 < cv.length; j++) {
    const u0 = cu[i], u1 = cu[i + 1], v0 = cv[j], v1 = cv[j + 1];
    const bar = isBar(A, cols, u0) || isBar(Hh, rows, v0), b = bar ? { color: st.frame } : { ...GLASS };
    const p0 = tm - (bar ? 2 : 1), p1 = tm + (bar ? 2 : 1);
    if (axis === 'x') box(a0 + u0, p0, z0 + v0, a0 + u1, p1, z0 + v1, b, label);
    else box(p0, a0 + u0, z0 + v0, p1, a0 + u1, z0 + v1, b, label);
  }
}
// the outside dressing of a window: n = outward sign across the wall, face = its outer face
function dressing(axis, a0, a1, face, n, z0, z1, st, s) {
  const out = (p, q) => (n < 0 ? [face - q, face - p] : [face + p, face + q]); // p..q units out from the face
  const bx = (u0, u1, p, q, za, zb, b, label) => { const [t0, t1] = out(p, q); if (axis === 'x') box(u0, t0, za, u1, t1, zb, b, label); else box(t0, u0, za, t1, u1, zb, b, label); };
  if (st.outside === 'ledge') bx(a0 - 4, a1 + 4, 0, 4, z0 - 4, z0, { color: [176, 170, 160] }, 'ledge');
  if (st.outside === 'shutters') {
    const sw = Math.min(20, (a1 - a0) / 2);
    bx(a0 - sw, a0, 0, 2, z0, z1, { color: st.shutter }, 'shutter'); bx(a1, a1 + sw, 0, 2, z0, z1, { color: st.shutter }, 'shutter');
    bx(a0 - sw, a1 + sw, 0, 4, z0 - 4, z0, { color: st.frame }, 'ledge');
  }
  if (st.outside === 'flowers') {
    bx(a0, a1, 0, 12, z0 - 12, z0, { color: WOOD }, 'flower box');
    for (let u = a0 + 10, k = 0; u + 10 <= a1; u += 20, k++) {
      const [t0, t1] = out(1, 11), rose = rnd(s, u, 50) < 0.5;
      B.add({ asset: rose ? 'B_Rose' : 'B_Tulip', size: [0, 0, 0], color: pick([[220, 50, 60], [240, 200, 50], [160, 90, 200], [240, 130, 170]], s, k, u), position: axis === 'x' ? [u, (t0 + t1) / 2, z0 + (rose ? 4 : 6)] : [(t0 + t1) / 2, u, z0 + (rose ? 4 : 6)] }, 'window flower');
    }
  }
}

// ------------------------------------------------------------------ roof --
// town.mjs gable(): courses of a micro-brick lip with a micro wedge on top,
// ridge along x, gable ends filled with running-bond bricks of `fill`
function gable(x0, y0, x1, y1, zBase, rise, color, fill, winStyle = null) {
  const ox0 = x0 - 10, oy0 = y0 - 10, ox1 = x1 + 10, oy1 = y1 + 10;
  const S = (oy1 - oy0) / 2, LIP = 4;
  const { widths, per } = townCourses(S, rise, LIP), n = widths.length;
  const lipC = color.map(v => Math.round(v * 0.82));
  for (const sgn of [-1, 1]) {
    let e = 0;
    widths.forEach((w, k) => {
      const z = zBase + k * per, ya = sgn < 0 ? oy0 + e : oy1 - e - w, yb = ya + w;
      box(ox0, ya, z, ox1, yb, z + LIP, { color: lipC }, 'roof lip');
      const ext = [(ox1 - ox0) / 2, w / 2, (per - LIP) / 2];
      B.add({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[0, -sgn]], ext), color, position: [(ox0 + ox1) / 2, (ya + yb) / 2, z + LIP + (per - LIP) / 2] }, 'roof wedge');
      e += w;
    });
  }
  const F = [1, 0.94, 1.04, 0.97, 1.02];
  let nb = 0;
  // the rows of each gable end; an attic window takes the middle of the rows
  // from one course up to 40 units higher, where the rows are wide enough
  const rowsAll = [];
  for (let k = 0, e = 0; k + 1 < n; k++) {
    e += widths[k];
    const z = zBase + k * per;
    for (let zz = z, row = k * 3; zz < z + per; zz += 12, row++) rowsAll.push({ zz, z1: Math.min(z + per, zz + 12), row, a0: oy0 + e, a1: oy1 - e });
  }
  const mid = oy0 + Math.round((oy1 - oy0) / 20) * 10, HOLE = [mid - 20, mid + 20]; // on the rows' own grid (oy0 + 10k)
  const holeRows = winStyle ? rowsAll.filter(r => r.zz >= zBase + per && r.z1 <= zBase + per + 40 && r.a0 < HOLE[0] - 30 && r.a1 > HOLE[1] + 30) : [];
  for (const { zz, z1, row, a0, a1 } of rowsAll) {
    const holed = holeRows.some(r => r.zz === zz);
    for (const gx of [x0 + 5, x1 - 15]) {
      for (const [s0, s1] of holed ? [[a0, HOLE[0]], [HOLE[1], a1]] : [[a0, a1]]) {
        let a = s0, j = 0;
        const off = row % 2 ? 30 : 0;
        while (a < s1) {
          let L = j === 0 && off ? off : 40 + ((row * 7 + j * 3) % 3) * 10;
          if (s1 - (a + L) < 20) L = s1 - a;
          const f = F[(nb++ * 7 + row) % F.length]; // one shade per brick (per channel tinted it)
          box(gx, a, zz, gx + 10, Math.min(s1, a + L), z1, { color: fill.map(v => Math.min(255, Math.round(v * f))) }, 'gable end');
          a += L; j++;
        }
      }
    }
  }
  if (holeRows.length) {
    const hz0 = Math.min(...holeRows.map(r => r.zz)), hz1 = Math.max(...holeRows.map(r => r.z1));
    for (const gx of [x0 + 5, x1 - 15]) panes('y', HOLE[0], HOLE[1], gx, gx + 10, hz0, hz1, { ...winStyle, bars: [2, 2] }, 'attic window');
  }
}

// ----------------------------------------------------------------- stairs --
// (owner 2026-10-08: "stairs going into bathrooms with no doors", "stair
// bottoms and tops need free space") one straight flight in the hallway,
// against one of its long walls: 3 studs wide, 13 one-stud steps of a brick
// (ground floor top 4 to upper floor top 160), 3 studs clear before and after
// along the hall. No step may sit in front of a doorway on that wall (the
// doorway, a stud either side, 3 studs in); the landings may.
const FLIGHT = 13, LANDING = 3, FLIGHT_W = 3;
function placeStair(rooms) {
  const doorCells = new Set();
  for (const r of rooms.runs) for (const o of r.openings) {
    if (o.type !== 'door') continue;
    for (let a = o.pos0 - 1; a < o.pos1 + 1; a++) for (let t = r.line - 3; t < r.line + 4; t++) doorCells.add(r.orient === 'H' ? `${a},${t}` : `${t},${a}`);
  }
  const area = ({ rect: [x0, x1, y0, y1] }) => (x1 - x0) * (y1 - y0);
  const hall = rooms.filter(r => r.t[0] === 'hall').sort((p, q) => area(q) - area(p))[0];
  const rect = hall ? hall.rect : rooms.great;
  const [x0, x1, y0, y1] = rect;
  // a hall: along its length; a great room: along either axis, the longer first
  const axes = hall ? [y1 - y0 >= x1 - x0] : (y1 - y0 >= x1 - x0 ? [true, false] : [false, true]);
  for (const alongY of axes) {
    const [a0, a1] = alongY ? [y0, y1] : [x0, x1], [c0, c1] = alongY ? [x0, x1] : [y0, y1];
    const mid = (a0 + a1 - FLIGHT) / 2;
    const starts = [...Array(a1 - a0)].map((_, i) => a0 + i).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
    for (const st of starts) for (const side of hall ? [0, 1] : [1, 0]) {
      if (st - LANDING < a0 || st + FLIGHT + LANDING > a1) continue;
      const across = side ? [c1 - FLIGHT_W, c1] : [c0, c0 + FLIGHT_W];
      let ok = true;
      for (let a = st; a < st + FLIGHT && ok; a++) for (let c = across[0]; c < across[1]; c++) if (doorCells.has(alongY ? `${c},${a}` : `${a},${c}`)) { ok = false; break; }
      if (ok) return { alongY, across, start: st, open: side ? across[0] : across[1], openSide: side ? -1 : 1 };
    }
  }
  throw new Error(`simhouse: no room for the stairs in ${rect}`);
}

// (owner 2026-10-08: "shed roof houses") one slope, low at the front, high at
// the back: courses of a lip with a wedge rising toward +y, the side walls
// filled up under the slope and the back wall built up to meet it
function shed(x0, y0, x1, y1, zBase, rise, color, fill) {
  const ox0 = x0 - 10, oy0 = y0 - 10, ox1 = x1 + 10, oy1 = y1 + 10;
  const S = oy1 - oy0, LIP = 4;
  const { widths, per } = townCourses(S, rise, LIP), n = widths.length;
  const lipC = color.map(v => Math.round(v * 0.82));
  let e = 0;
  widths.forEach((w, k) => {
    const z = zBase + k * per, ya = oy0 + e, yb = ya + w;
    box(ox0, ya, z, ox1, yb, z + LIP, { color: lipC }, 'roof lip');
    const ext = [(ox1 - ox0) / 2, w / 2, (per - LIP) / 2];
    B.add({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[0, 1]], ext), color, position: [(ox0 + ox1) / 2, (ya + yb) / 2, z + LIP + (per - LIP) / 2] }, 'roof wedge');
    e += w;
  });
  const F = [1, 0.94, 1.04, 0.97, 1.02];
  let nb = 0;
  const shadeOf = row => { const f = F[(nb++ * 7 + row) % F.length]; return { color: fill.map(v => Math.min(255, Math.round(v * f))) }; }; // one shade per brick (per channel tinted it)
  const run = (a0, a1, row, put1) => { // running-bond bricks from a0 to a1
    let a = a0, j = 0;
    const off = row % 2 ? 30 : 0;
    while (a < a1) {
      let L = j === 0 && off ? off : 40 + ((row * 7 + j * 3) % 3) * 10;
      if (a1 - (a + L) < 20) L = a1 - a;
      put1(a, Math.min(a1, a + L), shadeOf(row));
      a += L; j++;
    }
  };
  for (let k = 0, e2 = 0; k + 1 < n; k++) {
    e2 += widths[k];
    const z = zBase + k * per;
    for (let zz = z, row = k * 3; zz < z + per; zz += 12, row++) {
      const z1 = Math.min(z + per, zz + 12);
      for (const gx of [x0 + 5, x1 - 15]) run(oy0 + e2 + 5, y1 - 5, row, (a, b, m) => box(gx, a, zz, gx + 10, b, z1, m, 'shed side')); // + 5: the course edges sit on the 5s, the back wall on the 10s
      run(x0 + 15, x1 - 15, row + 1, (a, b, m) => box(a, y1 - 15, zz, b, y1 - 5, z1, m, 'shed back'));
    }
  }
}

// ------------------------------------------------------------------ house --
const SIDING = [[214, 226, 236], [236, 222, 190], [200, 222, 200], [240, 214, 214], [232, 230, 222], [250, 238, 206]];
const ROOFS = [[70, 70, 76], [104, 64, 50], [72, 88, 110], [140, 60, 46], [96, 84, 70]];
const LAWN_Z = 4, HB = 16; // lawn top, house base (on a 12-high foundation)

function house(Lx, HY, { plan, W, D, storeys, s, win: wi, job, bar }) {
  seed = s;
  const ws = WINDOW_STYLES[wi];
  WW = ws.w;
  const h = buildFromPlan(r => PLANS[plan](W, D, r), { W, D, storeys, seed: s, label: 'simhouse', stairs: false, config: { WINDOW_SILL_COURSES: ws.sill, WINDOW_OPEN_COURSES: ws.open, DOOR_OPEN_COURSES: 6 } /* doors 6 bricks tall (owner 2026-10-08) */ });
  const { rooms } = h;
  const sp = storeys > 1 ? placeStair(rooms) : null;
  // stud cells of the flight (and of the stairwell above it)
  const flight = new Set();
  if (sp) for (let a = sp.start; a < sp.start + FLIGHT; a++) for (let c = sp.across[0]; c < sp.across[1]; c++) flight.add(sp.alongY ? `${c},${a}` : `${a},${c}`);
  const wallC = pick(SIDING, s, 10), roofC = pick(ROOFS, s, 11), trim = WHITE;
  const w = (W + 1) * 10, d = (D + 1) * 10, X0 = Lx - Math.floor(w / 20) * 10; // on the stud grid
  const sb = (x0, y0, x1, y1, z0, z1, b, label) => box(X0 + x0 * 10, HY + y0 * 10, HB + z0, X0 + x1 * 10, HY + y1 * 10, HB + z1, b, label);
  // foundation
  box(X0, HY, LAWN_Z, X0 + w, HY + d, HB, { asset: 'PB_DefaultBrick', color: [150, 146, 140] }, 'foundation');
  // walls, glass, stairs; floors per room style; ceilings under upper floors
  const STOREY = 156;
  const F = [1, 0.95, 1.04, 0.98, 1.02];
  const wallTop = new Set();
  for (const b of h.boxes) if (b.kind === 'wall') for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) wallTop.add(`${x},${y},${b.z1}`);
  for (const b of h.boxes) {
    if (b.kind === 'wall') {
      // a white band (trim) on the first course and the top course of each storey
      const course = b.course % 13, isTrim = course === 0 || course === 12;
      sb(b.x0, b.y0, b.x1, b.y1, b.z0, b.z1, { asset: 'PB_DefaultBrick', color: isTrim ? trim : wallC.map(v => Math.min(255, Math.round(v * F[(b.x0 * 7 + b.y0 * 3 + b.course) % 5]))) }, 'wall');
    } else if (b.kind === 'glass') {
      // the house's window style: framed panes, and outside, its dressing
      const alongX = b.y1 - b.y0 === 1, z0 = HB + b.z0, z1 = HB + b.z1;
      if (alongX) {
        const a0 = X0 + b.x0 * 10, a1 = X0 + b.x1 * 10;
        panes('x', a0, a1, HY + b.y0 * 10, HY + b.y1 * 10, z0, z1, ws);
        if (b.y0 === 0) dressing('x', a0, a1, HY, -1, z0, z1, ws, s);
        else if (b.y0 === D) dressing('x', a0, a1, HY + (D + 1) * 10, 1, z0, z1, ws, s);
      } else {
        const a0 = HY + b.y0 * 10, a1 = HY + b.y1 * 10;
        panes('y', a0, a1, X0 + b.x0 * 10, X0 + b.x1 * 10, z0, z1, ws);
        if (b.x0 === 0) dressing('y', a0, a1, X0, -1, z0, z1, ws, s);
        else if (b.x0 === W) dressing('y', a0, a1, X0 + (W + 1) * 10, 1, z0, z1, ws, s);
      }
    }
  }
  const typeOf = (room, st) => { const t = room.t[storeys === 1 ? 0 : st]; return JOBS[job]?.[st === 0 ? 'g' : 'u']?.[t] ?? t; };
  const roomAt = (st, x, y) => {
    const hit = rooms.find(({ rect: [x0, x1, y0, y1] }) => x >= x0 && x < x1 && y >= y0 && y < y1);
    return hit ? typeOf(hit, st) : 'hall';
  };
  const FLOOR_STYLE = { living: 'townPlanks', bed: 'planks', study: 'planks', dining: 'townPlanks', hall: 'townPlanks', foyer: 'hallChecker', kitchen: 'checker', bath: { pattern: 'checker', sq: 1, asset: TILE, colors: [[236, 240, 244], [150, 190, 220]] } };
  for (const b of h.boxes.filter(b => b.kind === 'floor' || b.kind === 'ceiling')) {
    const st = Math.round(b.z0 / STOREY);
    const groups = new Map();
    for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) {
      if (b.z0 > 0 && flight.has(`${x},${y}`)) continue; // the stairwell
      const t = b.kind === 'ceiling' ? 'ceil' : roomAt(Math.min(st, storeys - 1), x, y);
      (groups.get(t) ?? groups.set(t, new Set()).get(t)).add(`${x},${y}`);
    }
    for (const [t, cells] of groups) {
      const style = t === 'ceil' ? 'checkerCeiling' : FLOOR_STYLE[t] ?? ({ bakerkitchen: 'checker', bakery: 'terracotta', serverroom: 'hallChecker' }[t] ?? 'planks');
      for (const p of floorPieces(cells, style, { salt: s })) sb(p.x0, p.y0, p.x1, p.y1, b.z0, b.z1, p.brick, 'floor');
    }
    if (b.kind === 'floor' && b.z0 > 0) {
      const open = new Set();
      for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) if (!wallTop.has(`${x},${y},${b.z0}`) && !flight.has(`${x},${y}`)) open.add(`${x},${y}`);
      for (const p of floorPieces(open, 'checkerCeiling')) sb(p.x0, p.y0, p.x1, p.y1, b.z0 - 4, b.z0, p.brick, 'ceiling');
    }
  }
  // keep-out cells for furniture: the stairs and 2 studs round them (doorways: furnish())
  const keep = new Set();
  const mark = (x0, x1, y0, y1) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) keep.add(`${x},${y}`); };
  const stair = [];
  if (sp) {
    const { alongY, across, start, open, openSide } = sp;
    // map (along, across) stud coords to a stud rect
    const R = (a0, a1, q0, q1) => (alongY ? [q0, q1, a0, a1] : [a0, a1, q0, q1]);
    const tread = { asset: TILE, color: [150, 104, 64] };
    for (let k = 0; k < FLIGHT; k++) { const [rx0, rx1, ry0, ry1] = R(start + k, start + k + 1, across[0], across[1]); sb(rx0, ry0, rx1, ry1, 4 + 12 * k, 16 + 12 * k, tread, 'step'); }
    // upstairs: a railing along the open side of the stairwell and across its foot
    const rail = { color: [96, 66, 42] }, Z = 160;
    const q = openSide > 0 ? [open, open + 0.4] : [open - 0.4, open];
    for (const a of [start, start + 4, start + 8, start + 12.6]) { const [rx0, rx1, ry0, ry1] = R(a, a + 0.4, q[0], q[1]); sb(rx0, ry0, rx1, ry1, Z, Z + 32, rail, 'baluster'); }
    { const [rx0, rx1, ry0, ry1] = R(start, start + FLIGHT, q[0], q[1]); sb(rx0, ry0, rx1, ry1, Z + 32, Z + 36, rail, 'handrail'); }
    const qa = [Math.min(across[0], q[0]), Math.max(across[1], q[1])];
    { const [rx0, rx1, ry0, ry1] = R(start - 0.4, start, qa[0], qa[1]); sb(rx0, ry0, rx1, ry1, Z, Z + 36, rail, 'end rail'); }
    // keep the flight, its landings and the railing clear of furniture
    const [kx0, kx1, ky0, ky1] = R(start - LANDING - 1, start + FLIGHT + LANDING, Math.min(across[0], q[0]) - 1, Math.max(across[1], q[1]) + 1);
    mark(Math.floor(kx0), Math.ceil(kx1), Math.floor(ky0), Math.ceil(ky1));
    const [fx0, fx1, fy0, fy1] = R(start, start + FLIGHT, across[0], across[1]);
    stair.push({ x0: fx0, x1: fx1, y0: fy0, y1: fy1 });
  }
  return { h, rooms, typeOf, bar, keep, sb, X0, w, d, wallC, roofC, stair, ws };
}

// furniture heights at the player's scale (owner 2026-10-08, "player height vs
// oven height": items were drawn for the 156-unit storey): every z an item draws
// is scaled by 0.75 onto even units (same input, same output, so stacked pieces
// still meet without overlapping)
const FZ = z => 2 * Math.round((z * 0.75) / 2);
// furnish one room: wall items first (each wall, each slot), then centre items
function furnish(ctx, st, rect, type, s, doorCells) {
  const { sb, X0 } = ctx;
  const [x0, x1, y0, y1] = rect;
  const zf = st * 156 + 4; // floor top above the house base
  const used = new Set([...ctx.keep, ...doorCells]);
  const free = (a0, a1, b0, b1) => { if (a0 < x0 || a1 > x1 || b0 < y0 || b1 > y1) return false; for (let x = a0; x < a1; x++) for (let y = b0; y < b1; y++) if (used.has(`${x},${y}`)) return false; return true; };
  const take = (a0, a1, b0, b1) => { for (let x = a0 - 1; x < a1 + 1; x++) for (let y = b0 - 1; y < b1 + 1; y++) used.add(`${x},${y}`); };
  let placed = 0;
  const list = FURNISH[type].map(e => (ctx.bar && /kitchen/.test(type) && [e].flat().some(n => /table|island/.test(n)) ? ['breakfastbar', ...[e].flat()] : e));
  for (const [n, entry] of list.entries()) for (const name of [entry].flat()) {
    const it = ITEMS[name], before = placed;
    const tries = [];
    if (it.center) {
      const cx = Math.floor((x0 + x1 - it.w) / 2), cy = Math.floor((y0 + y1 - it.d) / 2);
      for (let k = 0; k < 9; k++) tries.push(['+y', cx + ((k % 3) - 1) * 2, cy + (Math.floor(k / 3) - 1) * 2]);
    }
    // against each wall, sliding along it; the facing is away from that wall
    const walls = ['back', 'left', 'right', 'front'];
    const start = Math.floor(rnd(s, n, 20) * 4);
    for (let k = 0; k < 4; k++) {
      const wname = walls[(start + k) % 4];
      const along = wname === 'back' || wname === 'front' ? x1 - x0 : y1 - y0;
      for (let t = 0; t < along; t++) tries.push([wname, t]);
    }
    for (const tr of tries) {
      let rect2, fb;
      const { w: iw, d: id } = it;
      if (tr[0] === '+y') { // centre: u along x, v along y
        const [, a, b] = tr; rect2 = [a, a + iw, b, b + id];
        fb = (u0, v0, u1, v1, z0, z1, br) => sb(a + u0, b + v0, a + u1, b + v1, zf + FZ(z0), zf + FZ(z1), br, name);
      } else if (tr[0] === 'back') { const a = x0 + tr[1]; rect2 = [a, a + iw, y1 - id, y1]; fb = (u0, v0, u1, v1, z0, z1, br) => sb(a + iw - u1, y1 - v1, a + iw - u0, y1 - v0, zf + FZ(z0), zf + FZ(z1), br, name); }
      else if (tr[0] === 'front') { const a = x0 + tr[1]; rect2 = [a, a + iw, y0, y0 + id]; fb = (u0, v0, u1, v1, z0, z1, br) => sb(a + u0, y0 + v0, a + u1, y0 + v1, zf + FZ(z0), zf + FZ(z1), br, name); }
      else if (tr[0] === 'left') { const b = y0 + tr[1]; rect2 = [x0, x0 + id, b, b + iw]; fb = (u0, v0, u1, v1, z0, z1, br) => sb(x0 + v0, b + iw - u1, x0 + v1, b + iw - u0, zf + FZ(z0), zf + FZ(z1), br, name); }
      else { const b = y0 + tr[1]; rect2 = [x1 - id, x1, b, b + iw]; fb = (u0, v0, u1, v1, z0, z1, br) => sb(x1 - v1, b + u0, x1 - v0, b + u1, zf + FZ(z0), zf + FZ(z1), br, name); }
      if (!free(...rect2)) continue;
      const at = (u, v, z, a, color) => { // a fixed-size asset centred at footprint (u, v)
        const [px, py] = tr[0] === 'left' ? [x0 + v, rect2[2] + iw - u] : tr[0] === 'right' ? [x1 - v, rect2[2] + u] : tr[0] === 'back' ? [rect2[0] + iw - u, y1 - v] : [rect2[0] + u, rect2[2] + v];
        B.add({ asset: a, size: [0, 0, 0], color, position: [X0 + px * 10, ctx.HY + py * 10, HB + zf + z] }, a);
      };
      it.draw(fb, s * 31 + n, at);
      take(...rect2);
      placed++;
      break;
    }
    if (placed > before) break; // the first alternative that fits
  }
  // a ceiling light in the middle of the room, under the ceiling, unless it's a stairwell
  const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);
  if (!ctx.stair.some(t => mx + 1 > t.x0 - 1 && mx - 1 < t.x1 + 1 && my + 1 > t.y0 - 1 && my - 1 < t.y1 + 1)) sb(mx - 1, my - 1, mx + 1, my + 1, (st + 1) * 156 - 6, (st + 1) * 156 - 4, GLOW([255, 236, 200], 4), 'ceiling light');
  return placed;
}

// ------------------------------------------------------------------ yard --
function tree(x, y, s) {
  pole(x, y, LAWN_Z, LAWN_Z + 72, 10, { asset: 'PB_DefaultPole', color: [92, 64, 40] }, 'trunk');
  let z = LAWN_Z + 72;
  const green = pick([[58, 120, 48], [70, 136, 56], [52, 108, 60]], s, 1);
  for (const [r, t] of [[40, 1], [55, 2], [50, 2], [30, 1]]) { pole(x, y, z, z + t * 12, r, { color: green }, 'canopy'); z += t * 12; }
}
function picketRun(ax, ay, bx, by, gaps = []) {
  // pickets every 20 along the run with two rails between their segments
  const alongX = ay === by, a0 = alongX ? ax : ay, a1 = alongX ? bx : by, c = alongX ? ay : ax;
  const inGap = p => gaps.some(([g0, g1]) => p > g0 && p < g1);
  let runStart = null;
  const flush = end => {
    if (runStart === null) return;
    for (const [z0, z1] of [[16, 20], [28, 32]]) alongX ? box(runStart, c, LAWN_Z + z0, end, c + 4, LAWN_Z + z1, { color: WHITE }, 'rail') : box(c, runStart, LAWN_Z + z0, c + 4, end, LAWN_Z + z1, { color: WHITE }, 'rail');
    runStart = null;
  };
  for (let p = a0; p < a1; p += 20) {
    if (inGap(p + 2)) { flush(p); continue; }
    if (runStart === null) runStart = p;
    for (const [z0, z1] of [[0, 16], [20, 28], [32, 40]]) alongX ? box(p, c, LAWN_Z + z0, p + 4, c + 4, LAWN_Z + z1, { color: WHITE }, 'picket') : box(c, p, LAWN_Z + z0, c + 4, p + 4, LAWN_Z + z1, { color: WHITE }, 'picket');
  }
  flush(a1);
}

// ------------------------------------------------------------ yard trades --
// the job's thing in the back yard, centred (x, y) on the lawn, facing the house (-y)
const YARD = {
  breadoven(x, y) { // a brick bread oven with a fire in its mouth, a chimney and a log pile
    const brick = { asset: 'PB_DefaultBrick', color: [160, 84, 60] }, Z = LAWN_Z;
    box(x - 30, y - 30, Z, x + 30, y + 30, Z + 24, { asset: 'PB_DefaultBrick', color: [150, 146, 140] });
    box(x - 30, y - 30, Z + 24, x + 30, y + 30, Z + 48, brick);
    box(x - 20, y - 20, Z + 48, x + 20, y + 20, Z + 60, brick);
    box(x - 10, y - 10, Z + 60, x + 10, y + 10, Z + 68, brick);
    box(x - 12, y - 34, Z + 26, x + 12, y - 30, Z + 44, { color: [30, 26, 24] });            // the mouth
    box(x - 8, y - 36, Z + 26, x + 8, y - 34, Z + 34, GLOW([255, 130, 40], 6));              // fire
    pole(x, y, Z + 68, Z + 104, 5, { color: [120, 70, 50] });
    for (const [k, dz] of [[0, 0], [1, 0], [2, 8]]) box(x + 40, y - 20 + k * 12 - (dz ? 6 : 0), Z + dz, x + 80, y - 10 + k * 12 - (dz ? 6 : 0), Z + dz + 8, { color: [110, 76, 48] });
  },
  stage(x, y) { // a little wooden stage: two speakers, a mic stand
    const Z = LAWN_Z;
    box(x - 60, y - 40, Z, x + 60, y + 40, Z + 12, { asset: 'PB_DefaultBrick', color: [130, 92, 58] });
    for (const sx of [-1, 1]) { box(x + sx * 45 - 10, y + 10, Z + 12, x + sx * 45 + 10, y + 30, Z + 60, { color: [24, 24, 28] }); box(x + sx * 45 - 6, y + 8, Z + 24, x + sx * 45 + 6, y + 10, Z + 36, { color: [90, 90, 96] }); }
    box(x - 1, y - 21, Z + 12, x + 1, y - 19, Z + 56, { color: [190, 190, 196], material: 'BMC_Metallic' });
    box(x - 2, y - 22, Z + 56, x + 2, y - 18, Z + 62, { color: [30, 30, 34] });
  },
  sculpture(x, y) { // an abstract stack of coloured blocks on a stone plinth
    const Z = LAWN_Z;
    box(x - 20, y - 20, Z, x + 20, y + 20, Z + 24, { asset: 'PB_DefaultBrick', color: [190, 186, 178] });
    const C = [[220, 60, 60], [60, 120, 220], [240, 200, 60], [80, 170, 90]];
    let z = Z + 24;
    for (const [k, [hx, hy, h, dx]] of [[10, 16, 24, -6], [14, 6, 16, 4], [6, 12, 28, -2], [12, 8, 12, 6]].entries()) { box(x + dx - hx, y - hy, z, x + dx + hx, y + hy, z + h, { color: C[k] }); z += h; }
  },
  dish(x, y) { // a satellite dish on a post, looking up
    const grey = { color: [210, 212, 216] }, Z = LAWN_Z;
    pole(x, y, Z, Z + 60, 5, { color: [120, 120, 126], material: 'BMC_Metallic' });
    box(x - 10, y - 10, Z + 60, x + 10, y + 10, Z + 64, grey);
    box(x - 20, y - 20, Z + 64, x + 20, y + 20, Z + 68, grey);
    box(x - 30, y - 30, Z + 68, x + 30, y + 30, Z + 72, grey);
    box(x - 2, y - 2, Z + 72, x + 2, y + 2, Z + 90, { color: [120, 120, 126], material: 'BMC_Metallic' });
    box(x - 4, y - 4, Z + 90, x + 4, y + 4, Z + 96, { color: [40, 40, 44] });
  },
};

// ----------------------------------------------------------------- street --
// (owner 2026-10-08: shed roofs, open plans, random breakfast bars, "make sure
// all this"): three shed roofs, two open plans; a breakfast bar in every
// open-plan kitchen and, by chance, in the others
const LOT_W = 780, LOTS = [
  { plan: 'open', W: 48, D: 40, storeys: 1, s: 111, win: 3, job: 'baker', roof: 'shed' },
  { plan: 'centre', W: 44, D: 44, storeys: 2, s: 222, win: 2, job: 'musician', roof: 'gable' },
  { plan: 'open', W: 52, D: 40, storeys: 2, s: 333, win: 1, job: 'programmer', roof: 'shed' },
  { plan: 'cross', W: 48, D: 40, storeys: 1, s: 444, win: 0, job: 'artist', roof: 'shed' },
].map(l => { seed = l.s; return { ...l, bar: l.plan === 'open' || rnd(l.s, 77) < 0.5 }; });
const ROAD = [100, 280], WALK = [280, 340], LOT_Y = [340, 1100], HOUSE_Y = 500;
const XS = LOTS.map((_, i) => (i - (LOTS.length - 1) / 2) * (LOT_W + 20));
const PAD = [XS[0] - LOT_W / 2 - 80, ROAD[0] - 60, XS[XS.length - 1] + LOT_W / 2 + 80, LOT_Y[1] + 80];
// the island pad: sand down to the sea floor, in 280 x 280 blocks
{
  const depth = BASE - GROUND;
  for (let x = PAD[0]; x < PAD[2]; x += 280) for (let y = PAD[1]; y < PAD[3]; y += 280) {
    const x1 = Math.min(PAD[2], x + 280), y1 = Math.min(PAD[3], y + 280);
    if (depth > 12) box(x, y, -depth, x1, y1, -12, { asset: 'PB_DefaultBrick', color: [190, 172, 128] }, 'pad');
    box(x, y, -12, x1, y1, 0, { asset: 'PB_DefaultBrick', color: [214, 196, 142] }, 'sand');
  }
}
// road, centre dashes, pavement with a curb
box(PAD[0], ROAD[0], 0, PAD[2], ROAD[1], 4, { color: [58, 58, 62] }, 'road');
for (let x = PAD[0] + 40; x + 60 < PAD[2]; x += 120) box(x, (ROAD[0] + ROAD[1]) / 2 - 4, 4, x + 60, (ROAD[0] + ROAD[1]) / 2 + 4, 6, { color: [236, 200, 60] }, 'dash');
box(PAD[0], WALK[0], 0, PAD[2], WALK[1], 8, { asset: TILE, color: [196, 194, 188] }, 'pavement');
let furnished = 0;
const summary = [];
for (const [i, lot] of LOTS.entries()) {
  const Lx = XS[i], L0 = Lx - LOT_W / 2, L1 = Lx + LOT_W / 2;
  seed = lot.s;
  const ctx = house(Lx, HOUSE_Y, lot);
  ctx.HY = HOUSE_Y;
  const { rooms, typeOf, X0, w, d } = ctx;
  const doorX = X0 + rooms.fd * 10;
  // lawn (around the foundation), path, porch, step
  const lawn = { asset: 'PB_DefaultBrick', color: pick([[96, 160, 70], [88, 150, 64], [104, 168, 76]], lot.s, 30) };
  const pathX = [doorX - 30, doorX + 30];
  box(L0, LOT_Y[0], 0, pathX[0], LOT_Y[1], LAWN_Z, lawn, 'lawn');
  box(pathX[1], LOT_Y[0], 0, L1, LOT_Y[1], LAWN_Z, lawn, 'lawn');
  box(pathX[0], HOUSE_Y + d, 0, pathX[1], LOT_Y[1], LAWN_Z, lawn, 'lawn');
  box(pathX[0], LOT_Y[0], 0, pathX[1], HOUSE_Y, LAWN_Z, { asset: TILE, color: [176, 170, 160] }, 'path');
  box(pathX[0] - 10, HOUSE_Y - 100, LAWN_Z, pathX[1] + 10, HOUSE_Y - 60, 12, { color: [160, 156, 150] }, 'step');
  box(pathX[0] - 10, HOUSE_Y - 60, LAWN_Z, pathX[1] + 10, HOUSE_Y, HB + 4, { color: [160, 156, 150] }, 'porch');
  // flower beds along the front, both sides of the porch
  for (const [a, b] of [[X0, pathX[0] - 20], [pathX[1] + 20, X0 + w]]) {
    if (b - a < 40) continue;
    box(a, HOUSE_Y - 30, LAWN_Z, b, HOUSE_Y, LAWN_Z + 4, { color: [96, 70, 48] }, 'bed');
    for (let x = a + 10, k = 0; x + 10 <= b; x += 20, k++) {
      const rose = rnd(lot.s, k, 40) < 0.5;
      asset(rose ? 'B_Rose' : 'B_Tulip', x, HOUSE_Y - 15, LAWN_Z + 4 + (rose ? 4 : 6), { color: pick([[220, 50, 60], [240, 200, 50], [160, 90, 200], [245, 140, 50], [240, 130, 170]], lot.s, k) });
    }
  }
  // fence round the lot, a gap for the path; mailbox by the gate; two front-yard trees
  picketRun(L0, LOT_Y[0] + 10, L1, LOT_Y[0] + 10, [[pathX[0] - 10, pathX[1] + 10]]);
  picketRun(L0, LOT_Y[0] + 30, L0, LOT_Y[1]);
  picketRun(L1 - 4, LOT_Y[0] + 30, L1 - 4, LOT_Y[1]);
  picketRun(L0 + 20, LOT_Y[1] - 4, L1 - 20, LOT_Y[1] - 4);
  box(pathX[1] + 30, LOT_Y[0] + 30, LAWN_Z, pathX[1] + 34, LOT_Y[0] + 34, LAWN_Z + 40, { color: WOOD }, 'mailbox post');
  box(pathX[1] + 24, LOT_Y[0] + 24, LAWN_Z + 40, pathX[1] + 40, LOT_Y[0] + 44, LAWN_Z + 52, { color: pick([[60, 90, 160], [170, 50, 50], [60, 120, 70]], lot.s, 31) }, 'mailbox');
  box(pathX[1] + 40, LOT_Y[0] + 36, LAWN_Z + 44, pathX[1] + 42, LOT_Y[0] + 38, LAWN_Z + 60, { color: [220, 40, 40] }, 'flag');
  for (const sg of [-1, 1]) { const tx = Lx + sg * 310; if (Math.abs(tx - doorX) > 100) tree(tx, LOT_Y[0] + 80, lot.s + sg); }
  // the household's trade in the back yard, off the path
  YARD[JOBS[lot.job].yard](Math.round((Lx + (doorX > Lx ? -1 : 1) * 200) / 10) * 10, LOT_Y[1] - 90);
  // furnish every room on every storey
  for (let st = 0; st < lot.storeys; st++) {
    // door cells of this plan, inflated: no furniture in a doorway or in front of it
    const doorCells = new Set();
    // a doorway is a wall cell with no wall brick in its 2nd course: find them from the wall top map
    const wallCells = new Set(ctx.h.boxes.filter(b => b.kind === 'wall' && b.course === st * 13 + 1).flatMap(b => { const c = []; for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) c.push(`${x},${y}`); return c; }));
    const upper = new Set(ctx.h.boxes.filter(b => b.kind === 'wall' && b.course === st * 13 + 10).flatMap(b => { const c = []; for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) c.push(`${x},${y}`); return c; }));
    for (const k of upper) if (!wallCells.has(k)) { const [x, y] = k.split(',').map(Number); for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) doorCells.add(`${x + dx},${y + dy}`); }
    for (const room of rooms) furnished += furnish(ctx, st, room.rect, typeOf(room, st), lot.s * 10 + st * 100 + room.rect[0] * 7 + room.rect[2], doorCells);
  }
  if (lot.roof === 'shed') shed(X0 - 5, HOUSE_Y - 5, X0 + w + 5, HOUSE_Y + d + 5, HB + ctx.h.top, Math.round(d * 0.26 / 4) * 4, ctx.roofC, ctx.wallC);
  else gable(X0 - 5, HOUSE_Y - 5, X0 + w + 5, HOUSE_Y + d + 5, HB + ctx.h.top, Math.round(d * 0.32 / 4) * 4, ctx.roofC, ctx.wallC, ctx.ws);
  summary.push(`${lot.job}: ${lot.roof} roof, ${lot.bar ? 'breakfast bar, ' : ''}${lot.plan} plan ${lot.W}x${lot.D} ${lot.storeys}-storey, ${ctx.ws.name} windows, ${ctx.stair.length ? 'stairs' : 'no stairs'}, rooms ${[...Array(lot.storeys)].map((_, st) => rooms.map(r => typeOf(r, st)).join('/')).join(' | ')}`);
}
if (process.env.SIM_DEBUG) { const c = {}; for (const b of B.bricks) c[b.label] = (c[b.label] ?? 0) + 1; console.error(JSON.stringify(c)); }
if (B.dropped.length) console.error(`${B.dropped.length} pieces dropped for overlapping, e.g.\n${B.dropped.slice(0, 6).join('\n')}`);

// ------------------------------------------------------------------ world --
const r = (((Math.round(YAW / 90) - 1) % 4) + 4) % 4; // local +y -> the facing
const OX = Math.round(PX / 10) * 10, OY = Math.round(PY / 10) * 10;
const bricks = B.bricks.map(({ label, ...b }) => {
  const t = turnBrick(b, r);
  return { ...t, position: [t.position[0] + OX, t.position[1] + OY, t.position[2] + BASE] };
});
const bad = bricks.filter(b => [...b.position, ...b.size].some(v => !Number.isFinite(v) || Math.abs(v - Math.round(v)) > 1e-6));
if (bad.length) throw new Error(`${bad.length} bricks off the integer grid, e.g. ${JSON.stringify(bad[0])}`);
for (const b of bricks) { b.position = b.position.map(Math.round); b.size = b.size.map(Math.round); }
console.error(`${bricks.length} bricks, ${furnished} furniture pieces, turn ${r}\n${summary.join('\n')}`);
process.stdout.write(JSON.stringify({ ops: [
  { op: 'say', msg: '<b>Building a little street of houses...</>' },
  { op: 'bricks', at: [0, 0, 0], captureMs: 4000, bricks }, // world coordinates, like the map chunks (absolute mode has no prefab metadata)
] }));
