// WORDLE BULLETIN BOARD (EA3.2, 2026-10-15, owner: "a sign post thats just
// wordle that you can play. like a bulletin board with the entire wordle game
// on it"). One shared puzzle on a cork board: 6 x 5 letter tiles, a keyboard
// that colours in, a message strip, a button lectern in front.
//   button (E) -> text input popup -> guess.   /wordle <word> in chat works too.
//   puzzle over -> button asks Yes/No for a fresh word.
// All logic is wires in one microchip behind the board. The display is
// REACTIVE: four string Vars (board letters, tile states 0-3, key states 0-3,
// message) feed Substring/Select expressions wired straight into each tile's
// TextDisplay.Text and BrickPropertyChanger.Color, so a guess is just a few Var
// Sets. Words: answers.txt (common words), dict5.txt (valid guesses; server
// /usr/share/dict american + british 5-letter + 4-letter plurals).
// Facing local -y (left-handed: column 0 sits at +x). Origin = ground under the board.
// node wordle/gen.mjs <brs4 dist.mjs> <out.brz>
import { readFileSync, writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const here = f => new URL(f, import.meta.url);
const words = f => readFileSync(here(f), 'utf8').split(/\s+/).filter(w => /^[a-z]{5}$/.test(w)).map(w => w.toUpperCase());
const ANSWERS = words('answers.txt'), DICT = [...new Set([...words('dict5.txt'), ...ANSWERS])];

const OWNER = { id: 'ea32d0d1-0000-4b0b-9a11-00000000d1e5', name: 'Wordle Board', display_name: 'Wordle Board' };
const k = await mk(dist, { owner: OWNER });
const { w, C, gate, wire, num, str } = k;
const O = k.ownerIdx;

// ---- look ------------------------------------------------------------------
const CORK = [176, 132, 84], TIMBER = [96, 70, 46], TIMBER2 = [120, 88, 58], ROOF = [120, 44, 38], PAPER = [236, 228, 206], INK = [40, 32, 24];
const TILE = { empty: [214, 206, 188], gray: [88, 88, 92], yellow: [214, 172, 40], green: [92, 160, 72] };
const KEYC = { ...TILE, empty: [196, 190, 176] };
const FONTS = ['Bungee', 'MonaspaceXenon'];
const TEXT = {
  Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 3, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 250, G: 250, B: 250, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { R: 30, G: 28, B: 26, A: 255 }, OutlineWidth: 2,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};
const STYLE = {
  tile: { LineHeight: 2.3 },
  key: { LineHeight: 1.4, OutlineWidth: 1, Color: { R: 30, G: 28, B: 26, A: 255 }, Outline: 0 },
  title: { LineHeight: 2.6, Color: { R: 250, G: 214, B: 90, A: 255 } },
  msg: { Font: 1, LineHeight: 0.8, Color: { R: INK[0], G: INK[1], B: INK[2], A: 255 }, OutlineWidth: 0, Outline: 0 },
  note: { Font: 1, LineHeight: 2, Color: { R: INK[0], G: INK[1], B: INK[2], A: 255 }, OutlineWidth: 0, Outline: 0 },
};
const box = (x, y, z, hx, hy, hz, color, extra = {}) => w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, hy, hz], position: [x, y, z], color, owner_index: O, ...extra });
// a plank facing -y (ruins.mjs sign orientation: direction 3 rotation 1, local x -> world -x, local y -> world -z), 2 thick, front at y-1
const plank = (x, y, z, hx, hz, color, text, style, more = []) => {
  const comps = text == null ? more : [{ type: C.TextDisplay.NAME, data: { ...TEXT, ...style, Text: text } }, ...more];
  return { h: w.addBrick({ asset: 'PB_DefaultMicroBrick', direction: 3, rotation: 1, size: [hx, hz, 1], position: [x, y, z], color, owner_index: O, components: comps }), c: C.TextDisplay };
};
const changer = color => ({ type: C.BrickPropertyChanger.NAME, data: { bVisibility: true, bCollisionEnabled: true, bCollisionEnabled_Player: true,
  bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true, bCollisionEnabled_Weapon: true,
  bCollisionEnabled_Interaction: true, bCollisionEnabled_Physics: true, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 0, Material: 0 } });

