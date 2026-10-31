// node nes/host.mjs ROM [--fps 6] [--log DIR] : runs the emulator on the Brickadia server for the NES cabinet (nes/gen.mjs chip).
// Input: tails the game log for "nesin|<mask>" lines (the chip prints the pad on every change; bit 256 = somebody sits).
// Output: while seated, every 60/fps emulated frames the 48x36 picture goes to the chip as chat-command lines
// "br.Chat.Command /nes <strip><cells>" (only strips that changed; <= 2 strips = 385 chars a line, the game drops lines >= ~506)
// through the bridge inbox (one job file a picture). Emulation is paused while nobody sits.
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync, openSync, readSync, closeSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { NES } from './src/nes.mjs';
import { PALETTE } from './src/ppu.mjs';
import { AL, W, H, STRIP } from './gen.mjs';

const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const HOME = process.env.HOME || '', BRIDGE = join(HOME, 'omegga-server/bridge'), LOGS = arg('--log', join(HOME, 'omegga-server/data/logs'));
const FPS = +arg('--fps', 6), PER = Math.max(1, Math.round(60 / FPS)), MAXLINES = +arg('--maxlines', 20); // lines a second
const nes = new NES(new Uint8Array(readFileSync(a[0])));
const idx = new Map(); Array.from(PALETTE).forEach((c, i) => { if (!idx.has(c)) idx.set(c, i); });

function cells(fb) { // 256x240 -> 48x36: the commonest NES colour in each block
  let out = '';
  const cnt = new Uint8Array(64);
  for (let cy = 0; cy < H; cy++) {
    const y0 = Math.floor(cy * 240 / H), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * 240 / H));
    for (let cx = 0; cx < W; cx++) {
      const x0 = Math.floor(cx * 256 / W), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * 256 / W));
      cnt.fill(0); let best = 0, bn = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = idx.get(fb[y * 256 + x]) ?? 0; if (++cnt[i] > bn) { bn = cnt[i]; best = i; } }
      out += AL[best];
    }
  }
  return out;
}

let mask = 0, seated = a.includes("--force"), prev = [], logFile = null, logPos = 0, lineBudget = MAXLINES, sentJobs = [];
function readInput() {
  try {
    if (!logFile || Math.random() < 0.02) { // newest log (rotates)
      const f = readdirSync(LOGS).filter(x => /^omegga-.*\.log$/.test(x)).map(x => [x, statSync(join(LOGS, x)).mtimeMs]).sort((p, q) => q[1] - p[1])[0][0];
      if (f !== logFile) { logFile = f; logPos = statSync(join(LOGS, f)).size; }
    }
    const f = join(LOGS, logFile), size = statSync(f).size;
    if (size < logPos) logPos = 0;
    if (size === logPos) return;
    const fd = openSync(f, 'r'), buf = Buffer.alloc(Math.min(size - logPos, 1 << 20));
    readSync(fd, buf, 0, buf.length, logPos); closeSync(fd); logPos += buf.length;
    for (const m of buf.toString('utf8').matchAll(/nesin\|(\d+)/g)) {
      mask = +m[1]; const s = !!(mask & 256);
      if (s && !seated) prev = []; // fresh sitter: redraw everything
      seated = s;
    }
  } catch (e) { /* log not there yet */ }
}

function send(fb) {
  const all = cells(fb), strips = [], ops = [];
  for (let k = 0; k < H / STRIP; k++) strips.push(all.slice(k * W * STRIP, (k + 1) * W * STRIP));
  const ch = strips.map((s, k) => s !== prev[k]);
  for (let k = 0; k < strips.length; k++) {
    if (!ch[k]) continue;
    const ks = k + 1 < strips.length && ch[k + 1] ? [k, k + 1] : [k];
    if (lineBudget <= 0) break; // over the rate: the rest goes next time (prev not updated)
    lineBudget--; ops.push({ op: 'cmd', line: `br.Chat.Command /nes ${k}${ks.map(i => strips[i]).join('')}`, captureMs: 0 });
    for (const i of ks) prev[i] = strips[i];
    k = ks[ks.length - 1];
  }
  if (!ops.length) return;
  const id = `${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`;
  writeFileSync(join(BRIDGE, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  renameSync(join(BRIDGE, 'inbox', id + '.tmp'), join(BRIDGE, 'inbox', id));
  sentJobs.push(id);
}
setInterval(() => { for (const id of sentJobs.splice(0)) try { rmSync(join(BRIDGE, 'outbox', id), { force: true }); } catch {} }, 5000);
setInterval(() => { lineBudget = MAXLINES; }, 1000);

let frame = 0, next = Date.now();
console.log(`nes host: ${a[0]} ${FPS} fps picture, <= ${MAXLINES} lines/s`);
(function loop() {
  readInput();
  if (seated) {
    nes.buttons[0] = mask & 255;
    const fb = nes.frame(); nes.apu.take();
    if (++frame % PER === 0) send(fb);
    next += 1000 / 60.0988;
    if (Date.now() - next > 200) next = Date.now(); // fell behind: don't catch up
  } else next = Date.now() + 100;
  setTimeout(loop, Math.max(0, next - Date.now()));
})();
