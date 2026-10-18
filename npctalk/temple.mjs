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
  WELL: { u0: -60, u1: 60, v0: -124, v1: 140, z0: 760, z1: 996 },     // switchback stairwell under the shrine
  SHR: { u0: -88, u1: 88, v0: -68, v1: 68, z0: 1000, z1: 1120 },      // the shrine room (the entrance)
  C1: { u0: -300, u1: -60, v0: 100, v1: 140, z0: 760, z1: 860 },      // corridor stairwell -> antechamber
  ANT: { u0: -300, u1: -80, v0: -60, v1: 140, z0: 760, z1: 860 },     // glyph antechamber
  S2: { u0: -300, u1: -240, v0: -70, v1: 130, z0: F, z1: 860 },       // stair down the hall's west wall
  HALL: { u0: -320, u1: 200, v0: -300, v1: 140, z0: F, z1: 690 },     // the trap hall (ledges + pit)
  PIT: { u0: -240, u1: 160, v0: -300, v1: 140, z0: 380, z1: F },      // its spike pit
  C3: { u0: 200, u1: 240, v0: -40, v1: 20, z0: F, z1: F + 100 },      // corridor hall -> sanctum
  SAN: { u0: 240, u1: 400, v0: -120, v1: 120, z0: F, z1: 690 },       // sanctum
  E1: { u0: 310, u1: 370, v0: -300, v1: -120, z0: 360, z1: 660 },     // exit stair down
  E2: { u0: 310, u1: 370, v0: -480, v1: -300, z0: 360, z1: 470 },     // exit tunnel out the south face
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

