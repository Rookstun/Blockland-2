// The spawn hub town: a walled 1000-stud town on a street grid around a big
// market square. mapgen flattens the ground, paves it from surface() and
// calls build() for the bricks.
//
// Everything here is in game units relative to the town centre (stud = 10,
// brick = 12, plate = 4). The town is 250 cells (40 units) wide, so centre
// 0 sits on a cell boundary. Coordinates of walls and openings stay on
// multiples of 10 and heights on multiples of 4, so every brick lands on the
// stud/plate grid.
//
// Layout, per axis: street lines every 1600 units (7 lines, the middle one a
// wide avenue), a perimeter road just inside the wall, 6 x 6 blocks between
// the lines. The four middle blocks are the market square. Each other block
// is cut into 3 x 3 lots (about 48 studs); the middle lot is a garden or park, the rest hold
// buildings whose doors face the nearest street.

import { planHouse, COURSES as WH_COURSES } from './wallhouse.mjs';
import { planShop, SHOP_KINDS } from './wallshop.mjs';
import { shapedHouse } from './shapedhouse.mjs';
import { turnBrick } from './orient.mjs';
import { floorPieces, cellsOfRect, STYLES as FLOOR_STYLES } from './floors.mjs';
import { townCourses, pickRoof } from './roofs.mjs';
import { plaque } from './ruins.mjs';
import { NOTICES, STATUES } from './notices.mjs';

// Organic layout (owner 2026-10-05: "make spawn town less square and more
// connected by herringbone paths", RuneScape's Lumbridge map as the model):
// no grid and no wall. Landmarks (fountain plaza, castle, church, bank,
// tavern) are joined by winding herringbone paths; houses stand along the
// paths facing them; the flattened ground is a ragged disc, not a square.
// planTown() decides the paths before mapgen shapes the ground (surface()
// reads them), build() then places the buildings along them. The big river
// (mapgen) crosses the town along RIVER_LOCAL; path crossings get bridges.
export const TOWN_CELLS = 130;            // the square the town may use (cells, 40 units)
const HALF = TOWN_CELLS * 20;             // 2600
export const RIVER_DEPTH = 3;             // (legacy export)
export const PATH_W = 120;                // herringbone path width
export const PLAZA_R = 440; // 360 -> 440 (2026-10-05) for the market rings
export const TOWN_R = 2250;               // flattened town radius (ragged edge)
// where the world river runs through town (town units, east to west); mapgen
// threads its course through these
export const RIVER_LOCAL = [[2900, -1650], [1500, -1250], [200, -1450], [-1200, -1850], [-2900, -1600]];
const CASTLE = [0, 1500], CHURCH = [1450, 850];

const dist2seg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
export const distToLine = (px, py, pts) => {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i], q = pts[i + 1]; m = Math.min(m, dist2seg(px, py, p[0], p[1], q[0], q[1])); }
  return m;
};
/** a smooth winding path through waypoints: Catmull-Rom, every 20 units, swung sideways by amp */
export function windPath(way, amp, phase) {
  const raw = [];
  for (let i = 0; i + 1 < way.length; i++) {
    const p0 = way[Math.max(0, i - 1)], p1 = way[i], p2 = way[i + 1], p3 = way[Math.min(way.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 20));
    for (let k = 0; k < n; k++) {
      const f = k / n, cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f * f * f);
      raw.push([cr(0), cr(1)]);
    }
  }
  raw.push(way[way.length - 1]);
  let s = 0;
  const L = raw.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]) : 0), 0);
  return raw.map((p, i) => {
    if (i) s += Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]);
    const q = raw[Math.min(raw.length - 1, i + 1)], o = raw[Math.max(0, i - 1)];
    const tx = q[0] - o[0], ty = q[1] - o[1], tl = Math.hypot(tx, ty) || 1;
    const w = amp * Math.sin(s / 260 + phase) * Math.min(1, s / 240, (L - s) / 240);
    return [p[0] - (ty / tl) * w, p[1] + (tx / tl) * w];
  });
}
// cell raster of a plan (TOWN_CELLS or village side): kind per cell
function rasterize(side, paths, extra) {
  const kind = new Array(side * side).fill(null), h = side / 2;
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) {
      const ux = (i - h + 0.5) * 40, uy = (j - h + 0.5) * 40;
      let k = extra(ux, uy);
      if (k !== 'square') for (const p of paths) if (distToLine(ux, uy, p) <= PATH_W / 2) { k = 'street'; break; }
      kind[i * side + j] = k;
    }
  return { side, kind, at: (ux, uy) => { const i = Math.floor(ux / 40 + h), j = Math.floor(uy / 40 + h); return i < 0 || j < 0 || i >= side || j >= side ? null : kind[i * side + j]; } };
}

// ------------------------------------------------------------- terraces --
// (owner 2026-10-12: "make towns have layered heights, with retaining walls
// and sewers") The town stands on terraces TIER_V voxels (bricks) apart.
// field(ux, uy) gives a fractional tier; forced(ux, uy) pins a tier (plaza,
// castle, church, the river corridor). Each 40-unit cell gets a tier, specks
// are voted away and neighbouring cells never differ by more than one tier
// (one retaining wall high). Lots and the square sit flat on their tier;
// streets ramp a brick per cell between tiers (sunken lanes cut into the
// higher terrace), never lowering the square. plan.levelAt(ux, uy) = the
// cell's top over tier 0 (units), plan.tierAt = its tier; mapgen raises the
// ground, lines the steps with retaining walls and puts wedges on the ramps.
export const TIER_V = 4;
function terrace(plan, side, inside, field, forced, maxTier) {
  const h = side / 2, C = 40, I = (i, j) => i * side + j;
  const u = i => (i - h + 0.5) * C;
  const t = new Int8Array(side * side).fill(-1), pin = new Uint8Array(side * side);
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) {
      if (!inside(u(i), u(j))) continue;
      const f = forced(u(i), u(j));
      if (f != null) { t[I(i, j)] = f; pin[I(i, j)] = 1; } else t[I(i, j)] = Math.max(0, Math.min(maxTier, Math.floor(field(u(i), u(j)))));
    }
  // vote away specks: 5 x 5 majority, three passes
  for (let pass = 0; pass < 3; pass++) {
    const next = t.slice();
    for (let i = 0; i < side; i++)
      for (let j = 0; j < side; j++) {
        if (t[I(i, j)] < 0 || pin[I(i, j)]) continue;
        const votes = new Array(maxTier + 1).fill(0);
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < side && y < side && t[I(x, y)] >= 0) votes[t[I(x, y)]]++; }
        next[I(i, j)] = votes.indexOf(Math.max(...votes));
      }
    t.set(next);
  }
  // one tier per step at most (lower the higher side)
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < side; i++)
      for (let j = 0; j < side; j++) {
        const c = t[I(i, j)]; if (c < 0) continue;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= side || y >= side) continue;
          const n = t[I(x, y)]; if (n >= 0 && c > n + 1 && !pin[I(i, j)]) { t[I(i, j)] = n + 1; changed = true; }
        }
      }
  }
  // heights in voxels: lots and the square on their tier, streets ramped
  const kind = (i, j) => plan.surfaceAt(u(i), u(j));
  const road = (i, j) => { const k = kind(i, j); return k === 'street' || k === 'square'; };
  const v = new Int16Array(side * side).fill(-1);
  for (let c = 0; c < side * side; c++) if (t[c] >= 0) v[c] = t[c] * TIER_V;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // lower envelope over the street graph (ramps cut down into higher terraces) ...
  const lo = new Int16Array(side * side).fill(9999), up = new Int16Array(side * side).fill(-9999);
  for (let i = 0; i < side; i++) for (let j = 0; j < side; j++) if (t[I(i, j)] >= 0 && road(i, j)) { lo[I(i, j)] = v[I(i, j)]; if (kind(i, j) === 'square') up[I(i, j)] = v[I(i, j)]; }
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < side; i++)
      for (let j = 0; j < side; j++) {
        const c = I(i, j); if (lo[c] === 9999) continue;
        for (const [a, b] of N8) {
          const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= side || y >= side) continue;
          const n = I(x, y); if (lo[n] === 9999) continue;
          if (lo[n] + 1 < lo[c]) { lo[c] = lo[n] + 1; changed = true; }
          if (up[n] - 1 > up[c]) { up[c] = up[n] - 1; changed = true; }
        }
      }
  }
  // ... raised again near the square (it never moves): max of the two stays one brick per cell
  for (let c = 0; c < side * side; c++) if (lo[c] !== 9999) v[c] = Math.max(lo[c], up[c]);
  const at = (arr, ux, uy) => { const i = Math.floor(ux / C + h), j = Math.floor(uy / C + h); return i < 0 || j < 0 || i >= side || j >= side ? -1 : arr[I(i, j)]; };
  // building sites claim their lot (town.mjs build): its lot cells take the
  // site's tier; reset() goes back to the planned terraces before a build
  const t0 = t.slice(), v0 = v.slice();
  plan.reset = () => { t.set(t0); v.set(v0); };
  plan.claim = (r, tier) => {
    for (let i = Math.max(0, Math.floor(r[0] / C + h)); i < Math.min(side, Math.ceil(r[2] / C + h)); i++)
      for (let j = Math.max(0, Math.floor(r[1] / C + h)); j < Math.min(side, Math.ceil(r[3] / C + h)); j++)
        if (t[I(i, j)] >= 0 && !road(i, j) && !pin[I(i, j)]) { t[I(i, j)] = tier; v[I(i, j)] = tier * TIER_V; }
  };
  plan.pinnedAt = (ux, uy) => at(pin, ux, uy) === 1;
  plan.levelAt = (ux, uy) => Math.max(0, at(v, ux, uy)) * 12;
  plan.tierAt = (ux, uy) => at(t, ux, uy);
  plan.terraceIn = (ux, uy) => at(t, ux, uy) >= 0;
  plan.maxTier = maxTier;
  return plan;
}
// smooth-ish value noise for the terrace fields
const tnoise = (x, y, k) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = q => q * q * (3 - 2 * q);
  const hh = (a, b) => { let n = Math.imul(a * 374761393 + b * 668265263 + k * 982451653, 1274126177); n ^= n >>> 15; return ((n >>> 0) % 10000) / 10000; };
  const L = (a, b, q) => a + (b - a) * q;
  return L(L(hh(xi, yi), hh(xi + 1, yi), s(fx)), L(hh(xi, yi + 1), hh(xi + 1, yi + 1), s(fx)), s(fy));
};

export function planTown(rnd) {
  const ph = k => rnd(4242, k) * Math.PI * 2;
  // town edge: a ragged circle
  const edgeR = (x, y) => { const a = Math.atan2(y, x); return TOWN_R + 140 * Math.sin(3 * a + ph(1)) + 90 * Math.sin(5 * a + ph(2)); };
  // exits on the edge of the town's square (mapgen's roads start there)
  const exits = [
    { dir: [1, 0], at: [HALF, 300] }, { dir: [-1, 0], at: [-HALF, 200] },
    { dir: [0, 1], at: [-1100, HALF] }, { dir: [0, -1], at: [300, -HALF] },
  ];
  const main = [
    windPath([[PLAZA_R - 30, 60], [900, 230], [1700, 160], [2300, 280], exits[0].at], 60, ph(3)),
    windPath([[-PLAZA_R + 30, 110], [-1000, 200], [-1800, 300], [-2300, 220], exits[1].at], 60, ph(4)),
    windPath([[-130, PLAZA_R - 30], [-420, 800], [-920, 1250], [-1020, 2000], exits[2].at], 50, ph(5)),
    windPath([[40, -PLAZA_R + 30], [200, -900], [180, -1450], [300, -2100], exits[3].at], 30, ph(6)),
    windPath([[0, PLAZA_R - 30], [0, CASTLE[1] - 460]], 0, 0),                 // up to the castle gate
    windPath([[CHURCH[0], 200], [CHURCH[0], CHURCH[1] - 290]], 0, 0),          // off the east road to the church door
  ];
  // a few lanes off the main paths, ending in little closes
  const lanes = [];
  const keepOff = [[CASTLE, 640], [CHURCH, 700], [[0, 0], PLAZA_R + 300]];
  for (let k = 0; lanes.length < 16 && k < 300; k++) {
    const parents = [...main.slice(0, 4), ...lanes], p = parents[k % parents.length];
    if (p.length < 30) continue;
    const i = 12 + Math.floor(rnd(4243, k) * (p.length - 24));
    const [x, y] = p[i], [qx, qy] = p[i + 1];
    if (Math.hypot(x, y) < 650) continue;
    const tl = Math.hypot(qx - x, qy - y) || 1, side = rnd(4244, k) < 0.5 ? 1 : -1;
    const nx = (-(qy - y) / tl) * side, ny = ((qx - x) / tl) * side, len = 600 + rnd(4245, k) * 500;
    const end = [x + nx * len + (qx - x) / tl * 150, y + ny * len + (qy - y) / tl * 150];
    if (Math.hypot(...end) > edgeR(...end) - 300) continue;
    if (keepOff.some(([c, r]) => Math.hypot(end[0] - c[0], end[1] - c[1]) < r)) continue;
    if (distToLine(...end, RIVER_LOCAL) < 450 || distToLine(x + nx * len / 2, y + ny * len / 2, RIVER_LOCAL) < 450) continue;
    if (lanes.some(l => Math.hypot(l[l.length - 1][0] - end[0], l[l.length - 1][1] - end[1]) < 480)) continue;
    const lane = windPath([[x, y], [x + nx * len * 0.5, y + ny * len * 0.5], end], 40, ph(10 + k));
    // fan out: a lane keeps 360 off every other path (and 300 off its parent once clear of it)
    if (lane.slice(10).some(([a, b2]) => [...main, ...lanes].some(o => o !== p && distToLine(a, b2, o) < 330))) continue;
    if (lane.slice(20).some(([a, b2]) => distToLine(a, b2, p) < 280)) continue;
    lanes.push(lane);
  }
  const paths = [...main, ...lanes];
  const r = rasterize(TOWN_CELLS, paths, (ux, uy) =>
    Math.hypot(ux, uy) <= PLAZA_R ? 'square' : Math.hypot(ux, uy) <= edgeR(ux, uy) ? 'lot' : null);
  const plan = { kind: 'town', exits, paths, main, lanes, edgeR, castle: CASTLE, church: CHURCH, surfaceAt: r.at };
  // terraces: the castle on its hill, the church on a rise, the ground climbing
  // away from the river, a little noise; the river corridor stays at tier 0
  const ph7 = rnd(4242, 7) * 100;
  const field = (ux, uy) => 0.35
    + 2.4 * Math.exp(-((ux - CASTLE[0]) ** 2 + (uy - CASTLE[1]) ** 2) / 1100 ** 2)
    + 1.2 * Math.exp(-((ux - CHURCH[0]) ** 2 + (uy - CHURCH[1]) ** 2) / 700 ** 2)
    + Math.max(0, distToLine(ux, uy, RIVER_LOCAL) - 500) / 1500
    + (tnoise(ux / 700 + ph7, uy / 700, 1) - 0.5) * 1.1;
  const tierOf = p => Math.max(0, Math.min(3, Math.floor(field(...p))));
  const PLAZA_T = tierOf([0, 0]);
  const forced = (ux, uy) => {
    if (distToLine(ux, uy, RIVER_LOCAL) < 460) return 0;
    if (Math.hypot(ux, uy) <= PLAZA_R + 120) return PLAZA_T;
    if (Math.abs(ux - CASTLE[0]) <= 620 && Math.abs(uy - CASTLE[1]) <= 600) return tierOf(CASTLE);
    if (ux >= CHURCH[0] - 700 && ux <= CHURCH[0] + 340 && uy >= CHURCH[1] - 620 && uy <= CHURCH[1] + 440) return tierOf(CHURCH);
    if (ux >= -740 && ux <= -310 && uy >= -440 && uy <= 40) return PLAZA_T; // the bank by the square
    if (ux >= 360 && ux <= 760 && uy >= -1020 && uy <= -500) return tierOf([560, -760]); // the tavern
    return null;
  };
  return terrace(plan, TOWN_CELLS, (ux, uy) => r.at(ux, uy) != null, field, forced, 3);
}

/** surface kind of a town cell centre (town units): 'square' | 'street' | 'lot' | null (natural ground) */
export function surface(ux, uy, plan) { return plan.surfaceAt(ux, uy); }

// Hamlets (owner's RuneScape map): a cobbled green with the well in the
// middle, lanes branching out, houses along them facing the lane, fenced crop
// fields and a pen between them.
// Organic since 2026-10-06 (owner: "hamlets are on a circle", wanted them
// varied): a lumpy outline (edgeR, a few sine lobes, never past VILLAGE_R),
// 3-4 bent, winding lanes at uneven angles and lengths running to that edge
// (mapgen's roads join their ends) and an irregular green. mapgen flattens
// only inside the outline. Houses are tried every 100 units along the lanes.
export const VILLAGE_R = 22 * 40;          // outer bound of the outline (mapgen VILLAGE.r cells * 40)
export function planVillage(seed, rnd) {
  const ph = k => rnd(seed, 80 + k) * Math.PI * 2;
  const edgeAt = a => Math.max(620, Math.min(VILLAGE_R - 40,
    VILLAGE_R * (0.92 + 0.12 * Math.sin(2 * a + ph(0)) + 0.08 * Math.sin(3 * a + ph(1)) + 0.05 * Math.sin(5 * a + ph(2)))));
  const edgeR = (x, y) => edgeAt(Math.atan2(y, x));
  const greenAt = a => 150 * (1 + 0.28 * Math.sin(2 * a + ph(3)) + 0.14 * Math.sin(3 * a + ph(4)));
  // main lanes: spread round, each knocked up to 0.45 rad off even spacing
  // (more uneven than that and the lanes crowd the houses out)
  const n = rnd(seed, 61) < 0.45 ? 4 : 3;
  const angles = Array.from({ length: n }, (_, k) => ph(5) + (k * 2 * Math.PI) / n + (rnd(seed, 63, k) - 0.5) * 0.9);
  const spokes = angles.map((a, k) => {
    const L = edgeAt(a) - 40, g = greenAt(a) - 20, bend = (rnd(seed, 64, k) - 0.5) * 0.7;
    const way = [[Math.cos(a) * g, Math.sin(a) * g], [Math.cos(a + bend) * L * 0.55, Math.sin(a + bend) * L * 0.55], [Math.cos(a) * L, Math.sin(a) * L]];
    return { angle: a, path: windPath(way, 30 + rnd(seed, 65, k) * 30, seed + k), end: way[2] };
  });
  // (side lanes were tried 2026-10-06: they took the house plots and halved the houses)
  const paths = spokes.map(s => s.path);
  const side = 2 * Math.ceil(VILLAGE_R / 40) + 2;
  const r = rasterize(side, paths, (ux, uy) => (Math.hypot(ux, uy) <= greenAt(Math.atan2(uy, ux)) ? 'square' : null));
  const plan = { kind: 'village', spokes, paths, edgeR, surfaceAt: r.at };
  // terraces (2026-10-12): the green on tier 1, the ground tilting away to 0
  // on one side and up to 2 on the other, with a wobble
  const tilt = ph(9), ph8 = rnd(seed, 88) * 100;
  const field = (ux, uy) => 1.5 + (Math.cos(tilt) * ux + Math.sin(tilt) * uy) / 520 + (tnoise(ux / 380 + ph8, uy / 380, 2) - 0.5) * 0.9;
  const forced = (ux, uy) => (Math.hypot(ux, uy) <= greenAt(Math.atan2(uy, ux)) + 120 ? 1 : null);
  return terrace(plan, side, (ux, uy) => Math.hypot(ux, uy) <= edgeR(ux, uy), field, forced, 2);
}

const PALETTE = {
  plaster: [[232, 222, 200], [214, 192, 160], [204, 208, 216], [226, 200, 188], [238, 230, 214], [196, 176, 150]],
  brick: [[150, 70, 50], [132, 82, 60], [176, 136, 98], [138, 130, 122], [206, 186, 156], [162, 92, 64]],
  timber: [[96, 66, 42], [118, 82, 52], [84, 62, 46]],
  roof: [[150, 62, 46], [118, 72, 44], [82, 92, 112], [104, 58, 52], [70, 70, 74], [132, 96, 60]],
  stone: [[128, 124, 118], [112, 108, 104], [146, 140, 130]],
  cloth: [[200, 50, 50], [50, 120, 200], [230, 180, 40], [60, 160, 80], [150, 60, 170], [230, 120, 40]],
  goods: [[220, 60, 40], [240, 200, 60], [120, 200, 70], [180, 120, 60], [90, 140, 220]],
  shutter: [[46, 92, 70], [120, 50, 40], [50, 70, 120], [90, 70, 50], [60, 60, 64], [150, 120, 50]],
  bloom: [[220, 50, 60], [240, 200, 50], [160, 90, 200], [240, 240, 245], [245, 140, 50], [240, 130, 170]],
  blanket: [[140, 40, 60], [60, 90, 160], [70, 120, 70], [180, 140, 60], [120, 70, 140]],
  rug: [[150, 40, 40], [60, 80, 130], [150, 110, 50], [90, 60, 100]],
  books: [[150, 40, 40], [40, 80, 140], [50, 110, 60], [160, 120, 40], [90, 50, 110], [180, 160, 130]],
};
const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 5) => ({ color, material: 'BMC_Glow', material_intensity: i });
const STOREY = 84; // 7 bricks
const HOUSE_SHOP_CHANCE = 0.35;
const HOUSE_SHOP_TIERS = ['bronze', 'iron', 'steel', 'black', 'mithril', 'adamant'];
// Houses (2026-10-03, owner): shapedhouse.mjs rect / L / T houses with rounded
// roofs and attics; the blacksmith houses (HOUSE_SHOP_CHANCE) stay wallgen
// workshops. The wing goes behind the main body, away from the street.
const isSmith = (rnd, s) => rnd(s, 77) < HOUSE_SHOP_CHANCE;
// rooms a bit bigger (owner 2026-10-13): every house and shop GROW studs wider and deeper
const GROW = 2;
function shapedSpec(type, rnd, s, small = false) {
  const sp = shapedSpec0(type, rnd, s, small);
  return { ...sp, W: sp.W + GROW, D: sp.D + GROW };
}
function shapedSpec0(type, rnd, s, small = false) {
  // small: villages and the market-ring lots keep the old sizes (their lots are tighter)
  const pickS = list => list[Math.floor(rnd(s, 90) * list.length)];
  // style runescape (2026-10-05, owner): plaster / grey stone, timber trim, thatch roofs, plank floors
  // roof style from the pool in roofs.mjs (dormers 2026-10-06)
  const roof = pickRoof(rnd(s, 91));
  if (type === 'cottage') { const shape = pickS(['rect', 'L']); return small ? { shape, W: 32, D: 20, E: shape === 'rect' ? 0 : 8, storeys: 1, attic: false, style: 'runescape', roof } : { shape, W: 40, D: 24, E: shape === 'rect' ? 0 : 10, storeys: 1, attic: false, style: 'runescape', roof }; } // bigger 2026-10-05 (owner: houses too small) // no attic: the coursed roof is too low over a cottage's stair
  const shape = pickS(['rect', 'L', 'T']);
  return small ? { shape, W: 36, D: 24, E: shape === 'rect' ? 0 : 12, storeys: 2, style: 'runescape', roof } : { shape, W: 44, D: 28, E: shape === 'rect' ? 0 : 12, storeys: 2, style: 'runescape', roof };
}
const shapedDepth = sp => (sp.D + sp.E + 1) * 10;
// floor / ceiling looks live in floors.mjs; the stair treads borrow the plank tones
const PLANKS = FLOOR_STYLES.townPlanks.colors;

