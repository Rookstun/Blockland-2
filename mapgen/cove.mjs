// Coves (owner 2026-10-14: "make a cove ... really really beautiful like huge stalagmites,
// moss growing upward from the ocean floor to the rocks and beaches and trees and like a
// charcuterie of interesting coastline shit").
//
// mapgen carves the bay (water / sand beach / cliff rim, see 'coves' there) and calls
// coveDressing() for what stands in it:
//   - sea stacks: huge noisy tapering spires from the seabed (strata, ledges), a couple
//     framing the mouth out in the sea, a sea arch on one side of the mouth, little
//     beach stalagmites; coloured by height: deep teal moss and kelp under the water,
//     bright moss and barnacles at the tide line, moss creeping up the stone above
//     (thinning with height, thicker on ledges), grassy tops, a pine on some tops
//   - moss cushions on the seabed, thickest round the stack feet
//   - kelp strands swaying up from the floor to just under the surface (walk-through)
//   - beach: driftwood, shells, starfish, crabs, a beached rowboat, rock pools
//   - tree spots: palms on the beach, pines / oaks / cherries on the rim
// Everything is voxels on a 10-unit lattice (rock grid) or small micro bricks; mapgen
// places them through props.mjs (cut away inside terrain, skirts down to the bed).

export const CV = 10; // rock voxel size (units)

const hash3 = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t);
function noise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), a = sm(x - xi), b = sm(y - yi), c = sm(z - zi);
  const L = (p, q, t) => p + (q - p) * t, v = (i, j, k) => hash3(xi + i, yi + j, zi + k, s);
  return L(L(L(v(0, 0, 0), v(1, 0, 0), a), L(v(0, 1, 0), v(1, 1, 0), a), b), L(L(v(0, 0, 1), v(1, 0, 1), a), L(v(0, 1, 1), v(1, 1, 1), a), b), c);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const COVE_COLORS = [
  [176, 158, 126], [158, 142, 114], [138, 126, 104], [192, 176, 144], // 0-3 sandstone strata
  [46, 86, 66], [38, 72, 58],                                        // 4-5 deep moss
  [92, 98, 48],                                                      // 6 kelp brown
  [84, 138, 62], [104, 152, 72],                                     // 7-8 tide-line moss
  [214, 210, 196],                                                   // 9 barnacles
  [92, 120, 62], [74, 104, 54],                                      // 10-11 creeping moss
  [96, 150, 62],                                                     // 12 grass top
  [124, 122, 120], [108, 108, 110],                                  // 13-14 grey stone
  [238, 236, 228], [224, 222, 214], [246, 245, 240],                 // 15-17 chalk
  [236, 150, 150],                                                   // 18 coral
  [222, 132, 138],                                                   // 19 coral shade
  [120, 72, 44], [100, 60, 38],                                      // 20-21 cave lining
  [196, 130, 70], [176, 112, 60],                                    // 22-23 ochre headland
];
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };

/**
 * site: { cx, cy (world), nx, ny (unit, inland), R (units), seed }
 * ctx:  { ground(wx, wy) -> top z, water (z of the water plane), zone(wx, wy) -> 'water' |
 *         'beach' | 'rim' | 'sea' (open sea outside the bay) | null }
 * -> { vox: Map "i,j,k" -> colour, bricks, trees: [{ kind, x, y, z, seed, size }], stats }
 */
