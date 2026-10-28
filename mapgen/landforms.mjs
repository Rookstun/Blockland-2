// Landforms (2026-10-28, owner: an "All about landforms" poster, "make all of these biomes"): the ones the map
// didn't have yet, cut into the heightmap after the footpaths (heights final for sites, roads and houses) and before
// the voxels, only on free cells (no town, road, river, village, dungeon, keep...). Kinds tag cells for the voxel
// colours (KIND); dress() adds the brick pieces a heightmap can't make (arches, coral, the cape's lighthouse).
//   plateau (mesa), karst towers, sinkholes (cenotes), glacier, nivation hollows, palsas, impact crater lake,
//   fjord, sea cliff + sea stacks + arch, lagoon + barrier bar, cape + lighthouse, archipelago, beach,
//   barchan dunes, yardangs, coral reef, mid-ocean ridge, oceanic trench
export const KIND = { PLATEAU: 1, KARST: 2, SINK: 3, GLACIER: 4, NIVATION: 5, PALSA: 6, CRATER: 7, CRATER_BED: 8, FJORD: 9, CLIFF: 10,
  STACK: 11, LAGOON: 12, BAR: 13, CAPE: 14, ISLE: 15, BEACH: 16, BARCHAN: 17, YARDANG: 18, REEF: 19, RIDGE: 20, TRENCH: 21, MESA_WALL: 22 };

