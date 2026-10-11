// Pure brick-laying logic, extracted from 05_generate_brick_walls.js so it
// can be unit tested without going through image extraction or file I/O.
// See PIPELINE.md for the design rationale (shared-grid domino tiling).

const DOOR_MAX_COURSES = 6; // cap on door height, courses (owner 2026-10-10: "never greater than 6")
const CONFIG = {
  SCALE: 1,               // studs per source-image pixel
  STUD: 10,                // world units per stud
  COURSE_H: 12,            // world units per course (1 standard brick tall)
  WALL_COURSES: 6,         // total courses per wall
  DOOR_OPEN_COURSES: 3,    // bottom N courses left open for doors
  WINDOW_SILL_COURSES: 2,  // solid courses below a window
  WINDOW_OPEN_COURSES: 2,  // open courses for the window itself (band)
  WALL_THICKNESS: 1,       // stud
  CORNER_SNAP: 10,         // studs, endpoint-matching tolerance
  MARGIN: 20,              // studs of empty space kept around the plan
  FLOOR_H: 4,              // world units, floor plate thickness (1 plate = 1/3 brick)
  FLOOR_MAX: 32,           // studs, longest side of one floor/ceiling/roof plate
  FLOOR_STYLE: "planks",   // "planks" (1-stud boards, staggered joints) or "tiles" (greedy plates)
  PLANK_MAX: 12,           // studs, longest board (a row's last board may run up to PLANK_MAX+2)
  STOREYS: 1,              // storeys stacked on the plan, each WALL_COURSES tall
  CEILING_H: 4,            // world units, ceiling plate thickness
  CEILING_DROP: 0,         // courses the top storey's ceiling hangs below the wall top
  ROOF_H: 4,               // world units per roof layer
  ROOF_OVERHANG: 1,        // studs the roof reaches past the outer walls
  ROOF_STEP: 0,            // studs each roof layer steps in; 0 = one flat layer
  ROOF_LAYERS: 40,         // most layers a stepped roof stacks before it flattens off
  STAIR_WIDTH: 3,          // studs, width of one flight
  STAIR_RISE: 4,           // world units per step; must divide the storey height
  STAIR_RUN: 1,            // studs of tread per step
  STAIR_LANDING: 1,        // studs of landing at each end of a flight (owner 2026-10-05: 3, i.e. 3x3)
  STAIR_TREADS: false,     // true: steps are treads one rise thick and the floor stays under the flight
  STAIR_AVOID_WINDOWS: false, // true: no flight cell beside a window opening
};
CONFIG.BASE_Z = CONFIG.COURSE_H / 2; // center of the first course, ground = z 0

// Snap to the nearest EVEN stud, not just the nearest integer stud. The
// pixel:stud:brick-pair ratio is 1:1:2 -- bricks tile in 2-stud pairs, so
// a wall coordinate landing on an odd stud guarantees a leftover 1-stud
// filler at that boundary. Snapping to even keeps boundaries aligned to
// the same grid the domino tiling actually cuts on.
function toStud(px, scale = CONFIG.SCALE) {
  return 2 * Math.round((px * scale) / 2);
}

// Convert raw {orient,line,start,end,openings} runs (in source-image pixel
// units) into integer stud space, offset so everything sits MARGIN studs
// clear of (0,0).
function normalizeRuns(runs, config = CONFIG) {
  let minX = Infinity, minY = Infinity;
  const runs2 = runs.map((r) => {
    const start = toStud(r.start, config.SCALE);
    const end = toStud(r.end, config.SCALE);
    const line = toStud(r.line, config.SCALE);
    const openings = r.openings.map((o) => ({
      pos0: toStud(o.pos0, config.SCALE), pos1: toStud(o.pos1, config.SCALE), type: o.type,
    }));
    if (r.orient === "H") { minX = Math.min(minX, start, end); minY = Math.min(minY, line); }
    else { minX = Math.min(minX, line); minY = Math.min(minY, start, end); }
    return { orient: r.orient, line, start, end, openings };
  });
  const OFFX = config.MARGIN - minX;
  const OFFY = config.MARGIN - minY;
  return runs2.map((r) => {
    if (r.orient === "H") {
      return {
        orient: "H",
        line: r.line + OFFY,
        start: r.start + OFFX,
        end: r.end + OFFX,
        openings: r.openings.map((o) => ({ pos0: o.pos0 + OFFX, pos1: o.pos1 + OFFX, type: o.type })),
      };
    }
    return {
      orient: "V",
      line: r.line + OFFX,
      start: r.start + OFFY,
      end: r.end + OFFY,
      openings: r.openings.map((o) => ({ pos0: o.pos0 + OFFY, pos1: o.pos1 + OFFY, type: o.type })),
    };
  });
}

function endpoints(r) {
  if (r.orient === "H") return [[r.start, r.line], [r.end, r.line]];
  return [[r.line, r.start], [r.line, r.end]];
}

// For one run end, find every perpendicular run within CORNER_SNAP and
// return the CLOSEST one (a tip-to-tip "corner" match wins ties over a
// "tjunction" match). Returns {kind:'dangling'} if nothing is close enough.
//
// Regression note: this used to return the FIRST candidate found, not the
// closest. In a floor plan with several walls close together most
// endpoints have multiple candidates within tolerance, and taking the
// first one (arbitrary iteration order) frequently picked an unrelated
// wall -- see PIPELINE.md.
function classifyEnd(run, whichEnd, allRuns, config = CONFIG) {
  const [ex, ey] = endpoints(run)[whichEnd];
  // The opposite end's raw coordinate along this run's own axis. A snap
  // candidate MUST land strictly on the far side of it -- otherwise, on a
  // run shorter than 2*CORNER_SNAP, both ends can reach the SAME nearby
  // through-wall (one at distance 0, the other within the widened
  // tolerance) and collapse the run to zero length. Found via an 8-stud
  // run whose far end snapped onto the same through-wall its near end was
  // already touching -- see PIPELINE.md.
  const oppositeRaw = whichEnd === 0 ? run.end : run.start;
  const onFarSide = (line) => (whichEnd === 0 ? line < oppositeRaw : line > oppositeRaw);
  // A wall can't structurally anchor into another wall's door/window hole --
  // that's not a real connection, it's just a branch's raw extracted
  // position happening to fall inside a (possibly quite wide, up to 30+
  // studs) opening on the through-wall. Left unchecked, this produced
  // floating/extending brick geometry right at doors and windows: found by
  // scanning every T-junction candidate for one landing inside the
  // through-wall's own opening span (13 cases in this floor plan), and
  // confirmed against user-circled screenshots. See PIPELINE.md.
  const insideOpening = (wall, pos) => wall.openings.some((o) => pos >= o.pos0 && pos < o.pos1);
  const candidates = [];
  for (const other of allRuns) {
    if (other === run) continue;
    if (other.orient === run.orient) continue; // only perpendicular walls interlock
    if (!onFarSide(other.line)) continue;
    const [a, b] = endpoints(other);
    for (const p of [a, b]) {
      const d = Math.hypot(p[0] - ex, p[1] - ey);
      const tipPos = other.orient === "H" ? p[0] : p[1]; // p IS other's own tip -- not inside its span
      if (Math.abs(p[0] - ex) <= config.CORNER_SNAP && Math.abs(p[1] - ey) <= config.CORNER_SNAP &&
          !insideOpening(other, tipPos)) {
        candidates.push({ kind: "corner", other, dist: d });
      }
    }
    if (other.orient === "H" && Math.abs(other.line - ey) <= config.CORNER_SNAP &&
        ex > other.start + config.CORNER_SNAP && ex < other.end - config.CORNER_SNAP &&
        !insideOpening(other, ex)) {
      candidates.push({ kind: "tjunction", other, dist: Math.abs(other.line - ey) });
    }
    if (other.orient === "V" && Math.abs(other.line - ex) <= config.CORNER_SNAP &&
        ey > other.start + config.CORNER_SNAP && ey < other.end - config.CORNER_SNAP &&
        !insideOpening(other, ey)) {
      candidates.push({ kind: "tjunction", other, dist: Math.abs(other.line - ex) });
    }
  }
  if (candidates.length === 0) return { kind: "dangling" };
  candidates.sort((a, b) => a.dist - b.dist || (a.kind === "corner" ? -1 : 1));
  return candidates[0];
}

