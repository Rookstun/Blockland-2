// The owner's own request (2026-11-02, in game): "smokable cigarette. no floating wires, microchip. clickable smokable
// cigarette. prefab deletion." A giant cigarette lying on the ground (filter at -x, ember at +x, 14 thick, 110 long).
// Click the filter (Button "Take a drag") -> 2 s puff: the ember flares (point light), smoke rises off the tip (grey
// billboard text on the ember) -> the tip segment burns away and the ember moves down. 5 drags; after the last one the
// whole cigarette removes itself (Exec_Entity_DestroySpawnedPrefab on its own brick grid).
// The cigarette is ONE loose physics grid. ALL its gates sit in ONE hidden microchip inside a sealed cavity in the
// filter (visibility + collision false); the only other gate (ReadBrickGrid, it must sit on the cigarette's own grid)
// lies hidden next to the chip in the same cavity. Every wire runs from the chip to bricks along the axis, i.e. inside
// the cigarette: none in the open air.
// SPAWNED, NOT LOADED (server tests 2026-11-02): DestroySpawnedPrefab ignores a Prefab.Load'ed grid (it logged
// 'burnt out' and kept running, renderman-owned too), so the .brz we load is a PACK = one hidden world-grid chip that
// spawns the embedded cigarette once, 2 s after load (PrefabSpawner Lifetime 0 = forever; the default 5 s killed it),
// and freezes it. The pack must be the map owner's: with the cigarette's own (non-admin) owner nothing spawned.
// The cigarette's bricks keep their own owner (c1a5de00-...0008).
//   node mapgen/cigarette.mjs X Y Z out.brz [job.json]   (job.json = the shell bricks for tools/gemini/ship.mjs checks)
//   CIG_TEST=1: a 3 s clock takes the drags by itself (server test without a player; verified: 5 drags, burnt out, gone)
//   load: br.Prefab.Load "cigarette" X Y Z 0 16   (X Y Z = ground point; the cigarette spans x X-60..X+50, y Y-7..Y+7)
//   remove an unsmoked one: br.World.ClearRegion X Y Z+8 70 12 12 (takes the pack chip + the cigarette entity)
import fs from 'node:fs';
import { makeBuilder } from './builder.mjs';
import { mk } from '../ea32test/lib.mjs';

const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000008', name: 'cigarette', display_name: 'cigarette' };
const PACK_OWNER = MAP_OWNER; // spawning needs an admin owner (tested)
const N = 5, SEG = 16, PUFF_S = 2;
const CLICK = [1, 5, 6, 7]; // filter pieces that take the click: top strip, cavity roof, both side walls (one pin each, ORed)
const PAPER = [244, 242, 234], FILTER = [214, 132, 54], GOLD = [204, 172, 84], EMBER = [255, 92, 24], SMOKE = { R: 196, G: 196, B: 204, A: 255 };
const FONT = { type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' };
const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 7, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 1.1 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: SMOKE, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 1, Billboard: 1, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};
const SMOKE_TXT = ' )\n(\n )\n~';
const changer = c => ({ type: 'Component_BrickPropertyChanger', data: { bVisibility: true, bCollisionEnabled: true, bCollisionEnabled_Player: true,
  bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true, bCollisionEnabled_Weapon: true,
  bCollisionEnabled_Interaction: true, bCollisionEnabled_Physics: true, Color: { R: c[0], G: c[1], B: c[2], A: 255 }, MaterialAlpha: 0, Material: 0 } });

