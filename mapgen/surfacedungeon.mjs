// Surface dungeons (owner 2026-10-10: "add dungeons on the top of the dungeon
// entrances procedurally generated using walltool as an engine"): over each
// buried temple's entrance stairwell stands a walled keep of rooms and
// corridors, laid out like wallgen's Diablo levels (tools/wallgen/
// 06_generate_dungeon.js: rooms on a tile grid, an MST of L-shaped corridors
// plus a few loops) and built by the same wallgen engine the houses use
// (wallhouse.mjs buildFromPlan: running-bond walls, both validation gates).
//
// The map exposes the dungeon's paved roof round the stairwell (mapgen cuts
// the hill away there), so the keep stands on that paving: no floor plates of
// its own, the stairwell open in its first room (the "forced" room, grown a
// tile all round so the checkpoint beside the hole fits). A corridor runs from
// that room straight out to the gate on the side the trench leaves by.
// Ceilings are micro bricks under a flat tile roof with merlons along the
// edge; lintels over doorways are micro bricks (no studded undersides); a
// glowing lamp hangs in each room; rooms other than the stairwell's get
// spawners (mapgen stamps them like the dungeon's own).
//
// planSurfaceDungeon({ seed, hole, side, bounds, grid, rooms, theme })
//   hole    [x0, y0, x1, y1] stairwell, studs in the dungeon's local frame
//   side    [dx, dy] the way out (the trench's direction)
//   bounds  [x0, y0, x1, y1] studs the keep should stay inside (local frame);
//           it overhangs them where the stairwell room would not fit
//   grid    tiles per side (TILE studs each); rooms: how many to try for
// -> { bricks (local units, z 0 = the paving top), extent [x0, y0, x1, y1]
//      studs, gate [x, y] studs (centre of the outer doorway), spawns
//      [[x, y, z]] local units, rooms, top (wall top, units) }
import { buildFromPlan, COURSES } from './wallhouse.mjs';
import { canvas, masked, wrapNull, roundTower, stone, VX, VZ } from './castle.mjs';
import { greatHall, hallShell, portico, orientWedge, HALL_UP } from './greathall.mjs';

export const TILE = 8; // studs per tile: a 4-stud doorway leaves 2-stud piers
const SOLID = -1, CORRIDOR = -2;
const MB = 'PB_DefaultMicroBrick', TILE_B = 'PB_DefaultTile';

