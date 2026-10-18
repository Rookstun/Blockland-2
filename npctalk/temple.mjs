// THE TEMPLE OF THE STASH v4 (main quest chapter 5, Raiders of the Lost Stash). Owner 2026-10-18:
// v1/v2 asks (grand stair, red + ochre clay brick, corbelled arches, bas-reliefs, ferns, arrow trap
// tiles, spike pits + platforming), v3 asks (player 48 tall, jumps 300 long / 108 high, micro bricks,
// no tiles, several rooms), then on v3 with a picture of Ur-Nammu's ziggurat: "bricks should be 0
// spaces apart. light component torches. wide area for traps, 5x5 tiles you have to jump on. ferns
// should use the fern brick. entrance at top. corridors. spikes instakill no message. dark gradient
// downward to spikes to make them seem deeper". Old versions: temple_v1/v2/v3.mjs.
//
// Ur-Nammu style ziggurat (three battered tiers: every 10-high course steps in 2; buttress pilasters
// down every face) centred world (2400, 5250):
//  - three stairs: the central one straight up the north side and two side stairs climbing along
//    the north face meet at a landing; the central stair goes on through a gatehouse on the second
//    tier to the shrine on top. THE ENTRANCE IS THE SHRINE (crenellated, corbelled door).
//  - inside, top down: switchback stairwell -> corridor -> glyph antechamber -> stair down the west
//    wall into the TRAP HALL: a 5 x 5 grid of jump tiles (pillars) over a 160-deep spike pit
//    (instakill, no message; walls and pillars darken toward the spikes); trap tiles switch on the
//    darts aimed down their row and column -> corridor -> SANCTUM (THE STASH: event:quest:stash) ->
//    exit tunnel down and out of the south face (the escape)
//  - flush brick coursework (no joints), reds + ochres, a few bricks recessed; torches with
//    Component_PointLight; B_Fern ferns on ledges; sandstone bas-reliefs
//   node npctalk/temple.mjs <brs-js 4 dist.mjs> <map out dir> <live region json> <outDir>
// Outputs temple.brz (prefab, wires), temple_load.json, temple_preview.json (isoview); the footprint's
// trees were cleared for v3 (same footprint + the side stairs: temple_clear*.json if needed).
// Owner "Stash Temple" ea32a1c0-0000-4b0b-9a11-0000000057a5 (clear: br.Bricks.Clear <id> 1).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { makeBuilder, FIXED } from '../mapgen/builder.mjs';
import { worldBox } from '../mapgen/orient.mjs';
import { plaque, EXTERNAL_ASSETS } from '../mapgen/ruins.mjs';
const [dist, mapDir, liveFile, outDir] = process.argv.slice(2);
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
const COMP = lib.brdb.COMPONENTS;
const OWNER = { id: 'ea32a1c0-0000-4b0b-9a11-0000000057a5', name: 'Stash Temple', display_name: 'Stash Temple' };
const CX = 2400, CY = 5250, ZOFF = 200;
const X = u => CX + u, Y = v => CY + v;
const GROUND_MAX = 366;

// ---------------------------------------------------------------- layout (u east, v north)
// tiers: half extents at zb, every 10-high course 2 in (battered)
const TIERS = [
  { hu: 512, hv: 432, zb: 240, zt: 700 },
  { hu: 360, hv: 280, zb: 700, zt: 880 },
  { hu: 220, hv: 170, zb: 880, zt: 1000 },
];
const halfAt = (t, z) => [t.hu - 2 * Math.floor((z - t.zb) / 10), t.hv - 2 * Math.floor((z - t.zb) / 10)];
const topHalf = t => halfAt(t, t.zt - 10);
const F = 540;                                 // trap hall / sanctum floor
const ROOMS = {
  WELL: { u0: -60, u1: 60, v0: -126, v1: 140, z0: 760, z1: 996 },     // switchback stairwell under the shrine
  SHR: { u0: -88, u1: 88, v0: -68, v1: 68, z0: 1000, z1: 1120 },      // the shrine room (the entrance)
  C1: { u0: -80, u1: -60, v0: 100, v1: 140, z0: 760, z1: 860 },       // doorway stairwell -> antechamber
  ANT: { u0: -300, u1: -80, v0: -200, v1: 200, z0: 760, z1: 860 },    // glyph antechamber (grown into the core)
  S2: { u0: -300, u1: -240, v0: -100, v1: 130, z0: F, z1: 860 },      // stair down from the antechamber into the hall
  HALL: { u0: -400, u1: 200, v0: -320, v1: 300, z0: F, z1: 690 },     // the trap hall: wide ledges round the pit
  PIT: { u0: -240, u1: 160, v0: -300, v1: 140, z0: 380, z1: F },      // its spike pit
  C3: { u0: 200, u1: 240, v0: -40, v1: 20, z0: F, z1: F + 100 },      // corridor hall -> sanctum
  SAN: { u0: 240, u1: 400, v0: -200, v1: 200, z0: F, z1: 690 },       // sanctum
  E1: { u0: 310, u1: 370, v0: -380, v1: -200, z0: 360, z1: 660 },     // exit stair down
  E2: { u0: 310, u1: 370, v0: -480, v1: -380, z0: 360, z1: 470 },     // exit tunnel out the south face
};
const voids = Object.values(ROOMS);
const carveOf = r => ({ u0: r.u0 - 8, u1: r.u1 + 8, v0: r.v0 - 8, v1: r.v1 + 8, z0: r.z0 - 4, z1: r.z1 });
const inRect = (r, u, v) => u >= r.u0 && u < r.u1 && v >= r.v0 && v < r.v1;
const hits3 = (a, b) => a.u0 < b.u1 && a.u1 > b.u0 && a.v0 < b.v1 && a.v1 > b.v0 && a.z0 < b.z1 && a.z1 > b.z0;
const inVoid = q => voids.some(r => hits3(q, carveOf(r)));
// stairs (outside)
const CS = { w: 60, v0: 440 };                 // central lower stair: top at v 440 z 700, down to the north
const LAND = { u0: -80, u1: 80, v0: 400, v1: 440 };
const SS = { v0: 400, v1: 448, u0: 80 };       // side stairs along the face, tops at |u| 80
const US = { w: 50 };                          // upper stair: from the landing (v 400, z 700) south up to the shrine door

