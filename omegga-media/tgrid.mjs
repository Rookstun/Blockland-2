// T-GRID (2026-10-18, owner: "4x4 text on one microbrick ... 16:9 micro bricks", "you have for and each loops"):
// /ogrid as a 16:9 wall of micro-brick TILES, each holding a k x k block (█) picture in its own
// TextDisplay. Only tiles that changed get new text, so still parts of a video cost nothing.
//
// RECEIVER (one per session, stays put): tw x th tile bricks + a Custom Global Event gate. Each event
// (DataOut1) = a PACKET of tile updates, entryLen chars each: 2 chars tile index (ALPHA base 85) + k*k
// cells x 6 hex colour. A For loop over the entries builds each tile's text (one <color="hex">GLYPH</>
// per cell, rows by FormatText) and sets it through the tile's brick ref: ArrayVar_Get(ref) -> Get
// Component (TextDisplay) -> Set Component Property 'Text'. ComponentType = index of the external asset
// {BrickComponentTypeBase, Component_TextDisplay} (as the game saves it; ea32test/tiletext.mjs).
// One event per tile failed: the game drops global events past a handful a tick ("Too many events at once!").
// CARTRIDGE (one per chunk): packets[] + due[] (frame each packet belongs to); a 20 Hz clock sends the
// next packet once its frame is due (Stopwatch from load), at most one a tick.
//
// File coordinates: origin = floor under the screen centre, screen facing -y. Brickadia is
// left-handed: seen from -y, +x is LEFT, so tile column 0 sits at +x.

export const GLYPH = '█';
const EVENT_SIZE = [10, 5, 2];
const EVENT_REST = Object.fromEntries([3, 4, 5, 6, 7, 8].map(i => [`DataOut${i}`, { $variant: 'f64', value: 0 }]));
const SEND_REST = Object.fromEntries([3, 4, 5, 6, 7, 8].map(i => [`DataIn${i}`, { $variant: 'f64', value: 0 }]));
const FONTS = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }, { type: 'BrickComponentTypeBase', name: 'Component_TextDisplay' }];
const TD = 1; // FONTS index of the TextDisplay component type

const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 1, WidthScale: 2, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 24, G: 24, B: 28, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};

/**
 * tw x th tiles of k x k cells, cell = block pitch (units). MonaspaceKrypton (measured 2026-10-18):
 * row pitch = 1.55 x LineHeight, blocks square at WidthScale 2. fit < 1 leaves a hairline instead of
 * an overlap (overlapping text of two tiles z-fights).
 */
// /stream panel mode (2026-10-18): depth = tile half depth, frame false = no bars (the owner's panel has its
// own frame; its boxes must not touch it), gate = offset of every hidden gate (the sky over a wall panel),
// colour = blank tile colour.
// gstep = receiver gate spacing (/stream tv packs them behind its cabinet: 20)
export function tLayout({ tw = 64, th = 36, k = 4, cell = 2, lift = 20, pitch = 1.55, ws = 2, fit = 1, depth = 2, frame = true, gate = [0, 0, 0], colour = [6, 6, 8], gstep = 40, lanes = 1 } = {}) {
  const tile = k * cell;
  if (tile % 2) throw Error('tile side must be a multiple of 2 units');
  const width = tw * tile, height = th * tile;
  return { tw, th, k, cell, tile, cols: tw * k, rows: th * k, width, height, hw: width / 2 + 4, side: height + 8, z0: lift, ws, depth, frame, gate, colour, gstep, lanes,
    textLH: +((cell * fit) / pitch).toFixed(4), aspect: width / height };
}

export const tilePos = (L, t) => {
  const tx = t % L.tw, ty = Math.floor(t / L.tw);
  return [L.width / 2 - L.tile / 2 - tx * L.tile, 0, L.z0 + 4 + L.height - L.tile / 2 - ty * L.tile];
};

const hex = v => v.toString(16).padStart(2, '0');

export const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$&()*+,-./:;=?@[]^_|~';
const B = ALPHA.length;
export const entryLen = L => 2 + L.k * L.k * 6;
// entries one receiver applies a packet inside its owner's 10 ms wire budget (2026-10-20: 128 at 3x3)
export const perPacket = L => Math.floor(1152 / (L.k * L.k));

