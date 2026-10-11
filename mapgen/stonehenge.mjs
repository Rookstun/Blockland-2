// The Evil Wizard's stonehenge: a levelled grass circle with trilithons on the
// axes, single stones on the diagonals, an inner ring of smaller stones and a
// rune altar, plus bot spawners (prefabs enemy_wizard / enemy_goblin /
// enemy_wood_goblin, saved from the owner's three spawn bricks) loaded on it.
//
//   node stonehenge.mjs --near x,y [--search 2500] [--map out] [--job henge_job.json] [--clear henge_clear.json]
//
// Site: the flattest 17 x 17 cell patch near --near (no structures above
// ground, outside the town, dry). Filled up to its highest column, grass on
// top. Run --clear, wait for the clears, then --job (bricks + spawner loads).
// All stones are micro bricks (regular bricks have an ugly underside).

import fs from 'fs';
import path from 'path';
import { worldBox } from './orient.mjs';
import { makeBuilder, FIXED } from './builder.mjs';

const CELL = 40, N = 17, WATER_Z = 270;
// keep out: the town, and builds that are not in the map files (the street west of town)
const KEEP = [[-13260, -10300, -8060, -5100], [-15580, -8420, -14380, -7100]];
const MB = 'PB_DefaultMicroBrick';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const [NX, NY] = opt('near', '').split(',').map(Number);
const SEARCH = +opt('search', 2500), MAP = opt('map', 'out');

// terrain tops and structures (same rules as roadtool.mjs)
const lo = [NX - SEARCH - 800, NY - SEARCH - 800], hi = [NX + SEARCH + 800, NY + SEARCH + 800];
const onCells = v => ((v % CELL) + CELL) % CELL === 20, ck = (x, y) => x + ',' + y;
const top = new Map(), solidTop = new Map(), decor = [];
for (const f of fs.readdirSync(MAP).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(fs.readFileSync(path.join(MAP, f))).ops) if (op.op === 'bricks') for (const b of op.bricks) {
    const box = worldBox(b, FIXED), [a, c] = box;
    if (c[0] < lo[0] || a[0] > hi[0] || c[1] < lo[1] || a[1] > hi[1]) continue;
    const terrain = (!b.asset || b.asset === 'PB_DefaultTile') && onCells(a[0]) && onCells(a[1]) && onCells(c[0]) && onCells(c[1]) && a[2] % 12 === 0 && c[2] % 12 === 0;
    if (terrain) {
      for (let gx = Math.round((a[0] + 20) / CELL); gx * CELL < c[0]; gx++) for (let gy = Math.round((a[1] + 20) / CELL); gy * CELL < c[1]; gy++) top.set(ck(gx, gy), Math.max(top.get(ck(gx, gy)) ?? -Infinity, c[2]));
      continue;
    }
    decor.push(box);
    const natural = (b.asset?.startsWith('B_') && !/CheckPoint|SpawnPoint/.test(b.asset)) || /Wedge|Ramp/.test(b.asset ?? '');
    if (!natural) for (let gx = Math.round((a[0] + 20) / CELL) - 1; gx * CELL < c[0] + 40; gx++) for (let gy = Math.round((a[1] + 20) / CELL) - 1; gy * CELL < c[1] + 40; gy++) solidTop.set(ck(gx, gy), Math.max(solidTop.get(ck(gx, gy)) ?? -Infinity, c[2]));
  }
let best = null;
for (let gx0 = Math.round((NX - SEARCH) / CELL); gx0 <= Math.round((NX + SEARCH) / CELL) - N; gx0++)
  for (let gy0 = Math.round((NY - SEARCH) / CELL); gy0 <= Math.round((NY + SEARCH) / CELL) - N; gy0++) {
    const x0 = gx0 * CELL - 20, y0 = gy0 * CELL - 20;
    if (KEEP.some(K => x0 < K[2] + 300 && K[0] - 300 < x0 + N * CELL && y0 < K[3] + 300 && K[1] - 300 < y0 + N * CELL)) continue;
    let mx = -Infinity, mn = Infinity, sum = 0, sTop = -Infinity, ok = true;
    for (let i = 0; i < N && ok; i++) for (let j = 0; j < N; j++) {
      const t = top.get(ck(gx0 + i, gy0 + j));
      if (t === undefined || t < WATER_Z + 24) { ok = false; break; }
      mx = Math.max(mx, t); mn = Math.min(mn, t); sum += t; sTop = Math.max(sTop, solidTop.get(ck(gx0 + i, gy0 + j)) ?? -Infinity);
    }
    if (!ok || sTop > mn - 12) continue;
    const fill = mx * N * N - sum;
    if (!best || fill < best.fill) best = { gx0, gy0, Z: mx, fill, spread: mx - mn };
  }
if (!best) throw new Error('no site');
const { gx0, gy0, Z } = best;
const S = [gx0 * CELL - 20, gy0 * CELL - 20, (gx0 + N) * CELL - 20, (gy0 + N) * CELL - 20];
const cx = (S[0] + S[2]) / 2, cy = (S[1] + S[3]) / 2; // the centre cell's centre

