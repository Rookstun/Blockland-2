// Live swap of the lot signs (2026-10-19): the old "LOT n /plot" plaques -> the owner's FOR SALE sign.
//   node realestate/signs.mjs [realestate/site] -> DIR/signclear.json (ClearRegion boxes: old post + plaque)
//                                               + DIR/signs.json (one bricks op, map owner)
// Same placement as plots.mjs (post outside the bank on the side facing the plaza).
import { readFileSync, writeFileSync } from 'node:fs';
import { EXTERNAL_ASSETS, plaque } from '../mapgen/ruins.mjs';
import { worldBox } from '../mapgen/orient.mjs';
import { saleSign, SIGN_FONT } from './salesign.mjs';

const DIR = process.argv[2] ?? new URL('site', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SPAWN = [-120, 160], BANK = 30;
const ASSETS = [...EXTERNAL_ASSETS, SIGN_FONT];
const plots = JSON.parse(readFileSync(`${DIR}/plots.json`, 'utf8'));
const clears = [], bricks = [];
for (const p of plots) {
  const { id, x, y, ground: g, half: I } = p, B = BANK;
  const fx = Math.abs(SPAWN[0] - x) > Math.abs(SPAWN[1] - y) ? Math.sign(SPAWN[0] - x) : 0, fy = fx ? 0 : Math.sign(SPAWN[1] - y);
  const ox = x + fx * (I + B + 10) + (fy ? -I + 40 : 0), oy = y + fy * (I + B + 10) + (fx ? I - 40 : 0);
  const old = [{ asset: 'PB_DefaultMicroBrick', size: [4, 4, 26], position: [ox, oy, g + 26] }];
  plaque({ put: (b, px, py, pz) => old.push({ ...b, position: [px, py, pz] }), text: '', facing: [fx, fy], x: ox + fx * 5, y: oy + fy * 5, z: g + 40, w: 30, h: 14 });
  for (const b of old) { const [lo, hi] = worldBox(b); clears.push(lo.map((v, i) => (v + hi[i]) / 2).concat(hi.map((v, i) => (v - lo[i]) / 2 + 1))); }
  bricks.push(...saleSign(id, ox, oy, g, [fx, fy], ASSETS.length - 1));
}
writeFileSync(`${DIR}/signclear.json`, JSON.stringify(clears));
writeFileSync(`${DIR}/signs.json`, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], captureMs: 2500, externalAssets: ASSETS,
  owner: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' }, bricks }] }));
console.log(plots.length, 'lots,', clears.length, 'clears,', bricks.length, 'sign bricks');
console.log(JSON.stringify(clears));
