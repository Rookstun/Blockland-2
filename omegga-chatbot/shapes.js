// Building blocks for the AI builder. Each part type expands into plain
// bricks {x, y, z, w, l, h, color, shape, material, facing}, where x/y/w/l
// are studs, z/h are plates, and x,y,z is the brick's minimum corner.
// Keeping the geometry here means the model only has to pick positions
// and sizes, which weak models manage far better than brick-by-brick.

const DOOR_W = 4; // studs
const DOOR_H = 18; // plates (6 bricks), a player fits through
const GLASS = { color: '#a8d8ff', material: 'glass' };

const int = (v, def) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : def);
const pos = (v, def, min = 1) => Math.max(min, int(v, def));

/** Merge a filled W x L grid (grid[i][j], i along x) into as few rectangles as possible. */
function rects(grid, W, L) {
  const used = grid.map(col => col.map(() => false));
  const free = (i, j) => grid[i][j] && !used[i][j];
  const out = [];
  for (let j = 0; j < L; j++)
    for (let i = 0; i < W; i++) {
      if (!free(i, j)) continue;
      let w = 1;
      while (i + w < W && free(i + w, j)) w++;
      let l = 1;
      while (j + l < L && Array.from({ length: w }, (_, k) => free(i + k, j + l)).every(Boolean)) l++;
      for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) used[i + a][j + b] = true;
      out.push({ i, j, w, l });
    }
  return out;
}

/** Bricks for every cell where fill(i, j) is true, in a W x L grid at (x0, y0). */
function layer(x0, y0, W, L, z, h, fill, props) {
  if (W <= 0 || L <= 0 || h <= 0) return [];
  const grid = Array.from({ length: W }, (_, i) => Array.from({ length: L }, (_, j) => !!fill(i, j)));
  return rects(grid, W, L).map(r => ({ ...props, x: x0 + r.i, y: y0 + r.j, z, w: r.w, l: r.l, h }));
}

/** Grid covering a circle/ellipse centered on the stud corner (cx, cy). */
function ellipse(cx, cy, rx, ry, z, h, props) {
  const ex = Math.ceil(rx), ey = Math.ceil(ry);
  return layer(cx - ex, cy - ey, 2 * ex, 2 * ey, z, h, (i, j) => {
    const dx = (i + 0.5 - ex) / rx, dy = (j + 0.5 - ey) / ry;
    return dx * dx + dy * dy <= 1;
  }, props);
}

/**
 * A straight wall of `length` along `axis` starting at (x0, y0), with
 * openings {from, to, z0, z1, glass} measured along the wall / in plates.
 */
function wall(axis, x0, y0, length, t, z, h, openings, props) {
  const cuts = [0, length, ...openings.flatMap(o => [o.from, o.to])]
    .filter(c => c >= 0 && c <= length)
    .sort((a, b) => a - b);
  const out = [];
  const put = (a, b, z0, z1, p = props) => {
    if (b <= a || z1 <= z0) return;
    out.push(axis === 'x'
      ? { ...p, x: x0 + a, y: y0, w: b - a, l: t, z: z0, h: z1 - z0 }
      : { ...p, x: x0, y: y0 + a, w: t, l: b - a, z: z0, h: z1 - z0 });
  };
  for (let k = 0; k < cuts.length - 1; k++) {
    const [a, b] = [cuts[k], cuts[k + 1]];
    if (a === b) continue;
    const o = openings.find(o => o.from <= a && o.to >= b);
    if (!o) {
      put(a, b, z, z + h);
      continue;
    }
    put(a, b, z, o.z0);
    put(a, b, o.z1, z + h);
    if (o.glass) put(a, b, o.z0, o.z1, { ...props, ...GLASS });
  }
  return out;
}

function box(p) {
  return [{
    x: int(p.x, 0), y: int(p.y, 0), z: int(p.z, 0),
    w: pos(p.w, 1), l: pos(p.l, 1), h: pos(p.h, 3),
    color: p.color, shape: p.shape, material: p.material, facing: p.facing,
  }];
}