// ---- geometry (builder = overlap guard). Cross-section: A y±7 z2..12, B y±5 z12..14, C y±5 z0..2 (octagon-ish)
export function shell() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`cigarette: ${label} dropped: ${B.dropped.at(-1)}`);
    return B.bricks.at(-1);
  };
  const ring = (x0, x1, color, label, m) => [box(x0, -7, 2, x1, 7, 12, color, label, m), box(x0, -5, 12, x1, 5, 14, color, label, m), box(x0, -5, 0, x1, 5, 2, color, label, m)];
  const filter = [];
  // filter x -60..-30: sealed cavity x -58..-34, y±5, z4..8 holds the chip and the ReadBrickGrid gate
  filter.push(box(-60, -5, 0, -34, 5, 2, FILTER, 'filter'), box(-60, -5, 12, -34, 5, 14, FILTER, 'filter'));
  filter.push(box(-60, -7, 2, -58, 7, 12, FILTER, 'filter mouth'), box(-34, -7, 2, -32, 7, 12, FILTER, 'filter end'));
  filter.push(box(-58, -7, 2, -34, 7, 4, FILTER, 'cavity floor'), box(-58, -7, 8, -34, 7, 12, FILTER, 'cavity roof'));
  filter.push(box(-58, -7, 4, -34, -5, 8, FILTER, 'cavity wall'), box(-58, 5, 4, -34, 7, 8, FILTER, 'cavity wall'));
  filter.push(...ring(-34 + 2, -30, GOLD, 'gold band'));
  B.add({ asset: 'B_1x1_Microchip', size: [5, 5, 2], position: [-52, 0, 6], visibility: false, collision: false }, 'chip');
  B.add({ asset: 'B_1x1_Gate_Internal_ReadBrickGrid', size: [5, 5, 2], position: [-40, 0, 6], visibility: false, collision: false }, 'grid gate');
  const segs = [];
  for (let k = 0; k < N; k++) {
    const x0 = -30 + k * SEG;
    segs.push({ paper: ring(x0, x0 + SEG - 2, PAPER, `paper ${k}`), ember: ring(x0 + SEG - 2, x0 + SEG, PAPER, `ember ${k}`) });
  }
  return { bricks: B.bricks, filter, segs };
}

