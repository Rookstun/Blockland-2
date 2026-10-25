// Surface keep great hall + gate portico (2026-10-25, owner: "make the rooms
// bigger. implement a platforming puzzle", with Forest Temple refs: the main
// hall and the entrance portico).
//
// The hall is the keep's biggest room (surfacedungeon.mjs layout() places it
// first) and stands HALL_UP above the roof as its own walled block. Inside:
//   - a gallery along one wall (GH high, the wall with the fewest doors; it
//     bridges doorways under a micro-brick lintel), balustrade on its edge, a
//     coursed stair along its front (rise 12, run 2 studs, landings both ends);
//   - a spike pit (PB_Spike + Component_Damage, like the Stash temple) with a
//     parapet, a red carpet round it and a coloured torch on each corner;
//   - the puzzle: pillars round the pit's island, each STEP higher than the
//     last (STEP > half a jump, so a pillar is reachable only from the one
//     before it), taken the long way round; the island (top GH + 3 STEP) holds
//     a gazebo and the reward pot;
//   - a cornice near the ceiling with vines hanging off it.
// Player: 60 tall, jumps 108 high / 300 long (BUILDING.md).
// Everything is in keep-frame studs through put(x0, y0, x1, y1, z0, z1, brick);
// z in units, 0 = the paving top.
const MB = 'PB_DefaultMicroBrick', TILE_B = 'PB_DefaultTile';
export const HALL_UP = 288;          // extra wall over the keep's 156 (24 courses)
const GD = 5, GH = 132, STEP = 60;  // gallery depth (studs), gallery top, pillar rise
const DAMAGE = { type: 'Component_Damage', data: { Damage: 20, RepeatDelay: 0.5, Message: 'SPIKES', ConsoleTag: '' } };
const LIGHT = c => ({ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: 4, Radius: 420, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });

