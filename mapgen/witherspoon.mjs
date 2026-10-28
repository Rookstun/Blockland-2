// 25428 Witherspoon St, Farmington Hills MI 48335 (2026-10-27, owner: Zillow zpid 24570706, 'research house then
// build'). 1979 contemporary ranch, 1.5 storeys over a finished WALKOUT basement (8,399 sq ft, 8 bed): red-brown
// brick ground floor, tan vertical-board siding on the gables and the raised kitchen-side block, dark shingle hip
// roofs, two-car garage projecting at the front right with its doors facing the entry court, recessed entry
// under its own front gable, circular drive, rear deck off the breakfast nook.
// Plans = the listing's Zillow 3D Home blueprint (view-imx page __NEXT_DATA__ blueprintJson: per floor walls with
// door/window children, rooms, labels, metres), saved compact in refs/witherspoon_bp.json. The three floors come
// in their own frames: Basement +0.35,+0.2 m (matched on the fireplace + stair), Floor 2 +7.9 m x (the raised
// block's ridge on the aerial photo). Garage + porch are not in the plans (built from the photos).
// Walls are rasterised on a 2-unit grid (diagonal bays come out as fine steps), every column gets a z profile
// (slab, brick / siding courses, plaster core, glass, openings) and equal columns merge into boxes. Roofs = the
// georgian.mjs height field. The front + sides are bermed up to the ground floor; the back is the walkout.
// 1 stud = 1 ft. Frame: front of the house = +y (plan y), garage at +x (world is left-handed: from the street,
// looking -y, +x is on the right, like the photo).
//   witherspoon() -> { bricks }      node mapgen/witherspoon.mjs [out.json]
import fs from 'fs';
import { makeBuilder } from './builder.mjs';
import { orientFor } from './orient.mjs';

const BP = JSON.parse(fs.readFileSync(new URL('./refs/witherspoon_bp.json', import.meta.url)));
const FT = 32.808, MX = -12.3, MY = -8.8;
const X = m => Math.round((m - MX) * FT / 2) * 2, Y = m => Math.round((m - MY) * FT / 2) * 2;
const OFF = { 'Floor 1': [0, 0], 'Floor 2': [7.9, 0], Basement: [0.35, 0.2] };
// z: basement slab 0..12, walls 12..96 | floor-1 slab 96..108, walls 108..196, ceiling 196..200 | floor-2 slab
// 196..216, walls up to the roof | garage slab 96..100 on the berm (grade at the front = 96)
const ZB = 12, F1 = 108, C1 = 196, F2 = 216, GF = 100, GRADE = 96;
const R = 2, GX0 = -300, GY0 = -100, NX = 700, NY = 720, N = NX * NY;

const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const BRICK = [146, 82, 62], SIDING = [190, 152, 104], ROOF = [74, 74, 78], TRIM = [104, 74, 50];
const MATS = {
  BR0: { color: BRICK }, BR1: { color: shade(BRICK, 0.92) }, SD0: { color: SIDING }, SD1: { color: shade(SIDING, 0.93) },
  PL: { color: [232, 226, 214] }, CE: { color: [242, 240, 236] }, GL: { color: [170, 210, 230], material: 'BMC_Glass' },
  CO: { color: [168, 166, 160] }, GR: { color: [84, 122, 58] }, WO: { color: [170, 120, 76] }, CA: { color: [200, 188, 166] },
  TI: { color: [214, 214, 208] }, GD: { color: [122, 84, 64] }, DK: { color: [138, 102, 70] }, ST: { color: [150, 144, 132] },
};
const floorMat = t => /kitchen|bath|laundry|pantry|nook/i.test(t) ? 'TI' : /bed|bonus|closet/i.test(t) ? 'CA' : /unfinished/i.test(t) ? 'CO' : 'WO';

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

