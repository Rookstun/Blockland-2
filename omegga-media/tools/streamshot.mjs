// Read an O-grid tile screen back as a PNG (each tile's TextDisplay = k x k <color="hex"> blocks).
//   node omegga-media/tools/streamshot.mjs in.brz out.png                     the /stream panel (in = br.Prefab.SaveRegion "x" 3956 374 1000 33 3 19 0)
//   node omegga-media/tools/streamshot.mjs world.brdb out.png --owner "TV"    /stream tv: a LOOSE grid (SaveRegion can't see those:
//        World.Save, cp the .brdb, read it here) whose owner name contains the text
//   options: --tw 32 --th 18 --k 2 --tile 2 (tile side in units; TV default 4)
// Tiles are found by their size and placed by position (top-left = max x, max z: Brickadia is left-handed).
import fs from 'fs'; import zlib from 'zlib';
const lib = fs.existsSync(new URL('../lib/brs4.mjs', import.meta.url)) ? '../lib/brs4.mjs' : '../../tools/brs4/dist.mjs';
const m = await import(new URL(lib, import.meta.url));
const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const [inFile, outFile] = argv;
const brdb = inFile.endsWith('.brdb');
const K = +flag('k', 2), TW = +flag('tw', 32), TH = +flag('th', 18), TILE = +flag('tile', brdb ? 4 : 2), ownerText = flag('owner', null);
let r;
if (brdb) {
  const { DatabaseSync } = await import('node:sqlite');
  r = new m.WorldReader(new m.Brdb(new DatabaseSync(inFile, { readOnly: true })));
} else r = m.WorldReader.from(fs.readFileSync(inFile));
const names = r.owners().UserNames;
const tiles = []; // [x, z, text]
const grids = brdb ? r.gridIds().filter(g => g > 1) : [1];
for (const g of grids) {
  let chunks; try { chunks = r.brickChunkIndex(g); } catch { continue; }
  for (const ci of chunks) {
    let bricks, comps;
    try {
      bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => r.brickChunkSoa(e, i) }, g)];
      // skip other owners' grids before decoding any components (a world has ~1000 grids)
      if (ownerText && !bricks.some(b => String(names[b.owner_index] ?? '').includes(ownerText))) continue;
      comps = r.componentChunk(g, ci.index).components;
    } catch { continue; }
    for (const c of comps) {
      if (!/TextDisplay/.test(c.typeName)) continue;
      const b = bricks[c.brickIndex]; if (!b) continue;
      if (b.size[0] !== TILE / 2 || b.size[2] !== TILE / 2) continue;
      if (ownerText && !String(names[b.owner_index] ?? '').includes(ownerText)) continue;
      tiles.push([b.position[0], b.position[2], String(c.data?.Text ?? ''), g]);
    }
  }
}
if (!tiles.length) { console.log('no tiles found'); process.exit(1); }
// several TVs of one owner text: --grid N picks one (default the first)
const gs = [...new Set(tiles.map(t => t[3]))];
if (flag('grid', null) != null) gs.unshift(+flag('grid', null));
if (gs.length > 1) console.log('tiles in several grids', gs, '- using', gs[0], '(--grid N)');
const mine = tiles.filter(t => t[3] === gs[0]);
const maxX = Math.max(...mine.map(t => t[0])), maxZ = Math.max(...mine.map(t => t[1]));
const W = TW * K, H = TH * K, img = Buffer.alloc(W * H * 3);
let n = 0, empty = 0;
for (const [x, z, text] of mine) {
  const tx = Math.round((maxX - x) / TILE), ty = Math.round((maxZ - z) / TILE);
  if (tx < 0 || tx >= TW || ty < 0 || ty >= TH) continue;
  const cols = [...text.matchAll(/color="([0-9a-fA-F]{6})"/g)].map(m => m[1]);
  if (cols.length !== K * K) { empty++; continue; }
  n++;
  cols.forEach((h, i) => { const px = tx * K + (i % K), py = ty * K + Math.floor(i / K), o = (py * W + px) * 3; for (let ch = 0; ch < 3; ch++) img[o + ch] = parseInt(h.substr(ch * 2, 2), 16); });
}
const S = 8, w = W * S, h = H * S, raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) img.copy(raw, y * (w * 3 + 1) + 1 + x * 3, ((Math.floor(y / S)) * W + Math.floor(x / S)) * 3, ((Math.floor(y / S)) * W + Math.floor(x / S)) * 3 + 3); }
const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(outFile, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('tiles', n, 'empty', empty, 'of', mine.length);
