// Brickwell Tower (2026-10-26, owner: "build an office building as if you were designing one to trick someone
// into thinking it was real life ... cubicles, chairs, all that ... respect the player's height ... be generous,
// things can be kind of tall ... a lobby ... each office its own theme or product with a flow that respects the
// roles: a central design, a pod system, just desks, individual rooms off a hallway, one big room, oversight
// wings so people can look down and see people working below").
// 140 x 100 studs, floors 144 apart (8 slab, 120 to the drop ceiling, 16 plenum). Player 60: doors 88, desks
// 26, counters 36, cubicle panels 50, bookshelves 100, fridges 84, plants up to 110, elevator doors 100.
//   L0+L1 (z 8 / 152) lobby, double height: revolving door + swing doors under a canopy, reception, security
//        turnstiles, lounge, a living green wall, the tenant directory; a café mezzanine over the elevator hall.
//   L2 (296) Reasonably Assured Mutual (insurance): reception at the elevators -> a field of 2x2 cubicle pods
//        (claims adjusters) -> glass-front team-lead offices on the back windows, conference room, break room.
//   L3 (440) Pettifog, Wherewithal & Sons (law): private offices round the perimeter off a ring corridor,
//        partners in the corners, paralegals in the middle, a glass library-conference room, file room, kitchen.
//   L4 (584) Nebulr (startup): exposed ceiling with ducts and pendants, benching pods, glass meeting rooms,
//        phone booths, lounge with ping-pong and bean bags, kitchen bar, the office dog.
//   L5+L6 (728 / 872) OmniDial (call centre): one big double-height room of agent rows under stat screens hung
//        on the mezzanine fascia; supervisors at the mezzanine's glass rail look down on it, glass offices behind.
// Core at the back centre of every floor: 3 elevators (doors, call buttons, indicators), the fire stair
// (switchback, 18 risers of 8 on 20 treads, 60 / 80 deep landings, smooth tile treads between walls) up to a
// roof bulkhead, and a restroom with stalls. Local frame: x across the front, y from the front facade (0) to
// the back (1000), entrance on -y; the output is turned by --turn quarter turns and moved to --at.
//   node mapgen/office.mjs [--at 21860,3900] [--turn 3] [--seed 7] [--out DIR] -> DIR/add.json (one bricks op)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeBuilder, rng } from './builder.mjs';
import { turnBrick, worldBox } from './orient.mjs';
import { plaque, EXTERNAL_ASSETS } from './ruins.mjs';
import { buildTree } from '../trees/tree.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const AT = arg('at', '21860,3900').split(',').map(Number), TURN = +arg('turn', 3), OUT = arg('out', path.join(HERE, 'out_office'));
const R = rng(+arg('seed', 7)), pick = a => a[Math.floor(R() * a.length)], rint = (a, b) => a + Math.floor(R() * (b - a + 1));
const selfHits = [];
const B = makeBuilder(), tally = {}, T = k => { tally[k] = (tally[k] ?? 0) + 1; }, blocked = [];
const MB = 'PB_DefaultMicroBrick', ST = 'PB_DefaultSmoothTile';
const M = (color, extra) => ({ color, ...extra });
const GLASS = (c = [176, 204, 222]) => ({ color: c, material: 'BMC_Glass' });
const FROST = { color: [236, 240, 242], material: 'BMC_Glass' };
const METAL = c => ({ color: c, material: 'BMC_Metallic' });
const GLOW = (c, i = 3) => ({ color: c, material: 'BMC_Glow', material_intensity: Math.max(1, Math.round(i)) }); // the game takes whole numbers
const LIGHT = (r = 380, b = 1.6, c = [255, 244, 226]) => [{ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: b, Radius: r, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } }];
const FONT = { mono: 0, serif: 1, block: 5 };
const TXT = (c, lh, font = 0) => ({ Font: font, LineHeight: lh, Color: { R: c[0], G: c[1], B: c[2], A: 255 } });

const HW = 690, Y0 = 10, Y1 = 990;               // inside faces of the facade
const LV = f => 8 + 144 * f, CH = 120;          // floor level of storey f; the drop ceiling CH over it
const CORE = [-250, 650, 250, 990], HOLE = [130, 720, 240, 960], RESTROOM = [-240, 660, -130, 960];
const COLUMNS = [[-450, 340, -420, 370], [420, 340, 450, 370]];
const DRY = [228, 224, 214], WOOD = [126, 86, 54], DARKWOOD = [84, 56, 38], STEEL = [196, 198, 200], BLACK = [34, 34, 38];

// ---------------------------------------------------------------- primitives
const mk = (x0, y0, z0, x1, y1, z1, m) => ({ asset: MB, ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
function put(x0, y0, z0, x1, y1, z1, m, label) { // structure: logged when something is already there
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
  if (B.add(mk(x0, y0, z0, x1, y1, z1, m), label)) { T(label); return true; }
  blocked.push(label + ' ' + [x0, y0, z0, x1, y1, z1]); return false;
}
const tileAt = (x0, y0, x1, y1, z, color) => put(x0, y0, z - 4, x1, y1, z, { asset: ST, color }, 'floor');
/** a furniture item in its own frame (u across, v forward, z up from its base), turned q quarter turns, placed whole or not at all */
function item(x, y, q, z, label) {
  const A = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][((q % 4) + 4) % 4];
  const map = (u, v) => [x + A[0] * u + A[1] * v, y + A[2] * u + A[3] * v];
  const bricks = [];
  const I = {
    b(u0, v0, z0, u1, v1, z1, m) { const [a, b] = map(u0, v0), [c, d] = map(u1, v1); bricks.push(mk(Math.min(a, c), Math.min(b, d), z + z0, Math.max(a, c), Math.max(b, d), z + z1, m)); return I; },
    text(u, v, zc, du, dv, w, h, txt, color, style, extra = {}) {
      const [px, py] = map(u, v);
      plaque({ put: (b, X, Y, Z) => bricks.push({ ...b, ...extra, position: [X, Y, Z] }), facing: [A[0] * du + A[1] * dv, A[2] * du + A[3] * dv], x: px, y: py, z: z + zc, w, h, color, text: txt, style });
      return I;
    },
    place() {
      if (!bricks.every(b => { const [lo, hi] = worldBox(b); return B.free(lo, hi); })) { T('skipped ' + label); if (process.env.SKIPS) { const b = bricks.find(b => { const [lo, hi] = worldBox(b); return !B.free(lo, hi); }), [lo, hi] = worldBox(b); const hit = B.bricks.find(o => { const [a, c] = worldBox(o); return lo.every((v, i) => v < c[i] && a[i] < hi[i]); }); console.error('SKIP', label, JSON.stringify(b.position), 'hits', hit?.label, JSON.stringify(hit?.position)); } return false; }
      for (const b of bricks) if (!B.add(b, label)) selfHits.push(label + ' ' + JSON.stringify(b.position) + ' ' + JSON.stringify(b.size));
      T(label); return true;
    },
  };
  return I;
}
const AQ = q => [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0]][((q % 4) + 4) % 4];
const at = (x, y, q, u, v) => { const A = AQ(q); return [x + A[0] * u + A[1] * v, y + A[2] * u + A[3] * v]; };
/** the q whose +v points along local (du, dv) of frame q */
const qOf = (q, du, dv) => { const A = AQ(q), w = [A[0] * du + A[1] * dv, A[2] * du + A[3] * dv]; return [0, 1, 2, 3].find(k => AQ(k)[1] === w[0] && AQ(k)[3] === w[1]); };
const sign = (x, y, z, face, w, h, txt, color, style, extra, label = 'sign') => item(x, y, 0, 0, label).text(0, 0, z, face[0], face[1], w, h, txt, color, style, extra).place();
function rectSub(r, holes) {
  let out = [r];
  for (const [hx0, hy0, hx1, hy1] of holes) out = out.flatMap(([x0, y0, x1, y1]) => {
    if (hx1 <= x0 || hx0 >= x1 || hy1 <= y0 || hy0 >= y1) return [[x0, y0, x1, y1]];
    const o = [];
    if (hy0 > y0) o.push([x0, y0, x1, hy0]);
    if (hy1 < y1) o.push([x0, hy1, x1, y1]);
    const my0 = Math.max(y0, hy0), my1 = Math.min(y1, hy1);
    if (hx0 > x0) o.push([x0, my0, hx0, my1]);
    if (hx1 < x1) o.push([hx1, my0, x1, my1]);
    return o;
  });
  return out;
}
const inter = (a, b) => { const r = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]; return r[0] < r[2] && r[1] < r[3] ? r : null; };
/** floor finish: tiles of w x h in two (or more) shades, rows staggered by `stagger` */
function pave([x0, y0, x1, y1], z, { cols, w = 60, h = w, stagger = 0 }) {
  for (let y = y0, j = 0; y < y1; y += h, j++) {
    const off = stagger ? (j * stagger) % w : 0;
    for (let x = x0 - (off ? w - off : 0), i = 0; x < x1; x += w, i++) {
      const a = Math.max(x0, x), b = Math.min(x1, x + w);
      if (b > a) tileAt(a, y, b, Math.min(y1, y + h), z, cols[(i + j * (stagger ? 1 : 1)) % cols.length]);
    }
  }
}
/** a wall along `axis` ('x' or 'y') between t0..t1 across it and a0..a1 along it; openings [o0, o1, height] */
function wall(axis, t0, t1, a0, a1, z0, z1, m, label, openings = []) {
  const P = (u0, u1, zA, zB) => axis === 'x' ? put(u0, t0, zA, u1, t1, zB, m, label) : put(t0, u0, zA, t1, u1, zB, m, label);
  let a = a0;
  for (const [o0, o1, h] of [...openings].sort((p, q) => p[0] - q[0])) { if (o0 > a) P(a, o0, z0, z1); if (z0 + h < z1) P(o0, o1, z0 + h, z1); a = o1; }
  if (a < a1) P(a, a1, z0, z1);
}
/** glazed partition: aluminium mullions every 60, a frosted band at 40..56, door gaps [o0, o1, h] with jambs + head */
function glassWall(axis, t0, t1, a0, a1, z0, z1, label, openings = []) {
  const P = (u0, u1, zA, zB, m) => axis === 'x' ? put(u0, t0, zA, u1, t1, zB, m, label) : put(t0, u0, zA, t1, u1, zB, m, label);
  for (const [o0, o1, h] of openings) {
    P(o0, o0 + 2, z0, z0 + h, METAL(STEEL)); P(o1 - 2, o1, z0, z0 + h, METAL(STEEL));
    if (z0 + h < z1) { P(o0, o1, z0 + h, Math.min(z1, z0 + h + 4), METAL(STEEL)); if (z0 + h + 4 < z1) P(o0, o1, z0 + h + 4, z1, GLASS()); }
  }
  let stretches = [[a0, a1]];
  for (const [o0, o1] of openings) stretches = stretches.flatMap(([p, q]) => o1 <= p || o0 >= q ? [[p, q]] : [[p, o0], [o1, q]].filter(([u, v]) => v > u));
  for (const [s0, s1] of stretches) for (let a = s0; a < s1; a += 60) {
    const b = Math.min(s1, a + 60), e = b === a1 ? b - 2 : b;
    P(a, a + 2, z0, z1, METAL(STEEL));
    if (e > a + 2) {
      if (z0 + 56 < z1) { P(a + 2, e, z0, z0 + 40, GLASS()); P(a + 2, e, z0 + 40, z0 + 56, FROST); P(a + 2, e, z0 + 56, z1, GLASS()); }
      else P(a + 2, e, z0, z1, GLASS());
    }
    if (b === a1) P(a1 - 2, a1, z0, z1, METAL(STEEL));
  }
}
/** door: jambs and head inside the opening o0..o1 (axis as wall), leaf standing open at 90 deg on side `side` (+1/-1 across the wall), hinged at the o0 end */
function door(axis, t0, t1, o0, o1, z, h, side, leafColor, label = 'door') {
  const P = (u0, u1, v0, v1, zA, zB, m) => axis === 'x' ? put(u0, v0, zA, u1, v1, zB, m, label) : put(v0, u0, zA, v1, u1, zB, m, label);
  P(o0, o0 + 2, t0, t1, z, z + h, M([236, 234, 228]));
  P(o1 - 2, o1, t0, t1, z, z + h, M([236, 234, 228]));
  P(o0 + 2, o1 - 2, t0, t1, z + h - 2, z + h, M([236, 234, 228]));
  const face = side > 0 ? t1 : t0, len = o1 - o0 - 6;
  const [v0, v1] = side > 0 ? [face, face + len] : [face - len, face];
  P(o0 + 2, o0 + 6, v0, v1, z + 1 - 1, z + h - 4, M(leafColor));
  const kv = side > 0 ? v1 - 8 : v0 + 4;
  P(o0 + 6, o0 + 8, kv, kv + 4, z + 40, z + 42, METAL([210, 200, 160]));
}

