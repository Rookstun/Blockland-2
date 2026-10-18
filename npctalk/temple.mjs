// THE TEMPLE OF THE STASH v3 (main quest chapter 5, Raiders of the Lost Stash). Owner 2026-10-18,
// first: "Central grand stepped staircase / Exposed ancient red and ochre clay brickwork /
// Weathered, eroded mortar joints / Corbelled brick archways / Carved stone bas-reliefs depicting
// ancient symbols / Ferns rooted within brick masonry joints / trap floor tiles that shoot an arrow
// at you / spike pits and platforming"; then on v2 in game: "pit way too small. use micro bricks
// instead of regular bricks, tile block placed upside down, several rooms, players can jump 30
// studs long 9 blocks tall and are 4 blocks tall exactly" (= player 48 high, jump 300 long, 108
// high). v1 = temple_v1.mjs (mossy tiers), v2 = temple_v2.mjs (small ziggurat, one shrine room).
//
// A five-tier brick ziggurat (920 x 900, summit z 1000) south of the swamp, everything micro
// bricks (no studded tops, no tiles):
//  - GRAND STAIRCASE, 200 wide with cheek walls, up the north face to a summit shrine (blind
//    corbelled door, stepped roof, roof comb, the boulder)
//  - a side stair to the first ledge and a corbelled PORTAL into the second tier
//  - ARROW GALLERY (80 wide, 140 high, 440 long): 8 rows of floor tiles, two traps a row; standing
//    on one switches on that row's dart spawners in both walls (zone bOccupied -> OR ->
//    Component_ProjectileSpawner bEnabled, Projectile_Bow_Charged; mechanism verified in the sky
//    with npctalk/traptest.mjs)
//  - GLYPH ANTECHAMBER with a corbelled vault, carved panels, braziers
//  - PIT HALL: spike pit 240 x 330, 120 deep (deeper than a jump), four pillars at rising and
//    falling heights (gaps 80-110, rises up to 50), steps out along the west wall
//  - SANCTUM behind a corbelled door: the pedestal with THE STASH (E = event:quest:stash) and an
//    EXIT TUNNEL out of the east face (the escape)
//  - all faces: 18x8 clay bricks (reds + ochres) in running bond over mortar; eroded joints
//    (recessed / chipped / missing bricks), blind corbelled niches, sandstone bas-reliefs with
//    raised glyphs, ferns sprouting from joints
// Output (outDir): temple.brz (brs-js 4 prefab with wires), temple_clear<k>.json (jobs clearing the
// trees / bushes / decor in the footprint, paced), temple_load.json (Prefab.Load), temple_preview.json.
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
const CX = 2400, CY = 5250, ZOFF = 200;   // prefab origin (world) = load point
const X = u => CX + u, Y = v => CY + v;
const GROUND_MAX = 366;                    // terrain tops here stay under this; anything above is trees/props

// ---------------------------------------------------------------- layout (u east, v north, z world)
const TIERS = [[460, 450, 520], [390, 380, 680], [320, 310, 820], [240, 230, 920], [160, 150, 1000]]; // half u, half v, top
const F = 520;                             // interior floor (= first ledge)
const STAIR = { w: 100, cheek: 16, top: TIERS[4][2], v0: TIERS[4][1], rise: 10, tread: 10 };
const SIDE = { u0: -300, u1: -180, v0: TIERS[0][1] };  // side stair up to the first ledge
const ROOMS = {
  G: { u0: -280, u1: -200, v0: -60, v1: 380, z0: F, z1: F + 140 },          // arrow gallery (opens in the T2 north face)
  A: { u0: -300, u1: -60, v0: -270, v1: -60, z0: F, z1: F + 260 },          // glyph antechamber
  P: { u0: -40, u1: 200, v0: -270, v1: 130, z0: F, z1: 800 },               // pit hall
  Pit: { u0: -40, u1: 200, v0: -230, v1: 100, z0: 400, z1: F },             // the pit itself
  S: { u0: -40, u1: 200, v0: 150, v1: 280, z0: F, z1: 780 },                // sanctum
  E: { u0: 200, u1: 390, v0: 200, v1: 260, z0: F, z1: F + 120 },            // exit tunnel (opens in the T2 east face)
};
const DOORS = [
  { u0: -60, u1: -40, v0: -250, v1: -190, z0: F, z1: F + 120 },             // A -> P
  { u0: 40, u1: 120, v0: 130, v1: 150, z0: F, z1: F + 120 },                // P -> S
];
const corbel = (c, w, z0, zs) => (a, z) => { if (z < z0) return false; const half = w / 2 - (z >= zs ? (Math.floor((z - zs) / 10) + 1) * 4 : 0); return half > 0 && Math.abs(a - c) < half; };
const inRect = (r, u, v) => u >= r.u0 && u < r.u1 && v >= r.v0 && v < r.v1;
const voids = [...Object.values(ROOMS), ...DOORS];
// rooms are carved 8 wider than their walls (face + backing go there); floors 4 lower (pavers)
const carveOf = r => ({ u0: r.u0 - 8, u1: r.u1 + 8, v0: r.v0 - 8, v1: r.v1 + 8, z0: r.z0 - 4, z1: r.z1 });

