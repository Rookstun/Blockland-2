// Browser port of mapgen.mjs's bare heightmap (noise, island spine + tail,
// terrain section), so the site previews terrain edits instantly. Must stay
// in step with mapgen.mjs lines ~75-360: `node mapgen/wgsite/verify.mjs` compares it
// with `mapgen.mjs --preview-height` cell for cell.
//
// terrain({ seed, scale, get, step, tail, layers }) -> { N, w, X0, Y0, SEA, H, ... }
//   get(key) = the tunable's value (override or default, before any x K)
//   step: sample every step-th cell (1 = exact)
//   tail: merge the tail's ground where it is higher (mapgen does this later, before the volcano)
//   layers: also return base / mask / ridge / coast fields (Float32, per sample)

export const CELL = 40, VZ = 12, NZ = 170, TOWN_CELLS = 130;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(seed) {
  const R = rng(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const G3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const GX = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][0]);
  const GY = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][1]);
  const GZ = Int8Array.from({ length: 512 }, (_, i) => G3[perm[i] % 12][2]);
  const gd = (h, dx, dy, dz) => GX[h] * dx + GY[h] * dy + GZ[h] * dz;
  function noise3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const p0 = perm[zi], p1 = perm[zi + 1];
    const a00 = perm[yi + p0], a10 = perm[yi + 1 + p0], a01 = perm[yi + p1], a11 = perm[yi + 1 + p1];
    const u = fade(x), v = fade(y), w = fade(z);
    return lerp(
      lerp(lerp(gd(xi + a00, x, y, z), gd(xi + 1 + a00, x - 1, y, z), u), lerp(gd(xi + a10, x, y - 1, z), gd(xi + 1 + a10, x - 1, y - 1, z), u), v),
      lerp(lerp(gd(xi + a01, x, y, z - 1), gd(xi + 1 + a01, x - 1, y, z - 1), u), lerp(gd(xi + a11, x, y - 1, z - 1), gd(xi + 1 + a11, x - 1, y - 1, z - 1), u), v),
      w
    );
  }
  const noise2 = (x, y) => noise3(x, y, 0.5);
  function fbm2(x, y, oct = 5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  function ridged2(x, y, oct = 5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) {
      const r = 1 - Math.abs(noise2(x * f + 17.3 * i, y * f - 9.1 * i));
      s += a * r * r; n += a; a *= 0.5; f *= 2.1;
    }
    return s / n;
  }
  return { noise2, fbm2, ridged2, lerp };
}

export const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** map frame + island spine, shared by the preview and the overlay */
export function island(scale, get) {
  const K = scale;
  const N = 2 * Math.round((576 * K) / 2);
  const X0 = 2900 - N * CELL, Y0 = 4900 - N * CELL;
  const TOWN_PIN = { fx: Math.round(237 * K) - 65, fy: Math.round(261 * K) - 65, h: 47 };
  const ISL = {
    spine: get('island.spine').map(([a, b]) => [a * K, b * K]),
    half: get('island.half').map(h => h * K),
    tail: get('island.tail').map(([a, b]) => [a * K, b * K]),
    tailHalf: get('island.tailHalf').map(h => h * K),
  };
  const tcx = TOWN_PIN.fx + TOWN_CELLS / 2, tcy = TOWN_PIN.fy + TOWN_CELLS / 2;
  const P = ISL.spine.map(([a, b]) => [tcx + a, tcy + b]);
  const pts = [];
  let s = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const seg = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]), n = Math.ceil(seg / 2);
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      const x = cr(0), y = cr(1);
      if (pts.length) s += Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]);
      pts.push([x, y, s, ISL.half[i] + (ISL.half[i + 1] - ISL.half[i]) * f]);
    }
  }
  pts.push([...P[P.length - 1], s + 1, ISL.half[ISL.half.length - 1]]);
  const sTown = pts.reduce((b, p) => (Math.hypot(p[0] - tcx, p[1] - tcy) < Math.hypot(b[0] - tcx, b[1] - tcy) ? p : b))[2];
  const L = pts[pts.length - 1][2], tail = [pts[pts.length - 1]];
  const E = P[P.length - 1], T = [E, ...ISL.tail.map(([a, b]) => [E[0] + a, E[1] + b])], TH = [ISL.half[ISL.half.length - 1], ...ISL.tailHalf];
  let st = L;
  for (let i = 0; i + 1 < T.length; i++) {
    const seg = Math.hypot(T[i + 1][0] - T[i][0], T[i + 1][1] - T[i][1]), n = Math.ceil(seg / 2);
    for (let k = i ? 0 : 1; k <= (i + 2 === T.length ? n : n - 1); k++) {
      const f = k / n;
      const p0 = i ? T[i - 1] : P[P.length - 2], p1 = T[i], p2 = T[i + 1], p3 = T[Math.min(T.length - 1, i + 2)];
      const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      const x = cr(0), y = cr(1), q = tail[tail.length - 1];
      st += Math.hypot(x - q[0], y - q[1]);
      tail.push([x, y, st, TH[i] + (TH[i + 1] - TH[i]) * f]);
    }
  }
  const spine = { pts, L, sTown, tail, LT: st };
  const spineAt = (t, off = 0) => {
    const s2 = spine.sTown + t * (spine.L - spine.sTown);
    const i = Math.max(1, spine.pts.findIndex(p => p[2] >= s2));
    const a = spine.pts[i - 1], b = spine.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [b[0] + ((b[1] - a[1]) / len) * off, b[1] - ((b[0] - a[0]) / len) * off];
  };
  return { K, N, X0, Y0, TOWN_PIN, tcx, tcy, P, T, ISL, spine, spineAt };
}

