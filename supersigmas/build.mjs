// node supersigmas/build.mjs [SS_DEBUG=1] -> supersigmas/supersigmas.brz (the owner's small cabinet,
// Clipboard_2026-10-21_21-03-53.brz, rebuilt around the chip) + supersigmas/supersigmas_chip.brz (chip alone).
// Owner's clipboard (player at +x looking -x, ground z 624) -> here: screen faces -y, player at -y, ground z 0.
// Screen = the owner's white panel (26 x 22): 9 stacked text strips of coloured blocks (48 x 36 cells of 0.5 units)
// + a HUD line and a message line under them. Title text on a hidden brick in the recess, marquee on the hood.
// The seat's bIsOccupied -> chip 'seated': nobody in the chair = screen blank, music off, no game work.
// Load: br.Prefab.Load "supersigmas" x y z 0 16. Owner "Super Sigmas" (own wire budget).
// Seat controls: WASD move, left mouse / E mog, Space / right mouse rizz (and start).
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate } from './gen.mjs';
import { bundle } from '../tools/wsbundle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OWNER = { id: '5191a500-0000-4b0b-9a11-0000005191a5', name: 'Super Sigmas', display_name: 'Super Sigmas' };
const gen = generate({ debug: process.env.SS_DEBUG === '1' });
fs.writeFileSync(join(here, 'supersigmas.gen.ws'), gen.src);

const sdk = join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
const ds = JSON.parse(diag(gen.src, 'supersigmas', '{}') || '[]');
for (const d of ds) console.error(`${d.severity} ${d.code} line ${d.startLine}: ${d.message}`);
if (ds.some(d => /error/i.test(d.severity))) process.exit(1);
const compiled = new Uint8Array(compile(gen.src, 'supersigmas', '{}', '{}'));
console.log(`chip compiled, ${compiled.length} bytes`);

const SYN = [...new Set(gen.synths)].map(s => `BA_Synth_Basic_${s}`);
function speakers(b) {
  const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  gen.synths.forEach((s, v) => {
    const sp = b.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + v * 10, y0, z], color: [30, 30, 30],
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(`BA_Synth_Basic_${s}`), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: 200, MaxDistance: 1200, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
    for (const [port, target] of [[`P${v}`, 'PitchMultiplier'], [`V${v}`, 'VolumeMultiplier']])
      b.w.addWire(b.outSource(port), { brick: sp, component_type: 'Component_AudioEmitter', port: target });
  });
  return SYN.map(name => ({ type: 'BrickAudioDescriptor', name }));
}

{
  const b = await bundle(compiled, { owner: OWNER });
  fs.writeFileSync(join(here, 'supersigmas_chip.brz'), b.finish({ extraAssets: speakers(b), description: 'SUPER SIGMAS chip' }));
}

