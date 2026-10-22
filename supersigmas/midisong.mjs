// supersigmas/midisong.mjs: turns the owner's MIDIs into the chip's two monophonic voices (lead, bass) as
// [pitch multiplier (A4 = 1, 0 = rest), ticks] lists at 20 Hz.
//   lead = per onset the highest note of the lead notes (skyline), bass = the lowest of the bass notes;
//   a note lasts to its end or the voice's next onset, whichever comes first.
import fs from 'node:fs';
import { readMidi } from '../ddr/midi.mjs';

const TICK = 0.05;

function mono(notes, pick, len) {
  const byT = new Map();
  for (const n of notes) { const k = Math.round(n.t / TICK); const o = byT.get(k); if (!o || pick(n.key, o.key)) byT.set(k, n); }
  const on = [...byT.entries()].sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = 0;
  on.forEach(([k, n], i) => {
    if (k > cur) out.push([0, k - cur]);
    const next = i + 1 < on.length ? on[i + 1][0] : len;
    const end = Math.min(next, Math.max(k + 1, Math.round((n.t + n.dur) / TICK)));
    out.push([2 ** ((n.key - 69) / 12), end - k]);
    cur = end;
  });
  if (len > cur) out.push([0, len - cur]);
  return out;
}

// spec: { file, lead: note => bool, bass: note => bool, bassUp (octaves added to low bass) }
export function midiSong({ file, lead, bass, bassMin = 36 }) {
  const m = readMidi(fs.readFileSync(new URL(`../${file}`, import.meta.url)));
  const notes = m.notes.filter(n => n.vel >= 10);
  const len = Math.ceil(m.length / TICK);
  const up = n => { let k = n.key; while (k < bassMin) k += 12; return { ...n, key: k }; };
  return [mono(notes.filter(lead), (a, b) => a > b, len), mono(notes.filter(bass).map(up), (a, b) => a < b, len)];
}

export const SONG_FILES = {
  // title: overtonight - mirrors demo: strings = melody, bass track
  mirrors: { file: 'overtonight - mirrors demo.mid', lead: n => n.track === 3, bass: n => n.track === 2 },
  // gameplay: Clovis Reyes - Fluxxwave (Looksmaxxing): one piano track, split at middle C
  fluxx: { file: 'Clovis Reyes - Fluxxwave (Looksmaxxing).mid', lead: n => n.key >= 60, bass: n => n.key < 55 },
};

if (process.argv[1]?.endsWith('midisong.mjs')) {
  for (const [k, s] of Object.entries(SONG_FILES)) {
    const [l, b] = midiSong(s);
    const sum = v => v.reduce((a, x) => a + x[1], 0);
    console.log(k, 'lead', l.length, 'notes', sum(l), 'ticks | bass', b.length, sum(b), '| first lead', JSON.stringify(l.slice(0, 6).map(x => [+x[0].toFixed(3), x[1]])));
  }
}
