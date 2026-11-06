// node dvi/build.mjs -> dvi/dvi.brz (cabinet) + dvi_chip.brz. Load: br.Prefab.Load "dvi" x y z 0 16. Owner "DANIEL VS ISIS".
// DV_DEBUG=1 adds /dvdump, /dvsit (play as if seated), /dvgo (start without Space).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'dvi', title: 'DANIEL VS ISIS', cell: 0.2,
  owner: { id: 'd5100000-0000-4b0b-9a11-00000000d510', name: 'DANIEL VS ISIS', display_name: 'DANIEL VS ISIS' },
  gen: generate({ debug: process.env.DV_DEBUG === '1' }), pins: { a: 'ba', b: 'bb' },
});
