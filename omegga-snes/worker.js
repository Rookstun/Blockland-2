// SNES emulator thread: runs the SnesJs core at 60 fps and posts downscaled
// frames (W x H rgb24) to the plugin `fps` times a second.
const { parentPort } = require('worker_threads');
const { loadCore, isHirom } = require('./core.js');

const say = (text) => parentPort.postMessage({ type: 'log', text });
const core = loadCore(say);
const FRAME_MS = 1000 / 60.0988;

let snes = null, paused = false, pad = 0;
let W = 128, H = 112, every = 10; // post every Nth emulated frame
// audio: mono ring of the DSP output (32 kHz); a few times a second its
// strongest pitches go to the plugin, which plays them on synth speakers
const RATE = 32000, FFT_N = 4096;
const ring = new Float32Array(FFT_N);
let ringPos = 0, audioEvery = 6, voices = 4, sound = true;
let start = 0, done = 0, timer = null, busyMs = 0, stats = { frames: 0, ms: 0 };

/** 512 x 224 visible picture (rows 1..224 of pixelOutput) box-averaged to W x H. */
function grab() {
  const src = snes.ppu.pixelOutput;
  const out = new Uint8Array(W * H * 3);
  const bw = 512 / W, bh = 224 / H, n = bw * bh;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < bh; dy++) {
        let i = ((1 + y * bh + dy) * 512 + x * bw) * 3;
        for (let dx = 0; dx < bw; dx++, i += 3) { r += src[i]; g += src[i + 1]; b += src[i + 2]; }
      }
      const o = (y * W + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return out;
}

function loop() {
  timer = null;
  if (!snes || paused) return;
  const t0 = Date.now();
  // frames due since start; never more than 4 at once (slow host: run slow, don't spiral)
  let due = Math.min(Math.floor((t0 - start) / FRAME_MS) - done, 4);
  if (due < 0) due = 0;
  for (let i = 0; i < due; i++) {
    snes.joypad1State = pad;
    snes.runFrame(false);
    done++;
    const dsp = snes.apu.dsp;
    for (let k = 0; k < dsp.sampleOffset; k++) { ring[ringPos] = (dsp.samplesL[k] + dsp.samplesR[k]) / 2; ringPos = (ringPos + 1) % FFT_N; }
    dsp.sampleOffset = 0;
    if (sound && done % audioEvery === 0) parentPort.postMessage({ type: 'audio', voices: pitches() });
    if (done % every === 0) {
      const rgb = grab();
      parentPort.postMessage({ type: 'frame', rgb, n: done }, [rgb.buffer]);
    }
  }
  if (Math.floor((Date.now() - start) / FRAME_MS) - done > 30) start = Date.now() - done * FRAME_MS; // fell behind: drop the debt
  const used = Date.now() - t0;
  stats.frames += due; stats.ms += used;
  timer = setTimeout(loop, Math.max(1, FRAME_MS - used));
}

function go() {
  start = Date.now() - done * FRAME_MS;
  if (!timer) timer = setTimeout(loop, 1);
}

const hann = Float64Array.from({ length: FFT_N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1)));
const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);

function fft() {
  for (let i = 1, j = 0; i < FFT_N; i++) {
    let bit = FFT_N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= FFT_N; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < FFT_N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const u = i + k, v = u + len / 2;
        const tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr;
        re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Up to `voices` strongest spectral peaks (60 Hz - 4 kHz): [[hz, amplitude 0..1]]. */
function pitches() {
  for (let i = 0; i < FFT_N; i++) { re[i] = ring[(ringPos + i) % FFT_N] * hann[i]; im[i] = 0; }
  fft();
  const lo = Math.ceil((60 * FFT_N) / RATE), hi = Math.floor((4000 * FFT_N) / RATE);
  const mag = new Float64Array(hi + 2);
  for (let i = lo - 1; i <= hi + 1; i++) mag[i] = Math.hypot(re[i], im[i]) / (FFT_N / 4); // ~ sine amplitude
  const peaks = [];
  for (let i = lo; i <= hi; i++) {
    if (mag[i] > mag[i - 1] && mag[i] >= mag[i + 1] && mag[i] > 0.004) {
      // parabolic interpolation on log magnitude for a finer frequency
      const a = Math.log(mag[i - 1] + 1e-9), b = Math.log(mag[i]), c = Math.log(mag[i + 1] + 1e-9);
      const d = (a - 2 * b + c) ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
      peaks.push([((i + d) * RATE) / FFT_N, mag[i]]);
    }
  }
  peaks.sort((p, q) => q[1] - p[1]);
  const top = peaks.length ? peaks[0][1] : 0;
  const out = [];
  for (const p of peaks) {
    if (out.length >= voices || p[1] < top * 0.2) break;
    // one speaker per note: skip peaks within a semitone of one already taken,
    // and overtones (2x..6x) of a louder one: the synth has its own
    if (out.some(q => Math.abs(Math.log2(p[0] / q[0])) < 1 / 12)) continue;
    if (out.some(q => { const r = p[0] / q[0]; return r > 1.9 && Math.abs(r - Math.round(r)) < 0.04 * r; })) continue;
    out.push([Math.round(p[0] * 10) / 10, Math.min(1, p[1])]);
  }
  return out;
}

parentPort.on('message', (m) => {
  switch (m.type) {
    case 'rom': {
      const rom = new Uint8Array(m.rom);
      const s = new core.Snes();
      const hi = m.hirom ?? isHirom(rom);
      if (!s.loadRom(rom, hi)) return parentPort.postMessage({ type: 'error', text: 'the core rejected that ROM (bad size?)' });
      s.reset(true);
      if (m.sram && s.cart.sram.length) s.cart.sram.set(new Uint8Array(m.sram).subarray(0, s.cart.sram.length));
      snes = s; done = 0; paused = false;
      parentPort.postMessage({ type: 'loaded', name: s.cart.header.name.trim(), hirom: hi, sram: s.cart.hasSram ? s.cart.sram.length : 0 });
      go();
      break;
    }
    case 'pad': pad = m.state & 0xfff; break;
    case 'reset': if (snes) snes.reset(false); break;
    case 'pause': paused = m.value; if (!paused) go(); break;
    case 'view': W = m.W; H = m.H; every = Math.max(1, Math.round(60 / m.fps)); break;
    case 'audio': sound = m.on; voices = m.voices; audioEvery = Math.max(2, Math.round(60 / m.hz)); break;
    case 'sram':
      parentPort.postMessage({ type: 'sram', data: snes?.cart.hasSram ? snes.cart.sram.slice() : null });
      break;
    case 'stats': {
      const s = { ...stats, done, paused, loaded: !!snes };
      stats = { frames: 0, ms: 0 };
      parentPort.postMessage({ type: 'stats', stats: s });
      break;
    }
  }
});