// ---------------------------------------------------------------- stairs first (the courses behind them get dropped)
const inCentral = (u, v) => Math.abs(u) < US.w + 12 && v > 60 && v < 460; // upper stair band through the tiers
const steps = [];
// central lower stair: north from v 440 (z 700) down to the ground
for (let s = 0; s < 60; s++) {
  const top = 700 - 12 * s, v0 = CS.v0 + 12 * s, v1 = v0 + 12;
  if (top <= gTop(-CS.w, v0, CS.w, v1, top) + 2) break;
  for (let u = -CS.w; u < CS.w; u += 40) { const g = gTop(u, v0, u + 40, v1, top); solid(u, v0, g, u + 40, v1, top - 2, { color: CORE }, 'stair'); ubox(u, v0, top - 2, u + 40, v1, top, sand(u, s), 'tread'); }
  for (const [c0, c1] of [[-CS.w - 12, -CS.w], [CS.w, CS.w + 12]]) { const g = gTop(c0, v0, c1, v1, top + 14); ubox(c0, v0, g, c1, v1, top + 14, clay(c0, s, 1), 'cheek'); }
  steps.push(s);
}
// landing where the three stairs meet
solid(LAND.u0, LAND.v0, gTop(LAND.u0, LAND.v0, LAND.u1, LAND.v1, 700), LAND.u1, LAND.v1, 698, { color: CORE }, 'landing');
for (let u = LAND.u0; u < LAND.u1; u += 40) ubox(u, LAND.v0, 698, u + 40, LAND.v1, 700, sand(u, 9), 'tread');
// side stairs climbing along the face toward the landing
for (const sg of [-1, 1]) for (let s = 0; s < 60; s++) {
  const top = 700 - 12 * s, a0 = SS.u0 + 12 * s, a1 = a0 + 12, u0 = sg < 0 ? -a1 : a0, u1 = sg < 0 ? -a0 : a1;
  const g = gTop(u0, SS.v0, u1, SS.v1, top);
  if (top <= g + 2) break;
  solid(u0, SS.v0, g, u1, SS.v1, top - 2, { color: CORE }, 'sidestair'); ubox(u0, SS.v0, top - 2, u1, SS.v1, top, sand(u0, s), 'tread');
  ubox(u0, SS.v1, gTop(u0, SS.v1, u1, SS.v1 + 12, top + 14), u1, SS.v1 + 12, top + 14, clay(u0, s, 2), 'cheek');
}
// upper stair: from the landing south up to the shrine door (rise 12, tread 12), through the gatehouse
let usTop = 700, usV = LAND.v0;
while (usTop < TIERS[2].zt) {
  const v1 = usV, v0 = usV - 12, top = usTop + 12;
  solid(-US.w, v0, gTop(-US.w, v0, US.w, v1, top), US.w, v1, top - 2, { color: CORE }, 'ustair');
  for (let u = -US.w; u < US.w; u += 50) ubox(u, v0, top - 2, u + 50, v1, top, sand(u, top), 'tread');
  for (const [c0, c1] of [[-US.w - 12, -US.w], [US.w, US.w + 12]]) solid(c0, v0, gTop(c0, v0, c1, v1, top), c1, v1, top + 14, clay(c0, top, 3), 'cheek');
  usTop = top; usV = v0;
}
const US_END = usV; // v where the stair arrives at the summit (z 1000)
ubox(-US.w - 12, ROOMS.SHR.v1 + 12, TIERS[2].zt - 2, US.w + 12, US_END, TIERS[2].zt, sand(5, 5), 'tread'); // apron to the door

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
    const sides = [['v', hv, -hu, hu, +1], ['v', -hv, -hu, hu, -1], ['u', hu, -hv + 8, hv - 8, +1], ['u', -hu, -hv + 8, hv - 8, -1]];
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
        put(s, e, r < 0.1 ? 2 : 0, 8, clay(ti, at, a, z), 'brick');
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
function face(axis, at, a0, a1, zb, zt, dir, { skip = () => false, key = 0, shadeZ = null } = {}) {
  skip ??= () => false;
  const P = (a, d) => axis === 'u' ? [at - dir * d, a] : [a, at - dir * d];
  for (let z = zb, c = 0; z < zt; z += 10, c++) for (let a = a0 - (c % 2) * 10; a < a1; a += 20) {
    const s = Math.max(a0, a), e = Math.min(a1, a + 20);
    if (e - s < 2 || skip((s + e) / 2, z + 5) || skip(s + 1, z + 5) || skip(e - 1, z + 5)) continue;
    const [p0, q0] = P(s, 0), [p1, q1] = P(e, 8), r = hash(key, at, a, z);
    let col = clayC(key, at, a, z); if (shadeZ) col = shade(col, shadeZ(z + 5));
    ubox(p0, q0, z, p1, q1, Math.min(zt, z + 10), { color: col }, 'wall');
    void r;
  }
}
function roomFaces(r, o = {}, key = 20) {
  face('v', r.v1, r.u0 - 8, r.u1 + 8, r.z0, r.z1, -1, { skip: o.N, key: key + 1, shadeZ: o.shadeZ });
  face('v', r.v0, r.u0 - 8, r.u1 + 8, r.z0, r.z1, +1, { skip: o.S, key: key + 2, shadeZ: o.shadeZ });
  face('u', r.u1, r.v0, r.v1, r.z0, r.z1, -1, { skip: o.E, key: key + 3, shadeZ: o.shadeZ });
  face('u', r.u0, r.v0, r.v1, r.z0, r.z1, +1, { skip: o.W, key: key + 4, shadeZ: o.shadeZ });
}
const hole = (a0, a1, z0, z1) => (a, z) => a > a0 && a < a1 && z > z0 && z < z1;
const corbel = (c, w, z0, zs) => (a, z) => { if (z < z0) return false; const half = w / 2 - (z >= zs ? (Math.floor((z - zs) / 10) + 1) * 4 : 0); return half > 0 && Math.abs(a - c) < half; };
const R = ROOMS;
roomFaces(R.WELL, { W: hole(R.C1.v0, R.C1.v1, R.C1.z0 - 1, R.C1.z1) }, 10);
roomFaces(R.C1, { E: () => true, W: () => true }, 12);
roomFaces(R.ANT, { E: hole(R.C1.v0, R.C1.v1, R.C1.z0 - 1, R.C1.z1), N: () => false, W: (a, z) => false, S: hole(R.S2.u0, R.S2.u1, 0, 2000) }, 14);
roomFaces({ ...R.HALL, z0: F }, { E: hole(R.C3.v0, R.C3.v1, F - 1, R.C3.z1), N: hole(R.S2.u0 - 8, R.S2.u1 + 8, F - 1, 2000) }, 16);
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
const FA = { u0: -56, u1: -8 }, FB = { u0: 8, u1: 56 };
for (let u = R.WELL.u0; u < R.WELL.u1; u += 20) for (let v = R.WELL.v0; v < R.WELL.v1; v += 20) {
  if (u >= FA.u0 - 4 && u < FA.u1 && v >= -64 && v < 64) continue;
  ubox(u, v, 996, Math.min(R.WELL.u1, u + 20), Math.min(R.WELL.v1, v + 20), 1000, sand(u, v, 1000), 'floor');
}

