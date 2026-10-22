// zeldoy/gen.mjs: ZELDOY, a top-down NES-style adventure in one microchip (wirescript, Super Sigmas engine).
// Zeldoy has a sword, a quest and three chronic conditions. 3x3 overworld, screen-by-screen like the old games
// (each room loads in 2 tile rows a tick = a little wipe). Get 3 Tri-Pills (Pollen Meadow, Sugar Dunes, Gut Caverns)
// to open the gate to Ganondoc's Billing Office and beat him.
//   DIABETES: SUGAR drops over time and when you swing. Low or high = slow; 0 = faint, 100 = damage. Candy +30, insulin -45.
//   ASTHMA:   AIR pays for every swing, refills when you rest, not in the pollen. Low = slow, no swings. Inhaler = full.
//   CROHN'S:  GUT fills (faster after candy, double in the caverns). Full = 12 s to reach an outhouse, or else.
//   inputs (@left): tick (20 Hz), seated, left right up down, item (Space/RMB: smart meds pouch), swing (LMB/E)
//   outputs: strip0..strip8, msg_, hud_, title_, P0/V0 lead, P1/V1 bass, P2/V2 sfx, state_
export const W = 48, H = 36, STRIP = 4, TW = 24, TH = 18;
export const PAL = ['0d0a14', '1e5a1e', '3f9a3a', '80d050', 'e8c890', '7a4a20', '808088', 'f4f4f4',
  'e03838', 'f8c0a0', '3868d8', '202028', 'f8d040', '78e8f8', '4a2a10', 'f080c0'];

// ---- tiles: [tl, tr, bl, br] palette, solid
const TILES = {
  hud: [[0, 0, 0, 0], 1], ground: [[4, 4, 4, 4], 0], flower: [[4, 12, 15, 4], 0], dune: [[4, 12, 4, 4], 0],
  tree: [[2, 3, 1, 1], 1], rock: [[6, 7, 11, 6], 1], water: [[10, 13, 10, 10], 1], cliff: [[5, 14, 14, 5], 1],
  cave: [[11, 11, 11, 0], 0], brick: [[6, 11, 11, 6], 1], dfloor: [[0, 11, 11, 0], 0], gate: [[8, 8, 11, 11], 1],
  shack: [[5, 5, 14, 14], 1], loo: [[14, 7, 14, 14], 0], counter: [[7, 7, 8, 8], 1], pfloor: [[7, 7, 7, 6], 0],
  shelf: [[10, 15, 14, 14], 1],
};
const TN = Object.keys(TILES), T = Object.fromEntries(TN.map((k, i) => [k, i]));

// rooms r = ry * 3 + rx. 1 = boss (only from 4, through the gate), shards in 0 2 8, outhouses in 3 5 7, pharmacy 6, start 7
const ROOMS_INFO = [
  { name: 'Pollen Meadow', floor: 'flower', wall: 'tree', deco: 'tree', n: 16, en: [1, 1, 1, 1] },
  { name: "Ganondoc's Billing Office", floor: 'dfloor', wall: 'brick', deco: null, n: 0, en: [] },
  { name: 'Sugar Dunes', floor: 'dune', wall: 'rock', deco: 'rock', n: 14, en: [0, 0, 0, 0] },
  { name: 'Lake Lactose', floor: 'ground', wall: 'tree', deco: 'tree', n: 6, en: [0, 2], lake: 1, loo: [17, 12] },
  { name: 'Crossroads of Copay', floor: 'ground', wall: 'tree', deco: 'tree', n: 12, en: [0, 0, 2] },
  { name: 'Rocky Reflux', floor: 'ground', wall: 'rock', deco: 'rock', n: 14, en: [2, 2], loo: [4, 12] },
  { name: 'Ye Olde Pharmacy', floor: 'pfloor', wall: 'brick', deco: null, n: 0, en: [], shop: 1 },
  { name: 'Hospital Lawn', floor: 'ground', wall: 'tree', deco: 'tree', n: 8, en: [], loo: [17, 12] },
  { name: 'Gut Caverns', floor: 'cave', wall: 'cliff', deco: 'rock', n: 14, en: [2, 2, 2, 0] },
];
const NB = [];           // per room: up down left right
for (let r = 0; r < 9; r++) {
  const x = r % 3, y = Math.floor(r / 3);
  NB.push(y > 0 ? r - 3 : -1, y < 2 ? r + 3 : -1, x > 0 ? r - 1 : -1, x < 2 ? r + 1 : -1);
}
NB[0 * 4 + 3] = -1; NB[2 * 4 + 2] = -1; NB[1 * 4 + 2] = -1; NB[1 * 4 + 3] = -1; // the boss room: only the gate
const SHARD = [0, -1, 1, -1, -1, -1, -1, -1, 2];

