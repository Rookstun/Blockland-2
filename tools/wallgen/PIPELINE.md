# Wall-generation pipeline: how it works, and where it breaks

Five scripts turn `jail.png` (a hand-drawn top-down floor plan) into a
Brickadia `.brz`/`.brs` save with brick walls, running-bond coursing,
interlocked corners, and door/window openings. This document explains what
each stage actually does and, more importantly, the specific conditions
under which it produces wrong output. Several of these failure modes were
found by hitting them in this exact image; they're recorded here rather
than just silently fixed so the next failure is faster to diagnose.

Nothing in this pipeline is manually traced from the image by eye. Every
stage is pixel/data driven; the only human-in-the-loop part is *reviewing*
rendered output and going back to fix the code when it's wrong.

## The GUI

`npm start` serves `builder_gui.html` from `gui_server.js` on
<http://localhost:3010>: import a photo, set wall height / door + window
bands / opening margins / storeys + stairs / floors + ceiling / roof /
colour, generate, preview, export.

It is a driver, not a second implementation. Every generate shells out to the
same five stage scripts `run_pipeline.sh` runs, passing the GUI's values as
flags those stages already accept, and the Log tab prints the exact command
line for each stage so any build the GUI made can be reproduced by hand (and
vice versa). Nothing in the GUI re-derives geometry — anything structural is
still stage 5 + `lib.js`, still behind `assertValidGeometry`.

Notes on the pieces that aren't just "a field per flag":

- **Stages are parameterised, not duplicated.** Stages 1-4 grew `argparse`
  flags for their tuning constants and I/O paths, with the old values as
  defaults, so `run_pipeline.sh` and `tests/test_pipeline.py` (which invoke
  them bare) are unaffected. Stage 5 takes `--config '<json>'` for
  `lib.CONFIG` overrides and rejects unknown keys rather than ignoring them:
  a typo'd key that silently kept the default would present as "the GUI
  slider does nothing". It also recomputes `BASE_Z` from the overridden
  `COURSE_H` — that value is derived, and carrying the stock one through a
  changed course height sinks the whole building by half a course.
- **Per-image working directory.** Each generate runs in
  `gui_runs/<image-slug>/`, so the intermediate JSON and the `.brs`/`.brz`
  never overwrite the checked-in `jail_walls.*` / `floorplan_runs.json` in the
  project root.
- **Imports are downscaled in the browser** (default 500 px on the long
  edge). Stage 1 scans the ink mask row by row in Python, and one source
  pixel becomes one stud, so a full-resolution phone photo is both slow and a
  4000-stud-wide building. `--ink-threshold` and `--tolerance` exist for the
  same reason: a photo's greys and JPEG-fringed markers need different
  cutoffs than a clean digital sketch.
- **Window panes are optional and validated separately.** `--glass` fills
  each window opening's open courses with pane bricks (`lib.layWindowGlass`,
  tiled on the same shared grid as the brickwork). They are deliberately NOT
  passed through `assertValidGeometry`: its cell-coverage and facing-edge
  checks describe load-bearing brickwork, and panes legitimately occupy the
  cells the walls left empty — so they get the one check that applies to any
  brick, integer world coordinates, which the `.brz` writer rejects otherwise.
- **Floors are optional and only go where walls enclose.** `--floor` lays
  plates (`FLOOR_H` = 4 world units, one plate, sitting on the ground in
  the cells between walls) via `lib.layFloor`. A room is whatever a flood
  fill from outside the plan's bounding box can't reach, with every wall
  cell (doorways and windows included) blocking it. So an unclosed wall
  line such as the jail's perimeter fence floors nothing, and neither does
  the yard between buildings. Ground-level doorway cells that open onto a
  room are floored too, so doorways don't leave a trench. Cells are
  greedy-merged into rectangles no longer than `FLOOR_MAX` (32) studs a
  side, which is 135 plates for `jail.png`. The walls' gate doesn't cover
  plates; `lib.validateFloor` checks them against the final wall bricks
  (no plate under a ground-course brick, no two plates on one cell, integer
  coordinates) and stage 5 refuses to write on any violation. The 3D
  preview loads `lib.js` from the server (`/lib.js`) and runs the same
  `layFloor` with the current controls rather than keeping a copy of it.
  **Limit:** a room whose wall has a gap the drawing didn't close (a
  missing corner, a wall dropped by `MIN_RUN`) leaks to the outside and
  gets no floor at all. That's visible in the preview, but nothing flags
  it. The same limit applies to ceilings, roofs and stairs below, which all
  start from the same room analysis (`lib.enclosure`).
