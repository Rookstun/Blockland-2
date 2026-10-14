// Abandoned settlements, goblin camps and the little random details scattered
// over the island (2026-10-06, owner: "add more random details around the map
// and goblin spawns and abandoned settlements").
//
// Everything is built in local units round (0, 0) on flat ground at z = 0
// through put(brick, x, y, z) (mapgen wraps a builder, so overlaps drop out),
// with rnd(a, b, c) the shared deterministic hash. Each builder returns the
// goblin spawner spots it wants ([x, y, z, prefab]) and nothing else.
//
// Looks (BUILDING.md): stone ruins with broken walls of uneven height, no
// roofs, fallen timbers, rubble and weeds; micro bricks wherever an underside
// shows; one shade factor per brick.

const MB = 'PB_DefaultMicroBrick';
const STONE = [[132, 128, 120], [118, 114, 108], [146, 142, 134], [104, 100, 96]];
const MOSS = [[92, 112, 70], [80, 100, 62]];
const TIMBER = [[92, 66, 44], [78, 56, 38], [104, 76, 50]];
const CLOTH = [[140, 112, 74], [120, 62, 50], [96, 104, 70], [150, 140, 116]];
const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const pick = (list, u) => list[Math.floor(u * list.length) % list.length];
const r10 = v => Math.round(v / 10) * 10;