// LANES (2026-10-23, owner: "a bit more expensive and run better and less pixel tearing"): the wire budget is
// per OWNER, so a TV with n lanes has n receivers, each in its own hidden chip with its own owner and event
// (lane 0 = the TV's owner + event, lane j = laneOwner(owner, j) + `${event}.${j}`). A tick sends one packet
// on every lane: n x the tiles a tick, so a whole frame lands in one tick instead of tearing over several.
export const laneEvent = (event, j) => (j ? `${event}.${j}` : event);
export const laneOwner = (owner, j) => (j ? { ...owner, id: owner.id.slice(0, -2) + ((parseInt(owner.id.slice(-2), 16) + j) % 256).toString(16).padStart(2, '0'),
  name: `${owner.name} ${j + 1}`, display_name: `${owner.display_name ?? owner.name} ${j + 1}` } : owner);

/** What the receiver makes of one entry (JS mirror, for checks): [tile, text]. */
export function decodeEntry(e, L) {
  const t = ALPHA.indexOf(e[0]) * B + ALPHA.indexOf(e[1]);
  const rows = [];
  for (let r = 0; r < L.k; r++) {
    let s = '';
    for (let c = 0; c < L.k; c++) s += `<color="${e.substr(2 + (r * L.k + c) * 6, 6)}">${GLYPH}</>`;
    rows.push(s);
  }
  return [t, rows.join('\n')];
}

/** Encoder state carried across chunks: what every tile shows now (null = never drawn). */
export const newState = L => ({ shown: Array.from({ length: L.tw * L.th }, () => null), frame: 0 });

/**
 * rgb24 frames (cols x rows) -> { packets, due } for one cartridge. Per frame: tiles whose cells moved
 * more than `thresh` (max channel) from what they show, worst first, as many as fit the packets the
 * frame's time allows (`perSec` packets a second, `per` entries a packet); the very first frame of a
 * session draws every tile (it catches up over a few ticks). `step` quantises colours.
 */
// refresh = tiles a frame re-sent although unchanged, longest-unsent first: a lost packet or a slow drift
// under thresh heals within T / refresh frames (owner 2026-10-18: tiles "left behind").
// full = session frames that redraw every tile (the first packets can arrive before a just-loaded
// receiver is live: 2026-10-20 the top 9 rows = one lost 288-tile packet stayed black). refresh slots are
// reserved even on busy frames, so stale tiles always heal (T / refresh frames for a whole pass).
export function encodeTiles(frames, L, state, { fps, thresh = 28, per = 120, perSec = 20, step = 8, refresh = 0, full = [0], lanes = 1 } = {}) {
  const packets = [], due = [], lane = [];
  const q = v => Math.min(255, Math.round(v / step) * step);
  const T = L.tw * L.th, slots = Math.max(1, Math.floor(perSec / fps)) * lanes;
  frames.forEach((fr, fi) => {
    const cand = [], tiles = new Array(T);
    for (let t = 0; t < T; t++) {
      const tx = t % L.tw, ty = Math.floor(t / L.tw), cells = [];
      for (let r = 0; r < L.k; r++) for (let c = 0; c < L.k; c++) {
        const o = ((ty * L.k + r) * L.cols + tx * L.k + c) * 3;
        cells.push([q(fr[o]), q(fr[o + 1]), q(fr[o + 2])]);
      }
      tiles[t] = cells;
      const old = state.shown[t];
      let d = Infinity;
      if (old) { d = 0; for (let i = 0; i < cells.length; i++) for (let ch = 0; ch < 3; ch++) d = Math.max(d, Math.abs(cells[i][ch] - old[i][ch])); }
      if (d > thresh) cand.push([d, t]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    const all = full.includes(state.frame);
    const take = all ? cand.length : Math.min(slots * per - (refresh && state.frame > 0 ? Math.min(refresh, slots * per) : 0), cand.length);
    const send = all ? [...Array(T).keys()] : cand.slice(0, take).map(c => c[1]);
    if (refresh && !all) {
      state.sent ??= new Array(T).fill(0);
      const inSend = new Set(send);
      const room = Math.min(refresh, slots * per - send.length);
      const old = [...Array(T).keys()].filter(t => !inSend.has(t)).sort((a, b) => state.sent[a] - state.sent[b]).slice(0, Math.max(0, room));
      send.push(...old);
    }
    let pk = '', n = 0, np = 0;
    // tiles top row first, so a frame bigger than one tick fills in top-down rather than in specks
    if (!all) send.sort((a, b) => a - b);
    for (const t of send) {
      if (state.sent) state.sent[t] = state.frame;
      state.shown[t] = tiles[t];
      pk += ALPHA[Math.floor(t / B)] + ALPHA[t % B] + tiles[t].map(c => c.map(hex).join('')).join('');
      if (++n === per) { packets.push(pk); due.push(fi); lane.push(np++ % lanes); pk = ''; n = 0; }
    }
    if (n) { packets.push(pk); due.push(fi); lane.push(np++ % lanes); }
    state.frame++;
  });
  return { packets, due, lane };
}

function kit(lib, owner) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  // a hidden microchip (house rule: invisible, no collision; addMicrochip can't, so by hand) whose inner grid
  // holds gates: gate bricks inside it don't need room in the build (owner 2026-10-20: "put your shit in a microchip")
  const chip = (position, parent, owner_index = O, ext = [100, 60]) => {
    const brick = w.addBrick({ asset: 'B_1x1_Microchip', position, owner_index, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] }, parent);
    const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
      data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: ext[0], Y: ext[1], Z: 2 } } });
    w.registerMicrochipLink(brick, grid);
    return grid;
  };
  return { w, C, O, wire, chip, num: v => ({ $variant: 'f64', value: v }), str: v => ({ $variant: 'Str', value: v }) };
}