export function coveDressing(site, ctx) {
  const { cx, cy, nx, ny, R, seed } = site, { ground, water: W, zone } = ctx;
  const tx = -ny, ty = nx; // along the shore
  let rs = 0;
  const rnd = () => hash3(seed, rs++, 7, 31);
  const vox = new Map(), K = (i, j, k) => i + ',' + j + ',' + k;
  const stats = { stacks: 0, arch: 0, coral: 0, stalagmites: 0, cushions: 0, kelp: 0, drift: 0, shells: 0, starfish: 0, crabs: 0, boats: 0, pools: 0, trees: 0 };
  const trees = [], bricks = [];

  // voxel tags while shaping (coloured at the end): -1 sandstone, -2 chalk, -3 headland rock,
  // -4 headland cave lining; >= 0 a fixed colour
  const tagSet = (i, j, k, tag) => { const key = K(i, j, k), o = vox.get(key); if (o === undefined || (o < 0 && tag < o)) vox.set(key, tag); };
  // a tapering noisy column: base (bx, by) on ground gz, height hs, radii r0 -> rt, lean (lx, ly) at the top
  function spire(bx, by, gz, hs, r0, rt, lx, ly, s, tag = -1) {
    const z0 = Math.floor((gz - 30) / CV), z1 = Math.ceil((gz + hs) / CV);
    for (let k = z0; k <= z1; k++) {
      const z = (k + 0.5) * CV, t = clamp((z - gz) / hs, 0, 1);
      const ccx = bx + lx * Math.pow(t, 1.5), ccy = by + ly * Math.pow(t, 1.5);
      // ledges: the column swells a little every ~56 units
      const ledge = ((z + s * 13) / 56) % 1 < 0.2 ? 0.1 : 0;
      let rad = r0 * Math.pow(1 - t, 0.6) + rt * t;
      if (t > 0.92) rad *= Math.sqrt(Math.max(0, 1 - (t - 0.92) / 0.08)) * 0.6 + 0.4; // rounded crown
      const reach = rad * 1.5 + CV;
      for (let i = Math.floor((ccx - reach) / CV); i <= Math.ceil((ccx + reach) / CV); i++)
        for (let j = Math.floor((ccy - reach) / CV); j <= Math.ceil((ccy + reach) / CV); j++) {
          const x = (i + 0.5) * CV, y = (j + 0.5) * CV, d = Math.hypot(x - ccx, y - ccy);
          // vertical fluting (chalk / sandstone weathers in long grooves) + lumps
          const n = noise(x / 30, y / 30, z / 140, s) * 0.5 + noise(x / 14, y / 14, z / 40, s + 3) * 0.22 - 0.36;
          if (d > rad * (1 + n + ledge) || t >= 1) continue;
          tagSet(i, j, k, tag);
        }
    }
  }
  // a chain of spheres; amp = surface noise
  function chain(pts, r, s, tag, amp = 0.5) {
    for (const [px, py, pz] of pts)
      for (let i = Math.floor((px - r * 1.4) / CV); i <= Math.ceil((px + r * 1.4) / CV); i++)
        for (let j = Math.floor((py - r * 1.4) / CV); j <= Math.ceil((py + r * 1.4) / CV); j++)
          for (let k = Math.floor((pz - r * 1.4) / CV); k <= Math.ceil((pz + r * 1.4) / CV); k++) {
            const x = (i + 0.5) * CV, y = (j + 0.5) * CV, z = (k + 0.5) * CV;
            const n = (noise(x / 26, y / 26, z / 26, s) - 0.5) * amp;
            if (Math.hypot(x - px, y - py, z - pz) <= r * (1 + n)) { if (tag >= 0) vox.set(K(i, j, k), tag); else tagSet(i, j, k, tag); }
          }
  }
  function blob(px, py, pz, rx, rz, s, col) {
    for (let i = Math.floor((px - rx * 1.3) / CV); i <= Math.ceil((px + rx * 1.3) / CV); i++)
      for (let j = Math.floor((py - rx * 1.3) / CV); j <= Math.ceil((py + rx * 1.3) / CV); j++)
        for (let k = Math.floor((pz - rz * 1.3) / CV); k <= Math.ceil((pz + rz * 1.3) / CV); k++) {
          const x = (i + 0.5) * CV, y = (j + 0.5) * CV, z = (k + 0.5) * CV;
          const d = ((x - px) / rx) ** 2 + ((y - py) / rx) ** 2 + ((z - pz) / rz) ** 2;
          if (d <= 0.8 + noise(x / 18, y / 18, z / 18, s) * 0.5 && !vox.has(K(i, j, k))) vox.set(K(i, j, k), col(i, j, k));
        }
  }

  // ---- the headland and its great sea arch (Cathedral Cove): a rock ridge running out to
  // sea from the cliffs on one side of the mouth, cliff-high, a tall pointed archway
  // through it at beach level from the bay to the outer shore; warm stone, dark cave
  // lining, grass and a tree on top
  const hd = site.head;
  if (hd) {
    const gz = ground(hd.x, hd.y), top = (site.cliffTop ?? W + 360) + 10;
    const A = 300, B = 130, TW = 170, TH = 220; // half length (seaward), half width, arch width / height
    const cuz = (x, y) => [(x - hd.x) * hd.ax + (y - hd.y) * hd.ay, (x - hd.x) * hd.tx + (y - hd.y) * hd.ty];
    const reach = A * 1.25 + 80;
    for (let k = Math.floor((gz - 40) / CV); k <= Math.ceil(top / CV); k++) {
      const z = (k + 0.5) * CV, t = clamp((z - gz) / (top - gz), 0, 1);
      for (let i = Math.floor((hd.x - reach) / CV); i <= Math.ceil((hd.x + reach) / CV); i++)
        for (let j = Math.floor((hd.y - reach) / CV); j <= Math.ceil((hd.y + reach) / CV); j++) {
          const x = (i + 0.5) * CV, y = (j + 0.5) * CV, [u, v] = cuz(x, y);
          // the ridge: long seaward, its nose rounding off and stepping back as it rises
          const ua = u < 0 ? u / (A * 1.2) : u / (A * (1 - 0.3 * t)), vb = v / (B * (1 - 0.18 * t));
          const n = noise(x / 40, y / 40, z / 120, seed + 61) * 0.5 + noise(x / 16, y / 16, z / 30, seed + 62) * 0.2 - 0.35;
          if (ua * ua + vb * vb > 1 + n) continue;
          // the archway: a pointed arch through the ridge along v, at u ~ 0
          const ar = Math.abs(u) / (TW / 2), az = (z - gz) / TH;
          if (z >= gz - 4 && ar < 1 && az < Math.sqrt(1 - ar * ar) * (1 - 0.25 * ar)) continue;
          const lining = z >= gz - 4 && (Math.abs(u) / (TW / 2 + 40)) ** 2 + ((z - gz) / (TH + 40)) ** 2 < 1;
          tagSet(i, j, k, lining ? -4 : -3);
        }
    }
    trees.push({ kind: 'oak', x: hd.x + hd.ax * 120, y: hd.y + hd.ay * 120, z: top - 30, seed: seed * 53, size: 0.6 });
    stats.arch = 1;
  }

  // ---- sea stacks: in the deep bay, and a couple out past the mouth; the last one chalk
  const pts = [];
  for (let n = 0; n < 200 && pts.length < 5; n++) {
    const outside = pts.length >= 3;
    const a = rnd() * 2 * Math.PI, r = (outside ? 1.1 + rnd() * 0.5 : rnd() * 0.5) * R;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, z = zone(x, y), u = ((x - cx) * nx + (y - cy) * ny) / R;
    if (outside ? (z !== 'sea' || u > -0.6) : z !== 'water') continue;
    const gz = ground(x, y);
    if (W - gz < 30) continue;
    if (hd && Math.hypot(x - hd.x, y - hd.y) < 420) continue;
    if (pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 170)) continue;
    pts.push([x, y, gz]);
  }
  pts.forEach(([x, y, gz], n) => {
    const chalk = n === pts.length - 1, big = n === 0 ? 1.3 : 0.75 + rnd() * 0.5;
    const hs = (W - gz) + (240 + rnd() * 240) * big, r0 = (chalk ? 80 : 50 + rnd() * 26) * Math.sqrt(big), rt = chalk ? 40 : 10 + rnd() * 10;
    const la = rnd() * 2 * Math.PI, ll = rnd() * 0.1 * hs;
    spire(x, y, gz, hs, r0, rt, Math.cos(la) * ll, Math.sin(la) * ll, seed * 17 + n, chalk ? -2 : -1);
    stats.stacks++;
    if (!chalk && n < 3 && rnd() < 0.5 && rt > 13) trees.push({ kind: 'pine', x: x + Math.cos(la) * ll, y: y + Math.sin(la) * ll, z: gz + hs - 20, seed: seed * 31 + n, size: 0.4 + rnd() * 0.12 });
    // moss cushions round its foot (the moss climbs from here)
    for (let m = 0; m < 5; m++) {
      const a = rnd() * 2 * Math.PI, d = r0 + 4 + rnd() * 26, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (zone(px, py) !== 'water' && zone(px, py) !== 'sea') continue;
      blob(px, py, ground(px, py), 22 + rnd() * 22, 14 + rnd() * 12, seed + n * 7 + m, (i, j, k) => [4, 5, 7, 4][Math.floor(hash3(i, j, k, seed) * 4)]);
      stats.cushions++;
    }
  });
  // ---- a smooth coral-pink arch standing on the beach (Peach Beach)
  for (let n = 0; n < 80 && !stats.coral; n++) {
    const a = rnd() * 2 * Math.PI, r = (0.66 + rnd() * 0.18) * R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const dx = -Math.sin(a), dy = Math.cos(a), span = 90; // along the beach
    const pA = [x - dx * span, y - dy * span], pB = [x + dx * span, y + dy * span];
    if (zone(x, y) !== 'beach' || zone(...pA) !== 'beach' || zone(...pB) !== 'beach') continue;
    if (hd && Math.hypot(x - hd.x, y - hd.y) < 450) continue;
    const g = Math.min(ground(...pA), ground(...pB)), arc = [];
    for (let s = 0; s <= 40; s++) { const th = (s / 40) * Math.PI; arc.push([x - Math.cos(th) * dx * span, y - Math.cos(th) * dy * span, g - 10 + Math.sin(th) * 170]); }
    chain(arc, 24, seed + 71, 18, 0.12);
    stats.coral = 1;
  }
  // ---- seabed moss cushions in the deep water
  for (let n = 0; n < 80 && stats.cushions < 40; n++) {
    const a = rnd() * 2 * Math.PI, r = rnd() * 0.6 * R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (zone(x, y) !== 'water' || W - ground(x, y) < 30) continue;
    blob(x, y, ground(x, y), 18 + rnd() * 26, 10 + rnd() * 12, seed + 300 + n, (i, j, k) => [4, 5, 6, 7, 5][Math.floor(hash3(i, j, k, seed + 1) * 5)]);
    stats.cushions++;
  }
  // ---- colour the shaped voxels: moss climbing out of the water onto clean banded stone
  for (const [key, c] of vox) {
    if (c >= 0) continue;
    const [i, j, k] = key.split(',').map(Number), z = (k + 0.5) * CV, x = (i + 0.5) * CV, y = (j + 0.5) * CV;
    const up = !vox.has(K(i, j, k + 1)), h = hash3(i, j, k, seed + 5);
    const band = Math.floor(z / 30 + noise(x / 90, y / 90, 0, seed + 9) * 1.5);
    const m5 = ((band % 5) + 5) % 5;
    const stone = c === -2 ? [15, 16, 15, 17][band & 3] : c === -3 ? [22, 0, 23, 1, 3][m5] : c === -4 ? (h < 0.5 ? 20 : 21) : [0, 1, 3, 0, 2][m5];
    let col;
    if (z < W - 15) col = noise(x / 40, y / 40, z / 40, seed + 2) > 0.66 ? 6 : h < 0.25 ? stone : h < 0.62 ? 4 : 5;
    else if (z < W + 20) col = h < 0.07 ? 9 : noise(x / 16, y / 16, z / 16, seed + 7) < 0.5 ? 7 : 8;
    else {
      // moss thins out with height: thick just above the tide, patches higher up, on ledges
      // a flat top: open above, solid all round at this level with those open above too
      const flat = up && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => vox.has(K(i + a, j + b, k)) && !vox.has(K(i + a, j + b, k + 1)));
      const p = clamp(1 - (z - W - 20) / 200, 0, 1) * (0.3 + 0.8 * noise(x / 30, y / 30, z / 30, seed + 4)) + (flat && z < W + 160 ? 0.3 : 0);
      const patch = noise(x / 22, y / 22, z / 22, seed + 8) * 0.75 + h * 0.25; // moss in patches, not speckles
      col = flat && c !== -4 && z > W + 140 ? 12 : patch < p * (c <= -3 ? 0.45 : 0.85) ? (hash3(i, j, k, seed + 6) < 0.5 ? 10 : 11) : stone;
    }
    vox.set(key, col);
  }

  // ---- bricks: micro bricks from an even-unit box
  const mb = (lo, hi, color, extra = {}) => bricks.push({ asset: 'PB_DefaultMicroBrick', position: [0, 1, 2].map(a => (lo[a] + hi[a]) / 2), size: [0, 1, 2].map(a => (hi[a] - lo[a]) / 2), color, ...extra });
  const ev = v => 2 * Math.round(v / 2);
  const group = [];
  const item = (fn, loose = false) => { const n0 = bricks.length; fn(); group.push([n0, bricks.length, loose]); };
  // kelp
  for (let n = 0; n < 200 && stats.kelp < 36; n++) {
    const a = rnd() * 2 * Math.PI, r = rnd() * 0.9 * R, x = ev(cx + Math.cos(a) * r), y = ev(cy + Math.sin(a) * r);
    if (zone(x, y) !== 'water') continue;
    const g = ground(x, y);
    if (W - g < 40) continue;
    const ph = rnd() * 6, KC = [[84, 104, 44], [104, 110, 50], [70, 92, 40]][Math.floor(rnd() * 3)];
    item(() => {
      let s = 0;
      for (let z = ev(g); z + 8 <= W - 6; z += 8, s++) {
        const ox = ev(Math.sin(z / 30 + ph) * 3), oy = ev(Math.cos(z / 41 + ph) * 3);
        mb([x + ox - 2, y + oy - 2, z], [x + ox + 2, y + oy + 2, z + 8], KC, { collision: NOCOL });
        if (s % 3 === 2) { const sx = s % 6 === 2 ? 1 : -1; mb([x + ox + (sx > 0 ? 2 : -10), y + oy - 1, z + 2], [x + ox + (sx > 0 ? 10 : -2), y + oy + 1, z + 4], KC, { collision: NOCOL }); }
      }
    }, true);
    stats.kelp++;
  }
  // beach clutter
  const beachPt = () => { for (let n = 0; n < 40; n++) { const a = rnd() * 2 * Math.PI, r = (0.58 + rnd() * 0.4) * R, x = ev(cx + Math.cos(a) * r), y = ev(cy + Math.sin(a) * r); if (zone(x, y) === 'beach') return [x, y, ev(ground(x, y))]; } return null; };
  for (let n = 0; n < 5; n++) {
    const p = beachPt(); if (!p) continue; const [x, y, z] = p, L = ev(30 + rnd() * 30), alongX = rnd() < 0.5, DW = [[176, 160, 136], [150, 126, 96], [190, 176, 150]][n % 3];
    item(() => {
      if (alongX) { mb([x - L, y - 4, z], [x + L, y + 4, z + 8], DW); mb([x + L / 2, y + 4, z + 2], [x + L / 2 + 4, y + 20, z + 6], DW); }
      else { mb([x - 4, y - L, z], [x + 4, y + L, z + 8], DW); mb([x + 4, y - L / 2, z + 2], [x + 20, y - L / 2 + 4, z + 6], DW); }
    });
    stats.drift++;
  }
  for (let n = 0; n < 24; n++) {
    const p = beachPt(); if (!p) continue; const [x, y, z] = p;
    item(() => mb([x - 2, y - 2, z], [x + 2, y + 2, z + 2], [[230, 180, 170], [236, 224, 200], [210, 150, 130], [240, 236, 226]][n % 4]));
    stats.shells++;
  }
  for (let n = 0; n < 9; n++) {
    const p = beachPt(); if (!p) continue; const [x, y, z] = p, C = [[232, 120, 52], [210, 80, 60], [236, 160, 70]][n % 3];
    item(() => { mb([x - 8, y - 2, z], [x + 8, y + 2, z + 2], C); mb([x - 2, y - 8, z], [x + 2, y - 2, z + 2], C); mb([x - 2, y + 2, z], [x + 2, y + 8, z + 2], C); });
    stats.starfish++;
  }
  for (let n = 0; n < 5; n++) {
    const p = beachPt(); if (!p) continue; const [x, y, z] = p, RED = [196, 64, 40];
    item(() => { mb([x - 4, y - 3, z], [x + 4, y + 3, z + 4], RED); mb([x - 8, y + 1, z], [x - 4, y + 5, z + 2], RED); mb([x + 4, y + 1, z], [x + 8, y + 5, z + 2], RED); mb([x - 2, y + 3, z + 4], [x, y + 5, z + 6], [24, 20, 20]); mb([x, y + 3, z + 4], [x + 2, y + 5, z + 6], [24, 20, 20]); });
    stats.crabs++;
  }
  // a beached rowboat, along the shore
  {
    const p = beachPt();
    if (p) {
      const [x, y, z] = p, WD = [[120, 84, 54], [104, 72, 46]], ax = Math.abs(tx) > Math.abs(ty);
      const box = (u0, v0, w0, u1, v1, w1, c) => ax ? mb([x + u0, y + v0, z + w0], [x + u1, y + v1, z + w1], c) : mb([x + v0, y + u0, z + w0], [x + v1, y + u1, z + w1], c);
      item(() => {
        box(-30, -12, 0, 30, 12, 4, WD[0]);
        for (const v of [-14, 12]) box(-30, v, 0, 30, v + 2, 14, WD[1]);
        box(-36, -10, 2, -30, 10, 12, WD[1]); box(30, -10, 2, 36, 10, 12, WD[1]);
        box(-4, -12, 8, 4, 12, 10, WD[0]);
        box(-24, 14, 12, 26, 16, 14, [150, 120, 80]);
      });
      stats.boats++;
    }
  }
  // rock pools: a ring of pebbles round a still glassy pool
  for (let n = 0; n < 2; n++) {
    const p = beachPt(); if (!p) continue; const [x, y, z] = p;
    item(() => {
      mb([x - 14, y - 14, z], [x + 14, y + 14, z + 2], [70, 128, 150], { material: 'BMC_Glass' });
      for (let m = 0; m < 8; m++) { const a = (m / 8) * 2 * Math.PI, px = ev(x + Math.cos(a) * 20), py = ev(y + Math.sin(a) * 20); mb([px - 4, py - 4, z], [px + 4, py + 4, z + 6], [[128, 124, 118], [112, 108, 104]][m & 1]); }
    });
    stats.pools++;
  }
  // tree spots: palms on the beach, mixed on the rim
  for (let n = 0; n < 7; n++) { const p = beachPt(); if (p) trees.push({ kind: 'palm', x: p[0], y: p[1], z: p[2], seed: seed * 41 + n, size: 0.75 + rnd() * 0.3 }); }
  for (let n = 0, m = 0; n < 60 && m < 7; n++) {
    const a = rnd() * 2 * Math.PI, r = (1.05 + rnd() * 0.25) * R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (zone(x, y) !== 'rim') continue;
    const roll = rnd();
    trees.push({ kind: roll < 0.45 ? 'pine' : roll < 0.8 ? 'oak' : 'cherry', x, y, z: ground(x, y), seed: seed * 43 + n, size: 0.7 + rnd() * 0.3 });
    m++;
  }
  stats.trees = trees.length;
  return { vox, colors: COVE_COLORS, bricks, groups: group, trees, stats };
}
