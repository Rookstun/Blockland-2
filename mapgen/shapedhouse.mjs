// Rectangular, L and T houses on the wallgen framework (tools/wallgen/lib.js),
// with a rounded roof built from stacked micro wedges and an attic under it.
//
//   node shapedhouse.mjs --shape L --W 40 --D 24 --E 16 --storeys 2 [--attic 0]
//                        [--at x,y,z] [--seed n] [--job out.json] [--plan]
//
// Plan (studs, x across the front, y back from the front face):
//   main body  W x D, front wall on y = 0
//   wing       D wide (same span, so the two roofs meet in a clean valley),
//              E deep, behind the main body: L = at the left end, T = centred
// The front door is in the right-hand room. Walls, glass and the door/window
// openings are wallgen's (running bond, the T-junction bridging); floors are
// floorboards (plankRects), ceilings tile, every storey 13 courses (156: a
// 6-brick player plus a 6-brick jump).
//
// Stairs: one straight flight per storey along the inside of the left gable
// wall, stacked storey over storey (and on into the attic). Each step is a
// 3-stud block growing out of the wall (nothing under it); every flight has a
// clear 3 x 3 landing at the bottom and at the top, and the floor above is
// open over the whole flight.
//
// Roof: ridge along each wing's long axis, a quarter-ellipse profile cut into
// ROOF_SEGS micro wedges a side plus a 1-stud crown. The outside walls (gables
// and the knee walls on the eaves) carry on up in running bond until they meet
// the roof, so the attic is closed; the main roof is cut away inside the
// wing's attic so the two attics join. Attic floor: boards on the wall tops,
// tile ceiling under them; a glazed window in each gable.
//
// Everything goes through builder.mjs's overlap guard; any dropped brick throws.

import fs from 'fs';
import { createRequire } from 'module';
import { makeBuilder } from './builder.mjs';
import { orientFor } from './orient.mjs';

const require = createRequire(import.meta.url);
const lib = require('../tools/wallgen/lib.js');
import { floorPieces } from './floors.mjs';
import { roofProfile as styleProfile } from './roofs.mjs';
import { furnishRoom } from './furniture.mjs';

const ST = 10, C = 12, FLOOR_H = 4;
export const COURSES = 13;
const SH = COURSES * C;
const STAIR_W = 3, LANDING = 3;
const ROOF_SEGS = 6;
// regular bricks have an ugly underside (owner): every plain block is a micro brick, ceilings and steps are tile
const MB = 'PB_DefaultMicroBrick';
// floor / ceiling looks live in floors.mjs (checker, checkerCeiling, planks)

const PAL = {
  brick: [[150, 70, 50], [135, 63, 45], [160, 75, 54], [142, 66, 47], [155, 72, 52]],
  roof: [82, 92, 112], board: [160, 114, 72], ceiling: [226, 218, 200], step: [118, 82, 52],
  glass: { color: [170, 210, 230], material: 'BMC_Glass' },
};

const even = v => 2 * Math.round(v / 2);
const key = (x, y) => x + ',' + y;

/** quarter-ellipse roof profile: [{u, h}] from the eave (u = span, h = 0) to the crown (u = 0, h = rise) */
// Straight coursed roof (owner's sample roof, 2026-10-03): about 2-stud deep
// courses, each a whole number of bricks tall, from the eave (u = span) to the
// crown (u = 0). Each band is drawn as a 1-plate lip with a wedge on top, so
// every course steps out over the one below. (segs is ignored; kept for the
// old signature.)
// (the profile itself lives in roofs.mjs; this keeps the old export)
export function roofProfile(span, rise, segs = ROOF_SEGS, style = 'gable') {
  void segs;
  return styleProfile(span, rise, style);
}

