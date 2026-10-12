// A suburb of simhouse streets (owner 2026-10-11: "wipe the map and make a ton of houses
// spawn with simhouse"; "make the streets more dynamic"). Each street = 4 random lots
// (simhouse SIM_SEED: houses with garages / basements / six roof types, or parks; lamp posts,
// parked cars, a hydrant) on its own sand pad.
//   - every other row is turned round, so back yards meet back yards and the roads of facing
//     rows pair up into boulevards with a planted median between them
//   - GTA-style avenues between the columns (owner: "grand theft auto roads"): four lanes, a double
//     yellow centre line, dashed white lane lines, stop lines, zebra crossings and traffic lights
//     at every street, lamp posts
//   node suburb.mjs [--cols 5] [--rows 15] [--seed 1] [--out out_suburb]
// -> OUT/chunk_NNN.json (bridge jobs, world coordinates), loaded by the server's
//    chunk loader (one bricks op, see CLAUDE.md map uploads).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const COLS = +arg('cols', 5), ROWS = +arg('rows', 15), SEED = +arg('seed', 1), OUT = join(here, arg('out', 'out_suburb'));
const STREET_W = 3340, STREET_D = 1140;   // simhouse pad: x -1670..1670, y 40..1180 around the street origin
const AVE = 400;                          // avenue between columns: 40 pavement, 320 road (4 lanes of 80), 40 pavement
const BASE = 380, GROUND = 270;           // lot top 110 over the sea plane (mapgen WATER_Z 270): room for the basements
const PAD_H = Math.floor((BASE - GROUND - 12) / 4) * 4; // pad under the sand: a multiple of 4 (even half height)

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const colX = c => (c - (COLS - 1) / 2) * (STREET_W + AVE);
const rowY = r => (r - (ROWS - 1) / 2) * STREET_D;            // band r: y rowY .. rowY + STREET_D
const flipped = r => r % 2 === 1;
// a row's road band in world y (simhouse local road 100..280, local y 40 = band edge)
const roadBand = r => flipped(r) ? [rowY(r) + STREET_D + 40 - 280, rowY(r) + STREET_D + 40 - 100] : [rowY(r) + 60, rowY(r) + 240];
const walkBand = r => flipped(r) ? [rowY(r) + STREET_D + 40 - 340, rowY(r) + STREET_D + 40 - 280] : [rowY(r) + 240, rowY(r) + 300];

