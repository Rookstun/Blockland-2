// dvi/gen.mjs: DANIEL VS ISIS, the RPG (owner renderman 2026-11-05: "THE GAME NEEDS TO BE AN RPG", "Turn-based battles
// and give it a savegame"; earlier: 3 bosses, smoke cigarettes zelda style, pierogi for health, rescue the 5 uncles of
// truth, beat neo saddam; intro card "RENDERMAN INDEPENDENT SOFTWARE COMPANY ENTERTAINMENT CLAUDE LLC PRESENTS").
// Pure-wire row engine of pong/wgen.mjs: 240x160 at 10x10 pixels a micro brick, a changed row is rebuilt from coloured
// spans (scenery tables precomputed here + live objects), back-buffered strips swapped together every 3 ticks.
// Overworld: 6 areas walked edge to edge with WASD (scenery band on top, objects on the ground below it, so the two never
// overlap); goons stand around, bumping one starts a turn-based battle (FIGHT / PIEROGI / SMOKE / RUN on the msg line,
// W/S pick, Space confirm); Uncles of Truth sit in cages (walk in to free); bosses block their area's exit. XP -> levels.
// Savegame: the sitter's leaderboard keys dv* (kept across restarts by the progress plugin), autosaved on area change,
// battle win and uncle freed; sitting down offers CONTINUE. Cartoon, original art; goons carry blank black flags.
export const W = 240, H = 160, STRIP = 20;
export const PAL = ['101828'];
const SKY = 34; // rows 2..SKY-1 = scenery band, rows SKY..GROUND-1 = walkable ground

const COL = { h: '5a3a1a', s: 'f0c090', e: '202020', b: '3070d0', p: '203060', k: '101010', g: '909090', w: 'ffffff',
  d: '404048', o: '556b2f', q: 'a07040', f: '0a0a0a', y: 'ffd040', n: '4a3420', l: '8090a0', t: 'c0c8d0',
  r: 'b01818', v: '4a5a2a', z: 'd0a020', c: 'e8c878', i: 'ff6a10', a: 'c0b090', u: 'ff3030', m: '7a2a8a',
  A: 'e0d0b0', B: 'b08850', C: '2e7d32', D: 'c49a6c', E: '8a8a8a', F: '303030', G: '6a1a1a', I: 'f0e0c0' };
const BOSS_ART = [
  '......AAAAAAAAAA........', '....AAAAAAAAAAAAAA......', '....AAAAAAAAAAAAAA......', '.....BBBBBBBBBBBB.......',
  '.....BkkkkBBkkkkB.......', '.....BBBBBBBBBBBB.......', '.....BBhhhhhhhhBB.......', '.....BBBhhhhhhBBB.......',
  '......BBBBBBBBBB........', '...CCCCCCCCCCCCCCCC.....', '..CCCzCCCCCCCCCCzCCC....', '.CCCCCCCCCCCCCCCCCCCC...',
  'gCCCCCCDDCCCCDDCCCCCC...', 'ggCCCCCDDCCCCDDCCCCCC...', '.CCCCCCCCCCCCCCCCCCCC...', '.CCCCCCCCCCCCCCCCCCCC...',
  '..CCCCCCCCCCCCCCCCCC....', '..CCCCCCCCCCCCCCCCCC....', '...CCCCCCCCCCCCCCCC.....', '...EEEEEEEEEEEEEEEE.....',
  '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '..kkkkkkk....kkkkkkk....', '..kkkkkkk....kkkkkkk....',
];
// boss template letters A-E are recoloured per boss with lowercase palette keys (the template's A-E are NOT palette keys)
const recolor = map => BOSS_ART.map(l => l.replace(/[ABCDE]/g, ch => map[ch]));
const SPRITES = {
  daniel: ['...hhhh......', '..hhhhhh.....', '..hssssh.....', '..sseses.....', '..ssssss.....', '...ssss......',
    '..bbbbbb.....', '.bbbbbbbsggg.', 'sbbbbbbbbggg.', '.bbbbbbbb....', '..bbbbbb.....', '..pppppp.....',
    '..pp..pp.....', '..pp..pp.....', '..pp..pp.....', '.kkk..kkk....'],
  goon: ['.........qfffffff', '.........qfffffff', '.........qfffffff', '.........qfffffff', '.........q.......',
    '...kkkk..q.......', '..kkkkkk.q.......', '..kwkkwk.q.......', '..kkkkkk.q.......', '...kkkk..q.......',
    '..dddddd.q.......', '.ddddddddq.......', 'gddddddddq.......', '.dddddddd........', '..dddddd.........',
    '..oooooo.........', '..oo..oo.........', '..oo..oo.........', '..oo..oo.........', '.kkk..kkk........'],
  pierogi: ['..cccc..', '.cccccc.', 'cccccccc', '.c.c.c.c'],
  cigarette: ['.....l.l', '......l.', 'wwwwwwii'],
  // an Uncle of Truth behind cage bars (bars baked in: sprites never overlap each other)
  uncle: ['gggggggggggggg', 'g.aaaaaaaaa..g', 'g..aaaaaaa...g', 'g..sssssss...g', 'g..sesgses...g', 'g..sssssss...g',
    'g..wwwgwww...g', 'g..wwwwwww...g', 'g...wwgww....g', 'g..ttttttt...g', 'g.ttttgtttt..g', 'g.ttttttttt..g',
    'g..tttgttt...g', 'g..pppppppp..g', 'g..pp.g..pp..g', 'g..pp.g..pp..g', 'g.kkk.g.kkk..g', 'gggggggggggggg'],
  boss0: recolor({ A: 'h', B: 's', C: 'd', D: 'r', E: 'p' }),
  boss1: recolor({ A: 'o', B: 's', C: 'o', D: 'z', E: 'n' }),
  boss2: recolor({ A: 'r', B: 's', C: 'v', D: 'z', E: 'v' }),
};
const CKEYS = Object.keys(COL);
function spriteTables() {
  const SI = [0], SS = [], SE = [], SC = [], ROWBASE = {};
  let n = 0;
  for (const [name, art] of Object.entries(SPRITES)) {
    ROWBASE[name] = n;
    for (const line of art) {
      for (let x = 0; x < line.length;) { const c = line[x]; if (c === '.') { x++; continue; } let e = x; while (e < line.length && line[e] === c) e++; SS.push(x); SE.push(e); SC.push(CKEYS.indexOf(c)); x = e; }
      SI.push(SS.length); n++;
    }
  }
  return { SI, SS, SE, SC, ROWBASE };
}

