// mildorsplume/view.mjs: renders O-grid rows (the chip's rows/strip text) to a PNG, to check frames without the game.
//   node mildorsplume/view.mjs <log file with "csrow|r|text" lines> out.png [scale]   (the last dump wins per row)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PAL, W, H } from './gen.mjs';

export function parseRow(text, base = PAL[0]) {
  const out = [];
  const re = /<color="([0-9a-f]{6})">([^<]*)<\/>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const col = m[1] ?? base, run = m[2] ?? m[3];
    for (const ch of run) if (ch !== '\n') out.push(col);
  }
  return out;
}
export function png(rows, scale = 6) {
  const w = W * scale, h = H * scale, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    const row = rows[Math.floor(y / scale)] ?? [];
    for (let x = 0; x < w; x++) {
      const c = row[Math.floor(x / scale)] ?? 'ff00ff', o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = parseInt(c.slice(0, 2), 16); raw[o + 1] = parseInt(c.slice(2, 4), 16); raw[o + 2] = parseInt(c.slice(4, 6), 16);
    }
  }
  const crc = buf => { let c, k, crcv = ~0; for (const b of buf) { c = (crcv ^ b) & 0xff; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return ~crcv >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
if (process.argv[1]?.endsWith('view.mjs')) {
  const [file, out, scale] = process.argv.slice(2);
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /csrow\|(\d+)\|(.*)$/.exec(line);
    if (m) rows[+m[1]] = parseRow(m[2].replace(/\r$/, ''));
  }
  const bad = rows.map((r, i) => [i, r?.length]).filter(([, n]) => n !== W);
  if (bad.length) console.log('rows not', W, 'cells:', JSON.stringify(bad.slice(0, 10)));
  fs.writeFileSync(out, png(rows, +(scale ?? 6)));
  console.log('wrote', out);
}