// I = hall interior [x0, y0, x1, y1] (keep-frame studs); doors = [{ side: 'S'|'N'|'W'|'E', a0, a1 }]
// (a = stud along that wall, keep frame); top = wall top (156)
export function greatHall({ put, I, doors, top, T, rng, shade }) {
  const [ix0, iy0, ix1, iy1] = I;
  const pots = [];
  // hall frame for a gallery side: u along the gallery wall, v away from it
  const frames = {
    S: { W: ix1 - ix0, D: iy1 - iy0, m: (u, v) => [ix0 + u, iy0 + v] },
    N: { W: ix1 - ix0, D: iy1 - iy0, m: (u, v) => [ix0 + u, iy1 - v] },
    W: { W: iy1 - iy0, D: ix1 - ix0, m: (u, v) => [ix0 + v, iy0 + u] },
    E: { W: iy1 - iy0, D: ix1 - ix0, m: (u, v) => [ix1 - v, iy0 + u] },
  };
  const along = s => (s === 'S' || s === 'N' ? ix0 : iy0); // a -> u offset on that side
  const left = { S: 'W', N: 'W', W: 'S', E: 'S' }, right = { S: 'E', N: 'E', W: 'N', E: 'N' };
  // a door on a side wall (stud span a0..a1 along it): its nearest v from gallery wall s
  const vOn = (s, a0, a1) => ({ S: a0 - iy0, N: iy1 - a1, W: a0 - ix0, E: ix1 - a1 }[s]);
  let plan = null;
  const order = ['S', 'N', 'W', 'E'].map(s => [doors.filter(d => d.side === s).length, rng(), s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, , s] of order) {
    const f = frames[s];
    const notch = doors.filter(d => d.side === s).map(d => [d.a0 - along(s) - 1, d.a1 - along(s) + 1]);
    // doors on the side walls next to the gallery's ends: trim the gallery back
    let g0 = 0, g1 = f.W;
    for (const d of doors) {
      if (d.side !== left[s] && d.side !== right[s]) continue;
      if (vOn(s, d.a0, d.a1) > GD + 3) continue;
      if (d.side === left[s]) g0 = Math.max(g0, 3); else g1 = Math.min(g1, f.W - 3);
    }
    const free = (a, b) => a >= g0 && b <= g1 && notch.every(([n0, n1]) => b <= n0 || a >= n1);
    const opts = [];
    for (let st = g0; st + 22 <= g1; st++)
      for (const dir of [1, -1]) {
        const low = dir > 0 ? [st - 3, st] : [st + 22, st + 25]; // the bottom landing
        if (low[0] < 0 || low[1] > f.W) continue;
        if (free(st, st + 22) && notch.every(([n0, n1]) => low[1] <= n0 || low[0] >= n1)) opts.push([st, dir]);
      }
    if (!opts.length) continue;
    const [st, dir] = opts[Math.floor(rng() * opts.length)];
    plan = { s, f, notch, g0, g1, st, dir };
    break;
  }
  if (!plan) return { pots, ok: false };
  const { f, notch, g0, g1, st, dir } = plan;
  const box = (u0, v0, u1, v1, z0, z1, b) => {
    const [ax, ay] = f.m(u0, v0), [bx, by] = f.m(u1, v1);
    put(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, b);
  };
  const field = k => shade(T.field[k % T.field.length], k);
  // ---- gallery: 11 courses; doorways (6 courses) run under it, a micro lintel over them
  const cuts = (a, b, holes) => { // [a, b) minus holes -> pieces
    let out = [[a, b]];
    for (const [h0, h1] of holes) out = out.flatMap(([p, q]) => (h1 <= p || h0 >= q ? [[p, q]] : [[p, Math.max(p, h0)], [Math.min(q, h1), q]].filter(([x, y]) => y > x)));
    return out;
  };
  const NC = GH / 12;
  for (let c = 0; c < NC; c++) {
    const k = Math.floor(rng() * 5), col = c === NC - 1 ? T.trim : field(k);
    for (const [p, q] of cuts(g0, g1, c < 6 ? notch : [])) {
      const lintel = c === 6 && notch.some(([n0, n1]) => p < n1 && q > n0);
      if (!lintel) { box(p, 0, q, GD, c * 12, c * 12 + 12, { color: col }); continue; }
      for (const [r0, r1] of cuts(p, q, notch)) box(r0, 0, r1, GD, c * 12, c * 12 + 12, { color: col });
      for (const [n0, n1] of notch) { const a = Math.max(p, n0), b = Math.min(q, n1); if (b > a) box(a, 0, b, GD, c * 12, c * 12 + 12, { asset: MB, color: col }); }
    }
  }
  // ---- stair along the gallery front: 11 treads, coursed (each course one row over every tread that high)
  for (let c = 0; c < NC; c++) {
    const [a, b] = dir > 0 ? [st + 2 * c, st + 22] : [st, st + 22 - 2 * c];
    box(a, GD, b, GD + 3, c * 12, c * 12 + 12, { color: c === NC - 1 ? T.trim : field(c + 2) });
  }
  // ---- pit, island, pillars
  const pu0 = 4, pu1 = f.W - 4, pv0 = GD + 3 + 3, pv1 = f.D - 4;
  const P = [pu0 + 1, pv0 + 1, pu1 - 1, pv1 - 1];
  const IS = Math.min(P[2] - P[0], P[3] - P[1]) >= 19 ? 7 : 5;
  const iu0 = Math.floor((P[0] + P[2] - IS) / 2), iv0 = Math.floor((P[1] + P[3] - IS) / 2) + 1;
  const ISL = [iu0, iv0, iu0 + IS, iv0 + IS];
  const ISTOP = GH + 3 * STEP;
  // pillars (3 x 3) on a ring round the island, from the gallery side the long way round
  const off = Math.max(2, Math.min(4, ISL[0] - P[0] - 3, ISL[1] - P[1] - 3, P[2] - ISL[2] - 3, P[3] - ISL[3] - 3));
  const M = [ISL[0] - off - 3, ISL[1] - off - 3, ISL[2] + off, ISL[3] + off]; // pillar lower-left corners
  const Lw = M[2] - M[0], Lh = M[3] - M[1], Lp = 2 * (Lw + Lh);
  const at = t => { t = ((t % Lp) + Lp) % Lp; if (t < Lw) return [M[0] + t, M[1]]; t -= Lw; if (t < Lh) return [M[2], M[1] + t]; t -= Lh; if (t < Lw) return [M[2] - t, M[3]]; return [M[0], M[3] - (t - Lw)]; };
  const jumpU = Math.max(g0 + 2, Math.min(g1 - 3, dir > 0 ? st - 4 : st + 25)); // off the stair's low end, still gallery
  const away = dir > 0 ? -1 : 1; // walk away from the stair first
  const t0 = Math.max(0, Math.min(Lw, jumpU - 1 - M[0]));
  const HEIGHTS = [GH + STEP, GH + STEP, GH + 2 * STEP, GH + 2 * STEP, GH + 2 * STEP];
  const span = Math.round(0.72 * Lp), stepT = span / (HEIGHTS.length - 1);
  const pillars = HEIGHTS.map((h, n) => { const [u, v] = at(t0 + away * n * stepT); return { u: Math.round(u), v: Math.round(v), h }; });
  const onPillar = (u, v) => pillars.some(p => u >= p.u && u < p.u + 3 && v >= p.v && v < p.v + 3);
  const onIsland = (u, v) => u >= ISL[0] && u < ISL[2] && v >= ISL[1] && v < ISL[3];
  // carpet, parapet, spikes
  const CARPET = [128, 34, 30];
  for (const [a, b, c, d] of [[pu0 - 2, pv0 - 2, pu1 + 2, pv0], [pu0 - 2, pv1, pu1 + 2, pv1 + 2], [pu0 - 2, pv0, pu0, pv1], [pu1, pv0, pu1 + 2, pv1]])
    box(a, b, c, d, 0, 4, { asset: TILE_B, color: CARPET }); // (a 2-high tile loads as 'Missing brick type')
  for (const [a, b, c, d] of [[pu0, pv0, pu1, pv0 + 1], [pu0, pv1 - 1, pu1, pv1], [pu0, pv0 + 1, pu0 + 1, pv1 - 1], [pu1 - 1, pv0 + 1, pu1, pv1 - 1]])
    box(a, b, c, d, 0, 12, { color: T.trim });
  for (let u = P[0]; u < P[2]; u++) for (let v = P[1]; v < P[3]; v++)
    if (!onPillar(u, v) && !onIsland(u, v)) box(u, v, u + 1, v + 1, 0, 10, { asset: 'PB_Spike', color: [120, 116, 110], components: [DAMAGE] });
  // pillars: coursed shafts, a trim cap
  for (const p of pillars) for (let z = 0; z < p.h; z += 12) box(p.u, p.v, p.u + 3, p.v + 3, z, z + 12, { color: z + 12 >= p.h ? T.trim : field(z / 12 + p.u) });
  // island + gazebo + the reward
  for (let z = 0; z < ISTOP; z += 12) box(ISL[0], ISL[1], ISL[2], ISL[3], z, z + 12, { color: z + 12 >= ISTOP ? T.trim : field(z / 12 + 3) });
  const MARBLE = [70, 130, 92], GOLD = [196, 170, 92];
  for (const [u, v] of [[ISL[0], ISL[1]], [ISL[2] - 1, ISL[1]], [ISL[0], ISL[3] - 1], [ISL[2] - 1, ISL[3] - 1]]) box(u, v, u + 1, v + 1, ISTOP, ISTOP + 84, { asset: MB, color: MARBLE });
  box(ISL[0], ISL[1], ISL[2], ISL[3], ISTOP + 84, ISTOP + 90, { asset: MB, color: [48, 96, 66] });
  box(ISL[0] + 1, ISL[1] + 1, ISL[2] - 1, ISL[3] - 1, ISTOP + 90, ISTOP + 96, { asset: MB, color: GOLD });
  {
    const [x, y] = f.m(ISL[0] + IS / 2, ISL[1] + IS / 2);
    pots.push([x, y, ISTOP]);
  }
  // torches on the parapet corners: pole, cup, a coloured flame with its light
  const TORCH = [[255, 150, 50], [200, 90, 255], [90, 255, 120], [90, 170, 255]];
  [[pu0, pv0], [pu1 - 1, pv0], [pu0, pv1 - 1], [pu1 - 1, pv1 - 1]].forEach(([u, v], n) => {
    box(u + 0.2, v + 0.2, u + 0.8, v + 0.8, 12, 44, { asset: MB, color: MARBLE });
    box(u, v, u + 1, v + 1, 44, 50, { asset: MB, color: GOLD });
    box(u + 0.3, v + 0.3, u + 0.7, v + 0.7, 50, 62, { asset: MB, color: TORCH[n], material: 'BMC_Glow', material_intensity: 10, components: [LIGHT(TORCH[n])] });
  });
  // balustrade on the gallery edge: posts every 3 studs, a micro rail; open at the stair head and the jump
  const RAIL = [58, 46, 40];
  const head = dir > 0 ? [st + 19, st + 22] : [st, st + 3];
  const gaps = [head, [jumpU - 2, jumpU + 3]];
  for (const [p, q] of cuts(g0, g1, gaps)) {
    if (q - p < 2) continue;
    for (let u = p; u < q; u += 3) box(u + 0.2, GD - 0.8, u + 0.8, GD - 0.2, GH, GH + 24, { asset: MB, color: RAIL });
    box(p, GD - 1, q, GD, GH + 24, GH + 28, { asset: MB, color: RAIL });
  }
  // cornice + vines (in the whole hall's frame: the four walls)
  const ceil = top + HALL_UP - 4; // the hall ceiling's underside
  const W = ix1 - ix0, D = iy1 - iy0;
  const cor = [ceil - 24, ceil - 14];
  put(ix0, iy0, ix1, iy0 + 1, cor[0], cor[1], { asset: MB, color: T.frieze[0] });
  put(ix0, iy1 - 1, ix1, iy1, cor[0], cor[1], { asset: MB, color: T.frieze[0] });
  put(ix0, iy0 + 1, ix0 + 1, iy1 - 1, cor[0], cor[1], { asset: MB, color: T.frieze[0] });
  put(ix1 - 1, iy0 + 1, ix1, iy1 - 1, cor[0], cor[1], { asset: MB, color: T.frieze[0] });
  const VINE = [[46, 92, 52], [60, 112, 58], [38, 78, 46]];
  const used = new Set();
  for (let n = 0; n < 14; n++) {
    const wall = n % 4, a = 2 + Math.floor(rng() * ((wall < 2 ? W : D) - 4)), len = 40 + Math.floor(rng() * 6) * 20;
    if ([-1, 0, 1].some(d => used.has(wall + ',' + (a + d)))) continue;
    used.add(wall + ',' + a);
    const [x0, y0] = wall === 0 ? [ix0 + a, iy0] : wall === 1 ? [ix0 + a, iy1 - 0.4] : wall === 2 ? [ix0, iy0 + a] : [ix1 - 0.4, iy0 + a];
    const [sx, sy] = [0.4, 0.4];
    const col = VINE[n % 3];
    put(x0, y0, x0 + sx, y0 + sy, cor[0] - len, cor[0], { asset: MB, color: col });
    for (let z = cor[0] - len + 8; z < cor[0] - 8; z += 16) { // leaves, off alternate sides
      const s = (z / 16) % 2 ? 1 : -1;
      const [lx, ly] = wall < 2 ? [x0 + (s > 0 ? 0.4 : -0.6), y0] : [x0, y0 + (s > 0 ? 0.4 : -0.6)];
      const [lw, lh] = wall < 2 ? [0.6, 0.4] : [0.4, 0.6];
      put(lx, ly, lx + lw, ly + lh, z, z + 4, { asset: MB, color: VINE[(n + 1) % 3] });
    }
  }
  return { pots, ok: true, side: plan.s, pillars: pillars.length };
}

