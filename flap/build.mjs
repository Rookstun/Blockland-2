// node flap/build.mjs -> flap/flap.brz (cabinet + chip). Load: br.Prefab.Load "flap" x y z 0 16. Owner "SOGGY SPARROW".
// FS_DEBUG=1 adds /fsdump /fssit /fsflap.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './wgen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

const cell = 0.4; // 120x80 pixels at 0.4 = the same 48x32-unit screen as Night Pong
await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'flap', title: 'SOGGY SPARROW', cell,
  owner: { id: 'f1a90000-0000-4b0b-9a11-00000000f1a9', name: 'SOGGY SPARROW', display_name: 'SOGGY SPARROW' },
  gen: generate({ debug: process.env.FS_DEBUG === '1', cell }), pins: { a: 'ba', b: 'bb' },
});
