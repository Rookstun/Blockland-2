// node brickdoom/build.mjs [BD_DEBUG=1] -> brickdoom/brickdoom.brz (the owner's small cabinet, supersigmas/cabinet.mjs)
// + brickdoom_chip.brz. Load: br.Prefab.Load "brickdoom" x y z 0 16. Owner "Brick Doom" (own wire budget).
// Seat controls: W/S walk, A/D turn, left mouse / E shoot (hold), Space / right mouse use (doors, switch, start).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'brickdoom', title: 'BRICK DOOM',
  owner: { id: 'b0d00000-0000-4b0b-9a11-00000000b0d0', name: 'Brick Doom', display_name: 'Brick Doom' },
  gen: generate({ debug: process.env.BD_DEBUG === '1' }), pins: { a: 'use', b: 'fire' },
});
