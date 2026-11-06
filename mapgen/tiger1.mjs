// Tiger I heavy tank, to scale (Third Gender, 2026-11-06), at the 60-unit-player scale (33 units a metre):
// hull 6.3 m x 3.56 m x 3.0 m tall (~208 x 118 x 99 units), 8.45 m long with the gun. Historical model only: plain
// dark-yellow paint, NO markings, crosses or insignia. Boxy hull and superstructure, interleaved road wheels on wide
// tracks, horseshoe turret with mantlet, long gun with a muzzle brake, commander's cupola, hatches, exhausts.
// node mapgen/tiger1.mjs X Y Z   (gun toward +x)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000716e', name: 'Claude Tiger', display_name: 'Claude Tiger' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const PAINT = m([176, 156, 98]), PAINT2 = m([150, 132, 82]), TRACK = m([46, 44, 40], { material: 'BMC_Metallic' }), WHEEL = m([140, 124, 80]);
const RUBBER = m([30, 30, 30]), DARK = m([60, 58, 50]), STEEL = m([90, 90, 92], { material: 'BMC_Metallic' });
const box = (x0, y0, z0, x1, y1, z1, mt, l) => B.box(x0, y0, z0, x1, y1, z1, mt, l);
const HL = 104, HW = 59; // hull half length / half width (units)
// ---- running gear: wide tracks (top and bottom runs + ends), interleaved road wheels seen from the side
for (const s of [-1, 1]) {
  const y0 = s > 0 ? HW - 24 : -HW, y1 = s > 0 ? HW : -HW + 24;
  box(-HL + 6, y0, 0, HL - 6, y1, 4, TRACK, 'track bottom');
  box(-HL + 2, y0, 34, HL + 2, y1, 38, TRACK, 'track top');
  box(HL - 6, y0, 4, HL + 6, y1, 34, TRACK, 'track front'); box(-HL - 6, y0, 4, -HL + 6, y1, 34, TRACK, 'track rear');
  // drive sprocket (front) and idler (rear) as dark discs; road wheels in two staggered rows (outer / inner)
  for (const [x, r] of [[HL - 14, 12], [-HL + 14, 11]]) box(x - r, s > 0 ? y1 - 2 : y0, 6, x + r, s > 0 ? y1 : y0 + 2, 32, DARK, 'sprocket');
  for (let n = 0; n < 8; n++) {
    const x = -70 + n * 20, outer = n % 2 === 0;
    const yo0 = s > 0 ? (outer ? y1 - 2 : y1 - 6) : (outer ? y0 : y0 + 4), yo1 = yo0 + 2;
    box(x - 14, yo0, 4, x + 14, yo1, 32, outer ? WHEEL : PAINT2, 'road wheel');
    box(x - 4, yo0 + (s > 0 ? 2 : -2), 14, x + 4, yo1 + (s > 0 ? 2 : -2), 22, RUBBER, 'hub');
  }
}
// ---- hull between the tracks and the wide superstructure over them
box(-HL, -HW + 24, 4, HL, HW - 24, 38, PAINT2, 'lower hull');
box(-HL, -HW, 38, HL, HW, 66, PAINT, 'superstructure'); // overhangs the tracks, slab sides
box(HL, -HW + 10, 38, HL + 4, HW - 10, 66, PAINT, 'glacis'); // near-vertical front plate
box(HL - 30, 26, 66, HL - 14, 44, 70, DARK, "driver's visor"); box(HL - 30, -44, 66, HL - 14, -26, 70, DARK, 'radio hatch');
box(HL + 4, 20, 50, HL + 8, 30, 58, DARK, 'hull mg ball');
for (const s of [-1, 1]) box(-HL - 6, s * 22 - 4, 52, -HL, s * 22 + 4, 76, STEEL, 'exhaust');
box(-HL + 4, -40, 66, -HL + 40, 40, 70, DARK, 'engine deck grilles');
for (const s of [-1, 1]) box(-30, s > 0 ? HW : -HW - 4, 44, 50, s > 0 ? HW + 4 : -HW, 50, STEEL, 'tools'); // tow cable / tools on the sides
// ---- turret: horseshoe (flat front, rounded sides and back), mantlet, gun with muzzle brake, cupola
const TX = 10, TZ0 = 66, TZ1 = 98, TR = 46;
for (let x = -TR; x < TR; x += 4) { // rows across x: horseshoe = round behind the centre, square-ish in front
  const t = x + 2, w = t < 0 ? Math.floor(Math.sqrt(TR * TR - t * t) / 2) * 2 : 44;
  if (w > 0) box(TX + x, -w, TZ0, TX + x + 4, w, TZ1, PAINT, 'turret');
}
box(TX + TR, -26, TZ0 + 2, TX + TR + 10, 26, TZ1 - 2, PAINT2, 'mantlet');
box(TX + TR + 10, -5, 80, TX + TR + 150, 5, 88, STEEL, 'gun barrel'); // 88 mm: ~4.7 m of barrel beyond the mantlet
box(TX + TR + 150, -8, 77, TX + TR + 166, 8, 91, DARK, 'muzzle brake');
box(TX - 30, 20, TZ1, TX - 10, 40, TZ1 + 10, PAINT2, 'cupola'); box(TX - 28, 22, TZ1 + 10, TX - 12, 38, TZ1 + 12, DARK, 'cupola hatch');
box(TX - 6, -36, TZ1, TX + 10, -20, TZ1 + 2, DARK, 'loader hatch');
box(TX - TR - 12, -30, TZ0 + 6, TX - TR, 30, TZ1 - 6, PAINT2, 'turret bin');
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`tiger1: ${bricks.length} bricks (${B.dropped.length} skipped), ${2 * HL} hull, ${TX + TR + 166 + HL} with gun, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
