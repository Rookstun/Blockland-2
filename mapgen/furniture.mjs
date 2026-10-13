// Furniture by template pools (owner 2026-10-13: "make furniture better", "make
// template pools"). Three layers, like Minecraft's jigsaw pools:
//   PIECES    one piece of furniture in micro bricks, built in its own frame:
//             a along the wall [0, w), b out from the wall [0, d), z up from the
//             floor top (studs for a/b, 0.2 steps; units for z, even)
//   TEMPLATES a room layout: slots { piece, at: back|left|right|front|side|any (a wall)|center, opt }
//   POOLS     per room role, weighted templates; furnishRoom picks one by seed
// A slot is tried along its wall from the middle out; a required slot that finds no
// room drops the whole template and the next one in the pool is tried (opt slots
// are just skipped). Tall pieces never stand in front of a window.

const GLOW = (color, i = 5) => ({ color, material: 'BMC_Glow', material_intensity: i });
const METAL = color => ({ color, material: 'BMC_Metallic' });
const BOOKS = [[120, 40, 36], [44, 70, 120], [60, 100, 56], [150, 120, 60], [96, 60, 110], [180, 170, 150], [70, 52, 40]];

// pal: wood, dark, cloth, linen, stone, rug (picked per house)
export const PIECES = {
  bed: { w: 3, d: 5, build(e, p) {
    e(0, 0, 0, 3, 5, 8, p.wood);                                    // frame
    e(0, 0, 8, 3, 0.4, 32, p.dark);                                 // headboard on the wall
    e(0, 4.6, 8, 0.4, 5, 20, p.dark); e(2.6, 4.6, 8, 3, 5, 20, p.dark); // foot posts
    e(0.4, 4.6, 8, 2.6, 5, 14, p.wood);                             // footboard
    e(0, 0.4, 8, 3, 4.6, 12, p.linen);                              // mattress
    e(0.4, 0.6, 12, 2.6, 1.4, 16, p.linen);                         // pillow
    e(0, 1.6, 12, 3, 2, 16, p.linen);                               // turned-down sheet
    e(0, 2, 12, 3, 4.6, 14, p.cloth);                               // blanket
  } },
  bedDouble: { w: 4, d: 5, build(e, p) {
    e(0, 0, 0, 4, 5, 8, p.wood);
    e(0, 0, 8, 4, 0.4, 36, p.dark);
    e(0, 4.6, 8, 0.4, 5, 20, p.dark); e(3.6, 4.6, 8, 4, 5, 20, p.dark);
    e(0.4, 4.6, 8, 3.6, 5, 14, p.wood);
    e(0, 0.4, 8, 4, 4.6, 12, p.linen);
    e(0.4, 0.6, 12, 1.8, 1.4, 16, p.linen); e(2.2, 0.6, 12, 3.6, 1.4, 16, p.linen);
    e(0, 1.6, 12, 4, 2, 16, p.linen);
    e(0, 2, 12, 4, 4.6, 14, p.cloth);
  } },
  nightstand: { w: 1, d: 1, build(e, p) {
    e(0, 0, 0, 1, 1, 14, p.wood); e(0, 0, 14, 1, 1, 16, p.dark);
    e(0.4, 0.4, 16, 0.6, 0.6, 22, GLOW([255, 200, 120], 4));        // candle
  } },
  wardrobe: { w: 3, d: 1.4, tall: true, build(e, p) {
    e(0, 0, 0, 3, 1.2, 56, p.wood);
    e(0.2, 1.2, 4, 1.4, 1.4, 52, p.dark); e(1.6, 1.2, 4, 2.8, 1.4, 52, p.dark); // doors
    e(1.4, 1.2, 4, 1.6, 1.4, 52, p.wood);
    e(0, 0, 56, 3, 1.4, 60, p.dark);                                // cornice
  } },
  bookcase: { w: 3, d: 1, tall: true, build(e, p, r) {
    e(0, 0, 0, 3, 0.4, 58, p.dark);                                 // back
    e(0, 0.4, 0, 0.2, 1, 58, p.wood); e(2.8, 0.4, 0, 3, 1, 58, p.wood);
    for (const z of [0, 18, 36]) {
      e(0.2, 0.4, z, 2.8, 1, z + 2, p.wood);
      let a = 0.2, k = 0;
      while (a + 0.2 <= 2.8 - 0.2) {
        const bw = r(z, k, 1) < 0.3 ? 0.4 : 0.2, h = 10 + 2 * Math.floor(r(z, k, 2) * 3);
        if (r(z, k, 3) > 0.12) e(a, 0.4, z + 2, a + bw, 0.8 + (r(z, k, 4) < 0.5 ? 0 : 0.2), z + 2 + h, { color: BOOKS[Math.floor(r(z, k, 5) * BOOKS.length)] });
        a += bw; k++;
      }
    }
    e(0.2, 0.4, 54, 2.8, 1, 58, p.wood);                            // top
  } },
  desk: { w: 3, d: 1.6, build() {} },   // body below
  counter: { w: 4, d: 1.4, build() {} }, // body below
  fireplace: { w: 4, d: 1.6, tall: true, build(e, p) {
    e(0, 0, 0, 1, 1.4, 44, p.stone); e(3, 0, 0, 4, 1.4, 44, p.stone);
    e(1, 0, 0, 3, 0.4, 44, p.dark);                                 // fire back
    e(1, 0.4, 0, 3, 1.4, 2, p.dark);                                // hearth
    e(1.2, 0.6, 2, 2.8, 1, 4, { color: [80, 56, 36] });             // logs
    e(1.4, 0.6, 4, 2.6, 1, 14, GLOW([255, 130, 40], 8));            // flames
    e(1, 0.4, 36, 3, 1.4, 44, p.stone);                             // lintel
    e(0, 0, 44, 4, 1.6, 48, p.wood);                                // mantel
    e(0.6, 0, 48, 3.4, 1, 108, p.stone);                            // chimney breast
    e(0.4, 1, 48, 0.8, 1.4, 54, METAL([200, 160, 70])); e(3.2, 1, 48, 3.6, 1.4, 54, METAL([200, 160, 70])); // candlesticks
  } },
  chest: { w: 2, d: 1, build(e, p) {
    e(0, 0, 0, 2, 0.8, 10, p.wood); e(0, 0.8, 0, 0.8, 1, 10, p.wood); e(1.2, 0.8, 0, 2, 1, 10, p.wood); e(0.8, 0.8, 0, 1.2, 1, 6, p.wood);
    e(0.8, 0.8, 6, 1.2, 1, 10, METAL([200, 160, 70]));              // lock
    e(0, 0, 10, 2, 1, 12, METAL([70, 66, 62])); e(0, 0, 12, 2, 1, 16, p.wood);
  } },
  barrels: { w: 2, d: 1, build(e, p) {
    for (const a of [0, 1]) { e(a, 0, 0, a + 1, 1, 6, p.wood); e(a, 0, 6, a + 1, 1, 8, METAL([70, 66, 62])); e(a, 0, 8, a + 1, 1, 18, p.wood); e(a, 0, 18, a + 1, 1, 20, METAL([70, 66, 62])); }
  } },
  crates: { w: 2, d: 2, build(e, p) {
    e(0, 0, 0, 2, 2, 20, { color: [150, 110, 70] }); e(0.2, 0.2, 20, 1.2, 1.2, 30, { color: [160, 122, 80] });
  } },
  shelf: { w: 3, d: 1, build(e, p) {                                  // low shelf with crocks
    e(0, 0, 0, 3, 1, 2, p.dark); e(0, 0, 2, 0.2, 1, 30, p.wood); e(2.8, 0, 2, 3, 1, 30, p.wood);
    e(0.2, 0, 14, 2.8, 1, 16, p.wood); e(0.2, 0, 28, 2.8, 1, 30, p.wood);
    e(0.4, 0.2, 2, 1, 0.8, 10, { color: [150, 80, 50] }); e(1.4, 0.2, 2, 2, 0.8, 8, { color: [190, 170, 130] });
    e(0.4, 0.2, 16, 1.2, 0.8, 22, METAL([110, 108, 104])); e(1.8, 0.2, 16, 2.6, 0.8, 24, { color: [120, 60, 50] });
  } },
  workbench: { w: 4, d: 1.6, build(e, p) {
    e(0, 0, 0, 0.6, 1.6, 26, p.wood); e(3.4, 0, 0, 4, 1.6, 26, p.wood);
    e(0.6, 0, 6, 3.4, 1.6, 8, p.wood);                              // shelf
    e(0, 0, 26, 4, 1.6, 30, p.dark);
    e(0.4, 0.4, 30, 1.6, 0.8, 32, METAL([140, 140, 146]));          // saw
    e(2.4, 0.4, 30, 2.8, 1.2, 36, METAL([90, 90, 96]));             // vice
    e(1, 0, 30, 3, 0.2, 52, p.dark);                                // tool board
  } },
  diningSet: { w: 4, d: 5, build(e, p) {                             // table 2 x 3 + 4 chairs, free standing
    e(1, 1, 0, 1.4, 1.4, 24, p.dark); e(2.6, 1, 0, 3, 1.4, 24, p.dark); e(1, 3.6, 0, 1.4, 4, 24, p.dark); e(2.6, 3.6, 0, 3, 4, 24, p.dark);
    e(1, 1, 24, 3, 4, 28, p.wood);
    e(1.6, 2, 28, 2.4, 2.8, 36, { color: [160, 90, 60] });          // jug
    e(1.4, 3.2, 28, 1.8, 3.6, 34, GLOW([255, 200, 120], 4));        // candle
    for (const [a, b, back] of [[0, 1.6, 'w'], [0, 2.8, 'w'], [3.2, 1.6, 'e'], [3.2, 2.8, 'e']]) {
      e(a + 0.2, b + 0.2, 0, a + 0.6, b + 0.6, 14, p.wood); e(a, b, 14, a + 0.8, b + 0.8, 16, p.wood);
      if (back === 'w') e(a, b, 16, a + 0.2, b + 0.8, 34, p.dark); else e(a + 0.6, b, 16, a + 0.8, b + 0.8, 34, p.dark);
    }
  } },
  longTable: { w: 3, d: 6, build(e, p) {                             // trestle table + benches
    e(1, 0.4, 0, 2, 1, 22, p.dark); e(1, 5, 0, 2, 5.6, 22, p.dark);
    e(1, 0, 22, 2, 6, 26, p.wood);
    e(0, 0.6, 0, 0.6, 5.4, 14, p.wood); e(2.4, 0.6, 0, 3, 5.4, 14, p.wood);
    e(1.2, 1, 26, 1.8, 1.6, 30, METAL([110, 108, 104])); e(1.2, 3, 26, 1.8, 3.6, 34, { color: [160, 90, 60] });
  } },
  armchair: { w: 2, d: 2, build(e, p) {
    e(0, 0, 0, 2, 2, 12, p.cloth); e(0, 0, 12, 2, 0.6, 36, p.cloth); // seat, back on the wall side
    e(0, 0.6, 12, 0.4, 2, 22, p.cloth); e(1.6, 0.6, 12, 2, 2, 22, p.cloth);
    e(0.4, 0.6, 12, 1.6, 2, 14, p.linen);                           // cushion
  } },
};