// ---------------------------------------------------------------- terrain + live obstacles
const AREA = [X(-760), Y(-520), X(760), Y(900)];
const hit = ([lo, hi]) => lo[0] < AREA[2] && hi[0] > AREA[0] && lo[1] < AREA[3] && hi[1] > AREA[1];
const FOOT = (x, y) => (x > X(-520) && x < X(520) && y > Y(-490) && y < Y(460)) || (x > X(-90) && x < X(90) && y > Y(0) && y < Y(860)) || (x > X(-700) && x < X(700) && y > Y(380) && y < Y(470));
const obstacles = [], CLEAR = [];
for (const f of readdirSync(mapDir).filter(f => /^chunk_\d+\.json$/.test(f)))
  for (const op of JSON.parse(readFileSync(`${mapDir}/${f}`)).ops) for (const b of op.bricks ?? []) {
    const bx = worldBox(b, FIXED);
    if (!hit(bx)) continue;
    if (FOOT((bx[0][0] + bx[1][0]) / 2, (bx[0][1] + bx[1][1]) / 2) && (bx[1][2] > GROUND_MAX || !b.size?.[0])) { CLEAR.push(bx); continue; }
    obstacles.push(bx);
  }
const liveClear = [];
for (const b of JSON.parse(readFileSync(liveFile)).bricks.filter(b => b.position)) {
  const bx = worldBox({ ...b, size: b.size?.[0] ? b.size : FIXED[b.asset] ?? [20, 20, 20] }, FIXED);
  if (!hit(bx)) continue;
  const foot = FOOT(b.position[0], b.position[1]);
  if (foot && b.asset === 'B_Bush') { liveClear.push(`br.World.ClearRegion ${b.position[0]} ${b.position[1]} ${b.position[2] + 10} 16 16 34`); continue; }
  if (foot && /SoundEmitter|Microchip/.test(b.asset)) continue;
  if (foot && !/Gate|Bot_Spawn/.test(b.asset) && (b.asset === 'B_Pine_Tree' || bx[1][2] > GROUND_MAX)) continue;
  if (b.owner_name === OWNER.name) continue;
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
const gTop = (u0, v0, u1, v1, below) => groundTop(X(u0), Y(v0), X(u1), Y(v1), below);

// ---------------------------------------------------------------- palette, helpers (all micro bricks)
const hash = (...a) => { let h = 0x2545f491; for (const v of a) { h = Math.imul(h ^ (v | 0), 2654435761); h ^= h >>> 15; } return (h >>> 0) / 4294967296; };
const CLAY = [[152, 62, 42], [168, 76, 48], [136, 54, 38], [180, 92, 56], [198, 140, 66], [184, 124, 58], [164, 104, 50], [146, 88, 52]];
const SAND = [[198, 178, 138], [186, 166, 126], [206, 188, 148]], CORE = [150, 120, 90], DARK = [52, 32, 24];
const MB = 'PB_DefaultMicroBrick';
const clayC = (...k) => CLAY[Math.floor(hash(...k) * CLAY.length)];
const clay = (...k) => ({ color: clayC(...k) });
const sand = (...k) => ({ color: SAND[Math.floor(hash(...k, 3) * SAND.length)] });
const shade = (c, t) => c.map(x => Math.round(x * (1 - t) + 6 * t)); // t 0 = as is, 1 = near black
const pitShade = z => Math.min(0.92, Math.max(0, (F - z) / (F - ROOMS.PIT.z0)) * 0.95);
const box = (x0, y0, z0, x1, y1, z1, m, label) => (x1 > x0 && y1 > y0 && z1 > z0) && B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label);
const ubox = (u0, v0, z0, u1, v1, z1, m, label) => box(X(Math.min(u0, u1)), Y(Math.min(v0, v1)), z0, X(Math.max(u0, u1)), Y(Math.max(v0, v1)), z1, m, label);
const mass = (u0, v0, z0, u1, v1, z1, m, label) => { for (let u = u0; u < u1; u += 400) for (let v = v0; v < v1; v += 400) for (let z = z0; z < z1; z += 400) ubox(u, v, z, Math.min(u1, u + 400), Math.min(v1, v + 400), Math.min(z1, z + 400), m, label); };
const minusVoids = (u, v, u1, v1, z0, z1) => {
  let spans = [[z0, z1]];
  for (const r of voids.map(carveOf)) if (r.u0 < u1 && r.u1 > u && r.v0 < v1 && r.v1 > v) spans = spans.flatMap(([a, b]) => [[a, Math.min(b, r.z0)], [Math.max(a, r.z1), b]].filter(([p, q]) => q > p));
  return spans;
};
const solid = (u0, v0, z0, u1, v1, z1, m, label) => { for (const [a, b] of minusVoids(u0, v0, u1, v1, z0, z1)) mass(u0, v0, a, u1, v1, b, m, label); };

// ---------------------------------------------------------------- hidden chip pockets (behind the dart walls)
// (owner 2026-10-18: "we can see the wires connecting the pressure plate to the spike trap"): every dart
// gets its own invisible microchip in a pocket in the masonry right behind it, every trap tile one inside
// its pillar; they talk through a global custom event, so no wire crosses a room. The pockets are
// reserved before the masonry (the core pieces that would fill them are left out) and dropped at output.
const DZ = F + 30;
const DARTS = [];
for (let r = 0; r < 5; r++) { const v = -250 + r * 80;
  if (!(v > ROOMS.S2.v0 - 10 && v < ROOMS.S2.v1 + 10)) DARTS.push({ kind: 'r', i: r, dir: 0, u: ROOMS.HALL.u0, v, du: 1, dv: 0 });
  if (!(v > ROOMS.C3.v0 - 10 && v < ROOMS.C3.v1 + 10)) DARTS.push({ kind: 'r', i: r, dir: 1, u: ROOMS.HALL.u1, v, du: -1, dv: 0 }); }
for (let c = 0; c < 5; c++) { const u = -190 + c * 80;
  DARTS.push({ kind: 'c', i: c, dir: 2, u, v: ROOMS.HALL.v0, du: 0, dv: 1 });
  DARTS.push({ kind: 'c', i: c, dir: 3, u, v: ROOMS.HALL.v1, du: 0, dv: -1 }); }
for (const d of DARTS) { // the chip sits 8..20 behind the wall face (behind the 8-deep face bricks)
  d.cu = d.u - d.du * 14; d.cv = d.v - d.dv * 14;
  ubox(d.cu - 6, d.cv - 6, DZ - 4, d.cu + 6, d.cv + 6, DZ + 8, { color: [0, 0, 0] }, 'pocket');
}

