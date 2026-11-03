// faik's second wish (granted by renderman 2026-11-02): a plump, grinning cartoon figure of faik (grey avatar, black fedora with a teal band), their own request. Round belly, tiny hat. Front faces -y, ground point = (X, Y, Z).
//   node mapgen/plumpfaik.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000f', name: 'plumpfaik', display_name: 'plumpfaik' };

export function plumpfaik() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`plumpfaik: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const SKIN = [138, 132, 144], SHIRT = [118, 114, 124], PANTS = [100, 96, 106], SHOE = [60, 58, 64], BLACK = [24, 24, 28], WHITE = [250, 250, 246], HAT = [26, 26, 30], PINK = [220, 120, 120];
  box(-24, -12, 0, -4, 12, 8, SHOE, 'shoe'); box(4, -12, 0, 24, 12, 8, SHOE, 'shoe');
  box(-22, -10, 8, -6, 10, 36, PANTS, 'leg'); box(6, -10, 8, 22, 10, 36, PANTS, 'leg');
  box(-34, -22, 36, 34, 22, 48, PANTS, 'hips');
  box(-44, -30, 48, 44, 30, 64, SHIRT, 'belly low'); box(-50, -34, 64, 50, 34, 90, SHIRT, 'belly wide'); box(-40, -28, 90, 40, 28, 104, SHIRT, 'chest');
  box(-8, -36, 66, 8, -34, 74, WHITE, 'button');
  box(-62, -8, 74, -50, 8, 100, SHIRT, 'sleeve'); box(50, -8, 74, 62, 8, 100, SHIRT, 'sleeve');
  box(-64, -8, 62, -52, 8, 74, SKIN, 'hand'); box(52, -8, 62, 64, 8, 74, SKIN, 'hand');
  box(-26, -24, 104, 26, 24, 148, SKIN, 'head'); box(-30, -20, 112, -26, 20, 140, SKIN, 'cheek'); box(26, -20, 112, 30, 20, 140, SKIN, 'cheek');
  box(-16, -26, 128, -8, -24, 136, WHITE, 'eye'); box(8, -26, 128, 16, -24, 136, WHITE, 'eye');
  box(-14, -28, 130, -10, -26, 134, BLACK, 'pupil'); box(10, -28, 130, 14, -26, 134, BLACK, 'pupil');
  box(-4, -28, 118, 4, -24, 126, PINK, 'nose'); box(-14, -26, 110, 14, -24, 114, BLACK, 'grin');
  box(-18, -26, 118, -12, -24, 122, PINK, 'blush'); box(12, -26, 118, 18, -24, 122, PINK, 'blush');
  box(-32, -32, 148, 32, 28, 152, HAT, 'brim'); box(-20, -18, 152, 20, 18, 158, [40, 200, 210], 'band'); box(-18, -16, 158, 18, 16, 172, HAT, 'crown');
  return B.bricks;
}

if (process.argv[1]?.endsWith('plumpfaik.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'plumpfaik.json';
  const bricks = plumpfaik().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`plumpfaik: ${bricks.length} bricks`);
}
