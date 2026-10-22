// brickdoom/gen.mjs: BRICK DOOM, a first-person raycaster shooter in one microchip (wirescript, cabinet engine of
// supersigmas/cabinet.mjs). Own maps, monsters and music. 24 ray columns (2 blocks wide) x 36 rows, billboard sprites
// against a per-column depth buffer, gun overlay. One frame = 2 ticks (rows 0-19 on even ticks, 20-35 on odd ones)
// so each tick stays well inside the 10 ms wire budget; game logic runs every tick.
//   inputs: tick, seated, left/right = turn, up/down = walk, use (Space/RMB: doors, exit switch, start), fire (LMB/E)
//   outputs: strip0..strip8, msg_, hud_, title_, P0/V0 lead, P1/V1 bass, P2/V2 sfx, state_
export const W = 48, H = 36, STRIP = 4;
const C = 24, MW = 16;
export const PAL = ['0a0a0e', '24242c', '3e3428', '9a9aa0', '62626a', 'a06a3a', '6a4424', '4aa04a',
  '2a6a2a', 'f0c040', '9a7a20', 'c0301c', '7a1a10', '5a5a66', 'e0b090', 'f8f8f0'];
// tiles: 0 floor, 1 stone, 2 brown, 3 green, 4 door, 5 exit switch; light / dark (side or far) palette
const WL = [0, 3, 5, 7, 13, 9], WD = [0, 4, 6, 8, 4, 10];

const MAPS = [
  ['1111111111111111',
   '1......2.......1',
   '1.e....2...e...1',
   '1......D.......1',
   '1..33..........1',
   '1..33....h..2221',
   '1..............1',
   '1.....e........1',
   '1222..222..e...1',
   '1..............1',
   '1.a.....33.....1',
   '1.......33..e..1',
   '1.........e....1',
   '1.....2....a...1',
   '1.P...2.......X1',
   '1111111111111111'],
  ['1111111111111111',
   '1P.1.....e....h1',
   '1..1..3333.....1',
   '1..D..3..3..e..1',
   '1..1..3..3.....1',
   '1111..3..D.....1',
   '1.e...3333..2221',
   '1...........2.X1',
   '1.2222..e...2..1',
   '1....2......D..1',
   '1.a..2..e...2221',
   '1....2.........1',
   '1..e.....33..e.1',
   '1........33....1',
   '1..h....a......1',
   '1111111111111111'],
];
const NE = 12;
function parseMaps() {
  const tiles = [], sp = [];
  MAPS.forEach((m, l) => {
    if (m.length !== MW) throw Error(`map ${l} rows`);
    let start = null; const ents = [];
    m.forEach((row, y) => {
      if (row.length !== MW) throw Error(`map ${l} row ${y}`);
      [...row].forEach((ch, x) => {
        const t = { '.': 0, '1': 1, '2': 2, '3': 3, D: 4, X: 5 }[ch];
        if (t !== undefined) { tiles.push(t); if ((x === 0 || y === 0 || x === MW - 1 || y === MW - 1) && !t) throw Error(`map ${l} open edge`); return; }
        tiles.push(0);
        if (ch === 'P') start = [x + 0.5, y + 0.5];
        else if ({ e: 1, h: 3, a: 4 }[ch]) ents.push([{ e: 1, h: 3, a: 4 }[ch], x + 0.5, y + 0.5]);
        else throw Error(`map ${l}: '${ch}'`);
      });
    });
    if (!start || ents.length > NE) throw Error(`map ${l}: start / too many things`);
    sp.push({ start, ents });
  });
  return { tiles, sp };
}

