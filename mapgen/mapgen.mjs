// Big map generator: island terrain with mountains, lakes, cliff caves (Zelda-style,
// a doorway and a room in the rock) and wallgen dungeons sunk into the ground.
//
//   node mapgen.mjs [--seed N] [--size CELLS] [--out DIR] [--dry] [--no-smooth]
//
// Writes DIR/chunk_NNN.json, each { ops: [{ op: 'bricks', at: [0, 0, 0], bricks }] },
// ready for the omegga bridge (job.mjs). Bricks use game units (stud = 10,
// brick = 12), half-extent sizes and RGB colors.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { makeGod } from './gods.mjs';
import { TOWN_CELLS, build as buildTown, surface as townSurface, planTown, planVillage, RIVER_LOCAL, PLAZA_R, distToLine } from './town.mjs';
import { floorPieces } from './floors.mjs';
import { orientFor, worldBox, ORIENT } from './orient.mjs';
import { makeBuilder } from './builder.mjs';
import { buildDungeon, SIZE as DSIZE, STOREY as DSTOREY, THEMES as DTHEMES } from './dungeon.mjs';
import { planSurfaceDungeon } from './surfacedungeon.mjs';
import { writePreview, rasterBricks } from './preview.mjs';
import { buildSettlement, buildCamp, buildDetail, buildSign, placeName, EXTERNAL_ASSETS } from './ruins.mjs';
import { FIXED as BUILDER_FIXED } from './builder.mjs';
import { treeVoxels } from '../trees/tree.mjs';
import { makeOccupancy, placeVoxelProp } from './props.mjs';
import { buildRocks, rocksFromVoxels, noise as rockNoise, RV, STONE as STONE_TONES } from './rocks.mjs';
import { shrine, CHECKPOINT_AT, FOOT as SHRINE_FOOT } from './checkpoint.mjs';
import { signpost } from './signpost.mjs';
import { coveDressing, CV as COVE_V } from './cove.mjs';
import { planCave, caveField, caveBricks } from './cavern.mjs';
import { STAGES } from './pipeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- options --
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const SEED = Number(opt('--seed', 20261001));
// --scale K (owner 2026-10-05: "make the world 3x bigger and spread out"): the
// map side, the island, the town's place on it, biome sizes and the spacing
// and number of hamlets, outposts and caves all scale by K; buildings,
// dungeons and the town itself keep their size, the terrain noise its grain.
const K = Number(opt('--scale', 1));
const N = Number(opt('--size', 2 * Math.round((576 * K) / 2))); // cells per side
const OUT = path.resolve(opt('--out', path.join(HERE, 'out')));
const DRY = args.includes('--dry');
// --params FILE (editor/, 2026-10-06): a flat JSON { "group.key": value } of
// tunables overriding the defaults below; tune() records each one (with its
// default) so the preview header can list them. No file = the live map.
const PJ = opt('--params', null) ? JSON.parse(fs.readFileSync(opt('--params'), 'utf8')) : {};
const PARAMS = PJ.params && typeof PJ.params === 'object' && !Array.isArray(PJ.params) ? PJ.params : PJ; // an editor preset { seed, scale, params } works too
const TUNED = {};
const tune = (key, def, note = '') => {
  const val = Object.prototype.hasOwnProperty.call(PARAMS, key) ? PARAMS[key] : def;
  TUNED[key] = { def, val, note };
  return val;
};
// pipeline.mjs (2026-10-16): each section opens with stage('<id>'); a stage that runs
// out of the registry's order throws, so pipeline.mjs is the generation order.
// STAGE_LOG (ms per stage) goes into preview headers and OUT/pipeline.json.
const STAGE_LOG = [];
let stageAt = -1;
function stage(id) {
  const i = STAGES.findIndex(s => s.id === id);
  if (i < 0) throw new Error(`stage '${id}' is not in pipeline.mjs`);
  if (i <= stageAt) throw new Error(`stage '${id}' runs out of order (after '${STAGES[stageAt].id}'): fix pipeline.mjs or the code`);
  const now = Date.now(), last = STAGE_LOG[STAGE_LOG.length - 1];
  if (last) last.ms = now - last.t;
  STAGE_LOG.push({ id, t: now });
  stageAt = i;
  if (stageHook) stageHook(id);
  if (process.env.MAPGEN_HTRACE) htrace(id);
}
// MAPGEN_HTRACE='x0,y0,x1,y1' (live coords) [+ MAPGEN_HTRACE_OUT=file]: after the town is placed,
// write the box's ground heights each time a stage has changed them, plus the road/river flags
let htraceSnap = null;
function htrace(id) {
  let sh; try { sh = [-(X0 + (town.fx + TOWN.cells / 2) * CELL), -(Y0 + (town.fy + TOWN.cells / 2) * CELL)]; } catch { return; }
  const [a, b, c, d] = process.env.MAPGEN_HTRACE.split(',').map(Number);
  const x0 = Math.floor((a - sh[0] - X0) / CELL), x1 = Math.floor((c - sh[0] - X0) / CELL);
  const y0 = Math.floor((b - sh[1] - Y0) / CELL), y1 = Math.floor((d - sh[1] - Y0) / CELL);
  const out = process.env.MAPGEN_HTRACE_OUT || 'htrace.txt';
  const cur = []; for (let y = y1; y >= y0; y--) for (let x = x0; x <= x1; x++) cur.push(H[x * N + y]);
  const flag = (name, f) => { try { return f(); } catch { return null; } };
  if (!htraceSnap) fs.writeFileSync(out, `box cells x ${x0}..${x1} y ${y0}..${y1}; live x = ${X0 + sh[0]} + cx*${CELL}, y = ${Y0 + sh[1]} + cy*${CELL}\n`);
  if (htraceSnap && cur.every((v, i) => v === htraceSnap[i]) && id !== 'desertGround') return;
  let s = `\n== H before ${id}${htraceSnap ? '' : ' (first)'}\n`;
  let k = 0;
  for (let y = y1; y >= y0; y--) { s += String(Y0 + sh[1] + y * CELL).padStart(6); for (let x = x0; x <= x1; x++, k++) { const v = cur[k]; s += (htraceSnap && htraceSnap[k] !== v ? '*' : ' ') + String(v).padStart(3); } s += '\n'; }
  if (id === 'desertGround') {
    s += `\n== flags before desertGround: R road graded, P path, T tunnel, B bridge, ~ river, c cutRock, k keepOut\n`;
    for (let y = y1; y >= y0; y--) { s += String(Y0 + sh[1] + y * CELL).padStart(6); for (let x = x0; x <= x1; x++) { const n = x * N + y;
      const f = [flag('', () => roadGraded[n] && 'R'), flag('', () => pathCell[n] && 'P'), flag('', () => tunnelZ[n] >= 0 && 'T'), flag('', () => bridgeZ[n] >= 0 && 'B'), flag('', () => riverCell[n] && '~'), flag('', () => cutRock[n] && 'c'), flag('', () => keepOut[n] && 'k'),
        flag('', () => reserved[n] && 'r'), flag('', () => trenchCell[n] && 't'), flag('', () => townNear[n] && 'n'), flag('', () => swampCell[n] && 's'), flag('', () => footCell[n] && 'f')].filter(Boolean).join('');
      s += f.padStart(6); } s += '\n'; }
  }
  fs.appendFileSync(out, s);
  htraceSnap = cur;
}
// MAPGEN_SITECHECK=1: after the roadside sites are levelled, report every later stage
// that moves the ground under a levelled lot (ruins, camps, holy/roadside/weapon shops)
let stageHook = null;
const stageLog = () => STAGE_LOG.map(({ id, t, ms }) => ({ id, ms: ms ?? Date.now() - t }));
// --preview FILE: stop before meshing and write a binary snapshot (heights,
// surface colours, feature flags + a JSON header) for the editor;
// --preview-full also runs the decor and rasterises every brick's top
const PREVIEW = opt('--preview', null);
const PREVIEW_FULL = args.includes('--preview-full');
const T0 = Date.now();

const CELL = 40; // world units per voxel, x/y (4 studs)
const VZ = 12; // world units per voxel, z (1 brick)
const NZ = 170;
// The map grows west and south from a fixed north-east corner (x 2900, y 4900),
// which keeps it clear of other players' builds east and north of it.
const CENTER = [2900 - (N * CELL) / 2, 4900 - (N * CELL) / 2];
const X0 = CENTER[0] - (N * CELL) / 2;
const Y0 = CENTER[1] - (N * CELL) / 2;
const SEA = tune('sea', 22, 'sea level, voxels (moves the env water plane: re-apply the sea preset)'); // sea level, voxels. The sea is the game's water plane (environment waterHeight WATER_Z), not bricks
const WATER_Z = (SEA + 1) * VZ - 6;
const MAX_H_CELLS = 16; // biggest merged box: 16 cells (64 studs) across
const MAX_Z_VOX = 50; // and 50 bricks tall

// ------------------------------------------------------------------ noise --
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(SEED);
const perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
// gradient components by hash (perm % 12), same sums as G3[h][0]*dx + [1]*dy + [2]*dz
const GX = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][0]);
const GY = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][1]);
const GZ = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][2]);
const gd = (h, dx, dy, dz) => GX[h] * dx + GY[h] * dy + GZ[h] * dz;
function noise3(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255;
  const p0 = perm[zi], p1 = perm[zi + 1];
  const a00 = perm[yi + p0], a10 = perm[yi + 1 + p0], a01 = perm[yi + p1], a11 = perm[yi + 1 + p1];
  const u = fade(x), v = fade(y), w = fade(z);
  return lerp(
    lerp(lerp(gd(xi + a00, x, y, z), gd(xi + 1 + a00, x - 1, y, z), u), lerp(gd(xi + a10, x, y - 1, z), gd(xi + 1 + a10, x - 1, y - 1, z), u), v),
    lerp(lerp(gd(xi + a01, x, y, z - 1), gd(xi + 1 + a01, x - 1, y, z - 1), u), lerp(gd(xi + a11, x, y - 1, z - 1), gd(xi + 1 + a11, x - 1, y - 1, z - 1), u), v),
    w
  );
}
const noise2 = (x, y) => noise3(x, y, 0.5);
function fbm2(x, y, oct = 5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
function ridged2(x, y, oct = 5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(noise2(x * f + 17.3 * i, y * f - 9.1 * i));
    s += a * r * r;
    n += a;
    a *= 0.5;
    f *= 2.1;
  }
  return s / n;
}
function fbm3(x, y, z, oct = 3) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.0;
  }
  return s / n;
}
// cheap per-position hash in [0, 1)
const hash = (a, b, c = 0) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647) + SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// -------------------------------------------------------------- materials --
// id -> { color, material?, asset?, intensity? }
const MATS = [null];
const mat = (color, extra = {}) => MATS.push({ color, ...extra }) - 1;
const GRASS = [mat([84, 140, 58]), mat([96, 152, 64]), mat([74, 128, 52])];
const TOWN_GRASS = [GRASS[2], GRASS[0], mat([90, 146, 54]), GRASS[1], mat([102, 156, 70])]; // the spawn town's lawns, dark to light
const DIRT = mat([110, 80, 54]);
const SAND = mat([214, 196, 142], { asset: 'PB_DefaultTile' });
const SNOW = mat([236, 240, 245], { asset: 'PB_DefaultTile' });
const ROCK = [mat([122, 118, 112]), mat([108, 104, 100])];
const STONE = mat([96, 94, 92]);
const DEEP = mat([68, 66, 70]);
const BEDROCK = mat([34, 32, 36]);
const WATER = mat([52, 128, 196], { material: 'BMC_Glass', asset: 'PB_DefaultTile' });
const LAVA = mat([255, 96, 20], { material: 'BMC_Glow', intensity: 4, asset: 'PB_DefaultTile' });
const GOLD = mat([232, 186, 40], { material: 'BMC_Metallic' });
const IRON = mat([176, 128, 104], { material: 'BMC_Metallic' });
const GEM = mat([60, 220, 200], { material: 'BMC_Glow', intensity: 3 });
const MOSS = mat([70, 96, 60]);
const PLAZA = mat([150, 146, 134]);
const COBBLE = mat([164, 156, 142]);
const PATH = mat([142, 112, 76]);
const GRAVEL = mat([90, 84, 78]);
// show-cave limestone (2026-10-16, owner: caves "need to look like these" + a photo of a lit show cave):
// cream, tan, ochre and buff bands for the rock round cave air and the formations
const LIME = [[226, 206, 166], [208, 178, 132], [190, 150, 104], [234, 220, 190], [172, 128, 84], [218, 192, 150]].map(c => mat(c));
const CAVE_BAND = 36; // limestone strata height (units)
const LIME_OF = k => LIME[Math.floor(hash(k, 77, 9) * LIME.length)];
const MOSSBED = [mat([58, 92, 62]), mat([66, 100, 58])]; // cove floors (2026-10-14)
const SHALLOWS = mat([232, 222, 184], { asset: 'PB_DefaultTile' }); // pale sand under shallow cove water: reads turquoise
const CLIFF = [mat([204, 184, 146]), mat([186, 164, 126]), mat([216, 200, 166]), mat([168, 148, 114]), mat([196, 172, 132])]; // striped sandstone cove cliffs
const MUD = mat([74, 56, 38]);
// the river delta (2026-10-15): silty channel beds, wet sand, marsh grass
const SILT = mat([128, 112, 84]), WETSAND = mat([188, 170, 122], { asset: 'PB_DefaultTile' }), MARSH = [mat([112, 134, 64]), mat([98, 122, 58]), mat([126, 140, 72])];
const MUCK = mat([104, 92, 46]); // yellow-brown slime on the swamp banks
const POOL_BED = mat([58, 46, 32]);
// desert (2026-10-03): dune sand, red mesa rock on slopes, dry grass at the edge
const DUNE = [mat([226, 192, 128], { asset: 'PB_DefaultTile' }), mat([214, 178, 116], { asset: 'PB_DefaultTile' })];
const MESA = [mat([178, 104, 70]), mat([160, 90, 60])];
const DRYGRASS = mat([170, 160, 88]);
const SCRUB = [mat([140, 146, 78]), mat([126, 134, 70])]; // the shrubland (2026-10-10)
const BASALT = [mat([54, 50, 52]), mat([44, 41, 44])]; // the volcano (2026-10-10)
const ASH = mat([92, 86, 84]);
// the death forest (2026-10-14): blackened grass, rot, dead stone
const DEADGRASS = [mat([44, 50, 36]), mat([52, 54, 40]), mat([38, 40, 32])];
const ROT = mat([56, 42, 36]), DEADSOIL = mat([46, 36, 30]), DEADROCK = [mat([64, 60, 60]), mat([54, 50, 52])];
// terrace retaining walls (2026-10-12): coursed masonry in two tones
const WALLSTONE = [mat([138, 130, 118]), mat([124, 117, 106])];
// sewers (2026-10-12): old red brick, a worn stone walk, a sludge channel, a tile vault
const SEWER_BRICK = [mat([112, 66, 52]), mat([98, 58, 46])];
const SEWER_WALK = mat([104, 100, 94]);
const SLUDGE = mat([84, 92, 40], { asset: 'PB_DefaultTile' });
const SEWER_CEIL = mat([92, 70, 58], { asset: 'PB_DefaultTile' });
// wild grass tones (2026-10-22, owner: "more dynamic grass colors"): five families x four
// lightnesses, all in GRASS (every GRASS.includes test sees them); grassAt() picks one per
// cell. Defined last so no older material id moves. Families: 0 shaded forest floor,
// 1 the old green, 2 bright meadow, 3 warm sun-bleached, 4 cool blue-green (high or damp)
const GRASS_FAM = [[62, 112, 50], [84, 140, 58], [104, 160, 62], [128, 152, 66], [74, 130, 82]];
const GRASS_LIGHT = [0.84, 0.94, 1.04, 1.13];
const GRASS_TONES = GRASS_FAM.map(c => GRASS_LIGHT.map(k => mat(c.map(v => Math.min(255, Math.round(v * k))))));
GRASS.push(...GRASS_TONES.flat());
// footpaths (2026-10-22): packed earth in the wild, flagstones on the building's own lot,
// sandier earth in the desert
const FOOTPATH = [mat([150, 124, 88]), mat([140, 114, 80]), mat([158, 134, 98])];
const FOOTFLAG = [mat([150, 144, 136]), mat([134, 128, 120])];
const FOOTSAND = mat([190, 164, 116]);
const DRIVE = [mat([170, 168, 162], { asset: 'PB_DefaultTile' }), mat([160, 158, 152], { asset: 'PB_DefaultTile' })]; // (2026-10-25) the houses' concrete driveways
const FOOT_MATS = [...FOOTPATH, ...FOOTFLAG, FOOTSAND, ...DRIVE];
const GTA = tune('road.gta', 1, 'asphalt roads with curbs, edge lines and a dashed centre line (0 = the old dirt ride surface)');
const ROAD_SKIN = tune('road.skin', 2, 'asphalt skin over the ride surface, units');
const ASPHALT = [54, 56, 60], CURB = [168, 166, 158], EDGE_LINE = [226, 226, 218], CENTRE_LINE = [226, 174, 34];
const DRIVE_KINDS = new Set(['splitlevel', 'cottage', 'townhouse', 'dutchcolonial', 'georgian']);

// --------------------------------------------------------------- dungeons --
// Zelda-style temple dungeons from dungeon.mjs: floors of rooms on a 5 x 5
// grid with 3-floor atriums, buried whole: nothing shows above ground but a
// trench cut down to the entrance stairwell. Each goes where the land is
// already high enough to cover it (near its anchor `at`); where it isn't,
// the ground swells into a grassy hill over it.
// They stand on rock just above the game water plane (environment
// waterHeight WATER_Z), so no floor of theirs is underwater.
const BASE_VOX = SEA + 2;
const SPAWN_CHANCE = tune('dungeon.spawnChance', 0.35, 'share of rooms with a spawner'); // share of rooms with a spawner; the deepest level's biggest room gets 3
const TOWN_PIN = { fx: Math.round(237 * K) - 65, fy: Math.round(261 * K) - 65, h: 47 }; // centre kept when the town shrank 250 -> 130 cells // see the town section
const COVER = tune('dungeon.cover', 3, 'voxels of ground over a roof');        // voxels of ground over a dungeon's roof
const RAISE_BLEND = tune('dungeon.raiseBlend', 30, 'cells the hill over a dungeon fades over'); // cells over which a hill over a dungeon fades out
stage('island');
// ------------------------------------------------------------------ island --
// (owner, 2026-10-03: "more island like, not a square; harder the further up the
// island, spawn town first") A long island along a curved SPINE (cells,
// relative to the town centre): it starts just behind the spawn town and runs
// diagonally across the map to mountains at the far end. HALF is the
// half-width at each spine point. progress(x, y) is 0 at the town and 1 at the
// far end; dungeons, the henge, outposts and the mountains are placed by it.
const ISLAND = {
  spine: tune('island.spine', [[-45, -45], [0, 0], [60, 80], [110, 165], [165, 205], [215, 228]], 'spine points, cells from the town centre (x K)').map(([a, b]) => [a * K, b * K]),
  half: tune('island.half', [100, 140, 135, 120, 90, 55], 'half-width at each spine point, cells (x K)').map(h => h * K),
  // (owner 2026-10-14: "make the volcano after the fucking scary evil death forest at the end of the map after the
  // snow biome") the island goes on past the far end: a tail curving away (offsets from the last spine point) that
  // holds the death forest and then the volcano at its tip. progress() stays 0..1 over the old spine (1 on the tail),
  // so everything placed by progress keeps its place; the tail only adds land past the old far end.
  tail: tune('island.tail', [[14, -63], [16, -143], [0, -223], [-24, -278]], 'tail past the far end: points, cells from the last spine point (x K)').map(([a, b]) => [a * K, b * K]),
  tailHalf: tune('island.tailHalf', [42, 46, 50, 44], 'tail half-widths, cells (x K)').map(h => h * K),
};
const spine = (() => {
  const tcx = TOWN_PIN.fx + TOWN_CELLS / 2, tcy = TOWN_PIN.fy + TOWN_CELLS / 2;
  const P = ISLAND.spine.map(([a, b]) => [tcx + a, tcy + b]);
  const pts = []; // dense samples: [x, y, arc length, half width]
  let s = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const seg = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]), n = Math.ceil(seg / 2);
    for (let k = 0; k < n; k++) {
      const f = k / n;
      // a smooth curve through the points (Catmull-Rom)
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      const x = cr(0), y = cr(1);
      if (pts.length) s += Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]);
      pts.push([x, y, s, ISLAND.half[i] + (ISLAND.half[i + 1] - ISLAND.half[i]) * f]);
    }
  }
  pts.push([...P[P.length - 1], s + 1, ISLAND.half[ISLAND.half.length - 1]]);
  const sTown = pts.reduce((b, p) => (Math.hypot(p[0] - tcx, p[1] - tcy) < Math.hypot(b[0] - tcx, b[1] - tcy) ? p : b))[2];
  const L = pts[pts.length - 1][2], tail = [pts[pts.length - 1]];
  // the tail: the same curve on from the old end (the old segments are left exactly as they were)
  const E = P[P.length - 1], T = [E, ...ISLAND.tail.map(([a, b]) => [E[0] + a, E[1] + b])], TH = [ISLAND.half[ISLAND.half.length - 1], ...ISLAND.tailHalf];
  let st = L;
  for (let i = 0; i + 1 < T.length; i++) {
    const seg = Math.hypot(T[i + 1][0] - T[i][0], T[i + 1][1] - T[i][1]), n = Math.ceil(seg / 2);
    for (let k = i ? 0 : 1; k <= (i + 2 === T.length ? n : n - 1); k++) {
      const f = k / n;
      const p0 = i ? T[i - 1] : P[P.length - 2], p1 = T[i], p2 = T[i + 1], p3 = T[Math.min(T.length - 1, i + 2)];
      const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      const x = cr(0), y = cr(1), q = tail[tail.length - 1];
      st += Math.hypot(x - q[0], y - q[1]);
      tail.push([x, y, st, TH[i] + (TH[i + 1] - TH[i]) * f]);
    }
  }
  return { pts, L, sTown, tail, LT: st };
})();
// how far along the tail (0..1) a cell's nearest spine point is, -1 where the old spine is nearer, and the
// tail's own ground there (filled in by the heightmap, merged in just before the volcano: everything placed
// before it sees the old island exactly)
const tailU = new Float32Array(N * N).fill(-1), Htail = new Int16Array(N * N);
const tailOff = c => tailU[c] >= 0.15; // the tail's own stuff only: keeps the old map's site searches as they were
// nearest spine sample to (x, y): [sample, distance]
const nearSpine = (x, y) => {
  let best = spine.pts[0], bd = Infinity;
  for (const p of spine.pts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
  return [best, Math.sqrt(bd)];
};
const progress = (x, y) => Math.max(0, Math.min(1, (nearSpine(x, y)[0][2] - spine.sTown) / (spine.L - spine.sTown)));
// a point at progress t, pushed sideways by off cells (+ = right of the spine's direction)
const spineAt = (t, off = 0) => {
  const s = spine.sTown + t * (spine.L - spine.sTown);
  const i = Math.max(1, spine.pts.findIndex(p => p[2] >= s));
  const a = spine.pts[i - 1], b = spine.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [b[0] + ((b[1] - a[1]) / len) * off, b[1] - ((b[0] - a[0]) / len) * off];
};

const DUNGEONS = [
  // tiers: enemy spawner tier per floor, top floor first (see SPAWNERS)
  { name: 'Hollow Crypt', levels: 3, seed: SEED + 1, up: [tune('crypt.t', 0.5, 'progress up the island'), tune('crypt.off', 0, 'cells right of the spine (x K)') * K], tiers: [1, 2, 3], theme: 'crypt' },
  { name: 'Sunken Keep', levels: 4, seed: SEED + 2, up: [tune('keep.t', 0.72, 'progress up the island'), tune('keep.off', -35, 'cells right of the spine (x K)') * K], tiers: [2, 3, 4, 5], theme: 'keep' },
  { name: 'Mountain Deep', levels: 5, seed: SEED + 3, up: [tune('deep.t', 0.94, 'progress up the island'), tune('deep.off', 0, 'cells right of the spine (x K)') * K], tiers: [3, 4, 5, 6, 7], theme: 'deep' },
];
for (const d of DUNGEONS) {
  d.cells = DSIZE / CELL; // 51 cells
  d.height = d.levels * DSTOREY;
  d.topVox = BASE_VOX + d.height / VZ;
  d.anchor = spineAt(...d.up); // preferred centre, cells: by progress up the island (easy near town)
  // the layout first: it decides where the entrance trench goes
  d.out = buildDungeon({ levels: d.levels, seed: d.seed, theme: d.theme, spawnChance: SPAWN_CHANCE });
  if (d.out.dropped.length) throw new Error(`${d.name}: ${d.out.dropped.length} overlapping pieces, e.g. ${d.out.dropped[0]}`);
}
// Chebyshev distance (cells) from a column to a dungeon footprint; <= 0 inside
const footDist = (d, x, y) =>
  Math.max(d.fx - x, x - (d.fx + d.cells - 1), d.fy - y, y - (d.fy + d.cells - 1));

stage('heightmap');
// -------------------------------------------------------------- heightmap --
const H = new Int16Array(N * N);
const surfaceMat = new Uint8Array(N * N);
const PLAZA_RING = 3, BLEND = 16;
const TER = {
  baseH: tune('terrain.baseH', 31, 'lowland height, voxels'), baseAmp: tune('terrain.baseAmp', 44, 'lowland hills, voxels'), baseScale: tune('terrain.baseScale', 3200, 'lowland noise size, units'),
  maskScale: tune('terrain.maskScale', 6000, 'mountain patch noise size, units'), ridgeScale: tune('terrain.ridgeScale', 2200, 'ridge noise size, units'),
  ridgePow: tune('terrain.ridgePow', 1.4, 'ridge sharpness'), mountainAmp: tune('terrain.mountainAmp', 145, 'mountain height, voxels'),
  wildStart: tune('terrain.wildStart', 0.45, 'progress where mountains start'), wildMax: tune('terrain.wildMax', 0.85, 'mountain share at the far end'),
  deepR: tune('terrain.deepR', 70, 'mountain ring round the Deep, outer cells (x K)'), deepIn: tune('terrain.deepIn', 30, 'inner cells (x K)'),
  coastNoise: tune('terrain.coastNoise', 0.2, 'coast raggedness'), coastScale: tune('terrain.coastScale', 2500, 'coast noise size, units'),
  coastFit: tune('terrain.coastFit', 0.86, 'distance factor (smaller = wider island)'),
  oceanStart: tune('terrain.oceanStart', 0.72, 'coast falloff start'), oceanEnd: tune('terrain.oceanEnd', 0.97, 'coast falloff end'), oceanFloor: tune('terrain.oceanFloor', 9, 'sea bed, voxels'),
};
for (let x = 0; x < N; x++)
  for (let y = 0; y < N; y++) {
    const wx = X0 + x * CELL, wy = Y0 + y * CELL;
    // distance from the spine over the local half-width, a ragged coast
    const [sp, sd] = nearSpine(x, y);
    const r = (sd / sp[3]) * TER.coastFit + fbm2(wx / TER.coastScale + 40, wy / TER.coastScale, 3) * TER.coastNoise;
    const up = Math.max(0, Math.min(1, (sp[2] - spine.sTown) / (spine.L - spine.sTown)));
    let base = TER.baseH + fbm2(wx / TER.baseScale, wy / TER.baseScale) * TER.baseAmp;
    let mask = smooth(-0.15, 0.2, fbm2(wx / TER.maskScale + 100, wy / TER.maskScale - 50, 3));
    // mountains round the deepest dungeon's anchor
    const dm = Math.hypot(x - DUNGEONS[2].anchor[0], y - DUNGEONS[2].anchor[1]);
    mask = Math.max(mask, smooth(TER.deepR * K, TER.deepIn * K, dm));
    mask = Math.max(mask, smooth(TER.wildStart, 1, up) * TER.wildMax); // wilder ground further up the island
    let h = base + mask * Math.pow(ridged2(wx / TER.ridgeScale, wy / TER.ridgeScale), TER.ridgePow) * TER.mountainAmp;
    h = lerp(h, TER.oceanFloor, smooth(TER.oceanStart, TER.oceanEnd, r)); // ocean ring
    H[x * N + y] = Math.max(4, Math.min(NZ - 8, Math.round(h)));
    // the tail, where its curve is nearer than the old spine: the same ground (wild, up = 1), calmer past the snow
    let tp = null, td = sd * sd;
    for (const q of spine.tail) { const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < td) { td = d; tp = q; } }
    if (tp) {
      const tu = (tp[2] - spine.L) / (spine.LT - spine.L);
      const rt = (Math.sqrt(td) / tp[3]) * TER.coastFit + fbm2(wx / TER.coastScale + 40, wy / TER.coastScale, 3) * TER.coastNoise;
      const tmask = Math.max(mask, TER.wildMax) * (1 - 0.75 * smooth(0.12, 0.35, tu)); // rolling forest ground; the volcano rises on its own
      let ht = base + tmask * Math.pow(ridged2(wx / TER.ridgeScale, wy / TER.ridgeScale), TER.ridgePow) * TER.mountainAmp;
      ht = lerp(ht, TER.oceanFloor, smooth(TER.oceanStart, TER.oceanEnd, rt));
      tailU[x * N + y] = tu; Htail[x * N + y] = Math.max(4, Math.min(NZ - 8, Math.round(ht)));
    }
  }
if (PREVIEW && args.includes('--preview-height')) {
  // terrain tuning: the bare heightmap, before any site is placed (a few seconds)
  const tcx = TOWN_PIN.fx + TOWN_CELLS / 2, tcy = TOWN_PIN.fy + TOWN_CELLS / 2;
  const Hr = new Int16Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) Hr[y * N + x] = H[x * N + y];
  writePreview(PREVIEW, {
    seed: SEED, scale: K, N, CELL, VZ, X0, Y0, SEA, waterZ: WATER_Z, stage: 'height', ms: Date.now() - T0,
    shift: [-(X0 + tcx * CELL), -(Y0 + tcy * CELL)], params: TUNED, stages: stageLog(),
    features: {
      spine: ISLAND.spine.map(([a, b]) => [tcx + a, tcy + b]), half: ISLAND.half,
      spinePts: spine.pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2), +p[3].toFixed(1)]), sTown: spine.sTown, L: spine.L,
      town: { fx: TOWN_PIN.fx, fy: TOWN_PIN.fy, cells: TOWN_CELLS, h: TOWN_PIN.h },
      dungeons: DUNGEONS.map(d => ({ name: d.name, levels: d.levels, anchor: d.anchor.map(Math.round), cells: d.cells })),
    },
  }, [['height', Hr, { w: N, h: N }]]);
  console.error(`preview written to ${PREVIEW} (height, ${((Date.now() - T0) / 1000).toFixed(1)} s)`);
  process.exit(0);
}

const inBounds = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

stage('dungeons');
// dungeon sites: the deepest picks first. A site costs the ground it would
// have to raise (average voxels) plus a little for straying from the anchor.
for (const d of [...DUNGEONS].sort((a, b) => b.levels - a.levels)) {
  const need = d.topVox + COVER, C = d.cells, W1 = N + 1;
  const P = new Float64Array(W1 * W1), Q = new Float64Array(W1 * W1);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const h = H[x * N + y], i = (x + 1) * W1 + y + 1;
      P[i] = Math.max(0, need - h) + P[x * W1 + y + 1] + P[i - 1] - P[x * W1 + y];
      Q[i] = (h <= SEA + 4 ? 1 : 0) + Q[x * W1 + y + 1] + Q[i - 1] - Q[x * W1 + y];
    }
  const sum = (A, fx, fy) => A[(fx + C) * W1 + fy + C] - A[fx * W1 + fy + C] - A[(fx + C) * W1 + fy] + A[fx * W1 + fy];
  let best = null;
  // no site near the anchor (another dungeon or the sea in the way): widen x2, x3
  for (let widen = 1; !best && widen <= 3; widen++) {
    if (widen > 1) console.error(`${d.name}: no site within maxAway, widening x${widen}`);
  for (let fx = 24; fx + C < N - 24; fx += 2)
    for (let fy = 24; fy + C < N - 24; fy += 2) {
      const cx = fx + C / 2, cy = fy + C / 2;
      if (sum(Q, fx, fy) > 0) continue; // all dry land
      if (Math.max(Math.abs(TOWN_PIN.fx + TOWN_CELLS / 2 - cx), Math.abs(TOWN_PIN.fy + TOWN_CELLS / 2 - cy)) < (C + TOWN_CELLS) / 2 + RAISE_BLEND + 16) continue;
      if (DUNGEONS.some(o => o !== d && o.fx !== undefined && Math.max(Math.abs(o.fx + o.cells / 2 - cx), Math.abs(o.fy + o.cells / 2 - cy)) < C + 2 * RAISE_BLEND)) continue;
      const away = Math.hypot(cx - d.anchor[0], cy - d.anchor[1]);
      if (away > widen * tune('dungeon.maxAway', 60, 'cells a site may stray from its anchor (x K)') * K) continue; // stay at its place up the island (difficulty order)
      const score = sum(P, fx, fy) / (C * C) + 0.15 * away;
      if (!best || score < best.score) best = { fx, fy, score, raise: sum(P, fx, fy) / (C * C) };
    }
  }
  if (!best) throw new Error(`no site for ${d.name}`);
  Object.assign(d, { fx: best.fx, fy: best.fy, raise: Math.round(best.raise * 10) / 10 });
  d.origin = [X0 + d.fx * CELL, Y0 + d.fy * CELL, BASE_VOX * VZ];
  console.error(`${d.name}: site cells ${d.fx},${d.fy} (anchor ${d.anchor.map(Math.round)}), ground raised ${d.raise} voxels on average`);
  // swell the ground over it where it is too low, fading out over RAISE_BLEND
  for (let x = d.fx - RAISE_BLEND; x < d.fx + C + RAISE_BLEND; x++)
    for (let y = d.fy - RAISE_BLEND; y < d.fy + C + RAISE_BLEND; y++) {
      if (!inBounds(x, y)) continue;
      const fd = footDist(d, x, y), i = x * N + y;
      const top = need + Math.round(fbm2((X0 + x * CELL) / 700 + d.seed % 97, (Y0 + y * CELL) / 700, 3) * 3);
      const target = fd <= 2 ? Math.max(d.topVox + 1, top) : lerp(top, H[i], smooth(2, RAISE_BLEND, fd));
      H[i] = Math.max(H[i], Math.round(target));
    }
}

// entrance trenches: a pit (two cells round the stairwell) down to the roof, then a
// cutting 3 cells wide to the nearest side of the footprint and on out,
// its floor climbing a brick per cell until it meets the ground
// (2026-10-10, owner: "add dungeons on the top of the dungeon entrances"): the pit
// is now the whole surface keep (surfacedungeon.mjs) plus 2 cells round it, cut
// down to the dungeon's paved roof, which the keep stands on; the trench leaves
// from the keep's gate.
const trenchCell = new Uint8Array(N * N);
const apronCells = []; // keep pits: keepOut once it exists
for (const d of DUNGEONS) {
  const [ex0, ey0, ex1, ey1] = d.out.entrance, C = d.cells;
  const px0 = d.fx + Math.floor(ex0 / CELL) - 2, py0 = d.fy + Math.floor(ey0 / CELL) - 2;
  const px1 = d.fx + Math.floor((ex1 - 1) / CELL) + 2, py1 = d.fy + Math.floor((ey1 - 1) / CELL) + 2;
  const roof = d.topVox - 1; // a column with H = roof and nothing in it shows the roof
  const cut = (x, y, h) => { if (inBounds(x, y) && H[x * N + y] > h) H[x * N + y] = h; if (inBounds(x, y)) trenchCell[x * N + y] = 1; };
  const ways = [[-1, 0, px0 - d.fx], [1, 0, d.fx + C - 1 - px1], [0, -1, py0 - d.fy], [0, 1, d.fy + C - 1 - py1]];
  const [dx, dy] = ways.sort((a, b) => a[2] - b[2])[0];
  const SPC = CELL / 10; // studs per cell
  d.keep = planSurfaceDungeon({
    seed: d.seed * 7 + 3, hole: [ex0 / 10, ey0 / 10, ex1 / 10, ey1 / 10], side: [dx, dy],
    bounds: [3 * SPC, 3 * SPC, (C - 3) * SPC, (C - 3) * SPC], grid: tune('keep.grid', 12, 'surface keep tiles per side (+ dungeon floors); 8 before the great hall') + d.levels,
    rooms: tune('keep.rooms', 3, 'surface keep rooms (+ dungeon floors)') + d.levels, theme: DTHEMES[d.theme],
    // the checkpoint's spot (see 'checkpoints'): the keep's floor leaves it bare
    checkpoint: d.out.entranceSide === 'S' || d.out.entranceSide === 'N' ? [ex0 / 10 - 4, (ey0 + ey1) / 20] : [(ex0 + ex1) / 20, ey0 / 10 - 4],
  });
  const [kx0, ky0, kx1, ky1] = [d.fx + Math.floor(d.keep.extent[0] / SPC) - 2, d.fy + Math.floor(d.keep.extent[1] / SPC) - 2,
    d.fx + Math.ceil(d.keep.extent[2] / SPC) + 1, d.fy + Math.ceil(d.keep.extent[3] / SPC) + 1];
  for (let x = Math.min(kx0, px0); x <= Math.max(kx1, px1); x++)
    for (let y = Math.min(ky0, py0); y <= Math.max(ky1, py1); y++) {
      if (!((x >= kx0 && x <= kx1 && y >= ky0 && y <= ky1) || (x >= px0 && x <= px1 && y >= py0 && y <= py1))) continue;
      // level with the roof: cut over the footprint, filled where the keep overhangs low ground
      if (inBounds(x, y)) { H[x * N + y] = roof; trenchCell[x * N + y] = 1; apronCells.push(x * N + y); }
    }
  const gx = d.fx + Math.floor(d.keep.gate[0] / SPC), gy = d.fy + Math.floor(d.keep.gate[1] / SPC);
  let x = dx ? (dx < 0 ? kx0 : kx1) : gx, y = dy ? (dy < 0 ? ky0 : ky1) : gy;
  d.trenchWalk = { x, y, dx, dy, roof }; // re-walked after the river (see 'river')
  for (let k = 0; k < 160; k++) {
    x += dx; y += dy;
    // flat to the footprint's edge, then a brick per cell (from the pit's edge if the keep overhangs)
    const out = Math.max(0, Math.min(k, footDist(d, x, y)));
    const floor = roof + out;
    const side = [-1, 0, 1].map(l => [x + dy * l, y + dx * l]);
    if (out > 0 && side.every(([sx, sy]) => !inBounds(sx, sy) || H[sx * N + sy] <= floor)) break;
    for (const [sx, sy] of side) cut(sx, sy, floor);
    d.mouth = [x, y];
  }
  console.error(`${d.name}: surface keep ${d.keep.rooms} rooms, ${d.keep.bricks.length} bricks, ${d.keep.spawns.length} spawners, gate ${dx},${dy}`);
}


stage('town');
// ------------------------------------------------------------------- town --
// The spawn hub: the flattest dryish square near the island centre, clear of the
// dungeons, flattened like a dungeon plaza and paved. Dirt paths run from it
// to each dungeon. Buildings are added with the decor.
const TOWN = { cells: TOWN_CELLS, blend: 16 };
// The town is pinned where it was first built (the manor, shops and players'
// builds stand in it); the search below is how that spot was found.
const town = TOWN_PIN ?? (() => {
  let best = null;
  const C = TOWN.cells;
  for (let fx = 20; fx + C < N - 20; fx += 4)
    for (let fy = 20; fy + C < N - 20; fy += 4) {
      const mx = fx + C / 2, my = fy + C / 2;
      if (DUNGEONS.some(d => Math.max(Math.abs(d.fx + d.cells / 2 - mx), Math.abs(d.fy + d.cells / 2 - my)) < (d.cells + C) / 2 + RAISE_BLEND + TOWN.blend)) continue;
      let lo = Infinity, hi = -Infinity, sum = 0;
      for (let x = fx; x < fx + C; x++) for (let y = fy; y < fy + C; y++) {
        const h = H[x * N + y];
        lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h;
      }
      // flattening fills ponds, so only the average has to clear the shore
      if (sum / (C * C) <= SEA + 6) continue;
      const score = hi - lo + Math.hypot(mx - N / 2, my - N / 2) * 0.25;
      if (!best || score < best.score) best = { fx, fy, h: Math.round(sum / (C * C)), score };
    }
  if (!best) throw new Error('no dry flat site for the town');
  return best;
})();
const townDist = (x, y) =>
  Math.max(town.fx - x, x - (town.fx + TOWN.cells - 1), town.fy - y, y - (town.fy + TOWN.cells - 1));
// the town's own rnd (the same hash build() gets), and its plan: paths, plaza,
// exits (town.mjs planTown). Only the plan's cells are flattened (a ragged
// disc plus the paths out to the exits); the rest of the square keeps its
// ground, blended toward the town over TOWN.blend cells.
const townRnd = (a, b = 0, c = 0) => hash(a + 7919, b, c);
const townPlan = planTown(townRnd);
const townKind = new Uint8Array(N * N);   // 0 natural, 1 grass lot, 2 paved (path / plaza)
const townNear = new Uint8Array(N * N);   // within 2 cells of the flattened town
const terraceCell = new Uint8Array(N * N); // town / hamlet terrace cells: retaining walls where they step down (2026-10-12)
// a town cell's terrace height over the town level, voxels (town.mjs plan.levelAt)
const townLocal = (x, y) => [(x - town.fx - TOWN.cells / 2 + 0.5) * CELL, (y - town.fy - TOWN.cells / 2 + 0.5) * CELL];
const townLevel = (x, y) => townPlan.levelAt(...townLocal(x, y)) / VZ;
{
  const B = TOWN.blend, x0 = town.fx - B, y0 = town.fy - B, S = TOWN.cells + 2 * B;
  const dist = new Float32Array(S * S).fill(Infinity), src = new Float32Array(S * S), queue = [];
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) {
      const k = townSurface(...townLocal(x, y), townPlan);
      if (!k || !inBounds(x, y)) continue;
      townKind[x * N + y] = k === 'lot' ? 1 : 2;
      terraceCell[x * N + y] = 1;
      dist[(x - x0) * S + (y - y0)] = 0; src[(x - x0) * S + (y - y0)] = town.h + townLevel(x, y); queue.push([x - x0, y - y0]);
    }
  // multi-source BFS (8-neighbour, diagonal 1.41) for the blend distance, carrying the nearest terrace's height
  for (let qi = 0; qi < queue.length; qi++) {
    const [a, b] = queue[qi], d0 = dist[a * S + b];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const na = a + da, nb = b + db; if (na < 0 || nb < 0 || na >= S || nb >= S) continue;
      const nd = d0 + (da && db ? 1.41 : 1);
      if (nd < dist[na * S + nb] && nd < B) { dist[na * S + nb] = nd; src[na * S + nb] = src[a * S + b]; queue.push([na, nb]); }
    }
  }
  for (let a = 0; a < S; a++)
    for (let b = 0; b < S; b++) {
      const d = dist[a * S + b], x = a + x0, y = b + y0;
      if (!inBounds(x, y) || d === Infinity) continue;
      if (d <= 2) townNear[x * N + y] = 1;
      H[x * N + y] = d === 0 ? src[a * S + b] : Math.round(lerp(src[a * S + b], H[x * N + y], smooth(0, B, d)));
    }
}

stage('river');
// ------------------------------------------------------------------ river --
// (owner 2026-10-05: "make this river big and long and goes through the
// world") One river from the far mountains down the island, through the town
// along RIVER_LOCAL, out to the sea behind it. Its water level only falls on
// the way down (rapids where it drops), equals the town's (a brick under the
// paving) through town, and never sinks below the sea. The bed is carved
// RIVER.depth under the level; the banks are levelled to a brick above it and
// rise a brick per cell; where the ground is lower it is built up into a
// levee. The water is glass with collision off (you wade), down to the sea
// plane, where the game's water takes over. Roads crossing it get bridges.
const RIVER = { rw: tune('river.width', 3 + K, 'half-width, cells'), bank: tune('river.bank', 12, 'bank blend, cells'), depth: tune('river.depth', 2, 'bed depth, voxels'),
  valley: Math.round(tune('river.valley', 20, 'valley sides reach this far past the banks, cells (x K)') * K), slope: tune('river.slope', 4.5, 'steepest valley side, voxels per cell (keep under smooth.maxRise)'),
  levelWin: tune('river.levelWin', 6, 'river level = lowest bank within this many points either side'),
  levelBlock: tune('river.levelBlock', 40, 'unused since 2026-10-21 (falling fit + river.stepEvery)'),
  stepEvery: tune('river.stepEvery', 6, 'the river falls at most a brick every this many points (2 per cell)'),
  embank: tune('river.embank', 1, 'floodplain fill round a dammed reach falls this many bricks per cell'),
  fillCost: tune('river.fillCost', 3, 'falling fit: cost of holding water over the ground vs cutting the ground under it'),
  oct: tune('river.oct', 1, 'octilinear course (45/90 degree runs), 0 = free curve'), octTol: tune('river.octTol', 4, 'octilinear: max cells off the meander line'), octTolTown: tune('river.octTolTown', 2, 'octilinear: max cells off it in town') };
// the valley's height over the water level at e cells past the channel edge
// (2026-10-06, owner: the river ran in a sheer-walled canyon): a brick per cell
// across the banks, then steepening to RIVER.slope; every step stays wedge-smoothable
const valleyRise = e => {
  const g = Math.min(RIVER.bank, 4), k = (RIVER.slope - 1) / (2 * Math.max(1, RIVER.bank - g)); // slope 1 at g, RIVER.slope at the bank's end
  if (e <= g) return e;
  const eS = g + (RIVER.slope - 1) / (2 * k); // where the slope reaches RIVER.slope
  if (e <= eS) return e + k * (e - g) ** 2;
  return eS + k * (eS - g) ** 2 + RIVER.slope * (e - eS);
};
const riverCell = new Uint8Array(N * N), riverLevel = new Int16Array(N * N), riverBankL = new Int16Array(N * N).fill(-999);
const riverLevelNear = (x, y) => riverBankL[x * N + y];
const keepOut = new Uint8Array(N * N);   // no trees, plants, boulders, caves, outposts (river, banks, bridges)
const noSmooth = new Uint8Array(N * N);  // no smoothing pieces (river water, bridge decks)
for (const c of apronCells) keepOut[c] = 1; // the surface keeps' pits
const riverRiver = (() => {
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2;
  const halfAt = t => { const s = spine.sTown + t * (spine.L - spine.sTown); return (spine.pts.find(q => q[2] >= s) ?? spine.pts[spine.pts.length - 1])[3]; };
  const clearOf = p => DUNGEONS.every(d => footDist(d, Math.round(p[0]), Math.round(p[1])) > RIVER.rw + RIVER.bank + RAISE_BLEND);
  const way = [];
  for (const t of [0.97, 0.88, 0.78, 0.68, 0.58, 0.48, 0.38, 0.28, 0.18, 0.09]) {
    let got = null;
    for (const side of [1, -1]) { for (const f of [0.45, 0.3, 0.6, 0.15, 0.75]) { const q = spineAt(t, side * f * halfAt(t)); if (clearOf(q)) { got = q; break; } } if (got) break; }
    if (got) way.push(got);
  }
  for (const [ux, uy] of RIVER_LOCAL) way.push([tx + ux / CELL, ty + uy / CELL]);
  for (const [a, b] of [[-95, -45], [-170, -95], [-260, -150], [-360, -210]]) way.push([tx + a * K, ty + b * K]);
  // dense centre line (Catmull-Rom), swung by a meander that fades out in town
  const raw = [];
  for (let i = 0; i + 1 < way.length; i++) {
    const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let k = 0; k < n; k++) {
      const f = k / n, cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      raw.push([cr(0), cr(1)]);
    }
  }
  const pts = [];
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i) s += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    const q = raw[Math.min(raw.length - 1, i + 1)], o = raw[Math.max(0, i - 1)], tl = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
    const inTown = Math.max(0, 1 - Math.max(0, townDist(Math.round(raw[i][0]), Math.round(raw[i][1]))) / 25);
    const m = (4 * Math.sin(s / 37) + 2 * Math.sin(s / 13 + 1)) * K * (1 - inTown);
    const x = raw[i][0] - ((q[1] - o[1]) / tl) * m, y = raw[i][1] + ((q[0] - o[0]) / tl) * m;
    if (!inBounds(Math.round(x), Math.round(y))) break;
    pts.push([x, y]);
  }
  // octilinear course (owner 2026-10-13: "rivers only by 45 or 90 degree angles"):
  // the meandering line is cut into runs, each joined by two legs (one diagonal,
  // one straight, the order that hugs the line) between cell centres; a run grows
  // while every point of the line it replaces stays within river.octTol cells
  // (tighter in town, whose plan keeps clear of RIVER_LOCAL)
  if (RIVER.oct) {
    const C = p => [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5];
    const dist2seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    const legs = (a, b, diagFirst) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.abs(dx), Math.abs(dy));
      const m = diagFirst ? [a[0] + Math.sign(dx) * d, a[1] + Math.sign(dy) * d] : [b[0] - Math.sign(dx) * d, b[1] - Math.sign(dy) * d];
      return [a, m, b];
    };
    const segD = (px, py, [a, m, b]) => Math.min(dist2seg(px, py, a[0], a[1], m[0], m[1]), dist2seg(px, py, m[0], m[1], b[0], b[1]));
    const tolAt = p => townDist(Math.round(p[0]), Math.round(p[1])) <= 25 ? RIVER.octTolTown : RIVER.octTol;
    const fits = (i, j) => {
      const a = C(pts[i]), b = C(pts[j]);
      for (const df of [true, false]) {
        const L = legs(a, b, df);
        let ok = true;
        for (let k = i + 1; k < j && ok; k++) if (segD(pts[k][0], pts[k][1], L) > tolAt(pts[k])) ok = false;
        if (ok) return L;
      }
      return null;
    };
    const route = [C(pts[0])];
    for (let i = 0; i < pts.length - 1;) {
      let j = i + 1, best = legs(C(pts[i]), C(pts[j]), true);
      for (let t = i + 2; t < pts.length; t++) { const L = fits(i, t); if (!L) break; j = t; best = L; }
      if (best[1][0] !== best[0][0] || best[1][1] !== best[0][1]) route.push(best[1]);
      route.push(best[2]);
      i = j;
    }
    // densify to half-cell steps (levels and channel distances read the points)
    const dense = [route[0]];
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
      for (let k = 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    pts.length = 0; pts.push(...dense);
    console.error(`river: octilinear, ${route.length} corners`);
  }
  // (2026-10-21) round the dungeons: the course could run through a footprint, where the
  // channel was simply left out (the water stopped at a wall on each side of the keep).
  // A run of points inside a dungeon's box (+ the channel and 3 cells) is replaced by a
  // walk along that box's edge, the shorter way round (axis runs: still octilinear).
  for (const d of DUNGEONS) {
    const M = RIVER.rw + 3, B0 = d.fx - M, B1 = d.fy - M, B2 = d.fx + d.cells + M, B3 = d.fy + d.cells + M, W = B2 - B0, Hh = B3 - B1, P = 2 * (W + Hh);
    const inside = q => q[0] > B0 && q[0] < B2 && q[1] > B1 && q[1] < B3;
    const snap = q => { const ds = [q[1] - B1, B2 - q[0], B3 - q[1], q[0] - B0].map(Math.abs), e = ds.indexOf(Math.min(...ds)), cx = Math.max(B0, Math.min(B2, q[0])), cy = Math.max(B1, Math.min(B3, q[1]));
      return e === 0 ? [[cx, B1], cx - B0] : e === 1 ? [[B2, cy], W + cy - B1] : e === 2 ? [[cx, B3], W + Hh + B2 - cx] : [[B0, cy], 2 * W + Hh + B3 - cy]; };
    const corner = t => { t = ((t % P) + P) % P; return t === 0 ? [B0, B1] : t === W ? [B2, B1] : t === W + Hh ? [B2, B3] : [B0, B3]; };
    for (let guard = 0; guard < 4; guard++) {
      const i0 = pts.findIndex(inside); if (i0 <= 0) break;
      let i1 = i0; while (i1 + 1 < pts.length && inside(pts[i1 + 1])) i1++;
      if (i1 + 1 >= pts.length) break;
      const a = pts[i0 - 1], b = pts[i1 + 1], [sa, ta] = snap(a), [sb, tb] = snap(b), fwd = ((tb - ta) % P + P) % P, dir = fwd <= P / 2 ? 1 : -1, len = dir > 0 ? fwd : P - fwd;
      const mid = [];
      for (const tc of [0, W, W + Hh, 2 * W + Hh]) {
        const rel = dir > 0 ? ((tc - ta) % P + P) % P : ((ta - tc) % P + P) % P;
        if (rel > 0 && rel < len) mid.push([rel, corner(tc)]);
      }
      const way = [a, sa, ...mid.sort((u, v) => u[0] - v[0]).map(u => u[1]), sb, b];
      const dense = [a];
      for (let k = 1; k < way.length; k++) { const u = way[k - 1], v = way[k], m = Math.max(1, Math.ceil(Math.hypot(v[0] - u[0], v[1] - u[1]) * 2)); for (let j = 1; j <= m; j++) dense.push([u[0] + (v[0] - u[0]) * j / m, u[1] + (v[1] - u[1]) * j / m]); }
      pts.splice(i0 - 1, i1 - i0 + 3, ...dense);
      console.error(`river: round ${d.name} (${i1 - i0 + 1} points -> ${dense.length})`);
    }
  }
  // levels: lowest ground across the channel, falling only, pinned to the town
  const townL = town.h - 1, rw = RIVER.rw;
  const ground = pts.map(([x, y]) => {
    let g = Infinity;
    for (let a = -rw; a <= rw; a++) for (let b = -rw; b <= rw; b++) {
      if (a * a + b * b > rw * rw) continue;
      const cx = Math.round(x) + a, cy = Math.round(y) + b;
      if (inBounds(cx, cy)) g = Math.min(g, H[cx * N + cy]);
    }
    return g;
  });
  const inT = pts.map(([x, y]) => townDist(Math.round(x), Math.round(y)) <= 0);
  const firstT = inT.indexOf(true), lastT = inT.lastIndexOf(true);
  const L = new Array(pts.length);
  // (owner 2026-10-21 screenshots: a 21-brick sheer step where a road crossed, flat
  // rectangular pools behind dams; "doesn't work in real life") real rivers only fall:
  // the level is the lowest bank around each point (RIVER.levelWin points either side),
  // never higher than any level upstream (higher ground downstream is cut through as a
  // valley, not dammed), then eased so it falls at most a brick every RIVER.stepEvery
  // points (riffles, each with a foam cascade) by starting the descent earlier.
  // Was: reaches of RIVER.levelBlock points at the bank level both ways = 9-24 brick
  // walls and water climbing back up downstream.
  const LW = RIVER.levelWin, SE = RIVER.stepEvery, tgt = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    let g = Infinity;
    for (let j = Math.max(0, i - LW); j < Math.min(pts.length, i + LW + 1); j++) g = Math.min(g, ground[j]);
    tgt[i] = Math.max(g - 1, SEA - 1);
  }
  // falling fit: the non-increasing profile with the least cutting (ground over the water)
  // + RIVER.fillCost x damming (water over the ground, held by levees), the town pinned:
  // pool-adjacent-violators, each pooled reach at the weighted quantile 1 / (1 + fillCost)
  const q = 1 / (1 + RIVER.fillCost), blocks = [];
  const quant = vs => { const tot = vs.reduce((a, v) => a + v[1], 0); let acc = 0; for (const v of vs) { acc += v[1]; if (acc >= q * tot) return v[0]; } return vs[vs.length - 1][0]; };
  const mergeSorted = (a, b) => { const o = []; let i = 0, j = 0; while (i < a.length || j < b.length) o.push(j >= b.length || (i < a.length && a[i][0] <= b[j][0]) ? a[i++] : b[j++]); return o; };
  for (let i = 0; i < pts.length; i++) {
    const vs = [[inT[i] ? townL : tgt[i], inT[i] ? 1000 : 1]];
    blocks.push({ i0: i, i1: i + 1, vs, v: vs[0][0] });
    while (blocks.length > 1 && blocks[blocks.length - 2].v < blocks[blocks.length - 1].v) {
      const b2 = blocks.pop(), b1 = blocks.pop(), m = mergeSorted(b1.vs, b2.vs);
      blocks.push({ i0: b1.i0, i1: b2.i1, vs: m, v: quant(m) });
    }
  }
  for (const bl of blocks) for (let i = bl.i0; i < bl.i1; i++) L[i] = bl.v;
  if (firstT >= 0 && L[firstT] !== townL) console.error(`river: reaches town at level ${L[firstT]} (town water ${townL})`);
  { let cut = 0, fill = 0, fmax = 0; for (let i = 0; i < pts.length; i++) { if (inT[i]) continue; const d = L[i] - tgt[i]; if (d > 0) { fill += d; fmax = Math.max(fmax, d); } else cut -= d; } console.error(`river fit: cut ${cut}, dammed ${fill} (max ${fmax}) brick-points`); if (process.env.MAPGEN_RIVERDIAG) { const sx = -(X0 + (town.fx + TOWN.cells / 2) * CELL), sy = -(Y0 + (town.fy + TOWN.cells / 2) * CELL); const r = []; for (let i = 0; i < pts.length; i += 10) r.push(`${i}:${Math.round(X0 + pts[i][0] * CELL + sx)},${Math.round(Y0 + pts[i][1] * CELL + sy)} L${L[i]} g${tgt[i]}${inT[i] ? 'T' : ''}`); console.error('river profile: ' + r.join(' | ')); } }
  for (let i = pts.length - 2, f = L[pts.length - 1]; i >= 0; i--) { f = Math.min(L[i], f + 1 / SE); L[i] = Math.floor(f + 1e-9); }
  for (let i = 1; i < pts.length; i++) L[i] = Math.min(L[i], L[i - 1]); // the easing never lifts a point over its upstream
  // stop a little way into the sea
  let end = pts.length;
  for (let i = Math.max(0, lastT) + 1, wet = 0; i < pts.length; i++) { wet = ground[i] <= SEA - 2 ? wet + 1 : 0; if (wet > 6) { end = i; break; } }
  if (process.env.MAPGEN_RIVERDIAG) {
    const sx = -(X0 + (town.fx + TOWN.cells / 2) * CELL), sy = -(Y0 + (town.fy + TOWN.cells / 2) * CELL);
    const drops = [];
    for (let i = 1; i < end; i++) if (L[i] < L[i - 1]) drops.push(`${L[i - 1] - L[i]}@${Math.round(X0 + pts[i][0] * CELL + sx)},${Math.round(Y0 + pts[i][1] * CELL + sy)}${inT[i - 1] ? '(town)' : ''}`);
    console.error(`river level drops: ${drops.join(' ')}`);
  }
  // where the channel's floor first reaches the sea past town (the delta's coast)
  let coast = -1;
  for (let i = Math.max(0, lastT) + 1; i < end; i++) if (ground[i] <= SEA - 2) { coast = i; break; }
  return { pts: pts.slice(0, end), L: L.slice(0, end), coast };
})();
{
  const { pts, L } = riverRiver, rw = RIVER.rw, R = rw + RIVER.bank + RIVER.valley;
  const best = new Float32Array(N * N).fill(Infinity), idx = new Int32Array(N * N).fill(-1);
  const apron = new Uint8Array(N * N); for (const c of apronCells) apron[c] = 1;
  const deferred = new Map();
  // valley sides: cut down to the profile (never fill), roughened past the banks; where the
  // ground lies under the water (a dammed basin) a floodplain is built up a brick a cell
  // (river.embank) from the banks instead of a bare levee
  const valleyAt = (c, target, d, lv, e) => {
    if (H[c] > target) H[c] = target;
    if (d <= rw + 3 && H[c] < lv + 1) H[c] = lv + 1;
    else if (lv > SEA) { const fl = lv + 1 - Math.floor(Math.max(0, e - 3) * RIVER.embank); if (H[c] < fl) H[c] = fl; }
  };
  pts.forEach(([px, py], i) => {
    for (let x = Math.floor(px - R); x <= Math.ceil(px + R); x++)
      for (let y = Math.floor(py - R); y <= Math.ceil(py + R); y++) {
        if (!inBounds(x, y)) continue;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py), c = x * N + y;
        if (d <= R && d < best[c]) { best[c] = d; idx[c] = i; }
      }
  });
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y, d = best[c];
      if (idx[c] < 0 || DUNGEONS.some(dd => footDist(dd, x, y) <= 2) || apron[c]) continue;
      const lv = L[idx[c]];
      riverBankL[c] = lv;
      if (d <= rw) {
        riverCell[c] = 1; riverLevel[c] = lv; noSmooth[c] = 1; keepOut[c] = 1;
        // the bed RIVER.depth under the water, cut or filled (a dammed reach was a deep pit)
        H[c] = townKind[c] ? Math.min(H[c], lv - RIVER.depth) : lv - RIVER.depth;
        continue;
      }
      if (d <= rw + 2) keepOut[c] = 1;
      if (townKind[c]) continue; // the town is already level with the banks
      // valley sides: cut down to the profile (never fill), roughened past the banks
      const e = d - rw, wx = X0 + x * CELL, wy = Y0 + y * CELL;
      const target = lv + 1 + Math.floor(valleyRise(e) + fbm2(wx / 900 + 13, wy / 900 - 7, 3) * 6 * smooth(4, 14, e));
      if (trenchCell[c]) { deferred.set(c, [target, d, lv, e]); continue; } // after the trench is re-walked
      valleyAt(c, target, d, lv, e);
    }
  // (2026-10-21) dungeon entrance trenches were cut before the river and kept out of its
  // valley, so the valley left them standing as causeways (owner: "the path flies up into
  // the air"): re-walk each trench on the valley ground; it now ends where that ground
  // meets its floor or at the river, and the rest of the old trench is valley again
  for (const dg of DUNGEONS) {
    const tw = dg.trenchWalk; if (!tw) continue;
    let x = tw.x, y = tw.y; const path = [];
    for (let k = 0; k < 160; k++) {
      x += tw.dx; y += tw.dy;
      const side = [-1, 0, 1].map(l => [x + tw.dy * l, y + tw.dx * l]).filter(([sx, sy]) => inBounds(sx, sy));
      if (!side.some(([sx, sy]) => trenchCell[sx * N + sy])) break;
      path.push({ k, x, y, side });
    }
    let keepN = path.length;
    for (let j = 0; j < path.length; j++) {
      const { k, x, y, side } = path[j], out = Math.max(0, Math.min(k, footDist(dg, x, y))), floor = tw.roof + out;
      if (side.some(([sx, sy]) => riverCell[sx * N + sy]) || (out > 0 && side.every(([sx, sy]) => deferred.has(sx * N + sy) && deferred.get(sx * N + sy)[0] <= floor))) { keepN = j; break; }
    }
    for (let j = keepN; j < path.length; j++) for (const [sx, sy] of path[j].side) { const c = sx * N + sy; trenchCell[c] = 0; const v = deferred.get(c); if (v) valleyAt(c, ...v); }
    if (keepN < path.length) { dg.mouth = keepN ? [path[keepN - 1].x, path[keepN - 1].y] : [tw.x, tw.y]; console.error(`${dg.name}: trench ends ${path.length - keepN} cells sooner (river valley)`); }
  }
  console.error(`river: ${pts.length} cells long, ${rw * 2} wide, level ${L[0]} -> ${L[L.length - 1]} (town ${town.h - 1})`);
}
const riverNear = (cx, cy, r) => {
  for (let x = cx - r; x <= cx + r; x += 2) for (let y = cy - r; y <= cy + r; y += 2) if (inBounds(x, y) && riverCell[x * N + y]) return true;
  return false;
};
stage('swamp');
// ------------------------------------------------------------------ swamp --
// The piss-and-shit swamp: a marsh outside one of the town gates, sunk to sea
// level so the water plane floods its pools (lily pads on them); the rest is
// mud with rushes, dead trees and turd piles. Zombies (swamp_zombie_1/2 prefabs) spawn
// on the mud. A dirt road runs from the gate.
const SWAMP = { r: Math.round(tune('swamp.r', 45, 'radius, cells (x K)') * K), blend: Math.round(tune('swamp.blend', 14, 'blend, cells (x K)') * K) }; // smaller since the island (2026-10-03): it has to fit beside the town
const swamp = (() => {
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2;
  let best = null, why;
  // nowhere fits (narrow island, crowded): relax the land share and clearances
  for (const [minLand, slack] of [[0.6, 1], [0.45, 0.75], [0.3, 0.5]]) {
    if (best) break;
    if (why) console.error(`swamp: no site (${JSON.stringify(why)}), relaxing to land ${minLand}, clearance x${slack}`);
    why = { far: 0, edge: 0, town: 0, dungeon: 0, water: 0 };
  for (let cx = 8; cx < N - 8; cx += 5)
    for (let cy = 8; cy < N - 8; cy += 5) {
      const d = Math.hypot(cx - tx, cy - ty);
      if (d > TOWN.cells / 2 + tune('swamp.maxDist', 235, 'max cells from the town (x K)') * K) { why.far++; continue; }
      // the road leaves by the gate facing it
      const [gx, gy] = Math.abs(cx - tx) >= Math.abs(cy - ty) ? [Math.sign(cx - tx), 0] : [0, Math.sign(cy - ty)];
      {
        const R = SWAMP.r + SWAMP.blend;
        if (cx - R < 8 || cy - R < 8 || cx + R >= N - 8 || cy + R >= N - 8) { why.edge++; continue; } // the sea ring may eat a bit
        const reach = Math.ceil(R * 1.12 * slack); // the noisy edge reaches about 12% further
        if (townDist(cx, cy) < reach + 4) { why.town++; continue; }
        if (DUNGEONS.some(dd => footDist(dd, cx, cy) < reach + 6)) { why.dungeon++; continue; }
        if (riverNear(cx, cy, reach + 4)) { why.dungeon++; continue; }
        let land = 0, sum = 0, n = 0;
        for (let x = cx - SWAMP.r; x <= cx + SWAMP.r; x += 3)
          for (let y = cy - SWAMP.r; y <= cy + SWAMP.r; y += 3) {
            if (Math.hypot(x - cx, y - cy) > SWAMP.r) continue;
            const h = H[x * N + y];
            n++; sum += h; if (h > SEA) land++;
          }
        if (land / n < minLand) { why.water++; continue; } // a marsh, not a bay
        const score = sum / n + d * 0.15;
        if (!best || score < best.score) best = { x: cx, y: cy, gate: [gx, gy], score };
      }
    }
  }
  if (!best) throw new Error('no site for the swamp: ' + JSON.stringify(why));
  return best;
})();
const swampCell = new Uint8Array(N * N); // 1 = swamp floor (mud or pool)
const swampRho = (x, y) => {
  const wx = X0 + x * CELL, wy = Y0 + y * CELL;
  // a ragged, lobed edge (2026-10-06, owner: it read as a disc)
  // stretched into an oval along a seed angle (same area)
  const ang = hash(91, 17) * Math.PI, dx = x - swamp.x, dy = y - swamp.y;
  const u = (dx * Math.cos(ang) + dy * Math.sin(ang)) / 1.3, v = (-dx * Math.sin(ang) + dy * Math.cos(ang)) * 1.3;
  return Math.hypot(u, v) * (1 + 0.34 * fbm2(wx / 1500 + 61, wy / 1500 - 23, 3) + 0.12 * fbm2(wx / 520 - 8, wy / 520 + 44, 2));
};
for (let x = swamp.x - SWAMP.r - SWAMP.blend - 12; x <= swamp.x + SWAMP.r + SWAMP.blend + 12; x++)
  for (let y = swamp.y - SWAMP.r - SWAMP.blend - 12; y <= swamp.y + SWAMP.r + SWAMP.blend + 12; y++) {
    if (!inBounds(x, y)) continue;
    const rho = swampRho(x, y);
    if (rho >= SWAMP.r + SWAMP.blend) continue;
    const wx = X0 + x * CELL, wy = Y0 + y * CELL;
    // pools (SEA-3..SEA-1, under the water plane) and mud banks (SEA..SEA+1)
    const core = SEA - 1 + Math.max(-2, Math.min(2, Math.round(fbm2(wx / 520 + 13, wy / 520 + 71, 3) * 3.2)));
    // grassy hummocks standing out of the marsh (not swamp floor: grass, plants)
    const hum = fbm2(wx / 760 - 37, wy / 760 + 12, 3);
    if (rho < SWAMP.r && hum > 0.22) { H[x * N + y] = SEA + 2 + Math.round(smooth(0.22, 0.45, hum) * 3); continue; }
    if (rho < SWAMP.r) { H[x * N + y] = core; swampCell[x * N + y] = 1; }
    else H[x * N + y] = Math.round(lerp(core, H[x * N + y], smooth(SWAMP.r, SWAMP.r + SWAMP.blend, rho)));
  }

// the land round the marsh sinks into a low basin of hummocks (2026-10-06, owner:
// the swamp sat in a round pit), only ever lowered, fading out over SWAMP.basin
SWAMP.basin = Math.round(tune('swamp.basin', 45, 'low ground round the marsh, cells (x K)') * K);
{
  const R0 = SWAMP.r + SWAMP.blend, R1 = R0 + SWAMP.basin;
  for (let x = swamp.x - R1 - 12; x <= swamp.x + R1 + 12; x++)
    for (let y = swamp.y - R1 - 12; y <= swamp.y + R1 + 12; y++) {
      if (!inBounds(x, y)) continue;
      const c = x * N + y, rho = swampRho(x, y);
      if (rho < SWAMP.r || rho >= R1 || riverCell[c] || trenchCell[c]) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      // hummocks rising slowly away from the marsh
      const low = SEA + 2 + Math.max(0, rho - SWAMP.r) * 0.22 + fbm2(wx / 700 + 3, wy / 700 - 9, 3) * 4;
      let w = 1 - smooth(R0, R1, rho);
      w *= smooth(TOWN.blend, TOWN.blend + 24, townDist(x, y));
      w *= Math.min(1, ...DUNGEONS.map(d => smooth(2, RAISE_BLEND, footDist(d, x, y))));
      if (riverBankL[c] > -999) w *= 0.5;
      if (H[c] > low) H[c] = Math.round(lerp(H[c], low, w));
    }
}
stage('desert');
// ------------------------------------------------------------ desert site --
// A desert biome (2026-10-03): the flattest broad stretch of land well away
// from the town and the swamp: dune sand, red mesa rock on slopes and peaks, a
// dry-grass fringe; cacti and dead scrub instead of trees and flowers. Villages
// inside it get western houses (town.mjs, village.desert).
// Levelled since 2026-10-06 (owner: "more natural looking and flatter"): the
// ground eases to the area's mean plus broad swells, low wind dunes and a few
// flat-topped buttes, over the biome's blend; it is placed before the hamlets,
// roads and caves so they all sit on the new ground.
const DESERT = { r: Math.round(tune('desert.r', 80, 'radius, cells (x K)') * K), blend: tune('desert.blend', 26, 'blend, cells') };
const desert = (() => {
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2;
  let best = null;
  // nowhere fits (narrow island): relax the land share and the swamp gap
  for (const [minLand, slack] of [[0.85, 1], [0.65, 0.7], [0.45, 0.4]]) {
    if (best) break;
    if (minLand < 0.85) console.error(`desert: no site, relaxing to land ${minLand}, gap x${slack}`);
  for (let cx = DESERT.r; cx < N - DESERT.r; cx += 8)
    for (let cy = DESERT.r; cy < N - DESERT.r; cy += 8) {
      if (Math.hypot(cx - tx, cy - ty) < TOWN.cells / 2 + DESERT.r + 40 * K) continue;
      if (Math.hypot(cx - swamp.x, cy - swamp.y) < slack * (SWAMP.r + SWAMP.blend + DESERT.r + DESERT.blend)) continue;
      let land = 0, n = 0, sum = 0, sq = 0;
      for (let x = cx - DESERT.r; x <= cx + DESERT.r; x += 4)
        for (let y = cy - DESERT.r; y <= cy + DESERT.r; y += 4) {
          if (Math.hypot(x - cx, y - cy) > DESERT.r) continue;
          const h = H[x * N + y]; n++;
          if (h > SEA + 1) { land++; sum += h; sq += h * h; }
        }
      if (land / n < minLand) continue;
      const mean = sum / land, sd = Math.sqrt(Math.max(0, sq / land - mean * mean));
      const score = sd + mean * 0.1;
      if (!best || score < best.score) best = { x: cx, y: cy, score };
    }
  }
  if (!best) throw new Error('no site for the desert');
  return best;
})();
const desertW = (x, y) => {
  const wx = X0 + x * CELL, wy = Y0 + y * CELL;
  const rho = Math.hypot(x - desert.x, y - desert.y) * (1 + 0.2 * fbm2(wx / 2200 - 41, wy / 2200 + 17, 3));
  return 1 - smooth(DESERT.r - DESERT.blend / 2, DESERT.r + DESERT.blend / 2, rho);
};
{
  // level it: mean height + broad swells + dunes + a few buttes
  let sum = 0, n = 0;
  for (let x = desert.x - DESERT.r; x <= desert.x + DESERT.r; x += 2)
    for (let y = desert.y - DESERT.r; y <= desert.y + DESERT.r; y += 2) {
      if (!inBounds(x, y) || Math.hypot(x - desert.x, y - desert.y) > DESERT.r) continue;
      const h = H[x * N + y]; if (h > SEA + 1) { sum += h; n++; }
    }
  const mean = Math.max(SEA + 6, Math.min(70, sum / Math.max(1, n)));
  const R = DESERT.r + DESERT.blend;
  for (let x = desert.x - R - 20; x <= desert.x + R + 20; x++)
    for (let y = desert.y - R - 20; y <= desert.y + R + 20; y++) {
      if (!inBounds(x, y)) continue;
      const c = x * N + y;
      let w = desertW(x, y);
      if (w <= 0 || riverCell[c] || trenchCell[c] || H[c] <= SEA) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      const swell = fbm2(wx / 3000 + 21, wy / 3000 - 4, 3) * 9;
      // dunes: long crests across the wind (+x), broken up
      const u = wx * 0.94 + wy * 0.34, v = -wx * 0.34 + wy * 0.94;
      const dune = (1 - Math.abs(Math.sin(u / 420 + fbm2(wx / 1500, wy / 1500, 2) * 3))) ** 2 * 4 * (0.5 + 0.5 * fbm2(v / 1200 + 5, u / 1200, 2));
      // buttes: rare flat tops, 10-16 bricks proud
      const b = fbm2(wx / 1400 - 77, wy / 1400 + 31, 3);
      const butte = b > 0.42 ? (10 + Math.round(b * 10)) * smooth(0.42, 0.47, b) : 0;
      const target = Math.round(mean + swell + dune + butte);
      w *= Math.min(1, ...DUNGEONS.map(d => smooth(2, RAISE_BLEND, footDist(d, x, y))));
      w *= smooth(TOWN.blend, TOWN.blend + 24, townDist(x, y));
      let h = Math.round(lerp(H[c], target, w));
      // by the river: only cut, and keep the banks above the water
      if (riverBankL[c] > -999) h = Math.max(riverBankL[c] + 1, Math.min(H[c], h));
      H[c] = Math.max(SEA + 1, h);
    }
}

stage('volcano');
// ---------------------------------------------------------------- volcano --
// (owner 2026-10-10: "make a volcano biome with spiral pathing to the top") A
// lone cone of dark basalt and ash, a crater with a glowing lava lake, lava
// runs down its flanks, and a road spiralling up round it to the rim. The road
// hugs the cone: at every point it sits where the cone's plain profile has the
// road's height, and it climbs a fixed grade per cell (volcano.grade), so the
// turns bunch up near the steep top. A straight lead runs out from its foot
// for the road network (roads section) to join. Placed after the desert,
// before the hamlets, so nothing else is built on its slopes (keepOut).
const VOLC = { r: Math.round(tune('volcano.r', 42, 'cone base radius, cells (x K)') * K), rise: tune('volcano.rise', 96, 'peak above the foot, voxels'),
  crater: tune('volcano.crater', 0.2, 'crater radius / cone radius'), pow: tune('volcano.pow', 1.5, 'cone profile (higher = steeper top)'),
  grade: tune('volcano.grade', 0.18, 'spiral road climb, bricks per cell'), half: 2 /* road half-width, cells */, lava: tune('volcano.flows', 4, 'lava runs down the flanks') };
const volcanoCell = new Uint8Array(N * N); // 1 cone, 2 road, 3 lava
// chamfer distance (cells) to the river, for the biome site searches
const riverD = new Float32Array(N * N).fill(1e9);
{
  for (let i = 0; i < N * N; i++) if (riverCell[i]) riverD[i] = 0;
  const pass = (s, e, st) => {
    for (let x = s; x !== e; x += st)
      for (let y = s; y !== e; y += st) {
        let d = riverD[x * N + y];
        for (const [a, b, w] of [[-st, 0, 1], [0, -st, 1], [-st, -st, 1.41], [-st, st, 1.41]]) { const xx = x + a, yy = y + b; if (inBounds(xx, yy) && riverD[xx * N + yy] + w < d) d = riverD[xx * N + yy] + w; }
        riverD[x * N + y] = d;
      }
  };
  pass(0, N, 1); pass(N - 1, -1, -1);
}
const landShare = (cx, cy, r, Hs = H) => {
  let land = 0, n = 0;
  for (let x = cx - r; x <= cx + r; x += 4) for (let y = cy - r; y <= cy + r; y += 4) {
    if (!inBounds(x, y) || Math.hypot(x - cx, y - cy) > r) continue;
    n++; if (Hs[x * N + y] > SEA + 1) land++;
  }
  return n ? land / n : 0;
};
const volcanoSite = onTail => {
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2, R = VOLC.r;
  let best = null;
  for (const [minLand, slack] of [[0.75, 1], [0.6, 0.75], [0.45, 0.5]]) {
    if (best) break;
    if (minLand < 0.75 && onTail) console.error(`volcano: no site, relaxing to land ${minLand}, gaps x${slack}`);
    for (let cx = R + 20; cx < N - R - 20; cx += 6)
      for (let cy = R + 20; cy < N - R - 20; cy += 6) {
        if (Math.hypot(cx - tx, cy - ty) < TOWN.cells / 2 + R + 40 * K * slack) continue;
        if (swampRho(cx, cy) < SWAMP.r + SWAMP.blend + R + SWAMP.basin * slack) continue;
        if (Math.hypot(cx - desert.x, cy - desert.y) < DESERT.r + DESERT.blend * slack + R) continue;
        if (DUNGEONS.some(d => footDist(d, cx, cy) < R + RAISE_BLEND * slack)) continue;
        if (riverD[cx * N + cy] < R * 1.15) continue;
        if (onTail && tailU[cx * N + cy] < 0.5) continue; // (2026-10-14) at the tip of the tail, past the death forest
        const land = landShare(cx, cy, R);
        if (land < minLand) continue;
        const score = onTail ? -tailU[cx * N + cy] * 2 + (1 - land) * 1.5 + hash(cx, cy, 401) * 0.05 : Math.abs(progress(cx, cy) - 0.6) + (1 - land) + hash(cx, cy, 401) * 0.1;
        if (!best || score < best.score) best = { x: cx, y: cy, score };
      }
  }
  if (!best) throw new Error('no site for the volcano');
  return best;
};
// where the volcano stood until 2026-10-14 (the old search, on the old island): the site searches that
// steered round it still do, so the hamlets, ruins, camps, temples and caves keep their places; its
// ground is plain land now (trees, plants)
const formerVolcano = volcanoSite(false), formerVCell = new Uint8Array(N * N);
{
  const R = VOLC.r, { x: vx, y: vy } = formerVolcano;
  const ragged = (x, y) => 1 + 0.12 * fbm2((X0 + x * CELL) / 1800 + 77, (Y0 + y * CELL) / 1800 - 31, 3);
  for (let x = vx - Math.ceil(R * 1.4); x <= vx + R * 1.4; x++)
    for (let y = vy - Math.ceil(R * 1.4); y <= vy + R * 1.4; y++)
      if (inBounds(x, y) && Math.hypot(x - vx, y - vy) * ragged(x, y) / R < 1.02 + (hash(x, y, 402) - 0.5) * 0.12) formerVCell[x * N + y] = 1;
}
const siteOff = c => tailOff(c) || formerVCell[c] === 1; // count-limited site searches skip these
const Hpre = H.slice(); // the old island's ground, for the snow's site search
// the tail's land goes in now (never lowering anything, never on the river, its banks or the dungeons' ground)
{
  let n = 0;
  for (let c = 0; c < N * N; c++) {
    if (tailU[c] < 0 || Htail[c] <= H[c] || riverCell[c] || riverBankL[c] > -999 || keepOut[c]) continue;
    const x = (c / N) | 0, y = c % N;
    if (DUNGEONS.some(d => footDist(d, x, y) <= RAISE_BLEND) || townDist(x, y) <= TOWN.blend + 24 || swampCell[c]) continue;
    H[c] = Htail[c]; n++;
  }
  console.error(`tail: ${spine.tail.length} spine points, ${Math.round(spine.LT - spine.L)} cells long, ${n} cells raised`);
}
const volcano = volcanoSite(true);
{
  const R = VOLC.r, rc = R * VOLC.crater, { x: vx, y: vy } = volcano;
  let sum = 0, n = 0;
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2, x = Math.round(vx + Math.cos(a) * R), y = Math.round(vy + Math.sin(a) * R); if (inBounds(x, y)) { sum += Math.max(H[x * N + y], SEA + 2); n++; } }
  const foot = Math.round(sum / n), peak = Math.min(NZ - 14, foot + VOLC.rise);
  const prof = t => foot + (peak - foot) * Math.pow(Math.max(0, 1 - t), VOLC.pow);
  const rim = prof(rc / R), lake = Math.round(rim) - 14;
  Object.assign(volcano, { foot, peak, rim: Math.round(rim), lake });
  const ragged = (x, y) => 1 + 0.12 * fbm2((X0 + x * CELL) / 1800 + 77, (Y0 + y * CELL) / 1800 - 31, 3);
  for (let x = vx - Math.ceil(R * 1.4); x <= vx + R * 1.4; x++)
    for (let y = vy - Math.ceil(R * 1.4); y <= vy + R * 1.4; y++) {
      if (!inBounds(x, y)) continue;
      const c = x * N + y, rho = Math.hypot(x - vx, y - vy) * ragged(x, y), t = rho / R;
      if (t >= 1.3) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      let h;
      if (rho < rc) h = lake + (rim - lake) * smooth(rc * 0.55, rc, rho); // the crater bowl
      else h = prof(t) + fbm2(wx / 260 + 9, wy / 260 - 4, 2) * 3 * (1 - t) - Math.abs(Math.sin(Math.atan2(y - vy, x - vx) * 7 + fbm2(wx / 900, wy / 900, 2) * 2)) * 3 * Math.min(1, t * 2); // gullies down the flanks
      let w = 1 - smooth(0.92, 1.28, t);
      w *= Math.min(1, ...DUNGEONS.map(d => smooth(2, RAISE_BLEND, footDist(d, x, y))));
      w *= smooth(TOWN.blend, TOWN.blend + 24, townDist(x, y));
      if (riverCell[c] && t >= 0.92) continue;
      const nh = t < 0.92 ? h : Math.max(H[c], lerp(H[c], h, w));
      H[c] = Math.max(SEA + 1, Math.min(NZ - 10, Math.round(nh)));
      if (t < 1.02 + (hash(x, y, 402) - 0.5) * 0.12) { volcanoCell[c] = 1; keepOut[c] = 1; }
      if (rho < rc * 0.55) { volcanoCell[c] = 3; H[c] = lake; }
    }
  // the spiral road: from the foot (facing back up the tail, where the road comes from) round and up to the rim
  const back = spine.tail.find(p => p[2] >= spine.L + Math.max(0, tailU[vx * N + vy] - 0.35) * (spine.LT - spine.L));
  const a0 = Math.atan2(back[1] - vy, back[0] - vx), dir = hash(vx, vy, 403) < 0.5 ? 1 : -1;
  const rAt = h => R * (1 - Math.pow(Math.max(0, Math.min(1, (h - foot) / (peak - foot))), 1 / VOLC.pow));
  const pts = []; // [x, y, h] cells
  // a straight lead from outside the cone in to the foot of the spiral
  const r0 = rAt(foot + 1), lead = Math.ceil(R * 0.3);
  for (let k = lead; k > 0; k--) {
    const r = r0 + k, x = vx + Math.cos(a0) * r, y = vy + Math.sin(a0) * r;
    const g = H[Math.round(x) * N + Math.round(y)];
    pts.push([x, y, lerp(foot + 1, Math.max(g, SEA + 2), k / lead)]);
  }
  let arc = 0;
  for (let th = a0, h = foot + 1; ; ) {
    const r = rAt(h);
    if (r <= rc + 2) break;
    pts.push([vx + Math.cos(th) * r, vy + Math.sin(th) * r, h]);
    th += (dir * 0.4) / r; h += VOLC.grade * 0.4; arc += 0.4 / r;
  }
  const best = new Map(); // cell -> [distance, height]
  for (const [px, py, ph] of pts)
    for (let x = Math.floor(px - VOLC.half - 1); x <= px + VOLC.half + 1; x++)
      for (let y = Math.floor(py - VOLC.half - 1); y <= py + VOLC.half + 1; y++) {
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d > VOLC.half + 0.5 || !inBounds(x, y)) continue;
        const c = x * N + y, o = best.get(c);
        if (!o || d < o[0]) best.set(c, [d, ph]);
      }
  for (const [c, [, ph]] of best) { H[c] = Math.round(ph); volcanoCell[c] = 2; keepOut[c] = 1; }
  volcano.road = [...best.keys()];
  volcano.lead = [Math.round(pts[0][0]), Math.round(pts[0][1])];
  // lava runs: from the rim down the steepest way; under the road (it passes
  // over them on its own level) and a cell either side of it the ground is left alone
  const nearRoad = (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (inBounds(x + a, y + b) && volcanoCell[(x + a) * N + y + b] === 2) return true; return false; };
  let flows = 0;
  for (let k = 0; k < VOLC.lava; k++) {
    const a = a0 + Math.PI * (0.5 + (2 * k) / VOLC.lava) + hash(k, 404) * 0.6;
    let x = Math.round(vx + Math.cos(a) * (rc + 1)), y = Math.round(vy + Math.sin(a) * (rc + 1)), len = 0;
    for (let step = 0; step < R; step++) {
      if (!inBounds(x, y) || Math.hypot(x - vx, y - vy) > R * 0.85) break;
      if (!nearRoad(x, y)) for (const [a2, b2] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c = (x + a2) * N + y + b2; if (inBounds(x + a2, y + b2) && !nearRoad(x + a2, y + b2)) volcanoCell[c] = 3; } // flush: a sunk channel would hide under the smoothing wedges
      len++;
      // downhill, away from the centre
      let nx = x, ny = y, lo = Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const xx = x + dx, yy = y + dy; if (!inBounds(xx, yy)) continue;
        if (Math.hypot(xx - vx, yy - vy) <= Math.hypot(x - vx, y - vy)) continue;
        const v = H[xx * N + yy] + hash(xx, yy, 405) * 0.5;
        if (v < lo) { lo = v; nx = xx; ny = yy; }
      }
      if (nx === x && ny === y) break;
      x = nx; y = ny;
    }
    if (len > 3) flows++;
  }
  console.error(`volcano: cells ${vx},${vy}, foot ${foot}, rim ${volcano.rim}, lava lake ${lake}, road ${volcano.road.length} cells, ${(arc / (2 * Math.PI)).toFixed(1)} turns, ${flows} lava runs`);
}

stage('snow');
// ------------------------------------------------------------------- snow --
// (owner 2026-10-10: "make a snow biome with mountains") A range of ridged
// peaks raised out of the land (never lowered) far up the island, white with
// snow, bare rock only on the steepest faces, snowy pines in the valleys.
const SNOWB = { r: Math.round(tune('snow.r', 50, 'radius, cells (x K)') * K), blend: Math.round(tune('snow.blend', 26, 'blend, cells (x K)') * K),
  amp: tune('snow.amp', 78, 'mountain height over the ground, voxels'), scale: tune('snow.scale', 1700, 'ridge noise size, units'), lift: tune('snow.lift', 10, 'base lift, voxels') };
const snowSite = (() => {
  // (2026-10-21) snow.at [cx, cy] pins the site: a river change moved the site search off the live tiered mountains
  const pin = tune('snow.at', null, 'pin the snow site to these cells [x, y] (null = search)');
  if (pin) return { x: pin[0], y: pin[1], score: 0 };
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2, R = SNOWB.r;
  let best = null, why;
  // the blend may run over the neighbours' fringes (the raise fades out there); the core may not
  for (const [minLand, slack] of [[0.7, 1], [0.55, 0.7], [0.4, 0.45]]) {
    if (best) break;
    if (why) console.error(`snow: no site (${JSON.stringify(why)}), relaxing to land ${minLand}, gaps x${slack}`);
    why = { town: 0, swamp: 0, desert: 0, volcano: 0, river: 0, land: 0 };
    for (let cx = 30; cx < N - 30; cx += 6)
      for (let cy = 30; cy < N - 30; cy += 6) {
        if (Math.hypot(cx - tx, cy - ty) < TOWN.cells / 2 + TOWN.blend + R + 20 * K * slack) { why.town++; continue; }
        if (swampRho(cx, cy) < SWAMP.r + SWAMP.blend + R + 20 * K * slack) { why.swamp++; continue; }
        if (Math.hypot(cx - desert.x, cy - desert.y) < DESERT.r + R + DESERT.blend * slack) { why.desert++; continue; }
        if (Math.hypot(cx - formerVolcano.x, cy - formerVolcano.y) < VOLC.r * 1.3 + R + SNOWB.blend * 0.5 * slack) { why.volcano++; continue; }
        if (riverD[cx * N + cy] < R * 0.4 * slack) { why.river++; continue; }
        if (tailU[cx * N + cy] > 0.1) { why.volcano++; continue; } // the tail is the death forest's
        const land = landShare(cx, cy, R, Hpre);
        if (land < minLand) { why.land++; continue; }
        const score = -progress(cx, cy) + (1 - land) * 1.5 + hash(cx, cy, 411) * 0.1;
        if (!best || score < best.score) best = { x: cx, y: cy, score };
      }
  }
  if (!best) throw new Error('no site for the snow biome');
  return best;
})();
const snowW = (x, y) => {
  const wx = X0 + x * CELL, wy = Y0 + y * CELL;
  const rho = Math.hypot(x - snowSite.x, y - snowSite.y) * (1 + 0.22 * fbm2(wx / 2400 + 13, wy / 2400 - 57, 3));
  return 1 - smooth(SNOWB.r - SNOWB.blend / 2, SNOWB.r + SNOWB.blend / 2, rho);
};
// (2026-10-10) the viking hamlet is not in the snow biome itself (Mountain Deep
// and the river fill it; a valley there cut into the Sunken Keep): it is a
// normal hamlet site far up the island with its own snowfall (nordicSnowW, see villages)
const NORDIC_R = 22; // = VILLAGE.r (declared further down)
const nordicSpot = null;
const nordicCalm = (x, y) => (nordicSpot ? smooth(NORDIC_R + 4, NORDIC_R + 34, Math.hypot(x - nordicSpot.x, y - nordicSpot.y)) : 1);
// TIERED MOUNTAINS (2026-10-20, owner's tiny model on the plaza + "mountains cut up into sections of circle with
// circles growing out of the edges", "a trail ... dirt steps and flat ground", "90 degree vertical drop",
// "kind of like a puzzle"): snow.style tiers = each mountain is stacked flat shelves snow.tierH apart with
// sheer walls. Outline of a tier = the tier above grown 1-2 cells plus circle lobes sprouting from its edge.
// Wall corners get 45 degree upright wedges (convex corners cut, concave filled). A dirt stair (2-stud
// treads) climbs along a wall onto every next shelf; each flight starts round the far side of the
// mountain from where the last one arrived, so the shelf walk between them is the puzzle.
const SNOW_STYLE = tune('snow.style', 'tiers', 'tiers = flat shelves, sheer walls, circle-lobed tiers, dirt stair trail; ridge = old ridged peaks');
const TIER = { h: tune('snow.tierH', 6, 'tier wall height, voxels'), peaks: tune('snow.peaks', 4, 'tiered mountains in the range'),
  levels: tune('snow.levels', 12, 'most tiers per mountain'), lobes: tune('snow.lobes', 3, 'circle lobes grown out of each tier edge') };
const tierMtn = { cells: new Uint8Array(N * N), trail: new Uint8Array(N * N), B: new Int16Array(N * N).fill(-1), stairAt: new Uint8Array(N * N), chamfer: [], stairs: [], peaks: [], win: null };
// tier wall corners (run after the tiers are built and again after the river valley cap re-cut them)
function tierCorners() {
  const T = TIER.h, { x0, y0, W } = tierMtn.win;
  const hN = (x, y) => (inBounds(x, y) ? H[x * N + y] : -1);
  const busy = c => riverCell[c] || trenchCell[c] || volcanoCell[c] || H[c] <= SEA;
  // 45 degree corners: cut convex corners down a tier, then every cell with two perpendicular walls exactly one
  // tier up (and open on the other two sides) gets an upright wedge filling the half toward them
  const DG = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let c = 0; c < N * N; c++) {
    if (tierMtn.B[c] < 0 || tierMtn.stairAt[c]) continue; // never under a stair flight
    const x = (c / N) | 0, y = c % N, h = H[c];
    for (const [sx, sy] of DG)
      if (hN(x + sx, y) === h - T && hN(x, y + sy) === h - T && hN(x + sx, y + sy) <= h - T && hN(x - sx, y) === h && hN(x, y - sy) === h && hN(x - sx, y - sy) >= h) { H[c] = h - T; break; }
  }
  const chamferAt = new Uint8Array(N * N);
  tierMtn.chamfer = [];
  for (let i = 1; i < W - 1; i++) for (let j = 1; j < W - 1; j++) {
    const x = x0 + i, y = y0 + j, c = x * N + y;
    if (!inBounds(x, y) || !tierMtn.cells[c] || busy(c)) continue;
    const h = H[c];
    for (const [sx, sy] of DG)
      if (hN(x + sx, y) === h + T && hN(x, y + sy) === h + T && hN(x + sx, y + sy) >= h + T && hN(x - sx, y) <= h && hN(x, y - sy) <= h) {
        tierMtn.chamfer.push({ x, y, h, sx, sy }); chamferAt[c] = 1; keepOut[c] = 1; break;
      }
  }
  return { hN, busy, chamferAt };
}
function buildTiers(capM, floor) {
  const T = TIER.h, R = SNOWB.r, PAD = 60;
  const x0 = snowSite.x - R - PAD, y0 = snowSite.y - R - PAD, W = 2 * (R + PAD) + 1;
  const loc = (x, y) => (x - x0) * W + (y - y0);
  const inW = (x, y) => x >= x0 && y >= y0 && x < x0 + W && y < y0 + W && inBounds(x, y);
  const Hpre = new Int16Array(W * W);
  for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) if (inBounds(x0 + i, y0 + j)) Hpre[i * W + j] = H[(x0 + i) * N + y0 + j];
  const target = new Int16Array(W * W).fill(-1);
  const disc = (m, cx, cy, r) => { for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) if (inW(x, y) && Math.hypot(x - cx, y - cy) <= r) m[loc(x, y)] = 1; };
  // 2-pass chamfer distance (1, 1.414) from the mask
  const dist = new Float32Array(W * W);
  const distFrom = m => {
    for (let k = 0; k < W * W; k++) dist[k] = m[k] ? 0 : 1e9;
    for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) { const k = i * W + j; let d = dist[k];
      if (i) { d = Math.min(d, dist[k - W] + 1); if (j) d = Math.min(d, dist[k - W - 1] + 1.414); if (j < W - 1) d = Math.min(d, dist[k - W + 1] + 1.414); }
      if (j) d = Math.min(d, dist[k - 1] + 1); dist[k] = d; }
    for (let i = W - 1; i >= 0; i--) for (let j = W - 1; j >= 0; j--) { const k = i * W + j; let d = dist[k];
      if (i < W - 1) { d = Math.min(d, dist[k + W] + 1); if (j < W - 1) d = Math.min(d, dist[k + W + 1] + 1.414); if (j) d = Math.min(d, dist[k + W - 1] + 1.414); }
      if (j < W - 1) d = Math.min(d, dist[k + 1] + 1); dist[k] = d; }
  };
  const peaks = [];
  for (let t = 0; peaks.length < TIER.peaks && t < 600; t++) {
    const a = hash(t, 7, 4201) * Math.PI * 2, d = Math.sqrt(hash(t, 9, 4202)) * R * 0.6;
    const px = Math.round(snowSite.x + Math.cos(a) * d), py = Math.round(snowSite.y + Math.sin(a) * d);
    if ((capM.get(px * N + py) ?? 0) < T * 5) continue;
    if (peaks.some(p => Math.hypot(p.x - px, p.y - py) < R * 0.42)) continue;
    peaks.push({ x: px, y: py, L: TIER.levels - (peaks.length ? Math.floor(hash(t, 3, 4203) * 4) : 0), s: t });
  }
  for (const p of peaks) {
    const lev = new Uint8Array(W * W);
    let mask = new Uint8Array(W * W);
    disc(mask, p.x, p.y, 2 + hash(p.s, 1, 4204) * 2.5);
    for (let k = 0; k < W * W; k++) if (mask[k]) lev[k] = p.L;
    for (let l = p.L - 1; l >= 1; l--) {
      distFrom(mask);
      const grow = 1.5 + (hash(l, p.s, 4205) < 0.5 ? 1 : 0) + hash(l, p.s, 4206) * 0.6; // >= 1.5: every shelf a connected ring
      const edge = [];
      for (let i = 1; i < W - 1; i++) for (let j = 1; j < W - 1; j++) { const k = i * W + j; if (mask[k] && (!mask[k - 1] || !mask[k + 1] || !mask[k - W] || !mask[k + W])) edge.push(k); }
      const next = new Uint8Array(W * W);
      for (let k = 0; k < W * W; k++) if (dist[k] <= grow) next[k] = 1;
      for (let n = 0; n < TIER.lobes && edge.length; n++) {
        const k = edge[Math.floor(hash(l * 31 + n, p.s, 4207) * edge.length)], ex = x0 + Math.floor(k / W), ey = y0 + (k % W);
        const ox = ex - p.x, oy = ey - p.y, ol = Math.hypot(ox, oy) || 1, rr = 1.5 + hash(l * 31 + n, p.s, 4208) * 4.5;
        disc(next, ex + (ox / ol) * rr * 0.5, ey + (oy / ol) * rr * 0.5, rr); // a circle bulging out of the tier edge
      }
      for (let k = 0; k < W * W; k++) if (next[k] && !lev[k]) lev[k] = l;
      mask = next;
    }
    // base = the ground under the first tier's ring, on the tier grid
    const ring = [];
    for (let k = 0; k < W * W; k++) if (lev[k] === 1) ring.push(Hpre[k]);
    ring.sort((a, b) => a - b);
    const B = T * Math.round((ring[ring.length >> 1] ?? 0) / T);
    p.B = B; p.lev = lev;
    for (let k = 0; k < W * W; k++) {
      if (!lev[k]) continue;
      const x = x0 + Math.floor(k / W), y = y0 + (k % W), c = x * N + y;
      if (!capM.has(c)) continue; // rivers, trenches, dungeon hills, the town: untouched
      const l = Math.min(lev[k], Math.floor((Hpre[k] + capM.get(c) - B) / T));
      if (l >= 1 && Math.min(NZ - 10, B + l * T) > target[k]) { target[k] = Math.min(NZ - 10, B + l * T); tierMtn.B[c] = B; }
    }
  }
  for (let k = 0; k < W * W; k++) {
    if (target[k] < 0) continue;
    const x = x0 + Math.floor(k / W), y = y0 + (k % W), c = x * N + y;
    if (target[k] !== H[c]) { floor.set(c, H[c]); H[c] = target[k]; } // flat shelves: bumps under a tier are cut down too
  }
  for (const c of floor.keys()) { const x = (c / N) | 0, y = c % N; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (inBounds(x + a, y + b)) tierMtn.cells[(x + a) * N + y + b] = 1; }
  tierMtn.win = { x0, y0, W };
  const { hN, busy, chamferAt } = tierCorners();
  // the trail: per mountain, a stair onto every tier
  const ORTH = [[1, 0], [0, 1], [-1, 0], [0, -1]], DIR8 = [...ORTH, [1, 1], [-1, 1], [-1, -1], [1, -1]];
  let flights = 0;
  for (const p of peaks) {
    let from = -1;
    for (let k = 0; k < p.L; k++) {
      const hi = from >= 0 ? H[from] + T : -1; // the first flight: onto whichever of this mountain's tiers the foot meets
      // the shelf you stand on (from the last exit), 4-connected cells at that height
      let reach = null;
      if (from >= 0) {
        reach = new Map([[from, -1]]); const q = [from], h0 = H[from];
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = (c / N) | 0, y = c % N;
          for (const [a, b] of DIR8) { const n = (x + a) * N + y + b; if (inW(x + a, y + b) && !reach.has(n) && H[n] === h0 && !busy(n)) { reach.set(n, c); q.push(n); } } }
      }
      const fa = from >= 0 ? Math.atan2(from % N - p.y, ((from / N) | 0) - p.x) : 0;
      let best = null; const why = { lev: 0, flat: 0, rise: 0, side: 0, open: 0, reach: 0 };
      for (let i = 1; i < W - 1; i++) for (let j = 1; j < W - 1; j++) {
        const x = x0 + i, y = y0 + j;
        if (!inBounds(x, y) || (from >= 0 && !reach.has(x * N + y))) continue;
        for (const [dx, dy] of ORTH) for (const [ax, ay] of [[-dy, dx], [dy, -dx]]) {
          const run = [-1, 0, 1, 2].map(t => [x + dx * t, y + dy * t]);
          if (!run.every(([u, v]) => inBounds(u, v))) continue;
          const cs = run.map(([u, v]) => u * N + v), h0 = H[cs[0]];
          if (cs.some(c => H[c] !== h0 || chamferAt[c] || busy(c) || tierMtn.trail[c])) { why.flat++; continue; }
          const up = H[(run[1][0] + ax) * N + run[1][1] + ay], r = up - h0;
          if (from >= 0 ? up !== hi : r < 2 || r > T || (up - p.B) % T) { why.rise++; continue; }
          const side = run.slice(1).map(([u, v]) => (u + ax) * N + v + ay);
          if (side.some(c => H[c] !== up || chamferAt[c] || busy(c) || !p.lev[loc((c / N) | 0, c % N)])) { why.side++; continue; }
          if (run.slice(1).some(([u, v]) => hN(u - ax, v - ay) > h0)) { why.open++; continue; } // open on the outer side
          if (reach && !reach.has(cs[0])) { why.reach++; continue; }
          const ang = Math.atan2(y - p.y, x - p.x);
          const score = (from >= 0 ? Math.abs(Math.atan2(Math.sin(ang - fa), Math.cos(ang - fa))) : 0) + hash(x * 7 + dx, y * 7 + dy, 4209 + k) * 0.7;
          if (!best || score > best.score) best = { score, cs, side, dx, dy, ax, ay, h0, r };
        }
      }
      if (!best) { console.error(`snow tiers: mountain ${p.x},${p.y} trail stops at tier ${k} of ${p.L} ${JSON.stringify(why)} reach ${reach?.size} from h ${from >= 0 ? H[from] : '-'} B ${p.B}`); break; }
      if (reach) for (let c = best.cs[0]; c >= 0; c = reach.get(c)) tierMtn.trail[c] = 1;
      for (const c of best.cs) { tierMtn.trail[c] = 1; keepOut[c] = 1; }
      for (const c of best.side) keepOut[c] = 1;
      for (const c of [...best.cs, ...best.side]) tierMtn.stairAt[c] = 1;
      tierMtn.stairs.push(best); flights++;
      from = best.side[2]; tierMtn.trail[from] = 1;
      if (H[from] >= p.B + p.L * T) break; // the summit
    }
  }
  tierMtn.peaks = peaks.map(p => ({ x: p.x, y: p.y, L: p.L, B: p.B }));
  if (process.env.TIER_DUMP) { const p = peaks[0], o = []; for (let x = p.x - 40; x <= p.x + 40; x++) { let r = ''; for (let y = p.y - 40; y <= p.y + 40; y++) { const c = x * N + y, d = H[c] - p.B; r += tierMtn.trail[c] ? '*' : chamferAt[c] ? '/' : !capM.has(c) ? '#' : d % T ? '?' : d < 0 ? '-' : '0123456789ABCDEF'[d / T] ?? '+'; } o.push(r); } fs.writeFileSync(process.env.TIER_DUMP, o.join(String.fromCharCode(10))); }
  console.error(`snow tiers: ${peaks.length} mountains (${peaks.map(p => p.L).join(' ')} tiers), ${tierMtn.chamfer.length} corner wedges, ${flights} stair flights`);
}
{
  const R = SNOWB.r + SNOWB.blend;
  let top = 0;
  const floor = new Map(); // raised cell -> its ground before the raise
  const capM = new Map(); // tiers: cell -> most it may rise
  for (let x = snowSite.x - R - 20; x <= snowSite.x + R + 20; x++)
    for (let y = snowSite.y - R - 20; y <= snowSite.y + R + 20; y++) {
      if (!inBounds(x, y)) continue;
      const c = x * N + y;
      let w = snowW(x, y);
      if (w <= 0 || riverCell[c] || trenchCell[c] || volcanoCell[c] || H[c] <= SEA) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      w *= Math.min(1, ...DUNGEONS.map(d => smooth(2, RAISE_BLEND, footDist(d, x, y))));
      w *= smooth(TOWN.blend, TOWN.blend + 24, townDist(x, y));
      if (riverBankL[c] > -999) w *= 0.3;
      const calm = nordicCalm(x, y); // the hamlet's hollow: a little lift for the snow, no peaks
      const ridge = Math.pow(ridged2(wx / SNOWB.scale + 31, wy / SNOWB.scale - 17, 5), 1.35) * calm;
      if (SNOW_STYLE === 'tiers') { capM.set(c, (SNOWB.lift + SNOWB.amp) * w * smooth(0, 0.6, w) * calm); continue; }
      const up = (SNOWB.lift + ridge * SNOWB.amp) * w * smooth(0, 0.6, w);
      const h0 = H[c];
      H[c] = Math.min(NZ - 10, Math.round(H[c] + up));
      if (H[c] > h0) floor.set(c, h0);
    }
  if (SNOW_STYLE === 'tiers') buildTiers(capM, floor);
  for (const c of floor.keys()) if (H[c] > top) top = H[c];
  console.error(`snow: cells ${snowSite.x},${snowSite.y}, r ${SNOWB.r}, highest peak ${top}`);
}

stage('deathForest');
// ----------------------------------------------------------- death forest --
// (owner 2026-10-14: "the fucking scary evil death forest at the end of the map after the snow biome", the
// volcano after it) The tail past the snow down to the volcano's foot: black rotten ground, dead black trees
// packed close (tree loop), graves, skulls on pikes, ghost lanterns, red eyes in the dark and the hardest
// enemies outside the Deep (plants section). deathW 0..1 by cell.
const deathW = new Float32Array(N * N);
const deathForest = { cells: 0, x: 0, y: 0 };
{
  for (let c = 0; c < N * N; c++) {
    if (tailU[c] < 0 || H[c] <= SEA) continue;
    const x = (c / N) | 0, y = c % N, wx = X0 + x * CELL, wy = Y0 + y * CELL;
    const vd = Math.hypot(x - volcano.x, y - volcano.y) * (1 + 0.15 * fbm2(wx / 1600 - 21, wy / 1600 + 44, 3));
    const w = smooth(0.06, 0.18, tailU[c] + fbm2(wx / 1200 + 5, wy / 1200 - 9, 2) * 0.05) * (1 - smooth(0.05, 0.35, snowW(x, y))) * smooth(VOLC.r * 1.0, VOLC.r * 1.35, vd);
    if (w <= 0) continue;
    deathW[c] = w;
    if (w > 0.5) { deathForest.cells++; deathForest.x += x; deathForest.y += y; }
  }
  if (deathForest.cells) { deathForest.x = Math.round(deathForest.x / deathForest.cells); deathForest.y = Math.round(deathForest.y / deathForest.cells); }
  console.error(`death forest: ${deathForest.cells} cells, centre ${deathForest.x},${deathForest.y}`);
}

// --------------------------------------------------------- river valley cap --
// (owner 2026-10-10, screenshot of the river mouth between sheer stone walls)
// the passes after the river (dunes and buttes, the volcano, the snow peaks,
// which still raise the banks at 30%), the jumps at the rapids and the sea
// floor at the mouth left 7-86 brick walls on the water, too tall for the wedge
// smoothing. Run last before smoothing: in the river's corridor (riverBankL
// set) a cell may stand at most VCAP.s1 bricks (VCAP.s2 past VCAP.e1 cells off
// the channel, 6 near the corridor's edge) above any neighbour: a slope
// erosion that only cuts, so every step left there is wedgeable. Cells that
// must not move (town, hamlets, dungeons, trench, volcano, roads, bridge
// decks) keep their height and the ground round them is cut to meet them.
const VCAP = { s1: tune('river.capSlope', 1, 'valley cap: bricks per cell near the river'), e1: Math.round(tune('river.capNear', 8, 'valley cap: cells at the gentle slope (x K)') * K),
  s2: tune('river.capSlope2', 3, 'valley cap: bricks per cell further out (keep under smooth.maxRise)'), blur: tune('river.capBlur', 3, 'valley cap: rounding passes') };
function riverValleyCap() {
  if (VCAP.s1 >= 100) return;
  const R = RIVER.rw + RIVER.bank + RIVER.valley;
  const lim = new Float32Array(N * N).fill(Infinity), step = new Float32Array(N * N), fixed = new Uint8Array(N * N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (riverBankL[c] <= -999) continue;
      const e = riverD[c];
      step[c] = e > R - 12 ? 6 : e <= VCAP.e1 ? VCAP.s1 : VCAP.s2;
      lim[c] = H[c]; // every cell anchors its own height: steep only where something above it is
      if (townKind[c] || trenchCell[c] || volcanoCell[c] || pathCell[c] || noSmooth[c] || reserved[c] || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend
        || DUNGEONS.some(d => footDist(d, x, y) <= RAISE_BLEND)) { fixed[c] = 1; lim[c] = Math.min(lim[c], H[c]); }
    }
  // chamfer relaxation (orthogonal neighbours) until nothing changes
  for (let pass = 0, changed = true; changed && pass < 40; pass++) {
    changed = false;
    const relax = (x, y) => {
      const c = x * N + y;
      if (!step[c]) return;
      let best = lim[c];
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + a, yy = y + b;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const v = lim[xx * N + yy] + step[c];
        if (v < best) best = v;
      }
      if (best < lim[c]) { lim[c] = best; changed = true; }
    };
    if (pass & 1) { for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) relax(x, y); }
    else { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) relax(x, y); }
  }
  // a floor under the cut: never more than a slope step per cell below a cell
  // that keeps its height (roads, bridge decks, dungeons, town), or they end up
  // standing on walls; where the floor and the limit disagree the floor wins
  const low = new Float32Array(N * N).fill(-Infinity);
  for (let c = 0; c < N * N; c++) if (fixed[c]) low[c] = H[c];
  for (let pass = 0, changed = true; changed && pass < 40; pass++) {
    changed = false;
    const relax = (x, y) => {
      const c = x * N + y;
      if (!step[c] || fixed[c]) return;
      let best = low[c];
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + a, yy = y + b;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const v = low[xx * N + yy] - Math.max(step[c], 1);
        if (v > best) best = v;
      }
      if (best > low[c]) { low[c] = best; changed = true; }
    };
    if (pass & 1) { for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) relax(x, y); }
    else { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) relax(x, y); }
  }
  for (let c = 0; c < N * N; c++) if (low[c] > lim[c]) lim[c] = low[c];
  let cut = 0, cells = 0;
  const orig = H.slice(), touched = new Uint8Array(N * N);
  for (let c = 0; c < N * N; c++) {
    if (!step[c] || fixed[c] || riverCell[c] || lim[c] === Infinity) continue;
    const cap = Math.floor(lim[c]);
    if (H[c] > cap) { cut += H[c] - cap; cells++; H[c] = cap; touched[c] = 1; }
  }
  // (2026-10-10, owner screenshot "terrain misbehaving") the limit alone left
  // even diamond terraces (a step per cell on both axes) that the smoothing
  // fills with notch pieces: round the cut ground with a few 3x3 means, never
  // above the original ground, never on fixed cells or the channel
  for (let it = 0; it < VCAP.blur; it++) {
    const prev = H.slice();
    for (let x = 1; x < N - 1; x++)
      for (let y = 1; y < N - 1; y++) {
        const c = x * N + y;
        if (!step[c] || fixed[c] || riverCell[c]) continue;
        let near = touched[c];
        for (let a = -2; a <= 2 && !near; a++) for (let b = -2; b <= 2 && !near; b++) { const xx = x + a, yy = y + b; if (inBounds(xx, yy) && touched[xx * N + yy]) near = 1; }
        if (!near) continue;
        let sum = 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) sum += prev[(x + a) * N + y + b];
        H[c] = Math.min(orig[c], Math.floor(lim[c]), Math.round(sum / 9)); // never above the ground or the limit
      }
  }
  console.error(`river valley cap: ${cells} cells cut, ${cut} voxels`);
}
// MAPGEN_RIVERDIAG=1: list steps too tall to wedge within 15 cells of the river (live coords, after output SHIFT)
function riverDiag(tag) {
  if (!process.env.MAPGEN_RIVERDIAG) return;
  const hits = [];
  for (let x = 1; x < N - 1; x++)
    for (let y = 1; y < N - 1; y++) {
      const c = x * N + y;
      if (riverD[c] > (process.env.MAPGEN_RIVERDIAG_R ? +process.env.MAPGEN_RIVERDIAG_R : 15) || riverCell[c]) continue;
      let m = 0, hx = 0, hy = 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const d = H[(x + a) * N + y + b] - H[c]; if (d > m) { m = d; hx = x + a; hy = y + b; } }
      const n = hx * N + hy;
      const hiWhy = pathCell[n] ? 'path' : noSmooth[n] ? 'nosmooth' : villageDist(hx, hy) <= VILLAGE.r + VILLAGE.blend ? 'village' : DUNGEONS.some(d => footDist(d, hx, hy) <= RAISE_BLEND) ? 'dungeon' : riverBankL[n] <= -999 ? 'outside' : 'free';
      if (m > 6) hits.push([x, y, m, riverD[c], riverBankL[c] > -999, !!townKind[c], !!volcanoCell[c], !!trenchCell[c], hiWhy, H[c] <= SEA]);
    }
  const why = {}; for (const h of hits) { const k = `bank=${h[4]} town=${h[5]} volc=${h[6]} trench=${h[7]} higher=${h[8]} undersea=${h[9]}`; why[k] = (why[k] ?? 0) + 1; }
  console.error(`river diag ${tag}: ${hits.length} cells with a >6 brick step within 15 cells`, JSON.stringify(why));
  globalThis.__riverHits = hits;
}

stage('shrub');
// -------------------------------------------------------------- shrubland --
// (owner 2026-10-10: "add ... shrubland biome") olive scrub ground thick with
// bushes (a quarter of them smashable, see bushes.json), ferns and dead branches,
// hardly a tree; the ground is left as it is. Away from the town, the desert,
// the snow, the volcano and the swamp, mostly on land.
const SHRUB = { r: Math.round(tune('shrub.r', 38, 'radius, cells (x K)') * K), blend: Math.round(tune('shrub.blend', 18, 'blend, cells (x K)') * K) };
const shrubSite = (() => {
  if (!tune('shrub.on', 1, 'shrubland biome (0 = none)')) return null;
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2, R = SHRUB.r;
  let best = null;
  for (let cx = 30; cx < N - 30; cx += 6)
    for (let cy = 30; cy < N - 30; cy += 6) {
      if (Math.hypot(cx - tx, cy - ty) < TOWN.cells / 2 + TOWN.blend + R + 10 * K) continue;
      if (swampRho(cx, cy) < SWAMP.r + SWAMP.blend + R) continue;
      if (Math.hypot(cx - desert.x, cy - desert.y) < DESERT.r + DESERT.blend + R) continue;
      if (Math.hypot(cx - formerVolcano.x, cy - formerVolcano.y) < VOLC.r * 1.3 + R + 10 || tailOff(cx * N + cy)) continue;
      if (Math.hypot(cx - snowSite.x, cy - snowSite.y) < SNOWB.r + SNOWB.blend + R) continue;
      const land = landShare(cx, cy, R);
      if (land < 0.6) continue;
      const score = (1 - land) * 2 + Math.abs(progress(cx, cy) - 0.35) + hash(cx, cy, 431) * 0.1;
      if (!best || score < best.score) best = { x: cx, y: cy, score };
    }
  if (best) console.error(`shrubland: cells ${best.x},${best.y}, r ${R}`); else console.error('shrubland: no site');
  return best;
})();
const shrubW = (x, y) => {
  if (!shrubSite) return 0;
  const wx = X0 + x * CELL, wy = Y0 + y * CELL;
  const rho = Math.hypot(x - shrubSite.x, y - shrubSite.y) * (1 + 0.25 * fbm2(wx / 2000 + 71, wy / 2000 - 23, 3));
  return 1 - smooth(SHRUB.r - SHRUB.blend / 2, SHRUB.r + SHRUB.blend / 2, rho);
};

stage('villages');
// --------------------------------------------------------------- villages --
// Hamlets round the island (town.mjs lays them out: well, checkpoint, houses
// round a square), joined to the town and to each other by dirt roads. Four of
// the six keep a sword shop (the shop_<tier> prefabs): cheap blades near town,
// the best farthest out, and the hamlets between have none.
const VILLAGE = { r: 22, blend: 12, count: Math.round(tune('village.count', 6, 'hamlets (x K)') * K), core: 5 }; // r: town.mjs VILLAGE_R / 40
const villages = [];
{
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2;
  const R = VILLAGE.r + VILLAGE.blend, cand = [], vwhy = { town: 0, dungeon: 0, swamp: 0, wet: 0, high: 0 };
  for (let cx = 30; cx < N - 30; cx += 4)
    for (let cy = 30; cy < N - 30; cy += 4) {
      if (townDist(cx, cy) < R + TOWN.blend + 10) { vwhy.town++; continue; }
      if (DUNGEONS.some(d => footDist(d, cx, cy) < R + 6)) { vwhy.dungeon++; continue; }
      if (swampRho(cx, cy) < SWAMP.r + SWAMP.blend + R + 4) { vwhy.swamp++; continue; } // the marsh's own (oval, ragged) shape
      if (riverNear(cx, cy, R + 4)) { vwhy.wet++; continue; }
      if (Math.hypot(cx - formerVolcano.x, cy - formerVolcano.y) < VOLC.r * 1.3 + R + 4 || tailU[cx * N + cy] >= 0) { vwhy.dungeon++; continue; } // where the volcano stood; the tail (death forest, volcano)
      let lo = Infinity, hi = -Infinity, sum = 0, n = 0;
      for (let x = cx - VILLAGE.r; x <= cx + VILLAGE.r; x += 2)
        for (let y = cy - VILLAGE.r; y <= cy + VILLAGE.r; y += 2) {
          const h = H[x * N + y];
          lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++;
        }
      if (lo <= SEA + 3) { vwhy.wet++; continue; }
      if (hi > 130) { vwhy.high++; continue; } // dry, and below the bare rock (130: the island is taller since 2026-10-03)
      cand.push({ x: cx, y: cy, h: Math.round(sum / n), score: hi - lo + hash(cx, cy, 71) * 4 });
    }
  cand.sort((a, b) => a.score - b.score);
  console.error(`villages: ${cand.length} candidate sites ${JSON.stringify(vwhy)}`);
  for (const c of cand) {
    if (villages.length >= VILLAGE.count) break;
    if (villages.some(v => Math.hypot(v.x - c.x, v.y - c.y) < tune('village.spacing', 90, 'min cells apart (x K)') * K)) continue;
    villages.push(c);
  }
  villages.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
  // shops by distance (2026-10-06, owner: low tiers at spawn, more as you go deeper): the
  // nearest hamlet sells steel; each further one its own tier plus the one below, so the
  // choice grows; every tier sells a dagger, sword, longsword and its bow
  const HT = ['steel', 'black', 'mithril', 'adamant', 'rune'];
  const BOW = { steel: 'willow', black: 'willow', mithril: 'maple', adamant: 'yew', rune: 'magic' };
  const waresOf = tiers => {
    const out = [], seen = new Set();
    for (const t of tiers) for (const w of [{ tier: t, prefab: `shop_${t}_dagger` }, { tier: t, prefab: `shop_${t}` }, { tier: t, prefab: `shop_${t}_longsword` }, { tier: BOW[t], prefab: `bow_${BOW[t]}` }])
      if (!seen.has(w.prefab)) { seen.add(w.prefab); out.push(w); }
    return out;
  };
  villages.forEach((v, k) => {
    v.seed = 9000 + k;
    const ti = Math.min(HT.length - 1, Math.floor((k * HT.length) / villages.length));
    v.shops = waresOf(ti > 0 ? [HT[ti - 1], HT[ti]] : [HT[0]]);
  });
  // (owner 2026-10-10: "viking village in the snow") one more hamlet, in the
  // snow biome: longhouses round a mead hall (town.mjs village.nordic), no
  // shops; the flattest snowy spot clear of the others, the river and the dungeons
  if (tune('nordic.on', 1, 'viking hamlet with its own snow (0 = none)')) {
    // a regular hamlet site (flat, clear of the dungeons, the river, the swamp)
    // away from the others and the desert, as near the snow biome as it gets
    let best = null;
    for (const c of cand) {
      if (villages.some(v => Math.hypot(v.x - c.x, v.y - c.y) < tune('nordic.spacing', 40, 'viking hamlet: min cells from the other hamlets (x K)') * K)) continue;
      if (desertW(c.x, c.y) > 0.05 || snowW(c.x, c.y) > 0.05) continue;
      const score = c.score + Math.hypot(c.x - snowSite.x, c.y - snowSite.y) * 0.25;
      if (!best || score < best.score) best = { ...c, score };
    }
    if (best) { villages.push({ x: best.x, y: best.y, h: best.h, seed: 9000 + villages.length, shops: [], nordic: true }); console.error(`nordic hamlet: cells ${best.x},${best.y}, ground ${best.h}, ${Math.round(Math.hypot(best.x - snowSite.x, best.y - snowSite.y))} cells from the snow`); }
    else console.error(`nordic hamlet: no site (${cand.length} hamlet sites; near another ${cand.filter(c => villages.some(v => Math.hypot(v.x - c.x, v.y - c.y) < 40 * K)).length}, desert ${cand.filter(c => desertW(c.x, c.y) > 0.05).length}, snow ${cand.filter(c => snowW(c.x, c.y) > 0.05).length})`);
  }
}
// Hamlets are levelled only where they are used (2026-10-06, owner: no more
// circles): the lanes, the green and every plot the build takes (houses,
// fields, the well), found by building each hamlet once here (the layout does
// not depend on the ground; desert and green variants both, since the desert
// is found later). v.used: distance in cells from that footprint over a
// window round the hamlet. villageDist is shifted so VILLAGE.r is the
// footprint's edge: every "villageDist <= VILLAGE.r + m" test is against it.
const VW = VILLAGE.r + VILLAGE.blend + 4; // window half-size, cells
// the viking hamlet's snowfall: full snow out to NORDIC_SNOW cells round it, thinning over the next 25
const NORDIC_SNOW = Math.round(tune('nordic.snow', 40, 'snow radius round the viking hamlet, cells (x K)') * K);
const nordicSnowW = (() => {
  const v = villages.find(q => q.nordic);
  if (!v) return () => 0;
  return (x, y) => { const wx = X0 + x * CELL, wy = Y0 + y * CELL; return 1 - smooth(NORDIC_SNOW, NORDIC_SNOW + 25, Math.hypot(x - v.x, y - v.y) * (1 + 0.2 * fbm2(wx / 900 + 91, wy / 900 - 37, 2))); };
})();
const villageEdge = (v, dx, dy) => (v.plan ? v.plan.edgeR(dx * CELL, dy * CELL) / CELL + 1 : VILLAGE.r);
const villageDist = (x, y) => {
  let m = Infinity;
  for (const v of villages) {
    const dx = x - v.x, dy = y - v.y;
    let d;
    // inside the footprint reads a little under VILLAGE.r (roads stop on entering it)
    if (v.used && Math.abs(dx) <= VW && Math.abs(dy) <= VW) { const u = v.used[(dx + VW) * (2 * VW + 1) + dy + VW]; d = u ? u + VILLAGE.r : VILLAGE.r - 2; }
    else d = Math.hypot(dx, dy); // outside the window: never nearer than this
    if (d < m) m = d;
  }
  return m;
};
// each hamlet's plan (town.mjs planVillage): cobbled green and herringbone paths
const villagePaved = new Uint8Array(N * N);
for (const v of villages) {
  v.plan = planVillage(v.seed, townRnd);
  for (let x = v.x - VILLAGE.r; x <= v.x + VILLAGE.r; x++)
    for (let y = v.y - VILLAGE.r; y <= v.y + VILLAGE.r; y++) {
      if (!inBounds(x, y)) continue;
      const k = v.plan.surfaceAt((x - v.x + 0.5) * CELL, (y - v.y + 0.5) * CELL);
      if (k === 'street' || k === 'square') villagePaved[x * N + y] = 1;
    }
  // the footprint: lanes and green (paved cells), and the plots of a trial build
  const S = 2 * VW + 1, foot = new Uint8Array(S * S);
  const mark = (x0, y0, x1, y1) => { // town units, local; one cell of margin
    for (let i = Math.floor(x0 / CELL) - 1; i <= Math.ceil(x1 / CELL); i++)
      for (let j = Math.floor(y0 / CELL) - 1; j <= Math.ceil(y1 / CELL); j++)
        if (Math.abs(i) <= VW && Math.abs(j) <= VW) foot[(i + VW) * S + j + VW] = 1;
  };
  for (let i = -VW; i <= VW; i++)
    for (let j = -VW; j <= VW; j++) {
      const k = v.plan.surfaceAt((i + 0.5) * CELL, (j + 0.5) * CELL);
      if (k === 'street' || k === 'square') for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (Math.abs(i + a) <= VW && Math.abs(j + b) <= VW) foot[(i + a + VW) * S + j + b + VW] = 1;
    }
  const isDesert = desertW(v.x, v.y) > 0.5; // (set for good further down) the real variant runs last: its terrace claims level the ground
  for (const desert of [!isDesert, isDesert]) {
    // only st.taken is used: bricks go nowhere (build() ignores put's result)
    const st = buildTown({
      put: () => {}, orientFor, rnd: townRnd,
      village: { seed: v.seed, shops: v.shops?.length ?? 0, desert, nordic: !!v.nordic }, plan: v.plan,
      riverAt: (ux, uy) => { const x = v.x + Math.floor(ux / CELL), y = v.y + Math.floor(uy / CELL); return inBounds(x, y) && riverCell[x * N + y] === 1; },
    });
    for (const [x0, y0, x1, y1] of st.taken) mark(x0, y0, x1, y1);
  }
  // chamfer distance (cells) from the footprint, carrying the nearest footprint cell's terrace height
  const D = new Float32Array(S * S).fill(1e9), SRC = new Float32Array(S * S);
  // terrace level (voxels) of a hamlet cell; cells past the outline take the level just inside it
  const vLevel = (i, j) => {
    let ux = (i + 0.5) * CELL, uy = (j + 0.5) * CELL;
    const r = Math.hypot(ux, uy), e = v.plan.edgeR(ux, uy) - 20;
    if (r > e) { ux *= e / r; uy *= e / r; }
    return v.plan.levelAt(ux, uy) / VZ;
  };
  for (let i = 0; i < S * S; i++) if (foot[i]) { D[i] = 0; SRC[i] = v.h + vLevel(Math.floor(i / S) - VW, (i % S) - VW); }
  const pass = (i0, i1, st) => {
    for (let i = i0; i !== i1; i += st)
      for (let j = i0; j !== i1; j += st) {
        let d = D[i * S + j], src = SRC[i * S + j];
        for (const [a, b, w] of [[-st, 0, 1], [0, -st, 1], [-st, -st, 1.414], [-st, st, 1.414]]) {
          const ii = i + a, jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < S && jj < S && D[ii * S + jj] + w < d) { d = D[ii * S + jj] + w; src = SRC[ii * S + jj]; }
        }
        D[i * S + j] = d; SRC[i * S + j] = src;
      }
  };
  pass(0, S, 1); pass(S - 1, -1, -1);
  v.used = D;
  // level the footprint on its terraces, blending out over VILLAGE.blend
  const B = VILLAGE.blend;
  for (let i = -VW; i <= VW; i++)
    for (let j = -VW; j <= VW; j++) {
      const x = v.x + i, y = v.y + j;
      if (!inBounds(x, y)) continue;
      const d = D[(i + VW) * S + j + VW], src = SRC[(i + VW) * S + j + VW];
      if (d <= 0) { H[x * N + y] = src; terraceCell[x * N + y] = 1; noSmooth[x * N + y] = 1; } // (no smoothing pieces on the terraces: their parapets stand there)
      else if (d < B) H[x * N + y] = Math.round(lerp(src, H[x * N + y], smooth(0, B, d)));
    }
}

stage('henge');
// ------------------------------------------------------------------ henge --
// The Evil Wizard's stonehenge (from stonehenge.mjs, 2026-10-03; owner: wizards
// only, no goblins): the flattest HENGE.n-cell square patch near the anchor,
// levelled to its mean and blended out over HENGE.blend cells; grass with a
// trampled earth disc, trilithons on the axes, stones on the diagonals, an
// inner ring and a glowing rune altar (bricks further down), and three
// enemy_wizard spawner prefabs (spawners.json).
const HENGE = { at: (([cx, cy]) => [X0 + cx * CELL, Y0 + cy * CELL])(spineAt(tune('henge.t', 0.05, 'progress up the island'), tune('henge.off', -45, 'cells right of the spine (x K)') * K)), n: 17, search: Math.round(tune('henge.search', 40, 'site search radius, cells (x K)') * K), blend: 5 }; // the wizards: close to spawn (owner 2026-10-06), on the side away from the river
const henge = (() => {
  const n = HENGE.n, ax = Math.round((HENGE.at[0] - X0) / CELL) - (n >> 1), ay = Math.round((HENGE.at[1] - Y0) / CELL) - (n >> 1);
  let best = null;
  // widen the search if the anchor's neighbourhood is full (small islands, 2026-10-06)
  for (let wide = 1; wide <= 3 && !best; wide++)
  for (let x0 = ax - HENGE.search * wide; x0 <= ax + HENGE.search * wide; x0++)
    for (let y0 = ay - HENGE.search * wide; y0 <= ay + HENGE.search * wide; y0++) {
      if (x0 < 4 || y0 < 4 || x0 + n > N - 4 || y0 + n > N - 4) continue;
      let sum = 0, ok = true;
      for (let i = 0; i < n && ok; i++) for (let j = 0; j < n; j++) {
        const x = x0 + i, y = y0 + j, h = H[x * N + y];
        if (h <= SEA + 2 || swampCell[x * N + y] || keepOut[x * N + y] || townDist(x, y) <= TOWN.blend + 4 || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend + 4 ||
            DUNGEONS.some(d => footDist(d, x, y) <= PLAZA_RING + BLEND + 4)) { ok = false; break; }
        sum += h;
      }
      if (!ok) continue;
      const mean = sum / (n * n);
      let dev = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) dev += Math.abs(H[(x0 + i) * N + y0 + j] - mean);
      const score = dev + Math.hypot(x0 - ax, y0 - ay) * 2;
      if (!best || score < best.score) best = { x0, y0, n, h: Math.round(mean), score };
    }
  if (!best) throw new Error('henge: no site');
  return best;
})();
stage('outposts');
// --------------------------------------------------------------- outposts --
// two skeleton spawners every so often up the island, tier 1 near the town to
// 7 at the far end (dungeon_spawner_<tier> prefabs, spawners.json), on flat
// open ground; reserved cells keep trees, boulders, plants and caves off them
const reserved = new Uint8Array(N * N);
const outposts = [];
const hengeDistPre = (x, y) => Math.max(henge.x0 - x, x - (henge.x0 + henge.n - 1), henge.y0 - y, y - (henge.y0 + henge.n - 1));
const OUTPOSTS = Math.round(tune('outposts.count', 10, 'outposts (x K), 2 spawners each') * K);
// (2026-10-23, owner screenshots: a desert road climbing to a tunnel with 5-14 brick sheer drops in it)
// the roads come after the outposts and used to keep an outpost's 7x7 lot at its ground level
// as they crossed it; now roads grade straight through (outpostCell is not pinned) and the
// 'roads' stage re-places every outpost a road touched, clear of the road net (offRoad)
const outpostCell = new Uint8Array(N * N);
const outpostAnchor = k => {
  const t = 0.25 + k * (0.75 / OUTPOSTS), tier = Math.min(7, 1 + Math.floor(((t - 0.25) / 0.7) * 7)); // tier 1 just past the town, 7 at the far end
  return { t, tier, at: spineAt(t, (k % 2 ? 1 : -1) * (25 + (k % 3) * 12) * K) };
};
const findOutpost = (k, offRoad) => {
  const { at: [ax, ay] } = outpostAnchor(k);
  let best = null;
  for (let x = Math.round(ax) - 24; x <= Math.round(ax) + 24; x++)
    for (let y = Math.round(ay) - 24; y <= Math.round(ay) + 24; y++) {
      if (!inBounds(x - 3, y - 3) || !inBounds(x + 3, y + 3)) continue;
      const h = H[x * N + y];
      if (h <= SEA + 2 || swampCell[x * N + y] || keepOut[x * N + y] || siteOff(x * N + y) || townDist(x, y) <= TOWN.blend + 2 || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend ||
          DUNGEONS.some(d => footDist(d, x, y) <= PLAZA_RING + BLEND) || hengeDistPre(x, y) <= HENGE.blend + 3) continue;
      if (offRoad && !offRoad(x, y)) continue;
      // no neighbour higher (so no smoothing piece lands in this cell) and gentle round it
      let flat = true;
      for (let dx = -1; dx <= 1 && flat; dx++) for (let dy = -1; dy <= 1; dy++) { const g = H[(x + dx) * N + y + dy]; if (g > h || h - g > 2) { flat = false; break; } }
      if (!flat) continue;
      const d = Math.hypot(x - ax, y - ay);
      if (!best || d < best.d) best = { x, y, h, d };
    }
  return best;
};
const claimOutpost = (o, v) => { for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const c = (o.x + dx) * N + o.y + dy; reserved[c] = v; outpostCell[c] = v; } };
for (let k = 0; k < OUTPOSTS; k++) {
  const { t, tier, at: [ax, ay] } = outpostAnchor(k), best = findOutpost(k);
  if (!best) { console.error(`outpost ${k} (t ${t.toFixed(2)}) found no flat open ground near ${Math.round(ax)},${Math.round(ay)}`); continue; }
  outposts.push({ ...best, tier, t, k });
  claimOutpost(best, 1);
}
console.error(`outposts: ${outposts.map(o => 'T' + o.tier).join(' ')}`);
// spawn ring (owner 2026-10-08: "make more enemies around spawn"): skeleton
// spawners (tier 1, every third tier 2) spread round the town just past its
// blend, each on flat open ground nearest its compass point
const spawnRing = [];
{
  const RING = tune('spawnring.count', 12, 'spawners round the spawn town');
  const near = TOWN.blend + tune('spawnring.near', 4, 'cells past the town blend, inner edge'), far = TOWN.blend + tune('spawnring.far', 22, 'cells past the town blend, outer edge');
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2, r = TOWN.cells / 2 + (near + far) / 2;
  for (let k = 0; k < RING; k++) {
    const a = (k / RING) * Math.PI * 2, ax = tx + Math.cos(a) * r, ay = ty + Math.sin(a) * r;
    let best = null;
    for (let x = Math.round(ax) - 16; x <= Math.round(ax) + 16; x++)
      for (let y = Math.round(ay) - 16; y <= Math.round(ay) + 16; y++) {
        if (!inBounds(x - 2, y - 2) || !inBounds(x + 2, y + 2)) continue;
        const h = H[x * N + y], td = townDist(x, y);
        if (td < near || td > far || h <= SEA + 2 || swampCell[x * N + y] || keepOut[x * N + y] || reserved[x * N + y] || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend ||
            DUNGEONS.some(d => footDist(d, x, y) <= PLAZA_RING + BLEND) || hengeDistPre(x, y) <= HENGE.blend + 3) continue;
        let flat = true;
        for (let dx = -1; dx <= 1 && flat; dx++) for (let dy = -1; dy <= 1; dy++) { const g = H[(x + dx) * N + y + dy]; if (g > h || h - g > 2) { flat = false; break; } }
        if (!flat) continue;
        const d = Math.hypot(x - ax, y - ay);
        if (!best || d < best.d) best = { x, y, h, d };
      }
    if (!best) { console.error(`spawn ring ${k} found no flat open ground near ${Math.round(ax)},${Math.round(ay)}`); continue; }
    spawnRing.push({ ...best, tier: k % 3 === 2 ? 2 : 1 });
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) reserved[(best.x + dx) * N + best.y + dy] = 1;
  }
  console.error(`spawn ring: ${spawnRing.length} of ${RING} spots`);
}
const hengeDist = (x, y) => Math.max(henge.x0 - x, x - (henge.x0 + henge.n - 1), henge.y0 - y, y - (henge.y0 + henge.n - 1));
for (let x = henge.x0 - HENGE.blend; x < henge.x0 + henge.n + HENGE.blend; x++)
  for (let y = henge.y0 - HENGE.blend; y < henge.y0 + henge.n + HENGE.blend; y++) {
    if (!inBounds(x, y)) continue;
    const fd = hengeDist(x, y);
    if (fd <= 0) H[x * N + y] = henge.h;
    else if (fd < HENGE.blend) H[x * N + y] = Math.round(lerp(henge.h, H[x * N + y], smooth(0, HENGE.blend, fd)));
  }
console.error(`henge: site cells ${henge.x0},${henge.y0}, ground ${henge.h}`);

stage('roads');
const lotH = o => { const v = []; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) v.push(H[(o.x + dx) * N + o.y + dy]); return v.join(); };
const outpostLots = outposts.map(lotH); // (see outpostCell) the ground under each lot before the roads
const pathCell = new Uint8Array(N * N);
// Roads through the mountains (owner 2026-10-05: "make paths continue through
// the mountains either by pathing around and up and over or tunneling
// through"). A road is routed by A* over the heightmap (steep steps cost the
// square of their height, capped, so roads wind round and switch back up
// slopes, and only go straight at a mountain when going round costs more),
// then graded: a profile that climbs at most a brick per cell (the smoothing
// pass turns those steps into ramps), with the ground cut or filled to it and
// the shoulders blended. Where the graded road would sit TUNNEL.at bricks or
// more under the ground it bores a tunnel instead: 3 cells wide, TUNNEL.high
// bricks high, a path floor, ramp wedges on its steps and ceiling lights.
const TUNNEL = { at: 9, high: 7 };
const roadGraded = new Uint8Array(N * N), tunnelZ = new Int16Array(N * N).fill(-1), bridgeZ = new Int16Array(N * N).fill(-1);
for (const c of volcano.road) { pathCell[c] = 1; roadGraded[c] = 1; } // the volcano's spiral road
const townGates = []; // [{ dir, edge, out }] for the signs
const TOWN_NAME = 'Lumbrick'; // the spawn town (signs at its gates)
const tunnelLights = [];
const roadPaths = []; // every graded road: { P: [[x, y]...], z: [level...] } (cut arches)
{
  const tx = town.fx + TOWN.cells / 2, ty = town.fy + TOWN.cells / 2;
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  const gScore = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), touched = [];
  // per-call wall cache: wallStamp[n] === call -> wallVal[n] (stop is fixed during one search)
  const wallStamp = new Int32Array(N * N), wallVal = new Uint8Array(N * N);
  let call = 0;
  /** A* from (sx, sy) to (ex, ey); stop(x, y) cells are walls except the goal */
  const route = (sx, sy, ex, ey, stop) => {
    for (const c of touched) { gScore[c] = Infinity; from[c] = -1; }
    touched.length = 0;
    const start = sx * N + sy, goal = ex * N + ey;
    // binary min-heap on parallel arrays (f, cell); same order as the old [f, cell] tuples
    const hf = [], hc = [];
    const push = (f, c) => { let i = hf.length; hf.push(f); hc.push(c); while (i) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; const tf = hf[p]; hf[p] = hf[i]; hf[i] = tf; const tc = hc[p]; hc[p] = hc[i]; hc[i] = tc; i = p; } };
    let popF = 0, popC = 0;
    const pop = () => { popF = hf[0]; popC = hc[0]; const lf = hf.pop(), lc = hc.pop(); const n = hf.length; if (n) { hf[0] = lf; hc[0] = lc; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < n && hf[l] < hf[m]) m = l; if (r < n && hf[r] < hf[m]) m = r; if (m === i) break; const tf = hf[m]; hf[m] = hf[i]; hf[i] = tf; const tc = hc[m]; hc[m] = hc[i]; hc[i] = tc; i = m; } } };
    call++;
    const wall = (nx, ny, n) => { if (wallStamp[n] !== call) { wallStamp[n] = call; wallVal[n] = stop(nx, ny) || townDist(nx, ny) <= 0 || volcanoCell[n] ? 1 : 0; } return wallVal[n] === 1; };
    const W = 1.5; // weighted heuristic: a little less than optimal, far fewer cells searched
    gScore[start] = 0; touched.push(start); push(W * Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2), start);
    let expanded = 0;
    while (hf.length) {
      pop(); const f = popF, c = popC;
      if (c === goal) break;
      if (f - W * Math.sqrt((ex - ((c / N) | 0)) ** 2 + (ey - c % N) ** 2) > gScore[c] + 1e-3) continue; // stale entry
      if (++expanded > 3e7) { console.error('route: search budget spent'); return null; }
      const cx = (c / N) | 0, cy = c % N, gc = gScore[c], hc = H[c];
      for (let q = 0; q < 8; q++) {
        const dx = NB[q][0], dy = NB[q][1], base = NB[q][2];
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const n = nx * N + ny;
        if (n !== goal && wall(nx, ny, n)) continue;
        const dh = Math.abs(H[n] - hc);
        let cost = base * (1 + Math.min(4 * dh * dh, 40));
        if (H[n] <= SEA) cost += 25 * base;          // open water: a long bridge, avoid
        if (riverCell[n]) cost += 8 * base;           // cross the river, don't follow it
        if (swampCell[n]) cost += 10 * base;
        const g = gc + cost;
        if (g < gScore[n]) { if (gScore[n] === Infinity) touched.push(n); gScore[n] = g; from[n] = c; push(g + W * Math.sqrt((ex - nx) ** 2 + (ey - ny) ** 2), n); }
      }
    }
    if (from[goal] < 0 && goal !== start) { console.error(`route: expanded ${expanded}, start stop=${stop(sx, sy)} town=${townDist(sx, sy)}, goal H ${H[goal]}`); return null; }
    const out = [];
    for (let c = goal; c >= 0; c = c === start ? -1 : from[c]) out.push([(c / N) | 0, c % N]);
    return out.reverse();
  };
  const pinned = (x, y) => townDist(x, y) <= 0 || townNear[x * N + y] || villageDist(x, y) <= VILLAGE.r || swampCell[x * N + y] ||
    DUNGEONS.some(d => footDist(d, x, y) <= 2) || trenchCell[x * N + y] || hengeDist(x, y) <= HENGE.blend || (reserved[x * N + y] && !outpostCell[x * N + y]) || volcanoCell[x * N + y] !== 0;
  const wet = c => riverCell[c] || H[c] <= SEA;
  /** grade a routed road: profile, cut/fill, shoulders, tunnels; stamps pathCell */
  const grade = (P, stop) => {
    const n = P.length, t = P.map(([x, y]) => { const c = x * N + y; return riverCell[c] ? NaN : Math.max(H[c], SEA + 1); });
    // (2026-10-21) a river crossing spans straight from bank to bank, at least a brick over
    // the water (was: down to the water at every river sample = a deck far under the road)
    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(t[i])) continue;
      let b = i; while (b < n && Number.isNaN(t[b])) b++;
      const a = i - 1, ta = a >= 0 ? t[a] : b < n ? t[b] : SEA + 1, tb = b < n ? t[b] : ta;
      for (let j = i; j < b; j++) { const [x, y] = P[j]; t[j] = Math.max(riverLevel[x * N + y] + 1, Math.round(ta + (tb - ta) * (j - a) / (b - a))); }
      i = b;
    }
    const sm = t.map((_, i) => { let a = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { a += t[j]; k++; } return Math.round(a / k); });
    const z = sm.slice();
    roadPaths.push({ P, z });
    z[0] = t[0];
    for (let i = 1; i < n; i++) z[i] = Math.max(z[i - 1] - 1, Math.min(z[i - 1] + 1, z[i]));
    z[n - 1] = t[n - 1];
    for (let i = n - 2; i >= 0; i--) z[i] = Math.max(z[i + 1] - 1, Math.min(z[i + 1] + 1, z[i]));
    // corridor (3 x 3 round each sample), then the shoulder rings
    const zAt = new Map(); // cell -> road level (the lowest sample that reaches it)
    const crossing = new Set();
    P.forEach(([x, y], i) => {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const cx = x + a, cy = y + b; if (!inBounds(cx, cy) || stop(cx, cy)) continue;
        const c = cx * N + cy; if (!zAt.has(c) || zAt.get(c) > z[i]) zAt.set(c, z[i]);
        // (owner 2026-10-13 screenshot: a plank deck ran ALONG the river) a corridor cell over
        // water is bridge only where the centre line itself is over water (a crossing)
        if (wet(c) && wet(x * N + y)) crossing.add(c);
      }
    });
    for (const [c, zr] of zAt) {
      const x = (c / N) | 0, y = c % N;
      if (wet(c) && !crossing.has(c)) continue; // the road's edge spilling onto the water: not road
      if (riverCell[c] && crossing.has(c)) bridgeZ[c] = Math.max(bridgeZ[c], zr);
      if (pinned(x, y) || wet(c)) { if (!pinned(x, y) || townDist(x, y) > 0) pathCell[c] = 1; continue; }
      if (H[c] - zr >= TUNNEL.at) { tunnelZ[c] = zr; keepOut[c] = 1; continue; }
      H[c] = zr; roadGraded[c] = 1; pathCell[c] = 1;
    }
    // light every 6th sample down a tunnel's middle
    P.forEach(([x, y], i) => { if (i % 6 === 0 && tunnelZ[x * N + y] >= 0) tunnelLights.push([x, y, tunnelZ[x * N + y]]); });
    for (const ring of [2, 3]) {
      P.forEach(([x, y], i) => {
        for (let a = -ring; a <= ring; a++) for (let b = -ring; b <= ring; b++) {
          if (Math.max(Math.abs(a), Math.abs(b)) !== ring) continue;
          const cx = x + a, cy = y + b; if (!inBounds(cx, cy)) continue;
          const c = cx * N + cy;
          if (zAt.has(c) || pinned(cx, cy) || wet(c) || tunnelZ[c] >= 0 || H[c] - z[i] >= TUNNEL.at) continue;
          const up = ring === 2 ? 3 : 6, down = ring === 2 ? 2 : 4;
          H[c] = Math.max(z[i] - down, Math.min(z[i] + up, H[c]));
        }
      });
    }
  };
  // wobble = false for straight leads (out of a gate); otherwise routed and graded
  const road = (sx, sy, dx, dy, stop, wobble = true) => {
    if (wobble) {
      // a target inside a no-road area (the swamp) moves out to its edge, toward the start
      let gx = Math.round(dx), gy = Math.round(dy);
      for (let k = 0, L = Math.hypot(dx - sx, dy - sy); k < L && (stop(gx, gy) && !trenchCell[gx * N + gy]); k++) {
        gx = Math.round(dx + ((sx - dx) * k) / L); gy = Math.round(dy + ((sy - dy) * k) / L);
      }
      const P = route(Math.round(sx), Math.round(sy), gx, gy, stop);
      if (P) { grade(P, stop); return; }
      console.error(`road ${Math.round(sx)},${Math.round(sy)} -> ${Math.round(dx)},${Math.round(dy)}: no route, laid straight`);
    }
    // straight (gate leads, or no route found): graded like any road (2026-10-06,
    // owner: bmx-proof paths; these used to ride the raw ground, cliffs and all)
    const steps = Math.ceil(Math.hypot(dx - sx, dy - sy) * 2), P = [];
    for (let k = 0; k <= steps; k++) {
      const w = wobble ? Math.min(1, k / 12, (steps - k) / 12) : 0; // wobble fades in/out at the ends
      const x = Math.round(sx + ((dx - sx) * k) / steps + Math.sin(k / 9) * 2 * w), y = Math.round(sy + ((dy - sy) * k) / steps + Math.cos(k / 11) * 2 * w);
      if (!inBounds(x, y) || townDist(x, y) <= 0 || stop(x, y)) continue;
      const last = P[P.length - 1];
      if (!last || last[0] !== x || last[1] !== y) P.push([x, y]);
    }
    if (P.length) grade(P, stop);
  };
  // town gates (mid-wall, town.mjs): every road from town leaves through one,
  // straight out for LEAD cells before it starts to wander
  const LEAD = 8;
  const gates = townPlan.exits.map(({ dir: [a, b], at }) => {
    const edge = [tx + at[0] / CELL + a, ty + at[1] / CELL + b];
    return { dir: [a, b], edge, out: [edge[0] + a * LEAD, edge[1] + b * LEAD] };
  });
  townGates.push(...gates);
  const nearestGate = (x, y) => gates.reduce((p, q) => (Math.hypot(q.out[0] - x, q.out[1] - y) < Math.hypot(p.out[0] - x, p.out[1] - y) ? q : p));
  const leadOut = (g, stop) => road(g.edge[0], g.edge[1], g.out[0], g.out[1], stop, false);
  for (const d of DUNGEONS) {
    const stop = (x, y) => trenchCell[x * N + y] === 1 || footDist(d, x, y) <= 0;
    const g = nearestGate(d.mouth[0], d.mouth[1]);
    leadOut(g, stop);
    road(g.out[0], g.out[1], d.mouth[0], d.mouth[1], stop);
  }
  // the swamp road leaves by its gate
  {
    const stop = (x, y) => swampCell[x * N + y] === 1;
    const g = gates.find(q => q.dir[0] === swamp.gate[0] && q.dir[1] === swamp.gate[1]);
    leadOut(g, stop);
    road(g.out[0], g.out[1], swamp.x, swamp.y, stop);
  }
  // hamlets: each joins the nearest town exit or hamlet already joined, and
  // runs into the end of the hamlet path facing it (town.mjs planVillage)
  const ends = gates.map(g => ({ at: g.out, gate: g }));
  for (const v of villages) {
    const from = ends.reduce((p, q) => (Math.hypot(q.at[0] - v.x, q.at[1] - v.y) < Math.hypot(p.at[0] - v.x, p.at[1] - v.y) ? q : p));
    const spoke = v.plan.spokes.reduce((p, q) => (Math.hypot(v.x + q.end[0] / CELL - from.at[0], v.y + q.end[1] / CELL - from.at[1]) < Math.hypot(v.x + p.end[0] / CELL - from.at[0], v.y + p.end[1] / CELL - from.at[1]) ? q : p));
    v.entry = spoke; // the lane the road comes in by (its sign)
    const tip = [v.x + spoke.end[0] / CELL, v.y + spoke.end[1] / CELL];
    const stop = (x, y) => villageDist(x, y) <= VILLAGE.r - 1.5 || swampCell[x * N + y] === 1 || DUNGEONS.some(d => footDist(d, x, y) <= 0);
    if (from.gate) leadOut(from.gate, stop);
    road(from.at[0], from.at[1], tip[0], tip[1], stop);
    ends.push({ at: [v.x + spoke.end[0] / CELL * 1.15, v.y + spoke.end[1] / CELL * 1.15] });
  }
  // the volcano's spiral road: its lead joins the nearest road (2026-10-14: the volcano is at the tail's tip,
  // so this is the long road down through the death forest; a town exit or hamlet end could be a hamlet away)
  {
    const [lx, ly] = volcano.lead;
    const stop = (x, y) => volcanoCell[x * N + y] !== 0 || swampCell[x * N + y] === 1 || villageDist(x, y) <= VILLAGE.r - 1.5 || DUNGEONS.some(d => footDist(d, x, y) <= 0);
    let from = null, fd = Infinity;
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (!pathCell[c] || riverCell[c] || trenchCell[c] || townDist(x, y) <= 0 || stop(x, y) || villageDist(x, y) <= VILLAGE.r + 2) continue;
      const d = Math.hypot(x - lx, y - ly);
      if (d < fd) { fd = d; from = [x, y]; }
    }
    road(from[0], from[1], lx, ly, stop);
    console.error(`volcano road: from ${from} (${Math.round(fd)} cells) to the lead ${lx},${ly}`);
  }
}

// outposts a road crossed or regraded: re-placed on flat ground with no road within 3 cells of the lot
{
  const offRoad = (x, y) => { for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) { const c = (x + dx) * N + y + dy; if (!inBounds(x + dx, y + dy) || pathCell[c] || tunnelZ[c] >= 0) return false; } return true; };
  const onLot = o => { for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const c = (o.x + dx) * N + o.y + dy; if (pathCell[c] || tunnelZ[c] >= 0) return true; } return false; };
  const moved = [];
  for (let i = outposts.length - 1; i >= 0; i--) {
    const o = outposts[i];
    if (lotH(o) === outpostLots[i] && !onLot(o)) continue;
    claimOutpost(o, 0);
    const best = findOutpost(o.k, offRoad);
    if (!best) { console.error(`outpost ${o.k} (t ${o.t.toFixed(2)}): a road crosses its lot and no flat open ground is left off the roads: dropped`); outposts.splice(i, 1); continue; }
    moved.push(`${o.k} ${X0 + o.x * CELL},${Y0 + o.y * CELL} -> ${X0 + best.x * CELL},${Y0 + best.y * CELL}`);
    Object.assign(o, best); claimOutpost(o, 1);
  }
  for (const o of outposts) claimOutpost(o, 1); // a moved lot may have cleared cells a neighbour shares
  console.error(`outposts moved off the roads: ${moved.length ? moved.reverse().join('; ') : 'none'} (generator coords)`);
}

stage('bridges');
// ---------------------------------------------------------------- bridges --
// (owner 2026-10-05: "make bridges spawn over paths with bodies of water")
// every road cell over water (the river, or ground under the sea plane) gets a
// plank deck flush with the bank (river: level + 2, sea: SEA + 2 bricks up),
// and a low rail on each edge that faces open water
const deck = new Int16Array(N * N); // deck top (units), 0 = none
{
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (!pathCell[c]) continue;
      if (riverCell[c]) deck[c] = (Math.max(riverLevel[c] + 1, bridgeZ[c]) + 1) * VZ; // the road's level, a brick over the water at least
      else if (H[c] <= SEA) deck[c] = (SEA + 2) * VZ;
      if (deck[c]) { keepOut[c] = 1; noSmooth[c] = 1; }
    }
}

const weirs = [];                          // rock weirs: filled in just before the voxels
const weirCell = new Uint8Array(N * N);


stage('settlements');
// ------------------------------------------------------------- settlements --
// Abandoned settlements (2026-10-06, owner: "abandoned settlements", ruins.mjs):
// flat ground well off the roads, away from everything built; levelled like a
// small hamlet. Built (bricks, goblins) in the decor pass.
const RUINS = { r: 12, blend: 8, count: Math.round(tune('ruins.count', 4, 'abandoned settlements (x K)') * K), spacing: Math.round(55 * K) };
// distance (cells, chamfer) to the nearest path cell: ruins, camps and details keep off the roads
// road embankments (2026-10-10, owner screenshot: the road out of the town ran
// on a 27-brick causeway with sheer sides beside the river): the shoulders
// only blend 2-3 cells, so below a road that stays high (it may only drop a
// brick per cell) the ground is filled to at most road.bankSlope bricks per
// cell under it. Fill only; never in water, the river's channel and banks, the
// town, hamlets, swamp, volcano, the trench or round the dungeons.
function roadEmbankments() {
  const S = tune('road.bankSlope', 1, 'embankment under a raised road: bricks per cell');
  const low = new Float32Array(N * N).fill(-Infinity), ok = new Uint8Array(N * N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (pathCell[c] && roadGraded[c] && !riverCell[c] && tunnelZ[c] < 0) { low[c] = H[c]; continue; }
      if (pathCell[c] || riverCell[c] || H[c] <= SEA || swampCell[c] || volcanoCell[c] || trenchCell[c] || riverD[c] <= RIVER.rw + 3) continue;
      if (townDist(x, y) <= 0 || villageDist(x, y) <= VILLAGE.r || DUNGEONS.some(d => footDist(d, x, y) <= 2)) continue;
      ok[c] = 1;
    }
  for (let pass = 0, changed = true; changed && pass < 60; pass++) {
    changed = false;
    const relax = (x, y) => {
      const c = x * N + y;
      if (!ok[c]) return;
      let best = low[c];
      if (x > 0 && low[c - N] - S > best) best = low[c - N] - S;
      if (x < N - 1 && low[c + N] - S > best) best = low[c + N] - S;
      if (y > 0 && low[c - 1] - S > best) best = low[c - 1] - S;
      if (y < N - 1 && low[c + 1] - S > best) best = low[c + 1] - S;
      if (best > low[c]) { low[c] = best; changed = true; }
    };
    if (pass & 1) { for (let x = N - 1; x >= 0; x--) for (let y = N - 1; y >= 0; y--) relax(x, y); }
    else { for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) relax(x, y); }
  }
  let cells = 0, fill = 0;
  for (let c = 0; c < N * N; c++) if (ok[c] && low[c] > H[c]) { const t = Math.floor(low[c]); if (t > H[c]) { fill += t - H[c]; H[c] = t; cells++; } }
  console.error(`road embankments: ${cells} cells raised, ${fill} voxels`);
}
// roadEmbankments(); // (owner: not wanted; kept for later)
const pathDist = new Float32Array(N * N).fill(1e9);
{
  for (let i = 0; i < N * N; i++) if (pathCell[i]) pathDist[i] = 0;
  const pass = (s0, s1, st) => {
    for (let x = s0; x !== s1; x += st) for (let y = s0; y !== s1; y += st) {
      let d = pathDist[x * N + y];
      for (const [a, b, w] of [[-st, 0, 1], [0, -st, 1], [-st, -st, 1.41], [-st, st, 1.41]]) { const xx = x + a, yy = y + b; if (inBounds(xx, yy) && pathDist[xx * N + yy] + w < d) d = pathDist[xx * N + yy] + w; }
      pathDist[x * N + y] = d;
    }
  };
  pass(0, N, 1); pass(N - 1, -1, -1);
}
const ruins = [];
{
  const Rr = RUINS.r, cand = [];
  for (let cx = 40; cx < N - 40; cx += 4)
    for (let cy = 40; cy < N - 40; cy += 4) {
      const i = cx * N + cy;
      // clearances scale with the island (2026-10-06: at scale 1 the fixed ones left no room)
      if (pathDist[i] < Rr + RUINS.blend + 3 || townDist(cx, cy) < Rr + TOWN.blend + 20 * K || villageDist(cx, cy) < VILLAGE.r + Rr + 20 * K) continue;
      if (DUNGEONS.some(d => footDist(d, cx, cy) < Rr + RAISE_BLEND + 6) || hengeDist(cx, cy) < Rr + 20 || riverNear(cx, cy, Rr + 6)) continue;
      if (swampRho(cx, cy) < SWAMP.r + SWAMP.blend + Rr + 10) continue;
      let lo = Infinity, hi = -Infinity, sum = 0, n = 0, bad = false;
      for (let x = cx - Rr; x <= cx + Rr && !bad; x += 2) for (let y = cy - Rr; y <= cy + Rr; y += 2) {
        const c = x * N + y, h = H[c];
        if (h <= SEA + 2 || keepOut[c] || reserved[c] || trenchCell[c] || siteOff(c)) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++;
      }
      if (bad || hi - lo > 14 || hi > 120) continue;
      // the levelled desert is the flattest ground there is: a penalty keeps most ruins out on the green
      cand.push({ x: cx, y: cy, h: Math.round(sum / n), score: hi - lo + hash(cx, cy, 401) * 3 + desertW(cx, cy) * 8 });
    }
  cand.sort((a, b) => a.score - b.score);
  for (const c of cand) {
    if (ruins.length >= RUINS.count) break;
    if (ruins.some(v => Math.hypot(v.x - c.x, v.y - c.y) < RUINS.spacing)) continue;
    ruins.push(c);
  }
  for (const [k, v] of ruins.entries()) {
    v.seed = 13000 + k;
    for (let x = v.x - Rr - RUINS.blend; x <= v.x + Rr + RUINS.blend; x++)
      for (let y = v.y - Rr - RUINS.blend; y <= v.y + Rr + RUINS.blend; y++) {
        if (!inBounds(x, y)) continue;
        const c = x * N + y, d = Math.hypot(x - v.x, y - v.y) * (1 + 0.15 * fbm2((X0 + x * CELL) / 500 + k, (Y0 + y * CELL) / 500, 2));
        if (pathCell[c] || riverCell[c]) continue;
        if (d <= Rr) { H[c] = v.h; reserved[c] = 1; }
        else if (d < Rr + RUINS.blend) H[c] = Math.round(lerp(v.h, H[c], smooth(Rr, Rr + RUINS.blend, d)));
      }
  }
  console.error(`ruins: ${ruins.length} abandoned settlements of ${cand.length} sites`);
}
// goblin camps: small clearings off the roads, up the island from the town, levelled
const CAMP = { r: 5, blend: 5, count: Math.round(tune('goblins.camps', 6, 'goblin camps (x K)') * K) };
const camps = [];
{
  const Rr = CAMP.r, cand = [];
  for (let cx = 30; cx < N - 30; cx += 3)
    for (let cy = 30; cy < N - 30; cy += 3) {
      const i = cx * N + cy;
      if (H[i] <= SEA + 2 || H[i] > 110 || pathDist[i] < Rr + CAMP.blend + 2 || progress(cx, cy) < 0.06) continue;
      if (townDist(cx, cy) < TOWN.blend + 15 * K || villageDist(cx, cy) < VILLAGE.r + 15 * K || hengeDist(cx, cy) < 15 || riverNear(cx, cy, Rr + 4)) continue;
      if (DUNGEONS.some(d => footDist(d, cx, cy) < Rr + RAISE_BLEND + 4) || swampRho(cx, cy) < SWAMP.r + SWAMP.blend + 10 || desertW(cx, cy) > 0.3) continue;
      if (ruins.some(v => Math.hypot(v.x - cx, v.y - cy) < RUINS.r + 20 * K)) continue;
      let lo = Infinity, hi = -Infinity, sum = 0, n = 0, bad = false;
      for (let x = cx - Rr; x <= cx + Rr && !bad; x++) for (let y = cy - Rr; y <= cy + Rr; y++) {
        const c = x * N + y, h = H[c];
        if (h <= SEA + 2 || keepOut[c] || reserved[c] || trenchCell[c] || pathCell[c] || siteOff(c)) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++;
      }
      if (bad || hi - lo > 9) continue;
      cand.push({ x: cx, y: cy, h: Math.round(sum / n), score: hi - lo + hash(cx, cy, 701) * 4 });
    }
  cand.sort((a, b) => a.score - b.score);
  for (const c of cand) {
    if (camps.length >= CAMP.count) break;
    if (camps.some(v => Math.hypot(v.x - c.x, v.y - c.y) < 50 * K)) continue;
    camps.push(c);
  }
  for (const v of camps)
    for (let x = v.x - Rr - CAMP.blend; x <= v.x + Rr + CAMP.blend; x++)
      for (let y = v.y - Rr - CAMP.blend; y <= v.y + Rr + CAMP.blend; y++) {
        if (!inBounds(x, y)) continue;
        const c = x * N + y, d = Math.hypot(x - v.x, y - v.y);
        if (pathCell[c] || riverCell[c]) continue;
        if (d <= Rr) { H[c] = v.h; reserved[c] = 1; }
        else if (d < Rr + CAMP.blend) H[c] = Math.round(lerp(v.h, H[c], smooth(Rr, Rr + CAMP.blend, d)));
      }
  console.error(`camps: ${camps.length} goblin camps of ${cand.length} sites`);
}
// shrines and temples to made-up gods (owner 2026-10-10: "shrines with fake
// gods that are procedurally generated dwarf fortress style", "add temples";
// gods.mjs, built by town.mjs `single`): flat ground a little off the roads,
// levelled and reserved like the camps, each door toward its road
const HOLY = { shrines: Math.round(tune('holy.shrines', 7, 'wayside shrines (x K)') * K), temples: Math.round(tune('holy.temples', 2, 'temples (x K)') * K) };
const holy = [];
// ground under the Georgian estates' lots before they were levelled (2026-10-18): the cave search plans with it so
// an estate lot (picked last) never moves a cave elsewhere on the map; the carving still stops under the lot
const lotPre = new Map();
{
  const pick1 = (kind, count, Rr, blend, spacing, [near0, near1], rough, off = siteOff) => {
    const cand = [];
    for (let cx = 30; cx < N - 30; cx += 3)
      for (let cy = 30; cy < N - 30; cy += 3) {
        const i = cx * N + cy;
        if (H[i] <= SEA + 2 || H[i] > 125 || pathDist[i] < near0 || pathDist[i] > near1) continue;
        if (townDist(cx, cy) < TOWN.blend + Rr + 6 || villageDist(cx, cy) < VILLAGE.r + Rr + 8 || hengeDist(cx, cy) < Rr + 10 || riverNear(cx, cy, Rr + 3)) continue;
        if (DUNGEONS.some(d => footDist(d, cx, cy) < Rr + RAISE_BLEND + 4) || swampRho(cx, cy) < SWAMP.r + SWAMP.blend + Rr + 4 || volcanoCell[i]) continue;
        if ([...ruins, ...camps].some(v => Math.hypot(v.x - cx, v.y - cy) < Rr + 20) || holy.some(v => Math.hypot(v.x - cx, v.y - cy) < (v.kind === kind ? spacing : Rr + v.r + v.blend + 6))) continue;
        let lo = Infinity, hi = -Infinity, sum = 0, n = 0, bad = false;
        for (let x = cx - Rr; x <= cx + Rr && !bad; x++) for (let y = cy - Rr; y <= cy + Rr; y++) {
          const c = x * N + y, h = H[c];
          if (h <= SEA + 2 || keepOut[c] || reserved[c] || trenchCell[c] || pathCell[c] || off(c)) { bad = true; break; }
          lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; n++;
        }
        if (bad || hi - lo > rough) continue;
        cand.push({ x: cx, y: cy, h: Math.round(sum / n), score: hi - lo + hash(cx, cy, 441 + kind.length) * 6 + (kind === 'casino' ? townDist(cx, cy) * 2 - (cx === 456 && cy === 420 ? 1000 : 0) : 0), kind, r: Rr, blend }); // the live casino's site (2026-10-12): its game prefabs stand there
      }
    cand.sort((a, b) => a.score - b.score);
    let got = 0;
    for (const c of cand) {
      if (got >= count) break;
      if (holy.some(v => Math.hypot(v.x - c.x, v.y - c.y) < (v.kind === kind ? spacing : c.r + v.r + v.blend + c.blend + 4))) continue;
      holy.push(c); got++;
    }
  };
  pick1('temple', HOLY.temples, 9, 6, 120 * K, [4, 14], 10);
  pick1('shrine', HOLY.shrines, 3, 4, 40 * K, [2, 8], 4);
  // the casino (owner 2026-10-10: "a casino at spawn"): as near the town as a flat site by a road gets;
  // picked before the roadside buildings (2026-10-12: picked last, the terraced build's chapel took its site and the live casino was cleared)
  pick1('casino', 1, 9, 5, 100, [3, 24], 18);
  // roadside buildings (this map's three hamlets are small, so the new kinds
  // also stand alone by the roads): inns, a library, warehouses, a dining hall, chapels
  for (const [kind, n, r] of [['tavern', 2, 6], ['warehouse', 2, 6], ['chapel', 2, 6], ['library', 1, 5], ['dininghall', 1, 7]])
    pick1(kind, Math.round(tune('roadside.' + kind, n, `${kind}s standing alone by the roads`)), r, 5, 40 * K, [3, 18], 14);
  // (2026-10-15, owner: "shops for swords and guns ... around the world ... give them a lot
  // of space") wallgen weapon shops on roomy lots by the roads; picked last so no older site moves
  for (const kind of ['armory', 'gunsmith'])
    pick1(kind, Math.round(tune('wshop.' + kind, 3, `${kind}s (weapon shops) by the roads`)), 9, 6, 30 * K, [10, 34], 26);
  // (2026-10-16, owner: "make shops like the soda spawn randomly") soda shacks (3 seeded flavours each) by the roads; picked last
  pick1('sodashack', Math.round(tune('roadside.sodashack', 6, 'soda shacks (3 random flavours) by the roads')), 3, 4, 30 * K, [2, 8], 6);
  // (2026-10-17, owner: "no new houses were added": this map's hamlets are too small to fit any) lone
  // houses by the roads, each a town.mjs HOUSE_TYPES archetype (croft .. manor); picked last so no older site moves
  // (2026-10-17, owner photo) split-level ranches (town.mjs TYPES.splitlevel, ~55 x 34 studs) on lots sized for them,
  // before the lone houses take the big flat spots
  pick1('splitlevel', Math.round(tune('roadside.splitlevel', 8, 'split-level ranch houses by the roads')), 8, 5, 12 * K, [2, 24], 24);
  {
    const want = { cottage: Math.round(tune('roadside.cottage', 14, 'lone cottages (HOUSE_TYPES) by the roads')), townhouse: Math.round(tune('roadside.townhouse', 10, 'lone townhouses (HOUSE_TYPES) by the roads')) };
    // one at a time, alternating, so both kinds get lots before the flat ground runs out
    for (let round = 0; round < 20; round++) for (const kind of ['townhouse', 'cottage']) if (round < want[kind]) pick1(kind, 1, 6, 4, 12 * K, [2, 24], 24);
  }
  // (2026-10-18, owner photos) Dutch Colonials (town.mjs TYPES.dutchcolonial, ~59 x 48 studs with the porch and the
  // detached garage) on lots sized like the split-levels'; picked last so no older site moves
  pick1('dutchcolonial', Math.round(tune('roadside.dutchcolonial', 6, 'Dutch Colonial houses (gambrel, porch, garage) by the roads')), 8, 5, 12 * K, [2, 32], 40);
  // (2026-10-18, owner: a Zillow listing) Georgian estates (town.mjs TYPES.georgian, 84 x 77 studs: main block, wings,
  // Aspen room, pool, motor court) on 23-cell lots (the house fills the flat core inside the edge ring's ramps; blend 2
  // so they fit between the older sites), also on the old volcano's ground (siteOff only pins older searches); picked last
  pick1('georgian', Math.round(tune('roadside.georgian', 3, 'Georgian brick estates (wings, great room, pool) by the roads')), 11, 2, 30 * K, [2, 40], 60, c => tailOff(c));
  holy.forEach((v, k) => {
    v.seed = 17000 + k;
    // the door faces the nearest road cell
    let best = null;
    for (let dx = -16; dx <= 16; dx++) for (let dy = -16; dy <= 16; dy++) { const x = v.x + dx, y = v.y + dy; if (inBounds(x, y) && pathCell[x * N + y] && (!best || Math.hypot(dx, dy) < best[2])) best = [dx, dy, Math.hypot(dx, dy)]; }
    v.facing = best ? (Math.abs(best[0]) >= Math.abs(best[1]) ? [Math.sign(best[0]), 0] : [0, Math.sign(best[1])]) : [0, -1];
    for (let x = v.x - v.r - v.blend; x <= v.x + v.r + v.blend; x++)
      for (let y = v.y - v.r - v.blend; y <= v.y + v.r + v.blend; y++) {
        if (!inBounds(x, y)) continue;
        const c = x * N + y, d = Math.max(Math.abs(x - v.x), Math.abs(y - v.y));
        if (pathCell[c] || riverCell[c]) continue;
        if (v.kind === 'georgian' && d < v.r + v.blend && !lotPre.has(c)) lotPre.set(c, H[c]);
        if (d <= v.r) { H[c] = v.h; reserved[c] = 1; }
        else if (d < v.r + v.blend) H[c] = Math.round(lerp(v.h, H[c], smooth(v.r, v.r + v.blend, d)));
      }
  });
  const tally = {}; for (const v of holy) tally[v.kind] = (tally[v.kind] ?? 0) + 1;
  console.error(`holy places and roadside buildings: ${JSON.stringify(tally)}`);
}

// the river valley cap runs here: after every pass that moves the ground (roads,
// bridges, settlements), before the voxels are built from H
// sewers (2026-10-12): floor SEWER.floor voxels, SEWER.high clear over it,
// under tier 0 by sewerDepth (the kiosks' stairs go that far down)
const SEWER = { floor: town.h - 13, high: 7 };
const sewerDepth = (town.h - SEWER.floor) * VZ;
let townTrial = null;
if (process.env.MAPGEN_SITECHECK) {
  const lots = [...ruins, ...camps, ...holy].map(v => ({ v, cells: [] }));
  for (const L of lots) { const r = L.v.r ?? (ruins.includes(L.v) ? RUINS.r : CAMP.r); for (let x = Math.max(0, L.v.x - r); x <= Math.min(N - 1, L.v.x + r); x++) for (let y = Math.max(0, L.v.y - r); y <= Math.min(N - 1, L.v.y + r); y++) if (Math.hypot(x - L.v.x, y - L.v.y) <= r) L.cells.push(x * N + y); }
  let snap = Int16Array.from(H);
  const label = L => `${L.v.kind ?? (ruins.includes(L.v) ? 'ruins' : 'camp')}@${X0 + L.v.x * CELL},${Y0 + L.v.y * CELL}`;
  const off = () => lots.map(L => ({ L, bad: L.cells.filter(c => H[c] !== L.v.h).length })).filter(o => o.bad);
  console.error(`sitecheck settlements: ${off().map(o => `${label(o.L)} ${o.bad}/${o.L.cells.length} off`).join('; ') || 'all lots flat'}`);
  stageHook = id => {
    const moved = lots.map(L => ({ L, n: L.cells.filter(c => H[c] !== snap[c]).length })).filter(o => o.n);
    if (moved.length) console.error(`sitecheck before ${id}: ${moved.map(o => `${label(o.L)} ${o.n} cells` + (process.env.MAPGEN_SITECHECK === '2' ? ' ' + JSON.stringify(o.L.cells.filter(c => H[c] !== snap[c]).map(c => ({ x: Math.floor(c / N), y: c % N, was: snap[c], now: H[c], res: reserved[c], river: riverCell[c], v: o.L.v.h }))) : '')).join('; ')}`);
    snap = Int16Array.from(H);
  };
}
stage('terraces');
// terrace claims (2026-10-12): a trial town build levels each building's lot
// to its tier (town.mjs plan.claim); raise / lower those cells to match
{
  const base = new Map();
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) if (townKind[x * N + y]) base.set(x * N + y, townLevel(x, y));
  townTrial = buildTown({ put: () => {}, orientFor, rnd: townRnd, plan: townPlan, shopTiers: ['bronze', 'iron'], sewerDepth,
    riverAt: (ux, uy) => { const x = town.fx + TOWN.cells / 2 + Math.floor(ux / CELL), y = town.fy + TOWN.cells / 2 + Math.floor(uy / CELL); return inBounds(x, y) && riverCell[x * N + y] === 1; } });
  let moved = 0;
  for (const [c, l0] of base) { const x = (c / N) | 0, y = c % N, l = townLevel(x, y); if (l !== l0 && !riverCell[c]) { H[c] = town.h + l; moved++; } }
  console.error(`town terraces: ${moved} lot cells levelled to their buildings`);
}
stage('valleyCap');
riverDiag('before cap');
riverValleyCap();
stage('levees');
// levees (2026-10-13, "the water sticks up out of the ground"): after every ground edit
// (the valley cap last), a dry cell lower than the water beside it is raised to the water
// line, and a river cell's bed stays under its water; then the rock weirs
{
  let raised = 0;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (!riverCell[c] || riverLevel[c] <= SEA) continue;
      const lv = riverLevel[c];
      if (H[c] >= lv) H[c] = lv - 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const n = (x + dx) * N + y + dy;
        if (!inBounds(x + dx, y + dy) || riverCell[n] || townKind[n] || deck[n]) continue;
        if (H[n] < lv) { H[n] = lv; raised++; }
      }
    }
  console.error(`river levees: ${raised} bank cells raised to the water line`);
}
// (2026-10-22, owner screenshots: unsmoothed 1-brick stair fields and half-cut mountains) the valley cap and the
// levees re-cut tiered mountain ground: snap it back onto the tier grid (shelves stepping down to the river) and
// hand cells that can't snap (bank cells next to the water, under the base) back to the smoothing
if (tierMtn.win) {
  const T = TIER.h;
  let snapped = 0, freed = 0;
  for (let c = 0; c < N * N; c++) {
    const B = tierMtn.B[c];
    if (B < 0 || (H[c] - B) % T === 0) continue;
    const x = (c / N) | 0, y = c % N;
    let wet = riverCell[c] || pathCell[c] || reserved[c] || townKind[c] || H[c] <= B;
    for (let a = -1; a <= 1 && !wet; a++) for (let b = -1; b <= 1 && !wet; b++) if (inBounds(x + a, y + b) && riverCell[(x + a) * N + y + b]) wet = true;
    if (!wet && B + Math.floor((H[c] - B) / T) * T > SEA) { H[c] = B + Math.floor((H[c] - B) / T) * T; snapped++; continue; }
    tierMtn.cells[c] = 0; tierMtn.B[c] = -1; freed++;
  }
  // untargeted rim cells (marked so the smoothing leaves the wall foot alone) that the cap moved: smooth them
  for (let c = 0; c < N * N; c++) if (tierMtn.cells[c] && tierMtn.B[c] < 0 && riverBankL[c] > -999) {
    const x = (c / N) | 0, y = c % N; let wall = false;
    for (let a = -1; a <= 1 && !wall; a++) for (let b = -1; b <= 1 && !wall; b++) if (inBounds(x + a, y + b) && tierMtn.B[(x + a) * N + y + b] >= 0 && H[(x + a) * N + y + b] > H[c] + 2) wall = true;
    if (!wall) { tierMtn.cells[c] = 0; freed++; }
  }
  const before = tierMtn.chamfer.length;
  tierCorners();
  console.error(`snow tiers after the valley cap: ${snapped} cells snapped to tiers, ${freed} freed to smoothing, corner wedges ${before} -> ${tierMtn.chamfer.length}`);
}
stage('coves');
// ------------------------------------------------------------------ coves --
// (owner 2026-10-14: "make a cove ... really really beautiful like huge stalagmites, moss
// growing upward from the ocean floor to the rocks and beaches and trees and like a
// charcuterie of interesting coastline shit") quiet stretches of coast get a round bay:
// its seaward part opens to the sea, the bowl is dug below the sea plane (deepest in the
// middle, moss-green bed), a sand beach runs round the landward edge and a stone cliff rim
// (grass on top) stands behind it. cove.mjs fills it (sea stacks, arch, moss, kelp,
// beach clutter, trees); see 'cove dressing' after the forest.
const coveCell = new Uint8Array(N * N); // 1 bay water, 2 beach, 3 rim
const coves = [];
{
  const COUNT = Math.round(tune('cove.count', 3, 'coves along the coast (x K)') * K), R = tune('cove.r', 13, 'cove radius, cells');
  const CLIFF_H = tune('cove.cliff', 30, 'cove cliff height over the sea, bricks'), M = R + 16; // M: cells round the centre the cove may change
  const busy = (x, y) => {
    if (!inBounds(x, y)) return false;
    const c = x * N + y;
    return townNear[c] || townKind[c] || pathCell[c] || deck[c] || riverCell[c] || swampCell[c] || volcanoCell[c] || keepOut[c] || reserved[c] || villagePaved[c]
      || villageDist(x, y) <= VILLAGE.r + 6 || hengeDist(x, y) <= 6 || deathW[c] > 0.2 || snowW(x, y) > 0.3
      || DUNGEONS.some(d => d.fx !== undefined && x >= d.fx - 6 && x < d.fx + d.cells + 6 && y >= d.fy - 6 && y < d.fy + d.cells + 6);
  };
  const cand = [];
  for (let x = M + 2; x < N - M - 2; x += 3)
    for (let y = M + 2; y < N - M - 2; y += 3) {
      const h = H[x * N + y];
      if (h <= SEA + 1 || h > SEA + 14) continue;
      // the sea nearby: its mean direction is the way out
      let sx = 0, sy = 0, ns = 0;
      for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) if (H[(x + a) * N + y + b] <= SEA - 2) { sx += a; sy += b; ns++; }
      if (ns < 20 || ns > 90) continue;
      const l = Math.hypot(sx, sy); if (l < 1) continue;
      cand.push([hash(x, y, 801), x, y, -sx / l, -sy / l]);
    }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, x, y, nx, ny] of cand) {
    if (coves.length >= COUNT) break;
    const cx = Math.round(x + nx * R * 0.45), cy = Math.round(y + ny * R * 0.45);
    if (coves.some(c => Math.hypot(c.x - cx, c.y - cy) < M * 2.2)) continue;
    let bad = false, sea = 0, all = 0;
    for (let a = -M; a <= M && !bad; a++) for (let b = -M; b <= M; b++) {
      if (Math.hypot(a, b) > M) continue;
      if (busy(cx + a, cy + b)) { bad = true; break; }
      if (Math.hypot(a, b) <= R) { all++; if (H[(cx + a) * N + cy + b] <= SEA) sea++; }
      if (H[(cx + a) * N + cy + b] > SEA + CLIFF_H - 4) { bad = true; break; } // no mountains behind: the cliffs are the high ground
    }
    if (bad || sea < all * 0.12 || sea > all * 0.5) continue;
    const side = hash(cx, cy, 802) < 0.5 ? -1 : 1;
    coves.push({ x: cx, y: cy, nx, ny, R, side });
  }
  // the bay: deep water in the middle (moss bed), shallows of pale sand, a wide beach
  // rising gently to the foot of sheer striped sandstone cliffs CLIFF_H bricks over the
  // sea that wrap round to the mouth, then fall away behind; on one side of the mouth a
  // headland of beach-level sand runs out to sea (cove.mjs raises the arch rock on it)
  for (const cv of coves) {
    const tx = -cv.ny * cv.side, ty = cv.nx * cv.side;
    // headland: an ellipse past the bay's edge on the mouth side, long axis seaward
    const hx = cv.x + (-cv.nx * 0.35 + tx * 0.98) * R, hy = cv.y + (-cv.ny * 0.35 + ty * 0.98) * R;
    cv.head = { x: hx, y: hy, ax: -cv.nx, ay: -cv.ny, tx, ty };
    for (let a = -M; a <= M; a++) for (let b = -M; b <= M; b++) {
      const x = cv.x + a, y = cv.y + b, c = x * N + y, q = Math.hypot(a, b) / R, u = (a * cv.nx + b * cv.ny) / R;
      if (!inBounds(x, y) || Math.hypot(a, b) > M) continue;
      const hu = ((x - hx) * -cv.nx + (y - hy) * -cv.ny) / 7, hv = ((x - hx) * tx + (y - hy) * ty) / 4.5;
      if (hu * hu + hv * hv <= 1) { H[c] = SEA + 2; coveCell[c] = 2; noSmooth[c] = 1; continue; } // the headland's floor
      if (q < 0.55 || (q < 1.08 && u < -0.25)) {
        const deep = q < 0.38 || u < -0.25;
        H[c] = Math.min(H[c], deep ? SEA - 4 - Math.round(6 * (1 - Math.min(q, 1)) + 3 * Math.min(1, Math.max(0, -u))) : SEA - 1 - Math.round((0.55 - q) / 0.17 * 3));
        coveCell[c] = deep ? 1 : 4;
      } else if (q < 1 && u >= -0.25) {
        H[c] = SEA + 1 + Math.round(((q - 0.55) / 0.45) * 3); coveCell[c] = 2;
      } else if (u > -0.35) {
        const out = (q - 1) * R; // cells behind the beach
        const t = SEA + CLIFF_H + Math.round(fbm2(x / 9 + 40, y / 9, 2) * 6) - Math.max(0, out - 4) * 2.4;
        if (t > H[c]) { H[c] = t; coveCell[c] = 3; if (out < 3) noSmooth[c] = 1; }
      }
    }
  }
  console.error(`coves: ${coves.length} at ${coves.map(c => `${X0 + c.x * CELL},${Y0 + c.y * CELL}`).join(' ')}`);
}

stage('delta');
// ------------------------------------------------------------------ delta --
// (owner 2026-10-15: "add deltas to rivers") the river's last stretch fans out to the sea.
// From an apex delta.len cells up the course from where its bed meets the sea, the fan
// opens toward the open sea (the mean of the deep water round the mouth) and runs out
// delta.out cells past the coast. delta.arms distributary channels spread over it
// (octilinear like the river: 45/90 degree runs, narrowing as they go) with small creeks
// splitting off them; the land between is levelled to low islands a brick or three over
// the sea: sand banks along every channel, marsh on the higher ground, shallow lagoons in
// the hollows, mouth bars round the arm ends on a shallow platform past the coast. The
// fan's sides ease back up to the old ground on the river's valley profile. Water is the
// sea plane: every channel sits at the sea's level.
// It runs after every site, road, bridge and cove is placed so none of them moves: their
// cells (and hamlets, town, dungeons, coves with their margins) are never changed, and the
// ground near them only comes down on the valley profile from their height.
const DELTA = { on: tune('delta.on', 1, 'river delta at the mouth (0 = off)'), len: Math.round(tune('delta.len', 14, 'apex this far up the course from the coast, cells (x K)') * K),
  reach: Math.round(tune('delta.reach', 55, 'fan reaches at most this far from the apex, cells (x K)') * K),
  spread: tune('delta.spread', 0.6, 'half-angle of the fan, radians'), arms: tune('delta.arms', 5, 'distributary channels'),
  creeks: Math.round(tune('delta.creeks', 6, 'small creeks off the arms (x K)') * K), out: Math.round(tune('delta.out', 12, 'arms, levees and mouth bars run this far past the coast, cells (x K)') * K) };
const deltaCell = new Uint8Array(N * N); // 1 channel, 2 sand bank / bar, 3 marsh, 4 lagoon / shallows
const delta = (() => {
  const { pts, coast } = riverRiver;
  if (!DELTA.on || coast < 0) return null;
  // the apex: back up the course from the coast by delta.len cells, out of town
  let ia = coast, run = 0;
  while (ia > 0 && run < DELTA.len && townDist(Math.round(pts[ia - 1][0]), Math.round(pts[ia - 1][1])) > 30) { run += Math.hypot(pts[ia][0] - pts[ia - 1][0], pts[ia][1] - pts[ia - 1][1]); ia--; }
  const A = pts[ia], Ax = Math.round(A[0]), Ay = Math.round(A[1]), RR = DELTA.reach;
  // the cells nothing may change, and round them the distance and height to ease from
  const bx0 = Math.max(0, Ax - RR - 70), bx1 = Math.min(N - 1, Ax + RR + 70), by0 = Math.max(0, Ay - RR - 70), by1 = Math.min(N - 1, Ay + RR + 70);
  const BW = by1 - by0 + 1, bi = (x, y) => (x - bx0) * BW + (y - by0);
  const dP = new Float32Array((bx1 - bx0 + 1) * BW).fill(Infinity), hP = new Int16Array(dP.length);
  const prot = (x, y) => {
    const c = x * N + y;
    return pathCell[c] || deck[c] || townKind[c] || townNear[c] || villagePaved[c] || reserved[c] || swampCell[c] || volcanoCell[c] || trenchCell[c] || coveCell[c] || weirCell[c]
      || (keepOut[c] && !riverCell[c] && riverBankL[c] <= -999) || townDist(x, y) <= 6 || villageDist(x, y) <= VILLAGE.r + 3 || hengeDist(x, y) <= 4
      || coves.some(cv => Math.hypot(cv.x - x, cv.y - y) <= cv.R + 18) || DUNGEONS.some(d => footDist(d, x, y) <= 4);
  };
  let q = [];
  for (let x = bx0; x <= bx1; x++) for (let y = by0; y <= by1; y++) if (prot(x, y)) { dP[bi(x, y)] = 0; hP[bi(x, y)] = H[x * N + y]; q.push([x, y]); }
  for (let d = 1; d <= 60 && q.length; d++) { // 8-neighbour rings, the height of the nearest protected cell carried out
    const nq = [];
    for (const [x, y] of q) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const nx = x + a, ny = y + b;
      if (nx < bx0 || nx > bx1 || ny < by0 || ny > by1) continue;
      const k = bi(nx, ny), h = hP[bi(x, y)];
      if (dP[k] === Infinity) { dP[k] = d; hP[k] = h; nq.push([nx, ny]); }
      else if (dP[k] === d && h > hP[k]) hP[k] = h;
    }
    q = nq;
  }
  // the lowest the ground may go here: down from the nearest protected cell on the valley profile
  const floorAt = (x, y) => { const k = bi(x, y), d = dP[k]; return d === Infinity ? -Infinity : hP[k] - Math.floor(valleyRise(d)); };
  // the axis: of the directions that reach open sea (deep cells, not a cove) within
  // delta.reach and do not turn back up the river, the one whose fan holds the most free
  // ground (cells clear of everything that stays) for the least held back
  const fl = pts[Math.min(pts.length - 1, ia + 8)], fdx = fl[0] - A[0], fdy = fl[1] - A[1];
  const tanS = Math.tan(DELTA.spread);
  let best = null;
  for (let a = 0; a < 48; a++) {
    const th = (a / 48) * 2 * Math.PI, ux = Math.cos(th), uy = Math.sin(th);
    if (ux * fdx + uy * fdy < 0) continue;
    let uc = 0;
    while (uc < RR) { const x = Math.floor(A[0] + ux * uc), y = Math.floor(A[1] + uy * uc); if (!inBounds(x, y) || (H[x * N + y] <= SEA - 4 && !coveCell[x * N + y])) break; uc++; }
    if (uc >= RR || uc < 16) continue;
    let score = 0;
    for (let u = 2; u <= uc; u += 2) for (let v = -(RIVER.rw + u * tanS); v <= RIVER.rw + u * tanS; v += 2) {
      const x = Math.floor(A[0] + ux * u - uy * v), y = Math.floor(A[1] + uy * u + ux * v);
      if (x < bx0 || x > bx1 || y < by0 || y > by1) { score -= 4; continue; }
      const d = dP[bi(x, y)]; score += d > 8 ? 1 : d > 3 ? 0 : -4;
    }
    if (!best || score > best.score) best = { score, ux, uy, uc };
  }
  if (!best || best.score <= 0) { console.error(`delta: no free fan from the mouth${best ? ` (best score ${best.score})` : ''}`); return null; }
  const dx = best.ux, dy = best.uy, Uc = best.uc;
  const px = -dy, py = dx, U = Uc + DELTA.out;
  // octilinear route through a curve (cell centres; two legs per run, diagonal and straight,
  // the order that hugs it; a run grows while the curve stays within tol cells)
  const octRoute = (cur, tol) => {
    const C = p => [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5];
    const d2s = (qx, qy, ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay, l = ex * ex + ey * ey, t = l ? Math.max(0, Math.min(1, ((qx - ax) * ex + (qy - ay) * ey) / l)) : 0; return Math.hypot(qx - ax - t * ex, qy - ay - t * ey); };
    const legs = (a, b, df) => { const ex = b[0] - a[0], ey = b[1] - a[1], d = Math.min(Math.abs(ex), Math.abs(ey)); return [a, df ? [a[0] + Math.sign(ex) * d, a[1] + Math.sign(ey) * d] : [b[0] - Math.sign(ex) * d, b[1] - Math.sign(ey) * d], b]; };
    const fits = (i, j) => { for (const df of [true, false]) { const Lg = legs(C(cur[i]), C(cur[j]), df); let ok = true; for (let k = i + 1; k < j && ok; k++) if (Math.min(d2s(cur[k][0], cur[k][1], Lg[0][0], Lg[0][1], Lg[1][0], Lg[1][1]), d2s(cur[k][0], cur[k][1], Lg[1][0], Lg[1][1], Lg[2][0], Lg[2][1])) > tol) ok = false; if (ok) return Lg; } return null; };
    const route = [C(cur[0])], at = [0];
    for (let i = 0; i < cur.length - 1;) {
      let j = i + 1, best = legs(C(cur[i]), C(cur[j]), true);
      for (let t = i + 2; t < cur.length; t++) { const Lg = fits(i, t); if (!Lg) break; j = t; best = Lg; }
      if (best[1][0] !== best[0][0] || best[1][1] !== best[0][1]) { route.push(best[1]); at.push((i + j) / 2); }
      route.push(best[2]); at.push(j);
      i = j;
    }
    // half-cell steps, each with its fraction along the curve (widths taper by it)
    const out = [[...route[0], 0]];
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, (at[i - 1] + (at[i] - at[i - 1]) * k / n) / (cur.length - 1)]);
    }
    return out;
  };
  // a wandering curve from (x, y) heading phi (radians off the axis), len cells
  const wander = (x, y, phi, len, seed) => {
    const cur = [[x, y]];
    for (let s = 0.5; s <= len; s += 0.5) {
      const f = phi + 0.42 * Math.sin(s / 9 + seed * 2.1) * Math.min(1, s / 10) + 0.16 * Math.sin(s / 3.7 + seed * 1.3);
      x += (dx * Math.cos(f) + px * Math.sin(f)) * 0.5; y += (dy * Math.cos(f) + py * Math.sin(f)) * 0.5;
      if (!inBounds(Math.round(x), Math.round(y))) break;
      cur.push([x, y]);
    }
    return cur;
  };
  const chans = []; // { line: [[x, y, frac]], w0, w1, phi }
  const n = Math.max(2, DELTA.arms), rwA = Math.max(1.6, RIVER.rw * 0.5);
  for (let j = 0; j < n; j++) {
    const th = DELTA.spread * 0.82 * (2 * j / (n - 1) - 1) + (hash(j, 7, 1501) - 0.5) * 0.16;
    const len = (Uc / Math.cos(th)) * (0.92 + 0.2 * hash(j, 8, 1501)) + DELTA.out * (0.5 + 0.5 * hash(j, 9, 1501));
    const cur = wander(A[0], A[1], th, len, j + 1);
    if (cur.length > 4) chans.push({ line: octRoute(cur, 1.5), w0: rwA, w1: 1.4, phi: th });
  }
  const arms = chans.length;
  for (let k = 0; k < DELTA.creeks && arms; k++) {
    const arm = chans[Math.floor(hash(k, 1, 1502) * arms)], f = 0.3 + 0.5 * hash(k, 2, 1502);
    const p = arm.line[Math.floor(f * (arm.line.length - 1))], side = hash(k, 3, 1502) < 0.5 ? -1 : 1;
    const cur = wander(p[0], p[1], arm.phi + side * (0.45 + 0.4 * hash(k, 4, 1502)), 8 + 16 * hash(k, 5, 1502), 10 + k);
    if (cur.length > 4) chans.push({ line: octRoute(cur, 1.5), w0: 1.1, w1: 0.8, phi: 0 });
  }
  // stamp: per cell the nearest (distance - half-width) over every channel
  const near = new Map(); // cell -> distance past a channel's edge (<= 0 inside)
  for (const ch of chans)
    for (const [x0, y0, fr] of ch.line) {
      const w = ch.w0 + (ch.w1 - ch.w0) * fr, r = Math.ceil(w + 3);
      for (let x = Math.floor(x0 - r); x <= Math.ceil(x0 + r); x++)
        for (let y = Math.floor(y0 - r); y <= Math.ceil(y0 + r); y++) {
          if (!inBounds(x, y)) continue;
          const e = Math.hypot(x + 0.5 - x0, y + 0.5 - y0) - w, c = x * N + y;
          if (e < (near.get(c) ?? Infinity)) near.set(c, e);
        }
    }
  // the fan and its sides
  const stats = { channel: 0, bank: 0, marsh: 0, sand: 0, lagoon: 0, bars: 0, shallows: 0, eased: 0, held: 0 };
  const ends = chans.slice(0, arms).map(ch => ch.line[ch.line.length - 1]);
  const set = (c, h, k) => { H[c] = h; deltaCell[c] = k; };
  for (let x = bx0; x <= bx1; x++)
    for (let y = by0; y <= by1; y++) {
      const c = x * N + y, u = (x + 0.5 - A[0]) * dx + (y + 0.5 - A[1]) * dy, v = (x + 0.5 - A[0]) * px + (y + 0.5 - A[1]) * py;
      if (dP[bi(x, y)] === 0 || u > U + 2 || u < -12) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL, lo = floorAt(x, y);
      const wU = RIVER.rw + Math.max(0, u) * tanS * (1 + 0.18 * fbm2(wx / 700 + 5, wy / 700 - 11, 2));
      const e = u < 0 ? Math.hypot(u, Math.max(0, Math.abs(v) - RIVER.rw)) : Math.abs(v) - wU; // cells outside the fan
      const ch = riverCell[c] && u >= 0 && u <= U ? Math.min(0, near.get(c) ?? 0) : near.get(c) ?? Infinity; // the river's own stem in the fan is a channel too
      if (u > U || u < 0 ? !(ch <= 0 && u >= 0) : e > 0 && ch > 0) {
        // the sides: ease up to the old ground on the river's valley profile (cut only)
        if (e < 60 && !riverCell[c]) { const t = Math.max(lo, SEA + 2 + Math.floor(valleyRise(Math.max(0, e)))); if (H[c] > t) { H[c] = t; stats.eased++; } }
        continue;
      }
      const f = Math.max(0, Math.min(1, u / Uc)), nI = fbm2(wx / 520 + 71, wy / 520 - 33, 3), nS = fbm2(wx / 170 - 5, wy / 170 + 19, 2);
      // what the delta wants here
      let t, k;
      if (ch <= 0) { t = SEA - 2 - (ch < -1 ? 1 : 0) - (ch < -2.5 ? 1 : 0); k = 1; } // a channel, deepest mid-stream
      else if (ch < 1.5 && ch > 0.3 && u > Uc * 0.8 && H[c] <= SEA - 1) { t = SEA + 1; k = 2; } // levees: thin sand banks running out into open water
      else if (u > Uc * 0.8 && H[c] <= SEA - 1) { // the sea: lobes of shallows round the arm mouths, a bar ring on each
        const r = Math.min(...ends.map(([ex, ey]) => Math.hypot(x + 0.5 - ex, y + 0.5 - ey))) / (1 + 0.25 * nS);
        if (r > 13) continue;
        if (r > 3 && r < 6.5 && nS > -0.1) { t = SEA + 1; k = 2; } else { t = Math.max(H[c], SEA - 2 - Math.floor(r / 3.5)); k = 4; }
      } else if (ch < 1.5) { t = SEA + 1; k = 2; } // sand along the channels
      else if (nI < -0.32 && u > 8) { t = SEA - 1 - (nI < -0.45 ? 1 : 0); k = 4; } // a lagoon
      else { t = SEA + 1 + (nI > 0.02 ? 1 : 0) + (nI > 0.32 ? 1 : 0) + (f < 0.35 ? 1 : 0); k = t >= SEA + 2 || nS > 0.25 ? 3 : 2; }
      if (lo > t) { // near something that stays: come down to it on the valley profile instead
        if (H[c] > lo) { H[c] = lo; stats.eased++; }
        stats.held++;
        continue;
      }
      if (k === 1) { riverCell[c] = 1; riverLevel[c] = SEA - 1; noSmooth[c] = 1; keepOut[c] = 1; set(c, Math.min(H[c], t), 1); stats.channel++; }
      else if (riverCell[c]) continue;
      else { set(c, t, k); if (k === 2 && ch < 1.5) keepOut[c] = 1; stats[k === 3 ? 'marsh' : k === 4 ? (u > Uc ? 'shallows' : 'lagoon') : ch < 1.5 ? 'bank' : u > Uc ? 'bars' : 'sand']++; }
      riverBankL[c] = SEA - 1;
    }
  const W = (x, y) => `${Math.round((x - town.fx - TOWN.cells / 2) * CELL)},${Math.round((y - town.fy - TOWN.cells / 2) * CELL)}`; // final (town-centred) coords
  console.error(`delta: apex ${W(A[0], A[1])} (${run.toFixed(0)} cells up the course), axis ${dx.toFixed(2)},${dy.toFixed(2)}, coast ${Uc} cells out, ${arms} arms + ${chans.length - arms} creeks, ${JSON.stringify(stats)}`);
  return { A, dx, dy, Uc, U, chans };
})();
stage('weirs');
// ------------------------------------------------------------ rock weirs --
// (owner 2026-10-13: "use [rocks] as a natural wall to lower and raise water levels that
// stray too much") wherever the river's level steps down from one cell to the next, a
// ridge of boulders (rocks.mjs) runs across the channel on that line, from the low bed up
// past the upper water, and into both banks, so a step reads as a rock weir, not a cut.
// Not next to roads, bridges or in town. Cells under it get no smoothing, plants or trees.
// (2026-10-21) the river now falls a brick at a time (river.stepEvery): every step gets a
// foam cascade (rapids, drawn after the weir rocks) on its lower cell and only some
// (river.rockChance) a boulder poking out of it; no rock walls into the banks.
const rapids = [];
if (tune('river.weirs', 1, 'boulders and foam where the river level steps down (0 = off)')) {
  const rockChance = tune('river.rockChance', 0.2, 'share of river step cells with a boulder');
  const nearRoad = (x, y) => { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (inBounds(x + a, y + b) && (pathCell[(x + a) * N + y + b] || deck[(x + a) * N + y + b])) return true; return false; };
  const foam = new Uint8Array(N * N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y;
      if (!riverCell[c] || townKind[c]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (x + dx) * N + y + dy;
        if (!inBounds(x + dx, y + dy) || !riverCell[n] || riverLevel[n] >= riverLevel[c] || townKind[n]) continue;
        if (nearRoad(x, y) || hash(x, y, 731) >= rockChance) { if (!foam[n]) { foam[n] = 1; rapids.push({ x: x + dx, y: y + dy, dx, dy }); } continue; }
        weirs.push({ x, y, dx, dy });
        weirCell[c] = weirCell[n] = 1;
      }
    }
  for (let c = 0; c < N * N; c++) if (weirCell[c]) { noSmooth[c] = 1; keepOut[c] = 1; }
  console.error(`river weirs: ${weirs.length} boulder steps, ${rapids.length} foam cells`);
}
riverDiag('after cap');

stage('cutWalls');
// ---------------------------------------------------- road cutting walls --
// (2026-10-21, owner screenshot of a road cut through a ridge: sheer wedge-smoothed walls,
// a tunnel ceiling skin floating over an open cell: "fix this with arches and rough walls")
// Ground standing CUT.min+ bricks over a graded road within CUT.reach cells of it comes down
// to the road and becomes a rock wall instead (rocks.mjs voxels, 'cutRocks'): its old height
// is the rock's top, its face toward the road rough and leaning back. Natural rock arches
// span the deep cuts and every tunnel mouth (built with the walls).
const CUT = {
  min: tune('cut.min', 3, 'bricks over the road that make a cut wall rock'),
  reach: tune('cut.reach', 3, 'cells from the road a cut wall reaches'),
  archMin: tune('cut.archMin', 6, 'bricks deep on both sides for an arch over the cut'),
  archGap: tune('cut.archGap', 10, 'road samples between arches'),
  archChance: tune('cut.archChance', 0.6, 'share of deep-cut spots with an arch (tunnel mouths always)'),
  clear: tune('cut.clear', 96, 'arch clearance over the road (units)'),
};
const cutRock = new Uint8Array(N * N), cutTop = new Int16Array(N * N), cutBase = new Int16Array(N * N);
const CUT_ON = !process.env.MAPGEN_NOCUT; // off = the map before cut walls (delta bases)
if (CUT_ON) {
  // a tunnel cell with nothing over its bore is an open cut
  let opened = 0;
  for (let c = 0; c < N * N; c++) {
    const zr = tunnelZ[c];
    if (zr >= 0 && H[c] < zr + TUNNEL.high + 1) { H[c] = zr; tunnelZ[c] = -1; pathCell[c] = 1; roadGraded[c] = 1; opened++; }
  }
  const road = c => roadGraded[c] && pathCell[c] && tunnelZ[c] < 0 && !deck[c] && !riverCell[c];
  const dist = new Uint8Array(N * N).fill(255), base = new Int16Array(N * N);
  let q = [];
  for (let c = 0; c < N * N; c++) if (road(c)) { dist[c] = 0; base[c] = H[c]; q.push(c); }
  for (let d = 1; d <= CUT.reach; d++) {
    const nq = [];
    for (const c of q) {
      const x = (c / N) | 0, y = c % N;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!inBounds(x + a, y + b)) continue;
        const n = (x + a) * N + y + b;
        if (dist[n] < d) continue;
        if (dist[n] === d) { base[n] = Math.min(base[n], base[c]); continue; }
        if (pathCell[n] || tunnelZ[n] >= 0) continue;
        dist[n] = d; base[n] = base[c]; nq.push(n);
      }
    }
    q = nq;
  }
  let walls = 0;
  for (let c = 0; c < N * N; c++) {
    if (dist[c] === 0 || dist[c] === 255 || H[c] - base[c] < CUT.min) continue;
    const x = (c / N) | 0, y = c % N;
    if (keepOut[c] || noSmooth[c] || riverCell[c] || deck[c] || weirCell[c] || townKind[c] || townNear[c] || terraceCell[c] || trenchCell[c] || reserved[c] || volcanoCell[c] || swampCell[c]
      || coveCell[c] || deltaCell[c] || tierMtn.cells[c] || H[c] <= SEA || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend || hengeDist(x, y) <= HENGE.blend
      || DUNGEONS.some(d => footDist(d, x, y) <= 2)) continue;
    cutRock[c] = 1; cutTop[c] = H[c]; cutBase[c] = base[c]; H[c] = base[c]; noSmooth[c] = 1; keepOut[c] = 1; walls++;
  }
  console.error(`cut walls: ${walls} rock cells, ${opened} roofless tunnel cells opened`);
}

stage('footpaths');
// -------------------------------------------------------------- footpaths --
// (2026-10-22, owner: "a second path subsystem that connects houses to roads or paths while
// going around other houses and not through them. be cautious of overlaps and height
// difference and failed placements") Every lone building (holy: houses, shops, temples, ...)
// gets a one-cell footpath from its front door to the nearest road, hamlet lane, mountain
// trail or earlier footpath (nearest buildings first, so later paths join earlier ones).
// A dry build of each building (the same build decor makes) gives its door and the cells its
// bricks stand on. Dijkstra over 4-way steps: never onto any building's bricks, around other
// lots' yards where it can, off water, rivers and their banks, bridges, cut walls, dungeons,
// the town and the hamlets; each step climbs at most foot.step bricks (the smoothing wedge over
// 2 bricks a cell is a ~31 degree slope), climbs cost steeply so paths follow the contours. If
// no such route exists one more brick is allowed and its steep steps graded (path cells off the
// lots move one brick at most); else the building is logged with what blocked it and gets none.
// footCell 1 earth, 2 flagstones on the building's own lot; claimed (reserved) in decor, after
// the caves, so the cave search is unchanged.
const footCell = new Uint8Array(N * N);
{
  // weapon shops' wares: armories sell higher tiers the further out they stand, gunsmiths every gun;
  // temples and shrines, each to its own god (gods.json lists them)
  const WSHOP_TIERS = [['steel', 'black'], ['mithril', 'adamant'], ['adamant', 'rune']];
  const WSHOP_GUNS = ['derringer', 'revolver', 'huntingshotgun', 'leveraction', 'boltaction', 'magnum'];
  holy.filter(v => v.kind === 'armory').sort((a, b) => townDist(a.x, a.y) - townDist(b.x, b.y)).forEach((v, k) => {
    v.wares = WSHOP_TIERS[Math.min(k, WSHOP_TIERS.length - 1)].flatMap(t => [`${t}_dagger`, t, `${t}_longsword`].map(tier => ({ tier })));
  });
  for (const v of holy) if (v.kind === 'gunsmith') v.wares = WSHOP_GUNS.map(g => ({ tier: g, prefab: 'gun_' + g }));
  for (const v of holy) if (v.kind === 'temple' || v.kind === 'shrine') v.god = makeGod(v.seed, townRnd);
}
if (tune('foot.on', 1, 'footpaths from the lone buildings to the roads (0 = none)')) {
  const STEP = tune('foot.step', 2, 'most bricks a footpath climbs between cells');
  const REACH = tune('foot.reach', 90, 'longest footpath, cells');
  // the cells each building's bricks stand on (low bricks only: walking under an eave is fine)
  const occ = new Int16Array(N * N), lotOf = new Int16Array(N * N);
  const doors = [];
  holy.forEach((v, k) => {
    for (let x = v.x - v.r; x <= v.x + v.r; x++) for (let y = v.y - v.r; y <= v.y + v.r; y++) if (inBounds(x, y) && reserved[x * N + y]) lotOf[x * N + y] = k + 1;
    const dry = makeBuilder();
    const st = buildTown({ put: (br, x, y, z) => dry.add({ ...br, position: [x, y, z] }, br.asset ?? 'box'), free: (x0, y0, z0, x1, y1, z1) => dry.free([x0, y0, z0], [x1, y1, z1]),
      orientFor, rnd: townRnd, plan: null, single: { type: v.kind, seed: v.seed, god: v.god, facing: v.facing, wares: v.wares } });
    let real = 0;
    for (const b of dry.bricks) {
      if (b.ghost) continue; // legacy buildings: never in the world
      real++;
      const [lo, hi] = worldBox(b, BUILDER_FIXED);
      if (hi[2] <= 0 || lo[2] >= 40) continue;
      // local units from the lot cell's low corner (decor's wrap origin)
      for (let i = Math.floor((lo[0] + 2) / CELL); i <= Math.floor((hi[0] - 2) / CELL); i++)
        for (let j = Math.floor((lo[1] + 2) / CELL); j <= Math.floor((hi[1] - 2) / CELL); j++)
          if (inBounds(v.x + i, v.y + j)) occ[(v.x + i) * N + v.y + j] = k + 1;
    }
    doors.push({ v, k, door: st.door, real });
  });
  // near another building's bricks (one cell round them): dearer, so paths keep a little off walls
  const nearOcc = new Int16Array(N * N);
  for (let x = 1; x < N - 1; x++) for (let y = 1; y < N - 1; y++) {
    const o = occ[x * N + y];
    if (o) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (!occ[(x + a) * N + y + b]) nearOcc[(x + a) * N + y + b] = o;
  }
  const dungeonNear = new Uint8Array(N * N); // 0 unknown, 1 clear, 2 too near a dungeon
  const target = c => {
    const x = (c / N) | 0, y = c % N;
    if (footCell[c] === 1 || footCell[c] === 3) return true;
    if (villagePaved[c] || tierMtn.trail[c]) return true;
    return !!pathCell[c] && tunnelZ[c] < 0 && !deck[c] && !riverCell[c] && !weirCell[c] && !cutRock[c] && H[c] > SEA + 1 && inBounds(x, y);
  };
  // why a cell is off limits ('' = open ground); a building that gets no path logs the tally
  const blockedBy = c => {
    const x = (c / N) | 0, y = c % N;
    if (occ[c]) return 'building';
    if (H[c] <= SEA + 1) return 'water';
    if (pathCell[c]) return 'tunnel/bridge road';
    if (footCell[c] === 2 || footCell[c] === 4) return 'other lot flags';
    if (riverCell[c] || deck[c] || weirCell[c]) return 'river';
    if (cutRock[c]) return 'cut wall';
    if (swampCell[c] || volcanoCell[c] || trenchCell[c] || coveCell[c] || deltaCell[c] || tunnelZ[c] >= 0) return 'swamp/volcano/trench/coast';
    if (keepOut[c]) return 'keepOut';
    if (townKind[c] || townNear[c]) return 'town';
    if (terraceCell[c] || villageDist(x, y) <= VILLAGE.r) return 'hamlet';
    if (tierMtn.cells[c]) return 'tier mountain';
    if (reserved[c] && !lotOf[c]) return 'ruins/camp/outpost'; // reserved but no building's lot
    if (hengeDist(x, y) <= 1) return 'henge';
    if (!dungeonNear[c]) dungeonNear[c] = DUNGEONS.some(d => footDist(d, x, y) <= 2) ? 2 : 1;
    return dungeonNear[c] === 2 ? 'dungeon' : '';
  };
  const passable = c => !blockedBy(c);
  // binary heap of [cost, cell]
  const heap = [], push = (f, c) => { heap.push([f, c]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const W = 2 * REACH + 1, cost = new Float64Array(W * W), from = new Int32Array(W * W);
  const route = (s, own, step, why = null) => {
    const sx = (s / N) | 0, sy = s % N;
    const li = c => { const x = ((c / N) | 0) - sx + REACH, y = (c % N) - sy + REACH; return x < 0 || y < 0 || x >= W || y >= W ? -1 : x * W + y; };
    cost.fill(Infinity); heap.length = 0;
    cost[li(s)] = 0; from[li(s)] = -1; push(0, s);
    while (heap.length) {
      const [f, c] = pop(), lc = li(c);
      if (f > cost[lc]) continue;
      if (c !== s && target(c)) { const out = []; for (let q = from[lc]; q !== -1 && q !== s; q = from[li(q)]) out.push(q); out.reverse(); return { cells: [s, ...out], end: c }; }
      const x = (c / N) | 0, y = c % N, p = from[lc];
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inBounds(x + a, y + b)) continue;
        const n = (x + a) * N + y + b, ln = li(n);
        if (ln < 0) { if (why) why.reach = (why.reach ?? 0) + 1; continue; }
        const dh = Math.abs(H[n] - H[c]);
        if (dh > step) { if (why) why.step = (why.step ?? 0) + 1; continue; }
        const goal = target(n);
        if (!goal) { const k = blockedBy(n); if (k) { if (why) why[k] = (why[k] ?? 0) + 1; continue; } }
        let g = cost[lc] + 1 + dh * (1 + dh * 2) + hash(x + a, y + b, 2401) * 0.25; // a 1-brick step costs 3 cells, 2 bricks 10, 3 bricks 21
        if (!goal) {
          if (lotOf[n] && lotOf[n] !== own) g += 5; // through another lot's yard
          if (nearOcc[n] && nearOcc[n] !== own) g += 2; // hugging another building's wall
        }
        if (p >= 0 && ((p / N) | 0) - x !== -a && (p % N) - y !== -b) g += 0.35; // a turn
        if (g < cost[ln]) { cost[ln] = g; from[ln] = c; push(g, n); }
      }
    }
    return null;
  };
  const tally = { laid: 0, joined: { road: 0, footpath: 0, lane: 0, trail: 0 }, steep: 0, graded: 0, cells: 0, failed: 0, ghost: 0, atRoad: 0 };
  doors.sort((p, q) => pathDist[p.v.x * N + p.v.y] - pathDist[q.v.x * N + q.v.y]);
  for (const { v, k, door, real } of doors) {
    const own = k + 1, tag = `${v.kind}@${v.x},${v.y}`;
    if (!real) { tally.ghost++; continue; }
    const [fx, fy] = v.facing;
    // out of the door (or the middle, if the type keeps no door) along the facing, past the building's own bricks
    let x = v.x + Math.floor(((door?.[0] ?? CELL / 2) + fx * CELL / 2) / CELL), y = v.y + Math.floor(((door?.[1] ?? CELL / 2) + fy * CELL / 2) / CELL);
    for (let i = 0; i < v.r + 4 && inBounds(x, y) && occ[x * N + y] === own; i++) { x += fx; y += fy; }
    const s = x * N + y;
    if (!inBounds(x, y) || occ[s]) { tally.failed++; console.error(`footpaths: ${tag} no free ground at the door`); continue; }
    if (target(s)) { tally.atRoad++; continue; }
    if (!passable(s) && !lotOf[s]) { tally.failed++; console.error(`footpaths: ${tag} the door opens onto blocked ground`); continue; }
    let r = route(s, own, STEP);
    const relaxed = !r;
    if (!r) r = route(s, own, STEP + 1);
    if (!r) {
      const why = {}; route(s, own, STEP + 1, why);
      tally.failed++; console.error(`footpaths: ${tag} no route within ${REACH} cells; blocked by ${JSON.stringify(why)}`); continue;
    }
    const cells = [...r.cells, r.end], h0 = cells.map(c => H[c]);
    if (relaxed) {
      // a route that needed one brick more: grade its steep steps, each free cell (not on the
      // building's lot, not the road it joins) by one brick at most
      for (let pass = 0; pass < 3; pass++)
        for (let i = 1; i < cells.length - 1; i++) {
          const c = cells[i];
          if (lotOf[c]) continue;
          const lo = Math.max(H[cells[i - 1]], H[cells[i + 1]]) - STEP, hi = Math.min(H[cells[i - 1]], H[cells[i + 1]]) + STEP;
          const want = Math.max(lo, Math.min(hi, H[c]));
          if (lo <= hi && want !== H[c] && Math.abs(want - h0[i]) <= 1) H[c] = want;
        }
      const graded = cells.filter((c, i) => H[c] !== h0[i]).length;
      tally.graded += graded;
      if (cells.some((c, i) => i && Math.abs(H[c] - H[cells[i - 1]]) > STEP)) tally.steep++;
    }
    // check before laying: no cell on a building, no climb over the limit, every step 4-way
    const bad = cells.findIndex((c, i) => (i < cells.length - 1 && occ[c]) || (i && (Math.abs(H[c] - H[cells[i - 1]]) > STEP + 1 || Math.abs(((c / N) | 0) - ((cells[i - 1] / N) | 0)) + Math.abs((c % N) - (cells[i - 1] % N)) !== 1)));
    if (bad >= 0) { cells.forEach((c, i) => { H[c] = h0[i]; }); tally.failed++; console.error(`footpaths: ${tag} route failed its check at step ${bad}`); continue; }
    const drive = GTA && DRIVE_KINDS.has(v.kind); // (2026-10-25) houses: a concrete driveway (3 off the lot, 4 on it)
    for (const c of r.cells) footCell[c] = lotOf[c] === own ? (drive ? 4 : 2) : drive ? 3 : 1;
    tally.laid++; tally.cells += r.cells.length;
    tally.joined[footCell[r.end] === 1 || footCell[r.end] === 3 ? 'footpath' : villagePaved[r.end] ? 'lane' : pathCell[r.end] ? 'road' : 'trail']++;
  }
  console.error(`footpaths: ${JSON.stringify(tally)} of ${holy.length} lone buildings`);
}

if (process.env.MAPGEN_HDUMP) fs.writeFileSync(process.env.MAPGEN_HDUMP, Buffer.from(H.buffer, H.byteOffset, H.byteLength));
stage('voxels');
// ----------------------------------------------------------------- voxels --
const V = new Uint8Array(N * N * NZ);
const vi = (x, y, z) => (x * N + y) * NZ + z;
const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const hAt = (x, y) => H[Math.min(N - 1, Math.max(0, x)) * N + Math.min(N - 1, Math.max(0, y))];

stage('desertGround');
// ----------------------------------------------------------------- desert --
// (the desert's site and its levelling moved up, before the hamlets: see 'desert site')
for (const v of villages) v.desert = desertW(v.x, v.y) > 0.5;

// wild grass (2026-10-22): the family follows what grows there (groundCover's own forest and
// meadow fields: dark under the woods, bright in the flower meadows), a slow warm/cool drift,
// height (cooler and bluer up high) and damp ground by the river and the shore; the lightness
// mottles at a finer grain. Edges between families are dithered a few cells wide, not banded.
const grassAt = (x, y, h, wx, wy) => {
  const forest = fbm2(wx / 1500, wy / 1500, 2), meadow = fbm2(wx / 700 + 300, wy / 700 - 40, 3);
  const drift = fbm2(wx / 1300 + 41, wy / 1300 - 17, 3);
  const alt = smooth(SEA + 30, SEA + 75, h), damp = Math.max(1 - smooth(4, 16, riverD[x * N + y]), 1 - smooth(SEA + 2, SEA + 6, h));
  const r = hash(x, y, 2201), band = (v, at, w) => r < smooth(at - w, at + w, v); // dithered threshold
  let fam = 1;
  if (band(drift, 0.22, 0.12)) fam = 3;
  else if (band(-drift, 0.22, 0.12)) fam = 4;
  if (band(alt + damp * 0.8, 0.6, 0.2)) fam = 4;
  if (band(meadow, 0.12, 0.06)) fam = drift > 0.3 ? 3 : 2;
  if (band(forest, 0.08, 0.05)) fam = 0;
  const lt = (fbm2(wx / 240 + 5, wy / 240 - 11, 2) + 1) * 2 + (hash(x, y, 2202) - 0.5) * 0.7 + alt * 0.6 - damp * 0.5;
  return GRASS_TONES[fam][Math.max(0, Math.min(3, Math.floor(lt)))];
};

for (let x = 0; x < N; x++)
  for (let y = 0; y < N; y++) {
    const h = H[x * N + y];
    const wx = X0 + x * CELL, wy = Y0 + y * CELL;
    let slope = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) slope = Math.max(slope, Math.abs(hAt(x + dx, y + dy) - h));
    const shade = Math.floor((fbm2(wx / 900 + 7, wy / 900, 2) + 1) * 1.5) % 3;
    const nearWater = h <= SEA + 1;
    let dw = 0, sw = 0, shw = 0;
    const plaza = false; // dungeons are buried now: no paved plazas
    let top, sub;
    if (plaza) [top, sub] = [PLAZA, STONE];
    else if (coveCell[x * N + y] === 1) [top, sub] = [MOSSBED[shade % 2], STONE];
    else if (coveCell[x * N + y] === 4) [top, sub] = [SHALLOWS, SAND];
    else if (coveCell[x * N + y] === 2) [top, sub] = [SAND, SAND];
    else if (coveCell[x * N + y] === 3) [top, sub] = [GRASS[shade], CLIFF[0]];
    else if (deltaCell[x * N + y] === 1) [top, sub] = [SILT, MUD];
    else if (deltaCell[x * N + y] === 4) [top, sub] = [h <= SEA - 3 ? SILT : SHALLOWS, SAND];
    else if (deltaCell[x * N + y] === 2) [top, sub] = [h <= SEA + 1 && hash(x, y, 1503) < 0.35 ? WETSAND : SAND, SAND];
    else if (deltaCell[x * N + y] === 3) [top, sub] = [MARSH[Math.floor((fbm2(wx / 240 + 9, wy / 240 - 4, 2) + 1) * 1.5 + hash(x, y, 1504) * 0.8) % 3], MUD];
    else if (riverCell[x * N + y]) [top, sub] = [GRAVEL, STONE];
    else if (villagePaved[x * N + y]) [top, sub] = [COBBLE, STONE];
    else if (swampCell[x * N + y]) [top, sub] = [h < SEA ? POOL_BED : fbm2(wx / 300 + 5, wy / 300) > 0.1 ? MUCK : MUD, MUD];
    else if (townKind[x * N + y]) [top, sub] = townKind[x * N + y] === 1 ? [TOWN_GRASS[Math.floor((fbm2(wx / 260 + 3, wy / 260 - 9, 2) + 1) * 1.6 + hash(x, y, 619) * 1.2) % TOWN_GRASS.length], DIRT] : [COBBLE, STONE]; // finer mottling at spawn (2026-10-14)
    else if (keepOut[x * N + y] && !pathCell[x * N + y] && !tierMtn.cells[x * N + y] && h <= riverLevelNear(x, y) + 1) [top, sub] = [SAND, DIRT]; // (2026-10-22) not the tier corners: sand specks on the snow
    else if (hengeDist(x, y) <= 0) [top, sub] = [Math.hypot(x - henge.x0 - (henge.n >> 1), y - henge.y0 - (henge.n >> 1)) < 6.5 ? DIRT : GRASS[shade], DIRT];
    else if (pathCell[x * N + y] && h > SEA + 1 && (slope < 4 || roadGraded[x * N + y])) [top, sub] = [volcanoCell[x * N + y] === 2 ? GRAVEL : PATH, DIRT];
    else if (tierMtn.trail[x * N + y] && !pathCell[x * N + y]) [top, sub] = [PATH, DIRT]; // the tiered mountains' trail
    else if (footCell[x * N + y] >= 3) [top, sub] = [DRIVE[(x + y) & 1], STONE]; // the houses' concrete driveways
    else if (footCell[x * N + y]) [top, sub] = [footCell[x * N + y] === 2 ? FOOTFLAG[(x + y) & 1] : desertW(x, y) > 0.3 ? FOOTSAND : FOOTPATH[Math.floor(hash(x, y, 2301) * 3)], DIRT]; // footpaths
    else if (volcanoCell[x * N + y] === 3) [top, sub] = [LAVA, BASALT[1]];
    else if (volcanoCell[x * N + y]) [top, sub] = [slope < 3 && fbm2(wx / 500 + 3, wy / 500 + 8, 2) > 0.05 ? ASH : BASALT[shade & 1], BASALT[1]];
    else if (h < SEA - 1) [top, sub] = [h < SEA - 6 ? GRAVEL : SAND, SAND];
    else if (nearWater) [top, sub] = [SAND, SAND];
    else if ((dw = desertW(x, y)) > 0.55 || (dw > 0.3 && hash(x, y, 77) < (dw - 0.3) / 0.25))
      [top, sub] = slope >= 4 || h > 96 ? [MESA[shade & 1], MESA[shade & 1]] : [DUNE[shade & 1], DUNE[0]];
    else if (dw > 0.12 && hash(x, y, 78) < (dw - 0.12) / 0.2 && slope < 4 && h <= 96) [top, sub] = [DRYGRASS, DIRT];
    else if (deathW[x * N + y] > 0.5 || (deathW[x * N + y] > 0.15 && hash(x, y, 461) < (deathW[x * N + y] - 0.15) / 0.35))
      [top, sub] = slope >= 5 ? [DEADROCK[shade & 1], DEADROCK[1]] : fbm2(wx / 380 + 61, wy / 380 - 7, 2) > 0.22 ? [ROT, DEADSOIL] : [DEADGRASS[shade], DEADSOIL];
    else if ((sw = Math.max(snowW(x, y), nordicSnowW(x, y))) > 0.55 || (sw > 0.25 && hash(x, y, 412) < (sw - 0.25) / 0.3)) [top, sub] = slope >= 7 && h > SEA + 6 ? [ROCK[shade & 1], ROCK[shade & 1]] : [SNOW, ROCK[0]];
    else if (h > 118 + noise2(wx / 400, wy / 400) * 8) [top, sub] = [SNOW, ROCK[0]];
    else if ((shw = shrubW(x, y)) > 0.5 || (shw > 0.15 && hash(x, y, 432) < (shw - 0.15) / 0.35)) [top, sub] = slope >= 4 ? [ROCK[shade & 1], ROCK[shade & 1]] : [SCRUB[shade & 1], DIRT];
    else if (slope >= 4 || h > 96) [top, sub] = [ROCK[shade & 1], ROCK[shade & 1]];
    else [top, sub] = [grassAt(x, y, h, wx, wy), DIRT];
    surfaceMat[x * N + y] = top;
    // a terrace stepping down 2+ bricks to a neighbour: masonry down the exposed face
    let wallFrom = h;
    if (terraceCell[x * N + y]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (h - hAt(x + dx, y + dy) >= 2) wallFrom = Math.min(wallFrom, hAt(x + dx, y + dy) + 1);
    for (let z = 0; z <= h; z++) {
      let m;
      if (z < 2) m = BEDROCK;
      else if (z === h) m = top;
      else if (z >= wallFrom) m = WALLSTONE[z & 1];
      else if (coveCell[x * N + y] === 3 && z >= SEA - 2) m = CLIFF[(Math.floor(z / 3) + Math.floor(hash(x, y, 820) * 3) + Math.floor(fbm2(x / 3, z / 5, 2) * 2.5)) % CLIFF.length]; // sheer striped cove cliffs
      else if (z >= h - 3) m = sub;
      else if (z < 20) m = DEEP;
      else m = STONE;
      V[vi(x, y, z)] = m;
    }
    // no water bricks: the environment water plane fills the sea
  }

stage('tunnels');
// ---------------------------------------------------------------- tunnels --
// road tunnels (see the roads): clear TUNNEL.high bricks over the road level,
// path floor
let tunnelCells = 0;
for (let c = 0; c < N * N; c++) {
  const zr = tunnelZ[c];
  if (zr < 0) continue;
  const x = (c / N) | 0, y = c % N;
  V[vi(x, y, zr)] = PATH;
  for (let z = zr + 1; z <= zr + TUNNEL.high && z < NZ; z++) V[vi(x, y, z)] = 0;
  tunnelCells++;
}
console.error(`tunnels: ${tunnelCells} cells`);

stage('sewers');
// ----------------------------------------------------------------- sewers --
// (owner 2026-10-12: "make towns have layered heights, with retaining walls
// and sewers") Brick tunnels under every town path: a sludge channel a brick
// down between stone walks, red-brick walls, a tile vault and lamps; a
// pillared cistern under the square; the kiosks' stair shafts (town.mjs
// sewerKiosk) and a passage from each to the nearest tunnel. Smashable pots
// on the walks.
const sewerPots = [];
{
  const SF = SEWER.floor, TOP = SF + SEWER.high + 1, CIST = PLAZA_R - 40;
  const lines = townPlan.paths.map(p => p.filter(([ux, uy]) => Math.hypot(ux, uy) < townPlan.edgeR(ux, uy) - 220)).filter(p => p.length > 1);
  const kind = new Uint8Array(N * N); // 1 walk, 2 channel, 3 wall / pillar
  const cx0 = town.fx + TOWN.cells / 2, cy0 = town.fy + TOWN.cells / 2;
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) {
      const [ux, uy] = townLocal(x, y), r = Math.hypot(ux, uy);
      if (r <= CIST) { kind[x * N + y] = (x - cx0) % 4 === 0 && (y - cy0) % 4 === 0 && r > 80 ? 3 : 1; continue; }
      let d = Infinity;
      for (const l of lines) { d = Math.min(d, distToLine(ux, uy, l)); if (d <= 22) break; }
      kind[x * N + y] = d <= 22 ? 2 : d <= 62 ? 1 : d <= 102 || r <= CIST + 40 ? 3 : 0;
    }
  const open = (x, y, z0, z1) => { for (let z = z0; z <= z1; z++) V[vi(x, y, z)] = 0; };
  const line = (x, y, z0, z1) => { for (let z = z0; z <= z1; z++) if (V[vi(x, y, z)]) V[vi(x, y, z)] = SEWER_BRICK[z & 1]; };
  const tunnel = (x, y, channel) => {
    open(x, y, channel ? SF : SF + 1, TOP - 1);
    V[vi(x, y, channel ? SF - 1 : SF)] = channel ? SLUDGE : SEWER_WALK;
    if (V[vi(x, y, TOP)]) V[vi(x, y, TOP)] = SEWER_CEIL;
  };
  let cells = 0;
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) {
      const k = kind[x * N + y];
      if (k === 1 || k === 2) { tunnel(x, y, k === 2); cells++; }
      else if (k === 3) line(x, y, SF - 1, TOP);
    }
  // stair shafts: the 5 x 5 ring open from the floor to the top, brick-lined, a passage out the front to the tunnels
  const cellOf = (ux, uy) => [cx0 + Math.floor(ux / CELL), cy0 + Math.floor(uy / CELL)];
  for (const sh of townTrial.sewerShafts ?? []) {
    const [sx, sy] = cellOf(sh.x, sh.y);
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++) {
        const x = sx + i, y = sy + j, h = H[x * N + y], m = Math.max(Math.abs(i), Math.abs(j));
        if (m === 2) { open(x, y, SF + 1, h); V[vi(x, y, SF)] = SEWER_WALK; }
        else line(x, y, SF, h - 1); // the pillar and the shaft's outer wall
      }
    let reached = false;
    for (let k = 3; k < 16 && !reached; k++) {
      const x = sx + sh.fx * k, y = sy + sh.fy * k;
      for (let w = -1; w <= 1; w++) {
        const px = x + (sh.fy ? w : 0), py = y + (sh.fx ? w : 0);
        if (kind[px * N + py] === 1 || kind[px * N + py] === 2) { reached = true; continue; }
        tunnel(px, py, false);
        for (const e of [-2, 2]) { const qx = x + (sh.fy ? e : 0), qy = y + (sh.fx ? e : 0); if (!kind[qx * N + qy]) line(qx, qy, SF - 1, TOP); }
      }
    }
    if (!reached) console.error(`sewer: the kiosk at ${sh.x},${sh.y} found no tunnel`);
  }
  // lamps under the vault and pots on the walks
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) {
      if (kind[x * N + y] !== 1 || V[vi(x, y, SF + 1)] !== 0) continue;
      if (hash(x, y, 501) < 0.07) tunnelLights.push([x, y, SF]);
      else if (hash(x, y, 502) < 0.012) sewerPots.push([X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (SF + 1) * VZ + 12]);
    }
  console.error(`sewers: ${cells} cells, ${(townTrial.sewerShafts ?? []).length} stair kiosks, ${sewerPots.length} pots`);
}

stage('caves');
// ------------------------------------------------------------------ caves --
// Zelda-style caves: a dark doorway cut into a cliff face, a short passage,
// and one room inside the mountain. A site is a walkable cell at the foot of
// a cliff with enough rock behind it for the passage and room plus a thick
// roof. Rooms are lit by two fires and hold either an old man with a sword
// or a treasure chest.
// Since 2026-10-03 (owner: "more intricate") the room is an irregular blob up
// to 9 cells across under a domed ceiling, with a raised ledge at the back (a
// 1-brick step up), a couple of low side alcoves and a natural rock pillar;
// the interior pass adds stalactites, stalagmites and glowing crystals.
const CAVE = { door: 8, cover: 3, R: 4, depth: 3, max: Math.round(tune('caves.max', 10, 'caves (x K squared)') * K * K), spacing: Math.round(tune('caves.spacing', 34, 'min cells apart (x K)') * K) };
// 2026-10-07 (owner: "make caves kind of minecraft style"): caves.minecraft 1 =
// the door leads into winding, branching worm tunnels sloping down into the
// hill with the odd cavern, LEGO ramps on the floor and ceiling steps, torches,
// and the old man / chest at the end of the main tunnel. 0 = the Zelda room.
const MC = tune('caves.minecraft', 1, '1 = Minecraft-style tunnel systems, 0 = Zelda rooms');
const MCW = { len: Math.round(tune('caves.mcLength', 90, 'main tunnel length, cells')), branch: tune('caves.mcBranch', 0.05, 'branch chance per cell'),
  cavern: tune('caves.mcCavern', 0.04, 'cavern chance per tunnel step (domed caverns, 2026-10-16)') };
const caves = [];
let carved = 0;
{
  // cells of a cave at door cell (x, y) facing into the hill along (dx, dy):
  // [cx, cy, t (open voxels above the base), raise (floor voxels kept), k, l, role]
  const cellsOf = (x, y, dx, dy) => {
    const out = [], R = CAVE.R, kc = CAVE.depth + R - 1;
    const ph = [0, 1, 2].map(i => hash(x, y, 300 + i) * Math.PI * 2), amp = [0, 1, 2].map(i => 0.12 + 0.1 * hash(x, y, 310 + i));
    const rad = a => R * (0.78 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(5 * a + ph[2]));
    const P = (k, l) => [x + dx * k - dy * l, y + dy * k + dx * l];
    for (let k = 1; k < CAVE.depth; k++) out.push([...P(k, 0), CAVE.door, 0, k, 0, 'passage']);
    const pillarSide = hash(x, y, 320) < 0.5 ? -1 : 1, pillar = hash(x, y, 321) < 0.7 ? [kc + 1, pillarSide * 2] : null;
    for (let k = CAVE.depth; k <= kc + R + 1; k++)
      for (let l = -R - 1; l <= R + 1; l++) {
        const u = k - kc, d = Math.hypot(u, l), r = rad(Math.atan2(l, u));
        const spine = l === 0 && k <= kc;
        if (d > r && !spine) continue;
        if (pillar && k === pillar[0] && l === pillar[1]) continue; // rock left standing
        const t = Math.max(CAVE.door + 1, Math.round(9 + 5 * (1 - d / Math.max(r, 1))));
        const raise = u > r * 0.35 ? 1 : 0;
        out.push([...P(k, l), t, raise, k, l, 'room']);
      }
    // two low alcoves off the sides, just past the room's rim
    const has = (k, l) => out.some(e => e[4] === k && e[5] === l);
    for (const sg of [-1, 1]) {
      const k = kc + Math.round((hash(x, y, 330 + sg) - 0.5) * 2);
      let l = 0;
      while (has(k, l) && Math.abs(l) <= R + 1) l += sg;
      if (Math.abs(l) > R + 1 || !has(k, l - sg)) continue;
      out.push([...P(k, l), 6, 0, k, l, 'alcove']);
      if (hash(x, y, 340 + sg) < 0.6 && !has(k + 1, l)) out.push([...P(k + 1, l), 5, 0, k + 1, l, 'alcove']);
    }
    return out;
  };
  const sites = [];
  for (let x = 4; x < N - 4; x++)
    for (let y = 4; y < N - 4; y++) {
      const h = lotPre.get(x * N + y) ?? H[x * N + y];
      if (h <= SEA + 1 || !GRASS.includes(surfaceMat[x * N + y]) && !ROCK.includes(surfaceMat[x * N + y])) continue;
      if (DUNGEONS.some(d => footDist(d, x, y) <= PLAZA_RING + BLEND) || keepOut[x * N + y] || townDist(x, y) <= TOWN.blend || villageDist(x, y) <= VILLAGE.r + VILLAGE.blend || hengeDist(x, y) <= HENGE.blend + 12 || reserved[x * N + y] || siteOff(x * N + y)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if ((lotPre.get((x - dx) * N + y - dy) ?? hAt(x - dx, y - dy)) > h + 1) continue; // open ground in front of the door
        sites.push({ x, y, dx, dy, h, r: hash(x, y, 77) });
      }
    }
  // the room must sit under real hillside; the passage gets a built rock facade.
  // Checked lazily in pick order (2026-10-06, editor speed: was every candidate
  // up front) against the heights from before any facade went up: same caves.
  const H0 = H.slice(), HC = H0.slice();
  for (const [c, h] of lotPre) HC[c] = h;
  const fitsMC = ({ x, y, dx, dy, h }) => {
    for (let k = 1; k <= 12; k++) { // a real hill behind the door, or the tunnels have nowhere to go
      const cx = x + dx * k, cy = y + dy * k;
      if (!inMap(cx, cy) || HC[cx * N + cy] < h + CAVE.door + CAVE.cover + (k > 2 ? 1 : 0) + (k > 6 ? 3 : 0)) return false;
      if (townDist(cx, cy) <= TOWN.blend || DUNGEONS.some(d => footDist(d, cx, cy) <= PLAZA_RING)) return false;
    }
    return true;
  };
  const fitsZelda = ({ x, y, dx, dy, h }) => cellsOf(x, y, dx, dy).every(([cx, cy, t, , , , role]) => inMap(cx, cy) && (role === 'passage' || HC[cx * N + cy] >= h + t + CAVE.cover) &&
    HC[cx * N + cy] >= h + 2 &&
    townDist(cx, cy) > TOWN.blend && !DUNGEONS.some(d => footDist(d, cx, cy) <= PLAZA_RING));
  const fits = MC ? fitsMC : fitsZelda;
  // (2026-10-16, owner: "the limestone caves look like crap. more wedges, natural geometry, gems ...,
  // high ceilings, cavern") a cave = tunnel beads + lobed domed caverns (cavern.mjs planCave) whose
  // floor / ceiling fields (caveField, 2 x 2-stud tiles) are carved here into the coarse voxels with a
  // margin; caveProps builds the wedge surfaces, formations and gems. s.mc = { cols (cell -> carved
  // voxel range), field, caverns }
  const okCell = (cx, cy) => {
    if (cx < 2 || cy < 2 || cx >= N - 2 || cy >= N - 2) return false;
    if (townDist(cx, cy) <= TOWN.blend || villageDist(cx, cy) <= VILLAGE.r + 2 || hengeDist(cx, cy) <= 4) return false;
    if (DUNGEONS.some(d => footDist(d, cx, cy) <= 4)) return false;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (tunnelZ[(cx + a) * N + cy + b] >= 0) return false;
    return !swampCell[cx * N + cy];
  };
  // highest ceiling (world z) a cell allows: its rock roof under CAVE.cover bricks; a facade (built rock
  // face round a door) 2 bricks under its top; -Infinity = no carving
  const facades = new Set();
  const roofCell = (cx, cy) => {
    if (!inMap(cx, cy) || !okCell(cx, cy)) return -Infinity;
    const c = cx * N + cy;
    if (tierMtn.cells[c]) {
      if (mouthCells.has(c)) return H[c] * VZ; // a cave mouth's passage + the wall it opens through: 1-brick roof / lintel (5 bricks clear on a 6-brick wall)
      // any other wall face of a tier stays shut: no cave air above the shelf below it (those made 1-brick slits)
      let m = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const n = (cx + a) * N + cy + b;
        if ((a || b) && inMap(cx + a, cy + b) && tierMtn.cells[n] && H[n] <= H[c] - 2) m = Math.min(m, (H[n] - CAVE.cover + 1) * VZ);
      }
      if (m < Infinity) return Math.min(m, (Math.min(H[c], H0[c]) - CAVE.cover + 1) * VZ);
    }
    return facades.has(c) ? (H[c] - 2 + 1) * VZ : (Math.min(H[c], H0[c]) - CAVE.cover + 1) * VZ;
  };
  // tiered mountains (2026-10-21, owner: "caves arent creating entrances", then "the player cant get out ... should be
  // procedurally generated"): where a tunnel passes near a tier wall at about the height of the shelf below it, a
  // passage of door nodes (flat floor, no formations) runs from the tunnel out through the wall (mouthCells) with
  // its floor flush with the shelf (tierMouths, before the field). The shelf in front of a mouth (mouthFront) does
  // not pull the passage ceiling down; every other tier wall face stays solid.
  const mouthCells = new Set(), mouthFront = new Set();
  // roof limit at corner (x, y): next to a mouth passage cell, other tier cells (the shelf outside, the shut wall
  // faces beside it) do not pull the passage ceiling down
  const openWall = (cx, cy, x, y) => {
    if (!inMap(cx, cy)) return false;
    const gx = (x - X0) / CELL, gy = (y - Y0) / CELL, hn = H[cx * N + cy];
    for (const ox of [Math.floor(gx - 1e-6), Math.floor(gx + 1e-6)]) for (const oy of [Math.floor(gy - 1e-6), Math.floor(gy + 1e-6)])
      if (inMap(ox, oy) && mouthCells.has(ox * N + oy) && tierMtn.cells[cx * N + cy] && !mouthCells.has(cx * N + cy)) return true; // its own roof still bounds every tile
    return false;
  };
  const shelfSize = new Map();
  const openShelf = L => { // >= 40 connected cells at L's height (8-way, the corner wedges' open halves count)
    if (shelfSize.has(L)) return shelfSize.get(L);
    const h = H[L], seen = new Set([L]), q = [L];
    for (let i = 0; i < q.length && seen.size < 40; i++) {
      const x = (q[i] / N) | 0, y = q[i] % N;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const n = (x + a) * N + y + b; if (inMap(x + a, y + b) && !seen.has(n) && H[n] === h) { seen.add(n); q.push(n); } }
    }
    const ok = seen.size >= 40;
    for (const c of seen) if (seen.size < 40) shelfSize.set(c, false);
    shelfSize.set(L, ok);
    return ok;
  };
  const tierMouths = () => {
    let made = 0;
    for (const s of caves) {
      const cand = [];
      for (const nd of s.plan.nodes) {
        if (nd.door) continue;
        const ncx = Math.floor((nd.x - X0) / CELL), ncy = Math.floor((nd.y - Y0) / CELL);
        for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
          const wx = ncx + a, wy = ncy + b, W = wx * N + wy;
          if (!inMap(wx, wy) || !tierMtn.cells[W] || tierMtn.trail[W]) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const lx = wx + dx, ly = wy + dy, L = lx * N + ly;
            if (!inMap(lx, ly) || !tierMtn.cells[L] || H[L] !== H[W] - TIER.h || riverCell[L] || H[L] <= SEA) continue;
            if (!openShelf(L)) continue; // a real shelf outside, not a pocket between walls
            const top = (H[L] + 1) * VZ, mx = X0 + (wx + 0.5 + dx * 0.5) * CELL, my = Y0 + (wy + 0.5 + dy * 0.5) * CELL;
            const dist = Math.hypot(mx - nd.x, my - nd.y);
            if (dist > 280 || Math.abs(top - nd.zf) > dist * 0.4 + 12) continue;
            // the passage stays under this tier (no other wall face on the way) with rock over it
            let ok = true;
            for (let t = 0.1; ok && t < 1; t += 0.1) {
              const px = Math.floor((nd.x + (mx - nd.x) * t - X0) / CELL), py = Math.floor((nd.y + (my - nd.y) * t - Y0) / CELL), pc = px * N + py;
              if (!inMap(px, py) || (pc !== W && H[pc] < H[W]) || !okCell(px, py)) ok = false;
            }
            if (ok) cand.push({ nd, W, L, mx, my, top, dist, ncx, ncy });
          }
        }
      }
      cand.sort((p, q) => p.dist - q.dist);
      const picked = [];
      for (const c of cand) {
        if (picked.length >= 2) break;
        if (picked.some(p => Math.hypot(p.mx - c.mx, p.my - c.my) < 600)) continue;
        picked.push(c);
        const n = Math.max(2, Math.ceil(c.dist / 36));
        for (let t = 1; t <= n; t++) {
          const q = t / n;
          // a rock arch that flares wider and taller toward the wall face (ragged outline, flat floor)
          const flare = Math.max(0, (q - 0.6) / 0.4);
          s.plan.nodes.push({ x: c.nd.x + (c.mx - c.nd.x) * q, y: c.nd.y + (c.my - c.nd.y) * q, zf: Math.round(c.nd.zf + (c.top - c.nd.zf) * q), r: 50 + 14 * flare, hu: 68 + 6 * flare, door: true, arch: true });
        }
        mouthCells.add(c.W); mouthFront.add(c.L);
        for (let t = 0; t <= 1.0001; t += 0.05) { // the passage's cells (and their neighbours: its width) keep a 1-brick roof
          const px = Math.floor((c.nd.x + (c.mx - c.nd.x) * Math.min(t, 0.98) - X0) / CELL), py = Math.floor((c.nd.y + (c.my - c.nd.y) * Math.min(t, 0.98) - Y0) / CELL);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = (px + a) * N + py + b; if (inMap(px + a, py + b) && H[q] >= H[c.W]) mouthCells.add(q); }
        }
        if (process.env.CAVE_DEBUG) console.error(`tier mouth at map ${Math.round(c.mx)},${Math.round(c.my)} z ${c.top}`);
        made++;
      }
    }
    if (tierMtn.peaks.length) console.error(`tier mouths: ${made} cave mouths in tier walls`);
  };
  // planning sees the estate lots' old ground (lotPre); the field (carving) above still clamps to the lot
  const roofPlan = (cx, cy) => {
    if (!inMap(cx, cy) || !okCell(cx, cy)) return -Infinity;
    const c = cx * N + cy;
    if (!lotPre.has(c) || facades.has(c)) return roofCell(cx, cy);
    return (Math.min(H[c] === H0[c] ? HC[c] : H[c], HC[c]) - CAVE.cover + 1) * VZ;
  };
  const roofAt = (wx, wy) => roofPlan(Math.floor((wx - X0) / CELL), Math.floor((wy - Y0) / CELL));
  const floorMin = (SEA + 3) * VZ; // never under the sea plane (it floods)
  // each cave's nodes; all caves are carved as ONE field after the site loop (two caves may meet)
  const carveMC = s => {
    for (const c of s.facade) facades.add(c);
    const R0 = rng(Math.floor(hash(s.x, s.y, 501) * 4294967296));
    s.plan = planCave(s, { CELL, VZ, X0, Y0, rnd: R0, roofAt, floorMin, doorH: (s.h + 1) * VZ, doorHu: CAVE.door * VZ,
      len: Math.round(MCW.len * (0.7 + R0() * 0.6) * Math.sqrt(K) * 1.25), branch: MCW.branch, cavern: MCW.cavern });
    if (process.env.CAVE_DEBUG) console.error(`cave ${s.x},${s.y}: ${s.plan.nodes.length} nodes, ${s.plan.caverns.length} caverns (${s.plan.caverns.map(c => `R${Math.round(c.R)} h${Math.round(c.hu)} @${Math.round(c.x)},${Math.round(c.y)},${c.zf}`).join(' ')})`);
    s.mc = { cols: new Map(), field: null, caverns: s.plan.caverns };
    s.cells = [];
  };
  sites.sort((p, q) => p.r - q.r);
  for (const s of sites) {
    if (caves.length >= CAVE.max) break;
    if (caves.some(c => Math.hypot(c.x - s.x, c.y - s.y) < CAVE.spacing)) continue;
    if (!fits(s)) continue;
    // (2026-10-22, owner: "the cave faces are causing problems") no door facade on the tiered mountains: its
    // raised rock face sat on the shelves as grey blocks; caves open into tier walls through tierMouths instead
    let onTier = false;
    for (let k = -2; k <= CAVE.depth + 2 && !onTier; k++) for (let l = -4; l <= 4 && !onTier; l++) {
      const cx = s.x + s.dx * k - s.dy * l, cy = s.y + s.dy * k + s.dx * l;
      if (inBounds(cx, cy) && tierMtn.cells[cx * N + cy]) onTier = true;
    }
    if (onTier) continue;
    caves.push(s);
    // facade: the passage cells and their neighbours rise into a rock face
    s.facade = new Set();
    for (let k = 1; k < CAVE.depth; k++)
      for (let l = -2; l <= 2; l++) {
        const cx = s.x + s.dx * k - s.dy * l, cy = s.y + s.dy * k + s.dx * l;
        s.facade.add(cx * N + cy);
        const top = s.h + CAVE.door + 3 - (Math.abs(l) === 2 ? 2 : 0);
        for (let z = H[cx * N + cy] + 1; z <= top; z++) V[vi(cx, cy, z)] = ROCK[(k + l) & 1];
        if (H[cx * N + cy] < top) { H[cx * N + cy] = top; surfaceMat[cx * N + cy] = ROCK[(k + l) & 1]; }
      }
    if (MC) { const c0 = carved; carveMC(s); if (process.env.MAPGEN_CAVES) console.error(`cave ${s.x},${s.y}: ${carved - c0} voxels`); continue; }
    s.cells = cellsOf(s.x, s.y, s.dx, s.dy);
    for (const [cx, cy, t, raise] of s.cells) {
      for (let z = s.h + 1 + raise; z <= s.h + t; z++) { V[vi(cx, cy, z)] = 0; carved++; }
      V[vi(cx, cy, s.h + raise)] = GRAVEL;
    }
  }
  if (MC && caves.length) tierMouths();
  if (MC && caves.length) {
    const field = caveField(caves.flatMap(c => c.plan.nodes), { CELL, VZ, X0, Y0, N, roofCell, floorMin, noise: noise3, seed: caves[0].x * 7 + caves[0].y, openWall, debugCell: process.env.CAVE_CELL ? [process.env.CAVE_CELL.split(',').map(Number)] : null });
    for (const [c, [f, t]] of field.cells) {
      const cx = (c / N) | 0, cy = c % N;
      for (let z = f + 1; z <= t; z++) if (V[vi(cx, cy, z)]) { V[vi(cx, cy, z)] = 0; carved++; }
    }
    caves[0].mc.cols = field.cells; caves[0].mc.field = field; // (the lime pass and caveProps take it from the first cave)
    if (process.env.CAVE_DEBUG) { const g = [...field.tiles.values()].map(t => Math.min(...t.C) - Math.max(...t.F)).sort((a, b) => a - b); console.error(`caves field: ${field.tiles.size} air tiles, ${field.cells.size} cells, clear height p50/p90/max ${[0.5, 0.9, 1].map(q => g[Math.min(g.length - 1, Math.floor(q * g.length))]).join('/')}`); }
  }
  console.error(`caves: ${caves.length} of ${sites.length} candidate sites`);
  // limestone: every solid voxel next to a tunnel cave's air takes its stratum's limestone (flat
  // bands CAVE_BAND high, the same as the fine surfaces)
  let limed = 0;
  for (const c of caves) {
    if (!c.mc) continue;
    const air = (x, y, z) => { const o = c.mc.cols.get(x * N + y); return o && z > o[0] && z <= o[1]; };
    const band = (x, y, z) => LIME_OF(Math.floor(((z + 0.5) * VZ) / CAVE_BAND)); // the strata of the fine surfaces (cavern.mjs)
    for (const [cc, [f, t]] of c.mc.cols) {
      const cx = (cc / N) | 0, cy = cc % N;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const x = cx + a, y = cy + b;
        if (!inMap(x, y)) continue;
        for (let z = f; z <= t + 1; z++) {
          const v = V[vi(x, y, z)];
          if (!v || v === WATER || LIME.includes(v) || z >= H[x * N + y]) continue; // the ground's own surface keeps its colour (snow over cave mouths)
          if (air(x + 1, y, z) || air(x - 1, y, z) || air(x, y + 1, z) || air(x, y - 1, z) || air(x, y, z + 1) || air(x, y, z - 1)) { V[vi(x, y, z)] = band(x, y, z); limed++; }
        }
      }
    }
  }
  console.error(`caves: ${limed} rock voxels limestone`);
  if (process.env.MAPGEN_CAVES) console.error(`cave sites: ${caves.map(c => `${c.x},${c.y}`).join(" ")}`);
}

// clear the dungeon volumes (the ground over them stays); rock fill comes from the plan
for (const d of DUNGEONS)
  for (let x = d.fx; x < d.fx + d.cells; x++)
    for (let y = d.fy; y < d.fy + d.cells; y++)
      for (let z = BASE_VOX; z < d.topVox; z++) V[vi(x, y, z)] = 0;

// ---------------------------------------------------------------- preview --
// the editor's snapshot (preview.mjs): heights, surface colours, flags and the
// feature sites in cells; full mode adds the rasterised top of every brick
function previewOut(full) {
  const cells = (x, y) => [Math.round(x), Math.round(y)];
  const tcx = TOWN_PIN.fx + TOWN_CELLS / 2, tcy = TOWN_PIN.fy + TOWN_CELLS / 2;
  const rgb = new Uint8Array(N * N * 3), flags = new Uint8Array(N * N);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const i = x * N + y, o = y * N + x; // row-major (y rows) for the canvas
      const wet = riverCell[i] || H[i] <= SEA;
      const c = wet ? MATS[WATER].color : (MATS[surfaceMat[i]] ?? MATS[GRASS[0]]).color;
      rgb.set(c, o * 3);
      flags[o] = (riverCell[i] ? 1 : 0) | (roadGraded[i] ? 2 : 0) | (swampCell[i] ? 4 : 0) | (trenchCell[i] ? 8 : 0) |
        (tunnelZ[i] >= 0 ? 16 : 0) | (desertW(x, y) > 0.5 ? 32 : 0) | (keepOut[i] ? 64 : 0) |
        (pathCell[i] || villagePaved[i] || townKind[i] === 2 ? 128 : 0); // anything you ride on (bmxcheck.mjs)
    }
  const Hr = new Int16Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) Hr[y * N + x] = H[x * N + y];
  const header = {
    seed: SEED, scale: K, N, CELL, VZ, X0, Y0, SEA, waterZ: WATER_Z, stage: full ? 'full' : 'sites', ms: Date.now() - T0,
    shift: [-(X0 + (town.fx + TOWN.cells / 2) * CELL), -(Y0 + (town.fy + TOWN.cells / 2) * CELL)],
    params: TUNED, stages: stageLog(),
    features: {
      spine: ISLAND.spine.map(([a, b]) => [tcx + a, tcy + b]), half: ISLAND.half,
      spinePts: spine.pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2), +p[3].toFixed(1)]), sTown: spine.sTown, L: spine.L,
      town: { fx: town.fx, fy: town.fy, cells: TOWN.cells, h: town.h },
      dungeons: DUNGEONS.map(d => ({ name: d.name, levels: d.levels, fx: d.fx, fy: d.fy, cells: d.cells, anchor: cells(...d.anchor), mouth: d.mouth, raise: d.raise })),
      villages: villages.map(v => ({ x: v.x, y: v.y, h: v.h, desert: !!v.desert, edge: Array.from({ length: 36 }, (_, k) => { // how far the levelled footprint reaches along each ray, cells
        let r = 0; for (let t = 0; t <= VW; t += 0.5) { const i = Math.round(Math.cos(k * Math.PI / 18) * t), j = Math.round(Math.sin(k * Math.PI / 18) * t); if (v.used && v.used[(i + VW) * (2 * VW + 1) + j + VW] === 0) r = t; } return r; }) })),
      outposts: outposts.map(o => ({ x: o.x, y: o.y, h: o.h, tier: o.tier, t: +o.t.toFixed(2) })),
      henge: { x0: henge.x0, y0: henge.y0, n: henge.n },
      caves: caves.map(c => ({ x: c.x, y: c.y, dx: c.dx, dy: c.dy })),
      swamp: { x: swamp.x, y: swamp.y, r: SWAMP.r }, desert: { x: desert.x, y: desert.y, r: DESERT.r },
      ruins: ruins.map(v => ({ x: v.x, y: v.y, r: RUINS.r })), camps: camps.map(c => ({ x: c.x, y: c.y })),
      spawners: full ? spawners.map(sp => ({ x: (sp.at[0] - X0) / CELL, y: (sp.at[1] - Y0) / CELL, tier: sp.tier, prefab: sp.prefab, dungeon: sp.dungeon })) : [],
      shops: full ? shops.map(sh => ({ x: (sh.at[0] - X0) / CELL, y: (sh.at[1] - Y0) / CELL, tier: sh.tier, prefab: sh.prefab })) : [],
    },
  };
  // where a bike rides on each path cell (bmxcheck.mjs): deck top, tunnel floor or the ground's top, units
  const ride = new Int16Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    const i = x * N + y;
    if (flags[y * N + x] & 128) ride[y * N + x] = deck[i] > 0 ? deck[i] : tunnelZ[i] >= 0 ? (tunnelZ[i] + 1) * VZ : riverCell[i] && townKind[i] ? (town.h + 1) * VZ : (H[i] + 1) * VZ; // town bridges sit at the paving
  }
  const sections = [['height', Hr, { w: N, h: N }], ['rgb', rgb, { w: N, h: N }], ['flags', flags, { w: N, h: N }], ['ride', ride, { w: N, h: N }]];
  if (full) {
    const res = 20, r = rasterBricks(bricks, { x0: X0, y0: Y0, size: N * CELL, res, fixed: BUILDER_FIXED });
    header.raster = { res, W: r.W };
    header.bricks = bricks.length;
    sections.push(['top', r.top, { w: r.W, h: r.W }], ['topRgb', r.rgb, { w: r.W, h: r.W }]);
  }
  writePreview(PREVIEW, header, sections);
  console.error(`preview written to ${PREVIEW} (${full ? 'full' : 'sites'}, ${((Date.now() - T0) / 1000).toFixed(1)} s)`);
}
if (PREVIEW && !PREVIEW_FULL) { previewOut(false); process.exit(0); }

stage('meshing');
// --------------------------------------------------------- greedy meshing --
const bricks = [];
const pushBox = (m, x0, y0, z0, x1, y1, z1) => {
  // voxel box [x0,x1) x [y0,y1) x [z0,z1)
  const M = MATS[m];
  bricks.push({
    position: [X0 + ((x0 + x1) / 2) * CELL, Y0 + ((y0 + y1) / 2) * CELL, ((z0 + z1) / 2) * VZ],
    size: [((x1 - x0) * CELL) / 2, ((y1 - y0) * CELL) / 2, ((z1 - z0) * VZ) / 2],
    color: M.color,
    ...(M.asset ? { asset: M.asset } : {}),
    ...(M.material ? { material: M.material } : {}),
    ...(M.intensity ? { material_intensity: M.intensity } : {}),
  });
};
const paved = new Map(); // top z -> Set of 'studX,studY' (global stud cells)
const PAVE_BED = mat([128, 122, 112]);
{
  // z-major copy (same scan order, sequential memory): much faster than V
  const NN = N * N, T = new Uint8Array(V.length);
  const zTop = (() => {
    let top = 0;
    for (let o = 0, c = 0; o < NN; o++)
      for (let z = 0; z < NZ; z++, c++) { const m = V[c]; if (m) { T[z * NN + o] = m; if (z > top) top = z; } }
    return top;
  })();
  // greedy merge in a function (optimisable); T doubles as 'not yet used'
  const greedy = (T) => {
    const out = [];
    const end = (zTop + 1) * NN;
    for (let i = 0; i < end; i++) {
      const m = T[i];
      if (!m) continue;
      const z = (i / NN) | 0, r = i - z * NN, x = (r / N) | 0, y = r - x * N;
      let w = 1;
      while (x + w < N && w < MAX_H_CELLS && T[i + w * N] === m) w++;
      let l = 1;
      grow: while (y + l < N && l < MAX_H_CELLS) {
        for (let a = 0; a < w; a++) if (T[i + a * N + l] !== m) break grow;
        l++;
      }
      let h = 1;
      grow2: while (z + h < NZ && h < MAX_Z_VOX) {
        const base = i + h * NN;
        for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) if (T[base + a * N + b] !== m) break grow2;
        h++;
      }
      for (let c = 0; c < h; c++) for (let a = 0; a < w; a++) T.fill(0, i + c * NN + a * N, i + c * NN + a * N + l);
      out.push(m, x, y, z, w, l, h);
    }
    return out;
  };
  const boxes = greedy(T);
  for (let k = 0; k < boxes.length; k += 7) {
    const m = boxes[k], x = boxes[k + 1], y = boxes[k + 2], z = boxes[k + 3], w = boxes[k + 4], l = boxes[k + 5], h = boxes[k + 6];
    {
        if (m === COBBLE) {
          // paved (town streets and square, hamlet cores): an 8-high bed, the
          // top plate is herringbone pavers laid below
          pushBox(PAVE_BED, x, y, z, x + w, y + l, z + h);
          const bed = bricks[bricks.length - 1];
          bed.position[2] -= 2; bed.size[2] -= 2;
          const top = (z + h) * VZ;
          const set = paved.get(top) ?? paved.set(top, new Set()).get(top);
          for (let a = x * 4; a < (x + w) * 4; a++) for (let b = y * 4; b < (y + l) * 4; b++) set.add(a + ',' + b);
        } else pushBox(m, x, y, z, x + w, y + l, z + h);
      }
  }
}
// herringbone pavers (owner 2026-10-04): 1 x 2-stud tiles on the global stud
// grid (wallgen's herringboneRects), a few stone tones
{
  // style 'paving' in floors.mjs; pick keeps the live layout's tones
  // (owner 2026-10-14: "make the brick paths have more interesting geometry") the
  // herringbone field is framed and inlaid, by each stud's distance to the paving
  // edge: a dark kerb course on the edge, a red brick band 3 studs in, diamonds down
  // the middle of the lanes (spaced along them) and compass medallions (ring, 8-point
  // star, a hub) where the paving opens into squares and greens
  const inlay = (cells) => {
    const d = new Map(); let q = [];
    for (const k of cells) { const [a, b] = k.split(',').map(Number); if (!cells.has((a + 1) + ',' + b) || !cells.has((a - 1) + ',' + b) || !cells.has(a + ',' + (b + 1)) || !cells.has(a + ',' + (b - 1))) { d.set(k, 1); q.push([a, b]); } }
    for (let dist = 1; q.length && dist < 14; dist++) {
      const nq = [];
      for (const [a, b] of q) for (const [p2, q2] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) { const k = p2 + ',' + q2; if (cells.has(k) && !d.has(k)) { d.set(k, dist + 1); nq.push([p2, q2]); } }
      q = nq;
    }
    const D = k => d.get(k) ?? 14;
    const cls = new Map(); // stud -> colour class
    for (const k of cells) { const v = D(k); if (v === 1) cls.set(k, 'kerb'); else if (v === 3) cls.set(k, 'band'); }
    const ridge = k => { const [a, b] = k.split(',').map(Number), v = D(k); return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([x, y]) => D((a + x) + ',' + (b + y)) <= v); };
    const pickSpaced = (cands, gap) => {
      const out = [];
      for (const [a, b, v] of cands.sort((u, w) => w[2] - u[2] || hash(u[0], u[1], 93) - hash(w[0], w[1], 93)))
        if (!out.some(([x, y]) => Math.hypot(x - a, y - b) < gap)) out.push([a, b, v]);
      return out;
    };
    // medallions first (squares), then lane diamonds clear of them
    const medal = new Set();
    const med = pickSpaced([...cells].filter(k => D(k) >= 9 && ridge(k)).map(k => [...k.split(',').map(Number), D(k)]), 30);
    for (const [ca, cb, v] of med) {
      const R = Math.min(v - 3, 10);
      for (let a = ca - R; a <= ca + R; a++) for (let b = cb - R; b <= cb + R; b++) {
        const k = a + ',' + b; if (!cells.has(k)) continue;
        const x = a - ca, y = b - cb, r = Math.hypot(x, y), t = Math.atan2(y, x);
        if (r > R + 0.3) continue;
        medal.add(k);
        const star = r < (R - 1.6) * (0.35 + 0.65 * Math.pow(Math.abs(Math.cos(4 * t)), 6));
        cls.set(k, r <= 1.2 ? 'hub' : r >= R - 0.9 ? 'band' : r >= R - 1.9 ? 'kerb' : star ? ((Math.round(t / (Math.PI / 4)) & 1) ? 'cream' : 'band') : 'field');
      }
    }
    const dia = pickSpaced([...cells].filter(k => { const v = D(k); return v >= 6 && v <= 8 && ridge(k); }).map(k => [...k.split(',').map(Number), D(k)])
      .filter(([a, b]) => !med.some(([x, y, v]) => Math.hypot(x - a, y - b) < Math.min(v - 3, 10) + 8)), 18);
    for (const [ca, cb] of dia)
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
        const m = Math.abs(x) + Math.abs(y), k = (ca + x) + ',' + (cb + y);
        if (m <= 2 && cells.has(k) && D(k) >= 4) cls.set(k, m === 0 ? 'hub' : m === 1 ? 'cream' : 'band');
      }
    cls.medal = medal;
    return cls;
  };
  // (2026-10-19, owner photos of a Ren faire: "make the spawn town look like this") the town's lanes are
  // gravel: 1-2 stud tiles in five greys, no kerb or bands; the plaza medallions stay
  const GRAVEL = { pattern: 'tiles', asset: 'PB_DefaultTile', maxSide: 2, colors: [[168, 162, 150], [152, 148, 140], [182, 176, 164], [140, 136, 128], [160, 150, 136]] };
  const inTownStud = k => { const [a, b] = k.split(','); return !!townKind[Math.floor(+a / 4) * N + Math.floor(+b / 4)]; };
  const INLAY = {
    kerb: [[104, 100, 96], [114, 110, 104], [96, 94, 92]],
    band: [[150, 74, 56], [138, 68, 52], [162, 82, 60]],
    cream: [[222, 210, 184], [212, 200, 174]],
    hub: [[196, 160, 90]],
  };
  const emit = (top, r) => bricks.push({
    asset: r.brick.asset, position: [X0 + ((r.x0 + r.x1) / 2) * 10, Y0 + ((r.y0 + r.y1) / 2) * 10, top - 2],
    size: [(r.x1 - r.x0) * 5, (r.y1 - r.y0) * 5, 2], color: r.brick.color,
  });
  for (const [top, cells] of paved) {
    const cls = inlay(cells), field = new Set(), parts = new Map(), gravel = new Set();
    for (const k of cells) { const c = cls.get(k); if (!cls.medal.has(k) && inTownStud(k)) gravel.add(k); else if (!c || c === 'field') field.add(k); else (parts.get(c) ?? parts.set(c, new Set()).get(c)).add(k); }
    for (const r of floorPieces(gravel, GRAVEL, { pick: (r, C) => C[Math.floor(hash(r.x0, r.y0, 94) * C.length)] })) emit(top, r);
    for (const r of floorPieces(field, 'paving', { pick: (r, C) => C[Math.floor(hash(r.x0, r.y0, 91) * C.length)] })) emit(top, r);
    for (const [c, set] of parts)
      for (const r of floorPieces(set, { pattern: 'tiles', asset: 'PB_DefaultTile', maxSide: 2, colors: INLAY[c] }, { pick: (r, C) => C[Math.floor(hash(r.x0, r.y0, 92) * C.length)] })) emit(top, r);
  }
}
const terrainCount = bricks.length;

// Enemy spawners: the 7 skeleton Bot Spawn Points built in-game, saved on the
// server as prefabs dungeon_spawner_1..7 (easiest first). Their bot settings
// live in brick components the bridge can't write, so the generator only
// lists where each goes; load-spawners.mjs stamps the prefabs there.
const SPAWNERS = ['Handaxe', 'Arming Sword', 'Spear', 'Longsword', 'Bow', 'Zweihander', 'Battleaxe'];
const spawners = []; // { at: [x, y, z], tier, dungeon, level }

stage('dungeonBricks');
// ------------------------------------------------------- dungeon bricks --
for (const d of DUNGEONS) {
  const [ox, oy, oz] = d.origin;
  const out = d.out;
  for (const { label, ...b } of out.bricks) bricks.push({ ...b, position: [b.position[0] + ox, b.position[1] + oy, b.position[2] + oz] });
  for (const s of out.spawns)
    spawners.push({ at: [s.at[0] + ox, s.at[1] + oy, s.at[2] + oz], tier: d.tiers[d.levels - 1 - s.level], dungeon: d.name, level: d.levels - s.level });
  d.entrance = [X0 + (d.mouth[0] + 0.5) * CELL, Y0 + (d.mouth[1] + 0.5) * CELL, (H[d.mouth[0] * N + d.mouth[1]] + 1) * VZ]; // the trench mouth
  // the surface keep on its roof (spawners: the top floor's tier)
  const kz = d.topVox * VZ;
  for (const b of d.keep.bricks) bricks.push({ ...b, position: [b.position[0] + ox, b.position[1] + oy, b.position[2] + kz] });
  for (const s of d.keep.spawns) spawners.push({ at: [s[0] + ox, s[1] + oy, s[2] + kz], tier: d.tiers[0], dungeon: d.name, level: 0 });
  d.keepPots = (d.keep.pots ?? []).map(p => [p[0] + ox, p[1] + oy, p[2] + kz + 12]); // the great hall's reward (greathall.mjs)
  console.error(`${d.name}: ${d.levels} floors, ${out.bricks.length} bricks, ${out.atria.length} atriums, ${out.spawns.length} spawners`);
}
const dungeonCount = bricks.length - terrainCount;

stage('smoothing');
// ------------------------------------------------------------- smoothing --
// Every terrain step of 1 to MAX_RISE bricks gets a micro wedge on the low
// cell rising to the higher neighbour, as tall as the step (taller steps stay
// cliffs); where two steps meet, an outer-corner piece (a cube
// with one corner cut off) fills the concave corner and a corner tetrahedron
// rounds the convex one. Pieces are coloured like the surface they rise to.
// --no-smooth turns it off.
//
// Orientation: see orient.mjs (ORIENT, orientFor).
const MAX_RISE = tune('smooth.maxRise', 6, 'tallest step that gets a wedge, bricks');
const SEABED_SMOOTH = tune('smooth.seabed', 10, 'seabed smoothed this many bricks under the sea plane');
// tiered mountains (snow.style tiers): upright 45 degree wedges in the wall corners, dirt stair treads
// (2 studs deep, a brick each) along the walls; each only where the ground still matches the plan
{
  const T = TIER.h, WALL = MATS[ROCK[0]], STEP = MATS[PATH];
  const ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 };
  const at = (x, y) => (inMap(x, y) ? H[x * N + y] : -1);
  let nc = 0, ns = 0;
  for (const { x, y, h, sx, sy } of tierMtn.chamfer) {
    if (at(x, y) !== h || at(x + sx, y) !== h + T || at(x, y + sy) !== h + T || V[vi(x, y, h + 1)] !== 0) continue;
    bricks.push({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: ROT[sx + ',' + sy], size: [CELL / 2, CELL / 2, (T * VZ) / 2],
      position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (h + 1) * VZ + (T * VZ) / 2], color: WALL.color, ...(WALL.material ? { material: WALL.material } : {}) });
    nc++;
  }
  for (const s of tierMtn.stairs) {
    if (s.cs.some(c => H[c] !== s.h0) || s.side.some(c => H[c] !== s.h0 + s.r)) continue;
    // the run = cells cs[1..3] (120 units along d); treads j = 1..r-1 fill its last (r-1) x 20 units
    const c1 = s.cs[1], x1 = (c1 / N) | 0, y1 = c1 % N;
    const back = [X0 + (x1 + 0.5) * CELL - s.dx * CELL / 2, Y0 + (y1 + 0.5) * CELL - s.dy * CELL / 2]; // run start edge, cell middle across
    for (let j = 1; j < s.r; j++) {
      const along = 3 * CELL - (s.r - j) * 20 + 10; // tread centre from the run start
      bricks.push({ size: s.dx ? [10, CELL / 2, (j * VZ) / 2] : [CELL / 2, 10, (j * VZ) / 2],
        position: [back[0] + s.dx * along, back[1] + s.dy * along, (s.h0 + 1) * VZ + (j * VZ) / 2], color: STEP.color });
    }
    ns++;
  }
  if (tierMtn.peaks.length) console.error(`snow tiers: ${nc} corner wedges, ${ns} stair flights built`);
}
riverDiag('before smoothing');
if (process.env.MAPGEN_RIVERBED) { const sx = -(X0 + (town.fx + TOWN.cells / 2) * CELL), sy = -(Y0 + (town.fy + TOWN.cells / 2) * CELL); const out = []; for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) { const c = x * N + y; if (riverCell[c] || riverBankL[c] > -999) out.push([x, y, H[c], riverCell[c], riverLevel[c], riverBankL[c], Math.round(X0 + x * CELL + sx), Math.round(Y0 + y * CELL + sy)]); } fs.writeFileSync(process.env.MAPGEN_RIVERBED, JSON.stringify({ SEA, out })); }
if (process.env.MAPGEN_RIVERDIAG) {
  const sx = -(X0 + (town.fx + TOWN.cells / 2) * CELL), sy = -(Y0 + (town.fy + TOWN.cells / 2) * CELL), cl = new Map();
  for (const [x, y, m] of globalThis.__riverHits) { const k = Math.round(x / 20) + ',' + Math.round(y / 20); const v = cl.get(k) ?? { n: 0, m: 0, at: null }; v.n++; if (m > v.m) { v.m = m; v.at = [X0 + x * CELL + 20 + sx, Y0 + y * CELL + 20 + sy, H[x * N + y] * VZ]; } cl.set(k, v); }
  console.error([...cl.values()].sort((a, b) => b.n - a.n).slice(0, 12).map(v => `  ${v.n} cells, tallest ${v.m} at ${v.at}`).join(' | '));
}
// ride surface (owner 2026-10-13: "make the paths use micro bricks and ramps and wedges for the
// absolute best riding experience"): road cells (not town or hamlet paving; hamlet lanes too since 2026-10-16,
// bridges and their ends, tunnels, rivers, weirs) get their own stud-fine surface below,
// so the cell smoothing leaves them alone
const roadSurf = new Uint8Array(N * N);
for (let x = 1; x < N - 1; x++)
  for (let y = 1; y < N - 1; y++) {
    const c = x * N + y;
    if ((!pathCell[c] && tunnelZ[c] < 0) || townKind[c] || villagePaved[c] || deck[c] || riverCell[c] || weirCell[c] || (H[c] <= SEA && tunnelZ[c] < 0)) continue;
    let nearDeck = false;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const n = (x + a) * N + y + b; if (deck[n] || terraceCell[n]) nearDeck = true; } // terrace walls stand on the low cell (tunnels ride since 2026-10-16)
    if (!nearDeck) roadSurf[c] = 1;
  }
// MAPGEN_ROADDIAG=1: why road cells miss the ride surface (first reason per cell) + a few world spots each
if (process.env.MAPGEN_ROADDIAG) {
  const why = {}, at = {}, SH = [-(X0 + (town.fx + TOWN.cells / 2) * CELL), -(Y0 + (town.fy + TOWN.cells / 2) * CELL)];
  for (let x = 1; x < N - 1; x++) for (let y = 1; y < N - 1; y++) {
    const c = x * N + y;
    if (!pathCell[c] || roadSurf[c]) continue;
    const r = townKind[c] ? 'town' : villagePaved[c] ? 'villagePaved' : villageDist(x, y) <= VILLAGE.r + 2 ? 'village' : deck[c] ? 'deck' : tunnelZ[c] >= 0 ? 'tunnel'
      : riverCell[c] ? 'river' : weirCell[c] ? 'weir' : H[c] <= SEA ? 'sea' : 'nearDeckOrTerrace';
    why[r] = (why[r] ?? 0) + 1; (at[r] ??= []).length < 4 && at[r].push([Math.round(X0 + x * CELL + SH[0]), Math.round(Y0 + y * CELL + SH[1])]);
  }
  let on = 0; for (let c = 0; c < N * N; c++) on += roadSurf[c];
  console.error('road diag: ride surface', on, 'cells; missing', JSON.stringify(why), JSON.stringify(at));
}
const SMOOTH = opt('--smooth', 'wedge'); // 'ramp' (micro ramps on straight slopes) or 'wedge' (tipped micro wedges)
let ramps = 0, triCaps = 0;
const smoothStat = { tidy: 0, notch: 0, risers: 0 }; // in the river corridor (MAPGEN_RIVERDIAG)
const rampCol = new Uint8Array(N * N);
const capCol = new Uint8Array(N * N); // cells with a diagonal triangle cap (no plants on them)
// per smoothed cell: its rise k and which way it slopes up (plants sit at the high edge)
const rampK = new Uint8Array(N * N), rampUp = new Int8Array(N * N); // rampUp: 0 none, 1 flat fill, else 2 + dir index
const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
if (!args.includes('--no-smooth'))
for (let x = 0; x < N; x++)
  for (let y = 0; y < N; y++) {
    const h = H[x * N + y];
    // under the sea too, down to SEABED_SMOOTH (owner 2026-10-13: the shallows showed raw
    // voxel steps through the water), and the river's mouth where it has no water plates
    if (h + 1 <= SEA - SEABED_SMOOTH || V[vi(x, y, h)] === 0) continue;
    if (tierMtn.cells[x * N + y] || townKind[x * N + y] || villageDist(x, y) <= VILLAGE.r || weirCell[x * N + y] || roadSurf[x * N + y] || (noSmooth[x * N + y] && !(riverCell[x * N + y] && riverLevel[x * N + y] <= SEA && !deck[x * N + y] && !pathCell[x * N + y]))) continue;
    // the foot of a terrace retaining wall: its brick veneer stands here (terraceDressing)
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => inMap(x + dx, y + dy) && terraceCell[(x + dx) * N + y + dy] && H[(x + dx) * N + y + dy] - h >= 2)) continue;
    const hN = (dx, dy) => (inMap(x + dx, y + dy) ? H[(x + dx) * N + y + dy] : h);
    // the step up to the lowest higher neighbour (1..MAX_RISE bricks); every
    // piece on this cell rises by that much
    const orth = [[1, 0], [0, 1], [-1, 0], [0, -1]], diag8 = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const rises = [...orth, ...diag8].map(([dx, dy]) => hN(dx, dy) - h).filter(r => r > 0);
    if (!rises.length) continue;
    const k = Math.min(...rises);
    if (k > MAX_RISE) continue;
    let clear = true;
    for (let z = h + 1; z <= h + k; z++) if (V[vi(x, y, z)] !== 0) clear = false;
    if (!clear) continue;
    // a neighbour exactly k up with solid ground on top
    const up = (dx, dy) => {
      if (hN(dx, dy) !== h + k) return 0;
      const t = V[vi(x + dx, y + dy, h + k)];
      return t && t !== WATER ? t : 0;
    };
    const ups = orth.filter(([dx, dy]) => up(dx, dy));
    const higher = ([dx, dy]) => hN(dx, dy) > h;
    // the tidy cases first (one slope, a two-sided inner corner, a diagonal
    // outer corner); when none fits, the notch fallbacks below
    const tidy = () => {
      if (ups.length === 1) {
        const [dx, dy] = ups[0];
        if (higher([-dx, -dy]) || higher([dy, dx]) || higher([-dy, -dx])) return null;
        return ['PB_DefaultMicroWedge', [[dx, dy]], up(dx, dy)];
      }
      if (ups.length === 2 && ups[0][0] !== -ups[1][0] && ups[0][1] !== -ups[1][1]) {
        const dx = ups[0][0] + ups[1][0], dy = ups[0][1] + ups[1][1];
        if (higher([-dx, 0]) || higher([0, -dy])) return null;
        return ['PB_DefaultMicroWedgeOuterCorner', ups, up(ups[0][0], ups[0][1])];
      }
      if (ups.length === 0 && !orth.some(higher)) {
        const diag = [[1, 1], [-1, 1], [-1, -1], [1, -1]].filter(([dx, dy]) => up(dx, dy));
        if (diag.length !== 1) return null;
        const [dx, dy] = diag[0];
        return ['PB_DefaultMicroWedgeCorner', [[dx, 0], [0, dy]], up(dx, dy)];
      }
      return null;
    };
    // notches the tidy cases skip (they left holes): rise toward the middle
    // of a U, an inner corner, a lone higher side, fill pits and ditches
    const notch = () => {
      const hi = orth.filter(higher);
      // coloured by the neighbour's surface, not the voxel at h + k inside it
      // (2026-10-10, owner screenshot: those were dirt, brown wedges all over the grass)
      const solidTop = ([dx, dy]) => { const t = V[vi(x + dx, y + dy, Math.min(hN(dx, dy), h + k))]; if (!t || t === WATER) return 0; const s = V[vi(x + dx, y + dy, hN(dx, dy))]; return s && s !== WATER ? s : t; };
      if (hi.length === 3) {
        const low = orth.find(d => !higher(d));
        const d = [-low[0], -low[1]];
        return ['PB_DefaultMicroWedge', [d], solidTop(d)];
      }
      if (hi.length === 2 && hi[0][0] !== -hi[1][0] && hi[0][1] !== -hi[1][1]) return ['PB_DefaultMicroWedgeOuterCorner', hi, solidTop(hi[0])];
      if (hi.length === 1) return ['PB_DefaultMicroWedge', [hi[0]], solidTop(hi[0])];
      if (hi.length === 4 || hi.length === 2) return ['fill', null, solidTop(hi[0])];
      return null;
    };
    const tidyPick = tidy(), pick = tidyPick ?? notch();
    if (riverBankL[x * N + y] > -999 && pick && pick[2]) { if (tidyPick) smoothStat.tidy++; else smoothStat.notch++; }
    if (riverBankL[x * N + y] > -999 && pick && pick[2]) for (const [dx, dy] of orth) if (hN(dx, dy) > h + k) smoothStat.risers++;
    if (!pick || !pick[2]) continue;
    const [asset, dirs, top] = pick;
    const M = MATS[top];
    // straight slopes: an upright micro ramp (the owner's hand-smoothed style).
    // Rotation 0 rises toward -x; each step turns a quarter anticlockwise.
    const RAMP_ROT = { '-1,0': 0, '0,-1': 1, '1,0': 2, '0,1': 3 };
    const orient = asset === 'fill' ? { size: [CELL / 2, CELL / 2, (k * VZ) / 2] }
      : asset === 'PB_DefaultMicroWedge' && SMOOTH === 'ramp'
      ? { asset: 'PB_DefaultMicroRamp', direction: 4, rotation: RAMP_ROT[dirs[0].join(',')], size: [CELL / 2, CELL / 2, (k * VZ) / 2] }
      : { asset, ...orientFor(asset, dirs, [CELL / 2, CELL / 2, (k * VZ) / 2]) };
    bricks.push({
      ...orient,
      position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (h + 1) * VZ + (k * VZ) / 2],
      color: M.color,
      ...(M.material ? { material: M.material } : {}),
    });
    // diagonal slopes (owner's hand fix, 2026-10-03): an outer corner only
    // climbs one step, so where the diagonal cell between its two higher sides
    // is higher still, a triangle corner on top carries the slope on toward it
    if (asset === 'PB_DefaultMicroWedgeOuterCorner') {
      const dx = Math.sign(dirs[0][0] + dirs[1][0]), dy = Math.sign(dirs[0][1] + dirs[1][1]);
      const kt = Math.min(k, hN(dx, dy) - (h + k));
      let free = kt > 0;
      for (let z = h + k + 1; free && z <= h + k + kt; z++) if (V[vi(x, y, z)] !== 0) free = false;
      if (free) {
        const TRI_ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 }; // rotation = the corner it rises toward
        bricks.push({
          asset: 'PB_DefaultMicroWedgeTriangleCorner', direction: 4, rotation: TRI_ROT[dx + ',' + dy], size: [CELL / 2, CELL / 2, (kt * VZ) / 2],
          position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (h + k + 1) * VZ + (kt * VZ) / 2],
          color: M.color, ...(M.material ? { material: M.material } : {}),
        });
        triCaps++;
        capCol[x * N + y] = 1;
      }
    }
    ramps++;
    rampCol[x * N + y] = 1;
    rampK[x * N + y] = k;
    if (asset === "fill") rampUp[x * N + y] = 1;
    else if (asset !== "PB_DefaultMicroWedgeCorner") {
      const ux = Math.sign(dirs.reduce((a, d) => a + d[0], 0)), uy = Math.sign(dirs.reduce((a, d) => a + d[1], 0));
      rampUp[x * N + y] = 2 + DIR8.findIndex(([dx, dy]) => dx === ux && dy === uy);
    }
  }

if (process.env.MAPGEN_RIVERDIAG) console.error('river corridor smoothing pieces:', JSON.stringify(smoothStat));
// ride surface v2 (2026-10-16, owner: "paths look really really bad. use smaller blocks like
// micro ramps wedges corners etc to make the bike path as smooth as possible. like imagine
// rollercoaster tycoon 2 coaster construction"; v1 = a slope-limited envelope capped 2 bricks
// over the ground, which fell back into brick steps on steep mountain roads):
//  1. per stud a taut membrane over the ground: relaxed toward the mean of its road neighbours,
//     never below the ground (an obstacle problem), so a staircase of cell steps turns into the
//     straight slope through the step edges, uphill and downhill alike, crests kept
//  2. heights at the corners of 2 x 2-stud tiles (highest stud touching the corner, rounded up to
//     the 2-unit micro grid; shared by neighbouring tiles, so the surface has no seams)
//  3. per tile a micro brick fill from the ground to its lowest corner and one cap from there to
//     the highest: by the corners above the middle height, one = a micro wedge corner, two side by
//     side = a micro wedge, three = a micro wedge outer corner (the cell smoothing's tested pieces)
//  fills merged into rectangles, wedges merged along runs across the slope; path colour
const RIDE_ITERS = tune('road.rideIters', 240, 'ride surface: membrane relaxation passes (more = smoother over longer runs)');
const RIDE_MAXFILL = tune('road.rideMaxFill', 60, 'ride surface: most units the surface may stand over its ground');
// (2026-10-25, owner: "a road system that uses actual roads gta style with the houses we built connected to the
// roads") asphalt roads: the ride surface gets a ROAD_SKIN-unit asphalt skin everywhere (a flat stretch used to show
// the dirt voxel), coloured per stud: a concrete curb on the outermost stud, a white edge line inside it, a dashed
// yellow centre line along each road's smoothed centre (none through junctions), asphalt between; the houses'
// footpaths become concrete driveways (footCell 3/4)
let rideBricks = 0;
{
  const SPC = CELL / 10, W = N * SPC; // studs per cell, studs per map side
  const idx = (sx, sy) => sx * W + sy;
  const S = new Float32Array(W * W).fill(-1e9), T = new Float32Array(W * W).fill(-1e9);
  const studs = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    if (!roadSurf[x * N + y]) continue;
    const t = ((tunnelZ[x * N + y] >= 0 ? tunnelZ[x * N + y] : H[x * N + y]) + 1) * VZ; // a road tunnel's floor
    for (let a = 0; a < SPC; a++) for (let b = 0; b < SPC; b++) { const i = idx(x * SPC + a, y * SPC + b); S[i] = T[i] = t; studs.push(i); }
  }
  // 1. membrane (Gauss-Seidel, alternating sweep order)
  const nb = new Int32Array(studs.length * 4).fill(-1);
  studs.forEach((i, k) => { const sx = (i / W) | 0, sy = i % W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy], m) => { const n = idx(sx + dx, sy + dy); if (T[n] > -1e8) nb[k * 4 + m] = n; }); });
  for (let pass = 0; pass < RIDE_ITERS; pass++) {
    const fwd = pass % 2 === 0;
    for (let q = 0; q < studs.length; q++) {
      const k = fwd ? q : studs.length - 1 - q, i = studs[k];
      let sum = 0, c = 0;
      for (let m = 0; m < 4; m++) { const n = nb[k * 4 + m]; if (n >= 0) { sum += S[n]; c++; } }
      if (!c) continue;
      const v = sum / c;
      S[i] = Math.min(T[i] + RIDE_MAXFILL, Math.max(T[i], v));
    }
  }
  // 2. tile corners: corner (cx, cy) sits at the stud boundary; tiles are 2 x 2 studs, inside one cell
  const TW = W / 2, cIdx = (cx, cy) => cx * (W + 1) + cy;
  const C = new Float32Array((W + 1) * (W + 1)).fill(-1e9);
  for (const i of studs) {
    const sx = (i / W) | 0, sy = i % W;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const j = cIdx(sx + a, sy + b); if (S[i] > C[j]) C[j] = S[i]; }
  }
  const tiles = [];
  const seen = new Uint8Array(TW * TW);
  for (const i of studs) {
    const tx = ((i / W) | 0) >> 1, ty = (i % W) >> 1, t = tx * TW + ty;
    if (seen[t]) continue;
    seen[t] = 1;
    const g = T[idx(tx * 2, ty * 2)];
    // corners 00 10 01 11, rounded up to 2 units, never more than RIDE_MAXFILL over this tile's ground
    const h = [[0, 0], [2, 0], [0, 2], [2, 2]].map(([a, b]) => Math.min(g + RIDE_MAXFILL, Math.ceil(C[cIdx(tx * 2 + a, ty * 2 + b)] / 2) * 2) + (GTA ? ROAD_SKIN : 0));
    tiles.push({ tx, ty, g, h });
  }
  const PC = MATS[PATH].color;
  const wx = sx => X0 + sx * 10, wy = sy => Y0 + sy * 10;
  // 3. per tile: base (lowest corner), cap shape
  const tileAt = new Map(tiles.map(T0 => [T0.tx * TW + T0.ty, T0]));
  const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]]; // direction of corners 00 10 01 11 from the tile centre
  for (const t of tiles) {
    const lo = Math.min(...t.h), hi = Math.max(...t.h), d = hi - lo;
    t.base = lo; t.cap = null;
    if (!d) continue;
    const up = t.h.map(v => v - lo >= d / 2);
    const n = up.filter(Boolean).length;
    if (n === 1) { const [sx, sy] = CORNER[up.indexOf(true)]; t.cap = ['PB_DefaultMicroWedgeCorner', [[sx, 0], [0, sy]], d]; }
    else if (n === 3) { const [lx, ly] = CORNER[up.indexOf(false)]; t.cap = ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]], d]; }
    else if (n === 2) {
      const [a, b] = up.map((u, k) => (u ? k : -1)).filter(k => k >= 0);
      const [ax, ay] = CORNER[a], [bx, by] = CORNER[b];
      if (ax === bx) t.cap = ['PB_DefaultMicroWedge', [[ax, 0]], d];
      else if (ay === by) t.cap = ['PB_DefaultMicroWedge', [[0, ay]], d];
      else t.base = hi; // a saddle (two opposite corners up): flat at the top
    }
  }
  if (GTA) {
    // per road stud: its colour. rm = any surface a road runs on or into (no curb where it meets them)
    const rm = c => pathCell[c] || tunnelZ[c] >= 0 || townKind[c] || villagePaved[c] || deck[c] || weirCell[c] || bridgeZ[c] >= 0;
    const sIdx = new Int32Array(W * W).fill(-1);
    studs.forEach((i, k) => { sIdx[i] = k; });
    const NS = studs.length, D1 = new Float32Array(NS).fill(1e9), S1 = new Float32Array(NS), R1 = new Int32Array(NS).fill(-1), TX = new Float32Array(NS), TY = new Float32Array(NS), JN = new Uint8Array(NS);
    const roadStud = (sx, sy) => sx >= 0 && sy >= 0 && sx < W && sy < W && rm(((sx / SPC) | 0) * N + ((sy / SPC) | 0));
    // centre lines: each graded road's cell path, smoothed twice (+-4 samples), in stud units
    const lines = roadPaths.map(({ P }) => {
      let q = P.map(([x, y]) => [x * SPC + SPC / 2, y * SPC + SPC / 2]);
      for (let pass = 0; pass < 2; pass++) q = q.map((_, i) => { let a = 0, b = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(q.length - 1, i + 4); j++) { a += q[j][0]; b += q[j][1]; k++; } return [a / k, b / k]; });
      return q;
    });
    const visit = (R, fn) => lines.forEach((q, r) => {
      let s = 0;
      for (let i = 0; i + 1 < q.length; i++) {
        const [ax, ay] = q[i], [bx, by] = q[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const ux = dx / L, uy = dy / L;
        for (let sx = Math.floor(Math.min(ax, bx) - R); sx <= Math.ceil(Math.max(ax, bx) + R); sx++)
          for (let sy = Math.floor(Math.min(ay, by) - R); sy <= Math.ceil(Math.max(ay, by) + R); sy++) {
            if (sx < 0 || sy < 0 || sx >= W || sy >= W) continue;
            const k = sIdx[idx(sx, sy)]; if (k < 0) continue;
            const px = sx + 0.5 - ax, py = sy + 0.5 - ay, t = Math.max(0, Math.min(L, px * ux + py * uy));
            const d = Math.hypot(px - t * ux, py - t * uy);
            if (d <= R) fn(k, d, s + t, r, ux, uy);
          }
        s += L;
      }
    });
    visit(3, (k, d, s, r, ux, uy) => { if (d < D1[k]) { D1[k] = d; S1[k] = s; R1[k] = r; TX[k] = ux; TY[k] = uy; } });
    // junctions: another road crossing (not running alongside) within 6 studs; grown by 2
    visit(6, (k, d, s, r, ux, uy) => { if (R1[k] >= 0 && R1[k] !== r && Math.abs(ux * TX[k] + uy * TY[k]) < 0.85) JN[k] = 1; });
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let k = 0; k < NS; k++) if (JN[k]) { const i = studs[k], sx = (i / W) | 0, sy = i % W; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = sx + a >= 0 && sx + a < W && sy + b >= 0 && sy + b < W ? sIdx[idx(sx + a, sy + b)] : -1; if (n >= 0 && !JN[n]) add.push(n); } }
      for (const n of add) JN[n] = 1;
    }
    const PAL = [ASPHALT, CURB, EDGE_LINE, CENTRE_LINE];
    const col = new Uint8Array(NS); // 0 asphalt, 1 curb, 2 edge line, 3 centre line
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let k = 0; k < NS; k++) { const i = studs[k], sx = (i / W) | 0, sy = i % W; if (N8.some(([a, b]) => !roadStud(sx + a, sy + b))) col[k] = 1; }
    for (let k = 0; k < NS; k++) {
      if (col[k]) continue;
      const i = studs[k], sx = (i / W) | 0, sy = i % W;
      if (N8.some(([a, b]) => { const n = sIdx[idx(sx + a, sy + b)]; return n >= 0 && col[n] === 1; })) { col[k] = 2; continue; }
      if (D1[k] < 0.75 && !JN[k] && S1[k] % 10 < 6) col[k] = 3;
    }
    // a capped (sloped) tile is one colour: the most common of its studs (ties: curb, line, centre, asphalt)
    const tileCol = t => {
      const n = [0, 0, 0, 0];
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = sIdx[idx(t.tx * 2 + a, t.ty * 2 + b)]; if (k >= 0) n[col[k]]++; }
      let best = 0; for (const c of [1, 2, 3, 0]) if (n[c] > n[best] || (n[c] === n[best] && c !== 0 && best === 0)) best = c;
      return best;
    };
    for (const t of tiles) {
      t.col = tileCol(t);
      if (t.cap) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = sIdx[idx(t.tx * 2 + a, t.ty * 2 + b)]; if (k >= 0) col[k] = t.col; }
    }
    // fills: greedy rectangles of equal (ground, base, colour) over the stud grid, up to 40 studs a side
    const sBase = new Float32Array(NS);
    for (const t of tiles) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = sIdx[idx(t.tx * 2 + a, t.ty * 2 + b)]; if (k >= 0) sBase[k] = t.base; }
    const usedS = new Uint8Array(NS);
    for (let k0 = 0; k0 < NS; k0++) {
      if (usedS[k0]) continue;
      const i0 = studs[k0], sx = (i0 / W) | 0, sy = i0 % W, g = T[i0], base = sBase[k0], c0 = col[k0];
      if (base - g < 2) { usedS[k0] = 1; continue; }
      const same = (a, b) => { if (sx + a >= W || sy + b >= W) return false; const k = sIdx[idx(sx + a, sy + b)]; return k >= 0 && !usedS[k] && T[studs[k]] === g && sBase[k] === base && col[k] === c0; };
      let l = 1; while (l < 40 && same(0, l)) l++;
      let w = 1; grow: while (w < 40) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) usedS[sIdx[idx(sx + a, sy + b)]] = 1;
      bricks.push({ asset: 'PB_DefaultMicroBrick', position: [wx(sx) + w * 5, wy(sy) + l * 5, (g + base) / 2], size: [w * 5, l * 5, (base - g) / 2], color: PAL[c0], ride: 1, split: 1 });
      rideBricks++;
    }
    // caps: as below, runs also of one colour
    const usedC = new Uint8Array(TW * TW);
    const ck = t => t.cap && t.cap[0] + t.cap[1].join(';') + t.cap[2] + '/' + t.col;
    for (const t of tiles) {
      const k0 = t.tx * TW + t.ty;
      if (!t.cap || usedC[k0]) continue;
      const [asset, dirs, d] = t.cap;
      let len = 1, px = 0, py = 0;
      if (asset === 'PB_DefaultMicroWedge') {
        [px, py] = dirs[0][0] ? [0, 1] : [1, 0];
        while (len < 20) { const o = tileAt.get((t.tx + px * len) * TW + t.ty + py * len); if (!o || o.base !== t.base || ck(o) !== ck(t) || usedC[(t.tx + px * len) * TW + t.ty + py * len]) break; len++; }
      }
      for (let m = 0; m < len; m++) usedC[(t.tx + px * m) * TW + t.ty + py * m] = 1;
      const ext = [px ? len * 10 : 10, py ? len * 10 : 10, d / 2];
      bricks.push({ asset, ...orientFor(asset, dirs, ext), position: [wx(t.tx * 2) + ext[0], wy(t.ty * 2) + ext[1], t.base + d / 2], color: PAL[t.col], ride: 1 });
      rideBricks++;
    }
    const tally = [0, 0, 0, 0]; for (let k = 0; k < NS; k++) tally[col[k]]++;
    console.error(`asphalt roads: ${NS} studs (asphalt ${tally[0]}, curb ${tally[1]}, edge line ${tally[2]}, centre line ${tally[3]}), ${lines.length} centre lines, ${JN.reduce((a, b) => a + b, 0)} junction studs`);
  } else {
    // fills: greedy rectangles of equal (ground, base) over the tile grid
    const used = new Uint8Array(TW * TW);
    for (const t of tiles) {
      const k0 = t.tx * TW + t.ty;
      if (used[k0] || t.base - t.g < 2) continue;
      const same = (a, b) => { const o = tileAt.get((t.tx + a) * TW + t.ty + b); return o && o.g === t.g && o.base === t.base && !used[(t.tx + a) * TW + t.ty + b]; };
      let l = 1; while (l < 20 && same(0, l)) l++;
      let w = 1; grow: while (w < 20) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) used[(t.tx + a) * TW + t.ty + b] = 1;
      bricks.push({ asset: 'PB_DefaultMicroBrick', position: [wx(t.tx * 2) + w * 10, wy(t.ty * 2) + l * 10, (t.g + t.base) / 2], size: [w * 10, l * 10, (t.base - t.g) / 2], color: PC, ride: 1 });
      rideBricks++;
    }
    // caps: wedges merged along runs across their slope (same base, height, direction); corners alone
    const usedC = new Uint8Array(TW * TW);
    const ck = c => c && c[0] + c[1].join(';') + c[2];
    for (const t of tiles) {
      const k0 = t.tx * TW + t.ty;
      if (!t.cap || usedC[k0]) continue;
      const [asset, dirs, d] = t.cap;
      let len = 1, px = 0, py = 0;
      if (asset === 'PB_DefaultMicroWedge') {
        [px, py] = dirs[0][0] ? [0, 1] : [1, 0];
        while (len < 20) { const o = tileAt.get((t.tx + px * len) * TW + t.ty + py * len); if (!o || o.base !== t.base || ck(o.cap) !== ck(t.cap) || usedC[(t.tx + px * len) * TW + t.ty + py * len]) break; len++; }
      }
      for (let m = 0; m < len; m++) usedC[(t.tx + px * m) * TW + t.ty + py * m] = 1;
      const ext = [px ? len * 10 : 10, py ? len * 10 : 10, d / 2];
      bricks.push({ asset, ...orientFor(asset, dirs, ext), position: [wx(t.tx * 2) + ext[0], wy(t.ty * 2) + ext[1], t.base + d / 2], color: PC, ride: 1 });
      rideBricks++;
    }
  }
  // road tunnels (2026-10-16, owner: "when paths cut through caves it looks really bad": the floor
  // was 1-brick steps with a wedge each, the ceiling a brick step per cell): a ceiling skin hanging
  // under the bored ceiling, TUNNEL_CLEAR over the ride surface at every tile corner (never above
  // the bore), micro brick fill from the bore down to its highest corner and the same cap pieces
  // turned upside down (half a turn about x: y mirrored, so the pattern is picked y-mirrored first)
  const TUNNEL_CLEAR = tune('road.tunnelClear', 66, 'tunnel ceiling skin: units over the ride surface');
  const FLIP = o => {
    const c = o.direction * 4 + o.rotation, ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const want = ax.map(v => { const [a, b, d] = ORIENT[c](v); return [a + 0, -b + 0, -d + 0].join(); });
    const c2 = ORIENT.findIndex(f => ax.every((v, i) => f(v).map(q => q + 0).join() === want[i]));
    return { ...o, direction: c2 >> 2, rotation: c2 & 3 };
  };
  const skinLo = new Map();
  let skin = 0;
  for (const t of tiles) {
    const cx = t.tx >> 1, cy = t.ty >> 1, zr = tunnelZ[cx * N + cy];
    if (zr < 0) continue;
    if (CUT_ON && !V[vi(cx, cy, zr + TUNNEL.high + 1)]) continue; // no rock over the bore (open cut): no skin to hang
    const top = (zr + 1 + TUNNEL.high) * VZ;
    const ROCK = MATS[V[vi(cx, cy, zr + TUNNEL.high + 1)]]?.color ?? MATS[STONE].color; // the bore's own rock
    const hc = t.h.map(v => Math.min(top, v + TUNNEL_CLEAR));
    const hi = Math.max(...hc), lo = Math.min(...hc), d = hi - lo;
    skinLo.set(t.tx * TW + t.ty, lo);
    if (top - hi >= 2) { bricks.push({ asset: 'PB_DefaultMicroBrick', position: [wx(t.tx * 2) + 10, wy(t.ty * 2) + 10, (hi + top) / 2], size: [10, 10, (top - hi) / 2], color: ROCK, ride: 1 }); skin++; }
    if (!d) continue;
    // corners hanging lowest = "up" for the flipped piece; corner (sx, sy) lands at (sx, -sy) after the flip
    const deep = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter((_, k) => hc[k] - lo <= d / 2).map(([sx, sy]) => [sx, -sy]);
    const has = (sx, sy) => deep.some(([a, b]) => a === sx && b === sy);
    let cap = null;
    if (deep.length === 1) cap = ['PB_DefaultMicroWedgeCorner', [[deep[0][0], 0], [0, deep[0][1]]]];
    else if (deep.length === 3) { const [lx, ly] = [[-1, -1], [1, -1], [-1, 1], [1, 1]].find(([a, b]) => !has(a, b)); cap = ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]]]; }
    else if (deep.length === 2) {
      const [[ax, ay], [bx, by]] = deep;
      if (ax === bx) cap = ['PB_DefaultMicroWedge', [[ax, 0]]]; else if (ay === by) cap = ['PB_DefaultMicroWedge', [[0, ay]]];
    }
    if (!cap) { bricks.push({ asset: 'PB_DefaultMicroBrick', position: [wx(t.tx * 2) + 10, wy(t.ty * 2) + 10, hi - d / 2], size: [10, 10, d / 2], color: ROCK, ride: 1 }); skin++; continue; } // saddle: flat at the lowest
    const o = FLIP(orientFor(cap[0], cap[1], [10, 10, d / 2]));
    bricks.push({ asset: cap[0], ...o, position: [wx(t.tx * 2) + 10, wy(t.ty * 2) + 10, hi - d / 2], color: ROCK, ride: 1 });
    skin++;
  }
  // ceiling lights where the 4 tiles round a lit cell's centre meet, just under their lowest point
  for (const [x, y] of tunnelLights) {
    const tx = x * 2, ty = y * 2;
    const los = [[0, 0], [-1, 0], [0, -1], [-1, -1]].map(([a, b]) => skinLo.get((tx + a + 1) * TW + ty + b + 1)).filter(v => v !== undefined);
    if (los.length < 4) continue;
    bricks.push({ asset: 'PB_DefaultMicroBrick', size: [6, 6, 2], color: [255, 200, 130], material: 'BMC_Glow', material_intensity: 5, position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, Math.min(...los) - 2] });
  }
  console.error(`ride surface: ${studs.length} road studs, ${tiles.length} tiles, ${rideBricks} bricks, tunnel ceiling skin ${skin} bricks`);
}
// --gaps: count cells still below an orthogonal neighbour with no piece, by step height
if (args.includes('--gaps')) {
  const by = {};
  for (let x = 1; x < N - 1; x++)
    for (let y = 1; y < N - 1; y++) {
      const h = H[x * N + y];
      if (rampCol[x * N + y] || h + 1 <= SEA || V[vi(x, y, h)] === 0 || V[vi(x, y, h + 1)] !== 0) continue;
      if (townKind[x * N + y] || villageDist(x, y) <= VILLAGE.r || noSmooth[x * N + y]) continue;
      const r = Math.max(...[[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => H[(x + dx) * N + y + dy] - h));
      if (r > 0) by[Math.min(r, 12)] = (by[Math.min(r, 12)] ?? 0) + 1;
    }
  console.error('unsmoothed cells by tallest step (bricks):', JSON.stringify(by));
}

// --probe x,y (world units): print terrain heights (bricks above sea level 0)
// round that point and mark smoothed cells with *, to debug the smoothing
if (opt('--probe', null)) {
  const [px, py] = opt('--probe').split(',').map(Number);
  const cx = Math.floor((px - X0) / CELL), cy = Math.floor((py - Y0) / CELL);
  console.error(`probe cell ${cx},${cy}; rows +y at top, columns -x..+x`);
  for (let y = cy + 4; y >= cy - 4; y--) {
    let row = '';
    for (let x = cx - 4; x <= cx + 4; x++) row += (inMap(x, y) ? String(H[x * N + y]) + (rampCol[x * N + y] ? '*' : ' ') : ' -  ').padStart(5) + (x === cx && y === cy ? '<' : ' ');
    console.error(row);
  }
  // flags: P path, G graded road, R river, T town, V hamlet, K keepOut, N noSmooth, B bridge deck (deck)
  for (let y = cy + 4; y >= cy - 4; y--) {
    let row = '';
    for (let x = cx - 4; x <= cx + 4; x++) { const c = x * N + y; row += ((pathCell[c] ? 'P' : '') + (roadGraded[c] ? 'G' : '') + (riverCell[c] ? 'R' : '') + (townDist(x, y) <= 0 ? 'T' : '') + (villageDist(x, y) <= VILLAGE.r ? 'V' : '') + (keepOut[c] ? 'K' : '') + (noSmooth[c] ? 'N' : '') || '.').padStart(6); }
    console.error(row);
  }
}

stage('decor');
// ------------------------------------------------------------------ decor --
const at = (x, y, z) => [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, z * VZ];
// footpaths: still whole after the carvers? (a cave mouth's rock face or a carve could cut one;
// the cave search ran without them so no cave moved.) Then claim them: signs, details, trees,
// plants and checkpoints all keep off reserved cells
{
  let laid = 0, broken = 0;
  for (let c = 0; c < N * N; c++) {
    if (!footCell[c]) continue;
    const x = (c / N) | 0, y = c % N;
    if (!FOOT_MATS.includes(surfaceMat[c]) || V[vi(x, y, H[c])] === 0) { broken++; if (broken <= 5) console.error(`footpaths: cell ${x},${y} lost to the carvers`); }
    reserved[c] = 1; laid++;
  }
  console.error(`footpaths: ${laid} cells reserved, ${broken} cut by the carvers`);
}
// ---------------------------------------- ruins, goblin camps, details --
// (ruins.mjs) each through its own overlap guard; their cells are reserved, so
// the trees, boulders and plants below keep off them
const details = { count: 0, kinds: {} }, pots = [], casinoGames = [], wildShops = [];
for (const at of sewerPots) pots.push({ at, where: 'sewer' });
for (const d of DUNGEONS) for (const at of d.keepPots ?? []) pots.push({ at, where: 'keep hall' });
{
  const wrap = (ox, oy, oz) => { const b = makeBuilder(); return { b, put: (br, x, y, z) => b.add({ ...br, position: [ox + x, oy + y, oz + z] }, br.asset ?? 'box'), free: (x0, y0, z0, x1, y1, z1) => b.free([ox + x0, oy + y0, oz + z0], [ox + x1, oy + y1, oz + z1]) }; };
  // procedural sizes off the grid would load as "Missing brick type": drop and count them
  let offGridDrops = 0;
  const keep = br => {
    const a = br.asset ?? '';
    if (/^PB_Default/.test(a) && !/^PB_DefaultMicro/.test(a) && !br.gameSize && (br.size[0] % 5 || br.size[1] % 5 || br.size[2] % 2)) { offGridDrops++; return false; }
    return true;
  };
  const spawn = (x, y, z, prefab, what) => spawners.push({ at: [x, y, z], prefab, dungeon: what, level: 0 });
  // smashable pots (prefab "pot", plugins/pots): where the site's builder has nothing in the way
  const potAt = (w, ox, oy, oz, list, where) => {
    for (const [x, y] of list || []) {
      const px = Math.round((ox + x) / 10) * 10, py = Math.round((oy + y) / 10) * 10;
      if (!w.b.free([px - 12, py - 12, oz], [px + 12, py + 12, oz + 26])) continue;
      pots.push({ at: [px, py, oz + 12], where });
    }
  };
  for (const v of ruins) {
    const o = at(v.x, v.y, v.h + 1), w = wrap(o[0] - CELL / 2, o[1] - CELL / 2, o[2]);
    const st = buildSettlement({ seed: v.seed, rnd: townRnd, put: w.put, orientFor });
    for (const { label, ...b } of w.b.bricks) if (keep(b)) bricks.push(b);
    for (const [x, y, z, prefab] of st.spots) spawn(o[0] - CELL / 2 + x, o[1] - CELL / 2 + y, o[2] + z, prefab, 'Abandoned settlement');
    potAt(w, o[0] - CELL / 2, o[1] - CELL / 2, o[2], st.pots, 'ruins');
    v.goblins = st.spots.length;
  }
  // goblin camps at the clearings picked before the voxels
  for (const [k, v] of camps.entries()) {
    const o = at(v.x, v.y, v.h + 1), w = wrap(o[0] - CELL / 2, o[1] - CELL / 2, o[2]);
    const st = buildCamp({ seed: 14000 + k, rnd: townRnd, put: w.put, orientFor });
    for (const { label, ...b } of w.b.bricks) if (keep(b)) bricks.push(b);
    for (const [sx, sy, sz, prefab] of st.spots) spawn(o[0] - CELL / 2 + sx, o[1] - CELL / 2 + sy, o[2] + sz, prefab, 'Goblin camp');
    potAt(w, o[0] - CELL / 2, o[1] - CELL / 2, o[2], st.pots, 'camp');
    v.goblins = st.spots.length;
  }
  // (weapon shops' wares and the gods are given out in the footpaths stage: its dry builds need them)
  for (const v of holy) {
    const o = at(v.x, v.y, v.h + 1), w = wrap(o[0] - CELL / 2, o[1] - CELL / 2, o[2]);
    const st = buildTown({ put: w.put, free: w.free, orientFor, rnd: townRnd, plan: null, single: { type: v.kind, seed: v.seed, god: v.god, facing: v.facing, wares: v.wares } });
    for (const hs of st.houseShops ?? []) wildShops.push({ at: [o[0] - CELL / 2 + hs.at[0], o[1] - CELL / 2 + hs.at[1], o[2] + hs.at[2]], tier: hs.tier, orient: hs.orient, house: true, ...(hs.prefab ? { prefab: hs.prefab } : {}) });
    if (v.wares) console.error(`${v.kind}: cells ${v.x},${v.y}, ${Math.round(townDist(v.x, v.y))} cells from the town, ${(st.houseShops ?? []).length} stands`);
    if (st.casino) {
      const ox = o[0] - CELL / 2, oy = o[1] - CELL / 2, oz = o[2];
      for (const gm of st.casino.games) casinoGames.push({ prefab: gm.prefab, at: [ox + gm.at[0], oy + gm.at[1], oz + gm.at[2]], orient: gm.orient });
      for (const sf of st.casino.staff) spawners.push({ at: [ox + sf.at[0], oy + sf.at[1], oz + sf.at[2]], prefab: sf.prefab, dungeon: 'Casino', level: 0 });
      console.error(`casino: cells ${v.x},${v.y}, ${Math.round(townDist(v.x, v.y))} cells from the town, ${st.casino.games.length} games, ${st.casino.staff.length} staff`);
    }
    if (w.b.dropped.length && !process.env.MAPGEN_LENIENT) throw new Error(`${v.kind} at ${v.x},${v.y}: ${w.b.dropped.length} bricks overlap, e.g. ${w.b.dropped[0]}`);
    for (const { label, ...b } of w.b.bricks) if (keep(b)) bricks.push(b);
  }
  console.error(`gods: ${holy.filter(v => v.god).map(v => `${v.kind} of ${v.god.name} ${v.god.epithet}`).join('; ')}`);
  // signs (2026-10-06, owner: "town signs"): the town's name outside each gate, each
  // hamlet's name and what its smiths sell where the road comes in, "Ruins of ..." at
  // the ruins; on a free flat cell beside the road, the board facing the traveller
  const signs = [];
  const signAt = (x, y, out, text, broken) => {
    // look for a free flat cell within 6 of (x, y), off the road
    for (let r = 0; r <= 6; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
      const cx = Math.round(x) + a, cy = Math.round(y) + b, c = cx * N + cy;
      if (!inBounds(cx, cy) || pathCell[c] || keepOut[c] || rampCol[c] || capCol[c] || H[c] <= SEA || townDist(cx, cy) <= 0) continue;
      if (reserved[c] && !broken) continue;
      // the boards overhang the cell: nothing round it higher, so no smoothing piece reaches them (2026-10-12)
      if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([p, q]) => hAt(cx + p, cy + q) > H[c])) continue;
      const o = at(cx, cy, H[c] + 1), w = wrap(o[0] - CELL / 2, o[1] - CELL / 2, o[2]);
      buildSign({ put: w.put, text, facing: out, broken });
      if (w.b.dropped.length) continue;
      for (const { label, ...b } of w.b.bricks) if (keep(b)) bricks.push(b);
      reserved[c] = 1;
      signs.push({ text, at: o.map(Math.round) });
      return true;
    }
    return false;
  };
  const axisOf = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1]);
  for (const g of townGates) {
    // 3 cells out from the gate, 3 to the side of the road, facing out along it
    const [a, b] = g.dir, px = g.edge[0] + a * 3 - b * 3, py = g.edge[1] + b * 3 + a * 3;
    signAt(px, py, [a, b], TOWN_NAME);
  }
  for (const v of villages) {
    v.name = placeName(v.seed, townRnd);
    const tiers = [...new Set((v.shops || []).filter(w => w.prefab.startsWith('shop_')).map(w => w.tier))];
    const text = tiers.length ? `${v.name}\n${tiers.join(' & ')} smiths` : v.nordic ? `${v.name}\nmead hall` : v.name;
    const sp = v.entry ?? v.plan.spokes[0], L = Math.hypot(...sp.end) || 1, ux = sp.end[0] / L, uy = sp.end[1] / L;
    // walk out along the lane until just past the hamlet's ground, then step to the side
    let t = L / CELL;
    while (t < L / CELL + 30 && villageDist(Math.round(v.x + ux * t), Math.round(v.y + uy * t)) <= VILLAGE.r + 1) t++;
    signAt(v.x + ux * (t + 1) - uy * 3, v.y + uy * (t + 1) + ux * 3, axisOf(ux, uy), text);
  }
  for (const v of ruins) {
    v.name = placeName(v.seed + 500, townRnd);
    // on the edge of the ruins toward the nearest road
    let best = null;
    for (let a = 0; a < 16; a++) { const ang = (a * Math.PI) / 8, x = Math.round(v.x + Math.cos(ang) * (RUINS.r - 1)), y = Math.round(v.y + Math.sin(ang) * (RUINS.r - 1)); if (inBounds(x, y) && (!best || pathDist[x * N + y] < best[2])) best = [x, y, pathDist[x * N + y], ang]; }
    if (best) signAt(best[0], best[1], axisOf(Math.cos(best[3]), Math.sin(best[3])), `Ruins of\n${v.name}`, true);
  }
  console.error(`signs: ${signs.length} (${signs.map(s => s.text.split('\n')[0]).join(', ')})`);

  // details: single flat cells off the paths; logs and carts take two in a row
  const COUNT = Math.round(tune('details.count', 250, 'random details: logs, cairns, carts... (x K)') * K);
  const okCell = c => !(pathCell[c] || keepOut[c] || reserved[c] || rampCol[c] || capCol[c] || townNear[c] || swampCell[c] || siteOff(c));
  // (2026-10-15) tries count per slot: a spot lost to a local change (the delta) re-rolls
  // only its own slot instead of shifting every later detail across the map
  for (let n = 0, tries = 0; n < COUNT; tries++) {
    if (tries >= 200) { n++; tries = -1; continue; }
    const x = 6 + Math.floor(hash(n, tries, 601) * (N - 12)), y = 6 + Math.floor(hash(n, tries, 602) * (N - 12)), i = x * N + y, h = H[i];
    if (h <= SEA + 1 || !okCell(i) || townDist(x, y) <= TOWN.blend || villageDist(x, y) <= VILLAGE.r + 2 || hengeDist(x, y) <= 3) continue;
    // (a cell with no smoothing piece in it is flat on top: okCell checks rampCol / capCol)
    const u = hash(x, y, 603), dw = desertW(x, y), nearRoad = pathDist[i] <= 1.5;
    let kind;
    if (nearRoad) kind = u < 0.5 ? 'signpost' : u < 0.8 ? 'cart' : 'stump';
    else if (pathDist[i] < 3) continue; // keep the verges clear
    else if (dw > 0.5) kind = u < 0.45 ? 'bones' : u < 0.7 ? 'cairn' : u < 0.85 ? 'cart' : 'firering';
    else if (h > 96) kind = u < 0.7 ? 'cairn' : 'shrine';
    else kind = u < 0.24 ? 'log' : u < 0.44 ? 'stump' : u < 0.58 ? 'mushrooms' : u < 0.7 ? 'cairn' : u < 0.8 ? 'firering' : u < 0.88 ? 'bones' : u < 0.95 ? 'cart' : 'shrine';
    const alongX = hash(x, y, 604) < 0.5, two = kind === 'log' || kind === 'cart';
    const x2 = alongX ? x + 1 : x, y2 = alongX ? y : y + 1;
    if (two && (!inBounds(x2, y2) || H[x2 * N + y2] !== h || !okCell(x2 * N + y2))) continue;
    const o = at(x, y, h + 1), w = wrap(o[0] - CELL / 2, o[1] - CELL / 2, o[2]);
    buildDetail(kind, { seed: 15000 + n, rnd: townRnd, put: w.put, orientFor, alongX });
    for (const { label, ...b } of w.b.bricks) if (keep(b)) bricks.push(b);
    reserved[i] = 1; if (two) reserved[x2 * N + y2] = 1;
    details.kinds[kind] = (details.kinds[kind] || 0) + 1; details.count++; n++; tries = -1;
  }
  console.error(`settlements ${ruins.length} (${ruins.reduce((a, v) => a + (v.goblins || 0), 0)} goblins), camps ${camps.length} (${camps.reduce((a, c) => a + c.goblins, 0)} goblins), details ${details.count} ${JSON.stringify(details.kinds)}${offGridDrops ? `, ${offGridDrops} off-grid pieces dropped` : ''}`);
}
stage('forest');
let trees = 0, treeBricks = 0;
let forestStats = {};
const treeKinds = {}, forestWood = new Map(), forestLeaves = new Map(), forestColors = [];
const treeAt = []; // [x, y] world, to keep canopies (up to 60 units across) apart
// trees: at most one per 4x4 block of cells
for (let bx = 0; bx < N; bx += 4)
  for (let by = 0; by < N; by += 4) {
    const x = bx + Math.floor(hash(bx, by, 1) * 4), y = by + Math.floor(hash(bx, by, 2) * 4);
    if (!inMap(x, y)) continue;
    const s = surfaceMat[x * N + y];
    const snowy = s === SNOW && Math.max(snowW(x, y), nordicSnowW(x, y)) > 0.3 && H[x * N + y] < 140; // the snow biome's pines (2026-10-10)
    const dead = deathW[x * N + y] > 0.3 && (DEADGRASS.includes(s) || s === ROT); // the death forest: dead black trees, packed close
    if (!GRASS.includes(s) && !(ROCK.includes(s) && H[x * N + y] < 100) && !snowy && !dead) continue;
    const h = H[x * N + y];
    if (V[vi(x, y, h)] === 0) continue; // a cave mouth ate the ground
    const forest = fbm2((X0 + x * CELL) / 1500, (Y0 + y * CELL) / 1500, 2);
    if (hash(bx, by, 3) > (dead ? 0.6 : 0.25 + forest * 0.9)) continue;
    const trunk = 6 + Math.floor(hash(x, y, 4) * 6); // bricks
    // keep canopies (from about the trunk top, 1.5 cells across) out of hillsides
    let crowded = false;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const lim = Math.max(Math.abs(dx), Math.abs(dy)) <= 1 ? trunk - 3 : trunk + 4;
      if (hAt(x + dx, y + dy) > h + lim) crowded = true;
    }
    if (rampCol[x * N + y] || caves.some(c => Math.hypot(c.x - x, c.y - y) < 4) || townNear[x * N + y] || keepOut[x * N + y] || pathCell[x * N + y] || villageDist(x, y) <= VILLAGE.r + 3 || hengeDist(x, y) <= 3 || reserved[x * N + y]) crowded = true;
    const [tx, ty] = at(x, y, 0);
    if (treeAt.some(([px, py]) => Math.max(Math.abs(px - tx), Math.abs(py - ty)) < 130)) crowded = true;
    if (crowded) continue;
    // (owner 2026-10-12: "put those new trees in", "greedy remesh into the
    // geometry") grown trees from trees/tree.mjs: every tree's voxels go into one
    // world grid (wood 4 units, leaves 8), clipped against the ground and kept
    // low clear of built things, then the whole forest is greedy-merged below.
    // Pines up high and in the snow, willows by the river, else a mix.
    const [wx, wy, wz] = at(x, y, h + 1);
    let wet = false;
    for (let dx = -4; dx <= 4 && !wet; dx++) for (let dy = -4; dy <= 4; dy++) if (inMap(x + dx, y + dy) && riverCell[(x + dx) * N + y + dy]) { wet = true; break; }
    const roll = hash(x, y, 5);
    const kind = dead ? 'dead' : h > 60 || snowy ? 'pine' : wet && roll < 0.6 ? 'willow' : roll < 0.4 ? 'oak' : roll < 0.6 ? 'birch' : roll < 0.8 ? 'autumn' : roll < 0.9 ? 'cherry' : 'pine';
    const tv = treeVoxels(kind, 1 + Math.floor(hash(x, y, 6) * 1e6), dead ? 0.75 + hash(x, y, 7) * 0.35 : 0.7 + hash(x, y, 7) * 0.3);
    if (dead) tv.colors = tv.colors.map((c, k) => c.map((v, a) => Math.round(v * 0.38 + (a === 0 && k === 1 ? 10 : 0)))); // charred black bark
    // origin on the 8-unit grid so every tree's leaves share one lattice
    const ox = Math.round(wx / 8) * 8, oy = Math.round(wy / 8) * 8, oz = Math.floor(wz / 8) * 8;
    const ci = tv.colors.map(c => { const k = c.join(); let i = forestColors.findIndex(f => f.join() === k); if (i < 0) i = forestColors.push(c) - 1; return i; });
    let R = 0;
    for (const [key, c] of tv.wood) { const [i, j, k] = key.split(',').map(Number); const g = (ox / 4 + i) + ',' + (oy / 4 + j) + ',' + (oz / 4 + k); if (!forestWood.has(g)) forestWood.set(g, ci[c]); }
    for (const [key, c] of tv.leaves) { const [i, j, k] = key.split(',').map(Number); R = Math.max(R, Math.abs(i * 8 + 4), Math.abs(j * 8 + 4)); const g = (ox / 8 + i) + ',' + (oy / 8 + j) + ',' + (oz / 8 + k); if (!forestLeaves.has(g)) forestLeaves.set(g, ci[c]); }
    treeKinds[kind] = (treeKinds[kind] ?? 0) + 1;
    trees++;
    treeAt.push([wx, wy, R]);
  }
// the delta's willows (2026-10-15): on the higher marsh, after every other tree so the
// forest pool (and its meshing) elsewhere stays as it was
if (delta) {
  const Ax = Math.round(delta.A[0]), Ay = Math.round(delta.A[1]), r0 = Math.ceil(delta.U + 30);
  for (let bx = (Math.max(0, Ax - r0) >> 2) << 2; bx <= Ax + r0; bx += 4)
    for (let by = (Math.max(0, Ay - r0) >> 2) << 2; by <= Ay + r0; by += 4) {
      const x = bx + Math.floor(hash(bx, by, 1) * 4), y = by + Math.floor(hash(bx, by, 2) * 4), c = x * N + y;
      if (!inMap(x, y) || deltaCell[c] !== 3 || H[c] < SEA + 2 || hash(bx, by, 1505) > 0.22 || rampCol[c] || keepOut[c] || V[vi(x, y, H[c])] === 0) continue;
      let flat = true; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (hAt(x + a, y + b) > H[c] + 1) flat = false;
      const [wx, wy, wz] = at(x, y, H[c] + 1);
      if (!flat || treeAt.some(([qx, qy]) => Math.max(Math.abs(qx - wx), Math.abs(qy - wy)) < 130)) continue;
      const tv = treeVoxels('willow', 1 + Math.floor(hash(x, y, 6) * 1e6), 0.7 + hash(x, y, 7) * 0.3);
      const ox = Math.round(wx / 8) * 8, oy = Math.round(wy / 8) * 8, oz = Math.floor(wz / 8) * 8;
      const ci = tv.colors.map(cc => { const k = cc.join(); let i = forestColors.findIndex(f => f.join() === k); if (i < 0) i = forestColors.push(cc) - 1; return i; });
      for (const [key, cc] of tv.wood) { const [i, j, k] = key.split(',').map(Number); const g = (ox / 4 + i) + ',' + (oy / 4 + j) + ',' + (oz / 4 + k); if (!forestWood.has(g)) forestWood.set(g, ci[cc]); }
      for (const [key, cc] of tv.leaves) { const [i, j, k] = key.split(',').map(Number); const g = (ox / 8 + i) + ',' + (oy / 8 + j) + ',' + (oz / 8 + k); if (!forestLeaves.has(g)) forestLeaves.set(g, ci[cc]); }
      treeKinds['delta willow'] = (treeKinds['delta willow'] ?? 0) + 1; trees++; treeAt.push([wx, wy, 60]);
    }
}
// cove dressing (cove.mjs): computed here so its trees join the forest pool
const coveZone = (wx, wy) => {
  const x = Math.floor((wx - X0) / CELL), y = Math.floor((wy - Y0) / CELL);
  if (!inMap(x, y)) return null;
  const k = coveCell[x * N + y];
  return k === 1 || k === 4 ? 'water' : k === 2 ? 'beach' : k === 3 ? 'rim' : H[x * N + y] <= SEA - 2 && !riverCell[x * N + y] ? 'sea' : null;
};
const coveGround = (wx, wy) => { const x = Math.floor((wx - X0) / CELL), y = Math.floor((wy - Y0) / CELL); return (hAt(x, y) + 1) * VZ; };
const coveDress = coves.map((cv, n) => coveDressing({ cx: X0 + (cv.x + 0.5) * CELL, cy: Y0 + (cv.y + 0.5) * CELL, nx: cv.nx, ny: cv.ny, R: cv.R * CELL, seed: 9100 + n, head: { x: X0 + (cv.head.x + 0.5) * CELL, y: Y0 + (cv.head.y + 0.5) * CELL, ax: cv.head.ax, ay: cv.head.ay, tx: cv.head.tx, ty: cv.head.ty }, cliffTop: (SEA + 1 + tune('cove.cliff', 30, 'cove cliff height over the sea, bricks')) * VZ }, { ground: coveGround, water: WATER_Z, zone: coveZone }));
for (const d of coveDress)
  for (const t of d.trees) {
    const tv = treeVoxels(t.kind, t.seed, t.size);
    const ox = Math.round(t.x / 8) * 8, oy = Math.round(t.y / 8) * 8, oz = Math.floor(t.z / 8) * 8;
    const ci = tv.colors.map(c => { const k = c.join(); let i = forestColors.findIndex(f => f.join() === k); if (i < 0) i = forestColors.push(c) - 1; return i; });
    for (const [key, c] of tv.wood) { const [i, j, k] = key.split(',').map(Number); const g = (ox / 4 + i) + ',' + (oy / 4 + j) + ',' + (oz / 4 + k); if (!forestWood.has(g)) forestWood.set(g, ci[c]); }
    for (const [key, c] of tv.leaves) { const [i, j, k] = key.split(',').map(Number); const g = (ox / 8 + i) + ',' + (oy / 8 + j) + ',' + (oz / 8 + k); if (!forestLeaves.has(g)) forestLeaves.set(g, ci[c]); }
    treeKinds['cove ' + t.kind] = (treeKinds['cove ' + t.kind] ?? 0) + 1; trees++;
  }
// the forest: every tree's voxels pooled (see the tree loop above) and placed
// through props.mjs in 'smooth' mode: parts inside anything already built (terrain,
// smoothing pieces) are cut away, trunks get fillers down to sloping ground, and
// low down (within 10 bricks of the ground) the forest stays clear of built-up cells
const canopyLow = new Uint8Array(N * N); // tree bricks near the ground here: no boulders / plants
{
  const groundTop = c => (H[c] + 1 + (rampCol[c] ? rampK[c] : 0) + (capCol[c] ? 1 : 0)) * VZ;
  const builtUp = (cx, cy) => { const c = cx * N + cy; return pathCell[c] || townNear[c] || keepOut[c] || reserved[c] || villageDist(cx, cy) <= VILLAGE.r + 1 || hengeDist(cx, cy) <= 2; };
  const cellsOf = (lo, hi, fn) => { for (let cx = Math.floor((lo[0] - X0) / CELL); cx <= Math.floor((hi[0] - 1 - X0) / CELL); cx++) for (let cy = Math.floor((lo[1] - Y0) / CELL); cy <= Math.floor((hi[1] - 1 - Y0) / CELL); cy++) if (fn(cx, cy) === false) return false; return true; };
  const occ = makeOccupancy(bricks);
  const placed = placeVoxelProp(occ, { grids: [{ vox: forestWood, V: 4, colors: forestColors, wood: true }, { vox: forestLeaves, V: 8, colors: forestColors }] }, {
    mode: 'smooth', skirt: 24, skirtGrid: g => g.wood,
    keep: (lo, hi) => cellsOf(lo, hi, (cx, cy) => inMap(cx, cy) && !(lo[2] < groundTop(cx * N + cy) + 120 && builtUp(cx, cy))),
    // nothing but terrain and its smoothing pieces stands in the forest, all below this
    mayHit: (lo, hi) => !cellsOf(lo, hi, (cx, cy) => lo[2] >= (H[cx * N + cy] + 2 + MAX_RISE) * VZ),
  });
  for (const b of placed) {
    bricks.push(b);
    treeBricks++;
    const lo = b.position.map((v, a) => v - b.size[a]), hi = b.position.map((v, a) => v + b.size[a]);
    cellsOf(lo, hi, (cx, cy) => { if (inMap(cx, cy) && lo[2] < groundTop(cx * N + cy) + 40) canopyLow[cx * N + cy] = 1; });
  }
  forestStats = { ...placed.stats };
}
// boulders: round rocks on grass and rock
let boulders = 0;
const boulderCells = [];
for (let bx = 2; bx < N; bx += 7)
  for (let by = 2; by < N; by += 7) {
    const x = bx + Math.floor(hash(bx, by, 11) * 5), y = by + Math.floor(hash(bx, by, 12) * 5);
    if (!inMap(x, y) || hash(bx, by, 13) > 0.18) continue;
    const s = surfaceMat[x * N + y];
    const h = H[x * N + y];
    if (!(GRASS.includes(s) || ROCK.includes(s)) || V[vi(x, y, h)] === 0) continue;
    if (rampCol[x * N + y] || canopyLow[x * N + y] || townNear[x * N + y] || keepOut[x * N + y] || villageDist(x, y) <= VILLAGE.r + 2 || hengeDist(x, y) <= 2 || reserved[x * N + y]) continue;
    const [wx, wy, wz] = at(x, y, h + 1);
    const grey = [[118, 114, 108], [100, 98, 94]][Math.floor(hash(x, y, 14) * 2)];
    bricks.push({ asset: 'B_4x4_Round', position: [wx, wy, wz + 6], size: [0, 0, 0], color: grey });
    bricks.push({ asset: 'B_2x2_Round', position: [wx + (hash(x, y, 15) < 0.5 ? -10 : 10), wy, wz + 18], size: [0, 0, 0], color: grey });
    boulders++;
    boulderCells.push(x * N + y);
  }
stage('plants');
// ---------------------------------------------------------------- plants --
// Brickadia's plant bricks over the grass (ferns and bushes in the woods,
// flower meadows in patches of one colour), then the swamp: lily pads on the
// pools, rushes, dead trees, turd piles and the zombie spawners.
// A plant needs its own cell clear (ground, no smoothing wedge, nothing
// standing there); tall ones stay out from under tree canopies; the leaf bush
// is wider than a cell, so its whole 3 x 3 must be flat and free.
// Collision half extents measured in-game (sky probes, 2026-10-02).
const PLANT = {
  B_Fern: [10, 10, 2], B_Flower: [10, 10, 2], B_Small_Flower: [6, 6, 2], B_Tulip: [6, 6, 6], B_Rose: [6, 6, 4],
  B_Bush: [14, 14, 16], B_Leaf_Bush: [26, 26, 20], B_Pine_Tree: [16, 16, 38], B_Branch: [20, 10, 2],
  B_Lotus_1x1: [6, 6, 4], B_Lotus_2x2: [10, 10, 6], B_Pumpkin: [10, 10, 8],
};
const blocked = new Uint8Array(N * N); // something stands here
for (let c = 0; c < N * N; c++) if (coveCell[c]) blocked[c] = 1; // coves get their own dressing
const canopy = new Uint8Array(N * N);  // under a tree: short plants only
for (const [tx, ty, tr] of treeAt) {
  const cx = Math.floor((tx - X0) / CELL), cy = Math.floor((ty - Y0) / CELL);
  blocked[cx * N + cy] = 1;
  const rc = Math.ceil((tr ?? 60) / CELL);
  for (let dx = -rc; dx <= rc; dx++) for (let dy = -rc; dy <= rc; dy++) if (inMap(cx + dx, cy + dy)) canopy[(cx + dx) * N + cy + dy] = 1;
}
for (const c of boulderCells) blocked[c] = 1;
for (let c = 0; c < N * N; c++) if (canopyLow[c]) blocked[c] = 1; // low leaves / roots of the grown trees
for (const c of caves)
  for (let dx = -8; dx <= 8; dx++) for (let dy = -8; dy <= 8; dy++) if (inMap(c.x + dx, c.y + dy)) blocked[(c.x + dx) * N + c.y + dy] = 1;
const plantCount = {};
/** a plant (or prop) on cell (x, y); false if it doesn't fit */
/** a saguaro on cell (x, y): a ribbed pole trunk and one or two arms; false if it doesn't fit */
let cacti = 0;
function cactus(x, y) {
  const i = x * N + y, h = H[i];
  if (blocked[i] || rampCol[i] || capCol[i] || V[vi(x, y, h)] === 0) return false;
  const t = 5 + Math.floor(hash(x, y, 81) * 5); // trunk, bricks
  for (let z = h + 1; z <= Math.min(NZ - 1, h + t + 1); z++) if (V[vi(x, y, z)]) return false;
  const [wx, wy, wz] = at(x, y, h + 1);
  const green = [[70, 118, 58], [62, 106, 52], [78, 126, 64]][Math.floor(hash(x, y, 82) * 3)];
  bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, wz + t * 6], size: [5, 5, t * 6], color: green });
  // arms: a short stub out of the trunk, then up; one each side at most, inside the cell
  [[1, 0], [-1, 0]].forEach(([dx], k) => {
    if (hash(x, y, 83 + k) < (k ? 0.55 : 0.2)) return;
    const az = wz + Math.min(t - 3, 2 + Math.floor(hash(x, y, 85 + k) * 3)) * 12;
    bricks.push({ asset: 'PB_DefaultMicroBrick', position: [wx + dx * 7, wy, az + 4], size: [2, 4, 4], color: green });
    bricks.push({ asset: 'PB_DefaultPole', position: [wx + dx * 14, wy, az + 24], size: [5, 5, 16], color: green });
  });
  blocked[i] = 1;
  cacti++;
  return true;
}
function plant(x, y, asset, color, { rot = 0, jitter = true, extra = {} } = {}) {
  const [px, py, hz] = PLANT[asset];
  const [ex, ey] = rot % 2 ? [py, px] : [px, py];
  const h = H[x * N + y], i0 = x * N + y;
  // on a smoothing piece: a flat fill of any height, or a 1-brick wedge with
  // the plant pushed to its high edge (it floats a few units at most)
  const lift = rampCol[i0] ? rampK[i0] : 0;
  const up = rampUp[i0] >= 2 ? DIR8[rampUp[i0] - 2] : null;
  if (rampCol[i0] && !(rampUp[i0] === 1 || (up && lift === 1))) return false;
  if (capCol[i0]) return false;
  const free = (cx, cy, base) => {
    const i = cx * N + cy;
    if (!inMap(cx, cy) || blocked[i] || (rampCol[i] && i !== i0) || H[i] !== h || V[vi(cx, cy, h)] === 0) return false;
    if (hz > 6 && canopy[i]) return false;
    for (let z = base + 1; z <= Math.min(NZ - 1, base + Math.ceil((2 * hz) / VZ)); z++) if (V[vi(cx, cy, z)]) return false;
    return true;
  };
  const wide = ex > 20 || ey > 20;
  if (lift && (wide || asset === 'B_Bush' || asset === 'B_Pine_Tree')) return false; // too broad to perch on a slope
  if (!free(x, y, h + lift)) return false;
  if (wide) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !free(x + dx, y + dy, h)) return false;
  // keep clear of the cell edge: the game rejects BOTH bricks when two just touch
  // (seen live with bushes and pines against the neighbouring wedges)
  const pad = asset === 'B_Bush' || asset === 'B_Pine_Tree' ? 4 : 2;
  const off = (m, k, u) => (m <= 0 ? 0 : u ? u * m : jitter ? 2 * Math.round(((hash(x, y, k) * 2 - 1) * m) / 2) : 0);
  const [wx, wy] = at(x, y, 0);
  bricks.push({ asset, size: [0, 0, 0], position: [wx + off(20 - ex - pad, 31, up?.[0]), wy + off(20 - ey - pad, 32, up?.[1]), (h + 1 + lift) * VZ + hz], color, ...(rot ? { rotation: rot } : {}), ...extra });
  if (wide) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked[(x + dx) * N + y + dy] = 1; }
  else blocked[x * N + y] = 1;
  plantCount[asset] = (plantCount[asset] ?? 0) + 1;
  return true;
}
const pickW = (table, r) => { // [[item, weight], ...]
  let t = r * table.reduce((a, [, w]) => a + w, 0);
  for (const [item, w] of table) if ((t -= w) < 0) return item;
  return table[table.length - 1][0];
};
const LEAF = [[70, 130, 50], [90, 150, 60], [60, 112, 46]];
const BLOOM = [[220, 50, 60], [240, 200, 50], [160, 90, 200], [240, 240, 245], [245, 140, 50], [240, 130, 170], [90, 130, 230]];

// zombie spawners on the swamp mud first, each with a clear 3 x 3
const swampSpawns = [];
{
  const cand = [];
  for (let x = swamp.x - SWAMP.r; x <= swamp.x + SWAMP.r; x++)
    for (let y = swamp.y - SWAMP.r; y <= swamp.y + SWAMP.r; y++)
      if (inMap(x, y) && swampCell[x * N + y] && H[x * N + y] >= SEA) cand.push([hash(x, y, 41), x, y]);
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, x, y] of cand) {
    if (swampSpawns.length >= 18) break;
    if (swampSpawns.some(s => Math.hypot(s.x - x, s.y - y) < 14)) continue;
    const h = H[x * N + y];
    let ok = true;
    for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) {
      const i = (x + dx) * N + y + dy;
      if (!swampCell[i] || H[i] !== h || rampCol[i] || blocked[i] || V[vi(x + dx, y + dy, h + 1)]) ok = false;
    }
    if (!ok) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked[(x + dx) * N + y + dy] = 1;
    swampSpawns.push({ x, y });
    const [wx, wy] = at(x, y, 0);
    spawners.push({ at: [wx, wy, (h + 1) * VZ + 2], prefab: hash(x, y, 42) < 0.7 ? 'swamp_zombie_1' : 'swamp_zombie_2', dungeon: 'Swamp', level: 0 });
  }
}

stage('checkpoints');
// checkpoints: on each dungeon's roof in the entrance pit (beside the bottom
// end of the stairwell, clear of its top), and where the swamp road ends.
// The hamlets' own sit by their wells (town.mjs).
const checkpoints = [];
// checkpoint shrines (checkpoint.mjs; owner 2026-10-13: "ornate works of masonry ... add more
// of them"): a shrine goes in only where none of its bricks touches anything already built
// (an index of every brick so far, kept up to date as shrines go in), else the plain checkpoint
const shrineIdx = (() => {
  const G = 200, m = new Map();
  const add = b => { const [lo, hi] = worldBox(b, BUILDER_FIXED); for (let x = Math.floor(lo[0] / G); x <= Math.floor((hi[0] - 1) / G); x++) for (let y = Math.floor(lo[1] / G); y <= Math.floor((hi[1] - 1) / G); y++) { const k = x + ',' + y; (m.get(k) ?? m.set(k, []).get(k)).push([lo, hi]); } };
  for (const b of bricks) add(b);
  const free = (lo, hi) => { for (let x = Math.floor(lo[0] / G); x <= Math.floor((hi[0] - 1) / G); x++) for (let y = Math.floor(lo[1] / G); y <= Math.floor((hi[1] - 1) / G); y++) for (const [a, z] of m.get(x + ',' + y) ?? []) if ([0, 1, 2].every(k => lo[k] < z[k] && a[k] < hi[k])) return false; return true; };
  return { add, free };
})();
let shrines = 0;
function placeShrine(wx, wy, gz, seed) {
  const sb = shrine(seed).map(b => ({ ...b, position: [b.position[0] + wx, b.position[1] + wy, b.position[2] + gz] }));
  if (!sb.every(b => { const [lo, hi] = worldBox(b, BUILDER_FIXED); return shrineIdx.free(lo, hi); })) return null;
  const cp = { asset: 'B_CheckPoint', size: [0, 0, 0], position: [wx, wy, gz + CHECKPOINT_AT[2]], color: [240, 200, 60] };
  for (const b of [...sb, cp]) { bricks.push(b); shrineIdx.add(b); }
  shrines++;
  return cp.position;
}
for (const d of DUNGEONS) {
  const [ex0, ey0, ex1, ey1] = d.out.entrance, alongX = d.out.entranceSide === 'S' || d.out.entranceSide === 'N';
  const [lx, ly] = alongX ? [ex0 - 40, (ey0 + ey1) / 2] : [(ex0 + ex1) / 2, ey0 - 40];
  let p = [d.origin[0] + lx, d.origin[1] + ly, d.topVox * VZ + 2];
  const sp = placeShrine(p[0], p[1], p[2] - 2, hash(lx, ly, 61) * 4 | 0);
  if (sp) p = sp;
  else { bricks.push({ asset: 'B_CheckPoint', size: [0, 0, 0], position: p, color: [240, 200, 60] }); shrineIdx.add(bricks[bricks.length - 1]); }
  checkpoints.push({ at: p, where: d.name, shrine: !!sp });
}
{
  const ends = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (pathCell[x * N + y] && !swampCell[x * N + y]) ends.push([Math.hypot(x - swamp.x, y - swamp.y), x, y]);
  ends.sort((a, b) => a[0] - b[0]);
  const fits = (x, y) => {
    const h = H[x * N + y];
    if (h <= SEA + 1 || V[vi(x, y, h)] === 0 || V[vi(x, y, h + 1)]) return false;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const i = (x + dx) * N + y + dy;
      if (!inMap(x + dx, y + dy) || H[i] !== h || rampCol[i] || blocked[i]) return false;
    }
    return true;
  };
  done: for (const [, ex, ey] of ends.slice(0, 40))
    for (let r = 0; r <= 6; r++)
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const x = ex + dx, y = ey + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inMap(x, y) || !fits(x, y)) continue;
        const [wx, wy, wz] = at(x, y, H[x * N + y] + 1);
        const sp = placeShrine(wx, wy, wz, x + y);
        if (!sp) bricks.push({ asset: 'B_CheckPoint', size: [0, 0, 0], position: [wx, wy, wz + 2], color: [240, 200, 60] });
        checkpoints.push({ at: sp ?? [wx, wy, wz + 2], where: 'Swamp road', shrine: !!sp });
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) blocked[(x + a) * N + y + b] = 1;
        break done;
      }
}

// roadside shrines: level spots 2-6 cells off a road, spread out (CP_SPACING cells apart
// and from every other checkpoint), wherever a whole shrine fits
{
  const WANT = tune('checkpoint.roadside', 40, 'roadside checkpoint shrines'), SPACING = tune('checkpoint.spacing', 22, 'cells between checkpoints') * K / 2;
  const near = new Int16Array(N * N).fill(99); // Chebyshev distance to a road, up to 4
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (pathCell[x * N + y]) for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) { const i = (x + a) * N + y + b; if (inMap(x + a, y + b)) near[i] = Math.min(near[i], Math.max(Math.abs(a), Math.abs(b))); }
  const cand = [];
  for (let x = 3; x < N - 3; x++) for (let y = 3; y < N - 3; y++) {
    const c = x * N + y, h = H[c];
    if (near[c] < 2 || near[c] > 6 || h <= SEA + 2 || keepOut[c] || reserved[c] || townNear[c] || swampCell[c] || volcanoCell[c] || formerVCell[c] || trenchCell[c] || riverCell[c]) continue;
    if (villageDist(x, y) <= VILLAGE.r + 4 || townDist(x, y) <= TOWN.blend || hengeDist(x, y) <= 4 || DUNGEONS.some(d => footDist(d, x, y) <= 3)) continue;
    let flat = true;
    // the middle 3 x 3 level; the shrine's outer ring (10 units into the next cells) is left to the brick check
    for (let a = -1; a <= 1 && flat; a++) for (let b = -1; b <= 1; b++) { const i = (x + a) * N + y + b; if (H[i] !== h || pathCell[i] || blocked[i] || rampCol[i] || capCol[i]) { flat = false; break; } }
    if (flat) cand.push([hash(x, y, 333), x, y]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const taken = checkpoints.map(c => [(c.at[0] - X0) / CELL, (c.at[1] - Y0) / CELL]);
  let placed = 0; const why = { spacing: 0, blocked: 0 };
  for (const [, x, y] of cand) {
    if (placed >= WANT) break;
    if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < SPACING)) { why.spacing++; continue; }
    const [wx, wy, wz] = at(x, y, H[x * N + y] + 1);
    const sp = placeShrine(wx, wy, wz, x * 3 + y);
    if (!sp) { why.blocked++; continue; }
    checkpoints.push({ at: sp, where: 'roadside', shrine: true });
    taken.push([x, y]);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { blocked[(x + a) * N + y + b] = 1; keepOut[(x + a) * N + y + b] = 1; }
    placed++;
  }
  console.error(`checkpoints: ${checkpoints.length} (${shrines} shrines, ${placed} roadside of ${WANT}, ${cand.length} flat spots, skipped ${JSON.stringify(why)})`);
}

stage('fingerposts');
// fingerposts (signpost.mjs; owner 2026-10-13: "make signs indicating where things are, like
// iron steel copper"): beside the roads, spread out, each pointing to its nearest places
// (what the hamlets sell, dungeons, the volcano, the swamp, the henge, the casino)
{
  const dest = [], NL = String.fromCharCode(10); // board text: name, newline, what is there
  const tc = [town.fx + TOWN.cells / 2, town.fy + TOWN.cells / 2];
  dest.push({ c: tc, text: TOWN_NAME + NL + 'Bronze & Iron swords', kind: 'town' });
  for (const v of villages) {
    if (!v.name) continue;
    const pre = (v.shops || []).map(w => w.prefab);
    const tiers = [...new Set((v.shops || []).filter(w => w.prefab.startsWith('shop_')).map(w => w.tier))].map(t => t[0].toUpperCase() + t.slice(1));
    const bows = pre.some(p => p.startsWith('bow_')), guns = v.desert;
    const wares = guns ? 'Gun store' : tiers.length ? `${tiers.join(' & ')} swords${bows ? ', bows' : ''}` : v.nordic ? 'Mead hall' : 'Hamlet';
    dest.push({ c: [v.x, v.y], text: v.name + NL + wares, kind: guns ? 'trade' : 'hamlet' });
  }
  for (const d of DUNGEONS) if (d.mouth) dest.push({ c: d.mouth, text: d.name + NL + 'Dungeon', kind: 'dungeon' });
  dest.push({ c: [volcano.x, volcano.y], text: 'Volcano' + NL + 'Lava', kind: 'hazard' });
  if (deathForest.cells) dest.push({ c: [deathForest.x, deathForest.y], text: 'Death Forest' + NL + 'Turn back', kind: 'hazard' });
  dest.push({ c: [swamp.x, swamp.y], text: 'The Swamp' + NL + 'Zombies', kind: 'hazard' });
  dest.push({ c: [henge.x0 + (henge.n >> 1), henge.y0 + (henge.n >> 1)], text: 'Wizard Henge' + NL + 'Evil wizards', kind: 'magic' });
  if (casinoGames.length) dest.push({ c: [(casinoGames[0].at[0] - X0) / CELL, (casinoGames[0].at[1] - Y0) / CELL], text: 'Casino' + NL + 'Slots & dice', kind: 'trade' });
  for (const v of holy) if (v.wares) {
    const tiers = [...new Set(v.wares.filter(w => !w.prefab).map(w => w.tier.split('_')[0]))].map(t => t[0].toUpperCase() + t.slice(1));
    dest.push({ c: [v.x, v.y], text: v.kind === 'armory' ? 'Armory' + NL + tiers.join(' & ') + ' swords' : 'Gunsmith' + NL + 'All the guns', kind: 'trade' });
  }
  // soda shacks are legacy (2026-10-21): no fingerpost boards to them
  if (false) for (const v of holy) if (v.kind === 'sodashack') dest.push({ c: [v.x, v.y], text: 'Soda' + NL + 'Heals (allegedly)', kind: 'trade' });
  const WANT = tune('signs.posts', 45, 'fingerposts beside the roads'), GAP = tune('signs.spacing', 26, 'cells between fingerposts') * K / 2;
  const near = new Int16Array(N * N).fill(99);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (pathCell[x * N + y]) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const i = (x + a) * N + y + b; if (inMap(x + a, y + b)) near[i] = Math.min(near[i], Math.max(Math.abs(a), Math.abs(b))); }
  const cand = [];
  for (let x = 3; x < N - 3; x++) for (let y = 3; y < N - 3; y++) {
    const c = x * N + y;
    if (near[c] !== 2 || H[c] <= SEA + 2 || keepOut[c] || reserved[c] || blocked[c] || townNear[c] || riverCell[c] || swampCell[c] || volcanoCell[c] || siteOff(c) || trenchCell[c] || rampCol[c] || capCol[c]) continue;
    if (villageDist(x, y) <= VILLAGE.r + 3 || townDist(x, y) <= TOWN.blend || hengeDist(x, y) <= 3 || DUNGEONS.some(d => footDist(d, x, y) <= 3)) continue;
    cand.push([hash(x, y, 909), x, y]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const posts = [], cps = checkpoints.map(c => [(c.at[0] - X0) / CELL, (c.at[1] - Y0) / CELL]);
  const axis = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1]);
  for (const [, x, y] of cand) {
    if (posts.length >= WANT) break;
    if (posts.some(([px, py]) => Math.hypot(px - x, py - y) < GAP) || cps.some(([px, py]) => Math.hypot(px - x, py - y) < 6)) continue;
    const near4 = dest.map(d => ({ ...d, dist: Math.hypot(d.c[0] - x, d.c[1] - y) })).filter(d => d.dist > 14).sort((a, b) => a.dist - b.dist).slice(0, 4);
    if (!near4.length) continue;
    const boards = near4.map(d => ({ dir: axis(d.c[0] - x, d.c[1] - y), text: d.text, kind: d.kind }));
    const [wx, wy, wz] = at(x, y, H[x * N + y] + 1);
    const sb = signpost(boards, x + y).map(b => ({ ...b, position: [b.position[0] + wx, b.position[1] + wy, b.position[2] + wz] }));
    if (!sb.every(b => { const [lo, hi] = worldBox(b, BUILDER_FIXED); return shrineIdx.free(lo, hi); })) continue;
    for (const b of sb) { bricks.push(b); shrineIdx.add(b); }
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { blocked[(x + a) * N + y + b] = 1; keepOut[(x + a) * N + y + b] = 1; }
    posts.push([x, y]);
  }
  console.error(`fingerposts: ${posts.length} of ${WANT} (${cand.length} spots, ${dest.length} destinations)`);
}

stage('swampDecor');
// swamp pools: the water plane fills them; lily pads float on top
{
  const kind = new Uint8Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++)
    if (swampCell[x * N + y] && H[x * N + y] < SEA) kind[x * N + y] = 1;
  // lily pads
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    if (!kind[x * N + y] || hash(x, y, 43) > 0.12) continue;
    const big = hash(x, y, 44) < 0.5, a = big ? 'B_Lotus_2x2' : 'B_Lotus_1x1', [ex, ey, hz] = PLANT[a];
    const [wx, wy] = at(x, y, 0);
    const off = (m, k) => 2 * Math.round(((hash(x, y, k) * 2 - 1) * m) / 2);
    bricks.push({ asset: a, size: [0, 0, 0], position: [wx + off(18 - ex, 45), wy + off(18 - ey, 46), WATER_Z + hz], color: hash(x, y, 47) < 0.8 ? [86, 128, 52] : [230, 150, 190] });
    plantCount[a] = (plantCount[a] ?? 0) + 1;
  }
}

// dead trees on the mud: bare grey trunks with branches sticking out
let deadTrees = 0;
for (let bx = swamp.x - SWAMP.r; bx <= swamp.x + SWAMP.r; bx += 5)
  for (let by = swamp.y - SWAMP.r; by <= swamp.y + SWAMP.r; by += 5) {
    const x = bx + Math.floor(hash(bx, by, 51) * 5), y = by + Math.floor(hash(bx, by, 52) * 5);
    if (!inMap(x, y) || !swampCell[x * N + y] || H[x * N + y] < SEA || hash(bx, by, 53) > 0.35) continue;
    const h = H[x * N + y];
    let ok = true;
    for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) {
      const i = (x + dx) * N + y + dy;
      if (!inMap(x + dx, y + dy) || blocked[i] || H[i] > h + 1) ok = false;
    }
    if (!ok || rampCol[x * N + y] || V[vi(x, y, h + 1)]) continue;
    const t = 8 + Math.floor(hash(x, y, 54) * 7), [wx, wy, wz] = at(x, y, h + 1);
    const bark = [[92, 82, 70], [80, 72, 62]][Math.floor(hash(x, y, 55) * 2)];
    bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, wz + t * 6], size: [10, 10, t * 6], color: bark });
    // branches: one per side, at different heights above 6 bricks
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy], k) => {
      if (hash(x, y, 56 + k) < 0.3) return;
      const z = wz + 72 + Math.floor(hash(x, y, 60 + k) * (t * 12 - 84) / 12) * 12 + 2;
      bricks.push({ asset: 'B_Branch', size: [0, 0, 0], position: [wx + dx * 30, wy + dy * 30, z], color: bark, ...(dy ? { rotation: 1 } : {}) });
    });
    blocked[x * N + y] = 1;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) canopy[(x + dx) * N + y + dy] = 1;
    deadTrees++;
  }

stage('deathDecor');
// the death forest's dressing (2026-10-14): graves in little yards, skulls on pikes, ghost lanterns, red
// eyes hanging in the dark, and its enemies (the hardest skeletons, bloated zombies) on clear flat ground
const deathProps = { graves: 0, pikes: 0, lanterns: 0, eyes: 0, spawners: 0 };
{
  const BONE = [226, 218, 196], GSTONE = [[112, 110, 108], [92, 92, 94], [128, 124, 118]], WOOD = [52, 40, 32];
  const EYE = { color: [255, 24, 16], material: 'BMC_Glow', material_intensity: 6 }, GHOST = { color: [120, 255, 150], material: 'BMC_Glow', material_intensity: 5 };
  const mb = (x, y, z, sx, sy, sz, color, extra = {}) => bricks.push({ asset: 'PB_DefaultMicroBrick', position: [x, y, z], size: [sx, sy, sz], color, ...extra });
  // a flat free cell: level with its 8 neighbours, nothing on it, nothing in the air above for `up` bricks
  const flat = (x, y, up, open = true) => {
    const i = x * N + y, h = H[i];
    if (!inMap(x, y) || deathW[i] < 0.4 || pathCell[i] || footCell[i] || keepOut[i] || volcanoCell[i] || V[vi(x, y, h)] === 0) return false;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const j = (x + dx) * N + y + dy;
      if (!inMap(x + dx, y + dy) || H[j] !== h || rampCol[j] || capCol[j] || pathCell[j] || footCell[j] || (dx === 0 && dy === 0 && blocked[j]) || (open && canopy[j])) return false;
    }
    for (let z = h + 1; z <= Math.min(NZ - 1, h + up); z++) if (V[vi(x, y, z)]) return false;
    return true;
  };
  // enemies first, each on its own clear 3 x 3
  const spots = [];
  for (let x = 2; x < N - 2; x++) for (let y = 2; y < N - 2; y++) if (deathW[x * N + y] > 0.6) spots.push([hash(x, y, 471), x, y]);
  spots.sort((a, b) => a[0] - b[0]);
  const WANT = tune('death.spawners', 10, 'death forest enemy spawners'), got = [];
  for (const [, x, y] of spots) {
    if (got.length >= WANT) break;
    if (got.some(q => Math.hypot(q[0] - x, q[1] - y) < 26) || !flat(x, y, 4, false)) continue;
    let clear = true;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (blocked[(x + dx) * N + y + dy] || canopyLow[(x + dx) * N + y + dy]) clear = false;
    if (!clear) continue;
    got.push([x, y]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked[(x + dx) * N + y + dy] = 1;
    const [wx, wy] = at(x, y, 0), z = (H[x * N + y] + 1) * VZ + 2;
    spawners.push(hash(x, y, 472) < 0.6 ? { at: [wx, wy, z], tier: 7, dungeon: 'Death Forest', level: 0 } : { at: [wx, wy, z], prefab: 'swamp_zombie_2', dungeon: 'Death Forest', level: 0 });
    deathProps.spawners++;
  }
  for (let x = 2; x < N - 2; x++)
    for (let y = 2; y < N - 2; y++) {
      const i = x * N + y;
      if (deathW[i] < 0.4) continue;
      const r = hash(x, y, 481), [wx, wy, wz] = at(x, y, H[i] + 1);
      if (r < 0.012 && flat(x, y, 3)) {
        // a grave yard: headstones and crosses in rows over sunken dirt, on whatever free cells round here
        const along = hash(x, y, 482) < 0.5, n = 3 + Math.floor(hash(x, y, 483) * 5);
        for (let k = 0; k < n; k++) {
          const gx = x + (along ? (k % 3) - 1 : Math.floor(k / 3) * 2 - 1), gy = y + (along ? Math.floor(k / 3) * 2 - 1 : (k % 3) - 1);
          if (!inMap(gx, gy) || blocked[gx * N + gy] || !flat(gx, gy, 3)) continue;
          const [px, py, pz] = at(gx, gy, H[gx * N + gy] + 1), stone = GSTONE[Math.floor(hash(gx, gy, 484) * 3)];
          const tilt = hash(gx, gy, 485) < 0.5 ? -2 : 2; // not quite straight
          if (hash(gx, gy, 486) < 0.35) { // a cross
            mb(px + tilt, py + 10, pz + 18, 2, 2, 18, stone);
            mb(px + tilt - 6, py + 10, pz + 26, 4, 2, 2, stone); mb(px + tilt + 6, py + 10, pz + 26, 4, 2, 2, stone);
          } else { // a headstone, its top in two steps
            mb(px + tilt, py + 10, pz + 10, 8, 4, 10, stone);
            mb(px + tilt, py + 10, pz + 22, 6, 4, 2, stone);
          }
          mb(px, py - 6, pz + 2, 8, 12, 2, [40, 32, 26]); // the dug earth in front
          blocked[gx * N + gy] = 1; deathProps.graves++;
        }
      } else if (r < 0.03 && flat(x, y, 4)) {
        // a skull on a pike, glowing eyes
        mb(wx, wy, wz + 18, 2, 2, 18, WOOD);
        mb(wx, wy, wz + 42, 6, 6, 6, BONE);
        mb(wx - 4, wy + 7, wz + 44, 2, 1, 2, EYE.color, EYE); mb(wx + 4, wy + 7, wz + 44, 2, 1, 2, EYE.color, EYE);
        mb(wx, wy + 4, wz + 34, 4, 2, 2, BONE); // the jaw
        blocked[i] = 1; deathProps.pikes++;
      } else if (r < 0.042 && flat(x, y, 3)) {
        // a ghost lantern on a crooked post
        mb(wx, wy, wz + 14, 2, 2, 14, WOOD);
        mb(wx + 4, wy, wz + 26, 2, 2, 2, WOOD);
        mb(wx + 8, wy, wz + 22, 2, 2, 2, GHOST.color, GHOST);
        blocked[i] = 1; deathProps.lanterns++;
      } else if (r < 0.07 && flat(x, y, 7)) {
        // red eyes in the dark, a pair hanging at head height or above
        const ez = wz + 30 + Math.floor(hash(x, y, 487) * 4) * 8, along = hash(x, y, 488) < 0.5;
        mb(wx + (along ? 6 : 0), wy + (along ? 0 : 6), ez, 2, 2, 2, EYE.color, EYE); mb(wx - (along ? 6 : 0), wy - (along ? 0 : 6), ez, 2, 2, 2, EYE.color, EYE);
        deathProps.eyes++;
      }
    }
  console.error(`death forest: ${JSON.stringify(deathProps)}`);
}

stage('groundCover');
// swamp floor and the grass everywhere else
let turds = 0;
for (let x = 1; x < N - 1; x++)
  for (let y = 1; y < N - 1; y++) {
    const i = x * N + y, h = H[i], s = surfaceMat[i];
    const r = hash(x, y, 21), r2 = hash(x, y, 22);
    const wx = X0 + x * CELL, wy = Y0 + y * CELL;
    if (swampCell[i]) {
      if (h < SEA) continue;
      if (r < 0.28) plant(x, y, 'B_Bush', [[112, 122, 50], [96, 110, 46], [128, 120, 60]][Math.floor(r2 * 3)]) || plant(x, y, 'B_Fern', [84, 104, 48]); // rushes
      else if (r < 0.36) plant(x, y, 'B_Fern', [[84, 104, 48], [100, 112, 52]][Math.floor(r2 * 2)]);
      else if (r < 0.38 && !blocked[i] && !rampCol[i] && !canopy[i] && !V[vi(x, y, h + 1)] && !V[vi(x, y, h + 3)]) {
        // turd pile: a soft-serve stack of round bricks
        const [cx, cy, cz] = at(x, y, h + 1), poo = [[96, 62, 30], [84, 54, 26]][Math.floor(r2 * 2)];
        bricks.push({ asset: 'B_2x2_Round', size: [0, 0, 0], position: [cx, cy, cz + 6], color: poo });
        bricks.push({ asset: 'B_1x1_Round', size: [0, 0, 0], position: [cx, cy, cz + 18], color: poo });
        bricks.push({ asset: 'B_1x1_Cone', size: [0, 0, 0], position: [cx, cy, cz + 30], color: poo });
        blocked[i] = 1;
        turds++;
      } else if (r < 0.39) plant(x, y, 'B_Small_Flower', [150, 255, 60], { extra: { material: 'BMC_Glow', material_intensity: 3 } }); // swamp glow
      continue;
    }
    if (h <= SEA + 1 || townNear[i] || keepOut[i] || pathCell[i] || villageDist(x, y) <= VILLAGE.r + 1 || hengeDist(x, y) <= 0 || reserved[x * N + y]) continue;
    if (trenchCell[i]) continue;
    const forest = fbm2(wx / 1500, wy / 1500, 2), meadow = fbm2(wx / 700 + 300, wy / 700 - 40, 3);
    if (GRASS.includes(s)) {
      if (forest > 0.08) {
        if (r > 0.34) continue;
        const a = pickW([['B_Fern', 30], ['B_Bush', 14], ['B_Leaf_Bush', 12], ['B_Pine_Tree', 9], ['B_Branch', 8], ['B_Small_Flower', 6], ['B_Rose', 3]], r2);
        const col = a === 'B_Branch' ? [104, 74, 46] : a === 'B_Pine_Tree' ? [[40, 90, 55], [52, 102, 60]][Math.floor(r2 * 97) % 2]
          : a === 'B_Small_Flower' || a === 'B_Rose' ? BLOOM[Math.floor(hash(x, y, 23) * BLOOM.length)] : LEAF[Math.floor(hash(x, y, 23) * 3)];
        plant(x, y, a, col, { rot: a === 'B_Branch' && hash(x, y, 24) < 0.5 ? 1 : 0 }) || (a === 'B_Leaf_Bush' && plant(x, y, 'B_Bush', col)) || (['B_Leaf_Bush', 'B_Bush', 'B_Pine_Tree'].includes(a) && plant(x, y, 'B_Fern', LEAF[Math.floor(hash(x, y, 23) * 3)]));
      } else if (meadow > 0.12) {
        if (r > 0.4) continue;
        // a meadow patch keeps one colour; the odd stem is another
        const patch = Math.floor((fbm2(wx / 260 + 9, wy / 260 + 3, 2) + 1) * 3.5 * 7) % BLOOM.length;
        const col = hash(x, y, 25) < 0.85 ? BLOOM[patch] : BLOOM[Math.floor(hash(x, y, 26) * BLOOM.length)];
        const a = pickW([['B_Flower', 30], ['B_Small_Flower', 28], ['B_Tulip', 20], ['B_Rose', 14], ['B_Fern', 8]], r2);
        plant(x, y, a, a === 'B_Fern' ? LEAF[0] : col);
      } else {
        if (r > 0.12) continue;
        const a = pickW([['B_Fern', 40], ['B_Bush', 20], ['B_Small_Flower', 25], ['B_Pumpkin', 2], ['B_Tulip', 13]], r2);
        plant(x, y, a, a === 'B_Pumpkin' ? [230, 120, 30] : a === 'B_Fern' || a === 'B_Bush' ? LEAF[Math.floor(hash(x, y, 23) * 3)] : BLOOM[Math.floor(hash(x, y, 26) * BLOOM.length)]);
      }
    } else if (SCRUB.includes(s)) {
      // shrubland: bushes everywhere, ferns, dead branches, the odd pine
      if (r > 0.3) continue;
      const a = pickW([['B_Bush', 44], ['B_Leaf_Bush', 10], ['B_Fern', 26], ['B_Branch', 14], ['B_Pine_Tree', 2]], r2);
      const col = a === 'B_Branch' ? [[132, 104, 70], [118, 92, 62]][Math.floor(r2 * 97) % 2] : a === 'B_Pine_Tree' ? [52, 96, 58] : [[110, 122, 58], [96, 112, 52], [128, 130, 66]][Math.floor(hash(x, y, 23) * 3)];
      plant(x, y, a, col, { rot: a === 'B_Branch' && hash(x, y, 24) < 0.5 ? 1 : 0 }) || (a === 'B_Leaf_Bush' && plant(x, y, 'B_Bush', col)) || (a === 'B_Pine_Tree' && plant(x, y, 'B_Bush', col));
    } else if (ROCK.includes(s) && h < 100) {
      if (r < 0.04) plant(x, y, r2 < 0.6 ? 'B_Bush' : 'B_Fern', [[96, 116, 70], [84, 104, 64]][Math.floor(r2 * 2)]);
    } else if (s === SAND) {
      if (r < 0.03) plant(x, y, 'B_Bush', [170, 168, 96]); // dune grass
    } else if (DUNE.includes(s) || s === DRYGRASS) {
      if (r < 0.06) cactus(x, y);
      else if (r < 0.05) plant(x, y, 'B_Branch', [[132, 104, 70], [118, 92, 62]][Math.floor(r2 * 2)], { rot: r2 < 0.5 ? 1 : 0 }); // dead scrub
      else if (s === DRYGRASS && r < 0.1) plant(x, y, 'B_Fern', [[176, 160, 90], [160, 146, 80]][Math.floor(r2 * 2)]); // dry tufts
    } else if (MESA.includes(s) && h < 100) {
      if (r < 0.02) plant(x, y, 'B_Branch', [118, 92, 62], { rot: r2 < 0.5 ? 1 : 0 });
    }
  }

stage('hengeStones');
// the henge's stones (micro bricks: a regular brick's underside is ugly) and wizards
{
  const [cx, cy] = at(henge.x0 + (henge.n >> 1), henge.y0 + (henge.n >> 1), 0), G = (henge.h + 1) * VZ;
  const HB = makeBuilder();
  const GREY = [[138, 136, 128], [124, 122, 116], [150, 146, 136], [116, 114, 110]];
  let k = 0;
  const stone = (x0, y0, z0, x1, y1, z1, label) => HB.box(cx + x0, cy + y0, z0, cx + x1, cy + y1, z1, { asset: 'PB_DefaultMicroBrick', color: GREY[k++ % GREY.length] }, label);
  // trilithons on the axes, radius 220: two 30 x 20 uprights 132 tall, a lintel across them
  for (const [ax, ay] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const r = 220, ux = ax ? 0 : 1, uy = ax ? 1 : 0;
    for (const sg of [-1, 1]) {
      const px = ax * r + ux * sg * 35, py = ay * r + uy * sg * 35, hx = ux ? 15 : 10, hy = ux ? 10 : 15;
      stone(px - hx, py - hy, G, px + hx, py + hy, G + 132, 'upright');
    }
    const hx = ux ? 60 : 12, hy = ux ? 12 : 60;
    stone(ax * r - hx, ay * r - hy, G + 132, ax * r + hx, ay * r + hy, G + 156, 'lintel');
  }
  // single stones on the diagonals, one short
  for (const [dx, dy, h] of [[1, 1, 108], [-1, 1, 96], [-1, -1, 108], [1, -1, 72]]) {
    const px = Math.round((dx * 220) / Math.SQRT2 / 10) * 10, py = Math.round((dy * 220) / Math.SQRT2 / 10) * 10;
    stone(px - 15, py - 15, G, px + 15, py + 15, G + h, 'stone');
  }
  // inner ring of 6 small stones at radius 130
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.round((130 * Math.cos(a)) / 10) * 10, py = Math.round((130 * Math.sin(a)) / 10) * 10;
    stone(px - 10, py - 10, G, px + 10, py + 10, G + 48 + (i % 3) * 12, 'inner');
  }
  stone(250, -330, G, 380, -300, G + 20, 'fallen');
  // altar with a glowing purple rune
  stone(-20, -10, G, 20, 10, G + 24, 'altar base');
  stone(-40, -20, G + 24, 40, 20, G + 36, 'altar');
  HB.box(cx - 10, cy - 10, G + 36, cx + 10, cy + 10, G + 38, { asset: 'PB_DefaultMicroBrick', color: [170, 60, 255], material: 'BMC_Glow', material_intensity: 8 }, 'rune');
  if (HB.dropped.length) throw new Error(`henge: ${HB.dropped.length} overlaps, e.g. ${HB.dropped[0]}`);
  for (const { label, ...b } of HB.bricks) bricks.push(b);
  // wizards only: one in front of the altar, two inside the ring
  for (const [x, y] of [[0, -70], [150, 90], [-150, 90]])
    spawners.push({ at: [cx + x, cy + y, G + 2], prefab: 'enemy_wizard', dungeon: 'Henge', level: 0 });
  henge.center = [cx, cy, G];
}
for (const o of outposts) {
  const [wx, wy] = at(o.x, o.y, 0), z = (o.h + 1) * VZ + 2;
  for (const dx of [-40, 40]) spawners.push({ at: [wx + dx, wy, z], tier: o.tier, dungeon: 'Outpost', level: 0 });
}
for (const s of spawnRing) {
  const [wx, wy] = at(s.x, s.y, 0);
  spawners.push({ at: [wx, wy, (H[s.x * N + s.y] + 1) * VZ + 2], tier: s.tier, dungeon: 'Spawn ring', level: 0 }); // H read late: roads may have regraded the cell
}

const CAVE_DUMP = process.env.CAVE_DUMP ? [] : null; // env CAVE_DUMP=file: the caves' own bricks (map frame) for mapgen/isoview.mjs
const gems = []; // mineable gems in the caves (pots/gemgen.mjs prefabs; gems.json, loadextras)
stage('caveProps');
// cave interiors: two fires, then an old man with a sword or a chest, on the
// ledge at the back; stalactites under the high ceiling, stalagmites and
// glowing crystal clusters round the walls
for (const [n, c] of caves.entries()) {
  if (c.mc) {
    if (!c.mc.field) continue; // (all caves are one field, on the first cave)
    // (2026-10-16) wedge surfaces, spikes, uplights and gems (cavern.mjs)
    const r = caveBricks(c.mc.field, { VZ, X0, Y0, N, BAND: CAVE_BAND, band: k => MATS[LIME_OF(k)].color, hash, surfaceAt: (x, y) => (hAt(Math.floor((x - X0) / CELL), Math.floor((y - Y0) / CELL)) + 1) * VZ,
      gemKinds: ['amethyst', 'emerald', 'ruby', 'diamond'], out: b => { bricks.push(b); if (CAVE_DUMP) CAVE_DUMP.push(b); } });
    gems.push(...r.gems);
    if (process.env.CAVE_DEBUG) console.error(`caves: ${r.n} bricks, ${r.gems.length} gems (${r.gems.map(g => g.prefab.slice(4)).join(' ')})`);
    continue;
  }
  const { x, y, dx, dy, h } = c;
  const R = CAVE.R, kc = CAVE.depth + R - 1;
  const byKL = new Map(c.cells.map(e => [e[4] + ',' + e[5], e]));
  const cell = (k, l) => at(x + dx * k - dy * l, y + dy * k + dx * l, h + 1);
  const floorOf = (k, l) => (h + 1 + (byKL.get(k + ',' + l)?.[3] ?? 0)) * VZ;
  // props stand on the spine near the back-centre
  let pk = kc + 1;
  while (pk > kc - 1 && !byKL.has(pk + ',0')) pk--;
  const used = new Set([pk + ',0', (pk - 1) + ',0', (pk + 1) + ',0']);
  for (const l of [-2, 2]) {
    const fk = byKL.has(kc + ',' + l) ? kc : kc - 1;
    if (!byKL.has(fk + ',' + l)) continue;
    used.add(fk + ',' + l);
    const [wx, wy] = cell(fk, l), fz = floorOf(fk, l);
    bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, fz + 18], size: [10, 10, 18], color: [70, 66, 62] });
    bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, fz + 42], size: [15, 15, 6], color: [255, 120, 30], material: 'BMC_Glow', material_intensity: 8 });
    bricks.push({ asset: 'B_1x1_Cone', position: [wx, wy, fz + 54], size: [0, 0, 0], color: [255, 200, 60], material: 'BMC_Glow', material_intensity: 10 });
  }
  const [mx, my] = cell(pk, 0), floorZ = floorOf(pk, 0);
  if (n % 2 === 0) {
    // old man: robe, beard, face, and the sword laid on the floor in front
    bricks.push({ position: [mx, my, floorZ + 30], size: [10, 10, 30], color: [150, 40, 30] });
    bricks.push({ position: [mx, my, floorZ + 66], size: [10, 10, 6], color: [230, 190, 150] });
    bricks.push({ position: [mx - dx * 15, my - dy * 15, floorZ + 54], size: [5, 5, 6], color: [240, 240, 240] });
    const [sx, sy] = cell(pk - 1, 0), sz = floorOf(pk - 1, 0);
    bricks.push({ position: [sx, sy, sz + 2], size: dx ? [15, 5, 2] : [5, 15, 2], color: [210, 215, 225], material: 'BMC_Metallic' });
    bricks.push({ position: [sx - dx * 20, sy - dy * 20, sz + 2], size: dx ? [5, 10, 2] : [10, 5, 2], color: [120, 80, 40] });
  } else {
    bricks.push({ position: [mx, my, floorZ + 12], size: [20, 15, 12], color: [110, 70, 30] });
    bricks.push({ asset: 'PB_DefaultRampCrest', position: [mx, my, floorZ + 30], size: [20, 15, 6], color: [232, 186, 40], material: 'BMC_Metallic' });
  }
  const CRYSTAL = [[90, 170, 255], [170, 110, 255], [80, 230, 200]][n % 3];
  const rockC = [[112, 108, 102], [96, 92, 88]];
  for (const [cx, cy, t, raise, k, l, role] of c.cells) {
    if (role === 'passage' || used.has(k + ',' + l)) continue;
    const [wx, wy] = cell(k, l), fz = (h + 1 + raise) * VZ, ceil = (h + t + 1) * VZ;
    const r = hash(cx, cy, 350 + n);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !byKL.has((k + a) + ',' + (l + b)));
    if (role === 'alcove' || (edge && r < 0.3)) {
      // crystal cluster: a tall shard and one or two short ones, glowing
      const off = [[-10, -10, 14], [10, 5, 8], [-5, 12, 6]];
      for (const [ox, oy, hz] of off.slice(0, role === 'alcove' ? 3 : 2))
        bricks.push({ position: [wx + ox, wy + oy, fz + hz], size: [5, 5, hz], color: CRYSTAL, material: 'BMC_Glow', material_intensity: 4 });
      continue;
    }
    if (edge && r < 0.65) {
      // stalagmite: a stubby rock column with a thin tip
      const tall = 2 + Math.floor(hash(cx, cy, 360) * 3);
      bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, fz + 6 * tall], size: [15, 15, 6 * tall], color: rockC[0] });
      bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, fz + 12 * tall + 8], size: [5, 5, 8], color: rockC[1] });
      continue;
    }
    if (!edge && t - raise >= 11 && r < 0.45) {
      // stalactite hanging from the dome, tip well above head height
      bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, ceil - 12], size: [15, 15, 12], color: rockC[1] });
      bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, ceil - 34], size: [10, 10, 10], color: rockC[0] });
      bricks.push({ asset: 'PB_DefaultPole', position: [wx, wy, ceil - 52], size: [5, 5, 8], color: rockC[1] });
    }
  }
}

stage('coveDressing');
// cove dressing placed (after plants and cave props, so it sees them): stone and moss voxels cut away inside the ground (skirts down to
// the bed), small things whole or not at all
if (coves.length) {
  const near = b => coves.some(cv => Math.hypot(b.position[0] - (X0 + cv.x * CELL), b.position[1] - (Y0 + cv.y * CELL)) < (cv.R + 14) * CELL);
  const occ = makeOccupancy(bricks.filter(near));
  let rock = 0, small = 0;
  for (const d of coveDress) {
    const placed = placeVoxelProp(occ, { grids: [{ vox: d.vox, V: COVE_V, colors: d.colors }] }, { mode: 'smooth', skirt: 40 });
    for (const b of placed) bricks.push(b);
    rock += placed.length;
    for (const [n0, n1, loose] of d.groups) {
      const g = d.bricks.slice(n0, n1), boxes = g.map(b => worldBox(b, BUILDER_FIXED));
      if (loose) { g.forEach((b, i) => { if (!occ.hits(...boxes[i])) { occ.add(boxes[i]); bricks.push(b); small++; } }); continue; }
      if (boxes.some(([lo, hi]) => occ.hits(lo, hi))) continue;
      boxes.forEach(bx => occ.add(bx)); g.forEach(b => bricks.push(b)); small += g.length;
    }
    console.error(`cove: ${JSON.stringify(d.stats)}`);
  }
  console.error(`coves: ${rock} stone/moss bricks, ${small} small pieces`);
}
stage('deltaDressing');
// delta dressing (2026-10-15, see 'delta'): clumps of reeds and cattails on the marsh and
// along the banks at the water's edge, lily pads (some flowering) on the still water of
// lagoons, shallows and creek edges, bleached driftwood on the sand. Reeds and pads are
// walk-through (collision off); every piece through an occupancy check (never into a
// smoothing piece, tree, rock or prop), on flat cell tops only. Willows on the higher marsh
// come from the forest (tree spots).
if (delta) {
  const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
  const ax = X0 + delta.A[0] * CELL, ay = Y0 + delta.A[1] * CELL, RAD = (delta.U + 30) * CELL;
  const occ = makeOccupancy(bricks.filter(b => Math.hypot(b.position[0] - ax, b.position[1] - ay) < RAD + 400));
  const put = (lo, hi, color, extra = {}) => {
    if (occ.hits(lo, hi)) return false;
    occ.add([lo, hi]);
    bricks.push({ asset: 'PB_DefaultMicroBrick', size: [0, 1, 2].map(k => (hi[k] - lo[k]) / 2), position: [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), color, ...extra });
    return true;
  };
  const STALK = [[96, 128, 58], [112, 138, 64], [128, 140, 74], [146, 146, 86], [84, 116, 52]], HEAD = [[98, 64, 36], [112, 74, 42]], DRIFT = [[168, 152, 128], [150, 134, 112], [186, 172, 150]];
  const PAD = [[64, 122, 52], [76, 136, 58]], BLOOM = [[238, 186, 206], [246, 240, 232]];
  const ds = { reeds: 0, stalks: 0, pads: 0, blooms: 0, drift: 0 };
  const wetBy = (x, y) => { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(x + a, y + b) && H[(x + a) * N + y + b] <= SEA - 1) return true; return false; };
  const r0 = Math.ceil(delta.U + 30), Ax = Math.round(delta.A[0]), Ay = Math.round(delta.A[1]);
  for (let x = Ax - r0; x <= Ax + r0; x++)
    for (let y = Ay - r0; y <= Ay + r0; y++) {
      if (!inMap(x, y)) continue;
      const c = x * N + y, k = deltaCell[c], h = H[c];
      if (!k || rampCol[c] || capCol[c]) continue;
      let weir = false; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (inMap(x + a, y + b) && weirCell[(x + a) * N + y + b]) weir = true; // the weir rocks land later
      if (weir) continue;
      const x0 = X0 + x * CELL, y0 = Y0 + y * CELL, z0 = (h + 1) * VZ, r = hash(x, y, 1510);
      if (h >= SEA && (k === 3 || (k === 2 && wetBy(x, y)))) {
        // a clump of reeds: 4-9 stalks 2 units thick, a few with a cattail head
        if (r > (k === 3 ? 0.42 : 0.55)) continue;
        const n = 4 + Math.floor(hash(x, y, 1511) * 6), cx = 6 + 2 * Math.floor(hash(x, y, 1512) * 10), cy = 6 + 2 * Math.floor(hash(x, y, 1513) * 10);
        let laid = 0;
        for (let i = 0; i < n; i++) {
          const sx = x0 + Math.min(34, Math.max(4, cx + 2 * Math.round((hash(x, y, 1520 + i) - 0.5) * 8))), sy = y0 + Math.min(34, Math.max(4, cy + 2 * Math.round((hash(x, y, 1530 + i) - 0.5) * 8)));
          const sh = 14 + 2 * Math.floor(hash(x, y, 1540 + i) * 14);
          if (!put([sx, sy, z0], [sx + 2, sy + 2, z0 + sh], STALK[Math.floor(hash(x, y, 1550 + i) * STALK.length)], { collision: NOCOL })) continue;
          laid++; ds.stalks++;
          if (sh >= 26 && hash(x, y, 1560 + i) < 0.45 && put([sx - 2, sy - 2, z0 + sh], [sx + 2, sy + 2, z0 + sh + 8], HEAD[i & 1], { collision: NOCOL })) put([sx, sy, z0 + sh + 8], [sx + 2, sy + 2, z0 + sh + 12], STALK[3], { collision: NOCOL });
        }
        if (laid) ds.reeds++;
      } else if (h <= SEA - 1 && (k === 4 || (k === 1 && hash(x, y, 1509) < 0.3)) && z0 <= WATER_Z - 6) {
        // lily pads on the still water: a round-ish pad (a plate and a cross), now and then a flower
        if (r > 0.2) continue;
        const px0 = x0 + 10 + 2 * Math.floor(hash(x, y, 1514) * 6), py0 = y0 + 10 + 2 * Math.floor(hash(x, y, 1515) * 6), col = PAD[Math.floor(hash(x, y, 1516) * 2)], zw = WATER_Z;
        if (!put([px0 + 2, py0, zw], [px0 + 10, py0 + 12, zw + 2], col, { collision: NOCOL })) continue;
        put([px0, py0 + 2, zw], [px0 + 2, py0 + 10, zw + 2], col, { collision: NOCOL }); put([px0 + 10, py0 + 2, zw], [px0 + 12, py0 + 10, zw + 2], col, { collision: NOCOL });
        ds.pads++;
        if (hash(x, y, 1517) < 0.3 && put([px0 + 4, py0 + 4, zw + 2], [px0 + 8, py0 + 8, zw + 4], BLOOM[Math.floor(hash(x, y, 1518) * 2)], { collision: NOCOL })) { put([px0 + 5, py0 + 5, zw + 4], [px0 + 7, py0 + 7, zw + 6], [244, 206, 72], { collision: NOCOL }); ds.blooms++; }
      } else if (k === 2 && h >= SEA && r > 0.975) {
        // driftwood: a bleached log lying along x or y, a stub branch off it
        const along = hash(x, y, 1519) < 0.5, L = 24 + 4 * Math.floor(hash(x, y, 1521) * 6), col = DRIFT[Math.floor(hash(x, y, 1522) * 3)];
        const lo = along ? [x0 + 20 - L / 2, y0 + 16, z0] : [x0 + 16, y0 + 20 - L / 2, z0], hi = along ? [lo[0] + L, y0 + 24, z0 + 6] : [x0 + 24, lo[1] + L, z0 + 6];
        if (!put(lo, hi, col)) continue;
        if (along) put([x0 + 22, y0 + 24, z0 + 2], [x0 + 26, y0 + 34, z0 + 6], col); else put([x0 + 24, y0 + 22, z0 + 2], [x0 + 34, y0 + 26, z0 + 6], col);
        ds.drift++;
      }
    }
  console.error(`delta dressing: ${JSON.stringify(ds)}`);
}
stage('riverWater');
// river water (2026-10-06, owner: "this is a water component and it should be
// replacing the river"): a 2-unit gravel plate on the bed in runs along x, each
// carrying the owner's water zone (Component_Internal_AttachedZone, bWater)
// projecting up from the plate to the level; none where the level is at the
// sea (the game's water covers it). Was glass with collision off.
const WATER_ZONE = {
  ZoneStartDistance: 0, ZoneEndDistance: 60, bIsBuildingZone: false, bIsLooseZone: false, bIsShareZone: false, bWater: true,
  WaterScattering: { X: 0.000007, Y: 0.000018, Z: 0.000031 }, WaterAbsorption: { X: 0.0065, Y: 0.000708, Z: 0.000196 },
  WaterFogIntensity: 0.0002, WaterFogScatteringColor: { R: 0.5, G: 1, B: 0.75, A: 1 }, WaterFogAmbientColor: { R: 0.1, G: 0.409524, B: 0.75, A: 1 },
  WaterFogScatteringScale: 3, WaterFogAmbientScale: 0.25, bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true,
  bDetectEntities: false, bDetectProjectiles: false, TagFilter: '', ZoneWindForce: 0,
};
{
  const PLATE = 2, BED = MATS[GRAVEL].color;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N;) {
      const c = x * N + y;
      if (!riverCell[c] || riverLevel[c] <= SEA) { x++; continue; }
      const h = H[c], lv = riverLevel[c];
      let x1 = x + 1;
      while (x1 < N && x1 - x < 16 && riverCell[x1 * N + y] && H[x1 * N + y] === h && riverLevel[x1 * N + y] === lv) x1++;
      const z0 = (h + 1) * VZ, z1 = (lv + 1) * VZ;
      if (z1 > z0 + PLATE) bricks.push({ asset: 'PB_DefaultMicroBrick', color: BED, position: [X0 + ((x + x1) / 2) * CELL, Y0 + (y + 0.5) * CELL, z0 + PLATE / 2], size: [(x1 - x) * 20, 20, PLATE / 2],
        components: [{ type: 'Component_Internal_AttachedZone', data: { ...WATER_ZONE, ZoneEndDistance: z1 - z0 - PLATE } }] });
      x = x1;
    }
}
stage('weirRocks');
// rock weirs (see 'rock weirs' above): boulders on every step edge, voxels only in weir
// columns and above each column's ground (and its water plate)
if (weirs.length) {
  const R = (a, b, k) => hash(a, b, 700 + k);
  const blobs = [];
  for (const w of weirs) {
    const c = w.x * N + w.y;
    if (w.bank) {
      const g = (H[c] + 1) * VZ, s = 20 + R(w.x, w.y, 1) * 14;
      blobs.push({ c: [X0 + (w.x + 0.5) * CELL, Y0 + (w.y + 0.5) * CELL, g + s * 0.3], r: [s, s, s * 0.8], seed: w.x * 7 + w.y });
      continue;
    }
    const n = (w.x + w.dx) * N + w.y + w.dy;
    const zLow = (H[n] + 1) * VZ, zHigh = (riverLevel[c] + 1) * VZ + 6; // bed below the step .. above the upper water
    const ex = X0 + (w.x + 0.5 + w.dx * 0.5) * CELL, ey = Y0 + (w.y + 0.5 + w.dy * 0.5) * CELL;
    // stacked up a tall step, a blob every ~36 units, alternating a little up/downstream
    const steps = Math.max(1, Math.round((zHigh - zLow) / 36));
    for (let k = 0; k < steps; k++) {
      const z = zLow + ((k + 0.5) / steps) * (zHigh - zLow), s = 18 + R(w.x, w.y, k) * 10;
      const off = (R(w.y, w.x, k) - 0.5) * 16;
      blobs.push({ c: [ex + w.dx * off, ey + w.dy * off, z], r: [w.dx ? s * 0.9 : s * 1.2, w.dy ? s * 0.9 : s * 1.2, Math.max(s, (zHigh - zLow) / steps * 0.75)], seed: w.x * 131 + w.y * 7 + k });
    }
  }
  const top = c => { const g = (H[c] + 1) * VZ; return riverCell[c] && riverLevel[c] > SEA && (riverLevel[c] + 1) * VZ > g + 2 ? g + 2 : g; };
  const rocks = buildRocks(blobs, { seed: 77, moss: 0.25, allow: (x, y, z) => {
    const cx = Math.floor((x - X0) / CELL), cy = Math.floor((y - Y0) / CELL);
    if (!inMap(cx, cy) || !weirCell[cx * N + cy]) return false;
    // the voxel's footprint must not straddle into a column that isn't a weir column
    const cx2 = Math.floor((x + RV - 1 - X0) / CELL), cy2 = Math.floor((y + RV - 1 - Y0) / CELL);
    if (cx2 !== cx || cy2 !== cy) return false;
    return z >= top(cx * N + cy);
  } });
  for (const b of rocks) bricks.push(b);
  console.error(`river weirs: ${blobs.length} boulders, ${rocks.length} bricks`);
}

stage('cutRocks');
// road cutting walls + arches (see 'cutWalls'): rock voxels in the wall cells from their
// lowered ground up to the old height, the face toward the road eaten back by noise and
// leaning back with height; arches over deep cuts and at tunnel mouths. soft: anything else
// placed in their way (signs, trees) wins at output.
{
  const roadC = c => pathCell[c] && tunnelZ[c] < 0 && !deck[c];
  const SANDSTONE = [[204, 168, 120], [188, 150, 104], [214, 182, 134], [178, 142, 100], [196, 158, 112]];
  const vox = [new Map(), new Map()]; // stone, sandstone
  const palOf = (x, y) => (desertW(x, y) > 0.5 ? 1 : 0);
  const K = (i, j, k) => i + ',' + j + ',' + k;
  const gz = c => (H[c] + 1) * VZ;
  const rockFloor = c => Math.ceil(gz(c) / RV) * RV; // first voxel layer clear of the ground bricks
  const cellAt = (wx, wy) => [Math.floor((wx - X0) / CELL), Math.floor((wy - Y0) / CELL)];
  const faceDist = (wx, wy) => {
    const [cx, cy] = cellAt(wx, wy); let best = 1e9;
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
      const x = cx + a, y = cy + b; if (!inMap(x, y) || !roadC(x * N + y)) continue;
      const x0 = X0 + x * CELL, y0 = Y0 + y * CELL;
      best = Math.min(best, Math.hypot(Math.max(x0 - wx, 0, wx - x0 - CELL), Math.max(y0 - wy, 0, wy - y0 - CELL)));
    }
    return best;
  };
  const T = (x, y, own) => { if (!inMap(x, y)) return own; const c = x * N + y; return cutRock[c] ? (cutTop[c] + 1) * VZ : roadC(c) ? own : Math.max(own, gz(c)); };
  const topAt = (wx, wy, c) => {
    const own = (cutTop[c] + 1) * VZ, fx = (wx - X0) / CELL - 0.5, fy = (wy - Y0) / CELL - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    return T(x0, y0, own) * (1 - tx) * (1 - ty) + T(x0 + 1, y0, own) * tx * (1 - ty) + T(x0, y0 + 1, own) * (1 - tx) * ty + T(x0 + 1, y0 + 1, own) * tx * ty
      + (rockNoise(wx / 50, wy / 50, 0, 401) - 0.5) * 14;
  };
  // where a voxel may go: wall cells above their floor; elsewhere (arches over the road) well
  // over the ground and its ride surface; never in a tunnel column, the river or a deck
  const allow = (x, y, z) => {
    const [cx, cy] = cellAt(x, y), [cx2, cy2] = cellAt(x + RV - 1, y + RV - 1);
    if (cx2 !== cx || cy2 !== cy || !inMap(cx, cy)) return false;
    const c = cx * N + cy;
    if (tunnelZ[c] >= 0 || riverCell[c] || deck[c]) return false;
    return cutRock[c] ? z >= rockFloor(c) : z >= gz(c) + 64;
  };
  let wallCells = 0;
  const fillers = [];
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const c = x * N + y; if (!cutRock[c]) continue;
      wallCells++;
      const m = vox[palOf(x, y)], g = gz(c), f = rockFloor(c);
      if (f > g) fillers.push({ asset: 'PB_DefaultMicroBrick', position: [X0 + x * CELL + 20, Y0 + y * CELL + 20, (g + f) / 2], size: [20, 20, (f - g) / 2], color: (palOf(x, y) ? SANDSTONE : STONE_TONES)[1], soft: 1 });
      for (let i = 0; i < CELL / RV; i++) for (let j = 0; j < CELL / RV; j++) {
        const wx = X0 + x * CELL + i * RV, wy = Y0 + y * CELL + j * RV, mx = wx + RV / 2, my = wy + RV / 2;
        const fd = faceDist(mx, my), top = Math.max(topAt(mx, my, c), f + RV);
        for (let z = f; z + RV / 2 <= top; z += RV) {
          const rough = 4 + 0.3 * (z - g) + 26 * (rockNoise(mx / 32, my / 32, z / 20, 402) - 0.5) + 12 * (rockNoise(mx / 12, my / 12, z / 10, 403) - 0.5);
          if (fd < rough) continue;
          m.set(K(Math.round(wx / RV), Math.round(wy / RV), Math.round(z / RV)), 0);
        }
      }
    }
  // arches: across a road sample with rock walls deep enough on both sides (every archGap
  // samples or so), and at every tunnel mouth, framing the bore
  let arches = 0;
  for (const { P } of CUT_ON ? roadPaths : []) {
    let last = -1e9;
    for (let i = 2; i < P.length - 2; i++) {
      const [x, y] = P[i], c = x * N + y;
      if (!roadC(c) || i - last < 4) continue;
      const tun = k => k >= 0 && k < P.length && tunnelZ[P[k][0] * N + P[k][1]] >= 0;
      const mouth = tun(i + 1) ? 1 : tun(i - 1) ? -1 : 0;
      if (!mouth && (i - last < CUT.archGap || hash(x, y, 909) >= CUT.archChance)) continue;
      let ux = P[i + 2][0] - P[i - 2][0], uy = P[i + 2][1] - P[i - 2][1];
      if (mouth) { ux = P[i + mouth][0] - x; uy = P[i + mouth][1] - y; } // toward the bore
      const ul = Math.hypot(ux, uy); if (!ul) continue;
      ux /= ul; uy /= ul; const vx = -uy, vy = ux;
      let Cx = X0 + (x + 0.5) * CELL, Cy = Y0 + (y + 0.5) * CELL;
      const z0 = gz(c);
      const scan = sgn => {
        for (let d = 10; d <= 170; d += 5) {
          const [sx, sy] = cellAt(Cx + vx * d * sgn, Cy + vy * d * sgn); if (!inMap(sx, sy)) return null;
          const s = sx * N + sy; if (cutRock[s]) return [d, (cutTop[s] + 1) * VZ];
        }
        return null;
      };
      let L = scan(-1), R = scan(1), clear = CUT.clear, zt;
      if (mouth) {
        const t = P[i + mouth], tc = t[0] * N + t[1];
        clear = TUNNEL.high * VZ - 8; zt = gz(tc);
        L = L && L[0] <= 110 ? L : [66, zt]; R = R && R[0] <= 110 ? R : [66, zt];
      } else {
        if (!L || !R) continue;
        zt = Math.min(L[1], R[1]);
        if (zt - z0 < CUT.archMin * VZ) continue;
      }
      const th = 14 + hash(x, y, 911) * 8;
      if (mouth) { Cx += ux * (20 - th); Cy += uy * (20 - th); } // its back against the portal face
      const mOff = (R[0] - L[0]) / 2, w = (L[0] + R[0]) / 2 + 6;
      Cx += vx * mOff; Cy += vy * mOff;
      const zTop = Math.max(zt + 16, z0 + clear + 50), m = vox[palOf(x, y)], sd = x * 131 + y * 17;
      const ext = w * 1.15 + th + 10;
      for (let wx = Math.floor((Cx - ext) / RV) * RV; wx <= Cx + ext; wx += RV)
        for (let wy = Math.floor((Cy - ext) / RV) * RV; wy <= Cy + ext; wy += RV) {
          const px = wx + RV / 2 - Cx, py = wy + RV / 2 - Cy, du = px * ux + py * uy, dv = px * vx + py * vy, t = dv / w;
          if (Math.abs(t) > 1.15) continue;
          const nz = rockNoise((wx + RV / 2) / 24, (wy + RV / 2) / 24, 0, 410 + sd);
          if (Math.abs(du) > th + (nz - 0.5) * 10) continue;
          for (let z = Math.floor(z0 / RV) * RV; z < zTop; z += RV) {
            const n3 = rockNoise((wx + RV / 2) / 20, (wy + RV / 2) / 20, z / 16, 420 + sd);
            const intr = z0 + clear * Math.sqrt(Math.max(0, 1 - t * t)) + (n3 - 0.5) * 12;
            const extr = Math.max(zt - 6 + n3 * 16, z0 + clear + 22 + n3 * 14);
            if (z + RV / 2 < intr || z + RV / 2 > extr || !allow(wx, wy, z)) continue;
            m.set(K(Math.round(wx / RV), Math.round(wy / RV), Math.round(z / RV)), 0);
          }
        }
      arches++; last = i;
    }
  }
  let n0 = 0;
  vox.forEach((m, p) => {
    if (!m.size) return;
    for (const b of rocksFromVoxels(m, { seed: 91 + p, moss: p ? 0.04 : 0.3, palette: p ? SANDSTONE : STONE_TONES, allow })) { b.soft = 1; bricks.push(b); n0++; }
  });
  for (const b of fillers) bricks.push(b);
  console.error(`cut rocks: ${wallCells} wall cells, ${arches} arches, ${n0} rock bricks`);
}

// river rapids (2026-10-21): a foam slope of glass micro wedge over each stepped-down
// cell, from the lower water up to the upper (collision off: you wade through)
{
  const FOAM = [[214, 236, 244], [192, 224, 236]], NOCOL = { player: false, weapon: false, interaction: false, physics: false };
  let n0 = 0;
  for (const r of rapids) {
    const n = r.x * N + r.y, up = (r.x - r.dx) * N + r.y - r.dy, lv = riverLevel[n];
    if (weirCell[n] || deck[n] || lv <= SEA) continue;
    const h = Math.min(riverLevel[up] - lv, 2) * VZ / 2;
    if (h <= 0) continue;
    bricks.push({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[-r.dx, -r.dy]], [20, 20, h]), color: FOAM[(r.x + r.y) & 1], material: 'BMC_Glass', collision: NOCOL,
      position: [X0 + (r.x + 0.5) * CELL, Y0 + (r.y + 0.5) * CELL, (lv + 1) * VZ + h] });
    n0++;
  }
  console.error(`river rapids: ${n0} foam wedges`);
}

stage('bridgeDecks');
// bridge decks (planks) and their rails over open water
{
  const PLANK = [[150, 104, 64], [134, 92, 56], [160, 114, 72]], RAIL = [96, 66, 42], MB = 'PB_DefaultMicroBrick';
  let decks = 0;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const top = deck[x * N + y];
      if (!top) continue;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      bricks.push({ asset: MB, position: [wx + 20, wy + 20, top - 2], size: [20, 20, 2], color: PLANK[(x + y) % 3] });
      decks++;
      // (2026-10-21) piers under a deck 3+ bricks over the water, every third cell each way
      if (riverCell[x * N + y] && x % 3 === 0 && y % 3 === 0 && top - (riverLevel[x * N + y] + 1) * VZ >= 36) {
        const z0 = (H[x * N + y] + 1) * VZ + 4, z1 = top - 4;
        bricks.push({ asset: MB, position: [wx + 20, wy + 20, (z0 + z1) / 2], size: [8, 8, (z1 - z0) / 2], color: [118, 112, 104] });
      }
      const open = (dx, dy) => { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) return true; const n = nx * N + ny; return !deck[n] && (riverCell[n] === 1 || H[n] <= SEA); };
      if (open(0, -1)) bricks.push({ asset: MB, position: [wx + 20, wy + 2, top + 10], size: [20, 2, 10], color: RAIL });
      if (open(0, 1)) bricks.push({ asset: MB, position: [wx + 20, wy + 38, top + 10], size: [20, 2, 10], color: RAIL });
      if (open(-1, 0)) bricks.push({ asset: MB, position: [wx + 2, wy + 20, top + 10], size: [2, 16, 10], color: RAIL });
      if (open(1, 0)) bricks.push({ asset: MB, position: [wx + 38, wy + 20, top + 10], size: [2, 16, 10], color: RAIL });
      // bridge ends (2026-10-06, bmx): a plank ramp up to a higher road cell next to the deck,
      // between the rails
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue;
        const n = nx * N + ny; if (!deck[n] && !pathCell[n]) continue;
        const rise = Math.min(24, (deck[n] || (H[n] + 1) * VZ) - top); // up to the road, or the next deck cell up
        if (rise < 4) continue;
        const x0 = wx + (open(-1, 0) ? 4 : 0), x1 = wx + 40 - (open(1, 0) ? 4 : 0), y0 = wy + (open(0, -1) ? 4 : 0), y1 = wy + 40 - (open(0, 1) ? 4 : 0);
        const ext = [(x1 - x0) / 2, (y1 - y0) / 2, Math.floor(rise / 4) * 2];
        bricks.push({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext), color: PLANK[(x + y + 1) % 3], position: [(x0 + x1) / 2, (y0 + y1) / 2, top + ext[2]] });
        break; // one ramp per deck cell
      }
    }
  console.error(`bridges: ${decks} deck cells`);
}
stage('tunnelDecor');
// tunnel ramps (a micro wedge on each 1-brick step of the floor) and ceiling lights
{
  const FLOOR = MATS[PATH].color;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const zr = tunnelZ[x * N + y];
      if (zr < 0 || roadSurf[x * N + y]) continue; // ride surface tunnels (2026-10-16) have their own
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inMap(x + dx, y + dy) || tunnelZ[(x + dx) * N + y + dy] !== zr + 1) continue;
        bricks.push({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], [20, 20, 6]), color: FLOOR,
          position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (zr + 1) * VZ + 6] });
        break;
      }
    }
  for (const [x, y, zr] of tunnelLights) if (!roadSurf[x * N + y])
    bricks.push({ asset: 'PB_DefaultMicroBrick', size: [6, 6, 2], color: [255, 200, 130], material: 'BMC_Glow', material_intensity: 5, position: [X0 + (x + 0.5) * CELL, Y0 + (y + 0.5) * CELL, (zr + 1 + TUNNEL.high) * VZ - 2] });
}

// terrace dressing (2026-10-12) for the cells [x0, x1) x [y0, y1), through a
// settlement's overlap guard (owner 2026-10-12: "retaining walls in villages ...
// ramps made of tiled herringbone and the actual retaining wall using brick"):
//  - ramps: a paved cell a brick below a paved neighbour gets 2 stair treads on its
//    uphill half: 1 stud deep, a flat tile (4) high each, 1x1 tiles; 3 risers a brick
//  - retaining walls 2+ bricks high: a brick wall 1 stud thick on the low side of
//    every face, rasterized as ONE stud set per course (faces of all cells, plus
//    the outer-corner studs where a stepped edge turns, so corners close and no
//    stud is laid twice), tiled like walltool: 1 x 2-stud bricks whose joints sit
//    on studs of the course's parity (running bond, bonded corners); the wall
//    rises PARAPET courses above the upper ground, capped by a stone coping
const BRICK_BASE = [150, 74, 56], PARAPET = 2;
function terraceDressing(B, x0, y0, x1, y1, paved) {
  const COPING = [[150, 144, 132], [138, 132, 120]];
  const course = new Map(); // course k -> Set "a,b" (global studs)
  const top = new Map();    // "a,b" -> highest course of the wall at that stud
  const put = (a, b, k) => { (course.get(k) ?? course.set(k, new Set()).get(k)).add(a + ',' + b); const t = top.get(a + ',' + b); if (t === undefined || k > t) top.set(a + ',' + b, k); };
  const groundK = (a, b) => { const cx = Math.floor(a / 4), cy = Math.floor(b / 4); return inMap(cx, cy) ? H[cx * N + cy] : 1e9; };
  let steps = 0;
  for (let x = x0; x < x1; x++)
    for (let y = y0; y < y1; y++) {
      const c = x * N + y;
      if (!inMap(x, y) || !terraceCell[c]) continue;
      const h = H[c];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const hn = hAt(x + dx, y + dy);
        if (h - hn < 2 || (inMap(x + dx, y + dy) && riverCell[(x + dx) * N + y + dy])) continue;
        // the stud strip of the low neighbour along this face
        for (let s = 0; s < 4; s++) {
          const a = dx > 0 ? x * 4 + 4 : dx < 0 ? x * 4 - 1 : x * 4 + s, b = dy > 0 ? y * 4 + 4 : dy < 0 ? y * 4 - 1 : y * 4 + s;
          for (let k = hn + 1; k <= h + PARAPET; k++) if (groundK(a, b) < k) put(a, b, k);
        }
      }
    }
  // corners of stepped edges: two strip studs touching only diagonally. 2026-10-13 put the
  // stud between them on the HIGH side only, which left a 1-stud hole up the outside of
  // every outer corner from the low ground to the upper ground (owner 2026-10-14: "fix
  // brick retaining wall corners"). Now the corner is a pier: the low outer stud closes the
  // wall from its own ground up, and the parapet courses also take the high stud, so the
  // parapet and coping turn inward round a solid 2-stud corner block
  const corners = [];
  for (const [k, S] of course) for (const key of [...S]) {
    const [a, b] = key.split(',').map(Number);
    for (const [da, db] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!S.has((a + da) + ',' + (b + db)) || S.has((a + da) + ',' + b) || S.has(a + ',' + (b + db))) continue;
      corners.push([k, [[a + da, b], [a, b + db]].sort((u, v) => groundK(u[0], u[1]) - groundK(v[0], v[1]))]);
    }
  }
  for (const [k, [[lp, lq], [hp, hq]]] of corners) {
    if (groundK(lp, lq) < k) put(lp, lq, k);
    if (groundK(hp, hq) < k) put(hp, hq, k);
  }
  // every wall stud goes down to its own ground (corner studs were put on one course)
  for (const [key, t] of [...top]) { const [a, b] = key.split(',').map(Number); for (let k = groundK(a, b) + 1; k < t; k++) put(a, b, k); }
  // stairs (owner 2026-10-13): plate-high risers, 1-stud treads of 1x1 flat tiles,
  // 3 risers a brick: a paved stud 0 / 1 studs from a paved neighbour a brick up
  // (orthogonal: from that edge; diagonal: from that corner, so flights wrap round
  // corners) gets a tread 8 / 4 high, the highest wins, so treads run on across
  // cells instead of a strip per cell; studs a retaining wall stands on are left to
  // the wall (else its foot course is lost and it floats)
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let x = x0; x < x1; x++)
    for (let y = y0; y < y1; y++) {
      const c = x * N + y;
      if (!inMap(x, y) || !terraceCell[c] || !paved(c) || riverCell[c]) continue;
      const ups = N8.filter(([dx, dy]) => { const n = (x + dx) * N + y + dy; return inMap(x + dx, y + dy) && paved(n) && !riverCell[n] && H[n] === H[c] + 1; });
      if (!ups.length) continue;
      const ztop = (H[c] + 1) * VZ;
      let laid = 0;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          // studs from the edge toward a neighbour on each axis (0 = touching it)
          const d = (dv, k) => (dv > 0 ? 3 - k : dv < 0 ? k : -1);
          let t = 0;
          for (const [dx, dy] of ups) t = Math.max(t, 2 - Math.max(d(dx, i), d(dy, j)));
          if (t <= 0) continue;
          const sa = x * 4 + i, sb = y * 4 + j;
          if (top.has(sa + ',' + sb)) continue;
          const cx = X0 + sa * 10 + 5, cy = Y0 + sb * 10 + 5;
          if (!B.free([cx - 5, cy - 5, ztop], [cx + 5, cy + 5, ztop + 4 * t])) continue;
          if (t === 2) B.add({ asset: 'PB_DefaultMicroBrick', size: [5, 5, 2], position: [cx, cy, ztop + 2], color: COBBLE_C }, 'ramp');
          B.add({ asset: 'PB_DefaultTile', size: [5, 5, 2], position: [cx, cy, ztop + 4 * t - 2], color: PAVE_C[Math.floor(hash(sa, sb, 91) * PAVE_C.length)] }, 'ramp');
          laid++;
        }
      if (laid) steps++;
    }
  // tile each course: pair along the wall where the joint parity allows, else a 1-stud brick
  let bricksLaid = 0, skipped = 0;
  const lay = (lo, hi, m, label) => { if (process.env.MAPGEN_TERRACEDUMP) terraceDump.push([label, lo, hi, B.free(lo, hi)]); if (!B.free(lo, hi)) { skipped++; return false; } B.add({ ...m, size: [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2], position: [0, 1, 2].map(i => (lo[i] + hi[i]) / 2) }, label); return true; };
  for (const [k, S] of course) {
    const done = new Set(), z0 = k * VZ;
    for (const key of [...S].sort()) {
      if (done.has(key)) continue;
      const [a, b] = key.split(',').map(Number);
      let a1 = a + 1, b1 = b + 1;
      if (S.has((a + 1) + ',' + b) && !done.has((a + 1) + ',' + b) && (a - k) % 2 === 0) a1 = a + 2;
      else if (S.has(a + ',' + (b + 1)) && !done.has(a + ',' + (b + 1)) && (b - k) % 2 === 0) b1 = b + 2;
      for (let p = a; p < a1; p++) for (let q = b; q < b1; q++) done.add(p + ',' + q);
      const f = 0.9 + hash(a * 7 + b, k, 501) * 0.16;
      if (lay([X0 + a * 10, Y0 + b * 10, z0], [X0 + a1 * 10, Y0 + b1 * 10, z0 + VZ], { asset: 'PB_DefaultBrick', color: BRICK_BASE.map(v => Math.round(v * f)) }, 'veneer')) bricksLaid++;
    }
  }
  // stone coping on top of the wall, merged into runs along x then y
  const cop = new Set([...top.keys()]), used = new Set();
  for (const key of [...cop].sort()) {
    if (used.has(key)) continue;
    const [a, b] = key.split(',').map(Number), k = top.get(key);
    let a1 = a + 1; while (cop.has(a1 + ',' + b) && !used.has(a1 + ',' + b) && top.get(a1 + ',' + b) === k) a1++;
    let b1 = b + 1;
    if (a1 === a + 1) while (cop.has(a + ',' + b1) && !used.has(a + ',' + b1) && top.get(a + ',' + b1) === k) b1++;
    for (let p = a; p < a1; p++) for (let q = b; q < b1; q++) used.add(p + ',' + q);
    const z = (k + 1) * VZ;
    lay([X0 + a * 10, Y0 + b * 10, z], [X0 + a1 * 10, Y0 + b1 * 10, z + 4], { asset: 'PB_DefaultMicroBrick', color: COPING[(a + b) & 1] }, 'coping');
  }
  terraceStats.steps += steps; terraceStats.veneer += bricksLaid; terraceStats.veneerSkipped += skipped;
}
const terraceStats = { steps: 0, veneer: 0, veneerSkipped: 0 };
const terraceDump = []; // MAPGEN_TERRACEDUMP=file: every wall/coping box tried
const COBBLE_C = MATS[COBBLE].color;
const PAVE_C = [[164, 156, 142], [152, 146, 134], [174, 166, 150], [158, 148, 130], [146, 140, 132]]; // floors.mjs paving

stage('townBuildings');
// town buildings (town.mjs), positioned from the square's centre on its paving
const townBricks = bricks.length;
// through the overlap guard: the game would reject overlapping bricks
const townB = makeBuilder();
const townStats = buildTown({
  put: (b, x, y, z) => townB.add({ ...b, position: [X0 + (town.fx + TOWN.cells / 2) * CELL + x, Y0 + (town.fy + TOWN.cells / 2) * CELL + y, (town.h + 1) * VZ + z] }, b.asset ?? 'box'),
  // is a town-local box clear of everything built so far (market stand spots)
  free: (x0, y0, z0, x1, y1, z1) => { const o = [X0 + (town.fx + TOWN.cells / 2) * CELL, Y0 + (town.fy + TOWN.cells / 2) * CELL, (town.h + 1) * VZ]; return townB.free([o[0] + x0, o[1] + y0, o[2] + z0], [o[0] + x1, o[1] + y1, o[2] + z1]); },
  orientFor,
  rnd: townRnd,
  plan: townPlan,
  shopTiers: ['bronze', 'iron'], // the spawn town: low tiers only (owner 2026-10-06)
  sewerDepth,
  riverAt: (ux, uy) => { const x = town.fx + TOWN.cells / 2 + Math.floor(ux / CELL), y = town.fy + TOWN.cells / 2 + Math.floor(uy / CELL); return inBounds(x, y) && riverCell[x * N + y] === 1; },
});
terraceDressing(townB, town.fx, town.fy, town.fx + TOWN.cells, town.fy + TOWN.cells, c => townKind[c] === 2);
stage('lawns');
// lawns at spawn (owner 2026-10-14: "make the grass at spawn more interesting"): on the
// town's grass lots, through the town's guard (never into a building, tree, wall or
// stall): clover patches (2-high plates in two greens, from a stud noise), grass tufts
// (3-5 thin blades 6-16 high), the odd daisy on a patch, pebbles, and a few fairy rings
// of tiny mushrooms in the widest lawns. All walk-through (collision off), nothing within
// 4 studs of a pot / shop / spawner spot (their prefabs load later)
const lawnStats = { patches: 0, tufts: 0, daisies: 0, pebbles: 0, rings: 0 };
{
  const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
  const o = [X0 + (town.fx + TOWN.cells / 2) * CELL, Y0 + (town.fy + TOWN.cells / 2) * CELL];
  const keep = [...(townStats.potSpots ?? []).map(([x, y]) => [o[0] + x, o[1] + y]), ...(townStats.townShops ?? []).map(t => [o[0] + t.at[0], o[1] + t.at[1]]), ...spawners.map(s => s.at)];
  const clearOf = (wx, wy) => !keep.some(([x, y]) => Math.abs(x - wx) < 40 && Math.abs(y - wy) < 40);
  const add = (lo, hi, color, label, extra = {}) => {
    if (!townB.free(lo, hi)) return false;
    townB.add({ asset: 'PB_DefaultMicroBrick', size: [0, 1, 2].map(k => (hi[k] - lo[k]) / 2), position: [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), color, collision: NOCOL, ...extra }, label);
    return true;
  };
  const CLOVER = [[70, 132, 50], [62, 120, 46], [92, 150, 60]], BLADE = [[78, 140, 52], [96, 156, 62], [66, 124, 46], [124, 156, 70], [104, 146, 58]];
  const lawn = new Map(); // stud "a,b" -> top z, grass lots only
  for (let x = town.fx; x < town.fx + TOWN.cells; x++)
    for (let y = town.fy; y < town.fy + TOWN.cells; y++) {
      const c = x * N + y;
      if (!inMap(x, y) || townKind[c] !== 1 || riverCell[c]) continue;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) lawn.set((x * 4 + i) + ',' + (y * 4 + j), (H[c] + 1) * VZ);
    }
  const W = (a, b) => [X0 + a * 10, Y0 + b * 10];
  // clover patches: merged runs along x of studs over the noise, per level and tone
  const patch = new Map();
  for (const [k, z] of lawn) {
    const [a, b] = k.split(',').map(Number), n = fbm2(a / 9 + 31, b / 9 - 17, 3);
    if (!LAWN_PATCHES || n < 0.28) continue; // (owner 2026-10-23: no clover patches; with none there are no daisies either)
    const t = n > 0.5 ? 0 : hash(a >> 2, b >> 2, 611) < 0.5 ? 1 : 2;
    patch.set(k, [z, t]);
  }
  const used = new Set();
  for (const k of [...patch.keys()].sort()) {
    if (used.has(k)) continue;
    const [a, b] = k.split(',').map(Number), [z, t] = patch.get(k);
    let a1 = a + 1;
    while (a1 - a < 8 && !used.has(a1 + ',' + b) && patch.get(a1 + ',' + b)?.[0] === z && patch.get(a1 + ',' + b)?.[1] === t) a1++;
    for (let p = a; p < a1; p++) used.add(p + ',' + b);
    const [x0, y0] = W(a, b), [x1, y1] = W(a1, b + 1);
    if (!clearOf((x0 + x1) / 2, y0)) continue;
  const LAWN_PATCHES = false, LAWN_ROCKS = false; // owner 2026-10-23: the lawns lose tufts, clover patches, daisies and pebbles (fairy rings stay)
    if (add([x0, y0, z], [x1, y1, z + 2], CLOVER[t], 'clover')) lawnStats.patches++;
  }
  // fairy rings: lawn studs with grass all round for 5 studs, spaced far apart
  const cand = [];
  for (const [k, z] of lawn) {
    const [a, b] = k.split(',').map(Number);
    if ((a & 3) || (b & 3) || hash(a, b, 616) > 0.5) continue;
    let ok = true;
    for (let i = -5; i <= 5 && ok; i++) for (let j = -5; j <= 5 && ok; j++) if (lawn.get((a + i) + ',' + (b + j)) !== z) ok = false;
    if (ok) cand.push([a, b, z]);
  }
  const rings = [];
  for (const [a, b, z] of cand.sort((p, q) => hash(p[0], p[1], 617) - hash(q[0], q[1], 617))) {
    if (rings.length >= 6 || rings.some(([p, q]) => Math.hypot(p - a, q - b) < 60)) continue;
    const [cx, cy] = W(a, b);
    if (!clearOf(cx, cy) || !townB.free([cx - 45, cy - 45, z + 2], [cx + 45, cy + 45, z + 20])) continue;
    rings.push([a, b]);
    const cap = hash(a, b, 618) < 0.5 ? [196, 52, 44] : [150, 104, 64];
    for (let m = 0; m < 11; m++) {
      const t = (m / 11) * 2 * Math.PI + hash(a, b, 660 + m) * 0.3, rr = 30 + 2 * Math.floor(hash(a, b, 670 + m) * 3);
      const mx = cx + 2 * Math.round((Math.cos(t) * rr) / 2), my = cy + 2 * Math.round((Math.sin(t) * rr) / 2), zb = patch.has(Math.floor((mx - X0) / 10) + ',' + Math.floor((my - Y0) / 10)) ? z + 2 : z;
      const sh = 4 + 2 * Math.floor(hash(a, b, 680 + m) * 3);
      if (add([mx - 1, my - 1, zb], [mx + 1, my + 1, zb + sh], [232, 226, 210], 'mushroom'))
        add([mx - 3, my - 3, zb + sh], [mx + 3, my + 3, zb + sh + 2], cap, 'mushroom');
    }
    lawnStats.rings++;
  }
  // tufts, daisies, pebbles: one roll per stud
  for (const [k, z] of lawn) {
    const [a, b] = k.split(',').map(Number), r = hash(a, b, 612), [x0, y0] = W(a, b);
    if (!clearOf(x0 + 5, y0 + 5)) continue;
    const zb = patch.has(k) ? z + 2 : z;
    if (r >= 0.035 && r < 0.06 && patch.has(k)) { // (grass tufts 0-0.035 were removed: owner 2026-10-23)
      // a daisy: a 2-high white head with a yellow eye
      if (add([x0 + 2, y0 + 2, zb], [x0 + 8, y0 + 8, zb + 2], [240, 238, 228], 'daisy')) { add([x0 + 4, y0 + 4, zb + 2], [x0 + 6, y0 + 6, zb + 4], [236, 196, 60], 'daisy'); lawnStats.daisies++; }
    } else if (LAWN_ROCKS && r >= 0.052 && r < 0.062) { // (owner 2026-10-23: no lawn pebbles)
      const g = 120 + Math.floor(hash(a, b, 614) * 30), w = hash(a, b, 615) < 0.5 ? 10 : 6;
      if (add([x0, y0, zb], [x0 + w, y0 + 6, zb + 4], [g, g - 4, g - 10], 'pebble')) lawnStats.pebbles++;
    }
  }
  console.error('spawn lawns:', JSON.stringify(lawnStats));
}
if (townB.dropped.length) throw new Error(`town: ${townB.dropped.length} overlapping pieces, e.g.\n${townB.dropped.slice(0, 8).join('\n')}`);
for (const { label, ...b } of townB.bricks) bricks.push(b);
stage('hamlets');
// hamlets, each through its own overlap guard; their shop spots become
// sword-shop prefab placements (shops.json)
const shops = [];
for (const v of villages) {
  const vb = makeBuilder(), o = [X0 + v.x * CELL, Y0 + v.y * CELL, (v.h + 1) * VZ];
  const st = buildTown({
    put: (b, x, y, z) => vb.add({ ...b, position: [o[0] + x, o[1] + y, o[2] + z] }, b.asset ?? 'box'),
    // (2026-10-15) walkway flags check the hamlet's own bricks (one hit a door case)
    free: (x0, y0, z0, x1, y1, z1) => vb.free([o[0] + x0, o[1] + y0, o[2] + z0], [o[0] + x1, o[1] + y1, o[2] + z1]),
    orientFor,
    rnd: townRnd,
    village: { seed: v.seed, shops: v.shops?.length ?? 0, desert: v.desert, nordic: !!v.nordic },
    shopTiers: [...new Set(v.shops.filter(w => w.prefab.startsWith('shop_')).map(w => w.tier))],
    plan: v.plan,
    riverAt: (ux, uy) => { const x = v.x + Math.floor(ux / CELL), y = v.y + Math.floor(uy / CELL); return inBounds(x, y) && riverCell[x * N + y] === 1; },
  });
  terraceDressing(vb, v.x - VW, v.y - VW, v.x + VW + 1, v.y + VW + 1, c => villagePaved[c] === 1);
  if (vb.dropped.length) throw new Error(`village: ${vb.dropped.length} overlapping pieces, e.g.\n${vb.dropped.slice(0, 8).join('\n')}`);
  for (const { label, ...b } of vb.bricks) bricks.push(b);
  (st.shopSpots ?? []).forEach(([x, y, z, orient], k) => shops.push({ at: [o[0] + x, o[1] + y, o[2] + z], tier: v.shops[k].tier, prefab: v.shops[k].prefab, orient }));
  if ((st.shopSpots ?? []).length < v.shops.length) console.error(`hamlet ${v.seed}: room for ${st.shopSpots.length} of ${v.shops.length} stands`);
  for (const hs of st.houseShops) shops.push({ at: [o[0] + hs.at[0], o[1] + hs.at[1], o[2] + hs.at[2]], tier: hs.tier, orient: hs.orient, house: true, ...(hs.prefab ? { prefab: hs.prefab } : {}) });
  for (const [x, y] of st.potSpots ?? []) pots.push({ at: [o[0] + x, o[1] + y, o[2] + v.plan.levelAt(x, y) + 12], where: 'hamlet' });
  checkpoints.push({ at: [o[0], o[1] - 100, o[2] + v.plan.levelAt(0, -100) + 2], where: 'village' });
  v.center = o;
  v.buildings = st.buildings;
  v.rejects = st.rejects;
}
const townCount = bricks.length - townBricks;
if (process.env.MAPGEN_TERRACEDUMP) fs.writeFileSync(process.env.MAPGEN_TERRACEDUMP, JSON.stringify(terraceDump));
// thinned-out town buildings as world boxes, so a live world built before the
// thinning can be cleared with br.World.ClearRegion
const townOrigin = [X0 + (town.fx + TOWN.cells / 2) * CELL, Y0 + (town.fy + TOWN.cells / 2) * CELL, (town.h + 1) * VZ];
stage('shops');
// sword-shop stands inside some town houses (town.mjs HOUSE_SHOP_CHANCE)
for (const hs of townStats.houseShops) shops.push({ at: hs.at.map((v, k) => townOrigin[k] + v), tier: hs.tier, orient: hs.orient, house: true, ...(hs.prefab ? { prefab: hs.prefab } : {}) });
// the roadside weapon shops' stands (2026-10-15)
for (const ws of wildShops) shops.push(ws);
// the spawn market: every sword shop and gun stand on the plaza
for (const [x, y] of townStats.potSpots ?? []) pots.push({ at: [townOrigin[0] + x, townOrigin[1] + y, townOrigin[2] + townPlan.levelAt(x, y) + 12], where: 'town' });
// faire shopkeepers (2026-10-19) and the faire door / boardwalk helpers, in world units like the shops
const faireNpcs = (townStats.faireNpcs ?? []).map(n => ({ ...n, at: n.at.map((v, k) => townOrigin[k] + v) }));
const faireDocks = (townStats.faireDocks ?? []).map(d => ({ ...d, z: d.z + townOrigin[2], dock: d.dock.map(([x, y]) => [x + townOrigin[0], y + townOrigin[1]]), doors: d.doors.map(o => ({ ...o, at: [o.at[0] + townOrigin[0], o.at[1] + townOrigin[1]] })) }));
delete townStats.faireDocks; delete townStats.faireNpcs;
for (const ts of townStats.townShops ?? []) shops.push({ at: ts.at.map((v, k) => townOrigin[k] + v), tier: ts.tier, orient: ts.orient, market: true, ...(ts.prefab ? { prefab: ts.prefab } : {}) });
const townRemoved = townStats.removed.map(({ type, lo, hi }) => ({
  type,
  lo: lo.map((v, k) => (k === 2 ? Math.max(v, 0) : v) + townOrigin[k]), // never below the paving
  hi: hi.map((v, k) => v + townOrigin[k]),
}));
delete townStats.removed;
// ClearRegion takes every brick entirely inside a box (+1 margin). Rotated
// bricks are judged by their centre (their local size is permuted). Kept
// bricks a box swallows (a few street lamps) go back in after the clear.
const inBox = b => townRemoved.some(({ lo, hi }) => [0, 1, 2].every(k => b.position[k] - b.size[k] >= lo[k] - 1 && b.position[k] + b.size[k] <= hi[k] + 1));
const swallowed = bricks.filter(b => inBox(b.direction || b.rotation ? { position: b.position, size: [0, 0, 0] } : b));
if (PREVIEW) { previewOut(true); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'town_removed.json'), JSON.stringify({ boxes: townRemoved, restore: swallowed }));
const decorCount = bricks.length - terrainCount - dungeonCount;

console.error(JSON.stringify({
  seed: SEED, cells: N, mapStuds: (N * CELL) / 10, waterHeight: WATER_Z,
  town: { center: [X0 + (town.fx + TOWN.cells / 2) * CELL, Y0 + (town.fy + TOWN.cells / 2) * CELL, (town.h + 1) * VZ], bricks: townCount, ...townStats, thinnedOut: townRemoved.length, restoredAfterClear: swallowed.length },
  caves: caves.length, carvedVoxels: carved,
  terrainBricks: terrainCount, dungeonBricks: dungeonCount, decorBricks: decorCount, total: bricks.length,
  trees, treeKinds, treeBricks, forestStats, boulders, ramps, terrace: terraceStats,
  plants: plantCount,
  desert: { centre: [X0 + desert.x * CELL, Y0 + desert.y * CELL], r: DESERT.r * CELL, cacti, villages: villages.filter(v => v.desert).length },
  volcano: { centre: at(volcano.x, volcano.y, volcano.rim).map(Math.round), foot: volcano.foot, rim: volcano.rim, lake: volcano.lake, roadCells: volcano.road.length, lead: at(...volcano.lead, H[volcano.lead[0] * N + volcano.lead[1]] + 1).map(Math.round) },
  snow: { centre: at(snowSite.x, snowSite.y, 0).slice(0, 2).map(Math.round), r: SNOWB.r * CELL },
  deathForest: { centre: at(deathForest.x, deathForest.y, 0).slice(0, 2).map(Math.round), cells: deathForest.cells, ...deathProps },
  swamp: { center: at(swamp.x, swamp.y, 0).slice(0, 2), gate: swamp.gate, zombieSpawners: swampSpawns.length, deadTrees, turds },
  villages: villages.map(v => ({ name: v.name, center: v.center, shops: (v.shops || []).map(w => w.prefab), buildings: v.buildings, rejects: v.rejects, desert: v.desert })),
  townName: TOWN_NAME,
  checkpoints,
  bounds: { x: [X0, X0 + N * CELL], y: [Y0, Y0 + N * CELL] },
  spawners: Object.fromEntries(SPAWNERS.map((n, t) => [n, spawners.filter(p => p.tier === t + 1).length])),
  caveDoors: caves.map(c => at(c.x, c.y, c.h + 1).map(Math.round)),
  henge: henge.center,
  ruins: ruins.map(v => ({ at: at(v.x, v.y, v.h + 1).map(Math.round), goblins: v.goblins })), camps: camps.map(c => ({ at: at(c.x, c.y, c.h + 1).map(Math.round), goblins: c.goblins })), details,
  outposts: outposts.map(o => ({ at: at(o.x, o.y, o.h + 1).map(Math.round), tier: o.tier, progress: +o.t.toFixed(2) })),
  dungeons: DUNGEONS.map(d => ({ name: d.name, levels: d.levels, entrance: d.entrance,
    center: [d.origin[0] + (d.cells * CELL) / 2, d.origin[1] + (d.cells * CELL) / 2] })),
}, null, 1));

// Procedural sizes off the stud/plate grid load as "Missing brick type".
// Micro bricks snap to 1/5 stud (2 units), so only whole half-extents there.
const offGrid = bricks.filter(b => b.size[0] && !b.gameSize && (/^PB_DefaultMicro/.test(b.asset ?? '')
  ? b.size.some(v => !Number.isInteger(v))
  : b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2));
if (offGrid.length && process.env.MAPGEN_LENIENT) { const og = new Set(offGrid); for (let i = bricks.length - 1; i >= 0; i--) if (og.has(bricks[i])) bricks.splice(i, 1); console.error(`lenient: dropped ${og.size} off-grid bricks`); }
else if (offGrid.length) throw new Error(`${offGrid.length} bricks off the stud grid, e.g. ${JSON.stringify(offGrid[0])}`);
// ride surface pieces (ride: 1) give way to anything placed on the road after them (roadside stones,
// tunnel trim, walkway flags): the game would reject one of each overlapping pair anyway
{
  const G = 200, idx = new Map(), rideBox = [];
  bricks.forEach((b, i) => { if (b.ride || b.soft) rideBox.push([i, ...worldBox(b, BUILDER_FIXED)]); });
  const cells = new Set(); for (const [, lo, hi] of rideBox) for (let x = Math.floor(lo[0] / G); x <= Math.floor((hi[0] - 1) / G); x++) for (let y = Math.floor(lo[1] / G); y <= Math.floor((hi[1] - 1) / G); y++) cells.add(x + ',' + y);
  for (const b of bricks) {
    if (b.ride || b.soft) continue;
    const [lo, hi] = worldBox(b, BUILDER_FIXED);
    for (let x = Math.floor(lo[0] / G); x <= Math.floor((hi[0] - 1) / G); x++) for (let y = Math.floor(lo[1] / G); y <= Math.floor((hi[1] - 1) / G); y++) { const k = x + ',' + y; if (cells.has(k)) (idx.get(k) ?? idx.set(k, []).get(k)).push([lo, hi]); }
  }
  const drop = new Set();
  for (const [i, lo, hi] of rideBox) {
    let hit = false;
    for (let x = Math.floor(lo[0] / G); x <= Math.floor((hi[0] - 1) / G) && !hit; x++) for (let y = Math.floor(lo[1] / G); y <= Math.floor((hi[1] - 1) / G) && !hit; y++)
      for (const [a0, a1] of idx.get(x + ',' + y) ?? []) if (lo[0] < a1[0] && a0[0] < hi[0] && lo[1] < a1[1] && a0[1] < hi[1] && lo[2] < a1[2] && a0[2] < hi[2]) { hit = true; break; }
    if (hit) drop.add(i);
  }
  const keep = [];
  let cut = 0;
  for (const i of drop) {
    const b = bricks[i];
    if (!b.split || (b.size[0] === 5 && b.size[1] === 5)) continue;
    const [lo, hi] = worldBox(b, BUILDER_FIXED);
    for (let x = lo[0]; x < hi[0]; x += 10) for (let y = lo[1]; y < hi[1]; y += 10) {
      let hit = false;
      for (let gx = Math.floor(x / G); gx <= Math.floor((x + 9) / G) && !hit; gx++) for (let gy = Math.floor(y / G); gy <= Math.floor((y + 9) / G) && !hit; gy++)
        for (const [a0, a1] of idx.get(gx + ',' + gy) ?? []) if (x < a1[0] && a0[0] < x + 10 && y < a1[1] && a0[1] < y + 10 && lo[2] < a1[2] && a0[2] < hi[2]) { hit = true; break; }
      if (!hit) keep.push({ ...b, position: [x + 5, y + 5, b.position[2]], size: [5, 5, b.size[2]] }); else cut++;
    }
  }
  if (drop.size) { let k = 0; for (let i = 0; i < bricks.length; i++) if (!drop.has(i)) bricks[k++] = bricks[i]; bricks.length = k; }
  bricks.push(...keep);
  console.error(`ride surface pieces dropped for objects on the road: ${drop.size} (asphalt fills cut to studs: ${keep.length} kept, ${cut} dropped)`);
}
{ let k = 0; for (const b of bricks) if (!b.ghost) bricks[k++] = b; bricks.length = k; } // ghosts (town.mjs vending): boxes held for prefabs loaded later
for (const b of bricks) { delete b.gameSize; delete b.group; delete b.ride; delete b.soft; delete b.split; } // (town.mjs asProp / prop: sizes the owner placed in game, model groups; ride surface marks)

stage('output');
// ----------------------------------------------------------------- output --
// World shift (owner 2026-10-05: spawn points don't work, the game drops you on
// the highest surface round (-200, 0), "make this area the centre of the
// world"): everything is generated in the old frame (terrain noise is keyed to
// it) and moved at output so the town square's centre lands on (0, 0).
// Live coordinates = generator coordinates + SHIFT. The summary above is in
// the generator frame.
const SHIFT = [-(X0 + (town.fx + TOWN.cells / 2) * CELL), -(Y0 + (town.fy + TOWN.cells / 2) * CELL), 0]; // (10660, 7700) at scale 1
// (owner 2026-10-10: "remove flowers") every flower the features place (plants,
// town beds, window boxes, crops, lotus pads) is dropped here, so the rest of
// the map stays byte-identical. Live: cleared by bridge/tools/noflowers.py.
// (owner 2026-10-10: "remove branches and twigs") B_Branch goes the same way
// (owner 2026-10-12: "remove bushes that dont drop anything", "these ferns need to go") decorative B_Bush and B_Fern dropped too
const FLOWERS = new Set(['B_Flower', 'B_Small_Flower', 'B_Tulip', 'B_Rose', 'B_Lotus_1x1', 'B_Lotus_2x2', 'B_Branch', 'B_Fern', 'B_Leaf_Bush', 'B_Pumpkin']); // owner: "no flowers or any of that shit" (decorative B_Bush: dropped in the smashable block below)
{
  let k = 0;
  for (const b of bricks) if (!FLOWERS.has(b.asset)) bricks[k++] = b;
  console.error(`flowers and branches removed: ${bricks.length - k}`);
  bricks.length = k;
}
// (owner 2026-10-13: "you made a checkpoint with no checkpoint component") a B_CheckPoint brick
// only works with its Component_CheckPoint (data from one placed in-game): every one gets it
for (const b of bricks) if (b.asset === 'B_CheckPoint' && !b.components) b.components = [{ type: 'Component_CheckPoint', data: { bRotatePlayerGravityOnSpawn: true } }];
// exact duplicates (2026-10-13: a torch or wedge placed twice by two features; the
// game rejects the second copy anyway): keep the first
{
  const seen = new Set(); let k = 0;
  for (const b of bricks) { const key = JSON.stringify(b); if (!seen.has(key)) { seen.add(key); bricks[k++] = b; } }
  console.error(`exact duplicate bricks dropped: ${bricks.length - k}`);
  bricks.length = k;
}
// (owner 2026-10-10: "bushes that are like if you attack them they work like
// pots") about a quarter of the plain B_Bush plants become the `bush` prefab
// (bridge/tools/potgen5.mjs KIND=bush: hit -> hidden 120 s, twig snap, global
// event "pot.smashed" -> pot_pool loot); listed in bushes.json, stamped by
// loadextras.py like the pots (br.Prefab.Load "bush" x y z 0 16, z = the brick's centre)
const bushes = [];
{
  let k = 0;
  for (const b of bricks) {
    if (b.asset === 'B_Bush' && hash(Math.round(b.position[0] / 10), Math.round(b.position[1] / 10), 977) < tune('bush.smashable', 0.25, 'share of bushes you can smash like pots')) { bushes.push({ at: [...b.position] }); continue; }
    if (b.asset === 'B_Bush') continue; // (owner 2026-10-12) the rest dropped nothing: gone
    bricks[k++] = b;
  }
  bricks.length = k;
  // (2026-10-12) the bush is world bricks now (bushgen6.mjs, a target ring 18 out): stand it on the
  // highest terrain under that ring, or the game rejects it where a slope rises into it
  const cellOf = (x, y) => `${Math.floor(x / 200)},${Math.floor(y / 200)}`, idx = new Map();
  for (const b of bricks) { const [lo, hi] = worldBox(b); for (let x = Math.floor(lo[0] / 200); x <= Math.floor(hi[0] / 200); x++) for (let y = Math.floor(lo[1] / 200); y <= Math.floor(hi[1] / 200); y++) { const kk = `${x},${y}`; (idx.get(kk) ?? idx.set(kk, []).get(kk)).push([lo, hi]); } }
  for (const p of bushes) {
    const [x, y, z] = p.at; let top = z - 16;
    for (const [lo, hi] of idx.get(cellOf(x, y)) ?? []) if (hi[0] > x - 22 && lo[0] < x + 22 && hi[1] > y - 22 && lo[1] < y + 22 && lo[2] < z + 16) top = Math.max(top, hi[2]);
    p.at[2] = top + 16;
  }
  console.error(`smashable bushes: ${bushes.length}`);
}
if (!DRY) {
  const mv = p => [p[0] + SHIFT[0], p[1] + SHIFT[1], p[2] + SHIFT[2]];
  for (const b of bricks) b.position = mv(b.position);
  for (const sp of spawners) sp.at = mv(sp.at);
  for (const sh of shops) sh.at = mv(sh.at);
  for (const p of pots) p.at = mv(p.at);
  for (const p of bushes) p.at = mv(p.at);
  for (const p of gems) p.at = mv(p.at);
  if (CAVE_DUMP) fs.writeFileSync(process.env.CAVE_DUMP, JSON.stringify(CAVE_DUMP)); // (shifted with the rest: same objects)
  for (const p of casinoGames) p.at = mv(p.at);
  for (const n of faireNpcs) n.at = mv(n.at);
  for (const d of faireDocks) { d.z += SHIFT[2]; d.dock = d.dock.map(([x, y]) => [x + SHIFT[0], y + SHIFT[1]]); for (const o of d.doors) o.at = [o.at[0] + SHIFT[0], o.at[1] + SHIFT[1]]; }
  console.error(`shifted by ${SHIFT.join(',')}: town centre now at 0,0`);
  // live editor edits (liveedit/: owner 2026-10-13, "no world-only fixes"): every deployed,
  // not undone change set is replayed on the output (live coordinates), matched by shape + place
  {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'liveedit', 'edits');
    const edits = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(e => !e.undone) : [];
    if (edits.length) { const { replayEdits } = await import('../liveedit/patterns.mjs'); console.error(`live edits replayed: ${JSON.stringify(replayEdits(bricks, edits))} from ${edits.length} sets`); }
  }
  for (const f of fs.readdirSync(OUT)) if (/^chunk_\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f));
  // bottom-up, west to east, so the map rises out of the ground
  bricks.sort((a, b) => (a.position[2] - a.size[2]) - (b.position[2] - b.size[2]) || a.position[0] - b.position[0]);
  const PER = 5000;
  let n = 0;
  for (let i = 0; i < bricks.length; i += PER, n++) {
    // externalAssets: what component data refers to by index (sign text Font 0, ruins.mjs); loaders pass it on
    const job = { ops: [{ op: 'bricks', at: [0, 0, 0], captureMs: 1500, externalAssets: EXTERNAL_ASSETS, bricks: bricks.slice(i, i + PER) }] };
    // async: the disk writes overlap the stringify of the next chunks
    fs.promises.writeFile(path.join(OUT, `chunk_${String(n).padStart(3, '0')}.json`), JSON.stringify(job)).catch(e => { console.error(e); process.exitCode = 1; });
  }
  console.error(`wrote ${n} chunks to ${OUT}`);
  fs.writeFileSync(path.join(OUT, 'pipeline.json'), JSON.stringify(stageLog()));
  console.error(`pipeline: ${stageLog().map(s => `${s.id} ${s.ms}`).join(', ')}`);
  fs.writeFileSync(path.join(OUT, 'spawners.json'), JSON.stringify(spawners));
  for (const sh of shops) sh.prefab ??= `shop_${sh.tier}`; // house and market stands name only their tier (2026-10-08: they loaded as "undefined")
  fs.writeFileSync(path.join(OUT, 'shops.json'), JSON.stringify(shops));
  // (2026-10-21, owner: "randomize their colors") pots/potgen6.mjs colour variants pot_0..15, picked by spot hash
  const potHash = ([x, y, z]) => { let h = Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663) ^ Math.imul(Math.round(z), 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) % 16; }; // spots sit on the 10 grid: mix the bits or every index comes out even
  for (const p of pots) p.prefab ??= `pot_${potHash(p.at)}`;
  fs.writeFileSync(path.join(OUT, 'pots.json'), JSON.stringify(pots));
  fs.writeFileSync(path.join(OUT, 'casino.json'), JSON.stringify(casinoGames)); // br.Prefab.Load "<prefab>" x y z 0 <orient>
  fs.writeFileSync(path.join(OUT, 'gods.json'), JSON.stringify(holy.filter(v => v.god).map(v => ({ kind: v.kind, at: [X0 + v.x * CELL + SHIFT[0], Y0 + v.y * CELL + SHIFT[1], (v.h + 1) * VZ], ...v.god })), null, 1));
  fs.writeFileSync(path.join(OUT, 'npcs.json'), JSON.stringify(faireNpcs)); // python3 bridge/tools/loadnpcs.py npcs.json <tag>: homed npc_<role> spawners
  fs.writeFileSync(path.join(OUT, 'docks.json'), JSON.stringify(faireDocks)); // faire boardwalk rects + door spots (helpers, nothing loads them)
  fs.writeFileSync(path.join(OUT, 'gems.json'), JSON.stringify(gems)); // br.Prefab.Load "gem_<kind>" x y z 0 16 (z = the floor)
  fs.writeFileSync(path.join(OUT, 'bushes.json'), JSON.stringify(bushes)); // br.Prefab.Load "bush" x y z 0 16 // br.Prefab.Load "pot" x y z 0 16
  // overview image source for a quick look: height + water + dungeons
  const px = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const h = H[x * N + y];
      const c = h <= SEA ? MATS[WATER].color : MATS[surfaceMat[x * N + y]].color;
      const k = 0.6 + Math.min(0.6, h / 150);
      px.push(c.map(v => Math.min(255, Math.round(v * k))));
    }
  fs.writeFileSync(path.join(OUT, 'overview.ppm'), Buffer.concat([
    Buffer.from(`P6 ${N} ${N} 255\n`), Buffer.from(px.flat()),
  ]));
}
