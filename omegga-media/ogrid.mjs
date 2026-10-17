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

/** The cell glyph: a full block (owner 2026-10-16 sent '█' after the O version); 'O' still works. */
export const GLYPH = '█';
export const MAX_CHARS = 8000; // one wire string 34k chars failed to load; 4.8k and 12k loaded
const QUANT = [16, 12, 9, 7, 6, 5, 4, 3, 2];

/**
 * rgb24 frames (n x n) -> one string per frame: n lines of n "O"s.
 * Runs of cells with the same quantised colour share one tag; cells darker
 * than `dark` are plain O's in the display's own (near black) colour. The
 * quantisation gets coarser until the frame fits `max` characters.
 */
export function oFrames(frames, n, { max = MAX_CHARS, dark = 0.06, glyph = GLYPH } = {}) {
  const h2 = v => v.toString(16).padStart(2, '0');
  return frames.map(fr => {
    let s = '';
    for (const q of QUANT) {
      const step = 255 / (q - 1);
      const lines = [];
      for (let r = 0; r < n; r++) {
        let line = '', run = 0, key = null;
        const flush = () => { if (run) line += key ? `<color="${key}">${glyph.repeat(run)}</>` : glyph.repeat(run); run = 0; };
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
    return Array.from({ length: n }, () => glyph.repeat(n)).join('\n'); // never fits: plain grid
  });
}

/**
 * Geometry. lh = line height (units); a glyph is charW x lh, so WidthScale
 * 1 / charW makes every cell lh x lh: n x n cells = a square picture.
 */
export function oLayout(n, { lh = 1.6, charW = 0.5, lift = 20, textScale = 1.6875 } = {}) {
  const side = Math.ceil((n * lh) / 4) * 4 + 8; // screen brick side (4 units of border each way, even halves)
  // textScale: a block drew at ~0.6 of its LineHeight in game (owner screenshot 2026-10-16:
  // a 32-cell picture filled 76 of 136 units), so LineHeight = cell size x 1.68 fills the board
  return { n, lh, charW, side, z0: lift, top: lift + side, textLH: +(lh * textScale).toFixed(3) };
}

const FONTS = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }]; // owner's pick 2026-10-16

const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 24, G: 24, B: 28, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 0 /* Unlit (1 = Graffiti), owner 2026-10-16 */, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};

/** One chunk = screen + chip, 7 bricks. `dur` = seconds the chunk plays. */
export function buildOGrid(lib, L, strs, { fps, dur, owner = OWNER } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const hx = L.side / 2;
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.textLH, WidthScale: +(1 / L.charW).toFixed(4), Text: strs[0] } };
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
// RUN TOKENS, 4 chars each, letters of ALPHA: red, green, blue (LEVELS steps
// 0..83 each, near true colour) + run length; red = NL ends a row. Long frames
// go in several commands, at least a game tick apart (two in one tick clobber
// each other: only some parts land): the first char of each says a = first part (reset),
// b = middle, c = last, d = whole. The last part arms `pending`; a 20 Hz clock
// then runs the loop (by then the buffer Var is settled), which rebuilds
// <color="rrggbb">███</>... runs in a string Var and copies it into the
// screen when the loop completes.

export const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$&()*+,-./:;=?@[]^_|~';
export const LEVELS = ALPHA.length - 1; // 84 steps a channel; index 84 (red) = newline
export const NL = LEVELS;
const lv = i => Math.round((i * 255) / (LEVELS - 1));
const LV_HEX = Array.from({ length: LEVELS }, (_, i) => lv(i).toString(16).padStart(2, '0')).join('');
export const TOKEN = 4;
export const LINE_MAX = 500; // Omegga refuses 512+, the game silently drops lines of ~506-511 (505 got through)
const q = v => Math.max(0, Math.min(LEVELS - 1, Math.round((v * (LEVELS - 1)) / 255)));

export const STRIP_SEP = '%'; // not in ALPHA
/** Runs one strip's text display can hold (32768-char wire string cap, ~20 chars a run + its glyphs). */
export const stripRunCap = (n, strips) => Math.floor((32768 - (n * n) / strips - n) / 21);

