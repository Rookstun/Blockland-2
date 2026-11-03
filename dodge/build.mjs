// node dodge/build.mjs [DD_DEBUG=1] -> dodge/dodge.brz (small cabinet, supersigmas/cabinet.mjs) + dodge_chip.brz.
// Load: br.Prefab.Load "dodge" x y z 0 16. W A S D move, collect every coin, reach the green zone, dodge the purple dots.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'dodge', title: 'DODGE DOTS',
  owner: { id: 'd0d90000-0000-4b0b-9a11-00000000d0d9', name: 'Dodge Dots', display_name: 'Dodge Dots' },
  gen: generate({ debug: process.env.DD_DEBUG === '1' }), pins: { a: 'a', b: 'b' },
});
