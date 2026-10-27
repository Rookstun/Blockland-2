// Yards (2026-10-26, owner: "yard subsystem"): what stands in a city house's yard, by income.
// Poorer lots get a shed, a doghouse, a vegetable bed, an above-ground pool; middle ones a patio + grill,
// trampoline, swing set; rich ones an in-ground pool on a concrete deck, patio, flower beds, front trees.
// Every lot gets a mailbox by the sidewalk. Items are axis-aligned boxes placed in the free yard: inside the
// lot 40 off its edges (clear of the lot-line barriers), 30 off the house frame, 20 apart. Back items go
// as far from the street as they fit, front items as near. An item's first piece is its full footprint at
// the ground, so a clash drops the whole item.
//   yard(B, { lot, house, income, rnd }) -> { name: count }
const M = (color, extra) => ({ asset: 'PB_DefaultBrick', color, ...extra });
const T = (color, extra) => ({ asset: 'PB_DefaultTile', color, ...extra });
const WATER = { asset: 'PB_DefaultTile', color: [64, 150, 210], material: 'BMC_Glass' };
const CONCRETE = [176, 174, 168], DARK = [52, 52, 56], WOOD = [128, 90, 56], SOIL = [84, 60, 40];
const LEAF = [[46, 86, 38], [58, 98, 42], [40, 74, 34]];

// each item: footprint w x d (units, x along the street, y away from it) and pieces in item-local
// coordinates [x0, y0, z0, x1, y1, z1, material] with y = 0 the street side
const ITEMS = {
  mailbox: { w: 20, d: 20, front: true, pieces: () => [[0, 0, 0, 20, 20, 4, T(CONCRETE)], [5, 5, 4, 15, 15, 36, M(WOOD)], [0, 0, 36, 20, 20, 48, M([40, 60, 120])], [20, 10, 40, 22, 14, 52, { color: [200, 40, 40] }]] },
  fronttree: { w: 60, d: 60, front: true, pieces: (c) => [[20, 20, 0, 40, 40, 48, M([92, 64, 40])], [0, 0, 48, 60, 60, 96, M(LEAF[c % 3])], [10, 10, 96, 50, 50, 112, M(LEAF[(c + 1) % 3])]] },
  shed: { w: 80, d: 60, pieces: () => [[0, 0, 0, 80, 60, 4, T(CONCRETE)], [0, 0, 4, 80, 60, 64, M([150, 130, 100])], [30, -2, 4, 50, 0, 52, { color: [90, 60, 40] }], [-10, -10, 64, 90, 70, 68, T(DARK)]] },
  doghouse: { w: 30, d: 40, pieces: () => [[0, 0, 0, 30, 40, 24, M([170, 50, 40])], [10, -2, 0, 20, 0, 16, { color: [20, 20, 20] }], [-4, -4, 24, 34, 44, 28, T(DARK)]] },
  vegbed: { w: 100, d: 40, pieces: (c) => { const p = [[0, 0, 0, 100, 40, 8, M(WOOD)], [10, 10, 8, 90, 30, 10, { color: SOIL }]]; for (let x = 15; x < 85; x += 20) p.push([x, 15, 10, x + 10, 25, 22, M(LEAF[(c + x / 20) % 3 | 0])]); return p; } },
  flowerbed: { w: 100, d: 30, pieces: (c) => { const p = [[0, 0, 0, 100, 30, 8, M([120, 110, 100])], [10, 10, 8, 90, 20, 10, { color: SOIL }]]; const pal = [[220, 60, 90], [240, 200, 60], [150, 90, 200], [250, 250, 250]]; for (let x = 15; x < 85; x += 20) p.push([x, 10, 10, x + 10, 20, 18, M(pal[(c + x / 20) % 4 | 0])]); return p; } },
  agpool: { w: 120, d: 120, pieces: () => [[0, 0, 0, 120, 120, 4, T(CONCRETE)], [0, 0, 4, 120, 10, 36, M([90, 140, 200])], [0, 110, 4, 120, 120, 36, M([90, 140, 200])], [0, 10, 4, 10, 110, 36, M([90, 140, 200])], [110, 10, 4, 120, 110, 36, M([90, 140, 200])], [10, 10, 4, 110, 110, 32, WATER], [50, -20, 0, 70, 0, 4, T(CONCRETE)], [50, -20, 4, 70, -10, 20, M(WOOD)], [50, -10, 4, 70, 0, 36, M(WOOD)]] },
  pool: { w: 220, d: 160, pieces: () => [[0, 0, 0, 220, 160, 4, T(CONCRETE)], [20, 20, 4, 200, 140, 6, WATER], [10, 20, 4, 20, 140, 8, T([230, 228, 220])], [200, 20, 4, 210, 140, 8, T([230, 228, 220])], [20, 10, 4, 200, 20, 8, T([230, 228, 220])], [20, 140, 4, 200, 150, 8, T([230, 228, 220])], [190, 40, 8, 200, 50, 40, { asset: 'PB_DefaultPole', color: [200, 200, 205], material: 'BMC_Metallic' }]] },
  patio: { w: 120, d: 100, pieces: () => [[0, 0, 0, 120, 100, 4, T([150, 140, 130])], // pavers, grill, table + 2 stools
    [10, 10, 4, 20, 20, 28, M(DARK)], [30, 10, 4, 40, 20, 28, M(DARK)], [0, 0, 28, 50, 30, 40, M([30, 30, 32], { material: 'BMC_Metallic' })],
    [70, 40, 4, 80, 50, 28, M(WOOD)], [60, 30, 28, 100, 70, 32, T(WOOD)], [60, 80, 4, 70, 90, 16, M(WOOD)], [90, 80, 4, 100, 90, 16, M(WOOD)]] },
  trampoline: { w: 120, d: 120, pieces: () => [[0, 0, 0, 10, 10, 24, M(DARK)], [110, 0, 0, 120, 10, 24, M(DARK)], [0, 110, 0, 10, 120, 24, M(DARK)], [110, 110, 0, 120, 120, 24, M(DARK)],
    [0, 0, 24, 120, 120, 28, T([40, 90, 200])], [10, 10, 28, 110, 110, 30, { color: [20, 20, 22] }]] },
  swings: { w: 140, d: 40, pieces: () => [[0, 0, 0, 10, 40, 72, M([200, 60, 50])], [130, 0, 0, 140, 40, 72, M([200, 60, 50])], [10, 15, 64, 130, 25, 72, M([200, 60, 50])],
    [35, 15, 20, 45, 25, 24, T(DARK)], [95, 15, 20, 105, 25, 24, T(DARK)], [39, 19, 24, 41, 21, 64, { color: [150, 150, 150] }], [99, 19, 24, 101, 21, 64, { color: [150, 150, 150] }]] },
};
const TIERS = [ // [income below, item list in priority order]
  [0.35, ['mailbox', 'shed', 'vegbed', 'doghouse', 'agpool']],
  [0.65, ['mailbox', 'patio', 'trampoline', 'swings', 'vegbed', 'flowerbed', 'shed']],
  [2, ['mailbox', 'pool', 'patio', 'flowerbed', 'fronttree', 'fronttree', 'flowerbed']],
];

