// Checkpoint shrines (owner 2026-10-13: "add checkpoints as ornate works of masonry with
// wedges and angles and such and add more of them"). A B_CheckPoint on a stepped
// octagonal plinth, four banded pillars with capitals and pyramid caps, lintels with
// sloped pediments, a stepped hip roof of wedges and corner pieces, a glowing finial
// and a lantern over the checkpoint. Footprint +-50 units, about 150 high.
//
//   shrine(seed) -> bricks in local units, origin = ground centre (z 0 = ground top)
import { orientFor } from './orient.mjs';

const MB = 'PB_DefaultMicroBrick', W = 'PB_DefaultMicroWedge', CORNER = 'PB_DefaultMicroWedgeCorner';
const STONES = [
  { stone: [196, 188, 172], trim: [150, 142, 128], dark: [108, 102, 94], roof: [92, 108, 126] },   // limestone, slate roof
  { stone: [170, 160, 150], trim: [128, 120, 112], dark: [86, 82, 78], roof: [138, 64, 50] },      // grey granite, terracotta
  { stone: [214, 196, 150], trim: [176, 154, 108], dark: [122, 104, 72], roof: [70, 96, 70] },     // sandstone, green copper
  { stone: [150, 156, 166], trim: [112, 118, 130], dark: [72, 76, 88], roof: [60, 60, 66] },       // blue stone, dark slate
];

export function shrine(seed = 1) {
  const P = STONES[((seed % STONES.length) + STONES.length) % STONES.length];
  const out = [];
  const box = (x0, y0, z0, x1, y1, z1, color, extra = {}) => out.push({ asset: MB, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color, ...extra });
  // a side wedge in the corner cell [x0,x1]x[y0,y1] (z0..z1), solid toward the inside (sx, sy)
  // (micro wedge natively solid where x + y <= 0, i.e. toward (-,-): rotation per corner)
  const SIDE_ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 };
  const chamfer = (x0, y0, x1, y1, z0, z1, sx, sy, color) =>
    out.push({ asset: W, direction: 4, rotation: SIDE_ROT[sx + ',' + sy], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color });
  // a ramp face: a micro wedge over [x0,x1]x[y0,y1] rising toward (dx, dy)
  const slope = (x0, y0, x1, y1, z0, z1, dx, dy, color) => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    out.push({ asset: W, ...orientFor(W, [[dx, dy]], ext), position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color });
  };
  const tetra = (x0, y0, x1, y1, z0, z1, dx, dy, color) => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    out.push({ asset: CORNER, ...orientFor(CORNER, [[dx, 0], [0, dy]], ext), position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color });
  };
  // octagonal slab: square of half r, corners cut by c, z0..z1
  const octSlab = (r, c, z0, z1, color, edge) => {
    box(-r + c, -r, z0, r - c, r, z1, color);
    box(-r, -r + c, z0, -r + c, r - c, z1, color);
    box(r - c, -r + c, z0, r, r - c, z1, color);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const xa = sx < 0 ? -r : r - c, ya = sy < 0 ? -r : r - c;
      chamfer(xa, ya, xa + c, ya + c, z0, z1, -sx, -sy, edge ?? color);
    }
  };

  // plinth: three octagonal tiers, a dark course between
  octSlab(50, 10, 0, 6, P.dark);
  octSlab(46, 10, 6, 12, P.stone, P.trim);
  octSlab(40, 10, 12, 18, P.trim);
  octSlab(34, 8, 18, 22, P.stone);
  // checkpoint sits on the top tier (B_CheckPoint is 4 x 4 studs, 4 high): placed by the caller at z 22
  const PZ = 22, TOP = 100;
  // four pillars at the corners of the top tier, banded, with a wider capital and a pyramid cap
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * 30, cy = sy * 30;
    box(cx - 6, cy - 6, PZ, cx + 6, cy + 6, PZ + 4, P.dark);                       // base moulding
    for (let z = PZ + 4, k = 0; z < TOP - 8; z += 12, k++) box(cx - 4, cy - 4, z, cx + 4, cy + 4, Math.min(TOP - 8, z + 12), k % 2 ? P.trim : P.stone);
    box(cx - 6, cy - 6, TOP - 8, cx + 6, cy + 6, TOP - 4, P.dark);                 // capital
    box(cx - 6, cy - 6, TOP - 4, cx + 6, cy + 6, TOP, P.trim);
  }
  // lintels on all four sides (pillar to pillar), a sloped pediment over the two faces (+-y)
  box(-36, -36, TOP, 36, -24, TOP + 8, P.stone);
  box(-36, 24, TOP, 36, 36, TOP + 8, P.stone);
  box(-36, -24, TOP, -24, 24, TOP + 8, P.stone);
  box(24, -24, TOP, 36, 24, TOP + 8, P.stone);
  box(-24, -24, TOP + 4, 24, 24, TOP + 8, P.trim);                                 // ceiling (micro bricks: no undersides)
  for (const sy of [-1, 1]) {
    // pediment: two wedges rising to the middle over the lintel face, a keystone between
    slope(-36, sy < 0 ? -36 : 24, -4, sy < 0 ? -24 : 36, TOP + 8, TOP + 20, 1, 0, P.trim);
    slope(4, sy < 0 ? -36 : 24, 36, sy < 0 ? -24 : 36, TOP + 8, TOP + 20, -1, 0, P.trim);
    box(-4, sy < 0 ? -36 : 24, TOP + 8, 4, sy < 0 ? -24 : 36, TOP + 24, P.dark);
  }
  box(-24, -24, TOP + 8, 24, 24, TOP + 12, P.dark);                                // under the roof
  box(-36, -24, TOP + 8, -24, 24, TOP + 12, P.dark);                               // side cornices
  box(24, -24, TOP + 8, 36, 24, TOP + 12, P.dark);
  // stepped hip roof: three shrinking layers, each a core with four sloped edges and four
  // corner tetrahedra, eaves overhanging the frame
  let z = TOP + 12;
  for (const [r, e, h] of [[24, 10, 12], [16, 8, 10], [9, 6, 8]]) {
    box(-r + e, -r + e, z, r - e, r - e, z + h, P.roof);
    slope(-r + e, -r, r - e, -r + e, z, z + h, 0, 1, P.roof);
    slope(-r + e, r - e, r - e, r, z, z + h, 0, -1, P.roof);
    slope(-r, -r + e, -r + e, r - e, z, z + h, 1, 0, P.roof);
    slope(r - e, -r + e, r, r - e, z, z + h, -1, 0, P.roof);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const xa = sx < 0 ? -r : r - e, ya = sy < 0 ? -r : r - e;
      tetra(xa, ya, xa + e, ya + e, z, z + h, -sx, -sy, P.roof);
    }
    z += h;
  }
  // finial: a dark collar and a glowing gem
  box(-4, -4, z, 4, 4, z + 4, P.dark);
  box(-2, -2, z + 4, 2, 2, z + 12, P.stone, { material: 'BMC_Glow', material_intensity: 6, color: [255, 214, 120] });
  // lantern hanging under the ceiling over the checkpoint
  box(-1, -1, TOP - 10, 1, 1, TOP + 4, P.dark);
  box(-3, -3, TOP - 18, 3, 3, TOP - 10, P.stone, { material: 'BMC_Glow', material_intensity: 5, color: [255, 196, 120] });
  return out;
}

/** the checkpoint brick itself, on the shrine (local units) */
export const CHECKPOINT_AT = [0, 0, 22 + 2];
export const FOOT = 50; // half footprint (units)
