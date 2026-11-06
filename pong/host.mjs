// node pong/host.mjs [--fps 5] [--maxlines 6] [--force] : single-player pong for the PONG cabinet (pong/gen.mjs chip), run on the server.
// 160x240 portrait, paddle at the bottom (A/D), a new ball every 2 returns, game over when the last ball drops.
// Input: tails the game log for "pgin|<mask>" (bit 256 = seated). Output: changed rows as run-length records in
// "br.Chat.Command /pg ..." lines (<= 480 chars, <= maxlines a second) through the bridge inbox, HUD as "/pgs".
import { writeFileSync, renameSync, readdirSync, statSync, openSync, readSync, closeSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert';
import { AL, W, H } from './gen.mjs';

const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const HOME = process.env.HOME || '', BRIDGE = join(HOME, 'omegga-server/bridge'), LOGS = arg('--log', join(HOME, 'omegga-server/data/logs'));
const FPS = +arg('--fps', 5), MAXLINES = +arg('--maxlines', 6), LINE = 480;

// ---- row codec (the chip's decoder in gen.mjs mirrors decode)
function encode(r, row) { // row = W chars '#'/' '
  let s = AL[r >> 6] + AL[r & 63], i = 0, blk = false;
  const end = row.trimEnd().length; // trailing spaces are implied
  while (i < end) {
    let n = 0; while (i + n < end && (row[i + n] === '#') === blk) n++;
    i += n;
    while (n > 63) { s += AL[63] + AL[0]; n -= 63; } // long run: 63, empty run of the other kind, rest
    s += AL[n]; blk = !blk;
  }
  return s + '.';
}
function decode(rec) {
  let s = '', blk = false;
  for (const ch of rec.slice(2, -1)) { const n = AL.indexOf(ch); s += (blk ? '#' : ' ').repeat(n); blk = !blk; }
  return { r: AL.indexOf(rec[0]) * 64 + AL.indexOf(rec[1]), row: s.padEnd(W) };
}
for (const row of [' '.repeat(W), '#'.repeat(W), '#'.repeat(70) + ' '.repeat(80) + '##########', ' '.repeat(3) + '####' + ' '.repeat(153)]) {
  const d = decode(encode(239, row)); assert.equal(d.r, 239); assert.equal(d.row, row); // self-check
}

// ---- game
const PW = 28, PY = H - 12, BS = 4;
let px, balls, score, best = 0, over;
const newBall = () => { const ang = (Math.random() - 0.5) * 1.2; return { x: W / 2, y: 30, vx: 5 * Math.sin(ang), vy: 5 * Math.cos(ang) }; };
function reset() { px = W / 2 - PW / 2; balls = [newBall()]; score = 0; over = 0; }
reset();
function step(mask) {
  if (over) { if (--over === 0) reset(); return; }
  if (mask & 64) px -= 6; // left = viewer's left
  if (mask & 128) px += 6;
  px = Math.max(0, Math.min(W - PW, px));
  for (const b of balls) {
    b.x += b.vx; b.y += b.vy;
    if (b.x < 0) { b.x = -b.x; b.vx = -b.vx; }
    if (b.x > W - BS) { b.x = 2 * (W - BS) - b.x; b.vx = -b.vx; }
    if (b.y < 3) { b.y = 6 - b.y; b.vy = Math.abs(b.vy); }
    if (b.vy > 0 && b.y + BS >= PY && b.y + BS <= PY + 4 + b.vy && b.x + BS > px && b.x < px + PW) {
      const off = (b.x + BS / 2 - (px + PW / 2)) / (PW / 2); // -1..1 along the paddle
      const sp = Math.min(9, Math.hypot(b.vx, b.vy) + 0.15);
      b.vx = sp * off * 0.8; b.vy = -Math.sqrt(sp * sp - b.vx * b.vx); b.y = PY - BS;
      if (++score % 2 === 0) balls.push(newBall());
    }
  }
  balls = balls.filter(b => b.y < H);
  if (!balls.length) { best = Math.max(best, score); over = FPS * 3; }
}
function render() {
  const g = Array.from({ length: H }, () => new Array(W).fill(' '));
  const fill = (x0, y0, w, h) => { for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, Math.round(y0) + h); y++) for (let x = Math.max(0, Math.round(x0)); x < Math.min(W, Math.round(x0) + w); x++) g[y][x] = '#'; };
  fill(0, 0, W, 2); // top wall
  fill(px, PY, PW, 4);
  for (const b of balls) fill(b.x, b.y, BS, BS);
  if (over) fill(W / 2 - 30, H / 2 - 2, 60, 4); // game over bar
  return g.map(r => r.join(''));
}