// CORNER_SNAP only decides whether two walls count as "meeting" -- this
// makes them actually meet at the same coordinate by snapping each
// connected endpoint onto the other wall's centerline. Mutates and also
// returns `runs`. See PIPELINE.md for why this matters (hand-drawn
// corners are rarely pixel-perfect).
function snapEndpoints(runs, config = CONFIG) {
  const endInfo = runs.map((r) => [classifyEnd(r, 0, runs, config), classifyEnd(r, 1, runs, config)]);
  runs.forEach((r, i) => {
    const [info0, info1] = endInfo[i];
    if (info0.other) r.start = info0.other.line;
    if (info1.other) r.end = info1.other.line;
  });
  resolveOpeningConflicts(runs, config);
  return runs;
}

// classifyEnd rejecting a candidate only stops snapEndpoints from actively
// creating a connection into an opening -- it does NOT undo a coincidence
// that already exists in the raw extracted data. A run whose end lands
// 'dangling' keeps its ORIGINAL coordinate, and if that coordinate already
// happened to sit exactly on a perpendicular wall's line (distance 0, the
// single most common case -- no snapping needed because the drawing was
// already precise there), it still geometrically touches that wall, inside
// its opening, regardless of what classifyEnd decided. Declining to endorse
// a connection is not the same as removing it. This actively retracts any
// endpoint still touching another wall's opening after snapping, by 2
// studs (keeping it on the even-stud grid), which is the only way to
// satisfy "this cannot happen even once" rather than "classifyEnd doesn't
// cause it." Runs repeatedly since one retraction cannot, by construction,
// create a new touch (it only ever shortens a run).
function resolveOpeningConflicts(runs, config = CONFIG) {
  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < 10) {
    changed = false;
    for (const r of runs) {
      const ends = r.orient === "H" ? [[r.start, r.line], [r.end, r.line]] : [[r.line, r.start], [r.line, r.end]];
      for (const [whichEnd, [ex, ey]] of ends.entries()) {
        for (const other of runs) {
          if (other === r || other.orient === r.orient) continue;
          const onOtherLine = other.orient === "H" ? ey === other.line : ex === other.line;
          if (!onOtherLine) continue;
          const pos = other.orient === "H" ? ex : ey;
          if (pos < other.start || pos > other.end) continue;
          if (other.openings.some((o) => pos >= o.pos0 && pos < o.pos1)) {
            if (whichEnd === 0) r.start += 2; else r.end -= 2;
            changed = true;
          }
        }
      }
    }
  }
}

const totalCourses = (config = CONFIG) => config.WALL_COURSES * (config.STOREYS || 1);
const storeyHeight = (config = CONFIG) => config.WALL_COURSES * config.COURSE_H;

// Every storey repeats the same door/window banding, counted from its own
// floor. The one exception: an exterior door (markBuildings sets
// `exterior`) is solid wall above the ground storey -- upstairs it would open
// onto a drop.
function courseIsOpen(opening, course, config = CONFIG) {
  const storey = Math.floor(course / config.WALL_COURSES);
  const c = course % config.WALL_COURSES;
  // doors are never more than DOOR_MAX_COURSES tall, whatever a caller asks for (owner 2026-10-10)
  if (opening.type === "door") return c < Math.min(config.DOOR_OPEN_COURSES, DOOR_MAX_COURSES) && !(storey > 0 && opening.exterior);
  return c >= config.WINDOW_SILL_COURSES && c < config.WINDOW_SILL_COURSES + config.WINDOW_OPEN_COURSES;
}

// Above the first storey, only building walls keep going up. A wall that
// encloses nothing (the jail's perimeter fence) stays one storey tall.
// markBuildings fills `run.upper` with the stud positions that belong to a
// building; a run it hasn't seen stacks every cell, as before.
function standsAt(run, p, course, config = CONFIG) {
  return course < config.WALL_COURSES || !run.upper || run.upper.has(p);
}

