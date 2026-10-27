// Freeway (2026-10-26, owner: "highways, sound barriers ... off-ramps"): an elevated interstate (I-404) north of the
// city's outer ring, 1 stud = 1 ft. Deck 4 tiles wide (128 ft) at z 196 (16 ft 8 in clearance): per direction 3 x 12 ft
// lanes, 12 ft right shoulder, 12 ft left shoulder, jersey barriers on both edges and in the median. Traffic on the
// right: westbound (-x) on the city side (low y), eastbound (+x) beyond it. LEFT-HANDED world (right of +x = +y).
// Diamond interchanges at two N-S streets: the street runs north from the ring under the deck to two signalised
// ramp terminals (tile rows NY+1 south of the deck, NY+6 north of it); each terminal has an exit ramp in (one-way
// tiles, then a 10 % ramp on an embankment up to the deck, joining it over a 640-unit diverge / merge zone with the
// shoulder as the auxiliary lane and a dotted lane line) and an entrance ramp out. Overhead guide sign gantries
// (EXIT n / street / 1/2 MILE) upstream of every exit, 65 mph limits, DO NOT ENTER at exit ramp ends, freeway
// entrance signs, median-mounted twin LED luminaires (SpotLight + PointLight). Sound walls (14 ft concrete panels)
// along the ring where the lots behind are residential and not poor; a chain-link right-of-way fence elsewhere.
// The deck ends 6 tiles past each end of the city: down to grade and closed with Type III barricades.
//   freewayPlan(...) -> { extra (tile key -> ramp / stub tile info for roads.mjs), inter, ... }
//   buildFreeway(B, plan, {...}) -> { stats, reserved }
import { plaque } from './ruins.mjs';

const DIR4 = { direction: 4, rotation: 0 };
const TXT = (c, lh) => ({ Font: 5, LineHeight: lh, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, OutlineWidth: 0, Outline: 0 });
const NAME = 'I-404';

export function freewayPlan({ xLines, seg, COLS, ROWS, NY, OX, OY, T, EXT, nsName }) {
  const cand = [];
  for (let i = 1; i < COLS; i++) if (seg.has(`v,${i},${ROWS - 1}`)) cand.push(i);
  const pick = [];
  for (const f of [0.22, 0.78]) {
    const best = cand.filter(i => !pick.includes(i)).sort((a, b) => Math.abs(a - COLS * f) - Math.abs(b - COLS * f))[0];
    if (best != null && pick.every(p => Math.abs(xLines[p] - xLines[best]) >= 24)) pick.push(best);
  }
  pick.sort((a, b) => a - b);
  const extra = new Map(), inter = [];
  for (const [n, i] of pick.entries()) {
    const X = xLines[i], name = nsName(i);
    for (let k = 0; k <= 6; k++) extra.set(`${X},${NY + k}`, { cls: 'arterial', name, signal: k === 0 || k === 1 || k === 6 });
    for (const [row, ow] of [[1, [-1, 0]], [6, [1, 0]]]) for (const dx of [-2, -1, 1, 2])
      extra.set(`${X + dx},${NY + row}`, { ramp: true, cls: 'ramp', oneway: ow, portal: dx === 2 ? ['E'] : dx === -2 ? ['W'] : [] });
    inter.push({ X, i, exit: n + 1, name });
  }
  return { extra, inter, NY, OX, OY, T, EXT };
}

