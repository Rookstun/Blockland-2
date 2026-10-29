// 718 White Tail Ridge Dr, Fairlawn (Akron) OH 44333 (2026-10-28, owner: Zillow zpid 35332899, 'design and build
// this house'). 1992 custom all-brick "Georgian Colonial" (really a 90s brick traditional): steep shingle roofs,
// a tall brick entry gable with an arched open portal in front of a two-storey foyer, tan stucco gable fronts with
// arched windows, a first-floor owner's suite + office wing on the left, a 3-car side-loading garage on the right,
// a covered back terrace, a finished lower level (rec room, bar, gym). 4,424 sq ft.
// Plans = the listing's Zillow 3D Home blueprint (view-imx page __NEXT_DATA__ blueprintJson), compact in
// refs/whitetail_bp.json (+ fixtures, stair rooms). Floors in their own frames: Floor 2 +2.85,-1.08 m (its walls
// land on the kitchen / garage-back / dining walls), Basement -2.463,-2.607 m (the breakfast bay chamfers match).
// Same raster pipeline as witherspoon.mjs: walls on a 2-unit grid, a z profile per column, equal columns merged;
// roofs = the georgian.mjs height field. Arched heads: every outside window gets a segmental arch (glass follows
// it), the entry portal a full round arch. Grade = 96 all round (the basement is buried; the lot is a pad with a
// wedge rim). 1 stud = 1 ft. Front of the house = +y, garage at +x (left-handed world: on the right from the street).
//   whitetail() -> { bricks }      node mapgen/whitetail.mjs [out.json]
import fs from 'fs';
import { makeBuilder } from './builder.mjs';
import { orientFor } from './orient.mjs';

const BP = JSON.parse(fs.readFileSync(new URL('./refs/whitetail_bp.json', import.meta.url)));
const FT = 32.808, MX = -11.9, MY = -13.0;
const X = m => Math.round((m - MX) * FT / 2) * 2, Y = m => Math.round((m - MY) * FT / 2) * 2;
const OFF = { 'Floor 1': [0, 0], 'Floor 2': [2.85, -1.08], Basement: [-2.463, -2.607] };
// z: basement slab 0..12, walls 12..96 | floor-1 slab 96..108, walls 108..196, ceiling 196..200 | floor-2 slab
// 196..216, walls 216..300, ceiling 300..304 | garage slab 96..100
const ZB = 12, F1 = 108, C1 = 196, F2 = 216, C2 = 300, GF = 100, GRADE = 96;
const R = 2, GX0 = -210, GY0 = -210, NX = 640, NY = 610, N = NX * NY;

const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const BRICK = [164, 88, 62], STUCCO = [214, 196, 160], ROOF = [98, 90, 84], TRIM = [236, 232, 222];
const MATS = {
  BR0: { color: BRICK }, BR1: { color: shade(BRICK, 0.92) }, SC0: { color: STUCCO }, SC1: { color: shade(STUCCO, 0.96) },
  PL: { color: [232, 226, 214] }, CE: { color: [242, 240, 236] }, GL: { color: [170, 210, 230], material: 'BMC_Glass' },
  CO: { color: [168, 166, 160] }, GR: { color: [84, 122, 58] }, WO: { color: [150, 92, 60] }, CA: { color: [196, 186, 168] },
  TI: { color: [214, 214, 208] }, GD: { color: [236, 234, 228] }, ST: { color: [176, 170, 158] }, TR: { color: TRIM },
  DR: { color: [104, 30, 36] }, DK: { color: [118, 84, 60] },
};
const floorMat = t => /garage/i.test(t) ? 'CO' : /porch/i.test(t) ? 'ST' : /kitchen|bath|laundry|pantry|bar|foyer|entry/i.test(t) ? 'TI'
  : /bed|closet|office|gym/i.test(t) ? 'CA' : /unfinished/i.test(t) ? 'CO' : 'WO';

