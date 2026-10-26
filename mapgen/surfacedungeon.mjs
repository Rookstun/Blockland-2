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
import { greatHall, hallShell, portal, orientWedge, bondPut, HALL_UP, GOLD } from './greathall.mjs';
import { floors, furnish, KINDS } from './keeprooms.mjs';
import { makeBuilder, FIXED } from './builder.mjs';
import { worldBox } from './orient.mjs';
const SMOOTH = 'PB_DefaultSmoothTile', WEDGE = 'PB_DefaultMicroWedge';

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

export function planSurfaceDungeon({ seed, hole, side, bounds, grid: G = 11, rooms: nRooms = 7, theme, hall: hallSize = 7, checkpoint }) {
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
    return finish({ h, L, ox: ox + minX, oy: oy + minY, gx: ox, gy: oy, side, theme, seed, rng, hole, checkpoint });
  }
  throw new Error(`surface dungeon: no layout fits (${last})`);
}

function finish({ h, L, ox, oy, gx, gy, side, theme: T, rng, seed, hole, checkpoint }) {
  const bricks = [];
  const U = 10;
  const top = COURSES * 12;
  // stud box (keep frame, after buildFromPlan's shift) -> local-unit brick
  // (rounded: greathall.mjs puts 0.2-stud parts; brick.wedge = { D, down } orients a micro wedge)
  const SIDE_ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 }; // vertical side wedge: rotation by the side it is solid toward
  const mk = (x0, y0, x1, y1, z0, z1, { wedge, side, ...b }) => {
    const size = [Math.round(((x1 - x0) * U) / 2), Math.round(((y1 - y0) * U) / 2), Math.round((z1 - z0) / 2)];
    return {
      ...b, position: [Math.round((ox + (x0 + x1) / 2) * U), Math.round((oy + (y0 + y1) / 2) * U), Math.round((z0 + z1) / 2)],
      size, ...(wedge ? orientWedge(wedge.D, wedge.down, size) : {}), ...(side ? { direction: 4, rotation: SIDE_ROT[side.join()] } : {}),
    };
  };
  const put = (...a) => bricks.push(mk(...a));
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
  const [gtx, gty] = L.gateTile;
  const gateK = [gx + (gtx + 0.5 + side[0] * 0.5) * TILE - ox, gy + (gty + 0.5 + side[1] * 0.5) * TILE - oy];
  // a door edge's real opening in the built wall (owner 2026-10-25: "doors are not placed inside
  // walls": the wall builder can shift or drop an opening, so read it off the wall cells): the
  // 4-stud gap with no wall in courses 0-5 and jambs either side, searched +-4 studs from the plan
  const opening = key => {
    const [[ax, ay], [bx, by]] = key.split('|').map(t => t.split(',').map(Number));
    const H = ay !== by, l = H ? Math.max(ay, by) : Math.max(ax, bx);
    const c = (H ? shy : shx) + l * TILE, p0 = (H ? shx + ax * TILE : shy + ay * TILE) + 2;
    const w = (a, k) => wallAt.has(H ? `${a},${c},${k}` : `${c},${a},${k}`);
    for (const sh of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const a0 = p0 + sh;
      let gap = true;
      for (let a = a0; a < a0 + 4 && gap; a++) for (let k = 0; k < 6; k++) if (w(a, k)) { gap = false; break; }
      if (gap && w(a0 - 1, 0) && w(a0 + 4, 0)) return { H, c, a0, a1: a0 + 4, ax, ay, bx, by };
    }
    return null;
  };
  const extraDoors = new Map(); // doorways cut into enclosed pockets (key -> opening)
  // doors of a tile rect (grid tiles), as spans on its walls (keep frame)
  const doorsOf = r => {
    const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, out = [];
    for (const key of [...L.doors, ...extraDoors.keys()]) {
      const [[ax, ay], [bx, by]] = key.split('|').map(t => t.split(',').map(Number));
      if (inR(ax, ay) === inR(bx, by)) continue;
      const [ix, iy, ex, ey] = inR(ax, ay) ? [ax, ay, bx, by] : [bx, by, ax, ay];
      const o = extraDoors.get(key) ?? opening(key);
      if (!o) continue;
      out.push({ side: ey !== iy ? (ey < iy ? 'S' : 'N') : (ex < ix ? 'W' : 'E'), a0: o.a0, a1: o.a1 });
    }
    return out;
  };
  // ---- second storey (owner 2026-10-25: "add a second floor"): the same rooms again over the first
  // (walls repeated a storey up, the hall's ring left to the hall), the roof on top of them.
  // v2 (owner: "stairs dont go through ceilings and are placed abnormally. make them flush", "the room
  // has a huge gap in the floor", "doors and walls are not flush", "a room inside the walls thats
  // inaccessible"): an L stair tucked into a room corner, flush with both walls (7 treads along one
  // wall, a corner landing, 6 along the other; rise 12, run 2 studs), the upper floor and the ceiling
  // beams open over it; doorways are trimmed in the wall's own plane; upstairs, rooms the stair can't
  // reach (their only door led into the hall) get a doorway cut to a reachable neighbour
  const top2 = 2 * top, frng = makeRng((seed ?? 1) * 97 + 5); // decoration draws: the keep's own rng (spawns) stays put
  const out1 = r => [Math.floor(r[0]), Math.floor(r[1]), Math.ceil(r[2]), Math.ceil(r[3])];
  const holeK = hole && out1([hole[0] - ox, hole[1] - oy, hole[2] - ox, hole[3] - oy]);
  // the floor stops only at the dungeon's stairwell and the checkpoint's spot beside it
  const keepOut = [...(holeK ? [holeK] : []), ...(checkpoint ? [out1([checkpoint[0] - ox - 1.5, checkpoint[1] - oy - 1.5, checkpoint[0] - ox + 1.5, checkpoint[1] - oy + 1.5])] : [])];
  const roomRect = r => [shx + r.x * TILE + 1, shy + r.y * TILE + 1, shx + (r.x + r.w) * TILE, shy + (r.y + r.h) * TILE];
  const meets = (A, B) => A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3];
  const doorRect = (R, d) => { const [x0, y0, x1, y1] = R, w0 = d.a0 - 2, w1 = d.a1 + 2; return d.side === 'S' ? [w0, y0, w1, y0 + 5] : d.side === 'N' ? [w0, y1 - 5, w1, y1] : d.side === 'W' ? [x0, w0, x0 + 5, w1] : [x1 - 5, w0, x1, w1]; };
  const NT = 13;
  // a room corner: K the inside corner, A and B the directions along its two walls; (s, t) = studs
  // along A and along B from K (t is the distance off the A wall, s off the B wall)
  const cornersOf = ([x0, y0, x1, y1]) => [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]
    .flatMap(([kx, ky, sx, sy]) => [{ K: [kx, ky], A: [sx, 0], B: [0, sy] }, { K: [kx, ky], A: [0, sy], B: [sx, 0] }]);
  const Lr = (C, s0, t0, s1, t1) => {
    const p = [C.K[0] + C.A[0] * s0 + C.B[0] * t0, C.K[1] + C.A[1] * s0 + C.B[1] * t0], q = [C.K[0] + C.A[0] * s1 + C.B[0] * t1, C.K[1] + C.A[1] * s1 + C.B[1] * t1];
    return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])];
  };
  let stair = null;
  for (const { r, i } of L.rooms.map((r, i) => ({ r, i })).filter(({ i }) => !(HR && i === L.hall)).sort((p, q) => q.r.w * q.r.h - p.r.w * p.r.h)) {
    const R = roomRect(r), ds = doorsOf(r).map(d => doorRect(R, d));
    if (R[2] - R[0] < 22 || R[3] - R[1] < 22) continue;
    for (const C of cornersOf(R)) {
      const foot = [Lr(C, 0, 0, 20, 5), Lr(C, 0, 0, 5, 18)];
      if (foot.some(f => ds.some(d => meets(d, f)) || keepOut.some(k => meets(k, f)))) continue;
      stair = { i, R, C, foot, holes: [Lr(C, 0, 0, 17, 4), Lr(C, 0, 0, 4, 15)], upFoot: [Lr(C, 0, 0, 18, 5), Lr(C, 0, 0, 5, 18)] };
      break;
    }
    if (stair) break;
  }
  const holesUp = stair?.holes ?? [];
  if (process.env.KEEPDBG) console.error(`stair: ${stair ? `room ${stair.i} corner ${stair.C.K} A ${stair.C.A}` : 'NONE'}`);
  const clipRect = (b, R) => {
    if (!R || b.x1 <= R[0] || b.x0 >= R[2] || b.y1 <= R[1] || b.y0 >= R[3]) return [b];
    return [{ ...b, x1: R[0] }, { ...b, x0: R[2] }, { ...b, x0: Math.max(b.x0, R[0]), x1: Math.min(b.x1, R[2]), y1: R[1] }, { ...b, x0: Math.max(b.x0, R[0]), x1: Math.min(b.x1, R[2]), y0: R[3] }]
      .filter(p => p.x1 > p.x0 && p.y1 > p.y0);
  };
  // doors on each storey: the ground has all of them; upstairs not the gate nor into the hall, plus
  // doorways cut so that every upstairs room and corridor is reachable from the stair
  const parse = key => key.split('|').map(t => t.split(',').map(Number));
  const Gn = L.grid.length, idAt = (x, y) => (x < 0 || y < 0 || x >= Gn || y >= Gn ? SOLID : L.grid[y][x]);
  const isGateKey = key => { const [[ax, ay], [bx, by]] = parse(key); return (ax === gtx && ay === gty && bx === gtx + side[0] && by === gty + side[1]) || (bx === gtx && by === gty && ax === gtx + side[0] && ay === gty + side[1]); };
  const intoHall = key => { const [[ax, ay], [bx, by]] = parse(key); return HR && (idAt(ax, ay) === L.hall || idAt(bx, by) === L.hall); };
  // enclosed pockets: SOLID tiles not reachable from the grid's edge through SOLID tiles
  const voids = [];
  {
    const out = new Set(), q = [];
    for (let i = 0; i < Gn; i++) for (const [x, y] of [[i, 0], [i, Gn - 1], [0, i], [Gn - 1, i]]) if (idAt(x, y) === SOLID && !out.has(x + ',' + y)) { out.add(x + ',' + y); q.push([x, y]); }
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (nx < 0 || ny < 0 || nx >= Gn || ny >= Gn || out.has(k) || idAt(nx, ny) !== SOLID) continue; out.add(k); q.push([nx, ny]); } }
    for (let y = 0; y < Gn; y++) for (let x = 0; x < Gn; x++) if (idAt(x, y) === SOLID && !out.has(x + ',' + y)) voids.push([x, y]);
    if (process.env.KEEPDBG) {
      const cov = ([x, y]) => { const cx = shx + x * TILE + 4, cy = shy + y * TILE + 4; return ['ceiling', 'roof'].map(k => h.boxes.some(b => b.kind === k && b.x0 <= cx && cx < b.x1 && b.y0 <= cy && cy < b.y1) ? k : '-').join('/'); };
      console.error(`enclosed pockets: ${voids.length} tiles`, voids.map(v => v.join(',') + ' ' + cov(v)).join(' | '));
    }
  }
  // owner 2026-10-25 ("theres a room inside the walls thats inaccessible"): each pocket becomes a
  // room: a doorway cut from a neighbouring room or corridor (both storeys, clear of the stair)
  const pockets = [];
  {
    const left = new Set(voids.map(v => v.join()));
    for (const v0 of voids) {
      if (!left.has(v0.join())) continue;
      const comp = [], q = [v0]; left.delete(v0.join());
      while (q.length) { const [x, y] = q.pop(); comp.push([x, y]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (left.has(k)) { left.delete(k); q.push([x + dx, y + dy]); } } }
      let door = null;
      for (const [x, y] of comp) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, g = idAt(nx, ny);
          if (g === SOLID || (HR && g === L.hall) || door) continue;
          const H = dy !== 0, l = H ? Math.max(y, ny) : Math.max(x, nx), c = (H ? shy : shx) + l * TILE, a0 = (H ? shx + x * TILE : shy + y * TILE) + 2;
          const w = (a, k) => wallAt.has(H ? `${a},${c},${k}` : `${c},${a},${k}`);
          let solid = true;
          for (let a = a0 - 1; a <= a0 + 4 && solid; a++) for (let k = 0; k < 7; k++) if (!w(a, k)) { solid = false; break; }
          const zone = H ? [a0 - 2, c - 5, a0 + 6, c + 6] : [c - 5, a0 - 2, c + 6, a0 + 6];
          if (!solid || (stair && [...stair.foot, ...stair.upFoot].some(f => meets(f, zone)))) continue;
          door = { key: edgeKey(x, y, nx, ny), o: { H, c, a0, a1: a0 + 4 } };
        }
      }
      if (!door) continue;
      extraDoors.set(door.key, door.o);
      pockets.push({ tiles: comp, door });
    }
    if (process.env.KEEPDBG) console.error(`pockets opened: ${pockets.length} (${pockets.map(p => p.tiles.length).join(',')} tiles)`);
  }
  const upOpen = new Map(); // door key -> opening
  for (const key of L.doors) if (!isGateKey(key) && !intoHall(key)) { const o = opening(key); if (o) upOpen.set(key, o); }
  for (const [key, o] of extraDoors) upOpen.set(key, o);
  if (stair) {
    const solidUp = (x, y) => { const g = idAt(x, y); return g === SOLID || (HR && g === L.hall); };
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let guard = 0; guard < 40; guard++) {
      const seen = new Set(), q = [];
      for (let y = 0; y < Gn; y++) for (let x = 0; x < Gn; x++) if (idAt(x, y) === stair.i) { seen.add(x + ',' + y); q.push([x, y]); }
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (seen.has(k) || solidUp(nx, ny)) continue;
          if (idAt(nx, ny) !== idAt(x, y) && !upOpen.has(edgeKey(x, y, nx, ny))) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      // the first cut-off tile beside a reached one, through a plain stretch of wall
      let cut = null;
      for (let y = 0; y < Gn && !cut; y++) for (let x = 0; x < Gn && !cut; x++) {
        if (solidUp(x, y) || seen.has(x + ',' + y)) continue;
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (!seen.has(nx + ',' + ny)) continue;
          const H = dy !== 0, l = H ? Math.max(y, ny) : Math.max(x, nx), c = (H ? shy : shx) + l * TILE, a0 = (H ? shx + x * TILE : shy + y * TILE) + 2;
          const w = (a, k) => wallAt.has(H ? `${a},${c},${k}` : `${c},${a},${k}`);
          let solid = true;
          for (let a = a0 - 1; a <= a0 + 4 && solid; a++) for (let k = 0; k < 7; k++) if (!w(a, k)) { solid = false; break; }
          if (solid) { cut = { key: edgeKey(x, y, nx, ny), o: { H, c, a0, a1: a0 + 4 } }; break; }
        }
      }
      if (!cut) { if (process.env.KEEPDBG) { let n = 0; for (let y = 0; y < Gn; y++) for (let x = 0; x < Gn; x++) if (!solidUp(x, y) && !seen.has(x + ',' + y)) n++; console.error(`upstairs: ${guard} doorways cut, ${n} tiles still cut off`); } break; }
      upOpen.set(cut.key, cut.o);
    }
  }
  // flush doorway trim: the wall's own cells round each opening become stone jambs, a lintel and a
  // gold keystone (ground: every door; upstairs: upOpen), and upstairs cut doorways are opened
  const cellKey = (o, a, k) => (o.H ? `${a},${o.c},${k}` : `${o.c},${a},${k}`);
  const doorCells = new Map(), openUp = new Set(), arches = [];
  const trimDoor = (o, k0) => {
    for (let k = k0; k < k0 + 6; k++) for (const a of [o.a0 - 1, o.a1]) doorCells.set(cellKey(o, a, k), { asset: MB, color: T.trim });
    for (let a = o.a0 - 1; a <= o.a1; a++) doorCells.set(cellKey(o, a, k0 + 6), { asset: MB, color: a === o.a0 + 1 || a === o.a0 + 2 ? GOLD : T.trim });
    arches.push({ o, z: k0 * 12 + 60 });
  };
  for (const key of L.doors) { const o = opening(key); if (o) trimDoor(o, 0); }
  for (const [, o] of extraDoors) { trimDoor(o, 0); for (let k = 0; k < 6; k++) for (let a = o.a0; a < o.a1; a++) openUp.add(cellKey(o, a, k)); }
  for (const [key, o] of upOpen) {
    trimDoor(o, COURSES);
    if (!L.doors.has(key) || extraDoors.has(key)) for (let k = COURSES; k < COURSES + 6; k++) for (let a = o.a0; a < o.a1; a++) openUp.add(cellKey(o, a, k));
  }
  // one wall box, cell by cell where trimmed or opened, else whole
  const emitWall = (b, dz, dk, base) => {
    const alongX = b.x1 - b.x0 >= b.y1 - b.y0, n = alongX ? b.x1 - b.x0 : b.y1 - b.y0, course = b.course + dk;
    const styles = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = alongX ? [b.x0 + i, b.y0] : [b.x0, b.y0 + i], key = `${x},${y},${course}`;
      styles.push(openUp.has(key) ? null : doorCells.get(key) ?? base);
    }
    if (styles.every(s => s === base)) return put(b.x0, b.y0, b.x1, b.y1, b.z0 + dz, b.z1 + dz, base);
    for (let i = 0; i < n;) {
      let j = i + 1;
      while (j < n && styles[j] === styles[i] && styles[i] === base) j++;
      if (styles[i]) alongX ? put(b.x0 + i, b.y0, b.x0 + j, b.y1, b.z0 + dz, b.z1 + dz, styles[i]) : put(b.x0, b.y0 + i, b.x1, b.y0 + j, b.z0 + dz, b.z1 + dz, styles[i]);
      i = j;
    }
  };
  for (const b of h.boxes) {
    if (b.kind === 'wall') {
      // over an opening (a doorway's lintel): micro brick, no studs underneath
      let over = false;
      if (b.course > 0) for (let x = b.x0; x < b.x1 && !over; x++) for (let y = b.y0; y < b.y1; y++) if (!wallAt.has(`${x},${y},${b.course - 1}`)) { over = true; break; }
      const k = Math.floor(rng() * 5);
      const c = b.course === 0 ? T.base : b.course === COURSES - 1 ? T.trim : shade(T.field[k % T.field.length], k);
      emitWall(b, 0, 0, over ? { asset: MB, color: c } : { color: c });
      const k2 = Math.floor(frng() * 5), c2 = b.course === 0 ? T.trim : b.course === COURSES - 1 ? T.trim : shade(T.field[k2 % T.field.length], k2);
      for (const p of clipHall(b)) emitWall({ ...p, course: b.course }, top, COURSES, over ? { asset: MB, color: c2 } : { color: c2 });
    } else if (b.kind === 'ceiling') {
      for (const p of holesUp.reduce((bs, h) => bs.flatMap(q => clipRect(q, h)), clipHall(b))) put(p.x0, p.y0, p.x1, p.y1, p.z0, p.z1, { asset: MB, color: T.trim });
      for (const p of clipHall(b)) put(p.x0, p.y0, p.x1, p.y1, p.z0 + top, p.z1 + top, { asset: MB, color: T.trim });
    } else if (b.kind === 'roof') for (const p of clipHall(b)) {
      // a regular 4 x 4 stud tile grid on the global stud grid, shades varied (owner 2026-10-25:
      // "that greedy meshing on top sucks": one merged tile per roof box showed random long seams)
      for (let x = Math.floor(p.x0 / 4) * 4; x < p.x1; x += 4) for (let y = Math.floor(p.y0 / 4) * 4; y < p.y1; y += 4) {
        const a0 = Math.max(x, p.x0), a1 = Math.min(x + 4, p.x1), b0 = Math.max(y, p.y0), b1 = Math.min(y + 4, p.y1);
        if (a1 > a0 && b1 > b0) put(a0, b0, a1, b1, p.z0 + top, p.z1 + top, { asset: TILE_B, color: shade(T.dado, (((x >> 2) * 7 + (y >> 2) * 13) % 5 + 5) % 5) });
      }
      for (let x = p.x0; x < p.x1; x++) for (let y = p.y0; y < p.y1; y++) roofCells.add(x + ',' + y);
    }
  }
  // pointed heads in every trimmed doorway: two hanging wedges in its top course, in the wall plane
  for (const { o, z } of arches) {
    const mid = (o.a0 + o.a1) / 2, along = o.H ? [1, 0] : [0, 1];
    const P = (p, q, b) => (o.H ? put(p, o.c, q, o.c + 1, z, z + 12, b) : put(o.c, p, o.c + 1, q, z, z + 12, b));
    P(o.a0, mid, { asset: WEDGE, color: T.trim, wedge: { D: [-along[0], -along[1]], down: true } });
    P(mid, o.a1, { asset: WEDGE, color: T.trim, wedge: { D: along, down: true } });
  }
  // the gate is a ground-floor door: upstairs its opening is walled up
  {
    const go = opening(edgeKey(gtx, gty, gtx + side[0], gty + side[1]));
    if (go) for (let k = COURSES; k < COURSES + 6; k++) {
      const kk = Math.floor(frng() * 5), col = shade(T.field[kk % T.field.length], kk);
      if (go.H) put(go.a0, go.c, go.a1, go.c + 1, k * 12, k * 12 + 12, { color: col }); else put(go.c, go.a0, go.c + 1, go.a1, k * 12, k * 12 + 12, { color: col });
    }
  }
  // merlons along the roof's edge, every other 2 studs
  const roofTop = top2 + 4;
  // corner towers (2026-10-15, owner: "the castles look like shit"): round
  // towers (castle.mjs) on the convex corners of the big masses (a 6x6 block of
  // roof behind the corner, so not on corridor stubs), well apart and clear of
  // the gate; centred on the corner, so three quarters stand outside; below the
  // roof they never enter the keep's footprint, above it they sit on the roof
  const towerPots = [];
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
    const rooms = [];
    towerAt.forEach(([vx, vy], n) => {
      const kTop = Math.ceil((top2 + 60) / VZ) + (n % 2) * 4, ci = vx + oxs, cj = vy + oys;
      roundTower(c, ci, cj, 4, kTop, trng() < 0.4 ? 'cone' : 'crenel', 7000 + n, [], { slits: true, base: T.field[0] });
      // enterable (owner 2026-10-25): a room inside (radius 3, 72 high, bounded by the keep's corner
      // where the tower meets it), a doorway out the side away from the keep
      const q = [[-1, -1], [1, -1], [-1, 1], [1, 1]].find(([a, b]) => foot.has((vx + (a < 0 ? -1 : 0)) + ',' + (vy + (b < 0 ? -1 : 0)))) ?? [-1, -1];
      const bx = -q[0] / Math.SQRT2, by = -q[1] / Math.SQRT2;
      for (let i = ci - 6; i <= ci + 6; i++) for (let j = cj - 6; j <= cj + 6; j++) {
        const dx = i + 0.5 - ci, dy = j + 0.5 - cj, r = Math.hypot(dx, dy), along = dx * bx + dy * by, cross = Math.abs(dx * by - dy * bx);
        for (let k = 0; k < 12; k++) {
          if (r < 3) c.del(i, j, k);
          else if (along > 0 && cross < 1.1 && r < 6) c.del(i, j, k); // the doorway, through wall and plinth
        }
      }
      rooms.push({ ci, cj, bx, by });
    });
    for (const b of c.bricks()) bricks.push({ ...b, position: [b.position[0], b.position[1], b.position[2]] });
    for (const { ci, cj, bx, by } of rooms) { // a lamp under the room's ceiling, a pot on the floor
      const lx = Math.round((ci + bx * 1.5) * VX), ly = Math.round((cj + by * 1.5) * VX);
      bricks.push({ asset: MB, size: [4, 4, 2], position: [lx, ly, 12 * VZ - 4], color: T.glow, material: 'BMC_Glow', material_intensity: 6, components: [{ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: 3, Radius: 240, Color: { R: 255, G: 200, B: 140, A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } }] });
      towerPots.push([Math.round((ci + Math.sign(bx)) * VX), Math.round((cj + Math.sign(by)) * VX), 0]); // its 2 x 2 box covers only hollowed cells
    }
  }
  const inTower = (x, y) => towerAt.some(([vx, vy]) => Math.hypot(x + 0.5 - vx, y + 0.5 - vy) <= 5.6);
  for (const k of roofCells) {
    const [x, y] = k.split(',').map(Number);
    if (inTower(x, y) || nearHall(x, y, 1)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => roofCells.has(`${x + a},${y + b}`))) continue;
    if (((x >> 1) + (y >> 1)) % 2) continue;
    put(x, y, x + 1, y + 1, roofTop, roofTop + 12, { color: T.mould });
  }
  // the hall (greathall.mjs): walls, roof, ceiling, then the inside
  const pots = [...towerPots];
  let hallInfo = null, roofPeak = roofTop + 12;
  if (HR) {
    const shell = hallShell({ put, HI, HR, top, roofZ: roofTop, T, rng, shade, roofCells, foot, gate: gateK });
    roofPeak = shell.roofTop;
    hallInfo = greatHall({ put, I: HI, doors: doorsOf(hr), T, rng: makeRng((seed ?? 1) * 53 + 11), shade, shell });
    for (const [x, y, z] of hallInfo.pots) pots.push([(ox + x) * U, (oy + y) * U, z]);
  }
  // floors: smooth flagstones on every room and corridor tile (the hall has its own); bare round the stairwell
  const tiles = [];
  for (let ty = 0; ty < L.grid.length; ty++) for (let tx = 0; tx < L.grid.length; tx++) {
    const g = L.grid[ty][tx];
    if (g === SOLID || (HR && g === L.hall)) continue;
    tiles.push({ tx, ty, room: g });
  }
  pockets.forEach((pk, n) => { for (const [tx, ty] of pk.tiles) tiles.push({ tx, ty, room: 1000 + n }); });
  const up = a => [a[0], a[1], a[2], a[3], a[4] + top, a[5] + top, a[6]];
  for (const a of floors({ tiles, sh: [shx, shy], TILE, wallAt: (x, y) => wallAt.has(`${x},${y},0`), keepOut, T, rng: frng })) put(...a);
  for (const a of floors({ tiles, sh: [shx, shy], TILE, wallAt: (x, y) => wallAt.has(`${x},${y},0`), keepOut: holesUp, T, rng: frng })) put(...up(a));
  if (stair) { // the L stair: running-bond fill, tan smooth treads, stringers in the walls' own stone with trim copes, a railing upstairs
    const { C } = stair, FLR = 4, cz = c => (c === 0 ? [FLR, FLR + 8] : [FLR + 12 * c - 4, FLR + 12 * c + 8]);
    const fieldF = () => { const k = Math.floor(frng() * 5); return shade(T.field[k % T.field.length], k); };
    const B = (s0, t0, s1, t1, z0, z1, x) => { if (s1 > s0 && t1 > t0) put(...Lr(C, s0, t0, s1, t1), z0, z1, x); };
    const bond = (s0, t0, s1, t1, z0, z1) => { if (s1 > s0 && t1 > t0) bondPut(put, ...Lr(C, s0, t0, s1, t1), z0, z1, Math.floor(z0 / 12), fieldF); };
    const T1 = j => [17 - 2 * j, 19 - 2 * j]; // treads 1..7 along A (s), rising toward the corner
    const T2 = j => [3 + 2 * (j - 8), 5 + 2 * (j - 8)]; // treads 8..13 along B (t), rising away from it
    for (let c = 0; c < NT; c++) {
      const [z0, z1] = cz(c);
      if (c < 7) { bond(3, 0, 17 - 2 * c, 3, z0, z1); bond(0, 0, 3, 3, z0, z1); }
      bond(0, T2(Math.max(8, c + 1))[0], 3, 15, z0, z1);
    }
    for (let j = 1; j <= 7; j++) B(T1(j)[0], 0, T1(j)[1], 3, FLR + 12 * j - 4, FLR + 12 * j, { asset: SMOOTH, color: T.dado });
    B(0, 0, 3, 3, FLR + 80, FLR + 84, { asset: SMOOTH, color: T.dado });
    for (let j = 8; j <= NT; j++) B(0, T2(j)[0], 3, T2(j)[1], FLR + 12 * j - 4, FLR + 12 * j, { asset: SMOOTH, color: T.dado });
    // stringers on the open sides (flight 1: t 3..4 from s 4; flight 2: s 3..4 from t 4), a newel at the turn
    for (let c = 0; c <= NT; c++) {
      const [z0, z1] = cz(c);
      if (c <= 7) bond(4, 3, 19 - 2 * Math.max(1, c), 4, z0, z1);
      const j0 = Math.max(8, c);
      if (j0 <= NT) bond(3, Math.max(4, T2(j0)[0]), 4, 15, z0, z1);
      if (c <= 7) B(3, 3, 4, 4, z0, z1, { color: fieldF() });
    }
    for (let j = 1; j <= 7; j++) B(Math.max(4, T1(j)[0]), 3, T1(j)[1], 4, FLR + 12 * j + 8, FLR + 12 * j + 20, { asset: WEDGE, color: T.trim, wedge: { D: [-C.A[0], -C.A[1]], down: false } });
    for (let j = 8; j <= NT; j++) B(3, Math.max(4, T2(j)[0]), 4, T2(j)[1], FLR + 12 * j + 8, FLR + 12 * j + 20, { asset: WEDGE, color: T.trim, wedge: { D: C.B, down: false } });
    B(3, 3, 4, 4, FLR + 92, FLR + 96, { asset: MB, color: T.trim });
    // upstairs: posts and a rail round the stairwell, open where flight 2 arrives
    const z0 = top + FLR, RAIL = { asset: MB, color: T.trim };
    const rail = (s0, t0, s1, t1) => {
      B(s0, t0, s1, t1, z0 + 24, z0 + 28, RAIL);
      const alongS = s1 - s0 >= t1 - t0, n = alongS ? s1 - s0 : t1 - t0;
      for (let k = 0; k < n; k += 2) { const [p, q] = alongS ? [s0 + k + 0.2, t0 + 0.2] : [s0 + 0.2, t0 + k + 0.2]; B(p, q, p + 0.6, q + 0.6, z0, z0 + 24, RAIL); }
    };
    rail(4, 4, 18, 5); rail(17, 0, 18, 4); rail(4, 5, 5, 15);
  }

  // optional pieces (the gate's outer portal, furniture): each group goes in whole where it touches nothing, else not at all
  const groups = [];
  let noOpening = 0;
  for (const key of L.doors) {
    const o = opening(key);
    if (!o) { noOpening++; continue; }
    if (!isGateKey(key)) continue; // inside doors are trimmed flush in the wall (above)
    const field = () => { const k = Math.floor(frng() * 5); return shade(T.field[k % T.field.length], k); };
    const s = o.H ? side[1] : side[0];
    groups.push({ alts: [3, 2, 1].map(D => portal({ axis: o.H ? 0 : 1, c: o.c, a0: o.a0, a1: o.a1, s, D, T, z0: 0, zTop: top - 4, field })) });
  }
  // the doors of a room upstairs (upOpen)
  const doorsUpOf = r => {
    const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h, out = [];
    for (const [key, o] of upOpen) {
      const [[ax, ay], [bx, by]] = parse(key);
      if (inR(ax, ay) === inR(bx, by)) continue;
      const [ix, iy, ex, ey] = inR(ax, ay) ? [ax, ay, bx, by] : [bx, by, ax, ay];
      out.push({ side: ey !== iy ? (ey < iy ? 'S' : 'N') : (ex < ix ? 'W' : 'E'), a0: o.a0, a1: o.a1 });
    }
    return out;
  };
  const kinds = [...KINDS].sort(() => frng() - 0.5);
  L.rooms.forEach((r, i) => {
    if (i === L.hall && HR) return;
    const R = roomRect(r);
    const cxk = shx + (r.x + r.w / 2) * TILE, cyk = shy + (r.y + r.h / 2) * TILE;
    const kind = i === 0 ? 'entry' : kinds[(i - 1) % kinds.length];
    const here = stair?.i === i;
    const fg = furnish({ R, doors: doorsOf(r), kind, top: top - 4, T, rng: frng, spawn: [cxk, cyk], hole: [...(i === 0 ? keepOut : []), ...(here ? stair.foot : [])], noBeams: here ? stair.foot : [] });
    const kind2 = kinds[(i + 2) % kinds.length];
    const fg2 = furnish({ R, doors: doorsUpOf(r), kind: kind2, top: top - 4, T, rng: frng, spawn: [cxk, cyk], hole: here ? stair.upFoot : [] });
    for (const g of fg2) groups.push({ alts: [g.map(up)] });
    if (process.env.KEEPDBG) console.error(`room ${i} ${kind}/${kind2} ${R.join(',')} doors ${doorsOf(r).length}/${doorsUpOf(r).length}: ${fg.length}+${fg2.length} groups`);
    for (const g of fg) groups.push({ alts: [g] });
  });
  // the pockets: a lamp under each ceiling and a pot on each floor, in the tile furthest from the door
  for (const pk of pockets) {
    const [[dx0, dy0]] = parse(pk.door.key);
    const [fx, fy] = pk.tiles.reduce((b, t) => (Math.hypot(t[0] - dx0, t[1] - dy0) > Math.hypot(b[0] - dx0, b[1] - dy0) ? t : b));
    const px = gx + (fx + 0.5) * TILE, py = gy + (fy + 0.5) * TILE;
    for (const z of [top - 6, top2 - 6]) bricks.push({ asset: MB, size: [6, 6, 2], position: [px * U, py * U, z], color: T.glow, material: 'BMC_Glow', material_intensity: 5 });
    pots.push([px * U, py * U, 4], [px * U, py * U, top + 4]);
  }
  // lamps under the ceiling and spawners in the rooms (not the stairwell's, not the hall's)
  const spawns = [];
  L.rooms.forEach((r, i) => {
    const cx = gx + (r.x + r.w / 2) * TILE, cy = gy + (r.y + r.h / 2) * TILE; // stud centre, grid frame
    if (i === L.hall && HR) { rng(); return; } // the hall: its chandelier lights it, no spawner (rng() keeps the draws)
    bricks.push({ asset: MB, size: [6, 6, 2], position: [cx * U, cy * U, top - 6], color: T.glow, material: 'BMC_Glow', material_intensity: 5 });
    if (i > 0 && rng() < 0.75 && i !== L.hall) spawns.push([cx * U, cy * U, 6]); // on the floor tiles
    bricks.push({ asset: MB, size: [6, 6, 2], position: [cx * U, cy * U, top2 - 6], color: T.glow, material: 'BMC_Glow', material_intensity: 5 });
    if (frng() < 0.6) spawns.push([cx * U, cy * U, top + 6]); // upstairs
  });
  {
    const B = makeBuilder();
    for (const b of bricks) B.add(b, 'keep');
    const boxOf = b => worldBox(b, FIXED);
    const clash = (p, q) => p[0][0] < q[1][0] && q[0][0] < p[1][0] && p[0][1] < q[1][1] && q[0][1] < p[1][1] && p[0][2] < q[1][2] && q[0][2] < p[1][2];
    let placed = 0, why = { blocked: 0, self: 0 };
    for (const { alts } of groups) for (const list of alts) {
      const bs = list.map(a => mk(...a)), bx = bs.map(boxOf);
      if (!bx.every(([lo, hi]) => B.free(lo, hi))) { why.blocked++; continue; }
      if (bx.some((p, i) => bx.some((q, j) => j > i && clash(p, q)))) { why.self++; continue; }
      for (const b of bs) { B.add(b, 'opt'); bricks.push(b); }
      placed++;
      break;
    }
    if (process.env.KEEPDBG) console.error(`doors without an opening: ${noOpening}/${L.doors.size}`);
    if (process.env.KEEPDBG) console.error(`keep decor: ${placed}/${groups.length} groups placed`, why);
  }
  const [tx, ty] = L.gateTile;
  const gate = [gx + (tx + 0.5 + side[0] * 0.5) * TILE, gy + (ty + 0.5 + side[1] * 0.5) * TILE];
  const G = L.grid.length;
  return { bricks, extent: [gx, gy, gx + G * TILE + 1, gy + G * TILE + 1], gate, spawns, pots, hall: hallInfo, rooms: L.rooms.length, top: Math.max(roofPeak, roofTop + 12) };
}