export function shapedHouse({ shape = 'L', W = 40, D = 24, E = 16, storeys = 2, attic = true, seed = 1, overhang = 1, style = 'classic', roof = 'gable', furniture = true } = {}) {
  // style 'western' (2026-10-03): a rect with its ridge running front to back,
  // the front gable hidden behind a tall false front (cornice, sign board),
  // plank siding, board floors, a covered porch on posts; no attic
  const west = style === 'western', rs = style === 'runescape';
  if (west) { shape = 'rect'; attic = false; }
  if (![W, D, E].every(v => Number.isInteger(v) && v % 2 === 0)) throw new Error('W, D, E must be even');
  if (D < LANDING * 2 + COURSES + 1) throw new Error(`D must be >= ${LANDING * 2 + COURSES + 1} so a flight with both landings fits along the gable`);
  if (shape !== 'rect' && W < D + 8) throw new Error('W must be at least D + 8 for an L or T');
  if (shape === 'T' && (W - D) % 4) throw new Error('for a T, W - D must be a multiple of 4');
  const wing = shape !== 'rect';
  const wx0 = shape === 'T' ? (W - D) / 2 : 0, wx1 = wx0 + D;

  // ------------------------------------------------------------- plan --
  const H = (line, start, end, openings = []) => ({ orient: 'H', line, start, end, openings });
  const V = (line, start, end, openings = []) => ({ orient: 'V', line, start, end, openings });
  const door = p => ({ pos0: p - 2, pos1: p + 2, type: 'door' });
  const win = p => ({ pos0: p - 1, pos1: p + 1, type: 'window' });
  // tall houses (3+ storeys, 2026-10-17: the owner's screenshot of a blank tower house):
  // every gap between doors / partitions / corners gets its own evenly spaced windows
  const winsDense = (a, b, avoid) => {
    const cuts = [...new Set([a, b, ...avoid.filter(q => q >= a && q <= b)])].sort((p, q) => p - q), out = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const g0 = cuts[i] + 4, g1 = cuts[i + 1] - 4; // a window keeps 4 studs off each cut
      if (g1 < g0) continue;
      const n = Math.max(1, Math.floor((g1 - g0) / 6) + 1);
      for (let k = 0; k < n; k++) { const p = even(n === 1 ? (g0 + g1) / 2 : g0 + ((g1 - g0) * k) / (n - 1)); if (!out.some(o => Math.abs(o.pos0 + 1 - p) < 4)) out.push(win(p)); }
    }
    return out;
  };
  const wins = (a, b, avoid) => {
    if (storeys >= 3) return winsDense(a, b, avoid);
    const out = [], n = Math.max(1, Math.floor((b - a) / 8));
    for (let i = 1; i <= n; i++) {
      const p = even(a + ((b - a) * i) / (n + 1));
      if (!avoid.some(q => Math.abs(q - p) < 4)) out.push(win(p));
    }
    return out;
  };
  const stairTop = 1 + LANDING + COURSES + LANDING; // the strip is y in [1, stairTop), x in [1, 1 + STAIR_W)
  const part = wing ? (shape === 'L' ? wx1 : wx0) : even(W / 2); // main partition wall
  const fd = even((part + W) / 2);                               // front door, right-hand room
  const outline = [], inner = [];
  outline.push(H(0, 0, W, [door(fd), ...wins(0, W, [0, part, W, fd])]));
  outline.push(V(W, 0, D, wins(0, D, [0, D])));
  if (!wing) {
    outline.push(H(D, 0, W, wins(0, W, [0, part, W])));
    outline.push(V(0, 0, D, wins(stairTop, D, [D, stairTop])));
  } else {
    outline.push(V(0, 0, wx0 === 0 ? D + E : D, wins(stairTop, wx0 === 0 ? D + E : D, [D, D + E, stairTop])));
    if (wx0 > 0) {
      outline.push(H(D, 0, wx0, wins(0, wx0, [0, wx0])));
      outline.push(V(wx0, D, D + E, wins(D, D + E, [D, D + E])));
    }
    outline.push(H(D, wx1, W, wins(wx1, W, [wx1, W, part])));
    outline.push(V(wx1, D, D + E, wins(D, D + E, [D, D + E])));
    outline.push(H(D + E, wx0, wx1, wins(wx0, wx1, [wx0, wx1])));
    inner.push(H(D, wx0, wx1, [door(even((wx0 + wx1) / 2))]));
    if (shape === 'T') inner.push(V(wx1, 0, D, [door(even(D / 2) + 2)]));
  }
  inner.push(V(part, 0, D, [door(even(D / 2) + 2)]));
  const runs = lib.normalizeRuns([...outline, ...inner], { ...lib.CONFIG, MARGIN: 0 });
  const nOut = outline.length;
  const config = {
    ...lib.CONFIG, WALL_COURSES: COURSES, DOOR_OPEN_COURSES: 6, /* lib.js caps doors at 6 (owner 2026-10-10) */ WINDOW_SILL_COURSES: 3, WINDOW_OPEN_COURSES: 5, /* sill at the waist: 3 bricks (owner 2026-11-01, player is 5 bricks tall) */
    CORNER_SNAP: 1, MARGIN: 0, STOREYS: storeys, FLOOR_MAX: 32, FLOOR_H,
  };
  config.BASE_Z = C / 2;
  lib.snapEndpoints(runs, config);
  const model = lib.buildModel(runs, config, { glass: true });
  lib.assertValidGeometry(runs, model.walls.map(b => lib.toWorldBrick(b, config)), config);
  const encl = lib.markBuildings(runs);

  // ----------------------------------------------- floors, ceilings, stairs --
  const flights = storeys - 1 + (attic ? 1 : 0);
  const hole = new Set(); // cells open over a flight (y = first step .. last step)
  for (let y = 1 + LANDING; y < 1 + LANDING + COURSES; y++) for (let x = 1; x < 1 + STAIR_W; x++) hole.add(key(x, y));
  const landing = (y0) => { for (let y = y0; y < y0 + LANDING; y++) for (let x = 1; x < 1 + STAIR_W; x++) if (!encl.interior.has(key(x, y))) throw new Error(`landing cell ${x},${y} is not floor`); };
  landing(1); landing(1 + LANDING + COURSES);
  const partitionCells = new Set();
  runs.slice(nOut).forEach(r => { for (let p = r.start; p <= r.end; p++) partitionCells.add(r.orient === 'H' ? key(p, r.line) : key(r.line, p)); });
  const slabs = [];
  for (let s = 0; s < storeys; s++) {
    const cells = lib.floorCells(runs, config, s * COURSES, encl);
    if (s > 0) for (const k of hole) cells.delete(k);
    for (const r of west || rs ? floorPieces(cells, 'planks', { salt: s, colors: [PAL.board] }) : floorPieces(cells, 'checker')) slabs.push({ kind: 'floor', ...r, z0: s * SH, z1: s * SH + FLOOR_H }); // checkerboard (owner, 2026-10-03)
    const top = (s + 1) * SH;
    const ceil = new Set([...encl.interior].filter(k => !(s + 1 < storeys || attic) || !hole.has(k)));
    for (const r of floorPieces(ceil, 'checkerCeiling')) slabs.push({ kind: 'ceiling', ...r, z0: top - FLOOR_H, z1: top });
  }
  for (let f = 0; f < flights; f++) {
    for (let i = 1; i <= COURSES; i++) {
      const y = 1 + LANDING + i - 1, zt = f * SH + FLOOR_H + i * C;
      slabs.push({ kind: 'stair', x0: 1, x1: 1 + STAIR_W, y0: y, y1: y + 1, z0: zt - C, z1: zt });
    }
  }
  const all = { walls: model.walls, glass: model.glass, slabs };
  const bad = lib.validateSolids(all, config);
  if (bad.length) throw new Error(`shapedhouse: ${bad.length} solid violations, e.g. ${bad[0]}`);

  // ------------------------------------------------------------- bricks --
  const B = makeBuilder();
  const box = (x0, y0, z0, x1, y1, z1, m, label) => B.box(x0 * ST, y0 * ST, z0, x1 * ST, y1 * ST, z1, m, label);
  // colours by seed: brick base (shaded per brick) and roof
  const BASES = [[150, 70, 50], [176, 136, 98], [138, 130, 122], [162, 92, 64], [206, 186, 156]];
  const ROOFS = [[82, 92, 112], [150, 62, 46], [70, 70, 74], [118, 72, 44], [60, 96, 70]];
  // western: weathered or painted plank siding, a tin/shingle roof
  const WBASES = [[150, 108, 70], [132, 96, 64], [170, 130, 90], [124, 114, 100], [168, 84, 58]];
  const WROOFS = [[96, 84, 70], [120, 116, 108], [82, 66, 52]];
  // runescape (2026-10-05, owner: town more RuneScape-like): cream plaster or
  // grey stone walls, dark timber quoins at the corners and a band at each
  // floor, a grey stone plinth, thatch / brown / slate roofs
  const RBASES = [[226, 216, 190], [214, 204, 178], [150, 146, 138], [232, 224, 204], [136, 132, 126]];
  const RROOFS = [[186, 148, 82], [164, 126, 66], [120, 84, 52], [84, 86, 92], [176, 138, 74]];
  const base = rs ? RBASES[(seed - 1 + RBASES.length * 9) % RBASES.length] : west ? WBASES[(seed - 1 + 45) % WBASES.length] : BASES[(seed - 1 + BASES.length * 9) % BASES.length];
  const roofC = rs ? RROOFS[(seed * 3 - 1 + RROOFS.length * 9) % RROOFS.length] : west ? WROOFS[(seed + 30) % WROOFS.length] : ROOFS[(seed * 3 - 1 + ROOFS.length * 9) % ROOFS.length];
  const F = [1, 0.9, 1.07, 0.95, 1.03];
  let k = 0;
  // one factor per brick for every channel (2026-10-06: a factor per channel tinted
  // pale gables pink / yellow / blue)
  const shade = () => { const f = F[(k++ * 7 + seed) % F.length]; return base.map(v => Math.min(255, Math.round(v * f))); };
  PAL.roof = roofC;
  // RS trim: wall stud cells with a neighbour both along x and along y are corners / junctions
  const rsCells = new Set(), corner = new Set();
  if (rs) {
    for (const b of model.walls) { const w = lib.toWorldBrick(b, config); for (let x = Math.round((w.x - w.sx) / ST); x < Math.round((w.x + w.sx) / ST); x++) for (let y = Math.round((w.y - w.sy) / ST); y < Math.round((w.y + w.sy) / ST); y++) rsCells.add(key(x, y)); }
    for (const c of rsCells) { const [x, y] = c.split(',').map(Number); if ((rsCells.has(key(x - 1, y)) || rsCells.has(key(x + 1, y))) && (rsCells.has(key(x, y - 1)) || rsCells.has(key(x, y + 1)))) corner.add(c); }
  }
  const RS_TIMBER = [[84, 60, 40], [96, 68, 44]], RS_PLINTH = [118, 116, 112];
  for (const b of model.walls) {
    const w = lib.toWorldBrick(b, config);
    let color = shade();
    if (rs) {
      // one factor per brick (shade() varies each channel, which speckles pale plaster)
      const f = [1, 0.95, 1.04, 0.97, 1.02][(k++ * 7 + seed) % 5];
      color = base.map(v => Math.min(255, Math.round(v * f)));
      const course = b.course;
      let hit = false;
      for (let x = Math.round((w.x - w.sx) / ST); x < Math.round((w.x + w.sx) / ST) && !hit; x++) for (let y = Math.round((w.y - w.sy) / ST); y < Math.round((w.y + w.sy) / ST) && !hit; y++) hit = corner.has(key(x, y));
      if (course <= 0) color = RS_PLINTH;
      else if (hit || course % COURSES === COURSES - 1) color = RS_TIMBER[course & 1];
    }
    B.add({ asset: MB, color, size: [w.sx, w.sy, w.sz], position: [w.x, w.y, w.z] }, 'wall');
  }
  for (const b of model.glass) {
    const w = lib.toWorldBrick(b, config);
    B.add({ ...PAL.glass, asset: 'PB_DefaultMicroBrick', size: [w.sx, w.sy, w.sz], position: [w.x, w.y, w.z] }, 'glass');
  }
  for (const s of slabs) {
    // checkerboard floors; ceilings are tiles turned face-down (direction 5) so
    // the smooth face shows from below, not the studded underside
    const m = s.brick ?? { asset: 'PB_DefaultTile', color: PAL.step }; // floors / ceilings carry theirs (floors.mjs)
    box(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1, m, s.kind);
  }
  const Z0 = storeys * SH;

  // ----------------------------------------------------------------- roof --
  const span = (west ? W : D) / 2 + overhang, rise = west ? 6 * C : attic ? 14 * C : 8 * C;
  const prof = roofProfile(span, rise, undefined, roof === 'dormer' ? 'gable' : roof); // roof style: roofs.mjs (dormer = gable + dormers)
  const occ = new Set(); // "x,y,slot" stud cells x 12-unit slots the roof's boxes take
  const mark = (x0, y0, x1, y1, z0, z1) => {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z += C) occ.add(`${x},${y},${(z - Z0) / C}`);
  };
  const LIP = 4, lipC = PAL.roof.map(v => Math.round(v * 0.82));
  const wedge = (x0, y0, x1, y1, z0, z1, dx, dy) => {
    if (x1 <= x0 || y1 <= y0) return;
    box(x0, y0, z0, x1, y1, z0 + LIP, { asset: MB, color: lipC }, 'roof lip');
    B.wedge(x0 * ST, y0 * ST, z0 + LIP, x1 * ST, y1 * ST, z1, dx, dy, { color: PAL.roof }, 'roof');
    mark(x0, y0, x1, y1, z0, z1);
  };
  const valley = (x0, y0, x1, y1, z0, z1, rotation) => {
    if (x1 <= x0 || y1 <= y0) return;
    if (x1 - x0 !== y1 - y0) throw new Error('valley square expected');
    box(x0, y0, z0, x1, y1, z0 + LIP, { asset: MB, color: lipC }, 'valley lip');
    B.add({ asset: 'PB_DefaultMicroWedgeInnerCorner', direction: 4, rotation, color: PAL.roof,
      size: [(x1 - x0) * ST / 2, (y1 - y0) * ST / 2, (z1 - z0 - LIP) / 2], position: [(x0 + x1) * ST / 2, (y0 + y1) * ST / 2, (z0 + LIP + z1) / 2] }, 'valley');
    mark(x0, y0, x1, y1, z0, z1);
  };
  const cap = (x0, y0, x1, y1, z0, z1) => { if (x1 > x0 && y1 > y0) { box(x0, y0, z0, x1, y1, z1, { asset: MB, color: PAL.roof }, 'crown'); mark(x0, y0, x1, y1, z0, z1); } };
  const mc = D / 2;                      // main crown cell (lateral y)
  const wc = wx0 + D / 2;                // wing crown cell (lateral x)
  const xa = -overhang, xb = W + 1 + overhang;
  const segs = prof.slice(0, -1).map((p, i) => ({ uo: p.u, ui: prof[i + 1].u, z0: Z0 + p.h, z1: Z0 + prof[i + 1].h }));
  const crownZ0 = segs[segs.length - 1].z0, roofTop = Z0 + prof[prof.length - 1].h;
  if (west) {
    // ridge along y, over the side walls; it starts behind the front wall, which is the false front
    const wcW = W / 2, yEnd = D + 1 + overhang;
    for (const g of segs) {
      wedge(wcW - g.uo, 1, wcW - g.ui, yEnd, g.z0, g.z1, 1, 0);
      wedge(wcW + 1 + g.ui, 1, wcW + 1 + g.uo, yEnd, g.z0, g.z1, -1, 0);
    }
    cap(wcW, 1, wcW + 1, yEnd, crownZ0, roofTop);
  }
  // dormers (2026-10-06, owner's picture): on the front (-y) slope, partway up:
  // the main bands kf..kb-1 are cut away over each, which stands on cheek walls
  // with a glazed front and its own little gable roof running back into the slope
  const dormers = [];
  const DW = 6; // dormer width, studs, cheeks included
  let kf = -1, kb = -1, zF = 0, zT = 0;
  if (roof === 'dormer' && !west) {
    kf = Math.max(1, Math.round(segs.length * 0.3));
    // walls 3 courses high where the roof allows, else 2 (cottages' low roofs); a roof of at least a brick
    for (const DHW of [3 * C, 2 * C]) {
      if (kf >= segs.length - 1) break;
      zF = segs[kf].z0; zT = zF + DHW;
      kb = segs.findIndex((g, i) => i > kf && g.z0 >= zT + C + 4);
      if (kb > kf && kb < segs.length) {
        const xs = W >= 40 ? [Math.round(W / 3), Math.round((2 * W) / 3)] : [Math.round(W / 2)];
        for (const xc of xs) { const x0 = xc - DW / 2; if (x0 >= 3 && x0 + DW <= W - 2) dormers.push(x0); }
        break;
      }
    }
  }
  const inDormerBand = gi => dormers.length && gi >= kf && gi < kb;
  if (!west) segs.forEach((g, gi) => {
    // main, ridge along x: -y side rises toward +y, +y side toward -y
    // on the wing's side the band stops at the valley: the square where it
    // crosses the wing's band is an inner-corner wedge (the owner's fix,
    // 2026-10-03), and between the two squares it is cut away (that is the
    // wing's attic, or on the top band the wing's crown)
    if (!inDormerBand(gi)) wedge(xa, mc - g.uo, xb, mc - g.ui, g.z0, g.z1, 0, 1);
    else { let a = xa; for (const x0 of dormers) { wedge(a, mc - g.uo, x0, mc - g.ui, g.z0, g.z1, 0, 1); a = x0 + DW; } wedge(a, mc - g.uo, xb, mc - g.ui, g.z0, g.z1, 0, 1); }
    if (!wing) wedge(xa, mc + 1 + g.ui, xb, mc + 1 + g.uo, g.z0, g.z1, 0, -1);
    else {
      const ya = mc + 1 + g.ui, yb = mc + 1 + g.uo;
      wedge(xa, ya, wc - g.uo, yb, g.z0, g.z1, 0, -1);
      wedge(wc + 1 + g.uo, ya, xb, yb, g.z0, g.z1, 0, -1);
      valley(wc - g.uo, ya, wc - g.ui, yb, g.z0, g.z1, 1);     // slopes down toward (-x, +y)
      valley(wc + 1 + g.ui, ya, wc + 1 + g.uo, yb, g.z0, g.z1, 0); // down toward (+x, +y)
      // the wing, ridge along y, from the valley to its own far gable
      const y1 = D + E + 1 + overhang;
      wedge(wc - g.uo, yb, wc - g.ui, y1, g.z0, g.z1, 1, 0);
      wedge(wc + 1 + g.ui, yb, wc + 1 + g.uo, y1, g.z0, g.z1, -1, 0);
    }
  });
  if (!west) cap(xa, mc, xb, mc + 1, crownZ0, roofTop);
  for (const x0 of dormers) {
    const yf = mc - segs[kf].uo, yb = mc - segs[kb].uo, x1 = x0 + DW, wallC = () => (rs ? base.map(v => Math.min(255, Math.round(v * [1, 0.95, 1.04, 0.97, 1.02][(k++ * 7 + seed) % 5]))) : shade());
    const trim = rs ? RS_TIMBER[0] : wallC();
    // cheeks: each cut band's two end columns, from the band up to the dormer's eave
    for (let gi = kf; gi < kb; gi++) {
      const g = segs[gi];
      if (g.z0 >= zT) continue;
      for (const cx of [x0, x1 - 1]) box(cx, mc - g.uo, g.z0, cx + 1, mc - g.ui, zT, { asset: MB, color: rs ? trim : wallC() }, 'dormer cheek');
      // the floor of the dormer between the cheeks (the cut band's footprint), closing the attic under it
      box(x0 + 1, Math.max(mc - g.uo, yf + 1), g.z0, x1 - 1, mc - g.ui, g.z0 + LIP, { asset: MB, color: PAL.board }, 'dormer floor'); // behind the sill
    }
    // front: wall with a window, a stud thick, on the last uncut band's inner edge
    box(x0 + 1, yf, zF, x1 - 1, yf + 1, zF + 8, { asset: MB, color: wallC() }, 'dormer sill');
    box(x0 + 1, yf, zF + 8, x0 + 2, yf + 1, zT, { asset: MB, color: trim }, 'dormer jamb');
    box(x1 - 2, yf, zF + 8, x1 - 1, yf + 1, zT, { asset: MB, color: trim }, 'dormer jamb');
    box(x0 + 2, yf, zF + 8, x1 - 2, yf + 1, zT - 6, { ...PAL.glass, asset: MB }, 'dormer glass');
    box(x0 + 2, yf, zT - 6, x1 - 2, yf + 1, zT, { asset: MB, color: trim }, 'dormer head');
    // its roof: a lip-and-wedge course each side, ridge front to back, a stud past the front
    const zR = segs[kb].z0, mid = x0 + DW / 2;
    wedge(x0, yf - 1, mid, yb, zT, zR, 1, 0);
    wedge(mid, yf - 1, x1, yb, zT, zR, -1, 0);
    // back: close the attic between the dormer roof and the uncut band above it
    if (yb > yf) box(x0, yb - 1, zR - 0, x1, yb, zR, { asset: MB, color: PAL.roof }, 'dormer back');
  }
  // gable overhangs (owner's detail, 2026-10-03): under each band, in the
  // overhang stud past the gable, an upside-down wedge one band lower, and a
  // flat course under the crown, so the edge reads as a thick curved barge
  // with a smooth underside instead of showing the steps
  const inv = (x0, y0, x1, y1, z0, z1, dx, dy) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    const ext = [(x1 - x0) * ST / 2, (y1 - y0) * ST / 2, (z1 - z0) / 2];
    const o = orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext);
    B.add({ asset: 'PB_DefaultMicroWedge', ...o, rotation: (o.rotation + 2) % 4, color: PAL.roof, position: [(x0 + x1) * ST / 2, (y0 + y1) * ST / 2, (z0 + z1) / 2] }, 'barge');
    mark(x0, y0, x1, y1, z0, z1);
  };
  const barge = (lat, along, alongX) => {
    // alongX: the gable stud is x = along, lateral is y about crown cell `lat`
    const put = (l0, l1, z0, z1, toward) => alongX
      ? inv(along, l0, along + 1, l1, z0, z1, 0, toward) : inv(l0, along, l1, along + 1, z0, z1, toward, 0);
    segs.forEach((g, k) => {
      if (k === 0) return;
      const last = k === segs.length - 1, lo = segs[k - 1].z0, hi = last ? g.z0 - C : g.z0;
      put(lat - g.uo, lat - g.ui, lo, hi, 1);
      put(lat + 1 + g.ui, lat + 1 + g.uo, lo, hi, -1);
      if (last) alongX ? box(along, lat - g.uo, g.z0 - C, along + 1, lat + 1 + g.uo, g.z0, { asset: MB, color: PAL.roof }, 'barge')
                       : box(lat - g.uo, along, g.z0 - C, lat + 1 + g.uo, along + 1, g.z0, { asset: MB, color: PAL.roof }, 'barge');
    });
  };
  if (west) barge(W / 2, D + 1, false);
  else {
    barge(mc, xa, true);
    barge(mc, xb - 1, true);
  }
  if (wing) barge(wc, D + E + 1, false);
  if (wing) cap(wc, mc + 1, wc + 1, D + E + 1 + overhang, crownZ0, roofTop);

  // ------------------------------------------- gables, knee walls, attic --
  // every outside-wall cell carries on up, course by course, until it meets the roof
  const wallCells = new Map(); // cell -> 'H' | 'V' | 'X' (corner)
  runs.slice(0, nOut).forEach(r => {
    for (let p = r.start; p <= r.end; p++) {
      const c = r.orient === 'H' ? key(p, r.line) : key(r.line, p);
      wallCells.set(c, wallCells.has(c) && wallCells.get(c) !== r.orient ? 'X' : r.orient);
    }
  });
  const gableGlass = new Set();
  if (attic) {
    const g = (x, y) => gableGlass.add(key(x, y));
    for (const x of [0, W]) for (let y = mc - 1; y <= mc + 1; y++) g(x, y);
    if (wing) for (let x = wc - 1; x <= wc + 1; x++) g(x, D + E);
  }
  const GL0 = 3, GL1 = 7; // gable window slots
  let topSlot = 0;
  const kneeRows = new Map(); // `${axis}|${line}|${slot}` -> positions
  const FF = roofTop + 3 * C; // false-front top
  for (const [c, ax] of wallCells) {
    const [x, y] = c.split(',').map(Number);
    for (let slot = 0; ; slot++) {
      if (west && y === 0) { if (Z0 + slot * C >= FF) break; }
      else if (Z0 + slot * C >= roofTop) throw new Error(`outside wall cell ${c} has no roof over it`);
      if (occ.has(`${x},${y},${slot}`)) break;
      topSlot = Math.max(topSlot, slot);
      const z0 = Z0 + slot * C;
      if (gableGlass.has(c) && slot >= GL0 && slot < GL1 && !occ.has(`${x},${y},${GL1}`)) {
        box(x, y, z0, x + 1, y + 1, z0 + C, { ...PAL.glass, asset: 'PB_DefaultMicroBrick' }, 'gable glass');
        continue;
      }
      const axis = ax === 'X' ? (slot % 2 ? 'V' : 'H') : ax;
      const rk = `${axis}|${axis === 'H' ? y : x}|${slot}`;
      (kneeRows.get(rk) ?? kneeRows.set(rk, []).get(rk)).push(axis === 'H' ? x : y);
    }
  }
  for (const [rk, ps] of kneeRows) {
    const [axis, line, slotS] = rk.split('|'), L = +line, slot = +slotS, z0 = Z0 + slot * C;
    ps.sort((a, b) => a - b);
    const pieces = [];
    let a = ps[0];
    for (let i = 1; i <= ps.length; i++) {
      const p = ps[i], prev = ps[i - 1];
      const cutHere = p !== prev + 1 || (p + (slot % 2) * 2) % 4 === 0;
      if (i === ps.length || cutHere) { pieces.push([a, prev + 1]); a = p; }
    }
    for (let i = 0; i < pieces.length; i++) {           // fold 1-stud slivers into a neighbour
      if (pieces[i][1] - pieces[i][0] !== 1) continue;
      if (i > 0 && pieces[i - 1][1] === pieces[i][0]) { pieces[i - 1][1] = pieces[i][1]; pieces.splice(i--, 1); }
      else if (i + 1 < pieces.length && pieces[i + 1][0] === pieces[i][1]) { pieces[i + 1][0] = pieces[i][0]; pieces.splice(i--, 1); }
    }
    for (const [p0, p1] of pieces) {
      if (axis === 'H') box(p0, L, z0, p1, L + 1, z0 + C, { asset: MB, color: shade() }, 'knee');
      else box(L, p0, z0, L + 1, p1, z0 + C, { asset: MB, color: shade() }, 'knee');
    }
  }
  if (west) {
    const TIMBER = [96, 70, 46], SIGN = [222, 206, 170];
    // cornice along the false-front top, a blank sign board under it
    box(-1, -1, FF, W + 2, 1, FF + 8, { asset: MB, color: TIMBER }, 'cornice');
    box(3, -1, roofTop - 3 * C, W - 2, 0, roofTop + C, { asset: MB, color: SIGN }, 'sign');
    // porch: board deck, posts, a lean-to roof against the front wall above the door
    const PD = 6, PZ = 9 * C;
    box(-1, -PD, 0, W + 2, 0, FLOOR_H, { asset: MB, color: PAL.board }, 'porch deck');
    const posts = [-1, W + 1];
    for (let x = 7; x < W - 4; x += 8) posts.push(x);
    for (const px of posts) box(px, -PD, FLOOR_H, px + 1, -PD + 1, PZ, { asset: MB, color: TIMBER }, 'porch post');
    wedge(-1, -PD - 1, W + 2, 0, PZ, PZ + C, 0, 1);
  }
  if (attic) {
    const cells = new Set([...encl.interior, ...partitionCells].filter(c => !hole.has(c) && !wallCells.has(c)));
    for (const r of floorPieces(cells, 'planks', { salt: 99, colors: [PAL.board] })) box(r.x0, r.y0, Z0, r.x1, r.y1, Z0 + FLOOR_H, r.brick, 'attic floor');
  }
  // ------------------------------------------------------------- dressing --
  // (owner 2026-10-14: "more complex architecture") everything here stands at most a
  // stud proud of the walls (the lots keep 2 studs between houses) and only where it
  // is free: a pilastered door case with a stepped pediment, a sill and a stepped hood
  // round every outside window, and chimney stacks on the ridge
  let dressing = 0;
  if (!west) {
    const trimC = rs ? RS_TIMBER[1] : base.map(v => Math.min(255, Math.round(v * 0.72 + 60)));
    const stoneC = rs ? RS_PLINTH : [196, 190, 178];
    const tryBox = (x0, y0, z0, x1, y1, z1, color, label) => {
      if (x1 <= x0 || y1 <= y0 || z1 <= z0 || !B.free([x0 * ST, y0 * ST, z0], [x1 * ST, y1 * ST, z1])) return false;
      box(x0, y0, z0, x1, y1, z1, { asset: MB, color }, label); dressing++; return true;
    };
    // door case: the lintel is the lowest front-wall brick over the opening
    const overDoor = model.walls.map(b => lib.toWorldBrick(b, config))
      .filter(w => w.orient === 'H' && w.line === 0 && w.a < fd + 2 && w.b > fd - 2 && w.z - w.sz > C);
    if (overDoor.length) {
      const zt = Math.min(...overDoor.map(w => w.z - w.sz));
      for (const px of [fd - 3, fd + 2]) tryBox(px, -1, 0, px + 1, 0, zt, stoneC, 'door case');
      if (tryBox(fd - 4, -1, zt, fd + 4, 0, zt + 4, trimC, 'door case'))
        for (let i = 1; i <= 3; i++) tryBox(fd - 4 + i, -1, zt + 4 * i, fd + 4 - i, 0, zt + 4 * i + 4, i === 3 ? stoneC : trimC, 'pediment');
    }
    // windows: group the glass by opening, find the outside, sill under and hood over
    const wins = new Map();
    for (const b of model.glass) {
      const w = lib.toWorldBrick(b, config), k = `${w.orient}|${w.line}|${w.a}|${w.b}|${Math.floor(b.course / COURSES)}`;
      const g = wins.get(k) ?? wins.set(k, { w, z0: Infinity, z1: -Infinity }).get(k);
      g.z0 = Math.min(g.z0, w.z - w.sz); g.z1 = Math.max(g.z1, w.z + w.sz);
    }
    for (const { w, z0, z1 } of wins.values()) {
      const m = Math.floor((w.a + w.b) / 2), L = w.line;
      const inA = w.orient === 'H' ? encl.interior.has(key(m, L - 1)) : encl.interior.has(key(L - 1, m));
      const inB = w.orient === 'H' ? encl.interior.has(key(m, L + 1)) : encl.interior.has(key(L + 1, m));
      if (inA === inB) continue;
      const o = inA ? L + 1 : L - 1; // the stud row just outside
      const span = (p0, p1, za, zb, color, label) => w.orient === 'H' ? tryBox(p0, o, za, p1, o + 1, zb, color, label) : tryBox(o, p0, za, o + 1, p1, zb, color, label);
      if (!span(w.a - 1, w.b + 1, z0 - 4, z0, stoneC, 'sill')) span(w.a, w.b, z0 - 4, z0, stoneC, 'sill');
      if (span(w.a - 1, w.b + 1, z1, z1 + 4, trimC, 'hood')) span(w.a, w.b, z1 + 4, z1 + 8, stoneC, 'hood');
    }
    // chimneys: a 2 x 2 stack astride the ridge near one gable (both on long roofs), each
    // stud column from the roof under it up past the crown, a corbelled cap and two pots
    const stackC = rs ? [128, 124, 118] : [[140, 70, 52], [120, 64, 50], [150, 96, 70]][seed % 3];
    const ends = W >= 40 ? [3, W - 5] : [(seed & 1) ? 3 : W - 5];
    for (const cx of ends) {
      const top = roofTop + 3 * C, cols = [];
      for (let x = cx; x < cx + 2; x++) for (let y = mc; y < mc + 2; y++) {
        let z = top;
        while (z > Z0 && B.free([x * ST, y * ST, z - 2], [(x + 1) * ST, (y + 1) * ST, z])) z -= 2;
        if (z <= Z0) { cols.length = 0; break; }
        cols.push([x, y, z]);
      }
      if (cols.length !== 4) continue;
      for (const [x, y, z] of cols) tryBox(x, y, z, x + 1, y + 1, top, stackC, 'chimney');
      if (tryBox(cx - 1, mc - 1, top, cx + 3, mc + 3, top + 4, stoneC, 'chimney cap'))
        for (const x of [cx, cx + 1]) tryBox(x + 0.2, mc + 0.7, top + 4, x + 0.8, mc + 1.3, top + 14, [150, 84, 60], 'chimney pot');
    }
  }
  let furniturePieces = 0;
  // ------------------------------------------------------------ furniture --
  // (owner 2026-10-13: "readd furniture", "make furniture better", "make template
  // pools") each room draws a layout from its pool in furniture.mjs (front room,
  // stair room, wing, bedrooms upstairs); never on the stair strip, its landings or
  // the hole over it, never in front of a door, tall pieces never across a window;
  // a lantern under each room's ceiling
  if (furniture && !west) {
    const pal = {
      wood: [[120, 84, 54], [104, 72, 46], [136, 96, 62]][seed % 3], dark: [86, 60, 40],
      cloth: [[150, 52, 48], [58, 88, 140], [70, 110, 70], [170, 140, 70], [120, 70, 120]][seed % 5], linen: [232, 226, 210], stone: [128, 124, 118],
    };
    const blocked = new Set(), used = new Set(), windowCells = new Set();
    const block = (x0, y0, x1, y1) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) blocked.add(key(x, y)); };
    block(0, 0, 1 + STAIR_W + 1, stairTop + 1);                      // stair strip, landings, the hole
    block(fd - 3, 0, fd + 4, 5);                                      // front door
    block(part - 4, even(D / 2) - 1, part + 5, even(D / 2) + 6);       // partition door
    if (wing) block(even((wx0 + wx1) / 2) - 4, D - 4, even((wx0 + wx1) / 2) + 5, D + 5);
    if (shape === 'T') block(wx1 - 4, even(D / 2), wx1 + 5, even(D / 2) + 7);
    for (const r of runs) for (const o of r.openings ?? []) if (o.type === 'window') for (let q = o.pos0; q < o.pos1; q++) windowCells.add(r.orient === 'H' ? key(q, r.line) : key(r.line, q));
    const rooms = [{ x0: 1, x1: part, y0: 1, y1: D, role: 0 }, { x0: part + 1, x1: W, y0: 1, y1: D, role: 1 }];
    if (wing) rooms.push({ x0: wx0 + 1, x1: wx1, y0: D + 1, y1: D + E, role: 2 });
    const usedT = {};
    for (let st = 0; st < storeys; st++)
      rooms.forEach((room, ri) => {
        const pool = st > 0 ? 'bedroom' : room.role === 1 ? 'front' : room.role === 2 ? 'wing' : storeys === 1 ? 'cottage' : 'stair';
        const zf = st * SH + FLOOR_H;
        const ctx = {
          zf,
          fits: cells => cells.every(c => encl.interior.has(c) && !wallCells.has(c) && !partitionCells.has(c) && !blocked.has(c) && !used.has(c + ':' + st)),
          tallOk: cells => cells.every(c => { const [x, y] = c.split(',').map(Number); return ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => windowCells.has(key(x + dx, y + dy))); }),
          free: (lo, hi) => B.free(lo, hi),
          emit: b => B.add(b, 'furniture'),
          take: cells => cells.forEach(c => used.add(c + ':' + st)),
          rnd: a => { let h = (seed * 2654435761 + st * 97 + ri * 7919 + a * 104729) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
        };
        const t = furnishRoom(pool, room, ctx, pal);
        usedT[t] = (usedT[t] ?? 0) + 1;
        // lantern under the ceiling at the room's middle (not over the stair hole)
        const lx = even((room.x0 + room.x1) / 2), ly = even((room.y0 + room.y1) / 2), cz = (st + 1) * SH - FLOOR_H;
        if (!hole.has(key(lx, ly)) && B.free([lx * ST, ly * ST, cz - 14], [(lx + 1) * ST, (ly + 1) * ST, cz])) {
          box(lx + 0.4, ly + 0.4, cz - 6, lx + 0.6, ly + 0.6, cz, { asset: MB, color: [40, 40, 44] }, 'furniture');
          box(lx + 0.2, ly + 0.2, cz - 14, lx + 0.8, ly + 0.8, cz - 6, { asset: MB, ...{ color: [255, 196, 120], material: 'BMC_Glow', material_intensity: 5 } }, 'furniture');
        }
      });
    furniturePieces = JSON.stringify(usedT);
  }
  if (B.dropped.length) throw new Error(`shapedhouse: ${B.dropped.length} overlapping bricks, e.g. ${B.dropped[0]}`);

  // headroom on the attic flight and at its landing
  const under = (u) => { for (const g of segs) if (u >= g.ui && u < g.uo) return g.z0; return crownZ0; };
  const latU = y => (y < mc ? mc - 1 - y : y - mc - 1) + 0; // studs from the crown edge
  const notes = [`furniture: ${furniturePieces}`];
  if (attic) {
    const yTop = 1 + LANDING + COURSES;
    const room = Math.min(...[yTop, yTop + 1, yTop + 2].map(y => (y === mc ? roofTop : under(Math.max(0, latU(y)) + 0.5)) - (Z0 + FLOOR_H)));
    notes.push(`attic landing headroom ${room} (player 72, +72 jumping)`);
  }
  return {
    bricks: B.bricks.map(({ label, ...b }) => b), count: B.bricks.length, dormers: dormers.length, shape, W, D, E: wing ? E : 0, storeys, attic,
    door: [fd, 0], top: roofTop, profile: prof, notes, dressing,
  };
}