function pip(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const cx = i => GX0 + i * R + 1, cy = j => GY0 + j * R + 1;
function eachCell(x0, y0, x1, y1, f) {
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
const rectP = ([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
const M = ([x0, y0, x1, y1]) => [X(x0), Y(y0), X(x1), Y(y1)];   // a metre rect in the F1 frame -> units

// one floor's plan in the frame: footprint, floor material per cell, walls (wk 1 interior / 2 exterior, skin,
// opening kind + arch rise per cell, glass band), solid (fireplaces), the garage room
function plan(name, extraWalls = []) {
  const f = BP.find(q => q.name === name), [ox, oy] = OFF[name];
  const T = ([x, y]) => [X(x + ox), Y(y + oy)];
  const fpM = f.footprint, fp = fpM.map(T);
  const fpMask = polyMask(fp);
  const mat = new Array(N).fill(null), solid = new Uint8Array(N), gar = new Uint8Array(N);
  for (const r of f.rooms) {
    const P = r.poly.map(T);
    if (r.type === 'inaccessible') { polyMask(P, solid); continue; }
    if (r.type === 'garage') polyMask(P, gar);
    const txt = f.notes.filter(n => n.room === r.id && !n.vs).map(n => n.text).join(' ') || (r.type === 'unfinished' ? 'unfinished' : r.type === 'garage' ? 'garage' : 'hall');
    const m = floorMat(txt);
    const [x0, y0, x1, y1] = bbox(P);
    eachCell(x0, y0, x1, y1, (k, x, y) => { if (pip(P, x, y)) mat[k] = m; });
  }
  for (const n of f.notes) if (n.vs) {
    const P = n.vs.map(T), m = floorMat(n.text), [x0, y0, x1, y1] = bbox(P);
    eachCell(x0, y0, x1, y1, (k, x, y) => { if (pip(P, x, y)) mat[k] = m; });
  }
  const wk = new Uint8Array(N), skin = new Uint8Array(N), core = new Uint8Array(N), op = new Uint8Array(N), arch = new Uint8Array(N), glass = new Uint8Array(N), hit = new Uint8Array(N);
  const OPK = { door: 1, window: 2, garage: 3, porch: 4 };
  const walls = f.walls.filter(w => w.t >= 0.05).map(w => ({ s: w.s, k: w.k }));
  for (const w of [...walls, ...extraWalls]) {
    const [a, b] = w.s;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.01) continue;
    let nx = -dy / L, ny = dx / L, ext = w.out != null;
    if (ext) [nx, ny] = w.out;
    else {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const i1 = pip(fpM, mx + nx * 0.3, my + ny * 0.3), i2 = pip(fpM, mx - nx * 0.3, my - ny * 0.3);
      if (i1 !== i2) { ext = true; if (i1) { nx = -nx; ny = -ny; } }
    }
    const A = T(a), Bp = T(b), ux = (Bp[0] - A[0]) / (L * FT), uy = (Bp[1] - A[1]) / (L * FT), LL = L * FT;
    const s0 = -3, s1 = ext ? 7 : 3, e = ext ? 7 : 3;
    // a door wider than 2 m in an outside wall = an overhead garage door
    const opsU = w.k.map(o => { const c = T(o.c); return { u: (c[0] - A[0]) * ux + (c[1] - A[1]) * uy, hw: o.w * FT / 2, kind: o.type === 'door' && ext && o.w > 2 ? 3 : OPK[o.type] }; });
    const ex = [A[0], Bp[0]], ey = [A[1], Bp[1]];
    eachCell(Math.min(...ex) - 8, Math.min(...ey) - 8, Math.max(...ex) + 8, Math.max(...ey) + 8, (k, x, y) => {
      const rx = x - A[0], ry = y - A[1], u = rx * ux + ry * uy, s = rx * nx + ry * ny;
      if (u < -e || u > LL + e || s < s0 || s >= s1) return;
      wk[k] = Math.max(wk[k], ext ? 2 : 1);
      if (ext && s >= 3) skin[k] = 1; else core[k] = 1;
      const o = u > 0 && u < LL && opsU.find(q => Math.abs(u - q.u) < q.hw);
      if (!o) { hit[k] = 1; return; }
      if (!op[k]) {
        op[k] = o.kind; glass[k] = ext ? (s >= 1 && s < 3) : (s >= -1 && s < 1);
        // arch rise over the opening's square head at this column: segmental on windows (<= 14), round on the portal
        const t = Math.sqrt(Math.max(0, 1 - ((u - o.u) / o.hw) ** 2));
        arch[k] = ext && o.kind === 2 ? Math.round(Math.min(14, o.hw * 0.5) * t / 2) * 2 : o.kind === 4 ? Math.round(o.hw * t / 2) * 2 : 0;
      }
    });
  }
  // outside the footprint an exterior wall is all skin
  for (let k = 0; k < N; k++) { if (hit[k]) op[k] = 0; if (wk[k] === 2 && !fpMask[k]) skin[k] = 1; else if (core[k]) skin[k] = 0; }
  return { f, fp, fpMask, mat, solid, gar, wk, skin, op, arch, glass, T };
}

export function whitetail() {
  const B = makeBuilder();
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', ...m }, label)) throw new Error(`whitetail: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  // roof pieces are soft: an overhang tile over a neighbouring wing's ceiling is skipped (counted in roofSkips)
  let roofSkips = 0;
  const soft = (b, label) => { if (!B.add(b, label)) roofSkips++; };
  const piece = (asset, ups, ext, pos, color, label) => {
    if (!B.add({ asset, ...orientFor(asset, ups, ext), color, position: pos }, label)) throw new Error(`whitetail: ${label} dropped: ${B.dropped.at(-1)}`);
  };

  // ------------------------------------------------------------------ plans --
  // the entry portal: a brick wall across the front of the entry recess (x -4.886..-2.21, y 2.13..5.01) with a
  // round-arched opening; the recess floor is a stone porch at floor level
  const portal = { s: [[-4.886, 4.95], [-2.21, 4.95]], out: [0, 1], k: [{ type: 'porch', c: [-3.548, 4.95], w: 1.7 }] };
  const RECESS = [X(-4.886) + 4, Y(2.129) + 4, X(-2.21) - 4, Y(4.95) - 4];
  const PB = plan('Basement'), P1 = plan('Floor 1', [portal]), P2 = plan('Floor 2');
  const recMask = polyMask(rectP(RECESS));
  const l2occ = new Uint8Array(N);
  for (let k = 0; k < N; k++) l2occ[k] = P2.fpMask[k] || P2.wk[k] ? 1 : 0;
  // the two-storey foyer (behind the portal, left of floor 2): its walls run to the tower roof, no ceiling
  const FOY = M([-4.95, -2.65, -2.15, 2.2]);
  const foyer = (x, y) => inRect(x, y, FOY);

  // ----------------------------------------------------------------- stairs --
  // up: the plan's stair band (y -2.592..-1.492), rising +x to floor 2's stairwell edge (x 0.385): 9 risers of 12
  // on 12-deep treads, each tread a 12-thick slab so the basement flight runs under it; down: 8 risers from the
  // floor-1 landing at x 0.308 back down toward -x (lands at the basement's stair room, x -2.4)
  const SY0 = Y(-2.592), SY1 = Y(-1.492), UT = X(0.385), U0 = UT - 108, DT = X(0.308), D0 = DT - 96;
  const keep = {
    B: [{ r: [D0 - 36, SY0 - 4, DT + 4, SY1 + 4], walls: 1 }],
    L1: [{ r: [D0, SY0, DT, SY1], slab: 1, walls: 1 }, { r: [U0 - 30, SY0 - 4, UT + 34, SY1 + 4], walls: 1 },
      { r: [U0, SY0, UT, SY1], ceil: 1 }],
    L2: [{ r: [U0, SY0, UT, SY1], walls: 1, slab: 1 }],
  };
  const kept = (L, x, y, what) => keep[L].some(q => q[what] && inRect(x, y, q.r));

  // ------------------------------------------------------------------ roofs --
  // height-field roofs on the stud grid (georgian.mjs): tile (tx, ty) = x tx..tx+10, y ty..ty+10; steep (rise 10
  // per stud) like the photos; gable = ridge along y (gable ends face front/back)
  const r10 = v => Math.round(v / 10) * 10;
  const rr = (m, pad = 10) => { const [a, b, c, d] = M(m); return [r10(a) - pad, r10(b) - pad, r10(c) + pad, r10(d) + pad]; };
  const CHK = [r10(X(0.42)), r10(Y(-6.06)), 30, 50];      // kitchen / living double fireplace stack
  const CHO = [r10(X(-9.848)) - 40, r10(Y(1.66)), 30, 50];  // office fireplace, outside chimney on the left end
  const inCh = (x, y) => [CHK, CHO].find(([a, b, w, l]) => x >= a && x < a + w && y >= b && y < b + l);
  const chTop = c => c === CHO ? 300 : 480;
  const roofs = [
    { id: 'upper', rect: rr([-2.27, -7.74, 8.09, 5.17]), eave: 308, rise: 10, body: [M([-2.27, -7.74, 8.09, 5.17])] },
    { id: 'tower', rect: rr([-4.886, -2.65, -2.21, 4.95], 14), eave: 308, rise: 10, gable: true, body: [M([-4.886, -2.65, -2.21, 4.95])] },
    { id: 'front gable', rect: rr([-2.21, -1, 1.666, 4.214]), eave: 308, rise: 10, gable: true, body: [] },
    { id: 'garage', rect: rr([3.57, -0.856, 10.464, 9.051]), eave: 204, rise: 10, gable: true, body: [M([3.57, -0.856, 10.464, 9.051])] },
    { id: 'left', rect: rr([-9.848, -9.627, -4.886, 5.013]), eave: 204, rise: 10, body: [M([-9.848, -9.627, -4.886, 5.013])] },
    { id: 'suite bay', rect: rr([-11.419, -4.173, -9.848, 0.423]), eave: 204, rise: 10, body: [M([-11.419, -4.173, -9.848, 0.423])] },
    { id: 'back', rect: rr([-5.386, -12.638, 7.695, -2.4]), eave: 204, rise: 10, body: [M([-5.386, -12.638, 7.695, -2.4])] },
  ];
  function heightAt(d, x, y) {
    const [x0, y0, x1, y1] = d.rect;
    const k = d.gable ? Math.min(x - x0, x1 - x) : Math.min(x - x0, x1 - x, y - y0, y1 - y);
    return d.eave + d.rise * k / 10;
  }
  const tiles = new Map(), tkey = (x, y) => x * 100000 + y;
  {
    const xs = roofs.flatMap(d => [d.rect[0], d.rect[2]]), ys = roofs.flatMap(d => [d.rect[1], d.rect[3]]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 10) for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) {
      if (inCh(x, y)) continue;
      const cand = [];
      for (const d of roofs) {
        const [x0, y0, x1, y1] = d.rect;
        if (x < x0 || x + 10 > x1 || y < y0 || y + 10 > y1) continue;
        const h = [[0, 0], [10, 0], [0, 10], [10, 10]].map(([a, b]) => heightAt(d, x + a, y + b));
        cand.push({ d, h, top: Math.max(...h), base: Math.min(...h), mean: h.reduce((s, v) => s + v, 0) });
      }
      if (!cand.length) continue;
      cand.sort((a, b) => b.top - a.top || b.mean - a.mean);
      const T = cand[0], keepR = [T];
      for (const c of cand.slice(1)) {
        if (T.d.body.some(Rr => inRect(x, y, Rr))) continue;
        const last = keepR.at(-1);
        if (c.top <= last.base - last.d.rise) keepR.push(c);   // stacked under every roof already kept
      }
      tiles.set(tkey(x, y), keepR.map(c => ({ ...c, x, y })));
    }
  }
  const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function capOf(t) {
    const lo = t.base, hi = t.top, dd = hi - lo;
    if (!dd) return { base: lo, cap: null };
    const up = t.h.map(v => v - lo >= dd / 2), n = up.filter(Boolean).length;
    if (n === 1) { const [sx, sy] = CORNER[up.indexOf(true)]; return { base: lo, cap: ['PB_DefaultMicroWedgeCorner', [[sx, 0], [0, sy]], dd] }; }
    if (n === 3) { const [lx, ly] = CORNER[up.indexOf(false)]; return { base: lo, cap: ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]], dd] }; }
    const [a, b] = up.map((u, k) => (u ? k : -1)).filter(k => k >= 0);
    const [ax, ay] = CORNER[a], [bx, by] = CORNER[b];
    if (ax === bx) return { base: lo, cap: ['PB_DefaultMicroWedge', [[ax, 0]], dd] };
    if (ay === by) return { base: lo, cap: ['PB_DefaultMicroWedge', [[0, ay]], dd] };
    return { base: hi, cap: null };
  }
  const capBase = t => (t._c ??= capOf(t)).base;
  const roofBottom = (x, y) => { const L = tiles.get(tkey(Math.floor(x / 10) * 10, Math.floor(y / 10) * 10)); return L ? Math.min(...L.map(t => capBase(t) - t.d.rise)) : null; };

  // --------------------------------------------------------------- columns --
  const ids = new Map(), profs = [null];
  const intern = p => {
    if (!p || !p.length) return 0;
    const key = p.map(s => s.join(',')).join(';');
    let id = ids.get(key);
    if (id == null) { id = profs.push(p) - 1; ids.set(key, id); }
    return id;
  };
  // solid [z0, z1) minus openings; outside skin in brick courses of 12, tan stucco above the floor-2 ceiling (gables)
  function wallRuns(z0, z1, holes, skinMode, out) {
    let runs = [[z0, z1]];
    for (const [h0, h1] of holes) runs = runs.flatMap(([a, b]) => (h1 <= a || h0 >= b) ? [[a, b]] : [...(h0 > a ? [[a, h0]] : []), ...(h1 < b ? [[h1, b]] : [])]);
    for (const [a, b] of runs) {
      if (!skinMode) { out.push([a, b, 'PL']); continue; }
      let z = a;
      while (z < b) {
        const sc = z >= C2 + 4, step = sc ? 8 : 12;
        let n = Math.min(b, (Math.floor(z / step) + 1) * step);
        if (!sc && n > C2 + 4) n = C2 + 4;
        out.push([z, n, sc ? (Math.floor(z / 8) % 2 ? 'SC1' : 'SC0') : (Math.floor(z / 12) % 2 ? 'BR1' : 'BR0')]);
        z = n;
      }
    }
  }
  // opening heights: door 70, window sill 24 head 66 (+ arch), garage door 84, portal 100 + its round head
  const OPZ = (F, kind, a) => kind === 1 ? [F, F + 70] : kind === 2 ? [F + 24, F + 66 + a] : kind === 3 ? [F, F + 84] : [F, F + 100 + a];
  function wallColumn(P, k, x, y, { slab0, F, top, skinMode }) {
    const out = [], ext = P.wk[k] === 2, isSkin = P.skin[k];
    const holes = [];
    if (P.op[k]) {
      const [h0, h1] = OPZ(F, P.op[k], P.arch[k]);
      holes.push([h0, h1]);
      if (P.glass[k] && P.op[k] === 2) out.push([h0, h1, 'GL']);
      if (P.glass[k] && P.op[k] === 3) out.push([h0, h1, 'GD']);
      // white keystone sill under outside windows
      if (ext && isSkin && P.op[k] === 2) { out.push([h0 - 4, h0, 'TR']); holes.push([h0 - 4, h0]); }
    }
    if (ext && isSkin) wallRuns(slab0, top, holes, skinMode, out);
    else { out.push([slab0, F, 'CE']); wallRuns(F, top, holes, null, out); }
    return out.map(([a, b, m]) => [a, Math.min(b, top), m]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  }
  function layer(L, P, cfg) {
    const id = new Int32Array(N);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, x = cx(i), y = cy(j);
      const p = cfg.column(k, x, y);
      if (p) id[k] = intern(p);
    }
    merge(id, L);
  }
  function merge(id, label) {
    const seen = new Uint8Array(N), MAXC = 250;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, v = id[k];
      if (!v || seen[k]) continue;
      let w = 1; while (i + w < NX && w < MAXC && !seen[k + w] && id[k + w] === v) w++;
      let h = 1;
      grow: while (j + h < NY && h < MAXC) { for (let a = 0; a < w; a++) { const q = (j + h) * NX + i + a; if (seen[q] || id[q] !== v) break grow; } h++; }
      for (let b = 0; b < h; b++) seen.fill(1, (j + b) * NX + i, (j + b) * NX + i + w);
      const x0 = GX0 + i * R, y0 = GY0 + j * R, x1 = x0 + w * R, y1 = y0 + h * R;
      for (const [z0, z1, m] of profs[v]) box(x0, y0, z0, x1, y1, z1, MATS[m], label);
    }
  }

  // basement: slab 0..12, walls 12..96 (all under floor 1)
  layer('basement', PB, {
    column(k, x, y) {
      if (!PB.fpMask[k] && !PB.wk[k]) return null;
      if (PB.wk[k] && !kept('B', x, y, 'walls')) return wallColumn(PB, k, x, y, { slab0: 0, F: ZB, top: GRADE, skinMode: null });
      const out = [[0, 8, 'CO'], [8, ZB, PB.mat[k] ?? 'CO']];
      if (PB.solid[k] && !kept('B', x, y, 'walls')) wallRuns(ZB, GRADE, [], 'brick', out);
      return out;
    },
  });
  // floor 1 (+ the stone porch in the entry recess); garage on its own slab at 100, open to the rafters
  layer('floor 1', P1, {
    column(k, x, y) {
      const ch = inCh(x, y);
      if (ch) { const out = []; for (let z = GRADE; z < chTop(ch); z += 12) out.push([z, Math.min(chTop(ch), z + 12), (z / 12) % 2 ? 'BR1' : 'BR0']); return out; }
      const inFp = P1.fpMask[k];
      if (!inFp && !P1.wk[k]) return recMask[k] ? [[GRADE, F1, 'ST']] : null;
      const under2 = l2occ[k], gar = P1.gar[k], foy = foyer(x, y) && !under2;
      if (P1.wk[k] && !kept('L1', x, y, 'walls')) {
        const ext = P1.wk[k] === 2, rb = roofBottom(x, y);
        const top = under2 ? C1 : foy ? (rb ?? C2 + 4) : ext || gar ? (rb ?? 204) : C1;
        return wallColumn(P1, k, x, y, { slab0: GRADE, F: gar ? GF : F1, top, skinMode: 'brick' });
      }
      if (gar) return [[GRADE, GF, 'CO']];
      const out = [];
      if (!kept('L1', x, y, 'slab')) out.push([GRADE, F1 - 4, 'CE'], [F1 - 4, F1, P1.mat[k] ?? 'WO']);
      if (P1.solid[k] && !kept('L1', x, y, 'walls')) wallRuns(F1, C1, [], 'brick', out);
      if (!under2 && !foy && !kept('L1', x, y, 'ceil')) out.push([C1, C1 + 4, 'CE']);
      return out.length ? out : null;
    },
  });
  // floor 2: full storey, ceiling 300..304, outside walls up to the roof (stucco in the gables)
  layer('floor 2', P2, {
    column(k, x, y) {
      if (inCh(x, y) || (!P2.fpMask[k] && !P2.wk[k])) return null;
      const rb = roofBottom(x, y);
      if (P2.wk[k] && !kept('L2', x, y, 'walls')) return wallColumn(P2, k, x, y, { slab0: C1, F: F2, top: P2.wk[k] === 2 ? rb ?? C2 + 4 : Math.min(C2 + 4, rb ?? C2 + 4), skinMode: 'brick' });
      const out = kept('L2', x, y, 'slab') ? [] : [[C1, C1 + 4, 'CE'], [C1 + 4, F2 - 4, 'CE'], [F2 - 4, F2, P2.mat[k] ?? 'CA']];
      if (P2.solid[k]) wallRuns(F2, C2, [], 'brick', out);
      if (rb == null || rb >= C2 + 4) out.push([C2, C2 + 4, 'CE']);
      return out;
    },
  });

  // ------------------------------------------------------------- lot pad --
  // grade 96 over the whole lot (the basement is buried), concrete drive + apron at the garage's side doors,
  // a brick-paver walk to the portal; a wedge rim drops the pad to 0 all round
  const LOT = [X(-11.42) - 110, Y(-12.64) - 110, X(10.464) + 240, Y(9.051) + 140];
  const APRON = [X(10.464) + 8, Y(-0.856), X(10.464) + 150, Y(9.051) + 30], DRIVE = [X(10.464) + 20, Y(9.051), X(10.464) + 130, LOT[3]];
  const WALK = [X(-3.95), Y(4.95) + 8, X(-3.15), LOT[3]];
  const padFree = k => !PB.fpMask[k] && !PB.wk[k];
  {
    const id = new Int32Array(N);
    eachCell(LOT[0], LOT[1], LOT[2] - 1, LOT[3] - 1, (k, x, y) => {
      if (!padFree(k) || !inRect(x, y, LOT)) return;
      const onFp = P1.fpMask[k] || P1.wk[k] || recMask[k];
      const steps = inRect(x, y, [WALK[0] - 10, Y(4.95) + 8, WALK[2] + 10, Y(4.95) + 20]);
      id[k] = intern(onFp ? [[0, GRADE, 'CO']] : steps ? [[0, GRADE + 6, 'ST']] : [[0, GRADE, inRect(x, y, APRON) || inRect(x, y, DRIVE) ? 'CO' : inRect(x, y, WALK) ? 'ST' : 'GR']]);
    });
    merge(id, 'pad');
  }
  {
    const h = GRADE, run = 100, [x0, y0, x1, y1] = LOT, G = MATS.GR.color, W = 'PB_DefaultMicroWedge', SEG = 400;
    for (let a = x0; a < x1; a += SEG) {
      const b = Math.min(x1, a + SEG);
      piece(W, [[0, 1]], [(b - a) / 2, run / 2, h / 2], [(a + b) / 2, y0 - run / 2, h / 2], G, 'rim');
      piece(W, [[0, -1]], [(b - a) / 2, run / 2, h / 2], [(a + b) / 2, y1 + run / 2, h / 2], G, 'rim');
    }
    for (let a = y0; a < y1; a += SEG) {
      const b = Math.min(y1, a + SEG);
      piece(W, [[1, 0]], [run / 2, (b - a) / 2, h / 2], [x0 - run / 2, (a + b) / 2, h / 2], G, 'rim');
      piece(W, [[-1, 0]], [run / 2, (b - a) / 2, h / 2], [x1 + run / 2, (a + b) / 2, h / 2], G, 'rim');
    }
    for (const [sx, sy] of CORNER) {
      const px = sx < 0 ? x0 - run / 2 : x1 + run / 2, py = sy < 0 ? y0 - run / 2 : y1 + run / 2;
      piece('PB_DefaultMicroWedgeCorner', [[-sx, 0], [0, -sy]], [run / 2, run / 2, h / 2], [px, py, h / 2], G, 'rim corner');
    }
  }

  // ----------------------------------------------------------- stair flights --
  const STAIR = [150, 92, 60];
  for (let c = 1; c <= 8; c++) box(D0 + 12 * (c - 1), SY0, ZB + 12 * (c - 1), DT, SY1, ZB + 12 * c, { color: shade(STAIR, c % 2 ? 1 : 0.94) }, 'down flight');
  for (let c = 1; c <= 9; c++) box(U0 + 12 * (c - 1), SY0, F1 + 12 * (c - 1), U0 + 12 * c, SY1, F1 + 12 * c, { color: shade(STAIR, c % 2 ? 1 : 0.94) }, 'up flight');

  // ----------------------------------------------------- portal + porch dressing --
  // stone steps from the portal down to the walk, lanterns either side of the arch, a red front door standing open
  for (const xl of [X(-4.3), X(-2.8) - 8]) { box(xl, Y(4.95) + 7, F1 + 50, xl + 8, Y(4.95) + 11, F1 + 66, { color: [30, 30, 32] }, 'lantern'); box(xl + 2, Y(4.95) + 11, F1 + 52, xl + 6, Y(4.95) + 13, F1 + 64, { color: [255, 226, 170], material: 'BMC_Glow', material_intensity: 3 }, 'lantern glow'); }
  // covered back terrace (x -5.36..0.31, y -12.61..-8.38): white columns + a brick knee wall, steps out the middle
  const PX0 = X(-5.36), PX1 = X(0.308), PY0 = Y(-12.613), PY1 = Y(-8.375), PM = (PX0 + PX1) / 2;
  const posts = [];
  for (let x = PX0; x <= PX1 - 10; x += Math.floor((PX1 - PX0 - 10) / 4 / 2) * 2) posts.push([x, PY0]);
  for (let y = PY0 + 50; y < PY1 - 50; y += 50) { posts.push([PX0, y]); posts.push([PX1 - 10, y]); }
  for (const [x, y] of posts) box(x, y, F1, x + 10, y + 10, C1, MATS.TR, 'porch column');
  const knee = (x0, y0, x1, y1) => { box(x0, y0, F1, x1, y1, F1 + 24, MATS.BR0, 'knee wall'); box(x0, y0, F1 + 24, x1, y1, F1 + 28, MATS.ST, 'knee cap'); };
  const pxs = posts.filter(p => p[1] === PY0).map(p => p[0]).sort((a, b) => a - b);
  for (let i = 0; i + 1 < pxs.length; i++) { const a = pxs[i] + 10, b = pxs[i + 1]; if (a < PM && b > PM) continue; knee(a, PY0 + 2, b, PY0 + 8); }
  box(r10(PM) - 30, PY0 - 14, GRADE, r10(PM) + 30, PY0, GRADE + 6, MATS.ST, 'terrace step');

  // ----------------------------------------------------------- chimneys --
  for (const c of [CHK, CHO]) box(c[0] - 2, c[1] - 2, chTop(c), c[0] + c[2] + 2, c[1] + c[3] + 2, chTop(c) + 4, MATS.ST, 'chimney cap');

  // ------------------------------------------------------------- room lights --
  for (const [P, zc] of [[PB, GRADE], [P1, C1], [P2, C2]]) for (const n of P.f.notes) {
    if (!n.at || /closet|stairs|fireplace|entry/i.test(n.text)) continue;
    const [x, y] = P.T(n.at), lx = Math.round(x / 2) * 2, ly = Math.round(y / 2) * 2;
    const z = P === P1 && foyer(x, y) ? 0 : zc;
    if (!z || (P === P1 && P1.gar[(Math.floor((ly - GY0) / R)) * NX + Math.floor((lx - GX0) / R)])) continue;
    B.box(lx - 8, ly - 8, z - 2, lx + 8, ly + 8, z, { asset: 'PB_DefaultMicroBrick', color: [255, 240, 210], material: 'BMC_Glow', material_intensity: 4 }, 'ceiling light');   // a light on a wall is skipped
  }

  // ------------------------------------------------------------- roof build --
  for (const d of roofs) {
    const mine = new Map();
    for (const L of tiles.values()) for (const t of L) if (t.d === d) mine.set(tkey(t.x, t.y), t);
    const [rx0, ry0, rx1, ry1] = d.rect;
    const lipColor = t => (t.x === rx0 || t.x + 10 === rx1 || t.y === ry0 || t.y + 10 === ry1) ? TRIM : shade(ROOF, 0.7);
    const capColor = t => shade(ROOF, [1, 0.94, 1.05][Math.round((capBase(t) - d.eave) / d.rise) % 3]);
    const used = new Set();
    for (const t of mine.values()) {
      if (used.has(tkey(t.x, t.y))) continue;
      const c0 = lipColor(t).join(), b0 = capBase(t);
      const same = (a, b) => { const o = mine.get(tkey(t.x + a * 10, t.y + b * 10)); return o && !used.has(tkey(o.x, o.y)) && capBase(o) === b0 && lipColor(o).join() === c0; };
      let l = 1; while (l < 40 && same(0, l)) l++;
      let w = 1; grow: while (w < 40) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) used.add(tkey(t.x + a * 10, t.y + b * 10));
      if (!B.box(t.x, t.y, b0 - d.rise, t.x + w * 10, t.y + l * 10, b0, { asset: 'PB_DefaultMicroBrick', color: lipColor(t) }, d.id + ' roof lip')) roofSkips++;
    }
    const usedC = new Set();
    const ckey = t => { const c = t._c.cap; return c && c[0] + c[1].join(';') + c[2] + '|' + t._c.base; };
    for (const t of mine.values()) {
      const k0 = tkey(t.x, t.y);
      if (!t._c.cap || usedC.has(k0)) continue;
      const [asset, dirs, dz] = t._c.cap;
      let len = 1, px = 0, py = 0;
      if (asset === 'PB_DefaultMicroWedge') {
        [px, py] = dirs[0][0] ? [0, 1] : [1, 0];
        while (len < 40) { const o = mine.get(tkey(t.x + px * len * 10, t.y + py * len * 10)); if (!o || usedC.has(tkey(o.x, o.y)) || ckey(o) !== ckey(t)) break; len++; }
      }
      for (let m = 0; m < len; m++) usedC.add(tkey(t.x + px * m * 10, t.y + py * m * 10));
      const ext = [px ? len * 5 : 5, py ? len * 5 : 5, dz / 2];
      soft({ asset, ...orientFor(asset, dirs, ext), color: capColor(t), position: [t.x + ext[0], t.y + ext[1], t._c.base + dz / 2] }, d.id + ' roof');
    }
  }

  const bricks = B.bricks.map(({ label, ...b }) => b);
  return { bricks, count: bricks.length, lot: LOT, roofSkips };
}

if (process.argv[1]?.endsWith('whitetail.mjs')) {
  const out = process.argv[2] ?? 'whitetail.json', h = whitetail();
  fs.writeFileSync(out, JSON.stringify({ bricks: h.bricks }));
  console.error(`whitetail: ${h.count} bricks, lot ${h.lot.join(',')}, roof pieces skipped ${h.roofSkips}`);
}