// ---------------------------------------------------------------- terrain + live obstacles, clears
const STAIR_END = STAIR.v0 + 80 * STAIR.tread;
const FOOT = (x, y) => (x > X(-470) && x < X(470) && y > Y(-460) && y < Y(460)) ||
  (x > X(-STAIR.w - STAIR.cheek - 10) && x < X(STAIR.w + STAIR.cheek + 10) && y > Y(0) && y < Y(STAIR_END)) ||
  (x > X(SIDE.u0 - 30) && x < X(SIDE.u1 + 30) && y > Y(0) && y < Y(SIDE.v0 + 300));
const AREA = [X(-500), Y(-500), X(500), Y(STAIR_END + 40)];
const hit = ([lo, hi]) => lo[0] < AREA[2] && hi[0] > AREA[0] && lo[1] < AREA[3] && hi[1] > AREA[1];
const obstacles = [], CLEAR = [];
const inFoot = ([lo, hi]) => FOOT((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2);
for (const f of readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(readFileSync(`${mapDir}/${f}`)).ops) for (const b of op.bricks ?? []) {
    const bx = worldBox(b, FIXED);
    if (!hit(bx)) continue;
    if (inFoot(bx) && (bx[1][2] > GROUND_MAX || !b.size?.[0])) { CLEAR.push(bx); continue; } // trees, props, decor
    obstacles.push(bx);
  }
const live = JSON.parse(readFileSync(liveFile)).bricks.filter(b => b.position);
const liveClear = [];
for (const b of live) {
  const bx = worldBox({ ...b, size: b.size?.[0] ? b.size : FIXED[b.asset] ?? [20, 20, 20] }, FIXED);
  if (!hit(bx)) continue;
  if (inFoot(bx) && b.asset === 'B_Bush') { liveClear.push(`br.World.ClearRegion ${b.position[0]} ${b.position[1]} ${b.position[2] + 10} 16 16 34`); continue; }
  if (inFoot(bx) && /SoundEmitter|Microchip/.test(b.asset)) continue;                  // bush parts: the bush box takes them
  if (inFoot(bx) && !/Gate|Bot_Spawn/.test(b.asset) && (b.asset === 'B_Pine_Tree' || bx[1][2] > GROUND_MAX)) continue; // cleared with the chunk props
  obstacles.push(bx);
}
const B = makeBuilder();
for (const [lo, hi] of obstacles) B.add({ asset: 'PB_DefaultBrick', size: hi.map((v, i) => (v - lo[i]) / 2), position: hi.map((v, i) => (v + lo[i]) / 2), obstacle: true }, 'terrain');
const nObst = B.bricks.length;
const groundTop = (x0, y0, x1, y1, below = 1e9) => {
  let top = 220;
  for (const [lo, hi] of obstacles) if (lo[0] < x1 && hi[0] > x0 && lo[1] < y1 && hi[1] > y0 && lo[2] < below) top = Math.max(top, hi[2]);
  return top + (top % 2 + 2) % 2;
};

// ---------------------------------------------------------------- palette, helpers (everything micro)
const hash = (...a) => { let h = 0x2545f491; for (const v of a) { h = Math.imul(h ^ (v | 0), 2654435761); h ^= h >>> 15; } return (h >>> 0) / 4294967296; };
const CLAY = [[152, 62, 42], [168, 76, 48], [136, 54, 38], [180, 92, 56], [198, 140, 66], [184, 124, 58], [164, 104, 50], [120, 70, 48]];
const MORTAR = [176, 160, 128], SAND = [[198, 178, 138], [186, 166, 126], [206, 188, 148]], DARK = [58, 34, 26], CORE = [150, 120, 90];
const FERN = [[64, 120, 46], [52, 104, 38], [82, 138, 56]];
const MB = 'PB_DefaultMicroBrick';
const clay = (...k) => ({ color: CLAY[Math.floor(hash(...k) * CLAY.length)] });
const sand = (...k) => ({ color: SAND[Math.floor(hash(...k, 3) * SAND.length)] });
const box = (x0, y0, z0, x1, y1, z1, m, label) => (x1 > x0 && y1 > y0 && z1 > z0) && B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label);
const ubox = (u0, v0, z0, u1, v1, z1, m, label) => box(X(Math.min(u0, u1)), Y(Math.min(v0, v1)), z0, X(Math.max(u0, u1)), Y(Math.max(v0, v1)), z1, m, label);
// a column [z0,z1] at (u..u1, v..v1) minus every carved room it crosses
const minusVoids = (u, v, u1, v1, z0, z1) => {
  let spans = [[z0, z1]];
  for (const r of voids.map(carveOf)) if (r.u0 < u1 && r.u1 > u && r.v0 < v1 && r.v1 > v) spans = spans.flatMap(([a, b]) => [[a, Math.min(b, r.z0)], [Math.max(a, r.z1), b]].filter(([p, q]) => q > p));
  return spans;
};
// big hidden masses in pieces of at most 400 (micro brick length limits)
const mass = (u0, v0, z0, u1, v1, z1, m, label) => { for (let u = u0; u < u1; u += 400) for (let v = v0; v < v1; v += 400) for (let z = z0; z < z1; z += 400) ubox(u, v, z, Math.min(u1, u + 400), Math.min(v1, v + 400), Math.min(z1, z + 400), m, label); };