// ---------------------------------------------------------------- furniture
function taskChair(x, y, q, z, c = [40, 42, 48]) {
  return item(x, y, q, z, 'task chair')
    .b(-12, -2, 0, 12, 2, 2, METAL([60, 60, 64])).b(-2, -12, 0, 2, -2, 2, METAL([60, 60, 64])).b(-2, 2, 0, 2, 12, 2, METAL([60, 60, 64]))
    .b(-2, -2, 2, 2, 2, 14, METAL([80, 80, 84])).b(-10, -10, 14, 10, 10, 18, M(c))
    .b(-2, -12, 18, 2, -10, 22, METAL([60, 60, 64])).b(-10, -14, 22, 10, -10, 46, M(c))
    .b(-12, -6, 22, -10, 6, 24, M(BLACK)).b(10, -6, 22, 12, 6, 24, M(BLACK)).b(-12, -2, 18, -10, 2, 22, M(BLACK)).b(10, -2, 18, 12, 2, 22, M(BLACK)).place();
}
function guestChair(x, y, q, z, c = [92, 62, 44], legs = DARKWOOD) {
  const I = item(x, y, q, z, 'guest chair');
  for (const [u, v] of [[-10, -10], [8, -10], [-10, 8], [8, 8]]) I.b(u, v, 0, u + 2, v + 2, 14, M(legs));
  return I.b(-10, -10, 14, 10, 10, 18, M(c)).b(-10, -12, 14, 10, -10, 44, M(c)).place();
}
function stool(x, y, z, top = 34, c = [40, 40, 44]) {
  return item(x, y, 0, z, 'stool').b(-8, -8, 0, 8, 8, 2, METAL([70, 70, 74])).b(-2, -2, 2, 2, 2, top - 4, METAL(STEEL)).b(-8, -8, top - 4, 8, 8, top, M(c)).place();
}
function armchair(x, y, q, z, c) {
  return item(x, y, q, z, 'armchair').b(-18, -16, 0, 18, 16, 16, M(c)).b(-18, -22, 0, 18, -16, 42, M(c.map(v => v * 0.9 | 0)))
    .b(-24, -22, 0, -18, 16, 28, M(c.map(v => v * 0.9 | 0))).b(18, -22, 0, 24, 16, 28, M(c.map(v => v * 0.9 | 0))).b(-16, -14, 16, 16, 14, 20, M(c.map(v => Math.min(255, v + 14)))).place();
}
function sofa(x, y, q, z, len, c) {
  const h = len / 2, d = c.map(v => v * 0.88 | 0), I = item(x, y, q, z, 'sofa').b(-h, -16, 2, h, 18, 16, M(d)).b(-h, -26, 0, h, -16, 44, M(d)).b(-h - 8, -26, 0, -h, 18, 28, M(d)).b(h, -26, 0, h + 8, 18, 28, M(d));
  const cw = Math.floor(len / 6) * 2;
  for (let k = 0, u = -h; k < 3; k++, u += cw) I.b(u, -16, 16, k < 2 ? u + cw - 2 : h, 16, 22, M(c));
  for (const u of [-h, h - 2]) I.b(u, 18, 0, u + 2, 20, 2, M(BLACK));
  return I.place();
}
function plant(x, y, z, h = 80, pot = [196, 190, 180]) {
  h -= h % 2;
  const I = item(x, y, 0, z, 'plant').b(-10, -10, 0, 10, 10, 20, M(pot)).b(-8, -8, 20, 8, 8, 22, M([70, 52, 38])).b(-2, -2, 22, 2, 2, Math.max(30, h - 40), M([92, 66, 44]));
  const greens = [[58, 112, 44], [72, 128, 52], [46, 96, 38], [86, 140, 60]];
  let z0 = Math.max(30, h - 40);
  for (const [s, du, dv] of [[16, 0, 0], [12, -6, 4], [10, 6, -4], [8, 0, 2]]) { const top = Math.min(h, z0 + s); I.b(du - s / 2, dv - s / 2, z0, du + s / 2, dv + s / 2, top, M(pick(greens))); z0 = top; if (z0 >= h) break; }
  return I.place();
}
function monitor(I, u, v, glow = [150, 200, 255], wide = 14) {
  I.b(u - 5, v + 4, 26, u + 5, v + 10, 28, M(BLACK)).b(u - 1, v + 4, 28, u + 1, v + 6, 34, M(BLACK)).b(u - wide, v + 2, 30, u + wide, v + 4, 48, M(BLACK)).b(u - wide + 2, v, 32, u + wide - 2, v + 2, 46, GLOW(glow, 1));
}
const DESK_JUNK = [
  (I, u, v) => I.b(u, v, 26, u + 4, v + 4, 32, M([236, 236, 230])), // mug
  (I, u, v) => I.b(u, v, 26, u + 10, v + 14, 30, M([244, 244, 240])), // papers
  (I, u, v) => I.b(u, v, 26, u + 6, v + 6, 32, M([170, 90, 60])).b(u - 1, v - 1, 32, u + 7, v + 7, 38, M([70, 130, 56])), // desk plant
  (I, u, v) => I.b(u, v + 2, 26, u + 8, v + 4, 36, M([60, 50, 40])), // family photo
  (I, u, v) => I.b(u, v, 26, u + 6, v + 6, 30, M([250, 220, 70])), // sticky notes
  (I, u, v) => I.b(u, v, 26, u + 4, v + 4, 34, M(pick([[200, 30, 40], [40, 160, 70], [30, 30, 30]]))), // can
  (I, u, v) => I.b(u, v, 26, u + 8, v + 8, 34, M([200, 40, 40])).b(u + 2, v + 2, 34, u + 6, v + 6, 36, M([250, 250, 250])), // cake slice (somebody's birthday)
];
const junk = (I, u, v) => { if (R() < 0.7) pick(DESK_JUNK)(I, u, v); };
function bookshelf(x, y, q, z, w, h = 100, frame = DARKWOOD) {
  const I = item(x, y, q, z, 'bookshelf').b(-w / 2, 0, 0, -w / 2 + 2, 14, h, M(frame)).b(w / 2 - 2, 0, 0, w / 2, 14, h, M(frame)).b(-w / 2 + 2, 12, 0, w / 2 - 2, 14, h, M(frame));
  const BOOKS = [[120, 30, 30], [30, 60, 110], [40, 90, 50], [200, 180, 120], [90, 40, 70], [30, 30, 30], [170, 120, 60], [220, 220, 210]];
  for (let s = 0; s + 20 <= h; s += 20) {
    I.b(-w / 2 + 2, 0, s, w / 2 - 2, 12, s + 2, M(frame));
    if (s + 20 >= h) break;
    for (let u = -w / 2 + 4; u < w / 2 - 8;) {
      const bw = pick([2, 4, 4, 6]), bh = pick([10, 12, 14, 16]);
      if (R() < 0.12) { u += 6; continue; }
      if (u + bw > w / 2 - 4) break;
      I.b(u, 2, s + 2, u + bw, 12, s + 2 + bh, M(pick(BOOKS))); u += bw;
    }
  }
  return I.b(-w / 2 + 2, 0, h - 2, w / 2 - 2, 12, h, M(frame)).place();
}
function fileCabinet(x, y, q, z, drawers = 4, c = [150, 152, 150]) {
  const I = item(x, y, q, z, 'file cabinet').b(-10, 0, 0, 10, 26, drawers * 14, METAL(c));
  for (let d = 0; d < drawers; d++) I.b(-6, -2, d * 14 + 9, 6, 0, d * 14 + 11, METAL([90, 90, 92]));
  return I.place();
}
function waterCooler(x, y, q, z) { return item(x, y, q, z, 'water cooler').b(-8, -8, 0, 8, 8, 40, M([236, 236, 232])).b(-6, -6, 40, 6, 6, 60, GLASS([120, 180, 230])).b(-2, -10, 26, 2, -8, 30, M([60, 100, 200])).place(); }
function vending(x, y, q, z, kind = 'snack') {
  const I = item(x, y, q, z, 'vending machine').b(-22, 0, 0, 22, 34, 90, M(kind === 'snack' ? [40, 40, 46] : [200, 30, 40])).b(-18, -2, 20, 10, 0, 84, GLOW(kind === 'snack' ? [240, 240, 220] : [255, 200, 200], 1.5)).b(12, -2, 40, 20, 0, 60, METAL([120, 120, 124]));
  if (kind === 'snack') for (let s = 0; s < 5; s++) for (let k = 0; k < 4; k++) I.b(-16 + k * 7, -4, 24 + s * 12, -12 + k * 7, -2, 30 + s * 12, M(pick([[230, 60, 40], [240, 200, 40], [60, 120, 220], [120, 70, 40]])));
  return I.place();
}
function copier(x, y, q, z) {
  return item(x, y, q, z, 'copier').b(-24, 0, 0, 24, 34, 36, M([226, 226, 222])).b(-24, 0, 36, 24, 34, 44, M([200, 200, 196])).b(-14, 4, 44, 14, 30, 46, M([60, 60, 64]))
    .b(10, -2, 38, 20, 0, 44, GLOW([90, 200, 120], 2)).b(-30, 6, 18, -24, 28, 22, M([244, 244, 240])).text(-8, -1, 22, 0, -1, 10, 3, 'PAPER JAM\nIN TRAY 2', [200, 30, 30], TXT([255, 255, 255], 0.5)).place();
}
function confTable(x, y, q, z, len, wid, chairs, c = DARKWOOD, chairColor = [40, 42, 48]) {
  const I = item(x, y, q, z, 'conference table').b(-len / 2, -wid / 2, 24, len / 2, wid / 2, 26, M(c)).b(-len / 2 + 20, -6, 0, -len / 2 + 28, 6, 24, M(BLACK)).b(len / 2 - 28, -6, 0, len / 2 - 20, 6, 24, M(BLACK));
  if (len > 140) I.b(-4, -6, 0, 4, 6, 24, M(BLACK));
  I.b(-6, -6, 26, 6, 6, 28, M(BLACK)); // the speakerphone
  if (!I.place()) return false;
  const step = len / (chairs + 1);
  for (let k = 1; k <= chairs; k++) for (const s of [-1, 1]) {
    const u = -len / 2 + Math.round(step * k / 2) * 2, [cx, cy] = at(x, y, q, u, s * (wid / 2 + 16));
    taskChair(cx, cy, qOf(q, 0, -s), z, chairColor);
  }
  return true;
}
function tvScreen(x, y, q, z, w, h, txt, tcol = [255, 255, 255]) {
  const I = item(x, y, q, z, 'screen').b(-w / 2, 0, 0, w / 2, 4, h, M(BLACK)).b(-w / 2 + 2, -2, 2, w / 2 - 2, 0, h - 2, GLOW([40, 60, 90], 1.2));
  if (txt) I.text(0, -3, h / 2, 0, -1, w / 2 - 6, h / 2 - 6, txt, [20, 30, 50], TXT(tcol, Math.max(0.5, (h - 12) / 30), 0), { material: 'BMC_Glow', material_intensity: 1 });
  return I.place();
}

