// midi.mjs: a small Standard MIDI File reader (format 0/1, tempo map) and a
// writer for the demo songs.
//   readMidi(bytes) -> { notes: [{ t, dur, key, vel, ch, prog, track }], bpm, length, trackNames }
//   writeMidi({ ppq, bpm, tracks: [{ name, ch, prog, notes: [{ beat, len, key, vel }] }] }) -> Uint8Array

export function readMidi(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = 0;
  const u32 = () => (b[p++] << 24 | b[p++] << 16 | b[p++] << 8 | b[p++]) >>> 0, u16 = () => b[p++] << 8 | b[p++];
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = v * 128 + (c & 127); } while (c & 128); return v; };
  const tag = () => String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
  if (tag() !== 'MThd') throw new Error('not a MIDI file');
  p += 4; const hl = u32(), start = p; u16(); const ntr = u16(), div = u16(); p = start + hl;
  if (div & 0x8000) throw new Error('SMPTE time division not supported');
  const events = [], tempos = [], names = [];
  for (let tr = 0; tr < ntr && p < b.length; tr++) {
    while (p < b.length && tag() !== 'MTrk') { p += 4; p += u32(); }
    if (p >= b.length) break;
    p += 4; const len = u32(), end = p + len;
    let tick = 0, run = 0;
    while (p < end) {
      tick += vlq();
      let st = b[p];
      if (st & 0x80) p++; else st = run;
      if (st === 0xff) {
        const type = b[p++], l = vlq(), d = b.subarray(p, p + l); p += l;
        if (type === 0x51) tempos.push({ tick, us: d[0] << 16 | d[1] << 8 | d[2] });
        if (type === 0x03) names[tr] = new TextDecoder('latin1').decode(d);
        if (type === 0x2f) break;
      } else if (st === 0xf0 || st === 0xf7) { p += vlq(); }
      else {
        run = st;
        const kind = st >> 4, ch = st & 15, a = b[p++], two = kind !== 0xc && kind !== 0xd, c = two ? b[p++] : 0;
        events.push({ tick, kind, ch, a, c, tr });
      }
    }
    p = end;
  }
  // tempo map: tick -> seconds
  tempos.sort((x, y) => x.tick - y.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
  const segs = []; let sec = 0;
  for (let i = 0; i < tempos.length; i++) {
    segs.push({ tick: tempos[i].tick, sec, us: tempos[i].us });
    if (i + 1 < tempos.length) sec += (tempos[i + 1].tick - tempos[i].tick) * tempos[i].us / 1e6 / div;
  }
  const toSec = tick => { let s = segs[0]; for (const x of segs) { if (x.tick <= tick) s = x; else break; } return s.sec + (tick - s.tick) * s.us / 1e6 / div; };
  events.sort((x, y) => x.tick - y.tick);
  const prog = new Array(16).fill(0), open = new Map(), notes = [];
  for (const e of events) {
    if (e.kind === 0xc) { prog[e.ch] = e.a; continue; }
    const on = e.kind === 0x9 && e.c > 0, off = e.kind === 0x8 || (e.kind === 0x9 && e.c === 0);
    const k = `${e.tr}:${e.ch}:${e.a}`;
    if (on) { (open.get(k) ?? open.set(k, []).get(k)).push({ tick: e.tick, vel: e.c, prog: prog[e.ch] }); }
    else if (off) {
      const q = open.get(k); if (!q?.length) continue;
      const n = q.shift(), t = toSec(n.tick);
      notes.push({ t, dur: Math.max(0.02, toSec(e.tick) - t), key: e.a, vel: n.vel, ch: e.ch, prog: n.prog, track: e.tr });
    }
  }
  notes.sort((x, y) => x.t - y.t || y.key - x.key);
  const length = notes.reduce((m, n) => Math.max(m, n.t + n.dur), 0);
  return { notes, bpm: 60e6 / segs[0].us, length, trackNames: names };
}

export function writeMidi({ ppq = 480, bpm = 120, tracks }) {
  const out = [];
  const u32 = v => out.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255), u16 = v => out.push(v >> 8 & 255, v & 255);
  const vlq = (arr, v) => { const s = [v & 127]; while ((v >>= 7)) s.unshift(v & 127 | 128); arr.push(...s); };
  const str = s => out.push(...[...s].map(c => c.charCodeAt(0)));
  str('MThd'); u32(6); u16(1); u16(tracks.length + 1); u16(ppq);
  const chunk = evs => { // evs: [{ tick, bytes }]
    evs.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const d = []; let last = 0;
    for (const e of evs) { vlq(d, e.tick - last); last = e.tick; d.push(...e.bytes); }
    vlq(d, 0); d.push(0xff, 0x2f, 0);
    str('MTrk'); u32(d.length); out.push(...d);
  };
  const us = Math.round(60e6 / bpm);
  chunk([{ tick: 0, order: 0, bytes: [0xff, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255] }]);
  for (const t of tracks) {
    const evs = [{ tick: 0, order: 0, bytes: [0xff, 0x03, t.name.length, ...[...t.name].map(c => c.charCodeAt(0))] },
      { tick: 0, order: 1, bytes: [0xc0 | t.ch, t.prog ?? 0] }];
    for (const n of t.notes) {
      const a = Math.round(n.beat * ppq), z = Math.round((n.beat + n.len) * ppq) - 1;
      evs.push({ tick: a, order: 3, bytes: [0x90 | t.ch, n.key, n.vel ?? 100] }, { tick: z, order: 2, bytes: [0x80 | t.ch, n.key, 0] });
    }
    chunk(evs);
  }
  return new Uint8Array(out);
}
