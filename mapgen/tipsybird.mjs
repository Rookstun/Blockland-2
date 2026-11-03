// crazyjaydon's second wish (2026-11-02, granted by the owner: "give the man what he wants"): a tipsy bird, an ORIGINAL cartoon
// bird (no named character): teal, swirly eyes, rosy cheeks, crooked bow, a cocktail with an umbrella. Front faces -y, 140 tall.
//   node mapgen/tipsybird.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000007', name: 'tipsybird', display_name: 'tipsybird' };

export function tipsyBird() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`tipsybird: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const TEAL = [48, 160, 164], TEAL2 = [32, 120, 128], BELLY = [236, 240, 226], ORANGE = [236, 140, 40], PINK = [236, 130, 150], WHITE = [250, 250, 246], BLACK = [24, 24, 28];
  // body: ellipsoid, rows 20 wide, slices of 8, z 20..90
  const rx = 40, ry = 32, rz = 35, zc = 55;
  for (let z = 20; z < 84; z += 8) {
    const dz = z + 4 - zc, k = Math.sqrt(Math.max(0, 1 - (dz / rz) ** 2)), sy = ry * k;
    for (let y = -sy; y < sy; y += 20) {
      const y0 = Math.max(-sy, y), y1 = Math.min(sy, y + 20), ym = (y0 + y1) / 2;
      const hw = Math.floor(rx * k * Math.sqrt(Math.max(0, 1 - (ym / sy) ** 2)) / 2) * 2, Y0 = Math.round(y0 / 2) * 2, Y1 = Math.round(y1 / 2) * 2;
      if (hw >= 4 && Y1 > Y0) box(-hw, Y0, z, hw, Y1, z + 8, ym < -4 ? BELLY : TEAL, 'body');
    }
  }
  // head leans a little to the right: lower block, narrower top, bow on top
  const hx = 6;
  box(hx - 32, -26, 84, hx + 32, 26, 120, TEAL, 'head'); box(hx - 26, -20, 120, hx + 26, 20, 130, TEAL, 'head top');
  box(hx - 18, -28, 108, hx - 8, -26, 122 - 2, WHITE, 'eye'); box(hx + 8, -28, 108, hx + 18, -26, 120, WHITE, 'eye');
  box(hx - 16, -30, 111, hx - 10, -28, 117, BLACK, 'pupil'); box(hx + 10, -30, 111, hx + 16, -28, 117, BLACK, 'pupil');
  box(hx - 14, -32, 113, hx - 12, -30, 115, WHITE, 'swirl'); box(hx + 12, -32, 113, hx + 14, -30, 115, WHITE, 'swirl');
  box(hx - 20, -28, 120, hx - 6, -26, 124, BLACK, 'lash'); box(hx + 6, -28, 120, hx + 20, -26, 124, BLACK, 'lash');
  box(hx - 30, -28, 96, hx - 20, -26, 106, PINK, 'cheek'); box(hx + 20, -28, 96, hx + 30, -26, 106, PINK, 'cheek');
  box(hx - 8, -42, 100, hx + 8, -26, 110, ORANGE, 'beak'); box(hx - 6, -36, 96, hx + 6, -26, 100, [200, 100, 30], 'beak low');
  box(hx + 4, -4, 130, hx + 20, 6, 138, PINK, 'bow'); box(hx - 10, -4, 132, hx + 4, 6, 140, PINK, 'bow');
  // wings: left hangs, right holds the cocktail
  box(-72, -12, 44, -40, 12, 80, TEAL2, 'wing'); box(-76, -10, 36, -72, 10, 48, TEAL2, 'wing tip');
  box(40, -14, 62, 64, -2, 72, TEAL2, 'wing');
  box(60, -12, 72, 64, -8, 88, [200, 204, 210], 'stem'); box(52, -16, 88, 72, -4, 104, [220, 110, 150], 'cocktail', { material: 'BMC_Glass' });
  box(52, -18, 96, 58, -16, 102, ORANGE, 'orange slice'); box(60, -12, 104, 62, -10, 120, [230, 230, 230], 'umbrella pole'); box(50, -18, 120, 74, -2, 124, [200, 40, 40], 'umbrella');
  // legs, feet, tail
  for (const s of [-1, 1]) { box(s * 18 - 2, -12, 6, s * 18 + 2, -6, 20, ORANGE, 'leg'); box(s * 18 - 10, -30, 0, s * 18 + 10, -6, 6, ORANGE, 'foot'); }
  box(-4, 34, 36, 4, 46, 72, TEAL2, 'tail'); box(-16, 34, 40, -8, 44, 66, TEAL, 'tail'); box(8, 34, 40, 16, 44, 66, TEAL, 'tail');
  return B.bricks;
}

if (process.argv[1]?.endsWith('tipsybird.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'tipsybird.json';
  const bricks = tipsyBird().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`tipsy bird: ${bricks.length} bricks`);
}
