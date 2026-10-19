// Georgian estate (2026-10-18, owner: a Zillow listing, 9 Squire Ln, St Charles IL, "build this with the
// generator"): a 1987 brick Georgian. Tan brick two-storey main block of five bays under a slate HIP roof,
// the centre bay brought forward under its own little cross hip with a tall ARCHED ENTRY (brick archivolt,
// keystone, fanlight over black double doors, lanterns, stone stoop), arched ground-floor windows and
// 6-over-6 upper windows with stone keystone lintels, black louvred shutters everywhere, a three-step white
// cornice, a tall end chimney on the living-room gable, boxwood hedges along the front. One-storey hipped
// wings either side: the wood-panelled LIBRARY on the chimney side, the 3-car garage with arched carriage
// doors on the other. Behind: the later addition, the "ASPEN ROOM" = a vaulted great room under a gable
// roof (exposed timber trusses, stepped pine ceiling, two big arched windows flanking a stone fireplace,
// grand piano, bar), and a pool on a travertine deck behind the library. Paver motor court in front.
//
// Inside the main block: grand double-height FOYER with a marble checker floor, a straight stair up the
// side wall to a gallery, chandelier; living room (fireplace on the chimney gable) and bar behind it on one
// side, dining room and kitchen (island, steel fridge, range with red knobs) on the other; upstairs two
// bedrooms with baths off the gallery.
//
// Scale as dutchcolonial.mjs / splitlevel.mjs (BUILDING.md PLAYER SCALE): storey 92 (ground floor top 24,
// ceiling 108, upper floor 116, ceiling 196), stair 8 courses of 12/10 on 14-deep treads.
// ROOFS: a height field per roof (hip: height = eave + rise x distance to the nearest eave; gable: distance
// to the side eaves only), the max of the roofs that cover a stud (valleys come out of the max), each stud
// tile a micro brick lip + one cap piece like the ride surface (mapgen ride v2, seen in game): 1 corner up
// = MicroWedgeCorner, 2 = MicroWedge (merged in runs), 3 = MicroWedgeOuterCorner.
//
//   georgian({ seed, mirror }) -> { bricks, W, D, door } local units, front on y = 0 looking -y (shapedTown frame)
//   node mapgen/georgian.mjs [seed] [out.json] [mirror]   (bricks for isoview.mjs)

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [242, 240, 234], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';
const METAL = { color: [196, 198, 202], material: 'BMC_Metallic' };
const STONE = [226, 218, 198];
// the listing's tan / pink brick, now and then a redder or buff one
const BRICKS = [
  [[198, 150, 122], [186, 138, 112], [208, 162, 132], [192, 144, 118]],
  [[204, 158, 128], [190, 146, 118], [214, 170, 140], [180, 136, 110]],
  [[170, 92, 70], [156, 82, 62], [182, 102, 78], [162, 88, 66]],
  [[214, 190, 150], [200, 176, 138], [224, 200, 160], [206, 182, 142]],
];
const SHUTTERS = [[30, 30, 32], [28, 34, 30], [30, 36, 52], [40, 40, 44]];
const SLATES = [[92, 96, 102], [84, 86, 92], [100, 100, 104], [78, 82, 90]];
const DOORS = [[24, 24, 26], [30, 46, 36], [96, 30, 30]];
const WOOD = [[120, 84, 54], [104, 70, 44], [134, 94, 60], [96, 64, 40]];
const PINE = [[190, 150, 104], [176, 136, 92], [200, 160, 112]];
const PAPERS = [
  { kind: 'stripe', cols: [[6, [222, 210, 180]], [4, [206, 190, 156]]] },
  { kind: 'stripe', cols: [[8, [196, 210, 200]], [2, [236, 236, 226]]] },
  { kind: 'check', w: 10, h: 12, colors: [[220, 214, 196], [206, 198, 178]] },
  { kind: 'paint', color: [232, 226, 210] },
  { kind: 'paint', color: [206, 196, 170] },
  { kind: 'paint', color: [190, 204, 210] },
  { kind: 'paint', color: [150, 50, 46] },
];
const WAINS = [
  { kind: 'stripe', cols: [[2, [240, 238, 230]], [2, [226, 224, 216]]] },
  { kind: 'paint', color: [236, 232, 222] },
  { kind: 'stripe', cols: [[4, [120, 86, 58]], [4, [108, 76, 50]]] },
];
const PANEL = { kind: 'stripe', cols: [[6, [120, 82, 50]], [2, [100, 66, 40]]] };   // library oak panelling
const TILEWAINS = [{ kind: 'check', w: 10, h: 6, colors: [[244, 244, 240], [228, 232, 232]] }];

