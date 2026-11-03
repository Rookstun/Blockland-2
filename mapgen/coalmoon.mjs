// cubehaver's wish (2026-11-02, granted by the owner): "the coal moon", a big charcoal sphere with pale dust patches and craters.
// Radius 120, resting on the ground. Slices of 8 tall, each a stack of y-rows 20 wide.
//   node mapgen/coalmoon.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000006', name: 'coalmoon', display_name: 'coalmoon' };

export function coalMoon() {
  const B = makeBuilder({ cell: 40 });
  const R = 120, rand = rng(1102);
  const craters = Array.from({ length: 14 }, () => {
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    return { d: [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)], r: 0.16 + rand() * 0.18 };
  });
  for (let z = 0; z < 2 * R; z += 8) {
    const dz = z + 4 - R, rz = Math.sqrt(Math.max(0, R * R - dz * dz));
    for (let y = -rz; y < rz; y += 20) {
      const y0 = Math.max(-rz, y), y1 = Math.min(rz, y + 20), ym = (y0 + y1) / 2;
      const hw = Math.floor(Math.sqrt(Math.max(0, rz * rz - ym * ym)) / 2) * 2;
      const Y0 = Math.round(y0 / 2) * 2, Y1 = Math.round(y1 / 2) * 2;
      if (hw < 4 || Y1 - Y0 < 2) continue;
      // darker inside craters, pale dust elsewhere on a few bricks
      const n = [0, ym / R, dz / R], len = Math.hypot(hw / R, n[1], n[2]) || 1;
      const dir = [hw / R / len, n[1] / len, n[2] / len];
      const inCrater = craters.some(c => c.d[0] * dir[0] + c.d[1] * dir[1] + c.d[2] * dir[2] > 1 - c.r * c.r / 2);
      const t = rand(), base = inCrater ? 14 : 30 + Math.round(t * 22), dust = !inCrater && t > 0.93;
      const col = dust ? [92, 92, 100] : [base, base, base + 4];
      B.box(-hw, Y0, z, hw, Y1, z + 8, { asset: 'PB_DefaultMicroBrick', color: col, ...(dust ? {} : { material: 'BMC_Metallic', material_intensity: 2 }) }, 'moon');
    }
  }
  return B.bricks;
}

if (process.argv[1]?.endsWith('coalmoon.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'coalmoon.json';
  const bricks = coalMoon().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`coal moon: ${bricks.length} bricks`);
}
