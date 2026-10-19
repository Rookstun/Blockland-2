// Hitsplats: splat.brz (brs-js 4) + the hitsplat chip (wirescript, splat embedded).
//   node hitsplat/build.mjs   -> hitsplat/splat.brz, hitsplat/hitsplat.brz
// Live: br.Prefab.Load "hitsplat" -7800 -12000 8000 0 16 (owner renderman, so NEVER Bricks.Clear it: reload = br.World.ClearRegion -7800 -12000 8020 60 60 60 + load). Debug: HS_DEBUG=1 (prints hschip|dmg|at, hsdbg|text per live splat), HS_OBJ=0 (untargeted send).
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
import { reown } from '../pots/reown.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
// owned by renderman (server owner, admin) like pot_pool/skeleton_drop: SpawnPrefab needs it
import { OWNER } from '../pots/reown.mjs';

const lib = await import(pathToFileURL(path.join(here, '../tools/brs4/dist.mjs')).href);
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
const w = new World();
const O = w.addOwner({ id: OWNER.id, name: OWNER.name, display_name: OWNER.display });
const FONTS = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }];
// TextDisplay: Billboard 1 = EBRTextFacing::Full (turns to every camera), bForeground = drawn over the world
const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 1, Billboard: 1, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: true, Text: '',
};
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
// splat = '✹' 12-point black star (MonaspaceKrypton has U+2726-273A; owner 2026-10-18 "make the icon different" from the old '●';
// rotated full blocks don't work: Rotation is ignored on a billboard and '█' is a tall slab)
const SPLAT = { ...TEXT, LineHeight: +(process.env.HS_DOT ?? 11), Color: { R: 185, G: 10, B: 10, A: 255 }, Outline: 2, OutlineWidth: 2, OutlineColor: { R: 60, G: 0, B: 0, A: 255 }, bForeground: false, Text: '✹' };
const NUM = { ...TEXT, LineHeight: +(process.env.HS_NUM ?? 4), Outline: 2, OutlineWidth: 2, OutlineColor: { R: 40, G: 0, B: 0, A: 255 }, Text: '' };
const vis = process.env.HS_VIS === '1';
w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [0, 0, 1], color: [185, 10, 10], owner_index: O, visibility: vis, collision: NOCOL, components: [{ type: C.TextDisplay.NAME, data: SPLAT }] });
const num = { h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [0, 0, 3], color: [255, 255, 255], owner_index: O, visibility: vis, collision: NOCOL, components: [{ type: C.TextDisplay.NAME, data: NUM }] }), c: C.TextDisplay };
let i = 0;
const gate = (c, data = {}, extra = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [0, 0, -20 - 12 * i++], color: [200, 200, 200], owner_index: O, visibility: false, collision: NOCOL, components: [{ type: c.NAME, data }], ...extra }), c });
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
const str = value => ({ $variant: 'Str', value });
// object event "hs" (the chip targets this spawned grid) -> Var -> number text
const ev = gate(C.Event_CustomGlobal, { EventName: 'hs', bIsObjectEvent: process.env.HS_OBJ !== '0', DataOut1: str(''),
  ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(k => [`DataOut${k}`, { $variant: 'f64', value: 0 }])) }, { size: [10, 5, 2], position: [0, 0, -20 - 12 * (i - 1)] });
i++;
const v = gate(C.Var, { Value: str('') });
const set = gate(C.Exec_Var_Set);
wire(v, 'VarRef', set, 'VarRef'); wire(ev, 'DataOut1', set, 'Value'); wire(ev, 'ExecOut', set, 'Exec');
wire(v, 'Value', num, 'Text');
if (process.env.HS_DEBUG) { const f = gate(C.Expr_String_FormatText, { FormatString: 'hsdbg|{A}' }); wire(ev, 'DataOut1', f, 'InputA'); const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(set, 'ExecOut', p, 'Exec'); }
w.makePrefab({});
const splat = w.toBrz({ bundle: { description: 'hitsplat' }, externalAssets: FONTS });
fs.writeFileSync(path.join(here, 'splat.brz'), splat);

const sdk = path.join(here, '../tools/wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
let chip;
try { chip = compileWs(fs.readFileSync(path.join(here, 'hitsplat.ws'), 'utf8').replace('splat.SendGlobalCustomEvent("hs", ', process.env.HS_OBJ === '0' ? 'SendGlobalCustomEvent("hs", ' : 'splat.SendGlobalCustomEvent("hs", ').replace('//@SELF@', process.env.HS_DEBUG ? 'on GlobalCustomEvent("hs") -> (t: string) { PrintToConsole(Fmt("hsself|{A}", t)) }' : '').replace('//@DEBUG@', process.env.HS_DEBUG ? 'PrintToConsole(Fmt("hschip|{A}|{B}", damage, at))' : ''), 'hitsplat', '{}', JSON.stringify({ './splat.brz': Array.from(splat) })); }
catch (e) { console.error(String(e)); process.exit(1); }
fs.writeFileSync(path.join(here, 'hitsplat.brz'), reown(new Uint8Array(chip), OWNER));
console.log(`splat.brz ${splat.length} B, hitsplat.brz ${chip.length} B`);