// Dice a Map of line-coordinate -> [integer cell positions] into
// running-bond bricks on the GLOBAL stud grid, phase = course % 2 (so
// joints stagger by 1 stud between courses everywhere, independent of
// which run or wall a cell came from). Returns [[line, a, b], ...] where
// each brick spans stud units [a, b).
function tileAxis(cellsByLine, course) {
  const phase = course % 2;
  const segs = [];
  for (const [line, xsIn] of cellsByLine) {
    const xs = [...xsIn].sort((p, q) => p - q);
    let runStart = null, prev = null;
    const flush = (a, b) => {
      const lo = a, hi = b + 1;
      const cuts = new Set([lo, hi]);
      let n = Math.ceil((lo - phase) / 2) * 2 + phase;
      for (; n < hi; n += 2) if (n > lo) cuts.add(n);
      const pts = [...cuts].sort((x, y) => x - y);
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

const cellKey = (x, y) => x + "," + y;

// Per-course shared-grid domino tiling. See PIPELINE.md's Stage 5 section
// for the full design rationale. Returns a flat array of stud-space brick
// descriptors: {orient, line, a, b, course}.
function layoutCourse(runs, course, config = CONFIG) {
  return layoutCells(runs, course, config,
    (run, p) => standsAt(run, p, course, config) && !cellIsOpen(run, p, course, config));
}

// True when stud `p` of `run` falls inside an opening that is open at this
// course -- i.e. the cell is a hole in the wall, not brick.
function cellIsOpen(run, p, course, config = CONFIG) {
  return run.openings.some((o) => courseIsOpen(o, course, config) && p >= o.pos0 && p < o.pos1);
}

// Window panes fill exactly the cells a *window* opening leaves empty on the
// courses that opening is open at -- the complement of layoutCourse's wall
// cells, restricted to type "window" (doors stay empty; you walk through
// them). Tiled on the same shared grid as the brickwork, so a pane's joints
// line up with the courses around it instead of being one giant slab.
function layoutGlassCourse(runs, course, config = CONFIG) {
  return layoutCells(runs, course, config, (run, p) =>
    standsAt(run, p, course, config) &&
    run.openings.some((o) => o.type === "window" && courseIsOpen(o, course, config) &&
                             p >= o.pos0 && p < o.pos1));
}

function layWindowGlass(runs, config = CONFIG) {
  const out = [];
  for (let course = 0; course < totalCourses(config); course++) {
    out.push(...layoutGlassCourse(runs, course, config));
  }
  return out;
}

// Shared body of layoutCourse/layoutGlassCourse: gather every cell
// `wantCell(run, pos)` accepts into the one per-course grid, resolve
// H/V ownership at junction cells, then run the domino tiling.
function layoutCells(runs, course, config, wantCell) {
  const hTouch = new Set(), vTouch = new Set();
  for (const run of runs) {
    const target = run.orient === "H" ? hTouch : vTouch;
    for (let p = run.start; p <= run.end; p++) {
      if (!wantCell(run, p)) continue;
      const [x, y] = run.orient === "H" ? [p, run.line] : [run.line, p];
      target.add(cellKey(x, y));
    }
  }

  const hCellsByRow = new Map();
  const vCellsByCol = new Map();
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

  const hSegs = mergeSlivers(bridgeJunctions(tileAxis(hCellsByRow, course), hTouch, vTouch, course % 2 === 0, (line, p) => cellKey(p, line)));
  const vSegs = mergeSlivers(bridgeJunctions(tileAxis(vCellsByCol, course), hTouch, vTouch, course % 2 !== 0, (line, p) => cellKey(line, p)));
  const out = [];
  for (const [line, a, b] of hSegs) out.push({ orient: "H", line, a, b, course });
  for (const [line, a, b] of vSegs) out.push({ orient: "V", line, a, b, course });
  return out;
}

// On the courses where a wall owns a junction cell, the perpendicular wall's
// own courses leave joints on both sides of that cell (its brick ends there),
// and a 2-stud domino always has an edge on one of those two lines -- so a T
// showed a straight vertical joint up every course on the through-wall's far
// face. Join the domino over the junction with its neighbour on the side of
// that edge so the junction sits inside one brick (3-4 studs); corners, with
// nothing beyond the end, are left as they are.
// A 1-stud filler (next to a junction stud the other wall took this course,
// or at an opening edge) joins the brick before it, or after it when nothing
// is before it, so no thin sliver sits beside the cross wall's 1-stud end.
function mergeSlivers(segs) {
  const byLine = new Map();
  for (const s of segs) (byLine.get(s[0]) ?? byLine.set(s[0], []).get(s[0])).push([...s]);
  const out = [];
  for (const list of byLine.values()) {
    list.sort((p, q) => p[1] - q[1]);
    const kept = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i], prev = kept[kept.length - 1], next = list[i + 1];
      if (s[2] - s[1] === 1 && prev && prev[2] === s[1]) prev[2] = s[2];
      else if (s[2] - s[1] === 1 && next && next[1] === s[2]) next[1] = s[1];
      else kept.push(s);
    }
    out.push(...kept);
  }
  return out;
}

function bridgeJunctions(segs, hTouch, vTouch, owns, key) {
  if (!owns) return segs;
  const byLine = new Map();
  for (const s of segs) (byLine.get(s[0]) ?? byLine.set(s[0], []).get(s[0])).push(s);
  const out = [];
  for (const [line, list] of byLine) {
    list.sort((p, q) => p[1] - q[1]);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s) continue;
      for (let p = s[1]; p < s[2]; p++) {
        const k = key(line, p);
        if (!(hTouch.has(k) && vTouch.has(k))) continue;
        const prev = out[out.length - 1], next = list[i + 1];
        if (p === s[1] && prev && prev[0] === line && prev[2] === s[1]) { prev[2] = s[2]; list[i] = null; break; }
        if (p === s[2] - 1 && next && next[1] === s[2]) { next[1] = s[1]; list[i] = null; break; }
      }
      if (list[i]) out.push(s);
    }
  }
  return out;
}

// ------------------------------------------------------------------ floors --
// A floor goes wherever the walls enclose: flood-fill the stud grid from
// outside the plan's bounding box, with every cell of every run (openings
// included -- a doorway is a gap in the brick, not in the room's boundary)
// blocking the fill. Whatever the fill can't reach is inside a room. A wall
// line the drawing leaves open (the jail's perimeter fence) encloses nothing,
// so it gets no floor, and neither does the yard between buildings.
//
// Door cells are then floored too when they open onto a room, so there's no
// 1-stud trench across every doorway. Only cells with no brick at course 0
// qualify: a door open at ground level, not claimed by a crossing wall.
//
// `course` is the storey's bottom course (storey * WALL_COURSES): an upper
// storey floors the doorways that are open at ITS floor level, which leaves
// out exterior doors (solid up there -- see courseIsOpen).
function floorCells(runs, config = CONFIG, course = 0, encl = enclosure(runs)) {
  const floor = new Set(encl.interior);
  const groundBrick = new Set();
  for (const b of layoutCourse(runs, course, config)) {
    for (let p = b.a; p < b.b; p++) groundBrick.add(b.orient === "H" ? cellKey(p, b.line) : cellKey(b.line, p));
  }
  const doorway = [];
  for (const r of runs) {
    for (const o of r.openings) {
      if (o.type !== "door" || !courseIsOpen(o, course, config)) continue;
      for (let p = Math.max(o.pos0, r.start); p < Math.min(o.pos1, r.end + 1); p++) {
        const [x, y] = r.orient === "H" ? [p, r.line] : [r.line, p];
        if (groundBrick.has(cellKey(x, y))) continue;
        const across = r.orient === "H" ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
        if (across.some(([ax, ay]) => encl.interior.has(cellKey(ax, ay)))) doorway.push(cellKey(x, y));
      }
    }
  }
  for (const k of doorway) floor.add(k);
  return floor;
}

// The room analysis floors, ceilings, roofs and stairs all share: which stud
// cells are wall, which the outside can reach, and which are inside a room.
function enclosure(runs) {
  const wall = new Set();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of runs) {
    for (let p = r.start; p <= r.end; p++) {
      const [x, y] = r.orient === "H" ? [p, r.line] : [r.line, p];
      wall.add(cellKey(x, y));
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (wall.size === 0) return { wall, outside: new Set(), interior: new Set() };
  minX--; minY--; maxX++; maxY++;

  const outside = new Set([cellKey(minX, minY)]);
  const stack = [[minX, minY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const k = cellKey(nx, ny);
      if (outside.has(k) || wall.has(k)) continue;
      outside.add(k);
      stack.push([nx, ny]);
    }
  }

  const interior = new Set();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const k = cellKey(x, y);
      if (!wall.has(k) && !outside.has(k)) interior.add(k);
    }
  }
  return { wall, outside, interior };
}

const NEIGHBOURS_8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const nearInterior = (encl, x, y) => NEIGHBOURS_8.some(([dx, dy]) => encl.interior.has(cellKey(x + dx, y + dy)));

// Tag runs with what multi-storey building needs to know, from the enclosure:
//   run.upper      stud positions whose cell touches a room (8-neighbour), i.e.
//                  building wall. Only these carry on above the first storey,
//                  so a fence that T-joins a building stops at one storey while
//                  the building's own wall (including the junction cell) goes up.
//   opening.exterior  a door with the outside on either side of it.
// Mutates the runs; returns the enclosure.
function markBuildings(runs) {
  const encl = enclosure(runs);
  for (const r of runs) {
    r.upper = new Set();
    for (let p = r.start; p <= r.end; p++) {
      const [x, y] = r.orient === "H" ? [p, r.line] : [r.line, p];
      if (nearInterior(encl, x, y)) r.upper.add(p);
    }
    for (const o of r.openings) {
      o.exterior = false;
      for (let p = o.pos0; p < o.pos1 && !o.exterior; p++) {
        const across = r.orient === "H" ? [[p, r.line - 1], [p, r.line + 1]] : [[r.line - 1, p], [r.line + 1, p]];
        o.exterior = across.some(([x, y]) => encl.outside.has(cellKey(x, y)));
      }
    }
  }
  return encl;
}

