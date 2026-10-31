// node nes/build.mjs -> nes/nes.brz (cabinet) + nes_chip.brz. Load: br.Prefab.Load "nes" x y z 0 16. Owner "NES" (own wire budget).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'nes', title: 'NES',
  owner: { id: 'e5000000-0000-4b0b-9a11-00000000e500', name: 'NES', display_name: 'NES' },
  gen: generate({ debug: process.env.NES_DEBUG === '1' }), pins: { a: 'ba', b: 'bb' },
});