// ---------------------------------------------------------------- coursework
// face(axis, at, a0, a1, zb, zt, dir): bricks on the plane u=at ('u') or v=at, a0..a1 along the
// other axis, outward normal dir (+1/-1, toward the air). Face bricks at..at-4*dir, mortar backing
// at-4*dir..at-8*dir. skip(a, z) = holes (doors), dark(a, z) = niche shadow.
const JOINTS = [];
function face(axis, at, a0, a1, zb, zt, dir, { skip = () => false, dark = () => false, ground = true, key = 0 } = {}) {
  skip ??= () => false; dark ??= () => false;
  const P = (a, d) => axis === 'u' ? [at - dir * d, a] : [a, at - dir * d];
  const put = (aa0, aa1, d0, d1, z0, z1, m, label) => { const [u0, v0] = P(aa0, d0), [u1, v1] = P(aa1, d1); return ubox(u0, v0, z0, u1, v1, z1, m, label); };
  for (let a = a0; a < a1; a += 20) { // backing: one run per 20-long column between holes
    const e = Math.min(a1, a + 20), [p0, q0] = P(a, 4), [p1, q1] = P(e, 8);
    let z = ground ? Math.max(zb, groundTop(X(Math.min(p0, p1)), Y(Math.min(q0, q1)), X(Math.max(p0, p1)), Y(Math.max(q0, q1)), zt)) : zb;
    const hole = zz => skip(a + 2, zz) || skip((a + e) / 2, zz) || skip(e - 2, zz);
    while (z < zt) {
      if (hole(z + 5)) { z += 10; continue; }
      let z1 = z; while (z1 < zt && !hole(z1 + 5) && z1 - z < 400) z1 += 10;
      put(a, e, 4, 8, z, Math.min(zt, z1), { color: MORTAR }, 'backing'); z = z1;
    }
  }
  for (let z = zb, c = 0; z < zt; z += 10, c++) {
    const off = (c % 2) * 10;
    for (let a = a0 - off; a < a1; a += 20) {
      const s = Math.max(a0, a) + 1, e = Math.min(a1, a + 20) - 1, mid = (s + e) / 2;
      if (e - s < 4 || skip(mid, z + 5) || skip(s + 1, z + 5) || skip(e - 1, z + 5)) continue;
      const r = hash(key, axis === 'u' ? 1 : 2, at, a, z), zt1 = Math.min(zt, z + 8);
      if (zt1 - z < 2) continue;
      if (dark(mid, z + 5)) { put(s - 1, e + 1, 0, 4, z, Math.min(zt, z + 10), { color: DARK }, 'niche'); continue; }
      if (r < 0.04) continue;                                   // missing brick: the mortar shows
      const d0 = r < 0.16 ? 2 : 0, chip = r > 0.9 ? 2 : 0;      // recessed / chipped (eroded)
      if (put(s + chip, e - (r > 0.95 ? 2 : 0), d0, 4, z, zt1, clay(key, at, a, z), 'brick')) JOINTS.push({ axis, at, dir, a: e + 1, z: z + 9 });
    }
  }
}
function ring(u0, v0, u1, v1, zb, zt, o = {}) {
  face('v', v1, u0, u1, zb, zt, +1, { ground: o.ground, skip: o.skipN, dark: o.darkN, key: 1 });
  face('v', v0, u0, u1, zb, zt, -1, { ground: o.ground, skip: o.skipS, dark: o.darkS, key: 2 });
  face('u', u1, v0 + 8, v1 - 8, zb, zt, +1, { ground: o.ground, skip: o.skipE, dark: o.darkE, key: 3 });
  face('u', u0, v0 + 8, v1 - 8, zb, zt, -1, { ground: o.ground, skip: o.skipW, dark: o.darkW, key: 4 });
}
// a room's walls faced from inside; corners filled with brick posts
function roomFaces(r, o = {}, key = 20) {
  face('v', r.v1, r.u0, r.u1, r.z0, r.z1, -1, { ground: false, skip: o.skipN, dark: o.darkN, key: key + 1 });
  face('v', r.v0, r.u0, r.u1, r.z0, r.z1, +1, { ground: false, skip: o.skipS, dark: o.darkS, key: key + 2 });
  face('u', r.u1, r.v0, r.v1, r.z0, r.z1, -1, { ground: false, skip: o.skipE, dark: o.darkE, key: key + 3 });
  face('u', r.u0, r.v0, r.v1, r.z0, r.z1, +1, { ground: false, skip: o.skipW, dark: o.darkW, key: key + 4 });
}
const rectHole = (a0, a1, z0, z1) => (a, z) => a > a0 && a < a1 && z > z0 && z < z1;

