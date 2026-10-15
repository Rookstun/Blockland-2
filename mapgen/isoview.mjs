// Oblique 3D render of a map output's bricks in a box (2026-10-15), for
// eyeballing buildings before a deploy without moving anyone in game. Every
// brick is drawn as its world box (wedges show as boxes), z-buffered, lit from
// the camera's upper left. Mirrored like the game (left-handed world).
//   node mapgen/isoview.mjs OUTDIR|bricks.json CX CY HALF out.png [azimuth=-90] [elev=35] [upp=4] [zMin]
// azimuth: the compass direction the camera stands at, degrees (-90 = south, -y)
// zMin: drop bricks wholly below it (cut the terrain skirt away)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { worldBox, ORIENT } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [src, cx, cy, half, out, az = -90, el = 35, upp = 4, zMin = -Infinity] = process.argv.slice(2);
const CX = +cx, CY = +cy, HF = +half, U = +upp;
const A = (+az * Math.PI) / 180, E = (+el * Math.PI) / 180;
// camera direction (towards the camera); x mirrored (left-handed world)
const cam = [Math.cos(E) * Math.cos(A), Math.cos(E) * Math.sin(A), Math.sin(E)];
const mir = p => [-p[0], p[1], p[2]];
const camM = mir(cam);
const norm = v => { const l = Math.hypot(...v); return v.map(a => a / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const right = norm(cross([0, 0, 1], camM)), up = cross(camM, right);
const light = norm([...mir([-0.5, -0.3, 0]).slice(0, 2), 0].map((v, i) => v + camM[i] * 0.6 + (i === 2 ? 0.8 : 0)));

const bricks = [];
// solid test in a piece's local frame scaled to [-1, 1] (orient.mjs notes)
const SOLID = {
  PB_DefaultMicroWedge: (x, y) => x + y <= 0,
  PB_DefaultMicroWedgeOuterCorner: (x, y, z) => x + y + z >= -1,
  PB_DefaultMicroWedgeCorner: (x, y, z) => x + y + z <= -1,
};
const take = b => {
  const [lo, hi] = worldBox(b, FIXED);
  if (hi[0] < CX - HF || lo[0] > CX + HF || hi[1] < CY - HF || lo[1] > CY + HF || hi[2] < +zMin) return;
  if (b.visibility === false) return;
  const solid = SOLID[b.asset];
  if (!solid) { bricks.push([lo, hi, b.color ?? [128, 128, 128], b.material]); return; }
  // wedge pieces: the solid subcells of an n^3 split, so slopes read as slopes
  const n = 4, s = b.size, o = ORIENT[(b.direction ?? 4) * 4 + (b.rotation ?? 0)];
  const hw = [0, 1, 2].map(a => (hi[a] - lo[a]) / (2 * n));
  for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) for (let d = 0; d < n; d++) {
    const l = [a, c, d].map(q => (2 * q + 1) / n - 1);
    if (!solid(...l)) continue;
    const w = o([l[0] * s[0], l[1] * s[1], l[2] * s[2]]);
    const ctr = w.map((v, i) => b.position[i] + v);
    bricks.push([ctr.map((v, i) => v - hw[i]), ctr.map((v, i) => v + hw[i]), b.color ?? [128, 128, 128], b.material, true]);
  }
};
if (src.endsWith('.json') && fs.statSync(src).isFile()) {
  const j = JSON.parse(fs.readFileSync(src, 'utf8'));
  for (const b of j.bricks ?? j) take(b);
} else {
  for (const f of fs.readdirSync(src).filter(f => /^chunk_\d+\.json$/.test(f)))
    for (const op of JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')).ops) if (op.op === 'bricks') for (const b of op.bricks) take(b);
}
// screen bounds
let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
const proj = p => { const q = mir(p); return [dot(q, right) / U, -dot(q, up) / U, dot(q, camM)]; };
for (const [lo, hi] of bricks) for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
  const [u, v] = proj([x, y, z]); sx0 = Math.min(sx0, u); sx1 = Math.max(sx1, u); sy0 = Math.min(sy0, v); sy1 = Math.max(sy1, v);
}
const W = Math.min(2400, Math.ceil(sx1 - sx0) + 4), H = Math.min(2400, Math.ceil(sy1 - sy0) + 4);
const zb = new Float32Array(W * H).fill(-1e12), rgb = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) rgb.set([150, 190, 225], i * 3);
function face(p0, e1, e2, n, color, mat, sub) {
  const nm = mir(n);
  if (dot(nm, camM) <= 0) return;
  const k = 0.45 + 0.6 * Math.max(0, dot(nm, light)) + (mat === 'BMC_Glow' ? 0.5 : 0);
  const c = color.map(v => Math.min(255, Math.round(v * k)));
  const P = proj(p0), A1 = proj(p0.map((v, i) => v + e1[i])), A2 = proj(p0.map((v, i) => v + e2[i]));
  const a = [A1[0] - P[0], A1[1] - P[1]], b = [A2[0] - P[0], A2[1] - P[1]], det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-9) return;
  const us = [P[0], A1[0], A2[0], A1[0] + b[0]], vs = [P[1], A1[1], A2[1], A1[1] + b[1]];
  const i0 = Math.max(0, Math.floor(Math.min(...us) - sx0)), i1 = Math.min(W - 1, Math.ceil(Math.max(...us) - sx0));
  const j0 = Math.max(0, Math.floor(Math.min(...vs) - sy0)), j1 = Math.min(H - 1, Math.ceil(Math.max(...vs) - sy0));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const du = i + sx0 + 0.5 - P[0], dv = j + sy0 + 0.5 - P[1];
    const s = (du * b[1] - dv * b[0]) / det, t = (a[0] * dv - a[1] * du) / det;
    if (s < -0.001 || s > 1.001 || t < -0.001 || t > 1.001) continue;
    const d = P[2] + s * (A1[2] - P[2]) + t * (A2[2] - P[2]), n2 = j * W + i;
    if (d <= zb[n2]) continue;
    zb[n2] = d;
    // dark edge lines so courses read
    const edge = !sub && Math.min(s * Math.hypot(...a), (1 - s) * Math.hypot(...a), t * Math.hypot(...b), (1 - t) * Math.hypot(...b)) < 0.5;
    rgb.set(edge ? c.map(v => v * 0.8) : c, n2 * 3);
  }
}
for (const [lo, hi, color, mat, sub] of bricks) {
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi, dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1], color, mat, sub);
  face([x0, y0, z0], [dx, 0, 0], [0, dy, 0], [0, 0, -1], color, mat, sub);
  face([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], color, mat, sub);
  face([x0, y1, z0], [dx, 0, 0], [0, 0, dz], [0, 1, 0], color, mat, sub);
  face([x0, y0, z0], [0, dy, 0], [0, 0, dz], [-1, 0, 0], color, mat, sub);
  face([x1, y0, z0], [0, dy, 0], [0, 0, dz], [1, 0, 0], color, mat, sub);
}
const img = Buffer.alloc((W * 3 + 1) * H);
for (let j = 0; j < H; j++) Buffer.from(rgb.buffer, j * W * 3, W * 3).copy(img, j * (W * 3 + 1) + 1);
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = ~0; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; }; })();
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, W + 'x' + H, bricks.length, 'bricks');