// ---------------------------------------------------------------- the switchback stairwell
const flight = (u0, u1, vStart, dirV, zTop, n, label) => { for (let s = 0; s < n; s++) {
  const top = zTop - 12 * (s + 1), va = vStart + dirV * 12 * s, vb = va + dirV * 12;
  ubox(u0, Math.min(va, vb), R.WELL.z0, u1, Math.max(va, vb), top, sand(u0, s, top), label); } };
flight(FA.u0, FA.u1, 64, -1, 1000, 10, 'flightA');                 // 1000 -> 880 going south
ubox(-60, -124, R.WELL.z0, 60, -56, 880, sand(7, 7), 'wlanding');    // south landing
flight(FB.u0, FB.u1, -56, +1, 880, 10, 'flightB');                 // 880 -> 760 going north
ubox(-8, -56, R.WELL.z0, 8, 64, 996, clay(4, 4), 'spine');
// stair S2 down the hall's west wall: 760 -> 544
for (let s = 0; s < 18; s++) { const top = 760 - 12 * (s + 1), v1 = R.S2.v1 - 10 * s, v0 = v1 - 10; ubox(R.S2.u0, v0, F, R.S2.u1, v1, top, sand(s, 61), 'stairS2'); }
// exit stair E1: 540 -> 360 going south, then E2 flat out
for (let s = 0; s < 15; s++) { const top = F - 12 * (s + 1), v1 = R.E1.v1 - 12 * s, v0 = v1 - 12; ubox(R.E1.u0, v0, R.E1.z0 - 4, R.E1.u1, v1, top, sand(s, 62), 'stairE'); }

// ---------------------------------------------------------------- the trap hall: 5x5 jump tiles over the spikes
const TILE = 14, PITCH = 80, GU0 = -190, GV0 = -250;
const tiles = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
  const u = GU0 + c * PITCH, v = GV0 + r * PITCH, trap = hash(r, c, 77) < 0.36 && !(r === 2 && c === 0);
  for (let z = R.PIT.z0; z < F - 4; z += 20) ubox(u - TILE + 2, v - TILE + 2, z, u + TILE - 2, v + TILE - 2, Math.min(F - 4, z + 20), { color: shade(clayC(u, v, z), pitShade(z + 10)) }, 'tilepillar');
  ubox(u - TILE, v - TILE, F - 4, u + TILE, v + TILE, F, { color: SAND[(r + c) % 3], ...(trap ? { trap: { r, c } } : {}) }, trap ? 'traptile' : 'tile');
  tiles.push({ r, c, u, v, trap });
}
const nearTile = (u, v) => tiles.some(t => Math.abs(u - t.u) < TILE + 2 && Math.abs(v - t.v) < TILE + 2);
for (let u = R.PIT.u0 + 2; u < R.PIT.u1 - 10; u += 14) for (let v = R.PIT.v0 + 2; v < R.PIT.v1 - 10; v += 14)
  if (!nearTile(u + 5, v + 5)) ubox(u, v, R.PIT.z0, u + 10, v + 10, R.PIT.z0 + 10, { asset: 'PB_Spike', color: [40, 38, 36], spike: true }, 'spike');
