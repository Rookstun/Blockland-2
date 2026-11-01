// thirteen/gen.mjs: THIRTEEN CANDLES, a quiet walk in memory of the 13 people killed at Columbine High School (April 20, 1999).
// No combat, no attackers shown or named. Walk four rooms: light 13 candles (name + age), read signs (what happened, what
// changed, how to get help). Same engine as zeldoy/gen.mjs (one microchip, 20 Hz tick, text-strip screen).
//   inputs (@left): tick, seated, left right up down, item (Space/RMB), swing (LMB/E)
export const W = 48, H = 36, STRIP = 4, TW = 24, TH = 18;
export const PAL = ['0d0a14', '1a1a2e', '2a2a44', '3a3a5c', 'e8c890', '7a4a20', '808088', 'f4f4f4',
  'f8a030', 'f8c0a0', '3868d8', '202028', 'f8d040', '78e8f8', '4a2a10', 'c8c8d8'];

const TILES = { hud: [[0, 0, 0, 0], 1], floor: [[1, 1, 1, 1], 0], floor2: [[1, 2, 1, 1], 0], wall: [[3, 3, 2, 2], 1], rug: [[2, 2, 2, 2], 0] };
const TN = Object.keys(TILES), T = Object.fromEntries(TN.map((k, i) => [k, i]));
const RNAME = ['April 20, 1999', 'The Thirteen', 'What Changed', 'Say Something'];
const NR = RNAME.length;
const NB = [];  // per room: up down left right (a chain, left-right)
for (let r = 0; r < NR; r++) NB.push(-1, -1, r > 0 ? r - 1 : -1, r < NR - 1 ? r + 1 : -1);

function buildRooms() {
  const all = [];
  for (let r = 0; r < NR; r++) {
    const t = Array(TW * TH).fill(T.floor);
    const set = (x, y, k) => { t[y * TW + x] = T[k]; };
    for (let y = 2; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) if ((x * 7 + y * 13 + r * 5) % 11 === 0) set(x, y, 'floor2');
    for (let y = 8; y <= 10; y++) for (let x = 1; x < TW - 1; x++) set(x, y, 'rug');
    for (let x = 0; x < TW; x++) set(x, 0, 'hud');
    for (let x = 0; x < TW; x++) { set(x, 1, 'wall'); set(x, TH - 1, 'wall'); }
    for (let y = 1; y < TH; y++) { set(0, y, 'wall'); set(TW - 1, y, 'wall'); }
    if (NB[r * 4 + 2] >= 0) for (let y = 8; y <= 10; y++) set(0, y, 'rug');
    if (NB[r * 4 + 3] >= 0) for (let y = 8; y <= 10; y++) set(TW - 1, y, 'rug');
    all.push(...t);
  }
  return all;
}

const SPRITES = {
  zD: ['.9.', 'ccc', 'c.c', 'b.b'], zU: ['.5.', 'ccc', 'c.c', 'b.b'], zL: ['99.', 'cc.', 'cc.', 'b.b'], zR: ['.99', '.cc', '.cc', 'b.b'],
  zW: ['.9.', 'ccc', 'c.c', '.b.'],
  cand0: ['...', '.6.', '.7.', '.7.'], cand1: ['.8.', '.c.', '.7.', '.7.'], cand2: ['.c.', '.8.', '.7.', '.7.'],
  sign0: ['ccc', 'ccc', '.5.', '.5.'], sign1: ['666', '666', '.5.', '.5.'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));

