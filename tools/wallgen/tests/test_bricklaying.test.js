// Unit tests for lib.js (the brick-laying core). Run with: node --test tests/
//
// These target the specific bugs recorded in PIPELINE.md rather than being
// generic coverage: wrong-partner corner matching, corner retraction math,
// door/window course banding, and the shared-grid tiling's core guarantees
// (no double-covered cells, no missing cells, correct alternation).

const test = require("node:test");
const assert = require("node:assert/strict");
const lib = require("../lib");

// -------------------------------------------------------------- toStud --
// The pixel:stud:brick-pair ratio is 1:1:2 -- bricks tile in 2-stud pairs,
// so a coordinate landing on an odd stud guarantees a leftover 1-stud
// filler at that boundary. toStud snaps to the nearest EVEN stud, not just
// the nearest integer.

test("toStud: even pixel positions pass through unchanged", () => {
  assert.equal(lib.toStud(10), 10);
  assert.equal(lib.toStud(0), 0);
});

test("toStud: odd pixel positions snap to the nearest even stud", () => {
  assert.equal(lib.toStud(11), 12);
  assert.equal(lib.toStud(9), 10); // JS Math.round rounds .5 away from zero
  assert.equal(lib.toStud(5), 6);
  assert.equal(lib.toStud(7), 8);
});

// ---------------------------------------------------------------- tileAxis --

test("tileAxis: contiguous run, even course starts bricks on the even grid", () => {
  const segs = lib.tileAxis(new Map([[0, [0, 1, 2, 3, 4, 5]]]), 0);
  assert.deepEqual(segs, [[0, 0, 2], [0, 2, 4], [0, 4, 6]]);
});

test("tileAxis: same run, odd course shifts the grid by one stud (running bond offset)", () => {
  const segs = lib.tileAxis(new Map([[0, [0, 1, 2, 3, 4, 5]]]), 1);
  // 1-stud filler, two 2-stud bricks, 1-stud filler -- offset by half a
  // brick relative to the even-course case above.
  assert.deepEqual(segs, [[0, 0, 1], [0, 1, 3], [0, 3, 5], [0, 5, 6]]);
});

test("tileAxis: a gap between cells never gets bridged into one brick", () => {
  const segs = lib.tileAxis(new Map([[0, [0, 1, 2, 5, 6, 7]]]), 0);
  // two independent contiguous groups; the gap at 3-4 must not appear as
  // part of any brick
  assert.deepEqual(segs, [[0, 0, 2], [0, 2, 3], [0, 5, 6], [0, 6, 8]]);
  for (const [, a, b] of segs) assert.ok(!(a < 3 && b > 3), "no brick may span the 3-4 gap");
});

// ------------------------------------------------------------ courseIsOpen --

test("courseIsOpen: door is open on the bottom courses, solid lintel above", () => {
  const door = { type: "door" };
  const results = [0, 1, 2, 3, 4, 5].map((c) => lib.courseIsOpen(door, c));
  assert.deepEqual(results, [true, true, true, false, false, false]);
});

test("courseIsOpen: window is a solid sill, open middle band, solid lintel", () => {
  const win = { type: "window" };
  const results = [0, 1, 2, 3, 4, 5].map((c) => lib.courseIsOpen(win, c));
  assert.deepEqual(results, [false, false, true, true, false, false]);
});

// ------------------------------------------------------- window panes --
// layWindowGlass fills the holes layBricks leaves, so the two have to agree
// cell-for-cell: a pane in a cell the walls also filled is a double-covered
// cell the geometry gate would reject, and a pane on a door course is a pane
// you walk into.

const cellsOf = (bricks, course) => {
  const out = new Set();
  for (const b of bricks.filter((x) => x.course === course)) {
    for (let p = b.a; p < b.b; p++) out.add(b.orient === "H" ? `${p},${b.line}` : `${b.line},${p}`);
  }
  return out;
};

test("layWindowGlass: panes fill exactly the window cells the walls leave open", () => {
  const runs = [{ orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 6, pos1: 12, type: "window" }] }];
  for (let course = 0; course < lib.CONFIG.WALL_COURSES; course++) {
    const wall = cellsOf(lib.layoutCourse(runs, course), course);
    const panes = cellsOf(lib.layoutGlassCourse(runs, course), course);
    const open = lib.courseIsOpen({ type: "window" }, course);
    // no cell is both brick and pane
    for (const c of panes) assert.ok(!wall.has(c), `course ${course}: cell ${c} is wall AND pane`);
    // together they cover the whole run, exactly once
    assert.equal(wall.size + panes.size, 21, `course ${course}: run not fully covered`);
    const expected = open ? [6, 7, 8, 9, 10, 11].map((x) => `${x},0`) : [];
    assert.deepEqual([...panes].sort(), expected.sort());
  }
});

test("layWindowGlass: doors never get panes", () => {
  const runs = [{ orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 6, pos1: 12, type: "door" }] }];
  assert.deepEqual(lib.layWindowGlass(runs), []);
});

