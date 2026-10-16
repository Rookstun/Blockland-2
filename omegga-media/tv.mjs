// WIRE TV (EA3.2, brs-js 4): a physical CRT television whose picture is
// played by in-game logic, not streamed bricks. Each video chunk is one
// prefab: the screen (a grid of glow micro bricks, already showing the
// chunk's first frame), the name/channel/clock text displays, and a chip.
// The frames ride inside the chip as ONE number array of packed colour
// changes (pixel * 2^24 + 0xRRGGBB, only pixels that changed enough since the
// last frame) plus a per-frame end index. A 20 Hz clock works out which frame
// is due from Server Uptime and a For Loop chip (B_1x1_Microchip_CountFor)
// walks the changes up to it, recolouring each pixel through a brick ref
// (Set Brick Property, colour). The cabinet (body) is a separate static
// prefab so chunk swaps only replace the screen + chip.
//
// Everything is in file coordinates: origin = the floor under the TV's front
// centre, screen facing -y. Brickadia is left-handed: seen from -y, +x runs
// to the LEFT, so image column 0 sits at +x.

export const OWNER = { id: '7e1e0715-0000-4b0b-9a11-0000000007a1', name: 'Wire TV', display_name: 'Wire TV' };
/** One owner per viewer's TV (exact clears with br.Bricks.Clear; own 10 ms wire budget). */
export const ownerFor = hex12 => ({ id: `7e1e0715-0000-4b0b-9a11-${hex12}`, name: 'Wire TV', display_name: 'Wire TV' });
const PACK = 16777216; // 2^24

/** Geometry of a TV with a W x H picture of P-unit pixels. */
export function layout(W, H, P = 8) {
  const SW = W * P, SH = H * P;              // screen size
  const legH = 60, panelH = 74, bez = 10, frame = 26;
  const z0 = legH + 8 + panelH;               // screen bottom
  const cw = SW / 2 + bez + frame;            // cabinet half width
  const top = z0 + SH + bez + frame;          // cabinet top
  const cols = Math.max(4, Math.floor((2 * cw - 60) / 40));
  const depth = Math.max(200, 8 + 40 * 7 + 40); // room for the gate rows inside the shell
  return { W, H, P, SW, SH, legH, panelH, bez, frame, z0, cw, top, cols, depth, bottom: legH };
}

const pixPos = (L, p) => [L.SW / 2 - L.P / 2 - (p % L.W) * L.P, 0, L.z0 + (L.H - 1 - Math.floor(p / L.W)) * L.P + L.P / 2];

/**
 * frames: array of rgb24 Buffers (W*H*3). Returns { init, data, ends }:
 * init = the first frame's colours per pixel, data = packed changes for frames
 * 1.., ends[f] = data length after frame f (ends[0] = 0). Each frame sends at
 * most `cap` changes, biggest first; a pixel changes when a channel moved more
 * than `thresh` from what the screen shows (so error never piles up past it).
 */
export function encodeFrames(frames, W, H, { thresh = 20, cap = 800, step = 4 } = {}) {
  const N = W * H, q = v => Math.min(255, Math.round(v / step) * step);
  const shown = new Int32Array(N * 3);
  const f0 = frames[0];
  const init = [];
  for (let p = 0; p < N; p++) {
    for (let c = 0; c < 3; c++) shown[p * 3 + c] = q(f0[p * 3 + c]);
    init.push([shown[p * 3], shown[p * 3 + 1], shown[p * 3 + 2]]);
  }
  const data = [], ends = [0];
  const cand = [];
  for (let f = 1; f < frames.length; f++) {
    const fr = frames[f];
    cand.length = 0;
    for (let p = 0; p < N; p++) {
      const o = p * 3;
      const d = Math.max(Math.abs(fr[o] - shown[o]), Math.abs(fr[o + 1] - shown[o + 1]), Math.abs(fr[o + 2] - shown[o + 2]));
      if (d > thresh) cand.push(d * N + p); // sortable: diff, then pixel
    }
    if (cand.length > cap) cand.sort((a, b) => b - a), cand.length = cap;
    cand.sort((a, b) => (a % N) - (b % N)); // in pixel order (nicer scan)
    for (const k of cand) {
      const p = k % N, o = p * 3;
      const r = q(frames[f][o]), g = q(frames[f][o + 1]), b = q(frames[f][o + 2]);
      shown[o] = r; shown[o + 1] = g; shown[o + 2] = b;
      data.push(p * PACK + r * 65536 + g * 256 + b);
    }
    ends.push(data.length);
  }
  return { init, data, ends };
}

