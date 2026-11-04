// Security camera (owner 2026-11-03). node camera/build.mjs ->
//   cam_prop.brz  the camera body (lens = local +x at the origin, grabbable), spawned + posed by the chip
//   cam.gen.ws    cam.ws with the unrolled ray rows
//   monitor.brz   wall monitor on a stand (ground z 0, screen faces -y) + the chip behind it, strips wired to its pins
// Load: br.Prefab.Load "monitor" x y z 0 16 with z = ground. Owner renderman (spawns the prop).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reown, OWNER } from '../pots/reown.mjs';
import { bundle } from '../tools/wsbundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAP_OWNER = { id: OWNER.id, name: OWNER.name, display_name: OWNER.display };
const W = 32, H = 18, CELL = 4, NS = H / 2;          // 128 x 72 picture, 2 rows per strip
const SEGS = 8;                                       // sweeps reach 100 units: camera sees 800
const POSE = { E: [8040, -20100, 90], yaw: 90, pitch: -10 }; // default: watching the grapple desk (live spot)

// ---- compiler
const sdk = path.join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
function compile(src, name, prefabs = {}) {
  let bad = 0;
  for (const d of JSON.parse(wasm.wirescript_diagnostics(src, name, '{}') || '[]')) { console.error(`${name}: ${d.severity} ${d.code} line ${d.startLine}: ${d.message}`); if (d.severity === 'error') bad++; }
  if (bad) process.exit(1);
  const reg = Object.fromEntries(Object.entries(prefabs).map(([k, v]) => [k, Array.from(v)]));
  return new Uint8Array(wasm.wirescript_compile(src, name, '{}', JSON.stringify(reg)));
}
const lib = await import(pathToFileURL(path.join(here, '..', 'tools', 'brs4', 'dist.mjs')).href);
const rootOf = bytes => { const r = lib.WorldReader.from(bytes), as = r.brickAssets().map(a => a.name ?? a); return [...r.bricks(1)].find(b => as[b.asset_name_index] === 'B_1x1_Microchip'); };
const OFF = { player: false, weapon: false, interaction: false, physics: false, tool: false };
const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
const overlapCheck = boxes => {
  const ov = (p, q) => p.lo.every((v, i) => v < q.hi[i]) && q.lo.every((v, i) => v < p.hi[i]);
  boxes.forEach((p, i) => boxes.slice(i + 1).forEach(q => { if (ov(p, q)) throw Error(`overlap ${JSON.stringify(p)} ${JSON.stringify(q)}`); }));
};

// ---- camera prop: grey body behind the lens, black lens, red tally light; all collision off (rays and players pass)
const pw = new lib.World();
const po = pw.addOwner(MAP_OWNER);
// collision on (default): with it all off nobody could grab, carry or tool-move the prop (faik 2026-11-04 'when i moved the camera it didnt do anything')
const pb = (size, position, color, more = {}) => pw.addBrick({ asset: 'PB_DefaultMicroBrick', size, position, color, owner_index: po, ...more });
pb([8, 5, 5], [-10, 0, 0], [200, 200, 205]);                                     // body x -18..-2
pb([2, 3, 3], [0, 0, 0], [15, 15, 18], { material: 'BMC_Glass' });              // lens x -2..2
pb([1, 1, 1], [-4, 0, 6], [255, 30, 30], { material: 'BMC_Glow', material_intensity: 4 }); // tally light on top
pb([2, 2, 6], [-12, 0, -11], [60, 60, 66]);                                      // mount stub under the body
pw.makePrefab({});
const prop = pw.toBrz({ bundle: { description: 'Security camera' } });
fs.writeFileSync(path.join(here, 'cam_prop.brz'), prop);

// ---- chip source: unrolled rows (2 per tick) of W rays each
const f = (x, d = 4) => x.toFixed(d);
const DET = 'detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false';
const shade = (s, k) => `ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), ${s}.HitColor, 0.62 + 0.25 * ${s}.HitNormal.z + 0.13 * ${s}.HitNormal.x), Color(0.62, 0.75, 0.9), min((${s}.HitDistance + ${f(k * 99, 1)}) / ${SEGS * 100}.0, 1.0) * 0.45).ToHex().Substring(0, 6)`;
const ray = (j, c, k, ind) => {
  const s = `k${j}_${c}_${k}`, d = `d${j}_${c}`;
  return `${ind}let ${s} = Sweep(${k ? `O + ${d} * ${f(k * 99, 1)}` : 'O'}, ${d}, 100.0, ${DET})
${ind}on ${s}.Hit {
${ind}  px[${c}] = ${shade(s, k)}
${ind}}
${ind}on ${s}.Miss {
${k + 1 < SEGS ? ray(j, c, k + 1, ind + '  ') : `${ind}  px[${c}] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(${d}.z, 0.0, 1.0)).ToHex().Substring(0, 6)\n`}${ind}}
`;
};
const ind = '    ';
let rows = '';
for (let j = 0; j < 2; j++) {
  rows += `${ind}let v${j} = TV * (1.0 - (rw * 2.0 + ${j}.5) * ${f(2 / H, 6)})\n`;
  for (let c = 0; c < W; c++) rows += `${ind}let d${j}_${c} = Normalize(F + R * (TH * ${f((c + 0.5) * 2 / W - 1, 6)}) + U * v${j})\n` + ray(j, c, 0, ind);
  rows += `${ind}let row${j} = rowStr()\n`;
}
const I = [...Array(NS).keys()];
const AS = a => `[${a.map(s => JSON.stringify(s)).join(', ')}]`;
const src = fs.readFileSync(path.join(here, 'cam.ws'), 'utf8')
  .replace('//@W@', String(W))
  .replace('//@BLK@', AS(Array.from({ length: W + 1 }, (_, n) => '█'.repeat(n))))
  .replace('//@E0@', `Vec(${POSE.E.map(v => f(v, 1)).join(', ')})`)
  .replace('//@YAW0@', f(POSE.yaw, 1)).replace('//@PITCH0@', f(POSE.pitch, 1))
  .replace('//@PX@', AS(Array(W).fill('000000')))
  .replace('//@SVARS@', I.map(k => `var s${k}: string = ""`).join('\n'))
  .replace('//@OUTS@', I.map(k => `@right out strip${k}: string = s${k}`).join('\n'))
  .replace('//@ASPECT@', f(H / W, 6))
  .replace('//@ROWS@', rows.replace(/\n$/, ''))
  .replace('//@SET@', I.map(k => `    ${k ? '} else if' : 'if'} rw == ${k} {\n      s${k} = t`).join('\n') + '\n    }')
  .replaceAll('//@NS@', String(NS));
