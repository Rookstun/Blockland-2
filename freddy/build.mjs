// node freddy/build.mjs [FGF_DEBUG=1] -> freddy/freddy.brz (the owner's small cabinet, supersigmas/cabinet.mjs) + freddy_chip.brz.
// Load: br.Prefab.Load "freddy" x y z 0 16. Owner "Freddy Got Fingered" (own wire budget).
// Seat controls: Space / W jump, LMB / E kickflip, A W S D keys in the serenade, A / D answer in the pitch.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'freddy', title: 'FREDDY GOT FINGERED',
  owner: { id: 'f9f00000-0000-4b0b-9a11-00000000f9f0', name: 'Freddy Got Fingered', display_name: 'Freddy Got Fingered' },
  gen: generate({ debug: process.env.FGF_DEBUG === '1' }), pins: { a: 'jump', b: 'trick' },
});