const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 8, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 120, G: 255, B: 140, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { R: 0, G: 20, B: 0, A: 255 }, OutlineWidth: 1,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};
export const FONTS = [{ type: 'BrickFontDescriptor', name: 'IosevkaTerm' }, { type: 'BrickFontDescriptor', name: 'Bungee' }];

/** The cabinet: wood box, dark bezel, legs, knobs, speaker grille, rabbit ears. */
export function buildBody(lib, L, { brand = 'ZENITHISH', owner = OWNER } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const WOOD = [150, 96, 54], WOOD2 = [118, 74, 40], BEZ = [26, 26, 28], METAL = [170, 170, 176], GRILLE = [40, 34, 28], KNOB = [210, 196, 160];
  const box = (x0, x1, y0, y1, z0, z1, color, extra = {}) =>
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, owner_index: O, ...extra });
  const { SW, SH, z0, cw, top, depth, bez, legH } = L;
  const sx = SW / 2, sTop = z0 + SH;
  // bezel ring round the screen (proud by 4, screen recessed)
  box(-sx - bez, sx + bez, -6, 2, sTop, sTop + bez, BEZ);
  box(-sx - bez, sx + bez, -6, 2, z0 - bez, z0, BEZ);
  box(-sx - bez, -sx, -6, 2, z0, sTop, BEZ);
  box(sx, sx + bez, -6, 2, z0, sTop, BEZ);
  // wood front frame (top, sides) and the control panel below the screen
  box(-cw, cw, -10, 2, sTop + bez, top, WOOD);
  box(-cw, -sx - bez, -10, 2, z0 - bez, sTop + bez, WOOD);
  box(sx + bez, cw, -10, 2, z0 - bez, sTop + bez, WOOD);
  const pb = legH + 8; // panel bottom
  // panel: wood with a dark inset strip (texts live on the screen prefab, 2 in front of it)
  box(-cw, cw, -10, 2, pb, pb + 8, WOOD);
  box(-cw, -sx - bez, -10, 2, pb + 8, z0 - bez, WOOD);
  box(sx + bez, cw, -10, 2, pb + 8, z0 - bez, WOOD);
  box(-sx - bez, sx + bez, -6, 2, pb + 8, z0 - bez, BEZ);
  // shell: top, bottom, sides, back (8 thick), hollow inside for the chip
  box(-cw, cw, 2, depth, top - 8, top, WOOD2);
  box(-cw, cw, 2, depth, legH, pb, WOOD2);
  box(-cw, -cw + 8, 2, depth, pb, top - 8, WOOD2);
  box(cw - 8, cw, 2, depth, pb, top - 8, WOOD2);
  box(-cw + 8, cw - 8, depth - 8, depth, pb, top - 8, WOOD2);
  // the picture tube's back: a dark block behind the screen, inside the shell, off the gate rows
  // (gates sit in rows from y 40; the screen prefab's own back plate is at y 2..6)
  // legs: 4 tapered posts
  for (const lx of [-cw + 24, cw - 24]) for (const ly of [14, depth - 24]) {
    box(lx - 6, lx + 6, ly - 6, ly + 6, legH / 2, legH, WOOD2);
    box(lx - 4, lx + 4, ly - 4, ly + 4, 2, legH / 2, WOOD2);
    box(lx - 6, lx + 6, ly - 6, ly + 6, 0, 2, METAL);
  }
  // two knobs on the right side frame (seen from the front: right = -x), speaker slats on the top frame
  const kx = -(sx + bez + 13);
  for (const [i, kz] of [sTop - 40, sTop - 84].entries()) {
    box(kx - 10, kx + 10, -16, -10, kz - 10, kz + 10, KNOB);
    box(kx - 2, kx + 2, -20, -16, kz - 2 + (i ? 4 : 0), kz + 8, BEZ);
  }
  for (const s of [1, -1]) for (let x = 76; x + 4 <= cw - 16; x += 12) box(s > 0 ? x : -x - 4, s > 0 ? x + 4 : -x, -12, -10, top - 20, top - 6, GRILLE);
  // brand plate on the top frame
  box(-60, 60, -12, -10, top - 22, top - 8, METAL, { components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, Font: 1, LineHeight: 9, Color: { R: 40, G: 30, B: 20, A: 255 }, Outline: 0, OutlineWidth: 0, Text: brand } }] });
  // rabbit ears: a base and two stepped rods (voxel diagonals) with ball tips
  const ay = depth / 2;
  box(-24, 24, ay - 16, ay + 16, top, top + 10, BEZ);
  for (const s of [1, -1]) {
    let x = s * 8, z = top + 10;
    for (let i = 0; i < 14; i++, x += s * 6, z += 10) box(Math.min(x, x + s * 4), Math.max(x, x + s * 4), ay - 2, ay + 2, z, z + 10, METAL);
    box(Math.min(x, x + s * 8) - 2, Math.max(x, x + s * 8) - 2, ay - 4, ay + 4, z, z + 8, METAL);
  }
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'Wire TV cabinet' }, externalAssets: FONTS });
}

