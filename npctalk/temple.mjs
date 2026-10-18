// THE TEMPLE OF THE STASH (main quest chapter 5, Raiders of the Lost Stash; owner 2026-10-18 asked
// for an Indiana Jones segment, this replaces its TRAPS COMING SOON placeholder). Green Gary's
// swamp temple south of his hammock: three mossy stepped tiers fitted onto the terrain
// (columns stand on the highest brick under them), a walled sanctum with a door to the north,
// entrance pillars, a tiled roof with a stepped top and a boulder balanced over the door, dart
// holes in the inner walls, pressure plates up the aisle, the pedestal with THE STASH (green
// glow), a name plaque, stairs, and Gary's hammock between two posts by his spawner.
//   node npctalk/temple.mjs <map out dir> <live region json (liveedit fetch.mjs)> <out.json>
// out.json = a bridge job: one bricks op, owner "Stash Temple" (clear: br.Bricks.Clear <id> 1).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { makeBuilder, FIXED } from '../mapgen/builder.mjs';
import { worldBox } from '../mapgen/orient.mjs';
import { buildRocks } from '../mapgen/rocks.mjs';
import { plaque, EXTERNAL_ASSETS } from '../mapgen/ruins.mjs';
const [mapDir, liveFile, out] = process.argv.slice(2);
const OWNER = { id: 'ea32a1c0-0000-4b0b-9a11-0000000057a5', name: 'Stash Temple' };
const CX = 2200, CY = 5940;              // temple centre (Green Gary spawns at 2200,6150)
const AREA = [CX - 320, CY - 320, CX + 320, CY + 320];
const T1 = 306, T2 = 318, T3 = 330;      // tier tops
const WALL_TOP = 470;

// ---- obstacles: map terrain (chunks) + whatever is live there now
const B = makeBuilder();
const hit = ([lo, hi]) => lo[0] < AREA[2] && hi[0] > AREA[0] && lo[1] < AREA[3] && hi[1] > AREA[1];
const obstacles = [], DECOR = [];
for (const f of readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(readFileSync(`${mapDir}/${f}`)).ops) for (const b of op.bricks ?? []) {
    const bx = worldBox(b, FIXED);
    if (!hit(bx)) continue;
    // small fixed-asset decor (stumps, mushrooms) inside the footprint: cleared, built over
    if (!b.size?.[0] && b.position && Math.abs(b.position[0] - CX) < 180 && Math.abs(b.position[1] - CY) < 150) { DECOR.push(bx); continue; }
    obstacles.push(bx);
  }
// smashable bushes inside the footprint are cleared by the job first (CLEAR)
const inFoot = ([x, y]) => x > CX - 190 && x < CX + 190 && y > CY - 160 && y < CY + 160;
const CLEAR = [];
for (const b of JSON.parse(readFileSync(liveFile)).bricks) if (b.asset === 'B_Bush' && b.position && inFoot(b.position)) CLEAR.push(b.position);
for (const b of JSON.parse(readFileSync(liveFile)).bricks) {
  if (!b.position || CLEAR.some(c => Math.hypot(c[0] - b.position[0], c[1] - b.position[1]) < 4)) continue;
  const s = b.size?.[0] ? b.size : FIXED[b.asset] ?? [20, 20, 20]; // gates and spawners: generous
  const bx = worldBox({ ...b, size: s }, FIXED);
  if (hit(bx)) obstacles.push(bx);
}
for (const [lo, hi] of obstacles) B.add({ asset: 'PB_DefaultBrick', size: hi.map((v, i) => (v - lo[i]) / 2), position: hi.map((v, i) => (v + lo[i]) / 2), obstacle: true }, 'terrain');
const nObst = B.bricks.length;
const groundTop = (x0, y0, x1, y1, below) => {
  let top = -1e9;
  for (const [lo, hi] of obstacles) if (lo[0] < x1 && hi[0] > x0 && lo[1] < y1 && hi[1] > y0 && lo[2] < below) top = Math.max(top, hi[2]);
  return top;
};

// ---- look
const hash = (x, y, z = 0) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const STONE = [[104, 108, 92], [92, 98, 82], [116, 118, 100], [84, 90, 76]];
const MOSS = [[70, 104, 48], [58, 90, 40], [86, 118, 56]];
const stone = (x, y, z = 0) => ({ color: STONE[Math.floor(hash(x, y, z) * STONE.length)] });
const moss = (x, y) => ({ color: MOSS[Math.floor(hash(x, y, 7) * MOSS.length)] });