// the gate's portico: podium, two columns + pilasters, entablature, a stepped pediment
// face = the wall's outer face (keep-frame stud line), a = the gate's stud along the wall, side [dx, dy]
export function portico({ put, face, a: ga, side: [dx, dy], T }) {
  const m = (a, o) => (dx ? [face + dx * o, a] : [a, face + dy * o]);
  const box = (a0, o0, a1, o1, z0, z1, b) => {
    const [ax, ay] = m(ga + a0, o0), [bx, by] = m(ga + a1, o1);
    put(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, b);
  };
  box(-7, 0, 7, 6, 0, 4, { asset: MB, color: T.trim });
  box(-5, 6, 5, 8, 0, 2, { asset: MB, color: T.dado });
  for (const a of [-6, 4]) {
    box(a, 3, a + 2, 5, 4, 10, { asset: MB, color: T.trim });
    box(a + 0.2, 3.2, a + 1.8, 4.8, 10, 88, { asset: MB, color: T.mould });
    box(a, 3, a + 2, 5, 88, 96, { asset: MB, color: T.trim });
    box(a, 0, a + 2, 1, 4, 96, { asset: MB, color: T.mould }); // pilaster on the wall
  }
  box(-7, 0, 7, 6, 96, 100, { asset: MB, color: T.dado });
  box(-7, 0, 7, 6, 100, 108, { asset: MB, color: T.mould });
  for (let k = 0; k < 7; k++) box(-7 + k, 0, 7 - k, 6, 108 + 4 * k, 112 + 4 * k, { asset: MB, color: k ? T.trim : T.dado });
}
