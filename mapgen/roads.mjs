// City roads (2026-10-26, owner: "make them realistic. traffic lights, traffic signs, stop signs, yield ... as if
// you were trying to emulate the real world for a driver's test ... streetlights with working lights ... curbs ...
// intersections, highways, off-ramps ... split roads with trees in the middle. all depending on the income").
// Replaces the copy of the owner's plain road tiles with a painted surface at the same size (1 stud = 1 ft:
// 24 ft of asphalt = two 12 ft lanes, 4 ft sidewalks), US conventions (MUTCD), traffic driving on the RIGHT.
// LEFT-HANDED world: facing +x the right hand is +y (right(d) = (-dy, dx)).
//   surface   asphalt z 0..4 (smooth tile), markings flush in it (micro bricks), 1 ft concrete gutter pan along
//             every curb, 6 in curb + 40-unit sidewalk slabs z 0..8 (alternating tone = scored joints, pieces <= 40 so
//             the driveway curb cuts keep working), worn / patched asphalt and faded paint on poor streets
//   markings  double solid yellow centre (collectors, arterials), single dashed yellow on rural locals (10 ft dash,
//             30 ft gap) with a no-passing double approaching intersections, solid white edge lines; one-way
//             ramps: yellow left edge, white right edge
//   medians   income >= 0.62: raised planted median with trees (10 ft lanes), yellow left edge lines
//   control   urban crossings + freeway terminals: signals (signals.mjs prefab, wired); suburban crossings:
//             ALL-WAY stop; rural crossings: two-way stop on the minor street; T stems: STOP (YIELD in the country)
//   per leg   stop bar 4 ft before a crosswalk (continental at signals, two-line at stops), curb ramps with
//             yellow tactile pads, signs on the right-hand side, STOP AHEAD on rural approaches, curve warnings
//   lights    every 2 / 3 / 4 tiles by income: decorative acorn posts (LED white, both sides) / steel cobra heads
//             (sodium orange, staggered) / cobra heads on wooden utility poles (one side); each head a
//             Component_SpotLight pointing down + a small Component_PointLight glow on the lens
//   names     green blades at every junction, mast-arm blades at signals; speed limit signs on every run
import { plaque } from './ruins.mjs';

export const DIRS = { E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] };
const SIDE_OF = { '1,0': 'E', '-1,0': 'W', '0,1': 'N', '0,-1': 'S' };
export const right = ([dx, dy]) => [-dy, dx];
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const DIR4 = { direction: 4, rotation: 0 };
const BUNGEE = 5; // ruins EXTERNAL_ASSETS index
const TXT = (color, lh, extra = {}) => ({ Font: BUNGEE, LineHeight: lh, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, OutlineWidth: 0, Outline: 0, ...extra });
export const STREET_NAMES = {
  ew: ['Gravy Ave', 'Moxie Ave', 'Crumpet Rd', 'Lard Blvd', 'Mild Peril Ln', 'Second Best Ave', 'Dubious Ave', 'Meat St', 'Sternly Rd', 'Elbow Ave', 'Ooze Blvd', 'Trouser Ln'],
  ns: n => `${n + 1}${n % 10 === 0 && n !== 10 ? 'st' : n % 10 === 1 && n !== 11 ? 'nd' : n % 10 === 2 && n !== 12 ? 'rd' : 'th'} St`,
};