// ---------------------------------------------------------------- stairs first, laid in brick courses
// (owner 2026-10-18: "stairs aren't aligned ... when your stairs extend from the floor it creates a
// striped pattern instead of the brick"): rise 10 = one wall course, run 10; every course of a stair is
// a row of 20-long running-bond bricks over all the steps at least that high, so the sides read as
// brickwork and the steps line up with the walls' courses.
// coursed(axis 'u'|'v', a0 (the top step's edge), dir (+-1 along the run), n steps, top0, dz (+-10 per
// step), cross(z) -> [c0, c1], base(c0, c1, a0, a1, z1) -> the floor/ground under a brick, key)
function coursed(axis, a0, dir, n, top0, dz, cross, base, key, label = 'stair') {
  const tops = Array.from({ length: n }, (_, k) => top0 + dz * k);
  const zLo = Math.floor(Math.min(...tops.map((tp, k) => { const r = [a0 + dir * 10 * k, a0 + dir * 10 * (k + 1)]; const [c0, c1] = cross(tp - 10); return base(c0, c1, Math.min(...r), Math.max(...r), tp); })) / 10) * 10;
  for (let z = zLo, c = 0; z < Math.max(...tops); z += 10, c++) {
    // the steps this course runs under: contiguous ranges along the run
    const inc = tops.map(tp => tp >= z + 10);
    const [c0, c1] = cross(z);
    if (c1 <= c0) continue;
    for (let k0 = 0; k0 < n; k0++) {
      if (!inc[k0] || (k0 && inc[k0 - 1])) continue;
      let k1 = k0; while (k1 + 1 < n && inc[k1 + 1]) k1++;
      const s0 = Math.min(a0 + dir * 10 * k0, a0 + dir * 10 * (k1 + 1)), s1 = Math.max(a0 + dir * 10 * k0, a0 + dir * 10 * (k1 + 1));
      // running bond: joints every 20 from the stair's top edge, offset 10 on odd courses
      for (let b = Math.floor((s0 - a0 - (c % 2) * 10) / 20) * 20 + a0 + (c % 2) * 10; b < s1; b += 20) {
        const p = Math.max(s0, b), q = Math.min(s1, b + 20);
        if (q - p < 2) continue;
        const g = base(c0, c1, p, q, z + 10);
        if (z + 10 <= g) continue;
        const zb = Math.max(z, g + (g % 2 + 2) % 2);
        const qx = axis === 'v' ? { u0: c0, u1: c1, v0: p, v1: q } : { u0: p, u1: q, v0: c0, v1: c1 };
        if (inVoid({ ...qx, z0: zb, z1: z + 10 })) continue;
        ubox(qx.u0, qx.v0, zb, qx.u1, qx.v1, z + 10, clay(key, p, z), label);
      }
    }
  }
}
const groundV = (c0, c1, p, q, below) => gTop(c0, p, c1, q, below);   // axis v: cross = u
const groundU = (c0, c1, p, q, below) => gTop(p, c0, q, c1, below);   // axis u: cross = v
const floorAt = z => () => z;
const faceV = z => halfAt(TIERS[0], Math.min(z, TIERS[0].zt - 10))[1]; // T1's north face at course z
const inCentral = (u, v) => Math.abs(u) < US.w + 12 && v > US_END && v < 460; // upper stair band through the tiers
const steps = [];
// central lower stair: north from v 440 (z 700) down to the ground
let csN = 0; while (csN < 60 && 700 - 10 * csN > gTop(-CS.w, CS.v0 + 10 * csN, CS.w, CS.v0 + 10 * csN + 10, 700 - 10 * csN) + 2) { steps.push(csN); csN++; }
coursed('v', CS.v0, +1, csN, 700, -10, () => [-CS.w, CS.w], groundV, 1);
for (const [c0, c1] of [[-CS.w - 12, -CS.w], [CS.w, CS.w + 12]]) coursed('v', CS.v0, +1, csN, 720, -10, () => [c0, c1], groundV, 2, 'cheek');
// landing where the three stairs meet: from the battered face out to v 440, courses up to z 700
for (let z = Math.floor(gTop(LAND.u0, LAND.v0, LAND.u1, LAND.v1, 700) / 10) * 10, c = 0; z < 700; z += 10, c++) {
  // v LAND.v0..v1 across the whole landing; between the face and LAND.v0 only beside the upper stair's band
  const v0 = faceV(z), UB = US.w + 12;
  for (const [ua, ub, va] of [[LAND.u0, LAND.u1, LAND.v0], [LAND.u0, -UB, v0], [UB, LAND.u1, v0]]) {
    const vb = va === LAND.v0 ? LAND.v1 : LAND.v0;
    if (vb <= va) continue;
    for (let b = ua - (c % 2) * 10; b < ub; b += 20) { const p = Math.max(ua, b), q = Math.min(ub, b + 20); if (q - p < 2) continue;
      const g = gTop(p, va, q, vb, z + 10); if (z + 10 <= g) continue;
      ubox(p, va, Math.max(z, g + (g % 2 + 2) % 2), q, vb, z + 10, clay(3, p, z), 'landing'); }
  }
}
// side stairs climbing along the face toward the landing; each course reaches back to the face
for (const sg of [-1, 1]) {
  let n = 0; while (n < 60 && 700 - 10 * n > gTop(sg < 0 ? -(SS.u0 + 10 * n + 10) : SS.u0 + 10 * n, SS.v0, sg < 0 ? -(SS.u0 + 10 * n) : SS.u0 + 10 * n + 10, SS.v1, 700 - 10 * n) + 2) n++;
  coursed('u', sg * SS.u0, sg, n, 700, -10, z => [faceV(z), SS.v1], groundU, 4, 'sidestair');
  coursed('u', sg * SS.u0, sg, n, 720, -10, () => [SS.v1, SS.v1 + 12], groundU, 5, 'cheek');
}
// upper stair: from the landing south up to the shrine door (rise 10, run 10), through the gatehouse
const usN = (TIERS[2].zt - 700) / 10;
const US_END = LAND.v0 - 10 * usN; // v where the stair arrives at the summit (z 1000)
coursed('v', LAND.v0, -1, usN, 710, 10, () => [-US.w, US.w], groundV, 6, 'ustair');
for (const [c0, c1] of [[-US.w - 12, -US.w], [US.w, US.w + 12]]) coursed('v', LAND.v0, -1, usN, 730, 10, () => [c0, c1], groundV, 7, 'cheek');
ubox(-US.w - 12, ROOMS.SHR.v1 + 12, TIERS[2].zt - 10, US.w + 12, US_END, TIERS[2].zt, clay(5, 5), 'apron'); // apron to the door

