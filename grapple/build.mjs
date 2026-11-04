// Grapple gun (faik + Penta 2026-11-03). node grapple/build.mjs -> grapple/grapple.brz (+ bead.brz, rope.brz, rope.gen.ws)
//   bead.brz     one rope bead (micro brick, no collision), spawned and moved by the rope chip
//   rope.brz     rope.ws: per-player hook + swing physics, BEADS beads (spawned by grapple.ws 8000 up)
//   grapple.brz  the desk, ground at z 0, front toward -y: gold button = take a gun, front row = elasticity,
//                back row = rope length (10 buttons each, left low .. right high), sign behind; chip under the top.
// Load: br.Prefab.Load "grapple" x y z 0 16 with z = ground. Owner renderman (gives items).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as brs from '../mapgen/lib/brs.mjs';
import { reown, OWNER } from '../pots/reown.mjs';
import { bundle } from '../tools/wsbundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BEADS = 20;
const MAP_OWNER = { id: OWNER.id, name: OWNER.name, display_name: OWNER.display };

// ---- bead
const bw = new brs.World();
const bo = bw.addOwner(MAP_OWNER);
bw.addBrick({ asset: 'PB_DefaultMicroBrick', size: [2, 2, 2], position: [0, 0, 0], color: [150, 112, 66], owner_index: bo,
  collision: { player: false, weapon: false, interaction: false, physics: false, tool: false } });
bw.makePrefab();
const bead = bw.toBrz();
fs.writeFileSync(path.join(here, 'bead.brz'), bead);

// ---- compiler
const sdk = path.join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
function compile(src, name, prefabs) {
  let bad = 0;
  for (const d of JSON.parse(diag(src, name, '{}') || '[]')) { console.error(`${name}: ${d.severity} ${d.code} line ${d.startLine}: ${d.message}`); if (d.severity === 'error') bad++; }
  if (bad) process.exit(1);
  const reg = Object.fromEntries(Object.entries(prefabs).map(([k, v]) => [k, Array.from(v)]));
  return new Uint8Array(compileWs(src, name, '{}', JSON.stringify(reg)));
}

// ---- rope chip: unrolled beads
const I = [...Array(BEADS).keys()];
const f = i => (i + 0.5) / BEADS;
const ropeSrc = fs.readFileSync(path.join(here, 'rope.ws'), 'utf8')
  .replace('// BEAD_VARS', I.map(i => `var b${i}: entity`).join('\n'))
  .replace('// BEAD_PARK', I.map(i => `  b${i}.SetLocation(home)`).join('\n'))
  .replace('// BEAD_KILL', I.map(i => `  b${i}.DestroySpawnedPrefab()`).join('\n'))
  .replace('// BEAD_SPAWN', I.map(i => `  let s${i} = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)\n  s${i}.SetFrozen(true)\n  b${i} = s${i}`).join('\n'))
  .replace('// BEAD_DRAW', I.map(i => `        b${i}.SetLocation(hand + ScaleVec(span, ${f(i).toFixed(4)}) - Vec(0.0, 0.0, sag * ${(4 * f(i) * (1 - f(i))).toFixed(4)}))`).join('\n'));
fs.writeFileSync(path.join(here, 'rope.gen.ws'), ropeSrc);
const rope = reown(compile(ropeSrc, 'rope', { './bead.brz': bead }));
fs.writeFileSync(path.join(here, 'rope.brz'), rope);

// ---- main chip + desk
const compiled = compile(fs.readFileSync(path.join(here, 'grapple.ws'), 'utf8'), 'grapple', { './rope.brz': rope });
const lib = await import(pathToFileURL(path.join(here, '..', 'tools', 'brs4', 'dist.mjs')).href);
const probe = lib.WorldReader.from(compiled);
const pa = probe.brickAssets().map(a => a.name ?? a);
const root = [...probe.bricks(1)].find(b => pa[b.asset_name_index] === 'B_1x1_Microchip');
const CHIP = [0, 0, 20]; // under the desk top, between the legs
const b = await bundle(compiled, { owner: MAP_OWNER, offset: CHIP.map((v, i) => v - root.position[i]), hide: true });
const { w, O, C } = b;
const extra = [];
const extIdx = a => { let i = extra.findIndex(x => x.type === a.type && x.name === a.name); if (i < 0) { extra.push(a); i = extra.length - 1; } return b.ext.length + i; };
const PRESS = extIdx({ type: 'BrickOneShotAudioDescriptor', name: 'BOSA_Buttons_Button_1_Press' });
const RELEASE = extIdx({ type: 'BrickOneShotAudioDescriptor', name: 'BOSA_Buttons_Button_1_Release' });
const FONT = extIdx({ type: 'BrickFontDescriptor', name: 'MonaspaceXenon' });

