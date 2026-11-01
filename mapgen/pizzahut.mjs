// Pizza Hut-style restaurant on the shapedhouse generator (owner 2026-11-01: "build the hut ... use the building
// generators we worked on"): a rect house (one open storey, partition wall cut out), the gable roof recoloured red,
// a pylon sign out front, a salad bar along the back wall and red-cloth booths.
//
//   node mapgen/pizzahut.mjs X Y Z [job.json]    (front faces -y, door right of centre; footprint 440 x 300 from X,Y)
import fs from 'fs';
import { shapedHouse } from './shapedhouse.mjs';
import { makeBuilder } from './builder.mjs';
import { EXTERNAL_ASSETS } from './ruins.mjs';

const [AX, AY, AZ] = process.argv.slice(2, 5).map(Number);
const JOB = process.argv[5] ?? 'pizzahut_job.json';
const OWNER = { id: 'd1220000-0000-4b0b-9a11-00000000d122', name: 'Pizza Hut', display_name: 'Pizza Hut' };
const W = 44, D = 30, MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
const RED = [190, 30, 34], WHITE = [240, 238, 232];

const h = shapedHouse({ shape: 'rect', W, D, storeys: 1, attic: false, furniture: false, roof: 'gable' });
const isRoof = c => c && ((c[0] === 82 && c[1] === 92 && c[2] === 112) || (c[0] === 70 && c[1] === 70 && c[2] === 74));
// open plan: cut the partition wall (x centre 225, between the end walls, below the ceiling tiles)
const keep = h.bricks.filter(b => !(b.position[0] === 225 && b.position[1] > 10 && b.position[1] < 290 && b.position[2] < 150 && b.size[0] === 5));
const B = makeBuilder();
for (const b of keep) B.add(isRoof(b.color) ? { ...b, color: RED } : b, 'house');
const box = (x0, y0, z0, x1, y1, z1, m, label) => B.box(x0, y0, z0, x1, y1, z1, { asset: MB, ...m }, label);

// ---- salad bar along the back wall
box(80, 230, 4, 340, 262, 40, { color: [110, 70, 45] }, 'counter');
box(80, 230, 40, 340, 262, 44, { asset: TILE, color: WHITE }, 'counter top');
box(84, 258, 44, 336, 260, 74, { color: [170, 210, 230], material: 'BMC_Glass' }, 'sneeze guard');
[[70, 160, 60], [210, 40, 40], [240, 130, 30], [240, 210, 60], [235, 235, 225], [140, 60, 150], [90, 170, 70], [190, 120, 50]]
  .forEach((c, i) => box(94 + i * 30, 236, 44, 114 + i * 30, 254, 52, { color: c }, 'bowl'));
box(80, 218, 4, 340, 222, 12, { color: [60, 40, 28] }, 'tray rail');

// ---- booths: red-cloth tables with stools
for (const y of [70, 150]) for (const x of [60, 160, 260, 380]) {
  if (x === 380 && y === 70) continue; // the door path
  box(x - 30, y - 30, 28, x + 30, y + 30, 32, { color: RED }, 'table');
  box(x - 3, y - 3, 4, x + 3, y + 3, 28, { color: [50, 40, 36] }, 'table leg');
  for (const s of [-1, 1]) box(x + s * 42 - 7, y - 7, 4, x + s * 42 + 7, y + 7, 18, { color: [50, 40, 36] }, 'stool');
}

// ---- pylon sign out front
box(56, -124, 0, 64, -116, 214, { color: [60, 60, 66] }, 'sign pole');
const font = EXTERNAL_ASSETS.findIndex(a => a.name === 'Bungee');
B.add({ asset: MB, color: RED, size: [90, 6, 36], position: [60, -120, 250],
  components: [{ type: 'Component_TextDisplay', data: {
    Font: font, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 22, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0.2 },
    Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
    Text: 'PIZZA HUT' } }] }, 'sign board');

console.error(`${B.bricks.length} bricks, dropped ${B.dropped.length}${B.dropped[0] ? ', e.g. ' + B.dropped[0] : ''}`);
const bricks = B.bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + AX, b.position[1] + AY, b.position[2] + AZ] }));
fs.writeFileSync(JOB, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 8000, externalAssets: EXTERNAL_ASSETS, bricks }] }));
console.error('wrote', JOB);
