// Procgen system test (2026-10-22): a grid of generated houses set down away from the world, so the
// house generators can be checked together in one place without touching the live map.
//   node mapgen/housegrid.mjs [--cols 4] [--rows 3] [--ox -60000] [--oy -60000] [--cell 800] [--out DIR]
// Each cell gets one generator in turn (dutch colonial, split-level, ren faire house / cottage), a new seed
// and alternating mirror. Output: DIR/bricks.json (world units, every house offset to its cell) and
// DIR/grid.json (per-house summary). isoview.mjs can render bricks.json directly.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dutchColonial } from './dutchcolonial.mjs';
import { splitLevel } from './splitlevel.mjs';
import { faire } from './faire.mjs';
import { EXTERNAL_ASSETS } from './ruins.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 4), ROWS = +arg('rows', 3);
const OX = +arg('ox', -60000), OY = +arg('oy', -60000), CELL = +arg('cell', 800);
const OUT = arg('out', path.join(path.dirname(fileURLToPath(import.meta.url)), 'out_housegrid'));
const SEED0 = +arg('seed', 500);

// one build per cell, in order; the kinds rotate so every generator shows up in the grid
const KINDS = [
  { name: 'dutchcolonial', make: (seed, mirror) => dutchColonial({ seed, mirror }) },
  { name: 'splitlevel', make: (seed, mirror) => splitLevel({ seed, mirror }) },
  { name: 'faire-house', make: seed => faire({ seed, kind: 'house' }) },
  { name: 'faire-cottage', make: seed => faire({ seed, kind: 'cottage', small: true }) },
];

const bricks = [], grid = [];
let i = 0;
for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++, i++) {
  const kind = KINDS[i % KINDS.length];
  const seed = SEED0 + i, mirror = i % 2 === 1;
  const h = kind.make(seed, mirror);
  // the cell is CELL units square; a house must fit inside it, or it would overlap its neighbour
  const w = h.W * 10, d = h.D * 10;
  if (w > CELL || d > CELL) throw new Error(`${kind.name} seed ${seed} is ${w} x ${d} units, bigger than the cell ${CELL}`);
  const ox = OX + col * CELL, oy = OY + row * CELL;
  for (const b of h.bricks) bricks.push({ ...b, position: [b.position[0] + ox, b.position[1] + oy, b.position[2]] });
  grid.push({ col, row, kind: kind.name, seed, mirror, origin: [ox, oy], W: h.W, D: h.D, bricks: h.count });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bricks.json'), JSON.stringify(bricks));
// deploy chunks: add_NNN.json = {bricks, externalAssets} (text components index externalAssets), 4000 bricks each
const CH = 4000;
for (let n = 0; n * CH < bricks.length; n++) fs.writeFileSync(path.join(OUT, `add_${String(n).padStart(3, '0')}.json`), JSON.stringify({ bricks: bricks.slice(n * CH, (n + 1) * CH), externalAssets: EXTERNAL_ASSETS }));
fs.writeFileSync(path.join(OUT, 'grid.json'), JSON.stringify({ cols: COLS, rows: ROWS, cell: CELL, origin: [OX, OY], houses: grid }, null, 1));
const total = grid.reduce((a, g) => a + g.bricks, 0);
console.error(`housegrid ${COLS} x ${ROWS} = ${grid.length} houses, ${total} bricks, origin ${OX},${OY} -> ${OUT}`);
