// Builds tts.brz (Latest format, tools/wspkg + wsbundle): the /tts chip (tts.ws) with voice.brz embedded.
// voice.brz = voice.ws + 16 sine speakers (voice harmonics) + 1 noise speaker; /tts spawns one at the caller's head.
// (Old wsdevice.mjs + to_latest path loaded but its speakers never attached post-EA3.2.)
//   node tts/build.mjs   ->  tts/voice.brz, tts/tts.brz   (scp tts.brz to Prefabs; load anywhere)
import fs from 'node:fs';
import { bundle } from '../tools/wsbundle.mjs';
const sdk = new URL('../tools/wspkg/', import.meta.url);
const wasm = await import(new URL('wasm.js', sdk).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(new URL('wasm_bg.wasm', sdk)) });
function compile(name, prefabs = {}) {
  const src = fs.readFileSync(new URL(`./${name}.ws`, import.meta.url), 'utf8');
  const ds = JSON.parse(wasm.wirescript_diagnostics(src, name, '{}') || '[]');
  for (const d of ds) console.error(`${name}: ${d.severity} ${d.code} line ${d.startLine}: ${d.message}`);
  if (ds.some(d => d.severity === 'error')) process.exit(1);
  const reg = Object.fromEntries(Object.entries(prefabs).map(([k, v]) => [k, Array.from(v)]));
  return new Uint8Array(wasm.wirescript_compile(src, name, '{}', JSON.stringify(reg)));
}
const OWNER = { id: '00000000-0000-0000-0000-00000000c0de', name: 'tts', display_name: 'tts' };

// voice: 16 harmonic sines (P1..P16 / V1..V16) + noise (PN/VN). Not spatial; it rides along at the speaker's head.
// harmonics 9-16 are Sawtooth: their overtones reach past the x4 pitch cap (F2/F3); tts/sim/bench.py: WER 0.78 vs 1.33 all-sine
const SPK = [...Array.from({ length: 16 }, (_, i) => [i >= 8 ? 'BA_Synth_Basic_Sawtooth' : 'BA_Synth_Basic_Sine', `P${i + 1}`, `V${i + 1}`]), ['BA_Synth_Noise_White', 'PN', 'VN']];
const SYN = [...new Set(SPK.map(s => s[0]))];
const v = await bundle(compile('voice'), { owner: OWNER, hide: true });
const maxX = Math.max(...v.rootPos.map(p => p[0])), y0 = Math.min(...v.rootPos.map(p => p[1])), z = v.rootPos[0][2];
SPK.forEach(([snd, P, V], k) => {
  const sp = v.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + (k % 6) * 10, y0 + Math.floor(k / 6) * 10, z], color: [30, 30, 30],
    components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: v.ext.length + SYN.indexOf(snd), VolumeMultiplier: 0, PitchMultiplier: 1,
      InnerRadius: 150, MaxDistance: 1200, bSpatialization: false, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
  v.w.addWire(v.outSource(P), { brick: sp, component_type: 'Component_AudioEmitter', port: 'PitchMultiplier' });
  v.w.addWire(v.outSource(V), { brick: sp, component_type: 'Component_AudioEmitter', port: 'VolumeMultiplier' });
});
const voice = v.finish({ extraAssets: SYN.map(name => ({ type: 'BrickAudioDescriptor', name })), description: 'tts voice' });
fs.writeFileSync(new URL('./voice.brz', import.meta.url), voice);

const m = await bundle(compile('tts', { './voice.brz': voice }), { owner: OWNER, hide: true });
const buf = m.finish({ description: 'tts chip' });
fs.writeFileSync(new URL('./tts.brz', import.meta.url), buf);
console.log('wrote voice.brz', voice.length, 'tts.brz', buf.length, 'bytes');