// ---------------------------------------------------------------- tiers: cores, battered courses, pilasters
// core columns on one grid, split at every void edge, inside each tier's top rectangle inset 8
const uEdges = [], vEdges = [];
for (const t of TIERS) { const [a, b] = topHalf(t); uEdges.push(-a + 8, a - 8); vEdges.push(-b + 8, b - 8); }
for (const r of voids.map(carveOf)) uEdges.push(r.u0, r.u1), vEdges.push(r.v0, r.v1);
uEdges.push(-US.w - 12, US.w + 12); vEdges.push(60);
const cuts = (lo, hi, extra) => [...new Set([lo, hi, ...extra.filter(c => c > lo && c < hi), ...Array.from({ length: 40 }, (_, k) => -800 + k * 40).filter(c => c > lo && c < hi)])].sort((a, b) => a - b);
const [cu0, cv0] = topHalf(TIERS[0]);
const us = cuts(-cu0 + 8, cu0 - 8, uEdges), vs = cuts(-cv0 + 8, cv0 - 8, vEdges);
for (let a = 0; a < us.length - 1; a++) for (let b = 0; b < vs.length - 1; b++) {
  const u = us[a], u1 = us[a + 1], v = vs[b], v1 = vs[b + 1], mu = (u + u1) / 2, mv = (v + v1) / 2;
  if (inCentral(mu, mv)) continue;
  let top = 0, ti = -1;
  TIERS.forEach((t, i) => { const [hu, hv] = topHalf(t); if (Math.abs(mu) < hu - 8 && Math.abs(mv) < hv - 8) { top = t.zt; ti = i; } });
  if (ti < 0) continue;
  for (const [z0, z1] of minusVoids(u, v, u1, v1, gTop(u, v, u1, v1, GROUND_MAX + 1), top))
    mass(u, v, z0, u1, v1, z1, { color: z1 === top ? SAND[Math.floor(hash(u, v, ti) * 3)].map(c => c - 22) : CORE }, 'core');
}
// courses: per course a ring of flush bricks (8 deep) at the battered edge, filler between it and the core
const PIL = 40, PIL_STEP = 120, PIL_OUT = 8;
TIERS.forEach((t, ti) => {
  const [chu, chv] = topHalf(t), coreU = chu - 8, coreV = chv - 8;
  for (let z = t.zb, c = 0; z < t.zt; z += 10, c++) {
    const [hu, hv] = halfAt(t, z), z1 = z + 10;
    // north + south faces span the full width, east + west between them
    // corners interlock (owner: "bricks aren't meshing together"): the N/S courses take the corner on
    // even courses, the E/W ones on odd courses
    const ns = c % 2 ? 8 : 0, ew = c % 2 ? 0 : 8;
    const sides = [['v', hv, -hu + ns, hu - ns, +1], ['v', -hv, -hu + ns, hu - ns, -1], ['u', hu, -hv + ew, hv - ew, +1], ['u', -hu, -hv + ew, hv - ew, -1]];
    for (const [axis, at, a0, a1, dir] of sides) {
      const P = (a, d) => axis === 'u' ? [at - dir * d, a] : [a, at - dir * d];
      const put = (aa0, aa1, d0, d1, m, label) => { const [p0, q0] = P(aa0, d0), [p1, q1] = P(aa1, d1);
        const q = { u0: Math.min(p0, p1), u1: Math.max(p0, p1), v0: Math.min(q0, q1), v1: Math.max(q0, q1), z0: z, z1 };
        if (inVoid(q)) return false;
        if (z1 <= gTop(q.u0, q.v0, q.u1, q.v1, z1) ) return false;
        return ubox(q.u0, q.v0, z, q.u1, q.v1, z1, m, label); };
      // filler (hidden) from the ring back to the core, in 40-long pieces
      const coreAt = axis === 'u' ? coreU : coreV, depth = Math.abs(at) - coreAt - 8;
      // N/S fillers span only the core's width; E/W fillers take the corners (no overlaps)
      const fa0 = axis === 'v' ? -coreU : -hv + 8, fa1 = axis === 'v' ? coreU : hv - 8;
      if (depth > 0) for (let a = fa0; a < fa1; a += 40) put(a, Math.min(fa1, a + 40), 8, 8 + depth, { color: CORE }, 'filler');
      // the course: 20-long flush bricks, running bond
      for (let a = a0 - (c % 2) * 10; a < a1; a += 20) {
        const s = Math.max(a0, a), e = Math.min(a1, a + 20);
        if (e - s < 2) continue;
        const r = hash(ti, axis === 'u' ? 1 : 2, Math.sign(at), a, z);
        void r; put(s, e, 0, 8, clay(ti, at, a, z), 'brick');
      }
      // pilasters: buttress strips standing 8 proud, every 120 along the face (not over the stairs)
      for (let pc = a0 + 70; pc + PIL / 2 < a1 - 50; pc += PIL_STEP) {
        if (axis === 'v' && dir > 0 && Math.abs(pc) < 160) continue;
        for (let a = pc - PIL / 2 - (c % 2) * 10; a < pc + PIL / 2; a += 20) {
          const s = Math.max(pc - PIL / 2, a), e = Math.min(pc + PIL / 2, a + 20);
          if (e - s >= 2) put(s, e, -PIL_OUT, 0, clay(ti, pc, a, z, 9), 'pilaster');
        }
      }
    }
  }
});