// frame (owner 2026-10-15: first one was "way way way too big"; now about notice-board size, 96 x 174):
// posts (0..150; anything crossing them above was rejected), cork panel, rails, header with the name, roof; keys z 30..58, tiles 63..133, message 136..146
for (const s of [-1, 1]) { box(s * 47, 2, 75, 3, 3, 75, TIMBER); box(s * 43, 2, 87, 1, 3, 63, TIMBER2); }
box(0, 2, 87, 42, 2, 63, CORK);
box(0, 2, 152, 50, 3, 2, TIMBER2);
box(0, 2, 162, 50, 2, 8, [36, 60, 44]);
box(0, 2, 172, 60, 8, 2, ROOF);
box(0, 2, 175, 54, 5, 1, ROOF);
plank(0, -1, 162, 42, 5, [30, 48, 36], 'WORDLE', STYLE.title);
// lectern with the button
box(0, -26, 14, 4, 4, 14, TIMBER);
box(0, -26, 30, 7, 6, 2, TIMBER2);
const BTN = C.AnimatedButton;
const button = { h: w.addBrick({ asset: 'B_Button', position: [0, -26, 34], color: [92, 160, 72], owner_index: O,
  components: [{ type: BTN.NAME, data: { PressSound: 2, ReleaseSound: 3, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Guess a word' } }] }), c: BTN };

// ---- logic (all gates inside one microchip behind the board) -----------------
// chip bricks are always invisible + no collision (house rule, as pots/bushes/heal): addMicrochip can't, so build it by hand
const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [0, 10, 60], owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
const chip = { brick: chipBrick, grid: w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 40, Y: 40, Z: 2 } } }) };
w.registerMicrochipLink(chip.brick, chip.grid);
const g = (c, data = {}) => gate(c, data, chip.grid);
const consts = new Map();
const K = v => { const key = typeof v + ':' + v; if (!consts.has(key)) consts.set(key, [g(C.Var, { Value: typeof v === 'string' ? str(v) : num(v) }), 'Value']); return consts.get(key); };
const P = v => (Array.isArray(v) ? v : K(v)); // port or constant
const ex = (c, ins, outPort) => { const x = g(c); for (const [port, src] of Object.entries(ins)) wire(...P(src), x, port); return [x, outPort ?? (c.PORTS.bOutput ? 'bOutput' : 'Output')]; };
const sub = (s, start, len) => ex(C.Expr_String_Substring, { Input: s, Start: start, Length: len });
const eq = (a, b) => ex(C.Expr_CompareEqual, { InputA: a, InputB: b });
const and = (a, b) => ex(C.Expr_LogicalAND, { bInputA: a, bInputB: b });
const or = (a, b) => ex(C.Expr_LogicalOR, { bInputA: a, bInputB: b });
const not = a => ex(C.Expr_LogicalNOT, { bInput: a });
const sel = (a, b, cond) => ex(C.Expr_Select, { InputA: a, InputB: b, bSelectB: cond }); // cond ? b : a
const add = (a, b) => ex(C.Expr_MathAdd, { InputA: a, InputB: b });
const mul = (a, b) => ex(C.Expr_MathMultiply, { InputA: a, InputB: b });
const gt = (a, b) => ex(C.Expr_CompareGreater, { InputA: a, InputB: b });
const fmt = (f, ...ins) => { const x = g(C.Expr_String_FormatText, { FormatString: f }); ins.forEach((s, i) => wire(...P(s), x, 'Input' + 'ABCDEFG'[i])); return [x, 'Output']; };
const b01 = b => sel(0, 1, b);
const vars = {};
const V = (name, init) => { vars[name] = g(C.Var, { Value: typeof init === 'string' ? str(init) : num(init) }); return [vars[name], 'Value']; };
const set = (name, src) => { const s = g(C.Exec_Var_Set); wire(vars[name], 'VarRef', s, 'VarRef'); wire(...P(src), s, 'Value'); return s; };
const chain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1], 'ExecOut', gs[i], 'Exec'); return gs; };
const branch = cond => { const b = g(C.Exec_Branch); wire(...cond, b, 'bCond'); return b; };
const union = (a, b) => { const u = g(C.Exec_Union); wire(...a, u, 'ExecA'); wire(...b, u, 'ExecB'); return u; };