// ---------------------------------------------------------------- shell
const SLABS = {
  0: [[-HW, Y0, HW, Y1]], 1: [[-400, 420, 400, 650], CORE], 2: [[-HW, Y0, HW, Y1]], 3: [[-HW, Y0, HW, Y1]], 4: [[-HW, Y0, HW, Y1]],
  5: [[-HW, Y0, HW, Y1]], 6: [[-HW, 560, HW, Y1]], 7: [[-HW, Y0, HW, Y1]],
};
const FINISH = {
  0: { cols: [[216, 210, 200], [198, 192, 182]], w: 120 }, 1: { cols: [[152, 110, 72], [142, 102, 66], [160, 116, 76]], w: 120, h: 20, stagger: 40 },
  2: { cols: [[96, 104, 116], [90, 98, 110]] }, 3: { cols: [[112, 44, 50], [104, 40, 46]] }, 4: { cols: [[158, 158, 154], [150, 150, 147]], w: 120 },
  5: { cols: [[62, 62, 68], [56, 56, 62]] }, 6: { cols: [[62, 62, 68], [56, 56, 62]] }, 7: { cols: [[98, 100, 102], [92, 94, 96]], w: 120 },
};
function slabs() {
  for (const [f, rects] of Object.entries(SLABS)) {
    const z = LV(+f);
    for (const r of rects) for (const part of rectSub(r, +f >= 1 ? [HOLE] : [])) {
      for (let x = part[0]; x < part[2]; x += 400) for (let y = part[1]; y < part[3]; y += 400) put(x, y, z - 8, Math.min(part[2], x + 400), Math.min(part[3], y + 400), z - 4, M([150, 150, 150]), 'slab');
      const special = [[RESTROOM, { cols: [[236, 236, 232], [206, 206, 204]], w: 20 }], [[130, 650, 240, 720], { cols: [[172, 172, 168]], w: 110 }]];
      for (const piece of rectSub(part, special.map(s => s[0]))) pave(piece, z, FINISH[f]);
      for (const [sr, pat] of special) { const i = inter(part, sr); if (i) pave(i, z, pat); }
    }
  }
}
function columns() {
  for (const [z0, z1] of [[8, 288], [296, 432], [440, 576], [584, 720], [728, 1008]])
    for (const [x0, y0, x1, y1] of COLUMNS) { put(x0, y0, z0, x1, y1, z1, M([232, 228, 220]), 'column'); }
}
// facade: glass bands between dark spandrels, mullions every 60 standing 4 proud, stone at the core
const BANDS = [[8, 272, 144], [296, 416], [440, 560], [584, 704], [728, 992, 864]];
const ENTRY = [[-150, -110, 104], [-60, 60, 120], [110, 150, 104]];
function facade() {
  const SP = M([52, 56, 62], { material: 'BMC_Metallic' }), MUL = METAL([78, 82, 88]), STONE = [[188, 182, 170], [176, 170, 158]];
  const sides = [
    { name: 'front', axis: 'x', g: [6, 10], s: [0, 10], m: [-4, 10], a: [-HW, HW] },
    { name: 'back', axis: 'x', g: [990, 994], s: [990, 1000], m: [990, 1004], a: [-HW, HW] },
    { name: 'left', axis: 'y', g: [-694, -690], s: [-700, -690], m: [-704, -690], a: [Y0, Y1] },
    { name: 'right', axis: 'y', g: [690, 694], s: [690, 700], m: [690, 704], a: [Y0, Y1] },
  ];
  for (const S of sides) {
    const P = (a0, a1, t, z0, z1, m, label) => S.axis === 'x' ? put(a0, t[0], z0, a1, t[1], z1, m, label) : put(t[0], a0, z0, t[1], a1, z1, m, label);
    const stoneSpan = S.name === 'back' ? [CORE[0], CORE[2]] : null;
    const segs = stoneSpan ? [[S.a[0], stoneSpan[0]], [stoneSpan[1], S.a[1]]] : [S.a];
    P(S.a[0], S.a[1], S.s, 0, 8, M([150, 146, 138]), 'plinth');
    for (const [k, [z0, z1, tr]] of BANDS.entries()) {
      const zNext = k + 1 < BANDS.length ? BANDS[k + 1][0] : 1016;
      for (const [s0, s1] of segs) {
        P(s0, s1, S.s, z1, zNext, SP, 'spandrel');
        const open = S.name === 'front' && k === 0 ? ENTRY : [];
        const zs = tr ? [[z0, tr], [tr + 8, z1]] : [[z0, z1]];
        if (tr) P(s0, s1, S.m, tr, tr + 8, MUL, 'transom');
        for (let a = s0; a < s1; a += 60) {
          const b = Math.min(s1, a + 60), inOpen = o => a >= o[0] && a < o[1];
          const mo = open.find(inOpen);
          for (const [za, zb] of zs) {
            const zm = mo ? Math.max(za, LV(0) + mo[2]) : za;
            if (zm < zb) P(a, a + 4, S.m, zm, zb, MUL, 'mullion');
            // glass from a+4 to b, cut round the openings
            let cuts = [[a + 4, b]];
            for (const o of open) cuts = cuts.flatMap(([c0, c1]) => o[1] <= c0 || o[0] >= c1 ? [[c0, c1]] : [[c0, Math.max(c0, o[0])], [Math.min(c1, o[1]), c1]].filter(([p, q]) => q > p));
            for (const [c0, c1] of cuts) P(c0, c1, S.g, za, zb, GLASS([150, 186, 206]), 'glass');
            for (const o of open) { const c0 = Math.max(a + 4, o[0]), c1 = Math.min(b, o[1]); if (c1 > c0 && LV(0) + o[2] < zb) P(c0, c1, S.g, Math.max(za, LV(0) + o[2]), zb, GLASS([150, 186, 206]), 'glass'); }
          }
        }
      }
    }
    if (stoneSpan) for (let z = 8, r = 0; z < 1016; z += 24, r++) for (let a = stoneSpan[0] - (r % 2 ? 30 : 0); a < stoneSpan[1]; a += 60)
      P(Math.max(stoneSpan[0], a), Math.min(stoneSpan[1], a + 60), S.s, z, Math.min(1016, z + 24), M(pick(STONE)), 'stone');
    P(S.a[0], S.a[1], S.s, 1016, 1060, M([170, 166, 158]), 'parapet');
    P(S.a[0], S.a[1], S.s, 1060, 1066, M([206, 200, 190]), 'coping');
  }
  for (const [x, y] of [[-700, 0], [690, 0], [-700, 990], [690, 990]]) put(x, y, 0, x + 10, y + 10, 1066, METAL([60, 64, 70]), 'corner');
  for (const [k, [o0, o1]] of ENTRY.filter(o => o[1] - o[0] === 40).entries()) { // swing doors: frames, leaves held open (one in, one out)
    put(o0, 4, 8, o0 + 2, 12, 112, METAL(STEEL), 'entry frame'); put(o1 - 2, 4, 8, o1, 12, 112, METAL(STEEL), 'entry frame');
    put(o0 + 2, 4, 108, o1 - 2, 12, 112, METAL(STEEL), 'entry frame');
    if (k === 0) put(o0 + 2, 12, 8, o0 + 4, 46, 106, GLASS([190, 214, 226]), 'entry leaf');
    else put(o1 - 4, -32, 8, o1 - 2, 4, 106, GLASS([190, 214, 226]), 'entry leaf');
  }
}
function revolvingDoor() { // a drum straddling the facade: curved glass sides, a canopy disc, 4 wings on a centre post
  for (let x = -54; x < 54; x += 6) for (let y = -54; y < 54; y += 6) {
    const r = Math.hypot(x + 3, y + 3);
    if (r >= 44 && r <= 50 && Math.abs(x + 3) >= 28) put(x, y, 8, x + 6, y + 6, 116, GLASS([190, 214, 226]), 'revolving drum');
  }
  for (let x = -54; x < 54; x += 6) for (let y = -54; y < 54; y += 6) if (Math.hypot(x + 3, y + 3) <= 52) put(x, y, 116, x + 6, y + 6, 120, METAL([70, 74, 80]), 'revolving top');
  put(-2, -2, 8, 2, 2, 116, METAL(STEEL), 'revolving post');
  put(-40, -1, 10, -2, 1, 108, GLASS([200, 220, 230]), 'wing'); put(2, -1, 10, 40, 1, 108, GLASS([200, 220, 230]), 'wing');
  put(-1, -40, 10, 1, -2, 108, GLASS([200, 220, 230]), 'wing'); put(-1, 2, 10, 1, 40, 108, GLASS([200, 220, 230]), 'wing');
}
const ELEV = [-74, 0, 74];
function core(f, faceColor) {
  const z = LV(f), top = z + 136;
  wall('x', 650, 660, CORE[0], CORE[2], z, top, M(faceColor), 'core front', [[-220, -184, 88], [150, 190, 88], ...ELEV.map(c => [c - 26, c + 26, 104])]);
  for (const [x0, x1] of [[-250, -240], [-130, -120], [120, 130], [240, 250]]) wall('y', x0, x1, 660, 960, z, top, M(DRY), 'core wall');
  wall('x', 960, 990, CORE[0], CORE[2], z, top, M([200, 196, 188]), 'core back');
  wall('y', -120, 120, 900, 960, z, top, M([120, 120, 124]), 'shaft'); // elevator machinery (unseen)
  for (const c of ELEV) { // doors in steel frames, recessed 2; amber indicator over each
    put(c - 26, 648, z, c - 22, 660, z + 100, METAL(STEEL), 'elevator'); put(c + 22, 648, z, c + 26, 660, z + 100, METAL(STEEL), 'elevator');
    put(c - 26, 648, z + 100, c + 26, 660, z + 104, METAL(STEEL), 'elevator');
    put(c - 22, 652, z, c - 2, 656, z + 100, METAL([168, 170, 172]), 'elevator door'); put(c + 2, 652, z, c + 22, 656, z + 100, METAL([168, 170, 172]), 'elevator door');
    put(c - 2, 652, z, c + 2, 656, z + 100, M(BLACK), 'elevator door');
    put(c - 22, 656, z, c + 22, 660, z + 100, M(BLACK), 'elevator');
    put(c - 6, 646, z + 112, c + 6, 650, z + 120, M(BLACK), 'indicator');
    sign(c, 645, z + 116, [0, -1], 5, 3, pick(['L', 'M', '2', '3', '4', '5', '6']), [20, 10, 0], TXT([255, 170, 40], 1), { material: 'BMC_Glow', material_intensity: 2 }, 'indicator');
  }
  for (const cx of [-37, 37]) { // call buttons
    put(cx - 3, 646, z + 40, cx + 3, 650, z + 58, METAL(STEEL), 'call panel');
    put(cx - 1, 644, z + 50, cx + 1, 646, z + 54, GLOW([255, 255, 255], 2), 'call button'); put(cx - 1, 644, z + 43, cx + 1, 646, z + 47, GLOW([255, 160, 40], 2), 'call button');
  }
  // the stair door (held open), its exit sign, the restroom door + sign
  door('x', 650, 660, 150, 190, z, 88, 1, [176, 60, 40], 'stair door');
  put(160, 646, z + 94, 180, 650, z + 102, GLOW([60, 230, 90], 2), 'exit sign');
  sign(170, 645, z + 98, [0, -1], 8, 3, 'EXIT', [30, 120, 50], TXT([255, 255, 255], 1, FONT.block), { material: 'BMC_Glow', material_intensity: 2 }, 'exit sign');
  door('x', 650, 660, -220, -184, z, 88, 1, [214, 210, 200], 'restroom door');
  sign(-160, 649, z + 62, [0, -1], 10, 6, 'RESTROOM\nEmployees must\nwash hands', [40, 70, 120], TXT([255, 255, 255], 0.7, FONT.mono), {}, 'restroom sign');
  restroom(z);
  stair(f);
  sign(239, 690, z + 70, [-1, 0], 14, 14, ['L', 'M', '2', '3', '4', '5', '6'][f], [210, 60, 40], TXT([255, 255, 255], 5, FONT.block), {}, 'floor number');
}
function restroom(z) {
  // vanity with three basins and a mirror, paper towels, three stalls at the back (one occupied)
  put(-240, 696, z, -212, 800, z + 28, M([92, 78, 66]), 'vanity'); put(-240, 694, z + 28, -210, 802, z + 32, M([230, 228, 222]), 'vanity top');
  for (const y of [708, 740, 774]) { put(-232, y, z + 32, -218, y + 14, z + 34, M([250, 250, 250]), 'basin'); put(-238, y + 6, z + 32, -234, y + 8, z + 42, METAL(STEEL), 'faucet'); }
  put(-240, 696, z + 46, -238, 800, z + 100, GLASS([214, 222, 226]), 'mirror');
  put(-240, 812, z + 44, -232, 826, z + 66, M([244, 244, 240]), 'towels');
  for (const x of [-204, -168]) put(x, 830, z + 8, x + 2, 960, z + 78, M([190, 196, 204]), 'stall partition');
  const fronts = [[-240, -204, -232, -210], [-202, -168, -196, -174], [-166, -130, -160, -136]];
  for (const [k, [x0, x1, d0, d1]] of fronts.entries()) {
    put(x0, 828, z + 8, d0, 830, z + 78, M([190, 196, 204]), 'stall front'); put(d1, 828, z + 8, x1, 830, z + 78, M([190, 196, 204]), 'stall front');
    if (k === 1) { put(d0, 828, z + 8, d1, 830, z + 78, M([176, 184, 194]), 'stall door'); put(d1 - 6, 826, z + 50, d1 - 2, 828, z + 54, GLOW([230, 40, 40], 2), 'occupied'); put(d0 + 4, 836, z, d0 + 10, 846, z + 6, M([40, 30, 26]), 'shoes'); }
    const cx = (x0 + x1) / 2;
    put(cx - 6, 930, z, cx + 6, 948, z + 12, M([250, 250, 250]), 'toilet'); put(cx - 8, 928, z + 12, cx + 8, 948, z + 14, M([240, 240, 240]), 'toilet');
    put(cx - 8, 950, z + 12, cx + 8, 958, z + 30, M([250, 250, 250]), 'toilet'); put(cx - 6, 948, z, cx + 6, 950, z + 12, M([250, 250, 250]), 'toilet');
    put(x1 - 2, 900, z + 30, x1 + (k < 2 ? 0 : 0), 908, z + 36, M([250, 250, 250]), 'paper');
  }
  ceiling([RESTROOM], z + CH, { lights: true, every: 2 });
}
function stair(f) {
  const z = LV(f), conc = M([176, 176, 172]), treadC = [200, 198, 192];
  for (let k = 1; k <= 8; k++) { // flight A, rising +y
    const y0 = 720 + 20 * (k - 1), t = z + 8 * k, b = f === 0 ? z : t - 16;
    put(130, y0, b, 180, y0 + 20, t - 4, conc, 'stair'); tileAt(130, y0, 180, y0 + 20, t, treadC);
  }
  put(130, 880, z + 56, 240, 960, z + 68, conc, 'landing'); tileAt(130, 880, 240, 960, z + 72, treadC);
  for (let k = 1; k <= 8; k++) { // flight B, rising back -y to the next floor
    const y0 = 880 - 20 * k, t = z + 72 + 8 * k;
    put(190, y0, t - 16, 240, y0 + 20, t - 4, conc, 'stair'); tileAt(190, y0, 240, y0 + 20, t, treadC);
  }
  put(180, 720, z, 190, 880, z + 144, M(DRY), 'stair cheek');
  for (let k = 0; k < 8; k++) { // handrails: a stepped steel rail on the cheek, both flights
    put(178, 720 + 20 * k, z + 8 * (k + 1) + 34, 180, 740 + 20 * k, z + 8 * (k + 1) + 36, METAL(STEEL), 'handrail');
    put(190, 860 - 20 * k, z + 80 + 8 * k + 34, 192, 880 - 20 * k, z + 80 + 8 * k + 36, METAL(STEEL), 'handrail');
  }
}
/** drop ceiling: 60 grid of recessed tiles in a protruding grid, troffers every few cells, some with real lights */
function ceiling(rects, zc, { lights = true, every = 3, lit = 0.28, color = [238, 236, 230], light = LIGHT() } = {}) {
  for (const [x0, y0, x1, y1] of rects) for (let x = x0, i = 0; x < x1; x += 60, i++) for (let y = y0, j = 0; y < y1; y += 60, j++) {
    const cx1 = Math.min(x1, x + 60), cy1 = Math.min(y1, y + 60);
    if (B.free([x, y, zc], [cx1, cy1, zc + 4])) {
      put(x, y, zc, x + 2, cy1, zc + 4, M([220, 220, 216]), 'ceiling grid'); put(x + 2, y, zc, cx1, y + 2, zc + 4, M([220, 220, 216]), 'ceiling grid');
      const troffer = lights && i % every === 1 && j % 2 === 1 && cx1 - x === 60 && cy1 - y === 60;
      if (troffer) put(x + 2, y + 2, zc + 2, cx1, cy1, zc + 4, { ...GLOW([255, 250, 238], 2), ...(R() < lit ? { components: light } : {}) }, 'troffer');
      else put(x + 2, y + 2, zc + 2, cx1, cy1, zc + 4, M(color), 'ceiling tile');
    } else for (let sx = x; sx < cx1; sx += 10) for (let sy = y; sy < cy1; sy += 10) {
      const ex = Math.min(cx1, sx + 10), ey = Math.min(cy1, sy + 10);
      if (B.free([sx, sy, zc + 2], [ex, ey, zc + 4])) put(sx, sy, zc + 2, ex, ey, zc + 4, M(color), 'ceiling tile');
    }
  }
}
const OPEN_CEIL = [[-HW, Y0, HW, 650], [-HW, 650, -250, Y1], [250, 650, HW, Y1]];

