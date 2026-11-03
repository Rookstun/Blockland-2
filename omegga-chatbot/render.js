// Picture of a build for the model to critique before it is placed: two
// orthographic 3D views (front-left as the player sees it, back-right) side
// by side, flat-shaded and outlined, on a 1-stud checker ground with a
// player figure at the origin for scale. Bricks are shapes.js bricks
// (studs for x/y/w/l, plates for z/h). Returns a PNG Buffer.
// shortcut: ramps and wedges draw as full boxes; slope them if the model
// starts misjudging ramps from the pictures.

const zlib = require('zlib');

const VIEW = 512; // pixels per view
const STUD = 10, PLATE = 4; // world units, so a stud is 2.5 plates wide

const hex = c => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c ?? '').trim());
  const n = m ? parseInt(m[1], 16) : 0xcccccc;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(a => a / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** World boxes [min, max, rgb, flags] for the bricks, the ground and the player figure. */
function boxes(bricks) {
  const out = bricks.map(b => [
    [b.x * STUD, b.y * STUD, b.z * PLATE],
    [(b.x + b.w) * STUD, (b.y + b.l) * STUD, (b.z + b.h) * PLATE],
    hex(b.color),
    { glow: b.material === 'glow', glass: b.material === 'glass' },
  ]);
  // player: blue body, skin head, 2 studs wide and 15 plates tall
  out.push([[-1 * STUD, -1 * STUD, 0], [1 * STUD, 1 * STUD, 11 * PLATE], [60, 90, 200], { figure: true }]);
  out.push([[-0.8 * STUD, -0.8 * STUD, 11 * PLATE], [0.8 * STUD, 0.8 * STUD, 15 * PLATE], [240, 200, 160], { figure: true }]);
  return out;
}

function renderView(list, lo, hi, azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const toCam = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const fwd = toCam.map(v => -v);
  const right = norm(cross(fwd, [0, 0, 1]));
  const up = cross(right, fwd);
  const light = norm([toCam[0] * 0.5 - right[0] * 0.5, toCam[1] * 0.5 - right[1] * 0.5, 1]);

  // fit the scene's bounding box corners into the view
  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const p = [x, y, z], u = dot(p, right), v = dot(p, up);
    sx0 = Math.min(sx0, u); sx1 = Math.max(sx1, u); sy0 = Math.min(sy0, v); sy1 = Math.max(sy1, v);
  }
  const scale = (VIEW * 0.9) / Math.max(sx1 - sx0, sy1 - sy0, 1);
  const ox = VIEW / 2 - ((sx0 + sx1) / 2) * scale, oy = VIEW / 2 + ((sy0 + sy1) / 2) * scale;
  const proj = p => [dot(p, right) * scale + ox, oy - dot(p, up) * scale, dot(p, fwd)];

  const rgb = new Float32Array(VIEW * VIEW * 3);
  const depth = new Float32Array(VIEW * VIEW).fill(Infinity);
  const face = new Int32Array(VIEW * VIEW).fill(-1);
  for (let y = 0; y < VIEW; y++) {
    const t = y / VIEW; // sky gradient
    for (let x = 0; x < VIEW; x++) rgb.set([200 - 40 * t, 220 - 30 * t, 245 - 20 * t], (y * VIEW + x) * 3);
  }

  let faceId = 0;
  const tri = (a, b, c, col, id, alpha) => {
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(VIEW - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(VIEW - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (!area) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const d = w0 * a[2] + w1 * b[2] + w2 * c[2];
        const i = y * VIEW + x;
        if (d >= depth[i]) continue;
        if (alpha < 1) { // glass: blend, keep what is behind for outlines
          for (let k = 0; k < 3; k++) rgb[i * 3 + k] = rgb[i * 3 + k] * (1 - alpha) + col[k] * alpha;
          continue;
        }
        depth[i] = d; face[i] = id;
        rgb.set(col, i * 3);
      }
  };
  // opaque first, glass after so it blends over what is behind it
  const order = [...list].sort((p, q) => !!p[3].glass - !!q[3].glass);
  for (const [mn, mx, col, flags] of order) {
    for (let axis = 0; axis < 3; axis++)
      for (const side of [0, 1]) {
        const n = [0, 0, 0]; n[axis] = side ? 1 : -1;
        if (dot(n, fwd) >= 0) continue; // back face
        const [u, v] = [0, 1, 2].filter(k => k !== axis);
        const corner = (cu, cv) => {
          const p = [0, 0, 0];
          p[axis] = side ? mx[axis] : mn[axis];
          p[u] = cu ? mx[u] : mn[u];
          p[v] = cv ? mx[v] : mn[v];
          return proj(p);
        };
        const shade = flags.glow ? 1 : 0.45 + 0.55 * Math.max(0, dot(n, light));
        const c = col.map(k => Math.min(255, k * shade));
        const id = faceId++;
        const alpha = flags.glass ? 0.45 : 1;
        const [p00, p10, p11, p01] = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
        tri(p00, p10, p11, c, id, alpha);
        tri(p00, p11, p01, c, id, alpha);
      }
  }
  // outlines where one face meets another (or the sky)
  const out = Buffer.alloc(VIEW * VIEW * 3);
  for (let y = 0; y < VIEW; y++)
    for (let x = 0; x < VIEW; x++) {
      const i = y * VIEW + x, f = face[i];
      const edge = f >= 0 && ((x + 1 < VIEW && face[i + 1] !== f) || (y + 1 < VIEW && face[i + VIEW] !== f));
      const k = edge ? 0.55 : 1;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[i * 3 + c] * k);
    }
  return out;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = buf => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** PNG of the bricks: left = front-left (the player's side, -x), right = back-right. */
function render(bricks) {
  const list = boxes(bricks);
  const lo = [Infinity, Infinity, 0], hi = [-Infinity, -Infinity, -Infinity];
  for (const [mn, mx] of list) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], mn[k]); hi[k] = Math.max(hi[k], mx[k]); }
  // checker ground, 1 stud squares, 3 studs past the build (coarser on huge builds)
  const pad = 3 * STUD;
  const gx0 = Math.floor((lo[0] - pad) / STUD), gx1 = Math.ceil((hi[0] + pad) / STUD);
  const gy0 = Math.floor((lo[1] - pad) / STUD), gy1 = Math.ceil((hi[1] + pad) / STUD);
  const cell = Math.max(1, Math.ceil(Math.max(gx1 - gx0, gy1 - gy0) / 120));
  for (let i = gx0; i < gx1; i += cell)
    for (let j = gy0; j < gy1; j += cell)
      list.unshift([[i * STUD, j * STUD, -PLATE], [(i + cell) * STUD, (j + cell) * STUD, 0], ((i + j) / cell) & 1 ? [150, 170, 140] : [165, 185, 155], {}]);
  lo[0] = gx0 * STUD; lo[1] = gy0 * STUD; hi[0] = gx1 * STUD; hi[1] = gy1 * STUD; lo[2] = -PLATE;
  const a = renderView(list, lo, hi, 180 + 35, 28); // camera at -x, +y side: in front of the player, a bit to their left
  const b = renderView(list, lo, hi, 35, 28); // the opposite corner
  const rgb = Buffer.alloc(VIEW * 2 * VIEW * 3);
  for (let y = 0; y < VIEW; y++) {
    a.copy(rgb, y * VIEW * 6, y * VIEW * 3, (y + 1) * VIEW * 3);
    b.copy(rgb, y * VIEW * 6 + VIEW * 3, y * VIEW * 3, (y + 1) * VIEW * 3);
    for (let c = 0; c < 3; c++) rgb[y * VIEW * 6 + VIEW * 3 + c] = 40; // divider
  }
  return png(VIEW * 2, VIEW, rgb);
}

module.exports = { render };
