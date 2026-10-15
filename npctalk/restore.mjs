// Put back the map bricks that the NPC-body ClearRegion boxes swept away
// (2026-10-15: boxes round each NPC spot also took lawn/paving details).
// Collects every brick of the live map output wholly inside any box -> one bridge job.
//   node npctalk/restore.mjs mapgen/out_delta > job.json
import { readFileSync, readdirSync } from 'node:fs';
const mapDir = process.argv[2];
const NPCS = JSON.parse(readFileSync(new URL('../omegga-npctalk/npcs.json', import.meta.url)));
const boxes = [];
for (const n of NPCS) { const [x, y, z] = n.at; boxes.push([x, y, z + 6, 12, 12, 10], [x, y, z + 50, 30, 30, 70]); }
boxes.push([126, -227, 676, 60, 60, 70], [350, -30, 690, 30, 30, 50]);
for (let i = 0; i < 17; i++) boxes.push([350 - 60 + (i % 12) * 40, -30 - 60 - Math.floor(i / 12) * 20, 628, 8, 8, 4]);

const inside = (b, [cx, cy, cz, hx, hy, hz]) => {
  const s = b.size ?? [5, 5, 6], r = Math.max(s[0], s[1], s[2]); // orientation-proof: the largest half extent on every axis
  const [x, y, z] = b.position;
  return Math.abs(x - cx) + r <= hx + 1 && Math.abs(y - cy) + r <= hy + 1 && Math.abs(z - cz) + r <= hz + 1;
};
let ext = null; const out = [];
for (const f of readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f)).sort()) {
  const job = JSON.parse(readFileSync(`${mapDir}/${f}`, 'utf8'));
  for (const op of job.ops ?? []) if (op.op === 'bricks') {
    ext ??= op.externalAssets;
    for (const b of op.bricks) if (boxes.some(bx => inside(b, bx))) out.push(b);
  }
}
console.error(`${out.length} bricks to restore`);
console.log(JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' }, captureMs: 4000, externalAssets: ext, bricks: out }] }));