/** tiles: road set (+ extra tiles from the freeway plan) -> network of tiles, nodes, runs */
export function roadNetwork({ road, extra = new Map(), OX, OY, T, F }) {
  const tiles = new Map();
  const keys = new Set([...road, ...extra.keys()]);
  for (const k of keys) {
    const [tx, ty] = k.split(',').map(Number), x = extra.get(k) ?? {};
    const open = Object.entries(DIRS).filter(([s, [dx, dy]]) => keys.has(tx + dx + ',' + (ty + dy)) || x.portal?.includes(s)).map(([s]) => s);
    tiles.set(k, { k, tx, ty, cx: OX + tx * T + T / 2, cy: OY + ty * T + T / 2, open, ramp: !!x.ramp, oneway: x.oneway ?? null, cls: x.cls ?? null,
      portal: x.portal ?? [], signal: !!x.signal, name: x.name ?? null });
  }
  const straight = t => t.open.length === 2 && (t.open.join() === 'E,W' || t.open.join() === 'W,E' || t.open.join() === 'N,S' || t.open.join() === 'S,N');
  const nodes = new Map(), runs = [];
  for (const t of tiles.values()) if (!straight(t)) nodes.set(t.k, t);
  const seen = new Set();
  for (const n of nodes.values()) for (const s of n.open) {
    if (n.portal.includes(s)) continue;
    const [dx, dy] = DIRS[s], list = [];
    let tx = n.tx + dx, ty = n.ty + dy, end = null;
    for (;;) {
      const t = tiles.get(tx + ',' + ty);
      if (!t) break;
      if (nodes.has(t.k)) { end = t; break; }
      list.push(t);
      if (t.portal.length && !tiles.has(tx + dx + ',' + (ty + dy))) break; // runs off into the freeway's own geometry
      tx += dx; ty += dy;
    }
    if (!list.length) continue;
    const id = [n.k, end?.k ?? list.at(-1).k].sort().join('|') + '|' + s.replace('W', 'E').replace('S', 'N');
    if (seen.has(id)) continue;
    seen.add(id);
    const axis = dx ? 'x' : 'y', sgn = dx || dy;
    const a = list[0], b = list.at(-1);
    const c = axis === 'x' ? a.cy : a.cx;
    const lo = Math.min(axis === 'x' ? a.cx : a.cy, axis === 'x' ? b.cx : b.cy) - T / 2, hi = Math.max(axis === 'x' ? a.cx : a.cy, axis === 'x' ? b.cx : b.cy) + T / 2;
    const mid = list[list.length >> 1];
    const forced = list.find(t => t.cls)?.cls;
    const dens = F.density(mid.cx, mid.cy);
    runs.push({ axis, c, s0: lo, s1: hi, tiles: list, from: sgn > 0 ? n : end, to: sgn > 0 ? end : n, oneway: a.oneway, ramp: a.ramp,
      cls: forced ?? { urban: 'arterial', suburb: 'collector', rural: 'local' }[dens], dens, inc: F.income(mid.cx, mid.cy),
      line: axis === 'x' ? 'ew' + a.ty : 'ns' + a.tx, name: list.find(t => t.name)?.name ?? null });
  }
  for (const t of tiles.values()) t.run = null;
  for (const r of runs) for (const t of r.tiles) t.run = r;
  // a node's legs: one per open side, the run it leads into (portal legs have none)
  for (const n of nodes.values()) n.legs = n.open.map(s => {
    const v = DIRS[s], nb = tiles.get(n.tx + v[0] + ',' + (n.ty + v[1]));
    const run = nb?.run ?? (nb && nodes.has(nb.k) ? null : null);
    const ow = run?.oneway ?? nb?.oneway ?? null; // travel direction on a one-way leg
    return { s, v, run, nb, inbound: !ow || (ow[0] === -v[0] && ow[1] === -v[1]), outbound: !ow || (ow[0] === v[0] && ow[1] === v[1]) };
  });
  return { tiles, nodes, runs, OX, OY };
}

/** what controls each node and its legs (mutates nodes: n.control, leg.control) */
export function assignControl(net, F) {
  const rank = { arterial: 3, collector: 2, local: 1, ramp: 4, freeway: 5 };
  for (const n of net.nodes.values()) {
    const dens = F.density(n.cx, n.cy), legs = n.legs.filter(l => l.nb);
    n.control = 'none';
    for (const l of n.legs) l.control = 'none';
    if (legs.length === 2) { n.control = 'curve'; continue; }
    if (legs.length < 2) continue;
    const cls = l => l.run?.cls ?? l.nb?.cls ?? 'local';
    if (n.signal || n.legs.some(l => l.nb?.signal) || (dens === 'urban' && (legs.length === 4 || legs.some(l => cls(l) === 'arterial')))) {
      n.control = 'signal';
      for (const l of legs) l.control = l.inbound ? 'signal' : 'out';
      continue;
    }
    if (legs.length === 4) {
      if (dens === 'suburb') { n.control = 'allway'; for (const l of legs) l.control = 'stop'; continue; }
      // rural: the minor street stops (the E-W frontage streets carry the lots, so N-S stops on a tie)
      const ax = l => (l.v[0] ? 'x' : 'y');
      const best = Math.max(...legs.map(cls).map(c => rank[c]));
      const major = legs.filter(l => rank[cls(l)] === best).map(ax);
      const majAx = major.includes('x') ? 'x' : 'y';
      n.control = 'twoway';
      for (const l of legs) l.control = ax(l) === majAx ? 'none' : 'stop';
      continue;
    }
    // T: the stem is the leg opposite the closed side
    const closed = Object.keys(DIRS).find(s => !n.open.includes(s));
    const stemS = { E: 'W', W: 'E', N: 'S', S: 'N' }[closed];
    n.control = dens === 'rural' ? 'yield' : 'stop';
    for (const l of legs) l.control = l.s === stemS && l.inbound ? n.control : 'none';
  }
}