// ------------------------------------------------------------------- roofs --
// The roof covers each building: its rooms plus the walls around them (wall
// cells touching a room -- never a fence), widened by ROOF_OVERHANG studs.
// Two buildings closer than twice the overhang share one roof.
function roofFootprint(encl, config = CONFIG) {
  const cells = new Set(encl.interior);
  for (const k of encl.wall) {
    const [x, y] = k.split(",").map(Number);
    if (nearInterior(encl, x, y)) cells.add(k);
  }
  for (let i = 0; i < config.ROOF_OVERHANG; i++) {
    for (const k of [...cells]) {
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of NEIGHBOURS_8) cells.add(cellKey(x + dx, y + dy));
    }
  }
  return cells;
}

// Flat roof: one layer. Stepped roof: layer k keeps the cells at least
// k * ROOF_STEP + 1 studs (chessboard distance) from the footprint's edge, so
// a rectangle becomes a stepped hip roof and any other outline steps in
// evenly from every side. Each layer is a subset of the one below it, so
// every layer is fully supported.
function roofLayers(footprint, config = CONFIG) {
  if (!(config.ROOF_STEP > 0)) return footprint.size ? [footprint] : [];
  const dist = new Map();
  let frontier = [];
  for (const k of footprint) {
    const [x, y] = k.split(",").map(Number);
    if (NEIGHBOURS_8.some(([dx, dy]) => !footprint.has(cellKey(x + dx, y + dy)))) {
      dist.set(k, 1);
      frontier.push([x, y]);
    }
  }
  for (let d = 2; frontier.length; d++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of NEIGHBOURS_8) {
        const k = cellKey(x + dx, y + dy);
        if (!footprint.has(k) || dist.has(k)) continue;
        dist.set(k, d);
        next.push([x + dx, y + dy]);
      }
    }
    frontier = next;
  }
  const layers = [];
  for (let k = 0; k < config.ROOF_LAYERS; k++) {
    const layer = new Set();
    for (const [c, d] of dist) if (d > k * config.ROOF_STEP) layer.add(c);
    if (layer.size === 0) break;
    layers.push(layer);
  }
  return layers;
}

// ------------------------------------------------------------------ stairs --
// A drawing has no stairs in it, so they're placed, not traced: one stair
// stack per building, in the rectangle that fits it best.
//
// The rectangle is 2 flights wide (2 * STAIR_WIDTH) and n treads long plus one
// landing row at each end, n = storey height / STAIR_RISE. Flights switch
// back: storey 0's flight climbs strip A from the near end, storey 1's climbs
// strip B from the far end (where A arrived), and so on. Each flight is a hole
// in the floor above it, so there's a full storey of headroom over every step,
// and the flight in the strip next door is the floor you step off onto.
//
// Every cell of the rectangle must be room interior (so it lies in one room
// and never on a wall) and no cell may be next to a doorway. Among the places
// that fit, the one hugging the most wall along a long side wins; ties go to
// the lowest y, then x, so the choice is deterministic.
function placeStairs(runs, encl, config = CONFIG) {
  const n = storeyHeight(config) / config.STAIR_RISE;
  const W = config.STAIR_WIDTH;
  const LAND = config.STAIR_LANDING ?? 1;
  const L = n * config.STAIR_RUN + 2 * LAND;
  const buildings = buildingComponents(encl);
  if (buildings.length === 0) return { flights: [], buildings: 0, unplaced: [] };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of encl.interior) {
    const [x, y] = k.split(",").map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const doorAdj = new Set();
  for (const r of runs) {
    for (const o of r.openings) {
      if (o.type !== "door" && !(o.type === "window" && config.STAIR_AVOID_WINDOWS)) continue;
      for (let p = o.pos0; p < o.pos1; p++) {
        const [x, y] = r.orient === "H" ? [p, r.line] : [r.line, p];
        for (const [dx, dy] of NEIGHBOURS_8) doorAdj.add(cellKey(x + dx, y + dy));
      }
    }
  }
  // Summed-area tables over the interior bbox (+1 border for the wall test):
  // `ok` counts usable cells, `wall` counts wall cells.
  const X0 = minX - 1, Y0 = minY - 1, GW = maxX - minX + 3, GH = maxY - minY + 3;
  const sat = (fn) => {
    const t = new Int32Array((GW + 1) * (GH + 1));
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const v = fn(cellKey(X0 + i, Y0 + j)) ? 1 : 0;
        t[(j + 1) * (GW + 1) + i + 1] = v + t[j * (GW + 1) + i + 1] + t[(j + 1) * (GW + 1) + i] - t[j * (GW + 1) + i];
      }
    }
    // cells in [x0, x1) x [y0, y1), world stud coordinates
    return (x0, y0, x1, y1) => {
      const a = Math.max(0, x0 - X0), b = Math.max(0, y0 - Y0);
      const c = Math.min(GW, x1 - X0), d = Math.min(GH, y1 - Y0);
      if (c <= a || d <= b) return 0;
      return t[d * (GW + 1) + c] - t[b * (GW + 1) + c] - t[d * (GW + 1) + a] + t[b * (GW + 1) + a];
    };
  };
  const okSum = sat((k) => encl.interior.has(k) && !doorAdj.has(k));
  const wallSum = sat((k) => encl.wall.has(k));

  const best = new Map(); // building index -> candidate
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const b = buildings.index.get(cellKey(x, y));
      if (b === undefined) continue;
      for (const axis of ["x", "y"]) {
        const [w, h] = axis === "x" ? [L, 2 * W] : [2 * W, L];
        if (okSum(x, y, x + w, y + h) !== w * h) continue;
        const score = axis === "x"
          ? Math.max(wallSum(x, y - 1, x + w, y), wallSum(x, y + h, x + w, y + h + 1))
          : Math.max(wallSum(x - 1, y, x, y + h), wallSum(x + w, y, x + w + 1, y + h));
        const cur = best.get(b);
        if (!cur || score > cur.score) best.set(b, { x0: x, y0: y, x1: x + w, y1: y + h, axis, score });
      }
    }
  }

  const flights = [];
  const unplaced = [];
  buildings.list.forEach((cells, b) => {
    const s = best.get(b);
    if (!s) {
      const [x, y] = cells[0].split(",").map(Number);
      unplaced.push({ building: b, x, y });
      return;
    }
    for (let storey = 0; storey + 1 < config.STOREYS; storey++) {
      flights.push({ building: b, storey, strip: storey % 2, rect: s, n, land: LAND });
    }
  });
  return { flights, buildings: buildings.list.length, unplaced };
}

// Rooms joined through the walls between them: 4-connected components of
// (interior + wall cells touching a room). One of these is one building.
function buildingComponents(encl) {
  const cells = new Set(encl.interior);
  for (const k of encl.wall) {
    const [x, y] = k.split(",").map(Number);
    if (nearInterior(encl, x, y)) cells.add(k);
  }
  const index = new Map();
  const list = [];
  for (const start of [...encl.interior].sort()) {
    if (index.has(start)) continue;
    const id = list.length;
    const members = [];
    const stack = [start];
    index.set(start, id);
    while (stack.length) {
      const k = stack.pop();
      if (encl.interior.has(k)) members.push(k);
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = cellKey(x + dx, y + dy);
        if (!cells.has(nk) || index.has(nk)) continue;
        index.set(nk, id);
        stack.push(nk);
      }
    }
    list.push(members.sort());
  }
  return { index, list, length: list.length };
}