// ---------------------------------------------------------------- L0 + L1: lobby and café
function lobby() {
  const z = LV(0);
  revolvingDoor();
  // canopy over the entrance, the name on its upstand, downlights
  put(-240, -150, 176, 240, -4, 184, METAL([60, 64, 70]), 'canopy');
  for (const y of [-120, -70, -24]) put(-220, y, 174, 220, y + 4, 176, GLOW([255, 240, 210], 3), 'canopy light');
  put(-240, -150, 184, 240, -146, 208, METAL([60, 64, 70]), 'canopy upstand');
  sign(0, -151, 196, [0, -1], 120, 10, 'BRICKWELL TOWER', [60, 64, 70], TXT([240, 236, 226], 4, FONT.serif), {}, 'name');
  put(-2, -80, 168, 2, -76, 174, { ...M([255, 240, 210]), components: LIGHT(300, 2.2) }, 'canopy lamp');
  // mezzanine columns, its fascia with the building name
  for (const [x0, x1] of [[-400, -370], [-190, -160], [160, 190], [370, 400]]) put(x0, 420, z, x1, 450, 144, M([226, 222, 214]), 'mezz column');
  put(-400, 416, 124, 400, 420, 152, M(WOOD), 'mezz fascia');
  sign(0, 415, 138, [0, -1], 150, 9, 'B R I C K W E L L   T O W E R', [126, 86, 54], TXT([255, 244, 214], 3.4, FONT.serif), { material: 'BMC_Glow', material_intensity: 1 }, 'fascia name');
  // security: turnstiles across the hall under the mezzanine, glass to the mezzanine sides
  for (let x = -180; x <= 180; x += 60) {
    put(x - 5, 466, z, x + 5, 496, z + 36, METAL(STEEL), 'turnstile'); put(x - 5, 468, z + 36, x + 5, 494, z + 38, M(BLACK), 'turnstile');
    put(x - 3, 468, z + 38, x + 3, 472, z + 40, GLOW(x === 60 ? [230, 40, 40] : [60, 220, 90], 2), 'turnstile light');
    if (x < 180) put(x + 5, 480, z + 18, x + 19, 482, z + 38, GLASS([210, 226, 232]), 'turnstile flap');
  }
  for (const s of [-1, 1]) { put(s > 0 ? 186 : -396, 478, z, s > 0 ? 396 : -186, 482, z + 46, GLASS([210, 226, 232]), 'security glass'); put(s > 0 ? 396 : -400, 450, z, s > 0 ? 400 : -396, 650, z + CH, GLASS([210, 226, 232]), 'security glass'); }
  // reception desk: stone front with the welcome, a lower work surface behind, two receptionists' chairs
  item(0, 320, 0, z, 'reception desk').b(-110, 0, 0, 110, 30, 36, M([70, 64, 60])).b(-114, -4, 36, 114, 34, 40, M([232, 228, 220]))
    .b(-110, 34, 24, 110, 60, 26, M([232, 228, 220])).b(-110, 58, 0, -106, 60, 24, M([70, 64, 60])).b(106, 58, 0, 110, 60, 24, M([70, 64, 60]))
    .b(-110, -2, 6, 110, 0, 10, GLOW([255, 220, 160], 2)).text(0, -1, 22, 0, -1, 60, 6, 'WELCOME  ·  PLEASE SIGN IN  ·  NO, THE OTHER BOOK', [70, 64, 60], TXT([236, 226, 200], 1.6, FONT.serif)).place();
  { const I = item(0, 320, 0, z, 'reception kit'); monitor(I, -50, 40); monitor(I, 40, 40); I.b(-14, 48, 26, 0, 58, 28, M([244, 244, 240])).b(80, 44, 26, 86, 50, 36, M([60, 110, 70])).place(); }
  taskChair(-50, 400, 2, z); taskChair(40, 400, 2, z);
  // lounge on a rug: two sofas, a glass coffee table, armchairs, tall plants, a floor lamp
  put(-620, 90, z, -380, 290, z + 2, M([150, 132, 108]), 'rug');
  sofa(-500, 112, 0, z + 2, 140, [70, 84, 96]); sofa(-500, 268, 2, z + 2, 140, [70, 84, 96]);
  item(-500, 190, 0, z + 2, 'coffee table').b(-40, -20, 0, -36, 20, 18, METAL([60, 60, 64])).b(36, -20, 0, 40, 20, 18, METAL([60, 60, 64])).b(-44, -24, 18, 44, 24, 20, GLASS([190, 210, 214]))
    .b(-30, -10, 20, -10, 4, 22, M([200, 40, 40])).b(10, -6, 20, 24, 12, 24, M([236, 230, 210])).place();
  armchair(-646, 190, 3, z, [150, 96, 60]); armchair(-354, 190, 1, z, [150, 96, 60]);
  for (const [x, y] of [[-660, 40], [-660, 380], [-340, 40], [-210, 40], [210, 40], [340, 40]]) plant(x, y, z, rint(90, 120), [70, 70, 74]);
  item(-380, 330, 0, z, 'floor lamp').b(-8, -8, 0, 8, 8, 2, M(BLACK)).b(-1, -1, 2, 1, 1, 90, METAL(STEEL)).b(-10, -10, 90, 10, 10, 104, { ...M([250, 240, 220]), material: 'BMC_Glow', material_intensity: 2, components: LIGHT(220, 1.4) }).place();
  // living wall: a free-standing feature wall, leaves on both faces over planters
  put(520, 120, z, 540, 380, 240, M([60, 56, 50]), 'green wall');
  for (const s of [-1, 1]) {
    const f0 = s > 0 ? 540 : 512, f1 = s > 0 ? 548 : 520;
    put(s > 0 ? 548 : 492, 120, z, s > 0 ? 568 : 512, 380, z + 18, M([160, 156, 148]), 'planter'); put(s > 0 ? 550 : 494, 122, z + 18, s > 0 ? 566 : 510, 378, z + 20, M([60, 44, 32]), 'soil');
    for (let y = 120; y < 380; y += 10) for (let zz = z + 20; zz < 236; zz += 10) {
      if (R() < 0.08) continue;
      const leaf = R() < 0.04 ? pick([[230, 200, 70], [220, 120, 150], [250, 250, 240]]) : pick([[56, 110, 44], [70, 126, 52], [44, 92, 38], [88, 142, 60], [62, 120, 70]]);
      put(f0, y, zz, f1, y + 10, Math.min(236, zz + 10), M(leaf), 'leaf');
    }
  }
  // sculpture near the entrance: stacked off-set blocks on a plinth
  put(-300, 120, z, -240, 180, z + 30, M([230, 226, 218]), 'plinth');
  for (const [k, [ox, oy, s]] of [[0, -6, 30], [8, 10, 22], [-4, 4, 18], [6, -8, 12]].entries()) put(-270 + ox - s / 2 - 0, 150 + oy - s / 2, z + 30 + k * 20 - (k ? 0 : 0), -270 + ox + s / 2, 150 + oy + s / 2, z + 30 + (k + 1) * 20, METAL(pick([[200, 60, 40], [220, 170, 60], [60, 70, 80]])), 'sculpture');
  sign(-270, 119, z + 15, [0, -1], 20, 6, '"Synergy, Probably"\nbronze, 2019', [230, 226, 218], TXT([60, 60, 60], 0.9, FONT.serif), {}, 'sculpture label');
  // the directory beside the elevator hall
  item(260, 520, 0, z, 'directory').b(-30, 0, 0, 30, 6, 2, M(BLACK)).b(-28, 2, 2, 28, 4, 110, M([30, 32, 38]))
    .text(0, -1 + 2 - 2, 60, 0, -1, 26, 46, 'BRICKWELL TOWER\n\nL   Lobby\nM   The Daily Grind (café)\n2   Reasonably Assured Mutual\n3   Pettifog, Wherewithal & Sons\n4   Nebulr\n5-6 OmniDial Outbound Solutions\n\nVisitors must sign in.\nThe 13th floor has been\nnumbered 4 for your comfort.', [30, 32, 38], TXT([230, 230, 230], 2.6, FONT.mono), { material: 'BMC_Glow', material_intensity: 1 }).place();
  // lights in the lobby's tall ceiling are hung lower: pendants on long rods
  for (const x of [-480, -240, 0, 240, 480]) for (const y of [120, 300]) {
    if (x === 0 && y === 120) continue;
    item(x, y, 0, 180, 'pendant').b(-1, -1, 30, 1, 1, 92, METAL(BLACK)).b(-14, -14, 20, 14, 14, 30, METAL([40, 40, 44])).b(-12, -12, 18, 12, 12, 20, { ...GLOW([255, 236, 200], 3), ...(R() < 0.6 ? { components: LIGHT(420, 2) } : {}) }).place();
  }
  // café mezzanine (L1): glass rail, coffee bar, menu, tables
  const m = LV(1);
  for (const [a, b2, c, d] of [[-400, 420, 400, 424], [-400, 424, -396, 650], [396, 424, 400, 650]]) { put(a, b2, m, c, d, m + 36, GLASS([200, 220, 228]), 'mezz rail'); put(a, b2, m + 36, c, d, m + 40, METAL(STEEL), 'mezz rail'); }
  item(-320, 610, 0, m, 'coffee bar').b(-70, 0, 0, 70, 30, 36, M([60, 46, 36])).b(-72, -4, 36, 72, 30, 40, M([230, 226, 218])).b(-50, 8, 40, -20, 26, 70, METAL([170, 170, 172])).b(-46, 6, 50, -24, 8, 60, M(BLACK))
    .b(10, 6, 40, 30, 26, 48, M([200, 160, 120])).b(40, 6, 46, 60, 20, 60, GLASS([200, 220, 230])).b(42, 8, 40, 58, 18, 46, M([220, 170, 110])).place();
  item(-320, 646, 0, m + 48, 'menu').b(-60, 0, 0, 60, 4, 60, M([28, 30, 30])).text(0, -1, 30, 0, -1, 56, 26, 'THE DAILY GRIND\nDrip ............ 2\nLatte ........... 5\nOat latte ....... 7\nThe Monday ..... 11\n(it is just more coffee)', [28, 30, 30], TXT([240, 236, 220], 1.9, FONT.mono)).place();
  for (const [x, y] of [[-120, 470], [20, 470], [160, 470], [300, 470], [80, 580], [240, 580]]) {
    item(x, y, 0, m, 'cafe table').b(-2, -2, 2, 2, 2, 24, METAL(BLACK)).b(-8, -8, 0, 8, 8, 2, METAL(BLACK)).b(-16, -16, 24, 16, 16, 26, M([230, 226, 218])).place();
    guestChair(x - 30, y, 1, m, [180, 120, 60], [40, 40, 44]); guestChair(x + 30, y, 3, m, [180, 120, 60], [40, 40, 44]);
  }
  plant(-380, 450, m, 80); plant(380, 450, m, 80);
}

