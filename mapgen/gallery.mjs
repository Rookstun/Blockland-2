// Mapgen gallery (owner in chat 2026-11-01: "deploy all your mapgen files with text component identifying them"):
// every standalone build generator laid out in two rows on the flat plate, each lifted to z 0 with a red name sign
// (TextDisplay, pizzahut style) in front of its -y side. One owner, one bricks op.
//   node mapgen/gallery.mjs X Y job.json      (X,Y = north-west corner; rows run +x, step -y)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const [GX, GY] = process.argv.slice(2, 4).map(Number);
const OUT = process.argv[4] ?? 'gallery_job.json';
const OWNER = { id: '6a11e000-0000-4b0b-9a11-00000000ca11', name: 'Mapgen Gallery', display_name: 'Mapgen Gallery' };
const FONTS = ['MonaspaceXenon', 'Cinzel', 'PirataOne', 'Gotfridus', 'EagleLake', 'Bungee'];
const GAP = 200, SIGN_Y = 60;
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'gal-'));

// [generator, args before the output path, sign text]; "@" = output path
const GENS = [
  ['bowling', ['0', '0', '0', '@'], 'BOWLING'], ['explosion', ['0', '0', '0', '@'], 'EXPLOSION'],
  ['herobrine', ['0', '0', '0', '@'], 'HEROBRINE'], ['mosque', ['0', '0', '0', '@'], 'MOSQUE'],
  ['mousehouse', ['0', '0', '0', '@'], 'MOUSE HOUSE'], ['pizzahut', ['0', '0', '0', '@'], 'PIZZA HUT'],
  ['quiltbottom', ['0', '0', '0', '@'], 'QUILTBOTTOM'], ['shoe', ['0', '0', '0', '@'], 'SHOE'],
  ['sushi', ['0', '0', '0', '@'], 'SUSHI'], ['tungbastion', ['0', '0', '0', '@'], 'TUNG BASTION'],
  ['tungsahur', ['0', '0', '0', '@'], 'TUNG SAHUR'],
  ['chateaureve', ['@'], 'CHATEAU REVE'], ['derwent', ['@'], 'DERWENT HOUSE'], ['whitetail', ['@'], 'WHITE TAIL'],
  ['witherspoon', ['@'], 'WITHERSPOON'], ['brynwood', ['@'], 'BRYNWOOD'], ['longbrooke', ['@'], 'LONGBROOKE'],
  ['georgian', ['1', '@'], 'GEORGIAN'], ['tavistock', ['1', '@'], 'TAVISTOCK'],
  ['dutchcolonial', ['1', '@'], 'DUTCH COLONIAL'], ['splitlevel', ['1', '@'], 'SPLIT LEVEL'],
  ['office', ['--at', '0,0', '--out', '@'], 'BRICKWELL TOWER'],
];

const half = b => b.size ?? [5, 5, 6];
const PIN = { longbrooke: [920, -15620, 0] };
// a few generator tiles have off-grid sizes (ship.mjs rejects them): those become micro bricks
const offGrid = b => /^PB_Default(?!Micro)/.test(b.asset) && b.size && (b.size[0] % 5 || b.size[1] % 5 || b.size[2] % 2);
function load(name, args) {
  const f = path.join(T, name + '.json');
  execFileSync(process.execPath, [`mapgen/${name}.mjs`, ...args.map(a => a === '@' ? f : a)], { stdio: ['ignore', 'ignore', 'inherit'] });
  const j = JSON.parse(fs.readFileSync(name === 'office' ? path.join(f, 'add.json') : f, 'utf8')); // office writes a DIR
  const op = j.ops?.find(o => o.op === 'bricks');
  return { bricks: Array.isArray(j) ? j : op?.bricks ?? j.bricks, assets: op?.externalAssets ?? j.externalAssets ?? [] };
}

const builds = GENS.map(([name, args, text]) => {
  const { bricks, assets } = load(name, args);
  const m = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const b of bricks) for (let i = 0; i < 3; i++) {
    m[i] = Math.min(m[i], b.position[i] - half(b)[i]); m[i + 3] = Math.max(m[i + 3], b.position[i] + half(b)[i]);
  }
  // fonts are indexes into the build's own externalAssets: remap to FONTS by name
  for (const b of bricks) for (const c of b.components ?? []) if ('Font' in (c.data ?? {})) {
    const k = FONTS.indexOf(assets[c.data.Font]?.name);
    if (k < 0) throw new Error(`${name}: unknown font ${JSON.stringify(assets[c.data.Font])}`);
    c.data.Font = k;
  }
  return { name, text, bricks, m, w: m[3] - m[0], d: m[4] - m[1] };
});

// two rows of about equal width, deepest builds in the back row
builds.sort((a, b) => b.d - a.d);
const total = builds.reduce((s, b) => s + b.w + GAP, 0);
const rows = [[], []]; let acc = 0;
for (const b of builds) { rows[acc < total / 2 ? 0 : 1].push(b); acc += b.w + GAP; }

const sign = (text, x, y) => ({
  asset: 'PB_DefaultMicroBrick', color: [190, 30, 34], size: [Math.max(60, text.length * 14), 6, 24], position: [x, y, 24],
  components: [{ type: 'Component_TextDisplay', data: {
    Font: 5, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 22, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 },
    Offset: { X: 0, Y: 0, Z: 0.2 }, Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0,
    OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0, ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45,
    GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true, Typeface: 0, Billboard: 0,
    Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true,
    bOverrideOutlineColor: true, bForeground: false, Text: text } }],
});

const out = [], box = [Infinity, Infinity, -Infinity, -Infinity];
let y0 = GY;
for (const row of rows) {
  const depth = Math.max(...row.map(b => b.d));
  let x = GX;
  for (const b of row) {
    // snap shifts to 10 so procedural bricks stay on the stud grid
    let dx = Math.round((x - b.m[0]) / 10) * 10, dy = Math.round((y0 - b.m[4]) / 10) * 10, dz = Math.ceil(-b.m[2] / 4) * 4;
    // builds re-shipped into their live slot by a delta keep that slot (2026-11-02: longbrooke on the template)
    if (PIN[b.name]) [dx, dy, dz] = PIN[b.name];
    for (const k of b.bricks) { const { label, ...r } = k; if (offGrid(r)) r.asset = 'PB_DefaultMicroBrick'; out.push({ ...r, position: [k.position[0] + dx, k.position[1] + dy, k.position[2] + dz] }); }
    out.push(sign(b.text, Math.round((b.m[0] + b.m[3]) / 20) * 10 + dx, b.m[1] + dy - SIGN_Y));
    box[0] = Math.min(box[0], b.m[0] + dx); box[2] = Math.max(box[2], b.m[3] + dx);
    box[1] = Math.min(box[1], b.m[1] + dy - SIGN_Y - 10);
    x += b.w + GAP;
  }
  box[3] = Math.max(box[3], y0);
  y0 -= depth + SIGN_Y + GAP * 2;
}

fs.writeFileSync(OUT, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 30000,
  externalAssets: FONTS.map(name => ({ type: 'BrickFontDescriptor', name })), bricks: out }] }));
fs.rmSync(T, { recursive: true });
console.error(`${builds.length} builds, ${out.length} bricks, box x ${box[0]}..${box[2]} y ${box[1]}..${box[3]}`);
