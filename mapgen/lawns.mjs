// Lawns (2026-10-26, owner: "lawns and backyards that are beautiful ... like somebody hand painted the backyard.
// the ground should be green with levels of brown. pathways where people once were walking so often that they
// removed the grass. rock stones ... environmental storytelling and a dynamic non-set static structure").
// Per residential lot, after houses / barriers / yards, reading what stands there from the builder's labels:
//  * first the raised things (the raster skips what they cover): stepping stones on the better-kept paths,
//    rocks (a pair where the front path meets the sidewalk, a corner rock garden, field stones out back),
//    and the props that tell who lives there (a ball by the swings, a hose run to the beds, leaf piles under
//    trees on unraked lots, mole hills and a mushroom ring on the neglected ones)
//  * then a 2-high micro-brick ground raster (10-unit cells), painted: brush-stroke greens (value noise
//    stretched along a per-lot angle), mower stripes on the richest lawns, straw / olive dry patches that grow
//    as income falls, and wear: desire paths (front walk -> sidewalk on a slant, round the driveway side to the
//    back, back door -> every yard item), dirt under the swing seats, a dog's chain circle, a dead square under
//    the trampoline (and where last year's pool stood), a rain-shadow strip along the walls, lush rings round
//    watered beds and pools, bare dirt and dark shade under trees. Cells of one colour merge into rectangles.
//  * last, on top: tall tufts where the mower can't reach (beside fences, walls, items), dandelions and clover.
// A vacant lot is a meadow with a shortcut trodden across it.
//   lawns(B, { lots, houses, income(x, y), seed }) -> { name: count }
const MB = 'PB_DefaultMicroBrick';
const PAL = [
  [50, 90, 36], [62, 106, 42], [76, 122, 48], [92, 138, 54], [110, 152, 62], // 0-4 greens, shade -> sun
  [126, 130, 64], [166, 152, 88], // 5 olive, 6 straw
  [148, 118, 78], [122, 94, 62], [98, 74, 50], // 7 light dirt, 8 dirt, 9 trodden dark dirt
];
const STONE = [[150, 146, 138], [128, 124, 118], [170, 164, 152], [138, 132, 120], [116, 114, 110]];
const ROCK = [[118, 114, 108], [134, 128, 118], [102, 100, 96], [146, 138, 124], [126, 118, 104]];
const MOSS = [[92, 112, 64], [104, 122, 70]];
const LEAVES = [[196, 102, 34], [176, 62, 34], [214, 160, 48], [150, 84, 40]];

