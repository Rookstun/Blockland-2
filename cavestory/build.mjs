// node cavestory/build.mjs  -> cavestory/cavestory_chip.brz (the game chip alone: wire it up yourself)
//                              cavestory/cavestory.brz      (arcade cabinet: seat, clock, O-grid screen, msg line)
// The chip and the seat-adapter gates sit hidden BEHIND the cabinet (y 90+): hidden bricks still get rejected for overlaps.
// Both carry the synth speakers ON the chip's own plane, wired from its P/V outs, so the chip makes its own sound.
// Load: br.Prefab.Load "cavestory" x y z 0 16. Owner "Cave Story" (own wire budget).
// Seat controls: A/D walk, W aim up, S aim down (in the air), Space or right mouse jump, left mouse or E shoot.
// Needs tools/patch_brs4.mjs applied to tools/brs4/dist.mjs (component types newer than brs4).
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate } from './gen.mjs';
import { bundle } from '../tools/wsbundle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OWNER = { id: 'c5700000-0000-4b0b-9a11-00000000c570', name: 'Cave Story', display_name: 'Cave Story' };
const DEBUG = process.env.CS_DEBUG === '1';

const gen = generate({ debug: DEBUG });
const src = gen.src;
fs.writeFileSync(join(here, 'cavestory.gen.ws'), src);

const sdk = join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
const ds = JSON.parse(diag(src, 'cavestory', '{}') || '[]');
for (const d of ds) console.error(`${d.severity} ${d.code} line ${d.startLine}: ${d.message}`);
const compiled = new Uint8Array(compile(src, 'cavestory', '{}', '{}'));
console.log(`chip compiled, ${compiled.length} bytes`);

const SYN = [...new Set(gen.synths)].map(s => `BA_Synth_Basic_${s}`);
function speakers(b, { inner = 300, range = 1600 } = {}) {
  const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  gen.synths.forEach((s, v) => {
    const sp = b.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + v * 10, y0, z], color: [30, 30, 30],
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(`BA_Synth_Basic_${s}`), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: inner, MaxDistance: range, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
    for (const [port, target] of [[`P${v}`, 'PitchMultiplier'], [`V${v}`, 'VolumeMultiplier']])
      b.w.addWire(b.outSource(port), { brick: sp, component_type: 'Component_AudioEmitter', port: target });
  });
  return SYN.map(name => ({ type: 'BrickAudioDescriptor', name }));
}

// ---- 1. the chip on its own
{
  const b = await bundle(compiled, { owner: OWNER });
  const extra = speakers(b);
  fs.writeFileSync(join(here, 'cavestory_chip.brz'), b.finish({ extraAssets: extra, description: 'CAVE STORY chip' }));
}

