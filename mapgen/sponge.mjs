// faik's wish (2026-11-02, free wish): "a spongebob". Original take: a square yellow sea sponge in brown trunks, big eyes, buck teeth.
// Front faces -y, ground point = (X, Y, Z).
//   node mapgen/sponge.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000d', name: 'sponge', display_name: 'sponge' };

export function sponge() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`sponge: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const YEL = [240, 214, 52], YEL2 = [214, 184, 40], WHITE = [248, 248, 244], BLUE = [70, 140, 214], BLACK = [26, 26, 28];
  const BROWN = [120, 78, 40], RED = [200, 50, 50], PINK = [236, 150, 140];
  // legs, socks, shoes
  for (const x of [-20, 10]) {
    box(x, -8, 0, x + 10, 2, 10, BLACK, 'shoe'); box(x + 2, -6, 10, x + 8, 0, 22, YEL, 'leg');
    box(x + 1, -7, 22, x + 9, 1, 30, WHITE, 'sock');
  }
  box(-30, -16, 30, 30, 16, 50, BROWN, 'trunks');                        // brown trunks
  box(-30, -16, 50, 30, 16, 56, WHITE, 'shirt');
  box(-12, -18, 50, 12, -16, 52, RED, 'tie');
  // the body: tall square sponge, pores on the face and sides
  box(-30, -16, 56, 30, 16, 140, YEL, 'body');
  box(-32, -12, 70, -30, -4, 80, YEL2, 'pore'); box(30, 0, 100, 32, 8, 112, YEL2, 'pore'); box(-32, 2, 110, -30, 10, 124, YEL2, 'pore');
  box(-14, -18, 62, -4, -16, 70, YEL2, 'pore'); box(22, -18, 124, 28, -16, 132, YEL2, 'pore');
  // eyes, cheeks, nose, grin, teeth
  box(-20, -20, 100, -2, -16, 122, WHITE, 'eye'); box(2, -20, 100, 20, -16, 122, WHITE, 'eye');
  box(-12, -22, 106, -6, -20, 114, BLUE, 'iris'); box(6, -22, 106, 12, -20, 114, BLUE, 'iris');
  box(-10, -24, 108, -8, -22, 112, BLACK, 'pupil'); box(8, -24, 108, 10, -22, 112, BLACK, 'pupil');
  box(-4, -22, 86, 4, -16, 98, YEL2, 'nose');
  box(-20, -20, 80, -14, -16, 86, PINK, 'cheek'); box(14, -20, 80, 20, -16, 86, PINK, 'cheek');
  box(-16, -18, 72, 16, -16, 76, BLACK, 'smile');
  box(-6, -20, 62, 0, -18, 72, WHITE, 'tooth'); box(2, -20, 62, 8, -18, 72, WHITE, 'tooth');
  // skinny arms and white gloves, one waving
  box(-38, -4, 52, -30, 4, 56, YEL, 'arm'); box(-46, -4, 40, -38, 4, 56, YEL, 'arm'); box(-48, -6, 34, -40, 6, 40, WHITE, 'glove');
  box(30, -4, 90, 40, 4, 94, YEL, 'arm'); box(40, -4, 90, 46, 4, 130, YEL, 'arm raised'); box(38, -6, 130, 50, 6, 142, WHITE, 'glove');
  return B.bricks;
}

if (process.argv[1]?.endsWith('sponge.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'sponge.json';
  const bricks = sponge().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`sponge: ${bricks.length} bricks`);
}
