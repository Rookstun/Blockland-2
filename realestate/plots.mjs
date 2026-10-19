// REAL ESTATE plots (owner 2026-10-19: "real estate system in which areas are able to be bought and
// sold and allows the player to enter buildmode while in the area. use a zone projector and make it
// 3 studs underground. players can build on it.").
//   node realestate/plots.mjs MAPDIR [--n 8] [--out realestate]
// Finds flat open lawns in a mapgen output (top surface of colliding bricks green and dead flat over
// the lot + a 4-stud clear margin, no extras: shops/pots/bushes/spawners/npcs/gems/casino), and per lot
// writes a raised pad standing on the lawn:
//   z g .. g+4     BP_ZoneProjector (hidden, no collision) under the interior, Component_Internal_AttachedZone
//                  bIsBuildingZone (not loose: builds stay fully inside), projecting up from its top face; a micro ring around it
//   z g+4 .. g+30  dirt fill        -> the projector's top face is 30 units = 3 studs under the lot surface
//   z g+30 .. g+34 grass top        (the lot surface players build on)
//   4-stud micro wedge bank all round (wedge corners), down to the lawn; the owner's FOR SALE sign (salesign.mjs).
// The game rejects a brick inside the terrain (solid stacked columns), so "underground" = under our pad.
// Outputs: OUT/plots.json (id, centre, surface z, interior half, zone box, price) + OUT/pads.json (one
// bricks op, map owner) + OUT/clear.json (ClearRegion boxes for lawn tufts inside each pad box).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { orientFor } from '../mapgen/orient.mjs';
import { EXTERNAL_ASSETS } from '../mapgen/ruins.mjs';
import { saleSign, SIGN_FONT } from './salesign.mjs';
const ASSETS = [...EXTERNAL_ASSETS, SIGN_FONT];

const args = process.argv.slice(2);
const dir = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const N_PLOTS = +opt('n', 8), OUT = opt('out', new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const RAD = 9000, CELL = 20, NC = Math.ceil(2 * RAD / CELL);
const SPAWN = [-120, 160];                 // plaza centre: lots are picked nearest first
const SIZES = (process.env.SIZES || "48,44,40,40,36,36,32,32,32,32,28,28").split(",").map(Number); // lot width in studs, picked in this order
const BANK = 30, MARGIN = 20, ZONE_H = 1200; // bank run, clear lawn round the pad, zone height over the surface
const DEPTH = 30;                           // projector top under the surface (3 studs)

// ---- surface raster: top of colliding bricks, and whether that top is green
const top = new Float32Array(NC * NC).fill(-1e9), green = new Uint8Array(NC * NC), deco = [];
for (const f of readdirSync(dir).filter(f => f.startsWith('chunk_'))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const op of j.ops) for (const b of op.bricks || []) {
    if (b.collision === false || b.collision?.player === false) { deco.push(b); continue; } // lawn tufts, kelp, ...
    const [x, y, z] = b.position, [sx, sy, sz] = b.size?.[0] ? b.size : [5, 5, 6];
    if (Math.abs(x) - sx > RAD || Math.abs(y) - sy > RAD) continue;
    const t = z + sz, c = b.color || [0, 0, 0];
    const g = c[1] > c[0] && c[1] > c[2] && !(b.asset || '').startsWith('B_') ? 1 : 0;
    const i0 = Math.max(0, Math.floor((x - sx + RAD) / CELL)), i1 = Math.min(NC - 1, Math.floor((x + sx - 1 + RAD) / CELL));
    const j0 = Math.max(0, Math.floor((y - sy + RAD) / CELL)), j1 = Math.min(NC - 1, Math.floor((y + sy - 1 + RAD) / CELL));
    for (let i = i0; i <= i1; i++) for (let k = j0; k <= j1; k++) { const q = k * NC + i; if (t > top[q]) { top[q] = t; green[q] = g; } }
  }
}
const extras = [];
for (const f of ['shops', 'pots', 'bushes', 'spawners', 'npcs', 'gems', 'casino']) {
  try { for (const e of JSON.parse(readFileSync(`${dir}/${f}.json`, 'utf8'))) extras.push(e.at); } catch {}
}
// quest NPCs + plaza things that live outside the map dir
for (const p of [[-250, 250], [-260, -200], [250, -250], [250, 250], [-1690, 200]]) extras.push(p);