// ---- 2. the cabinet. Prefab local: ground z 0, the screen faces -y, the player sits at -y.
{
  const b = await bundle(compiled, { owner: OWNER, offset: [0, 110, 30], hide: true });
  const { w, C, O } = b;
  const extra = speakers(b);
  const assets = [...b.ext, ...extra];
  const font = name => { let i = assets.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === name); if (i < 0) { assets.push({ type: 'BrickFontDescriptor', name }); i = assets.length - 1; } return i; };
  const MB = 'PB_DefaultMicroBrick';
  const box = (x0, y0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, color: [20, 16, 28], ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: O });
  const GLOW = (c, i = 3) => ({ color: c, material: 'BMC_Glow', material_intensity: i });
  const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
  const hex = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  // TextDisplay on the -y face of a brick (ogrid layout: Face 3, text lifted 1 unit)
  const TEXT = {
    Font: font('MonaspaceKrypton'), Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 1 },
    Color: rgba([255, 255, 255]), MaterialSlider: 10, ShadingWidth: 0, OutlineColor: rgba([0, 0, 0]), OutlineWidth: 0,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
  };
  const textBrick = (x0, x1, z0, z1, data, color = hex(gen.PAL[0])) => w.addBrick({ asset: MB, color, size: [(x1 - x0) / 2, 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, -2, (z0 + z1) / 2],
    owner_index: O, components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, ...data } }] });
  const wireFrom = (port, brick, comp, target) => w.addWire({ brick: b.pin(port), component_type: 'Component_Internal_Rerouter', port: 'RER_Output' }, { brick, component_type: comp, port: target });
  const wireTo = (src, port) => w.addWire(src, { brick: b.pin(port), component_type: 'Component_Internal_Rerouter', port: 'RER_Input' });

  // screen: 64 x 36 cells of 2 units, 6 strips of 6 rows (row pitch 2 = 1.55 x LineHeight; square at WidthScale 2)
  const CELL = 2, PW = gen.W * CELL, PH = gen.H * CELL, Z1 = 186, Z0 = Z1 - PH, HX = PW / 2;
  const stripH = gen.STRIP * CELL;
  for (let k = 0; k < gen.H / gen.STRIP; k++) {
    const z1 = Z1 - k * stripH;
    const s = textBrick(-HX, HX, z1 - stripH, z1, { LineHeight: +(CELL * 0.645).toFixed(3), WidthScale: 2, Color: rgba(hex(gen.PAL[0])), Text: '' });
    wireFrom(`strip${k}`, s, C.TextDisplay.NAME, 'Text');
  }
  // message line + hud line under the picture
  const msg = textBrick(-HX, HX, Z0 - 12, Z0, { LineHeight: 3.2, Color: rgba([240, 240, 240]), Font: font('MonaspaceKrypton') });
  wireFrom('msg_', msg, C.TextDisplay.NAME, 'Text');
  const hud = textBrick(-HX, HX, Z0 - 20, Z0 - 12, { LineHeight: 2.6, Color: rgba([248, 208, 64]) });
  wireFrom('hud_', hud, C.TextDisplay.NAME, 'Text');
  // body, bezel, marquee
  const DARK = [20, 16, 28], RED = [180, 30, 40];
  box(-HX - 12, 0, 0, HX + 12, 70, Z0 - 20, { color: DARK });                // lower body (the chip sits inside)
  box(-HX - 12, 0, Z0 - 20, -HX, 70, Z1 + 24, { color: DARK });
  box(HX, 0, Z0 - 20, HX + 12, 70, Z1 + 24, { color: DARK });
  box(-HX, 0, Z1, HX, 70, Z1 + 24, { color: [10, 8, 16] });
  box(-HX, 0, Z0 - 20, HX, 70, Z1, { color: [10, 8, 16] }, 0);
  for (const s of [-1, 1]) box(s * (HX + 12), -4, 0, s * (HX + 14), 70, Z1 + 24, GLOW(RED, 2));
  box(-HX - 14, -4, Z1 + 24, HX + 14, 72, Z1 + 28, { color: DARK });
  const marquee = w.addBrick({ asset: MB, ...GLOW([40, 10, 16], 1), size: [HX, 2, 10], position: [0, -2, Z1 + 12], owner_index: O,
    components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, Font: font('PirataOne'), LineHeight: 13, Text: 'CAVE STORY', Color: rgba([255, 220, 120]), Outline: 2, OutlineWidth: 2, OutlineColor: rgba(RED) } }] });
  void marquee;
  box(-HX - 12, -30, 0, HX + 12, 0, 50, { color: DARK });                    // control desk
  box(-HX - 12, -32, 50, HX + 12, 0, 54, GLOW(RED, 2));
  w.addBrick({ asset: 'PB_DefaultPole', color: [220, 30, 40], size: [5, 5, 6], position: [-30, -16, 60], owner_index: O });
  for (const [x, c] of [[24, [240, 200, 60]], [40, [60, 160, 240]]]) w.addBrick({ asset: 'PB_DefaultPole', color: c, size: [5, 5, 2], position: [x, -16, 56], owner_index: O });

  // stool + seat -> input splitter -> bools for the chip's pins
  w.addBrick({ asset: 'PB_DefaultPole', color: [150, 150, 160], material: 'BMC_Metallic', size: [5, 5, 6], position: [0, -80, 6], owner_index: O });
  const seat = w.addBrick({ asset: 'B_Seat', position: [0, -80, 27], direction: 4, rotation: 0, color: [20, 20, 24], owner_index: O,
    components: [{ type: C.Seat.NAME, data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: 'Play CAVE STORY' } }] });
  let gi = 0;
  const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [-50 + (gi % 10) * 10, 140, 10 + Math.floor(gi++ / 10) * 10], color: [200, 200, 200], owner_index: O,
    visibility: false, collision: false, components: [{ type: c.NAME, data }] }), c });
  const port = (g, p) => { if (!g.c.PORTS[p]) throw Error(`bad port ${g.c.NAME}.${p}`); return { brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] }; };
  const num = v => ({ $variant: 'f64', value: v });
  const split = gate(C.InputSplitter);
  w.addWire({ brick: seat, component_type: C.Seat.NAME, port: 'SittingCharacter' }, port(split, 'Character'));
  const k = v => gate(C.Var, { Value: num(v) });
  const cmp = (kind, a, v) => { const g = gate(C[kind]); w.addWire(a, port(g, 'InputA')); w.addWire(port(k(v), 'Value'), port(g, 'InputB')); return port(g, 'bOutput'); };
  const add = (a, bb) => { const g = gate(C.Expr_MathAdd); w.addWire(a, port(g, 'InputA')); w.addWire(bb, port(g, 'InputB')); return port(g, 'Output'); };
  wireTo(cmp('Expr_CompareLess', port(split, 'InputRight'), -0.5), 'left');
  wireTo(cmp('Expr_CompareGreater', port(split, 'InputRight'), 0.5), 'right');
  wireTo(cmp('Expr_CompareGreater', port(split, 'InputForward'), 0.5), 'up');
  wireTo(cmp('Expr_CompareLess', port(split, 'InputForward'), -0.5), 'down');
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'InputUp'), port(split, 'bPressedRightMouse')), 0.5), 'jump');
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'bPressedLeftMouse'), port(split, 'bPressedE')), 0.5), 'shoot');
  // the game clock: 20 Hz
  const clock = gate(C.Clock, { IntervalSeconds: 0.05, bEnabled: true });
  wireTo(port(clock, 'Pulse'), 'tick');

  fs.writeFileSync(join(here, 'cavestory.brz'), b.finish({ extraAssets: assets.slice(b.ext.length), description: 'CAVE STORY cabinet' }));
}
console.log('wrote cavestory_chip.brz, cavestory.brz');
