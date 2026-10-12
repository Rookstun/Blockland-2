// sewer.mjs: a procedural sewer under the town's spawn (owner 2026-10-12: "just make a sewer
// system under spawn ... proc gen"). Used by town2.mjs on its 20-unit cell grid.
//
// Tunnels follow the streets within RADIUS of spawn (under the asphalt: never under a lot), plus a
// trunk along the nearest main road out to an outfall in the sea. A tunnel is a sewage channel
// (40) between walkways (to 60 from the axis), concrete walls to 80, a micro-brick ceiling and
// lights. Chambers where lines meet, side rooms of random kinds (storage, a lair, a pump room, a
// shrine), rats, and stairways down from the surface: a covered passage at walkway level under the
// road and pavement, then 8 open steps up to the lawn with a rail round the pit.
// Heights (relative to the town's ground top BASE): the pad is -108..-12 (sea level is just below
// -108), sand -12..0. Walkway top -92, ceiling -20..-12: 72 clear, a door's height.
export const SEW = { NONE: 0, CHANNEL: 1, WALK: 2, WALL: 3, ROOM: 4, PASSAGE: 5, OPEN: 7, RAIL: 8 };
const Z = { bottom: -108, walk: -92, ceil: -20, top: -12 };

export function planSewer(T, { spawn = [0, 0], radius = 2800, seed = 1 } = {}) {
  const { cls, ci, cx, cy, NX, NY, C, roads, K } = T; // K: the town's cell classes
  let rs = seed * 7919 + 17;
  const rand = () => { rs = Math.imul(rs ^ (rs >>> 13), 1597334677) + 0x6D2B79F5 | 0; return ((rs ^ (rs >>> 16)) >>> 0) / 4294967296; };
  const sew = new Uint8Array(NX * NY), lineOf = new Int16Array(NX * NY).fill(-1);
  const blocked = i => i < 0 || cls[i] === K.LOT || cls[i] === K.TOWER;
  const discOk = (x, y, r) => { const n = Math.ceil(r / C); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) if (a * a + b * b <= n * n && blocked(ci(x + a * C, y + b * C))) return false; return true; };
  const stamp = (x, y, r, k, line, over) => { const n = Math.ceil(r / C); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    if (Math.hypot(a * C, b * C) > r) continue; const i = ci(x + a * C, y + b * C); if (i < 0 || cls[i] === K.SEA) continue;
    if (over.includes(sew[i])) { sew[i] = k; if (line >= 0) lineOf[i] = line; } } };
  // the lines: runs of each road inside the radius (the trunk: the main road nearest spawn, all the way to the shore)
  const d0 = p => Math.hypot(p[0] - spawn[0], p[1] - spawn[1]);
  const mains = roads.filter(r => r.main), trunk = mains.reduce((a, b) => (Math.min(...b.pts.map(d0)) < Math.min(...a.pts.map(d0)) ? b : a));
  const lines = [];
  for (const road of roads) {
    let run = [];
    const flush = () => { if (run.length > 6) lines.push({ road, pts: run }); run = []; };
    for (const p of road.pts) { if (road === trunk || d0(p) < radius) run.push(p); else flush(); }
    flush();
  }
  // sample every 10 and keep the feasible stretches (clear of lots by a margin)
  const samples = [];
  lines.forEach((ln, li) => { let cur = [];
    for (let k = 0; k + 1 < ln.pts.length; k++) { const [ax, ay] = ln.pts[k], [bx, by] = ln.pts[k + 1], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let t = 0; t < L; t += 10) { const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L, i = ci(x, y);
        if (i >= 0 && cls[i] !== K.SEA && discOk(x, y, 100)) cur.push([x, y, Math.atan2(by - ay, bx - ax)]); else { if (cur.length > 20) samples.push({ li, s: cur }); cur = []; } } }
    if (cur.length > 20) samples.push({ li, s: cur }); });
  for (const pass of [[80, SEW.WALL, [0]], [60, SEW.WALK, [0, SEW.WALL]], [20, SEW.CHANNEL, [0, SEW.WALL, SEW.WALK]]])
    for (const { li, s } of samples) for (const [x, y] of s) stamp(x, y, pass[0], pass[1], li, pass[2]);
  // chambers where two lines meet, and at the dead ends
  const chambers = [];
  for (const { li, s } of samples) {
    for (let n = 0; n < s.length; n += 3) { const [x, y] = s[n], i = ci(x, y);
      let hit = false; for (let a = -4; a <= 4 && !hit; a++) for (let b = -4; b <= 4; b++) { const q = ci(x + a * C, y + b * C); if (q >= 0 && sew[q] === SEW.CHANNEL && lineOf[q] !== li && lineOf[q] >= 0) { hit = true; break; } }
      if (hit && discOk(x, y, 190) && !chambers.some(c => Math.hypot(c[0] - x, c[1] - y) < 400)) chambers.push([x, y, 150]); }
    for (const e of [s[0], s[s.length - 1]]) if (discOk(e[0], e[1], 130) && !chambers.some(c => Math.hypot(c[0] - e[0], c[1] - e[1]) < 300)) chambers.push([e[0], e[1], 100]);
  }
  for (const [x, y, r] of chambers) { stamp(x, y, r + 20, SEW.WALL, -1, [0]); stamp(x, y, r, SEW.ROOM, -1, [0, SEW.WALL, SEW.WALK, SEW.CHANNEL]); stamp(x, y, 40, SEW.CHANNEL, -1, [SEW.ROOM]); }
  // side rooms off the tunnels
  const all = samples.flatMap(o => o.s), rooms = [];
  const KINDS = ['storage', 'lair', 'pump', 'shrine', 'storage', 'lair'];
  const rectOk = (x0, y0, x1, y1) => { for (let y = y0 + C / 2; y < y1; y += C) for (let x = x0 + C / 2; x < x1; x += C) { const i = ci(x, y); if (blocked(i) || cls[i] === K.SEA || (sew[i] !== 0 && sew[i] !== SEW.WALL)) return false; } return true; };
  const setRect = (x0, y0, x1, y1, k, over) => { for (let y = y0 + C / 2; y < y1; y += C) for (let x = x0 + C / 2; x < x1; x += C) { const i = ci(x, y); if (i >= 0 && over.includes(sew[i])) sew[i] = k; } };
  const snap = v => Math.round(v / C) * C;
  for (let tries = 0; tries < 400 && rooms.length < 6; tries++) {
    const [x, y, h] = all[Math.floor(rand() * all.length)], side = rand() < 0.5 ? -1 : 1;
    const nx = -Math.sin(h) * side, ny = Math.cos(h) * side, d = Math.abs(nx) > Math.abs(ny) ? [Math.sign(nx), 0] : [0, Math.sign(ny)];
    const Wd = 200, Dp = 180, off = 100; // room: off .. off + Dp out from the axis, Wd wide
    const ax = snap(x), ay = snap(y);
    const r = d[0] ? (d[0] > 0 ? [ax + off, ay - Wd / 2, ax + off + Dp, ay + Wd / 2] : [ax - off - Dp, ay - Wd / 2, ax - off, ay + Wd / 2])
                   : (d[1] > 0 ? [ax - Wd / 2, ay + off, ax + Wd / 2, ay + off + Dp] : [ax - Wd / 2, ay - off - Dp, ax + Wd / 2, ay - off]);
    const ring = [r[0] - 20, r[1] - 20, r[2] + 20, r[3] + 20];
    if (!rectOk(...ring) || rooms.some(o => Math.hypot(o.c[0] - (r[0] + r[2]) / 2, o.c[1] - (r[1] + r[3]) / 2) < 600)) continue;
    setRect(...ring, SEW.WALL, [0]); setRect(...r, SEW.ROOM, [0, SEW.WALL]);
    // the doorway, 40 wide, from the walkway through the wall
    const door = d[0] ? [Math.min(ax + d[0] * 50, ax + d[0] * off), ay - 20, Math.max(ax + d[0] * 50, ax + d[0] * off), ay + 20]
                      : [ax - 20, Math.min(ay + d[1] * 50, ay + d[1] * off), ax + 20, Math.max(ay + d[1] * 50, ay + d[1] * off)];
    setRect(...door, SEW.ROOM, [SEW.WALL, 0]);
    rooms.push({ r, c: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], kind: KINDS[rooms.length % KINDS.length], d });
  }
  // stairways down from the surface: a covered passage to beyond the pavement, then 8 open steps
  const stairs = [];
  for (let tries = 0; tries < 600 && stairs.length < 3; tries++) {
    const [x, y, h] = all[Math.floor(rand() * all.length)];
    if (Math.hypot(x - spawn[0], y - spawn[1]) > radius * 0.6) continue;
    const side = rand() < 0.5 ? -1 : 1, nx = -Math.sin(h) * side, ny = Math.cos(h) * side;
    const d = Math.abs(nx) > Math.abs(ny) ? [Math.sign(nx), 0] : [0, Math.sign(ny)], lat = [Math.abs(d[1]), Math.abs(d[0])];
    const ax = snap(x), ay = snap(y);
    // how far the road and pavement reach along d (the passage stays covered under them)
    let tOpen = 60; for (; tOpen < 400; tOpen += C) { const i = ci(ax + d[0] * (tOpen + 10), ay + d[1] * (tOpen + 10)); if (i < 0 || (cls[i] !== K.ROAD && cls[i] !== K.PAVE)) break; }
    tOpen += 20; const tEnd = tOpen + 180;
    const cells = (t0, t1, w) => { const out = []; for (let t = t0; t < t1; t += C) for (let a = -w / 2; a < w / 2; a += C) out.push(ci(ax + d[0] * (t + C / 2) + lat[0] * (a + C / 2), ay + d[1] * (t + C / 2) + lat[1] * (a + C / 2))); return out; };
    const shell = cells(60, tEnd + 20, 120); // stair 80 wide (on the 20 grid), walls round it
    if (shell.some(i => blocked(i) || cls[i] === K.SEA || (sew[i] !== 0 && sew[i] !== SEW.WALL && sew[i] !== SEW.WALK && sew[i] !== SEW.CHANNEL))) continue;
    if (cells(tOpen, tEnd, 80).some(i => cls[i] === K.ROAD || cls[i] === K.PAVE)) continue;
    if (stairs.some(o => Math.hypot(o.ax - ax, o.ay - ay) < 900)) continue;
    for (const i of shell) if (sew[i] === 0) sew[i] = SEW.WALL;
    for (const i of cells(60, tOpen, 80)) if (sew[i] !== SEW.CHANNEL) sew[i] = SEW.PASSAGE;
    for (const i of cells(tOpen, tEnd, 80)) sew[i] = SEW.OPEN;
    stairs.push({ ax, ay, d, lat, tOpen, tEnd });
  }
  // rails round each pit (not across its top end), on the surface cells next to it
  for (const s of stairs) for (let t = s.tOpen - C; t < s.tEnd; t += C) for (let a = -60; a < 60; a += C) { // the rail ring sits in the shell (120 wide)
    const i = ci(s.ax + s.d[0] * (t + C / 2) + s.lat[0] * (a + C / 2), s.ay + s.d[1] * (t + C / 2) + s.lat[1] * (a + C / 2));
    if (i < 0 || sew[i] === SEW.OPEN) continue;
    let near = false; for (const q of [i - 1, i + 1, i - NX, i + NX]) if (sew[q] === SEW.OPEN) near = true;
    if (near) sew[i] = sew[i] === SEW.WALL || sew[i] === 0 ? SEW.RAIL : sew[i];
  }
  // rats on the walkways; lights on the ceiling
  const rats = [], lights = [];
  for (let i = 0; i < NX * NY; i++) {
    if (sew[i] === SEW.WALK && rand() < 0.0035) rats.push([cx(i), cy(i), rand() < 0.5 ? 0 : 2]);
    if ((sew[i] === SEW.WALK || sew[i] === SEW.ROOM) && (i % NX) % 9 === 0 && Math.floor(i / NX) % 9 === 0) lights.push([cx(i), cy(i)]);
  }
  return { sew, lines: samples.length, chambers, rooms, stairs, rats, lights, trunkId: trunk.id };
}

