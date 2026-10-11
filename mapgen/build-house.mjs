// Places the manor (house.mjs) on the live map: picks the lot in front of a
// player, raises a stone terrace over the terrain, clears decor on the lot and
// writes ONE bridge job (announce, clears, all bricks, done).
//
//   node build-house.mjs (--at X,Y | --center X,Y) [--facing -x] [--clear-box x0,y0,x1,y1] [--map out] [--job house_job.json]
//
// --center puts the lot centre there directly (on the 40 grid). --clear-box
// also clears every non-terrain brick of ours in that box (e.g. a whole town
// block the lot sits in), so no half-cut buildings are left around the lot.
//
// --at is the player's position; the lot's front edge lands ~9 studs ahead of
// them, the front door facing them. The map's bricks (out/chunk_*.json, the
// version that is live) give the terrain height in every 4-stud column under
// the lot; each column is filled with stone up to one level, so nothing floats
// and nothing overlaps the ground.

import fs from 'fs';
import path from 'path';
import { buildHouse } from './house.mjs';
import { worldBox } from './orient.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [px, py] = (opt('--at') ?? '0,0').split(',').map(Number);
const facing = opt('--facing', '-x');
const MAP = opt('--map', 'out');
const JOB = opt('--job', 'house_job.json');
const QUOTE = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';

// the house's front faces +x in its own frame; turn it to face the player
const ROT = { '-x': [1, 0, 0, 1], '+x': [-1, 0, 0, -1], '-y': [0, -1, 1, 0], '+y': [0, 1, -1, 0] }[facing];
if (!ROT) throw new Error('--facing must be -x, +x, -y or +y');
const turn = ([x, y]) => [ROT[0] * x + ROT[1] * y, ROT[2] * x + ROT[3] * y];
// lot centre: 500 back from the front edge, front edge 90 ahead of the player, on the 40 grid
const fwd = turn([1, 0]); // the house's +x in world (points back at the player)
const snap = v => Math.round(v / 40) * 40;
const centre = opt('--center')?.split(',').map(Number);
const [cx, cy] = centre ? centre.map(snap) : [snap(px - fwd[0] * 590), snap(py - fwd[1] * 590)];
const CLEAR = opt('--clear-box')?.split(',').map(Number);
const LOT = [cx - 500, cy - 500, cx + 500, cy + 500];

// ----------------------------------------------------- terrain under the lot --
const bricks = [];
for (const f of fs.readdirSync(MAP).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(fs.readFileSync(path.join(MAP, f))).ops) bricks.push(...op.bricks);
const hits = (R, [lo, hi]) => lo[0] < R[2] && hi[0] > R[0] && lo[1] < R[3] && hi[1] > R[1];
// terrain = plain/tile boxes on the voxel grid: 40-unit cells (edges at 20 mod 40)
// and whole 12-unit voxels in z; everything else (decor, town buildings) is clearable
const onCells = v => ((v % 40) + 40) % 40 === 20;
const isTerrain = (b, [lo, hi]) => (!b.asset || b.asset === 'PB_DefaultTile') &&
  onCells(lo[0]) && onCells(lo[1]) && onCells(hi[0]) && onCells(hi[1]) && lo[2] % 12 === 0 && hi[2] % 12 === 0;
const terrain = [], decor = [];
for (const b of bricks) {
  const box = worldBox(b);
  const inLot = hits(LOT, box), inClear = CLEAR && hits(CLEAR, box);
  if (!inLot && !inClear) continue;
  if (isTerrain(b, box)) { if (inLot) terrain.push({ b, box }); }
  else decor.push({ b, box });
}
// top of the ground in each 40-unit column of the lot
const NC = 25, top = new Array(NC * NC).fill(-Infinity);
for (const { box: [lo, hi] } of terrain)
  for (let i = 0; i < NC; i++)
    for (let j = 0; j < NC; j++) {
      const x = LOT[0] + i * 40 + 20, y = LOT[1] + j * 40 + 20;
      if (x > lo[0] && x < hi[0] && y > lo[1] && y < hi[1]) top[i * NC + j] = Math.max(top[i * NC + j], hi[2]);
    }
