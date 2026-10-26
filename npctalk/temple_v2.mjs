// THE TEMPLE OF THE STASH v2 (main quest chapter 5, Raiders of the Lost Stash). Owner 2026-10-18:
// "Central grand stepped staircase / Exposed ancient red and ochre clay brickwork / Weathered,
// eroded mortar joints / Corbelled brick archways / Carved stone bas-reliefs depicting ancient
// symbols / Ferns rooted within brick masonry joints / trap floor tiles that shoot an arrow at you /
// spike pits and platforming". (v1, the plain mossy tiers: temple_v1.mjs)
//
// A four-tier brick ziggurat south of Green Gary's hammock with a grand staircase up the north
// face (cheek walls) to a shrine on the summit:
//  - every face is real coursework: 18x8 clay bricks (reds + ochres) in running bond over a mortar
//    backing; joints 2 wide; weathering = some bricks recessed, chipped short or missing
//  - corbelled arches: the shrine door (courses step in 4 a course until they meet) and blind
//    corbelled niches on the tiers and shrine walls
//  - carved sandstone bas-relief panels with raised pixel symbols (sun, eye, serpent, frog,
//    spiral, the vice grip) on the tiers and inside
//  - ferns (green micro fronds) sprouting out of mortar joints
//  - inside: an ARROW CORRIDOR (trap floor tiles = player zones; standing on one switches on the
//    dart spawners in that row's walls: Projectile_Bow_Charged across the corridor; verified in
//    the sky with npctalk/traptest.mjs), a SPIKE PIT (PB_Spike + Component_Damage) crossed on
//    three pillars (steps out at the east end), and the pedestal with THE STASH (E on it =
//    event:quest:stash -> the quests plugin)
// Output: a brs-js 4 prefab (wires) temple.brz + temple_clear.json (bushes/decor inside the
// footprint, then Prefab.Load "temple" CX CY ZOFF 0 16) + temple_preview.json (isoview).
//   node npctalk/temple.mjs <brs-js 4 dist.mjs> <map out dir> <live region json> <outDir>
// Owner "Stash Temple" ea32a1c0-0000-4b0b-9a11-0000000057a5 (clear: br.Bricks.Clear <id> 1).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { makeBuilder, FIXED } from '../mapgen/builder.mjs';
import { worldBox } from '../mapgen/orient.mjs';
import { buildRocks } from '../mapgen/rocks.mjs';
import { plaque, EXTERNAL_ASSETS } from '../mapgen/ruins.mjs';
const [dist, mapDir, liveFile, outDir] = process.argv.slice(2);
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
const COMP = lib.brdb.COMPONENTS;
const OWNER = { id: 'ea32a1c0-0000-4b0b-9a11-0000000057a5', name: 'Stash Temple', display_name: 'Stash Temple' };
const CX = 2200, CY = 5730, ZOFF = 200;   // prefab origin (world) = load point
const X = u => CX + u, Y = v => CY + v;

// ---------------------------------------------------------------- terrain + live obstacles
const AREA = [X(-260), Y(-230), X(260), Y(380)];
const hit = ([lo, hi]) => lo[0] < AREA[2] && hi[0] > AREA[0] && lo[1] < AREA[3] && hi[1] > AREA[1];
const FOOT = (x, y) => (x > X(-232) && x < X(232) && y > Y(-202) && y < Y(202)) || (x > X(-64) && x < X(64) && y > Y(110) && y < Y(340));
const obstacles = [], CLEAR = [];
for (const f of readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(readFileSync(`${mapDir}/${f}`)).ops) for (const b of op.bricks ?? []) {
    const bx = worldBox(b, FIXED);
    if (!hit(bx)) continue;
    if (!b.size?.[0] && FOOT(b.position[0], b.position[1])) { CLEAR.push(bx); continue; } // small decor in the footprint
    obstacles.push(bx);
  }
