// O-GRID (EA3.2, brs-js 4): video as a SQUARE grid of coloured letter O's on
// ONE text display, as few bricks as the game allows. A chunk prefab is
// 7 bricks: the screen (a micro brick holding the TextDisplay) + 6 hidden
// gates. Frames = strings of N x N "O"s, colour by rich-text runs
// <color="rrggbb">OOO</>, in an Any Value ArrayVar. A Stopwatch starts on
// load; a 20 Hz Clock fires ArrayVar_Get(Time x fps) whose Value is wired
// straight into the screen's Text (no Var, no Floor: the index truncates).
// The soundtrack is a heightmap2brz speech device cut from the SAME seconds of
// the source and loaded on the same tick; its timer also starts on load, so
// picture and sound share one zero.
//
// File coordinates: origin = floor under the screen's centre, screen facing -y.
// Brickadia is left-handed: seen from -y, +x runs LEFT, so column 0 sits at +x
// (handled by writing rows left to right as the viewer reads them: text does
// that itself).

export const OWNER = { id: '7e1e0715-0000-4b0b-9a11-00000000a0a0', name: 'O Grid', display_name: 'O Grid' };
/** One owner per viewer (own 10 ms wire budget, exact clears). */
export const ownerFor = hex12 => ({ id: `7e1e0715-0000-4b0b-9a11-${hex12}`, name: 'O Grid', display_name: 'O Grid' });

export const MAX_CHARS = 8000; // one wire string 34k chars failed to load; 4.8k and 12k loaded
const LEVELS = [16, 12, 9, 7, 6, 5, 4, 3, 2];

/**
 * rgb24 frames (n x n) -> one string per frame: n lines of n "O"s.
 * Runs of cells with the same quantised colour share one tag; cells darker
 * than `dark` are plain O's in the display's own (near black) colour. The
 * quantisation gets coarser until the frame fits `max` characters.
 */
export function oFrames(frames, n, { max = MAX_CHARS, dark = 0.06 } = {}) {
  const h2 = v => v.toString(16).padStart(2, '0');
  return frames.map(fr => {
    let s = '';
    for (const q of LEVELS) {
      const step = 255 / (q - 1);
      const lines = [];
      for (let r = 0; r < n; r++) {
        let line = '', run = 0, key = null;
        const flush = () => { if (run) line += key ? `<color="${key}">${'O'.repeat(run)}</>` : 'O'.repeat(run); run = 0; };
        for (let c = 0; c < n; c++) {
          const o = (r * n + c) * 3, R = fr[o], G = fr[o + 1], B = fr[o + 2];
          const k = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255 < dark ? null
            : [R, G, B].map(v => h2(Math.round(Math.round(v / step) * step))).join('');
          if (k !== key) { flush(); key = k; }
          run++;
        }
        flush();
        lines.push(line);
      }
      s = lines.join('\n');
      if (s.length <= max) return s;
    }
    return Array.from({ length: n }, () => 'O'.repeat(n)).join('\n'); // never fits: plain grid
  });
}

/**
 * Geometry. lh = line height (units); a glyph is charW x lh, so WidthScale
 * 1 / charW makes every cell lh x lh: n x n cells = a square picture.
 */
export function oLayout(n, { lh = 4, charW = 0.55, lift = 20 } = {}) {
  const side = Math.ceil((n * lh) / 4) * 4 + 8; // screen brick side (2 units of border each way, even halves)
  return { n, lh, charW, side, z0: lift, top: lift + side };
}

const FONTS = [{ type: 'BrickFontDescriptor', name: 'IosevkaTerm' }];

const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 24, G: 24, B: 28, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};

