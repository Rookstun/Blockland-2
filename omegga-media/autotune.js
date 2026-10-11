// Audio auto-tuning (owner 2026-10-11: "whatever tuning data you have needs to be
// incorporated into a program that automatically tunes audio").
//
// A heightmap2brz speaker device is a microchip whose frame counter
// (floor(Time x fps) mod frames) indexes one pitch array and one volume array
// per speaker. decodeDevice() reads those arrays back out of the .brz,
// render() re-synthesizes what the game plays (sine/square/saw/triangle at
// pitch x 440 Hz, white/pink noise for noise speakers, volume stepped per frame),
// and score() compares that with the source audio the way the loopback tuning
// did (log mel band envelopes over time + spectral shape per frame). So the
// plugin can build a few candidate devices per soundtrack and keep the one
// that sounds closest to the original, with no game client in the loop.
// Checked against the in-game loopback recordings of 2026-10-11 (calibrate in
// /tmp/tune/calib.mjs): see AUTOTUNE_CANDIDATES in omegga.main.js.

const SR = 16000;
const BASE_HZ = 440; // game synth pitch at PitchMultiplier 1 (measured 2026-10-05)

/** Pitch/volume arrays per speaker, the frame rate and frame count. */
function decodeDevice(brs, buf) {
  const r = brs.WorldReader.from(buf);
  const ext = r.externalAssets();
  const voices = [];
  let fps = 0, frames = 0;
  for (const g of r.gridIds()) {
    if (g === 1) continue;
    // every component and wire of the grid, keyed `${chunk}:${brick}` (wires cross chunks)
    const K = (c, i) => `${c.x}_${c.y}_${c.z}:${i}`;
    const by = new Map(), into = new Map(), keys = [];
    for (const c of r.brickChunkIndex(g)) {
      for (const x of c.numComponents ? r.componentChunk(g, c.index).components : []) {
        const k = K(c.index, x.brickIndex);
        if (!by.has(k)) { by.set(k, []); keys.push(k); }
        by.get(k).push(x);
      }
      let w;
      try { w = r.wireChunk(g, c.index); } catch { continue; }
      for (const x of w.local) into.set(`${K(c.index, x.target.brickIndex)}:${x.target.port}`, K(c.index, x.source.brickIndex));
      for (const x of w.remote) if (x.source.gridId === g) into.set(`${K(c.index, x.target.brickIndex)}:${x.target.port}`, K(x.source.chunk, x.source.brickIndex));
    }
    const comp = (k, re) => (by.get(k) ?? []).find(x => re.test(x.typeName));
    // frame rate (Multiply fed by the timer's Time) and frame count (the Modulo)
    for (const k of keys) {
      const src = into.get(`${k}:InputA`);
      if (src && comp(src, /Pseudo_Timer/) && comp(k, /MathMultiply/)) fps = comp(k, /MathMultiply/).data?.InputB?.value || fps;
      const md = comp(k, /MathModuloFloored/);
      if (md?.data?.InputB?.value) frames = md.data.InputB.value;
    }
    const arrayOf = getK => { const ref = into.get(`${getK}:ArrayVarRef`); return ref && comp(ref, /ArrayVar$/)?.data?.Value?.value?.Values; };
    // follow a port back (through a Multiply's InputA) to the Get gate feeding it
    const sourceArray = (k, port) => {
      let s = into.get(`${k}:${port}`);
      for (let hop = 0; s && hop < 3; hop++) {
        if (comp(s, /ArrayVar_Get/)) return arrayOf(s);
        s = into.get(`${s}:InputA`);
      }
      return null;
    };
    for (const k of keys) {
      const em = comp(k, /^Component_AudioEmitter$/);
      if (!em) continue;
      const name = ext[em.data.AudioDescriptor]?.name ?? 'BA_Synth_Basic_Sine';
      voices.push({
        wave: /Noise_Pink/.test(name) ? 'pink' : /Noise/.test(name) ? 'white' : /Square/.test(name) ? 'square' : /Sawtooth/.test(name) ? 'saw' : /Triangle/.test(name) ? 'triangle' : 'sine',
        pitch: sourceArray(k, 'PitchMultiplier'), vol: sourceArray(k, 'VolumeMultiplier'), basePitch: em.data.PitchMultiplier,
      });
    }
  }
  return { fps, frames, voices: voices.filter(v => v.vol) };
}

