// A castle from the castle.mjs kit as one job with its own owner (Kraken: "create a medieval castle in front of me",
// 2026-11-06). Same keep stand-in as castleprev.mjs. node mapgen/castlejob.mjs X Y Z [SEED] > job.json
import { castleStone } from './castle.mjs';
import { makeBuilder } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, SEED = 9100] = process.argv.slice(2).map(Number);
const OWNER = { id: `c1a0de00-0000-4b0b-9a11-${String(SEED).padStart(12, '0')}`, name: `Claude Castle ${SEED}`, display_name: `Claude Castle ${SEED}` };
const keep = { i0: -20, j0: -3, i1: 20, j1: 29, kTop: 72 };
const { bricks } = castleStone(SEED, keep);
const B = makeBuilder();
B.add({ asset: 'PB_DefaultMicroBrick', size: [200, 160, 216], position: [0, 130, 216], color: [154, 150, 142] }, 'keep');
for (const b of bricks) B.add(b, b.asset);
const out = B.bricks.map(({ label, ...b }) => b);
const lo = [0, 1, 2].map(i => Math.min(...out.map(b => b.position[i]))), hi = [0, 1, 2].map(i => Math.max(...out.map(b => b.position[i])));
process.stderr.write(`castle: ${out.length} bricks, ${B.dropped.length} dropped, bounds ${lo} .. ${hi} at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks: out }] }));