PIECES.desk.build = (e, p) => {
  e(0, 0, 0, 0.4, 1.4, 24, p.wood); e(2.6, 0, 0, 3, 1.4, 24, p.wood);
  e(0.4, 0, 16, 2.6, 0.4, 24, p.wood);
  e(0, 0, 24, 3, 1.6, 26, p.dark);
  e(0.4, 0.2, 26, 1.2, 0.8, 28, { color: [236, 230, 210] });
  e(2.2, 0.2, 26, 2.4, 0.4, 32, GLOW([255, 200, 120], 4));
};
PIECES.counter.build = (e, p) => {
  e(0, 0, 0, 4, 1.2, 26, p.wood);
  e(0.2, 1.2, 2, 1.8, 1.4, 22, p.dark); e(2.2, 1.2, 2, 3.8, 1.4, 22, p.dark);
  e(0, 0, 26, 4, 1.4, 30, p.stone);
  e(0.4, 0.3, 30, 1.2, 1.1, 38, METAL([90, 88, 86]));
  e(1.6, 0.4, 30, 2.2, 1, 34, { color: [196, 160, 110] });
  e(2.8, 0.3, 30, 3.4, 0.9, 40, { color: [160, 90, 60] });
};

const S = (piece, at, opt = false) => ({ piece, at, opt });
export const TEMPLATES = {
  hearthRoom:  [S('fireplace', 'side'), S('diningSet', 'center'), S('armchair', 'any', true), S('barrels', 'any', true), S('shelf', 'any', true), S('chest', 'any', true)],
  kitchen:     [S('counter', 'back'), S('fireplace', 'side', true), S('diningSet', 'center'), S('shelf', 'any', true), S('barrels', 'any', true), S('crates', 'any', true), S('counter', 'any', true)],
  parlour:     [S('fireplace', 'side'), S('armchair', 'any'), S('armchair', 'any', true), S('bookcase', 'any', true), S('chest', 'any', true), S('bookcase', 'any', true)],
  study:       [S('bookcase', 'back'), S('desk', 'any'), S('bookcase', 'any', true), S('bookcase', 'any', true), S('armchair', 'any', true), S('chest', 'any', true)],
  pantry:      [S('shelf', 'back'), S('barrels', 'any'), S('crates', 'any', true), S('shelf', 'any', true), S('barrels', 'any', true), S('crates', 'any', true), S('counter', 'any', true)],
  workshop:    [S('workbench', 'back'), S('crates', 'any'), S('barrels', 'any', true), S('shelf', 'any', true), S('workbench', 'any', true), S('crates', 'any', true)],
  bedroom:     [S('bed', 'back'), S('nightstand', 'back'), S('wardrobe', 'any', true), S('chest', 'any', true), S('desk', 'any', true), S('shelf', 'any', true)],
  master:      [S('bedDouble', 'back'), S('nightstand', 'back'), S('nightstand', 'back', true), S('wardrobe', 'any', true), S('armchair', 'any', true), S('chest', 'any', true), S('bookcase', 'any', true)],
  twinRoom:    [S('bed', 'back'), S('bed', 'back'), S('nightstand', 'back', true), S('chest', 'any', true), S('chest', 'any', true), S('wardrobe', 'any', true)],
  guestRoom:   [S('bed', 'side'), S('desk', 'back', true), S('chest', 'any', true), S('armchair', 'any', true), S('shelf', 'any', true)],
  dining:      [S('longTable', 'center'), S('shelf', 'any', true), S('barrels', 'any', true), S('counter', 'any', true), S('fireplace', 'side', true)],
};
// weights; every pool ends in a small fallback so a cramped room still gets something
export const POOLS = {
  front:   [[3, 'hearthRoom'], [3, 'kitchen'], [2, 'parlour'], [1, 'dining']],
  stair:   [[3, 'study'], [3, 'pantry'], [1, 'workshop']],
  bedroom: [[3, 'bedroom'], [2, 'master'], [2, 'twinRoom'], [1, 'guestRoom']],
  wing:    [[2, 'dining'], [2, 'workshop'], [2, 'kitchen'], [1, 'pantry']],
  cottage: [[3, 'bedroom'], [2, 'guestRoom'], [1, 'study']],
};
const FALLBACK = [S('chest', 'any', true), S('barrels', 'any', true)];

