// landgrab/cabinet4.mjs: supersigmas/cabinet.mjs with FOUR seats side by side. Each seat's sitter drives its own pins
// (left/right/up/down as l0 r0 u0 d0 .. l3 r3 u3 d3) and its occupancy (seat0..seat3); one 20 Hz clock -> 'tick'.
// Chip inputs: tick seat0..3 l0..3 r0..3 u0..3 d0..3. Outputs as the single-seat cabinet (strip*, hud_, msg_, title_, P/V voices).
import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bundle } from '../tools/wsbundle.mjs';

export async function buildCabinet4({ dir: here, name, title, owner: OWNER, gen }) {
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

const synName = s => s === 'Noise' ? 'BA_Synth_Noise_White' : s === 'NoisePink' ? 'BA_Synth_Noise_Pink' : `BA_Synth_Basic_${s}`;
const SYN = [...new Set(gen.synths)].map(synName);
function speakers(b) {
  const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  gen.synths.forEach((s, v) => {
    const sp = b.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + v * 10, y0, z], color: [30, 30, 30],
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(synName(s)), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: 200, MaxDistance: 1200, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
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

  const PW = Math.ceil(13 * gen.W / 48), BW = PW + 2;
  box(-BW, 2, 24, BW, 22, 50);
  box(-BW, -8, 50, BW, 22, 58, { components: text({ Font: font('Bungee'), LineHeight: 2, Text: title, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 2, OutlineColor: rgba([120, 20, 60]) }) });
  box(-BW, -8, 0, BW, 22, 24);

  const CELL = 0.5, base = hex(gen.PAL[0]);
  const Z1 = 48, SH = gen.STRIP * CELL;
  for (let k = 0; k < gen.H / gen.STRIP; k++) {
    const s = box(-PW, 0, Z1 - (k + 1) * SH, PW, 2, Z1 - k * SH, { color: base,
      components: text({ LineHeight: +(CELL * 0.645).toFixed(4), WidthScale: 2, Color: rgba(base) }) });
    wireFrom(`strip${k}`, s, 'Text');
  }
  const z0 = Z1 - gen.H * CELL;
  const hud = box(-PW, 0, z0 - 2, PW, 2, z0, { color: base, components: text({ LineHeight: 0.8, Color: rgba([248, 208, 64]) }) });
  wireFrom('hud_', hud, 'Text');
  const msg = box(-PW, 0, 26, PW, 2, z0 - 2, { color: base, components: text({ LineHeight: 0.8, Color: rgba([240, 240, 240]) }) });
  wireFrom('msg_', msg, 'Text');
  const titleB = w.addBrick({ asset: MB, color: [0, 0, 0], size: [1, 1, 1], position: [0, -3, 42], visibility: false, collision: false, owner_index: O,
    components: text({ Font: font('Bungee'), LineHeight: 2, Offset: { X: 0, Y: 0, Z: 0 }, Color: rgba([248, 208, 64]), Outline: 2, OutlineWidth: 3, OutlineColor: rgba([120, 20, 60]) }) });
  wireFrom('title_', titleB, 'Text');

  // ---- four stools + seats, each wired to its own pins
  const X0 = Math.max(...b.rootPos.map(p => p[0])) + 60, Y0 = Math.min(...b.rootPos.map(p => p[1])), ZP = b.rootPos[0][2];
  let gi = 0;
  const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, position: [X0 + (gi % 8) * 10, Y0 + Math.floor(gi++ / 8) * 10, ZP], color: [200, 200, 200],
    components: [{ type: c.NAME, data }] }), c });
  const port = (g, p) => { if (!g.c.PORTS[p]) throw Error(`bad port ${g.c.NAME}.${p}`); return { brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] }; };
  const num = v => ({ $variant: 'f64', value: v });
  const k = v => gate(C.Var, { Value: num(v) });
  const cmp = (kind, a, v) => { const g = gate(C[kind]); w.addWire(a, port(g, 'InputA')); w.addWire(port(k(v), 'Value'), port(g, 'InputB')); return port(g, 'bOutput'); };
  for (let i = 0; i < 4; i++) {
    const sx = -30 + i * 20;
    w.addBrick({ asset: 'PB_DefaultBrick', color: GREY, size: [5, 5, 6], position: [sx, -22, 6], owner_index: O });
    const seat = w.addBrick({ asset: 'B_Seat', position: [sx, -23, 23], direction: 4, rotation: 0, color: [255, 255, 255], owner_index: O,
      components: [{ type: C.Seat.NAME, data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: `Play ${title} (seat ${i + 1})` } }] });
    wireTo({ brick: seat, component_type: C.Seat.NAME, port: 'bIsOccupied' }, `seat${i}`);
    const pilot = gate(C.MicrochipInput, { PortLabel: `pilot${i}`, PortOrder: 99 + i });
    w.addWire({ brick: seat, component_type: C.Seat.NAME, port: 'SittingCharacter' }, port(pilot, 'RER_Input'));
    const split = gate(C.InputSplitter);
    w.addWire(port(pilot, 'RER_Output'), port(split, 'Character'));
    wireTo(cmp('Expr_CompareLess', port(split, 'InputRight'), -0.5), `l${i}`);
    wireTo(cmp('Expr_CompareGreater', port(split, 'InputRight'), 0.5), `r${i}`);
    wireTo(cmp('Expr_CompareGreater', port(split, 'InputForward'), 0.5), `u${i}`);
    wireTo(cmp('Expr_CompareLess', port(split, 'InputForward'), -0.5), `d${i}`);
  }
  const clock = gate(C.Clock, { IntervalSeconds: 0.05, bEnabled: true });
  wireTo(port(clock, 'Pulse'), 'tick');

  fs.writeFileSync(join(here, `${name}.brz`), b.finish({ extraAssets: assets.slice(b.ext.length), description: `${title} cabinet` }));
}
console.log(`wrote ${name}_chip.brz, ${name}.brz`);
}
