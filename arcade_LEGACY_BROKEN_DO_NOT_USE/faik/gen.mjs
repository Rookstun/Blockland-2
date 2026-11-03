// faik/gen.mjs: FAIK PLATFORMER, a one-screen platformer in Wirescript on the arcade cabinet engine.
//   generate() -> { src, layout, synths, walls }
// Same text-layer screen as pacman: every layer renders the SAME 26 x 56 character grid (2 chars per cell, rows padded
// with no-break spaces): walls (per level, swapped by the chip), coins (patched in place), faik + 4 walkers (one glyph each), message.
// Faik walks (A/D) and jumps (W, 4 cells high, 1 cell per 0.07 s). Collect every coin, then reach the [] exit. Spikes / walkers = lose a life.

export const ROWS = 26, COLS = 28, CW = 2, LINE = COLS * CW;
const NB = ' ', NL = '\n';
const MSG_ROW = 11;
const SOLID = '#', SPIKE = '^';

// levels: platforms [row, c0, c1] (solid cells; faik stands on row-1), spikes [row, c], extra coins [row, c],
// walkers [row, c, dir] (standing row), start [row, c], exit [row, c]
const LEVELS = [
  { name: 'THE LAWN', plats: [[24, 1, 26], [21, 3, 9], [21, 18, 24], [18, 10, 16], [15, 2, 7], [15, 19, 25], [12, 9, 18], [9, 3, 8], [9, 20, 25]],
    spikes: [[23, 8], [23, 9], [23, 20], [23, 21]], extra: [[23, 14], [23, 16]], walkers: [[23, 14, 1], [17, 13, -1], [11, 13, 1]], start: [23, 2], exit: [8, 22] },
  { name: 'THE FRIDGE', plats: [[24, 1, 26], [21, 2, 6], [21, 11, 15], [21, 21, 26], [18, 7, 10], [18, 16, 20], [15, 2, 5], [15, 11, 15], [15, 22, 26], [12, 6, 10], [12, 17, 21], [9, 2, 6], [9, 11, 15], [9, 22, 26]],
    spikes: [[23, 4], [23, 5], [23, 16], [23, 17]], extra: [[23, 9], [23, 13]], walkers: [[23, 20, -1], [14, 13, 1], [8, 13, -1], [20, 13, 1]], start: [23, 2], exit: [8, 24] },
  { name: 'THE PIT', plats: [[24, 1, 4], [24, 23, 26], [21, 6, 9], [21, 14, 17], [18, 10, 12], [18, 19, 22], [15, 3, 7], [15, 14, 17], [15, 24, 26], [12, 9, 12], [12, 19, 22], [9, 3, 7], [9, 13, 16], [9, 23, 26], [6, 8, 11], [6, 18, 21]],
    spikes: [...Array(18)].map((_, i) => [24, 5 + i]), extra: [], walkers: [[20, 15, 1], [14, 15, -1], [8, 14, 1], [11, 20, -1]], start: [23, 2], exit: [5, 20] },
];
const NLV = LEVELS.length;

// glyphs
const FAIK = 'Ö', WALKER = 'Ω', COIN = '●', WALL = '██', SPK = '^^', EXIT = '[]';

const q = s => JSON.stringify(s);
const f = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const arr = (type, xs) => `[${xs.map(type === 'float' ? f : type === 'string' ? q : String).join(', ')}]`;

function build(lv) {
  const g = [...Array(ROWS)].map(() => Array(COLS).fill('.'));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) g[r][c] = SOLID;
  for (const [r, c0, c1] of lv.plats) for (let c = c0; c <= c1; c++) g[r][c] = SOLID;
  for (const [r, c] of lv.spikes) g[r][c] = SPIKE;
  const coins = new Set();
  for (const [r, c0, c1] of lv.plats) {
    if (r === 24) continue;
    coins.add(`${r - 1},${c0 + 1}`); coins.add(`${r - 1},${c1 - 1}`);
    if (c1 - c0 >= 5) coins.add(`${r - 1},${(c0 + c1) >> 1}`);
  }
  for (const [r, c] of lv.extra) coins.add(`${r},${c}`);
  coins.delete(`${lv.exit[0]},${lv.exit[1]}`);
  const sparse = [...Array(ROWS)].map(() => Array(COLS).fill(0));
  for (const k of coins) { const [r, c] = k.split(',').map(Number); if (g[r][c] === '.') sparse[r][c] = 1; }
  const wallsTxt = [], coinTxt = [];
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    let wr = '', cr = '';
    for (let c = 0; c < COLS; c++) {
      wr += g[r][c] === SOLID ? WALL : g[r][c] === SPIKE ? SPK : (r === lv.exit[0] && c === lv.exit[1]) ? EXIT : NB + NB;
      cr += sparse[r][c] ? COIN + NB : NB + NB;
      n += sparse[r][c];
    }
    wallsTxt.push(wr); coinTxt.push(cr);
  }
  const map = g.flat().map(ch => ch === SOLID ? 1 : ch === SPIKE ? 2 : 0);
  return { map, coins: sparse.flat(), walls: wallsTxt.join(NL), coinTxt: coinTxt.join(NL), n };
}