test("layWindowGlass: pane count follows the window band height", () => {
  const runs = [{ orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 6, pos1: 12, type: "window" }] }];
  const cells = (config) =>
    lib.layWindowGlass(runs, config).reduce((n, b) => n + (b.b - b.a), 0);
  assert.equal(cells({ ...lib.CONFIG, WINDOW_OPEN_COURSES: 1 }), 6);   // 6 studs, 1 course
  assert.equal(cells({ ...lib.CONFIG, WINDOW_OPEN_COURSES: 3 }), 18);  // 6 studs, 3 courses
  // a band pushed above the wall top produces no panes at all
  assert.equal(cells({ ...lib.CONFIG, WINDOW_SILL_COURSES: 99 }), 0);
});

// --------------------------------------------------------- classifyEnd fix --
// Regression: classifyEnd used to return the FIRST candidate found instead
// of the closest one. In a floor plan with several walls close together
// this picked an unrelated wall as the "corner partner" and computed
// retraction against the wrong coordinate -- see PIPELINE.md.

test("snapEndpoints: picks the CLOSEST perpendicular candidate, not the first", () => {
  const runs = [
    { orient: "H", line: 0, start: 0, end: 10, openings: [] },
    // farther candidate, listed FIRST -- a first-match bug would pick this
    { orient: "V", line: 13, start: -5, end: 5, openings: [] },
    // closer candidate, listed second
    { orient: "V", line: 11, start: -5, end: 5, openings: [] },
  ];
  lib.snapEndpoints(runs, { ...lib.CONFIG, CORNER_SNAP: 3 });
  assert.equal(runs[0].end, 11, "should snap to the closer V run's line (11), not the farther one (13)");
});

test("snapEndpoints: aligns two walls that meet within tolerance but not exactly", () => {
  const runs = [
    { orient: "H", line: 0, start: 0, end: 10, openings: [] },
    { orient: "V", line: 12, start: 0, end: 10, openings: [] }, // 2 studs off from H's end
  ];
  lib.snapEndpoints(runs, { ...lib.CONFIG, CORNER_SNAP: 3 });
  assert.equal(runs[0].end, 12, "H's end should snap exactly onto V's centerline");
});

test("snapEndpoints: leaves a truly unconnected (dangling) end alone", () => {
  const runs = [
    { orient: "H", line: 0, start: 0, end: 10, openings: [] },
    { orient: "V", line: 50, start: 0, end: 10, openings: [] }, // far outside CORNER_SNAP
  ];
  lib.snapEndpoints(runs, { ...lib.CONFIG, CORNER_SNAP: 3 });
  assert.equal(runs[0].end, 10, "nothing nearby -- end should be untouched");
});

// Regression: CORNER_SNAP=3 was too tight for this floor plan's actual
// hand-drawn imprecision. Real T-junctions/corners up to 8 studs off were
// left classified as "dangling" (no snapping applied), leaving a visible
// gap in-game since the branch wall's raw endpoint didn't land on the same
// row/column as the wall it was meant to meet. Found by scanning the real
// floor plan for dangling ends close to (but outside old tolerance of) a
// perpendicular run. See PIPELINE.md.
test("snapEndpoints: default CORNER_SNAP catches an 8-stud hand-drawing gap", () => {
  const runs = [
    { orient: "V", line: 0, start: 0, end: 20, openings: [] },
    { orient: "H", line: 28, start: -10, end: 10, openings: [] }, // 8 studs past V's end
  ];
  lib.snapEndpoints(runs); // default config, no override
  assert.equal(runs[0].end, 28, "V's end should snap onto H's line despite the 8-stud gap");
});

// Regression: raising CORNER_SNAP to fix the test above introduced a WORSE
// bug -- a run shorter than 2*CORNER_SNAP can have both its ends reach the
// SAME nearby through-wall (one at distance 0, the other within the wider
// tolerance), collapsing the run to zero length. In-game this rendered as
// a fragmented, zigzagging pillar of disconnected bricks. Found on a real
// 8-stud run whose far end snapped onto the same through-wall its near end
// was already touching at distance 0. See PIPELINE.md.
test("snapEndpoints: a short run's far end cannot snap back onto its own near end's wall", () => {
  const runs = [
    // an 8-stud V run whose end0 sits exactly on H's line (dist 0); end1 is
    // only 8 studs further along the SAME H run, well within CORNER_SNAP
    { orient: "V", line: 224, start: 120, end: 128, openings: [] },
    { orient: "H", line: 120, start: 100, end: 300, openings: [] },
  ];
  lib.snapEndpoints(runs);
  assert.ok(runs[0].end > runs[0].start, `run collapsed: start=${runs[0].start} end=${runs[0].end}`);
  assert.equal(runs[0].start, 120, "near end should still snap to the through-wall it truly touches");
  assert.notEqual(runs[0].end, 120, "far end must not snap back onto the same wall as the near end");
});

