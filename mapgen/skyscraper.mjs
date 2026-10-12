// A skyscraper on its own plaza island (owner 2026-10-12: "make a skyscraper").
//   node skyscraper.mjs X Y BASE GROUND [--floors 32] [--seed 1] > job.json
// X, Y: world centre of the tower; BASE: world z of the plaza top; GROUND: sea floor / pad bottom.
// Writes a bridge job ({ ops }) with every brick at world coordinates.
//
// Three setback tiers of glass curtain wall (blue glass behind steel mullions, a dark spandrel
// band at every slab), floors 96 high (an 88-high storey on an 8-high slab), office desks and
// ceiling lights on every floor, terraces with railings at each setback, a switchback stair
// in a central core from the lobby to the roof, a mechanical penthouse, a spire with a red
// beacon. Lobby doors face +y; the plaza has a fountain, planters with trees and benches.
import { makeBuilder } from './builder.mjs';

const args = process.argv.slice(2);
const [CX, CY, BASE, GROUND] = args.slice(0, 4).map(Number);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : +args[i + 1]; };
const FLOORS = opt('floors', 32), SEED = opt('seed', 1);
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile', BRICK = 'PB_DefaultBrick';
const GLASS = { color: [110, 160, 200], material: 'BMC_Glass' };
const STEEL = { color: [70, 74, 80], material: 'BMC_Metallic' };
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const B = makeBuilder();
const box = (x0, y0, z0, x1, y1, z1, b, label = 'box') => {
  if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
  B.add({ asset: MB, ...b, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }, label);
};
const pole = (x, y, z0, z1, r, b, label = 'pole') => B.add({ asset: 'PB_DefaultPole', ...b, size: [r, r, (z1 - z0) / 2], position: [x, y, (z0 + z1) / 2] }, label);
// a box split into pieces of at most `step` per side (long regular bricks are rejected in game)
const tiled = (x0, y0, z0, x1, y1, z1, b, label, step = 280) => {
  for (let x = x0; x < x1; x += step) for (let y = y0; y < y1; y += step) box(x, y, z0, Math.min(x1, x + step), Math.min(y1, y + step), z1, b, label);
};

// ---- the island: sand pad (height a multiple of 4: even half heights), a stone plaza on top
const IX = 700, IY = 750, depth = BASE - GROUND, padH = Math.floor((depth - 12) / 4) * 4;
if (padH > 0) tiled(-IX, -IY, -12 - padH, IX, IY, -12, { asset: BRICK, color: [190, 172, 128] }, 'pad');
tiled(-IX, -IY, -12, IX, IY, 0, { asset: BRICK, color: [214, 196, 142] }, 'sand');

// ---- tiers: [first floor, last floor, half width]
const H = 96, SLAB = 8;
const TIERS = [[0, Math.round(FLOORS * 0.42) - 1, 300], [Math.round(FLOORS * 0.42), Math.round(FLOORS * 0.72) - 1, 240], [Math.round(FLOORS * 0.72), FLOORS - 1, 170]];
const hwOf = f => TIERS.find(([a, b]) => f >= a && f <= b)[2];
const zOf = f => 8 + f * H;                      // top of floor f's slab (the lobby floor is the plaza + 8)
const TOP = zOf(FLOORS);                          // roof slab top

// plaza around the tower (tile, 8 high, level with the lobby floor), split round the tower
{
  const hw = TIERS[0][2], P = { asset: TILE, color: [200, 196, 188] };
  tiled(-IX, -IY, 0, IX, -hw, 8, P, 'plaza'); tiled(-IX, hw, 0, IX, IY, 8, P, 'plaza');
  tiled(-IX, -hw, 0, -hw, hw, 8, P, 'plaza'); tiled(hw, -hw, 0, IX, hw, 8, P, 'plaza');
}