/**
 * One chunk's screen + chip. enc = encodeFrames(); fps; tOff/total = this
 * chunk's start and the whole video's length (seconds, for the clock text);
 * chunk = most changes painted per 0.05 s tick.
 */
export function buildScreen(lib, L, enc, { fps, tOff = 0, total = 0, title = '', channel = 3, chunk = 400, glow = 2, refs = null, owner = OWNER } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const N = L.W * L.H;
  for (let p = 0; p < N; p++) {
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [L.P / 2, 2, L.P / 2], position: pixPos(L, p), color: enc.init[p],
      material: 'BMC_Glow', material_intensity: glow, owner_index: O });
  }
  // back plate behind the pixels (the tube)
  w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [L.SW / 2, 2, L.SH / 2], position: [0, 4, L.z0 + L.SH / 2], color: [6, 6, 8], owner_index: O });

  // gates: rows inside the cabinet shell, hidden
  let slot = 0;
  const gate = (c, data = {}, grid) => {
    const i = grid ? 0 : slot++;
    const pos = grid ? [0, 0, 2] : [-(L.cols - 1) * 20 + (i % L.cols) * 40, 40 + Math.floor(i / L.cols) * 40, L.bottom + 8 + 12];
    if (!grid && pos[1] > L.depth - 30) throw Error('tv: too many gates for the cabinet');
    const h = w.addBrick({ asset: c.BRICK, position: pos, color: [200, 200, 200], owner_index: O, visibility: false, collision: false,
      components: [{ type: c.NAME, data }] }, grid);
    return { h, c };
  };
  const innerSlots = new Map();
  const igate = (grid, c, data = {}) => {
    const i = innerSlots.get(grid) ?? 0; innerSlots.set(grid, i + 1);
    const h = w.addBrick({ asset: c.BRICK, position: [(i % 6) * 40, Math.floor(i / 6) * 40, 2], color: [200, 200, 200], owner_index: O,
      components: [{ type: c.NAME, data }] }, grid);
    return { h, c };
  };
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  const num = v => ({ $variant: 'f64', value: v });
  const str = v => ({ $variant: 'Str', value: v });
  const outPort = c => (c.PORTS.bOutput ? 'bOutput' : 'Output');
  // expression helpers on the main grid: values are [gate, port]
  const K = n => [gate(C.Var, { Value: num(n) }), 'Value'];
  const S = s => [gate(C.Var, { Value: str(s) }), 'Value'];
  const op = (c, a, b) => { const x = gate(c); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (b) wire(...b, x, 'InputB'); return [x, outPort(c)]; };
  const V = n => gate(C.Var, { Value: num(n) });
  const val = v => [v, 'Value'];
  const set = (v, src) => { const s = gate(C.Exec_Var_Set); wire(v, 'VarRef', s, 'VarRef'); wire(...src, s, 'Value'); return s; };
  const chain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1], 'ExecOut', gs[i], 'Exec'); return gs; };
  const select = (a, b, cond) => { const x = gate(C.Expr_Select); wire(...a, x, 'InputA'); wire(...b, x, 'InputB'); wire(...cond, x, 'bSelectB'); return [x, 'Output']; };

  // ---- the For Loop chip: Index -> packed change -> pixel ref -> colour
  const shell = gate(C.Microchip_CountFor, { Count: 0, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
  w.registerMicrochipLink(shell.h, grid);
  const ig = (c, data) => igate(grid, c, data);
  const IK = n => [ig(C.Var, { Value: num(n) }), 'Value'];
  const iop = (c, a, b) => { const x = ig(c); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (b) wire(...b, x, 'InputB'); return [x, outPort(c)]; };
  const entry = ig(C.CallableEntry_CountFor);
  const dataArr = ig(C.ArrayVar, { Value: { $elementType: 'f64', $array: enc.data.length ? enc.data : [0] } });
  const refArr = ig(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: Array.from({ length: N }, (_, p) => ({ $variant: 'BRSavedBrickRef',
    value: refs?.get(pixPos(L, p).join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 } })) } });
  const getD = ig(C.Exec_ArrayVar_Get); wire(dataArr, 'ArrayVarRef', getD, 'ArrayVarRef'); wire(entry, 'Index', getD, 'Index');
  const v = [getD, 'Value'];
  const idx = iop(C.Expr_Floor, iop(C.Expr_MathDivide, v, IK(PACK)));
  const rgb = iop(C.Expr_MathModulo, v, IK(PACK));
  const r = iop(C.Expr_Floor, iop(C.Expr_MathDivide, rgb, IK(65536)));
  const g = iop(C.Expr_MathModulo, iop(C.Expr_Floor, iop(C.Expr_MathDivide, rgb, IK(256))), IK(256));
  const b = iop(C.Expr_MathModulo, rgb, IK(256));
  const mc = ig(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 });
  wire(...r, mc, 'R'); wire(...g, mc, 'G'); wire(...b, mc, 'B');
  const getR = ig(C.Exec_ArrayVar_Get); wire(refArr, 'ArrayVarRef', getR, 'ArrayVarRef'); wire(...idx, getR, 'Index');
  const paint = ig(C.Exec_SetBrickProperty, { Property: 1 }); wire(getR, 'Value', paint, 'Brick'); wire(mc, 'Output', paint, 'Value');
  wire(entry, 'Body', getD, 'Exec'); wire(getD, 'ExecOut', getR, 'Exec'); wire(getR, 'ExecOut', paint, 'Exec');

  // ---- scheduler (main grid)
  const NF = enc.ends.length;
  const t0 = V(0), cur = V(0), playing = V(0);
  const ends = gate(C.ArrayVar, { Value: { $elementType: 'f64', $array: enc.ends } });
  const up = gate(C.Expr_ServerUptime);
  const upP = [up, 'Uptime'];
  // start: a stopwatch fires once just after the load
  const sw = gate(C.Stopwatch, { Limit: 0.1, Time: 0, bRunning: true });
  const swE = gate(C.Expr_EdgeDetectorExec); wire(sw, 'Expired', swE, 'Input');
  const st = chain(set(t0, upP), set(cur, K(0)), set(playing, K(1)));
  wire(swE, 'OnRisingEdge', st[0], 'Exec');
  const el = op(C.Expr_MathSubtract, upP, val(t0)); // seconds since start
  const target = op(C.Expr_MathMin, op(C.Expr_Floor, op(C.Expr_MathMultiply, el, K(fps))), K(NF - 1));
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const go = gate(C.Exec_Branch); wire(...op(C.Expr_CompareGreater, val(playing), K(0.5)), go, 'bCond'); wire(tick, 'OnRisingEdge', go, 'Exec');
  const getE = gate(C.Exec_ArrayVar_Get); wire(ends, 'ArrayVarRef', getE, 'ArrayVarRef'); wire(...target, getE, 'Index');
  wire(go, 'ExecOutA', getE, 'Exec');
  const count = op(C.Expr_MathMin, op(C.Expr_MathSubtract, [getE, 'Value'], val(cur)), K(chunk));
  const any = gate(C.Exec_Branch); wire(...op(C.Expr_CompareGreater, count, K(0.5)), any, 'bCond'); wire(getE, 'ExecOut', any, 'Exec');
  wire(...count, shell, 'Count'); wire(...val(cur), shell, 'FirstIndex');
  wire(any, 'ExecOutA', shell, 'Exec');
  const adv = set(cur, op(C.Expr_MathAdd, val(cur), [shell, 'IterationsExecuted']));
  wire(shell, 'Completed', adv, 'Exec');

  // ---- text on the control panel: channel, title, clock
  const pb = L.legH + 8, pz = (pb + 8 + L.z0 - L.bez) / 2;
  const sx = L.SW / 2;
  const plate = (x0, x1, z0, z1, text, style = {}) => ({
    h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [(x1 - x0) / 2, 1, (z1 - z0) / 2], position: [(x0 + x1) / 2, -7, (z0 + z1) / 2], color: [10, 14, 10],
      owner_index: O, components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, ...style, Text: text } }] }),
    c: C.TextDisplay,
  });
  // seen from the front +x is LEFT: title across the top row, channel (left) and clock (right) below
  plate(-sx, sx, pz + 2, pz + 24, title.slice(0, Math.max(8, Math.floor(L.W * 0.8))), { LineHeight: 8, Color: { R: 255, G: 210, B: 120, A: 255 } });
  plate(sx - 90, sx, pz - 24, pz - 2, `CH ${String(channel).padStart(2, '0')}`, { LineHeight: 10, Font: 1 });
  const clockPlate = plate(-sx, -sx + 150, pz - 24, pz - 2, '', { LineHeight: 9 });
  // clock text: m:ss / m:ss, from the chunk's offset + the time played
  const T = op(C.Expr_MathAdd, K(tOff), op(C.Expr_MathMultiply, val(playing), op(C.Expr_MathMin, el, K(NF / fps))));
  const mins = op(C.Expr_Floor, op(C.Expr_MathDivide, T, K(60)));
  const secs = op(C.Expr_Floor, op(C.Expr_MathModulo, T, K(60)));
  const pad = select(S('0'), S(''), op(C.Expr_CompareGreaterOrEqual, secs, K(10)));
  const tm = Math.floor(total / 60), ts = Math.floor(total % 60);
  const fmt = gate(C.Expr_String_FormatText, { FormatString: `{A}:{B}{C} / ${tm}:${String(ts).padStart(2, '0')}` });
  wire(...mins, fmt, 'InputA'); wire(...pad, fmt, 'InputB'); wire(...secs, fmt, 'InputC');
  wire(fmt, 'Output', clockPlate, 'Text');

  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'Wire TV screen' }, externalAssets: FONTS });
}

