// A suburb of simhouse streets (owner 2026-10-11: "wipe the map and make a ton of houses
// spawn with simhouse"). Each street = 4 random lots (simhouse SIM_SEED), on its own sand
// pad; the pads tile edge to edge (3340 x 1140) into one piece of land above the sea.
//   node suburb.mjs [--cols 5] [--rows 15] [--seed 1] [--out out_suburb]
// -> OUT/chunk_NNN.json (bridge jobs, world coordinates), loaded by the server's
//    chunk loader (one bricks op, see CLAUDE.md map uploads).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 5), ROWS = +arg('rows', 15), SEED = +arg('seed', 1), OUT = join(here, arg('out', 'out_suburb'));
const STREET_W = 3340, STREET_D = 1140;   // simhouse pad: x -1670..1670, y 40..1180 around the street origin
const BASE = 380, GROUND = 270;           // lot top 110 over the sea plane (mapgen WATER_Z 270): room for the basements

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let total = 0, n = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const x = (c - (COLS - 1) / 2) * STREET_W, y = (r - (ROWS - 1) / 2) * STREET_D - 40;
  const seed = SEED * 1000 + n + 1;
  const job = execFileSync(process.execPath, [join(here, 'simhouse.mjs'), x, y, 90, BASE, GROUND], { env: { ...process.env, SIM_SEED: String(seed) }, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const bricks = JSON.parse(job).ops.find(o => o.op === 'bricks').bricks;
  fs.writeFileSync(join(OUT, `chunk_${String(n).padStart(3, '0')}.json`), JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], bricks }] }));
  total += bricks.length; n++;
  if (n % 10 === 0) console.error(`${n}/${COLS * ROWS} streets, ${total} bricks`);
}
fs.writeFileSync(join(OUT, 'suburb.json'), JSON.stringify({ cols: COLS, rows: ROWS, seed: SEED, streets: n, houses: n * 4, bricks: total, base: BASE }));
console.log(JSON.stringify({ streets: n, houses: n * 4, bricks: total, out: OUT }));
