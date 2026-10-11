// Generates a Brickadia .brs save: running-bond brick walls following a floor
// plan extracted from a hand-drawn image, with door/window openings and
// alternating-overlap (toothed) corner interlocking.
//
// Input: floorplan_runs.json  { width, height, runs: [{orient,line,start,end,openings:[{pos0,pos1,type}]}] }
// Output: jail_walls.brs

const fs = require("fs");
const brs = require("brs-js");

// ---------------------------------------------------------------- config --
const SCALE = 1;              // studs per source-image pixel
const STUD = 10;               // world units per stud
const COURSE_H = 12;           // world units per course (1 standard brick tall)
const WALL_COURSES = 6;        // total courses per wall
const DOOR_OPEN_COURSES = 3;   // bottom N courses left open for doors
const WINDOW_SILL_COURSES = 2; // solid courses below a window
const WINDOW_OPEN_COURSES = 2; // open courses for the window itself (band)
const WALL_THICKNESS = 1;      // stud
const BASE_Z = COURSE_H / 2;   // center of the first course, ground = z 0
const CORNER_SNAP = 3;         // studs, endpoint-matching tolerance
const MARGIN = 20;             // studs of empty space kept around the plan

const WALL_COLOR = [18, 18, 18, 255]; // black brick

// ------------------------------------------------------------ load plan --
const plan = JSON.parse(fs.readFileSync("floorplan_runs.json", "utf8"));

function toStud(px) {
  return Math.round(px * SCALE);
}

// normalize + offset every run into integer stud space, keeping MARGIN studs
// of clearance from (0,0)
let minX = Infinity, minY = Infinity;
const runs2 = plan.runs.map((r) => {
  const start = toStud(r.start);
  const end = toStud(r.end);
  const line = toStud(r.line);
  const openings = r.openings.map((o) => ({ pos0: toStud(o.pos0), pos1: toStud(o.pos1), type: o.type }));
  if (r.orient === "H") { minX = Math.min(minX, start, end); minY = Math.min(minY, line); }
  else { minX = Math.min(minX, line); minY = Math.min(minY, start, end); }
  return { orient: r.orient, line, start, end, openings };
});
const OFFX = MARGIN - minX;
const OFFY = MARGIN - minY;
const finalRuns = runs2.map((r) => {
  if (r.orient === "H") {
    return {
      orient: "H",
      line: r.line + OFFY,
      start: r.start + OFFX,
      end: r.end + OFFX,
      openings: r.openings.map((o) => ({ pos0: o.pos0 + OFFX, pos1: o.pos1 + OFFX, type: o.type })),
    };
  } else {
    return {
      orient: "V",
      line: r.line + OFFX,
      start: r.start + OFFY,
      end: r.end + OFFY,
      openings: r.openings.map((o) => ({ pos0: o.pos0 + OFFY, pos1: o.pos1 + OFFY, type: o.type })),
    };
  }
});

// endpoint world coordinates for corner matching
function endpoints(r) {
  if (r.orient === "H") return [[r.start, r.line], [r.end, r.line]];
  return [[r.line, r.start], [r.line, r.end]];
}

// -------------------------------------------------- corner classification --
// For each run end, figure out: 'dangling' | 'corner' | 'tjunction'
// 'corner': meets another run's tip -> alternate winner by course parity
// 'tjunction': lands in the middle of another run's span -> always retract
function classifyEnd(run, whichEnd) {
  const [ex, ey] = endpoints(run)[whichEnd];
  // Collect EVERY candidate within tolerance instead of returning the first
  // one found (finalRuns iteration order is arbitrary). In a floor plan
  // with several walls close together, most endpoints have multiple
  // candidates within CORNER_SNAP -- taking the first one silently picks an
  // unrelated wall as the "corner partner" and computes retraction against
  // the wrong coordinate, which shows up as a real gap or overlap at the
  // ACTUAL corner. Always take the closest candidate; a tip-to-tip "corner"
  // match beats an equally-close "tjunction" match since it's the more
  // specific relationship.
  const candidates = [];
  for (const other of finalRuns) {
    if (other === run) continue;
    if (other.orient === run.orient) continue; // only perpendicular walls interlock
    const [a, b] = endpoints(other);
    for (const p of [a, b]) {
      const d = Math.hypot(p[0] - ex, p[1] - ey);
      if (Math.abs(p[0] - ex) <= CORNER_SNAP && Math.abs(p[1] - ey) <= CORNER_SNAP) {
        candidates.push({ kind: "corner", other, dist: d });
      }
    }
    if (other.orient === "H" && Math.abs(other.line - ey) <= CORNER_SNAP &&
        ex > other.start + CORNER_SNAP && ex < other.end - CORNER_SNAP) {
      candidates.push({ kind: "tjunction", other, dist: Math.abs(other.line - ey) });
    }
    if (other.orient === "V" && Math.abs(other.line - ex) <= CORNER_SNAP &&
        ey > other.start + CORNER_SNAP && ey < other.end - CORNER_SNAP) {
      candidates.push({ kind: "tjunction", other, dist: Math.abs(other.line - ex) });
    }
  }
  if (candidates.length === 0) return { kind: "dangling" };
  candidates.sort((a, b) => a.dist - b.dist || (a.kind === "corner" ? -1 : 1));
  return candidates[0];
}

