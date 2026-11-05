// Picture billboard: pixels json (billboard/pixels.py) -> merged micro-brick panel on two posts.
// node billboard/gen.mjs px.json CX CY Z0 out.json [cell=10]
// Face looks toward -y (viewer stands south, facing +y). Left-handed world: +x is the viewer's LEFT, so column 0 sits at max x.
import fs from 'fs';
import { makeBuilder } from '../mapgen/builder.mjs';

const [pxFile, CX, CY, Z0, out, CELL = 10] = process.argv.slice(2);
const { W, H, px } = JSON.parse(fs.readFileSync(pxFile, 'utf8'));
const cell = +CELL, cx = +CX, cy = +CY, z0 = +Z0;
const q = c => c.map(v => Math.min(255, Math.round(v / 6) * 6)); // shortcut: 6-step quantize merges flat areas; lower it for a finer picture at more bricks
const col = (u, v) => q(px[v * W + u]).join();

const b = makeBuilder();
const POST = 300, half = (W * cell) / 2;
const xMax = cx + half, zTop = z0 + POST + H * cell;
// greedy rectangles: run along the row, then grow down while the rows below match
const used = new Uint8Array(W * H);
let rects = 0;
for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
  if (used[v * W + u]) continue;
  const c = col(u, v);
  let w = 1; while (u + w < W && !used[v * W + u + w] && col(u + w, v) === c) w++;
  let h = 1;
  grow: while (v + h < H) { for (let k = 0; k < w; k++) if (used[(v + h) * W + u + k] || col(u + k, v + h) !== c) break grow; h++; }
  for (let dv = 0; dv < h; dv++) for (let k = 0; k < w; k++) used[(v + dv) * W + u + k] = 1;
  const x1 = xMax - u * cell, x0 = x1 - w * cell, zt = zTop - v * cell, zb = zt - h * cell;
  b.box(x0, cy, zb, x1, cy + cell, zt, { color: c.split(',').map(Number), material: 'BMC_Plastic' }, 'px');
  rects++;
}
if (used.some(x => !x) || b.dropped.length) throw new Error('merge left gaps or overlaps'); // self-check: every pixel covered exactly once
// back board, frame, posts
const dark = { color: [24, 24, 26], material: 'BMC_Plastic' };
b.slab(cx - half, cy + cell, z0 + POST, cx + half, cy + cell + 10, zTop, dark, 'back');
b.box(cx - half - 20, cy - 10, z0 + POST - 20, cx + half + 20, cy + cell + 10, z0 + POST, dark, 'frameB');
b.box(cx - half - 20, cy - 10, zTop, cx + half + 20, cy + cell + 10, zTop + 20, dark, 'frameT');
b.box(cx - half - 20, cy - 10, z0 + POST, cx - half, cy + cell + 10, zTop, dark, 'frameL');
b.box(cx + half, cy - 10, z0 + POST, cx + half + 20, cy + cell + 10, zTop, dark, 'frameR');
for (const px0 of [cx - half / 2, cx + half / 2]) b.box(px0 - 20, cy + cell + 10, z0, px0 + 20, cy + cell + 50, zTop, { color: [60, 60, 64], material: 'BMC_Metallic' }, 'post');
if (b.dropped.length) console.error('dropped', b.dropped.length, b.dropped.slice(0, 3));
fs.writeFileSync(out, JSON.stringify(b.bricks.map(({ label, ...r }) => r)));
console.log(`${rects} pixel rects, ${b.bricks.length} bricks, ${W * cell}x${H * cell} units, x ${cx - half}..${cx + half} y ${cy} z ${z0}..${zTop + 20}`);
