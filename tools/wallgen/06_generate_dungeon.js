// Diablo-style dungeon generator: a stack of procedurally generated levels,
// each one a different room-and-corridor layout, joined by straight stair
// flights. Level 1 is on top and opens onto the surface; every level below
// it has its up-stairs exactly under the previous level's down-stairs.
//
// The levels are built with the same brick-laying core as the jail
// (lib.js): the generator only writes wall runs in the
// {orient,line,start,end,openings} format stage 3 produces, and everything
// after that -- running bond, interlocked corners, door lintels, floors,
// and both validation gates -- is the jail's code, unchanged.
//
//   node 06_generate_dungeon.js --levels 4 --seed 1337
//   node 06_generate_dungeon.js --levels 8 --width 14 --height 14 --rooms 10 \
//     --config '{"WALL_COURSES":8,"DOOR_OPEN_COURSES":5}'
//
// Output: <prefix>.brs / <prefix>.brz (the save), <prefix>_map.svg (every
// level's plan, with stairs marked), <prefix>_levels.json (each level's
// runs, for debugging). stdout is one JSON stats line, like stage 5.
//
// How the stack is laid out (z grows upward, deepest level on the ground):
//
//   surface   ── top of level 1's lid; the entrance flight ends flush with it
//   level 1   walls (WALL_COURSES) + lid (one course thick, covers rooms + walls)
//   level 2   ...
//   level N   walls + lid, floor at z 0
//
// A flight from level k+1 up to level k is a solid stack of steps standing on
// level k+1's ground, cut through level k+1's lid and level k's floor (the
// stairwell); its top step is flush with level k's floor. The stair
// rectangle has a landing row at each end, and the whole rectangle has to
// be room interior clear of doorways in BOTH levels it joins.

const fs = require("fs");
const brs = require("brs-js");
const lib = require("./lib");

const key = (x, y) => x + "," + y;
const SOLID = -1, CORRIDOR = -2;

// ------------------------------------------------------------------ options --
const TUNABLE = ["STUD", "COURSE_H", "WALL_COURSES", "DOOR_OPEN_COURSES", "MARGIN", "FLOOR_H",
                 "FLOOR_MAX", "STAIR_WIDTH", "STAIR_RISE", "STAIR_RUN"];

function parseArgs(argv) {
  const opts = {
    levels: 4, seed: Date.now() % 1e9, width: 12, height: 12, tile: 8,
    rooms: 9, roomMin: 2, roomMax: 4, loops: 0.2, outPrefix: "dungeon", config: {},
    wallType: "brick",
  };
  const nums = { "--levels": "levels", "--seed": "seed", "--width": "width", "--height": "height",
                 "--tile": "tile", "--rooms": "rooms", "--room-min": "roomMin", "--room-max": "roomMax",
                 "--loops": "loops" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (nums[a]) { opts[nums[a]] = Number(next()); continue; }
    switch (a) {
      case "--out-prefix": opts.outPrefix = next(); break;
      case "--config": opts.config = JSON.parse(next()); break;
      case "--wall-type":
        opts.wallType = next();
        if (!["brick", "cave"].includes(opts.wallType)) throw new Error(`--wall-type: brick or cave (got ${opts.wallType})`);
        break;
      case "--help": case "-h":
        console.error(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 33).join("\n"));
        process.exit(0);
      default: throw new Error(`unknown argument: ${a}`);
    }
  }
  for (const k of Object.keys(opts.config)) {
    if (!TUNABLE.includes(k)) throw new Error(`--config: unknown key ${k} (tunable: ${TUNABLE.join(", ")})`);
    opts.config[k] = Number(opts.config[k]);
  }
  for (const k of Object.keys(nums).map((f) => nums[f])) {
    if (!Number.isFinite(opts[k])) throw new Error(`--${k}: not a number`);
  }
  if (!(Number.isInteger(opts.tile) && opts.tile >= 6 && opts.tile % 2 === 0)) {
    // Even, so every wall line lands on the even-stud grid the domino tiling
    // cuts on (see lib.toStud); >= 6 so a door leaves a pillar each side.
    throw new Error(`--tile must be an even integer >= 6 (got ${opts.tile})`);
  }
  if (!(opts.levels >= 1 && opts.roomMin >= 1 && opts.roomMax >= opts.roomMin)) {
    throw new Error("need --levels >= 1 and 1 <= --room-min <= --room-max");
  }
  return opts;
}

