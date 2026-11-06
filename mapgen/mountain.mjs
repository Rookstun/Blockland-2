// Kraken's mountain (2026-11-06): "a realistic looking mountain that is difficult to climb ... wide and long and high
// enough for 100 jumps. Randomize how to jump, which direction, how high, how far, whether I should crouch".
// Body: an elongated peak (ellipse, ridge noise) built from 2-stud columns, each stepped down to its lowest neighbour
// with a micro wedge rising toward the higher one (smooth slopes), rock -> scree -> snow by height.
// Route: 100 rock ledges spiralling up the face (added FIRST, so the body gives way around them). Per jump, random:
// direction (each ledge swings in or out from the face by up to 3 studs, so jumps go left, right, in and out;
// reversing the spiral folded the path onto itself), rise 0..20 (never more than ~1.5 bricks), edge gap 24..48 (2.4..4.8 studs), ledge size,
// and every few jumps a long CROUCH ledge under a rock roof 44 above its floor (player 60 tall: crouch to pass).
// node mapgen/mountain.mjs X Y Z [SEED] > job.json
import { makeBuilder, rng } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, SEED = 31] = process.argv.slice(2).map(Number);
const OWNER = { id: `c1a0de00-0000-4b0b-9a11-${String(7000 + SEED).padStart(12, '0')}`, name: `Claude Mountain ${SEED}`, display_name: `Claude Mountain ${SEED}` };
const B = makeBuilder({ cell: 200 });
const rand = rng(SEED);
const MB = 'PB_DefaultMicroBrick';
const RX = 1000, RY = 700, HT = 1560, CELL = 20, P = 1.35, JUMPS = 100;
const snap = (v, g) => Math.round(v / g) * g;
// ridge noise: a few low-frequency waves so the outline and the slope are not a perfect cone
const waves = Array.from({ length: 5 }, () => ({ k: 2 + Math.floor(rand() * 5), ph: rand() * 6.28, amp: 0.025 + rand() * 0.04 }));
const wob = a => 1 + waves.reduce((s, w) => s + w.amp * Math.sin(w.k * a + w.ph), 0);
const height = (x, y) => {
  const a = Math.atan2(y / RY, x / RX), d = Math.hypot(x / RX, y / RY) / wob(a);
  return d >= 1 ? 0 : HT * Math.pow(1 - d, P);
};
// distance factor of the surface at height z, along angle a (inverse of height())
const surfD = (z, a) => (1 - Math.pow(Math.min(z / HT, 1), 1 / P)) * wob(a);