const live = JSON.parse(readFileSync(liveFile)).bricks.filter(b => b.position);
const bushes = live.filter(b => b.asset === 'B_Bush' && FOOT(b.position[0], b.position[1])).map(b => b.position);
for (const b of live) {
  if (bushes.some(p => Math.hypot(p[0] - b.position[0], p[1] - b.position[1]) < 4)) continue;
  const bx = worldBox({ ...b, size: b.size?.[0] ? b.size : FIXED[b.asset] ?? [20, 20, 20] }, FIXED);
  if (hit(bx)) obstacles.push(bx);
}
const B = makeBuilder();
for (const [lo, hi] of obstacles) B.add({ asset: 'PB_DefaultBrick', size: hi.map((v, i) => (v - lo[i]) / 2), position: hi.map((v, i) => (v + lo[i]) / 2), obstacle: true }, 'terrain');
const nObst = B.bricks.length;
const groundTop = (x0, y0, x1, y1, below = 1e9) => {
  let top = 200;
  for (const [lo, hi] of obstacles) if (lo[0] < x1 && hi[0] > x0 && lo[1] < y1 && hi[1] > y0 && lo[2] < below) top = Math.max(top, hi[2]);
  return top + (top % 2 + 2) % 2;
};

// ---------------------------------------------------------------- palette
const hash = (...a) => { let h = 0x2545f491; for (const v of a) { h = Math.imul(h ^ (v | 0), 2654435761); h ^= h >>> 15; } return (h >>> 0) / 4294967296; };
const CLAY = [[152, 62, 42], [168, 76, 48], [136, 54, 38], [180, 92, 56], [198, 140, 66], [184, 124, 58], [164, 104, 50], [120, 70, 48]];
const MORTAR = [176, 160, 128], SAND = [[198, 178, 138], [186, 166, 126], [206, 188, 148]], DARK = [58, 34, 26];
const FERN = [[64, 120, 46], [52, 104, 38], [82, 138, 56]];
const clay = (...k) => ({ color: CLAY[Math.floor(hash(...k) * CLAY.length)], asset: 'PB_DefaultMicroBrick' });
const sand = (...k) => ({ color: SAND[Math.floor(hash(...k, 3) * SAND.length)], asset: 'PB_DefaultMicroBrick' });
const mortar = { color: MORTAR, asset: 'PB_DefaultMicroBrick' };
const box = (x0, y0, z0, x1, y1, z1, m, label) => (x1 > x0 && y1 > y0 && z1 > z0) && B.box(x0, y0, z0, x1, y1, z1, m, label);
const ubox = (u0, v0, z0, u1, v1, z1, m, label) => box(X(Math.min(u0, u1)), Y(Math.min(v0, v1)), z0, X(Math.max(u0, u1)), Y(Math.max(v0, v1)), z1, m, label);

