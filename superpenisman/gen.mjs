// superpenisman/gen.mjs: SUPER PENIS MAN, a side-scrolling superhero shooter in one microchip (wirescript, Super Sigmas
// engine: W x H block framebuffer, dirty rows -> text strips). Original art, music and writing.
// Wangtown at night: fly (W A S D), laser vision (LMB / E, hold), THE BIG ONE (Space / RMB) when the meter is full.
// 3 levels (Blue Balls Gang, Prudebots, Purity Rings) each ending in a boss (Dr. Flaccid, the Blue Balls Baron, the
// Censor), then the next day, harder. Stiffness pills = more beams, hearts = stiffness (hp).
// Logic runs every tick; the picture is drawn on even ticks (rows 0-17 encoded) and rows 18-35 encoded on odd ones.
//   inputs: tick, seated, left right up down, big (Space/RMB), fire (LMB/E); outputs strip0..8, msg_, hud_, title_, P/V 0..2
export const W = 48, H = 36, STRIP = 4;
export const PAL = ['0b0820', '1c2050', 'f4a6b0', 'c86478', 'f8d040', 'd02828', 'f4f4f4', '3a6ae0',
  '1c2a80', '48c048', '50506a', '2a2a3a', 'a040d0', 'f08020', '101010', 'ffd8e0'];

const SPRITES = {
  hero: ['555.......', '.55222233.', '3322222e63', '3322222333', '.33.......'],
  hero2: ['.55.......', '555222233.', '3322222e63', '3322222333', '.33.......'],
  beam: ['44'],
  ball: ['.77.', '7e7e', '7777', '.88.'],
  prude: ['aaaaa', 'a6a6a', 'aaaaa', 'aeeea', 'a.a.a'],
  ring: ['.464.', '4...4', '4...4', '4...4', '.444.'],
  pill: ['.7.', '767', '.7.'],
  heart: ['5.5', '555', '.5.'],
  ebul: ['cc'],
  flaccid: ['..2222....', '.222222...', '22e22e22..', '22222222..', '2.2ee2.22.', '...2222222', '.....22222', '......2222', '.......33.'],
  baron: ['...eeeee...', '...eeeee...', '.eeeeeeeee.', '.777...777.', '77677.77677', '77777.77777', '7eee7.7eee7', '.888...888.'],
  censor: ['55555555555555', '5eeeeeeeeeeee5', '5ee66eeee66ee5', '5ee6eeeeee6ee5', '5eeeeeeeeeeee5', '55555555555555'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));
// enemy kinds (kt): 1 blue ball (zigzags) 2 prudebot (shoots) 3 purity ring (homes in) 4 stiffness pill 5 heart
const KSPR = [0, S.ball, S.prude, S.ring, S.pill, S.heart];
const KSP = [0, 0.45, 0.35, 0.3, 0.3, 0.3];
const KHP = [0, 1, 3, 2, 0, 0];
const KSC = [0, 100, 250, 200, 0, 0];
const BOSS = [S.flaccid, S.baron, S.censor];
const BHP = [25, 35, 45];
const GOAL = [600, 750, 900];
const LVMSG = [
  'DOWNTOWN WANGTOWN. The Blue Balls Gang is out tonight.',
  'THE SHAFT DISTRICT. Prudebots are enforcing decency.',
  'BROADCAST TOWER. Someone is censoring the whole city.',
];
const BINTRO = [
  "DR. FLACCID: 'Soon the whole city will be... soft.'",
  "THE BLUE BALLS BARON: 'I have waited SO long for this.'",
  "THE CENSOR: 'You can't show THAT on television.'",
];
const BDEFEAT = [
  'Dr. Flaccid goes limp. Even limper. Somehow.',
  'The Baron finally gets some relief. From his job.',
  'The Censor has been censored. ████ ██ █████.',
];

