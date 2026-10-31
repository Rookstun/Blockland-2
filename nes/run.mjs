// node nes/run.mjs ROM.nes [--frames N] [--png out.png] [--press A,Start@frame ...] : headless run, screenshot at the end
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { NES } from './src/nes.mjs';

export function png(fb, w = 256, h = 240) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fb[y * w + x], o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c & 255; raw[o + 1] = c >> 8 & 255; raw[o + 2] = c >> 16 & 255;
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
  const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ c >>> 8; return ~c >>> 0; };
  const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]), o = Buffer.alloc(4 + b.length + 4); o.writeUInt32BE(d.length); b.copy(o, 4); o.writeUInt32BE(crc(b), 4 + b.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i < 0 ? null : a[i + 1]; };
  const nes = new NES(new Uint8Array(readFileSync(a[0])));
  const frames = +(arg('--frames') || 300), BTN = { A: 1, B: 2, Select: 4, Start: 8, Up: 16, Down: 32, Left: 64, Right: 128 };
  const presses = a.flatMap((x, i) => a[i - 1] === '--press' ? [x] : []).map(s => { const [b, f] = s.split('@'); return [BTN[b], +f]; });
  for (let f = 0; f < frames; f++) {
    nes.buttons[0] = presses.reduce((m, [b, at]) => f >= at && f < at + 5 ? m | b : m, 0);
    nes.frame();
  }
  if (arg('--png')) writeFileSync(arg('--png'), png(nes.ppu.fb));
  console.log(`ran ${frames} frames, ${nes.cpu.cycles} cpu cycles`);
}
