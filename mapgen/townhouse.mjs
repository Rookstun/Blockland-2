// Medieval townhouse in microbricks (Mauve 2026-11-07: "high fidelity medieval townhouse with interior and exterior
// detail"). Original design: stone ground floor, jettied half-timbered upper storey, steep slate roof, gable chimney.
// Inside: hearth, table and benches, barrels, dresser, a straight stair with 3-stud landings both ends (floor under
// every tread, no window on the stair wall); upstairs a bed, chest, desk under the window, wardrobe, rail round the
// stairwell. Door faces +y. node mapgen/townhouse.mjs X Y Z > job.json   (Z = ground)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000070e5', name: 'Claude Townhouse', display_name: 'Claude Townhouse' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 100 });
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const STONE = m([128, 122, 112]), STONE2 = m([108, 103, 95]), PLASTER = m([232, 222, 196]), TIMBER = m([66, 44, 30]);
const PLANK = m([124, 86, 52]), PLANK2 = m([104, 70, 42]), SLATE = m([78, 82, 94]), SLATE2 = m([66, 70, 82]);
const GLASS = m([150, 190, 200], { material: 'BMC_Glass' }), IRON = m([40, 40, 44], { material: 'BMC_Metallic' });
const GLOW = m([255, 170, 70], { material: 'BMC_Glow', material_intensity: 3 }), RED = m([150, 40, 40]), WHITE = m([235, 232, 225]);
const box = (x0, y0, z0, x1, y1, z1, mt, l = '') => B.box(x0, y0, z0, x1, y1, z1, mt, l);
// a wall slab with rectangular holes, split into hole-free pieces. axis 'x': runs along x (fixed y0..y1), holes [a, b, z0, z1] in x
function wall(axis, t0, t1, a0, a1, z0, z1, holes, mt, l) {
  const cuts = [...new Set([a0, a1, ...holes.flatMap(h => [h[0], h[1]])])].filter(c => c >= a0 && c <= a1).sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1], hs = holes.filter(h => h[0] <= a && h[1] >= b).sort((p, q) => p[2] - q[2]);
    let z = z0;
    for (const h of [...hs, [0, 0, z1, z1]]) { if (h[2] > z) axis === 'x' ? box(a, t0, z, b, t1, h[2], mt, l) : box(t0, a, z, t1, b, h[2], mt, l); z = Math.max(z, h[3]); }
  }
}
// ---- foundation and ground storey (stone), z 6..80
box(-98, -84, -30, 98, 84, 6, STONE2, 'plinth');
const DOOR = [-16, 16, 6, 60], GW = [[-70, -40, 30, 60], [40, 70, 30, 60]];
wall('x', 74, 80, -94, 94, 6, 80, [DOOR, ...GW], STONE, 'front wall');
wall('x', -80, -74, -94, 94, 6, 80, [[-60, -30, 30, 60]], STONE, 'back wall');
wall('y', -94, -88, -74, 74, 6, 80, [], STONE, 'left wall');
wall('y', 88, 94, -74, 74, 6, 80, [], STONE, 'right wall (stair side, no window)');
for (const [a, b, z0, z1, s] of [...GW.map(w => [...w, 1]), [-60, -30, 30, 60, -1]]) { // ground windows: glass, mullion, sill, shutters
  const Y = (p, q) => s > 0 ? [p, q] : [-q, -p], [g0, g1] = Y(76, 78), [m0, m1] = Y(78, 80), [o0, o1] = Y(80, 82), c = (a + b) / 2;
  box(a, g0, z0, b, g1, z1, GLASS, 'glass'); box(c - 1, m0, z0, c + 1, m1, z1, TIMBER, 'mullion');
  box(a - 4, o0, z0 - 4, b + 4, o1, z0, STONE2, 'sill');
  box(a - 12, o0, z0, a - 2, o1, z1, PLANK2, 'shutter'); box(b + 2, o0, z0, b + 12, o1, z1, PLANK2, 'shutter');
}
box(-20, 80, 60, 20, 82, 64, TIMBER, 'door lintel');
box(16, 42, 6, 20, 74, 58, PLANK, 'open door'); for (const z of [16, 46]) box(20, 46, z, 22, 70, z + 4, IRON, 'door band');
for (const s of [-1, 1]) { box(s * 28 - 2, 80, 62, s * 28 + 2, 86, 64, IRON, 'lantern bracket'); box(s * 28 - 3, 84, 52, s * 28 + 3, 90, 62, GLOW, 'lantern'); }
box(-20, 84, 0, 20, 96, 6, STONE2, 'door step');
// ---- jettied first floor: plank slab over the walls, out 10 front and back, joist ends under the jetty, hole for the stair
const HOLE = [54, -36, 88, 44];
box(-94, -90, 80, 54, 90, 86, PLANK, 'floor 1'); box(54, -90, 80, 94, -36, 86, PLANK, 'floor 1'); box(54, 44, 80, 94, 90, 86, PLANK, 'floor 1'); box(88, -36, 80, 94, 44, 86, PLANK, 'floor 1');
for (let x = -86; x <= 82; x += 24) for (const [y0, y1] of [[80, 90], [-90, -80]]) box(x, y0, 74, x + 6, y1, 80, TIMBER, 'joist end');
for (const y of [-60, -20, 20, 60]) box(-88, y - 3, 74, Math.abs(y) < 40 ? 54 : 88, y + 3, 80, TIMBER, 'ceiling beam');
// ---- upper storey, z 86..150: plaster with windows, timber frame proud of it
const UW = [[-48, -28, 102, 136], [-10, 10, 102, 136], [28, 48, 102, 136]], BW = [[-48, -28, 102, 136], [28, 48, 102, 136]];
wall('x', 86, 90, -94, 94, 86, 150, UW, PLASTER, 'front upper'); wall('x', -90, -86, -94, 94, 86, 150, BW, PLASTER, 'back upper');
wall('y', -94, -90, -86, 86, 86, 150, [[-10, 10, 102, 136]], PLASTER, 'left upper'); wall('y', 90, 94, -86, 86, 86, 150, [], PLASTER, 'right upper');
for (const [s, wins] of [[1, UW], [-1, BW]]) {
  const yo = s > 0 ? [90, 92] : [-92, -90], yg = s > 0 ? [86, 88] : [-88, -86];
  for (const x of [-94, -58, -22, 18, 54, 90]) box(x, yo[0], 86, x + 4, yo[1], 150, TIMBER, 'post');
  for (const [z0, z1] of [[86, 90], [98, 102], [146, 150]]) for (const [a, b] of [[-90, -58], [-54, -22], [-18, 18], [22, 54], [58, 90]]) box(a, yo[0], z0, b, yo[1], z1, TIMBER, 'rail');
  for (const [a, b] of [[-90, -58], [58, 90]]) for (let k = 0; k < 8; k++) { const x = s * (a < 0 ? 1 : -1) > 0 ? a + k * 4 : b - 4 - k * 4; box(x, yo[0], 110 + k * 4, x + 4, yo[1], 114 + k * 4, TIMBER, 'brace'); }
  for (const [a, b, z0, z1] of wins) {
    box(a, yg[0], z0, b, yg[1], z1, GLASS, 'glass');
    const yb = s > 0 ? [88, 90] : [-90, -88], c = (a + b) / 2, zm = (z0 + z1) / 2;
    box(c - 2, yb[0], z0, c + 2, yb[1], z1, IRON, 'leading'); box(a, yb[0], zm - 1, c - 2, yb[1], zm + 1, IRON, 'leading'); box(c + 2, yb[0], zm - 1, b, yb[1], zm + 1, IRON, 'leading');
    if (s > 0) { box(a - 2, 92, 92, b + 2, 98, 98, PLANK2, 'window box'); for (let x = a; x < b; x += 4) box(x, 94, 98, x + 2, 96, 102, m(x % 8 ? [200, 60, 90] : [240, 200, 60]), 'flowers'); }
  }
}
box(-96, -10, 102, -94, 10, 136, TIMBER, 'side window frame'); // overlaps nothing: the side window is the hole at x -94..-90
box(-93, -10, 102, -91, 10, 136, GLASS, 'side glass');
// ---- roof: steep slate shell along x, eaves 8 out, gables plastered, ridge cap
box(-94, -90, 150, 94, 90, 154, PLASTER, 'ceiling');
for (let i = 1; i <= 24; i++) {
  const o = 98 - 4 * i + 4, n = o - 8, z = 150 + 4 * i, mt = i % 2 ? SLATE : SLATE2;
  if (n > 0) { box(-102, n, z, 102, o, z + 4, mt, 'roof'); box(-102, -o, z, 102, -n, z + 4, mt, 'roof'); } else box(-102, -o, z, 102, o, z + 4, mt, 'roof ridge');
  const g = 90 - 4 * i + 4; if (g > 0 && n > 0) for (const s of [-1, 1]) box(s > 0 ? 90 : -94, -n, z, s > 0 ? 94 : -90, n, z + 4, PLASTER, 'gable');
}
box(-102, -2, 250, 102, 2, 254, TIMBER, 'ridge cap');
for (const s of [-1, 1]) { const x = s > 0 ? 94 : -96; box(x, -2, 154, x + 2, 2, 240, TIMBER, 'king post'); box(x, -44, 186, x + 2, -2, 190, TIMBER, 'collar'); box(x, 2, 186, x + 2, 44, 190, TIMBER, 'collar'); }
// ---- chimney on the left gable
box(-116, -12, -30, -102, 12, 262, STONE2, 'chimney'); box(-118, -14, 262, -100, 14, 268, STONE, 'chimney cap');
box(-102, -12, 6, -96, 12, 150, STONE2, 'chimney breast');
// ---- ground floor interior
box(-88, -22, 6, -76, -14, 52, STONE, 'hearth side'); box(-88, 14, 6, -76, 22, 52, STONE, 'hearth side'); box(-88, -24, 52, -72, 24, 60, STONE2, 'mantel');
box(-88, -14, 6, -86, 14, 52, m([20, 18, 16]), 'firebox'); box(-86, -10, 6, -80, 10, 10, GLOW, 'embers'); box(-84, -8, 10, -80, 8, 14, PLANK2, 'log');
box(-76, -22, 6, -64, 22, 8, STONE2, 'hearth stone'); box(-86, -2, 28, -82, 2, 34, IRON, 'pot hook'); box(-86, -6, 18, -78, 6, 28, IRON, 'pot');
box(-20, -10, 34, 30, 20, 38, PLANK, 'table'); for (const [x, y] of [[-18, -8], [24, -8], [-18, 14], [24, 14]]) box(x, y, 6, x + 4, y + 4, 34, PLANK2, 'table leg');
for (const [y0, y1] of [[-20, -14], [26, 32]]) { box(-16, y0, 20, 26, y1, 24, PLANK, 'bench'); for (const x of [-14, 20]) box(x, y0, 6, x + 4, y1, 20, PLANK2, 'bench leg'); }
box(-8, 0, 38, 6, 8, 44, m([190, 140, 80]), 'loaf'); box(12, 4, 38, 18, 10, 46, m([140, 140, 150]), 'mug'); box(2, 12, 38, 6, 16, 48, WHITE, 'candle'); box(2, 12, 48, 6, 16, 52, GLOW, 'flame');
for (const [x, y] of [[-84, -70], [-64, -70], [-84, -50]]) { box(x + 2, y, 6, x + 16, y + 18, 32, PLANK2, 'barrel'); box(x, y + 2, 8, x + 2, y + 16, 30, PLANK, 'barrel'); box(x + 16, y + 2, 8, x + 18, y + 16, 30, PLANK, 'barrel'); box(x + 6, y + 6, 32, x + 12, y + 12, 34, IRON, 'bung'); }
box(-20, -74, 6, 20, -66, 60, PLANK2, 'dresser'); for (const z of [36, 48]) { box(-18, -66, z, 18, -62, z + 2, PLANK, 'shelf'); for (let x = -16; x < 16; x += 8) box(x, -66, z + 2, x + 6, -64, z + 10, WHITE, 'plate'); }
// stair along the right wall: bottom landing y 44..74 on the floor, 10 treads 8 deep x 8 high up to the floor (z 86), top landing on floor 1
for (let k = 0; k < 10; k++) box(56, 44 - 8 * (k + 1), 6, 88, 44 - 8 * k, 14 + 8 * k, PLANK, 'stair tread');
// ---- upstairs
for (let y = -32; y <= 40; y += 18) box(50, y, 86, 54, y + 4, 116, TIMBER, 'rail post'); box(50, -36, 116, 54, 48, 120, TIMBER, 'hand rail');
for (const x of [54, 70]) box(x, 44, 86, x + 4, 48, 116, TIMBER, 'rail post'); box(58, 44, 116, 88, 48, 120, TIMBER, 'hand rail');
box(-88, -74, 86, -84, -40, 120, TIMBER, 'headboard'); box(-84, -74, 86, -40, -40, 100, PLANK2, 'bed'); box(-74, -72, 100, -42, -42, 104, RED, 'blanket'); box(-84, -70, 100, -76, -44, 106, WHITE, 'pillow');
box(-36, -72, 86, -16, -58, 100, PLANK, 'chest'); box(-36, -72, 100, -16, -58, 102, IRON, 'chest band');
box(-14, 66, 110, 14, 82, 114, PLANK, 'desk'); for (const x of [-14, 10]) box(x, 66, 86, x + 4, 82, 110, PLANK2, 'desk leg');
box(-6, 70, 114, 2, 78, 116, WHITE, 'book'); box(6, 74, 114, 10, 78, 124, WHITE, 'candle'); box(6, 74, 124, 10, 78, 128, GLOW, 'flame'); box(-8, 52, 86, 8, 62, 100, PLANK2, 'stool');
box(60, 56, 86, 86, 82, 140, PLANK2, 'wardrobe'); box(72, 54, 100, 74, 56, 130, IRON, 'wardrobe seam');
box(-50, -24, 86, 10, 30, 88, m([60, 80, 120]), 'rug'); box(-4, -4, 132, 4, 4, 150, IRON, 'lamp chain'); box(-10, -10, 128, 10, 10, 132, IRON, 'lamp ring'); for (const [x, y] of [[-10, -2], [6, -2]]) box(x, y, 132, x + 4, y + 4, 136, GLOW, 'lamp candle');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`townhouse: ${bricks.length} bricks (${B.dropped.length} skipped: ${[...new Set(B.dropped.map(d => d.label ?? d.b?.label ?? JSON.stringify(d).slice(0, 80)))].join(', ')}) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 5000, bricks }] }));