// ---- the stair core (local to the tower centre), thin floating treads so every landing has headroom:
// floor landing y -60..-30 (part of the slab), flight A x -30..0 rising +y (4 treads of 12 x 20),
// mid landing y 50..80 at +48, flight B x 0..30 rising back -y to the next floor. Slab hole over y -30..80.
const HOLE = [-30, -30, 30, 80];
const CORE = [[-40, -60, -30, 90], [30, -60, 40, 90], [-30, 80, 30, 90]]; // walls: x sides, +y end (the -y side is open)
function stairFlight(f) {
  const z = zOf(f), C = { asset: BRICK, color: [150, 150, 154] };
  for (let k = 0; k < 4; k++) box(-30, -30 + 20 * k, z + 12 * k, 0, -10 + 20 * k, z + 12 * (k + 1), C, 'tread A');
  box(-30, 50, z + 40, 30, 80, z + 48, { color: [120, 120, 124] }, 'mid landing');
  for (let k = 0; k < 4; k++) box(0, 30 - 20 * k, z + 48 + 12 * k, 30, 50 - 20 * k, z + 60 + 12 * k, C, 'tread B');
}

// ---- floors
for (let f = 0; f <= FLOORS; f++) {
  const hw = f === FLOORS ? hwOf(FLOORS - 1) : hwOf(f), below = f > 0 ? hwOf(f - 1) : hw;
  const z = zOf(f) - SLAB;
  // the slab, with the stair hole (except the roof: the stair comes up through a hatch hut)
  const slab = { color: [120, 120, 124] }, roofish = f === FLOORS;
  const span = Math.max(hw, below);
  const parts = [[-span, -span, span, HOLE[1]], [-span, HOLE[3], span, span], [-span, HOLE[1], HOLE[0], HOLE[3]], [HOLE[2], HOLE[1], span, HOLE[3]]];
  for (const [a0, b0, a1, b1] of parts) box(a0, b0, z, a1, b1, z + SLAB, f === 0 ? { asset: TILE, color: [214, 210, 200] } : slab, 'slab');
  // a setback: the lower tier's roof is a terrace with a glass railing
  if (below > hw && f > 0) {
    for (const [a0, b0, a1, b1] of [[-below, -below, below, -below + 4], [-below, below - 4, below, below], [-below, -below + 4, -below + 4, below - 4], [below - 4, -below + 4, below, below - 4]])
      box(a0, b0, z + SLAB, a1, b1, z + SLAB + 36, { color: [180, 210, 230], material: 'BMC_Glass' }, 'terrace rail');
    for (const [x, y] of [[-below + 40, -below + 40], [below - 40, -below + 40], [-below + 40, below - 40], [below - 40, below - 40]]) {
      box(x - 20, y - 20, z + SLAB, x + 20, y + 20, z + SLAB + 20, { color: [130, 110, 90] }, 'planter');
      pole(x, y, z + SLAB + 20, z + SLAB + 44, 16, { color: [70, 140, 60] }, 'shrub');
    }
  }
  if (roofish) break;
  const top = zOf(f), ceil = zOf(f + 1) - SLAB;
  // facade: dark spandrel band at the slab, glass inset 6, steel mullions every 40 outside it
  for (const side of ['n', 's', 'e', 'w']) {
    const alongX = side === 'n' || side === 's', sgn = side === 'n' || side === 'e' ? 1 : -1;
    const t = sgn * hw; // the wall plane
    const span0 = -hw + 10, span1 = hw - 10;
    const wallBox = (a0, a1, t0, t1, z0, z1, b, label) => alongX ? box(a0, Math.min(t0, t1), z0, a1, Math.max(t0, t1), z1, b, label) : box(Math.min(t0, t1), a0, z0, Math.max(t0, t1), a1, z1, b, label);
    // the glass, a lobby door gap on the +y (north) face
    const door = f === 0 && side === 'n' ? [-40, 40] : null;
    for (const [a0, a1] of door ? [[span0, door[0]], [door[1], span1]] : [[span0, span1]])
      wallBox(a0, a1, t - sgn * 8, t - sgn * 4, top, ceil, GLASS, 'curtain glass');
    if (door) { // door frame and a canopy
      wallBox(door[0], door[0] + 4, t - sgn * 8, t - sgn * 4, top, ceil, STEEL, 'door frame');
      wallBox(door[1] - 4, door[1], t - sgn * 8, t - sgn * 4, top, ceil, STEEL, 'door frame');
      wallBox(door[0] + 4, door[1] - 4, t - sgn * 8, t - sgn * 4, top + 30, ceil, GLASS, 'transom');
      box(door[0] - 30, hw, top + 32, door[1] + 30, hw + 60, top + 36, STEEL, 'canopy');
    }
    if (f > 0 && below <= hw) wallBox(alongX ? -hw - 4 : -hw, alongX ? hw + 4 : hw, t, t + sgn * 4, z, z + SLAB, { color: [44, 46, 52], material: 'BMC_Metallic' }, 'spandrel'); // just outside the slab edge
    for (let a = span0; a <= span1 - 4; a += 40) {
      if (door && a + 4 > door[0] - 30 && a < door[1] + 30) continue; // clear of the canopy
      wallBox(a, a + 4, t - sgn * 4, t + sgn * 2, top, ceil, STEEL, 'mullion');
    }
  }
  // corner columns and the spandrel ring (the slab's outer 10, in steel, from below the slab to the floor)
  for (const [x, y] of [[-hw, -hw], [hw - 10, -hw], [-hw, hw - 10], [hw - 10, hw - 10]]) box(x, y, top, x + 10, y + 10, ceil, STEEL, 'corner column');
  // core walls, door gap on the open -y side
  for (const [a0, b0, a1, b1] of CORE) box(a0, b0, top, a1, b1, ceil, { asset: BRICK, color: [190, 186, 180] }, 'core wall');
  stairFlight(f);
  // ceiling lights and desks (offices on every floor above the lobby)
  const q = Math.round(hw * 0.5 / 10) * 10;
  for (const [x, y] of [[-q, -q], [q, -q], [-q, q], [q, q]]) box(x - 20, y - 20, ceil - 4, x + 20, y + 20, ceil, GLOW([255, 244, 220], 3), 'ceiling light');
  if (f === 0) {
    box(-80, 90, top, 80, 120, top + 20, { color: [60, 50, 44] }, 'reception desk');
    box(-80, 90, top + 20, 80, 120, top + 24, { color: [230, 226, 220] }, 'reception top');
    for (const x of [-hw + 40, hw - 60]) { box(x, hw - 60, top, x + 20, hw - 40, top + 16, { color: [130, 110, 90] }, 'lobby planter'); pole(x + 10, hw - 50, top + 16, top + 40, 8, { color: [70, 140, 60] }, 'lobby plant'); }
  } else {
    for (const [x, y] of [[-q - 30, -q + 30], [q - 10, -q + 30], [-q - 30, q - 50], [q - 10, q - 50]]) {
      if (Math.abs(x) < 70 && y > -80 && y < 80) continue;
      box(x, y, top, x + 40, y + 20, top + 16, { color: [150, 120, 90] }, 'desk');
      box(x + 14, y + 14, top + 16, x + 26, y + 16, top + 26, GLOW([120, 200, 255], 2), 'monitor');
    }
  }
}

