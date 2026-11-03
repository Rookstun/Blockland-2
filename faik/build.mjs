// node faik/build.mjs [FK_DEBUG=1] -> faik/faik.brz (small cabinet, supersigmas/cabinet.mjs) + faik_chip.brz.
// Load: br.Prefab.Load "faik" x y z 0 16. A/D walk, W or Space jump (also starts); collect every coin, reach the door.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'faik', title: 'FAIK PLATFORMER',
  owner: { id: 'fa1c0000-0000-4b0b-9a11-00000000fa1c', name: 'Faik Platformer', display_name: 'Faik Platformer' },
  gen: generate({ debug: process.env.FK_DEBUG === '1' }), pins: { a: 'a', b: 'b' },
});