function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildRooms() {
  const all = [], ESX = [], ESY = [], EK = [];
  ROOMS_INFO.forEach((R, r) => {
    const t = Array(TW * TH).fill(T[R.floor]);
    const set = (x, y, k) => { t[y * TW + x] = T[k]; };
    for (let x = 0; x < TW; x++) set(x, 0, 'hud');
    for (let x = 0; x < TW; x++) { set(x, 1, R.wall); set(x, TH - 1, R.wall); }
    for (let y = 1; y < TH; y++) { set(0, y, R.wall); set(TW - 1, y, R.wall); }
    const [up, dn, lf, rt] = NB.slice(r * 4, r * 4 + 4);
    if (up >= 0) for (let x = 10; x <= 13; x++) set(x, 1, r === 4 ? 'gate' : R.floor);
    if (dn >= 0) for (let x = 10; x <= 13; x++) set(x, TH - 1, R.floor);
    if (lf >= 0) for (let y = 8; y <= 10; y++) set(0, y, R.floor);
    if (rt >= 0) for (let y = 8; y <= 10; y++) set(TW - 1, y, R.floor);
    const rnd = rng(1000 + r * 77);
    const clear = (x, y) => (x >= 9 && x <= 14) || (y >= 7 && y <= 11);
    if (R.lake) for (let y = 3; y <= 5; y++) for (let x = 2; x <= 7; x++) if (!(y === 5 && (x === 2 || x === 7))) set(x, y, 'water');
    if (R.loo) { const [x, y] = R.loo; set(x, y, 'shack'); set(x + 1, y, 'shack'); set(x, y + 1, 'loo'); set(x + 1, y + 1, 'loo'); }
    if (R.shop) { for (let x = 3; x <= 20; x++) set(x, 5, 'counter'); for (let x = 2; x <= 21; x++) set(x, 2, 'shelf'); }
    for (let i = 0, tries = 0; i < R.n && tries < 500; tries++) {
      const x = 2 + Math.floor(rnd() * 20), y = 3 + Math.floor(rnd() * 13);
      if (clear(x, y) || t[y * TW + x] !== T[R.floor]) continue;
      if (R.loo && Math.abs(x - R.loo[0]) < 4 && Math.abs(y - R.loo[1]) < 4) continue;
      set(x, y, R.deco); i++;
    }
    // enemy spawn spots: feet on 2 free tiles, away from the doors
    const sx = [], sy = [], ek = [];
    for (let k = 0, tries = 0; k < 4 && tries < 2000; tries++) {
      if (k >= R.en.length) { sx.push(0); sy.push(0); ek.push(-1); k++; continue; }
      const x = 2 + Math.floor(rnd() * 19), y = 3 + Math.floor(rnd() * 12);
      if (SOL(t[y * TW + x]) || SOL(t[y * TW + x + 1]) || SOL(t[(y - 1) * TW + x]) || SOL(t[(y - 1) * TW + x + 1])) continue;
      if (Math.abs(x - 11) < 4 && (y < 5 || y > 13)) continue;
      if (Math.abs(y - 9) < 3 && (x < 4 || x > 19)) continue;
      if (sx.some((v, j) => Math.abs(v - x * 2) < 5 && Math.abs(sy[j] - (y * 2 - 2)) < 5)) continue;
      sx.push(x * 2); sy.push(y * 2 - 2); ek.push(R.en[k]); k++;
    }
    if (ek.length !== 4) throw Error(`room ${r}: spawn spots`);
    all.push(...t); ESX.push(...sx); ESY.push(...sy); EK.push(...ek);
  });
  return { all, ESX, ESY, EK };
}
const SOL = k => TILES[TN[k]][1];

// ---- sprites (rows of palette hex, '.' transparent)
const SPRITES = {
  zD: ['.2.', '999', '232', '5.5'], zU: ['222', '222', '232', '5.5'], zL: ['22.', '992', '232', '5.5'], zR: ['.22', '299', '232', '5.5'],
  zW: ['.2.', '999', '232', '.5.'], zHurt: ['.8.', '999', '878', '5.5'],
  swU: ['7', '7', '6'], swD: ['6', '7', '7'], swL: ['776'], swR: ['677'],
  rok: ['.8.', '878', '8.8'], rok2: ['8.8', '878', '.8.'],
  puff: ['c.c', '.c.', 'c.c'], puff2: ['.c.', 'ccc', '.c.'],
  mob: ['5.5', '595', '555', 'e.e'], mob2: ['5.5', '595', '555', '.e.'], hit: ['777', '7.7', '777'],
  boss: ['.bbbb.', 'b9999b', '.9bb9.', '777777', '77a777', '7.a7.7', '6....6'], bossHit: ['.8888.', '888888', '.8778.', '888888', '888888', '8.88.8', '8....8'],
  letter: ['78', '77'], oldman: ['.7.', '979', '888', '888'], fire: ['.8.', '8c8', '.c.'], fire2: ['8.8', '.c.', '8c8'],
  pharm: ['bbb', '999', '777', '777'],
  heart: ['8.8', '888', '.8.'], candy: ['f7f', '7f7'], rupee: ['.3.', '323', '.3.'], rupee2: ['.2.', '232', '.2.'],
  shard: ['.c.', 'ccc'], inhaler: ['aaa', 'a..'], pen: ['677d'],
  bang: ['8', '8', '.', '8'], wheeze: ['7.7'], drop: ['d', 'd'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));

// ---- music (original): 0 overworld, 1 caverns / boss, 2 game over, 3 victory
const SONGS = [
  { eighth: 3, loop: 1,
    lead: 'C5:2 G4:1 G4:1 C5:2 D5:1 E5:1 | F5:2 E5:1 D5:1 E5:4 | A4:2 E5:1 D5:1 C5:2 B4:1 A4:1 | G4:2 A4:1 B4:1 C5:4',
    bass: 'C3:2 G2:2 C3:2 G2:2 | F2:2 C3:2 C3:2 G2:2 | A2:2 E2:2 F2:2 C3:2 | G2:2 D3:2 C3:4' },
  { eighth: 2, loop: 1,
    lead: 'E4:1 G4:1 A#4:1 A4:1 E4:1 G4:1 A#4:1 B4:1 | E5:2 D#5:2 D5:2 C#5:2',
    bass: 'E2:1 E2:1 E3:1 E2:1 E2:1 E2:1 E3:1 E2:1 | A#1:2 A1:2 G#1:2 G1:2' },
  { eighth: 4, loop: 0, lead: 'G4:2 F#4:2 F4:2 E4:6', bass: 'C3:4 B2:4 A#2:6' },
  { eighth: 3, loop: 0, lead: 'C5:1 E5:1 G5:1 C6:2 A5:1 B5:1 C6:6', bass: 'C3:2 G2:2 C3:2 G3:6' },
];
const SFX = {
  swing: [1.8, 1.4, 1.0], hit: [0.5, 0.4], hurt: [0.8, 0.6, 0.4, 0.3], pick: [2.0, 2.5, 3.0], rupee: [3.0, 4.0, 3.0, 4.0],
  puff: [0.3, 0.32, 0.34, 0.36, 0.38, 0.4], inject: [3.5, 3.5, 0.01, 2.0], flush: [2.0, 1.8, 1.6, 1.4, 1.2, 1.0, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4],
  wheeze: [1.2, 0.01, 1.3, 0.01, 1.2], secret: [1.0, 1.26, 1.5, 2.0, 2.0, 2.0], denied: [0.6, 0.6, 0.01, 0.5], buy: [2.5, 3.0],
  faint: [1.5, 1.3, 1.1, 0.9, 0.7, 0.5], kill: [0.6, 1.2, 2.4], alarm: [2.5, 0.01, 2.5, 0.01, 2.5, 0.01],
};
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NAMES.indexOf(m[1]) + 12 * (+m[2] + 1); };
const parseVoice = (s, e) => s.split(/\s+/).filter(t => t && t !== '|').map(tok => { const [n, d = '1'] = tok.split(':'); return [n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * e)]; });

