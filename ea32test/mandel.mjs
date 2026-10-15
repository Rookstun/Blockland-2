// WIRE MANDELBROT (EA3.2): a 96 x 64 glow-pixel wall rendered entirely by
// in-game logic gates. One For Loop chip (run across ticks) is a per-pixel
// escape-time state machine: init pixel -> iterate z = z^2 + c -> finalize
// (cosine palette from the escape count, Set Brick Property on the pixel's
// brick ref out of an Any Value array, next pixel; Break after the last).
// View parameters live in main-grid Vars and enter the sealed loop grid
// through MicrochipInput ports. Chat: /mbin /mbout /mbl /mbr /mbu /mbd
// /mbmore /mbless /mbauto /mbreset /mbfast. Auto tour (on at load) zooms into
// Seahorse Valley frame after frame. Its own owner, so heavy frames never
// block renderman's chips (10 ms/owner wire budget).
// node ea32test/mandel.mjs <brs4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk, brickRefs } from './lib.mjs';
const [dist, out] = process.argv.slice(2);

export const W = 96, H = 64, PX = 10;              // pixels, pixel size (units)
const WALL_Z = 60;                                 // wall bottom (local z)
const TOUR = { x: -0.743643887037151, y: 0.131825904205330 };
const HOME = { x: -0.6, y: 0, scale: 3.4, maxit: 64 };
// chunked rendering: CHUNK iterations every 0.05 s (~5 us each) keeps the game thread
// light (a run-across-ticks loop took the full 10 ms budget every tick = ~60% of it)
const CHUNK_SLOW = 1500, CHUNK_FAST = 4000;
const OWNER = { id: 'ea320d0d-0000-4b0b-9a11-000000000096', name: 'Wire Mandelbrot', display_name: 'Wire Mandelbrot' };

// Brickadia is left-handed: seen from the deck (local -y) +x runs to the LEFT, so column 0 sits at +x
const pixPos = p => [(W * PX) / 2 - PX / 2 - (p % W) * PX, 0, WALL_Z + (H - 1 - Math.floor(p / W)) * PX + PX / 2];

