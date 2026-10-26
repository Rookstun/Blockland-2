// Surface keep great hall + gate portico (2026-10-25, owner: "make the rooms
// bigger. implement a platforming puzzle", Forest Temple refs: main hall,
// entrance portico). v2 after the owner's walkthrough: "spikes should NEVER say
// spikes", "stairs should NEVER look like this" (a pyramid of studded slabs),
// "brickwork should be a factor in presentation", "window arches but NO PLAYER
// should be able to get through them unless theres a deliberate secret", "the
// room is claustrophobic. failure to use smooth tiles", "respect ceiling and
// make its architecture impressive".
//
// hallShell(): the hall's walls HALL_UP over the keep roof in bonded blocks
// (2-5 studs, staggered per course), tall pointed-arch windows (micro wedges in
// the arch course, a glass pane in every opening), buttresses with weathered
// tops between them, a cornice, a coved ceiling (hanging micro wedges, K steps
// in), a coffered ceiling (blue panels, trim beams) round a central oculus under
// a glass lantern on the roof.
// greatHall(): smooth-tile floor; a gallery = smooth-tile slab on piers with
// hanging-wedge haunches (open underneath, doors under it stay free) on the
// wall with the fewest doors; its stair runs along the front between two
// bonded stringers with sloped wedge copes, smooth-tile treads (rise 12, run 2
// studs); a spike pit (PB_Spike + Component_Damage, NO message) with parapet,
// red smooth-tile carpet and 4 coloured torches; the puzzle: pillars on a ring
// round the island, the first half STEP over the gallery, the rest 2 STEP, the
// island 3 STEP (STEP 60 > half the 108 jump, so each tier is only reachable
// from the one below; floor -> gallery only by the stair); the island holds a
// gazebo and the reward pot; vines off the cornice between the windows.
// Keep-frame studs through put(x0, y0, x1, y1, z0, z1, brick) (brick.wedge =
// { D: [dx, dy], down } makes a micro wedge high toward D, see orientWedge);
// z in units, 0 = the paving top.
import { ORIENT } from './orient.mjs';
const MB = 'PB_DefaultMicroBrick', TILE_B = 'PB_DefaultTile', SMOOTH = 'PB_DefaultSmoothTile', WEDGE = 'PB_DefaultMicroWedge';
export const HALL_UP = 288;            // the hall's walls over the keep's 156 (24 courses)
const FL = 4, GD = 5, GH = 132, STEP = 60, SW = 5; // floor tiles, gallery depth / walking height over FL, pillar rise, stair band
const K = 5;                           // cove steps
const WIN = { n0: 8, arch: 16, w: 4, pitch: 10 }; // window courses n0..arch-1 open, arch course = wedges
const GLASS = { asset: MB, color: [196, 222, 236], material: 'BMC_Glass' };
const DAMAGE = { type: 'Component_Damage', data: { Damage: 20, RepeatDelay: 0.5, Message: '', ConsoleTag: '' } }; // never a message
const LIGHT = (c, r = 420) => ({ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: 4, Radius: r, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });

// micro wedge orientation: high (full) side toward world D; down = hanging from the top
// (solid at the top, the slope underneath). Same search as orient.mjs orientFor.
export function orientWedge([dx, dy], down, ext) {
  const want = [[0, 0, down ? -1 : 1], [-dx, -dy, 0]].map(String).sort().join('|');
  for (let c = 0; c < 24; c++) {
    const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => ORIENT[c](v).map(q => q + 0));
    if ([ax[0], ax[1]].map(String).sort().join('|') !== want) continue;
    return { direction: c >> 2, rotation: c & 3, size: ax.map(v => ext[v.findIndex(q => q !== 0)]) };
  }
  throw new Error('no wedge orientation');
}

// one course of a straight run, along x (axis 0) or y (axis 1) from a0 to a1, c0..c1 across:
// blocks of 2-5 studs, the first one's length set by the course so the joints stagger
function bond(put, rng, axis, a0, a1, c0, c1, z0, z1, col, n, extra = {}) {
  let a = a0, L = 1 + ((n * 3) % 4);
  while (a < a1) {
    if (a1 - a - L < 2) L = a1 - a;
    const b = Math.min(a1, a + L);
    if (axis === 0) put(a, c0, b, c1, z0, z1, { color: col(), ...extra }); else put(c0, a, c1, b, z0, z1, { color: col(), ...extra });
    a = b; L = 2 + Math.floor(rng() * 4);
  }
}
// rect minus rect -> up to 4 rects
const minus = ([a0, b0, a1, b1], [h0, i0, h1, i1]) => {
  if (h1 <= a0 || h0 >= a1 || i1 <= b0 || i0 >= b1) return [[a0, b0, a1, b1]];
  return [[a0, b0, a1, Math.max(b0, i0)], [a0, Math.min(b1, i1), a1, b1], [a0, Math.max(b0, i0), Math.max(a0, h0), Math.min(b1, i1)], [Math.min(a1, h1), Math.max(b0, i0), a1, Math.min(b1, i1)]]
    .filter(([p, q, r, s]) => r > p && s > q);
};
// window spans along a wall run [p, q): w wide, pitch apart, centred, 3 studs clear of the corners
const windowsOn = (p, q) => {
  const m = Math.floor((q - p - 6 - WIN.w) / WIN.pitch) + 1;
  if (m < 1) return [];
  const s = p + Math.floor((q - p - ((m - 1) * WIN.pitch + WIN.w)) / 2);
  return Array.from({ length: m }, (_, i) => [s + i * WIN.pitch, s + i * WIN.pitch + WIN.w]);
};