/** One chunk = screen + chip, 7 bricks. `dur` = seconds the chunk plays. */
export function buildOGrid(lib, L, strs, { fps, dur, owner = OWNER } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const hx = L.side / 2;
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.lh, WidthScale: +(1 / L.charW).toFixed(4), Text: strs[0] } };
  const screen = {
    h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, 2, hx], position: [0, 0, L.z0 + hx], color: [6, 6, 8], owner_index: O, components: [face] }),
    c: C.TextDisplay,
  };
  // gates: one row behind the screen, out of sight
  let slot = 0;
  const gate = (c, data = {}) => {
    const i = slot++;
    const h = w.addBrick({ asset: c.BRICK, position: [-100 + i * 40, 40, L.z0 + 10], color: [200, 200, 200], owner_index: O,
      visibility: false, collision: false, components: [{ type: c.NAME, data }] });
    return { h, c };
  };
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  const frames = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: strs.map(value => ({ $variant: 'Str', value })) } });
  const sw = gate(C.Stopwatch, { Limit: dur + 30, Time: 0, bRunning: true });
  const idx = gate(C.Expr_MathMultiply, { InputB: { $variant: 'f64', value: fps } });
  wire(sw, 'Time', idx, 'InputA');
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const get = gate(C.Exec_ArrayVar_Get);
  wire(frames, 'ArrayVarRef', get, 'ArrayVarRef'); wire(idx, 'Output', get, 'Index'); wire(tick, 'OnRisingEdge', get, 'Exec');
  wire(get, 'Value', screen, 'Text');
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'O grid' }, externalAssets: FONTS });
}

/** Clear boxes (file coords [centre, half]) of one chunk: screen + gate row. */
export function oBoxes(L) {
  const hx = L.side / 2;
  return [[[0, 0, L.z0 + hx], [hx, 2, hx]], [[0, 40, L.z0 + 10], [130, 10, 10]]];
}

// ---------- STREAMED O-GRID: the plugin sends frames, a For Loop chip decodes them ----------
// The receiver is loaded once per session: screen + a chat-command gate
// (/og<id>; the server's br.Chat.Command is the only console door into
// wires: there is no command that fires a Custom Global Event) + a For Loop
// decoder. Omegga refuses console lines of 512+ chars, so a frame travels as
// RUN TOKENS, 2 chars each: colour index + run length, both letters of ALPHA;
// colour index NL ends a row. Long frames go in several commands: the first
// char of each says a = first part (reset), b = middle, c = last, d = whole.
// The last part arms `pending`; a 20 Hz clock then runs the loop (by then the
// buffer Var is settled), which rebuilds <color="rrggbb">OOO</>... runs in a
// string Var and copies it into the screen when the loop completes.

export const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$&()*+,-./:;=?@[]^_|~';
const LV = { r: [0, 85, 170, 255], g: [0, 64, 128, 191, 255], b: [0, 85, 170, 255] };
/** Fixed palette, 4 x 5 x 4 = 80 colours; index 80 = newline. */
export const PALETTE = LV.r.flatMap(r => LV.g.flatMap(g => LV.b.map(b => [r, g, b])));
export const NL = PALETTE.length;
const PAL_HEX = PALETTE.map(c => c.map(v => v.toString(16).padStart(2, '0')).join('')).join('') + '000000';
const OS = 'O'.repeat(ALPHA.length);
export const LINE_MAX = 500; // Omegga refuses 512+, the game silently drops lines of ~506-511 (505 got through)

const nearest = (R, G, B) => {
  const q = (v, lv) => lv.reduce((bi, x, i) => (Math.abs(x - v) < Math.abs(lv[bi] - v) ? i : bi), 0);
  return (q(R, LV.r) * LV.g.length + q(G, LV.g)) * LV.b.length + q(B, LV.b);
};

/**
 * rgb24 n x n frame -> run tokens (2 chars a run). A cell joins the current
 * run while it stays within `tol` of the run's mean colour; tol grows until
 * the frame has at most maxRuns runs (decode time + text length).
 */