export function terrain({ seed, scale, get, step = 1, tail = true, layers = false }) {
  const I = island(scale, get);
  const { K, N, X0, Y0, spine, spineAt } = I;
  const { fbm2, ridged2, lerp } = makeNoise(seed);
  const SEA = get('sea');
  const deepAnchor = spineAt(get('deep.t'), get('deep.off') * K);
  const TER = {};
  for (const k of ['baseH', 'baseAmp', 'baseScale', 'maskScale', 'ridgeScale', 'ridgePow', 'mountainAmp', 'wildStart', 'wildMax',
    'deepR', 'deepIn', 'coastNoise', 'coastScale', 'coastFit', 'oceanStart', 'oceanEnd', 'oceanFloor']) TER[k] = get('terrain.' + k);
  const w = Math.ceil(N / step);
  const H = new Int16Array(w * w), TU = new Float32Array(w * w).fill(-1);
  const F = layers ? { base: new Float32Array(w * w), mask: new Float32Array(w * w), ridge: new Float32Array(w * w), coast: new Float32Array(w * w) } : null;
  const pts = spine.pts, tl = spine.tail;
  for (let gy = 0; gy < w; gy++)
    for (let gx = 0; gx < w; gx++) {
      const x = gx * step, y = gy * step, o = gy * w + gx;
      const wx = X0 + x * CELL, wy = Y0 + y * CELL;
      let sp = pts[0], bd = Infinity;
      for (const p of pts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; sp = p; } }
      const sd = Math.sqrt(bd);
      const cn = fbm2(wx / TER.coastScale + 40, wy / TER.coastScale, 3) * TER.coastNoise;
      const r = (sd / sp[3]) * TER.coastFit + cn;
      const up = Math.max(0, Math.min(1, (sp[2] - spine.sTown) / (spine.L - spine.sTown)));
      const base = TER.baseH + fbm2(wx / TER.baseScale, wy / TER.baseScale) * TER.baseAmp;
      let mask = smooth(-0.15, 0.2, fbm2(wx / TER.maskScale + 100, wy / TER.maskScale - 50, 3));
      const dm = Math.hypot(x - deepAnchor[0], y - deepAnchor[1]);
      mask = Math.max(mask, smooth(TER.deepR * K, TER.deepIn * K, dm));
      mask = Math.max(mask, smooth(TER.wildStart, 1, up) * TER.wildMax);
      const rg = Math.pow(ridged2(wx / TER.ridgeScale, wy / TER.ridgeScale), TER.ridgePow);
      let h = base + mask * rg * TER.mountainAmp;
      h = lerp(h, TER.oceanFloor, smooth(TER.oceanStart, TER.oceanEnd, r));
      let hv = Math.max(4, Math.min(NZ - 8, Math.round(h)));
      let tp = null, td = sd * sd;
      for (const q of tl) { const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < td) { td = d; tp = q; } }
      let rr = r, mm = mask;
      if (tp) {
        const tu = (tp[2] - spine.L) / (spine.LT - spine.L);
        const rt = (Math.sqrt(td) / tp[3]) * TER.coastFit + cn;
        const tmask = Math.max(mask, TER.wildMax) * (1 - 0.75 * smooth(0.12, 0.35, tu));
        let ht = base + tmask * rg * TER.mountainAmp;
        ht = lerp(ht, TER.oceanFloor, smooth(TER.oceanStart, TER.oceanEnd, rt));
        const htv = Math.max(4, Math.min(NZ - 8, Math.round(ht)));
        TU[o] = tu;
        if (tail && htv > hv) { hv = htv; rr = rt; mm = tmask; }
      }
      H[o] = hv;
      if (F) { F.base[o] = base; F.mask[o] = mm; F.ridge[o] = rg; F.coast[o] = rr; }
    }
  return { ...I, SEA, step, w, H, TU, F, deepAnchor };
}