- **Storeys, stairs, ceiling and roof all come from `lib.buildModel`.**
  Stage 5 builds the save from it, and the 3D preview runs the same function
  in the browser, so the two can't disagree. The rules:
  - **Storeys** (`STOREYS`): each storey is another `WALL_COURSES` of wall,
    with the door/window bands repeated from that storey's floor
    (`courseIsOpen` works on `course % WALL_COURSES`). Two exceptions:
    - Only building walls go up. A wall cell goes up if it touches a room
      (8-neighbour), so the jail's fence stays one storey even where it
      T-joins a building (`markBuildings` → `run.upper`).
    - An exterior door (outside on either side) is solid wall above the
      ground storey, since up there it would open onto a drop
      (`opening.exterior`).
  - **Floors** go on every storey.
  - **Ceiling:** the top storey only, `CEILING_DROP` courses below the wall
    top. Lower storeys' ceiling is the floor above.
  - **Roof:** sits on the wall top. It covers each building's rooms plus the
    wall cells touching them, widened by `ROOF_OVERHANG`, so fences never get
    a roof. `ROOF_STEP` > 0 gives a stepped hip roof: layer *k* keeps the
    cells more than *k*·`ROOF_STEP` studs (chessboard distance) from the
    edge, so every layer rests entirely on the one below.
  - **Stairs** are *placed*, not traced (a floor plan has no stair symbol).
    Each building gets one switchback stack in the rectangle that fits:
    - The rectangle is 2 × `STAIR_WIDTH` wide and (storey height ÷
      `STAIR_RISE`) × `STAIR_RUN` treads long, plus a landing row at each end.
    - Every cell must be room interior, and none may be next to a doorway.
      Among the spots that fit, the one hugging the most wall wins.
    - Flights alternate strips and direction. The top step is flush with the
      next floor's surface, and each flight's treads are cut out of the floor
      above it (the stairwell), so there's a full storey of headroom.
    - `STAIR_RISE` must divide the storey height, or the top step can't meet
      the floor; `checkConfig` refuses the settings.
    - A building with no room big enough gets no stairs, plus a warning in
      the log and the status line.
- **Second gate: `lib.validateSolids`.** It runs on every generate, after
  `assertValidGeometry`, and refuses to write if any two solids of any kind
  (wall, pane, floor, ceiling, roof, stair step) share volume, if any world
  coordinate isn't an integer, or if any plate is longer than `FLOOR_MAX`. It
  checks the final boxes rather than the code that placed them, so a
  placement bug anywhere shows up as a refused build, never as a floor
  through a stair.
- **The preview draws stud columns, far to near, bottom-up.** For
  one-stud-footprint boxes that painter's order is exact. It skips faces a
  neighbouring column covers and floor tops hidden under the slab above. The
  "show" menu can drop the roof, the ceiling, or everything above a chosen
  storey, which is how you check stairwells and upper floors. Dragging and
  zooming move the last frame, and it redraws once you stop.
- **`WALL_THICKNESS` is not exposed.** `layoutCells` only ever marks the one
  cell on a run's own line, so a thickness > 1 widens bricks without widening
  the cells they were tiled from, and the geometry gate then correctly reports
  half-stud overlaps at every corner. Stage 5 throws on it rather than
  offering a knob that only produces refused builds.
- **The 3D preview follows the controls, not the file.** It renders from the
  extracted plan plus the current course settings using the same open/solid
  rule as `lib.courseIsOpen`, so raising a sill shows what raising the sill
  will build; when the controls no longer match the last generate, the status
  line says so instead of implying the `.brz` on disk changed too.

## The validation gate

Every bug in the table below up to a point was found the same way: a human
looked at one screenshot, noticed one bad spot, and it got fixed. That
proves the one spot is clean. It proves nothing about the rest of the
building — and repeatedly, "we fixed the case we found" turned out to mean
"there are more we didn't look for." `lib.js` now has
`assertValidGeometry(runs, bricks)`, called unconditionally by
`05_generate_brick_walls.js` on every run, which checks the WHOLE building
against every invariant discovered so far (collapsed runs, openings
extending outside their own wall, a wall connecting into another wall's
door/window, non-integer brick positions, double-covered cells, and
sub-stud world-space gaps/overlaps) and throws — refusing to write the
output file at all — if any of them is violated anywhere. This turns "we
checked this spot" into "this class of bug cannot ship," which is the only
way "it can't happen even once" is actually true rather than aspirational.

`tests/test_bricklaying.test.js` tests `validateGeometry` itself against
deliberately broken input for each check, and separately confirms that the
opening-conflict check does NOT depend on `classifyEnd`/`resolveOpeningConflicts`
being correct (it re-derives the violation from final coordinates only) —
a check that can only ever agree with the code it's supposed to be
policing is not an independent check.

## Tests

