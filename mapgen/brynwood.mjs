// 4453 Brynwood Dr, Naples FL 34119 (Quail West) (2026-11-01, owner: Zillow zpid 43789930, 'one to one floorplan,
// research house, research mapgens, knock their socks off, experiment with diagonal geometry'). 2001 Biltmore-inspired
// Mediterranean estate, 11,616 sq ft, 5 bed / 9 bath, block + cream stucco, red barrel-tile hip roofs, a screened pool
// lanai between the wings, 18-seat cinema, wine cellar, safe room, two garages, a one-bed apartment wing upstairs
// with its own stair.
// PLAN = the listing's 3D tour blueprint (view-imx __NEXT_DATA__ blueprintJson), compact in refs/brynwood_bp.json
// (cm; per floor fp = flat x,y list, rooms [id, type, stair, poly], walls [x0,y0,x1,y1, thick, [w|d, cx, cy, width]..],
// notes [room, text, x, y]). Upper floors come in their own frames, fitted on the walls: Floor 2 A +734,-450 cm
// (its 45 degree wall on the great-room diagonal, its stair over the F1 stair), Floor 2 B (apartment) -1730,-590 cm
// (elevator on the F1 diamond elevator). 1 ft = 10 units; x mirrored at load (left-handed world).
// DIAGONAL GEOMETRY: every layer (wall bands, floors, slabs, roof courses, stair treads, steps, pool) is a label raster
// of 2-unit cells cut by mesh() into trapezoids: runs stacked row on row while each edge stays on one straight line.
// A trapezoid becomes strips: a micro box core plus an upright PB_DefaultMicroWedge (side wedge) on each slanted edge,
// so 45 degree walls, the round turret and the curved stair come out smooth. Slants only ever face air: where two
// different solid labels meet, the edge is kept vertical (a wedge pair would share one box and the game rejects it).
//   brynwood() -> { bricks, dropped }      node mapgen/brynwood.mjs [job.json] [--at X,Y]
import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';

const BP = JSON.parse(fs.readFileSync(new URL('./refs/brynwood_bp.json', import.meta.url)));
const K = 0.32808;                                   // units per cm
export const R = 2, GX0 = -880, GY0 = -680, NX = 880, NY = 680, N = NX * NY;
const FLOORS = [
  { name: 'Floor 1', off: [0, 0] },
  { name: 'Floor 2 A', off: [734, -450] },
  { name: 'Separate Entry Floor 2 B', off: [-1730, -590] },
];
// z: pad 0..36 + finish 36..40 | F1 walls 40..170 | slab 170..176 + F2 finish ..180 | F2 walls 180..290 |
// ceiling 290..300 | roofs from 180 (one storey) and 300
const FL1 = 40, TOP1 = 170, FL2 = 180, TOP2 = 290;

export const T = (x, y, off) => [-(x + off[0]) * K, (y + off[1]) * K];
const pts = (a, off) => { const P = []; for (let i = 0; i < a.length; i += 2) P.push(T(a[i], a[i + 1], off)); return P; };
export const cx = i => GX0 + i * R + 1, cy = j => GY0 + j * R + 1;
function pip(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function eachCell(x0, y0, x1, y1, f) {
  const i0 = Math.max(0, Math.floor((x0 - GX0) / R)), i1 = Math.min(NX - 1, Math.ceil((x1 - GX0) / R));
  const j0 = Math.max(0, Math.floor((y0 - GY0) / R)), j1 = Math.min(NY - 1, Math.ceil((y1 - GY0) / R));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * NX + i, cx(i), cy(j));
}
const bbox = P => [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))];
function polyMask(P, mask = new Uint8Array(N), v = 1) {
  const [x0, y0, x1, y1] = bbox(P);
  eachCell(x0, y0, x1, y1, (k, x, y) => { if (pip(P, x, y)) mask[k] = v; });
  return mask;
}
const cellOf = (x, y) => Math.floor((y - GY0) / R) * NX + Math.floor((x - GX0) / R);
/** chamfer distance (cells) from every cell to the nearest seed cell (seed[k] truthy) */
export function chamfer(seed) {
  const d = new Float32Array(N);
  for (let k = 0; k < N; k++) d[k] = seed[k] ? 0 : 1e9;
  const D = Math.SQRT2;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - NX] + 1); if (i > 0) v = Math.min(v, d[k - NX - 1] + D); if (i < NX - 1) v = Math.min(v, d[k - NX + 1] + D); }
    d[k] = v;
  }
  for (let j = NY - 1; j >= 0; j--) for (let i = NX - 1; i >= 0; i--) {
    const k = j * NX + i; let v = d[k];
    if (i < NX - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < NY - 1) { v = Math.min(v, d[k + NX] + 1); if (i < NX - 1) v = Math.min(v, d[k + NX + 1] + D); if (i > 0) v = Math.min(v, d[k + NX - 1] + D); }
    d[k] = v;
  }
  return d;
}
const hash = (a, b) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
export const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