// ---------------------------------------------------------------- coursework
// face(axis, at, a0, a1, zb, zt, dir): a brick face on the plane u=at (axis 'u') or v=at, running
// a0..a1 along the other axis, outward normal `dir` (+1/-1). Face bricks fill at..at-4*dir,
// mortar backing at-4*dir..at-8*dir. skip(a, z) leaves a hole (doors), dark(a, z) = niche shadow.
const JOINTS = [];
function face(axis, at, a0, a1, zb, zt, dir, { skip = () => false, dark = () => false, ground = true, key = 0 } = {}) {
  const P = (a, d) => axis === 'u' ? [at - dir * d, a] : [a, at - dir * d]; // (u, v) of a point d deep
  const put = (aa0, aa1, d0, d1, z0, z1, m, label) => { const [u0, v0] = P(aa0, d0), [u1, v1] = P(aa1, d1); return ubox(u0, v0, z0, u1, v1, z1, m, label); };
  for (let a = a0; a < a1; a += 20) { // mortar backing, 20-long columns from the ground (or zb) up
    const [p0, q0] = P(a, 4), [p1, q1] = P(Math.min(a1, a + 20), 8);
    const g = ground ? Math.max(zb, groundTop(X(Math.min(p0, p1)), Y(Math.min(q0, q1)), X(Math.max(p0, p1)), Y(Math.max(q0, q1)), zt)) : zb;
    for (let z = g; z < zt; z += 10) if (!skip(a + 10, z + 5) && !skip(a + 2, z + 5) && !skip(a + 18, z + 5)) put(a, Math.min(a1, a + 20), 4, 8, z, Math.min(zt, z + 10), mortar, 'backing');
  }
  for (let z = zb, c = 0; z < zt; z += 10, c++) {
    const off = (c % 2) * 10;
    for (let a = a0 - off; a < a1; a += 20) {
      const s = Math.max(a0, a) + 1, e = Math.min(a1, a + 20) - 1, mid = (s + e) / 2;
      if (e - s < 4 || skip(mid, z + 5) || skip(s + 1, z + 5) || skip(e - 1, z + 5)) continue;
      const r = hash(key, axis === 'u' ? 1 : 2, at, a, z);
      const zt1 = Math.min(zt, z + 8);
      if (zt1 - z < 2) continue;
      if (dark(mid, z + 5)) { put(s - 1, e + 1, 0, 4, z, Math.min(zt, z + 10), { color: DARK, asset: 'PB_DefaultMicroBrick' }, 'niche'); continue; }
      if (r < 0.04) continue;                                   // missing brick: the backing shows
      const d0 = r < 0.16 ? 2 : 0;                              // recessed (eroded) brick
      const chip = r > 0.9 ? 2 : 0;                             // chipped short
      if (put(s + chip, e - (r > 0.95 ? 2 : 0), d0, 4, z, zt1, clay(key, at, a, z), 'brick')) JOINTS.push({ axis, at, dir, a: e + 1, z: z + 9 });
    }
  }
}
// faces round [u0,u1]x[v0,v1] (outward); the u-planes are shortened by 8 so corners don't double up
function ring(u0, v0, u1, v1, zb, zt, o = {}) {
  face('v', v1, u0, u1, zb, zt, +1, { ground: o.ground, skip: o.skipN, dark: o.darkN, key: 1 });
  face('v', v0, u0, u1, zb, zt, -1, { ground: o.ground, dark: o.darkS, key: 2 });
  face('u', u1, v0 + 8, v1 - 8, zb, zt, +1, { ground: o.ground, dark: o.darkE, key: 3 });
  face('u', u0, v0 + 8, v1 - 8, zb, zt, -1, { ground: o.ground, dark: o.darkW, key: 4 });
}
// corbelled opening: width w at the bottom from z0; from zs up the sides step in 4 a course
const corbel = (c, w, z0, zs) => (a, z) => { if (z < z0) return false; const half = w / 2 - (z >= zs ? (Math.floor((z - zs) / 10) + 1) * 4 : 0); return half > 0 && Math.abs(a - c) < half; };

// ---------------------------------------------------------------- the ziggurat
const TIERS = [[230, 200, 340], [200, 170, 380], [170, 140, 420], [140, 110, 460]]; // half u, half v, top
const STAIR_W = 50, CHEEK = 12, STAIR_TOP_V = 110, RISE = 10, TREAD = 14;
const inStairs = (u, v) => Math.abs(u) < STAIR_W + CHEEK && v > STAIR_TOP_V - 2;
const PIT = { u0: -118, u1: 118, v0: -40, v1: 40, bottom: 400 };
const CARVE = { u0: PIT.u0 - 8, u1: PIT.u1, v0: PIT.v0 - 8, v1: PIT.v1 + 8 }; // the pit + its faced walls
const inCarve = (u, v) => u >= CARVE.u0 && u < CARVE.u1 && v >= CARVE.v0 && v < CARVE.v1;
// cores: one global 20 grid, split at the stair / pit edges, inset 8 from each tier edge
const cuts = (lo, hi, extra) => [...new Set([lo, hi, ...extra.filter(c => c > lo && c < hi), ...Array.from({ length: 40 }, (_, k) => -400 + k * 20).filter(c => c > lo && c < hi)])].sort((a, b) => a - b);
TIERS.forEach(([hu, hv, top], i) => {
  const below = i ? TIERS[i - 1][2] : 0, next = TIERS[i + 1];
  const us = cuts(-hu + 8, hu - 8, [CARVE.u0, CARVE.u1, -STAIR_W - CHEEK, STAIR_W + CHEEK]), vs = cuts(-hv + 8, hv - 8, [CARVE.v0, CARVE.v1, STAIR_TOP_V - 2]);
  for (let a = 0; a < us.length - 1; a++) for (let b = 0; b < vs.length - 1; b++) {
    const u = us[a], u1 = us[a + 1], v = vs[b], v1 = vs[b + 1], mu = (u + u1) / 2, mv = (v + v1) / 2;
    if (inStairs(mu, mv)) continue;
    const covered = next && u >= -next[0] + 8 && u1 <= next[0] - 8 && v >= -next[1] + 8 && v1 <= next[1] - 8;
    const z0 = i ? below : groundTop(X(u), Y(v), X(u1), Y(v1), top);
    const zTop = inCarve(mu, mv) ? Math.min(top, PIT.bottom) : top;
    if (zTop > z0) ubox(u, v, z0, u1, v1, zTop, covered ? { color: [150, 120, 90] } : { color: SAND[Math.floor(hash(u, v, i) * 3)].map(c => c - 22) }, 'core');
  }
});
TIERS.forEach(([hu, hv, top], i) => {
  const zb = i ? TIERS[i - 1][2] : 240;
  const centres = len => { const n = []; for (let c = -len + 60; c <= len - 60; c += 80) n.push(c); return n; };
  const niche = len => (a, z) => i < 3 && z < top - 4 && centres(len).some(c => corbel(c, 24, zb + 6, top - 22)(a, z));
  const skipN = a => Math.abs(a) < STAIR_W + CHEEK + 8;
  ring(-hu, -hv, hu, hv, zb, top, { ground: true, skipN, darkS: niche(hu), darkE: niche(hv), darkW: niche(hv), darkN: (a, z) => !skipN(a) && Math.abs(a) > 110 && niche(hu)(a, z) });
});