const REF0 = { GridPersistentIndex: 0, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 4294967295 };

// paint false = no brick colour write per tile (/stream: halves what goes to clients; owner saw tearing)
// /stream tv: physics = the whole prefab is one loose physics grid (tiles, gates, cabinet move together),
// extra(kit) adds the TV body and its own gates; it runs after the tiles so their brick refs stay put
// inChip = every gate inside one hidden microchip at the gate spot (the TV: one chip in its hollow back)
function buildReceiverOnce(lib, L, { event, owner, refs = null, debug = false, paint: doPaint = true, physics = false, extra = null, inChip = false }) {
  const { w, C, O, wire, num, str, chip } = kit(lib, owner);
  // physics: everything on ONE loose grid (gravity on: the writer's default grid data floats away)
  const G = physics ? w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: false, owner_index: O,
    data: { BouyancyScale: 0.2, MassScale: 1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: '' } }) : undefined;
  const T = L.tw * L.th;
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.textLH, WidthScale: L.ws } };
  for (let t = 0; t < T; t++) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [L.tile / 2, L.depth, L.tile / 2], position: tilePos(L, t), color: L.colour, owner_index: O, components: [face] }, G);
  // frame bars
  if (L.frame) for (const zc of [L.z0 + 2, L.z0 + L.side - 2]) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [L.hw, 2, 2], position: [0, 0, zc], color: [6, 6, 8], owner_index: O });
  if (L.frame) for (const xc of [L.width / 2 + 2, -L.width / 2 - 2]) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [2, 2, L.height / 2], position: [xc, 0, L.z0 + 4 + L.height / 2], color: [6, 6, 8], owner_index: O });
  const lanes = inChip ? L.lanes ?? 1 : 1;
  let gate0 = null;
  for (let lj = 0; lj < lanes; lj++) {
  // lane j: own owner, own chip (spread across the hollow back), own event
  const OL = lj ? w.addOwner(laneOwner(owner, lj)) : O;
  let i = 0;
  // lane chips 3 across x 2 high (12 apart), so the cabinet only has to be as wide as its screen
  const CG = inChip ? chip([L.gate[0] + [0, -12, 12][lj % 3], L.gate[1] + 22, L.gate[2] + L.z0 + 10 + (Math.floor(lj / 3) % 2 ? -7 : 7)], G, OL) : null;
  const gate = (c, data = {}, extra = {}) => {
    if (CG) {
      const h = w.addBrick({ asset: c.BRICK, position: [(i % 8) * 20, Math.floor(i / 8) * 20, 2], color: [200, 200, 200], owner_index: OL, components: [{ type: c.NAME, data }], ...extra }, CG);
      i++;
      return { h, c };
    }
    const g = L.gstep ?? 40;
    const h = w.addBrick({ asset: c.BRICK, position: [L.gate[0] - 3.5 * g + (i % 8) * g, L.gate[1] + g + Math.floor(i / 8) * g, L.gate[2] + L.z0 + 10], color: [200, 200, 200], owner_index: O,
      visibility: false, collision: false, components: [{ type: c.NAME, data }], ...extra }, G);
    i++;
    if (i > RECV_ROWS * 8) throw Error('tgrid: receiver gates overflow');
    return { h, c };
  };
  if (!lj) gate0 = gate;
  const out = c => (c.PORTS.bOutput ? 'bOutput' : 'Output');
  const E = entryLen(L);
  const ev = gate(C.Event_CustomGlobal, { EventName: laneEvent(event, lj), bIsObjectEvent: false, DataOut1: str(''), DataOut2: num(0), ...EVENT_REST }, { size: EVENT_SIZE });
  // the packet straight off the event: a Var Set then read in the same exec chain gave the PREVIOUS
  // packet (2026-10-20 debug: packet 0 applied 0 entries = the top 9 panel rows never drawn)
  const PKT = 'DataOut1';
  const shell = gate(C.Microchip_CountFor, { Count: 0, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
  const len = gate(C.Expr_String_Length); wire(ev, PKT, len, 'Input');
  const dv = gate(C.Expr_MathDivide, { InputB: num(E) }); wire(len, 'Output', dv, 'InputA');
  const fl = gate(C.Expr_Floor); wire(dv, 'Output', fl, 'Input'); wire(fl, 'Output', shell, 'Count');
  wire(ev, 'ExecOut', shell, 'Exec');
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
  w.registerMicrochipLink(shell.h, grid);
  let j = 0;
  const ig = (c, data = {}) => { const h = w.addBrick({ asset: c.BRICK, position: [(j % 10) * 40, Math.floor(j / 10) * 40, 2], color: [200, 200, 200], owner_index: OL, components: [{ type: c.NAME, data }] }, grid); j++; return { h, c }; };
  const iop = (c, a, bb, data = {}) => { const x = ig(c, data); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (bb) wire(...bb, x, 'InputB'); return [x, out(c)]; };
  const din = ig(C.MicrochipInput, { PortLabel: 'pkt', PortOrder: 0 }); wire(ev, PKT, din, 'RER_Input');
  const data = [din, 'RER_Output'];
  const entry = ig(C.CallableEntry_CountFor);
  const base = iop(C.Expr_MathMultiply, [entry, 'Index'], null, { InputB: num(E) });
  const at = off => (off ? iop(C.Expr_MathAdd, base, null, { InputB: num(off) }) : base);
  const sub = (start, n) => { const x = ig(C.Expr_String_Substring, { Input: '', Start: 0, Length: n }); wire(...data, x, 'Input'); wire(...start, x, 'Start'); return [x, 'Output']; };
  const digit = off => { const x = ig(C.Expr_String_Find, { Input: ALPHA, Search: '', Start: 0, bCaseSensitive: true }); wire(...sub(at(off), 1), x, 'Search'); return [x, 'Output']; };
  const tIdx = iop(C.Expr_MathAdd, iop(C.Expr_MathMultiply, digit(0), null, { InputB: num(B) }), digit(1));
  // FormatText has 7 inputs (A-G): longer joins chain through more FormatTexts (k > 7 tiles)
  const LET = 'ABCDEFG';
  const fmt = (srcs, item, sep = '') => {
    if (srcs.length <= 7) {
      const f = ig(C.Expr_String_FormatText, { FormatString: srcs.map((_, i) => item(LET[i])).join(sep) });
      srcs.forEach((s, i) => wire(...s, f, `Input${LET[i]}`));
      return [f, 'Output'];
    }
    const h = Math.ceil(srcs.length / 2);
    return fmt([fmt(srcs.slice(0, h), item, sep), fmt(srcs.slice(h), item, sep)], c => `{${c}}`, sep);
  };
  const rowsOut = Array.from({ length: L.k }, (_, r) => fmt(Array.from({ length: L.k }, (_, c) => sub(at(2 + (r * L.k + c) * 6), 6)), c => `<color="{${c}}">${GLYPH}</>`));
  const tf = fmt(rowsOut, c => `{${c}}`, '\n')[0];
  const refArr = ig(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: Array.from({ length: T }, (_, t) => ({ $variant: 'BRSavedBrickRef',
    value: refs?.get(tilePos(L, t).join(',')) ?? { GridPersistentIndex: physics ? 2 : 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 } })) } });
  const getR = ig(C.Exec_ArrayVar_Get); wire(refArr, 'ArrayVarRef', getR, 'ArrayVarRef'); wire(...tIdx, getR, 'Index');
  const getC = ig(C.Exec_GetComponent, { Brick: REF0, ComponentType: TD }); wire(getR, 'Value', getC, 'Brick');
  const setT = ig(C.Exec_SetComponentProperty, { Value: str(''), Component: { Brick: REF0, ComponentTypeIndex: 0 }, PropertyName: 'Text', ComponentType: TD });
  wire(getC, 'Component', setT, 'Component'); wire(tf, 'Output', setT, 'Value');
  wire(entry, 'Body', getR, 'Exec'); wire(getR, 'ExecOut', getC, 'Exec'); wire(getC, 'ExecOut', setT, 'Exec');
  // the tile brick takes an inner cell's colour: the hairline round the text (fit < 1) then matches the picture
  if (doPaint) {
    const mid = Math.floor(L.k / 2) * (L.k + 1);
    const mc = ig(C.Expr_MakeColorHex, { Hex: '' }); wire(...sub(at(2 + mid * 6), 6), mc, 'Hex');
    const paint = ig(C.Exec_SetBrickProperty, { Value: { $variant: 'f64', value: 0 }, Brick: REF0, Property: 1 });
    wire(getR, 'Value', paint, 'Brick'); wire(mc, 'Output', paint, 'Value'); wire(setT, 'ExecOut', paint, 'Exec');
  }
  if (debug) {
    // per packet: entries done | packet length
    const f = gate(C.Expr_String_FormatText, { FormatString: `tgrid${lj ? lj : ''}|{A}|{B}` }); wire(shell, 'IterationsExecuted', f, 'InputA'); wire(len, 'Output', f, 'InputB');
    const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(shell, 'Completed', p, 'Exec');
  }
  }
  const gate = gate0;
  if (extra) extra({ w, C, O, wire, num, str, gate, G });
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'T grid receiver' }, externalAssets: FONTS });
}