let total = 0, n = 0;
const write = bricks => {
  fs.writeFileSync(join(OUT, `chunk_${String(n).padStart(3, '0')}.json`), JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], bricks }] }));
  total += bricks.length; n++;
};
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const x = colX(c), y = flipped(r) ? rowY(r) + STREET_D + 40 : rowY(r) - 40;
  const seed = SEED * 1000 + r * COLS + c + 1;
  const job = execFileSync(process.execPath, [join(here, 'simhouse.mjs'), x, y, flipped(r) ? 270 : 90, BASE, GROUND], { env: { ...process.env, SIM_SEED: String(seed) }, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  write(JSON.parse(job).ops.find(o => o.op === 'bricks').bricks);
  if (n % 15 === 0) console.error(`${n}/${COLS * ROWS} streets, ${total} bricks`);
}

// ---- avenues, medians: plain boxes in world coordinates (z relative to BASE)
const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const out = [];
const MAXL = 500;  // longest box side: long ones are split (a 3340-long brick and a 17100-long micro brick were rejected in game)
const box = (x0, y0, z0, x1, y1, z1, b) => {
  if (!(x1 > x0 && y1 > y0 && z1 > z0)) return;
  // regular bricks: 500 or at most 280 per side (a 340-long and a 3340-long one were rejected in game)
  const cuts = (v0, v1) => { const out = []; for (let v = v0; v < v1;) { let L = Math.min(MAXL, v1 - v); if (b.asset === 'PB_DefaultBrick' && L < MAXL && L > 280) L = 280; out.push([v, v + L]); v += L; } return out; };
  for (const [x, a] of cuts(x0, x1)) for (const [y, c] of cuts(y0, y1)) {
    out.push({ asset: MB, ...b, size: [(a - x) / 2, (c - y) / 2, (z1 - z0) / 2], position: [(x + a) / 2, (y + c) / 2, BASE + (z0 + z1) / 2] });
  }
};
const pole = (x, y, z0, z1, rr, b) => out.push({ asset: 'PB_DefaultPole', ...b, size: [rr, rr, (z1 - z0) / 2], position: [x, y, BASE + (z0 + z1) / 2] });
const ground = (x0, y0, x1, y1) => { // sand + pad under a strip, in blocks of at most 280
  for (let x = x0; x < x1; x += 280) for (let y = y0; y < y1; y += 280) {
    const a = Math.min(x1, x + 280), b = Math.min(y1, y + 280);
    box(x, y, -12 - PAD_H, a, b, -12, { asset: 'PB_DefaultBrick', color: [190, 172, 128] });
    box(x, y, -12, a, b, 0, { asset: 'PB_DefaultBrick', color: [214, 196, 142] });
  }
};
const Y0 = rowY(0), Y1 = rowY(ROWS - 1) + STREET_D;
const ROAD = [58, 58, 62], WALK = [196, 194, 188], LAMP = { color: [60, 62, 66], material: 'BMC_Metallic' };
const W = { color: [240, 240, 236] }, YEL = { color: [236, 196, 50] };
const light = (x, y, dir, green) => { // a traffic light: pole on the corner, arm out over the road (dir = +-1 in x), three lamps
  pole(x, y, 8, 140, 4, LAMP);
  box(dir > 0 ? x - 2 : x - 92, y - 3, 140, dir > 0 ? x + 92 : x + 2, y + 3, 146, LAMP);
  const hx = x + dir * 80;
  box(hx - 8, y - 6, 106, hx + 8, y + 6, 140, { color: [30, 30, 32] });
  [[[255, 40, 30], !green], [[255, 190, 40], false], [[60, 255, 90], green]].forEach(([col, on], k) =>
    box(hx - 6, y - 8, 130 - k * 10, hx + 6, y - 6, 138 - k * 10, on ? { color: col, material: 'BMC_Glow', material_intensity: 6 } : { color: col.map(v => Math.round(v * 0.25)) }));
};
for (let c = 0; c + 1 < COLS; c++) {
  const ax0 = colX(c) + STREET_W / 2, ax1 = ax0 + AVE, rx0 = ax0 + 40, rx1 = ax1 - 40, mid = (ax0 + ax1) / 2;
  ground(ax0, Y0, ax1, Y1);
  box(rx0, Y0, 0, rx1, Y1, 4, { color: ROAD });
  // pavements both sides, broken where a street road crosses (the kerb would block it)
  const roads = [...Array(ROWS).keys()].map(roadBand), walks = [...Array(ROWS).keys()].map(walkBand);
  for (const [px0, px1] of [[ax0, rx0], [rx1, ax1]]) {
    let y = Y0;
    for (const [r0, r1] of roads) { box(px0, y, 0, px1, r0, 8, { asset: TILE, color: WALK }); box(px0, r0, 0, px1, r1, 4, { color: ROAD }); y = r1; }
    box(px0, y, 0, px1, Y1, 8, { asset: TILE, color: WALK });
  }
  // markings, broken at each crossing (street road + its pavement band + a stop-line margin)
  const gaps = roads.map(([r0, r1], i) => { const [w0, w1] = walks[i]; return [Math.min(r0, w0) - 30, Math.max(r1, w1) + 30]; }).sort((p, q) => p[0] - q[0]);
  const runs = []; let y = Y0;
  for (const [g0, g1] of gaps) { if (g0 > y) runs.push([y, g0]); y = Math.max(y, g1); }
  if (y < Y1) runs.push([y, Y1]);
  for (const [y0, y1] of runs) {
    box(mid - 10, y0, 4, mid - 6, y1, 6, YEL); box(mid + 6, y0, 4, mid + 10, y1, 6, YEL);   // double yellow
    for (const lx of [mid - 80, mid + 80]) for (let yy = y0 + 20; yy + 40 <= y1 - 10; yy += 100) box(lx - 2, yy, 4, lx + 2, yy + 40, 6, W); // lane lines
  }
  for (const [g0, g1] of gaps) {
    box(rx0 + 6, g0 + 6, 4, mid - 14, g0 + 14, 6, W);                      // stop line, lanes driving +y (west half)
    box(mid + 14, g1 - 14, 4, rx1 - 6, g1 - 6, 6, W);                      // stop line, lanes driving -y (east half)
  }
  for (const [w0, w1] of walks) for (let x = rx0 + 10; x + 20 <= rx1 - 10; x += 40) box(x, w0 + 6, 4, x + 20, w1 - 6, 6, W); // zebra
  // traffic lights on two corners of every crossing: green for the avenue, red for the street
  for (const [g0, g1] of gaps) { light(ax0 + 16, g0 + 2, 1, true); light(ax1 - 16, g1 - 2, -1, true); }
  // lamp posts on both pavements, clear of the crossings
  for (let y = Y0 + 200; y < Y1 - 100; y += 400) {
    if (gaps.some(([g0, g1]) => y > g0 - 60 && y < g1 + 60)) continue;
    for (const [px, dir] of [[ax0 + 14, 1], [ax1 - 14, -1]]) {
      pole(px, y, 8, 108, 3, LAMP);
      box(dir > 0 ? px - 2 : px - 38, y - 2, 108, dir > 0 ? px + 38 : px + 2, y + 2, 112, LAMP);
      box(dir > 0 ? px + 26 : px - 42, y - 8, 100, dir > 0 ? px + 42 : px - 26, y + 8, 108, { color: [255, 236, 190], material: 'BMC_Glow', material_intensity: 5 });
    }
  }
}
// boulevard medians: the sand strips between the roads of facing rows (local y 40..100 of both
// streets) get grass, a low kerb and a row of trees
const TREE_G = [[58, 120, 48], [70, 136, 56], [52, 108, 60]];
for (let r = 1; r + 1 < ROWS; r += 2) {
  const m0 = roadBand(r)[1], m1 = roadBand(r + 1)[0];
  for (let c = 0; c < COLS; c++) {
    const x0 = colX(c) - STREET_W / 2, x1 = colX(c) + STREET_W / 2;
    box(x0, m0, 0, x1, m1, 8, { asset: 'PB_DefaultBrick', color: [96, 160, 70] }); // 8 tall: a brick's half height must be even
    for (let x = x0 + 160, k = 0; x < x1 - 100; x += 320, k++) {
      pole(x, (m0 + m1) / 2, 8, 78, 10, { color: [92, 64, 40] });
      let z = 78;
      const g = TREE_G[(r * 7 + c * 3 + k) % 3];
      for (const [rr, t] of [[34, 1], [46, 2], [40, 2], [24, 1]]) { pole(x, (m0 + m1) / 2, z, z + t * 12, rr, { color: g }); z += t * 12; }
    }
  }
}
write(out);
fs.writeFileSync(join(OUT, 'suburb.json'), JSON.stringify({ cols: COLS, rows: ROWS, seed: SEED, streets: COLS * ROWS, chunks: n, bricks: total, base: BASE, avenues: COLS - 1 }));
console.log(JSON.stringify({ streets: COLS * ROWS, bricks: total, out: OUT }));
