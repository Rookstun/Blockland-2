// node dvi/preview.mjs out_dir : renders what the chip draws (scenery + gap colours + sprites) for every place, the
// map and a battle into PPM images, from the same tables gen.mjs builds. For looking at the art without the game.
import fs from 'node:fs';
import { join } from 'node:path';
import { W, H, AREAS, NODES, COL, spriteTables, sceneryTables, gapRows, SPRITES } from './gen.mjs';

const out = process.argv[2] ?? '.';
fs.mkdirSync(out, { recursive: true });
const SCN = sceneryTables(), T = spriteTables(), GR = gapRows(), KEYS = Object.keys(COL);
const rgb = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
function canvas(slot, gapSlot) {
  const px = [];
  for (let r = 0; r < H; r++) {
    const row = new Array(W).fill(rgb(GR[gapSlot * H + r]));
    if (r < 2) row.fill(rgb(COL.l));
    for (let t = SCN.idx[slot * H + r]; t < SCN.idx[slot * H + r + 1]; t++) for (let x = SCN.S[t]; x < SCN.E[t]; x++) row[x] = rgb(COL[KEYS[SCN.C[t]]]);
    px.push(row);
  }
  return px;
}
function sprite(px, name, x0, y0) {
  const base = T.ROWBASE[name];
  SPRITES[name].forEach((_, j) => {
    const y = y0 + j; if (y < 0 || y >= H) return;
    for (let t = T.SI[base + j]; t < T.SI[base + j + 1]; t++) for (let x = x0 + T.SS[t]; x < x0 + T.SE[t]; x++) if (x >= 0 && x < W) px[y][x] = rgb(COL[KEYS[T.SC[t]]]);
  });
}
const save = (px, name) => {
  const s = 4, buf = Buffer.alloc(W * s * H * s * 3);
  for (let y = 0; y < H * s; y++) for (let x = 0; x < W * s; x++) buf.set(px[Math.floor(y / s)][Math.floor(x / s)], (y * W * s + x) * 3);
  fs.writeFileSync(join(out, name + '.ppm'), Buffer.concat([Buffer.from(`P6 ${W * s} ${H * s} 255\n`), buf]));
};
AREAS.forEach((a, i) => {
  const px = canvas(i === 0 ? AREAS.length : i, i);
  for (const [x, y] of a.goons) { sprite(px, 'shadow', x - 1, y + 19); sprite(px, 'goon', x, y); }
  for (const [x, y, g] of a.npcs) { sprite(px, 'shadow', x, y + 15); sprite(px, 'guy' + g, x, y); }
  for (const [x, y, k] of a.items) sprite(px, ['pierogi', 'cigarette', 'ketchup'][k], x, y);
  if (a.boss >= 0) { const [bx, by] = [[175, 70], [170, 80], [150, 80]][a.boss]; const n = ['boss0', 'fat', 'boss2'][a.boss]; const bh = SPRITES[n].length; sprite(px, 'bshadow', bx - 1, by + bh - 1); sprite(px, n, bx, by); }
  sprite(px, 'shadow', 20, 105); sprite(px, 'daniel', 20, 90);
  save(px, `area${i}`);
});
const map = canvas(AREAS.length + 1, AREAS.length);
NODES.forEach(([, x, y]) => sprite(map, 'node', x, y));
sprite(map, 'car', NODES[2][1] - 7, NODES[2][2] - 8);
save(map, 'map');
const bat = canvas(7, 7);
sprite(bat, 'platform', 39, 104); sprite(bat, 'platform', 155, 104); sprite(bat, 'daniel', 50, 90); sprite(bat, 'boss2', 160, 78);
save(bat, 'battle_bronx');
console.log('wrote', AREAS.length + 2, 'previews to', out);