const hash = (s, x, y) => { let h = (s ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (s, x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(s, xi, yi), b = hash(s, xi + 1, yi), c = hash(s, xi, yi + 1), d = hash(s, xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const even = v => Math.round(v / 2) * 2;
const segDist = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? clamp(((px - ax) * dx + (py - ay) * dy) / L) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };

export function lawns(B, { lots, houses, income, seed }) {
  const got = {}, tally = k => { got[k] = (got[k] ?? 0) + 1; };
  // what stands in each lot: yard items + tree barriers, clustered by label and nearness
  const inLot = lots.map(() => []);
  for (const b of B.bricks) {
    if (!/^yard |^barrier trees/.test(b.label)) continue;
    const [x, y] = b.position, li = lots.findIndex(L => L.kind === 'residential' && x >= L.x0 && x < L.x1 && y >= L.y0 && y < L.y1);
    if (li < 0) continue;
    const box = [x - b.size[0], y - b.size[1], x + b.size[0], y + b.size[1]], name = b.label.replace(/^yard |^barrier /, '');
    const c = inLot[li].find(q => q.name === name && box[0] < q.box[2] + 20 && q.box[0] < box[2] + 20 && box[1] < q.box[3] + 20 && q.box[1] < box[3] + 20);
    if (c) c.box = [Math.min(c.box[0], box[0]), Math.min(c.box[1], box[1]), Math.max(c.box[2], box[2]), Math.max(c.box[3], box[3])];
    else inLot[li].push({ name, box });
  }
  lots.forEach((L, li) => { if (L.kind === 'residential') paintLot(L, li, houses.find(h => h.lot === li), inLot[li]); });
  return got;

  function paintLot(L, li, house, items) {
    const s = (seed * 7919 + li * 104729) >>> 0;
    let k = 0; const r = () => hash(s, 977, k++);
    const S = L.side === 'S', out = S ? -1 : 1, inn = -out, yE = S ? L.y0 : L.y1; // out = toward the street
    const cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;
    const care = house ? clamp(income(cx, cy) * 1.25 - 0.15) : 0;
    const paths = [], marks = []; // marks: { x, y, rx, ry, ring?, wear?, dry?, shade?, lush? } ellipses (or rings)
    const box = (x0, y0, z0, x1, y1, z1, color, label) => { const ok = B.box(even(x0), even(y0), z0, even(x1), even(y1), z1, { asset: MB, color }, 'lawn ' + label); if (ok) tally(label); return ok; };
    const centreOf = q => [(q.box[0] + q.box[2]) / 2, (q.box[1] + q.box[3]) / 2];
    const nearest = (q, [px, py]) => [clamp(px, q.box[0] - 6, q.box[2] + 6), clamp(py, q.box[1] - 6, q.box[3] + 6)];
    const wobbly = (pts, w, amp) => { // subdivide every 30 and push sideways by smooth noise: nobody walks a ruler line
      const o = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 30));
        for (let j = 1; j <= n; j++) {
          const t = j / n, e = j === n && i === pts.length - 1 ? 0 : (vnoise(s + 5, (o.length * 30) / 90, i) - 0.5) * amp * Math.sin(Math.PI * t);
          o.push([ax + (bx - ax) * t - (by - ay) / (len || 1) * e, ay + (by - ay) * t + (bx - ax) / (len || 1) * e]);
        }
      }
      return { pts: o, w, lo: [Math.min(...o.map(p => p[0])) - w - 30, Math.min(...o.map(p => p[1])) - w - 30], hi: [Math.max(...o.map(p => p[0])) + w + 30, Math.max(...o.map(p => p[1])) + w + 30] };
    };
    const stones = p => { // flat stepping stones along a path, 2 proud of the grass, a little off the line
      for (let d = 18, i = 0; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
        for (; d < len; d += 30 + r() * 10) {
          const t = d / len, hx = even(5 + r() * 5), hy = even(5 + r() * 5), x = ax + (bx - ax) * t + (r() - 0.5) * 6, y = ay + (by - ay) * t + (r() - 0.5) * 6;
          box(x - hx, y - hy, 0, x + hx, y + hy, 4, STONE[Math.floor(r() * STONE.length)], 'stone');
        }
        d -= len;
      }
    };
    const rock = (x, y, R) => { // a boulder of stacked, shrinking, off-centre slabs; mossy tops on some
      const c = ROCK[Math.floor(r() * ROCK.length)], ry = R * (0.65 + r() * 0.35), h = even(R * (0.6 + r() * 0.5));
      if (!box(x - R, y - ry, 0, x + R, y + ry, Math.max(2, even(h * 0.45)), c, 'rock')) return false;
      const ox = (r() - 0.5) * R * 0.4, oy = (r() - 0.5) * R * 0.4;
      box(x + ox - R * 0.75, y + oy - ry * 0.75, Math.max(2, even(h * 0.45)), x + ox + R * 0.75, y + oy + ry * 0.75, Math.max(4, even(h * 0.8)), c.map(v => v + 8), 'rock');
      if (R >= 12) box(x + ox * 1.5 - R * 0.4, y + oy * 1.5 - ry * 0.4, Math.max(4, even(h * 0.8)), x + ox * 1.5 + R * 0.4, y + oy * 1.5 + ry * 0.4, Math.max(6, even(h)), r() < 0.4 ? MOSS[Math.floor(r() * 2)] : c.map(v => v + 14), 'rock');
      marks.push({ x, y, rx: R + 10, ry: ry + 10, dry: 0.3 }); // trimmer misses round rocks
      return true;
    };

    if (house) {
      const fw = (house.W + 1) * 10, fd = (house.D + 1) * 10, hx0 = house.centre[0] - fw / 2, hx1 = house.centre[0] + fw / 2;
      const fy = house.centre[1] + out * fd / 2, by = house.centre[1] + inn * fd / 2; // frame front / back edge
      const doorX = house.origin[0] + (house.r ? -1 : 1) * house.door[0] * 10;
      const walkX = house.walk ?? doorX;
      // front: the walk ends at the frame, people cut across on a slant toward town (or to the mailbox)
      const mail = items.find(q => q.name === 'mailbox');
      const toward = Math.sign(cx - house.centre[0] + (r() - 0.5) * 400) || 1;
      let end = [clamp(walkX + toward * Math.min(Math.abs(fy - yE) * 0.8, 20 + r() * 50), L.x0 + 30, L.x1 - 30), yE];
      if (house.drive && end[0] > house.drive[0] - 20 && end[0] < house.drive[1] + 20) end = [walkX, yE];
      const front = wobbly([[walkX, fy], ...(mail && r() < 0.5 ? [nearest(mail, [walkX, fy])] : []), end], 26 + r() * 10, 30);
      paths.push(front);
      if (care > 0.45 && r() < care) stones(front);
      // a pair of rocks guarding the path mouth, or a little corner garden
      if (r() < 0.7) for (const sg of [-1, 1]) rock(end[0] + sg * (34 + r() * 10), yE + inn * (22 + r() * 10), even(8 + r() * 8));
      if (care > 0.3 && r() < 0.6) {
        const gx = r() < 0.5 ? L.x0 + 70 : L.x1 - 70, gy = yE + inn * 70;
        for (let n = 0, m = 3 + Math.floor(r() * 3); n < m; n++) rock(gx + (r() - 0.5) * 90, gy + (r() - 0.5) * 50 * inn, even(6 + r() * 14));
      }
      // round the driveway side to the back yard, if there is room beside the house
      const dSide = house.drive ? ((house.drive[0] + house.drive[1]) / 2 < house.centre[0] ? -1 : 1) : (r() < 0.5 ? -1 : 1);
      const gap = dSide < 0 ? hx0 - L.x0 : L.x1 - hx1, sx = dSide < 0 ? hx0 - gap / 2 : hx1 + gap / 2;
      const backDepth = Math.abs((S ? L.y1 : L.y0) - by);
      const hub = [clamp(doorX + (r() - 0.5) * 120, L.x0 + 60, L.x1 - 60), by + inn * Math.min(50, backDepth / 2)];
      if (gap >= 70) paths.push(wobbly([[sx, fy + out * 10], [sx, by + inn * 20], ...(backDepth >= 70 ? [hub] : [])], 22 + r() * 8, 18));
      // the back door to everything out back; the most used item gets the widest track
      if (backDepth >= 70) for (const q of items) {
        if (['mailbox', 'fronttree', 'trees'].includes(q.name)) continue;
        const p = wobbly([hub, nearest(q, hub)], { swings: 30, trampoline: 30, doghouse: 26, shed: 26, patio: 30 }[q.name] ?? 22, 40);
        paths.push(p);
        if (care > 0.6 && r() < 0.5) stones(p);
      }
      // rain shadow under the eaves
      marks.push({ rect: [hx0 - 14, Math.min(fy, by) - 14, hx1 + 14, Math.max(fy, by) + 14], dry: 0.45 });
    } else { // vacant: a meadow with a shortcut worn diagonally across it
      const a = [L.x0 + 40 + r() * (L.x1 - L.x0 - 80), yE], b = [r() < 0.5 ? L.x0 + 30 : L.x1 - 30, cy + (r() - 0.5) * 300];
      paths.push(wobbly([a, [(a[0] + b[0]) / 2 + (r() - 0.5) * 120, (a[1] + b[1]) / 2], b], 24, 50));
      for (let n = 0, m = 2 + Math.floor(r() * 4); n < m; n++) rock(L.x0 + 60 + r() * (L.x1 - L.x0 - 120), L.y0 + 60 + r() * (L.y1 - L.y0 - 120), even(8 + r() * 18));
    }
    // what the yard items did to the grass
    for (const q of items) {
      const [qx, qy] = centreOf(q), w = q.box[2] - q.box[0], d = q.box[3] - q.box[1], long = w >= d;
      const street = S ? q.box[1] : q.box[3]; // the street side edge (shed / doghouse doors face it)
      if (q.name === 'swings') for (const t of [0.29, 0.71]) {
        const x = long ? q.box[0] + w * t : qx, y = long ? qy : q.box[1] + d * t;
        marks.push({ x, y, rx: long ? 10 : 24, ry: long ? 24 : 10, wear: 0.95 });
      }
      if (q.name === 'trampoline') marks.push({ rect: [q.box[0] + 8, q.box[1] + 8, q.box[2] - 8, q.box[3] - 8], dry: 1 });
      if (q.name === 'doghouse') { marks.push({ x: qx, y: street + out * 16, rx: 24, ry: 24, wear: 0.9 }); marks.push({ x: qx, y: qy, rx: 80, ry: 80, ring: 14, wear: 0.6 }); }
      if (q.name === 'shed') marks.push({ x: qx, y: street + out * 14, rx: 26, ry: 18, wear: 0.8 });
      if (q.name === 'mailbox') marks.push({ x: qx, y: qy, rx: 18, ry: 18, wear: 0.5 });
      if (q.name === 'patio') marks.push({ rect: [q.box[0] - 12, q.box[1] - 12, q.box[2] + 12, q.box[3] + 12], wear: 0.35 });
      if (q.name === 'pool' || q.name === 'agpool') marks.push({ rect: [q.box[0] - 30, q.box[1] - 30, q.box[2] + 30, q.box[3] + 30], lush: 1 });
      if (q.name === 'agpool' && r() < 0.5) { // where last summer's pool stood: a dead square beside it
        const dx = (r() < 0.5 ? -1 : 1) * (w + 60);
        marks.push({ rect: [q.box[0] + dx, q.box[1], q.box[2] + dx, q.box[3]], dry: 1, edge: 1 });
      }
      if (q.name === 'vegbed' || q.name === 'flowerbed') { marks.push({ rect: [q.box[0] - 10, q.box[1] - 10, q.box[2] + 10, q.box[3] + 10], wear: 0.5 }); marks.push({ rect: [q.box[0] - 34, q.box[1] - 34, q.box[2] + 34, q.box[3] + 34], lush: 1 }); }
      if (q.name === 'fronttree' || q.name === 'trees') {
        marks.push({ x: qx, y: qy, rx: Math.max(w, d) / 2 + 50, ry: Math.max(w, d) / 2 + 50, shade: 1 });
        marks.push({ x: qx, y: qy, rx: 28, ry: 28, wear: 0.5 });
        if (care < 0.5 && r() < 0.7) for (let n = 0, m = 1 + Math.floor(r() * 3); n < m; n++) { // nobody raked
          const a = r() * 6.28, x = qx + Math.cos(a) * (40 + r() * 30), y = qy + Math.sin(a) * (40 + r() * 30), R = even(10 + r() * 8);
          if (box(x - R, y - R, 0, x + R, y + R, 4, LEAVES[Math.floor(r() * 4)], 'leaves')) { box(x - R * 0.6, y - R * 0.6, 4, x + R * 0.6, y + R * 0.6, 8, LEAVES[Math.floor(r() * 4)], 'leaves'); box(x - 2, y - 2, 8, x + 4, y + 2, 10, LEAVES[0], 'leaves'); }
        }
      }
      if ((q.name === 'swings' || q.name === 'trampoline') && r() < 0.6) { // the ball nobody put away
        const a = r() * 6.28, x = qx + Math.cos(a) * (Math.max(w, d) / 2 + 30), y = qy + Math.sin(a) * (Math.max(w, d) / 2 + 30);
        box(x - 4, y - 4, 0, x + 4, y + 4, 8, [[200, 40, 40], [40, 90, 200], [230, 200, 40]][Math.floor(r() * 3)], 'ball');
      }
      if ((q.name === 'vegbed' || q.name === 'flowerbed') && house && r() < 0.6) { // a hose from the nearest wall, lying where it was dropped
        const fw = (house.W + 1) * 10, wx = qx < house.centre[0] ? house.centre[0] - fw / 2 - 4 : house.centre[0] + fw / 2 + 4;
        const yy = clamp(qy, house.centre[1] - 100, house.centre[1] + 100), kx = wx + (qx - wx) * (0.3 + r() * 0.4);
        const seg = (x0, y0, x1, y1) => box(Math.min(x0, x1) - 1, Math.min(y0, y1) - 1, 0, Math.max(x0, x1) + 1, Math.max(y0, y1) + 1, 2, [40, 120, 50], 'hose');
        seg(wx, yy, kx, yy); seg(kx, yy, kx, qy); seg(kx, qy, qx, qy);
      }
    }
    if (care < 0.35) { // the neglected: mole hills and a fairy ring of mushrooms
      for (let n = 0, m = Math.floor(r() * 5); n < m; n++) {
        const x = L.x0 + 40 + r() * (L.x1 - L.x0 - 80), y = L.y0 + 40 + r() * (L.y1 - L.y0 - 80);
        if (box(x - 6, y - 6, 0, x + 6, y + 6, 4, PAL[8], 'molehill')) box(x - 2, y - 4, 4, x + 4, y + 2, 6, PAL[9], 'molehill');
      }
      if (r() < 0.5) {
        const x = L.x0 + 80 + r() * (L.x1 - L.x0 - 160), y = L.y0 + 80 + r() * (L.y1 - L.y0 - 160), R = 26 + r() * 20;
        for (let n = 0; n < 9; n++) { const a = n / 9 * 6.28 + r() * 0.3, mx = x + Math.cos(a) * R, my = y + Math.sin(a) * R; if (box(mx - 1, my - 1, 0, mx + 1, my + 1, 6, [226, 216, 196], 'mushroom')) box(mx - 3, my - 3, 6, mx + 3, my + 3, 8, r() < 0.3 ? [190, 50, 40] : [150, 110, 76], 'mushroom'); }
        marks.push({ x, y, rx: R + 6, ry: R + 6, ring: 6, lush: 1 });
      }
    }
    if (!house || care < 0.2) for (let n = 0; n < 2; n++) if (r() < 0.6) { // field stones turned up at the back
      const x = L.x0 + 50 + r() * (L.x1 - L.x0 - 100), y = (S ? L.y1 : L.y0) + inn * -(40 + r() * 80);
      rock(x, y, even(8 + r() * 12));
    }

    // ---- the painted raster
    const C = 10, ang = r() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang), stripes = care > 0.75;
    const nx = Math.round((L.x1 - L.x0) / C), ny = Math.round((L.y1 - L.y0) / C), col = new Int8Array(nx * ny).fill(-1);
    const dab = new Map(); // colours are picked per 2x2 cells (20 units: brush dabs, and a quarter of the bricks)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = L.x0 + i * C, y0 = L.y0 + j * C;
      if (!B.free([x0, y0, 0], [x0 + C, y0 + C, 2])) continue;
      const dk = (i >> 1) + ',' + (j >> 1);
      if (dab.has(dk)) { col[j * nx + i] = dab.get(dk); continue; }
      const x = L.x0 + (i >> 1) * 2 * C + C, y = L.y0 + (j >> 1) * 2 * C + C;
      const u = x * ca + y * sa, v = -x * sa + y * ca;
      const n1 = vnoise(s, u / 90, v / 24), n2 = vnoise(s + 1, x / 260, y / 260), h = hash(s, x, y);
      let level = 0.55 * n1 + 0.45 * n2, dry = clamp((vnoise(s + 2, x / 170, y / 170) - (0.4 + care * 0.4)) * 2.5), wear = 0;
      if (care > 0.6) level = 0.35 + level * 0.5; // a kept lawn is even
      if (stripes) level += Math.floor((x - L.x0) / 40) % 2 ? 0.14 : -0.1;
      if (!house) level -= 0.15, dry = clamp(dry + 0.25 * vnoise(s + 3, x / 60, y / 60));
      const jag = (vnoise(s + 4, x / 26, y / 26) - 0.5) * 14; // ragged path edges
      for (const p of paths) {
        if (x < p.lo[0] || y < p.lo[1] || x > p.hi[0] || y > p.hi[1]) continue;
        let dmin = 1e9;
        for (let q = 1; q < p.pts.length; q++) dmin = Math.min(dmin, segDist(x, y, p.pts[q - 1], p.pts[q]));
        const half = p.w / 2, dd = dmin + jag;
        wear = Math.max(wear, dd < half ? 0.75 + 0.25 * (1 - dd / half) : dd < half + 22 ? 0.6 * (1 - (dd - half) / 22) : 0);
      }
      for (const m of marks) {
        let t;
        if (m.rect) t = x >= m.rect[0] && x < m.rect[2] && y >= m.rect[1] && y < m.rect[3] ? (m.edge ? 0.6 + 0.4 * h : 1) : 0;
        else { const e = Math.hypot((x - m.x) / m.rx, (y - m.y) / m.ry) + jag / 60; t = m.ring ? clamp(1 - Math.abs(e - 1) * m.rx / m.ring) : clamp((1 - e) * 2.5); }
        if (!t) continue;
        if (m.wear) wear = Math.max(wear, m.wear * t);
        if (m.dry) dry = Math.max(dry, m.dry * t);
        if (m.shade) level -= 0.3 * t, dry = Math.max(0, dry - 0.3 * t);
        if (m.lush) level -= 0.15 * t, dry = Math.max(0, dry - 0.6 * t);
      }
      let c;
      if (wear >= 0.8) c = n1 < 0.45 ? 9 : 8;
      else if (wear >= 0.55) c = n1 < 0.5 ? 8 : 7;
      else if (wear >= 0.25) c = h < (wear - 0.25) / 0.35 ? 7 : n1 < 0.5 ? 6 : 5;
      else if (dry >= 0.6) c = n1 < 0.5 ? 6 : 5;
      else if (dry >= 0.3 && h < (dry - 0.3) / 0.35) c = 5;
      else c = clamp(Math.floor(level * 5), 0, 4);
      col[j * nx + i] = c; dab.set(dk, c);
    }
    // merge: runs per row, identical runs stacked into rectangles
    let open = new Map();
    const emit = (key, o, yEnd) => { const [x0, x1, c] = key.split(',').map(Number); box(x0, o, 0, x1, yEnd, 2, PAL[c], 'grass'); };
    for (let j = 0; j <= ny; j++) {
      const now = new Map(), y = L.y0 + j * C;
      if (j < ny) for (let i = 0; i < nx;) {
        const c = col[j * nx + i]; let e = i + 1;
        while (e < nx && col[j * nx + e] === c) e++;
        if (c >= 0) { const key = `${L.x0 + i * C},${L.x0 + e * C},${c}`; now.set(key, open.get(key) ?? y); }
        i = e;
      }
      for (const [key, o] of open) if (!now.has(key)) emit(key, o, y);
      open = now;
    }
    // on top: tufts where the mower can't reach (next to anything standing), dandelions and clover in the open
    const at = (i, j) => i < 0 || j < 0 || i >= nx || j >= ny ? -1 : col[j * nx + i];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = col[j * nx + i];
      if (c < 0 || c > 5) continue;
      const x = L.x0 + i * C, y = L.y0 + j * C, h = hash(s + 9, i, j);
      const edge = at(i - 1, j) < 0 || at(i + 1, j) < 0 || at(i, j - 1) < 0 || at(i, j + 1) < 0;
      if (edge && h < 0.06 + (1 - care) * 0.22) {
        const tall = even(4 + hash(s + 10, i, j) * (care < 0.4 ? 8 : 4)), ox = even(hash(s + 11, i, j) * 4);
        box(x + ox, y + 2, 2, x + ox + 4, y + 8, 2 + tall, PAL[Math.max(0, c - 1)], 'tuft');
        if (h < 0.1) box(x + ox + 4, y + 2, 2, x + ox + 6, y + 6, 4 + tall, PAL[Math.min(5, c + 1)], 'tuft');
      } else if (!edge && h < (1 - care) * 0.012) box(x + 4, y + 4, 2, x + 6, y + 6, 4, hash(s + 12, i, j) < 0.7 ? [240, 206, 50] : [236, 236, 228], 'flower');
    }
  }
}