// ---------------------------------------------------------------- CLI --
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const h = shapedHouse({
    shape: opt('shape', 'L'), W: +opt('W', 40), D: +opt('D', 24), E: +opt('E', 16),
    storeys: +opt('storeys', 2), attic: opt('attic', '1') !== '0', seed: +opt('seed', 1),
  });
  const [ox, oy, oz] = (opt('at', '0,0,0')).split(',').map(Number);
  const bricks = h.bricks.map(b => ({ ...b, position: [b.position[0] + ox, b.position[1] + oy, b.position[2] + oz] }));
  console.error(`${h.shape} ${h.W}x${h.D}${h.E ? ` + wing ${h.D}x${h.E}` : ''}, ${h.storeys} storeys${h.attic ? ' + attic' : ''}: ${h.count} bricks, roof top z ${h.top}`);
  console.error('roof profile (u studs, h units):', h.profile.map(p => `${p.u}/${p.h}`).join(' '));
  for (const n of h.notes) console.error(n);
  const job = opt('job');
  if (job) {
    const Q = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';
    fs.writeFileSync(job, JSON.stringify({ ops: [
      { op: 'say', msg: `<size="40"><color="ff4040"><b>${Q}</></></>` },
      { op: 'bricks', at: [0, 0, 0], owner: opt('owner', 'Claude house'), captureMs: 8000, bricks },
    ] }));
    console.error('wrote', job);
  }
}
