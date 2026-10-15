// Front elevation render of a map output (2026-10-15): look at a facade without the game.
//   node elev.mjs OUT --find TEXT            -> TextDisplay bricks whose text contains TEXT (position, facing code)
//   node elev.mjs OUT CX CY CZ VIEW HALF DEPTH out.png [upp]
// VIEW = the direction the viewer looks from (+x -x +y -y: from +y = standing at larger y looking toward -y).
// Shows bricks within HALF across / up from CZ-HALF/4 and DEPTH in front of / behind (CX,CY); glass skipped,
// faces shaded by depth, a light key from the upper left. AABBs only (wedges draw as boxes).
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [out, ...a] = process.argv.slice(2);
const bricks = [];
for (const f of fs.readdirSync(out).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(fs.readFileSync(path.join(out, f), 'utf8')).ops) if (op.bricks) bricks.push(...op.bricks);
if (a[0] === '--find') {
  for (const b of bricks) for (const c of b.components ?? []) if (String(c.data?.Text ?? '').toLowerCase().includes(a[1].toLowerCase()))
    console.log(JSON.stringify({ text: c.data.Text, position: b.position, direction: b.direction, rotation: b.rotation }));
  process.exit(0);
}
const [CX, CY, CZ] = a.slice(0, 3).map(Number), view = a[3], HALF = +a[4], DEPTH = +a[5], png = a[6], upp = +(a[7] ?? 1);
const ax = view[1], sg = view[0] === '+' ? 1 : -1;            // depth axis and the viewer's side
// screen u: viewer's right. Looking toward -sg along ax (left-handed world: just pick a consistent mapping)
const U = ax === 'x' ? (p => sg * p[1]) : (p => -sg * p[0]), Dp = p => sg * (ax === 'x' ? p[0] - CX : p[1] - CY);
const u0 = U([CX, CY]), Wd = Math.round((2 * HALF) / upp), Hd = Math.round((1.25 * HALF) / upp), zLo = CZ - HALF / 4;
const zb = new Float32Array(Wd * Hd).fill(-1e9), rgb = new Uint8Array(Wd * Hd * 3).fill(200);
for (let i = 0; i < Wd * Hd; i++) { rgb[i * 3] = 150; rgb[i * 3 + 1] = 190; rgb[i * 3 + 2] = 230; }
for (const b of bricks) {
  if (b.material === 'BMC_Glass' || b.visibility === false) continue;
  const [lo, hi] = worldBox(b, FIXED);
  const ua = U(lo) - u0, ub = U(hi) - u0, uL = Math.min(ua, ub), uR = Math.max(ua, ub);
  if (uR < -HALF || uL > HALF || hi[2] < zLo || lo[2] > zLo + 1.25 * HALF) continue;
  const d = Math.max(Dp(lo), Dp(hi));                            // the face toward the viewer
  if (d < -DEPTH || Math.min(Dp(lo), Dp(hi)) > DEPTH) continue;
  const c = b.color ?? [128, 128, 128], glow = b.material === 'BMC_Glow' ? 1.3 : 1;
  const x0 = Math.max(0, Math.floor((uL + HALF) / upp)), x1 = Math.min(Wd, Math.ceil((uR + HALF) / upp));
  const y0 = Math.max(0, Math.floor((zLo + 1.25 * HALF - hi[2]) / upp)), y1 = Math.min(Hd, Math.ceil((zLo + 1.25 * HALF - lo[2]) / upp));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const n = y * Wd + x;
    if (d <= zb[n]) continue;
    zb[n] = d;
    // edge darkening so brick outlines read
    const edge = x === x0 || x === x1 - 1 || y === y0 || y === y1 - 1 ? 0.82 : 1;
    const k = edge * glow * Math.max(0.6, Math.min(1.15, 1 + d / (DEPTH * 4)));
    for (let q = 0; q < 3; q++) rgb[n * 3 + q] = Math.min(255, c[q] * k);
  }
}
const img = Buffer.alloc((Wd * 3 + 1) * Hd);
for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd * 3; i++) img[j * (Wd * 3 + 1) + 1 + i] = rgb[j * Wd * 3 + i];
const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(Wd, 0); ihdr.writeUInt32BE(Hd, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(png, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${png}: ${Wd}x${Hd}`);
