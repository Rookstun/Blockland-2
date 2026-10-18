// O-grid converter: a video file -> O-grid chunk prefabs (+ speech soundtrack devices).
//   node tools/ogrid.mjs <video> [--n 32] [--fps 8] [--chunk 20] [--start S] [--len S]
//        [--lh 4] [--charw 0.55] [--max 8000] [--out DIR] [--brs4 PATH] [--mute]
// Writes DIR/ogrid_<k>.brz (screen + chip, 7 bricks) and, where bin/heightmap
// exists (the server), DIR/ogrid_audio_<k>.brz cut from the same seconds.
// Load chunk k and its audio on the same tick; the next chunk replaces the
// screen after `dur` seconds (DIR/ogrid.json lists them).
// STREAMED form (what /ogrid plays): DIR/receiver.brz (screen + global event
// gate + For Loop decoders, load once) and DIR/cart_<k>.brz = chunk k's
// cartridge (frames as run tokens, sends them as the --event og.test event);
// load each at the receiver's origin at k*chunk, its audio on the same tick,
// cartridges alternate between 2 slots (clear the slot first: ogrid.mjs cartridgeBox).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pathToFileURL, fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(HERE, '..');
const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const BOOL = new Set(['--mute']);
const src = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !BOOL.has(args[i - 1])));
if (!src) { console.error('usage: node tools/ogrid.mjs <video> [--n 32] [--fps 8] [--chunk 20] [--start S] [--len S] [--out DIR]'); process.exit(1); }
const n = Math.max(8, Number(flag('n', 32))), fps = Number(flag('fps', 8)), chunk = Number(flag('chunk', 20));
const out = flag('out', 'ogrid_out');
const brs4Path = flag('brs4', fs.existsSync(path.join(PLUGIN, 'lib/brs4.mjs')) ? path.join(PLUGIN, 'lib/brs4.mjs') : path.join(PLUGIN, '../tools/brs4/dist.mjs'));
const lib = await import(pathToFileURL(brs4Path).href);
const og = await import(pathToFileURL(path.join(PLUGIN, 'ogrid.mjs')).href);
fs.mkdirSync(out, { recursive: true });

const total = Number(String(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src])).trim());
const start = Number(flag('start', 0)), seconds = Math.min(total - start, Number(flag('len', Infinity)));
const strips = og.stripsFor(n);
const L = og.oLayout(n, { lh: Number(flag('lh', 1.6)), charW: Number(flag('charw', 0.95)), ws: Number(flag('ws', 2)), strips });
const HM = path.join(PLUGIN, 'bin/heightmap');
const audio = !args.includes('--mute') && fs.existsSync(HM);
const brs3 = audio ? await import(pathToFileURL(path.join(PLUGIN, 'lib/brs.mjs')).href) : null;
const { autoStart } = await import(pathToFileURL(path.join(PLUGIN, 'autostart.mjs')).href);
// the owner's pick for soundtracks (SPEECH_FLAGS in omegga.main.js), no buttons (fewer bricks)
const SPEECH = ['--audio-mode', 'voice', '--max-voices', '32', '--voice-release', '15', '--attack', '5', '--release', '60', '--leveling', '0', '--gain', '3',
  '--audio-fps', '60', '--synth', 'sine', '--no-loop', '--speakers-in-chip', '--no-control-buttons', '--inner-radius', '100', '--max-distance', '400'];

const event = flag('event', 'og.test');
fs.writeFileSync(path.join(out, 'receiver.brz'), og.buildReceiver(lib, L, { event, strips }));
const list = [];
for (let k = 0; k * chunk < seconds; k++) {
  const t0 = start + k * chunk, dur = Math.min(chunk, seconds - k * chunk);
  // centre crop to the screen's aspect, then n x n
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-t', String(dur), '-i', src,
    '-vf', `fps=${fps},crop='min(iw,ih*${L.aspect})':'min(ih,iw/${L.aspect})',scale=${n}:${n}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  const fb = n * n * 3, frames = [];
  for (let o = 0; o + fb <= raw.length; o += fb) frames.push(raw.subarray(o, o + fb));
  const strs = og.oFrames(frames, n, { max: Number(flag('max', og.MAX_CHARS)) });
  const f = path.join(out, `ogrid_${k}.brz`);
  fs.writeFileSync(f, og.buildOGrid(lib, L, strs, { fps, dur }));
  const tokens = frames.map(fr => og.encodeFrame(fr, n, { maxRuns: Math.min(og.stripRunCap(n, strips) * strips, Math.floor(6000 / fps)), strips }));
  fs.writeFileSync(path.join(out, `cart_${k}.brz`), og.buildCartridge(lib, L, tokens, { event, fps, dur, slot: k % 2 }));
  const item = { k, t0, dur, video: path.basename(f), cart: `cart_${k}.brz`, slot: k % 2, frames: strs.length, chars: Math.max(...strs.map(s => s.length)) };
  if (audio) {
    const wav = path.join(out, `ogrid_${k}.wav`), dev = path.join(out, `ogrid_audio_${k}.brz`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t0), '-t', String(dur), '-i', src, '-vn', '-ac', '1', '-ar', '44100', wav]);
    execFileSync(HM, [wav, ...SPEECH, '-o', dev]);
    fs.writeFileSync(dev, autoStart(brs3, fs.readFileSync(dev)));
    fs.rmSync(wav);
    item.audio = path.basename(dev);
  }
  list.push(item);
  console.log(`chunk ${k}: ${t0}s +${dur}s, ${strs.length} frames, longest ${item.chars} chars${audio ? ', audio' : ''}`);
}
fs.writeFileSync(path.join(out, 'ogrid.json'), JSON.stringify({ n, fps, chunk, side: L.side, event, receiver: 'receiver.brz', chunks: list }, null, 1));
console.log(`${list.length} chunk(s) -> ${out} (${n}x${n} O's, 7 bricks a chunk)`);
