// Preview snapshot for the worldgen editor (editor/), written by
// `mapgen.mjs --preview FILE` (terrain + feature sites, stops before meshing)
// or `--preview FILE --preview-full` (also every brick's top, rasterised).
//
// File: 'MGPV', u32 header length, header JSON, padding to 4 bytes, then the
// sections the header lists ({ name, type, offset, length, w, h }), offsets
// from the start of the data block. Typed arrays are little-endian.

import fs from 'fs';
import { worldBox } from './orient.mjs';

/** top-down raster of bricks: colour and top z per res-unit pixel */
export function rasterBricks(bricks, { x0, y0, size, res, fixed }) {
  const W = Math.ceil(size / res);
  const top = new Int16Array(W * W).fill(-32768);
  const rgb = new Uint8Array(W * W * 3);
  for (const b of bricks) {
    if (b.visible === false) continue;
    const [lo, hi] = worldBox(b, fixed);
    const z = Math.round(hi[2]);
    const px0 = Math.max(0, Math.floor((lo[0] - x0) / res)), px1 = Math.min(W - 1, Math.ceil((hi[0] - x0) / res) - 1);
    const py0 = Math.max(0, Math.floor((lo[1] - y0) / res)), py1 = Math.min(W - 1, Math.ceil((hi[1] - y0) / res) - 1);
    const c = b.color ?? [200, 200, 200];
    for (let px = px0; px <= px1; px++)
      for (let py = py0; py <= py1; py++) {
        const i = py * W + px;
        if (z < top[i]) continue;
        top[i] = z;
        rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
      }
  }
  return { W, top, rgb };
}

export function writePreview(file, header, sections) {
  const bufs = [];
  let off = 0;
  header.sections = [];
  for (const [name, arr, extra = {}] of sections) {
    const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = (4 - (b.length % 4)) % 4;
    header.sections.push({ name, type: arr.constructor.name, offset: off, length: arr.length, ...extra });
    bufs.push(b, Buffer.alloc(pad));
    off += b.length + pad;
  }
  let hj = Buffer.from(JSON.stringify(header));
  hj = Buffer.concat([hj, Buffer.alloc((4 - ((8 + hj.length) % 4)) % 4, 32)]);
  const head = Buffer.alloc(8);
  head.write('MGPV', 0, 'ascii');
  head.writeUInt32LE(hj.length, 4);
  fs.writeFileSync(file, Buffer.concat([head, hj, ...bufs]));
}