/** brick refs of main-grid bricks keyed by "x,y,z" (two-pass build). */
function brickRefs(WorldReader, bytes, gid = 1) {
  const r = WorldReader.from(bytes);
  const out = new Map();
  const chunks = r.brickChunkIndex(gid);
  let ci = 0, left = chunks[0]?.numBricks ?? 0, i = 0;
  for (const b of r.bricks(gid)) {
    while (left === 0) { ci++; i = 0; left = chunks[ci].numBricks; }
    const c = chunks[ci].index;
    // a loose grid reads back 1024 off on every axis (its chunk origin)
    out.set(b.position.map(v => v + (gid > 1 ? 1024 : 0)).join(','), { GridPersistentIndex: gid, ChunkIndex: { X: c.x, Y: c.y, Z: c.z }, BrickIndexInChunk: i });
    i++; left--;
  }
  return out;
}

export function buildReceiver(lib, L, opts) {
  const once = buildReceiverOnce(lib, L, opts);
  let refs = brickRefs(lib.WorldReader, once, 1);
  // physics: the loose grid's persistent index in the file (main = 1)
  for (let gid = 2; opts.physics && gid < 8 && !refs.get(tilePos(L, 0).join(',')); gid++) { try { refs = brickRefs(lib.WorldReader, once, gid); } catch { } }
  const missing = Array.from({ length: L.tw * L.th }, (_, t) => refs.get(tilePos(L, t).join(','))).filter(r => !r).length;
  if (missing) throw Error(`tgrid: ${missing} tile refs not found`);
  return buildReceiverOnce(lib, L, { ...opts, refs });
}

