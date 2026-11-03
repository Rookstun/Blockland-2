// node parry/build.mjs [PR_DEBUG=1] -> parry/parry.brz (small cabinet, supersigmas/cabinet.mjs) + parry_chip.brz.
// Load: br.Prefab.Load "parry" x y z 0 16. Sit down; when the attack tile flashes WHITE press Space/RMB (high) or LMB/E (low).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'parry', title: 'PARRY OR PERISH',
  owner: { id: 'a77e0000-0000-4b0b-9a11-00000000a77e', name: 'Parry or Perish', display_name: 'Parry or Perish' },
  gen: generate({ debug: process.env.PR_DEBUG === '1' }), pins: { a: 'a', b: 'b' },
});
