// Builds tts.brz: the tts.ws chip + 3 sine speakers (formants) + 1 noise speaker.
//   node build.mjs   ->  tts.brz   (load anywhere: the speakers are not spatial)
import fs from 'node:fs';
import { buildDevice } from './wsdevice.mjs';
const SINE = 'BA_Synth_Basic_Sine', NOISE = 'BA_Synth_Noise_White';
const buf = await buildDevice(fs.readFileSync(new URL('./tts.ws', import.meta.url), 'utf8'), 'tts', [
  { sound: SINE, pitch: 'P1', volume: 'V1' }, { sound: SINE, pitch: 'P2', volume: 'V2' }, { sound: SINE, pitch: 'P3', volume: 'V3' },
  { sound: NOISE, pitch: 'PN', volume: 'VN' },
], { spatial: false });
fs.writeFileSync(new URL('./tts.brz', import.meta.url), buf);
console.log('wrote tts.brz', buf.length, 'bytes');