// ---------------------------------------------------------------- tenant helpers
/** cubicle pod, 2 x 2 desks around a plus of panels; openings face +-y; px, py = low corner */
function pod(px, py, z, opts) {
  const P = { fabric: [104, 110, 120], cap: METAL([200, 200, 204]), ...opts };
  const panel = (x0, y0, x1, y1) => { put(x0, y0, z, x1, y1, z + 48, M(P.fabric), 'panel'); put(x0, y0, z + 48, x1, y1, z + 50, P.cap, 'panel cap'); };
  panel(px, py + 88, px + 180, py + 92); put(px, py + 88, z + 50, px + 180, py + 92, z + 64, FROST, 'panel glass');
  for (const [y0, y1] of [[py, py + 88], [py + 92, py + 180]]) for (const x of [px, px + 88, px + 176]) panel(x, y0, x + 4, y1);
  for (const [k, [ux, uy, q]] of [[px + 46, py, 0], [px + 134, py, 0], [px + 46, py + 180, 2], [px + 134, py + 180, 2]].entries()) cubicle(ux, uy, q, z, k, P);
}
/** a cubicle's furniture, frame origin = middle of its open side, facing in (+v) */
function cubicle(x, y, q, z, k, P) {
  if (P.vacant && R() < P.vacant) { // the empty one: a box of somebody's things on a bare desk
    item(x, y, q, z, 'cubicle').b(-40, 58, 24, 40, 84, 26, M([200, 196, 186])).b(-40, 60, 0, -38, 84, 24, M([180, 176, 166])).b(38, 60, 0, 40, 84, 24, M([180, 176, 166]))
      .b(-10, 62, 26, 14, 80, 40, M([176, 140, 96])).b(-8, 70, 40, -2, 76, 50, M([70, 130, 56])).place();
    return;
  }
  const I = item(x, y, q, z, 'cubicle')
    .b(-42, 58, 24, 42, 84, 26, M(P.desk ?? [210, 206, 196])).b(18, 6, 24, 42, 58, 26, M(P.desk ?? [210, 206, 196]))
    .b(-42, 60, 0, -22, 84, 24, METAL([150, 152, 154])).b(18, 6, 0, 42, 8, 24, M([180, 176, 166])).b(-20, 82, 4, 16, 84, 24, M([180, 176, 166]))
    .b(-40, 76, 62, 16, 84, 78, M(P.fabric.map(v => v * 0.8 | 0)));
  for (let d = 0; d < 3; d++) I.b(-38, 58, d * 8 + 4, -26, 60, d * 8 + 6, METAL([90, 90, 92]));
  monitor(I, -14, 66); monitor(I, 14, 66);
  I.b(-10, 54, 26, 10, 60, 28, M([40, 40, 44])).b(14, 55, 26, 16, 59, 28, M([40, 40, 44])).b(26, 36, 26, 34, 46, 30, M(BLACK)).b(24, 8, 0, 34, 18, 12, M([60, 60, 64]));
  junk(I, 26, 18); junk(I, -38, 64);
  if (P.names && R() < 0.6) I.text(30, 50, 29, 0, -1, 7, 3, pick(P.names), [240, 240, 236], TXT([30, 30, 34], 0.45, FONT.mono));
  if (I.place()) taskChair(...at(x, y, q, 0, 34), q, z, P.chair);
}
/** an enclosed private office: frame origin on the window plane, v into the room; furniture by rank */
function office(x, y, q, z, w, depth, rank, P) {
  const I = item(x, y, q, z, 'office desk').b(-40, 40, 24, 40, 76, 26, M(P.desk)).b(-40, 42, 0, -36, 74, 24, M(P.desk)).b(36, 42, 0, 40, 74, 24, M(P.desk)).b(-36, 72, 4, 36, 74, 24, M(P.desk));
  monitor(I, 16, 44); I.b(-14, 46, 26, 6, 52, 28, M(BLACK)).b(-30, 56, 26, -18, 66, 28, M([244, 244, 240])).b(-36, 44, 26, -32, 48, 32, M(pick([[60, 60, 140], [130, 30, 40], [40, 90, 60]])));
  junk(I, -16, 62);
  I.place();
  taskChair(...at(x, y, q, 0, 24), q, z, P.chair ?? [30, 30, 34]);
  for (const s of [-1, 1]) guestChair(...at(x, y, q, s * 18, 104), qOf(q, 0, -1), z, P.guest ?? [96, 60, 40]);
  if (P.shelf) bookshelf(...at(x, y, q, -w / 2 + 14, 70), qOf(q, -1, 0), z, Math.min(100, depth - 60), rank === 'partner' ? 104 : 96);
  plant(...at(x, y, q, w / 2 - 14, 16), z, rint(60, 90));
  if (rank === 'partner' && w > 200) sofa(...at(x, y, q, w / 2 - 28, 100), qOf(q, -1, 0), z, 60, [110, 40, 34]);
}
/** a row of offices along a facade; splits along it, the corridor wall at `wallAt` with doors; q = facing into the room from the window */
function officeRow(axis, splits, wIn, wallAt, side, z, names, P) {
  // wIn: window plane coordinate; wallAt: [t0, t1] of the corridor wall; side: +1 when the room lies at larger t than the window
  const doors = [];
  for (let i = 0; i < splits.length - 1; i++) { const a0 = splits[i], a1 = splits[i + 1]; doors.push([a1 - 52, a1 - 14, 88]); }
  wall(axis, wallAt[0], wallAt[1], splits[0], splits.at(-1), z, z + CH, M(P.wall ?? DRY), 'office wall', doors);
  const [r0, r1] = side > 0 ? [wIn, wallAt[0]] : [wallAt[1], wIn];
  for (let i = 1; i < splits.length - 1; i++) axis === 'x' ? put(splits[i] - 2, r0, z, splits[i] + 2, r1, z + CH, M(P.wall ?? DRY), 'party wall') : put(r0, splits[i] - 2, z, r1, splits[i] + 2, z + CH, M(P.wall ?? DRY), 'party wall');
  const depth = Math.abs((side > 0 ? wallAt[0] : wallAt[1]) - wIn);
  for (let i = 0; i < splits.length - 1; i++) {
    const a0 = splits[i], a1 = splits[i + 1], mid = (a0 + a1) / 2, [d0, d1] = doors[i];
    door(axis, wallAt[0], wallAt[1], d0, d1, z, 88, side > 0 ? -1 : 1, P.door ?? WOOD);
    const q = axis === 'x' ? (side > 0 ? 0 : 2) : (side > 0 ? 3 : 1);
    const rank = i === 0 || i === splits.length - 2 ? (a1 - a0 > 200 ? 'partner' : 'office') : 'office';
    office(axis === 'x' ? mid : wIn + side * 0, axis === 'x' ? wIn : mid, q, z, a1 - a0 - 4, depth, rank, P);
    if (names) { // the name on the corridor side, beside the door
      const nm = names[i % names.length], face = side > 0 ? -1 : 1, t = (side > 0 ? wallAt[0] : wallAt[1]) + face;
      axis === 'x' ? sign(d0 - 18, t, z + 62, [0, face], 14, 4, nm, P.plate ?? [200, 170, 90], TXT([30, 24, 16], 0.6, FONT.serif), { material: 'BMC_Metallic' }, 'nameplate')
        : sign(t, d0 - 18, z + 62, [face, 0], 14, 4, nm, P.plate ?? [200, 170, 90], TXT([30, 24, 16], 0.6, FONT.serif), { material: 'BMC_Metallic' }, 'nameplate');
    }
  }
}

// ---------------------------------------------------------------- L2: Reasonably Assured Mutual (cubicles)
function insurance() {
  const z = LV(2), BRAND = [30, 80, 150];
  core(2, [214, 218, 224]);
  const P = { fabric: [104, 114, 128], chair: [36, 38, 44], vacant: 0.04, names: ['G. Thornbury\nClaims', 'D. Mulch\nClaims', 'P. Okonkwo\nUnderwriting', 'Bev\n(ask Bev)', 'R. Szabo\nDenials', 'T. Lindqvist\nClaims', 'M. Ferreira\nAppeals', 'J. Park\nClaims', 'Carl\nIT, sort of', 'N. Abernathy\nFraud Desk', 'L. Duval\nClaims', 'S. Haddad\nDenials'] };
  for (const px of [-650, -350, -90, 170, 470]) for (const py of [60, 320]) pod(px, py, z, P);
  // reception facing the elevators; the logo on its front
  item(0, 580, 0, z, 'reception').b(-70, -10, 0, 70, 10, 36, M(BRAND)).b(-72, -12, 36, 72, 12, 40, M([236, 236, 232])).b(-70, -30, 24, 70, -10, 26, M([236, 236, 232]))
    .text(0, 11, 22, 0, 1, 56, 6, 'REASONABLY ASSURED MUTUAL\n"We\'ll probably cover that."', BRAND, TXT([255, 255, 255], 1.3, FONT.serif)).place();
  { const I = item(0, 580, 0, z, 'reception kit'); I.b(-20, -24, 26, -10, -16, 28, M([40, 40, 44])).b(10, -20, 26, 22, -12, 30, M([244, 244, 240])); I.place(); }
  taskChair(0, 540, 0, z);
  for (const x of [-210, -160]) guestChair(x, 610, 0, z, [70, 90, 130], [60, 60, 64]); plant(-110, 620, z, 70);
  // team-lead offices on the back windows (glass fronts), the regional manager in the corner
  for (const [x0, x1] of [[-690, -250], [250, 690]]) {
    const splits = x0 < 0 ? [-690, -540, -390, -250] : [250, 390, 540, 690];
    glassWall('x', 790, 794, x0, x1, z, z + CH, 'office glass', splits.slice(0, -1).map((s, i) => [splits[i + 1] - 52, splits[i + 1] - 14, 88]));
    for (let i = 1; i < splits.length - 1; i++) put(splits[i] - 2, 794, z, splits[i] + 2, 990, z + CH, M(DRY), 'party wall');
    for (let i = 0; i < splits.length - 1; i++) {
      const mid = (splits[i] + splits[i + 1]) / 2, corner = (x0 < 0 && i === 0) || (x0 > 0 && i === 2);
      office(mid, 990, 2, z, splits[i + 1] - splits[i] - 4, 196, corner ? 'partner' : 'office', { desk: [120, 90, 60], shelf: true, chair: [30, 30, 34] });
      sign(splits[i + 1] - 70, 789, z + 64, [0, -1], 16, 4, corner ? 'K. Rasmussen\nRegional Manager' : pick(['Team Lead, Claims', 'Team Lead, Denials', 'Senior Adjuster', 'Team Lead, Appeals', 'Compliance']), [240, 240, 236], TXT([30, 30, 34], 0.6, FONT.serif), {}, 'nameplate');
    }
  }
  // conference room (glass, frosted band) and the break room
  glassWall('y', -470, -466, 584, 716, z, z + CH, 'conference glass', [[600, 640, 88]]); glassWall('x', 580, 584, -690, -466, z, z + CH, 'conference glass');
  put(-690, 716, z, -466, 720, z + CH, M(DRY), 'conference wall');
  confTable(-580, 650, 0, z, 140, 56, 3);
  tvScreen(-580, 712, 0, z + 40, 90, 52, 'Q3 CLAIMS\nPAID ...... 12%\nDENIED .... 61%\n"PENDING" . 27%');
  put(466, 600, z, 470, 720, z + CH, M(DRY), 'break wall'); put(470, 716, z, 690, 720, z + CH, M(DRY), 'break wall');
  item(560, 702, 0, z, 'kitchenette').b(-80, -14, 0, 70, 14, 34, M([90, 70, 54])).b(-82, -16, 34, 72, 14, 36, M([226, 222, 214]))
    .b(-60, -8, 36, -36, 4, 38, METAL(STEEL)).b(-50, 6, 36, -46, 10, 50, METAL(STEEL)).b(-20, -8, 36, 4, 8, 50, M([30, 30, 32])).b(14, -6, 36, 30, 8, 54, M([40, 40, 44])).b(16, -8, 40, 28, -6, 46, GLOW([255, 120, 40], 1))
    .b(-80, 0, 70, 70, 14, 104, M([200, 186, 160])).place();
  item(670, 696, 0, z, 'fridge').b(-18, -20, 0, 18, 20, 84, M([236, 236, 232])).b(-16, -22, 50, -14, -20, 76, METAL(STEEL)).b(-16, -22, 10, -14, -20, 44, METAL(STEEL))
    .text(4, -21, 64, 0, -1, 10, 6, 'WHOEVER IS\nTAKING MY\nYOGURT: I\nHAVE A\nCLAIM NUMBER', [250, 240, 140], TXT([30, 30, 30], 0.42, FONT.mono)).place();
  for (const [x, y] of [[540, 626], [640, 660]]) {
    item(x, y, 0, z, 'break table').b(-2, -2, 2, 2, 2, 24, METAL(BLACK)).b(-10, -10, 0, 10, 10, 2, METAL(BLACK)).b(-20, -20, 24, 20, 20, 26, M([236, 236, 232])).place();
    guestChair(x - 34, y, 1, z, [200, 120, 50], [60, 60, 64]); guestChair(x + 34, y, 3, z, [200, 120, 50], [60, 60, 64]); guestChair(x, y + 34, 2, z, [200, 120, 50], [60, 60, 64]);
  }
  item(540, 626, 0, z, 'birthday').b(-8, -8, 26, 8, 8, 32, M([250, 250, 250])).b(-6, -6, 32, 6, 6, 34, M([240, 120, 160])).b(-1, -1, 34, 1, 1, 38, GLOW([255, 200, 80], 2)).place();
  vending(420, 560, 0, z, 'snack'); waterCooler(-300, 620, 0, z); copier(-400, 560, 0, z);
  for (let x = -330; x <= -264; x += 22) fileCabinet(x, 540, 0, z, 4);
  sign(-580, 721, z + 70, [0, 1], 30, 10, 'EMPLOYEE OF THE MONTH\nBev\n(every month since 2011)', [180, 150, 60], TXT([30, 30, 30], 0.9, FONT.serif), { material: 'BMC_Metallic' }, 'plaque');
  for (const [x, y] of [[-670, 30], [670, 30], [-670, 540], [670, 540]]) plant(x, y, z, rint(70, 100));
  ceiling(OPEN_CEIL, z + CH);
}

