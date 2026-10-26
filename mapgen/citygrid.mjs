// City grid (2026-10-26, owner: "make a grid out of [the road prefabs] that's like a city, off the roads the
// houses we made, just split and dutch colonial"): a road lattice of the owner's 32x32-stud road tiles
// (citygrid/prefabs/{straight,turn,t,cross}.brz, bricks copied + turned per junction) with blocks of
// split-level / Dutch colonial lots fronting the east-west streets, back to back. Block widths vary and a
// few interior cross streets are left out (merged blocks, T junctions), so it is not one uniform grid.
//   node mapgen/citygrid.mjs [--cols 4] [--rows 4] [--ox 3000] [--oy -3000] [--seed 1] [--out DIR]
// Output: DIR/bricks.json, DIR/add_NNN.json (8000 each, {bricks, externalAssets}), DIR/city.json.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeBuilder, rng } from './builder.mjs';
import { turnBrick, worldBox } from './orient.mjs';
import { dutchColonial } from './dutchcolonial.mjs';
import { splitLevel } from './splitlevel.mjs';
import { EXTERNAL_ASSETS } from './ruins.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 4), ROWS = +arg('rows', 4), OX = +arg('ox', 3000), OY = +arg('oy', -3000);
const SEED = +arg('seed', 1), OUT = arg('out', path.join(HERE, 'out_citygrid'));
const T = 320, DEPTH = 4; // tile size (units); block depth in tiles = two 640-deep lots back to back

// ---- road tiles: the owner's prefabs, local to the tile centre, with the sides each one opens to
const SIDE = { '1,0': 'E', '-1,0': 'W', '0,1': 'N', '0,-1': 'S' };
async function loadTiles() {
  const brs = await import('../tools/brs4/dist.mjs');
  const tiles = {};
  for (const [name, open] of [['straight', ['N', 'S']], ['turn', ['E', 'S']], ['t', ['S', 'E', 'W']], ['cross', ['N', 'S', 'E', 'W']]]) {
    const r = brs.WorldReader.from(fs.readFileSync(path.join(HERE, '../citygrid/prefabs', name + '.brz')));
    const g = r.globalData(), names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
    const raw = [...r.bricks()];
    const lo = [1e9, 1e9], hi = [-1e9, -1e9];
    for (const b of raw) { const [l, h] = worldBox(b); for (const i of [0, 1]) { lo[i] = Math.min(lo[i], l[i]); hi[i] = Math.max(hi[i], h[i]); } }
    const c = [Math.round((lo[0] + hi[0]) / 2), Math.round((lo[1] + hi[1]) / 2)];
    if (hi[0] - lo[0] !== T || hi[1] - lo[1] !== T) throw new Error(`${name} is not a ${T} tile`);
    tiles[name] = {
      open, bricks: raw.map(b => ({
        asset: names[b.asset_name_index], size: [...b.size], position: [b.position[0] - c[0], b.position[1] - c[1], b.position[2]],
        direction: b.direction, rotation: b.rotation, color: [...b.color], material: g.MaterialAssetNames[b.material_index], material_intensity: b.material_intensity,
      })),
    };
  }
  return tiles;
}
const turnSide = (s, r) => { const v = { E: [1, 0], N: [0, 1], W: [-1, 0], S: [0, -1] }[s]; let [x, y] = v; for (let i = 0; i < r; i++) [x, y] = [-y, x]; return SIDE[x + ',' + y]; };
function tileFor(tiles, open) {
  const want = [...open].sort().join();
  for (const name of ['cross', 't', 'straight', 'turn']) for (let r = 0; r < 4; r++)
    if (tiles[name].open.map(s => turnSide(s, r)).sort().join() === want) return { name, r };
  throw new Error('no road tile opens to ' + want);
}

// ---- lattice: block column widths (tiles) vary, rows are DEPTH deep; road lines between them
const rnd = rng(SEED);
const pick = a => a[Math.floor(rnd() * a.length)];
const colW = Array.from({ length: COLS }, () => pick([7, 8, 9, 10]));
const xLines = [0]; for (const w of colW) xLines.push(xLines.at(-1) + w + 1); // tile index of each N-S road
const yLines = [0]; for (let j = 0; j < ROWS; j++) yLines.push(yLines.at(-1) + DEPTH + 1);
const NX = xLines.at(-1) + 1, NY = yLines.at(-1) + 1;
// leave out some interior N-S street segments (between two E-W streets): neighbouring blocks merge;
// never two at one junction, never on the outer ring
const dropped = new Set(); // 'i,j' = N-S line i between E-W lines j and j+1
const nodeUsed = new Set();
for (let i = 1; i < xLines.length - 1; i++) for (let j = 0; j < ROWS; j++) {
  if (rnd() > 0.3 || nodeUsed.has(i + ',' + j) || nodeUsed.has(i + ',' + (j + 1))) continue;
  dropped.add(i + ',' + j); nodeUsed.add(i + ',' + j); nodeUsed.add(i + ',' + (j + 1));
}
const road = new Set();
for (const ty of yLines) for (let tx = 0; tx < NX; tx++) road.add(tx + ',' + ty);
xLines.forEach((tx, i) => { for (let j = 0; j < ROWS; j++) if (!dropped.has(i + ',' + j)) for (let ty = yLines[j] + 1; ty < yLines[j + 1]; ty++) road.add(tx + ',' + ty); });

