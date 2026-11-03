// TI&und;musta's wish (2026-11-02, owner-granted free wish): "big tom pearl", read as a big pearl in an open shell.
// 120 across, sphere of stacked cross-shaped slices on a pink scallop shell.
//   node mapgen/pearl.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000003', name: 'pearl', display_name: 'pearl' };

export function pearl() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`pearl: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const PINK = [236, 176, 160], PINK2 = [220, 150, 140], PEARL = [248, 244, 236], PEARL2 = [232, 230, 238];
  // shell: three tapering steps, then a fan of ridges at the back
  box(-90, -70, 0, 90, 70, 12, PINK, 'shell base'); box(-80, -60, 12, 80, 60, 24, PINK2, 'shell mid'); box(-70, -50, 24, 70, 50, 32, PINK, 'shell top');
  for (let i = -3; i <= 3; i++) box(i * 22 - 8, 60, 12, i * 22 + 8, 70, 36 + (3 - Math.abs(i)) * 12, i % 2 ? PINK2 : PINK, 'shell ridge');
  // pearl: radius 60, centre z 96, slices of 8
  const zc = 96, R = 60;
  for (let z = zc - R; z < zc + R; z += 8) {
    const dz = z + 4 - zc, r = Math.round(Math.sqrt(R * R - dz * dz) / 2) * 2, a = Math.round(r * 0.41 / 2) * 2, b = Math.round(r * 0.86 / 2) * 2;
    if (r < 4) continue;
    const c = Math.abs(dz) < 20 ? PEARL : PEARL2, m = { material: 'BMC_Metallic', material_intensity: 3 };
    box(-r, -a, z, r, a, z + 8, c, 'pearl', m);
    box(-b, a, z, b, b, z + 8, c, 'pearl', m); box(-b, -b, z, b, -a, z + 8, c, 'pearl', m);
  }
  return B.bricks;
}

if (process.argv[1]?.endsWith('pearl.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'pearl.json';
  const bricks = pearl().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`pearl: ${bricks.length} bricks`);
}
