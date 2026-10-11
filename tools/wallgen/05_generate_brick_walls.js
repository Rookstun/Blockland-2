// Generates a Brickadia .brs/.brz save: running-bond brick walls following a
// floor plan extracted from a hand-drawn image, with door/window openings
// and interlocked corners (shared-grid domino tiling -- see lib.js and
// PIPELINE.md for the algorithm).
//
// Input: floorplan_runs.json  { width, height, runs: [{orient,line,start,end,openings:[{pos0,pos1,type}]}] }
// Output: jail_walls.brs / jail_walls.brz
//
// Run with no arguments and it behaves exactly as it always did (that's what
// run_pipeline.sh does). Every knob the GUI (gui_server.js) exposes is a flag
// here, so the GUI drives this one generator instead of growing a second copy
// of the brick-laying logic:
//
//   node 05_generate_brick_walls.js \
//     --in floorplan_runs.json --out-prefix jail_walls \
//     --config '{"WALL_COURSES":10,"WINDOW_SILL_COURSES":3}' \
//     --wall-color "#121212" --glass --glass-color "#8ad8ff" \
//     --material BMC_Plastic --intensity 0 \
//     --floor --floor-color "#6b6259" --floor-material BMC_Plastic //     --ceiling --ceiling-color "#d8d2c4" --roof --roof-color "#7a3b2e" //     --stairs --stair-color "#8a7f73"
//
// Storeys, roof shape, ceiling height and stair size are --config keys
// (STOREYS, ROOF_STEP, CEILING_DROP, STAIR_RISE, ... -- see lib.CONFIG).
//
// stdout is a single JSON stats line (the GUI parses it); all human-facing
// progress goes to stderr.

const fs = require("fs");
const brs = require("brs-js");
const lib = require("./lib");

// CONFIG keys a caller may override. Anything else passed to --config is
// rejected rather than silently ignored -- a typo'd key that quietly kept the
// default would look like "the GUI slider does nothing".
const TUNABLE = [
  "SCALE", "STUD", "COURSE_H", "WALL_COURSES", "DOOR_OPEN_COURSES",
  "WINDOW_SILL_COURSES", "WINDOW_OPEN_COURSES", "WALL_THICKNESS",
  "CORNER_SNAP", "MARGIN", "FLOOR_H", "FLOOR_MAX", "STOREYS",
  "CEILING_H", "CEILING_DROP", "ROOF_H", "ROOF_OVERHANG", "ROOF_STEP", "ROOF_LAYERS",
  "STAIR_WIDTH", "STAIR_RISE", "STAIR_RUN",
];

// The optional parts of the building: flag name, default colour. Each gets
// --<name>, --no-<name>, --<name>-color and --<name>-material.
const PARTS = { floor: "#6b6259", ceiling: "#d8d2c4", roof: "#7a3b2e", stairs: "#8a7f73" };

const MATERIALS = ["BMC_Plastic", "BMC_Glass", "BMC_Glow", "BMC_Metallic", "BMC_Hologram"];

