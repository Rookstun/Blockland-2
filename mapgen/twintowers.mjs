// World Trade Center twin towers, a scale model (VAUX, 2026-11-06): ~1:20 (417 m -> ~700 units), square towers with
// ribbed silver facades (dark window lines between the columns), the north tower's antenna, a stone plaza.
// node mapgen/twintowers.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-000000007770', name: 'Claude Twin Towers', display_name: 'Claude Twin Towers' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const MB = 'PB_DefaultMicroBrick';
const SILVER = { asset: MB, color: [190, 192, 196], material: 'BMC_Metallic' }, GAP = { asset: MB, color: [50, 56, 66] }, STONE = { asset: MB, color: [150, 146, 140] };
const S = 104, H = 700, RIB = 4; // tower side (64 m -> ~104 units), height, column width
B.box(-200, -170, 0, 200, 170, 6, STONE, 'plaza');
for (const [cx, cy, h] of [[-70, 60, H], [70, -60, H - 6]]) {
  const x0 = cx - S / 2, y0 = cy - S / 2;
  B.box(x0 + 2, y0 + 2, 6, x0 + S - 2, y0 + S - 2, 6 + h, GAP, 'core'); // dark glass behind the ribs
  for (let t = 0; t < S; t += RIB * 2) { // columns on all four faces
    B.box(x0 + t, y0, 6, x0 + t + RIB, y0 + 2, 6 + h, SILVER, 'rib'); B.box(x0 + t, y0 + S - 2, 6, x0 + t + RIB, y0 + S, 6 + h, SILVER, 'rib');
    B.box(x0, y0 + t, 6, x0 + 2, y0 + t + RIB, 6 + h, SILVER, 'rib'); B.box(x0 + S - 2, y0 + t, 6, x0 + S, y0 + t + RIB, 6 + h, SILVER, 'rib');
  }
  B.box(x0 + 2, y0 + 2, 6 + h, x0 + S - 2, y0 + S - 2, 10 + h, SILVER, 'roof');
}
B.box(-74, 56, 10 + H, -66, 64, 30 + H, SILVER, 'antenna base');
B.box(-71, 59, 30 + H, -69, 61, 120 + H, { asset: MB, color: [220, 220, 225], material: 'BMC_Metallic' }, 'antenna');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`twintowers: ${bricks.length} bricks (${B.dropped.length} skipped), ${H + 120} tall at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