if (process.argv[1]?.endsWith('cigarette.mjs')) {
  const [X, Y, Z] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'cigarette.brz', jobOut = process.argv[6];
  const TEST = !!process.env.CIG_TEST;
  const { bricks, filter, segs } = shell();
  if (jobOut) fs.writeFileSync(jobOut, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000,
    bricks: bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] })) }] }));

  const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const k = await mk(ROOT + 'tools/brs4/dist.mjs', { owner: OWNER });
  const { w, C, wire, num, str } = k, O = k.ownerIdx;
  // the cigarette's own loose grid: frozen in place, gravity data set (the writer's default is antigravity)
  const G = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: true, owner_index: O,
    data: { BouyancyScale: 0.2, MassScale: 0.1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: 'cigarette' } });
  const put = (b, comps = []) => w.addBrick({ owner_index: O, direction: 4, rotation: 0, ...b, components: comps }, G);
  const strip = ({ label, ...b }) => b;
  const H = new Map(); // builder brick -> handle
  for (const b of bricks) {
    if (b.label === 'chip' || b.label === 'grid gate') continue;
    const segOf = segs.findIndex(s => s.paper.includes(b) || s.ember.includes(b));
    const isEmberMid = segs.some(s => s.ember[0] === b), isEmberTop = segs.some(s => s.ember[1] === b);
    const comps = [];
    if (segOf >= 0) comps.push(changer(b.color));
    if (isEmberMid) comps.push({ type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: false, Brightness: 2, Radius: 60, Color: { R: 255, G: 110, B: 30, A: 255 },
      bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });
    if (isEmberTop) comps.push({ type: C.TextDisplay.NAME, data: TEXT }); // smoke on the top face, billboarded
    if (CLICK.includes(filter.indexOf(b))) comps.push({ type: 'Component_Button', data: { PressSound: null, ReleaseSound: null, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Take a drag' } });
    H.set(b, put(strip(b), comps));
  }
  const cb = bricks.find(b => b.label === 'chip'), gb = bricks.find(b => b.label === 'grid gate');
  const chipBrick = put({ asset: 'B_1x1_Microchip', position: cb.position, visibility: false, collision: false }, [{ type: 'Component_Internal_Microchip' }]);
  const gridGate = { h: put({ asset: C.ReadBrickGrid.BRICK, position: gb.position, visibility: false, collision: false }, [{ type: C.ReadBrickGrid.NAME, data: {} }]), c: C.ReadBrickGrid };
  const CG = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 220, Y: -160, Z: 0 }, PlaneExtent: { X: 260, Y: 200, Z: 2 } } });
  w.registerMicrochipLink(chipBrick, CG);
  const g = (c, data = {}) => k.gate(c, data, CG);
  const raw = (b, c) => ({ h: H.get(b), c });

  // pins in: button held, own grid
  const pin = (src, port, label, order) => { const p = g(C.MicrochipInput, { PortLabel: label, PortOrder: order }); wire(src, port, p, 'RER_Input'); return [p, 'RER_Output']; };
  const grid = pin(gridGate, 'BrickGrid', 'grid', 0);
  const helds = CLICK.map((fi, i) => pin(raw(filter[fi], C.Button), 'bHeld', `held${i}`, 1 + i));
  const outPin = (src, label, order, targets) => { const p = g(C.MicrochipOutput, { PortLabel: label, PortOrder: order }); wire(...src, p, 'RER_Input'); for (const [t, port] of targets) wire(p, 'RER_Output', t, port); };

  const consts = new Map();
  const K = v => { const key = typeof v + ':' + v; if (!consts.has(key)) consts.set(key, [g(C.Var, { Value: typeof v === 'string' ? str(v) : num(v) }), 'Value']); return consts.get(key); };
  const P = v => (Array.isArray(v) ? v : K(v));
  const ex = (c, ins) => { const x = g(c); for (const [port, src] of Object.entries(ins)) wire(...P(src), x, port); return [x, c.PORTS.bOutput ? 'bOutput' : 'Output']; };
  const gt = (a, b) => ex(C.Expr_CompareGreater, { InputA: a, InputB: b });
  const and = (a, b) => ex(C.Expr_LogicalAND, { bInputA: a, bInputB: b });
  const not = a => ex(C.Expr_LogicalNOT, { bInput: a });
  const sel = (a, b, cond) => ex(C.Expr_Select, { InputA: a, InputB: b, bSelectB: cond }); // cond ? b : a
  // colour channels wired from constants (wordle: R/G/B written into the gate's data came out wrong in game)
  const color = c => { const x = g(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 }); ['R', 'G', 'B'].forEach((ch, i) => wire(...K(c[i]), x, ch)); wire(...K(255), x, 'A'); return [x, 'Output']; };

  // state: p = drags taken (0..N), busy = a drag in progress (reactive Value outputs drive the look)
  const pVar = g(C.Var, { Value: num(0) }), busyVar = g(C.Var, { Value: num(0) });
  const p = [pVar, 'Value'], smoking = gt([busyVar, 'Value'], 0.5);
  const cPaper = color(PAPER), cEmber = color(EMBER), bright = sel(3, 12, smoking), smokeTxt = K(SMOKE_TXT), noTxt = K('');
  const vis = [];
  for (let s = 0; s < N; s++) vis.push(gt(N - s - 0.5, p)); // segment s stands while p < N - s
  segs.forEach((seg, s) => {
    const tip = s === N - 1 ? vis[s] : and(vis[s], not(vis[s + 1]));
    const all = [...seg.paper, ...seg.ember].map(b => H.get(b)).map(h => ({ h, c: C.BrickPropertyChanger }));
    outPin(vis[s], `vis${s}`, 2 + s * 4, all.flatMap(t => [[t, 'bVisibility'], [t, 'bCollisionEnabled']]));
    outPin(sel(cPaper, cEmber, tip), `ember${s}`, 3 + s * 4, seg.ember.map(b => [{ h: H.get(b), c: C.BrickPropertyChanger }, 'Color']));
    const mid = H.get(seg.ember[0]);
    outPin(tip, `light${s}`, 4 + s * 4, [[{ h: mid, c: C.PointLight }, 'bEnabled']]);
    outPin(sel(noTxt, smokeTxt, and(tip, smoking)), `smoke${s}`, 5 + s * 4, [[{ h: H.get(seg.ember[1]), c: C.TextDisplay }, 'Text']]);
  });
  outPin(bright, 'bright', 99, segs.map(seg => [{ h: H.get(seg.ember[0]), c: C.PointLight }, 'Brightness']));

  // exec: click (rising edge) -> not busy -> busy = 1, stopwatch restart, log line
  const chain = (...gs) => { for (let i = 1; i < gs.length; i++) wire(gs[i - 1][0], gs[i - 1][1], gs[i], 'Exec'); };
  const setV = (v, val) => { const s = g(C.Exec_Var_Set); wire(v, 'VarRef', s, 'VarRef'); wire(...P(val), s, 'Value'); return s; };
  const print = (fmt, A) => { const f = g(C.Expr_String_FormatText, { FormatString: fmt }); if (A) wire(...A, f, 'InputA'); const pr = g(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); return pr; };
  const held = helds.reduce((a, b) => ex(C.Expr_LogicalOR, { bInputA: a, bInputB: b }));
  const edge = g(C.Expr_EdgeDetectorExec); wire(...held, edge, 'Input');
  const br = g(C.Exec_Branch); wire(...smoking, br, 'bCond');
  // an exec input takes one wire: the test clock replaces the click
  if (TEST) { const clk = g(C.Clock, { IntervalSeconds: 3, bEnabled: true }); wire(clk, 'Pulse', br, 'Exec'); } else wire(edge, 'OnRisingEdge', br, 'Exec');
  const watch = g(C.Stopwatch, { Limit: PUFF_S, Time: 0, bRunning: false });
  const busy1 = setV(busyVar, 1), log1 = print('cigarette|drag|{A}', p);
  wire(br, 'ExecOutB', busy1, 'Exec'); chain([busy1, 'ExecOut'], log1); wire(log1, 'ExecOut', watch, 'Restart');
  // puff over (rising edge of Expired) -> p += 1, busy = 0 -> fresh read of p -> all burnt -> log + destroy the prefab
  const done = g(C.Expr_EdgeDetectorExec); wire(watch, 'Expired', done, 'Input');
  const get1 = g(C.Exec_Var_Get); wire(pVar, 'VarRef', get1, 'VarRef'); wire(done, 'OnRisingEdge', get1, 'Exec');
  const inc = setV(pVar, ex(C.Expr_MathAdd, { InputA: [get1, 'Value'], InputB: 1 })); wire(get1, 'ExecOut', inc, 'Exec');
  const busy0 = setV(busyVar, 0); wire(inc, 'ExecOut', busy0, 'Exec');
  const get2 = g(C.Exec_Var_Get); wire(pVar, 'VarRef', get2, 'VarRef'); wire(busy0, 'ExecOut', get2, 'Exec');
  const br2 = g(C.Exec_Branch); wire(...gt([get2, 'Value'], N - 0.5), br2, 'bCond'); wire(get2, 'ExecOut', br2, 'Exec');
  const log2 = print('cigarette|burnt out'); wire(br2, 'ExecOutA', log2, 'Exec');
  const kill = g(C.Exec_Entity_DestroySpawnedPrefab); wire(log2, 'ExecOut', kill, 'Exec'); wire(...grid, kill, 'Entity');

  w.makePrefab({ isPhysicsGrid: true });
  const cig = w.toBrz({ bundle: { description: 'cigarette: click the filter to smoke it' }, externalAssets: [FONT] });

  // ---- the pack: DestroySpawnedPrefab only removes a SPAWNED prefab (tested 2026-11-02: a Prefab.Load'ed cigarette
  // logged 'burnt out' and kept running, renderman-owned too), so what gets loaded is one hidden world-grid chip
  // that spawns the cigarette (embedded) once, 2 s after load. Nothing else: no outer bricks, no wires outside the chip.
  const pk = await mk(ROOT + 'tools/brs4/dist.mjs', { owner: PACK_OWNER });
  const pw = pk.w, pc = pk.C;
  const packChip = pw.addBrick({ asset: 'B_1x1_Microchip', position: [0, 0, 2], owner_index: pk.ownerIdx, visibility: false, collision: false,
    components: [{ type: 'Component_Internal_Microchip' }] });
  const PG = pw.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 40, Y: 0, Z: 0 }, PlaneExtent: { X: 80, Y: 40, Z: 2 } } });
  pw.registerMicrochipLink(packChip, PG);
  const sw = pk.gate(pc.Stopwatch, { Limit: 2, Time: 0, bRunning: true }, PG), once = pk.gate(pc.Expr_EdgeDetectorExec, {}, PG);
  const spawn = pk.gate(pc.Exec_PrefabSpawner, { Prefab: pw.addPrefab(cig), SpawnOffset: { X: 0, Y: 0, Z: -2 }, Lifetime: 0, Limit: 1 }, PG);
  pk.wire(sw, 'Expired', once, 'Input'); pk.wire(once, 'OnRisingEdge', spawn, 'Exec');
  // Lifetime 0 = forever (the gate default 5 s removed the first test spawns); freeze the spawned grid where it spawned
  const freeze = pk.gate(pc.Exec_Entity_SetFrozen, { bFrozen: true }, PG);
  pk.wire(spawn, 'ExecOut', freeze, 'Exec'); pk.wire(spawn, 'Entity', freeze, 'Entity');
  pw.makePrefab({});
  fs.writeFileSync(out, pw.toBrz({ bundle: { description: 'cigarette pack: spawns one smokable cigarette' } }));
  console.error(`cigarette: ${bricks.length} shell bricks${TEST ? ' (TEST clock)' : ''} -> ${out}`);
}