// ---------------------------------------------------------------- the solid: core columns
const inStairs = (u, v) => Math.abs(u) < STAIR.w + STAIR.cheek && v > STAIR.v0 - 2;
const cuts = (lo, hi, extra) => [...new Set([lo, hi, ...extra.filter(c => c > lo && c < hi), ...Array.from({ length: 40 }, (_, k) => -800 + k * 40).filter(c => c > lo && c < hi)])].sort((a, b) => a - b);
const uEdges = [], vEdges = [];
for (const [hu, hv] of TIERS) uEdges.push(-hu, -hu + 8, hu - 8, hu), vEdges.push(-hv, -hv + 8, hv - 8, hv);
for (const r of voids.map(carveOf)) uEdges.push(r.u0, r.u1), vEdges.push(r.v0, r.v1);
uEdges.push(-STAIR.w - STAIR.cheek, STAIR.w + STAIR.cheek); vEdges.push(STAIR.v0 - 2);
const [hu0, hv0] = TIERS[0];
const us = cuts(-hu0 + 8, hu0 - 8, uEdges), vs = cuts(-hv0 + 8, hv0 - 8, vEdges);
for (let a = 0; a < us.length - 1; a++) for (let b = 0; b < vs.length - 1; b++) {
  const u = us[a], u1 = us[a + 1], v = vs[b], v1 = vs[b + 1], mu = (u + u1) / 2, mv = (v + v1) / 2;
  if (inStairs(mu, mv)) continue;
  let top = 0, tier = -1;
  TIERS.forEach(([hu, hv, t], i) => { if (Math.abs(mu) < hu - 8 && Math.abs(mv) < hv - 8) { top = t; tier = i; } });
  if (tier < 0) continue;
  const base = groundTop(X(u), Y(v), X(u1), Y(v1), GROUND_MAX + 1);
  let spans = [[base, top]];
  for (const r of voids.map(carveOf)) if (inRect(r, mu, mv)) spans = spans.flatMap(([z0, z1]) => [[z0, Math.min(z1, r.z0)], [Math.max(z0, r.z1), z1]].filter(([p, q]) => q > p));
  for (const [z0, z1] of spans) mass(u, v, z0, u1, v1, z1, { color: z1 === top ? SAND[Math.floor(hash(u, v, tier) * 3)].map(c => c - 22) : CORE }, 'core');
}
// tier faces: north faces stop at the stair; holes for the portal (T2 north) and the exit (T2 east)
const PORTAL = corbel((ROOMS.G.u0 + ROOMS.G.u1) / 2, ROOMS.G.u1 - ROOMS.G.u0, F, F + 70);
const EXITH = corbel((ROOMS.E.v0 + ROOMS.E.v1) / 2, ROOMS.E.v1 - ROOMS.E.v0, F, F + 60);
TIERS.forEach(([hu, hv, top], i) => {
  const zb = i ? TIERS[i - 1][2] : 240;
  const centres = len => { const n = []; for (let c = -len + 70; c <= len - 70; c += 110) n.push(c); return n; };
  const niche = len => (a, z) => i < 4 && z < top - 10 && z > zb + 6 && centres(len).some(c => corbel(c, 28, zb + 10, top - 40)(a, z));
  const stairCut = a => Math.abs(a) < STAIR.w + STAIR.cheek + 8;
  ring(-hu, -hv, hu, hv, zb, top, { ground: true, skipN: (a, z) => stairCut(a) || (i === 1 && PORTAL(a, z)), skipE: (a, z) => i === 1 && EXITH(a, z),
    darkS: niche(hu), darkE: (a, z) => !(i === 1 && Math.abs(a - 230) < 70) && niche(hv)(a, z), darkW: niche(hv),
    darkN: (a, z) => !stairCut(a) && Math.abs(a) > 160 && !(i <= 1 && Math.abs(a + 240) < 90) && niche(hu)(a, z) });
});

// ---------------------------------------------------------------- the rooms: faces, floors, vaults
const Gr = ROOMS.G, Ar = ROOMS.A, Pr = ROOMS.P, Sr = ROOMS.S, Er = ROOMS.E, Pit = ROOMS.Pit;
const dA = corbel(-220, 60, F, F + 70), dS = corbel(80, 80, F, F + 70);
roomFaces({ ...Gr, v1: Gr.v1 - 70 }, { skipN: () => true, skipS: () => true }, 30); // the portal end (in the T2 face band) is faced by the tier ring
face('u', Gr.u0, Gr.v1 - 70, Gr.v1 - 8, F, Gr.z1, +1, { ground: false, key: 35 }); face('u', Gr.u1, Gr.v1 - 70, Gr.v1 - 8, F, Gr.z1, -1, { ground: false, key: 36 });
roomFaces(Ar, { skipN: rectHole(Gr.u0, Gr.u1, F - 1, Gr.z1), skipE: dA }, 40);
roomFaces(Pr, { skipW: dA, skipN: dS }, 50);
face('u', Pit.u0, Pit.v0, Pit.v1, Pit.z0, F, +1, { ground: false, key: 83 });   // the pit's side walls, down to the spikes
face('u', Pit.u1, Pit.v0, Pit.v1, Pit.z0, F, -1, { ground: false, key: 84 });
roomFaces(Sr, { skipS: dS, skipE: rectHole(Er.v0, Er.v1, F - 1, Er.z1) }, 60);
face('v', Er.v1, Er.u0 + 8, Er.u1 - 70, F, Er.z1, -1, { ground: false, key: 71 }); face('v', Er.v0, Er.u0 + 8, Er.u1 - 70, F, Er.z1, +1, { ground: false, key: 72 });
face('v', Pit.v0, Pit.u0, Pit.u1, Pit.z0, F, +1, { ground: false, key: 81 });  // the landings' edges down into the pit
face('v', Pit.v1, Pit.u0, Pit.u1, Pit.z0, F, -1, { ground: false, key: 82 });
for (const d of DOORS) ubox(d.u0, d.v0, d.z0 - 4, d.u1, d.v1, d.z0, sand(d.u0, d.v0), 'sill');
// floors: sandstone pavers (40 x 20, 2 joints) over a mortar bed
const pave = (r, label) => { for (let u = r.u0; u < r.u1; u += 40) for (let v = r.v0; v < r.v1; v += 20) {
  if (r.skip?.(u + 20, v + 10)) continue;
  ubox(u, v, r.z0 - 4, Math.min(r.u1, u + 40), Math.min(r.v1, v + 20), r.z0 - 2, { color: MORTAR }, 'bed');
  ubox(u + 1, v + 1, r.z0 - 2, Math.min(r.u1, u + 40) - 1, Math.min(r.v1, v + 20) - 1, r.z0, sand(u, v, label.length), label); } };
