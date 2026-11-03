// greasepaint/gen.mjs: GREASEPAINT, a top-down stealth slasher in one microchip (wirescript). NEW ENGINE ("Lamplight"):
// a 24x18 tile map of 2x2-cell tiles, lamp light baked per map with line of sight, every hunter's flashlight cone
// cast live each tick (cone cells propagate from parent cells, walls/crates stop them), shadows hide you, the picture
// renders in thirds (6 tile rows a tick, 3 ticks a frame) with run-length coloured strips.
// You are a clown. Sneak up behind a hunter in the dark: the weapon goes up and a reticle appears. HOLD the button:
// white (Hasty, 4) -> yellow (Violent, 5) -> red (Gruesome, 6; bat 7; mallet/shotgun head-smash +1). Let go to kill.
// While you hold he keeps walking and may look round; the others keep looking too. Plain hits/shots kill for 2.
//   inputs: tick, seated, left right up down, honk (Space/RMB: start, lure), act (LMB/E: execute/hit/shoot)
//   outputs: strip0..strip8, msg_, hud_, title_, P0/V0 lead, P1/V1 bass, P2/V2 sfx, state_
export const W = 48, H = 36, STRIP = 4;
const TW = 24, TH = 18, NH = 8, NP = 4;
export const PAL = ['08080c', '16161f', '262433', '55536a', '8a8498', 'f0e070', 'b01818', '5a0a0e',
  'f6f6f6', 'e83030', '30c040', '3050d0', '1a2450', 'f08020', '6a4a2a', '3a2614'];

const MAPS = [
  { name: 'The Back Lot', map: [
    '########################',
    '#P.....c......L......c.#',
    '#......c..>............#',
    '#..cc..c.......cc...b..#',
    '#..cc..........cc......#',
    '#.........###......v...#',
    '#..L......#..#.........#',
    '#.........#..#...cc....#',
    '#....^....##.#...cc....#',
    '#..............<.......#',
    '#.cc...........L.......#',
    '#.cc.....ccc...........#',
    '#........c...........c.#',
    '#...m....c.......>.....#',
    '#........c...cc........#',
    '#.....L......cc....L...#',
    '#......................#',
    '########################'] },
  { name: 'Tinsel Junction Rail Yard', map: [
    '########################',
    '#P.......L.........g...#',
    '#..cccccccc..cccccccc..#',
    '#......................#',
    '#.>..........<.........#',
    '#..cccccccc..cccccccc..#',
    '#.........L............#',
    '#....##............##..#',
    '#....#..v.....^.....#..#',
    '#....##............##..#',
    '#..L...................#',
    '#..cccccccc..cccccccc..#',
    '#.....>................#',
    '#..........<........L..#',
    '#..cccccccc..cccccccc..#',
    '#..m........L..........#',
    '#.....b................#',
    '########################'] },
];
const DIRS = { '>': 0, v: 1, '<': 2, '^': 3 }, PICK = { b: 1, m: 2, g: 3 };
function parseMaps() {
  const tiles = [], light = [], lv = [];
  MAPS.forEach((m, l) => {
    if (m.map.length !== TH) throw Error(`map ${l} rows`);
    let start = null; const hs = [], ps = [], t = [];
    m.map.forEach((row, y) => {
      if (row.length !== TW) throw Error(`map ${l} row ${y}: ${row.length}`);
      [...row].forEach((ch, x) => {
        const k = { '.': 0, '#': 1, c: 2, L: 3 }[ch];
        if (k !== undefined) { t.push(k); return; }
        t.push(0);
        if (ch === 'P') start = [x + 0.5, y + 0.5];
        else if (ch in DIRS) hs.push([x + 0.5, y + 0.5, DIRS[ch]]);
        else if (ch in PICK) ps.push([x, y, PICK[ch]]);
        else throw Error(`map ${l}: '${ch}'`);
      });
    });
    if (!start || hs.length > NH || ps.length > NP) throw Error(`map ${l}: start / too many`);
    // lamp light: radius 3.3, line of sight sampled through tile centres (walls/crates block, but are lit themselves)
    const L = t.map(() => 0);
    t.forEach((k, i) => {
      if (k !== 3) return;
      const lx = i % TW + 0.5, ly = Math.floor(i / TW) + 0.5;
      for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
        const dx = x + 0.5 - lx, dy = y + 0.5 - ly, d = Math.hypot(dx, dy);
        if (d > 3.3) continue;
        let ok = true;
        for (let s = 1, n = Math.ceil(d * 3); s < n && ok; s++) {
          const cx = Math.floor(lx + dx * s / n), cy = Math.floor(ly + dy * s / n), j = cy * TW + cx;
          if (j !== i && j !== y * TW + x && t[j] !== 0) ok = false;
        }
        if (ok) L[y * TW + x] = 1;
      }
    });
    tiles.push(...t); light.push(...L); lv.push({ start, hs, ps });
  });
  return { tiles, light, lv };
}