function parseArgs(argv) {
  const opts = {
    in: "floorplan_runs.json",
    outPrefix: "jail_walls",
    wallColor: "#121212",
    wallType: "brick",
    glass: false,
    glassColor: "#8ad8ffb0",
    material: "BMC_Plastic",
    glassMaterial: "BMC_Glass",
    intensity: 0,
    description: "Generated brick walls from floor plan sketch",
    config: {},
  };
  for (const [part, color] of Object.entries(PARTS)) {
    opts[part] = false;
    opts[part + "Color"] = color;
    opts[part + "Material"] = "BMC_Plastic";
  }
  // "--stair-color" reads better than "--stairs-color"; accept both.
  const partFlag = (a) => {
    const m = /^--(no-)?(floor|ceiling|roof|stairs?)(-color|-material)?$/.exec(a);
    if (!m) return null;
    const part = m[2] === "stair" ? "stairs" : m[2];
    return { part, off: Boolean(m[1]), field: m[3] === "-color" ? "Color" : m[3] === "-material" ? "Material" : null };
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    switch (a) {
      case "--in": opts.in = next(); break;
      case "--out-prefix": opts.outPrefix = next(); break;
      case "--wall-color": opts.wallColor = next(); break;
      case "--wall-type": opts.wallType = next(); break;
      case "--glass": opts.glass = true; break;
      case "--no-glass": opts.glass = false; break;
      case "--glass-color": opts.glassColor = next(); break;
      case "--material": opts.material = next(); break;
      case "--glass-material": opts.glassMaterial = next(); break;
      case "--intensity": opts.intensity = Number(next()); break;
      case "--description": opts.description = next(); break;
      case "--config": opts.config = JSON.parse(next()); break;
      case "--help": case "-h":
        console.error(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 28).join("\n"));
        process.exit(0);
      default: {
        const pf = partFlag(a);
        if (!pf || (pf.off && pf.field)) throw new Error(`unknown argument: ${a}`);
        if (pf.field) opts[pf.part + pf.field] = next();
        else opts[pf.part] = !pf.off;
      }
    }
  }
  for (const k of Object.keys(opts.config)) {
    if (!TUNABLE.includes(k)) throw new Error(`--config: unknown key ${k} (tunable: ${TUNABLE.join(", ")})`);
    if (!Number.isFinite(Number(opts.config[k]))) throw new Error(`--config: ${k} must be a number`);
    opts.config[k] = Number(opts.config[k]);
  }
  if (!["brick", "cave"].includes(opts.wallType)) throw new Error(`--wall-type: brick or cave (got ${opts.wallType})`);
  for (const [label, m] of [["--material", opts.material], ["--glass-material", opts.glassMaterial],
                          ...Object.keys(PARTS).map((p) => [`--${p}-material`, opts[p + "Material"]])]) {
    if (!MATERIALS.includes(m)) throw new Error(`${label}: unknown material ${m} (known: ${MATERIALS.join(", ")})`);
  }
  return opts;
}

