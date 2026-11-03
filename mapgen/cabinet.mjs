// faik's second wish: "inside brickadia game machine arcade". An original upright arcade cabinet with a glowing screen, joystick and buttons. Front faces -y.
//   node mapgen/cabinet.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000010', name: 'cabinet', display_name: 'cabinet' };

export function cabinet() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`cabinet: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const BODY = [60, 40, 120], TRIM = [240, 200, 60], BLACK = [24, 24, 28], SCREEN = [40, 200, 120], RED = [220, 50, 50], BLUE = [60, 120, 220], GREY = [150, 150, 156];
  box(-30, -30, 0, 30, 30, 8, BLACK, 'base');
  box(-30, -30, 8, 30, 30, 70, BODY, 'lower');                                  // lower cabinet
  box(-30, -50, 70, 30, -20, 78, BLACK, 'control deck');                      // overhanging control panel
  box(-14, -40, 78, -10, -36, 90, GREY, 'stick shaft'); box(-18, -44, 90, -6, -32, 98, RED, 'stick ball');
  box(6, -44, 78, 16, -34, 82, BLUE, 'button'); box(20, -44, 78, 30, -34, 82, RED, 'button');
  box(-30, -20, 78, 30, 30, 150, BODY, 'upper');
  box(-30, -24, 100, 30, -20, 150, BLACK, 'bezel');
  box(-24, -26, 106, 24, -24, 144, SCREEN, 'screen', { material: 'BMC_Glow', material_intensity: 4 });
  box(-30, -24, 150, 30, 30, 170, TRIM, 'marquee'); box(-26, -28, 152, 26, -24, 168, RED, 'marquee panel');
  box(-34, -30, 78, -30, 30, 150, TRIM, 'side stripe'); box(30, -30, 78, 34, 30, 150, TRIM, 'side stripe');
  box(-24, 30, 78, 24, 34, 160, BLACK, 'back');
  return B.bricks;
}

if (process.argv[1]?.endsWith('cabinet.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'cabinet.json';
  const bricks = cabinet().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`cabinet: ${bricks.length} bricks`);
}