// Cells of one flight's treads (landing rows excluded) and its step boxes.
// Along the long axis, offset 0 and L-1 are the landings; tread i (1..n)
// of strip A sits at offset 1 + (i-1)*RUN, strip B runs the other way.
function flightCells(f, config = CONFIG) {
  const { rect, strip } = f;
  const out = new Set();
  const W = config.STAIR_WIDTH;
  const LAND = f.land ?? 1;
  for (let a = LAND; a < LAND + f.n * config.STAIR_RUN; a++) {
    for (let c = strip * W; c < (strip + 1) * W; c++) {
      out.add(rect.axis === "x" ? cellKey(rect.x0 + a, rect.y0 + c) : cellKey(rect.x0 + c, rect.y0 + a));
    }
  }
  return out;
}

function flightSteps(f, config, floorH) {
  const { rect, strip, storey, n } = f;
  const W = config.STAIR_WIDTH, R = config.STAIR_RUN;
  const base = storey * storeyHeight(config);
  const steps = [];
  for (let i = 1; i <= n; i++) {
    const LAND = f.land ?? 1;
    const a0 = strip === 0 ? LAND + (i - 1) * R : LAND + (n - i) * R;
    const [c0, c1] = [strip * W, (strip + 1) * W];
    const box = rect.axis === "x"
      ? { x0: rect.x0 + a0, x1: rect.x0 + a0 + R, y0: rect.y0 + c0, y1: rect.y0 + c1 }
      : { x0: rect.x0 + c0, x1: rect.x0 + c1, y0: rect.y0 + a0, y1: rect.y0 + a0 + R };
    // The top step lands flush with the next storey's floor surface.
    const z1 = base + floorH + i * config.STAIR_RISE;
    steps.push({ kind: "stair", ...box, z0: config.STAIR_TREADS ? z1 - config.STAIR_RISE : base, z1 });
  }
  return steps;
}

// ---------------------------------------------------------------- building --
// Settings the whole building has to agree on before anything is laid.
// Returns human-readable errors; stage 5 and the GUI preview both refuse on any.
function checkConfig(config = CONFIG, opts = {}) {
  const errors = [];
  const evenPositive = (k) => {
    if (!(Number.isInteger(config[k]) && config[k] > 0 && config[k] % 2 === 0)) {
      errors.push(`${k} must be a positive even integer (got ${config[k]})`);
    }
  };
  const intAtLeast = (k, lo) => {
    if (!(Number.isInteger(config[k]) && config[k] >= lo)) errors.push(`${k} must be an integer >= ${lo} (got ${config[k]})`);
  };
  intAtLeast("STOREYS", 1);
  if (opts.floor || opts.stairs) evenPositive("FLOOR_H");
  if (opts.floor || opts.ceiling || opts.roof) intAtLeast("FLOOR_MAX", 1);
  if (opts.ceiling) {
    evenPositive("CEILING_H");
    intAtLeast("CEILING_DROP", 0);
    const top = config.STOREYS * storeyHeight(config) - config.CEILING_DROP * config.COURSE_H;
    const floorTop = (config.STOREYS - 1) * storeyHeight(config) + (opts.floor ? config.FLOOR_H : 0);
    if (top - config.CEILING_H < floorTop) {
      errors.push(`ceiling drop ${config.CEILING_DROP} puts the ceiling below the top storey's floor`);
    }
  }
  if (opts.roof) {
    evenPositive("ROOF_H");
    intAtLeast("ROOF_OVERHANG", 0);
    intAtLeast("ROOF_STEP", 0);
    intAtLeast("ROOF_LAYERS", 1);
  }
  if (opts.stairs && config.STOREYS > 1) {
    evenPositive("STAIR_RISE");
    intAtLeast("STAIR_WIDTH", 1);
    intAtLeast("STAIR_RUN", 1);
    if (storeyHeight(config) % config.STAIR_RISE !== 0) {
      errors.push(`STAIR_RISE ${config.STAIR_RISE} must divide the storey height ` +
                  `(${config.WALL_COURSES} courses x ${config.COURSE_H} = ${storeyHeight(config)}) so the top step meets the floor`);
    }
  }
  return errors;
}

// Everything in the save besides the walls' colours, in stud space: wall and
// pane brick descriptors (as layBricks/layWindowGlass return them) plus
// `slabs`, boxes {kind, x0, y0, x1, y1, z0, z1} with x/y in studs (half-open)
// and z in world units. Stage 5 and the GUI preview both build from this, so
// the preview can't drift from the save.
//
//   opts: { glass, floor, ceiling, roof, stairs }
//
// Floors go in every storey. A storey's floor skips the treads of the flight
// that starts on it and of the flight arriving from below (that one's
// stairwell). The ceiling is the top storey's only; lower storeys' ceilings
// are the floor above. The roof sits on the wall top.
function buildModel(runs, config = CONFIG, opts = {}) {
  const errors = checkConfig(config, opts);
  if (errors.length) throw new Error("bad settings:\n  - " + errors.join("\n  - "));
  const encl = markBuildings(runs);
  const walls = layBricks(runs, config);
  const glass = opts.glass ? layWindowGlass(runs, config) : [];
  const SH = storeyHeight(config);
  const floorH = opts.floor ? config.FLOOR_H : 0;
  const slabs = [];
  const warnings = [];

  const stairs = opts.stairs && config.STOREYS > 1
    ? placeStairs(runs, encl, config)
    : { flights: [], buildings: 0, unplaced: [] };
  for (const u of stairs.unplaced) {
    warnings.push(`building near stud (${u.x},${u.y}): no room fits a ` +
                  `${2 * config.STAIR_WIDTH}x${storeyHeight(config) / config.STAIR_RISE * config.STAIR_RUN + 2 * (config.STAIR_LANDING ?? 1)} ` +
                  `staircase clear of doorways -- its upper storeys have no stairs`);
  }
  for (const f of stairs.flights) slabs.push(...flightSteps(f, config, floorH));

  if (opts.floor) {
    for (let s = 0; s < config.STOREYS; s++) {
      const cells = floorCells(runs, config, s * config.WALL_COURSES, encl);
      for (const f of stairs.flights) {
        if ((f.storey === s && !config.STAIR_TREADS) || f.storey === s - 1) for (const k of flightCells(f, config)) cells.delete(k);
      }
      const rects = config.FLOOR_STYLE === "planks" ? plankRects(cells, config.PLANK_MAX, s) : tileRects(cells, config.FLOOR_MAX);
      for (const r of rects) {
        slabs.push({ kind: "floor", ...r, z0: s * SH, z1: s * SH + config.FLOOR_H });
      }
    }
  }
  if (opts.ceiling) {
    const z1 = config.STOREYS * SH - config.CEILING_DROP * config.COURSE_H;
    for (const r of tileRects(encl.interior, config.FLOOR_MAX)) {
      slabs.push({ kind: "ceiling", ...r, z0: z1 - config.CEILING_H, z1 });
    }
  }
  if (opts.roof) {
    const layers = roofLayers(roofFootprint(encl, config), config);
    layers.forEach((cells, k) => {
      const z0 = config.STOREYS * SH + k * config.ROOF_H;
      for (const r of tileRects(cells, config.FLOOR_MAX)) slabs.push({ kind: "roof", ...r, z0, z1: z0 + config.ROOF_H });
    });
  }
  return { runs, walls, glass, slabs, stairs, warnings };
}

