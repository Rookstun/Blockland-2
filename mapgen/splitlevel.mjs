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
import { tileFloor, pickRoomStyle } from './tilefloors.mjs';

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
  const EXT = 120 + Math.floor(r() * 3) * 20;       // kitchen addition depth behind the wing (12-16 studs)
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
  // floors (tilefloors.mjs): add() in local units, flat diagonal wedges carry _tri for the mirror
  const fadd = (x0, y0, z0, x1, y1, z1, m, label) => box(x0, y0, z0, x1, y1, z1, m, label);
  fadd.wedge = (x0, y0, z0, x1, y1, z1, rot, color) => {
    if (!B.add({ asset: 'PB_DefaultMicroWedge', direction: 4, rotation: rot, _tri: rot, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] }, 'floor triangle')) throw new Error('splitlevel: floor triangle dropped ' + B.dropped.at(-1));
  };
  const style = {}; // one floor style per room kind
  const floor = (room, rect, top) => tileFloor(fadd, rect, top, style[room] ??= pickRoomStyle(room, r), r);
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
  // the garage / family room partition stands on y 150..160
  floor('garage', [10, 10, SW - 10, 150], L.slab);
  box(10, 150, 0, SW - 10, 160, L.slab, { color: [150, 148, 144] }, 'partition footing');
  floor('family', [10, 160, SW - 10, DD - 10], L.slab);
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
  for (const [a, b, c, d] of floorRects) box(a, b, L.upper - 4 - 4, c, d, L.upper - 4, { color: [226, 222, 214] }, 'garage ceiling');
  // upstairs (owner 2026-10-17: "find a spot to make a bathroom"): bedroom across the front,
  // bathroom in the back corner away from the stairs, a hall round the stairwell
  const BP = 140, BX = 90;                                             // bedroom partition y BP..BP+10, bathroom partition x BX..BX+10
  floor('bedroom', [10, 10, SW - 10, BP], L.upper);
  box(10, BP, L.upper - 4, SW - 10, BP + 10, L.upper, { color: [150, 112, 78] }, 'partition sill');
  floor('bathroom', [10, BP + 10, BX, DD - 10], L.upper);
  box(BX, BP + 10, L.upper - 4, BX + 10, DD - 10, L.upper, { color: [150, 112, 78] }, 'partition sill');
  for (const rc of [[BX + 10, BP + 10, SW - 10, hole[1]], [BX + 10, hole[1], hole[0], DD - 10], [hole[0], hole[3], SW - 10, DD - 10]]) floor('hall', rc, L.upper);
  const bedDoor = door(SW - 150, SW - 110, L.upper, L.upper + 76), bathDoor = door(BP + 20, BP + 60, L.upper, L.upper + 76);
  wall('x', BP, 10, SW - 10, L.upper, L.upTop - 4, 'siding', [bedDoor], 'bedroom wall');
  wall('y', BX, BP + 10, DD - 10, L.upper, L.upTop - 4, 'siding', [bathDoor], 'bathroom wall');
  // bathroom: tub along the back wall, toilet, vanity under the side window
  const TUB = [244, 244, 240], BL = L.upper + (style.bathroom === 'bevel' ? 2 : 0); // bevel tiles stand 2 proud
  box(10, DD - 44, BL, BX, DD - 40, BL + 22, { color: TUB }, 'tub side');
  box(10, DD - 40, BL, BX, DD - 10, BL + 4, { color: TUB }, 'tub bottom');
  box(BX - 4, DD - 40, BL + 4, BX, DD - 10, BL + 22, { color: TUB }, 'tub end');
  box(10, DD - 40, BL + 4, 14, DD - 10, BL + 22, { color: TUB }, 'tub end');
  box(14, DD - 40, BL + 4, BX - 4, DD - 14, BL + 6, { color: [150, 200, 220], material: 'BMC_Glass' }, 'bath water');
  box(16, DD - 14, BL + 22, 22, DD - 10, BL + 34, { color: [190, 190, 196], material: 'BMC_Metallic' }, 'tap');
  box(12, BP + 22, BL, 24, BP + 34, BL + 12, { color: TUB }, 'toilet base');
  box(10, BP + 18, BL + 12, 30, BP + 38, BL + 16, { color: TUB }, 'toilet seat');
  box(10, BP + 20, BL + 16, 16, BP + 36, BL + 34, { color: TUB }, 'toilet tank');
  box(10, BP + 56, BL, 26, BP + 96, BL + 30, { color: [120, 86, 60] }, 'vanity');
  box(10, BP + 54, BL + 30, 28, BP + 98, BL + 34, { color: [232, 230, 226] }, 'vanity top');
  box(12, BP + 66, BL + 34, 22, BP + 86, BL + 36, { color: [190, 190, 196], material: 'BMC_Metallic' }, 'basin');
  box(40, BP + 60, L.upTop - 6, 60, BP + 80, L.upTop - 4, GLOW([255, 244, 220]), 'bath light');
  box(SW - 60, BP + 20, L.upTop - 6, SW - 40, BP + 40, L.upTop - 4, GLOW([255, 240, 210]), 'hall light');
  box(40, 220, L.upper - 10, 60, 240, L.upper - 8, GLOW([255, 240, 210]), 'family light');
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
  // the back wall opens wide into the kitchen addition (owner 2026-10-17: "add or extend another room")
  const arch = { a0: WX0 + 40, a1: WX1 - 50, z0: L.main, z1: L.main + 84 };
  wall('x', WY1 - 10, WX0, WX1, 0, L.wingTop, wingSkin, [arch], 'wing back');
  box(arch.a0, WY1 - 10, arch.z1 - 4, arch.a1, WY1, arch.z1, { color: WHITE }, 'arch head');
  const ws = [{ a0: WY0 + 50, a1: WY0 + 100, z0: L.main + 30, z1: L.main + 82 }, { a0: WY1 - 100, a1: WY1 - 50, z0: L.main + 30, z1: L.main + 82 }];
  wall('y', WX1 - 10, WY0 + 10, WY1 - 10, 0, L.wingTop, wingSkin, ws, 'wing end');
  ws.forEach(w => windowIn('y', WX1 - 10, 1, w));
  box(WX0, WY0 + 10, L.main - 8, WX1 - 10, WY1 - 10, L.main - 4, { color: [140, 136, 130] }, 'wing joists');
  floor('living', [WX0, WY0 + 10, WX1 - 10, WY1 - 10], L.main);
  box(WX0, WY0 + 10, L.wingTop - 4, WX1 - 10, WY1 - 10, L.wingTop, { asset: TILE, color: [232, 230, 224], direction: 5 }, 'wing ceiling');
  box((WX0 + WX1) / 2 - 10, 130, L.wingTop - 6, (WX0 + WX1) / 2 + 10, 150, L.wingTop - 4, GLOW([255, 240, 210]), 'wing light');
  // stoop + steps down to the ground in front of the door
  const sx0 = fd.a0 - 10, sx1 = fd.a1 + 10;
  box(sx0, WY0 - 30, 0, sx1, WY0, L.main - 4, { color: [176, 172, 166] }, 'stoop');
  box(sx0, WY0 - 30, L.main - 4, sx1, WY0, L.main, { asset: TILE, color: [190, 186, 180] }, 'stoop top');
  for (let i = 1; i <= 3; i++) box(sx0, WY0 - 30 - i * 10, 0, sx1, WY0 - 30 - (i - 1) * 10, L.main - [0, 14, 28, 42][i], { color: [176, 172, 166] }, 'step'); // 42 28 14
  // kitchen addition behind the wing: one storey, flat roof under the wing's eave, counters along
  // the back wall (sink, stove), a fridge in the corner, windows over the counter and in the end
  const KY0 = WY1, KY1 = WY1 + EXT, KZ = L.main + 96;               // KZ: wall top (the wing eave is at 164)
  const kWin = [{ a0: WX0 + 70, a1: WX0 + 130, z0: L.main + 50, z1: L.main + 86 }, ...(WW >= 280 ? [{ a0: WX1 - 110, a1: WX1 - 50, z0: L.main + 50, z1: L.main + 86 }] : [])];
  const kEnd = [{ a0: KY0 + 30, a1: KY1 - 40, z0: L.main + 30, z1: L.main + 82 }];
  wall('y', WX0, KY0, KY1, 0, KZ, wingSkin, [], 'kitchen side');
  wall('x', KY1 - 10, WX0 + 10, WX1, 0, KZ, wingSkin, kWin, 'kitchen back');
  wall('y', WX1 - 10, KY0, KY1 - 10, 0, KZ, wingSkin, kEnd, 'kitchen end');
  kWin.forEach(w => windowIn('x', KY1 - 10, 1, w));
  kEnd.forEach(w => windowIn('y', WX1 - 10, 1, w));
  box(WX0 + 10, KY0, L.main - 8, WX1 - 10, KY1 - 10, L.main - 4, { color: [140, 136, 130] }, 'kitchen joists');
  floor('kitchen', [WX0 + 10, KY0, WX1 - 10, KY1 - 10], L.main);
  box(WX0 + 10, KY0, KZ - 4, WX1 - 10, KY1 - 10, KZ, { asset: TILE, color: [236, 234, 228], direction: 5 }, 'kitchen ceiling');
  // flat roof: a white fascia slab, a membrane on top (stays under the wing's back eave)
  box(WX0, KY0, KZ, WX1 + 10, KY1 + 10, KZ + 4, { color: WHITE }, 'kitchen fascia');
  box(WX0 + 10, KY0, KZ + 4, WX1, KY1, KZ + 6, { color: shade(roofC, 0.8) }, 'kitchen roof');
  const CAB = [[230, 226, 214], [120, 150, 130], [150, 110, 76], [70, 86, 110]][Math.floor(r() * 4)], TOP = [[60, 60, 64], [226, 222, 214], [150, 130, 110]][Math.floor(r() * 3)];
  const ck0 = WX0 + 50, ck1 = WX1 - 10, cy1 = KY1 - 10, cyf = cy1 - 24, KF = L.main + (style.kitchen === 'bevel' ? 2 : 0);
  box(ck0, cyf, KF, ck1, cy1, KF + 34, { color: CAB }, 'cabinets');
  for (let x = ck0 + 4; x + 16 <= ck1 - 4; x += 20) box(x, cyf - 2, KF + 6, x + 16, cyf, KF + 30, { color: shade(CAB, 0.9) }, 'cabinet door');
  box(ck0, cyf - 2, KF + 34, ck1, cy1, KF + 38, { color: TOP }, 'worktop');
  const sinkX = Math.round((kWin[0].a0 + kWin[0].a1) / 20) * 10;
  box(sinkX - 14, cyf + 4, KF + 38, sinkX + 14, cy1 - 4, KF + 40, { color: [190, 190, 196], material: 'BMC_Metallic' }, 'sink');
  const stX = Math.round((ck1 - 30) / 10) * 10;
  box(stX - 14, cyf + 2, KF + 38, stX + 14, cy1 - 2, KF + 40, { color: [36, 36, 38] }, 'hob');
  for (const [dx, dy] of [[-8, 6], [8, 6], [-8, 16], [8, 16]]) box(stX + dx - 3, cyf + dy - 3, KF + 40, stX + dx + 3, cyf + dy + 3, KF + 42, { color: [160, 40, 20], material: 'BMC_Glow', material_intensity: 1 }, 'burner');
  box(WX0 + 12, cy1 - 30, KF, WX0 + 44, cy1, KF + 84, { color: [236, 236, 236] }, 'fridge');
  box(WX0 + 38, cy1 - 32, KF + 50, WX0 + 40, cy1 - 30, KF + 74, { color: [180, 180, 186], material: 'BMC_Metallic' }, 'fridge handle');
  box((WX0 + WX1) / 2 - 10, KY0 + 40, KZ - 6, (WX0 + WX1) / 2 + 10, KY0 + 60, KZ - 4, GLOW([255, 244, 220]), 'kitchen light');
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
  const Wst = Math.ceil((X0 + WX1 + 40) / 10) - 1, Dst = Math.ceil((Y0 + DD + EXT + 10) / 10) - 1; // studs: (W+1)*10 covers it
  const total = (Wst + 1) * 10;
  let bricks = B.bricks.map(({ label, _m, ...b }) => (_m ? { ...b, _m } : b));
  let doorX = X0 + (fd.a0 + fd.a1) / 2;
  if (mirror) {
    // x -> total - x: wedge / corner orientations re-derived from their mirrored ups
    bricks = bricks.map(({ _m, _tri, ...b }) => {
      const nb = { ...b, position: [total - b.position[0], b.position[1], b.position[2]] };
      if (_tri != null) return { ...nb, rotation: [1, 0, 3, 2][_tri] }; // a flat triangle's owned corner flips in x
      return _m ? { ...nb, ...orientFor(_m.asset, _m.ups.map(([dx, dy]) => [-dx, dy]), _m.ext) } : nb;
    });
    doorX = total - doorX;
  } else bricks = bricks.map(({ _m, _tri, ...b }) => b);
  return { bricks, W: Wst, D: Dst, door: [Math.round(doorX / 10)], count: bricks.length, top: Math.max(...bricks.map(b => b.position[2] + b.size[2])) };
}

if (process.argv[1]?.endsWith('splitlevel.mjs')) {
  const seed = +(process.argv[2] ?? 1), out = process.argv[3] ?? 'splitlevel.json';
  const h = splitLevel({ seed });
  fs.writeFileSync(out, JSON.stringify(h.bricks));
  console.error(`split-level seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, door x ${h.door[0]}, top z ${h.top}`);
}
