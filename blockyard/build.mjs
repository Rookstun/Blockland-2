// node blockyard/build.mjs -> blockyard/blockyard.brz. Load: br.Prefab.Load "blockyard" x y z 0 16. Owner "BLOCK YARD".
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './wgen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

const cell = 0.5; // 160x96 pixels = an 80x48-unit screen
await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'blockyard', title: 'BLOCK YARD', cell,
  owner: { id: 'f1a90000-0000-4b0b-9a11-0000000b10c5', name: 'BLOCK YARD', display_name: 'BLOCK YARD' },
  gen: generate({ cell }), pins: { a: 'ba', b: 'bb' },
});