export function landforms({ N, H, SEA, NZ, free, desertW, snowW, hash, fbm2, noSmooth, seed, log = console.error }) {
  const cell = new Uint8Array(N * N), at = (x, y) => x * N + y, inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const sites = []; // what dress() builds on, and the summary
  let rs = (seed ^ 0x5eed1a4d) >>> 0;
  const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clampH = v => Math.max(1, Math.min(NZ - 4, Math.round(v)));
  // distance (cells, 8-way) from every land cell to the sea and from every sea cell to land
  const dist = new Int16Array(N * N).fill(-1), q = new Int32Array(N * N);
  {
    let h = 0, t = 0;
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      const c = at(x, y), land = H[c] > SEA;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && (H[at(nx, ny)] > SEA) !== land) { dist[c] = 0; q[t++] = c; break; } }
    }
    while (h < t) {
      const c = q[h++], x = (c / N) | 0, y = c % N, land = H[c] > SEA;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue; const n = at(nx, ny);
        if (dist[n] < 0 && (H[n] > SEA) === land) { dist[n] = dist[c] + 1; q[t++] = n; }
      }
    }
  }
  const dSea = c => (H[c] > SEA ? dist[c] : 0), dLand = c => (H[c] > SEA ? 0 : dist[c] < 0 ? 999 : dist[c]);
  const taken = new Uint8Array(N * N);
  /** every cell within r (sampled) is free, untaken and passes ok (ok null: just free) */
  const fits = (x, y, r, ok) => {
    for (let dx = -r; dx <= r; dx += 2) for (let dy = -r; dy <= r; dy += 2) {
      if (dx * dx + dy * dy > r * r) continue; const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) return false; const c = at(nx, ny);
      if (taken[c] || !free(c) || (ok && !ok(c, nx, ny))) return false;
    }
    return true;
  };
  /** up to n sites r apart: centre passes `centre`, every cell within r is free (and passes `all` when given) */
  const pick = (n, r, centre, all = null, tries = 40000) => {
    const out = [];
    for (let k = 0; k < tries && out.length < n; k++) {
      const x = r + Math.floor(rnd() * (N - 2 * r)), y = r + Math.floor(rnd() * (N - 2 * r)), c = at(x, y);
      if (!centre(c, x, y) || out.some(s => Math.hypot(s.x - x, s.y - y) < 3 * r)) continue;
      if (fits(x, y, r, all)) out.push({ x, y });
    }
    return out;
  };
  const claim = (x, y, r) => { for (let dx = -r - 2; dx <= r + 2; dx++) for (let dy = -r - 2; dy <= r + 2; dy++) if (inB(x + dx, y + dy) && dx * dx + dy * dy <= (r + 2) * (r + 2)) taken[at(x + dx, y + dy)] = 1; };
  const disc = (x, y, r, fn) => { for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) { const nx = x + dx, ny = y + dy, d = Math.hypot(dx, dy); if (inB(nx, ny) && d <= r) fn(at(nx, ny), d, nx, ny, dx, dy); } };
  const slope = c => { const x = (c / N) | 0, y = c % N; let m = 0; for (const [dx, dy] of [[2, 0], [0, 2]]) if (inB(x + dx, y + dy)) m = Math.max(m, Math.abs(H[at(x + dx, y + dy)] - H[c])); return m; };
  const lowland = c => H[c] > SEA + 3 && H[c] < SEA + 40 && desertW(...xy(c)) < 0.15 && snowW(...xy(c)) < 0.15;
  const xy = c => [(c / N) | 0, c % N];
  const ok = (c, kind) => free(c) && !taken[c] && (!cell[c] || cell[c] === kind);
  const add = (kind, s) => { sites.push({ kind, ...s }); };

  // PLATEAU / MESA: flat top, sheer banded walls, in the dry country
  for (const s of pick(3, 14, c => desertW(...xy(c)) > 0.4, c => H[c] > SEA + 4 && desertW(...xy(c)) > 0.3 && slope(c) < 4)) {
    let top = 0; disc(s.x, s.y, 14, c => { top = Math.max(top, H[c]); });
    top = clampH(top + 10 + Math.floor(rnd() * 6));
    const ph = rnd() * 6.28;
    disc(s.x, s.y, 16, (c, d, x, y, dx, dy) => {
      const edge = 11 + 3 * Math.sin(Math.atan2(dy, dx) * 3 + ph) + 2 * fbm2(x / 9, y / 9, 2);
      if (d > edge || !ok(c, KIND.PLATEAU)) return;
      H[c] = top; cell[c] = d > edge - 1.5 ? KIND.MESA_WALL : KIND.PLATEAU; if (d > edge - 1.5) noSmooth[c] = 1;
    });
    claim(s.x, s.y, 16); add('plateau', s);
  }
  // KARST: a cluster of limestone towers with green caps in wet green lowland
  for (const s of pick(2, 16, c => lowland(c) && dSea(c) < 60, lowland)) {
    const n = 9 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.28, rr = rnd() * 13, x = Math.round(s.x + Math.cos(a) * rr), y = Math.round(s.y + Math.sin(a) * rr), r = 1.5 + rnd() * 2, h = clampH(H[at(x, y)] + 14 + rnd() * 22);
      disc(x, y, r, c => { if (ok(c, KIND.KARST)) { H[c] = Math.max(H[c], h - Math.floor(rnd() * 2)); cell[c] = KIND.KARST; noSmooth[c] = 1; } });
    }
    claim(s.x, s.y, 16); add('karst', s);
  }
  // SINKHOLE (cenote): a round sheer shaft down to water a little under the sea plane
  for (const s of pick(3, 6, c => lowland(c) && slope(c) < 3, lowland)) {
    const r = 4 + rnd() * 2;
    disc(s.x, s.y, r + 1.5, (c, d) => { if (!ok(c, KIND.SINK)) return; if (d <= r) { H[c] = SEA - 2 - Math.floor((1 - d / r) * 3); noSmooth[c] = d > r - 1.2 ? 1 : 0; } cell[c] = KIND.SINK; });
    claim(s.x, s.y, 8); add('sinkhole', s);
  }
  if (process.env.LAND_DEBUG) { let a = 0, b = 0, c2 = 0; for (let c = 0; c < N * N; c++) { const [x, y] = xy(c); const w = snowW(x, y); if (w > 0.3) { a++; if (H[c] > SEA + 15) { b++; if (free(c)) c2++; } } } log(`glacier cells: snow ${a}, high ${b}, free ${c2}`); }
  // GLACIER: an ice tongue from a high snowy cell down its steepest descent, the surface smoothed
  for (const s of pick(2, 4, c => snowW(...xy(c)) > 0.3 && H[c] > SEA + 15)) {
    // toward the lowest cell within 30 (flat snow fields had no strictly-downhill step), wobbling, while it's snowy and free
    let lx = s.x, ly = s.y, lh = H[at(s.x, s.y)];
    for (let k = 0; k < 64; k++) { const a = k / 64 * 6.28, x = Math.round(s.x + Math.cos(a) * 30), y = Math.round(s.y + Math.sin(a) * 30); if (inB(x, y) && H[at(x, y)] < lh && H[at(x, y)] > SEA) { lh = H[at(x, y)]; lx = x; ly = y; } }
    const path = [], L = Math.hypot(lx - s.x, ly - s.y);
    for (let t = 0; t <= L; t += 1) {
      const x = Math.round(s.x + (lx - s.x) * t / L + Math.sin(t / 7) * 2), y = Math.round(s.y + (ly - s.y) * t / L + Math.cos(t / 9) * 2);
      if (!inB(x, y) || !free(at(x, y)) || snowW(x, y) < 0.08) break; path.push([x, y]);
    }
    // a steady descent along it (ice flows smooth)
    const zs = path.map(([x, y]) => H[at(x, y)]), z0 = zs[0] ?? 0, z1 = zs[zs.length - 1] ?? 0;
    if (path.length < 15) continue;
    path.forEach(([px, py], i) => {
      const w = 3 + 2.5 * Math.sin(Math.PI * i / path.length), z = Math.round(z0 + (z1 - z0) * i / Math.max(1, path.length - 1));
      disc(px, py, w, (c, d) => { if (ok(c, KIND.GLACIER)) { H[c] = Math.round((H[c] + z * 3) / 4); cell[c] = KIND.GLACIER; } });
    });
    path.forEach(([px, py]) => claim(px, py, 4)); add('glacier', { ...s, len: path.length });
  }
  // NIVATION HOLLOW: a shallow bowl on the snow line holding a late snow patch, bare rock rim
  for (const s of pick(4, 5, c => { const w = snowW(...xy(c)); return w > 0.2 && w < 0.55 && slope(c) >= 1 && slope(c) <= 5; })) {
    const r = 4 + rnd() * 2, z0 = H[at(s.x, s.y)];
    disc(s.x, s.y, r, (c, d) => { if (ok(c, KIND.NIVATION)) { H[c] = Math.min(H[c], z0 - Math.round(3 * (1 - (d / r) ** 2))); cell[c] = KIND.NIVATION; } });
    claim(s.x, s.y, 6); add('nivation', s);
  }
  // PALSA: frost-heaved peat mounds in a cold bog by the snow fringe
  for (const s of pick(2, 10, c => { const w = snowW(...xy(c)); return w > 0.05 && w < 0.45 && H[c] > SEA + 2 && slope(c) < 3; }, c => H[c] > SEA + 1)) {
    const z0 = H[at(s.x, s.y)];
    disc(s.x, s.y, 10, c => { if (ok(c, KIND.PALSA)) { H[c] = z0; cell[c] = KIND.PALSA; } });
    for (let k = 0; k < 9; k++) {
      const a = rnd() * 6.28, rr = rnd() * 7, x = Math.round(s.x + Math.cos(a) * rr), y = Math.round(s.y + Math.sin(a) * rr), r = 1.6 + rnd() * 1.6, h = 2 + Math.floor(rnd() * 3);
      disc(x, y, r, (c, d) => { if (cell[c] === KIND.PALSA) H[c] = Math.max(H[c], z0 + Math.round(h * (1 - (d / (r + 0.5)) ** 2))); });
    }
    claim(s.x, s.y, 10); add('palsa', s);
  }
  // IMPACT CRATER LAKE: a raised rim, ejecta apron, a bowl down under the sea plane (the water fills it)
  for (const s of pick(1, 17, c => H[c] > SEA + 3 && H[c] < SEA + 34 && slope(c) < 4, c => H[c] > SEA + 1)) {
    const R = 11, z0 = H[at(s.x, s.y)];
    disc(s.x, s.y, 17, (c, d) => {
      if (!ok(c, KIND.CRATER)) return;
      if (d < R - 2) { H[c] = clampH(Math.min(SEA - 1 - Math.round(4 * (1 - d / R)), H[c])); cell[c] = KIND.CRATER_BED; }
      else if (d < R + 1) { H[c] = clampH(z0 + 6); cell[c] = KIND.CRATER; }
      else { H[c] = clampH(Math.max(H[c], z0 + 6 - (d - R - 1) * 0.9)); cell[c] = KIND.CRATER; }
    });
    claim(s.x, s.y, 17); add('crater', s);
  }
  // FJORD: a narrow deep arm of the sea cut far into high coast, sheer rock walls
  for (const s of pick(6, 3, c => H[c] <= SEA && dLand(c) === 1).filter(s => {
    // the land behind must be high: 20 cells inland along the way away from the sea
    return true;
  })) {
    // head inland: step to the neighbour with the biggest distance from the sea, wobbling
    let x = s.x, y = s.y, len = 0; const path = [];
    for (let k = 0; k < 120; k++) {
      path.push([x, y]); let best = null, bd = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx * 2, ny = y + dy * 2; if (!inB(nx, ny)) continue; const c = at(nx, ny);
        const v = dSea(c) + rnd() * 1.5; if (free(c) && v > bd) { bd = v; best = [nx, ny]; }
      }
      if (!best || bd < 0) break; [x, y] = best; len++;
      if (H[at(x, y)] > SEA + 70) break;
    }
    const high = path.filter(([px, py]) => H[at(px, py)] > SEA + 18).length;
    if (path.length < 25 || high < 10) continue;
    path.forEach(([px, py], i) => {
      const w = 2.5 + 1.2 * Math.sin(i / 5);
      disc(px, py, w + 2, (c, d) => {
        if (!free(c)) return;
        if (d <= w) { H[c] = SEA - 6; cell[c] = KIND.FJORD; } else { cell[c] = KIND.FJORD; noSmooth[c] = 1; }
      });
    });
    path.forEach(([px, py]) => claim(px, py, 6)); add('fjord', { ...s, len: path.length }); break;
  }
  // SEA CLIFF + SEA STACKS + ARCH: a stretch of coast raised to a sheer wall over deep water, stacks offshore
  for (const s of pick(1, 18, c => H[c] > SEA + 4 && H[c] < SEA + 30 && dSea(c) <= 2)) {
    let inl = 0; disc(s.x, s.y, 18, c => { if (H[c] > SEA) inl = Math.max(inl, H[c]); });
    const top = clampH(Math.max(inl, SEA + 16));
    disc(s.x, s.y, 18, (c, d, x, y) => {
      if (!ok(c, KIND.CLIFF)) return;
      if (H[c] > SEA && dSea(c) <= 6) { H[c] = Math.max(H[c], top - Math.max(0, dSea(c) - 3) * 0); cell[c] = KIND.CLIFF; if (dSea(c) <= 1) noSmooth[c] = 1; }
      else if (H[c] <= SEA && dLand(c) <= 3) { H[c] = Math.min(H[c], SEA - 5); cell[c] = KIND.CLIFF; }
    });
    // stacks in the water 4-9 cells off the new cliff
    const stacks = [];
    for (let k = 0; k < 40 && stacks.length < 4; k++) {
      const a = rnd() * 6.28, rr = 8 + rnd() * 12, x = Math.round(s.x + Math.cos(a) * rr), y = Math.round(s.y + Math.sin(a) * rr);
      if (!inB(x, y)) continue; const c = at(x, y);
      if (H[c] > SEA || dLand(c) < 4 || dLand(c) > 9 || !free(c)) continue;
      const r = 1.2 + rnd() * 1.4, h = clampH(top - 2 - rnd() * 8);
      disc(x, y, r, cc => { if (free(cc)) { H[cc] = h; cell[cc] = KIND.STACK; noSmooth[cc] = 1; } });
      stacks.push([x, y]);
    }
    claim(s.x, s.y, 20); add('seacliff', { ...s, top, stacks, arch: true });
  }
  // LAGOON + BARRIER BAR: shallow water behind a sand bar on a low coast, one inlet
  for (const s of pick(1, 16, c => H[c] > SEA && H[c] <= SEA + 3 && dSea(c) <= 1)) {
    const inletA = rnd() * 6.28;
    disc(s.x, s.y, 16, (c, d, x, y, dx, dy) => {
      if (!ok(c, KIND.LAGOON)) return;
      const dl = dLand(c);
      if (H[c] <= SEA && dl >= 1 && dl <= 5) { H[c] = SEA - 1 - (dl > 2 ? 1 : 0); cell[c] = KIND.LAGOON; }
      else if (H[c] <= SEA && dl >= 6 && dl <= 8) {
        const a = Math.atan2(dy, dx), gap = Math.abs(((a - inletA + 9.42) % 6.28) - 3.14) < 0.18;
        if (!gap) { H[c] = SEA + 1; cell[c] = KIND.BAR; } else { H[c] = SEA - 2; cell[c] = KIND.LAGOON; }
      } else if (H[c] > SEA && dSea(c) <= 2) { H[c] = Math.min(H[c], SEA + 1); cell[c] = KIND.BEACH; }
    });
    claim(s.x, s.y, 16); add('lagoon', s);
  }
  // CAPE: a headland finger out into the sea, lighthouse on the tip
  for (const s of pick(6, 3, c => H[c] > SEA + 2 && H[c] < SEA + 20 && dSea(c) === 1)) {
    // seaward: toward the neighbour farthest from land within 12 cells
    let bx = 0, by = 0, bd = -1;
    for (let k = 0; k < 32; k++) { const a = k / 32 * 6.28, x = Math.round(s.x + Math.cos(a) * 12), y = Math.round(s.y + Math.sin(a) * 12); if (inB(x, y) && dLand(at(x, y)) > bd) { bd = dLand(at(x, y)); bx = Math.cos(a); by = Math.sin(a); } }
    if (bd < 6) continue;
    const L = 28, z0 = H[at(s.x, s.y)];
    let tip = null, okAll = true;
    for (let i = 0; i <= L && okAll; i++) { const x = Math.round(s.x + bx * i), y = Math.round(s.y + by * i); if (!inB(x, y) || !free(at(x, y))) okAll = false; }
    if (!okAll) continue;
    for (let i = 0; i <= L; i++) {
      const x = Math.round(s.x + bx * i + Math.sin(i / 6) * 1.5), y = Math.round(s.y + by * i + Math.cos(i / 7) * 1.5), w = 6 - 4 * i / L, z = Math.round(z0 + (SEA + 3 - z0) * i / L);
      disc(x, y, w, (c, d) => { if (!ok(c, KIND.CAPE)) return; const zz = d > w - 1.2 ? SEA + 1 : z; if (H[c] < zz) H[c] = zz; cell[c] = d > w - 1.2 ? KIND.BEACH : KIND.CAPE; });
      tip = [x, y];
    }
    claim(s.x, s.y, 4); for (let i = 0; i <= L; i += 3) claim(Math.round(s.x + bx * i), Math.round(s.y + by * i), 7);
    add('cape', { ...s, tip }); break;
  }
  // ARCHIPELAGO: a scatter of small islands in open water
  for (const s of pick(1, 30, c => H[c] <= SEA - 2 && dLand(c) >= 30, c => H[c] <= SEA)) {
    let n = 0;
    for (let k = 0; k < 60 && n < 10; k++) {
      const a = rnd() * 6.28, rr = rnd() * 26, x = Math.round(s.x + Math.cos(a) * rr), y = Math.round(s.y + Math.sin(a) * rr), r = 2 + rnd() * 4;
      if (!inB(x, y) || cell[at(x, y)]) continue;
      const peak = SEA + 2 + Math.floor(rnd() * 6);
      disc(x, y, r + 2, (c, d) => { if (!free(c)) return; const h = d <= r ? Math.round(SEA + 1 + (peak - SEA - 1) * (1 - (d / r) ** 2)) : SEA - 1; if (H[c] < h) H[c] = h; cell[c] = d > r - 1 ? KIND.BEACH : KIND.ISLE; });
      n++;
    }
    claim(s.x, s.y, 30); add('archipelago', { ...s, n });
  }
  // BEACH: a long sand strip with a gentle shore on a plain stretch of coast
  for (const s of pick(2, 14, c => H[c] > SEA && H[c] <= SEA + 8 && dSea(c) <= 1 && desertW(...xy(c)) < 0.3 && snowW(...xy(c)) < 0.2)) {
    disc(s.x, s.y, 14, c => {
      if (!ok(c, KIND.BEACH)) return;
      if (H[c] > SEA && dSea(c) <= 4) { H[c] = Math.min(H[c], SEA + 1 + Math.floor(dSea(c) / 2)); cell[c] = KIND.BEACH; }
      else if (H[c] <= SEA && dLand(c) <= 3) { H[c] = Math.max(H[c], SEA - dLand(c)); cell[c] = KIND.BEACH; }
    });
    claim(s.x, s.y, 14); add('beach', s);
  }
  // BARCHAN DUNES: crescents with the horns downwind; YARDANGS: wind-carved streamlined ridges, same wind
  const wind = rnd() * 6.28, wx = Math.cos(wind), wy = Math.sin(wind);
  for (const s of pick(2, 18, c => desertW(...xy(c)) > 0.55 && slope(c) < 3 && H[c] > SEA + 3, c => desertW(...xy(c)) > 0.35)) {
    for (let k = 0; k < 7; k++) {
      const x = Math.round(s.x + (rnd() - 0.5) * 30), y = Math.round(s.y + (rnd() - 0.5) * 30), r = 4 + rnd() * 3, h = 3 + rnd() * 3, z0 = inB(x, y) ? H[at(x, y)] : 0;
      disc(x, y, r + 1, (c, d, cx, cy, dx, dy) => {
        if (!ok(c, KIND.BARCHAN)) return;
        // crescent: inside the disc, outside a disc pushed downwind (the slip face hollow)
        const hx = dx - wx * r * 0.7, hy = dy - wy * r * 0.7, hollow = Math.hypot(hx, hy) < r * 0.85;
        if (d > r || hollow) return;
        const up = -(dx * wx + dy * wy) / r; // gentle windward slope, steep slip face
        H[c] = Math.max(H[c], clampH(z0 + h * Math.min(1, (1 - d / r) * 1.6) * (0.6 + 0.4 * Math.max(0, up)))); cell[c] = KIND.BARCHAN;
      });
    }
    claim(s.x, s.y, 18); add('barchans', s);
  }
  for (const s of pick(1, 20, c => desertW(...xy(c)) > 0.5 && slope(c) < 4 && H[c] > SEA + 3, c => desertW(...xy(c)) > 0.3)) {
    for (let k = 0; k < 8; k++) {
      const x0 = s.x + (rnd() - 0.5) * 30, y0 = s.y + (rnd() - 0.5) * 30, L = 14 + rnd() * 14, w = 1.6 + rnd() * 1.4, h = 4 + rnd() * 5, z0 = H[at(Math.round(x0), Math.round(y0))] ?? 0;
      for (let t = 0; t <= L; t += 0.5) {
        const f = t / L, ww = w * Math.sin(Math.PI * Math.sqrt(f)), hh = h * (1 - f) ** 0.6; // blunt head upwind, tapering tail
        disc(Math.round(x0 + wx * t), Math.round(y0 + wy * t), ww, (c, d) => { if (ok(c, KIND.YARDANG)) { H[c] = Math.max(H[c], clampH(z0 + hh * (1 - (d / (ww + 0.5)) ** 2))); cell[c] = KIND.YARDANG; } });
      }
    }
    claim(s.x, s.y, 20); add('yardangs', s);
  }
  // CORAL REEF: a shallow shelf off a warm coast, coral heads dressed on it
  for (const s of pick(1, 14, c => H[c] <= SEA - 2 && H[c] >= SEA - 8 && dLand(c) >= 6 && dLand(c) <= 14)) {
    const heads = [];
    disc(s.x, s.y, 14, (c, d, x, y) => { if (ok(c, KIND.REEF) && H[c] <= SEA - 2) { H[c] = Math.max(H[c], SEA - 4 - Math.round(fbm2(x / 5, y / 5, 2) * 2)); cell[c] = KIND.REEF; if (hash(x, y, 9301) < 0.18) heads.push([x, y]); } });
    claim(s.x, s.y, 14); add('reef', { ...s, heads });
  }
  // MID-OCEAN RIDGE (a raised spine with a rift down its middle) and OCEANIC TRENCH (a deep slot), in deep water
  const deep = c => H[c] <= SEA - 3 && dLand(c) >= 30;
  const line = (kind, len, fn) => {
    for (const s of pick(4, 6, deep)) {
      const a = rnd() * 6.28, ux = Math.cos(a), uy = Math.sin(a); let n = 0;
      for (let t = -len / 2; t <= len / 2; t += 0.5) {
        const x = Math.round(s.x + ux * t + Math.sin(t / 17) * 4), y = Math.round(s.y + uy * t + Math.cos(t / 23) * 4);
        if (!inB(x, y) || !deep(at(x, y))) continue; n++;
        disc(x, y, 7, (c, d) => { if (free(c) && H[c] <= SEA - 1 && (!cell[c] || cell[c] === kind)) fn(c, d); });
      }
      if (n > 40) { add(kind === KIND.RIDGE ? 'ridge' : 'trench', { ...s, n }); return; }
    }
  };
  line(KIND.RIDGE, 260, (c, d) => { const h = d < 1.2 ? SEA - 9 : SEA - 4 - Math.round(d * 0.6); if (H[c] < h) { H[c] = h; cell[c] = KIND.RIDGE; } });
  line(KIND.TRENCH, 260, (c, d) => { if (d < 3) { H[c] = Math.min(H[c], 2 + Math.round(d)); cell[c] = KIND.TRENCH; noSmooth[c] = 1; } });

  const tally = {}; for (const s of sites) tally[s.kind] = (tally[s.kind] || 0) + 1;
  log(`landforms: ${JSON.stringify(tally)}`);
  return { cell, sites };
}