const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false } = {}) {
  const NS = H / STRIP;
  const rm = buildRooms();
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) throw Error(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);
  const RT = TW * TH;

  const src = `// GENERATED by zeldoy/gen.mjs: edit that, not this file.
// ZELDOY: one frame per 'tick' pulse (20 Hz) while 'seated' is true. Standing up blanks the screen.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in item: bool
@left in swing: bool

const W = ${W}
const H = ${H}
const TILEPIX = ${A(TN.flatMap(k => TILES[k][0]))}
const SOLID = ${A(TN.map(k => TILES[k][1]))}
const ROOMS = ${A(rm.all)}
const ESX = ${AF(rm.ESX)}
const ESY = ${AF(rm.ESY)}
const EK = ${A(rm.EK)}
const NB = ${A(NB)}
const SHARD = ${A(SHARD)}
const RNAME = ${AS(ROOMS_INFO.map(r => r.name))}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const OPEN = ${AS(OPEN)}
const CLOSE = ${AS(CLOSE)}
const BLK = ${AS(BLK)}
const NP0 = ${AF(voices[0].map(n => n[0]))}
const ND0 = ${A(voices[0].map(n => n[1]))}
const VO0 = ${A(vo[0])}
const VL0 = ${A(vl[0])}
const NP1 = ${AF(voices[1].map(n => n[0]))}
const ND1 = ${A(voices[1].map(n => n[1]))}
const VO1 = ${A(vo[1])}
const VL1 = ${A(vl[1])}
const SLOOP = ${A(SONGS.map(s => s.loop))}
const FXP = ${AF(fxp)}
const FXO = ${A(fxo)}
const FXL = ${A(fxl)}
const SHX = [10.0, 22.0, 34.0]
const SHY = [18.0, 18.0, 18.0]
const SHP = [5, 5, 2]
const SHN = ["an inhaler", "an insulin pen", "candy"]
const TIPS = ["Old man: 'Pollen Meadow. Bring your inhaler. Bring two.'", "Old man: 'Candy fixes low sugar. Candy also wakes the gut.'", "Old man: 'Outhouses: west of here, at the lake, by the rocks.'", "Old man: 'Ganondoc denies everything. Hit him anyway.'"]

var fb: int[] = ${zeros(W * H)}
var bg: int[] = ${zeros(W * H)}
var dirty: int[] = ${zeros(H)}
var sdirty: int[] = ${zeros(NS)}
var rows: string[] = ${zeros(H, '""')}
${strips.map(k => `var st${k}: string = ""`).join('\n')}
var msg: string = ""
var msgT: int = 0
var hud: string = ""
var booted: bool = false

var state: int = -1         // -1 off, 0 title, 1 playing, 2 game over, 3 victory
var stT: int = 0
var t: int = 0
var room: int = 7
var loadR: int = 9          // tile-row pairs still to draw (9 = done)
var px: float = 22.0
var py: float = 22.0
var pf: int = 1             // 0 up 1 down 2 left 3 right
var walking: bool = false
var hp: int = 6
var inv: int = 0
var kbx: float = 0.0
var kby: float = 0.0
var sword: bool = false
var swT: int = 0
var sugar: float = 60.0
var air: float = 100.0
var gut: float = 10.0
var urg: int = 0
var lowW: bool = false
var highW: bool = false
var airW: bool = false
var puffs: int = 0
var pens: int = 0
var candy: int = 0
var cash: int = 0
var tri: int = 0
var triGot: int[] = [0, 0, 0]
var score: int = 0
var hi: int = 0
var tipI: int = 0
var talkCd: int = 0
var buyCd: int = 0
var gateCd: int = 0
var looCd: int = 0
var ek: int[] = [-1, -1, -1, -1]
var ex: float[] = [0.0, 0.0, 0.0, 0.0]
var ey: float[] = [0.0, 0.0, 0.0, 0.0]
var ehp: int[] = [0, 0, 0, 0]
var ed: int[] = [0, 0, 0, 0]
var eT: int[] = [0, 0, 0, 0]
var efl: int[] = [0, 0, 0, 0]
var ekx: float[] = [0.0, 0.0, 0.0, 0.0]
var eky: float[] = [0.0, 0.0, 0.0, 0.0]
var pk: int[] = [-1, -1, -1, -1]
var pkx: float[] = [0.0, 0.0, 0.0, 0.0]
var pky: float[] = [0.0, 0.0, 0.0, 0.0]
var pkT: int[] = [0, 0, 0, 0]
var shardOut: bool = false
var bossHp: int = 12
var bossX: float = 21.0
var bossD: float = 1.0
var bossFl: int = 0
var bossT: int = 0
var lb: int[] = [0, 0, 0]
var lbx: float[] = [0.0, 0.0, 0.0]
var lby: float[] = [0.0, 0.0, 0.0]
var lbvx: float[] = [0.0, 0.0, 0.0]
var lbvy: float[] = [0.0, 0.0, 0.0]
var kL: bool = false
var kR: bool = false
var kU: bool = false
var kD: bool = false
var kJ: bool = false
var kS: bool = false
var pJ: bool = false
var pS: bool = false
var rx: int[] = []
var ry: int[] = []
var rw: int[] = []
var rh: int[] = []
var hx: float = 0.0
var hy: float = 0.0

var song: int = -1
var mi0: int = 0
var md0: int = 0
var mt0: int = 0
var mp0: float = 0.0
var mi1: int = 0
var md1: int = 0
var mp1: float = 0.0
var fxId: int = -1
var fxI: int = 0
var aP0: float = 1.0
var aV0: float = 0.0
var aP1: float = 1.0
var aV1: float = 0.0
var aP2: float = 1.0
var aV2: float = 0.0

${strips.map(k => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = msg
@right out hud_: string = hud
@right out title_: string = if state == 0 then "ZELDOY" else ""
@right out P0: float = aP0
@right out V0: float = aV0
@right out P1: float = aP1
@right out V1: float = aV1
@right out P2: float = aP2
@right out V2: float = aV2
@right out state_: int = state

// ---------- helpers
mod say(s: string, n: int) {
  msg = s
  msgT = n
}
mod playSong(s: int) {
  song = s
  mi0 = 0
  md0 = 0
  mi1 = 0
  md1 = 0
  mp0 = 0.0
  mp1 = 0.0
}
mod sfx(k: int) {
  fxId = k
  fxI = 0
}
mod effTile(k: int) -> int {
  if k == ${T.gate} && tri >= 3 { return ${T.ground} }
  return k
}
mod tileAt(cx: int, cy: int) -> int {
  if cx < 0 || cx >= W || cy < 0 || cy >= H { return ${T.hud} }
  return effTile(ROOMS[room * ${RT} + floor(cy / 2.0) * ${TW} + floor(cx / 2.0)])
}
mod solid(cx: int, cy: int) -> int {
  return SOLID[tileAt(cx, cy)]
}
mod dist(ax: float, ay: float, bx0: float, by0: float) -> float {
  return sqrt((ax - bx0) * (ax - bx0) + (ay - by0) * (ay - by0))
}
// move a 3 x 4 box (feet = its lower 2 rows collide) against solid tiles: result in hx, hy
mod moveBox(x: float, y: float, ddx: float, ddy: float) {
  var nx: float = x + ddx
  if ddx > 0.0 {
    let e: int = floor(nx + 2.99)
    if solid(e, floor(y + 2.0)) + solid(e, floor(y + 3.99)) > 0 { nx = e - 3 }
  } else if ddx < 0.0 {
    let e: int = floor(nx)
    if solid(e, floor(y + 2.0)) + solid(e, floor(y + 3.99)) > 0 { nx = e + 1 }
  }
  var ny: float = y + ddy
  if ddy > 0.0 {
    let e: int = floor(ny + 3.99)
    if solid(floor(nx), e) + solid(floor(nx + 2.99), e) > 0 { ny = e - 4 }
  } else if ddy < 0.0 {
    let e: int = floor(ny + 2.0)
    if solid(floor(nx), e) + solid(floor(nx + 2.99), e) > 0 { ny = e - 1 }
  }
  hx = nx
  hy = ny
}

// ---------- sound
mod audio() {
  if song >= 0 {
    md0 -= 1
    if md0 <= 0 {
      if mi0 >= VL0[song] && SLOOP[song] > 0 { mi0 = 0 }
      if mi0 < VL0[song] {
        let n = VO0[song] + mi0
        mp0 = NP0[n]
        md0 = ND0[n]
        mt0 = 0
        mi0 += 1
      } else {
        mp0 = 0.0
        md0 = 100000
      }
    }
    md1 -= 1
    if md1 <= 0 {
      if mi1 >= VL1[song] && SLOOP[song] > 0 { mi1 = 0 }
      if mi1 < VL1[song] {
        let n = VO1[song] + mi1
        mp1 = NP1[n]
        md1 = ND1[n]
        mi1 += 1
      } else {
        mp1 = 0.0
        md1 = 100000
      }
    }
    mt0 += 1
  }
  if mp0 > 0.0 {
    aP0 = mp0
    aV0 = if md0 <= 1 then 0.0 else 0.3 * max(0.4, 1.0 - mt0 * 0.08)
  } else { aV0 = 0.0 }
  if mp1 > 0.0 {
    aP1 = mp1
    aV1 = if md1 <= 1 then 0.0 else 0.6
  } else { aV1 = 0.0 }
  if fxId >= 0 {
    if fxI < FXL[fxId] {
      aP2 = FXP[FXO[fxId] + fxI]
      aV2 = 0.5
      fxI += 1
    } else {
      fxId = -1
      aV2 = 0.0
    }
  } else { aV2 = 0.0 }
}

// ---------- drawing
// the room loads 2 tile rows (4 cell rows) a tick: the screen wipes top to bottom
mod loadStep() {
  for j in 0..${4 * W} {
    let cx = j % W
    let cy = loadR * 4 + j / W
    let i = cy * W + cx
    let c = TILEPIX[tileAt(cx, cy) * 4 + (cy % 2) * 2 + cx % 2]
    bg[i] = c
    if fb[i] != c {
      fb[i] = c
      dirty[cy] = 1
    }
  }
  loadR += 1
}
mod eraseRect(x: int, y: int, w: int, h: int) {
  for j in 0..w * h {
    let cx = x + j % w
    let cy = y + j / w
    if cx >= 0 && cx < W && cy >= 0 && cy < H {
      let i = cy * W + cx
      if fb[i] != bg[i] {
        fb[i] = bg[i]
        dirty[cy] = 1
      }
    }
  }
}
mod put(cx: int, cy: int, c: int) {
  if cx >= 0 && cx < W && cy >= 0 && cy < H {
    let i = cy * W + cx
    if fb[i] != c {
      fb[i] = c
      dirty[cy] = 1
    }
  }
}
mod drawSpr(s: int, x: int, y: int) {
  let w = SW[s]
  let o = SOFF[s]
  for j in 0..w * SH[s] {
    let c = SPR[o + j]
    if c >= 0 { put(x + j % w, y + j / w, c) }
  }
  rx.push(x)
  ry.push(y)
  rw.push(w)
  rh.push(SH[s])
}
mod encRow(r: int) {
  var s: string = ""
  var c0: int = -1
  var n: int = 0
  for c in 0..W {
    let p = fb[r * W + c]
    if p == c0 {
      n += 1
    } else {
      if n > 0 { s = s .. OPEN[c0] .. BLK[n] .. CLOSE[c0] }
      c0 = p
      n = 1
    }
  }
  rows[r] = s .. OPEN[c0] .. BLK[n] .. CLOSE[c0]
}
mod pickSpr(k: int) -> int {
  if k == 0 { return ${S.heart} }
  if k == 1 { return ${S.candy} }
  if k == 2 { return if (t / 6) % 2 > 0 then ${S.rupee} else ${S.rupee2} }
  if k == 3 { return ${S.shard} }
  if k == 4 { return ${S.inhaler} }
  return ${S.pen}
}
mod bar(x0: int, n: int, v: float, c: int) {
  let f: int = floor(v * n / 100.0 + 0.5)
  for i in 0..n {
    let col = if i < f then c else 11
    put(x0 + i, 0, col)
    put(x0 + i, 1, col)
  }
}
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  if loadR >= 9 && state >= 0 {
    for k in 0..4 {
      if pk[k] >= 0 && (pkT[k] > 60 || t % 4 < 2) { drawSpr(pickSpr(pk[k]), floor(pkx[k]), floor(pky[k])) }
    }
    if room == 6 {
      drawSpr(${S.pharm}, 22, 6)
      drawSpr(${S.inhaler}, 10, 19)
      drawSpr(${S.pen}, 22, 19)
      drawSpr(${S.candy}, 35, 19)
    }
    if room == 7 {
      drawSpr(${S.oldman}, 22, 5)
      drawSpr(if t % 6 < 3 then ${S.fire} else ${S.fire2}, 15, 6)
      drawSpr(if t % 6 < 3 then ${S.fire2} else ${S.fire}, 30, 6)
    }
    for k in 0..4 {
      if ek[k] >= 0 {
        let x: int = floor(ex[k])
        let y: int = floor(ey[k])
        let a = (t / 5) % 2 > 0
        if efl[k] > 0 && t % 2 == 0 { drawSpr(${S.hit}, x, y + 1) }
        else if ek[k] == 0 { drawSpr(if a then ${S.rok} else ${S.rok2}, x, y + 1) }
        else if ek[k] == 1 { drawSpr(if a then ${S.puff} else ${S.puff2}, x, y + 1) }
        else { drawSpr(if a then ${S.mob} else ${S.mob2}, x, y) }
      }
    }
    if room == 1 && bossHp > 0 {
      drawSpr(if bossFl > 0 && t % 2 == 0 then ${S.bossHit} else ${S.boss}, floor(bossX), 6)
      for k in 0..3 {
        if lb[k] > 0 { drawSpr(${S.letter}, floor(lbx[k]), floor(lby[k])) }
      }
    }
    if state != 2 && (inv == 0 || t % 4 < 2) {
      var zs: int = ${S.zD}
      if pf == 0 { zs = ${S.zU} } else if pf == 2 { zs = ${S.zL} } else if pf == 3 { zs = ${S.zR} } else if walking && (t / 3) % 2 > 0 { zs = ${S.zW} }
      if inv > 30 { zs = ${S.zHurt} }
      let x: int = floor(px)
      let y: int = floor(py)
      drawSpr(zs, x, y)
      if swT > 0 {
        if pf == 0 { drawSpr(${S.swU}, x + 1, y - 3) }
        else if pf == 1 { drawSpr(${S.swD}, x + 1, y + 4) }
        else if pf == 2 { drawSpr(${S.swL}, x - 3, y + 2) }
        else { drawSpr(${S.swR}, x + 3, y + 2) }
      }
      if urg > 0 && t % 10 < 6 { drawSpr(${S.bang}, x + 1, y - 5) }
      else if air < 15.0 && t % 12 < 6 { drawSpr(${S.wheeze}, x, y - 2) }
      else if (sugar < 20.0 || sugar > 85.0) && t % 16 < 4 { drawSpr(${S.drop}, x + 3, y) }
    }
  }
  // HUD: hearts | sugar | air | gut
  for i in 0..6 {
    let c = if i < hp then 8 else 11
    put(i * 2, 0, c)
    put(i * 2, 1, c)
  }
  bar(13, 12, sugar, if (sugar < 20.0 || sugar > 85.0) && t % 8 < 4 then 8 else 12)
  bar(26, 10, air, if air < 15.0 && t % 8 < 4 then 8 else 13)
  bar(37, 10, gut, if urg > 0 && t % 6 < 3 then 8 else 5)
  for r in 0..H {
    if dirty[r] > 0 {
      encRow(r)
      dirty[r] = 0
      sdirty[r / ${STRIP}] = 1
    }
  }
${strips.map(k => `  if sdirty[${k}] > 0 {
    st${k} = ${Array.from({ length: STRIP }, (_, j) => `rows[${k * STRIP + j}]`).join(' .. "\\n" .. ')}
    sdirty[${k}] = 0
  }`).join('\n')}
}

// ---------- rooms
mod enterRoom(r: int) {
  room = r
  loadR = 0
  shardOut = false
  for k in 0..4 {
    let e = r * 4 + k
    ek[k] = EK[e]
    ex[k] = ESX[e]
    ey[k] = ESY[e]
    ehp[k] = if EK[e] == 2 then 3 else 1
    ed[k] = Random(0, 3)
    eT[k] = Random(10, 40)
    efl[k] = 0
    pk[k] = -1
  }
  for k in 0..3 { lb[k] = 0 }
  bossT = 0
  let s = if r == 1 || r == 8 then 1 else 0
  if s != song && state == 1 { playSong(s) }
  if state == 1 { say(RNAME[r] .. (if r == 8 then ". Your gut rumbles in the echo." else (if r == 0 then ". Achoo." else "")), 50) }
}
mod spawnPick(k0: int, x: float, y: float) {
  var done: bool = false
  for k in 0..4 {
    if pk[k] < 0 && !done {
      done = true
      pk[k] = k0
      pkx[k] = x
      pky[k] = y
      pkT[k] = if k0 == 3 then 100000 else 240
    }
  }
}
mod hurt(n: int, fromX: float, fromY: float, why: string) {
  if inv == 0 && state == 1 {
    hp -= n
    inv = 40
    sfx(${FX.hurt})
    let d = max(0.1, dist(px, py, fromX, fromY))
    kbx = (px - fromX) / d * 0.8
    kby = (py - fromY) / d * 0.8
    if why != "" { say(why, 50) }
    if hp <= 0 {
      hp = 0
      state = 2
      stT = 0
      if score > hi { hi = score }
      playSong(2)
      say("GAME OVER. Cause: pre-existing condition. SPACE", 100000)
    }
  }
}

// ---------- player
mod useItem() {
  if air < 35.0 && puffs > 0 {
    puffs -= 1
    air = 100.0
    airW = false
    sfx(${FX.puff})
    say("*PSSHHT* You take a puff. Lungs: unlocked.", 40)
  } else if sugar > 75.0 && pens > 0 {
    pens -= 1
    sugar = max(0.0, sugar - 45.0)
    highW = false
    sfx(${FX.inject})
    say("You jab the insulin pen in your thigh. Heroic.", 40)
  } else if sugar < 45.0 && candy > 0 {
    candy -= 1
    sugar = sugar + 30.0
    gut = min(100.0, gut + 15.0)
    lowW = false
    sfx(${FX.pick})
    say("You eat a candy. Sugar up. Gut: concerned.", 40)
  } else if puffs + pens + candy == 0 {
    say("You check your meds pouch. Lint. And a receipt.", 40)
  } else {
    say("You feel... fine? Suspicious. Meds saved for later.", 40)
  }
}
mod swingIt() {
  if !sword {
    say("No sword. You do have a doctor's note.", 40)
  } else if swT == 0 {
    if air < 15.0 {
      sfx(${FX.wheeze})
      say("*wheeze* You can't swing. Breathe. Or puff.", 40)
    } else {
      swT = 8
      air -= 15.0
      sugar -= 1.5
      sfx(${FX.swing})
    }
  }
}
mod playerTick() {
  let mvx: int = kR - kL
  let mvy: int = kD - kU
  walking = mvx != 0 || mvy != 0
  if swT == 0 {
    if mvy < 0 { pf = 0 } else if mvy > 0 { pf = 1 } else if mvx < 0 { pf = 2 } else if mvx > 0 { pf = 3 }
  }
  let slow = sugar < 20.0 || sugar > 85.0 || air < 15.0
  let sp = if slow then 0.25 else 0.45
  if inv > 30 {
    moveBox(px, py, kbx, kby)
  } else if swT > 4 {
    moveBox(px, py, 0.0, 0.0)
  } else {
    moveBox(px, py, mvx * sp, mvy * sp)
  }
  px = hx
  py = hy
  if kS && !pS { swingIt() }
  if kJ && !pJ { useItem() }
  if swT > 0 { swT -= 1 }
  if inv > 0 { inv -= 1 }
  // screens
  if py < 1.0 && NB[room * 4] >= 0 {
    py = 30.5
    enterRoom(NB[room * 4])
  } else if py > 31.5 && NB[room * 4 + 1] >= 0 {
    py = 1.5
    enterRoom(NB[room * 4 + 1])
  } else if px < 0.2 && NB[room * 4 + 2] >= 0 {
    px = 44.6
    enterRoom(NB[room * 4 + 2])
  } else if px > 44.8 && NB[room * 4 + 3] >= 0 {
    px = 0.4
    enterRoom(NB[room * 4 + 3])
  }
  let fx = px + 1.5
  let fy = py + 3.0
  // the gate to the billing office
  if gateCd > 0 { gateCd -= 1 }
  if room == 4 && tri < 3 && py < 2.5 && gateCd == 0 {
    gateCd = 80
    sfx(${FX.denied})
    say("Gate sign: 'BILLING. 3 TRI-PILLS REQUIRED.' You have " .. tri .. ".", 60)
  }
  // outhouses
  if looCd > 0 { looCd -= 1 }
  if tileAt(floor(fx), floor(fy)) == ${T.loo} && looCd == 0 {
    looCd = 60
    if gut >= 25.0 {
      let was = urg > 0
      gut = 0.0
      urg = 0
      sfx(${FX.flush})
      score += if was then 50 else 10
      say(if was then "MADE IT. Sweet relief. Songs will be sung." else "You use the outhouse. Proactive. Wise.", 60)
    } else { say("You don't need to go. You check anyway. Habit.", 40) }
  }
  // the old man
  if talkCd > 0 { talkCd -= 1 }
  if room == 7 && dist(fx, fy, 23.5, 8.0) < 6.0 && talkCd == 0 {
    talkCd = 120
    if !sword {
      sword = true
      puffs += 2
      pens += 1
      candy += 2
      sfx(${FX.secret})
      say("IT'S DANGEROUS TO GO ALONE! TAKE THIS. And your meds.", 90)
    } else {
      say(TIPS[tipI % 4], 80)
      tipI += 1
    }
  }
  // the pharmacy: walk onto an item with enough rupees
  if buyCd > 0 { buyCd -= 1 }
  if room == 6 && buyCd == 0 {
    for i in 0..3 {
      if dist(fx, fy, SHX[i] + 1.5, SHY[i] + 2.0) < 3.0 && buyCd == 0 {
        buyCd = 40
        if cash >= SHP[i] {
          cash -= SHP[i]
          if i == 0 { puffs += 1 } else if i == 1 { pens += 1 } else { candy += 1 }
          sfx(${FX.buy})
          say("You buy " .. SHN[i] .. ". Pharmacist: 'Deductible met.'", 50)
        } else {
          sfx(${FX.denied})
          say(SHN[i] .. ": " .. SHP[i] .. " rupees. Insurance won't cover it.", 50)
        }
      }
    }
  }
  // pickups
  for k in 0..4 {
    if pk[k] >= 0 {
      pkT[k] -= 1
      if pkT[k] <= 0 { pk[k] = -1 }
      else if abs(pkx[k] + 1.0 - fx) < 2.5 && abs(pky[k] + 1.0 - (py + 2.0)) < 3.0 {
        let k0 = pk[k]
        pk[k] = -1
        if k0 == 2 {
          cash += 1
          score += 5
          sfx(${FX.rupee})
        } else if k0 != 3 { sfx(${FX.pick}) }
        if k0 == 0 { hp = min(6, hp + 1) }
        else if k0 == 1 { candy += 1 }
        else if k0 == 3 {
          triGot[SHARD[room]] = 1
          tri += 1
          score += 500
          sfx(${FX.secret})
          say(if tri >= 3 then "3 TRI-PILLS! The billing office gate is open." else ("A TRI-PILL! " .. tri .. " of 3. Take with food."), 80)
        }
        else if k0 == 4 { puffs += 1 }
        else if k0 == 5 { pens += 1 }
      }
    }
  }
}
// ---------- the body
mod bodyTick() {
  let resting = !walking && swT == 0
  sugar -= 0.02
  if room == 0 {
    if walking { air -= 0.12 }
  } else {
    air = min(100.0, air + (if resting then 0.9 else 0.35))
  }
  air = max(0.0, air)
  gut = min(100.0, gut + (if room == 8 then 0.04 else 0.02))
  if sugar < 20.0 && !lowW {
    lowW = true
    say("Low blood sugar. Everything is sparkly. Eat candy.", 60)
  }
  if sugar > 85.0 && !highW {
    highW = true
    say("Blood sugar high. You can taste colours. Insulin!", 60)
  }
  if air < 15.0 && !airW {
    airW = true
    sfx(${FX.wheeze})
    say("*wheeze* Asthma. Stand still or use your inhaler.", 60)
  }
  if air > 40.0 { airW = false }
  if sugar >= 20.0 && sugar <= 85.0 {
    lowW = false
    highW = false
  }
  if sugar <= 0.0 {
    sfx(${FX.faint})
    sugar = 40.0
    cash = floor(cash / 2.0)
    hurt(2, px, py + 1.0, "You fainted. A goblin took half your rupees.")
  } else if sugar >= 100.0 {
    sugar = 75.0
    hurt(1, px, py + 1.0, "Sugar overload. Your toes file a complaint.")
  }
  if gut >= 100.0 && urg == 0 {
    urg = 240
    sfx(${FX.alarm})
    say("CROHN'S FLARE! Reach an outhouse! 12 seconds!", 80)
  }
  if urg > 0 {
    urg -= 1
    if urg == 0 {
      gut = 30.0
      hurt(2, px, py + 1.0, "...The kingdom will never speak of this.")
    }
  }
}
// ---------- monsters
mod overlapZ(x: float, y: float, w: float, h: float) -> bool {
  return x < px + 3.0 && x + w > px && y < py + 4.0 && y + h > py
}
mod swordHits(x: float, y: float, w: float, h: float) -> bool {
  if swT < 2 || swT > 7 { return false }
  var sx: float = px + 1.0
  var sy: float = py - 3.0
  var sw0: float = 1.0
  var sh0: float = 3.0
  if pf == 1 { sy = py + 4.0 }
  if pf == 2 {
    sx = px - 3.0
    sy = py + 1.5
    sw0 = 3.0
    sh0 = 2.0
  }
  if pf == 3 {
    sx = px + 3.0
    sy = py + 1.5
    sw0 = 3.0
    sh0 = 2.0
  }
  return x < sx + sw0 + 0.5 && x + w > sx - 0.5 && y < sy + sh0 + 0.5 && y + h > sy - 0.5
}
mod enemyTick() {
  var alive: int = 0
  for k in 0..4 {
    if ek[k] >= 0 {
      alive += 1
      let kind = ek[k]
      if efl[k] > 0 {
        efl[k] -= 1
        moveBox(ex[k], ey[k], ekx[k], eky[k])
      } else if kind == 1 {
        let d = max(0.1, dist(ex[k], ey[k], px, py))
        moveBox(ex[k], ey[k], (px - ex[k]) / d * 0.1, (py - ey[k]) / d * 0.1)
      } else {
        eT[k] -= 1
        if eT[k] <= 0 {
          eT[k] = Random(15, 45)
          if kind == 2 && Random(0, 2) > 0 {
            ed[k] = if abs(px - ex[k]) > abs(py - ey[k]) then (if px < ex[k] then 2 else 3) else (if py < ey[k] then 0 else 1)
          } else { ed[k] = Random(0, 3) }
        }
        let s = if kind == 2 then 0.17 else 0.13
        let d0 = ed[k]
        let vx = if d0 == 2 then 0.0 - s else (if d0 == 3 then s else 0.0)
        let vy = if d0 == 0 then 0.0 - s else (if d0 == 1 then s else 0.0)
        moveBox(ex[k], ey[k], vx, vy)
        if abs(hx - ex[k]) + abs(hy - ey[k]) < 0.01 { eT[k] = 0 }
      }
      ex[k] = max(1.0, min(44.0, hx))
      ey[k] = max(1.0, min(30.0, hy))
      // sword
      if efl[k] == 0 && swordHits(ex[k], ey[k] + 1.0, 3.0, 3.0) {
        ehp[k] -= 1
        efl[k] = 8
        ekx[k] = if pf == 2 then -0.7 else (if pf == 3 then 0.7 else 0.0)
        eky[k] = if pf == 0 then -0.7 else (if pf == 1 then 0.7 else 0.0)
        sfx(${FX.hit})
        if ehp[k] <= 0 {
          ek[k] = -1
          score += if kind == 2 then 30 else 10
          sfx(${FX.kill})
          let r = Random(0, 9)
          if r < 3 { spawnPick(2, ex[k], ey[k] + 1.0) }
          else if r < 5 { spawnPick(0, ex[k], ey[k] + 1.0) }
          else if r < 7 { spawnPick(1, ex[k], ey[k] + 1.0) }
          else if r == 7 { spawnPick(if Random(0, 1) == 0 then 4 else 5, ex[k], ey[k] + 1.0) }
        }
      } else if efl[k] == 0 && overlapZ(ex[k], ey[k] + 1.0, 3.0, 3.0) && inv == 0 {
        if kind == 1 {
          air = max(0.0, air - 30.0)
          inv = 30
          sfx(${FX.wheeze})
          say("A pollen puff! Right in the lungs. AIR -30", 40)
        } else {
          hurt(1, ex[k], ey[k], if kind == 2 then "The Gluten Moblin hits you. Ow. And also ow." else "")
        }
      }
    }
  }
  if alive == 0 && !shardOut && SHARD[room] >= 0 {
    if triGot[SHARD[room]] == 0 {
      shardOut = true
      spawnPick(3, 22.5, 17.0)
      sfx(${FX.secret})
      say("The room is clear. A Tri-Pill appears!", 60)
    }
  }
}
mod bossTick() {
  bossT += 1
  if bossFl > 0 { bossFl -= 1 }
  bossX = bossX + bossD * (0.15 + (12 - bossHp) * 0.02)
  if bossX < 4.0 { bossD = 1.0 }
  if bossX > 38.0 { bossD = -1.0 }
  if bossT % (if bossHp > 6 then 40 else 25) == 0 {
    for k in 0..3 {
      if lb[k] == 0 && bossT > 0 {
        lb[k] = 1
        lbx[k] = bossX + 2.0
        lby[k] = 12.0
        let d = max(0.1, dist(lbx[k], lby[k], px + 1.0, py + 2.0))
        lbvx[k] = (px + 1.0 - lbx[k]) / d * 0.5
        lbvy[k] = (py + 2.0 - lby[k]) / d * 0.5
        sfx(${FX.denied})
        bossT += 1
      }
    }
  }
  for k in 0..3 {
    if lb[k] > 0 {
      lbx[k] = lbx[k] + lbvx[k]
      lby[k] = lby[k] + lbvy[k]
      if lbx[k] < 0.0 || lbx[k] > 46.0 || lby[k] < 2.0 || lby[k] > 34.0 { lb[k] = 0 }
      else if overlapZ(lbx[k], lby[k], 2.0, 2.0) {
        lb[k] = 0
        hurt(1, lbx[k], lby[k], "A letter: 'CLAIM DENIED.' It's a paper cut. Infected.")
      }
    }
  }
  if bossFl == 0 && swordHits(bossX, 6.0, 6.0, 7.0) {
    bossHp -= 1
    bossFl = 10
    score += 50
    sfx(${FX.hit})
    if bossHp <= 0 {
      score += 2000 + hp * 200
      if score > hi { hi = score }
      state = 3
      stT = 0
      playSong(3)
      say("GANONDOC FALLS. Claim APPROVED (pending review). SPACE", 100000)
    } else if bossHp == 6 { say("Ganondoc: 'Have you tried... being less sick?'", 60) }
  } else if overlapZ(bossX, 6.0, 6.0, 7.0) {
    hurt(1, bossX + 3.0, 9.0, "Ganondoc bills you for that. And for this.")
  }
}

// ---------- game
mod newGame() {
  state = 1
  stT = 0
  hp = 6
  inv = 0
  sword = false
  swT = 0
  sugar = 60.0
  air = 100.0
  gut = 10.0
  urg = 0
  puffs = 0
  pens = 0
  candy = 0
  cash = 0
  tri = 0
  triGot[0] = 0
  triGot[1] = 0
  triGot[2] = 0
  score = 0
  bossHp = 12
  bossX = 21.0
  px = 22.0
  py = 22.0
  pf = 0
  playSong(0)
  enterRoom(7)
  say("Zeldoy wakes on the hospital lawn. Talk to the old man.", 80)
}

// ---------- power: the screen runs only while someone sits
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  px = 22.0
  py = 22.0
  pf = 1
  hp = 6
  sugar = 60.0
  air = 100.0
  gut = 10.0
  urg = 0
  inv = 0
  swT = 0
  for i in 0..W * H {
    fb[i] = 0
    bg[i] = 0
  }
  for i in 0..H { dirty[i] = 1 }
  enterRoom(7)
  for k in 0..4 { ek[k] = -1 }
  playSong(0)
  say("SPACE start. WASD walk, LMB/E sword, SPACE meds", 100000)
}
mod powerOff() {
  booted = false
  state = -1
  song = -1
  fxId = -1
  aV0 = 0.0
  aV1 = 0.0
  aV2 = 0.0
  msg = ""
  hud = ""
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
${strips.map(k => `  st${k} = ""`).join('\n')}
}

${debug ? `var dbk: string = ""
var dumpReq: bool = false
on ChatCommand("zd", "ZELDOY debug: /zd <keys o(sit) l r u d j s> | /zd dump | /zd room N | /zd tri | /zd gut | /zd low | /zd kill | /zd boss") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "tri" {
    tri = 3
    sword = true
    triGot[0] = 1
    triGot[1] = 1
    triGot[2] = 1
  }
  else if args == "gut" { gut = 99.0 }
  else if args == "kill" {
    for k in 0..4 { ek[k] = -1 }
  }
  else if args == "boss" {
    bossHp = 1
    air = 100.0
  }
  else if args == "low" { sugar = 18.0 }
  else if args.Contains("room ") {
    px = 22.0
    py = 20.0
    enterRoom(args.Split(" ").Right.ParseInt())
  }
  else { dbk = args }
}
` : ''}on tick {
${debug ? `  let pwr = seated || dbk.Contains("o")` : `  let pwr = seated`}
  if !pwr {
    if booted { powerOff() }
  } else {
    if !booted { powerOn() }
${debug ? `    kL = left || dbk.Contains("l")
    kR = right || dbk.Contains("r")
    kU = up || dbk.Contains("u")
    kD = down || dbk.Contains("d")
    kJ = item || dbk.Contains("j")
    kS = swing || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("zddbg|" .. t .. "|" .. state .. "|room " .. room .. " load " .. loadR .. "|z " .. px .. "," .. py .. " f" .. pf .. "|hp " .. hp .. "|sug " .. sugar .. " air " .. air .. " gut " .. gut .. " urg " .. urg .. "|meds " .. puffs .. "/" .. pens .. "/" .. candy .. " $" .. cash .. " tri " .. tri .. "|ek " .. ek.join(",") .. "|boss " .. bossHp .. "|" .. msg) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("zdrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = item
    kS = swing`}
    t += 1
    stT += 1
    if loadR < 9 {
      loadStep()
    } else if state == 0 {
      if (kJ && !pJ) || (kS && !pS) {
        newGame()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      playerTick()
      if state == 1 && loadR >= 9 {
        bodyTick()
        enemyTick()
        if room == 1 && bossHp > 0 { bossTick() }
      }
    } else if state >= 2 {
      if stT > 40 && kJ && !pJ {
        newGame()
        pJ = true
      }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then ("a tale of courage and copays. HI " .. hi) else ("HP " .. hp .. " SUG " .. floor(sugar) .. " AIR " .. floor(air) .. " GUT " .. floor(gut) .. (if urg > 0 then (" GO! " .. (urg / 20)) else "") .. "  $" .. cash .. " TRI " .. tri .. "/3  MEDS " .. puffs .. "i " .. pens .. "p " .. candy .. "c")
    audio()
    render()
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./zeldoy.gen.ws', import.meta.url), generate().src);
  console.log('wrote zeldoy.gen.ws');
}
