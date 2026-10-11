// renderman's outline (2026-10-03, 6 bricks at -13700..-13540, -5040..-4700)
// turned into a brick house with the wallgen lib. Plan studs: x = (wx+13700)/10,
// y = (wy+5040)/10, ground z 576. Writes rm_house_job.json (one bricks op).
const fs = require("fs");
const lib = require("./lib.js");

const OX = -13700, OY = -5040, OZ = +(process.env.OZ ?? 576);
const config = {
  ...lib.CONFIG, WALL_COURSES: 10, DOOR_OPEN_COURSES: 7, WINDOW_SILL_COURSES: 3, WINDOW_OPEN_COURSES: 4,
  CORNER_SNAP: 1, MARGIN: 0, FLOOR_MAX: 32, ROOF_STEP: 1, ROOF_OVERHANG: 1, ROOF_H: 12,
};
config.BASE_Z = config.COURSE_H / 2;

const H = (line, start, end, openings = []) => ({ orient: "H", line, start, end, openings });
const V = (line, start, end, openings = []) => ({ orient: "V", line, start, end, openings });
const door = (p, w = 4) => ({ pos0: p - w / 2, pos1: p + w / 2, type: "door" });
const win = p => ({ pos0: p - 1, pos1: p + 1, type: "window" });

// outline: west wall x0, east wall x16, middle wall x8 with the gap at y15-20,
// stub at x4 from the north end; closed off north/south, front door on the east
const raw = [
  H(0, 0, 16, [win(4), win(12)]),
  H(34, 0, 16, [win(12)]),
  V(0, 0, 34, [win(6), win(14), win(22), win(30)]),
  V(16, 0, 34, [win(6), win(14), door(28)]),
  V(8, 0, 34, [door(17)]),
  V(4, 26, 34, [door(30)]),
  H(26, 0, 8),
  H(24, 8, 16, [door(12)]),
];
const runs = lib.normalizeRuns(raw, config);
lib.snapEndpoints(runs, config);
const model = lib.buildModel(runs, config, { glass: true, floor: true, ceiling: true, roof: true, stairs: false });
if (model.warnings.length) console.error(model.warnings.join("\n"));
lib.assertValidGeometry(runs, model.walls.map(b => lib.toWorldBrick(b, config)), config);
const bad = lib.validateSolids(model, config);
if (bad.length) throw new Error(bad.slice(0, 5).join("\n"));

const BRICK = [[150, 70, 50], [135, 63, 45], [160, 75, 54], [142, 66, 47], [155, 72, 52]];
const PLANKS = [[150, 104, 64], [134, 92, 56], [160, 114, 72]];
const bricks = [];
const put = (w, extra) => bricks.push({ size: [w.sx, w.sy, w.sz], position: [OX + w.x, OY + w.y, OZ + w.z], ...extra });
for (const b of model.walls) {
  const k = (b.a * 7 + b.line * 3 + b.course * 5) % BRICK.length;
  put(lib.toWorldBrick(b, config), { color: BRICK[k] });
}
for (const b of model.glass) put(lib.toWorldBrick(b, config), { color: [170, 210, 230], material: "BMC_Glass" });
for (const s of model.slabs) {
  const w = lib.toWorldSlab(s, config);
  const m = s.kind === "floor" ? { asset: "PB_DefaultMicroBrick", color: PLANKS[2] }
    : s.kind === "ceiling" ? { asset: "PB_DefaultTile", color: [226, 218, 200] }
    : s.kind === "roof" ? { asset: "PB_DefaultTile", color: [82, 92, 112] }
    : { asset: "PB_DefaultTile", color: [118, 82, 52] };
  put(w, m);
}
// front step outside the door
put({ x: 185, y: 280, z: 2, sx: 15, sy: 20, sz: 2 }, { color: [128, 124, 118] });

const counts = {};
for (const s of model.slabs) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
console.error(`walls ${model.walls.length} glass ${model.glass.length}`, counts, "total", bricks.length);
const QUOTE = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';
fs.writeFileSync("rm_house_job.json", JSON.stringify({ ops: [
  { op: "say", msg: `<size="40"><color="ff4040"><b>${QUOTE}</></></>` },
  { op: "bricks", at: [0, 0, 0], owner: "renderman house", captureMs: 8000, bricks },
] }));