// ------------------------------------------------------------------ materials --
// floor finishes after the photos: travertine (great room, kitchen, foyer), Brazilian cherry planks (bedrooms, den,
// cinema), white marble (primary baths), beige bath tile, garage epoxy, lanai pavers
const FIN = [null,
  { id: 'TRV', c: [[226, 212, 186], [216, 200, 172], [232, 221, 199]] },
  { id: 'WOD', c: [[122, 62, 38], [134, 74, 46], [110, 55, 33]] },
  { id: 'MAR', c: [[238, 236, 232], [222, 220, 216]] },
  { id: 'BTH', c: [[212, 198, 172], [200, 186, 160]] },
  { id: 'GAR', c: [[152, 152, 150]] },
  { id: 'PAV', c: [[224, 208, 180], [210, 192, 162], [232, 218, 194]] },
];
const finOf = t => /primary.*bath|primary <br/i.test(t) ? 3 : /bath/i.test(t) ? 4 : /garage/i.test(t) ? 5 : /patio|porch|balcony|pool|entry$/i.test(t) ? 6
  : /bed|den|closet|movie|media|bonus|office|safe/i.test(t) ? 2 : 1;
/** pattern variant of finish m at a cell centre: travertine 3 ft squares, staggered 6 ft planks, 4 ft marble checker,
 * 2 ft bath tile, 2x4 ft running-bond pavers */
function variant(m, x, y) {
  const f = Math.floor;
  if (m === 1) return hash(f(x / 30), f(y / 30)) % 3;
  if (m === 2) { const row = f(y / 10); return hash(f((x + (row * 22) % 60) / 60), row) % 3; }
  if (m === 3) return (f(x / 40) + f(y / 40)) & 1;
  if (m === 4) return hash(f(x / 20), f(y / 20)) % 2;
  if (m === 6) { const row = f(y / 20); return hash(f((x + (row & 1) * 20) / 40), row) % 3; }
  return 0;
}
export const finLabel = (m, k) => m * 8 + variant(m, cx(k % NX), cy(Math.floor(k / NX))) + 1;
export const finMat = v => { const m = FIN[(v - 1) >> 3]; return { color: m.c[(v - 1) & 7] }; };
export const STUCCO = [238, 226, 204], GLASS = { color: [176, 212, 228], material: 'BMC_Glass' }, IRON = [58, 44, 36], WHITE = [244, 240, 232];
export const ROOF = [[180, 88, 56], [168, 80, 50], [190, 100, 64]];

