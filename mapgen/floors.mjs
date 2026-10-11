// Floors and ceilings, one module (owner 2026-10-05: "modularize the floors").
//
// A style names a pattern (how a set of stud cells is cut into pieces), the
// brick asset and the colours. Every generator lays its floors through
// floorPieces(): shapedhouse.mjs (houses), town.mjs (wallgen houses/shops and
// building(): keep, bank, tavern, church) and mapgen.mjs (street paving). To
// change how a floor looks, change it here.
//
// Cells are stud cells "x,y" (Set). Pieces are half-open stud rects
// { x0, y0, x1, y1, brick }, where brick = { asset, color, ...extra } (no size
// or position: the caller places it at its own z and scale).
//
// Patterns (cutters in tools/wallgen/lib.js, except checker):
//   checker      sq x sq squares on the global stud grid, colour by parity;
//                a square a room edge cuts is covered with as few rects as fit
//   planks       1-stud boards along the longer side, staggered joints
//   herringbone  1 x 2 tiles in zigzag rows
//   tiles        greedy plates up to maxSide

import { createRequire } from 'module';
const lib = createRequire(import.meta.url)('../tools/wallgen/lib.js');

const MB = 'PB_DefaultMicroBrick', TILE = 'PB_DefaultTile';
// face-down tiles: the smooth face shows from below (no studded undersides)
const FACE_DOWN = { direction: 5, rotation: 0 };

export const STYLES = {
  checker:        { pattern: 'checker', sq: 2, asset: TILE, colors: [[232, 226, 212], [58, 56, 56]] },           // cream / charcoal
  checkerCeiling: { pattern: 'checker', sq: 2, asset: TILE, colors: [[238, 234, 224], [178, 172, 162]], extra: FACE_DOWN },
  hallChecker:    { pattern: 'checker', sq: 4, asset: TILE, colors: [[206, 200, 188], [120, 116, 110]] },        // big halls; pass colors to recolour
  planks:         { pattern: 'planks', maxLen: 12, asset: MB, colors: [[160, 114, 72]] },                        // shapedhouse boards
  townPlanks:     { pattern: 'planks', maxLen: 12, asset: MB, colors: [[150, 104, 64], [134, 92, 56], [160, 114, 72]] },
  terracotta:     { pattern: 'herringbone', asset: TILE, colors: [[224, 85, 75], [212, 80, 70], [230, 96, 82], [204, 78, 66]] },
  paving:         { pattern: 'herringbone', asset: TILE, colors: [[164, 156, 142], [152, 146, 134], [174, 166, 150], [158, 148, 130], [146, 140, 132]] },
};

const key = (x, y) => x + ',' + y;
/** the stud cells of a half-open stud rect */
export function cellsOfRect(x0, y0, x1, y1) {
  const out = new Set();
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) out.add(key(x, y));
  return out;
}

// deterministic colour pick for a piece (a small integer hash)
function hash(a, b, c) {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

function checkerRects(cells, sq) {
  const sqs = new Map();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    const sk = key(Math.floor(x / sq), Math.floor(y / sq));
    (sqs.get(sk) ?? sqs.set(sk, new Set()).get(sk)).add(k);
  }
  const out = [];
  for (const [sk, part] of sqs) {
    const [sx, sy] = sk.split(',').map(Number), par = ((sx + sy) % 2 + 2) % 2;
    for (const r of lib.tileRects(part, sq)) out.push({ ...r, par });
  }
  return out;
}

/**
 * floorPieces(cells, style, { salt, colors, asset, extra }): cut `cells` by
 * the style's pattern and give each piece its brick. `style` is a STYLES key
 * or a style object; the options override its colours / asset / extra props.
 */
// pick(rect, colors): optional colour chooser, to keep an existing layout's colours
export function floorPieces(cells, style, { salt = 0, pick = null, ...over } = {}) {
  const st = { ...(typeof style === 'string' ? STYLES[style] : style), ...over };
  if (!st.pattern) throw new Error(`floors: unknown style ${style}`);
  const rects = st.pattern === 'checker' ? checkerRects(cells, st.sq ?? 2)
    : st.pattern === 'planks' ? lib.plankRects(cells, st.maxLen ?? 12, salt)
    : st.pattern === 'herringbone' ? lib.herringboneRects(cells)
    : st.pattern === 'tiles' ? lib.tileRects(cells, st.maxSide ?? 32)
    : null;
  if (!rects) throw new Error(`floors: unknown pattern ${st.pattern}`);
  const C = st.colors;
  return rects.map(r => ({
    x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
    brick: { asset: st.asset, color: pick ? pick(r, C) : st.pattern === 'checker' ? C[r.par % C.length] : C[C.length === 1 ? 0 : hash(r.x0, r.y0, salt + 91) % C.length], ...(st.extra ?? {}) },
  }));
}
