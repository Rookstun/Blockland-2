// bogey/view.mjs: renders dumped chip rows ("bnrow|r|text" log lines, last dump wins) to a PNG.
//   node bogey/view.mjs <log file> out.png [scale]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PAL, W, H } from './gen.mjs';

export function parseRow(text, base = PAL[0]) {
  const out = [], re = /<color="([0-9a-f]{6})">([^<]*)<\/>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) for (const ch of m[2] ?? m[3]) if (ch !== '\n') out.push(m[2] !== undefined ? (ch === '█' || ch === ' ' ? m[1] : m[1]) : base);
  return out;
}
function png(rows, scale) {
  const w = W * scale, h = H * scale, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = rows[Math.floor(y / scale)]?.[Math.floor(x / scale)] ?? PAL[0], o = y * (w * 3 + 1) + 1 + x * 3;
    for (let k = 0; k < 3; k++) raw[o + k] = parseInt(c.slice(k * 2, k * 2 + 2), 16);
  }
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const [file, out, scale = 6] = process.argv.slice(2);
const rows = [];
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  const m = /bnrow\|(\d+)\|(.*)$/.exec(line);
  if (m) rows[+m[1]] = parseRow(m[2].replace(/\r$/, ''));
}
const bad = rows.map((r, i) => [i, r?.length]).filter(([, n]) => n !== W);
if (bad.length) console.log('rows not', W, 'cells (text rows are fine):', JSON.stringify(bad.slice(0, 12)));
fs.writeFileSync(out, png(rows, +scale));
console.log('wrote', out);
