// mildorsplume/gen.mjs: MILDORS PLUME (owner's name for it). An original Cave-Story-style platformer (own maps, sprites,
// music and writing) that runs entirely inside one microchip:
//   inputs  (@left pins): tick (exec: one game frame per pulse, made for 20 Hz), left right up down jump shoot (bool)
//   outputs (@right pins): pixels (*int[] W x H palette indices, row-major), rows (*string[] H O-grid rows),
//           frame (string, all rows), strip0..strip5 (6 rows each, for stacked TextDisplays), msg, hud,
//           P0/V0 lead, P1/V1 bass, P2/V2 sfx (synth speaker pitch / volume), room, state
// The cabinet (build.mjs) adds the synth speakers on the chip's own plane, so the sound comes out of the chip.
// Palette: PAL (index 0 = the screen's base colour, drawn untagged). Screen = W x H cells, tiles are 2 x 2 cells.
//   node mildorsplume/gen.mjs         -> mildorsplume/mildorsplume.gen.ws (also run by build.mjs)

export const W = 64, H = 36, TW = 32, TH = 18, STRIP = 6;
export const PAL = ['140f1e', '2a2238', '3c3450', '5c4030', '8c6844', '48a040', 'a0a0b0', 'f4f4f4',
  'e03838', 'f8d040', '3868d8', '78c8f8', 'f89038', 'a048c8', 'f8c0a0', '601818'];

// ---- tiles: [tl, tr, bl, br] palette, solid (1) / hazard-solid (2)
export const TILES = {
  air: [[0, 0, 0, 0], 0], rock: [[3, 3, 3, 3], 1], rockTop: [[4, 4, 3, 3], 1], grass: [[5, 5, 3, 3], 1], speck: [[3, 3, 3, 4], 1],
  spike: [[6, 0, 6, 6], 2], save: [[13, 13, 13, 11], 0], star: [[9, 12, 12, 9], 1], gate: [[6, 1, 6, 1], 1], crystal: [[11, 0, 13, 0], 0],
  sky: [[11, 11, 11, 11], 0], cloud: [[7, 7, 7, 7], 0], sun: [[9, 9, 9, 9], 0], letter: [[9, 12, 12, 12], 0], platform: [[5, 5, 4, 4], 1],
};
const TN = Object.keys(TILES), T = Object.fromEntries(TN.map((k, i) => [k, i]));

// ---- rooms (32 x 18 tiles). Legend: # rock (top edge / specks chosen automatically), " grass, = floating platform,
// ^ spikes, S save point, * star block (shoot it), | boss gate, x crystal, ~ sky, c cloud, o sun, . air
// entities: P start, h hopper, b bat, M boss, L life capsule
export const ROOMS = [
  { name: 'First Cave', song: 0, exits: { R: 1 }, msg: 'You wake up in a cave. Classic.', map: [
    '################################',
    '################################',
    '######......#########....#######',
    '####..........#####........#####',
    '###.....x..................x####',
    '##............................##',
    '##.............................#',
    '#..............................#',
    '#...........................####',
    '#.......................########',
    '#.......................########',
    '#..........######.......########',
    '#..........######...............',
    '#...............................',
    '#...............................',
    '#..P...S........................',
    '""""""""""""""""""""""""""""""""',
    '################################'] },
  { name: 'Hopper Hollow', song: 0, exits: { L: 0, R: 2 }, msg: 'Something hops here. It has no business hopping.', map: [
    '################################',
    '################################',
    '#########.......######.....#####',
    '#######...........##.........###',
    '######....x....................#',
    '####...........................#',
    '###............................#',
    '##.............................#',
    '##...........""""".........#####',
    '##...........#####.........#####',
    '##...........#####.........#####',
    '##...........#####........*#####',
    '...........................*....',
    '...........................*....',
    '...............h...........*....',
    '.........h.................*....',
    '"""""""""""""""""""""""""""""""""'.slice(0, 32),
    '################################'] },
  { name: 'Bat Chimney', song: 0, exits: { L: 1, U: 3 }, msg: "Bats. The cave's way of saying no.", map: [
    '###############..###############',
    '###############..###############',
    '#########..............#########',
    '#########..............#########',
    '#########===..======..===#######',
    '########...............b.#######',
    '#######...................######',
    '######..=====......=====...#####',
    '######..................b....###',
    '#####.........................##',
    '#####......=====...=====......##',
    '##############.................#',
    '...............................#',
    '.....=====..............=====..#',
    '..........b....................#',
    '..S............................#',
    '""""""""""""""""""""""""""""""""',
    '################################'] },
  { name: 'Spike Gallery', song: 0, exits: { D: 2, R: 4 }, msg: 'Admission is one (1) health.', map: [
    '################################',
    '################################',
    '######..L.....##################',
    '######""""""....################',
    '#####...........################',
    '####..............##############',
    '###...........b.....############',
    '##........====..............####',
    '##............................##',
    '##........====..........b.....##',
    '##..................====......##',
    '##.............................#',
    '##..............................',
    '##..........===.................',
    '##........................====..',
    '##..................===.........',
    '##..S...........................',
    '"""""""""""""""..^^^^^^^^^^"""""'] },
  { name: "Mole King's Den", song: 1, exits: { L: 3, R: 5 }, msg: "THE MOLE KING: 'Who dares tunnel in MY tunnel?'", map: [
    '################################',
    '################################',
    '####.........########......#####',
    '###...........######.........###',
    '##.............####...........##',
    '##.............................#',
    '##..x.......................x..#',
    '##.............................#',
    '##.....====..........====......#',
    '##.............................#',
    '##.............................#',
    '##.............................#',
    '..............................|.',
    '..............................|.',
    '..............................|.',
    '...................M..........|.',
    '..S...........................|.',
    '""""""""""""""""""""""""""""""""'] },
  { name: 'The Surface', song: 2, exits: { L: 4 }, msg: 'Sunlight! It burns slightly less than expected.', map: [
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~oo~~~~~',
    '~~~~~cccc~~~~~~~~~~~~~~~~oo~~~~~',
    '~~~~cccccc~~~~~~~~~ccc~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~ccccc~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"""',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~""""##',
    '~~~~~~~~~~~~~~~~~~~~~~~""""#####',
    '~~~~~~~~~~~~~~~~~~~~~""#########',
    '~~~~~~~~~~~~~~~~~~""############',
    '~~~~~~~~~~~~~~~~~~##############',
    '~~~~~~~~~~~~~~~~~~##############',
    '""""""""""""""""""""############'] },
];
ROOMS[5].map = ROOMS[5].map.map((r, y) => y < 12 ? '#' + r.slice(1) : r); // cave mouth: rock on the left above the exit
const TITLE_ROOM = ROOMS.length; // the title screen is one more room
function titleMap() { // a quiet cave; the name itself is a TextDisplay over the screen (out title_)
  const g = Array.from({ length: TH }, (_, y) => [...(y < 1 || y > 16 ? '#'.repeat(TW) : '#' + '.'.repeat(TW - 2) + '#')]);
  for (let x = 1; x < TW - 1; x++) g[15][x] = '"';
  for (const [x, y] of [[4, 3], [27, 4], [9, 12], [22, 11], [15, 2]]) g[y][x] = 'x';
  return g.map(r => r.join(''));
}
ROOMS.push({ name: "MILDOR'S PLUME", song: 0, exits: {}, msg: 'a cave tale made of wires - press JUMP', map: titleMap() });