// six areas: name, sky + ground colours, scenery, goons [x,y], items [x,y,kind 0 pierogi 1 cigarette], caged uncle, boss
const AREAS = [
  { name: 'OUTSKIRTS', sky: '2a3a6a', ground: '7a6a40', scen: [['palm', 30], ['house', 70, 40, 20, 'A', 'B'], ['palm', 140], ['rock', 190], ['house', 200, 30, 16, 'D', 'h']],
    goons: [[100, 60], [170, 110]], items: [[130, 95, 0]], uncle: null, boss: -1 },
  { name: 'BAZAAR', sky: '3a2a5a', ground: '8a7048', scen: [['tent', 20, 'r'], ['tent', 70, 'm'], ['house', 120, 36, 22, 'A', 'r'], ['tent', 175, 'z']],
    goons: [[70, 50], [120, 105], [150, 70]], items: [[95, 125, 1]], uncle: [40, 100], boss: 0 },
  { name: 'DESERT', sky: '4a3a6a', ground: 'c4a46c', scen: [['dune', 0], ['dune', 120], ['palm', 60], ['rock', 170], ['palm', 215]],
    goons: [[80, 55], [140, 110], [190, 70]], items: [[110, 80, 0]], uncle: [210, 105], boss: -1 },
  { name: 'OIL FIELD', sky: '1a1a2a', ground: '5a4a30', scen: [['derrick', 25], ['derrick', 95], ['tank', 140], ['derrick', 200]],
    goons: [[60, 100], [110, 50], [150, 115]], items: [[90, 120, 1]], uncle: [30, 50], boss: 1 },
  { name: 'RUINS', sky: '2a2a4a', ground: '7a7060', scen: [['pillar', 20], ['pillar', 45], ['ruin', 90], ['pillar', 170], ['pillar', 200]],
    goons: [[70, 70], [130, 50], [180, 105]], items: [[100, 110, 0], [210, 60, 0]], uncle: [40, 115], boss: -1 },
  { name: 'PALACE', sky: '3a1a3a', ground: '9a8a6a', scen: [['palacewall', 0], ['dome', 30], ['dome', 120], ['dome', 200]],
    goons: [[70, 60], [100, 110]], items: [[50, 120, 0]], uncle: [215, 45], boss: 2 },
];
const BOSSPOS = [[175, 70], [175, 70], [150, 80]];
// scenery band: paint each area into a colour grid (rows 0..SKY-1), then run-length into spans per row
function sceneryTables() {
  const idx = [0], S = [], E = [], C = [];
  for (const a of AREAS) {
    const g = Array.from({ length: SKY }, () => new Array(W).fill(null));
    const put = (x0, y0, w, h, c) => { for (let y = Math.max(2, y0); y < Math.min(SKY, y0 + h); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0 + w)); x++) g[y][x] = c; };
    for (const [kind, x, ...o] of a.scen) {
      if (kind === 'palm') { put(x + 4, 12, 3, SKY - 12, 'B'); put(x, 8, 11, 3, 'C'); put(x - 3, 10, 6, 2, 'C'); put(x + 8, 10, 6, 2, 'C'); }
      if (kind === 'house') { const [w, h, wall, roof] = o; put(x, SKY - h, w, h, wall); put(x - 2, SKY - h - 3, w + 4, 3, roof); put(x + w / 2 - 3, SKY - 8, 6, 8, 'h'); put(x + 4, SKY - h + 4, 5, 4, 'y'); }
      if (kind === 'rock') { put(x, SKY - 6, 14, 6, 'E'); put(x + 3, SKY - 9, 8, 3, 'E'); }
      if (kind === 'tent') { const [c] = o; for (let k = 0; k < 12; k++) put(x + 12 - k, SKY - 14 + k, 2 * k + 2, 1, c); put(x + 10, SKY - 6, 6, 6, 'F'); }
      if (kind === 'dune') { for (let k = 0; k < 10; k++) put(x + 50 - k * 5, SKY - 10 + k, k * 10 + 20, 1, 'D'); }
      if (kind === 'derrick') { for (let k = 0; k < 22; k++) { put(x + 10 - (k >> 1), SKY - 22 + k, 1, 1, 'F'); put(x + 10 + (k >> 1), SKY - 22 + k, 1, 1, 'F'); } put(x + 4, SKY - 12, 13, 1, 'F'); put(x + 9, SKY - 26, 3, 4, 'i'); }
      if (kind === 'tank') { put(x, SKY - 16, 40, 16, 'E'); put(x, SKY - 18, 40, 2, 'l'); put(x + 5, SKY - 10, 30, 2, 'F'); }
      if (kind === 'pillar') { put(x, SKY - 24, 8, 24, 'I'); put(x - 2, SKY - 26, 12, 2, 'I'); }
      if (kind === 'ruin') { put(x, SKY - 14, 60, 14, 'A'); put(x + 8, SKY - 22, 14, 8, 'A'); put(x + 36, SKY - 18, 10, 4, 'A'); put(x + 20, SKY - 8, 8, 8, 'F'); }
      if (kind === 'dome') { for (let k = 0; k < 10; k++) { const hw = Math.round(Math.sqrt(100 - (10 - k) * (10 - k)) * 1.6); put(x + 16 - hw, SKY - 26 + k, hw * 2, 1, 'z'); } put(x + 15, SKY - 30, 2, 4, 'z'); put(x + 2, SKY - 16, 28, 16, 'A'); }
      if (kind === 'palacewall') { put(0, SKY - 12, W, 12, 'A'); for (let xx = 0; xx < W; xx += 12) put(xx, SKY - 15, 6, 3, 'A'); for (let xx = 10; xx < W; xx += 40) put(xx, SKY - 8, 8, 8, 'G'); }
    }
    for (let r = 0; r < H; r++) {
      if (r >= 2 && r < SKY) for (let x = 0; x < W;) { const c = g[r][x]; if (!c) { x++; continue; } let e = x; while (e < W && g[r][e] === c) e++; S.push(x); E.push(e); C.push(CKEYS.indexOf(c)); x = e; }
      idx.push(S.length);
    }
  }
  return { idx, S, E, C };
}

