// Surface keep great hall, door portals (2026-10-25, owner: "make the rooms
// bigger. implement a platforming puzzle", Forest Temple refs). Owner rounds:
// v2 "spikes should NEVER say spikes", stairs not a pyramid of slabs,
// brickwork, unpassable arched windows, smooth tiles, an impressive ceiling;
// v3 crate-stack piers / sawtooth copes / "lackluster"; v4 (dictated): the
// walls must interlock like the keep's own running bond, the room had no
// floor to walk on and nothing worth the climb, the pillars touched (you could
// walk across), the pit was too small to matter, bars not glass in the
// arches, a cathedral roof, the outside door should be sunken (an outline
// round it and another one stud in).
//
// hallShell(): the hall's walls HALL_UP over the keep roof in the SAME running
// bond as wallhouse.mjs (2-stud phase per course, cut every 6 studs on the
// global stud grid, corners alternating), pointed-arch windows (two hanging
// wedges) closed by iron bars, buttresses, cornice, coved + coffered ceiling, a
// gold chandelier, and a steep cathedral roof (slate micro wedges a stud in per
// course, bonded gable walls, ridge, a spire).
// greatHall(): smooth-tile floor with a wide walk all round, a gallery on an
// arcade of octagonal marble piers, its stair between pale stone stringers,
// a big spike pit (Damage 35 / 0.4 s, no message) with parapet, carpet,
// torches; ornate platform pillars at least 5 studs apart, each tier STEP up
// (only reachable from the tier below), the island + gazebo with three pots
// and a treasure chest; balustrade; pilasters; vines.
// portal(): a recessed doorway: orders (outlines) stepping out from the
// opening, each a stud prouder, with a pointed head; the gate gets three.
// Keep-frame studs through put(x0, y0, x1, y1, z0, z1, brick) (brick.wedge =
// { D, down }: a micro wedge high toward world D; brick.side = [dx, dy]: a
// vertical side wedge solid toward that corner); z units, 0 = paving top.
import { ORIENT } from './orient.mjs';
const MB = 'PB_DefaultMicroBrick', SMOOTH = 'PB_DefaultSmoothTile', WEDGE = 'PB_DefaultMicroWedge';
export const HALL_UP = 360;            // the hall's walls over the keep's 156 (30 courses: the chandelier clears the gazebo)
const KEEP_COURSES = 13;               // wallhouse courses under the hall's own
const FL = 4, GD = 5, GH = 132, STEP = 60, SW = 5; // floor tiles, gallery depth / walking height over FL, pillar rise, stair band
const K = 5;                           // cove steps
const WIN = { n0: 8, arch: 19, w: 4, pitch: 10 }; // window courses n0..arch-1 open, arch course = wedges
export const IRON = { asset: MB, color: [44, 44, 48], material: 'BMC_Metallic' };
const SLATE = [[74, 82, 100], [66, 74, 92], [84, 92, 110]];
const MARBLE = [[70, 130, 92], [62, 118, 84], [78, 140, 100]];
export const GOLD = [196, 170, 92];
const DAMAGE = { type: 'Component_Damage', data: { Damage: 35, RepeatDelay: 0.4, Message: '', ConsoleTag: '' } }; // never a message
export const LIGHT = (c, r = 420, b = 4) => ({ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: b, Radius: r, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });

// micro wedge orientation: high (full) side toward world D; down = hanging from the top
export function orientWedge([dx, dy], down, ext) {
  const want = [[0, 0, down ? -1 : 1], [-dx, -dy, 0]].map(String).sort().join('|');
  for (let c = 0; c < 24; c++) {
    const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => ORIENT[c](v).map(q => q + 0));
    if ([ax[0], ax[1]].map(String).sort().join('|') !== want) continue;
    return { direction: c >> 2, rotation: c & 3, size: ax.map(v => ext[v.findIndex(q => q !== 0)]) };
  }
  throw new Error('no wedge orientation');
}

// wallhouse.mjs running bond on the global stud grid: pieces of [a0, a1) for a course
export function runCuts(a0, a1, course) {
  const phase = ((course % 2) + 2) % 2, cuts = [a0, a1];
  for (let n = Math.ceil((a0 - phase) / 2) * 2 + phase; n < a1; n += 2)
    if (n > a0 && ((((((n - phase) / 2) % 3) + 3 + course) % 3) + 3) % 3 === 0) cuts.push(n);
  cuts.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) if (cuts[i + 1] > cuts[i]) out.push([cuts[i], cuts[i + 1]]);
  return out;
}
// a keep-frame box laid as one course of running bond along its longer axis
export function bondPut(put, x0, y0, x1, y1, z0, z1, course, col, extra = {}) {
  if (x1 - x0 >= y1 - y0) for (const [a, b] of runCuts(x0, x1, course)) put(a, y0, b, y1, z0, z1, { color: col(), ...extra });
  else for (const [a, b] of runCuts(y0, y1, course)) put(x0, a, x1, b, z0, z1, { color: col(), ...extra });
}
export const minus = ([a0, b0, a1, b1], [h0, i0, h1, i1]) => {
  if (h1 <= a0 || h0 >= a1 || i1 <= b0 || i0 >= b1) return [[a0, b0, a1, b1]];
  return [[a0, b0, a1, Math.max(b0, i0)], [a0, Math.min(b1, i1), a1, b1], [a0, Math.max(b0, i0), Math.max(a0, h0), Math.min(b1, i1)], [Math.min(a1, h1), Math.max(b0, i0), a1, Math.min(b1, i1)]]
    .filter(([p, q, r, s]) => r > p && s > q);
};
const windowsOn = (p, q) => {
  const m = Math.floor((q - p - 6 - WIN.w) / WIN.pitch) + 1;
  if (m < 1) return [];
  const s = p + Math.floor((q - p - ((m - 1) * WIN.pitch + WIN.w)) / 2);
  return Array.from({ length: m }, (_, i) => [s + i * WIN.pitch, s + i * WIN.pitch + WIN.w]);
};