`tests/` has automated regression tests for every bug in the table at the
bottom of this document (except the ones marked superseded by the Stage 5
rewrite, which the shared-grid design makes structurally impossible rather
than something to keep re-checking).

- **`tests/test_bricklaying.test.js`** — unit tests for `lib.js` (the
  brick-laying core, extracted from `05_generate_brick_walls.js` so it's
  importable). Covers running-bond tiling, door/window course-banding,
  closest-candidate corner matching, endpoint snapping, integer-only
  output, and the shared-grid guarantees (no cell double-covered, no cell
  missing, correct alternation at a corner). Run: `node --test tests/`
- **`tests/test_pipeline.py`** — black-box tests for stages 1-3. These
  build tiny synthetic fixture images on the fly (a few lines of pixels,
  not `jail.png`) and run the actual scripts as subprocesses, because the
  bugs they check for live in the real mask/threshold/merge logic, not
  something worth reimplementing in the test. Run:
  `python3 -m unittest discover -s tests`

Both suites pass as of this writing. Each test was checked to actually
fail when its corresponding fix is reverted (not just pass vacuously) —
this was done by hand for the two trickiest ones (`GAP_MAX`, the
line-coordinate bug) and is worth re-doing for any *new* test added later.

## Stage 1 — `01_extract_walls.py`: find wall lines

**What it does:** Loads the image, builds a boolean mask of "wall ink"
(pixels that are grayscale — R≈G≈B — and dark, `R<200`). For every row it
finds horizontal runs of ink at least `MIN_RUN` (6px) long; for every
column it does the same for vertical runs. Adjacent rows/columns whose
runs overlap in position are merged into a single wall "band" (this is
what collapses a 1-3px-thick anti-aliased line into one wall). Output:
`wall_segments.json`, a flat list of horizontal/vertical segments.

**Fails when:**
- **A wall is shorter than `MIN_RUN`.** Dropped entirely, silently. This
  is a hard cutoff with no partial credit.
- **A door/window color marker sits ON a wall line and splits it.** Marker
  pixels are deliberately *not* counted as wall ink (see Stage 3 for why).
  If a marker sits in the middle of a wall, the wall becomes two shorter
  stubs on either side of it. If either stub is shorter than `MIN_RUN`,
  that stub vanishes — this once deleted an entire closet's dividing
  walls because each stub was 5-7px against a `MIN_RUN` of 8. Lowering
  `MIN_RUN` to 6 was the fix, but it's a threshold, not a real solution:
  a wall stub of 5px or less will still disappear.
- **The wall isn't axis-aligned.** Only horizontal/vertical runs are
  detected. Diagonal or curved walls are invisible to this stage and
  every stage after it.
- **The line is too light or too thin.** `R<200` and requiring
  approximately equal R/G/B excludes faint pencil-style strokes and
  excludes any wall drawn in a non-gray color (it would be picked up as a
  "marker" color instead, or missed entirely if it matches none of the
  known marker colors).
- **Two closely-spaced parallel walls** (a thin double wall, or a wall
  right next to a thick baseboard-style line) can merge into one band if
  the gap between them is within `MERGE_GAP` (3px) — the two walls become
  one, at the wrong thickness/position.

## Stage 2 — `02_extract_openings.py`: find door/window markers

**What it does:** Matches pixels against five known marker colors (cyan =
window; red/blue/green/yellow = door) within a color-distance tolerance,
then groups matching pixels into connected components (4/8-neighbor BFS).
Each component's bounding box and centroid become one "marker" record.
Output: `openings.json`.

**Fails when:**
- **A marker uses a color outside the five recognized ones.** It's
  invisible — not even logged as unrecognized ink.
- **A marker is a single isolated pixel.** Components with fewer than 2
  pixels are discarded as anti-aliasing noise, which also discards a
  genuinely tiny marker.
- **Two markers touch or are drawn overlapping** (e.g. two doors very
  close together). They merge into one connected component and are
  treated as a single marker with one centroid, silently losing one of
  the two openings.
- **All four of red/blue/green/yellow collapse to the same meaning**
  ("door"). If the sketch used different door colors to mean different
  door types/widths, that information is discarded at this stage and
  unrecoverable later.

## Stage 3 — `03_build_floorplan.py`: assemble wall runs + classify openings

**What it does three things:**

