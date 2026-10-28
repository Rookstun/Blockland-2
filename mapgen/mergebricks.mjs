// Merge neighbouring identical bricks into one longer brick (2026-10-27, owner: "neighboring bricks that could be
// extended should be extended ... I don't want any of the color rules to change"): two bricks merge only when every
// field but position/size matches (asset, orientation, colour, material, collision...) and they share a whole face.
// Micro wedges only along their prism axis (local z: the slope profile is the same all along it); plain boxes along x, y, z.
import { ORIENT, worldBox } from './orient.mjs';

const BOXES = new Set(['PB_DefaultMicroBrick', 'PB_DefaultBrick', 'PB_DefaultTile', 'PB_DefaultSmoothTile']);
const MAX_HALF = 500; // shortcut: longest merged half extent; biggest live brick is 565, raise once longer ones are checked in-game

const localAxis = (b, w) => { const c = (b.direction ?? 4) * 4 + (b.rotation ?? 0); return [0, 1, 2].find(i => ORIENT[c]([0, 1, 2].map(j => +(j === i))).findIndex(q => q !== 0) === w); };
const prismAxis = b => { const c = (b.direction ?? 4) * 4 + (b.rotation ?? 0); return ORIENT[c]([0, 0, 1]).findIndex(q => q !== 0); };

function mergeAxis(bricks, w, axesOf) {
  const groups = new Map(), keep = [];
  for (const b of bricks) {
    if (!axesOf(b)?.includes(w)) { keep.push(b); continue; }
    const { position, size, label, group, ...rest } = b, [lo, hi] = worldBox(b);
    const k = JSON.stringify(rest) + '|' + [0, 1, 2].filter(i => i !== w).map(i => lo[i] + ',' + hi[i]).join('|');
    (groups.get(k) ?? groups.set(k, []).get(k)).push({ b, lo: lo[w], hi: hi[w] });
  }
  let merged = 0;
  for (const run of groups.values()) {
    run.sort((a, c) => a.lo - c.lo);
    let cur = run[0];
    const flush = () => {
      if (cur.n) { const i = localAxis(cur.b, w); cur.b.size = cur.b.size.map((s, j) => j === i ? (cur.hi - cur.lo) / 2 : s); cur.b.position = cur.b.position.map((p, j) => j === w ? (cur.lo + cur.hi) / 2 : p); }
      keep.push(cur.b);
    };
    for (let k = 1; k < run.length; k++) {
      const r = run[k];
      if (r.lo === cur.hi && r.hi - cur.lo <= 2 * MAX_HALF) { cur = { ...cur, b: { ...cur.b }, hi: r.hi, n: (cur.n ?? 0) + 1 }; merged++; }
      else { flush(); cur = r; }
    }
    flush();
  }
  return { bricks: keep, merged };
}

/** merges in place (same array object); returns the number of bricks saved */
export function mergeBricks(bricks) {
  const axesOf = b => b.components || b.size?.[0] == null ? null : b.asset === 'PB_DefaultMicroWedge' ? [prismAxis(b)] : BOXES.has(b.asset ?? 'PB_DefaultBrick') ? [0, 1, 2] : null;
  let cur = bricks, saved = 0;
  for (const w of [0, 1, 2]) { const r = mergeAxis(cur, w, axesOf); cur = r.bricks; saved += r.merged; }
  bricks.length = 0; for (const b of cur) bricks.push(b);
  return saved;
}

// self-check: node mergebricks.mjs
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('mergebricks.mjs')) {
  const assert = (await import('assert')).strict;
  const wedge = x => ({ asset: 'PB_DefaultMicroWedge', direction: 0, rotation: 0, size: [10, 10, 10], position: [x, 0, 10], color: [1, 2, 3] });
  // direction 0 rotation 0: local z -> world x, so wedges in a row along x merge
  const a = [wedge(0), wedge(20), wedge(40), { ...wedge(60), color: [9, 9, 9] }];
  assert.equal(mergeBricks(a), 2); assert.equal(a.length, 2);
  const m = a.find(b => b.color[0] === 1); assert.deepEqual(m.position, [20, 0, 10]); assert.deepEqual(m.size, [10, 10, 30]);
  // wedges side by side across the slope (world y here) stay apart
  const s = [wedge(0), { ...wedge(0), position: [0, 20, 10] }]; assert.equal(mergeBricks(s), 0);
  // boxes merge on x then y into one slab
  const box = (x, y) => ({ asset: 'PB_DefaultMicroBrick', size: [5, 5, 2], position: [x, y, 2], color: [0, 0, 0] });
  const q = [box(0, 0), box(10, 0), box(0, 10), box(10, 10)]; assert.equal(mergeBricks(q), 3); assert.deepEqual(q[0].size, [10, 10, 2]);
  console.log('mergebricks ok');
}