const RECV_ROWS = 2; // receiver gate rows (8 a row from y 40)
const cartY = slot => 40 + RECV_ROWS * 40 + 40 + slot * 80;

export function buildCartridge(lib, L, enc, { event, fps, dur, slot = 0, owner, debug = false, inChip = false } = {}) {
  const { w, C, O, wire, num, str, chip } = kit(lib, owner);
  let i = 0;
  const CG = inChip ? chip([L.gate[0] + 40, L.gate[1] + cartY(slot) + 20, L.gate[2] + L.z0 + 10], undefined, O, [100, Math.max(60, Math.ceil((4 + 14 * (L.lanes ?? 1)) / 8) * 20 + 20)]) : null;
  const gate = (c, data = {}, extra = {}) => {
    if (CG) {
      const h = w.addBrick({ asset: c.BRICK, position: [(i % 8) * 20, Math.floor(i / 8) * 20, 2], color: [200, 200, 200], owner_index: O, components: [{ type: c.NAME, data }], ...extra }, CG);
      i++;
      return { h, c };
    }
    const h = w.addBrick({ asset: c.BRICK, position: [L.gate[0] - 200 + (i % 12) * 40, L.gate[1] + cartY(slot) + Math.floor(i / 12) * 40, L.gate[2] + L.z0 + 10], color: [200, 200, 200], owner_index: O,
      visibility: false, collision: false, components: [{ type: c.NAME, data }], ...extra });
    i++;
    if (i > 24) throw Error('tgrid: cartridge gates overflow their 2 rows');
    return { h, c };
  };
  const sw = gate(C.Stopwatch, { Limit: dur + 30, Time: 0, bRunning: true });
  const now = gate(C.Expr_MathMultiply, { InputB: num(fps) }); wire(sw, 'Time', now, 'InputA');
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  // only the lanes the packets use (a 6-lane TV played on 3 lanes gets no idle senders)
  const lanes = inChip ? Math.min(L.lanes ?? 1, (enc.lane ?? [0]).reduce((m, l) => Math.max(m, l + 1), 1)) : 1;
  for (let lj = 0; lj < lanes; lj++) {
    const mine = enc.packets.map((_, i) => i).filter(i => (enc.lane?.[i] ?? 0) % lanes === lj);
    const NP = mine.length;
    const packets = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: (NP ? mine.map(i => enc.packets[i]) : ['']).map(value => ({ $variant: 'Str', value })) } });
    const dueArr = gate(C.ArrayVar, { Value: { $elementType: 'f64', $array: NP ? mine.map(i => enc.due[i]) : [1e9] } });
    const cur = gate(C.Var, { Value: num(0) });
    // the packet at the cursor, once its frame is due (out of bounds past the last one)
    const getD = gate(C.Exec_ArrayVar_Get); wire(dueArr, 'ArrayVarRef', getD, 'ArrayVarRef'); wire(cur, 'Value', getD, 'Index'); wire(tick, 'OnRisingEdge', getD, 'Exec');
    const ready = gate(C.Expr_CompareLessOrEqual); wire(getD, 'Value', ready, 'InputA'); wire(now, 'Output', ready, 'InputB');
    const inb = gate(C.Expr_LogicalNOT); wire(getD, 'bOutOfBounds', inb, 'bInput');
    const both = gate(C.Expr_LogicalAND); wire(ready, 'bOutput', both, 'bInputA'); wire(inb, 'bOutput', both, 'bInputB');
    const br = gate(C.Exec_Branch); wire(both, 'bOutput', br, 'bCond'); wire(getD, 'ExecOut', br, 'Exec');
    const getP = gate(C.Exec_ArrayVar_Get); wire(packets, 'ArrayVarRef', getP, 'ArrayVarRef'); wire(cur, 'Value', getP, 'Index'); wire(br, 'ExecOutA', getP, 'Exec');
    const send = gate(C.Exec_SendCustomEventGlobal, { EventName: laneEvent(event, lj), DataIn1: str(''), DataIn2: num(0), ...SEND_REST }, { size: EVENT_SIZE });
    wire(getP, 'Value', send, 'DataIn1'); wire(getP, 'ExecOut', send, 'ExecIn');
    if (debug) {
      const f = gate(C.Expr_String_FormatText, { FormatString: `tgsend${lj ? lj : ''}|{A}|{B}|{C}` }); wire(cur, 'Value', f, 'InputA'); wire(now, 'Output', f, 'InputB'); wire(getD, 'Value', f, 'InputC'); // packet, frame now, frame due
      const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(send, 'ExecOut', p, 'Exec');
    }
    const nxt = gate(C.Expr_MathAdd, { InputB: num(1) }); wire(cur, 'Value', nxt, 'InputA');
    const adv = gate(C.Exec_Var_Set); wire(cur, 'VarRef', adv, 'VarRef'); wire(nxt, 'Output', adv, 'Value'); wire(send, 'ExecOut', adv, 'Exec');
  }
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'T grid cartridge' } });
}

