// vix's cube (2026-11-06): asked for 1,000,000 to 1000 per side; the offer was 10 x 10 x 10 of single 1x1 microbricks.
// node mapgen/microcube.mjs X Y Z [N] > job.json
const [X = 0, Y = 0, Z = 0, N = 10] = process.argv.slice(2).map(Number);
const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000c0be', name: 'Claude Microcube', display_name: 'Claude Microcube' };
const bricks = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++)
  bricks.push({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [i * 2 + 1, j * 2 + 1, k * 2 + 1], color: [40 + 20 * i, 40 + 20 * j, 40 + 20 * k] });
process.stderr.write(`microcube: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