function room(p) {
  const x = int(p.x, 0), y = int(p.y, 0), z = int(p.z, 0);
  const w = pos(p.w, 16, 4), l = pos(p.l, 16, 4), h = pos(p.h, 24, 3);
  const t = Math.min(pos(p.thickness, 1), Math.floor(Math.min(w, l) / 3) || 1);
  const props = { color: p.color ?? '#d8c8a8', material: p.material };
  const out = [];
  if (p.floor !== false)
    out.push({ x: x + t, y: y + t, z, w: w - 2 * t, l: l - 2 * t, h: 1, color: p.floor_color ?? '#8a6a48' });

  const sides = {
    '-y': ['x', x, y, w],
    '+y': ['x', x, y + l - t, w],
    '-x': ['y', x, y + t, l - 2 * t],
    '+x': ['y', x + w - t, y + t, l - 2 * t],
  };
  const doors = [].concat(p.door ?? '-y').filter(s => sides[s]);
  const winTop = z + Math.min(h - 3, 17), winBottom = z + 8;
  for (const [side, [axis, sx, sy, len]] of Object.entries(sides)) {
    const openings = [];
    if (doors.includes(side) && len >= DOOR_W + 2) {
      const from = Math.floor((len - DOOR_W) / 2);
      openings.push({ from, to: from + DOOR_W, z0: z, z1: z + Math.min(DOOR_H, h - 2) });
    }
    if (p.windows !== false && winTop - winBottom >= 4 && len >= 7) {
      // evenly spaced 3-stud windows, skipping any that would touch the door
      const count = Math.max(1, Math.floor((len - 2) / 7));
      for (let k = 1; k <= count; k++) {
        const from = Math.round((len * k) / (count + 1) - 1.5);
        const o = { from, to: from + 3, z0: winBottom, z1: winTop, glass: true };
        if (!openings.some(d => o.from < d.to + 1 && o.to > d.from - 1)) openings.push(o);
      }
    }
    out.push(...wall(axis, sx, sy, len, t, z, h, openings, props));
  }
  return out;
}

function roof(p) {
  const o = int(p.overhang, 1);
  const x = int(p.x, 0) - o, y = int(p.y, 0) - o, z = int(p.z, 0);
  const w = pos(p.w, 16) + 2 * o, l = pos(p.l, 16) + 2 * o;
  const props = { color: p.color ?? '#8b3a2a', material: p.material };
  const style = p.style ?? 'pitched';
  const step = pos(p.step, 2); // plates per 1-stud step inward
  if (style === 'flat') return [{ ...props, x, y, z, w, l, h: 2 }];
  const out = [];
  if (style === 'pyramid') {
    for (let k = 0; w - 2 * k > 0 && l - 2 * k > 0; k++)
      out.push({ ...props, x: x + k, y: y + k, z: z + k * step, w: w - 2 * k, l: l - 2 * k, h: step });
    return out;
  }
  const ridgeX = (p.ridge ?? (w >= l ? 'x' : 'y')) === 'x';
  const across = ridgeX ? l : w;
  for (let k = 0; across - 2 * k > 0; k++)
    out.push(ridgeX
      ? { ...props, x, y: y + k, z: z + k * step, w, l: l - 2 * k, h: step }
      : { ...props, x: x + k, y, z: z + k * step, w: w - 2 * k, l, h: step });
  return out;
}

