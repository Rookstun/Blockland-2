// renderman's request (2026-11-02, chat): "make an xbox". A tall black game-console tower with a green-lit vent top, a power button
// and side vents, plus a plain gamepad on the ground. Own livery, no logos. Front faces -y.
//   node mapgen/console.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000a', name: 'console', display_name: 'console' };

export function consoleTower() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`console: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const BLACK = [20, 20, 24], DARK = [36, 36, 42], GREEN = [60, 210, 70], GREY = [150, 154, 162], WHITE = [236, 236, 232], RED = [200, 50, 50], BLUE = [50, 90, 200], YEL = [230, 200, 50];
  // tower: 100 x 100 x 240, a plinth, the body, a vented green top
  box(-50, -50, 0, 50, 50, 8, DARK, 'plinth');
  box(-50, -50, 8, 50, 50, 232, BLACK, 'body', { material: 'BMC_Metallic', material_intensity: 3 });
  box(-50, -52, 8, 50, -50, 232, DARK, 'front panel'); // thin front plate
  for (let z = 40; z <= 200; z += 16) { box(-52, -40, z, -50, 40, z + 4, DARK, 'side vent'); box(50, -40, z, 52, 40, z + 4, DARK, 'side vent'); }
  box(-50, -50, 232, 50, 50, 236, DARK, 'top rim');
  box(-40, -40, 236, 40, 40, 240, GREEN, 'top glow');
  for (let x = -36; x <= 28; x += 16) box(x, -40, 240, x + 8, 40, 244, BLACK, 'top grille');
  // power button and disc slot on the front
  box(-8, -56, 190, 8, -52, 206, GREEN, 'power button');
  box(-30, -54, 120, 30, -52, 124, DARK, 'disc slot');
  box(-6, -54, 28, 6, -52, 34, WHITE, 'status led');
  // gamepad on the ground beside it: body, grips, two sticks, four buttons, d-pad
  box(90, -50, 0, 190, 10, 20, DARK, 'gamepad body'); box(86, -46, 4, 90, -20, 18, DARK, 'grip'); box(190, -46, 4, 194, -20, 18, DARK, 'grip');
  box(134, -14, 20, 146, -2, 28, BLACK, 'left stick'); box(150, -14, 20, 162, -2, 28, BLACK, 'right stick');
  box(166, -44, 20, 174, -36, 24, YEL, 'button'); box(166, -20, 20, 174, -12, 24, GREEN, 'button'); box(178, -32, 20, 186, -24, 24, RED, 'button'); box(154, -32, 20, 162, -24, 24, BLUE, 'button');
  box(106, -26, 20, 126, -20, 24, GREY, 'dpad'); box(112, -34, 20, 120, -26, 24, GREY, 'dpad up'); box(112, -20, 20, 120, -12, 24, GREY, 'dpad down');
  return B.bricks;
}

if (process.argv[1]?.endsWith('console.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'console.json';
  const bricks = consoleTower().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`console: ${bricks.length} bricks`);
}