const opts = parseArgs(process.argv);
const config = { ...lib.CONFIG, ...opts.config, STOREYS: 1 };
config.BASE_Z = config.COURSE_H / 2;
const T = opts.tile;
const SH = lib.storeyHeight(config);
const LID_H = config.COURSE_H;            // the lid is one course, so walls stay course-aligned
const PITCH = SH + LID_H;                 // level-to-level height
const PITCH_COURSES = config.WALL_COURSES + 1;
const N_FLIGHT = PITCH / config.STAIR_RISE;                     // level -> level
const N_ENTRANCE = (PITCH - config.FLOOR_H) / config.STAIR_RISE; // level 1 -> surface (no floor plate up there)

{
  const errors = lib.checkConfig(config, { floor: true });
  if (!Number.isInteger(N_FLIGHT) || !Number.isInteger(N_ENTRANCE)) {
    errors.push(`STAIR_RISE ${config.STAIR_RISE} must divide both the level pitch (${PITCH}) and ` +
                `the pitch minus FLOOR_H (${PITCH - config.FLOOR_H}) so every top step meets its floor`);
  }
  if (config.STAIR_RISE % 2 !== 0) errors.push(`STAIR_RISE must be even (got ${config.STAIR_RISE})`);
  // A flight plus its two landings has to fit inside one room.
  const longest = Math.max(N_FLIGHT, N_ENTRANCE) * config.STAIR_RUN + 2;
  if (longest > opts.roomMax * T - 1) {
    errors.push(`a stair flight is ${longest} studs long but the biggest room is only ` +
                `${opts.roomMax * T - 1} studs inside -- raise --room-max or --tile, or STAIR_RISE`);
  }
  if (errors.length) throw new Error("bad settings:\n  - " + errors.join("\n  - "));
}

// mulberry32: small, seedable, good enough for layout.
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)); // inclusive
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}

// ------------------------------------------------------------------- layout --
// Tile grid: each tile is T x T studs. Rooms are tile rectangles; corridors are
// one-tile-wide L-shaped paths between room centres (a minimum spanning tree
// plus a few extra edges, so there are loops to circle round, as in Diablo).
// `forced` is a stud rectangle that must end up inside a room: the stairwell
// coming down from the level above.
function layoutLevel(rng, forced) {
  const GW = opts.width, GH = opts.height;
  const grid = Array.from({ length: GH }, () => new Array(GW).fill(SOLID));
  const rooms = [];
  const fits = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= GW && r.y + r.h <= GH;
  // one tile of rock between rooms, so two rooms never share a wall
  const clear = (r) => rooms.every((o) => r.x + r.w + 1 <= o.x || o.x + o.w + 1 <= r.x ||
                                          r.y + r.h + 1 <= o.y || o.y + o.h + 1 <= r.y);
  const add = (r) => {
    r.id = rooms.length;
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = r.id;
  };

  if (forced) {
    // Smallest tile rectangle whose interior (everything but its wall lines)
    // holds the stud rectangle, then grown a little at random for room to move.
    const o = config.MARGIN;
    const r = {
      x: Math.floor((forced.x0 - o - 1) / T), y: Math.floor((forced.y0 - o - 1) / T),
      x1: Math.ceil((forced.x1 - o) / T), y1: Math.ceil((forced.y1 - o) / T),
    };
    r.x = Math.max(0, r.x - rng.int(0, 1)); r.y = Math.max(0, r.y - rng.int(0, 1));
    r.x1 = Math.min(GW, r.x1 + rng.int(0, 1)); r.y1 = Math.min(GH, r.y1 + rng.int(0, 1));
    add({ x: r.x, y: r.y, w: r.x1 - r.x, h: r.y1 - r.y });
  }
  for (let tries = 0; rooms.length < opts.rooms && tries < 400; tries++) {
    const w = rng.int(opts.roomMin, opts.roomMax), h = rng.int(opts.roomMin, opts.roomMax);
    const r = { x: rng.int(0, GW - w), y: rng.int(0, GH - h), w, h };
    if (fits(r) && clear(r)) add(r);
  }

  const centre = (r) => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
  const dist = (a, b) => {
    const [ax, ay] = centre(a), [bx, by] = centre(b);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  };
  // Prim's MST over room centres, then extra edges for loops.
  const edges = [];
  const inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best = null;
    for (const a of inTree) for (const b of rooms) {
      if (inTree.has(b.id)) continue;
      const d = dist(rooms[a], b);
      if (!best || d < best.d) best = { a, b: b.id, d };
    }
    edges.push([best.a, best.b]);
    inTree.add(best.b);
  }
  const extra = Math.round(rooms.length * opts.loops);
  for (let i = 0; i < extra && rooms.length > 2; i++) {
    const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
    if (a !== b) edges.push([a, b]);
  }

  // Carve. Every step a path takes between two tiles is remembered; once all
  // the carving is done, a step that crosses from one region into another is
  // a doorway in the wall between them.
  const steps = [];
  for (const [a, b] of edges) {
    let [x, y] = centre(rooms[a]);
    const [tx, ty] = centre(rooms[b]);
    const xFirst = rng() < 0.5;
    const path = [[x, y]];
    const walk = (axis) => {
      if (axis === "x") while (x !== tx) { x += Math.sign(tx - x); path.push([x, y]); }
      else while (y !== ty) { y += Math.sign(ty - y); path.push([x, y]); }
    };
    walk(xFirst ? "x" : "y");
    walk(xFirst ? "y" : "x");
    for (const [px, py] of path) if (grid[py][px] === SOLID) grid[py][px] = CORRIDOR;
    for (let i = 1; i < path.length; i++) steps.push([path[i - 1], path[i]]);
  }
  const doors = new Set();
  for (const [[ax, ay], [bx, by]] of steps) {
    if (grid[ay][ax] !== grid[by][bx]) doors.add(edgeKey(ax, ay, bx, by));
  }
  return { grid, rooms, doors };
}

