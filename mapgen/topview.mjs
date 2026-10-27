// Top-down colour view of a city out dir (bricks.json): each pixel = colour of the highest brick top there,
// shaded a little by height so raised stones / tufts read.  node mapgen/topview.mjs OUTDIR X0 Y0 X1 Y1 out.png [upp=2] [zMin zMax]
import fs from 'fs';
import zlib from 'zlib';
import { worldBox } from './orient.mjs';
const [dir, X0, Y0, X1, Y1, out, upp = 2, zMin = -1e9, zMax = 1e9] = process.argv.slice(2);
const [x0, y0, x1, y1, U] = [X0, Y0, X1, Y1, upp].map(Number);
const W = Math.ceil((x1 - x0) / U), H = Math.ceil((y1 - y0) / U), top = new Float32Array(W * H).fill(-1e9), px = Buffer.alloc((W * 3 + 1) * H);
for (const b of JSON.parse(fs.readFileSync(dir + '/bricks.json', 'utf8'))) {
  const [lo, hi] = worldBox(b);
  if (hi[0] <= x0 || lo[0] >= x1 || hi[1] <= y0 || lo[1] >= y1 || lo[2] >= +zMax || hi[2] <= +zMin) continue;
  const c = b.color ?? [255, 0, 255], k = Math.min(1.25, 0.85 + hi[2] / 150);
  for (let i = Math.max(0, Math.floor((lo[0] - x0) / U)); i < Math.min(W, Math.ceil((hi[0] - x0) / U)); i++)
    for (let j = Math.max(0, Math.floor((y1 - hi[1]) / U)); j < Math.min(H, Math.ceil((y1 - lo[1]) / U)); j++) {
      if (top[j * W + i] >= hi[2]) continue;
      top[j * W + i] = hi[2];
      for (let q = 0; q < 3; q++) px[j * (W * 3 + 1) + 1 + i * 3 + q] = Math.min(255, c[q] * k);
    }
}
const tab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = tab[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
