// chart.mjs: a MIDI song -> a DDR step chart + speaker voices (drums are dropped: owner, no drums).
//   makeSong(readMidi(bytes), { name, level }) -> song (see the return below)
//
// Steps come from the melody track (most notes, higher pitch wins ties, or
// opts.track): the top note of each chord, quantized to 16ths of the opening
// tempo, thinned to the level's minimum gap, laid on lanes by the melodic
// contour (big leap up = UP, step up = RIGHT, step down = LEFT, big leap down
// = DOWN, same note = same lane). Strong chords on a downbeat become jumps.

export const LANES = ['←', '↓', '↑', '→'];
// the speakers: [synth, group]; ddr.ws gets one P/V out pair per voice
// soft tones (owner: square was "very beepy")
export const VOICES = [['Triangle', 'melody'], ['Triangle', 'melody'], ['Triangle', 'bass'], ['Triangle', 'bass'],
  ['Sine', 'other'], ['Sine', 'other'], ['Sine', 'other'], ['Sine', 'other'],
  ['Square', 'click'], ['Square', 'click'], ['Square', 'click']];   // clicky: hard attack, no smoothing
// percussive GM patches (piano, chromatic perc, guitar, pizzicato/harp, square/saw leads, ethnic plucks, percussive)
const CLICK_PROGS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 26, 27, 28, 45, 46, 80, 81, 104, 105, 106, 107, 108, 112, 113, 114, 115]);
const median = xs => { const a = [...xs].sort((p, q) => p - q); return a[a.length >> 1] ?? 0; };
const LEVELS = { easy: 4, normal: 2, hard: 1 }; // minimum gap between steps, in 16ths

const pitchOf = key => { let p = 2 ** ((key - 69) / 12); while (p > 9.5) p /= 2; while (p < 0.11) p *= 2; return p; };
const r3 = x => Math.round(x * 1000) / 1000;

