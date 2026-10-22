// node supersigmas/build.mjs [SS_DEBUG=1] -> supersigmas/supersigmas.brz (cabinet) + supersigmas_chip.brz (chip alone).
// Load: br.Prefab.Load "supersigmas" x y z 0 16. Owner "Super Sigmas" (own wire budget).
// Seat controls: WASD move, left mouse / E mog, Space / right mouse rizz (and start).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from './cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'supersigmas', title: 'SUPER SIGMAS',
  owner: { id: '5191a500-0000-4b0b-9a11-0000005191a5', name: 'Super Sigmas', display_name: 'Super Sigmas' },
  gen: generate({ debug: process.env.SS_DEBUG === '1' }), pins: { a: 'rizz', b: 'mog' },
});
