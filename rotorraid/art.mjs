// rotorraid/art.mjs: build-time art for ROTOR RAID. Everything (island map and sprites) is ray-marched through a 2:1
// isometric camera from solid() / mat() functions, so it comes out as shaded volumes (lit tops, mid -X faces, dark -Y
// faces), then quantised to one palette and run-length encoded per row for the wirescript channels.
// Projection (tile units, Z up): ix = (X - Y) * sc + ox, iy = (X + Y) * sc / 2 - Z * sc + oy.

const SHADE = { top: 1, x: 0.8, y: 0.6 };
export function render({ w, h, ox, oy, sc, zmax, zmin = 0, dz, solid, mat, bg = null }) {
  const px = new Array(w * h).fill(bg);
  for (let iy = 0; iy < h; iy++) for (let ix = 0; ix < w; ix++) {
    const a = (ix + 0.5 - ox) / sc, b = (iy + 0.5 - oy) * 2 / sc;
    for (let Z = zmax; Z >= zmin - 1e-9; Z -= dz) {
      const X = (a + b) / 2 + Z, Y = (b - a) / 2 + Z;
      if (!solid(X, Y, Z)) continue;
      const face = !solid(X, Y, Z + dz) ? 'top' : !solid(X - dz, Y, Z) ? 'x' : 'y';
      const c = mat(X, Y, Z, face);
      if (c) px[iy * w + ix] = c.map(v => Math.max(0, Math.min(255, Math.round(v * SHADE[face]))));
      break;
    }
  }
  return px;
}
// palette: colours rounded to 8 steps, shared by map and sprites
export function makePalette() {
  const list = [], index = new Map();
  const id = c => { const q = c.map(v => Math.min(255, Math.round(v / 8) * 8)); const k = q.join(','); if (!index.has(k)) { index.set(k, list.length); list.push(q); } return index.get(k); };
  return { list, id, hex: () => list.map(c => c.map(v => v.toString(16).padStart(2, '0')).join('')) };
}
// rows of palette ids -> spans [x0, x1, c] per row (null pixels skipped)
export function spans(px, w, h, pal) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const r = [];
    for (let x = 0; x < w;) {
      const c = px[y * w + x]; if (c == null) { x++; continue; }
      const k = pal.id(c); let e = x + 1;
      while (e < w && px[y * w + e] != null && pal.id(px[y * w + e]) === k) e++;
      r.push([x, e, k]); x = e;
    }
    rows.push(r);
  }
  return rows;
}
// crop a sprite render to its bounding box; anchor = where model origin (0,0,0) projects
export function crop(px, w, h, ax, ay) {
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x] != null) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
  if (x1 <= x0) return { px: [], w: 0, h: 0, ax: 0, ay: 0 };
  const W = x1 - x0, H = y1 - y0, out = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out.push(px[y * w + x]);
  return { px: out, w: W, h: H, ax: ax - x0, ay: ay - y0 };
}
// a small seeded hash for texture variation
export const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
