// Gnome garden obstacle course (2008nickcody, 2026-11-06: "hyper detailed and scenic obstacle course that blends in
// naturally ... increasingly challenging - feature many garden gnomes"). A garden plot with hedges and flowers; the
// route runs through four stages, each harder: 1 pond stepping stones (flat, short gaps), 2 log hops (small rises),
// 3 tree-stump climb (taller rises), 4 floating mushroom caps and narrow beams (small, high, long gaps). A giant gnome
// with a gold cup waits on the finish. ~40 garden gnomes stand along the way. Original design.
// node mapgen/gnomecourse.mjs X Y Z
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000000006e0', name: 'Claude Gnome Course', display_name: 'Claude Gnome Course' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const rand = rng(77);
const MB = 'PB_DefaultMicroBrick';
const m = (color, x) => ({ asset: MB, color, ...x });
const ev = v => Math.round(v / 2) * 2;
const GRASS = m([92, 140, 70]), HEDGE = m([46, 96, 46]), WATER = m([70, 130, 170], { material: 'BMC_Glass' }), STONE = m([150, 146, 138]);
const LOG = m([110, 76, 46]), STUMP = m([124, 88, 54]), RING = m([190, 160, 110]), STEM = m([235, 228, 210]), BEAM = m([140, 100, 60]);
const CAPS = [[200, 40, 40], [220, 120, 40], [170, 60, 170]];
const W = 900, D = 600; // garden plot half sizes (x, y)
// ---- garden plot: grass, hedge border, flower beds
B.box(-W, -D, 0, W, D, 4, GRASS, 'lawn');
for (const s of [-1, 1]) { B.box(-W, s > 0 ? D - 20 : -D, 4, W, s > 0 ? D : -D + 20, 28, HEDGE, 'hedge'); B.box(s > 0 ? W - 20 : -W, -D + 20, 4, s > 0 ? W : -W + 20, D - 20, 28, HEDGE, 'hedge'); }
const FLOWER = [[230, 80, 120], [250, 220, 70], [240, 240, 240], [140, 90, 220], [250, 140, 60]];
for (let n = 0; n < 140; n++) { const x = ev((rand() * 2 - 1) * (W - 40)), y = ev((rand() * 2 - 1) * (D - 40)); B.box(x, y, 4, x + 2, y + 2, 10, m([60, 120, 50]), 'stalk'); B.box(x - 2, y - 2, 10, x + 4, y + 4, 12, m(FLOWER[n % 5]), 'flower'); }
// ---- pond under stage 1
B.box(-760, -200, 4, -360, 200, 6, WATER, 'pond');
// ---- the route: stage by stage, each piece placed only where it is clear (else nudged along)
let x = -820, y = -160, z = 4, dir = 1;
const pieces = [];
const place = (kind, hx, hy, top, mat, extra) => {
  for (let t = 0; t < 12; t++) {
    const ok = B.free([ev(x - hx - 6), ev(y - hy - 6), top - 70], [ev(x + hx + 6), ev(y + hy + 6), top + 70]);
    if (ok) { extra(ev(x), ev(y), top, hx, hy, mat); pieces.push([kind, ev(x), ev(y), top]); return; }
    y += 10 * dir;
  }
};
const stages = [
  { kind: 'stone', n: 10, gap: [22, 30], rise: [0, 0], size: [12, 16] },
  { kind: 'log', n: 10, gap: [26, 34], rise: [4, 8], size: [10, 14] },
  { kind: 'stump', n: 12, gap: [28, 38], rise: [10, 16], size: [8, 12] },
  { kind: 'cap', n: 14, gap: [34, 46], rise: [12, 20], size: [5, 8] },
];
const r = ([a, b]) => ev(a + rand() * (b - a));
for (const st of stages) for (let k = 0; k < st.n; k++) {
  const s = r(st.size), top = z + r(st.rise) + (st.kind === 'stone' ? 6 : 8);
  if (st.kind === 'stone') place('stone', s, s, top, STONE, (px, py, t, hx, hy, mt) => B.box(px - hx, py - hy, 4, px + hx, py + hy, t, mt, 'stone'));
  if (st.kind === 'log') place('log', s, 6, top, LOG, (px, py, t, hx, hy, mt) => { B.box(px - hx, py - hy, t - 12, px + hx, py + hy, t, mt, 'log'); B.box(px - hx - 2, py - hy, t - 10, px - hx, py + hy, t - 2, RING, 'log end'); B.box(px - hx, py - hy, 4, px + hx, py + hy, t - 12, m([90, 64, 40]), 'log prop'); });
  if (st.kind === 'stump') place('stump', s, s, top, STUMP, (px, py, t, hx, hy, mt) => { B.box(px - hx, py - hy, 4, px + hx, py + hy, t - 2, mt, 'stump'); B.box(px - hx + 2, py - hy + 2, t - 2, px + hx - 2, py + hy - 2, t, RING, 'stump top'); });
  if (st.kind === 'cap') {
    const narrow = k % 4 === 3; // every 4th: a narrow beam instead of a cap
    place(narrow ? 'beam' : 'cap', narrow ? 24 : s, narrow ? 2 : s, top, narrow ? BEAM : m(CAPS[k % 3]), (px, py, t, hx, hy, mt) => {
      B.box(px - 2, py - 2, 4, px + 2, py + 2, t - 6, STEM, 'stem');
      B.box(px - hx, py - hy, t - 6, px + hx, py + hy, t, mt, narrow ? 'beam' : 'cap');
      if (!narrow) B.box(px - 2, py - 2, t, px + 2, py + 2, t + 2, m([250, 250, 250]), 'cap spot');
    });
  }
  z = top - (st.kind === 'stone' ? 6 : 8) + (st.kind === 'stone' ? 0 : 0);
  // advance along x, snake in y at the plot edges
  x += r(st.gap) + s * 2;
  if (x > W - 120) { x = W - 120; y += 140 * dir; }
  if (rand() < 0.25) y += (rand() < 0.5 ? -1 : 1) * 40;
  y = Math.max(-D + 80, Math.min(D - 80, y));
}
// finish: a wide platform with a giant gnome holding a gold cup
const fx = ev(x + 60), fy = ev(y), ftop = z + 24;
B.box(fx - 40, fy - 40, ftop - 8, fx + 40, fy + 40, ftop, m([230, 200, 80], { material: 'BMC_Glow', material_intensity: 1 }), 'finish');
B.box(fx - 2, fy - 2, 4, fx + 2, fy + 2, ftop - 8, STEM, 'finish post');
// ---- gnomes: boots, blue coat, belt, face, white beard, red pointed hat (scale g: 1 = 30 units tall)
const gnome = (gx, gy, gz, g = 1, coat = [60, 90, 170], hat = [200, 40, 40]) => {
  const u = v => ev(v * g);
  const bx = (x0, y0, z0, x1, y1, z1, c) => B.box(gx + u(x0), gy + u(y0), gz + u(z0), gx + u(x1), gy + u(y1), gz + u(z1), m(c), 'gnome');
  bx(-4, -4, 0, 4, 4, 2, [70, 50, 36]); // boots
  bx(-4, -4, 2, 4, 4, 12, coat); // coat
  bx(-4, -4, 8, 4, 4, 10, [40, 30, 24]); // belt (overlaps the coat: skipped, keeps the coat)
  bx(-3, -3, 12, 3, 3, 18, [236, 196, 170]); // face
  bx(3, -3, 10, 4, 3, 16, [245, 245, 245]); // beard on the front (+x)
  for (let s = 0; s < 5; s++) bx(-3 + s * 0.6, -3 + s * 0.6, 18 + s * 2, 3 - s * 0.6, 3 - s * 0.6, 20 + s * 2, hat); // pointed hat
};
const COATS = [[60, 90, 170], [60, 140, 70], [170, 120, 50], [130, 60, 150]], HATS = [[200, 40, 40], [210, 60, 40], [190, 30, 60]];
gnome(fx, fy, ftop, 3); B.box(fx + 14, fy - 4, ftop + 24, fx + 22, fy + 4, ftop + 36, m([230, 190, 60], { material: 'BMC_Metallic' }), 'gold cup');
let gn = 0;
for (const [, px, py] of pieces) { if (rand() < 0.55) { const s = rand() < 0.5 ? -1 : 1; gnome(px, py + s * 40, 4, 1, COATS[gn % 4], HATS[gn % 3]); gn++; } }
for (let n = 0; n < 14; n++) { gnome(ev((rand() * 2 - 1) * (W - 80)), ev((rand() * 2 - 1) * (D - 80)), 4, 1 + Math.floor(rand() * 2) * 0.5, COATS[n % 4], HATS[n % 3]); gn++; }
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`gnomecourse: ${bricks.length} bricks, ${pieces.length} jumps, ${gn + 1} gnomes, finish z ${ftop}, at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 6000, bricks }] }));