// ---------------------------------------------------------------------- plans --
export function plan(fd, P) {
  const f = (fd.bp ?? BP).find(q => q.n === fd.name), off = fd.off;
  const fp = pts(f.fp, off);
  polyMask(fp, P.fp);
  const rooms = f.r.map(([id, type, , poly]) => ({ id, type, P: pts(poly, off), notes: f.t.filter(t => t[0] === id).map(t => ({ text: t[1], p: T(t[2], t[3], off) })) }));
  for (const r of rooms) {
    const kind = { finished: 1, outdoor: 2, garage: 3, stairs: 4, 'open-to-below': 5 }[r.type];
    const [x0, y0, x1, y1] = bbox(r.P);
    eachCell(x0, y0, x1, y1, (k, x, y) => {
      if (!pip(r.P, x, y)) return;
      P.kind[k] = kind; P.room[k] = r;
      if (kind === 5) return;
      let m = kind === 2 ? 6 : kind === 3 ? 5 : 1;
      if (r.notes.length) {
        let best = 1e18;
        for (const n of r.notes) { const d = (n.p[0] - x) ** 2 + (n.p[1] - y) ** 2; if (d < best) { best = d; m = finOf(n.text); } }
      } else if (kind === 1) m = 2;
      P.fin[k] = m;
    });
  }
  const garageAt = (x, y) => { const k = cellOf(x, y); return k >= 0 && k < N && P.kind[k] === 3; };
  const hit = new Uint8Array(N);
  for (const [x0, y0, x1, y1, tc, ...ks] of f.w) {
    const A = T(x0, y0, off), B = T(x1, y1, off);
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 0.5) continue;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, rail = tc < 6, h = rail ? 2 : 5;
    // openings cut square to the grid's dominant axis, so a diagonal wall meets its glass on a straight (unslanted) edge
    const ops = ks.map(([t, ox, oy, wc]) => {
      const c = T(ox, oy, off), hw = wc * K / 2, ax = Math.abs(ux) >= Math.abs(uy) ? 0 : 1;
      const e = [c[ax] - (ax ? uy : ux) * hw, c[ax] + (ax ? uy : ux) * hw];
      const gar = t === 'd' && wc >= 200 && (garageAt(c[0] + nx * 15, c[1] + ny * 15) || garageAt(c[0] - nx * 15, c[1] - ny * 15));
      return { lo: Math.min(...e), hi: Math.max(...e), ax, kind: t === 'w' ? 2 : gar ? 3 : 1 };
    });
    eachCell(Math.min(A[0], B[0]) - 8, Math.min(A[1], B[1]) - 8, Math.max(A[0], B[0]) + 8, Math.max(A[1], B[1]) + 8, (k, x, y) => {
      const rx = x - A[0], ry = y - A[1], u = rx * ux + ry * uy, s = rx * nx + ry * ny;
      if (Math.abs(s) >= h || u < -h || u > L + h) return;
      if (rail) { P.rail[k] = 1; return; }
      P.wall[k] = 1;
      const o = u > 0 && u < L && ops.find(q => { const v = q.ax ? y : x; return v > q.lo && v < q.hi; });
      if (!o) { hit[k] = 1; return; }
      if (o.kind > P.op[k]) P.op[k] = o.kind;
      if (Math.abs(s) < 2) P.glass[k] = 1;
    });
  }
  for (let k = 0; k < N; k++) if (hit[k]) P.op[k] = 0;
  return rooms;
}
export const newPlan = () => ({ fp: new Uint8Array(N), kind: new Uint8Array(N), fin: new Uint8Array(N), room: new Array(N), wall: new Uint8Array(N), rail: new Uint8Array(N), op: new Uint8Array(N), glass: new Uint8Array(N) });

