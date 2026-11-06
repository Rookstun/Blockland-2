// node pong/build.mjs (pure wires, no host) -> pong/pong.brz (cabinet) + pong_chip.brz. Load: br.Prefab.Load "pong" x y z 0 16. Owner "PONG".
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './wgen.mjs'; // pure-wire game (Rookstun 2026-11-05); ./gen.mjs = the server-host version
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'pong', title: 'PONG', cell: 2, // 1 pixel = 1 micro brick (2 units), Rookstun 2026-11-05: 320x480 screen
  owner: { id: 'b0e60000-0000-4b0b-9a11-00000000b0e6', name: 'PONG', display_name: 'PONG' },
  gen: generate({ debug: process.env.PG_DEBUG === '1' }), pins: { a: 'ba', b: 'bb' },
});
