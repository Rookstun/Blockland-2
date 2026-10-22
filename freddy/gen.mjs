// freddy/gen.mjs: FREDDY GOT FINGERED - THE GAME (a parody tie-in, licensed by nobody), one microchip, Super Sigmas
// engine (W x H block framebuffer, dirty rows -> text strips). Original art, music and writing.
//   1 SKATE TO HOLLYWOOD: side-scroller, jump (Space / W) hydrants, trash cans and Dad, kickflip (LMB / E) in the air,
//     grab sausages. 3 boards (lives).
//   2 SAUSAGE SERENADE: sausages on strings drop onto 4 keyboard keys: A W S D as they reach the keys.
//   3 BROTHERLY LOVE: Freddy wants a turn on the board; swing it at his leg when the meter is yellow (E), 3 swings.
//   4 THE PITCH: three questions for a Hollywood exec, A or D to answer. Total score decides the million dollars.
//   inputs: tick, seated, left right up down, jump (Space/RMB), trick (LMB/E); outputs strip0..8, msg_, hud_, title_, P/V 0..2
export const W = 48, H = 36, STRIP = 4;
export const PAL = ['0d0a14', '6ab0e8', 'f0a860', '3a3a48', 'f8d040', '8a8a90', '5a5a66', 'f4f4f4',
  'e03838', 'f8c0a0', '3858a8', '101010', 'f07820', '9a3a2a', '2a2a30', '6a4020'];

const SPRITES = {
  gord: ['.ff', '.99', '.99', '777', '777', 'aaa', 'a.a', 'b.b'],
  gordAir: ['.ff', '.99', '.99', '777', '977', 'aaa', 'aa.', '.bb'],
  board: ['88888'], boardF1: ['.b8b.'], boardF2: ['.888.'],
  hydrant: ['.8.', '888', '.8.', '888'], trash: ['666', '6b6', '666', '666'], cone: ['.c.', '.c.', 'ccc'],
  dad: ['.66.', '.99.', '.99.', 'eeee', '9ee9', 'aaaa', 'a..a', 'b..b'],
  sausage: ['ddd'], note: ['.7', 'dd', 'dd', 'dd'],
  exec: ['.bb.', '.99.', 'b7bb', 'bb7b'], gordFront: ['fff', '999', '777', '777', 'aaa', 'a.a', 'b.b'],
  cash: ['4.4', '444'], star: ['4'],
  freddy: ['888', '999', '999', 'eee', 'eee', 'aaa', 'a.a', 'b.b'], freddyCast: ['888', '9b9', '999', 'eee', 'eee', 'aaa', '7.7', '7.7'],
  crutch: ['5', '5', '5', '5', '5', '5'], boardUp: ['8', '8', '8', '8', '8'], crack: ['4.4', '.4.', '4.4'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));
// obstacle kinds (kt): 1 hydrant 2 trash 3 cone 4 Dad (runs at you) 5 sausage
const KSPR = [0, S.hydrant, S.trash, S.cone, S.dad, S.sausage];