// ---- route ----
const LEDGE = c => ({ asset: MB, color: c });
const ROUTE = [[120, 110, 100], [135, 122, 108], [110, 100, 92]], ROOF = { asset: MB, color: [90, 86, 80] };
let a = rand() * 6.28, dir = 1, z = 0, run = 0, crouches = 0;
const ledges = [];
for (let k = 0; k <= JUMPS; k++) {
  const crouch = k > 3 && k < JUMPS && k % 7 === 3; // every 7th: a crouch tunnel
  const half = crouch ? 10 : k === 0 || k === JUMPS ? 30 : 6 + Math.floor(rand() * 7) * 2; // 6..18 half; start/summit wide
  const len = crouch ? 30 : half; // crouch ledges are long along the path
  const swing = k === 0 || k === JUMPS ? 0 : Math.floor(rand() * 16) * 2; // 0..30 out from the face
  const top = snap(z, 2) + 8;
  const col = k === 0 ? [80, 200, 90] : k === JUMPS ? [250, 210, 60] : ROUTE[k % 3];
  const mat = k === 0 || k === JUMPS ? { material: 'BMC_Glow', material_intensity: 2 } : {};
  // place it; if it (or the 64 of headroom above/below it) would touch an earlier ledge, slide on along the path
  let placed = null;
  for (let tries = 0; tries < 40 && !placed; tries++) {
    const d = surfD(z, a), rx = d * RX, ry = d * RY;
    const out = (Math.max(half, len) + 12 + swing) / Math.hypot(Math.cos(a) * RX, Math.sin(a) * RY);
    const px = snap(Math.cos(a) * (rx + out * RX), 2), py = snap(Math.sin(a) * (ry + out * RY), 2);
    const alongX = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)); // long side along the path's tangent
    const hx = alongX ? len : half, hy = alongX ? half : len;
    if (B.free([px - hx - 8, py - hy - 8, top - 72], [px + hx + 8, py + hy + 8, top + 64])) placed = { px, py, top, hx, hy };
    else a += dir * 8 / Math.max(Math.hypot(Math.cos(a) * rx, Math.sin(a) * ry), 120);
  }
  if (!placed) throw new Error(`mountain: no room for ledge ${k}`);
  const { px, py, hx, hy } = placed;
  B.box(px - hx, py - hy, top - 8, px + hx, py + hy, top, { ...LEDGE(col), ...mat }, k === 0 ? 'start' : k === JUMPS ? 'summit' : 'ledge');
  if (crouch) B.box(px - hx, py - hy, top + 44, px + hx, py + hy, top + 56, ROOF, 'crouch roof');
  ledges.push({ ...placed, crouch });
  // next jump: a random gap along the path and a random rise
  const gap = 24 + Math.floor(rand() * 13) * 2, rise = crouch ? 0 : Math.floor(rand() * 11) * 2; // rise 0..20
  const d = surfD(z, a), rr = Math.max(Math.hypot(Math.cos(a) * d * RX, Math.sin(a) * d * RY), 120);
  a += dir * (gap + Math.max(hx, hy) + 14) / rr;
  z = Math.min(z + rise + 6, HT - 60);
}
const summit = ledges[JUMPS];
B.box(summit.px - 1, summit.py - 1, summit.top, summit.px + 1, summit.py + 1, summit.top + 80, { asset: MB, color: [220, 220, 225], material: 'BMC_Metallic' }, 'flag pole');
B.box(summit.px + 1, summit.py - 1, summit.top + 54, summit.px + 31, summit.py + 1, summit.top + 78, { asset: MB, color: [217, 119, 87] }, 'flag');
const routeBricks = B.bricks.length, routeDropped = B.dropped.length;

// ---- body ----
const N = Math.ceil(RX / CELL) + 2, M = Math.ceil(RY / CELL) + 2;
const hs = new Map();
for (let i = -N; i < N; i++) for (let j = -M; j < M; j++) {
  const h = snap(height(i * CELL + CELL / 2, j * CELL + CELL / 2), 4);
  if (h >= 8) hs.set(i * 4096 + j, h);
}
const hAt = (i, j) => hs.get(i * 4096 + j) ?? 0;
const colour = (h, i, j) => {
  const t = h / HT, n = ((i * 73856093) ^ (j * 19349663)) & 15;
  if (t > 0.78) return [235 - n, 238 - n, 242 - n]; // snow
  if (t > 0.55) return [128 - n, 122 - n, 116 - n]; // scree
  return [96 - n, 88 - n, 78 - n]; // rock
};
for (const [key, h] of hs) {
  const i = Math.round(key / 4096), j = key - i * 4096;
  const x0 = i * CELL, y0 = j * CELL;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [di, dj, hAt(i + di, j + dj)]);
  const lo = Math.min(...nb.map(n => n[2])), up = nb.reduce((m, n) => (n[2] > m[2] ? n : m));
  const c = colour(h, i, j);
  const base = Math.max(lo, 0);
  // the core in slabs of at most 200 tall (smaller pieces = fewer holes where a ledge cuts in)
  for (let zb = 0; zb < base; zb += 200) B.box(x0, y0, zb, x0 + CELL, y0 + CELL, Math.min(base, zb + 200), { asset: MB, color: colour(Math.min(base, zb + 200), i, j) }, 'core');
  if (h - base >= 4 && h - base <= 96 && up[2] > h) B.wedge(x0, y0, base, x0 + CELL, y0 + CELL, h, up[0], up[1], { color: c }, 'slope');
  else if (h > base) B.box(x0, y0, base, x0 + CELL, y0 + CELL, h, { asset: MB, color: c }, 'cap');
}
if (routeDropped) throw new Error(`mountain: route lost ${routeDropped} pieces: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`mountain: ${bricks.length} bricks (route ${routeBricks}, ${JUMPS} jumps, ${ledges.filter(l => l.crouch).length} crouch roofs, summit z ${summit.top}; body pieces skipped where ledges cut in: ${B.dropped.length}) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 6000, bricks }] }));
