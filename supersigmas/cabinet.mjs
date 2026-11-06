// supersigmas/cabinet.mjs: the owner's small arcade cabinet (Clipboard_2026-10-21_21-03-53.brz) built round a wirescript
// game chip made by a gen.mjs in the Super Sigmas pattern (W x H block picture in text strips, msg_/hud_/title_,
// P0..2/V0..2 synth voices, inputs tick seated left right up down + two buttons).
// Owner's clipboard (player at +x looking -x, ground z 624) -> here: screen faces -y, player at -y, ground z 0.
// Screen = the owner's white panel (26 x 22): text strips of coloured blocks + a HUD line and a message line under them.
// Title text on a hidden brick in the recess, marquee on the hood. The seat's bIsOccupied -> chip 'seated'.
// Everything logical is in ONE hidden microchip on the hood (wsbundle bare: no outer pins).
// Load: br.Prefab.Load "<name>" x y z 0 16.
import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundle } from '../tools/wsbundle.mjs';

// buildCabinet({ dir, name, title, owner, gen, pins: { a, b } }): writes <dir>/<name>.gen.ws, <name>_chip.brz, <name>.brz.
// pins.a = Space / right mouse, pins.b = left mouse / E (the chip's bool inputs). Marquee + in-screen title = title.
// cell = picture cell size (default 0.5); extra = { pin: 'bPressedQ' | 'bPressedC' } more seat keys -> chip bool pins.
export async function buildCabinet({ dir, name, title, owner: OWNER, gen, pins = { a: 'a', b: 'b' }, cell, extra = {} }) {
const here = dir;
fs.writeFileSync(join(here, `${name}.gen.ws`), gen.src);

const sdk = join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
const ds = JSON.parse(diag(gen.src, name, '{}') || '[]');
for (const d of ds) console.error(`${d.severity} ${d.code} line ${d.startLine}: ${d.message}`);
if (ds.some(d => /error/i.test(d.severity))) throw Error('wirescript errors');
const compiled = new Uint8Array(compile(gen.src, name, '{}', '{}'));
console.log(`chip compiled, ${compiled.length} bytes`);

const synName = s => s === 'Noise' ? 'BA_Synth_Noise_White' : s === 'NoisePink' ? 'BA_Synth_Noise_Pink' : `BA_Synth_Basic_${s}`; // 'Noise' = white noise, 'NoisePink' = pink (clown gun shots)
const SYN = [...new Set(gen.synths)].map(synName);
function speakers(b) {
  const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  gen.synths.forEach((s, v) => {
    const spk = { asset: 'B_1x1F_Speaker', color: [30, 30, 30],
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(synName(s)), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: 200, MaxDistance: 1200, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] };
    // gen.speakerAt[v] = cabinet-local [x,y,z]: that voice's speaker is a hidden world brick there (stereo placement), else on the chip plane
    const at = gen.speakerAt?.[v];
    const sp = at ? b.w.addBrick({ ...spk, position: at, direction: 4, rotation: 0, visibility: false, collision: false, owner_index: b.O })
      : b.addInside({ ...spk, position: [maxX + 20 + v * 10, y0, z] });
    for (const [port, target] of [[`P${v}`, 'PitchMultiplier'], [`V${v}`, 'VolumeMultiplier']])
      b.w.addWire(b.outSource(port), { brick: sp, component_type: 'Component_AudioEmitter', port: target });
  });
  return SYN.map(name => ({ type: 'BrickAudioDescriptor', name }));
}

{
  const b = await bundle(compiled, { owner: OWNER });
  fs.writeFileSync(join(here, `${name}_chip.brz`), b.finish({ extraAssets: speakers(b), description: `${title} chip` }));
}