for (const r of finalRuns) {
  r.endInfo = [classifyEnd(r, 0), classifyEnd(r, 1)];
}

// CORNER_SNAP only decided whether two walls count as "meeting" -- it never
// made them meet at the SAME coordinate. A hand-drawn corner/T-junction can
// be off by up to CORNER_SNAP studs between the two walls' independently
// extracted endpoints, and the alternating-retraction math assumes exact
// coincidence at that point. Left alone, that slack shows up as a small
// persistent gap or overlap that breaks the interlock. Snap each connected
// endpoint onto the other wall's centerline (the coordinate that actually
// matters for a flush joint) now that every run's connections are known, so
// this doesn't feed back into classification order.
for (const r of finalRuns) {
  const [info0, info1] = r.endInfo;
  if (info0.other) r.start = info0.other.line;
  if (info1.other) r.end = info1.other.line;
}

// ------------------------------------------------------------ brick laying --
// Per-course shared-grid domino tiling, replacing the old per-run endpoint
// matching + retraction math entirely.
//
// Idea: treat every unit-length stud of every run as one cell in a shared
// grid keyed by (x,y). A corner is just the cell where an H-run's cell and
// a V-run's cell happen to be the SAME grid coordinate -- no cross-run
// distance matching, no "which wall wins," no retraction amount to get
// wrong. Each cell picks its own orientation locally from its neighbors,
// and corners resolve for free because the grid is shared.
//
// For each cell: if it only has horizontal neighbors, it's part of a
// horizontal wall; only vertical neighbors, vertical; both (a true
// corner/T/cross), alternate by course parity -- H claims it on even
// courses, V on odd. Whichever axis loses the tie simply doesn't include
// that cell in its own row/column run for this course, which is exactly
// the "retract by one wall thickness" behavior from before, but it falls
// out of the model instead of being computed.
const bricks = [];

function courseIsOpen(opening, course) {
  if (opening.type === "door") return course < DOOR_OPEN_COURSES;
  // window
  return course >= WINDOW_SILL_COURSES && course < WINDOW_SILL_COURSES + WINDOW_OPEN_COURSES;
}

const key = (x, y) => x + "," + y;

// dice a sorted list of contiguous-or-not integer cell positions into
// running-bond bricks on the GLOBAL stud grid, phase = course%2 (so joints
// stagger by 1 stud between courses everywhere, independent of which run
// or wall a cell came from)
function tileAxis(cellsByLine, course) {
  const phase = course % 2;
  const segs = []; // [lineCoord, a, b] where brick spans stud units [a,b)
  for (const [line, xs] of cellsByLine) {
    xs.sort((p, q) => p - q);
    let runStart = null, prev = null;
    const flush = (a, b) => {
      // brick boundaries are the unit-cell edges; a cell at integer p covers
      // stud-length [p, p+1). Cut the [a, b+1) range on the global 2-stud
      // grid offset by `phase`.
      const lo = a, hi = b + 1;
      const cuts = new Set([lo, hi]);
      let n = Math.ceil((lo - phase) / 2) * 2 + phase;
      for (; n < hi; n += 2) if (n > lo) cuts.add(n);
      const pts = Array.from(cuts).sort((x, y) => x - y);
      for (let i = 0; i < pts.length - 1; i++) {
        if (pts[i + 1] > pts[i]) segs.push([line, pts[i], pts[i + 1]]);
      }
    };
    for (const x of xs) {
      if (runStart === null) { runStart = x; prev = x; continue; }
      if (x === prev + 1) { prev = x; continue; }
      flush(runStart, prev);
      runStart = x; prev = x;
    }
    if (runStart !== null) flush(runStart, prev);
  }
  return segs;
}

