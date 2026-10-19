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
const FONTS = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }];
// TextDisplay: Billboard 1 = EBRTextFacing::Full (turns to every camera), bForeground = drawn over the world
const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 1, Billboard: 1, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: true, Text: '',
};
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
// SCRUFFY SPLAT (owner 2026-10-18: "make the stars scruffier"; was one '✹', before that '●'): 3 same-red star glyphs
// (MonaspaceKrypton has U+2726-273A) of different point counts and sizes, each nudged off centre by its Anchor (screen
// space on a billboard; Rotation is ignored there), so their union has a ragged edge. Same colour, no outline: the
// overlapping layers can't show z-fighting. VARIANTS prefabs, the chip spawns one at random.
// Number (owner: "text lower slightly") sits 2 units under the cluster's middle (was 2 over).
const STARS = ['✹', '✺', '✸', '✷', '✶', '✴', '✵'];
const VARIANTS = +(process.env.HS_VARIANTS ?? 3);
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const NUM = { ...TEXT, LineHeight: +(process.env.HS_NUM ?? 4), Outline: 2, OutlineWidth: 2, OutlineColor: { R: 40, G: 0, B: 0, A: 255 }, Text: '' };
const vis = process.env.HS_VIS === '1';
const str = value => ({ $variant: 'Str', value });
function makeSplat() {
  const w = new World();
  const O = w.addOwner({ id: OWNER.id, name: OWNER.name, display_name: OWNER.display });
  const red = { R: 180, G: 8, B: 8, A: 255 };
  [-2, 0, 2].forEach((x, k) => {
    const lh = k === 1 ? 10 + rnd() * 2 : 6.5 + rnd() * 3;
    const ang = rnd() * Math.PI * 2, d = k === 1 ? 0.04 : 0.1 + rnd() * 0.08;
    const data = { ...TEXT, LineHeight: lh * +(process.env.HS_DOT ?? 1), Color: red, bForeground: false, Text: STARS[Math.floor(rnd() * STARS.length)],
      Anchor: { X: 0.5 + Math.cos(ang) * d, Y: 0.5 + Math.sin(ang) * d } };
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [x, 0, 3], color: [180, 8, 8], owner_index: O, visibility: vis, collision: NOCOL, components: [{ type: C.TextDisplay.NAME, data }] });
  });
  const num = { h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: [0, 0, 1], color: [255, 255, 255], owner_index: O, visibility: vis, collision: NOCOL, components: [{ type: C.TextDisplay.NAME, data: NUM }] }), c: C.TextDisplay };
  let i = 0;
  const gate = (c, data = {}, extra = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [0, 0, -20 - 12 * i++], color: [200, 200, 200], owner_index: O, visibility: false, collision: NOCOL, components: [{ type: c.NAME, data }], ...extra }), c });
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  // object event "hs" (the chip targets this spawned grid) -> Var -> number text
  const ev = gate(C.Event_CustomGlobal, { EventName: 'hs', bIsObjectEvent: process.env.HS_OBJ !== '0', DataOut1: str(''),
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(k => [`DataOut${k}`, { $variant: 'f64', value: 0 }])) }, { size: [10, 5, 2], position: [0, 0, -8] });
  i++;
  const v = gate(C.Var, { Value: str('') });
  const set = gate(C.Exec_Var_Set);
  wire(v, 'VarRef', set, 'VarRef'); wire(ev, 'DataOut1', set, 'Value'); wire(ev, 'ExecOut', set, 'Exec');
  wire(v, 'Value', num, 'Text');
  if (process.env.HS_DEBUG) { const f = gate(C.Expr_String_FormatText, { FormatString: 'hsdbg|{A}' }); wire(ev, 'DataOut1', f, 'InputA'); const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(set, 'ExecOut', p, 'Exec'); }
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'hitsplat' }, externalAssets: FONTS });
}
const splats = Array.from({ length: VARIANTS }, makeSplat);
splats.forEach((b, k) => fs.writeFileSync(path.join(here, `splat${k}.brz`), b));
const spawnCode = splats.map((_, k) => `${k ? ' else ' : '    '}if pick == ${k} {
      let splat = SpawnPrefab(prefab = $./splat${k}.brz, offset = off, lifetime = 1.2, limit = 60)
      splat.SendGlobalCustomEvent("hs", txt)
    }`).join('');

const sdk = path.join(here, '../tools/wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
let chip;
try { chip = compileWs(fs.readFileSync(path.join(here, 'hitsplat.ws'), 'utf8').replace('//@SPAWN@', process.env.HS_OBJ === '0' ? spawnCode.replace(/splat\.SendGlobalCustomEvent/g, 'SendGlobalCustomEvent') : spawnCode).replace('VARIANTS', String(VARIANTS - 1)).replace('//@SELF@', process.env.HS_DEBUG ? 'on GlobalCustomEvent("hs") -> (t: string) { PrintToConsole(Fmt("hsself|{A}", t)) }' : '').replace('//@DEBUG@', process.env.HS_DEBUG ? 'PrintToConsole(Fmt("hschip|{A}|{B}", damage, at))' : ''), 'hitsplat', '{}', JSON.stringify(Object.fromEntries(splats.map((b, k) => [`./splat${k}.brz`, Array.from(b)])))); }
catch (e) { console.error(String(e)); process.exit(1); }
fs.writeFileSync(path.join(here, 'hitsplat.brz'), reown(new Uint8Array(chip), OWNER));
console.log(`${VARIANTS} splats ${splats.map(b => b.length).join('/')} B, hitsplat.brz ${chip.length} B`);
