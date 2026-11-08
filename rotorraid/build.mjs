// node rotorraid/build.mjs -> rotorraid/rotorraid.brz: ROTOR RAID on the DMA cabinet (dmapong/cabinet.mjs, game = ./gen.mjs).
// Load: br.Prefab.Load "rotorraid" x y z 0 16. Owner ROTOR RAID.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDmaCabinet } from '../dmapong/cabinet.mjs';
import * as game from './gen.mjs';
await buildDmaCabinet({ dir: dirname(fileURLToPath(import.meta.url)), name: 'rotorraid', title: 'ROTOR RAID', cell: 1 / 4, game, // 120 x 80 on the same 30 x 20 screen (Rookstun)
  owner: { id: 'b0e60000-0000-4b0b-9a11-0000000a07a1', name: 'RotorRaid FastCabinetRender', display_name: 'RotorRaid FastCabinetRender' } });