// ---- io (as nes/host.mjs)
let mask = 0, seated = a.includes('--force'), logFile = null, logPos = 0, budget = MAXLINES, sent = [], prev = [], hudPrev = '';
function readInput() {
  try {
    if (!logFile || Math.random() < 0.02) {
      const f = readdirSync(LOGS).filter(x => /^omegga-.*\.log$/.test(x)).map(x => [x, statSync(join(LOGS, x)).mtimeMs]).sort((p, q) => q[1] - p[1])[0][0];
      if (f !== logFile) { logFile = f; logPos = statSync(join(LOGS, f)).size; }
    }
    const f = join(LOGS, logFile), size = statSync(f).size;
    if (size < logPos) logPos = 0;
    if (size === logPos) return;
    const fd = openSync(f, 'r'), buf = Buffer.alloc(Math.min(size - logPos, 1 << 20));
    readSync(fd, buf, 0, buf.length, logPos); closeSync(fd); logPos += buf.length;
    for (const m of buf.toString('utf8').matchAll(/pgin\|(\d+)/g)) {
      mask = +m[1]; const s = !!(mask & 256);
      if (s && !seated) { prev = []; hudPrev = ''; reset(); } // fresh sitter: new game, redraw all
      seated = s;
    }
  } catch { /* log not there yet */ }
}
function send(rows) {
  const ops = [], recs = [];
  rows.forEach((row, r) => { if (row !== prev[r]) recs.push([r, encode(r, row)]); });
  const lines = [];
  for (const [, rec] of recs) { if (!lines.length || lines.at(-1).length + rec.length > LINE) lines.push(''); lines[lines.length - 1] += rec; }
  // whole frame or nothing: the chip redraws only on the fin ('1') line, so a frame never lands half-drawn (tearing)
  if (lines.length && lines.length <= budget) {
    budget -= lines.length;
    lines.forEach((l, i) => ops.push({ op: 'cmd', line: `br.Chat.Command /pg ${i === lines.length - 1 ? 1 : 0}${l}`, captureMs: 0 }));
    for (const [r] of recs) prev[r] = rows[r];
  }
  const hud = over ? `GAME OVER  SCORE ${score}  BEST ${best}` : `SCORE ${score}  BALLS ${balls.length}  BEST ${best}`;
  if (hud !== hudPrev && budget > 0) { budget--; hudPrev = hud; ops.push({ op: 'cmd', line: `br.Chat.Command /pgs ${hud}`, captureMs: 0 }); }
  if (!ops.length) return;
  const id = `${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`;
  writeFileSync(join(BRIDGE, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  renameSync(join(BRIDGE, 'inbox', id + '.tmp'), join(BRIDGE, 'inbox', id));
  sent.push(id);
}
setInterval(() => { for (const id of sent.splice(0)) try { rmSync(join(BRIDGE, 'outbox', id), { force: true }); } catch {} }, 5000);
setInterval(() => { budget = MAXLINES; }, 1000);

console.log(`pong host: ${W}x${H}, ${FPS} fps, <= ${MAXLINES} lines/s`);
setInterval(() => { readInput(); if (seated) { step(mask); send(render()); } }, 1000 / FPS);