pave(Ar, 'floor'); pave(Sr, 'floor'); pave(Er, 'floor');
pave({ ...Pr, skip: (u, v) => inRect(Pit, u, v) }, 'floor');
// corbelled vaults: courses stepping 6 in from the long walls, 10 a course
const vault = (r, alongU, from, k0 = 8) => {
  for (let k = 0; k < k0; k++) {
    const z = from + k * 10, d = (k + 1) * 6;
    if (alongU) { ubox(r.u0, r.v0, z, r.u1, r.v0 + d, z + 10, clay(r.u0, z, 5), 'vault'); ubox(r.u0, r.v1 - d, z, r.u1, r.v1, z + 10, clay(r.u1, z, 6), 'vault'); }
    else { ubox(r.u0, r.v0, z, r.u0 + d, r.v1, z + 10, clay(r.v0, z, 7), 'vault'); ubox(r.u1 - d, r.v0, z, r.u1, r.v1, z + 10, clay(r.v1, z, 8), 'vault'); }
  }
};
vault(Ar, false, Ar.z1 - 80); vault(Sr, true, Sr.z1 - 80); vault(Pr, false, Pr.z1 - 80);

// ---------------------------------------------------------------- arrow gallery: trap tiles + darts
const ROWS = []; for (let v = Gr.v1 - 100; v > Gr.v0 + 20; v -= 60) ROWS.push(v);
ROWS.forEach((rv, r) => {
  for (let k = 0; k < 4; k++) {
    const u = Gr.u0 + k * 20, isTrap = (k + r) % 2 === 0;
    ubox(u, rv, F - 4, u + 20, rv + 20, F - 2, { color: MORTAR }, 'bed');
    ubox(u + 1, rv + 1, F - 2, u + 19, rv + 19, F, { color: SAND[(k + r) % 3], ...(isTrap ? { trap: r } : {}) }, isTrap ? 'traptile' : 'tile');
  }
  for (const [u0, u1, dir] of [[Gr.u0, Gr.u0 + 4, 0], [Gr.u1 - 4, Gr.u1, 1]]) ubox(u0, rv + 8, F + 28, u1, rv + 12, F + 32, { color: [24, 20, 18], dart: { r, dir } }, 'dart');
});
pave({ ...Gr, skip: (u, v) => ROWS.some(rv => v >= rv && v < rv + 20) }, 'floor');

// ---------------------------------------------------------------- pit hall: spikes, pillars, way out
const PILLARS = [[30, -170, 530], [150, -100, 580], [90, -10, 620], [10, 60, 570]];
const nearPillar = (u, v) => PILLARS.some(([pu, pv]) => Math.abs(u - pu) < 22 && Math.abs(v - pv) < 22);
for (const [pu, pv, top] of PILLARS) { ubox(pu - 12, pv - 12, Pit.z0, pu + 12, pv + 12, top - 4, clay(pu, pv, 31), 'pillar'); ubox(pu - 14, pv - 14, top - 4, pu + 14, pv + 14, top, sand(pu, pv), 'pillarcap'); }
const OUT = { u0: Pit.u0, u1: Pit.u0 + 28, v0: -50 };   // steps up the west wall to the north landing
for (let s = 0; s < 12; s++) ubox(OUT.u0, OUT.v0 + s * 12, Pit.z0, OUT.u1, OUT.v0 + s * 12 + 12, Pit.z0 + 10 + s * 10, sand(s, 44), 'pitstep');
ubox(OUT.u0, OUT.v0 + 144, Pit.z0, OUT.u1, Pit.v1, F, sand(12, 44), 'pitstep');
for (let u = Pit.u0 + 32; u < Pit.u1 - 12; u += 16) for (let v = Pit.v0 + 4; v < Pit.v1 - 12; v += 16)
  if (!nearPillar(u + 5, v + 5)) ubox(u, v, Pit.z0, u + 10, v + 10, Pit.z0 + 10, { asset: 'PB_Spike', color: [120, 116, 110], spike: true }, 'spike');

// ---------------------------------------------------------------- sanctum: pedestal, braziers
const PU = 80, PV = 215;
ubox(PU - 24, PV - 24, F, PU + 24, PV + 24, F + 12, clay(1, 2, 3), 'pedestal');
ubox(PU - 14, PV - 14, F + 12, PU + 14, PV + 14, F + 44, sand(0, PV), 'pedestal');
ubox(PU - 18, PV - 18, F + 44, PU + 18, PV + 18, F + 48, sand(1, PV), 'pedestal');
ubox(PU - 10, PV - 8, F + 48, PU + 10, PV + 8, F + 62, { color: [90, 220, 60], material: 'BMC_Glow', stash: true }, 'stash');
ubox(PU - 4, PV - 2, F + 62, PU + 4, PV + 2, F + 70, { color: [140, 110, 70] }, 'stashknot');
const fire = { color: [255, 120, 30], material: 'BMC_Glow' };
const brazier = (u, v) => { ubox(u - 8, v - 8, F, u + 8, v + 8, F + 40, clay(u, v, 5), 'brazier'); ubox(u - 11, v - 11, F + 40, u + 11, v + 11, F + 48, fire, 'fire'); };
for (const [u, v] of [[0, 180], [160, 180], [0, 255], [160, 255], [Ar.u0 + 30, Ar.v0 + 30], [Ar.u1 - 30, Ar.v0 + 30], [Ar.u1 - 30, Ar.v1 - 30], [Pr.u1 - 30, Pr.v1 - 20], [Pr.u1 - 30, Pr.v0 + 20]]) brazier(u, v);