// A tile edge, named by the two tiles it separates (order-independent).
function edgeKey(ax, ay, bx, by) {
  return ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`;
}

// Tile grid -> wall runs in stud space, the format lib.js lays bricks from.
// A wall goes on every tile edge between two different regions (rock/room,
// room/corridor); corridor/corridor and room/room-same-room edges stay open.
// Collinear wall edges merge into one run. A doorway leaves a one-stud pillar
// at each end of its edge, so a perpendicular wall (which can only meet this
// one at a tile corner) never lands in an opening -- validateGeometry's check 3.
function toRuns({ grid, doors }) {
  const GW = opts.width, GH = opts.height, O = config.MARGIN;
  const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? SOLID : grid[y][x]);
  const runs = [];
  const sweep = (orient, lines, span, sides) => {
    for (let l = 0; l <= lines; l++) {
      let run = null;
      for (let p = 0; p <= span; p++) {
        const [a, b] = p < span ? sides(l, p) : [null, null];
        const wall = a !== null && a.r !== b.r && (a.r !== SOLID || b.r !== SOLID);
        if (wall) {
          if (!run) run = { orient, line: l * T + O, start: p * T + O, end: 0, openings: [] };
          run.end = (p + 1) * T + O;
          if (doors.has(edgeKey(a.x, a.y, b.x, b.y))) {
            run.openings.push({ pos0: p * T + 2 + O, pos1: (p + 1) * T - 1 + O, type: "door" });
          }
        } else if (run) { runs.push(run); run = null; }
      }
    }
  };
  // H walls: line between tile rows l-1 and l; V walls: between columns.
  sweep("H", GH, GW, (l, p) => [{ x: p, y: l - 1, r: at(p, l - 1) }, { x: p, y: l, r: at(p, l) }]);
  sweep("V", GW, GH, (l, p) => [{ x: l - 1, y: p, r: at(l - 1, p) }, { x: l, y: p, r: at(l, p) }]);
  return runs;
}

// Cells 8-adjacent to any doorway: a stairwell there would have you walk
// through a door straight into a pit (or a flight).
function doorAdjacent(runs) {
  const out = new Set();
  for (const r of runs) for (const o of r.openings) {
    for (let p = o.pos0; p < o.pos1; p++) {
      const [x, y] = r.orient === "H" ? [p, r.line] : [r.line, p];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.add(key(x + dx, y + dy));
    }
  }
  return out;
}

const rectCells = (r) => {
  const out = [];
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) out.push(key(x, y));
  return out;
};
const usable = (level, r) => rectCells(r).every((k) => level.encl.interior.has(k) && !level.doorAdj.has(k));
const touches = (a, b, gap) => a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.y0 - gap < b.y1 && b.y0 - gap < a.y1;

// Every stair rectangle that fits in `room` against one of its walls. The
// rectangle is STAIR_WIDTH across and n treads + 2 landings long.
function stairSpots(level, room, n, avoid) {
  const W = config.STAIR_WIDTH, L = n * config.STAIR_RUN + 2, O = config.MARGIN;
  const ix0 = room.x * T + 1 + O, iy0 = room.y * T + 1 + O;
  const ix1 = (room.x + room.w) * T + O, iy1 = (room.y + room.h) * T + O; // half-open
  const out = [];
  for (const axis of ["x", "y"]) {
    const [w, h] = axis === "x" ? [L, W] : [W, L];
    for (let y = iy0; y + h <= iy1; y++) for (let x = ix0; x + w <= ix1; x++) {
      const hugs = axis === "x" ? y === iy0 || y + h === iy1 : x === ix0 || x + w === ix1;
      if (!hugs) continue;
      const r = { x0: x, y0: y, x1: x + w, y1: y + h, axis };
      if (avoid && touches(r, avoid, 2)) continue;
      if (usable(level, r)) out.push(r);
    }
  }
  return out;
}

// One level: lay out, convert to runs, check the stairwell from above fits.
// Retries with fresh randomness until it does (the forced room can still get
// a corridor door right next to the stairwell).
function generateLevel(rng, index, up) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const layout = layoutLevel(rng, up && up.rect);
    const runs = toRuns(layout);
    const level = { index, layout, runs, encl: lib.markBuildings(runs), doorAdj: doorAdjacent(runs) };

    // The way in: the stairwell from the level above, or (level 1) the
    // entrance from the surface, which can go in any room that takes it.
    let upRect = up && up.rect;
    let upRoom = layout.rooms[0];
    if (up) {
      if (!usable(level, upRect)) continue;
    } else {
      const spots = layout.rooms.flatMap((room) => stairSpots(level, room, N_ENTRANCE).map((r) => ({ r, room })));
      if (!spots.length) continue;
      ({ r: upRect, room: upRoom } = rng.pick(spots));
    }
    level.up = { rect: upRect, n: up ? N_FLIGHT : N_ENTRANCE, dir: up ? up.dir : rng.int(0, 1) };
    level.upRoom = upRoom;

    // The way down goes in the room farthest from the way in, like Diablo
    // (falling back to nearer rooms if the far ones can't take a flight).
    if (index < opts.levels - 1) {
      const far = [...layout.rooms].sort((a, b) => roomDist(b, upRoom) - roomDist(a, upRoom));
      let down = null;
      for (const room of far) {
        const spots = stairSpots(level, room, N_FLIGHT, upRect);
        if (spots.length) { down = { rect: rng.pick(spots), room }; break; }
      }
      if (!down) continue;
      level.down = { rect: down.rect, n: N_FLIGHT, dir: rng.int(0, 1) };
      level.downRoom = down.room;
    }
    level.attempts = attempt + 1;
    return level;
  }
  throw new Error(`level ${index + 1}: no layout fit its stairs in 500 tries -- try a bigger --width/--height or --room-max`);
}

const roomDist = (a, b) => Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);

// --------------------------------------------------------------------- stack --
const levelBase = (i) => (opts.levels - 1 - i) * PITCH;       // world z of level i's ground
const courseOffset = (i) => (opts.levels - 1 - i) * PITCH_COURSES;

// Tread cells of a flight (landings excluded), and its step boxes. Step i
// (1..n) is i rises above the lower floor's surface; `dir` picks which end of
// the rectangle is the bottom.
function treads(f) {
  const out = new Set();
  for (let i = 1; i <= f.n; i++) for (const k of rectCells(stepRect(f, i))) out.add(k);
  return out;
}
function stepRect(f, i) {
  const R = config.STAIR_RUN, r = f.rect;
  const a0 = 1 + (f.dir === 0 ? i - 1 : f.n - i) * R;
  return r.axis === "x"
    ? { x0: r.x0 + a0, x1: r.x0 + a0 + R, y0: r.y0, y1: r.y1 }
    : { x0: r.x0, x1: r.x1, y0: r.y0 + a0, y1: r.y0 + a0 + R };
}

const rng = makeRng(opts.seed);
const levels = [];
for (let i = 0; i < opts.levels; i++) {
  const above = levels[i - 1];
  levels.push(generateLevel(rng, i, above && above.down));
  console.error(`level ${i + 1}: ${levels[i].layout.rooms.length} rooms, ${levels[i].runs.length} wall runs` +
                (levels[i].attempts > 1 ? ` (${levels[i].attempts} layouts tried)` : ""));
}

// Flights: `lower` is the level the steps stand in; `upper` the level whose
// floor (or, for -1, the surface) the top step meets.
const flights = levels.map((lv, i) => ({ lower: i, upper: i - 1, ...lv.up }));

const walls = [];   // {orient,line,a,b,course} with the level's course offset applied
const slabs = [];
for (const [i, lv] of levels.entries()) {
  // Gate 1, per level, exactly as stage 5 runs it on the jail.
  const levelBricks = lib.layBricks(lv.runs, config);
  lib.assertValidGeometry(lv.runs, levelBricks.map((b) => lib.toWorldBrick(b, config)), config);
  for (const b of levelBricks) walls.push({ ...b, course: b.course + courseOffset(i), level: i });

  const z = levelBase(i);
  const standing = flights.filter((f) => f.lower === i).flatMap((f) => [...treads(f)]);
  const arriving = flights.filter((f) => f.upper === i).flatMap((f) => [...treads(f)]);
  const floor = lib.floorCells(lv.runs, config, 0, lv.encl);
  for (const k of [...standing, ...arriving]) floor.delete(k);
  for (const r of lib.tileRects(floor, config.FLOOR_MAX)) slabs.push({ kind: "floor", level: i, ...r, z0: z, z1: z + config.FLOOR_H });

  // Lid: the rooms and the walls round them, so nothing below shows through.
  const lid = lib.roofFootprint(lv.encl, { ...config, ROOF_OVERHANG: 0 });
  for (const k of standing) lid.delete(k);
  for (const r of lib.tileRects(lid, config.FLOOR_MAX)) slabs.push({ kind: "ceiling", level: i, ...r, z0: z + SH, z1: z + PITCH });
}
for (const f of flights) {
  const z = levelBase(f.lower);
  for (let i = 1; i <= f.n; i++) {
    slabs.push({ kind: "stair", level: f.lower, ...stepRect(f, i), z0: z, z1: z + config.FLOOR_H + i * config.STAIR_RISE });
  }
}

// Gate 2, over the whole stack: nothing shares volume, every coordinate is an
// integer, no plate over FLOOR_MAX.
const violations = lib.validateSolids({ walls, glass: [], slabs }, config);
if (violations.length) {
  throw new Error(`Refusing to write output: ${violations.length} solid violation(s) found.\n` +
                  violations.slice(0, 20).map((v) => "  - " + v).join("\n"));
}
// And the stairs actually join up: every top step flush with the floor (or
// surface) it leads to. Checked from the final boxes, not from N_FLIGHT.
for (const f of flights) {
  const top = Math.max(...slabs.filter((s) => s.kind === "stair" && s.level === f.lower &&
    rectCells(s).every((k) => rectCells(f.rect).includes(k))).map((s) => s.z1));
  const want = f.upper < 0 ? levelBase(0) + PITCH : levelBase(f.upper) + config.FLOOR_H;
  if (top !== want) throw new Error(`flight into level ${f.lower + 1} tops out at z ${top}, its floor is at ${want}`);
}
// And every room, and the way down, can be walked to from the way in: flood
// the ground floor (doorways included) from the up-stairs' landing.
for (const [i, lv] of levels.entries()) {
  const floor = lib.floorCells(lv.runs, config, 0, lv.encl);
  const start = key(lv.up.rect.x0, lv.up.rect.y0);
  const seen = new Set([start]);
  for (const stack = [start]; stack.length;) {
    const [x, y] = stack.pop().split(",").map(Number);
    for (const k of [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]) {
      if (floor.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
    }
  }
  const O = config.MARGIN;
  const cut = lv.layout.rooms.filter((r) => !seen.has(key(r.x * T + 1 + O, r.y * T + 1 + O)));
  if (cut.length) throw new Error(`level ${i + 1}: ${cut.length} room(s) can't be reached from the way in`);
  if (lv.down && !rectCells(lv.down.rect).every((k) => seen.has(k))) throw new Error(`level ${i + 1}: the way down can't be reached`);
}
console.error("geometry validated: no invariant violations");

