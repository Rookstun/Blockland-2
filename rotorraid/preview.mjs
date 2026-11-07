// node rotorraid/preview.mjs out_dir: map.png (whole island map), sheet.png (every sprite), screen.png (a 180 x 120 view
// at the base with the helicopter, people, a tank, a gun and a factory dropped in), all from the same span tables the
// channels draw.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { build } from './gen.mjs';

const out = process.argv[2] ?? '.';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(file, w, h, rgb, s = 3) {
  const W = w * s, H = h * s, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = rgb[Math.floor(y / s) * w + Math.floor(x / s)] ?? [0, 0, 0]; raw.set(c, y * (W * 3 + 1) + 1 + x * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const g = build();
const pal = g.palette.map(h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)));
const map = new Array(g.IW * g.IH).fill(null);
g.map.forEach((r, y) => { for (const [a, b, c] of r) for (let x = a; x < b; x++) map[y * g.IW + x] = pal[c]; });
png(`${out}/map.png`, g.IW, g.IH, map, 2);
// sprite sheet
const SW = 60, cols = 8, rows = Math.ceil(g.sprites.length / cols), sheet = new Array(SW * cols * SW * rows).fill([20, 20, 30]);
g.sprites.forEach((s, i) => { const bx = (i % cols) * SW + 4, by = Math.floor(i / cols) * SW + 4; s.rows.forEach((r, y) => { for (const [a, b, c] of r) for (let x = a; x < b; x++) sheet[(by + y) * SW * cols + bx + x] = pal[c]; }); });
png(`${out}/sheet.png`, SW * cols, SW * rows, sheet, 3);
// one screen at the base
const scr = new Array(180 * 120), [cx, cy] = g.proj(g.START[0] + 1.5, g.START[1] - 0.5, 0), camX = Math.round(cx - 90), camY = Math.round(cy - 60);
for (let y = 0; y < 120; y++) for (let x = 0; x < 180; x++) scr[y * 180 + x] = map[(y + camY) * g.IW + x + camX] ?? pal[0];
const put = (name, wx, wy, z = 0) => { const s = g.sprites[g.SPR[name]], [px, py] = g.proj(wx, wy, z); s.rows.forEach((r, y) => { for (const [a, b, c] of r) for (let x = a; x < b; x++) { const X = Math.round(px) - camX - s.ax + x, Y = Math.round(py) - camY - s.ay + y; if (X >= 0 && X < 180 && Y >= 0 && Y < 120) scr[Y * 180 + X] = pal[c]; } }); };
put('shadow', g.START[0] + 1, g.START[1] - 1); put('heli1_0', g.START[0] + 1, g.START[1] - 1, 1); put('person0', g.START[0] + 2, g.START[1]); put('person1', g.START[0] + 2.4, g.START[1] + 0.3);
put('tank1', g.START[0] + 3, g.START[1] - 2); put('gun', g.START[0] + 4, g.START[1] - 3); put('factory', g.START[0] + 0.5, g.START[1] - 4); put('boom1', g.START[0] - 1, g.START[1] - 2);
png(`${out}/screen.png`, 180, 120, scr, 5);
console.log(`palette ${g.palette.length}, map spans ${g.map.reduce((n, r) => n + r.length, 0)} (max/row ${Math.max(...g.map.map(r => r.length))}), sprites ${g.sprites.length}: ` + g.sprites.map(s => `${s.name} ${s.w}x${s.h}`).join(', '));