/**
 * build({ put, orientFor, rnd }) lays every town brick.
 *   put(brick, x, y, z): brick with size (half extents) etc., positioned in town units, z up from the paving
 *   orientFor(asset, ups, ext): wedge orientation from mapgen
 *   rnd(a, b, c): deterministic hash in [0, 1)
 * Returns counts for the summary.
 */
// Share of house lots that keep their building: the first town was packed
// wall to wall, so most lots are left as open grass (inner ring a bit denser).
const KEEP_INNER = 0.7, KEEP_OUTER = 0.2;
// interior furniture (owner 2026-10-05: "remove all furniture for now"): beds, tables,
// counters, wares, forges, shelves, lanterns, throne, pews... Off until asked for again.
export const FURNITURE = true; // back on (owner 2026-10-13: "readd furniture")

// plan: planTown(rnd) or planVillage(seed, rnd); riverAt(x, y): is that point (local units) river water
export function build({ put, orientFor, rnd, village = null, plan, riverAt = () => false, free = () => true, shopTiers = HOUSE_SHOP_TIERS, single = null, sewerDepth = 0 }) {
  const pick = (list, a, b, c) => list[Math.floor(rnd(a, b, c) * list.length)];
  const stats = { buildings: {}, stalls: 0, lamps: 0, trees: 0, removed: [], houseShops: [] };
  const count = t => (stats.buildings[t] = (stats.buildings[t] ?? 0) + 1);

  // furniture switch: while FURN > 0 every piece is furniture and is only laid when FURNITURE is on
  let FURN = 0;
  { const layAll = put; put = (b, x, y, z) => { if (FURN > 0 && !FURNITURE) return; layAll(b, x, y, z); }; }
  // terraces (2026-10-12): a brick stands on its cell's level, or inside a
  // site (onSite) on the site's level, so a building never splits
  let zCtx = null;
  const lv = (x, y) => (plan?.levelAt ? plan.levelAt(x, y) : 0);
  { const lay = put; put = (b, x, y, z) => lay(b, x, y, z + (zCtx ?? lv(x, y))); }
  { const fr = free; free = (x0, y0, z0, x1, y1, z1) => { const o = zCtx ?? lv((x0 + x1) / 2, (y0 + y1) / 2); return fr(x0, y0, z0 + o, x1, y1, z1 + o); }; }
  const onSite = (r, fn) => {
    if (r.claim) plan.claim(r.claim, r.claim[4]);
    const prev = zCtx; zCtx = lv((r[0] + r[2]) / 2, (r[1] + r[3]) / 2); try { return fn(); } finally { zCtx = prev; }
  };
  plan?.reset?.(); // every build starts from the planned terraces (mapgen runs trial builds)

  // ---------------------------------------------------------- primitives --
  const box = (x0, y0, z0, x1, y1, z1, b) =>
    put({ ...b, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pole = (x, y, z0, z1, r, b) => put({ asset: 'PB_DefaultPole', ...b, size: [r, r, (z1 - z0) / 2] }, x, y, (z0 + z1) / 2);

  /**
   * A brick wall along x (or y) at cross coordinate c, thickness 10, from a to
   * b, height h, with openings [p0, p1, z0, z1] (glazed when z0 > 0). Laid in
   * 1-brick courses of staggered bricks in a few shades of `color`, pale
   * stone quoins at the ends, and stone lintel and sill courses framing each
   * opening. Opening edges sit on the 10 grid and on course lines.
   */
  function wall(axis, c, a, b, h, openings, color, zStart = 0) {
    const seg = (p0, p1, z0, z1, brick) => {
      if (p1 <= p0 || z1 <= z0) return;
      if (axis === 'x') box(p0, c - 5, z0, p1, c + 5, z1, brick);
      else box(c - 5, p0, z0, c + 5, p1, z1, brick);
    };
    const shade = (k, f) => color.map(v => Math.max(0, Math.min(255, Math.round(v * f[k % f.length]))));
    const F = [1, 0.9, 1.07, 0.95, 1.03];
    const STONE = [206, 198, 182], QUOIN = [[214, 208, 194], [196, 190, 176]];
    for (let z = zStart, course = zStart / 12; z < h; z += 12, course++) {
      const holes = openings.filter(o => o[2] <= z && o[3] >= z + 12);
      // stone spans: the course just above an opening (lintel) and just below a window (sill)
      const stone = openings.filter(o => o[3] === z || (o[2] > 0 && o[2] === z + 12)).map(o => [Math.max(a, o[0] - 10), Math.min(b, o[1] + 10)]);
      let p = a;
      const runs = [];
      for (const o of [...holes].sort((u, v) => u[0] - v[0])) { if (o[0] > p) runs.push([p, o[0]]); p = Math.max(p, o[1]); }
      if (p < b) runs.push([p, b]);
      for (const [r0, r1] of runs) {
        const breaks = [...new Set([r0, r1, ...stone.flat().filter(q => q > r0 && q < r1)])].sort((u, v) => u - v);
        for (let i = 0; i + 1 < breaks.length; i++) {
          const s0 = breaks[i], s1 = breaks[i + 1];
          if (stone.some(([t0, t1]) => s0 >= t0 && s1 <= t1)) { seg(s0, s1, z, z + 12, { color: STONE }); continue; }
          let q = s0, first = course % 2 ? 20 : 40, k = course * 3;
          while (q < s1) {
            let len = first || [40, 30, 40, 50][k % 4];
            first = 0;
            if (s1 - (q + len) < 20) len = s1 - q;
            const quoin = (q === a || q + len === b) && len <= 40;
            seg(q, q + len, z, z + 12, { color: quoin ? QUOIN[course % 2] : shade(k, F) });
            q += len; k++;
          }
        }
      }
    }
    for (const [p0, p1, z0, z1] of openings) if (z0 > 0 && z0 >= zStart && z1 <= h) seg(p0, p1, z0, z1, GLASS);
  }

  /**
   * gable roof over the rectangle, ridge along the longer side, 1 stud overhang.
   * Laid in courses (owner's sample roof, 2026-10-03): each side is a run of
   * strips about 3 studs deep from the eave up to the ridge; a strip is a
   * 1-plate lip with a micro wedge on top, so every course steps out over the
   * one below it. rise is the most it climbs (rounded down to whole courses).
   */
  // fill { color, inset }: close each gable end with a stepped wall of that
  // colour, 10 thick, `inset` in from x0/x1 (or y0/y1) (owner 2026-10-04: you
  // could see into the attic through the open ends); one band per course, as
  // wide as the gap between the courses' inner edges, so the roof covers it
  function gable(x0, y0, x1, y1, zBase, rise, color, ridgeAlongX = x1 - x0 >= y1 - y0, fill = null) {
    const ox0 = x0 - 10, oy0 = y0 - 10, ox1 = x1 + 10, oy1 = y1 + 10;
    const S = ((ridgeAlongX ? oy1 - oy0 : ox1 - ox0)) / 2, LIP = 4;
    // course depths (even, summing to S) and the rise per course: roofs.mjs
    const { widths, per } = townCourses(S, rise, LIP), n = widths.length;
    const lipC = color.map(v => Math.round(v * 0.82));
    for (const sgn of [-1, 1]) {
      let e = 0;
      widths.forEach((w, k) => {
        const z = zBase + k * per;
        if (ridgeAlongX) {
          const ya = sgn < 0 ? oy0 + e : oy1 - e - w, yb = ya + w;
          box(ox0, ya, z, ox1, yb, z + LIP, { asset: 'PB_DefaultMicroBrick', color: lipC });
          const ext = [(ox1 - ox0) / 2, w / 2, (per - LIP) / 2];
          put({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[0, -sgn]], ext), color }, (ox0 + ox1) / 2, (ya + yb) / 2, z + LIP + (per - LIP) / 2);
        } else {
          const xa = sgn < 0 ? ox0 + e : ox1 - e - w, xb = xa + w;
          box(xa, oy0, z, xb, oy1, z + LIP, { asset: 'PB_DefaultMicroBrick', color: lipC });
          const ext = [w / 2, (oy1 - oy0) / 2, (per - LIP) / 2];
          put({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[-sgn, 0]], ext), color }, (xa + xb) / 2, (oy0 + oy1) / 2, z + LIP + (per - LIP) / 2);
        }
        e += w;
      });
    }
    (stats.gables ??= []).push({ box: [x0, y0, x1, y1], zBase, rise, ridgeAlongX, fill: !!fill });
    if (!fill) return;
    // the gable end, laid like the wall under it (2026-10-06, owner: one flat slab
    // per roof course read as a crude staircase): 12-high courses in running
    // bond, 20-60 long, one shade factor per brick
    const F = [1, 0.94, 1.04, 0.97, 1.02];
    let nb = 0;
    const brickRow = (a0, a1, z0, z1, row, put1) => {
      let a = a0, j = 0;
      const off = row % 2 ? 30 : 0;
      while (a < a1) {
        let L = (j === 0 && off ? off : 40 + ((row * 7 + j * 3) % 3) * 10);
        if (a1 - (a + L) < 20) L = a1 - a; // no slivers at the end
        const f = F[(nb++ * 7 + row) % F.length];
        put1(a, Math.min(a1, a + L), z0, z1, { asset: 'PB_DefaultMicroBrick', color: fill.color.map(v => Math.min(255, Math.round(v * f))) });
        a += L; j++;
      }
    };
    for (let k = 0, e = 0; k + 1 < n; k++) {
      e += widths[k];
      const z = zBase + k * per;
      for (let zz = z, row = k * 3; zz < z + per; zz += 12, row++) {
        const z1 = Math.min(z + per, zz + 12);
        if (ridgeAlongX) for (const gx of [x0 + fill.inset, x1 - fill.inset - 10]) brickRow(oy0 + e, oy1 - e, zz, z1, row, (a, b, p, q, m) => box(gx, a, p, gx + 10, b, q, m));
        else for (const gy of [y0 + fill.inset, y1 - fill.inset - 10]) brickRow(ox0 + e, ox1 - e, zz, z1, row, (a, b, p, q, m) => box(a, gy, p, b, gy + 10, q, m));
      }
    }
  }


  /**
   * A building: rectangle centred (cx, cy), `w` wide along its street front and
   * `d` deep, door facing (fx, fy). Windows every ~60 units on each floor.
   *
   * Options: upperColor (plaster above the ground storey, half-timbered),
   * stairs (a flight per storey, each through a stairwell in the floor above),
   * shutters (colour), flowerBoxes, plain (walls without shutters or boxes:
   * 'front', 'back', 'left', 'right'), canopy (a little roof over the door).
   *
   * Returns the geometry plus helpers in the building's own frame: u runs
   * across the front (-w/2..w/2, +u is "right" seen from the street), v runs
   * from the front face (0) to the back face (d), z up from the ground floor.
   */
  function building(cx, cy, fx, fy, w, d, floors, { wallColor, roofColor, rise, doorW = 40, ridge, tiles, upperColor, stairs = false, shutters = null, flowerBoxes = false, plain = [], canopy = true, s = 0, flat = false, storey = STOREY } = {}) {
    // storey: height per floor (owner 2026-10-05: 84 is far too low for halls); doors, windows and stair flights scale with it
    const S = storey, DOOR_H = 72, nSteps = S / 12 - 1; // doors at most 6 bricks (owner 2026-10-10; was 96 on tall storeys)
    const [ex, ey] = fx ? [d / 2, w / 2] : [w / 2, d / 2];
    const x0 = cx - ex, x1 = cx + ex, y0 = cy - ey, y1 = cy + ey, h = floors * S;
    const lat = fx ? [0, 1] : [1, 0];
    // local frame -> world
    const P = (u, v) => [cx + lat[0] * u + fx * (d / 2 - v), cy + lat[1] * u + fy * (d / 2 - v)];
    const rect = (u0, v0, u1, v1) => {
      const [ax, ay] = P(u0, v0), [bx, by] = P(u1, v1);
      return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    };
    const lbox = (u0, v0, u1, v1, z0, z1, b) => { const [a, c, e, g] = rect(u0, v0, u1, v1); box(a, c, z0, e, g, z1, b); };
    const lpole = (u, v, z0, z1, r, b) => { const [px, py] = P(u, v); pole(px, py, z0, z1, r, b); };
    const lput = (asset, u, v, z, b = {}) => { const [px, py] = P(u, v); put({ asset, size: [0, 0, 0], ...b }, px, py, z); };
    const windows = (lo, hi, skip) => {
      const out = [];
      const n = Math.max(1, Math.floor((hi - lo - 40) / 60));
      for (let i = 0; i < n; i++) {
        const m = Math.round((lo + ((i + 1) * (hi - lo)) / (n + 1)) / 10) * 10;
        for (let f = 0; f < floors; f++) {
          if (f === 0 && skip != null && Math.abs(m - skip) < doorW / 2 + 30) continue; // != null: a door at 0 is still a door (owner 2026-10-05: windows ran into the keep door)
          out.push([m - 10, m + 10, f * S + 36, f * S + Math.max(60, S - 36)]);
        }
      }
      return out;
    };
    const doorAt = fx ? cy : cx;
    const door = [doorAt - doorW / 2, doorAt + doorW / 2, 0, DOOR_H];
    // x-walls (along x) at y0 and y1 span the full width; y-walls fit between them
    const frontY = fy ? (fy > 0 ? y1 : y0) : null, frontX = fx ? (fx > 0 ? x1 : x0) : null;
    const walls = [
      { axis: 'x', c: y0 + 5, a: x0, b: x1, out: [0, -1], open: [...(frontY === y0 ? [door] : []), ...windows(x0, x1, frontY === y0 ? doorAt : null)] },
      { axis: 'x', c: y1 - 5, a: x0, b: x1, out: [0, 1], open: [...(frontY === y1 ? [door] : []), ...windows(x0, x1, frontY === y1 ? doorAt : null)] },
      { axis: 'y', c: x0 + 5, a: y0 + 10, b: y1 - 10, out: [-1, 0], open: [...(frontX === x0 ? [door] : []), ...windows(y0 + 10, y1 - 10, frontX === x0 ? doorAt : null)] },
      { axis: 'y', c: x1 - 5, a: y0 + 10, b: y1 - 10, out: [1, 0], open: [...(frontX === x1 ? [door] : []), ...windows(y0 + 10, y1 - 10, frontX === x1 ? doorAt : null)] },
    ];
    for (const W of walls) {
      const [ox, oy] = W.out;
      W.name = ox === fx && oy === fy ? 'front' : ox === -fx && oy === -fy ? 'back' : ox === lat[0] && oy === lat[1] ? 'right' : 'left';
      if (upperColor && floors > 1) {
        wall(W.axis, W.c, W.a, W.b, S, W.open, wallColor);
        wall(W.axis, W.c, W.a, W.b, h, W.open, upperColor, S);
      } else wall(W.axis, W.c, W.a, W.b, h, W.open, wallColor);
    }
    /** a box on a wall's outer face: along [p0, p1] (world), outward [o0, o1] */
    const faceAt = W => [W.axis === 'x' ? (W.out[1] < 0 ? y0 : y1) : (W.out[0] < 0 ? x0 : x1), W.axis === 'x' ? W.out[1] : W.out[0]];
    const face = (W, p0, p1, o0, o1, z0, z1, b) => {
      const [f0, sg] = faceAt(W);
      const q0 = Math.min(f0 + sg * o0, f0 + sg * o1), q1 = Math.max(f0 + sg * o0, f0 + sg * o1);
      if (W.axis === 'x') box(p0, q0, z0, p1, q1, z1, b); else box(q0, p0, z0, q1, p1, z1, b);
    };
    const facePut = (W, asset, p, o, z, b = {}) => {
      const [f0, sg] = faceAt(W);
      if (W.axis === 'x') put({ asset, size: [0, 0, 0], ...b }, p, f0 + sg * o, z); else put({ asset, size: [0, 0, 0], ...b }, f0 + sg * o, p, z);
    };
    const MICRO = { asset: 'PB_DefaultMicroBrick' };
    const timber = PALETTE.timber[0];
    for (const W of walls) {
      const deco = !plain.includes(W.name);
      for (const [p0, p1, z0, z1] of W.open) {
        if (z0 === 0 || !deco) continue;
        // shutters either side of each window, folded back against the wall
        if (shutters) for (const [a, b] of [[p0 - 10, p0], [p1, p1 + 10]]) face(W, a, b, 0, 2, z0, z1, { ...MICRO, color: shutters });
        // a flower box under each ground-floor window, one bloom in it
        if (flowerBoxes && z0 === 36) {
          face(W, p0 - 5, p1 + 5, 0, 10, 24, 36, { color: timber });
          const bloom = pick(['B_Tulip', 'B_Rose', 'B_Small_Flower'], s, p0, 1);
          const hz = { B_Tulip: 6, B_Rose: 4, B_Small_Flower: 2 }[bloom];
          facePut(W, bloom, (p0 + p1) / 2, 6, 36 + hz, { color: pick(PALETTE.bloom, s, p0, 2) });
        }
      }
      // half-timbering on the upper storeys: a band at each floor and corner posts
      if (upperColor && floors > 1) {
        for (let f = 1; f < floors; f++) {
          face(W, W.axis === 'x' ? x0 - 4 : y0, W.axis === 'x' ? x1 + 4 : y1, 0, 4, f * S - 2, f * S + 2, { ...MICRO, color: timber });
          const top = f + 1 === floors ? h : (f + 1) * S - 2;
          if (W.axis === 'x') for (const [a, b] of [[x0, x0 + 10], [x1 - 10, x1]]) face(W, a, b, 0, 2, f * S + 2, top, { ...MICRO, color: timber });
        }
      }
    }
    // front step, and a little roof over the door
    const front = walls.find(W => W.name === 'front');
    face(front, doorAt - doorW / 2 - 10, doorAt + doorW / 2 + 10, 0, 20, 0, 4, { color: PALETTE.stone[2] });
    if (canopy) face(front, doorAt - doorW / 2 - 10, doorAt + doorW / 2 + 10, 0, 20, DOOR_H + 4, DOOR_H + 8, { color: timber });

    // stairs: a flight per storey along a side wall, rising from the back
    // toward the front, through a stairwell in the floor above; alternate
    // storeys use alternate sides. Six 1-brick steps, then the floor above.
    const U = w / 2 - 10, V = d - 10, flights = [];
    // flat: a crenellated stone roof deck instead of the gable, with a last flight up onto it
    if (stairs) for (let f = 0; f + 1 < floors + (flat ? 1 : 0); f++) {
      const side = f % 2 ? 1 : -1, ua = side < 0 ? -U : U - 30, ub = ua + 30;
      // 3x3-stud landings (owner 2026-10-05): the flight starts 30 in from the
      // back wall and must leave 30 of floor clear above its top step
      const LAND = 30, top = V - LAND - 20 * nSteps;
      if (top < LAND + 10) throw new Error(`building ${w}x${d}: storey ${S} stair (${nSteps} steps) leaves no ${LAND} landing`);
      for (let k = 0; k < nSteps; k++) lbox(ua, V - LAND - 20 * (k + 1), ub, V - LAND - 20 * k, f * S + 4 + 12 * k, f * S + 4 + 12 * (k + 1), { asset: 'PB_DefaultTile', color: k % 2 ? PLANKS[1] : PALETTE.timber[1] });
      flights.push({ f, side, hole: rect(ua, top, ub, V - LAND) });
      // balustrade along the stairwell's open side upstairs
      lbox(side < 0 ? ub : ua - 4, top, side < 0 ? ub + 4 : ua, V - LAND, (f + 1) * S + 4, (f + 1) * S + 36, { ...MICRO, color: timber });
    }
    // floors: two-tone planks along the long side, or a checker of tiles, less any stairwell
    const minus = (r, holes) => holes.reduce((pieces, [hx0, hy0, hx1, hy1]) => pieces.flatMap(([a, b, c, e]) => {
      if (hx0 >= c || hx1 <= a || hy0 >= e || hy1 <= b) return [[a, b, c, e]];
      return [[a, b, Math.min(c, hx0), e], [Math.max(a, hx1), b, c, e], [Math.max(a, hx0), b, Math.min(c, hx1), Math.min(e, hy0)], [Math.max(a, hx0), Math.max(b, hy1), Math.min(c, hx1), e]]
        .filter(([p, q, p1, q1]) => p1 > p && q1 > q);
    }), [r]);
    const FX0 = x0 + 10, FY0 = y0 + 10, FX1 = x1 - 10, FY1 = y1 - 10, alongX = FX1 - FX0 >= FY1 - FY0;
    for (let f = 0; f < floors; f++) {
      const z = f * S, holes = flights.filter(F => F.f + 1 === f).map(F => F.hole);
      const cells = new Set();
      for (const [a, c, e, g] of minus([FX0, FY0, FX1, FY1], holes)) for (const k of cellsOfRect(a / 10, c / 10, e / 10, g / 10)) cells.add(k);
      const pieces = tiles && f === 0 ? floorPieces(cells, 'hallChecker', { colors: tiles }) : floorPieces(cells, 'townPlanks', { salt: s * 7 + f });
      for (const p of pieces) box(p.x0 * 10, p.y0 * 10, z, p.x1 * 10, p.y1 * 10, z + 4, p.brick);
    }
    if (flat) {
      const holes = flights.filter(F => F.f + 1 === floors).map(F => F.hole);
      for (const [a, c, e, g] of minus([FX0, FY0, FX1, FY1], holes)) box(a, c, h, e, g, h + 4, { asset: 'PB_DefaultMicroBrick', color: PALETTE.stone[1] });
      const pc = { asset: 'PB_DefaultMicroBrick', color: wallColor.map(v => Math.round(v * 0.94)) };
      box(x0, y0, h, x1, y0 + 10, h + 24, pc); box(x0, y1 - 10, h, x1, y1, h + 24, pc);
      box(x0, y0 + 10, h, x0 + 10, y1 - 10, h + 24, pc); box(x1 - 10, y0 + 10, h, x1, y1 - 10, h + 24, pc);
      for (let x = x0; x + 20 <= x1; x += 40) for (const y of [y0, y1 - 10]) box(x, y, h + 24, x + 20, y + 10, h + 40, pc);
      for (let y = y0 + 40; y + 20 <= y1 - 20; y += 40) for (const x of [x0, x1 - 10]) box(x, y, h + 24, x + 10, y + 20, h + 40, pc);
    } else gable(x0, y0, x1, y1, h, rise, roofColor, ridge, { color: upperColor && floors > 1 ? upperColor : wallColor, inset: 0 });

    // ---- furniture, in the local frame (zf(f) = top of that floor's boards)
    const zf = f => f * S + 4, ceil = f => (f + 1) * S;
    /** a box against a wall: along [a0, a1] (v for side walls, u for the back), [b0, b1] in from its inner face */
    const wb = (wl, a0, a1, b0, b1, z0, z1, m) =>
      wl === 'right' ? lbox(U - b1, a0, U - b0, a1, z0, z1, m) : wl === 'left' ? lbox(-U + b0, a0, -U + b1, a1, z0, z1, m) : lbox(a0, V - b1, a1, V - b0, z0, z1, m);
    const wput = (wl, asset, a, b, z, m) =>
      wl === 'right' ? lput(asset, U - b, a, z, m) : wl === 'left' ? lput(asset, -U + b, a, z, m) : lput(asset, a, V - b, z, m);
    const STONE = { color: PALETTE.stone[0] }, DARK = { color: PALETTE.stone[1] }, WOOD = { color: PALETTE.timber[1] }, WOOD2 = { color: PALETTE.timber[0] };
    const furnish = {
      /** fireplace centred at `a` along a wall, with its breast up to the ceiling */
      fireplace(wl, a, f) {
        const z0 = zf(f);
        wb(wl, a - 20, a - 10, 0, 20, z0, z0 + 48, STONE);
        wb(wl, a + 10, a + 20, 0, 20, z0, z0 + 48, STONE);
        wb(wl, a - 10, a + 10, 0, 10, z0, z0 + 48, DARK);
        wb(wl, a - 10, a + 10, 10, 20, z0, z0 + 4, DARK);
        wput(wl, 'B_Flame', a, 15, z0 + 4 + 10, GLOW([255, 130, 40], 8));
        wb(wl, a - 20, a + 20, 0, 20, z0 + 48, z0 + 60, WOOD);
        wb(wl, a - 20, a + 20, 0, 10, z0 + 60, ceil(f), STONE);
        for (const k of [-14, 14]) wput(wl, 'B_Chalice', a + k, 15, z0 + 60 + 10, { color: [200, 160, 70], material: 'BMC_Metallic' });
      },
      /** bed along v: head at vHead, foot toward vHead + dir * 90, u from u0 to u0 + 40 */
      bed(u0, vHead, dir, f, blanket) {
        const z0 = zf(f), sp = (a, b) => [Math.min(vHead + dir * a, vHead + dir * b), Math.max(vHead + dir * a, vHead + dir * b)];
        const [h0, h1] = sp(0, 10), [f0, f1] = sp(10, 90), [p0, p1] = sp(10, 30), [b0, b1] = sp(30, 90);
        lbox(u0, h0, u0 + 40, h1, z0, z0 + 36, WOOD);
        lbox(u0, f0, u0 + 40, f1, z0, z0 + 12, WOOD2);
        lbox(u0, p0, u0 + 40, p1, z0 + 12, z0 + 16, { asset: 'PB_DefaultTile', color: [236, 232, 222] });
        lbox(u0, b0, u0 + 40, b1, z0 + 12, z0 + 16, { asset: 'PB_DefaultTile', color: blanket });
      },
      /** table centred (u, v) standing at height z0, stools on the floor below at `stools` */
      table(u, v, f, rug, stools = []) {
        const z0 = zf(f) + (rug ? 4 : 0);
        lpole(u, v, z0, z0 + 24, 5, WOOD);
        lbox(u - 20, v - 20, u + 20, v + 20, z0 + 24, z0 + 28, { asset: 'PB_DefaultTile', color: PALETTE.timber[1] });
        for (const [su, sv] of stools) lpole(su, sv, zf(f), zf(f) + 16, 5, WOOD2);
      },
      rug(u0, v0, u1, v1, f, color) { lbox(u0, v0, u1, v1, zf(f), zf(f) + 4, { asset: 'PB_DefaultTile', color }); },
      cupboard(wl, a0, a1, f, height = 60) {
        wb(wl, a0, a1, 0, 20, zf(f), zf(f) + height, WOOD);
        wb(wl, a0, a1, 0, 20, zf(f) + height, zf(f) + height + 4, WOOD2);
      },
      bookcase(wl, a0, a1, f) {
        wb(wl, a0, a1, 0, 20, zf(f), zf(f) + 60, WOOD2);
        [8, 28, 48].forEach((zz, k) => {
          for (let a = a0 + 2, j = 0; a + 6 <= a1 - 2; a += 6, j++)
            wb(wl, a, a + 6, 20, 24, zf(f) + zz, zf(f) + zz + 10 + ((j + k) % 2) * 2, { ...MICRO, color: pick(PALETTE.books, s, k * 31 + j, 7) });
        });
      },
      chest(u0, v0, u1, v1, f) {
        lbox(u0, v0, u1, v1, zf(f), zf(f) + 20, { color: [110, 76, 46] });
        lbox(u0, v0, u1, v1, zf(f) + 20, zf(f) + 24, { color: [70, 66, 62], material: 'BMC_Metallic' });
      },
      barrel(u, v, f) { lpole(u, v, zf(f), zf(f) + 28, 10, { color: [120, 84, 50] }); },
      crate(u, v, f, z = 0) { lbox(u - 10, v - 10, u + 10, v + 10, zf(f) + z, zf(f) + z + 20, { color: pick([[150, 110, 70], [140, 100, 64], [160, 122, 80]], s, u + z, v) }); },
      lantern(u, v, f) { lbox(u - 5, v - 5, u + 5, v + 5, ceil(f) - 8, ceil(f), GLOW([255, 196, 120], 5)); },
      pot(u, v, f) { lpole(u, v, zf(f), zf(f) + 12, 10, { color: [150, 80, 50] }); lput('B_Fern', u, v, zf(f) + 12 + 2, { color: [70, 130, 50] }); },
    };
    // every furnish piece is furniture (FURNITURE switch)
    for (const k of Object.keys(furnish)) { const fn = furnish[k]; furnish[k] = (...a) => { FURN++; try { return fn(...a); } finally { FURN--; } }; }
    return { x0, y0, x1, y1, h, U, V, w, d, frontPos: [cx + fx * (fx ? ex : 0), cy + fy * (fy ? ey : 0)], lbox, lpole, lput, zf, ceil, furnish };
  }

  /**
   * A roomy house from the wallgen tool (wallhouse.mjs): W x D studs (both
   * multiples of 4 so the gable wedges land on the micro grid), `storeys`
   * 120-unit storeys, centred (cx, cy), front door facing (fx, fy). Running-bond
   * brick walls (ground storey `wallColor`, upper ones `upperColor`), glazed
   * windows, tile floors, a ceiling under a gable roof, wallgen's stairs, and a
   * little furniture in each room.
   */
  /**
   * Lays a wallgen plan (wallhouse.mjs / wallshop.mjs result) centred (cx, cy),
   * front facing (fx, fy), and returns stud-space helpers for fitting it out:
   * sbox (stud box), mput (a brick at stud coords with local half extents
   * [across, depth, up] in world units), clear (off the stair and its
   * stairwell by 2 studs), gableOn (the roof), STOREY_H.
   */
  function renderWallgen(h, cx, cy, fx, fy, s, { wallColor, upperColor = wallColor }) {
    const { W, D } = h;
    const w = (W + 1) * 10, d = (D + 1) * 10;
    const lat = fx ? [0, 1] : [1, 0];
    const P = (u, v) => [cx + lat[0] * u + fx * (d / 2 - v), cy + lat[1] * u + fy * (d / 2 - v)];
    // stud-space box (x across the front, y back from the front face) -> world
    const sbox = (x0, y0, x1, y1, z0, z1, b) => {
      const [ax, ay] = P(x0 * 10 - w / 2, y0 * 10), [bx, by] = P(x1 * 10 - w / 2, y1 * 10);
      box(Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1, b);
    };
    const mput = (xs, ys, z, [eu, ev, ez], b) => {
      const [px, py] = P(xs * 10 - w / 2, ys * 10);
      put({ ...b, size: fx ? [ev, eu, ez] : [eu, ev, ez] }, px, py, z);
    };
    // wall cells by the z their brick tops out at
    const wallTop = new Set();
    for (const w of h.boxes) if (w.kind === 'wall') for (let x = w.x0; x < w.x1; x++) for (let y = w.y0; y < w.y1; y++) wallTop.add(x + ',' + y + ',' + w.z1);
    const slabCells = b => cellsOfRect(b.x0, b.y0, b.x1, b.y1);
    const F = [1, 0.9, 1.07, 0.95, 1.03];
    const shade = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * F[k % F.length]))));
    for (const b of h.boxes) {
      if (b.kind === 'wall') {
        const k = Math.floor(rnd(s, b.x0 * 131 + b.y0, b.course) * 5);
        sbox(b.x0, b.y0, b.x1, b.y1, b.z0, b.z1, { color: shade(b.course < WH_COURSES ? wallColor : upperColor, k) });
      } else if (b.kind === 'glass') sbox(b.x0, b.y0, b.x1, b.y1, b.z0, b.z1, GLASS);
      else if (b.kind === 'floor') {
        // checkerboard floors (owner, 2026-10-03); under every upper floor a
        // ceiling of face-down tiles, so no studded undersides show from below
        for (const p of floorPieces(slabCells(b), 'checker')) sbox(p.x0, p.y0, p.x1, p.y1, b.z0, b.z1, p.brick);
        if (b.z0 > 0) {
          // the ceiling below it, skipping cells over a wall top (the floor runs over door lintels)
          const open = new Set([...slabCells(b)].filter(k => !wallTop.has(k + ',' + b.z0)));
          for (const p of floorPieces(open, 'checkerCeiling')) sbox(p.x0, p.y0, p.x1, p.y1, b.z0 - 4, b.z0, p.brick);
        }
      } else if (b.kind === 'ceiling') for (const p of floorPieces(slabCells(b), 'checkerCeiling')) sbox(p.x0, p.y0, p.x1, p.y1, b.z0, b.z1, p.brick);
      // steps are 1-brick treads with nothing under them, like shapedhouse's (owner
      // 2026-10-04: wallgen's solid columns are the legacy stairs)
      else if (b.kind === 'stair') sbox(b.x0, b.y0, b.x1, b.y1, Math.max(b.z0, b.z1 - 12), b.z1, { asset: 'PB_DefaultTile', color: PALETTE.timber[1] });
    }
    const stair = h.boxes.filter(b => b.kind === 'stair');
    const clear = (x0, y0, x1, y1) => !stair.some(t => x0 < t.x1 + 2 && t.x0 - 2 < x1 && y0 < t.y1 + 2 && t.y0 - 2 < y1);
    // gable roof, ridge along the front, 15 units of overhang all round
    // the gable end matches the storey under it (a 1-storey house has no plaster upper storey)
    const upper = h.boxes.some(b => b.kind === 'wall' && b.course >= WH_COURSES);
    const gableOn = (rise, roofColor) => {
      const [ax, ay] = P(-w / 2, 0), [bx, by] = P(w / 2, d);
      gable(Math.min(ax, bx) - 5, Math.min(ay, by) - 5, Math.max(ax, bx) + 5, Math.max(ay, by) + 5, h.top, rise, roofColor, !fx, { color: upper ? upperColor : wallColor, inset: 5 });
    };
    const at = (xs, ys) => P(xs * 10 - w / 2, ys * 10);
    return { sbox, mput, clear, gableOn, at, STOREY_H: WH_COURSES * 12 };
  }

  /**
   * Blacksmith fittings in a wallgen plan's stud space (owner 2026-10-04: the
   * old ones were wacky), floor top f, ceiling underside top:
   *   forge(x0, y0, back): 3 x 3 stone hearth, coals in a rim of stones, the
   *     chimney up the `back` row ('+y' '-y' '+x' '-x') to the ceiling and a
   *     stepped hood off it over the coals
   *   anvil(x, y): an iron anvil (foot, waist, face, horn toward +x) on a
   *     2 x 2 log stump; takes x-1 .. x+4, y-1 .. y+3
   *   rack(rx, y0, y1, side): swords hung blade-up on two rails along the
   *     wall on `side` ('-x' | '+x') of column rx, y0 .. y1
   */
  function smithKit(sbox, mput, f, top) {
    const MB = 'PB_DefaultMicroBrick', STONE = PALETTE.stone[0], RIM = PALETTE.stone[1], SOOT = [62, 58, 54];
    const IRON = { color: [54, 54, 58], material: 'BMC_Metallic' }, STEEL = { asset: MB, color: [200, 204, 214], material: 'BMC_Metallic' };
    const BRASS = { asset: MB, color: [184, 146, 66], material: 'BMC_Metallic' }, GRIP = { asset: MB, color: [86, 56, 34] };
    return {
      forge(x0, y0, back) {
        // row r (0 front .. 2 back), column c -> stud cell
        const at = (r, c) => back === '+y' ? [x0 + c, y0 + r] : back === '-y' ? [x0 + c, y0 + 2 - r] : back === '+x' ? [x0 + r, y0 + c] : [x0 + 2 - r, y0 + c];
        const cb = (r0, r1, c0, c1, z0, z1, m) => {
          const [ax, ay] = at(r0, c0), [bx, by] = at(r1, c1);
          sbox(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx) + 1, Math.max(ay, by) + 1, z0, z1, m);
        };
        cb(0, 2, 0, 2, f, f + 24, { color: STONE });
        cb(1, 1, 1, 1, f + 24, f + 28, { asset: 'PB_DefaultTile', ...GLOW([255, 110, 30], 7) });
        cb(0, 0, 0, 2, f + 24, f + 30, { asset: MB, color: RIM });
        for (const c of [0, 2]) cb(1, 1, c, c, f + 24, f + 30, { asset: MB, color: RIM });
        cb(2, 2, 0, 2, f + 24, top, { color: SOOT });
        cb(0, 1, 0, 2, f + 60, f + 66, { asset: MB, color: SOOT });
        cb(1, 1, 0, 2, f + 66, f + 76, { asset: MB, color: SOOT });
      },
      anvil(x, y) {
        mput(x + 1, y + 1, f + 8, [10, 10, 8], { asset: 'PB_DefaultPole', color: [104, 72, 44] });
        mput(x + 1, y + 1, f + 18, [8, 6, 2], { asset: MB, ...IRON });
        mput(x + 1, y + 1, f + 23, [4, 4, 3], { asset: MB, ...IRON });
        mput(x + 1, y + 1, f + 29, [12, 5, 3], { asset: MB, ...IRON });
        mput(x + 2.6, y + 1, f + 28, [4, 3, 2], { asset: MB, ...IRON });
        mput(x + 0.6, y + 1, f + 33, [4, 1, 1], { asset: MB, color: [96, 66, 40] }); // hammer handle
        mput(x + 0.1, y + 1, f + 34, [1, 2, 2], { asset: MB, ...IRON });           // hammer head
      },
      rack(rx, y0, y1, side) {
        const xs = d => side === '-x' ? rx + d / 10 : rx + 1 - d / 10; // d units out from the wall
        for (const z of [f + 10, f + 46]) mput(xs(2), (y0 + y1) / 2, z, [2, (y1 - y0) * 5, 2], { asset: MB, color: PALETTE.timber[0] });
        for (let y = y0 + 1; y < y1; y += 2) {
          mput(xs(5), y, f + 7, [2, 2, 1], BRASS);        // pommel
          mput(xs(5), y, f + 11, [1, 1, 3], GRIP);        // grip
          mput(xs(5), y, f + 15, [2, 5, 1], BRASS);       // guard
          mput(xs(5), y, f + 34, [1, 2, 18], STEEL);      // blade
        }
      },
    };
  }

  /**
   * A roomy house from the wallgen tool (wallhouse.mjs): W x D studs (both
   * multiples of 4 so the gable wedges land on the micro grid), `storeys`
   * storeys of WH_COURSES courses, centred (cx, cy), front door facing (fx,
   * fy), with a little furniture in each room.
   */
  function wallHouse(cx, cy, fx, fy, W, D, storeys, s, { wallColor, upperColor = wallColor, roofColor, rise }) {
    const h = planHouse({ W, D, storeys, seed: s });
    // by chance a blacksmith's house: stone ground storey, a forge, anvil and
    // weapon rack in the parlour, and a sword-shop stand by the window
    const smith = rnd(s, 77) < HOUSE_SHOP_CHANCE;
    if (smith) wallColor = pick(PALETTE.stone, s, 79);
    const { sbox, mput, clear, gableOn, at, STOREY_H } = renderWallgen(h, cx, cy, fx, fy, s, { wallColor, upperColor });
    FURN++; // furniture (FURNITURE switch)
    // furniture, kept off the stair (and the stairwell above it) by 2 studs
    const { h1, a, b: split } = h.rooms;
    const rooms = [[1, h1 + 1, a, D], [a + 1, h1 + 1, W, D]];
    const parlour = split < W / 2 ? [1, 1, split, h1] : [split + 1, 1, W, h1];
    // by chance a sword-shop stand (the bronze shop prefab family, stamped by
    // mapgen with br.Prefab.Load) in the parlour's front corner, its button
    // facing back into the room; never rune (owner: no rune at spawn)
    const left = split < W / 2;
    if (smith) {
      // 3 studs in from the side wall and 3.5 back from the front, so the stand
      // (bucket and price board) stays clear of the walls (owner 2026-10-04: one
      // poked out through the front wall)
      const sx = left ? parlour[0] + 3 : parlour[2] - 3, sy = 3.5;
      if (clear(Math.floor(sx) - 2, 0, Math.floor(sx) + 3, 7)) {
        const [px, py] = at(sx, sy);
        // local +y (into the house) in world terms is (-fx, -fy)
        const orient = fx ? (fx > 0 ? 19 : 17) : (fy > 0 ? 16 : 18);
        stats.houseShops.push({ at: [px, py, 16 + (zCtx ?? 0)], orient, tier: pick(shopTiers, s, 78) }); // the tiers sold where it stands (spawn low, deeper higher)
      }
    }
    if (smith) {
      const [x0, , x1] = parlour, f = 4, kit = smithKit(sbox, mput, f, STOREY_H - 4);
      // forge in the parlour's back corner away from the stand, its chimney
      // against the back wall
      const fx0 = left ? x1 - 3 : x0;
      if (clear(fx0, h1 - 3, fx0 + 3, h1)) kit.forge(fx0, h1 - 3, '+y');
      // anvil in the middle of the room
      const mx = Math.floor((x0 + x1) / 2) - 1, my = Math.floor((1 + h1) / 2) - 1;
      if (clear(mx - 1, my - 1, mx + 4, my + 3)) kit.anvil(mx, my);
      // sword rack on the outer side wall, behind the stand
      const rx = left ? x0 : x1 - 1, y1r = Math.min(h1 - 1, 15);
      if (y1r - 8 >= 4 && clear(rx, 8, rx + 1, y1r)) kit.rack(rx, 8, y1r, left ? '-x' : '+x');
    }
    const timber = PALETTE.timber[0];
    for (let st = 0; st < storeys; st++) {
      const f = st * STOREY_H + 4, ceil = (st + 1) * STOREY_H - 4;
      [...rooms, parlour].forEach(([x0, y0, x1, y1], r) => {
        const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2);
        if (smith && st === 0 && r === 2) return; // the smithy parlour is fitted above
        if (!clear(mx - 3, my - 3, mx + 3, my + 3)) return;
        if (st > 0 && r < 2) {
          // bedroom: bed against the back wall, a chest at its foot
          const bx = mx - 1;
          if (!clear(bx, D - 8, bx + 3, D)) return;
          sbox(bx, D - 6, bx + 3, D, f, f + 12, { color: timber });
          sbox(bx, D - 5, bx + 3, D, f + 12, f + 16, { asset: 'PB_DefaultTile', color: pick(PALETTE.blanket, s, st, r) });
          sbox(bx, D - 6, bx + 3, D - 5, f + 12, f + 16, { color: [236, 232, 222] });
          sbox(bx, D - 8, bx + 3, D - 7, f, f + 12, { color: PALETTE.timber[2] });
        } else {
          // table on a rug, a stool either side
          sbox(mx - 3, my - 2, mx + 3, my + 2, f, f + 4, { asset: 'PB_DefaultTile', color: pick(PALETTE.rug, s, st, r) });
          sbox(mx, my, mx + 1, my + 1, f + 4, f + 28, { color: timber });
          sbox(mx - 1, my - 1, mx + 2, my + 2, f + 28, f + 32, { color: PALETTE.timber[1] });
          for (const sx of [-2, 2]) sbox(mx + sx, my, mx + sx + 1, my + 1, f + 4, f + 16, { color: timber });
        }
        // a lantern under the ceiling
        if (clear(mx, my, mx + 1, my + 1)) sbox(mx, my, mx + 1, my + 1, ceil - 8, ceil, GLOW([255, 196, 120], 5));
      });
    }
    FURN--;
    // front step under the door
    const fd = h.rooms.fd;
    sbox(fd - 3, -2, fd + 3, 0, 0, 4, { color: PALETTE.stone[2] });
    gableOn(rise, roofColor);
    return h;
  }

  /**
   * A shop from the wallgen tool (wallshop.mjs): sales floor across the front
   * behind a double door and display windows, a counter with stock shelves
   * behind it, storeroom and workroom at the back, rooms upstairs; fitted out
   * by `kind` (smithy, general, bakery, apothecary), with an awning and a sign.
   */
  function wallShop(cx, cy, fx, fy, W, D, storeys, s, kind, { wallColor, upperColor = wallColor, roofColor, rise, cloth }) {
    const h = planShop({ W, D, storeys, seed: s, kind });
    const { sbox, mput, clear, gableOn, STOREY_H } = renderWallgen(h, cx, cy, fx, fy, s, { wallColor, upperColor });
    const { s1, a, fd, dw, hall, lw, rw, ww } = h.rooms;
    const timber = PALETTE.timber[0], dark = PALETTE.timber[2], stone = PALETTE.stone[0];
    const f = 4; // ground floor top
    const taken = stats.taken = [];
    // a fit-out piece: skipped if it would sit on the stair or on another piece
    const piece = (x0, y0, x1, y1, fn) => {
      if (!clear(x0, y0, x1, y1) || taken.some(([a0, b0, a1, b1]) => x0 < a1 && a0 < x1 && y0 < b1 && b0 < y1)) return false;
      taken.push([x0, y0, x1, y1]); fn(); return true;
    };
    const crate = (x, y, z = f) => sbox(x, y, x + 2, y + 2, z, z + 20, { color: [150, 110, 70] });
    const barrel = (x, y) => mput(x + 1, y + 1, f + 14, [10, 10, 14], { asset: 'PB_DefaultPole', color: [120, 84, 50] });

    FURN++; // fit-out (FURNITURE switch)
    // counter across the sales floor, a gap in front of the back-room door
    const cy0 = s1 - 6;
    for (const [x0, x1] of [[3, hall - 3], [hall + 3, W - 3]]) {
      if (x1 - x0 < 2) continue;
      piece(x0, cy0, x1, cy0 + 2, () => {
        sbox(x0, cy0, x1, cy0 + 2, f, f + 32, { color: dark });
        sbox(x0, cy0, x1, cy0 + 2, f + 32, f + 36, { asset: 'PB_DefaultTile', color: PALETTE.timber[1] });
      });
      // stock shelves against the back wall behind it
      piece(x0, s1 - 2, x1, s1, () => {
        sbox(x0, s1 - 2, x1, s1, f, f + 56, { color: timber });
        for (let x = x0; x + 1 < x1; x += 2) {
          if (kind === 'apothecary' || kind === 'general') mput(x + 1, s1 - 1, f + 56 + 12, [0, 0, 0], { asset: 'B_Jar', color: pick(PALETTE.goods, s, x, 21), material: 'BMC_Glass' });
          else if (kind === 'bakery') mput(x + 1, s1 - 1, f + 56 + 4, [8, 4, 4], { asset: 'PB_DefaultMicroBrick', color: [196, 140, 70] });
          else mput(x + 1, s1 - 1, f + 56 + 2, [8, 4, 2], { asset: 'PB_DefaultMicroBrick', color: [170, 172, 180], material: 'BMC_Metallic' });
        }
      });
    }
    // wares on the counter top
    for (let x = 4; x < W - 4; x += 4) {
      if (Math.abs(x - hall) < 4 || !clear(x, cy0, x + 1, cy0 + 2)) continue;
      const z = f + 36;
      if (kind === 'bakery') mput(x + 0.5, cy0 + 1, z + 4, [8, 4, 4], { asset: 'PB_DefaultMicroBrick', color: [206, 150, 80] });
      else if (kind === 'apothecary') mput(x + 0.5, cy0 + 1, z + 10, [0, 0, 0], { asset: 'B_Chalice', color: [200, 160, 70], material: 'BMC_Metallic' });
      else if (kind === 'general') mput(x + 0.5, cy0 + 1, z + 8, [0, 0, 0], { asset: 'B_Pumpkin', color: [230, 120, 30] });
      else mput(x + 0.5, cy0 + 1, z + 2, [14, 2, 2], { asset: 'PB_DefaultMicroBrick', color: [200, 204, 214], material: 'BMC_Metallic' });
    }

    // the trade itself, on the customers' side (y 1 .. counter - 2)
    const sideL = 2, sideR = W - 6, front = 2, back = cy0 - 5;
    if (kind === 'smithy') {
      // forge in a back corner of the sales floor (chimney on its counter
      // side), an anvil out front, a sword rack on the side wall
      const kit = smithKit(sbox, mput, f, STOREY_H - 4);
      piece(sideR, back, sideR + 3, back + 3, () => kit.forge(sideR, back, '+y'));
      const ax = Math.floor(W / 2) - 6;
      piece(ax - 1, front + 1, ax + 4, front + 5, () => kit.anvil(ax, front + 2));
      piece(1, front + 1, 2, front + 9, () => kit.rack(1, front + 1, front + 9, '-x'));
      barrel(sideL, back);
    } else if (kind === 'bakery') {
      // a big stone oven with a glowing mouth, flour sacks, a bread rack
      piece(sideR, back - 1, sideR + 4, back + 4, () => {
        sbox(sideR, back, sideR + 4, back + 4, f, f + 48, { color: [176, 120, 90] });
        sbox(sideR, back + 4 - 4, sideR + 4, back + 4, f + 48, f + 72, { color: [140, 96, 72] }); // chimney breast
        sbox(sideR + 1, back - 1, sideR + 3, back, f + 12, f + 28, GLOW([255, 140, 50], 6));
      });
      for (const [x, y] of [[sideL, back], [sideL + 2, back], [sideL, back - 2]])
        piece(x, y, x + 2, y + 2, () => sbox(x, y, x + 2, y + 2, f, f + 16, { color: [230, 224, 206] }));
      piece(1, front + 1, 2, front + 7, () => {
        for (const z of [f + 24, f + 48]) sbox(1, front + 1, 2, front + 7, z, z + 4, { color: timber });
        for (let y = front + 1; y < front + 7; y += 2) mput(1.5, y + 1, f + 52 + 4, [4, 8, 4], { asset: 'PB_DefaultMicroBrick', color: [206, 150, 80] });
      });
    } else if (kind === 'apothecary') {
      // bookcase and a cabinet of coloured bottles on the side walls, a herb table
      piece(1, front + 1, 2, front + 9, () => {
        // a thin back panel with two shelves, the books standing on them in front of it
        sbox(1, front + 1, 1.4, front + 9, f, f + 72, { asset: 'PB_DefaultMicroBrick', color: dark });
        for (const z of [f + 18, f + 42]) sbox(1.4, front + 1, 2, front + 9, z, z + 2, { asset: 'PB_DefaultMicroBrick', color: dark });
        for (let y = front + 1; y < front + 9; y++)
          for (const z of [f + 20, f + 44]) mput(1.7, y + 0.5, z + 8, [3, 4, 8], { asset: 'PB_DefaultMicroBrick', color: pick(PALETTE.books, s, y, z) });
      });
      piece(W - 2, front + 1, W, front + 9, () => {
        sbox(W - 2, front + 1, W, front + 9, f, f + 48, { color: dark });
        for (let y = front + 1; y < front + 9; y += 2) mput(W - 1, y + 1, f + 48 + 12, [0, 0, 0], { asset: 'B_Jar', color: pick(PALETTE.goods, s, y, 31), material: 'BMC_Glass' });
      });
      piece(Math.floor(W / 2) - 2, back - 1, Math.floor(W / 2) + 2, back + 1, () => {
        const x = Math.floor(W / 2) - 2;
        sbox(x, back - 1, x + 4, back + 1, f + 28, f + 32, { color: PALETTE.timber[1] });
        for (const px of [x, x + 3]) sbox(px, back - 1, px + 1, back, f, f + 28, { color: timber });
        mput(x + 2, back, f + 32 + 2, [0, 0, 0], { asset: 'B_Fern', color: [70, 130, 50] });
      });
    } else {
      // general store: crates, barrels, sacks along the walls
      for (const [x, y] of [[sideL, back], [sideL + 2, back], [sideL, back - 2], [sideR + 2, back], [sideR + 2, back - 2]])
        piece(x, y, x + 2, y + 2, () => { crate(x, y); if (x === sideL && y === back) crate(x, y, f + 20); });
      for (const [x, y] of [[sideR, back], [sideL, front + 1]]) piece(x, y, x + 2, y + 2, () => barrel(x, y));
    }

    // back rooms: storeroom crates and barrels, a workbench
    const backRooms = [[1, s1 + 1, a, D], [a + 1, s1 + 1, W, D]];
    backRooms.forEach(([x0, y0, x1, y1], r) => {
      if (r === 0) {
        for (const [x, y] of [[x0 + 1, y1 - 3], [x0 + 3, y1 - 3], [x0 + 1, y1 - 5]]) piece(x, y, x + 2, y + 2, () => crate(x, y));
        piece(x1 - 3, y1 - 3, x1 - 1, y1 - 1, () => barrel(x1 - 3, y1 - 3));
      } else {
        const mx = Math.floor((x0 + x1) / 2);
        piece(mx - 2, y1 - 2, mx + 2, y1, () => {
          sbox(mx - 2, y1 - 2, mx + 2, y1, f + 28, f + 32, { color: PALETTE.timber[1] });
          for (const px of [mx - 2, mx + 1]) sbox(px, y1 - 2, px + 1, y1 - 1, f, f + 28, { color: timber });
        });
      }
    });
    // upstairs: living quarters, a bed in each back room, a table out front
    for (let st = 1; st < storeys; st++) {
      const fz = st * STOREY_H + 4;
      backRooms.forEach(([x0, y0, x1, y1], r) => {
        const bx = Math.floor((x0 + x1) / 2) - 1;
        if (!clear(bx, D - 8, bx + 3, D)) return;
        sbox(bx, D - 6, bx + 3, D, fz, fz + 12, { color: timber });
        sbox(bx, D - 5, bx + 3, D, fz + 12, fz + 16, { asset: 'PB_DefaultTile', color: pick(PALETTE.blanket, s, st, r) });
        sbox(bx, D - 6, bx + 3, D - 5, fz + 12, fz + 16, { color: [236, 232, 222] });
      });
      const mx = Math.floor(W / 2), my = Math.floor(s1 / 2);
      if (clear(mx - 2, my - 2, mx + 3, my + 3)) {
        sbox(mx, my, mx + 1, my + 1, fz, fz + 28, { color: timber });
        sbox(mx - 1, my - 1, mx + 2, my + 2, fz + 28, fz + 32, { color: PALETTE.timber[1] });
      }
    }
    // lanterns: the sales floor and each back room, every storey
    for (let st = 0; st < storeys; st++) {
      const ceil = (st + 1) * STOREY_H - 4;
      for (const [x, y] of [[Math.floor(W / 4), Math.floor(s1 / 2)], [Math.floor((3 * W) / 4), Math.floor(s1 / 2)], [Math.floor(a / 2), Math.floor((s1 + D) / 2)], [Math.floor((a + W) / 2), Math.floor((s1 + D) / 2)]])
        if (clear(x, y, x + 1, y + 1)) sbox(x, y, x + 1, y + 1, ceil - 8, ceil, GLOW([255, 196, 120], 5));
    }

    FURN--;
    // outside: a step under the double door, a striped awning over the door
    // and both display windows on posts, a hanging sign by the door
    sbox(fd - dw / 2 - 1, -2, fd + dw / 2 + 1, 0, 0, 4, { color: PALETTE.stone[2] });
    const ax0 = lw - ww / 2 - 1, ax1 = rw + ww / 2 + 1, awZ = WH_COURSES * 12 - 40;
    for (let x = ax0; x < ax1; x += 2) sbox(x, -3, Math.min(ax1, x + 2), 0, awZ, awZ + 4, { color: ((x - ax0) / 2) % 2 ? [236, 230, 214] : cloth });
    for (const px of [ax0, ax1 - 1]) sbox(px, -3, px + 1, -2, 4, awZ, { color: timber });
    mput(fd + dw / 2 + 2.5, -1, 64, [10, 2, 10], { asset: 'PB_DefaultMicroBrick', color: cloth });
    gableOn(rise, roofColor);
    return h;
  }

  /** a shapedhouse.mjs house centred (cx, cy), its front door facing (fx, fy) */
  function shapedTown(cx, cy, fx, fy, sp, s) {
    const h = shapedHouse({ ...sp, seed: s });
    const lx = ((sp.W + 1) * 10) / 2, ly = shapedDepth(sp) / 2;
    // local front faces -y; quarter turns that bring it round to (fx, fy)
    const r = fy < 0 ? 0 : fx > 0 ? 1 : fy > 0 ? 2 : 3;
    for (const b of h.bricks) {
      const t = turnBrick({ ...b, position: [b.position[0] - lx, b.position[1] - ly, b.position[2]] }, r);
      put(t, cx + t.position[0], cy + t.position[1], t.position[2]);
    }
    // world spot of a local point, and the prefab orientation whose button faces
    // local -y (the street): 16 -y, 17 +x, 18 +y, 19 -x
    h.at = (x, y) => { let [u, v] = [x - lx, y - ly]; for (let i = 0; i < r; i++) [u, v] = [-v, u]; return [cx + u, cy + v]; };
    h.frontOrient = [16, 17, 18, 19][r];
    return h;
  }

  // -------------------------------------------------------------- castle --
  // RuneScape (2026-10-05, owner: town more RuneScape-like): a Lumbridge-style
  // castle on the block north of the square. Coursed grey curtain wall with
  // merlons, round corner towers with crenellated caps (a flag on one), a
  // gatehouse facing the square with a raised portcullis, a grass courtyard,
  // and a three-storey keep with corner turrets, a throne room and stairs up
  // onto its battlements.
  /** coursed stone: blocks 40-80 long along the longer side, joints staggered, shaded */
  function masonry(x0, y0, x1, y1, z0, z1, base, sk) {
    const alongX = x1 - x0 >= y1 - y0, a = alongX ? x0 : y0, b = alongX ? x1 : y1;
    const LEN = [60, 40, 80, 50, 70, 40, 60, 80], SH = [1, 0.92, 1.06, 0.96, 1.03, 0.9];
    const tone = n => ({ color: base.map(v => Math.min(255, Math.round(v * SH[n % SH.length]))) });
    const seg = (p, q, z, zt, n) => alongX ? box(p, y0, z, q, y1, zt, tone(n)) : box(x0, p, z, x1, q, zt, tone(n));
    for (let z = z0, k = 0; z < z1; z += 12, k++) {
      const zt = Math.min(z1, z + 12);
      let p = a, n = Math.floor(rnd(sk, a, k) * LEN.length) + k * 3;
      if (k % 2 && b - a >= 70) { seg(p, p + 30, z, zt, n++); p += 30; }
      while (p < b) {
        let q = p + LEN[n % LEN.length];
        if (b - q < 40) q = b;
        seg(p, q, z, zt, n++); p = q;
      }
    }
  }
  function castle(CX, CY) {
    const R = 440, T = 20, CH = 168, GREY = [138, 136, 130], CAP = { color: [120, 118, 114] };
    const merlons = (x0, y0, x1, y1, z) => {
      const alongX = x1 - x0 >= y1 - y0;
      for (let p = (alongX ? x0 : y0) + 10; p + 20 <= (alongX ? x1 : y1) - 10; p += 60)
        alongX ? box(p, y0, z, p + 20, y1, z + 24, CAP) : box(x0, p, z, x1, p + 20, z + 24, CAP);
    };
    const run = (x0, y0, x1, y1, sk) => { masonry(x0, y0, x1, y1, 0, CH, GREY, sk); merlons(x0, y0, x1, y1, CH); };
    // curtain: north, west, east whole; south split round the gatehouse
    run(CX - R + 70, CY + R - T, CX + R - 70, CY + R + T, 31);
    for (const sx of [-1, 1]) run(CX + sx * R - T, CY - R + 70, CX + sx * R + T, CY + R - 70, 32 + sx);
    run(CX - R + 70, CY - R - T, CX - 160, CY - R + T, 35);
    run(CX + 160, CY - R - T, CX + R - 70, CY - R + T, 36);
    // gatehouse: two round towers, a lintel over the arch, portcullis raised
    for (const sx of [-1, 1]) {
      pole(CX + sx * 110, CY - R, 0, CH + 48, 50, { color: GREY });
      pole(CX + sx * 110, CY - R, CH + 48, CH + 56, 55, CAP);
      put({ size: [10, 10, 6], ...GLOW([255, 160, 60], 8) }, CX + sx * 110, CY - R, CH + 62);
    }
    masonry(CX - 60, CY - R - T, CX + 60, CY - R + T, 96, CH, GREY, 37);
    merlons(CX - 60, CY - R - T, CX + 60, CY - R + T, CH);
    for (let x = -50; x <= 50; x += 20) pole(CX + x, CY - R, 76, 96, 5, { color: [46, 44, 42], material: 'BMC_Metallic' });
    // corner towers with crenellated caps; a blue-and-gold flag on the north-east one
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = CX + sx * R, ty = CY + sy * R;
      pole(tx, ty, 0, CH + 72, 70, { color: GREY });
      pole(tx, ty, CH + 72, CH + 80, 80, CAP);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, mx = Math.round((Math.cos(a) * 66) / 2) * 2, my = Math.round((Math.sin(a) * 66) / 2) * 2;
        box(tx + mx - 10, ty + my - 10, CH + 80, tx + mx + 10, ty + my + 10, CH + 104, CAP);
      }
      if (sx > 0 && sy > 0) {
        pole(tx, ty, CH + 80, CH + 200, 5, { color: [70, 56, 40] });
        box(tx + 6, ty - 2, CH + 160, tx + 66, ty + 2, CH + 196, { asset: 'PB_DefaultMicroBrick', color: [40, 70, 170] });
        box(tx + 6, ty - 2, CH + 196, tx + 66, ty + 2, CH + 200, { asset: 'PB_DefaultMicroBrick', color: [230, 190, 50] });
      }
    }
    // the keep
    const KY = CY + 130;
    const g = building(CX, KY, 0, -1, 400, 320, 3, {
      wallColor: [150, 148, 142], roofColor: CAP.color, rise: 0, doorW: 60, tiles: [[176, 172, 164], [96, 94, 90]], stairs: true, flat: true, s: 9001, storey: 144,
    });
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = CX + sx * 230, ty = KY + sy * 190;
      pole(tx, ty, 0, g.h + 60, 30, { color: [150, 148, 142] });
      pole(tx, ty, g.h + 60, g.h + 68, 35, CAP);
      put({ size: [10, 10, 6], ...GLOW([255, 180, 90], 6) }, tx, ty, g.h + 76);
    }
    FURN++; // interior fit-out (FURNITURE switch)
    const F = g.furnish, V = g.V;
    // throne room: red carpet to a gold throne between two gold pillars
    g.lbox(-30, 10, 30, 270, 4, 8, { asset: 'PB_DefaultTile', color: [150, 30, 40] });
    g.lbox(-20, 276, 20, 300, 4, 28, { asset: 'PB_DefaultMicroBrick', color: [150, 30, 40] });
    g.lbox(-20, 300, 20, 306, 4, 76, { asset: 'PB_DefaultMicroBrick', color: [220, 180, 60], material: 'BMC_Metallic' });
    for (const u of [-70, 70]) g.lpole(u, 290, 4, 60, 5, { color: [220, 180, 60], material: 'BMC_Metallic' });
    for (const v of [80, 160, 240]) F.lantern(0, v, 0);
    // first floor: council table on a rug, bookcases
    F.rug(-50, 120, 50, 180, 1, PALETTE.rug[1]);
    F.table(0, 150, 1, true, [[0, 100], [0, 200]]);
    F.bookcase('back', -110, -50, 1);
    F.bookcase('back', 50, 110, 1);
    F.lantern(0, 80, 1);
    // second floor: the royal bedchamber
    for (const [u, k] of [[-40, 1], [20, 2]]) { F.bed(u, V, -1, 2, pick(PALETTE.blanket, 9001, k)); F.chest(u + 5, 196, u + 35, 216, 2); }
    F.lantern(0, 120, 2);
    FURN--;
    // courtyard: lamps along the path, two trees
    for (const sx of [-1, 1]) {
      for (const y of [CY - 300, CY - 160]) lamp(CX + sx * 80, y);
      tree(CX + sx * 300, CY - 250, 9010 + sx);
    }
    count('castle');
  }

  // ------------------------------------------------------- building types --
  // each takes the lot centre, facing and a seed; footprints fit a 480 lot
  // ------------------------------------------- 2026-10-10: name boards, staves --
  /** a name board over a building's door (text toward the street) */
  function nameBoard(g, fx, fy, text, z = 92) {
    plaque({ put, text, facing: [fx, fy], x: g.frontPos[0] + fx, y: g.frontPos[1] + fy, z, w: 36, h: 10, color: [150, 112, 72] });
  }
  /**
   * a stave wall (the snow hamlet's new pattern): upright boards 10 wide in
   * alternating browns, a dark sill beam at 36-44 and a top plate, cut round
   * the openings [p0, p1, z0, z1]
   */
  function staves(axis, c, a, b, h, openings, cols, dark) {
    const seg = (p0, p1, z0, z1, m) => { if (p1 <= p0 || z1 <= z0) return; if (axis === 'x') box(p0, c - 5, z0, p1, c + 5, z1, m); else box(c - 5, p0, z0, c + 5, p1, z1, m); };
    const bands = [[0, 36, null], [36, 44, dark], [44, h - 8, null], [h - 8, h, dark]];
    for (let p = a, k = 0; p < b; p += 10, k++) {
      const q = Math.min(b, p + 10), holes = openings.filter(o => o[0] < q && o[1] > p);
      for (const [z0, z1, m] of bands) {
        let zs = [[z0, z1]];
        for (const o of holes) zs = zs.flatMap(([u, v]) => (o[2] >= v || o[3] <= u ? [[u, v]] : [[u, Math.max(u, o[2])], [Math.min(v, o[3]), v]]).filter(([x, y]) => y > x));
        for (const [u, v] of zs) seg(p, q, u, v, { color: m ?? cols[(k + (u > 40 ? 1 : 0)) % cols.length] });
      }
    }
  }
  /** a longhouse: w along the street (the door in its middle), d deep, h to the eaves, a steep shingle roof */
  function norse(cx, cy, fx, fy, s, w, d, h, rise, hall = false) {
    const [ex, ey] = fx ? [d / 2, w / 2] : [w / 2, d / 2];
    const x0 = cx - ex, x1 = cx + ex, y0 = cy - ey, y1 = cy + ey;
    const cols = [[128, 88, 56], [104, 72, 46], [140, 98, 62]], dark = [62, 44, 30];
    const doorAt = fx ? cy : cx, door = [doorAt - 20, doorAt + 20, 0, 72];
    // two small high windows on each wall, clear of the door
    const lit = (lo, hi, front) => [lo + (hi - lo) / 4, hi - (hi - lo) / 4].map(m => Math.round(m / 10) * 10)
      .filter(m => !front || Math.abs(m - doorAt) > 60).map(m => [m - 10, m + 10, 48, 72]);
    const frontY = fy ? (fy > 0 ? y1 : y0) : null, frontX = fx ? (fx > 0 ? x1 : x0) : null;
    staves('x', y0 + 5, x0, x1, h, [...(frontY === y0 ? [door] : []), ...lit(x0, x1, frontY === y0)], cols, dark);
    staves('x', y1 - 5, x0, x1, h, [...(frontY === y1 ? [door] : []), ...lit(x0, x1, frontY === y1)], cols, dark);
    staves('y', x0 + 5, y0 + 10, y1 - 10, h, [...(frontX === x0 ? [door] : []), ...lit(y0 + 10, y1 - 10, frontX === x0)], cols, dark);
    staves('y', x1 - 5, y0 + 10, y1 - 10, h, [...(frontX === x1 ? [door] : []), ...lit(y0 + 10, y1 - 10, frontX === x1)], cols, dark);
    // plank floor, a long hearth down the middle
    const cells = new Set();
    for (const k of cellsOfRect((x0 + 10) / 10, (y0 + 10) / 10, (x1 - 10) / 10, (y1 - 10) / 10)) cells.add(k);
    for (const p of floorPieces(cells, 'townPlanks', { salt: s * 7 })) box(p.x0 * 10, p.y0 * 10, 0, p.x1 * 10, p.y1 * 10, 4, p.brick);
    const along = !fx; // the ridge runs along the street side
    const hl = hall ? 160 : 80;
    if (along) box(cx - hl / 2, cy - 20, 4, cx + hl / 2, cy + 20, 8, GLOW([255, 130, 40], 5)); else box(cx - 20, cy - hl / 2, 4, cx + 20, cy + hl / 2, 8, GLOW([255, 130, 40], 5));
    // ceiling under the roof (tiles face down), then the roof with its gable ends
    box(x0 + 10, y0 + 10, h - 4, x1 - 10, y1 - 10, h, { asset: 'PB_DefaultTile', direction: 5, rotation: 0, color: cols[1] });
    gable(x0, y0, x1, y1, h, rise, [84, 62, 44], along, { color: cols[0], inset: 0 });
    // dragon posts: a dark post up past each gable end's peak, a glowing eye
    const top = h + rise + 8;
    for (const sgn of [-1, 1]) {
      const [px, py] = along ? [sgn < 0 ? x0 - 15 : x1 + 15, cy] : [cx, sgn < 0 ? y0 - 15 : y1 + 15];
      pole(px, py, top - 48, top + 24, 5, { color: dark });
      box(px - 2, py - 2, top + 24, px + 2, py + 2, top + 28, { asset: 'PB_DefaultMicroBrick', color: [255, 90, 40], material: 'BMC_Glow', material_intensity: 6 });
    }
    return { frontPos: [cx + fx * (fx ? ex : 0), cy + fy * (fy ? ey : 0)] };
  }
  const TYPES = {
    cottage(cx, cy, fx, fy, s, small) {
      if (isSmith(rnd, s)) wallHouse(cx, cy, fx, fy, 32 + GROW, 24 + GROW, 1, s, {
        wallColor: pick(PALETTE.brick, s, 3), roofColor: pick(PALETTE.roof, s, 4), rise: 72 + Math.floor(rnd(s, 5) * 3) * 12,
      });
      else shapedTown(cx, cy, fx, fy, shapedSpec('cottage', rnd, s, small), s);
      count('cottage');
    },
    // the desert gun store (owner, 2026-10-03): a wide false-front western
    // building, six gun stands (gun_<key>.brz, made by bridge/tools/gunshopgen.mjs
    // from the bronze sword shop) along the back walls, buttons toward the door
    gunstore(cx, cy, fx, fy, s) {
      const h = shapedTown(cx, cy, fx, fy, { shape: 'rect', W: 36, D: 24, E: 0, storeys: 1, attic: false, style: 'western' }, s);
      const GUNS = ['derringer', 'revolver', 'huntingshotgun', 'leveraction', 'boltaction', 'magnum'];
      [50, 100, 150, 230, 280, 330].forEach((x, k) => {
        const [px, py] = h.at(x, 24 * 10 - 30); // 3 studs off the back wall (they poked through at 1.5)
        stats.houseShops.push({ at: [px, py, 16 + (zCtx ?? 0)], orient: h.frontOrient, tier: GUNS[k], prefab: 'gun_' + GUNS[k] });
      });
      count('gun store');
    },
    // desert hamlets (mapgen desert biome): a false-front western house (shapedhouse style 'western')
    western(cx, cy, fx, fy, s) {
      shapedTown(cx, cy, fx, fy, { shape: 'rect', W: 28 + GROW + Math.floor(rnd(s, 31) * 2) * 4, D: 24 + GROW, E: 0, storeys: rnd(s, 32) < 0.4 ? 2 : 1, attic: false, style: 'western' }, s);
      count('western');
    },
    townhouse(cx, cy, fx, fy, s, small) {
      if (isSmith(rnd, s)) wallHouse(cx, cy, fx, fy, 36 + GROW, 28 + GROW, 2 + (rnd(s, 1) < 0.35 ? 1 : 0), s, {
        wallColor: pick(PALETTE.brick, s, 3), upperColor: pick(PALETTE.plaster, s, 6), roofColor: pick(PALETTE.roof, s, 4), rise: 96 + Math.floor(rnd(s, 5) * 2) * 24,
      });
      else shapedTown(cx, cy, fx, fy, shapedSpec('townhouse', rnd, s, small), s);
      count('townhouse');
    },
    shop(cx, cy, fx, fy, s) {
      const kind = pick(SHOP_KINDS, s, 20);
      wallShop(cx, cy, fx, fy, 36 + GROW, 28 + GROW, kind === 'smithy' || rnd(s, 1) < 0.4 ? 1 : 2, s, kind, {
        wallColor: kind === 'smithy' ? pick(PALETTE.stone, s, 3) : pick(PALETTE.brick, s, 3), upperColor: pick(PALETTE.plaster, s, 6),
        roofColor: pick(PALETTE.roof, s, 4), rise: 84 + Math.floor(rnd(s, 5) * 2) * 24, cloth: pick(PALETTE.cloth, s, 5),
      });
      count('shop'); count('shop: ' + kind);
    },
    tavern(cx, cy, fx, fy, s) {
      const g = building(cx, cy, fx, fy, 360, 240, 2, {
        wallColor: PALETTE.brick[5], upperColor: PALETTE.plaster[1], roofColor: PALETTE.roof[0], rise: 96, doorW: 60, tiles: [[170, 120, 80], [110, 76, 50]],
        stairs: true, shutters: PALETTE.shutter[0], flowerBoxes: true, s, storey: 108,
      });
      const lat = fx ? [0, 1] : [1, 0];
      // big sign (clear of the timber band) and lanterns either side of the door
      put({ asset: 'PB_DefaultMicroBrick', size: fx ? [2, 20, 12] : [20, 2, 12], color: [190, 140, 40] }, g.frontPos[0] + fx * 6, g.frontPos[1] + fy * 6, 140);
      for (const sgn of [-1, 1])
        put({ size: [5, 5, 4], ...GLOW([255, 190, 100], 6) }, g.frontPos[0] + fx * 5 + lat[0] * sgn * 50, g.frontPos[1] + fy * 5 + lat[1] * sgn * 50, 92);
      // barrels by the door, outside
      for (const sgn of [-1, 1]) pole(g.frontPos[0] + fx * 25 + lat[0] * sgn * 120, g.frontPos[1] + fy * 25 + lat[1] * sgn * 120, 0, 28, 10, { color: [120, 84, 50] });
      FURN++; // interior fit-out (FURNITURE switch)
      const F = g.furnish, V = g.V;
      // taproom: four tables with stools, a bar with mugs and kegs, the hearth at the back
      for (const u of [-90, 90]) for (const v of [70, 170]) F.table(u, v, 0, false, [[u - 30, v], [u + 30, v]]);
      g.lbox(130, 60, 150, 180, 4, 40, { color: PALETTE.timber[0] });
      for (const v of [90, 120, 150]) g.lput('B_Chalice', 140, v, 40 + 10, { color: [200, 160, 70], material: 'BMC_Metallic' });
      for (const v of [80, 120, 160]) F.barrel(160, v, 0);
      F.fireplace('back', 0, 0);
      for (const u of [-90, 0, 90]) F.lantern(u, 120, 0);
      // upstairs: three guest beds along the back, a wardrobe, a rug
      [[-100, 13], [-20, 14], [60, 15]].forEach(([u, k]) => {
        F.bed(u, V, -1, 1, pick(PALETTE.blanket, s, k));
        F.chest(u + 5, 120, u + 35, 140, 1);
        F.lantern(u + 20, 110, 1);
      });
      F.cupboard('right', 60, 110, 1, 64);
      F.rug(-60, 40, 60, 100, 1, PALETTE.rug[0]);
      FURN--;
      count('tavern');
    },
    // the bank (RuneScape, 2026-10-05): a grey stone hall with a flat
    // crenellated roof, four columns and a gold sign out front, a counter with
    // glass booth screens and the vault chests behind it
    bank(cx, cy, fx, fy, s) {
      const g = building(cx, cy, fx, fy, 320, 240, 1, {
        wallColor: [176, 172, 164], roofColor: PALETTE.roof[4], rise: 0, doorW: 60, tiles: [[206, 200, 188], [120, 36, 40]], flat: true, s, storey: 132,
      });
      const lat = fx ? [0, 1] : [1, 0], [ox, oy] = g.frontPos;
      const at = (u, o) => [ox + lat[0] * u + fx * o, oy + lat[1] * u + fy * o];
      const obox = (u0, u1, o0, o1, z0, z1, b) => { const [ax, ay] = at(u0, o0), [bx, by] = at(u1, o1); box(Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1, b); };
      const STONE = [214, 210, 200];
      for (const u of [-130, -70, 70, 130]) { const [px, py] = at(u, 20); pole(px, py, 0, g.h, 10, { color: STONE }); }
      obox(-150, 150, 0, 34, g.h, g.h + 12, { asset: 'PB_DefaultMicroBrick', color: STONE });
      obox(-50, 50, 34, 36, g.h + 1, g.h + 11, { asset: 'PB_DefaultMicroBrick', color: [230, 190, 60], material: 'BMC_Metallic' });
      FURN++;
      g.lbox(-130, 140, 130, 160, 4, 40, { color: PALETTE.timber[0] });
      g.lbox(-130, 140, 130, 160, 40, 44, { asset: 'PB_DefaultTile', color: [120, 36, 40] });
      for (const u of [-46, 44]) g.lbox(u, 140, u + 2, 160, 44, 76, { asset: 'PB_DefaultMicroBrick', ...GLASS });
      for (const u of [-90, 0, 90]) g.lpole(u, 150, 44, 48, 5, { color: [230, 190, 60], material: 'BMC_Metallic' });
      for (const u of [-110, -30, 50]) g.furnish.chest(u, 200, u + 40, 220, 0);
      for (const u of [-90, 90]) g.furnish.lantern(u, 80, 0);
      FURN--;
      count('bank');
    },
    // ---------------------------------------------- 2026-10-10 additions --
    // (owner: "add temples and churches ... warehouses Dining Hall viking
    // village in the snow with wood brown colors and maybe a new pattern and
    // Taverns and Librarys"): hamlets get two of tavern / library / warehouse /
    // dining hall / chapel each; temples and shrines (to made-up gods, gods.mjs)
    // stand out in the wild (mapgen builds them through `single`); the snow
    // hamlet is longhouses round a mead hall, in stave planks
    library(cx, cy, fx, fy, s) {
      const g = building(cx, cy, fx, fy, 320, 260, 2, { wallColor: [172, 164, 150], roofColor: [70, 78, 92], rise: 108, doorW: 60, storey: 120,
        tiles: [[120, 90, 60], [92, 66, 46]], shutters: [46, 70, 52], s });
      nameBoard(g, fx, fy, 'Library');
      const lat = fx ? [0, 1] : [1, 0];
      for (const sgn of [-1, 1]) put({ size: [5, 5, 4], ...GLOW([255, 214, 150], 5) }, g.frontPos[0] + fx * 5 + lat[0] * sgn * 50, g.frontPos[1] + fy * 5 + lat[1] * sgn * 50, 92);
      count('library');
    },
    warehouse(cx, cy, fx, fy, s) {
      const g = building(cx, cy, fx, fy, 420, 300, 1, { wallColor: [124, 90, 60], roofColor: [96, 92, 88], rise: 96, doorW: 80, storey: 144,
        plain: ['front', 'back', 'left', 'right'], canopy: false, s });
      g.lbox(-5, -30, 5, 0, 112, 120, { asset: 'PB_DefaultMicroBrick', color: PALETTE.timber[2] }); // hoist beam over the loading door
      nameBoard(g, fx, fy, 'Warehouse');
      count('warehouse');
    },
    dininghall(cx, cy, fx, fy, s) {
      const g = building(cx, cy, fx, fy, 480, 260, 1, { wallColor: [156, 116, 78], roofColor: [120, 62, 42], rise: 120, doorW: 60, storey: 132, shutters: [96, 60, 40], s });
      nameBoard(g, fx, fy, 'Dining Hall');
      count('dining hall');
    },
    // a chapel: a tall stone nave, deep from the door, and a bell tower with a gold cross beside its front
    chapel(cx, cy, fx, fy, s) {
      const W = 240, D = 400, TW = 80, GAP = 20, lat = fx ? [0, 1] : [1, 0]; // the gap clears the nave's eaves
      const ncx = cx - lat[0] * (TW + GAP) / 2, ncy = cy - lat[1] * (TW + GAP) / 2;
      const stone = [198, 192, 180], roof = [78, 82, 96], tower = [184, 178, 166];
      const g = building(ncx, ncy, fx, fy, W, D, 1, { wallColor: stone, roofColor: roof, rise: 156, doorW: 60, storey: 168, s });
      const tcx = ncx + lat[0] * (W / 2 + GAP + TW / 2) + fx * (D / 2 - TW / 2), tcy = ncy + lat[1] * (W / 2 + GAP + TW / 2) + fy * (D / 2 - TW / 2);
      const TH = 300;
      box(tcx - TW / 2, tcy - TW / 2, 0, tcx + TW / 2, tcy + TW / 2, 228, { color: tower });
      // the belfry: four corner piers with dark openings between them
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(tcx + (a < 0 ? -TW / 2 : TW / 2 - 20), tcy + (b < 0 ? -TW / 2 : TW / 2 - 20), 228, tcx + (a < 0 ? -TW / 2 + 20 : TW / 2), tcy + (b < 0 ? -TW / 2 + 20 : TW / 2), TH, { color: tower });
      box(tcx - TW / 2 + 20, tcy - TW / 2 + 20, 228, tcx + TW / 2 - 20, tcy + TW / 2 - 20, TH, { color: [40, 40, 46] });
      box(tcx - TW / 2, tcy - TW / 2 + 20, 228, tcx - TW / 2 + 20, tcy + TW / 2 - 20, 236, { color: tower });
      box(tcx + TW / 2 - 20, tcy - TW / 2 + 20, 228, tcx + TW / 2, tcy + TW / 2 - 20, 236, { color: tower });
      box(tcx - TW / 2 + 20, tcy - TW / 2, 228, tcx + TW / 2 - 20, tcy - TW / 2 + 20, 236, { color: tower });
      box(tcx - TW / 2 + 20, tcy + TW / 2 - 20, 228, tcx + TW / 2 - 20, tcy + TW / 2, 236, { color: tower });
      box(tcx - TW / 2, tcy - TW / 2, TH, tcx + TW / 2, tcy + TW / 2, TH + 4, { asset: 'PB_DefaultMicroBrick', color: tower });
      gable(tcx - TW / 2, tcy - TW / 2, tcx + TW / 2, tcy + TW / 2, TH + 4, 48, roof, true, { color: tower, inset: 0 });
      const gold = { asset: 'PB_DefaultMicroBrick', color: [236, 196, 70], material: 'BMC_Metallic' };
      box(tcx - 2, tcy - 2, TH + 68, tcx + 2, tcy + 2, TH + 108, gold);
      if (fx) box(tcx - 2, tcy - 14, TH + 92, tcx + 2, tcy - 2, TH + 98, gold), box(tcx - 2, tcy + 2, TH + 92, tcx + 2, tcy + 14, TH + 98, gold);
      else box(tcx - 14, tcy - 2, TH + 92, tcx - 2, tcy + 2, TH + 98, gold), box(tcx + 2, tcy - 2, TH + 92, tcx + 14, tcy + 2, TH + 98, gold);
      nameBoard(g, fx, fy, 'Chapel');
      count('chapel');
    },
    // a temple (wild sites): stepped base, a colonnade round an open cella,
    // entablature and a pediment roof, the god's altar and idol in the middle
    temple(cx, cy, fx, fy, s, small, god) {
      const W = 400, D = 560, lat = fx ? [0, 1] : [1, 0];
      const P = (u, v) => [cx + lat[0] * u + fx * (D / 2 - v), cy + lat[1] * u + fy * (D / 2 - v)];
      const lb = (u0, v0, u1, v1, z0, z1, b) => { const [ax, ay] = P(u0, v0), [bx, by] = P(u1, v1); box(Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1, b); };
      const lp = (u, v, z0, z1, r, b) => { const [px, py] = P(u, v); pole(px, py, z0, z1, r, b); };
      const STONE = [224, 216, 198], DARK = [198, 190, 172], MICRO = 'PB_DefaultMicroBrick';
      lb(-W / 2 - 40, -40, W / 2 + 40, D + 40, 0, 12, { asset: 'PB_DefaultTile', color: DARK });
      lb(-W / 2 - 20, -20, W / 2 + 20, D + 20, 12, 24, { asset: 'PB_DefaultTile', color: STONE });
      lb(-W / 2, 0, W / 2, D, 24, 36, { asset: 'PB_DefaultTile', color: DARK });
      const col = (u, v) => { lb(u - 14, v - 14, u + 14, v + 14, 36, 42, { asset: MICRO, color: DARK }); lp(u, v, 42, 210, 10, { color: STONE }); lb(u - 14, v - 14, u + 14, v + 14, 210, 216, { asset: MICRO, color: DARK }); };
      for (let u = -W / 2 + 20; u <= W / 2 - 20; u += 60) { col(u, 20); col(u, D - 20); }
      for (let v = 100; v <= D - 100; v += 80) { col(-W / 2 + 20, v); col(W / 2 - 20, v); }
      // entablature ring (micro: its underside shows) and the ceiling slab under the roof
      lb(-W / 2, 0, W / 2, 40, 216, 240, { asset: MICRO, color: STONE });
      lb(-W / 2, D - 40, W / 2, D, 216, 240, { asset: MICRO, color: STONE });
      lb(-W / 2, 40, -W / 2 + 40, D - 40, 216, 240, { asset: MICRO, color: STONE });
      lb(W / 2 - 40, 40, W / 2, D - 40, 216, 240, { asset: MICRO, color: STONE });
      lb(-W / 2 + 40, 40, W / 2 - 40, D - 40, 236, 240, { asset: MICRO, color: STONE });
      const [ax, ay] = P(-W / 2, 0), [bx, by] = P(W / 2, D);
      gable(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), 240, 96, [176, 82, 60], !!fx, { color: STONE, inset: 0 });
      // altar, glowing in the god's colour, and the idol on it
      const c = god?.colour ?? [255, 200, 120];
      lb(-40, D / 2 - 30, 40, D / 2 + 30, 36, 72, { color: [150, 140, 128] });
      lb(-30, D / 2 - 20, 30, D / 2 + 20, 72, 76, { color: c, material: 'BMC_Glow', material_intensity: 4 });
      lp(0, D / 2, 76, 136, 10, { color: c, material: 'BMC_Metallic' });
      // braziers either side of the front steps
      for (const u of [-W / 2 - 20, W / 2 + 20]) { lp(u, -30, 12, 40, 8, { color: [70, 66, 62], material: 'BMC_Metallic' }); lb(u - 6, -36, u + 6, -24, 40, 46, { asset: MICRO, color: [255, 140, 40], material: 'BMC_Glow', material_intensity: 6 }); }
      const [px, py] = P(0, -1);
      if (god) plaque({ put, text: `Temple of\n${god.name} ${god.epithet}`, facing: [fx, fy], x: px, y: py, z: 228, w: 120, h: 11, color: STONE });
      count('temple');
    },
    // a wayside shrine (wild sites): a stone platform, two posts and a little
    // roof over an altar with the god's light and idol, the god on a stele
    shrine(cx, cy, fx, fy, s, small, god) {
      const lat = fx ? [0, 1] : [1, 0], D = 160;
      const P = (u, v) => [cx + lat[0] * u + fx * (D / 2 - v), cy + lat[1] * u + fy * (D / 2 - v)];
      const lb = (u0, v0, u1, v1, z0, z1, b) => { const [ax, ay] = P(u0, v0), [bx, by] = P(u1, v1); box(Math.min(ax, bx), Math.min(ay, by), z0, Math.max(ax, bx), Math.max(ay, by), z1, b); };
      const lp = (u, v, z0, z1, r, b) => { const [px, py] = P(u, v); pole(px, py, z0, z1, r, b); };
      const STONE = [168, 162, 150], MICRO = 'PB_DefaultMicroBrick', c = god?.colour ?? [255, 200, 120];
      lb(-80, 0, 80, D, 0, 8, { asset: 'PB_DefaultTile', color: STONE });
      for (const u of [-60, 60]) lp(u, 100, 8, 120, 8, { color: [96, 70, 48] });
      lb(-70, 90, 70, 110, 120, 128, { asset: MICRO, color: [96, 70, 48] });
      const [ax, ay] = P(-70, 70), [bx, by] = P(70, 130);
      gable(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), 128, 36, pick(PALETTE.roof, s, 4), !fx);
      lb(-30, 80, 30, 120, 8, 44, { color: [140, 132, 120] });
      lb(-20, 90, 20, 110, 44, 48, { color: c, material: 'BMC_Glow', material_intensity: 4 });
      lp(0, 100, 48, 88, 6, { color: c, material: 'BMC_Metallic' });
      for (const u of [-25, 25]) { lp(u, 85, 44, 56, 2, { color: [240, 230, 200] }); lb(u - 2, 83, u + 2, 87, 56, 60, { asset: MICRO, color: [255, 190, 90], material: 'BMC_Glow', material_intensity: 6 }); }
      // the stele out front, the god's name on it
      lb(-40, 20, 40, 28, 8, 68, { asset: MICRO, color: [120, 116, 110] });
      const [px, py] = P(0, 19);
      if (god) plaque({ put, text: god.sign, facing: [fx, fy], x: px, y: py, z: 40, w: 38, h: 18, color: [120, 116, 110] });
      count('shrine');
    },
    // the casino (owner 2026-10-10: "make a casino at spawn with building and
    // gambling mechanics along with npcs"): a red and gold hall with a flat
    // roof, gold columns and a marquee of lights round the CASINO board; the
    // games are prefabs (pots/casinogen.mjs) and the staff are friendly bots
    // (bridge/tools/npcgen.mjs), listed in stats.casino for mapgen
    casino(cx, cy, fx, fy, s) {
      const W = 560, D = 440, lat = fx ? [0, 1] : [1, 0];
      const g = building(cx, cy, fx, fy, W, D, 1, { wallColor: [132, 22, 34], roofColor: [30, 30, 34], rise: 0, doorW: 80, storey: 168, flat: true,
        tiles: [[150, 22, 34], [24, 22, 26]], plain: ['front', 'back', 'left', 'right'], s });
      const GOLD = { color: [236, 190, 60], material: 'BMC_Metallic' }, MICRO = 'PB_DefaultMicroBrick';
      for (const u of [-70, 70]) g.lpole(u, -12, 0, 144, 8, GOLD);
      // the marquee: bulbs along the front above the door, and a gold band under them
      g.lbox(-W / 2, -4, W / 2, 0, 144, 148, { asset: MICRO, ...GOLD });
      for (let u = -W / 2 + 20; u <= W / 2 - 20; u += 40) g.lbox(u - 4, -6, u + 4, 0, 150, 158, { asset: MICRO, ...GLOW(u % 80 ? [255, 220, 120] : [255, 70, 70], 6) });
      plaque({ put, text: 'CASINO', facing: [fx, fy], x: g.frontPos[0] + fx, y: g.frontPos[1] + fy, z: 116, w: 60, h: 14, color: [40, 16, 20] });
      // the games and the staff, in this building's frame (u across, v in from the front, z = floor top)
      const P = (u, v) => [cx + lat[0] * u + fx * (D / 2 - v), cy + lat[1] * u + fy * (D / 2 - v)];
      const facing = fy < 0 ? 16 : fx > 0 ? 17 : fy > 0 ? 18 : 19; // prefab front (-y) turned to face the door
      const games = [], staff = [];
      for (let u = -220; u <= 220; u += 55) games.push({ prefab: 'casino_slots', at: [...P(u, D - 30), 4], orient: facing }); // along the back wall
      [[-150, 'casino_roulette'], [0, 'casino_dice'], [150, 'casino_flip']].forEach(([u, pf]) => {
        for (const v of [150, 290]) { games.push({ prefab: pf, at: [...P(u, v), 4], orient: facing }); staff.push({ prefab: 'npc_dealer', at: [...P(u, v + 60), 6] }); } // dealer behind each table
      });
      for (const u of [-110, 110]) staff.push({ prefab: 'npc_bouncer', at: [...P(u, 50), 6] });
      staff.push({ prefab: 'npc_host', at: [...P(0, 90), 6] });
      stats.casino = { games, staff };
      count('casino');
    },
    // the snow hamlet (owner: "viking village in the snow with wood brown
    // colors and maybe a new pattern"): stave-plank longhouses, the door on the
    // long side, steep shingle roofs with dragon posts at the gable ends
    longhouse(cx, cy, fx, fy, s) { norse(cx, cy, fx, fy, s, 360, 220, 96, 132); count('longhouse'); },
    meadhall(cx, cy, fx, fy, s) { const g = norse(cx, cy, fx, fy, s, 560, 280, 120, 168, true); nameBoard(g, fx, fy, 'Mead Hall', 92); count('mead hall'); },
    garden(cx, cy, fx, fy, s) {
      if (rnd(s, 1) < 0.5) {
        // vegetable rows on soil: lettuces, pumpkins, sprouts, tomatoes, beans
        box(cx - 160, cy - 160, 0, cx + 160, cy + 160, 4, { color: [96, 70, 48] });
        const CROPS = [['B_Fern', [90, 160, 60], 20], ['B_Pumpkin', [230, 120, 30], 20], ['B_Small_Flower', [110, 170, 70], 20], ['B_Tulip', [220, 60, 40], 20], ['B_Bush', [120, 170, 70], 30]];
        const HZ = { B_Fern: 2, B_Pumpkin: 8, B_Small_Flower: 2, B_Tulip: 6, B_Bush: 16 };
        const alongY = rnd(s, 2) < 0.5;
        for (let i = -3; i <= 3; i++) {
          const [asset, color, step] = pick(CROPS, s, i + 10);
          for (let t = -140 + step / 2; t <= 140 - step / 2; t += step)
            put({ asset, size: [0, 0, 0], color }, alongY ? cx + i * 40 : cx + t, alongY ? cy + t : cy + i * 40, 4 + HZ[asset]);
        }
        // little fence posts at the corners
        for (const [px, py] of [[-170, -170], [170, -170], [-170, 170], [170, 170]]) pole(cx + px, cy + py, 0, 36, 5, { color: PALETTE.timber[0] });
        count('vegetable garden');
      } else {
        // park: a few round trees, a ring of flowers, bushes in the corners and a bench
        const turn = rnd(s, 3) * Math.PI * 2;
        for (let t = 0; t < 3; t++) {
          const a = turn + (t * 2 * Math.PI) / 3, r = 110; // a triangle, canopies clear of each other
          const px = cx + Math.round((Math.cos(a) * r) / 10) * 10, py = cy + Math.round((Math.sin(a) * r) / 10) * 10;
          tree(px, py, s * 7 + t);
        }
        const bloom = pick(PALETTE.bloom, s, 4);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          put({ asset: k % 2 ? 'B_Rose' : 'B_Tulip', size: [0, 0, 0], color: k % 2 ? pick(PALETTE.bloom, s, 5) : bloom }, cx + Math.round(Math.cos(a) * 25) * 2, cy + Math.round(Math.sin(a) * 25) * 2, k % 2 ? 4 : 6);
        }
        for (const [px, py] of [[-170, -170], [170, -170], [-170, 170], [170, 170]])
          { const leafy = rnd(s, px, py) < 0.5; put({ asset: leafy ? "B_Leaf_Bush" : "B_Bush", size: [0, 0, 0], color: [[60, 120, 50], [80, 140, 60]][rnd(s, py, px) < 0.5 ? 0 : 1] }, cx + px, cy + py, leafy ? 20 : 16); }
        box(cx - 30, cy + 150, 12, cx + 30, cy + 160, 16, { color: PALETTE.timber[1] });
        for (const sgn of [-1, 1]) box(cx + sgn * 25 - 5, cy + 150, 0, cx + sgn * 25 + 5, cy + 160, 12, { color: PALETTE.timber[0] });
        count('park');
      }
    },
  };

  function tree(x, y, s) {
    const trunk = 6 + Math.floor(rnd(s, 9) * 4);
    pole(x, y, 0, trunk * 12, 10, { color: [92, 64, 40] });
    let z = trunk * 12 - 24;
    for (const [r, t] of [[40, 1], [55, 2], [60, 2], [50, 2], [30, 1]]) {
      // canopy tiers start above the trunk top so they don't overlap it
      const z0 = Math.max(z, trunk * 12);
      pole(x, y, z0, z0 + t * 12, r, { color: [58, 120, 48] });
      z = z0 + t * 12;
    }
    stats.trees++;
  }

  function lamp(x, y) {
    pole(x, y, 0, 96, 5, { color: [46, 44, 42], material: 'BMC_Metallic' });
    pole(x, y, 96, 108, 10, GLOW([255, 190, 100], 6));
    stats.lamps++;
  }

  function stall(x, y, s) {
    box(x - 30, y - 15, 0, x + 30, y + 15, 36, { color: PALETTE.timber[1] });
    for (const [px, py] of [[-40, -30], [40, -30], [-40, 30], [40, 30]]) pole(x + px, y + py, 0, 96, 5, { color: PALETTE.timber[0] });
    box(x - 50, y - 40, 96, x + 50, y + 40, 100, { color: pick(PALETTE.cloth, s, 1) });
    for (let g = -1; g <= 1; g++) put({ asset: 'B_1x1_Round', size: [0, 0, 0], color: pick(PALETTE.goods, s, g + 5) }, x + g * 20, y, 42);
    stats.stalls++;
  }

  // -------------------------------------------------------------- props --
  // (owner 2026-10-08: "make towns more interesting") street clutter just off
  // the paths, market stalls, windmills and watchtowers. Every piece keeps to
  // the stud / plate grid and stacks without overlapping (the overlap guard
  // in mapgen throws on any clash). Pot spots are left empty here: mapgen
  // stamps the smashable "pot" prefab there (stats.potSpots, local x, y).
  stats.potSpots = [];
  stats.props = {};
  const prop = t => (stats.props[t] = (stats.props[t] ?? 0) + 1);
  const IRON = { color: [62, 58, 54], material: 'BMC_Metallic' };
  function barrel(x, y, s) {
    const wood = pick(PALETTE.timber, s, 1);
    // staves in three runs with iron hoops between, stacked
    pole(x, y, 0, 8, 10, { color: wood });
    pole(x, y, 8, 12, 10, IRON);
    pole(x, y, 12, 28, 10, { color: wood });
    pole(x, y, 28, 32, 10, IRON);
    pole(x, y, 32, 36, 10, { color: wood });
  }
  function crate(x0, y0, z0, s) {
    const c = [[150, 112, 70], [132, 98, 62], [164, 126, 82]][Math.floor(rnd(s, x0, y0) * 3)];
    box(x0, y0, z0, x0 + 20, y0 + 20, z0 + 24, { color: c });
  }
  const PROPS = {
    barrels(x, y, s) { for (const [dx, dy] of [[-20, -10], [0, -10], [-10, 10]].slice(0, rnd(s, 5) < 0.5 ? 2 : 3)) barrel(x + dx, y + dy, s + dx); },
    crates(x, y, s) { crate(x - 20, y - 10, 0, s); crate(x, y - 10, 0, s + 1); crate(x - 10, y - 10, 24, s + 2); },
    hay(x, y) {
      const HAY = [[214, 182, 92], [200, 168, 80]];
      pole(x, y, 0, 24, 20, { color: HAY[0] });
      pole(x, y, 24, 36, 15, { color: HAY[1] });
      pole(x, y, 36, 44, 10, { color: HAY[0] });
    },
    planter(x, y, s, alongX) {
      box(alongX ? x - 30 : x - 10, alongX ? y - 10 : y - 30, 0, alongX ? x + 30 : x + 10, alongX ? y + 10 : y + 30, 12, { color: pick(PALETTE.timber, s, 2) });
      for (let k = -1; k <= 1; k++) {
        const rose = rnd(s, 6, k) < 0.5;
        put({ asset: rose ? 'B_Rose' : 'B_Tulip', size: [0, 0, 0], color: pick(PALETTE.bloom, s, 7 + k) }, alongX ? x + k * 20 : x, alongX ? y : y + k * 20, rose ? 16 : 18);
      }
    },
    bench(x, y, s, alongX) {
      const seat = { color: PALETTE.timber[1] }, leg = { color: PALETTE.timber[0] };
      if (alongX) { box(x - 30, y - 5, 12, x + 30, y + 5, 16, seat); for (const sg of [-1, 1]) box(x + sg * 25 - 5, y - 5, 0, x + sg * 25 + 5, y + 5, 12, leg); }
      else { box(x - 5, y - 30, 12, x + 5, y + 30, 16, seat); for (const sg of [-1, 1]) box(x - 5, y + sg * 25 - 5, 0, x + 5, y + sg * 25 + 5, 12, leg); }
    },
    board(x, y, s, alongX) {
      // a notice board: two posts, a plank face, pinned notes on one side, a little cap
      const MB = 'PB_DefaultMicroBrick', NOTE = [[236, 230, 210], [220, 210, 180], [240, 236, 226]];
      const X = (a, b) => (alongX ? [x + a, y + b] : [x + b, y + a]); // a: along the board, b: across
      const bx = (a0, b0, z0, a1, b1, z1, br) => { const [p, q] = X(a0, b0), [r, t] = X(a1, b1); box(Math.min(p, r), Math.min(q, t), z0, Math.max(p, r), Math.max(q, t), z1, br); };
      for (const sg of [-1, 1]) { const [px, py] = X(sg * 35, 0); pole(px, py, 0, 64, 5, { color: PALETTE.timber[0] }); }
      bx(-30, -2, 32, 30, 2, 60, { asset: MB, color: PALETTE.timber[1] });
      for (let k = 0; k < 3; k++) bx(-24 + k * 18, -4, 38 + (k % 2) * 8, -12 + k * 18, -2, 52 + (k % 2) * 4, { asset: MB, color: NOTE[k] });
      bx(-40, -8, 64, 40, 8, 68, { asset: MB, color: PALETTE.roof[1] });
    },
    pots(x, y, s, alongX) { for (const sg of [-1, 1]) stats.potSpots.push(alongX ? [x + sg * 20, y] : [x, y + sg * 20]); },
  };
  const PROP_KINDS = ['barrels', 'crates', 'hay', 'planter', 'bench', 'board', 'pots', 'pots'];
  /** clutter along the paths: every `step` units, one side or the other, sometimes nothing */
  function propsAlong(paths, step, edge, seed, kinds = PROP_KINDS) {
    paths.forEach((p, pi) => {
      for (let i = 12, k = 0; i + 8 < p.length; i += Math.round(step / 20), k++) {
        const s = seed * 1000 + pi * 100 + k;
        if (rnd(s, 1) < 0.2) continue;
        const [x, y] = p[i], [qx, qy] = p[i + 1], tl = Math.hypot(qx - x, qy - y) || 1, first = rnd(s, 2) < 0.5 ? 1 : -1;
        // the side the hash picks, else the other one
        let cx, cy, r = null;
        for (const side of [first, -first]) {
          const nx = (-(qy - y) / tl) * side, ny = ((qx - x) / tl) * side, off = PATH_W / 2 + 70;
          cx = Math.round((x + nx * off) / 10) * 10; cy = Math.round((y + ny * off) / 10) * 10;
          const box1 = [cx - 40, cy - 40, cx + 40, cy + 40];
          if (rectClear(box1, { margin: 20, river: 40, edge })) { r = box1; break; }
        }
        if (!r) continue;
        taken.push(r);
        const kind = pick(kinds, s, 3);
        onSite(r, () => PROPS[kind](cx, cy, s, Math.abs(qx - x) >= Math.abs(qy - y)));
        prop(kind);
      }
    });
  }
  /** market stalls along the first stretch of each road out of the plaza */
  function stallsAlong(paths, from, to, step, seed) {
    paths.forEach((p, pi) => {
      let k = 0;
      for (let i = 0; i + 1 < p.length; i += Math.round(step / 20)) {
        const [x, y] = p[i], [qx, qy] = p[i + 1], d = Math.hypot(x, y);
        if (d < from || d > to) continue;
        const tl = Math.hypot(qx - x, qy - y) || 1;
        for (const side of [-1, 1]) {
          const nx = (-(qy - y) / tl) * side, ny = ((qx - x) / tl) * side, off = PATH_W / 2 + 70;
          const cx = Math.round((x + nx * off) / 10) * 10, cy = Math.round((y + ny * off) / 10) * 10;
          const r = [cx - 50, cy - 40, cx + 50, cy + 40];
          if (!rectClear(r, { margin: 20 })) continue;
          taken.push(r);
          onSite(r, () => stall(cx, cy, seed * 100 + pi * 10 + k++));
        }
      }
    });
  }
  /**
   * a windmill you can go into (owner 2026-10-08: "make it so i can go inside
   * this windmill"): a round wall of 1x1 columns (radius 70, two cells thick where it curves), stone to 96 and
   * plaster to 240, a doorway on the -y side, windows, a spiral of step plates
   * up the inside wall to an upper floor at 156, lamps on both floors, a
   * stepped cap, and the sails out front, hung above the doorway
   */
  function windmill(cx, cy, s) {
    const plaster = pick(PALETTE.plaster, s, 1), stoneC = pick(PALETTE.stone, s, 3), roofC = pick(PALETTE.roof, s, 2), MB = 'PB_DefaultMicroBrick';
    const R = 70, WALL = 18, TOP = 240, FLOOR = 156, DOOR_H = 72;
    const deg = (x, y) => (Math.atan2(y, x) * 180) / Math.PI;
    const adiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
    const cells = [];
    for (let x = -R + 5; x < R; x += 10) for (let y = -R + 5; y < R; y += 10) cells.push([x, y, Math.hypot(x, y), deg(x, y)]);
    const wallCells = cells.filter(c => c[2] < R && c[2] >= R - WALL), inner = cells.filter(c => c[2] < R - WALL);
    // one window cell per direction: low ones on the sides and back, high ones on the diagonals
    const nearest = a => wallCells.reduce((m, c) => (adiff(c[3], a) < adiff(m[3], a) ? c : m));
    const low = new Set([0, 90, 180].map(nearest)), high = new Set([45, 135, -45, -135].map(nearest));
    for (const c of wallCells) {
      const [x, y] = c, door = y < 0 && Math.abs(x) <= 15;
      // z cuts: the door gap, a glass pane, the stone / plaster change at 96
      const holes = [];
      if (door) holes.push([0, DOOR_H, null]);
      if (low.has(c)) holes.push([120, 144, GLASS]);
      if (high.has(c)) holes.push([180, 204, GLASS]);
      const cuts = [...new Set([0, 96, TOP, ...holes.flatMap(h => [h[0], h[1]])])].sort((p, q) => p - q);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const z0 = cuts[i], z1 = cuts[i + 1], hole = holes.find(h => h[0] <= z0 && h[1] >= z1);
        if (hole && !hole[2]) continue;
        box(cx + x - 5, cy + y - 5, z0, cx + x + 5, cy + y + 5, z1, hole ? hole[2] : { color: z0 < 96 ? stoneC : plaster });
      }
    }
    // stairs: 13 sectors round the inside wall, starting 40 degrees past the door,
    // a 12-high plate each, one brick up per sector; the 13th is the upper floor.
    // The floor leaves a hole over sectors 6-11 so the climb has headroom.
    const N = 13, SPAN = 280, sector = a => { const t = ((a + 90 - 40) % 360 + 360) % 360; return t < SPAN ? Math.floor(t / (SPAN / N)) : -1; };
    const tread = { color: PALETTE.timber[1] }, boards = { color: PLANKS[0] };
    for (const [x, y, d, a] of inner) {
      const k = d >= 28 ? sector(a) : -1;
      if (k >= 0 && k < N - 1) box(cx + x - 5, cy + y - 5, 12 * k, cx + x + 5, cy + y + 5, 12 * k + 12, tread);
      if (!(k >= 6 && k < N - 1)) box(cx + x - 5, cy + y - 5, FLOOR - 4, cx + x + 5, cy + y + 5, FLOOR, boards);
    }
    pole(cx, cy, FLOOR - 16, FLOOR - 4, 5, GLOW([255, 190, 100], 6));   // lamp under the upper floor
    pole(cx, cy, TOP - 12, TOP, 5, GLOW([255, 190, 100], 6));           // and under the cap
    // the cap
    pole(cx, cy, TOP, TOP + 12, 75, { color: roofC });
    pole(cx, cy, TOP + 12, TOP + 24, 60, { color: roofC });
    pole(cx, cy, TOP + 24, TOP + 36, 40, { color: roofC });
    pole(cx, cy, TOP + 36, TOP + 44, 20, { color: roofC });
    // sails on an axle out of the front wall, hub at 232, the low sail clear of the door
    const Y0 = cy - R - 14, Y1 = cy - R - 10, spar = { asset: MB, color: PALETTE.timber[0] }, cloth = { asset: MB, color: [236, 228, 208] };
    box(cx - 5, Y1, 226, cx + 5, cy - R, 238, { asset: MB, color: PALETTE.timber[0] });                // axle
    box(cx - 10, Y0, 222, cx + 10, Y1, 242, { asset: MB, color: PALETTE.timber[2] });                  // hub
    box(cx + 10, Y0, 230, cx + 150, Y1, 234, spar); box(cx + 40, Y0, 234, cx + 150, Y1, 256, cloth);       // east sail
    box(cx - 150, Y0, 230, cx - 10, Y1, 234, spar); box(cx - 150, Y0, 208, cx - 40, Y1, 230, cloth);      // west sail
    box(cx - 2, Y0, 242, cx + 2, Y1, 382, spar); box(cx - 24, Y0, 272, cx - 2, Y1, 382, cloth);           // top sail
    box(cx - 2, Y0, 92, cx + 2, Y1, 222, spar); box(cx + 2, Y0, 92, cx + 24, Y1, 192, cloth);             // bottom sail
    count('windmill');
  }
  /** a timber watchtower: four posts, a deck with rails, a little roof, a lantern */
  function watchtower(cx, cy, s) {
    const MB = 'PB_DefaultMicroBrick', wood = { color: PALETTE.timber[0] }, deck = { asset: MB, color: PALETTE.timber[1] };
    for (const [px, py] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) { pole(cx + px, cy + py, 0, 144, 5, wood); pole(cx + px, cy + py, 148, 192, 5, wood); }
    box(cx - 50, cy - 50, 144, cx + 50, cy + 50, 148, deck);
    for (const sg of [-1, 1]) {
      box(cx - 50, cy + sg * 48 - 2, 172, cx + 50, cy + sg * 48 + 2, 176, deck);
      box(cx + sg * 48 - 2, cy - 46, 172, cx + sg * 48 + 2, cy + 46, 176, deck);
    }
    for (let z = 8; z + 4 <= 140; z += 16) box(cx - 10, cy - 54, z, cx + 10, cy - 50, z + 4, deck);      // rungs up the front
    gable(cx - 50, cy - 50, cx + 50, cy + 50, 192, 36, pick(PALETTE.roof, s, 4));
    pole(cx, cy, 176, 184, 5, GLOW([255, 190, 100], 6));
    count('watchtower');
  }
  /**
   * a sewer access (2026-10-12): a stone kiosk over a 5 x 5-cell shaft whose
   * ring of cells carries a square spiral of micro-brick treads, one brick per
   * cell, down to the sewer floor (sewerDepth under tier 0); the middle 3 x 3
   * is the ground's own pillar. Door toward (fx, fy). mapgen carves the ring and
   * a passage to the sewer from stats.sewerShafts. cx, cy sit on a cell centre
   * offset (20 mod 40) so the ring is whole cells.
   */
  function sewerKiosk(cx, cy, fx, fy, s) {
    const stoneC = pick(PALETTE.stone, s, 1), dark = PALETTE.stone[2], roofC = pick(PALETTE.roof, s, 2), MB = 'PB_DefaultMicroBrick';
    const ring = [];
    for (let i = -2; i <= 2; i++) ring.push([i, -2]);
    for (let j = -1; j <= 2; j++) ring.push([2, j]);
    for (let i = 1; i >= -2; i--) ring.push([i, 2]);
    for (let j = 1; j >= -1; j--) ring.push([-2, j]);
    const front = ring.findIndex(([i, j]) => i === 2 * fx && j === 2 * fy);
    const k0 = (front + 2) % 16, n = (sewerDepth + zCtx) / 12;
    const cellBox = ([i, j], z0, z1, b) => box(cx + i * 40 - 20, cy + j * 40 - 20, z0, cx + i * 40 + 20, cy + j * 40 + 20, z1, b);
    // treads: step k at ring cell k0 + k, top 12 (k + 1) down; the last step is the sewer floor
    for (let k = 0; k <= n - 2; k++) cellBox(ring[(k0 + k) % 16], -12 * (k + 1) - 12, -12 * (k + 1), { asset: MB, color: k % 2 ? stoneC : dark });
    // the kiosk floor over the ring, open over the first seven steps (headroom)
    for (let q = 7; q < 16; q++) cellBox(ring[(k0 + q) % 16], -4, 0, { asset: MB, color: PALETTE.stone[0] });
    // walls round the shaft, a door in the front, a lintel, a gable roof, a lamp
    const H = 96, DOOR = 72, R = 100;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const isFront = ax === fx && ay === fy;
      const seg = (a0, a1, z0, z1, b) => (ax ? box(cx + ax * R + (ax > 0 ? 0 : -10), cy + a0, z0, cx + ax * R + (ax > 0 ? 10 : 0), cy + a1, z1, b) : box(cx + a0, cy + ay * R + (ay > 0 ? 0 : -10), z0, cx + a1, cy + ay * R + (ay > 0 ? 10 : 0), z1, b));
      const a0 = ax ? -R : -R - 10, a1 = ax ? R : R + 10; // x walls run the corners
      if (!isFront) { seg(a0, a1, 0, H, { color: stoneC }); continue; }
      seg(a0, -20, 0, H, { color: stoneC }); seg(20, a1, 0, H, { color: stoneC });
      seg(-20, 20, DOOR, H, { asset: MB, color: dark });
    }
    gable(cx - R - 10, cy - R - 10, cx + R + 10, cy + R + 10, H, 36, roofC);
    put({ size: [5, 5, 4], asset: MB, ...GLOW([255, 190, 100], 5) }, cx, cy, H - 4);
    stats.sewerShafts.push({ x: cx, y: cy, fx, fy, level: zCtx });
    count('sewer access');
  }
  /** sewer kiosks beside the main roads, part way out from the square */
  function sewerAccess(paths) {
    stats.sewerShafts = [];
    if (!sewerDepth) return;
    paths.forEach((p, pi) => {
      for (const f of [0.45, 0.55, 0.35, 0.65]) {
        const i = Math.floor(p.length * f), [x, y] = p[i], [qx, qy] = p[i + 1], tl = Math.hypot(qx - x, qy - y) || 1;
        let done = false;
        for (const side of [1, -1]) {
          const nx = (-(qy - y) / tl) * side, ny = ((qx - x) / tl) * side;
          const [fx, fy] = Math.abs(nx) >= Math.abs(ny) ? [-Math.sign(nx), 0] : [0, -Math.sign(ny)];
          const off = PATH_W / 2 + 40 + 110;
          const cx = Math.round((x - fx * off - 20) / 40) * 40 + 20, cy = Math.round((y - fy * off - 20) / 40) * 40 + 20;
          const r = [cx - 120, cy - 120, cx + 120, cy + 120];
          if (!rectClear(r, { margin: 30, claim: true, edge: plan.edgeR })) continue;
          taken.push(r);
          onSite(r, () => sewerKiosk(cx, cy, fx, fy, 900 + pi));
          done = true; break;
        }
        if (done) break;
      }
    });
  }
  /** a landmark on open ground: try rings of spots round the centre, outermost first */
  function landmark(build, half, radii, edge, seed) {
    for (const rad of radii)
      for (let k = 0; k < 24; k++) {
        const a = rnd(seed, 300) * Math.PI * 2 + (k * Math.PI * 2) / 24;
        const cx = Math.round((Math.cos(a) * rad) / 10) * 10, cy = Math.round((Math.sin(a) * rad) / 10) * 10;
        const r = [cx - half[0], cy - half[1], cx + half[0], cy + half[1]];
        if (!rectClear(r, { margin: 40, edge, claim: true })) continue;
        taken.push(r);
        onSite(r, () => build(cx, cy, seed));
        return true;
      }
    return false;
  }

  // ------------------------------------------------------------- church --
  // the church: nave facing -y (door at cy - 280), bell tower beside the
  // front, two churchyard trees, a graveyard to the west
  function church(xc, yc) {
    const w = 280, d = 440;
    const g = building(xc, yc - 60, 0, -1, w, d, 1, { wallColor: [218, 212, 198], roofColor: [70, 70, 74], rise: 144, doorW: 60, ridge: false, tiles: [[226, 222, 212], [80, 80, 86]], storey: 168 });
    FURN++;
    g.lbox(-20, 10, 20, 370, 4, 8, { asset: 'PB_DefaultTile', color: [150, 30, 40] });
    for (let v = 60; v <= 300; v += 40)
      for (const [u0, u1] of [[-110, -30], [30, 110]]) {
        g.lbox(u0, v, u1, v + 20, 4, 16, { color: PALETTE.timber[1] });
        g.lbox(u0, v + 20, u1, v + 24, 4, 40, { asset: 'PB_DefaultMicroBrick', color: PALETTE.timber[0] });
      }
    g.lbox(-40, 380, 40, 400, 4, 40, { color: [236, 232, 222] });
    for (const u of [-30, 30]) g.lput('B_Chalice', u, 390, 40 + 10, { color: [220, 180, 80], material: 'BMC_Metallic' });
    for (const v of [120, 240, 360]) g.furnish.lantern(0, v, 0);
    FURN--;
    const tx = xc + w / 2 + 60, ty = g.y0 + 60;
    box(tx - 50, ty - 50, 0, tx + 50, ty + 50, 360, { color: [210, 206, 196] });
    for (const [mx, my] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) box(tx + mx - 10, ty + my - 10, 360, tx + mx + 10, ty + my + 10, 384, { color: [210, 206, 196] });
    put({ size: [10, 10, 10], ...GLOW([255, 220, 140], 4) }, tx, ty - 60, 300);
    tree(xc - 300, yc + 300, 4242);
    tree(xc + 300, yc + 300, 4243);
    for (let x = xc - 600, i = 0; x <= xc - 240; x += 60, i++)
      for (let y = yc - 500, j = 0; y <= yc + 180; y += 80, j++) {
        if (rnd(4300, i, j) < 0.3) continue;
        const grey = pick([[150, 150, 146], [128, 128, 124], [170, 168, 160]], 4301, i, j);
        box(x - 10, y - 36, 0, x + 10, y - 6, 4, { asset: 'PB_DefaultTile', color: [96, 74, 52] });
        if (rnd(4302, i, j) < 0.3) {
          box(x - 4, y - 4, 0, x + 4, y + 4, 36, { asset: 'PB_DefaultMicroBrick', color: grey });
          for (const [a, b] of [[-12, -4], [4, 12]]) box(x + a, y - 4, 24, x + b, y + 4, 30, { asset: 'PB_DefaultMicroBrick', color: grey });
        } else box(x - 8, y - 4, 0, x + 8, y + 2, 24, { asset: 'PB_DefaultMicroBrick', color: grey });
      }
    count('chapel');
  }

  // --------------------------------------------------------- site helpers --
  // occupied footprints [x0, y0, x1, y1]; a site must clear them, the paths,
  // the river and the edge
  const taken = stats.taken = [];
  const hits = (r, m = 0) => taken.some(t => r[0] - m < t[2] && t[0] < r[2] + m && r[1] - m < t[3] && t[1] < r[3] + m);
  const onPath = (x, y) => { const k = plan.surfaceAt(x, y); return k === 'street' || k === 'square'; };
  const why = stats.rejects = {};
  let cur = null;
  const no = k => ((why[k] = (why[k] ?? 0) + 1), (process.env.TOWN_DEBUG && (stats.rejectAt ??= []).push([k, ...cur])), false);
  const rectClear = (r, { margin = 40, river = 120, edge = null, claim = false } = {}) => {
    cur = r;
    if (hits(r, margin)) return no('taken');
    // the footprint itself must stay off the paths (the path raster is whole 40-unit cells)
    for (let x = r[0] + 10; x <= r[2] - 10; x += 20)
      for (let y = r[1] + 10; y <= r[3] - 10; y += 20) {
        if (onPath(x, y)) return no('path');
        if (edge && Math.hypot(x, y) > edge(x, y)) return no('edge');
      }
    // one terrace under the site and round it (the street in front included)
    // claim: the lot may be one tier off here and there (it is levelled to the
    // centre's tier, the ring round it one tier off at most, so walls stay one tier high)
    if (plan?.levelAt) {
      const want = lv((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), T = plan.tierAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2), m = claim ? 90 : 50;
      for (let x = r[0] - m; x <= r[2] + m; x += 20)
        for (let y = r[1] - m; y <= r[3] + m; y += 20) {
          if (!plan.terraceIn(x, y)) continue;
          // a street alongside may be a brick off (a doorstep)
          if (onPath(x, y)) { if (Math.abs(lv(x, y) - want) > 12 && x >= r[0] - 50 && x <= r[2] + 50 && y >= r[1] - 50 && y <= r[3] + 50) return no('terrace'); continue; }
          if (!claim) { if (lv(x, y) !== want) return no('terrace'); continue; }
          const tc = plan.tierAt(x, y);
          if (Math.abs(tc - T) > 1 || (tc !== T && plan.pinnedAt(x, y))) return no('terrace');
          // a cell this claim would re-level must not hold an earlier site
          if (tc !== T && x >= r[0] - 50 && x <= r[2] + 50 && y >= r[1] - 50 && y <= r[3] + 50) {
            const cx0 = Math.floor(x / 40) * 40, cy0 = Math.floor(y / 40) * 40;
            if (hits([cx0, cy0, cx0 + 40, cy0 + 40])) return no('terrace');
          }
        }
      cur.claim = claim ? [r[0] - 50, r[1] - 50, r[2] + 50, r[3] + 50, T] : null;
    }
    for (let x = r[0] - river; x <= r[2] + river; x += 40)
      for (let y = r[1] - river; y <= r[3] + river; y += 40) if (riverAt(x, y)) return no('river');
    return true;
  };
  /** across-front width and depth of a building type with this seed (units, generous) */
  const footprint = (type, s, small) => {
    if (type === 'garden') return [360, 360];
    if (type === 'shop') return [380 + GROW * 10, 330 + GROW * 10];
    if (type === 'bank') return [340, 300];
    if (type === 'tavern') return [380, 280];
    if (type === 'library') return [340, 280];
    if (type === 'warehouse') return [440, 320];
    if (type === 'dininghall') return [500, 280];
    if (type === 'chapel') return [380, 440];
    if (type === 'longhouse') return [400, 260];
    if (type === 'meadhall') return [600, 320];
    if (type === 'casino') return [600, 480];
    if (type === 'gunstore') return [380, 330];
    if (type === 'western') return [340 + GROW * 10, 330 + GROW * 10];
    if (isSmith(rnd, s)) return type === 'cottage' ? [340 + GROW * 10, 290 + GROW * 10] : [380 + GROW * 10, 330 + GROW * 10];
    const sp = shapedSpec(type, rnd, s, small);
    return [(sp.W + 1) * 10 + 20, shapedDepth(sp) + 20];
  };
  // world box of a building centred (cx, cy) facing (fx, fy)
  const boxOf = (cx, cy, fx, fy, [w, d]) => (fx ? [cx - d / 2, cy - w / 2, cx + d / 2, cy + w / 2] : [cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2]);
  /**
   * houses along the paths, both sides, facing the path: walk each path every
   * `step` units; pickType(x, y, s) names the building (or null to skip)
   */
  function housesAlong(paths, { step, pickType, small = false, edge, seed, margin = 40 }) {
    paths.forEach((p, pi) => {
      for (let i = 6, k = 0; i + 6 < p.length; i += Math.round(step / 20), k++) {
        const [x, y] = p[i], [qx, qy] = p[i + 1], tl = Math.hypot(qx - x, qy - y) || 1;
        for (const side of [-1, 1]) {
          const s = seed * 1000 + pi * 100 + k * 2 + (side > 0 ? 1 : 0);
          const type = pickType(x, y, s);
          if (!type) continue;
          const nx = (-(qy - y) / tl) * side, ny = ((qx - x) / tl) * side;
          // face the path: the axis direction closest to -n
          const [fx, fy] = Math.abs(nx) >= Math.abs(ny) ? [-Math.sign(nx), 0] : [0, -Math.sign(ny)];
          const fp = footprint(type, s, small), half = fx ? fp[1] / 2 : fp[1] / 2;
          const off = PATH_W / 2 + 50 + half;
          const cx = Math.round((x - fx * off) / 10) * 10, cy = Math.round((y - fy * off) / 10) * 10;
          const r = boxOf(cx, cy, fx, fy, fp);
          if (!rectClear(r, { edge, margin, claim: true })) continue;
          taken.push(r);
          onSite(r, () => TYPES[type](cx, cy, fx, fy, s, small));
          if (FURN !== 0) throw new Error(`town: ${type} left the furniture switch at ${FURN}`);
        }
      }
    });
  }
  /**
   * back lots (owner 2026-10-10: "make the houses more dense"): after the
   * path-front rows, a jittered grid of plots between them, each house facing
   * the nearest lane (axis-aligned), within `reach` of one
   */
  function infill({ step, pickType, small = false, edge, seed, reach, margin = 30 }) {
    const pts = plan.paths.flat();
    const R = Math.ceil(HALF / step) * step;
    let k = 0;
    for (let gx = -R; gx <= R; gx += step)
      for (let gy = -R; gy <= R; gy += step) {
        const s = seed * 100000 + k++;
        const x = gx + (rnd(s, 61) - 0.5) * step * 0.6, y = gy + (rnd(s, 62) - 0.5) * step * 0.6;
        if (edge && Math.hypot(x, y) > edge(x, y)) continue;
        let bd = Infinity, bx = 0, by = 0;
        for (const [px, py] of pts) { const d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; bx = px; by = py; } }
        if (Math.sqrt(bd) > reach) continue;
        const type = pickType(x, y, s);
        if (!type) continue;
        const [fx, fy] = Math.abs(bx - x) >= Math.abs(by - y) ? [Math.sign(bx - x) || 1, 0] : [0, Math.sign(by - y) || 1];
        const cx = Math.round(x / 10) * 10, cy = Math.round(y / 10) * 10;
        const r = boxOf(cx, cy, fx, fy, footprint(type, s, small));
        if (!rectClear(r, { edge, margin, claim: true })) continue;
        taken.push(r);
        onSite(r, () => TYPES[type](cx, cy, fx, fy, s, small));
        if (FURN !== 0) throw new Error(`town: ${type} left the furniture switch at ${FURN}`);
      }
  }
  /** lamps along the paths, alternating sides */
  function lampsAlong(paths, step, edge) {
    paths.forEach((p, pi) => {
      for (let i = 8, k = 0; i + 4 < p.length; i += Math.round(step / 20), k++) {
        const [x, y] = p[i], [qx, qy] = p[i + 1], tl = Math.hypot(qx - x, qy - y) || 1, side = (k + pi) % 2 ? 1 : -1;
        const lx = Math.round((x - ((qy - y) / tl) * side * (PATH_W / 2 + 20)) / 10) * 10, ly = Math.round((y + ((qx - x) / tl) * side * (PATH_W / 2 + 20)) / 10) * 10;
        const r = [lx - 10, ly - 10, lx + 10, ly + 10];
        if (hits(r, 20) || onPath(lx, ly) || (edge && Math.hypot(lx, ly) > edge(lx, ly)) || [[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40]].some(([a, b]) => riverAt(lx + a, ly + b))) continue;
        taken.push(r);
        onSite(r, () => lamp(lx, ly));
      }
    });
  }
  /** stone bridges where a path crosses the river: deck over the water cells, parapets along both sides */
  function bridges(paths) {
    for (const p of paths) {
      let i = 0;
      while (i < p.length) {
        if (!riverAt(...p[i])) { i++; continue; }
        let j = i;
        while (j + 1 < p.length && riverAt(...p[j + 1])) j++;
        const a = p[Math.max(0, i - 2)], b = p[Math.min(p.length - 1, j + 2)];
        const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
        const run = p.slice(i, j + 1), mid = run.reduce((m, q) => m + (alongX ? q[1] : q[0]), 0) / run.length;
        const lo = v => Math.floor(v / 40) * 40, hi = v => Math.ceil(v / 40) * 40;
        // along: from bank to bank (a little onto each), across: path width + parapets
        let s0 = lo(Math.min(alongX ? a[0] : a[1], alongX ? b[0] : b[1])), s1 = hi(Math.max(alongX ? a[0] : a[1], alongX ? b[0] : b[1]));
        const c0 = lo(mid - PATH_W / 2 - 20), c1 = hi(mid + PATH_W / 2 + 20);
        const R = alongX ? [s0, c0, s1, c1] : [c0, s0, c1, s1];
        for (let x = R[0]; x < R[2]; x += 40) for (let y = R[1]; y < R[3]; y += 40)
          if (riverAt(x + 20, y + 20)) box(x, y, -4, x + 40, y + 40, 0, { asset: 'PB_DefaultMicroBrick', color: PALETTE.stone[0] });
        for (const e of [c0, c1 - 10]) {
          const r = alongX ? [s0, e, s1, e + 10] : [e, s0, e + 10, s1];
          box(r[0], r[1], 0, r[2], r[3], 24, { asset: 'PB_DefaultMicroBrick', color: PALETTE.stone[2] });
          box(r[0], r[1], 24, r[2], r[3], 28, { asset: 'PB_DefaultMicroBrick', color: PALETTE.stone[0] });
        }
        taken.push(R);
        count('bridge');
        i = j + 1;
      }
    }
  }
  function trees(n, seed, ok) {
    for (let k = 0, placed = 0; k < n * 8 && placed < n; k++) {
      const x = Math.round((rnd(seed, k, 1) - 0.5) * 2 * 2400 / 10) * 10, y = Math.round((rnd(seed, k, 2) - 0.5) * 2 * 2400 / 10) * 10;
      const r = [x - 70, y - 70, x + 70, y + 70];
      if (!ok(x, y) || !rectClear(r, { margin: 20, river: 80 })) continue;
      taken.push(r); onSite(r, () => tree(x, y, seed * 31 + k)); placed++;
    }
  }
  /** a fenced field (crops) or pen (grass, a trough), w x h centred */
  function field(cx, cy, w, h, s, crops) {
    const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2, FENCE = { asset: 'PB_DefaultMicroBrick', color: PALETTE.timber[0] };
    if (crops) {
      box(x0 + 20, y0 + 20, 0, x1 - 20, y1 - 20, 4, { color: [96, 70, 48] });
      const CROPS = [['B_Fern', [90, 160, 60], 2], ['B_Pumpkin', [230, 120, 30], 8], ['B_Small_Flower', [110, 170, 70], 2], ['B_Tulip', [220, 60, 40], 6]];
      const along = w >= h;
      for (let r = 0, c = (along ? y0 : x0) + 50; c <= (along ? y1 : x1) - 50; c += 40, r++) {
        const [asset, color, hz] = pick(CROPS, s, r);
        for (let t = (along ? x0 : y0) + 40; t <= (along ? x1 : y1) - 40; t += 20)
          put({ asset, size: [0, 0, 0], color }, along ? t : c, along ? c : t, 4 + hz);
      }
    } else box(cx - 30, cy - 10, 0, cx + 30, cy + 10, 12, { color: PALETTE.timber[1] }); // trough
    // fence: posts every 40, two rails; a gap in the side facing the village centre
    const gapSide = Math.abs(cx) >= Math.abs(cy) ? (cx > 0 ? 'x0' : 'x1') : (cy > 0 ? 'y0' : 'y1');
    const sides = { y0: [x0, y0, x1, y0 + 4], y1: [x0, y1 - 4, x1, y1], x0: [x0, y0 + 4, x0 + 4, y1 - 4], x1: [x1 - 4, y0 + 4, x1, y1 - 4] };
    for (const [name, [a, b, c, d]] of Object.entries(sides)) {
      const alongX = c - a > d - b;
      const runs = name === gapSide ? (alongX ? [[a, (a + c) / 2 - 40], [(a + c) / 2 + 40, c]] : [[b, (b + d) / 2 - 40], [(b + d) / 2 + 40, d]]) : [[alongX ? a : b, alongX ? c : d]];
      for (const [p, q] of runs) for (const z of [12, 28])
        alongX ? box(p, b, z, q, d, z + 4, FENCE) : box(a, p, z, c, q, z + 4, FENCE);
    }
    for (let x = x0; x <= x1 - 4; x += 40) for (const y of [y0, y1 - 4]) if (!(gapSide[0] === 'y' && (gapSide === 'y0' ? y === y0 : y === y1 - 4) && Math.abs(x + 2 - cx) < 40)) box(x, y, 0, x + 4, y + 4, 12, FENCE);
    count(crops ? 'field' : 'pen');
  }

  // -------------------------------------------------------------- village --
  // build({ ..., village: { seed, shops, desert }, plan: planVillage(...) })
  // lays a hamlet: the well under a little roof on a cobbled green, a
  // checkpoint, stall spots for the sword shops, houses along the paths, then
  // fenced fields and a pen between the paths.
  // one building at the origin, door toward -y (mapgen's wild sites: temple, shrine)
  if (single) {
    if (!TYPES[single.type]) throw new Error(`town: no building type ${single.type}`);
    const [sfx, sfy] = single.facing ?? [0, -1];
    TYPES[single.type](0, 0, sfx, sfy, single.seed, false, single.god);
    return stats;
  }
  if (village) {
    const vs = village.seed;
    pole(0, 0, 0, 36, 30, { color: PALETTE.stone[1] });
    pole(0, 0, 36, 40, 20, { color: [30, 40, 60] });
    for (const sx of [-1, 1]) pole(sx * 40, 0, 0, 96, 5, { color: PALETTE.timber[0] });
    gable(-60, -40, 60, 40, 96, 24, pick(PALETTE.roof, vs, 1), true);
    put({ asset: 'B_CheckPoint', size: [0, 0, 0], color: [240, 200, 60] }, 0, -100, 2);
    taken.push([-80, -130, 80, 60], [-200, -240, 0, -160]);
    const edge = (x, y) => plan.edgeR(x, y) - 40;
    // desert: the first house that fits is the gun store
    // (2026-10-10) two of the special buildings in each green hamlet, longhouses round a mead hall in the snow
    const SPECIAL = [['tavern', 'tavern'], ['library', 'library'], ['warehouse', 'warehouse'], ['dininghall', 'dining hall'], ['chapel', 'chapel']];
    const first = Math.floor(rnd(vs, 420) * SPECIAL.length);
    const specials = village.desert || village.nordic ? [] : [SPECIAL[first], SPECIAL[(first + 1 + Math.floor(rnd(vs, 421) * (SPECIAL.length - 1))) % SPECIAL.length]];
    const hamletType = (x, y, s) => {
      if (Math.hypot(x, y) < 260) return null;
      if (village.nordic) return stats.buildings['mead hall'] ? 'longhouse' : 'meadhall';
      if (village.desert) return stats.buildings['gun store'] ? 'western' : 'gunstore';
      const want = specials.find(([, label]) => !stats.buildings[label]);
      if (want && rnd(s, 9) < 0.85) return want[0];
      return rnd(s, 4) < 0.6 ? 'cottage' : 'townhouse';
    };
    housesAlong(plan.paths, { step: 60, small: true, edge, seed: vs, margin: 20, pickType: hamletType }); // step 100 -> 60, margin 40 -> 30 (2026-10-10, denser)
    infill({ step: 80, small: true, edge, seed: vs, reach: 420, margin: 20, pickType: hamletType }); // back lots before the fields take the room
    lampsAlong(plan.paths, 320, edge);
    // fields and a pen between the paths, out toward the edge
    const angles = plan.spokes.map(sp => sp.angle).sort((a, b) => a - b);
    let pens = 0;
    angles.forEach((a, k) => {
      const b = k + 1 < angles.length ? angles[k + 1] : angles[0] + Math.PI * 2, m = (a + b) / 2;
      const er = plan.edgeR(Math.cos(m), Math.sin(m));
      for (const rad of [er - 260, er - 380, er - 480].filter(v => v > 300)) {
        const w = 200 + Math.round(rnd(vs, 70, k) * 3) * 40, h = 200 + Math.round(rnd(vs, 71, k) * 2) * 40;
        const cx = Math.round((Math.cos(m) * rad) / 20) * 20, cy = Math.round((Math.sin(m) * rad) / 20) * 20;
        const r = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        if (!rectClear(r, { margin: 30, edge, claim: true })) continue;
        taken.push(r);
        onSite(r, () => field(cx, cy, w, h, vs * 10 + k, !(pens === 0 && k === angles.length - 1) && !(village.desert)));
        if (!(pens === 0 && k === angles.length - 1)) {} else pens++;
        break;
      }
    });
    // a landmark on the outskirts (2026-10-08): a windmill, a watchtower, or (a few) neither
    const lm = rnd(vs, 310);
    if (lm < 0.4) landmark(windmill, [160, 90], [560, 480, 400, 320], edge, vs);
    else if (lm < 0.8) landmark(watchtower, [60, 60], [560, 480, 400, 320], edge, vs);
    propsAlong(plan.paths, 160, edge, vs, village.desert ? PROP_KINDS.filter(k => k !== 'hay' && k !== 'planter') : PROP_KINDS);
    // shop stands (2026-10-06): a ring round the green, buttons toward the well,
    // clear of the paths, the houses and the checkpoint; [x, y, z, orient]
    stats.shopSpots = [];
    const want = village.shops ?? 0;
    for (const rad of [120, 170, 220]) {
      const n = Math.floor((2 * Math.PI * rad) / 60);
      for (let k = 0; k < n && stats.shopSpots.length < want; k++) {
        const a = (k * 2 * Math.PI) / n + rad / 100;
        const x = Math.round((Math.cos(a) * rad) / 10) * 10, y = Math.round((Math.sin(a) * rad) / 10) * 10;
        const r = [x - 20, y - 20, x + 20, y + 20];
        if (plan.surfaceAt(x, y) === 'street' || hits(r, 10)) continue; // on the green, off the lanes
        // orient: 16 button -y, 17 +x, 18 +y, 19 -x: toward the well
        const orient = Math.abs(x) >= Math.abs(y) ? (x > 0 ? 19 : 17) : (y > 0 ? 16 : 18);
        taken.push(r);
        stats.shopSpots.push([x, y, 12 + lv(x, y), orient]);
      }
    }
    count('village');
    return stats;
  }

  // ------------------------------------------------------- plaza decor --
  // (2026-10-14; spread out the same day, owner: "super scrunched") benches r 260,
  // statues r 300 on the diagonals, boards r 330; all inside r 380 (the market stands sit
  // on r 400) and clear of the spawn ring (r 200, every 45 degrees).
  function plazaDecor() {
    const MB = 'PB_DefaultMicroBrick';
    const PALE = [206, 198, 182], CUT = [170, 162, 150], DARK = [96, 104, 110], MID = [150, 144, 134];
    const WATER = { color: [70, 150, 210], material: 'BMC_Glass' }, FALL = { color: [190, 225, 245], material: 'BMC_Glass' };
    // octagonal ring dIn < d <= dOut (d = octagon radius), laid as 4-unit row strips
    const oct = (z0, z1, dIn, dOut, b) => {
      const C = 4;
      for (let y = -dOut; y < dOut; y += C) {
        let run = null;
        for (let x = -dOut; x <= dOut; x += C) {
          const mx = Math.abs(x + C / 2), my = Math.abs(y + C / 2);
          const d = Math.max(mx, my, (mx + my) * Math.SQRT1_2);
          const inside = x < dOut && d > dIn && d <= dOut;
          if (inside && run === null) run = x;
          else if (!inside && run !== null) { box(run, y, z0, x, y + C, z1, { asset: MB, ...b }); run = null; }
        }
      }
    };
    // ---- fountain: stepped octagonal basin, two tiers of bowls with falling water
    oct(0, 4, 0, 144, { color: PALE });                 // step
    oct(4, 8, 0, 120, { color: DARK });                 // basin floor
    oct(4, 28, 120, 136, { color: CUT });               // basin wall
    oct(28, 32, 116, 140, { color: PALE });             // coping
    oct(8, 24, 32, 120, WATER);                         // pool
    oct(8, 48, 0, 32, { color: MID });                  // pedestal
    oct(24, 64, 48, 56, FALL);                          // curtain from the lower bowl
    oct(48, 64, 0, 12, { color: MID });                 // column
    oct(64, 70, 0, 60, { color: PALE });                // lower bowl
    oct(70, 76, 52, 60, { color: PALE });               //   its lip
    oct(70, 74, 12, 52, WATER);                         //   its water
    oct(70, 116, 0, 12, { color: MID });                // upper column
    oct(74, 116, 24, 28, FALL);                         // curtain from the upper bowl
    oct(116, 120, 0, 32, { color: PALE });              // upper bowl
    oct(120, 126, 24, 32, { color: PALE });             //   its lip
    oct(120, 124, 8, 24, WATER);                        //   its water
    oct(120, 140, 0, 8, { color: MID });                // finial stem
    pole(0, 0, 140, 148, 10, GLOW([120, 220, 255], 4)); // glowing orb
    for (let k = 0; k < 8; k++) {                       // lanterns on the coping
      const a = (k * Math.PI) / 4, x = Math.round(Math.cos(a) * 64) * 2, y = Math.round(Math.sin(a) * 64) * 2;
      box(x - 4, y - 4, 32, x + 4, y + 4, 44, { asset: MB, color: CUT });
      box(x - 5, y - 5, 44, x + 5, y + 5, 52, { asset: MB, ...GLOW([255, 200, 120], 3) });
    }
    // a local frame at (x, y) whose front (+b) faces (fx, fy); a runs along it
    const frame = (x, y, fx, fy) => {
      const ux = -fy, uy = fx;
      const at = (a, b) => [x + a * ux + b * fx, y + a * uy + b * fy];
      const bx = (a0, b0, z0, a1, b1, z1, br) => {
        const [p, q] = at(a0, b0), [r, t] = at(a1, b1);
        box(Math.min(p, r), Math.min(q, t), z0, Math.max(p, r), Math.max(q, t), z1, { asset: MB, ...br });
      };
      return { at, bx };
    };
    const toCentre = (x, y) => (Math.abs(x) >= Math.abs(y) ? [-Math.sign(x), 0] : [0, -Math.sign(y)]);
    // ---- benches: two each side, facing the fountain, between the spawn points
    for (let k = 0; k < 4; k++) {
      const [cx, cy] = [[260, 0], [0, 260], [-260, 0], [0, -260]][k], [fx, fy] = toCentre(cx, cy);
      for (const s of [-1, 1]) {
        const { bx } = frame(cx + -fy * s * 60, cy + fx * s * 60, fx, fy);
        for (const a of [-1, 1]) bx(a * 40, -10, 0, a * 34, 12, 16, { color: CUT });               // stone ends
        for (const [b0, b1] of [[-10, -4], [-2, 4], [6, 12]]) bx(-40, b0, 16, 40, b1, 20, { color: PALETTE.timber[1] }); // seat planks
        for (const a of [-1, 1]) bx(a * 40, -14, 0, a * 32, -10, 44, { color: PALETTE.timber[0] }); // back posts
        for (const z of [26, 36]) bx(-32, -14, z, 32, -10, z + 6, { color: PALETTE.timber[1] });   // back rails
      }
    }
    // ---- statues on plinths, facing the fountain
    const MARBLE = { color: [228, 224, 214] }, BRONZE = { color: [176, 132, 66] };
    STATUES.forEach(([text, kind], k) => {
      const ang = Math.PI / 4 + (k * Math.PI) / 2;
      const x = Math.round((Math.cos(ang) * 300) / 2) * 2, y = Math.round((Math.sin(ang) * 300) / 2) * 2, [fx, fy] = toCentre(x, y);
      const { at, bx } = frame(x, y, fx, fy);
      bx(-26, -26, 0, 26, 26, 8, { color: PALE });   // base
      bx(-22, -22, 8, 22, 22, 44, { color: CUT });   // die
      bx(-26, -26, 44, 26, 26, 50, { color: PALE }); // cornice
      const [px, py] = at(0, 23);
      plaque({ put, text, facing: [fx, fy], x: px, y: py, z: 26, w: 18, h: 8, color: [60, 56, 52], style: { LineHeight: 3, Color: { R: 230, G: 190, B: 110, A: 255 } } });
      // the figure, about 1.4 players tall
      bx(-12, -6, 50, -2, 6, 90, MARBLE); bx(2, -6, 50, 12, 6, 90, MARBLE);   // legs
      bx(-14, -8, 90, 14, 8, 126, MARBLE);                                     // body
      bx(-22, -6, 94, -14, 6, 124, MARBLE); bx(14, -6, 94, 22, 6, 124, MARBLE); // arms
      bx(-4, -4, 126, 4, 4, 128, MARBLE);                                      // neck
      bx(-8, -8, 128, 8, 8, 146, MARBLE);                                      // head
      if (kind === 'knight') {
        bx(-2, -6, 146, 2, 6, 152, BRONZE);                                    // helmet crest
        bx(24, -2, 56, 28, 2, 118, { color: [200, 204, 210] });                // blade
        bx(22, -4, 118, 30, 4, 122, BRONZE);                                   // guard
        bx(24, -2, 122, 28, 2, 132, BRONZE);                                   // grip
      } else if (kind === 'wizard') {
        bx(-12, -12, 146, 12, 12, 150, MARBLE); bx(-7, -7, 150, 7, 7, 160, MARBLE); bx(-4, -4, 160, 4, 4, 168, MARBLE); bx(-2, -2, 168, 2, 2, 174, MARBLE); // hat
        bx(22, -2, 50, 26, 2, 158, { color: PALETTE.timber[1] });              // staff
        bx(20, -4, 158, 28, 4, 166, GLOW([150, 120, 255], 4));                 // its stone
      } else if (kind === 'archer') {
        bx(4, -16, 100, 12, -8, 132, { color: PALETTE.timber[0] });            // quiver
        bx(22, 6, 70, 24, 8, 140, { color: PALETTE.timber[1] });               // bow
        bx(22, -2, 72, 24, 6, 74, { color: PALETTE.timber[1] }); bx(22, -2, 136, 24, 6, 138, { color: PALETTE.timber[1] });
      } else {
        for (const [a0, b0, a1, b1] of [[-8, 8, 8, 10], [-8, -10, 8, -8], [-10, -10, -8, 10], [8, -10, 10, 10]]) bx(a0, b0, 146, a1, b1, 150, BRONZE); // crown band
        for (const a of [-8, 0, 6]) bx(a, 8, 150, a + 2, 10, 154, BRONZE);     // crown points
      }
    });
    // ---- notice boards: one each side behind the spawn point, both faces written
    NOTICES.forEach((n, k) => {
      const [cx, cy] = [[330, 0], [0, 330], [-330, 0], [0, -330]][k], [fx, fy] = toCentre(cx, cy);
      const { at, bx } = frame(cx, cy, fx, fy);
      for (const a of [-1, 1]) bx(a * 61, -5, 0, a * 71, 5, 112, { color: PALETTE.timber[0] }); // posts
      bx(-60, -2, 30, 60, 2, 104, { color: PALETTE.timber[1] });  // board
      bx(-60, -4, 26, 60, 4, 30, { color: PALETTE.timber[0] });   // bottom rail
      bx(-60, -4, 104, 60, 4, 108, { color: PALETTE.timber[0] }); // top rail
      bx(-74, -10, 112, 74, 10, 116, { color: PALETTE.roof[1] }); // roof
      bx(-68, -6, 116, 68, 6, 120, { color: PALETTE.roof[1] });
      const style = { LineHeight: 4.5, Color: { R: 40, G: 32, B: 24, A: 255 }, OutlineWidth: 0, Anchor: { X: 0.5, Y: 0.5 } };
      for (const [s, text] of [[1, n.front], [-1, n.back]]) {
        const [px, py] = at(0, s * 3);
        plaque({ put, text, facing: [fx * s, fy * s], x: px, y: py, z: 67, w: 56, h: 34, color: [236, 228, 206], style });
      }
    });
  }

  // --------------------------------------------------------------- town --
  // the plaza: fountain and the spawn ring in the middle, benches, statues
  // and notice boards round it (owner 2026-10-14: "make the main fountain
  // beautiful and add benches and statues and noticeboards")
  onSite([-1, -1, 1, 1], () => plazaDecor());
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    put({ asset: 'B_SpawnPoint', size: [0, 0, 0], color: [240, 240, 240] }, Math.round(Math.cos(a) * 20) * 10, Math.round(Math.sin(a) * 20) * 10, 2);
  }
  taken.push([-PLAZA_R, -PLAZA_R, PLAZA_R, PLAZA_R]);
  // the market (owner 2026-10-05: "spawn needs to have all the shops"): every
  // sword shop on the plaza's north side and every gun stand on its south
  // side, buttons toward the fountain. Prefab stands, stamped by mapgen
  // (stats.townShops -> shops.json): orient 16 button -y, 18 button +y.
  stats.townShops = [];
  // dagger, sword and longsword in every material (owner 2026-10-05: just those three;
  // swordshopgen.mjs also makes scimitar / spatha / 2h stands, unused),
  // then the guns, on two rings round the fountain, each type a run of the
  // seven tiers, buttons toward the fountain; gaps where the paths come in
  const TIER7 = ['bronze', 'iron', 'steel', 'black', 'mithril', 'adamant', 'rune'];
  const wares = [];
  // spawn sells the low tiers only (owner 2026-10-06: "low level and spawn stuff at spawn
  // but you get more options as you get deeper in"): bronze and iron blades, the plain and
  // oak bows; the hamlets sell the rest by distance (mapgen villages), guns at the desert store
  void TIER7;
  for (const ty of ['dagger', '', 'longsword']) for (const t of ['bronze', 'iron']) wares.push({ tier: ty ? `${t}_${ty}` : t });
  for (const bow of ['bow', 'oak']) wares.push({ tier: bow, prefab: 'bow_' + bow });
  // (owner 2026-10-14: "make shitty guns at spawn") the two cheapest guns; the rest stay at the desert store
  for (const gun of ['derringer', 'revolver']) wares.push({ tier: gun, prefab: 'gun_' + gun });
  const mouths = plan.paths.filter(p => Math.hypot(...p[0]) <= PLAZA_R + 40).map(p => p.find(([x, y]) => Math.hypot(x, y) >= PLAZA_R - 40)).filter(Boolean).map(([x, y]) => Math.atan2(y, x));
  const spots = [];
  for (const r of [400, 346, 292]) {
    const n = Math.floor((2 * Math.PI * r) / 44);
    for (let k = 0; k < n; k++) {
      const a = Math.PI / 2 - (k * 2 * Math.PI) / n; // from north, clockwise
      if (mouths.some(m => Math.abs((((a - m) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < (PATH_W / 2 + 50) / r)) continue;
      const sx = Math.round((Math.cos(a) * r) / 10) * 10, sy = Math.round((Math.sin(a) * r) / 10) * 10;
      spots.push([sx, sy, a]);
    }
  }
  // the stands are prefabs (no bricks here), so they are placed after the
  // landmarks below and skip any spot whose base something already fills
  // (2026-10-06: the bank's portico columns took the oak bow's spot)
  const placeStands = () => {
    const open = spots.filter(([x, y]) => free(x - 10, y - 10, 0, x + 10, y + 10, 30));
    if (open.length < wares.length) throw new Error(`town: market has ${open.length} free spots for ${wares.length} stands`);
    wares.forEach((w, k) => {
      const [x, y, a] = open[k], c = Math.cos(a), sn = Math.sin(a);
      // orient: 16 button -y, 17 +x, 18 +y, 19 -x
      const orient = Math.abs(c) >= Math.abs(sn) ? (c > 0 ? 19 : 17) : (sn > 0 ? 16 : 18);
      stats.townShops.push({ at: [x, y, 12 + lv(x, y)], tier: w.tier, orient, ...(w.prefab ? { prefab: w.prefab } : {}) });
    });
  };
  // landmarks
  const [CX, CY] = plan.castle, [HX, HY] = plan.church;
  onSite([CX - 1, CY - 1, CX + 1, CY + 1], () => castle(CX, CY));
  taken.push([CX - 540, CY - 520, CX + 540, CY + 520]);
  onSite([HX - 1, HY - 1, HX + 1, HY + 1], () => church(HX, HY));
  taken.push([HX - 640, HY - 560, HX + 280, HY + 380]);
  onSite([-541, -201, -539, -199], () => TYPES.bank(-540, -200, 1, 0, 7001));
  taken.push([-680, -380, -370, -20]);
  placeStands();
  onSite([559, -761, 561, -759], () => TYPES.tavern(560, -760, -1, 0, 7002));
  taken.push([420, -960, 700, -560]);
  // river crossings first, so nothing lands on a bridge
  bridges(plan.paths);
  // (2026-10-08) market stalls down the first stretch of each road out of the
  // plaza, and a windmill out toward the edge, before the houses take the room
  stallsAlong(plan.main.slice(0, 4), PLAZA_R + 60, 900, 160, 501);
  // (2026-10-12) sewer accesses on three of the roads out
  sewerAccess(plan.main.slice(0, 3));
  landmark(windmill, [160, 90], [1900, 1700, 1500], plan.edgeR, 502);
  // houses along every path: shops near the plaza, homes further out
  // (2026-10-10, owner: "make the houses more dense"): step 160 -> 80, margin 40 -> 30,
  // then back lots between the rows (infill), smaller houses there
  const townType = (x, y, s) => {
    const r = Math.hypot(x, y), u = rnd(s, 51);
    if (r < 1000) return u < 0.5 ? 'shop' : 'townhouse';
    return u < 0.1 ? 'garden' : u < 0.2 ? 'shop' : u < 0.6 ? 'townhouse' : 'cottage';
  };
  housesAlong(plan.paths, { step: 60, edge: plan.edgeR, seed: 77, margin: 20, pickType: townType }); // step 80 -> 60 (2026-10-13: bigger houses, same count)
  infill({ step: 80, small: true, edge: plan.edgeR, seed: 78, reach: 1400, margin: 20, pickType: (x, y, s) => { const t = townType(x, y, s); return t === 'garden' ? null : t; } });
  lampsAlong(plan.paths, 400, plan.edgeR);
  propsAlong(plan.paths, 120, plan.edgeR, 503);
  trees(26, 7100, (x, y) => Math.hypot(x, y) < plan.edgeR(x, y) - 120);
  return stats;

}