// the bricks; box/pole as in town2 (z relative to the ground top), rects = town2's greedy cell rectangles
export function buildSewer(P, { box, pole, add, rects, cls, ci, K }) {
  const { sew } = P, S = SEW;
  const CON = { asset: 'PB_DefaultBrick', color: [128, 128, 124] }, DARK = { asset: 'PB_DefaultBrick', color: [96, 96, 92] };
  for (const r of rects(k => sew[k] === S.WALL || sew[k] === S.RAIL, 14)) box(r[0], r[1], Z.bottom, r[2], r[3], Z.top, CON, 'sewer wall');
  for (const r of rects(k => sew[k] === S.WALK || sew[k] === S.ROOM || sew[k] === S.PASSAGE, 14)) box(r[0], r[1], Z.bottom, r[2], r[3], Z.walk, DARK, 'sewer walkway');
  for (const r of rects(k => sew[k] === S.CHANNEL, 14)) {
    box(r[0], r[1], Z.bottom, r[2], r[3], Z.bottom + 4, { asset: 'PB_DefaultBrick', color: [70, 72, 66] }, 'sewer bed');
    box(r[0], r[1], Z.bottom + 4, r[2], r[3], Z.bottom + 6, { color: [86, 110, 64], material: 'BMC_Glass' }, 'sewage');
  }
  for (const r of rects(k => sew[k] === S.CHANNEL || sew[k] === S.WALK || sew[k] === S.ROOM || sew[k] === S.PASSAGE, 25)) box(r[0], r[1], Z.ceil, r[2], r[3], Z.top, { color: [110, 110, 106] }, 'sewer ceiling');
  for (const [x, y] of P.lights) box(x - 6, y - 6, Z.ceil - 4, x + 6, y + 6, Z.ceil, { color: [255, 226, 160], material: 'BMC_Glow', material_intensity: 4 }, 'sewer light');
  for (const [x, y, rot] of P.rats) add({ asset: 'B_Rat', size: [0, 0, 0], direction: 4, rotation: rot, color: [90, 80, 74], position: [x, y, Z.walk + 6] }, 'rat');
  // stairs: open steps (8 x 12 up to the lawn), the passage is walkway-level; rails round the pit
  for (const s of P.stairs) {
    for (let n = 0; n < 9; n++) {
      const t0 = s.tOpen + n * 20, t1 = n === 8 ? s.tEnd : t0 + 20, top = Math.min(Z.walk + 12 * (n + 1), 4);
      const pts = [[t0, -40], [t1, 40]].map(([t, a]) => [s.ax + s.d[0] * t + s.lat[0] * a, s.ay + s.d[1] * t + s.lat[1] * a]);
      box(Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Z.bottom, Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1]), top, { asset: 'PB_DefaultBrick', color: [140, 138, 132] }, 'sewer step');
    }
  }
  for (const onPave of [true, false]) for (const r of rects(k => sew[k] === S.RAIL && (cls[k] === K.PAVE) === onPave, 14)) {
    const top = onPave ? 8 : 4; // pavement is 8 high, everything else 4
    box(r[0] + 6, r[1] + 6, top, r[2] - 6, r[3] - 6, top + 32, { color: [60, 62, 66], material: 'BMC_Metallic' }, 'pit rail'); // a low metal parapet
  }
  // drain grates on the road over each chamber
  for (const [x, y] of P.chambers) { const i = ci(x, y); if (i >= 0 && cls[i] === K.ROAD) { const X = Math.round(x / 10) * 10, Y = Math.round(y / 10) * 10; box(X - 20, Y - 20, 4, X + 20, Y + 20, 6, { color: [40, 40, 42], material: 'BMC_Metallic' }, 'drain grate'); } }
  // side rooms
  const GLOW = (c, i = 4) => ({ color: c, material: 'BMC_Glow', material_intensity: i });
  for (const o of P.rooms) {
    const [x0, y0, x1, y1] = o.r, w = Z.walk;
    if (o.kind === 'storage') { for (const [a, b] of [[x0 + 20, y0 + 20], [x0 + 60, y0 + 20], [x1 - 60, y1 - 60], [x0 + 20, y1 - 60]]) { box(a, b, w, a + 36, b + 36, w + 24, { color: [140, 104, 66] }, 'crate'); box(a + 6, b + 6, w + 24, a + 30, b + 30, w + 44, { color: [160, 120, 76] }, 'crate'); } }
    if (o.kind === 'lair') { box(x0 + 20, y0 + 20, w, x0 + 100, y0 + 60, w + 8, { color: [120, 60, 60] }, 'mattress'); box(x1 - 50, y1 - 50, w, x1 - 20, y1 - 20, w + 18, { color: [90, 70, 50] }, 'stool');
      for (const [a, b] of [[x1 - 40, y0 + 30], [x0 + 40, y1 - 40], [x1 - 80, y1 - 30]]) { pole(a, b, w, w + 10, 3, { color: [200, 190, 170] }, 'mushroom stem'); pole(a, b, w + 10, w + 16, 9, GLOW([120, 255, 200], 5), 'mushroom cap'); } }
    if (o.kind === 'pump') { box(x0 + 40, y0 + 40, w, x1 - 40, y1 - 40, w + 36, { color: [70, 90, 110], material: 'BMC_Metallic' }, 'pump');
      box(x0 + 60, y0 + 60, w + 36, x0 + 80, y0 + 80, Z.ceil, { color: [90, 90, 92], material: 'BMC_Metallic' }, 'pipe'); box(x1 - 70, y0 + 50, w + 36, x1 - 50, y0 + 70, w + 48, GLOW([255, 80, 40], 4), 'pump lamp'); }
    if (o.kind === 'shrine') { box((x0 + x1) / 2 - 40, y0 + 20, w, (x0 + x1) / 2 + 40, y0 + 50, w + 24, { color: [80, 76, 70] }, 'altar');
      for (const a of [-30, 0, 30]) pole((x0 + x1) / 2 + a, y0 + 35, w + 24, w + 34, 2, GLOW([255, 200, 120], 5), 'candle'); }
  }
}
