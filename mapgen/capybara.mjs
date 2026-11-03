// Groxenisu's wish (2026-11-02, free wish): "a big capybara". Front faces -y, ground point = (X, Y, Z). Drawn at half size, built at 2x.
//   node mapgen/capybara.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-00000000000f', name: 'capybara', display_name: 'capybara' };
const S = 2;

export function capybara() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label) => {
    if (!B.box(x0 * S, y0 * S, z0 * S, x1 * S, y1 * S, z1 * S, { asset: 'PB_DefaultMicroBrick', color }, label)) throw new Error(`capybara: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const FUR = [168, 120, 76], BACK = [128, 88, 54], BELLY = [200, 160, 112], DARK = [60, 40, 28], FOOT = [74, 52, 36], BLACK = [20, 16, 16], YUZU = [240, 170, 40];
  // feet and legs
  for (const [x0, x1] of [[-38, -14], [14, 38]]) for (const [y0, y1] of [[-76, -46], [46, 76]]) {
    box(x0, y0, 0, x1, y1, 6, FOOT, 'foot');
    box(x0 + 2, y0 + 4, 6, x1 - 2, y1 - 4, 36, FUR, 'leg');
  }
  // barrel body: pale belly, tan flanks, darker back, rounded rump and chest
  box(-44, -80, 36, 44, 80, 44, BELLY, 'belly');
  box(-44, -80, 44, 44, 80, 88, FUR, 'body');
  box(-36, -80, 88, 36, 80, 100, BACK, 'back');
  box(-34, 80, 44, 34, 90, 88, FUR, 'rump'); box(-26, 80, 88, 26, 86, 98, BACK, 'rump top');
  box(-34, -90, 44, 34, -80, 88, FUR, 'chest');
  // blocky head, blunt snout, dark nose, small ears, side eyes, a yuzu on top
  box(-30, -126, 52, 30, -90, 112, FUR, 'head');
  box(-24, -146, 56, 24, -126, 100, FUR, 'snout'); box(-22, -146, 52, 22, -126, 56, BELLY, 'chin');
  box(-18, -150, 80, 18, -146, 96, DARK, 'nose'); box(-14, -148, 64, 14, -146, 68, DARK, 'mouth');
  box(-34, -112, 92, -30, -104, 100, BLACK, 'eye'); box(30, -112, 92, 34, -104, 100, BLACK, 'eye');
  box(-30, -100, 112, -22, -92, 120, FOOT, 'ear'); box(22, -100, 112, 30, -92, 120, FOOT, 'ear');
  box(-10, -112, 112, 10, -92, 124, YUZU, 'yuzu');
  return B.bricks;
}

if (process.argv[1]?.endsWith('capybara.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'capybara.json';
  const bricks = capybara().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`capybara: ${bricks.length} bricks`);
}