// ---------------------------------------------------------------- grand staircase + cheek walls
for (let s = 0; s < 40; s++) {
  const top = TIERS[3][2] - s * RISE, v0 = STAIR_TOP_V + s * TREAD, v1 = v0 + TREAD;
  if (top <= 240) break;
  let any = false;
  for (let u = -STAIR_W; u < STAIR_W; u += 20) {
    const u1 = Math.min(STAIR_W, u + 20), g = groundTop(X(u), Y(v0), X(u1), Y(v1), top);
    if (g >= top - 2) continue;
    any = true;
    ubox(u, v0, g, u1, v1, top - 2, { color: [150, 120, 90] }, 'stair');
    ubox(u, v0, top - 2, u1, v1, top, sand(u, s), 'tread');
  }
  for (const [c0, c1] of [[-STAIR_W - CHEEK, -STAIR_W], [STAIR_W, STAIR_W + CHEEK]]) {
    const ct = top + 12, g = groundTop(X(c0), Y(v0), X(c1), Y(v1), ct);
    if (g < ct - 4) { ubox(c0, v0, g, c1, v1, ct - 4, clay(c0, s, 9), 'cheek'); ubox(c0, v0, ct - 4, c1, v1, ct, sand(c0, s), 'cheekcap'); }
  }
  if (!any) break;
}

// ---------------------------------------------------------------- the shrine on the summit
const S = { u0: -130, u1: 130, v0: -100, v1: 100, zb: 460, zt: 580, t: 12 };
const DOOR = corbel(0, 44, S.zb, S.zb + 50);
const sn = len => (a, z) => z < S.zb + 90 && [-len + 50, len - 50].some(c => corbel(c, 20, S.zb + 20, S.zb + 60)(a, z));
ring(S.u0, S.v0, S.u1, S.v1, S.zb, S.zt, { ground: false, skipN: (a, z) => DOOR(a, z), darkS: sn(130), darkE: sn(100), darkW: sn(100), darkN: (a, z) => Math.abs(a) > 60 && sn(130)(a, z) });
const I = { u0: S.u0 + S.t, u1: S.u1 - S.t, v0: S.v0 + S.t, v1: S.v1 - S.t };
// wall cores: the 4-unit band between the outer backing (8 deep) and the inner face backing (8 deep): 12 thick walls = 4 face + 4 backing ... + 4 face
// (outer face 0..4, outer backing 4..8, inner backing 8..12 of the inner face from the other side: the faces meet, no extra core needed)
face('v', I.v1, I.u0, I.u1, S.zb, S.zt, -1, { ground: false, skip: (a, z) => DOOR(a, z), key: 5 });
face('v', I.v0, I.u0, I.u1, S.zb, S.zt, +1, { ground: false, key: 6 });
face('u', I.u1, I.v0 + 8, I.v1 - 8, S.zb, S.zt, -1, { ground: false, key: 7 });
face('u', I.u0, I.v0 + 8, I.v1 - 8, S.zb, S.zt, +1, { ground: false, key: 8 });
// the four wall corners (the faces leave 12x12 posts there)
ubox(S.u0, S.v0, S.zt, S.u1, S.v1, S.zt + 4, { color: [150, 120, 90], asset: 'PB_DefaultTile' }, 'ceiling');
[[120, 90], [100, 70], [80, 50]].forEach(([hu, hv], k) => { for (let u = -hu; u < hu; u += 40) for (let v = -hv; v < hv; v += 40) ubox(u, v, S.zt + 4 + k * 10, Math.min(hu, u + 40), Math.min(hv, v + 40), S.zt + 14 + k * 10, clay(u, v, k, 7), 'roof'); });
for (let u = -60; u < 60; u += 12) for (let z = S.zt + 34; z < S.zt + 94; z += 10) if ((Math.floor((u + 60) / 12) + Math.floor(z / 10)) % 3) ubox(u, -6, z, u + 10, 6, z + 8, clay(u, z, 77), 'comb');
for (const b of buildRocks([{ c: [X(0), Y(60), S.zt + 64], r: [34, 32, 30], seed: 57 }], { seed: 57, moss: 0.3, allow: (x, y, z) => B.free([x, y, z], [x + 10, y + 10, z + 10]) })) B.add(b, 'boulder');