function tower(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0);
  const r = pos(p.radius, 4, 2), h = pos(p.h, 48);
  const props = { color: p.color ?? '#9a9a9a', material: p.material };
  const hollow = p.hollow !== false;
  const t = hollow ? Math.min(pos(p.thickness, 1), r - 1) : 0;
  const door = p.door ?? (hollow ? '-y' : 'none');
  const doorH = Math.min(DOOR_H, h - 3);
  const e = r;
  const inRing = (i, j) => {
    const d = Math.hypot(i + 0.5 - e, j + 0.5 - e);
    // the extra half stud closes diagonal gaps where cells only touch at corners
    return d <= r && (!hollow || d > r - t - 0.5);
  };
  const inDoor = (i, j) => {
    const [a, b] = door === '-y' || door === '+y' ? [i, j] : [j, i];
    const near = door === '-y' || door === '-x' ? b < e : b >= e;
    return near && Math.abs(a + 0.5 - e) < DOOR_W / 2;
  };
  const out = [];
  if (door !== 'none' && hollow) {
    out.push(...layer(cx - e, cy - e, 2 * e, 2 * e, z, doorH, (i, j) => inRing(i, j) && !inDoor(i, j), props));
    out.push(...layer(cx - e, cy - e, 2 * e, 2 * e, z + doorH, h - doorH, inRing, props));
  } else {
    out.push(...layer(cx - e, cy - e, 2 * e, 2 * e, z, h, inRing, props));
  }
  const top = p.top ?? 'battlements';
  const zt = z + h;
  const roofProps = { color: p.roof_color ?? (top === 'cone' ? '#8b3a2a' : props.color), material: p.material };
  if (top === 'battlements' || top === 'flat') {
    out.push(...ellipse(cx, cy, r, r, zt, 2, props));
    if (top === 'battlements') {
      const segs = Math.max(8, 2 * Math.round((Math.PI * r) / 2));
      out.push(...layer(cx - e, cy - e, 2 * e, 2 * e, zt + 2, 6, (i, j) => {
        const d = Math.hypot(i + 0.5 - e, j + 0.5 - e);
        if (d > r || d <= r - 1.5) return false;
        const a = Math.atan2(j + 0.5 - e, i + 0.5 - e) + Math.PI;
        return Math.floor((a / (2 * Math.PI)) * segs) % 2 === 0;
      }, props));
    }
  } else if (top === 'cone') {
    const R = r + 1, n = Math.max(3, Math.ceil(R * 1.5));
    for (let k = 0; k < n; k++) {
      const rr = R * (1 - k / n);
      if (rr < 0.5) break;
      out.push(...ellipse(cx, cy, rr, rr, zt + k * 3, 3, roofProps));
    }
  }
  return out;
}

function sphere(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0);
  const rx = pos(p.rx ?? p.radius, 4), ry = pos(p.ry ?? p.radius ?? rx, rx);
  const rz = pos(p.rz, Math.round(rx * 2.5)); // plates; a stud is 2.5 plates wide
  const props = { color: p.color ?? '#cccccc', material: p.material };
  const dome = p.dome === true; // top half only
  const out = [];
  for (let k = dome ? rz : 0; k < 2 * rz; k += 2) {
    const dz = (k + 1 - rz) / rz;
    if (Math.abs(dz) >= 1) continue;
    const s = Math.sqrt(1 - dz * dz);
    out.push(...ellipse(cx, cy, Math.max(0.6, rx * s), Math.max(0.6, ry * s), z + k - (dome ? rz : 0), 2, props));
  }
  return out;
}

function stairs(p) {
  const x = int(p.x, 0), y = int(p.y, 0), z = int(p.z, 0);
  const n = Math.min(pos(p.steps, 6), 60), wd = pos(p.w, 4);
  const props = { color: p.color ?? '#9a9a9a', material: p.material };
  const out = [];
  for (let k = 0; k < n; k++) {
    const h = (k + 1) * 3;
    const b = {
      '+x': { x: x + 2 * k, y, w: 2, l: wd },
      '-x': { x: x - 2 * (k + 1), y, w: 2, l: wd },
      '+y': { x, y: y + 2 * k, w: wd, l: 2 },
      '-y': { x, y: y - 2 * (k + 1), w: wd, l: 2 },
    }[p.facing] ?? { x: x + 2 * k, y, w: 2, l: wd };
    out.push({ ...props, ...b, z, h });
  }
  return out;
}