// ----------------------------------------------------------------------- mesh --
export function makeMesher(B, stats) {
  /** one z layer of a label raster (0 = air) as trapezoids -> micro boxes + upright side wedges */
  return function mesh(lab, z0, z1, matOf, tag, block) {
    const put = (x0, y0, x1, y1, m) => {
      if (!B.box(GX0 + x0 * R, GY0 + y0 * R, z0, GX0 + x1 * R, GY0 + y1 * R, z1, { asset: 'PB_DefaultMicroBrick', ...m }, tag)) stats.drop++;
      stats.n++;
    };
    const wedge = (x0, y0, x1, y1, rot, m) => {
      const hx = (x1 - x0) * R / 2, hy = (y1 - y0) * R / 2, hz = (z1 - z0) / 2;
      const b = { asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, size: rot & 1 ? [hy, hx, hz] : [hx, hy, hz], ...m,
        position: [GX0 + (x0 + x1) * R / 2, GY0 + (y0 + y1) * R / 2, (z0 + z1) / 2] };
      if (!B.add(b, tag)) stats.drop++;
      stats.n++; stats.w++;
    };
    const freeBox = (x0, y0, x1, y1) => B.free([GX0 + x0 * R, GY0 + y0 * R, z0], [GX0 + x1 * R, GY0 + y1 * R, z1]);
    function emit(t) {
      const n = t.L.length, j0 = t.j0, m = matOf(t.v);
      const sl = n > 1 ? (t.L[n - 1] - t.L[0]) / (n - 1) : 0, sr = n > 1 ? (t.R[n - 1] - t.R[0]) / (n - 1) : 0;
      const xl = y => Math.max(0, Math.min(NX, Math.round(t.L[0] + sl * (y - j0)))), xr = y => Math.max(0, Math.min(NX, Math.round(t.R[0] + sr * (y - j0))));
      const rows = (a, b) => { for (let y = a; y < b; y++) put(t.L[y - j0], y, t.R[y - j0], y + 1, m); };
      for (let a = j0; a < j0 + n;) {
        let b = a + 1;
        const ok = (a, b) => Math.max(xl(a), xl(b)) <= Math.min(xr(a), xr(b));
        if (!ok(a, b)) { rows(a, b); a = b; continue; }
        while (b < j0 + n && b - a < 200 && ok(a, b + 1)) b++;
        const La = xl(a), Lb = xl(b), Ra = xr(a), Rb = xr(b);
        const l0 = Math.min(La, Lb), l1 = Math.max(La, Lb), r0 = Math.min(Ra, Rb), r1 = Math.max(Ra, Rb);
        // every cell under the strip's pieces is this run or air, and the slant boxes touch nothing placed yet
        let clean = true;
        for (let y = a; y < b && clean; y++) {
          const row = y * NX, rl = t.L[y - j0], rr = t.R[y - j0];
          for (let x = l0; x < r1; x++) if ((x < rl || x >= rr) && (lab[row + x] || block[row + x])) { clean = false; break; }
        }
        if (clean && l0 < l1 && !freeBox(l0, a, l1, b)) clean = false;
        if (clean && r0 < r1 && !freeBox(r0, a, r1, b)) clean = false;
        if (clean && l1 < r0 && !freeBox(l1, a, r0, b)) clean = false;
        if (!clean) { rows(a, b); a = b; continue; }
        if (l1 < r0) put(l1, a, r0, b, m);
        if (l0 < l1) wedge(l0, a, l1, b, La < Lb ? 1 : 2, { ...m, color: m.color });
        if (r0 < r1) wedge(r0, a, r1, b, Ra < Rb ? 3 : 0, { ...m, color: m.color });
        a = b;
      }
    }
    function edgeOk(arr, vert, free, p, nb) {
      const last = arr[arr.length - 1];
      if (vert && p === last) return 'v';
      if (!free || nb) return null;
      const n = arr.length, a0 = arr[0];
      if (Math.abs(p - a0) > 8 * n) return null;             // flatter than ~7 degrees: leave it stepped
      for (let k = 1; k < n; k++) if (Math.abs(arr[k] - (a0 + (p - a0) * k / n)) > 0.6) return null;
      return 's';
    }
    let act = [];
    for (let j = 0; j <= NY; j++) {
      const runs = [];
      if (j < NY) {
        const row = j * NX;
        for (let i = 0; i < NX;) {
          const v = lab[row + i];
          if (!v) { i++; continue; }
          let e = i + 1;
          while (e < NX && lab[row + e] === v) e++;
          runs.push({ v, i0: i, i1: e, nL: i > 0 && (lab[row + i - 1] !== 0 || block[row + i - 1] !== 0), nR: e < NX && (lab[row + e] !== 0 || block[row + e] !== 0) });
          i = e;
        }
      }
      // overlap matching on the sorted, disjoint runs of this row and the last
      const cand = [], cnt = new Map();
      let p = 0;
      for (const r of runs) {
        while (p < act.length && act[p].R.at(-1) <= r.i0) p++;
        const c = [];
        for (let q = p; q < act.length && act[q].L.at(-1) < r.i1; q++) if (act[q].v === r.v) { c.push(act[q]); cnt.set(act[q], (cnt.get(act[q]) ?? 0) + 1); }
        cand.push(c);
      }
      const next = [], kept = new Set();
      runs.forEach((r, n) => {
        const c = cand[n], t = c[0];
        if (c.length === 1 && cnt.get(t) === 1) {
          const a = edgeOk(t.L, t.vL, t.fL, r.i0, r.nL), b = a && edgeOk(t.R, t.vR, t.fR, r.i1, r.nR);
          if (a && b) {
            t.L.push(r.i0); t.R.push(r.i1);
            if (a === 's') t.vL = false;
            if (b === 's') t.vR = false;
            t.fL = t.fL && !r.nL; t.fR = t.fR && !r.nR;
            next.push(t); kept.add(t); return;
          }
        }
        next.push({ v: r.v, j0: j, L: [r.i0], R: [r.i1], vL: true, vR: true, fL: !r.nL, fR: !r.nR });
      });
      for (const t of act) if (!kept.has(t)) emit(t);
      act = next;
    }
  };
}