// ---------------------------------------------------------------- grand staircase, side stair
for (let s = 0; s < 120; s++) {
  const top = STAIR.top - s * STAIR.rise, v0 = STAIR.v0 + s * STAIR.tread, v1 = v0 + STAIR.tread;
  if (top <= 240) break;
  let any = false;
  for (let u = -STAIR.w; u < STAIR.w; u += 40) {
    const g = groundTop(X(u), Y(v0), X(u + 40), Y(v1), top);
    if (g >= top - 2) continue;
    any = true;
    for (const [z0, z1] of minusVoids(u, v0, u + 40, v1, g, top - 2)) mass(u, v0, z0, u + 40, v1, z1, { color: CORE }, 'stair');
    ubox(u, v0, top - 2, u + 40, v1, top, sand(u, s), 'tread');
  }
  for (const [c0, c1] of [[-STAIR.w - STAIR.cheek, -STAIR.w], [STAIR.w, STAIR.w + STAIR.cheek]]) {
    const ct = top + 16, g = groundTop(X(c0), Y(v0), X(c1), Y(v1), ct);
    if (g < ct - 4) { for (const [z0, z1] of minusVoids(c0, v0, c1, v1, g, ct - 4)) mass(c0, v0, z0, c1, v1, z1, clay(c0, s, 9), 'cheek'); ubox(c0 - 2, v0, ct - 4, c1 + 2, v1, ct, sand(c0, s), 'cheekcap'); }
  }
  if (!any && s > 5) break;
}
for (let s = 0; s < 40; s++) {
  const top = F - s * 10, v0 = SIDE.v0 + s * 10, v1 = v0 + 10;
  const g = groundTop(X(SIDE.u0), Y(v0), X(SIDE.u1), Y(v1), top);
  if (g >= top - 2) break;
  mass(SIDE.u0, v0, g, SIDE.u1, v1, top - 2, { color: CORE }, 'sidestair');
  ubox(SIDE.u0, v0, top - 2, SIDE.u1, v1, top, sand(SIDE.u0, s), 'tread');
  for (const [c0, c1] of [[SIDE.u0 - 12, SIDE.u0], [SIDE.u1, SIDE.u1 + 12]]) { const gg = groundTop(X(c0), Y(v0), X(c1), Y(v1), top + 12); if (gg < top + 8) ubox(c0, v0, gg, c1, v1, top + 12, clay(c0, s, 19), 'cheek'); }
}

// ---------------------------------------------------------------- summit shrine (blind corbelled doors), roof, boulder
const SH = { u0: -120, u1: 120, v0: -110, v1: 110, zb: TIERS[4][2], zt: TIERS[4][2] + 140 };
mass(SH.u0 + 8, SH.v0 + 8, SH.zb, SH.u1 - 8, SH.v1 - 8, SH.zt, { color: CORE }, 'shrinecore');
const blind = corbel(0, 40, SH.zb + 20, SH.zb + 70);
ring(SH.u0, SH.v0, SH.u1, SH.v1, SH.zb, SH.zt, { ground: false, darkN: corbel(0, 60, SH.zb, SH.zb + 60), darkS: blind, darkE: blind, darkW: blind });
[[110, 100], [90, 80], [70, 60]].forEach(([hu, hv], k) => mass(-hu, -hv, SH.zt + k * 10, hu, hv, SH.zt + 10 + k * 10, clay(hu, k, 7), 'roof'));
for (let u = -60; u < 60; u += 12) for (let z = SH.zt + 30; z < SH.zt + 100; z += 10) if ((Math.floor((u + 60) / 12) + Math.floor(z / 10)) % 3) ubox(u, -6, z, u + 10, 6, z + 8, clay(u, z, 77), 'comb');
for (const b of buildRocks([{ c: [X(0), Y(80), SH.zt + 64], r: [36, 34, 32], seed: 57 }], { seed: 57, moss: 0.3, allow: (x, y, z) => B.free([x, y, z], [x + 10, y + 10, z + 10]) })) B.add(b, 'boulder');

