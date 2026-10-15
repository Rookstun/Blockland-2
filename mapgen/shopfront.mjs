// Weapon shop facades (2026-10-15, owner on the first armory: "make this look
// really good. use proc gen if you want"): a Victorian shopfront over a wallgen
// shop's street wall, plus pixel-art crests. town.mjs weaponFit calls
// weaponFacade with the shop's stud-space helpers.
//
// Stud space (renderWallgen): x across the front 0 .. W+1, wall face y = 0,
// street y < 0, z up from the ground floor slab (0). Wallgen openings sit one
// stud right of the plan positions (door fd -> cells fd-2 .. fd+4).

const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const GLOW = (color, i = 5) => ({ asset: MB, color, material: 'BMC_Glow', material_intensity: i });
const CHARGES = ['cross', 'chevron', 'bend', 'pale'];

/** pixel rows on a wall-parallel plane: 2-unit pixels, runs merged per row, x from xL, y0..y1 deep */
export function artRows(mput, g, xL, zTop, y0, y1, pal) {
  g.forEach((row, r) => {
    for (let i = 0; i < row.length;) {
      let n = 1; while (i + n < row.length && row[i + n] === row[i]) n++;
      if (row[i] !== '.') mput(xL + (i + n / 2) * 0.2, (y0 + y1) / 2, zTop - r * 2 - 1, [n, (y1 - y0) * 5, 1], pal[row[i]]);
      i += n;
    }
  });
}

/** the same on a board standing across the wall: columns along y from yL, x from xa to xb */
function sideRows(mput, g, xa, xb, yL, zTop, pal) {
  g.forEach((row, r) => {
    for (let i = 0; i < row.length;) {
      let n = 1; while (i + n < row.length && row[i + n] === row[i]) n++;
      if (row[i] !== '.') mput((xa + xb) / 2, yL + (i + n / 2) * 0.2, zTop - r * 2 - 1, [(xb - xa) * 5, n, 1], pal[row[i]]);
      i += n;
    }
  });
}

/**
 * Pixel art, rows of chars on a w x h grid (row 0 at the top, '.' empty):
 * crossed swords behind a heater shield (armory) or crossed rifles behind a
 * target (gunsmith); arms false = the shield alone, filling the width.
 * `charge` = the shield's device (cross | chevron | bend | pale).
 * Chars: B blade, G gold, W wood, S field, C cream, R red, K dark.
 */
export function pixelCrest(kind, w, h, charge, arms = true) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; };
  const line = (x0, y0, x1, y1, c, from = 0, to = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = Math.round(n * from); i <= Math.round(n * to); i++) set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  // two crossed pieces, hilts / stocks at the bottom corners
  if (arms) for (const m of [1, -1]) {
    const x0 = m > 0 ? 1 : w - 2, x1 = m > 0 ? w - 3 : 2, y0 = h - 2, y1 = 1;
    const px = x1 - x0, py = y1 - y0, L = Math.hypot(px, py), ux = px / L, uy = py / L;
    if (kind === 'gunsmith') {
      line(x0, y0, x1, y1, 'K', 0.3, 1);                                     // barrel
      line(x0, y0, x1, y1, 'W', 0, 0.42);                                    // stock
      line(x0 - uy, y0 + ux, x0 - uy + px * 0.25, y0 + ux + py * 0.25, 'W'); // butt depth
      set(x0 + px * 0.42 - uy, y0 + py * 0.42 + ux, 'K');                    // trigger guard
    } else {
      line(x0, y0, x1, y1, 'B', 0.22, 1);                                    // blade
      line(x0, y0, x1, y1, 'W', 0.05, 0.18);                                 // grip
      set(x0, y0, 'G');                                                      // pommel
      const gx = x0 + px * 0.2, gy = y0 + py * 0.2;                          // guard across the blade
      for (const k of [-2, -1, 0, 1, 2]) set(gx - uy * k, gy + ux * k, 'G');
    }
  }
  const cx = (w - 1) / 2;
  if (kind === 'gunsmith') {
    // a round target: dark rim, red and cream rings, a gold bull
    const r0 = Math.min(w, h) * 0.36, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > r0 + 0.5) continue;
      set(x, y, r > r0 - 0.7 ? 'K' : r < 1.2 ? 'G' : Math.floor(r / (r0 / 3.5)) % 2 ? 'C' : 'R');
    }
    return g.map(r => r.join(''));
  }
  // heater shield: straight sides for 55 % of its height, then an arc to the point
  const sw = arms ? Math.max(6, Math.round(w * 0.44)) : w - 2, sh = h - 2, top = 1, k = 0.55;
  for (let r = 0; r < sh; r++) {
    const t = r < sh * k ? 1 : Math.sqrt(Math.max(0, 1 - ((r - sh * k) / (sh * (1 - k))) ** 2));
    const hw = Math.max(0.5, (sw / 2) * t);
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const edge = r === 0 || x - (cx - hw) < 1 || cx + hw - x < 1 || r === sh - 1;
      const dx = x - cx, ry = r / sh;
      const dev = charge === 'cross' ? Math.abs(dx) < 1 || Math.abs(ry - 0.4) < 0.07
        : charge === 'chevron' ? Math.abs(ry - (0.62 - (Math.abs(dx) / sw) * 0.9)) < 0.08
        : charge === 'bend' ? Math.abs(dx / sw - (ry - 0.45)) < 0.12
        : Math.abs(dx) < 1.6; // pale
      set(x, top + r, edge ? 'G' : dev ? 'C' : 'S');
    }
  }
  return g.map(r => r.join(''));
}

