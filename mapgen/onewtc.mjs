// One World Trade Center, scale model beside mapgen/twintowers.mjs (VAUX, 2026-11-06), same ~1:20: a square base
// whose corners are cut away more and more on the way up (cross-section = base square cut by a shrinking diamond),
// ending in a square turned 45 degrees at the roof; podium, parapet, thin spire. node mapgen/onewtc.mjs X Y Z
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-000000001776', name: 'Claude One WTC', display_name: 'Claude One WTC' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const MB = 'PB_DefaultMicroBrick';
const GLASS = { asset: MB, color: [120, 150, 175], material: 'BMC_Metallic' }, GLASS2 = { asset: MB, color: [100, 130, 158], material: 'BMC_Metallic' };
const PODIUM = { asset: MB, color: [170, 170, 172], material: 'BMC_Metallic' }, SPIRE = { asset: MB, color: [225, 225, 230], material: 'BMC_Metallic' };
const A = 52, H = 700, LH = 20, P = 34; // half side, roof height, layer, podium height
B.box(-60, -60, 0, 60, 60, P, PODIUM, 'podium');
for (let z = P, n = 0; z < H; z += LH, n++) {
  const t = (z + LH / 2 - P) / (H - P), d = 2 * A - A * t; // diamond half-diagonal: 2A (no cut) -> A (turned square)
  for (let y = -A; y < A; y += 4) {
    const w = Math.floor(Math.min(A, d - Math.abs(y + 2)) / 2) * 2;
    if (w >= 2) B.box(-w, y, z, w, y + 4, Math.min(z + LH, H), n % 2 ? GLASS : GLASS2, 'tower');
  }
}
B.box(-26, -26, H, 26, 26, H + 8, PODIUM, 'parapet'); // roof ring/crown
B.box(-4, -4, H + 8, 4, 4, H + 40, SPIRE, 'spire base');
B.box(-1, -1, H + 40, 1, 1, H + 210, SPIRE, 'spire');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`onewtc: ${bricks.length} bricks (${B.dropped.length} skipped), ${H + 210} tall at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