const SP30 = ' '.repeat(30), Z30 = '0'.repeat(30), Z26 = '0'.repeat(26);
let ans = V('ans', ''), board = V('board', SP30), status = V('status', Z30), keys = V('keys', Z26), row = V('row', 0), over = V('over', 0);
const msg = V('msg', 'Pinning up a puzzle...'), guess = V('guess', ''), who = V('who', '');
const ANS = K(ANSWERS.join(',') + ',');
// one wire string tops out somewhere under 34k chars (mpack_error_too_big on load; 4.8k is fine): dictionary in chunks
const DIC = [];
for (let i = 0; i < DICT.length; i += 780) DIC.push(K(',' + DICT.slice(i, i + 780).join(',') + ','));
const isOver = gt(over, 0.5);

// ---- display: tiles, keys, message ----------------------------------------
const colors = {};
// channels WIRED from constants: R/G/B written into the gate's data came out wrong in game (empty showed light blue, grey dark blue)
const mkColor = c => { const x = g(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 }); wire(...K(c[0]), x, 'R'); wire(...K(c[1]), x, 'G'); wire(...K(c[2]), x, 'B'); return [x, 'Output']; };
for (const [n, c] of Object.entries(TILE)) colors['t' + n] = mkColor(c);
for (const [n, c] of Object.entries(KEYC)) colors['k' + n] = mkColor(c);
const stateColor = (digit, pre) => sel(sel(sel(colors[pre + 'empty'], colors[pre + 'gray'], eq(digit, '1')), colors[pre + 'yellow'], eq(digit, '2')), colors[pre + 'green'], eq(digit, '3'));
const PITCH = 12;
for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
  const t = r * 5 + c;
  const tile = plank((2 - c) * PITCH, -1, 128 - r * PITCH, 5, 5, TILE.empty, '', STYLE.tile, [changer(TILE.empty)]);
  wire(...sub(board, t, 1), tile, 'Text');
  wire(...stateColor(sub(status, t, 1), 't'), { h: tile.h, c: C.BrickPropertyChanger }, 'Color');
}
const KEYROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
KEYROWS.forEach((letters, kr) => [...letters].forEach((L, i) => {
  const key = plank(((letters.length - 1) / 2 - i) * 8, -1, 54 - kr * 10, 3, 4, KEYC.empty, L, STYLE.key, [changer(KEYC.empty)]);
  wire(...stateColor(sub(keys, L.charCodeAt(0) - 65, 1), 'k'), { h: key.h, c: C.BrickPropertyChanger }, 'Color');
}));
const msgBoard = plank(0, -1, 141, 40, 5, PAPER, '', STYLE.msg);
wire(...msg, msgBoard, 'Text');
// every message change goes to the server log ("[Wire Graph] wordle|<msg>|<board>|<status>")
{ const cd = g(C.Expr_ChangeDetectorExec); wire(...msg, cd, 'Input');
  const pr = g(C.Exec_PrintToConsole, { Text: '' }); wire(cd, 'OnChanged', pr, 'Exec'); wire(...fmt('wordle|{A}|{B}|{C}', msg, board, status), pr, 'Text'); }