// Regression: a wall can't structurally anchor into another wall's door or
// window -- that's not a real connection, just a branch's raw extracted
// position happening to land inside a (sometimes 30+ stud wide) opening on
// the through-wall. Found by scanning every T-junction/corner candidate
// for one landing inside its own opening span: 13 real cases in the floor
// plan, confirmed by the user circling the exact resulting floating/
// extending brick geometry in an in-game screenshot. See PIPELINE.md.
test("classifyEnd: rejects a T-junction that would land inside the through-wall's own opening", () => {
  const runs = [
    { orient: "V", line: 100, start: 0, end: 20, openings: [] },
    // a wide door right where V's tip would otherwise land
    { orient: "H", line: 20, start: 80, end: 120, openings: [{ pos0: 95, pos1: 105, type: "door" }] },
  ];
  const info = lib.classifyEnd(runs[0], 1, runs);
  assert.equal(info.kind, "dangling", "must not connect into the door -- no valid candidate exists here");
});

test("classifyEnd: still connects normally just outside the opening", () => {
  const runs = [
    { orient: "V", line: 110, start: 0, end: 20, openings: [] }, // outside the 95-105 door
    { orient: "H", line: 20, start: 50, end: 150, openings: [{ pos0: 95, pos1: 105, type: "door" }] },
  ];
  const info = lib.classifyEnd(runs[0], 1, runs);
  assert.equal(info.kind, "tjunction");
  assert.equal(info.other, runs[1]);
});

// Regression: classifyEnd correctly returning 'dangling' is not enough --
// 'dangling' means "don't move this coordinate," and if the RAW extracted
// data already had the run touching the opening exactly (distance 0, the
// single most common case, since an exact match needs no snapping),
// declining to endorse the connection does nothing to remove it. Found by
// the mandatory validation gate itself catching 6 real cases in the floor
// plan that classifyEnd's rejection alone did not (and could not) prevent.
// See PIPELINE.md.
test("snapEndpoints: actively retracts an end that ALREADY (pre-snap) touches another wall's opening", () => {
  const runs = [
    // V already sits exactly on H's line (distance 0) -- nothing to snap,
    // classifyEnd will correctly say 'dangling', but the raw touch itself
    // is still illegal because it's inside H's door.
    { orient: "V", line: 100, start: 0, end: 20, openings: [] },
    { orient: "H", line: 20, start: 50, end: 150, openings: [{ pos0: 95, pos1: 105, type: "door" }] },
  ];
  lib.snapEndpoints(runs);
  const violations = lib.validateGeometry(runs, []);
  assert.deepEqual(violations, [], `should have actively retracted away from the opening: ${JSON.stringify(violations)}`);
  assert.notEqual(runs[0].end, 20, "V's end must have moved off H's line entirely");
});

// ---------------------------------------------------- shared-grid tiling --
// Regression: the OLD design computed a retraction distance per corner,
// which was wrong twice (full-stud instead of half-stud, then aligned to
// the wrong partner). The NEW design has no retraction distance at all --
// these tests check the properties that actually matter: no cell is ever
// covered twice, no touched cell is ever left uncovered, and a true corner
// cell alternates which wall claims it by course parity.

function coverageForCourse(bricks, course) {
  const cells = new Map(); // "x,y" -> count
  for (const b of bricks) {
    if (b.course !== course) continue;
    for (let p = b.a; p < b.b; p++) {
      const [x, y] = b.orient === "H" ? [p, b.line] : [b.line, p];
      const k = x + "," + y;
      cells.set(k, (cells.get(k) || 0) + 1);
    }
  }
  return cells;
}

test("layBricks: an L-corner has no double-covered and no missing cells, on every course", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 10, openings: [] },
    { orient: "V", line: 10, start: 0, end: 10, openings: [] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs);

  for (let course = 0; course < lib.CONFIG.WALL_COURSES; course++) {
    const coverage = coverageForCourse(bricks, course);
    for (const [cellKey, count] of coverage) {
      assert.equal(count, 1, `cell ${cellKey} on course ${course} is covered ${count} times, expected exactly 1`);
    }
  }
});

test("layBricks: the shared corner cell alternates which wall claims it by course parity", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 10, openings: [] },
    { orient: "V", line: 10, start: 0, end: 10, openings: [] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs);
  const cornerX = runs[0].end, cornerY = runs[0].line; // the shared (x,y) after snapping

  for (let course = 0; course < lib.CONFIG.WALL_COURSES; course++) {
    const owner = bricks.find(
      (b) => b.course === course &&
        ((b.orient === "H" && b.line === cornerY && b.a <= cornerX && cornerX < b.b) ||
         (b.orient === "V" && b.line === cornerX && b.a <= cornerY && cornerY < b.b))
    );
    assert.ok(owner, `some brick must cover the corner cell on course ${course}`);
    const expected = course % 2 === 0 ? "H" : "V";
    assert.equal(owner.orient, expected, `course ${course} should be claimed by ${expected}`);
  }
});

test("layBricks: a door opening removes bricks from the bottom courses only", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 8, pos1: 13, type: "door" }] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs);

  const cellCovered = (course, x) =>
    bricks.some((b) => b.course === course && b.orient === "H" && b.line === runs[0].line && b.a <= x && x < b.b);

  // door studs are 8..12 (pos0..pos1-1) in the ORIGINAL run's coordinates,
  // which normalizeRuns may offset -- recompute relative to the run itself
  const doorStud = runs[0].openings[0].pos0 + 2; // safely inside the opening
  assert.equal(cellCovered(0, doorStud), false, "door stud should be open at ground level");
  assert.equal(cellCovered(2, doorStud), false, "door stud should be open through the top door course");
  assert.equal(cellCovered(3, doorStud), true, "door stud should be solid above the door (lintel)");
  assert.equal(cellCovered(5, doorStud), true, "door stud should be solid at the top course");
});