// ---- sprites: rows of palette hex digits, '.' = transparent. Drawn facing right, mirrored for left.
const SPRITES = {
  p0: ['55.', 'e16', 'aa.'], p1: ['55.', 'e16', '1a.'], p2: ['55.', 'e16', 'a.a'],
  hop0: ['a7', 'aa'], hop1: ['a7', '.a'],
  bat0: ['d.d', 'd9d'], bat1: ['ddd', '.9.'],
  boss0: ['.3333.', '374473', '34ee43', '344443', '6....6'], boss1: ['.3333.', '374473', '34ee43', '344443', '.6..6.'],
  shard0: ['9'], shard1: ['c'], heart: ['8.8', '888', '.8.'], capsule: ['87', '88'], rock: ['43', '33'],
  puff0: ['7.', '.7'], puff1: ['.7', '7.'], b1: ['7'], b2: ['b'], b3: ['9'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));

// ---- entity kinds: size, hp, contact damage, shards dropped
const KIND = { // index = kt value
  1: { name: 'hopper', w: 2, h: 2, hp: 2, dmg: 1, drop: 3 }, 2: { name: 'bat', w: 3, h: 2, hp: 2, dmg: 1, drop: 1 },
  3: { name: 'boss', w: 6, h: 5, hp: 24, dmg: 1, drop: 12 }, 4: { name: 'shard', w: 1, h: 1 }, 5: { name: 'heart', w: 3, h: 3 },
  6: { name: 'capsule', w: 2, h: 2 }, 7: { name: 'rock', w: 2, h: 2, dmg: 1 }, 8: { name: 'puff', w: 2, h: 2 },
};
const MARK = { h: 1, b: 2, M: 3, L: 6 };

// ---- music (original). Notes "E5:2" = E5 for 2 eighths, R = rest. eighth = ticks per eighth at 20 Hz
const SONGS = [
  { name: 'cave', eighth: 4, loop: 1,
    lead: 'E5:2 A5:2 G5:1 E5:1 D5:2 | C5:3 D5:1 E5:2 C5:2 | D5:2 G5:2 F5:1 D5:1 B4:2 | E5:4 R:2 B4:2 | A4:1 C5:1 E5:1 A5:1 G5:2 E5:2 | F5:2 E5:1 D5:1 C5:2 A4:2 | B4:2 D5:2 G5:2 F5:1 D5:1 | E5:3 D#5:1 E5:2 G#4:2',
    bass: 'A2 A3 A2 A3 A2 A3 A2 A3 | F2 F3 F2 F3 F2 F3 F2 F3 | G2 G3 G2 G3 G2 G3 G2 G3 | E2 E3 E2 E3 E2 E3 E2 E3 | A2 A3 A2 A3 A2 A3 A2 A3 | F2 F3 F2 F3 F2 F3 F2 F3 | G2 G3 G2 G3 G2 G3 G2 G3 | E2 E3 E2 E3 E2 E3 G#2 B2' },
  { name: 'boss', eighth: 3, loop: 1,
    lead: 'D5:1 D5:1 F5:1 D5:1 A5:2 G5:1 F5:1 | E5:1 E5:1 G5:1 E5:1 C6:2 A#5:1 A5:1 | D5:1 F5:1 A5:1 D6:1 C6:1 A5:1 F5:1 A5:1 | G5:2 F5:1 E5:1 C#5:2 A4:2 | D5:1 D5:1 F5:1 D5:1 A5:2 G5:1 F5:1 | E5:1 E5:1 G5:1 E5:1 C6:2 A#5:1 A5:1 | A#5:2 A5:1 G5:1 F5:2 E5:2 | D5:4 R:2 A4:2',
    bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 D2 D3 | A1 A2 A1 A2 A1 A2 C#2 E2 | D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | A1 A2 A1 A2 A1 A2 A1 A2' },
  { name: 'fanfare', eighth: 4, loop: 0,
    lead: 'C5:1 E5:1 G5:1 C6:3 A#5:1 C6:4 R:4 G5:1 A5:1 B5:1 C6:6',
    bass: 'C3:2 E3:2 G3:2 C3:6 G2:4 C3:6' },
];
const SFX = { // per-tick pitch multipliers on the sfx voice
  shoot: [2.0, 1.6, 1.2], jump: [0.8, 1.0, 1.2, 1.4], hurt: [0.7, 0.55, 0.45, 0.35, 0.3, 0.25], shard: [2.0, 2.5, 3.0],
  levelup: [1.0, 1.26, 1.5, 2.0, 2.0, 2.0], leveldown: [1.0, 0.84, 0.7, 0.5, 0.5], kill: [0.5, 0.7, 0.4, 0.3, 0.25, 0.2],
  crack: [0.35, 0.3, 0.25, 0.2], save: [1.0, 1.5, 2.0, 1.5, 2.0, 2.5, 3.0], roar: [0.2, 0.22, 0.2, 0.18, 0.2, 0.22, 0.2, 0.18, 0.16, 0.14],
  heal: [1.5, 2.0, 2.5], bump: [0.3, 0.25], thud: [0.15, 0.12, 0.1, 0.1],
};
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NAMES.indexOf(m[1]) + 12 * (+m[2] + 1); };
function parseVoice(s, eighth) {
  const out = [];
  for (const tok of s.split(/\s+/).filter(t => t && t !== '|')) {
    const [n, d = '1'] = tok.split(':');
    out.push([n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * eighth)]);
  }
  return out;
}

