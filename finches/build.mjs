// node finches/build.mjs [FI_DEBUG=1] -> finches/finches.brz (small cabinet, supersigmas/cabinet.mjs) + finches_chip.brz.
// Load: br.Prefab.Load "finches" x y z 0 16. W/S aim, hold Space/LMB and release to fling the finch at the hogs.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'finches', title: 'GRUMPY FINCHES',
  owner: { id: 'f17c0000-0000-4b0b-9a11-00000000f17c', name: 'Grumpy Finches', display_name: 'Grumpy Finches' },
  gen: generate({ debug: process.env.FI_DEBUG === '1' }), pins: { a: 'a', b: 'b' },
});