// ---------------------------------------------------------------- flush brick faces for the rooms
function face(axis, at, A0, A1, zb, zt, dir, { skip = () => false, key = 0, shadeZ = null, corner = 0 } = {}) {
  skip ??= () => false;
  const P = (a, d) => axis === 'u' ? [at - dir * d, a] : [a, at - dir * d];
  // corner: +8 = this face reaches over the corners on even courses, -8 = on odd courses (interlocking)
  for (let z = zb, c = 0; z < zt; z += 10, c++) for (let a0 = A0 + (corner && ((c % 2 === 0) !== (corner > 0)) ? 8 : 0), a1 = A1 - (corner && ((c % 2 === 0) !== (corner > 0)) ? 8 : 0), a = a0 - (c % 2) * 10; a < a1; a += 20) {
    const s = Math.max(a0, a), e = Math.min(a1, a + 20);
    if (e - s < 2 || skip((s + e) / 2, z + 5) || skip(s + 1, z + 5) || skip(e - 1, z + 5)) continue;
    const [p0, q0] = P(s, 0), [p1, q1] = P(e, 8), r = hash(key, at, a, z);
    let col = clayC(key, at, a, z); if (shadeZ) col = shade(col, shadeZ(z + 5));
    ubox(p0, q0, z, p1, q1, Math.min(zt, z + 10), { color: col }, 'wall');
    void r;
  }
}
function roomFaces(r, o = {}, key = 20) {
  face('v', r.v1, r.u0 - 8, r.u1 + 8, r.z0, r.z1, -1, { skip: o.N, key: key + 1, shadeZ: o.shadeZ, corner: 8 });
  face('v', r.v0, r.u0 - 8, r.u1 + 8, r.z0, r.z1, +1, { skip: o.S, key: key + 2, shadeZ: o.shadeZ, corner: 8 });
  face('u', r.u1, r.v0 - 8, r.v1 + 8, r.z0, r.z1, -1, { skip: o.E, key: key + 3, shadeZ: o.shadeZ, corner: -8 });
  face('u', r.u0, r.v0 - 8, r.v1 + 8, r.z0, r.z1, +1, { skip: o.W, key: key + 4, shadeZ: o.shadeZ, corner: -8 });
}
const hole = (a0, a1, z0, z1) => (a, z) => a > a0 && a < a1 && z > z0 && z < z1;
const corbel = (c, w, z0, zs) => (a, z) => { if (z < z0) return false; const half = w / 2 - (z >= zs ? (Math.floor((z - zs) / 10) + 1) * 4 : 0); return half > 0 && Math.abs(a - c) < half; };
const R = ROOMS;
roomFaces(R.WELL, { W: hole(R.C1.v0, R.C1.v1, R.C1.z0 - 1, R.C1.z1) }, 10);
roomFaces(R.C1, { E: () => true, W: () => true }, 12);
roomFaces(R.ANT, { E: hole(R.C1.v0, R.C1.v1, R.C1.z0 - 1, R.C1.z1), N: () => false, W: (a, z) => false, S: hole(R.S2.u0, R.S2.u1, 0, 2000) }, 14);
roomFaces({ ...R.HALL, z0: F }, { E: hole(R.C3.v0, R.C3.v1, F - 1, R.C3.z1) }, 16);
roomFaces(R.PIT, { shadeZ: pitShade }, 18);
roomFaces(R.C3, { E: () => true, W: () => true }, 22);
roomFaces(R.SAN, { W: hole(R.C3.v0, R.C3.v1, F - 1, R.C3.z1), S: hole(R.E1.u0, R.E1.u1, 0, 2000) }, 24);
roomFaces(R.E1, { N: () => true, S: () => true }, 26);
roomFaces(R.E2, { N: () => true, S: () => true }, 28);
// floors: flush sandstone slabs (no joints)
const floor = (r, z, skipF) => { for (let u = r.u0; u < r.u1; u += 40) for (let v = r.v0; v < r.v1; v += 40) if (!skipF?.(u + 20, v + 20)) ubox(u, v, z - 4, Math.min(r.u1, u + 40), Math.min(r.v1, v + 40), z, sand(u, v, z), 'floor'); };
floor(R.ANT, 760, (u, v) => inRect(R.S2, u, v)); floor(R.C1, 760); floor(R.C3, F); floor(R.SAN, F); floor(R.E2, 360);
floor({ ...R.HALL }, F, (u, v) => inRect(R.PIT, u, v) || inRect(R.S2, u, v));
floor(R.WELL, 760);
// shrine: floor over the stairwell except flight A's opening
const FA = { u0: -60, u1: -8 }, FB = { u0: 8, u1: 60 }; // flush on the stairwell walls
for (let u = R.WELL.u0; u < R.WELL.u1; u += 20) for (let v = R.WELL.v0; v < R.WELL.v1; v += 20) {
  if (u >= FA.u0 - 4 && u < FA.u1 && v >= -64 && v < 64) continue;
  ubox(u, v, 996, Math.min(R.WELL.u1, u + 20), Math.min(R.WELL.v1, v + 20), 1000, sand(u, v, 1000), 'floor');
}

// ---------------------------------------------------------------- the switchback stairwell
coursed('v', 64, -1, 12, 990, -10, () => [FA.u0, FA.u1], floorAt(R.WELL.z0), 31, 'flightA');   // 1000 -> 880 going south
coursed('v', -56, -1, 7, 880, 0, () => [-60, 60], floorAt(R.WELL.z0), 32, 'wlanding');            // south landing (v -56..-126)
coursed('v', -56, +1, 12, 870, -10, () => [FB.u0, FB.u1], floorAt(R.WELL.z0), 33, 'flightB');   // 880 -> 760 going north
coursed('v', -56, +1, 12, 990, 0, () => [-8, 8], floorAt(R.WELL.z0), 34, 'spine');
// stair S2 down the hall's west wall: 760 -> 544
coursed('v', R.S2.v1, -1, 22, 750, -10, () => [R.S2.u0, R.S2.u1], floorAt(F), 35, 'stairS2'); // 760 -> 540 going south
// exit stair E1: 540 -> 360 going south, then E2 flat out
coursed('v', R.E1.v1, -1, 18, F - 10, -10, () => [R.E1.u0, R.E1.u1], floorAt(R.E1.z0 - 4), 36, 'stairE'); // 540 -> 360 going south

// ---------------------------------------------------------------- the trap hall: 5x5 jump tiles over the spikes
const TILE = 14, PITCH = 80, GU0 = -190, GV0 = -250;
const tiles = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
  const u = GU0 + c * PITCH, v = GV0 + r * PITCH, trap = hash(r, c, 77) < 0.36 && !(r === 2 && c === 0);
  for (let z = R.PIT.z0; z < F - 16; z += 20) ubox(u - TILE + 2, v - TILE + 2, z, u + TILE - 2, v + TILE - 2, Math.min(F - 16, z + 20), { color: shade(clayC(u, v, z), pitShade(z + 10)) }, 'tilepillar');
  { const pc = { color: shade(clayC(u, v, F), pitShade(F - 10)) }, a = TILE - 2; // the ring round the chip pocket (12 x 12 x 12)
    ubox(u - a, v - a, F - 16, u - 6, v + a, F - 4, pc, 'tilepillar'); ubox(u + 6, v - a, F - 16, u + a, v + a, F - 4, pc, 'tilepillar');
    ubox(u - 6, v - a, F - 16, u + 6, v - 6, F - 4, pc, 'tilepillar'); ubox(u - 6, v + 6, F - 16, u + 6, v + a, F - 4, pc, 'tilepillar'); }
  ubox(u - TILE, v - TILE, F - 4, u + TILE, v + TILE, F, { color: SAND[(r + c) % 3], ...(trap ? { trap: { r, c } } : {}) }, trap ? 'traptile' : 'tile');
  tiles.push({ r, c, u, v, trap });
}
const nearTile = (u, v) => tiles.some(t => Math.abs(u - t.u) < TILE + 2 && Math.abs(v - t.v) < TILE + 2);
for (let u = R.PIT.u0 + 2; u < R.PIT.u1 - 10; u += 14) for (let v = R.PIT.v0 + 2; v < R.PIT.v1 - 10; v += 14)
  if (!nearTile(u + 5, v + 5)) ubox(u, v, R.PIT.z0, u + 10, v + 10, R.PIT.z0 + 10, { asset: 'PB_Spike', color: [40, 38, 36], spike: true }, 'spike');
ubox(R.PIT.u0, R.PIT.v0, R.PIT.z0 - 4, R.PIT.u1, R.PIT.v1, R.PIT.z0, { color: [10, 8, 8] }, 'pitfloor');
// darts: per row in the west + east walls, per column in the north + south walls (DARTS, above)
for (const d of DARTS) ubox(d.u - (d.du ? (d.du > 0 ? 0 : 4) : 2), d.v - (d.dv ? (d.dv > 0 ? 0 : 4) : 2), DZ, d.u + (d.du ? (d.du > 0 ? 4 : 0) : 2), d.v + (d.dv ? (d.dv > 0 ? 4 : 0) : 2), DZ + 4,
  { color: [20, 16, 14], dart: d }, 'dart');

