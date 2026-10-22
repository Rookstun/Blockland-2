// node itwasntme/build.mjs [IWM_DEBUG=1] -> itwasntme/itwasntme.brz (the owner's small cabinet, supersigmas/cabinet.mjs)
// + itwasntme_chip.brz. Load: br.Prefab.Load "itwasntme" x y z 0 16. Owner "It Wasnt Me" (own wire budget).
// Seat controls: WASD walk, left mouse / E swing, Space / right mouse grab / drop / (hold at your bed) cry.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'itwasntme', title: "IT WASN'T ME",
  owner: { id: '1a5e0000-0000-4b0b-9a11-000000001a5e', name: 'It Wasnt Me', display_name: "It Wasn't Me" },
  gen: generate({ debug: process.env.IWM_DEBUG === '1' }), pins: { a: 'grab', b: 'swing' },
});