ubox(R.PIT.u0, R.PIT.v0, R.PIT.z0 - 4, R.PIT.u1, R.PIT.v1, R.PIT.z0, { color: [10, 8, 8] }, 'pitfloor');
// darts: per row one each in the west + east walls, per column one each in the north + south walls
const DZ = F + 30;
for (let r = 0; r < 5; r++) { const v = GV0 + r * PITCH;
  ubox(R.HALL.u0, v - 2, DZ, R.HALL.u0 + 4, v + 2, DZ + 4, { color: [20, 16, 14], dart: { kind: 'r', i: r, dir: 0 } }, 'dart');
  if (!inRect(R.C3, R.HALL.u1 + 1, v)) ubox(R.HALL.u1 - 4, v - 2, DZ, R.HALL.u1, v + 2, DZ + 4, { color: [20, 16, 14], dart: { kind: 'r', i: r, dir: 1 } }, 'dart'); }
for (let c = 0; c < 5; c++) { const u = GU0 + c * PITCH;
  ubox(u - 2, R.HALL.v0, DZ, u + 2, R.HALL.v0 + 4, DZ + 4, { color: [20, 16, 14], dart: { kind: 'c', i: c, dir: 2 } }, 'dart');
  ubox(u - 2, R.HALL.v1 - 4, DZ, u + 2, R.HALL.v1, DZ + 4, { color: [20, 16, 14], dart: { kind: 'c', i: c, dir: 3 } }, 'dart'); }

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
for (const s of steps) if (hash(s, 5) < 0.3) fern(CS.w + 6, CS.v0 + 12 * s + 6, 700 - 12 * s + 14);
for (const [u, v] of [[-290, -50], [-90, -50], [-290, 130], [-95, 128]]) fern(u, v, 760);

// ---------------------------------------------------------------- plaque at the shrine door
plaque({ put: (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'plaque'), text: 'TEMPLE OF THE STASH\nNO STEALING. SIGNED, GARY\nP.S. THE BOULDER IS DECORATIVE',
  facing: [0, 1], x: X(-62), y: Y(SH.v1) + 1, z: SH.zb + 40, w: 22, h: 14, color: [96, 76, 52], style: { LineHeight: 1.6 } });

// ---------------------------------------------------------------- write the prefab (+ wires) and the jobs
const dropped = B.dropped.filter(d => !d.startsWith('terrain'));
const byLabel = {}; for (const d of dropped) { const l = d.split(' ')[0] + (/ hits terrain /.test(d) ? '>terrain' : ''); byLabel[l] = (byLabel[l] ?? 0) + 1; }
const mine = B.bricks.slice(nObst);
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
}
let gi = 0;
const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [-200 + (gi % 20) * 20, -200 + Math.floor(gi++ / 20) * 20, SH.zt + 260 - ZOFF], color: [200, 200, 200], owner_index: o, visibility: false, collision: NOCOLL, components: [{ type: c.NAME, data }] }), c });
const wire = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
// row r darts <- OR of the trap tiles in row r; column c darts <- OR of the trap tiles in column c
for (const [kind, key] of [['r', 'r'], ['c', 'c']]) for (let i = 0; i < 5; i++) {
  const zs = zones.filter(z => z.trap[key] === i), ds = darts.filter(d => d.dart.kind === kind && d.dart.i === i);
  if (!zs.length || !ds.length) continue;
  let src = [zs[0], 'bOccupied'];
  for (const z of zs.slice(1)) { const or = gate(COMP.Expr_LogicalOR); wire(...src, or, 'bInputA'); wire(z, 'bOccupied', or, 'bInputB'); src = [or, 'bOutput']; }
  for (const d of ds) wire(...src, d, 'bEnabled');
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