// ---------------------------------------------------------------- L3: Pettifog, Wherewithal & Sons (offices off a corridor)
function lawFirm() {
  const z = LV(3), P = { desk: [96, 62, 40], shelf: true, wall: [214, 204, 186], door: [110, 72, 44], guest: [120, 46, 40], chair: [40, 26, 22] };
  core(3, [120, 84, 56]);
  const NAMES = ['J. Pettifog III\nSenior Partner', 'A. Wherewithal\nPartner', 'R. Wherewithal\nAssociate', 'M. Quibble\nAssociate', 'D. Sons\nOf Counsel', 'H. Moot\nAssociate', 'C. Pettifog\nPartner', 'E. Writ\nAssociate', 'L. Tort-Nguyen\nAssociate', 'B. Habeas\nAssociate', 'S. Estoppel\nPartner', 'F. Retainer\nBilling', 'O. Dicta\nAssociate', 'V. Affidavit\nAssociate', 'I. Lien\nAssociate', 'T. Recusal\nPartner'];
  let nk = 0; const nm = n => Array.from({ length: n }, () => NAMES[nk++ % NAMES.length]);
  officeRow('x', [-690, -450, -300, -150, 0, 150, 300, 450, 690], Y0, [200, 206], 1, z, nm(8), P);       // front windows
  officeRow('y', [266, 502, 740], -HW, [-500, -494], 1, z, nm(2), P);                                       // left windows
  officeRow('y', [266, 502, 740], HW, [494, 500], -1, z, nm(2), P);                                         // right windows
  officeRow('x', [-690, -540, -390, -250], Y1, [796, 800], -1, z, nm(3), P);                               // back windows
  officeRow('x', [250, 390, 540, 690], Y1, [796, 800], -1, z, nm(3), P);
  for (const [x0, x1] of [[-690, -494], [494, 690]]) { put(x0, 262, z, x1, 266, z + CH, M(P.wall), 'office wall'); put(x0, 740, z, x1, 744, z + CH, M(P.wall), 'office wall'); }
  // the library-conference room: glass on the corridor sides, shelves on the inner wall, a long table
  glassWall('x', 300, 304, -420, -100, z, z + CH, 'library glass'); glassWall('y', -420, -416, 304, 556, z, z + CH, 'library glass');
  glassWall('y', -104, -100, 304, 556, z, z + CH, 'library glass', [[500, 540, 88]]); put(-420, 556, z, -100, 560, z + CH, M(P.wall), 'library wall');
  for (let x = -412; x < -170; x += 64) bookshelf(x + 30, 542, 0, z, 60, 104);
  confTable(-270, 430, 0, z, 220, 60, 5, [84, 50, 32], [60, 30, 26]);
  // the firm's name on a walnut feature wall facing the front corridor; paralegals' stations in the middle
  put(-96, 300, z, 96, 306, z + CH, M([84, 54, 34]), 'feature wall');
  sign(0, 299, z + 66, [0, -1], 80, 16, 'PETTIFOG, WHEREWITHAL & SONS\nAttorneys at Length\nEst. 1922  ·  Billing since 1921', [84, 54, 34], TXT([214, 184, 110], 2.2, FONT.serif), {}, 'firm name');
  for (const [x, y] of [[150, 340], [260, 340], [370, 340], [150, 460], [260, 460], [370, 460]]) {
    const I = item(x, y, 0, z, 'paralegal desk').b(-46, 0, 24, 46, 36, 26, M([150, 116, 80])).b(-46, 2, 0, -42, 34, 24, M([150, 116, 80])).b(42, 2, 0, 46, 34, 24, M([150, 116, 80]))
      .b(-46, 36, 0, 46, 40, 44, M([90, 70, 60])).b(-30, 6, 26, -6, 30, 38, M([244, 240, 228])).b(-28, 8, 38, -8, 28, 46, M([230, 226, 212]));
    monitor(I, 16, 24); I.place(); taskChair(x, y - 16, 0, z, [40, 26, 22]);
  }
  // reception + waiting at the elevators
  item(0, 590, 0, z, 'reception').b(-70, -10, 0, 70, 10, 38, M([84, 54, 34])).b(-72, -12, 38, 72, 12, 42, M([60, 40, 26])).text(0, 11, 22, 0, 1, 40, 4, 'Please wait to be billed.', [84, 54, 34], TXT([214, 184, 110], 1, FONT.serif)).place();
  taskChair(0, 556, 0, z, [40, 26, 22]);
  for (const x of [-210, 180]) { armchair(x, 620, 0, z, [100, 34, 30]); }
  // file room and kitchen behind the reception, beside the core
  wall('y', -440, -436, 650, 740, z, z + CH, M(P.wall), 'room wall'); wall('x', 740, 744, -440, -250, z, z + CH, M(P.wall), 'room wall');
  wall('x', 646, 650, -440, -250, z, z + CH, M(P.wall), 'room wall', [[-300, -264, 88]]); door('x', 646, 650, -300, -264, z, 88, -1, P.door);
  for (let x = -418; x < -270; x += 22) fileCabinet(x, 714, 0, z, 5, [120, 110, 96]);
  wall('y', 436, 440, 650, 740, z, z + CH, M(P.wall), 'room wall'); wall('x', 740, 744, 250, 440, z, z + CH, M(P.wall), 'room wall');
  wall('x', 646, 650, 250, 440, z, z + CH, M(P.wall), 'room wall', [[264, 300, 88]]); door('x', 646, 650, 264, 300, z, 88, -1, P.door);
  item(380, 726, 0, z, 'kitchenette').b(-50, -12, 0, 50, 14, 34, M([60, 40, 26])).b(-52, -14, 34, 52, 14, 36, M([30, 30, 30])).b(-40, -6, 36, -24, 8, 52, METAL([40, 40, 40])).b(-10, -8, 36, 10, 8, 46, M([220, 220, 220])).place();
  item(300, 724, 0, z, 'fridge').b(-16, -16, 0, 16, 16, 84, METAL([180, 182, 184])).place();
  for (const [x, y] of [[-668, 236], [668, 236], [-470, 770], [470, 770], [-120, 600], [120, 600]]) plant(x, y, z, rint(70, 100), [60, 44, 30]);
  ceiling(OPEN_CEIL, z + CH, { color: [242, 238, 228] });
}

