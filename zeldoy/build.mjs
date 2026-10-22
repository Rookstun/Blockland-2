// node zeldoy/build.mjs [ZD_DEBUG=1] -> zeldoy/zeldoy.brz (the owner's small cabinet, supersigmas/cabinet.mjs)
// + zeldoy_chip.brz. Load: br.Prefab.Load "zeldoy" x y z 0 16. Owner "Zeldoy" (own wire budget).
// Seat controls: WASD walk, left mouse / E sword, Space / right mouse meds pouch (inhaler / insulin / candy, whichever you need).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'zeldoy', title: 'ZELDOY',
  owner: { id: '2e1d0000-0000-4b0b-9a11-000000002e1d', name: 'Zeldoy', display_name: 'Zeldoy' },
  gen: generate({ debug: process.env.ZD_DEBUG === '1' }), pins: { a: 'item', b: 'swing' },
});
