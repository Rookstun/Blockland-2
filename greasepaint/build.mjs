// node greasepaint/build.mjs [GP_DEBUG=1] -> greasepaint/greasepaint.brz (the owner's small cabinet,
// supersigmas/cabinet.mjs) + greasepaint_chip.brz. Load: br.Prefab.Load "greasepaint" x y z 0 16. Owner "Greasepaint" (own wire budget).
// Seat controls: WASD sneak, LMB / E hold behind a hunter = execute (tap elsewhere = hit/shoot), Space / RMB honk (lure), start.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'greasepaint', title: 'GREASEPAINT',
  owner: { id: '96ea5e00-0000-4b0b-9a11-0000096ea5e0', name: 'Greasepaint', display_name: 'Greasepaint' },
  gen: generate({ debug: process.env.GP_DEBUG === '1' }), pins: { a: 'honk', b: 'act' },
});
