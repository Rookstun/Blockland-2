// node rotorraid/build.mjs -> rotorraid/rotorraid.brz: ROTOR RAID on the DMA cabinet (dmapong/cabinet.mjs, game = ./gen.mjs).
// Load: br.Prefab.Load "rotorraid" x y z 0 16. Owner ROTOR RAID.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDmaCabinet } from '../dmapong/cabinet.mjs';
import * as game from './gen.mjs';
// RR_W=180 RR_H=120 -> rotorraid180.brz, its own owner (copy beside the 120 x 80 one, Rookstun). Screen always 30 x 20 units.
const big = game.W !== 120, tag = big ? `${game.W}` : '';
await buildDmaCabinet({ dir: dirname(fileURLToPath(import.meta.url)), name: `rotorraid${tag}`, title: 'ROTOR RAID', cell: 20 / game.H, game,
  owner: { id: `b0e60000-0000-4b0b-9a11-0000000a07${big ? 'b2' : 'a1'}`, name: `RotorRaid FastCabinetRender${big ? ' ' + game.W + 'x' + game.H : ''}`, display_name: `RotorRaid FastCabinetRender${big ? ' ' + game.W + 'x' + game.H : ''}` } });