// gun overlay (columns 0-23 x rows 0-35, -1 = none) and the muzzle flash
function overlay(cells) { const a = Array(C * H).fill(-1); for (const [r, c0, c1, col] of cells) for (let c = c0; c <= c1; c++) a[r * C + c] = col; return a; }
const GUN = overlay([[28, 11, 12, 13], [29, 11, 12, 13], [30, 11, 12, 13], [31, 10, 13, 13], [32, 10, 13, 13], [33, 9, 14, 14], [34, 9, 14, 14], [35, 9, 14, 14], [32, 11, 12, 0]]);
const FLASH = overlay([[25, 11, 12, 9], [26, 10, 13, 9], [26, 11, 12, 15], [27, 11, 12, 9]]);

// music (original): 0 title, 1 levels, 2 death, 3 level done
const SONGS = [
  { eighth: 4, loop: 1, lead: 'E4:4 G4:2 F#4:2 E4:4 D4:2 B3:2 | E4:4 G4:2 A4:2 B4:6 R:2',
    bass: 'E2:2 E2:2 E2:2 E2:2 C2:2 C2:2 D2:2 D2:2 | E2:2 E2:2 E2:2 E2:2 G2:2 G2:2 B1:2 B1:2' },
  { eighth: 3, loop: 1,
    lead: 'R:8 | R:8 | B4:1 R:1 B4:1 A4:1 G4:2 E4:2 | F#4:1 R:1 F#4:1 G4:1 F#4:2 D4:2',
    bass: 'E2:2 G2:1 E2:1 A2:2 E2:1 A#2:1 | E2:2 G2:1 E2:1 D3:2 C#3:1 C3:1 | E2:2 G2:1 E2:1 A2:2 E2:1 A#2:1 | E2:2 G2:1 E2:1 B2:2 A#2:1 A2:1' },
  { eighth: 4, loop: 0, lead: 'E4:2 D#4:2 D4:2 C#4:8', bass: 'E2:4 D#2:4 D2:8' },
  { eighth: 3, loop: 0, lead: 'E4:1 G4:1 B4:1 E5:3 D5:1 E5:5', bass: 'E2:2 G2:2 B2:2 E2:6' },
];
const SFX = {
  shot: [0.25, 0.2, 0.3, 0.15, 0.1], empty: [3.0], pain: [0.6, 0.5, 0.45, 0.4], impdie: [0.5, 0.45, 0.35, 0.3, 0.25, 0.2],
  imphit: [0.8, 0.7], pick: [2.0, 2.5, 3.0], door: [0.3, 0.35, 0.4, 0.45, 0.5], exit: [1.0, 1.5, 2.0, 2.5], claw: [1.2, 0.9],
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
  const NS = H / STRIP;
  const mp = parseMaps();
  const voices = [[], []], vo = [[], []], vl = [[], []];
  for (const s of SONGS) [s.lead, s.bass].forEach((txt, v) => { const n = parseVoice(txt, s.eighth); vo[v].push(voices[v].length); vl[v].push(n.length); voices[v].push(...n); });
  const fxp = [], fxo = [], fxl = [];
  for (const k of Object.keys(SFX)) { fxo.push(fxp.length); fxl.push(SFX[k].length); fxp.push(...SFX[k]); }
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK2 = Array.from({ length: C + 1 }, (_, n) => '█'.repeat(2 * n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const strips = Array.from({ length: NS }, (_, k) => k);
  const SPK = [], SPX = [], SPY = [], SPO = [0];
  for (const s of mp.sp) { for (const [k, x, y] of s.ents) { SPK.push(k); SPX.push(x); SPY.push(y); } SPO.push(SPK.length); }
  const stripCode = ks => ks.map(k => `  st${k} = ${Array.from({ length: STRIP }, (_, j) => `rows[${k * STRIP + j}]`).join(' .. "\\n" .. ')}`).join('\n');

  const src = `// GENERATED by brickdoom/gen.mjs: edit that, not this file.
// BRICK DOOM: logic every 'tick' (20 Hz) while 'seated'; the picture renders in two halves on alternate ticks.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in use: bool
@left in fire: bool

const H = ${H}
const NE = ${NE}
const MAPT = ${A(mp.tiles)}
const STX = ${AF(mp.sp.map(s => s.start[0]))}
const STY = ${AF(mp.sp.map(s => s.start[1]))}
const SPK = ${A(SPK)}
const SPX = ${AF(SPX)}
const SPY = ${AF(SPY)}
const SPO = ${A(SPO)}
const NMAP = ${MAPS.length}
const WL = ${A(WL)}
const WD = ${A(WD)}
const COS = ${AF(Array.from({ length: 64 }, (_, i) => Math.cos(i / 64 * Math.PI * 2)))}
const SIN = ${AF(Array.from({ length: 64 }, (_, i) => Math.sin(i / 64 * Math.PI * 2)))}
const CAMX = ${AF(Array.from({ length: C }, (_, c) => 2 * (c + 0.5) / C - 1))}
const GUN = ${A(GUN)}
const FLASH = ${A(FLASH)}
const OPEN = ${AS(OPEN)}
const CLOSE = ${AS(CLOSE)}
const BLK2 = ${AS(BLK2)}
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

var cur: int[] = ${zeros(MW * MW)}
var rows: string[] = ${zeros(H, '""')}
${strips.map(k => `var st${k}: string = ""`).join('\n')}
var msg: string = ""
var msgT: int = 0
var hud: string = ""
var booted: bool = false

var state: int = -1         // -1 off, 0 title (attract: the camera turns), 1 playing, 2 dead, 3 level done
var stT: int = 0
var t: int = 0
var lvl: int = 0
var loop: int = 0
var px: float = 2.5
var py: float = 14.5
var ai: int = 0
var dirX: float = 1.0
var dirY: float = 0.0
var plX: float = 0.0
var plY: float = 0.66
var hp: int = 100
var ammo: int = 30
var kills: int = 0
var total: int = 0
var cd: int = 0
var flash: int = 0
var hurtT: int = 0
var kL: bool = false
var kR: bool = false
var kU: bool = false
var kD: bool = false
var kJ: bool = false
var kS: bool = false
var pJ: bool = false
var pS: bool = false

var ek: int[] = ${zeros(NE)}
var ex: float[] = ${zeros(NE, '0.0')}
var ey: float[] = ${zeros(NE, '0.0')}
var ehp: int[] = ${zeros(NE)}
var ecd: int[] = ${zeros(NE)}
var efl: int[] = ${zeros(NE)}

var wtop: float[] = ${zeros(C, '0.0')}
var wbot: float[] = ${zeros(C, '0.0')}
var wcol: int[] = ${zeros(C)}
var zb: float[] = ${zeros(C, '0.0')}
var sid: int[] = ${zeros(C)}
var sd: float[] = ${zeros(C, '0.0')}
var stp: float[] = ${zeros(C, '0.0')}
var sbt: float[] = ${zeros(C, '0.0')}

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
@right out title_: string = if state == 0 then "BRICK DOOM" else ""
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
mod tileAt(x: float, y: float) -> int {
  let cx: int = floor(x)
  let cy: int = floor(y)
  if cx < 0 || cy < 0 || cx >= ${MW} || cy >= ${MW} { return 1 }
  return cur[cy * ${MW} + cx]
}
mod setDir() {
  dirX = COS[ai]
  dirY = SIN[ai]
  plX = 0.0 - SIN[ai] * 0.66
  plY = COS[ai] * 0.66
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
    aV0 = if md0 <= 1 then 0.0 else 0.3 * max(0.4, 1.0 - mt0 * 0.05)
  } else { aV0 = 0.0 }
  if mp1 > 0.0 {
    aP1 = mp1
    aV1 = if md1 <= 1 then 0.0 else 0.6
  } else { aV1 = 0.0 }
  if fxId >= 0 {
    if fxI < FXL[fxId] {
      aP2 = FXP[FXO[fxId] + fxI]
      aV2 = 0.6
      fxI += 1
    } else {
      fxId = -1
      aV2 = 0.0
    }
  } else { aV2 = 0.0 }
}

// ---------- rendering
mod castRays() {
  for c in 0..${C} {
    let cam = CAMX[c]
    let rdx = dirX + plX * cam
    let rdy = dirY + plY * cam
    var mx: int = floor(px)
    var my: int = floor(py)
    let ddx: float = if abs(rdx) < 0.0001 then 10000.0 else abs(1.0 / rdx)
    let ddy: float = if abs(rdy) < 0.0001 then 10000.0 else abs(1.0 / rdy)
    var stx: int = 1
    var sty: int = 1
    var sdx: float = (mx + 1.0 - px) * ddx
    var sdy: float = (my + 1.0 - py) * ddy
    if rdx < 0.0 {
      stx = -1
      sdx = (px - mx) * ddx
    }
    if rdy < 0.0 {
      sty = -1
      sdy = (py - my) * ddy
    }
    var hit: int = 0
    var side: int = 0
    for i in 0..24 {
      if hit == 0 {
        if sdx < sdy {
          sdx += ddx
          mx += stx
          side = 0
        } else {
          sdy += ddy
          my += sty
          side = 1
        }
        hit = cur[my * ${MW} + mx]
      }
    }
    let perp: float = max(0.05, if side == 0 then sdx - ddx else sdy - ddy)
    let lh = ${H}.0 / perp
    wtop[c] = 18.0 - lh * 0.5
    wbot[c] = 18.0 + lh * 0.5
    wcol[c] = if side == 1 || perp > 7.0 then WD[hit] else WL[hit]
    zb[c] = perp
    sid[c] = -1
    sd[c] = 99.0
  }
}
mod project() {
  let invDet = 1.0 / (plX * dirY - dirX * plY)
  for k in 0..NE {
    let kind = ek[k]
    if kind > 0 {
      let sx = ex[k] - px
      let sy = ey[k] - py
      let tx = invDet * (dirY * sx - dirX * sy)
      let ty = invDet * (0.0 - plY * sx + plX * sy)
      if ty > 0.25 {
        let scr = ${C / 2}.0 * (1.0 + tx / ty)
        let wd: float = if kind == 1 then 11.0 / ty else (if kind == 2 then 13.0 / ty else 7.0 / ty)
        let ht: float = if kind == 1 then 32.0 / ty else (if kind == 2 then 6.0 / ty else 12.0 / ty)
        let bot = 18.0 + 18.0 / ty
        let c0: int = max(0, floor(scr - wd * 0.5))
        let c1: int = min(${C - 1}, floor(scr + wd * 0.5))
        if c1 >= c0 {
          for c in c0..c1 + 1 {
            if ty < zb[c] && ty < sd[c] {
              sid[c] = k
              sd[c] = ty
              stp[c] = bot - ht
              sbt[c] = bot
            }
          }
        }
      }
    }
  }
}
mod sprColor(k: int, r: int, c: int) -> int {
  let kind = ek[k]
  let f = (r - stp[c]) / max(0.5, sbt[c] - stp[c])
  if efl[k] > 0 { return 15 }
  if kind == 1 {
    if f < 0.1 { return 12 }
    if f > 0.2 && f < 0.28 { return 9 }
    if f > 0.78 { return 12 }
    return 11
  }
  if kind == 2 { return if r % 2 == 0 then 12 else 11 }
  if kind == 3 { return if f > 0.35 && f < 0.65 then 11 else 15 }
  return if f < 0.3 then 10 else 9
}
mod compose(r0: int, r1: int) {
  for r in r0..r1 {
    var s: string = ""
    var c0: int = -1
    var n: int = 0
    for c in 0..${C} {
      var col: int = 0
      let g = GUN[r * ${C} + c]
      let fl = if flash > 0 then FLASH[r * ${C} + c] else -1
      if fl >= 0 { col = fl }
      else if g >= 0 && state != 0 { col = g }
      else if hurtT > 0 && (c == 0 || c == ${C - 1} || r == 0 || r == ${H - 1}) { col = 11 }
      else if sid[c] >= 0 && r >= stp[c] && r < sbt[c] { col = sprColor(sid[c], r, c) }
      else if r < wtop[c] { col = if r < 9 then 0 else 1 }
      else if r < wbot[c] { col = wcol[c] }
      else { col = 2 }
      if col == c0 { n += 1 } else {
        if n > 0 { s = s .. OPEN[c0] .. BLK2[n] .. CLOSE[c0] }
        c0 = col
        n = 1
      }
    }
    rows[r] = s .. OPEN[c0] .. BLK2[n] .. CLOSE[c0]
  }
}

// ---------- game
mod loadLevel() {
  let m = lvl % NMAP
  cur.slice(MAPT, m * ${MW * MW}, ${MW * MW})
  px = STX[m]
  py = STY[m]
  ai = 0
  setDir()
  for k in 0..NE { ek[k] = 0 }
  total = 0
  kills = 0
  var k: int = 0
  for i in SPO[m]..SPO[m + 1] {
    ek[k] = SPK[i]
    ex[k] = SPX[i]
    ey[k] = SPY[i]
    ehp[k] = 3 + loop
    ecd[k] = 0
    efl[k] = 0
    if SPK[i] == 1 { total += 1 }
    k += 1
  }
  state = 1
  stT = 0
  playSong(1)
  say("LEVEL " .. (lvl + 1) .. ". Find the yellow switch. Kill what moves.", 80)
}
mod newGame() {
  lvl = 0
  loop = 0
  hp = 100
  ammo = 30
  loadLevel()
}
mod fireGun() {
  if ammo <= 0 {
    sfx(${FX.empty})
    say("Click. Out of ammo. Find a yellow box.", 30)
  } else {
    ammo -= 1
    cd = 7
    flash = 3
    sfx(${FX.shot})
    let k = sid[${C / 2}]
    if k >= 0 && ek[k] == 1 {
      ehp[k] = ehp[k] - 1
      efl[k] = 2
      if ehp[k] <= 0 {
        ek[k] = 2
        kills += 1
        sfx(${FX.impdie})
        if kills == total { say("All imps dead. Go find the switch.", 50) }
      } else { sfx(${FX.imphit}) }
    }
  }
}
mod useIt() {
  let fx = px + dirX * 1.0
  let fy = py + dirY * 1.0
  let tl = tileAt(fx, fy)
  if tl == 4 {
    let cx: int = floor(fx)
    let cy: int = floor(fy)
    cur[cy * ${MW} + cx] = 0
    sfx(${FX.door})
    say("The door grinds open.", 30)
  } else if tl == 5 {
    sfx(${FX.exit})
    state = 3
    stT = 0
    playSong(3)
    say("LEVEL " .. (lvl + 1) .. " DONE. Kills " .. kills .. "/" .. total .. ". USE for the next one.", 100000)
  }
}
mod playerTick() {
  if kL { ai = (ai + 63) % 64 }
  if kR { ai = (ai + 1) % 64 }
  setDir()
  let mv: float = (kU - kD) * 0.11
  if mv != 0.0 {
    let nx = px + dirX * mv
    let ny = py + dirY * mv
    let rx: float = if dirX * mv > 0.0 then 0.25 else -0.25
    let ry: float = if dirY * mv > 0.0 then 0.25 else -0.25
    if tileAt(nx + rx, py) == 0 { px = nx }
    if tileAt(px, ny + ry) == 0 { py = ny }
  }
  if cd > 0 { cd -= 1 }
  if flash > 0 { flash -= 1 }
  if hurtT > 0 { hurtT -= 1 }
  if kS && cd == 0 { fireGun() }
  if kJ && !pJ { useIt() }
}
mod monsterTick() {
  for k in 0..NE {
    let kind = ek[k]
    if efl[k] > 0 { efl[k] = efl[k] - 1 }
    if kind > 0 {
      let ddx = px - ex[k]
      let ddy = py - ey[k]
      let d = sqrt(ddx * ddx + ddy * ddy)
      if kind == 1 {
        if ecd[k] > 0 { ecd[k] = ecd[k] - 1 }
        if d < 0.9 {
          if ecd[k] == 0 && state == 1 {
            ecd[k] = 18
            hp -= 8 + loop * 2
            hurtT = 4
            sfx(${FX.claw})
            if hp <= 0 {
              hp = 0
              state = 2
              stT = 0
              playSong(2)
              say("YOU DIED. An imp is wearing your helmet. USE to try again.", 100000)
            }
          }
        } else if d < 11.0 {
          let sp = 0.035 + loop * 0.01
          let nx = ex[k] + ddx / d * sp
          let ny = ey[k] + ddy / d * sp
          if tileAt(nx, ey[k]) == 0 { ex[k] = nx }
          if tileAt(ex[k], ny) == 0 { ey[k] = ny }
        }
      } else if (kind == 3 || kind == 4) && d < 0.6 && state == 1 {
        ek[k] = 0
        sfx(${FX.pick})
        if kind == 3 {
          hp = min(100, hp + 25)
          say("Medkit. +25 health.", 30)
        } else {
          ammo += 10
          say("Box of bullets. +10.", 30)
        }
      }
    }
  }
}

// ---------- power: the screen runs only while someone sits
mod powerOn() {
  booted = true
  state = 0
  stT = 0
  lvl = 0
  let m = 0
  cur.slice(MAPT, 0, ${MW * MW})
  px = STX[0]
  py = STY[0]
  for k in 0..NE { ek[k] = 0 }
  for i in SPO[0]..SPO[1] {
    ek[i] = SPK[i]
    ex[i] = SPX[i]
    ey[i] = SPY[i]
  }
  playSong(0)
  say("USE (Space) start. W/S walk, A/D turn, LMB/E shoot", 100000)
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
on ChatCommand("bd", "BRICK DOOM debug: /bd <keys o(sit) l r u d j s> | /bd dump") -> (ctrl, args) {
  if args == "dump" { dumpReq = true } else { dbk = args }
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
    kJ = use || dbk.Contains("j")
    kS = fire || dbk.Contains("s")
    if t % 20 == 0 { PrintToConsole("bddbg|" .. t .. "|" .. state .. "|" .. px .. "," .. py .. " a" .. ai .. "|hp " .. hp .. " ammo " .. ammo .. " k " .. kills .. "/" .. total .. "|ek " .. ek.join(",") .. "|" .. msg .. "|len " .. st4.Length()) }
    if dumpReq && t % 2 == 1 {
      dumpReq = false
      for r in 0..H { PrintToConsole("bdrow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = use
    kS = fire`}
    t += 1
    stT += 1
    if state == 0 {
      if t % 3 == 0 {
        ai = (ai + 1) % 64
        setDir()
      }
      if (kJ && !pJ) || (kS && !pS) {
        newGame()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      playerTick()
      monsterTick()
    } else if state == 2 {
      monsterTick()
      if stT > 30 && kJ && !pJ {
        hp = 100
        ammo = 30
        loadLevel()
        pJ = true
      }
    } else if state == 3 {
      if stT > 20 && kJ && !pJ {
        lvl += 1
        if lvl % NMAP == 0 { loop += 1 }
        loadLevel()
        pJ = true
      }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    hud = if state == 0 then "a game about violence" else ("HP " .. hp .. "  AMMO " .. ammo .. "  KILLS " .. kills .. "/" .. total .. "  LEVEL " .. (lvl + 1))
    audio()
    if t % 2 == 0 {
      castRays()
      project()
      compose(0, 20)
${stripCode([0, 1, 2, 3, 4])}
    } else {
      compose(20, ${H})
${stripCode([5, 6, 7, 8])}
    }
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}
