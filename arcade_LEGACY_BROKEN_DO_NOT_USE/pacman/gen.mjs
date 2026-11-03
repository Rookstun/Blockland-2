// pacman/gen.mjs: the Pac-Man cabinet's Wirescript (all game logic in wires, no plugin).
//   generate() -> { src, walls, layout }   (walls = the static maze text for the board panel)
//
// The screen is a stack of text layers that all render the SAME 31 x 56 character
// grid (2 characters per maze cell, every row padded with no-break spaces), so
// they line up exactly when centred on one spot:
//   walls (static, on the board panel)   dots (one string, patched in place when a dot is eaten)
//   pac + 4 ghosts (one glyph each: ROWA[r] .. LC[c] .. glyph .. RC[c] .. ROWB[r])   message (READY! etc)
// Ghosts share ONE step routine (a mod is inlined per call site): each Clock tick
// steps whichever actor is most due (gn.min()).

export const MAZE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];
export const ROWS = 31, COLS = 28, CW = 2, LINE = COLS * CW; // characters per text row
const NB = ' ', NL = '\n';
const MSG_ROW = 17;

// glyphs
const PAC_OPEN = ['U', 'Ɔ', '∩', 'C']; // mouth toward up, left, down, right
const PAC_SHUT = '●', GHOST = 'Ω', EYES = 'ö', DOT = '·', POWER = '●';
const WALL = '██', DOOR = '──';

// timing (cells per second, seconds)
const PAC_SPD = 7.5, GHOST_SPD = 7.0, FRIGHT_SPD = 4.5, EYES_SPD = 14.0, TUNNEL_SPD = 4.0;
const PHASES = [7, 20, 7, 20, 5, 20, 5, 99999]; // scatter, chase, ... (even index = scatter)
const RELEASE = [0, 1, 5, 9];                   // seconds after READY each ghost leaves the house
const START = { pr: 23, pc: 13, gr: [11, 14, 14, 14], gc: [13, 13, 11, 15], gd: [1, 0, 0, 0] };
const SCATTER = [[-3, 25], [-3, 2], [33, 27], [33, 0]];

const q = s => JSON.stringify(s);
const f = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const arr = (type, xs) => `[${xs.map(type === 'float' ? f : type === 'string' ? q : String).join(', ')}]`;
const col = ([r, g, b]) => `ColorSRGB(${r}, ${g}, ${b}, 255)`;
const DR = d => `(if ${d} == 0 then -1 else if ${d} == 2 then 1 else 0)`;
const DC = d => `(if ${d} == 1 then -1 else if ${d} == 3 then 1 else 0)`;
const wrap = c => `((${c} + ${COLS}) % ${COLS})`;
const okOf = d => `(if ${d} == 0 then ok0 else if ${d} == 1 then ok1 else if ${d} == 2 then ok2 else ok3)`;

const GHOST_COL = [[255, 40, 40], [255, 150, 210], [40, 230, 255], [255, 170, 60]];
const FRIGHT_C = [40, 60, 255], FLASH_C = [240, 240, 255], EYES_C = [230, 230, 255];
const WALL_C = [40, 70, 255];

function grid() {
  for (const [i, row] of MAZE.entries()) if (row.length !== COLS) throw new Error(`maze row ${i} has ${row.length} cells`);
  const at = (r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? ' ' : MAZE[r][c];
  const wall = (r, c) => at(r, c) === '#';
  const open = (r, c) => '.o '.includes(at(r, c)) && !(at(r, c) === ' ' && enclosed(r, c));
  // void cells outside the maze (the blank side areas) render empty and are never walkable
  function enclosed(r, c) {
    // a blank cell counts as void when it is on the outer edge band of rows 9-19 outside the side walls
    return r >= 9 && r <= 19 && r !== 14 && (c <= 4 || c >= 23);
  }
  const map = [], dots = [];
  const wallRows = [], dotRows = [];
  let nDots = 0;
  for (let r = 0; r < ROWS; r++) {
    let wr = '', dr = '';
    for (let c = 0; c < COLS; c++) {
      const ch = at(r, c);
      map.push(ch === '#' || ch === '-' ? 0 : open(r, c) ? 1 : 0);
      dots.push(ch === '.' ? 1 : ch === 'o' ? 2 : 0);
      if (ch === '.' || ch === 'o') nDots++;
      // a wall cell is drawn only when it borders something that is not wall (outline look)
      let border = false;
      if (ch === '#') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = at(r + dy, c + dx);
        if (n !== '#' && !(n === ' ' && (r + dy < 0 || r + dy >= ROWS || c + dx < 0 || c + dx >= COLS || enclosed(r + dy, c + dx)))) border = true;
      }
      wr += ch === '-' ? DOOR : border ? WALL : NB + NB;
      dr += ch === '.' ? DOT + NB : ch === 'o' ? POWER + NB : NB + NB;
    }
    wallRows.push(wr); dotRows.push(dr);
  }
  return { map, dots, walls: wallRows.join(NL), dotsText: dotRows.join(NL), nDots };
}