// "#rgb" / "#rrggbb" / "#rrggbbaa" -> [r, g, b, a]
function parseColor(text) {
  let s = String(text).trim().replace(/^#/, "");
  if (s.length === 3) s = [...s].map((c) => c + c).join("");
  if (s.length === 6) s += "ff";
  if (!/^[0-9a-fA-F]{8}$/.test(s)) throw new Error(`bad color: ${text} (expected #rgb, #rrggbb or #rrggbbaa)`);
  return [0, 2, 4, 6].map((i) => parseInt(s.slice(i, i + 2), 16));
}

const opts = parseArgs(process.argv);

// Merged config. BASE_Z is DERIVED from COURSE_H, so it has to be recomputed
// after the override -- carrying the stock value through a changed course
// height would sink or float the whole building by half a course.
const config = { ...lib.CONFIG, ...opts.config };
config.BASE_Z = config.COURSE_H / 2;
for (const k of ["WALL_COURSES", "COURSE_H", "STUD"]) {
  if (!(config[k] > 0)) throw new Error(`config.${k} must be > 0 (got ${config[k]})`);
}
if (config.WALL_THICKNESS !== 1) {
  // layoutCells only ever marks the single cell on a run's own line, so a
  // thickness > 1 widens bricks without widening the cells they were tiled
  // from -- which the geometry gate then (correctly) reports as half-stud
  // overlaps at every corner. Fail loudly instead of writing that.
  throw new Error("WALL_THICKNESS other than 1 is not supported by the shared-grid tiling");
}
if (config.WINDOW_SILL_COURSES + config.WINDOW_OPEN_COURSES > config.WALL_COURSES) {
  console.error(
    `warning: window band (sill ${config.WINDOW_SILL_COURSES} + open ${config.WINDOW_OPEN_COURSES}) ` +
    `reaches above the wall top (${config.WALL_COURSES} courses) -- windows will be open to the sky`
  );
}
// Plate thicknesses, stair rise vs storey height, ceiling vs floor: see
// lib.checkConfig (the GUI preview runs the same check).
const configErrors = lib.checkConfig(config, opts);
if (configErrors.length) throw new Error("bad settings:\n  - " + configErrors.join("\n  - "));
if (config.STOREYS > 1 && !opts.floor) {
  console.error(`warning: ${config.STOREYS} storeys but no --floor -- the upper storeys have nothing to stand on`);
}
if (config.STOREYS > 1 && !opts.stairs) {
  console.error(`warning: ${config.STOREYS} storeys but no --stairs -- the upper storeys can't be reached`);
}
if (config.DOOR_OPEN_COURSES >= config.WALL_COURSES) {
  console.error(`warning: doors are open for all ${config.WALL_COURSES} courses -- no lintel above them`);
}

const plan = JSON.parse(fs.readFileSync(opts.in, "utf8"));

const finalRuns = lib.normalizeRuns(plan.runs, config);
lib.snapEndpoints(finalRuns, config);
// Walls, panes, floors, ceiling, roof and stairs all come from one model,
// the same one the GUI's 3D preview draws.
const model = lib.buildModel(finalRuns, config, opts);
let wallBricks = model.walls.map((b) => lib.toWorldBrick(b, config));

console.error(`generated ${wallBricks.length} bricks across ${finalRuns.length} wall runs` +
              (config.STOREYS > 1 ? ` in ${config.STOREYS} storeys` : ""));

// Every geometry bug found so far (collapsed runs, connections into
// openings, non-integer positions, double-covered cells, sub-stud
// gaps/overlaps) was found by a human noticing ONE bad spot in a
// screenshot. That doesn't prove the rest of the building is clean -- this
// does, exhaustively, every time. A violation here must stop the file from
// being written, not just get logged.
//
// Only the WALL bricks go through this gate, and deliberately so: its
// cell-coverage and facing-edge checks describe load-bearing brickwork, while
// window panes legitimately occupy the cells the walls left empty. Everything
// else goes through the second gate below.
lib.assertValidGeometry(finalRuns, wallBricks, config);
console.error("geometry validated: no invariant violations");

// Second gate, over everything in the save: no two solids of any kind share
// volume, every coordinate is an integer, no plate exceeds FLOOR_MAX. It
// checks final boxes, not the code that placed them -- see lib.validateSolids.
const solidViolations = lib.validateSolids(model, config);
if (solidViolations.length > 0) {
  throw new Error(
    `Refusing to write output: ${solidViolations.length} solid violation(s) found.\n` +
    solidViolations.slice(0, 20).map((v) => "  - " + v).join("\n")
  );
}

// Cave walls: validated above as course bricks, written as 1x1 stone
// columns over exactly the same cells (see lib.caveWallBricks).
if (opts.wallType === "cave") {
  wallBricks = lib.caveWallBricks(model.walls, config);
  console.error(`cave wall type: ${wallBricks.length} stone columns`);
}

const glassBricks = model.glass.map((b) => lib.toWorldBrick(b, config));
if (opts.glass) console.error(`filled window openings with ${glassBricks.length} pane bricks`);

const partBricks = {};
for (const part of ["floor", "ceiling", "roof", "stairs"]) {
  const kind = part === "stairs" ? "stair" : part;
  partBricks[part] = model.slabs.filter((sl) => sl.kind === kind).map((sl) => lib.toWorldSlab(sl, config));
}
const studs = (list) => list.reduce((n, f) => n + (f.x1 - f.x0) * (f.y1 - f.y0), 0);
if (opts.floor) {
  console.error(`floored ${studs(partBricks.floor)} enclosed studs with ${partBricks.floor.length} plates` +
                (config.STOREYS > 1 ? ` across ${config.STOREYS} storeys` : ""));
}
if (opts.ceiling) console.error(`ceiling: ${partBricks.ceiling.length} plates over ${studs(partBricks.ceiling)} studs`);
if (opts.roof) {
  const layers = new Set(partBricks.roof.map((r) => r.z0)).size;
  console.error(`roof: ${partBricks.roof.length} plates in ${layers} layer(s)`);
}
if (opts.stairs && config.STOREYS > 1) {
  console.error(`stairs: ${model.stairs.flights.length} flights (${partBricks.stairs.length} steps) in ` +
                `${model.stairs.buildings - model.stairs.unplaced.length} of ${model.stairs.buildings} buildings`);
}
for (const w of model.warnings) console.error(`warning: ${w}`);

// Palette: the pane/floor/ceiling/roof/stair colours and materials only enter
// the save when those bricks exist, so a run without those flags writes byte-identical
// output to the pre-GUI generator (and doesn't leave an unused swatch in the
// in-game colour picker).
const colors = [parseColor(opts.wallColor)];
const materials = [opts.material];
const addStyle = (color, material) => {
  colors.push(parseColor(color));
  if (!materials.includes(material)) materials.push(material);
  return { color: colors.length - 1, material: materials.indexOf(material) };
};
const glassStyle = glassBricks.length > 0 ? addStyle(opts.glassColor, opts.glassMaterial) : null;
const bricks = [
  ...wallBricks.map((b) => ({ b, color: 0, material: materials.indexOf(opts.material) })),
  ...glassBricks.map((b) => ({ b, ...glassStyle })),
];
for (const part of ["floor", "ceiling", "roof", "stairs"]) {
  if (partBricks[part].length === 0) continue;
  const style = addStyle(opts[part + "Color"], opts[part + "Material"]);
  bricks.push(...partBricks[part].map((b) => ({ b, ...style })));
}

const saveObject = {
  version: 10,
  game_version: 0,
  map: "Plate",
  author: { id: "00000000-0000-0000-0000-000000000000", name: "Claude" },
  host: { id: "00000000-0000-0000-0000-000000000000", name: "Claude" },
  description: opts.description,
  save_time: [0, 0, 0, 0, 0, 0, 0, 0],
  mods: [],
  brick_assets: ["PB_DefaultBrick"],
  colors,
  materials,
  physical_materials: ["BPMC_Default"],
  brick_owners: [{ id: "00000000-0000-0000-0000-000000000000", name: "Claude", display_name: "Claude", bricks: bricks.length }],
  brick_count: bricks.length,
  bricks: bricks.map(({ b, color, material }) => ({
    asset_name_index: 0,
    size: [b.sx, b.sy, b.sz],
    position: [b.x, b.y, b.z],
    direction: 4,
    rotation: 0,
    collision: true,
    visibility: true,
    material_index: material,
    physical_index: 0,
    material_intensity: opts.intensity,
    color,
    owner_index: 1,
  })),
};

const brsPath = `${opts.outPrefix}.brs`;
const brzPath = `${opts.outPrefix}.brz`;

const buf = brs.write(saveObject);
fs.writeFileSync(brsPath, Buffer.from(buf));
console.error(`wrote ${brsPath} (${buf.length} bytes)`);

// Current Brickadia clients load the newer .brz/.brdb database format from
// Saved/Builds, not legacy .brs -- write that too, from the same save object.
const brzBuf = brs.writeBrzLegacy(saveObject);
fs.writeFileSync(brzPath, Buffer.from(brzBuf));
console.error(`wrote ${brzPath} (${brzBuf.length} bytes)`);

if (process.env.DEBUG_DUMP) {
  fs.writeFileSync("bricks_debug.json", JSON.stringify(wallBricks.concat(glassBricks, ...Object.values(partBricks))));
  console.error("wrote bricks_debug.json");
}

// Machine-readable summary for the GUI: the ONLY thing written to stdout.
const openingCount = (type) =>
  finalRuns.reduce((n, r) => n + r.openings.filter((o) => o.type === type).length, 0);
process.stdout.write(JSON.stringify({
  runs: finalRuns.length,
  bricks: bricks.length,
  wallBricks: wallBricks.length,
  glassBricks: glassBricks.length,
  floorBricks: partBricks.floor.length,
  ceilingBricks: partBricks.ceiling.length,
  roofBricks: partBricks.roof.length,
  stairBricks: partBricks.stairs.length,
  storeys: config.STOREYS,
  buildings: model.stairs.buildings,
  stairsPlaced: model.stairs.buildings - model.stairs.unplaced.length,
  warnings: model.warnings,
  doors: openingCount("door"),
  windows: openingCount("window"),
  courses: config.WALL_COURSES,
  heightWorld: lib.totalCourses(config) * config.COURSE_H,
  brs: { path: brsPath, bytes: buf.length },
  brz: { path: brzPath, bytes: brzBuf.length },
}) + "\n");