// flashlight cone (dir 0 = +x): [forward, lateral, parent index]; parents come first. Width grows 1-3-3-5-5.
const CONE = [];
for (let d = 1; d <= 5; d++) for (let l = -Math.floor(d / 2); l <= Math.floor(d / 2); l++) {
  const pl = Math.abs(l) <= Math.floor((d - 1) / 2) ? l : l - Math.sign(l);
  CONE.push([d, l, d === 1 ? -1 : CONE.findIndex(([dd, ll]) => dd === d - 1 && ll === pl)]);
}
if (CONE.some(c => c[2] === -1 && c[0] > 1)) throw Error('cone parents');
const FX4 = [1, 0, -1, 0], FY4 = [0, 1, 0, -1];

// tile looks [tl, tr, bl, br]: dark, lit
const LOOK = [
  [[1, 1, 1, 1], [3, 3, 3, 3]],       // floor (dark speck added at runtime)
  [[2, 2, 0, 2], [4, 4, 2, 4]],       // wall
  [[15, 15, 0, 15], [14, 14, 15, 14]], // crate
  [[5, 5, 2, 2], [5, 5, 4, 2]],       // lamp post
];
// actor sprites: 1 corpse, 2 hunter lit, 3 hunter dark, 4 alert, 5 suspicious, 6 about to look round, 7 clown, 8 clown hidden, 9 clown raised
const SPR = [[0, 0, 0, 0], [6, 7, 11, 6], [13, 13, 11, 11], [14, 14, 12, 12], [6, 13, 11, 11], [5, 13, 11, 11],
  [8, 8, 11, 11], [9, 10, 8, 8], [9, 10, 4, 4], [9, 4, 8, 8]];
const PKS = [[0, 0, 0, 0], [3, 14, 14, 3], [14, 14, 3, 14], [4, 4, 3, 14]];
const WEAP = ['BALLOON ANIMAL', 'BASEBALL BAT', 'NOVELTY MALLET', 'HONKGUN'];

// kill lines [weapon][tier 0..2]
const KILL = [
  ['You twist a balloon dog around his neck. Squeak. Squeak. Done.',
   'Balloon poodle, then balloon giraffe, then he stops kicking. Long animals take time.',
   'You make a balloon animal OUT of him. It is not a recognised species. It is mostly red.'],
  ['One crack of the bat. He folds up like a lawn chair.',
   'Three swings, batting practice style. He is mostly a strike zone now.',
   'HOME RUN. His head leaves the park. The crowd (you) goes wild.'],
  ['BONK. A cartoon sound, a very real result.',
   'You play whack-a-mole on him. Every mole is his face.',
   'The mallet comes down until he is flat enough to slide under a door. HEAD SMASH +1.'],
  ['Point blank. A flag reading BANG pops out. So does his spine.',
   'Two barrels of confetti and buckshot. Mostly buckshot.',
   'You put the barrel to his ear and honk. There is no longer an ear. Or a head. HEAD SMASH +1.'],
];
const RATE = ['CLOWN SHOES', 'SAD MIME', 'BIG TOP', 'RINGMASTER OF RUIN'];