test("layBricks: a window opening leaves a solid sill and lintel with only the middle band open", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 8, pos1: 13, type: "window" }] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs);
  const windowStud = runs[0].openings[0].pos0 + 2;
  const cellCovered = (course, x) =>
    bricks.some((b) => b.course === course && b.orient === "H" && b.line === runs[0].line && b.a <= x && x < b.b);

  assert.equal(cellCovered(0, windowStud), true, "sill course should be solid");
  assert.equal(cellCovered(1, windowStud), true, "sill course should be solid");
  assert.equal(cellCovered(2, windowStud), false, "window band should be open");
  assert.equal(cellCovered(3, windowStud), false, "window band should be open");
  assert.equal(cellCovered(4, windowStud), true, "lintel course should be solid");
  assert.equal(cellCovered(5, windowStud), true, "lintel course should be solid");
});

// ---------------------------------------------------------- integer output --
// Regression: writeBrzLegacy rejects non-integer brick positions outright.
// .brs silently accepted them, which is worse -- a bad file could look
// fine and still be malformed. Every brick handed to the writer must be a
// safe integer in every field.

test("toWorldBrick: every output field is an integer, even near a corner-adjusted cell", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 11, openings: [] }, // odd length on purpose
    { orient: "V", line: 11, start: 0, end: 11, openings: [] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs).map((b) => lib.toWorldBrick(b));
  for (const b of bricks) {
    for (const field of ["x", "y", "z", "sx", "sy", "sz"]) {
      assert.ok(Number.isInteger(b[field]), `${field}=${b[field]} on brick ${JSON.stringify(b)} is not an integer`);
    }
  }
});

// ------------------------------------------------------- world-space corner --
// Regression: the length axis is boundary-based (cell p occupies world
// [p*STUD, (p+1)*STUD)) but the thickness axis used to be CENTERED on
// `line` (line*STUD +- STUD/2) -- a different, incompatible convention
// offset by half a stud. A branch wall's terminal cell butts against the
// through-wall's `line` boundary; the through-wall's own centered
// thickness band started half a stud earlier or later depending on
// approach direction, leaving either a half-stud gap "no brick can fit
// in" or a half-stud overlap. All the cell-index-level checks above
// (double-coverage, missing cells) are blind to this because it's purely
// a WORLD-UNIT bounding-box mismatch, not a cell-index one -- this is why
// it slipped through until an in-game screenshot caught it. See
// PIPELINE.md.
test("toWorldBrick: a branch wall's edge exactly meets the through-wall's face in world units, no gap or overlap", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 2, start: 0, end: 20, openings: [] },
    { orient: "V", line: 20, start: 2, end: 30, openings: [] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs).map((b) => lib.toWorldBrick(b));

  for (let course = 0; course < lib.CONFIG.WALL_COURSES; course++) {
    const hs = bricks.filter((b) => b.course === course && b.orient === "H");
    const vs = bricks.filter((b) => b.course === course && b.orient === "V");
    for (const h of hs) {
      const [hy0, hy1] = [h.y - h.sy, h.y + h.sy];
      const [hx0, hx1] = [h.x - h.sx, h.x + h.sx];
      for (const v of vs) {
        const [vy0, vy1] = [v.y - v.sy, v.y + v.sy];
        const [vx0, vx1] = [v.x - v.sx, v.x + v.sx];
        if (!(hy1 > vy0 && hy0 < vy1)) continue; // rows don't even overlap in Y -- unrelated
        const gapRight = vx0 - hx1;
        const gapLeft = hx0 - vx1;
        for (const g of [gapRight, gapLeft]) {
          assert.ok(
            !(g > 0.5 && g < lib.CONFIG.STUD),
            `course ${course}: half-stud-scale GAP (${g}) between H ${JSON.stringify(h)} and V ${JSON.stringify(v)}`
          );
          assert.ok(
            !(g < -0.5 && g > -lib.CONFIG.STUD),
            `course ${course}: half-stud-scale OVERLAP (${g}) between H ${JSON.stringify(h)} and V ${JSON.stringify(v)}`
          );
        }
      }
    }
  }
});

// -------------------------------------------------------------- normalize --

test("normalizeRuns: offsets coordinates so everything clears MARGIN studs from the origin", () => {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 5, start: 0, end: 10, openings: [] },
  ], { ...lib.CONFIG, MARGIN: 20 });
  assert.equal(runs[0].start, 20);
  assert.equal(runs[0].end, 30);
  assert.equal(runs[0].line, 20); // line(5) + (MARGIN(20) - minY(5)) = 5 + 15
});

// ------------------------------------------------------- validateGeometry --
// "It can't happen even once" -- these confirm the mandatory validation
// gate actually catches every invariant it claims to, by feeding it
// deliberately broken input for each one, one at a time. A gate that
// silently passes broken input is worse than no gate: it's false
// assurance. Every check here corresponds to a real bug from PIPELINE.md.