// ---- tiers: T1 stands on the terrain (a column per 20x20 cell), T2/T3 are slabs on it
const tier = (hx, hy) => [CX - hx, CY - hy, CX + hx, CY + hy];
const [ax0, ay0, ax1, ay1] = tier(170, 140);
for (let x = ax0; x < ax1; x += 20) for (let y = ay0; y < ay1; y += 20) {
  const g = groundTop(x, y, x + 20, y + 20, T1);
  const z0 = Math.max(g, 200);
  const zb = z0 + (z0 % 2 + 2) % 2; // even
  if (zb < T1 - 1) B.box(x, y, zb, x + 20, y + 20, T1, stone(x, y), 'tier1');
}
for (const [h, top, inset] of [[[150, 120], T2, 0], [[130, 100], T3, 0]]) {
  const [x0, y0, x1, y1] = tier(...h);
  for (let x = x0; x < x1; x += 20) for (let y = y0; y < y1; y += 20) B.box(x, y, top - 12, x + 20, y + 20, top, stone(x, y, top), 'tier');
}
// moss creeping over the tier edges
for (const [[hx, hy], top, [ix, iy]] of [[[170, 140], T1, [150, 120]], [[150, 120], T2, [130, 100]]]) {
  const [x0, y0, x1, y1] = tier(hx, hy);
  for (let x = x0; x < x1; x += 10) for (let y = y0; y < y1; y += 10) {
    const inner = x >= CX - ix && x < CX + ix && y >= CY - iy && y < CY + iy;
    if (!inner && hash(x, y, top) < 0.3) B.box(x, y, top, x + 10, y + 10, top + 2, moss(x, y), 'moss');
  }
}

// ---- sanctum walls on T3, door gap in the north wall (y max), dart holes inside
const W = { x0: CX - 110, x1: CX + 110, y0: CY - 90, y1: CY + 70 }, DOOR = [CX - 30, CX + 30], LINTEL = 430;
const wall = (x0, y0, x1, y1) => { for (let z = T3; z < WALL_TOP; z += 20) for (let x = x0; x < x1; x += 40) for (let y = y0; y < y1; y += 40)
  B.box(x, y, z, Math.min(x1, x + 40), Math.min(y1, y + 40), Math.min(WALL_TOP, z + 20), stone(x, y, z), 'wall'); };
wall(W.x0, W.y0, W.x0 + 10, W.y1); wall(W.x1 - 10, W.y0, W.x1, W.y1); wall(W.x0 + 10, W.y0, W.x1 - 10, W.y0 + 10);
wall(W.x0 + 10, W.y1 - 10, DOOR[0], W.y1); wall(DOOR[1], W.y1 - 10, W.x1 - 10, W.y1);
B.box(DOOR[0], W.y1 - 10, LINTEL, DOOR[1], W.y1, WALL_TOP, { color: [74, 80, 66], asset: 'PB_DefaultMicroBrick' }, 'lintel');
for (let z = 380; z <= 420; z += 20) for (let y = W.y0 + 30; y < W.y1 - 30; y += 30) {
  B.box(W.x0 + 10, y, z, W.x0 + 12, y + 4, z + 4, { color: [20, 18, 16], asset: 'PB_DefaultMicroBrick' }, 'dart');
  B.box(W.x1 - 12, y, z, W.x1 - 10, y + 4, z + 4, { color: [20, 18, 16], asset: 'PB_DefaultMicroBrick' }, 'dart');
}
// ---- roof: tile ceiling (no visible undersides), stepped top, a boulder over the door
B.box(W.x0, W.y0, WALL_TOP, W.x1, W.y1, WALL_TOP + 4, { color: [80, 86, 72], asset: 'PB_DefaultTile' }, 'roof');
[[100, 80, 12], [80, 60, 12], [60, 40, 12]].forEach(([hx, hy], i) => {
  const z = WALL_TOP + 4 + i * 12;
  for (let x = CX - hx; x < CX + hx; x += 20) for (let y = CY - 10 - hy; y < CY - 10 + hy; y += 20) if (x >= W.x0 && y >= W.y0) B.box(x, y, z, Math.min(x + 20, W.x1), Math.min(y + 20, W.y1), z + 12, stone(x, y, z), 'roofstep');
});
for (let x = W.x0; x < W.x1; x += 10) for (let y = W.y0; y < W.y1; y += 10) if (hash(x, y, 99) < 0.12 && B.free([x, y, WALL_TOP + 4], [x + 10, y + 10, WALL_TOP + 6])) B.box(x, y, WALL_TOP + 4, x + 10, y + 10, WALL_TOP + 6, moss(x, y), 'roofmoss');
const boulder = buildRocks([{ c: [CX, W.y1 - 20, WALL_TOP + 44], r: [42, 40, 40], seed: 57 }], { seed: 57, moss: 0.25, allow: (x, y, z) => B.free([x, y, z], [x + 10, y + 10, z + 10]) });
for (const b of boulder) B.add(b, 'boulder');
// ---- entrance pillars, stairs down to the swamp
for (const px of [CX - 50, CX + 50]) {
  B.box(px - 10, W.y1, T3, px + 10, W.y1 + 20, 450, stone(px, 1), 'pillar');
  B.box(px - 12, W.y1, 450, px + 12, W.y1 + 22, 458, { color: [74, 80, 66], asset: 'PB_DefaultMicroBrick' }, 'capital');
}
const SY = CY + 140; // T1 north edge
for (const [y0, top] of [[SY, T1 - 12], [SY + 20, T1 - 24], [SY + 40, T1 - 36]])
  for (let x = CX - 30; x < CX + 30; x += 20) {
    const g = groundTop(x, y0, x + 20, y0 + 20, top);
    const zb = g + (g % 2 + 2) % 2;
    if (zb < top - 1) B.box(x, y0, zb, x + 20, y0 + 20, top, stone(x, y0, top), 'stair');
  }