// World-unit brick for a slab (same boundary-based stud convention as
// toWorldBrick).
function toWorldSlab(s, config = CONFIG) {
  return {
    x: ((s.x0 + s.x1) / 2) * config.STUD,
    y: ((s.y0 + s.y1) / 2) * config.STUD,
    z: (s.z0 + s.z1) / 2,
    sx: ((s.x1 - s.x0) * config.STUD) / 2,
    sy: ((s.y1 - s.y0) * config.STUD) / 2,
    sz: (s.z1 - s.z0) / 2,
    kind: s.kind, x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, z0: s.z0, z1: s.z1,
  };
}

// The whole-building check for everything that isn't brickwork-vs-brickwork
// (validateGeometry covers that): no two solids of ANY kind -- wall, pane,
// floor, ceiling, roof, stair -- may share volume; every world coordinate is
// an integer; no plate is longer than FLOOR_MAX. It works from final boxes
// only, never from the code that placed them, so a placement bug anywhere
// (a floor under a stair, a ceiling through a wall, a flight through a slab)
// is caught here.
function validateSolids(model, config = CONFIG) {
  const violations = [];
  const boxes = [];
  const brickBox = (b, kind) => {
    const z0 = b.course * config.COURSE_H;
    const cells = b.orient === "H" ? { x0: b.a, x1: b.b, y0: b.line, y1: b.line + 1 } : { x0: b.line, x1: b.line + 1, y0: b.a, y1: b.b };
    return { kind, ...cells, z0, z1: z0 + config.COURSE_H };
  };
  for (const b of model.walls) boxes.push(brickBox(b, "wall"));
  for (const b of model.glass) boxes.push(brickBox(b, "pane"));
  for (const s of model.slabs) {
    boxes.push(s);
    const w = toWorldSlab(s, config);
    for (const f of ["x", "y", "z", "sx", "sy", "sz"]) {
      if (!Number.isInteger(w[f])) violations.push(`${s.kind} ${JSON.stringify(s)} has non-integer ${f}=${w[f]}`);
    }
    if (s.kind !== "stair" && (s.x1 - s.x0 > config.FLOOR_MAX || s.y1 - s.y0 > config.FLOOR_MAX)) {
      violations.push(`${s.kind} ${JSON.stringify(s)} is longer than FLOOR_MAX=${config.FLOOR_MAX}`);
    }
    if (!(s.x1 > s.x0 && s.y1 > s.y0 && s.z1 > s.z0)) violations.push(`${s.kind} ${JSON.stringify(s)} is empty or inverted`);
  }
  const at = new Map();
  for (const b of boxes) {
    for (let y = b.y0; y < b.y1; y++) {
      for (let x = b.x0; x < b.x1; x++) {
        const k = cellKey(x, y);
        let list = at.get(k);
        if (!list) at.set(k, (list = []));
        for (const o of list) {
          if (b.z0 < o.z1 && o.z0 < b.z1) {
            if (violations.length < 200) violations.push(`${b.kind} (z ${b.z0}-${b.z1}) overlaps ${o.kind} (z ${o.z0}-${o.z1}) at cell (${k})`);
            else if (violations.length === 200) violations.push("...");
          }
        }
        list.push(b);
      }
    }
  }
  return violations;
}

// Cover a set of cells with as few axis-aligned rectangles as a greedy
// row-major sweep finds, no side longer than `maxSide` studs. Rectangles are
// half-open stud ranges: {x0, y0, x1, y1} covers x0 <= x < x1, y0 <= y < y1.
function tileRects(cells, maxSide) {
  const used = new Set();
  const free = (x, y) => cells.has(cellKey(x, y)) && !used.has(cellKey(x, y));
  const order = [...cells].map((k) => k.split(",").map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const out = [];
  for (const [x, y] of order) {
    if (!free(x, y)) continue;
    let w = 1;
    while (w < maxSide && free(x + w, y)) w++;
    let h = 1;
    grow: while (h < maxSide) {
      for (let i = 0; i < w; i++) if (!free(x + i, y + h)) break grow;
      h++;
    }
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) used.add(cellKey(x + dx, y + dy));
    out.push({ x0: x, y0: y, x1: x + w, y1: y + h });
  }
  return out;
}

// Floorboards, the owner's hand-laid floor (2026-10-03): 1-stud-wide boards
// along the floor's longer side, 3..PLANK_MAX studs long by a coordinate
// hash, and no board end within 1 stud of an end in the row beside it, so
// the joints stagger like real boards instead of the greedy plates' grid.
// Same half-open {x0, y0, x1, y1} rects as tileRects; lay them as micro
// bricks so the top is smooth.
function plankRects(cells, maxLen = 12, salt = 0) {
  const pts = [...cells].map((k) => k.split(",").map(Number));
  if (!pts.length) return [];
  const span = (i) => Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i]));
  const alongX = span(0) >= span(1);
  const rows = new Map(); // row -> positions along the boards
  for (const [x, y] of pts) {
    const [row, pos] = alongX ? [y, x] : [x, y];
    (rows.get(row) ?? rows.set(row, []).get(row)).push(pos);
  }
  const ends = new Map(); // row -> Set of interior board ends
  const out = [];
  const near = (set, q) => set && (set.has(q) || set.has(q - 1) || set.has(q + 1));
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const ps = rows.get(row).sort((a, b) => a - b);
    const prev = ends.get(row - 1), mine = new Set();
    ends.set(row, mine);
    const lay = (a, b) => {
      for (let p = a; p < b;) {
        const h = caveHash(row + salt * 4099, p, 17, salt);
        let q = p + 3 + Math.floor(h * Math.max(1, maxLen - 2));
        for (let t = 0; t < 4 && q < b && near(prev, q); t++) q++;
        if (q > p + maxLen && !near(prev, p + maxLen)) q = p + maxLen;
        if (b - q < 3) q = b;
        out.push(alongX ? { x0: p, y0: row, x1: q, y1: row + 1 } : { x0: row, y0: p, x1: row + 1, y1: q });
        if (q < b) mine.add(q);
        p = q;
      }
    };
    let a = ps[0], last = ps[0];
    for (const p of ps.slice(1)) {
      if (p === last + 1) { last = p; continue; }
      lay(a, last + 1); a = p; last = p;
    }
    lay(a, last + 1);
  }
  return out;
}

// Herringbone floor (the owner's hand-laid terracotta, 2026-10-03): 1 x 2
// stud tiles in zigzag rows. Cell (x, y) belongs by (x + y) mod 4: 0 starts a
// tile running +y, 2 one running +x (1 and 3 are their other halves); the
// lattice (1,-1) x (4,0) tiles the plane exactly. Where a room edge cuts a
// tile, the leftover cell gets a 1 x 1 tile. Returns tileRects-style rects.
function herringboneRects(cells) {
  const out = [], used = new Set();
  const has = (x, y) => cells.has(cellKey(x, y)) && !used.has(cellKey(x, y));
  const take = (r) => { for (let x = r.x0; x < r.x1; x++) for (let y = r.y0; y < r.y1; y++) used.add(cellKey(x, y)); out.push(r); };
  const pts = [...cells].map((k) => k.split(",").map(Number)).sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  for (const [x, y] of pts) {
    if (!has(x, y)) continue;
    const c = (((x + y) % 4) + 4) % 4;
    const [ax, ay, w, h] = c === 0 ? [x, y, 1, 2] : c === 1 ? [x, y - 1, 1, 2] : c === 2 ? [x, y, 2, 1] : [x - 1, y, 2, 1];
    let whole = true;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (!has(ax + i, ay + j)) whole = false;
    take(whole ? { x0: ax, y0: ay, x1: ax + w, y1: ay + h } : { x0: x, y0: y, x1: x + 1, y1: y + 1 });
  }
  return out;
}