// ---------------------------------------------------------------- L4: Nebulr (startup)
function startup() {
  const z = LV(4), TEAL = [30, 170, 160];
  core(4, TEAL);
  item(-170, 649, 0, z, 'neon').text(0, 0, 112, 0, -1, 40, 10, 'nebulr', [20, 120, 114], TXT([255, 120, 220], 4.2, FONT.block), { material: 'BMC_Glow', material_intensity: 3 }).place();
  // exposed services: ducts, cable trays, pendants over the pods
  for (const y of [300, 520]) for (let x = -680; x < 680; x += 340) put(x, y - 14, 688, x + 340, y + 14, 712, METAL([190, 194, 198]), 'duct');
  for (const x of [-640, -100, 100, 640]) put(x - 6, 20, 714, x + 6, 640, 718, M(BLACK), 'cable tray');
  const clusters = [[-540, 300, 0], [-170, 130, 0], [140, 170, 0], [500, 200, 0], [-330, 430, 0], [250, 430, 0]];
  const TEAMS = ['GROWTH', 'ENG', 'VIBES', 'DATA', 'SALES', 'ENG (THE OTHER ONE)'];
  for (const [k, [x, y, q]] of clusters.entries()) {
    const I = item(x, y, q, z, 'bench pod').b(-90, -40, 24, 90, 40, 26, M([240, 240, 236])).b(-92, -2, 26, 92, 2, 44, M(pick([[240, 120, 60], [60, 160, 220], [140, 200, 80], [230, 80, 140]])));
    for (const u of [-90, 0, 88]) I.b(u, -36, 0, u + 2, 36, 24, METAL([60, 60, 64]));
    for (const s of [-1, 1]) for (const u of [-60, 0, 60]) {
      if (R() < 0.15) { I.b(u - 8, s > 0 ? 6 : -20, 26, u + 8, s > 0 ? 20 : -6, 28, M([40, 40, 44])); continue; }
      I.b(u - 8, s > 0 ? 14 : -26, 26, u + 8, s > 0 ? 26 : -14, 28, M([180, 182, 186])).b(u - 8, s > 0 ? 26 : -28, 28, u + 8, s > 0 ? 28 : -26, 40, M([180, 182, 186])).b(u - 6, s > 0 ? 24 : -26, 30, u + 6, s > 0 ? 26 : -24, 38, GLOW([200, 220, 255], 1));
      junk(I, u + 10, s > 0 ? 6 : -16);
    }
    I.text(-94, 0, 36, -1, 0, 14, 3, TEAMS[k], [240, 240, 236], TXT([30, 30, 30], 0.9, FONT.block));
    if (!I.place()) continue;
    for (const s of [-1, 1]) for (const u of [-60, 0, 60]) taskChair(x + (q % 2 ? -s * 54 : u), y + (q % 2 ? u : s * 54), s > 0 ? q + 2 : q, z, pick([[220, 80, 60], [60, 140, 210], [250, 200, 60], [40, 40, 44]]));
    item(x, y + 40, 0, 680, 'pendant').b(-1, -1, 6, 1, 1, 40, M(BLACK)).b(-10, -10, 0, 10, 10, 6, M([40, 40, 44])).b(-8, -8, -2, 8, 8, 0, { ...GLOW([255, 236, 200], 3), components: LIGHT(300, 1.8) }).place();
  }
  // glass meeting rooms and phone booths
  for (const [x0, x1, name, s] of [[-690, -480, 'ROOM: CUMULUS', 1], [480, 690, 'ROOM: NIMBUS', -1]]) {
    const inner = s > 0 ? x1 : x0;
    glassWall('x', 600, 604, x0, x1, z, z + 120, 'meeting glass'); glassWall('y', inner - (s > 0 ? 4 : 0), inner + (s > 0 ? 0 : 4), 604, 990, z, z + 120, 'meeting glass', [[640, 680, 88]]);
    put(x0, 600, z + 120, x1, 990, z + 124, M([240, 240, 238]), 'meeting roof');
    confTable((x0 + x1) / 2, 790, 1, z, 180, 56, 3, [240, 240, 236], [230, 90, 70]);
    sign((x0 + x1) / 2, 599, z + 80, [0, -1], 30, 5, name + '\nbooked by: everyone', [255, 255, 255], TXT([30, 30, 30], 1, FONT.block), {}, 'room sign');
  }
  for (const [x, c] of [[-440, [240, 120, 60]], [-370, [60, 160, 220]], [380, [140, 200, 80]]]) {
    const I = item(x, 620, 0, z, 'phone booth').b(-30, -30, 0, 30, 30, 4, M([60, 60, 64])).b(-30, 28, 4, 30, 30, 112, M(c)).b(-30, -30, 4, -28, 28, 112, GLASS()).b(28, -30, 4, 30, 28, 112, GLASS())
      .b(-30, -30, 112, 30, 30, 116, M(c)).b(-26, 18, 26, 26, 28, 28, M([240, 240, 236])).b(-6, -6, 4, 6, 6, 30, M([60, 60, 64])).b(-24, 26, 40, 24, 28, 90, M(c.map(v => v * 0.8 | 0)))
      .b(-4, -4, 108, 4, 4, 112, { ...GLOW([255, 240, 220], 2) });
    I.place();
  }
  // lounge at the front windows: rug, sofa, bean bags, ping-pong; the office dog
  put(-640, 30, z, -380, 228, z + 2, M([220, 200, 90]), 'rug');
  sofa(-510, 54, 0, z + 2, 160, [230, 90, 70]);
  for (const [x, y, c] of [[-600, 180, [60, 140, 210]], [-520, 200, [250, 200, 60]], [-430, 180, [140, 200, 80]]]) item(x, y, 0, z + 2, 'bean bag').b(-16, -16, 0, 16, 16, 10, M(c)).b(-14, -14, 10, 14, 14, 18, M(c.map(v => v * 0.92 | 0))).b(-10, -6, 18, 10, 12, 24, M(c.map(v => v * 0.86 | 0))).place();
  item(300, 60, 0, z, 'ping pong').b(-64, -36, 24, 64, 36, 26, M([30, 110, 70])).b(-64, -1, 26, -2, 1, 28, M([250, 250, 250])).b(2, -1, 26, 64, 1, 28, M([250, 250, 250])).b(-1, -36, 26, 1, 36, 36, M([240, 240, 240]))
    .b(-60, -32, 0, -56, -28, 24, M(BLACK)).b(56, -32, 0, 60, -28, 24, M(BLACK)).b(-60, 28, 0, -56, 32, 24, M(BLACK)).b(56, 28, 0, 60, 32, 24, M(BLACK)).b(20, 10, 26, 22, 12, 28, M([250, 160, 40])).place();
  item(-300, 60, 0, z, 'dog bed').b(-20, -16, 0, 20, 16, 6, M([150, 60, 50])).b(-16, -12, 6, 16, 12, 8, M([230, 200, 180]))
    .b(-10, -4, 8, 8, 6, 16, M([170, 120, 70])).b(8, -2, 8, 16, 6, 20, M([170, 120, 70])).b(16, 0, 14, 18, 2, 16, M(BLACK)).b(-14, 0, 10, -10, 2, 14, M([170, 120, 70])).place();
  sign(-300, 41, z + 14, [0, -1], 10, 3, 'CHIEF MORALE\nOFFICER: BISCUIT', [150, 60, 50], TXT([255, 255, 255], 0.5, FONT.block), {}, 'dog sign');
  // kitchen bar beside the core and an island with stools
  item(268, 830, 1, z, 'kitchen').b(-120, -16, 0, 120, 14, 34, M([240, 240, 236])).b(-122, -16, 34, 122, 16, 36, M([40, 40, 44]))
    .b(-100, -8, 36, -80, 8, 52, METAL(STEEL)).b(-60, -8, 36, -40, 8, 60, M([200, 120, 40])).b(-56, -10, 40, -52, -8, 44, METAL(STEEL)).b(-36, -10, 40, -32, -8, 44, METAL(STEEL))
    .b(-20, -10, 80, 120, 14, 82, M([150, 110, 70])).b(-20, -10, 100, 120, 14, 102, M([150, 110, 70])).place();
  item(380, 840, 0, z, 'island').b(-80, -24, 0, 80, 24, 36, M([60, 60, 64])).b(-84, -26, 36, 84, 26, 38, M([236, 236, 232])).b(-30, -10, 38, -20, 0, 50, GLASS([230, 210, 120])).b(10, -6, 38, 30, 6, 44, M([200, 60, 40])).place();
  for (const x of [320, 360, 400, 440]) stool(x, 802, z);
  // standing desks and the whiteboard wall on the left-back
  for (const [x, y] of [[-420, 700], [-320, 700], [-420, 800], [-320, 800], [-420, 900], [-320, 900]]) {
    const I = item(x, y, 0, z, 'standing desk').b(-36, 0, 38, 36, 30, 40, M([240, 240, 236])).b(-34, 10, 2, -30, 20, 38, METAL([60, 60, 64])).b(30, 10, 2, 34, 20, 38, METAL([60, 60, 64])).b(-36, 10, 0, 36, 20, 2, METAL([60, 60, 64]));
    I.b(-8, 22, 40, 8, 28, 54, M([30, 30, 34])).b(-6, 20, 42, 6, 22, 52, GLOW([200, 220, 255], 1)); I.place();
  }
  put(-252, 690, z + 20, -250, 950, z + 104, M([250, 250, 250]), 'whiteboard');
  for (let k = 0; k < 14; k++) { const yy = 700 + 2 * rint(0, 110), zz = z + 2 * rint(14, 48), len = 2 * rint(3, 15); put(-254, yy, zz, -252, Math.min(948, yy + len), zz + 2, M(pick([[30, 80, 200], [200, 40, 40], [30, 30, 30], [40, 150, 60]])), 'scribble'); }
  sign(-255, 820, z + 98, [-1, 0], 40, 4, 'Q4 OKRs: 1. Pivot  2. Pivot again  3. ???  4. IPO', [250, 250, 250], TXT([40, 40, 160], 1.2, FONT.block), {}, 'okrs');
  for (const [x, y] of [[-668, 300], [668, 300], [-100, 560], [100, 560], [668, 560], [-668, 560]]) plant(x, y, z, rint(80, 110), [240, 240, 236]);
  item(620, 500, 0, z, 'bike').b(-30, -1, 0, -10, 1, 20, M([40, 40, 44])).b(10, -1, 0, 30, 1, 20, M([40, 40, 44])).b(-10, -1, 14, 10, 1, 18, M([220, 60, 50])).b(-4, -2, 18, 4, 2, 24, M(BLACK)).place();
  // exposed ceiling: no tiles, so light the room with more pendants
  for (const x of [-560, -280, 0, 280, 560]) for (const y of [60, 240, 430]) item(x, y, 0, 680, 'pendant').b(-1, -1, 4, 1, 1, 40, M(BLACK)).b(-8, -8, 0, 8, 8, 4, M([240, 240, 236])).b(-6, -6, -2, 6, 6, 0, { ...GLOW([255, 240, 220], 3), ...(R() < 0.5 ? { components: LIGHT(320, 1.5) } : {}) }).place();
}

// ---------------------------------------------------------------- L5 + L6: OmniDial (one big room + the oversight mezzanine)
function callCentre() {
  const z = LV(5), m = LV(6), RED = [200, 40, 40];
  core(5, [70, 70, 78]); core(6, [70, 70, 78]);
  for (const [k, y] of [110, 290, 470].entries()) for (const [a0, a1] of [[-640, -110], [110, 640]]) {
    for (let u = a0; u + 52 <= a1; u += 54) {
      const x = u + 26, divider = k % 2 ? [90, 96, 110] : [150, 40, 40];
      const I = item(x, y, 0, z, 'agent seat').b(-27, -40, 24, 27, 40, 26, M([200, 200, 196])).b(-27, -2, 26, 27, 2, 46, M(divider)).b(-27, -38, 0, -25, 38, 24, METAL([70, 70, 74]));
      monitor(I, 0, -18);
      I.b(-10, -36, 26, 10, -30, 28, M([40, 40, 44])).b(14, -36, 26, 18, -26, 28, M(BLACK)).b(14, -26, 28, 18, -24, 34, M(BLACK)).b(-24, -34, 26, -16, -26, 28, M([250, 220, 60]));
      I.b(-10, 30, 26, 10, 36, 28, M([40, 40, 44])).b(-14, 2, 30, 14, 4, 46, M(BLACK)).b(-12, 4, 32, 12, 6, 44, GLOW([150, 200, 255], 1)).b(16, 26, 26, 20, 36, 28, M(BLACK)).b(16, 24, 28, 20, 26, 34, M(BLACK));
      junk(I, -24, 20);
      if (!I.place()) continue;
      taskChair(x, y - 54, 0, z, [30, 30, 34]); taskChair(x, y + 54, 2, z, [30, 30, 34]);
    }
  }
  // team lead's raised desk in the centre aisle
  item(0, 290, 0, z, 'lead pulpit').b(-60, -40, 0, 60, 40, 12, M([90, 90, 96])).b(-40, -10, 36, 40, 20, 38, M([200, 200, 196])).b(-38, -8, 12, -34, 18, 36, METAL(STEEL)).b(34, -8, 12, 38, 18, 36, METAL(STEEL)).place();
  taskChair(0, 270 - 6, 0, z + 12, RED);
  // stat screens hung on the mezzanine fascia, facing the floor
  put(-HW, 556, 840, HW, 560, 872, M([40, 40, 46]), 'fascia');
  for (const [x, t] of [[-400, 'CALLS MADE TODAY\n4,812'], [0, 'CALLS ANSWERED\n9'], [400, 'CUSTOMER SATISFACTION\nPENDING']])
    item(x, 552, 0, 776, 'stat screen').b(-110, 0, 0, 110, 4, 64, M(BLACK)).b(-106, -2, 4, 106, 0, 60, GLOW([20, 30, 40], 1.5)).text(0, -3, 32, 0, -1, 96, 22, t, [10, 16, 22], TXT([90, 255, 140], 3.2, FONT.mono), { material: 'BMC_Glow', material_intensity: 2 }).place();
  put(-260, 552, 760, 260, 556, 776, M(RED), 'ticker');
  sign(0, 551, 768, [0, -1], 120, 6, 'SMILE: THEY CAN HEAR IT  ·  ALWAYS BE DIALING  ·  LUNCH IS A STATE OF MIND', RED, TXT([255, 255, 255], 1.6, FONT.block), {}, 'ticker');
  // under the mezzanine: training room (glass), lockers, vending, water
  glassWall('x', 600, 604, -690, -300, z, z + CH, 'training glass', [[-340, -300 + 0, 88]]); glassWall('y', -304, -300, 604, 990, z, z + CH, 'training glass');
  put(-640, 960, z + 20, -360, 962, z + 96, M([250, 250, 250]), 'whiteboard');
  sign(-500, 959, z + 80, [0, -1], 120, 10, 'OBJECTION HANDLING 101\n"I\'m not interested" = "Tell me more"', [250, 250, 250], TXT([30, 30, 120], 1.6, FONT.block), {}, 'training');
  for (const y of [700, 760, 820]) for (let x = -640; x <= -380; x += 44) guestChair(x, y, 0, z, [150, 40, 40], [40, 40, 44]);
  for (let y = 680; y < 960; y += 24) item(306, y, 0, z, 'locker').b(0, 0, 0, 20, 22, 96, METAL(pick([[90, 96, 110], [96, 102, 116]]))).b(20, 6, 60, 22, 16, 62, M(BLACK)).b(20, 4, 80, 22, 18, 88, M([60, 60, 64])).place();
  vending(620, 950, 0, z, 'snack'); vending(560, 950, 0, z, 'soda'); waterCooler(660, 700, 3, z);
  for (const [x, y] of [[480, 760], [560, 840]]) { item(x, y, 0, z, 'break table').b(-8, -8, 0, 8, 8, 2, METAL(BLACK)).b(-2, -2, 2, 2, 2, 24, METAL(BLACK)).b(-18, -18, 24, 18, 18, 26, M([236, 236, 232])).place(); stool(x - 30, y, z, 24); stool(x + 30, y, z, 24); }
  for (const [x, y] of [[-670, 30], [670, 30], [-670, 540], [670, 540]]) plant(x, y, z, 100);
  ceiling([[-HW, 560, HW, 650], [-HW, 650, -250, Y1], [250, 650, HW, Y1]], z + CH);
  // the mezzanine: a glass rail along its edge, supervisors' desks right behind it looking down, glass offices behind
  put(-HW, 560, m, HW, 564, m + 36, GLASS([200, 220, 228]), 'mezz rail'); put(-HW, 560, m + 36, HW, 564, m + 40, METAL(STEEL), 'mezz rail');
  for (const x of [-620, -480, -340, 340, 480, 620]) {
    const I = item(x, 580, 2, m, 'supervisor desk').b(-50, -24, 24, 50, 10, 26, M([60, 60, 66])).b(-50, -22, 0, -46, 8, 24, M([60, 60, 66])).b(46, -22, 0, 50, 8, 24, M([60, 60, 66]));
    monitor(I, -18, -20); monitor(I, 18, -20); I.b(-10, -8, 26, 10, -2, 28, M([40, 40, 44])).b(30, -10, 26, 40, 0, 40, M([30, 30, 34])); junk(I, -40, -10);
    if (I.place()) taskChair(x, 616, 2, m, RED);
  }
  item(0, 580, 2, m, 'binoculars').b(-8, -8, 0, 8, 8, 2, M(BLACK)).b(-1, -1, 2, 1, 1, 50, M(BLACK)).b(-8, -4, 50, -2, 6, 56, M(BLACK)).b(2, -4, 50, 8, 6, 56, M(BLACK)).place();
  item(-120, 590, 0, m, 'pa desk').b(-24, -10, 0, 24, 10, 36, M([40, 40, 44])).b(-2, -2, 36, 2, 2, 52, METAL(STEEL)).b(-4, -4, 52, 4, 4, 58, M(BLACK)).text(0, -11, 20, 0, -1, 20, 4, 'PRESS TO\nMOTIVATE', [40, 40, 44], TXT([255, 80, 80], 0.8, FONT.block)).place();
  for (const [x0, x1, title] of [[-690, -470, 'D. Brannigan\nDirector of Outbound Optimism'], [-470, -250, 'S. Kowalczyk\nVP, Hanging Up']]) {
    glassWall('x', 700, 704, x0, x1, m, m + CH, 'office glass', [[x1 - 52, x1 - 14, 88]]);
    if (x0 > -690) put(x0 - 2, 704, m, x0 + 2, 990, m + CH, M(DRY), 'party wall');
    office((x0 + x1) / 2, 990, 2, m, x1 - x0 - 4, 286, 'partner', { desk: [40, 40, 44], shelf: true, chair: [20, 20, 22], guest: [150, 40, 40] });
    sign(x1 - 70, 699, m + 64, [0, -1], 22, 5, title, [240, 240, 236], TXT([30, 30, 34], 0.6, FONT.serif), {}, 'nameplate');
  }
  glassWall('x', 700, 704, 250, 690, m, m + CH, 'war room glass', [[264, 300, 88]]);
  confTable(470, 850, 0, m, 260, 70, 6, [40, 40, 44], RED);
  tvScreen(470, 980, 0, m + 30, 180, 70, 'THIS QUARTER: 3 SALES\nTARGET: 40,000\nVARIANCE: SPIRITUAL', [255, 120, 120]);
  for (const [x, y] of [[-670, 676], [670, 676], [-260, 600], [260, 600]]) plant(x, y, m, 90);
  ceiling(OPEN_CEIL, m + CH, { light: LIGHT(520, 2.2) });
}

