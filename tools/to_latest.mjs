// Converts an old-format (EA3) prefab to the game's "Latest" save format (game update
// EA3.2, 2026-10-15): the wirescript compiler and brs-js 3 still write EA3, and the new
// game fails to Prefab.Load chips whose Var gates hold maps ("While reading field Value:
// While reading dynamic map length: mpack_error_type"; skeleton_drop). brs-js 4 migrates.
//   node tools/to_latest.mjs in.brz out.brz          (brs-js 4 dist in tools/brs4, gitignored)
import fs from 'fs';
const m = await import(new URL('./brs4/dist.mjs', import.meta.url));
const [IN, OUT] = process.argv.slice(2);
const src = m.WorldReader.from(fs.readFileSync(IN));
const steps = m.brdb.pendingSteps(src);
console.log('migration steps:', steps.length);
const out = steps.length ? m.brdb.writeBrzContainer(m.brdb.toLatest(src)) : fs.readFileSync(IN);
// read back: same bricks per grid, components and wires readable
const chk = m.WorldReader.from(out);
let a = 0, b = 0;
for (const g of src.gridIds()) a += [...src.bricks(g)].length;
for (const g of chk.gridIds()) b += [...chk.bricks(g)].length;
console.log('grids', src.gridIds().length, '->', chk.gridIds().length, 'bricks', a, '->', b, 'entities', [...src.entities()].length, '->', [...chk.entities()].length);
if (a !== b) throw new Error('brick count changed');
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, out.length, 'bytes; still needs migration:', m.brdb.needsMigration(m.WorldReader.from(out)));
