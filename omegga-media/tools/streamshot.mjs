// node omegga-media/tools/streamshot.mjs in.brz out.png (in = br.Prefab.SaveRegion "x" 3956 374 1000 33 3 19 0) : decode the /stream panel tiles (2x2 colour runs) into a 64x36 PNG (x8)
import fs from 'fs'; import zlib from 'zlib';
const m = await import(new URL('../../tools/brs4/dist.mjs', import.meta.url));
const r = m.WorldReader.from(fs.readFileSync(process.argv[2]));
const K = 2, TW = 32, TH = 18, W = TW * K, H = TH * K, img = Buffer.alloc(W * H * 3);
let n = 0, empty = 0;
for (const ci of r.brickChunkIndex(1)) {
  const bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => r.brickChunkSoa(e, i) }, 1)];
  let comps; try { comps = r.componentChunk(1, ci.index).components; } catch { continue; }
  for (const c of comps) {
    if (!/TextDisplay/.test(c.typeName)) continue;
    const b = bricks[c.brickIndex]; if (!b) continue;
    const [x, , z] = b.position; // world-relative to SaveRegion centre (3956,374,1000)
    const tx = Math.round((3987 - x) / 2), ty = Math.round((1017 - z) / 2);
    if (tx < 0 || tx >= TW || ty < 0 || ty >= TH) continue;
    const cols = [...String(c.data?.Text ?? '').matchAll(/color="([0-9a-fA-F]{6})"/g)].map(m => m[1]);
    if (cols.length !== K * K) { empty++; continue; }
    n++;
    cols.forEach((h, i) => { const px = tx * K + (i % K), py = ty * K + Math.floor(i / K), o = (py * W + px) * 3; for (let ch = 0; ch < 3; ch++) img[o + ch] = parseInt(h.substr(ch * 2, 2), 16); });
  }
}
const S = 8, w = W * S, h = H * S, raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) img.copy(raw, y * (w * 3 + 1) + 1 + x * 3, ((Math.floor(y / S)) * W + Math.floor(x / S)) * 3, ((Math.floor(y / S)) * W + Math.floor(x / S)) * 3 + 3); }
const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('tiles', n, 'empty', empty);
