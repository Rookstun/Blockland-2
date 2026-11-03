// Felix's wish (2026-11-02, free wish): "ralsei from deltarune". Original take: a fluffy dark goat prince in a green wizard hat,
// green scarf and green robe with a pink-trimmed bow. Front faces -y, ground point = (X, Y, Z).
//   node mapgen/goatprince.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000e', name: 'goatprince', display_name: 'goatprince' };

export function goatprince() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`goatprince: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const FUR = [236, 232, 224], DARK = [52, 44, 60], HAT = [60, 140, 86], HAT2 = [44, 110, 66], ROBE = [70, 150, 96], PINK = [236, 120, 160];
  const WHITE = [250, 250, 246], BLACK = [24, 24, 28], GLASS = [200, 216, 226];
  // boots, robe skirt, body
  box(-16, -10, 0, -4, 6, 8, DARK, 'boot'); box(4, -10, 0, 16, 6, 8, DARK, 'boot');
  box(-22, -14, 8, 22, 14, 40, ROBE, 'robe skirt'); box(-22, -16, 8, 22, -14, 14, HAT2, 'robe hem');
  box(-18, -12, 40, 18, 12, 70, ROBE, 'robe body');
  box(-6, -14, 60, 6, -12, 70, PINK, 'bow knot'); box(-18, -14, 62, -6, -12, 70, PINK, 'bow'); box(6, -14, 62, 18, -12, 70, PINK, 'bow');
  // scarf
  box(-20, -14, 70, 20, 14, 78, HAT2, 'scarf'); box(18, -16, 52, 24, -12, 70, HAT2, 'scarf tail');
  // arms, hands
  box(-30, -6, 48, -18, 6, 66, ROBE, 'sleeve'); box(18, -6, 48, 30, 6, 66, ROBE, 'sleeve');
  box(-30, -6, 40, -18, 6, 48, DARK, 'hand'); box(18, -6, 40, 30, 6, 48, DARK, 'hand');
  // head: fluffy white, dark muzzle, glasses, floppy ears
  box(-24, -20, 78, 24, 20, 112, FUR, 'head');
  box(-14, -24, 80, 14, -20, 94, DARK, 'muzzle'); box(-4, -26, 90, 4, -24, 94, BLACK, 'nose');
  box(-22, -22, 98, -4, -20, 108, GLASS, 'lens'); box(4, -22, 98, 22, -20, 108, GLASS, 'lens'); box(-4, -22, 102, 4, -20, 104, BLACK, 'bridge');
  box(-16, -24, 100, -10, -22, 106, BLACK, 'eye'); box(10, -24, 100, 16, -22, 106, BLACK, 'eye');
  box(-40, -6, 76, -24, 6, 100, FUR, 'ear'); box(24, -6, 76, 40, 6, 100, FUR, 'ear'); box(-44, -4, 66, -36, 4, 76, FUR, 'ear tip'); box(36, -4, 66, 44, 4, 76, FUR, 'ear tip');
  box(-18, 20, 82, 18, 26, 108, FUR, 'back fluff');
  // wizard hat: wide brim, two stacked cones, a floppy tip
  box(-36, -30, 112, 36, 30, 118, HAT, 'hat brim');
  box(-26, -22, 118, 26, 22, 134, HAT, 'hat low'); box(-18, -16, 134, 18, 16, 148, HAT2, 'hat mid'); box(-10, -10, 148, 10, 10, 160, HAT, 'hat high');
  box(-6, -6, 160, 14, 6, 168, HAT2, 'hat tip'); box(10, -4, 154, 20, 4, 160, HAT, 'hat droop');
  box(-26, -24, 118, 26, -22, 124, PINK, 'hat band');
  return B.bricks;
}

if (process.argv[1]?.endsWith('goatprince.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'goatprince.json';
  const bricks = goatprince().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`goatprince: ${bricks.length} bricks`);
}