// backgrounds
function bgSkate() {
  let s = 99; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const b = Array(W * H).fill(0), set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) b[y * W + x] = c; };
  for (let y = 2; y < 25; y++) for (let x = 0; x < W; x++) set(x, y, y < 9 ? 1 : 2);
  for (let x = 0; x < W;) { const bw = 3 + Math.floor(rnd() * 4), top = 11 + Math.floor(rnd() * 8);
    for (let y = top; y < 25; y++) for (let i = 0; i < bw; i++) set(x + i, y, (i % 2 === 1 && (y - top) % 3 === 1 && rnd() < 0.5) ? 4 : 3);
    x += bw; }
  for (let y = 25; y < 30; y++) for (let x = 0; x < W; x++) set(x, y, x % 6 === 0 ? 6 : 5);
  for (let x = 0; x < W; x++) set(x, 30, 6);
  for (let y = 31; y < H; y++) for (let x = 0; x < W; x++) set(x, y, 14);
  return b;
}
const LANES = [6, 17, 28, 39]; // keyboard lane left edges (8 wide)
function bgKeys() {
  const b = Array(W * H).fill(0), set = (x, y, c) => { b[y * W + x] = c; };
  for (let y = 2; y < 30; y++) for (let x = 0; x < W; x++) set(x, y, x % 8 < 4 ? 3 : 6);
  for (let x = 0; x < W; x++) set(x, 2, 15);
  for (let y = 30; y < H; y++) for (let x = 0; x < W; x++) set(x, y, (x % 3 === 2 && y < 33) ? 11 : 7);
  for (const l of LANES) for (let i = 0; i < 8; i++) { set(l + i, 29, 4); set(l + i, 3, 15); }
  return b;
}
function bgOffice() {
  const b = Array(W * H).fill(6), set = (x, y, c) => { b[y * W + x] = c; };
  for (let x = 0; x < W; x++) { set(x, 0, 0); set(x, 1, 0); }
  for (let y = 4; y < 15; y++) for (let x = 30; x < 45; x++) set(x, y, (x === 30 || x === 44 || y === 4 || y === 14 || x === 37) ? 7 : (y > 11 ? 2 : 1));
  for (let y = 24; y < 31; y++) for (let x = 18; x < 40; x++) set(x, y, y === 24 ? 2 : 15);
  for (let y = 31; y < H; y++) for (let x = 0; x < W; x++) set(x, y, 3);
  return b;
}

function bgHome() {
  const b = Array(W * H).fill(0), set = (x, y, c) => { b[y * W + x] = c; };
  for (let y = 2; y < 30; y++) for (let x = 0; x < W; x++) set(x, y, x % 8 < 4 ? 3 : 6);
  for (let y = 30; y < H; y++) for (let x = 0; x < W; x++) set(x, y, (x + y) % 6 === 0 ? 2 : 15);
  for (let y = 22; y < 30; y++) for (let x = 36; x < 46; x++) set(x, y, y < 25 && x > 37 && x < 44 ? 6 : 8); // Dad's couch
  for (let x = 6; x < 42; x++) { set(x, 3, 11); set(x, 6, 11); }
  return b;
}

// music (original): 0 skate punk, 1 serenade backing, 2 office lounge, 3 million dollars, 4 game over
const SONGS = [
  { eighth: 3, loop: 1, lead: 'E5:1 E5:1 D5:1 E5:1 G5:2 E5:2 | D5:1 D5:1 B4:1 D5:1 E5:4 | E5:1 E5:1 D5:1 E5:1 A5:2 G5:2 | F#5:2 E5:2 D5:2 B4:2',
    bass: 'E2 E2 E2 E2 C2 C2 D2 D2 | E2 E2 E2 E2 B1 B1 B1 B1 | E2 E2 E2 E2 C2 C2 D2 D2 | B1 B1 B1 B1 D2 D2 D#2 D#2' },
  { eighth: 5, loop: 1, lead: 'R:16', bass: 'C3:2 G3:2 E3:2 G3:2 | F3:2 A3:2 C4:2 A3:2 | G2:2 D3:2 B2:2 D3:2 | C3:2 G3:2 E3:2 G3:2' },
  { eighth: 5, loop: 1, lead: 'E5:3 D5:1 C5:2 A4:2 | G4:4 R:4 | F5:3 E5:1 D5:2 B4:2 | C5:4 R:4',
    bass: 'C3:2 E3:2 A2:2 C3:2 | F2:2 A2:2 G2:2 B2:2 | D3:2 F3:2 G2:2 B2:2 | C3:4 G2:4' },
  { eighth: 3, loop: 0, lead: 'C5:1 E5:1 G5:1 C6:3 A5:1 C6:6', bass: 'C3:2 E3:2 G3:2 C3:6' },
  { eighth: 4, loop: 0, lead: 'G4:2 F#4:2 F4:2 E4:8', bass: 'C3:4 B2:4 A#2:8' },
];
const LANEP = [1.0, 1.122, 1.26, 1.498]; // C D E G over A4: the serenade's keys
const SFX = {
  jump: [0.8, 1.0, 1.2], flip: [1.5, 2.0, 2.5, 3.0], land: [0.3, 0.25], crash: [0.4, 0.3, 0.25, 0.2, 0.15], sausage: [2.0, 2.5],
  dad: [0.5, 0.55, 0.5, 0.45], miss: [0.3, 0.28], pick: [1.5, 2.0], ding: [2.0, 2.0, 3.0, 3.0],
  k0: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0], k1: [1.122, 1.122, 1.122, 1.122, 1.122, 1.122], k2: [1.26, 1.26, 1.26, 1.26, 1.26, 1.26], k3: [1.498, 1.498, 1.498, 1.498, 1.498, 1.498],
};
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));
// the serenade chart: [tick, lane], 12 ticks a beat
const CHART = (() => { const pat = [0, 1, 2, 1, 0, 2, 3, 3, 2, 1, 0, 1, 2, 3, 2, 0, 1, 1, 2, 2, 3, 2, 1, 0]; return pat.map((l, i) => [60 + i * 12 + (i >= 16 ? -(i - 16) * 2 : 0), l]); })();