function bgCity() {
  let s = 4242; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const b = Array(W * H).fill(0), set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) b[y * W + x] = c; };
  for (let y = 2; y < 34; y++) for (let x = 0; x < W; x++) set(x, y, rnd() < 0.012 && y < 20 ? 6 : 1);
  for (let y = 2; y < 9; y++) for (let x = 3; x < 11; x++) { const d = (x - 6.5) ** 2 + (y - 5) ** 2; if (d < 9) set(x, y, d < 2 ? 15 : 6); }
  for (let x = 0; x < W;) { const bw = 3 + Math.floor(rnd() * 4), top = 17 + Math.floor(rnd() * 8);
    for (let y = top; y < 34; y++) for (let i = 0; i < bw; i++) set(x + i, y, (i % 2 === 1 && (y - top) % 2 === 1 && rnd() < 0.4) ? 13 : 11);
    x += bw + (rnd() < 0.3 ? 1 : 0); }
  for (let x = 0; x < W;) { const bw = 4 + Math.floor(rnd() * 4), top = 26 + Math.floor(rnd() * 5);
    for (let y = top; y < 34; y++) for (let i = 0; i < bw; i++) set(x + i, y, (i % 2 === 0 && (y - top) % 2 === 1 && rnd() < 0.5) ? 4 : 10);
    x += bw + 1 + Math.floor(rnd() * 3); }
  for (let y = 34; y < H; y++) for (let x = 0; x < W; x++) set(x, y, 14);
  return b;
}

