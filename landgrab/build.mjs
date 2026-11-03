// node landgrab/build.mjs [LG_DEBUG=1] -> landgrab/landgrab.brz (4-seat cabinet, landgrab/cabinet4.mjs) + landgrab_chip.brz.
// Load: br.Prefab.Load "landgrab" x y z 0 16. Sit in any of the 4 seats, WASD, close a loop to claim the land inside.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet4 } from './cabinet4.mjs';

await buildCabinet4({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'landgrab', title: 'LAND GRAB',
  owner: { id: '1a9d0000-0000-4b0b-9a11-000000001a9d', name: 'Land Grab', display_name: 'Land Grab' },
  gen: generate({ debug: process.env.LG_DEBUG === '1' }),
});