function makeRng(seed) { // mulberry32, as in 06_generate_dungeon.js
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return next;
}
const edgeKey = (ax, ay, bx, by) => (ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`);

// rooms + corridors on a G x G tile grid; `forced` (tile rect) is room 0
function layout(rng, G, nRooms, forced, side, hallSize) {
  const grid = Array.from({ length: G }, () => new Array(G).fill(SOLID));
  const rooms = [];
  const clear = r => rooms.every(o => r.x + r.w + 1 <= o.x || o.x + o.w + 1 <= r.x || r.y + r.h + 1 <= o.y || o.y + o.h + 1 <= r.y);
  const add = r => { r.id = rooms.length; rooms.push(r); for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = r.id; };
  add(forced);
  // the great hall (owner 2026-10-25: "make the rooms bigger", Forest Temple main hall):
  // one big square room placed first, then the rest at 3-4 tiles (were 2-3)
  let hall = -1;
  for (let hs = hallSize; hs >= 4 && hall < 0; hs--)
    for (let t = 0; t < 200; t++) {
      const r = { x: rng.int(0, G - hs), y: rng.int(0, G - hs), w: hs, h: hs };
      if (clear(r)) { add(r); hall = r.id; break; }
    }
  for (let tries = 0; rooms.length < nRooms && tries < 400; tries++) {
    const w = rng.int(3, 4), h = rng.int(3, 4);
    const r = { x: rng.int(0, G - w), y: rng.int(0, G - h), w, h };
    if (clear(r)) add(r);
  }
  const centre = r => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
  const dist = (a, b) => { const [ax, ay] = centre(a), [bx, by] = centre(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  const edges = [], inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best = null;
    for (const a of inTree) for (const b of rooms) {
      if (inTree.has(b.id)) continue;
      const d = dist(rooms[a], b);
      if (!best || d < best.d) best = { a, b: b.id, d };
    }
    edges.push([best.a, best.b]); inTree.add(best.b);
  }
  for (let i = 0; i < Math.round(rooms.length * 0.25) && rooms.length > 2; i++) {
    const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
    if (a !== b) edges.push([a, b]);
  }
  const steps = [];
  const carve = path => {
    for (const [px, py] of path) if (grid[py][px] === SOLID) grid[py][px] = CORRIDOR;
    for (let i = 1; i < path.length; i++) steps.push([path[i - 1], path[i]]);
  };
  for (const [a, b] of edges) {
    let [x, y] = centre(rooms[a]);
    const [tx, ty] = centre(rooms[b]), path = [[x, y]];
    const walk = ax => { if (ax === 'x') while (x !== tx) { x += Math.sign(tx - x); path.push([x, y]); } else while (y !== ty) { y += Math.sign(ty - y); path.push([x, y]); } };
    const xFirst = rng() < 0.5;
    walk(xFirst ? 'x' : 'y'); walk(xFirst ? 'y' : 'x');
    carve(path);
  }
  // the way in: from the stairwell room's centre straight out to the grid edge
  let [x, y] = centre(rooms[0]);
  const out = [[x, y]];
  while (x + side[0] >= 0 && x + side[0] < G && y + side[1] >= 0 && y + side[1] < G) { x += side[0]; y += side[1]; out.push([x, y]); }
  carve(out);
  const doors = new Set();
  for (const [[ax, ay], [bx, by]] of steps) if (grid[ay][ax] !== grid[by][bx]) doors.add(edgeKey(ax, ay, bx, by));
  doors.add(edgeKey(x, y, x + side[0], y + side[1])); // the gate, in the outer wall
  return { grid, rooms, doors, gateTile: [x, y], hall };
}

// tile grid -> wallgen runs (06's toRuns, margin 0; doorways 4 studs, even)
function toRuns({ grid, doors }, G) {
  const at = (x, y) => (x < 0 || y < 0 || x >= G || y >= G ? SOLID : grid[y][x]);
  const runs = [];
  const sweep = (orient, sides) => {
    for (let l = 0; l <= G; l++) {
      let run = null;
      for (let p = 0; p <= G; p++) {
        const [a, b] = p < G ? sides(l, p) : [null, null];
        const wall = a !== null && a.r !== b.r && (a.r !== SOLID || b.r !== SOLID);
        if (wall) {
          if (!run) run = { orient, line: l * TILE, start: p * TILE, end: 0, openings: [] };
          run.end = (p + 1) * TILE;
          if (doors.has(edgeKey(a.x, a.y, b.x, b.y))) run.openings.push({ pos0: p * TILE + 2, pos1: (p + 1) * TILE - 2, type: 'door' });
        } else if (run) { runs.push(run); run = null; }
      }
    }
  };
  sweep('H', (l, p) => [{ x: p, y: l - 1, r: at(p, l - 1) }, { x: p, y: l, r: at(p, l) }]);
  sweep('V', (l, p) => [{ x: l - 1, y: p, r: at(l - 1, p) }, { x: l, y: p, r: at(l, p) }]);
  return runs;
}

export function planSurfaceDungeon({ seed, hole, side, bounds, grid: G = 11, rooms: nRooms = 7, theme, hall: hallSize = 6 }) {
  const rng = makeRng(seed);
  const span = G * TILE + 1;
  const even = v => 2 * Math.round(v / 2);
  let last = '';
  for (let attempt = 0; attempt < 60; attempt++) {
    // the keep's origin: the stairwell near the middle, nudged, inside bounds
    const hx = (hole[0] + hole[2]) / 2, hy = (hole[1] + hole[3]) / 2;
    // (bounds are a preference: the stairwell room must fit, so the keep may overhang them)
    const fit = (want, lo, hi, h0, h1) => Math.max(h1 - TILE * (G - 1), Math.min(h0 - TILE - 1, Math.max(lo, Math.min(hi - span, want))));
    const ox = even(fit(hx - span / 2 + (rng() - 0.5) * 2 * TILE, bounds[0], bounds[2], hole[0], hole[2]) - 1) ;
    const oy = even(fit(hy - span / 2 + (rng() - 0.5) * 2 * TILE, bounds[1], bounds[3], hole[1], hole[3]) - 1);
    // the stairwell room: the tiles whose interior holds the hole, plus a tile all round
    const fx0 = Math.floor((hole[0] - ox - 1) / TILE) - 1, fy0 = Math.floor((hole[1] - oy - 1) / TILE) - 1;
    const fx1 = Math.ceil((hole[2] - ox) / TILE) + 1, fy1 = Math.ceil((hole[3] - oy) / TILE) + 1;
    if (fx0 < 0 || fy0 < 0 || fx1 > G || fy1 > G) { last = 'stairwell room off the grid'; continue; }
    const L = layout(rng, G, nRooms, { x: fx0, y: fy0, w: fx1 - fx0, h: fy1 - fy0 }, side, hallSize);
    const raw = toRuns(L, G);
    // buildFromPlan normalises runs to start at stud 0: remember the shift
    let minX = Infinity, minY = Infinity;
    for (const r of raw) {
      if (r.orient === 'H') { minX = Math.min(minX, r.start); minY = Math.min(minY, r.line); }
      else { minX = Math.min(minX, r.line); minY = Math.min(minY, r.start); }
    }
    let h;
    try {
      h = buildFromPlan(() => ({ runs: raw, rooms: {} }), {
        W: G * TILE, D: G * TILE, storeys: 1, seed, label: 'surface dungeon',
        config: { ROOF_OVERHANG: 0, ROOF_STEP: 0 },
        model: { glass: false, floor: false, ceiling: true, roof: true },
      });
    } catch (e) { last = e.message; continue; }
    return finish({ h, L, ox: ox + minX, oy: oy + minY, gx: ox, gy: oy, side, theme, seed, rng });
  }
  throw new Error(`surface dungeon: no layout fits (${last})`);
}

function finish({ h, L, ox, oy, gx, gy, side, theme: T, rng, seed }) {
  const bricks = [];
  const U = 10;
  const top = COURSES * 12;
  // stud box (keep frame, after buildFromPlan's shift) -> local-unit brick
  // (rounded: greathall.mjs puts 0.2-stud parts; brick.wedge = { D, down } orients a micro wedge)
  const SIDE_ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 }; // vertical side wedge: rotation by the side it is solid toward
  const put = (x0, y0, x1, y1, z0, z1, { wedge, side, ...b }) => {
    const size = [Math.round(((x1 - x0) * U) / 2), Math.round(((y1 - y0) * U) / 2), Math.round((z1 - z0) / 2)];
    bricks.push({
      ...b, position: [Math.round((ox + (x0 + x1) / 2) * U), Math.round((oy + (y0 + y1) / 2) * U), Math.round((z0 + z1) / 2)],
      size, ...(wedge ? orientWedge(wedge.D, wedge.down, size) : {}), ...(side ? { direction: 4, rotation: SIDE_ROT[side.join()] } : {}),
    });
  };
  const wallAt = new Set();
  for (const b of h.boxes) if (b.kind === 'wall') for (let x = b.x0; x < b.x1; x++) for (let y = b.y0; y < b.y1; y++) wallAt.add(`${x},${y},${b.course}`);
  const F = [1, 0.92, 1.06, 0.96, 1.03];
  const shade = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * F[k % F.length]))));
  const roofCells = new Set();
  // the great hall (greathall.mjs): interior HI, its wall ring HR (keep-frame studs); the
  // keep's ceiling and roof leave HR to the hall's own, HALL_UP higher
  const hr = L.hall >= 0 ? L.rooms[L.hall] : null, shx = gx - ox, shy = gy - oy;
  const HI = hr && [shx + hr.x * TILE + 1, shy + hr.y * TILE + 1, shx + (hr.x + hr.w) * TILE, shy + (hr.y + hr.h) * TILE];
  const HR = HI && [HI[0] - 1, HI[1] - 1, HI[2] + 1, HI[3] + 1];
  const clipHall = b => {
    if (!HR || b.x1 <= HR[0] || b.x0 >= HR[2] || b.y1 <= HR[1] || b.y0 >= HR[3]) return [b];
    return [{ ...b, x1: HR[0] }, { ...b, x0: HR[2] }, { ...b, x0: Math.max(b.x0, HR[0]), x1: Math.min(b.x1, HR[2]), y1: HR[1] }, { ...b, x0: Math.max(b.x0, HR[0]), x1: Math.min(b.x1, HR[2]), y0: HR[3] }]
      .filter(p => p.x1 > p.x0 && p.y1 > p.y0);
  };
  const nearHall = (x, y, m) => HR && x >= HR[0] - m && x < HR[2] + m && y >= HR[1] - m && y < HR[3] + m;
  for (const b of h.boxes) {
    if (b.kind === 'wall') {
      // over an opening (a doorway's lintel): micro brick, no studs underneath
      let over = false;
      if (b.course > 0) for (let x = b.x0; x < b.x1 && !over; x++) for (let y = b.y0; y < b.y1; y++) if (!wallAt.has(`${x},${y},${b.course - 1}`)) { over = true; break; }
      const k = Math.floor(rng() * 5);
      const c = b.course === 0 ? T.base : b.course === COURSES - 1 ? T.trim : shade(T.field[k % T.field.length], k);
      put(b.x0, b.y0, b.x1, b.y1, b.z0, b.z1, over ? { asset: MB, color: c } : { color: c });
    } else if (b.kind === 'ceiling') for (const p of clipHall(b)) put(p.x0, p.y0, p.x1, p.y1, p.z0, p.z1, { asset: MB, color: T.trim });
    else if (b.kind === 'roof') for (const p of clipHall(b)) {
      put(p.x0, p.y0, p.x1, p.y1, p.z0, p.z1, { asset: TILE_B, color: T.dado }); // darker than the paving round it
      for (let x = p.x0; x < p.x1; x++) for (let y = p.y0; y < p.y1; y++) roofCells.add(x + ',' + y);
    }
  }
  // merlons along the roof's edge, every other 2 studs
  const roofTop = top + 4;
  // corner towers (2026-10-15, owner: "the castles look like shit"): round
  // towers (castle.mjs) on the convex corners of the big masses (a 6x6 block of
  // roof behind the corner, so not on corridor stubs), well apart and clear of
  // the gate; centred on the corner, so three quarters stand outside; below the
  // roof they never enter the keep's footprint, above it they sit on the roof
  const towerAt = [], foot = new Set(roofCells), trng = makeRng((seed ?? 1) * 31 + 7); // own rng: the keep's spawns stay put
  for (const k of wallAt) { const [x, y, c] = k.split(','); if (c === '0') foot.add(x + ',' + y); }
  {
    const [tx, ty] = L.gateTile, gwx = gx + (tx + 0.5 + side[0] * 0.5) * TILE - ox, gwy = gy + (ty + 0.5 + side[1] * 0.5) * TILE - oy;
    const R = (x, y) => foot.has(x + ',' + y);
    const cand = [];
    for (const k of foot) {
      const [x, y] = k.split(',').map(Number);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (R(x + sx, y) || R(x, y + sy) || R(x + sx, y + sy)) continue;
        let big = true;
        for (let a = 0; a < 6 && big; a++) for (let b = 0; b < 6; b++) if (!R(x - sx * a, y - sy * b)) { big = false; break; }
        if (!big) continue;
        const vx = x + (sx > 0 ? 1 : 0), vy = y + (sy > 0 ? 1 : 0);
        if (Math.hypot(vx - gwx, vy - gwy) < 14 || nearHall(vx, vy, 8)) continue;
        cand.push([vx, vy, trng()]);
      }
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [vx, vy] of cand) if (towerAt.length < 6 && towerAt.every(([px, py]) => Math.hypot(px - vx, py - vy) >= 22)) towerAt.push([vx, vy]);
  }
  if (towerAt.length) {
    const kRoof = Math.ceil(roofTop / VZ), oxs = Math.round(ox), oys = Math.round(oy);
    const c = masked(wrapNull(canvas()), (i, j, k) => k < kRoof && foot.has((i - oxs) + ',' + (j - oys)));
    towerAt.forEach(([vx, vy], n) => {
      const kTop = Math.ceil((top + 60) / VZ) + (n % 2) * 4;
      roundTower(c, vx + oxs, vy + oys, 4, kTop, trng() < 0.4 ? 'cone' : 'crenel', 7000 + n, [], { slits: true, base: T.field[0] });
    });
    for (const b of c.bricks()) bricks.push({ ...b, position: [b.position[0], b.position[1], b.position[2]] });
  }
  const inTower = (x, y) => towerAt.some(([vx, vy]) => Math.hypot(x + 0.5 - vx, y + 0.5 - vy) <= 5.6);
  for (const k of roofCells) {
    const [x, y] = k.split(',').map(Number);
    if (inTower(x, y) || nearHall(x, y, 1)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => roofCells.has(`${x + a},${y + b}`))) continue;
    if (((x >> 1) + (y >> 1)) % 2) continue;
    put(x, y, x + 1, y + 1, roofTop, roofTop + 12, { color: T.mould });
  }
  // the hall: its walls on up (coursed, alternate corners), ceiling, roof, merlons, then the inside
  const pots = [];
  let hallInfo = null;
  if (HR) {
    const [gtx, gty] = L.gateTile;
    const shell = hallShell({ put, HI, HR, top, roofTop, T, rng, shade, roofCells, foot,
      gate: [gx + (gtx + 0.5 + side[0] * 0.5) * TILE - ox, gy + (gty + 0.5 + side[1] * 0.5) * TILE - oy] });
    const doors = [];
    const inHall = (x, y) => x >= hr.x && x < hr.x + hr.w && y >= hr.y && y < hr.y + hr.h;
    for (const key of L.doors) {
      const [[ax, ay], [bx, by]] = key.split('|').map(t => t.split(',').map(Number));
      if (inHall(ax, ay) === inHall(bx, by)) continue;
      const [ix, iy, ex, ey] = inHall(ax, ay) ? [ax, ay, bx, by] : [bx, by, ax, ay];
      if (ey !== iy) doors.push({ side: ey < iy ? 'S' : 'N', a0: shx + ix * TILE + 2, a1: shx + ix * TILE + 6 });
      else doors.push({ side: ex < ix ? 'W' : 'E', a0: shy + iy * TILE + 2, a1: shy + iy * TILE + 6 });
    }
    hallInfo = greatHall({ put, I: HI, doors, T, rng: makeRng((seed ?? 1) * 53 + 11), shade, shell });
    for (const [x, y, z] of hallInfo.pots) pots.push([(ox + x) * U, (oy + y) * U, z]);
  }
  // the gate's portico
  {
    const [tx, ty] = L.gateTile;
    const gwx = gx + (tx + 0.5 + side[0] * 0.5) * TILE - ox, gwy = gy + (ty + 0.5 + side[1] * 0.5) * TILE - oy;
    const face = side[0] ? gwx + (side[0] > 0 ? 1 : 0) : gwy + (side[1] > 0 ? 1 : 0);
    portico({ put, face, a: side[0] ? gwy : gwx, side, T });
  }
  // lamps under the ceiling and spawners in the rooms (not the stairwell's, not the hall's)
  const spawns = [];
  L.rooms.forEach((r, i) => {
    const cx = gx + (r.x + r.w / 2) * TILE, cy = gy + (r.y + r.h / 2) * TILE; // stud centre, grid frame
    if (i === L.hall && HR) { rng(); return; } // the hall: its lantern lights it, no spawner (rng() keeps the draws)
    const lz = top - 6;
    bricks.push({ asset: MB, size: [6, 6, 2], position: [cx * U, cy * U, lz], color: T.glow, material: 'BMC_Glow', material_intensity: 5 });
    if (i > 0 && rng() < 0.75 && i !== L.hall) spawns.push([cx * U, cy * U, 2]);
  });
  const [tx, ty] = L.gateTile;
  const gate = [gx + (tx + 0.5 + side[0] * 0.5) * TILE, gy + (ty + 0.5 + side[1] * 0.5) * TILE];
  const G = L.grid.length;
  return { bricks, extent: [gx, gy, gx + G * TILE + 1, gy + G * TILE + 1], gate, spawns, pots, hall: hallInfo, rooms: L.rooms.length, top: HR ? top + HALL_UP + 70 : roofTop + 12 };
}