// HI interior, HR wall ring (keep-frame studs); top = keep wall top (156); gate [x, y] keep frame
export function hallShell({ put, HI, HR, top, roofTop, T, rng, shade, roofCells, foot, gate }) {
  const NUP = HALL_UP / 12, kz = n => top + n * 12;
  const field = () => { const k = Math.floor(rng() * 5); return shade(T.field[k % T.field.length], k); };
  const wx = windowsOn(HR[0] + 1, HR[2] - 1), wy = windowsOn(HR[1] + 1, HR[3] - 1);
  // walls: S/N runs along x, W/E along y; corners alternate per course
  const sides = [
    { axis: 0, c: [HR[1], HR[1] + 1], ws: wx }, { axis: 0, c: [HR[3] - 1, HR[3]], ws: wx },
    { axis: 1, c: [HR[0], HR[0] + 1], ws: wy }, { axis: 1, c: [HR[2] - 1, HR[2]], ws: wy },
  ];
  for (let n = 0; n < NUP; n++) {
    const last = n === NUP - 1;
    for (const S of sides) {
      const own = (S.axis === 0) === (n % 2 === 0);
      const [a0, a1] = S.axis === 0 ? (own ? [HR[0], HR[2]] : [HR[0] + 1, HR[2] - 1]) : (own ? [HR[1], HR[3]] : [HR[1] + 1, HR[3] - 1]);
      const open = n >= WIN.n0 && n <= WIN.arch;
      let at = a0;
      const extra = n === WIN.arch + 1 ? { asset: MB } : {}; // the course over the arches: no studs under the apex
      const run = (p, q) => { if (q > p) bond(put, rng, S.axis, p, q, S.c[0], S.c[1], kz(n), kz(n + 1), last ? () => T.trim : field, n, extra); };
      if (open) for (const [w0, w1] of S.ws) { run(at, w0); at = w1; }
      run(at, a1);
      if (n !== WIN.arch) continue;
      // the pointed arch: two hanging wedges, high toward their jambs
      const along = S.axis === 0 ? [1, 0] : [0, 1];
      for (const [w0, w1] of S.ws) {
        const h = (w1 - w0) / 2;
        for (const [p, q, d] of [[w0, w0 + h, -1], [w0 + h, w1, 1]]) {
          const D = [along[0] * d, along[1] * d];
          if (S.axis === 0) put(p, S.c[0], q, S.c[1], kz(n), kz(n + 1), { asset: WEDGE, color: T.trim, wedge: { D, down: true } });
          else put(S.c[0], p, S.c[1], q, kz(n), kz(n + 1), { asset: WEDGE, color: T.trim, wedge: { D, down: true } });
        }
      }
    }
  }
  // glass in every window (the openings stay shut: nobody squeezes through)
  for (const S of sides) for (const [w0, w1] of S.ws) {
    const g = [S.c[0] + 0.3, S.c[0] + 0.7], z0 = kz(WIN.n0), z1 = kz(WIN.arch);
    if (S.axis === 0) put(w0, g[0], w1, g[1], z0, z1, GLASS); else put(g[0], w0, g[1], w1, z0, z1, GLASS);
  }
  // buttresses midway between the windows, a weathered (wedge) top; on the keep's roof they
  // stand on it, on an outside wall they go down to the paving (not by the gate)
  const BUT = shade(T.field[0], 3);
  const buttress = (x0, y0, x1, y1, out) => {
    const cells = []; for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) cells.push(x + ',' + y);
    let z0;
    if (cells.every(c => roofCells.has(c))) z0 = top + 4;
    else if (!cells.some(c => foot.has(c)) && Math.hypot((x0 + x1) / 2 - gate[0], (y0 + y1) / 2 - gate[1]) >= 12) z0 = 0;
    else return;
    const z1 = kz(NUP - 3);
    for (let z = z0; z < z1; z += 12) put(x0, y0, x1, y1, z, Math.min(z1, z + 12), { color: BUT });
    put(x0, y0, x1, y1, z1, z1 + 12, { asset: WEDGE, color: T.trim, wedge: { D: [-out[0], -out[1]], down: false } });
  };
  const mids = ws => ws.slice(0, -1).map(([, w1], i) => (w1 + ws[i + 1][0]) / 2);
  for (const m of mids(wx)) { buttress(m - 1, HR[1] - 1, m + 1, HR[1], [0, -1]); buttress(m - 1, HR[3], m + 1, HR[3] + 1, [0, 1]); }
  for (const m of mids(wy)) { buttress(HR[0] - 1, m - 1, HR[0], m + 1, [-1, 0]); buttress(HR[2], m - 1, HR[2] + 1, m + 1, [1, 0]); }
  // ceiling: cornice, cove (hanging wedges stepping in), coffers round an oculus, a lantern over it
  const ceilZ = top + HALL_UP - 4, z0c = ceilZ - 12 * K;
  const [ix0, iy0, ix1, iy1] = HI;
  for (const [a, b, c, d] of [[ix0, iy0, ix1, iy0 + 1], [ix0, iy1 - 1, ix1, iy1], [ix0, iy0 + 1, ix0 + 1, iy1 - 1], [ix1 - 1, iy0 + 1, ix1, iy1 - 1]])
    put(a, b, c, d, z0c - 8, z0c, { asset: MB, color: T.frieze[0] });
  for (let k = 0; k < K; k++) {
    const z = z0c + 12 * k, o = k + 1; // wedge ring at offset o, solid fill behind it
    for (const [a, b, c, d] of [[ix0, iy0, ix1, iy0 + o], [ix0, iy1 - o, ix1, iy1], [ix0, iy0 + o, ix0 + o, iy1 - o], [ix1 - o, iy0 + o, ix1, iy1 - o]])
      put(a, b, c, d, z, z + 12, { asset: MB, color: T.mould });
    const w = { asset: WEDGE, color: T.mould };
    put(ix0 + o + 1, iy0 + o, ix1 - o - 1, iy0 + o + 1, z, z + 12, { ...w, wedge: { D: [0, -1], down: true } });
    put(ix0 + o + 1, iy1 - o - 1, ix1 - o - 1, iy1 - o, z, z + 12, { ...w, wedge: { D: [0, 1], down: true } });
    put(ix0 + o, iy0 + o + 1, ix0 + o + 1, iy1 - o - 1, z, z + 12, { ...w, wedge: { D: [-1, 0], down: true } });
    put(ix1 - o - 1, iy0 + o + 1, ix1 - o, iy1 - o - 1, z, z + 12, { ...w, wedge: { D: [1, 0], down: true } });
    for (const [x, y] of [[ix0 + o, iy0 + o], [ix1 - o - 1, iy0 + o], [ix0 + o, iy1 - o - 1], [ix1 - o - 1, iy1 - o - 1]]) put(x, y, x + 1, y + 1, z, z + 12, { asset: MB, color: T.mould });
  }
  const C = [ix0 + K + 1, iy0 + K + 1, ix1 - K - 1, iy1 - K - 1]; // the flat part
  const ocx = Math.floor((ix0 + ix1) / 2), ocy = Math.floor((iy0 + iy1) / 2), O = [ocx - 3, ocy - 3, ocx + 3, ocy + 3];
  for (const r of minus(HI, O)) put(...r, ceilZ, ceilZ + 4, { asset: MB, color: T.frieze[1] });
  for (const r of minus(HR, O)) put(...r, top + HALL_UP, top + HALL_UP + 4, { asset: TILE_B, color: T.dado });
  // beams every 6 studs both ways (x beams whole, y beams between them), a frame round the oculus
  const BEAM = { asset: MB, color: T.trim };
  const rim = [O[0] - 1, O[1] - 1, O[2] + 1, O[3] + 1];
  const ys = [], xs = [];
  for (let y = C[1]; y < C[3]; y += 6) ys.push(y);
  for (let x = C[0]; x < C[2]; x += 6) xs.push(x);
  for (const y of ys) for (const r of minus([C[0], y, C[2], y + 1], rim)) put(...r, ceilZ - 8, ceilZ, BEAM);
  for (const x of xs) for (let i = 0; i < ys.length; i++) {
    const y0 = ys[i] + 1, y1 = i + 1 < ys.length ? ys[i + 1] : C[3];
    if (y1 > y0) for (const r of minus([x, y0, x + 1, y1], rim)) put(...r, ceilZ - 8, ceilZ, BEAM);
  }
  for (const r of minus(rim, O)) put(...r, ceilZ - 12, ceilZ, { asset: MB, color: T.frieze[0] });
  // lantern: corner posts, glass sides, stepped cap, a lamp inside
  const L0 = top + HALL_UP + 4, LR = rim;
  for (const [x, y] of [[LR[0], LR[1]], [LR[2] - 1, LR[1]], [LR[0], LR[3] - 1], [LR[2] - 1, LR[3] - 1]]) put(x, y, x + 1, y + 1, L0, L0 + 48, { asset: MB, color: T.trim });
  put(LR[0] + 1, LR[1], LR[2] - 1, LR[1] + 1, L0, L0 + 48, GLASS); put(LR[0] + 1, LR[3] - 1, LR[2] - 1, LR[3], L0, L0 + 48, GLASS);
  put(LR[0], LR[1] + 1, LR[0] + 1, LR[3] - 1, L0, L0 + 48, GLASS); put(LR[2] - 1, LR[1] + 1, LR[2], LR[3] - 1, L0, L0 + 48, GLASS);
  put(LR[0] - 1, LR[1] - 1, LR[2] + 1, LR[3] + 1, L0 + 48, L0 + 54, { asset: MB, color: T.trim });
  put(LR[0], LR[1], LR[2], LR[3], L0 + 54, L0 + 60, { asset: MB, color: T.dado });
  put(LR[0] + 2, LR[1] + 2, LR[2] - 2, LR[3] - 2, L0 + 60, L0 + 66, { asset: MB, color: T.trim });
  put(ocx - 0.6, ocy - 0.6, ocx + 0.6, ocy + 0.6, L0 + 40, L0 + 48, { asset: MB, color: T.glow, material: 'BMC_Glow', material_intensity: 8, components: [LIGHT([255, 236, 200], 900)] });
  // merlons round the hall's roof (clear of the lantern)
  for (let x = HR[0]; x < HR[2]; x++) for (let y = HR[1]; y < HR[3]; y++)
    if ((x === HR[0] || y === HR[1] || x === HR[2] - 1 || y === HR[3] - 1) && !(((x >> 1) + (y >> 1)) % 2))
      put(x, y, x + 1, y + 1, roofTop + HALL_UP, roofTop + HALL_UP + 12, { color: T.mould });
  return { windows: { x: wx, y: wy }, corniceZ: z0c - 8 };
}

