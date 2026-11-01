// node thirteen/build.mjs [TC_DEBUG=1] -> thirteen/thirteen.brz (small cabinet, supersigmas/cabinet.mjs) + thirteen_chip.brz.
// Load: br.Prefab.Load "thirteen" x y z 0 16. Walk a memorial for the 13 killed at Columbine: WASD walk, Space start/restart.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'thirteen', title: 'THIRTEEN CANDLES',
  owner: { id: '13c00000-0000-4b0b-9a11-000000000013', name: 'Thirteen Candles', display_name: 'Thirteen Candles' },
  gen: generate({ debug: process.env.TC_DEBUG === '1' }), pins: { a: 'item', b: 'swing' },
});
