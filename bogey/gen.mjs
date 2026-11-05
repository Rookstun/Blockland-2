// bogey/gen.mjs: BOGEY NIGHTS, an original NES-style cockpit-view jet shooter on the Super Sigmas cabinet
// (tools/wspkg + supersigmas/cabinet.mjs). Owner: "plays like Top Gun for the NES, skip carrier landings, loadout +
// briefing between every level, guns missiles countermeasures + sound fx, resolution bigger than the other ones".
// Own name, art, missions, writing: nothing taken from the real game.
//   96 x 54 picture (others max 64 x 36): rows 0-35 = the view (tilting horizon, perspective ground stripes, sprites),
//   rows 36-53 = cockpit (live radar, LOCK / IR / RADAR lamps, damage bar). Text screens reuse the picture rows.
//   W/S pitch (W = nose down, flight stick style), A/D bank + turn, LMB/E hold = guns, Space/RMB = missile (needs a
//   lock), Q = flares (beat IR missiles), C = chaff (beats RADAR missiles). 4 missions: kill the quota, then the boss.
//   Any loaded store empty -> yellow exfil ring near the launch spot (view + radar edge): rearm (no jet lost) or re-arm the mission.
//   inputs: tick (20 Hz), seated, left right up down, a, b, q, c
//   outputs: strip0..8, msg_, hud_, title_, P0..P4 / V0..V4 (guns, whoosh/boom, alarm/lock, engine, countermeasures)
export const W = 96, H = 54, STRIP = 6;
const VH = 36, CK = H - VH, CX = 48, CY = 18, NE = 5, NM = 5, NP = 2, NX = 8, NDL = 64, MAXT = 1400;

// ---- palette (index 0 = panel colour, never drawn by sprites)
const PALN = {
  bg: '0c1030', w: 'ffffff', g: '9aa0a8', d: '50565e', D: '2a2e34', r: 'ff3020', y: 'ffd040', o: 'ff8a20', G: '30ff60',
  c: '40e0ff', k: '000000', dg: '1a5a2a', t: 'c8b070', b: '6b4a2a', P: '3c4048', m: 'e060ff', ol: '7a8a50', lt: 'c0c4d0',
};
const THEMES = [ // sky near-horizon -> top, ground stripe a/b
  { sky: ['a8d0f8', '78a8e8', '4a80d0', '2a58a8'], gnd: ['1e5aa0', '2a6ab8'] },  // day ocean
  { sky: ['f8e0b0', 'e8b080', '8890c8', '4a5aa0'], gnd: ['c8a060', 'b08848'] },  // desert
  { sky: ['f8a060', 'd06070', '704a90', '302860'], gnd: ['2e6b2a', '3c7c32'] },  // dusk forest
  { sky: ['3a4278', '242c58', '161c40', '0a0e24'], gnd: ['0c2440', '123250'] },  // night sea
];
export const PAL = [...Object.values(PALN), ...THEMES.flatMap(t => [...t.sky, ...t.gnd])];
const PI = Object.fromEntries(Object.keys(PALN).map((k, i) => [k, i]));
const TH0 = Object.keys(PALN).length; // theme colours start here: theme th sky b = TH0 + th*6 + b, ground s = +4+s

// ---- sprites: '.' transparent, letters = palette keys (one char), 'g' = tint slot
const CH = { w: PI.w, g: PI.g, d: PI.d, D: PI.D, r: PI.r, y: PI.y, o: PI.o, G: PI.G, c: PI.c, k: PI.k, t: PI.t, b: PI.b, m: PI.m };
const SPRITES = {
  B0: ['gkg'],
  B1: ['...d...', 'ggdkdgg', '..r.r..'],
  B2: ['..d.....d..', '..d.ddd.d..', 'gggggkggggg', '....r.r....'],
  B3: ['...d.........d...', '...dd.......dd...', '....d..ddd..d....', 'gggggggdkdggggggg', '..gggg.dkd.gggg..', '......rk.kr......'],
  BLIMP: ['......ggggggggggggg......', '...ggggwwwwwwwwwwwgggg..r', '.gggggggggggggggggggggrrr', 'gggggggggggggggggggggggrr',
    '.gggggggggggggggggggggrrr', '...gggggggggggggggggg...r', '......ggggggggggggg......', '...........dkd...........'],
  CASTLE: ['..y.........y.........y..', '..t.........t.........t..', '.ttt.......ttt.......ttt.', '.t.t.t.t.t.ttt.t.t.t.t.t.',
    '.ttttttttttttttttttttttt.', '.tttkktttttttttttttkkttt.', '.ttttttttttbbbtttttttttt.', '.ttttttttttbbbtttttttttt.', 'bbbbbbbbbbbbbbbbbbbbbbbbb'],
  WING: ['.............k.............', '..........kkkkkkk..........', '.....kkkkkkkrkrkkkkkkk.....', 'kkkkkkkkkkkkkkkkkkkkkkkkkkk',
    '..kkkk..kkkk...kkkk..kkkk..'],
  SHIP: ['...............y...............', '...............d...............', '............ddddddd............', '.......dd...ddwdwdd...dd.......',
    '....ddddddddddddddddddddddd....', 'ddddddddddddddddddddddddddddddd', '.ddddddddddddddddddddddddddddd.', '..rrrrrrrrrrrrrrrrrrrrrrrrrrr..'],
  M0: ['g'],
  M1: ['.g.', 'gwg', '.g.'],
  M2: ['..g..', '.ggg.', 'ggwgg', '.ggg.', '..g..'],
  X0: ['.y.', 'yoy', '.y.'],
  X1: ['.oyo.', 'oyyyo', 'yywyy', 'oyyyo', '.oyo.'],
  X2: ['.r.o.r.', 'ro.y.or', '.oyoyo.', 'ro.y.or', '.r.o.r.'],
  X3: ['..d.d..', '.d...d.', 'd..k..d', '...k...', 'd..k..d', '.d...d.', '..d.d..'],
  CROSS: ['GG.....GG', 'G.......G', '....G....', 'G.......G', 'GG.....GG'],
  LOCK: ['gg.........gg', 'g...........g', '.............', '.............', '.............', 'g...........g', 'gg.........gg'],
  DOT: ['g'],
  TRACE: ['gg'],
  EX0: ['y'],
  EX1: ['.y.', 'y.y', '.y.'],
  EX2: ['.yyy.', 'y...y', '.yyy.'],
  EX3: ['..yyyyy..', '.y.....y.', 'y.......y', '.y.....y.', '..yyyyy..'],
};
const SID = Object.fromEntries(Object.keys(SPRITES).map((k, i) => [k, i]));
const SPRW = [], SPRH = [], SPRO = [], SPRD = [];
for (const [name, rows] of Object.entries(SPRITES)) {
  if (rows.some(r => r.length !== rows[0].length)) throw Error(`sprite ${name}: ragged rows ${rows.map(r => r.length)}`);
  SPRW.push(rows[0].length); SPRH.push(rows.length); SPRO.push(SPRD.length);
  for (const r of rows) for (const ch of r) { if (ch !== '.' && CH[ch] === undefined) throw Error(`sprite ${name}: bad char ${ch}`); SPRD.push(ch === '.' ? 0 : CH[ch]); }
}