/** Clear boxes (file coords [centre, half]). */
export const cartridgeBox = (L, slot) => [[L.gate[0] + 40, L.gate[1] + cartY(slot) + 20, L.gate[2] + L.z0 + 10], [260, 36, 16]];
export function receiverBoxes(L) {
  // tiles in bands (ClearRegion silently fails on ~1800+ bricks), bars, gates
  const out = [];
  // panel mode: ONE box hugging the tiles (clearBox adds 1): the owner's frame sits 1 unit outside them
  // (a band box took 7 frame bricks, 2026-10-18)
  if (!L.frame) out.push([[0, 0, L.z0 + 4 + L.height / 2], [L.width / 2 - 1, L.depth, L.height / 2 - 1]]);
  const band = Math.max(1, Math.floor(600 / L.tw));
  for (let r0 = 0; L.frame && r0 < L.th; r0 += band) {
    const r1 = Math.min(L.th, r0 + band);
    const zHi = L.z0 + 4 + L.height - r0 * L.tile, zLo = L.z0 + 4 + L.height - r1 * L.tile;
    out.push([[0, 0, (zHi + zLo) / 2], [L.width / 2 + 1, 3, (zHi - zLo) / 2 + 1]]);
  }
  if (L.frame) {
    out.push([[0, 0, L.z0 + 2], [L.hw + 1, 3, 3]], [[0, 0, L.z0 + L.side - 2], [L.hw + 1, 3, 3]]);
    out.push([[0, 0, L.z0 + 4 + L.height / 2], [L.hw + 1, 3, L.height / 2 + 1]]); // side bars (whole box: few bricks once the tiles are gone)
  }
  out.push([[L.gate[0], L.gate[1] + 40 + RECV_ROWS * 20 - 20, L.gate[2] + L.z0 + 10], [180, RECV_ROWS * 20 + 10, 16]]);
  out.push(cartridgeBox(L, 0), cartridgeBox(L, 1));
  return out;
}