1. **Groups segments into infinite "lines."** Segments are bucketed by
   their constant coordinate (y for horizontal, x for vertical) using a
   greedy tolerance match (`LINE_SNAP` = 4px): a new segment joins an
   existing bucket if it's within 4px of *that bucket's registered
   value* (the first segment's coordinate, not a running average).
2. **Merges collinear segments into runs**, treating the gap between two
   consecutive segments on the same line as an opening if the gap is
   `<= GAP_MAX` (40px), otherwise starting a new, separate run.
3. **Classifies each opening's type** by finding the nearest color marker
   (greedy global assignment: cheapest line-distance + position-distance
   pairing wins, each marker used once) and defaulting to "door" if
   nothing matches. Markers that don't land inside any detected gap
   ("orphans") get a synthesized cut of a fixed default width (5px door /
   9px window) carved directly into whatever wall run's span contains
   them.

**Fails when:**
- **`GAP_MAX` is too large relative to the sketch's actual door/window
  sizes.** Two genuinely separate structures with empty space between
  them (e.g. two different buildings) get fused into one wall with a
  single opening spanning the entire gap — this happened at `GAP_MAX=55`
  when two buildings 52-53px apart were merged and the whole gap was
  labeled a "door." There is no principled way to pick this threshold
  from the image alone; it was tuned by inspecting the actual gap-width
  distribution in *this* sketch (real openings topped out at 31px) and
  will need re-tuning for a differently-scaled sketch.
- **`GAP_MAX` is too small.** A legitimately wide window/opening wider
  than the threshold doesn't get bridged at all — it becomes two
  unconnected wall stubs with a plain, untyped gap between them, and the
  brick generator will render that as bare open space rather than a
  sill+lintel window.
- **`LINE_SNAP` bucketing borrows the wrong coordinate.** Two *unrelated*
  walls that happen to be within 4px of each other in their constant
  coordinate (common in a hand-drawn sketch) land in the same bucket. If
  their spans don't overlap they still end up as separate final runs (no
  false merge), but the run's reported line coordinate can be silently
  borrowed from the other, unrelated wall — a small (1-4px) but real
  positioning error. *(Fixed 2026-09-26: segments now chain onto a run
  only from that run's own last line, never onto a run they overlap on a
  different line, and every run -- including pieces split off later --
  takes its line from its own segments. See the bug table.)*
- **Greedy marker matching still picks a wrong pairing** in dense marker
  areas. One confirmed case: a door marker for a horizontal wall was
  nearly assigned to a window gap on a different, non-collinear vertical
  wall because both were within the matching tolerance and the (now
  fixed) matching logic checked each gap independently instead of
  globally. The current greedy-global version is more robust but still a
  heuristic — it picks the single best pairing by distance, which isn't
  guaranteed correct when multiple candidates are close in both line- and
  position-distance.
- **Marker-vs-wall-ink is an inherent trade-off, not a solved problem.**
  Excluding marker colors from wall-ink (current design) is what makes
  `MIN_RUN` sensitive to short stubs (see Stage 1). The alternative —
  treating marker pixels as wall ink so short stubs never drop out — was
  tried and reverted, because it also bridges *over* markers that sit at
  the edge of an already-real gap, shrinking that gap's detected width
  (this once cut a real 34px window opening down to 13px). Neither
  approach is correct in all cases; the current code picks the
  fewer-worse-failures option for this image, not a general solution.
- **A synthesized default-width cut is just a guess.** If the sketch's
  intended door/window is wider or narrower than the 5px/9px default, the
  cut will be the wrong size with no way to detect the mismatch.
- **An orphan marker that lands outside every run's span is dropped.** If
  a window is meant to define a wall that doesn't exist in the extracted
  geometry at all (rather than cut into an existing one), nothing is
  synthesized — it's logged as "unplaced" and otherwise ignored.

## Stage 4 — `04_visualize_floorplan.py`: QA render

Pure rendering, no logic that affects the final build. Draws the runs and
openings from `floorplan_runs.json` **on top of the faded source image**
(`--image`, which the GUI and `run_pipeline.sh` pass), so a wall or opening
that isn't in the drawing shows up as a line off the ink. It refuses to run
if the image's size doesn't match the plan's. Its only "failure mode" is misleading a reviewer if the
rendering itself has a bug independent of the underlying data (this has
not happened, but is worth remembering: the overlay is only as trustworthy
as its own drawing code).

## Stage 5 — `05_generate_brick_walls.js`: lay bricks

**This stage was rewritten from a per-run endpoint-matching design to a
shared-grid design after the first design proved too fragile (see the bug
table below for why).** Current approach:

1. Converts stud-scale runs/openings into a shared integer-stud coordinate
   space (with a margin offset). Endpoints that are within `CORNER_SNAP`
   of a perpendicular run's tip still get snapped onto that run's exact
   centerline first (hand-drawn corners are rarely pixel-perfect), so two
   walls meant to meet actually occupy the same grid cell.
2. **Per course, build a shared occupancy grid**: every unit-length stud
   of every run becomes one cell at its `(x, y)` grid coordinate (skipping
   cells inside an open door/window span for that course). A corner is
   simply the cell an H-run and a V-run both happen to touch — there is no
   cross-run distance matching or "which wall wins" computation.
