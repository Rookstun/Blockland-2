// Blue whale with a walkable digestive system, to scale with mapgen/tuna.mjs (Third Gender, 2026-11-06: "MAKE IT SO THE
// WHALE AND THE BLUEFIN TUNA ARE IN THE RIGHT RELATIVE SIZE"): bluefin ~3 m vs blue whale ~30 m, so 10x the tuna's
// 840 units = 8400 units (840 studs) long. Too big to fill: a two-layer SHELL (blue-grey outside, pink lining inside)
// built from cross-section slices (rows of boxes along each slice's ellipse), lying on its belly, head toward +x.
// Inside, at floor level: open MOUTH -> BALEEN curtain (walkway down the middle) -> THROAT wall with a doorway ->
// 4 STOMACH chambers (bulkheads with doorways) -> INTESTINE (serpentine corridor of walls) -> VENT out the +y flank.
// Horizontal tail flukes, pectoral flippers, throat grooves, eyes.
// node mapgen/bluewhale.mjs X Y Z > job.json
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000b1e00', name: 'Claude Blue Whale', display_name: 'Claude Blue Whale' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 400 });
const MB = 'PB_DefaultMicroBrick';
const LX = 8400, HW = 700, HH = 620, S = 60, R = 24, T1 = 20, T2 = 20; // length, half width/height, slice, row, skin layers
const ev = v => Math.round(v / 2) * 2;
const prof = x => { // 0 at the tail tip, blunt round head at +x
  const t = x / LX;
  if (t > 0.985) return Math.sqrt(Math.max(0, 1 - ((t - 0.985) / 0.015) ** 2)) * 0.62;
  return Math.min(1, Math.pow(Math.min(t / 0.62, 1), 0.85) * (t < 0.62 ? 1 : 1 - 0.38 * ((t - 0.62) / 0.365) ** 2));
};
const skin = (x, z, hh) => { // mottled blue-grey back, paler belly, throat grooves near the head
  const up = (z - hh) / hh, n = ((x * 7 + z * 13) >> 4) & 3;
  if (up < -0.55 && x > LX * 0.68) return (z >> 3) % 3 === 0 ? [150, 160, 172] : [120, 132, 148];
  if (up < -0.35) return [128 - n * 4, 140 - n * 4, 156 - n * 4];
  return [66 + n * 5, 84 + n * 5, 108 + n * 5];
};
const PINK = [214, 120, 128], PINK2 = [190, 86, 98];
const FLOOR = T1 + T2; // inner floor height
// rows of a slice: outer/inner half widths at height z (or 0)
const half = (h, w, z) => { const u = (z - h) / h; return Math.abs(u) >= 1 ? 0 : w * Math.sqrt(1 - u * u); };
const MOUTH = [FLOOR, FLOOR + 320], VENT = [700, 820, FLOOR, FLOOR + 200];
// ---- interior first (bulkheads, baleen, intestine walls) so the shell never blocks them ----
const innerHalf = (x, z) => { const p = prof(x); return half(HH * p - T1 - T2, HW * p - T1 - T2, z - T1 - T2); };
const bulkhead = (x, door = 70, doorH = 180) => {
  const p = prof(x), top = 2 * HH * p - FLOOR - 40;
  for (let z = FLOOR; z < FLOOR + top; z += R) {
    const w = ev(innerHalf(x, z + R / 2) - 2);
    if (w < 8) continue;
    const c = (z / R) % 2 ? PINK : PINK2;
    if (z < FLOOR + doorH) { if (w > door) { B.box(-w, ev(x) - 20, z, -door, ev(x) + 20, z + R, { asset: MB, color: c }, 'bulkhead'); B.box(door, ev(x) - 20, z, w, ev(x) + 20, z + R, { asset: MB, color: c }, 'bulkhead'); } }
    else B.box(-w, ev(x) - 20, z, w, ev(x) + 20, z + R, { asset: MB, color: c }, 'bulkhead');
  }
};
// note: the body runs along x but builder.box takes (x0, y0, z0, x1, y1, z1); slices are planes of constant x,
// so walls across the body span y. Helper takes (y range, x range) in that order for readability.
const wallY = (y0, y1, x0, x1, z0, z1, c, l) => B.box(ev(x0), ev(y0), z0, ev(x1), ev(y1), z1, { asset: MB, color: c }, l);
// throat + 4 stomach chambers
bulkhead(LX - 900, 90);
for (const x of [LX - 1500, LX - 2100, LX - 2700, LX - 3300]) bulkhead(x, 80);
// baleen: thin dark plates hanging from the upper jaw on both sides of a walkway
for (let x = LX - 560; x < LX - 160; x += 12) for (const s of [-1, 1]) {
  const w = ev(innerHalf(x, FLOOR + 200) - 4);
  if (w < 140) continue;
  wallY(s > 0 ? 110 : -w, s > 0 ? w : -110, x, x + 2, FLOOR + 120, FLOOR + 300, [40, 36, 34], 'baleen');
}
// intestine: serpentine walls across the body from the last stomach to the vent, gaps alternating sides
let n = 0;
for (let x = LX - 3460; x > 980; x -= 170, n++) {
  const w = ev(innerHalf(x, FLOOR + 100) - 4);
  if (w < 200) break;
  const gap = 130, wallH = FLOOR + 200;
  if (n % 2) wallY(-w, w - gap, x - 10, x + 10, FLOOR, wallH, n % 4 === 1 ? PINK : PINK2, 'intestine');
  else wallY(-w + gap, w, x - 10, x + 10, FLOOR, wallH, n % 4 === 0 ? PINK : PINK2, 'intestine');
}
const interiorBricks = B.bricks.length;
// ---- shell, slice by slice ----
for (let x = 0; x < LX; x += S) {
  const p = prof(x + S / 2);
  if (p < 0.03) continue;
  const hw = HW * p, hh = HH * p;
  for (let z = 0; z < 2 * hh; z += R) {
    const zm = z + R / 2;
    const wo = ev(half(hh, hw, zm)), wm = ev(half(hh - T1, hw - T1, zm - T1 + 0)), wi = ev(half(hh - T1 - T2, hw - T1 - T2, zm - T1 - T2));
    if (wo < 2) continue;
    const mouth = x > LX - 140 && z >= MOUTH[0] && z < MOUTH[1];
    const vent = x + S > VENT[0] && x < VENT[1] && z >= VENT[2] && z < VENT[3];
    const put = (y0, y1, c, l) => { if (y1 > y0) B.box(x, y0, z, x + S, y1, z + R, { asset: MB, color: c }, l); };
    if (mouth) continue;
    if (wi <= 0) { put(-wo, wo, z < hh ? skin(x, z, hh) : skin(x, z, hh), 'cap'); continue; }
    // outer skin, lining, both sides; the vent cuts the +y side
    put(-wo, -wm, skin(x, z, hh), 'skin');
    put(-wm, -wi, PINK, 'lining');
    if (!vent) { put(wi, wm, PINK, 'lining'); put(wm, wo, skin(x, z, hh), 'skin'); }
    if (z < FLOOR) put(-wi, wi, PINK2, 'floor');
  }
}
// eyes, flippers, flukes
for (const s of [-1, 1]) {
  const x = LX - 1150, z = Math.round(HH * prof(x) * 0.75 / 2) * 2, w = ev(half(HH * prof(x), HW * prof(x), z));
  B.box(x, s > 0 ? w : -w - 4, z, x + 24, s > 0 ? w + 4 : -w, z + 24, { asset: MB, color: [20, 20, 24] }, 'eye');
  const fx = LX - 2300, fz = 120, fw = ev(half(HH * prof(fx), HW * prof(fx), fz + 10));
  for (let k = 0; k < 10; k++) B.box(fx - k * 60, s > 0 ? fw + k * 30 : -fw - k * 30 - 60, fz - k * 8, fx - k * 60 + 120, s > 0 ? fw + k * 30 + 60 : -fw - k * 30, fz - k * 8 + 12, { asset: MB, color: [80, 96, 118] }, 'flipper');
}
for (let k = 0; k < 14; k++) { // flukes: horizontal, swept back from the tail stock, each step wider
  const x = 180 - k * 30, w = 60 + k * 70;
  B.box(ev(x - 30), -ev(w), 60, ev(x + 60), ev(w), 84, { asset: MB, color: [62, 78, 100] }, 'fluke');
}
const lost = B.dropped.filter(d => /^(bulkhead|baleen|intestine)/.test(d));
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`bluewhale: ${bricks.length} bricks (interior ${interiorBricks}, intestine walls ${n}), ${LX} long, ${2 * HH} tall; skipped ${B.dropped.length} (interior lost ${lost.length}) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 8000, bricks }] }));