/** brick refs of main-grid bricks keyed by "x,y,z" (two-pass build, as ea32test/lib.mjs) */
export function brickRefs(WorldReader, bytes) {
  const r = WorldReader.from(bytes);
  const out = new Map();
  const chunks = r.brickChunkIndex(1);
  let ci = 0, left = chunks[0]?.numBricks ?? 0, i = 0;
  for (const b of r.bricks(1)) {
    while (left === 0) { ci++; i = 0; left = chunks[ci].numBricks; }
    const c = chunks[ci].index;
    out.set(b.position.join(','), { GridPersistentIndex: 1, ChunkIndex: { X: c.x, Y: c.y, Z: c.z }, BrickIndexInChunk: i });
    i++; left--;
  }
  return out;
}

/** Screen prefab with working pixel refs (refs come from a first pass). */
export function screenPrefab(lib, L, enc, opts) {
  const first = buildScreen(lib, L, enc, opts);
  const refs = brickRefs(lib.WorldReader, first);
  const missing = Array.from({ length: L.W * L.H }, (_, p) => refs.get(pixPos(L, p).join(','))).filter(r => !r).length;
  if (missing) throw Error(`tv: ${missing} pixel refs not found`);
  return buildScreen(lib, L, enc, { ...opts, refs });
}

/** Clear boxes (file coords [centre, half]) for a screen prefab: pixels in bands (ClearRegion fails on ~1800+ bricks), texts, gates. */
export function screenBoxes(L) {
  const out = [];
  const band = Math.max(1, Math.floor(600 / L.W));
  for (let r0 = 0; r0 < L.H; r0 += band) {
    const r1 = Math.min(L.H, r0 + band);
    const zLo = L.z0 + (L.H - r1) * L.P, zHi = L.z0 + (L.H - r0) * L.P;
    out.push([[0, 0, (zLo + zHi) / 2], [L.SW / 2, 3, (zHi - zLo) / 2]]);
  }
  out.push([[0, 4, L.z0 + L.SH / 2], [L.SW / 2 + 1, 3, L.SH / 2 + 1]]); // back plate
  const pb = L.legH + 8, pz = (pb + 8 + L.z0 - L.bez) / 2;
  out.push([[0, -7, pz], [L.SW / 2 + 1, 2, 26]]); // text plates
  out.push([[0, (40 + L.depth - 20) / 2, L.bottom + 20], [L.cw - 9, (L.depth - 20 - 40) / 2 + 22, 18]]); // gates
  return out;
}