3. **Each cell picks its own axis from its neighbors, locally**: touched
   only by a horizontal run → horizontal; only vertical → vertical; touched
   by both (a true corner/T/cross) → alternate by course parity, H claims
   it on even courses, V on odd. Whichever axis loses simply doesn't
   include that cell in its own row/column for this course — which is
   exactly the old "retract by one wall thickness" behavior, except it
   falls out of the model instead of being a distance computed against a
   possibly-wrong partner.
4. Each axis is tiled independently (row-by-row for horizontal cells,
   column-by-column for vertical) into running-bond bricks — contiguous
   stretches of cells cut on a *global* stud grid whose parity flips every
   course, so joints stagger by 1 stud between courses everywhere. Door/
   window course-banding (bottom-3-of-6 for doors, middle 2-course band for
   windows) is unchanged from before.

**Why the previous per-run design was replaced:** it computed, for each
run's endpoint, the *distance* to every candidate perpendicular run and
picked one as "the" corner partner, then retracted that run's start/end by
a fixed amount on losing courses. This required getting three independent
things exactly right — which partner is correct, the exact retraction
distance, and exact coordinate alignment between the two — and each was a
real, separate bug in turn (wrong-partner selection, full-stud vs
half-stud retraction, unsnapped coordinates). The shared-grid design has
no "partner" concept at all: two runs interlock because they literally
touch the same cell, so there's no distance to get wrong and no partner to
mis-pick. **Verified after the rewrite**: zero double-covered cells and
zero missing courses across the whole jail floor plan (checked
programmatically, not just visually), plus a clean top-down render at
every course.

**Still fails when:**
- **Door/window heights are pure invention.** The source image is a
  top-down sketch with no height information at all. `WALL_COURSES`,
  `DOOR_OPEN_COURSES`, `WINDOW_SILL_COURSES`, `WINDOW_OPEN_COURSES` are
  fixed constants applied identically to every opening regardless of
  what the original sketch might have intended (a double door and a
  small window are given the same treatment, differing only in plan-view
  width).
