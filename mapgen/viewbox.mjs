// Top-down render of a map output's bricks in a box (2026-10-12), for eyeballing
// a region before deploying: colour of the highest brick per pixel, hill-shaded.
//   node mapgen/viewbox.mjs OUTDIR CX CY HALF out.png [unitsPerPixel=10] [zMax]
// zMax: drop bricks reaching above it, a cut-away (e.g. the sewer level)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [dir, cx, cy, half, out, upp = 10, zMax = Infinity] = process.argv.slice(2);
const CX = +cx, CY = +cy, HF = +half, U = +upp, W = Math.round((2 * HF) / U);
const zb = new Float32Array(W * W).fill(-1e9), rgb = new Uint8Array(W * W * 3);
for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f))) {
  for (const op of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).ops) {
    if (op.op !== 'bricks') continue;
    for (const b of op.bricks) {
      const [lo, hi] = worldBox(b, FIXED);
      if (lo[2] >= +zMax) continue;
      if (hi[0] < CX - HF || lo[0] > CX + HF || hi[1] < CY - HF || lo[1] > CY + HF) continue;
      const i0 = Math.max(0, Math.floor((lo[0] - CX + HF) / U)), i1 = Math.min(W, Math.ceil((hi[0] - CX + HF) / U));
      const j0 = Math.max(0, Math.floor((CY + HF - hi[1]) / U)), j1 = Math.min(W, Math.ceil((CY + HF - lo[1]) / U));
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
        const n = j * W + i;
        if (hi[2] <= zb[n]) continue;
        zb[n] = Math.min(hi[2], +zMax); rgb.set(b.color ?? [128, 128, 128], n * 3);
      }
    }
  }
}
// hill shade from the north-west
const img = Buffer.alloc((W * 3 + 1) * W);
for (let j = 0; j < W; j++)
  for (let i = 0; i < W; i++) {
    const n = j * W + i, nw = j > 0 && i > 0 ? zb[n - W - 1] : zb[n];
    const k = Math.max(0.55, Math.min(1.35, 1 + (zb[n] - nw) / 40));
    for (let a = 0; a < 3; a++) img[j * (W * 3 + 1) + 1 + i * 3 + a] = Math.min(255, rgb[n * 3 + a] * k);
  }
const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, W + 'px');