/** Mono Float32Array at SR of what the device plays, `seconds` long. */
function render(dev, seconds) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  const fps = dev.fps || 30;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
  for (const v of dev.voices) {
    let ph = 0, b0 = 0, b1 = 0, b2 = 0, prevVol = 0;
    const frames = v.vol.length;
    for (let i = 0; i < n; i++) {
      const fpos = (i / SR) * fps;
      const f = Math.min(frames - 1, Math.floor(fpos));
      // volume eases between frames over ~5 ms (the game doesn't jump clicks)
      const target = v.vol[f] ?? 0;
      prevVol += (target - prevVol) * 0.0125;
      if (prevVol < 1e-5 && target === 0) continue;
      const p = v.pitch ? v.pitch[f] ?? v.basePitch : v.basePitch;
      let s;
      if (v.wave === 'white' || v.wave === 'pink') {
        const w = rnd();
        if (v.wave === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; s = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
        else s = w * 0.5;
      } else {
        const hz = BASE_HZ * p;
        if (hz >= SR / 2 - 200) continue;
        ph += hz / SR; ph -= Math.floor(ph);
        s = v.wave === 'square' ? (ph < 0.5 ? 0.8 : -0.8) : v.wave === 'saw' ? 2 * ph - 1 : v.wave === 'triangle' ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph);
      }
      out[i] += s * prevVol;
    }
  }
  return out;
}

// ---- scoring: log mel spectrogram, as the loopback tuning scored recordings ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

function melspec(x, bands = 32, n = 512, hop = 160) {
  const mel = v => 2595 * Math.log10(1 + v / 700), imel = m => 700 * (10 ** (m / 2595) - 1);
  const edges = Array.from({ length: bands + 2 }, (_, i) => imel(mel(80) + (mel(7000) - mel(80)) * i / (bands + 1)));
  const fb = [];
  for (let b = 0; b < bands; b++) {
    const w = new Float32Array(n / 2 + 1);
    for (let k = 0; k <= n / 2; k++) {
      const f = k * SR / n;
      w[k] = Math.max(0, Math.min((f - edges[b]) / (edges[b + 1] - edges[b]), (edges[b + 2] - f) / (edges[b + 2] - edges[b + 1])));
    }
    fb.push(w);
  }
  const win = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  const S = [];
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let s = 0; s + n <= x.length; s += hop) {
    for (let i = 0; i < n; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const row = new Float32Array(bands);
    for (let b = 0; b < bands; b++) {
      let e = 0; const w = fb[b];
      for (let k = 0; k <= n / 2; k++) if (w[k]) e += w[k] * (re[k] * re[k] + im[k] * im[k]);
      row[b] = Math.log10(e + 1e-9);
    }
    S.push(row);
  }
  return S;
}

function corr(a, b) {
  const n = a.length; if (n < 3) return 0;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/** { band, shape, score } of a rendering against the source (both Float32Array at SR, aligned). */
function score(src, sim) {
  const S = melspec(src), G = melspec(sim);
  const m = Math.min(S.length, G.length);
  const peak = Math.max(...S.slice(0, m).map(r => Math.max(...r)));
  const active = [];
  for (let i = 0; i < m; i++) if (Math.max(...S[i]) > peak - 4) active.push(i);
  if (active.length < 10) return { band: 0, shape: 0, score: 0 };
  let band = 0;
  for (let b = 0; b < S[0].length; b++) band += corr(active.map(i => S[i][b]), active.map(i => G[i][b]));
  band /= S[0].length;
  let shape = 0;
  for (const i of active) shape += corr(S[i], G[i]);
  shape /= active.length;
  return { band, shape, score: band + shape };
}

module.exports = { SR, decodeDevice, render, score, melspec };