// ---------------------------------------------------------------- inside: arrow corridor, spike pit, pedestal
const FL = S.zb;
const COR = { u0: -40, u1: 40, v0: PIT.v1, v1: I.v1 };
for (const [at, dir] of [[COR.u0, +1], [COR.u1, -1]]) { // corridor walls: 10 thick, faced on the corridor side
  const back = at - dir * 10;
  ubox(Math.min(at - dir * 8, back), COR.v0, FL, Math.max(at - dir * 8, back), COR.v1, FL + 90, clay(at, 66), 'corwall');
  face('u', at, COR.v0, COR.v1, FL, FL + 90, dir, { ground: false, key: 10 + dir });
}
// trap floor: 2 rows x 4 tiles, two traps a row (they look like every other tile)
const ROWS = [COR.v1 - 22, COR.v0 + 2];
ROWS.forEach((rv, r) => {
  for (let k = 0; k < 4; k++) {
    const u = COR.u0 + k * 20, isTrap = r ? (k === 0 || k === 2) : (k === 1 || k === 3);
    ubox(u + 1, rv + 1, FL, u + 19, rv + 19, FL + 2, { color: SAND[(k + r) % 3], asset: 'PB_DefaultMicroBrick', ...(isTrap ? { trap: r } : {}) }, isTrap ? 'traptile' : 'tile');
  }
});
ROWS.forEach((rv, r) => { for (const [u0, u1, dir] of [[COR.u0, COR.u0 + 4, 0], [COR.u1 - 4, COR.u1, 1]]) ubox(u0, rv + 8, FL + 30, u1, rv + 12, FL + 34, { color: [24, 20, 18], asset: 'PB_DefaultMicroBrick', dart: { r, dir } }, 'dart'); });
// spike pit: spikes on the bottom, three pillars to jump across, steps out at the east end
const PILLARS = [[-50, 22], [0, 0], [50, -22]];
const nearPillar = (u, v) => PILLARS.some(([pu, pv]) => Math.abs(u - pu) < 20 && Math.abs(v - pv) < 20);
for (const [pu, pv] of PILLARS) { ubox(pu - 12, pv - 12, PIT.bottom, pu + 12, pv + 12, FL - 2, clay(pu, pv, 31), 'pillar'); ubox(pu - 14, pv - 14, FL - 2, pu + 14, pv + 14, FL + 2, sand(pu, pv), 'pillarcap'); }
const EXIT_U = 96;
for (let s = 0; s < 5; s++) ubox(EXIT_U, PIT.v1 - 16 - s * 16, PIT.bottom, PIT.u1, PIT.v1 - s * 16, FL - s * 12, sand(s, 44), 'pitstep');
for (let u = PIT.u0 + 4; u < EXIT_U - 8; u += 12) for (let v = PIT.v0 + 4; v < PIT.v1 - 8; v += 12)
  if (!nearPillar(u + 5, v + 5)) ubox(u, v, PIT.bottom, u + 10, v + 10, PIT.bottom + 10, { asset: 'PB_Spike', color: [120, 116, 110], spike: true }, 'spike');
