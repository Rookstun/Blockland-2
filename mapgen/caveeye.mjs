// First-person look inside a cave (2026-10-16): ray casts a brick list (mapgen CAVE_DUMP, or any
// chunk JSON) from a point, lit by a lamp at the eye (plus glow bricks), writes a PNG. Rays that hit
// nothing show as dark rock (the coarse terrain is not in the dump).
//   node mapgen/caveeye.mjs bricks.json X Y Z yawDeg pitchDeg out.png [w=480] [h=300] [fov=95]
// yaw: compass direction the eye looks (0 = +x, 90 = +y). Mirrored like the game (left-handed).
import fs from 'fs';
import zlib from 'zlib';
import { worldBox, ORIENT } from './orient.mjs';
import { FIXED } from './builder.mjs';

const [src, X, Y, Z, yaw, pitch, out, W = 480, Hh = 300, fov = 95] = process.argv.slice(2);
const E = [+X, +Y, +Z], w = +W, h = +Hh, R = 1600, G = 40;
const SOLID = {
  PB_DefaultMicroWedge: (x, y) => x + y <= 0,
  PB_DefaultMicroWedgeOuterCorner: (x, y, z) => x + y + z >= -1,
  PB_DefaultMicroWedgeCorner: (x, y, z) => x + y + z <= -1,
};
const boxes = []; // [lo, hi, color, glow]
const j = JSON.parse(fs.readFileSync(src, 'utf8'));
const list = Array.isArray(j) ? j : j.bricks ?? j.ops.flatMap(o => o.bricks ?? []);
for (const b of list) {
  const [lo, hi] = worldBox(b, FIXED);
  if (hi[0] < E[0] - R || lo[0] > E[0] + R || hi[1] < E[1] - R || lo[1] > E[1] + R || hi[2] < E[2] - R || lo[2] > E[2] + R) continue;
  if (b.visibility === false) continue;
  const glow = b.material === 'BMC_Glow', col = b.color ?? [128, 128, 128];
  const solid = SOLID[b.asset];
  if (!solid) { boxes.push([lo, hi, col, glow]); continue; }
  const n = 6, s = b.size, o = ORIENT[(b.direction ?? 4) * 4 + (b.rotation ?? 0)];
  const hw = [0, 1, 2].map(a => (hi[a] - lo[a]) / (2 * n));
  for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) for (let d = 0; d < n; d++) {
    const l = [a, c, d].map(q => (2 * q + 1) / n - 1);
    if (!solid(...l)) continue;
    const wv = o([l[0] * s[0], l[1] * s[1], l[2] * s[2]]), ctr = wv.map((v, i) => b.position[i] + v);
    boxes.push([ctr.map((v, i) => v - hw[i]), ctr.map((v, i) => v + hw[i]), col, glow]);
  }
}
// uniform grid
const grid = new Map(), key = (a, b, c) => `${a},${b},${c}`;
boxes.forEach((bx, k) => {
  for (let a = Math.floor(bx[0][0] / G); a <= Math.floor((bx[1][0] - 1e-6) / G); a++)
    for (let b = Math.floor(bx[0][1] / G); b <= Math.floor((bx[1][1] - 1e-6) / G); b++)
      for (let c = Math.floor(bx[0][2] / G); c <= Math.floor((bx[1][2] - 1e-6) / G); c++) { const kk = key(a, b, c); (grid.get(kk) ?? grid.set(kk, []).get(kk)).push(k); }
});
const lights = boxes.filter(b => b[3]).map(b => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2, b[2]]);
function cast(o, d, maxT = 2 * R) {
  let cell = o.map(v => Math.floor(v / G));
  const step = d.map(v => (v > 0 ? 1 : -1)), tD = d.map(v => Math.abs(G / (v || 1e-9)));
  let tM = o.map((v, i) => { const nb = (cell[i] + (d[i] > 0 ? 1 : 0)) * G; return (nb - v) / (d[i] || 1e-9); });
  let t0 = 0;
  for (let it = 0; it < 400 && t0 < maxT; it++) {
    const ids = grid.get(key(...cell));
    let best = null;
    if (ids) for (const k of ids) {
      const [lo, hi] = boxes[k];
      let tn = -Infinity, tf = Infinity, ax = -1;
      for (let i = 0; i < 3; i++) {
        let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
        if (a > b) [a, b] = [b, a];
        if (a > tn) { tn = a; ax = i; }
        tf = Math.min(tf, b);
      }
      if (tn <= tf && tf > 1e-6 && tn > 1e-6 && (!best || tn < best.t)) best = { t: tn, k, ax };
    }
    const tNext = Math.min(...tM);
    if (best && best.t <= tNext + 1e-6) return best;
    const i = tM.indexOf(tNext);
    cell[i] += step[i]; t0 = tNext; tM[i] += tD[i];
  }
  return null;
}
const yw = (+yaw * Math.PI) / 180, pt = (+pitch * Math.PI) / 180, f = Math.tan(((+fov / 2) * Math.PI) / 180);
const fwd = [Math.cos(pt) * Math.cos(yw), Math.cos(pt) * Math.sin(yw), Math.sin(pt)];
const rt = [Math.sin(yw), -Math.cos(yw), 0]; // left-handed world: screen right
const up = [rt[1] * fwd[2] - rt[2] * fwd[1], rt[2] * fwd[0] - rt[0] * fwd[2], rt[0] * fwd[1] - rt[1] * fwd[0]].map(v => -v);
const img = Buffer.alloc(w * h * 3);
for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
  const u = ((px + 0.5) / w * 2 - 1) * f, v = (1 - (py + 0.5) / h * 2) * f * (h / w);
  let d = [0, 1, 2].map(i => fwd[i] + rt[i] * u + up[i] * v); const l = Math.hypot(...d); d = d.map(q => q / l);
  const hit = cast(E, d);
  let c = [30, 28, 26];
  if (hit) {
    const [, , col, glow] = boxes[hit.k], p = E.map((q, i) => q + d[i] * hit.t);
    const nrm = [0, 0, 0]; nrm[hit.ax] = d[hit.ax] > 0 ? -1 : 1;
    if (glow) c = col;
    else {
      // lamp at the eye (soft falloff) + glow bricks within 400
      let li = Math.max(0, -(nrm[0] * d[0] + nrm[1] * d[1] + nrm[2] * d[2])) * Math.min(1, 260000 / (hit.t * hit.t + 1e4)) * 0.9 + 0.12;
      const add = [0, 0, 0];
      for (const [lx, ly, lz, lc] of lights) {
        const L = [lx - p[0], ly - p[1], lz - p[2]], dd = Math.hypot(...L);
        if (dd > 400) continue;
        const k = Math.max(0, (nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2]) / dd) * 2000 / (dd * dd + 2000) * 2;
        for (let i = 0; i < 3; i++) add[i] += k * lc[i] / 255;
      }
      c = col.map((q, i) => Math.min(255, q * (li + add[i])));
    }
  }
  img.set(c.map(Math.round), (py * w + px) * 3);
}
// png
const crc = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; img.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, `${boxes.length} boxes`);