/**
 * rgb24 n x n frame -> run tokens (4 chars a run), one section per text
 * display strip (n / strips rows each), sections joined by STRIP_SEP. A cell
 * joins the current run while it stays within `tol` of the run's mean colour;
 * tol grows until the frame fits maxRuns and every strip fits its display.
 */
export function encodeFrame(fr, n, { maxRuns = 472, strips = 1 } = {}) {
  const rows = n / strips, cap = stripRunCap(n, strips);
  let out = '';
  for (const tol of [4, 8, 12, 16, 22, 30, 40, 56, 80, 112, 160, 255]) {
    const secs = [];
    let total = 0, worst = 0;
    for (let k = 0; k < strips; k++) {
      let s = '', runs = 0;
      for (let r = k * rows; r < (k + 1) * rows; r++) {
        let run = 0, sum = [0, 0, 0];
        const flush = () => { if (run) { s += sum.map(v => ALPHA[q(v / run)]).join('') + ALPHA[run - 1]; runs++; } run = 0; sum = [0, 0, 0]; };
        for (let c = 0; c < n; c++) {
          const o = (r * n + c) * 3, px = [fr[o], fr[o + 1], fr[o + 2]];
          if (run && (run === ALPHA.length || Math.max(...px.map((v, i) => Math.abs(v - sum[i] / run))) > tol)) flush();
          run++; sum = sum.map((v, i) => v + px[i]);
        }
        flush();
        if (r < (k + 1) * rows - 1) { s += ALPHA[NL] + '000'; runs++; }
      }
      secs.push(s); total += runs; worst = Math.max(worst, runs);
    }
    out = secs.join(STRIP_SEP);
    if (total <= maxRuns && worst <= cap) break;
  }
  return out;
}

/** What the chip makes of tokens (JS mirror of the loop, for checks). */
export function decodeTokens(t, glyph = GLYPH) {
  if (t.includes(STRIP_SEP)) return t.split(STRIP_SEP).map(x => decodeTokens(x, glyph));
  const OS = glyph.repeat(ALPHA.length);
  let out = '';
  for (let i = 0; i + TOKEN - 1 < t.length; i += TOKEN) {
    const [r, g, b, c] = [0, 1, 2, 3].map(k => ALPHA.indexOf(t[i + k]));
    out += r === NL ? '\n' : `<color="${LV_HEX.substr(r * 2, 2)}${LV_HEX.substr(g * 2, 2)}${LV_HEX.substr(b * 2, 2)}">${OS.substr(0, c + 1)}</>`;
  }
  return out;
}

/** Tokens -> command argument strings that fit a console line after `prefix` (e.g. 'br.Chat.Command /og1a2b3c '). */
export function frameParts(tokens, prefix) {
  const room = Math.floor((LINE_MAX - prefix.length - 1) / TOKEN) * TOKEN; // whole tokens
  const parts = [];
  for (let i = 0; i < tokens.length; i += room) parts.push(tokens.slice(i, i + room));
  if (!parts.length) parts.push('');
  return parts.map((p, i) => (parts.length === 1 ? 'd' : i === 0 ? 'a' : i === parts.length - 1 ? 'c' : 'b') + p);
}

/**
 * The receiver: a screen of `strips` stacked text displays (n / strips rows each:
 * one display's string caps at 32768 chars) + the command gate + one For Loop
 * decoder per strip, all run at once on their own section of the frame.
 * cmd = chat command name (letters/digits).
 */
