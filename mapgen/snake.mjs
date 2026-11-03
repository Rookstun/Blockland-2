// crazyjaydon's wish (2026-11-02, owner-granted free wish): "liquid snake from metal gear", built as an ORIGINAL blond
// sneaking-suit soldier (no named character: own livery, no logos). 160 tall, front faces -y.
//   node mapgen/snake.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000004', name: 'soldier', display_name: 'soldier' };

export function soldier() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`soldier: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const SUIT = [44, 48, 58], SUIT2 = [64, 70, 84], BLACK = [22, 22, 26], SKIN = [226, 184, 150], BLOND = [232, 200, 96], RED = [180, 36, 36], GREY = [120, 124, 130];
  // boots, legs
  for (const s of [-1, 1]) {
    const a = s < 0 ? -18 : 4, b = s < 0 ? -4 : 18;
    box(a, -14, 0, b, 10, 10, BLACK, 'boot'); box(a + 2, -6, 10, b - 2, 6, 64, SUIT, 'leg');
    box(a + 2, -10, 34, b - 2, -6, 40, GREY, 'knee pad');
  }
  box(-20, -10, 64, 20, 10, 74, SUIT2, 'hips'); box(-22, -12, 74, 22, 12, 80, BLACK, 'belt'); box(-4, -14, 74, 4, -12, 80, GREY, 'buckle');
  // torso with harness, shoulders
  box(-24, -10, 80, 24, 10, 124, SUIT, 'torso'); box(-12, -12, 84, -6, -10, 122, BLACK, 'strap'); box(6, -12, 84, 12, -10, 122, BLACK, 'strap');
  box(-6, -12, 104, 6, -10, 108, GREY, 'chest clip');
  box(-32, -10, 116, -24, 10, 128, SUIT2, 'shoulder'); box(24, -10, 116, 32, 10, 128, SUIT2, 'shoulder');
  // arms and gloves
  for (const s of [-1, 1]) {
    const a = s < 0 ? -40 : 28, b = s < 0 ? -28 : 40;
    box(a, -8, 74, b, 8, 116, SUIT, 'arm'); box(a - 2, -9, 62, b + 2, 9, 74, BLACK, 'glove');
  }
  // neck, head, shades, headband, swept hair
  box(-6, -6, 124, 6, 6, 130, SKIN, 'neck');
  box(-14, -10, 130, 14, 10, 148, SKIN, 'head');
  box(-12, -12, 138, 12, -10, 144, BLACK, 'sunglasses', { material: 'BMC_Glass' });
  box(-4, -12, 134, 4, -10, 138, [190, 130, 110], 'nose'); box(-6, -12, 131, 6, -10, 133, [150, 70, 70], 'mouth');
  box(-16, -12, 148, 16, 12, 152, RED, 'headband'); box(-3, 12, 148, 3, 14, 152, RED, 'knot'); box(-8, 14, 140, -2, 16, 152, RED, 'tail'); box(2, 14, 138, 8, 16, 150, RED, 'tail');
  box(-14, -10, 152, 14, 10, 160, BLOND, 'hair'); box(-16, -6, 152, -14, 8, 158, BLOND, 'hair side'); box(14, -6, 152, 16, 8, 158, BLOND, 'hair side');
  box(-10, -12, 152, 10, -10, 158, BLOND, 'fringe');
  return B.bricks;
}

if (process.argv[1]?.endsWith('snake.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'snake.json';
  const bricks = soldier().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`soldier: ${bricks.length} bricks`);
}