// points of interest: [room, x, y, kind(0 candle,1 sign), pages]
const NAMES13 = [
  ['Cassie Bernall', 17], ['Steven Curnow', 14], ['Corey DePooter', 17], ['Kelly Fleming', 16], ['Matthew Kechter', 16],
  ['Daniel Mauser', 15, 'He ran cross-country and loved debate.'], ['Daniel Rohrbough', 15],
  ['Dave Sanders', 47, 'Teacher and coach. He kept leading students to safety.'],
  ['Rachel Scott', 17, 'She kept journals about kindness.'],
  ['Isaiah Shoels', 18], ['John Tomlin', 16], ['Lauren Townsend', 18, 'A senior and a varsity volleyball player.'], ['Kyle Velasquez', 16],
];
const POIS = [];
const candX = [5, 11, 17, 23, 29, 35, 41, 8, 14, 20, 26, 32, 38];
NAMES13.forEach(([n, a, extra], i) => POIS.push([1, candX[i], i < 7 ? 6 : 26, 0, extra ? [`${n}, ${a}.`, extra] : [`${n}, ${a}.`, 'Remembered by family and friends.']]));
const SIGNS = [
  [0, 12, 8, ['April 20, 1999. Columbine High School, Colorado.', 'A Tuesday. Classes, lunch, a school year winding down.']],
  [0, 22, 26, ['Two students attacked the school and killed 13 people:', '12 students and 1 teacher. More than 20 were wounded.']],
  [0, 33, 8, ['Both attackers died that day. We will not name them.', 'This walk is about the 13. Go right, light each candle.']],
  [2, 12, 8, ['In 1999 police set a perimeter and waited for SWAT.', 'Wounded people waited hours for help inside.']],
  [2, 22, 26, ['Today the first officers on scene go in at once', 'to stop the attacker. Training changed nationwide.']],
  [2, 33, 8, ['Schools now use threat-assessment teams and tip lines.', "Colorado's Safe2Tell (2004) takes anonymous reports."]],
  [3, 8, 8, ['Studies of school attacks find other people often knew', 'something beforehand. Warning signs can be heard.']],
  [3, 18, 26, ['If someone talks about hurting people or themselves,', 'tell a trusted adult right away.', 'Telling is not snitching. It is how people stay alive.']],
  [3, 28, 8, ['Need help, or worried about someone? In the US:', 'call or text 988 (crisis line).', 'Colorado Safe2Tell: 1-877-542-7233, anonymous.']],
  [3, 38, 26, ["Rachel Scott's family began Rachel's Challenge:", 'look for the best in others, be kind to the lonely,', 'start a chain reaction of kindness.']],
];
for (const [r, x, y, pages] of SIGNS) POIS.push([r, x, y, 1, pages]);
const FINAL = ['You lit all 13 candles and read every sign.', 'Say their names. Do not make attackers famous.', 'Be the one who speaks up. SPACE to walk again.'];
const NCANDLE = 13, NSIGN = SIGNS.length, NP = POIS.length;
for (const p of [...POIS.map(p => p[4]), FINAL]) for (const l of p) if (l.length > 60) throw Error('line too long: ' + l);

const SONGS = [{ eighth: 5, loop: 1,
  lead: 'E5:4 D5:2 C5:2 D5:4 R:4 | G4:4 A4:2 B4:2 C5:6 R:2 | E5:4 D5:2 C5:2 D5:4 E5:4 | G5:4 E5:4 D5:8',
  bass: 'C3:8 G2:8 | A2:8 E2:8 | C3:8 G2:8 | F2:8 G2:8' }];