export function encodeFrame(fr, n, { maxRuns = 400 } = {}) {
  let s = '';
  for (const tol of [0, 12, 20, 28, 40, 56, 80, 112, 160, 255]) {
    s = '';
    for (let r = 0; r < n; r++) {
      let run = 0, sum = [0, 0, 0];
      const flush = () => { if (run) s += ALPHA[nearest(...sum.map(v => v / run))] + ALPHA[run - 1]; run = 0; sum = [0, 0, 0]; };
      for (let c = 0; c < n; c++) {
        const o = (r * n + c) * 3, px = [fr[o], fr[o + 1], fr[o + 2]];
        if (run && (run === ALPHA.length || (tol === 0 ? nearest(...px) !== nearest(...sum.map(v => v / run)) : Math.max(...px.map((v, i) => Math.abs(v - sum[i] / run))) > tol))) flush();
        run++; sum = sum.map((v, i) => v + px[i]);
      }
      flush();
      if (r < n - 1) s += ALPHA[NL] + ALPHA[0];
    }
    if (s.length / 2 <= maxRuns) break;
  }
  return s;
}

/** What the chip makes of tokens (JS mirror of the loop, for checks). */
export function decodeTokens(t) {
  let out = '';
  for (let i = 0; i + 1 < t.length; i += 2) {
    const ci = ALPHA.indexOf(t[i]), cc = ALPHA.indexOf(t[i + 1]);
    out += ci === NL ? '\n' : `<color="${PAL_HEX.substr(ci * 6, 6)}">${OS.substr(0, cc + 1)}</>`;
  }
  return out;
}

/** Tokens -> command argument strings that fit a console line after `prefix` (e.g. 'br.Chat.Command /og1a2b3c '). */
export function frameParts(tokens, prefix) {
  const room = (LINE_MAX - prefix.length - 1) & ~1; // whole tokens
  const parts = [];
  for (let i = 0; i < tokens.length; i += room) parts.push(tokens.slice(i, i + room));
  if (!parts.length) parts.push('');
  return parts.map((p, i) => (parts.length === 1 ? 'd' : i === 0 ? 'a' : i === parts.length - 1 ? 'c' : 'b') + p);
}