// one floor's plan in the frame: footprint, floor material per cell, walls (wk 1 interior / 2 exterior, skin,
// opening kind, glass band), solid (fireplaces)
function plan(name, extraWalls = [], addWins = null, onlyExtra = false) {
  const f = BP.find(q => q.name === name), [ox, oy] = OFF[name];
  const T = ([x, y]) => [X(x + ox), Y(y + oy)];
  const fpM = f.footprint, fp = fpM.map(T);
  const fpMask = polyMask(fp);
  const mat = new Array(N).fill(null), solid = new Uint8Array(N);
  for (const r of f.rooms) {
    const P = r.poly.map(T);
    if (r.type === 'inaccessible') { polyMask(P, solid); continue; }
    const txt = f.notes.filter(n => n.room === r.id && !n.vs).map(n => n.text).join(' ') || (r.type === 'unfinished' ? 'unfinished' : 'hall');
    const m = floorMat(txt);
    const [x0, y0, x1, y1] = bbox(P);
    eachCell(x0, y0, x1, y1, (k, x, y) => { if (pip(P, x, y)) mat[k] = m; });
  }
  for (const n of f.notes) if (n.vs) {
    const P = n.vs.map(T), m = floorMat(n.text), [x0, y0, x1, y1] = bbox(P);
    eachCell(x0, y0, x1, y1, (k, x, y) => { if (pip(P, x, y)) mat[k] = m; });
  }
  const wk = new Uint8Array(N), skin = new Uint8Array(N), core = new Uint8Array(N), op = new Uint8Array(N), glass = new Uint8Array(N), hit = new Uint8Array(N);
  const OPK = { door: 1, window: 2, garage: 3, porch: 4 };
  const walls = onlyExtra ? [] : f.walls.filter(w => w.t >= 0.05).map(w => ({ s: w.s, k: w.k }));
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
    const ops = [...w.k];
    if (ext && addWins) ops.push(...addWins(a, b, nx, ny, L, ops));
    const opsU = ops.map(o => { const c = T(o.c); return { u: (c[0] - A[0]) * ux + (c[1] - A[1]) * uy, hw: o.w * FT / 2, kind: OPK[o.type] }; });
    const ex = [A[0], Bp[0]], ey = [A[1], Bp[1]];
    eachCell(Math.min(...ex) - 8, Math.min(...ey) - 8, Math.max(...ex) + 8, Math.max(...ey) + 8, (k, x, y) => {
      const rx = x - A[0], ry = y - A[1], u = rx * ux + ry * uy, s = rx * nx + ry * ny;
      if (u < -e || u > LL + e || s < s0 || s >= s1) return;
      wk[k] = Math.max(wk[k], ext ? 2 : 1);
      if (ext && s >= 3) skin[k] = 1; else core[k] = 1;
      const o = u > 0 && u < LL && opsU.find(q => Math.abs(u - q.u) < q.hw);
      if (!o) { hit[k] = 1; return; }
      if (!op[k]) { op[k] = o.kind; glass[k] = ext ? (s >= 1 && s < 3) : (s >= -1 && s < 1); }
    });
  }
  // outside the footprint an exterior wall is all skin (bay corners showed their plaster core)
  for (let k = 0; k < N; k++) { if (hit[k]) op[k] = 0; if (wk[k] === 2 && !fpMask[k]) skin[k] = 1; else if (core[k]) skin[k] = 0; }
  return { fp, fpMask, mat, solid, wk, skin, op, glass, T };
}

