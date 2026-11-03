// node bogey/build.mjs [BN_DEBUG=1] -> bogey/bogey.brz (cabinet, 96x54 picture at 1/3-unit cells) + bogey_chip.brz.
// Load: br.Prefab.Load "bogey" x y z 0 16. W/S pitch, A/D bank, LMB/E guns, Space/RMB missile, Q flares, C chaff.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, CELL } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'bogey', title: 'BOGEY NIGHTS',
  owner: { id: 'b0e90000-0000-4b0b-9a11-00000000b0e9', name: 'Bogey Nights', display_name: 'Bogey Nights' },
  gen: generate({ debug: process.env.BN_DEBUG === '1' }), pins: { a: 'a', b: 'b' },
  cell: CELL, extra: { q: 'bPressedQ', c: 'bPressedC' },
});
