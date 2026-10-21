// node mapgen/tierdemo.mjs OUTDIR CX CY HALF ZMIN DX DY DZ out.json
// Cuts a box of a mapgen build (world coords CX,CY +-HALF, bricks above ZMIN) and moves it by DX,DY,DZ into one
// bridge 'bricks' job owned by "Tier Mountain Demo" (clear: br.Bricks.Clear 7e1e0715-0000-4b0b-9a11-7135d3e00001 1).
// Made 2026-10-21 for the owner's "demo first" of the tiered mountains.
import fs from 'fs';
const [dir, cx, cy, half, zmin, dx, dy, dz, out] = process.argv.slice(2);
const OWNER = { id: '7e1e0715-0000-4b0b-9a11-7135d3e00001', name: 'Tier Mountain Demo' };
const bricks = [];
let ext = null;
for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const o of JSON.parse(fs.readFileSync(dir + '/' + f)).ops) {
    if (!o.bricks) continue;
    ext ??= o.externalAssets;
    for (const b of o.bricks) {
      const [x, y, z] = b.position;
      if (Math.abs(x - cx) > +half || Math.abs(y - cy) > +half || z + (b.size?.[2] ?? 6) < +zmin || b.components) continue;
      bricks.push({ ...b, position: [x + +dx, y + +dy, z + +dz] });
    }
  }
fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 3000, ...(ext ? { externalAssets: ext } : {}), bricks }] }));
console.log(bricks.length, 'bricks ->', out);