// ---------------------------------------------------------------- surface --
/** paint every tile: base raster (asphalt / sidewalk / grass) + gutters, curbs, markings, ramps; emits bricks */
export function roadSurface(B, net, { T, F, rnd }) {
  const ov = new Map(); // tile key -> overlays [{x0,y0,x1,y1, on:'asph'|'walk'|'any', kind, color}]
  const tileOf = (x, y) => net.tiles.get(Math.floor((x - net.OX) / T) + ',' + Math.floor((y - net.OY) / T));
  const overlay = (x0, y0, x1, y1, on, kind, color) => {
    if (x1 <= x0 || y1 <= y0) return;
    for (let tx = Math.floor((x0 - net.OX) / T); tx * T + net.OX < x1; tx++) for (let ty = Math.floor((y0 - net.OY) / T); ty * T + net.OY < y1; ty++) {
      const t = net.tiles.get(tx + ',' + ty);
      if (!t) continue;
      const bx0 = net.OX + tx * T, by0 = net.OY + ty * T;
      const r = { x0: Math.max(x0, bx0), y0: Math.max(y0, by0), x1: Math.min(x1, bx0 + T), y1: Math.min(y1, by0 + T), on, kind, color };
      if (r.x1 > r.x0 && r.y1 > r.y0) (ov.get(t.k) ?? ov.set(t.k, []).get(t.k)).push(r);
    }
  };
  // (s, t) along a run -> world rect
  const runRect = (run, s0, s1, t0, t1) => run.axis === 'x' ? [s0, run.c + t0, s1, run.c + t1] : [run.c + t0, s0, run.c + t1, s1];
  const paint = (run, s0, s1, t0, t1, color, on = 'asph', kind = 'paint') => { const [a, b, c, d] = runRect(run, Math.min(s0, s1), Math.max(s0, s1), Math.min(t0, t1), Math.max(t0, t1)); overlay(a, b, c, d, on, kind, color); };
  const stats = { medians: 0, crosswalks: 0, stopbars: 0, yieldlines: 0, ramps: 0 };
  const colorsFor = inc => {
    const fade = Math.max(0, Math.min(0.5, (0.5 - inc) * 1.2));
    return { white: mix([238, 238, 232], [150, 150, 146], fade), yellow: mix([240, 186, 36], [150, 128, 72], fade),
      asph: inc >= 0.62 ? [30, 30, 33] : inc >= 0.35 ? [42, 42, 44] : [56, 56, 58] };
  };
  // ---- runs: centre lines, edge lines, medians
  const medians = [];
  for (const run of net.runs) {
    const P = colorsFor(run.inc), { s0, s1 } = run;
    if (run.ramp) { // one-way ramp: yellow left edge, white right edge (relative to travel)
      const sg = (run.oneway[0] || run.oneway[1]) * (run.axis === 'x' ? 1 : -1); // t sign of the travel's right side
      paint(run, s0, s1, sg * 104, sg * 108, P.white); paint(run, s0, s1, -sg * 104, -sg * 108, P.yellow);
      continue;
    }
    paint(run, s0, s1, 104, 108, P.white); paint(run, s0, s1, -104, -108, P.white);
    const len = s1 - s0, boulevard = run.inc >= 0.62 && len >= 3 * T && run.cls !== 'ramp';
    const mS0 = s0 + T, mS1 = s1 - T;
    const dbl = (a, b) => { paint(run, a, b, 4, 8, P.yellow); paint(run, a, b, -4, -8, P.yellow); };
    if (boulevard) {
      dbl(s0, mS0); dbl(mS1, s1);
      paint(run, mS0, mS1, 20, 24, P.yellow); paint(run, mS0, mS1, -20, -24, P.yellow);
      paint(run, mS0, mS1, -20, 20, null, 'asph', 'skip');
      medians.push({ run, s0: mS0, s1: mS1 });
    } else if (run.cls === 'local' && len > 900) { // passing allowed in the middle, no-passing approaching nodes
      dbl(s0, s0 + 300); dbl(s1 - 300, s1);
      for (let s = s0 + 300 + 100; s + 100 <= s1 - 300; s += 400) paint(run, s, s + 100, -2, 2, P.yellow);
    } else dbl(s0, s1);
    if (run.inc < 0.35) for (const t of run.tiles) { // worn streets: patches and cracks
      if (rnd() < 0.55) { const w = 40 + Math.floor(rnd() * 5) * 20, d = 30 + Math.floor(rnd() * 4) * 20, px = t.cx - 100 + Math.floor(rnd() * 10) * 20, py = t.cy - 100 + Math.floor(rnd() * 10) * 20;
        overlay(px, py, px + w, py + d, 'asph', 'patch', [34, 34, 36]); }
      if (rnd() < 0.5) { const along = rnd() < 0.5, l = 60 + Math.floor(rnd() * 5) * 20, px = t.cx - 90 + Math.floor(rnd() * 9) * 20, py = t.cy - 90 + Math.floor(rnd() * 9) * 20;
        overlay(px, py, px + (along ? l : 2), py + (along ? 2 : l), 'asph', 'patch', [76, 76, 78]); }
    }
  }
  // ---- node approaches: crosswalks, stop bars, yield lines, curb ramps
  for (const n of net.nodes.values()) {
    if (!['signal', 'allway', 'twoway', 'stop', 'yield'].includes(n.control)) continue;
    const dens = F.density(n.cx, n.cy), P = colorsFor(F.income(n.cx, n.cy));
    for (const l of n.legs) {
      if (!l.nb || l.nb.ramp && n.control !== 'signal') continue;
      const run = l.run;
      if (!run) continue;
      const axis = l.v[0] ? 'x' : 'y', far = (axis === 'x' ? n.cx : n.cy) + (l.v[0] || l.v[1]) * T / 2; // node tile edge
      const sv = l.v[0] || l.v[1], S = d => far + sv * d; // distance into the leg tile
      const crosswalk = n.control === 'signal' ? 'continental' : dens === 'rural' ? null : l.control !== 'none' || n.control === 'allway' ? 'standard' : null;
      if (crosswalk === 'continental') for (let t = -110; t + 20 <= 110; t += 40) paint(run, S(4), S(64), t, t + 20, P.white);
      if (crosswalk === 'standard') { paint(run, S(4), S(12), -120, 120, P.white); paint(run, S(56), S(64), -120, 120, P.white); }
      if (crosswalk) { stats.crosswalks++;
        for (const sg of [1, -1]) { // curb ramps at both ends: sidewalk drops to road level, tactile pad by the curb
          paint(run, S(4), S(64), sg * 120, sg * 160, [146, 144, 138], 'walk', 'low');
          paint(run, S(4), S(64), sg * 120, sg * 132, [214, 170, 40], 'walk', 'low');
          stats.ramps++;
        }
      }
      if (!l.inbound || l.control === 'none' || l.control === 'out') continue;
      // the inbound half: traffic travels -v, its right side is right(-v)
      const r = right([-l.v[0], -l.v[1]]), sg = axis === 'x' ? r[1] : r[0];
      const t0 = l.nb.ramp ? -110 : 8;
      if (l.control === 'yield') { for (let t = 12; t + 12 <= 108; t += 24) paint(run, S(76), S(88), sg * t, sg * (t + 12), P.white); stats.yieldlines++; }
      else { paint(run, S(76), S(88), sg * t0, sg * 110, P.white); stats.stopbars++; }
    }
  }
  // ---- emit every tile
  for (const t of net.tiles.values()) emitTile(B, t, ov.get(t.k) ?? [], colorsFor(F.income(t.cx, t.cy)).asph, T);
  // ---- raised medians with trees
  for (const m of medians) {
    const { run } = m, R = (s0, s1, t0, t1, z0, z1, color, extra) => { const [a, b, c, d] = runRect(run, s0, s1, t0, t1); return B.box(a, b, z0, c, d, z1, { asset: 'PB_DefaultMicroBrick', color, ...DIR4, ...extra }, 'road median'); };
    const CURB = [188, 186, 178], GRASS = [74, 112, 50];
    R(m.s0, m.s1, -20, -16, 0, 8, CURB); R(m.s0, m.s1, 16, 20, 0, 8, CURB);
    R(m.s0, m.s0 + 4, -16, 16, 0, 8, [214, 180, 50]); R(m.s1 - 4, m.s1, -16, 16, 0, 8, [214, 180, 50]); // painted noses
    R(m.s0 + 4, m.s1 - 4, -16, 16, 0, 8, GRASS);
    const leaf = [[52, 98, 44], [64, 108, 48], [46, 88, 40]];
    for (let s = m.s0 + 80, i = 0; s + 80 <= m.s1; s += 160, i++) {
      if (!R(s - 3, s + 3, -3, 3, 8, 54, [96, 68, 44])) continue;
      R(s - 16, s + 16, -15, 15, 54, 92, leaf[i % 3]); R(s - 10, s + 10, -10, 10, 92, 108, leaf[(i + 1) % 3]);
    }
    stats.medians++;
  }
  return { stats, colorsFor };
}

