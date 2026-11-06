// Race track procgen from the fun-area kart track's own segments (owner 2026-11-06: "develop a racetrack procgen using
// segments from the racetrack"). The real track (start line -4724 -26456) is a tile grid: 150 x 150 x 10 road tiles in
// a purple two-tone checker (196,117,255 / 129,77,168), two tiles wide, walled by white 150 x 150 x 50 blocks. So a
// segment = one 300-unit road square; the generator lays a random closed loop of them and walls every empty tile next
// to the road, exactly like the original.
// Loop: start from a rectangular cycle of road squares, then many "bumps": push two consecutive squares of a straight
// one square out (or in), splicing the cycle, only if the new squares stay in bounds and touch no other part of the
// track (so corridors never merge). Start/finish strip on the first straight going +y. Seeded: same seed, same track.
// node mapgen/trackgen.mjs X Y Z [SEED] [COLS] [ROWS] > job.json
import { makeBuilder, rng } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, SEED = 1, COLS = 10, ROWS = 8] = process.argv.slice(2).map(Number);
const OWNER = { id: `c1a0de00-0000-4b0b-9a11-${String(800000 + SEED).padStart(12, '0')}`, name: `Claude Track ${SEED}`, display_name: `Claude Track ${SEED}` };
const rand = rng(SEED);
const SEG = 300, TILE = 150, ROAD = [[196, 117, 255], [129, 77, 168]], WALL = [255, 255, 255];
const key = (i, j) => `${i},${j}`;
// ---- the loop on the segment grid
export function makeLoop(cols, rows, rnd, bumps = 600) {
  let cyc = [];
  for (let i = 1; i < cols - 1; i++) cyc.push([i, 1]);
  for (let j = 1; j < rows - 1; j++) cyc.push([cols - 2, j]);
  for (let i = cols - 2; i > 1; i--) cyc.push([i, rows - 2]);
  for (let j = rows - 2; j > 1; j--) cyc.push([1, j]);
  cyc = cyc.filter((c, n, a) => n === 0 || key(...c) !== key(...a[n - 1]));
  for (let t = 0; t < bumps; t++) {
    const n = cyc.length, k = Math.floor(rnd() * n), a = cyc[k], b = cyc[(k + 1) % n];
    const d = [b[0] - a[0], b[1] - a[1]], nrm = rnd() < 0.5 ? [d[1], -d[0]] : [-d[1], d[0]];
    const a2 = [a[0] + nrm[0], a[1] + nrm[1]], b2 = [b[0] + nrm[0], b[1] + nrm[1]];
    if ([a2, b2].some(([i, j]) => i < 0 || j < 0 || i >= cols || j >= rows)) continue;
    const on = new Set(cyc.map(c => key(...c)));
    if (on.has(key(...a2)) || on.has(key(...b2))) continue;
    // a2/b2 may only touch (8-neighbourhood) a, b and each other: keeps a full square of space between corridors
    const prev = cyc[(k - 1 + n) % n], next = cyc[(k + 2) % n]; // the squares either side of the bump touch it diagonally
    const allowed = new Set([key(...a), key(...b), key(...a2), key(...b2), key(...prev), key(...next)]);
    const touches = [a2, b2].some(([i, j]) => { for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const q = key(i + di, j + dj); if (on.has(q) && !allowed.has(q)) return true; } return false; });
    if (touches) continue;
    cyc.splice(k + 1, 0, a2, b2);
  }
  return cyc;
}
const cyc = makeLoop(COLS, ROWS, rand);
// self-check: a closed loop of 4-neighbour steps, no square twice
const ok = cyc.every((c, n) => { const d = cyc[(n + 1) % cyc.length]; return Math.abs(c[0] - d[0]) + Math.abs(c[1] - d[1]) === 1; }) && new Set(cyc.map(c => key(...c))).size === cyc.length;
if (!ok) throw new Error('trackgen: loop broken');
// ---- tiles: each road square = 2 x 2 road tiles (checker), every empty tile next to road = a wall block
const road = new Set();
for (const [i, j] of cyc) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) road.add(key(i * 2 + a, j * 2 + b));
const B = makeBuilder({ cell: 300 });
const MB = 'PB_DefaultMicroBrick';
for (const t of road) { const [ti, tj] = t.split(',').map(Number); B.box(ti * TILE, tj * TILE, 0, ti * TILE + TILE, tj * TILE + TILE, 10, { asset: MB, color: ROAD[(ti + tj) & 1] }, 'road'); }
const walls = new Set();
for (const t of road) { const [ti, tj] = t.split(',').map(Number); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = key(ti + a, tj + b); if (!road.has(q)) walls.add(q); } }
for (const w of walls) { const [ti, tj] = w.split(',').map(Number); B.box(ti * TILE, tj * TILE, 0, ti * TILE + TILE, tj * TILE + TILE, 50, { asset: MB, color: WALL }, 'wall'); }
// start/finish: a glowing white strip across the first road square whose next step goes +y
const s = cyc.findIndex((c, n) => { const d = cyc[(n + 1) % cyc.length]; return d[1] === c[1] + 1 && d[0] === c[0]; });
if (s >= 0) { const [i, j] = cyc[s]; B.box(i * SEG, j * SEG + 140, 10, i * SEG + SEG, j * SEG + 160, 12, { asset: MB, color: [255, 255, 255], material: 'BMC_Glow', material_intensity: 2 }, 'start line'); }
const bricks = B.bricks.map(({ label, ...b }) => b);
const start = s >= 0 ? [X + cyc[s][0] * SEG + SEG / 2, Y + cyc[s][1] * SEG + 150, Z + 10] : null;
process.stderr.write(`trackgen seed ${SEED}: ${cyc.length} segments (${(cyc.length * SEG / 100).toFixed(0)} studs a lap), ${road.size} road tiles, ${walls.size} walls, ${bricks.length} bricks, ${COLS * SEG} x ${ROWS * SEG} units; start line ${start}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 5000, bricks }] }));
