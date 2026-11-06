// node linescreen/build.mjs -> linescreen/linescreen.brz (screen cabinet + chip). Load: br.Prefab.Load "linescreen" x y z 0 16.
// Owner "LINE SCREEN". Chip inputs a, b (vector) + /line x0 y0 x1 y1.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './wgen.mjs';
import { buildCabinet } from '../supersigmas/cabinet.mjs';

const cell = 0.25; // 64x96 pixels at 0.25 = a 16x24-unit screen (0.4-1 put cabinet parts off the unit grid)
await buildCabinet({
  dir: dirname(fileURLToPath(import.meta.url)), name: 'linescreen', title: 'LINE SCREEN', cell,
  owner: { id: 'f1a90000-0000-4b0b-9a11-0000000011e5', name: 'LINE SCREEN', display_name: 'LINE SCREEN' },
  gen: generate({ cell }), pins: { a: 'ba', b: 'bb' },
});