// ---- missions + weapons (KoL-flavoured, all original)
const MISSIONS = [
  { name: 'OPERATION SMUG BALLOON', quota: 8, irp: 100, sam: 0, firep: 2, boss: 'BLIMP', bname: 'THE SMUG DIRIGIBLE', bhp: 40, gnd: 0, tint: PI.g,
    intel: 'INTEL: HEAT SEEKERS (IR) ONLY. FLARES (Q) WORK. CHAFF IS JUST CONFETTI.', def: [0, 10, 5, 1, 5],
    brief: ['COMMANDER GRUFFLY CHEWS AN UNLIT CIGAR. HE IS AFRAID OF FIRE,', 'WHICH IS AN ODD THING TO BE IN THIS LINE OF WORK.', '',
      'AN ENEMY BLIMP HAS PARKED OVER OUR OCEAN AND IS BEING SMUG ABOUT IT.', 'IT IS GUARDED BY SILVER JETS BOUGHT SECONDHAND FROM A MAN NAMED DENNIS.', '',
      'SHOOT DOWN 8 BOGEYS. THEN POP THE BLIMP. TRY NOT TO ENJOY IT TOO MUCH.'] },
  { name: 'OPERATION SANDCASTLE', quota: 10, irp: 0, sam: 1, firep: 2, boss: 'CASTLE', bname: 'THE SANDCASTLE OF MILD MENACE', bhp: 60, gnd: 1, tint: PI.t,
    intel: 'INTEL: RADAR MISSILES + SAM SITES. CHAFF (C) WORKS. FLARES ARE DECOR.', def: [1, 6, 1, 6, 5],
    brief: ['SOMEONE HAS BUILT A FORTRESS OUT OF SAND IN THE DESERT.', 'THE SAND IS LOAD-BEARING. THE FORTRESS IS ARMED. THE TIDE IS NOT COMING.', '',
      'TAN JETS PATROL THE DUNES WITH RADAR-GUIDED MISSILES, AND THE GROUND', 'FIRES SURFACE-TO-AIR MISSILES WHENEVER IT FEELS LEFT OUT.', '',
      'DOWN 10 BOGEYS, THEN KNOCK THE CASTLE OVER. NO, YOU CANNOT KEEP THE FLAGS.'] },
  { name: 'OPERATION DUSK PATROL', quota: 12, irp: 50, sam: 0, firep: 3, boss: 'WING', bname: "COLONEL KLAXON'S FLYING WING", bhp: 80, gnd: 0, tint: PI.ol,
    intel: 'INTEL: MIXED IR AND RADAR. WATCH THE LAMPS. Q FOR IR, C FOR RADAR.', def: [1, 5, 3, 3, 5],
    brief: ['COLONEL KLAXON HAS A FLYING WING, A LOUD VOICE, AND NO INDOOR VOICE.', 'HE IS FLYING OVER THE FOREST AT SUNSET, WHICH IS FRANKLY SHOWING OFF.', '',
      'HIS OLIVE JETS CARRY BOTH KINDS OF MISSILE. THE COCKPIT LAMPS WILL TELL', 'YOU WHICH ONE IS COMING. THE LAMPS ARE NEVER WRONG. THE LAMPS ARE YOUR FRIENDS.', '',
      'DOWN 12 BOGEYS, THEN CLIP THE WING. HE WILL SCREAM. YOU WILL HEAR IT.'] },
  { name: 'OPERATION UNREASONABLE BOAT', quota: 14, irp: 50, sam: 1, firep: 3, boss: 'SHIP', bname: 'THE BATTLESHIP REGRET', bhp: 110, gnd: 1, tint: PI.lt,
    intel: 'INTEL: EVERYTHING. IR, RADAR, SAMS. BRING A LITTLE OF EACH.', def: [2, 3, 3, 3, 5],
    brief: ['AT NIGHT, ON A BLACK SEA, FLOATS THE BATTLESHIP REGRET. IT IS VERY LARGE.', 'NOBODY KNOWS WHY THEY BUILT IT. NOT EVEN THE PEOPLE WHO BUILT IT.', '',
      'IT LAUNCHES SAMS, ITS ESCORTS LAUNCH EVERYTHING ELSE, AND THE MOON IS', 'NO HELP AT ALL. THE MOON HAS NEVER BEEN ANY HELP.', '',
      'DOWN 14 BOGEYS, THEN SINK THE REGRET. YOU WILL FEEL SOMETHING. IT IS RELIEF.'] },
];
const MSL = [ // name, cost per missile, lock ticks, range (z), damage, description
  ['WASP', 1, 8, 45, 6, 'SMALL, ANGRY, FOND OF SHORT DISTANCES.', 'LOCKS FAST. ONE PER BOGEY. USELESS PAST 45.'],
  ['HORNET', 2, 16, 75, 12, 'MEDIUM RANGE. SMELLS FAINTLY OF AMBITION.', 'DECENT LOCK, DECENT REACH, DECENT PERSON.'],
  ['WOMBAT', 4, 28, 110, 30, 'LARGE. SLOW TO COMMIT. ENDS ARGUMENTS.', 'LONG LOCK, LONG REACH. BOSSES HATE IT.'],
];
const CAP = 24;
const NMS = MISSIONS.length;

const A = xs => `[${xs.join(', ')}]`;
const F = v => Number.isInteger(v) ? `${v}.0` : `${v}`;
const S = xs => JSON.stringify(xs);
const Q = s => JSON.stringify(s); // wirescript string literal (escapes the colour tags' quotes)
const tag = (col, s) => `<color="${PAL[col]}">${s}</>`;
const centre = s => ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;

// ---- cockpit (rows 36-53): static art baked to run-length strings around two live regions
const RAD = [5, 31], LAM = [36, 63], RAD_R = [1, 14], LAM_R = [3, 9];
function cockpit() {
  const g = Array.from({ length: CK }, (_, r) => Array.from({ length: W }, (_, x) => ({ c: r === 0 || r === CK - 1 || x < 3 || x > 92 ? PI.D : PI.P })));
  const label = (r, x, s, c = PI.lt) => [...s].forEach((ch, i) => { g[r][x + i] = { c, ch }; });
  label(2, 37, 'LOCK'); label(2, 48, 'IR'); label(2, 55, 'RADAR'); label(10, 46, 'DAMAGE'); label(13, 72, 'ALT'); label(13, 85, 'SPD');
  label(12, 38, 'BN-1 SKYJERK', PI.y);
  for (const [cx, nd] of [[73, [1, -1]], [86, [1, 0]]]) for (let r = 1; r <= 12; r++) for (let x = cx - 6; x <= cx + 6; x++) {
    const d = Math.hypot(x - cx, r - 7);
    if (d <= 5.5) g[r][x] = { c: d > 4.6 ? PI.d : PI.k };
    for (let k = 1; k <= 3; k++) if (x === cx + nd[0] * k && r === 7 + nd[1] * k) g[r][x] = { c: PI.w };
    if (x === cx && r === 7) g[r][x] = { c: PI.r };
  }
  const rle = cells => {
    let out = '', i = 0;
    while (i < cells.length) {
      let j = i; const c = cells[i].c, txt = !!cells[i].ch;
      while (j < cells.length && cells[j].c === c && !!cells[j].ch === txt) j++;
      const body = txt ? cells.slice(i, j).map(e => e.ch).join('') : '█'.repeat(j - i);
      out += c === 0 ? body : tag(c, body);
      i = j;
    }
    return out;
  };
  const seg = (r, a, b) => rle(g[r].slice(a, b));
  const RB = [];
  for (let r = RAD_R[0]; r <= RAD_R[1]; r++) for (let x = 0; x < RAD[1] - RAD[0]; x++) {
    let c = PI.k;
    if (x === 0 || x === 25 || r === RAD_R[0] || r === RAD_R[1]) c = PI.D;
    else if ((r === 13 && x >= 12 && x <= 14) || (r === 12 && x === 13)) c = PI.G;
    else if ((x === 13 && r % 2 === 0) || (r === 7 && x % 3 === 0)) c = PI.dg;
    RB.push(c);
  }
  return {
    A: g.map((_, r) => seg(r, 0, RAD[0])), RS: g.map((_, r) => seg(r, RAD[0], RAD[1])), B: g.map((_, r) => seg(r, RAD[1], LAM[0])),
    LS: g.map((_, r) => seg(r, LAM[0], LAM[1])), C: g.map((_, r) => seg(r, LAM[1], W)), RB,
  };
}

