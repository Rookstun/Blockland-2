// Outdoors megastore (VAUX asked for "a bass pro shop", 2026-11-06): an ORIGINAL lodge-style sporting-goods store,
// "LUNKER LODGE OUTFITTERS" (no real brand, logo or name). Log-cabin walls on a stone base, a big pitched roof, glass
// entrance; inside: a walk-past aquarium with fish, a boat on display, a taxidermy bear on a rock, aisles of shelves,
// a rod rack, checkouts, hanging lights. node mapgen/outdoorstore.mjs X Y Z   (entrance toward -y)
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000010d6', name: 'Claude Outfitters', display_name: 'Claude Outfitters' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 300 });
const rand = rng(88);
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const LOG = m([120, 80, 46]), LOG2 = m([100, 66, 38]), STONE = m([120, 116, 108]), FLOOR = m([150, 110, 70]), ROOF = m([60, 70, 56]);
const GLASS = m([150, 200, 220], { material: 'BMC_Glass' }), WATER = m([60, 130, 170], { material: 'BMC_Glass' }), SHELF = m([90, 60, 36]);
const LIGHT = m([255, 230, 180], { material: 'BMC_Glow', material_intensity: 2 }), SIGN = m([230, 190, 70], { material: 'BMC_Glow', material_intensity: 1 });
const HX = 300, HY = 200, H = 150; // half length (x), half depth (y), wall height
const box = (x0, y0, z0, x1, y1, z1, mt, l) => B.box(x0, y0, z0, x1, y1, z1, mt, l);
// floor, stone base course, log walls (alternating tones per log), glass doors in the front centre
box(-HX, -HY, 0, HX, HY, 6, FLOOR, 'floor');
for (const [x0, y0, x1, y1] of [[-HX - 6, -HY - 6, HX + 6, -HY], [-HX - 6, HY, HX + 6, HY + 6], [-HX - 6, -HY, -HX, HY], [HX, -HY, HX + 6, HY]]) {
  box(x0, y0, 0, x1, y1, 24, STONE, 'stone base');
  for (let z = 24; z < H; z += 12) {
    const door = y1 === -HY && z < 96; // front wall gap for the doors
    if (door) { box(x0, y0, z, -60, y1, z + 12, (z / 12) % 2 ? LOG : LOG2, 'log'); box(60, y0, z, x1, y1, z + 12, (z / 12) % 2 ? LOG : LOG2, 'log'); }
    else box(x0, y0, z, x1, y1, z + 12, (z / 12) % 2 ? LOG : LOG2, 'log');
  }
}
for (const x of [-58, 2]) box(x, -HY - 4, 24, x + 56, -HY - 2, 96, { ...GLASS, collision: false }, 'glass door'); // walk-through (VAUX: "open the doors")
box(-80, -HY - 10, 104, 80, -HY - 6, 130, SIGN, 'sign board'); // "LUNKER LODGE OUTFITTERS" board (plain glow)
// roof: stepped gable along x, overhanging
for (let s = 0; s < 14; s++) box(-HX - 20, -HY - 20 + s * 15, H + s * 8, HX + 20, HY + 20 - s * 15, H + s * 8 + 8, ROOF, 'roof');
// ---- inside
// aquarium along the back wall with fish
box(-240, HY - 70, 6, 240, HY - 66, 110, WATER, 'aquarium front'); box(-240, HY - 14, 6, 240, HY - 10, 110, WATER, 'aquarium back'); box(-240, HY - 66, 106, 240, HY - 14, 110, WATER, 'aquarium lid'); // hollow so the fish swim inside
for (let n = 0; n < 24; n++) { const x = Math.round((rand() * 440 - 220) / 2) * 2, y = HY - 40 + Math.round(rand() * 20 / 2) * 2 - 10, z = 20 + Math.round(rand() * 70 / 2) * 2; box(x, y - 2, z, x + 10, y + 2, z + 6, m(n % 3 ? [200, 160, 60] : [90, 110, 70]), 'fish'); }
// boat on a trailer stand, centre floor
box(-60, -30, 6, 60, 30, 20, m([60, 60, 64]), 'trailer');
box(-80, -26, 20, 70, 26, 46, m([230, 230, 225]), 'hull'); box(70, -16, 20, 92, 16, 40, m([230, 230, 225]), 'bow');
box(-60, -20, 46, -30, 20, 70, m([40, 80, 140]), 'console');
// taxidermy bear on a rock by the entrance
box(-250, -150, 6, -190, -90, 30, STONE, 'rock'); box(-236, -136, 30, -204, -104, 80, m([70, 50, 34]), 'bear body'); box(-232, -132, 80, -208, -108, 100, m([70, 50, 34]), 'bear head');
// aisles of shelves (left and right of the boat) and a rod rack along the left wall
for (const sx of [-1, 1]) for (let r = 0; r < 3; r++) { const x0 = sx > 0 ? 140 + r * 50 : -180 - r * 50; for (const y of [-100, 76]) box(x0, y, 6, x0 + 20, y + 4, 74, SHELF, 'shelf end'); for (const z of [20, 40, 60]) { box(x0, -96, z, x0 + 20, 76, z + 2, SHELF, 'shelf board'); box(x0 + 2, -94, z + 2, x0 + 18, 74, z + 8, m([180, 60 + r * 40, 50]), 'goods'); } }
for (let y = -120; y < 100; y += 12) box(-HX + 4, y, 30, -HX + 6, y + 2, 130, m([50, 50, 54]), 'fishing rod');
// checkouts by the doors
for (const x of [100, 180]) box(x, -170, 6, x + 50, -150, 40, m([140, 100, 64]), 'checkout');
for (let x = -240; x <= 240; x += 80) box(x - 6, -6, H - 10, x + 6, 6, H - 4, LIGHT, 'light');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`outdoorstore: ${bricks.length} bricks (${B.dropped.length} skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 5000, bricks }] }));
