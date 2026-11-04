// Builds tts.brz: the tts.ws chip + 3 sine speakers (formants) + 1 noise speaker, Latest format (tools/wspkg + wsbundle;
// the old wsdevice.mjs path = brs.mjs + to_latest loads but its speakers never attach post-EA3.2).
//   node tts/build.mjs   ->  tts/tts.brz   (scp to Prefabs, load anywhere: the speakers are not spatial)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { bundle } from '../tools/wsbundle.mjs';
const src = fs.readFileSync(new URL('./tts.ws', import.meta.url), 'utf8');
const sdk = new URL('../tools/wspkg/', import.meta.url);
const wasm = await import(new URL('wasm.js', sdk).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(new URL('wasm_bg.wasm', sdk)) });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
const ds = JSON.parse(diag(src, 'tts', '{}') || '[]');
for (const d of ds) console.error(`${d.severity} ${d.code} line ${d.startLine}: ${d.message}`);
if (ds.some(d => /error/i.test(d.severity))) throw Error('wirescript errors');

const SPK = [['BA_Synth_Basic_Sine', 'P1', 'V1'], ['BA_Synth_Basic_Sine', 'P2', 'V2'], ['BA_Synth_Basic_Sine', 'P3', 'V3'], ['BA_Synth_Noise_White', 'PN', 'VN']];
const SYN = [...new Set(SPK.map(s => s[0]))];
const b = await bundle(new Uint8Array(compile(src, 'tts', '{}', '{}')), { owner: { id: '00000000-0000-0000-0000-00000000c0de', name: 'tts', display_name: 'tts' }, hide: true });
const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
SPK.forEach(([snd, P, V], k) => {
  const sp = b.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + k * 10, y0, z], color: [30, 30, 30],
    components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(snd), VolumeMultiplier: 0, PitchMultiplier: 1,
      InnerRadius: 60000, MaxDistance: 100000, bSpatialization: false, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
  b.w.addWire(b.outSource(P), { brick: sp, component_type: 'Component_AudioEmitter', port: 'PitchMultiplier' });
  b.w.addWire(b.outSource(V), { brick: sp, component_type: 'Component_AudioEmitter', port: 'VolumeMultiplier' });
});
const buf = b.finish({ extraAssets: SYN.map(name => ({ type: 'BrickAudioDescriptor', name })), description: 'tts chip' });
fs.writeFileSync(new URL('./tts.brz', import.meta.url), buf);
console.log('wrote tts.brz', buf.length, 'bytes');