/** flat green window of half extent h (units) centred on (cx, cy): its ground z, or null */
function flatAt(cx, cy, h) {
  const i0 = Math.round((cx - h + RAD) / CELL), i1 = Math.round((cx + h + RAD) / CELL);
  const j0 = Math.round((cy - h + RAD) / CELL), j1 = Math.round((cy + h + RAD) / CELL);
  if (i0 < 0 || j0 < 0 || i1 > NC || j1 > NC) return null;
  let z = null;
  for (let k = j0; k < j1; k++) for (let i = i0; i < i1; i++) {
    const q = k * NC + i;
    if (!green[q]) return null;
    if (z === null) z = top[q]; else if (top[q] !== z) return null;
  }
  return z;
}

const plots = [];
for (const W of SIZES) {
  if (plots.length >= N_PLOTS) break;
  const H = W * 5, R = H + MARGIN;
  let best = null;
  for (let cy = -RAD + R; cy < RAD - R; cy += 40) for (let cx = -RAD + R; cx < RAD - R; cx += 40) {
    const d = Math.hypot(cx - SPAWN[0], cy - SPAWN[1]);
    if (best && d >= best.d) continue;
    if (d < 700) continue; // keep the plaza itself public
    if (plots.some(p => Math.abs(p.x - cx) < p.half + BANK + H + 200 && Math.abs(p.y - cy) < p.half + BANK + H + 200)) continue;
    if (extras.some(([ex, ey]) => Math.abs(ex - cx) < R + 30 && Math.abs(ey - cy) < R + 30)) continue;
    const z = flatAt(cx, cy, R);
    if (z === null || z < 300) continue;
    best = { d, cx, cy, z };
  }
  if (!best) { console.error(`no spot for a ${W}-stud lot`); continue; }
  plots.push({ x: best.cx, y: best.cy, g: best.z, half: H - BANK, W });
}