export function buildReceiver(lib, L, { cmd, owner = OWNER, debug = false, glyph = GLYPH, strips = 1 } = {}) {
  const OS = glyph.repeat(ALPHA.length);
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const hx = L.side / 2, rowsH = (L.side - 8) / strips; // picture height = side - 2 x 4 border
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.textLH, WidthScale: +(1 / L.charW).toFixed(4), Text: glyph } };
  // strip 0 = top rows; a 4-unit frame bar above and below
  const screens = [];
  for (let k = 0; k < strips; k++) {
    const zc = L.z0 + 4 + (strips - 1 - k) * rowsH + rowsH / 2;
    screens.push({ h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, 2, rowsH / 2], position: [0, 0, zc], color: [6, 6, 8], owner_index: O, components: [face] }), c: C.TextDisplay });
  }
  for (const zc of [L.z0 + 2, L.z0 + L.side - 2]) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, 2, 2], position: [0, 0, zc], color: [6, 6, 8], owner_index: O });
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
  const buf = gate(C.Var, { Value: str('') }), pending = gate(C.Var, { Value: num(0) });
  const bufGet = gate(C.Exec_Var_Get); wire(buf, 'VarRef', bufGet, 'VarRef');
  const cat = gate(C.Expr_String_Concatenate, { Separator: '' });
  wire(...select(null, [bufGet, 'Value'], K(null, ''), reset), cat, 'InputA'); wire(...payload, cat, 'InputB');
  const isLast = gate(C.Exec_Branch); wire(...final, isLast, 'bCond');
  chain(bufGet, set(null, buf, [cat, 'Output']), isLast);
  wire(ev, 'ExecOut', bufGet, 'Exec');
  wire(isLast, 'ExecOutA', set(null, pending, K(null, 2)), 'Exec');

  // ---- scheduler: pending 2 (last part in) -> next tick: snapshot buf into dbuf, pending 1 -> a later
  // tick when every decoder is idle: pending 0 + all decoders start. busy flags are Vars (a wire from a
  // shell's own outputs back into its Exec is rejected as a cycle).
  const dbuf = gate(C.Var, { Value: str('') });
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const pGet = gate(C.Exec_Var_Get); wire(pending, 'VarRef', pGet, 'VarRef'); wire(tick, 'OnRisingEdge', pGet, 'Exec');
  const snap = gate(C.Exec_Branch); wire(...op(null, C.Expr_CompareGreater, [pGet, 'Value'], K(null, 1.5)), snap, 'bCond'); wire(pGet, 'ExecOut', snap, 'Exec');
  const take = chain(set(null, dbuf, [buf, 'Value']), set(null, pending, K(null, 1)));
  wire(snap, 'ExecOutA', take[0], 'Exec');
  if (debug) { const f = gate(C.Expr_String_FormatText, { FormatString: 'ogsnap|{A}' }); wire(...op(null, C.Expr_String_Length, [buf, 'Value']), f, 'InputA'); const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(take[1], 'ExecOut', p, 'Exec'); }
  const busy = Array.from({ length: strips }, () => gate(C.Var, { Value: num(0) }));
  let ready = op(null, C.Expr_CompareGreater, [pGet, 'Value'], K(null, 0.5));
  for (const b of busy) { const x = gate(C.Expr_LogicalAND); wire(...ready, x, 'bInputA'); wire(...op(null, C.Expr_CompareLess, [b, 'Value'], K(null, 0.5)), x, 'bInputB'); ready = [x, 'bOutput']; }
  const go = gate(C.Exec_Branch); wire(...ready, go, 'bCond'); wire(snap, 'ExecOutB', go, 'Exec');
  const start = chain(set(null, pending, K(null, 0)), ...busy.map(b => set(null, b, K(null, 1))));
  wire(go, 'ExecOutA', start[0], 'Exec');
  if (debug) { const p = gate(C.Exec_PrintToConsole, { Text: 'ogstart' }); wire(start[start.length - 1], 'ExecOut', p, 'Exec'); }

  // ---- sections: split dbuf at STRIP_SEP
  const sections = [];
  let rest = [dbuf, 'Value'];
  for (let k = 0; k < strips; k++) {
    if (k === strips - 1) { sections.push(rest); break; }
    const sp = gate(C.Expr_String_Split, { Delimiter: STRIP_SEP, Occurrence: 1, bCaseSensitive: true });
    wire(...rest, sp, 'Input');
    sections.push([sp, 'Left']); rest = [sp, 'Right'];
  }

  // ---- one decoder per strip (inner grids are sealed: data in through a MicrochipInput, text out through a MicrochipOutput)
  for (let k = 0; k < strips; k++) {
    const shell = gate(C.Microchip_CountFor, { Count: 0, FirstIndex: 0, Step: 1, bRunAcrossTicks: true });
    const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
    w.registerMicrochipLink(shell.h, grid);
    wire(...op(null, C.Expr_Floor, op(null, C.Expr_MathDivide, op(null, C.Expr_String_Length, sections[k]), K(null, TOKEN))), shell, 'Count');
    wire(start[start.length - 1], 'ExecOut', shell, 'Exec');
    const din = gate(C.MicrochipInput, { PortLabel: 'data', PortOrder: 0 }, grid); wire(...sections[k], din, 'RER_Input');
    const data = [din, 'RER_Output'];
    const entry = gate(C.CallableEntry_CountFor, {}, grid);
    const idx = [entry, 'Index'];
    const acc = gate(C.Var, { Value: str('') }, grid);
    // read the accumulator once at the top (outputs are memoized inside an iteration), write it last
    const accGet = gate(C.Exec_Var_Get, {}, grid); wire(acc, 'VarRef', accGet, 'VarRef');
    const at = op(grid, C.Expr_MathMultiply, idx, K(grid, TOKEN));
    const find = ch => { const x = gate(C.Expr_String_Find, { Input: ALPHA, Search: '', Start: 0, bCaseSensitive: true }, grid); wire(...ch, x, 'Search'); return [x, 'Output']; };
    const ch = j => find(sub(grid, data, j ? op(grid, C.Expr_MathAdd, at, K(grid, j)) : at, 1));
    const [cr, cg, cb, cc] = [0, 1, 2, 3].map(ch);
    const hex2 = c => sub(grid, LV_HEX, op(grid, C.Expr_MathMultiply, c, K(grid, 2)), 2);
    const os = sub(grid, OS, K(grid, 0), op(grid, C.Expr_MathAdd, cc, K(grid, 1)));
    const fmt = gate(C.Expr_String_FormatText, { FormatString: '<color="{A}{B}{C}">{D}</>' }, grid);
    wire(...hex2(cr), fmt, 'InputA'); wire(...hex2(cg), fmt, 'InputB'); wire(...hex2(cb), fmt, 'InputC'); wire(...os, fmt, 'InputD');
    const piece = select(grid, [fmt, 'Output'], K(grid, '\n'), op(grid, C.Expr_CompareEqual, cr, K(grid, NL)));
    const accCat = gate(C.Expr_String_Concatenate, { Separator: '' }, grid);
    wire(...select(grid, [accGet, 'Value'], K(grid, ''), op(grid, C.Expr_CompareEqual, idx, K(grid, 0))), accCat, 'InputA'); wire(...piece, accCat, 'InputB');
    wire(entry, 'Body', accGet, 'Exec');
    chain(accGet, set(grid, acc, [accCat, 'Output']));
    const dout = gate(C.MicrochipOutput, { PortLabel: 'text', PortOrder: 0 }, grid); wire(acc, 'Value', dout, 'RER_Input');
    const pic = gate(C.Var, { Value: str(glyph) });
    wire(pic, 'Value', screens[k], 'Text');
    const show = set(null, pic, [dout, 'RER_Output']); wire(shell, 'Completed', show, 'Exec');
    const free = set(null, busy[k], K(null, 0)); wire(show, 'ExecOut', free, 'Exec');
    if (debug) {
      // log line per decoded strip: strip | iterations | text length | head
      const f = gate(C.Expr_String_FormatText, { FormatString: `ogrid|${k}|{A}|{B}|{C}` });
      wire(shell, 'IterationsExecuted', f, 'InputA'); wire(...op(null, C.Expr_String_Length, [dout, 'RER_Output']), f, 'InputB');
      wire(...sub(null, [dout, 'RER_Output'], K(null, 0), 60), f, 'InputC');
      const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(free, 'ExecOut', p, 'Exec');
    }
  }
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'O grid receiver' }, externalAssets: FONTS });
}

/** Clear boxes of a receiver (file coords [centre, half]): screen + gate field. */
export function receiverBoxes(L) {
  const hx = L.side / 2;
  // gates: 8 a row, 40 apart from y 40 (4 strips = about 110 gates = 14 rows)
  return [[[0, 0, L.z0 + hx], [hx, 2, hx]], [[0, 330, L.z0 + 10], [180, 310, 20]]];
}
