// Claude self-portrait (dirt asked "for claude only: build a self-portrait", 2026-11-06):
// an upright orange starburst on a stone pedestal. node mapgen/selfportrait.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000a171', name: 'Claude Portrait', display_name: 'Claude Portrait' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick', P = 4, RAD = 96, CZ = 40 + 8 + RAD; // pixel, burst radius, burst centre height
const ORANGE = { asset: MB, color: [217, 119, 87] };
const STONE = { asset: MB, color: [120, 116, 110] };
// pedestal
B.box(-40, -20, 0, 40, 20, 36, STONE, 'pedestal');
B.box(-44, -24, 36, 44, 24, 40, STONE, 'cap');
B.box(-8, -4, 40, 8, 4, 48, STONE, 'post');
// 11 rays of uneven length, tapering, plus a round core; rasterised in the x-z plane, rows merged into runs
const rays = Array.from({ length: 11 }, (_, k) => ({ a: (k / 11) * 2 * Math.PI + 0.2, len: RAD * (0.78 + 0.22 * ((k * 7) % 5) / 4) }));
const inside = (x, z) => {
  const r = Math.hypot(x, z);
  if (r < 18) return true;
  return rays.some(({ a, len }) => {
    const along = x * Math.cos(a) + z * Math.sin(a), across = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
    return along > 0 && along < len && across < 9 * (1 - along / len) + 2;
  });
};
const N = RAD / P;
for (let j = -N; j < N; j++) {
  let run = null;
  for (let i = -N; i <= N; i++) {
    const on = i < N && inside(i * P + P / 2, j * P + P / 2);
    if (on && run === null) run = i;
    if (!on && run !== null) {
      const z0 = CZ + j * P;
      if (z0 >= 48) B.box(run * P, -4, z0, i * P, 4, z0 + P, ORANGE, 'burst');
      run = null;
    }
  }
}
if (B.dropped.length) throw new Error(`portrait: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`portrait: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