/**
 * room: { x0, x1, y0, y1 (studs, interior), doorWalls?: [] }
 * ctx:  { fits(cells) -> bool (cells free for any piece), tallOk(cells) -> bool (no window behind),
 *         free(lo, hi) -> bool, emit(brick), zf (floor top), take(cells), rnd(a, b) }
 * Returns the template name it used (or 'fallback').
 */
export function furnishRoom(pool, room, ctx, pal) {
  const entries = POOLS[pool];
  const total = entries.reduce((s, [w]) => s + w, 0);
  // weighted order: the seed's pick first, then the rest by weight
  let t = ctx.rnd(1) * total, first = entries.length - 1;
  for (let i = 0; i < entries.length; i++) { t -= entries[i][0]; if (t < 0) { first = i; break; } }
  const order = [entries[first][1], ...entries.filter((_, i) => i !== first).sort((a, b) => b[0] - a[0]).map(e => e[1])];
  for (const name of order) if (tryTemplate(TEMPLATES[name], room, ctx, pal)) return name;
  tryTemplate(FALLBACK, room, ctx, pal);
  return 'fallback';
}

const WALLS = ['back', 'left', 'right', 'front'];
function tryTemplate(slots, room, ctx, pal) {
  const plan = [], taken = new Set();
  for (const [k, slot] of slots.entries()) {
    const spot = findSpot(PIECES[slot.piece], slot.at, room, ctx, taken, k, pal);
    if (!spot) { if (slot.opt) continue; return false; }
    for (const c of spot.cells) taken.add(c);
    plan.push(spot);
  }
  for (const spot of plan) { for (const b of spot.bricks) ctx.emit(b); ctx.take(spot.cells); }
  return plan.length > 0;
}