function buildCleanCorner() {
  const runs = lib.normalizeRuns([
    { orient: "H", line: 0, start: 0, end: 20, openings: [] },
    { orient: "V", line: 20, start: 0, end: 20, openings: [] },
  ]);
  lib.snapEndpoints(runs);
  const bricks = lib.layBricks(runs).map((b) => lib.toWorldBrick(b));
  return { runs, bricks };
}

test("validateGeometry: a clean corner has zero violations", () => {
  const { runs, bricks } = buildCleanCorner();
  assert.deepEqual(lib.validateGeometry(runs, bricks), []);
});

test("assertValidGeometry: does not throw on clean input", () => {
  const { runs, bricks } = buildCleanCorner();
  assert.doesNotThrow(() => lib.assertValidGeometry(runs, bricks));
});

test("validateGeometry: catches a collapsed/inverted run", () => {
  const { bricks } = buildCleanCorner();
  const badRuns = [{ orient: "H", line: 0, start: 20, end: 20, openings: [] }]; // start === end
  const violations = lib.validateGeometry(badRuns, bricks);
  assert.ok(violations.some((v) => v.includes("collapsed/inverted")));
});

test("validateGeometry: catches an opening extending outside its own run", () => {
  const { bricks } = buildCleanCorner();
  const badRuns = [{ orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 15, pos1: 25, type: "door" }] }];
  const violations = lib.validateGeometry(badRuns, bricks);
  assert.ok(violations.some((v) => v.includes("outside its own span")));
});

test("validateGeometry: catches a connection landing inside another wall's opening", () => {
  const { bricks } = buildCleanCorner();
  const badRuns = [
    { orient: "V", line: 100, start: 0, end: 20, openings: [] },
    { orient: "H", line: 20, start: 50, end: 150, openings: [{ pos0: 95, pos1: 105, type: "door" }] },
  ];
  const violations = lib.validateGeometry(badRuns, bricks);
  assert.ok(violations.some((v) => v.includes("own opening")));
});

test("validateGeometry: catches a non-integer brick field", () => {
  const { runs, bricks } = buildCleanCorner();
  const badBricks = [...bricks, { ...bricks[0], x: bricks[0].x + 0.5 }];
  const violations = lib.validateGeometry(runs, badBricks);
  assert.ok(violations.some((v) => v.includes("non-integer")));
});

test("validateGeometry: catches a double-covered cell", () => {
  const { runs, bricks } = buildCleanCorner();
  const badBricks = [...bricks, { ...bricks[0] }]; // exact duplicate brick
  const violations = lib.validateGeometry(runs, badBricks);
  assert.ok(violations.some((v) => v.includes("covered") && v.includes("times")));
});

test("validateGeometry: catches a half-stud-scale gap between perpendicular bricks", () => {
  const { runs, bricks } = buildCleanCorner();
  // shift one V brick 5 world units away from where it should touch its H neighbor
  const badBricks = bricks.map((b) => (b.orient === "V" ? { ...b, x: b.x + 5 } : b));
  const violations = lib.validateGeometry(runs, badBricks);
  assert.ok(violations.some((v) => v.includes("half-stud-scale gap") || v.includes("half-stud-scale overlap")));
});

test("assertValidGeometry: throws with a readable message on violation", () => {
  const badRuns = [{ orient: "H", line: 0, start: 20, end: 20, openings: [] }];
  assert.throws(() => lib.assertValidGeometry(badRuns, []), /Refusing to write output/);
});

// ------------------------------------------------------------------ floors --
// A floor goes only where walls enclose a room; an open-ended wall (the
// jail's perimeter fence) or the yard between buildings gets none.

// Closed box: walls on x=0, x=10, y=0, y=8 (corner cells shared).
function box(openings = {}) {
  return [
    { orient: "H", line: 0, start: 0, end: 10, openings: openings.top || [] },
    { orient: "H", line: 8, start: 0, end: 10, openings: openings.bottom || [] },
    { orient: "V", line: 0, start: 0, end: 8, openings: [] },
    { orient: "V", line: 10, start: 0, end: 8, openings: [] },
  ];
}

test("floorCells: a closed box floors exactly its interior, never a wall cell", () => {
  const cells = lib.floorCells(box());
  assert.equal(cells.size, 9 * 7);
  for (let y = 1; y < 8; y++) for (let x = 1; x < 10; x++) assert.ok(cells.has(`${x},${y}`));
  assert.ok(!cells.has("0,0") && !cells.has("5,0") && !cells.has("10,4"));
});

test("floorCells: a box missing one wall encloses nothing", () => {
  const runs = box().filter((r) => !(r.orient === "V" && r.line === 10));
  assert.equal(lib.floorCells(runs).size, 0);
});

test("floorCells: a lone wall with a door gets no floor, not even in the doorway", () => {
  const runs = [{ orient: "H", line: 0, start: 0, end: 20, openings: [{ pos0: 8, pos1: 12, type: "door" }] }];
  assert.equal(lib.floorCells(runs).size, 0);
});