// ---- new puzzle ---------------------------------------------------------------
const rnd = g(C.Exec_Random, { Min: num(0), Max: num(ANSWERS.length - 0.001) });
const pick = sub(ANS, mul(ex(C.Expr_Floor, { Input: [rnd, 'Output'] }), 6), 5);
const fresh = chain(rnd, set('ans', pick), set('board', SP30), set('status', Z30), set('keys', Z26), set('row', 0), set('over', 0),
  set('msg', 'A fresh word is pinned up. Press the button to guess.'));
// an input takes ONE wire: on-load and the Yes button meet in a Union
const newGameU = g(C.Exec_Union); wire(newGameU, 'ExecOut', fresh[0], 'Exec');
// on load: start one if there is none (a saved world keeps its puzzle)
{ const sw = g(C.Stopwatch, { Limit: 3, Time: 0, bRunning: true }); const edge = g(C.Expr_EdgeDetectorExec); wire(sw, 'Expired', edge, 'Input');
  const b = branch(eq(ans, '')); wire(edge, 'OnRisingEdge', b, 'Exec'); wire(b, 'ExecOutA', newGameU, 'ExecA'); }

// ---- input: the button (popup) and /wordle -----------------------------------
const press = g(C.Expr_EdgeDetectorExec); wire(button, 'bHeld', press, 'Input');
const ps = g(C.Exec_PlayerState_GetFromEntity); wire(press, 'OnRisingEdge', ps, 'Exec'); wire(button, 'Character', ps, 'Entity');
const pb = branch(isOver); wire(ps, 'ExecOut', pb, 'Exec');
const yn = g(C.Exec_PlayerState_ShowYesNoBox, { Title: 'WORDLE', Message: 'This one is finished. Pin up a fresh word?' });
wire(pb, 'ExecOutA', yn, 'Exec'); wire(ps, 'PlayerState', yn, 'PlayerState');
wire(yn, 'YesClicked', newGameU, 'ExecB');
const box5 = g(C.Exec_PlayerState_ShowTextInputBox, { Title: 'WORDLE', Message: 'Type a five-letter word.' });
wire(pb, 'ExecOutB', box5, 'Exec'); wire(ps, 'PlayerState', box5, 'PlayerState');
const nm1 = g(C.Exec_PlayerState_GetDisplayName); wire(box5, 'OkClicked', nm1, 'Exec'); wire(box5, 'ClickedBy', nm1, 'PlayerState');
const in1 = chain(set('guess', [box5, 'Text']), set('who', [nm1, 'DisplayName'])); wire(nm1, 'ExecOut', in1[0], 'Exec');
const cmd = g(C.Event_ChatCommand, { CommandName: 'wordle', HelpText: 'Guess a word on the Wordle board' });
const nm2 = g(C.Exec_PlayerState_GetDisplayName); wire(cmd, 'ExecOut', nm2, 'Exec'); wire(cmd, 'PlayerState', nm2, 'PlayerState');
const in2 = chain(set('guess', [cmd, 'Arguments']), set('who', [nm2, 'DisplayName'])); wire(nm2, 'ExecOut', in2[0], 'Exec');
const joined = union([in1[1], 'ExecOut'], [in2[1], 'ExecOut']);
// a Var's Value read right after its Set is stale (the first /wordle scored ""): re-read with Exec_Var_Get
// (and so can any Value read inside the handler): every state Var is read once, here
const getV = name => { const x = g(C.Exec_Var_Get); wire(vars[name], 'VarRef', x, 'VarRef'); return x; };
const NAMES = ['guess', 'who', 'ans', 'board', 'status', 'keys', 'row', 'over'], gets = NAMES.map(getV);
chain(joined, ...gets);
const handle = gets[gets.length - 1], RV = Object.fromEntries(NAMES.map((n, i) => [n, [gets[i], 'Value']]));
const guessV = RV.guess, whoV = RV.who;
({ ans, board, status, keys, row } = RV);