fs.writeFileSync(path.join(here, 'cam.gen.ws'), src);
const chip = compile(src, 'cam', { './cam_prop.brz': prop });

// ---- monitor: screen strips at y 0..2 facing -y, bezel, back panel, pole + foot; chip hidden behind the panel
const CHIP = [0, 12, 96];
const root = rootOf(chip);
const b = await bundle(chip, { owner: MAP_OWNER, offset: CHIP.map((v, i) => v - root.position[i]), hide: true, bare: true });
const { w, C, O } = b;
const FONT = b.ext.length, ext = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }, { type: 'BrickFontDescriptor', name: 'Bungee' }];
const boxes = [{ lo: CHIP.map((v, i) => v - [5, 5, 2][i]), hi: CHIP.map((v, i) => v + [5, 5, 2][i]) }];
const brick = (size, pos, color, more = {}) => {
  boxes.push({ lo: pos.map((v, i) => v - size[i]), hi: pos.map((v, i) => v + size[i]) });
  return w.addBrick({ asset: 'PB_DefaultMicroBrick', size, position: pos, color, owner_index: O, ...more });
};
const TEXT = { Font: FONT, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0.2 },
  Color: rgba([255, 255, 255]), MaterialSlider: 10, ShadingWidth: 0, OutlineColor: rgba([0, 0, 0]), OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '' };
const SW = W * CELL / 2, Z1 = 132, Z0 = Z1 - H * CELL, BZ = 4;  // screen x -64..64, z 60..132
const DARK = [28, 28, 32];
I.forEach(k => {
  const s = brick([SW, 1, CELL], [0, 1, Z1 - CELL - k * 2 * CELL], [8, 10, 14], { components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: +(CELL * 0.645).toFixed(4), WidthScale: 2 } }] });
  w.addWire({ brick: b.portOut(`strip${k}`), component_type: 'BrickComponentType_Internal_MicrochipOutput', port: 'RER_Output' }, { brick: s, component_type: C.TextDisplay.NAME, port: 'Text' });
});
brick([SW + BZ, 1, BZ / 2], [0, 1, Z1 + BZ / 2], DARK, { components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, Font: FONT + 1, LineHeight: 3, Color: rgba([255, 60, 60]), Text: 'REC   CAM 1' } }] }); // top bezel
brick([SW + BZ, 1, BZ / 2], [0, 1, Z0 - BZ / 2], DARK);                                // bottom bezel
for (const s of [-1, 1]) brick([BZ / 2, 1, (Z1 - Z0) / 2], [s * (SW + BZ / 2), 1, (Z0 + Z1) / 2], DARK); // sides
brick([SW + BZ, 2, (Z1 - Z0) / 2 + BZ], [0, 4, (Z0 + Z1) / 2], DARK);                 // back panel y 2..6, z 56..136
brick([4, 4, 26], [0, 4, 30], [70, 70, 76], { material: 'BMC_Metallic' });             // pole z 4..56
brick([30, 16, 2], [0, 4, 2], DARK);                                                   // foot z 0..4
overlapCheck(boxes);
const out = b.finish({ extraAssets: ext, description: 'Security camera monitor' });
fs.writeFileSync(path.join(here, 'monitor.brz'), out);

for (const [name, bytes] of [['cam_prop', prop], ['monitor', out]]) {
  const r = lib.WorldReader.from(bytes), as = r.brickAssets().map(a => a.name ?? a);
  const shown = [...r.bricks(1)].filter(x => as[x.asset_name_index] === 'B_1x1_Microchip' && x.visibility !== false);
  if (shown.length) throw Error(`${name}: visible chip`);
  console.log(`${name}.brz ${bytes.length} bytes, embedded prefabs ${r.prefabPaths().length}`);
}
