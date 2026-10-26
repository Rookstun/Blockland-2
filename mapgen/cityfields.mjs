// City fields (2026-10-26, owner: "a set of noise that determines the income of the area (for real estate:
// bigger houses are more expensive), population (urban / suburb / rural) and a triangle for industrial,
// residential and commercial zoning"). Seeded fbm value noise sampled in world units:
//   income(x, y)   0..1  lot width, house type (Dutch colonial = the big one), real estate price
//   pop(x, y)      0..1  a downtown falloff + noise; density(x, y) -> 'urban' | 'suburb' | 'rural'
//   zone(x, y)     {r, c, i} barycentric weights (sum 1) + kind = the largest corner of the R/C/I triangle;
//                  commercial leans on population, industrial on low income, residential is the base
//   price(...)     coins for a lot: land (lot area) + floor area of its house, x income, x population
import { rng } from './builder.mjs';

const smooth = t => t * t * (3 - 2 * t);
function valueNoise(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
    const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/** 0..1 fbm, wavelength `wl` units for the first octave */
function fbm(seed, wl, oct = 4) {
  const ns = Array.from({ length: oct }, (_, i) => valueNoise(seed * 31 + i * 7919));
  return (x, y) => { let s = 0, a = 1, f = 1 / wl, t = 0; for (const n of ns) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2; } return s / t; };
}
// fbm bunches round 0.5: stretch it back over 0..1
const spread = v => Math.min(1, Math.max(0, (v - 0.5) * 2.2 + 0.5));

export const DENSITY = { urban: 0.62, suburb: 0.3 }; // pop >= urban -> urban, >= suburb -> suburb, else rural

export function cityFields(seed, extent) {
  const [x0, y0, x1, y1] = extent, W = x1 - x0, H = y1 - y0, wl = Math.max(W, H) * 0.6;
  const r = rng(seed * 7 + 11);
  // downtown somewhere in the middle third; population falls off from it, noise breaks the rings up
  const dc = [x0 + W * (0.33 + r() * 0.34), y0 + H * (0.33 + r() * 0.34)], R = Math.hypot(W, H) * 0.42;
  const nPop = fbm(seed + 1, wl), nInc = fbm(seed + 2, wl * 0.8), nR = fbm(seed + 3, wl * 0.45), nC = fbm(seed + 4, wl * 0.45), nI = fbm(seed + 5, wl * 0.45);
  const pop = (x, y) => Math.min(1, Math.max(0, 0.85 * (1 - Math.hypot(x - dc[0], y - dc[1]) / R) + 0.5 * (spread(nPop(x, y)) - 0.5) + 0.05));
  const income = (x, y) => spread(nInc(x, y));
  const density = (x, y) => { const p = pop(x, y); return p >= DENSITY.urban ? 'urban' : p >= DENSITY.suburb ? 'suburb' : 'rural'; };
  const zone = (x, y) => {
    const p = pop(x, y), inc = income(x, y), k = 6;
    const w = {
      r: Math.exp(k * (spread(nR(x, y)) + 0.12)),
      c: Math.exp(k * (spread(nC(x, y)) + 0.5 * p - 0.3)),
      i: Math.exp(k * (spread(nI(x, y)) + 0.35 * (1 - inc) - 0.2)),
    };
    const s = w.r + w.c + w.i, z = { r: w.r / s, c: w.c / s, i: w.i / s };
    z.kind = z.r >= z.c && z.r >= z.i ? 'residential' : z.c >= z.i ? 'commercial' : 'industrial';
    return z;
  };
  /** lot price in coins: lot w x d units, house floor area in studs^2 (0 = empty lot) */
  const price = (x, y, w, d, floor, kind) => {
    const land = (w / 10) * (d / 10) * ({ residential: 0.3, commercial: 0.45, industrial: 0.22 }[kind] ?? 0.3);
    return Math.round((land + floor * 0.6) * (0.5 + 1.5 * income(x, y)) * (0.7 + 0.6 * pop(x, y)) / 50) * 50;
  };
  return { downtown: dc, pop, income, density, zone, price };
}