// ------------------------------------------------------------------- styling --
// Diablo's four tilesets, by depth: Cathedral, Catacombs, Caves, Hell.
const THEMES = [
  { name: "Cathedral", wall: [92, 92, 96, 255], floor: [58, 54, 50, 255] },
  { name: "Catacombs", wall: [110, 90, 66, 255], floor: [72, 58, 44, 255] },
  { name: "Caves",     wall: [62, 58, 46, 255], floor: [40, 37, 31, 255] },
  { name: "Hell",      wall: [96, 26, 20, 255], floor: [43, 14, 10, 255] },
];
const themeOf = (i) => THEMES[Math.min(3, Math.floor((i * 4) / opts.levels))];
const STAIR_COLOR = [138, 127, 115, 255];

const colors = [];
const colorIndex = (c) => {
  const k = c.join(",");
  let i = colors.findIndex((x) => x.join(",") === k);
  if (i < 0) { colors.push(c); i = colors.length - 1; }
  return i;
};
const bricks = [];
// Cave walls cover the same cells as the validated course bricks (lib.caveWallBricks).
const wallWorld = opts.wallType === "cave"
  ? lib.caveWallBricks(walls, config, opts.seed)
  : walls.map((b) => ({ ...lib.toWorldBrick(b, config), level: b.level }));