// every placement of a piece for slot `at`, middle of each wall first
function* spots(piece, at, room, rot = 0) {
  const { x0, x1, y0, y1 } = room, W = x1 - x0, D = y1 - y0;
  const walls = at === 'any' ? WALLS.map((_, i) => WALLS[(i + rot) % 4]) : at === 'side' ? ['left', 'right'] : at === 'center' ? [] : [at];
  if (at === 'center') {
    const cx = (x0 + x1 - piece.w) / 2, cy = (y0 + y1 - piece.d) / 2;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]])
      yield { wall: 'center', ox: Math.round(cx + dx), oy: Math.round(cy + dy) };
    return;
  }
  for (const wall of walls) {
    const len = wall === 'back' || wall === 'front' ? W : D;
    const mid = Math.floor((len - piece.w) / 2);
    for (let k = 0; k <= len; k++) {
      const off = mid + (k % 2 ? (k + 1) / 2 : -k / 2);
      if (off < 0 || off + piece.w > len) continue;
      yield { wall, off };
    }
  }
}

function findSpot(piece, at, room, ctx, taken, salt, pal) {
  for (const s of spots(piece, at, room, Math.floor(ctx.rnd(salt + 50) * 4))) {
    const bricks = [], cells = [];
    // local (a, b) -> world studs for this wall
    const T = (a, b) => {
      const { x0, x1, y0, y1 } = room;
      switch (s.wall) {
        case 'back': return [x0 + s.off + a, y1 - b];
        case 'front': return [x1 - s.off - a, y0 + b];
        case 'left': return [x0 + b, y0 + s.off + a];
        case 'right': return [x1 - b, y1 - s.off - a];
        default: return [s.ox + a, s.oy + b];
      }
    };
    const box = (a0, b0, a1, b1) => { const p = T(a0, b0), q = T(a1, b1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
    const [fx0, fy0, fx1, fy1] = box(0, 0, piece.w, piece.d);
    for (let x = Math.floor(fx0 + 1e-6); x < Math.ceil(fx1 - 1e-6); x++) for (let y = Math.floor(fy0 + 1e-6); y < Math.ceil(fy1 - 1e-6); y++) cells.push(x + ',' + y);
    if (cells.some(c => taken.has(c)) || !ctx.fits(cells) || (piece.tall && !ctx.tallOk(cells))) continue;
    if (!ctx.free([fx0 * 10, fy0 * 10, ctx.zf], [fx1 * 10, fy1 * 10, ctx.zf + 60])) continue;
    const r = (a, b, c) => ctx.rnd(salt * 1000 + a * 7 + b * 131 + c * 17 + 3);
    piece.build((a0, b0, z0, a1, b1, z1, m) => {
      const [bx0, by0, bx1, by1] = box(a0, b0, a1, b1);
      const mm = Array.isArray(m) ? { color: m } : m;
      const q = v => Math.round(v * 100) / 100;
      bricks.push({ asset: 'PB_DefaultMicroBrick', ...mm, size: [q((bx1 - bx0) * 5), q((by1 - by0) * 5), (z1 - z0) / 2], position: [q((bx0 + bx1) * 5), q((by0 + by1) * 5), ctx.zf + (z0 + z1) / 2] });
    }, pal, r);
    return { bricks, cells };
  }
  return null;
}