// ---- roof: hatch hut over the stair, parapet, penthouse, spire with a beacon
{
  const hw = hwOf(FLOORS - 1), r = TOP;
  for (const [a0, b0, a1, b1] of CORE) box(a0, b0, r, a1, b1, r + 88, { asset: BRICK, color: [190, 186, 180] }, 'hatch wall');
  box(-40, -60, r + 88, 40, 90, r + 96, STEEL, 'hatch roof');
  for (const [a0, b0, a1, b1] of [[-hw, -hw, hw, -hw + 10], [-hw, hw - 10, hw, hw], [-hw, -hw + 10, -hw + 10, hw - 10], [hw - 10, -hw + 10, hw, hw - 10]]) {
    box(a0, b0, r, a1, b1, r + 24, STEEL, 'parapet');
    box(a0, b0, r + 24, a1, b1, r + 28, GLOW([200, 230, 255], 3), 'crown light');
  }
  // penthouse (mechanical floor with louvres) on the +x half, clear of the hatch
  const px0 = 60, px1 = hw - 30, py0 = -hw + 30, py1 = hw - 30;
  box(px0, py0, r, px1, py1, r + 72, { color: [96, 100, 106] }, 'penthouse');
  for (let z = r + 12; z < r + 64; z += 12) box(px1, py0 + 20, z, px1 + 4, py1 - 20, z + 4, STEEL, 'louvre');
  box(px0 - 10, py0 - 10, r + 72, px1 + 10, py1 + 10, r + 80, STEEL, 'penthouse roof');
  // the spire on the penthouse
  const sx = Math.round((px0 + px1) / 20) * 10, sy = Math.round((py0 + py1) / 20) * 10;
  let z = r + 80;
  for (const [rr, h] of [[30, 48], [22, 72], [14, 96], [8, 120], [4, 96]]) { pole(sx, sy, z, z + h, rr, STEEL, 'spire'); z += h; }
  pole(sx, sy, z, z + 12, 6, GLOW([255, 30, 30], 8), 'beacon');
}