test("floorCells: an exterior door does not leak the floor outside, and its doorway is floored", () => {
  const cells = lib.floorCells(box({ top: [{ pos0: 4, pos1: 6, type: "door" }] }));
  assert.equal(cells.size, 9 * 7 + 2);
  assert.ok(cells.has("4,0") && cells.has("5,0"));
  assert.ok(!cells.has("4,-1"));
});

test("floorCells: a window is not floored (it has a sill at ground level)", () => {
  const cells = lib.floorCells(box({ top: [{ pos0: 4, pos1: 6, type: "window" }] }));
  assert.equal(cells.size, 9 * 7);
});

test("floorCells: a doorway open at no course (DOOR_OPEN_COURSES 0) keeps its brick and gets no floor", () => {
  const cells = lib.floorCells(box({ top: [{ pos0: 4, pos1: 6, type: "door" }] }),
                               { ...lib.CONFIG, DOOR_OPEN_COURSES: 0 });
  assert.ok(!cells.has("4,0"));
});

test("floorCells: a doorway cell another wall ends in keeps that wall's brick, not floor", () => {
  // Stage 5 retracts such an end (resolveOpeningConflicts), but floorCells
  // must not rely on that: the V wall's brick owns (5,0) at course 0.
  const runs = box({ top: [{ pos0: 4, pos1: 7, type: "door" }] });
  runs.push({ orient: "V", line: 5, start: -4, end: 0, openings: [] });
  const cells = lib.floorCells(runs);
  assert.ok(cells.has("4,0") && cells.has("6,0"));
  assert.ok(!cells.has("5,0"));
});

test("tileRects: covers every cell exactly once with sides <= maxSide", () => {
  const cells = lib.floorCells(box());
  const rects = lib.tileRects(cells, 4);
  const seen = new Set();
  for (const r of rects) {
    assert.ok(r.x1 - r.x0 <= 4 && r.y1 - r.y0 <= 4);
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
      const k = `${x},${y}`;
      assert.ok(cells.has(k), `rect covers non-floor cell ${k}`);
      assert.ok(!seen.has(k), `cell ${k} covered twice`);
      seen.add(k);
    }
  }
  assert.equal(seen.size, cells.size);
});

function flooredBox(openings) {
  const runs = box(openings);
  const walls = lib.layBricks(runs).map((b) => lib.toWorldBrick(b));
  const floor = lib.layFloor(runs).map((r) => lib.toWorldFloor(r));
  return { walls, floor };
}

test("toWorldFloor: plates lie on the ground at integer positions", () => {
  const { floor } = flooredBox({ top: [{ pos0: 4, pos1: 6, type: "door" }] });
  for (const f of floor) {
    assert.equal(f.z - f.sz, 0);
    assert.equal(f.sz * 2, lib.CONFIG.FLOOR_H);
    for (const k of ["x", "y", "z", "sx", "sy", "sz"]) assert.ok(Number.isInteger(f[k]), `${k}=${f[k]}`);
  }
});

test("validateFloor: a floored box with a door is clean", () => {
  const { walls, floor } = flooredBox({ top: [{ pos0: 4, pos1: 6, type: "door" }] });
  assert.deepEqual(lib.validateFloor(walls, floor), []);
});

test("validateFloor: catches a plate under a ground-course wall brick", () => {
  const { walls, floor } = flooredBox();
  const bad = [...floor, lib.toWorldFloor({ x0: 5, y0: 0, x1: 6, y1: 1 })];
  assert.ok(lib.validateFloor(walls, bad).some((v) => v.includes("under a ground-course wall brick")));
});

test("validateFloor: catches overlapping plates and plates longer than FLOOR_MAX", () => {
  const { walls, floor } = flooredBox();
  assert.ok(lib.validateFloor(walls, [...floor, floor[0]]).some((v) => v.includes("more than one plate")));
  const long = lib.toWorldFloor({ x0: 1, y0: 1, x1: 10, y1: 2 });
  assert.ok(lib.validateFloor(walls, [long], { ...lib.CONFIG, FLOOR_MAX: 4 }).some((v) => v.includes("FLOOR_MAX")));
});

test("validateFloor: catches a non-integer plate field", () => {
  const { walls, floor } = flooredBox();
  assert.ok(lib.validateFloor(walls, [{ ...floor[0], x: floor[0].x + 0.5 }]).some((v) => v.includes("non-integer")));
});

// ------------------------------------------- storeys, ceiling, roof, stairs --
// Everything beyond the walls comes out of lib.buildModel and is checked by
// lib.validateSolids (nothing may share volume with anything else).

function roomBox(w, h, openings = {}) {
  return [
    { orient: "H", line: 0, start: 0, end: w, openings: openings.top || [] },
    { orient: "H", line: h, start: 0, end: w, openings: openings.bottom || [] },
    { orient: "V", line: 0, start: 0, end: h, openings: [] },
    { orient: "V", line: w, start: 0, end: h, openings: [] },
  ];
}
const cfgWith = (over) => ({ ...lib.CONFIG, ...over });
const ALL = { glass: true, floor: true, ceiling: true, roof: true, stairs: true };

