// Brick orientation helpers shared by mapgen and the house builder.
//
// Orientation: ORIENT[code] maps a brick's local axes to world axes (Omegga's
// translationTable; code = direction * 4 + rotation), checked in-game with a
// test kit. Natively the micro wedge is a side wedge, solid where x + y <= 0
// and extruded along local z; the corner pieces are solid where
// SIGN·(x, y, z) <= -1 (tetrahedron) or <= 1 (cut cube). So a piece rises
// toward world directions D1 (and D2) when its local axes, scaled by -SIGN,
// map onto {+Z, -D1, -D2}.
// The corner tetrahedron stands upright as-is (local z up, apex over the
// local -x -y corner, placed by hand in-game), so it only turns: CORNER_ROT
// is the Z+ rotation that puts the apex toward world corner (dx, dy).
const SIGN = {
  PB_DefaultMicroWedge: [-1, -1],
  PB_DefaultMicroWedgeOuterCorner: [-1, -1, -1],
};
const CORNER_ROT = { '-1,-1': 0, '1,-1': 1, '1,1': 2, '-1,1': 3 };
export const ORIENT = [
  ([x, y, z]) => [z, -y, x], ([x, y, z]) => [z, -x, -y], ([x, y, z]) => [z, y, -x], ([x, y, z]) => [z, x, y],
  ([x, y, z]) => [-z, y, x], ([x, y, z]) => [-z, x, -y], ([x, y, z]) => [-z, -y, -x], ([x, y, z]) => [-z, -x, y],
  ([x, y, z]) => [y, z, x], ([x, y, z]) => [x, z, -y], ([x, y, z]) => [-y, z, -x], ([x, y, z]) => [-x, z, y],
  ([x, y, z]) => [-y, -z, x], ([x, y, z]) => [-x, -z, -y], ([x, y, z]) => [y, -z, -x], ([x, y, z]) => [x, -z, y],
  ([x, y, z]) => [x, y, z], ([x, y, z]) => [-y, x, z], ([x, y, z]) => [-x, -y, z], ([x, y, z]) => [y, -x, z],
  ([x, y, z]) => [-x, y, -z], ([x, y, z]) => [y, x, -z], ([x, y, z]) => [x, -y, -z], ([x, y, z]) => [-y, -x, -z],
];
const orientCache = new Map();
/** direction, rotation and local size for a piece whose local x, y (and z for
 * corners) map onto +Z and the negated uphill directions; ext = world half-extents */
export function orientFor(asset, ups, ext, zSign = 1) { // zSign -1: flat face up (a hanging / inverted wedge)
  const key = JSON.stringify([asset, ups, ext, zSign]);
  const sign = SIGN[asset];
  if (asset === 'PB_DefaultMicroWedgeCorner') {
    const res = { direction: 4, rotation: CORNER_ROT[[ups[0][0] + ups[1][0], ups[0][1] + ups[1][1]].join()], size: [...ext] };
    orientCache.set(key, res);
    return res;
  }
  if (orientCache.has(key)) return orientCache.get(key);
  const want = [[0, 0, zSign], ...ups.map(([dx, dy]) => [-dx, -dy, 0])].map(String).sort();
  for (let c = 0; c < 24; c++) {
    const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => ORIENT[c](v).map(q => q + 0)); // +0 drops -0
    const got = sign.map((g, i) => ax[i].map(q => -g * q + 0)).map(String).sort();
    if (got.join('|') !== want.join('|')) continue;
    const res = { direction: c >> 2, rotation: c & 3, size: ax.map(v => ext[v.findIndex(q => q !== 0)]) };
    orientCache.set(key, res);
    return res;
  }
  throw new Error('no orientation for ' + key);
}

const FIXED = { B_SpawnPoint: [20, 20, 2], B_1x1_Round: [5, 5, 6], B_4x4_Round: [20, 20, 6], B_2x2_Round: [10, 10, 6], B_1x1_Cone: [5, 5, 6] };
/** world-space AABB [lo, hi] of a brick, with its local size rotated by its orientation */
export function worldBox(b, fixed = FIXED) {
  const s = b.size?.[0] ? b.size : fixed[b.asset] ?? [5, 5, 6];
  const c = (b.direction ?? 4) * 4 + (b.rotation ?? 0);
  const e = [0, 0, 0];
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((v, i) => { e[ORIENT[c](v).findIndex(q => q !== 0)] = s[i]; });
  return [b.position.map((p, i) => p - e[i]), b.position.map((p, i) => p + e[i])];
}

/** a brick turned r quarter turns anticlockwise about the world z axis through the origin */
export function turnBrick(b, r) {
  r = ((r % 4) + 4) % 4;
  if (!r) return b;
  const R = ([x, y, z]) => { for (let i = 0; i < r; i++) [x, y] = [-y, x]; return [x + 0, y + 0, z]; };
  const c = (b.direction ?? 4) * 4 + (b.rotation ?? 0);
  const want = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => R(ORIENT[c](v)).join());
  const c2 = ORIENT.findIndex(f => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].every((v, i) => f(v).map(q => q + 0).join() === want[i]));
  if (c2 < 0) throw new Error('no turned orientation');
  return { ...b, direction: c2 >> 2, rotation: c2 & 3, position: R(b.position) };
}
