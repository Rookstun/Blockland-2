// tts.js: text -> sine-wave speech (owner 2026-10-07: "an actual tts system
// inside brickadia using the tweening of pitched 440 hz waves").
//
// Sine-wave speech: three sine tones that follow the first three formants
// (F1-F3, the resonances that make vowels and consonants sound different) are
// enough to hear words. espeak-ng (unpacked to ~/espeak, no install) turns the
// text into phonemes; every phoneme here has formant targets and a length; the
// three tones glide (tween) from target to target. Fricatives and stop bursts
// get a little shaped noise. The result is a wav that heightmap2brz turns into
// a chip of 440 Hz sine speakers whose pitch is switched to follow the tones.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ESPEAK_ROOT = path.join(os.homedir(), 'espeak', 'root');
const LIB = path.join(ESPEAK_ROOT, 'usr', 'lib', 'x86_64-linux-gnu');

/** espeak-ng ASCII phonemes for text, e.g. "h@l'oU w'3:ld" */
function phonemize(text) {
  return new Promise((resolve, reject) => {
    execFile(path.join(ESPEAK_ROOT, 'usr', 'bin', 'espeak-ng'), ['--path=' + LIB, '-q', '-x', text], { env: { ...process.env, LD_LIBRARY_PATH: LIB }, timeout: 15000 },
      (err, out) => (err ? reject(err) : resolve(String(out))));
  });
}

// formant targets [F1, F2, F3] in Hz (adult male, Peterson & Barney / Hillenbrand)
const V = {
  'i:': [270, 2290, 3010], i: [300, 2200, 2950], I: [390, 1990, 2550], E: [530, 1840, 2480], a: [660, 1720, 2410],
  'A:': [730, 1090, 2440], A: [730, 1090, 2440], '0': [600, 900, 2400], 'O:': [570, 840, 2410], O: [570, 840, 2410],
  U: [440, 1020, 2240], 'u:': [300, 870, 2240], u: [320, 900, 2240], V: [640, 1190, 2390], '3:': [490, 1350, 1690], '3': [490, 1350, 1690],
  '@': [500, 1500, 2500], 'a#': [560, 1450, 2450], e: [480, 1900, 2500], o: [500, 900, 2400],
};
// diphthongs: from -> to
const DIPH = { eI: ['e', 'I'], aI: ['a', 'I'], aU: ['a', 'U'], OI: ['O', 'I'], oU: ['o', 'U'], 'e@': ['E', '@'], 'i@': ['I', '@'], 'I@': ['I', '@'], 'U@': ['U', '@'], 'A@': ['A:', '@'], 'O@': ['O', '@'], '@L': ['@', 'l'], 'aI@': ['a', '@'], 'aU@': ['a', '@'] };
// consonants: kind, formants (approximants/nasals) or F2 locus (stops), noise band
const C = {
  l: { k: 'app', f: [360, 1300, 2700], a: 0.7 }, r: { k: 'app', f: [420, 1250, 1600], a: 0.7 }, w: { k: 'app', f: [300, 650, 2200], a: 0.6 },
  j: { k: 'app', f: [280, 2200, 3000], a: 0.6 },
  m: { k: 'nas', f: [280, 1100, 2200], a: 0.35 }, n: { k: 'nas', f: [280, 1600, 2600], a: 0.35 }, N: { k: 'nas', f: [280, 2000, 2600], a: 0.35 },
  p: { k: 'stop', locus: 800, voiced: false }, b: { k: 'stop', locus: 800, voiced: true }, t: { k: 'stop', locus: 1800, voiced: false },
  d: { k: 'stop', locus: 1800, voiced: true }, k: { k: 'stop', locus: 2300, voiced: false }, g: { k: 'stop', locus: 2300, voiced: true },
  '?': { k: 'stop', locus: 1500, voiced: false },
  s: { k: 'fric', band: 'high', n: 0.35 }, z: { k: 'fric', band: 'high', n: 0.25, voiced: true }, S: { k: 'fric', band: 'mid', n: 0.35 },
  Z: { k: 'fric', band: 'mid', n: 0.25, voiced: true }, f: { k: 'fric', band: 'flat', n: 0.12 }, v: { k: 'fric', band: 'flat', n: 0.08, voiced: true },
  T: { k: 'fric', band: 'flat', n: 0.1 }, D: { k: 'fric', band: 'flat', n: 0.06, voiced: true }, h: { k: 'fric', band: 'flat', n: 0.08, asp: true },
  x: { k: 'fric', band: 'mid', n: 0.2 },
};
const AFFR = { tS: ['t', 'S'], dZ: ['d', 'Z'] };
const TOKENS = [...Object.keys(DIPH), ...Object.keys(AFFR), ...Object.keys(V), ...Object.keys(C)].sort((a, b) => b.length - a.length);