// ---- bricks
const bricks = [], clears = [];
const GRASS = [92, 150, 60], GRASS2 = [84, 140, 58], DIRT = [110, 80, 54], POST = [96, 70, 46];
const put = (b, x, y, z) => bricks.push({ ...b, position: [x, y, z] });
const micro = (x0, y0, z0, x1, y1, z1, color, extra = {}) => bricks.push({ asset: 'PB_DefaultMicroBrick', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...extra });
function wedge(x0, y0, z0, x1, y1, z1, dx, dy, color) {
  const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
  bricks.push({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext), color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
}
function corner(x0, y0, z0, x1, y1, z1, dx, dy, color) { // apex (high corner) toward (dx, dy)
  const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
  bricks.push({ asset: 'PB_DefaultMicroWedgeCorner', ...orientFor('PB_DefaultMicroWedgeCorner', [[dx, 0], [0, dy]], ext), color, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
}
const out = [];
plots.forEach((p, n) => {
  const id = n + 1, { x, y, g, half: I } = p;
  const S = g + 34, P = 10; // P = projector inset (micro ring) from the interior edge
  // projector + ring (z g..g+4)
  bricks.push({ asset: 'BP_ZoneProjector', size: [I - P, I - P, 2], position: [x, y, g + 2], color: [255, 255, 255],
    visibility: false, collision: false,
    components: [{ type: 'Component_Internal_AttachedZone', data: { ZoneStartDistance: 0, ZoneEndDistance: DEPTH + ZONE_H, bIsBuildingZone: true, bIsLooseZone: false, bIsShareZone: false, bWater: false } }] });
  micro(x - I, y - I, g, x + I, y - I + P, g + 4, DIRT); micro(x - I, y + I - P, g, x + I, y + I, g + 4, DIRT);
  micro(x - I, y - I + P, g, x - I + P, y + I - P, g + 4, DIRT); micro(x + I - P, y - I + P, g, x + I, y + I - P, g + 4, DIRT);
  // fill + grass (split into <= 400-unit slabs)
  for (let a = x - I; a < x + I; a += 400) for (let b = y - I; b < y + I; b += 400) {
    const a1 = Math.min(x + I, a + 400), b1 = Math.min(y + I, b + 400);
    micro(a, b, g + 4, a1, b1, S - 4, DIRT); micro(a, b, S - 4, a1, b1, S, GRASS);
  }
  // bank: wedges down to the lawn, corners
  const B = BANK;
  wedge(x + I, y - I, g, x + I + B, y + I, S, -1, 0, GRASS2); wedge(x - I - B, y - I, g, x - I, y + I, S, 1, 0, GRASS2);
  wedge(x - I, y + I, g, x + I, y + I + B, S, 0, -1, GRASS2); wedge(x - I, y - I - B, g, x + I, y - I, S, 0, 1, GRASS2);
  corner(x + I, y + I, g, x + I + B, y + I + B, S, -1, -1, GRASS2); corner(x - I - B, y + I, g, x - I, y + I + B, S, 1, -1, GRASS2);
  corner(x - I - B, y - I - B, g, x - I, y - I, S, 1, 1, GRASS2); corner(x + I, y - I - B, g, x + I + B, y - I, S, -1, 1, GRASS2);
  // FOR SALE sign outside the bank, on the side facing the plaza
  const fx = Math.abs(SPAWN[0] - x) > Math.abs(SPAWN[1] - y) ? Math.sign(SPAWN[0] - x) : 0, fy = fx ? 0 : Math.sign(SPAWN[1] - y);
  const ox = x + fx * (I + B + 10) + (fy ? -I + 40 : 0), oy = y + fy * (I + B + 10) + (fx ? I - 40 : 0);
  bricks.push(...saleSign(id, ox, oy, g, [fx, fy], ASSETS.length - 1, { studs: (2 * I) / 10, price: Math.round(((2 * I) / 10) ** 2 * 2 / 100) * 100 })); // the owner's FOR SALE sign, click = buy (realestate/salesign.mjs)
  // lawn decoration (tufts, clover, daisies, pebbles: collision off) touching the pad or the post:
  // one ClearRegion per brick, its own box + 1 (a box over the pad would also take walkway flags)
  for (const d of deco) {
    const [dx, dy, dz] = d.position, [sx, sy, sz] = d.size?.[0] ? d.size : [5, 5, 6], m = Math.max(sx, sy);
    const hitPad = Math.abs(dx - x) < I + B + m && Math.abs(dy - y) < I + B + m;
    const hitPost = Math.abs(dx - ox) < 40 + m && Math.abs(dy - oy) < 40 + m;
    if ((hitPad || hitPost) && dz + sz > g && dz - sz < S + 60) clears.push([dx, dy, dz, m + 1, m + 1, sz + 1]);
  }
  const studs = (2 * I) / 10, price = Math.round(studs * studs * 2 / 100) * 100;
  out.push({ id, name: `Lot ${id}`, x, y, ground: g, surface: S, half: I, studs: (2 * I) / 10, price,
    zone: { x0: x - I, x1: x + I, y0: y - I, y1: y + I, z0: S - DEPTH, z1: S + ZONE_H } });
});
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/plots.json`, JSON.stringify(out, null, 1));
writeFileSync(`${OUT}/pads.json`, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], captureMs: 2500, externalAssets: ASSETS,
  owner: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' }, bricks }] }));
writeFileSync(`${OUT}/clear.json`, JSON.stringify(clears));
console.log(JSON.stringify(out.map(p => [p.id, p.x, p.y, p.surface, p.studs, p.price])), bricks.length, 'bricks');