- **`SCALE` (1 image pixel = 1 stud) is an arbitrary fixed choice.** A
  sketch drawn at a different pixel density would produce disproportionate
  room sizes without manually adjusting `SCALE` — this bit the standalone
  `testfile.png` test image, which is only 64x64px and needed `GAP_MAX`
  re-tuned in Stage 3 for its scale (see that stage's notes).
- **No diagonal geometry, inherited from Stage 1.** Nothing in this stage
  can represent a non-axis-aligned wall even if earlier stages somehow
  produced one.
- **A junction cell touched by three or more runs still only resolves to
  one axis** (H or V by course parity) — a true 4-way crossing or a
  3-walls-at-once junction hasn't been specifically tested, only ordinary
  L-corners and T-junctions in this floor plan.

## Summary of bugs found so far in this image

| Bug | Symptom | Fix |
|---|---|---|
| Marker color split short walls below `MIN_RUN` | A closet's dividing walls vanished entirely | Lowered `MIN_RUN` 8→6; kept marker colors excluded from wall-ink |
| `GAP_MAX` too permissive (55px) | Two separate buildings fused with one giant fake "door" across open space | Lowered to 40px based on the real opening-width distribution |
| Corner retraction used full stud instead of half | Staircase notch climbing every corner (visible in-game) | Retract by `WALL_THICKNESS / 2` *(superseded — see below)* |
| (attempted, reverted) Bridging marker colors into wall-ink | Fixed the short-wall-drop bug but shrank a real 34px window to 13px | Reverted; fixed the original bug via `MIN_RUN` instead |
| `LINE_SNAP` bucket coordinate borrowing | A wall's reported position can drift 1-4px onto an unrelated nearby wall's coordinate | Recompute each run's `line` from the mean of its own segments, not the shared bucket key |
| Half-stud corner retraction produced `.5` positions | `writeBrzLegacy` rejects non-integer brick positions outright (`.brs` silently accepted them, which is worse — it means a bad file could look fine and still be malformed) | Round final brick position/size to the nearest world unit *(superseded — see below)* |
| `classifyEnd` took the first matching corner/T-junction candidate, not the closest | In a floor plan with several walls close together, most endpoints have *multiple* candidates within `CORNER_SNAP` (measured: 80 of ~106 connected endpoints in this floor plan). Taking the first one found (arbitrary iteration order) frequently picked an unrelated nearby wall instead of the true partner, so the retraction/interlock math was computed against the wrong coordinate — this produced real, visible gaps and floating-looking bricks at corners, confirmed by screenshot and reproduced deliberately with a small dense-corner test image (`testfile.png`). | Collect every candidate within tolerance and pick the closest by distance *(superseded — see below)* |
| `.5` values anywhere in `floorplan_runs.json`/`wall_segments.json`/`openings.json` | Averaging an even count of integer pixel coordinates (band thickness, marker bounding-box center, multi-segment line position) lands exactly on `X.5`. Every `.5` found so far has eventually caused a real bug once it propagated far enough — treat this as a hard invariant, not a cosmetic one. | `round()` at every point a division/average happens: band center in Stage 1, marker centroid in Stage 2, line-average and synthesized-cut bounds in Stage 3 |
| `CORNER_SNAP` decided connectivity but never aligned coordinates | Two walls meeting at a hand-drawn corner/T-junction can have independently-extracted endpoints up to `CORNER_SNAP` (3 studs = 30 world units) apart. Corner/interlock math assumes exact coincidence at that point, so the leftover slack showed up as a small but real persistent gap/overlap — visibly breaking the brick interlock even though the alternating-retraction logic itself was correct. | Snap each connected end onto the other wall's centerline (kept — still used by the current design to align grid cells) |
| **The whole per-run endpoint-matching design (distance-based partner selection + retraction)** | Each of the four rows above was a *separate* real bug in the same design, found one at a time over several rounds of screenshots. That pattern — fix one coordinate-math mistake, find another — is itself a signal the design had too many independent things that needed to be exactly right (which partner, how far to retract, whether coordinates align). | **Replaced with the shared-grid design described in Stage 5 above**: every run contributes cells to one shared per-course grid; a corner is just a cell two runs both touch, with no distance/partner computation at all. Verified via a from-scratch stress-test image (`testfile.png`, built specifically to have several walls close together) plus a programmatic check for double-covered or missing cells across the real floor plan (both clean). |
| `CORNER_SNAP` (3 studs) too tight for this floor plan's actual hand-drawing precision | Even after the shared-grid rewrite, a branch wall's endpoint still needs `snapEndpoints` to land it on the through-wall's exact row/column — if the raw extracted gap is wider than `CORNER_SNAP`, the end is classified `dangling` (no snap applied) and the branch simply doesn't reach the wall it was meant to meet, leaving a visible gap in-game. Found by scanning every `dangling` endpoint for a nearby perpendicular wall: 8 of them were genuine near-misses 4-8 studs off, confirmed against an in-game screenshot. | Raised to 10 studs. *(This fix directly caused the next row's bug — the two were found and fixed in the same pass.)* |
| Raising `CORNER_SNAP` let a short run's far end snap onto the SAME wall its near end already touched | A run shorter than `2 * CORNER_SNAP` can have both ends within tolerance of one nearby through-wall — the near end at distance ~0 (correct), the far end at up to `CORNER_SNAP` studs along that same through-wall (wrong: nothing says the candidate has to be a *different* wall, or even on the correct side of the run). This collapsed at least one real 8-stud run to zero length, which rendered in-game as a fragmented, zigzagging column of disconnected bricks — confirmed from four separate in-game screenshots of the same junction. | `classifyEnd` now rejects any candidate whose line isn't strictly on the far side of the run's OWN opposite raw endpoint, so a candidate can never cause `start >= end` |
| **Length axis and thickness axis used two different, incompatible coordinate conventions** | The length axis is boundary-based: cell `p` occupies world `[p*STUD, (p+1)*STUD)`, so a wall's length coverage always ends exactly ON a stud boundary. The thickness axis, though, was CENTERED on `line` (`line*STUD ± STUD/2`) — a different origin, offset by half a stud from the boundary system. At a corner, a branch wall's terminal cell butts against the through-wall's `line` boundary, while the through-wall's own centered thickness band starts half a stud earlier (or later, depending which side the branch approaches from) — leaving either a half-stud gap ("no brick that exists can fit there") or a half-stud overlap. Every previous verification (`.5` grep, cell-index double-coverage/missing-cell checks, even the corner-alternation test) was blind to this because it's purely a WORLD-UNIT bounding-box mismatch — none of those checks ever compared actual world-space edges between perpendicular bricks. Found only by directly reconstructing world-space bounding boxes for every H/V brick pair and measuring real gaps, after four in-game screenshots of the same junction kept showing the same unresolved defect through multiple unrelated fixes. | Thickness is now boundary-based too: `[line*STUD, (line+1)*STUD)`, matching the length axis exactly, so a wall's own `line` value IS its near face, not its center |
| **A wall's T-junction/corner connection could land inside another wall's door or window** | `classifyEnd` matched a branch wall's raw extracted position to the nearest perpendicular wall within `CORNER_SNAP`, without checking whether that exact spot fell inside the through-wall's own opening — structurally nonsensical (a wall can't anchor into a doorway) but geometrically nothing prevented it, especially with openings up to 30+ studs wide. Produced floating/extending brick geometry right at doors and windows. Found by scanning every T-junction/corner candidate for one landing inside its own opening span (13 real cases), after the user circled the exact resulting defects on the 2D floor-plan overlay across two separate buildings. | Reject any corner/T-junction candidate whose connection point falls inside that candidate's own opening span. *(Partial fix — see next row.)* |
| Rejecting a bad candidate in `classifyEnd` doesn't undo a coincidence already in the raw data | The row above stops `snapEndpoints` from *creating* an illegal connection, but a rejected end just becomes `dangling`, which means "don't move this coordinate" — not "this coordinate is fine." If the raw extracted position already sat exactly on a perpendicular wall's line (distance 0, the single most common case, since an exact match needs no snapping in the first place), it still geometrically touches that wall's opening, unchanged, regardless of what `classifyEnd` decided. The mandatory validation gate (added specifically because "it can't happen even once" is a real requirement, not a suggestion) caught 6 of these still slipping through in the actual floor plan after the "fix" above shipped. | `resolveOpeningConflicts` actively retracts (by 2 studs, keeping the even-stud grid) any endpoint still touching another wall's opening after snapping — run to a fixed point after every `snapEndpoints` call, not left as a passive rejection |
| Odd stud coordinates guarantee a 1-stud filler at that boundary | The pixel:stud:brick-pair ratio is meant to be a clean 1:1:2 (bricks tile in 2-stud pairs), but `toStud` only rounded to the nearest integer, so a coordinate could land on an odd stud with no way to divide evenly. | `toStud` now snaps to the nearest *even* stud (`2 * Math.round(px / 2)`) |
| **Wrong openings were baked into `floorplan_runs.json` by stages 1 and 3, where the stage-5 gate can't see them** | Two causes. (1) Stage 3 bridged *every* collinear gap ≤ `GAP_MAX` and called any unmarked one a "door", including gaps where both walls simply stop at a cross wall with open floor between (e.g. the left building's y=79 walls ending at the central hall): a 31px lintel floating across the room. (2) Stage 1's `MIN_RUN` dropped 1-4px wall stubs between a marker and a corner, fusing the marker's gap with the open floor past the corner (a 21px "door" at x=207, a 34px "window" at x=363), or leaving the marker with no gap on its own wall, so it was "synthesized" onto a *perpendicular* wall instead (9 of them). Every stage-5 fix above left these untouched, because the gate checks brick geometry against the plan, not the plan against the drawing; they were circled on the overlay on 2026-09-15 and resurfaced in the GUI's 3D preview. | Stage 3 splits the run instead of bridging an unmarked gap whose ends both land on a perpendicular wall (`--junction-tol`, 2px). Stage 1 keeps a run shorter than `MIN_RUN` if it butts against marker ink. On `jail.png`: 6 fake openings removed, 0 synthesized cuts left (every marker now lands on its own wall's gap), 31 markers → 31 openings. Tests in `TestNoFloatingLintels` |
| Stage 3 grouped segments into first-seen `LINE_SNAP` buckets (the "known unfixed" Stage 3 bug) | In a drawing with walls 1-4px apart (`testfile.png`), pieces of *different* walls were chained into one run: inverted openings (`pos1 < pos0`), doors spanning between unrelated walls, and, once the junction split above was added, split pieces that inherited the parent's averaged line. Stage 5's gate refused to build it; the Sep 15 build of this image only "worked" because it predates the gate. The overlay, drawn on the source image, shows how far off that plan was | Segments chain from the run's *own last* line, never across an overlap on a different line; each split piece recomputes its line from its own segments; the junction test uses the line of the wall on each side of the gap. `jail.png`'s plan is unchanged by this. `TestCloseParallelWalls`. **Note:** a drawing this fine also needs settings sized to it. The GUI now does this on image load (`sizedSettings` in `builder_gui.html`): the pixel-length extract/plan settings scale with the image's longest side relative to 500px, and `SCALE` grows so walls 1-2px apart are still ≥2 studs apart. This only touches fields still at their default, never ones you typed. For `testfile.png` (64px) that gives `--min-run 2 --merge-gap 1 --overlap-min 1`, `--gap-max 6 --line-snap 0`, `SCALE` 4, which reads every wall and doorway correctly and builds. A 500px+ image keeps the jail defaults. Also added: an unmarked gap with a perpendicular wall running into its middle (a spiral's arm tops) is split, not made a door (`TestGapCrossedByWall`) |
| (feature) Floors | Rooms had no floor | `--floor` / GUI "Floor enclosed rooms": plates under every enclosed room plus its doorways, checked by `lib.validateFloor`. The `floorCells`/`tileRects`/`validateFloor` tests in `test_bricklaying.test.js` were each confirmed to fail when their guard is removed |
| (feature) Storeys, stairs, ceiling, roof | Single-storey walls and floors only | `lib.buildModel` (see "The GUI" above), gated by `lib.validateSolids`. On `jail.png` at 3 storeys with everything on: 2 buildings, stairs placed in both, fence stays one storey, 0 violations. The default build (no new flags) is byte-identical to before. Every new test in `test_bricklaying.test.js` was confirmed to fail with its guard removed (stairwell cut-out, fence height, exterior doors upstairs, overlap check, doorway clearance, top-step height) |
| GUI 3D preview drew some far walls over near ones | Painter's sort used each span's midpoint; a long near wall with a far-away midpoint was painted under a short wall behind it | Spans are cut into ≤1px pieces before sorting |