function tree(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0);
  const H = pos(p.h, 30, 9);
  const leaves = { color: p.leaf_color ?? '#3a7d2c' };
  const out = [{ x: cx - 1, y: cy - 1, z, w: 2, l: 2, h: H, color: p.trunk_color ?? '#6b4423' }];
  if (p.style === 'pine') {
    const tiers = Math.max(3, Math.round(H / 8));
    const base = z + Math.round(H * 0.3);
    const tierH = Math.ceil((z + H + 6 - base) / tiers);
    for (let k = 0; k < tiers; k++) {
      const r = Math.max(1, Math.round(5 * (1 - k / tiers)));
      out.push({ ...leaves, x: cx - r, y: cy - r, z: base + k * tierH, w: 2 * r, l: 2 * r, h: tierH });
    }
  } else {
    const r = pos(p.radius, Math.max(3, Math.round(H / 7)));
    out.push(...sphere({ x: cx, y: cy, z: z + H - Math.round(r * 1.5), rx: r, ...leaves }));
  }
  return out;
}

function pyramid(p) {
  const x = int(p.x, 0), y = int(p.y, 0), z = int(p.z, 0);
  const w = pos(p.w, 16), l = pos(p.l, 16), step = pos(p.step, 3);
  const props = { color: p.color ?? '#d8c078', material: p.material };
  const out = [];
  for (let k = 0; w - 2 * k > 0 && l - 2 * k > 0; k++)
    out.push({ ...props, x: x + k, y: y + k, z: z + k * step, w: w - 2 * k, l: l - 2 * k, h: step });
  return out;
}

// ---------------------------------------------------------------- pixel parts
// Shapes drawn as text, which models handle far better than coordinates.
// Each character is one pixel; palette maps characters to colors ("." and
// " " are empty). A palette value may be "#rrggbb" or {color, material}.

const style = (palette, ch, p) => {
  // no palette (or a character missing from it): any non-blank character takes the part's color
  const v = palette?.[ch] ?? (ch !== '.' && ch !== ' ' && (!palette || !Object.keys(palette).length) ? p.color ?? '#cccccc' : null);
  if (v == null) return null;
  return typeof v === 'string' ? { color: v, material: p.material } : { color: v.color, material: v.material ?? p.material };
};
const rowsOf = v => (Array.isArray(v) ? v : String(v ?? '').split('\n')).map(String);

/**
 * extrude: a side-view picture pushed out to a thickness. rows top first.
 * axis "x": picture spans x (left to right) and z, thickness along +y from y.
 * axis "y": picture spans y and z, thickness along +x from x.
 * px = studs per character across, pz = plates per row (default 3).
 */
function extrude(p) {
  const x = int(p.x, 0), y = int(p.y, 0), z = int(p.z, 0);
  const rows = rowsOf(p.rows), px = pos(p.px, 1), pz = pos(p.pz, 3), d = pos(p.depth, 2);
  const out = [];
  rows.forEach((row, r) => {
    const zz = z + (rows.length - 1 - r) * pz;
    [...row].forEach((ch, c) => {
      const s = style(p.palette, ch, p);
      if (!s) return;
      out.push(p.axis === 'y'
        ? { ...s, x, y: y + c * px, z: zz, w: d, l: px, h: pz }
        : { ...s, x: x + c * px, y, z: zz, w: px, l: d, h: pz });
    });
  });
  return out;
}

/**
 * layers: a voxel model. layers bottom first; each layer is rows of
 * characters, a row runs along +x, rows go along +y (first row at y).
 * px = studs per character, pz = plates per layer (default 3).
 */
function layers(p) {
  const x = int(p.x, 0), y = int(p.y, 0), z = int(p.z, 0), px = pos(p.px, 1), pz = pos(p.pz, 3);
  const out = [];
  (p.layers ?? []).forEach((layer, k) =>
    rowsOf(layer).forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const s = style(p.palette, ch, p);
        if (s) out.push({ ...s, x: x + i * px, y: y + j * px, z: z + k * pz, w: px, l: px, h: pz });
      })));
  return out;
}

/**
 * revolve: a round shape from its profile. radii (studs) bottom to top,
 * one per band of seg plates (default 3); colors optional per band.
 * hollow: wall thickness in studs (0 = solid).
 */