// ---- build
export function build() {
  const fail = m => { throw new Error(m); };
  // tile map per room with auto top edges / specks
  let start = null;
  const spawns = []; // [room, kind, x cells, y cells]
  const tiles = ROOMS.map((R, r) => {
    if (R.map.length !== TH) fail(`room ${r}: ${R.map.length} rows`);
    R.map.forEach((row, y) => { if (row.length !== TW) fail(`room ${r} row ${y}: ${row.length} cols`); });
    const at = (x, y) => R.map[y]?.[x] ?? '#';
    const out = [];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const c = at(x, y);
      let t = T.air;
      if (c === '#') t = /[.~cohbMLPSx*|=^@"]/.test(at(x, y - 1)) && y > 0 && at(x, y - 1) !== '"' ? T.rockTop : ((x * 7 + y * 13 + r * 5) % 11 === 0 ? T.speck : T.rock);
      else if (c === '"') t = T.grass; else if (c === '=') t = T.platform; else if (c === '^') t = T.spike; else if (c === 'S') t = T.save;
      else if (c === '*') t = T.star; else if (c === '|') t = T.gate; else if (c === 'x') t = T.crystal; else if (c === '~') t = T.sky;
      else if (c === 'c') t = T.cloud; else if (c === 'o') t = T.sun; else if (c === '@') t = T.letter;
      else if (c === 'P') { if (start) fail('two starts'); start = { r, x: x * 2, y: y * 2 + 2 - 3 }; }
      else if (MARK[c]) { const k = KIND[MARK[c]]; spawns.push([r, MARK[c], x * 2, y * 2 + 2 - k.h]); }
      else if (c !== '.') fail(`room ${r}: unknown '${c}'`);
      if (r === 5 && t === T.air) t = T.sky; // the surface: marker cells are sky
      out.push(t);
    }
    return out;
  });
  if (!start) fail('no start');
  // exits must line up: an open edge cell needs an open cell across the boundary
  const open = (r, x, y) => !TILES[TN[tiles[r][y * TW + x]]][1];
  ROOMS.forEach((R, r) => {
    for (const [side, to] of Object.entries(R.exits)) {
      const back = { L: 'R', R: 'L', U: 'D', D: 'U' }[side];
      if (ROOMS[to].exits[back] !== r) fail(`room ${r} ${side} -> ${to}: no way back`);
      for (let i = 0; i < (side === 'L' || side === 'R' ? TH : TW); i++) {
        const [a, b] = side === 'L' ? [[0, i], [TW - 1, i]] : side === 'R' ? [[TW - 1, i], [0, i]] : side === 'U' ? [[i, 0], [i, TH - 1]] : [[i, TH - 1], [i, 0]];
        if (open(r, ...a) && !open(to, ...b)) fail(`room ${r} ${side} edge ${i} open but room ${to} is solid there`);
      }
    }
  });
  spawns.sort((a, b) => a[0] - b[0]);
  const SO = ROOMS.map((_, r) => spawns.findIndex(s => s[0] >= r)).map((v, r, a) => v < 0 ? spawns.length : v);
  SO.push(spawns.length);
  for (let r = ROOMS.length - 1; r >= 0; r--) if (SO[r] > SO[r + 1]) SO[r] = SO[r + 1];

  // sprites
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) fail(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  // music
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }

  // string tables for row encoding: OPEN[c] .. BLK[n] .. CLOSE[c]
  const BLKCH = '█';
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => BLKCH.repeat(n));

  const tilePix = TN.flatMap(k => TILES[k][0]), solid = TN.map(k => TILES[k][1]);
  return { tiles, start, spawns, SO, spr, soff, sw, sh, voices, vo, vl, fxp, fxo, fxl, OPEN, CLOSE, BLK, tilePix, solid };
}

