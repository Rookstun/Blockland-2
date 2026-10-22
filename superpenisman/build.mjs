// node superpenisman/build.mjs [SPM_DEBUG=1] -> superpenisman/superpenisman.brz (the owner's small cabinet,
// supersigmas/cabinet.mjs) + superpenisman_chip.brz. Load: br.Prefab.Load "superpenisman" x y z 0 16.
// Owner "Super Penis Man" (own wire budget). Seat controls: W A S D fly, LMB / E laser vision (hold), Space / RMB THE BIG ONE.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'superpenisman', title: 'SUPER PENIS MAN',
  owner: { id: '59e00000-0000-4b0b-9a11-0000000059e0', name: 'Super Penis Man', display_name: 'Super Penis Man' },
  gen: generate({ debug: process.env.SPM_DEBUG === '1' }), pins: { a: 'big', b: 'fire' },
});