// HI interior, HR wall ring (keep-frame studs); top = keep wall top (156); gate [x, y] keep frame
export function hallShell({ put, HI, HR, top, T, rng, shade, roofCells, foot, gate }) {
  const NUP = HALL_UP / 12, kz = n => top + n * 12;
  const field = () => { const k = Math.floor(rng() * 5); return shade(T.field[k % T.field.length], k); };
  const wx = windowsOn(HR[0] + 1, HR[2] - 1), wy = windowsOn(HR[1] + 1, HR[3] - 1);
  const sides = [
    { axis: 0, c: [HR[1], HR[1] + 1], ws: wx }, { axis: 0, c: [HR[3] - 1, HR[3]], ws: wx },
    { axis: 1, c: [HR[0], HR[0] + 1], ws: wy }, { axis: 1, c: [HR[2] - 1, HR[2]], ws: wy },
  ];
  for (let n = 0; n < NUP; n++) {
    const course = KEEP_COURSES + n;
    for (const S of sides) {
      const own = (S.axis === 0) === (course % 2 === 0);
      const [a0, a1] = S.axis === 0 ? (own ? [HR[0], HR[2]] : [HR[0] + 1, HR[2] - 1]) : (own ? [HR[1], HR[3]] : [HR[1] + 1, HR[3] - 1]);
      const extra = n === WIN.arch + 1 ? { asset: MB } : {}; // over the arches: no studs under the apex
      const run = (p, q) => { if (q > p) for (const [a, b] of runCuts(p, q, course)) (S.axis === 0 ? put(a, S.c[0], b, S.c[1], kz(n), kz(n + 1), { color: field(), ...extra }) : put(S.c[0], a, S.c[1], b, kz(n), kz(n + 1), { color: field(), ...extra })); };
      let at = a0;
      if (n >= WIN.n0 && n <= WIN.arch) for (const [w0, w1] of S.ws) { run(at, w0); at = w1; }
      run(at, a1);
      if (n !== WIN.arch) continue;
      const along = S.axis === 0 ? [1, 0] : [0, 1];
      for (const [w0, w1] of S.ws) for (const [p, q, d] of [[w0, w0 + 2, -1], [w0 + 2, w1, 1]]) {
        const b = { asset: WEDGE, color: T.trim, wedge: { D: [along[0] * d, along[1] * d], down: true } };
        S.axis === 0 ? put(p, S.c[0], q, S.c[1], kz(n), kz(n + 1), b) : put(S.c[0], p, S.c[1], q, kz(n), kz(n + 1), b);
      }
    }
  }
  // iron bars in every window: uprights a stud apart, two cross bars (gaps of 6 units: nobody squeezes through)
  for (const S of sides) for (const [w0, w1] of S.ws) {
    const g = [S.c[0] + 0.3, S.c[0] + 0.7], z0 = kz(WIN.n0), zTop = kz(WIN.arch);
    const B = (a, b, za, zb) => (S.axis === 0 ? put(a, g[0], b, g[1], za, zb, IRON) : put(g[0], a, g[1], b, za, zb, IRON));
    const zc = [z0 + 32, z0 + 64];
    for (let a = w0 + 1; a < w1; a++) { let z = z0; for (const c of zc) { B(a - 0.2, a + 0.2, z, c); z = c + 4; } B(a - 0.2, a + 0.2, z, zTop); }
    for (const c of zc) {
      const pts = [w0]; for (let a = w0 + 1; a < w1; a++) pts.push(a - 0.2, a + 0.2); pts.push(w1);
      for (let i = 0; i + 1 < pts.length; i += 2) B(pts[i], pts[i + 1], c, c + 4);
      for (let a = w0 + 1; a < w1; a++) B(a - 0.2, a + 0.2, c, c + 4);
    }
  }
  // buttresses midway between the windows, weathered tops
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
  // ceiling: cornice, cove, coffers, a chandelier
  const ceilZ = top + HALL_UP - 4, z0c = ceilZ - 12 * K;
  const [ix0, iy0, ix1, iy1] = HI;
  for (const [a, b, c, d] of [[ix0, iy0, ix1, iy0 + 1], [ix0, iy1 - 1, ix1, iy1], [ix0, iy0 + 1, ix0 + 1, iy1 - 1], [ix1 - 1, iy0 + 1, ix1, iy1 - 1]])
    put(a, b, c, d, z0c - 8, z0c, { asset: MB, color: T.frieze[0] });
  for (let k = 0; k < K; k++) {
    const z = z0c + 12 * k, o = k + 1;
    for (const [a, b, c, d] of [[ix0, iy0, ix1, iy0 + o], [ix0, iy1 - o, ix1, iy1], [ix0, iy0 + o, ix0 + o, iy1 - o], [ix1 - o, iy0 + o, ix1, iy1 - o]])
      put(a, b, c, d, z, z + 12, { asset: MB, color: T.mould });
    const w = { asset: WEDGE, color: T.mould };
    put(ix0 + o + 1, iy0 + o, ix1 - o - 1, iy0 + o + 1, z, z + 12, { ...w, wedge: { D: [0, -1], down: true } });
    put(ix0 + o + 1, iy1 - o - 1, ix1 - o - 1, iy1 - o, z, z + 12, { ...w, wedge: { D: [0, 1], down: true } });
    put(ix0 + o, iy0 + o + 1, ix0 + o + 1, iy1 - o - 1, z, z + 12, { ...w, wedge: { D: [-1, 0], down: true } });
    put(ix1 - o - 1, iy0 + o + 1, ix1 - o, iy1 - o - 1, z, z + 12, { ...w, wedge: { D: [1, 0], down: true } });
    for (const [x, y] of [[ix0 + o, iy0 + o], [ix1 - o - 1, iy0 + o], [ix0 + o, iy1 - o - 1], [ix1 - o - 1, iy1 - o - 1]]) put(x, y, x + 1, y + 1, z, z + 12, { asset: MB, color: T.mould });
  }
  put(ix0, iy0, ix1, iy1, ceilZ, ceilZ + 4, { asset: MB, color: T.frieze[1] });
  const C = [ix0 + K + 1, iy0 + K + 1, ix1 - K - 1, iy1 - K - 1];
  const ocx = Math.floor((ix0 + ix1) / 2), ocy = Math.floor((iy0 + iy1) / 2), boss = [ocx - 2, ocy - 2, ocx + 2, ocy + 2];
  const BEAM = { asset: MB, color: T.trim };
  const ys = [], xs = [];
  for (let y = C[1]; y < C[3]; y += 6) ys.push(y);
  for (let x = C[0]; x < C[2]; x += 6) xs.push(x);
  for (const y of ys) for (const r of minus([C[0], y, C[2], y + 1], boss)) put(...r, ceilZ - 8, ceilZ, BEAM);
  for (const x of xs) for (let i = 0; i < ys.length; i++) {
    const y0 = ys[i] + 1, y1 = i + 1 < ys.length ? ys[i + 1] : C[3];
    if (y1 > y0) for (const r of minus([x, y0, x + 1, y1], boss)) put(...r, ceilZ - 8, ceilZ, BEAM);
  }
  put(...boss, ceilZ - 12, ceilZ, { asset: MB, color: GOLD }); // the chandelier's boss
  // chandelier: a chain, a gold ring of 6 x 6 studs with a cross, eight candles, one big light
  const CH = ceilZ - 64;
  put(ocx - 0.2, ocy - 0.2, ocx + 0.2, ocy + 0.2, CH + 4, ceilZ - 12, { ...IRON });
  for (const [a, b, c, d] of [[ocx - 3, ocy - 3, ocx + 3, ocy - 2.6], [ocx - 3, ocy + 2.6, ocx + 3, ocy + 3], [ocx - 3, ocy - 2.6, ocx - 2.6, ocy + 2.6], [ocx + 2.6, ocy - 2.6, ocx + 3, ocy + 2.6],
    [ocx - 2.6, ocy - 0.2, ocx - 0.2, ocy + 0.2], [ocx + 0.2, ocy - 0.2, ocx + 2.6, ocy + 0.2], [ocx - 0.2, ocy - 2.6, ocx + 0.2, ocy - 0.2], [ocx - 0.2, ocy + 0.2, ocx + 0.2, ocy + 2.6]])
    put(a, b, c, d, CH, CH + 4, { asset: MB, color: GOLD });
  put(ocx - 0.2, ocy - 0.2, ocx + 0.2, ocy + 0.2, CH, CH + 4, { asset: MB, color: GOLD, components: [LIGHT([255, 214, 160], 1400, 6)] });
  for (const [x, y] of [[-2.8, -2.8], [0, -2.8], [2.8, -2.8], [-2.8, 0], [2.8, 0], [-2.8, 2.8], [0, 2.8], [2.8, 2.8]]) {
    const cx = ocx + x, cy = ocy + y;
    put(cx - 0.2, cy - 0.2, cx + 0.2, cy + 0.2, CH + 4, CH + 10, { asset: MB, color: [236, 228, 210] });
    put(cx - 0.2, cy - 0.2, cx + 0.2, cy + 0.2, CH + 10, CH + 14, { asset: MB, color: [255, 200, 110], material: 'BMC_Glow', material_intensity: 10 });
  }
  // cathedral roof: slate wedges a stud in per course (ridge along the longer axis), eaves a
  // stud out, bonded gable walls, a ridge cap, a gold cross on each gable, a slender spire
  const alongX = HR[2] - HR[0] >= HR[3] - HR[1];
  const [r0, r1] = alongX ? [HR[1] - 1, HR[3] + 1] : [HR[0] - 1, HR[2] + 1]; // across the ridge
  const [e0, e1] = alongX ? [HR[0], HR[2]] : [HR[1], HR[3]];               // along it (gables flush)
  const R = (a0, a1, b0, b1, z0, z1, b) => (alongX ? put(b0, a0, b1, a1, z0, z1, b) : put(a0, b0, a1, b1, z0, z1, b));
  const zr = top + HALL_UP;
  let k = 0, ridgeZ = zr;
  for (; r0 + k + 1 < r1 - k - 1; k++) {
    const z = zr + 12 * k, s0 = r0 + k, s1 = r1 - k - 1, sl = SLATE[k % 3];
    const Dlo = alongX ? [0, 1] : [1, 0], Dhi = alongX ? [0, -1] : [-1, 0];
    R(s0, s0 + 1, e0 - 1, e1 + 1, z, z + 12, { asset: WEDGE, color: sl, wedge: { D: Dlo, down: false } });
    R(s1, s1 + 1, e0 - 1, e1 + 1, z, z + 12, { asset: WEDGE, color: sl, wedge: { D: Dhi, down: false } });
    const course = KEEP_COURSES + NUP + k;
    const g0 = k === 0 ? [e0 - 1, e1] : [e0, e1 - 1]; // the eave course runs a stud past the gables
    for (const g of g0) for (const [a, b] of runCuts(s0 + 1, s1, course)) R(a, b, g, g + 1, z, z + 12, { asset: k === 0 ? MB : undefined, color: field() });
    const [i0, i1] = k === 0 ? [e0, e1] : [e0 + 1, e1 - 1];
    if (i1 > i0) R(s0 + 1, s1, i0, i1, z, z + 12, { asset: MB, color: T.field[0] });
    ridgeZ = z + 12;
  }
  const s0 = r0 + k, s1 = r1 - k;
  if (s1 > s0) R(s0, s1, e0 - 1, e1 + 1, ridgeZ, ridgeZ + 6, { asset: MB, color: SLATE[0] });
  ridgeZ += 6;
  const rm = (r0 + r1) / 2;
  for (const g of [e0 - 1, e1]) { // gable crosses
    R(rm - 0.4, rm + 0.4, g, g + 1, ridgeZ, ridgeZ + 40, { asset: MB, color: GOLD });
    R(rm - 1.6, rm - 0.4, g, g + 1, ridgeZ + 24, ridgeZ + 30, { asset: MB, color: GOLD });
    R(rm + 0.4, rm + 1.6, g, g + 1, ridgeZ + 24, ridgeZ + 30, { asset: MB, color: GOLD });
  }
  { // spire at the ridge's middle: square base, tapering stages, gold tip
    const em = (e0 + e1) / 2;
    let z = ridgeZ;
    for (const [h, w, c] of [[36, 3, T.trim], [24, 2.4, SLATE[1]], [24, 1.8, SLATE[0]], [24, 1.2, SLATE[2]], [16, 0.6, GOLD]]) {
      R(rm - w / 2, rm + w / 2, em - w / 2, em + w / 2, z, z + h, { asset: MB, color: c });
      z += h;
    }
    ridgeZ = z;
  }
  return { windows: { x: wx, y: wy }, corniceZ: z0c - 8, roofTop: ridgeZ };
}