// ---------------------------------------------------------------- roof
function roof() {
  const z = LV(7);
  // stair bulkhead with its door to the roof, the elevator overrun, HVAC, a mast, somebody's lawn chair
  wall('x', 650, 660, 120, 250, z, z + 136, M([200, 196, 188]), 'bulkhead', [[150, 190, 88]]);
  for (const [x0, x1] of [[120, 130], [240, 250]]) put(x0, 660, z, x1, 990, z + 136, M([200, 196, 188]), 'bulkhead');
  put(130, 960, z, 240, 990, z + 136, M([200, 196, 188]), 'bulkhead'); put(116, 646, z + 136, 254, 994, z + 144, METAL([80, 84, 90]), 'bulkhead roof');
  door('x', 650, 660, 150, 190, z, 88, -1, [176, 60, 40], 'roof door');
  sign(204, 649, z + 60, [0, -1], 14, 6, 'ROOF ACCESS\nAuthorized\npersonnel only\n(and Gary)', [200, 40, 40], TXT([255, 255, 255], 0.6, FONT.block), {}, 'roof sign');
  put(-116, 660, z, 116, 990, z + 88, M([186, 182, 174]), 'overrun'); put(-118, 656, z + 88, 118, 994, z + 94, METAL([80, 84, 90]), 'overrun roof');
  for (const [x, y] of [[-480, 300], [420, 300]]) {
    const I = item(x, y, 0, z, 'hvac').b(-90, -50, 0, 90, 50, 60, METAL([170, 174, 178]));
    for (const u of [-50, 0, 50]) I.b(u - 18, -18, 60, u + 18, 18, 62, M(BLACK)).b(u - 2, -16, 62, u + 2, 16, 64, METAL([120, 120, 124]));
    for (let k = -80; k < 80; k += 8) I.b(k, -52, 10, k + 4, -50, 50, METAL([140, 144, 148]));
    I.place();
  }
  for (const [x, y] of [[-200, 200], [-100, 480], [300, 520], [560, 820]]) item(x, y, 0, z, 'vent').b(-6, -6, 0, 6, 6, 30, METAL([160, 160, 164])).b(-10, -10, 30, 10, 10, 34, METAL([150, 150, 154])).place();
  item(-560, 820, 0, z, 'mast').b(-6, -6, 0, 6, 6, 4, METAL([90, 90, 94])).b(-2, -2, 4, 2, 2, 260, METAL([200, 200, 204])).b(-1, -1, 260, 1, 1, 264, GLOW([255, 30, 30], 6)).place();
  item(400, 820, 0, z, 'lawn chair').b(-14, -20, 0, -12, 20, 12, METAL(STEEL)).b(12, -20, 0, 14, 20, 12, METAL(STEEL)).b(-12, -10, 10, 12, 20, 12, M([60, 160, 120])).b(-12, -20, 12, 12, -12, 40, M([60, 160, 120]))
    .b(24, -6, 0, 40, 10, 14, M([40, 90, 200])).b(26, -4, 14, 38, 8, 16, M([250, 250, 250])).b(-30, 10, 0, -26, 14, 8, M([60, 140, 60])).place();
  for (let y = 610; y > 530; y -= 20) put(150 + (y % 40 ? 6 : 0), y - 16, z, 190 + (y % 40 ? 6 : 0), y, z + 2, M([170, 166, 158]), 'paver');
}

// ---------------------------------------------------------------- plaza
function plaza() {
  const P0 = [-700, -300, 700, 0];
  for (let x = P0[0]; x < P0[2]; x += 400) for (let y = P0[1]; y < P0[3]; y += 400) put(x, y, 0, Math.min(P0[2], x + 400), Math.min(P0[3], y + 400), 4, M([150, 150, 150]), 'plaza base');
  for (const piece of rectSub(P0, [[-160, -300, 160, 0]])) pave(piece, 8, { cols: [[192, 188, 180], [176, 172, 164]], w: 60 });
  pave([-160, -300, 160, 0], 8, { cols: [[112, 110, 108], [124, 122, 118]], w: 40 });
  for (const x of [-560, -320, 320, 560]) {
    put(x - 40, -240, 8, x + 40, -160, 30, M([170, 166, 158]), 'planter'); put(x - 36, -236, 30, x + 36, -164, 32, M([70, 52, 38]), 'soil');
    const tb = buildTree(pick(['oak', 'birch', 'oak']), rint(1, 1e6), 0.9);
    if (tb.every(b => { const [lo, hi] = worldBox({ ...b, position: [x + b.position[0], -200 + b.position[1], 32 + b.position[2]] }); return B.free(lo, hi); }))
      for (const b of tb) B.add({ ...b, position: [x + b.position[0], -200 + b.position[1], 32 + b.position[2]] }, 'plaza tree');
  }
  for (const x of [-440, 440]) item(x, -200, 0, 8, 'bench').b(-40, -12, 0, -34, 12, 16, M([60, 60, 64])).b(34, -12, 0, 40, 12, 16, M([60, 60, 64])).b(-44, -14, 16, 44, 14, 20, M([150, 110, 70])).place();
  for (let x = -150; x <= 150; x += 50) item(x, -286, 0, 8, 'bollard').b(-4, -4, 0, 4, 4, 30, METAL([60, 60, 64])).b(-4, -4, 30, 4, 4, 32, GLOW([255, 240, 210], 2)).place();
  for (const [k, x] of [520, 590, 660].entries()) item(x, -60, 0, 8, 'flagpole').b(-8, -8, 0, 8, 8, 6, M([170, 166, 158])).b(-2, -2, 6, 2, 2, 340, METAL([210, 210, 214]))
    .b(2, -1, 290, 62, 1, 330, M([[200, 40, 50], [30, 60, 140], [240, 240, 240]][k])).b(-3, -3, 340, 3, 3, 344, METAL([210, 190, 120])).place();
  item(-600, -80, 0, 8, 'bike rack').b(-50, -2, 0, -46, 2, 30, METAL(STEEL)).b(-10, -2, 0, -6, 2, 30, METAL(STEEL)).b(30, -2, 0, 34, 2, 30, METAL(STEEL)).b(-50, -2, 30, 34, 2, 34, METAL(STEEL)).place();
  item(-300, -40, 0, 8, 'smoking sign').b(-2, -2, 0, 2, 2, 50, METAL(STEEL)).b(-20, -1, 50, 20, 1, 70, M([250, 250, 250])).text(0, -2, 60, 0, -1, 18, 8, 'DESIGNATED AREA\nFOR STARING\nAT YOUR PHONE', [250, 250, 250], TXT([40, 40, 40], 0.9, FONT.block)).place();
}

// ---------------------------------------------------------------- build
slabs();
columns();
facade();
for (const f of [0, 1]) core(f, f ? [120, 84, 56] : [176, 170, 160]);
lobby();
insurance();
lawFirm();
startup();
callCentre();
roof();
plaza();
ceiling([[-400, 420, 400, 650]], LV(0) + CH);
ceiling([[-HW, Y0, HW, 650], [-HW, 650, -250, Y1], [250, 650, HW, Y1]].flatMap(r => rectSub(r, [[-400, 420, 400, 650]])), LV(1) + CH + 0, { light: LIGHT(520, 2.4) });
ceiling([[-400, 420, 400, 650]], LV(1) + CH);

const bricks = B.bricks.map(({ label, ...b }) => { const t = turnBrick(b, TURN); return { ...t, position: [t.position[0] + AT[0], t.position[1] + AT[1], t.position[2]] }; });
const badL = B.bricks.filter(b => [...b.position, ...b.size].some(v => !Number.isInteger(v)) || (b.asset !== MB && (b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2)));
if (badL.length) console.error('OFF GRID', [...new Set(badL.map(b => b.label))].join(', '));
const bad = bricks.filter(b => [...b.position, ...b.size].some(v => !Number.isInteger(v)) || (b.asset !== MB && (b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2)));
if (bad.length) throw new Error(`${bad.length} off-grid, e.g. ${JSON.stringify(bad[0])}`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bricks.json'), JSON.stringify(bricks));
fs.writeFileSync(path.join(OUT, 'add.json'), JSON.stringify({ bricks, externalAssets: EXTERNAL_ASSETS }));
if (selfHits.length) console.error('SELF OVERLAPS', selfHits.length, '\n  ' + [...new Set(selfHits.map(h => h.split(' [')[0]))].map(l => selfHits.find(h => h.startsWith(l + ' ['))).join('\n  '));
if (process.env.DROPS) console.error('DROPPED\n' + B.dropped.slice(0, +process.env.DROPS).join('\n'));
const top = Object.entries(tally).sort((a, b) => b[1] - a[1]);
console.error(`office: ${bricks.length} bricks, ${blocked.length} structural pieces blocked${blocked.length ? ' e.g.\n  ' + blocked.slice(0, 12).join('\n  ') : ''}\n${top.filter(([k]) => k.startsWith('skipped')).map(([k, n]) => k + ' ' + n).join(', ')}\n${top.filter(([k]) => !k.startsWith('skipped')).slice(0, 40).map(([k, n]) => k + ' ' + n).join(', ')}`);
