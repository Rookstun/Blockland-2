// itwasntme/gen.mjs: IT WASN'T ME, a top-down sneak-and-frame game in one microchip (wirescript, Super Sigmas engine).
// Bonk your little brother Tyler over the head with your Skylanders portal while he hogs the TV, then frame him before
// Mom's investigation reaches you: cracked portal in HIS toy box, your marker on HIS wall, the cookie jar in HIS room,
// fake tears on your bed. Mom (and Dad from level 2) add suspicion when they catch you carrying things around.
// Mom inspects your room, then his, line by line, and grounds one of you.
//   inputs (@left): tick (20 Hz), seated, left right up down, grab (Space/RMB: pick up / drop / hold on your bed = cry),
//           swing (LMB/E: bonk / scribble)
//   outputs: strip0..strip8, msg_, hud_, title_, P0/V0 lead, P1/V1 bass, P2/V2 sfx, state_
export const W = 48, H = 36, STRIP = 4, TW = 24, TH = 18;
export const PAL = ['0d0a14', '3a2a20', '7a5a40', 'b08050', 'f8d040', '3868d8', '808088', 'f4f4f4',
  'e03838', 'f8c0a0', '2848a0', '101010', 'c8c8c0', '78e8f8', '3f8a3a', '6a4020'];

// ---- tiles: [tl, tr, bl, br] palette, solid
const TILES = {
  hud: [[0, 0, 0, 0], 1], wall: [[2, 2, 1, 1], 1], scrib: [[2, 2, 1, 1], 1], scribbled: [[8, 4, 10, 1], 1],
  wood: [[3, 3, 3, 3], 0], carpY: [[5, 5, 5, 5], 0], carpB: [[14, 14, 14, 14], 0], rug: [[6, 6, 6, 6], 0], ktile: [[12, 7, 7, 12], 0],
  bed: [[7, 7, 10, 10], 1], bbed: [[7, 7, 14, 14], 1], shelf: [[2, 2, 15, 15], 1], toybox: [[8, 8, 4, 4], 1], tv: [[11, 11, 6, 6], 1],
  couch: [[10, 10, 10, 10], 1], stove: [[6, 11, 11, 6], 1], counter: [[6, 6, 7, 7], 1], drawer: [[6, 6, 2, 2], 1],
};
const TN = Object.keys(TILES), T = Object.fromEntries(TN.map((k, i) => [k, i]));
// rooms: 1 yours, 2 Tyler's, 3 hall, 4 living room, 5 kitchen (0 = walls / doorways: seen only up close)
function house() {
  const t = Array(TW * TH).fill(T.wall), room = Array(TW * TH).fill(0);
  const fill = (x0, y0, x1, y1, k, r = 0) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { t[y * TW + x] = T[k]; room[y * TW + x] = r; } };
  fill(0, 0, TW - 1, 0, 'hud');
  fill(1, 2, 9, 6, 'carpY', 1);           // your room
  fill(11, 2, 22, 6, 'carpB', 2);         // Tyler's room
  fill(1, 8, 22, 9, 'rug', 3);            // hall
  fill(5, 7, 6, 7, 'rug'); fill(16, 7, 17, 7, 'rug');       // doors to the bedrooms
  fill(1, 11, 11, 16, 'wood', 4);         // living room
  fill(13, 11, 22, 16, 'ktile', 5);       // kitchen
  fill(4, 10, 5, 10, 'wood'); fill(18, 10, 19, 10, 'ktile'); fill(12, 12, 12, 13, 'wood'); // doors
  fill(1, 2, 2, 3, 'bed', 1); fill(8, 2, 8, 2, 'shelf', 1);
  fill(21, 2, 22, 3, 'bbed', 2); fill(20, 6, 21, 6, 'toybox', 2); fill(13, 1, 15, 1, 'scrib');
  fill(4, 11, 6, 11, 'tv', 4); fill(2, 15, 4, 15, 'couch', 4);
  fill(13, 11, 17, 11, 'counter', 5); fill(16, 11, 16, 11, 'drawer', 5); fill(20, 11, 21, 11, 'stove', 5);
  return { t, room };
}

