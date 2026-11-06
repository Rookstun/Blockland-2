// "A large plate in the sky above us" (comfycookie, 2026-11-06): a 64x64-stud floating deck, local, not a world lid
// (the "encase the world in darkness" version was turned down). node mapgen/skyplate.mjs X Y Z > job.json  (Z = deck bottom)
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000519a', name: 'Claude Sky Plate', display_name: 'Claude Sky Plate' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder();
const H = 320; // half size
B.slab(-H, -H, 0, H, H, 4, { asset: 'PB_DefaultMicroBrick', color: [70, 72, 80] }, 'deck', 320);
B.slab(-H, -H, 4, -H + 10, H, 8, { asset: 'PB_DefaultMicroBrick', color: [217, 119, 87] }, 'trim', 320);
B.slab(H - 10, -H, 4, H, H, 8, { asset: 'PB_DefaultMicroBrick', color: [217, 119, 87] }, 'trim', 320);
B.slab(-H + 10, -H, 4, H - 10, -H + 10, 8, { asset: 'PB_DefaultMicroBrick', color: [217, 119, 87] }, 'trim', 320);
B.slab(-H + 10, H - 10, 4, H - 10, H, 8, { asset: 'PB_DefaultMicroBrick', color: [217, 119, 87] }, 'trim', 320);
if (B.dropped.length) throw new Error(`skyplate: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`skyplate: ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