function message(text) {
  const blank = NB.repeat(LINE);
  const pad = Math.floor((LINE - text.length) / 2);
  const line = NB.repeat(pad) + text.replace(/ /g, NB) + NB.repeat(LINE - pad - text.length);
  return [...Array(ROWS)].map((_, r) => r === MSG_ROW ? line : blank).join(NL);
}

export function generate() {
  const L = LEVELS.map(build);
  const blank = NB.repeat(LINE);
  const ROWA = [...Array(ROWS)].map((_, r) => (blank + NL).repeat(r));
  const ROWB = [...Array(ROWS)].map((_, r) => (NL + blank).repeat(ROWS - 1 - r));
  const LC = [...Array(COLS)].map((_, c) => NB.repeat(c * CW));
  const RC = [...Array(COLS)].map((_, c) => NB.repeat(LINE - c * CW - 1));
  const TEXT_LEN = L[0].coinTxt.length;
  const K = [0, 1, 2, 3];
  const each = fn => K.map(fn).join('\n');
  const M = { sit: message('SIT DOWN TO PLAY'), ready: message('GET READY!'), over: message('GAME  OVER'), again: message('W TO PLAY AGAIN'), clear: message('LEVEL CLEAR!'), none: message('') };
  const wk = (i, k, j) => { const w = LEVELS[i].walkers[k]; return w ? w[j] : 0; };
  const EA0 = LEVELS.flatMap((lv, i) => K.map(k => LEVELS[i].walkers[k] ? 1 : 0));
  const ER0 = LEVELS.flatMap((lv, i) => K.map(k => wk(i, k, 0)));
  const EC0 = LEVELS.flatMap((lv, i) => K.map(k => wk(i, k, 1)));
  const ED0 = LEVELS.flatMap((lv, i) => K.map(k => wk(i, k, 2) || 1));
  const N = ROWS * COLS;

  const src = `// GENERATED by arcade/faik/gen.mjs: edit that, not this file.
@right in player: character

var MAPS: int[] = ${arr('int', L.flatMap(l => l.map))}
var DOT0: int[] = ${arr('int', L.flatMap(l => l.coins))}
var WT: string[] = ${arr('string', L.map(l => l.walls))}
var CT: string[] = ${arr('string', L.map(l => l.coinTxt))}
var CNT: int[] = ${arr('int', L.map(l => l.n))}
var SR: int[] = ${arr('int', LEVELS.map(l => l.start[0]))}
var SC: int[] = ${arr('int', LEVELS.map(l => l.start[1]))}
var EXR: int[] = ${arr('int', LEVELS.map(l => l.exit[0]))}
var EXC: int[] = ${arr('int', LEVELS.map(l => l.exit[1]))}
var EA0: int[] = ${arr('int', EA0)}
var ER0: int[] = ${arr('int', ER0)}
var EC0: int[] = ${arr('int', EC0)}
var ED0: int[] = ${arr('int', ED0)}
var ROWA: string[] = ${arr('string', ROWA)}
var ROWB: string[] = ${arr('string', ROWB)}
var LC: string[] = ${arr('string', LC)}
var RC: string[] = ${arr('string', RC)}

var none: character
var state: int = 0          // 0 seat empty, 1 ready, 2 playing, 3 dying, 4 level clear, 5 game over, 6 wait for W
var tState: float = 0.0
var dot: int[] = ${arr('int', L.flatMap(l => l.coins))}
var dotsTxt: string = ${q(L[0].coinTxt)}
var wallsTxt: string = ${q(L[0].walls)}
var coinsLeft: int = 0
var score: int = 0
var high: int = 0
var best: Map<string, int>
var lives: int = 3
var level: int = 1
var lv: int = 0
var pr: int = 23
var pc: int = 2
var jt: int = 0
var pn: float = 0.0
var en: float = 0.0
var pacTxt: string = ""
var ea: int[] = [0, 0, 0, 0]
var er: int[] = [0, 0, 0, 0]
var ec: int[] = [0, 0, 0, 0]
var ed: int[] = [1, 1, 1, 1]
${each(k => `var gt${k}: string = ""`)}
var dead: bool = false
var msg: string = ${q(M.sit)}
var msgK: int = 0            // message colour: 0 yellow, 1 red, 2 white
var hud: string = "FAIK PLATFORMER"
var info: string = ""
var pingT: float = -9.0
var pingHi: bool = false
var fxT: float = -9.0
var fxKind: int = 0
var p0: float = 1.0
var v0: float = 0.0
var p1: float = 1.0
var v1: float = 0.0

out walls_t: string = wallsTxt
out dots_t: string = dotsTxt
out pac_t: string = pacTxt
${each(k => `out g${k}_t: string = gt${k}`)}
out msg_t: string = msg
out msg_c: color = if msgK.Value == 1 then ColorSRGB(255, 40, 40, 255) else if msgK.Value == 2 then ColorSRGB(255, 255, 255, 255) else ColorSRGB(255, 230, 60, 255)
out hud_t: string = hud
out info_t: string = info
out P0: float = p0
out V0: float = v0
out P1: float = p1
out V1: float = v1

mod showHud() {
  hud = "SCORE \${score}     HIGH \${high}"
  let spare = if lives >= 3 then "Ö Ö" else if lives == 2 then "Ö" else ""
  info = "\${spare}   COINS LEFT \${coinsLeft}   LEVEL \${level}"
}

mod drawPac() {
  pacTxt = ROWA[pr] .. LC[pc] .. ${q(FAIK)} .. RC[pc] .. ROWB[pr]
}

mod drawWalker(k: int) {
  let r = er[k]
  let c = ec[k]
  let t = if ea[k] == 1 then ROWA[r] .. LC[c] .. ${q(WALKER)} .. RC[c] .. ROWB[r] else ""
${each(k => `  if k == ${k} { gt${k} = t }`)}
}

mod resetDots() {
  dot.copyFrom(DOT0)
  dotsTxt = CT[lv]
  wallsTxt = WT[lv]
  coinsLeft = CNT[lv]
}

mod resetRound(now: float) {
  pr = SR[lv]
  pc = SC[lv]
  jt = 0
  dead = false
${each(k => `  ea[${k}] = EA0[lv * 4 + ${k}]
  er[${k}] = ER0[lv * 4 + ${k}]
  ec[${k}] = EC0[lv * 4 + ${k}]
  ed[${k}] = ED0[lv * 4 + ${k}]
  drawWalker(${k})`)}
  drawPac()
  pn = now + 1.5
  en = now + 1.5
  msg = ${q(M.ready)}
  msgK = 0
  state = 1
  tState = now
  showHud()
}

mod newLevel(now: float) {
  lv = (level - 1) % ${NLV}
  resetDots()
  resetRound(now)
}

mod newGame(now: float) {
  score = 0
  lives = 3
  level = 1
  newLevel(now)
}

mod clearActors() {
  pacTxt = ""
${each(k => `  gt${k} = ""`)}
}

mod die(now: float) {
  state = 3
  tState = now
  fxT = now
  fxKind = 2
${each(k => `  gt${k} = ""`)}
}

mod checkWalkers() {
${each(k => `  if ea[${k}] == 1 && er[${k}] == pr && ec[${k}] == pc {
    dead = true
  }`)}
}

mod playerStep(ax: int, jmp: bool, now: float) {
  let base = lv * ${N}
  if ax != 0 {
    let nc = pc + ax
    if MAPS[base + pr * ${COLS} + nc] != 1 {
      pc = nc
    }
  }
  let g = MAPS[base + (pr + 1) * ${COLS} + pc] == 1
  if g && jmp && jt == 0 {
    jt = 4
    fxT = now
    fxKind = 1
  }
  if jt > 0 {
    if MAPS[base + (pr - 1) * ${COLS} + pc] != 1 {
      pr = pr - 1
      jt = jt - 1
    } else {
      jt = 0
    }
  } else if !g {
    pr = pr + 1
  }
  let i = pr * ${COLS} + pc
  if MAPS[base + i] == 2 {
    dead = true
  }
  if dot[base + i] == 1 {
    dot[base + i] = 0
    let p = pr * ${LINE + 1} + pc * ${CW}
    dotsTxt = dotsTxt.Substring(0, p) .. ${q(NB + NB)} .. dotsTxt.Substring(p + 2, ${TEXT_LEN} - p - 2)
    coinsLeft = coinsLeft - 1
    score = score + 10
    pingT = now
    pingHi = !pingHi
    showHud()
  }
  drawPac()
  checkWalkers()
  if coinsLeft <= 0 && pr == EXR[lv] && pc == EXC[lv] && !dead {
    state = 4
    tState = now
    score = score + 100 * level + 50 * lives
    clearActors()
    msg = ${q(M.clear)}
    msgK = 2
    showHud()
  }
}

mod enemiesStep() {
  let base = lv * ${N}
${each(k => `  if ea[${k}] == 1 {
    let r = er[${k}]
    let c = ec[${k}]
    let nc = c + ed[${k}]
    if MAPS[base + r * ${COLS} + nc] == 1 || MAPS[base + (r + 1) * ${COLS} + nc] != 1 {
      ed[${k}] = 0 - ed[${k}]
    } else {
      ec[${k}] = nc
    }
    drawWalker(${k})
  }`)}
  checkWalkers()
}

mod gameOver(now: float) {
  state = 5
  tState = now
  clearActors()
  msg = ${q(M.over)}
  msgK = 1
  let ctrl = player.ControllerOf()
  let coins: int = min(50, floor(score / 300.0))
  if coins > 0 {
    ctrl.IncLeaderboard("coins", coins)
  }
  let key = ctrl.GetUserId()
  let b = best.get(key)
  if !b.Found || score > b.Value {
    best.set(key, score)
  }
  info = "GAME OVER  +\${coins} COINS"
}

mod idle() {
  state = 0
  clearActors()
  msg = ${q(M.sit)}
  msgK = 0
  hud = "FAIK PLATFORMER     HIGH \${high}"
  info = "A D WALK    W JUMP"
}

on player {
  if player == none {
    idle()
  } else {
    newGame(ServerUptime())
  }
}

let inp = player.InputReader()
on inp.Forward > 0.5 {
  if inp.Forward > 0.5 {
    if state == 6 {
      newGame(ServerUptime())
    }
  }
}

// always running (a Clock switched by 'enabled' got stuck in the DDR cabinet)
on Clock(interval = 0.02) {
  let now = ServerUptime()
  if state == 2 {
    let ax = if inp.Right > 0.5 then 1 else if inp.Right < -0.5 then -1 else 0
    let jmp = inp.Forward > 0.5
    if now >= pn {
      playerStep(ax, jmp, now)
      pn = max(pn + 0.07, now - 0.1)
    }
    if state == 2 && now >= en {
      enemiesStep()
      en = max(en + 0.2 / min(1.6, 1.0 + (level - 1) * 0.1), now - 0.1)
    }
    if dead && state == 2 {
      dead = false
      die(now)
    }
  } else if state == 1 {
    if now - tState >= 1.5 {
      state = 2
      msg = ${q(M.none)}
    }
  } else if state == 3 {
    let e = now - tState
    pacTxt = if e < 1.0 && floor(e * 6.0) % 2 == 0 then ROWA[pr] .. LC[pc] .. ${q(FAIK)} .. RC[pc] .. ROWB[pr] else ""
    if e >= 1.4 {
      lives = lives - 1
      if lives <= 0 {
        if score > high {
          high = score
        }
        gameOver(now)
      } else {
        resetRound(now)
      }
    }
  } else if state == 4 {
    if now - tState >= 2.0 {
      level = level + 1
      newLevel(now)
    }
  } else if state == 5 {
    if now - tState >= 3.0 {
      state = 6
      msg = ${q(M.again)}
      msgK = 0
    }
  }
  if score > high {
    high = score
  }
  // sound: coin ping on speaker 0, jump / death on 1
  v0 = if now - pingT < 0.08 then 0.6 else 0.0
  p0 = if pingHi then 1.9 else 1.5
  let fe = now - fxT
  if fxKind == 1 && fe < 0.2 {
    p1 = 0.6 + fe * 3.0
    v1 = 0.4
  } else if fxKind == 2 && fe < 1.0 {
    p1 = max(0.15, 1.2 - fe * 1.0)
    v1 = 0.6
  } else {
    v1 = 0.0
  }
}
`;
  return { src, layout: { ROWS, COLS, CW, LINE }, synths: ['Square', 'Triangle'], walls: L[0].walls };
}