// ---- sprites (rows of palette hex, '.' transparent). D = facing down (front), U = facing up (back)
const SPRITES = {
  youD: ['bbb', '999', 'aaa', 'b.b'], youU: ['bbb', 'bbb', 'aaa', 'b.b'], youW: ['bbb', '999', 'aaa', '.b.'],
  broD: ['fff', '9b9', '444', 'b.b'], broU: ['fff', 'fff', '444', 'b.b'], broCry: ['fff', 'd9d', '444', 'b.b'],
  momD: ['bbb', '9b9', '888', '888'], momU: ['bbb', 'bbb', '888', '888'],
  dadD: ['666', '9b9', '222', 'b.b'], dadU: ['666', '666', '222', 'b.b'],
  portal: ['dad', 'aaa'], cracked: ['d8d', 'a.a'], marker: ['8', '8'], jar: ['77', 'ff'],
  stars: ['4.4', '.4.'], bang: ['4', '4', '.', '4'], what: ['77', '.7', '..', '.7'], tear: ['d', '.', 'd'],
};
const SN = Object.keys(SPRITES), S = Object.fromEntries(SN.map((k, i) => [k, i]));

// ---- music (original): 0 sneaking, 1 panic (after the bonk), 2 grounded, 3 he's grounded
const SONGS = [
  { eighth: 4, loop: 1,
    lead: 'E4:1 R:1 G4:1 R:1 A4:1 R:1 B4:1 R:1 | C5:1 R:1 B4:1 R:1 A4:2 R:2 | E4:1 R:1 G4:1 R:1 A4:1 R:1 D#5:1 R:1 | E5:2 R:2 B4:2 R:2',
    bass: 'E2:2 B2:2 E2:2 B2:2 | A2:2 E3:2 A2:2 E3:2 | E2:2 B2:2 E2:2 B2:2 | B1:2 F#2:2 B1:2 D#2:2' },
  { eighth: 2, loop: 1,
    lead: 'E5:1 F5:1 E5:1 D#5:1 E5:1 F5:1 E5:1 D#5:1 | A5:2 G5:2 F5:2 E5:2',
    bass: 'E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 E2:1 E3:1 | D2:2 D3:2 C2:2 B1:2' },
  { eighth: 4, loop: 0, lead: 'C5:2 B4:2 A#4:2 A4:6', bass: 'C3:4 F#2:4 F2:6' },
  { eighth: 3, loop: 0, lead: 'C5:1 E5:1 G5:1 C6:3 G5:1 C6:5', bass: 'C3:2 E3:2 G3:2 C3:6' },
];
const SFX = {
  bonk: [0.4, 0.3, 0.25, 0.2], wah: [1.5, 1.6, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0], grab: [2.0, 2.5], drop: [1.0, 0.8],
  scribble: [3.0, 2.6, 3.2, 2.8, 3.0], sus: [0.6, 0.5, 0.6, 0.5], alert: [2.5, 2.5, 0.01, 2.5], swish: [1.8, 1.4, 1.0], sob: [1.0, 0.9, 1.0, 0.9],
};
const FX = Object.fromEntries(Object.keys(SFX).map((k, i) => [k, i]));