const B = makeBuilder();
// fill to Z, then grass (1 plate) over the square, a trampled earth disc inside the ring
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const t = top.get(ck(gx0 + i, gy0 + j)), x0 = S[0] + i * CELL, y0 = S[1] + j * CELL;
  for (let z = t; z < Z; z += 480) B.box(x0, y0, z, x0 + CELL, y0 + CELL, Math.min(Z, z + 480), { color: [110, 96, 80] }, 'fill');
  const d = Math.hypot(x0 + 20 - cx, y0 + 20 - cy);
  B.box(x0, y0, Z, x0 + CELL, y0 + CELL, Z + 4, { asset: 'PB_DefaultTile', color: d < 260 ? [120, 104, 78] : [92, 150, 62] }, 'ground');
}
const G = Z + 4;
const GREY = [[138, 136, 128], [124, 122, 116], [150, 146, 136], [116, 114, 110]];
let k = 0;
const stone = (x0, y0, z0, x1, y1, z1, label) => B.box(cx + x0, cy + y0, z0, cx + x1, cy + y1, z1, { asset: MB, color: GREY[k++ % GREY.length] }, label);
// trilithons on the axes, radius 220: two 30 x 20 uprights 132 tall, a lintel 24 thick across them
for (const [ax, ay] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
  const r = 220, ux = ax ? 0 : 1, uy = ax ? 1 : 0; // tangent
  for (const s of [-1, 1]) {
    const px = ax * r + ux * s * 35, py = ay * r + uy * s * 35;
    const hx = ux ? 15 : 10, hy = ux ? 10 : 15;
    stone(px - hx, py - hy, G, px + hx, py + hy, G + 132, 'upright');
  }
  const hx = ux ? 60 : 12, hy = ux ? 12 : 60;
  stone(ax * r - hx, ay * r - hy, G + 132, ax * r + hx, ay * r + hy, G + 156, 'lintel');
}
// single stones on the diagonals, one leaning short
for (const [dx, dy, h] of [[1, 1, 108], [-1, 1, 96], [-1, -1, 108], [1, -1, 72]]) {
  const px = Math.round((dx * 220) / Math.SQRT2 / 10) * 10, py = Math.round((dy * 220) / Math.SQRT2 / 10) * 10;
  stone(px - 15, py - 15, G, px + 15, py + 15, G + h, 'stone');
}
// inner ring: 6 small stones at radius 130
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  const px = Math.round((130 * Math.cos(a)) / 10) * 10, py = Math.round((130 * Math.sin(a)) / 10) * 10;
  stone(px - 10, py - 10, G, px + 10, py + 10, G + 48 + (i % 3) * 12, 'inner');
}
// a fallen stone in the grass
stone(250, -330, G, 380, -300, G + 20, 'fallen');
// altar: base, slab, glowing purple rune
stone(-20, -10, G, 20, 10, G + 24, 'altar base');
stone(-40, -20, G + 24, 40, 20, G + 36, 'altar');
B.box(cx - 10, cy - 10, G + 36, cx + 10, cy + 10, G + 38, { asset: MB, color: [170, 60, 255], material: 'BMC_Glow', material_intensity: 8 }, 'rune');
if (B.dropped.length) throw new Error(`henge: ${B.dropped.length} overlaps, e.g. ${B.dropped[0]}`);

// spawners: the wizard in front of the altar, goblins and wood goblins round the inner ring
const spawns = [['enemy_wizard', 0, -70]];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  spawns.push([i % 2 ? 'enemy_wood_goblin' : 'enemy_goblin', Math.round(170 * Math.cos(a)), Math.round(170 * Math.sin(a))]);
}
const loads = spawns.map(([p, x, y]) => ({ op: 'cmd', line: `br.Prefab.Load "${p}" ${cx + x} ${cy + y} ${G + 2} 0 16` }));

const clears = decor.filter(([a, c]) => a[0] < S[2] && S[0] < c[0] && a[1] < S[3] && S[1] < c[1] && c[2] > Z - 200)
  .map(([a, c]) => ({ op: 'cmd', line: `br.World.ClearRegion ${a.map((v, i) => (v + c[i]) / 2).join(' ')} ${a.map((v, i) => (c[i] - v) / 2 + 1).join(' ')}` }));
if (clears.length) clears[clears.length - 1].captureMs = 4000;
const QUOTE = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';
fs.writeFileSync(opt('clear', 'henge_clear.json'), JSON.stringify({ ops: clears }));
fs.writeFileSync(opt('job', 'henge_job.json'), JSON.stringify({ ops: [
  { op: 'say', msg: `<size="40"><color="ff4040"><b>${QUOTE}</></></>` },
  { op: 'bricks', at: [0, 0, 0], owner: 'wizard henge', captureMs: 8000, bricks: B.bricks.map(({ label, ...b }) => b) },
  ...loads, { op: 'sleep', ms: 2000 },
] }));
console.log(JSON.stringify({ centre: [cx, cy, G], spread: best.spread, fill: best.fill, bricks: B.bricks.length, spawners: spawns.length, decorCleared: clears.length }));
