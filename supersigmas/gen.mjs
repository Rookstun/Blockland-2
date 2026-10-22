// supersigmas/gen.mjs: SUPER SIGMAS, an arcade brawler in one microchip (wirescript). Mog alphas with your stare,
// looksmax (dumbbells, mewing crowns, skincare), rizz Stacys before an alpha walks off with them. Gigachad every 4th wave.
//   inputs  (@left): tick (exec, one frame per pulse, 20 Hz), seated (bool: the game only runs while someone sits;
//           standing up blanks the screen and stops the music), left right up down rizz mog (bool)
//   outputs (@right): strip0..strip8 (4 rows each of the W x H picture as coloured block text), msg_, hud_, title_,
//           P0/V0 lead, P1/V1 bass, P2/V2 sfx (synth speaker pitch / volume), state_
//   node supersigmas/gen.mjs -> supersigmas/supersigmas.gen.ws (also run by build.mjs)

import { midiSong, SONG_FILES } from './midisong.mjs';

export const W = 48, H = 36, STRIP = 4;
export const PAL = ['0d0a14', '2a1f3d', '4a2f6b', '1c1c24', 'f8d040', '5a5a66', '3e3e48', 'f4f4f4',
  'e03838', 'f8c0a0', '3868d8', '101010', 'f878c8', '78e8f8', '48c048', '8c5a30'];

// sprites: rows of palette hex digits, '.' = transparent, drawn facing right (mirrored for left)
const SPRITES = {
  sig0: ['.bbb', '.9bb', '.999', 'aaaa', '9aa9', '.aa.', '.b.b'],
  sig1: ['.bbb', '.9bb', '.999', 'aaaa', '9aa9', '.aa.', 'b.b.'],
  sigM: ['.bbb', '.9dd', '.999', 'aaaa', '.aa9', '.aa.', '.b.b'],
  alpha0: ['.fff.', '.999.', '.9b9.', '88888', '98889', '98889', '.888.', '.b.b.'],
  alpha1: ['.fff.', '.999.', '.9b9.', '88888', '98889', '98889', '.888.', 'b...b'],
  beta0: ['.f.', '.9.', '666', '6.6'],
  beta1: ['.f.', '.9.', '666', '.6.'],
  giga0: ['..bbb..', '.bbbbb.', '.99999.', '.9b9b9.', '.99999.', '9999999', '7777777', '9777779', '9777779', '.b...b.'],
  giga1: ['..bbb..', '.bbbbb.', '.99999.', '.9b9b9.', '.99999.', '9999999', '7777777', '9777779', '9777779', '..b.b..'],
  stacy0: ['.ff.', 'f99f', 'f99f', '.cc.', 'cccc', '.cc.', '.9.9'],
  stacy1: ['.ff.', 'f99f', 'f99f', '.cc.', 'cccc', '.cc.', '9.9.'],
  bell: ['5.5', '555', '5.5'],
  crown: ['4.4.4', '44444'],
  skin: ['.7.', 'ccc', 'ccc'],
  heart: ['c.c', 'ccc', '.c.'],
  puff: ['7.7', '.7.', '7.7'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));
// entity kinds (kt): 1 alpha, 2 beta (fleeing), 3 gigachad, 4 stacy, 5 dumbbell, 6 mewing crown, 7 skincare, 8 heart fx, 9 puff
const KSPR = [0, S.alpha0, S.beta0, S.giga0, S.stacy0, S.bell, S.crown, S.skin, S.heart, S.puff];
const KANIM = [0, 1, 1, 1, 1, 0, 0, 0, 0, 0];

