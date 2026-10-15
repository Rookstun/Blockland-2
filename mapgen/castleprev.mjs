// standalone preview of castle.mjs stonework (2026-10-15): node mapgen/castleprev.mjs out.json
// keep stand-in = a plain box where town.mjs building() puts the keep; check with isoview.mjs
import fs from 'fs';
import { castleStone } from './castle.mjs';
import { makeBuilder } from './builder.mjs';
const keep = { i0: -20, j0: -3, i1: 20, j1: 29, kTop: 72 };
const { bricks, extra } = castleStone(9100, keep);
const B = makeBuilder();
B.add({ asset: 'PB_DefaultMicroBrick', size: [200, 160, 216], position: [0, 130, 216], color: [154, 150, 142] }, 'keep');
for (const b of bricks) B.add(b, b.asset);
console.log(bricks.length, 'bricks', extra.length, 'extras, dropped', B.dropped.length, B.dropped.slice(0, 5));
fs.writeFileSync(process.argv[2], JSON.stringify([...B.bricks ?? []]));