/** The receiver: screen + command gate + decoder loop chip. cmd = chat command name (letters/digits). */
export function buildReceiver(lib, L, { cmd, owner = OWNER, debug = false } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const hx = L.side / 2;
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.lh, WidthScale: +(1 / L.charW).toFixed(4), Text: 'O' } };
  const screen = { h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, 2, hx], position: [0, 0, L.z0 + hx], color: [6, 6, 8], owner_index: O, components: [face] }), c: C.TextDisplay };
  const slots = new Map();
  const gate = (c, data = {}, grid) => {
    const k = grid ?? 'main', i = slots.get(k) ?? 0; slots.set(k, i + 1);
    const position = grid ? [(i % 8) * 40 - 140, -Math.floor(i / 8) * 40, 2] : [(i % 8) * 40 - 140, 40 + Math.floor(i / 8) * 40, L.z0 + 10];
    const h = w.addBrick({ asset: c.BRICK, position, color: [200, 200, 200], owner_index: O, visibility: false, collision: false, components: [{ type: c.NAME, data }] }, grid);
    return { h, c };
  };
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  const num = v => ({ $variant: 'f64', value: v }), str = v => ({ $variant: 'Str', value: v });
  const out = c => (c.PORTS.bOutput ? 'bOutput' : 'Output');
  const op = (grid, c, a, b, data) => { const x = gate(c, data, grid); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (b) wire(...b, x, 'InputB'); return [x, out(c)]; };
  const K = (grid, v) => [gate(C.Var, { Value: typeof v === 'string' ? str(v) : num(v) }, grid), 'Value'];
  const set = (grid, v, src) => { const s = gate(C.Exec_Var_Set, {}, grid); wire(v, 'VarRef', s, 'VarRef'); wire(...src, s, 'Value'); return s; };
  const chain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1], 'ExecOut', gs[i], 'Exec'); return gs; };
  const select = (grid, a, b, cond) => { const x = gate(C.Expr_Select, {}, grid); wire(...a, x, 'InputA'); wire(...b, x, 'InputB'); wire(...cond, x, 'bSelectB'); return [x, 'Output']; };
  const sub = (grid, input, start, len) => {
    const x = gate(C.Expr_String_Substring, { Input: typeof input === 'string' ? input : '', Start: 0, Length: typeof len === 'number' ? len : 1 }, grid);
    if (typeof input !== 'string') wire(...input, x, 'Input');
    wire(...start, x, 'Start'); if (typeof len !== 'number') wire(...len, x, 'Length');
    return [x, 'Output'];
  };

  // ---- receive: buf = (reset ? '' : buf) + payload; the last part arms pending
  const ev = gate(C.Event_ChatCommand, { CommandName: cmd, HelpText: 'O grid data (server only)' });
  const args = [ev, 'Arguments'];
  const flag = sub(null, args, K(null, 0), 1);
  const payload = sub(null, args, K(null, 1), 100000);
  const isFlag = s => { const x = gate(C.Expr_String_Contains, { Input: s, Search: '', bCaseSensitive: true }); wire(...flag, x, 'Search'); return [x, 'Output']; };
  const reset = isFlag('ad'), final = isFlag('cd');
  const buf = gate(C.Var, { Value: str('') }), pending = gate(C.Var, { Value: num(0) }), pic = gate(C.Var, { Value: str('O') });
  const bufGet = gate(C.Exec_Var_Get); wire(buf, 'VarRef', bufGet, 'VarRef');
  const cat = gate(C.Expr_String_Concatenate, { Separator: '' });
  wire(...select(null, [bufGet, 'Value'], K(null, ''), reset), cat, 'InputA'); wire(...payload, cat, 'InputB');
  const isLast = gate(C.Exec_Branch); wire(...final, isLast, 'bCond');
  chain(bufGet, set(null, buf, [cat, 'Output']), isLast);
  wire(ev, 'ExecOut', bufGet, 'Exec');
  wire(isLast, 'ExecOutA', set(null, pending, K(null, 2)), 'Exec');
  wire(pic, 'Value', screen, 'Text');

  // ---- decoder loop: one iteration per run token (runs across ticks: never trips the 10 ms budget)
  const shell = gate(C.Microchip_CountFor, { Count: 0, FirstIndex: 0, Step: 1, bRunAcrossTicks: true });
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
  w.registerMicrochipLink(shell.h, grid);
  // pending 2 (last part in) -> next tick: snapshot buf into dbuf, pending 1 -> a later tick, when the
  // loop is idle: pending 0 + run on dbuf. The next frame's parts can then overwrite buf mid-decode.
  const dbuf = gate(C.Var, { Value: str('') });
  wire(...op(null, C.Expr_Floor, op(null, C.Expr_MathDivide, op(null, C.Expr_String_Length, [dbuf, 'Value']), K(null, 2))), shell, 'Count');
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const pGet = gate(C.Exec_Var_Get); wire(pending, 'VarRef', pGet, 'VarRef'); wire(tick, 'OnRisingEdge', pGet, 'Exec');
  const snap = gate(C.Exec_Branch); wire(...op(null, C.Expr_CompareGreater, [pGet, 'Value'], K(null, 1.5)), snap, 'bCond'); wire(pGet, 'ExecOut', snap, 'Exec');
  const take = chain(set(null, dbuf, [buf, 'Value']), set(null, pending, K(null, 1)));
  wire(snap, 'ExecOutA', take[0], 'Exec');
  // busy is a Var: any wire from the shell's own outputs back into its Exec is rejected as a cycle
  const busy = gate(C.Var, { Value: num(0) });
  const ready = gate(C.Expr_LogicalAND);
  wire(...op(null, C.Expr_CompareGreater, [pGet, 'Value'], K(null, 0.5)), ready, 'bInputA');
  wire(...op(null, C.Expr_CompareLess, [busy, 'Value'], K(null, 0.5)), ready, 'bInputB');
  const go = gate(C.Exec_Branch); wire(ready, 'bOutput', go, 'bCond'); wire(snap, 'ExecOutB', go, 'Exec');
  const start = chain(set(null, pending, K(null, 0)), set(null, busy, K(null, 1)));
  wire(go, 'ExecOutA', start[0], 'Exec'); wire(start[1], 'ExecOut', shell, 'Exec');

  // inner grids are sealed: the buffer goes in through a MicrochipInput, the text out through a MicrochipOutput
  const din = gate(C.MicrochipInput, { PortLabel: 'data', PortOrder: 0 }, grid); wire(dbuf, 'Value', din, 'RER_Input');
  const data = [din, 'RER_Output'];
  const entry = gate(C.CallableEntry_CountFor, {}, grid);
  const idx = [entry, 'Index'];
  const acc = gate(C.Var, { Value: str('') }, grid);
  // read the accumulator once at the top (outputs are memoized inside an iteration), write it last
  const accGet = gate(C.Exec_Var_Get, {}, grid); wire(acc, 'VarRef', accGet, 'VarRef');
  const at = op(grid, C.Expr_MathMultiply, idx, K(grid, 2));
  const find = ch => { const x = gate(C.Expr_String_Find, { Input: ALPHA, Search: '', Start: 0, bCaseSensitive: true }, grid); wire(...ch, x, 'Search'); return [x, 'Output']; };
  const ci = find(sub(grid, data, at, 1));
  const cc = find(sub(grid, data, op(grid, C.Expr_MathAdd, at, K(grid, 1)), 1));
  const hex = sub(grid, PAL_HEX, op(grid, C.Expr_MathMultiply, ci, K(grid, 6)), 6);
  const os = sub(grid, OS, K(grid, 0), op(grid, C.Expr_MathAdd, cc, K(grid, 1)));
  const fmt = gate(C.Expr_String_FormatText, { FormatString: '<color="{A}">{B}</>' }, grid); wire(...hex, fmt, 'InputA'); wire(...os, fmt, 'InputB');
  const piece = select(grid, [fmt, 'Output'], K(grid, '\n'), op(grid, C.Expr_CompareEqual, ci, K(grid, NL)));
  const accCat = gate(C.Expr_String_Concatenate, { Separator: '' }, grid);
  wire(...select(grid, [accGet, 'Value'], K(grid, ''), op(grid, C.Expr_CompareEqual, idx, K(grid, 0))), accCat, 'InputA'); wire(...piece, accCat, 'InputB');
  wire(entry, 'Body', accGet, 'Exec');
  chain(accGet, set(grid, acc, [accCat, 'Output']));
  const dout = gate(C.MicrochipOutput, { PortLabel: 'text', PortOrder: 0 }, grid); wire(acc, 'Value', dout, 'RER_Input');
  const show = set(null, pic, [dout, 'RER_Output']); wire(shell, 'Completed', show, 'Exec');
  const free = set(null, busy, K(null, 0)); wire(show, 'ExecOut', free, 'Exec');
  if (debug) {
    // log line per decoded frame: iterations | text length | head
    const f = gate(C.Expr_String_FormatText, { FormatString: 'ogrid|{A}|{B}|{C}' });
    wire(shell, 'IterationsExecuted', f, 'InputA'); wire(...op(null, C.Expr_String_Length, [dout, 'RER_Output']), f, 'InputB');
    wire(...sub(null, [dout, 'RER_Output'], K(null, 0), 80), f, 'InputC');
    const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(free, 'ExecOut', p, 'Exec');
  }
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'O grid receiver' }, externalAssets: FONTS });
}

/** Clear boxes of a receiver (file coords [centre, half]): screen + gate field. */
export function receiverBoxes(L) {
  const hx = L.side / 2;
  // gates: 8 a row, 40 apart from y 40 (about 50 gates = 7 rows)
  return [[[0, 0, L.z0 + hx], [hx, 2, hx]], [[0, 200, L.z0 + 10], [180, 180, 20]]];
}