// Checkerboard: the cells cut into SQ x SQ squares on the global stud grid
// (so neighbouring rooms line up), each square a rect with par = its colour
// (0/1); squares a room edge cuts are trimmed to the cells present (still
// rectangles: each square's present cells are covered row by row).
function checkerRects(cells, sq = 2) {
  const sqs = new Map();
  for (const k of cells) {
    const [x, y] = k.split(",").map(Number);
    const sx = Math.floor(x / sq), sy = Math.floor(y / sq), key = sx + "," + sy;
    (sqs.get(key) ?? sqs.set(key, []).get(key)).push([x, y]);
  }
  const out = [];
  for (const [key, pts] of sqs) {
    const [sx, sy] = key.split(",").map(Number), par = ((sx + sy) % 2 + 2) % 2;
    if (pts.length === sq * sq) { out.push({ x0: sx * sq, y0: sy * sq, x1: sx * sq + sq, y1: sy * sq + sq, par }); continue; }
    for (const [x, y] of pts) out.push({ x0: x, y0: y, x1: x + 1, y1: y + 1, par });
  }
  return out;
}

function layFloor(runs, config = CONFIG) {
  return tileRects(floorCells(runs, config), config.FLOOR_MAX);
}

// Floor plate in world units, lying on the ground (z 0 .. FLOOR_H) in the
// cells between walls -- same boundary-based stud convention as toWorldBrick.
function toWorldFloor(r, config = CONFIG) {
  return {
    x: ((r.x0 + r.x1) / 2) * config.STUD,
    y: ((r.y0 + r.y1) / 2) * config.STUD,
    z: config.FLOOR_H / 2,
    sx: ((r.x1 - r.x0) * config.STUD) / 2,
    sy: ((r.y1 - r.y0) * config.STUD) / 2,
    sz: config.FLOOR_H / 2,
    x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
  };
}

// Checks a floor against the final WALL bricks, not against floorCells: a
// plate may not share a cell with ground-course brickwork, overlap another
// plate, exceed FLOOR_MAX, or sit at a non-integer world position.
function validateFloor(worldWallBricks, worldFloor, config = CONFIG) {
  const violations = [];
  const ground = new Set();
  for (const b of worldWallBricks) {
    if (b.course !== 0) continue;
    for (let p = b.a; p < b.b; p++) ground.add(b.orient === "H" ? cellKey(p, b.line) : cellKey(b.line, p));
  }
  const covered = new Set();
  for (const f of worldFloor) {
    for (const field of ["x", "y", "z", "sx", "sy", "sz"]) {
      if (!Number.isInteger(f[field])) violations.push(`floor plate ${JSON.stringify(f)} has non-integer ${field}=${f[field]}`);
    }
    if (f.x1 - f.x0 > config.FLOOR_MAX || f.y1 - f.y0 > config.FLOOR_MAX) {
      violations.push(`floor plate ${JSON.stringify(f)} is longer than FLOOR_MAX=${config.FLOOR_MAX}`);
    }
    for (let y = f.y0; y < f.y1; y++) {
      for (let x = f.x0; x < f.x1; x++) {
        const k = cellKey(x, y);
        if (ground.has(k)) violations.push(`floor cell (${k}) is under a ground-course wall brick`);
        if (covered.has(k)) violations.push(`floor cell (${k}) covered by more than one plate`);
        covered.add(k);
      }
    }
  }
  return violations;
}

function layBricks(runs, config = CONFIG) {
  const out = [];
  for (let course = 0; course < totalCourses(config); course++) {
    out.push(...layoutCourse(runs, course, config));
  }
  return out;
}

// Convert one stud-space brick descriptor (from layBricks) into a world-unit
// brick record ready for the .brs/.brz writer.
function toWorldBrick(b, config = CONFIG) {
  const len = b.b - b.a;
  const zHalf = config.COURSE_H / 2;
  const z = config.BASE_Z + b.course * config.COURSE_H;
  const xHalf = b.orient === "H" ? (len * config.STUD) / 2 : (config.WALL_THICKNESS * config.STUD) / 2;
  const yHalf = b.orient === "H" ? (config.WALL_THICKNESS * config.STUD) / 2 : (len * config.STUD) / 2;
  // Length-axis cells are boundary-based: cell p occupies world [p*STUD,
  // (p+1)*STUD) -- a wall's length coverage ends exactly ON a stud
  // boundary. But the THICKNESS axis was centered on `line` (line*STUD +-
  // STUD/2), which is a DIFFERENT convention offset by half a stud from
  // the boundary system. At a corner, the branch wall's terminal cell
  // butts against the through-wall's `line` boundary, while the
  // through-wall's own centered thickness band starts half a stud earlier
  // -- so they either overlap or fall short by exactly half a stud
  // depending which side the branch approaches from. This is what showed
  // up in-game as a gap "no brick can fit in." Fix: thickness is also
  // boundary-based now, spanning [line*STUD, (line+1)*STUD), matching the
  // length axis exactly, so a wall's own line IS its near face.
  const thicknessCenter = b.line * config.STUD + config.STUD / 2;
  const x = b.orient === "H" ? ((b.a + b.b) / 2) * config.STUD : thicknessCenter;
  const y = b.orient === "H" ? thicknessCenter : ((b.a + b.b) / 2) * config.STUD;
  return { x, y, z, sx: xHalf, sy: yHalf, sz: zHalf, course: b.course, orient: b.orient, a: b.a, b: b.b, line: b.line };
}

// ------------------------------------------------------------- cave walls --
// The "cave" wall type: same cells and courses as the running-bond walls
// (so every validator above still applies to the course bricks), but each
// wall cell becomes 1x1-stud vertical columns cut at random plate heights,
// like rough stacked stone. Modelled on a hand-built sample: a 9-brick wall
// whose columns split into 1-3 pieces of 4..18 plates with staggered joints.
//
// `walls` are layBricks-style descriptors; an optional `level` on them keeps
// stacked dungeon levels apart. Returns world bricks shaped like
// toWorldBrick's output (x, y, z, sx, sy, sz) plus `level`.
const CAVE_PLATE = 4; // world units
const CAVE_MIN_PLATES = 4;
const CAVE_MAX_PLATES = 18;