// ---------- /stream tv (2026-10-20, owner: "a TV they can get as an entity, /stream plays onto it") ----------
// The whole TV is ONE loose physics grid (gravity on): cabinet + tw x th tiles + the receiver gates hidden in
// its hollow back. Tested 2026-10-20 in the sky: the receiver keeps drawing its tiles after the grid is moved
// and turned (brick refs into the loose grid survive Prefab.Load and movement), so /stream play only has to
// load cartridges (sky, static: global events reach the TV anywhere) and the soundtrack beside the TV.
// Its own chat commands: /tvw<id> prints `tvpos|<id>|x|y|z|yaw` (grid origin + yaw; the plugin finds the TV),
// /tvx<id> destroys it. Bricks.Clear does NOT remove a loose grid (ClearRegion round it does).
// File coords: origin = floor under the screen centre, screen facing -y.
// 2026-11-03 (owner: "that TV is stretched so fat for no reason"): slim flat-screen, bezel hugs the screen
const TV_B = 4, TV_D = 34, TV_LIFT = 16;
export const TV_DUMP = [-9000, -20000, 20000];
/** ClearRegion box (centre, half) that takes a TV parked at TV_DUMP (it falls a little before the clear lands). */
export const tvDumpBox = () => [[TV_DUMP[0], TV_DUMP[1], TV_DUMP[2] - 100], [200, 200, 300]];
const tvHalf = L => L.width / 2 + TV_B;
export function tvLayout({ tw = 32, th = 18, k = 2, cell = 2, lanes = 1 } = {}) {
  // every gate sits in the lane chips in the hollow back (chip centre = mid-screen, see buildReceiverOnce)
  const L0 = tLayout({ tw, th, k, cell, lift: TV_LIFT, depth: 2, frame: false, colour: [0, 0, 0] });
  if (L0.width < 44 || L0.height < 34) throw Error('tgrid: TV too small for its lane chips');
  return tLayout({ tw, th, k, cell, lift: TV_LIFT, depth: 2, frame: false, colour: [0, 0, 0], lanes, gate: [0, 2, Math.round(L0.height / 2 / 2) * 2 - 6] });
}

