// node mildorsplume/reach.mjs: can the player get through? Mirrors playerTick()'s physics in JS and searches every
// grounded spot reachable from the start (walk, jump with any hold time, air steering in two phases), across rooms.
// Star blocks count as broken, the boss gate as open (boss dead). Prints per room what was reached and which exits.
import { build, ROOMS, TILES, W, H, TW } from './gen.mjs';

const d = build();
const TN = Object.keys(TILES);
const SOL = TN.map(k => TILES[k][1]);
const STAR = TN.indexOf('star'), GATE = TN.indexOf('gate');
const JUMP = +(process.env.JUMP ?? 1.15);

function sim(room, st) {
  const R = ROOMS[room], cur = d.tiles[room];
  const solid = (cx, cy) => {
    if (cx < 0) return R.exits.L === undefined ? 1 : 0;
    if (cx >= W) return R.exits.R === undefined ? 1 : 0;
    if (cy < 0) return R.exits.U === undefined ? 1 : 0;
    if (cy >= H) return R.exits.D === undefined ? 1 : 0;
    const t = cur[Math.floor(cy / 2) * TW + Math.floor(cx / 2)];
    return t === STAR || t === GATE ? 0 : SOL[t];
  };
  const fl = Math.floor;
  return function step(s, dir, jump) {
    let { px, py, vx, vy, ground, pJ } = s;
    if (dir) vx = Math.max(-0.5, Math.min(0.5, vx + dir * 0.12)); else vx *= ground ? 0.5 : 0.85;
    if (jump && !pJ && ground) vy = -JUMP;
    vy = Math.min(vy + (jump && vy < 0 ? 0.06 : 0.12), 1.0);
    const w = 2, h = 3;
    let nx = px + vx, mhx = false;
    if (vx > 0) { const e = fl(nx + w - 0.01); if (solid(e, fl(py)) + solid(e, fl(py + h * 0.5)) + solid(e, fl(py + h - 0.01)) > 0) { nx = e - w; mhx = true; } }
    else if (vx < 0) { const e = fl(nx); if (solid(e, fl(py)) + solid(e, fl(py + h * 0.5)) + solid(e, fl(py + h - 0.01)) > 0) { nx = e + 1; mhx = true; } }
    let ny = py + vy, mhy = false;
    if (vy > 0) { const e = fl(ny + h - 0.01); if (solid(fl(nx), e) + solid(fl(nx + w * 0.5), e) + solid(fl(nx + w - 0.01), e) > 0) { ny = e - h; mhy = true; } }
    else if (vy < 0) { const e = fl(ny); if (solid(fl(nx), e) + solid(fl(nx + w * 0.5), e) + solid(fl(nx + w - 0.01), e) > 0) { ny = e + 1; mhy = true; } }
    if (mhx) vx = 0;
    const g = mhy && vy > 0;
    if (mhy) vy = 0;
    let exit = null;
    if (nx < -1 && R.exits.L !== undefined) exit = ['L', nx + W, ny, vy];
    else if (nx > W - 1 && R.exits.R !== undefined) exit = ['R', nx - W, ny, vy];
    else if (ny < -1.5 && R.exits.U !== undefined) exit = ['U', nx, ny + H, vy];
    else if (ny > H - 1.5 && R.exits.D !== undefined) exit = ['D', nx, ny - H, vy];
    return { px: nx, py: ny, vx, vy, ground: g, pJ: jump, exit };
  };
}

const key = (r, x, y, vy = 0) => `${r}|${Math.round(x * 2) / 2}|${Math.round(y)}|${Math.round(vy * 5)}`;
const seen = new Map(), q = [];
const exitsUsed = new Set();
function push(r, x, y, from, vy = null) { const k = key(r, x, y, vy ?? 0); if (!seen.has(k)) { seen.set(k, from); q.push([r, x, y, vy]); } }
push(d.start.r, d.start.x, d.start.y, null);
const steps = ROOMS.map((_, r) => sim(r));
const HOLDS = [0, 4, 8, 12, 16, 22], KS = [0, 4, 8, 14, 22, 34];
while (q.length) {
  const [r, x0, y0, air] = q.shift();
  const step = steps[r];
  for (const v0 of [-0.5, 0, 0.5]) for (const hold of HOLDS) for (const d1 of [-1, 0, 1]) for (const k of KS) for (const d2 of [-1, 0, 1]) {
    if (k === 0 && d1 !== 0) continue;
    if (air !== null && v0 !== 0) continue;
    let s = air === null ? { px: x0, py: y0, vx: v0, vy: 0, ground: true, pJ: false } : { px: x0, py: y0, vx: 0, vy: air, ground: false, pJ: true };
    // settle onto the ground first (positions are snapped)
    for (let t = 0; t < 200; t++) {
      const jump = t < hold || (hold > 0 && t === 0);
      s = step(s, t < k ? d1 : d2, hold > 0 && jump);
      if (s.exit) { const [side, nx, ny, evy] = s.exit; exitsUsed.add(`${r}${side}`); push(ROOMS[r].exits[side], nx, ny, [r, x0, y0], evy); break; }
      if (s.py > H + 5 || s.py < -10) break;
      if (t > 1 && s.ground) { push(r, s.px, s.py, [r, x0, y0]); break; }
    }
  }
}
for (let r = 0; r < ROOMS.length - 1; r++) {
  const pts = [...seen.keys()].filter(k => k.startsWith(r + '|'));
  const ex = Object.keys(ROOMS[r].exits).map(s => `${s}->${ROOMS[r].exits[s]}${exitsUsed.has(r + s) ? ' ok' : ' NOT REACHED'}`);
  const minY = Math.min(...pts.map(k => +k.split('|')[2]));
  console.log(`room ${r} ${ROOMS[r].name}: ${pts.length} spots, highest stand py ${minY}; ${ex.join(', ')}`);
}