export function witherspoon() {
  const B = makeBuilder();
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', ...m }, label)) throw new Error(`witherspoon: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const piece = (asset, ups, ext, pos, color, label) => {
    if (!B.add({ asset, ...orientFor(asset, ups, ext), color, position: pos }, label)) throw new Error(`witherspoon: ${label} dropped: ${B.dropped.at(-1)}`);
  };

  // ------------------------------------------------------------------ plans --
  // garage (photos): x 3.76..11.43, y 7.91..15.9 m; two 8 ft doors in its west face, a window front + east
  const GAR = [X(3.76), Y(7.91), X(11.43), Y(15.9)];
  const garWalls = [
    { s: [[3.76, 7.91], [3.76, 15.9]], out: [-1, 0], k: [{ type: 'garage', c: [3.76, 10.3], w: 2.44 }, { type: 'garage', c: [3.76, 13.6], w: 2.44 }] },
    { s: [[3.76, 15.9], [11.43, 15.9]], out: [0, 1], k: [{ type: 'window', c: [7.8, 15.9], w: 1.8 }] },
    { s: [[11.43, 7.91], [11.43, 15.9]], out: [1, 0], k: [{ type: 'window', c: [11.43, 12.0], w: 1.2 }] },
  ];
  // the porch gable's front: posts + infill over a wide opening across the entry recess
  const RECESS = [X(0.17), Y(6.4), X(3.76), Y(8.06)];
  const porchWall = { s: [[0.17, 7.96], [3.76, 7.96]], out: [0, 1], k: [{ type: 'porch', c: [1.965, 7.96], w: 3.0 }] };
  // basement walkout: windows along the back wall every ~3 m where the plan has none
  const backWins = (a, b, nx, ny, L, have) => {
    if (ny > -0.7 || L < 2) return [];
    const out = [];
    for (let u = 1.5; u < L - 1; u += 3) {
      const c = [a[0] + (b[0] - a[0]) * u / L, a[1] + (b[1] - a[1]) * u / L];
      if (have.some(o => Math.hypot(o.c[0] - c[0], o.c[1] - c[1]) < 1.6)) continue;
      out.push({ type: Math.abs(c[0]) < 1.6 ? 'door' : 'window', c, w: Math.abs(c[0]) < 1.6 ? 1.8 : 1.2 });
    }
    return out;
  };
  const PB = plan('Basement', [], backWins), P1 = plan('Floor 1', [porchWall]), P2 = plan('Floor 2'), PG = plan('Floor 1', garWalls, null, true);
  const garMask = polyMask(rectP(GAR)), recMask = polyMask(rectP(RECESS));
  const l2occ = new Uint8Array(N);
  for (let k = 0; k < N; k++) l2occ[k] = P2.fpMask[k] || P2.wk[k] ? 1 : 0;

  // ----------------------------------------------------------------- stairs --
  // basement <-> floor 1 in the plan's stair well (x 3.48..4.57), top at its open north end, down toward -y:
  // 8 risers of 12 on 12-deep treads, the floor-1 slab open over the top 6 treads
  const DX0 = X(3.48), DX1 = X(4.57), DYT = Y(1.3);
  // floor 1 -> floor 2 up the plan's 'Stairs (Up)' (y 2.74..3.65) toward +x: 9 risers, lands in floor 2's stair room
  const UX0 = X(4.35), UY0 = Y(2.74), UY1 = Y(3.65);
  const keep = {
    B: [{ r: [DX0 - 4, DYT - 84 - 30, DX1 + 4, DYT], walls: 1 }],
    L1: [{ r: [DX0, DYT - 74, DX1, DYT], slab: 1 },
      { r: [UX0, UY0 - 6, UX0 + 96, UY1 + 6], walls: 1 }, { r: [UX0 + 12, UY0, UX0 + 96, UY1], ceil: 1 }],
    L2: [{ r: [UX0 + 12, UY0, UX0 + 96, UY1], walls: 1, slab: 1 }, { r: [UX0 + 12, UY0 - 6, UX0 + 130, UY1 + 6], walls: 1 }],
  };
  const kept = (L, x, y, what) => keep[L].some(q => q[what] && inRect(x, y, q.r));

  // ------------------------------------------------------------------ roofs --
  // height-field roofs on the stud grid (georgian.mjs): tile (tx, ty) = x tx..tx+10, y ty..ty+10
  const r10 = v => Math.round(v / 10) * 10;
  const CH = [r10(X(0.45)), r10(Y(-7.2))];             // the family-room chimney (aerial)
  const F2R = [X(4.86), Y(-7.71), X(10.94), Y(7.68)];
  const roofs = [
    { id: 'main', rect: [r10(X(-11.66)) - 10, r10(Y(-8.17)) - 10, r10(X(11.43)) + 10, r10(Y(8.06)) + 10], eave: 210, rise: 6,
      body: [[X(-11.66), Y(-8.17), X(11.43), Y(8.06)]], skip: (x, y) => x >= CH[0] && x < CH[0] + 30 && y >= CH[1] && y < CH[1] + 30 },
    { id: 'upper', rect: [r10(F2R[0]) - 30, r10(Y(-7.96)) - 10, r10(F2R[2]) + 30, r10(Y(7.91)) + 10], eave: 256, rise: 10, gable: true, body: [[F2R[0] - 10, F2R[1] - 10, F2R[2] + 10, F2R[3] + 10]] },
    { id: 'porch', rect: [r10(RECESS[0]) - 10, r10(RECESS[1]) - 10, r10(RECESS[2]) + 10, r10(RECESS[3]) + 20], eave: 210, rise: 8, gable: true, body: [RECESS] },
    { id: 'garage', rect: [r10(GAR[0]) - 10, r10(GAR[1]) - 60, r10(GAR[2]) + 10, r10(GAR[3]) + 10], eave: 210, rise: 6, body: [GAR] },
    ...[10.3, 13.6].map((yc, i) => ({ id: 'gdoor' + i, rect: [r10(GAR[0]) - 20, r10(Y(yc)) - 50, r10(GAR[0]) + 90, r10(Y(yc)) + 50], eave: 206, rise: 10, gableX: true, body: [] })),
  ];
  function heightAt(d, x, y) {
    const [x0, y0, x1, y1] = d.rect;
    const k = d.gable ? Math.min(x - x0, x1 - x) : d.gableX ? Math.min(y - y0, y1 - y) : Math.min(x - x0, x1 - x, y - y0, y1 - y);
    return d.eave + d.rise * k / 10;
  }
  const tiles = new Map(), tkey = (x, y) => x * 100000 + y;
  {
    const xs = roofs.flatMap(d => [d.rect[0], d.rect[2]]), ys = roofs.flatMap(d => [d.rect[1], d.rect[3]]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 10) for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) {
      const cand = [];
      for (const d of roofs) {
        const [x0, y0, x1, y1] = d.rect;
        if (x < x0 || x + 10 > x1 || y < y0 || y + 10 > y1 || roofs[0].skip(x, y)) continue;
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
  // a column profile = [[z0, z1, mat]...]; equal profiles merge into boxes
  const ids = new Map(), profs = [null];
  const intern = p => {
    if (!p || !p.length) return 0;
    const key = p.map(s => s.join(',')).join(';');
    let id = ids.get(key);
    if (id == null) { id = profs.push(p) - 1; ids.set(key, id); }
    return id;
  };
  // solid [z0, z1) minus openings, skin cut into courses (brick 12 below 204 / siding 8 above, or all siding)
  function wallRuns(z0, z1, holes, skinMode, out) {
    let runs = [[z0, z1]];
    for (const [h0, h1] of holes) runs = runs.flatMap(([a, b]) => (h1 <= a || h0 >= b) ? [[a, b]] : [...(h0 > a ? [[a, h0]] : []), ...(h1 < b ? [[h1, b]] : [])]);
    for (const [a, b] of runs) {
      if (!skinMode) { out.push([a, b, 'PL']); continue; }
      let z = a;
      while (z < b) {
        const sid = skinMode === 'siding' || z >= 204, step = sid ? 8 : 12;
        let n = Math.min(b, (Math.floor(z / step) + 1) * step);
        if (!sid && n > 204) n = 204;
        out.push([z, n, sid ? (Math.floor(z / 8) % 2 ? 'SD1' : 'SD0') : (Math.floor(z / 12) % 2 ? 'BR1' : 'BR0')]);
        z = n;
      }
    }
  }
  const OPZ = (F, kind) => kind === 1 ? [F, F + 70] : kind === 2 ? [F + 24, F + 66] : kind === 3 ? [F, F + 72] : [F, F + 76];
  function wallColumn(P, k, x, y, { slab0, F, top, skinMode }) {
    const out = [], ext = P.wk[k] === 2, isSkin = P.skin[k];
    const holes = [];
    if (P.op[k]) {
      const [h0, h1] = OPZ(F, P.op[k]);
      holes.push([h0, h1]);
      if (P.glass[k] && P.op[k] === 2) out.push([h0, h1, 'GL']);
      if (P.glass[k] && P.op[k] === 3) out.push([h0, h1, 'GD']);
    }
    if (ext && isSkin) wallRuns(slab0, top, holes, skinMode, out);
    else { out.push([slab0, F, 'CE']); wallRuns(F, top, holes, ext ? null : null, out); }
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

  // basement: slab 0..12, walls 12..96; where nothing sits on it (outside floor 1 + garage) a deck top to 108
  layer('basement', PB, {
    column(k, x, y) {
      if (!PB.fpMask[k] && !PB.wk[k]) return null;
      const covered = P1.fpMask[k] || P1.wk[k] || garMask[k] || recMask[k], top = covered ? GRADE : F1;
      if (PB.wk[k] && !kept('B', x, y, 'walls')) return wallColumn(PB, k, x, y, { slab0: 0, F: ZB, top, skinMode: 'brick' });
      const out = [[0, 8, 'CO'], [8, ZB, PB.mat[k] ?? 'CO']];
      if (PB.solid[k] && !kept('B', x, y, 'walls')) wallRuns(ZB, GRADE, [], 'brick', out);
      if (!covered) out.push([GRADE, F1 - 4, 'CE'], [F1 - 4, F1, 'DK']);
      return out;
    },
  });
  // floor 1 (+ the porch slab in the entry recess)
  layer('floor 1', P1, {
    column(k, x, y) {
      const inFp = P1.fpMask[k];
      if (!inFp && !P1.wk[k]) return recMask[k] ? [[GRADE, F1, 'ST']] : null;
      const under2 = l2occ[k];
      if (P1.wk[k] && !kept('L1', x, y, 'walls')) {
        const ext = P1.wk[k] === 2, rb = roofBottom(x, y);
        const top = under2 ? C1 : ext ? (rb ?? 204) : C1;
        return wallColumn(P1, k, x, y, { slab0: GRADE, F: F1, top, skinMode: 'brick' });
      }
      const out = [];
      if (!kept('L1', x, y, 'slab')) out.push([GRADE, F1 - 4, 'CE'], [F1 - 4, F1, P1.mat[k] ?? 'WO']);
      if (P1.solid[k] && !kept('L1', x, y, 'walls')) wallRuns(F1, C1, [], 'brick', out);
      if (!under2 && !kept('L1', x, y, 'ceil')) out.push([C1, C1 + 4, 'CE']);
      return out.length ? out : null;
    },
  });
  // floor 2: open to the roof (no ceiling), every wall runs up to the roof
  layer('floor 2', P2, {
    column(k, x, y) {
      if (!P2.fpMask[k] && !P2.wk[k]) return null;
      const rb = roofBottom(x, y) ?? 260;
      if (P2.wk[k] && !kept('L2', x, y, 'walls')) return wallColumn(P2, k, x, y, { slab0: C1, F: F2, top: rb, skinMode: 'siding' });
      if (kept('L2', x, y, 'slab')) return null;
      return [[C1, C1 + 4, 'CE'], [C1 + 4, F2 - 4, 'CE'], [F2 - 4, F2, P2.mat[k] ?? 'CA']];
    },
  });
  // garage: slab on the berm, brick walls to the roof, doors closed (panels in the openings)
  layer('garage', PG, {
    column(k, x, y) {
      if (!garMask[k] && !PG.wk[k]) return null;
      if (P1.fpMask[k] || P1.wk[k] || recMask[k]) return null;
      if (PG.wk[k] === 2) return wallColumn(PG, k, x, y, { slab0: GRADE, F: GF, top: roofBottom(x, y) ?? 196, skinMode: 'brick' });
      return [[GRADE, GF, 'CO']];
    },
  });

  // ------------------------------------------------------------------- berm --
  // ground at the front = 96 (one step below floor 1), sloping down the sides to 0 at the walkout back
  const BY0 = Y(-8.6), BY1 = Y(4.0), BX0 = X(-11.94) - 200, BX1 = X(11.43) + 200, BYF = Y(15.9) + 260;
  const gl = y => GRADE * Math.max(0, Math.min(1, (y - BY0) / (BY1 - BY0)));
  const bermFree = k => !PB.fpMask[k] && !PB.wk[k] && !recMask[k];
  const DC = [X(-0.5), Y(12.6)];
  const drive = (x, y) => { const d = Math.hypot(x - DC[0], y - DC[1]); return (d >= 120 && d < 215) || inRect(x, y, [RECESS[0], RECESS[3], GAR[0], GAR[3]]) || inRect(x, y, [DC[0] - 50, DC[1], DC[0] + 50, BYF]); };
  {
    const id = new Int32Array(N);
    eachCell(BX0, BY1, BX1, BYF, (k, x, y) => { if (bermFree(k)) id[k] = intern([[0, GRADE, drive(x, y) ? 'CO' : 'GR']]); });
    merge(id, 'berm');
  }
  // side slopes: per column, runs of free cells; equal runs on neighbouring columns merge; box + wedge
  {
    const i0 = Math.floor((BX0 - GX0) / R), i1 = Math.floor((BX1 - GX0) / R), j0 = Math.ceil((BY0 - GY0) / R), j1 = Math.floor((BY1 - GY0) / R);
    const runsOf = i => { const out = []; let s = -1; for (let j = j0; j <= j1; j++) { const f = j < j1 && bermFree(j * NX + i); if (f && s < 0) s = j; if (!f && s >= 0) { out.push(s + ':' + j); s = -1; } } return out; };
    let prev = null, prevRuns = null, start = i0;
    const flush = (iA, iB, runs) => {
      for (const r of runs) {
        const [a, b] = r.split(':').map(Number), y0 = GY0 + a * R, y1 = GY0 + b * R, x0 = GX0 + iA * R, x1 = GX0 + iB * R;
        const h0 = Math.round(gl(y0) / 2) * 2, h1 = Math.round(gl(y1) / 2) * 2;
        box(x0, y0, 0, x1, y1, h0, MATS.GR, 'berm');
        if (h1 > h0) {
          const asset = 'PB_DefaultMicroWedge', ext = [(x1 - x0) / 2, (y1 - y0) / 2, (h1 - h0) / 2];
          piece(asset, [[0, 1]], ext, [(x0 + x1) / 2, (y0 + y1) / 2, (h0 + h1) / 2], MATS.GR.color, 'berm slope');
        }
      }
    };
    for (let i = i0; i <= i1 + 1; i++) {
      const runs = i <= i1 ? runsOf(i) : null, key = runs && runs.join(',');
      if (i > i0 && (key !== prev || i - start >= 250)) { flush(start, i, prevRuns); start = i; }
      if (i === i0) start = i;
      prev = key; prevRuns = runs;
    }
  }

  // ----------------------------------------------------------- stair flights --
  const STAIR = shade([170, 120, 76], 0.9);
  for (let c = 1; c <= 7; c++) box(DX0, DYT - 84 + 12 * (c - 1), ZB + 12 * (c - 1), DX1, DYT, ZB + 12 * c, { color: shade(STAIR, c % 2 ? 1 : 0.94) }, 'down flight');
  for (let c = 1; c <= 8; c++) box(UX0 + 12 * (c - 1), UY0, F1 + 12 * (c - 1), UX0 + 96, UY1, F1 + 12 * c, { color: shade(STAIR, c % 2 ? 1 : 0.94) }, 'up flight');

  // ----------------------------------------------------------- chimney, deck --
  for (let z = 200; z < 330; z += 12) box(CH[0], CH[1], z, CH[0] + 30, CH[1] + 30, Math.min(330, z + 12), MATS[(z / 12) % 2 ? 'BR1' : 'BR0'], 'chimney');
  box(CH[0] - 2, CH[1] - 2, 330, CH[0] + 32, CH[1] + 32, 334, MATS.ST, 'chimney cap');
  // rear deck off the breakfast nook's sliding door (east wall) over the side slope
  const DKX0 = X(11.43) + 8, DKX1 = DKX0 + 110, DKY0 = Y(1.0), DKY1 = Y(4.0);
  box(DKX0, DKY0, F1 - 8, DKX1, DKY1, F1, MATS.DK, 'deck');
  for (const [x0, y0, x1, y1] of [[DKX1 - 4, DKY0, DKX1, DKY1], [DKX0, DKY0, DKX1 - 4, DKY0 + 4], [DKX0, DKY1 - 4, DKX1 - 4, DKY1]]) box(x0, y0, F1 + 32, x1, y1, F1 + 36, MATS.DK, 'deck rail');
  for (let x = DKX0 + 10; x < DKX1 - 4; x += 12) for (const y0 of [DKY0, DKY1 - 4]) box(x, y0, F1, x + 2, y0 + 4, F1 + 32, MATS.DK, 'baluster');
  for (let y = DKY0 + 10; y < DKY1 - 4; y += 12) box(DKX1 - 4, y, F1, DKX1, y + 2, F1 + 32, MATS.DK, 'baluster');

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
      box(t.x, t.y, b0 - d.rise, t.x + w * 10, t.y + l * 10, b0, { color: lipColor(t) }, d.id + ' roof lip');
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
      piece(asset, dirs, ext, [t.x + ext[0], t.y + ext[1], t._c.base + dz / 2], capColor(t), d.id + ' roof');
    }
  }

  const bricks = B.bricks.map(({ label, ...b }) => b);
  return { bricks, count: bricks.length };
}

if (process.argv[1]?.endsWith('witherspoon.mjs')) {
  const out = process.argv[2] ?? 'witherspoon.json', h = witherspoon();
  fs.writeFileSync(out, JSON.stringify({ bricks: h.bricks }));
  console.error(`witherspoon: ${h.count} bricks`);
}