// ---- inside: pressure plates up the aisle, the pedestal and THE STASH
for (let y = CY - 40; y < W.y1 - 20; y += 20) for (const x of [CX - 20, CX]) if (hash(x, y, 5) < 0.6)
  B.box(x + 2, y + 2, T3, x + 18, y + 18, T3 + 2, { color: [146, 136, 104], asset: 'PB_DefaultMicroBrick' }, 'plate');
const PY = CY - 60;
B.box(CX - 16, PY - 16, T3, CX + 16, PY + 16, T3 + 8, { color: [74, 80, 66] }, 'pedestal');
B.box(CX - 12, PY - 12, T3 + 8, CX + 12, PY + 12, T3 + 36, stone(CX, PY, 2), 'pedestal');
B.box(CX - 16, PY - 16, T3 + 36, CX + 16, PY + 16, T3 + 40, { color: [70, 104, 48], asset: 'PB_DefaultMicroBrick' }, 'pedestal');
B.box(CX - 8, PY - 6, T3 + 40, CX + 8, PY + 6, T3 + 52, { color: [90, 220, 60], material: 'BMC_Glow', asset: 'PB_DefaultMicroBrick' }, 'stash');
B.box(CX - 4, PY - 2, T3 + 52, CX + 4, PY + 2, T3 + 58, { color: [140, 110, 70], asset: 'PB_DefaultMicroBrick' }, 'stash knot');
// ---- the plaque on the front wall, east of the door
plaque({ put: (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'plaque'), text: 'TEMPLE OF THE STASH\nNO STEALING. SIGNED, GARY\nP.S. THE BOULDER IS DECORATIVE',
  facing: [0, 1], x: CX + 88, y: W.y1 + 1, z: 405, w: 20, h: 14, color: [96, 76, 52], style: { LineHeight: 1.6 } });
// ---- Gary's hammock between two posts by his spawner
const HY = 6190;
for (const hx of [CX - 70, CX + 70]) {
  const g = groundTop(hx - 5, HY - 5, hx + 5, HY + 5, 360), zb = g + (g % 2 + 2) % 2;
  B.box(hx - 5, HY - 5, zb, hx + 5, HY + 5, 352, { color: [96, 70, 44] }, 'post');
}
for (const [x0, x1, z] of [[CX - 64, CX - 30, 330], [CX - 30, CX + 30, 322], [CX + 30, CX + 64, 330]])
  B.box(x0, HY - 10, z, x1, HY + 10, z + 2, { color: [150, 120, 70], asset: 'PB_DefaultMicroBrick' }, 'hammock');

const bricks = B.bricks.slice(nObst).map(({ label, obstacle, ...b }) => ({ ...b, collision: label === 'plate' || label === 'dart' ? { player: false, weapon: false, interaction: false, tool: true, physics: false } : undefined }))
  .map(b => (b.collision === undefined ? (delete b.collision, b) : b));
const dropped = B.dropped.filter(d => !/ terrain /.test(d.split(' hits ')[0]));
console.error(`${bricks.length} temple bricks, ${dropped.length} dropped (overlaps)`, [...new Set(dropped.map(d => d.split(' ')[0]))].join(' '));
writeFileSync(out, JSON.stringify({ ops: [...DECOR.map(([lo, hi]) => ({ op: 'cmd', line: `br.World.ClearRegion ${(lo[0] + hi[0]) / 2} ${(lo[1] + hi[1]) / 2} ${(lo[2] + hi[2]) / 2} ${(hi[0] - lo[0]) / 2 + 1} ${(hi[1] - lo[1]) / 2 + 1} ${(hi[2] - lo[2]) / 2 + 1}`, captureMs: 300 })), ...CLEAR.map(([x, y, z]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z + 10} 16 16 34`, captureMs: 400 })), { op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 2000, externalAssets: EXTERNAL_ASSETS, bricks }] }));
if (process.env.TEMPLE_DEBUG) for (const d of dropped) if (!d.startsWith('terrain')) console.error(d.slice(0, 220));
