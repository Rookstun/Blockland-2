// node nes/record.mjs ROM out.mp4 [--frames N] [--press Start@120,...] : emulator run -> mp4 (60 fps, 44.1 kHz audio) for /stream
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NES } from './src/nes.mjs';

const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const BTN = { A: 1, B: 2, Select: 4, Start: 8, Up: 16, Down: 32, Left: 64, Right: 128 };
// press spec "Start@120" or "Right@200+60" (button@frame[+hold frames], default hold 5)
const presses = arg('--press', '').split(',').filter(Boolean).map(s => { const [b, r] = s.split('@'), [f, h = 5] = r.split('+'); return [BTN[b], +f, +h]; });
const frames = +arg('--frames', 1800), nes = new NES(new Uint8Array(readFileSync(a[0]))), dir = mkdtempSync(join(tmpdir(), 'nesrec-'));
const wav = join(dir, 'a.wav'), pcm = [];
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '256x240', '-r', '60.0988', '-i', '-',
  '-i', wav, '-vf', 'scale=512:480:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', a[1]], { stdio: ['pipe', 'inherit', 'inherit'] });
// audio first (needs the whole run), video piped after
const vids = [];
for (let f = 0; f < frames; f++) {
  nes.buttons[0] = presses.reduce((m, [b, at, h]) => f >= at && f < at + h ? m | b : m, 0);
  vids.push(Buffer.from(nes.frame().slice().buffer)); // fb is ABGR little-endian = rgba bytes
  pcm.push(nes.apu.take());
}
const n = pcm.reduce((s, p) => s + p.length, 0), h = Buffer.alloc(44 + n * 2), L = new Int16Array(n); let o = 0;
for (const p of pcm) for (const v of p) L[o++] = Math.max(-1, Math.min(1, v * 3)) * 32767;
h.write('RIFF'); h.writeUInt32LE(36 + n * 2, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(44100, 24); h.writeUInt32LE(88200, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(n * 2, 40);
Buffer.from(L.buffer).copy(h, 44); writeFileSync(wav, h);
for (const v of vids) ff.stdin.write(v);
ff.stdin.end();
ff.on('close', c => { rmSync(dir, { recursive: true, force: true }); console.log(c ? 'ffmpeg failed' : `wrote ${a[1]} (${(frames / 60.0988).toFixed(1)} s)`); });
