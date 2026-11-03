// faik's wish (2026-11-02, "turn this into 3d builds": a photo of a black-and-white lop-eared rabbit; renderman: go on).
// Original blocky take: white body and haunches, black saddle and haunch spot, long black drooping ears, dark eyes, pink nose.
// Front faces -y, ground point = (X, Y, Z). Drawn at half size, built at 2x.
//   node mapgen/lopbunny.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000010', name: 'lopbunny', display_name: 'lopbunny' };
const S = 2;

export function lopbunny() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0 * S, y0 * S, (z0 - 4) * S, x1 * S, y1 * S, (z1 - 4) * S, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`lopbunny: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const WHITE = [246, 246, 244], BLACK = [28, 28, 32], PINK = [240, 168, 170], EYE = [70, 38, 30], PAW = [236, 232, 226];
  // body, haunches, tail
  box(-16, -8, 4, 16, 20, 32, WHITE, 'body');
  box(-12, 0, 32, 12, 20, 36, BLACK, 'saddle');
  box(-20, 20, 4, 20, 40, 34, WHITE, 'haunch');
  box(-14, 24, 34, -4, 34, 37, BLACK, 'haunch spot');
  box(-4, 40, 8, 4, 46, 16, WHITE, 'tail');
  // front paws
  box(-12, -16, 4, -4, -8, 10, PAW, 'paw'); box(4, -16, 4, 12, -8, 10, PAW, 'paw');
  // head, face, ears
  box(-14, -28, 12, 14, -8, 34, WHITE, 'head');
  box(-14, -30, 14, -8, -28, 22, BLACK, 'cheek patch'); box(8, -30, 14, 14, -28, 22, BLACK, 'cheek patch');
  box(-3, -30, 16, 3, -28, 20, PINK, 'nose');
  box(-8, -30, 24, -4, -28, 28, EYE, 'eye'); box(4, -30, 24, 8, -28, 28, EYE, 'eye');
  box(-20, -22, 10, -14, -12, 34, BLACK, 'lop ear'); box(14, -22, 10, 20, -12, 34, BLACK, 'lop ear');
  return B.bricks;
}

if (process.argv[1]?.endsWith('lopbunny.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'lopbunny.json';
  const bricks = lopbunny().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`lopbunny: ${bricks.length} bricks`);
}
