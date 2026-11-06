// dvi/gen.mjs: DANIEL VS ISIS (owner renderman 2026-11-05: "a new game with the new engine called daniel vs isis", then
// "full colorset full fleshed out sprites and music"). Pure-wire row engine of pong/wgen.mjs (240x160 at 10x10 pixels a
// micro brick; a changed row is rebuilt from the coloured spans of the objects on it, only touched strips re-joined).
// Colour: every span carries a palette index and is drawn as <color="hex">███</>; sprites are pixel art below, turned
// into per-row span tables at build time. Cartoon and generic: Daniel (left, W/S, Space shoots) vs masked goons with
// BLANK black flags walking in from the right; one past the dashed line = -1 life, 3 lives. Music loops on a second
// synth voice while a round is on; effects on the first. Space starts a round; leaving the seat = idle.
// v3 (owner: 3 bosses, smoke cigarettes zelda style, pierogi for health, rescue the 5 uncles of truth, beat neo saddam):
// HP 5; 3 stages of 12 goons, each ends in a boss (THE MANAGER, COLONEL CRUMB, NEO SADDAM: original cartoon art, bob +
// fire red bolts); bosses free 1/2/2 Uncles of Truth, all 5 + Neo Saddam down = win; pickups drift in: pierogi +2 HP,
// cigarette = 8 s of rapid double fire with a cigarette in Daniel's mouth. Boss loop music during boss fights.
export const W = 240, H = 160, STRIP = 20;
export const PAL = ['101828']; // night blue background (panel colour); black sprite parts stay visible on it

// palette: char -> hex. '.' = transparent
const COL = { h: '5a3a1a', s: 'f0c090', e: '202020', b: '3070d0', p: '203060', k: '101010', g: '909090', w: 'ffffff',
  d: '404048', o: '556b2f', q: 'a07040', f: '0a0a0a', y: 'ffd040', n: '6b4a2a', l: '8090a0', t: 'c0c8d0',
  r: 'b01818', v: '4a5a2a', z: 'd0a020', c: 'e8c878', i: 'ff6a10', a: 'c0b090', u: 'ff3030' };