if (top.some(t => t === -Infinity)) throw new Error('lot runs off the map');
const ground = Math.max(...top), lowest = Math.min(...top);
const L = ground + 4; // lot surface: the raster plates sit on the highest column
// stone fill from each column's top up to L - 4, merged where tops match
const fill = [];
const used = new Uint8Array(NC * NC);
for (let i = 0; i < NC; i++)
  for (let j = 0; j < NC; j++) {
    if (used[i * NC + j] || top[i * NC + j] >= L - 4) continue;
    const t = top[i * NC + j];
    let w = 1;
    while (i + w < NC && !used[(i + w) * NC + j] && top[(i + w) * NC + j] === t && w < 8) w++;
    let h = 1;
    grow: while (j + h < NC && h < 8) {
      for (let a = 0; a < w; a++) if (used[(i + a) * NC + j + h] || top[(i + a) * NC + j + h] !== t) break grow;
      h++;
    }
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) used[(i + a) * NC + j + b] = 1;
    const x0 = LOT[0] + i * 40, y0 = LOT[1] + j * 40;
    // split tall fills so no brick is over 50 bricks high
    for (let z = t; z < L - 4; z += 600) {
      const z1 = Math.min(L - 4, z + 600);
      fill.push({ size: [w * 20, h * 20, (z1 - z) / 2], position: [x0 + w * 20, y0 + h * 20, (z + z1) / 2], color: [104, 100, 96] });
    }
  }

// ------------------------------------------------------------------ house --
const { bricks: house, dropped } = buildHouse({ seed: 7 });
if (dropped.length) throw new Error(`house has ${dropped.length} overlaps:\n${dropped.slice(0, 5).join('\n')}`);
// rotate a brick about z by the lot turn: positions turn; x/y sizes swap for quarter turns;
// wedges and corners re-derive their orientation from the turned box
const quarter = ROT[1] !== 0;
const placed = house.map(({ label, ...b }) => {
  const [x, y] = turn(b.position);
  const out = { ...b, position: [cx + x, cy + y, L + b.position[2]] };
  if (quarter && b.size) {
    if (b.asset?.startsWith('PB_DefaultMicroWedge')) throw new Error('quarter-turned wedges are not supported yet; face -x or +x');
    out.size = [b.size[1], b.size[0], b.size[2]];
  }
  if (!quarter && ROT[0] < 0 && b.asset?.startsWith('PB_DefaultMicroWedge')) throw new Error('half-turned wedges are not supported yet; face -x');
  return out;
});

// grid check: procedural non-micro sizes on the stud/plate grid
const all = [...fill, ...placed];
const bad = all.filter(b => b.size?.[0] && !/^PB_DefaultMicro/.test(b.asset ?? '') && (b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2));
if (bad.length) throw new Error(`${bad.length} bricks off the grid, e.g. ${JSON.stringify(bad[0])}`);
if (all.some(b => b.position.some(v => !Number.isInteger(v)))) throw new Error('non-integer position');
// nothing of ours may overlap the terrain we keep
const keep = terrain.map(t => t.box);
let clash = 0;
for (const b of all) {
  const [lo, hi] = worldBox(b);
  if (keep.some(([a0, a1]) => [0, 1, 2].every(k => lo[k] < a1[k] && a0[k] < hi[k]))) clash++;
}
if (clash) throw new Error(`${clash} bricks overlap the terrain`);

// ---------------------------------------------------------------- the job --
const clears = decor.map(({ box: [lo, hi] }) => ({
  op: 'cmd', line: `br.World.ClearRegion ${lo.map((v, k) => (v + hi[k]) / 2).join(' ')} ${lo.map((v, k) => (hi[k] - v) / 2 + 1).join(' ')}`,
}));
const job = {
  ops: [
    { op: 'say', msg: `<size="40"><color="ff4040"><b>${QUOTE}</></></>` },
    { op: 'say', msg: `<size="24"><b>Building a manor: ${all.length.toLocaleString('en-US')} bricks, all at once.</></>` },
    ...clears,
    { op: 'sleep', ms: 1500 },
    { op: 'bricks', owner: 'house', at: [0, 0, 0], captureMs: 8000, bricks: all },
    { op: 'say', msg: '<size="24"><b>Manor done.</> Come on in, the front door is open.</>' },
  ],
};
fs.writeFileSync(JOB, JSON.stringify(job));
console.log(JSON.stringify({
  lot: LOT, center: [cx, cy], facing, groundTop: ground, lowestColumn: lowest, surfaceZ: L,
  fillBricks: fill.length, houseBricks: placed.length, decorCleared: decor.length, total: all.length, job: JOB,
}, null, 1));
