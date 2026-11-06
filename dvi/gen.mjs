// dvi/gen.mjs: DANIEL VS ISIS, a turn-based story RPG (owner renderman 2026-11-05). Inspired by our ZELDOY (screen rooms
// with a top-down wipe, a guy who hands you things) and Mario RPG (timed hits: press Space on the "!" for a bonus hit,
// and again when an enemy swings to block). Story (owner): "i love living in turkey i want to go to america to be a cbd
// salesman. then isis shows up and smokes all your legal herb and a fat isis guy trips and destroys your house and cbd
// store and you need to travel the world map to these little villages and talking to guys and the isis guys took over a
// planet fitness in long island and a chillis in newark and the final boss is in the bronx and you drive a tiny european
// car". Intro card "RENDERMAN INDEPENDENT SOFTWARE COMPANY ENTERTAINMENT CLAUDE LLC PRESENTS". Cartoon, original art;
// goons carry blank black flags; no real logos (place names are text only).
// Engine: the pure-wire row engine of pong/wgen.mjs (240x160 at 10x10 pixels a micro brick, a changed row is rebuilt from
// coloured spans: precomputed scenery + live objects; back-buffered strips swapped together every 3 ticks).
// Flow: title -> prologue cutscene (Turkey, the herb, the fat guy, the rubble) -> walk Turkey -> world map (drive the
// tiny car between unlocked places with A/D, Space to go in) -> GREEK VILLAGE -> ITALIAN VILLAGE -> LONG ISLAND (parking
// lot, Planet Fitness: SWOLE GOON) -> NEWARK (Chili's dining room, kitchen: THE FAT ONE) -> THE BRONX (NEO SADDAM).
// Walk WASD; bump a guy to talk (Space for the next line), a goon or boss to fight (FIGHT / PIEROGI / SMOKE / RUN).
// Savegame on the sitter's leaderboard (dvLv dvXp dvHp dvArea=place+1 dvUnc=places unlocked dvBoss dvPie dvCig), kept
// across restarts by the progress plugin; autosaved on every place, item, talk gift and battle won.
export const W = 240, H = 160, STRIP = 20;
export const PAL = ['101828'];
const SKY = 34; // rows 2..SKY-1 = scenery band in places; rows SKY.. = the ground everything walks on

export const COL = { h: '5a3a1a', s: 'f0c090', e: '202020', b: '3070d0', p: '203060', k: '101010', g: '909090', w: 'ffffff',
  d: '404048', o: '556b2f', q: 'a07040', f: '0a0a0a', y: 'ffd040', n: '4a3420', l: '8090a0', t: 'c0c8d0',
  r: 'c01818', v: '4a5a2a', z: 'd0a020', c: 'e8c878', i: 'ff6a10', a: 'c0b090', u: 'ff3030', m: '6a2a9a',
  A: 'e0d0b0', B: 'b08850', C: '2e7d32', D: 'c49a6c', E: '8a8a8a', F: '303030', G: '6a1a1a', I: 'f0e0c0',
  J: '2060c0', K: 'f8f8f8', L: '58b850', M: 'ffd23a', N: '7a3020', O: 'b0b8c0', P: '9a4a2a', Q: '1e4a8a', R: '3a8a3a',
  S: 'd06a2a', T: '505860' };