const SFX = { light: [2.0, 2.5, 3.0, 3.0], read: [1.5, 1.8], done: [1.0, 1.26, 1.5, 2.0, 2.5, 3.0] };
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NOTE.indexOf(m[1]) + 12 * (+m[2] + 1); };
const parseVoice = (s, e) => s.split(/\s+/).filter(t => t && t !== '|').map(tok => { const [n, d = '1'] = tok.split(':'); return [n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * e)]; });
const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false } = {}) {
  const NS = H / STRIP, RT = TW * TH;
  const rooms = buildRooms();
  const spr = [], soff = [], sw = [], sh = [];
  for (const k of SN) {
    const rows = SPRITES[k]; soff.push(spr.length); sw.push(rows[0].length); sh.push(rows.length);
    for (const row of rows) { if (row.length !== rows[0].length) throw Error(`sprite ${k}`); for (const c of row) spr.push(c === '.' ? -1 : parseInt(c, 16)); }
  }
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  // text pages: POIs 0..NP-1, then the final text as POI NP
  const pt = [], po = [], pl = [];
  for (const p of [...POIS.map(p => p[4]), FINAL]) { po.push(pt.length); pl.push(p.length); pt.push(...p); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);

  const src = `// GENERATED by thirteen/gen.mjs: edit that, not this file.
// THIRTEEN CANDLES: one frame per 'tick' pulse (20 Hz) while 'seated' is true. Standing up blanks the screen.

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
const ROOMS = ${A(rooms)}
const NB = ${A(NB)}
const RNAME = ${AS(RNAME)}
const PR = ${A(POIS.map(p => p[0]).concat(-1))}
const PX = ${A(POIS.map(p => p[1]).concat(0))}
const PY = ${A(POIS.map(p => p[2]).concat(0))}
const PK = ${A(POIS.map(p => p[3]).concat(2))}
const PO = ${A(po)}
const PL = ${A(pl)}
const PT = ${AS(pt)}
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

var state: int = -1         // -1 off, 0 title, 1 walking
var t: int = 0
var room: int = 0
var loadR: int = 9          // tile-row pairs still to draw (9 = done)
var px: float = 22.0
var py: float = 22.0
var pf: int = 1             // 0 up 1 down 2 left 3 right
var walking: bool = false
var lit: int[] = ${zeros(NP)}
var nLit: int = 0
var nSign: int = 0
var finished: bool = false
var reading: int = -1
var page: int = 0
var readT: int = 0
var lastNear: int = -1
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
@right out title_: string = if state == 0 then "THIRTEEN CANDLES" else ""
@right out P0: float = aP0
@right out V0: float = aV0
@right out P1: float = aP1
@right out V1: float = aV1
@right out P2: float = aP2
@right out V2: float = aV2
@right out state_: int = state

mod say(s: string, n: int) {
  msg = s
  msgT = n
}
mod sfx(k: int) {
  fxId = k
  fxI = 0
}
mod tileAt(cx: int, cy: int) -> int {
  if cx < 0 || cx >= W || cy < 0 || cy >= H { return ${T.hud} }
  return ROOMS[room * ${RT} + floor(cy / 2.0) * ${TW} + floor(cx / 2.0)]
}
mod solid(cx: int, cy: int) -> int {
  return SOLID[tileAt(cx, cy)]
}
mod dist(ax: float, ay: float, bx0: float, by0: float) -> float {
  return sqrt((ax - bx0) * (ax - bx0) + (ay - by0) * (ay - by0))
}
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

mod audio() {
  if state >= 0 {
    md0 -= 1
    if md0 <= 0 {
      if mi0 >= VL0[0] { mi0 = 0 }
      let n = VO0[0] + mi0
      mp0 = NP0[n]
      md0 = ND0[n]
      mt0 = 0
      mi0 += 1
    }
    md1 -= 1
    if md1 <= 0 {
      if mi1 >= VL1[0] { mi1 = 0 }
      let n = VO1[0] + mi1
      mp1 = NP1[n]
      md1 = ND1[n]
      mi1 += 1
    }
    mt0 += 1
  }
  if mp0 > 0.0 {
    aP0 = mp0
    aV0 = if md0 <= 1 then 0.0 else 0.25 * max(0.4, 1.0 - mt0 * 0.04)
  } else { aV0 = 0.0 }
  if mp1 > 0.0 {
    aP1 = mp1
    aV1 = if md1 <= 1 then 0.0 else 0.4
  } else { aV1 = 0.0 }
  if fxId >= 0 {
    if fxI < FXL[fxId] {
      aP2 = FXP[FXO[fxId] + fxI]
      aV2 = 0.4
      fxI += 1
    } else {
      fxId = -1
      aV2 = 0.0
    }
  } else { aV2 = 0.0 }
}

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
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  if loadR >= 9 && state >= 0 {
    for i in 0..${NP} {
      if PR[i] == room {
        if PK[i] == 0 {
          if lit[i] > 0 { drawSpr(if (t / 5 + i) % 2 > 0 then ${S.cand1} else ${S.cand2}, PX[i], PY[i]) } else { drawSpr(${S.cand0}, PX[i], PY[i]) }
        } else {
          drawSpr(if lit[i] > 0 then ${S.sign1} else ${S.sign0}, PX[i], PY[i])
        }
      }
    }
    if state == 1 {
      var zs: int = ${S.zD}
      if pf == 0 { zs = ${S.zU} } else if pf == 2 { zs = ${S.zL} } else if pf == 3 { zs = ${S.zR} } else if walking && (t / 4) % 2 > 0 { zs = ${S.zW} }
      drawSpr(zs, floor(px), floor(py))
    }
  }
  // HUD: 13 candle pips, then the signs
  for i in 0..${NCANDLE} {
    let c = if i < nLit then 8 else 11
    put(i * 2, 0, c)
    put(i * 2, 1, c)
  }
  for i in 0..${NSIGN} {
    let c = if i < nSign then 12 else 11
    put(28 + i * 2, 0, c)
    put(28 + i * 2, 1, c)
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

mod enterRoom(r: int) {
  room = r
  loadR = 0
  if state == 1 { say(RNAME[r], 60) }
}
mod startRead(i: int) {
  reading = i
  page = 0
  readT = 110
  say(PT[PO[i]], 120)
}
mod playerTick() {
  let mvx: int = kR - kL
  let mvy: int = kD - kU
  walking = mvx != 0 || mvy != 0
  if mvy < 0 { pf = 0 } else if mvy > 0 { pf = 1 } else if mvx < 0 { pf = 2 } else if mvx > 0 { pf = 3 }
  moveBox(px, py, mvx * 0.45, mvy * 0.45)
  px = hx
  py = hy
  if px < 0.2 && NB[room * 4 + 2] >= 0 {
    px = 44.6
    enterRoom(NB[room * 4 + 2])
  } else if px > 44.8 && NB[room * 4 + 3] >= 0 {
    px = 0.4
    enterRoom(NB[room * 4 + 3])
  }
  let fx = px + 1.5
  let fy = py + 3.0
  if reading >= 0 {
    readT -= 1
    if readT <= 0 {
      page += 1
      if page < PL[reading] {
        readT = 110
        say(PT[PO[reading] + page], 120)
        if reading == ${NP} && page == PL[reading] - 1 {
          readT = 100000
          msgT = 100000
        }
      } else { reading = -1 }
    }
  } else {
    if nLit >= ${NCANDLE} && nSign >= ${NSIGN} && !finished {
      finished = true
      sfx(${FX.done})
      startRead(${NP})
    } else {
      var near: int = -1
      for i in 0..${NP} {
        if PR[i] == room && dist(fx, fy, PX[i] + 1.5, PY[i] + 3.0) < 3.5 { near = i }
      }
      if near < 0 {
        lastNear = -1
      } else if near != lastNear {
        lastNear = near
        if lit[near] == 0 {
          lit[near] = 1
          if PK[near] == 0 { nLit += 1 } else { nSign += 1 }
        }
        sfx(if PK[near] == 0 then ${FX.light} else ${FX.read})
        startRead(near)
      }
    }
  }
}

mod newGame() {
  state = 1
  for i in 0..${NP} { lit[i] = 0 }
  nLit = 0
  nSign = 0
  finished = false
  reading = -1
  lastNear = -1
  px = 22.0
  py = 22.0
  pf = 3
  enterRoom(0)
  say("Walk right. Read the signs. Light the candles.", 100)
}

mod powerOn() {
  booted = true
  state = 0
  px = 22.0
  py = 22.0
  pf = 1
  for i in 0..W * H {
    fb[i] = 0
    bg[i] = 0
  }
  for i in 0..H { dirty[i] = 1 }
  room = 0
  loadR = 0
  mi0 = 0
  md0 = 0
  mi1 = 0
  md1 = 0
  say("SPACE to begin. WASD walk. A walk in memory of 13 people.", 100000)
}
mod powerOff() {
  booted = false
  state = -1
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
on ChatCommand("tc", "THIRTEEN debug: /tc <keys o(sit) l r u d j s> | /tc dump | /tc room N | /tc all") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "all" {
    for i in 0..${NP} { lit[i] = 1 }
    nLit = ${NCANDLE}
    nSign = ${NSIGN - 1}
  }
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
    if t % 20 == 0 { PrintToConsole("tcdbg|" .. t .. "|" .. state .. "|room " .. room .. " load " .. loadR .. "|p " .. px .. "," .. py .. "|lit " .. nLit .. " signs " .. nSign .. "|rd " .. reading .. "|" .. msg) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("tcrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = item
    kS = swing`}
    t += 1
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
      if finished && reading == ${NP} && kJ && !pJ && page == PL[${NP}] - 1 { newGame() }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then "in memory of the thirteen" else ("CANDLES " .. nLit .. "/${NCANDLE}   SIGNS " .. nSign .. "/${NSIGN}")
    audio()
    render()
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Triangle', 'Triangle', 'Square'] };
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./thirteen.gen.ws', import.meta.url), generate().src);
  console.log('wrote thirteen.gen.ws');
}
