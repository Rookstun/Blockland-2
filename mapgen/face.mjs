// crazyjaydon's wish (2026-11-02, granted by the owner): "a realistic human face". An original sculpted relief: an
// analytic depth map (skull ellipsoid + brow ridge, eye sockets, nose, cheekbones, lips, chin, jaw) laid as 4x4 columns
// of micro bricks rising toward -y, skin shaded by the surface normal (light from upper left), white eyes with iris and
// pupil, eyebrows and hair darker, runs of equal depth + colour merged. Face looks -y, base on the ground.
//   node mapgen/face.mjs X Y Z job.json
import fs from 'fs';

const C = 4, NX = 40, NZ = 54;                       // 160 wide, 216 tall
const g = (x, z, cx, cz, sx, sz) => Math.exp(-(((x - cx) / sx) ** 2) - (((z - cz) / sz) ** 2));

export function face() {
  // u in [-1, 1] across, v in [-1, 1] up (v 0 = eye line a bit above centre)
  const depth = (u, v) => {
    const head = 1 - (u / 0.92) ** 2 - ((v - 0.05) / (v < 0 ? 1.0 : 0.95)) ** 2;
    if (head <= 0) return 0;
    let d = 34 * Math.sqrt(head);
    d += 5 * g(u, v, 0, 0.32, 0.6, 0.08);                                   // brow ridge
    d -= 7 * (g(u, v, -0.36, 0.18, 0.17, 0.09) + g(u, v, 0.36, 0.18, 0.17, 0.09)); // eye sockets
    d += 4 * (g(u, v, -0.5, -0.12, 0.17, 0.14) + g(u, v, 0.5, -0.12, 0.17, 0.14)); // cheekbones
    d += 16 * g(u, v, 0, -0.05, 0.1, 0.26) * (v < 0.25 ? 1 : 0.5);         // nose bridge + tip
    d += 6 * g(u, v, 0, -0.27, 0.14, 0.06);                                  // nostril wings
    d -= 3 * g(u, v, 0, -0.38, 0.1, 0.035);                                  // philtrum / under nose
    d += 5 * g(u, v, 0, -0.47, 0.24, 0.05) + 4 * g(u, v, 0, -0.58, 0.2, 0.05); // lips
    d -= 3 * g(u, v, 0, -0.53, 0.26, 0.018);                                 // mouth line
    d += 5 * g(u, v, 0, -0.82, 0.2, 0.1);                                    // chin
    return Math.max(0, d);
  };
  const SKIN = [222, 176, 144], LIP = [178, 98, 92], HAIR = [58, 40, 30], WHITE = [240, 238, 232], IRIS = [66, 104, 140], PUPIL = [16, 16, 18];
  const cells = [];
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const u = (i + 0.5 - NX / 2) / (NX / 2), v = (k + 0.5 - NZ / 2) / (NZ / 2) * 1.1;
    let d = depth(u, v);
    if (d < 1) continue;
    // hair: a cap over the top and sides of the skull
    const hair = v > 0.55 - 0.25 * u * u || (Math.abs(u) > 0.78 && v > 0.05);
    if (hair) d += 4;
    const n = [depth(u - 0.03, v) - depth(u + 0.03, v), depth(u, v - 0.03) - depth(u, v + 0.03)];
    const lit = Math.max(0.55, Math.min(1.12, 0.95 + 0.012 * (n[0] * 0.7 + n[1] * 0.9)));
    let col = hair ? HAIR : SKIN;
    if (!hair && g(u, v, 0, -0.52, 0.22, 0.07) > 0.5) col = LIP;
    for (const ex of [-0.36, 0.36]) {
      const r = Math.hypot((u - ex) / 1.6, v - 0.18);
      if (r < 0.09) col = r < 0.035 ? PUPIL : r < 0.065 ? IRIS : WHITE;
      if (!hair && Math.abs(u - ex) < 0.2 && v > 0.3 && v < 0.37) col = HAIR;   // eyebrows
    }
    const c = col === SKIN || col === LIP || col === HAIR ? col.map(x => Math.min(255, Math.round(x * lit))) : col;
    cells.push({ i, k, d: Math.round(d / 2) * 2, c });
  }
  // merge runs along x with the same depth + colour
  const bricks = [], key = q => `${q.d}|${q.c}`;
  const at = new Map(cells.map(q => [`${q.i},${q.k}`, q]));
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const q = at.get(`${i},${k}`);
    if (!q || q.done) continue;
    let e = i;
    while (at.get(`${e + 1},${k}`) && !at.get(`${e + 1},${k}`).done && key(at.get(`${e + 1},${k}`)) === key(q)) e++;
    for (let s = i; s <= e; s++) at.get(`${s},${k}`).done = true;
    const x0 = (i - NX / 2) * C, x1 = (e + 1 - NX / 2) * C, z0 = 24 + k * C;
    bricks.push({ asset: 'PB_DefaultMicroBrick', size: [(x1 - x0) / 2, q.d / 2, C / 2], position: [(x0 + x1) / 2, -q.d / 2, z0 + C / 2], color: q.c });
  }
  // neck + plinth
  bricks.push({ asset: 'PB_DefaultMicroBrick', size: [22, 12, 6], position: [0, -12, 18], color: [208, 162, 132] });
  bricks.push({ asset: 'PB_DefaultMicroBrick', size: [60, 30, 6], position: [0, -10, 6], color: [150, 146, 140] });
  return bricks;
}

if (process.argv[1]?.endsWith('face.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'face.json';
  const bricks = face().map(b => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  const bad = bricks.filter(b => b.position.some(v => !Number.isInteger(v)) || b.size.some(v => !Number.isInteger(v)));
  if (bad.length) throw new Error('off-grid ' + JSON.stringify(bad[0]));
  fs.writeFileSync(out, JSON.stringify(bricks));
  console.error(`face: ${bricks.length} bricks`);
}