// ---------------------------------------------------------------- bas-reliefs
const GLYPH = {
  sun: ['....##....', '.#..##..#.', '..######..', '.##....##.', '###.##.###', '###.##.###', '.##....##.', '..######..', '.#..##..#.', '....##....'],
  eye: ['..........', '...####...', '.##....##.', '#...##...#', '#..####..#', '#..####..#', '#...##...#', '.##....##.', '...####...', '..........'],
  serpent: ['......###.', '.....#.#.#', '.....####.', '....##....', '...##.....', '..##...##.', '.##...##..', '.##..##...', '..####....', '...##.....'],
  frog: ['.##....##.', '#..#..#..#', '.######...', '##########', '#.#....#.#', '##########', '.########.', '..#....#..', '.##....##.', '##......##'],
  spiral: ['########..', '#......#..', '#.####.#..', '#.#..#.#..', '#.#.##.#..', '#.#....#..', '#.######..', '#.........', '##########', '..........'],
  grip: ['.##.......', '#..#......', '#..#......', '.##.#.....', '....##....', '.....###..', '....#..##.', '...#....##', '..#......#', '..........'],
};
// a carved sandstone panel on face (axis, at, normal dir toward the viewer), centred at (a, z); px = glyph pixel size
function relief(axis, at, dir, a, z, glyph, px = 4) {
  const H = px * 5 + 2;
  const P = (aa, d) => axis === 'u' ? [at + dir * d, aa] : [aa, at + dir * d];
  const put = (a0, a1, d0, d1, z0, z1, m, l) => { const [u0, v0] = P(a0, d0), [u1, v1] = P(a1, d1); return ubox(u0, v0, z0, u1, v1, z1, m, l); };
  if (!put(a - H, a + H, 0, 2, z - H, z + H, sand(a, z, at), 'panel')) return;
  const g = GLYPH[glyph], flip = (axis === 'v') === (dir > 0);
  g.forEach((row, ry) => {
    let run = -1;
    for (let k = 0; k <= 10; k++) {
      const on = k < 10 && row[flip ? 9 - k : k] === '#';
      if (on && run < 0) run = k;
      if (!on && run >= 0) { put(a - px * 5 + run * px, a - px * 5 + k * px, 2, 4, z + px * 4 - ry * px, z + px * 5 - ry * px, { color: [160, 140, 102] }, 'glyph'); run = -1; }
    }
  });
}
const G = Object.keys(GLYPH);
TIERS.slice(0, 4).forEach(([hu, hv, top], i) => {
  const zb = i ? TIERS[i - 1][2] : 380, zc = Math.round((zb + top) / 2 / 2) * 2, px = i < 2 ? 6 : 4;
  relief('u', hu, +1, 15, zc, G[(i * 2) % 6], px); relief('u', -hu, -1, -15, zc, G[(i * 2 + 1) % 6], px);
  relief('v', -hv, -1, 15, zc, G[(i + 4) % 6], px);
  relief('v', hv, +1, STAIR.w + 70, zc, G[(i + 3) % 6], px);
  if (i > 1) relief('v', hv, +1, -STAIR.w - 70, zc, G[(i + 2) % 6], px);
});
relief('v', TIERS[1][1], +1, -330, F + 70, 'eye', 6);                // beside the portal (on the T2 face)
relief('v', Ar.v0, +1, -230, F + 110, 'serpent', 6); relief('v', Ar.v0, +1, -130, F + 110, 'sun', 6);
relief('u', Ar.u0, +1, -165, F + 110, 'frog', 6);
relief('v', Sr.v1, -1, 80, F + 120, 'grip', 8); relief('v', Sr.v1, -1, 10, F + 90, 'grip', 4); relief('v', Sr.v1, -1, 150, F + 90, 'grip', 4);
relief('u', Pr.u1, -1, -120, F + 140, 'eye', 8); relief('u', Pr.u1, -1, 40, F + 140, 'serpent', 8);

// ---------------------------------------------------------------- plaque by the portal, Gary's hammock
plaque({ put: (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'plaque'), text: 'TEMPLE OF THE STASH\nNO STEALING. SIGNED, GARY\nP.S. THE BOULDER IS DECORATIVE',
  facing: [0, 1], x: X(-170), y: Y(TIERS[1][1]) + 1, z: F + 60, w: 26, h: 14, color: [96, 76, 52], style: { LineHeight: 1.6 } });
for (const hx of [2130, 2270]) { const g = groundTop(hx - 5, 6185, hx + 5, 6195, 360); box(hx - 5, 6185, g, hx + 5, 6195, 352, { color: [96, 70, 44] }, 'post'); }
for (const [x0, x1, z] of [[2136, 2170, 330], [2170, 2230, 322], [2230, 2264, 330]]) box(x0, 6180, z, x1, 6200, z + 2, { color: [150, 120, 70] }, 'hammock');

// ---------------------------------------------------------------- ferns in the joints
let ferns = 0;
const NOCOLL = { player: false, weapon: false, interaction: false, tool: true, physics: false };
for (const j of JOINTS) {
  if (ferns >= 220 || hash(j.at, j.a, j.z, 5) > 0.02) continue;
  const P = (a, d) => j.axis === 'u' ? [j.at + j.dir * d, a] : [a, j.at + j.dir * d];
  const pc = (a0, a1, d0, d1, z0, z1, k) => { const [u0, v0] = P(a0, d0), [u1, v1] = P(a1, d1); return ubox(u0, v0, z0, u1, v1, z1, { color: FERN[k % 3], collision: NOCOLL }, 'fern'); };
  if (!pc(j.a - 2, j.a + 2, 0, 4, j.z - 2, j.z + 2, 0)) continue;
  ferns++;
  for (const s of [-1, 1]) for (let k = 1; k <= 5; k++) { const dz = k < 3 ? k * 2 : 6 - (k - 3) * 2; pc(j.a + s * (k * 3) - 1, j.a + s * (k * 3) + 1, k * 2, 2 + k * 2, j.z + dz, j.z + dz + 2, k); }
  pc(j.a - 1, j.a + 1, 2, 6, j.z + 2, j.z + 12, 2);
}

