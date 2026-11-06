// "Make monies" (Rookstun, 2026-11-06): decorative only (no real coins: the economy is the owner's): a heap of
// gold coin stacks around a fat money bag. node mapgen/monies.mjs X Y Z > job.json
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000c014', name: 'Claude Monies', display_name: 'Claude Monies' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const rand = rng(77);
const MB = 'PB_DefaultMicroBrick';
const GOLD = { asset: MB, color: [235, 190, 60], material: 'BMC_Metallic' }, EDGE = { asset: MB, color: [200, 150, 40], material: 'BMC_Metallic' };
const SACK = { asset: MB, color: [90, 140, 70] }, TIE = { asset: MB, color: [200, 170, 110] };
// money bag: rounded sack, tied neck, a $ on the front (+x)
for (const [h, z0, z1] of [[12, 0, 4], [16, 4, 12], [18, 12, 24], [16, 24, 32], [12, 32, 36], [6, 36, 40]]) B.box(-h, -h, z0, h, h, z1, SACK, 'sack');
B.box(-8, -8, 40, 8, 8, 44, TIE, 'tie');
B.box(-4, -4, 44, 4, 4, 50, SACK, 'top');
for (const [y0, y1, z0, z1] of [[-6, 6, 26, 28], [-6, -4, 22, 26], [-6, 6, 20, 22], [4, 6, 16, 20], [-6, 6, 14, 16], [-1, 1, 12, 30]]) B.box(18, y0, z0, 20, y1, z1, GOLD, 'dollar');
// coin stacks scattered around: each coin 8x8 gold with a darker rim course every few
for (let s = 0; s < 18; s++) {
  const a = rand() * 2 * Math.PI, r = 26 + rand() * 30;
  const x = Math.round((Math.cos(a) * r) / 2) * 2, y = Math.round((Math.sin(a) * r) / 2) * 2, n = 1 + Math.floor(rand() * 7);
  for (let k = 0; k < n; k++) B.box(x - 4, y - 4, k * 2, x + 4, y + 4, k * 2 + 2, k % 3 === 2 ? EDGE : GOLD, 'coin');
}
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`monies: ${bricks.length} bricks (${B.dropped.length} overlaps skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
