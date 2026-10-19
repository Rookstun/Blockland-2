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

export function faire({ seed = 1, kind = 'booth', small = false } = {}) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const span10 = (a, b) => a + 10 * Math.floor(r() * ((b - a) / 10 + 1));
  const B = makeBuilder();
  const sc = pick(SCHEMES);
  // ------------------------------------------------------------- frame --
  const storeys = kind === 'cottage' ? 1 : kind === 'booth' ? (r() < 0.4 ? 1 : 2) : 2;
  let BW = kind === 'cottage' ? span10(200, 260) : kind === 'booth' ? span10(220, 300) : span10(240, 320);
  let BD = span10(200, 260);
  if (small) { BW = Math.min(BW, 230); BD = Math.min(BD, 200); }
  const roofType = (BW >= 280 && r() < 0.75) || r() < 0.3 ? 'side' : 'front';
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
      const ck = t => t.cap && t.cap[0] + t.cap[1].join(';') + t.cap[2] + '|' + t.base;
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
        piece(asset, dirs, ext, [t.x + ext[0], t.y + ext[1], t.base + dz / 2], shade(roofC, tone), 'shingles');
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
    const n = BW >= 270 && r() < 0.6 ? 2 : 1;
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
  const ROOMC = [222, 210, 186];
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
    const keyOf = c => c.join();
    const matOf = k => ({ color: k.split(',').map(Number) });
    emit('core', (a, z, top) => (cornerCol(a) ? keyOf(pat(a, z, top)[0]) : keyOf(W.room ?? ROOMC)), matOf, 'wall core');
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
    return { ...W, L, topAt };
  }
  // facade pattern: (a, z, columnTop) -> [colour, proud]
  function facadePattern(W) {
    const { a0, a1, z0, open = [], finish, color, corners = [false, false], plate = UT } = W;
    const tim = finish === 'boards' || finish === 'stone' ? trim : timber;
    const frame = frameC && (finish === 'braced' || finish === 'close') ? frameC : tim;
    const Lw = a1 - a0;
    const posts = [];
    if (finish === 'close') for (let a = a0 + 16; a < a1 - 16; a += 14) posts.push(a);
    if (finish === 'braced') { const n = Math.max(1, Math.round(Lw / 54)); for (let i = 1; i < n; i++) posts.push(a0 + Math.round((Lw * i) / n / 2) * 2 - 2); }
    const midRail = z0 === 0 ? F + 22 : z0 + 22;
    const nearOpen = (a, z) => open.find(o => a >= o.a0 - 4 && a < o.a1 + 4 && z >= o.z0 - 4 && z < o.z1 + 4);
    const panelOpen = (pa0, pa1, pz0, pz1) => open.some(o => o.a0 - 6 < pa1 && o.a1 + 6 > pa0 && o.z0 - 6 < pz1 && o.z1 + 6 > pz0);
    const vlines = [a0 + (corners[0] ? 8 : 4), ...posts.flatMap(p => [p, p + 4]), a1 - (corners[1] ? 8 : 4)];
    const segLine = (px, pz, qx, qz, a, z) => {
      const cx = a + 1, cz = z + 1, dx = qx - px, dz = qz - pz, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((cx - px) * dx + (cz - pz) * dz) / l2));
      return Math.hypot(cx - (px + t * dx), cz - (pz + t * dz));
    };
    return (a, z, top) => {
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
      if (finish === 'braced') {
        if (z >= plate + 4) {
          // gable: king post and two struts down to the collar ends
          const mid = Math.round((a0 + a1) / 4) * 2, apex = Math.min(top, plate + 4 + (a1 - a0) / 2);
          if (a >= mid - 2 && a < mid + 2) return [timber, true];
          if (segLine(mid, apex - 8, a0 + 8, plate + 4, a, z) < 2.2 || segLine(mid, apex - 8, a1 - 8, plate + 4, a, z) < 2.2) return [timber, true];
          return [color, false];
        }
        // the panel this cell is in
        let pa0 = a0, pa1 = a1;
        for (const v of vlines) { if (v <= a) pa0 = v; else { pa1 = v; break; } }
        const below = z < midRail, pz0 = below ? z0 + 8 : midRail + 4, pz1 = below ? midRail : Math.min(plate, top - 4);
        if (pz1 - pz0 >= 16 && pa1 - pa0 >= 16 && !panelOpen(pa0, pa1, pz0, pz1)) {
          const kind = Math.floor(hash(pa0, pz0, seed, 3) * 5);
          const d1 = segLine(pa0, pz0, pa1, pz1, a, z), d2 = segLine(pa0, pz1, pa1, pz0, a, z);
          const m = (pa0 + pa1) / 2;
          const d3 = Math.min(segLine(pa0, pz1, m, pz0, a, z), segLine(m, pz0, pa1, pz1, a, z));
          if ((kind === 1 && d1 < 2.2) || (kind === 2 && d2 < 2.2) || (kind === 3 && (d1 < 2.2 || d2 < 2.2)) || (kind === 4 && d3 < 2.2)) return [timber, true];
        }
      }
      return [color, false];
    };
  }

  // openings
  const op = (a0, a1, z0, z1, kind = 'win') => ({ a0, a1, z0, z1, kind });
  const doorW = 32, doorH = 64;
  const doorLeft = r() < 0.5;
  let doorA;
  if (kind === 'booth') doorA = doorLeft ? 30 : BW - 30 - doorW;
  else doorA = Math.round((BW / 2 - doorW / 2 + (r() < 0.5 ? -1 : 1) * (r() < 0.5 ? 0 : 30)) / 10) * 10;
  const DOOR = op(doorA, doorA + doorW, F, F + doorH, 'door');
  const groundFront = [DOOR];
  let booth = [];
  if (kind === 'booth') {
    const b0 = doorLeft ? doorA + doorW + 24 : 30, b1 = doorLeft ? BW - 30 : doorA - 24;
    if (b1 - b0 >= 150) { const m = Math.round((b0 + b1) / 4) * 2; booth = [op(b0, m - 4, F + 30, F + 76, 'booth'), op(m + 4, b1, F + 30, F + 76, 'booth')]; }
    else if (b1 - b0 >= 40) booth = [op(b0, b1, F + 30, F + 76, 'booth')];
    groundFront.push(...booth);
  } else {
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
  const backG = kind === 'booth' ? [] : winsAlong(0, BW, 1, 30, F + 28, F + 64);
  if (!upTop) {
    if (roofType === 'front') { groundFront.push(...gw('x', 0, Math.round(BW / 4) * 2 - 10, 20)); backG.push(...gw('x', BD - 10, Math.round(BW / 4) * 2 - 10, 20)); }
    for (const cr of crosses) groundFront.push(...gw('x', 0, Math.round(cr.c / 2) * 2 - 10, 20));
  }
  // ground storey: front (owns the corners), back, sides
  W.push(wall({ name: 'front', axis: 'x', line: 0, out: -1, a0: 0, a1: BW, z0: gz0, z1: gz1, open: groundFront, finish: fin1, color: c1, corners: [true, true], plate: upTop ? 10000 : UT }));
  W.push(wall({ name: 'back', axis: 'x', line: BD - 10, out: 1, a0: 0, a1: BW, z0: gz0, z1: gz1, open: backG, finish: fin1, color: c1, corners: [true, true], plate: upTop ? 10000 : UT }));
  const sideG = BD >= 220 ? winsAlong(10, BD - 10, 1, 30, F + 28, F + 64) : [];
  if (!upTop && roofType === 'side') sideG.push(...gw('y', 0, Math.round(BD / 4) * 2 - 10, 20));
  for (const [line, out] of [[0, -1], [BW - 10, 1]])
    W.push(wall({ name: 'side', axis: 'y', line, out, a0: 10, a1: BD - 10, z0: gz0, z1: gz1, open: sideG, finish: fin1, color: c1, plate: upTop ? 10000 : UT }));
  // gable windows (one-storey front gable: in the front / back gable; side gable: in the side gables)
  if (upTop) {
    // the floor beam between the storeys (it is the upper floor), jettied at the front
    box(0, -jetty, GT, BW, BD, U, { color: timber }, 'floor beam');
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
  // blade sign on an iron rod, the name on both faces
  {
    const two = upTop, fw = wallOf(two ? 'ufront' : 'front')[0];
    const face = fw.L.relief[0], rz = two ? U + 52 : F + 78, len = 40;
    box(signA - 1, face - len, rz, signA + 1, face, rz + 2, { color: [40, 40, 44] }, 'sign rod');
    box(signA - 1, face - 6, rz - 10, signA + 1, face, rz, { color: [40, 40, 44] }, 'sign rod brace');
    const by0 = face - len + 4, by1 = face - 8, bz1 = rz - 4, bz0 = bz1 - 26;
    for (const y of [by0 + 2, by1 - 4]) box(signA - 1, y, bz1, signA + 1, y + 2, rz, { color: [40, 40, 44] }, 'sign chain');
    const put = (b, x, y, z) => { if (!B.add({ ...b, position: [X0 + x, Y0 + y, z] }, 'sign')) throw new Error(`faire ${seed}: sign dropped ${B.dropped.at(-1)}`); };
    const style = { Font: font, LineHeight: 1.9, Color: { R: 250, G: 236, B: 196, A: 255 }, OutlineColor: { R: 30, G: 20, B: 16, A: 255 } };
    for (const s of [-1, 1]) plaque({ put, text: signText, facing: [s, 0], x: signA + s, y: (by0 + by1) / 2, z: (bz0 + bz1) / 2, w: (by1 - by0) / 2, h: (bz1 - bz0) / 2, color: trim, style });
  }
  // windows: leaded glass (2 x 2 lead grid every 8 / 10), open shutters, a flower box under each
  for (const w of W) for (const o of w.open) {
    if (o.kind !== 'win') continue;
    const { axis, L, out } = w;
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
    for (const [k, zs] of runs) {
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
    if (hash(o.a0, o.z0, seed, 9) < 0.8 && o.a1 - o.a0 >= 24) for (const [a, b] of [[o.a0 - 4 - 14, o.a0 - 4], [o.a1 + 4, o.a1 + 4 + 14]]) {
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
  // the door: open plank leaf swung in, a lantern beside it
  {
    const fw = wallOf('front')[0];
    box(DOOR.a0, 10, F, DOOR.a0 + 4, 10 + doorW - 2, F + doorH - 2, { color: trim }, 'door leaf');
    box(DOOR.a0 + 4, 10 + 4, F + 30, DOOR.a0 + 6, 10 + 8, F + 34, { color: [40, 40, 44] }, 'door ring');
    const la = DOOR.a1 + 8;
    if (opt(la, fw.L.relief[0] - 6, F + 50, la + 6, fw.L.relief[0] - 2, F + 52, { color: [40, 40, 44] }, 'lantern arm'))
      opt(la, fw.L.relief[0] - 10, F + 40, la + 6, fw.L.relief[0] - 4, F + 50, GLOW([255, 196, 110], 5), 'lantern');
  }
  // booth fronts: counter through the wall, corner brackets, an awning when nothing shelters it
  for (const o of booth) {
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
  if (kind === 'booth' && booth.length) {
    const o = booth[doorLeft ? booth.length - 1 : 0];
    const sx = Math.round((o.a0 + o.a1) / 20) * 10;
    if (B.free([X0 + sx - 14, Y0 - PD + 2, F], [X0 + sx + 14, Y0 - 10, F + 60])) {
      stand = [X0 + sx, Y0 - Math.round(PD / 2), F + 12];
      box(sx - 14, -PD + 2, F, sx + 14, -10, F + 60, { color: [255, 0, 255], ghost: true }, 'stand ghost');
    }
  }
  // barrels and a planter on the deck
  for (const [a, k] of [[-6, 0], [BW - 14, 1]]) {
    if (hash(a, seed, 31) < 0.6) { if (B.free([X0 + a - 10, Y0 - PD + 2, F], [X0 + a + 10, Y0 - PD + 22, F + 28])) B.pole(X0 + a, Y0 - PD + 12, F, F + 28, 10, { color: shade(WOOD[k], 0.85) }, 'barrel'); }
    else if (opt(a - 8, -PD + 4, F, a + 8, -PD + 16, F + 10, { color: shade(WOOD[1], 0.8) }, 'planter'))
      for (let q = a - 6; q < a + 6; q += 4) opt(q, -PD + 6, F + 10, q + 4, -PD + 14, F + 14 + (hash(q, seed) < 0.5 ? 4 : 0), { color: hash(q, seed, 2) < 0.4 ? [70, 130, 60] : pick(BLOOMS) }, 'blooms');
  }
  // ground floor planks inside, shelves of goods on the back wall, a table, lanterns
  for (let y = 10, k = 0; y < BD - 10; y += 10, k++) box(10, y, 0, BW - 10, Math.min(BD - 10, y + 10), F, { color: shade(WOOD[k % 3], 1.05) }, 'floor planks');
  {
    const sy0 = BD - 10 - 12, sy1 = BD - 10;
    for (const sz of [F + 26, F + 50]) {
      const [p, q] = [24, BW - 24];
      if (!opt(p, sy0, sz, q, sy1, sz + 2, { color: WOOD[1] }, 'shelf')) continue;
      for (let a = p + 2; a < q - 6; a += 8 + Math.floor(hash(a, sz, seed) * 3) * 2) {
        const h = 4 + 2 * Math.floor(hash(a, sz, seed, 1) * 5), wd = 4 + 2 * Math.floor(hash(a, sz, seed, 2) * 2);
        opt(a, sy0 + 2, sz + 2, a + wd, sy0 + 8, sz + 2 + h, { color: GOODS[Math.floor(hash(a, sz, seed, 3) * GOODS.length)] }, 'goods');
      }
    }
    const tx = Math.round(BW / 20) * 10, ty = Math.round(BD / 20) * 10 + 10;
    if (opt(tx - 24, ty - 14, F + 22, tx + 24, ty + 14, F + 24, { color: WOOD[2] }, 'table top')) {
      for (const [a, b] of [[-22, -12], [18, -12], [-22, 8], [18, 8]]) opt(tx + a, ty + b, F, tx + a + 4, ty + b + 4, F + 22, { color: WOOD[0] }, 'table leg');
      for (let a = -20; a < 18; a += 8) opt(tx + a, ty - 6, F + 24, tx + a + 6, ty + 6, F + 24 + 2 * (1 + Math.floor(hash(a, seed, 5) * 3)), { color: GOODS[Math.floor(hash(a, seed, 6) * GOODS.length)] }, 'goods');
    }
    const lz = upTop ? GT : UT - 4;
    for (const lx of [Math.round(BW / 40) * 10, BW - Math.round(BW / 40) * 10]) {
      opt(lx - 1, ty - 1, lz - 10, lx + 1, ty + 1, lz, { color: [40, 40, 44] }, 'lantern chain');
      opt(lx - 4, ty - 4, lz - 18, lx + 4, ty + 4, lz - 10, GLOW([255, 196, 110], 5), 'lantern');
    }
    if (upTop) opt(Math.round(BW / 20) * 10 - 4, ty - 4, UT - 12, Math.round(BW / 20) * 10 + 4, ty + 4, UT - 4, GLOW([255, 196, 110], 4), 'lantern');
  }
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
  return { bricks, W: Wst, D: Dst, door: [Math.round((X0 + doorA + doorW / 2) / 10)], stand, scheme: sc.name, roofType, storeys, count: bricks.length };
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