{
  // one hidden chip lying on the hood (top z 58), no outer pins: the seat wires into its port gates, its port gates
  // wire straight into the screen, and the seat adapter (splitter, compares, clock) sits on the chip's own plane
  const b = await bundle(compiled, { owner: OWNER, offset: [0, 12, 60], hide: true, bare: true });
  const { w, C, O } = b;
  const assets = [...b.ext, ...speakers(b)];
  const font = name => { let i = assets.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === name); if (i < 0) { assets.push({ type: 'BrickFontDescriptor', name }); i = assets.length - 1; } return i; };
  const MB = 'PB_DefaultMicroBrick', GREY = [96, 94, 92];
  const box = (x0, y0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, color: GREY, ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: O });
  const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
  const hex = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const TEXT = {
    Font: font('MonaspaceKrypton'), Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0.2 },
    Color: rgba([255, 255, 255]), MaterialSlider: 10, ShadingWidth: 0, OutlineColor: rgba([0, 0, 0]), OutlineWidth: 0,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
  };
  const text = data => [{ type: C.TextDisplay.NAME, data: { ...TEXT, ...data } }];
  const OUTC = 'BrickComponentType_Internal_MicrochipOutput', INC = 'BrickComponentType_Internal_MicrochipInput';
  const wireFrom = (port, brick, target) => w.addWire({ brick: b.portOut(port), component_type: OUTC, port: 'RER_Output' }, { brick, component_type: C.TextDisplay.NAME, port: target });
  const wireTo = (src, port) => w.addWire(src, { brick: b.portIn(port), component_type: INC, port: 'RER_Input' });

  // ---- the owner's cabinet (clipboard bricks, rotated into this frame)
  box(-15, 2, 24, 15, 22, 50);     // head behind the screen
  box(-15, -8, 50, 15, 22, 58, { components: text({ Font: font('Bungee'), LineHeight: 3, Text: 'SUPER SIGMAS', Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 2, OutlineColor: rgba([120, 20, 60]) }) }); // hood + marquee
  box(-15, -8, 0, 15, 22, 24);     // base / desk
  w.addBrick({ asset: 'PB_DefaultBrick', color: GREY, size: [5, 5, 6], position: [0, -22, 6], owner_index: O }); // stool
  const seat = w.addBrick({ asset: 'B_Seat', position: [0, -23, 23], direction: 4, rotation: 0, color: [255, 255, 255], owner_index: O,
    components: [{ type: C.Seat.NAME, data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: 'Play SUPER SIGMAS' } }] });

  // ---- screen = the owner's white panel x -13..13, y 0..2, z 26..48
  const CELL = 0.5, base = hex(gen.PAL[0]);
  const Z1 = 48, SH = gen.STRIP * CELL;
  for (let k = 0; k < gen.H / gen.STRIP; k++) {
    const s = box(-13, 0, Z1 - (k + 1) * SH, 13, 2, Z1 - k * SH, { color: base,
      components: text({ LineHeight: +(CELL * 0.645).toFixed(4), WidthScale: 2, Color: rgba(base) }) });
    wireFrom(`strip${k}`, s, 'Text');
  }
  const z0 = Z1 - gen.H * CELL; // 30
  const hud = box(-13, 0, z0 - 2, 13, 2, z0, { color: base, components: text({ LineHeight: 1.2, Color: rgba([248, 208, 64]) }) });
  wireFrom('hud_', hud, 'Text');
  const msg = box(-13, 0, 26, 13, 2, z0 - 2, { color: base, components: text({ LineHeight: 1.2, Color: rgba([240, 240, 240]) }) });
  wireFrom('msg_', msg, 'Text');
  const title = w.addBrick({ asset: MB, color: [0, 0, 0], size: [1, 1, 1], position: [0, -3, 42], visibility: false, collision: false, owner_index: O,
    components: text({ Font: font('Bungee'), LineHeight: 3.2, Offset: { X: 0, Y: 0, Z: 0 }, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 3, OutlineColor: rgba([120, 20, 60]) }) });
  wireFrom('title_', title, 'Text');

  // ---- seat -> chip: occupancy straight into 'seated', the sitter into a raw MicrochipInput -> splitter -> compares
  // -> the chip's own input port gates; 20 Hz clock -> 'tick'. All on the chip plane, past its gates and speakers.
  const X0 = Math.max(...b.rootPos.map(p => p[0])) + 60, Y0 = Math.min(...b.rootPos.map(p => p[1])), ZP = b.rootPos[0][2];
  let gi = 0;
  const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, position: [X0 + (gi % 8) * 10, Y0 + Math.floor(gi++ / 8) * 10, ZP], color: [200, 200, 200],
    components: [{ type: c.NAME, data }] }), c });
  const port = (g, p) => { if (!g.c.PORTS[p]) throw Error(`bad port ${g.c.NAME}.${p}`); return { brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] }; };
  const num = v => ({ $variant: 'f64', value: v });
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
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'InputUp'), port(split, 'bPressedRightMouse')), 0.5), 'rizz');
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'bPressedLeftMouse'), port(split, 'bPressedE')), 0.5), 'mog');
  const clock = gate(C.Clock, { IntervalSeconds: 0.05, bEnabled: true });
  wireTo(port(clock, 'Pulse'), 'tick');

  fs.writeFileSync(join(here, 'supersigmas.brz'), b.finish({ extraAssets: assets.slice(b.ext.length), description: 'SUPER SIGMAS cabinet' }));
}
console.log('wrote supersigmas_chip.brz, supersigmas.brz');