// I = hall interior [x0, y0, x1, y1] (keep-frame studs); doors = [{ side: 'S'|'N'|'W'|'E', a0, a1 }]
// (a = stud along that wall, keep frame); shell = hallShell()'s result
export function greatHall({ put, I, doors, T, rng, shade, shell }) {
  const [ix0, iy0, ix1, iy1] = I;
  const pots = [];
  const frames = {
    S: { W: ix1 - ix0, D: iy1 - iy0, m: (u, v) => [ix0 + u, iy0 + v] },
    N: { W: ix1 - ix0, D: iy1 - iy0, m: (u, v) => [ix0 + u, iy1 - v] },
    W: { W: iy1 - iy0, D: ix1 - ix0, m: (u, v) => [ix0 + v, iy0 + u] },
    E: { W: iy1 - iy0, D: ix1 - ix0, m: (u, v) => [ix1 - v, iy0 + u] },
  };
  const along = s => (s === 'S' || s === 'N' ? ix0 : iy0);
  const left = { S: 'W', N: 'W', W: 'S', E: 'S' }, right = { S: 'E', N: 'E', W: 'N', E: 'N' };
  const vOn = (s, a0, a1) => ({ S: a0 - iy0, N: iy1 - a1, W: a0 - ix0, E: ix1 - a1 }[s]);
  let plan = null;
  const order = ['S', 'N', 'W', 'E'].map(s => [doors.filter(d => d.side === s).length, rng(), s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, , s] of order) {
    const f = frames[s];
    const notch = doors.filter(d => d.side === s).map(d => [d.a0 - along(s) - 1, d.a1 - along(s) + 1]);
    let g0 = 0, g1 = f.W; // the stair keeps clear of side-wall doors near the gallery
    for (const d of doors) {
      if (d.side !== left[s] && d.side !== right[s]) continue;
      if (vOn(s, d.a0, d.a1) > GD + SW + 3) continue;
      if (d.side === left[s]) g0 = Math.max(g0, 4); else g1 = Math.min(g1, f.W - 4);
    }
    const clear = (a, b) => notch.every(([n0, n1]) => b <= n0 || a >= n1);
    const opts = [];
    for (let st = g0 + 3; st + 22 <= g1 - 3; st++)
      for (const dir of [1, -1]) if (clear(st - 3, st + 25)) opts.push([st, dir]);
    if (!opts.length) continue;
    const [st, dir] = opts[Math.floor(rng() * opts.length)];
    plan = { s, f, st, dir };
    break;
  }
  if (!plan) return { pots, ok: false };
  const { f, st, dir } = plan;
  const du = (() => { const [a, b] = f.m(0, 0), [c, d] = f.m(1, 0); return [c - a, d - b]; })();
  const box = (u0, v0, u1, v1, z0, z1, b) => {
    const [ax, ay] = f.m(u0, v0), [bx, by] = f.m(u1, v1);
    put(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, b);
  };
  const fieldR = () => { const k = Math.floor(rng() * 5); return shade(T.field[k % T.field.length], k); };
  // u-run of bonded blocks in the hall frame (v0..v1 across)
  const ubond = (u0, u1, v0, v1, z0, z1, n) => {
    let a = u0, L = 1 + ((n * 3) % 4);
    while (a < u1) { if (u1 - a - L < 2) L = u1 - a; const b = Math.min(u1, a + L); box(a, v0, b, v1, z0, z1, { color: fieldR() }); a = b; L = 2 + Math.floor(rng() * 4); }
  };
  const ubondC = (u0, u1, v0, v1, z0, z1, n, col) => { // ubond in one colour family
    let a = u0, L = 1 + ((n * 3) % 4);
    while (a < u1) { if (u1 - a - L < 2) L = u1 - a; const b = Math.min(u1, a + L); box(a, v0, b, v1, z0, z1, { color: col() }); a = b; L = 2 + Math.floor(rng() * 4); }
  };
  const MARBLE = [[70, 130, 92], [62, 118, 84], [78, 140, 100]], GOLD = [196, 170, 92];
  const wd = (du_, dv_) => { const [a, b] = f.m(0, 0), [c, d] = f.m(du_, dv_); return [Math.sign(c - a), Math.sign(d - b)]; }; // hall-frame dir -> world
  // an octagonal 3 x 3 shaft: a cross of micro bricks, the corners vertical side wedges (solid toward the axis), in drums
  const octShaft = (u0, v0, z0, z1, drum = 24) => {
    for (let z = z0, n = 0; z < z1; z += drum, n++) {
      const zt = Math.min(z1, z + drum), c = MARBLE[n % 3];
      box(u0 + 1, v0, u0 + 2, v0 + 3, z, zt, { asset: MB, color: c });
      box(u0, v0 + 1, u0 + 1, v0 + 2, z, zt, { asset: MB, color: c });
      box(u0 + 2, v0 + 1, u0 + 3, v0 + 2, z, zt, { asset: MB, color: c });
      for (const [cu, cv, du_, dv_] of [[0, 0, 1, 1], [2, 0, -1, 1], [0, 2, 1, -1], [2, 2, -1, -1]])
        box(u0 + cu, v0 + cv, u0 + cu + 1, v0 + cv + 1, z, zt, { asset: WEDGE, color: c, side: wd(du_, dv_) });
    }
  };
  // a platform pillar, 5 x 5 footprint: plinth, gold base, marble shaft, necking, corbelled flare, abacus, smooth top
  const pillar = (u0, v0, h) => {
    box(u0, v0, u0 + 5, v0 + 5, 0, 12, { color: T.trim });
    box(u0 + 0.5, v0 + 0.5, u0 + 4.5, v0 + 4.5, 12, 16, { asset: MB, color: GOLD });
    octShaft(u0 + 1, v0 + 1, 16, h - 24);
    box(u0 + 1, v0 + 1, u0 + 4, v0 + 4, h - 24, h - 22, { asset: MB, color: GOLD });
    box(u0 + 1, v0 + 1, u0 + 4, v0 + 4, h - 22, h - 10, { asset: MB, color: T.trim });
    for (const [a, b, c, d, D] of [[0, 1, 1, 4, [1, 0]], [4, 1, 5, 4, [-1, 0]], [1, 0, 4, 1, [0, 1]], [1, 4, 4, 5, [0, -1]]])
      box(u0 + a, v0 + b, u0 + c, v0 + d, h - 22, h - 10, { asset: WEDGE, color: T.trim, wedge: { D: wd(...D), down: true } });
    box(u0, v0, u0 + 5, v0 + 5, h - 10, h - 4, { asset: MB, color: T.trim });
    box(u0, v0, u0 + 5, v0 + 5, h - 4, h, { asset: SMOOTH, color: T.mould });
  };
  // ---- the pit's footprint first: the floor leaves it out
  const pu0 = 4, pu1 = f.W - 4, pv0 = GD + SW + 3, pv1 = f.D - 4;
  const P = [pu0 + 1, pv0 + 1, pu1 - 1, pv1 - 1];
  const CARPET = [128, 34, 30];
  // ---- floor: smooth tiles, 4-stud squares in two tones, red carpet round the pit
  const outer = [pu0 - 2, pv0 - 2, pu1 + 2, pv1 + 2];
  const tone = (u, v) => (((u >> 2) + (v >> 2)) % 2 ? (T.floor?.a ?? T.trim) : (T.floor?.b ?? T.mould));
  for (let u = 0; u < f.W; u += 4) for (let v = 0; v < f.D; v += 4)
    for (const r of minus([u, v, Math.min(f.W, u + 4), Math.min(f.D, v + 4)], outer)) box(...r, 0, FL, { asset: SMOOTH, color: tone(u, v) });
  for (const r of minus(outer, [pu0, pv0, pu1, pv1])) box(...r, 0, FL, { asset: SMOOTH, color: CARPET });
  // ---- gallery: a smooth-tile slab on an arcade of octagonal piers (pointed arches between them)
  const SLAB = FL + GH - 16;
  box(0, 0, f.W, GD, SLAB, FL + GH - 4, { asset: MB, color: T.trim });
  box(0, 0, f.W, GD, FL + GH - 4, FL + GH, { asset: SMOOTH, color: T.mould });
  const NPI = Math.floor((f.W + 4) / 7), m0 = Math.floor((f.W - (7 * NPI - 4)) / 2);
  for (let i = 0; i < NPI; i++) {
    const u = m0 + 7 * i;
    box(u, GD - 3, u + 3, GD, FL, FL + 8, { asset: MB, color: T.trim });
    octShaft(u, GD - 3, FL + 8, SLAB - 14);
    box(u, GD - 3, u + 3, GD, SLAB - 14, SLAB - 12, { asset: MB, color: GOLD });
    box(u, GD - 3, u + 3, GD, SLAB - 12, SLAB, { asset: MB, color: T.trim });
    if (i + 1 < NPI) for (const [a, d] of [[u + 3, -1], [u + 5, 1]])
      box(a, GD - 3, a + 2, GD, SLAB - 12, SLAB, { asset: WEDGE, color: T.trim, wedge: { D: wd(d, 0), down: true } });
  }
  // ---- the stair: treads between two stringers (pale stone, so the wedge copes read as one slope), smooth treads
  const seg = j => (dir > 0 ? [st + 2 * (j - 1), st + 2 * j] : [st + 22 - 2 * j, st + 22 - 2 * (j - 1)]);
  const segs = (ja, jb) => { const a = Math.min(seg(ja)[0], seg(jb)[0]), b = Math.max(seg(ja)[1], seg(jb)[1]); return [a, b]; };
  const cz = c => (c === 0 ? [FL, FL + 8] : [FL + 12 * c - 4, FL + 12 * c + 8]);
  const NT = GH / 12; // 11 treads
  const cheek = () => shade(T.trim, Math.floor(rng() * 5));
  for (let c = 0; c < NT; c++) { // tread fill: course c under every tread j > c; the top two treads reach back to the gallery
    const [z0, z1] = cz(c), [a, b] = segs(c + 1, NT);
    ubond(a, b, GD + 1, GD + SW - 1, z0, z1, c);
    const [p, q] = segs(Math.max(c + 1, NT - 1), NT);
    ubond(p, q, GD, GD + 1, z0, z1, c + 1);
  }
  for (let j = 1; j <= NT; j++) { const [a, b] = seg(j); box(a, j >= NT - 1 ? GD : GD + 1, b, GD + SW - 1, FL + 12 * j - 4, FL + 12 * j, { asset: SMOOTH, color: T.dado }); }
  for (const [v0, last] of [[GD + SW - 1, NT], [GD, NT - 2]]) { // front stringer whole, the back one stops short of the gallery
    for (let c = 0; c <= last; c++) { const [z0, z1] = cz(c), [a, b] = segs(Math.max(1, c), last); ubondC(a, b, v0, v0 + 1, z0, z1, c + 5, cheek); }
    for (let j = 1; j <= last; j++) { const [a, b] = seg(j); box(a, v0, b, v0 + 1, FL + 12 * j + 8, FL + 12 * j + 20, { asset: WEDGE, color: T.trim, wedge: { D: [du[0] * dir, du[1] * dir], down: false } }); }
  }
  // ---- island, pillars
  const IS = Math.min(P[2] - P[0], P[3] - P[1]) >= 19 ? 7 : 5;
  const iu0 = Math.floor((P[0] + P[2] - IS) / 2), iv0 = Math.floor((P[1] + P[3] - IS) / 2) + 1;
  const ISL = [iu0, iv0, iu0 + IS, iv0 + IS];
  const GTOP = FL + GH, ISTOP = GTOP + 3 * STEP;
  const off = Math.max(2, Math.min(6, ISL[0] - P[0] - 6, ISL[1] - P[1] - 6, P[2] - ISL[2] - 6, P[3] - ISL[3] - 6));
  const M = [ISL[0] - off - 5, ISL[1] - off - 5, ISL[2] + off, ISL[3] + off];
  const Lw = M[2] - M[0], Lh = M[3] - M[1], Lp = 2 * (Lw + Lh);
  const at = t => { t = ((t % Lp) + Lp) % Lp; if (t < Lw) return [M[0] + t, M[1]]; t -= Lw; if (t < Lh) return [M[2], M[1] + t]; t -= Lh; if (t < Lw) return [M[2] - t, M[3]]; return [M[0], M[3] - (t - Lw)]; };
  const jumpU = Math.max(3, Math.min(f.W - 4, dir > 0 ? st - 5 : st + 27)); // gallery edge past the stair's foot
  const away = dir > 0 ? -1 : 1;
  const t0 = Math.max(0, Math.min(Lw, jumpU - 2 - M[0]));
  const span = Math.round(0.72 * Lp), NP = Math.max(5, Math.round(span / 8) + 1), stepT = span / (NP - 1);
  const pillars = [];
  for (let n = 0, t = t0; n < NP; n++, t += away * stepT) {
    let [u, v] = at(t).map(Math.round);
    for (let k = 0; k < 6 && pillars.length && Math.abs(u - pillars.at(-1).u) < 6 && Math.abs(v - pillars.at(-1).v) < 6; k++) { t += away; [u, v] = at(t).map(Math.round); }
    pillars.push({ u, v, h: GTOP + (n < NP / 2 ? 1 : 2) * STEP });
  }
  const onPillar = (u, v) => pillars.some(p => u >= p.u && u < p.u + 5 && v >= p.v && v < p.v + 5);
  const ISF = [ISL[0] - 1, ISL[1] - 1, ISL[2] + 1, ISL[3] + 1]; // the island's flare
  const onIsland = (u, v) => u >= ISL[0] && u < ISL[2] && v >= ISL[1] && v < ISL[3];
  // parapet (bonded, smooth cope), spikes
  for (const [a, b, c, d, ax] of [[pu0, pv0, pu1, pv0 + 1, 0], [pu0, pv1 - 1, pu1, pv1, 0], [pu0, pv0 + 1, pu0 + 1, pv1 - 1, 1], [pu1 - 1, pv0 + 1, pu1, pv1 - 1, 1]]) {
    if (!ax) ubond(a, c, b, d, 0, 12, 1);
    else for (let v = b; v < d;) { const L = d - v - 5 < 2 ? d - v : Math.min(d - v, 2 + Math.floor(rng() * 4)); box(a, v, c, v + L, 0, 12, { color: fieldR() }); v += L; }
    box(a, b, c, d, 12, 16, { asset: SMOOTH, color: T.trim });
  }
  for (let u = P[0]; u < P[2]; u++) for (let v = P[1]; v < P[3]; v++)
    if (!onPillar(u, v) && !onIsland(u, v)) box(u, v, u + 1, v + 1, 0, 10, { asset: 'PB_Spike', color: [120, 116, 110], components: [DAMAGE] });
  for (const p of pillars) pillar(p.u, p.v, p.h);
  // the island: bonded ring round a core, a gold band, a corbelled flare, smooth top, gazebo, the pot
  for (let z = 0, n = 0; z < ISTOP - 28; z += 12, n++) {
    const zt = Math.min(ISTOP - 28, z + 12);
    ubond(ISL[0], ISL[2], ISL[1], ISL[1] + 1, z, zt, n); ubond(ISL[0], ISL[2], ISL[3] - 1, ISL[3], z, zt, n + 2);
    for (const u of [ISL[0], ISL[2] - 1]) box(u, ISL[1] + 1, u + 1, ISL[3] - 1, z, zt, { color: fieldR() });
    box(ISL[0] + 1, ISL[1] + 1, ISL[2] - 1, ISL[3] - 1, z, zt, { color: T.field[0] });
  }
  box(ISL[0], ISL[1], ISL[2], ISL[3], ISTOP - 28, ISTOP - 24, { asset: MB, color: GOLD });
  box(ISL[0], ISL[1], ISL[2], ISL[3], ISTOP - 24, ISTOP - 10, { asset: MB, color: T.trim });
  for (const [a, b, c, d, D] of [[ISF[0], ISL[1], ISL[0], ISL[3], [1, 0]], [ISL[2], ISL[1], ISF[2], ISL[3], [-1, 0]], [ISL[0], ISF[1], ISL[2], ISL[1], [0, 1]], [ISL[0], ISL[3], ISL[2], ISF[3], [0, -1]]])
    box(a, b, c, d, ISTOP - 22, ISTOP - 10, { asset: WEDGE, color: T.trim, wedge: { D: wd(...D), down: true } });
  box(...ISF, ISTOP - 10, ISTOP - 4, { asset: MB, color: T.trim });
  box(...ISF, ISTOP - 4, ISTOP, { asset: SMOOTH, color: T.mould });
  for (const [u, v] of [[ISL[0], ISL[1]], [ISL[2] - 1, ISL[1]], [ISL[0], ISL[3] - 1], [ISL[2] - 1, ISL[3] - 1]]) {
    box(u, v, u + 1, v + 1, ISTOP, ISTOP + 6, { asset: MB, color: GOLD });
    box(u + 0.2, v + 0.2, u + 0.8, v + 0.8, ISTOP + 6, ISTOP + 78, { asset: MB, color: MARBLE[0] });
    box(u, v, u + 1, v + 1, ISTOP + 78, ISTOP + 84, { asset: MB, color: GOLD });
  }
  box(ISL[0] - 0.6, ISL[1] - 0.6, ISL[2] + 0.6, ISL[3] + 0.6, ISTOP + 84, ISTOP + 90, { asset: MB, color: [48, 96, 66] });
  box(ISL[0] + 0.4, ISL[1] + 0.4, ISL[2] - 0.4, ISL[3] - 0.4, ISTOP + 90, ISTOP + 96, { asset: MB, color: GOLD });
  box(ISL[0] + 1.4, ISL[1] + 1.4, ISL[2] - 1.4, ISL[3] - 1.4, ISTOP + 96, ISTOP + 102, { asset: MB, color: [48, 96, 66] });
  {
    const cu = ISL[0] + IS / 2, cv = ISL[1] + IS / 2;
    box(cu - 0.4, cv - 0.4, cu + 0.4, cv + 0.4, ISTOP + 102, ISTOP + 116, { asset: MB, color: GOLD });
    box(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, ISTOP + 80, ISTOP + 84, { asset: MB, color: GOLD });
    box(cu - 0.4, cv - 0.4, cu + 0.4, cv + 0.4, ISTOP + 70, ISTOP + 80, { asset: MB, color: [255, 220, 150], material: 'BMC_Glow', material_intensity: 6, components: [LIGHT([255, 210, 150], 360)] });
  }
  { const [x, y] = f.m(ISL[0] + IS / 2, ISL[1] + IS / 2); pots.push([x, y, ISTOP]); }
  // torches on the parapet corners
  const TORCH = [[255, 150, 50], [200, 90, 255], [90, 255, 120], [90, 170, 255]];
  [[pu0, pv0], [pu1 - 1, pv0], [pu0, pv1 - 1], [pu1 - 1, pv1 - 1]].forEach(([u, v], n) => {
    box(u + 0.2, v + 0.2, u + 0.8, v + 0.8, 16, 48, { asset: MB, color: MARBLE[0] });
    box(u, v, u + 1, v + 1, 48, 54, { asset: MB, color: GOLD });
    box(u + 0.3, v + 0.3, u + 0.7, v + 0.7, 54, 66, { asset: MB, color: TORCH[n], material: 'BMC_Glow', material_intensity: 10, components: [LIGHT(TORCH[n])] });
  });
  // balustrade on the gallery edge: turned stone balusters a stud apart, newels, a stone rail; open at the stair head and the jump
  const head = segs(NT - 1, NT);
  const gaps = [[head[0] - 1, head[1] + 1], [jumpU - 2, jumpU + 3]].sort((a, b) => a[0] - b[0]);
  const BAL = [[0.6, 0, 4], [0.4, 4, 8], [0.6, 8, 18], [0.4, 18, 22], [0.6, 22, 24]]; // width, z0, z1 over the slab
  let p = 0;
  for (const [g0, g1] of [...gaps, [f.W, f.W]]) {
    const q = Math.max(p, g0);
    if (q - p >= 3) {
      for (const u of [p, q - 1]) { box(u, GD - 1, u + 1, GD, GTOP, GTOP + 28, { asset: MB, color: T.trim }); box(u + 0.2, GD - 0.8, u + 0.8, GD - 0.2, GTOP + 28, GTOP + 34, { asset: MB, color: GOLD }); }
      box(p + 1, GD - 1, q - 1, GD, GTOP + 24, GTOP + 28, { asset: MB, color: T.trim });
      for (let u = p + 1; u < q - 1; u++) for (const [w, z0, z1] of BAL) box(u + 0.5 - w / 2, GD - 0.5 - w / 2, u + 0.5 + w / 2, GD - 0.5 + w / 2, GTOP + z0, GTOP + z1, { asset: MB, color: T.mould });
    }
    p = Math.max(p, g1);
  }
  // pilasters inside, between the windows (in line with the buttresses): pale stone in courses, a gold
  // base and capital under the cornice; on the gallery wall they start on the gallery, the side walls
  // skip the gallery's end, none in front of a doorway
  {
    const opp = { S: 'N', N: 'S', W: 'E', E: 'W' }[plan.s], cz1 = shell.corniceZ;
    const walls = [['S', 0, iy0, shell.windows.x], ['N', 0, iy1 - 1, shell.windows.x], ['W', 1, ix0, shell.windows.y], ['E', 1, ix1 - 1, shell.windows.y]];
    const vOf = (a0, a1) => ({ S: a0 - iy0, N: iy1 - a1, W: a0 - ix0, E: ix1 - a1 }[plan.s]);
    for (const [w, axis, c, ws] of walls) for (const m of ws.slice(0, -1).map(([, w1], i) => (w1 + ws[i + 1][0]) / 2)) {
      if (doors.some(d => d.side === w && Math.abs((d.a0 + d.a1) / 2 - m) < 4)) continue;
      let z0 = FL;
      if (w === plan.s) z0 = GTOP; else if (w !== opp && vOf(m - 2, m + 2) < GD + 1) continue;
      const P2 = (a0, a1, z, zt, b) => (axis === 0 ? put(a0, c, a1, c + 1, z, zt, b) : put(c, a0, c + 1, a1, z, zt, b));
      P2(m - 1.4, m + 1.4, z0, z0 + 6, { asset: MB, color: GOLD });
      for (let z = z0 + 6, n = 0; z < cz1 - 10; z += 12, n++) P2(m - 1, m + 1, z, Math.min(cz1 - 10, z + 12), { color: shade(T.trim, n % 5) });
      P2(m - 1, m + 1, cz1 - 10, cz1 - 8, { asset: MB, color: GOLD });
      P2(m - 1.4, m + 1.4, cz1 - 8, cz1, { asset: MB, color: T.trim });
    }
  }
  // vines off the cornice, between the windows
  const VINE = [[46, 92, 52], [60, 112, 58], [38, 78, 46]];
  const W = ix1 - ix0, D = iy1 - iy0, cz0 = shell.corniceZ;
  const inWin = (wall, a) => { const base = wall < 2 ? ix0 : iy0; const ws = wall < 2 ? shell.windows.x : shell.windows.y; return ws.some(([w0, w1]) => base + a >= w0 - 1 && base + a < w1 + 1) || ws.slice(0, -1).some(([, w1], i) => Math.abs(base + a - (w1 + ws[i + 1][0]) / 2) < 3); };
  const used = new Set();
  for (let n = 0; n < 18; n++) {
    const wall = n % 4, a = 2 + Math.floor(rng() * ((wall < 2 ? W : D) - 4)), len = 40 + Math.floor(rng() * 6) * 20;
    if (inWin(wall, a) || [-1, 0, 1].some(d => used.has(wall + ',' + (a + d)))) continue;
    used.add(wall + ',' + a);
    const [x0, y0] = wall === 0 ? [ix0 + a, iy0] : wall === 1 ? [ix0 + a, iy1 - 0.4] : wall === 2 ? [ix0, iy0 + a] : [ix1 - 0.4, iy0 + a];
    put(x0, y0, x0 + 0.4, y0 + 0.4, cz0 - len, cz0, { asset: MB, color: VINE[n % 3] });
    for (let z = cz0 - len + 8; z < cz0 - 8; z += 16) {
      const s = (z / 16) % 2 ? 1 : -1;
      const [lx, ly] = wall < 2 ? [x0 + (s > 0 ? 0.4 : -0.6), y0] : [x0, y0 + (s > 0 ? 0.4 : -0.6)];
      const [lw, lh] = wall < 2 ? [0.6, 0.4] : [0.4, 0.6];
      put(lx, ly, lx + lw, ly + lh, z, z + 4, { asset: MB, color: VINE[(n + 1) % 3] });
    }
  }
  return { pots, ok: true, side: plan.s, pillars: pillars.length };
}

