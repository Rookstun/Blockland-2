// 1979 Pontiac Firebird Trans Am (VAUX, 2026-11-06), from memory of the car (no logos/badge text): black with gold
// pinstripes, long hood with shaker scoop, slanted nose with quad rectangular headlights, T-tops, sloped glass, rear
// spoiler, full-width red taillight panel, chrome twin tips, gold-centre wheels, tan interior. ~4.9 x 1.9 m at the
// 60-unit-player scale = 160 x 62 units. Micro bricks + micro wedges, front toward +x. node mapgen/transam.mjs X Y Z
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-000000001979', name: 'Claude Trans Am', display_name: 'Claude Trans Am' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const PAINT = m([18, 18, 20], { material: 'BMC_Metallic' }), GOLD = m([200, 160, 60], { material: 'BMC_Metallic' }), TRIM = m([30, 30, 32]);
const GLASS = m([90, 110, 130], { material: 'BMC_Glass' }), CHROME = m([210, 210, 215], { material: 'BMC_Metallic' }), TIRE = m([22, 22, 22]);
const HEAD = m([255, 250, 230], { material: 'BMC_Glow', material_intensity: 2 }), TAIL = m([200, 20, 20], { material: 'BMC_Glow', material_intensity: 2 });
const TAN = m([170, 140, 100]), DARK = m([40, 40, 44]);
const box = (x0, y0, z0, x1, y1, z1, mt, l) => { if (!B.box(x0, y0, z0, x1, y1, z1, mt, l)) throw new Error(`${l}: ${B.dropped.at(-1)}`); };
const wedge = (x0, y0, z0, x1, y1, z1, dx, dy, color, l) => { if (!B.wedge(x0, y0, z0, x1, y1, z1, dx, dy, color, l)) throw new Error(`${l}: ${B.dropped.at(-1)}`); };
// ---- wheels: tyre discs in the x-z plane (rows), gold centre, at x = +-52, outside the body sides
const WX = [-52, 52], WR = 13;
for (const wx of WX) for (const s of [-1, 1]) {
  const y0 = s > 0 ? 22 : -32, y1 = s > 0 ? 32 : -22;
  for (let z = 0; z < 2 * WR; z += 2) {
    const dz = z + 1 - WR, hw = Math.floor(Math.sqrt(WR * WR - dz * dz) / 2) * 2;
    if (hw < 2) continue;
    const gold = Math.abs(dz) < 8 && hw > 8;
    if (gold) {
      box(wx - hw, y0, z, wx - 8, y1, z + 2, TIRE, 'tyre'); box(wx + 8, y0, z, wx + hw, y1, z + 2, TIRE, 'tyre');
      box(wx - 8, s > 0 ? y0 : y0 + 2, z, wx + 8, s > 0 ? y1 - 2 : y1, z + 2, TRIM, 'hub'); // recessed
      box(wx - 8, s > 0 ? y1 - 2 : y0, z, wx + 8, s > 0 ? y1 : y0 + 2, z + 2, (z / 2) % 2 ? GOLD : m([150, 115, 40], { material: 'BMC_Metallic' }), 'snowflake');
    } else box(wx - hw, y0, z, wx + hw, y1, z + 2, TIRE, 'tyre');
  }
}
// ---- lower body: sections between/around the wheel arches, then the belt over everything
box(-82, -30, 6, -68, 30, 26, PAINT, 'rear quarter');
box(-36, -30, 6, 36, 30, 26, PAINT, 'doors/sills');
box(68, -30, 6, 76, 30, 26, PAINT, 'front valance');
for (const wx of WX) box(wx - 16, -22, 6, wx + 16, 22, 26, TRIM, 'arch inner'); // wheel wells between the tyres
for (const wx of WX) for (const s of [-1, 1]) { box(wx - 16, s > 0 ? 22 : -30, 26, wx - 14, s > 0 ? 30 : -22, 28, PAINT, 'arch lip'); box(wx + 14, s > 0 ? 22 : -30, 26, wx + 16, s > 0 ? 30 : -22, 28, PAINT, 'arch lip'); }
box(-68, -22, 26, -36, 22, 28, PAINT, 'belt over arch');
box(-36, -30, 26, 36, 30, 28, PAINT, 'belt');
box(36, -22, 26, 68, 22, 28, PAINT, 'belt over arch');
box(-82, -30, 26, -68, 30, 28, PAINT, 'belt');
box(68, -30, 26, 76, 30, 28, PAINT, 'belt');
for (const s of [-1, 1]) for (const [x0, x1] of [[-82, -68], [-36, 36], [68, 76]]) box(x0, s > 0 ? 30 : -32, 22, x1, s > 0 ? 32 : -30, 24, GOLD, 'pinstripe'); // skips the wheel zones (tyres stand out to y 32)
// ---- nose: slanted front (wedge falling toward +x), quad headlights in a dark surround, chrome bumper strip
wedge(76, -30, 14, 86, 30, 30, -1, 0, [18, 18, 20], 'nose');
box(76, -30, 6, 86, 30, 14, TRIM, 'grille');
for (const y of [-26, -16, 8, 18]) box(86, y, 8, 88, y + 8, 12, HEAD, 'headlight');
box(86, -4, 8, 88, 4, 12, DARK, 'grille centre');
box(86, -30, 4, 88, 30, 8, CHROME, 'front bumper');
// ---- hood + shaker scoop, windshield, T-top roof, side glass, rear glass, deck, spoiler
box(20, -30, 28, 76, 30, 30, PAINT, 'hood');
box(40, -8, 30, 60, 8, 36, TRIM, 'shaker'); wedge(60, -8, 30, 64, 8, 36, -1, 0, [30, 30, 32], 'shaker nose');
box(36, -12, 30, 40, 12, 32, GOLD, 'hood stripe');
wedge(4, -28, 30, 20, 28, 46, -1, 0, [90, 110, 130], 'windshield');
box(-26, -28, 46, 4, -20, 48, PAINT, 'roof rail'); box(-26, 20, 46, 4, 28, 48, PAINT, 'roof rail');
box(-26, -2, 46, 4, 2, 48, PAINT, 't-bar');
box(-26, -20, 46, 4, -2, 48, GLASS, 't-top'); box(-26, 2, 46, 4, 20, 48, GLASS, 't-top');
for (const s of [-1, 1]) box(-26, s > 0 ? 28 : -30, 30, 4, s > 0 ? 30 : -28, 46, GLASS, 'side glass');
wedge(-46, -28, 30, -26, 28, 46, 1, 0, [90, 110, 130], 'rear glass');
box(-82, -30, 28, -46, 30, 30, PAINT, 'deck');
for (const s of [-1, 1]) box(-46, s > 0 ? 26 : -30, 28, 20, s > 0 ? 30 : -26, 30, PAINT, 'door top'); // body top along the cabin sides (hood and deck cover the arches)
box(-82, -30, 30, -78, 30, 34, PAINT, 'spoiler'); box(-84, -30, 34, -76, 30, 36, PAINT, 'spoiler lip');
// ---- tail: full-width red panel, chrome bumper, twin tips
box(-84, -28, 14, -82, 28, 24, TAIL, 'taillights');
box(-84, -30, 4, -82, 30, 10, CHROME, 'rear bumper');
for (const y of [-20, 14]) box(-86, y, 4, -84, y + 6, 8, CHROME, 'tip');
// ---- interior through the T-tops: seats, dash, wheel; mirrors
for (const y of [-22, 4]) { box(-20, y, 28, -8, y + 16, 34, TAN, 'seat'); box(-24, y, 28, -20, y + 16, 44, TAN, 'seat back'); }
box(0, -26, 28, 4, 26, 36, DARK, 'dash');
box(-6, 8, 34, -4, 20, 42, DARK, 'wheel'); // left-hand drive: driver on +y
for (const s of [-1, 1]) box(4, s > 0 ? 30 : -34, 34, 8, s > 0 ? 34 : -30, 38, PAINT, 'mirror');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`transam: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