function emitTile(B, t, overlays, asphColor, T) {
  const X0 = t.cx - T / 2, Y0 = t.cy - T / 2, N = T / 40;
  // base raster of 40-unit cells: asphalt = core square + an arm per open side
  const asph = (i, j) => { const u = X0 + i * 40 + 20 - t.cx, v = Y0 + j * 40 + 20 - t.cy; // cell centre, tile-local
    if (Math.abs(u) < 120 && Math.abs(v) < 120) return true;
    if (Math.abs(u) < 120 && (v > 0 ? t.open.includes('N') : t.open.includes('S'))) return true;
    if (Math.abs(v) < 120 && (u > 0 ? t.open.includes('E') : t.open.includes('W'))) return true;
    return false; };
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) cells.push({ i, j, a: asph(i, j) });
  const A = (i, j) => i >= 0 && j >= 0 && i < N && j < N ? asph(i, j) : null;
  const rects = []; // [x0,y0,x1,y1, surf, kind, color]
  const WALK = [[130, 130, 130], [138, 137, 134]], GRASS = [92, 124, 62];
  for (const c of cells) {
    const x0 = X0 + c.i * 40, y0 = Y0 + c.j * 40;
    if (c.a) rects.push([x0, y0, x0 + 40, y0 + 40, 'asph', 'asph', asphColor]);
    else if (t.ramp) rects.push([x0, y0, x0 + 40, y0 + 40, 'grass', 'grass', GRASS]);
    else rects.push([x0, y0, x0 + 40, y0 + 40, 'walk', 'walk', WALK[(c.i + c.j) & 1]]);
  }
  if (!t.ramp) for (const c of cells) { // gutters (asphalt side) and curbs (sidewalk side) along every asphalt / sidewalk edge
    const x0 = X0 + c.i * 40, y0 = Y0 + c.j * 40;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = A(c.i + di, c.j + dj);
      if (nb === null || nb === c.a) continue;
      const w = c.a ? 10 : 6, col = c.a ? [150, 148, 142] : [190, 188, 180], kind = c.a ? 'gutter' : 'curb', surf = c.a ? 'asph' : 'walk';
      const r = di === 1 ? [x0 + 40 - w, y0, x0 + 40, y0 + 40] : di === -1 ? [x0, y0, x0 + w, y0 + 40] : dj === 1 ? [x0, y0 + 40 - w, x0 + 40, y0 + 40] : [x0, y0, x0 + 40, y0 + w];
      rects.push([...r, surf, kind, col]);
    }
  }
  const order = { patch: 0, gutter: 1, paint: 2, skip: 3, low: 4 };
  for (const o of [...overlays].sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2))) rects.push([o.x0, o.y0, o.x1, o.y1, o.on, o.kind, o.color]);
  // resolve on the compressed grid of all edges (+ the 40 grid, so sidewalk pieces stay <= 40 for curb cuts)
  const xs = new Set(), ys = new Set();
  for (let k = 0; k <= N; k++) { xs.add(X0 + k * 40); ys.add(Y0 + k * 40); }
  for (const r of rects) { xs.add(r[0]); xs.add(r[2]); ys.add(r[1]); ys.add(r[3]); }
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
  const key = [];
  for (let a = 0; a + 1 < X.length; a++) { key.push([]); for (let b = 0; b + 1 < Y.length; b++) {
    const mx = (X[a] + X[a + 1]) / 2, my = (Y[b] + Y[b + 1]) / 2;
    let surf = null, kind = null, color = null;
    for (const r of rects) {
      if (mx < r[0] || mx > r[2] || my < r[1] || my > r[3]) continue;
      if (r[5] === 'asph' || r[5] === 'walk' || r[5] === 'grass') { surf = r[4]; kind = r[5]; color = r[6]; continue; }
      if (r[4] !== 'any' && r[4] !== surf) continue;
      kind = r[5]; color = r[6];
    }
    key[a].push(kind === 'skip' ? null : { surf: kind === 'low' ? 'low' : surf, color, id: (kind === 'low' ? 'low' : surf) + color });
  } }
  // greedy merge: rows of equal id, then stack equal rows (sidewalk / low pieces never cross the 40 grid)
  const used = key.map(r => r.map(() => false));
  const g40 = v => (v - X0) % 40 === 0, h40 = v => (v - Y0) % 40 === 0;
  for (let a = 0; a < key.length; a++) for (let b = 0; b < key[a].length; b++) {
    const c = key[a][b];
    if (!c || used[a][b]) continue;
    const small = c.surf !== 'asph';
    let a1 = a + 1;
    while (a1 < key.length && !used[a1][b] && key[a1][b]?.id === c.id && !(small && g40(X[a1]))) a1++;
    let b1 = b + 1;
    grow: while (b1 < key[a].length && !(small && h40(Y[b1]))) {
      for (let q = a; q < a1; q++) if (used[q][b1] || key[q][b1]?.id !== c.id) break grow;
      b1++;
    }
    for (let q = a; q < a1; q++) for (let p = b; p < b1; p++) used[q][p] = true;
    const x0 = X[a], x1 = X[a1], y0 = Y[b], y1 = Y[b1];
    const z1 = c.surf === 'walk' ? 8 : c.surf === 'grass' ? 2 : 4;
    const round = (x1 - x0) % 10 === 0 && (y1 - y0) % 10 === 0;
    const asset = !round ? 'PB_DefaultMicroBrick' : c.surf === 'asph' ? 'PB_DefaultSmoothTile' : 'PB_DefaultTile';
    if (!B.box(x0, y0, 0, x1, y1, z1, { asset, color: c.color, ...DIR4 }, 'road ' + c.surf)) throw new Error(`road surface overlap at ${t.k}`);
  }
}

