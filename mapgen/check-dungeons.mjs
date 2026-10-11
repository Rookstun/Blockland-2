// Builds the three map dungeons for a seed and checks them: no overlapping
// pieces, and every room reachable on foot from the entrance room (a gravity
// flood fill over a voxel grid: 1-stud columns, plate-high voxels, a player
// needs 15 plates of headroom and can step up one brick).
//
//   node check-dungeons.mjs [--seed N]

import { buildDungeon, SIZE } from './dungeon.mjs';

const args = process.argv.slice(2);
const SEED = Number(args.includes('--seed') ? args[args.indexOf('--seed') + 1] : 20261001);
// keep in step with DUNGEONS in mapgen.mjs
const DUNGEONS = [
  { name: 'Hollow Crypt', levels: 3, seed: SEED + 1, theme: 'crypt' },
  { name: 'Sunken Keep', levels: 4, seed: SEED + 2, theme: 'keep' },
  { name: 'Mountain Deep', levels: 5, seed: SEED + 3, theme: 'deep' },
];
const VX = 10, VZ = 4, HEAD = 15, STEP = 3;

let bad = 0;
for (const d of DUNGEONS) {
  const out = buildDungeon({ levels: d.levels, seed: d.seed, theme: d.theme });
  const nx = SIZE / VX, nz = Math.ceil((d.levels * 192 + 120) / VZ);
  const solid = new Uint8Array(nx * nx * nz);
  const at = (x, y, z) => (x * nx + y) * nz + z;
  for (const b of out.bricks) {
    const [x0, x1] = [Math.round((b.position[0] - b.size[0]) / VX), Math.round((b.position[0] + b.size[0]) / VX)];
    const [y0, y1] = [Math.round((b.position[1] - b.size[1]) / VX), Math.round((b.position[1] + b.size[1]) / VX)];
    const [z0, z1] = [Math.round((b.position[2] - b.size[2]) / VZ), Math.round((b.position[2] + b.size[2]) / VZ)];
    for (let x = Math.max(0, x0); x < Math.min(nx, x1); x++)
      for (let y = Math.max(0, y0); y < Math.min(nx, y1); y++)
        for (let z = Math.max(0, z0); z < Math.min(nz, z1); z++) solid[at(x, y, z)] = 1;
  }
  const stand = (x, y, z) => {
    if (x < 0 || y < 0 || x >= nx || y >= nx || z < 1 || z + HEAD >= nz || !solid[at(x, y, z - 1)]) return false;
    for (let h = 0; h < HEAD; h++) if (solid[at(x, y, z + h)]) return false;
    return true;
  };
  // flood from the entrance room's floor
  const ent = out.rooms.find(r => r.entrance);
  const seen = new Uint8Array(nx * nx * nz);
  const queue = [];
  const sx = Math.round((ent.rect[0] + ent.rect[2]) / 2 / VX), sy = Math.round((ent.rect[1] + ent.rect[3]) / 2 / VX);
  const sz = ent.z / VZ;
  if (!stand(sx, sy, sz)) throw new Error(`${d.name}: can't stand at the entrance room centre`);
  seen[at(sx, sy, sz)] = 1;
  queue.push([sx, sy, sz]);
  while (queue.length) {
    const [x, y, z] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= nx || Y >= nx) continue;
      // step up to STEP plates, or walk off and fall to the first floor below
      let Z = -1;
      for (let z2 = z + STEP; z2 >= z; z2--) if (stand(X, Y, z2)) { Z = z2; break; }
      if (Z < 0) {
        let blocked = false;
        for (let h = 0; h < HEAD && !blocked; h++) if (solid[at(X, Y, z + h)]) blocked = true;
        if (blocked) continue;
        for (let z2 = z - 1; z2 >= 1; z2--) if (stand(X, Y, z2)) { Z = z2; break; } else if (solid[at(X, Y, z2)]) break;
        if (Z < 0) continue;
      }
      // headroom on the way up a step
      let clear = true;
      for (let h = 0; h < HEAD && clear; h++) if (Z > z && solid[at(x, y, Z + h)]) clear = false;
      if (!clear || seen[at(X, Y, Z)]) continue;
      seen[at(X, Y, Z)] = 1;
      queue.push([X, Y, Z]);
    }
  }
  // a room counts as reached if anyone stands anywhere inside it on its floor
  // storey (or, for an atrium, at its ground floor)
  const unreached = out.rooms.filter(r => {
    const [x0, y0, x1, y1] = r.rect.map(v => Math.round(v / VX));
    const z0 = r.z / VZ, z1 = z0 + 192 / VZ;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) if (seen[at(x, y, z)]) return false;
    return true;
  });
  const tally = key => Object.entries(out.rooms.filter(r => !r.atrium).reduce((a, r) => ((a[r[key]] = (a[r[key]] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ');
  const sizes = Object.entries(out.rooms.filter(r => !r.atrium).reduce((a, r) => { const s = `${(r.rect[2] - r.rect[0]) / 400}x${(r.rect[3] - r.rect[1]) / 400}`; a[s] = (a[s] ?? 0) + 1; return a; }, {})).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${d.name}: ${out.bricks.length} bricks, ${out.rooms.length} rooms (${sizes}), ${out.dropped.length} overlaps, ${unreached.length} unreachable`);
  console.log(`  features: ${tally('feature')}\n  floors: ${tally('pattern')}\n  ceilings: ${tally('ceiling')}`);
  for (const r of unreached) console.log(`  UNREACHABLE ${r.n} ${r.feature} ${JSON.stringify(r.rect)}`);
  for (const x of out.dropped.slice(0, 5)) console.log(`  OVERLAP ${x}`);
  bad += unreached.length + out.dropped.length;
}
process.exit(bad ? 1 : 0);