// music: 0 title = overtonight - mirrors demo, 1 gameplay (bosses too) = Clovis Reyes - Fluxxwave (Looksmaxxing)
// (the owner's MIDIs, midisong.mjs), 2 game over jingle (original). "E5:2" = E5 for 2 eighths, R = rest
const SONGS = [
  { loop: 1, voices: midiSong(SONG_FILES.mirrors) },
  { loop: 1, voices: midiSong(SONG_FILES.fluxx) },
  { eighth: 4, loop: 0, lead: 'E5:2 D5:2 C5:2 B4:6', bass: 'A2:4 G2:4 E2:6' },
];
const SFX = {
  mog: [2.5, 2.0, 1.6, 1.2], rizz: [1.0, 1.26, 1.5, 2.0, 2.5, 3.0], ew: [0.5, 0.45, 0.4, 0.35], hurt: [0.7, 0.5, 0.35, 0.25],
  pick: [2.0, 2.5, 3.0], beta: [0.8, 0.6, 0.4, 0.3, 0.2], wave: [1.0, 1.5, 2.0, 1.5, 2.0, 3.0], boss: [0.2, 0.22, 0.2, 0.18, 0.2, 0.16],
  up: [1.0, 1.26, 1.5, 2.0, 2.0, 2.0],
};
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));

const RIZZ = ["W rizz. She said 'ok sigma'.", 'Unspoken rizz. Nobody spoke.', 'Rizzed. She followed you back.',
  'Rizz +. The alphas are seething.', 'She laughed at your joke. It was bad.'];
const MOGS = ['MOGGED. He is now a beta.', 'Mogged so hard he started mewing.', 'His jawline filed for bankruptcy.', 'Frame mogged. He shrank.'];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NAMES.indexOf(m[1]) + 12 * (+m[2] + 1); };
const parseVoice = (s, e) => s.split(/\s+/).filter(t => t && t !== '|').map(tok => { const [n, d = '1'] = tok.split(':'); return [n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * e)]; });

// the street: HUD rows 0-1, night skyline 2-11, curb 12, sidewalk 13-35
function background() {
  let s = 1234567;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bg = Array(W * H).fill(0);
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) bg[y * W + x] = c; };
  for (let y = 2; y < 12; y++) for (let x = 0; x < W; x++) set(x, y, y < 7 ? 1 : 2);
  for (const [x, y] of [[5, 3], [17, 2], [29, 4], [41, 3], [11, 5], [35, 2]]) set(x, y, 7);
  for (let y = 2; y < 5; y++) for (let x = 38; x < 41; x++) if (!(y === 2 && x !== 39)) set(x, y, 4); // moon
  for (let x = 0; x < W;) {
    const bw = 4 + Math.floor(rnd() * 4), top = 5 + Math.floor(rnd() * 5);
    for (let y = top; y < 12; y++) for (let i = 0; i < bw && x + i < W; i++)
      set(x + i, y, (i > 0 && i < bw - 1 && y > top && (y - top) % 2 === 1 && rnd() < 0.45) ? 4 : 3);
    x += bw + (rnd() < 0.3 ? 1 : 0);
  }
  for (let x = 0; x < W; x++) set(x, 12, 6);
  for (let y = 13; y < H; y++) for (let x = 0; x < W; x++) set(x, y, (x % 8 === 0 || (y - 13) % 8 === 0) ? 6 : 5);
  return bg;
}