// Extra opts (the editor, ddr/editor): groups { track: melody|bass|other|click|mute } overrides the
// automatic track roles, steps [{ row, lane }] replaces the generated chart, transpose (semitones),
// vol { group: gain multiplier }. voiceDefs = the cabinet's speakers ([synth, group], default VOICES).
export function makeSong(midi, { name, level = 'normal', track, bpm, click, groups, steps: fixedSteps, transpose = 0, vol } = {}, voiceDefs = VOICES) {
  const notes = midi.notes.filter(n => n.t < 600).map(n => transpose ? { ...n, key: Math.max(0, Math.min(127, n.key + transpose)) } : n);
  const tonal = notes.filter(n => n.ch !== 9 && groups?.[n.track] !== 'mute');
  const tempo = bpm ?? midi.bpm;
  const rowDur = 60 / tempo / 4;
  // the melody track
  const byTrack = new Map();
  for (const n of tonal) (byTrack.get(n.track) ?? byTrack.set(n.track, []).get(n.track)).push(n);
  const scoreT = ns => ns.length * (ns.reduce((s, n) => s + n.key, 0) / ns.length >= 58 ? 1.5 : 1);
  const forced = groups && Object.keys(groups).map(Number).find(k => groups[k] === 'melody' && byTrack.has(k));
  const melTrack = track ?? forced ?? [...byTrack.entries()].sort((a, b) => scoreT(b[1]) - scoreT(a[1]))[0]?.[0];
  const mel = byTrack.get(melTrack) ?? [];
  // onsets: per 16th row, the top note and the chord size
  const rows = new Map();
  for (const n of mel) {
    const row = Math.round(n.t / rowDur), cur = rows.get(row);
    if (!cur) rows.set(row, { row, key: n.key, size: 1 }); else { cur.size++; cur.key = Math.max(cur.key, n.key); }
  }
  const gap = LEVELS[level] ?? 2, steps = fixedSteps ? fixedSteps.map(s => ({ row: s.row, lane: s.lane })).sort((a, b) => a.row - b.row || a.lane - b.lane) : [];
  let last = -1e9, prevKey = null, prevLane = 2;
  if (!fixedSteps) for (const o of [...rows.values()].sort((a, b) => a.row - b.row)) {
    if (o.row - last < gap) continue;
    let lane;
    if (prevKey === null) lane = 2;
    else {
      const d = o.key - prevKey;
      lane = d === 0 ? prevLane : d >= 5 ? 2 : d > 0 ? 3 : d <= -5 ? 1 : 0;
      if (d !== 0 && lane === prevLane) lane = [1, 0, 3, 2][lane]; // a new note never repeats the lane
    }
    steps.push({ row: o.row, lane });
    if (o.size >= 3 && o.row % 16 === 0 && level !== 'easy') steps.push({ row: o.row, lane: lane === 0 ? 3 : 0 });
    last = o.row; prevKey = o.key; prevLane = lane;
  }
  const lanes = [0, 1, 2, 3].map(l => steps.filter(s => s.lane === l).map(s => ({ row: s.row, t: r3(s.row * rowDur) })));
  // music: allocate notes to the voices by group
  const bassTracks = new Set([...byTrack.entries()].filter(([tr, ns]) => tr !== melTrack &&
    (ns.reduce((s, n) => s + n.key, 0) / ns.length < 52 || ns.every(n => n.prog >= 32 && n.prog <= 39))).map(([tr]) => tr));
  // clicky instruments: a track of mostly short (staccato) notes, a percussive patch (when the file
  // names one; program 0 alone says nothing), or listed in the song's json "click"
  const clickTracks = new Set(click ?? [...byTrack.entries()].filter(([, ns]) =>
    median(ns.map(n => n.dur)) < 0.18 || ns.some(n => n.prog > 0 && CLICK_PROGS.has(n.prog))).map(([tr]) => tr));
  const roleOf = tr => groups?.[tr] ?? (clickTracks.has(tr) ? 'click' : tr === melTrack ? 'melody' : bassTracks.has(tr) ? 'bass' : 'other');
  const voices = voiceDefs.map(([synth, group]) => ({ synth, group, notes: [], end: -1 }));
  for (const n of tonal) {
    const group = roleOf(n.track);
    let pool = voices.filter(v => v.group === group);
    if (!pool.length) pool = voices;
    let v = pool.find(v => v.end <= n.t + 0.001) ?? voices.find(v => v.group === 'other' && v.end <= n.t + 0.001);
    if (!v) v = pool.reduce((a, b) => (a.end < b.end ? a : b)); // steal the voice that frees soonest
    if (v.notes.length) { const p = v.notes[v.notes.length - 1]; p.end = Math.min(p.end, n.t - 0.03); if (p.end <= p.t + 0.02) v.notes.pop(); }
    const gain = (group === 'melody' ? 1.0 : group === 'bass' ? 0.9 : group === 'click' ? 0.7 : 0.55) * (vol?.[group] ?? 1);
    v.notes.push({ t: r3(n.t), end: r3(n.t + n.dur), pitch: r3(pitchOf(n.key)), vol: r3(gain * (0.35 + 0.65 * n.vel / 127)) });
    v.end = n.t + n.dur;
  }
  for (const v of voices) for (const n of v.notes) n.end = Math.max(r3(n.end - 0.02), r3(n.t + 0.03));
  const length = r3(Math.max(midi.length, ...lanes.flat().map(s => s.t)) + 0.5);
  return { name: name ?? 'SONG', bpm: Math.round(tempo), rowDur: r3(rowDur), rowsTotal: Math.ceil(length / rowDur) + 1, length,
    lanes, steps: steps.length, melTrack, roles: Object.fromEntries([...byTrack.keys()].map(tr => [tr, roleOf(tr)])), chart: steps, voices: voices.map(({ synth, group, notes }) => ({ synth, group, notes })) };
}