export function generate({ debug = false } = {}) {
  const NS = H / STRIP, q = JSON.stringify, T = spriteTables(), SCN = sceneryTables(), RB = T.ROWBASE;
  const GROUND = H - 4, PUB = 3, NA = AREAS.length;
  if (T.SI.length - 1 !== Object.values(SPRITES).reduce((n, a) => n + a.length, 0) || T.SC.some(c => c < 0) || SCN.C.some(c => c < 0)) throw Error('self-check: tables');
  if (AREAS.filter(a => a.uncle).length !== 5 || AREAS.map(a => a.boss).filter(b => b >= 0).join() !== '0,1,2') throw Error('self-check: 5 uncles, 3 bosses');
  if (AREAS.some(a => a.goons.length > 7 || a.items.length > 7)) throw Error('self-check: masks are 8 bits');
  const GI = [0], GX = [], GY = [], II = [0], IX = [], IY = [], IK = [];
  for (const a of AREAS) { for (const [x, y] of a.goons) { GX.push(x); GY.push(y); } GI.push(GX.length); for (const [x, y, k] of a.items) { IX.push(x); IY.push(y); IK.push(k); } II.push(IX.length); }
  const N = { C: 1, D: 1.122, E: 1.26, F: 1.335, G: 1.498, A: 1.682, B: 1.888, c: 2, _: 0 };
  const tuneOf = t => t.replace(/ /g, '').split('').map(ch => N[ch]);
  const MUS = tuneOf('C_EG A_GE F_AF E_D_ C_EG A_cA G_ED C___'), BMUS = tuneOf('C_C_D_C_ E_E_D_C_ C_C_D_C_ G_E_D___').map(x => x * 0.75);
  const PRESENTS = 'RENDERMAN INDEPENDENT SOFTWARE COMPANY ENTERTAINMENT CLAUDE LLC PRESENTS';
  const ENAME = ['GOON', 'THE MANAGER', 'COLONEL CRUMB', 'NEO SADDAM'], EHP = [0, 40, 70, 110], EATK = [0, 4, 6, 8], EXP = [0, 40, 80, 0];
  const strips = Array.from({ length: NS }, (_, k) => k);
  const src = `// GENERATED by dvi/gen.mjs: edit that, not this file.
@left in tick: exec
@left in seated: bool
@left in sitter: character
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
const AI = [${SCN.idx.join(', ')}]
const AS = [${SCN.S.join(', ')}]
const AE = [${SCN.E.join(', ')}]
const AC = [${SCN.C.join(', ')}]
const SKYT = [${AREAS.map(a => q(`<color="${a.sky}">`)).join(', ')}]
const GNDT = [${AREAS.map(a => q(`<color="${a.ground}">`)).join(', ')}]
const BATT = ${q('<color="1a1030">')}
const ANAME = [${AREAS.map(a => q(a.name)).join(', ')}]
const GI = [${GI.join(', ')}]
const GX = [${GX.join(', ')}]
const GY = [${GY.join(', ')}]
const II = [${II.join(', ')}]
const IX = [${IX.join(', ')}]
const IY = [${IY.join(', ')}]
const IK = [${IK.join(', ')}]
const UX = [${AREAS.map(a => (a.uncle ? a.uncle[0] : -1)).join(', ')}]
const UY = [${AREAS.map(a => (a.uncle ? a.uncle[1] : -1)).join(', ')}]
const BOSSA = [${AREAS.map(a => a.boss).join(', ')}]
const BX = [${BOSSPOS.map(p => p[0]).join(', ')}]
const BY = [${BOSSPOS.map(p => p[1]).join(', ')}]
const BRB = [${RB.boss0}, ${RB.boss1}, ${RB.boss2}]
const ENAME = [${ENAME.map(q).join(', ')}]
const EHP = [${EHP.join(', ')}]
const EATK = [${EATK.join(', ')}]
const EXP = [${EXP.join(', ')}]
const P2 = [1, 2, 4, 8, 16, 32, 64, 128, 256]
const MUS = [${MUS.join(', ')}]
const BMUS = [${BMUS.join(', ')}]
const MENU = ["FIGHT", "PIEROGI", "SMOKE", "RUN"]

var rows: string[]
var dfl: int[]
var dl: int[]
var sdf: int[]
var is: float[]
var ie: float[]
var ic: float[]
${strips.map(k => `var st${k}: string = ""\nvar pb${k}: string = ""`).join('\n')}
var pubT: int = 0
var pubDirty: bool = false
var hudv: string = ""
var msgv: string = ""
var titlev: string = ""
var logv: string = ""
var mode: int = 0
var was: bool = false
var forced: bool = false
var hasSave: bool = false
var introUntil: float = 0.0
var flashUntil: float = 0.0
var area: int = 0
var px: float = 20.0
var py: float = 90.0
var opx: float = -1.0
var opy: float = -1.0
var lv: int = 1
var xp: int = 0
var hp: int = 20
var unc: int = 0
var boss: int = 0
var pie: int = 1
var cig: int = 0
var gm: int = 0
var im: int = 0
var buff: int = 0
var won: bool = false
var eKind: int = 0
var eIdx: int = 0
var eHP: int = 0
var eMax: int = 0
var eAtk: int = 0
var eXp: int = 0
var phase: int = 0
var tNext: float = 0.0
var cur: int = 0
var lastBa: bool = false
var lastUp: bool = false
var lastDn: bool = false
var lastA: bool = false
var dk: string = ""
var dkN: int = 0
var kt: float = 1.0
var lastT: float = 0.0
var s: string = ""
var xc: float = 0.0
var mel: float[]
var melPos: int = 0
var musT: int = 0
var aP0: float = 1.0
var aV0: float = 0.0
var aP1: float = 1.0
var aV1: float = 0.0

${strips.map(k => `@right out strip${k}: string = st${k}`).join('\n')}
@right out msg_: string = msgv
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
mod markAll() {
  for r in 0..${H} { mark(r) }
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
  logv = t
  flashUntil = ServerUptime() + 3.0
}
mod hpMax() -> int {
  return 16 + lv * 4
}
mod bit(mask: int, k: int) -> bool {
  return (mask / P2[k]) % 2 == 1
}
// ---- savegame: the sitter's leaderboard (the progress plugin keeps dv* across restarts)
mod save() {
  if seated {
    let c = sitter.ControllerOf()
    c.SetLeaderboard("dvLv", lv)
    c.SetLeaderboard("dvXp", xp)
    c.SetLeaderboard("dvHp", hp)
    c.SetLeaderboard("dvArea", area + 1)
    c.SetLeaderboard("dvUnc", unc)
    c.SetLeaderboard("dvBoss", boss)
    c.SetLeaderboard("dvPie", pie)
    c.SetLeaderboard("dvCig", cig)
  }
}
mod load() {
  if seated {
    let c = sitter.ControllerOf()
    var t: int = 0
    t = c.GetLeaderboard("dvLv")
    lv = max(t, 1)
    t = c.GetLeaderboard("dvXp")
    xp = t
    t = c.GetLeaderboard("dvHp")
    hp = if t > 0 then t else hpMax()
    t = c.GetLeaderboard("dvArea")
    area = max(t - 1, 0)
    t = c.GetLeaderboard("dvUnc")
    unc = t
    t = c.GetLeaderboard("dvBoss")
    boss = t
    t = c.GetLeaderboard("dvPie")
    pie = t
    t = c.GetLeaderboard("dvCig")
    cig = t
  }
}
mod peekSave() {
  let c = sitter.ControllerOf()
  var t: int = 0
  t = c.GetLeaderboard("dvLv")
  hasSave = t >= 1
}
mod newGame() {
  lv = 1
  xp = 0
  hp = hpMax()
  area = 0
  unc = 0
  boss = 0
  pie = 1
  cig = 0
  won = false
  save()
}
mod enterArea(a: int, x: float) {
  area = a
  px = x
  gm = P2[GI[a + 1] - GI[a]] - 1
  im = P2[II[a + 1] - II[a]] - 1
  mode = 1
  opx = -1.0
  save()
  markAll()
}
// ---- drawing
mod gapTag(r: int) -> string {
  if mode == 2 { return BATT }
  if r < ${SKY} { return SKYT[area] }
  return GNDT[area]
}
mod renderRow(r: int) {
  is.resize(0, 0.0)
  ie.resize(0, 0.0)
  ic.resize(0, 0.0)
  if r < 2 { span(0.0, ${W}.0, ${CKEYS.indexOf('l')}) }
  if mode == 2 {
    // battle: Daniel left, the enemy right, a floor
    if r >= 90 && r < 106 { spr(${RB.daniel}, r - 90, 50.0) }
    if eKind == 0 {
      if r >= 86 && r < 106 { spr(${RB.goon}, r - 86, 165.0) }
    } else {
      if r >= 78 && r < 106 { spr(BRB[eKind - 1], r - 78, 160.0) }
    }
    if r >= 106 && r < 110 { span(20.0, 220.0, ${CKEYS.indexOf('F')}) }
  } else {
    if r >= 2 && r < ${SKY} {
      let ai = area * ${H} + r
      for t in AI[ai]..AI[ai + 1] { span(AS[t], AE[t], AC[t]) }
    }
    for k in GI[area]..GI[area + 1] {
      if bit(gm, k - GI[area]) && r >= GY[k] && r < GY[k] + 20 { spr(${RB.goon}, r - GY[k], GX[k]) }
    }
    for k in II[area]..II[area + 1] {
      if bit(im, k - II[area]) && r >= IY[k] && r < IY[k] + 4 {
        if IK[k] == 0 { spr(${RB.pierogi}, r - IY[k], IX[k]) } else { if r < IY[k] + 3 { spr(${RB.cigarette}, r - IY[k], IX[k]) } }
      }
    }
    if UX[area] >= 0 && bit(unc, area) == false && r >= UY[area] && r < UY[area] + 18 { spr(${RB.uncle}, r - UY[area], UX[area]) }
    let ba2 = BOSSA[area]
    if ba2 >= 0 {
      if bit(boss, ba2) == false && r >= BY[ba2] && r < BY[ba2] + 28 { spr(BRB[ba2], r - BY[ba2], BX[ba2]) }
    }
    let dy0 = floor(py)
    if mode == 1 && r >= dy0 && r < dy0 + 16 { spr(${RB.daniel}, r - dy0, floor(px)) }
    if r >= ${GROUND} { span(0.0, ${W}.0, ${CKEYS.indexOf('n')}) }
  }
  is.sortMultiple(ie, ic)
  let gt = gapTag(r)
  s = ""
  xc = 0.0
  for j in 0..is.length() {
    let a = max(max(is.get(j), xc), 0.0)
    let b = min(ie.get(j), ${W}.0)
    if b > a {
      if a > xc { s = s .. gt .. BL.Substring(0, a - xc) .. "</>" }
      s = s .. COLS[ic.get(j)] .. BL.Substring(0, b - a) .. "</>"
      xc = b
    }
  }
  if xc < ${W}.0 { s = s .. gt .. BL.Substring(0, ${W}.0 - xc) .. "</>" }
  rows[r] = s
  sdf[r / ${STRIP}] = 1
}
// ---- battle
mod startBattle(kind: int, idx: int) {
  eKind = kind
  eIdx = idx
  if kind == 0 {
    eMax = 8 + area * 4
    eAtk = 2 + area
    eXp = 6 + area * 3
  } else {
    eMax = EHP[kind]
    eAtk = EATK[kind]
    eXp = EXP[kind]
  }
  eHP = eMax
  phase = 0
  cur = 0
  buff = 0
  mode = 2
  musT = 0
  if kind == 0 { logv = "A GOON BLOCKS YOUR PATH." } else { logv = "\${ENAME[kind]} STEPS FORWARD." }
  tune(0.8, 1.0, 1.26)
  markAll()
}
mod endBattle() {
  mode = 1
  px = max(px - 18.0, 0.0)
  opx = -1.0
  markAll()
}
mod enemyTurn() {
  var dmg: int = 0
  dmg = eAtk + floor(Random(0.0, eAtk * 0.5 + 1.0))
  hp -= dmg
  logv = "\${ENAME[eKind]} HITS YOU FOR \${dmg}."
  aP0 = 0.6
  aV0 = 0.5
  if hp <= 0 {
    hp = 0
    mode = 3
    won = false
    titlev = "DANIEL HAS FALLEN"
    logv = "SPACE: BACK TO YOUR LAST SAVE"
    tune(0.9, 0.75, 0.6)
    markAll()
  } else {
    phase = 2
    tNext = ServerUptime() + 0.8
  }
}
mod winBattle() {
  xp += eXp
  var up: bool = false
  up = false
  if xp >= lv * 12 {
    xp -= lv * 12
    lv += 1
    hp = hpMax()
    up = true
  }
  if eKind == 0 {
    gm = gm - P2[eIdx]
    if up { logv = "THE GOON FOLDS. +\${eXp} XP. LEVEL UP! LV \${lv}" } else { logv = "THE GOON FOLDS. +\${eXp} XP." }
  } else {
    boss = boss + P2[eKind - 1]
    if eKind == 3 { logv = "NEO SADDAM COLLAPSES INTO A PILE OF MEDALS. FREE THE LAST UNCLE." } else { logv = "\${ENAME[eKind]} IS DEFEATED. +\${eXp} XP. THE WAY IS OPEN." }
  }
  tune(1.26, 1.5, 2.0)
  phase = 3
  tNext = ServerUptime() + 2.0
  save()
}
mod act(choice: int) {
  var dmg: int = 0
  var ran: bool = false
  ran = false
  if choice == 0 {
    dmg = 2 + lv + floor(Random(0.0, 3.0))
    if buff > 0 {
      dmg = dmg * 2
      buff -= 1
    }
    eHP -= dmg
    logv = "DANIEL HITS FOR \${dmg}."
    aP0 = 1.8
    aV0 = 0.4
  }
  if choice == 1 {
    if pie > 0 {
      pie -= 1
      hp = min(hp + 12, hpMax())
      logv = "A PIEROGI. WARM, DENSE, HEALING. +12 HP."
      tune(1.5, 1.68, 2.0)
    } else { logv = "YOU PAT YOUR POCKETS. NO PIEROGI." }
  }
  if choice == 2 {
    if cig > 0 {
      cig -= 1
      buff = 3
      logv = "YOU LIGHT A CIGARETTE. YOU FEEL DANGEROUS. NEXT 3 HITS x2."
      tune(1.12, 1.0, 1.5)
    } else { logv = "NO CIGARETTES. YOU FEEL ORDINARY." }
  }
  if choice == 3 {
    if eKind == 0 && Random(0.0, 1.0) < 0.6 {
      logv = "YOU LEAVE AT A BRISK, DIGNIFIED JOG."
      flash(logv)
      ran = true
      endBattle()
    } else {
      if eKind == 0 { logv = "THE GOON STEPS ON YOUR SHOELACE." } else { logv = "\${ENAME[eKind]} WILL NOT ALLOW THIS." }
    }
  }
  if ran == false {
    if eHP <= 0 { winBattle() } else {
      phase = 1
      tNext = ServerUptime() + 1.0
    }
  }
}
mod countUncles() -> int {
  var n: int = 0
  n = 0
  for a in 0..${NA} { if bit(unc, a) { n += 1 } }
  return n
}
// ---- the whole game, one tick
mod step() {
  let now = ServerUptime()
  kt = min(max((now - lastT) * 10.0, 0.0), 2.5)
  lastT = now
  // inputs (+ the debug key, held a few ticks)
  let kU = up || (dk == "w" && dkN > 0)
  let kD = down || (dk == "s" && dkN > 0)
  let kL = left || (dk == "a" && dkN > 0)
  let kR = right || (dk == "d" && dkN > 0)
  let kS = ba || (dk == "space" && dkN > 0)
  let kA = kL || (dk == "new" && dkN > 0)
  if dkN > 0 { dkN -= 1 }
  let pS = kS && lastBa == false
  let pU = kU && lastUp == false
  let pD = kD && lastDn == false
  let pA = kA && lastA == false
  lastBa = kS
  lastUp = kU
  lastDn = kD
  lastA = kA
  if melPos < mel.length() {
    aP0 = max(mel.get(melPos), 0.1)
    aV0 = if mel.get(melPos) > 0.0 then 0.5 else 0.0
    melPos += 1
  } else { aV0 = 0.0 }
  var m: float = 0.0
  m = 0.0
  if mode == 1 { m = MUS[(musT / 3) % ${MUS.length}] }
  if mode == 2 { m = BMUS[(musT / 3) % ${BMUS.length}] }
  aP1 = max(m * 0.5, 0.1)
  aV1 = if m > 0.0 then 0.22 else 0.0
  musT += 1
  if mode == 0 {
    // title: the presents card, then continue / new game
    if now < introUntil { titlev = "${PRESENTS}" } else {
      titlev = "DANIEL VS ISIS"
      if hasSave { msgv = "SPACE: CONTINUE      A: NEW GAME" } else { msgv = "SPACE: NEW GAME" }
      if pS {
        if hasSave { load() } else { newGame() }
        titlev = ""
        py = 90.0
        enterArea(area, 10.0)
        flash("\${ANAME[area]}")
      } else {
        if pA && hasSave {
          newGame()
          titlev = ""
          py = 90.0
          enterArea(0, 10.0)
          flash("A NEW STORY. THE UNCLES ARE WAITING.")
        }
      }
    }
  }
  if mode == 1 {
    if kU { py -= 4.0 * kt }
    if kD { py += 4.0 * kt }
    if kL { px -= 4.0 * kt }
    if kR { px += 4.0 * kt }
    py = min(max(py, ${SKY}.0), ${GROUND - 16}.0)
    // a living boss blocks the way on
    let ba2 = BOSSA[area]
    if ba2 >= 0 {
      if bit(boss, ba2) == false { px = min(px, BX[ba2] - 14.0) }
    }
    if px > ${W - 13}.0 && area < ${NA - 1} { enterArea(area + 1, 2.0) }
    if px < 0.0 && area > 0 { enterArea(area - 1, ${W - 15}.0) }
    px = min(max(px, 0.0), ${W - 13}.0)
    if px != opx || py != opy {
      markSpan(opy, 16)
      markSpan(py, 16)
      opx = px
      opy = py
    }
    // bumping into things
    for k in GI[area]..GI[area + 1] {
      if mode == 1 && bit(gm, k - GI[area]) && px + 12.0 > GX[k] && px < GX[k] + 10.0 && py + 16.0 > GY[k] + 5.0 && py < GY[k] + 20.0 { startBattle(0, k - GI[area]) }
    }
    if mode == 1 && ba2 >= 0 {
      if bit(boss, ba2) == false && px + 13.0 >= BX[ba2] - 1.0 && py + 16.0 > BY[ba2] && py < BY[ba2] + 28.0 { startBattle(ba2 + 1, 0) }
    }
    for k in II[area]..II[area + 1] {
      if mode == 1 && bit(im, k - II[area]) && px + 12.0 > IX[k] && px < IX[k] + 8.0 && py + 16.0 > IY[k] && py < IY[k] + 4.0 {
        im = im - P2[k - II[area]]
        markSpan(IY[k], 4)
        if IK[k] == 0 {
          pie += 1
          flash("YOU FIND A PIEROGI. IT IS STILL WARM.")
        } else {
          cig += 1
          flash("YOU FIND A CIGARETTE. ZELDA WOULD APPROVE.")
        }
        tune(1.5, 1.68, 2.0)
        save()
      }
    }
    if mode == 1 && UX[area] >= 0 {
      if bit(unc, area) == false && px + 12.0 > UX[area] && px < UX[area] + 14.0 && py + 16.0 > UY[area] && py < UY[area] + 18.0 {
        unc = unc + P2[area]
        markSpan(UY[area], 18)
        let n = countUncles()
        flash("AN UNCLE OF TRUTH IS FREE! (\${n}/5) HE NODS SOLEMNLY.")
        tune(1.5, 2.0, 2.5)
        save()
        if n == 5 && bit(boss, 2) {
          won = true
          mode = 3
          titlev = "ALL 5 UNCLES OF TRUTH ARE FREE"
          logv = "NEO SADDAM IS NO MORE. THE UNCLES BUY YOU PIEROGI. SPACE TO WALK ON."
          markAll()
        }
      }
    }
  }
  if mode == 2 {
    if phase == 0 {
      if pU { cur = (cur + 3) % 4 }
      if pD { cur = (cur + 1) % 4 }
      if pS { act(cur) }
    } else {
      if phase == 1 && now >= tNext { enemyTurn() }
      if phase == 2 && now >= tNext { phase = 0 }
      if phase == 3 && now >= tNext {
        flash(logv)
        endBattle()
      }
    }
  }
  if mode == 3 && pS {
    if won {
      mode = 1
      titlev = ""
      markAll()
    } else {
      load()
      hp = hpMax()
      titlev = ""
      enterArea(area, 10.0)
      flash("YOU WAKE UP AT YOUR LAST SAVE, SMELLING OF PIEROGI.")
    }
  }
  // text lines
  let nu = countUncles()
  if mode == 2 {
    hudv = "DANIEL LV\${lv} HP \${hp}/\${hpMax()}     \${ENAME[eKind]} HP \${max(eHP, 0)}/\${eMax}"
    if phase == 0 {
      msgv = ""
      for k in 0..4 {
        var lab: string = ""
        lab = MENU[k]
        if k == 1 { lab = "PIEROGI \${pie}" }
        if k == 2 { lab = "SMOKE \${cig}" }
        if k == cur { msgv = msgv .. "> " .. lab .. "   " } else { msgv = msgv .. "  " .. lab .. "   " }
      }
    } else { msgv = logv }
  }
  if mode == 1 {
    hudv = "\${ANAME[area]}  LV\${lv} HP \${hp}/\${hpMax()} XP \${xp}/\${lv * 12}  PIEROGI \${pie} CIGS \${cig}  UNCLES \${nu}/5"
    if now < flashUntil { msgv = logv } else { msgv = "WASD walk   bump a goon to fight   free the caged uncles" }
  }
  if mode == 3 {
    hudv = "LV\${lv}  UNCLES \${nu}/5"
    msgv = logv
  }
}
mod idle() {
  if was {
    was = false
    mode = 0
    dl.resize(0, 0)
    dfl.fill(0)
    hudv = ""
    msgv = ""
    titlev = "DANIEL VS ISIS"
    aV0 = 0.0
    aV1 = 0.0
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
  PrintToConsole("dvhud|" .. hudv .. "|" .. msgv .. "|" .. titlev)
}
on ChatCommand("dvsit", "debug: play as if seated (toggle)") -> (ctrl, args) {
  forced = forced == false
}
on ChatCommand("dvkey", "debug: hold w a s d space new for 3 ticks") -> (ctrl, args) {
  dk = args
  dkN = 3
}
on ChatCommand("dvstate", "debug: print the game state") -> (ctrl, args) {
  PrintToConsole("dvstate|mode \${mode}|area \${area}|x \${px}|y \${py}|lv \${lv}|xp \${xp}|hp \${hp}|unc \${unc}|boss \${boss}|pie \${pie}|cig \${cig}|gm \${gm}|phase \${phase}|e \${eHP}")
}
` : ''}on tick {
  if seated || forced {
    if was == false {
      was = true
      rows.resize(${H}, "")
      dfl.resize(${H}, 0)
      sdf.resize(${NS}, 0)
      mode = 0
      area = 0
      hasSave = false
      if seated { peekSave() }
      introUntil = ServerUptime() + 3.5
      lastT = ServerUptime()
      markAll()
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
  return { src, W, H, STRIP, PAL, clockWhenSeated: !debug, titleMid: true, titleLH: 2.2, exactScreen: true, sitterPin: true, synths: ['Square', 'Triangle'] };
}