// a doorway set INTO the wall (owner 2026-10-25: "doors are not placed inside walls", the v4 frames
// stood proud of a 1-stud wall like props): on one face of the opening [a0, a1) (axis 0 = wall
// along x at stud line c, 1 = along y; s = -1 the face toward lower c, +1 higher) the wall itself
// thickens by D studs in the keep's running bond, from the floor to the ceiling, and the opening
// steps one stud wider and 12 higher per layer outward (an outline round it, another a stud in),
// jambs and lintels of every step in trim, a pointed head at the door, a keystone on the front.
// Returns put() argument lists (the caller adds them only where they fit).
export function portal({ axis, a0, a1, c, s, D = 2, T, h = 72, z0 = 4, zTop = 152, field }) {
  const out = [];
  const P = (p, q, d0, d1, za, zb, b) => {
    if (q <= p || zb <= za) return;
    const [c0, c1] = s < 0 ? [c - d1, c - d0] : [c + 1 + d0, c + 1 + d1];
    out.push(axis === 0 ? [p, c0, q, c1, za, zb, b] : [c0, p, c1, q, za, zb, b]);
  };
  const run = (p, q, d0, d1, za, zb, course, b) => { for (const [x, y] of runCuts(p, q, course)) P(x, y, d0, d1, za, zb, b ?? { color: field() }); };
  const along = axis === 0 ? [1, 0] : [0, 1];
  const L0 = a0 - D, L1 = a1 + D;
  for (let k = 0; k < D; k++) {
    const o0 = a0 - k, o1 = a1 + k, hk = h + 12 * k; // this layer's opening
    for (let za = z0; za < zTop; za = Math.floor(za / 12) * 12 + 12) {
      const zb = Math.min(zTop, Math.floor(za / 12) * 12 + 12), course = Math.floor(za / 12), last = zb === zTop;
      const top = last ? { asset: MB } : null;
      if (zb <= hk) { // beside the opening: field, a trim jamb on its edge
        run(L0, o0 - 1, k, k + 1, za, zb, course, top && { ...top, color: field() });
        P(o0 - 1, o0, k, k + 1, za, zb, { asset: MB, color: T.trim });
        P(o1, o1 + 1, k, k + 1, za, zb, { asset: MB, color: T.trim });
        run(o1 + 1, L1, k, k + 1, za, zb, course, top && { ...top, color: field() });
      } else if (za === hk) { // the lintel course: micro, trim over the opening, a keystone on the front layer
        run(L0, o0 - 1, k, k + 1, za, zb, course, { asset: MB, color: field() });
        if (k === D - 1) { const m = (o0 + o1) / 2; P(o0 - 1, m - 0.6, k, k + 1, za, zb, { asset: MB, color: T.trim }); P(m - 0.6, m + 0.6, k, k + 1, za, zb, { asset: MB, color: GOLD }); P(m + 0.6, o1 + 1, k, k + 1, za, zb, { asset: MB, color: T.trim }); }
        else P(o0 - 1, o1 + 1, k, k + 1, za, zb, { asset: MB, color: T.trim });
        run(o1 + 1, L1, k, k + 1, za, zb, course, { asset: MB, color: field() });
      } else run(L0, L1, k, k + 1, za, zb, course, top && { ...top, color: field() });
    }
  }
  // the pointed head of the door itself: two hanging wedges in the innermost layer's top course
  const mid = (a0 + a1) / 2;
  P(a0, mid, 0, 1, h - 12, h, { asset: WEDGE, color: T.trim, wedge: { D: [-along[0], -along[1]], down: true } });
  P(mid, a1, 0, 1, h - 12, h, { asset: WEDGE, color: T.trim, wedge: { D: along, down: true } });
  return out;
}

