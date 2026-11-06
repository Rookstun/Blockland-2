// "Something unforgivable" (comfycookie, 2026-11-06): a giant pineapple pizza on a wooden board, crust ring, sauce,
// cheese, pineapple chunks and ham. node mapgen/pineapplepizza.mjs X Y Z
import { makeBuilder, rng } from './builder.mjs';

const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-00000000f122', name: 'Claude Unforgivable', display_name: 'Claude Unforgivable' };
const [X = 0, Y = 0, Z = 0] = process.argv.slice(2).map(Number);
const B = makeBuilder({ cell: 200 });
const rand = rng(404);
const MB = 'PB_DefaultMicroBrick';
const m = c => ({ asset: MB, color: c });
const R = 150, ev = v => Math.round(v / 2) * 2;
const ring = (r0, r1, z0, z1, c, l) => { for (let y = -r1; y < r1; y += 4) { const yo = Math.abs(y + 2), wo = ev(Math.sqrt(Math.max(0, r1 * r1 - yo * yo))), wi = yo < r0 ? ev(Math.sqrt(r0 * r0 - yo * yo)) : 0; if (wo <= 0) continue; if (wi <= 0) B.box(-wo, y, z0, wo, y + 4, z1, m(c), l); else { B.box(-wo, y, z0, -wi, y + 4, z1, m(c), l); B.box(wi, y, z0, wo, y + 4, z1, m(c), l); } } };
B.box(-R - 20, -R - 20, 0, R + 20, R + 20, 6, m([150, 110, 70]), 'board');
ring(0, R - 14, 6, 10, [190, 50, 30], 'sauce');
ring(R - 14, R, 6, 16, [210, 160, 90], 'crust');
ring(0, R - 18, 10, 12, [245, 215, 120], 'cheese');
for (let n = 0; n < 70; n++) { const a = rand() * 6.28, r = rand() * (R - 30), x = ev(Math.cos(a) * r), y = ev(Math.sin(a) * r); B.box(x - 4, y - 4, 12, x + 4, y + 4, 16, m(n % 3 ? [250, 220, 60] : [220, 120, 130]), n % 3 ? 'pineapple' : 'ham'); }
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`pineapplepizza: ${bricks.length} bricks (${B.dropped.length} skipped) at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