test("courseIsOpen: every storey repeats the door/window bands from its own floor", () => {
  const cfg = cfgWith({ STOREYS: 3 });
  const door = { type: "door" }, win = { type: "window" };
  for (let s = 0; s < 3; s++) {
    for (let c = 0; c < cfg.WALL_COURSES; c++) {
      assert.equal(lib.courseIsOpen(door, s * 6 + c, cfg), c < cfg.DOOR_OPEN_COURSES);
      assert.equal(lib.courseIsOpen(win, s * 6 + c, cfg), lib.courseIsOpen(win, c, cfg));
    }
  }
});

test("courseIsOpen: an exterior door is solid above the ground storey", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const door = { type: "door", exterior: true };
  assert.equal(lib.courseIsOpen(door, 0, cfg), true);
  for (let c = 6; c < 12; c++) assert.equal(lib.courseIsOpen(door, c, cfg), false);
});

test("markBuildings: an exterior door is flagged, an interior one is not", () => {
  const runs = roomBox(20, 10, { top: [{ pos0: 4, pos1: 6, type: "door" }] });
  runs.push({ orient: "V", line: 10, start: 0, end: 10, openings: [{ pos0: 4, pos1: 6, type: "door" }] });
  lib.markBuildings(runs);
  assert.equal(runs[0].openings[0].exterior, true);
  assert.equal(runs[4].openings[0].exterior, false);
});

test("buildModel: a fence stays one storey while the building it joins goes up", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const runs = roomBox(20, 10);
  runs.push({ orient: "H", line: 5, start: 20, end: 40, openings: [] }); // fence T-joining the right wall
  const m = lib.buildModel(runs, cfg, {});
  const upper = m.walls.filter((b) => b.course >= cfg.WALL_COURSES);
  assert.ok(upper.length > 0);
  for (const b of upper) {
    if (b.orient !== "H") continue;
    for (let x = b.a; x < b.b; x++) assert.ok(!(b.line === 5 && x > 20), `fence cell (${x},5) went up to course ${b.course}`);
  }
  assert.ok(m.walls.some((b) => b.course === 11 && b.orient === "V" && b.line === 20), "building wall should reach the top");
  assert.ok(m.walls.some((b) => b.course === 5 && b.orient === "H" && b.line === 5 && b.b > 30), "fence keeps its first storey");
});

test("buildModel: two storeys floor both, each floor on its own storey", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const m = lib.buildModel(roomBox(12, 10), cfg, { floor: true });
  const zs = new Set(m.slabs.filter((s) => s.kind === "floor").map((s) => s.z0));
  assert.deepEqual([...zs].sort((a, b) => a - b), [0, lib.storeyHeight(cfg)]);
  assert.deepEqual(lib.validateSolids(m, cfg), []);
});

test("buildModel: stairs connect storeys -- the top step meets the floor above, and nothing overlaps", () => {
  const cfg = cfgWith({ STOREYS: 3 });
  const m = lib.buildModel(roomBox(40, 20), cfg, ALL);
  assert.equal(m.stairs.buildings, 1);
  assert.equal(m.stairs.unplaced.length, 0);
  assert.equal(m.stairs.flights.length, 2);
  const SH = lib.storeyHeight(cfg);
  for (const f of m.stairs.flights) {
    const mine = lib.flightSteps(f, cfg, cfg.FLOOR_H);
    assert.equal(mine.length, SH / cfg.STAIR_RISE);
    assert.equal(Math.max(...mine.map((s) => s.z1)), (f.storey + 1) * SH + cfg.FLOOR_H, "top step flush with the floor above");
    assert.equal(Math.min(...mine.map((s) => s.z1)), f.storey * SH + cfg.FLOOR_H + cfg.STAIR_RISE, "first step one rise above this floor");
  }
  // switchback: the flights use different strips, and the second starts where the first ends
  const [a, b] = m.stairs.flights;
  assert.notEqual(a.strip, b.strip);
  const topA = lib.flightSteps(a, cfg, cfg.FLOOR_H).at(-1), bottomB = lib.flightSteps(b, cfg, cfg.FLOOR_H)[0];
  if (a.rect.axis === "x") assert.equal(topA.x0, bottomB.x0); else assert.equal(topA.y0, bottomB.y0);
  assert.equal(m.slabs.filter((s) => s.kind === "stair").length, 2 * (SH / cfg.STAIR_RISE));
  assert.deepEqual(lib.validateSolids(m, cfg), []);
});

test("buildModel: the floor above a flight is left open (stairwell)", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const m = lib.buildModel(roomBox(40, 20), cfg, { floor: true, stairs: true });
  const upper = new Set();
  for (const s of m.slabs.filter((q) => q.kind === "floor" && q.z0 > 0)) {
    for (let y = s.y0; y < s.y1; y++) for (let x = s.x0; x < s.x1; x++) upper.add(`${x},${y}`);
  }
  for (const k of lib.flightCells(m.stairs.flights[0], cfg)) assert.ok(!upper.has(k), `stairwell cell ${k} is floored`);
});

test("buildModel: a building with no room big enough gets no stairs and a warning", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const m = lib.buildModel(roomBox(12, 10), cfg, { floor: true, stairs: true });
  assert.equal(m.stairs.flights.length, 0);
  assert.equal(m.stairs.unplaced.length, 1);
  assert.ok(m.warnings.some((w) => w.includes("staircase")));
});