// ---- text screens baked per mission (briefing)
// text screens: TL lines of at most TWC cells, each centred by the display (no padding)
export const CELL = 1 / 3;
const TL = 18, TWC = 64;
const T = (col, s) => { if (s.length > TWC) throw Error(`text line too long (${s.length}): ${s}`); return tag(col, s); };
const wrap = (s, w = 60) => { const out = []; let cur = ''; for (const word of s.split(' ')) { if (cur && (cur + ' ' + word).length > w) { out.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word; } if (cur) out.push(cur); return out; };
const block = (col, s, n) => { const ls = wrap(s); if (ls.length > n) throw Error(`needs ${ls.length} lines > ${n}: ${s}`); return [...ls, ...Array(n - ls.length).fill('')].map(l => l ? T(col, l) : ''); };
function briefText(m) {
  const M = MISSIONS[m], paras = M.brief.join('\n').split('\n\n').map(p => p.replace(/\n/g, ' '));
  const out = [T(PI.y, `MISSION ${m + 1} OF ${NMS}: ${M.name}`), ''];
  for (const p of paras) out.push(...wrap(p).map(l => T(PI.w, l)));
  out.push('', ...wrap(M.intel).map(l => T(PI.c, l)), T(PI.o, `TARGET: ${M.bname}`), T(PI.lt, `IT SHOWS UP AFTER ${M.quota} KILLS.`));
  if (out.length > TL - 1) throw Error(`briefing ${m} is ${out.length} lines`);
  while (out.length < TL - 1) out.push('');
  return [...out, T(PI.G, 'PRESS SPACE FOR THE ARMORY')];
}

export function generate({ debug = false } = {}) {
  const NS = H / STRIP;
  const OPEN = PAL.map((h, i) => i === 0 ? '' : `<color="${h}">`), CLOSE = PAL.map((_, i) => i === 0 ? '' : '</>');
  const BLK = Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n));
  const ck = cockpit();
  const BRIEF = MISSIONS.flatMap((_, m) => briefText(m));
  // run-length push into string P.s with colour P.c / count P.n
  const push = (P, c, n) => `if ${n} > 0 {
      if ${c} == ${P}c { ${P}n += ${n} } else {
        if ${P}n > 0 { ${P}s = ${P}s .. OPEN[${P}c] .. BLK[${P}n] .. CLOSE[${P}c] }
        ${P}c = ${c}
        ${P}n = ${n}
      }
    }`;
  const flush = P => `if ${P}n > 0 { ${P}s = ${P}s .. OPEN[${P}c] .. BLK[${P}n] .. CLOSE[${P}c] }`;
  const strip = k => `st${k} = ${Array.from({ length: STRIP }, (_, j) => `rows[${k * STRIP + j}]`).join(' .. "\\n" .. ')}`;
  const bg = (xa, xb) => `if ${xb} > ${xa} {
      if flat {
        let cf = if yf > hz then gC else sC
        ${push('v', 'cf', `${xb} - ${xa}`)}
      } else {
        let xh = 47.5 + (yf - hz) / sl
        var xi: int = floor(xh) + 1
        if xi < ${xa} { xi = ${xa} }
        if xi > ${xb} { xi = ${xb} }
        if sl > 0.0 {
          ${push('v', 'gC', `xi - ${xa}`)}
          ${push('v', 'sC', `${xb} - xi`)}
        } else {
          ${push('v', 'sC', `xi - ${xa}`)}
          ${push('v', 'gC', `${xb} - xi`)}
        }
      }
    }`;
  const zeros = (n, z = '0') => `[${Array(n).fill(z).join(', ')}]`;

  const src = `// GENERATED by bogey/gen.mjs: edit that, not this file.
// BOGEY NIGHTS: logic every 'tick' (20 Hz) while 'seated'; view = 2 ticks a frame, cockpit = 3 ticks.

@left in tick: exec
@left in seated: bool
@left in left: bool
@left in right: bool
@left in up: bool
@left in down: bool
@left in a: bool
@left in b: bool
@left in q: bool
@left in c: bool

const OPEN = ${S(OPEN)}
const CLOSE = ${S(CLOSE)}
const BLK = ${S(BLK)}
const SPRW = ${A(SPRW)}
const SPRH = ${A(SPRH)}
const SPRO = ${A(SPRO)}
const SPRD = ${A(SPRD)}
const CKA = ${S(ck.A)}
const CKRS = ${S(ck.RS)}
const CKB = ${S(ck.B)}
const CKLS = ${S(ck.LS)}
const CKC = ${S(ck.C)}
const RB = ${A(ck.RB)}
const BRIEF = ${S(BRIEF)}
const ARMH = ${S(MISSIONS.map((M, m) => T(PI.y, `ARMORY - MISSION ${m + 1}: ${M.name}`)))}
const WDL1 = ${S(MSL.map(w => T(PI.c, `${w[0]}: ${w[5]}`)))}
const WDL2 = ${S(MSL.map(w => T(PI.c, w[6])))}
const WDL3 = ${S(MSL.map(w => T(PI.c, `LOCK ${w[2]}   RANGE ${w[3]}   DAMAGE ${w[4]}`)))}
const MINT1 = ${S(MISSIONS.map(M => block(PI.o, M.intel, 2)[0]))}
const MINT2 = ${S(MISSIONS.map(M => block(PI.o, M.intel, 2)[1]))}
const DEBH = ${S(MISSIONS.map((_, m) => T(PI.y, `MISSION ${m + 1} COMPLETE`)))}
const DEBC = ${S([...block(PI.c, 'THE COMMANDER NODS. IT IS THE MOST EMOTION HE HAS SHOWN IN YEARS. THE JET IS REPAIRED BY PEOPLE WHO DO NOT GET ENOUGH CREDIT.', 3), ...block(PI.c, 'ALL MISSIONS FLOWN. THEY GIVE YOU A MEDAL SHAPED LIKE A SLIGHTLY BIGGER MEDAL. THEN THEY SEND YOU BACK OUT. THE ENEMY HAS BEEN PRACTICING.', 3)])}
const MQUOTA = ${A(MISSIONS.map(m => m.quota))}
const MIRP = ${A(MISSIONS.map(m => m.irp))}
const MSAM = ${A(MISSIONS.map(m => m.sam))}
const MFIRE = ${A(MISSIONS.map(m => m.firep))}
const MBOSS = ${A(MISSIONS.map(m => SID[m.boss]))}
const MBHP = ${A(MISSIONS.map(m => m.bhp))}
const MGND = ${A(MISSIONS.map(m => m.gnd))}
const MTINT = ${A(MISSIONS.map(m => m.tint))}
const MNAME = ${S(MISSIONS.map(m => m.name))}
const MBNAME = ${S(MISSIONS.map(m => m.bname))}
const MINTEL = ${S(MISSIONS.map(m => m.intel))}
const MDEF = ${A(MISSIONS.flatMap(m => m.def))}
const WNAME = ${S(MSL.map(m => m[0]))}
const WNOTE = ${S(MSL.map(m => `${m[1]} PT EACH`))}
const WCOST = ${A(MSL.map(m => m[1]))}
const WLOCK = ${A(MSL.map(m => m[2]))}
const WRNG = ${A(MSL.map(m => F(m[3])))}
const WDMG = ${A(MSL.map(m => m[4]))}
const WD1 = ${S(MSL.map(m => m[5]))}
const WD2 = ${S(MSL.map(m => m[6]))}
const EXO = ${S(['NEW JET, FULLY REARMED. NO JET LOST.', 'RESTART THE MISSION WITH A NEW LOADOUT.'].flatMap(o => [T(PI.y, '> ' + o + ' <'), T(PI.lt, o)]))}
const EXT = ${S(block(PI.w, 'A MAN IN AN ORANGE VEST WAVES TWO GLOW STICKS AT YOU WITH GREAT CONFIDENCE AND NO TRAINING. THE HANGAR SMELLS OF COFFEE AND FRESH MISSILES.', 3))}
const SZW = [1, 3, 5, 8]
const SZH = [1, 1, 2, 3]
const CHX = [-3, 4, -6, 2, 6, -1, -5, 5]
const CHY = [-2, -3, 1, 2, -1, 3, 0, -4]

var state: int = 0           // 0 title, 1 briefing, 2 armory, 3 flying, 4 shot down, 5 target destroyed / debrief, 6 game over, 7 exfil menu
var stT: int = 0
var t: int = 0
var booted: bool = false
var msn: int = 0
var rnd: int = 0
var score: int = 0
var jets: int = 3
var dmg: int = 0
var kills: int = 0
var bossUp: bool = false
// armory
var cur: int = 0
var mt: int = 0
var nMsl: int = 0
var nFlr: int = 0
var nChf: int = 0
var nGun: int = 0
// stores in flight
var msl: int = 0
var flr: int = 0
var chf: int = 0
var gun: int = 0
// flight
var yaw: float = 0.0
var p: float = 0.0
var bank: float = 0.0
var hz: float = ${CY}.0
var sl: float = 0.0
var scroll: float = 0.0
var spawnT: int = 0
var samT: int = 0
var lockI: int = -1
var lockT: int = 0
var locked: bool = false
var cmCd: int = 0
// player ground position (only the exfil point lives in it) + exfil point, shown while any loaded store is empty
var px: float = 0.0
var py: float = 0.0
var exOn: bool = false
var exX: float = 0.0
var exY: float = 0.0
var exAz: float = 0.0
var exD: float = 0.0
var exC: int = 0
// enemies
var eA: int[] = ${zeros(NE)}
var ek: int[] = ${zeros(NE)}
var eaz: float[] = ${zeros(NE, '0.0')}
var eel: float[] = ${zeros(NE, '0.0')}
var ez: float[] = ${zeros(NE, '0.0')}
var vaz: float[] = ${zeros(NE, '0.0')}
var vel: float[] = ${zeros(NE, '0.0')}
var ehp: int[] = ${zeros(NE)}
var efc: int[] = ${zeros(NE)}
var efl: int[] = ${zeros(NE, '-99')}
var esx: float[] = ${zeros(NE, '0.0')}
var esy: float[] = ${zeros(NE, '0.0')}
// enemy missiles
var mA: int[] = ${zeros(NM)}
var maz: float[] = ${zeros(NM, '0.0')}
var mel: float[] = ${zeros(NM, '0.0')}
var mz: float[] = ${zeros(NM, '0.0')}
var mty: int[] = ${zeros(NM)}
var mdec: int[] = ${zeros(NM)}
var mdv: float[] = ${zeros(NM, '0.0')}
// player missiles
var pA: int[] = ${zeros(NP)}
var pI: int[] = ${zeros(NP)}
var pF: int[] = ${zeros(NP)}
var pN: int[] = ${zeros(NP)}
// explosions (world az / el so they slide with the view)
var xA: int[] = ${zeros(NX)}
var xaz: float[] = ${zeros(NX, '0.0')}
var xel: float[] = ${zeros(NX, '0.0')}
var xt: int[] = ${zeros(NX)}
// draw list + sprite layer
var nd: int = 0
var dId: int[] = ${zeros(NDL)}
var dX: float[] = ${zeros(NDL, '0.0')}
var dY: float[] = ${zeros(NDL, '0.0')}
var dT: int[] = ${zeros(NDL)}
var spr: int[] = ${zeros(W * VH)}
var touched: int[] = ${zeros(MAXT)}
var nT: int = 0
var rMin: int[] = ${zeros(VH, String(W))}
var rMax: int[] = ${zeros(VH, '-1')}
var cko: int[] = ${zeros(14 * 26)}
var ckt: int[] = ${zeros(32)}
var nck: int = 0
// edges + timers
var kA: bool = false
var kQ: bool = false
var kC: bool = false
var kU: bool = false
var kD: bool = false
var kL: bool = false
var kR: bool = false
var gunS: int = -99
var gunB: int = -99
var pmS: int = -99
var boomS: int = -99
var flS: int = -99
var chS: int = -99
var hitT: int = -99
var uiS: int = -99
var uiP: float = 1.8
var msg: string = ""
var msgT: int = 0
var hud: string = ""
var txtDirty: bool = false
var txtOn: bool = false
var tl: string[] = ${zeros(TL, '""')}
var rows: string[] = ${zeros(H, '""')}
${Array.from({ length: NS }, (_, k) => `var st${k}: string = ""`).join('\n')}
${[0, 1, 2, 3, 4].map(v => `var aP${v}: float = 1.0\nvar aV${v}: float = 0.0`).join('\n')}

${Array.from({ length: NS }, (_, k) => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = msg
@right out hud_: string = hud
@right out title_: string = if state == 0 then "BOGEY NIGHTS" else ""
${[0, 1, 2, 3, 4].map(v => `@right out P${v}: float = aP${v}\n@right out V${v}: float = aV${v}`).join('\n')}
@right out state_: int = state
@right out lh_: float = if txtOn then 0.62 else ${+(CELL * 0.645).toFixed(4)}
@right out ws_: float = if txtOn then 1.0 else 2.0

mod say(s: string, n: int) {
  msg = s
  msgT = n
}

mod wrapd(d: float) -> float {
  var r: float = d
  if r >= 192.0 { r -= 384.0 }
  if r < -192.0 { r += 384.0 }
  return r
}

mod wrap0(d: float) -> float {
  var r: float = d
  if r >= 384.0 { r -= 384.0 }
  if r < 0.0 { r += 384.0 }
  return r
}

mod pts() -> int {
  return WCOST[mt] * nMsl + nFlr + nChf + nGun
}

mod blip(pitch: float) {
  uiS = t
  uiP = pitch
}

mod showHud() {
  if state == 3 {
    var tgt: string = "KILLS " .. kills .. "/" .. MQUOTA[msn]
    if bossUp {
      var bh: int = 0
      for i in 0..${NE} { if eA[i] == 1 && ek[i] == 1 { bh = ehp[i] } }
      tgt = "TARGET HP " .. bh
    }
    hud = "MSL " .. msl .. " " .. WNAME[mt] .. "   FLR " .. flr .. "   CHF " .. chf .. "   GUN " .. gun .. "   DMG " .. dmg .. "%   " .. tgt .. "   JETS " .. jets .. "   " .. score
  } else if state == 0 {
    hud = "W/S PITCH  A/D BANK  LMB GUNS  SPACE MISSILE  Q FLARES  C CHAFF"
  } else {
    hud = "SCORE " .. score .. "   JETS " .. jets
  }
}

// text screens: ${TL} lines of ${TWC} cells in big type (strips switch LineHeight/WidthScale via lh_/ws_), 2 lines a strip
mod clearText() {
  for i in 0..${TL} { tl[i] = "" }
  txtDirty = true
  txtOn = true
}

mod showBrief() {
  clearText()
  let m = msn % ${NMS}
  for i in 0..${TL} { tl[i] = BRIEF[m * ${TL} + i] }
  if rnd > 0 { tl[1] = ${Q(OPEN[PI.r] + 'ROUND ')} .. (rnd + 1) .. ${Q(': EVERYONE IS FASTER AND ANGRIER' + CLOSE[PI.r])} }
}

mod line(r: int, k: int, label: string, val: string, note: string) {
  let body = label .. ":  - " .. val .. " +" .. (if note == "" then "" else "  (" .. note .. ")")
  if cur == k {
    tl[r] = ${Q(OPEN[PI.y] + "> ")} .. body .. ${Q(" <" + CLOSE[PI.y])}
  } else {
    tl[r] = ${Q(OPEN[PI.lt])} .. body .. ${Q(CLOSE[PI.lt])}
  }
}

mod showArmory() {
  clearText()
  let m = msn % ${NMS}
  tl[0] = ARMH[m]
  let pp = pts()
  tl[1] = (if pp >= ${CAP} then ${Q(OPEN[PI.o])} else ${Q(OPEN[PI.G])}) .. "PAYLOAD " .. pp .. " / ${CAP} POINTS USED</>"
  line(3, 0, "MISSILE TYPE", WNAME[mt], "")
  line(4, 1, "MISSILES", "" .. nMsl, WNOTE[mt])
  line(5, 2, "FLARE PAIRS", "" .. nFlr, "1 PT A PAIR, Q BEATS IR")
  line(6, 3, "CHAFF PAIRS", "" .. nChf, "1 PT A PAIR, C BEATS RADAR")
  line(7, 4, "GUN ROUNDS", "" .. (nGun * 200), "1 PT PER 200")
  tl[9] = WDL1[mt]
  tl[10] = WDL2[mt]
  tl[11] = WDL3[mt]
  tl[13] = MINT1[m]
  tl[14] = MINT2[m]
  tl[16] = ${Q(T(PI.G, 'W/S PICK   A/D CHANGE   SPACE TO LAUNCH'))}
}

mod armoryInput(aL: bool, aR: bool, aU: bool, aD: bool) {
  if aU && cur > 0 {
    cur -= 1
    blip(2.0)
  }
  if aD && cur < 4 {
    cur += 1
    blip(2.0)
  }
  if aL || aR {
    let dv = if aR then 1 else -1
    let before = pts()
    if cur == 0 {
      mt = (mt + 3 + dv) % 3
      for k in 0..20 { if pts() > ${CAP} && nMsl > 0 { nMsl -= 1 } }
    } else if cur == 1 { nMsl = max(0, min(16, nMsl + dv)) }
    else if cur == 2 { nFlr = max(0, min(10, nFlr + dv)) }
    else if cur == 3 { nChf = max(0, min(10, nChf + dv)) }
    else if cur == 4 { nGun = max(1, min(8, nGun + dv)) }
    if pts() > ${CAP} && pts() > before {
      if cur == 1 { nMsl -= dv }
      if cur == 2 { nFlr -= dv }
      if cur == 3 { nChf -= dv }
      if cur == 4 { nGun -= dv }
      blip(0.7)
      say("THE PLANE GROANS. TOO HEAVY.", 30)
    } else { blip(2.6) }
  }
  if aL || aR || aU || aD { showArmory() }
}

mod enterArmory() {
  let m = msn % ${NMS}
  mt = MDEF[m * 5]
  nMsl = MDEF[m * 5 + 1]
  nFlr = MDEF[m * 5 + 2]
  nChf = MDEF[m * 5 + 3]
  nGun = MDEF[m * 5 + 4]
  cur = 0
  state = 2
  stT = 0
  say("THE QUARTERMASTER SUGGESTS THIS. THE QUARTERMASTER IS USUALLY RIGHT.", 80)
  showArmory()
  showHud()
}

mod showExfil() {
  clearText()
  tl[3] = ${Q(T(PI.y, 'EXFILTRATION POINT'))}
  tl[5] = EXT[0]
  tl[6] = EXT[1]
  tl[7] = EXT[2]
  tl[10] = EXO[if exC == 0 then 0 else 1]
  tl[12] = EXO[if exC == 1 then 2 else 3]
  tl[16] = ${Q(T(PI.G, 'W/S PICK   SPACE TO CONFIRM'))}
}

mod rearm() {
  msl = nMsl
  flr = nFlr * 2
  chf = nChf * 2
  gun = nGun * 200
  dmg = 0
  for i in 0..${NM} { mA[i] = 0 }
  lockI = -1
  lockT = 0
  locked = false
  exOn = false
  state = 3
  stT = 0
  say("A FRESH JET, STILL WARM. NOBODY MENTIONS THE OLD ONE.", 50)
  showHud()
}

mod enterBrief() {
  state = 1
  stT = 0
  say("", 0)
  showBrief()
  showHud()
}

mod clearSky() {
  for i in 0..${NE} { if !bossUp || ek[i] == 0 { eA[i] = 0 } }
  for i in 0..${NM} { mA[i] = 0 }
  for i in 0..${NP} { pA[i] = 0 }
  lockI = -1
  lockT = 0
  locked = false
}

mod launch() {
  msl = nMsl
  flr = nFlr * 2
  chf = nChf * 2
  gun = nGun * 200
  dmg = 0
  kills = 0
  bossUp = false
  yaw = 0.0
  px = 0.0
  py = 0.0
  exOn = false
  p = 6.0
  bank = 0.0
  clearSky()
  for i in 0..${NX} { xA[i] = 0 }
  spawnT = 30
  samT = 220
  state = 3
  stT = 0
  say(MNAME[msn % ${NMS}], 60)
  showHud()
}

mod newGame() {
  msn = 0
  rnd = 0
  score = 0
  jets = 3
  enterBrief()
}

mod boom(az: float, el: float) {
  var k: int = -1
  for i in 0..${NX} { if k < 0 && xA[i] == 0 { k = i } }
  if k < 0 { k = t % ${NX} }
  xA[k] = 1
  xaz[k] = az
  xel[k] = el
  xt[k] = 0
  boomS = t
}

mod fireM(az: float, el: float, z: float, ty: int) {
  var k: int = -1
  for i in 0..${NM} { if k < 0 && mA[i] == 0 { k = i } }
  if k >= 0 {
    mA[k] = 1
    maz[k] = az
    mel[k] = el
    mz[k] = z
    mty[k] = ty
    mdec[k] = 0
    say(if ty == 0 then "MISSILE! IR - FLARES (Q)" else "MISSILE! RADAR - CHAFF (C)", 40)
  }
}

mod spawnBogey() {
  var k: int = -1
  for i in 0..${NE} { if k < 0 && eA[i] == 0 { k = i } }
  if k >= 0 {
    eA[k] = 1
    ek[k] = 0
    ez[k] = 100.0 + Random(0, 20)
    eaz[k] = wrap0(yaw + Random(-50, 50))
    eel[k] = Random(3, 16) * 1.0
    vaz[k] = Random(-5, 5) * 0.1
    vel[k] = if Random(0, 1) == 0 then 0.12 else -0.12
    ehp[k] = 5
    efc[k] = Random(10, 60)
  }
}

mod spawnBoss() {
  var k: int = -1
  for i in 0..${NE} { if k < 0 && eA[i] == 0 { k = i } }
  if k >= 0 {
    let m = msn % ${NMS}
    eA[k] = 1
    ek[k] = 1
    ez[k] = 110.0
    eaz[k] = wrap0(yaw + 25.0)
    eel[k] = 10.0
    vaz[k] = 0.2
    vel[k] = 0.08
    ehp[k] = MBHP[m] + rnd * 30
    efc[k] = 60
    bossUp = true
    say("HERE COMES " .. MBNAME[m], 80)
  }
}

mod hurt(i: int, n: int) {
  ehp[i] -= n
  efl[i] = t
  if ehp[i] <= 0 {
    eA[i] = 0
    boom(eaz[i], eel[i])
    if ek[i] == 1 {
      score += 2000 + jets * 500
      bossUp = false
      for k in 0..${NM} { mA[k] = 0 }
      state = 5
      stT = 0
      say(MBNAME[msn % ${NMS}] .. " IS NO MORE", 0)
    } else {
      kills += 1
      score += 100 * (msn + 1)
      say(if kills % 3 == 0 then "SPLASH ONE. THE OCEAN ACCEPTS IT." else "BOGEY DOWN", 25)
    }
    if lockI == i {
      lockI = -1
      lockT = 0
    }
  }
}

mod project() {
  for i in 0..${NE} {
    if eA[i] == 1 {
      if ek[i] == 1 && MGND[msn % ${NMS}] == 1 { eel[i] = 0.0 - (2.0 + 160.0 / (ez[i] + 8.0)) }
      esx[i] = ${CX}.0 + wrapd(eaz[i] - yaw)
      esy[i] = hz - eel[i]
    }
  }
}

mod controls(cL: bool, cR: bool, cU: bool, cD: bool) {
  var bt: float = 0.0
  if cL { bt -= 1.0 }
  if cR { bt += 1.0 }
  bank += (bt - bank) * 0.2
  yaw = wrap0(yaw + bank * 1.6)
  if cU { p -= 0.8 }
  if cD { p += 0.8 }
  p = max(-15.0, min(15.0, p))
}

mod flight(bH: bool, aE: bool, qE: bool, cE: bool) {
  let m = msn % ${NMS}
  let spd = 0.45 + m * 0.06 + rnd * 0.1
  project()
  // guns: a shot every 2 ticks, 2 rounds each, hits whatever sits under the cross
  if bH && t % 2 == 0 {
    if gun > 0 {
      gun -= 2
      if t - gunS > 2 { gunB = t }
      gunS = t
      var hit: int = -1
      for i in 0..${NE} {
        if eA[i] == 1 && hit < 0 && ez[i] < 70.0 {
          var hw: float = 14.0
          var hh: float = 4.0
          if ek[i] == 0 {
            let sz = if ez[i] > 70.0 then 0 else if ez[i] > 42.0 then 1 else if ez[i] > 22.0 then 2 else 3
            hw = SZW[sz] + 1.0
            hh = SZH[sz] + 1.0
          }
          if abs(esx[i] - ${CX}.0) <= hw && abs(esy[i] - ${CY}.0) <= hh { hit = i }
        }
      }
      if hit >= 0 { hurt(hit, 1) }
    } else if t % 40 == 0 { say("GUNS DRY. THEY MAKE A SAD CLICK.", 30) }
  }
  // missile lock: the enemy nearest the cross inside the window and in range, held for WLOCK ticks
  var best: int = -1
  var bd: float = 999.0
  for i in 0..${NE} {
    if eA[i] == 1 && ez[i] <= WRNG[mt] {
      let dx = abs(esx[i] - ${CX}.0)
      let dy = abs(esy[i] - ${CY}.0)
      if dx <= 14.0 && dy <= 9.0 && dx + dy < bd {
        bd = dx + dy
        best = i
      }
    }
  }
  if best >= 0 && best == lockI { lockT += 1 } else {
    lockI = best
    lockT = 0
  }
  locked = lockI >= 0 && lockT >= WLOCK[mt]
  if aE {
    if msl <= 0 { say("NO MISSILES. ONLY REGRETS.", 25) }
    else if !locked { blip(0.8) }
    else {
      var k: int = -1
      for i in 0..${NP} { if k < 0 && pA[i] == 0 { k = i } }
      if k >= 0 {
        pA[k] = 1
        pI[k] = lockI
        pF[k] = 0
        let travel: int = floor(6.0 + ez[lockI] / 5.0)
        pN[k] = travel
        msl -= 1
        pmS = t
        lockT = 0
        say("FOX " .. (mt + 1), 15)
      }
    }
  }
  for k in 0..${NP} {
    if pA[k] == 1 {
      pF[k] += 1
      if pF[k] >= pN[k] {
        pA[k] = 0
        let i = pI[k]
        if eA[i] == 1 { hurt(i, WDMG[mt]) }
      }
    }
  }
  // countermeasures
  if cmCd > 0 { cmCd -= 1 }
  if (qE || cE) && cmCd == 0 {
    let ty = if qE then 0 else 1
    var ok: bool = false
    if ty == 0 && flr > 0 {
      flr -= 1
      flS = t
      ok = true
    }
    if ty == 1 && chf > 0 {
      chf -= 1
      chS = t
      ok = true
    }
    if ok {
      cmCd = 8
      for i in 0..${NM} {
        if mA[i] == 1 && mdec[i] == 0 && mty[i] == ty && mz[i] < 85.0 && Random(0, 9) < 9 {
          mdec[i] = 1
          mdv[i] = if Random(0, 1) == 0 then 2.2 else -2.2
          say(if ty == 0 then "FLARES! IT TOOK THE BAIT" else "CHAFF! IT IS CONFUSED NOW", 25)
        }
      }
    } else { say(if ty == 0 then "NO FLARES LEFT" else "NO CHAFF LEFT", 20) }
  }
  // enemies
  var live: int = 0
  for i in 0..${NE} {
    if eA[i] == 1 {
      if ek[i] == 0 {
        live += 1
        ez[i] -= spd
        let rel = wrapd(eaz[i] - yaw)
        if rel > 60.0 { vaz[i] = -0.5 } else if rel < -60.0 { vaz[i] = 0.5 } else if Random(0, 40) == 0 { vaz[i] = Random(-6, 6) * 0.1 }
        eaz[i] = wrap0(eaz[i] + vaz[i])
        eel[i] += vel[i]
        if eel[i] > 18.0 || eel[i] < 2.0 { vel[i] = 0.0 - vel[i] }
        efc[i] -= 1
        if efc[i] <= 0 && ez[i] < 75.0 && ez[i] > 20.0 && Random(0, 99) < MFIRE[m] + rnd {
          fireM(eaz[i], eel[i], ez[i], if Random(0, 99) < MIRP[m] then 0 else 1)
          efc[i] = 70
        }
        if ez[i] < 5.0 { eA[i] = 0 }
      } else {
        if ez[i] > 40.0 { ez[i] -= spd }
        if MGND[m] == 0 {
          let rel = wrapd(eaz[i] - yaw)
          if rel > 45.0 { vaz[i] = -0.35 } else if rel < -45.0 { vaz[i] = 0.35 } else if Random(0, 60) == 0 { vaz[i] = Random(-4, 4) * 0.1 }
          eaz[i] = wrap0(eaz[i] + vaz[i])
          eel[i] += vel[i]
          if eel[i] > 14.0 || eel[i] < 5.0 { vel[i] = 0.0 - vel[i] }
        }
        efc[i] -= 1
        if efc[i] <= 0 && ez[i] < 90.0 {
          fireM(eaz[i], eel[i], ez[i], if Random(0, 99) < MIRP[m] then 0 else 1)
          efc[i] = max(30, 70 - m * 8 - rnd * 6)
        }
      }
    }
  }
  spawnT -= 1
  if spawnT <= 0 {
    if !bossUp && kills >= MQUOTA[m] { spawnBoss() }
    else if live < 2 + m / 2 && (bossUp || kills + live < MQUOTA[m] + 2) { spawnBogey() }
    spawnT = Random(30, 70) - m * 5 + (if bossUp then 40 else 0)
  }
  if MSAM[m] == 1 {
    samT -= 1
    if samT <= 0 {
      fireM(wrap0(yaw + Random(-50, 50)), -8.0, 85.0, 1)
      say("SAM LAUNCH! CHAFF (C)", 40)
      samT = Random(140, 220) - rnd * 20
    }
  }
  // enemy missiles home on the nose; decoyed ones veer off
  let mspd = 1.5 + m * 0.15 + rnd * 0.15
  for i in 0..${NM} {
    if mA[i] == 1 {
      mz[i] -= mspd
      if mdec[i] == 1 {
        maz[i] = wrap0(maz[i] + mdv[i])
        mel[i] -= 0.4
      } else {
        let d = wrapd(yaw - maz[i])
        maz[i] = wrap0(maz[i] + max(-0.9, min(0.9, d)))
        mel[i] += max(-0.6, min(0.6, p - mel[i]))
      }
      if mz[i] <= 0.0 {
        mA[i] = 0
        if mdec[i] == 0 && abs(wrapd(maz[i] - yaw)) < 7.0 && abs(mel[i] - p) < 5.0 {
          dmg += 34
          hitT = t
          say("HIT! DAMAGE " .. dmg .. "%", 40)
          if dmg >= 100 {
            jets -= 1
            state = 4
            stT = 0
            boom(yaw, p)
            say("SHOT DOWN. THE SEA IS COLD AND JUDGMENTAL.", 0)
          }
        } else {
          score += 25
          say("EVADED", 15)
        }
      }
    }
  }
  // exfil: appears back toward the launch spot (25-90 out) when any loaded store runs dry, gone once rearmed
  px += sin(yaw * 0.016362461737446838) * spd
  py += cos(yaw * 0.016362461737446838) * spd
  let need = gun <= 0 || (nMsl > 0 && msl <= 0) || (nFlr > 0 && flr <= 0) || (nChf > 0 && chf <= 0)
  if need && !exOn {
    var dx: float = 0.0 - px
    var dy: float = 0.0 - py
    var d: float = sqrt(dx * dx + dy * dy)
    if d < 0.5 {
      dx = 0.0 - sin(yaw * 0.016362461737446838)
      dy = 0.0 - cos(yaw * 0.016362461737446838)
      d = 1.0
    }
    let L = max(25.0, min(90.0, d))
    exX = px + dx / d * L
    exY = py + dy / d * L
    say("STORES DRY. FLY TO THE YELLOW RING FOR EXFIL.", 60)
  }
  exOn = need
  if exOn {
    let ex = exX - px
    let ey = exY - py
    exD = sqrt(ex * ex + ey * ey)
    exAz = wrap0(atan2(ex, ey) * 61.11549814029453)
    if exD < 6.0 && state == 3 {
      state = 7
      stT = 0
      exC = 0
      say("", 0)
      showExfil()
      showHud()
    }
  }
}

mod add(id: int, x: float, y: float, tint: int) {
  if nd < ${NDL} {
    dId[nd] = id
    dX[nd] = x
    dY[nd] = y
    dT[nd] = tint
    nd += 1
  }
}

mod drawList() {
  nd = 0
  let m = msn % ${NMS}
  if state == 3 || state == 4 || state == 5 {
    for i in 0..${NE} {
      if eA[i] == 1 && esx[i] > -20.0 && esx[i] < ${W + 20}.0 {
        var id: int = MBOSS[m]
        var tn: int = MTINT[m]
        if ek[i] == 0 {
          id = if ez[i] > 70.0 then ${SID.B0} else if ez[i] > 42.0 then ${SID.B1} else if ez[i] > 22.0 then ${SID.B2} else ${SID.B3}
        } else { tn = ${PI.g} }
        if t - efl[i] < 2 { tn = ${PI.w} }
        add(id, esx[i], esy[i], tn)
      }
    }
    for i in 0..${NM} {
      if mA[i] == 1 {
        let sx = ${CX}.0 + wrapd(maz[i] - yaw)
        let id = if mz[i] > 60.0 then ${SID.M0} else if mz[i] > 25.0 then ${SID.M1} else ${SID.M2}
        add(id, sx, hz - mel[i], if mty[i] == 0 then ${PI.r} else ${PI.c})
      }
    }
    for k in 0..${NP} {
      if pA[k] == 1 && eA[pI[k]] == 1 {
        // eased (fast off the rail, slowing into the distance): shrinking flame head + smoke trail
        let f = pF[k] * 1.0 / pN[k]
        let i = pI[k]
        let x0 = if k == 0 then ${CX - 9}.0 else ${CX + 9}.0
        for j in 0..4 {
          let fj = max(0.0, f - j * 0.08)
          let fe = 1.0 - (1.0 - fj) * (1.0 - fj)
          let id = if j == 0 && f < 0.4 then ${SID.M1} else ${SID.DOT}
          let tn = if j == 0 then ${PI.o} else if j == 1 then ${PI.y} else if j == 2 then ${PI.lt} else ${PI.g}
          if j == 0 || fj > 0.0 { add(id, x0 + (esx[i] - x0) * fe, ${VH - 2}.0 + (esy[i] - ${VH - 2}.0) * fe, tn) }
        }
      }
    }
    for i in 0..${NX} {
      if xA[i] == 1 {
        let a = xt[i]
        let id = if a < 3 then ${SID.X0} else if a < 7 then ${SID.X1} else if a < 11 then ${SID.X2} else ${SID.X3}
        add(id, ${CX}.0 + wrapd(xaz[i] - yaw), hz - xel[i], 0)
      }
    }
    // tracers: every round of the burst flies out on a perspective curve (fast near, slow far), colours cycle per round
    for j in 0..7 {
      let s = gunS - j * 2
      let a = t - s
      if s >= gunB && a <= 12 {
        let f = 1.5 * a / (a + 6.0)
        let id = if a < 4 then ${SID.TRACE} else ${SID.DOT}
        let tn = if s % 6 < 2 then ${PI.y} else if s % 6 < 4 then ${PI.o} else ${PI.w}
        add(id, 26.0 + 22.0 * f, ${VH - 1}.0 - ${VH - 1 - CY}.0 * f, tn)
        add(id, 70.0 - 22.0 * f, ${VH - 1}.0 - ${VH - 1 - CY}.0 * f, tn)
      }
    }
    let fa = t - flS
    if fa < 18 {
      for k in 0..4 {
        let dx = 8.0 + k * 5.0 + fa * 0.8
        let fy = ${VH - 8}.0 + k * 1.5 + fa * 0.5
        add(${SID.DOT}, ${CX}.0 - dx, fy, if (fa + k) % 2 == 0 then ${PI.y} else ${PI.w})
        add(${SID.DOT}, ${CX}.0 + dx, fy, if (fa + k) % 2 == 0 then ${PI.o} else ${PI.w})
      }
    }
    let ca = t - chS
    if ca < 18 {
      for k in 0..8 {
        add(${SID.DOT}, ${CX}.0 + CHX[k] * (2.0 + ca * 0.5), ${VH - 6}.0 + CHY[k] * (1.0 + ca * 0.25) + ca * 0.3, if (ca + k) % 3 == 0 then ${PI.w} else ${PI.lt})
      }
    }
    if state == 3 && exOn {
      let ex = ${CX}.0 + wrapd(exAz - yaw)
      if ex > -20.0 && ex < ${W + 20}.0 {
        let id = if exD > 60.0 then ${SID.EX0} else if exD > 30.0 then ${SID.EX1} else if exD > 14.0 then ${SID.EX2} else ${SID.EX3}
        add(id, ex, hz + min(14.0, 120.0 / max(exD, 4.0)), 0)
      }
    }
    if state == 3 {
      if lockI >= 0 {
        let lt = if locked then ${PI.o} else if t % 4 < 2 then ${PI.G} else 0
        if lt > 0 { add(${SID.LOCK}, esx[lockI], esy[lockI], lt) }
      }
      add(${SID.CROSS}, ${CX}.0, ${CY}.0, ${PI.G})
    }
  }
}

mod stamp() {
  for q in 0..nT { spr[touched[q]] = 0 }
  nT = 0
  for y in 0..${VH} {
    rMin[y] = ${W}
    rMax[y] = -1
  }
  for q in 0..nd {
    let id = dId[q]
    let w = SPRW[id]
    let h = SPRH[id]
    let o = SPRO[id]
    let x0: int = floor(dX[q] - w / 2.0 + 0.5)
    let y0: int = floor(dY[q] - h / 2.0 + 0.5)
    for j in 0..h {
      let y = y0 + j
      if y >= 0 && y < ${VH} {
        for k in 0..w {
          let x = x0 + k
          var c: int = SPRD[o + j * w + k]
          if c != 0 && x >= 0 && x < ${W} {
            if c == ${PI.g} && dT[q] > 0 { c = dT[q] }
            let i = y * ${W} + x
            if spr[i] == 0 && nT < ${MAXT} {
              touched[nT] = i
              nT += 1
              spr[i] = c
            } else if spr[i] != 0 { spr[i] = c }
            if x < rMin[y] { rMin[y] = x }
            if x > rMax[y] { rMax[y] = x }
          }
        }
      }
    }
  }
}

mod view(r0: int, r1: int) {
  let th = msn % ${NMS}
  let flat = sl > -0.001 && sl < 0.001
  let red = t - hitT < 3 || (state == 4 && t % 4 < 2)
  for y in r0..r1 {
    let yf: float = y * 1.0
    var sb: int = floor((hz - yf) / 7.0)
    if sb < 0 { sb = 0 }
    if sb > 3 { sb = 3 }
    var sC: int = ${TH0} + th * 6 + sb
    var gd: float = yf - hz
    if gd < 0.5 { gd = 0.5 }
    let si: int = floor(30.0 / gd + scroll)
    var gC: int = ${TH0} + th * 6 + 4 + si % 2
    if red {
      sC = ${PI.r}
      gC = ${PI.o}
    }
    var vs: string = ""
    var vc: int = -1
    var vn: int = 0
    let mn = rMin[y]
    let mx = rMax[y]
    var xb: int = ${W}
    if mx >= 0 { xb = mn }
    ${bg('0', 'xb')}
    if mx >= 0 {
      let mx1 = mx + 1
      for x in mn..mx1 {
        var c1: int = spr[y * ${W} + x]
        if c1 == 0 { c1 = if (yf - hz) > sl * (x + 0.5 - ${CX}.0) then gC else sC }
        ${push('v', 'c1', '1')}
      }
      ${bg('mx1', W)}
    }
    ${flush('v')}
    rows[y] = vs
  }
}

mod radar() {
  for q in 0..nck { cko[ckt[q]] = 0 }
  nck = 0
  for i in 0..${NE + NM + 1} {
    var vis: bool = false
    var az: float = 0.0
    var zz: float = 0.0
    var cc: int = ${PI.G}
    if i < ${NE} {
      if eA[i] == 1 {
        vis = true
        az = eaz[i]
        zz = ez[i]
        if ek[i] == 1 { cc = ${PI.m} }
      }
    } else if i == ${NE + NM} {
      if exOn && state == 3 {
        vis = true
        az = exAz
        zz = exD
        cc = ${PI.y}
      }
    } else {
      let j = i - ${NE}
      if mA[j] == 1 && mdec[j] == 0 {
        vis = true
        az = maz[j]
        zz = mz[j]
        cc = if mty[j] == 0 then ${PI.r} else ${PI.c}
      }
    }
    if vis && nck < 32 {
      let rx: int = floor(13.0 + max(-12.0, min(12.0, wrapd(az - yaw) / 9.0)))
      let ry: int = floor(12.0 - max(0.0, min(10.0, zz / 10.0)))
      let ci = (ry - ${RAD_R[0]}) * 26 + rx
      cko[ci] = cc
      ckt[nck] = ci
      nck += 1
    }
  }
}

mod cockpitRows(r0: int, r1: int) {
  var irOn: bool = false
  var rdOn: bool = false
  for i in 0..${NM} {
    if mA[i] == 1 && mdec[i] == 0 {
      if mty[i] == 0 { irOn = true } else { rdOn = true }
    }
  }
  let lk = if locked then ${PI.o} else if lockI >= 0 && t % 8 < 4 then ${PI.G} else ${PI.D}
  let li = if irOn && t % 8 < 4 then ${PI.r} else ${PI.D}
  let lr = if rdOn && t % 8 < 4 then ${PI.c} else ${PI.D}
  let dn = min(25, dmg / 4)
  let dc = if dmg < 40 then ${PI.G} else if dmg < 70 then ${PI.y} else ${PI.r}
  for r in r0..r1 {
    var row: string = CKA[r]
    if r >= ${RAD_R[0]} && r <= ${RAD_R[1]} {
      var qs: string = ""
      var qc: int = -1
      var qn: int = 0
      for x in 0..26 {
        let ri = (r - ${RAD_R[0]}) * 26 + x
        var c3: int = cko[ri]
        if c3 == 0 { c3 = RB[ri] }
        ${push('q', 'c3', '1')}
      }
      ${flush('q')}
      row = row .. qs
    } else { row = row .. CKRS[r] }
    row = row .. CKB[r]
    if r >= ${LAM_R[0]} && r <= ${LAM_R[1]} {
      var ls: string = ""
      var lc: int = -1
      var ln: int = 0
      let ly = r - ${LAM_R[0]}
      for x in 0..27 {
        var c4: int = ${PI.P}
        if ly <= 2 {
          if x >= 1 && x <= 7 { c4 = lk } else if x >= 10 && x <= 16 { c4 = li } else if x >= 19 && x <= 25 { c4 = lr }
        } else if ly == 5 || ly == 6 {
          if x >= 1 && x <= 25 { c4 = if x - 1 < dn then dc else ${PI.k} }
        }
        ${push('l', 'c4', '1')}
      }
      ${flush('l')}
      row = row .. ls
    } else { row = row .. CKLS[r] }
    rows[${VH} + r] = row .. CKC[r]
  }
}

mod frame() {
  hz = ${CY}.0 + p
  sl = 0.0 - bank * 0.35
  scroll += 0.25
  if scroll > 1000.0 { scroll -= 1000.0 }
  let ph = t % 2
  if ph == 0 {
    project()
    drawList()
    stamp()
  }
  view(ph * ${VH / 2}, ph * ${VH / 2} + ${VH / 2})
  if ph == 0 {
${[0, 1, 2].map(k => '    ' + strip(k)).join('\n')}
  } else {
${[3, 4, 5].map(k => '    ' + strip(k)).join('\n')}
  }
  let cp = t % 3
  if cp == 0 { radar() }
  cockpitRows(cp * ${STRIP}, cp * ${STRIP} + ${STRIP})
  if cp == 0 { ${strip(6)} }
  else if cp == 1 { ${strip(7)} }
  else { ${strip(8)} }
}

mod audio() {
  // V0 guns: white-noise click, one tick per round
  let ga = t - gunS
  aV0 = if ga < 1 then 0.4 else 0.0
  aP0 = 3.0
  // V1 noise: explosions beat the missile whoosh
  let ba = t - boomS
  let ma = t - pmS
  if ba < 16 {
    aV1 = 0.8 * (1.0 - ba / 16.0)
    aP1 = 0.6 - ba * 0.02
  } else if ma < 14 {
    aV1 = 0.5 * (1.0 - ma / 14.0)
    aP1 = 1.4 - ma * 0.05
  } else { aV1 = 0.0 }
  // V2 square: incoming alarm > lock tone > acquiring chirp > ui blips
  var irOn: bool = false
  var rdOn: bool = false
  for i in 0..${NM} {
    if mA[i] == 1 && mdec[i] == 0 {
      if mty[i] == 0 { irOn = true } else { rdOn = true }
    }
  }
  let ua = t - uiS
  let ha = t - hitT
  aV2 = 0.0
  if state == 3 && (irOn || rdOn) {
    aV2 = if t % 6 < 3 then 0.25 else 0.0
    aP2 = if irOn && (!rdOn || t % 12 < 6) then 2.2 else 1.5
  } else if state == 3 && locked {
    aV2 = 0.15
    aP2 = 3.0
  } else if state == 3 && lockI >= 0 {
    aV2 = if t % 6 == 0 then 0.15 else 0.0
    aP2 = 2.4
  }
  if ua < 2 {
    aV2 = 0.25
    aP2 = uiP
  }
  // V3 triangle engine drone
  aV3 = if state == 3 || state == 5 then 0.16 else if state == 4 then 0.2 else if state == 0 then 0.06 else 0.0
  aP3 = if state == 4 then max(0.2, 0.6 - stT * 0.006) else 0.45 + abs(bank) * 0.08 + abs(p) * 0.004
  // V4 pink noise: hits, flares (pop), chaff (rustle)
  let fa = t - flS
  let ca = t - chS
  if ha < 6 {
    aV4 = 0.7
    aP4 = 0.5
  } else if fa < 8 {
    aV4 = 0.6 * (1.0 - fa / 8.0)
    aP4 = 1.8
  } else if ca < 12 {
    aV4 = if t % 2 == 0 then 0.4 else 0.15
    aP4 = 2.6
  } else { aV4 = 0.0 }
}

mod powerOn() {
  booted = true
  state = 0
  bossUp = false
  stT = 0
  msn = 0
  p = 4.0
  clearSky()
  say("HOLD SPACE TO START", 0)
  showHud()
}

mod powerOff() {
  booted = false
  state = 0
  msg = ""
  hud = ""
${Array.from({ length: NS }, (_, k) => `  st${k} = ""`).join('\n')}
  aV0 = 0.0
  aV1 = 0.0
  aV2 = 0.0
  aV3 = 0.0
  aV4 = 0.0
}

${debug ? `var dbk: string = ""
var dumpReq: bool = false
var god: bool = false
var aim: bool = false
on ChatCommand("bn", "BOGEY NIGHTS debug: /bn <keys o(sit) l r u d a b q c> | dump | boss | god | aim | lvl | die | ex") -> (ctrl, args) {
  if args == "dump" { dumpReq = true }
  else if args == "god" { god = !god }
  else if args == "aim" { aim = !aim }
  else if args == "boss" { kills = MQUOTA[msn % ${NMS}] }
  else if args == "die" {
    jets -= 1
    state = 4
    stT = 0
  }
  else if args == "ex" {
    px = exX
    py = exY
  }
  else if args == "lvl" {
    state = 5
    stT = 49
  }
  else { dbk = args }
}
` : ''}on tick {
${debug ? `  let pwr = seated || dbk.Contains("o")` : `  let pwr = seated`}
  if !pwr {
    if booted { powerOff() }
  } else {
    if !booted { powerOn() }
${debug ? `    let ia = a || dbk.Contains("a")
    let ib = b || dbk.Contains("b")
    let iq = q || dbk.Contains("q")
    let ic = c || dbk.Contains("c")
    let iL = left || dbk.Contains("l")
    let iR = right || dbk.Contains("r")
    let iU = up || dbk.Contains("u")
    let iD = down || dbk.Contains("d")
    if god { dmg = 0 }
    if aim && state == 3 {
      for i in 0..${NE} {
        if eA[i] == 1 {
          yaw = eaz[i]
          p = eel[i]
        }
      }
    }
    if t % 20 == 0 { PrintToConsole("bndbg|" .. t .. "|st " .. state .. "|m " .. msn .. "|k " .. kills .. "|dmg " .. dmg .. "|yaw " .. yaw .. "|p " .. p .. "|lock " .. lockI .. "/" .. lockT .. "|z " .. floor(ez[0]) .. "," .. floor(ez[1]) .. "|e " .. eA[0] .. eA[1] .. eA[2] .. eA[3] .. eA[4] .. "|m " .. mA[0] .. mA[1] .. mA[2] .. "|flr " .. flr .. "|msl " .. msl .. "|gun " .. gun .. "|sc " .. score .. "|nT " .. nT .. "|boss " .. bossUp .. "|ex " .. exOn .. " " .. floor(exD) .. " az " .. floor(exAz) .. "|pos " .. floor(px) .. "," .. floor(py) .. "|chf " .. chf) }
    if dumpReq && t % 4 == 3 {
      dumpReq = false
      for r in 0..${H} { PrintToConsole("bnrow|" .. r .. "|" .. rows[r]) }
      for r in 0..${TL} { PrintToConsole("bntxt|" .. r .. "|" .. tl[r]) }
    }` : `    let ia = a
    let ib = b
    let iq = q
    let ic = c
    let iL = left
    let iR = right
    let iU = up
    let iD = down`}
    t += 1
    let aE = ia && !kA
    let qE = iq && !kQ
    let cE = ic && !kC
    let uE = iU && !kU
    let dE = iD && !kD
    let lE = iL && !kL
    let rE = iR && !kR
    stT += 1
    if state == 0 {
      let tp: int = floor(t / 80.0)
      bank += ((if tp % 2 == 0 then 0.6 else -0.6) - bank) * 0.05
      yaw = wrap0(yaw + bank * 1.2)
      if stT > 20 && aE { newGame() }
    } else if state == 1 {
      if stT > 15 && aE { enterArmory() }
    } else if state == 2 {
      armoryInput(lE, rE, uE, dE)
      if stT > 10 && aE { launch() }
    } else if state == 3 {
      controls(iL, iR, iU, iD)
      flight(ib, aE, qE, cE)
      if t % 5 == 0 { showHud() }
    } else if state == 4 {
      bank = if stT % 12 < 6 then 1.0 else -1.0
      yaw = wrap0(yaw + 3.0)
      p = max(-15.0, p - 0.5)
      if stT == 10 || stT == 20 { boom(yaw, p) }
      if stT >= 60 {
        if jets > 0 {
          dmg = 0
          clearSky()
          p = 6.0
          bank = 0.0
          state = 3
          stT = 0
          say("A NEW JET. TRY NOT TO BREAK THIS ONE.", 50)
        } else {
          state = 6
          stT = 0
          clearText()
          tl[5] = ${Q(T(PI.r, 'GAME OVER'))}
          tl[8] = ${Q(T(PI.w, 'YOU ARE OUT OF JETS.'))}
          tl[9] = ${Q(T(PI.w, 'THE NAVY WOULD LIKE THEM BACK.'))}
          tl[12] = ${Q(OPEN[PI.y] + 'SCORE ')} .. score .. ${Q(CLOSE[PI.y])}
          tl[16] = ${Q(T(PI.G, 'PRESS SPACE'))}
          say("", 0)
          showHud()
        }
      }
    } else if state == 5 {
      if stT < 50 {
        controls(iL, iR, iU, iD)
        project()
        if stT % 8 == 0 && stT < 40 {
          for i in 0..${NE} { eA[i] = 0 }
          boom(yaw + Random(-6, 6), p + Random(-3, 3))
        }
      } else if stT == 50 {
        clearText()
        let dm = msn % ${NMS}
        tl[2] = DEBH[dm]
        tl[5] = ${Q(OPEN[PI.w] + 'BOGEYS DOWNED ')} .. kills .. ${Q(CLOSE[PI.w])}
        tl[6] = ${Q(OPEN[PI.w] + 'JETS LEFT ')} .. jets .. ${Q(CLOSE[PI.w])}
        tl[7] = ${Q(OPEN[PI.w] + 'SCORE ')} .. score .. ${Q(CLOSE[PI.w])}
        let fin = if dm == ${NMS - 1} then 3 else 0
        tl[10] = DEBC[fin]
        tl[11] = DEBC[fin + 1]
        tl[12] = DEBC[fin + 2]
        tl[16] = ${Q(T(PI.G, 'PRESS SPACE FOR THE NEXT BRIEFING'))}
        say("", 0)
        showHud()
      } else if stT > 65 && aE {
        msn += 1
        if msn % ${NMS} == 0 { rnd += 1 }
        enterBrief()
      }
    } else if state == 7 {
      if uE || dE {
        exC = 1 - exC
        blip(2.0)
        showExfil()
      }
      if stT > 10 && aE {
        if exC == 0 { rearm() } else { enterArmory() }
      }
    } else if state == 6 {
      if stT > 30 && aE {
        powerOn()
      }
    }
    for i in 0..${NX} {
      if xA[i] == 1 {
        xt[i] += 1
        if xt[i] > 15 { xA[i] = 0 }
      }
    }
    if msgT > 0 {
      msgT -= 1
      if msgT == 0 { msg = "" }
    }
    audio()
    if state == 0 || state == 3 || state == 4 || (state == 5 && stT < 50) {
      txtOn = false
      frame()
    } else if txtDirty {
      txtDirty = false
${Array.from({ length: NS }, (_, k) => `      st${k} = tl[${2 * k}] .. "\\n" .. tl[${2 * k + 1}]`).join('\n')}
    }
    kA = ia
    kQ = iq
    kC = ic
    kU = iU
    kD = iD
    kL = iL
    kR = iR
  }
}
`;
  return { src, W, H, STRIP, PAL, textPorts: true, synths: ['Noise', 'Noise', 'Square', 'Triangle', 'NoisePink'] };
}