/** espeak phoneme text -> segments { f:[F1,F2,F3], a (tone level), n (noise), band, ms } */
function segments(pho) {
  const segs = [];
  const vowel = (f, ms, a = 1) => segs.push({ f, a, n: 0, ms });
  for (const word of pho.split(/\s+/).filter(Boolean)) {
    let stressed = false;
    for (let i = 0; i < word.length;) {
      const ch = word[i];
      if (ch === "'" || ch === ',') { stressed = ch === "'"; i++; continue; }
      if (/[_:]/.test(ch) && ch === '_') { segs.push({ pause: true, ms: 120 }); i++; continue; }
      const tok = TOKENS.find(t => word.startsWith(t, i));
      if (!tok) { i++; continue; }
      i += tok.length;
      const len = stressed ? 1.35 : 1;
      if (DIPH[tok]) {
        const [a, b] = DIPH[tok];
        vowel(V[a] ?? C[a].f, 90 * len); vowel(V[b] ?? C[b].f, 90 * len, b === 'l' ? 0.7 : 1);
        stressed = false;
      } else if (V[tok]) {
        vowel(V[tok], (tok.endsWith(':') ? 150 : 100) * len);
        stressed = false;
      } else {
        for (const p of AFFR[tok] ?? [tok]) {
          const c = C[p];
          if (c.k === 'app' || c.k === 'nas') segs.push({ f: c.f, a: c.a, n: 0, ms: 70 });
          else if (c.k === 'stop') {
            segs.push({ stop: true, locus: c.locus, voiced: c.voiced, ms: 55 });              // closure
            segs.push({ burst: true, locus: c.locus, n: c.voiced ? 0.2 : 0.35, band: 'flat', ms: c.voiced ? 12 : 25 });
          } else segs.push({ fric: true, n: c.n, band: c.band, voiced: !!c.voiced, asp: !!c.asp, ms: c.asp ? 60 : 100 });
        }
      }
    }
    segs.push({ pause: true, ms: 45 }); // between words
  }
  // consonants without formants of their own borrow the neighbouring vowel's,
  // bent toward the stop's F2 locus (that bend is what makes p/t/k audible)
  const near = i => { for (let d = 1; d < 4; d++) for (const j of [i + d, i - d]) if (segs[j]?.f) return segs[j].f; return V['@']; };
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.f) continue;
    const f = near(i);
    s.f = s.locus ? [f[0] * 0.6, (f[1] + s.locus) / 2, f[2]] : f;
    s.a = s.stop ? (s.voiced ? 0.12 : 0) : s.fric ? (s.voiced ? 0.25 : 0) : s.burst ? 0.1 : 0;
    s.n ??= 0;
  }
  return segs;
}

/** segments -> mono samples: three tweened sines + shaped noise */
function render(segs, rate = 22050) {
  const total = Math.ceil(segs.reduce((a, s) => a + s.ms, 0) / 1000 * rate) + rate / 4;
  const out = new Float32Array(total);
  const amps = [1, 0.55, 0.3];
  let ph = [0, 0, 0], cur = segs.find(s => s.f)?.f.slice() ?? [500, 1500, 2500], lev = 0, nlev = 0, nPrev = 0, nPrev2 = 0;
  const glide = 1 - Math.exp(-1 / (0.022 * rate)); // formant tween, ~22 ms
  const env = 1 - Math.exp(-1 / (0.006 * rate));   // level changes, ~6 ms
  let t = 0;
  for (const s of segs) {
    const n = Math.round(s.ms / 1000 * rate);
    for (let k = 0; k < n; k++, t++) {
      for (let j = 0; j < 3; j++) cur[j] += (s.f[j] - cur[j]) * glide;
      lev += ((s.pause ? 0 : s.a) - lev) * env;
      nlev += ((s.pause ? 0 : s.n) - nlev) * env;
      let v = 0;
      for (let j = 0; j < 3; j++) { ph[j] += (2 * Math.PI * cur[j]) / rate; v += Math.sin(ph[j]) * amps[j]; }
      v *= lev;
      if (nlev > 1e-4) {
        const w = Math.random() * 2 - 1, d1 = w - nPrev, d2 = d1 - (nPrev - nPrev2);
        nPrev2 = nPrev; nPrev = w;
        v += nlev * (s.band === 'high' ? d2 * 0.5 : s.band === 'mid' ? d1 * 0.7 : w);
      }
      out[t] = v;
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.9;
  return { samples: out, rate };
}

function writeWav(file, { samples, rate }) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

/** text -> wav file of sine-wave speech; returns { file, seconds, phonemes } */
async function speak(text, file) {
  const pho = await phonemize(text);
  const r = render(segments(pho));
  writeWav(file, r);
  return { file, seconds: r.samples.length / r.rate, phonemes: pho.trim() };
}

module.exports = { phonemize, segments, render, writeWav, speak };