function revolve(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0), seg = pos(p.seg, 3);
  const radii = (p.radii ?? []).map(Number).filter(Number.isFinite);
  const out = [];
  radii.forEach((r, k) => {
    if (r <= 0) return;
    const props = { color: p.colors?.[k] ?? p.color ?? '#cccccc', material: p.material };
    const e = Math.ceil(r), t = Number(p.hollow) || 0;
    out.push(...layer(cx - e, cy - e, 2 * e, 2 * e, z + k * seg, seg, (i, j) => {
      const dd = Math.hypot(i + 0.5 - e, j + 0.5 - e);
      return dd <= r + 0.25 && (!t || dd > r - t);
    }, props));
  });
  return out;
}

/** cylinder: x,y,z = center of the base; axis z (upright, default), x or y (lying, e.g. wheels); radius studs, h = length (plates for z, studs for x/y). */
function cylinder(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0);
  const r = Math.max(0.5, Number(p.radius) || 2), h = pos(p.h, 3);
  const props = { color: p.color ?? '#333333', material: p.material };
  const out = [];
  const e = Math.ceil(r);
  if (p.axis === 'x' || p.axis === 'y') {
    // radius in studs across, plates up (a stud is 2.5 plates)
    const rz = Math.round(r * 2.5);
    for (let a = -e; a < e; a++)
      for (let k = -rz; k < rz; k++) {
        if (((a + 0.5) / r) ** 2 + ((k + 0.5) / (r * 2.5)) ** 2 > 1) continue;
        out.push(p.axis === 'x'
          ? { ...props, x: cx, y: cy + a, z: z + rz + k, w: h, l: 1, h: 1 }
          : { ...props, x: cx + a, y: cy, z: z + rz + k, w: 1, l: h, h: 1 });
      }
    return out;
  }
  return layer(cx - e, cy - e, 2 * e, 2 * e, z, h, (i, j) => Math.hypot(i + 0.5 - e, j + 0.5 - e) <= r + 0.25, props);
}

/** line: a beam from [x,y,z] to [x2,y2,z2] (studs, studs, plates), thickness studs. Legs, rails, poles, ropes, branches. */
function line(p) {
  const a = [int(p.x, 0), int(p.y, 0), int(p.z, 0)], b = [int(p.x2, a[0]), int(p.y2, a[1]), int(p.z2, a[2])];
  const t = pos(p.thickness, 1), props = { color: p.color ?? '#888888', material: p.material };
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.ceil(Math.abs(b[2] - a[2]) / 2.5), 1);
  const out = [];
  for (let s = 0; s <= n; s++) {
    const f = s / n;
    out.push({ ...props, x: Math.round(a[0] + (b[0] - a[0]) * f), y: Math.round(a[1] + (b[1] - a[1]) * f), z: Math.round(a[2] + (b[2] - a[2]) * f), w: t, l: t, h: Math.max(3, Math.ceil(2.5 * t)) });
  }
  return out;
}

/** carve: removes everything built so far inside the box (doorways, windows, hollows). */
function carve(p) {
  return [{ x: int(p.x, 0), y: int(p.y, 0), z: int(p.z, 0), w: pos(p.w, 1), l: pos(p.l, 1), h: pos(p.h, 3), carve: true }];
}

/** sphere, smooth: every plate layer (not every other one). */
function sphereFine(p) {
  const cx = int(p.x, 0), cy = int(p.y, 0), z = int(p.z, 0);
  const rx = Math.max(0.6, Number(p.rx ?? p.radius) || 4), ry = Math.max(0.6, Number(p.ry ?? p.radius ?? rx) || rx);
  const rz = pos(p.rz, Math.round(rx * 2.5));
  const props = { color: p.color ?? '#cccccc', material: p.material };
  const dome = p.dome === true, out = [];
  for (let k = dome ? rz : 0; k < 2 * rz; k++) {
    const dz = (k + 0.5 - rz) / rz;
    const s = Math.sqrt(Math.max(0, 1 - dz * dz));
    if (s <= 0) continue;
    out.push(...ellipse(cx, cy, Math.max(0.6, rx * s), Math.max(0.6, ry * s), z + k - (dome ? rz : 0), 1, props));
  }
  return out;
}

const PARTS = { box, room, roof, tower, sphere: sphereFine, stairs, tree, pyramid, extrude, layers, revolve, cylinder, line, carve };

