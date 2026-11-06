// "Something indescribable" (dirt, 2026-11-06): three random walks of mismatched cubes knotted around each other
// over a thin stem, some glowing, some glass. node mapgen/indescribable.mjs X Y Z [SEED] > job.json
import { makeBuilder, rng } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, SEED = 13] = process.argv.slice(2).map(Number);
// seed 13 = dirt's original; any other seed is its own build with its own owner (comfycookie's ugly abstract = 99)
const OWNER = SEED === 13
  ? { id: 'c1a0de00-0000-4b0b-9a11-0000000001de', name: 'Claude Indescribable', display_name: 'Claude Indescribable' }
  : { id: `c1a0de00-0000-4b0b-9a11-${String(SEED).padStart(12, '0')}`, name: `Claude Abstract ${SEED}`, display_name: `Claude Abstract ${SEED}` };
const B = makeBuilder();
const rand = rng(SEED);
const MB = 'PB_DefaultMicroBrick';
B.box(-16, -16, 0, 16, 16, 4, { asset: MB, color: [40, 40, 45] }, 'base');
B.box(-2, -2, 4, 2, 2, 80, { asset: MB, color: [40, 40, 45] }, 'stem');
const pick = () => {
  const hue = rand() * 6, f = hue % 1, k = Math.floor(hue);
  const c = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][k].map(v => Math.round(60 + 195 * v));
  const r = rand();
  return { asset: MB, color: c, ...(r < 0.25 ? { material: 'BMC_Glow', material_intensity: 3 } : r < 0.45 ? { material: 'BMC_Glass' } : r < 0.6 ? { material: 'BMC_Metallic' } : {}) };
};
const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
for (let w = 0; w < 3; w++) {
  let p = [0, 0, 120];
  for (let s = 0; s < 70; s++) {
    const size = [4, 6, 8, 10][Math.floor(rand() * 4)];
    const [lo, hi] = [p.map(v => v - size), p.map(v => v + size)];
    if (lo[2] > 80) B.box(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], pick(), 'chunk'); // overlaps just get skipped
    const d = dirs[Math.floor(rand() * 6)];
    p = p.map((v, i) => Math.max(i === 2 ? 90 : -70, Math.min(i === 2 ? 210 : 70, v + d[i] * 2 * size)));
  }
}
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`indescribable: ${bricks.length} bricks (${B.dropped.length} overlaps skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