// ---- GBA polish (owner: "make the graphics look like they have a 10 quadrillion dollar budget for a gba game"):
// every sprite and building is auto-shaded at build time (a lit top edge, a shadowed bottom/right edge), skies are
// per-row gradients, grounds get haze + texture bands, night skies a moon and stars, day skies a sun and clouds,
// characters cast drop shadows, the map gets beaches and wave bands, battles happen in the place's own scenery.
COL.x = '15120c'; // drop shadow
const hex3 = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mixHex = (a, b, t) => { const A = hex3(a), B = hex3(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
// derived colours get palette keys from U+00C0 up (keys are single characters; '.' stays transparent)
let nextKey = 0xC0;
const variants = {};
export function variant(k, sign) {
  const id = k + sign;
  if (!variants[id]) {
    const ch = String.fromCharCode(nextKey++);
    COL[ch] = sign === '+' ? mixHex(COL[k], 'ffffff', 0.3) : mixHex(COL[k], '000000', 0.35);
    variants[id] = ch;
  }
  return variants[id];
}
const NOSHADE = new Set(['.', 'w', 'k', 'x', 'e', 'i', 'y', 'u']);
// shade a grid of palette keys (arrays of rows): top edge of a colour = light, bottom or right edge = dark
export function shadeGrid(g) {
  return g.map((row, y) => row.map((c, x) => {
    if (c == null || NOSHADE.has(c) || c.charCodeAt(0) >= 0xC0) return c;
    const up = y > 0 ? g[y - 1][x] : null, down = y + 1 < g.length ? g[y + 1][x] : null, right = x + 1 < row.length ? row[x + 1] : null;
    if (up !== c) return variant(c, '+');
    if (down !== c || right !== c) return variant(c, '-');
    return c;
  }));
}
const shadeArt = art => shadeGrid(art.map(l => [...l].map(c => (c === '.' ? null : c)))).map(r => r.map(c => c ?? '.').join(''));

const BOSS_ART = [
  '......AAAAAAAAAA........', '....AAAAAAAAAAAAAA......', '....AAAAAAAAAAAAAA......', '.....BBBBBBBBBBBB.......',
  '.....BkkkkBBkkkkB.......', '.....BBBBBBBBBBBB.......', '.....BBhhhhhhhhBB.......', '.....BBBhhhhhhBBB.......',
  '......BBBBBBBBBB........', '...CCCCCCCCCCCCCCCC.....', '..CCCzCCCCCCCCCCzCCC....', '.CCCCCCCCCCCCCCCCCCCC...',
  'gCCCCCCDDCCCCDDCCCCCC...', 'ggCCCCCDDCCCCDDCCCCCC...', '.CCCCCCCCCCCCCCCCCCCC...', '.CCCCCCCCCCCCCCCCCCCC...',
  '..CCCCCCCCCCCCCCCCCC....', '..CCCCCCCCCCCCCCCCCC....', '...CCCCCCCCCCCCCCCC.....', '...EEEEEEEEEEEEEEEE.....',
  '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....',
  '...EEEEEE....EEEEEE.....', '...EEEEEE....EEEEEE.....', '..kkkkkkk....kkkkkkk....', '..kkkkkkk....kkkkkkk....',
];
const recolor = (art, map) => art.map(l => l.replace(/[A-E]/g, ch => map[ch] ?? ch));
// a village guy: H hair, S shirt, P pants (recoloured per guy)
const GUY = ['...HHHH.....', '..HHHHHH....', '..HssssH....', '..sesses....', '..ssssss....', '...ssss.....', '..SSSSSS....',
  '.SSSSSSSS...', 'sSSSSSSSSs..', '.SSSSSSSS...', '..SSSSSS....', '..PPPPPP....', '..PP..PP....', '..PP..PP....', '..PP..PP....', '.kkk..kkk...'];
const guy = (h, sh, pa) => GUY.map(l => l.replace(/H/g, h).replace(/S/g, sh).replace(/P/g, pa));
const RAW_SPRITES = {
  daniel: ['...hhhh......', '..hhhhhh.....', '..hssssh.....', '..sseses.....', '..ssssss.....', '...ssss......',
    '..bbbbbb.....', '.bbbbbbbsggg.', 'sbbbbbbbbggg.', '.bbbbbbbb....', '..bbbbbb.....', '..pppppp.....',
    '..pp..pp.....', '..pp..pp.....', '..pp..pp.....', '.kkk..kkk....'],
  goon: ['.........qfffffff', '.........qfffffff', '.........qfffffff', '.........qfffffff', '.........q.......',
    '...kkkk..q.......', '..kkkkkk.q.......', '..kwkkwk.q.......', '..kkkkkk.q.......', '...kkkk..q.......',
    '..dddddd.q.......', '.ddddddddq.......', 'gddddddddq.......', '.dddddddd........', '..dddddd.........',
    '..oooooo.........', '..oo..oo.........', '..oo..oo.........', '..oo..oo.........', '.kkk..kkk........'],
  fat: ['......kkkkkk............', '....kkkkkkkkkk..........', '....kkwkkkkwkk..........', '....kkkkkkkkkk..........',
    '.....kkkkkkkk...........', '..dddddddddddddd........', '.dddddddddddddddd.......', 'gddddddddddddddddd......',
    'dddddddddddddddddd......', 'dddddddddddddddddd......', 'dddddddddddddddddd......', 'dddddddddddddddddd......',
    '.dddddddddddddddd.......', '..dddddddddddddd........', '...oooooooooooo.........', '...ooooo..ooooo.........',
    '...ooooo..ooooo.........', '..kkkkkk..kkkkkk........'],
  smokecloud: ['..ll..l...', '.llllllll.', 'llllllllll', '.llll.lll.', '..l...l...'],
  pierogi: ['..cccc..', '.cccccc.', 'cccccccc', '.c.c.c.c'],
  cigarette: ['.....l.l', '......l.', 'wwwwwwii'],
  car: ['....rrrrrr........', '...rttttttr.......', '..rrttttttrrr.....', 'rrrrrrrrrrrrrrrr..', 'rrrrrrrrrrrrrrrrr.',
    'rrrkkrrrrrrrkkrrr.', '...kk.......kk....'],
  node: ['.yy.', 'yyyy', 'yyyy', '.yy.'],
  ketchup: ['.ww.', '.rr.', 'rrrr', 'rKKr', 'rrrr', 'rrrr', 'rrrr'],
  blocker: guy('k', 'z', 'n'), // THE MAN WHO BLOCKS THE PATH (italian village)
  nodeoff: ['.EE.', 'EEEE', 'EEEE', '.EE.'],
  guy0: guy('E', 'w', 'p'), guy1: guy('h', 'S', 'k'), guy2: guy('k', 'L', 'p'),
  guy3: guy('h', 'm', 'k'), guy4: guy('n', 'r', 'k'), guy5: guy('E', 'O', 'p'),
  boss0: recolor(BOSS_ART, { A: 'k', B: 's', C: 'm', D: 'M', E: 'k' }), // SWOLE GOON: gym purple + yellow
  boss1: recolor(BOSS_ART, { A: 'k', B: 's', C: 'd', D: 'r', E: 'o' }), // (unused: THE FAT ONE has the fat sprite)
  boss2: recolor(BOSS_ART, { A: 'r', B: 's', C: 'v', D: 'z', E: 'v' }), // NEO SADDAM: red beret, shades, olive + gold
};
RAW_SPRITES.shadow = ['..xxxxxxxx..', 'xxxxxxxxxxxx', '..xxxxxxxx..'];
RAW_SPRITES.bshadow = ['...xxxxxxxxxxxxxxxxxx...', 'xxxxxxxxxxxxxxxxxxxxxxxx', '...xxxxxxxxxxxxxxxxxx...'];
RAW_SPRITES.platform = ['......xxxxxxxxxxxxxxxxxxxxxxxx......', '..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..'];
export const SPRITES = Object.fromEntries(Object.entries(RAW_SPRITES).map(([k, art]) => [k, shadeArt(art)]));
let CKEYS = Object.keys(COL); // refreshed after the scenery adds its colours (see generate)
export function spriteTables() {
  CKEYS = Object.keys(COL);
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

// places (scenes). scen = scenery band shapes; npcs [x, y, guy, first line, last line, gift 0/1 pierogi/2 cigarette]
export const AREAS = [
  { name: 'TURKEY, HOME', sky: '3a4a8a', ground: '9a7a4a', scen: [['house', 20, 44, 22, 'A', 'P'], ['cbd', 90], ['palm', 160], ['olive', 190], ['olive', 215]],
    goons: [], items: [], npcs: [[150, 90, 1, 'neighbor']], boss: -1 },
  { name: 'GREEK VILLAGE', sky: '3a7ad0', ground: 'd8c8a0', scen: [['whitehouse', 10], ['whitehouse', 60], ['windmill', 120], ['whitehouse', 170], ['whitehouse', 205]],
    goons: [[110, 60], [190, 110]], items: [[60, 120, 0], [210, 45, 2]], npcs: [[40, 60, 0, 'greek'], [150, 120, 5, 'fisher']], boss: -1 },
  { name: 'ITALIAN VILLAGE', sky: '4a6ab0', ground: 'b89a6a', scen: [['terra', 10], ['cypress', 70], ['terra', 95], ['cypress', 150], ['terra', 175]],
    goons: [[90, 100], [160, 55], [205, 115]], items: [[130, 80, 1]], npcs: [[40, 100, 2, 'nonno']], boss: -1 },
  { name: 'LONG ISLAND, PARKING LOT', sky: '20304a', ground: '585858', scen: [['pf', 40], ['lamp', 10], ['lamp', 200], ['parkedcar', 150]],
    goons: [[80, 60], [130, 110], [180, 70]], items: [[60, 120, 0]], npcs: [[30, 90, 3, 'frontdesk']], boss: -1 },
  { name: 'PLANET FITNESS, GYM FLOOR', sky: '4a2a6a', ground: '303038', scen: [['gymwall', 0], ['treadmill', 20], ['treadmill', 60], ['rack', 110], ['treadmill', 200]],
    goons: [[70, 100], [120, 55]], items: [[40, 60, 1]], npcs: [], boss: 0 },
  { name: 'NEWARK, CHILI\'S DINING ROOM', sky: '5a1a1a', ground: '6a4028', scen: [['chiliwall', 0], ['booth', 20], ['booth', 80], ['pepper', 140], ['booth', 180]],
    goons: [[90, 60], [140, 110], [190, 70]], items: [[60, 120, 0]], npcs: [[40, 70, 4, 'waiter']], boss: -1 },
  { name: 'CHILI\'S KITCHEN', sky: '3a3a40', ground: '8a8a90', scen: [['steelwall', 0], ['fryer', 30], ['fryer', 70], ['counter', 120]],
    goons: [[80, 110]], items: [[50, 60, 1]], npcs: [], boss: 1 },
  { name: 'THE BRONX', sky: '1a2030', ground: '505058', scen: [['brick', 0], ['brick', 60], ['eltrain', 0], ['brick', 130], ['brick', 190]],
    goons: [[70, 60], [110, 115]], items: [[40, 120, 0]], npcs: [[30, 60, 5, 'bodega']], boss: 2 },
];
const TURKEY_RUBBLE = AREAS.length; // scenery slot 8 = Turkey after the fat guy; slot 9 = the world map (whole screen)
const MAP_SLOT = AREAS.length + 1;
// world map places: name, map x, y, first area, last area
export const NODES = [
  ['TURKEY', 222, 92, 0, 0], ['GREEK VILLAGE', 196, 100, 1, 1], ['ITALIAN VILLAGE', 172, 82, 2, 2],
  ['LONG ISLAND', 58, 62, 3, 4], ['NEWARK', 40, 72, 5, 6], ['THE BRONX', 50, 52, 7, 7],
];
const BOSSPOS = [[175, 70], [170, 80], [150, 80]]; // boss 0 SWOLE GOON (area 4), 1 THE FAT ONE (area 6), 2 NEO SADDAM (area 7)
// dialogue, Kingdom of Loathing tone. Each guy has a block of lines, shown one at a time with Space.
export const TALK = {
  neighbor: ['NEIGHBOR: THEY WENT WEST, DANIEL. TO AMERICA.', 'NEIGHBOR: TAKE YOUR LITTLE CAR. IT GETS 90 MILES TO THE GALLON AND 4 TO THE POTHOLE.', 'NEIGHBOR: I SAVED NOTHING FROM YOUR STORE. I WANT TO BE HONEST ABOUT THAT.'],
  greek: ['OLD GREEK GUY: ISIS CAME THROUGH. THEY ASKED THE WAY TO NEW JERSEY.', 'OLD GREEK GUY: I LIED TO THEM. THEY WENT ANYWAY. NEW JERSEY IS LIKE THAT.'],
  fisher: ['FISHERMAN: MY COUSIN MARRIED A POLISH WOMAN. THE WEDDING HAD 400 PIEROGI.', 'FISHERMAN: HERE. HAVE ONE BEFORE IT HAS YOU.'],
  nonno: ['NONNO: YOUR CAR IS TOO BIG FOR OUR STREETS. THAT IS A JOKE. IT IS NOT BIG.', 'NONNO: TAKE A CIGARETTE. NOT FOR SMOKING. FOR CONFIDENCE. ALSO SMOKING.'],
  frontdesk: ['FRONT DESK GUY: WELCOME TO THE JUDGEMENT FREE ZONE.', 'FRONT DESK GUY: ISIS IS JUDGING EVERYONE IN THERE. IT IS A WHOLE THING.', 'FRONT DESK GUY: THE BIG ONE HAS NOT LEFT THE SQUAT RACK IN SIX DAYS.'],
  waiter: ['WAITER: THEY ORDERED THE BABY BACK RIBS AND NEVER LEFT. THAT WAS IN MARCH.', 'WAITER: THE FAT ONE IS IN THE KITCHEN. HE KEEPS SAYING HE TRIPPED ON SOMETHING IN TURKEY.'],
  bodega: ['BODEGA GUY: NEO SADDAM IS DOWN THE BLOCK. HE WENT IN FOR A LOTTO TICKET AND NEVER CAME OUT.', 'BODEGA GUY: BRING A PIEROGI. BRING TWO. BRING A GROWN-UP.'],
};
const GIFT = { fisher: 1, nonno: 2 };
export const CUTSCENE = [
  'I LOVE LIVING IN TURKEY.',
  'BUT ONE DAY I WILL GO TO AMERICA AND BE A CBD SALESMAN.',
  'THEN ISIS SHOWED UP.',
  'THEY SMOKED ALL OF YOUR LEGAL HERB. ALL OF IT. EVEN THE GUMMIES.',
  'A FAT ISIS GUY TRIPPED OVER THE GUMMIES.',
  'YOUR HOUSE AND YOUR CBD STORE ARE NOW ONE SMALLER, SADDER PILE.',
  'THEY FLED TO AMERICA. YOU HAVE A TINY EUROPEAN CAR AND A GRUDGE.',
];

// THE MAN WHO BLOCKS THE PATH (italian village, by the exit) + the ketchup (greek village). Cartoon dark comedy: text and
// sound only, nothing drawn. dvBoss bits: 0-2 bosses, 3 = the man is eaten, 4 = you carry ketchup.
const BLX = 205, BLY = 70, BLOCK_AREA = 2;
// THE ITEM LIST (owner: "ketchup is not an enumerated object its an item that goes into the list of items you have"):
// every item is an entry here; the chip keeps a count per entry (inv[]), Q shows the ones you have, Space uses one.
export const ITEMS = [
  ['PIEROGI', 'HEALS 12 HP. WARM, DENSE, GRANDMOTHERLY.'],
  ['CIGARETTE', 'YOUR NEXT 3 HITS DO DOUBLE. ZELDA STYLE.'],
  ['KETCHUP', 'A CONDIMENT. SOMEONE, SOMEWHERE, IS AFRAID OF IT.'],
];
export const EATSCENE = [
  'YOU APPLY THE KETCHUP. HE LOOKS CONCERNED.',
  'YOU EAT HIM ALIVE.',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH',
  '(HE PAUSES TO CATCH HIS BREATH. YOU WAIT. IT IS ONLY POLITE.)',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH',
  'THE PATH IS CLEAR. YOU FEEL FULL, AND A LITTLE ASHAMED.',
];
const EATSCENE_T = [3.0, 2.5, 5.0, 2.5, 6.0, 3.5]; // seconds each line stays (the screams are the long ones)

// SONGBOOK (owner: "make a song for every town or city"). One char = one step (3 ticks at 20 Hz): C D E F G A B =
// octave 1, c d e f g a b = an octave up, H = Bb, I = Eb, J = Ab, K = F#, L = C#, _ = rest; spaces only group bars.
// Pitches multiply the synth's base note. All melodies are original.
export const NOTE = { C: 1, D: 1.122, E: 1.26, F: 1.335, G: 1.498, A: 1.682, B: 1.888, H: 1.782, I: 1.189, J: 1.587, K: 1.414, L: 1.059, _: 0 };
for (const k of 'CDEFGAB') NOTE[k.toLowerCase()] = NOTE[k] * 2;
export const SONGS = {
  'TURKEY, HOME': 'DIKG A_HA GKID ____ AHcH AGKI D_I_ D___',          // a hijaz-flavoured lament over the rubble
  'GREEK VILLAGE': 'EEAA BBcc dccB A___ EEAA BBcc dedc B___',         // a quickening line-dance tune
  'ITALIAN VILLAGE': 'AEAcAc edecBA EAEcAc BGBA__',                    // tarantella, in sixes
  'LONG ISLAND, PARKING LOT': 'C_G_ c_G_ A_E_ F_G_ C_G_ c_e_ d_c_ G___', // late-night synth-pop in a parking lot
  'PLANET FITNESS, GYM FLOOR': 'CCGC CCGC FFcF GGdG CCGC CCGC FFcF GG__', // four on the floor, one more rep
  "NEWARK, CHILI'S DINING ROOM": 'G_GA B_d_ c_B_ A_G_ G_GA B_d_ e_d_ c___', // countryish, for the ribs
  "CHILI'S KITCHEN": 'cBAG cBAG dcBA dcBA ecdB cAB_ G___',              // frantic, something is on fire
  'THE BRONX': 'C__C _I_C __H_ G___ C__C _I_F __I_ D___',             // a slow boom-bap walk
};
export const THEMES = {
  map: 'G_E_C_E_ G_c_A_G_ F_A_c_A_ G___E___',
  battle: 'C_C_D_C_ E_E_D_C_ C_C_D_C_ G_E_D___',
  boss: 'C_IC _G_F I_D_ C___ C_IC _G_H G_F_ I___',
};
export const tuneOf = t => t.replace(/ /g, '').split('').map(ch => { if (!(ch in NOTE)) throw Error(`bad note ${ch}`); return NOTE[ch]; });

export function sceneryTables() {
  const idx = [0], S = [], E = [], C = [];
  const slots = [...AREAS.map(a => ({ scen: a.scen, sky: a.sky })), { scen: [['rubble', 20], ['rubble', 90], ['palm', 160], ['olive', 190], ['olive', 215]], sky: AREAS[0].sky }, { map: true }];
  for (const slot of slots) {
    const rowsN = slot.map ? H : SKY;
    const g = Array.from({ length: rowsN }, () => new Array(W).fill(null));
    const put = (x0, y0, w, h, c) => { for (let y = Math.max(2, Math.round(y0)); y < Math.min(rowsN, Math.round(y0 + h)); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0 + w)); x++) g[y][x] = c; };
    if (slot.map) {
      // world map: America on the left, Europe + Turkey on the right, the Atlantic between (gap colour = ocean)
      for (const [x, y, w, h] of [[0, 20, 70, 110], [0, 30, 82, 80], [10, 110, 40, 30], [30, 40, 45, 50]]) put(x, y, w, h, 'R');
      for (const [x, y, w, h] of [[150, 30, 90, 50], [160, 70, 80, 25], [166, 78, 14, 30], [188, 92, 20, 18], [205, 82, 35, 22], [140, 20, 40, 20]]) put(x, y, w, h, 'R');
      put(166, 100, 30, 6, 'Q'); // the Mediterranean bites in
      for (let i = 0; i + 1 < NODES.length; i++) { // dotted route
        const [, x0, y0] = NODES[i], [, x1, y1] = NODES[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5);
        for (let k = 1; k < n; k++) put(x0 + 1 + (x1 - x0) * k / n, y0 + 1 + (y1 - y0) * k / n, 2, 2, 't');
      }
    }
    for (const [kind, x, ...o] of slot.scen ?? []) {
      const B = SKY;
      if (kind === 'palm') { put(x + 4, 12, 3, B - 12, 'B'); put(x, 8, 11, 3, 'C'); put(x - 3, 10, 6, 2, 'C'); put(x + 8, 10, 6, 2, 'C'); }
      if (kind === 'olive') { put(x + 4, 18, 3, B - 18, 'h'); put(x, 10, 12, 9, 'v'); }
      if (kind === 'house') { const [w, h, wall, roof] = o; put(x, B - h, w, h, wall); put(x - 2, B - h - 3, w + 4, 3, roof); put(x + w / 2 - 3, B - 8, 6, 8, 'h'); put(x + 4, B - h + 4, 5, 4, 'y'); }
      if (kind === 'cbd') { put(x, B - 24, 50, 24, 'K'); put(x - 2, B - 27, 54, 3, 'L'); put(x + 20, B - 22, 10, 3, 'L'); put(x + 23, B - 25, 4, 9, 'L'); put(x + 6, B - 12, 10, 12, 'J'); put(x + 30, B - 14, 14, 8, 'J'); }
      if (kind === 'rubble') { for (let k = 0; k < 6; k++) put(x + k * 8, B - 4 - (k * 7) % 9, 10, 4 + (k * 7) % 9, k % 2 ? 'A' : 'E'); put(x + 14, B - 6, 6, 2, 'L'); put(x + 30, B - 3, 8, 3, 'K'); }
      if (kind === 'whitehouse') { put(x, B - 20, 30, 20, 'K'); put(x + 8, B - 27, 14, 7, 'J'); put(x + 12, B - 10, 6, 10, 'J'); put(x + 3, B - 16, 5, 4, 'J'); }
      if (kind === 'windmill') { put(x + 8, B - 26, 12, 26, 'K'); put(x + 6, B - 30, 16, 4, 'P'); put(x + 13, 4, 2, 22, 'h'); put(x + 2, 14, 24, 2, 'h'); }
      if (kind === 'terra') { put(x, B - 22, 40, 22, 'D'); put(x - 2, B - 25, 44, 3, 'S'); put(x + 6, B - 16, 6, 6, 'C'); put(x + 26, B - 16, 6, 6, 'C'); put(x + 16, B - 10, 8, 10, 'h'); }
      if (kind === 'cypress') { put(x + 3, 6, 6, B - 6, 'R'); put(x + 5, 2, 2, 4, 'R'); }
      if (kind === 'pf') { put(x, B - 26, 110, 26, 'm'); put(x, B - 30, 110, 4, 'M'); put(x + 40, B - 14, 30, 14, 'K'); put(x + 10, B - 24, 20, 6, 'M'); put(x + 80, B - 24, 20, 6, 'M'); }
      if (kind === 'lamp') { put(x + 2, 6, 2, B - 6, 'E'); put(x, 4, 8, 2, 'M'); }
      if (kind === 'parkedcar') { put(x, B - 8, 30, 6, 'J'); put(x + 6, B - 12, 18, 4, 't'); put(x + 3, B - 3, 5, 3, 'k'); put(x + 22, B - 3, 5, 3, 'k'); }
      if (kind === 'gymwall') { put(0, 2, W, B - 2, 'm'); for (let xx = 0; xx < W; xx += 30) put(xx + 4, 6, 18, 8, 'M'); }
      if (kind === 'treadmill') { put(x, B - 6, 28, 6, 'T'); put(x + 22, B - 18, 3, 12, 'T'); put(x + 18, B - 20, 10, 3, 'k'); }
      if (kind === 'rack') { put(x, B - 22, 60, 2, 'T'); for (let xx = 0; xx < 60; xx += 10) put(x + xx + 2, B - 20, 6, 6, 'k'); put(x, B - 12, 60, 2, 'T'); put(x, B - 22, 2, 22, 'T'); put(x + 58, B - 22, 2, 22, 'T'); }
      if (kind === 'chiliwall') { put(0, 2, W, B - 2, 'N'); for (let xx = 10; xx < W; xx += 50) put(xx, 8, 24, 12, 'M'); }
      if (kind === 'booth') { put(x, B - 14, 36, 14, 'r'); put(x + 6, B - 18, 24, 4, 'D'); }
      if (kind === 'pepper') { put(x, 8, 26, 12, 'r'); put(x + 24, 6, 6, 6, 'R'); put(x + 4, 20, 18, 4, 'r'); }
      if (kind === 'steelwall') { put(0, 2, W, B - 2, 'O'); for (let xx = 0; xx < W; xx += 40) put(xx, 2, 2, B - 2, 'E'); }
      if (kind === 'fryer') { put(x, B - 18, 30, 18, 'T'); put(x + 3, B - 20, 24, 2, 'M'); put(x + 4, B - 12, 22, 2, 'k'); }
      if (kind === 'counter') { put(x, B - 12, 110, 12, 'O'); put(x, B - 14, 110, 2, 'E'); put(x + 20, B - 20, 14, 6, 'K'); put(x + 60, B - 18, 10, 4, 'r'); }
      if (kind === 'brick') { put(x, 4, 50, B - 4, 'P'); for (let yy = 8; yy < B - 6; yy += 8) for (let xx = 6; xx < 46; xx += 12) put(x + xx, yy, 6, 4, 'y'); put(x + 18, B - 10, 12, 10, 'h'); }
      if (kind === 'eltrain') { put(0, 12, W, 4, 'T'); for (let xx = 10; xx < W; xx += 40) put(xx, 16, 4, B - 16, 'T'); put(90, 6, 60, 6, 'O'); }
    }
    if (slot.map) { // beaches: land touching the sea
      const land = g.map(row => row.map(c => c === 'R'));
      for (let y = 2; y < rowsN; y++) for (let x = 0; x < W; x++) if (land[y][x] && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !(land[y + dy]?.[x + dx]))) g[y][x] = 'c';
    }
    const shaded = shadeGrid(g);
    for (let y = 0; y < rowsN; y++) g[y] = shaded[y];
    if (!slot.map && slot.sky) { // sky dressing, behind everything (only on empty sky)
      const night = hex3(slot.sky).reduce((a, b) => a + b) < 3 * 0x48;
      let seed = slot.sky.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
      const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
      const free = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (y < 2 || y >= rowsN || x < 0 || x >= W || g[y][x]) return false; return true; };
      const dot = (x, y, c) => { if (free(x, y, 1, 1)) g[y][x] = c; };
      if (night) {
        for (let k = 0; k < 26; k++) dot(Math.floor(rnd() * W), 3 + Math.floor(rnd() * 18), rnd() < 0.7 ? 'w' : 't');
        const mx = 30 + Math.floor(rnd() * 170), my = 6;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x - 3.5) ** 2 + (y - 3.5) ** 2 <= 13 && free(mx + x, my + y, 1, 1)) g[my + y][mx + x] = (x - 2) ** 2 + (y - 2) ** 2 < 3 ? 'O' : 'K';
      } else {
        const sx = 180 + Math.floor(rnd() * 40);
        for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x - 4) ** 2 + (y - 4) ** 2 <= 17 && free(sx + x, 4 + y, 1, 1)) g[4 + y][sx + x] = 'M';
        for (let k = 0; k < 3; k++) {
          const cx = Math.floor(rnd() * 160), cy = 5 + Math.floor(rnd() * 8);
          for (const [dx, dy, w] of [[4, 0, 10], [0, 1, 20], [2, 2, 18]]) for (let x = 0; x < w; x++) dot(cx + dx + x, cy + dy, dy === 0 ? 'K' : 'I');
        }
      }
    }
    const keys = Object.keys(COL); // after shading: includes the new variant colours
    for (let r = 0; r < H; r++) {
      if (r >= 2 && r < rowsN) for (let x = 0; x < W;) { const c = g[r][x]; if (!c) { x++; continue; } let e = x; while (e < W && g[r][e] === c) e++; S.push(x); E.push(e); C.push(keys.indexOf(c)); x = e; }
      idx.push(S.length);
    }
  }
  return { idx, S, E, C };
}