export function georgian({ seed = 1, mirror = false } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  const BR = r() < 0.7 ? BRICKS[Math.floor(r() * 2)] : pick(BRICKS);
  const shutC = pick(SHUTTERS), slate = pick(SLATES), doorC = pick(DOORS), trimC = WHITE;
  const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  const r2 = v => Math.round(v / 2) * 2;
  // ---------------------------------------------------------------- frame --
  // main block x 0..460 y 0..300, the centre bay x 180..280 out to y -20; library wing x -120..0, garage
  // wing x 460..660 (both y 90..270); frame x -150..690 = the flat core of a 23-cell lot (21 cells), ground-level
  // work kept 30 inside it (mapgen builds a lone house round a cell CORNER, 20 off the lot's centre); Aspen room x 140..440 y 300..520; chimney x -50..0 y 20..80
  const X0 = 150, Y0 = 180;
  const G = 24, GC = 108, U = 116, UC = 196, WT = 204;      // floors, ceilings, main wall top
  const WG = 124, AT = 164;                                 // wing wall top, Aspen wall top
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`georgian: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const piece = (asset, ups, ext, pos, color, label) => {
    if (!B.add({ asset, ...orientFor(asset, ups, ext), _m: { asset, ups, ext }, color, position: [X0 + pos[0], Y0 + pos[1], pos[2]] }, label)) throw new Error(`georgian: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('georgian: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {};
  const floor = (room, rect, top) => tileFloor(fadd, rect, top, style[room] ??= pickRoomStyle(room, r), r);
  const op = (a0, a1, z0, z1, extra = {}) => ({ a0, a1, z0, z1, ...extra });
  const light = (x, y, z, c = [255, 240, 210]) => box(x - 8, y - 8, z - 2, x + 8, y + 8, z, GLOW(c), 'ceiling light');

  // ------------------------------------------------------- rasters --
  // a set of 2-unit cells merged into rectangles (rings round footprints: cornices, water tables)
  function ringRects(foot, p, excl) {
    const inR = (x, y, R) => x >= R[0] && x < R[2] && y >= R[1] && y < R[3];
    const xs = foot.flatMap(R => [R[0] - p, R[2] + p]), ys = foot.flatMap(R => [R[1] - p, R[3] + p]);
    const bx0 = Math.min(...xs), by0 = Math.min(...ys), nx = (Math.max(...xs) - bx0) / 2, ny = (Math.max(...ys) - by0) / 2;
    const on = new Uint8Array(nx * ny);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = bx0 + i * 2, y = by0 + j * 2;
      if (foot.some(R => inR(x, y, [R[0] - p, R[1] - p, R[2] + p, R[3] + p])) && !foot.some(R => inR(x, y, R)) && !excl.some(R => inR(x, y, R))) on[i * ny + j] = 1;
    }
    const out = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (!on[i * ny + j]) continue;
      let l = 1; while (j + l < ny && on[i * ny + j + l]) l++;
      let w = 1; grow: while (i + w < nx) { for (let b = 0; b < l; b++) if (!on[(i + w) * ny + j + b]) break grow; w++; }
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) on[(i + a) * ny + j + b] = 0;
      out.push([bx0 + i * 2, by0 + j * 2, bx0 + (i + w) * 2, by0 + (j + l) * 2]);
    }
    return out;
  }
  // a three-step cornice under the eave lip (proud 4 then 8; the roof's eave lip is proud 10) + water table
  function cornice(foot, zTop, excl, label) {
    for (const R of ringRects(foot, 4, excl)) box(R[0], R[1], zTop - 8, R[2], R[3], zTop - 4, { color: trimC }, label + ' cornice');
    for (const R of ringRects(foot, 8, excl)) box(R[0], R[1], zTop - 4, R[2], R[3], zTop, { color: shade(trimC, 0.97) }, label + ' cornice');
  }
  const waterTable = (foot, excl, label) => { for (const R of ringRects(foot, 2, excl)) box(R[0], R[1], 20, R[2], R[3], 24, { color: STONE }, label + ' water table'); };

  // ------------------------------------------------------------ walls --
  const WALLS = [];
  const wpiece = (axis, line, a, b, z, zt, color, label, t = 10) => axis === 'x'
    ? box(a, line, z, b, line + t, zt, { color }, label) : box(line, a, z, line + t, b, zt, { color }, label);
  function course(axis, line, a0, a1, z, zt, openings, color, label) {
    let pcs = [{ p: a0, q: a1, z, zt }];
    for (const o of openings) {
      const oz1 = o.cut ?? o.z1;
      if (o.z0 >= zt || oz1 <= z) continue;
      pcs = pcs.flatMap(c => {
        if (o.a1 <= c.p || o.a0 >= c.q) return [c];
        const out = [];
        if (o.a0 > c.p) out.push({ ...c, q: o.a0 });
        if (o.a1 < c.q) out.push({ ...c, p: o.a1 });
        const m0 = Math.max(c.p, o.a0), m1 = Math.min(c.q, o.a1);
        if (o.z0 > c.z) out.push({ p: m0, q: m1, z: c.z, zt: Math.min(c.zt, o.z0) });
        if (oz1 < c.zt) out.push({ p: m0, q: m1, z: Math.max(c.z, oz1), zt: c.zt });
        return out;
      });
    }
    for (const c of pcs) if (c.q > c.p && c.zt > c.z) wpiece(axis, line, c.p, c.q, c.z, c.zt, color, label);
  }
  // brick: a limestone foundation to z 24 (or `fz`), then 6-high courses in four shades; 'paint' = a partition
  let ck = 0;
  const brickC = () => BR[[0, 2, 1, 3, 0, 1, 2, 3][ck++ % 8]];
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall', fz = 24) {
    WALLS.push({ axis, line, a0, a1, z0, z1, openings });
    if (skin === 'paint') return course(axis, line, a0, a1, z0, z1, openings, [204, 198, 186], label);
    let z = z0;
    if (z < fz) { for (; z < fz; z += 12) course(axis, line, a0, a1, z, Math.min(fz, z + 12), openings, shade(STONE, z % 24 ? 0.95 : 1), label + ' foundation'); }
    for (; z < z1; z += 6) course(axis, line, a0, a1, z, Math.min(z1, z + 6), openings, brickC(), label + ' brick');
  }
  // a wall line's run up to the roof above it, column by column (the gable over the Aspen room's walls)
  function wallToRoof(axis, line, a0, a1, z0, topAt, openings, label) {
    const cols = [];
    for (let a = a0; a < a1; a += 10) cols.push([a, Math.min(a1, a + 10), topAt(a)]);
    const zmax = Math.max(...cols.map(c => c[2]));
    for (let z = z0; z < zmax; z += 6) {
      const zt = Math.min(zmax, z + 6), col = brickC();
      let run = null;
      const flush = () => { if (run) course(axis, line, run[0], run[1], z, run[2], openings, col, label); run = null; };
      for (const [p, q, top] of cols) {
        if (top <= z) { flush(); continue; }
        const t = Math.min(zt, top);
        if (run && run[2] === t && run[1] === p) run[1] = q; else { flush(); run = [p, q, t]; }
      }
      flush();
    }
  }

  // ------------------------------------------------------------ windows --
  // n lites with 2-unit bars between, every lite an even size
  function splitEven(p, q, n) {
    const tot = q - p - 2 * (n - 1), base = Math.floor(tot / n / 2) * 2;
    let rem = tot - base * n, a = p;
    const out = [];
    for (let i = 0; i < n; i++) { const w = base + (rem > 0 ? 2 : 0); rem -= rem > 0 ? 2 : 0; out.push([a, a + w]); a += w + 2; }
    return out;
  }
  // a glazed opening: white frame, glazing bars (cols x rows lites), sill and (optional) arched head, louvred
  // shutters, stone lintel + keystone (rect) or keystone (arch); out -1 = the outside is toward -y / -x
  function windowG(axis, line, out, o, { shutters = true, lintel = true, cols = 3, rows = 4, frameC = WHITE } = {}) {
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    const F = { color: frameC };
    const arch = o.R ?? 0, zs = arch ? o.zs : o.z1;     // springing (arched) or head (rect)
    const mid = (o.a0 + o.a1) / 2;
    const pf = out < 0 ? [line - 2, line] : [line + 10, line + 12];       // proud plane
    const pf4 = out < 0 ? [line - 4, line] : [line + 10, line + 14];
    // frame round the rect part
    pb(o.a0, o.a0 + 4, o.z0, zs, F, 'window frame'); pb(o.a1 - 4, o.a1, o.z0, zs, F, 'window frame');
    pb(o.a0 + 4, o.a1 - 4, o.z0, o.z0 + 4, F, 'window frame');
    const gTop = arch ? zs : zs - 4;
    if (!arch) pb(o.a0 + 4, o.a1 - 4, zs - 4, zs, F, 'window frame');
    // lites + bars (glass in the middle of the wall, bars 6 thick)
    const cs = splitEven(o.a0 + 4, o.a1 - 4, cols), rs = splitEven(o.z0 + 4, gTop, rows);
    for (const [a, b] of cs) for (const [z, zt] of rs) pb(a, b, z, zt, GLASS, 'glass', line + 4, line + 6);
    for (let i = 0; i + 1 < cs.length; i++) pb(cs[i][1], cs[i + 1][0], o.z0 + 4, gTop, F, 'glazing bar', line + 2, line + 8);
    for (let j = 0; j + 1 < rs.length; j++) for (let i = 0; i < cs.length; i++) pb(cs[i][0], cs[i][1], rs[j][1], rs[j + 1][0], F, 'glazing bar', line + 2, line + 8);
    // the arched head: 4-unit columns, glass to the curve less a 4 frame, brick (an archivolt course first) above
    if (arch) {
      for (let a = o.a0; a < o.a1; a += 4) {
        const dx = a + 2 - mid, top = zs + r2(Math.sqrt(Math.max(0, arch * arch - dx * dx)));
        const post = a < o.a0 + 4 || a >= o.a1 - 4;
        if (post) { if (top > zs) pb(a, a + 4, zs, top, F, 'arch frame'); }
        else {
          pb(a, a + 4, zs, zs + 2, F, 'springing bar', line + 2, line + 8);
          if (top - 4 > zs + 2) pb(a, a + 4, zs + 2, top - 4, GLASS, 'fanlight', line + 4, line + 6);
          if (top - 4 > zs + 2) { pb(a, a + 4, zs + 2, top - 4, F, 'fan frame', line, line + 4); pb(a, a + 4, zs + 2, top - 4, F, 'fan frame', line + 6, line + 10); }
          pb(a, a + 4, Math.max(zs + 2, top - 4), top, F, 'arch frame');
        }
        const ring = Math.min(zs + arch, top + 6);
        if (ring > top) pb(a, a + 4, top, ring, { color: shade(BR[1], 0.9) }, 'archivolt');
        if (zs + arch > ring) pb(a, a + 4, ring, zs + arch, { color: brickC() }, 'arch infill');
      }
      pb(mid - 4, mid + 4, zs + arch - 4, zs + arch + 8, { color: STONE }, 'keystone', ...pf4);
    } else if (lintel) {
      pb(o.a0 - 6, mid - 4, zs, zs + 8, { color: STONE }, 'lintel', ...pf);
      pb(mid + 4, o.a1 + 6, zs, zs + 8, { color: STONE }, 'lintel', ...pf);
      pb(mid - 4, mid + 4, zs - 2, zs + 10, { color: shade(STONE, 1.03) }, 'keystone', ...pf4);
    }
    pb(o.a0 - 4, o.a1 + 4, o.z0 - 4, o.z0, { color: STONE }, 'sill', ...pf4);
    if (!shutters) return;
    // louvred shutters (6-high slats in two shades) to the springing / head
    for (const [a, b] of [[o.a0 - 12, o.a0], [o.a1, o.a1 + 12]]) for (let z = o.z0, k = 0; z < zs; z += 6, k++)
      pb(a, b, z, Math.min(zs, z + 6), { color: shade(shutC, k % 2 ? 0.8 : 1) }, 'shutter', ...pf);
  }

  // ---------------------------------------------------- interior finishes --
  const bands = (z0, z1) => [
    [z0, z0 + 6, 4, 'base'], [z0 + 6, z0 + 22, 2, 'wains'], [z0 + 22, z0 + 26, 4, 'rail'],
    [z0 + 26, z1 - 6, 2, 'paper'], [z1 - 6, z1 - 4, 4, 'crown'], [z1 - 4, z1, 6, 'crown'],
  ];
  function patterned(pat, a0, a1, z0, z1, put) {
    if (pat.kind === 'paint') return put(a0, a1, z0, z1, pat.color);
    if (pat.kind === 'check') {
      for (let a = Math.floor(a0 / pat.w) * pat.w; a < a1; a += pat.w) for (let z = Math.floor(z0 / pat.h) * pat.h; z < z1; z += pat.h) {
        const p = Math.max(a0, a), q = Math.min(a1, a + pat.w), u = Math.max(z0, z), v = Math.min(z1, z + pat.h);
        if (q > p && v > u) put(p, q, u, v, pat.colors[((a / pat.w + z / pat.h) % 2 + 2) % 2]);
      }
      return;
    }
    const per = pat.cols.reduce((s, [w]) => s + w, 0);
    let a = Math.floor(a0 / per) * per, k = 0;
    while (a < a1) { const [w, c] = pat.cols[k % pat.cols.length]; const p = Math.max(a0, a), q = Math.min(a1, a + w); if (q > p) put(p, q, z0, z1, c); a += w; k++; }
  }
  const SIDES = { y0: ['x', 1], y1: ['x', -1], x0: ['y', 1], x1: ['y', -1] };
  function faceWall(side, R) {
    const [axis] = SIDES[side];
    const f = R[side];
    const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
    return WALLS.filter(w => w.axis === axis && (side.endsWith('0') ? w.line + 10 === f : w.line === f) && w.a0 < hi && w.a1 > lo && w.z0 < R.z1 && w.z1 > R.z0);
  }
  function facePiece(side, R, a, b, z, zt, t, color, label) {
    const [axis, d] = SIDES[side];
    const f = R[side];
    const [c0, c1] = d > 0 ? [f, f + t] : [f - t, f];
    if (axis === 'x') box(a, c0, z, b, c1, zt, { color }, label); else box(c0, a, z, c1, b, zt, { color }, label);
  }
  // skirting, wainscot, chair rail, paper, crown on every wall face of room R, cut round the openings
  // (casings round them); a face whose walls stop lower (an open gallery above) gets the bands under that
  function finishRoom(R, { paper, wains, skip = {}, trim = trimC } = {}) {
    const has = {};
    for (const s of Object.keys(SIDES)) has[s] = faceWall(s, R).length > 0;
    for (const side of Object.keys(SIDES)) {
      if (!has[side]) continue;
      const [axis] = SIDES[side];
      const lo = axis === 'x' ? R.x0 : R.y0, hi = axis === 'x' ? R.x1 : R.y1;
      const ws = faceWall(side, R), wz1 = Math.min(R.z1, Math.max(...ws.map(w => w.z1)));
      const ops = ws.flatMap(w => w.openings).filter(o => o.z0 < R.z1 && o.z1 > R.z0 && o.a0 < hi && o.a1 > lo);
      for (const [z0, z1b, t, kind] of bands(R.z0, R.z1)) {
        if (z0 >= wz1) continue;
        const z1 = Math.min(z1b, wz1);
        let a0 = lo, a1 = hi;
        if (axis === 'y') { if (has.y0) a0 += t; if (has.y1) a1 -= t; }
        let spans = [[a0, a1]];
        const cut = (p0, p1) => { spans = spans.flatMap(([p, q]) => (p1 <= p || p0 >= q) ? [[p, q]] : [[p, p0], [p1, q]].filter(([u, v]) => v > u)); };
        for (const o of ops) {
          const door = o.z0 <= R.z0 + 2;
          const oz0 = door ? R.z0 : o.z0 - 2, oz1 = o.z1 + 4;
          if (oz0 < z1 && oz1 > z0) cut(o.a0 - 4, o.a1 + 4);
        }
        for (const [p0, p1] of skip[side] ?? []) cut(p0, p1);
        for (const [p, q] of spans) {
          if (kind === 'paper' || kind === 'wains') patterned(kind === 'paper' ? paper : wains, p, q, z0, z1, (u, v, zz, zt, c) => facePiece(side, R, u, v, zz, zt, t, c, 'wall ' + kind));
          else facePiece(side, R, p, q, z0, z1, t, kind === 'crown' && t === 6 ? shade(trim, 0.96) : trim, kind);
        }
      }
      for (const o of ops) {
        if ((skip[side] ?? []).some(([p0, p1]) => o.a0 < p1 && o.a1 > p0)) continue;
        const door = o.z0 <= R.z0 + 2;
        const jz0 = door ? R.z0 : o.z0, top = Math.min(wz1 - 6, o.z1 + 4);
        facePiece(side, R, o.a0 - 4, o.a0, jz0, top, 4, trim, 'casing');
        facePiece(side, R, o.a1, o.a1 + 4, jz0, top, 4, trim, 'casing');
        if (o.z1 < top) facePiece(side, R, o.a0, o.a1, o.z1, top, 4, trim, 'casing head');
        if (!door) facePiece(side, R, o.a0 - 4, o.a1 + 4, o.z0 - 2, o.z0, 6, trim, 'stool');
      }
    }
  }

  // ================================================================ ROOFS ==
  // height-field roofs on the stud grid; tile (tx, ty) = x tx..tx+10, y ty..ty+10
  const roofs = [
    { id: 'main', rect: [-10, -10, 470, 310], eave: 212, rise: 8, body: [[0, 0, 460, 300], [180, -20, 280, 0]],
      skip: (x, y) => x === -10 && y >= 30 && y < 70 },                                  // the chimney
    { id: 'cross', rect: [170, -30, 290, 150], eave: 212, rise: 8, body: [[0, 0, 460, 300], [180, -20, 280, 0]] },
    { id: 'aspen', rect: [130, 150, 450, 530], eave: 172, rise: 8, gable: true, body: [[140, 300, 440, 520]], excl: [130, 150, 450, 310],
      lining: true, skip: (x, y) => y === 520 && x >= 280 && x < 320 },                   // its chimney
    { id: 'library', rect: [-130, 80, 100, 280], eave: 130, rise: 6, body: [[-120, 90, 0, 270]], clip: x => x < 0 },
    { id: 'garage', rect: [360, 80, 670, 280], eave: 130, rise: 6, body: [[460, 90, 660, 270]], clip: x => x >= 460 },
  ];
  const inside = (x, y, R) => x >= R[0] && x < R[2] && y >= R[1] && y < R[3];
  function heightAt(d, x, y) {
    const [x0, y0, x1, y1] = d.rect;
    const k = d.gable ? Math.min(x - x0, x1 - x) : Math.min(x - x0, x1 - x, y - y0, y1 - y);
    return d.eave + d.rise * k / 10;
  }
  const tiles = new Map();                            // key -> [{ d, h[4], base, cap }]
  const tkey = (x, y) => x * 100000 + y;
  {
    const xs = roofs.flatMap(d => [d.rect[0], d.rect[2]]), ys = roofs.flatMap(d => [d.rect[1], d.rect[3]]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 10) for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) {
      const cand = [];
      for (const d of roofs) {
        const [x0, y0, x1, y1] = d.rect;
        if (x < x0 || x + 10 > x1 || y < y0 || y + 10 > y1) continue;
        if (d.clip && !d.clip(x, y)) continue;
        if (d.skip?.(x, y)) continue;
        const h = [[0, 0], [10, 0], [0, 10], [10, 10]].map(([a, b]) => heightAt(d, x + a, y + b));
        cand.push({ d, h, top: Math.max(...h), base: Math.min(...h), mean: h.reduce((s, v) => s + v, 0) });
      }
      if (!cand.length) continue;
      cand.sort((a, b) => b.top - a.top || b.mean - a.mean);
      const T = cand[0], keep = [T];
      for (const c of cand.slice(1)) {
        if (T.d.body.some(R => inside(x, y, R)) || (T.d.excl && inside(x, y, T.d.excl))) continue;
        if (c.top <= T.base - T.d.rise) keep.push(c);
      }
      tiles.set(tkey(x, y), keep.map(c => ({ ...c, x, y })));
    }
  }
  // the lowest lip bottom of the roofs over a stud tile (walls run up to it)
  const roofBottom = (x, y) => { const L = tiles.get(tkey(x, y)); return L ? Math.min(...L.map(t => capBase(t) - t.d.rise)) : null; };
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
    return { base: hi, cap: null };                   // a saddle: flat at the top
  }
  function capBase(t) { return (t._c ??= capOf(t)).base; }
  function buildRoofs() {
    for (const d of roofs) {
      const mine = new Map();
      for (const L of tiles.values()) for (const t of L) if (t.d === d) mine.set(tkey(t.x, t.y), t);
      const [rx0, ry0, rx1, ry1] = d.rect;
      const lipColor = t => {
        const edge = t.x === rx0 || t.x + 10 === rx1 || (!d.gable && (t.y === ry0 || t.y + 10 === ry1)) || (d.gable && t.y + 10 === ry1);
        if (edge && !(d.clip && !d.clip(t.x - 10, t.y) && t.x === rx0)) return trimC;
        if (d.lining && d.body.some(R => inside(t.x, t.y, R))) return PINE[((t.x / 10) % 3 + 3) % 3 === 0 ? 1 : 0];
        return shade(slate, 0.7);
      };
      const capColor = t => shade(slate, [1, 0.94, 1.04][Math.round((capBase(t) - d.eave) / d.rise) % 3]);
      // lips: greedy rectangles of equal base and colour
      const used = new Set();
      for (const t of mine.values()) {
        const k0 = tkey(t.x, t.y);
        if (used.has(k0)) continue;
        const c0 = lipColor(t).join(), b0 = capBase(t);
        const same = (a, b) => { const o = mine.get(tkey(t.x + a * 10, t.y + b * 10)); return o && !used.has(tkey(o.x, o.y)) && capBase(o) === b0 && lipColor(o).join() === c0; };
        let l = 1; while (l < 40 && same(0, l)) l++;
        let w = 1; grow: while (w < 40) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
        for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) used.add(tkey(t.x + a * 10, t.y + b * 10));
        box(t.x, t.y, b0 - d.rise, t.x + w * 10, t.y + l * 10, b0, { color: lipColor(t) }, d.id + ' roof lip');
      }
      // caps: wedges merged along runs across their slope
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
  }

  // ================================================================ MAIN ==
  // front (y 0..10) either side of the centre bay; the bay (front wall y -20..-10, sides x 180..190 / 270..280)
  const winsX = [42, 112, 312, 382];                  // window left edges (36 wide), bays at 60 130 330 400
  const archWin = a => op(a, a + 36, G + 18, G + 76, { R: 18, zs: G + 58, cut: G + 76 });
  const upWin = a => op(a, a + 36, U + 16, U + 70);
  const gWin = a => op(a, a + 36, G + 18, G + 72);
  const frontG = winsX.map(archWin), frontU = winsX.map(upWin);
  wall('x', 0, 0, 190, 0, WT, 'brick', [...frontG.slice(0, 2), ...frontU.slice(0, 2)], 'front');
  wall('x', 0, 270, 460, 0, WT, 'brick', [...frontG.slice(2), ...frontU.slice(2)], 'front');
  for (const o of [...frontG]) windowG('x', 0, -1, o, { rows: 2 });
  for (const o of frontU) windowG('x', 0, -1, o);
  // the arched entry: opening x 200..260, the arch springs at G+62 (R 30) up to the upper floor
  const ENT = op(200, 260, G, G + 92, { R: 30, zs: G + 62, cut: G + 100 });
  wall('x', -20, 180, 280, 0, WT, 'brick', [ENT], 'bay front');
  WALLS.at(-1).openings = [op(200, 260, G, G + 66)];
  wall('y', 180, -10, 0, 0, WT, 'brick', [], 'bay side');
  wall('y', 270, -10, 0, 0, WT, 'brick', [], 'bay side');
  {
    const pb = (a, b, z, zt, m, lab, t0 = -20, t1 = -10) => box(a, t0, z, b, t1, zt, m, lab);
    const zs = ENT.zs, R = ENT.R, mid = 230;
    pb(200, 204, G, zs, { color: WHITE }, 'door frame'); pb(256, 260, G, zs, { color: WHITE }, 'door frame');
    pb(204, 256, zs, zs + 4, { color: WHITE }, 'transom');
    for (let a = 200; a < 260; a += 4) {
      const dx = a + 2 - mid, top = zs + r2(Math.sqrt(Math.max(0, R * R - dx * dx)));
      const post = a < 204 || a >= 256, bar = a === 228;
      if (post) { if (top > zs) pb(a, a + 4, zs, top, { color: WHITE }, 'arch frame'); }
      else {
        if (bar || top - 4 <= zs + 4) pb(a, a + 4, zs + 4, top, { color: WHITE }, bar ? 'fan bar' : 'arch frame');
        else {
          pb(a, a + 4, zs + 4, top - 4, GLASS, 'fanlight', -16, -14);
          pb(a, a + 4, zs + 4, top - 4, { color: WHITE }, 'fan frame', -20, -16); pb(a, a + 4, zs + 4, top - 4, { color: WHITE }, 'fan frame', -14, -10);
          pb(a, a + 4, top - 4, top, { color: WHITE }, 'arch frame');
        }
      }
      const ring = Math.min(zs + R + 8, top + 8);
      if (ring > top) pb(a, a + 4, top, ring, { color: shade(BR[1], 0.88) }, 'archivolt');
      if (zs + R + 8 > ring) pb(a, a + 4, ring, zs + R + 8, { color: brickC() }, 'arch infill');
      // the raised brick surround, a course proud of the bay
      const so = zs + r2(Math.sqrt(Math.max(0, (R + 8) ** 2 - dx * dx)));
      if (a < 224 || a >= 236) pb(a, a + 4, Math.max(top, so - 6), so + 2, { color: shade(BR[2], 0.96) }, 'arch surround', -22, -20);
    }
    for (const a of [192, 260]) pb(a, a + 8, G, zs + 2, { color: shade(BR[2], 0.96) }, 'arch pier', -22, -20);
    pb(224, 236, zs + R, zs + R + 16, { color: STONE }, 'keystone', -24, -20);
    // open double doors (black, swung in), brass knobs, lanterns either side
    box(204, -10, G, 208, 16, G + 62, { color: doorC }, 'front door (open)');
    box(252, -10, G, 256, 16, G + 62, { color: doorC }, 'front door (open)');
    box(208, 10, G + 30, 210, 12, G + 32, METAL, 'door knob');
    for (const x of [184, 268]) {
      box(x, -24, G + 44, x + 8, -20, G + 46, { color: [30, 30, 30] }, 'lantern bracket');
      box(x, -30, G + 36, x + 8, -24, G + 52, GLOW([255, 220, 160], 3), 'lantern');
      box(x - 2, -32, G + 52, x + 10, -22, G + 54, { color: [30, 30, 30] }, 'lantern cap');
    }
    // the stone stoop: a 3-stud landing then two steps (coursed)
    box(186, -74, 0, 274, -20, 8, { color: shade(STONE, 0.94) }, 'stoop');
    box(186, -62, 8, 274, -20, 16, { color: shade(STONE, 0.97) }, 'stoop');
    box(186, -50, 16, 274, -20, 24, { color: STONE }, 'stoop');
  }
  // ends: the chimney gable (x 0..10) blank but for the library door; the far end a window up and down
  const libDoor = op(200, 230, G, G + 64);
  wall('y', 0, 10, 290, 0, WT, 'brick', [libDoor], 'west end');
  const eastG = op(30, 66, G + 18, G + 72), eastU = op(30, 66, U + 16, U + 70), garDoor = op(230, 260, G, G + 64);
  wall('y', 450, 10, 290, 0, WT, 'brick', [eastG, eastU, garDoor], 'east end');
  windowG('y', 450, 1, eastG); windowG('y', 450, 1, eastU);
  // back: open to the Aspen room x 140..440 (the rear hall's arch, the kitchen door), windows over the pool
  const backDoor = op(100, 130, G, G + 64), aspArch = op(210, 250, G, G + 70), kitAsp = op(360, 390, G, G + 64);
  const backG = op(40, 76, G + 18, G + 72), backU = op(40, 76, U + 30, U + 70);
  wall('x', 290, 0, 460, 0, WT, 'brick', [backDoor, aspArch, kitAsp, backG, backU], 'back');
  windowG('x', 290, 1, backG); windowG('x', 290, 1, backU, { rows: 2 });
  box(backDoor.a0 + 26, 260, G, backDoor.a1, 290, G + 64, { color: doorC }, 'back door (open)');
  box(96, 300, 0, 134, 330, 24, { color: STONE }, 'back stoop');
  box(96, 330, 4, 134, 342, 14, { color: shade(STONE, 0.95) }, 'back step');
  // the Aspen room's gable over the main back wall
  const mainExcl = [[-10, 88, 0, 272], [460, 88, 470, 272], [130, 300, 450, 310], [186, -80, 274, -20], [-50, 20, 0, 80], [90, 300, 140, 330]];
  cornice([[0, 0, 460, 300], [180, -20, 280, 0]], WT, [[-10, 30, 0, 70], [130, 300, 450, 310]], 'main');
  waterTable([[0, 0, 460, 300], [180, -20, 280, 0]], mainExcl, 'main');

  // ------------------------------------------------------- main interior --
  // ground: living (x 10..180, y 10..150) | foyer (190..270, -10..190) | dining (280..450, 10..150);
  // bar (10..180, 160..290) | rear hall (190..270, 200..290) | kitchen (280..450, 160..290)
  const livDoor = op(20, 50, G, G + 64), barDoor = op(230, 260, G, G + 64), bedW = op(192, 222, U, U + 64), bathW = op(248, 278, U, U + 64);
  const dinOpen = op(40, 100, G, G + 70), kitDoor = op(230, 260, G, G + 64), bedE = op(192, 222, U, U + 64), bathE = op(248, 278, U, U + 64);
  wall('y', 180, 10, 290, 20, UC, 'paint', [livDoor, barDoor, bedW, bathW], 'foyer west');
  wall('y', 270, 10, 290, 20, UC, 'paint', [dinOpen, kitDoor, bedE, bathE], 'foyer east');
  wall('x', 150, 10, 180, 20, GC, 'paint', [op(100, 130, G, G + 64)], 'living partition');
  wall('x', 150, 280, 450, 20, GC, 'paint', [op(300, 360, G, G + 70)], 'dining partition');
  wall('x', 190, 190, 270, 20, GC, 'paint', [op(232, 264, G, G + 70)], 'foyer back');
  wall('x', 230, 10, 180, U - 4, UC, 'paint', [op(130, 160, U, U + 64)], 'upper west partition');
  wall('x', 230, 280, 450, U - 4, UC, 'paint', [op(300, 330, U, U + 64)], 'upper east partition');
  floor('living', [10, 10, 180, 150], G);
  floor('hall', [10, 160, 180, 290], G);
  floor('living', [280, 10, 450, 150], G);
  floor('kitchen', [280, 160, 450, 290], G);
  // the foyer: black and white marble checker, 2 studs a square
  for (let x = 190; x < 270; x += 20) for (let y = -10; y < 190; y += 20)
    box(x, y, G - 4, Math.min(270, x + 20), Math.min(190, y + 20), G, { color: ((x - 190) / 20 + (y + 10) / 20) % 2 ? [40, 40, 44] : [236, 234, 228] }, 'marble');
  floor('hall', [190, 200, 270, 290], G);
  // ceilings and the upper floor (the foyer open to the roof ceiling)
  for (const [a, b, c, d] of [[10, 10, 180, 290], [280, 10, 450, 290], [190, 190, 270, 290]])
    box(a, b, GC, c, d, GC + 4, { asset: TILE, color: [238, 236, 230], direction: 5 }, 'ground ceiling');
  floor('bedroom', [10, 10, 180, 230], U); floor('bathroom', [10, 240, 180, 290], U);
  tileFloor(fadd, [280, 10, 450, 230], U, pickRoomStyle('bedroom', r), r); tileFloor(fadd, [280, 240, 450, 290], U, pickRoomStyle('bathroom', r), r);
  floor('hall', [190, 190, 270, 290], U);
  for (const [a, b, c, d] of [[10, 10, 180, 290], [280, 10, 450, 290], [190, -10, 270, 290]])
    box(a, b, UC, c, d, UC + 4, { asset: TILE, color: [238, 236, 230], direction: 5 }, 'upper ceiling');
  // the stair up the foyer's west wall: bottom landing y 44..78, 8 courses on 14 treads to the gallery
  const TREAD = [128, 90, 58], RISE = [12, 12, 12, 12, 12, 12, 10, 10];
  for (let k = 0, z = G; k < 8; z += RISE[k], k++) box(196, 78 + 14 * k, z, 232, 190, z + RISE[k], { color: shade(TREAD, k % 2 ? 0.9 : 1) }, 'stair course');
  box(232, 78, G, 242, 92, G + 12, { color: TREAD }, 'bullnose step');
  for (let k = 0, z = G; k < 8; z += RISE[k], k++) {
    const y = 78 + 14 * k, top = z + RISE[k];
    if (k > 0) box(230, y + 6, top, 232, y + 8, top + 30, { color: WHITE }, 'baluster');
    box(228, y, top + 30, 234, y + 14, top + 34, { color: shade(TREAD, 0.7) }, 'handrail');
  }
  box(232, 68, G, 240, 76, G + 46, { color: shade(TREAD, 0.8) }, 'newel post');
  for (let x = 238; x < 262; x += 8) box(x, 190, U, x + 2, 192, U + 30, { color: WHITE }, 'gallery baluster');
  box(232, 190, U + 30, 266, 194, U + 34, { color: shade(TREAD, 0.7) }, 'gallery rail');
  // chandelier in the foyer: chain, two glowing tiers
  box(228, 88, UC - 40, 232, 92, UC, { color: [180, 150, 70], material: 'BMC_Metallic' }, 'chandelier chain');
  box(216, 76, UC - 50, 244, 104, UC - 40, GLOW([255, 236, 190], 3), 'chandelier');
  box(222, 82, UC - 58, 238, 98, UC - 50, GLOW([255, 236, 190], 3), 'chandelier');
  const pp = () => pick(PAPERS);
  const foyerP = pp();
  finishRoom({ x0: 190, y0: -10, x1: 270, y1: 190, z0: G, z1: UC }, { paper: foyerP, wains: WAINS[0], skip: { y1: [[190, 236]] } });
  finishRoom({ x0: 190, y0: 200, x1: 270, y1: 290, z0: G, z1: GC }, { paper: foyerP, wains: WAINS[0] });
  finishRoom({ x0: 190, y0: 190, x1: 270, y1: 290, z0: U, z1: UC }, { paper: foyerP, wains: WAINS[0] });
  const FP0 = 34, FP1 = 66;                           // living room fireplace on the chimney gable
  finishRoom({ x0: 10, y0: 10, x1: 180, y1: 150, z0: G, z1: GC }, { paper: pp(), wains: pick(WAINS), skip: { x0: [[FP0 - 4, FP1 + 4]] } });
  finishRoom({ x0: 10, y0: 160, x1: 180, y1: 290, z0: G, z1: GC }, { paper: { kind: 'paint', color: [70, 40, 36] }, wains: WAINS[2] });
  finishRoom({ x0: 280, y0: 10, x1: 450, y1: 150, z0: G, z1: GC }, { paper: pp(), wains: pick(WAINS) });
  finishRoom({ x0: 280, y0: 160, x1: 450, y1: 290, z0: G, z1: GC }, { paper: { kind: 'paint', color: [236, 232, 220] }, wains: TILEWAINS[0], skip: { y0: [[290, 446]] } });
  finishRoom({ x0: 10, y0: 10, x1: 180, y1: 230, z0: U, z1: UC }, { paper: pp(), wains: pick(WAINS) });
  finishRoom({ x0: 10, y0: 240, x1: 180, y1: 290, z0: U, z1: UC }, { paper: pp(), wains: TILEWAINS[0] });
  finishRoom({ x0: 280, y0: 10, x1: 450, y1: 230, z0: U, z1: UC }, { paper: pp(), wains: pick(WAINS) });
  finishRoom({ x0: 280, y0: 240, x1: 450, y1: 290, z0: U, z1: UC }, { paper: pp(), wains: TILEWAINS[0] });
  // living room: fireplace (stone surround, black firebox, embers, mantel), sofa + chairs, rug
  for (let z = G, k = 0; z < GC; z += 12, k++) {
    const zt = Math.min(GC, z + 12);
    if (z < G + 36) { box(10, FP0, z, 26, FP0 + 8, zt, { color: shade(STONE, k % 2 ? 0.94 : 1) }, 'fireplace'); box(10, FP1 - 8, z, 26, FP1, zt, { color: shade(STONE, k % 2 ? 1 : 0.94) }, 'fireplace'); }
    else box(10, FP0, z, 26, FP1, zt, { color: shade(STONE, k % 2 ? 0.94 : 1) }, 'chimney breast');
  }
  box(10, FP0 + 8, G, 18, FP1 - 8, G + 36, { color: [30, 28, 28] }, 'firebox');
  box(18, FP0 + 8, G + 26, 26, FP1 - 8, G + 36, { color: [30, 28, 28] }, 'firebox lintel');
  box(18, FP0 + 10, G, 24, FP1 - 10, G + 4, GLOW([255, 120, 40], 3), 'embers');
  box(26, FP0 - 4, G + 36, 32, FP1 + 4, G + 40, { color: WHITE }, 'mantel');
  box(26, FP0 - 4, G, 46, FP1 + 4, G + 2, { color: shade(STONE, 0.9) }, 'hearth');
  const sofaC = pick([[120, 60, 56], [70, 90, 120], [110, 120, 92], [176, 160, 130]]);
  box(70, 24, G, 150, 120, G + 2, { color: pick([[140, 40, 40], [40, 60, 100], [150, 120, 80]]) }, 'rug');
  box(110, 30, G + 2, 126, 70, G + 12, { color: sofaC }, 'sofa seat');
  box(126, 30, G + 2, 134, 70, G + 24, { color: shade(sofaC, 0.85) }, 'sofa back');
  box(72, 32, G + 2, 92, 68, G + 12, { color: [110, 76, 50] }, 'coffee table');
  for (const y of [86, 106]) { box(100, y, G + 2, 116, y + 14, G + 12, { color: shade(sofaC, 1.1) }, 'armchair'); box(116, y, G + 2, 122, y + 14, G + 22, { color: shade(sofaC, 0.9) }, 'armchair back'); }
  light(95, 80, GC);
  // bar: counter with stools, back bar of glowing bottles against the partition
  box(120, 170, G, 134, 220, G + 28, { color: [80, 50, 34] }, 'bar counter');
  box(118, 170, G + 28, 136, 222, G + 32, { color: [40, 30, 26] }, 'bar top');
  for (const y of [176, 192, 208]) { box(104, y, G, 108, y + 4, G + 14, METAL, 'stool leg'); box(100, y - 2, G + 14, 112, y + 6, G + 18, { color: [140, 40, 40] }, 'stool seat'); }
  box(154, 166, G, 174, 222, G + 28, { color: [80, 50, 34] }, 'back bar');
  box(154, 166, G + 28, 174, 222, G + 30, { color: [40, 30, 26] }, 'back bar top');
  for (let y = 168, k = 0; y < 220; y += 6, k++) box(162, y, G + 30, 166, y + 4, G + 44, GLOW(pick([[90, 160, 60], [200, 120, 40], [120, 40, 30], [210, 210, 230]]), 1), 'bottle');
  box(154, 166, G + 60, 174, 222, G + 62, { color: [80, 50, 34] }, 'bottle shelf');
  light(95, 225, GC, [255, 210, 160]);
  // dining: long table, eight chairs, chandelier, sideboard
  box(330, 60, G, 410, 100, G + 22, { color: [100, 66, 40] }, 'dining table');
  for (const x of [336, 356, 376, 396]) for (const y of [48, 104]) box(x, y, G, x + 8, y + 8, G + 12, { color: [80, 52, 32] }, 'chair');
  for (const y of [72, 80]) for (const x of [318, 414]) box(x, y, G, x + 8, y + 8, G + 12, { color: [80, 52, 32] }, 'chair');
  box(366, 76, GC - 20, 374, 84, GC, { color: [180, 150, 70], material: 'BMC_Metallic' }, 'chandelier chain');
  box(356, 66, GC - 28, 384, 94, GC - 20, GLOW([255, 236, 190], 3), 'chandelier');
  box(420, 90, G, 446, 130, G + 28, { color: [100, 66, 40] }, 'sideboard');
  // kitchen: cabinets + worktop along the dining partition, the range (red knobs), steel fridge, island, breakfast table
  const CAB = pick([[236, 232, 220], [60, 70, 80], [120, 140, 120]]), TOP = pick([[230, 226, 220], [50, 50, 54]]);
  for (let x = 290, k = 0; x < 406; x += 20, k++) box(x, 160, G, Math.min(406, x + 20), 180, G + 26, { color: shade(CAB, k % 2 ? 0.95 : 1) }, 'base cabinet');
  box(290, 160, G + 26, 336, 182, G + 30, { color: TOP }, 'worktop'); box(360, 160, G + 26, 406, 182, G + 30, { color: TOP }, 'worktop');
  box(336, 160, G + 26, 360, 182, G + 30, METAL, 'range top');
  for (const x of [338, 344, 350, 356]) box(x, 182, G + 22, x + 2, 184, G + 24, { color: [200, 30, 30] }, 'red knob');
  box(336, 160, G + 50, 360, 176, G + 60, METAL, 'range hood');
  for (let x = 290; x < 406; x += 20) if (x < 330 || x >= 370) box(x, 160, G + 50, Math.min(406, x + 20), 172, G + 80, { color: shade(CAB, 0.97) }, 'wall cabinet');
  box(408, 160, G, 446, 186, G + 62, METAL, 'fridge');
  box(426, 186, G + 20, 428, 188, G + 50, { color: [60, 60, 64] }, 'fridge handle');
  box(330, 212, G, 400, 236, G + 26, { color: shade(CAB, 0.9) }, 'island');
  box(326, 210, G + 26, 404, 240, G + 30, { color: TOP }, 'island top');
  for (const x of [340, 360, 380]) { box(x, 248, G, x + 4, 252, G + 14, METAL, 'stool leg'); box(x - 4, 244, G + 14, x + 8, 256, G + 18, { color: [60, 60, 64] }, 'stool seat'); }
  box(296, 250, G, 330, 280, G + 22, { color: [140, 100, 64] }, 'breakfast table');
  light(365, 200, GC); light(310, 265, GC);
  // upstairs: beds, dressers, baths
  const bed = (x0, y0, x1, y1, head, c) => {
    box(x0, y0, U, x1, y1, U + 10, { color: [110, 76, 50] }, 'bed frame');
    box(x0 + 2, y0 + 2, U + 10, x1 - 2, y1 - 2, U + 14, { color: c }, 'bedspread');
    box(...head.slice(0, 2), U, ...head.slice(2), U + 30, { color: [96, 66, 42] }, 'headboard');
  };
  const bedC = () => pick([[180, 60, 60], [70, 100, 150], [210, 200, 170], [120, 150, 110]]);
  bed(76, 156, 120, 222, [76, 222, 120, 226], bedC());
  box(20, 150, U, 44, 164, U + 30, { color: [120, 84, 54] }, 'dresser');
  light(95, 120, UC);
  bed(346, 156, 394, 222, [346, 222, 394, 226], bedC());
  box(286, 150, U, 300, 178, U + 30, { color: [120, 84, 54] }, 'dresser');
  box(420, 150, U, 444, 164, U + 30, { color: [120, 84, 54] }, 'dresser');
  light(365, 120, UC);
  const bath = (x0, x1) => {
    const TUB = [244, 244, 240], Z = U;
    box(x0, 256, Z, x0 + 50, 286, Z + 2, { color: TUB }, 'tub bottom');
    box(x0, 256, Z + 2, x0 + 4, 286, Z + 16, { color: TUB }, 'tub end'); box(x0 + 46, 256, Z + 2, x0 + 50, 286, Z + 16, { color: TUB }, 'tub end');
    box(x0 + 4, 256, Z + 2, x0 + 46, 260, Z + 16, { color: TUB }, 'tub side');
    box(x0 + 4, 260, Z + 2, x0 + 46, 286, Z + 8, { color: [150, 200, 220], material: 'BMC_Glass' }, 'bath water');
    box(x0 + 62, 274, Z, x0 + 72, 286, Z + 8, { color: TUB }, 'toilet base');
    box(x0 + 60, 270, Z + 8, x0 + 74, 286, Z + 12, { color: TUB }, 'toilet seat');
    box(x0 + 62, 282, Z + 12, x0 + 72, 286, Z + 24, { color: TUB }, 'toilet tank');
    box(x0 + 84, 274, Z, x0 + 120, 286, Z + 24, { color: [120, 86, 60] }, 'vanity');
    box(x0 + 82, 272, Z + 24, x0 + 122, 286, Z + 26, { color: [232, 230, 226] }, 'vanity top');
    box(x0 + 96, 276, Z + 26, x0 + 108, 282, Z + 28, METAL, 'basin');
    light((x0 + x1) / 2, 265, UC, [255, 244, 220]);
  };
  bath(20, 170); bath(300, 440);
  light(230, 240, UC); light(230, 245, GC);

  // ============================================================ CHIMNEY ==
  // the tall end stack on the living-room gable: a wide base to z 140, weathered in, then up past the ridge
  for (let z = 0, k = 0; z < 390; z += 12, k++) {
    const zt = Math.min(390, z + 12), c = BR[k % 4];
    if (z < 140) box(-50, 20, z, 0, 80, zt, { color: c }, 'chimney base');
    else box(-40, 30, z, 0, 70, zt, { color: c }, 'chimney');
  }
  box(-44, 26, 390, 4, 74, 396, { color: STONE }, 'chimney cap');
  for (const y of [36, 54]) box(-28, y, 396, -16, y + 10, 408, { color: [150, 80, 60] }, 'chimney pot');

  // ============================================================ LIBRARY ==
  const libWin = [op(-74, -38, G + 18, G + 72)], libEnd = op(162, 198, G + 18, G + 72);
  wall('x', 90, -120, 0, 0, WG, 'brick', libWin, 'library front');
  wall('x', 260, -120, 0, 0, WG, 'brick', [], 'library back');
  wall('y', -120, 100, 260, 0, WG, 'brick', [libEnd], 'library end');
  libWin.forEach(o => windowG('x', 90, -1, o)); windowG('y', -120, -1, libEnd);
  cornice([[-120, 90, 0, 270]], WG, [[0, 0, 100, 400]], 'library');
  waterTable([[-120, 90, 0, 270]], [[0, 0, 100, 400]], 'library');
  floor('living', [-110, 100, 0, 260], G);
  box(-110, 100, GC, 0, 260, GC + 4, { asset: TILE, color: [150, 110, 72], direction: 5 }, 'library ceiling');
  finishRoom({ x0: -110, y0: 100, x1: 0, y1: 260, z0: G, z1: GC }, { paper: PANEL, wains: WAINS[2], trim: [96, 64, 40], skip: { y1: [[-90, -20]], x0: [[110, 156], [204, 250]] } });
  // bookcases (books of all colours) on the back wall and either side of the end window
  const BOOK = [[140, 40, 36], [40, 60, 110], [50, 90, 50], [170, 140, 70], [90, 40, 70], [200, 190, 160], [60, 40, 30]];
  const bookcase = (x0, y0, x1, y1, along) => {
    box(x0, y0, G, x1, y1, G + 80, { color: [90, 60, 36] }, 'bookcase');
    for (let z = G + 6; z + 14 <= G + 78; z += 18) {
      const [p0, p1] = along === 'x' ? [x0 + 4, x1 - 4] : [y0 + 4, y1 - 4];
      for (let a = p0; a < p1;) {
        const w = Math.min(p1 - a, 4 + 2 * Math.floor(r() * 3)), h = 10 + 2 * Math.floor(r() * 3);
        if (along === 'x') box(a, y0 - 4, z, a + w, y0, z + h, { color: pick(BOOK) }, 'books');
        else box(x1, a, z, x1 + 4, a + w, z + h, { color: pick(BOOK) }, 'books');
        a += w;
      }
    }
  };
  bookcase(-90, 244, -20, 260, 'x');
  bookcase(-110, 110, -96, 156, 'y'); bookcase(-110, 204, -96, 250, 'y');
  box(-80, 150, G, -36, 176, G + 24, { color: [96, 64, 40] }, 'desk');
  box(-78, 152, G + 24, -38, 174, G + 26, { color: [40, 70, 50] }, 'desk leather');
  box(-64, 180, G, -52, 192, G + 12, { color: [120, 40, 36] }, 'desk chair');
  box(-64, 192, G, -52, 196, G + 26, { color: [120, 40, 36] }, 'desk chair back');
  for (const [x, y] of [[-90, 120], [-30, 120]]) { box(x, y + 4, G, x + 18, y + 16, G + 12, { color: [120, 40, 36] }, 'armchair'); box(x, y, G, x + 18, y + 4, G + 24, { color: [100, 32, 30] }, 'armchair back'); }
  box(-84, 136, G, -30, 146, G + 2, { color: [130, 50, 40] }, 'rug');
  box(-46, 152, G + 26, -42, 156, G + 40, METAL, 'lamp'); box(-50, 148, G + 40, -38, 160, G + 46, GLOW([255, 220, 160], 2), 'lamp shade');
  light(-55, 210, GC, [255, 220, 170]);

  // ============================================================= GARAGE ==
  // three arched carriage doors, the middle one open on a car; steps up to the kitchen door
  const GDX = [476, 534, 592];
  const gDoors = GDX.map(a => op(a, a + 52, 4, 64 + 26, { R: 26, zs: 64, cut: 92 }));
  wall('x', 90, 460, 660, 0, WG, 'brick', gDoors.map(o => ({ ...o, z0: 4 })), 'garage front');
  const gBack = op(560, 596, G + 18, G + 72);
  wall('x', 260, 460, 660, 0, WG, 'brick', [gBack], 'garage back');
  wall('y', 650, 100, 260, 0, WG, 'brick', [op(160, 196, G + 18, G + 72)], 'garage end');
  windowG('x', 260, 1, gBack, { shutters: false }); windowG('y', 650, 1, op(160, 196, G + 18, G + 72), { shutters: false });
  gDoors.forEach((o, i) => {
    const mid = o.a0 + 26;
    for (let a = o.a0; a < o.a1; a += 4) {
      const dx = a + 2 - mid, top = o.zs + r2(Math.sqrt(Math.max(0, 26 * 26 - dx * dx)));
      const post = a < o.a0 + 4 || a >= o.a1 - 4;
      if (post) box(a, 90, 4, a + 4, 100, top, { color: WHITE }, 'carriage frame');
      else if (i !== 1) box(a, 94, 4, a + 4, 98, top - 4, { color: shade(doorC === DOORS[2] ? [70, 50, 36] : [60, 44, 32], (a - o.a0) % 8 ? 0.9 : 1) }, 'carriage door');
      if (!post) box(a, 90, top - 4, a + 4, 100, top, { color: WHITE }, 'carriage frame');
      const ring = Math.min(92, top + 6);
      if (ring > top) box(a, 90, top, a + 4, 100, ring, { color: shade(BR[1], 0.9) }, 'archivolt');
    }
    if (i !== 1) for (const dx of [10, 38]) box(o.a0 + dx, 92, 40, o.a0 + dx + 4, 94, 44, METAL, 'door handle');
    box(mid - 4, 86, 88, mid + 4, 90, 100, { color: STONE }, 'keystone');
    box(o.a0 + 4, 30, 108 - 4, o.a1 - 4, 34, 108, { color: [60, 60, 64] }, 'door rail');
  });
  box(470, 100, 0, 650, 260, 4, { asset: TILE, color: [168, 166, 160] }, 'garage floor');
  box(470, 100, GC, 650, 260, GC + 4, { asset: TILE, color: [220, 218, 212], direction: 5 }, 'garage ceiling');
  // the car in the open bay
  {
    const cx0 = 542, cy0 = 120, CC = pick([[150, 20, 24], [30, 40, 60], [200, 200, 204], [20, 20, 22]]);
    for (const [x, y] of [[cx0, cy0 + 16], [cx0 + 30, cy0 + 16], [cx0, cy0 + 96], [cx0 + 30, cy0 + 96]]) box(x, y, 4, x + 6, y + 20, 20, { color: [24, 24, 24] }, 'tyre');
    box(cx0 + 6, cy0 + 4, 10, cx0 + 30, cy0 + 126, 20, { color: [30, 30, 32] }, 'car chassis');
    box(cx0, cy0, 20, cx0 + 36, cy0 + 130, 34, { color: CC }, 'car body');
    box(cx0 + 4, cy0 + 40, 34, cx0 + 32, cy0 + 90, 48, { color: [40, 50, 60], material: 'BMC_Glass' }, 'car cabin');
    box(cx0 + 4, cy0 + 50, 48, cx0 + 32, cy0 + 84, 50, { color: CC }, 'car roof');
    for (const x of [cx0 + 4, cx0 + 26]) box(x, cy0 - 2, 22, x + 6, cy0, 28, GLOW([255, 250, 230], 2), 'headlight');
  }
  box(460, 224, 4, 490, 260, G, { color: STONE }, 'garage landing');
  box(490, 224, 4, 502, 260, 14, { color: shade(STONE, 0.95) }, 'garage step');
  box(596, 236, 4, 646, 256, 30, { color: [120, 84, 54] }, 'workbench');
  light(510, 180, GC); light(610, 180, GC);
  cornice([[460, 90, 660, 270]], WG, [[360, 0, 460, 400]], 'garage');
  waterTable([[460, 90, 660, 270]], [[360, 0, 460, 400], ...GDX.map(a => [a, 80, a + 52, 90])], 'garage');

  // ========================================================= ASPEN ROOM ==
  // walls: sides x 140..150 / 430..440 to the eave, the back gable y 510..520 up to the roof
  const aWinW = [op(330, 366, G + 16, G + 112), op(450, 486, G + 16, G + 112)], aDoor = op(400, 430, G, G + 66);
  const aWinE = [op(330, 366, G + 16, G + 112), op(450, 486, G + 16, G + 112)];
  wall('y', 140, 310, 510, 0, AT, 'brick', [...aWinW, aDoor], 'aspen west');
  wall('y', 430, 310, 510, 0, AT, 'brick', aWinE, 'aspen east');
  wall('y', 140, 300, 310, 0, AT, 'brick', [], 'aspen west');
  wall('y', 430, 300, 310, 0, AT, 'brick', [], 'aspen east');
  for (const o of aWinW) windowG('y', 140, -1, o, { rows: 6, shutters: false });
  for (const o of aWinE) windowG('y', 430, 1, o, { rows: 6, shutters: false });
  box(154, 430, G, 180, 434, G + 66, { color: doorC }, 'patio door (open)');
  const AW = [op(180, 252, G + 10, G + 106, { R: 36, zs: G + 70, cut: G + 106 }), op(348, 420, G + 10, G + 106, { R: 36, zs: G + 70, cut: G + 106 })];
  const backTop = x => roofBottom(x, 510);
  WALLS.push({ axis: 'x', line: 510, a0: 140, a1: 440, z0: 0, z1: AT, openings: AW });
  wallToRoof('x', 510, 140, 440, 0, x => backTop(x) ?? AT, AW, 'aspen gable');
  for (const o of AW) windowG('x', 510, 1, o, { cols: 6, rows: 3, shutters: false });
  // the main back wall's gable inside the vault (over z 204, up to the Aspen roof)
  wallToRoof('x', 290, 150, 430, WT, x => roofBottom(x, 290) ?? WT, [], 'aspen front gable');
  // top plates sealing the slot between the side walls and the eave lips
  for (const xw of [140, 430]) { const top = roofBottom(xw, 400); if (top > AT) box(xw, 300, AT, xw + 10, 510, top, { color: WOOD[1] }, 'wall plate'); }
  cornice([[140, 300, 440, 520]], AT, [[130, 150, 450, 300], [270, 520, 330, 560]], 'aspen');
  waterTable([[140, 300, 440, 520]], [[130, 150, 450, 300], [270, 520, 330, 560], [100, 386, 140, 440]], 'aspen');
  // travertine floor in 2-stud slabs, three tones
  const TRAV = [[222, 206, 178], [210, 194, 166], [230, 216, 190]];
  for (let x = 150; x < 430; x += 20) for (let y = 300; y < 510; y += 20) box(x, y, G - 4, Math.min(430, x + 20), Math.min(510, y + 20), G, { color: pick(TRAV) }, 'travertine');
  finishRoom({ x0: 150, y0: 300, x1: 430, y1: 510, z0: G, z1: AT }, { paper: { kind: 'paint', color: [232, 222, 200] }, wains: { kind: 'stripe', cols: [[6, PINE[0]], [2, PINE[1]]] }, trim: WOOD[0], skip: { y1: [[266, 334]], y0: [[150, 430]] } });
  // the stone fireplace on the back wall, the breast up to the vault; the stack outside
  const STN = [[150, 140, 126], [170, 160, 142], [130, 122, 110], [186, 176, 156]];
  for (let z = G, k = 0; z < 300; z += 10, k++) {
    const top = Math.min(roofBottom(270, 510), roofBottom(320, 510));
    if (z >= top) break;
    const zt = Math.min(top, z + 10);
    if (z < G + 50) { box(270, 480, z, 286, 510, zt, { color: STN[k % 4] }, 'fireplace'); box(314, 480, z, 330, 510, zt, { color: STN[(k + 2) % 4] }, 'fireplace'); }
    else box(270, 480, z, 330, 510, zt, { color: STN[k % 4] }, 'stone breast');
  }
  box(286, 500, G, 314, 510, G + 50, { color: [30, 28, 28] }, 'firebox');
  box(290, 488, G, 310, 500, G + 4, GLOW([255, 120, 40], 3), 'embers');
  box(266, 474, G + 50, 334, 480, G + 54, { color: WOOD[3] }, 'mantel beam');
  box(262, 460, G, 338, 480, G + 4, { color: STN[2] }, 'hearth');
  for (let z = 0, k = 0; z < 340; z += 12, k++) box(280, 520, z, 320, 550, Math.min(340, z + 12), { color: STN[k % 4] }, 'stone chimney');
  box(276, 516, 340, 324, 554, 346, { color: STN[2] }, 'chimney cap');
  // trusses every 6 studs: tie beam, king post, queen posts, rafters stepped under the pine ceiling
  const TB = WOOD[3];
  for (const ty of [350, 410, 470]) {
    box(156, ty - 5, AT - 18, 424, ty + 5, AT - 8, { color: TB }, 'tie beam');
    const posts = [[286, 294], [206, 212], [368, 374]];
    for (const [p, q] of posts) box(p, ty - 4, AT - 8, q, ty + 4, roofBottom(p, ty) - 8, { color: TB }, 'truss post');
    for (let x = 150; x < 430; x += 10) {
      const top = roofBottom(x, ty);
      let spans = [[Math.max(156, x), Math.min(424, x + 10)]];
      for (const [p, q] of posts) spans = spans.flatMap(([a, b]) => (q <= a || p >= b) ? [[a, b]] : [[a, p], [q, b]].filter(([u, v]) => v > u));
      for (const [a, b] of spans) if (top - 8 >= AT - 8) box(a, ty - 4, top - 8, b, ty + 4, top, { color: shade(TB, 1.08) }, 'rafter');
    }
    box(288, ty - 2, AT - 30, 292, ty + 2, AT - 18, { color: [180, 150, 70], material: 'BMC_Metallic' }, 'chandelier chain');
    box(278, ty - 8, AT - 40, 302, ty + 8, AT - 30, GLOW([255, 226, 170], 3), 'chandelier');
  }
  // furniture: grand piano by the west arched window, sofas facing the fire on a rug, bar along the east wall
  box(170, 440, G, 220, 476, G + 4, { color: [20, 20, 22] }, 'piano legs');
  box(166, 436, G + 4, 226, 480, G + 22, { color: [16, 16, 18] }, 'grand piano');
  box(170, 476, G + 22, 222, 480, G + 40, { color: [16, 16, 18] }, 'piano lid');
  box(186, 426, G, 206, 434, G + 12, { color: [16, 16, 18] }, 'piano bench');
  box(240, 380, G, 360, 450, G + 2, { color: [60, 90, 80] }, 'rug');
  const sC = pick([[30, 60, 60], [120, 70, 50], [80, 60, 50]]);
  box(256, 390, G + 2, 344, 406, G + 12, { color: sC }, 'sofa seat'); box(256, 382, G + 2, 344, 390, G + 24, { color: shade(sC, 0.85) }, 'sofa back');
  box(276, 420, G + 2, 324, 440, G + 12, { color: [110, 76, 50] }, 'coffee table');
  for (const x of [240, 344]) box(x, 420, G + 2, x + 16, 440, G + 14, { color: [150, 60, 60] }, 'armchair');
  box(384, 372, G, 398, 444, G + 28, { color: [80, 54, 34] }, 'aspen bar');
  box(382, 370, G + 28, 400, 446, G + 32, { color: [50, 36, 26] }, 'aspen bar top');
  box(410, 374, G, 424, 444, G + 28, { color: [236, 232, 222] }, 'kitchen cabinets');
  box(410, 374, G + 28, 424, 444, G + 30, { color: [60, 60, 64] }, 'kitchen worktop');
  for (const y of [380, 402, 424]) { box(370, y, G, 374, y + 4, G + 14, METAL, 'stool leg'); box(366, y - 2, G + 14, 378, y + 6, G + 18, { color: [120, 60, 40] }, 'stool seat'); }

  // ==================================================== POOL + GROUNDS ==
  for (let x = -120; x < 140; x += 20) for (let y = 342; y < 480; y += 20) {
    const x1 = Math.min(140, x + 20), y1 = Math.min(480, y + 20);
    if (x >= -100 && x1 <= 20 && y >= 362 && y1 <= 462) continue;            // the pool
    box(x, y, 0, x1, y1, 4, { color: pick(TRAV) }, 'pool deck');
  }
  for (let x = -120; x < 140; x += 20) box(x, 330, 0, Math.min(140, x + 20), 342, 4, { color: pick(TRAV) }, 'pool deck');
  box(-100, 362, 0, 20, 462, 2, { color: [40, 110, 160] }, 'pool floor');
  box(-100, 362, 2, 20, 462, 4, { color: [90, 170, 210], material: 'BMC_Glass' }, 'pool water');
  for (const [a, b, c, d] of [[-100, 358, 20, 362], [-100, 462, 20, 466]]) box(a, b, 4, c, d, 6, { color: WHITE }, 'coping');
  for (const [a, b, c, d] of [[-104, 358, -100, 466], [20, 358, 24, 466]]) box(a, b, 4, c, d, 6, { color: WHITE }, 'coping');
  for (const x of [-96, -70]) { box(x, 470, 4, x + 16, 478, 12, { color: WHITE }, 'lounger'); box(x, 474, 12, x + 16, 478, 22, { color: WHITE }, 'lounger back'); }
  box(-40, 470, 4, -20, 478, 20, { color: [40, 120, 160] }, 'towel stand');
  box(112, 390, 4, 140, 440, 14, { color: STONE }, 'patio step');
  box(126, 390, 14, 140, 440, 24, { color: STONE }, 'patio step');
  // boxwood hedges along the front (two greens, lumpy tops)
  for (const [a, b] of [[20, 170], [290, 440]]) for (let x = a, k = 0; x < b; x += 10, k++) box(x, -16, 0, Math.min(b, x + 10), -4, k % 3 ? 16 : 20, { color: k % 2 ? [56, 92, 48] : [48, 84, 42] }, 'boxwood');
  for (const [a, b] of [[-110, -60]]) for (let x = a, k = 0; x < b; x += 10, k++) box(x, 74, 0, x + 10, 86, k % 3 ? 14 : 18, { color: k % 2 ? [56, 92, 48] : [48, 84, 42] }, 'boxwood');
  // the paver motor court and the garage apron (2 x 1 stud pavers, running bond, three tones)
  const PAV = [[196, 176, 150], [184, 164, 138], [206, 188, 160], [174, 156, 132]];
  const pave = (x0, y0, x1, y1) => {
    for (let y = y0, row = 0; y < y1; y += 10, row++) for (let x = x0 - (row % 2 ? 10 : 0); x < x1; x += 20) {
      const a = Math.max(x0, x), b = Math.min(x1, x + 20);
      if (b > a) box(a, y, 0, b, Math.min(y1, y + 10), 4, { color: pick(PAV) }, 'paver');
    }
  };
  pave(-40, -150, 470, -74); pave(470, -150, 660, 90);
  for (const x of [-30, 440]) { box(x, -100, 4, x + 6, -94, 64, { color: [30, 30, 32] }, 'lamp post'); box(x - 4, -104, 64, x + 10, -90, 80, GLOW([255, 226, 170], 3), 'lamp'); }

  buildRoofs();

  // ------------------------------------------------------------- output --
  const Wst = Math.ceil((X0 + 690) / 10) - 1, Dst = Math.ceil((Y0 + 590) / 10) - 1;
  const total = (Wst + 1) * 10;
  let bricks = B.bricks.map(({ label, ...b }) => b);
  let doorX = X0 + 230;
  if (mirror) {
    bricks = bricks.map(({ _m, _tri, ...b }) => {
      const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
      if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] };
      return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
    });
    doorX = total - doorX;
  } else bricks = bricks.map(({ _m, _tri, ...b }) => b);
  return { bricks, W: Wst, D: Dst, door: [Math.round(doorX / 10)], count: bricks.length };
}

if (process.argv[1]?.endsWith('georgian.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'georgian.json';
  const h = georgian({ seed, mirror: process.argv[4] === 'mirror' });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`georgian seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}`);
}