export function yard(B, { lot, house, income, rnd }) {
  const list = TIERS.find(([lim]) => income < lim)[1].filter(n => n === 'mailbox' || rnd() < 0.8);
  const fw = (house.W + 1) * 10, fd = (house.D + 1) * 10;
  const hx0 = house.centre[0] - fw / 2 - 30, hx1 = house.centre[0] + fw / 2 + 30, hy0 = house.centre[1] - fd / 2 - 30, hy1 = house.centre[1] + fd / 2 + 30;
  const S = lot.side === 'S'; // south lots face the street at y0 (local y = world y - y0), north ones at y1 (mirrored)
  const taken = [], got = {};
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  for (const [k, name] of list.entries()) {
    const it = ITEMS[name];
    // candidate spots on a 20-unit grid, sorted: front items nearest the street, back ones farthest
    const spots = [];
    for (let x = lot.x0 + 40; x + it.w <= lot.x1 - 40; x += 20)
      for (let y = lot.y0 + 40; y + it.d <= lot.y1 - 40; y += 20) {
        const r = [x, y, x + it.w, y + it.d];
        if (hit(r, [hx0, hy0, hx1, hy1]) || taken.some(t => hit(r, t))) continue;
        const fromStreet = S ? y - lot.y0 : lot.y1 - (y + it.d);
        spots.push({ x, y, key: (it.front ? fromStreet : -fromStreet) * 1000 + Math.abs(x + it.w / 2 - house.centre[0]) * (it.front ? -1 : 1) + rnd() * 50 });
      }
    spots.sort((a, b) => a.key - b.key);
    for (const { x, y } of spots.slice(0, 6)) { // a few tries: the first piece may meet a driveway or porch
      // item-local (u, v), v = 0 at the street side: south lots v -> +y, north lots v -> -y
      const W = ([u0, v0, z0, u1, v1, z1, m]) => S ? [x + u0, y + v0, z0, x + u1, y + v1, z1, m] : [x + u0, y + it.d - v1, z0, x + u1, y + it.d - v0, z1, m];
      const [first, ...rest] = it.pieces(k + x / 20 | 0).map(W);
      if (!B.box(...first, 'yard ' + name)) continue;
      for (const p of rest) B.box(...p, 'yard ' + name);
      taken.push([x - 20, y - 20, x + it.w + 20, y + it.d + 20]);
      got[name] = (got[name] ?? 0) + 1;
      break;
    }
  }
  return got;
}
