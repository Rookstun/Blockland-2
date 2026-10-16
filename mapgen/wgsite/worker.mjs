// Terrain preview worker: one terrain() pass per message.
import { terrain } from './terrain.mjs';

onmessage = ({ data: { gen, seed, scale, vals, step, tail } }) => {
  const t0 = performance.now();
  try {
    const get = k => { if (!(k in vals)) throw new Error(`missing setting ${k}`); return vals[k]; };
    const T = terrain({ seed, scale, get, step, tail, layers: true });
    const res = { gen, step, w: T.w, N: T.N, SEA: T.SEA, H: T.H, TU: T.TU, base: T.F.base, mask: T.F.mask, ridge: T.F.ridge, coast: T.F.coast, ms: performance.now() - t0 };
    postMessage(res, [T.H.buffer, T.TU.buffer, T.F.base.buffer, T.F.mask.buffer, T.F.ridge.buffer, T.F.coast.buffer]);
  } catch (e) {
    postMessage({ gen, step, error: String(e.message || e) });
  }
};
