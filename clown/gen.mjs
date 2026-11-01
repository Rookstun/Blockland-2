// clown/gen.mjs: CRACK CLOWN, a side-scrolling beat em up in one microchip (wirescript, Super Sigmas
// engine: W x H block framebuffer, dirty rows -> text strips). Original game: the clown runs right on his own,
// SPACE / W jumps, E / LMB bites (rips a person in half, eats them). Fat people take two bites. Dead people may
// drop crack; 3 crack = HIGH (fast, invulnerable, wide jaws, double points). Spikes hurt, hearts heal.
//   inputs: tick, seated, left right up down, big (Space/RMB = jump), fire (LMB/E = bite); outputs strip0..8, msg_, hud_, title_, P/V 0..2

export const W = 48, H = 36, STRIP = 4;
export const PAL = ['0b0820', '1c2050', 'f4a6b0', 'c86478', 'f8d040', 'd02828', 'f4f4f4', '3a6ae0',
  '1c2a80', '48c048', '50506a', '2a2a3a', 'a040d0', 'f08020', '101010', 'ffd8e0'];

const pad = r => '....' + r + '....';
const mir = r => [...r].reverse().join('');
const C7 = {
  hero: ['dd...dd', '.ddddd.', '.6e6e6.', '.66566.', '.65556.', '.66466.', '2222222', '.2...2.', '.55.55.'],
  hero2: ['dd...dd', '.ddddd.', '.6e6e6.', '.66566.', '.65556.', '.66466.', '2222222', '..2.2..', '..5.5..'],
  rip: ['dd...dd', '.ddddd.', '.6e6e6.', '.65556.', '.5eee5.', '.66466.', '2222222', '.2...2.', '.55.55.'],
};
// the M16: stock/handle on the shoulder side, barrel pointing right, muzzle flash when firing
const gun = (rows, flash) => rows.map(pad).map((r, i) =>
  i === 5 ? r.slice(0, 11) + '.66' + (flash ? '4' : '.') : i === 6 ? r.slice(0, 11) + '666' + (flash ? '4' : '6') : r);
const CL = { hero: gun(C7.hero, 0), hero2: gun(C7.hero2, 0), rip: gun(C7.rip, 0), heroP: gun(C7.hero, 1) };
const SPRITES = {
  hero: CL.hero, heroL: CL.hero.map(mir), hero2: CL.hero2, hero2L: CL.hero2.map(mir),
  heroP: CL.heroP, heroPL: CL.heroP.map(mir), rip: CL.rip, ripL: CL.rip.map(mir),
  thug: ['ccccc', 'c2e2c', '.222.', '97779', '.777.', '.8.8.', '.8.8.', '.e.e.'],
  big: ['.22222.', '.2e2e2.', '.22222.', '7777777', '7777777', '7777777', '.77.77.', '.ee.ee.'],
  mayor: ['.2222222.', '.2e222e2.', '.2222222.', '.2255522.', '888888888', '888888888', '888888888', '888888888', '.88...88.', '.88...88.', '.ee...ee.'],
  vial: ['.6.', '6f6', '.6.'],
  heart: ['.f.', '666', '666'],
  gib: ['53', '35'],
  bul: ['44'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));