face('v', PIT.v1, PIT.u0, PIT.u1, PIT.bottom, FL, -1, { ground: false, key: 12 });
face('v', PIT.v0, PIT.u0, PIT.u1, PIT.bottom, FL, +1, { ground: false, key: 13 });
face('u', PIT.u0, PIT.v0 + 8, PIT.v1 - 8, PIT.bottom, FL, +1, { ground: false, key: 14 });
// far side: pedestal with THE STASH, braziers
const PV = -70;
ubox(-18, PV - 18, FL, 18, PV + 18, FL + 10, clay(1, 2, 3), 'pedestal');
ubox(-12, PV - 12, FL + 10, 12, PV + 12, FL + 36, sand(0, PV), 'pedestal');
ubox(-16, PV - 16, FL + 36, 16, PV + 16, FL + 40, sand(1, PV), 'pedestal');
ubox(-8, PV - 6, FL + 40, 8, PV + 6, FL + 52, { color: [90, 220, 60], material: 'BMC_Glow', asset: 'PB_DefaultMicroBrick', stash: true }, 'stash');
ubox(-4, PV - 2, FL + 52, 4, PV + 2, FL + 58, { color: [140, 110, 70], asset: 'PB_DefaultMicroBrick' }, 'stashknot');
const fire = { color: [255, 120, 30], material: 'BMC_Glow', asset: 'PB_DefaultMicroBrick' };
for (const bu of [-70, 70]) { ubox(bu - 6, PV - 6, FL, bu + 6, PV + 6, FL + 30, clay(bu, 5), 'brazier'); ubox(bu - 8, PV - 8, FL + 30, bu + 8, PV + 8, FL + 36, fire, 'fire'); }
for (const bu of [-90, 90]) { ubox(bu - 4, COR.v1 - 14, FL, bu + 4, COR.v1 - 6, FL + 40, clay(bu, 6), 'brazier'); ubox(bu - 6, COR.v1 - 16, FL + 40, bu + 6, COR.v1 - 4, FL + 46, fire, 'fire'); }

// ---------------------------------------------------------------- bas-reliefs
const GLYPH = {
  sun: ['....##....', '.#..##..#.', '..######..', '.##....##.', '###.##.###', '###.##.###', '.##....##.', '..######..', '.#..##..#.', '....##....'],
  eye: ['..........', '...####...', '.##....##.', '#...##...#', '#..####..#', '#..####..#', '#...##...#', '.##....##.', '...####...', '..........'],
  serpent: ['......###.', '.....#.#.#', '.....####.', '....##....', '...##.....', '..##...##.', '.##...##..', '.##..##...', '..####....', '...##.....'],
  frog: ['.##....##.', '#..#..#..#', '.######...', '##########', '#.#....#.#', '##########', '.########.', '..#....#..', '.##....##.', '##......##'],
  spiral: ['########..', '#......#..', '#.####.#..', '#.#..#.#..', '#.#.##.#..', '#.#....#..', '#.######..', '#.........', '##########', '..........'],
  grip: ['.##.......', '#..#......', '#..#......', '.##.#.....', '....##....', '.....###..', '....#..##.', '...#....##', '..#......#', '..........'],
};
// a carved sandstone panel standing proud of face (axis, at, outward dir), centred at (a, z)
function relief(axis, at, dir, a, z, glyph) {
  const P = (aa, d) => axis === 'u' ? [at + dir * d, aa] : [aa, at + dir * d];
  const put = (a0, a1, d0, d1, z0, z1, m, l) => { const [u0, v0] = P(a0, d0), [u1, v1] = P(a1, d1); return ubox(u0, v0, z0, u1, v1, z1, m, l); };
  if (!put(a - 22, a + 22, 0, 2, z - 20, z + 20, sand(a, z, at), 'panel')) return;
  const g = GLYPH[glyph], flip = (axis === 'v') === (dir > 0); // read left to right from outside (left-handed world)
  g.forEach((row, ry) => {
    let run = -1;
    for (let k = 0; k <= 10; k++) {
      const on = k < 10 && row[flip ? 9 - k : k] === '#';
      if (on && run < 0) run = k;
      if (!on && run >= 0) { put(a - 20 + run * 4, a - 20 + k * 4, 2, 4, z + 16 - ry * 4, z + 20 - ry * 4, { color: [160, 140, 102], asset: 'PB_DefaultMicroBrick' }, 'glyph'); run = -1; }
    }
  });
}
const G = Object.keys(GLYPH);
TIERS.slice(0, 3).forEach(([hu, hv, top], i) => {
  const zb = i ? TIERS[i - 1][2] : 296, zc = (zb + top) / 2 - (i ? 0 : 4);
  relief('u', hu, +1, 20, zc, G[(i * 2) % 6]); relief('u', -hu, -1, -20, zc, G[(i * 2 + 1) % 6]);
  relief('v', -hv, -1, 20, zc, G[(i + 4) % 6]);
  relief('v', hv, +1, -86 - i * 6, zc, G[(i + 2) % 6]); relief('v', hv, +1, 86 + i * 6, zc, G[(i + 3) % 6]);
});
relief('v', S.v1, +1, -40, S.zb + 54, 'grip'); relief('v', S.v1, +1, 40, S.zb + 54, 'eye');
[-90, -30, 30, 90].forEach((a, k) => relief('v', I.v0, +1, a, S.zb + 70, ['grip', 'sun', 'frog', 'grip'][k]));

