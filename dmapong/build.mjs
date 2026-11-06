// node dmapong/build.mjs -> dmapong/dmapong.brz: Night Pong (Baseline240Engine) on 6 chips with DMA channels.
// Load: br.Prefab.Load "dmapong" x y z 0 16. Owner "NIGHT PONG DMA".
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDmaCabinet } from './cabinet.mjs';
// DMA_COPY=n builds dmapong<n>.brz with its own owner (d3a<n>), so each copy clears on its own
const n = process.env.DMA_COPY ?? '';
await buildDmaCabinet({ dir: dirname(fileURLToPath(import.meta.url)), name: `dmapong${n}`, title: 'NIGHT PONG',
  owner: { id: `b0e60000-0000-4b0b-9a11-00000000d3a${n || 0}`, name: `NIGHT PONG DMA${n ? ' ' + n : ''}`, display_name: `NIGHT PONG DMA${n ? ' ' + n : ''}` } });