// music (original): 0 title calliope waltz, 1 stalking, 2 caught/dead, 3 level done
const SONGS = [
  { eighth: 3, loop: 1, lead: 'G4:2 B4:1 D5:1 B4:1 G4:1 | F#4:2 A4:1 C5:1 A4:1 F#4:1 | E4:2 G4:1 B4:1 G4:1 E4:1 | D#4:3 F#4:1 B4:2',
    bass: 'G2:2 D3:2 D3:2 | D2:2 A2:2 A2:2 | E2:2 B2:2 B2:2 | B1:2 F#2:2 F#2:2' },
  { eighth: 5, loop: 1, lead: 'R:4 E4:1 F4:1 R:2 | R:4 E4:1 D#4:1 R:2 | R:8 | B3:2 C4:2 R:4',
    bass: 'E2:2 R:2 E2:2 R:2 | E2:2 R:2 A#1:2 R:2 | E2:2 R:2 E2:2 R:2 | E2:2 R:2 F2:2 E2:2' },
  { eighth: 4, loop: 0, lead: 'C5:2 B4:2 A#4:2 A4:6', bass: 'C3:2 B2:2 A#2:2 A2:6' },
  { eighth: 3, loop: 0, lead: 'G4:1 C5:1 E5:1 G5:3 E5:1 G5:5', bass: 'C3:2 G2:2 C3:2 C2:6' },
];
const SFX = {
  honk: [0.9, 0.95, 0.9, 0.85, 0.9], hit: [0.4, 0.3], shot: [0.2, 0.18, 0.15, 0.12, 0.1, 0.08], spot: [2.0, 2.4, 2.8],
  hmm: [1.2, 1.25], k1: [0.6, 0.4], k2: [0.6, 0.5, 0.35, 0.25], k3: [0.7, 0.55, 0.45, 0.3, 0.22, 0.16, 0.12, 0.1],
  hurt: [0.5, 0.45, 0.4], pick: [2.0, 2.5, 3.0], tick: [3.0], fail: [1.0, 0.7, 0.5],
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
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;
  const HX = [], HY = [], HD = [], HO = [0], PX = [], PY = [], PK = [], PO = [0];
  for (const l of mp.lv) {
    for (const [x, y, d] of l.hs) { HX.push(x); HY.push(y); HD.push(d); } HO.push(HX.length);
    for (const [x, y, k] of l.ps) { PX.push(x); PY.push(y); PK.push(k); } PO.push(PX.length);
  }
  const stripCode = ks => ks.map(k => `    st${k} = ${Array.from({ length: STRIP }, (_, j) => `rows[${k * STRIP + j}]`).join(' .. "\\n" .. ')}`).join('\n');
  // run-length push of colour expression c onto row builder s (T = top cell row of a tile row, B = bottom)
  const push = (s, c) => `      if ${c} == c${s} { n${s} += 1 } else {
        if n${s} > 0 { s${s} = s${s} .. OPEN[c${s}] .. BLK[n${s}] .. CLOSE[c${s}] }
        c${s} = ${c}
        n${s} = 1
      }`;
  const flat = a => a.flat();

  const src = `// GENERATED by greasepaint/gen.mjs: edit that, not this file.
// GREASEPAINT (Lamplight engine): logic every 'tick' (20 Hz) while 'seated'; the picture renders a third a tick.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in honk: bool
@left in act: bool

const MAPT = ${A(mp.tiles)}
const MAPL = ${A(mp.light)}
const STX = ${AF(mp.lv.map(l => l.start[0]))}
const STY = ${AF(mp.lv.map(l => l.start[1]))}
const LVNAME = ${AS(MAPS.map(m => m.name))}
const NMAP = ${MAPS.length}
const HX0 = ${AF(HX)}
const HY0 = ${AF(HY)}
const HD0 = ${A(HD)}
const HO = ${A(HO)}
const PX0 = ${A(PX)}
const PY0 = ${A(PY)}
const PK0 = ${A(PK)}
const PO = ${A(PO)}
const CF = ${A(CONE.map(c => c[0]))}
const CL = ${A(CONE.map(c => c[1]))}
const CP = ${A(CONE.map(c => c[2]))}
const FX4 = ${A(FX4)}
const FY4 = ${A(FY4)}
const LOOK = ${A(flat(LOOK.map(flat)))}
const SPR = ${A(flat(SPR))}
const PKS = ${A(flat(PKS))}
const WEAP = ${AS(WEAP)}
const KILL = ${AS(flat(KILL))}
const RATE = ${AS(RATE)}
const TIERN = ${AS(['HASTY', 'VIOLENT', 'GRUESOME'])}
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

var cur: int[] = ${zeros(TW * TH)}
var lgt: int[] = ${zeros(TW * TH)}
var dyn: int[] = ${zeros(TW * TH, '-1')}
var actS: int[] = ${zeros(TW * TH, '-1')}
var actK: int[] = ${zeros(TW * TH)}
var blood: int[] = ${zeros(TW * TH)}
var pkAt: int[] = ${zeros(TW * TH)}
var cvis: int[] = ${zeros(CONE.length)}
var rows: string[] = ${zeros(H, '""')}
${Array.from({ length: NS }, (_, k) => `var st${k}: string = ""`).join('\n')}
var msg: string = ""
var msgT: int = 0
var hud: string = ""
var booted: bool = false
var seed: int = 12345

var state: int = -1         // -1 off, 0 title, 1 playing, 2 dead, 3 level done
var stT: int = 0
var t: int = 0
var lvl: int = 0
var loop: int = 0
var px: float = 1.5
var py: float = 1.5
var pd: int = 0
var hp: int = 5
var weap: int = 0
var shells: int = 0
var pts: int = 0
var pts0: int = 0
var kills: int = 0
var execs: int = 0
var execPts: int = 0
var alive: int = 0
var cd: int = 0
var honkCd: int = 0
var stun: int = 0
var hurtT: int = 0
var flashR: int = 0
var hidden: bool = true
var seenAny: bool = false
// execution: tgt = hunter in reach from behind (-1 none), hold = ticks held, anim = kill animation left
var tgt: int = -1
var hold: int = 0
var holdD: int = 0
var anim: int = 0
var animTile: int = 0
var animTier: int = 0
var kL: bool = false
var kR: bool = false
var kU: bool = false
var kD: bool = false
var kJ: bool = false
var kS: bool = false
var pJ: bool = false
var pS: bool = false

// hunters: hs 0 patrol, 1 searching (goal hgx,hgy), 2 alert, 3 dead, 4 looking round; -1 unused
var hs: int[] = ${zeros(NH, '-1')}
var hx: float[] = ${zeros(NH, '0.0')}
var hy: float[] = ${zeros(NH, '0.0')}
var hd: int[] = ${zeros(NH)}
var hpH: int[] = ${zeros(NH)}
var ht: int[] = ${zeros(NH)}
var hlb: int[] = ${zeros(NH)}
var hgx: float[] = ${zeros(NH, '0.0')}
var hgy: float[] = ${zeros(NH, '0.0')}
var hcd: int[] = ${zeros(NH)}
var hlost: int[] = ${zeros(NH)}
var hsus: int[] = ${zeros(NH)}
var hseen: int[] = ${zeros(NH)}   // 0 no, 1 glimpse in lamp light, 2 in his flashlight / right in front

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

${Array.from({ length: NS }, (_, k) => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = msg
@right out hud_: string = hud
@right out title_: string = if state == 0 then "GREASEPAINT" else ""
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
mod rnd(n: int) -> int {
  seed = (seed * 75 + 74) % 65537
  return seed % n
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
  if cx < 0 || cy < 0 || cx >= ${TW} || cy >= ${TH} { return 1 }
  return cur[cy * ${TW} + cx]
}
mod tileOf(x: float, y: float) -> int {
  let cx: int = floor(x)
  let cy: int = floor(y)
  return cy * ${TW} + cx
}
mod dirTo(dx: float, dy: float) -> int {
  if abs(dx) >= abs(dy) { return if dx >= 0.0 then 0 else 2 }
  return if dy >= 0.0 then 1 else 3
}
// clear line between two points (samples every third of a tile)
mod los(ax: float, ay: float, bx: float, by: float) -> bool {
  let dx = bx - ax
  let dy = by - ay
  let n: int = min(30, floor(sqrt(dx * dx + dy * dy) * 3.0) + 1)
  var ok: bool = true
  for s in 1..n {
    if ok && tileAt(ax + dx * s / n, ay + dy * s / n) != 0 { ok = false }
  }
  return ok
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
    aV0 = if md0 <= 1 then 0.0 else 0.25 * max(0.4, 1.0 - mt0 * 0.04)
  } else { aV0 = 0.0 }
  if mp1 > 0.0 {
    aP1 = mp1
    aV1 = if md1 <= 1 then 0.0 else 0.5
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

// ---------- light: every live hunter's flashlight cone, stamped with this tick; also who can see the clown
mod castCones() {
  let ctile = if state == 1 then tileOf(px, py) else -1
  let clit = ctile >= 0 && lgt[ctile] == 1
  for k in 0..${NH} {
    hseen[k] = 0
    let s = hs[k]
    if s >= 0 && s != 3 {
      let d = hd[k]
      let fx = FX4[d]
      let fy = FY4[d]
      let bx: int = floor(hx[k])
      let by: int = floor(hy[k])
      for c in 0..${CONE.length} {
        let p = CP[c]
        cvis[c] = 0
        if p < 0 || cvis[p] == 1 {
          let x = bx + fx * CF[c] - fy * CL[c]
          let y = by + fy * CF[c] + fx * CL[c]
          if x >= 0 && y >= 0 && x < ${TW} && y < ${TH} {
            let i = y * ${TW} + x
            dyn[i] = t
            if cur[i] == 0 { cvis[c] = 1 }
            if i == ctile { hseen[k] = 2 }
          }
        }
      }
      if ctile >= 0 && hseen[k] == 0 {
        let dx = px - hx[k]
        let dy = py - hy[k]
        let ahead = dx * fx + dy * fy
        let dd = dx * dx + dy * dy
        if ahead > 0.0 && dd < 2.0 { hseen[k] = 2 }
        else if clit && ahead > 0.0 && dd < 64.0 && los(hx[k], hy[k], px, py) { hseen[k] = 1 }
      }
    }
  }
}

// ---------- rendering: tile rows r0..r1-1 -> cell rows
mod stamp() {
  for k in 0..${NH} {
    let s = hs[k]
    if s >= 0 {
      let i = tileOf(hx[k], hy[k])
      actS[i] = t
      if s == 3 { actK[i] = 1 }
      else if s == 2 { actK[i] = 4 }
      else if s == 1 { actK[i] = 5 }
      else if s == 0 && hlb[k] <= 12 && t % 4 < 2 { actK[i] = 6 }
      else { actK[i] = if lgt[i] == 1 || dyn[i] == t then 2 else 3 }
    }
  }
  if state >= 1 {
    let i = tileOf(px, py)
    actS[i] = t
    actK[i] = if tgt >= 0 || anim > 0 then 9 else (if hidden then 8 else 7)
  }
}
mod compose(r0: int, r1: int) {
  let rt: int = if tgt >= 0 && state == 1 then tileOf(hx[tgt], hy[tgt]) else -1
  let rtx = rt % ${TW}
  let rty: int = floor(rt / ${TW})
  let rc: int = if hold >= 45 then 9 else (if hold >= 20 then 5 else 8)
  for ty in r0..r1 {
    var sT: string = ""
    var cT: int = -1
    var nT: int = 0
    var sB: string = ""
    var cB: int = -1
    var nB: int = 0
    for tx in 0..${TW} {
      let i = ty * ${TW} + tx
      let tp = cur[i]
      let cone = dyn[i] == t
      let lit: int = if lgt[i] == 1 || cone then 1 else 0
      let o = (tp * 2 + lit) * 4
      var a: int = LOOK[o]
      var b: int = LOOK[o + 1]
      var c: int = LOOK[o + 2]
      var d: int = LOOK[o + 3]
      if tp == 0 {
        if cone && lgt[i] == 0 {
          b = 4
          c = 4
        } else if lit == 0 && (tx * 7 + ty * 3) % 5 == 0 { d = 2 }
      }
      let bl = blood[i]
      if bl > 0 {
        let bc = if lit == 1 then 6 else 7
        a = bc
        if bl > 1 { d = bc }
        if bl > 2 { b = bc }
        if bl > 3 { c = bc }
      }
      let pk = pkAt[i]
      if pk > 0 {
        a = PKS[pk * 4]
        b = PKS[pk * 4 + 1]
        c = PKS[pk * 4 + 2]
        d = PKS[pk * 4 + 3]
      }
      if actS[i] == t {
        let so = actK[i] * 4
        a = SPR[so]
        b = SPR[so + 1]
        c = SPR[so + 2]
        d = SPR[so + 3]
      }
      if rt >= 0 && abs(tx - rtx) == 1 && abs(ty - rty) == 1 {
        if tx < rtx && ty < rty { d = rc }
        else if tx > rtx && ty < rty { c = rc }
        else if tx < rtx { b = rc }
        else { a = rc }
      }
      if flashR > 0 && (tx == 0 || ty == 0 || tx == ${TW - 1} || ty == ${TH - 1}) {
        a = 6
        b = 6
        c = 6
        d = 6
      }
      if hurtT > 0 && (tx == 0 || tx == ${TW - 1}) {
        a = 9
        c = 9
      }
${push('T', 'a')}
${push('T', 'b')}
${push('B', 'c')}
${push('B', 'd')}
    }
    rows[ty * 2] = sT .. OPEN[cT] .. BLK[nT] .. CLOSE[cT]
    rows[ty * 2 + 1] = sB .. OPEN[cB] .. BLK[nB] .. CLOSE[cB]
  }
}

// ---------- game
mod loadLevel() {
  let m = lvl % NMAP
  cur.slice(MAPT, m * ${TW * TH}, ${TW * TH})
  lgt.slice(MAPL, m * ${TW * TH}, ${TW * TH})
  for i in 0..${TW * TH} {
    blood[i] = 0
    pkAt[i] = 0
  }
  for i in PO[m]..PO[m + 1] { pkAt[PY0[i] * ${TW} + PX0[i]] = PK0[i] }
  for k in 0..${NH} { hs[k] = -1 }
  alive = 0
  for i in HO[m]..HO[m + 1] {
    let k = i - HO[m]
    hs[k] = 0
    hx[k] = HX0[i]
    hy[k] = HY0[i]
    hd[k] = HD0[i]
    hpH[k] = 3
    hcd[k] = 0
    hlb[k] = 60 + rnd(90)
    alive += 1
  }
  px = STX[m]
  py = STY[m]
  pd = 0
  hp = 5
  weap = 0
  shells = 0
  tgt = -1
  hold = 0
  anim = 0
  stun = 0
  kills = 0
  execs = 0
  execPts = 0
  pts0 = pts
  state = 1
  stT = 0
  playSong(1)
  say(LVNAME[m] .. ". " .. alive .. " hunters with flashlights. Stay in the dark, get behind them, HOLD E.", 120)
}
mod newGame() {
  lvl = 0
  loop = 0
  pts = 0
  loadLevel()
}
mod alertNear(x: float, y: float, r2: float, gx: float, gy: float) {
  for k in 0..${NH} {
    let s = hs[k]
    if s == 0 || s == 1 || s == 4 {
      let dx = hx[k] - x
      let dy = hy[k] - y
      if dx * dx + dy * dy < r2 {
        hs[k] = 1
        hgx[k] = gx
        hgy[k] = gy
        ht[k] = 0
      }
    }
  }
}
mod killHunter(k: int, tier: int) {
  hs[k] = 3
  alive -= 1
  kills += 1
  let i = tileOf(hx[k], hy[k])
  blood[i] = min(4, blood[i] + tier + 1)
  if alive == 0 {
    state = 3
    stT = 0
  }
}
mod execute(tier: int) {
  let k = tgt
  var p: int = 3 + tier
  if tier == 3 && weap >= 1 { p += 1 }
  pts += p
  execs += 1
  execPts += p
  animTile = tileOf(hx[k], hy[k])
  animTier = tier
  anim = 10 + tier * 15
  if tier == 3 { flashR = 6 }
  sfx(if tier == 1 then ${FX.k1} else (if tier == 2 then ${FX.k2} else ${FX.k3}))
  say(TIERN[tier - 1] .. " +" .. p .. ": " .. KILL[weap * 3 + tier - 1], 90)
  killHunter(k, tier)
  tgt = -1
  hold = 0
}
mod splatter() {
  // the kill animation: blood creeps out from the body, further for nastier tiers
  anim -= 1
  if anim % 6 == 0 && animTier >= 2 {
    let r = animTier - 1
    let x = animTile % ${TW} + rnd(r * 2 + 1) - r
    let y: int = floor(animTile / ${TW}) + rnd(r * 2 + 1) - r
    if x > 0 && y > 0 && x < ${TW - 1} && y < ${TH - 1} {
      let i = y * ${TW} + x
      if cur[i] == 0 { blood[i] = min(4, blood[i] + animTier - 1) }
    }
  }
  if anim == 0 && alive == 0 {
    let avg: int = if execs > 0 then floor(execPts * 10 / execs) else 0
    let rk: int = if avg >= 60 then 3 else (if avg >= 50 then 2 else (if execs > 0 then 1 else 0))
    playSong(3)
    say("BACKSTAGE. " .. kills .. " down, +" .. (pts - pts0) .. " pts. STYLE: " .. RATE[rk] .. ". Space: next act.", 100000)
  }
}
mod attack() {
  cd = 10
  if weap == 3 && shells > 0 {
    shells -= 1
    sfx(${FX.shot})
    alertNear(px, py, 100.0, px, py)
    var hitK: int = -1
    for s in 1..10 {
      if hitK == -1 {
        let x = px + FX4[pd] * s
        let y = py + FY4[pd] * s
        if tileAt(x, y) != 0 { hitK = -2 }
        else {
          let i = tileOf(x, y)
          for k in 0..${NH} {
            if hitK < 0 && hs[k] >= 0 && hs[k] != 3 && tileOf(hx[k], hy[k]) == i { hitK = k }
          }
        }
      }
    }
    if hitK >= 0 {
      pts += 2
      killHunter(hitK, 1)
      say("BLAM. +2. Effective, but nobody will write a song about it. " .. shells .. " shells left.", 60)
    } else { say("BLAM. You hit a wall. The wall is fine. " .. shells .. " shells left.", 50) }
    return
  }
  var best: int = -1
  for k in 0..${NH} {
    if hs[k] >= 0 && hs[k] != 3 {
      let dx = hx[k] - px
      let dy = hy[k] - py
      if dx * dx + dy * dy < 1.7 { best = k }
    }
  }
  if best < 0 {
    sfx(${FX.hit})
    return
  }
  let dmg = if weap == 2 then 3 else (if weap == 1 then 2 else 1)
  hpH[best] = hpH[best] - dmg
  sfx(${FX.hit})
  if hpH[best] <= 0 {
    pts += 2
    killHunter(best, 1)
    say("You beat him to death the boring way. +2. The audience checks its phone.", 60)
  } else {
    hs[best] = 2
    hlost[best] = 0
    say("WHACK. He is hurt and VERY awake now.", 40)
  }
}
mod findTarget() {
  tgt = -1
  for k in 0..${NH} {
    let s = hs[k]
    if (s == 0 || s == 1) && tgt < 0 {
      let dx = px - hx[k]
      let dy = py - hy[k]
      let dd = dx * dx + dy * dy
      let behind = dx * FX4[hd[k]] + dy * FY4[hd[k]]
      if dd < 1.8 && behind < 0.0 - 0.5 * sqrt(dd) { tgt = k }
    }
  }
}
mod playerTick() {
  if cd > 0 { cd -= 1 }
  if honkCd > 0 { honkCd -= 1 }
  if hurtT > 0 { hurtT -= 1 }
  if flashR > 0 { flashR -= 1 }
  if anim > 0 {
    splatter()
    return
  }
  if stun > 0 {
    stun -= 1
    return
  }
  if hold > 0 {
    let k = tgt
    // he looked round or saw you: the reticle was too greedy
    if (hs[k] != 0 && hs[k] != 1) || hd[k] != holdD {
      hs[k] = 2
      hlost[k] = 0
      hold = 0
      tgt = -1
      stun = 15
      hp -= 1
      hurtT = 6
      sfx(${FX.fail})
      say("He turns round mid wind-up. You both scream. He screams louder and hits you.", 70)
      return
    }
    // the clown keeps step right behind him
    let nx = hx[k] - FX4[hd[k]] * 0.85
    let ny = hy[k] - FY4[hd[k]] * 0.85
    if tileAt(nx, ny) == 0 {
      px = nx
      py = ny
    }
    pd = hd[k]
    if kS { hold += 1 }
    if hold == 20 || hold == 45 { sfx(${FX.tick}) }
    if !kS || hold >= 90 { execute(if hold >= 45 then 3 else (if hold >= 20 then 2 else 1)) }
    return
  }
  let mvx: float = (kR - kL) * 0.11
  let mvy: float = (kD - kU) * 0.11
  if mvx != 0.0 || mvy != 0.0 { pd = dirTo(mvx, mvy) }
  if mvx != 0.0 && tileAt(px + mvx + (if mvx > 0.0 then 0.3 else -0.3), py) == 0 { px += mvx }
  if mvy != 0.0 && tileAt(px, py + mvy + (if mvy > 0.0 then 0.3 else -0.3)) == 0 { py += mvy }
  let i = tileOf(px, py)
  let pk = pkAt[i]
  if pk > 0 {
    pkAt[i] = 0
    weap = pk
    if pk == 3 { shells = 4 }
    sfx(${FX.pick})
    say("You found the " .. WEAP[pk] .. ". " .. (if pk == 1 then "Gruesome kills with it are worth 7." else (if pk == 2 then "Heavy. Gruesome head smashes +1." else "4 shells. Loud. Gruesome head smashes +1.")), 70)
  }
  findTarget()
  if kS && !pS && cd == 0 {
    if tgt >= 0 {
      hold = 1
      holdD = hd[tgt]
      say("HOLD... white = hasty, yellow = violent, red = gruesome. Let go to kill.", 60)
    } else { attack() }
  }
  if kJ && !pJ && honkCd == 0 {
    honkCd = 40
    sfx(${FX.honk})
    alertNear(px, py, 49.0, px, py)
    say("HONK. Somebody is coming to see what that was.", 40)
  }
}
mod hurt(n: int) {
  hp -= n
  hurtT = 6
  sfx(${FX.hurt})
  if hp <= 0 && state == 1 {
    hp = 0
    state = 2
    stT = 0
    tgt = -1
    hold = 0
    playSong(2)
    say("They got you. Your nose honks one last time. Space: try this act again.", 100000)
  }
}
mod stepTo(k: int, gx: float, gy: float, sp: float) -> bool {
  let dx = gx - hx[k]
  let dy = gy - hy[k]
  if dx * dx + dy * dy < sp * sp * 4.0 { return true }
  // shortcut: greedy axis steering, no pathfinding; a hunter stuck behind a crate gives up via his timer
  if abs(dx) >= abs(dy) {
    let vx = if dx > 0.0 then sp else 0.0 - sp
    if tileAt(hx[k] + vx + (if vx > 0.0 then 0.3 else -0.3), hy[k]) == 0 { hx[k] = hx[k] + vx }
    else if abs(dy) > 0.05 { hy[k] = hy[k] + (if dy > 0.0 then sp else 0.0 - sp) }
    hd[k] = if vx > 0.0 then 0 else 2
  } else {
    let vy = if dy > 0.0 then sp else 0.0 - sp
    if tileAt(hx[k], hy[k] + vy + (if vy > 0.0 then 0.3 else -0.3)) == 0 { hy[k] = hy[k] + vy }
    else if abs(dx) > 0.05 { hx[k] = hx[k] + (if dx > 0.0 then sp else 0.0 - sp) }
    hd[k] = if vy > 0.0 then 1 else 3
  }
  return false
}
mod hunterTick() {
  let hard = min(4, loop + lvl)
  for k in 0..${NH} {
    let s = hs[k]
    if s >= 0 && s != 3 {
      if hcd[k] > 0 { hcd[k] = hcd[k] - 1 }
      let seen = hseen[k]
      if seen > 0 && state == 1 { seenAny = true }
      if s == 0 || s == 4 {
        if seen == 2 && state == 1 {
          hs[k] = 2
          hlost[k] = 0
          hcd[k] = 12
          sfx(${FX.spot})
          say("'CLOWN!' Flashlight in your face. Run for the dark.", 50)
          alertNear(hx[k], hy[k], 36.0, px, py)
        } else if seen == 1 && state == 1 {
          hs[k] = 1
          hgx[k] = px
          hgy[k] = py
          ht[k] = 0
          hsus[k] = 0
          sfx(${FX.hmm})
          say("'Hm? Something red over there.'", 40)
        } else if s == 0 {
          let fx = FX4[hd[k]]
          let fy = FY4[hd[k]]
          let sp = 0.045 + hard * 0.008
          if tileAt(hx[k] + fx * (sp + 0.5), hy[k] + fy * (sp + 0.5)) != 0 { hd[k] = (hd[k] + 2) % 4 }
          else {
            hx[k] = hx[k] + fx * sp
            hy[k] = hy[k] + fy * sp
          }
          hlb[k] = hlb[k] - 1
          if hlb[k] <= 0 {
            hs[k] = 4
            ht[k] = 30
            hd[k] = (hd[k] + 2) % 4
          }
        } else {
          ht[k] = ht[k] - 1
          if ht[k] <= 0 {
            hs[k] = 0
            hd[k] = (hd[k] + 2) % 4
            hlb[k] = 50 + rnd(110 - hard * 15)
          }
        }
      } else if s == 1 {
        if seen == 2 || (seen == 1 && hsus[k] > 20) {
          hs[k] = 2
          hlost[k] = 0
          hcd[k] = 12
          sfx(${FX.spot})
          say("'THERE HE IS!'", 40)
          alertNear(hx[k], hy[k], 36.0, px, py)
        } else {
          if seen == 1 {
            hsus[k] = hsus[k] + 1
            hgx[k] = px
            hgy[k] = py
          }
          ht[k] = ht[k] + 1
          let there = stepTo(k, hgx[k], hgy[k], 0.05)
          if there && ht[k] % 15 == 0 { hd[k] = (hd[k] + 1) % 4 }
          if ht[k] > 160 {
            hs[k] = 0
            hx[k] = floor(hx[k]) + 0.5
            hy[k] = floor(hy[k]) + 0.5
            hlb[k] = 60 + rnd(90)
            hsus[k] = 0
          }
        }
      } else if s == 2 {
        if seen > 0 {
          hgx[k] = px
          hgy[k] = py
          hlost[k] = 0
        } else { hlost[k] = hlost[k] + 1 }
        let dx = px - hx[k]
        let dy = py - hy[k]
        let dd = dx * dx + dy * dy
        if seen > 0 && dd < 36.0 && los(hx[k], hy[k], px, py) {
          hd[k] = dirTo(dx, dy)
          if hcd[k] == 0 && state == 1 {
            hcd[k] = max(16, 34 - hard * 4)
            hurt(1)
            if hp > 0 { say("BANG. They shoot clowns, don't they. HP " .. hp, 30) }
          }
        } else { let arrived = stepTo(k, hgx[k], hgy[k], 0.08) }
        if hlost[k] > 90 {
          hs[k] = 1
          ht[k] = 0
          hsus[k] = 0
          say("'Lost him. Keep your lights up.'", 40)
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
  loop = 0
  let m = 0
  cur.slice(MAPT, 0, ${TW * TH})
  lgt.slice(MAPL, 0, ${TW * TH})
  for i in 0..${TW * TH} {
    blood[i] = 0
    pkAt[i] = 0
  }
  for k in 0..${NH} { hs[k] = -1 }
  for i in HO[0]..HO[1] {
    hs[i] = 0
    hx[i] = HX0[i]
    hy[i] = HY0[i]
    hd[i] = HD0[i]
    hlb[i] = 60 + rnd(90)
  }
  playSong(0)
  say("Space: start.  WASD sneak, E/LMB hold behind a hunter to execute, Space/RMB honk", 100000)
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
${Array.from({ length: NS }, (_, k) => `  st${k} = ""`).join('\n')}
}

${debug ? `var dbk: string = ""
var dumpReq: bool = false
var god: bool = false
on ChatCommand("gp", "GREASEPAINT debug: /gp <keys o(sit) l r u d j s> | dump | god | lvl | behind") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "god" { god = !god }
  else if args == "behind" {
    var f: int = -1
    for k in 0..${NH} { if f < 0 && (hs[k] == 0 || hs[k] == 1) { f = k } }
    if f >= 0 {
      px = hx[f] - FX4[hd[f]] * 0.9
      py = hy[f] - FY4[hd[f]] * 0.9
    }
  }
  else if args == "lvl" {
    lvl += 1
    loadLevel()
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
    kJ = honk || dbk.Contains("j")
    kS = act || dbk.Contains("s")
    if god { hp = 5 }
    if t % 20 == 0 { PrintToConsole("gpdbg|" .. t .. "|" .. state .. "|" .. px .. "," .. py .. "|hp " .. hp .. " pts " .. pts .. " tgt " .. tgt .. " hold " .. hold .. "|hs " .. hs.join(",") .. "|" .. msg .. "|len " .. st4.Length()) }
    if dumpReq && t % 3 == 2 {
      dumpReq = false
      for r in 0..${H} { PrintToConsole("gprow|" .. r .. "|" .. rows[r]) }
    }` : `    kL = left
    kR = right
    kU = up
    kD = down
    kJ = honk
    kS = act`}
    t += 1
    stT += 1
    seenAny = false
    castCones()
    if state == 0 {
      hunterTick()
      if (kJ && !pJ) || (kS && !pS) {
        newGame()
        pJ = true
        pS = true
      }
    } else if state == 1 {
      hunterTick()
      if state == 1 { playerTick() }
      let i = tileOf(px, py)
      hidden = lgt[i] == 0 && dyn[i] != t
    } else if state == 2 {
      hunterTick()
      if stT > 30 && kJ && !pJ {
        pts = pts0
        loadLevel()
        pJ = true
      }
    } else if state == 3 {
      if anim > 0 { splatter() }
      if flashR > 0 { flashR -= 1 }
      if stT > 30 && anim == 0 && kJ && !pJ {
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
    let ret = if hold >= 45 then "<color=\\"e83030\\">GRUESOME</>" else (if hold >= 20 then "<color=\\"f0e070\\">VIOLENT</>" else "<color=\\"f6f6f6\\">HASTY</>")
    hud = if state == 0 then "a clown, some flashlights, and you" else ("HP " .. hp .. "  PTS " .. pts .. "  " .. WEAP[weap] .. (if weap == 3 then " x" .. shells else "") .. "  " ..
      (if tgt >= 0 && hold > 0 then ret else (if tgt >= 0 then "<color=\\"f6f6f6\\">BEHIND HIM</>" else (if seenAny then "<color=\\"e83030\\">SEEN</>" else (if hidden then "HIDDEN" else "<color=\\"f0e070\\">LIT</>")))) ..
      "  LEFT " .. alive)
    audio()
    stamp()
    let ph = t % 3
    compose(ph * 6, ph * 6 + 6)
    if ph == 0 {
${stripCode([0, 1, 2])}
    } else if ph == 1 {
${stripCode([3, 4, 5])}
    } else {
${stripCode([6, 7, 8])}
    }
    pJ = kJ
    pS = kS
  }
}
`;
  return { src, W, H, STRIP, PAL, synths: ['Square', 'Triangle', 'Square'] };
}
