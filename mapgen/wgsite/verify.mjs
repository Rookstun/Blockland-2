// Checks the site's browser terrain port (terrain.mjs) against mapgen itself:
//   node mapgen/wgsite/verify.mjs [--seed N] [--scale K] [--params FILE]
// runs `mapgen.mjs --preview-height` and compares every cell (tail off: the
// height stage stops before mapgen merges the tail).

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { terrain } from './terrain.mjs';
import { readSchema } from './schema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const seed = Number(opt('--seed', 487675143)), scale = Number(opt('--scale', 2));
const pfile = opt('--params', path.join(HERE, '..', 'out_rebuild_params.json'));
const params = JSON.parse(fs.readFileSync(pfile, 'utf8'));
const schema = readSchema(path.join(HERE, '..', 'mapgen.mjs'), scale);
const get = k => (k in params ? params[k] : schema[k].def);

const tmp = path.join(os.tmpdir(), `wgverify_${process.pid}.bin`);
let t = Date.now();
execFileSync(process.execPath, [path.join(HERE, '..', 'mapgen.mjs'), '--seed', String(seed), '--scale', String(scale), '--params', pfile, '--preview', tmp, '--preview-height'], { cwd: path.join(HERE, '..'), stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`mapgen height stage ${Date.now() - t} ms`);
const buf = fs.readFileSync(tmp); fs.unlinkSync(tmp);
const hlen = buf.readUInt32LE(4), head = JSON.parse(buf.subarray(8, 8 + hlen).toString());
const sec = head.sections.find(s => s.name === 'height');
const ref = new Int16Array(buf.buffer.slice(buf.byteOffset + 8 + hlen + sec.offset, buf.byteOffset + 8 + hlen + sec.offset + sec.length * 2));
t = Date.now();
const T = terrain({ seed, scale, get, step: 1, tail: false });
console.log(`port ${Date.now() - t} ms, N ${T.N} (mapgen ${head.N})`);
let bad = 0, first = null;
for (let i = 0; i < ref.length; i++) if (ref[i] !== T.H[i]) { bad++; first ??= [i % T.N, Math.floor(i / T.N), ref[i], T.H[i]]; }
console.log(bad ? `MISMATCH ${bad} cells, first x ${first[0]} y ${first[1]}: mapgen ${first[2]} port ${first[3]}` : `exact: ${ref.length} cells match`);
process.exit(bad ? 1 : 0);