{
  // one hidden chip lying on the hood (top z 58), no outer pins: the seat wires into its port gates, its port gates
  // wire straight into the screen, and the seat adapter (splitter, compares, clock) sits on the chip's own plane
  const tk = Math.max(1, gen.H * (cell ?? 0.5) / 40), TK = Number.isInteger(tk * 2) ? tk : Math.round(tk); // fractional scales (linescreen 96x64 @ 2 = 3.2) put HUD boxes off grid: round them // HUD/msg text scale with screen height (pong 320 tall -> 8x, readable); old cabinets (<= 40 tall) 1
  const z1 = Math.max(48, 26 + 4 * TK + gen.H * (cell ?? 0.5)), Z1 = Number.isInteger(z1) ? z1 : Math.ceil(z1 / 2) * 2, UP = Z1 - 48; // fractional tops (linescreen 96x64 @ 2) round up to even; whole ones unchanged // room for the HUD + msg lines above the base (z 24) // tall pictures (pong 160x240) raise the screen top, head, hood and chip
  const b = await bundle(compiled, { owner: OWNER, offset: [0, 12, 60 + UP], hide: true, bare: true });
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

  // 48 cells = the owner's 26-wide panel; wider pictures widen panel + cabinet (clown: 64)
  // gen.exactScreen: the black panel is exactly the picture (no 1-unit margin) and the HUD/msg boxes take the bezel colour,
  // so the screen reads at the picture's ratio (pong, Rookstun: 15 x 10 micro bricks, not 16 x 12)
  const PW = cell ? (gen.exactScreen ? gen.W * cell / 2 : Math.ceil(gen.W * cell / 2 + 1)) : Math.ceil(13 * gen.W / 48), BW = PW + 2;
  const HUDC = gen.exactScreen ? [60, 60, 64] : null;
  // ---- the owner's cabinet (clipboard bricks, rotated into this frame)
  box(-BW, 2, 24, BW, 22, 50 + UP);     // head behind the screen
  box(-BW, -8, 50 + UP, BW, 22, 58 + UP, { components: text({ Font: font('Bungee'), LineHeight: 2, Text: title, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 2, OutlineColor: rgba([120, 20, 60]) }) }); // hood + marquee
  box(-BW, -8, 0, BW, 22, 24);     // base / desk
  w.addBrick({ asset: 'PB_DefaultBrick', color: GREY, size: [5, 5, 6], position: [0, -22 - (gen.seatBack ?? 0), 6], owner_index: O }); // stool (gen.seatBack: big screens sit the player further back)
  const seat = w.addBrick({ asset: 'B_Seat', position: [0, -23 - (gen.seatBack ?? 0), 23], direction: 4, rotation: 0, color: [255, 255, 255], owner_index: O,
    components: [{ type: C.Seat.NAME, data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: `Play ${title}` } }] });

  // ---- screen = the owner's white panel x -13..13, y 0..2, z 26..48
  const CELL = cell ?? 0.5, base = hex(gen.PAL[0]);
  const SH = gen.STRIP * CELL;
  for (let k = 0; k < gen.H / gen.STRIP; k++) {
    const s = box(-PW, 0, Z1 - (k + 1) * SH, PW, 2, Z1 - k * SH, { color: base,
      components: text({ LineHeight: +(CELL * 0.645).toFixed(4), WidthScale: 2, Color: rgba(gen.textColor ? hex(gen.textColor) : base) }) }); // textColor: untagged text (pong) draws in it
    wireFrom(`strip${k}`, s, 'Text');
    if (gen.textPorts) { wireFrom('lh_', s, 'LineHeight'); wireFrom('ws_', s, 'WidthScale'); } // big type on text screens
  }
  const z0 = Z1 - gen.H * CELL; // 30
  const hud = box(-PW, 0, z0 - 2 * TK, PW, 2, z0, { color: HUDC ?? base, components: text({ LineHeight: 0.8 * TK, Color: rgba([248, 208, 64]) }) });
  wireFrom('hud_', hud, 'Text');
  const msg = box(-PW, 0, Math.min(26, z0 - 4 * TK), PW, 2, z0 - 2 * TK, { color: HUDC ?? base, components: text({ LineHeight: 0.8 * TK, Color: rgba([240, 240, 240]) }) });
  wireFrom('msg_', msg, 'Text');
  const titleB = w.addBrick({ asset: MB, color: [0, 0, 0], size: [1, 1, 1], position: [0, -3, gen.titleMid ? Math.round(Z1 - gen.H * CELL / 2) : 42 + UP], visibility: false, collision: false, owner_index: O, // titleMid: centred on the screen (pong)
    components: text({ Font: font('Bungee'), LineHeight: gen.titleLH ?? 2, Offset: { X: 0, Y: 0, Z: 0 }, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 3, OutlineColor: rgba([120, 20, 60]) }) });
  wireFrom('title_', titleB, 'Text');

  // ---- seat -> chip: occupancy straight into 'seated', the sitter into a raw MicrochipInput -> splitter -> compares
  // -> the chip's own input port gates; 20 Hz clock -> 'tick'. All on the chip plane, past its gates and speakers.
  const X0 = Math.max(...b.rootPos.map(p => p[0])) + 30 + 10 * Math.max(3, gen.synths.length), Y0 = Math.min(...b.rootPos.map(p => p[1])), ZP = b.rootPos[0][2]; // X0: past the speakers
  let gi = 0;
  const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, position: [X0 + (gi % 8) * 10, Y0 + Math.floor(gi++ / 8) * 10, ZP], color: [200, 200, 200],
    components: [{ type: c.NAME, data }] }), c });
  const port = (g, p) => { if (!g.c.PORTS[p]) throw Error(`bad port ${g.c.NAME}.${p}`); return { brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] }; };
  const num = v => ({ $variant: 'f64', value: v });
  wireTo({ brick: seat, component_type: C.Seat.NAME, port: 'bIsOccupied' }, 'seated');
  if (gen.sitterPin) wireTo({ brick: seat, component_type: C.Seat.NAME, port: 'SittingCharacter' }, 'sitter'); // the sitter's character (dvi RPG: savegame via their leaderboard)
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
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'InputUp'), port(split, 'bPressedRightMouse')), 0.5), pins.a);
  wireTo(cmp('Expr_CompareGreater', add(port(split, 'bPressedLeftMouse'), port(split, 'bPressedE')), 0.5), pins.b);
  for (const [pin, key] of Object.entries(extra)) wireTo(cmp('Expr_CompareGreater', port(split, key), 0.5), pin);
  if (!gen.noClock) { // gen.noClock: the chip ticks itself every frame (pong: on ServerUptime()), no clock gate
    const clock = gate(C.Clock, { IntervalSeconds: 0.05, bEnabled: true });
    // gen.clockWhenSeated: the clock only runs while the seat is occupied (pong, Rookstun: no updates with nobody seated)
    if (gen.clockWhenSeated) w.addWire({ brick: seat, component_type: C.Seat.NAME, port: 'bIsOccupied' }, port(clock, 'bEnabled'));
    wireTo(port(clock, 'Pulse'), 'tick');
  }

  fs.writeFileSync(join(here, `${name}.brz`), b.finish({ extraAssets: assets.slice(b.ext.length), description: `${title} cabinet` }));
}
console.log(`wrote ${name}_chip.brz, ${name}.brz`);
}