Everything in the table has been verified against the actual extracted
data (not just visually) after each fix. As of this writing there are no
known-but-unfixed bugs, and — unlike every earlier fix in this table —
that claim is now backed by an unconditional gate (`assertValidGeometry`,
see "The validation gate" above) that runs on every generation and refuses
to write output if any known invariant is violated anywhere in the
building, not just at the one spot someone happened to look at. The gate
only covers stage 5 though; a wrong opening in `floorplan_runs.json` builds
"validly" (see the second-to-last row above). The `.5`
sweep (`grep -c '\.5' floorplan_runs.json openings.json wall_segments.json`
should print all zeros) still matters for stages 1-3, which the gate
doesn't cover. The full automated test suite (`tests/`, see the "Tests"
section above) should be run after any change to `lib.js` or the Python
stages — and if you add a new invariant to `validateGeometry`, add a test
that confirms it's independent of whatever code path it's meant to be
policing (see the "Tests" section's note on this), not just a test that
happens to pass.

## Dungeon generator — `06_generate_dungeon.js`

A second front end to the same brick-laying core: instead of tracing walls
from a drawing (stages 1-3), it *generates* the runs, a Diablo-style stack
of levels, each a different room-and-corridor layout, joined by stairs.
`node 06_generate_dungeon.js --levels 8 --seed 42 --out-prefix dungeon_runs/dungeon`
(run from `jail/`; `npm run dungeon` works only without extra flags, since
PowerShell's npm wrapper drops the `--` and npm eats the flags) writes
`dungeon_runs/dungeon.{brs,brz}`, `dungeon_map.svg` (every level's plan, up
stairs green, down stairs red, arrows pointing uphill) and
`dungeon_levels.json` (each level's runs and rooms).

- **Layout** is on a tile grid (`--tile` studs per tile, even, default 8;
  `--width`/`--height` in tiles). Rooms are random tile rectangles with a
  tile of rock between them, joined by one-tile L-shaped corridors along a
  minimum spanning tree plus `--loops` extra edges. A wall goes on every tile
  edge between two different regions; a corridor's step across one is a
  doorway, which leaves a one-stud pillar at each end of its edge, so a
  perpendicular wall (only ever at a tile corner) never lands in an opening.
- **Runs go straight into lib.js** in stud space, skipping
  `normalizeRuns`/`snapEndpoints`: every level shares one fixed `MARGIN`
  offset (per-level normalising would shift levels against each other), and
  corners are exact by construction.
- **Stacking:** level 1 on top, the deepest on the ground. Each level is
  `WALL_COURSES` of wall plus a one-course lid over its rooms and walls, so
  the pitch is a whole number of courses and `validateSolids` sees walls at
  their real height.
- **Stairs** are straight flights (`STAIR_WIDTH` x treads + a landing each
  end). Each level's down-stairs go in the room farthest from its way in.
  The level below is then generated with a room built around that exact
  rectangle and re-rolled until no doorway is next to it. The steps stand on
  the lower floor and pass through the lower lid and the upper floor; the
  top step is flush with the upper floor (level 1's entrance flight is flush
  with its lid top, the surface). `STAIR_RISE` must divide both the pitch
  and the pitch minus `FLOOR_H`.
- **Gates:** `assertValidGeometry` per level, `validateSolids` over the
  whole stack, plus two dungeon-specific checks: each top step's height
  against the floor it meets (read from the final boxes), and a flood fill
  from each way in that has to reach every room and the way down.
- **Colours** follow Diablo's tilesets by depth quarter: Cathedral,
  Catacombs, Caves, Hell.
- **Limits:** stairwells are open pits on the upper level (no railing);
  rooms are rectangles only (no caves or irregular shapes); scale is the
  jail's (`WALL_COURSES` 6, 3-course doors) unless overridden with `--config`.