export function buildFreeway(B, plan, { lots, F }) {
  const { inter, NY, OX, OY, T, EXT } = plan;
  const st = { deck: 0, piers: 0, ramps: 0, gantries: 0, lights: 0, wall: 0, fence: 0, signs: 0 };
  const MB = 'PB_DefaultMicroBrick';
  const box = (x0, y0, z0, x1, y1, z1, color, label, extra = {}) => B.box(Math.min(x0, x1), Math.min(y0, y1), z0, Math.max(x0, x1), Math.max(y0, y1), z1, { asset: MB, color, ...DIR4, ...extra }, 'freeway ' + label);
  const surf = (x0, y0, z0, x1, y1, z1, color, label) => { const round = (x1 - x0) % 10 === 0 && (y1 - y0) % 10 === 0;
    return B.box(x0, y0, z0, x1, y1, z1, { asset: round ? 'PB_DefaultSmoothTile' : MB, color, ...DIR4 }, 'freeway ' + label); };
  const put = label => (b, x, y, z) => B.add({ ...b, position: [x, y, z] }, 'freeway ' + label);
  const wx = tx => OX + tx * T, yr = k => OY + (NY + k) * T;
  const Y0 = yr(2), DZ = 196, CON = [172, 168, 160], ASPH = [36, 36, 38], WHITE = [240, 240, 234], YELLOW = [240, 190, 40], GREEN = [16, 104, 56];
  const XF0 = OX - 2 * T, XF1 = EXT[2] + 2 * T, SLOPE = 1920;
  // lateral bands from the deck's south edge (westbound), mirrored for eastbound
  const WB = [[0, 20, 'P'], [20, 136, 'A'], [136, 140, 'W'], [140, 258, 'A'], [258, 262, 'D'], [262, 378, 'A'], [378, 382, 'D'], [382, 500, 'A'], [500, 504, 'Y'], [504, 620, 'A'], [620, 640, 'M']];
  const BANDS = [...WB, ...WB.map(([a, b, k]) => [1280 - b, 1280 - a, k === 'P' ? 'PN' : k]).reverse()].map(([a, b, k]) => [a, b, k === 'P' ? 'PS' : k]);
  const zones = []; // [x0, x1, side 'S'|'N'] deck level merge / diverge zones (no parapet, dotted edge line)
  const ramps = [];
  for (const it of inter) {
    const E = wx(it.X + 3), W = wx(it.X - 2);
    ramps.push({ row: 1, xe: E, sx: 1, kind: 'exit', it }, { row: 1, xe: W, sx: -1, kind: 'entrance', it }, { row: 6, xe: W, sx: -1, kind: 'exit', it }, { row: 6, xe: E, sx: 1, kind: 'entrance', it });
  }
  for (const r of ramps) { const a = r.xe + r.sx * SLOPE, b = a + r.sx * 640; r.z0 = Math.min(a, b); r.z1 = Math.max(a, b); zones.push([r.z0, r.z1, r.row === 1 ? 'S' : 'N']); }
  const inZone = (x0, x1, side) => zones.some(([a, b, s]) => s === side && x0 < b && a < x1);
  const columns = inter.map(it => [wx(it.X) - 40, wx(it.X + 1) + 40]);
  // ---- one 320 chunk of carriageway surface at z0..z0+4, its barriers to z0+36
  const chunk = (x0, x1, z0, { elevated }) => {
    for (const [a, b, k] of BANDS) {
      const y0 = Y0 + a, y1 = Y0 + b;
      if (k === 'PS' || k === 'PN') { if (!(elevated && inZone(x0, x1, k === 'PS' ? 'S' : 'N'))) box(x0, y0, z0, x1, y1, z0 + 36, CON, 'parapet'); else surf(x0, y0, z0, x1, y1, z0 + 4, ASPH, 'asphalt'); continue; }
      if (k === 'M') { box(x0, y0, z0, x1, y1, z0 + 36, CON, 'median barrier'); continue; }
      if (k === 'A') { surf(x0, y0, z0, x1, y1, z0 + 4, ASPH, 'asphalt'); continue; }
      const col = k === 'Y' ? YELLOW : WHITE;
      const dotted = k === 'W' && elevated && inZone(x0, x1, a < 640 ? 'S' : 'N');
      if (k === 'D' || dotted) { const on = dotted ? 20 : 80, per = dotted ? 40 : 320;
        for (let x = x0; x < x1; x += per) { surf(x, y0, z0, x + on, y1, z0 + 4, col, 'line'); surf(x + on, y0, z0, Math.min(x1, x + per), y1, z0 + 4, ASPH, 'asphalt'); } }
      else surf(x0, y0, z0, x1, y1, z0 + 4, col, 'line');
    }
  };
  // ---- deck, piers
  for (let x = XF0; x < XF1; x += T) {
    for (let q = 0; q < 4; q++) box(x, Y0 + q * 320, 168, x + T, Y0 + (q + 1) * 320, 192, CON, 'deck');
    chunk(x, x + T, 192, { elevated: true });
    st.deck++;
    if ((x - XF0) % 640 === 0 && !columns.some(([a, b]) => x + 20 > a && x - 20 < b)) {
      for (const [c0, c1] of [[40, 600], [680, 1240]]) {
        const yc = Y0 + (c0 + c1) / 2;
        box(x - 20, yc - 20, 0, x + 20, yc + 20, 144, CON, 'pier');
        box(x - 20, Y0 + c0, 144, x + 20, Y0 + c1, 168, CON, 'pier cap');
      }
      st.piers++;
    }
  }
  // ---- ends: 10 % down to grade (fill + wedges), two tiles at grade, barricade
  for (const [edge, sx] of [[XF0, -1], [XF1, 1]]) {
    for (let k = 0; k < 12; k++) {
      const xa = edge + sx * (SLOPE - (k + 1) * 160), xb = xa + sx * 160, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), zb = 4 + 16 * k;
      for (const [a, b] of [[20, 340], [340, 620], [660, 940], [940, 1260]]) {
        if (zb > 0) box(x0, Y0 + a, 0, x1, Y0 + b, zb, CON, 'fill');
        B.wedge(x0, Y0 + a, zb, x1, Y0 + b, zb + 16, -sx, 0, { color: ASPH }, 'freeway ramp');
      }
      for (const [a, b] of [[0, 20], [620, 660], [1260, 1280]]) box(x0, Y0 + a, 0, x1, Y0 + b, zb + 16 + 32, CON, 'barrier');
    }
    const g0 = sx < 0 ? edge - SLOPE - 640 : edge + SLOPE, g1 = g0 + 640;
    for (let x = g0; x < g1; x += T) chunk(x, x + T, 0, { elevated: false });
    // Type III barricade across the carriageways + ROAD CLOSED
    const bx = sx < 0 ? g0 + 20 : g1 - 20;
    for (let y = Y0 + 40; y + 120 <= Y0 + 1240; y += 160) {
      if (y < Y0 + 660 && y + 120 > Y0 + 620) continue;
      box(bx - 2, y, 4, bx + 2, y + 4, 60, WHITE, 'barricade'); box(bx - 2, y + 116, 4, bx + 2, y + 120, 60, WHITE, 'barricade');
      for (const z of [20, 36, 52]) for (let s = 0; s < 112; s += 16) box(bx - 2, y + 4 + s, z, bx + 2, y + 4 + Math.min(112, s + 16), z + 6, (s / 16 + z / 16) % 2 < 1 ? [240, 110, 20] : WHITE, 'barricade');
    }
    plaque({ put: put('sign'), facing: [-sx, 0], x: bx - sx * 6, y: Y0 + 320, z: 80, w: 60, h: 10, color: WHITE, text: 'ROAD CLOSED', style: TXT([20, 20, 22], 1.6) });
    plaque({ put: put('sign'), facing: [-sx, 0], x: bx - sx * 6, y: Y0 + 960, z: 80, w: 60, h: 10, color: WHITE, text: 'ROAD CLOSED', style: TXT([20, 20, 22], 1.6) });
  }
  // ---- ramps: embankment slope from the portal tile edge up to deck height, then the deck-level zone
  for (const r of ramps) {
    const yb = yr(r.row), A0 = yb + 40, A1 = yb + 280, inner = r.row === 1 ? 'N' : 'S'; // inner = the deck side
    for (let k = 0; k < 12; k++) {
      const xa = r.xe + r.sx * k * 160, xb = xa + r.sx * 160, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), zb = 4 + 16 * k;
      box(x0, A0, 0, x1, A1, zb, CON, 'fill');
      B.wedge(x0, A0, zb, x1, A1, zb + 16, r.sx, 0, { color: ASPH }, 'freeway ramp');
      box(x0, yb + 20, 0, x1, A0, zb + 16 + 32, CON, 'ramp wall'); box(x0, A1, 0, x1, yb + 300, zb + 16 + 32, CON, 'ramp wall');
    }
    // zone: slab joining the deck edge, outer wall only, closed at its far end
    const s0 = inner === 'N' ? A0 : Y0 + 1280, s1 = inner === 'N' ? Y0 : A1;
    box(r.z0, s0, 168, r.z1, s1, 192, CON, 'ramp deck');
    for (let x = r.z0; x < r.z1; x += 320) surf(x, s0, 192, x + 320, s1, 196, ASPH, 'asphalt');
    const ow0 = inner === 'N' ? yb + 20 : A1, ow1 = inner === 'N' ? A0 : yb + 300;
    box(r.z0, ow0, 192, r.z1, ow1, 228, CON, 'ramp wall');
    const far = r.sx > 0 ? r.z1 - 20 : r.z0;
    box(far, inner === 'N' ? ow1 : s0, 196, far + 20, inner === 'N' ? s1 : ow0, 228, CON, 'ramp end wall');
    for (const xm of [r.z0 + 160, r.z1 - 160]) box(xm - 16, (s0 + s1) / 2 - 16, 0, xm + 16, (s0 + s1) / 2 + 16, 168, CON, 'pier');
    st.ramps++;
    // ground signs at the portal tiles
    const gy = [yb + 20, yb + 300];
    if (r.kind === 'exit') { // DO NOT ENTER facing the terminal (wrong-way drivers would come from it)
      const x = r.xe - r.sx * 2 * T + r.sx * 80, f = [-r.sx, 0];
      for (const y of gy) if (groundSign(x, y, f, 'DO NOT ENTER', [196, 32, 36], WHITE, 18, 8)) st.signs++;
    } else {
      const x = r.xe - r.sx * T - r.sx * 160, f = [-r.sx, 0], y = r.row === 1 ? yb + 20 : yb + 300;
      if (groundSign(x, y, f, `${NAME} ${r.sx < 0 ? 'WEST' : 'EAST'}`, GREEN, WHITE, 24, 8)) st.signs++;
    }
  }
  function groundSign(x, y, f, text, bg, fg, w, h) {
    if (!box(x - 2, y - 2, 2, x + 2, y + 2, 90, [150, 152, 156], 'sign post', { material: 'BMC_Metallic' })) return false;
    plaque({ put: put('sign'), facing: f, x: x + f[0] * 3, y: y + f[1] * 3, z: 80, w, h, color: bg, text, style: TXT(fg, 0.8) });
    return true;
  }
  // ---- guide sign gantries upstream of every exit
  for (const r of ramps.filter(q => q.kind === 'exit')) {
    const wb = r.row === 1, gx = wb ? r.z1 + 480 : r.z0 - 480, f = [wb ? 1 : -1, 0];
    const [pa, pb] = wb ? [[0, 20], [620, 640]] : [[1260, 1280], [640, 660]];
    for (const [a, b] of [pa, pb]) box(gx - 10, Y0 + a, 228, gx + 10, Y0 + b, 436, [150, 152, 156], 'gantry post', { material: 'BMC_Metallic' });
    const L0 = wb ? 20 : 660, L1 = wb ? 620 : 1260;
    box(gx - 6, Y0 + L0, 420, gx + 6, Y0 + L1, 436, [150, 152, 156], 'gantry truss', { material: 'BMC_Metallic' });
    const px = gx + f[0] * 7, mid = Y0 + (wb ? 320 : 960);
    plaque({ put: put('sign'), facing: f, x: px, y: mid, z: 380, w: 180, h: 20, color: GREEN, text: r.it.name, style: TXT(WHITE, 3) });
    plaque({ put: put('sign'), facing: f, x: px, y: mid, z: 350, w: 180, h: 10, color: GREEN, text: '1/2 MILE', style: TXT(WHITE, 1.4) });
    plaque({ put: put('sign'), facing: f, x: px, y: mid + (wb ? -1 : 1) * 140, z: 410, w: 40, h: 10, color: GREEN, text: `EXIT ${r.it.exit}`, style: TXT(WHITE, 1.2) });
    st.gantries++;
  }
  // ---- 65 mph on the right parapets, median twin luminaires
  for (let x = XF0 + 960; x < XF1 - 960; x += 3200) for (const wb of [true, false]) {
    const y = Y0 + (wb ? 10 : 1270), f = [wb ? 1 : -1, 0];
    if (inZone(x - 40, x + 40, wb ? 'S' : 'N')) continue;
    if (!box(x - 2, y - 2, 228, x + 2, y + 2, 300, [150, 152, 156], 'sign post', { material: 'BMC_Metallic' })) continue;
    plaque({ put: put('sign'), facing: f, x: x + f[0] * 3, y, z: 290, w: 14, h: 5, color: WHITE, text: 'SPEED LIMIT', style: TXT([20, 20, 22], 0.7) });
    plaque({ put: put('sign'), facing: f, x: x + f[0] * 3, y, z: 270, w: 14, h: 15, color: WHITE, text: '65', style: TXT([20, 20, 22], 3) });
    st.signs++;
  }
  const LED = { R: 226, G: 234, B: 255, A: 255 };
  const spot = { type: 'Component_SpotLight', data: { Rotation: { Pitch: 270, Yaw: 0, Roll: 0 }, InnerConeAngle: 45, OuterConeAngle: 80, bEnabled: true, Brightness: 12, Radius: 1400, Color: LED, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } };
  const glow = { type: 'Component_PointLight', data: { bMatchBrickShape: true, bEnabled: true, Brightness: 3, Radius: 60, Color: LED, bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } };
  for (let x = XF0 + 320; x < XF1; x += 640) {
    const y = Y0 + 640;
    if (ramps.some(r => Math.abs((r.row === 1 ? r.z1 + 480 : r.z0 - 480) - x) < 60)) continue;
    if (!box(x - 4, y - 4, 228, x + 4, y + 4, 420, [150, 152, 156], 'light pole', { material: 'BMC_Metallic' })) continue;
    for (const sg of [-1, 1]) {
      box(x - 2, y + sg * 4, 412, x + 2, y + sg * 124, 416, [150, 152, 156], 'light arm', { material: 'BMC_Metallic' });
      box(x - 6, y + sg * 124, 408, x + 6, y + sg * 146, 418, [120, 124, 128], 'light head', { material: 'BMC_Metallic' });
      box(x - 4, y + sg * 126, 406, x + 4, y + sg * 144, 408, [255, 236, 200], 'light lens', { material: 'BMC_Glass', components: [spot, glow] });
      st.lights++;
    }
  }
  // ---- sound walls / right-of-way fence north of the ring sidewalk
  const wy0 = yr(0) + 40, lotAt = x => lots.find(L => L.side === 'N' && L.y1 === EXT[3] - T && L.x0 <= x && x < L.x1);
  for (let x = OX; x + 160 <= EXT[2]; x += 160) {
    if (columns.some(([a, b]) => x + 160 > a && x < b)) continue;
    const L = lotAt(x + 80), quiet = L && (L.kind === 'residential' || L.kind === 'park') && F.income(x + 80, L.y0) >= 0.35;
    if (quiet) {
      box(x, wy0 - 5, 0, x + 30, wy0 + 25, 148, [156, 150, 140], 'sound wall post');
      box(x + 30, wy0, 0, x + 160, wy0 + 20, 140, (x / 160) % 2 ? [178, 172, 160] : [170, 164, 152], 'sound wall');
      box(x + 30, wy0 - 2, 140, x + 160, wy0 + 22, 144, [150, 144, 134], 'sound wall cap');
      st.wall++;
    } else {
      box(x, wy0 + 5, 0, x + 10, wy0 + 15, 60, [150, 152, 156], 'fence post', { material: 'BMC_Metallic' });
      box(x + 10, wy0 + 9, 0, x + 160, wy0 + 11, 56, [140, 142, 146], 'fence mesh', { material: 'BMC_Glass' });
      box(x + 10, wy0 + 5, 56, x + 160, wy0 + 15, 60, [150, 152, 156], 'fence rail', { material: 'BMC_Metallic' });
      st.fence++;
    }
  }
  const reserved = [{ x0: XF0 - SLOPE - 700, x1: XF1 + SLOPE + 700, y0: Y0 - 10, y1: Y0 + 1290 }];
  return { stats: st, reserved };
}
