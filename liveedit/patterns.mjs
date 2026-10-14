// Live editor logic shared by the page (liveedit/index.html) and the generator
// (mapgen replays recorded edits): patterns, actions and the brick rules.
// Pure functions, no I/O; works in the browser and in node.
//
// A brick here: { asset, size?, position, direction, rotation, color: [r,g,b],
//   material, material_intensity, collision, visibility, owner, locked? }

// procedural box bricks that can swap type with each other (same box)
export const BOX_ASSETS = ['PB_DefaultBrick', 'PB_DefaultMicroBrick', 'PB_DefaultTile', 'PB_DefaultSmoothTile'];
export const MATERIALS = ['BMC_Plastic', 'BMC_Glow', 'BMC_Metallic', 'BMC_Glass', 'BMC_TranslucentPlastic', 'BMC_Hologram'];

/** exact identity of a brick's shape and place (what a recorded edit matches on) */
export const keyOf = b => [b.asset ?? 'PB_DefaultBrick', (b.size ?? [0, 0, 0]).join(','), b.position.join(','), b.direction ?? 4, b.rotation ?? 0].join('|');

const hash3 = (x, y, z, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = t => t * t * (3 - 2 * t);
const noise3 = (x, y, z, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const v = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return L(L(L(v(0, 0, 0), v(1, 0, 0), xf), L(v(0, 1, 0), v(1, 1, 0), xf), yf), L(L(v(0, 0, 1), v(1, 0, 1), xf), L(v(0, 1, 1), v(1, 1, 1), xf), yf), zf);
};
const pm = (n, m) => ((n % m) + m) % m; // modulo that stays positive below zero
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

/** a brick's min corner in studs (x, y) and plates (z): the pattern grid */
export const cellOf = (b, box) => [Math.floor((box[0][0]) / 10), Math.floor((box[0][1]) / 10), Math.floor((box[0][2]) / 4)];

// pattern -> colour; o = { palette: [[r,g,b]...], scale (cells), axis 'x'|'y'|'z', seed, jitter }
export const PATTERNS = {
  random:   (c, o) => o.palette[Math.floor(hash3(c[0], c[1], c[2], o.seed) * o.palette.length)],
  checker:  (c, o) => o.palette[pm(Math.floor(c[0] / o.scale) + Math.floor(c[1] / o.scale) + Math.floor(c[2] / (o.scale * 3)), o.palette.length)],
  stripes:  (c, o) => o.palette[pm(Math.floor(c[{ x: 0, y: 1, z: 2 }[o.axis] ?? 0] / o.scale), o.palette.length)],
  diagonal: (c, o) => o.palette[pm(Math.floor((c[0] + c[1]) / o.scale), o.palette.length)],
  noise:    (c, o) => { const t = noise3(c[0] / o.scale, c[1] / o.scale, c[2] / (o.scale * 3), o.seed); return o.palette[Math.min(o.palette.length - 1, Math.floor(t * o.palette.length))]; },
  // smooth blend through the palette along an axis, over the selection's extent
  gradient: (c, o, ext) => { const k = { x: 0, y: 1, z: 2 }[o.axis] ?? 2, t = ext ? (c[k] - ext[0][k]) / Math.max(1, ext[1][k] - ext[0][k]) : 0; const p = o.palette, f = Math.max(0, Math.min(1, t)) * (p.length - 1), i = Math.min(p.length - 2, Math.floor(f)); return p.length < 2 ? p[0] : mix(p[i], p[i + 1], f - i); },
  // running bond courses: alternate rows of the palette's first two colours, mortar-like third every few courses
  courses:  (c, o) => { const row = Math.floor(c[2] / 3); return o.palette[pm(pm(row, 2) + (o.palette.length > 2 && pm(row, 4) === 3 ? 1 : 0), o.palette.length)]; },
};
export const PATTERN_NAMES = Object.keys(PATTERNS);

/** can brick b become `asset` (same box, the game's size rules) */
export function canSwap(b, asset) {
  if (!BOX_ASSETS.includes(b.asset ?? 'PB_DefaultBrick') || !BOX_ASSETS.includes(asset) || !b.size) return false;
  const [x, y, z] = b.size;
  if (asset === 'PB_DefaultBrick') return x % 5 === 0 && y % 5 === 0 && z % 2 === 0 && z >= 2; // odd half heights are refused
  if (asset === 'PB_DefaultTile' || asset === 'PB_DefaultSmoothTile') return x % 5 === 0 && y % 5 === 0 && z >= 2;
  return true;
}

/**
 * Apply an action to the selected bricks. `boxes[i]` = world box of bricks[i].
 * action: { kind: 'recolor', color } | { kind: 'shade', amount } | { kind: 'pattern', pattern, palette, scale, axis, seed, jitter }
 *       | { kind: 'material', material, intensity } | { kind: 'asset', asset } | { kind: 'delete' }
 * Returns [{ i, next }] for every brick that changes (next null = deleted); locked bricks never change.
 */
export function applyAction(bricks, boxes, sel, action) {
  const out = [];
  let ext = null;
  if (action.kind === 'pattern') {
    ext = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (const i of sel) { const c = cellOf(bricks[i], boxes[i]); for (let k = 0; k < 3; k++) { ext[0][k] = Math.min(ext[0][k], c[k]); ext[1][k] = Math.max(ext[1][k], c[k]); } }
  }
  for (const i of sel) {
    const b = bricks[i];
    if (b.locked) continue;
    let next = { ...b };
    const c = cellOf(b, boxes[i]);
    switch (action.kind) {
      case 'recolor': next.color = action.color.slice(0, 3); break;
      case 'shade': { const f = 1 + (hash3(c[0], c[1], c[2], 7) - 0.5) * 2 * (action.amount ?? 0.1); next.color = b.color.map(v => clamp(v * f)); break; }
      case 'pattern': {
        const o = { palette: action.palette?.length ? action.palette : [b.color], scale: Math.max(1, action.scale ?? 1), axis: action.axis ?? 'z', seed: action.seed ?? 1 };
        let col = PATTERNS[action.pattern](c, o, ext);
        if (action.jitter) { const f = 1 + (hash3(c[0], c[1], c[2], 9) - 0.5) * 2 * action.jitter; col = col.map(v => clamp(v * f)); }
        next.color = col.slice(0, 3);
        break;
      }
      case 'material': next.material = action.material; if (action.intensity != null) next.material_intensity = action.intensity; break;
      case 'asset': if (!canSwap(b, action.asset)) continue; next.asset = action.asset; break;
      case 'delete': next = null; break;
      default: throw new Error('unknown action ' + action.kind);
    }
    if (next && JSON.stringify(next) === JSON.stringify(b)) continue;
    out.push({ i, next });
  }
  return out;
}

/**
 * Replay recorded edits on generated bricks (mapgen output): each change
 * { before: brick, after: brick|null } whose `before` shape/place (keyOf) is
 * found is replaced (colour, material, asset) or removed. Returns counts.
 */
export function replayEdits(bricks, edits) {
  const idx = new Map();
  bricks.forEach((b, i) => idx.set(keyOf(b), i));
  let hit = 0, miss = 0;
  const drop = new Set();
  for (const e of edits) for (const ch of e.changes) {
    const i = idx.get(keyOf(ch.before));
    if (i === undefined) { miss++; continue; }
    hit++;
    if (!ch.after) { drop.add(i); continue; }
    const b = bricks[i];
    b.color = ch.after.color; b.material = ch.after.material; b.material_intensity = ch.after.material_intensity;
    if (ch.after.asset !== (b.asset ?? 'PB_DefaultBrick')) b.asset = ch.after.asset;
    if (ch.after.asset !== ch.before.asset) { idx.delete(keyOf(ch.before)); idx.set(keyOf(b), i); }
  }
  if (drop.size) { let k = 0; for (let i = 0; i < bricks.length; i++) if (!drop.has(i)) bricks[k++] = bricks[i]; bricks.length = k; }
  return { hit, miss, dropped: drop.size };
}