for (const w of wallWorld) bricks.push({ w, color: colorIndex(themeOf(w.level).wall) });
for (const s of slabs) {
  const c = s.kind === "stair" ? STAIR_COLOR : s.kind === "floor" ? themeOf(s.level).floor : themeOf(s.level).wall;
  bricks.push({ w: lib.toWorldSlab(s, config), color: colorIndex(c) });
}

const nobody = "00000000-0000-0000-0000-000000000000";
const saveObject = {
  version: 10,
  game_version: 0,
  map: "Plate",
  author: { id: nobody, name: "Claude" },
  host: { id: nobody, name: "Claude" },
  description: `Generated ${opts.levels}-level dungeon (seed ${opts.seed})`,
  save_time: [0, 0, 0, 0, 0, 0, 0, 0],
  mods: [],
  brick_assets: ["PB_DefaultBrick"],
  colors,
  materials: ["BMC_Plastic"],
  physical_materials: ["BPMC_Default"],
  brick_owners: [{ id: nobody, name: "Claude", display_name: "Claude", bricks: bricks.length }],
  brick_count: bricks.length,
  bricks: bricks.map(({ w, color }) => ({
    asset_name_index: 0,
    size: [w.sx, w.sy, w.sz],
    position: [w.x, w.y, w.z],
    direction: 4,
    rotation: 0,
    collision: true,
    visibility: true,
    material_index: 0,
    physical_index: 0,
    material_intensity: 0,
    color,
    owner_index: 1,
  })),
};

