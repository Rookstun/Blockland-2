// node clown/build.mjs [SPM_DEBUG=1] -> clown/clown.brz (the owner's small cabinet,
// supersigmas/cabinet.mjs) + clown_chip.brz. Load: br.Prefab.Load "clown" x y z 0 16.
// Owner "Super Penis Man" (own wire budget). Seat controls: W A S D float, LMB / E eat (hold), Space / RMB rip-half.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'clown', title: 'CRACK CLOWN',
  owner: { id: 'c10a0000-0000-4b0b-9a11-00000000c10a', name: 'Crack Clown', display_name: 'Crack Clown' },
  gen: generate({ debug: process.env.SPM_DEBUG === '1' }), pins: { a: 'big', b: 'fire' },
});