async function build(refs) {
  // gates live behind the wall (y > 0), out of sight of the viewing deck
  const k = await mk(dist, { owner: OWNER, mainBase: [-220, 80], rowStep: 40 });
  const { w, C, gate, wire, print, chip, num } = k;
  const g = (c, data, grid) => gate(c, data ?? {}, grid);

  // ---- the wall ----------------------------------------------------------
  for (let p = 0; p < W * H; p++)
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [PX / 2, 2, PX / 2], position: pixPos(p), color: [12, 12, 20],
      material: 'BMC_Glow', material_intensity: 2, owner_index: k.ownerIdx });
  // frame round the wall (dark, 1 stud) and a back plate
  const fw = (W * PX) / 2 + PX, fz0 = WALL_Z - PX, fz1 = WALL_Z + H * PX + PX;
  const frame = (x, z, sx, sz) => w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [sx, 4, sz], position: [x, 0, z], color: [25, 25, 32], owner_index: k.ownerIdx });
  frame(0, fz0 + PX / 2, fw, PX / 2); frame(0, fz1 - PX / 2, fw, PX / 2);
  frame(-fw + PX / 2, (fz0 + fz1) / 2, PX / 2, (fz1 - fz0) / 2 - PX); frame(fw - PX / 2, (fz0 + fz1) / 2, PX / 2, (fz1 - fz0) / 2 - PX);
  w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [fw, 2, (fz1 - fz0) / 2], position: [0, 8, (fz0 + fz1) / 2], color: [8, 8, 12], owner_index: k.ownerIdx });
  // viewing deck in front of the wall (y < 0 = the face side)
  for (let i = -2; i < 2; i++) for (let j = 0; j < 2; j++)
    w.addBrick({ asset: 'PB_DefaultTile', size: [130, 120, 2], position: [i * 260 + 130, -140 - j * 240, -2], color: [30, 30, 38], owner_index: k.ownerIdx });

  // ---- status board above the wall ---------------------------------------
  const TEXT = { Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 12, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
    Color: { B: 255, G: 240, R: 200, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { B: 20, G: 10, R: 10, A: 255 }, OutlineWidth: 2,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: 'WIRE MANDELBROT' };
  const board = { h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [fw, 4, 40], position: [0, 0, fz1 + 44], color: [10, 10, 16], owner_index: k.ownerIdx,
    components: [{ type: C.TextDisplay.NAME, data: TEXT }] }), c: C.TextDisplay };

  // ---- view state (main grid) --------------------------------------------
  const v = {
    cx: g(C.Var, { Value: num(TOUR.x) }), cy: g(C.Var, { Value: num(TOUR.y) }),
    scale: g(C.Var, { Value: num(HOME.scale) }), maxit: g(C.Var, { Value: num(HOME.maxit) }),
    auto: g(C.Var, { Value: num(1) }), want: g(C.Var, { Value: num(1) }), frame: g(C.Var, { Value: num(0) }),
    t0: g(C.Var, { Value: num(0) }), ms: g(C.Var, { Value: num(0) }), running: g(C.Var, { Value: num(0) }),
    fi: g(C.Var, { Value: num(0) }), chunk: g(C.Var, { Value: num(CHUNK_SLOW) }),
  };
  const val = name => [v[name], 'Value'];
  const op = (c, a, b, data = {}) => { const x = g(c, data); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (b) wire(...b, x, 'InputB'); return [x, 'Output']; };
  const K = n => { const x = g(C.Var, { Value: num(n) }); return [x, 'Value']; };
  // exec chain helper: set(var, valuePort) returns gate; chain(...gates) links ExecOut -> Exec
  const set = (name, src) => { const s = g(C.Exec_Var_Set, {}); wire(v[name], 'VarRef', s, 'VarRef'); wire(...src, s, 'Value'); return s; };
  const chain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1], 'ExecOut', gs[i], 'Exec'); return gs; };
  const unionAll = srcs => { // many exec sources -> one
    let cur = srcs[0];
    for (let i = 1; i < srcs.length; i++) { const u = g(C.Exec_Union); wire(...cur, u, 'ExecA'); wire(...srcs[i], u, 'ExecB'); cur = [u, 'ExecOut']; }
    return cur;
  };

  // chat commands: each does its sets, then want = 1
  const cmd = (name, help, ...sets) => {
    const e = g(C.Event_ChatCommand, { CommandName: name, HelpText: help });
    const gs = sets.map(([n, src]) => set(n, src));
    chain(...gs);
    if (gs.length) wire(e, 'ExecOut', gs[0], 'Exec');
    return gs.length ? [gs[gs.length - 1], 'ExecOut'] : [e, 'ExecOut'];
  };
  const mul = (a, f) => op(C.Expr_MathMultiply, a, K(f));
  const add = (a, b) => op(C.Expr_MathAdd, a, b);
  const pan = f => mul(val('scale'), f);
  const ends = [
    cmd('mbin', 'Mandelbrot: zoom in 2x', ['scale', mul(val('scale'), 0.5)], ['auto', K(0)]),
    cmd('mbout', 'Mandelbrot: zoom out 2x', ['scale', mul(val('scale'), 2)], ['auto', K(0)]),
    cmd('mbl', 'Mandelbrot: pan left', ['cx', add(val('cx'), pan(-0.2))], ['auto', K(0)]),
    cmd('mbr', 'Mandelbrot: pan right', ['cx', add(val('cx'), pan(0.2))], ['auto', K(0)]),
    cmd('mbu', 'Mandelbrot: pan up', ['cy', add(val('cy'), pan(0.2))], ['auto', K(0)]),
    cmd('mbd', 'Mandelbrot: pan down', ['cy', add(val('cy'), pan(-0.2))], ['auto', K(0)]),
    cmd('mbmore', 'Mandelbrot: double the iterations', ['maxit', op(C.Expr_MathMin, mul(val('maxit'), 2), K(4096))]),
    cmd('mbless', 'Mandelbrot: halve the iterations', ['maxit', op(C.Expr_MathMax, mul(val('maxit'), 0.5), K(16))]),
    cmd('mbreset', 'Mandelbrot: whole set', ['cx', K(HOME.x)], ['cy', K(HOME.y)], ['scale', K(HOME.scale)], ['maxit', K(HOME.maxit)], ['auto', K(0)]),
    cmd('mbauto', 'Mandelbrot: auto zoom tour', ['cx', K(TOUR.x)], ['cy', K(TOUR.y)], ['scale', K(HOME.scale)], ['maxit', K(HOME.maxit)], ['auto', K(1)]),
  ];
  { // /mbfast toggles the chunk size (no re-render)
    const e = g(C.Event_ChatCommand, { CommandName: 'mbfast', HelpText: 'Mandelbrot: toggle render speed' });
    const isSlow = g(C.Expr_CompareLess); wire(...val('chunk'), isSlow, 'InputA'); wire(...K((CHUNK_SLOW + CHUNK_FAST) / 2), isSlow, 'InputB');
    const nc = g(C.Expr_Select); wire(...K(CHUNK_SLOW), nc, 'InputA'); wire(...K(CHUNK_FAST), nc, 'InputB'); wire(isSlow, 'bOutput', nc, 'bSelectB');
    wire(e, 'ExecOut', set('chunk', [nc, 'Output']), 'Exec');
  }
  const wantSet = set('want', K(1));
  wire(...unionAll(ends), wantSet, 'Exec');

  // ---- the render loop chip ---------------------------------------------
  const { shell, grid } = chip(C.Microchip_CountFor, { Count: CHUNK_SLOW, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
  const ig = (c, data) => gate(c, data ?? {}, grid);
  const port = (label, order, src) => { const p = ig(C.MicrochipInput, { PortLabel: label, PortOrder: order }); wire(...src, p, 'RER_Input'); return [p, 'RER_Output']; };
  const P = { cx: port('cx', 0, val('cx')), cy: port('cy', 1, val('cy')), scale: port('scale', 2, val('scale')), maxit: port('maxit', 3, val('maxit')) };
  // each Exec runs one chunk; the state Vars carry over. FirstIndex 0 only on a
  // frame's first chunk, so Index == 0 (reset to pixel 0) happens once per frame.
  wire(...val('chunk'), shell, 'Count');
  wire(...val('fi'), shell, 'FirstIndex');

  // Loop body = read -> compute -> write. Inside an iteration, expression
  // outputs are memoized and a Var read after a Set can be stale (EA3.2
  // probe ea32test/gen8.mjs), so every state var is read ONCE through
  // Exec_Var_Get at the top, everything is computed from those reads, and the
  // writes come last with nothing reading after them.
  const iv = n => ig(C.Var, { Value: num(n) });
  const s = { p: iv(0), n: iv(0), zr: iv(0), zi: iv(0), cr: iv(0), ci: iv(0) };
  const IK = n => [ig(C.Var, { Value: num(n) }), 'Value'];
  const iop = (c, a, b) => { const x = ig(c); if (a) wire(...a, x, c.PORTS.InputA ? 'InputA' : 'Input'); if (b) wire(...b, x, 'InputB'); return [x, c.PORTS.bOutput ? 'bOutput' : 'Output']; };
  const iset = (n, src) => { const x = ig(C.Exec_Var_Set); wire(s[n], 'VarRef', x, 'VarRef'); wire(...src, x, 'Value'); return x; };
  const ichain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1], 'ExecOut', gs[i], 'Exec'); return gs; };
  const pick = (a, b, cond) => { const x = ig(C.Expr_Select); wire(...a, x, 'InputA'); wire(...b, x, 'InputB'); wire(...cond, x, 'bSelectB'); return [x, 'Output']; };

  const entry = ig(C.CallableEntry_CountFor);
  const rd = {};
  const reads = ['p', 'n', 'zr', 'zi', 'cr', 'ci'].map(n => { const x = ig(C.Exec_Var_Get); wire(s[n], 'VarRef', x, 'VarRef'); rd[n] = [x, 'Value']; return x; });
  ichain(...reads);
  wire(entry, 'Body', reads[0], 'Exec');
  // effective state: the frame's first iteration starts at pixel 0; n == 0 starts a pixel
  const first = iop(C.Expr_CompareEqual, [entry, 'Index'], IK(0));
  const pE = pick(rd.p, IK(0), first), nE = pick(rd.n, IK(0), first);
  const fresh = iop(C.Expr_CompareEqual, nE, IK(0));
  const step = iop(C.Expr_MathDivide, P.scale, IK(W));
  const px = iop(C.Expr_MathModulo, pE, IK(W));
  const py = iop(C.Expr_Floor, iop(C.Expr_MathDivide, pE, IK(W)));
  const crE = pick(rd.cr, iop(C.Expr_MathAdd, P.cx, iop(C.Expr_MathMultiply, iop(C.Expr_MathSubtract, px, IK(W / 2 - 0.5)), step)), fresh);
  const ciE = pick(rd.ci, iop(C.Expr_MathAdd, P.cy, iop(C.Expr_MathMultiply, iop(C.Expr_MathSubtract, IK(H / 2 - 0.5), py), step)), fresh);
  const zrE = pick(rd.zr, IK(0), fresh), ziE = pick(rd.zi, IK(0), fresh);
  const zr2 = iop(C.Expr_MathMultiply, zrE, zrE), zi2 = iop(C.Expr_MathMultiply, ziE, ziE);
  const esc = iop(C.Expr_CompareGreater, iop(C.Expr_MathAdd, zr2, zi2), IK(4));
  // inside the main cardioid or the period-2 bulb = in the set: finish at once (black)
  const x4 = iop(C.Expr_MathSubtract, crE, IK(0.25));
  const ci2 = iop(C.Expr_MathMultiply, ciE, ciE);
  const q = iop(C.Expr_MathAdd, iop(C.Expr_MathMultiply, x4, x4), ci2);
  const card = iop(C.Expr_CompareLessOrEqual, iop(C.Expr_MathMultiply, q, iop(C.Expr_MathAdd, q, x4)), iop(C.Expr_MathMultiply, ci2, IK(0.25)));
  const x1 = iop(C.Expr_MathAdd, crE, IK(1));
  const bulb = iop(C.Expr_CompareLessOrEqual, iop(C.Expr_MathAdd, iop(C.Expr_MathMultiply, x1, x1), ci2), IK(0.0625));
  const inside = ig(C.Expr_LogicalOR); wire(...card, inside, 'bInputA'); wire(...bulb, inside, 'bInputB');
  const outOfIt = iop(C.Expr_CompareGreaterOrEqual, nE, P.maxit);
  const doneG = ig(C.Expr_LogicalOR); wire(...outOfIt, doneG, 'bInputA'); wire(inside, 'bOutput', doneG, 'bInputB');
  const done = [doneG, 'bOutput'];
  const orGate = ig(C.Expr_LogicalOR); wire(...esc, orGate, 'bInputA'); wire(...done, orGate, 'bInputB');
  const br = ig(C.Exec_Branch); wire(orGate, 'bOutput', br, 'bCond');
  wire(reads[reads.length - 1], 'ExecOut', br, 'Exec');
  // finalize pixel pE: cosine palette of nE (black inside the set), next pixel
  const t = iop(C.Expr_MathAdd, iop(C.Expr_MathMultiply, nE, IK(0.11)), IK(3.6));
  const chan = ph => iop(C.Expr_MathAdd, IK(127.5), iop(C.Expr_MathMultiply, IK(127.5), iop(C.Expr_MathCos, iop(C.Expr_MathAdd, t, IK(ph)))));
  const mc = ig(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 });
  wire(...chan(0), mc, 'R'); wire(...chan(2.1), mc, 'G'); wire(...chan(4.2), mc, 'B');
  const black = ig(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 });
  const colour = pick([mc, 'Output'], [black, 'Output'], done);
  const arr = ig(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: Array.from({ length: W * H }, (_, p) => ({ $variant: 'BRSavedBrickRef',
    value: refs?.get(pixPos(p).join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 } })) } });
  const get = ig(C.Exec_ArrayVar_Get); wire(arr, 'ArrayVarRef', get, 'ArrayVarRef'); wire(...pE, get, 'Index');
  const paint = ig(C.Exec_SetBrickProperty, { Property: 1 }); wire(get, 'Value', paint, 'Brick'); wire(...colour, paint, 'Value');
  const pNext = iop(C.Expr_MathAdd, pE, IK(1));
  const fin = ichain(get, paint, iset('p', pNext), iset('n', IK(0)));
  wire(br, 'ExecOutA', fin[0], 'Exec');
  const last = ig(C.Exec_Branch); wire(...iop(C.Expr_CompareGreaterOrEqual, pNext, IK(W * H)), last, 'bCond');
  wire(fin[3], 'ExecOut', last, 'Exec');
  const brk = ig(C.Exec_CallableBreak); wire(last, 'ExecOutA', brk, 'Exec');
  // step: z = z^2 + c from the effective values, n + 1; p/c written back (they may be fresh)
  const stepc = ichain(
    iset('zr', iop(C.Expr_MathAdd, iop(C.Expr_MathSubtract, zr2, zi2), crE)),
    iset('zi', iop(C.Expr_MathAdd, iop(C.Expr_MathMultiply, iop(C.Expr_MathMultiply, zrE, ziE), IK(2)), ciE)),
    iset('cr', crE), iset('ci', ciE), iset('n', iop(C.Expr_MathAdd, nE, IK(1))), iset('p', pE));
  wire(br, 'ExecOutB', stepc[0], 'Exec');

  // ---- scheduler. Slow clock: a wanted frame (re)starts at pixel 0 (new
  // parameters take effect at once). Fast clock: run a chunk while running.
  const clock = g(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.05, OffTimeSeconds: 0.45, IntervalSeconds: 0.5 });
  const tick = g(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const wantB = g(C.Expr_CompareGreater); wire(...val('want'), wantB, 'InputA'); wire(...K(0.5), wantB, 'InputB');
  const go = g(C.Exec_Branch); wire(wantB, 'bOutput', go, 'bCond'); wire(tick, 'OnRisingEdge', go, 'Exec');
  const up = g(C.Expr_ServerUptime);
  const start = chain(set('want', K(0)), set('fi', K(0)), set('running', K(1)), set('t0', [up, 'Uptime']));
  wire(go, 'ExecOutA', start[0], 'Exec');
  const fast = g(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const ftick = g(C.Expr_EdgeDetectorExec); wire(fast, 'Pulse', ftick, 'Input');
  const runB = g(C.Expr_CompareGreater); wire(...val('running'), runB, 'InputA'); wire(...K(0.5), runB, 'InputB');
  const run = g(C.Exec_Branch); wire(runB, 'bOutput', run, 'bCond'); wire(ftick, 'OnRisingEdge', run, 'Exec');
  wire(run, 'ExecOutA', shell, 'Exec');

  // ---- after each chunk: later chunks continue; a chunk cut short by Break = frame done
  const cont = set('fi', K(1));
  wire(shell, 'Completed', cont, 'Exec');
  const short = g(C.Expr_CompareLess); wire(shell, 'IterationsExecuted', short, 'InputA'); wire(...val('chunk'), short, 'InputB');
  const endB = g(C.Exec_Branch); wire(short, 'bOutput', endB, 'bCond'); wire(cont, 'ExecOut', endB, 'Exec');
  const fdone = chain(set('running', K(0)), set('frame', add(val('frame'), K(1))), set('ms', mul(op(C.Expr_MathSubtract, [up, 'Uptime'], val('t0')), 1000)));
  wire(endB, 'ExecOutA', fdone[0], 'Exec');
  const log = print('ea32 mb frame={A} ms={B} scale={C} maxit={D} chunk={E}');
  wire(fdone[2], 'ExecOut', log.p, 'Exec');
  wire(...val('frame'), log.f, 'InputA'); wire(...val('ms'), log.f, 'InputB'); wire(...val('scale'), log.f, 'InputC');
  wire(...val('maxit'), log.f, 'InputD'); wire(...val('chunk'), log.f, 'InputE');
  const autoB = g(C.Exec_Branch); const autoOn = g(C.Expr_CompareGreater); wire(...val('auto'), autoOn, 'InputA'); wire(...K(0.5), autoOn, 'InputB');
  wire(autoOn, 'bOutput', autoB, 'bCond'); wire(log.p, 'ExecOut', autoB, 'Exec');
  // auto: zoom 0.8x, iterations +6 (cap 1500); past f64 precision start over
  const deep = g(C.Expr_CompareLess); wire(...val('scale'), deep, 'InputA'); wire(...K(2e-12), deep, 'InputB');
  const newScale = g(C.Expr_Select); wire(...mul(val('scale'), 0.8), newScale, 'InputA'); wire(...K(HOME.scale), newScale, 'InputB'); wire(deep, 'bOutput', newScale, 'bSelectB');
  const newIt = g(C.Expr_Select); wire(...op(C.Expr_MathMin, add(val('maxit'), K(6)), K(1500)), newIt, 'InputA'); wire(...K(HOME.maxit), newIt, 'InputB'); wire(deep, 'bOutput', newIt, 'bSelectB');
  const autoc = chain(set('scale', [newScale, 'Output']), set('maxit', [newIt, 'Output']), set('want', K(1)));
  wire(autoB, 'ExecOutA', autoc[0], 'Exec');

  // ---- live status text
  const zoom = op(C.Expr_MathDivide, K(HOME.scale), val('scale'));
  const fmt = g(C.Expr_String_FormatText, { FormatString: 'WIRE MANDELBROT   {A}, {B}   zoom {C}x   {D} iter   frame {E} in {F} ms\n/mbin /mbout /mbl /mbr /mbu /mbd /mbmore /mbless /mbauto /mbreset /mbfast' });
  wire(...val('cx'), fmt, 'InputA'); wire(...val('cy'), fmt, 'InputB'); wire(...zoom, fmt, 'InputC');
  wire(...val('maxit'), fmt, 'InputD'); wire(...val('frame'), fmt, 'InputE'); wire(...val('ms'), fmt, 'InputF');
  wire(fmt, 'Output', board, 'Text');

  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'Wire Mandelbrot (EA3.2 loops + brick refs)' }, externalAssets: [{ type: 'BrickFontDescriptor', name: 'IosevkaTerm' }] });
}

const first = await build(null);
const refs = brickRefs((await mk(dist)).WorldReader, first);
const bytes = await build(refs);
const missing = Array.from({ length: W * H }, (_, p) => refs.get(pixPos(p).join(','))).filter(r => !r).length;
if (missing) throw Error(`${missing} pixel refs not found`);
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes, ${W}x${H} pixels`);