// boss template (24 x 28): A hat/hair, B face, C body, D detail, z trim, E legs; each boss recolours it
const BOSS_ART = [
  '......AAAAAAAAAA........',
  '....AAAAAAAAAAAAAA......',
  '....AAAAAAAAAAAAAA......',
  '.....BBBBBBBBBBBB.......',
  '.....BkkkkBBkkkkB.......',
  '.....BBBBBBBBBBBB.......',
  '.....BBhhhhhhhhBB.......',
  '.....BBBhhhhhhBBB.......',
  '......BBBBBBBBBB........',
  '...CCCCCCCCCCCCCCCC.....',
  '..CCCzCCCCCCCCCCzCCC....',
  '.CCCCCCCCCCCCCCCCCCCC...',
  'gCCCCCCDDCCCCDDCCCCCC...',
  'ggCCCCCDDCCCCDDCCCCCC...',
  '.CCCCCCCCCCCCCCCCCCCC...',
  '.CCCCCCCCCCCCCCCCCCCC...',
  '..CCCCCCCCCCCCCCCCCC....',
  '..CCCCCCCCCCCCCCCCCC....',
  '...CCCCCCCCCCCCCCCC.....',
  '...EEEEEEEEEEEEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....',
  '..kkkkkkk....kkkkkkk....',
  '..kkkkkkk....kkkkkkk....',
];
const recolor = map => BOSS_ART.map(l => l.replace(/[ABCDE]/g, ch => map[ch]));
const SPRITES = {
  daniel: [ // 13 x 16, facing right, gun forward
    '...hhhh......',
    '..hhhhhh.....',
    '..hssssh.....',
    '..sseses.....',
    '..ssssss.....',
    '...ssss......',
    '..bbbbbb.....',
    '.bbbbbbbsggg.',
    'sbbbbbbbbggg.',
    '.bbbbbbbb....',
    '..bbbbbb.....',
    '..pppppp.....',
    '..pp..pp.....',
    '..pp..pp.....',
    '..pp..pp.....',
    '.kkk..kkk....',
  ],
  goon: [ // 17 x 20, facing left, blank black flag on a pole
    '.........qfffffff',
    '.........qfffffff',
    '.........qfffffff',
    '.........qfffffff',
    '.........q.......',
    '...kkkk..q.......',
    '..kkkkkk.q.......',
    '..kwkkwk.q.......',
    '..kkkkkk.q.......',
    '...kkkk..q.......',
    '..dddddd.q.......',
    '.ddddddddq.......',
    'gddddddddq.......',
    '.dddddddd........',
    '..dddddd.........',
    '..oooooo.........',
    '..oo..oo.........',
    '..oo..oo.........',
    '..oo..oo.........',
    '.kkk..kkk........',
  ],
  bullet: ['yyyy', 'yyyy'],
  ebullet: ['uuu', 'uuu'],
  pierogi: ['..cccc..', '.cccccc.', 'cccccccc', '.c.c.c.c'],
  cigarette: ['.....l.l', '......l.', 'wwwwwwii'],
  // 3 bosses (cartoon, original): THE MANAGER (grey suit, red tie), COLONEL CRUMB (khaki, gold), NEO SADDAM (red beret,
  // shades, moustache, olive uniform with gold medals)
  boss0: recolor({ A: 'h', B: 's', C: 'd', D: 'r', E: 'p' }),
  boss1: recolor({ A: 'o', B: 's', C: 'o', D: 'z', E: 'n' }),
  boss2: recolor({ A: 'r', B: 's', C: 'v', D: 'z', E: 'v' }),
  smoke: ['ii', '.l', 'l.'], // cigarette in Daniel's mouth while powered up
};
const CKEYS = Object.keys(COL);
// per-row coloured spans of every sprite, flattened: sprite k row j -> SI[ROWBASE[k] + j] .. SI[ROWBASE[k] + j + 1]
function spriteTables() {
  const SI = [0], SS = [], SE = [], SC = [], ROWBASE = {};
  let rowsSoFar = 0;
  for (const [name, art] of Object.entries(SPRITES)) {
    ROWBASE[name] = rowsSoFar;
    for (const line of art) {
      for (let x = 0; x < line.length;) {
        const c = line[x];
        if (c === '.') { x++; continue; }
        let e = x; while (e < line.length && line[e] === c) e++;
        SS.push(x); SE.push(e); SC.push(CKEYS.indexOf(c)); x = e;
      }
      SI.push(SS.length); rowsSoFar++;
    }
  }
  return { SI, SS, SE, SC, ROWBASE };
}