// ---- score the guess (pure expressions over the old state) -------------------
const G = ex(C.Expr_String_ToUpper, { Input: ex(C.Expr_String_Trim, { Input: guessV }) });
const needle = fmt(',{A},', G);
const known = DIC.map(d => ex(C.Expr_String_Contains, { Input: d, Search: needle, bCaseSensitive: false })).reduce((a, b) => or(a, b));
const valid = and(eq(ex(C.Expr_String_Length, { Input: G }), 5), known);
const gl = [0, 1, 2, 3, 4].map(i => sub(G, i, 1)), al = [0, 1, 2, 3, 4].map(i => sub(ans, i, 1));
const green = gl.map((x, i) => eq(x, al[i]));
const sNum = [], sStr = [];
for (let i = 0; i < 5; i++) {
  // yellow: not green and the answer still has an unmatched copy of this letter after the earlier non-green copies in the guess
  let avail = K(0), used = K(0);
  for (let j = 0; j < 5; j++) avail = add(avail, b01(and(eq(al[j], gl[i]), not(green[j]))));
  for (let j = 0; j < i; j++) used = add(used, b01(and(eq(gl[j], gl[i]), not(green[j]))));
  const yellow = and(not(green[i]), gt(avail, used));
  sNum.push(sel(sel(1, 2, yellow), 3, green[i]));
  sStr.push(sel(sel('1', '2', yellow), '3', green[i]));
}
const S = fmt('{A}{B}{C}{D}{E}', ...sStr);
const at5 = mul(row, 5);
const splice = (s, part, at, len, total) => fmt('{A}{B}{C}', sub(s, 0, at), part, sub(s, add(at, len), total));
const newBoard = splice(board, G, at5, 5, 30), newStatus = splice(status, S, at5, 5, 30);
let kk = keys;
for (let i = 0; i < 5; i++) {
  const idx = add(ex(C.Expr_String_CharacterToCodepoint, { Character: gl[i] }, 'Codepoint'), -65);
  const oldS = sub(kk, idx, 1), oldN = ex(C.Expr_String_ParseInt, { Input: oldS }, 'Value');
  kk = splice(kk, sel(oldS, sStr[i], gt(sNum[i], oldN)), idx, 1, 26);
}
const win = eq(S, '33333'), lose = and(not(win), gt(row, 4.5));
const tries = sub('123456', row, 1), next = sub('234567', row, 1);
const vMsg = sel(sel(fmt('{A} tried {B}. Guess {C} of 6.', whoV, G, next), fmt('Six strikes. It was {A}. The board blames {B}.', ans, whoV), lose),
  fmt('{A} got {B} in {C}. The board is mildly impressed.', whoV, ans, tries), win);
const hb = branch(gt(RV.over, 0.5)); wire(handle, 'ExecOut', hb, 'Exec');
wire(hb, 'ExecOutA', set('msg', 'This one is finished. Press the button for a fresh word.'), 'Exec');
const vb = branch(valid); wire(hb, 'ExecOutB', vb, 'Exec');
// row LAST: every new value above reads the old row
const apply = chain(set('board', newBoard), set('status', newStatus), set('keys', kk), set('msg', vMsg), set('over', b01(or(win, lose))), set('row', add(row, 1)));
wire(vb, 'ExecOutA', apply[0], 'Exec');
wire(vb, 'ExecOutB', set('msg', fmt('The board has never heard of "{A}".', G)), 'Exec');

// the game drops the second wire into any input
{ const seen = new Set(); for (const { target: t } of w.wireList) { const key = `${t.brick.grid}/${t.brick.index}/${t.component_type}/${t.port}`; if (seen.has(key)) throw Error('two wires into ' + key); seen.add(key); } }
w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: 'Wordle bulletin board (EA3.2 wires)' }, externalAssets: [...FONTS.map(name => ({ type: 'BrickFontDescriptor', name })),
  { type: 'BrickOneShotAudioDescriptor', name: 'BOSA_Buttons_Button_1_Press' }, { type: 'BrickOneShotAudioDescriptor', name: 'BOSA_Buttons_Button_1_Release' }] });
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes, ${ANSWERS.length} answers, ${DICT.length} valid words, ${consts.size} consts`);