function kit(put, orientFor) {
  const box = (x0, y0, z0, x1, y1, z1, m) => {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return false;
    return put({ asset: MB, ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  const pole = (x, y, z0, z1, r, m) => put({ asset: 'PB_DefaultPole', ...m, size: [r, r, (z1 - z0) / 2] }, x, y, (z0 + z1) / 2);
  // a pole lying down along x or y (fallen log, timber)
  const log = (x, y, z, len, r, alongX, m) => put({ asset: 'PB_DefaultPole', direction: alongX ? 0 : 2, rotation: 0, ...m, size: [r, r, len / 2] }, x, y, z + r);
  const wedge = (x0, y0, z0, x1, y1, z1, dx, dy, m) => {
    const ext = [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2];
    return put({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[dx, dy]], ext), ...m }, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  // glowing embers: a micro block (any size snaps there)
  const glow = (x, y, z, r, h) => box(x - r, y - r, z, x + r, y + r, z + h, { color: [255, 140, 40], material: 'BMC_Glow', material_intensity: 6 });
  return { box, pole, log, wedge, glow };
}

/** a ruined hamlet: 4-6 broken stone houses round a dry well, goblins squatting in it */
export function buildSettlement({ seed, rnd, put, orientFor, radius = 420 }) {
  const { box, pole, log, glow } = kit(put, orientFor);
  const R = (k, i = 0) => rnd(seed, k, i);
  const spots = [], pots = [];
  // the dry well in the middle: a broken stone ring, one roof post left standing
  for (const [x0, y0, x1, y1] of [[-30, -30, 30, -20], [-30, 20, 30, 30], [-30, -20, -20, 20], [20, -20, 30, 20]]) {
    const h = 12 + Math.round(R(5, x0 + y0) * 2) * 6;
    box(x0, y0, 0, x1, y1, h, { color: shade(pick(STONE, R(6, x0)), 0.95 + R(7, y0) * 0.1) });
  }
  pole(-40, 0, 0, 84, 5, { color: TIMBER[0] });
  // houses on a ring, each facing the well, walls broken into uneven chunks
  const n = 4 + Math.floor(R(1) * 3);
  for (let k = 0; k < n; k++) {
    const a = R(2, k) * 0.6 + (k * Math.PI * 2) / n, rad = 180 + R(3, k) * (radius - 340);
    const cx = r10(Math.cos(a) * rad), cy = r10(Math.sin(a) * rad);
    const w = r10(140 + R(4, k) * 80), d = r10(100 + R(8, k) * 60); // footprint, units
    const alongX = Math.abs(Math.cos(a)) < Math.abs(Math.sin(a));   // long side faces the well
    const W = alongX ? w : d, D = alongX ? d : w;
    const x0 = cx - W / 2, y0 = cy - D / 2, x1 = cx + W / 2, y1 = cy + D / 2;
    // door gap on the side facing the well
    const door = alongX ? (cy > 0 ? 'S' : 'N') : (cx > 0 ? 'W' : 'E');
    const sides = [['S', x0, y0, x1, y0 + 10, true], ['N', x0, y1 - 10, x1, y1, true], ['W', x0, y0 + 10, x0 + 10, y1 - 10, false], ['E', x1 - 10, y0 + 10, x1, y1 - 10, false]];
    let c = 0;
    for (const [side, sx0, sy0, sx1, sy1, horiz] of sides) {
      const L = horiz ? sx1 - sx0 : sy1 - sy0;
      for (let p = 0; p < L; p += 20, c++) {
        const mid = p + 10 - L / 2;
        if (side === door && Math.abs(mid) < 20) continue; // the doorway
        // height decays from the corners, with gaps: a broken wall
        const u = R(9 + k, c), base = 0.35 + 0.65 * Math.abs(mid) / (L / 2);
        const h = Math.round(base * u * 7) * 12;
        if (h <= 0) continue;
        const m = { color: u < 0.2 ? shade(MOSS[c % 2], 1) : shade(pick(STONE, R(30 + k, c)), 0.94 + R(31 + k, c) * 0.12) };
        if (horiz) box(sx0 + p, sy0, 0, Math.min(sx1, sx0 + p + 20), sy1, h, m);
        else box(sx0, sy0 + p, 0, sx1, Math.min(sy1, sy0 + p + 20), h, m);
      }
    }
    // smashable pots (the pots plugin) in two inside corners
    pots.push([x0 + 24, y0 + 24], [x1 - 24, y1 - 24]);
    // a fallen roof timber across the floor, and rubble against the walls
    log(cx, cy, 0, Math.floor(((alongX ? W : D) - 40) / 20) * 20, 5, alongX, { color: pick(TIMBER, R(12, k)) });
    for (let q = 0; q < 6; q++) {
      const rx = r10(x0 + 20 + R(13 + k, q) * (W - 40)), ry = r10(y0 + 20 + R(14 + k, q) * (D - 40)), s = 4 + Math.round(R(15 + k, q) * 3) * 2;
      box(rx - s, ry - s, 0, rx + s, ry + s, s + 2, { color: shade(pick(STONE, R(16 + k, q)), 0.9) });
    }
  }
  // a cold fire ring and the goblins' spots between the houses
  for (let q = 0; q < 6; q++) { const a = (q * Math.PI) / 3; box(r10(100 + Math.cos(a) * 30) - 5, r10(Math.sin(a) * 30) - 5, 0, r10(100 + Math.cos(a) * 30) + 5, r10(Math.sin(a) * 30) + 5, 8, { color: STONE[3] }); }
  glow(100, 0, 0, 6, 10);
  const goblins = 2 + Math.floor(R(20) * 3);
  for (let g = 0; g < goblins; g++) {
    const a = (g / goblins) * Math.PI * 2 + R(21, g), rr = 70 + R(22, g) * 50;
    spots.push([r10(Math.cos(a) * rr), r10(Math.sin(a) * rr), 2, R(23, g) < 0.5 ? 'enemy_goblin' : 'enemy_wood_goblin']);
  }
  for (const [px, py] of [[-60, 40], [50, -60], [-50, -50]]) pots.push([px, py]);
  return { spots, pots };
}

/** a goblin camp: a fire, a tent or two, log seats, 2-3 goblins */
export function buildCamp({ seed, rnd, put, orientFor }) {
  const { box, log, wedge, glow } = kit(put, orientFor);
  const R = (k, i = 0) => rnd(seed, k, i);
  for (let q = 0; q < 6; q++) { const a = (q * Math.PI) / 3; const x = r10(Math.cos(a) * 30), y = r10(Math.sin(a) * 30); box(x - 5, y - 5, 0, x + 5, y + 5, 8, { color: STONE[q % 4] }); }
  glow(0, 0, 0, 8, 14);
  // tents: two wedges leaning together over a ridge, cloth colour by seed
  const tents = 1 + Math.floor(R(1) * 2);
  for (let t = 0; t < tents; t++) {
    const a = R(2, t) * Math.PI * 2, tx = r10(Math.cos(a) * 110), ty = r10(Math.sin(a) * 110), cloth = pick(CLOTH, R(3, t));
    const alongX = R(4, t) < 0.5, L = 80, Hh = 50;
    if (alongX) { wedge(tx - L / 2, ty - 40, 0, tx + L / 2, ty, Hh, 0, 1, { color: cloth }); wedge(tx - L / 2, ty, 0, tx + L / 2, ty + 40, Hh, 0, -1, { color: shade(cloth, 0.9) }); }
    else { wedge(tx - 40, ty - L / 2, 0, tx, ty + L / 2, Hh, 1, 0, { color: cloth }); wedge(tx, ty - L / 2, 0, tx + 40, ty + L / 2, Hh, -1, 0, { color: shade(cloth, 0.9) }); }
  }
  log(0, -70, 0, 60, 5, true, { color: TIMBER[1] });
  log(-70, 0, 0, 60, 5, false, { color: TIMBER[2] });
  const pots = [[90, 0], [0, 90]];
  const spots = [], n = 2 + Math.floor(R(5) * 2);
  for (let g = 0; g < n; g++) { const a = (g / n) * Math.PI * 2 + 0.7; spots.push([r10(Math.cos(a) * 60), r10(Math.sin(a) * 60), 2, R(6, g) < 0.6 ? 'enemy_goblin' : 'enemy_wood_goblin']); }
  return { spots, pots };
}

/**
 * One small detail in a 40 x 40 cell (local 0..40, ground z 0), or a run of
 * cells for a log or cart (len cells along +x or +y). kind by biome / chance.
 */
export const DETAILS = {
  log: { cells: 2 }, stump: {}, cairn: {}, firering: {}, mushrooms: {}, bones: {}, cart: { cells: 2 }, shrine: {}, signpost: {},
};
export function buildDetail(kind, { seed, rnd, put, orientFor, alongX = true }) {
  const { box, pole, log, glow } = kit(put, orientFor);
  const R = (k, i = 0) => rnd(seed, k, i);
  if (kind === 'log') { log(alongX ? 40 : 20, alongX ? 20 : 40, 0, 64, 10, alongX, { color: pick(TIMBER, R(1)) }); box(alongX ? 34 : 14, alongX ? 14 : 34, 20, alongX ? 46 : 26, alongX ? 26 : 46, 22, { color: MOSS[0] }); }
  else if (kind === 'stump') { pole(20, 20, 0, 12 + Math.round(R(1) * 3) * 4, 10, { color: pick(TIMBER, R(2)) }); }
  else if (kind === 'cairn') { let z = 0; for (let k = 0, s = 14; k < 4 && s >= 4; k++, s -= 3 + Math.round(R(1, k)) * 2) { box(20 - s, 20 - s, z, 20 + s, 20 + s, z + 6, { color: pick(STONE, R(2, k)) }); z += 6; } }
  else if (kind === 'firering') { for (let q = 0; q < 6; q++) { const a = (q * Math.PI) / 3, x = r10(20 + Math.cos(a) * 12), y = r10(20 + Math.sin(a) * 12); box(x - 3, y - 3, 0, x + 3, y + 3, 4, { color: STONE[q % 4] }); } box(16, 16, 0, 24, 24, 2, { color: [40, 36, 32] }); }
  else if (kind === 'mushrooms') { for (let q = 0; q < 3; q++) { const x = 10 + q * 10, y = 12 + Math.round(R(1, q) * 2) * 6, h = 6 + Math.round(R(2, q) * 2) * 2; box(x - 1, y - 1, 0, x + 1, y + 1, h, { color: [230, 224, 210] }); box(x - 4, y - 4, h, x + 4, y + 4, h + 2, { color: q % 2 ? [190, 40, 36] : [176, 120, 70] }); } }
  else if (kind === 'bones') { const c = [232, 226, 210]; box(10, 18, 0, 30, 22, 2, { color: c }); box(18, 10, 0, 22, 16, 2, { color: c }); box(14, 24, 0, 22, 32, 6, { color: c }); }
  else if (kind === 'cart') {
    // an abandoned cart: a plank bed on two wheels, tipped tongue
    const L = 70, W = 30, ax = alongX;
    const bed = (u0, v0, u1, v1, z0, z1, m) => ax ? box(5 + u0, 5 + v0, z0, 5 + u1, 5 + v1, z1, m) : box(5 + v0, 5 + u0, z0, 5 + v1, 5 + u1, z1, m);
    bed(0, 0, L, W, 14, 18, { color: TIMBER[1] });
    bed(0, 0, L, 2, 18, 26, { color: TIMBER[0] }); bed(0, W - 2, L, W, 18, 26, { color: TIMBER[0] });
    for (const v of [-4, W]) { const u = L / 2; if (ax) put({ asset: 'PB_DefaultPole', direction: 2, rotation: 0, color: [70, 50, 34], size: [10, 10, 2] }, 5 + u, 5 + v + 2, 12); else put({ asset: 'PB_DefaultPole', direction: 0, rotation: 0, color: [70, 50, 34], size: [10, 10, 2] }, 5 + v + 2, 5 + u, 12); }
  }
  else if (kind === 'shrine') { box(10, 10, 0, 30, 30, 8, { color: STONE[1] }); box(14, 14, 8, 26, 26, 30, { color: STONE[2] }); box(16, 16, 30, 24, 24, 34, { color: STONE[0] }); glow(20, 20, 34, 3, 6); }
  else if (kind === 'signpost') { box(18, 18, 0, 22, 22, 60, { color: TIMBER[0] }); box(alongX ? 6 : 18, alongX ? 18 : 6, 44, alongX ? 34 : 22, alongX ? 22 : 34, 56, { color: [150, 116, 76] }); }
  return { spots: [] };
}

// ----------------------------------------------------------------- signs --
// Town and hamlet signs (2026-10-06, owner: "town signs"): a post with a plank
// board, the name painted on both faces with Component_TextDisplay (settings
// from the owner's shop price display: Face 4 = the brick's local +Z face).
// The shop button reads from -y with direction 3 / rotation 1; the other
// facings are that orientation turned about Z.
import { ORIENT } from './orient.mjs';
const BASE_CODE = 3 * 4 + 1; // local +Z -> world -y, local x -> world -x, local y -> world -z
const turnZ = ([x, y, z], k) => { for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [x, y, z]; };
const codeFacing = (() => {
  const out = {};
  for (let k = 0; k < 4; k++) {
    const want = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => turnZ(ORIENT[BASE_CODE](v), k).map(q => q + 0).join());
    for (let c = 0; c < 24; c++) if ([[1, 0, 0], [0, 1, 0], [0, 0, 1]].every((v, i) => ORIENT[c](v).map(q => q + 0).join() === want[i])) {
      const f = turnZ([0, -1, 0], k); out[f.map(q => q + 0).join()] = c;
    }
  }
  return out; // "dx,dy,0" -> orientation code whose local +Z faces (dx, dy)
})();
// index 0 = the sign font; 1.. = signpost fonts (signpost.mjs SIGN_FONTS; owner 2026-10-13 "experiment with the fonts")
export const EXTERNAL_ASSETS = ['MonaspaceXenon', 'Cinzel', 'PirataOne', 'Gotfridus', 'EagleLake', 'Bungee'].map(name => ({ type: 'BrickFontDescriptor', name }));
const TEXT = {
  Font: 0, Rotation: -90, // Font = index into the load's externalAssets: [{ type: 'BrickFontDescriptor', name: 'MonaspaceXenon' }]
  Skew: 0, Kerning: 0, LineHeight: 3, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { B: 200, G: 236, R: 246, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { B: 20, G: 28, R: 40, A: 255 }, OutlineWidth: 2,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};
/** a sign in a 40 x 40 cell (local 0..40, ground 0), its board facing (dx, dy) and its back the other way */
export function buildSign({ put, text, facing, broken = false }) {
  const [dx, dy] = facing, W = 36, Hb = 14; // board half width / half height
  const post = [96, 70, 46], plank = broken ? [120, 104, 84] : [150, 112, 72];
  const zc = broken ? 34 : 54; // board centre height
  put({ asset: 'PB_DefaultMicroBrick', color: post, size: [3, 3, (zc + Hb) / 2] }, 20, 20, (zc + Hb) / 2);
  for (const s of [1, -1]) {
    const f = [dx * s, dy * s], code = codeFacing[`${f[0]},${f[1]},0`];
    // the board half on this side of the post line, 2 units thick, text on its outward face
    put({ asset: 'PB_DefaultMicroBrick', direction: code >> 2, rotation: code & 3, color: plank, size: [W, Hb, 1],
      components: [{ type: 'Component_TextDisplay', data: { ...TEXT, Text: text } }] }, 20 + f[0] * 4, 20 + f[1] * 4, zc);
  }
}

/** a made-up place name from a seed: two syllables */
const NA = ['Ash', 'Bram', 'Cold', 'Dun', 'Elm', 'Fen', 'Gol', 'Holl', 'Iver', 'Kin', 'Lark', 'Mill', 'Nor', 'Oak', 'Pike', 'Rook', 'Stan', 'Thorn', 'Wes', 'Wyn', 'Brack', 'Crow', 'Hay', 'Mor'];
const NB = ['ford', 'brook', 'wick', 'stead', 'hollow', 'by', 'ham', 'moor', 'vale', 'mere', 'ton', 'well', 'field', 'cross', 'gate', 'ley'];
export function placeName(seed, rnd) { return NA[Math.floor(rnd(seed, 801) * NA.length)] + NB[Math.floor(rnd(seed, 802) * NB.length)]; }

/** a name board: a thin plank centred (x, y, z), its text on the face toward (dx, dy) (a wall face, a lintel) */
export function plaque({ put, text, facing: [dx, dy], x, y, z, w = 36, h = 10, color = [150, 112, 72], style = {} }) {
  const code = codeFacing[`${dx},${dy},0`];
  return put({ asset: 'PB_DefaultMicroBrick', direction: code >> 2, rotation: code & 3, color, size: [w, h, 1],
    components: [{ type: 'Component_TextDisplay', data: { ...TEXT, ...style, Text: text } }] }, x, y, z);
}