// ------------------------------------------------------------------- voxels
// Every part is painted into one stud x stud x plate grid in order, later
// parts over earlier ones (carve erases). The game drops bricks that overlap,
// so composed builds used to lose pieces; merging the grid back into boxes
// makes overlaps impossible and keeps the brick count low. Ramps and wedges
// stay whole bricks and claim their space.

const MAX_VOXELS = 3e6;

function expand(parts) {
  const vox = new Map(); // "x,y,z" -> style key
  const styles = new Map(); // style key -> {color, material}
  const specials = [];
  const warnings = [];
  let count = 0;
  for (const [n, part] of parts.entries()) {
    const fn = PARTS[part?.type ?? 'box'];
    if (!fn) throw new Error(`part ${n}: unknown type "${part.type}" (use ${Object.keys(PARTS).join(', ')})`);
    const made = fn(part);
    if (!made.length) warnings.push(`part ${n} (${part.type}) made nothing - check its fields (extrude/layers need rows/layers and a palette whose keys are the characters used)`);
    for (const b of made) {
      if (b.shape && b.shape !== 'brick' && b.shape !== 'tile' && !b.carve) {
        specials.push(b);
        b.carve = 'claim';
      }
      count += b.w * b.l * b.h;
      if (count > MAX_VOXELS) throw new Error('that build is far too big; make it smaller');
      const shape = b.shape === 'tile' ? 'tile' : undefined;
      const key = b.carve ? null : `${b.color ?? '#cccccc'}|${b.material ?? ''}|${shape ?? ''}`;
      if (key && !styles.has(key)) styles.set(key, { color: b.color, material: b.material, shape });
      for (let i = b.x; i < b.x + b.w; i++)
        for (let j = b.y; j < b.y + b.l; j++)
          for (let k = b.z; k < b.z + b.h; k++) {
            const v = `${i},${j},${k}`;
            if (key) vox.set(v, key);
            else vox.delete(v);
          }
      if (b.carve === 'claim') b.carve = undefined;
    }
  }
  // a later special can be painted over: keep only specials whose space is still free
  const kept = specials.filter(b => {
    for (let i = b.x; i < b.x + b.w; i++) for (let j = b.y; j < b.y + b.l; j++) for (let k = b.z; k < b.z + b.h; k++) if (vox.has(`${i},${j},${k}`)) return false;
    return true;
  });
  // floating pieces: voxels not connected (face to face) to anything on the build's lowest level
  if (vox.size && vox.size < 400000) {
    let minZ = Infinity;
    for (const k of vox.keys()) minZ = Math.min(minZ, Number(k.split(',')[2]));
    const seen = new Set(), stack = [];
    for (const k of vox.keys()) if (Number(k.split(',')[2]) === minZ) { seen.add(k); stack.push(k); }
    for (const b of kept) for (let i = b.x; i < b.x + b.w; i++) for (let j = b.y; j < b.y + b.l; j++) { const k = `${i},${j},${b.z + b.h}`; if (vox.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); } }
    while (stack.length) {
      const [x, y, z] = stack.pop().split(',').map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const k = `${x + dx},${y + dy},${z + dz}`;
        if (vox.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
      }
    }
    if (seen.size < vox.size) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const k of vox.keys()) if (!seen.has(k)) k.split(',').map(Number).forEach((v, a) => { lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v + 1); });
      warnings.push(`${vox.size - seen.size} voxels float, not touching the rest (x ${lo[0]}..${hi[0]}, y ${lo[1]}..${hi[1]}, z ${lo[2]}..${hi[2]} plates) - lower them or add a support so they touch`);
    }
  }
  const out = [...merge(vox, styles), ...kept];
  out.warnings = warnings;
  return out;
}