// Mom's route (cells, top-left of her 3x4 box): kitchen -> hall -> your room (index 4) -> hall -> Tyler's room (index 7)
const MX = [40, 38, 37, 11, 11, 11, 33, 33], MY = [24, 22, 16, 16, 9, 16, 16, 9];
const BX = [26, 36], BY = [24, 24];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midi = n => { const m = /^([A-G]#?)(-?\d)$/.exec(n); if (!m) throw Error(`bad note ${n}`); return NAMES.indexOf(m[1]) + 12 * (+m[2] + 1); };
const parseVoice = (s, e) => s.split(/\s+/).filter(t => t && t !== '|').map(tok => { const [n, d = '1'] = tok.split(':'); return [n === 'R' ? 0 : 2 ** ((midi(n) - 69) / 12), Math.round(+d * e)]; });

const q = s => JSON.stringify(s);
const fl = x => { const s = (+x).toFixed(4).replace(/0+$/, ''); return s.endsWith('.') ? s + '0' : s; };
const A = xs => `[${xs.join(', ')}]`;
const AF = xs => `[${xs.map(fl).join(', ')}]`;
const AS = xs => `[${xs.map(q).join(', ')}]`;

export function generate({ debug = false } = {}) {
  const NS = H / STRIP, NQ = 12;
  const hs = house();
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

  const src = `// GENERATED by itwasntme/gen.mjs: edit that, not this file.
// IT WASN'T ME: one frame per 'tick' pulse (20 Hz) while 'seated' is true. Standing up blanks the screen.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in grab: bool
@left in swing: bool

const W = ${W}
const H = ${H}
const NQ = ${NQ}
const TILEPIX = ${A(TN.flatMap(k => TILES[k][0]))}
const SOLID = ${A(TN.map(k => TILES[k][1]))}
const HOUSE = ${A(hs.t)}
const HOUSEPIX = ${A(Array.from({ length: W * H }, (_, i) => { const cx = i % W, cy = Math.floor(i / W); return TILES[TN[hs.t[(cy >> 1) * TW + (cx >> 1)]]][0][(cy % 2) * 2 + cx % 2]; }))}
const ROOM = ${A(hs.room)}
const SPR = ${A(spr)}
const SOFF = ${A(soff)}
const SW = ${A(sw)}
const SH = ${A(sh)}
const MX = ${AF(MX)}
const MY = ${AF(MY)}
const BX = ${AF(BX)}
const BY = ${AF(BY)}
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
const ITX0 = [16.0, 32.0, 28.0]
const ITY0 = [4.0, 22.0, 22.0]
const ITNAME = ["the portal", "your marker", "the cookie jar"]

var cur: int[] = ${zeros(TW * TH)}
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
var qs: string[] = ${zeros(NQ, '""')}
var qn: int = 0
var qi: int = 0
var qT: int = 0

var state: int = -1         // -1 off, 0 title, 1 playing, 2 grounded (game over)
var ph: int = 0             // 0 sneak, 1 Tyler stunned, 2 Tyler runs to Mom, 3 Mom listens, 4 Mom to your room,
                            // 5 inspects it, 6 Mom to his room, 7 inspects it, 8 verdict, 9 he's grounded (next level)
var phT: int = 0
var lvl: int = 1
var score: int = 0
var hi: int = 0
var t: int = 0
var px: float = 8.0
var py: float = 8.0
var pf: int = 1
var walking: bool = false
var hold: int = -1
var itx: float[] = [16.0, 32.0, 28.0]
var ity: float[] = [4.0, 22.0, 22.0]
var inbox: bool = false
var cracked: bool = false
var scribbled: bool = false
var cryN: int = 0
var crying: bool = false
var cried: bool = false
var sus: int = 0
var susCd: int = 0
var blame: int = 0
var bx: float = 10.0
var by: float = 24.0
var bi: int = 0
var blT: int = 0
var blWarned: bool = false
var mx: float = 40.0
var my: float = 24.0
var mf: int = 0
var mi: int = 0
var mlT: int = 0
var dx: float = 40.0
var dd: float = -1.0
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
var hhx: bool = false
var hhy: bool = false

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
@right out title_: string = if state == 0 then "IT WASN'T ME" else ""
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
mod queue(s: string) {
  if qn < NQ {
    qs[qn] = s
    qn += 1
  }
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
mod solid(cx: int, cy: int) -> int {
  if cx < 0 || cx >= W || cy < 0 || cy >= H { return 1 }
  return SOLID[cur[floor(cy / 2.0) * ${TW} + floor(cx / 2.0)]]
}
mod roomAt(x: float, y: float) -> int {
  let cx: int = floor(x)
  let cy: int = floor(y)
  if cx < 0 || cx >= W || cy < 0 || cy >= H { return 0 }
  return ROOM[floor(cy / 2.0) * ${TW} + floor(cx / 2.0)]
}
mod dist(ax: float, ay: float, bx0: float, by0: float) -> float {
  return sqrt((ax - bx0) * (ax - bx0) + (ay - by0) * (ay - by0))
}
// move a 3 x 4 box against solid tiles: result in hx, hy
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
// does someone at (ox, oy) facing f (0 up 1 down 2 left 3 right) see you? same room and in front, or up close
mod sees(ox: float, oy: float, f: int) -> bool {
  let cx = px + 1.5
  let cy = py + 2.0
  let ocx = ox + 1.5
  let ocy = oy + 2.0
  if dist(cx, cy, ocx, ocy) < 5.0 { return true }
  let r = roomAt(cx, cy)
  if r == 0 || r != roomAt(ocx, ocy) { return false }
  if f == 0 { return cy < ocy }
  if f == 1 { return cy > ocy }
  if f == 2 { return cx < ocx }
  return cx > ocx
}
mod momSees() -> bool {
  return sees(mx, my, mf)
}
mod dadSees() -> bool {
  return lvl >= 2 && sees(dx, 16.0, if dd < 0.0 then 2 else 3)
}
mod blPeriod() -> int {
  return max(70, 170 - lvl * 20)
}
mod itemRoom(i: int) -> int {
  if hold == i { return roomAt(px + 1.5, py + 2.0) }
  return roomAt(itx[i] + 1.0, ity[i] + 1.0)
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
mod tileCells(ti: int) {
  let tx = ti % ${TW}
  let ty = floor(ti / ${TW}.0)
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
mod itemSpr(i: int) -> int {
  if i == 0 { return if cracked then ${S.cracked} else ${S.portal} }
  if i == 1 { return ${S.marker} }
  return ${S.jar}
}
mod render() {
  for i in 0..rx.length() { eraseRect(rx[i], ry[i], rw[i], rh[i]) }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
  // items lying around
  for i in 0..3 {
    if hold != i { drawSpr(itemSpr(i), floor(itx[i]), floor(ity[i])) }
  }
  // Tyler: back to you at the TV, looking round, stunned, crying on his way to Mom
  let bl = ph == 0 && blT >= ${'blPeriod()'} - 25
  var bs: int = if bl then ${S.broD} else ${S.broU}
  if ph >= 1 { bs = ${S.broCry} }
  drawSpr(bs, floor(bx), floor(by))
  if ph == 0 && blT >= ${'blPeriod()'} - 40 && blT < ${'blPeriod()'} - 25 { drawSpr(${S.what}, floor(bx) + 1, floor(by) - 5) }
  if ph == 1 { drawSpr(${S.stars}, floor(bx) + (t / 3) % 2 - 1 + 1, floor(by) - 3) }
  if ph == 2 && t % 6 < 3 { drawSpr(${S.tear}, floor(bx) + 3, floor(by) + 1) }
  // Mom (turns round at the stove: ! first), Dad in the hall
  drawSpr(if mf == 1 then ${S.momD} else ${S.momU}, floor(mx), floor(my))
  if ph == 0 && mlT % 160 >= 105 && mlT % 160 < 120 { drawSpr(${S.bang}, floor(mx) + 1, floor(my) - 5) }
  if lvl >= 2 { drawSpr(if t % 8 < 4 then ${S.dadD} else ${S.dadU}, floor(dx), 16) }
  // you, with what you carry over your head
  let ys: int = if pf == 0 then ${S.youU} else (if walking && (t / 3) % 2 > 0 then ${S.youW} else ${S.youD})
  drawSpr(ys, floor(px), floor(py))
  if hold >= 0 { drawSpr(itemSpr(hold), floor(px) + (if hold == 0 then 0 else 1), floor(py) - 2) }
  if crying && t % 6 < 3 { drawSpr(${S.tear}, floor(px) - 1, floor(py) + 1) }
  // HUD: suspicion pips, level pips
  for i in 0..6 { put(1 + i * 2, 1, if i < sus then 8 else 1) }
  for i in 0..5 { put(W - 10 + i * 2, 1, if i < lvl then 4 else 1) }
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

// ---------- game
mod resetHouse() {
  cur.copyFrom(HOUSE)
  bg.copyFrom(HOUSEPIX)
  fb.copyFrom(HOUSEPIX)
  for i in 0..H { dirty[i] = 1 }
  rx.clear()
  ry.clear()
  rw.clear()
  rh.clear()
}
mod startLevel() {
  state = 1
  ph = 0
  phT = 0
  resetHouse()
  px = 8.0
  py = 8.0
  pf = 1
  hold = -1
  itx.copyFrom(ITX0)
  ity.copyFrom(ITY0)
  inbox = false
  cracked = false
  scribbled = false
  cryN = 0
  crying = false
  cried = false
  sus = 0
  susCd = 0
  blame = 0
  bx = 10.0
  by = 24.0
  bi = 0
  blT = 0
  mx = 40.0
  my = 24.0
  mf = 0
  mi = 0
  mlT = 0
  dx = 40.0
  dd = -1.0
  qn = 0
  qi = 0
  qT = 0
  playSong(0)
  say(if lvl == 1 then "Tyler took the TV. AGAIN. Get your portal." else ("Day " .. lvl .. ". Tyler is on the TV again." .. (if lvl == 2 then " Dad's home." else "")), 90)
}
mod caught(why: string) {
  state = 2
  phT = 0
  if score > hi { hi = score }
  playSong(2)
  sfx(${FX.sus})
  say(why, 100000)
}
mod addSus(who: string) {
  if susCd == 0 {
    sus += 1
    susCd = 70
    sfx(${FX.sus})
    say(who, 50)
  }
}
mod swingIt() {
  let cx = px + 1.5
  let cy = py + 2.0
  if hold == 0 && ph == 0 && dist(cx, cy, bx + 1.5, by + 2.0) < 6.0 {
    sfx(${FX.swish})
    if blT >= blPeriod() - 25 || cy < by + 1.0 {
      caught("Tyler saw it coming. 'MOOOOM!' You are SO grounded.")
    } else if momSees() {
      caught("Mom saw the whole thing. Grounded. Forever.")
    } else if dadSees() {
      caught("Dad saw. Dad is not mad, just disappointed. Grounded.")
    } else {
      cracked = true
      ph = 1
      phT = 0
      sfx(${FX.bonk})
      playSong(1)
      say("*BONK*  Tyler: 'WAAAAAAAAAH!!'  Now frame him. Fast.", 70)
    }
  } else if hold == 1 && !scribbled && cy < 8.0 && cx > 24.0 && cx < 34.0 {
    scribbled = true
    for i in 0..3 {
      cur[${TW} + 13 + i] = ${T.scribbled}
      tileCells(${TW} + 13 + i)
    }
    sfx(${FX.scribble})
    say("You draw a stick man on his wall. Labeled TYLER.", 60)
  } else if hold >= 0 {
    sfx(${FX.swish})
    say("You swing " .. ITNAME[hold] .. " at nothing.", 30)
  } else {
    say("You flail. It's not very effective.", 30)
  }
}
mod grabIt() {
  let cx = px + 1.5
  let cy = py + 2.0
  if hold >= 0 {
    let i = hold
    hold = -1
    itx[i] = px
    ity[i] = py + 2.0
    if i == 0 && dist(cx, cy, 42.0, 13.0) < 7.0 {
      itx[i] = 41.0
      ity[i] = 11.0
      inbox = true
      say("You bury the " .. (if cracked then "cracked " else "") .. "portal in HIS toy box.", 50)
    } else { say("You put down " .. ITNAME[i] .. ".", 30) }
    sfx(${FX.drop})
  } else {
    var best: int = -1
    var bd: float = 5.0
    for i in 0..3 {
      let d = dist(cx, cy, itx[i] + 1.0, ity[i] + 1.0)
      if d < bd {
        bd = d
        best = i
      }
    }
    if best >= 0 {
      hold = best
      if best == 0 { inbox = false }
      sfx(${FX.grab})
      say("You grab " .. ITNAME[best] .. ".", 30)
    }
  }
}
mod inspectYours() {
  sfx(${FX.alert})
  queue("Mom checks YOUR room first...")
  if crying {
    cried = true
    blame += 1
    queue("Mom: 'Oh sweetie, why are you crying?' (+1)")
  }
  if itemRoom(0) == 1 {
    sus += 2
    queue("Mom: 'Why is the cracked portal in YOUR room?' (+2 sus)")
  }
  if itemRoom(1) == 1 && scribbled {
    sus += 1
    queue("Mom: 'Your marker. Hm.' (+1 sus)")
  }
  if itemRoom(2) == 1 {
    sus += 1
    queue("Mom: 'And the cookie jar is in here because...?' (+1 sus)")
  }
  if hold >= 0 {
    sus += 1
    queue("Mom: 'Put that down. Now.' (+1 sus)")
  }
  if qn == 1 { queue("Mom: 'Hm. Clean.'") }
}
mod inspectHis() {
  sfx(${FX.alert})
  let n0 = qn
  queue("Then Mom checks Tyler's room...")
  if itemRoom(0) == 2 {
    blame += if inbox then 2 else 1
    queue(if inbox then "Mom: 'The portal. In HIS toy box. Cracked.' (+2)" else "Mom: 'Is that the portal on his floor?' (+1)")
  }
  if scribbled {
    blame += 1
    queue("Mom: 'He drew on his WALL?! A stick man?!' (+1)")
  }
  if itemRoom(1) == 2 {
    blame += 1
    queue("Mom: 'With YOUR marker, Tyler?!' (+1)")
  }
  if itemRoom(2) == 2 {
    blame += 1
    queue("Mom: 'AND the cookie jar. Unbelievable.' (+1)")
  }
  if qn == n0 + 1 { queue("Mom: 'Nothing in here. Interesting.'") }
}
mod verdict() {
  let need = 1 + lvl
  let net = blame - sus
  queue("Evidence " .. blame .. " - suspicion " .. sus .. " = " .. net .. " (need " .. need .. ")")
  if net >= need {
    queue("Mom: 'TYLER. Room. Now. No TV for a week.'")
  } else {
    queue("Mom: 'Nice try. YOU are grounded.'")
  }
}
mod playerTick() {
  let mvx: int = kR - kL
  let mvy: int = kD - kU
  walking = mvx != 0 || mvy != 0
  if mvy < 0 { pf = 0 } else if mvy > 0 || mvx != 0 { pf = 1 }
  moveBox(px, py, mvx * 0.4, mvy * 0.4)
  px = hx
  py = hy
  if kS && !pS { swingIt() }
  if kJ && !pJ { grabIt() }
  // fake tears: hold grab, empty-handed, at your bed
  let atBed = hold < 0 && kJ && dist(px + 1.5, py + 2.0, 4.0, 6.0) < 7.0
  if atBed { cryN += 1 } else { cryN = 0 }
  let was = crying
  crying = cryN > 10
  if crying && !was {
    sfx(${FX.sob})
    say("You summon real tears. Method acting.", 40)
  }
}
mod npcTick() {
  // Tyler looks round now and then while you sneak up
  if ph == 0 {
    blT += 1
    if blT >= blPeriod() {
      blT = 0
      blWarned = false
    }
    if blT >= blPeriod() - 25 && hold == 0 && !blWarned && dist(px, py, bx, by) < 12.0 {
      blWarned = true
      sus += 1
      sfx(${FX.sus})
      say("Tyler: 'Why are you holding the portal like that?' (+1 sus)", 60)
    }
  } else if ph == 1 {
    if phT > 50 {
      ph = 2
      phT = 0
      sfx(${FX.wah})
      say("Tyler runs to Mom, crying. Mom will want answers.", 60)
    }
  } else if ph == 2 {
    let gx = BX[bi]
    let gy = BY[bi]
    let d = dist(bx, by, gx, gy)
    if d < 0.2 {
      if bi < 1 { bi += 1 } else {
        ph = 3
        phT = 0
        mf = 2
        say("Mom: 'WHAT?! Who did this?!' (she is coming)", 60)
      }
    } else {
      bx = bx + (gx - bx) / d * min(d, 0.14)
      by = by + (gy - by) / d * min(d, 0.14)
    }
  }
  // Mom: at the stove she turns round every 8 s; then the investigation walk
  if ph <= 2 {
    mlT += 1
    mf = if mlT % 160 >= 120 then 1 else 0
  } else if ph == 3 {
    if phT > 50 {
      ph = 4
      phT = 0
    }
  } else if ph == 4 || ph == 6 {
    let gx = MX[mi]
    let gy = MY[mi]
    let d = dist(mx, my, gx, gy)
    let sp = 0.22 + lvl * 0.03
    if d < 0.2 {
      if mi == 4 {
        ph = 5
        phT = 0
        mf = 1
        inspectYours()
      } else if mi == 7 {
        ph = 7
        phT = 0
        mf = 0
        inspectHis()
      } else { mi += 1 }
    } else {
      let ddx = gx - mx
      let ddy = gy - my
      mf = if abs(ddx) > abs(ddy) then (if ddx < 0.0 then 2 else 3) else (if ddy < 0.0 then 0 else 1)
      mx = mx + ddx / d * min(d, sp)
      my = my + ddy / d * min(d, sp)
    }
  } else if ph == 5 {
    if crying && !cried {
      cried = true
      blame += 1
      queue("Mom: 'Oh sweetie, why are you crying?' (+1)")
    }
    if phT > 90 {
      ph = 6
      phT = 0
      mi = 5
    }
  } else if ph == 7 {
    if phT > 90 {
      ph = 8
      phT = 0
      verdict()
    }
  }
  // Dad paces the hall
  if lvl >= 2 {
    dx = dx + dd * (0.12 + lvl * 0.02)
    if dx < 3.0 { dd = 1.0 }
    if dx > 42.0 { dd = -1.0 }
  }
  // after the bonk, getting seen carrying evidence or lurking in his room costs you
  if ph >= 1 && ph <= 7 {
    if susCd > 0 { susCd -= 1 }
    let inHis = roomAt(px + 1.5, py + 2.0) == 2
    if hold >= 0 || inHis {
      if momSees() {
        addSus(if hold >= 0 then ("Mom: 'Why do you have " .. ITNAME[hold] .. "?' (+1 sus)") else "Mom: 'What are you doing in Tyler's room?' (+1 sus)")
      } else if dadSees() {
        addSus(if hold >= 0 then ("Dad: 'Put " .. ITNAME[hold] .. " back, bud.' (+1 sus)") else "Dad: 'That's not your room, champ.' (+1 sus)")
      }
    }
  }
}
mod finish() {
  // called once the verdict queue has been read out
  if blame - sus >= 1 + lvl {
    score += (blame - sus) * 100 + lvl * 50
    if score > hi { hi = score }
    ph = 9
    phT = 0
    playSong(3)
    say("TYLER IS GROUNDED. It wasn't you. SPACE = next day", 100000)
  } else {
    caught("You're grounded. No portal for a week. SPACE = retry")
  }
}

// ---------- power: the screen runs only while someone sits
mod powerOn() {
  booted = true
  state = 0
  lvl = 1
  resetHouse()
  bx = 10.0
  by = 24.0
  mx = 40.0
  my = 24.0
  mf = 0
  px = 8.0
  py = 8.0
  hold = -1
  itx.copyFrom(ITX0)
  ity.copyFrom(ITY0)
  cracked = false
  playSong(0)
  say("SPACE start. LMB/E swing, SPACE grab/drop/cry", 100000)
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
on ChatCommand("iwm", "IT WASN'T ME debug: /iwm <keys o(sit) l r u d j s> | /iwm dump | /iwm at X Y") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args.Contains("at ") {
    let p = args.Split(" ").Right.Split(" ")
    px = p.Left.ParseInt()
    py = p.Right.ParseInt()
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
    kJ = grab || dbk.Contains("j")
    kS = swing || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("iwdbg|" .. t .. "|" .. state .. "|ph " .. ph .. "|you " .. px .. "," .. py .. "|hold " .. hold .. "|bro " .. bx .. "," .. by .. "|mom " .. mx .. "," .. my .. " f" .. mf .. "|b " .. blame .. " s " .. sus .. "|items " .. itx.join(",") .. "/" .. ity.join(",") .. "|" .. msg) }
    if dumpReq {
      dumpReq = false
      for r in 0..H { PrintToConsole("iwrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = grab
    kS = swing`}
    t += 1
    phT += 1
    if state == 0 {
      if (kJ && !pJ) || (kS && !pS) {
        lvl = 1
        score = 0
        startLevel()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      if ph < 8 {
        playerTick()
        npcTick()
      } else if ph == 8 {
        if qi >= qn && qT == 0 { finish() }
      } else if ph == 9 {
        if phT > 30 && kJ && !pJ {
          lvl = min(lvl + 1, 5)
          startLevel()
          pJ = true
        }
      }
    } else if state == 2 {
      if phT > 40 && kJ && !pJ {
        lvl = 1
        score = 0
        startLevel()
        pJ = true
      }
    }
    // the investigation's lines, one every 2.5 s
    if qT > 0 { qT -= 1 }
    else if qi < qn {
      say(qs[qi], 50)
      qi += 1
      qT = 50
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    let phase = if ph == 0 then "BONK TYLER" else (if ph <= 3 then "FRAME HIM" else (if ph <= 7 then "MOM IS COMING" else "VERDICT"))
    hud = if state == 0 then ("a game about family. HI " .. hi) else ("DAY " .. lvl .. "  SUS " .. sus .. "  SCORE " .. score .. "  " .. phase)
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
  fs.writeFileSync(new URL('./itwasntme.gen.ws', import.meta.url), generate().src);
  console.log('wrote itwasntme.gen.ws');
}