// music (original): 0 title fanfare, 1 flight, 2 boss, 3 level clear, 4 going soft
const SONGS = [
  { eighth: 3, loop: 1, lead: 'G4:1 C5:1 E5:1 G5:3 E5:2 G5:8 | A5:2 G5:2 F5:2 E5:2 D5:4 R:4',
    bass: 'C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 | F2:2 C3:2 F2:2 C3:2 G2:2 D3:2 G2:2 D3:2' },
  { eighth: 3, loop: 1, lead: 'A4:1 A4:1 C5:1 A4:1 E5:2 D5:2 | C5:1 C5:1 D5:1 C5:1 B4:4 | A4:1 A4:1 C5:1 A4:1 E5:2 G5:2 | F5:2 E5:2 D5:2 B4:2',
    bass: 'A2 A2 A2 A2 F2 F2 G2 G2 | A2 A2 A2 A2 E2 E2 E2 E2 | A2 A2 A2 A2 F2 F2 G2 G2 | D2 D2 D2 D2 E2 E2 G#2 G#2' },
  { eighth: 2, loop: 1, lead: 'E5:1 D#5:1 E5:1 B4:1 C5:2 A4:2 | E5:1 D#5:1 E5:1 B4:1 D5:2 G#4:2',
    bass: 'A2 A2 E2 E2 A2 A2 E2 E2 | G#2 G#2 E2 E2 G#2 G#2 E2 E2' },
  { eighth: 3, loop: 0, lead: 'G5:1 G5:1 G5:1 C6:6 B5:1 C6:6', bass: 'C3:2 E3:2 G3:2 C3:8' },
  { eighth: 4, loop: 0, lead: 'G4:2 F#4:2 F4:2 E4:3 D#4:3 D4:8', bass: 'C3:4 B2:4 A#2:4 A2:8' },
];
const SFX = {
  shoot: [2.0, 1.6], hit: [1.2, 0.8], kill: [0.6, 0.9, 1.4], hurt: [0.4, 0.3, 0.25, 0.2], pill: [1.0, 1.26, 1.5, 2.0],
  heart: [1.5, 2.0], big: [0.3, 0.4, 0.5, 0.7, 1.0, 1.4, 2.0, 2.8], boss: [0.35, 0.3, 0.35, 0.3, 0.25], ready: [2.0, 2.5, 3.0],
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
  const NK = 8, NB = 9, NE = 10, NS = H / STRIP, HALF = H / 2;
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

  const src = `// GENERATED by superpenisman/gen.mjs: edit that, not this file.
// SUPER PENIS MAN: one game step per 'tick' (20 Hz) while 'seated'; picture at 10 fps (two ticks a frame).

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in big: bool
@left in fire: bool

const W = ${W}
const H = ${H}
const NK = ${NK}
const NB = ${NB}
const NE = ${NE}
const BGCITY = ${A(bgCity())}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const KSPR = ${A(KSPR)}
const KW = ${A(KW)}
const KH = ${A(KH)}
const KSP = ${AF(KSP)}
const KHP = ${A(KHP)}
const KSC = ${A(KSC)}
const BOSS = ${A(BOSS)}
const BHP = ${A(BHP)}
const GOAL = ${A(GOAL)}
const LVMSG = ${AS(LVMSG)}
const BINTRO = ${AS(BINTRO)}
const BDEFEAT = ${AS(BDEFEAT)}
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

var state: int = -1         // -1 off, 0 title, 1 flying (boss when bossOn), 3 level clear, 4 victory, 5 game over
var stT: int = 0
var t: int = 0
var day: int = 1
var lv: int = 1
var score: int = 0
var hi: int = 0
var hp: int = 5
var inv: int = 0
var pow: int = 1
var bigM: int = 0
var bigT: int = 0
var fireT: int = 0
var hx: float = 6.0
var hy: float = 16.0
var dist: float = 0.0
var spawnT: float = 0.0
var bossOn: bool = false
var bossX: float = 48.0
var bossY: float = 12.0
var bossV: float = 0.3
var bossHp: int = 0
var bossMax: int = 1
var bossT: int = 0
var bossF: int = 0
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
var kvy: float[] = ${zeros(NK, '0.0')}
var khp: int[] = ${zeros(NK)}
var ba: int[] = ${zeros(NB)}
var bx: float[] = ${zeros(NB, '0.0')}
var by: float[] = ${zeros(NB, '0.0')}
var bdy: float[] = ${zeros(NB, '0.0')}
var ea: int[] = ${zeros(NE)}
var ex: float[] = ${zeros(NE, '0.0')}
var ey: float[] = ${zeros(NE, '0.0')}
var evx: float[] = ${zeros(NE, '0.0')}
var evy: float[] = ${zeros(NE, '0.0')}
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
@right out title_: string = if state == 0 then "SUPER PENIS MAN" else ""
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
mod track(x: int, y: int, w: int, h: int) {
  rx.push(x)
  ry.push(y)
  rw.push(w)
  rh.push(h)
}
mod drawSpr(s: int, x: int, y: int, white: int) {
  let w = SW[s]
  let o = SOFF[s]
  for j in 0..w * SH[s] {
    let c = SPR[o + j]
    if c >= 0 { put(x + j % w, y + j / w, if white > 0 then 6 else c) }
  }
  track(x, y, w, SH[s])
}
mod fillRect(x: int, y: int, w: int, h: int, c: int) {
  for j in 0..w * h { put(x + j % w, y + j / w, c) }
  track(x, y, w, h)
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
mod setScene() {
  bg.copyFrom(BGCITY)
  fb.copyFrom(bg)
  for i in 0..H { dirty[i] = 1 }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
}
mod draw() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  let fx: int = floor(hx)
  let fy: int = floor(hy)
  if state == 0 {
    drawSpr(if (t / 6) % 2 == 0 then ${S.hero} else ${S.hero2}, 19, 13 + (t / 10) % 2, 0)
  } else {
    if bigT > 0 { fillRect(fx + 9, fy + 1, ${W} - fx - 9, 3, if bigT % 4 < 2 then 4 else 6) }
    for k in 0..NK {
      if kt[k] > 0 { drawSpr(KSPR[kt[k]], floor(kx[k]), floor(ky[k]), 0) }
    }
    for i in 0..NB {
      if ba[i] > 0 { drawSpr(${S.beam}, floor(bx[i]), floor(by[i]), 0) }
    }
    for i in 0..NE {
      if ea[i] > 0 { drawSpr(${S.ebul}, floor(ex[i]), floor(ey[i]), 0) }
    }
    if bossOn { drawSpr(BOSS[lv - 1], floor(bossX), floor(bossY), if bossF > 0 then 1 else 0) }
    if state != 5 && (inv == 0 || t % 4 < 2) {
      drawSpr(if (t / 4) % 2 == 0 then ${S.hero} else ${S.hero2}, fx, fy, 0)
    }
    for i in 0..5 { put(1 + i * 2, 0, if i < hp then 5 else 11) }
    for i in 0..3 { put(13 + i * 2, 0, if i < pow then 7 else 11) }
    let bm: int = bigM * 16 / 100
    for i in 0..16 { put(31 + i, 0, if i < bm then (if bigM >= 100 && t % 8 < 4 then 6 else 4) else 11) }
    if bossOn {
      let hb: int = bossHp * ${W - 2} / bossMax
      for i in 0..${W - 2} { put(1 + i, 1, if i < hb then 12 else 11) }
    } else {
      let prog: int = min(${W - 2}, floor(dist / GOAL[lv - 1] * ${W - 2}.0))
      for i in 0..${W - 2} { put(1 + i, 1, if i < prog then 9 else 11) }
    }
  }
}
mod encode(r0: int, r1: int) {
  for r in r0..r1 {
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

// ---------- spawning
mod clearAll() {
  for k in 0..NK { kt[k] = 0 }
  for i in 0..NB { ba[i] = 0 }
  for i in 0..NE { ea[i] = 0 }
}
mod spawnEnemy(kind: int, y: float) {
  let k = kt.find(0)
  if k >= 0 {
    kt[k] = kind
    kx[k] = ${W}.0
    ky[k] = y
    kvy[k] = if Random(0, 1) == 0 then 0.35 else -0.35
    khp[k] = KHP[kind]
  }
}
mod spawnEB(x: float, y: float, vx: float, vy: float) {
  let i = ea.find(0)
  if i >= 0 {
    ea[i] = 1
    ex[i] = x
    ey[i] = y
    evx[i] = vx
    evy[i] = vy
  }
}
mod shoot(dy: float) {
  let i = ba.find(0)
  if i >= 0 {
    ba[i] = 1
    bx[i] = hx + 9.0
    by[i] = hy + 2.0
    bdy[i] = dy
  }
}

// ---------- damage
mod hurt() {
  if inv == 0 && bigT == 0 {
    hp -= 1
    inv = 40
    sfx(${FX.hurt})
    if pow > 1 { pow -= 1 }
    if hp <= 0 {
      state = 5
      stT = 0
      if score > hi { hi = score }
      playSong(4)
      say("Super Penis Man has gone soft. SPACE retry", 100000)
    } else { say("OUCH. Stiffness " .. hp .. "/5", 25) }
  }
}
mod kill(k: int) {
  let kind = kt[k]
  score += KSC[kind] * lv
  if bigM < 100 {
    bigM = min(100, bigM + 8)
    if bigM >= 100 {
      sfx(${FX.ready})
      say("THE BIG ONE is ready! SPACE!", 40)
    } else { sfx(${FX.kill}) }
  } else { sfx(${FX.kill}) }
  let r = Random(0, 11)
  kt[k] = if r == 0 then 4 else (if r == 1 && hp < 5 then 5 else 0)
}
mod levelClear() {
  bossOn = false
  clearAll()
  state = 3
  stT = 0
  score += 1000 * lv
  if score > hi { hi = score }
  playSong(3)
  say(BDEFEAT[lv - 1] .. " +" .. 1000 * lv, 100000)
}
mod bossHit(n: int) {
  bossHp -= n
  bossF = 3
  sfx(${FX.hit})
  if bossHp <= 0 { levelClear() }
}

// ---------- levels
mod startLevel() {
  state = 1
  stT = 0
  setScene()
  clearAll()
  bossOn = false
  dist = 0.0
  spawnT = 30.0
  hx = 6.0
  hy = 16.0
  inv = 30
  playSong(1)
  say("DAY " .. day .. " - " .. LVMSG[lv - 1], 90)
}
mod startBoss() {
  bossOn = true
  bossX = ${W}.0
  bossY = 12.0
  bossV = 0.25 + lv * 0.08 + day * 0.04
  bossHp = BHP[lv - 1] + (day - 1) * 10
  bossMax = bossHp
  bossT = 0
  playSong(2)
  sfx(${FX.boss})
  say(BINTRO[lv - 1], 90)
}
mod newGame() {
  day = 1
  lv = 1
  score = 0
  hp = 5
  pow = 1
  bigM = 0
  startLevel()
}

mod flyTick() {
  // the hero
  let sp = 0.7
  if kL { hx = hx - sp }
  if kR { hx = hx + sp }
  if kU { hy = hy - sp }
  if kD { hy = hy + sp }
  hx = max(0.0, min(30.0, hx))
  hy = max(3.0, min(29.0, hy))
  if inv > 0 { inv -= 1 }
  if fireT > 0 { fireT -= 1 }
  if kS && fireT == 0 {
    shoot(0.0)
    if pow >= 2 {
      shoot(-0.3)
      shoot(0.3)
    }
    fireT = if pow >= 3 then 4 else 6
    if fxId < 0 { sfx(${FX.shoot}) }
  }
  if kJ && !pJ && bigM >= 100 {
    bigM = 0
    bigT = 24
    sfx(${FX.big})
    say("THE BIG ONE!!!", 30)
    for k in 0..NK {
      if kt[k] > 0 && kt[k] < 4 { kill(k) }
    }
    for i in 0..NE { ea[i] = 0 }
    if bossOn { bossHit(8) }
  }
  if bigT > 0 { bigT -= 1 }
  if bossF > 0 { bossF -= 1 }

  // the level scrolls on until the boss
  if !bossOn && state == 1 {
    dist = dist + 1.0
    spawnT = spawnT - 1.0
    if spawnT <= 0.0 {
      let r = Random(0, 9)
      let y: float = Random(3, 28) * 1.0
      if r < 4 + (if lv == 1 then 3 else 0) { spawnEnemy(1, y) }
      else if r < 7 && lv >= 2 { spawnEnemy(2, y) }
      else if lv >= 2 || r < 9 { spawnEnemy(3, y) }
      else { spawnEnemy(1, y) }
      if Random(0, 2) == 0 { spawnEnemy(1, max(3.0, min(28.0, y + 6.0))) }
      spawnT = Random(14, 30) * 1.0 - lv * 2.0 - day * 2.0
    }
    if dist >= GOAL[lv - 1] { startBoss() }
  }

  // enemies
  for k in 0..NK {
    let kind = kt[k]
    if kind > 0 {
      kx[k] = kx[k] - KSP[kind] - day * 0.05
      if kind == 1 {
        ky[k] = ky[k] + kvy[k]
        if ky[k] < 3.0 || ky[k] > 28.0 { kvy[k] = 0.0 - kvy[k] }
      } else if kind == 3 {
        ky[k] = ky[k] + (if ky[k] < hy then 0.2 else -0.2)
      } else if kind == 2 && kx[k] < 46.0 && Random(0, 45) == 0 {
        spawnEB(kx[k] - 2.0, ky[k] + 2.0, -1.0, 0.0)
      }
      if kx[k] < -6.0 { kt[k] = 0 }
      else if overlap(hx + 2.0, hy + 1.0, 7.0, 3.0, kx[k], ky[k], KW[kind], KH[kind]) {
        if kind == 4 {
          kt[k] = 0
          pow = min(3, pow + 1)
          score += 500
          sfx(${FX.pill})
          say("STIFFNESS PILL! Power up. See a doctor after 4 hours.", 40)
        } else if kind == 5 {
          kt[k] = 0
          hp = min(5, hp + 1)
          sfx(${FX.heart})
          say("+1 STIFFNESS", 25)
        } else {
          kt[k] = 0
          hurt()
        }
      }
    }
  }

  // laser vision
  for i in 0..NB {
    if ba[i] > 0 {
      bx[i] = bx[i] + 1.6
      by[i] = by[i] + bdy[i]
      if bx[i] > ${W}.0 || by[i] < 2.0 || by[i] > 33.0 { ba[i] = 0 }
      else {
        for k in 0..NK {
          let kind = kt[k]
          if ba[i] > 0 && kind > 0 && kind < 4 && overlap(bx[i], by[i], 2.0, 1.0, kx[k], ky[k], KW[kind], KH[kind]) {
            ba[i] = 0
            khp[k] -= 1
            if khp[k] <= 0 { kill(k) } else { sfx(${FX.hit}) }
          }
        }
        if ba[i] > 0 && bossOn && overlap(bx[i], by[i], 2.0, 1.0, bossX, bossY, SW[BOSS[lv - 1]], SH[BOSS[lv - 1]]) {
          ba[i] = 0
          bossHit(1)
        }
      }
    }
  }

  // enemy shots
  for i in 0..NE {
    if ea[i] > 0 {
      ex[i] = ex[i] + evx[i]
      ey[i] = ey[i] + evy[i]
      if ex[i] < -2.0 || ey[i] < 2.0 || ey[i] > 34.0 { ea[i] = 0 }
      else if overlap(hx + 2.0, hy + 1.0, 7.0, 3.0, ex[i], ey[i], 2.0, 1.0) {
        ea[i] = 0
        hurt()
      }
    }
  }

  // the boss
  if bossOn && state == 1 {
    let bw = SW[BOSS[lv - 1]]
    let bh = SH[BOSS[lv - 1]]
    if bossX > ${W - 2}.0 - bw { bossX = bossX - 0.3 }
    bossY = bossY + bossV
    if bossY < 3.0 || bossY > 33.0 - bh { bossV = 0.0 - bossV }
    bossT += 1
    if bossT % (34 - lv * 4 - min(day, 4) * 2) == 0 {
      let cy = bossY + bh / 2.0
      let aim = max(-0.6, min(0.6, (hy + 2.0 - cy) / max(4.0, (bossX - hx) / 0.9)))
      spawnEB(bossX - 2.0, cy, -0.9, aim)
      if lv >= 2 {
        spawnEB(bossX - 2.0, cy, -0.9, aim - 0.3)
        spawnEB(bossX - 2.0, cy, -0.9, aim + 0.3)
      }
    }
    if overlap(hx + 2.0, hy + 1.0, 7.0, 3.0, bossX, bossY, bw, bh) { hurt() }
  }
}

// ---------- power
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  setScene()
  clearAll()
  bossOn = false
  playSong(0)
  say("SPACE start. He's hard on crime. W A S D fly, E lasers.", 100000)
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
on ChatCommand("spm", "SPM debug: /spm <keys o(sit) l r u d j s> | /spm dump | /spm boss | /spm big") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "boss" { dist = GOAL[lv - 1] * 1.0 }
  else if args == "big" { bigM = 100 }
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
    kJ = big || dbk.Contains("j")
    kS = fire || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("spdbg|" .. t .. "|" .. state .. "|lv " .. lv .. "|dist " .. dist .. "|hx " .. hx .. " hy " .. hy .. "|score " .. score .. " hp " .. hp .. " pow " .. pow .. " big " .. bigM .. "|boss " .. bossOn .. " " .. bossHp .. "|k " .. kt.join(",") .. "|" .. msg) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("sprow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = big
    kS = fire`}
    t += 1
    stT += 1
    if state == 0 {
      if stT > 10 && ((kJ && !pJ) || (kS && !pS)) {
        newGame()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      flyTick()
    } else if state == 3 {
      if stT > 90 {
        if lv < 3 {
          lv += 1
          startLevel()
        } else {
          state = 4
          stT = 0
          say("WANGTOWN IS SAFE. The key to the city is shaped like you. SPACE", 100000)
        }
      }
    } else if state == 4 {
      if stT > 30 && kJ && !pJ {
        day += 1
        lv = 1
        startLevel()
        pJ = true
      }
    } else if state == 5 {
      if stT > 30 && kJ && !pJ {
        newGame()
        pJ = true
      }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then ("HARD ON CRIME SINCE 1987. HI " .. hi)
      else ("SCORE " .. score .. "  STIFF " .. hp .. "  POW " .. pow .. "  BIG " .. bigM .. "%  DAY " .. day .. "-" .. lv)
    audio()
    if t % 2 == 0 {
      draw()
      encode(0, ${HALF})
    } else {
      encode(${HALF}, H)
    }
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}
