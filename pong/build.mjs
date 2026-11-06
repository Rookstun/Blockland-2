// node pong/build.mjs (pure wires, no host) -> pong/pong.brz (cabinet) + pong_chip.brz. Load: br.Prefab.Load "pong" x y z 0 16. Owner "PONG".
// PG_CELL=0.1 node pong/build.mjs -> pong/pong20.brz, owner "PONG 20" (Rookstun's 20x20-a-micro-brick test; own owner = own clear)
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './wgen.mjs'; // pure-wire game (Rookstun 2026-11-05); ./gen.mjs = the server-host version
import { buildCabinet } from '../supersigmas/cabinet.mjs';

const cell = +(process.env.PG_CELL ?? 0.2), alt = cell !== 0.2; // 0.2 = 10x10 pixels a micro brick (16 per micro could not render: font floor), 48x32 screen, 20-row strips
await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: alt ? `pong${Math.round(2 / cell)}` : 'pong', title: 'NIGHT PONG', cell,
  owner: alt ? { id: 'b0e60000-0000-4b0b-9a11-00000000b020', name: 'PONG 20', display_name: 'PONG 20' } : { id: 'b0e60000-0000-4b0b-9a11-00000000b0e6', name: 'PONG', display_name: 'PONG' },
  gen: generate({ debug: process.env.PG_DEBUG === '1', cell }), pins: { a: 'ba', b: 'bb' },
});