export function buildTv(lib, L, { event, owner, id, debug = false } = {}) {
  const W = L.width / 2, H = L.height, zs = L.z0 + 4, zb = zs - TV_B, zt = zs + H + TV_B, X = tvHalf(L);
  const extra = ({ w, C, O, wire, num, gate, G }) => {
    const box = (c, h, color) => w.addBrick({ asset: 'PB_DefaultMicroBrick', size: h, position: c, color, owner_index: O }, G);
    const BEZ = [14, 14, 16], CAB = [26, 26, 30], FOOT = [34, 34, 38];
    // bezel, 2 proud of the tiles
    box([0, -1, zt - TV_B / 2], [X, 3, TV_B / 2], BEZ);
    box([0, -1, zb + TV_B / 2], [X, 3, TV_B / 2], BEZ);
    for (const s of [1, -1]) box([s * (W + X) / 2, -1, zs + H / 2], [(X - W) / 2, 3, H / 2], BEZ);
    // back plate, then a narrower hollow hump (the lane chips live in it) with its cover
    box([0, 4, (zb + zt) / 2], [X, 2, (zt - zb) / 2], CAB);
    const hx = Math.max(Math.round(W * 0.6), 22), hz = (zt - zb) / 2 - TV_B, zc = (zb + zt) / 2, hy = (6 + TV_D - 4) / 2, hh = (TV_D - 4 - 6) / 2;
    box([0, hy, zc + hz - 2], [hx, hh, 2], CAB);
    box([0, hy, zc - hz + 2], [hx, hh, 2], CAB);
    for (const s of [1, -1]) box([s * (hx - 2), hy, zc], [2, hh, hz - 4], CAB);
    box([0, TV_D - 2, zc], [hx, 2, hz], CAB);
    // neck under the hump + wide deep foot (low and heavy, doesn't tip)
    box([0, hy, (4 + zc - hz) / 2], [8, 6, (zc - hz - 4) / 2], FOOT);
    box([0, hy - 4, 2], [Math.round(X * 0.7), TV_D / 2 + 6, 2], FOOT);
    // power light
    box([X - 8, -5, zb + TV_B / 2], [2, 1, 1], [40, 255, 60]);
    const RG = { BRICK: 'B_1x1_Gate_Internal_ReadBrickGrid', NAME: 'BrickComponentType_Internal_ReadBrickGrid', PORTS: { BrickGrid: 'BrickGrid' } };
    const rg = gate(RG);
    // /tvw<id>: where am I
    const cmd = gate(C.Event_ChatCommand, { CommandName: `tvw${id}`, HelpText: 'server only' });
    const lr = gate(C.Exec_Entity_GetLocationRotation); wire(rg, 'BrickGrid', lr, 'Entity'); wire(cmd, 'ExecOut', lr, 'Exec');
    const sv = gate(C.Expr_SplitVector); wire(lr, 'Vector', sv, 'Input');
    const sr = gate(C.Expr_SplitRotation); wire(lr, 'Rotation', sr, 'Input');
    const f = gate(C.Expr_String_FormatText, { FormatString: `tvpos|${id}|{A}|{B}|{C}|{D}` });
    wire(sv, 'X', f, 'InputA'); wire(sv, 'Y', f, 'InputB'); wire(sv, 'Z', f, 'InputC'); wire(sr, 'Yaw', f, 'InputD');
    const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(lr, 'ExecOut', p, 'Exec');
    // /tvx<id>: jump to the dump spot high in the sky, where the plugin's ClearRegion takes it (DestroySpawned
    // does nothing to a Prefab.Loaded grid, and a box round the TV where it stands would take furniture with it)
    const xc = gate(C.Event_ChatCommand, { CommandName: `tvx${id}`, HelpText: 'server only' });
    const mv = gate(C.Exec_Entity_SetLocationRotation, { Vector: { X: TV_DUMP[0], Y: TV_DUMP[1], Z: TV_DUMP[2] }, Rotation: { Pitch: 0, Yaw: 0, Roll: 0 } });
    wire(rg, 'BrickGrid', mv, 'Entity'); wire(xc, 'ExecOut', mv, 'Exec');
  };
  return buildReceiver(lib, L, { event, owner, debug, paint: false, physics: true, extra, inChip: true });
}

/** One cartridge that blanks every tile (black), for when a stream ends. */
export function blankCartridge(lib, L, { event, owner, slot = 0 }) {
  const enc = encodeTiles([Buffer.alloc(L.cols * L.rows * 3)], L, newState(L), { fps: 1, per: perPacket(L), perSec: 1, full: [0], lanes: L.lanes ?? 1 });
  enc.due = enc.due.map(() => 0);
  return buildCartridge(lib, L, enc, { event, fps: 1, dur: 2, slot, owner, inChip: true });
}
