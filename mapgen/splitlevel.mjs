// Split-level ranch (2026-10-17, owner photo: "make houses that can look like this"):
// a two-storey block (brick garage below, lap siding above, two windows) beside a
// one-storey wing half a level up (stone front, picture window, front door on a
// stoop with steps), both under shallow hip roofs with deep eaves and white fascia,
// a brick chimney on the wing's outer end, a concrete driveway to the garage.
//
// Inside, the classic split: the front door opens into the wing (main level);
// a doorway in the shared wall leads to a 3x3 landing, half a flight up to the
// bedroom level over the garage, half a flight down to the family room behind
// the garage (which opens into the garage). Every flight has 3x3 landings at
// both ends and the floor above it is open over it (72 headroom).
//
//   splitLevel({ seed, mirror }) -> { bricks, W, D, door } local units, front face on
//   y = 0 looking -y, x from 0 to (W + 1) * 10, y from 0 to (D + 1) * 10 (shapedTown's frame);
//   door = the front door's x in studs
//   node mapgen/splitlevel.mjs [seed] [out.json]   (bricks for isoview.mjs)

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor } from './orient.mjs';
import { townCourses } from './roofs.mjs';

const GLASS = { color: [170, 210, 230], material: 'BMC_Glass' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const WHITE = [240, 240, 234], TILE = 'PB_DefaultTile', MB = 'PB_DefaultMicroBrick';

const BRICKS = [[150, 70, 50], [138, 62, 44], [160, 84, 60], [124, 66, 52], [170, 100, 72]];
const SIDING = [[214, 204, 178], [226, 218, 196], [196, 204, 196], [210, 196, 170], [188, 196, 206], [232, 226, 214]];
const STONE = [[[132, 128, 120], [112, 108, 102], [150, 144, 132], [96, 94, 90]], [[150, 134, 112], [128, 114, 96], [168, 152, 126], [110, 98, 86]], [[120, 124, 128], [100, 104, 110], [140, 144, 146], [88, 90, 96]]];
const ROOFS = [[92, 86, 82], [110, 100, 90], [74, 74, 78], [120, 96, 78], [96, 104, 112]];
const GDOOR = [[244, 244, 240], [236, 232, 220], [200, 196, 188], [120, 90, 64]];
const FDOOR = [[120, 70, 44], [90, 52, 36], [60, 80, 60], [140, 40, 36], [40, 56, 84]];

export function splitLevel({ seed = 1, mirror = false } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const B = makeBuilder();
  // ---------------------------------------------------------------- frame --
  // built with the split block on the left (x 0..SW); mirror flips x at the end
  const SW = 220 + Math.floor(r() * 3) * 20;        // split block width 22-26 studs
  const WW = 240 + Math.floor(r() * 4) * 20;        // wing width 24-30 studs
  const DD = 280;                                   // depth 28 studs
  const WF = 20;                                    // the wing stands 2 studs back from the split block's front
  const OV = 20;                                    // eaves
  const X0 = OV, Y0 = 50;                           // local origin: room for the eave (left) and the steps / eave (front)
  const L = { slab: 4, main: 56, upper: 116, upTop: 224, wingTop: 164 };
  const brickC = pick(BRICKS), sidingC = pick(SIDING), stone = pick(STONE), roofC = pick(ROOFS);
  const gdoorC = pick(GDOOR), fdoorC = pick(FDOOR), stoneFront = r() < 0.7, wingSiding = r() < 0.5;
  const shade = (c, f) => c.map(v => Math.min(255, Math.round(v * f)));
  const F = [1, 0.93, 1.05, 0.97, 1.02, 0.9];
  let nk = 0;
  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`splitlevel: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  // ------------------------------------------------------------ walls --
  // wall(axis 'x' | 'y', line (the wall's low face), a0, a1, z0, z1, skin, openings [{a0, a1, z0, z1}])
  // skins: brick (running bond, 12 courses), siding (6-high laps, two shades), stone (random blocks)
  const piece = (axis, line, a, b, z, zt, color, label) => axis === 'x'
    ? box(a, line, z, b, line + 10, zt, { color }, label) : box(line, a, z, line + 10, b, zt, { color }, label);
  function wall(axis, line, a0, a1, z0, z1, skin, openings = [], label = 'wall') {
    const row = skin === 'siding' ? 6 : 12;
    // rows on the course grid, split where an opening starts or ends (no slivers under doors)
    const cuts = new Set([z0, z1]);
    for (let z = z0; z < z1; z += row) cuts.add(z);
    for (const o of openings) for (const v of [o.z0, o.z1]) if (v > z0 && v < z1) cuts.add(v);
    const zs = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i + 1 < zs.length; i++) {
      const z = zs[i], zt = zs[i + 1], k = Math.floor((z - z0) / row);
      // the free spans of this row between openings
      let spans = [[a0, a1]];
      for (const o of openings) if (o.z0 < zt && o.z1 > z) spans = spans.flatMap(([p, q]) => (o.a1 <= p || o.a0 >= q) ? [[p, q]] : [[p, o.a0], [o.a1, q]].filter(([u, v]) => v > u));
      for (const [p, q] of spans) {
        if (skin === 'siding') { piece(axis, line, p, q, z, zt, shade(sidingC, k % 2 ? 0.94 : 1), label + ' siding'); continue; }
        let a = p, j = 0;
        const off = skin === 'brick' ? (k % 2 ? 20 : 0) : Math.floor(r() * 3) * 10;
        while (a < q) {
          let len = skin === 'brick' ? (j === 0 && off ? off : 40) : 20 + Math.floor(r() * 4) * 10;
          if (q - (a + len) < 10) len = q - a;
          const c = skin === 'brick' ? shade(brickC, F[(nk++ * 7 + k) % F.length]) : stone[Math.floor(r() * stone.length)];
          piece(axis, line, a, Math.min(q, a + len), z, zt, c, label + ' ' + skin);
          a += len; j++;
        }
      }
    }
  }
  // a window in an opening: white frame, glass pane, a sill proud of the wall face (out = -1 / +1 from line)
  function windowIn(axis, line, out, o) {
    const T = { color: WHITE };
    const lo = out < 0 ? line - 4 : line + 10, hi = lo + 4;
    const pb = (a, b, z, zt, m, lab, t0 = line, t1 = line + 10) => axis === 'x' ? box(a, t0, z, b, t1, zt, m, lab) : box(t0, a, z, t1, b, zt, m, lab);
    pb(o.a0, o.a1, o.z0, o.z0 + 4, T, 'window frame');
    pb(o.a0, o.a1, o.z1 - 4, o.z1, T, 'window frame');
    pb(o.a0, o.a0 + 4, o.z0 + 4, o.z1 - 4, T, 'window frame');
    pb(o.a1 - 4, o.a1, o.z0 + 4, o.z1 - 4, T, 'window frame');
    const mids = o.a1 - o.a0 >= 80 ? [o.a0 + Math.round((o.a1 - o.a0) / 3 / 2) * 2, o.a1 - Math.round((o.a1 - o.a0) / 3 / 2) * 2] : o.a1 - o.a0 >= 50 ? [Math.round((o.a0 + o.a1) / 4) * 2] : [];
    for (const m of mids) pb(m - 2, m + 2, o.z0 + 4, o.z1 - 4, T, 'mullion', line + 3, line + 7);
    let a = o.a0 + 4;
    for (const m of [...mids, o.a1 - 2]) { pb(a, m - 2, o.z0 + 4, o.z1 - 4, GLASS, 'glass', line + 4, line + 6); a = m + 2; }
    pb(o.a0 - 4, o.a1 + 4, o.z0 - 4, o.z0, { color: [200, 196, 188] }, 'sill', lo, hi);
  }
  const door = (a0, a1, z0, z1) => ({ a0, a1, z0, z1 });

  // ------------------------------------------------------- split block --
  const GD = { a0: 30, a1: SW - 30, z0: L.slab, z1: 100 };            // garage door opening
  const upWin = [{ a0: 30, a1: 90 }, { a0: SW - 90, a1: SW - 30 }].map(w => ({ ...w, z0: 150, z1: 200 }));
  // floor slab of the lower level (garage + family room)
  box(10, 10, 0, SW - 10, DD - 10, L.slab, { color: [168, 166, 160] }, 'lower slab');
  // front: brick to the upper floor, siding above
  wall('x', 0, 0, SW, 0, L.upper - 4, 'brick', [GD], 'split front');
  wall('x', 0, 0, SW, L.upper - 4, L.upTop, 'siding', upWin, 'split front');
  upWin.forEach(w => windowIn('x', 0, -1, w));
  // the garage door: panels with grooves, a white trim round the opening
  for (let z = GD.z0, k = 0; z < GD.z1; z += 16, k++) box(GD.a0 + 4, 3, z, GD.a1 - 4, 7, Math.min(GD.z1 - 4, z + 16) - 2, { color: gdoorC }, 'garage door'), box(GD.a0 + 4, 5, Math.min(GD.z1 - 4, z + 16) - 2, GD.a1 - 4, 7, Math.min(GD.z1 - 4, z + 16), { color: shade(gdoorC, 0.85) }, 'garage door groove');
  box(GD.a0, 0, GD.z1 - 4, GD.a1, 10, GD.z1, { color: WHITE }, 'garage trim');
  box(GD.a0, 0, GD.z0, GD.a0 + 4, 10, GD.z1 - 4, { color: WHITE }, 'garage trim');
  box(GD.a1 - 4, 0, GD.z0, GD.a1, 10, GD.z1 - 4, { color: WHITE }, 'garage trim');
  box(SW - 22, -4, 68, SW - 14, 0, 82, GLOW([255, 236, 190], 3), 'coach light');
  // outer side (x 0): brick lower with a family room window, siding upper with two windows
  const sideLow = [{ a0: 200, a1: 250, z0: 40, z1: 88 }];
  const sideUp = [{ a0: 40, a1: 90, z0: 150, z1: 200 }, { a0: 190, a1: 240, z0: 150, z1: 200 }];
  wall('y', 0, 10, DD, 0, L.upper - 4, 'brick', sideLow, 'split side');
  wall('y', 0, 10, DD, L.upper - 4, L.upTop, 'siding', sideUp, 'split side');
  [...sideLow, ...sideUp].forEach(w => windowIn('y', 0, -1, w));
  // back (y DD-10): brick lower with a window, siding upper with two windows
  const backLow = [{ a0: 40, a1: 100, z0: 40, z1: 88 }], backUp = [{ a0: 30, a1: 80, z0: 150, z1: 200 }, { a0: SW - 80, a1: SW - 30, z0: 150, z1: 200 }];
  wall('x', DD - 10, 10, SW - 10, 0, L.upper - 4, 'brick', backLow, 'split back');
  wall('x', DD - 10, 10, SW - 10, L.upper - 4, L.upTop, 'siding', backUp, 'split back');
  [...backLow, ...backUp].forEach(w => windowIn('x', DD - 10, 1, w));
  // shared wall (x SW-10): siding all the way (the wing covers its lower part), a doorway on the main level
  const SY0 = 160, LAND = 30;                                          // stair hall: y 160.. (behind the garage)
  const hallDoor = door(SY0 + 10, SY0 + 10 + LAND, L.main, L.main + 76);
  wall('y', SW - 10, 10, DD, 0, L.upTop, 'siding', [hallDoor], 'shared wall');
  // garage / family room partition (y 150..160) with a door, up to the garage ceiling
  wall('x', SY0 - 10, 10, SW - 10, L.slab, L.upper - 8, 'siding', [door(30, 70, L.slab, L.slab + 76)], 'garage partition');
  // stairs: L0 (main level) at x SW-40..SW-10, y SY0+10..+40; up flight -x along it; down flight +y
  const lx0 = SW - 10 - LAND, ly0 = SY0 + 10, ly1 = ly0 + LAND;
  box(lx0, ly0, L.slab, SW - 10, ly1, L.main - 4, { color: [150, 146, 140] }, 'landing L0 base');
  box(lx0, ly0, L.main - 4, SW - 10, ly1, L.main, { asset: TILE, color: [150, 112, 78] }, 'landing L0');
  const TREAD = { color: [128, 90, 58] };
  for (let i = 1; i <= 4; i++) box(lx0 - i * 10, ly0, L.slab, lx0 - (i - 1) * 10, ly1, L.main + i * 12, TREAD, 'up tread'); // 68 80 92 104
  const topX1 = lx0 - 40, topX0 = topX1 - LAND;                         // top landing = upper floor at 116
  for (let i = 1; i <= 3; i++) box(lx0, ly1 + (i - 1) * 10, L.slab, SW - 10, ly1 + i * 10, L.main - [0, 12, 26, 38][i], TREAD, 'down tread'); // 44 30 18 (risers 12 14 12 14, on the 2 grid)
  // the down flight's bottom landing (family room floor) y ly1+30 .. +60 must fit in front of the back wall
  if (ly1 + 30 + LAND > DD - 10) throw new Error('splitlevel: no room for the bottom landing');
  // upper floor (over the garage and family room), open over the flights and L0
  const hole = [topX1, ly0 - 10, SW - 10, ly1 + 30];                    // x0 y0 x1 y1 (10 in front of L0: rail room)
  const floorRects = [[10, 10, SW - 10, hole[1]], [10, hole[1], hole[0], DD - 10], [hole[0], hole[3], SW - 10, DD - 10]];
  for (const [a, b, c, d] of floorRects) { box(a, b, L.upper - 4 - 4, c, d, L.upper - 4, { color: [226, 222, 214] }, 'garage ceiling'); box(a, b, L.upper - 4, c, d, L.upper, { asset: TILE, color: [150, 112, 78] }, 'upper floor'); }
  // rails round the hole (not across the top landing)
  box(hole[0], hole[1] - 2, L.upper, hole[2], hole[1], L.upper + 36, { color: WHITE }, 'rail');
  box(hole[0], hole[3], L.upper, hole[2], hole[3] + 2, L.upper + 36, { color: WHITE }, 'rail');
  box(hole[0] - 2, ly1, L.upper, hole[0], hole[3], L.upper + 36, { color: WHITE }, 'rail');
  box(10, 10, L.upTop - 4, SW - 10, DD - 10, L.upTop, { asset: TILE, color: [232, 230, 224], direction: 5 }, 'upper ceiling');
  box(SW / 2 - 10, 80, L.upTop - 6, SW / 2 + 10, 100, L.upTop - 4, GLOW([255, 240, 210]), 'upper light');
  box(SW / 2 - 10, 80, L.upper - 10, SW / 2 + 10, 100, L.upper - 8, GLOW([255, 240, 210]), 'garage light');

  // ---------------------------------------------------------------- wing --
  const WX0 = SW, WX1 = SW + WW, WY0 = WF, WY1 = DD;
  const fd = { a0: WX0 + 30, a1: WX0 + 70, z0: L.main, z1: L.main + 76 };   // front door, beside the split block
  const pic = { a0: WX0 + 110, a1: Math.min(WX1 - 30, WX0 + 230), z0: L.main + 26, z1: L.main + 90 };
  const wingSkin = wingSiding ? 'siding' : 'brick';
  wall('x', WY0, WX0, WX1, 0, L.wingTop, stoneFront ? 'stone' : wingSkin, [{ ...fd, z1: fd.z1 + 4 }, pic], 'wing front'); // the door head fills the top 4
  windowIn('x', WY0, -1, pic);
  box(fd.a0, WY0, fd.z1, fd.a1, WY0 + 10, fd.z1 + 4, { color: WHITE }, 'door head');
  box(fd.a0 - 4, WY0 - 4, fd.z0, fd.a0, WY0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a1, WY0 - 4, fd.z0, fd.a1 + 4, WY0, fd.z1 + 4, { color: WHITE }, 'door case');
  box(fd.a0 + 2, WY0 + 8, fd.z0, fd.a0 + 6, WY0 + 10, fd.z1, { color: fdoorC }, 'door (open)'); // swung in against the jamb
  const wb = [{ a0: WX0 + 50, a1: WX0 + 100, z0: L.main + 30, z1: L.main + 82 }, { a0: WX1 - 100, a1: WX1 - 50, z0: L.main + 30, z1: L.main + 82 }];
  wall('x', WY1 - 10, WX0, WX1, 0, L.wingTop, wingSkin, wb, 'wing back');
  wb.forEach(w => windowIn('x', WY1 - 10, 1, w));
  const ws = [{ a0: WY0 + 50, a1: WY0 + 100, z0: L.main + 30, z1: L.main + 82 }, { a0: WY1 - 100, a1: WY1 - 50, z0: L.main + 30, z1: L.main + 82 }];
  wall('y', WX1 - 10, WY0 + 10, WY1 - 10, 0, L.wingTop, wingSkin, ws, 'wing end');
  ws.forEach(w => windowIn('y', WX1 - 10, 1, w));
  box(WX0, WY0 + 10, L.main - 8, WX1 - 10, WY1 - 10, L.main - 4, { color: [140, 136, 130] }, 'wing joists');
  box(WX0, WY0 + 10, L.main - 4, WX1 - 10, WY1 - 10, L.main, { asset: TILE, color: [168, 128, 88] }, 'wing floor');
  box(WX0, WY0 + 10, L.wingTop - 4, WX1 - 10, WY1 - 10, L.wingTop, { asset: TILE, color: [232, 230, 224], direction: 5 }, 'wing ceiling');
  box((WX0 + WX1) / 2 - 10, 130, L.wingTop - 6, (WX0 + WX1) / 2 + 10, 150, L.wingTop - 4, GLOW([255, 240, 210]), 'wing light');
  // stoop + steps down to the ground in front of the door
  const sx0 = fd.a0 - 10, sx1 = fd.a1 + 10;
  box(sx0, WY0 - 30, 0, sx1, WY0, L.main - 4, { color: [176, 172, 166] }, 'stoop');
  box(sx0, WY0 - 30, L.main - 4, sx1, WY0, L.main, { asset: TILE, color: [190, 186, 180] }, 'stoop top');
  for (let i = 1; i <= 3; i++) box(sx0, WY0 - 30 - i * 10, 0, sx1, WY0 - 30 - (i - 1) * 10, L.main - [0, 14, 28, 42][i], { color: [176, 172, 166] }, 'step'); // 42 28 14
  // chimney on the wing's outer end, standing clear of the eave
  const cy0 = Math.round((WY0 + WY1) / 2 / 10) * 10 - 20;
  for (let z = 0, k = 0; z < 250; z += 12, k++) box(WX1, cy0, z, WX1 + 40, cy0 + 40, Math.min(250, z + 12), { color: shade(brickC, F[k % F.length] * 0.95) }, 'chimney');
  box(WX1 - 2, cy0 - 2, 250, WX1 + 42, cy0 + 42, 256, { color: [120, 118, 114] }, 'chimney cap');

  // --------------------------------------------------------------- roofs --
  function hip(x0, y0, x1, y1, zBase, rise, opts = {}) {
    const LIP = 4, S = Math.min((x1 - x0) * (opts.flatW ? 2 : 1), y1 - y0) / 2; // flatW slopes from one end only
    const { widths, per } = townCourses(S, rise, LIP);
    const lipC = shade(roofC, 0.82);
    let e = 0, k = 0;
    const seg = (ax0, ay0, ax1, ay1, z, ups) => {
      if (ax1 <= ax0 || ay1 <= ay0) return;
      box(ax0, ay0, z, ax1, ay1, z + LIP, { color: k === 0 ? WHITE : lipC }, k === 0 ? 'fascia' : 'roof lip');
      const asset = ups.length === 2 ? 'PB_DefaultMicroWedgeCorner' : 'PB_DefaultMicroWedge';
      const ext = [(ax1 - ax0) / 2, (ay1 - ay0) / 2, (per - LIP) / 2];
      if (!B.add({ asset, ...orientFor(asset, ups, ext), _m: { asset, ups, ext }, color: shade(roofC, [1, 0.95, 1.03][k % 3]), position: [X0 + (ax0 + ax1) / 2, Y0 + (ay0 + ay1) / 2, z + LIP + (per - LIP) / 2] }, 'roof')) throw new Error('splitlevel: roof dropped ' + B.dropped.at(-1));
    };
    for (const w of widths) {
      const ax0 = x0 + (opts.flatW ? 0 : e), ax1 = x1 - e, ay0 = y0 + e, ay1 = y1 - e, z = zBase + k * per;
      if (ax1 <= ax0 || ay1 <= ay0) break;
      const wx = Math.min(w, (ax1 - ax0) / 2), wy = Math.min(w, (ay1 - ay0) / 2);
      const lx = opts.flatW ? 0 : wx; // flatW: the -x side abuts a wall (no hip there)
      seg(ax0 + lx, ay0, ax1 - wx, ay0 + wy, z, [[0, 1]]);
      seg(ax0 + lx, ay1 - wy, ax1 - wx, ay1, z, [[0, -1]]);
      if (!opts.flatW) seg(ax0, ay0 + wy, ax0 + wx, ay1 - wy, z, [[1, 0]]);
      seg(ax1 - wx, ay0 + wy, ax1, ay1 - wy, z, [[-1, 0]]);
      if (!opts.flatW) { seg(ax0, ay0, ax0 + wx, ay0 + wy, z, [[1, 0], [0, 1]]); seg(ax0, ay1 - wy, ax0 + wx, ay1, z, [[1, 0], [0, -1]]); }
      seg(ax1 - wx, ay0, ax1, ay0 + wy, z, [[-1, 0], [0, 1]]);
      seg(ax1 - wx, ay1 - wy, ax1, ay1, z, [[-1, 0], [0, -1]]);
      e += w; k++;
    }
    return zBase + k * per;
  }
  hip(-OV, -OV, SW + OV, DD + OV, L.upTop, 44);
  hip(SW, WY0 - OV, WX1, WY1 + OV, L.wingTop, 40, { flatW: true });

  // ------------------------------------------------------------ driveway --
  box(GD.a0 - 10, -Y0, 0, GD.a1 + 10, 0, 4, { asset: TILE, color: [158, 156, 150] }, 'driveway');
  box(sx0, -Y0, 0, sx1, WY0 - 60, 4, { asset: TILE, color: [176, 172, 166] }, 'front walk');

  // ------------------------------------------------------------- output --
  const Wst = Math.ceil((X0 + WX1 + 40) / 10) - 1, Dst = Math.ceil((Y0 + DD + OV) / 10) - 1; // studs: (W+1)*10 covers it
  const total = (Wst + 1) * 10;
  let bricks = B.bricks.map(({ label, _m, ...b }) => (_m ? { ...b, _m } : b));
  let doorX = X0 + (fd.a0 + fd.a1) / 2;
  if (mirror) {
    // x -> total - x: wedge / corner orientations re-derived from their mirrored ups
    bricks = bricks.map(({ _m, ...b }) => {
      const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
      return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
    });
    doorX = total - doorX;
  } else bricks = bricks.map(({ _m, ...b }) => b);
  return { bricks, W: Wst, D: Dst, door: [Math.round(doorX / 10)], count: bricks.length, top: Math.max(...bricks.map(b => b.position[2] + b.size[2])) };
}

if (process.argv[1]?.endsWith('splitlevel.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'splitlevel.json';
  const h = splitLevel({ seed });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`split-level seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}, top z ${h.top}`);
}