const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false, bricks = false, paintRows = 12 } = {}) {
  // bricks = the screen is W x H real bricks: the chip recolours them itself through a brick[] of refs (scr, filled in by
  // build.mjs after compiling), at most paintRows dirty rows a tick; no O-grid text is encoded then.
  const d = build();
  const NK = 12, NB = 3, NR = ROOMS.length;
  const ex = s => ROOMS.map(R => R.exits[s] ?? -1);
  const K = k => Array.from({ length: 9 }, (_, i) => KIND[i]?.[k] ?? 0);
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: H / STRIP }, (_, k) => k);
  const textTail = `  var any: bool = false
  for r in 0..H {
    if dirty[r] > 0 {
      encRow(r)
      dirty[r] = 0
      sdirty[r / ${STRIP}] = 1
      any = true
    }
  }
${strips.map(k => `  if sdirty[${k}] > 0 {
    st${k} = ${Array.from({ length: STRIP }, (_, j) => `rows[${k * STRIP + j}]`).join(' .. "\\n" .. ')}
    sdirty[${k}] = 0
  }`).join('\n')}
  if any { frame = rows.join("\\n") }
`;
  const paintTail = `  var painted: int = 0
  for r in 0..H {
    if dirty[r] > 0 && painted < ${paintRows} {
      paintRow(r)
      dirty[r] = 0
      painted += 1
    }
  }
`;
  const src = `// GENERATED by mildorsplume/gen.mjs: edit that, not this file.
// MILDORS PLUME: one game frame per 'tick' pulse (20 Hz). Inputs are plain bools so anything can drive
// them (a seat's input splitter, buttons, another chip). Everything the player sees and hears comes out of the pins.

@left in tick: exec
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in jump: bool
@left in shoot: bool

const W = ${W}
const H = ${H}
const NK = ${NK}
const NB = ${NB}
const TITLE = ${TITLE_ROOM}
const TILEPIX = ${A(d.tilePix)}
const SOLID = ${A(d.solid)}
const ROOMT = ${A(d.tiles.flat())}
const EXL = ${A(ex('L'))}
const EXR = ${A(ex('R'))}
const EXU = ${A(ex('U'))}
const EXD = ${A(ex('D'))}
const RNAME = ${AS(ROOMS.map(R => R.name))}
const RMSG = ${AS(ROOMS.map(R => R.msg))}
const RSONG = ${A(ROOMS.map(R => R.song))}
const SPK = ${A(d.spawns.map(s => s[1]))}
const SPX = ${A(d.spawns.map(s => s[2]))}
const SPY = ${A(d.spawns.map(s => s[3]))}
const SPO = ${A(d.SO)}
const SPR = ${A(d.spr)}
const SOFF = ${A(d.soff)}
const SW = ${A(d.sw)}
const SH = ${A(d.sh)}
const KW = ${A(K('w'))}
const KH = ${A(K('h'))}
const KHP = ${A(K('hp'))}
const KDMG = ${A(K('dmg'))}
const KDROP = ${A(K('drop'))}
const OPEN = ${AS(d.OPEN)}
const CLOSE = ${AS(d.CLOSE)}
const BLK = ${AS(d.BLK)}
const NP0 = ${AF(d.voices[0].map(n => n[0]))}
const ND0 = ${A(d.voices[0].map(n => n[1]))}
const VO0 = ${A(d.vo[0])}
const VL0 = ${A(d.vl[0])}
const NP1 = ${AF(d.voices[1].map(n => n[0]))}
const ND1 = ${A(d.voices[1].map(n => n[1]))}
const VO1 = ${A(d.vo[1])}
const VL1 = ${A(d.vl[1])}
const SLOOP = ${A(SONGS.map(s => s.loop))}
const FXP = ${AF(d.fxp)}
const FXO = ${A(d.fxo)}
const FXL = ${A(d.fxl)}
const SINT = ${AF(Array.from({ length: 32 }, (_, i) => Math.sin(i / 32 * Math.PI * 2)))}

var fb: int[] = ${zeros(W * H)}
${bricks ? `const PR = ${A(PAL.map(h => parseInt(h.slice(0, 2), 16)))}
const PG = ${A(PAL.map(h => parseInt(h.slice(2, 4), 16)))}
const PB = ${A(PAL.map(h => parseInt(h.slice(4, 6), 16)))}
const HEXD = ${AS([...'0123456789abcdef'])}
var scr: brick[] = []
var shown: int[] = ${zeros(W * H)}
` : ''}var bg: int[] = ${zeros(W * H)}
var cur: int[] = ${zeros(TW * TH)}
var dirty: int[] = ${zeros(H)}
var sdirty: int[] = ${zeros(H / STRIP)}
var rows: string[] = ${zeros(H, '""')}
${strips.map(k => `var st${k}: string = ""`).join('\n')}
var frame: string = ""
var msg: string = ""
var msgT: int = 0
var hud: string = ""
var booted: bool = false
var pend: int = -1

var state: int = 0          // 0 title, 1 playing, 2 dead, 3 the end
var stT: int = 0
var room: int = 0
var t: int = 0
var px: float = 0.0
var py: float = 0.0
var vx: float = 0.0
var vy: float = 0.0
var face: int = 1
var ground: bool = false
var hp: int = 6
var maxhp: int = 6
var xp: int = 0
var inv: int = 0
var onSave: bool = false
var saveRoom: int = 0
var saveX: float = 0.0
var saveY: float = 0.0
var capTaken: bool = false
var bossDead: bool = false
var endT: int = 0
var kL: bool = false
var kR: bool = false
var kU: bool = false
var kD: bool = false
var kJ: bool = false
var kS: bool = false
var pJ: bool = false
var pS: bool = false

var kt: int[] = ${zeros(NK)}
var kx: float[] = ${zeros(NK, '0.0')}
var ky: float[] = ${zeros(NK, '0.0')}
var kvx: float[] = ${zeros(NK, '0.0')}
var kvy: float[] = ${zeros(NK, '0.0')}
var khp: int[] = ${zeros(NK)}
var ktm: int[] = ${zeros(NK)}
var kfl: int[] = ${zeros(NK)}
var kgr: int[] = ${zeros(NK)}
var bt: int[] = ${zeros(NB)}
var bx: float[] = ${zeros(NB, '0.0')}
var by: float[] = ${zeros(NB, '0.0')}
var bvx: float[] = ${zeros(NB, '0.0')}
var bvy: float[] = ${zeros(NB, '0.0')}
var bl: int[] = ${zeros(NB)}
var rx: int[] = []
var ry: int[] = []
var rw: int[] = []
var rh: int[] = []
var mx: float = 0.0
var my: float = 0.0
var mhx: bool = false
var mhy: bool = false

var song: int = -1
var mi0: int = 0
var md0: int = 0
var mt0: int = 0
var mp0: float = 0.0
var mi1: int = 0
var md1: int = 0
var mt1: int = 0
var mp1: float = 0.0
var fxId: int = -1
var fxI: int = 0
var aP0: float = 1.0
var aV0: float = 0.0
var aP1: float = 1.0
var aV1: float = 0.0
var aP2: float = 1.0
var aV2: float = 0.0

@right out pixels: *int[] = &fb
@right out rows_: *string[] = &rows
@right out frame_: string = frame
${strips.map(k => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = msg
@right out hud_: string = hud
@right out P0: float = aP0
@right out V0: float = aV0
@right out P1: float = aP1
@right out V1: float = aV1
@right out P2: float = aP2
@right out V2: float = aV2
@right out room_: int = room
@right out title_: string = if state == 0 then "MILDOR'S PLUME" else ""
@right out state_: int = state

// ---------- world
mod solid(cx: int, cy: int) -> int {
  if cx < 0 { return EXL[room] < 0 }
  if cx >= W { return EXR[room] < 0 }
  if cy < 0 { return EXU[room] < 0 }
  if cy >= H { return EXD[room] < 0 }
  return SOLID[cur[floor(cy / 2.0) * 32 + floor(cx / 2.0)]]
}
mod tileAt(cx: int, cy: int) -> int {
  if cx < 0 || cx >= W || cy < 0 || cy >= H { return 0 }
  return cur[floor(cy / 2.0) * 32 + floor(cx / 2.0)]
}
// move a w x h box by (dx, dy) against solid tiles: result in mx, my; mhx / mhy = blocked
mod moveBox(x: float, y: float, dx: float, dy: float, w: int, h: int) {
  var nx: float = x + dx
  mhx = false
  if dx > 0.0 {
    let e: int = floor(nx + w - 0.01)
    if solid(e, floor(y)) + solid(e, floor(y + h * 0.5)) + solid(e, floor(y + h - 0.01)) > 0 {
      nx = e - w
      mhx = true
    }
  } else if dx < 0.0 {
    let e: int = floor(nx)
    if solid(e, floor(y)) + solid(e, floor(y + h * 0.5)) + solid(e, floor(y + h - 0.01)) > 0 {
      nx = e + 1
      mhx = true
    }
  }
  var ny: float = y + dy
  mhy = false
  if dy > 0.0 {
    let e: int = floor(ny + h - 0.01)
    if solid(floor(nx), e) + solid(floor(nx + w * 0.5), e) + solid(floor(nx + w - 0.01), e) > 0 {
      ny = e - h
      mhy = true
    }
  } else if dy < 0.0 {
    let e: int = floor(ny)
    if solid(floor(nx), e) + solid(floor(nx + w * 0.5), e) + solid(floor(nx + w - 0.01), e) > 0 {
      ny = e + 1
      mhy = true
    }
  }
  mx = nx
  my = ny
}
mod tileCells(ti: int) {
  let tx = ti % 32
  let ty = floor(ti / 32.0)
  for j in 0..4 {
    let cx = tx * 2 + j % 2
    let cy = ty * 2 + j / 2
    let i = cy * W + cx
    let c = TILEPIX[cur[ti] * 4 + j]
    bg[i] = c
    if fb[i] != c {
      fb[i] = c
      dirty[cy] = 1
    }
  }
}
mod spawn(ty: int, x: float, y: float, svx: float, svy: float) {
  let k = kt.find(0)
  if k >= 0 {
    kt[k] = ty
    kx[k] = x
    ky[k] = y
    kvx[k] = svx
    kvy[k] = svy
    khp[k] = KHP[ty]
    ktm[k] = 0
    kfl[k] = 0
    kgr[k] = 0
    if ty == 2 { kvy[k] = y }
  }
}
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
mod loadRoom(r: int) {
  room = r
  cur.slice(ROOMT, r * 576, 576)
  if bossDead {
    for i in 0..576 {
      if cur[i] == ${T.gate} { cur[i] = 0 }
    }
  }
  for i in 0..${W * H} {
    let cx = i % W
    let cy = i / W
    bg[i] = TILEPIX[cur[floor(cy / 2.0) * 32 + floor(cx / 2.0)] * 4 + (cy % 2) * 2 + cx % 2]
  }
  fb.copyFrom(bg)
  for i in 0..H { dirty[i] = 1 }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  for k in 0..NK { kt[k] = 0 }
  for i in 0..NB { bt[i] = 0 }
  for i in SPO[r]..SPO[r + 1] {
    let ty = SPK[i]
    if !(ty == 6 && capTaken) && !(ty == 3 && bossDead) {
      spawn(ty, SPX[i], SPY[i], 0.0, 0.0)
    }
  }
  say(RNAME[r] .. ": " .. RMSG[r], if r == TITLE then 100000 else 80)
  var s: int = RSONG[r]
  if r == 4 && bossDead { s = 0 }
  if s != song { playSong(s) }
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
        mt1 = 0
        mi1 += 1
      } else {
        mp1 = 0.0
        md1 = 100000
      }
    }
    mt0 += 1
    mt1 += 1
  }
  if mp0 > 0.0 {
    aP0 = mp0
    aV0 = if md0 <= 1 then 0.0 else 0.35 * max(0.45, 1.0 - mt0 * 0.05)
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

// ---------- player
mod level() -> int {
  return 1 + (xp >= 10) + (xp >= 20)
}
mod gainXp(n: int) {
  let before = level()
  xp = min(xp + n, 30)
  if level() > before {
    sfx(${FX.levelup})
    say("Weapon level up! Lv " .. level(), 40)
  } else { sfx(${FX.shard}) }
}
mod hurt(d: int, dir: float) {
  if inv == 0 && state == 1 {
    hp -= d
    inv = 60
    vy = -0.6
    vx = dir * 0.45
    let before = level()
    xp = max(xp - d, 0)
    if level() < before { say("Weapon level down. The gun is disappointed in you.", 50) }
    sfx(${FX.hurt})
    if hp <= 0 {
      hp = 0
      state = 2
      stT = 0
      spawn(8, px, py + 1.0, 0.0, 0.0)
      say("You have died. The cave seems smug about it.", 100000)
      playSong(-1)
    }
  }
}
mod fire() {
  let i = bt.find(0)
  if i >= 0 {
    let lv = level()
    bt[i] = 6 + lv * 4
    bl[i] = lv
    if kU {
      bx[i] = px + 0.5
      by[i] = py - 1.0
      bvx[i] = 0.0
      bvy[i] = -1.5
    } else if kD && !ground {
      bx[i] = px + 0.5
      by[i] = py + 3.0
      bvx[i] = 0.0
      bvy[i] = 1.5
    } else {
      bx[i] = if face > 0 then px + 2.5 else px - 1.5
      by[i] = py + 1.0
      bvx[i] = face * 1.5
      bvy[i] = 0.0
    }
    sfx(${FX.shoot})
  }
}
mod respawn() {
  hp = maxhp
  inv = 0
  vx = 0.0
  vy = 0.0
  face = 1
  state = 1
  playSong(-2)
  pend = saveRoom
  px = saveX
  py = saveY
}
mod newGame() {
  hp = 6
  maxhp = 6
  xp = 0
  inv = 0
  capTaken = false
  bossDead = false
  saveRoom = ${d.start.r}
  saveX = ${fl(d.start.x)}
  saveY = ${fl(d.start.y)}
  respawn()
}
mod playerTick() {
  let want: int = kR - kL
  if want != 0 {
    face = want
    vx = clamp(vx + want * 0.12, -0.5, 0.5)
  } else {
    vx = vx * (if ground then 0.5 else 0.85)
  }
  if kJ && !pJ && ground {
    vy = -1.15
    sfx(${FX.jump})
  }
  vy = min(vy + (if kJ && vy < 0.0 then 0.06 else 0.12), 1.0)
  moveBox(px, py, vx, vy, 2, 3)
  px = mx
  if mhx { vx = 0.0 }
  ground = mhy && vy > 0.0
  if mhy {
    if vy < -0.2 { sfx(${FX.bump}) }
    vy = 0.0
  }
  py = my
  if kS && !pS { fire() }
  if inv > 0 { inv -= 1 }
  // spikes (standing on or touching), save points
  let fy: int = floor(py + 3.05)
  let cx0: int = floor(px)
  let cx1: int = floor(px + 1.99)
  if tileAt(cx0, fy) == ${T.spike} || tileAt(cx1, fy) == ${T.spike} || tileAt(cx0 - 1, floor(py + 2.0)) == ${T.spike} || tileAt(cx1 + 1, floor(py + 2.0)) == ${T.spike} {
    hurt(1, -face)
    vy = -0.9
  }
  let mid: int = floor(py + 1.5)
  let sv = tileAt(cx0, mid) == ${T.save} || tileAt(cx1, mid) == ${T.save} || tileAt(cx0, floor(py + 2.5)) == ${T.save} || tileAt(cx1, floor(py + 2.5)) == ${T.save}
  if sv && !onSave {
    saveRoom = room
    saveX = px
    saveY = py
    hp = maxhp
    sfx(${FX.save})
    say("Game saved. Health restored. Dignity pending.", 60)
  }
  onSave = sv
  // room exits (positions carry across the edge)
  if px < -1.0 && EXL[room] >= 0 {
    pend = EXL[room]
    px = px + W
  } else if px > W - 1.0 && EXR[room] >= 0 {
    pend = EXR[room]
    px = px - W
  } else if py < -1.5 && EXU[room] >= 0 {
    pend = EXU[room]
    py = py + H
  } else if py > H - 1.5 {
    if EXD[room] >= 0 {
      pend = EXD[room]
      py = py - H
    } else { hurt(100, 0.0) }
  }
  if room == 5 && state == 1 {
    endT += 1
    if endT == 160 { say("You escaped the cave. Somewhere, a mole king weeps into his tiny crown.", 140) }
    if endT == 320 {
      state = 3
      stT = 0
      say("THE END. Thanks for playing! Press JUMP.", 100000)
    }
  }
}

// ---------- bullets and entities
mod overlap(ax: float, ay: float, aw: float, ah: float, bx0: float, by0: float, bw: float, bh: float) -> bool {
  return ax < bx0 + bw && bx0 < ax + aw && ay < by0 + bh && by0 < ay + ah
}
mod kill(k: int) {
  let ty = kt[k]
  let cxk = kx[k] + KW[ty] * 0.5
  let cyk = ky[k] + KH[ty] * 0.5
  kt[k] = 8
  ktm[k] = 0
  kx[k] = cxk - 1.0
  ky[k] = cyk - 1.0
  sfx(${FX.kill})
  for j in 0..KDROP[ty] {
    spawn(4, cxk + Random(-1.0, 1.0), cyk, Random(-0.4, 0.4), Random(-1.0, -0.5))
  }
  if Random(0, 1) == 0 { spawn(5, cxk - 1.0, cyk - 1.0, 0.0, -0.5) }
  if ty == 3 {
    bossDead = true
    for i in 0..576 {
      if cur[i] == ${T.gate} {
        cur[i] = 0
        tileCells(i)
      }
    }
    for i in 0..NK {
      if kt[i] == 7 { kt[i] = 0 }
    }
    playSong(0)
    say("The Mole King is defeated. He was just a mole with a crown.", 100)
  }
}
mod bulletTick() {
  for i in 0..NB {
    if bt[i] > 0 {
      bt[i] -= 1
      bx[i] = bx[i] + bvx[i]
      by[i] = by[i] + bvy[i]
      let cx: int = floor(bx[i])
      let cy: int = floor(by[i])
      let tl = tileAt(cx, cy)
      if tl == ${T.star} {
        // one shot cracks the whole star column (2 tiles up and down), so a gap opens player-tall
        let sx: int = floor(cx / 2.0)
        let sy: int = floor(cy / 2.0)
        for j in 0..5 {
          let sty: int = sy - 2 + j
          if sty >= 0 && sty < 18 && cur[sty * 32 + sx] == ${T.star} {
            cur[sty * 32 + sx] = 0
            tileCells(sty * 32 + sx)
          }
        }
        sfx(${FX.crack})
        bt[i] = 0
      } else if solid(cx, cy) > 0 || cx < -1 || cx > W || cy < -1 || cy > H {
        bt[i] = 0
      } else {
        for k in 0..NK {
          let ty = kt[k]
          if bt[i] > 0 && (ty == 1 || ty == 2 || ty == 3) && overlap(bx[i], by[i], 1.0, 1.0, kx[k], ky[k], KW[ty], KH[ty]) {
            khp[k] = khp[k] - bl[i] - 1
            kfl[k] = 3
            bt[i] = 0
            if khp[k] <= 0 { kill(k) } else { sfx(${FX.bump}) }
          }
        }
      }
    }
  }
}
mod entityTick() {
  for k in 0..NK {
    let ty = kt[k]
    if ty > 0 {
      ktm[k] = ktm[k] + 1
      if kfl[k] > 0 { kfl[k] = kfl[k] - 1 }
      let dxp = px + 1.0 - (kx[k] + KW[ty] * 0.5)
      if ty == 1 {
        // hopper: waits on the ground, then hops at you
        kvy[k] = min(kvy[k] + 0.1, 1.0)
        if kgr[k] > 0 && ktm[k] > 25 && abs(dxp) < 26.0 {
          kvy[k] = -0.95
          kvx[k] = sign(dxp) * 0.35
          ktm[k] = 0
        }
        moveBox(kx[k], ky[k], kvx[k], kvy[k], 2, 2)
        kx[k] = mx
        ky[k] = my
        kgr[k] = mhy && kvy[k] > 0.0
        if mhy {
          kvy[k] = 0.0
          if kgr[k] > 0 { kvx[k] = 0.0 }
        }
        if mhx { kvx[k] = -kvx[k] }
      } else if ty == 2 {
        // bat: bobs on a sine round its spawn height, drifts toward you
        if abs(dxp) < 34.0 { kx[k] = kx[k] + sign(dxp) * 0.12 }
        ky[k] = kvy[k] + SINT[(ktm[k] * 2) % 32] * 2.5
      } else if ty == 3 {
        // the Mole King: stomps toward you, leaps, rocks fall when he lands
        kvy[k] = min(kvy[k] + 0.08, 1.2)
        if kgr[k] > 0 {
          kvx[k] = sign(dxp) * 0.22
          if ktm[k] > 60 {
            kvy[k] = -1.25
            kvx[k] = sign(dxp) * 0.45
            ktm[k] = 0
            sfx(${FX.roar})
          }
        }
        let wasAir = kgr[k] == 0
        moveBox(kx[k], ky[k], kvx[k], kvy[k], 6, 5)
        kx[k] = mx
        ky[k] = my
        kgr[k] = mhy && kvy[k] > 0.0
        if mhy {
          if wasAir && kgr[k] > 0 {
            sfx(${FX.thud})
            spawn(7, clamp(px + Random(-6.0, 6.0), 4.0, 58.0), 4.0, 0.0, 0.0)
            spawn(7, Random(4.0, 58.0), 4.0, 0.0, 0.0)
          }
          kvy[k] = 0.0
        }
      } else if ty == 4 || ty == 5 || ty == 6 {
        // pickups fall and bounce; shards fade
        kvy[k] = min(kvy[k] + 0.08, 0.8)
        kvx[k] = kvx[k] * 0.95
        moveBox(kx[k], ky[k], kvx[k], kvy[k], KW[ty], KH[ty])
        kx[k] = mx
        ky[k] = my
        if mhy { kvy[k] = if kvy[k] > 0.3 then -kvy[k] * 0.5 else 0.0 }
        if mhx { kvx[k] = -kvx[k] }
        if ty == 4 && ktm[k] > 160 { kt[k] = 0 }
      } else if ty == 7 {
        kvy[k] = min(kvy[k] + 0.05, 0.9)
        ky[k] = ky[k] + kvy[k]
        if ky[k] > 6.0 && solid(floor(kx[k] + 1.0), floor(ky[k] + 2.0)) > 0 {
          kt[k] = 8
          ktm[k] = 0
        }
      } else if ty == 8 {
        if ktm[k] > 6 { kt[k] = 0 }
      }
      // touching the player
      let ty2 = kt[k]
      if state == 1 && ty2 > 0 && ty2 != 8 && overlap(px, py, 2.0, 3.0, kx[k], ky[k], KW[ty2], KH[ty2]) {
        if ty2 == 4 {
          kt[k] = 0
          gainXp(1)
        } else if ty2 == 5 {
          kt[k] = 0
          hp = min(hp + 2, maxhp)
          sfx(${FX.heal})
        } else if ty2 == 6 {
          kt[k] = 0
          capTaken = true
          maxhp += 3
          hp = maxhp
          sfx(${FX.levelup})
          say("Life Capsule! Max health +3. Your heart is now slightly larger, like a balloon animal.", 90)
        } else {
          hurt(KDMG[ty2], if dxp > 0.0 then 1.0 else -1.0)
        }
      }
    }
  }
}

// ---------- drawing
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
mod drawSpr(s: int, x: int, y: int, flip: int, white: int) {
  let w = SW[s]
  let o = SOFF[s]
  for j in 0..w * SH[s] {
    let sx = j % w
    let sy = j / w
    let c = SPR[o + sy * w + (if flip > 0 then w - 1 - sx else sx)]
    let cx = x + sx
    let cy = y + sy
    if c >= 0 && cx >= 0 && cx < W && cy >= 0 && cy < H {
      let i = cy * W + cx
      let col = if white > 0 then 7 else c
      if fb[i] != col {
        fb[i] = col
        dirty[cy] = 1
      }
    }
  }
  rx.push(x)
  ry.push(y)
  rw.push(w)
  rh.push(SH[s])
}
mod put(cx: int, cy: int, c: int) {
  let i = cy * W + cx
  if fb[i] != c {
    fb[i] = c
    dirty[cy] = 1
  }
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
${bricks ? `mod paintRow(r: int) {
  for c in 0..W {
    let i = r * W + c
    let p = fb[i]
    if p != shown[i] {
      shown[i] = p
      scr[i].SetBrickProperty(Color, ColorSRGB(PR[p], PG[p], PB[p], 255))
    }
  }
}
mod hexRow(r: int) -> string {
  var s: string = ""
  for c in 0..W { s = s .. HEXD[fb[r * W + c]] }
  return s
}
` : ''}mod drawHud() {
  let lv = level()
  for i in 0..3 { put(1 + i * 2, 1, if i < lv then 9 else 2) }
  let fill: int = if xp >= 30 then 16 else ((xp - (lv - 1) * 10) * 16) / 10
  for i in 0..16 { put(8 + i, 1, if i < fill then (if xp >= 30 then 12 else 9) else 2) }
  for i in 0..maxhp * 2 { put(1 + i, 3, if i < hp * 2 then 8 else 15) }
}
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  if state != 0 {
    for k in 0..NK {
      let ty = kt[k]
      if ty > 0 {
        let a = (ktm[k] / 4) % 2
        var s: int = 0
        if ty == 1 { s = if kgr[k] > 0 then ${S.hop0} else ${S.hop1} }
        else if ty == 2 { s = ${S.bat0} + a }
        else if ty == 3 { s = ${S.boss0} + (if kgr[k] > 0 then a else 0) }
        else if ty == 4 { s = ${S.shard0} + a }
        else if ty == 5 { s = ${S.heart} }
        else if ty == 6 { s = ${S.capsule} }
        else if ty == 7 { s = ${S.rock} }
        else { s = ${S.puff0} + (ktm[k] / 3) % 2 }
        let fl: int = if ty < 4 && kx[k] + KW[ty] * 0.5 < px + 1.0 then 0 else 1
        drawSpr(s, floor(kx[k]), floor(ky[k]), if ty == 2 then 0 else fl, kfl[k] > 0)
      }
    }
    for i in 0..NB {
      if bt[i] > 0 { drawSpr(${S.b1} + bl[i] - 1, floor(bx[i]), floor(by[i]), 0, 0) }
    }
    if state == 1 && (inv == 0 || t % 4 < 2) {
      let ps: int = if !ground then ${S.p2} else (if abs(vx) > 0.1 then ${S.p0} + (t / 3) % 2 else ${S.p0})
      drawSpr(ps, if face > 0 then floor(px) else floor(px) - 1, floor(py), face < 0, 0)
    }
    drawHud()
  }
${bricks ? paintTail : textTail}}

// ---------- the frame
${debug ? `var dbk: string = ""
var dumpReq: bool = false
on ChatCommand("cs", "MILDORS PLUME debug: /cs <keys l r u d j s> | /cs dump | /cs warp N") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args.Contains("warp") { pend = args.Substring(5, 2).ParseInt() }
  else { dbk = args }
}
` : ''}fn boot() {
  booted = true
  state = 0
  playSong(0)
  pend = TITLE
  say(RNAME[TITLE] .. " " .. RMSG[TITLE], 100000)
}
on tick {
  if !booted { boot() }
${debug ? `  kL = left || dbk.Contains("l")
  kR = right || dbk.Contains("r")
  kU = up || dbk.Contains("u")
  kD = down || dbk.Contains("d")
  kJ = jump || dbk.Contains("j")
  kS = shoot || dbk.Contains("s")
  if t % 20 == 0 { PrintToConsole("csdbg|" .. t .. "|" .. state .. "|" .. room .. "|" .. px .. "|" .. py .. "|" .. frame.Length() .. "|" .. hud .. "|" .. msg .. "|k " .. kt.join(",") .. " hp " .. khp.join(",") .. " a " .. aP0 .. "/" .. aV0 .. " " .. aP1 .. "/" .. aV1 .. " " .. aP2 .. "/" .. aV2 .. " song " .. song) }
  if dumpReq {
    dumpReq = false
    for r in 0..H { PrintToConsole("csrow|" .. r .. "|" .. ${bricks ? 'hexRow(r)' : 'rows[r]'}) }
  }` : `  kL = left
  kR = right
  kU = up
  kD = down
  kJ = jump
  kS = shoot`}
  t += 1
  stT += 1
  if state == 0 {
    if (kJ && !pJ) || (kS && !pS) { newGame() }
  } else if state == 1 {
    playerTick()
    bulletTick()
    entityTick()
  } else if state == 2 {
    bulletTick()
    entityTick()
    if stT == 40 { say("You have died. The cave seems smug about it. Press JUMP to try again.", 100000) }
    if stT > 40 && kJ && !pJ { respawn() }
  } else {
    if stT > 20 && kJ && !pJ { boot() }
  }
  if pend >= 0 {
    let pr = pend
    pend = -1
    loadRoom(pr)
  }
  if msgT > 0 {
    msgT -= 1
    if msgT == 0 { msg = "" }
  }
  hud = "HP " .. hp .. "/" .. maxhp .. "  Lv " .. level() .. "  EXP " .. xp
  audio()
  render()
  pJ = kJ
  pS = kS
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fs = await import('node:fs');
  const g = generate();
  fs.writeFileSync(new URL('./mildorsplume.gen.ws', import.meta.url), g.src);
  console.log('wrote mildorsplume.gen.ws', g.src.length, 'chars');
}