plaque({ put: (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'plaque'), text: 'TEMPLE OF THE STASH\nNO STEALING. SIGNED, GARY\nP.S. THE BOULDER IS DECORATIVE',
  facing: [0, 1], x: X(96), y: Y(S.v1) + 1, z: S.zb + 30, w: 24, h: 14, color: [96, 76, 52], style: { LineHeight: 1.6 } });
// ---------------------------------------------------------------- ferns in the joints
let ferns = 0;
const NOCOLL = { player: false, weapon: false, interaction: false, tool: true, physics: false };
for (const j of JOINTS) {
  if (ferns >= 90 || hash(j.at, j.a, j.z, 5) > 0.03) continue;
  const P = (a, d) => j.axis === 'u' ? [j.at + j.dir * d, a] : [a, j.at + j.dir * d];
  const pc = (a0, a1, d0, d1, z0, z1, k) => { const [u0, v0] = P(a0, d0), [u1, v1] = P(a1, d1); return ubox(u0, v0, z0, u1, v1, z1, { color: FERN[k % 3], asset: 'PB_DefaultMicroBrick', collision: NOCOLL }, 'fern'); };
  if (!pc(j.a - 2, j.a + 2, 0, 4, j.z - 2, j.z + 2, 0)) continue;
  ferns++;
  for (const s of [-1, 1]) for (let k = 1; k <= 4; k++) { const dz = k < 3 ? k * 2 : 6 - (k - 3) * 2; pc(j.a + s * (k * 3) - 1, j.a + s * (k * 3) + 1, k * 2, 2 + k * 2, j.z + dz, j.z + dz + 2, k); }
  pc(j.a - 1, j.a + 1, 2, 6, j.z + 2, j.z + 10, 2);
}

// ---------------------------------------------------------------- plaque + Gary's hammock
for (const hx of [-70, 70]) { const g = groundTop(X(hx - 5), 6185, X(hx + 5), 6195, 360); box(X(hx - 5), 6185, g, X(hx + 5), 6195, 352, { color: [96, 70, 44] }, 'post'); }
for (const [x0, x1, z] of [[-64, -30, 330], [-30, 30, 322], [30, 64, 330]]) box(X(x0), 6180, z, X(x1), 6200, z + 2, { color: [150, 120, 70], asset: 'PB_DefaultMicroBrick' }, 'hammock');

// ---------------------------------------------------------------- write the prefab (+ wires)
const dropped = B.dropped.filter(d => !d.startsWith('terrain'));
const byLabel = {}; for (const d of dropped) { const l = d.split(' ')[0]; byLabel[l] = (byLabel[l] ?? 0) + 1; }
const mine = B.bricks.slice(nObst);
console.error(`${mine.length} temple bricks; dropped ${JSON.stringify(byLabel)}; ferns ${ferns}; traps ${mine.filter(b => b.trap !== undefined).length}; darts ${mine.filter(b => b.dart).length}; spikes ${mine.filter(b => b.spike).length}; clear ${CLEAR.length} decor + ${bushes.length} bushes`);
if (process.env.TEMPLE_DEBUG) for (const d of dropped) if (new RegExp(process.env.TEMPLE_DEBUG).test(d)) console.error(d.slice(0, 220));