function addBrick(orient, line, a, b, course) {
  const len = b - a;
  const zHalf = COURSE_H / 2;
  const z = BASE_Z + course * COURSE_H;
  const xHalf = orient === "H" ? (len * STUD) / 2 : (WALL_THICKNESS * STUD) / 2;
  const yHalf = orient === "H" ? (WALL_THICKNESS * STUD) / 2 : (len * STUD) / 2;
  const x = orient === "H" ? ((a + b) / 2) * STUD : line * STUD;
  const y = orient === "H" ? line * STUD : ((a + b) / 2) * STUD;
  bricks.push({ x, y, z, sx: xHalf, sy: yHalf, sz: zHalf, course, orient, a, b, line });
}

for (let course = 0; course < WALL_COURSES; course++) {
  // hTouch/vTouch: which grid cells this course's H/V runs occupy (open
  // door/window spans excluded up front)
  const hTouch = new Set(), vTouch = new Set();
  for (const run of finalRuns) {
    const target = run.orient === "H" ? hTouch : vTouch;
    for (let p = run.start; p <= run.end; p++) {
      const open = run.openings.some((o) => courseIsOpen(o, course) && p >= o.pos0 && p < o.pos1);
      if (open) continue;
      const [x, y] = run.orient === "H" ? [p, run.line] : [run.line, p];
      target.add(key(x, y));
    }
  }

  const hCellsByRow = new Map(); // y -> [x,...]
  const vCellsByCol = new Map(); // x -> [y,...]
  const allCells = new Set([...hTouch, ...vTouch]);
  for (const k of allCells) {
    const [x, y] = k.split(",").map(Number);
    const inH = hTouch.has(k), inV = vTouch.has(k);
    let axis;
    if (inH && !inV) axis = "H";
    else if (inV && !inH) axis = "V";
    else axis = course % 2 === 0 ? "H" : "V"; // junction: alternate by course
    if (axis === "H") {
      if (!hCellsByRow.has(y)) hCellsByRow.set(y, []);
      hCellsByRow.get(y).push(x);
    } else {
      if (!vCellsByCol.has(x)) vCellsByCol.set(x, []);
      vCellsByCol.get(x).push(y);
    }
  }

  for (const [line, a, b] of tileAxis(hCellsByRow, course)) addBrick("H", line, a, b, course);
  for (const [line, a, b] of tileAxis(vCellsByCol, course)) addBrick("V", line, a, b, course);
}

console.error(`generated ${bricks.length} bricks across ${finalRuns.length} wall runs`);

// ------------------------------------------------------------- write .brs --
const saveObject = {
  version: 10,
  game_version: 0,
  map: "Plate",
  author: { id: "00000000-0000-0000-0000-000000000000", name: "Claude" },
  host: { id: "00000000-0000-0000-0000-000000000000", name: "Claude" },
  description: "Generated brick walls from floor plan sketch",
  save_time: [0, 0, 0, 0, 0, 0, 0, 0],
  mods: [],
  brick_assets: ["PB_DefaultBrick"],
  colors: [WALL_COLOR],
  materials: ["BMC_Plastic"],
  physical_materials: ["BPMC_Default"],
  brick_owners: [{ id: "00000000-0000-0000-0000-000000000000", name: "Claude", display_name: "Claude", bricks: bricks.length }],
  brick_count: bricks.length,
  bricks: bricks.map((b) => ({
    asset_name_index: 0,
    size: [b.sx, b.sy, b.sz],
    position: [b.x, b.y, b.z],
    direction: 4,
    rotation: 0,
    collision: true,
    visibility: true,
    material_index: 0,
    physical_index: 0,
    material_intensity: 0,
    color: 0,
    owner_index: 1,
  })),
};

const buf = brs.write(saveObject);
fs.writeFileSync("jail_walls.brs", Buffer.from(buf));
console.error(`wrote jail_walls.brs (${buf.length} bytes)`);

// Current Brickadia clients load the newer .brz/.brdb database format from
// Saved/Builds, not legacy .brs -- write that too, from the same save object.
const brzBuf = brs.writeBrzLegacy(saveObject);
fs.writeFileSync("jail_walls.brz", Buffer.from(brzBuf));
console.error(`wrote jail_walls.brz (${brzBuf.length} bytes)`);

if (process.env.DEBUG_DUMP) {
  fs.writeFileSync("bricks_debug.json", JSON.stringify(bricks));
  console.error("wrote bricks_debug.json");
}