// ---------------------------------------------------------------- write the prefab (+ wires) and the jobs
const dropped = B.dropped.filter(d => !d.startsWith('terrain'));
const byLabel = {}; for (const d of dropped) { const l = d.split(' ')[0] + (/ hits terrain /.test(d) ? '>terrain' : ''); byLabel[l] = (byLabel[l] ?? 0) + 1; }
const mine = B.bricks.slice(nObst);
console.error(`${mine.length} temple bricks; dropped ${JSON.stringify(byLabel)}; ferns ${ferns}; trap tiles ${mine.filter(b => b.trap !== undefined).length}; darts ${mine.filter(b => b.dart).length}; spikes ${mine.filter(b => b.spike).length}; clear ${CLEAR.length} props + ${liveClear.length} bushes`);
if (process.env.TEMPLE_DEBUG) for (const d of dropped) if (new RegExp(process.env.TEMPLE_DEBUG).test(d)) console.error(d.slice(0, 220));

const EXT = [...EXTERNAL_ASSETS, { type: 'BRWeaponProjectile', name: 'Projectile_Bow_Charged' }];
const PROJ = EXT.length - 1;
const w = new lib.World();
const o = w.addOwner(OWNER);
const zones = [], spawners = [];
for (const brick of mine) {
  const { label, obstacle, trap, dart, spike, stash, ...b } = brick;
  const comps = [...(b.components ?? [])];
  if (spike) comps.push({ type: COMP.Damage.NAME, data: { Damage: 25, RepeatDelay: 0.5, Message: 'SPIKES', ConsoleTag: '' } });
  if (trap !== undefined) comps.push({ type: COMP.AttachedZone.NAME, data: { ZoneStartDistance: 0, ZoneEndDistance: 60, bIsBuildingZone: false, bIsLooseZone: false, bIsShareZone: false, bWater: false,
    bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true, bDetectEntities: false, bDetectProjectiles: false, TagFilter: '', ZoneWindForce: 0 } });
  if (dart) comps.push({ type: COMP.ProjectileSpawner.NAME, data: { ProjectileClass: PROJ, FireSound: null, Direction: dart.dir, SpawnLocation: 0, SpawnMargin: 5, SpawnOffsetBias: 0, bEnabled: false,
    NumberOfShots: 1, SpreadConeAngle: 2, bSpreadBiasedTowardsCenter: true, FireRate: 2, bEnforceFireRate: true, DamageMultiplier: 0.35, SpeedMultiplier: 1, ScaleMultiplier: 1 } });
  if (stash) comps.push({ type: 'Component_Interact', data: { InteractSound: null, Message: '', ConsoleTag: 'event:quest:stash', bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Grab THE STASH' } });
  const h = w.addBrick({ ...b, position: [b.position[0] - CX, b.position[1] - CY, b.position[2] - ZOFF], owner_index: o, components: comps });
  if (trap !== undefined) zones.push({ r: trap, h, c: COMP.AttachedZone });
  if (dart) spawners.push({ r: dart.r, h, c: COMP.ProjectileSpawner });
}
let gi = 0;
const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [-60 + (gi % 12) * 20, Math.floor(gi++ / 12) * 20, SH.zt + 180 - ZOFF], color: [200, 200, 200], owner_index: o, visibility: false, collision: NOCOLL, components: [{ type: c.NAME, data }] }), c });
const wire = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
for (const r of ROWS.keys()) {
  const zs = zones.filter(z => z.r === r), ds = spawners.filter(d => d.r === r);
  if (!zs.length || !ds.length) continue;
  let src = [zs[0], 'bOccupied'];
  for (const z of zs.slice(1)) { const or = gate(COMP.Expr_LogicalOR); wire(...src, or, 'bInputA'); wire(z, 'bOccupied', or, 'bInputB'); src = [or, 'bOutput']; }
  for (const d of ds) wire(...src, d, 'bEnabled');
}
w.makePrefab({});
writeFileSync(`${outDir}/temple.brz`, w.toBrz({ bundle: { description: 'Temple of the Stash' }, externalAssets: EXT }));
const clearLines = [
  ...liveClear,
  ...CLEAR.map(([lo, hi]) => `br.World.ClearRegion ${(lo[0] + hi[0]) / 2} ${(lo[1] + hi[1]) / 2} ${(lo[2] + hi[2]) / 2} ${(hi[0] - lo[0]) / 2 + 1} ${(hi[1] - lo[1]) / 2 + 1} ${(hi[2] - lo[2]) / 2 + 1}`),
];
// ClearRegions must be paced (back-to-back ones in a tick are dropped): 120 ms each, 300 a job (60 s limit)
for (let k = 0; k * 300 < clearLines.length; k++)
  writeFileSync(`${outDir}/temple_clear${k}.json`, JSON.stringify({ ops: clearLines.slice(k * 300, k * 300 + 300).map(line => ({ op: 'cmd', line, captureMs: 120 })) }));
writeFileSync(`${outDir}/temple_load.json`, JSON.stringify({ ops: [{ op: 'cmd', line: `br.Prefab.Load "temple" ${CX} ${CY} ${ZOFF} 0 16`, captureMs: 8000 }] }));
writeFileSync(`${outDir}/temple_preview.json`, JSON.stringify([
  ...B.bricks.slice(0, nObst).map(({ obstacle, label, ...b }) => ({ ...b, color: [74, 70, 62] })),
  ...mine.map(({ label, obstacle, trap, dart, spike, stash, ...b }) => b)]));
