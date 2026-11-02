// Furniture pieces for the house generators (2026-11-02, руся in game: 9 modern pieces on red plates, "use it to
// size rooms accurately"; owner: "internalize the furniture pieces and add them as a design pattern available to
// housegen pipeline"). Catalog = refs/furniture.json (each piece's bricks relative to its own footprint centre, z 0 =
// the floor it stands on; names are guesses until руся names them).
//   piece(key)                     -> { key, dims, rooms, back, bricks, mount }   back = the side its tallest part is on;
//                                     mount 'ceiling' = hangs: place it at z = ceiling underside - dims[2]
//   footprint(key, turn)           -> [w, d] after `turn` quarter turns (anticlockwise)
//   placeFurniture(B, key, x, y, z, turn, label) -> true if every brick went in (nothing is added otherwise)
//   facing(key, side)              -> the turn that puts the piece's back against a wall on `side` (x0 x1 y0 y1)
//   node mapgen/rusfurniture.mjs   self-check: every turn keeps each brick's world box = the turned box
import fs from 'fs';
import { turnBrick, worldBox } from './orient.mjs';

const CAT = JSON.parse(fs.readFileSync(new URL('./refs/furniture.json', import.meta.url)));
const SIDES = { x0: [-1, 0], x1: [1, 0], y0: [0, -1], y1: [0, 1] };

const backOf = bricks => {
  // the side whose outer quarter holds the most volume above half height
  const boxes = bricks.map(b => worldBox(b)), top = Math.max(...boxes.map(([, h]) => h[2])), hi = boxes.filter(([, h]) => h[2] > top / 2);
  const lo = [0, 1].map(i => Math.min(...boxes.map(([l]) => l[i]))), up = [0, 1].map(i => Math.max(...boxes.map(([, h]) => h[i])));
  const vol = (pred) => hi.filter(pred).reduce((s, [l, h]) => s + (h[0] - l[0]) * (h[1] - l[1]) * (h[2] - l[2]), 0);
  const q = i => (up[i] - lo[i]) / 4;
  const score = { x0: vol(([l]) => l[0] < lo[0] + q(0)), x1: vol(([, h]) => h[0] > up[0] - q(0)), y0: vol(([l]) => l[1] < lo[1] + q(1)), y1: vol(([, h]) => h[1] > up[1] - q(1)) };
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
};
export const PIECES = Object.fromEntries(Object.entries(CAT.pieces).map(([key, p]) => [key, { key, ...p, back: backOf(p.bricks) }]));
export const piece = key => PIECES[key];
export const footprint = (key, turn = 0) => (turn % 2 ? [PIECES[key].dims[1], PIECES[key].dims[0]] : PIECES[key].dims.slice(0, 2));

// quarter turns (anticlockwise) taking direction a to direction b
const turnsTo = (a, b) => { let [x, y] = SIDES[a]; for (let t = 0; t < 4; t++) { if (x === SIDES[b][0] && y === SIDES[b][1]) return t; [x, y] = [-y, x]; } };
export const facing = (key, side) => turnsTo(PIECES[key].back, side);

export function placeFurniture(B, key, x, y, z, turn = 0, label = 'furniture ' + key) {
  const bs = PIECES[key].bricks.map(b => turnBrick(b, turn)).map(b => ({ ...b, position: [b.position[0] + x, b.position[1] + y, b.position[2] + z] }));
  const boxes = bs.map(b => worldBox(b)), lo = [0, 1, 2].map(i => Math.min(...boxes.map(([l]) => l[i]))), hi = [0, 1, 2].map(i => Math.max(...boxes.map(([, h]) => h[i])));
  if (!B.free(lo, hi)) return false;
  // the captured pieces hold a few bricks the game let overlap (duplicates, wedge pairs sharing a box): those give way
  for (const b of bs) if (!B.add(b, label) && !B.dropped.at(-1).includes(`hits ${label}`)) throw new Error(`furniture ${key}: brick dropped inside a free box: ${B.dropped.at(-1)}`);
  return true;
}

if (process.argv[1]?.endsWith('rusfurniture.mjs')) {
  let bad = 0;
  for (const p of Object.values(PIECES)) {
    for (let t = 1; t < 4; t++) for (const b of p.bricks) {
      const [l, h] = worldBox(b), [l2, h2] = worldBox(turnBrick(b, t));
      const corners = [[l[0], l[1]], [h[0], h[1]]].map(([x, y]) => { for (let i = 0; i < t; i++) [x, y] = [-y, x]; return [x, y]; });
      const want = [Math.min(corners[0][0], corners[1][0]), Math.min(corners[0][1], corners[1][1]), Math.max(corners[0][0], corners[1][0]), Math.max(corners[0][1], corners[1][1])];
      if ([l2[0], l2[1], h2[0], h2[1]].some((v, i) => Math.abs(v - want[i]) > 1e-6) || l2[2] !== l[2] || h2[2] !== h[2]) bad++;
    }
    const [w, d] = footprint(p.key, 1);
    console.log(`${p.key.padEnd(12)} ${p.dims.join('x').padEnd(10)} ${p.bricks.length} bricks, back ${p.back}, turned ${w}x${d}, rooms ${p.rooms.join('/')}`);
  }
  console.log(bad ? `FAIL ${bad} turned boxes wrong` : 'turns OK');
  process.exit(bad ? 1 : 0);
}
