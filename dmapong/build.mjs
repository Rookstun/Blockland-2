// node dmapong/build.mjs -> dmapong/dmapong.brz: Night Pong (Baseline240Engine) on 6 chips with DMA channels.
// Load: br.Prefab.Load "dmapong" x y z 0 16. Owner "NIGHT PONG DMA".
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDmaCabinet } from './cabinet.mjs';
// DMA_COPY=n builds dmapong<n>.brz with its own owner (d3a<n>), so each copy clears on its own
const n = process.env.DMA_COPY ?? '';
// engine names (Rookstun 2026-11-07): 120 x 80 = 30w20h120Engine, 180 x 120 = 30w20h180Engine (screen 30 x 20 micros)
const ENGINE = `30w20h${process.env.DMA_W ?? 120}Engine`;
await buildDmaCabinet({ dir: dirname(fileURLToPath(import.meta.url)), name: `dmapong${n}`, title: 'NIGHT PONG', cell: 20 / +(process.env.DMA_H ?? 80), // screen always 20 units tall
  owner: { id: `b0e60000-0000-4b0b-9a11-00000000d3a${n || 0}`, name: ENGINE, display_name: ENGINE } });