// ---------------------------------------------------------------- sanctum: THE STASH
const PU = 320, PV = 0;
ubox(PU - 24, PV - 24, F, PU + 24, PV + 24, F + 12, clay(1, 2, 3), 'pedestal');
ubox(PU - 14, PV - 14, F + 12, PU + 14, PV + 14, F + 44, sand(0, PV), 'pedestal');
ubox(PU - 18, PV - 18, F + 44, PU + 18, PV + 18, F + 48, sand(1, PV), 'pedestal');
ubox(PU - 10, PV - 8, F + 48, PU + 10, PV + 8, F + 62, { color: [90, 220, 60], material: 'BMC_Glow', stash: true }, 'stash');
ubox(PU - 4, PV - 2, F + 62, PU + 4, PV + 2, F + 70, { color: [140, 110, 70] }, 'stashknot');

// ---------------------------------------------------------------- torches (point lights)
const LIGHT = { bMatchBrickShape: false, bEnabled: true, Brightness: 6, Radius: 420, Color: { R: 255, G: 150, B: 70, A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 };
// a wall torch on face (axis, at, dir toward the room) at (a, z)
const torch = (axis, at, dir, a, z) => {
  const P = (aa, d) => axis === 'u' ? [at + dir * d, aa] : [aa, at + dir * d];
  const put = (a0, a1, d0, d1, z0, z1, m, l) => { const [p0, q0] = P(a0, d0), [p1, q1] = P(a1, d1); return ubox(p0, q0, z0, p1, q1, z1, m, l); };
  if (!put(a - 2, a + 2, 0, 8, z - 12, z, { color: [60, 44, 30] }, 'sconce')) return;
  put(a - 4, a + 4, 4, 12, z, z + 4, { color: [60, 44, 30] }, 'sconce');
  put(a - 3, a + 3, 5, 11, z + 4, z + 12, { color: [255, 150, 50], material: 'BMC_Glow', light: true }, 'flame');
};
const roomTorches = (r, zt, every = 120) => {
  for (let a = r.u0 + 40; a < r.u1 - 20; a += every) { torch('v', r.v1, -1, a, zt); torch('v', r.v0, +1, a, zt); }
  for (let a = r.v0 + 40; a < r.v1 - 20; a += every) { torch('u', r.u1, -1, a, zt); torch('u', r.u0, +1, a, zt); }
};
roomTorches(R.SHR, 1060, 80); roomTorches(R.C1, 820, 80); roomTorches(R.ANT, 820, 90); roomTorches(R.HALL, 640, 110);
roomTorches(R.SAN, 630, 80); roomTorches(R.WELL, 940, 100); roomTorches(R.WELL, 820, 100); roomTorches(R.E2, 430, 80); roomTorches(R.C3, 610, 40);

// ---------------------------------------------------------------- shrine on top (crenellated) + gatehouse
const SH = { u0: -100, u1: 100, v0: -80, v1: 80, zb: 1000, zt: 1140 };
const DOOR = corbel(0, 56, SH.zb, SH.zb + 60);
const shrineWall = (axis, at, a0, a1, dir, skip) => { for (let z = SH.zb, c = 0; z < SH.zt; z += 10, c++) for (let a = a0 - (c % 2) * 10; a < a1; a += 20) {
  const s = Math.max(a0, a), e = Math.min(a1, a + 20); if (e - s < 2 || skip?.((s + e) / 2, z + 5) || skip?.(s + 1, z + 5) || skip?.(e - 1, z + 5)) continue;
  const p = axis === 'u' ? [[at - dir * 12, s], [at, e]] : [[s, at - dir * 12], [e, at]];
  ubox(p[0][0], p[0][1], z, p[1][0], p[1][1], z + 10, clay(at, a, z, 41), 'shrine'); } };
shrineWall('v', SH.v1, SH.u0, SH.u1, +1, DOOR); shrineWall('v', SH.v0, SH.u0, SH.u1, -1);
shrineWall('u', SH.u1, SH.v0 + 12, SH.v1 - 12, +1); shrineWall('u', SH.u0, SH.v0 + 12, SH.v1 - 12, -1);
ubox(SH.u0 + 12, SH.v0 + 12, R.SHR.z1, SH.u1 - 12, SH.v1 - 12, R.SHR.z1 + 8, clay(9, 9), 'shrineroof');
ubox(SH.u0 + 12, SH.v0 + 12, R.SHR.z1 + 8, SH.u1 - 12, SH.v1 - 12, SH.zt, { color: CORE }, 'shrineroof');
// merlons all round the top
for (const [axis, at, a0, a1, dir] of [['v', SH.v1, SH.u0, SH.u1, 1], ['v', SH.v0, SH.u0, SH.u1, -1], ['u', SH.u1, SH.v0 + 12, SH.v1 - 12, 1], ['u', SH.u0, SH.v0 + 12, SH.v1 - 12, -1]])
  for (let a = a0; a + 20 <= a1; a += 40) { const p = axis === 'u' ? [[at - dir * 12, a], [at, a + 20]] : [[a, at - dir * 12], [a + 20, at]]; ubox(p[0][0], p[0][1], SH.zt, p[1][0], p[1][1], SH.zt + 24, clay(at, a, 43), 'merlon'); }
torch('v', SH.v1, +1, -50, SH.zb + 70); torch('v', SH.v1, +1, 50, SH.zb + 70);
// gatehouse on the second tier: two towers flanking the upper stair, a corbelled arch between
const gv0 = topHalf(TIERS[1])[1] - 60, gv1 = topHalf(TIERS[1])[1];
for (const sg of [-1, 1]) {
  const u0 = sg < 0 ? -US.w - 12 - 50 : US.w + 12, u1 = u0 + 50, zb = TIERS[1].zt;
  for (let z = zb, c = 0; z < zb + 150; z += 10, c++) for (const [axis, at, a0, a1, dir] of [['v', gv1, u0, u1, 1], ['v', gv0, u0, u1, -1], ['u', u1, gv0 + 8, gv1 - 8, 1], ['u', u0, gv0 + 8, gv1 - 8, -1]])
    for (let a = a0 - (c % 2) * 10; a < a1; a += 20) { const s = Math.max(a0, a), e = Math.min(a1, a + 20); if (e - s < 2) continue;
      const p = axis === 'u' ? [[at - dir * 8, s], [at, e]] : [[s, at - dir * 8], [e, at]]; ubox(p[0][0], p[0][1], z, p[1][0], p[1][1], z + 10, clay(at, a, z, 51), 'tower'); }
  solid(u0 + 8, gv0 + 8, zb, u1 - 8, gv1 - 8, zb + 150, { color: CORE }, 'towercore');
  for (let k = 0; k < 2; k++) ubox(u0 + k * 30, gv0, zb + 150, u0 + k * 30 + 20, gv1, zb + 172, clay(u0, k, 53), 'merlon');
  torch('v', gv1, +1, (u0 + u1) / 2, zb + 60);
}
for (let k = 0; k < 6; k++) { const d = Math.min(US.w + 12, 8 + k * 10); ubox(-US.w - 12, gv0, TIERS[1].zt + 100 + k * 10, -US.w - 12 + d, gv1, TIERS[1].zt + 110 + k * 10, clay(k, 61), 'arch'); ubox(US.w + 12 - d, gv0, TIERS[1].zt + 100 + k * 10, US.w + 12, gv1, TIERS[1].zt + 110 + k * 10, clay(k, 62), 'arch'); }
ubox(-US.w - 12, gv0, TIERS[1].zt + 160, US.w + 12, gv1, TIERS[1].zt + 172, clay(9, 63), 'arch');

// ---------------------------------------------------------------- bas-reliefs
const GLYPH = {
  sun: ['....##....', '.#..##..#.', '..######..', '.##....##.', '###.##.###', '###.##.###', '.##....##.', '..######..', '.#..##..#.', '....##....'],
  eye: ['..........', '...####...', '.##....##.', '#...##...#', '#..####..#', '#..####..#', '#...##...#', '.##....##.', '...####...', '..........'],
  serpent: ['......###.', '.....#.#.#', '.....####.', '....##....', '...##.....', '..##...##.', '.##...##..', '.##..##...', '..####....', '...##.....'],
  frog: ['.##....##.', '#..#..#..#', '.######...', '##########', '#.#....#.#', '##########', '.########.', '..#....#..', '.##....##.', '##......##'],
  grip: ['.##.......', '#..#......', '#..#......', '.##.#.....', '....##....', '.....###..', '....#..##.', '...#....##', '..#......#', '..........'],
};
function relief(axis, at, dir, a, z, glyph, px = 4) {
  const H = px * 5 + 2;
  const P = (aa, d) => axis === 'u' ? [at + dir * d, aa] : [aa, at + dir * d];
  const put = (a0, a1, d0, d1, z0, z1, m, l) => { const [u0, v0] = P(a0, d0), [u1, v1] = P(a1, d1); return ubox(u0, v0, z0, u1, v1, z1, m, l); };
  if (!put(a - H, a + H, 0, 2, z - H, z + H, sand(a, z, at), 'panel')) return;
  const g = GLYPH[glyph], flip = (axis === 'v') === (dir > 0);
  g.forEach((row, ry) => { let run = -1; for (let k = 0; k <= 10; k++) { const on = k < 10 && row[flip ? 9 - k : k] === '#'; if (on && run < 0) run = k;
    if (!on && run >= 0) { put(a - px * 5 + run * px, a - px * 5 + k * px, 2, 4, z + px * 4 - ry * px, z + px * 5 - ry * px, { color: [160, 140, 102] }, 'glyph'); run = -1; } } });
}
relief('v', R.ANT.v0, +1, -230, 810, 'serpent', 6); relief('v', R.ANT.v0, +1, -130, 810, 'sun', 6);
relief('u', R.ANT.u1, -1, 40, 810, 'frog', 6); relief('v', R.SAN.v1, -1, 320, 620, 'grip', 8);
relief('u', R.SAN.u1, -1, -60, 610, 'eye', 6); relief('u', R.SAN.u1, -1, 60, 610, 'grip', 6);
relief('v', R.SHR.v0, +1, 0, 1060, 'grip', 6);

// ---------------------------------------------------------------- ferns (the fern brick) on ledges and stairs
let ferns = 0;
const fern = (u, v, z) => { if (B.add({ asset: 'B_Fern', size: [0, 0, 0], position: [X(u), Y(v), z + 2], color: [70, 120, 50], rotation: Math.floor(hash(u, v) * 4), direction: 4 }, 'fern')) ferns++; };
TIERS.forEach((t, ti) => {
  const [hu, hv] = topHalf(t), next = TIERS[ti + 1];
  for (let a = -hu + 20; a < hu - 20; a += 26) for (const v of [hv - 12, -hv + 12]) if (hash(a, v, ti) < 0.4) fern(a, v, t.zt);
  for (let a = -hv + 20; a < hv - 20; a += 26) for (const u of [hu - 12, -hu + 12]) if (hash(a, u, ti, 1) < 0.4) fern(u, a, t.zt);
  void next;
});
for (const s of steps) if (hash(s, 5) < 0.3) fern(CS.w + 6, CS.v0 + 10 * s + 5, 700 - 10 * s + 20);
for (const [u, v] of [[-290, -50], [-90, -50], [-290, 130], [-95, 128]]) fern(u, v, 760);

// ---------------------------------------------------------------- plaque at the shrine door
plaque({ put: (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'plaque'), text: 'TEMPLE OF THE STASH\nNO STEALING. SIGNED, GARY\nP.S. THE BOULDER IS DECORATIVE',
  facing: [0, 1], x: X(-62), y: Y(SH.v1) + 1, z: SH.zb + 40, w: 22, h: 14, color: [96, 76, 52], style: { LineHeight: 1.6 } });

// ---------------------------------------------------------------- write the prefab (+ wires) and the jobs
const dropped = B.dropped.filter(d => !d.startsWith('terrain'));
const byLabel = {}; for (const d of dropped) { const l = d.split(' ')[0] + (/ hits terrain /.test(d) ? '>terrain' : ''); byLabel[l] = (byLabel[l] ?? 0) + 1; }
const mine = B.bricks.slice(nObst).filter(b => b.label !== 'pocket');
console.error(`${mine.length} temple bricks; dropped ${JSON.stringify(byLabel)}; ferns ${ferns}; trap tiles ${mine.filter(b => b.trap).length}; darts ${mine.filter(b => b.dart).length}; spikes ${mine.filter(b => b.spike).length}; lights ${mine.filter(b => b.light).length}; clear ${CLEAR.length} props + ${liveClear.length} bushes`);
if (process.env.TEMPLE_DEBUG) for (const d of dropped) if (new RegExp(process.env.TEMPLE_DEBUG).test(d)) console.error(d.slice(0, 220));

const EXT = [...EXTERNAL_ASSETS, { type: 'BRWeaponProjectile', name: 'Projectile_Bow_Charged' }];
const PROJ = EXT.length - 1;
const w = new lib.World();
const o = w.addOwner(OWNER);
const NOCOLL = { player: false, weapon: false, interaction: false, tool: true, physics: false };
const zones = [], darts = [];
for (const brick of mine) {
  const { label, obstacle, trap, dart, spike, stash, light, ...b } = brick;
  const comps = [...(b.components ?? [])];
  if (spike) comps.push({ type: COMP.Damage.NAME, data: { Damage: 100000, RepeatDelay: 0.2, Message: '', ConsoleTag: '' } });
  if (trap) comps.push({ type: COMP.AttachedZone.NAME, data: { ZoneStartDistance: 0, ZoneEndDistance: 60, bIsBuildingZone: false, bIsLooseZone: false, bIsShareZone: false, bWater: false,
    bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true, bDetectEntities: false, bDetectProjectiles: false, TagFilter: '', ZoneWindForce: 0 } });
  if (dart) comps.push({ type: COMP.ProjectileSpawner.NAME, data: { ProjectileClass: PROJ, FireSound: null, Direction: dart.dir, SpawnLocation: 0, SpawnMargin: 5, SpawnOffsetBias: 0, bEnabled: false,
    NumberOfShots: 1, SpreadConeAngle: 2, bSpreadBiasedTowardsCenter: true, FireRate: 2, bEnforceFireRate: true, DamageMultiplier: 0.35, SpeedMultiplier: 1, ScaleMultiplier: 1 } });
  if (light) comps.push({ type: COMP.PointLight.NAME, data: LIGHT });
  if (stash) comps.push({ type: 'Component_Interact', data: { InteractSound: null, Message: '', ConsoleTag: 'event:quest:stash', bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Grab THE STASH' } });
  const h = w.addBrick({ ...b, position: [b.position[0] - CX, b.position[1] - CY, b.position[2] - ZOFF], owner_index: o, components: comps });
  if (trap) zones.push({ trap, h, c: COMP.AttachedZone });
  if (dart) darts.push({ dart, h, c: COMP.ProjectileSpawner });
  void label;
}
// every trap tile / dart has its own invisible microchip (house rule: chips invisible, no collision) in its
// pocket; the tile's chip sends 'temple.trap' (row, column, 1 on / 0 off) on the zone's edges, every
// dart's chip keeps an on/off Var for its row (or column) and drives bEnabled. All wires stay inside
// the bricks round the pocket.
const f64 = v => ({ $variant: 'f64', value: v });
const EVENT_SIZE = [10, 5, 2];
const DATA8 = (pre, set) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(k => [pre + k, f64(set[k] ?? 0)]));
const chipAt = (x, y, z) => {
  const brick = w.addBrick({ asset: 'B_1x1_Microchip', position: [x - CX, y - CY, z - ZOFF], owner_index: o, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
  w.registerMicrochipLink(brick, grid);
  let n = 0;
  const g = (c, data = {}, extra = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [(n % 6) * 40, Math.floor(n++ / 6) * 40, 2], color: [200, 200, 200], owner_index: o, components: [{ type: c.NAME, data }], ...extra }, grid), c });
  return g;
};
const wire = (a, ap, b, bp) => { if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw new Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`); w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] }); };
for (const z of zones) {
  const t = tiles.find(q => q.r === z.trap.r && q.c === z.trap.c);
  const g = chipAt(X(t.u), Y(t.v), F - 10);
  const edge = g(COMP.Expr_EdgeDetectorExec);
  const on = g(COMP.Exec_SendCustomEventGlobal, { EventName: 'temple.trap', ...DATA8('DataIn', { 1: z.trap.r, 2: z.trap.c, 3: 1 }) }, { size: EVENT_SIZE });
  const off = g(COMP.Exec_SendCustomEventGlobal, { EventName: 'temple.trap', ...DATA8('DataIn', { 1: z.trap.r, 2: z.trap.c, 3: 0 }) }, { size: EVENT_SIZE });
  wire(z, 'bOccupied', edge, 'Input'); wire(edge, 'OnRisingEdge', on, 'ExecIn'); wire(edge, 'OnFallingEdge', off, 'ExecIn');
}
for (const d of darts) {
  const dd = d.dart;
  if (!zones.some(z => z.trap[dd.kind] === dd.i)) continue; // no trap tile in this row / column
  const g = chipAt(X(dd.cu), Y(dd.cv), DZ + 2);
  const ev = g(COMP.Event_CustomGlobal, { EventName: 'temple.trap', bIsObjectEvent: false, ...DATA8('DataOut', {}) }, { size: EVENT_SIZE });
  const mine = g(COMP.Expr_CompareEqual, { InputA: f64(-1), InputB: f64(dd.i) });
  const br = g(COMP.Exec_Branch);
  const st = g(COMP.Var, { Value: f64(0) });
  const set = g(COMP.Exec_Var_Set);
  const onOff = g(COMP.Expr_CompareGreater, { InputA: f64(0), InputB: f64(0.5) });
  wire(ev, dd.kind === 'r' ? 'DataOut1' : 'DataOut2', mine, 'InputA');
  wire(ev, 'ExecOut', br, 'Exec'); wire(mine, 'bOutput', br, 'bCond');
  wire(st, 'VarRef', set, 'VarRef'); wire(ev, 'DataOut3', set, 'Value'); wire(br, 'ExecOutA', set, 'Exec');
  wire(st, 'Value', onOff, 'InputA'); wire(onOff, 'bOutput', d, 'bEnabled');
}
w.makePrefab({});
writeFileSync(`${outDir}/temple.brz`, w.toBrz({ bundle: { description: 'Temple of the Stash' }, externalAssets: EXT }));
const clearLines = [...liveClear, ...CLEAR.map(([lo, hi]) => `br.World.ClearRegion ${(lo[0] + hi[0]) / 2} ${(lo[1] + hi[1]) / 2} ${(lo[2] + hi[2]) / 2} ${(hi[0] - lo[0]) / 2 + 1} ${(hi[1] - lo[1]) / 2 + 1} ${(hi[2] - lo[2]) / 2 + 1}`)];
for (let k = 0; k * 300 < clearLines.length; k++)
  writeFileSync(`${outDir}/temple_clear${k}.json`, JSON.stringify({ ops: clearLines.slice(k * 300, k * 300 + 300).map(line => ({ op: 'cmd', line, captureMs: 120 })) }));
writeFileSync(`${outDir}/temple_load.json`, JSON.stringify({ ops: [{ op: 'cmd', line: `br.Prefab.Load "temple" ${CX} ${CY} ${ZOFF} 0 16`, captureMs: 8000 }] }));
writeFileSync(`${outDir}/temple_preview.json`, JSON.stringify([
  ...B.bricks.slice(0, nObst).map(({ obstacle, label, ...b }) => ({ ...b, color: [74, 70, 62] })),
  ...mine.map(({ label, obstacle, trap, dart, spike, stash, light, ...b }) => b)]));