function message(text) {
  const blank = NB.repeat(LINE);
  const pad = Math.floor((LINE - text.length) / 2);
  const line = NB.repeat(pad) + text.replace(/ /g, NB) + NB.repeat(LINE - pad - text.length);
  return [...Array(ROWS)].map((_, r) => r === MSG_ROW ? line : blank).join(NL);
}

export function generate() {
  const g = grid();
  const blank = NB.repeat(LINE);
  const ROWA = [...Array(ROWS)].map((_, r) => (blank + NL).repeat(r));
  const ROWB = [...Array(ROWS)].map((_, r) => (NL + blank).repeat(ROWS - 1 - r));
  const LC = [...Array(COLS)].map((_, c) => NB.repeat(c * CW));
  const RC = [...Array(COLS)].map((_, c) => NB.repeat(LINE - c * CW - 1));
  const TEXT_LEN = g.dotsText.length;
  const K = [0, 1, 2, 3];
  const each = fn => K.map(fn).join('\n');
  const M = { sit: message('SIT DOWN TO PLAY'), ready: message('READY!'), over: message('GAME  OVER'), again: message('W TO PLAY AGAIN'), clear: message('LEVEL CLEAR!'), none: message('') };

  const src = `// GENERATED by arcade/pacman/gen.mjs: edit that, not this file.
@right in player: character

var MAP: int[] = ${arr('int', g.map)}
var DOT0: int[] = ${arr('int', g.dots)}
var ROWA: string[] = ${arr('string', ROWA)}
var ROWB: string[] = ${arr('string', ROWB)}
var LC: string[] = ${arr('string', LC)}
var RC: string[] = ${arr('string', RC)}
var PH: float[] = ${arr('float', PHASES)}

var none: character
var state: int = 0          // 0 seat empty, 1 ready, 2 playing, 3 dying, 4 level clear, 5 game over, 6 wait for W
var tState: float = 0.0
var dot: int[] = ${arr('int', g.dots)}
var dotsTxt: string = ${q(g.dotsText)}
var dotsLeft: int = ${g.nDots}
var score: int = 0
var high: int = 0
var best: Map<string, int>
var lives: int = 3
var level: int = 1
var pr: int = ${START.pr}
var pc: int = ${START.pc}
var pd: int = 1
var want: int = 1
var pn: float = 0.0
var mouth: int = 0
var pacTxt: string = ""
var gr: int[] = ${arr('int', START.gr)}
var gc: int[] = ${arr('int', START.gc)}
var gd: int[] = ${arr('int', START.gd)}
var gs: int[] = [2, 0, 0, 0]          // 0 in the house, 2 out, 4 eyes going home
var gf: int[] = [0, 0, 0, 0]          // 1 = frightened
var gn: float[] = [0.0, 0.0, 0.0, 0.0] // next step time
var grel: float[] = [0.0, 0.0, 0.0, 0.0]
${each(k => `var gt${k}: string = ""
var gm${k}: int = 0`)}
var hk: int = -1            // ghost touched this tick
var frEnd: float = 0.0
var frFlash: bool = false
var chain: int = 0
var phase: int = 0
var phaseEnd: float = 0.0
var scatter: bool = true
var msg: string = ${q(M.sit)}
var msgK: int = 0            // message colour: 0 yellow, 1 red, 2 white
var wallW: bool = false      // maze flashing white
var hud: string = "PAC-MAN"
var info: string = ""
var wakaT: float = -9.0
var wakaHi: bool = false
var fxT: float = -9.0
var fxKind: int = 0
var p0: float = 1.0
var v0: float = 0.0
var p1: float = 1.0
var v1: float = 0.0
var p2: float = 1.0
var v2: float = 0.0

out walls_c: color = if wallW.Value then ${col([240, 240, 255])} else ${col(WALL_C)}
out dots_t: string = dotsTxt
out pac_t: string = pacTxt
${each(k => `out g${k}_t: string = gt${k}
out g${k}_c: color = if gm${k}.Value == 2 then ${col(EYES_C)} else if gm${k}.Value == 1 then (if frFlash.Value then ${col(FLASH_C)} else ${col(FRIGHT_C)}) else ${col(GHOST_COL[k])}`)}
out msg_t: string = msg
out msg_c: color = if msgK.Value == 1 then ${col([255, 40, 40])} else if msgK.Value == 2 then ${col([255, 255, 255])} else ${col([255, 230, 60])}
out hud_t: string = hud
out info_t: string = info
out P0: float = p0
out V0: float = v0
out P1: float = p1
out V1: float = v1
out P2: float = p2
out V2: float = v2

mod showHud() {
  hud = "SCORE \${score}     HIGH \${high}"
  let spare = if lives >= 3 then "● ●" else if lives == 2 then "●" else ""
  info = "\${spare}          LEVEL \${level}"
}

mod drawPac() {
  let g = if mouth == 1 then ${PAC_OPEN.map((p, d) => `(if pd == ${d} then ${q(p)} else `).join('')}${q(PAC_SHUT)}${')'.repeat(4)} else ${q(PAC_SHUT)}
  pacTxt = ROWA[pr] .. LC[pc] .. g .. RC[pc] .. ROWB[pr]
}

mod setMode(k: int) {
  let s = gs[k]
  let m = if s == 4 then 2 else if gf[k] == 1 then 1 else 0
${each(k => `  if k == ${k} { gm${k} = m }`)}
}

mod drawGhost(k: int) {
  let r = gr[k]
  let c = gc[k]
  let t = ROWA[r] .. LC[c] .. (if gs[k] == 4 then ${q(EYES)} else ${q(GHOST)}) .. RC[c] .. ROWB[r]
${each(k => `  if k == ${k} { gt${k} = t }`)}
}

mod resetRound(now: float) {
  pr = ${START.pr}
  pc = ${START.pc}
  pd = 1
  want = 1
  mouth = 0
  gr = ${arr('int', START.gr)}
  gc = ${arr('int', START.gc)}
  gd = ${arr('int', START.gd)}
  gs = [2, 0, 0, 0]
  gf = [0, 0, 0, 0]
  gn = [now + 2.2, now + 2.3, now + 2.4, now + 2.5]
  grel = [now, now + ${f(2 + RELEASE[1])}, now + ${f(2 + RELEASE[2])}, now + ${f(2 + RELEASE[3])}]
  frEnd = 0.0
  frFlash = false
  hk = -1
  phase = 0
  phaseEnd = now + ${f(2 + PHASES[0])}
  scatter = true
  pn = now + 2.0
${each(k => `  gm${k} = 0`)}
  drawPac()
${each(k => `  drawGhost(${k})`)}
  msg = ${q(M.ready)}
  msgK = 0
  state = 1
  tState = now
  showHud()
}

mod resetDots() {
  dot.copyFrom(DOT0)
  dotsTxt = ${q(g.dotsText)}
  dotsLeft = ${g.nDots}
}

mod newGame(now: float) {
  score = 0
  lives = 3
  level = 1
  wallW = false
  resetDots()
  resetRound(now)
}

mod clearActors() {
  pacTxt = ""
${each(k => `  gt${k} = ""`)}
}

mod startFright(now: float) {
  let dur = max(1.0, 7.0 - level * 1.0)
  frEnd = now + dur
  chain = 0
${each(k => `  if gs[${k}] == 2 {
    gf[${k}] = 1
    gd[${k}] = (gd[${k}] + 2) % 4
    gn[${k}] = max(gn[${k}], now)
  }
  setMode(${k})`)}
}

mod endFright() {
  frEnd = 0.0
  frFlash = false
  gf = [0, 0, 0, 0]
${each(k => `  setMode(${k})`)}
}

mod pacStep(now: float) {
  let r = pr
  let c = pc
  let ok0 = MAP[(r - 1) * ${COLS} + c] == 1
  let ok1 = MAP[r * ${COLS} + ${wrap('c - 1')}] == 1
  let ok2 = MAP[(r + 1) * ${COLS} + c] == 1
  let ok3 = MAP[r * ${COLS} + ${wrap('c + 1')}] == 1
  var d: int = pd
  if ${okOf('want')} {
    d = want
  }
  if ${okOf('d')} {
    let nr = r + ${DR('d')}
    let nc = ${wrap(`c + ${DC('d')}`)}
    pr = nr
    pc = nc
    pd = d
    mouth = 1 - mouth
    let i = nr * ${COLS} + nc
    let v = dot[i]
    if v > 0 {
      dot[i] = 0
      let p = nr * ${LINE + 1} + nc * ${CW}
      dotsTxt = dotsTxt.Substring(0, p) .. ${q(NB + NB)} .. dotsTxt.Substring(p + 2, ${TEXT_LEN} - p - 2)
      dotsLeft = dotsLeft - 1
      wakaT = now
      wakaHi = !wakaHi
      if v == 2 {
        score = score + 50
        startFright(now)
      } else {
        score = score + 10
      }
      showHud()
    }
  } else {
    mouth = 0
  }
  drawPac()
${each(k => `  if gr[${k}] == pr && gc[${k}] == pc {
    hk = ${k}
  }`)}
}

mod ghostStep(k: int, now: float) {
  let s = gs[k]
  if s == 0 {
    if now >= grel[k] {
      gs[k] = 2
      gr[k] = 11
      gc[k] = 13
      gd[k] = 1
      gn[k] = now + 0.15
      if frEnd > 0.0 {
        gf[k] = 0
      }
      setMode(k)
    } else {
      gn[k] = now + 0.25
    }
    drawGhost(k)
  } else {
    let r = gr[k]
    let c = gc[k]
    let d = gd[k]
    let fr = gf[k]
    let ok0 = MAP[(r - 1) * ${COLS} + c] == 1
    let ok1 = MAP[r * ${COLS} + ${wrap('c - 1')}] == 1
    let ok2 = MAP[(r + 1) * ${COLS} + c] == 1
    let ok3 = MAP[r * ${COLS} + ${wrap('c + 1')}] == 1
    let rev = (d + 2) % 4
    var tr: int = 0
    var tc: int = 0
    if s == 4 {
      tr = 11
      tc = 13
    } else if scatter {
${SCATTER.map(([sr, sc], k) => `      ${k ? 'else ' : ''}if k == ${k} {
        tr = ${sr}
        tc = ${sc}
      }`).join(' ')}
    } else if k == 0 {
      tr = pr
      tc = pc
    } else if k == 1 {
      tr = pr + 4 * ${DR('pd')}
      tc = pc + 4 * ${DC('pd')}
    } else if k == 2 {
      let br = gr[0]
      let bc = gc[0]
      tr = 2 * (pr + 2 * ${DR('pd')}) - br
      tc = 2 * (pc + 2 * ${DC('pd')}) - bc
    } else {
      if (r - pr) * (r - pr) + (c - pc) * (c - pc) > 64 {
        tr = pr
        tc = pc
      } else {
        tr = ${SCATTER[3][0]}
        tc = ${SCATTER[3][1]}
      }
    }
    var nd: int = -1
    if fr == 1 && s == 2 {
      let r0 = Random(0, 3)
${[0, 1, 2, 3].map(j => `      let dd${j} = (r0 + ${j}) % 4
      if nd < 0 && dd${j} != rev && ${okOf(`dd${j}`)} {
        nd = dd${j}
      }`).join('\n')}
    } else {
      var bv: int = 999999
${[[0, -1, 0], [1, 0, -1], [2, 1, 0], [3, 0, 1]].map(([dd, dr, dc]) => `      if ok${dd} && rev != ${dd} {
        let v${dd} = (r + ${dr} - tr) * (r + ${dr} - tr) + (c + ${dc} - tc) * (c + ${dc} - tc)
        if v${dd} < bv {
          bv = v${dd}
          nd = ${dd}
        }
      }`).join('\n')}
    }
    if nd < 0 {
      nd = rev
    }
    let nr = r + ${DR('nd')}
    let nc = ${wrap(`c + ${DC('nd')}`)}
    gr[k] = nr
    gc[k] = nc
    gd[k] = nd
    let tunnel = nr == 14 && (nc < 6 || nc > 21)
    let spd = if s == 4 then ${f(EYES_SPD)} else if fr == 1 then ${f(FRIGHT_SPD)} else if tunnel then ${f(TUNNEL_SPD)} else ${f(GHOST_SPD)} * min(1.25, 1.0 + (level - 1) * 0.05)
    gn[k] = max(gn[k] + 1.0 / spd, now - 0.1)
    if s == 4 && nr == 11 && (nc == 13 || nc == 14) {
      gs[k] = 0
      gr[k] = 14
      gc[k] = 13
      gf[k] = 0
      grel[k] = now + 1.0
      gn[k] = now + 0.25
      setMode(k)
    }
    drawGhost(k)
    if gr[k] == pr && gc[k] == pc {
      hk = k
    }
  }
}

mod touched(k: int, now: float) {
  if gs[k] == 2 {
    if gf[k] == 1 {
      gs[k] = 4
      gf[k] = 0
      chain = chain + 1
      score = score + (if chain == 1 then 200 else if chain == 2 then 400 else if chain == 3 then 800 else 1600)
      fxT = now
      fxKind = 1
      setMode(k)
      drawGhost(k)
      showHud()
    } else {
      state = 3
      tState = now
      fxT = now
      fxKind = 2
${each(k => `      gt${k} = ""`)}
    }
  }
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
  BroadcastChatMessage("<color=\\"ffe040\\">\${ctrl.GetUserName()} scored \${score} on PAC-MAN (level \${level})</>")
}

mod idle() {
  state = 0
  clearActors()
  msg = ${q(M.sit)}
  msgK = 0
  hud = "PAC-MAN     HIGH \${high}"
  info = "WASD TO MOVE"
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
    want = 0
    if state == 6 {
      newGame(ServerUptime())
    }
  }
}
on inp.Forward < -0.5 {
  if inp.Forward < -0.5 {
    want = 2
  }
}
on inp.Right < -0.5 {
  if inp.Right < -0.5 {
    want = 1
  }
}
on inp.Right > 0.5 {
  if inp.Right > 0.5 {
    want = 3
  }
}

// always running (a Clock switched by 'enabled' got stuck in the DDR cabinet)
on Clock(interval = 0.02) {
  let now = ServerUptime()
  if state == 2 {
    if now >= phaseEnd && phase < 7 {
      phase = phase + 1
      phaseEnd = now + PH[phase]
      scatter = phase % 2 == 0
${each(k => `      if gs[${k}] == 2 {
        gd[${k}] = (gd[${k}] + 2) % 4
      }`)}
    }
    if now >= pn {
      pacStep(now)
      pn = max(pn + 1.0 / (${f(PAC_SPD)} * min(1.25, 1.0 + (level - 1) * 0.05)), now - 0.1)
    }
    let m = gn.min()
    if now >= m {
      let k = gn.find(m)
      ghostStep(k, now)
    }
    if hk >= 0 {
      let h = hk
      hk = -1
      touched(h, now)
    }
    if state == 2 {
      if frEnd > 0.0 {
        if now >= frEnd {
          endFright()
        } else {
          frFlash = frEnd - now < 2.0 && floor(now * 5.0) % 2 == 0
        }
      }
      if dotsLeft <= 0 {
        state = 4
        tState = now
        clearActors()
        msg = ${q(M.clear)}
        msgK = 2
      }
    }
  } else if state == 1 {
    if now - tState >= 2.0 {
      state = 2
      msg = ${q(M.none)}
    }
  } else if state == 3 {
    let e = now - tState
    pacTxt = if e < 1.4 && floor(e * 6.0) % 2 == 0 then ROWA[pr] .. LC[pc] .. ${q(PAC_SHUT)} .. RC[pc] .. ROWB[pr] else ""
    if e >= 1.8 {
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
    let e = now - tState
    wallW = floor(e * 4.0) % 2 == 0
    if e >= 2.4 {
      wallW = false
      level = level + 1
      resetDots()
      resetRound(now)
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
  // sound: waka on the speaker 0, siren on 1, effects (ghost eaten, death) on 2
  v0 = if now - wakaT < 0.09 then 0.7 else 0.0
  p0 = if wakaHi then 0.62 else 0.48
  if state == 2 {
    if frEnd > 0.0 {
      p1 = 0.3 + 0.08 * sin(now * 30.0)
    } else {
      p1 = (0.85 + 0.1 * level) * (1.0 + 0.18 * sin(now * 9.0))
    }
    v1 = 0.22
  } else {
    v1 = 0.0
  }
  let fe = now - fxT
  if fxKind == 1 && fe < 0.45 {
    p2 = 0.5 + fe * 5.0
    v2 = 0.6
  } else if fxKind == 2 && fe < 1.5 {
    p2 = max(0.15, 1.3 - fe * 0.8) * (1.0 + 0.25 * sin(fe * 60.0))
    v2 = 0.7
  } else {
    v2 = 0.0
  }
}
`;
  return { src, walls: g.walls, layout: { ROWS, COLS, CW, LINE }, synths: ['Square', 'Sine', 'Square'] };
}
