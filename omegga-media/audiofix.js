// Per-video audio fixing (2026-10-11, owner: "fix every video after
// downloading audio"). Every soundtrack gets a cleanup chain (ffmpeg -af) and
// heightmap flags, picked per video by re-synthesizing a 15 s excerpt with
// each candidate and scoring it against the untouched source (autotune.js).
// Two stages keep it fast: the cleanup chain with the base flags first, then
// every flag set with the winning chain. Every chain ends in loudnorm, so all
// videos come out equally loud (the score ignores loudness).
// Used by the plugin (autoTune) and by tools/fixaudio.js (batch/offline).

const AT = require('./autotune.js');

const LOUD = 'loudnorm=I=-16:TP=-1.5:LRA=11';
const FIXES = {
  plain: LOUD,
  clean: `highpass=f=70,lowpass=f=9000,${LOUD}`,
  punch: `highpass=f=70,acompressor=threshold=-24dB:ratio=4:attack=5:release=80:makeup=2,${LOUD}`,
  voice: `highpass=f=100,lowpass=f=5000,afftdn=nf=-25,dynaudnorm=f=150:g=15,${LOUD}`,
  bass: `lowpass=f=4000,bass=g=4,${LOUD}`,
};

// hand-tuned speech settings (SPEECH_FLAGS); --window 2048 won every real
// video under the old candidate list, so it is the base now
const BASE = ['--max-voices', '32', '--voice-release', '15', '--attack', '5', '--release', '60', '--leveling', '0', '--gain', '3'];
const set = (over, extra = []) => {
  const f = [...BASE];
  for (const [k, v] of Object.entries(over)) f[f.indexOf(k) + 1] = v;
  return [...f, ...extra];
};
const FLAGSETS = [
  set({}, ['--window', '2048']),
  set({}, ['--window', '1024']),
  set({}, ['--window', '4096']),
  set({}, ['--window', '512']), // no --window = 4096 (scored identical)
  set({ '--release': '150' }, ['--window', '2048']),
  set({ '--voice-release': '50' }, ['--window', '2048']),
  set({ '--max-voices': '16' }, ['--window', '2048']),
  set({ '--voice-release': '30', '--release': '100' }, ['--window', '2048', '--pitch-snap', '50']),
];

/**
 * Pick { fix, filter, flags, scores } for one excerpt.
 *   src: Float32Array of the untouched excerpt at AT.SR (the target)
 *   build(filter, flags): Promise<Buffer> of a device made from the excerpt
 *   brs: the brs module (decodeDevice reads the device with it)
 */
async function tune({ src, build, brs, log = () => {} }) {
  const seconds = src.length / AT.SR;
  const rate = async (filter, flags) => {
    try {
      return AT.score(src, AT.render(AT.decodeDevice(brs, await build(filter, flags)), seconds)).score;
    } catch (e) {
      log(`candidate failed: ${e.message}`);
      return -Infinity;
    }
  };
  const fixNames = Object.keys(FIXES);
  const fixScores = await Promise.all(fixNames.map(n => rate(FIXES[n], FLAGSETS[0])));
  let fi = fixScores.indexOf(Math.max(...fixScores));
  const flagScores = [fixScores[fi], ...(await Promise.all(FLAGSETS.slice(1).map(f => rate(FIXES[fixNames[fi]], f))))];
  const gi = flagScores.indexOf(Math.max(...flagScores));
  if (!Number.isFinite(flagScores[gi])) fi = 0; // everything failed: plain loudness fix, base flags
  return {
    fix: fixNames[fi], filter: FIXES[fixNames[fi]], flags: FLAGSETS[Number.isFinite(flagScores[gi]) ? gi : 0], flagIndex: gi,
    scores: { fix: Object.fromEntries(fixNames.map((n, i) => [n, +fixScores[i].toFixed(3)])), flags: flagScores.map(s => +s.toFixed(3)) },
  };
}

module.exports = { FIXES, FLAGSETS, tune };