function caveHash(a, b, c, d) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(d | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function caveWallBricks(walls, config = CONFIG, seed = 1) {
  // cell -> set of solid courses
  const cells = new Map();
  for (const b of walls) {
    for (let p = b.a; p < b.b; p++) {
      const [x, y] = b.orient === "H" ? [p, b.line] : [b.line, p];
      const level = b.level ?? 0;
      const k = `${x},${y},${level}`;
      let c = cells.get(k);
      if (!c) cells.set(k, (c = { x, y, level, courses: [] }));
      c.courses.push(b.course);
    }
  }
  const out = [];
  const perCourse = config.COURSE_H / CAVE_PLATE;
  for (const { x, y, level, courses } of cells.values()) {
    courses.sort((p, q) => p - q);
    // contiguous course runs -> columns
    for (let i = 0; i < courses.length; ) {
      let j = i;
      while (j + 1 < courses.length && courses[j + 1] === courses[j] + 1) j++;
      const z0 = courses[i] * config.COURSE_H;
      const plates = (courses[j] - courses[i] + 1) * perCourse;
      // cut into random pieces; a leftover shorter than the minimum joins its neighbour
      const pieces = [];
      let left = plates, n = 0;
      while (left > 0) {
        const r = caveHash(x + seed * 7919, y, z0 + n * 31, level);
        let h = CAVE_MIN_PLATES + Math.floor(r * (CAVE_MAX_PLATES - CAVE_MIN_PLATES + 1));
        if (left - h < CAVE_MIN_PLATES) h = left;
        if (h > left) h = left;
        pieces.push(h);
        left -= h;
        n++;
      }
      let z = z0;
      for (const h of pieces) {
        const hz = h * CAVE_PLATE;
        out.push({
          x: x * config.STUD + config.STUD / 2,
          y: y * config.STUD + config.STUD / 2,
          z: z + hz / 2,
          sx: config.STUD / 2,
          sy: config.STUD / 2,
          sz: hz / 2,
          level,
        });
        z += hz;
      }
      i = j + 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- validate --
// Every bug found in this pipeline so far was found by a human looking at a
// screenshot of ONE spot. That doesn't scale, and it doesn't prove the
// other N spots are clean -- it only proves that one is. This function
// checks every invariant discovered so far against the WHOLE building,
// exhaustively, and is meant to run on every generation, not on demand:
// a violation here must stop the file from being written, not just get
// logged for someone to notice later. See PIPELINE.md's bug table -- each
// check below corresponds to one entry in it.
function validateGeometry(runs, worldBricks, config = CONFIG) {
  const violations = [];

  // 1. No run may be collapsed or inverted (the CORNER_SNAP collapse bug).
  for (const r of runs) {
    if (r.end <= r.start) {
      violations.push(`run ${r.orient} line=${r.line} has start=${r.start} >= end=${r.end} (collapsed/inverted)`);
    }
  }

  // 2. No opening may extend outside its own run's span.
  for (const r of runs) {
    for (const o of r.openings) {
      if (o.pos0 < r.start || o.pos1 > r.end) {
        violations.push(`run ${r.orient} line=${r.line} (${r.start}-${r.end}) has an opening ${o.pos0}-${o.pos1} outside its own span`);
      }
    }
  }

  // 3. No connected endpoint may land inside the connected wall's own
  // opening (a wall structurally anchoring into a doorway). Deliberately
  // does NOT call classifyEnd -- that function is what's supposed to
  // prevent this, so re-using it here would make this check unable to
  // ever catch a regression IN classifyEnd itself. Instead this looks at
  // the final coordinates directly: if a run's endpoint numerically sits
  // on another perpendicular wall's line, within that wall's own span,
  // that's what "connected" means in this model regardless of how it got
  // there -- so check it against that wall's openings directly.
  for (const r of runs) {
    const ends = r.orient === "H" ? [[r.start, r.line], [r.end, r.line]] : [[r.line, r.start], [r.line, r.end]];
    for (const [whichEnd, [ex, ey]] of ends.entries()) {
      for (const other of runs) {
        if (other === r || other.orient === r.orient) continue;
        const onOtherLine = other.orient === "H" ? ey === other.line : ex === other.line;
        if (!onOtherLine) continue;
        const pos = other.orient === "H" ? ex : ey;
        if (pos < other.start || pos > other.end) continue; // touches the line, but outside other's actual span
        if (other.openings.some((o) => pos >= o.pos0 && pos < o.pos1)) {
          violations.push(`run ${r.orient} line=${r.line} end${whichEnd} connects into ${other.orient} line=${other.line}'s own opening at pos=${pos}`);
        }
      }
    }
  }

  // 4. Every world-space brick position/size must be a safe integer (the
  // .brz-writer-rejects-.5-positions bug).
  for (const b of worldBricks) {
    for (const field of ["x", "y", "z", "sx", "sy", "sz"]) {
      if (!Number.isInteger(b[field])) {
        violations.push(`brick ${JSON.stringify(b)} has non-integer ${field}=${b[field]}`);
      }
    }
  }

  // 5. No cell may be covered by more than one brick on the same course
  // (a double-covered/overlapping cell).
  for (let course = 0; course < totalCourses(config); course++) {
    const covered = new Map();
    for (const b of worldBricks) {
      if (b.course !== course) continue;
      for (let p = b.a; p < b.b; p++) {
        const [x, y] = b.orient === "H" ? [p, b.line] : [b.line, p];
        const k = x + "," + y;
        covered.set(k, (covered.get(k) || 0) + 1);
      }
    }
    for (const [k, c] of covered) {
      if (c > 1) violations.push(`course ${course}: cell (${k}) covered ${c} times`);
    }
  }

  // 6. No two perpendicular bricks on the same course may leave a
  // sub-stud gap or overlap between their facing edges (the
  // length-axis-vs-thickness-axis convention mismatch bug). A real gap
  // (unrelated walls) is >= STUD; touching is ~0. Anything strictly
  // between is impossible for any brick to fill.
  for (let course = 0; course < totalCourses(config); course++) {
    const hs = worldBricks.filter((b) => b.course === course && b.orient === "H");
    const vs = worldBricks.filter((b) => b.course === course && b.orient === "V");
    for (const h of hs) {
      const [hy0, hy1, hx0, hx1] = [h.y - h.sy, h.y + h.sy, h.x - h.sx, h.x + h.sx];
      for (const v of vs) {
        const [vy0, vy1, vx0, vx1] = [v.y - v.sy, v.y + v.sy, v.x - v.sx, v.x + v.sx];
        if (!(hy1 > vy0 && hy0 < vy1)) continue;
        for (const g of [vx0 - hx1, hx0 - vx1]) {
          if (g > 0.5 && g < config.STUD) {
            violations.push(`course ${course}: half-stud-scale gap (${g}) between H ${JSON.stringify(h)} and V ${JSON.stringify(v)}`);
          }
          if (g < -0.5 && g > -config.STUD) {
            violations.push(`course ${course}: half-stud-scale overlap (${g}) between H ${JSON.stringify(h)} and V ${JSON.stringify(v)}`);
          }
        }
      }
    }
  }

  return violations;
}

function assertValidGeometry(runs, worldBricks, config = CONFIG) {
  const violations = validateGeometry(runs, worldBricks, config);
  if (violations.length > 0) {
    throw new Error(
      `Refusing to write output: ${violations.length} geometry invariant violation(s) found.\n` +
      violations.slice(0, 20).map((v) => "  - " + v).join("\n") +
      (violations.length > 20 ? `\n  ...and ${violations.length - 20} more` : "")
    );
  }
}

module.exports = {
  CONFIG,
  totalCourses,
  storeyHeight,
  standsAt,
  enclosure,
  markBuildings,
  roofFootprint,
  roofLayers,
  placeStairs,
  flightCells,
  flightSteps,
  checkConfig,
  buildModel,
  toWorldSlab,
  validateSolids,
  cellIsOpen,
  layoutCells,
  layoutGlassCourse,
  layWindowGlass,
  floorCells,
  tileRects,
  plankRects,
  herringboneRects,
  checkerRects,
  layFloor,
  toWorldFloor,
  validateFloor,
  validateGeometry,
  assertValidGeometry,
  resolveOpeningConflicts,
  toStud,
  normalizeRuns,
  endpoints,
  classifyEnd,
  snapEndpoints,
  courseIsOpen,
  tileAxis,
  layoutCourse,
  layBricks,
  toWorldBrick,
  caveWallBricks,
};