// gap colour for every row of every place (+ the map): sky gradient top -> horizon, ground haze near the horizon,
// texture bands, a darker foreground; the map's ocean gets wave bands. Deduplicated into GTAGS + GIDX.
export function gapRows() {
  const out = [];
  for (const a of AREAS) for (let r = 0; r < H; r++) {
    if (r < SKY) { const t = Math.max(0, r - 2) / (SKY - 3); out.push(mixHex(mixHex(a.sky, '000000', 0.45), mixHex(a.sky, a.ground, 0.35), Math.round(t * 7) / 7)); continue; }
    const d = (r - SKY) / (H - SKY);
    let c = mixHex(mixHex(a.ground, a.sky, 0.25), a.ground, Math.min(1, Math.round(d * 4 * 3) / 3)); // haze fades over the first quarter
    if (Math.floor((r - SKY) / 6) % 2) c = mixHex(c, '000000', 0.06);                               // texture bands
    out.push(mixHex(c, '000000', Math.round(d * 4) * 0.05));                                         // darker foreground
  }
  for (let r = 0; r < H; r++) out.push(mixHex(mixHex('2a6ab0', '0e2a5a', r / H), 'ffffff', r % 7 === 3 ? 0.12 : 0));
  return out;
}

export function generate({ debug = false } = {}) {
  const SCN = sceneryTables(); // first: it adds the shaded scenery colours to the palette
  const NS = H / STRIP, q = JSON.stringify, T = spriteTables(), RB = T.ROWBASE;
  const GR = gapRows(), GTAGS = [...new Set(GR)], GIDX = GR.map(c => GTAGS.indexOf(c));
  const GROUND = H - 4, PUB = 3, NA = AREAS.length, NN = NODES.length;
  // dialogue lines flattened; each npc gets [first, last] line indices
  const DLG = [], NPC = [];
  AREAS.forEach((a, ai) => a.npcs.forEach(([x, y, g, who]) => { const f = DLG.length; DLG.push(...TALK[who]); NPC.push({ ai, x, y, g, f, l: DLG.length - 1, gift: GIFT[who] ?? 0 }); }));
  const NI = [0]; AREAS.forEach((_, ai) => NI.push(NPC.filter(n => n.ai <= ai).length));
  if (T.SI.length - 1 !== Object.values(SPRITES).reduce((n, a) => n + a.length, 0) || T.SC.some(c => c < 0) || SCN.C.some(c => c < 0)) throw Error('self-check: tables');
  if (AREAS.map(a => a.boss).filter(b => b >= 0).join() !== '0,1,2' || NODES.at(-1)[4] !== NA - 1) throw Error('self-check: story layout');
  if (AREAS.some(a => a.goons.length > 7 || a.items.length > 7 || a.npcs.length > 7)) throw Error('self-check: masks are 8 bits');
  if (DLG.some(l => l.includes('"'))) throw Error('self-check: no quotes in dialogue');
  const GI = [0], GX = [], GY = [], II = [0], IX = [], IY = [], IK = [];
  for (const a of AREAS) { for (const [x, y] of a.goons) { GX.push(x); GY.push(y); } GI.push(GX.length); for (const [x, y, k] of a.items) { IX.push(x); IY.push(y); IK.push(k); } II.push(IX.length); }
  const AN = AREAS.map((_, ai) => NODES.findIndex(nd => ai >= nd[3] && ai <= nd[4])); // area -> its place on the map
  // per-place songs, flattened: place a plays MUSA[MI[a] .. MI[a + 1]]
  if (AREAS.some(a => !SONGS[a.name])) throw Error('self-check: every place has a song');
  const MUSA = [], MI = [0];
  for (const a of AREAS) { MUSA.push(...tuneOf(SONGS[a.name])); MI.push(MUSA.length); }
  const BMUS = tuneOf(THEMES.battle).map(x => x * 0.75), BOSSMUS = tuneOf(THEMES.boss).map(x => x * 0.75), MAPMUS = tuneOf(THEMES.map);
  const PRESENTS = 'RENDERMAN INDEPENDENT SOFTWARE COMPANY ENTERTAINMENT CLAUDE LLC PRESENTS';
  const ENAME = ['GOON', 'SWOLE GOON', 'THE FAT ONE', 'NEO SADDAM'], EHP = [0, 60, 90, 140], EATK = [0, 5, 7, 9], EXP = [0, 50, 90, 0];
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
@left in kq: bool

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
const GTAGS = [${GTAGS.map(c => q(`<color="${c}">`)).join(', ')}]
const GIDX = [${GIDX.join(', ')}]
const ANAME = [${AREAS.map(a => q(a.name)).join(', ')}]
const AN = [${AN.join(', ')}]
const NNAME = [${NODES.map(nd => q(nd[0])).join(', ')}]
const NX = [${NODES.map(nd => nd[1]).join(', ')}]
const NY = [${NODES.map(nd => nd[2]).join(', ')}]
const NF = [${NODES.map(nd => nd[3]).join(', ')}]
const NL = [${NODES.map(nd => nd[4]).join(', ')}]
const GI = [${GI.join(', ')}]
const GX = [${GX.join(', ')}]
const GY = [${GY.join(', ')}]
const II = [${II.join(', ')}]
const IX = [${IX.join(', ')}]
const IY = [${IY.join(', ')}]
const IK = [${IK.join(', ')}]
const NI = [${NI.join(', ')}]
const PX = [${NPC.map(n => n.x).join(', ')}]
const PY = [${NPC.map(n => n.y).join(', ')}]
const PG = [${NPC.map(n => RB['guy' + n.g]).join(', ')}]
const PF = [${NPC.map(n => n.f).join(', ')}]
const PL = [${NPC.map(n => n.l).join(', ')}]
const PGIFT = [${NPC.map(n => n.gift).join(', ')}]
const DLG = [${DLG.map(q).join(', ')}]
const CUT = [${CUTSCENE.map(q).join(', ')}]
const BOSSA = [${AREAS.map(a => a.boss).join(', ')}]
const BX = [${BOSSPOS.map(p => p[0]).join(', ')}]
const BY = [${BOSSPOS.map(p => p[1]).join(', ')}]
const BRB = [${RB.boss0}, ${RB.fat}, ${RB.boss2}]
const BH = [28, 18, 28]
const ENAME = [${ENAME.map(q).join(', ')}]
const EHP = [${EHP.join(', ')}]
const EATK = [${EATK.join(', ')}]
const EXP = [${EXP.join(', ')}]
const P2 = [1, 2, 4, 8, 16, 32, 64, 128, 256]
const MUSA = [${MUSA.join(', ')}]
const MI = [${MI.join(', ')}]
const BOSSMUS = [${BOSSMUS.join(', ')}]
const BMUS = [${BMUS.join(', ')}]
const MAPMUS = [${MAPMUS.join(', ')}]
const MENU = ["FIGHT", "ITEM", "RUN"]
const INAME = [${ITEMS.map(i => q(i[0])).join(', ')}]
const IDESC = [${ITEMS.map(i => q(i[1])).join(', ')}]
const EAT = [${EATSCENE.map(q).join(', ')}]
const EATT = [${EATSCENE_T.join(', ')}]

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
var node: int = 0
var unl: int = 0
var px: float = 20.0
var py: float = 90.0
var opx: float = -1.0
var opy: float = -1.0
var lv: int = 1
var xp: int = 0
var hp: int = 20
var boss: int = 0
var inv: int[]
var ilist: int[]
var icur: int = 0
var gm: int = 0
var im: int = 0
var nm: int = 0
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
var nice: bool = false
var cur: int = 0
var cs: int = 0
var talkN: int = -1
var ecs: int = 0
var invFrom: int = 1
var lastQ: bool = false
var talkL: int = 0
var wipe: int = ${H}
var lastBa: bool = false
var lastUp: bool = false
var lastDn: bool = false
var lastL: bool = false
var lastR: bool = false
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
// scene change: a Zeldoy-style wipe, 20 rows a tick from the top (also spreads the redraw over 8 ticks)
mod wipeAll() {
  wipe = 0
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
mod scream(n: int) {
  mel.resize(0, 0.0)
  melPos = 0
  for k in 0..n {
    mel.push(2.5 + (k % 3) * 0.18)
    mel.push(2.95 - (k % 2) * 0.2)
  }
}
mod flash(t: string) {
  logv = t
  flashUntil = ServerUptime() + 3.5
}
mod have(i: int) -> int {
  return inv.get(i)
}
mod give(i: int, n: int) {
  inv[i] = inv.get(i) + n
}
// the items you have, in list order (rebuilt whenever the list is shown)
mod listItems() {
  ilist.resize(0, 0)
  for i in 0..${ITEMS.length} { if inv.get(i) > 0 { ilist.push(i) } }
  icur = min(icur, max(ilist.length() - 1, 0))
}
mod listText() -> string {
  var t: string = ""
  t = ""
  if ilist.length() == 0 { return "(NOTHING. YOUR POCKETS ECHO.)" }
  for j in 0..ilist.length() {
    let i = ilist.get(j)
    if j == icur { t = t .. "> " } else { t = t .. "  " }
    t = t .. INAME[i] .. " x" .. inv.get(i) .. "   "
  }
  return t
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
    c.SetLeaderboard("dvArea", node + 1)
    c.SetLeaderboard("dvUnc", unl)
    c.SetLeaderboard("dvBoss", boss)
    c.SetLeaderboard("dvInv", min(inv.get(0), 99) + min(inv.get(1), 99) * 100 + min(inv.get(2), 99) * 10000)
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
    node = min(max(t - 1, 0), ${NN - 1})
    t = c.GetLeaderboard("dvUnc")
    unl = min(max(t, 1), ${NN})
    t = c.GetLeaderboard("dvBoss")
    boss = t
    t = c.GetLeaderboard("dvInv")
    inv[0] = t % 100
    inv[1] = (t / 100) % 100
    inv[2] = (t / 10000) % 100
  }
}
mod peekSave() {
  let c = sitter.ControllerOf()
  var t: int = 0
  t = c.GetLeaderboard("dvUnc")
  hasSave = t >= 1
}
mod enterArea(a: int, x: float) {
  area = a
  node = AN[a]
  px = x
  gm = P2[GI[a + 1] - GI[a]] - 1
  im = P2[II[a + 1] - II[a]] - 1
  nm = P2[NI[a + 1] - NI[a]] - 1
  mode = 1
  opx = -1.0
  save()
  wipeAll()
}
mod toMap() {
  mode = 5
  titlev = ""
  musT = 0
  save()
  wipeAll()
}
mod nearMan() -> bool {
  return area == ${BLOCK_AREA} && bit(boss, 3) == false && px >= ${BLX - 30}.0 && py + 16.0 > ${BLY - 6}.0 && py < ${BLY + 22}.0
}
// use item i (inBattle = the battle version); the result goes to logv; ketchup next to the man starts the eating (mode 8)
mod useItem(i: int, inBattle: bool) {
  if i == 0 {
    give(0, -1)
    hp = min(hp + 12, hpMax())
    logv = "A PIEROGI. WARM, DENSE, HEALING. +12 HP."
    tune(1.5, 1.68, 2.0)
  }
  if i == 1 {
    give(1, -1)
    buff = 3
    if inBattle { logv = "YOU LIGHT A CIGARETTE. YOU FEEL DANGEROUS. NEXT 3 HITS x2." } else { logv = "YOU SMOKE. NOTHING TO HIT YET. THE DANGER WAITS IN YOUR CHEST. NEXT 3 HITS x2." }
    tune(1.12, 1.0, 1.5)
  }
  if i == 2 {
    if inBattle { logv = "YOU OFFER KETCHUP. NOBODY HERE IS HUNGRY ENOUGH. YET." } else {
      if nearMan() {
        give(2, -1)
        mode = 8
        ecs = 0
        tNext = ServerUptime() + EATT[0]
      } else { logv = "YOU PUT KETCHUP ON YOURSELF. NOTHING HAPPENS. YOU ARE NOT A HOT DOG." }
    }
  }
  save()
}
// ---- drawing
mod scenSlot() -> int {
  if mode == 5 { return ${MAP_SLOT} }
  if area == 0 && (unl >= 1 || (mode == 4 && cs >= 5)) { return ${TURKEY_RUBBLE} }
  return area
}
mod gapTag(r: int) -> string {
  if mode == 5 { return GTAGS[GIDX[${AREAS.length * H} + r]] }
  return GTAGS[GIDX[area * ${H} + r]]
}
mod renderRow(r: int) {
  is.resize(0, 0.0)
  ie.resize(0, 0.0)
  ic.resize(0, 0.0)
  if r < 2 { span(0.0, ${W}.0, ${CKEYS.indexOf('l')}) }
  if mode == 2 {
    // battle, Mario RPG style: the place's own sky, scenery and ground; each fighter on a shadow platform
    let bi = scenSlot() * ${H} + r
    for t in AI[bi]..AI[bi + 1] { span(AS[t], AE[t], AC[t]) }
    if r >= 104 && r < 108 { spr(${RB.platform}, r - 104, 39.0) }
    if r >= 104 && r < 108 { spr(${RB.platform}, r - 104, 155.0) }
    if r >= 90 && r < 106 { spr(${RB.daniel}, r - 90, 50.0) }
    if eKind == 0 {
      if r >= 86 && r < 106 { spr(${RB.goon}, r - 86, 165.0) }
    } else {
      let bh = BH[eKind - 1]
      if r >= 106 - bh && r < 106 { spr(BRB[eKind - 1], r - 106 + bh, 160.0) }
    }
  } else {
    let sl = scenSlot()
    let ai = sl * ${H} + r
    for t in AI[ai]..AI[ai + 1] { span(AS[t], AE[t], AC[t]) }
    if mode == 5 {
      // the map: places (yellow = open), the tiny car at the current one
      for k in 0..${NN} {
        if r >= NY[k] && r < NY[k] + 4 {
          if k < unl { spr(${RB.node}, r - NY[k], NX[k]) } else { spr(${RB.nodeoff}, r - NY[k], NX[k]) }
        }
      }
      if r >= NY[node] - 8 && r < NY[node] - 1 { spr(${RB.car}, r - NY[node] + 8, NX[node] - 7) }
    } else {
      for k in GI[area]..GI[area + 1] {
        if bit(gm, k - GI[area]) && r >= GY[k] && r < GY[k] + 20 { spr(${RB.goon}, r - GY[k], GX[k]) }
        if bit(gm, k - GI[area]) && r >= GY[k] + 19 && r < GY[k] + 22 { spr(${RB.shadow}, r - GY[k] - 19, GX[k] - 1) }
      }
      for k in II[area]..II[area + 1] {
        if bit(im, k - II[area]) && r >= IY[k] && r < IY[k] + 4 {
          if IK[k] == 0 { spr(${RB.pierogi}, r - IY[k], IX[k]) }
          if IK[k] == 1 && r < IY[k] + 3 { spr(${RB.cigarette}, r - IY[k], IX[k]) }
        }
        if IK[k] == 2 && bit(im, k - II[area]) && r >= IY[k] && r < IY[k] + 7 { spr(${RB.ketchup}, r - IY[k], IX[k]) }
      }
      if area == ${BLOCK_AREA} && bit(boss, 3) == false && r >= ${BLY} && r < ${BLY + 16} { spr(${RB.blocker}, r - ${BLY}, ${BLX}.0) }
      if area == ${BLOCK_AREA} && bit(boss, 3) == false && r >= ${BLY + 15} && r < ${BLY + 18} { spr(${RB.shadow}, r - ${BLY + 15}, ${BLX}.0) }
      for k in NI[area]..NI[area + 1] {
        if r >= PY[k] && r < PY[k] + 16 { spr(PG[k], r - PY[k], PX[k]) }
        if r >= PY[k] + 15 && r < PY[k] + 18 { spr(${RB.shadow}, r - PY[k] - 15, PX[k]) }
      }
      let ba2 = BOSSA[area]
      if ba2 >= 0 {
        if bit(boss, ba2) == false && r >= BY[ba2] && r < BY[ba2] + BH[ba2] { spr(BRB[ba2], r - BY[ba2], BX[ba2]) }
        if bit(boss, ba2) == false && r >= BY[ba2] + BH[ba2] - 1 && r < BY[ba2] + BH[ba2] + 2 { spr(${RB.bshadow}, r - BY[ba2] - BH[ba2] + 1, BX[ba2] - 1) }
      }
      // prologue: goons arrive, smoke clouds, the fat guy by the house
      if mode == 4 && cs >= 2 && cs < 6 {
        if r >= 50 && r < 70 { spr(${RB.goon}, r - 50, 120.0) }
        if r >= 70 && r < 90 { spr(${RB.goon}, r - 70, 150.0) }
        if cs >= 3 && r >= 44 && r < 49 { spr(${RB.smokecloud}, r - 44, 128.0) }
        if cs >= 3 && r >= 64 && r < 69 { spr(${RB.smokecloud}, r - 64, 158.0) }
        if cs >= 4 && r >= 36 && r < 54 { spr(${RB.fat}, r - 36, 40.0) }
      }
      let dy0 = floor(py)
      if (mode == 1 || mode == 6 || mode == 4) && r >= dy0 && r < dy0 + 16 { spr(${RB.daniel}, r - dy0, floor(px)) }
      if (mode == 1 || mode == 6 || mode == 4) && r >= dy0 + 15 && r < dy0 + 18 { spr(${RB.shadow}, r - dy0 - 15, floor(px)) }
    }
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
// ---- battle (Mario RPG style: timed hit on FIGHT, timed block on the enemy's swing)
mod startBattle(kind: int, idx: int) {
  eKind = kind
  eIdx = idx
  if kind == 0 {
    eMax = 8 + node * 5
    eAtk = 2 + node
    eXp = 6 + node * 3
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
  wipeAll()
}
mod endBattle() {
  mode = 1
  px = max(px - 18.0, 0.0)
  opx = -1.0
  wipeAll()
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
    logv = "\${ENAME[eKind]} IS DEFEATED. +\${eXp} XP. THE WAY IS OPEN."
    if eKind == 2 { logv = "THE FAT ONE TRIPS ONE LAST TIME. YOUR HOUSE IS AVENGED. +\${eXp} XP." }
    if eKind == 3 { logv = "NEO SADDAM COLLAPSES INTO A PILE OF MEDALS AND LOTTO TICKETS." }
  }
  tune(1.26, 1.5, 2.0)
  phase = 3
  tNext = ServerUptime() + 2.2
  save()
}
mod resolveHit() {
  var dmg: int = 0
  dmg = 2 + lv + floor(Random(0.0, 3.0))
  if buff > 0 {
    dmg = dmg * 2
    buff -= 1
  }
  if nice { dmg = dmg + dmg / 2 }
  eHP -= dmg
  if nice { logv = "NICE! DANIEL HITS FOR \${dmg}." } else { logv = "DANIEL HITS FOR \${dmg}." }
  aP0 = if nice then 2.2 else 1.8
  aV0 = 0.45
  if eHP <= 0 { winBattle() } else {
    phase = 1
    tNext = ServerUptime() + 0.9
  }
}
mod act(choice: int) {
  if choice == 0 {
    // wind up, then the "!" window: Space in it = a nice hit (x1.5)
    nice = false
    phase = 4
    tNext = ServerUptime() + 0.5
    logv = "DANIEL WINDS UP..."
  }
  if choice == 1 {
    listItems()
    phase = 6
  }
  if choice == 2 {
    if eKind == 0 && Random(0.0, 1.0) < 0.6 {
      flash("YOU LEAVE AT A BRISK, DIGNIFIED JOG.")
      endBattle()
    } else {
      if eKind == 0 { logv = "THE GOON STEPS ON YOUR SHOELACE." } else { logv = "\${ENAME[eKind]} WILL NOT ALLOW THIS." }
      phase = 1
      tNext = ServerUptime() + 1.0
    }
  }
}
mod enemyHit(blocked: bool) {
  var dmg: int = 0
  dmg = eAtk + floor(Random(0.0, eAtk * 0.5 + 1.0))
  if blocked { dmg = dmg / 2 }
  hp -= dmg
  if blocked { logv = "BLOCKED! \${ENAME[eKind]} ONLY DOES \${dmg}." } else { logv = "\${ENAME[eKind]} HITS YOU FOR \${dmg}." }
  aP0 = 0.6
  aV0 = 0.5
  if hp <= 0 {
    hp = 0
    mode = 3
    won = false
    titlev = "DANIEL HAS FALLEN"
    logv = "SPACE: BACK TO YOUR LAST SAVE"
    tune(0.9, 0.75, 0.6)
    wipeAll()
  } else {
    phase = 2
    tNext = ServerUptime() + 0.9
  }
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
  let kQ = kq || (dk == "q" && dkN > 0)
  if dkN > 0 { dkN -= 1 }
  let pS = kS && lastBa == false
  let pU = kU && lastUp == false
  let pD = kD && lastDn == false
  let pL = kL && lastL == false
  let pR = kR && lastR == false
  let pQ = kQ && lastQ == false
  lastQ = kQ
  lastBa = kS
  lastUp = kU
  lastDn = kD
  lastL = kL
  lastR = kR
  if melPos < mel.length() {
    aP0 = max(mel.get(melPos), 0.1)
    aV0 = if mel.get(melPos) > 0.0 then 0.5 else 0.0
    melPos += 1
  } else { aV0 = 0.0 }
  var m: float = 0.0
  m = 0.0
  if mode == 1 || mode == 6 || mode == 7 { m = MUSA[MI[area] + (musT / 3) % (MI[area + 1] - MI[area])] }
  if mode == 2 {
    if eKind == 0 { m = BMUS[(musT / 3) % ${BMUS.length}] } else { m = BOSSMUS[(musT / 3) % ${BOSSMUS.length}] }
  }
  if mode == 5 { m = MAPMUS[(musT / 3) % ${MAPMUS.length}] }
  aP1 = max(m * 0.5, 0.1)
  aV1 = if m > 0.0 then 0.22 else 0.0
  musT += 1
  if mode == 0 {
    // title: the presents card, then continue / new game
    if now < introUntil { titlev = "${PRESENTS}" } else {
      titlev = "DANIEL VS ISIS"
      if hasSave { msgv = "SPACE: CONTINUE      A: NEW GAME" } else { msgv = "SPACE: NEW GAME" }
      if pS && hasSave {
        load()
        titlev = ""
        toMap()
      } else {
        if pS || (pL && hasSave) {
          // new game: the prologue in Turkey
          lv = 1
          xp = 0
          hp = hpMax()
          unl = 0
          boss = 0
          inv.fill(0)
          inv[0] = 1
          area = 0
          node = 0
          px = 20.0
          py = 100.0
          cs = 0
          tNext = now + 4.0
          mode = 4
          titlev = ""
          wipeAll()
        }
      }
    }
  }
  if mode == 4 {
    // the prologue: a line every 4 s or on Space; the fat guy flattens the house at line 6
    msgv = CUT[cs]
    if pS || now >= tNext {
      cs += 1
      tNext = now + 4.0
      if cs == 2 || cs == 3 || cs == 4 || cs == 5 || cs == 6 { wipeAll() }
      if cs == 5 { tune(0.6, 0.5, 0.4) }
      if cs >= ${CUTSCENE.length} {
        unl = 1
        enterArea(0, 20.0)
        py = 100.0
        flash("YOU STAND IN THE RUBBLE. THE NEIGHBOR HAS SOMETHING TO SAY.")
      }
    }
  }
  if mode == 5 {
    // the world map: A/D drive between open places, Space goes in
    if pL && node > 0 {
      node -= 1
      wipeAll()
      tune(1.0, 1.12, 1.0)
    }
    if pR && node < unl - 1 {
      node += 1
      wipeAll()
      tune(1.0, 1.12, 1.0)
    }
    if pS {
      py = 100.0
      enterArea(NF[node], 10.0)
      flash("\${ANAME[area]}")
    }
  }
  if mode == 6 {
    // talking: Space for the next line; the last line may come with a gift
    msgv = DLG[talkL]
    if pS {
      if talkL < PL[talkN] { talkL += 1 } else {
        if PGIFT[talkN] == 1 && bit(nm, talkN - NI[area]) {
          give(0, 1)
          flash("YOU GOT A PIEROGI.")
        }
        if PGIFT[talkN] == 2 && bit(nm, talkN - NI[area]) {
          give(1, 1)
          flash("YOU GOT A CIGARETTE.")
        }
        if PGIFT[talkN] > 0 && bit(nm, talkN - NI[area]) {
          nm = nm - P2[talkN - NI[area]]
          tune(1.5, 1.68, 2.0)
          save()
        }
        mode = 1
        px = max(px - 14.0, 0.0)
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
    if area == ${BLOCK_AREA} && bit(boss, 3) == false {
      px = min(px, ${BLX - 14}.0)
      if px >= ${BLX - 15}.0 && py + 16.0 > ${BLY}.0 && py < ${BLY + 16}.0 {
        if have(2) > 0 { flash("THE MAN: I WILL MOVE FOR NOTHING. (THE KETCHUP IN YOUR ITEMS FEELS HEAVY. Q.)") } else { flash("THE MAN: I WILL MOVE FOR NOTHING. NOTHING EXCEPT, HYPOTHETICALLY, CONDIMENTS.") }
        px = px - 4.0
      }
      if py + 16.0 <= ${BLY}.0 || py >= ${BLY + 16}.0 { px = min(px, ${BLX - 14}.0) }
    }
    // walking off the edges: the next room of this place, or out to the map (the last room opens the next place)
    if px > ${W - 13}.0 {
      if area < NL[node] { enterArea(area + 1, 2.0) } else {
        if node == ${NN - 1} {
          px = ${W - 14}.0
        } else {
          unl = max(unl, node + 2)
          toMap()
        }
      }
    }
    if mode == 1 && px < 0.0 {
      if area > NF[node] { enterArea(area - 1, ${W - 15}.0) } else { toMap() }
    }
    px = min(max(px, 0.0), ${W - 13}.0)
    if mode == 1 && (px != opx || py != opy) {
      markSpan(opy, 18)
      markSpan(py, 18)
      opx = px
      opy = py
    }
    // bumping into things
    if mode == 1 {
      for k in GI[area]..GI[area + 1] {
        if mode == 1 && bit(gm, k - GI[area]) && px + 12.0 > GX[k] && px < GX[k] + 10.0 && py + 16.0 > GY[k] + 5.0 && py < GY[k] + 20.0 { startBattle(0, k - GI[area]) }
      }
    }
    if mode == 1 && ba2 >= 0 {
      if bit(boss, ba2) == false && px + 13.0 >= BX[ba2] - 1.0 && py + 16.0 > BY[ba2] && py < BY[ba2] + BH[ba2] { startBattle(ba2 + 1, 0) }
    }
    if mode == 1 {
      for k in NI[area]..NI[area + 1] {
        if mode == 1 && px + 12.0 > PX[k] && px < PX[k] + 10.0 && py + 16.0 > PY[k] && py < PY[k] + 16.0 {
          mode = 6
          talkN = k
          talkL = PF[k]
        }
      }
    }
    if mode == 1 {
      for k in II[area]..II[area + 1] {
        if bit(im, k - II[area]) && px + 12.0 > IX[k] && px < IX[k] + 8.0 && py + 16.0 > IY[k] && py < IY[k] + 4.0 {
          im = im - P2[k - II[area]]
          markSpan(IY[k], 4)
          if IK[k] == 0 {
            give(0, 1)
            flash("YOU FIND A PIEROGI. IT IS STILL WARM.")
          }
          if IK[k] == 1 {
            give(1, 1)
            flash("YOU FIND A CIGARETTE. ZELDA WOULD APPROVE.")
          }
          if IK[k] == 2 {
            give(2, 1)
            markSpan(IY[k], 7)
            flash("YOU FIND KETCHUP. SOMEWHERE IN ITALY, A MAN SHUDDERS.")
          }
          tune(1.5, 1.68, 2.0)
          save()
        }
      }
    }
  }
  if mode == 8 {
    msgv = EAT[ecs]
    hudv = ""
    if ecs == 2 && melPos == 0 { scream(48) }
    if ecs == 4 && melPos == 0 { scream(60) }
    if now >= tNext {
      ecs += 1
      melPos = 0
      mel.resize(0, 0.0)
      if ecs >= ${EATSCENE.length} {
        boss = boss + 8
        mode = 1
        markSpan(${BLY}.0, 16)
        save()
        flash("THE PATH IS CLEAR.")
      } else { tNext = now + EATT[ecs] }
    }
  }
  if mode == 7 {
    listItems()
    if pU || pL { icur = max(icur - 1, 0) }
    if pD || pR { icur = min(icur + 1, max(ilist.length() - 1, 0)) }
    if ilist.length() > 0 { hudv = "ITEMS   W/S PICK   SPACE USE   Q CLOSE      " .. IDESC[ilist.get(icur)] } else { hudv = "ITEMS   Q CLOSE" }
    msgv = listText()
    if now < flashUntil { msgv = logv }
    if pS && ilist.length() > 0 {
      useItem(ilist.get(icur), false)
      if mode == 7 { flash(logv) }
    }
    if pQ && mode == 7 { mode = invFrom }
  } else {
    if pQ && (mode == 1 || mode == 5) {
      invFrom = mode
      mode = 7
    }
  }
  if mode == 2 {
    if phase == 0 {
      if pU || pL { cur = (cur + 2) % 3 }
      if pD || pR { cur = (cur + 1) % 3 }
      if pS { act(cur) }
    } else {
      if phase == 6 {
        // the item list in battle: W/S pick, Space use (then the enemy's turn), Q back
        listItems()
        if pU || pL { icur = max(icur - 1, 0) }
        if pD || pR { icur = min(icur + 1, max(ilist.length() - 1, 0)) }
        if pQ { phase = 0 }
        if pS {
          if ilist.length() > 0 {
            useItem(ilist.get(icur), true)
            phase = 1
            tNext = now + 1.0
          } else { phase = 0 }
        }
      }
      if phase == 4 {
        // timed hit: the window is the 0.3 s after the wind-up
        if now >= tNext { logv = "! ! !  SPACE NOW !" }
        if pS && now >= tNext && now < tNext + 0.3 { nice = true }
        if nice || now >= tNext + 0.3 { resolveHit() }
      } else {
        if phase == 1 && now >= tNext {
          phase = 5
          tNext = now + 0.35
          logv = "\${ENAME[eKind]} SWINGS!  SPACE TO BLOCK!"
        } else {
          if phase == 5 {
            if pS { enemyHit(true) } else { if now >= tNext { enemyHit(false) } }
          } else {
            if phase == 2 && now >= tNext { phase = 0 }
            if phase == 3 && now >= tNext {
              if eKind == 3 {
                won = true
                mode = 3
                titlev = "THE BRONX IS SAFE. YOU OPEN A CBD STORE ON THE GRAND CONCOURSE."
                logv = "THE END. RENDERMAN INDEPENDENT SOFTWARE COMPANY ENTERTAINMENT CLAUDE LLC THANKS YOU."
                wipeAll()
              } else {
                flash(logv)
                endBattle()
              }
            }
          }
        }
      }
    }
  }
  if mode == 3 && pS {
    if won {
      titlev = ""
      toMap()
    } else {
      load()
      hp = hpMax()
      titlev = ""
      toMap()
      flash("YOU WAKE UP AT YOUR LAST SAVE, SMELLING OF PIEROGI.")
    }
  }
  // text lines
  if mode == 2 {
    hudv = "DANIEL LV\${lv} HP \${hp}/\${hpMax()}     \${ENAME[eKind]} HP \${max(eHP, 0)}/\${eMax}"
    if phase == 0 {
      msgv = ""
      for k in 0..3 {
        if k == cur { msgv = msgv .. "> " .. MENU[k] .. "     " } else { msgv = msgv .. "  " .. MENU[k] .. "     " }
      }
    } else {
      if phase == 6 { msgv = listText() .. "   (Q BACK)" } else { msgv = logv }
    }
  }
  if mode == 1 {
    hudv = "\${ANAME[area]}   LV\${lv} HP \${hp}/\${hpMax()} XP \${xp}/\${lv * 12}   ITEMS: Q"
    if now < flashUntil { msgv = logv } else { msgv = "WASD walk  Q inventory  bump a guy to talk, a goon to fight  walk off the edge for the map" }
  }
  if mode == 6 { hudv = "\${ANAME[area]}   SPACE: NEXT" }
  if mode == 5 {
    hudv = "WORLD MAP   LV\${lv} HP \${hp}/\${hpMax()}   ITEMS: Q"
    if now < flashUntil { msgv = logv } else { msgv = "A/D DRIVE THE TINY CAR   Q INVENTORY   SPACE: GO TO \${NNAME[node]}" }
  }
  if mode == 4 { hudv = "SPACE: NEXT" }
  if mode == 3 {
    hudv = "LV\${lv}"
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
  // the wipe: 20 more rows a tick until the whole screen is redrawn
  if wipe < ${H} {
    for k in 0..20 { mark(wipe + k) }
    wipe += 20
  }
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
on ChatCommand("dvkey", "debug: hold w a s d space for 3 ticks") -> (ctrl, args) {
  dk = args
  dkN = 3
}
on ChatCommand("dvstate", "debug: print the game state") -> (ctrl, args) {
  PrintToConsole("dvstate|mode \${mode}|area \${area}|node \${node}|unl \${unl}|cs \${cs}|x \${px}|y \${py}|lv \${lv}|xp \${xp}|hp \${hp}|boss \${boss}|inv \${inv.get(0)} \${inv.get(1)} \${inv.get(2)}|gm \${gm}|phase \${phase}|e \${eHP}")
}
on ChatCommand("dvgoto", "debug: unlock all and go to the map") -> (ctrl, args) {
  unl = ${NN}
  toMap()
}
` : ''}on tick {
  if seated || forced {
    if was == false {
      was = true
      rows.resize(${H}, "")
      dfl.resize(${H}, 0)
      sdf.resize(${NS}, 0)
      inv.resize(${ITEMS.length}, 0)
      mode = 0
      area = 0
      unl = 0
      hasSave = false
      if seated { peekSave() }
      introUntil = ServerUptime() + 3.5
      lastT = ServerUptime()
      wipeAll()
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