const brsPath = `${opts.outPrefix}.brs`, brzPath = `${opts.outPrefix}.brz`;
const buf = brs.write(saveObject);
fs.writeFileSync(brsPath, Buffer.from(buf));
console.error(`wrote ${brsPath} (${buf.length} bytes)`);
const brzBuf = brs.writeBrzLegacy(saveObject);
fs.writeFileSync(brzPath, Buffer.from(brzBuf));
console.error(`wrote ${brzPath} (${brzBuf.length} bytes)`);

fs.writeFileSync(`${opts.outPrefix}_levels.json`, JSON.stringify({
  seed: opts.seed, tile: T, width: opts.width, height: opts.height,
  levels: levels.map((lv) => ({ runs: lv.runs.map(({ upper, ...r }) => r), rooms: lv.layout.rooms, up: lv.up, down: lv.down || null })),
}, null, 1));

// ----------------------------------------------------------------------- map --
// Every level side by side: rock dark, floor light, walls black, doorways
// gaps, up-stairs green, down-stairs red (the arrow points uphill).
function renderMap() {
  const PX = 4, O = config.MARGIN, GAP = 40;
  const size = (n) => n * T + 2;
  const LW = size(opts.width) * PX, LH = size(opts.height) * PX;
  const cols = Math.min(opts.levels, 4), rows = Math.ceil(opts.levels / cols);
  const W = cols * (LW + GAP) + GAP, H = rows * (LH + GAP + 24) + GAP;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`,
               `<rect width="${W}" height="${H}" fill="#15130f"/>`];
  levels.forEach((lv, i) => {
    const ox = GAP + (i % cols) * (LW + GAP), oy = GAP + Math.floor(i / cols) * (LH + GAP + 24) + 24;
    const sx = (x) => ox + (x - O + 1) * PX, sy = (y) => oy + (y - O + 1) * PX;
    out.push(`<text x="${ox}" y="${oy - 8}" fill="#d8cfbf" font-size="16">Level ${i + 1} — ${themeOf(i).name}</text>`);
    out.push(`<rect x="${ox}" y="${oy}" width="${LW}" height="${LH}" fill="#2a2620"/>`);
    for (const r of lib.tileRects(lib.floorCells(lv.runs, config, 0, lv.encl), 1e9)) {
      out.push(`<rect x="${sx(r.x0)}" y="${sy(r.y0)}" width="${(r.x1 - r.x0) * PX}" height="${(r.y1 - r.y0) * PX}" fill="#a89e8c"/>`);
    }
    for (const r of lv.runs) {
      const cuts = [r.start, ...r.openings.flatMap((o) => [o.pos0, o.pos1]), r.end + 1];
      for (let j = 0; j < cuts.length; j += 2) {
        const [a, b] = [cuts[j], cuts[j + 1]];
        out.push(r.orient === "H"
          ? `<rect x="${sx(a)}" y="${sy(r.line)}" width="${(b - a) * PX}" height="${PX}" fill="#000"/>`
          : `<rect x="${sx(r.line)}" y="${sy(a)}" width="${PX}" height="${(b - a) * PX}" fill="#000"/>`);
      }
    }
    const stair = (f, fill, label) => {
      const r = f.rect;
      out.push(`<rect x="${sx(r.x0)}" y="${sy(r.y0)}" width="${(r.x1 - r.x0) * PX}" height="${(r.y1 - r.y0) * PX}" fill="${fill}" stroke="#000"/>`);
      const lo = stepRect(f, 1), hi = stepRect(f, f.n);
      const c = (s) => [sx((s.x0 + s.x1) / 2), sy((s.y0 + s.y1) / 2)];
      const [[x0, y0], [x1, y1]] = [c(lo), c(hi)];
      out.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#000" stroke-width="2" marker-end="url(#arrow)"/>`);
      out.push(`<text x="${sx(r.x1) + 4}" y="${sy(r.y0) + 12}" fill="${fill}" font-size="12" font-weight="bold">${label}</text>`);
    };
    stair(lv.up, "#4caf50", i === 0 ? "entrance" : "up");
    if (lv.down) stair(lv.down, "#e53935", "down");
  });
  out.splice(2, 0, `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>`);
  out.push("</svg>");
  return out.join("\n");
}
fs.writeFileSync(`${opts.outPrefix}_map.svg`, renderMap());
console.error(`wrote ${opts.outPrefix}_map.svg`);

const count = (kind) => slabs.filter((s) => s.kind === kind).length;
process.stdout.write(JSON.stringify({
  seed: opts.seed,
  levels: opts.levels,
  rooms: levels.map((lv) => lv.layout.rooms.length),
  bricks: bricks.length,
  wallBricks: wallWorld.length,
  floorBricks: count("floor"),
  lidBricks: count("ceiling"),
  stairBricks: count("stair"),
  heightWorld: opts.levels * PITCH,
  brs: { path: brsPath, bytes: buf.length },
  brz: { path: brzPath, bytes: brzBuf.length },
}) + "\n");