test("buildModel: stairs never sit next to a doorway", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const runs = roomBox(40, 20, { top: [{ pos0: 2, pos1: 4, type: "door" }], bottom: [{ pos0: 20, pos1: 22, type: "door" }] });
  const m = lib.buildModel(runs, cfg, { floor: true, stairs: true });
  const r = m.stairs.flights[0].rect;
  for (const [dx, dy] of [[2, 0], [3, 0], [20, 20], [21, 20]]) {
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
      assert.ok(Math.max(Math.abs(x - dx), Math.abs(y - dy)) > 1, `stair cell (${x},${y}) is next to doorway (${dx},${dy})`);
    }
  }
});

test("buildModel: the ceiling hangs CEILING_DROP courses below the wall top, over rooms only", () => {
  const cfg = cfgWith({ CEILING_DROP: 1 });
  const m = lib.buildModel(roomBox(12, 10), cfg, { ceiling: true });
  const c = m.slabs.filter((s) => s.kind === "ceiling");
  assert.ok(c.length > 0);
  for (const s of c) {
    assert.equal(s.z1, (cfg.WALL_COURSES - 1) * cfg.COURSE_H);
    assert.ok(s.x0 >= 1 && s.x1 <= 12 && s.y0 >= 1 && s.y1 <= 10);
  }
  assert.deepEqual(lib.validateSolids(m, cfg), []);
});

test("checkConfig: refuses a stair rise that does not divide the storey, and a ceiling dropped below the floor", () => {
  assert.ok(lib.checkConfig(cfgWith({ STOREYS: 2, STAIR_RISE: 10 }), { stairs: true }).some((e) => e.includes("divide")));
  assert.ok(lib.checkConfig(cfgWith({ CEILING_DROP: 6 }), { ceiling: true, floor: true }).some((e) => e.includes("ceiling")));
  assert.deepEqual(lib.checkConfig(cfgWith({ STOREYS: 2 }), ALL), []);
  assert.throws(() => lib.buildModel(roomBox(12, 10), cfgWith({ ROOF_H: 3 }), { roof: true }), /ROOF_H/);
});

test("buildModel: a flat roof covers rooms, outer walls and the overhang, not a fence", () => {
  const cfg = cfgWith({ ROOF_OVERHANG: 2 });
  const runs = roomBox(12, 10);
  runs.push({ orient: "H", line: 5, start: 12, end: 30, openings: [] });
  const m = lib.buildModel(runs, cfg, { roof: true });
  const cells = new Set();
  for (const s of m.slabs) {
    assert.equal(s.z0, lib.storeyHeight(cfg));
    for (let y = s.y0; y < s.y1; y++) for (let x = s.x0; x < s.x1; x++) cells.add(`${x},${y}`);
  }
  for (const k of ["0,0", "12,10", "-2,-2", "14,12", "6,5"]) assert.ok(cells.has(k), `roof missing ${k}`);
  assert.ok(!cells.has("-3,0") && !cells.has("20,5") && !cells.has("15,5"));
  assert.deepEqual(lib.validateSolids(m, cfg), []);
});

test("roofLayers: a stepped roof steps in ROOF_STEP each layer, each layer inside the one below", () => {
  const cfg = cfgWith({ ROOF_STEP: 1, ROOF_OVERHANG: 0 });
  const layers = lib.roofLayers(lib.roofFootprint(lib.enclosure(roomBox(10, 6)), cfg), cfg);
  assert.deepEqual(layers.map((l) => l.size), [11 * 7, 9 * 5, 7 * 3, 5 * 1]);
  for (let i = 1; i < layers.length; i++) for (const k of layers[i]) assert.ok(layers[i - 1].has(k));
  const capped = lib.roofLayers(lib.roofFootprint(lib.enclosure(roomBox(10, 6)), cfg), { ...cfg, ROOF_LAYERS: 2 });
  assert.equal(capped.length, 2);
});

test("validateSolids: catches overlaps between any two kinds, non-integers, and oversize plates", () => {
  const cfg = cfgWith({ STOREYS: 2 });
  const m = lib.buildModel(roomBox(40, 20), cfg, ALL);
  const step = m.slabs.find((s) => s.kind === "stair");
  const clash = (extra) => lib.validateSolids({ ...m, slabs: [...m.slabs, extra] }, cfg);
  assert.ok(clash({ ...step, kind: "floor", z1: step.z0 + 4 }).some((v) => v.includes("overlaps")));
  assert.ok(clash({ kind: "ceiling", x0: 0, y0: 3, x1: 1, y1: 4, z0: 10, z1: 14 }).some((v) => v.includes("overlaps wall")));
  assert.ok(clash({ kind: "roof", x0: 50, y0: 50, x1: 51, y1: 51, z0: 1, z1: 4 }).some((v) => v.includes("non-integer")));
  assert.ok(clash({ kind: "roof", x0: 50, y0: 50, x1: 90, y1: 51, z0: 400, z1: 404 }).some((v) => v.includes("FLOOR_MAX")));
});
