// standalone build of one surface keep (2026-10-25): node mapgen/keepprev.mjs out.json [dungeon=keep] [seed]
// Same inputs mapgen.mjs gives planSurfaceDungeon for that dungeon (side fixed to the
// live Sunken Keep's gate, -y). Bricks are in keep-local units, z 0 = the paving top;
// a sand plate under them. Checks overlaps with builder.mjs; view with isoview.mjs.
import fs from 'fs';
import { buildDungeon, THEMES } from './dungeon.mjs';
import { planSurfaceDungeon } from './surfacedungeon.mjs';
import { makeBuilder } from './builder.mjs';
const [out, which = 'keep', seedArg] = process.argv.slice(2);
const SEED = Number(seedArg ?? 2029224243), CELL = 40, SPC = CELL / 10, C = 51;
const D = { crypt: { levels: 3, seed: SEED + 1 }, keep: { levels: 4, seed: SEED + 2 }, deep: { levels: 5, seed: SEED + 3 } }[which];
const dun = buildDungeon({ levels: D.levels, seed: D.seed, theme: which, spawnChance: 0.35 });
const [ex0, ey0, ex1, ey1] = dun.entrance;
const k = planSurfaceDungeon({
  seed: D.seed * 7 + 3, hole: [ex0 / 10, ey0 / 10, ex1 / 10, ey1 / 10], side: [0, -1],
  bounds: [3 * SPC, 3 * SPC, (C - 3) * SPC, (C - 3) * SPC], grid: 10 + D.levels, rooms: 3 + D.levels, theme: THEMES[which],
});
const B = makeBuilder();
for (const b of k.bricks) B.add(b, b.asset ?? 'brick');
const [x0, y0, x1, y1] = k.extent;
B.add({ asset: 'PB_DefaultBrick', size: [(x1 - x0) * 5 + 100, (y1 - y0) * 5 + 100, 6], position: [(x0 + x1) * 5, (y0 + y1) * 5, -6], color: [226, 192, 128] }, 'plate');
console.log(`${k.rooms} rooms, ${k.bricks.length} bricks, ${k.spawns.length} spawns, pots ${JSON.stringify(k.pots ?? [])}, dropped ${B.dropped.length}`, B.dropped.slice(0, 8));
fs.writeFileSync(out, JSON.stringify(B.bricks));
fs.writeFileSync(out.replace(/\.json$/, '.meta.json'), JSON.stringify({ extent: k.extent, gate: k.gate, pots: k.pots ?? [], spawns: k.spawns, hall: k.hall }));
