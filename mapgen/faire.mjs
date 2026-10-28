// Renaissance-faire buildings (2026-10-19, owner photos of a Ren faire lane: "make the spawn town look
// like this"): narrow painted shops along a gravel lane. Each building is a one or two storey box with
//   - walls painted as 2-unit pixel facades: half-timbering (close studding or braced panels with
//     diagonal / X / chevron braces, an A of struts in the gables), vertical painted boards with trim,
//     or coursed stone with quoins; timbers stand 2 proud of the plaster, openings are framed;
//   - an upper storey jettied out over curved brackets, the floor beam showing between the storeys;
//   - steep shingle roofs (height field per stud tile like georgian.mjs, flared at the eave, every
//     shingle run its own shade, bargeboards / fascia in the trim colour): front gables, or a side
//     gable with one or two front cross gables (wall dormers), a ridge cap; on some a pentice (a
//     lean-to canopy) over the boardwalk on posts;
//   - booths: a wide open front with a plank counter, corner brackets in the opening, a striped
//     awning; leaded casement windows with open shutters and flower boxes; an open plank door;
//   - a boardwalk deck in front, barrels, a planter, a lantern; a blade sign on an iron rod with the
//     shop's name on both faces (KoL-ish wares); shelves of goods, a table and a lantern inside.
// Scale per BUILDING.md (player 48): ground floor top 8, ceiling 92, upper floor 100, wall plate 164.
//
//   faire({ seed, kind: 'booth'|'house'|'cottage', small }) -> { bricks, W, D, door, stand } in
//   shapedTown's frame: front on y = 0 looking -y, x 0..(W + 1) * 10, y 0..(D + 1) * 10, door = [x studs],
//   stand = [x, y, z] (a shop stand spot on the deck, button toward -y) or null
//   node mapgen/faire.mjs [seed] [kind] [out.json]      (bricks for isoview.mjs)
//   node mapgen/faire.mjs --test N                      (N seeds of every kind, throws on any overlap)

import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { orientFor, ORIENT, worldBox } from './orient.mjs';
import { FIXED } from './builder.mjs';
import { plaque } from './ruins.mjs';

const MB = 'PB_DefaultMicroBrick';
const GLASS = { color: [176, 204, 214], material: 'BMC_Glass' };
const LEAD = [54, 54, 60];
const GLOW = (color, i = 4) => ({ color, material: 'BMC_Glow', material_intensity: i });
const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const hash = (...a) => { let h = 2166136261; for (const v of a) { h ^= (v * 374761393) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; } return ((h >>> 0) % 100000) / 100000; };

// colour schemes after the photos (ground finish / colour, upper finish / colour, timbers, trim = doors,
// shutters, bargeboards, sign; roof shingles)
const SHAKE = [140, 134, 124], WEATHER = [124, 120, 114], CEDAR = [176, 116, 72], SLATE = [98, 100, 106], PALE = [156, 152, 144];
export const SCHEMES = [
  { name: 'tudor',   ground: 'stone',  gc: [150, 140, 124], upper: 'close',  uc: [234, 224, 198], timber: [72, 52, 38],   trim: [118, 42, 40],  roof: SHAKE },
  { name: 'sage',    ground: 'boards', gc: [116, 152, 112], upper: 'braced', uc: [120, 156, 116], timber: [104, 36, 44],  trim: [104, 36, 44],  roof: WEATHER, frame: [232, 216, 172] },
  { name: 'ochre',   ground: 'boards', gc: [214, 170, 100], upper: 'boards', uc: [214, 170, 100], timber: [176, 52, 40],  trim: [176, 52, 40],  roof: CEDAR },
  { name: 'blue',    ground: 'braced', gc: [240, 240, 234], upper: 'braced', uc: [240, 240, 234], timber: [52, 74, 150],  trim: [52, 74, 150],  roof: SLATE },
  { name: 'mustard', ground: 'boards', gc: [196, 160, 84],  upper: 'braced', uc: [224, 198, 124], timber: [62, 86, 56],   trim: [140, 40, 50],  roof: WEATHER },
  { name: 'teal',    ground: 'braced', gc: [236, 234, 224], upper: 'close',  uc: [236, 234, 224], timber: [44, 110, 104], trim: [128, 62, 128], roof: PALE },
  { name: 'barn',    ground: 'boards', gc: [150, 54, 44],   upper: 'boards', uc: [150, 54, 44],   timber: [232, 222, 196], trim: [232, 222, 196], roof: SHAKE },
  { name: 'slate',   ground: 'boards', gc: [128, 146, 160], upper: 'close',  uc: [228, 220, 200], timber: [62, 48, 38],   trim: [62, 48, 38],   roof: PALE },
  { name: 'moss',    ground: 'stone',  gc: [138, 132, 120], upper: 'braced', uc: [232, 226, 206], timber: [88, 60, 40],   trim: [60, 96, 64],   roof: CEDAR },
  { name: 'rose',    ground: 'braced', gc: [226, 196, 186], upper: 'braced', uc: [226, 196, 186], timber: [84, 54, 44],   trim: [44, 70, 54],   roof: SHAKE },
];
// shop signs (KoL-ish wares; two lines: what, and the fine print)
export const FAIRE_SIGNS = [
  'TURKEY LEGS\nNOT OUR TURKEY', 'MEAD\nHONEY, BUT ANGRY', 'CHAINMAIL\nHOLES INCLUDED', 'BOOTS\nSOLD IN PAIRS', 'PEWTER\nBASICALLY SILVER',
  'CANDLES\nSMELL LIKE CANDLES', 'FORTUNES\nMOSTLY BAD NEWS', 'KILTS\nAIRFLOW GUARANTEED', 'TANKARDS\nEMPTY, SADLY', 'PICKLES\nON A STICK',
  'FAIRY WINGS\nDO NOT FLY', 'HATS\nFOR YOUR HEAD', 'LUTES\nKNOWS ONE SONG', 'SOAP\nTRY IT SOMETIME', 'CLOAKS\nDRAMATIC SWISH',
  'MAPS\nDRAWN FROM MEMORY', 'HONEY\nBEES SOLD SEPARATELY', 'ROPE\nLONG ENOUGH', 'WIGS\nREAL HAIR, PROBABLY', 'MUSHROOMS\nTHE NORMAL KIND',
  'GOBLETS\nFOR GOBLING', 'TAROT\nTHE TOWER AGAIN', 'LEATHER\nFORMERLY A COW', 'PRETZELS\nKNOTTED BY HAND', 'CHEESE\nAGED, LIKE US',
  'POTIONS\nSIDE EFFECTS VARY', 'DRAGONS\nSOLD OUT', 'GARLANDS\nFLOWERS ON A RING', 'JESTER HATS\nBELLS EXTRA', 'SPICED NUTS\nNUTS, SPICED',
];
const FONTS = [1, 2, 3, 4]; // ruins.mjs EXTERNAL_ASSETS: Cinzel, PirataOne, Gotfridus, EagleLake
const BLOOMS = [[220, 50, 60], [240, 200, 50], [160, 90, 200], [245, 245, 240], [245, 140, 50], [240, 130, 170]];
const GOODS = [[220, 60, 40], [240, 200, 60], [120, 200, 70], [180, 120, 60], [90, 140, 220], [200, 200, 210], [150, 80, 160], [110, 70, 40]];
const CLOTH = [[200, 50, 50], [50, 110, 190], [230, 180, 40], [60, 150, 80], [140, 60, 160]];
const WOOD = [[128, 92, 60], [116, 82, 54], [140, 102, 68]];

