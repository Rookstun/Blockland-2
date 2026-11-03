// SeventhSandwich's wish (2026-11-02, free wish): "an acacia tree roughly 100 units tall at X=7100, Y=-21000".
// Savanna acacia: a leaning forked trunk and a wide flat layered canopy. 100 tall, canopy ~140 across, ground point = (X, Y, Z).
//   node mapgen/acacia.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000b', name: 'acacia', display_name: 'acacia' };

export function acacia(S = 1) {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0 * S, y0 * S, z0 * S, x1 * S, y1 * S, z1 * S, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`acacia: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const BARK = [96, 70, 48], BARK2 = [78, 56, 38], LEAF = [86, 138, 50], LEAF2 = [104, 156, 58], LEAF3 = [70, 120, 44];
  // trunk: flared base, a short stem leaning +x, then it forks into two limbs going out and up
  box(-12, -12, 0, 12, 12, 8, BARK2, 'root flare');
  box(-8, -8, 8, 8, 8, 36, BARK, 'trunk');
  box(-4, -8, 36, 12, 8, 56, BARK, 'trunk lean');
  box(8, -6, 56, 24, 6, 72, BARK, 'limb right'); box(-14, -6, 56, -2, 6, 70, BARK, 'limb left'); box(-2, -6, 56, 8, 6, 62, BARK, 'fork');
  box(18, -4, 72, 30, 4, 82, BARK, 'limb right up'); box(-20, -4, 70, -10, 4, 82, BARK, 'limb left up');
  // canopy: three flat layers, widest in the middle, a lighter top; slightly off-centre like a real one
  box(-60, -50, 82, 70, 50, 90, LEAF3, 'canopy low'); box(-70, -44, 90, 76, 48, 98, LEAF, 'canopy mid'); box(-44, -36, 98, 56, 36, 104, LEAF2, 'canopy top');
  box(-76, -20, 82, -60, 24, 90, LEAF3, 'canopy fringe'); box(70, -20, 82, 82, 24, 90, LEAF3, 'canopy fringe'); box(-20, -56, 82, 30, -50, 88, LEAF3, 'canopy fringe');
  return B.bricks;
}

if (process.argv[1]?.endsWith('acacia.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'acacia.json', S = Number(process.argv[6] ?? 1);
  const bricks = acacia(S).map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: S > 1 ? { ...OWNER, id: 'c1a5de00-0000-4000-8000-00000000000c' } : OWNER, captureMs: 4000, bricks }] }));
  console.error(`acacia: ${bricks.length} bricks`);
}