const tiles = await loadTiles();
const B = makeBuilder();
const tally = {};
for (const k of road) {
  const [tx, ty] = k.split(',').map(Number);
  const open = Object.entries({ E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] }).filter(([, [dx, dy]]) => road.has(tx + dx + ',' + (ty + dy))).map(([s]) => s);
  if (open.length < 2) throw new Error(`dead end at ${k}`);
  const { name, r } = tileFor(tiles, open);
  tally[name] = (tally[name] ?? 0) + 1;
  const cx = OX + tx * T + T / 2, cy = OY + ty * T + T / 2;
  for (const b of tiles[name].bricks) {
    const t = turnBrick(b, r);
    if (!B.add({ ...t, position: [cx + t.position[0], cy + t.position[1], t.position[2]] }, 'road ' + name)) throw new Error('road overlap ' + k);
  }
}

// ---- houses: each block (a run of columns merged by dropped streets) is lined with lots on both
// E-W street faces; south lots face -y (r 0), north lots face +y (r 2)
const houses = [];
let hseed = SEED * 1000;
for (let j = 0; j < ROWS; j++) {
  let i = 0;
  while (i < COLS) {
    let i1 = i + 1;
    while (i1 < COLS && dropped.has(i1 + ',' + j)) i1++;
    const tx0 = xLines[i] + 1, tx1 = xLines[i1]; // block x tiles [tx0, tx1)
    const x0 = OX + tx0 * T, x1 = OX + tx1 * T;
    const y0 = OY + (yLines[j] + 1) * T, y1 = OY + yLines[j + 1] * T;
    const k = Math.max(1, Math.floor((x1 - x0) / 700)), lw = (x1 - x0) / k;
    for (const side of ['S', 'N']) for (let n = 0; n < k; n++) {
      const kind = rnd() < 0.5 ? 'splitlevel' : 'dutchcolonial', seed = hseed++, mirror = rnd() < 0.5;
      const h = kind === 'splitlevel' ? splitLevel({ seed, mirror }) : dutchColonial({ seed, mirror });
      const fw = (h.W + 1) * 10, fd = (h.D + 1) * 10;
      if (fw > lw - 20 || fd > (y1 - y0) / 2 - 30) throw new Error(`${kind} ${seed} ${fw}x${fd} does not fit a ${lw} lot`);
      // lot front 30 behind the sidewalk, a little jitter along the street, all on the 10 grid
      const jit = Math.floor((rnd() - 0.5) * Math.max(0, lw - fw - 60) / 10) * 10;
      const cx = Math.round((x0 + lw * (n + 0.5) + jit) / 10) * 10;
      const set = 30 + Math.floor(rnd() * 5) * 10;
      const r = side === 'S' ? 0 : 2;
      const cy = side === 'S' ? y0 + set + fd / 2 : y1 - set - fd / 2;
      const lx = Math.round(fw / 2 / 10) * 10, ly = Math.round(fd / 2 / 10) * 10;
      let bad = 0;
      for (const b of h.bricks) {
        const t = turnBrick({ ...b, position: [b.position[0] - lx, b.position[1] - ly, b.position[2]] }, r);
        if (!B.add({ ...t, position: [cx + t.position[0], cy + t.position[1], t.position[2]] }, kind)) bad++;
      }
      if (bad) throw new Error(`${kind} ${seed}: ${bad} bricks dropped`);
      houses.push({ kind, seed, mirror, side, centre: [cx, cy], bricks: h.count });
    }
    i = i1;
  }
}

const bricks = B.bricks.map(({ label, ...b }) => b);
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT).filter(f => /^add_\d+\.json$/.test(f))) fs.rmSync(path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'bricks.json'), JSON.stringify(bricks));
const CH = 8000;
for (let n = 0; n * CH < bricks.length; n++) fs.writeFileSync(path.join(OUT, `add_${String(n).padStart(3, '0')}.json`), JSON.stringify({ bricks: bricks.slice(n * CH, (n + 1) * CH), externalAssets: EXTERNAL_ASSETS }));
const ext = [OX, OY, OX + NX * T, OY + NY * T];
fs.writeFileSync(path.join(OUT, 'city.json'), JSON.stringify({ seed: SEED, extent: ext, colW, dropped: [...dropped], tiles: tally, houses }, null, 1));
console.error(`city ${COLS}x${ROWS} blocks, extent ${ext.join(',')}, road tiles ${JSON.stringify(tally)}, ${houses.length} houses (${houses.filter(h => h.kind === 'splitlevel').length} split-level), ${bricks.length} bricks -> ${OUT}`);
