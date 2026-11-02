// A* walk test for template houses (2026-11-02, owner: "create an a* pathfinding unit test for houses. brickadian size
// capsule collider"). The player's collider read off the server (GetAll CapsuleComponent): radius 12, half-height 23, MaxStepHeight 16
// (46 tall). Bricks -> 2-unit columns of solid z spans; a standing spot = a span top (or the ground) with the whole
// capsule clear above it (anything rising past a step inside radius 12 blocks); moves go 8 ways to a spot within
// STEP up or down. A* from a yard corner to every room's lamp (the generator's fixtures) on its own storey; doors
// count as open (the door panels are clickable fixtures, not bricks). Exit 1 when any room is unreachable.
//   node mapgen/pathtest.mjs longbrooke [brynwood whitetail ...]      env STEP (default 16), RADIUS, HEIGHT, CELL (2)
// 2026-11-02: longbrooke 15/15; whitetail 0/23 and brynwood 2/23 (their entries / doors were never built for a capsule)
import { worldBox } from './orient.mjs';

const R = +(process.env.CELL ?? 2), RAD = +(process.env.RADIUS ?? 12), HGT = +(process.env.HEIGHT ?? 46), STEP = +(process.env.STEP ?? 16);

export function pathtest(bricks, rooms) {
  const boxes = bricks.map(b => worldBox({ ...b, asset: b.asset ?? 'PB_DefaultBrick' }));
  const X0 = Math.min(...boxes.map(b => b[0][0])) - 60, Y0 = Math.min(...boxes.map(b => b[0][1])) - 60;
  const W = Math.ceil((Math.max(...boxes.map(b => b[1][0])) + 60 - X0) / R), D = Math.ceil((Math.max(...boxes.map(b => b[1][1])) + 60 - Y0) / R);
  const spans = Array.from({ length: W * D }, () => []);
  for (const [lo, hi] of boxes)
    for (let j = Math.floor((lo[1] - Y0) / R); j < Math.ceil((hi[1] - Y0) / R); j++)
      for (let i = Math.floor((lo[0] - X0) / R); i < Math.ceil((hi[0] - X0) / R); i++) spans[j * W + i].push([lo[2], hi[2]]);
  // merge spans; standing heights = ground 0 (if free) + every merged top
  const tops = spans.map(s => {
    s.sort((a, b) => a[0] - b[0]);
    const m = [];
    for (const [a, b] of s) if (m.length && a <= m.at(-1)[1]) m.at(-1)[1] = Math.max(m.at(-1)[1], b); else m.push([a, b]);
    s.length = 0; s.push(...m);
    return [...(m.length && m[0][0] <= 0 ? [] : [0]), ...m.map(([, b]) => b)];
  });
  const disk = [];
  for (let b = -RAD / R; b <= RAD / R; b++) for (let a = -RAD / R; a <= RAD / R; a++) if ((a * a + b * b) * R * R <= RAD * RAD) disk.push([a, b]);
  // floor contact: surfaces within 4 of the centre (wider would let a 6-high skirting along a wall become the floor)
  const foot = disk.filter(([a, b]) => (a * a + b * b) * R * R <= 16);
  // standing height at column (i, j) coming from height z: like the game's step-up, the capsule rests on the highest
  // surface near its centre it can step onto (<= z + STEP, >= z - STEP); then nothing may cut into the capsule
  const memo = new Map();
  const near = (i, j, z) => {
    const key = (j * W + i) * 1024 + z;
    if (memo.has(key)) return memo.get(key);
    let h = -1, ok = i > RAD / R && j > RAD / R && i < W - RAD / R && j < D - RAD / R;
    if (ok) {
      for (const [a, b] of foot) for (const t of tops[(j + b) * W + i + a]) if (t <= z + STEP && t > h) h = t;
      if (h < z - STEP) ok = false;
      for (const [a, b] of disk) { if (!ok) break; for (const [s0, s1] of spans[(j + b) * W + i + a]) if (s1 > h + STEP && s0 < h + HGT) { ok = false; break; } }
    }
    const n = ok ? (j * W + i) * 1024 + h : -1;
    memo.set(key, n);
    return n;
  };
  const nodeZ = n => n % 1024;
  function astar(start, goalOk, gx, gy, gz) {
    const g = new Map([[start, 0]]), heap = [[0, start]], seen = new Set();
    const push = e => { heap.push(e); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = n => { const c = Math.floor(n / 1024); return Math.hypot((c % W) * R + X0 - gx, Math.floor(c / W) * R + Y0 - gy, nodeZ(n) - gz); };
    while (heap.length) {
      const [, n] = pop();
      if (seen.has(n)) continue;
      seen.add(n);
      if (goalOk(n)) return { len: g.get(n), nodes: seen.size };
      const c = Math.floor(n / 1024), i = c % W, j = (c - i) / W, z = nodeZ(n);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const m = near(i + a, j + b, z);
        if (m < 0 || seen.has(m)) continue;
        // a diagonal step needs both side cells passable too (no corner cutting)
        if (a && b && (near(i + a, j, z) < 0 || near(i, j + b, z) < 0)) continue;
        const ng = g.get(n) + R * Math.hypot(a, b) + Math.abs(nodeZ(m) - z);
        if (ng < (g.get(m) ?? Infinity)) { g.set(m, ng); push([ng + h(m), m]); }
      }
    }
    if (process.env.DEBUG) { let best = null, bd = 1e9; for (const n of seen) { const c = Math.floor(n / 1024), x = (c % W) * R + X0, y = Math.floor(c / W) * R + Y0, d = Math.hypot(x - gx, y - gy, nodeZ(n) - gz); if (d < bd) { bd = d; best = [x, y, nodeZ(n)]; } } console.error('stuck: closest reached', best, 'to goal', [gx, gy, gz]); }
    return null;
  }
  const iS = Math.ceil(RAD / R) + 2, jS = Math.ceil(RAD / R) + 2, start = near(iS, jS, 0);
  if (start < 0) throw new Error('pathtest: the yard corner is not standable');
  return rooms.map(r => {
    const [lx, ly, lz] = r.lamps[0].at;
    // goal: any standing spot of this storey (below the lamp, above the storey under it) within 40 of the lamp
    const goalOk = n => { const c = Math.floor(n / 1024), x = (c % W) * R + X0, y = Math.floor(c / W) * R + Y0, z = nodeZ(n); return z < lz - HGT && z > lz - 140 && Math.hypot(x - lx, y - ly) <= 40; };
    const res = astar(start, goalOk, lx, ly, lz - 100);
    return { room: r.name, ok: !!res, len: res ? Math.round(res.len) : null };
  });
}

if (process.argv[1]?.endsWith('pathtest.mjs')) {
  const names = process.argv.slice(2);
  if (!names.length) throw new Error('usage: pathtest.mjs HOUSE...');
  let bad = 0;
  for (const name of names) {
    const h = (await import(`./${name}.mjs`))[name]();
    const t0 = Date.now(), res = pathtest(h.bricks, h.fixtures.rooms);
    for (const r of res) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name}  ${r.room}${r.ok ? `  (${r.len} units)` : ''}`); if (!r.ok) bad++; }
    console.log(`${name}: ${res.filter(r => r.ok).length}/${res.length} rooms reachable, capsule r${RAD} h${HGT} step ${STEP}, ${Date.now() - t0} ms`);
  }
  process.exit(bad ? 1 : 0);
}