// the gate's portico: podium, two columns + pilasters, entablature, a pediment edged with wedges
// face = the wall's outer face (keep-frame stud line), a = the gate's stud along the wall, side [dx, dy]
export function portico({ put, face, a: ga, side: [dx, dy], T }) {
  const m = (a, o) => (dx ? [face + dx * o, a] : [a, face + dy * o]);
  const box = (a0, o0, a1, o1, z0, z1, b) => {
    const [ax, ay] = m(ga + a0, o0), [bx, by] = m(ga + a1, o1);
    put(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, b);
  };
  const alongD = dx ? [0, 1] : [1, 0];
  box(-7, 0, 7, 6, 0, 4, { asset: SMOOTH, color: T.trim });
  box(-5, 6, 5, 8, 0, 4, { asset: SMOOTH, color: T.dado });
  for (const a of [-6, 4]) {
    box(a, 3, a + 2, 5, 4, 10, { asset: MB, color: T.trim });
    box(a + 0.2, 3.2, a + 1.8, 4.8, 10, 90, { asset: MB, color: T.mould });
    box(a, 3, a + 2, 5, 90, 96, { asset: MB, color: T.trim });
    box(a, 0, a + 2, 1, 4, 96, { asset: MB, color: T.mould });
  }
  box(-7, 0, 7, 6, 96, 100, { asset: MB, color: T.dado });
  box(-7, 0, 7, 6, 100, 108, { asset: MB, color: T.mould });
  // pediment: courses of 6, each end a wedge rising toward the middle
  for (let k = 0; k < 6; k++) {
    const z = 108 + 6 * k;
    if (7 - k - 1 > -7 + k + 1) box(-7 + k + 1, 0, 7 - k - 1, 6, z, z + 6, { asset: MB, color: k ? T.trim : T.dado });
    box(-7 + k, 0, -7 + k + 1, 6, z, z + 6, { asset: WEDGE, color: T.trim, wedge: { D: alongD, down: false } });
    box(7 - k - 1, 0, 7 - k, 6, z, z + 6, { asset: WEDGE, color: T.trim, wedge: { D: [-alongD[0], -alongD[1]], down: false } });
  }
}