// ---- plaza: fountain in front of the lobby, planters with trees, benches
{
  const hw = TIERS[0][2], fy0 = hw + 120, fy1 = fy0 + 160;
  box(-100, fy0, 8, 100, fy1, 20, { color: [170, 166, 160] }, 'fountain rim');
  box(-90, fy0 + 10, 20, 90, fy1 - 10, 22, { color: [80, 150, 210], material: 'BMC_Glass' }, 'fountain water');
  pole(0, (fy0 + fy1) / 2, 22, 52, 10, { color: [170, 166, 160] }, 'fountain column');
  pole(0, (fy0 + fy1) / 2, 52, 58, 24, { color: [170, 166, 160] }, 'fountain bowl');
  pole(0, (fy0 + fy1) / 2, 58, 80, 4, { color: [200, 230, 255], material: 'BMC_Glass' }, 'fountain jet');
  for (const x of [-500, -300, 300, 500]) for (const y of [-500, 500]) {
    box(x - 40, y - 40, 8, x + 40, y + 40, 24, { color: [140, 120, 100] }, 'planter');
    pole(x, y, 24, 96, 10, { color: [92, 64, 40] }, 'trunk');
    let zz = 96;
    for (const [rr, t] of [[34, 1], [46, 2], [40, 2], [24, 1]]) { pole(x, y, zz, zz + t * 12, rr, { color: [62, 128, 52] }, 'canopy'); zz += t * 12; }
  }
  for (const x of [-200, 160]) box(x, fy0 + 40, 8, x + 40, fy0 + 60, 22, { color: [126, 86, 54] }, 'bench');
}

if (B.dropped.length) { console.error(`${B.dropped.length} pieces dropped for overlapping, e.g.\n${B.dropped.slice(0, 8).join('\n')}`); }
const bricks = B.bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + CX, b.position[1] + CY, b.position[2] + BASE] }));
const bad = bricks.filter(b => [...b.position, ...b.size].some(v => v !== Math.round(v)) || (b.asset === BRICK && (b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2)));
if (bad.length) throw new Error(`${bad.length} bricks off grid, e.g. ${JSON.stringify(bad[0])}`);
console.error(`skyscraper: ${FLOORS} floors, ${bricks.length} bricks, roof at z ${BASE + TOP}`);
process.stdout.write(JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], bricks }] }));