export function generate({ debug = false } = {}) {
  const NS = H / STRIP, q = JSON.stringify;
  const strips = Array.from({ length: NS }, (_, k) => k);
  const T = spriteTables();
  const DX = 6, DH = 16;                  // Daniel x, height (sprite 13 wide)
  const GH = 20, BODY = 5;                // goon sprite height; body (hitbox) starts 5 rows down, x 0..10
  const BH = 28, BW = 21, BX = W - 30;    // boss sprite height, body width, x
  const LINE = 24, GROUND = H - 5, PUB = 3; // PUB: show a frame every 3 ticks (~6.7 fps), all strips at once
  const KILLS = 12, HPMAX = 5;            // goons a stage before its boss; Daniel's health
  const BOSS_HP = [15, 25, 40], FREED = [1, 2, 2]; // boss health; Uncles of Truth freed by each boss (5 in all)
  const BOSS_NAME = ['THE MANAGER', 'COLONEL CRUMB', 'NEO SADDAM'];
  if (T.SI.length - 1 !== Object.values(SPRITES).reduce((n, a) => n + a.length, 0) || T.SC.some(c => c < 0)) throw Error('self-check: sprite tables');
  if (FREED.reduce((a, b) => a + b) !== 5) throw Error('self-check: five uncles');
  const N = { C: 1, D: 1.122, E: 1.26, F: 1.335, G: 1.498, A: 1.682, B: 1.888, c: 2, _: 0 };
  const MUS = 'EEG_A_GE D_DE G_E_ EEG_A_cA G_ED C___'.replace(/ /g, '').split('').map(ch => N[ch]);
  const BMUS = 'C_C_D_C_ E_E_D_C_ C_C_D_C_ G_E_D___'.replace(/ /g, '').split('').map(ch => N[ch] * 0.75); // boss fight loop
  const RB = T.ROWBASE;
  const src = `// GENERATED by dvi/gen.mjs: edit that, not this file.
@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in ba: bool
@left in bb: bool

const SP = ${q(' '.repeat(W))}
const BL = ${q('█'.repeat(W))}
const COLS = [${CKEYS.map(k => q(`<color="${COL[k]}">`)).join(', ')}]
const SI = [${T.SI.join(', ')}]
const SS = [${T.SS.join(', ')}]
const SE = [${T.SE.join(', ')}]
const SC = [${T.SC.join(', ')}]
const BGT = ${q(`<color="${PAL[0]}">`)}
const MUS = [${MUS.join(', ')}]
const BMUS = [${BMUS.join(', ')}]
const BRB = [${RB.boss0}, ${RB.boss1}, ${RB.boss2}]
const BHP = [${BOSS_HP.join(', ')}]
const FREE = [${FREED.join(', ')}]
const BNAME = [${BOSS_NAME.map(q).join(', ')}]

var rows: string[]
var dfl: int[]
var dl: int[]
var sdf: int[]
var gx: float[]
var gy: float[]
var ux: float[]
var uy: float[]
var ex: float[]
var ey: float[]
var kx: float[]
var ky: float[]
var kt2: int[]
var is: float[]
var ie: float[]
var ic: float[]
${strips.map(k => `var st${k}: string = ""\nvar pb${k}: string = ""`).join('\n')}
var pubT: int = 0
var pubDirty: bool = false
var hudv: string = ""
var titlev: string = "DANIEL VS ISIS"
var py: float = ${H / 2 - DH / 2}.0
var opy: float = -1.0
var score: int = 0
var best: int = 0
var hp: int = ${HPMAX}
var stage: int = 0
var kills: int = 0
var bossOn: bool = false
var bossHP: int = 0
var bossY: float = 40.0
var bossV: float = 2.0
var uncles: int = 0
var smokeUntil: float = 0.0
var msgUntil: float = 0.0
var over: int = 0
var won: bool = false
var waiting: bool = false
var lastBa: bool = false
var was: bool = false
var forced: bool = false
var kt: float = 1.0
var lastT: float = 0.0
var nextSpawn: float = 0.0
var nextShot: float = 0.0
var nextBossShot: float = 0.0
var nextPick: float = 0.0
var s: string = ""
var cur: float = 0.0
var mel: float[]
var melPos: int = 0
var musT: int = 0
var aP0: float = 1.0
var aV0: float = 0.0
var aP1: float = 1.0
var aV1: float = 0.0

${strips.map(k => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = "W/S move  SPACE shoot  pierogi heal  cigarettes rapid fire"
@right out hud_: string = hudv
@right out title_: string = titlev
@right out P0: float = aP0
@right out V0: float = aV0
@right out P1: float = aP1
@right out V1: float = aV1

mod setStrip(k: int, v: string) {
${strips.map(k => `  if k == ${k} { pb${k} = v }`).join('\n')}
  pubDirty = true
}
// "fake multithreading" (owner: the image rips across the bars): the game renders every tick into the pb* back
// buffers; the shown strips are swapped in together every ${PUB} ticks
mod publish() {
${strips.map(k => `  st${k} = pb${k}`).join('\n')}
  pubDirty = false
}
mod mark(r: int) {
  if r >= 0 && r < ${H} {
    if dfl.get(r) == 0 {
      dfl[r] = 1
      dl.push(r)
    }
  }
}
mod markSpan(y: float, h: int) {
  let y0 = floor(y)
  for k in 0..h { mark(y0 + k) }
}
mod spr(rb: int, j: int, x0: float) {
  for t in SI[rb + j]..SI[rb + j + 1] {
    is.push(x0 + SS[t])
    ie.push(x0 + SE[t])
    ic.push(SC[t])
  }
}
mod span(a: float, b: float, c: int) {
  is.push(a)
  ie.push(b)
  ic.push(c)
}
mod note(p: float, n: int) {
  for k in 0..n { mel.push(p) }
}
mod tune(a: float, b: float, c: float) {
  mel.resize(0, 0.0)
  melPos = 0
  note(a, 2)
  note(b, 2)
  note(c, 4)
}
mod flash(t: string) {
  titlev = t
  msgUntil = ServerUptime() + 2.5
}
mod clearAll() {
  for i in 0..gx.length() { markSpan(gy.get(i), ${GH}) }
  for i in 0..ux.length() { markSpan(uy.get(i), 2) }
  for i in 0..ex.length() { markSpan(ey.get(i), 2) }
  for i in 0..kx.length() { markSpan(ky.get(i), 4) }
  markSpan(bossY, ${BH})
  gx.resize(0, 0.0)
  gy.resize(0, 0.0)
  ux.resize(0, 0.0)
  uy.resize(0, 0.0)
  ex.resize(0, 0.0)
  ey.resize(0, 0.0)
  kx.resize(0, 0.0)
  ky.resize(0, 0.0)
  kt2.resize(0, 0)
  bossOn = false
}
mod reset() {
  clearAll()
  score = 0
  hp = ${HPMAX}
  stage = 0
  kills = 0
  uncles = 0
  smokeUntil = 0.0
  over = 0
  won = false
  markSpan(py - 3.0, ${DH + 3})
  py = ${H / 2 - DH / 2}.0
  markSpan(py - 3.0, ${DH + 3})
  nextSpawn = ServerUptime() + 1.0
  nextPick = ServerUptime() + 6.0
  musT = 0
}
mod hurt() {
  hp -= 1
  tune(1.0, 0.84, 0.7)
}
mod renderRow(r: int) {
  is.resize(0, 0.0)
  ie.resize(0, 0.0)
  ic.resize(0, 0.0)
  let dy0 = floor(py)
  if r >= dy0 && r < dy0 + ${DH} { spr(${RB.daniel}, r - dy0, ${DX}.0) }
  // the cigarette while powered up: in the mouth, smoke curling above
  if smokeUntil > lastT && r >= dy0 - 3 && r < dy0 && waiting == false { spr(${RB.smoke}, r - dy0 + 3, ${DX + 7}.0) }
  if smokeUntil > lastT && r == dy0 + 3 { span(${DX + 8}.0, ${DX + 10}.0, ${CKEYS.indexOf('w')}) }
  for i in 0..gx.length() {
    let x0 = floor(gx.get(i))
    let y0 = floor(gy.get(i))
    if x0 > -50.0 && r >= y0 && r < y0 + ${GH} { spr(${RB.goon}, r - y0, x0) }
  }
  if bossOn {
    let b0 = floor(bossY)
    if r >= b0 && r < b0 + ${BH} { spr(BRB[stage], r - b0, ${BX}.0) }
  }
  for i in 0..kx.length() {
    let y0 = floor(ky.get(i))
    if kx.get(i) > -50.0 && r >= y0 && r < y0 + 4 {
      if kt2.get(i) == 0 { spr(${RB.pierogi}, r - y0, floor(kx.get(i))) } else { if r < y0 + 3 { spr(${RB.cigarette}, r - y0, floor(kx.get(i))) } }
    }
  }
  for i in 0..ux.length() {
    let y0 = floor(uy.get(i))
    if ux.get(i) < ${W}.0 && r >= y0 && r < y0 + 2 { spr(${RB.bullet}, r - y0, floor(ux.get(i))) }
  }
  for i in 0..ex.length() {
    let y0 = floor(ey.get(i))
    if ex.get(i) > -50.0 && r >= y0 && r < y0 + 2 { spr(${RB.ebullet}, r - y0, floor(ex.get(i))) }
  }
  if r < 2 { span(0.0, ${W}.0, ${CKEYS.indexOf('l')}) }
  if r >= ${GROUND} { span(0.0, ${W}.0, ${CKEYS.indexOf('n')}) }
  if r >= 2 && r < ${GROUND} && r % 6 < 3 { span(${LINE - 1}.0, ${LINE}.0, ${CKEYS.indexOf('t')}) }
  is.sortMultiple(ie, ic)
  s = ""
  cur = 0.0
  for j in 0..is.length() {
    let a = max(max(is.get(j), cur), 0.0)
    let b = min(ie.get(j), ${W}.0)
    if b > a {
      if a > cur { s = s .. BGT .. BL.Substring(0, a - cur) .. "</>" }
      s = s .. COLS[ic.get(j)] .. BL.Substring(0, b - a) .. "</>"
      cur = b
    }
  }
  // gaps are background-coloured blocks, not spaces (owner: "vertical desync")
  if cur < ${W}.0 { s = s .. BGT .. BL.Substring(0, ${W}.0 - cur) .. "</>" }
  rows[r] = s
  sdf[r / ${STRIP}] = 1
}
mod fireAt(y: float) {
  var slot: int = -1
  slot = -1
  for i in 0..ux.length() { if ux.get(i) >= ${W}.0 { slot = i } }
  if slot < 0 {
    ux.push(${DX + 12}.0)
    uy.push(y)
  } else {
    ux[slot] = ${DX + 12}.0
    uy[slot] = y
  }
}
mod step() {
  let now = ServerUptime()
  kt = min(max((now - lastT) * 10.0, 0.0), 2.5)
  lastT = now
  if melPos < mel.length() {
    aP0 = max(mel.get(melPos), 0.1)
    aV0 = if mel.get(melPos) > 0.0 then 0.5 else 0.0
    melPos += 1
  } else { aV0 = 0.0 }
  if msgUntil > 0.0 && now >= msgUntil && waiting == false {
    titlev = ""
    msgUntil = 0.0
  }
  if waiting {
    aV1 = 0.0
    if ba && lastBa == false {
      waiting = false
      titlev = ""
      if over > 0 { reset() }
    }
  } else {
    // music: the march, or the boss loop during a boss
    var m: float = 0.0
    if bossOn { m = BMUS[(musT / 3) % ${BMUS.length}] } else { m = MUS[(musT / 3) % ${MUS.length}] }
    aP1 = max(m * 0.5, 0.1)
    aV1 = if m > 0.0 then 0.25 else 0.0
    musT += 1
    if up { py -= 6.0 * kt }
    if down { py += 6.0 * kt }
    py = min(max(py, 5.0), ${GROUND - DH}.0)
    if py != opy {
      markSpan(opy - 3.0, ${DH + 3})
      markSpan(py - 3.0, ${DH + 3})
      opy = py
    }
    // shooting: 3 a second; smoking = 8 a second, two bullets (Zelda-style item)
    let powered = smokeUntil > now
    if ba && now >= nextShot {
      nextShot = now + (if powered then 0.12 else 0.3)
      fireAt(py + 7.0)
      if powered { fireAt(py + 11.0) }
      aP0 = 2.0
      aV0 = 0.3
    }
    if smokeUntil > 0.0 && now >= smokeUntil {
      smokeUntil = 0.0
      markSpan(py - 3.0, ${DH + 3})
    }
    // goons until the stage's kill count, then the boss
    if bossOn == false && now >= nextSpawn {
      nextSpawn = now + max(0.6, 2.0 - stage * 0.4 - kills * 0.04)
      let y = Random(3.0, ${GROUND - GH}.0)
      var gs: int = -1
      gs = -1
      for i in 0..gx.length() { if gx.get(i) <= -50.0 { gs = i } }
      if gs < 0 {
        gx.push(${W}.0)
        gy.push(y)
      } else {
        gx[gs] = ${W}.0
        gy[gs] = y
      }
    }
    // pickups: pierogi (heal 2) or a cigarette (8 s rapid double fire)
    if now >= nextPick {
      nextPick = now + Random(5.0, 9.0)
      kx.push(${W}.0)
      ky.push(Random(8.0, ${GROUND - 6}.0))
      kt2.push(if Random(0.0, 1.0) < 0.65 then 0 else 1)
    }
    let gsp = (1.2 + stage * 0.4 + kills * 0.03) * kt
    for i in 0..gx.length() {
      if gx.get(i) > -50.0 {
        markSpan(gy.get(i), ${GH})
        gx[i] = gx.get(i) - gsp
        if gx.get(i) < ${LINE}.0 {
          gx[i] = -100.0
          hurt()
        }
      }
    }
    for i in 0..kx.length() {
      if kx.get(i) > -50.0 {
        markSpan(ky.get(i), 4)
        kx[i] = kx.get(i) - 1.5 * kt
        if kx.get(i) < ${DX + 12}.0 && kx.get(i) + 8.0 > ${DX}.0 && ky.get(i) + 4.0 > py && ky.get(i) < py + ${DH}.0 {
          if kt2.get(i) == 0 {
            hp = min(hp + 2, ${HPMAX})
            flash("PIEROGI! +2")
            tune(1.5, 1.68, 2.0)
          } else {
            smokeUntil = now + 8.0
            flash("A CIGARETTE. YOU FEEL DANGEROUS.")
            tune(1.12, 1.0, 1.5)
          }
          kx[i] = -100.0
          markSpan(py - 3.0, ${DH + 3})
        }
        if kx.get(i) < 0.0 { kx[i] = -100.0 }
        markSpan(ky.get(i), 4)
      }
    }
    // boss: bobs up and down, fires red bolts, takes hits on its body
    if bossOn {
      markSpan(bossY, ${BH})
      bossY = bossY + bossV * kt
      if bossY < 4.0 || bossY > ${GROUND - BH}.0 { bossV = 0.0 - bossV }
      bossY = min(max(bossY, 4.0), ${GROUND - BH}.0)
      markSpan(bossY, ${BH})
      if now >= nextBossShot {
        nextBossShot = now + max(0.45, 1.3 - stage * 0.35)
        ex.push(${BX}.0)
        ey.push(bossY + 12.0)
      }
    }
    for i in 0..ex.length() {
      if ex.get(i) > -50.0 {
        markSpan(ey.get(i), 2)
        ex[i] = ex.get(i) - (6.0 + stage * 1.5) * kt
        if ex.get(i) < ${DX + 10}.0 && ex.get(i) + 3.0 > ${DX}.0 && ey.get(i) + 2.0 > py && ey.get(i) < py + ${DH}.0 {
          ex[i] = -100.0
          hurt()
        }
        if ex.get(i) < 0.0 { ex[i] = -100.0 }
        markSpan(ey.get(i), 2)
      }
    }
    for b in 0..ux.length() {
      if ux.get(b) < ${W}.0 {
        markSpan(uy.get(b), 2)
        ux[b] = ux.get(b) + 12.0 * kt
        for i in 0..gx.length() {
          if gx.get(i) > -50.0 && ux.get(b) + 4.0 > gx.get(i) && ux.get(b) < gx.get(i) + 10.0 && uy.get(b) + 2.0 > gy.get(i) + ${BODY}.0 && uy.get(b) < gy.get(i) + ${GH}.0 {
            markSpan(gy.get(i), ${GH})
            gx[i] = -100.0
            ux[b] = ${W}.0
            score += 1
            kills += 1
            tune(1.26, 1.5, 2.0)
          }
        }
        if bossOn && ux.get(b) + 4.0 > ${BX}.0 && uy.get(b) + 2.0 > bossY + 3.0 && uy.get(b) < bossY + ${BH}.0 {
          ux[b] = ${W}.0
          bossHP -= 1
          score += 2
          aP0 = 0.6
          aV0 = 0.4
          if bossHP <= 0 {
            // boss down: free its uncles; after the third, the game is won
            markSpan(bossY, ${BH})
            bossOn = false
            uncles += FREE[stage]
            score += 25
            stage += 1
            kills = 0
            nextSpawn = now + 2.0
            if stage >= 3 {
              won = true
              over = 1
              waiting = true
              clearAll()
              if score > best { best = score }
              titlev = "ALL 5 UNCLES OF TRUTH FREED. NEO SADDAM IS DONE."
              mel.resize(0, 0.0)
              melPos = 0
              note(1.5, 3)
              note(1.68, 3)
              note(2.0, 3)
              note(0.0, 1)
              note(2.0, 3)
              note(2.24, 12)
            } else {
              flash("UNCLE OF TRUTH FREED! (\${uncles}/5)")
              tune(1.5, 2.0, 2.5)
            }
          }
        }
        if ux.get(b) < ${W}.0 { markSpan(uy.get(b), 2) }
      }
    }
    for i in 0..gx.length() { if gx.get(i) > -50.0 { markSpan(gy.get(i), ${GH}) } }
    // enough goons: clear the field, the stage boss walks in
    if bossOn == false && won == false && kills >= ${KILLS} {
      for i in 0..gx.length() {
        if gx.get(i) > -50.0 { markSpan(gy.get(i), ${GH}) }
        gx[i] = -100.0
      }
      bossOn = true
      bossHP = BHP[stage]
      bossY = 40.0
      nextBossShot = now + 1.5
      flash("BOSS: \${BNAME[stage]}")
      markSpan(bossY, ${BH})
    }
    if hp <= 0 && won == false {
      if score > best { best = score }
      over = 1
      waiting = true
      clearAll()
      tune(0.9, 0.75, 0.6)
    }
  }
  lastBa = ba
  if waiting {
    if won { hudv = "YOU WIN  SCORE \${score}  BEST \${best}  -  SPACE" } else { if over > 0 { hudv = "GAME OVER  SCORE \${score}  UNCLES \${uncles}/5  -  SPACE" } else { hudv = "SPACE TO START  BEST \${best}" } }
  } else {
    if bossOn { hudv = "HP \${hp}/${HPMAX}  \${BNAME[stage]} \${bossHP}  UNCLES \${uncles}/5  SCORE \${score}" } else { hudv = "HP \${hp}/${HPMAX}  STAGE \${stage + 1}  GOONS \${kills}/${KILLS}  UNCLES \${uncles}/5  SCORE \${score}" }
  }
}
mod idle() {
  if was {
    was = false
    gx.resize(0, 0.0)
    gy.resize(0, 0.0)
    ux.resize(0, 0.0)
    uy.resize(0, 0.0)
    ex.resize(0, 0.0)
    ey.resize(0, 0.0)
    kx.resize(0, 0.0)
    ky.resize(0, 0.0)
    kt2.resize(0, 0)
    bossOn = false
    dl.resize(0, 0)
    dfl.fill(0)
    over = 0
    score = 0
    hudv = ""
    aV0 = 0.0
    aV1 = 0.0
    titlev = "DANIEL VS ISIS"
    msgUntil = 0.0
    mel.resize(0, 0.0)
    melPos = 0
${strips.map(k => `    st${k} = ""\n    pb${k} = ""`).join('\n')}
  }
}
mod flush() {
  for j in 0..dl.length() {
    let r = dl.get(j)
    dfl[r] = 0
    renderRow(r)
  }
  dl.resize(0, 0)
  for k in 0..${NS} {
    if sdf.get(k) == 1 {
      sdf[k] = 0
      var acc: string = ""
      acc = ""
      for j in 0..${STRIP} {
        if j < ${STRIP - 1} { acc = acc .. rows.get(k * ${STRIP} + j) .. "\\n" } else { acc = acc .. rows.get(k * ${STRIP} + j) }
      }
      setStrip(k, acc)
    }
  }
}

${debug ? `on ChatCommand("dvdump", "print the strips") -> (ctrl, args) {
${strips.map(k => `  PrintToConsole("dvrow|${k}|" .. st${k})`).join('\n')}
  PrintToConsole("dvhud|" .. hudv)
}
on ChatCommand("dvsit", "debug: play as if seated (toggle)") -> (ctrl, args) {
  forced = forced == false
}
on ChatCommand("dvgo", "debug: start the round (as Space)") -> (ctrl, args) {
  waiting = false
  titlev = ""
  if over > 0 { reset() }
}
on ChatCommand("dvboss", "debug: skip to the stage boss") -> (ctrl, args) {
  kills = ${KILLS}
}
` : ''}on tick {
  if seated || forced {
    if was == false {
      was = true
      rows.resize(${H}, "")
      dfl.resize(${H}, 0)
      sdf.resize(${NS}, 0)
      reset()
      waiting = true
      lastT = ServerUptime()
      for r in 0..${H} { mark(r) }
    }
    step()
    flush()
    pubT += 1
    if pubDirty && pubT % ${PUB} == 0 { publish() }
  } else {
    idle()
  }
}
on Change(seated) {
  if seated == false && forced == false { idle() }
}
`;
  return { src, W, H, STRIP, PAL, clockWhenSeated: !debug, titleMid: true, titleLH: 3, exactScreen: true, synths: ['Square', 'Triangle'] };
}