// I = hall interior (keep-frame studs); doors = [{ side, a0, a1 }]; shell = hallShell()'s result
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
    const notch = doors.filter(d => d.side === s).map(d => [d.a0 - along(s) - 3, d.a1 - along(s) + 3]);
    let g0 = 0, g1 = f.W;
    for (const d of doors) {
      if (d.side !== left[s] && d.side !== right[s]) continue;
      if (vOn(s, d.a0, d.a1) > GD + SW + 3) continue;
      if (d.side === left[s]) g0 = Math.max(g0, 4); else g1 = Math.min(g1, f.W - 4);
    }
    const clear = (a, b) => notch.every(([n0, n1]) => b <= n0 || a >= n1);
    const opts = [];
    for (let st = g0 + 3; st + 22 <= g1 - 3; st++) for (const dir of [1, -1]) if (clear(st - 3, st + 25)) opts.push([st, dir]);
    if (!opts.length) continue;
    const [st, dir] = opts[Math.floor(rng() * opts.length)];
    plan = { s, f, st, dir };
    break;
  }
  if (!plan) return { pots, ok: false };
  const { f, st, dir } = plan;
  const wd = (a, b) => { const [p, q] = f.m(0, 0), [r, s] = f.m(a, b); return [Math.sign(r - p), Math.sign(s - q)]; };
  const du = wd(1, 0);
  const box = (u0, v0, u1, v1, z0, z1, b) => {
    const [ax, ay] = f.m(u0, v0), [bx, by] = f.m(u1, v1);
    put(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, b);
  };
  const fieldR = () => { const k = Math.floor(rng() * 5); return shade(T.field[k % T.field.length], k); };
  // hall-frame box as a course of the keep's running bond
  const bond = (u0, v0, u1, v1, z0, z1, col = fieldR) => {
    const [ax, ay] = f.m(u0, v0), [bx, by] = f.m(u1, v1);
    bondPut(put, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), z0, z1, Math.floor(z0 / 12), col);
  };
  const octShaft = (u0, v0, z0, z1, drum = 24) => {
    for (let z = z0, n = 0; z < z1; z += drum, n++) {
      const zt = Math.min(z1, z + drum), c = MARBLE[n % 3];
      box(u0 + 1, v0, u0 + 2, v0 + 3, z, zt, { asset: MB, color: c });
      box(u0, v0 + 1, u0 + 1, v0 + 2, z, zt, { asset: MB, color: c });
      box(u0 + 2, v0 + 1, u0 + 3, v0 + 2, z, zt, { asset: MB, color: c });
      for (const [cu, cv, a, b] of [[0, 0, 1, 1], [2, 0, -1, 1], [0, 2, 1, -1], [2, 2, -1, -1]])
        box(u0 + cu, v0 + cv, u0 + cu + 1, v0 + cv + 1, z, zt, { asset: WEDGE, color: c, side: wd(a, b) });
    }
  };
  const flare = (u0, v0, s, z0, z1) => { // hanging wedges round an s x s core, a stud out
    for (const [a, b, c, d, D] of [[-1, 0, 0, s, [1, 0]], [s, 0, s + 1, s, [-1, 0]], [0, -1, s, 0, [0, 1]], [0, s, s, s + 1, [0, -1]]])
      box(u0 + a, v0 + b, u0 + c, v0 + d, z0, z1, { asset: WEDGE, color: T.trim, wedge: { D: wd(...D), down: true } });
  };
  const pillar = (u0, v0, h) => { // 5 x 5: plinth, gold base, marble shaft, necking, flare, abacus, smooth top
    box(u0, v0, u0 + 5, v0 + 5, 0, 12, { color: T.trim });
    box(u0 + 0.5, v0 + 0.5, u0 + 4.5, v0 + 4.5, 12, 16, { asset: MB, color: GOLD });
    octShaft(u0 + 1, v0 + 1, 16, h - 24);
    box(u0 + 1, v0 + 1, u0 + 4, v0 + 4, h - 24, h - 22, { asset: MB, color: GOLD });
    box(u0 + 1, v0 + 1, u0 + 4, v0 + 4, h - 22, h - 10, { asset: MB, color: T.trim });
    flare(u0 + 1, v0 + 1, 3, h - 22, h - 10);
    box(u0, v0, u0 + 5, v0 + 5, h - 10, h - 4, { asset: MB, color: T.trim });
    box(u0, v0, u0 + 5, v0 + 5, h - 4, h, { asset: SMOOTH, color: T.mould });
  };
  // ---- layout: gallery + stair band along v = 0, a wide walk, then the pit
  const SIDE = 9;
  const pu0 = SIDE, pu1 = f.W - SIDE, pv0 = GD + SW + 6, pv1 = f.D - SIDE;
  const P = [pu0 + 1, pv0 + 1, pu1 - 1, pv1 - 1];
  const CARPET = [128, 34, 30];
  const outer = [pu0 - 2, pv0 - 2, pu1 + 2, pv1 + 2];
  const tone = (u, v) => (((u >> 2) + (v >> 2)) % 2 ? (T.floor?.a ?? T.trim) : (T.floor?.b ?? T.mould));
  for (let u = 0; u < f.W; u += 4) for (let v = 0; v < f.D; v += 4)
    for (const r of minus([u, v, Math.min(f.W, u + 4), Math.min(f.D, v + 4)], outer)) box(...r, 0, FL, { asset: SMOOTH, color: tone(u, v) });
  for (const r of minus(outer, [pu0, pv0, pu1, pv1])) box(...r, 0, FL, { asset: SMOOTH, color: CARPET });
  // ---- gallery on an arcade of octagonal piers
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
  // ---- the stair between pale stone stringers (running bond), tan smooth treads, wedge copes
  const seg = j => (dir > 0 ? [st + 2 * (j - 1), st + 2 * j] : [st + 22 - 2 * j, st + 22 - 2 * (j - 1)]);
  const segs = (ja, jb) => [Math.min(seg(ja)[0], seg(jb)[0]), Math.max(seg(ja)[1], seg(jb)[1])];
  const cz = c => (c === 0 ? [FL, FL + 8] : [FL + 12 * c - 4, FL + 12 * c + 8]);
  const NT = GH / 12;
  const cheek = () => shade(T.trim, Math.floor(rng() * 5));
  for (let c = 0; c < NT; c++) {
    const [z0, z1] = cz(c), [a, b] = segs(c + 1, NT);
    bond(a, GD + 1, b, GD + SW - 1, z0, z1);
    const [p, q] = segs(Math.max(c + 1, NT - 1), NT);
    bond(p, GD, q, GD + 1, z0, z1);
  }
  for (let j = 1; j <= NT; j++) { const [a, b] = seg(j); box(a, j >= NT - 1 ? GD : GD + 1, b, GD + SW - 1, FL + 12 * j - 4, FL + 12 * j, { asset: SMOOTH, color: T.dado }); }
  for (const [v0, last] of [[GD + SW - 1, NT], [GD, NT - 2]]) {
    for (let c = 0; c <= last; c++) { const [z0, z1] = cz(c), [a, b] = segs(Math.max(1, c), last); bond(a, v0, b, v0 + 1, z0, z1, cheek); }
    for (let j = 1; j <= last; j++) { const [a, b] = seg(j); box(a, v0, b, v0 + 1, FL + 12 * j + 8, FL + 12 * j + 20, { asset: WEDGE, color: T.trim, wedge: { D: [du[0] * dir, du[1] * dir], down: false } }); }
  }
  // ---- island, pillars (footprints at least 5 studs apart: nothing to walk across)
  const IS = 7;
  const iu0 = Math.floor((P[0] + P[2] - IS) / 2), iv0 = Math.floor((P[1] + P[3] - IS) / 2) + 1;
  const ISL = [iu0, iv0, iu0 + IS, iv0 + IS];
  const GTOP = FL + GH, ISTOP = GTOP + 3 * STEP;
  const off = Math.max(5, Math.min(7, ISL[0] - P[0] - 5, ISL[1] - P[1] - 5, P[2] - ISL[2] - 5, P[3] - ISL[3] - 5));
  const M = [ISL[0] - off - 5, ISL[1] - off - 5, ISL[2] + off, ISL[3] + off];
  const Lw = M[2] - M[0], Lh = M[3] - M[1], Lp = 2 * (Lw + Lh);
  const at = t => { t = ((t % Lp) + Lp) % Lp; if (t < Lw) return [M[0] + t, M[1]]; t -= Lw; if (t < Lh) return [M[2], M[1] + t]; t -= Lh; if (t < Lw) return [M[2] - t, M[3]]; return [M[0], M[3] - (t - Lw)]; };
  const jumpU = Math.max(3, Math.min(f.W - 4, dir > 0 ? st - 5 : st + 27));
  const away = dir > 0 ? -1 : 1;
  const t0 = Math.max(0, Math.min(Lw, jumpU - 2 - M[0]));
  const apart = (a, b) => Math.max(Math.abs(a.u - b.u), Math.abs(a.v - b.v)) >= 10;
  const pillars = [];
  for (let t = t0; Math.abs(t - t0) < 0.75 * Lp && pillars.length < 12; t += away) {
    const [u, v] = at(t).map(Math.round), c = { u, v };
    if (!pillars.every(p => apart(c, p))) continue;
    pillars.push(c);
    t += away * 9;
  }
  pillars.forEach((p, n) => { p.h = GTOP + (n < pillars.length / 2 ? 1 : 2) * STEP; });
  const onPillar = (u, v) => pillars.some(p => u >= p.u && u < p.u + 5 && v >= p.v && v < p.v + 5);
  const ISF = [ISL[0] - 1, ISL[1] - 1, ISL[2] + 1, ISL[3] + 1];
  const onIsland = (u, v) => u >= ISL[0] && u < ISL[2] && v >= ISL[1] && v < ISL[3];
  // parapet (running bond, smooth cope), spikes
  for (const [a, b, c, d] of [[pu0, pv0, pu1, pv0 + 1], [pu0, pv1 - 1, pu1, pv1], [pu0, pv0 + 1, pu0 + 1, pv1 - 1], [pu1 - 1, pv0 + 1, pu1, pv1 - 1]]) {
    bond(a, b, c, d, 0, 12);
    box(a, b, c, d, 12, 16, { asset: SMOOTH, color: T.trim });
  }
  for (let u = P[0]; u < P[2]; u++) for (let v = P[1]; v < P[3]; v++)
    if (!onPillar(u, v) && !onIsland(u, v)) box(u, v, u + 1, v + 1, 0, 10, { asset: 'PB_Spike', color: [120, 116, 110], components: [DAMAGE] });
  for (const p of pillars) pillar(p.u, p.v, p.h);
  // the island: running-bond ring round a core, gold band, flare, smooth top
  for (let z = 0; z < ISTOP - 28; z += 12) {
    const zt = Math.min(ISTOP - 28, z + 12);
    bond(ISL[0], ISL[1], ISL[2], ISL[1] + 1, z, zt); bond(ISL[0], ISL[3] - 1, ISL[2], ISL[3], z, zt);
    bond(ISL[0], ISL[1] + 1, ISL[0] + 1, ISL[3] - 1, z, zt); bond(ISL[2] - 1, ISL[1] + 1, ISL[2], ISL[3] - 1, z, zt);
    box(ISL[0] + 1, ISL[1] + 1, ISL[2] - 1, ISL[3] - 1, z, zt, { color: T.field[0] });
  }
  box(...ISL, ISTOP - 28, ISTOP - 24, { asset: MB, color: GOLD });
  box(...ISL, ISTOP - 24, ISTOP - 10, { asset: MB, color: T.trim });
  flare(ISL[0], ISL[1], IS, ISTOP - 22, ISTOP - 10);
  box(...ISF, ISTOP - 10, ISTOP - 4, { asset: MB, color: T.trim });
  box(...ISF, ISTOP - 4, ISTOP, { asset: SMOOTH, color: T.mould });
  // gazebo: marble posts, stepped roof, finial, a lamp; under it the treasure: a chest and three pots
  for (const [u, v] of [[ISL[0], ISL[1]], [ISL[2] - 1, ISL[1]], [ISL[0], ISL[3] - 1], [ISL[2] - 1, ISL[3] - 1]]) {
    box(u, v, u + 1, v + 1, ISTOP, ISTOP + 6, { asset: MB, color: GOLD });
    box(u + 0.2, v + 0.2, u + 0.8, v + 0.8, ISTOP + 6, ISTOP + 78, { asset: MB, color: MARBLE[0] });
    box(u, v, u + 1, v + 1, ISTOP + 78, ISTOP + 84, { asset: MB, color: GOLD });
  }
  box(ISL[0] - 0.6, ISL[1] - 0.6, ISL[2] + 0.6, ISL[3] + 0.6, ISTOP + 84, ISTOP + 90, { asset: MB, color: [48, 96, 66] });
  box(ISL[0] + 0.4, ISL[1] + 0.4, ISL[2] - 0.4, ISL[3] - 0.4, ISTOP + 90, ISTOP + 96, { asset: MB, color: GOLD });
  box(ISL[0] + 1.4, ISL[1] + 1.4, ISL[2] - 1.4, ISL[3] - 1.4, ISTOP + 96, ISTOP + 102, { asset: MB, color: [48, 96, 66] });
  const cu = ISL[0] + IS / 2, cv = ISL[1] + IS / 2;
  box(cu - 0.4, cv - 0.4, cu + 0.4, cv + 0.4, ISTOP + 102, ISTOP + 116, { asset: MB, color: GOLD });
  box(cu - 0.2, cv - 0.2, cu + 0.2, cv + 0.2, ISTOP + 80, ISTOP + 84, { asset: MB, color: GOLD });
  box(cu - 0.4, cv - 0.4, cu + 0.4, cv + 0.4, ISTOP + 70, ISTOP + 80, { asset: MB, color: [255, 220, 150], material: 'BMC_Glow', material_intensity: 6, components: [LIGHT([255, 210, 150], 360)] });
  {
    const c0 = [cu - 1.5, ISL[3] - 2.4], ZT = ISTOP;
    box(c0[0], c0[1], c0[0] + 3, c0[1] + 1.8, ZT, ZT + 16, { asset: MB, color: [92, 58, 34] });
    box(c0[0] - 0.2, c0[1] - 0.2, c0[0] + 3.2, c0[1] + 2, ZT + 16, ZT + 22, { asset: MB, color: [104, 66, 38] });
    for (const a of [0.4, 2.4]) box(c0[0] + a, c0[1] - 0.4, c0[0] + a + 0.2, c0[1] - 0.2, ZT + 2, ZT + 16, { ...IRON });
    box(c0[0] + 1.3, c0[1] - 0.4, c0[0] + 1.7, c0[1] - 0.2, ZT + 8, ZT + 14, { asset: MB, color: GOLD, material: 'BMC_Metallic' });
  }
  // pots (2 studs wide) clear of each other, the posts and the chest
  for (const [a, b] of [[cu - 2.2, cv - 1.5], [cu + 2.2, cv - 1.5], [cu, cv - 1]]) { const [x, y] = f.m(a, b); pots.push([x, y, ISTOP]); }
  // torches on the parapet corners
  const TORCH = [[255, 150, 50], [200, 90, 255], [90, 255, 120], [90, 170, 255]];
  [[pu0, pv0], [pu1 - 1, pv0], [pu0, pv1 - 1], [pu1 - 1, pv1 - 1]].forEach(([u, v], n) => {
    box(u + 0.2, v + 0.2, u + 0.8, v + 0.8, 16, 48, { asset: MB, color: MARBLE[0] });
    box(u, v, u + 1, v + 1, 48, 54, { asset: MB, color: GOLD });
    box(u + 0.3, v + 0.3, u + 0.7, v + 0.7, 54, 66, { asset: MB, color: TORCH[n], material: 'BMC_Glow', material_intensity: 10, components: [LIGHT(TORCH[n])] });
  });
  // balustrade
  const head = segs(NT - 1, NT);
  const gaps = [[head[0] - 1, head[1] + 1], [jumpU - 2, jumpU + 3]].sort((a, b) => a[0] - b[0]);
  const BAL = [[0.6, 0, 4], [0.4, 4, 8], [0.6, 8, 18], [0.4, 18, 22], [0.6, 22, 24]];
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
  // pilasters between the windows (in line with the buttresses)
  {
    const opp = { S: 'N', N: 'S', W: 'E', E: 'W' }[plan.s], cz1 = shell.corniceZ;
    const walls = [['S', 0, iy0, shell.windows.x], ['N', 0, iy1 - 1, shell.windows.x], ['W', 1, ix0, shell.windows.y], ['E', 1, ix1 - 1, shell.windows.y]];
    const vOf = (a0, a1) => ({ S: a0 - iy0, N: iy1 - a1, W: a0 - ix0, E: ix1 - a1 }[plan.s]);
    for (const [w, axis, c, ws] of walls) for (const m of ws.slice(0, -1).map(([, w1], i) => (w1 + ws[i + 1][0]) / 2)) {
      if (doors.some(d => d.side === w && Math.abs((d.a0 + d.a1) / 2 - m) < 7)) continue;
      let z0 = FL;
      if (w === plan.s) z0 = GTOP; else if (w !== opp && vOf(m - 2, m + 2) < GD + SW + 1) continue;
      const P2 = (a0, a1, z, zt, b) => (axis === 0 ? put(a0, c, a1, c + 1, z, zt, b) : put(c, a0, c + 1, a1, z, zt, b));
      P2(m - 1.4, m + 1.4, z0, z0 + 6, { asset: MB, color: GOLD });
      for (let z = z0 + 6, n = 0; z < cz1 - 10; z += 12, n++) P2(m - 1, m + 1, z, Math.min(cz1 - 10, z + 12), { asset: MB, color: shade(T.trim, n % 5) });
      P2(m - 1, m + 1, cz1 - 10, cz1 - 8, { asset: MB, color: GOLD });
      P2(m - 1.4, m + 1.4, cz1 - 8, cz1, { asset: MB, color: T.trim });
    }
  }
  // vines off the cornice, between windows and pilasters
  const VINE = [[46, 92, 52], [60, 112, 58], [38, 78, 46]];
  const W = ix1 - ix0, D = iy1 - iy0, cz0 = shell.corniceZ;
  const inWin = (wall, a) => { const base = wall < 2 ? ix0 : iy0, ws = wall < 2 ? shell.windows.x : shell.windows.y; return ws.some(([w0, w1]) => base + a >= w0 - 1 && base + a < w1 + 1) || ws.slice(0, -1).some(([, w1], i) => Math.abs(base + a - (w1 + ws[i + 1][0]) / 2) < 3); };
  const used = new Set();
  for (let n = 0; n < 22; n++) {
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