// kinds (kt): 1 thug 2 big guy 3 crack 4 heart 5 the mayor (boss every 5th wave)
const KSPR = [0, S.thug, S.big, S.vial, S.heart, S.mayor];
const KHP = [0, 3, 6, 0, 0, 30];
const STAGEMSG = [
  'THE CARNIVAL. Everyone here is snack-shaped.',
  'THE MALL. Security guards. Chewy ones.',
  'CITY HALL. The mayor is full of crack.',
  'THE AFTERLIFE. Still hungry.',
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


function bgRoad() {
  const b = bgCity();
  for (let y = 22; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = y === 22 ? 10 : 11;
  return b;

}

// music (original): 0 title fanfare, 1 flight, 2 boss, 3 level clear, 4 going soft
const SONGS = [
  { eighth: 3, loop: 1, lead: 'G4:1 C5:1 E5:1 G5:3 E5:2 G5:8 | A5:2 G5:2 F5:2 E5:2 D5:4 R:4',
    bass: 'C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 | F2:2 C3:2 F2:2 C3:2 G2:2 D3:2 G2:2 D3:2' },
  // gameplay: Primus-ish, 7/8 bouncy bass riff (D), chromatic walk-down on bar 4, nasal square lead
  { eighth: 3, loop: 1,
    lead: 'A4:2 R:1 G4:1 A4:1 C5:2 | D5:2 R:1 C5:1 A4:1 G4:2 | A#4:2 R:1 A4:1 G4:1 A#4:2 | E5:1 D#5:1 D5:1 C#5:1 C5:1 B4:1 A4:1',
    bass: 'D2:1 D3:1 R:1 D3:1 F3:1 E3:1 D3:1 | D2:1 D3:1 R:1 D3:1 A2:1 C3:1 D3:1 | G2:1 G3:1 R:1 G3:1 A#3:1 A3:1 G3:1 | A2:1 A3:1 G#3:1 G3:1 F#3:1 F3:1 E3:1' },
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
  const NK = 10, NG = 10, NB = 8, NS = H / STRIP, HALF = H / 2;
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) throw Error(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  const KW = KSPR.map((x, i) => i ? sw[x] : 0), KH = KSPR.map((x, i) => i ? sh[x] : 0);
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);


  const src = `// GENERATED by clown/gen.mjs: edit that, not this file.
// CRACK CLOWN: one game step per 'tick' (20 Hz) while 'seated'; picture at 10 fps (two ticks a frame).

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
const NG = ${NG}
const NB = ${NB}
const BGROAD = ${A(bgRoad())}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const KSPR = ${A(KSPR)}
const KW = ${A(KW)}
const KH = ${A(KH)}
const KHP = ${A(KHP)}
const STAGEMSG = ${AS(STAGEMSG)}
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

var state: int = -1         // -1 off, 0 title, 1 fighting, 3 wave clear, 5 game over
var stT: int = 0
var t: int = 0
var score: int = 0
var hi: int = 0
var hp: int = 5
var inv: int = 0
var crack: int = 0
var cookM: int = 0
var near: bool = false
var kills: int = 0
var wave: int = 1
var waveTot: int = 1
var toSpawn: int = 0
var alive: int = 0
var spawnT: float = 0.0
var pcd: int = 0
var punchT: int = 0
var eatT: int = 0
var fc: int = 1
var moving: bool = false
var hx: float = 10.0
var hf: float = 30.0
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
var khp: int[] = ${zeros(NK)}
var kst: int[] = ${zeros(NK)}
var kcd: int[] = ${zeros(NK)}
var ga: int[] = ${zeros(NG)}
var gx: float[] = ${zeros(NG, '0.0')}
var gy: float[] = ${zeros(NG, '0.0')}
var gfl: float[] = ${zeros(NG, '0.0')}
var gvx: float[] = ${zeros(NG, '0.0')}
var gvy: float[] = ${zeros(NG, '0.0')}
var bt: int[] = ${zeros(NB)}
var bx: float[] = ${zeros(NB, '0.0')}
var bf: float[] = ${zeros(NB, '0.0')}
var bvx: float[] = ${zeros(NB, '0.0')}
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
@right out title_: string = if state == 0 then "CRACK CLOWN" else ""
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
  bg.copyFrom(BGROAD)
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
  let hfy: int = floor(hf)
  if state == 0 {
    drawSpr(if (t / 6) % 2 == 0 then ${S.hero} else ${S.hero2}, 17, 13 + (t / 10) % 2, 0)
  } else {
    for k in 0..NK {
      if kt[k] > 0 && ky[k] < hf { drawSpr(KSPR[kt[k]], floor(kx[k]), floor(ky[k]) - KH[kt[k]], if kst[k] > 0 then 1 else 0) }
    }
    if state != 5 && (inv == 0 || t % 4 < 2) {
      drawSpr((if eatT > 0 then ${S.rip} else (if punchT > 0 then ${S.heroP} else (if moving && (t / 4) % 2 == 1 then ${S.hero2} else ${S.hero}))) + (if fc < 0 then 1 else 0), fx, hfy - 9, 0)
    }
    for k in 0..NK {
      if kt[k] > 0 && ky[k] >= hf { drawSpr(KSPR[kt[k]], floor(kx[k]), floor(ky[k]) - KH[kt[k]], if kst[k] > 0 then 1 else 0) }
    }
    for g in 0..NG {
      if ga[g] > 0 { drawSpr(${S.gib}, floor(gx[g]), floor(gy[g]), 0) }
    }
    for i in 0..NB {
      if bt[i] > 0 { drawSpr(${S.bul}, floor(bx[i]), floor(bf[i]) - 5, 0) }
    }
    for i in 0..5 { put(1 + i * 2, 0, if i < hp then 5 else 11) }
    for i in 0..5 { put(13 + i * 2, 0, if i < crack then 6 else 11) }
    let cb: int = min(100, cookM) * 16 / 100
    for i in 0..16 { put(1 + i, 2, if cookM > 0 && i < cb then 13 else bg[2 * ${W} + 1 + i]) }
    let rem: int = toSpawn + alive
    let prog: int = (waveTot - rem) * ${W - 2} / max(1, waveTot)
    for i in 0..${W - 2} { put(1 + i, 1, if i < prog then 9 else 11) }
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
mod ab(x: float) -> float {
  return max(x, 0.0 - x)
}
mod clearAll() {
  for k in 0..NK { kt[k] = 0 }
  for i in 0..NG { ga[i] = 0 }
  for i in 0..NB { bt[i] = 0 }
}
mod spawnFoe(kind: int) {
  let k = kt.find(0)
  if k >= 0 {
    kt[k] = kind
    kx[k] = if Random(0, 1) == 0 then ${W}.0 else -9.0
    ky[k] = 25.0 + Random(0, 9) * 1.0
    khp[k] = KHP[kind]
    kst[k] = 0
    kcd[k] = 30
  }
}
mod spawnPickup(kind: int, x: float, y: float) {
  let v = kt.find(0)
  if v >= 0 {
    kt[v] = kind
    kx[v] = x
    ky[v] = y
    kcd[v] = 300
    kst[v] = 0
  }
}
mod spawnGibs(x: float, f: float, n: int) {
  for j in 0..n {
    let i = ga.find(0)
    if i >= 0 {
      ga[i] = 1
      gx[i] = x + j * 1.0
      gy[i] = f - 5.0
      gfl[i] = f
      gvx[i] = (j * 1.0 - n * 0.5) * 0.3
      gvy[i] = 0.0 - 0.9 - Random(0, 6) * 0.1
    }
  }
}

// ---------- damage
mod hurt(d: int) {
  if inv == 0 {
    hp -= d
    inv = 30
    sfx(${FX.hurt})
    if hp <= 0 {
      hp = 0
      state = 5
      stT = 0
      if score > hi { hi = score }
      playSong(4)
      say("The clown is dead. SPACE retry", 100000)
    } else { say("OW. Honks left " .. hp .. "/5", 25) }
  }
}
mod killFoe(k: int, rip: bool) {
  let kind = kt[k]
  score += (if kind == 1 then 100 else (if kind == 2 then 250 else 1000)) * (if rip then 2 else 1)
  spawnGibs(kx[k], ky[k], if rip then 6 else 3)
  sfx(${FX.kill})
  kills += 1
  let px = kx[k]
  let py = ky[k]
  kt[k] = 0
  if rip {
    eatT = 10
    hp = min(5, hp + 1)
    say(if kills % 2 == 0 then "RIPPED IN HALF. *munch*" else "tastes like chicken", 25)
  }
  let r = Random(0, 5)
  if r < 2 { spawnPickup(3, px, py) }
  else if r == 2 { spawnPickup(4, px, py) }
}

mod startWave() {
  waveTot = min(14, 3 + wave * 2) + (if wave % 5 == 0 then 1 else 0)
  toSpawn = waveTot
  spawnT = 20.0
  alive = 0
  say("WAVE " .. wave .. " - " .. STAGEMSG[min(3, (wave - 1) / 3)], 90)
}
mod newGame() {
  state = 1
  stT = 0
  setScene()
  clearAll()
  score = 0
  hp = 5
  crack = 1
  cookM = 0
  kills = 0
  wave = 1
  hx = 10.0
  hf = 30.0
  fc = 1
  inv = 30
  pcd = 0
  punchT = 0
  eatT = 0
  playSong(1)
  startWave()
}

mod playTick() {
  if inv > 0 { inv -= 1 }
  if pcd > 0 { pcd -= 1 }
  if punchT > 0 { punchT -= 1 }
  if eatT > 0 { eatT -= 1 }
  moving = kL || kR || kU || kD
  if kL {
    hx = hx - 0.7
    fc = -1
  }
  if kR {
    hx = hx + 0.7
    fc = 1
  }
  if kU { hf = hf - 0.45 }
  if kD { hf = hf + 0.45 }
  hx = max(0.0, min(33.0, hx))
  hf = max(25.0, min(34.0, hf))

  // M16 (E / LMB, hold)
  if kS && pcd == 0 {
    let b = bt.find(0)
    if b >= 0 {
      pcd = 3
      punchT = 2
      bt[b] = 1
      bx[b] = hx + 7.5 + fc * 8.0
      bf[b] = hf
      bvx[b] = fc * 2.4
      if fxId < 0 { sfx(${FX.shoot}) }
    }
  }
  for i in 0..NB {
    if bt[i] > 0 {
      bx[i] = bx[i] + bvx[i]
      if bx[i] < -2.0 || bx[i] > ${W}.0 { bt[i] = 0 }
      else {
        for k in 0..NK {
          let kind = kt[k]
          if bt[i] > 0 && kind > 0 && kind != 3 && kind != 4 && bx[i] >= kx[k] && bx[i] <= kx[k] + KW[kind] && ab(ky[k] - bf[i]) < 3.0 {
            bt[i] = 0
            khp[k] -= 1
            kst[k] = 2
            if khp[k] <= 0 { killFoe(k, false) } else if fxId < 0 { sfx(${FX.hit}) }
          }
        }
      }
    }
  }
  // Space / RMB: rips whoever is in the jaws (costs a crack), otherwise MASH it to cook crack
  if cookM > 0 { cookM = max(0, cookM - 1) }
  near = false
  for k in 0..NK {
    let kind = kt[k]
    if kind > 0 && kind != 3 && kind != 4 {
      let fdx = (kx[k] + KW[kind] * 0.5 - (hx + 7.5)) * fc
      if fdx > -3.0 && fdx < 19.0 && ab(ky[k] - hf) < 4.0 { near = true }
    }
  }
  if kJ && !pJ {
    if crack > 0 && near {
      crack -= 1
      sfx(${FX.big})
      eatT = 10
      for k in 0..NK {
        let kind = kt[k]
        if kind > 0 && kind != 3 && kind != 4 {
          let fdx = (kx[k] + KW[kind] * 0.5 - (hx + 7.5)) * fc
          if fdx > -3.0 && fdx < 19.0 && ab(ky[k] - hf) < 4.0 {
            if kind == 5 {
              khp[k] -= 10
              kst[k] = 12
              if khp[k] <= 0 { killFoe(k, true) }
            } else { killFoe(k, true) }
          }
        }
      }
    } else {
      cookM += 12
      if cookM >= 100 {
        cookM = 0
        crack = min(5, crack + 1)
        sfx(${FX.pill})
        say("COOKED 1 CRACK", 25)
      } else {
        if fxId < 0 { sfx(${FX.hit}) }
        say("COOKING... KEEP SPAMMING " .. cookM .. "%", 10)
      }
    }
  }

  // spawns
  spawnT = spawnT - 1.0
  if spawnT <= 0.0 && toSpawn > 0 && alive < 4 {
    spawnFoe(if toSpawn == 1 && wave % 5 == 0 then 5 else (if Random(0, 99) < min(45, wave * 8) then 2 else 1))
    toSpawn -= 1
    spawnT = 50.0 - min(30, wave * 3) * 1.0
  }

  // foes and pickups
  alive = 0
  for k in 0..NK {
    let kind = kt[k]
    if kind > 0 {
      if kind == 3 || kind == 4 {
        kcd[k] -= 1
        if kcd[k] <= 0 { kt[k] = 0 }
        else if ab(kx[k] + 1.0 - (hx + 7.5)) < 6.0 && ab(ky[k] - hf) < 3.0 {
          if kind == 3 {
            crack = min(5, crack + 1)
            score += 50
            sfx(${FX.pill})
            say("CRACK +1. SPACE rips.", 25)
          } else {
            hp = min(5, hp + 1)
            sfx(${FX.heart})
            say("+1 HONK (milk)", 20)
          }
          kt[k] = 0
        }
      } else {
        alive += 1
        if kst[k] > 0 { kst[k] -= 1 } else {
          let dx = hx + 7.5 - (kx[k] + KW[kind] * 0.5)
          let dy = hf - ky[k]
          let sp = if kind == 1 then 0.22 else (if kind == 2 then 0.14 else 0.1)
          if ab(dx) > 7.0 { kx[k] = kx[k] + (if dx > 0.0 then sp else 0.0 - sp) }
          if ab(dy) > 1.0 { ky[k] = ky[k] + (if dy > 0.0 then 0.12 else -0.12) }
          if kcd[k] > 0 { kcd[k] -= 1 }
          else if ab(dx) <= 8.0 && ab(dy) < 2.5 {
            kcd[k] = if kind == 1 then 40 else 55
            hurt(if kind == 1 then 1 else 2)
          }
        }
      }
    }
  }

  // gore: lands as a stain
  for g in 0..NG {
    if ga[g] > 0 {
      gvy[g] = gvy[g] + 0.15
      gx[g] = gx[g] + gvx[g]
      gy[g] = gy[g] + gvy[g]
      if gy[g] >= gfl[g] {
        let ix: int = floor(gx[g])
        let iy: int = floor(gfl[g])
        if ix >= 0 && ix < ${W} {
          bg[iy * ${W} + ix] = 5
          put(ix, iy, 5)
        }
        ga[g] = 0
      } else if gx[g] < -2.0 || gx[g] > ${W}.0 { ga[g] = 0 }
    }
  }

  // wave done
  if state == 1 && toSpawn == 0 && alive == 0 {
    state = 3
    stT = 0
    score += 200 * wave
    playSong(3)
    say("WAVE " .. wave .. " CLEARED! +" .. 200 * wave, 100000)
  }
}

// ---------- power
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  setScene()
  clearAll()
  playSong(0)
  say("SPACE start. WASD move, E M16. SPAM SPACE to cook crack, SPACE near someone rips.", 100000)
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
on ChatCommand("spm", "CLOWN debug: /spm <keys o(sit) l r u d j s> | /spm dump | /spm crack") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "crack" { crack = 5 }
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
    if t % 20 == 0 { PrintToConsole("spdbg|" .. t .. "|" .. state .. "|wave " .. wave .. " left " .. toSpawn .. " alive " .. alive .. "|hx " .. hx .. " hf " .. hf .. "|score " .. score .. " hp " .. hp .. " crack " .. crack .. " kills " .. kills .. "|k " .. kt.join(",") .. "|" .. msg) }
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
      playTick()
    } else if state == 3 {
      if stT > 80 {
        wave += 1
        state = 1
        stT = 0
        startWave()
        playSong(if wave % 5 == 0 then 2 else 1)
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
    hud = if state == 0 then ("RIP. EAT. CRACK. HI " .. hi)
      else ("SCORE " .. score .. "  HONK " .. hp .. "  CRACK " .. crack .. "  WAVE " .. wave .. "  RIPPED " .. kills)
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