export function faire({ seed = 1, kind = 'booth', small = false, tiers = ['bronze', 'iron'] } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const span10 = (a, b) => a + 10 * Math.floor(r() * ((b - a) / 10 + 1));
  const B = makeBuilder();
  const sc = pick(SCHEMES);
  // ------------------------------------------------------------- frame --
  // layouts: 'shop' = the owner's drawn plan (2026-10-19: back room behind an L counter with the shopkeeper,
  // shelves and racks in it, sword racks on the side walls, a display case under the front window, two doors
  // onto the boardwalk), 'stall' = counter or open-bay booth, 'house', 'cottage'. Bigger than the first
  // version (owner: "slightly longer deeper"), houses often double width.
  const dbl = kind === 'house' && !small && r() < 0.5;
  const layout0 = kind === 'booth' ? (r() < 0.75 ? 'shop' : 'stall') : kind === 'house' && !dbl && r() < 0.5 ? 'shop' : kind;
  const storeys = kind === 'cottage' ? 1 : kind === 'booth' ? (r() < 0.4 ? 1 : 2) : 2;
  let BW = kind === 'cottage' ? span10(220, 280) : layout0 === 'shop' ? span10(280, 340) : kind === 'booth' ? span10(240, 320) : dbl ? span10(420, 500) : span10(260, 340);
  let BD = layout0 === 'shop' ? span10(260, 320) : span10(220, 280);
  if (small && layout0 !== 'shop') { BW = Math.min(BW, 240); BD = Math.min(BD, 220); }
  const layout = layout0 === 'shop' && (BW < 280 || BD < 260) ? 'stall' : layout0;
  const roofType = dbl || (BW >= 280 && r() < 0.75) || r() < 0.3 ? 'side' : 'front';
  const jetty = storeys === 2 && r() < 0.7 ? 10 : 0;
  const pentice = storeys === 2 && !jetty && r() < 0.8;
  const PD = kind === 'booth' ? 40 : 30;              // boardwalk depth
  const F = 8, GT = 92, U = 100;
  const UT = storeys === 2 ? 164 : 100;               // wall plate
  const rise = (roofType === 'front' ? BW : BD + jetty) >= 260 ? 12 : 16, fl = rise / 2;
  const OVS = 10, OVF = r() < 0.5 ? 10 : 20;
  const X0 = 30, Y0 = Math.max(PD + 20, jetty + OVF + 10, 60);
  const roofC = sc.roof, timber = sc.timber, trim = sc.trim, frameC = sc.frame ?? null;
  const signText = pick(FAIRE_SIGNS), font = pick(FONTS);
  const stats = { dropped: 0 };

  const box = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return true;
    if (!B.box(X0 + x0, Y0 + y0, z0, X0 + x1, Y0 + y1, z1, { asset: MB, ...m }, label)) throw new Error(`faire ${seed}/${kind}: ${label} dropped: ${B.dropped.at(-1)}`);
    return true;
  };
  // optional dressing: only where nothing stands yet
  const opt = (x0, y0, z0, x1, y1, z1, m, label) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
    if (!B.free([X0 + x0, Y0 + y0, z0], [X0 + x1, Y0 + y1, z1])) return false;
    return box(x0, y0, z0, x1, y1, z1, m, label);
  };
  const piece = (asset, dirs, ext, pos, color, label, must = true) => {
    const b = { asset, ...orientFor(asset, dirs, ext), color, position: [X0 + pos[0], Y0 + pos[1], pos[2]] };
    if (!B.add(b, label)) { if (must) throw new Error(`faire ${seed}/${kind}: ${label} dropped: ${B.dropped.at(-1)}`); return false; }
    return true;
  };
  // a side wedge (triangle prism) extruded along `along`, its solid right angle at the corner given by
  // world signs (0 on the extrusion axis): brackets, opening corners
  const TRI = new Map();
  function tri(x0, y0, z0, x1, y1, z1, along, corner, m, label, must = true) {
    const key = along + corner.join();
    if (!TRI.has(key)) {
      const ax = 'xyz'.indexOf(along);
      let found = null;
      for (let c = 0; c < 24 && !found; c++) {
        const z = ORIENT[c]([0, 0, 1]).map(q => q + 0);
        if (Math.abs(z[ax]) !== 1) continue;
        if (ORIENT[c]([-1, -1, 0]).map(q => q + 0).join() === corner.join()) found = c;
      }
      if (found == null) throw new Error('faire: no triangle for ' + key);
      TRI.set(key, found);
    }
    const c = TRI.get(key), ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    const size = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => ext[ORIENT[c](v).findIndex(q => q !== 0)]);
    const b = { asset: 'PB_DefaultMicroWedge', direction: c >> 2, rotation: c & 3, size, ...m, position: [X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, (z0 + z1) / 2] };
    if (!B.add(b, label)) { if (must) throw new Error(`faire ${seed}/${kind}: ${label} dropped: ${B.dropped.at(-1)}`); return false; }
    return true;
  }

  // ============================================================== ROOFS ==
  // a roof group: height field over stud tiles (tile grid offset ox, oy), the max of its roofs per corner
  function roofGroup(roofs, ox = 0, oy = 0) {
    const f = (d, k) => (k <= 10 ? (d.fl * k) / 10 : d.fl + (d.rise * (k - 10)) / 10);
    const heightAt = (d, x, y) => {
      const [x0, y0, x1, y1] = d.rect;
      const k = d.axis === 'x' ? Math.min(x - x0, x1 - x) : d.axis === 'y' ? Math.min(y - y0, y1 - y) : y - y0;
      return d.eave + f(d, k);
    };
    const covers = (d, x, y) => x >= d.rect[0] && x + 10 <= d.rect[2] && y >= d.rect[1] && y + 10 <= d.rect[3];
    const tiles = new Map(), key = (x, y) => x * 100000 + y;
    const xs = roofs.flatMap(d => [d.rect[0], d.rect[2]]), ys = roofs.flatMap(d => [d.rect[1], d.rect[3]]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 10) for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) {
      const on = roofs.filter(d => covers(d, x, y));
      if (!on.length) continue;
      const h = [[0, 0], [10, 0], [0, 10], [10, 10]].map(([a, b]) => Math.max(...on.map(d => heightAt(d, x + a, y + b))));
      const own = on.map(d => [d, [[0, 0], [10, 0], [0, 10], [10, 10]].reduce((s, [a, b]) => s + heightAt(d, x + a, y + b), 0)]).sort((p, q) => q[1] - p[1])[0][0];
      tiles.set(key(x, y), { x, y, h, d: own, base: Math.min(...h), top: Math.max(...h) });
    }
    const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const t of tiles.values()) {
      const lo = t.base, dd = t.top - lo;
      t.cap = null;
      if (!dd) continue;
      const up = t.h.map(v => v - lo >= dd / 2), n = up.filter(Boolean).length;
      if (n === 1) { const [sx, sy] = CORNER[up.indexOf(true)]; t.cap = ['PB_DefaultMicroWedgeCorner', [[sx, 0], [0, sy]], dd]; }
      else if (n === 3) { const [lx, ly] = CORNER[up.indexOf(false)]; t.cap = ['PB_DefaultMicroWedgeOuterCorner', [[-lx, 0], [0, -ly]], dd]; }
      else {
        const [a, b] = up.map((u, k) => (u ? k : -1)).filter(k => k >= 0);
        const [ax, ay] = CORNER[a], [bx, by] = CORNER[b];
        if (ax === bx) t.cap = ['PB_DefaultMicroWedge', [[ax, 0]], dd];
        else if (ay === by) t.cap = ['PB_DefaultMicroWedge', [[0, ay]], dd];
        else t.base = t.top;                          // a saddle: flat at the top
      }
    }
    const lipT = t => t.d.rise;
    const at = (x, y) => tiles.get(key(Math.floor((x - ox) / 10) * 10 + ox, Math.floor((y - oy) / 10) * 10 + oy));
    const bottom = (x, y) => { const t = at(x, y); return t ? t.base - lipT(t) : null; };
    const pointH = (x, y) => Math.max(...roofs.filter(d => x >= d.rect[0] && x <= d.rect[2] && y >= d.rect[1] && y <= d.rect[3]).map(d => heightAt(d, x, y)), -Infinity);
    function build(lipC, edgeC) {
      const edge = t => [[10, 0], [-10, 0], [0, 10], [0, -10]].some(([a, b]) => !tiles.has(key(t.x + a, t.y + b)));
      const lipColor = t => (edge(t) ? edgeC : lipC);
      const used = new Set();
      for (const t of tiles.values()) {
        if (used.has(key(t.x, t.y))) continue;
        const c0 = lipColor(t).join(), b0 = t.base, l0 = lipT(t);
        const same = (a, b) => { const o = tiles.get(key(t.x + a * 10, t.y + b * 10)); return o && !used.has(key(o.x, o.y)) && o.base === b0 && lipT(o) === l0 && lipColor(o).join() === c0; };
        let l = 1; while (l < 20 && same(0, l)) l++;
        let w = 1; grow: while (w < 20) { for (let b = 0; b < l; b++) if (!same(w, b)) break grow; w++; }
        for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) used.add(key(t.x + a * 10, t.y + b * 10));
        box(t.x, t.y, b0 - l0, t.x + w * 10, t.y + l * 10, b0, { color: lipColor(t) }, 'roof lip');
      }
      // bargeboards: under the gable-end lips a triangle from step to step, so the rake reads as a slope
      const bot = t => t.base - lipT(t);
      for (const t of tiles.values()) for (const [ex, ey] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) {
        if (tiles.has(key(t.x + ex, t.y + ey))) continue;
        const [ax, ay] = ex ? [0, 10] : [10, 0];
        const lower = [-1, 1].map(sg => { const n = tiles.get(key(t.x + sg * ax, t.y + sg * ay)); return n && !tiles.has(key(n.x + ex, n.y + ey)) && bot(n) < bot(t) ? n : null; });
        if (lower[0] && lower[1]) continue;
        const sg = lower[0] ? -1 : lower[1] ? 1 : 0, n = lower[0] ?? lower[1];
        if (!n || bot(t) - bot(n) > 24) continue;
        // the outer 4 units of the tile toward the missing neighbour
        const [x0, x1] = ex > 0 ? [t.x + 6, t.x + 10] : ex < 0 ? [t.x, t.x + 4] : [t.x, t.x + 10];
        const [y0, y1] = ey > 0 ? [t.y + 6, t.y + 10] : ey < 0 ? [t.y, t.y + 4] : [t.y, t.y + 10];
        tri(x0, y0, bot(n), x1, y1, bot(t), ex ? 'x' : 'y', ex ? [0, sg, 1] : [sg, 0, 1], { color: edgeC }, 'bargeboard', false);
      }
      // shingles: caps merged in short runs across the slope, each run its own shade
      const usedC = new Set();
      // gable-edge shingles take the trim colour, so the rake reads as one band (owner screenshot 2026-10-19:
      // shingle ends alternating with trim lips made a zigzag of teeth)
      const rake = t => {
        if (!t.cap) return false;
        if (t.cap[0] !== 'PB_DefaultMicroWedge') return [[10, 0], [-10, 0], [0, 10], [0, -10]].some(([a, b]) => !tiles.has(key(t.x + a, t.y + b)));
        const along = t.cap[1][0][0] ? [[0, 10], [0, -10]] : [[10, 0], [-10, 0]];
        return along.some(([a, b]) => !tiles.has(key(t.x + a, t.y + b)));
      };
      const ck = t => t.cap && t.cap[0] + t.cap[1].join(';') + t.cap[2] + '|' + t.base + '|' + rake(t);
      for (const t of tiles.values()) {
        if (!t.cap || usedC.has(key(t.x, t.y))) continue;
        const [asset, dirs, dz] = t.cap;
        let len = 1, px = 0, py = 0;
        if (asset === 'PB_DefaultMicroWedge') {
          [px, py] = dirs[0][0] ? [0, 1] : [1, 0];
          const max = 1 + Math.floor(hash(t.x, t.y, seed) * 3);
          while (len < max) { const o = tiles.get(key(t.x + px * len * 10, t.y + py * len * 10)); if (!o || usedC.has(key(o.x, o.y)) || ck(o) !== ck(t)) break; len++; }
        }
        for (let m = 0; m < len; m++) usedC.add(key(t.x + px * m * 10, t.y + py * m * 10));
        const ext = [px ? len * 5 : 5, py ? len * 5 : 5, dz / 2];
        const tone = [0.86, 0.93, 1, 1.05, 1.1][Math.floor(hash(t.x, t.y, seed, 7) * 5)];
        piece(asset, dirs, ext, [t.x + ext[0], t.y + ext[1], t.base + dz / 2], rake(t) ? edgeC : shade(roofC, tone), 'shingles');
      }
    }
    return { tiles, at, bottom, pointH, heightAt, build };
  }

  // the main roof (+ cross gables on a side gable)
  const RF = { x0: -OVS, x1: BW + OVS };
  const roofs = [];
  let crosses = [];
  if (roofType === 'front') roofs.push({ rect: [-OVS, -jetty - OVF, BW + OVS, BD + OVF], axis: 'x', rise, fl, eave: UT + fl });
  else {
    const R0 = [-OVF, -jetty - OVS, BW + OVF, BD + OVS];
    roofs.push({ rect: R0, axis: 'y', rise, fl, eave: UT + fl });
    const half = (R0[3] - R0[1]) / 2;
    const n = dbl || (BW >= 270 && r() < 0.6) ? 2 : 1;
    const hwMax = Math.min(Math.floor((half - 30) / 10) * 10, n === 2 ? Math.floor(BW / 40) * 10 - 10 : 90);
    const hw = Math.max(40, Math.min(hwMax, span10(50, 80)));
    const centres = n === 2 ? [Math.round(BW / 40) * 10, BW - Math.round(BW / 40) * 10] : [Math.round(BW / 20) * 10 + (r() < 0.5 ? 0 : 10 * Math.round((BW / 2 - hw - 30) / 20) * (r() < 0.5 ? -1 : 1))];
    for (const c of centres) {
      const cx0 = Math.max(0, c - hw - 10), cx1 = Math.min(BW, c + hw + 10);
      const cr = (cx1 - cx0) / 2;
      if (cr < 40 || cr + 10 > half - 20) continue;
      crosses.push({ cx0, cx1, c: (cx0 + cx1) / 2 });
      roofs.push({ rect: [cx0, R0[1], cx1, R0[1] + Math.ceil(half / 10) * 10], axis: 'x', rise, fl, eave: UT + fl });
    }
  }
  const main = roofGroup(roofs);

  // ============================================================== WALLS ==
  // a wall course on the stud grid, painted per 2 x 2 cell. axis 'x': along x at y line..line+10;
  // 'y': along y at x line..line+10. out -1 / +1 = the outside face is at the low / high side.
  // layers: core (8, the room's side), skin (2, the facade colours), relief (2 proud, timbers / trim)
  const PAINT = pick([[226, 214, 186], [196, 206, 180], [186, 200, 212], [220, 196, 150], [236, 232, 222], [200, 176, 150], [214, 188, 188]]);
  function wall(W) {
    const { axis, line, out, a0, a1, z0, z1, open = [], finish, color, corners = [false, false] } = W;
    const L = out < 0 ? { relief: [line - 2, line], skin: [line, line + 2], core: [line + 2, line + 10] }
      : { core: [line, line + 8], skin: [line + 8, line + 10], relief: [line + 10, line + 12] };
    const topAt = (a, [t0, t1]) => {
      let m = z1;
      for (const t of [t0, t1 - 1]) {
        const b = axis === 'x' ? main.bottom(a, t) : main.bottom(t, a);
        if (b != null) m = Math.min(m, b);
      }
      if (m > 2000) throw new Error(`faire ${seed}: wall ${W.name} has no roof over it`);
      return m;
    };
    const inOpen = (a, z) => open.some(o => a >= o.a0 && a < o.a1 && z >= o.z0 && z < o.z1);
    const pat = facadePattern(W);
    const emit = (layer, keyAt, matOf, label) => {
      const [t0, t1] = L[layer];
      const cols = [];
      for (let a = a0; a < a1; a += 2) cols.push(topAt(a, [t0, t1]));
      const nA = cols.length, zTop = Math.max(...cols);
      const nZ = Math.max(0, Math.ceil((zTop - z0) / 2));
      const G = new Array(nA * nZ).fill(null);
      for (let i = 0; i < nA; i++) for (let j = 0; j < nZ; j++) {
        const a = a0 + i * 2, z = z0 + j * 2;
        if (z + 2 > cols[i] || inOpen(a, z)) continue;
        G[i * nZ + j] = keyAt(a, z, cols[i]);
      }
      for (let j = 0; j < nZ; j++) for (let i = 0; i < nA; i++) {
        const k = G[i * nZ + j];
        if (k == null) continue;
        let l = 1; while (i + l < nA && l < 100 && G[(i + l) * nZ + j] === k) l++;
        let h = 1; grow: while (j + h < nZ && h < 100) { for (let q = 0; q < l; q++) if (G[(i + q) * nZ + j + h] !== k) break grow; h++; }
        for (let q = 0; q < l; q++) for (let p = 0; p < h; p++) G[(i + q) * nZ + j + p] = null;
        const a = a0 + i * 2, z = z0 + j * 2;
        if (axis === 'x') box(a, t0, z, a + l * 2, t1, z + h * 2, matOf(k), label);
        else box(t0, a, z, t1, a + l * 2, z + h * 2, matOf(k), label);
      }
    };
    const cornerCol = a => (corners[0] && a < a0 + 8) || (corners[1] && a >= a1 - 8);
    // integer keys for whole-byte RGB (2026-10-28: string keys per 2-unit cell were most of the build's GC time)
    const keyOf = c => c.length === 3 && c.every(v => (v & 255) === v) ? (c[0] << 16) | (c[1] << 8) | c[2] : c.join();
    const matOf = k => ({ color: typeof k === 'number' ? [(k >> 16) & 255, (k >> 8) & 255, k & 255] : k.split(',').map(Number) });
    const plank = [keyOf(shade(PAINT, 1)), keyOf(shade(PAINT, 0.93))];
    // inside: painted vertical planks (owner 2026-10-19)
    emit('core', (a, z, top) => (cornerCol(a) ? keyOf(pat(a, z, top)[0]) : plank[Math.floor((a - a0) / 6) % 2 ? 1 : 0]), matOf, 'wall core');
    emit('skin', (a, z, top) => keyOf(pat(a, z, top)[0]), matOf, 'wall skin');
    emit('relief', (a, z, top) => { const [c, rel] = pat(a, z, top); return rel ? keyOf(c) : null; }, matOf, 'timber');
    // wrap the proud corner posts round the corner (front / back walls own the corners)
    corners.forEach((on, e) => {
      if (!on) return;
      const a = e ? a1 - 2 : a0, wa = e ? a1 : a0 - 2;
      const tw = Math.min(topAt(a, L.relief), topAt(wa, L.relief), topAt(wa, [line, line + 10]));
      let z = z0;
      while (z < tw) {
        const [c, rel] = pat(a, z, tw);
        if (!rel) { z += 2; continue; }
        let zt = z + 2; while (zt < tw && pat(a, zt, tw)[1] && keyOf(pat(a, zt, tw)[0]) === keyOf(c)) zt += 2;
        const [t0, t1] = out < 0 ? [line - 2, line + 10] : [line, line + 12];
        if (axis === 'x') box(wa, t0, z, wa + 2, t1, zt, { color: c }, 'corner post');
        else box(t0, wa, z, t1, wa + 2, zt, { color: c }, 'corner post');
        z = zt;
      }
    });
    // braces over the framed panels (below and above the mid rail), none where an opening is near
    const Wl = { ...W, L, topAt };
    for (const [pa0, pa1] of pat.panels) {
      let ptop = Infinity;
      for (let a = pa0; a < pa1; a += 2) ptop = Math.min(ptop, topAt(a, L.relief));
      const bands = [[z0 + 8, pat.midRail], [pat.midRail + 4, Math.min(W.plate ?? UT, ptop - 4)]];
      bands.forEach(([pz0, pz1], bi) => {
        if (pz1 - pz0 < 30 || pa1 - pa0 < 16) return; // short panels: braces came out as loose triangles
        if (open.some(o => o.a0 - 6 < pa1 && o.a1 + 6 > pa0 && o.z0 - 6 < pz1 && o.z1 + 6 > pz0)) return;
        const k = Math.floor(hash(pa0, pz0, seed, 3) * 6), m = Math.round((pa0 + pa1) / 4) * 2;
        if (k === 1 || k === 2) braceBand(Wl, pa0, pa1, pz0, pz1, k === 1, timber);
        else if ((k === 3 || k === 4) && (m - pa0) % 4 === 0 && (pa1 - m) % 4 === 0) {
          // V / inverted V: two half-panel diagonals meeting in the middle
          const v = k === 3;
          if (braceBand(Wl, pa0, m, pz0, pz1, !v, timber)) braceBand(Wl, m, pa1, pz0, pz1, v, timber);
        }
        void bi;
      });
    }
    return Wl;
  }
  // facade pattern: (a, z, columnTop) -> [colour, proud]. Diagonal braces are NOT painted (stair-stepped
  // cells broke the plaster into strips, owner 2026-10-19): pattern.panels lists the framed panels and
  // wall() lays the braces over them as micro-wedge bands
  function facadePattern(W) {
    const { a0, a1, z0, open = [], finish, color, corners = [false, false], plate = UT } = W;
    const tim = finish === 'boards' || finish === 'stone' ? trim : timber;
    const frame = frameC && (finish === 'braced' || finish === 'close') ? frameC : tim;
    const posts = [];
    const in0 = a0 + (corners[0] ? 8 : 4), in1 = a1 - (corners[1] ? 8 : 4);
    if (finish === 'close') for (let a = a0 + 16; a < a1 - 16; a += 14) posts.push(a);
    if (finish === 'braced') {
      // panels a multiple of 8 wide (the brace slices need even steps), the odd remainder in the middle panel
      const span = in1 - in0, k = Math.max(0, Math.round(span / 56)), clear = span - 4 * k;
      const w8 = Math.floor(clear / (k + 1) / 8) * 8, left = clear - (k + 1) * w8;
      let a = in0;
      for (let i = 0; i < k; i++) { a += w8 + (i === Math.floor(k / 2) ? left : 0); posts.push(a); a += 4; }
    }
    const midRail = z0 === 0 ? 28 : z0 + 24;
    const nearOpen = (a, z) => open.find(o => a >= o.a0 - 4 && a < o.a1 + 4 && z >= o.z0 - 4 && z < o.z1 + 4);
    const vlines = [in0, ...posts.flatMap(p => [p, p + 4]), in1];
    const panels = [];
    for (let i = 0; i + 1 < vlines.length; i += 2) panels.push([vlines[i], vlines[i + 1]]);
    const pat = (a, z, top) => {
      const o = nearOpen(a, z);
      if (o) return [frame, true];
      if (finish === 'stone') {
        const row = Math.floor((z - z0) / 12);
        if (corners[0] && a < a0 + (row % 2 ? 12 : 20)) return [shade(color, 1.12), false];
        if (corners[1] && a >= a1 - (row % 2 ? 12 : 20)) return [shade(color, 1.12), false];
        const off = (row % 2) * 12, blk = Math.floor((a - a0 + off) / 24);
        return [shade(color, [0.9, 0.97, 1.04, 0.94, 1.08][Math.floor(hash(blk, row, seed) * 5)]), false];
      }
      const corner = (corners[0] && a < a0 + 8) || (corners[1] && a >= a1 - 8) || (!corners[0] && a < a0 + 4) || (!corners[1] && a >= a1 - 4);
      if (corner) return [tim, true];
      if (z < z0 + 8) return [tim, true];                                  // sole plate / plinth trim
      if (z >= top - 4) return [tim, true];                                // wall plate / the rake
      if (finish === 'boards') {
        const b = Math.floor((a - a0) / 6);
        return [shade(color, b % 2 ? 0.92 : 1 + (hash(b, z0, seed) - 0.5) * 0.06), false];
      }
      // timber framing
      if (posts.some(p => a >= p && a < p + 4)) return [timber, true];
      if (z >= midRail && z < midRail + 4) return [timber, true];
      if (z >= plate && z < plate + 4 && top > plate + 12) return [timber, true]; // collar in a gable
      if (finish === 'braced' && z >= plate + 4) {
        const mid = Math.round((a0 + a1) / 4) * 2;                         // gable king post
        if (a >= mid - 2 && a < mid + 2) return [timber, true];
      }
      return [color, false];
    };
    pat.panels = finish === 'braced' ? panels : [];
    pat.midRail = midRail;
    return pat;
  }
  // a brace band from one panel corner to the opposite one, of micro wedges: n slices s wide rising r each,
  // per slice the triangle under the diagonal and (after the first) the one above the line one r lower.
  // up = rises toward +a. Returns false when the panel has no even slicing.
  function braceBand(Wl, x0, x1, z0, z1, up, color) {
    const w = x1 - x0, h = z1 - z0;
    let best = 0;
    for (let n = 1; n <= 14; n++) {
      if (w % (2 * n) || h % (2 * n) || w / n < 4 || h / n < 4) continue;
      if (!best || Math.abs(h / n - 12) < Math.abs(h / best - 12)) best = n;
    }
    if (!best) return false;
    const n = best, sw = w / n, r = h / n, [t0, t1] = Wl.L.relief;
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const xi = x0 + i * sw;
      pieces.push([xi, xi + sw, z0 + i * r, z0 + (i + 1) * r, 1, -1]);
      if (i) pieces.push([xi, xi + sw, z0 + (i - 1) * r, z0 + i * r, -1, 1]);
    }
    for (const [p, q, za, zb, sa, sz] of pieces) {
      const [pa, qa, ca] = up ? [p, q, sa] : [x0 + x1 - q, x0 + x1 - p, -sa];
      if (Wl.axis === 'x') tri(pa, t0, za, qa, t1, zb, 'y', [ca, 0, sz], { color }, 'brace');
      else tri(t0, pa, za, t1, qa, zb, 'x', [0, ca, sz], { color }, 'brace');
    }
    return true;
  }

  // openings
  const op = (a0, a1, z0, z1, kind = 'win') => ({ a0, a1, z0, z1, kind });
  const doorW = 32, doorH = 64;
  const doorLeft = r() < 0.5;
  let doorA;
  if (layout === 'shop') doorA = Math.round((BW * 0.18) / 10) * 10;
  else if (kind === 'booth') doorA = doorLeft ? 30 : BW - 30 - doorW;
  else doorA = Math.round((BW / 2 - doorW / 2 + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 0 : 30)) / 10) * 10;
  const DOOR = op(doorA, doorA + doorW, F, F + doorH, 'door');
  const groundFront = [DOOR];
  // the drawn shop: a second door and a display window between them, over the case
  let DOOR2 = null, SHOPWIN = null;
  if (layout === 'shop') {
    const d2 = Math.round((BW * 0.82 - doorW) / 10) * 10;
    DOOR2 = op(d2, d2 + doorW, F, F + doorH, 'door');
    SHOPWIN = op(DOOR.a1 + 30, DOOR2.a0 - 30, F + 36, F + 64);
    groundFront.push(DOOR2, SHOPWIN);
  }
  let booth = [];
  // (owner 2026-10-19: "sometimes things can be open like this") some booths are a wide open bay at floor
  // level instead of a counter, its two plank doors swung back
  const bay = kind === 'booth' && layout !== 'shop' && r() < 0.4;
  if (bay) {
    const b0 = doorLeft ? doorA + doorW + 24 : 30, b1 = doorLeft ? BW - 30 : doorA - 24;
    const w = Math.min(100, Math.floor((b1 - b0) / 4) * 4), m = Math.round((b0 + b1) / 4) * 2;
    if (w >= 48) { booth = [op(m - w / 2, m + w / 2, F, F + 72, 'bay')]; groundFront.push(...booth); }
  } else if (kind === 'booth' && layout !== 'shop') {
    const b0 = doorLeft ? doorA + doorW + 24 : 30, b1 = doorLeft ? BW - 30 : doorA - 24;
    if (b1 - b0 >= 150) { const m = Math.round((b0 + b1) / 4) * 2; booth = [op(b0, m - 4, F + 30, F + 76, 'booth'), op(m + 4, b1, F + 30, F + 76, 'booth')]; }
    else if (b1 - b0 >= 40) booth = [op(b0, b1, F + 30, F + 76, 'booth')];
    groundFront.push(...booth);
  } else if (kind !== 'booth' && layout !== 'shop') {
    // windows either side of the door, 30 wide, 30 clear of the door and the corners
    for (const side of [-1, 1]) {
      const lo = side < 0 ? 24 : doorA + doorW + 30, hi = side < 0 ? doorA - 30 : BW - 24;
      const n = Math.floor((hi - lo + 20) / 60);
      for (let k = 0; k < n; k++) { const a = Math.round((lo + (hi - lo - 30) * (n === 1 ? 0.5 : k / (n - 1))) / 2) * 2; groundFront.push(op(a, a + 30, F + 28, F + 64)); }
    }
  }
  const upTop = storeys === 2;
  const gz0 = 0, gz1 = upTop ? GT : 10000;            // the ground storey (a one-storey wall runs up to the roof)
  const uz0 = U, uz1 = 10000;
  const fin1 = sc.ground, fin2 = sc.upper;
  const c1 = sc.gc, c2 = sc.uc;
  const winsAlong = (a0, a1, n, w, z0, z1, avoid = []) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = Math.round((a0 + ((a1 - a0) * (k + 1)) / (n + 1) - w / 2) / 2) * 2;
      if (avoid.some(([p, q]) => a < q + 12 && a + w > p - 12)) continue;
      out.push(op(a, a + w, z0, z1));
    }
    return out;
  };
  const signA = (kind === 'booth' ? doorLeft : doorA > BW / 2) ? BW - 18 : 16;
  const fitGable = (axis, line, a, w, z0, z1) => {
    for (let x = a - 4; x < a + w + 4; x += 2) { const b = axis === 'x' ? main.bottom(x, line + 5) : main.bottom(line + 5, x); if (b == null || b < z1 + 10) return false; }
    return true;
  };
  // small windows high in the gables
  const gw = (axis, line, a, w) => (fitGable(axis, line, a, w, UT + 14, UT + 38) ? [op(a, a + w, UT + 14, UT + 38)] : []);
  const W = [];
  const backG = kind === 'booth' || layout === 'shop' ? [] : winsAlong(0, BW, 1, 30, F + 28, F + 64);
  if (!upTop) {
    if (roofType === 'front') { groundFront.push(...gw('x', 0, Math.round(BW / 4) * 2 - 10, 20)); backG.push(...gw('x', BD - 10, Math.round(BW / 4) * 2 - 10, 20)); }
    for (const cr of crosses) groundFront.push(...gw('x', 0, Math.round(cr.c / 2) * 2 - 10, 20));
  }
  // ground storey: front (owns the corners), back, sides
  W.push(wall({ name: 'front', axis: 'x', line: 0, out: -1, a0: 0, a1: BW, z0: gz0, z1: gz1, open: groundFront, finish: fin1, color: c1, corners: [true, true], plate: upTop ? 10000 : UT }));
  W.push(wall({ name: 'back', axis: 'x', line: BD - 10, out: 1, a0: 0, a1: BW, z0: gz0, z1: gz1, open: backG, finish: fin1, color: c1, corners: [true, true], plate: upTop ? 10000 : UT }));
  // the stair (two storeys) runs up the side wall away from the door, toward the back
  const stairRight = doorA + doorW / 2 < BW / 2;
  const SX = stairRight ? [BW - 40, BW - 10] : [10, 40];
  const RISE = [10, 10, 10, 10, 10, 10, 10, 10, 12], TREAD = 12, YS = BD - 10 - TREAD * RISE.length;
  // the shop plan, drawn for the back room on the left; mx mirrors x when it is on the right
  const backLeft = r() < 0.5, mx = x => (backLeft ? x : BW - x), mr = (a, b) => (backLeft ? [a, b] : [BW - b, BW - a]);
  const PX = Math.round((BW * 0.6) / 10) * 10, PY = Math.round((BD * 0.5) / 10) * 10, CX0 = Math.round((BW * 0.32) / 10) * 10, CY1 = PY + Math.round((BD * 0.25) / 10) * 10;
  // stairwell opening upstairs [x0, y0, x1, y1]: side stair over the treads from the second one up; the
  // shop's stair runs along the back wall of the back room (landing x 10..40, treads to 148)
  const OPEN = layout === 'shop' ? [...mr(40 + TREAD, 40 + TREAD * RISE.length), BD - 40, BD - 10].sort((a, b) => a - b) : null;
  const OPENR = layout === 'shop' ? (() => { const [a, b] = mr(40 + TREAD, 40 + TREAD * RISE.length); return [a, BD - 40, b, BD - 10]; })() : [SX[0], YS + TREAD, SX[1], BD - 10];
  void OPEN;
  for (const [line, out] of [[0, -1], [BW - 10, 1]]) {
    const stairWall = upTop && layout !== 'shop' && (line === 0) === !stairRight;
    const sideG = BD >= 220 && !stairWall && layout !== 'shop' ? winsAlong(10, BD - 10, 1, 30, F + 28, F + 64) : [];
    if (!upTop && roofType === 'side') sideG.push(...gw('y', line, Math.round(BD / 4) * 2 - 10, 20));
    W.push(wall({ name: 'side', axis: 'y', line, out, a0: 10, a1: BD - 10, z0: gz0, z1: gz1, open: sideG, finish: fin1, color: c1, plate: upTop ? 10000 : UT }));
  }
  // gable windows (one-storey front gable: in the front / back gable; side gable: in the side gables)
  const OY0 = YS + TREAD;
  if (upTop) {
    // the floor beam between the storeys (it is the upper floor), jettied at the front
    // the upper floor: a timber beam ring (it shows between the storeys outside), plank boards inside with the
    // stairwell over the treads from the second one up
    box(0, -jetty, GT, BW, -jetty + 10, U, { color: timber }, 'floor beam');
    box(0, BD - 10, GT, BW, BD, U, { color: timber }, 'floor beam');
    box(0, -jetty + 10, GT, 10, BD - 10, U, { color: timber }, 'floor beam');
    box(BW - 10, -jetty + 10, GT, BW, BD - 10, U, { color: timber }, 'floor beam');
    for (let x = 10, k = 0; x < BW - 10; x += 10, k++) {
      const q = Math.min(BW - 10, x + 10), c = { color: shade(WOOD[k % 3], 1.05) };
      const [ox0, oy0, ox1, oy1] = OPENR;
      if (q <= ox0 || x >= ox1) { box(x, -jetty + 10, GT, q, BD - 10, U, c, 'floor planks'); continue; }
      box(Math.max(x, ox0) > x ? x : x, -jetty + 10, GT, q, oy0, U, c, 'floor planks');
      if (oy1 < BD - 10) box(x, oy1, GT, q, BD - 10, U, c, 'floor planks');
      if (x < ox0) box(x, oy0, GT, ox0, oy1, U, c, 'floor planks');
      if (q > ox1) box(ox1, oy0, GT, q, oy1, U, c, 'floor planks');
    }
    // upper storey
    const upF = [];
    for (const cr of crosses) upF.push(...winsAlong(cr.cx0, cr.cx1, 1, 28, U + 16, U + 52));
    if (!crosses.length) upF.push(...winsAlong(0, BW, BW >= 260 ? 3 : 2, 28, U + 16, U + 52, [[signA - 6, signA + 6]]));
    else if (crosses.length === 1) for (const [p, q] of [[0, crosses[0].cx0], [crosses[0].cx1, BW]]) if (q - p >= 80) upF.push(...winsAlong(p, q, 1, 24, U + 16, U + 52, [[signA - 6, signA + 6]]));
    if (roofType === 'front') upF.push(...gw('x', -jetty, Math.round(BW / 4) * 2 - 10, 20));
    for (const cr of crosses) upF.push(...gw('x', -jetty, Math.round(cr.c / 2) * 2 - 10, 20));
    W.push(wall({ name: 'ufront', axis: 'x', line: -jetty, out: -1, a0: 0, a1: BW, z0: uz0, z1: uz1, open: upF, finish: fin2, color: c2, corners: [true, true] }));
    const upB = [...winsAlong(0, BW, 2, 24, U + 16, U + 52), ...(roofType === 'front' ? gw('x', BD - 10, Math.round(BW / 4) * 2 - 10, 20) : [])];
    W.push(wall({ name: 'uback', axis: 'x', line: BD - 10, out: 1, a0: 0, a1: BW, z0: uz0, z1: uz1, open: upB, finish: fin2, color: c2, corners: [true, true] }));
    for (const [line, out] of [[0, -1], [BW - 10, 1]]) {
      const ua0 = -jetty + 10, ua1 = BD - 10;
      const upS = [...winsAlong(ua0, ua1, 1, 24, U + 16, U + 52), ...(roofType === 'side' ? gw('y', line, Math.round((ua0 + ua1) / 4) * 2 - 10, 20) : [])];
      W.push(wall({ name: 'uside', axis: 'y', line, out, a0: ua0, a1: ua1, z0: uz0, z1: uz1, open: upS, finish: fin2, color: c2 }));
    }
  }

  main.build(shade(roofC, 0.76), trim);
  // ============================================================ DRESSING ==
  const wallOf = name => W.filter(w => w.name === name);
  const dark = shade(timber, 0.8);
  // (2026-10-28, owner screenshot 'DRAGONS SOLD OUT': "remove all these stupid signs") no blade sign; signText/font still picked so nothing re-rolls
  // windows: leaded glass (2 x 2 lead grid every 8 / 10), open shutters, a flower box under each
  for (const w of W) for (const o of w.open) {
    if (o.kind !== 'win') continue;
    const { axis, L, out } = w;
    const openWin = w.name.startsWith('u') && o.z0 < UT && hash(o.a0, o.z0, seed, 41) < 0.3;
    const [g0] = [L.core[0] + 2];
    const pb = (a, b, z, zt, t0, t1, m, lab, must = true) => (axis === 'x' ? (must ? box : opt)(a, t0, z, b, t1, zt, m, lab) : (must ? box : opt)(t0, a, z, t1, b, zt, m, lab));
    const cells = [];
    const isLead = (a, z) => (a - o.a0) % 8 === 6 || (z - o.z0) % 10 === 8 || a === o.a0 || a === o.a1 - 2 || z === o.z0 || z === o.z1 - 2;
    for (let z = o.z0; z < o.z1; z += 2) {
      let a = o.a0;
      while (a < o.a1) {
        const lead = isLead(a, z);
        let b = a + 2; while (b < o.a1 && isLead(b, z) === lead) b += 2;
        cells.push([a, b, z, lead]); a = b;
      }
    }
    // merge vertically identical runs
    const runs = new Map();
    for (const [a, b, z, lead] of cells) { const k = a + ',' + b + ',' + lead; (runs.get(k) ?? runs.set(k, []).get(k)).push(z); }
    if (!openWin) for (const [k, zs] of runs) {
      const [a, b, lead] = k.split(','); zs.sort((p, q) => p - q);
      let s = zs[0], prev = s;
      for (const z of [...zs.slice(1), Infinity]) {
        if (z === prev + 2) { prev = z; continue; }
        pb(+a, +b, s, prev + 2, g0, g0 + 2, lead === 'true' ? { color: LEAD } : GLASS, 'leaded glass');
        s = z; prev = z;
      }
    }
    // shutters (beyond the proud frame) and a flower box under the sill
    const [s0, s1] = out < 0 ? [L.relief[0] - 2, L.relief[0]] : [L.relief[1], L.relief[1] + 2];
    if ((openWin || hash(o.a0, o.z0, seed, 9) < 0.8) && o.a1 - o.a0 >= 24) for (const [a, b] of [[o.a0 - 4 - 14, o.a0 - 4], [o.a1 + 4, o.a1 + 4 + 14]]) {
      if (a < w.a0 + 10 || b > w.a1 - 10) continue;
      pb(a, b, o.z0 - 2, o.z1 + 2, s0, s1, { color: trim }, 'shutter', false);
    }
    const [f0, f1] = out < 0 ? [L.relief[0] - 8, L.relief[0]] : [L.relief[1], L.relief[1] + 8];
    if (hash(o.a0, o.z0, seed, 11) < 0.75) {
      if (pb(o.a0 - 2, o.a1 + 2, o.z0 - 14, o.z0 - 6, f0, f1, { color: shade(WOOD[0], 0.9) }, 'flower box', false)) {
        for (let a = o.a0; a < o.a1; a += 4) {
          const c = hash(a, o.z0, seed, 13) < 0.35 ? [70, 130, 60] : BLOOMS[Math.floor(hash(a, o.z0, seed, 14) * BLOOMS.length)];
          const [q0, q1] = out < 0 ? [f0 + 2, f1 - 2] : [f0 + 2, f1 - 2];
          pb(a, a + 4, o.z0 - 6, o.z0 - 2 + (hash(a, seed) < 0.5 ? 2 : 0), q0, q1, { color: c }, 'blooms', false);
        }
      }
    }
  }
  const deferredDoorLanterns = []; // the bracket lanterns need the lantern builder defined further down
  // the door: open plank leaf swung in, a lantern beside it
  {
    const fw = wallOf('front')[0];
    box(DOOR.a0, 10, F, DOOR.a0 + 4, 10 + doorW - 2, F + doorH - 2, { color: trim }, 'door leaf');
    for (const [p, q] of [[DOOR.a0 - 2, DOOR.a0], [DOOR.a0 + 4, DOOR.a0 + 6]]) box(p, 10 + doorW - 10, F + 30, q, 10 + doorW - 6, F + 34, { color: [40, 40, 44] }, 'door ring');
    if (DOOR2) {
      box(DOOR2.a1 - 4, 10, F, DOOR2.a1, 10 + doorW - 2, F + doorH - 2, { color: trim }, 'door leaf');
      for (const [p, q] of [[DOOR2.a1 - 6, DOOR2.a1 - 4], [DOOR2.a1, DOOR2.a1 + 2]]) box(p, 10 + doorW - 10, F + 30, q, 10 + doorW - 6, F + 34, { color: [40, 40, 44] }, 'door ring');
    }
    deferredDoorLanterns.push(() => { for (const d of [DOOR, DOOR2].filter(Boolean)) wallLantern('x', fw.L.relief[0], -1, d.a1 + 10, F + 62) || wallLantern('x', fw.L.relief[0], -1, d.a0 - 10, F + 62); });
  }
  // booth fronts: counter through the wall, corner brackets, an awning when nothing shelters it
  const bayTables = [];
  for (const o of booth.filter(o => o.kind === 'bay')) {
    for (const [a, sgn] of [[o.a0, -1], [o.a1 - 10, 1]]) tri(a, 0, o.z1 - 10, a + 10, 10, o.z1, 'y', [sgn, 0, 1], { color: timber }, 'opening bracket');
    // the two leaves: swung out flat on the front wall, else swung in
    const fw = wallOf('front')[0], lw = (o.a1 - o.a0) / 2, [s0, s1] = [fw.L.relief[0] - 2, fw.L.relief[0]];
    const clearOf = (p, q) => p >= 10 && q <= BW - 10 && (q <= DOOR.a0 - 8 || p >= DOOR.a1 + 18) && Math.abs((p + q) / 2 - signA) > lw / 2 + 4;
    for (const [p, q, ip] of [[o.a0 - 4 - lw, o.a0 - 4, o.a0], [o.a1 + 4, o.a1 + 4 + lw, o.a1 - 4]]) {
      let done = false;
      if (clearOf(p, q)) done = opt(p, s0, F, q, s1, F + 70, { color: trim }, 'bay leaf');
      if (done) for (const z of [F + 14, F + 52]) opt(p + 2, s0 - 2, z, q - 2, s0, z + 4, { color: [40, 40, 44] }, 'strap hinge');
      else opt(ip, 10, F, ip + 4, 10 + lw, F + 70, { color: trim }, 'bay leaf');
    }
    bayTables.push(o);
  }
  for (const o of booth.filter(o => o.kind === 'booth')) {
    box(o.a0, -8, o.z0, o.a1, 18, o.z0 + 4, { color: shade(WOOD[1], 1.05) }, 'counter');
    box(o.a0 + 4, 10, F, o.a1 - 4, 14, o.z0, { color: shade(WOOD[0], 0.9) }, 'counter front');
    for (const [a, sgn] of [[o.a0, -1], [o.a1 - 10, 1]]) tri(a, 0, o.z1 - 10, a + 10, 10, o.z1, 'y', [sgn, 0, 1], { color: timber }, 'opening bracket');
    // goods on the counter
    for (let a = o.a0 + 6; a < o.a1 - 12; a += 10 + Math.floor(hash(a, seed, 21) * 3) * 2) {
      const h = 4 + 2 * Math.floor(hash(a, seed, 22) * 4), wd = 4 + 2 * Math.floor(hash(a, seed, 23) * 2);
      opt(a, 2, o.z0 + 4, a + wd, 8, o.z0 + 4 + h, { color: GOODS[Math.floor(hash(a, seed, 24) * GOODS.length)] }, 'goods');
    }
    if (!jetty && !pentice) {
      const n = Math.floor((o.a1 - o.a0 + 8) / 10), a0 = o.a0 - 4 + Math.floor(((o.a1 - o.a0 + 8) - n * 10) / 4) * 2;
      const c1 = pick(CLOTH);
      for (let k = 0; k < n; k++) piece('PB_DefaultMicroWedge', [[0, 1]], [5, 14, 6], [a0 + k * 10 + 5, -4 - 14, o.z1 + 8 + 6], k % 2 ? [236, 230, 214] : c1, 'awning', false);
    }
  }
  // jetty brackets
  if (jetty) { const nB = Math.max(1, Math.round((BW - 4) / 54)); for (let i = 0; i <= nB; i++) { const a = Math.round(((BW - 4) * i) / nB / 2) * 2; tri(a, -jetty, GT - 14, a + 4, -2, GT, 'x', [0, 1, 1], { color: timber }, 'jetty bracket', false); } }
  // pentice over the boardwalk: shed roof on posts (its own tile grid, flush on the wall face at y -2)
  if (pentice) {
    const n = Math.ceil((PD + 10) / 10), y0 = -2 - n * 10, prise = 4;
    const pf = n => (n <= 10 ? (2 * n) / 10 : 2 + (prise * (n - 10)) / 10);
    const eave = GT - 4 - pf(n * 10);
    const pg = roofGroup([{ rect: [-10, y0, BW + 10, -2], axis: 'shed', rise: prise, fl: 2, eave }], 0, y0 - Math.floor(y0 / 10) * 10);
    pg.build(shade(roofC, 0.78), trim);
    const py = -PD + 2;
    const pz = pg.bottom(0, py) ;
    const nP = Math.max(1, Math.round((BW - 6) / 80));
    for (let i = 0; i <= nP; i++) {
      const a = Math.round(((BW - 6) * i) / nP / 2) * 2;
      if (Math.abs(a + 3 - signA) > 10) box(a, py, F, a + 6, py + 6, pz, { color: trim }, 'pentice post');
    }
  }
  // boardwalk deck: planks along the front
  for (let y = -PD, k = 0; y < -2; y += 8, k++) box(-10, y, 0, BW + 10, Math.min(-2, y + 8), F, { color: shade(WOOD[k % 3], 0.95) }, 'boardwalk');
  // the shop stand spot (booths): on the deck in front of the counter, kept clear
  let stand = null;
  if (kind === 'booth' && layout !== 'shop' && booth.length) {
    const o = booth[doorLeft ? booth.length - 1 : 0];
    const sx = Math.round((o.a0 + o.a1) / 20) * 10;
    if (B.free([X0 + sx - 14, Y0 - PD + 2, F], [X0 + sx + 14, Y0 - 10, F + 60])) {
      stand = [X0 + sx, Y0 - Math.round(PD / 2), F + 12];
      box(sx - 14, -PD + 2, F, sx + 14, -10, F + 60, { color: [255, 0, 255], ghost: true }, 'stand ghost');
    }
  }
  // barrels and a planter on the deck
  for (const [a, k] of [[-6, 0], [BW - 14, 1]]) {
    if (hash(a, seed, 31) < 0.6) {
      if (B.free([X0 + a - 10, Y0 - PD + 2, F], [X0 + a + 10, Y0 - PD + 22, F + 32]) && B.pole(X0 + a, Y0 - PD + 12, F, F + 28, 10, { color: shade(WOOD[k], 0.85) }, 'barrel') && hash(a, seed, 32) < 0.6)
        for (const [u, v] of [[-6, -6], [-2, -6], [2, -6], [-6, -2], [-2, -2], [2, -2], [-6, 2], [-2, 2], [2, 2]]) opt(a + u, -PD + 12 + v, F + 28, a + u + 4, -PD + 16 + v, F + 32 + (hash(u, v, seed) < 0.4 ? 2 : 0), { color: hash(u, v, a, seed) < 0.3 ? [70, 130, 60] : BLOOMS[Math.floor(hash(u, v, seed, 7) * 2)] }, 'barrel blooms');
    }
    else if (opt(a - 8, -PD + 4, F, a + 8, -PD + 16, F + 10, { color: shade(WOOD[1], 0.8) }, 'planter'))
      for (let q = a - 6; q < a + 6; q += 4) opt(q, -PD + 6, F + 10, q + 4, -PD + 14, F + 14 + (hash(q, seed) < 0.5 ? 4 : 0), { color: hash(q, seed, 2) < 0.4 ? [70, 130, 60] : pick(BLOOMS) }, 'blooms');
  }
  // ground floor planks inside, shelves of goods on the back wall, a table, lanterns
  for (let y = 10, k = 0; y < BD - 10; y += 10, k++) box(10, y, 0, BW - 10, Math.min(BD - 10, y + 10), F, { color: shade(WOOD[k % 3], 1.05) }, 'floor planks');
  // a board partition (axis 'x' along x at y line..line+10 / 'y'), painted planks, up to the roof; a
  // timber lintel board over each doorway
  function partition(axis, line, a0, a1, z0, opens, zcap = 10000) {
    const pb = (a, q, z, zt, c) => (axis === 'x' ? box(a, line, z, q, line + 10, zt, { color: c }, 'partition') : box(line, a, z, line + 10, q, zt, { color: c }, 'partition'));
    for (let a = a0, b = 0; a < a1; a += 6, b++) {
      const q = Math.min(a1, a + 6);
      let top = 10000;
      for (const t of [line, line + 9]) for (const u of [a, q - 1]) { const v = axis === 'x' ? main.bottom(u, t) : main.bottom(t, u); if (v != null) top = Math.min(top, v); }
      top = Math.min(top, zcap);
      if (top > 2000) continue;
      const c = shade(PAINT, b % 2 ? 0.93 : 1);
      let z = z0;
      for (const o of opens.filter(o => o.a0 < q && o.a1 > a).sort((x, y) => x.z0 - y.z0)) {
        if (o.z0 > z) pb(a, q, z, Math.min(top, o.z0), c);
        z = Math.max(z, o.z1);
        if (top > z + 4) { pb(a, q, z, z + 4, timber); z += 4; }
      }
      if (top > z) pb(a, q, z, top, c);
    }
  }
  if (upTop && layout === 'shop') {
    // the shop's stair: courses along the back wall of the back room, landing at the side wall
    let z = F;
    RISE.forEach((h, k) => { const [a, b] = mr(40 + k * TREAD, 40 + TREAD * RISE.length); box(a, BD - 40, z, b, BD - 10, z + h, { color: shade(WOOD[k % 3], 1.08) }, 'stair'); z += h; });
    const [ra, rb] = mr(40 + TREAD, 40 + TREAD * RISE.length - 30);
    box(ra, BD - 42, U + 24, rb, BD - 40, U + 28, { color: timber }, 'stair rail');
    for (let x = ra; x < rb; x += 14) box(x, BD - 42, U, x + 2, BD - 40, U + 24, { color: timber }, 'baluster');
    const [ea] = mr(40 + TREAD - 2, 40 + TREAD);
    box(ea, BD - 42, U, ea + 2, BD - 10, U + 28, { color: timber }, 'stair rail');
  }
  if (upTop && layout !== 'shop') {
    // the stair: courses (one box per riser band, BUILDING.md), from the floor to the upper floor
    let z = F;
    RISE.forEach((h, k) => { box(SX[0], YS + k * TREAD, z, SX[1], BD - 10, z + h, { color: shade(WOOD[k % 3], 1.08) }, 'stair'); z += h; });
    // guard rail round the stairwell upstairs, open at the top for the 3-stud landing
    const rx = stairRight ? SX[0] - 2 : SX[1];
    const ry0 = YS + TREAD - 2, ry1 = BD - 10 - 30;
    box(rx, ry0 + 2, U + 24, rx + 2, ry1, U + 28, { color: timber }, 'stair rail');
    for (let y = ry0 + 2; y < ry1; y += 14) box(rx, y, U, rx + 2, Math.min(ry1, y + 2), U + 24, { color: timber }, 'baluster');
    box(SX[0], ry0, U, SX[1], ry0 + 2, U + 28, { color: timber }, 'stair rail');
  }
  if (upTop) {
    // upstairs: a board partition across the middle with a doorway, a bed in the room away from the stair
    const upOpen = W.filter(w => w.name === 'ufront' || w.name === 'uback').flatMap(w => w.open);
    let UPX = null;
    for (let x = 70; x <= BW - 80; x += 10) if (!upOpen.some(o => o.a0 - 6 < x + 10 && o.a1 + 6 > x) && (UPX == null || Math.abs(x - BW / 2) < Math.abs(UPX - BW / 2))) UPX = x;
    const bed = (bx0, bx1, by0, by1, headLow) => {
      if (bx1 - bx0 < 32 || by1 - by0 < 60) return;
      if (headLow) by1 = by0 + 60; else by0 = by1 - 60;
      if (!opt(bx0, by0, U, bx1, by1, U + 10, { color: WOOD[0] }, 'bed frame')) return;
      const [p0, p1, hb0, hb1] = headLow ? [by0 + 4, by0 + 14, by0, by0 + 2] : [by1 - 14, by1 - 4, by1 - 2, by1];
      opt(bx0 + 2, headLow ? by0 + 16 : by0 + 2, U + 10, bx1 - 2, headLow ? by1 - 2 : by1 - 16, U + 16, { color: pick([[140, 40, 60], [60, 90, 160], [70, 120, 70], [180, 140, 60]]) }, 'blanket');
      opt(bx0 + 4, p0, U + 10, bx1 - 4, p1, U + 16, { color: [236, 232, 222] }, 'pillow');
      opt(bx0, hb0, U + 16, bx1, hb1, U + 30, { color: WOOD[0] }, 'headboard');
    };
    if (layout === 'shop') {
      // the shop's upstairs: one room, a bed along the front wall
      bed(...mr(12, 52), -jetty + 12, -jetty + 80, true);
    } else if (UPX != null) {
      // lengthwise: the stair room and a bedroom side by side
      const dy = Math.round(((-jetty + 10) + (BD - 10)) / 20) * 10 - 40;
      partition('y', UPX, -jetty + 10, BD - 10, U, [{ a0: dy, a1: dy + 32, z0: U, z1: U + 64 }], UT - 8);
      bed(stairRight ? 12 : Math.max(UPX + 14, BW - 52), stairRight ? Math.min(UPX - 4, 52) : BW - 12, BD - 72, BD - 12, false);
    } else {
      // across: a front bedroom, the stair room behind (gable windows sit where a lengthwise wall would go)
      const sideOpen = W.filter(w => w.name === 'uside').flatMap(w => w.open);
      let UPY = null;
      for (let y = OY0 - 20; y >= -jetty + 80; y -= 10) if (!sideOpen.some(o => o.a0 - 6 < y + 10 && o.a1 + 6 > y)) { UPY = y; break; }
      if (UPY != null) {
        const da = stairRight ? 30 : BW - 62;
        partition('x', UPY, 10, BW - 10, U, [{ a0: da, a1: da + 32, z0: U, z1: U + 64 }], UT - 8);
        bed(stairRight ? BW - 52 : 12, stairRight ? BW - 12 : 52, -jetty + 12, UPY - 2, true);
      }
    }
  } else if (BD >= 220 && layout !== 'shop') {
    // one storey, deep: a back room behind a board partition with a doorway
    const BPY = BD - 10 - 80, da = Math.round(BW / 20) * 10 + (doorLeft ? 30 : -30) - 16;
    partition('x', BPY, 10, BW - 10, F, [{ a0: da, a1: da + 32, z0: F, z1: F + 64 }], UT - 8);
  }
  // ----------------------------------------------------------- stands, lanterns, decor --
  // shop stands are prefabs loaded later (mapgen shops.json): each gets a ghost box here so nothing is built
  // where it will stand. face = the way its button looks (local).
  const stands = [];
  // tables and counters show daggers only, swords stand on the wall racks' benches (owner screenshots 2026-10-19)
  // (2026-10-23, owner: "make the pedestals visible and place them not floating"): the full stand prefabs (round
  // pedestal 16 high, item standing up from it, button on its side) with the pedestal ON the top: load point = top + 12,
  // and the load point is 2 units nearer the button than the pedestal centre (measured live)
  const dagger = k => `shop_${tiers[k % tiers.length]}_dagger`;
  // (owner 2026-10-19: "you arent using the system for weapons ... all materials of dagger can be bought in this
  // shop from bronze to rune") a drawn shop sells ONE line, every material / model in order, priced by the
  // stand prefabs: blades (bronze..rune of one type) on the racks (daggers also on the counter: short enough),
  // bows (bow..magic) on the racks + the cheapest in the case, guns: pistols in the case, long guns on the racks
  const T7 = ['bronze', 'iron', 'steel', 'black', 'mithril', 'adamant', 'rune'];
  const LINE = (() => {
    const u = hash(seed, 91);
    // (2026-10-21, owner: "do not sell sabers and do not sell spathas") their slots are longsword / sword now (same rolls for every other shop)
    if (u < 0.7) { const ty = ['dagger', '', 'longsword', 'longsword', '', '2h'][Math.floor(hash(seed, 92) * 6)]; return { kind: 'blade', name: ty || 'sword', short: ty === 'dagger', rack: T7.map(t => `shop_${t}${ty ? '_' + ty : ''}`), cas: [] }; }
    if (u < 0.85) { const b = ['bow', 'oak', 'willow', 'maple', 'yew', 'magic']; return { kind: 'bow', name: 'bows', short: false, rack: b.map(x => `bow_${x}`), cas: b.map(x => `bow_${x}_case`) }; }
    return { kind: 'gun', name: 'guns', short: false, rack: ['huntingshotgun', 'leveraction', 'boltaction', 'magnum'].map(x => `gun_${x}`), cas: ['derringer', 'guardpistol', 'revolver'].map(x => `gun_${x}_case`) };
  })();
  let wq = 0; const nextWare = () => (wq < LINE.rack.length ? LINE.rack[wq++] : null);
  let cq = 0; const nextCase = () => (cq < LINE.cas.length ? LINE.cas[cq++] : null);
  // a house's wall table: daggers from bronze up
  let tq = 0; const nextDagger = () => (tq < T7.length ? `shop_${T7[tq++]}_dagger` : null);
  const blade = k => { const t = tiers[k % tiers.length], ty = ['dagger', '', 'longsword', 'longsword', ''][Math.floor(hash(k, seed, 61) * 5)]; return `shop_${t}${ty ? '_' + ty : ''}`; };
  const CASEW = ['gun_derringer_case', 'gun_guardpistol_case', 'gun_revolver_case', 'bow_bow_case', 'bow_oak_case'];
  const standAt = (x, y, zTop, face, prefab, hw = 10) => {
    if (!B.free([X0 + x - hw, Y0 + y - hw, zTop], [X0 + x + hw, Y0 + y + hw, zTop + 36])) { if (process.env.FD) console.error('stand blocked', x, y, zTop); return false; }
    if (typeof prefab === 'function') prefab = prefab(); // take a ware only for a spot that fits
    if (process.env.FD && !prefab) console.error('no ware left', x, y);
    if (!prefab) return false;
    box(x - hw, y - hw, zTop, x + hw, y + hw, zTop + 36, { color: [255, 0, 255], ghost: true }, 'stand ghost');
    stands.push({ at: [X0 + x, Y0 + y, zTop + 12], face, prefab });
    return true;
  };
  let nStand = 0;
  // a wall table (flush on a wall, owner: "tables should be flush against the wall" and have shop items on
  // them): top at 44 like the weapon shops' display tables, bare stands 35 apart, buttons away from the wall
  function wallTable(axis, wallFace, inward, a0, a1, z0 = F) {
    const D = 28, top = z0 + 24, n = Math.floor((a1 - a0 - 10) / 35); // 2 bricks high (owner: player is exactly 5 bricks, tables were gigantic); stands 14 off the wall (11 = item spawn rejected)
    if (n < 1) return 0;
    const [c0, c1] = inward > 0 ? [wallFace, wallFace + D] : [wallFace - D, wallFace];
    const tb = (p, q, z, zt, m, lab) => (axis === 'y' ? opt(c0 + (p ?? 0), a0 + 0, z, c1, a1, zt, m, lab) : opt(a0, c0, z, a1, c1, zt, m, lab));
    if (!tb(0, 0, top - 4, top, { color: WOOD[2] }, 'wall table')) return 0;
    for (const a of [a0 + 2, a1 - 6]) for (const c of inward > 0 ? [c1 - 4] : [c0]) axis === 'y' ? opt(c, a, z0, c + 4, a + 4, top - 4, { color: WOOD[0] }, 'table leg') : opt(a, c, z0, a + 4, c + 4, top - 4, { color: WOOD[0] }, 'table leg');
    axis === 'y' ? opt(inward > 0 ? c0 : c1 - 2, a0 + 2, top - 8, inward > 0 ? c0 + 2 : c1, a1 - 2, top - 4, { color: WOOD[0] }, 'table apron') : opt(a0 + 2, inward > 0 ? c0 : c1 - 2, top - 8, a1 - 2, inward > 0 ? c0 + 2 : c1, top - 4, { color: WOOD[0] }, 'table apron');
    let k = 0;
    const mid = (c0 + c1) / 2 + inward * 2, face = axis === 'y' ? (inward > 0 ? '+x' : '-x') : (inward > 0 ? '+y' : '-y');
    for (let i = 0; i < n; i++) {
      const a = Math.round((a0 + (a1 - a0) * (i + 0.5) / n) / 2) * 2;
      if (axis === 'y' ? standAt(mid, a, top, face, nextDagger) : standAt(a, mid, top, face, nextDagger)) k++;
    }
    return k;
  }
  // a wall rack (the drawing's red): backboard on the wall, a low bench, stands on it (pedestals visible, the
  // blades standing up in front of the board, 2026-10-23)
  function wallRack(axis, wallFace, inward, a0, a1, z0 = F) {
    const n = Math.floor((a1 - a0 - 10) / 30);
    if (n < 1) return;
    const bench = z0 + 12, back = (p, q, z, zt, m, lab) => (axis === 'y' ? opt(inward > 0 ? wallFace + p : wallFace - q, a0, z, inward > 0 ? wallFace + q : wallFace - p, a1, zt, m, lab) : opt(a0, inward > 0 ? wallFace + p : wallFace - q, z, a1, inward > 0 ? wallFace + q : wallFace - p, zt, m, lab));
    if (!back(0, 2, z0 + 10, z0 + 84, { color: shade(WOOD[0], 0.85) }, 'rack board')) return; // under the tie beams / upper floor (92)
    back(2, 4, z0 + 80, z0 + 84, { color: timber }, 'rack rail');
    // the bench: pedestal 4..24 off the wall (centre 14, load point 16), the button 24..28 on its front edge
    if (!back(2, 26, z0, bench - 2, { color: shade(WOOD[0], 0.9) }, 'rack bench')) return;
    if (!back(2, 26, bench - 2, bench, { color: WOOD[2] }, 'rack bench top')) return;
    const face = axis === 'y' ? (inward > 0 ? '+x' : '-x') : (inward > 0 ? '+y' : '-y'), c = wallFace + inward * 16;
    for (let i = 0; i < n; i++) {
      const a = Math.round((a0 + (a1 - a0) * (i + 0.5) / n) / 2) * 2;
      axis === 'y' ? standAt(c, a, bench, face, nextWare) : standAt(a, c, bench, face, nextWare);
    }
  }
  // lanterns (owner: "should not be floating ... made out of glass and metal, no glow, with a point light"):
  // iron base, corner posts and cap, glass panes, a candle brick carrying the Component_PointLight
  const IRON = { color: [46, 46, 50], material: 'BMC_Metallic' };
  const LIGHT = { bMatchBrickShape: false, bEnabled: true, Brightness: 3, Radius: 320, Color: { R: 255, G: 186, B: 110, A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 };
  function lanternBody(x, y, zb) {
    if (!B.free([X0 + x - 5, Y0 + y - 5, zb], [X0 + x + 5, Y0 + y + 5, zb + 20])) return false;
    box(x - 5, y - 5, zb, x + 5, y + 5, zb + 2, IRON, 'lantern');
    for (const [u, v] of [[-5, -5], [3, -5], [-5, 3], [3, 3]]) box(x + u, y + v, zb + 2, x + u + 2, y + v + 2, zb + 14, IRON, 'lantern');
    box(x - 3, y - 5, zb + 2, x + 3, y - 3, zb + 14, GLASS, 'lantern glass');
    box(x - 3, y + 3, zb + 2, x + 3, y + 5, zb + 14, GLASS, 'lantern glass');
    box(x - 5, y - 3, zb + 2, x - 3, y + 3, zb + 14, GLASS, 'lantern glass');
    box(x + 3, y - 3, zb + 2, x + 5, y + 3, zb + 14, GLASS, 'lantern glass');
    box(x - 1, y - 1, zb + 2, x + 1, y + 1, zb + 8, { color: [244, 232, 200], components: [{ type: 'Component_PointLight', data: LIGHT }] }, 'candle');
    box(x - 5, y - 5, zb + 14, x + 5, y + 5, zb + 16, IRON, 'lantern');
    box(x - 3, y - 3, zb + 16, x + 3, y + 3, zb + 18, IRON, 'lantern');
    box(x - 1, y - 1, zb + 18, x + 1, y + 1, zb + 20, IRON, 'lantern');
    return true;
  }
  // hung on a chain from a ceiling / beam bottom zc
  function hangLantern(x, y, zc, drop = 10) {
    const zb = zc - 20 - drop;
    if (!B.free([X0 + x - 5, Y0 + y - 5, zb], [X0 + x + 5, Y0 + y + 5, zc])) return false;
    if (!lanternBody(x, y, zb)) return false;
    box(x - 1, y - 1, zb + 20, x + 1, y + 1, zc, IRON, 'lantern chain');
    return true;
  }
  // on a wall bracket: an iron arm out of the wall face (axis of the wall, face line, outward sign), the
  // lantern hanging from its end
  function wallLantern(axis, face, out, a, z) {
    const tip = face + out * 14;
    const [x, y] = axis === 'x' ? [a, tip] : [tip, a];
    const arm = axis === 'x' ? [a - 1, Math.min(face, tip), z, a + 1, Math.max(face, tip), z + 2] : [Math.min(face, tip), a - 1, z, Math.max(face, tip), a + 1, z + 2];
    if (!B.free([X0 + arm[0], Y0 + arm[1], arm[2]], [X0 + arm[3], Y0 + arm[4], arm[5]])) return false;
    if (!B.free([X0 + x - 5, Y0 + y - 5, z - 26], [X0 + x + 5, Y0 + y + 5, z])) return false;
    if (!lanternBody(x, y, z - 26)) return false;
    box(...arm, IRON, 'lantern arm');
    box(x - 1, y - 1, z - 6, x + 1, y + 1, z, IRON, 'lantern chain');
    return true;
  }
  // tie beams under the roof (lanterns hang from them; the roof's stepped underside reads as rafters over them)
  const beams = [];
  {
    const along = roofType === 'front' ? 'x' : 'y', zb = UT - 8;
    const [lo, hi] = along === 'x' ? [-jetty + 20, BD - 20] : [20, BW - 20];
    const n = Math.max(1, Math.round((hi - lo) / 90));
    for (let i = 0; !upTop && i <= n; i++) { // none in two-storey houses: upstairs they sat 56 over the floor (player 60)
      const c = Math.round((lo + ((hi - lo) * i) / n) / 10) * 10 - 4;
      const ok = along === 'x' ? opt(10, c, zb, BW - 10, c + 8, UT, { color: timber }, 'tie beam') : opt(c, -jetty + 10, zb, c + 8, BD - 10, UT, { color: timber }, 'tie beam');
      if (ok) beams.push({ along, c: c + 4 });
    }
  }
  // a lantern under the nearest beam (one-storey rooms, upstairs), else under the upper floor
  const lanternNear = (x, y, ceiling, floor = F) => {
    if (ceiling != null) return hangLantern(Math.round(x / 2) * 2, Math.round(y / 2) * 2, ceiling, 14);
    const bm = beams.slice().sort((p, q) => Math.abs((p.along === 'x' ? y : x) - p.c) - Math.abs((q.along === 'x' ? y : x) - q.c))[0];
    if (!bm) return false;
    const [lx, ly] = bm.along === 'x' ? [x, bm.c] : [bm.c, y];
    return hangLantern(Math.round(lx / 2) * 2, Math.round(ly / 2) * 2, UT - 8, Math.max(2, UT - 28 - (floor + 62)));
  };
  // wall decorations: a heater shield, a banner on a rod, a framed painting; flat on a wall face
  function decor(axis, face, out, a, z, k) {
    const wl = axis === 'y' ? (face <= 10 ? 0 : BW - 10) : face >= BD - 10 ? BD - 10 : 0;
    if (W.some(w => w.axis === axis && w.line === wl && w.open.some(o => o.a0 - 18 < a + 14 && o.a1 + 18 > a - 14 && o.z0 - 6 < z + 36 && o.z1 + 6 > z - 2))) return false;
    const pb = (u0, u1, z0, z1, d0, d1, m) => (axis === 'x' ? box(a + u0, face + out * d0 - (out < 0 ? d1 - d0 : 0), z0, a + u1, face + out * d0 - (out < 0 ? d1 - d0 : 0) + (d1 - d0), z1, m, 'decor') : box(face + out * d0 - (out < 0 ? d1 - d0 : 0), a + u0, z0, face + out * d0 - (out < 0 ? d1 - d0 : 0) + (d1 - d0), a + u1, z1, m, 'decor'));
    const fp = axis === 'x' ? [a - 14, Math.min(face, face + out * 4), z - 2, a + 14, Math.max(face, face + out * 4), z + 36] : [Math.min(face, face + out * 4), a - 14, z - 2, Math.max(face, face + out * 4), a + 14, z + 36];
    if (!B.free([X0 + fp[0], Y0 + fp[1], fp[2]], [X0 + fp[3], Y0 + fp[4], fp[5]])) return false;
    const c1 = pick(CLOTH), c2 = pick([[230, 200, 80], [236, 232, 222], [40, 40, 44]]);
    if (k === 0) { // shield: rows narrowing to a point, a pale on the field, a rim
      const rows = [[12, 0], [12, 4], [12, 8], [12, 12], [10, 16], [8, 20], [6, 24], [4, 28]];
      for (const [w, dz] of rows) { const hw = Math.floor(w / 4) * 2; pb(-hw - 2, -2, z + 30 - dz - 4, z + 30 - dz, 0, 2, { color: c1 }); pb(2, hw + 2, z + 30 - dz - 4, z + 30 - dz, 0, 2, { color: c1 }); pb(-2, 2, z + 30 - dz - 4, z + 30 - dz, 0, 2, { color: c2 }); }
      pb(-8, 8, z + 30, z + 32, 0, 2, IRON);
    } else if (k === 1) { // banner: a rod, two colours, a swallowtail
      pb(-10, 10, z + 32, z + 34, 0, 4, IRON);
      pb(-8, 8, z + 8, z + 16, 0, 2, { color: c1 });
      pb(-8, 8, z + 16, z + 20, 0, 2, { color: c2 });
      pb(-8, 8, z + 20, z + 32, 0, 2, { color: c1 });
      pb(-8, -2, z, z + 8, 0, 2, { color: c1 }); pb(2, 8, z, z + 8, 0, 2, { color: c1 });
    } else { // painting: frame, sky, hills, field
      pb(-14, 14, z, z + 2, 0, 4, { color: [150, 110, 50] }); pb(-14, 14, z + 22, z + 24, 0, 4, { color: [150, 110, 50] });
      pb(-14, -12, z + 2, z + 22, 0, 4, { color: [150, 110, 50] }); pb(12, 14, z + 2, z + 22, 0, 4, { color: [150, 110, 50] });
      pb(-12, 12, z + 14, z + 22, 0, 2, { color: [150, 190, 220] }); pb(-12, 12, z + 8, z + 14, 0, 2, { color: [90, 130, 80] }); pb(-12, 12, z + 2, z + 8, 0, 2, { color: [170, 150, 90] });
    }
    return true;
  }
  let npc = null;
  if (layout === 'shop') {
    // ---- the drawn shop (back room on the left as drawn; mirrored when backLeft is false)
    const groundCap = upTop ? GT : UT - 8;
    // partitions: across from the side wall to the counter, along from the counter's end to the back wall
    { const [a, b] = mr(10, CX0); partition('x', PY, a, b, F, [], groundCap); }
    { const [a] = mr(PX, PX + 10); partition('y', a, CY1, BD - 10, F, [], groundCap); }
    // the L counter: 2.5 bricks high (player 5), dagger stands 28 over it (their tops under the 92 ceiling)
    const top = F + 30;
    const cbox = (x0, x1, y0, y1) => { const [a, b] = mr(x0, x1); box(a, y0, F, b, y1, top - 4, { color: shade(WOOD[0], 0.9) }, 'counter'); box(a, y0, top - 4, b, y1, top, { color: WOOD[2] }, 'counter top'); };
    cbox(CX0, PX + 20, PY, PY + 20);
    cbox(PX, PX + 20, PY + 20, CY1);
    if (LINE.short) { // daggers start on the counter (bronze nearest the door side), the rest go on the racks
      for (let x = CX0 + 22; x <= PX - 12; x += 35) standAt(mx(x), PY + 8, top, '-y', nextWare);
      for (let y = PY + 50; y <= CY1 - 14; y += 35) standAt(mx(PX + 10) + (backLeft ? 2 : -2), y, top, backLeft ? '+x' : '-x', nextWare);
    }
    // the shopkeeper's spawn and goal point, behind the counter
    npc = [X0 + mx(Math.round((CX0 + PX) / 20) * 10), Y0 + PY + 50, F + 14];
    box(mx(Math.round((CX0 + PX) / 20) * 10) - 14, PY + 36, F, mx(Math.round((CX0 + PX) / 20) * 10) + 14, PY + 64, F + 60, { color: [255, 0, 255], ghost: true }, 'npc ghost');
    // back room: shelf units and a crate rack along the side wall (the drawing's blue)
    const yEnd = upTop ? BD - 44 : BD - 14, yL = PY + 16, nU = 3, uL = Math.floor((yEnd - yL) / nU / 2) * 2;
    for (let u = 0; u < nU; u++) {
      const y0 = yL + u * uL, y1 = y0 + uL - 6;
      if (y1 - y0 < 20) continue;
      const [a, b] = mr(10, 28);
      if (u === 1) { // crate rack: stacked crates
        for (const [zz, h] of [[F, 16], [F + 16, 16], [F + 32, 14]]) for (let y = y0; y + 16 <= y1; y += 18) opt(a, y, zz, b, y + 16, zz + h, { color: shade(WOOD[(y + zz) % 3], 0.9 + 0.2 * hash(y, zz, seed)) }, 'crate');
        continue;
      }
      for (const [px, py] of [[a, y0], [b - 2, y0], [a, y1 - 2], [b - 2, y1 - 2]]) opt(px, py, F, px + 2, py + 2, F + 70, { color: WOOD[0] }, 'shelf post');
      for (const sz of [F + 18, F + 40, F + 62]) {
        if (!opt(a, y0 + 2, sz, b, y1 - 2, sz + 2, { color: WOOD[1] }, 'shelf')) continue;
        for (let y = y0 + 4; y < y1 - 8; y += 8 + Math.floor(hash(y, sz, seed) * 3) * 2) {
          const h = 4 + 2 * Math.floor(hash(y, sz, seed, 1) * 5);
          opt(a + 4, y, sz + 2, b - 4, y + 4 + 2 * Math.floor(hash(y, sz, seed, 2) * 2), sz + 2 + h, { color: GOODS[Math.floor(hash(y, sz, seed, 3) * GOODS.length)] }, 'goods');
        }
      }
    }
    // sword racks: the side wall in front of the back room, and the far side wall (the drawing's red)
    const rackRun = (axis, wallFace, inward, a0, a1) => wallRack(axis, wallFace, inward, a0, a1); // one continuous rack per wall: every slot counts
    rackRun('y', mx(10), backLeft ? 1 : -1, 24, PY - 8);
    rackRun('y', mx(BW - 10), backLeft ? -1 : 1, 24, BD - 24);
    // the display case under the front window (the drawing's green): metal base, glass walls, case stands
    {
      const MET = { color: [160, 160, 160], material: 'BMC_Metallic' }, CG = { color: [255, 255, 255], material: 'BMC_Glass' };
      const c0 = DOOR.a1 + 8, c1 = DOOR2.a0 - 8, y0 = 12, y1 = 42; // between the doors (the doorways stay clear)
      if (LINE.cas.length && opt(c0, y0, F, c1, y1, F + 20, MET, 'case base')) {
        box(c0, y1 - 2, F + 20, c1, y1, F + 30, CG, 'case glass'); box(c0, y0, F + 20, c1, y0 + 2, F + 30, CG, 'case glass');
        box(c0, y0 + 2, F + 20, c0 + 2, y1 - 2, F + 30, CG, 'case glass'); box(c1 - 2, y0 + 2, F + 20, c1, y1 - 2, F + 30, CG, 'case glass');
        box(c0, y1 - 2, F + 30, c1, y1, F + 32, MET, 'case rail'); box(c0, y0, F + 30, c1, y0 + 2, F + 32, MET, 'case rail');
        const k = Math.max(1, Math.floor((c1 - c0 - 10) / 30));
        for (let i = 0; i < k; i++) {
          const x = Math.round((c0 + (c1 - c0) * (i + 0.5) / k) / 2) * 2;
          const w = nextCase(); if (w) stands.push({ at: [X0 + x, Y0 + y1 - 12, F + 32], face: '+y', prefab: w });
        }
      }
    }
    // lanterns: two over the shop floor, one in the back room
    const ceil = upTop ? GT : null;
    lanternNear(mx(Math.round(BW * 0.3)), Math.round(PY * 0.5), ceil);
    lanternNear(mx(Math.round(BW * 0.8)), Math.round(BD * 0.6), ceil);
    lanternNear(mx(Math.round(PX * 0.5)), Math.round((PY + BD) / 2), ceil);
  } else {
    // shelves of goods on the back wall
    const sy0 = BD - 10 - 12, sy1 = BD - 10;
    for (const sz of [F + 26, F + 50]) {
      const [p, q] = upTop ? (stairRight ? [24, SX[0] - 4] : [SX[1] + 4, BW - 24]) : [24, BW - 24];
      if (!opt(p, sy0, sz, q, sy1, sz + 2, { color: WOOD[1] }, 'shelf')) continue;
      for (let a = p + 2; a < q - 6; a += 8 + Math.floor(hash(a, sz, seed) * 3) * 2) {
        const h = 4 + 2 * Math.floor(hash(a, sz, seed, 1) * 5), wd = 4 + 2 * Math.floor(hash(a, sz, seed, 2) * 2);
        opt(a, sy0 + 2, sz + 2, a + wd, sy0 + 8, sz + 2 + h, { color: GOODS[Math.floor(hash(a, sz, seed, 3) * GOODS.length)] }, 'goods');
      }
    }
    for (const o of bayTables) wallTable('x', BD - 10, -1, Math.max(24, o.a0), Math.min(BW - 24, o.a1));
    // a table flush on the side wall away from the stair, with stands on it
    const tSide = upTop ? !stairRight : doorA + doorW / 2 > BW / 2;   // true: the right wall
    const ty0 = Math.round((BD * 0.3) / 10) * 10, ty1 = ty0 + 80;
    wallTable('y', tSide ? BW - 10 : 10, tSide ? -1 : 1, ty0, ty1);
    // lanterns
    const ceil = upTop ? GT : null;
    lanternNear(Math.round(BW * 0.3), Math.round(BD * 0.45), ceil);
    lanternNear(Math.round(BW * 0.7), Math.round(BD * 0.45), ceil);
  }
  // upstairs: lanterns on wall brackets over head height
  if (upTop) { let n = 0; for (const [face, out] of [[10, 1], [BW - 10, -1]]) for (const y of [Math.round(BD * 0.3 / 2) * 2, Math.round(BD * 0.7 / 2) * 2]) if (n < 2 && wallLantern('y', face, out, y, U + 72)) n++; }
  // decor on the inside of the side and back walls (free spots only), and a shield over a door outside
  {
    let k = Math.floor(hash(seed, 81) * 3);
    for (const [axis, face, out, lo, hi] of [['y', 10, 1, 30, BD - 30], ['y', BW - 10, -1, 30, BD - 30], ['x', BD - 10, -1, 40, BW - 40]])
      for (let a = lo + 20; a < hi - 20; a += 70) if (decor(axis, face, out, a, F + 46, k)) k = (k + 1) % 3;
    if (upTop) for (const [axis, face, out, lo, hi] of [['y', 10, 1, 0, BD - 30], ['y', BW - 10, -1, 0, BD - 30]])
      for (let a = lo + 30; a < hi - 20; a += 80) if (decor(axis, face, out, a, U + 30, k)) k = (k + 1) % 3;
    const fw = wallOf('front')[0];
    decor('x', fw.L.relief[0], -1, Math.round((DOOR.a0 + DOOR.a1) / 4) * 2, F + doorH + 10, 0);
  }
  for (const f of deferredDoorLanterns) f();
  // ridge caps (a darker strip on every ridge where that roof is on top)
  for (const d of roofs) {
    const ridgeH = d.eave + (d.axis === 'x' ? (d.rect[2] - d.rect[0]) / 2 : (d.rect[3] - d.rect[1]) / 2);
    const alongY = d.axis === 'x';
    const m = alongY ? (d.rect[0] + d.rect[2]) / 2 : (d.rect[1] + d.rect[3]) / 2;
    const [s0, s1] = alongY ? [d.rect[1], d.rect[3]] : [d.rect[0], d.rect[2]];
    for (let s = s0; s < s1; s += 10) {
      const H = alongY ? main.pointH(m, s + 5) : main.pointH(s + 5, m);
      const own = alongY ? main.heightAt(d, m, s + 5) : main.heightAt(d, s + 5, m);
      if (H !== own) continue;
      const t = alongY ? main.at(m - 1, s) : main.at(s, m - 1);
      const z = m % 10 ? t.base : H;
      if (alongY) opt(m - 4, s, z, m + 4, s + 10, z + 4, { color: shade(roofC, 0.62) }, 'ridge cap');
      else opt(s, m - 4, z, s + 10, m + 4, z + 4, { color: shade(roofC, 0.62) }, 'ridge cap');
    }
    void ridgeH;
  }
  void stats; void RF;

  // ------------------------------------------------------------- output --
  const WB = B.bricks.map(b => worldBox(b, FIXED));
  const minX = Math.min(...WB.map(([lo]) => lo[0])), maxX = Math.max(...WB.map(([, hi]) => hi[0]));
  const minY = Math.min(...WB.map(([lo]) => lo[1])), maxY = Math.max(...WB.map(([, hi]) => hi[1]));
  if (minY < 0) throw new Error(`faire ${seed}: pokes out of the frame at y ${minY}`);
  if (minX < 0) throw new Error(`faire ${seed}: pokes out of the frame at x ${minX}`);
  const Wst = Math.ceil(Math.max(maxX, X0 * 2 + BW) / 10) - 1, Dst = Math.ceil((maxY + 10) / 10) - 1;
  const bricks = B.bricks.filter(b => !b.ghost).map(({ label, ...b }) => b);
  // helpers (owner: "leave helpers for door and dock connections"): every front door and the boardwalk's
  // rectangle in the shapedTown frame, so a town pass can join neighbours' boardwalks / lay paths to doors
  const doors = [DOOR, DOOR2].filter(Boolean).map(d => ({ x: X0 + (d.a0 + d.a1) / 2, y: Y0, w: d.a1 - d.a0 }));
  const dock = { x0: X0 - 10, x1: X0 + BW + 10, y0: Y0 - PD, y1: Y0 - 2, z: F };
  return { line: layout === 'shop' ? LINE.name : null, bricks, W: Wst, D: Dst, door: [Math.round((X0 + doorA + doorW / 2) / 10)], doors, dock, stand, stands, npc, layout, scheme: sc.name, roofType, storeys, count: bricks.length };
}

if (process.argv[1]?.endsWith('faire.mjs')) {
  if (process.argv[2] === '--test') {
    const N = +(process.argv[3] ?? 100);
    let n = 0, tot = 0;
    for (let s = 1; s <= N; s++) for (const kind of ['booth', 'house', 'cottage']) for (const small of [false, true]) { const h = faire({ seed: s, kind, small }); n++; tot += h.count; }
    console.error(`${n} builds clean, ${Math.round(tot / n)} bricks avg`);
  } else {
    const seed = +(process.argv[2] ?? 1), kind = process.argv[3] ?? 'booth', out = process.argv[4] ?? 'faire.json';
    const h = faire({ seed, kind });
    fs.writeFileSync(out, JSON.stringify(h.bricks));
    console.error(`faire ${kind} seed ${seed}: ${h.count} bricks, ${h.W} x ${h.D} studs, ${h.scheme} ${h.roofType} ${h.storeys} storeys, door x ${h.door[0]}, stand ${h.stand}`);
  }
}