const EXT = [...EXTERNAL_ASSETS, { type: 'BRWeaponProjectile', name: 'Projectile_Bow_Charged' }];
const PROJ = EXT.length - 1;
const w = new lib.World();
const o = w.addOwner(OWNER);
const zones = [], spawners = [];
for (const brick of mine) {
  const { label, obstacle, trap, dart, spike, stash, ...b } = brick;
  const comps = [...(b.components ?? [])];
  if (spike) comps.push({ type: COMP.Damage.NAME, data: { Damage: 20, RepeatDelay: 0.5, Message: '', ConsoleTag: '' } });
  if (trap !== undefined) comps.push({ type: COMP.AttachedZone.NAME, data: { ZoneStartDistance: 0, ZoneEndDistance: 40, bIsBuildingZone: false, bIsLooseZone: false, bIsShareZone: false, bWater: false,
    bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true, bDetectEntities: false, bDetectProjectiles: false, TagFilter: '', ZoneWindForce: 0 } });
  if (dart) comps.push({ type: COMP.ProjectileSpawner.NAME, data: { ProjectileClass: PROJ, FireSound: null, Direction: dart.dir, SpawnLocation: 0, SpawnMargin: 5, SpawnOffsetBias: 0, bEnabled: false,
    NumberOfShots: 1, SpreadConeAngle: 2, bSpreadBiasedTowardsCenter: true, FireRate: 2, bEnforceFireRate: true, DamageMultiplier: 0.35, SpeedMultiplier: 1, ScaleMultiplier: 1 } });
  if (stash) comps.push({ type: 'Component_Interact', data: { InteractSound: null, Message: '', ConsoleTag: 'event:quest:stash', bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Grab THE STASH' } });
  const h = w.addBrick({ ...b, position: [b.position[0] - CX, b.position[1] - CY, b.position[2] - ZOFF], owner_index: o, components: comps });
  if (trap !== undefined) zones.push({ r: trap, h, c: COMP.AttachedZone });
  if (dart) spawners.push({ r: dart.r, h, c: COMP.ProjectileSpawner });
}
// per row: the two trap tiles OR'd -> both darts of that row (hidden gates floating over the roof comb)
let gi = 0;
const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [-60 + (gi++) * 20, 0, S.zt + 160 - ZOFF], color: [200, 200, 200], owner_index: o, visibility: false, collision: NOCOLL, components: [{ type: c.NAME, data }] }), c });
const wire = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
for (const r of [0, 1]) {
  const zs = zones.filter(z => z.r === r), ds = spawners.filter(d => d.r === r);
  if (!zs.length || !ds.length) continue;
  let src = [zs[0], 'bOccupied'];
  for (const z of zs.slice(1)) { const or = gate(COMP.Expr_LogicalOR); wire(...src, or, 'bInputA'); wire(z, 'bOccupied', or, 'bInputB'); src = [or, 'bOutput']; }
  for (const d of ds) wire(...src, d, 'bEnabled');
}
w.makePrefab({});
writeFileSync(`${outDir}/temple.brz`, w.toBrz({ bundle: { description: 'Temple of the Stash' }, externalAssets: EXT }));
const clearOps = [
  ...CLEAR.map(([lo, hi]) => `br.World.ClearRegion ${(lo[0] + hi[0]) / 2} ${(lo[1] + hi[1]) / 2} ${(lo[2] + hi[2]) / 2} ${(hi[0] - lo[0]) / 2 + 1} ${(hi[1] - lo[1]) / 2 + 1} ${(hi[2] - lo[2]) / 2 + 1}`),
  ...bushes.map(([x, y, z]) => `br.World.ClearRegion ${x} ${y} ${z + 10} 16 16 34`),
];
writeFileSync(`${outDir}/temple_clear.json`, JSON.stringify({ ops: [...clearOps.map(line => ({ op: 'cmd', line, captureMs: 400 })),
  { op: 'cmd', line: `br.Prefab.Load "temple" ${CX} ${CY} ${ZOFF} 0 16`, captureMs: 4000 }] }));
writeFileSync(`${outDir}/temple_preview.json`, JSON.stringify([
  ...B.bricks.slice(0, nObst).map(({ obstacle, label, ...b }) => ({ ...b, color: [74, 70, 62] })),
  ...mine.map(({ label, obstacle, trap, dart, spike, stash, ...b }) => b)]));