/** brick pieces on the finished ground: a sea arch by the cliff, coral heads on the reef, a lighthouse on the cape.
 * ground(x, y) = z of the cell's top face; cw(x, y) = world centre of the cell */
export function dressLandforms({ sites, ground, cw, CELL, push, hash }) {
  const MB = 'PB_DefaultMicroBrick';
  const box = (x0, y0, z0, x1, y1, z1, color, extra = {}) => { // world corners, snapped to the 10 / 2 grid
    const s = v => Math.round(v / 10) * 10, sz = v => Math.round(v / 2) * 2;
    [x0, x1] = [s(x0), s(x1)]; [y0, y1] = [s(y0), s(y1)]; [z0, z1] = [sz(z0), sz(z1)];
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    push({ asset: MB, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...extra });
  };
  let n = 0;
  for (const s of sites) {
    if (s.kind === 'seacliff' && s.stacks.length >= 2) {
      // a sea arch between the first two stacks: a stone lintel over the water
      const [a, b] = s.stacks, [ax, ay] = cw(...a), [bx, by] = cw(...b), za = ground(...a), zb = ground(...b), z = Math.min(za, zb) - 60;
      if (Math.hypot(bx - ax, by - ay) < 700) {
        const x0 = Math.min(ax, bx) - 40, x1 = Math.max(ax, bx) + 40, y0 = Math.min(ay, by) - 40, y1 = Math.max(ay, by) + 40;
        box(x0, y0, z, x1, y1, z + 36, [150, 144, 132]); box(x0, y0, z + 36, x1, y1, z + 40, [96, 126, 70]); n += 2;
      }
    }
    if (s.kind === 'reef') {
      const PAL = [[236, 110, 120], [248, 160, 80], [170, 110, 200], [246, 220, 90], [120, 200, 190], [250, 130, 170]];
      for (const [x, y] of s.heads) {
        const [wx, wy] = cw(x, y), z = ground(x, y), c = PAL[Math.floor(hash(x, y, 9302) * PAL.length)], k = 1 + Math.floor(hash(x, y, 9303) * 3);
        for (let i = 0; i < k; i++) { // a few branching fingers of different heights
          const ox = (hash(x, y, 9310 + i) - 0.5) * 24, oy = (hash(x, y, 9320 + i) - 0.5) * 24, h = 10 + hash(x, y, 9330 + i) * 26;
          box(wx + ox - 5, wy + oy - 5, z, wx + ox + 5, wy + oy + 5, z + h, c); n++;
        }
      }
    }
    if (s.kind === 'cape' && s.tip) {
      const [wx, wy] = cw(...s.tip), z = ground(...s.tip);
      box(wx - 40, wy - 40, z, wx + 40, wy + 40, z + 12, [120, 116, 110]); // plinth
      for (let i = 0; i < 9; i++) box(wx - 20, wy - 20, z + 12 + i * 24, wx + 20, wy + 20, z + 36 + i * 24, i % 2 ? [200, 50, 44] : [238, 236, 230]);
      box(wx - 20, wy - 20, z + 228, wx + 20, wy + 20, z + 252, [255, 236, 170], { material: 'BMC_Glow', material_intensity: 6 });
      box(wx - 30, wy - 30, z + 252, wx + 30, wy + 30, z + 258, [40, 40, 44]); n += 12;
    }
  }
  return n;
}