const boxes = [];
const brick = (asset, size, pos, color, more = {}) => {
  boxes.push({ lo: pos.map((v, i) => v - size[i]), hi: pos.map((v, i) => v + size[i]) });
  return w.addBrick({ asset, size, position: pos, color, owner_index: O, ...more });
};
const WOOD = [74, 46, 28], DARK = [30, 22, 18];
brick('PB_DefaultBrick', [130, 35, 2], [0, 0, 42], WOOD);                         // top, surface z 44
for (const x of [-120, 120]) for (const y of [-25, 25]) brick('PB_DefaultBrick', [5, 5, 20], [x, y, 20], DARK); // legs
const TEXT = { Font: FONT, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 8, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { B: 150, G: 230, R: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { B: 10, G: 10, R: 20, A: 255 }, OutlineWidth: 2,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
  Text: 'THE GRAPPLE DESK\nGold: take a Grapple Gun. Click to hook, click again to let go.\n'
    + 'Front row: ELASTICITY  rigid  ...  disturbingly bouncy\nBack row: ROPE LENGTH  short  ...  ill-advised\n'
    + 'Not responsible for ceilings, lamps or your dignity.' };
brick('PB_DefaultMicroBrick', [130, 3, 30], [0, 37, 74], DARK, { components: [{ type: C.TextDisplay.NAME, data: TEXT }] }); // sign, face -y

// buttons: [x, y, color, op, label]
const lerp = (a, c, t) => a.map((v, i) => Math.round(v + (c[i] - v) * t));
const BTN = [[-112, 0, [236, 190, 60], 0, 'Take a Grapple Gun']];
for (let i = 0; i < 10; i++) {
  BTN.push([-80 + i * 20, -15, lerp([120, 130, 140], [255, 60, 170], i / 9), 1 + i, `Elasticity ${i + 1}/10`]);
  BTN.push([-80 + i * 20, 15, lerp([90, 200, 90], [40, 60, 200], i / 9), 11 + i, `Rope ${(i + 1) * 150}`]);
}
const BTNC = 'Component_Internal_AnimatedButton';
const maxX = Math.max(...b.rootPos.map(p => p[0])), minY = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
let gi = 0;
const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}),
  position: [maxX + 40 + (gi % 12) * 40, minY + Math.floor(gi++ / 12) * 40, z], color: [200, 200, 200], components: [{ type: c.NAME, data }] }), c });
const wire = (a, ap, c, cp) => {
  const A = a.c ? { brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] } : a, B = c.c ? { brick: c.h, component_type: c.c.NAME, port: c.c.PORTS[cp] } : c;
  if (!A.port || !B.port) throw Error(`bad port ${ap} -> ${cp}`);
  w.addWire(A, B);
};
for (const [x, y, color, op, label] of BTN) {
  const h = brick('B_Button', [5, 5, 2], [x, y, 46], color, { components: [{ type: BTNC, data: { PressSound: PRESS, ReleaseSound: RELEASE,
    bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: label } }] });
  boxes.pop(); // B_Button is a fixed asset: size is ignored, keep it out of the overlap check
  const edge = gate(C.Expr_EdgeDetectorExec);
  wire({ brick: h, component_type: BTNC, port: 'bHeld' }, null, edge, 'Input');
  const s = gate(C.Exec_SendCustomEventGlobal, { EventName: 'grap.set', DataIn1: { $variant: 'weak_object', value: null }, DataIn2: { $variant: 'i64', value: op },
    ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(k => [`DataIn${k}`, { $variant: 'f64', value: 0 }])) });
  wire(edge, 'OnRisingEdge', s, 'ExecIn');
  wire({ brick: h, component_type: BTNC, port: 'Character' }, null, s, 'DataIn1');
}
// self-check: no two world-grid bricks of ours overlap (the game rejects overlaps), chip clear of them
const ov = (p, q) => p.lo.every((v, i) => v < q.hi[i]) && q.lo.every((v, i) => v < p.hi[i]);
boxes.forEach((p, i) => boxes.slice(i + 1).forEach(q => { if (ov(p, q)) throw Error(`overlap ${JSON.stringify(p)} ${JSON.stringify(q)}`); }));
const chipBox = { lo: CHIP.map(v => v - 5), hi: CHIP.map(v => v + 5) };
if (boxes.some(p => ov(p, chipBox))) throw Error('chip overlaps the desk');

const out = b.finish({ extraAssets: extra, description: 'Grapple desk' });
fs.writeFileSync(path.join(here, 'grapple.brz'), out);
// every microchip hidden (owner rule)
for (const [name, bytes] of [['rope', rope], ['grapple', out]]) {
  const r = lib.WorldReader.from(bytes), as = r.brickAssets().map(a => a.name ?? a);
  const shown = [...r.bricks(1)].filter(x => as[x.asset_name_index] === 'B_1x1_Microchip' && x.visibility !== false);
  console.log(`${name}.brz ${bytes.length} bytes${shown.length ? `  WARNING ${shown.length} visible chip(s)` : ''}`);
}