/** a shield picture for a display window's back panel (armory), chars as pixelCrest */
export const windowShield = (pick, s, k) => pixelCrest('armory', 18, 26, pick(CHARGES, s, 51 + k), false);

/**
 * The facade, everything on the street face at most ~1 stud proud: stone
 * plinth, rusticated quoins, panelled stall risers under glazed display windows
 * (mullions, transom, small panes, stone sills), striped wedge awnings with a
 * scalloped valance, a door case (pilasters with gold flutes, capitals,
 * entablature) with a pixel-art crest over it and lanterns either side, a
 * painted fascia carrying the name between gold beads under a stepped cornice,
 * a hanging blade sign on an iron bracket, and a forecourt of random flagstones
 * with a brick runner to the door inside a kerb, with barrels of swords /
 * powder kegs by the door.
 * ctx: sbox, mput, at, put, orientFor, rnd, pick, plaque, stone (3 tones),
 * tierSteel, names (shop name list), and the shop: kind, W, fd, dw, lw, rw,
 * ww, fx, fy, s, FC, cloth, tiers.
 */
export function weaponFacade(ctx) {
  const { sbox, mput, at, put, orientFor, rnd, pick, plaque, stone, tierSteel, names, kind, W, fd, dw, lw, rw, ww, fx, fy, s, FC, cloth, tiers } = ctx;
  const guns = kind === 'gunsmith';
  const paint = guns ? [26, 56, 42] : [92, 24, 32], paintHi = paint.map(v => Math.min(255, Math.round(v * 1.35 + 8)));
  const GOLD = { asset: MB, color: [196, 156, 70], material: 'BMC_Metallic' }, IRON = { asset: MB, color: [40, 40, 44], material: 'BMC_Metallic' };
  const P = c => ({ asset: MB, color: c }), CREAM = [236, 228, 206];
  const dressed = [196, 190, 178], plinthC = [92, 88, 84];
  const R = (a, b, z0, z1, y0, y1, m) => sbox(a, y0, b, y1, z0, z1, m); // x range, z range, y range (y < 0 = proud)
  const g5 = v => Math.round(v * 5) / 5;
  const top = 156, x1W = W + 1;
  const dl = fd - dw / 2 + 1, dr = fd + dw / 2 + 1, dc = (dl + dr) / 2;  // door opening (wallgen cells)
  const wins = [lw, rw].map(c => [c - ww / 2 + 1, c + ww / 2 + 1]);       // display window openings
  // trim overhang round the door case: none where a window jamb meets a pilaster (small lots)
  const m = Math.min(0.4, Math.max(0, Math.min(dl - 1 - (wins[0][1] + 1), wins[1][0] - 1 - (dr + 1))) / 2);
  const PAL = { B: { asset: MB, color: tierSteel[tiers[0]] ?? [200, 204, 212], material: 'BMC_Metallic' }, G: GOLD, W: P([110, 70, 40]), S: P(cloth), C: P(CREAM), R: P([190, 36, 36]), K: IRON };

  // plinth: dressed stone base course and a lip, broken by the door's threshold
  for (const [a, b] of [[0, dl], [dr, x1W]]) {
    R(a, b, 0, 14, -1, 0, P(plinthC));
    R(a, b, 14, 16, -0.6, 0, P(stone[1]));
  }
  R(dl, dr, 0, 4, -1, 0, { color: stone[2] });
  // rusticated quoins up both corners: long / short blocks by course, a groove between
  for (const side of [0, 1]) for (let z = 16, k = 0; z + 12 <= 124; z += 12, k++) {
    const len = k % 2 ? 1.4 : 2.2, a = side ? x1W - len : 0, b = side ? x1W : len;
    R(a, b, z, z + 10, -0.4, 0, P(dressed.map(v => Math.round(v * [1, 0.95, 1.04][k % 3]))));
  }
  // display windows: stall riser panels, sills, jambs, glazing bars, awnings
  for (const [o0, o1] of wins) {
    R(o0 - 1, o0, 16, 44, -0.4, 0, P(paint)); R(o1, o1 + 1, 16, 44, -0.4, 0, P(paint));
    R(o0, o1, 16, 20, -0.4, 0, P(paint));
    R(o0, o1, 20, 44, -0.2, 0, P(paint));                                  // field
    R(o0 + 0.6, o1 - 0.6, 24, 40, -0.4, -0.2, P(paintHi));                 // raised panel
    R(o0 + 1, o1 - 1, 30, 32, -0.6, -0.4, GOLD);                           // a brass rail across it
    R(o0 - 1 - m, o1 + 1 + m, 44, 48, -0.8, 0, P(dressed));                // stone sill
    R(o0 - 1, o0, 48, 110, -0.4, 0, P(paint)); R(o1, o1 + 1, 48, 110, -0.4, 0, P(paint));
    R(o0 - 0.2, o0, 48, 108, -0.6, -0.4, GOLD); R(o1, o1 + 0.2, 48, 108, -0.6, -0.4, GOLD); // gold beading on the jambs
    for (const k of [1, 2]) { const x = g5(o0 + ((o1 - o0) * k) / 3); R(x - 0.2, x + 0.2, 48, 88, -0.2, 0, P(paint)); } // mullions
    R(o0, o1, 88, 92, -0.2, 0, P(paint));                                  // transom, small panes above
    for (let k = 1; k < 6; k++) { const x = g5(o0 + ((o1 - o0) * k) / 6); R(x - 0.1, x + 0.1, 92, 108, -0.2, 0, P(paint)); }
    // awning: a striped wedge per stud sloping off the wall, scalloped valance under its lip
    for (let x = o0 - 1, i = 0; x < o1 + 1; x++, i++) {
      const [ax, ay] = at(x, -3), [bx, by] = at(x + 1, 0);
      const ext = [Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 7];
      const col = i % 2 ? CREAM : cloth;
      put({ asset: 'PB_DefaultMicroWedge', ...orientFor('PB_DefaultMicroWedge', [[-fx, -fy]], ext), color: col }, (ax + bx) / 2, (ay + by) / 2, 117);
      R(x, x + 1, i % 2 ? 106 : 102, 110, -3.2, -3, P(col));
    }
  }
  // door case: pilasters on the plinth, capitals, entablature and cornice
  for (const [a, b] of [[dl - 1, dl], [dr, dr + 1]]) {
    R(a, b, 16, 68, -0.6, 0, P(paint));
    R(a + 0.4, b - 0.4, 20, 50, -0.8, -0.6, GOLD);                         // a gold flute
    R(a - m / 2, b + m / 2, 68, 72, -0.8, 0, P(paintHi));                   // capital
  }
  R(dl - 1 - m, dr + 1 + m, 72, 80, -0.8, 0, P(paint));
  R(dl - 1 - m, dr + 1 + m, 80, 84, -1, 0, P(dressed));
  // the crest over the door, between the cornice and the fascia
  artRows(mput, pixelCrest(kind, 30, 18, pick(CHARGES, s, 41)), dc - 3, 122, -0.4, 0, PAL);
  // lanterns on the pilasters, lit
  for (const x of [dl - 0.5, dr + 0.5]) {
    R(x - 0.1, x + 0.1, 60, 66, -0.8, -0.6, GOLD);                          // bracket
    R(x - 0.4, x + 0.4, 52, 54, -1.6, -0.8, GOLD);                          // base
    R(x - 0.3, x + 0.3, 54, 64, -1.5, -0.9, GLOW([255, 200, 120], 6));      // flame glass
    R(x - 0.4, x + 0.4, 64, 66, -1.6, -0.8, GOLD);                          // cap
    R(x - 0.2, x + 0.2, 66, 68, -1.4, -1, GOLD);
  }
  // fascia: gold bead, painted board with the name, stepped cornice to the eaves
  R(0, x1W, 124, 126, -0.8, 0, GOLD);
  R(0, x1W, 126, 146, -0.6, 0, P(paint));
  R(0, x1W, 146, 150, -0.8, 0, GOLD);
  R(0, x1W, 150, top, -1.2, 0, P(dressed));
  const [px, py] = at(dc, -0.7);
  plaque({ put, text: pick(names, s, 811), facing: [fx, fy], x: px, y: py, z: 136, w: 110, h: 10, color: paint,
    style: { Font: guns ? 5 : 1, LineHeight: 5.5, Color: { R: 236, G: 196, B: 104, A: 255 } } });
  // hanging blade sign between the right window and the corner: iron bracket, painted board, the crest both sides
  const bx = g5((wins[1][1] + 1.4 + x1W - 2.2) / 2);
  R(bx - 0.4, bx + 0.4, 96, 110, -0.4, 0, IRON);                            // wall plate
  R(bx - 0.2, bx + 0.2, 106, 108, -4.4, -0.4, IRON);                        // arm
  R(bx - 0.2, bx + 0.2, 104, 110, -4.8, -4.4, IRON);                        // knob
  for (const y of [-3.6, -1.4]) R(bx - 0.2, bx + 0.2, 102, 106, y - 0.2, y, IRON); // hangers
  R(bx - 0.2, bx + 0.2, 70, 102, -4, -1, P(paint));
  R(bx - 0.4, bx + 0.4, 68, 70, -4, -1, GOLD);
  const sign = pixelCrest(kind, 14, 16, pick(CHARGES, s, 43));
  sideRows(mput, sign, bx + 0.2, bx + 0.4, -3.9, 102, PAL);
  sideRows(mput, sign, bx - 0.4, bx - 0.2, -3.9, 102, PAL);
  // forecourt: kerb, a brick runner to the door, random flagstones round it
  const X0 = -4, X1 = W + 5, Y0 = -FC, Y1 = -1;
  const run0 = dl - 1, run1 = dr + 1, used = new Set();
  const kerb = (x, y) => { used.add(x + ',' + y); sbox(x, y, x + 1, y + 1, 0, 4, { asset: TILE, color: plinthC }); };
  for (let x = X0; x < X1; x++) kerb(x, Y0);
  for (let y = Y0 + 1; y < Y1; y++) { kerb(X0, y); kerb(X1 - 1, y); }
  for (let y = Y0 + 1, r = 0; y < Y1; y++, r++)
    for (let x = run0 - (r % 2), i = 0; x < run1; x += 2, i++) {
      const a = Math.max(run0, x), b = Math.min(run1, x + 2);
      for (let q = a; q < b; q++) used.add(q + ',' + y);
      sbox(a, y, b, y + 1, 0, 4, { asset: TILE, color: (i + r) % 3 ? [150, 92, 70] : [128, 78, 60] });
    }
  for (let y = Y0 + 1; y < Y1; y++) for (let x = X0 + 1; x < X1 - 1; x++) {
    if (used.has(x + ',' + y)) continue;
    let w = 2 + Math.floor(rnd(s, x * 37 + 5, y * 11 + 7) * 3), d = 2 + Math.floor(rnd(s, x * 13 + 1, y * 29 + 3) * 2);
    const fits = (w, d) => { for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (x + i >= X1 - 1 || y + j >= Y1 || used.has(x + i + ',' + (y + j))) return false; return true; };
    while (!fits(w, d)) { if (w >= d && w > 1) w--; else d--; }
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) used.add(x + i + ',' + (y + j));
    const base = stone[Math.floor(rnd(s, x, y * 7 + 13) * 3)], k = 0.92 + rnd(s, x * 3, y * 5) * 0.14;
    sbox(x, y, x + w, y + d, 0, 4, { asset: TILE, color: base.map(v => Math.min(255, Math.round(v * k))) });
  }
  // by the door: barrels of swords (hilts up) / powder kegs
  for (const x of [dl - 3.5, dr + 3.5]) {
    const y = -2.4;
    if (guns) {
      mput(x, y, 4 + 10, [10, 10, 10], { asset: 'PB_DefaultPole', color: [60, 48, 40] });
      mput(x, y, 24 + 2, [10, 10, 2], { ...IRON, asset: 'PB_DefaultPole' });
      mput(x, y, 28 + 8, [5, 5, 8], { asset: 'PB_DefaultPole', color: [70, 56, 44] });
    } else {
      // staves with two iron hoops, stacked pole slices
      [[4, 8, 0], [8, 12, 1], [12, 24, 0], [24, 28, 1], [28, 32, 0]].forEach(([z0, z1, hoop]) =>
        mput(x, y, (z0 + z1) / 2, [10, 10, (z1 - z0) / 2], hoop ? { ...IRON, asset: 'PB_DefaultPole' } : { asset: 'PB_DefaultPole', color: [120, 84, 50] }));
      [[-0.4, -0.3], [0.4, 0], [-0.1, 0.4]].forEach(([dx, dy], i) => {
        mput(x + dx, y + dy, 34, [1, 1, 2], { asset: MB, color: [200, 204, 212], material: 'BMC_Metallic' }); // blade root
        mput(x + dx, y + dy, 37, [i % 2 ? 4 : 1, i % 2 ? 1 : 4, 1], GOLD);        // guard
        mput(x + dx, y + dy, 41, [1, 1, 3], { asset: MB, color: [70, 46, 30] });   // grip
        mput(x + dx, y + dy, 45, [2, 2, 1], GOLD);                                // pommel
      });
    }
  }
}