export function brynwood() {
  const B = makeBuilder({ cell: 40 }), stats = { n: 0, w: 0, drop: 0 };
  const meshNow = makeMesher(B, stats), rnd = rng(4453);
  // layers are queued, then meshed with every other layer at an overlapping height counted as solid, so no slant
  // ever runs into a neighbour's cells (pad vs pool, steps vs pad, roof vs upper walls, rails vs treads)
  const layers = [];
  const mesh = (lab, z0, z1, matOf, tag, extra) => {
    let j0 = NY, j1 = -1;
    for (let k = 0; k < N; k++) if (lab[k]) { const j = Math.floor(k / NX); if (j < j0) j0 = j; j1 = j; }
    if (j1 >= 0) layers.push({ lab, z0, z1, matOf, tag, extra, j0, j1 });
  };
  const flush = () => {
    for (const L of layers) {
      const block = new Uint8Array(N);
      if (L.extra) block.set(L.extra);
      for (const O of layers) {
        if (O === L || O.z1 <= L.z0 || L.z1 <= O.z0 || O.j1 < L.j0 - 1 || L.j1 + 1 < O.j0) continue;
        for (let k = Math.max(L.j0 - 1, O.j0) * NX, e = (Math.min(L.j1 + 1, O.j1) + 1) * NX; k < e; k++) if (O.lab[k]) block[k] = 1;
      }
      meshNow(L.lab, L.z0, L.z1, L.matOf, L.tag, block);
    }
  };
  const P1 = newPlan(), P2 = newPlan();
  plan(FLOORS[0], P1);
  plan(FLOORS[1], P2);
  plan(FLOORS[2], P2);
  const lab = () => new Uint16Array(N);

  // ---------------------------------------------------------- stairs (masks) --
  // grand stair: a curved flight round a centre fitted on Floor 2 A's stair arcs, 14 risers of 10, sweeping 145
  // degrees up from the kitchen side to the gallery; the F2 slab is open over its upper treads
  const SC = T(986, 272, [0, 0]), RI = 40, RO = 88, A0 = 130, SW = 145, NT = 13;
  const stairK = new Int8Array(N).fill(-1);
  eachCell(SC[0] - RO, SC[1] - RO, SC[0] + RO, SC[1] + RO, (k, x, y) => {
    const r = Math.hypot(x - SC[0], y - SC[1]);
    if (r < RI || r >= RO) return;
    let a = Math.atan2(y - SC[1], x - SC[0]) * 180 / Math.PI - A0;
    a = ((a % 360) + 360) % 360;
    if (a < SW) stairK[k] = Math.floor(a / (SW / NT));
  });
  // apartment stair: an outdoor spiral from the lanai lawn to the 2B kitchen door, 17 treads x 30 degrees + landing
  const SP = T(-1730, -1490, [0, 0]), door = T(-1747, -1385, [0, 0]), SRO = 44, SRI = 6;
  const aLand = Math.atan2(door[1] - SP[1], door[0] - SP[0]) * 180 / Math.PI;
  const spiK = new Int8Array(N).fill(-1);     // 0..16 treads, 17 = landing sector
  eachCell(SP[0] - SRO, SP[1] - SRO, SP[0] + SRO, SP[1] + SRO, (k, x, y) => {
    const r = Math.hypot(x - SP[0], y - SP[1]);
    if (r >= SRO || r < SRI) return;
    let a = Math.atan2(y - SP[1], x - SP[0]) * 180 / Math.PI;
    const dl = (((a - aLand) % 360) + 540) % 360 - 180;
    if (Math.abs(dl) <= 45) { spiK[k] = 17; return; }
    // treads climb anticlockwise and end where the landing begins: tread 16 = [aLand-75, aLand-45)
    const back = (((aLand - 45 - a) % 360) + 360) % 360;   // degrees below the landing
    const t = 16 - Math.floor(back / 30);
    if (t >= 0) spiK[k] = t;
  });
  for (let k = 0; k < N; k++) if (stairK[k] >= 0) { P1.wall[k] = 0; P1.rail[k] = 0; P2.wall[k] = 0; P2.rail[k] = 0; }

  // -------------------------------------------------------- lanai, pool, holes --
  const lanai = new Uint8Array(N), house = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (!P1.fp[k]) continue;
    if (P1.room[k]?.id === '7eaf0') lanai[k] = 1; else if (P1.kind[k] !== 2) house[k] = 1;
  }
  const dHouse = chamfer(house), sky = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (lanai[k] && dHouse[k] >= 80 && !P2.fp[k] && !P1.wall[k]) sky[k] = 1;
  const dSky = chamfer(sky.map(v => v ? 0 : 1)), pool = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (sky[k] && dSky[k] >= 22) pool[k] = 1;
  const holeF2 = new Uint8Array(N);     // no slab: open sky, double-height gallery, upper stair treads, the spiral well
  for (let k = 0; k < N; k++) {
    if (sky[k] || P2.kind[k] === 5 || P2.kind[k] === 4 || stairK[k] >= 3) holeF2[k] = 1;
    if (spiK[k] >= 0 && spiK[k] < 17) holeF2[k] = 1;
    if (Math.hypot(cx(k % NX) - SP[0], cy(Math.floor(k / NX)) - SP[1]) < SRI) holeF2[k] = 1;
  }

  // ----------------------------------------------------- F1 pad, finish, pool --
  // finish under walls / gaps: grow each room's finish outward so wall feet sit on their rooms' floors
  const grow = (fin, mask) => {
    let frontier = [];
    for (let k = 0; k < N; k++) if (mask[k] && fin[k]) frontier.push(k);
    for (let it = 0; it < 40 && frontier.length; it++) {
      const nx = [];
      for (const k of frontier) for (const d of [1, -1, NX, -NX]) { const q = k + d; if (q >= 0 && q < N && mask[q] && !fin[q]) { fin[q] = fin[k]; nx.push(q); } }
      frontier = nx;
    }
    for (let k = 0; k < N; k++) if (mask[k] && !fin[k]) fin[k] = 1;
  };
  grow(P1.fin, P1.fp);
  {
    const pad = lab(), fin = lab(), pf = lab(), wat = lab();
    for (let k = 0; k < N; k++) {
      if (!P1.fp[k]) continue;
      if (pool[k]) { pf[k] = 1; wat[k] = 1; continue; }
      pad[k] = 1; fin[k] = finLabel(P1.fin[k], k);
    }
    mesh(pad, 0, 36, () => ({ color: [214, 204, 186] }), 'pad');
    mesh(fin, 36, 40, finMat, 'floor 1');
    mesh(pf, 0, 6, () => ({ color: [118, 186, 212] }), 'pool floor');
    mesh(wat, 6, 34, () => ({ color: [60, 150, 200], material: 'BMC_Glass', collision: false }), 'pool water');
  }

  // ---------------------------------------------------------------- walls --
  function walls(P, fl, top, skip) {
    const cuts = [fl, fl + 24, fl + 36, fl + 84, fl + 100, top];
    for (let b = 0; b < cuts.length - 1; b++) {
      const zA = cuts[b], zB = cuts[b + 1], mid = (zA + zB) / 2 - fl, L = lab();
      for (let k = 0; k < N; k++) {
        if (skip && skip[k]) continue;
        if (P.wall[k]) {
          const o = P.op[k];
          let v = 1;
          if (o === 1 && mid < 84) v = 0;
          else if (o === 2 && mid > 24 && mid < 100) v = P.glass[k] ? 2 : 0;
          else if (o === 3 && mid < 84) v = P.glass[k] ? 3 : 0;
          L[k] = v;
        } else if (P.rail[k] && mid < 36) L[k] = 4;
      }
      mesh(L, zA, zB, v => v === 1 ? { color: shade(STUCCO, 0.97 + rnd() * 0.03) } : v === 2 ? GLASS : v === 3 ? { color: WHITE } : { color: IRON }, 'walls');
    }
  }
  walls(P1, FL1, TOP1);

  // ---------------------------------------------------------------- slab --
  grow(P2.fin, P2.fp);
  {
    const sa = lab(), sb = lab();
    for (let k = 0; k < N; k++) {
      if (!(P1.fp[k] || P2.fp[k]) || holeF2[k]) continue;
      sa[k] = 1;
      sb[k] = P2.fp[k] ? finLabel(P2.fin[k], k) : 1;
    }
    mesh(sa, TOP1, TOP1 + 6, () => ({ color: WHITE }), 'slab');
    mesh(sb, TOP1 + 6, FL2, v => v === 1 ? { color: WHITE } : finMat(v), 'floor 2');
  }
  walls(P2, FL2, TOP2);
  {
    const ce = lab();
    for (let k = 0; k < N; k++) if (P2.fp[k] && P2.kind[k] !== 2 && !(spiK[k] >= 0)) ce[k] = 1;
    mesh(ce, TOP2, TOP2 + 10, () => ({ color: WHITE }), 'ceiling 2');
  }

  // --------------------------------------------------------------- stairs --
  for (let t = 0; t < NT; t++) {
    const tr = lab(), rl = lab(), zt = FL1 + 10 * (t + 1);
    for (let k = 0; k < N; k++) if (stairK[k] === t) {
      tr[k] = 1;
      const r = Math.hypot(cx(k % NX) - SC[0], cy(Math.floor(k / NX)) - SC[1]);
      if (r < RI + 4 || r >= RO - 4) rl[k] = 1;
    }
    mesh(tr, zt - 10, zt, () => ({ color: [226, 212, 186] }), 'stair');
    mesh(rl, zt, zt + 36, () => ({ color: IRON }), 'stair rail');
  }
  for (let t = 0; t < 17; t++) {
    const tr = lab(), rl = lab(), zt = 10 * (t + 1);
    for (let k = 0; k < N; k++) if (spiK[k] === t && !P1.wall[k] && !P2.wall[k] && !P2.rail[k]) {
      tr[k] = 1;
      if (Math.hypot(cx(k % NX) - SP[0], cy(Math.floor(k / NX)) - SP[1]) >= SRO - 4) rl[k] = 1;
    }
    mesh(tr, zt - 10, zt, () => ({ color: [210, 196, 170] }), 'spiral');
    mesh(rl, zt, zt + 36, () => ({ color: IRON }), 'spiral rail');
  }
  {
    const nw = lab(), land = lab();
    for (let k = 0; k < N; k++) {
      if (Math.hypot(cx(k % NX) - SP[0], cy(Math.floor(k / NX)) - SP[1]) < SRI) nw[k] = 1;
      if (spiK[k] === 17 && !P2.fp[k] && !P1.fp[k]) land[k] = 1;
    }
    mesh(nw, 0, FL2 + 40, () => ({ color: IRON }), 'spiral newel');
    mesh(land, TOP1, FL2, () => ({ color: [210, 196, 170] }), 'spiral landing');
  }

  // ------------------------------------------------- steps + garage aprons --
  {
    const deck = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (P1.fp[k] && P1.kind[k] === 2 && !P1.wall[k] && !pool[k]) deck[k] = 1;
    const out = new Uint8Array(N);
    for (let k = 0; k < N; k++) out[k] = P1.fp[k] || spiK[k] >= 0 ? 0 : 1;
    const dDeck = chamfer(deck), dFp = chamfer(P1.fp);
    for (let s = 0; s < 3; s++) {
      const L = lab();
      for (let k = 0; k < N; k++) if (out[k] && dDeck[k] <= 6 * (3 - s) + 0.5 && dDeck[k] <= dFp[k] + 0.5) L[k] = 1;
      mesh(L, 10 * s, 10 * s + 10, () => ({ color: [222, 206, 178] }), 'steps');
    }
  }

  // ---------------------------------------------------------------- roofs --
  // coursed barrel-tile hips: course k covers the cells at least 5k cells inside the eave line (4 rise per 10 run),
  // so every hip, valley and the turret cone falls out of one distance field; lower roofs rise against the upper
  // storey and stop under it
  function roof(region, high, base, maxK, tag, extra) {
    const reg = new Uint8Array(N);
    for (let k = 0; k < N; k++) reg[k] = region[k];
    const dOut = chamfer(reg);                              // eave: 8 cells out from the roofed region
    const eave = new Uint8Array(N);
    for (let k = 0; k < N; k++) eave[k] = reg[k] || (!high[k] && dOut[k] <= 8 && spiK[k] < 0) ? 1 : 0;
    const seed = new Uint8Array(N);
    for (let k = 0; k < N; k++) seed[k] = eave[k] || high[k] ? 0 : 1;
    const d = chamfer(seed);
    for (let c = 0; c < maxK; c++) {
      const L = lab();
      let any = 0;
      for (let k = 0; k < N; k++) if (eave[k] && !high[k] && d[k] >= 1 + c * 5) { L[k] = 1; any = 1; }
      if (!any) break;
      const col = shade(ROOF[c % 3], 0.96 + rnd() * 0.04);
      mesh(L, base + c * 4, base + c * 4 + 4, () => ({ color: col }), tag, extra);
    }
  }
  {
    const r1 = new Uint8Array(N), r2 = new Uint8Array(N), hi1 = new Uint8Array(N), none = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (P2.fp[k] || P2.wall[k] || P2.rail[k]) { hi1[k] = 1; if (P2.fp[k] && P2.kind[k] !== 2 && !(spiK[k] >= 0)) r2[k] = 1; }
      else if (P1.fp[k] && !holeF2[k]) r1[k] = 1;
      if (sky[k] && !P2.wall[k] && !P2.rail[k]) hi1[k] = 0;
    }
    roof(r1, hi1, FL2, 24, 'roof 1', P2.fp);
    roof(r2, none, TOP2 + 10, 30, 'roof 2');
  }

  flush();

  // -------------------------------------------- loggia columns round the pool --
  {
    const pick = [];
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      if (!lanai[k] || sky[k] || P1.wall[k]) continue;
      if (!(sky[k + 1] || sky[k - 1] || sky[k + NX] || sky[k - NX])) continue;
      const x = cx(i), y = cy(j);
      if (pick.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 70 * 70)) continue;
      pick.push([x, y]);
    }
    for (const [x, y] of pick) {
      const px = Math.round(x / 2) * 2, py = Math.round(y / 2) * 2;
      if (B.free([px - 10, py - 10, FL1], [px + 10, py + 10, TOP1])) B.add({ asset: 'PB_DefaultMicroBrick', size: [8, 8, (TOP1 - FL1) / 2], position: [px, py, (FL1 + TOP1) / 2], color: WHITE }, 'column');
    }
    stats.columns = pick.length;
  }
  return { bricks: B.bricks, dropped: B.dropped, stats };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const t0 = Date.now(), { bricks, dropped, stats } = brynwood();
  const ai = process.argv.indexOf('--at'), at = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [0, 0];
  const by = {};
  for (const d of dropped) { const t = d.split(' [[')[0] + ' x ' + (d.split(' hits ')[1] ?? '').split(' [[')[0]; by[t] = (by[t] ?? 0) + 1; }
  console.error(by);
  console.error(`brynwood: ${bricks.length} bricks (${stats.w} wedges), ${stats.drop} dropped, ${stats.columns} columns, ${Date.now() - t0} ms`);
  for (const d of dropped.slice(0, 12)) console.error('  ' + d);
  const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (out) {
    const owner = { id: 'c1770000-0000-4b0b-9a11-0000004453b0', name: 'Brynwood Estate', display_name: 'Brynwood Estate' };
    const bs = bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + at[0], b.position[1] + at[1], b.position[2]] }));
    fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner, captureMs: 15000, bricks: bs }] }));
  }
}
