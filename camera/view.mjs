// node camera/view.mjs READBACK.brz out.png : the monitor's strips (Prefab.SaveRegion read-back) -> PNG, 10x upscaled
import fs from 'node:fs';
import { png } from '../nes/run.mjs';
const lib = await import('../tools/brs4/dist.mjs');
const r = lib.WorldReader.from(new Uint8Array(fs.readFileSync(process.argv[2])));
const strips = [];
for (const ch of r.brickChunkIndex(1)) {
  const bricks = [...r.bricks(1)];
  for (const c of r.componentChunk(1, ch.index).components) if (/TextDisplay/.test(c.typeName) && c.data.Text.includes('color')) strips.push(c.data.Text);
}
// strip order = brick order in the file = build order (top strip first)
const rows = strips.flatMap(t => t.split('\n')).map(l => [...l.matchAll(/<color="([0-9A-F]{6})">(█+)<\/>/g)].flatMap(m => Array(m[2].length).fill(parseInt(m[1], 16))));
const W = rows[0].length, H = rows.length, S = 10, fb = new Array(W * S * H * S);
for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) { const c = rows[Math.floor(y / S)][Math.floor(x / S)] ?? 0; fb[y * W * S + x] = (c >> 16 & 255) | (c & 0xff00) | (c & 255) << 16; }
fs.writeFileSync(process.argv[3], png(fb, W * S, H * S));
console.log(`${W}x${H}`);
