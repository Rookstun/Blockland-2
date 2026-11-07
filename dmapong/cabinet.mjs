// dmapong/cabinet.mjs: the Night Pong cabinet for the DMA engine (owner 2026-11-06: own engine, Super Sigmas tools
// untouched). Same cabinet as supersigmas/cabinet.mjs (copied, not shared: base, head, hood + marquee, seat, screen of
// text strips, HUD/msg/title, speaker), but SIX hidden chips on the hood, all in one World (dmapong/wsbundle_multi.mjs):
// CPU (seat inputs, clock, HUD, sound, the bus), 4 DMA channels (bus in, two strips each out, ready out), 1 swap chip
// (ready x4 in, go out to every channel). Every connection is a wire between port gates. Load: br.Prefab.Load "<name>" x y z 0 16.
import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundle } from './wsbundle_multi.mjs';
import * as pong from './gen.mjs';
// game = another DMA game module with the same exports (rotorraid/gen.mjs): cpuSrc channelSrc swapSrc cabinetGen NCH BUS
const PONG_BUS = ['frame', 'nb', 'px', 'over', 'won', 'vis', ...Array.from({ length: pong.NB }, (_, i) => [`bx${i}`, `by${i}`]).flat()];

export async function buildDmaCabinet({ dir, name, title, owner: OWNER, cell = 0.25, game = pong }) {
  const { cpuSrc, channelSrc, swapSrc, cabinetGen, NCH } = game;
  const gen = cabinetGen();
  const sdk = join(dir, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  const build = (src, n) => {
    fs.writeFileSync(join(dir, `${name}_${n}.gen.ws`), src);
    const ds = JSON.parse(diag(src, n, '{}') || '[]').filter(d => /error/i.test(d.severity));
    if (ds.length) { for (const d of ds) console.error(`${n} ${d.code} line ${d.startLine}: ${d.message}`); throw Error(`wirescript errors in ${n}`); }
    return new Uint8Array(compile(src, n, '{}', '{}'));
  };
  const cpuBytes = build(cpuSrc(), 'cpu'), chBytes = Array.from({ length: NCH }, (_, k) => build(channelSrc(k), `ch${k}`)), swapBytes = build(swapSrc(), 'swap');

  const TK = Math.max(1, gen.H * cell / 40);
  const Z1 = Math.max(48, 26 + 4 * TK + gen.H * cell), UP = Z1 - 48;
  // the six chips in a 3 x 2 block over the hood and head, inside the cabinet's own width (a 150-wide row of them
  // overlapped the next cabinet and two chips were rejected, 2026-11-06)
  const at = i => [-24 + (i % 3) * 24, 12 + Math.floor(i / 3) * 24, 60 + UP]; // 7 chips: 3 x 3 (last row partly empty)
  const cpu = await bundle(cpuBytes, { owner: OWNER, offset: at(0), hide: true, bare: true });
  const chs = [];
  for (let k = 0; k < NCH; k++) chs.push(await bundle(chBytes[k], { into: cpu, offset: at(k + 1), hide: true, bare: true }));
  const swap = await bundle(swapBytes, { into: cpu, offset: at(NCH + 1), hide: true, bare: true });
  const { w, C, O } = cpu;
  const OUTC = 'BrickComponentType_Internal_MicrochipOutput', INC = 'BrickComponentType_Internal_MicrochipInput';
  const link = (from, out, to, inp) => w.addWire({ brick: from.portOut(out), component_type: OUTC, port: 'RER_Output' }, { brick: to.portIn(inp), component_type: INC, port: 'RER_Input' });
  // ---- the DMA bus: CPU -> every channel, one wire per value; channels -> swap -> channels
  const bus = game.BUS ?? PONG_BUS;
  for (const ch of chs) for (const v of bus) link(cpu, `${v}_`, ch, v);
  chs.forEach((ch, k) => { link(ch, 'ready_', swap, `r${k}`); link(swap, 'go_', ch, 'go'); });

  // ---- speaker (one Square voice, P0/V0 from the CPU) on the CPU plane
  const SYN = ['BA_Synth_Basic_Square'];
  const maxX = Math.max(...cpu.rootPos.map(p => p[0])), y0 = Math.min(...cpu.rootPos.map(p => p[1])), zP = cpu.rootPos[0][2];
  const spk = cpu.addInside({ asset: 'B_1x1F_Speaker', color: [30, 30, 30], position: [maxX + 20, y0, zP],
    components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: cpu.ext.length, VolumeMultiplier: 0, PitchMultiplier: 1,
      InnerRadius: 200, MaxDistance: 1200, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
  for (const [port, target] of [['P0', 'PitchMultiplier'], ['V0', 'VolumeMultiplier']]) w.addWire(cpu.outSource(port), { brick: spk, component_type: 'Component_AudioEmitter', port: target });
  const assets = [...cpu.ext, ...SYN.map(n => ({ type: 'BrickAudioDescriptor', name: n }))];
  const font = n => { let i = assets.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === n); if (i < 0) { assets.push({ type: 'BrickFontDescriptor', name: n }); i = assets.length - 1; } return i; };

  // ---- the cabinet body (same geometry as supersigmas/cabinet.mjs)
  const MB = 'PB_DefaultMicroBrick', GREY = [96, 94, 92];
  const box = (x0, yy0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, color: GREY, ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - yy0) / 2, Math.abs(z1 - z0) / 2],
    position: [(x0 + x1) / 2, (yy0 + y1) / 2, (z0 + z1) / 2], owner_index: O });
  const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
  const TEXT = {
    Font: font('MonaspaceKrypton'), Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0.2 },
    Color: rgba([255, 255, 255]), MaterialSlider: 10, ShadingWidth: 0, OutlineColor: rgba([0, 0, 0]), OutlineWidth: 0,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
  };
  const text = data => [{ type: C.TextDisplay.NAME, data: { ...TEXT, ...data } }];
  const wireText = (chip, port, brick, target = 'Text') => w.addWire({ brick: chip.portOut(port), component_type: OUTC, port: 'RER_Output' }, { brick, component_type: C.TextDisplay.NAME, port: target });
  const PW = Math.ceil(gen.W * cell / 2 + 1), BW = PW + 2;
  box(-BW, 2, 24, BW, 22, 50 + UP);
  box(-BW, -8, 50 + UP, BW, 22, 58 + UP, { components: text({ Font: font('Bungee'), LineHeight: 2, Text: title, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 2, OutlineColor: rgba([120, 20, 60]) }) });
  box(-BW, -8, 0, BW, 22, 24);
  w.addBrick({ asset: 'PB_DefaultBrick', color: GREY, size: [5, 5, 6], position: [0, -22, 6], owner_index: O });
  const seat = w.addBrick({ asset: 'B_Seat', position: [0, -23, 23], direction: 4, rotation: 0, color: [255, 255, 255], owner_index: O,
    components: [{ type: C.Seat.NAME, data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: `Play ${title}` } }] });
  // ---- screen: 8 strips, strip s from channel floor(s / 2), A or B
  const SH = gen.STRIP * cell, NS = gen.H / gen.STRIP;
  for (let s = 0; s < NS; s++) {
    const st = box(-PW, 0, Z1 - (s + 1) * SH, PW, 2, Z1 - s * SH, { color: [0, 0, 0], components: text({ LineHeight: +(cell * 0.645).toFixed(4), WidthScale: 2, Color: rgba([255, 255, 255]) }) });
    wireText(chs[s], 'stripA_', st); // one strip per channel
  }
  const z0 = Z1 - gen.H * cell;
  const hud = box(-PW, 0, z0 - 2 * TK, PW, 2, z0, { color: [0, 0, 0], components: text({ LineHeight: 0.8 * TK, Color: rgba([248, 208, 64]) }) });
  wireText(cpu, 'hud_', hud);
  const msg = box(-PW, 0, Math.min(26, z0 - 4 * TK), PW, 2, z0 - 2 * TK, { color: [0, 0, 0], components: text({ LineHeight: 0.8 * TK, Color: rgba([240, 240, 240]) }) });
  wireText(cpu, 'msg_', msg);
  const titleB = w.addBrick({ asset: MB, color: [0, 0, 0], size: [1, 1, 1], position: [0, -3, Math.round(Z1 - gen.H * cell / 2)], visibility: false, collision: false, owner_index: O,
    components: text({ Font: font('Bungee'), LineHeight: gen.titleLH ?? 2, Offset: { X: 0, Y: 0, Z: 0 }, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 3, OutlineColor: rgba([120, 20, 60]) }) });
  wireText(cpu, 'title_', titleB);
  // ---- seat -> CPU (same adapter as supersigmas/cabinet.mjs), 20 Hz clock gated by the seat -> CPU tick
  const X0 = maxX + 60, Y0 = y0, ZP = zP;
  let gi = 0;
  const gate = (c, data = {}) => ({ h: cpu.addInside({ asset: c.BRICK, position: [X0 + (gi % 8) * 10, Y0 + Math.floor(gi++ / 8) * 10, ZP], color: [200, 200, 200], components: [{ type: c.NAME, data }] }), c });
  const port = (g, p) => ({ brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] });
  const num = v => ({ $variant: 'f64', value: v });
  const wireTo = (src, p) => w.addWire(src, { brick: cpu.portIn(p), component_type: INC, port: 'RER_Input' });
  wireTo({ brick: seat, component_type: C.Seat.NAME, port: 'bIsOccupied' }, 'seated');
  const pilot = gate(C.MicrochipInput, { PortLabel: 'pilot', PortOrder: 99 });
  w.addWire({ brick: seat, component_type: C.Seat.NAME, port: 'SittingCharacter' }, port(pilot, 'RER_Input'));
  const split = gate(C.InputSplitter);
  w.addWire(port(pilot, 'RER_Output'), port(split, 'Character'));
  const k = v => gate(C.Var, { Value: num(v) });
  const cmp = (kind, a, v) => { const g = gate(C[kind]); w.addWire(a, port(g, 'InputA')); w.addWire(port(k(v), 'Value'), port(g, 'InputB')); return port(g, 'bOutput'); };
  const add = (a, bb) => { const g = gate(C.Expr_MathAdd); w.addWire(a, port(g, 'InputA')); w.addWire(bb, port(g, 'InputB')); return port(g, 'Output'); };
  wireTo(cmp('Expr_CompareLess', port(split, 'InputRight'), -0.5), 'left');
  wireTo(cmp('Expr_CompareGreater', port(split, 'InputRight'), 0.5), 'right');
  wireTo(cmp('Expr_CompareGreater', port(split, 'InputForward'), 0.5), 'up');
  wireTo(cmp('Expr_CompareLess', port(split, 'InputForward'), -0.5), 'down');
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'InputUp'), port(split, 'bPressedRightMouse')), 0.5), 'ba');
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'bPressedLeftMouse'), port(split, 'bPressedE')), 0.5), 'bb');
  wireTo(cmp('Expr_CompareGreater', port(split, 'bPressedQ'), 0.5), 'bq'); // Q = add a ball (Rookstun, hidden)
  const clock = gate(C.Clock, { IntervalSeconds: 0.05, bEnabled: true });
  w.addWire({ brick: seat, component_type: C.Seat.NAME, port: 'bIsOccupied' }, port(clock, 'bEnabled'));
  wireTo(port(clock, 'Pulse'), 'tick');
  fs.writeFileSync(join(dir, `${name}.brz`), cpu.finish({ extraAssets: assets.slice(cpu.ext.length), description: `${title} DMA cabinet` }));
  console.log(`wrote ${name}.brz (${NCH + 2} chips: cpu, ${NCH} channels, swap; ${bus.length} bus wires per channel)`);
}