const PITCH = [
  ['Exec: "So what is this cartoon called?"', 'Zebras in America', 'X-Ray Cat', 2, 1],
  ['Exec: "Who is it for?"', 'Zebras', 'Anyone with eyes', -1, 2],
  ['Exec: "Can you do the voices?"', '*does all the voices*', 'No', 2, -1],
];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NAMES.indexOf(m[1]) + 12 * (+m[2] + 1); };
const parseVoice = (s, e) => s.split(/\s+/).filter(t => t && t !== '|').map(tok => { const [n, d = '1'] = tok.split(':'); return [n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * e)]; });
const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false } = {}) {
  const NK = 8, NS = H / STRIP, NN = CHART.length;
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) throw Error(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  const KW = KSPR.map((s, i) => i ? sw[s] : 0), KH = KSPR.map((s, i) => i ? sh[s] : 0);
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);

  const src = `// GENERATED by freddy/gen.mjs: edit that, not this file.
// FREDDY GOT FINGERED - THE GAME: one frame per 'tick' (20 Hz) while 'seated'.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in jump: bool
@left in trick: bool

const W = ${W}
const H = ${H}
const NK = ${NK}
const NN = ${NN}
const BGSKATE = ${A(bgSkate())}
const BGKEYS = ${A(bgKeys())}
const BGOFFICE = ${A(bgOffice())}
const BGHOME = ${A(bgHome())}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const KSPR = ${A(KSPR)}
const KW = ${A(KW)}
const KH = ${A(KH)}
const LANES = ${A(LANES)}
const CHT = ${A(CHART.map(c => c[0]))}
const CHL = ${A(CHART.map(c => c[1]))}
const PQ = ${AS(PITCH.map(p => p[0]))}
const PA = ${AS(PITCH.map(p => p[1]))}
const PD = ${AS(PITCH.map(p => p[2]))}
const PAS = ${A(PITCH.map(p => p[3]))}
const PDS = ${A(PITCH.map(p => p[4]))}
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

var state: int = -1         // -1 off, 0 title, 1 skate, 2 serenade, 6 Freddy's leg, 3 pitch, 4 verdict, 5 game over
var stT: int = 0
var t: int = 0
var day: int = 1
var score: int = 0
var hi: int = 0
var sausages: int = 0
var boards: int = 3
var inv: int = 0
var gy: float = 29.0
var vy: float = 0.0
var air: bool = false
var flipT: int = 0
var flips: int = 0
var spd: float = 0.6
var dist: float = 0.0
var goal: float = 1400.0
var spawnT: float = 0.0
var dash: int = 0
var combo: int = 0
var hits: int = 0
var ni: int = 0
var nShown: int = 0
var pq: int = 0
var imp: int = 0
var swings: int = 0
var cracks: int = 0
var swingT: int = 0
var legX: float = 8.0
var legV: float = 0.8
var zone: int = 20
var kL: bool = false
var kR: bool = false
var kU: bool = false
var kD: bool = false
var kJ: bool = false
var kS: bool = false
var pL: bool = false
var pR: bool = false
var pU: bool = false
var pD: bool = false
var pJ: bool = false
var pS: bool = false

var kt: int[] = ${zeros(NK)}
var kx: float[] = ${zeros(NK, '0.0')}
var ky: int[] = ${zeros(NK)}
var nh: int[] = ${zeros(NN)}
var rx: int[] = []
var ry: int[] = []
var rw: int[] = []
var rh: int[] = []

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
@right out title_: string = if state == 0 then "FREDDY GOT FINGERED" else ""
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
mod overlap(ax: float, ay: float, aw: float, ah: float, bx0: float, by0: float, bw: float, bh: float) -> bool {
  return ax < bx0 + bw && bx0 < ax + aw && ay < by0 + bh && by0 < ay + ah
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
    aV0 = if md0 <= 1 then 0.0 else 0.3 * max(0.4, 1.0 - mt0 * 0.06)
  } else { aV0 = 0.0 }
  if mp1 > 0.0 {
    aP1 = mp1
    aV1 = if md1 <= 1 then 0.0 else 0.55
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
mod drawSpr(s: int, x: int, y: int, white: int) {
  let w = SW[s]
  let o = SOFF[s]
  for j in 0..w * SH[s] {
    let c = SPR[o + j]
    if c >= 0 { put(x + j % w, y + j / w, if white > 0 then 7 else c) }
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
mod setScene(which: int) {
  if which == 1 { bg.copyFrom(BGSKATE) }
  else if which == 2 { bg.copyFrom(BGKEYS) }
  else if which == 4 { bg.copyFrom(BGHOME) }
  else { bg.copyFrom(BGOFFICE) }
  fb.copyFrom(bg)
  for i in 0..H { dirty[i] = 1 }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
}
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  if state == 0 || state == 1 || state == 5 {
    // lane dashes on the road roll by
    for x in 0..W { put(x, 33, if (x + dash) % 10 < 5 then 7 else 14) }
    for k in 0..NK {
      if kt[k] > 0 { drawSpr(KSPR[kt[k]], floor(kx[k]), ky[k], 0) }
    }
    let fy: int = floor(gy)
    if state != 5 && (inv == 0 || t % 4 < 2) {
      drawSpr(if air then ${S.gordAir} else ${S.gord}, 8, fy - 8, 0)
      let bs: int = if flipT > 0 then (if (flipT / 2) % 2 == 0 then ${S.boardF1} else ${S.boardF2}) else ${S.board}
      drawSpr(bs, 7, fy, 0)
    }
    for i in 0..5 { put(1 + i * 2, 0, if i < boards then 8 else 6) }
    let prog: int = min(${W - 2}, floor(dist / goal * ${W - 2}.0))
    for i in 0..${W - 2} { put(1 + i, 1, if i < prog then 4 else 3) }
  } else if state == 2 {
    // sausages on strings falling onto the keys
    for i in nShown..NN {
      let dt = CHT[i] - stT
      if nh[i] == 0 && dt < 40 && dt > -6 {
        let y: int = 28 - floor(dt * 0.6) - 3
        drawSpr(${S.note}, LANES[CHL[i]] + 3, y, 0)
        for sy in 3..max(3, y) { put(LANES[CHL[i]] + 4, sy, 7) }
        rx.push(LANES[CHL[i]] + 4)
        ry.push(3)
        rw.push(1)
        rh.push(max(1, y - 3))
      }
    }
    for l in 0..4 {
      let lit = (l == 0 && kL) || (l == 1 && kU) || (l == 2 && kD) || (l == 3 && kR)
      for i in 0..8 { put(LANES[l] + i, 30, if lit then 4 else 7) }
    }
  } else if state == 6 {
    // the swing meter (yellow = sweet spot), Gord with the board, Freddy's legs
    for x in 8..40 { put(x, 4, if x >= zone && x < zone + 4 then 4 else 6) }
    for x in 8..40 { put(x, 5, if x == floor(legX) then 8 else 0) }
    drawSpr(${S.gordFront}, 14, 22, 0)
    drawSpr(${S.boardUp}, if swingT > 20 then 18 else 13, if swingT > 20 then 24 else 17, 0)
    drawSpr(if cracks > 0 then ${S.freddyCast} else ${S.freddy}, 20, 21, if swingT > 26 then 1 else 0)
    if cracks > 0 { drawSpr(${S.crutch}, 23, 23, 0) }
    if swingT > 18 && cracks > 0 { drawSpr(${S.crack}, 21 + t % 2, 26, 0) }
    for i in 0..3 { put(1 + i * 2, 0, if i < 3 - swings then 4 else 6) }
  } else {
    drawSpr(${S.exec}, 27, 20, 0)
    drawSpr(${S.gordFront}, 10, 24, 0)
    if state == 4 && imp > 0 {
      for i in 0..3 { drawSpr(${S.cash}, 20 + i * 6 + (t / 4 + i) % 2, 18 - (t + i * 7) % 12, 0) }
    }
  }
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

// ---------- stage 3: the pitch
mod startPitch() {
  state = 3
  stT = 0
  setScene(3)
  pq = 0
  imp = 0
  playSong(2)
  say("Hollywood. The big pitch. A or D to answer.", 60)
}
mod verdict() {
  let total = score + sausages * 20 + imp * 100
  let need = 900 + day * 300
  state = 4
  stT = 0
  if total >= need {
    imp = 1
    score = total
    if score > hi { hi = score }
    playSong(3)
    sfx(${FX.ding})
    say("Exec: 'Here's a MILLION DOLLARS.' SPACE = sequel", 100000)
  } else {
    imp = 0
    if score > hi { hi = score }
    playSong(4)
    say("Exec: 'Get out of my office.' (" .. total .. "/" .. need .. ") SPACE", 100000)
  }
}

mod pitchTick() {
  if stT > 20 {
    msg = PQ[pq]
    msgT = 0
    var a: int = 0
    if kL && !pL { a = 1 }
    if kR && !pR { a = 2 }
    if a > 0 {
      imp += if a == 1 then PAS[pq] else PDS[pq]
      sfx(${FX.pick})
      pq += 1
      stT = 0
      if pq >= ${PITCH.length} { verdict() }
    }
  }
}
// ---------- stage 3: brotherly love (Freddy wants a turn on the board)
mod startLeg() {
  state = 6
  stT = 0
  setScene(4)
  swings = 0
  cracks = 0
  legX = 8.0
  legV = 0.7 + day * 0.15
  zone = Random(12, 34)
  swingT = 0
  playSong(2)
  say("Freddy wants a turn on the board. Gord says no. With the board. E when it's yellow!", 100000)
}
mod legTick() {
  if swingT > 0 {
    swingT -= 1
    if swingT == 0 {
      if swings >= 3 { startPitch() } else { zone = Random(12, 34) }
    }
  } else {
    legX = legX + legV
    if legX > 39.0 || legX < 8.0 { legV = 0.0 - legV }
    if kS && !pS {
      swings += 1
      swingT = 30
      let cx: int = floor(legX)
      if cx >= zone && cx < zone + 4 {
        cracks += 1
        score += 300
        sfx(${FX.crash})
        say(if cracks == 1 then "*CRACK* Freddy: 'MY LEG!!' (+300)" else (if cracks == 2 then "*CRACK* The other one. Symmetry. (+300)" else "*CRACK* Freddy has run out of legs. (+300)"), 30)
      } else {
        sfx(${FX.miss})
        say("Whiff. Freddy: 'Ha! Missed!'", 30)
      }
    }
  }
}
// ---------- stage 2: the sausage serenade
mod startSerenade() {
  state = 2
  stT = 0
  setScene(2)
  for i in 0..NN { nh[i] = 0 }
  ni = 0
  nShown = 0
  hits = 0
  combo = 0
  playSong(1)
  say("Back home. Dad needs cheering up. Sausages on strings. A W S D!", 100000)
}
mod serenadeTick() {
  var press: int = -1
  if kL && !pL { press = 0 }
  if kU && !pU { press = 1 }
  if kD && !pD { press = 2 }
  if kR && !pR { press = 3 }
  if press >= 0 {
    var got: int = -1
    for i in nShown..NN {
      if got < 0 && nh[i] == 0 && CHL[i] == press && abs(CHT[i] - stT) <= 4 { got = i }
    }
    if got >= 0 {
      nh[got] = 1
      hits += 1
      combo += 1
      score += 20 * min(combo, 8)
      sfx(${FX.k0} + press)
      if combo % 6 == 0 { say("Gord: 'DADDY, WOULD YOU LIKE SOME SAUSAGE?'", 40) }
    } else {
      combo = 0
      sfx(${FX.miss})
    }
  }
  // notes that went past
  for i in nShown..NN {
    if nh[i] == 0 && stT - CHT[i] > 4 {
      nh[i] = 2
      combo = 0
      if msgT == 0 { say("Dad: 'What are you DOING?!'", 25) }
    }
  }
  for i in 0..NN {
    if nShown < NN && nh[nShown] > 0 { nShown += 1 }
  }
  if nShown >= NN && stT > CHT[NN - 1] + 20 { startLeg() }
}

// ---------- stage 1: skate to Hollywood
mod startSkate() {
  state = 1
  stT = 0
  setScene(1)
  for k in 0..NK { kt[k] = 0 }
  gy = 29.0
  vy = 0.0
  air = false
  flipT = 0
  inv = 0
  dist = 0.0
  spd = 0.55 + day * 0.05
  spawnT = 20.0
  playSong(0)
  say("Day " .. day .. ". Gord skates to Hollywood. Space jump, E kickflip.", 80)
}
mod spawnThing(kind: int, y: int) {
  let k = kt.find(0)
  if k >= 0 {
    kt[k] = kind
    kx[k] = ${W}.0
    ky[k] = y
  }
}
mod crash() {
  if inv == 0 {
    boards -= 1
    inv = 40
    flipT = 0
    sfx(${FX.crash})
    if boards <= 0 {
      state = 5
      stT = 0
      if score > hi { hi = score }
      playSong(4)
      say("Gord ate the pavement. Dad: 'GET A JOB!' SPACE retry", 100000)
    } else { say("Gord eats pavement. " .. boards .. " boards left.", 40) }
  }
}
mod skateTick() {
  if (kJ && !pJ) || (kU && !pU) {
    if !air {
      vy = -1.05
      air = true
      sfx(${FX.jump})
    }
  }
  if kS && !pS && air && flipT == 0 {
    flipT = 10
    sfx(${FX.flip})
  }
  if flipT > 0 { flipT -= 1 }
  if air {
    vy = vy + 0.075
    gy = gy + vy
    if gy >= 29.0 {
      gy = 29.0
      vy = 0.0
      air = false
      if flipT > 0 {
        flipT = 0
        sfx(${FX.land})
        say("Sketchy landing. No points, but Gord lives.", 25)
      } else {
        sfx(${FX.land})
        if flips > 0 {
          score += 50 * flips
          say("KICKFLIP x" .. flips .. "! +" .. 50 * flips, 30)
        }
      }
      flips = 0
    }
    if flipT == 9 { flips += 1 }
  }
  if inv > 0 { inv -= 1 }
  dist = dist + spd
  dash = (dash + 1) % 10
  spawnT = spawnT - spd
  if spawnT <= 0.0 {
    let r = Random(0, 9)
    if r < 3 { spawnThing(1, 26) }
    else if r < 5 { spawnThing(2, 26) }
    else if r < 7 { spawnThing(3, 27) }
    else if r < 8 && dist > 200.0 {
      spawnThing(4, 22)
      sfx(${FX.dad})
      say("DAD: 'GOOORD!!'", 30)
    }
    else {
      spawnThing(5, Random(20, 25))
      spawnThing(5, Random(18, 25))
    }
    spawnT = Random(18.0, 34.0) - day * 2.0
  }
  for k in 0..NK {
    let kind = kt[k]
    if kind > 0 {
      kx[k] = kx[k] - spd - (if kind == 4 then 0.35 else 0.0)
      if kx[k] < -6.0 { kt[k] = 0 }
      else if overlap(8.0, gy - 8.0, 3.0, 9.0, kx[k], ky[k], KW[kind], KH[kind]) {
        if kind == 5 {
          kt[k] = 0
          sausages += 1
          score += 10
          sfx(${FX.sausage})
        } else { crash() }
      }
    }
  }
  if dist >= goal && state == 1 { startSerenade() }
}

// ---------- power
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  setScene(1)
  for k in 0..NK { kt[k] = 0 }
  gy = 29.0
  air = false
  flipT = 0
  inv = 0
  boards = 5
  dist = 0.0
  playSong(0)
  say("SPACE start. A parody. Licensed by absolutely no one.", 100000)
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
${strips.map(k => `  st${k} = ""`).join('\n')}
}

${debug ? `var dbk: string = ""
var dumpReq: bool = false
on ChatCommand("fgf", "FGF debug: /fgf <keys o(sit) l r u d j s> | /fgf dump | /fgf stage N") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "stage 2" { startSerenade() }
  else if args == "stage 3" { startLeg() }
  else if args == "stage 4" { startPitch() }
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
    kJ = jump || dbk.Contains("j")
    kS = trick || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("fgdbg|" .. t .. "|" .. state .. "|stT " .. stT .. "|gy " .. gy .. "|dist " .. dist .. "|score " .. score .. " saus " .. sausages .. " boards " .. boards .. " hits " .. hits .. " imp " .. imp .. "|k " .. kt.join(",") .. "|" .. msg) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("fgrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = jump
    kS = trick`}
    t += 1
    stT += 1
    if state == 0 {
      dash = (dash + 1) % 10
      if (kJ && !pJ) || (kS && !pS) {
        day = 1
        score = 0
        sausages = 0
        boards = 5
        startSkate()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      skateTick()
    } else if state == 2 {
      serenadeTick()
    } else if state == 6 {
      legTick()
    } else if state == 3 {
      pitchTick()
    } else if state == 4 {
      if stT > 30 && kJ && !pJ {
        if imp > 0 { day += 1 } else {
          day = 1
          score = 0
          sausages = 0
          boards = 5
        }
        startSkate()
        pJ = true
      }
    } else if state == 5 {
      if stT > 30 && kJ && !pJ {
        day = 1
        score = 0
        sausages = 0
        boards = 5
        startSkate()
        pJ = true
      }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then ("THE OFFICIAL GAME (not official). HI " .. hi)
      else (if state == 3 then ("A: " .. PA[min(pq, ${PITCH.length - 1})] .. "    D: " .. PD[min(pq, ${PITCH.length - 1})])
      else ("SCORE " .. score .. "  SAUSAGES " .. sausages .. "  DAY " .. day .. (if state == 2 then ("  COMBO " .. combo) else (if state == 6 then ("  SWINGS " .. (3 - swings) .. "  LEGS BROKEN " .. cracks) else ""))))
    audio()
    render()
    pL = kL
    pR = kR
    pU = kU
    pD = kD
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}