// -------------------------------------------------------------- furniture --
// signs, name blades, streetlights; after the lots are built (driveway curb cuts known: `cuts`)
export function roadFurniture(B, net, { T, F, rnd, cuts = [], reserved = [], names }) {
  const st = { stop: 0, allway: 0, yield: 0, stopahead: 0, curve: 0, speed: 0, blades: 0, lights: {}, lightComponents: 0 };
  const inCut = (x, y) => cuts.some(c => x > c.x0 - 10 && x < c.x1 + 10 && y > c.y0 - 10 && y < c.y1 + 10);
  const inRes = (x, y) => reserved.some(r => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
  const MB = 'PB_DefaultMicroBrick', STEEL = [150, 152, 156];
  const box = (x0, y0, z0, x1, y1, z1, color, label, extra = {}) => B.box(Math.min(x0, x1), Math.min(y0, y1), z0, Math.max(x0, x1), Math.max(y0, y1), z1, { asset: MB, color, ...DIR4, ...extra }, label);
  const put = label => (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, label);
  // a sign face: rows [z0, z1, l0, l1, color] across the lateral axis, 2 thick, 2..4 in front of the post (toward f)
  const lat = f => (f[0] ? [0, 1] : [1, 0]);
  const face = (x, y, f, rows, label) => { const L = lat(f); let ok = true;
    for (const [z0, z1, l0, l1, color] of rows) {
      const a = [x + f[0] * 2 + L[0] * l0, y + f[1] * 2 + L[1] * l0], b = [x + f[0] * 4 + L[0] * l1, y + f[1] * 4 + L[1] * l1];
      ok = box(a[0], a[1], z0, b[0], b[1], z1, color, label) && ok;
    }
    return ok; };
  const text = (x, y, f, zc, w, h, color, txt, style, label) => {
    return plaque({ put: put(label), facing: f, x: x + f[0] * 3, y: y + f[1] * 3, z: zc, w, h, color, text: txt, style }); };
  const post = (x, y, z1, label) => box(x - 2, y - 2, 8, x + 2, y + 2, Math.ceil(z1 / 2) * 2, STEEL, label, { material: 'BMC_Metallic' });
  const RED = [196, 32, 36], WHITE = [244, 244, 240], YEL = [240, 200, 40], BLACK = [20, 20, 22], GREEN = [20, 110, 60];
  // STOP: octagon 30 across, white legend on the middle band; zc = centre height
  const stopSign = (x, y, f, zc, allway) => {
    if (!post(x, y, zc + 15, 'sign post')) return false;
    const rows = [];
    for (let dz = 6; dz < 15; dz += 2) { const hw = Math.round(15 - Math.max(0, dz + 1 - 6.2)); rows.push([zc + dz, zc + dz + 2, -hw, hw, RED], [zc - dz - 2, zc - dz, -hw, hw, RED]); }
    face(x, y, f, rows, 'sign stop');
    text(x, y, f, zc, 15, 6, RED, 'STOP', TXT(WHITE, 1.9), 'sign stop');
    if (allway) text(x, y, f, zc - 22, 12, 4, RED, 'ALL WAY', TXT(WHITE, 0.9), 'sign allway');
    return true;
  };
  // YIELD: inverted triangle, red border, white field, red legend
  const yieldSign = (x, y, f, zc) => {
    if (!post(x, y, zc + 21, 'sign post')) return false;
    const rows = [], H = 42, z0 = zc - 21, iw = Math.round(24 * 27 / H / 2) * 2 - 6;
    for (let h = 0; h < H; h += 2) {
      const outer = Math.max(2, Math.round(24 * (h + 1) / H / 2) * 2), inner = outer - 6, zz0 = z0 + h, zz1 = zz0 + 2;
      if (h >= 26 && h < 34) { rows.push([zz0, zz1, -outer, -inner, RED], [zz0, zz1, inner, outer, RED]); if (inner > iw) rows.push([zz0, zz1, -inner, -iw, WHITE], [zz0, zz1, iw, inner, WHITE]); continue; }
      if (inner <= 0) rows.push([zz0, zz1, -outer, outer, RED]);
      else rows.push([zz0, zz1, -outer, -inner, RED], [zz0, zz1, -inner, inner, WHITE], [zz0, zz1, inner, outer, RED]);
    }
    face(x, y, f, rows, 'sign yield');
    text(x, y, f, z0 + 30, iw, 4, WHITE, 'YIELD', TXT(RED, 0.8), 'sign yield');
    return true;
  };
  // diamond warning sign: yellow, black legend
  const warnSign = (x, y, f, zc, legend) => {
    if (!post(x, y, zc + 21, 'sign post')) return false;
    const rows = [];
    for (let dz = 6; dz < 21; dz += 2) { const hw = 21 - dz - 1; if (hw < 1) break; rows.push([zc + dz, zc + dz + 2, -hw, hw, YEL], [zc - dz - 2, zc - dz, -hw, hw, YEL]); }
    face(x, y, f, rows, 'sign warning');
    text(x, y, f, zc, 15, 6, YEL, legend, TXT(BLACK, legend.length > 6 ? 0.8 : 1.1), 'sign warning');
    return true;
  };
  const speedSign = (x, y, f, zc, mph, label = 'SPEED LIMIT') => {
    if (!post(x, y, zc + 16, 'sign post')) return false;
    text(x, y, f, zc + 11, 12, 5, WHITE, label, TXT(BLACK, 0.7), 'sign speed');
    text(x, y, f, zc - 4, 12, 10, WHITE, String(mph), TXT(BLACK, 2.4), 'sign speed');
    face(x, y, f, [[zc - 16, zc - 14, -12, 12, WHITE]], 'sign speed');
    return true;
  };
  // street name post at a corner: two double-sided green blades
  const blades = (x, y, ew, ns) => {
    if (!post(x, y, 100, 'sign post')) return false;
    for (const [dz, alongX, nm] of [[0, true, ew], [10, false, ns]]) if (nm) for (const sg of [1, -1]) {
      const f = alongX ? [0, sg] : [sg, 0];
      plaque({ put: put('sign blade'), facing: f, x: x + f[0] * 1, y: y + f[1] * 1, z: 105 + dz, w: 30, h: 5, color: GREEN, text: nm, style: TXT(WHITE, 0.75) });
    }
    st.blades++;
    return true;
  };
  const sideSpot = (n, l, d, tSide = 140) => { // a spot on the right-hand sidewalk of leg l, d units from the node tile edge
    const v = l.v, r = right([-v[0], -v[1]]), base = [n.cx + v[0] * (T / 2 + d), n.cy + v[1] * (T / 2 + d)];
    return [base[0] + r[0] * tSide, base[1] + r[1] * tSide];
  };
  const runName = run => names(run);
  // ---- junction signs
  for (const n of net.nodes.values()) {
    const dens = F.density(n.cx, n.cy);
    for (const l of n.legs) {
      if (!l.nb || !l.inbound) continue;
      const f = l.v; // the sign faces the driver coming in along -v
      if (l.control === 'stop' || l.control === 'yield') {
        const [x, y] = sideSpot(n, l, 100);
        if (inCut(x, y)) continue;
        if (l.control === 'stop' && stopSign(x, y, f, 84, n.control === 'allway')) { st.stop++; if (n.control === 'allway') st.allway++; }
        if (l.control === 'yield' && yieldSign(x, y, f, 88)) st.yield++;
        if (dens === 'rural' && l.run && Math.abs(l.run.s1 - l.run.s0) >= 4 * T) { const [ax, ay] = sideSpot(n, l, 2 * T + 160); if (!inCut(ax, ay) && warnSign(ax, ay, f, 84, l.control === 'stop' ? 'STOP AHEAD' : 'YIELD AHEAD')) st.stopahead++; }
      }
      if (n.control === 'curve' && l.run && Math.abs(l.run.s1 - l.run.s0) >= 2 * T) { const [x, y] = sideSpot(n, l, T + 100); if (!inCut(x, y) && warnSign(x, y, f, 84, 'CURVE')) st.curve++; }
    }
    if (n.legs.filter(l => l.nb).length >= 3 && n.control !== 'signal') {
      const ew = n.legs.find(l => l.v[0] && l.run)?.run, ns = n.legs.find(l => l.v[1] && l.run)?.run;
      blades(n.cx + 140, n.cy + 140, ew && runName(ew), ns && runName(ns));
    }
  }
  // ---- per run: speed limits near each end (right side), streetlights
  for (const run of net.runs) {
    if (run.ramp) continue;
    const len = run.s1 - run.s0, mph = run.cls === 'arterial' ? 35 : run.cls === 'collector' ? 30 : run.dens === 'rural' ? 40 : 25;
    const at = (s, t) => run.axis === 'x' ? [s, run.c + t] : [run.c + t, s];
    const rs = run.axis === 'x' ? 1 : -1; // t sign of the right side for +s travel
    if (len >= 3 * T) for (const [s, sg] of [[run.s0 + T + 220, 1], [run.s1 - T - 220, -1]]) {
      const [x, y] = at(s, rs * sg * 140), f = run.axis === 'x' ? [-sg, 0] : [0, -sg];
      if (!inCut(x, y) && !inRes(x, y) && speedSign(x, y, f, 80, mph)) st.speed++;
    }
    const kind = run.inc >= 0.62 ? 'acorn' : run.inc >= 0.35 ? 'cobra' : 'wood', every = { acorn: 2, cobra: 3, wood: 4 }[kind];
    for (let k = 1, side = 1; k < run.tiles.length - 1; k += every, side = -side) {
      const s = run.s0 + k * T + T / 2;
      for (const sg of kind === 'acorn' ? [1, -1] : [side]) {
        const [x, y] = at(s, sg * 150), toRoad = run.axis === 'x' ? [0, -sg] : [-sg, 0];
        if (inCut(x, y) || inRes(x, y)) continue;
        if (streetlight(x, y, toRoad, kind)) { st.lights[kind] = (st.lights[kind] ?? 0) + 1; st.lightComponents += 2; }
      }
    }
  }
  function streetlight(x, y, toRoad, kind) {
    const SODIUM = [255, 178, 96], LED = [226, 234, 255];
    const spot = (color, radius) => ({ type: 'Component_SpotLight', data: { Rotation: { Pitch: 270, Yaw: 0, Roll: 0 }, InnerConeAngle: 45, OuterConeAngle: 75, bEnabled: true,
      Brightness: 9, Radius: radius, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });
    const glow = (color, radius, b = 2) => ({ type: 'Component_PointLight', data: { bMatchBrickShape: true, bEnabled: true, Brightness: b, Radius: radius,
      Color: { R: color[0], G: color[1], B: color[2], A: 255 }, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });
    if (kind === 'acorn') { // black ornamental post, glass globe (point light) under a cap (spot light down)
      const BL = [26, 26, 28];
      if (!box(x - 6, y - 6, 8, x + 6, y + 6, 24, BL, 'light base')) return false;
      box(x - 3, y - 3, 24, x + 3, y + 3, 140, BL, 'light pole');
      box(x - 5, y - 5, 140, x + 5, y + 5, 142, BL, 'light collar');
      box(x - 7, y - 7, 142, x + 7, y + 7, 158, [250, 246, 232], 'light globe', { material: 'BMC_Glass', components: [glow(LED, 420, 5)] });
      box(x - 9, y - 9, 158, x + 9, y + 9, 162, BL, 'light cap', { components: [spot(LED, 700)] });
      box(x - 2, y - 2, 162, x + 2, y + 2, 168, BL, 'light finial');
      return true;
    }
    const top = kind === 'wood' ? 340 : 300, armZ = 292;
    if (kind === 'wood') { if (!box(x - 6, y - 6, 8, x + 6, y + 6, top, [104, 78, 54], 'light pole')) return false; }
    else { if (!box(x - 6, y - 6, 8, x + 6, y + 6, 24, STEEL, 'light base', { material: 'BMC_Metallic' })) return false; box(x - 4, y - 4, 24, x + 4, y + 4, top, STEEL, 'light pole', { material: 'BMC_Metallic' }); }
    const w = kind === 'wood' ? 6 : 4; // the arm leaves the pole face toward the road
    const a0 = [x + toRoad[0] * w, y + toRoad[1] * w], a1 = [x + toRoad[0] * 58, y + toRoad[1] * 58];
    box(Math.min(a0[0], a1[0]) - (toRoad[0] ? 0 : 2), Math.min(a0[1], a1[1]) - (toRoad[1] ? 0 : 2), armZ, Math.max(a0[0], a1[0]) + (toRoad[0] ? 0 : 2), Math.max(a0[1], a1[1]) + (toRoad[1] ? 0 : 2), armZ + 4, STEEL, 'light arm', { material: 'BMC_Metallic' });
    // cobra head: housing, glass lens underneath
    const h0 = [x + toRoad[0] * 58, y + toRoad[1] * 58], h1 = [x + toRoad[0] * 80, y + toRoad[1] * 80];
    const hx0 = Math.min(h0[0], h1[0]) - (toRoad[0] ? 0 : 6), hx1 = Math.max(h0[0], h1[0]) + (toRoad[0] ? 0 : 6), hy0 = Math.min(h0[1], h1[1]) - (toRoad[1] ? 0 : 6), hy1 = Math.max(h0[1], h1[1]) + (toRoad[1] ? 0 : 6);
    box(hx0, hy0, armZ - 2, hx1, hy1, armZ + 6, [120, 124, 128], 'light head', { material: 'BMC_Metallic' });
    const col = kind === 'wood' || kind === 'cobra' ? SODIUM : LED;
    box(hx0 + 2, hy0 + 2, armZ - 4, hx1 - 2, hy1 - 2, armZ - 2, [255, 236, 200], 'light lens', { material: 'BMC_Glass', components: [spot(col, 900), glow(col, 50, 3)] });
    return true;
  }
  return st;
}
