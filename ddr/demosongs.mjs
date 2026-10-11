// Two public-domain demo songs for the cabinet:  node demosongs.mjs -> songs/*.mid
import fs from 'node:fs';
import { writeMidi } from './midi.mjs';
const dir = new URL('./songs/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });

const seq = (list, beat0 = 0, vel = 100, tr = 0) => { const out = []; let b = beat0; for (const [k, l] of list) { if (k) out.push({ beat: b, len: l * 0.9, key: k + tr, vel }); b += l; } return out; };
const drums = (beats, from, pat) => { const out = []; for (let b = from; b < from + beats; b += 0.5) {
  const i = Math.round((b - from) * 2) % 8;
  if (pat.kick.includes(i)) out.push({ beat: b, len: 0.2, key: 36, vel: 110 });
  if (pat.snare.includes(i)) out.push({ beat: b, len: 0.2, key: 38, vel: 100 });
  if (pat.hat) out.push({ beat: b, len: 0.1, key: 42, vel: 70 });
  if (pat.crash && i === 0 && (b - from) % 16 === 0) out.push({ beat: b, len: 0.5, key: 49, vel: 90 });
} return out; };

// In the Hall of the Mountain King (Grieg): the motif, then the motif a fifth up, getting louder
{
  const A = [[59, .5], [61, .5], [62, .5], [64, .5], [66, .5], [62, .5], [66, 1], [65, .5], [61, .5], [65, 1], [64, .5], [60, .5], [64, 1],
    [59, .5], [61, .5], [62, .5], [64, .5], [66, .5], [62, .5], [66, .5], [71, .5], [69, .5], [66, .5], [62, .5], [66, .5], [69, 2]];
  const mel = [], bass = [], kit = [];
  for (let c = 0; c < 4; c++) {
    const b0 = c * 32, oct = c >= 2 ? 12 : 0;
    mel.push(...seq(A, b0, 90 + c * 10, oct), ...seq(A, b0 + 16, 90 + c * 10, 7 + oct));
    for (let b = 0; b < 32; b++) bass.push({ beat: b0 + b, len: 0.45, key: (b < 16 ? 47 : 42) + (b % 2 ? 7 : 0), vel: 90 });
    if (c >= 1) kit.push(...drums(32, b0, { kick: c >= 3 ? [0, 2, 4, 6] : [0, 4], snare: [2, 6], hat: c >= 2, crash: true }));
  }
  fs.writeFileSync(new URL('mountain_king.mid', dir), writeMidi({ bpm: 150, tracks: [
    { name: 'Melody', ch: 0, prog: 80, notes: mel }, { name: 'Bass', ch: 1, prog: 33, notes: bass }, { name: 'Drums', ch: 9, notes: kit }] }));
}

// Ode to Joy (Beethoven)
{
  const P1 = [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1]];
  const A = [...P1, [64, 1.5], [62, .5], [62, 2]], B = [...P1, [62, 1.5], [60, .5], [60, 2]];
  const M = [[62, 1], [62, 1], [64, 1], [60, 1], [62, 1], [64, .5], [65, .5], [64, 1], [60, 1], [62, 1], [64, .5], [65, .5], [64, 1], [62, 1], [60, 1], [62, 1], [55, 2]];
  const song = [...A, ...B, ...M, ...B, ...A.map(([k, l]) => [k + 12, l]), ...B.map(([k, l]) => [k + 12, l])];
  const mel = seq(song), bass = [], kit = [];
  const total = song.reduce((s, [, l]) => s + l, 0);
  const roots = [48, 43, 48, 43, 48, 43, 48, 48];
  for (let b = 0; b < total; b++) bass.push({ beat: b, len: 0.9, key: roots[Math.floor(b / 4) % 8] + (b % 2 ? 7 : 0), vel: 80 });
  kit.push(...drums(total - 32, 32, { kick: [0, 4], snare: [2, 6], hat: true, crash: true }));
  fs.writeFileSync(new URL('ode_to_joy.mid', dir), writeMidi({ bpm: 120, tracks: [
    { name: 'Melody', ch: 0, prog: 73, notes: mel }, { name: 'Bass', ch: 1, prog: 32, notes: bass }, { name: 'Drums', ch: 9, notes: kit }] }));
}
console.log(fs.readdirSync(dir).join(' '));