/** Greedy merge of the voxel grid into boxes (runs along x, then y, then z). */
function merge(vox, styles) {
  const out = [];
  const keys = [...vox.keys()].map(k => k.split(',').map(Number)).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const used = new Set();
  const at = (i, j, k) => vox.get(`${i},${j},${k}`);
  const free = (i, j, k, s) => at(i, j, k) === s && !used.has(`${i},${j},${k}`);
  for (const [x, y, z] of keys) {
    if (used.has(`${x},${y},${z}`)) continue;
    const s = at(x, y, z);
    let w = 1;
    while (w < 64 && free(x + w, y, z, s)) w++;
    let l = 1;
    rowY: while (l < 64) { for (let a = 0; a < w; a++) if (!free(x + a, y + l, z, s)) break rowY; l++; }
    let h = 1;
    up: while (h < 96) { for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) if (!free(x + a, y + b, z + h, s)) break up; h++; }
    for (let a = 0; a < w; a++) for (let b = 0; b < l; b++) for (let c = 0; c < h; c++) used.add(`${x + a},${y + b},${z + c}`);
    out.push({ ...styles.get(s), x, y, z, w, l, h });
  }
  return out;
}

// ------------------------------------------------------------------ preview
// ASCII views of the finished bricks so the model can see what it made:
// front (from the player, looking +x: left is +y), side (looking +y) and top.

function preview(bricks) {
  if (!bricks.length) return '';
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bricks) {
    lo[0] = Math.min(lo[0], b.x); lo[1] = Math.min(lo[1], b.y); lo[2] = Math.min(lo[2], b.z);
    hi[0] = Math.max(hi[0], b.x + b.w); hi[1] = Math.max(hi[1], b.y + b.l); hi[2] = Math.max(hi[2], b.z + b.h);
  }
  const legend = new Map();
  const letter = c => {
    const key = (c ?? '#cccccc').toLowerCase();
    if (!legend.has(key)) legend.set(key, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[legend.size] ?? '?');
    return legend.get(key);
  };
  const MAXC = 48, MAXR = 28;
  // view(u axis, v axis, depth axis, depth sign): u across, v down the rows
  const view = (ua, va, da, nearFirst, vDown) => {
    const su = Math.max(1, Math.ceil((hi[ua] - lo[ua]) / MAXC));
    const zStep = va === 2 ? 3 : 1; // plates: about square cells
    const sv = Math.max(zStep, Math.ceil((hi[va] - lo[va]) / MAXR / zStep) * zStep);
    const cols = Math.ceil((hi[ua] - lo[ua]) / su), rows = Math.ceil((hi[va] - lo[va]) / sv);
    const best = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const b of bricks) {
      const ch = letter(b.color);
      const bmin = [b.x, b.y, b.z], bmax = [b.x + b.w, b.y + b.l, b.z + b.h];
      const d = nearFirst ? bmin[da] : -bmax[da];
      for (let c = Math.floor((bmin[ua] - lo[ua]) / su); c < Math.ceil((bmax[ua] - lo[ua]) / su); c++)
        for (let r = Math.floor((bmin[va] - lo[va]) / sv); r < Math.ceil((bmax[va] - lo[va]) / sv); r++) {
          const cell = best[r][c];
          if (!cell || d < cell.d) best[r][c] = { d, ch };
        }
    }
    const lines = best.map(row => row.map(cell => (cell ? cell.ch : '.')).join(''));
    return (vDown ? lines : lines.reverse()).join('\n');
  };
  // front: across = y (left is +y, so flip), up = z, depth = x nearest first
  const front = view(1, 2, 0, true, false).split('\n').map(r => [...r].reverse().join('')).join('\n');
  const side = view(0, 2, 1, true, false);
  // top: across = y flipped, rows = x far first, depth = highest z
  const top = view(1, 0, 2, false, false).split('\n').map(r => [...r].reverse().join('')).join('\n');
  const key = [...legend].map(([c, ch]) => `${ch}=${c}`).join(' ');
  return `Size ${hi[0] - lo[0]} x ${hi[1] - lo[1]} studs, ${hi[2] - lo[2]} plates tall. Colors: ${key}\n` +
    `FRONT (as the player sees it, looking +x):\n${front}\nSIDE (looking +y):\n${side}\nTOP (looking down, +x at top):\n${top}`;
}

module.exports = { expand, preview, PARTS: Object.keys(PARTS) };