const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false } = {}) {
  const NK = 10, NS = H / STRIP;
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) throw Error(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  const KW = KSPR.map((s, i) => i ? sw[s] : 0), KH = KSPR.map((s, i) => i ? sh[s] : 0);
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = s.voices ? s.voices[v] : parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);

  const src = `// GENERATED by supersigmas/gen.mjs: edit that, not this file.
// SUPER SIGMAS: one frame per 'tick' pulse (20 Hz) while 'seated' is true. Standing up blanks the screen.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in rizz: bool
@left in mog: bool

const W = ${W}
const H = ${H}
const NK = ${NK}
const BGPIX = ${A(background())}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const KSPR = ${A(KSPR)}
const KANIM = ${A(KANIM)}
const KW = ${A(KW)}
const KH = ${A(KH)}
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
const RIZZMSG = ${AS(RIZZ)}
const MOGMSG = ${AS(MOGS)}

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

var state: int = -1         // -1 off (nobody seated), 0 title, 1 playing, 2 mogged (game over)
var stT: int = 0
var t: int = 0
var px: float = 22.0
var py: float = 20.0
var face: int = 1
var walking: bool = false
var aura: int = 5
var inv: int = 0
var lxp: int = 0
var score: int = 0
var hi: int = 0
var combo: int = 1
var mogs: int = 0
var wave: int = 1
var bossWave: int = 0
var beamT: int = 0
var mogCd: int = 0
var spawnT: int = 0
var stacyT: int = 0
var rizzN: int = 0
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
var khp: int[] = ${zeros(NK)}
var ktm: int[] = ${zeros(NK)}
var kfl: int[] = ${zeros(NK)}
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
@right out title_: string = if state == 0 then "SUPER SIGMAS" else ""
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
mod looks() -> int {
  return min(5, 1 + floor(lxp / 3.0))
}
mod overlap(ax: float, ay: float, aw: float, ah: float, bx0: float, by0: float, bw: float, bh: float) -> bool {
  return ax < bx0 + bw && bx0 < ax + aw && ay < by0 + bh && by0 < ay + ah
}
mod spawn(ty: int, x: float, y: float, vx: float) {
  let k = kt.find(0)
  if k >= 0 {
    kt[k] = ty
    kx[k] = x
    ky[k] = y
    kvx[k] = vx
    khp[k] = 0
    ktm[k] = 0
    kfl[k] = 0
  }
}
mod count(ty: int) -> int {
  var n: int = 0
  for k in 0..NK {
    if kt[k] == ty { n += 1 }
  }
  return n
}
mod edgeX(w: int) -> float {
  return if Random(0, 1) == 0 then 0.0 - w else W * 1.0
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

// ---------- game
mod newGame() {
  state = 1
  stT = 0
  px = 22.0
  py = 20.0
  face = 1
  aura = 5
  inv = 0
  lxp = 0
  score = 0
  combo = 1
  mogs = 0
  wave = 1
  bossWave = 0
  beamT = 0
  mogCd = 0
  spawnT = 0
  stacyT = 120
  for k in 0..NK { kt[k] = 0 }
  playSong(1)
  say("Rizz. Mog. Looksmax. Go.", 60)
}
mod hurt(d: int) {
  if inv == 0 && state == 1 {
    aura -= d
    inv = 40
    combo = 1
    px = clamp(px - face * 3.0, 0.0, W - 4.0)
    sfx(${FX.hurt})
    say("You got mogged. -" .. d .. " aura.", 40)
    if aura <= 0 {
      aura = 0
      state = 2
      stT = 0
      if score > hi { hi = score }
      spawn(9, px, py + 2.0, 0.0)
      playSong(2)
      say("MOGGED. Back to mewing.", 100000)
    }
  }
}
mod gainLooks(n: int) {
  let before = looks()
  lxp = min(lxp + n, 12)
  if looks() > before {
    sfx(${FX.up})
    say("LOOKSMAXXED! LOOKS " .. looks(), 50)
  } else { sfx(${FX.pick}) }
}
mod beta(k: int) {
  // an alpha mogged into a beta: shrinks, flees, maybe drops a looksmax item
  kt[k] = 2
  kx[k] = kx[k] + 1.0
  ky[k] = ky[k] + 4.0
  kvx[k] = if kx[k] < px then -0.6 else 0.6
  ktm[k] = 0
  score += 10 * combo
  combo = min(combo + 1, 9)
  mogs += 1
  sfx(${FX.beta})
  say(MOGMSG[mogs % ${MOGS.length}], 40)
  let r = Random(0, 99)
  if r < 18 { spawn(5, kx[k], ky[k] + 1.0, 0.0) }
  else if r < 24 { spawn(6, kx[k] - 1.0, ky[k] + 2.0, 0.0) }
  else if r < 34 { spawn(7, kx[k], ky[k] + 1.0, 0.0) }
  let nw: int = 1 + floor(mogs / 6.0)
  if nw > wave {
    wave = nw
    sfx(${FX.wave})
    say("WAVE " .. wave .. ". More alphas.", 50)
  }
}
mod fireMog() {
  // the stare: a beam from the eyes, longer with LOOKS; hits everything within 2 rows of it
  beamT = 4
  mogCd = 8
  sfx(${FX.mog})
  let len = 6 + looks() * 3
  let bx0: float = if face > 0 then px + 4.0 else px - len
  let by0: float = py - 1.0
  for k in 0..NK {
    let ty = kt[k]
    if (ty == 1 || ty == 3) && overlap(bx0, by0, len, 5.0, kx[k], ky[k], KW[ty], KH[ty]) {
      khp[k] = khp[k] - looks()
      kfl[k] = 3
      if khp[k] <= 0 {
        if ty == 1 { beta(k) }
        else {
          kt[k] = 9
          ktm[k] = 0
          kx[k] = kx[k] + 2.0
          ky[k] = ky[k] + 4.0
          score += 500
          sfx(${FX.rizz})
          say("GIGACHAD MOGGED. +500 RIZZ", 70)
          spawn(6, kx[k], ky[k] + 2.0, 0.0)
        }
      }
    }
  }
}
mod tryRizz() {
  var hit: int = -1
  for k in 0..NK {
    if kt[k] == 4 && overlap(px - 3.0, py - 2.0, 10.0, 11.0, kx[k], ky[k], 4.0, 7.0) { hit = k }
  }
  if hit < 0 {
    say("You rizzed the air. It left.", 30)
    sfx(${FX.ew})
  } else if looks() >= khp[hit] {
    score += 50 * looks() * combo
    rizzN += 1
    sfx(${FX.rizz})
    say(RIZZMSG[rizzN % ${RIZZ.length}], 50)
    let hx = kx[hit]
    let hy = ky[hit]
    kt[hit] = 0
    spawn(8, hx, hy, -0.2)
    spawn(8, hx + 2.0, hy + 2.0, 0.2)
    spawn(8, hx + 1.0, hy - 2.0, 0.0)
    stacyT = 0
  } else {
    sfx(${FX.ew})
    say("She said ew. Needs LOOKS " .. khp[hit] .. ".", 50)
    kvx[hit] = if kx[hit] < px then -0.5 else 0.5
    khp[hit] = 99
    combo = 1
  }
}
mod spawner() {
  spawnT += 1
  let giga = count(3) > 0
  if wave % 4 == 0 && bossWave != wave {
    bossWave = wave
    spawn(3, edgeX(7), 16.0, 0.0)
    khp[kt.find(3)] = 20 + wave * 2
    sfx(${FX.boss})
    say("GIGACHAD has entered the chat.", 70)
  }
  if !giga && spawnT >= max(18, 64 - wave * 5) && count(1) < min(6, 2 + floor(wave / 2.0)) {
    spawnT = 0
    let k = kt.find(0)
    if k >= 0 {
      spawn(1, edgeX(5), Random(10.0, 27.0), 0.0)
      khp[k] = 2 + floor(wave / 2.0)
    }
  }
  stacyT += 1
  if stacyT > 220 && count(4) == 0 {
    stacyT = 0
    let k = kt.find(0)
    if k >= 0 {
      let x = edgeX(4)
      spawn(4, x, Random(12.0, 28.0), if x < 0.0 then 0.15 else -0.15)
      khp[k] = clamp(Random(1, 1 + floor(wave / 2.0)), 1, 5)
      say("A Stacy appeared. Needs LOOKS " .. khp[k] .. ".", 50)
    }
  }
}
mod playerTick() {
  let dx: int = kR - kL
  let dy: int = kD - kU
  walking = dx != 0 || dy != 0
  if dx != 0 { face = dx }
  px = clamp(px + dx * 0.5, 0.0, W - 4.0)
  py = clamp(py + dy * 0.4, 6.0, H - 7.0)
  if inv > 0 { inv -= 1 }
  if beamT > 0 { beamT -= 1 }
  if mogCd > 0 { mogCd -= 1 }
  if kS && !pS && mogCd == 0 { fireMog() }
  if kJ && !pJ { tryRizz() }
}
mod entityTick() {
  // the Stacy alphas go for (if any): only even slots chase her, the rest chase you
  let sk = kt.find(4)
  for k in 0..NK {
    let ty = kt[k]
    if ty > 0 {
      ktm[k] = ktm[k] + 1
      if kfl[k] > 0 { kfl[k] = kfl[k] - 1 }
      if ty == 1 || ty == 3 {
        var tx: float = px
        var ty2: float = py
        if ty == 1 && sk >= 0 && k % 2 == 0 && ktm[sk] > 100 {
          tx = kx[sk]
          ty2 = ky[sk]
        }
        var spd: float = if ty == 1 then 0.12 + wave * 0.02 else 0.1
        if ty == 3 && ktm[k] % 60 > 48 { spd = 0.7 }
        let ddx = tx - kx[k]
        let ddy = ty2 + 7.0 - (ky[k] + KH[ty])
        if abs(ddx) > 0.3 { kx[k] = kx[k] + sign(ddx) * spd }
        if abs(ddy) > 0.3 { ky[k] = ky[k] + sign(ddy) * spd * 0.6 }
        if sk >= 0 && kt[sk] == 4 && overlap(kx[k], ky[k], KW[ty], KH[ty], kx[sk], ky[sk], 4.0, 7.0) {
          kt[sk] = 9
          ktm[sk] = 0
          stacyT = 0
          combo = 1
          sfx(${FX.ew})
          say("Stacy left with an alpha. L.", 50)
        }
        if state == 1 && overlap(px, py, 4.0, 7.0, kx[k], ky[k], KW[ty], KH[ty]) { hurt(if ty == 3 then 2 else 1) }
      } else if ty == 2 || ty == 4 {
        kx[k] = kx[k] + kvx[k]
        if kx[k] < -8.0 || kx[k] > W + 4.0 { kt[k] = 0 }
      } else if ty >= 5 && ty <= 7 {
        if ktm[k] > 300 { kt[k] = 0 }
        else if state == 1 && overlap(px, py, 4.0, 7.0, kx[k], ky[k], KW[ty], KH[ty]) {
          kt[k] = 0
          if ty == 5 {
            gainLooks(1)
            if msgT < 20 { say("Dumbbell. Gains +1.", 30) }
          } else if ty == 6 {
            gainLooks(3)
            if msgT < 40 { say("Mewing crown. Gains +3.", 30) }
          } else {
            aura = min(aura + 2, 5)
            sfx(${FX.pick})
            say("Skincare routine. Aura +2.", 30)
          }
        }
      } else if ty == 8 {
        ky[k] = ky[k] - 0.3
        kx[k] = kx[k] + kvx[k]
        if ktm[k] > 20 { kt[k] = 0 }
      } else if ty == 9 {
        if ktm[k] > 6 { kt[k] = 0 }
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
mod put(cx: int, cy: int, c: int) {
  if cx >= 0 && cx < W && cy >= 0 && cy < H {
    let i = cy * W + cx
    if fb[i] != c {
      fb[i] = c
      dirty[cy] = 1
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
    if c >= 0 { put(x + sx, y + sy, if white > 0 then 7 else c) }
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
mod drawHud() {
  for i in 0..5 {
    put(1 + i * 3, 0, if i < aura then 8 else 6)
    put(2 + i * 3, 0, if i < aura then 8 else 6)
  }
  let lk = looks()
  for i in 0..5 {
    put(W - 15 + i * 3, 0, if i < lk then 4 else 6)
    put(W - 14 + i * 3, 0, if i < lk then 4 else 6)
  }
  let g: int = if lk >= 5 then 14 else (lxp % 3) * 5
  for i in 0..14 { put(W - 15 + i, 1, if i < g then 13 else 0) }
}
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  let a = (t / 4) % 2
  if state == 0 {
    drawSpr(${S.alpha0} + a, 8, 20, 0, 0)
    drawSpr(${S.sigM}, 22, 21, 0, 0)
    drawSpr(${S.stacy0} + a, 36, 21, 1, 0)
  } else {
    for pass in 0..2 {
      for k in 0..NK {
        let ty = kt[k]
        if ty > 0 && (ty >= 5) == (pass == 0) {
          let blink = ty >= 5 && ty <= 7 && ktm[k] > 240 && t % 4 < 2
          if !blink {
            let fl: int = if ty == 2 || ty == 4 then (if kvx[k] < 0.0 then 1 else 0) else (if kx[k] + KW[ty] * 0.5 > px + 2.0 then 1 else 0)
            drawSpr(KSPR[ty] + (if KANIM[ty] > 0 then a else 0), floor(kx[k]), floor(ky[k]), if ty >= 5 then 0 else fl, kfl[k] > 0)
          }
        }
      }
    }
    if state == 1 && (inv == 0 || t % 4 < 2) {
      let ps: int = if beamT > 0 then ${S.sigM} else (if walking then ${S.sig0} + (t / 3) % 2 else ${S.sig0})
      drawSpr(ps, floor(px), floor(py), face < 0, 0)
    }
    if beamT > 0 {
      let len = 6 + looks() * 3
      let bx0: int = if face > 0 then floor(px) + 4 else floor(px) - len
      let by: int = floor(py) + 1
      for i in 0..len { put(bx0 + i, by, if (i + t) % 3 == 0 then 7 else 13) }
      rx.push(bx0)
      ry.push(by)
      rw.push(len)
      rh.push(1)
    }
    drawHud()
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

// ---------- power: the screen runs only while someone sits
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  for k in 0..NK { kt[k] = 0 }
  bg.copyFrom(BGPIX)
  fb.copyFrom(BGPIX)
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  for i in 0..H { dirty[i] = 1 }
  playSong(0)
  say("SPACE start. LMB/E mog, SPACE rizz", 100000)
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
on ChatCommand("ss", "SUPER SIGMAS debug: /ss <keys o(sit) l r u d j s> | /ss dump") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "alpha" {
    let k = kt.find(0)
    spawn(1, px + 7.0, py - 1.0, 0.0)
    khp[k] = 2
  }
  else if args == "stacy" {
    let k = kt.find(0)
    spawn(4, px + 5.0, py, 0.0)
    khp[k] = 1
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
    kJ = rizz || dbk.Contains("j")
    kS = mog || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("ssdbg|" .. t .. "|" .. state .. "|" .. px .. "|" .. py .. "|" .. hud .. "|" .. msg .. "|k " .. kt.join(",") .. " hp " .. khp.join(",") .. " a " .. aV0 .. " " .. aV1 .. " " .. aV2 .. "|len " .. st4.Length()) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("ssrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = rizz
    kS = mog`}
    t += 1
    stT += 1
    if state == 0 {
      if (kJ && !pJ) || (kS && !pS) {
        newGame()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      playerTick()
      spawner()
      entityTick()
    } else if state == 2 {
      entityTick()
      if stT == 40 { say("MOGGED. Rizz " .. score .. ". SPACE = retry", 100000) }
      if stT > 40 && kJ && !pJ { newGame() }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then ("rizz. mog. looksmax. HI " .. hi) else ("RIZZ " .. score .. " x" .. combo .. "  LOOKS " .. looks() .. "  WAVE " .. wave)
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
  const g = generate();
  fs.writeFileSync(new URL('./supersigmas.gen.ws', import.meta.url), g.src);
  console.log('wrote supersigmas.gen.ws', g.src.length, 'chars');
}
