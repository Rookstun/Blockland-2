#!/usr/bin/env node
// Batch audio fixer (runs on the server, from plugins/media):
//   node tools/fixaudio.js <media or wav>...        pick cleanup chain + flags per file
//   node tools/fixaudio.js --out DIR <files>...      also write each file's fixed wav to DIR
// Same picker as the plugin's /playvideo auto preset (audiofix.js), so a run
// over varied clips shows whether different clips really pick different fixes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const AT = require('../autotune.js');
const AF = require('../audiofix.js');

const ROOT = path.join(__dirname, '..');
const HEIGHTMAP = path.join(ROOT, 'bin', 'heightmap');
const run = (cmd, args, timeout = 300_000) => new Promise((res, rej) =>
  execFile(cmd, args, { timeout, maxBuffer: 1 << 28, encoding: 'buffer' }, (e, out, err) =>
    e ? rej(new Error(`${path.basename(cmd)}: ${String(err || '').trim().split('\n').pop() || e.message}`)) : res(out)));

// the plugin's voice-mode device (buildAudioDevice): sine, 32 voices, 60 fps
const deviceArgs = (wav, flags, out) => [wav, '--audio-mode', 'voice',
  ...(flags.includes('--max-voices') ? [] : ['--max-voices', '32']), '--audio-fps', '60', ...flags,
  '--synth', 'sine', '--no-loop', '--speakers-in-chip', '--inner-radius', '100', '--max-distance', '400', '-o', out];

async function fixOne(file, brs, outDir) {
  const t0 = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixaudio-'));
  try {
    const dur = Number(String(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim()) || 15;
    const start = Math.max(0, dur / 2 - 7.5), len = Math.min(15, dur);
    const ex = path.join(tmp, 'ex.wav');
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(start), '-t', String(len), '-i', file, '-vn', '-ac', '1', '-ar', '44100', ex]);
    const raw = await run('ffmpeg', ['-v', 'error', '-i', ex, '-ac', '1', '-ar', String(AT.SR), '-f', 'f32le', '-']);
    const src = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length - (raw.length % 4)));
    let n = 0;
    const best = await AF.tune({
      src, brs, log: m => console.error(`  ${m}`),
      build: async (filter, flags) => {
        const k = n++, wav = path.join(tmp, `c${k}.wav`), out = path.join(tmp, `c${k}.brz`);
        await run('ffmpeg', ['-v', 'error', '-y', '-i', ex, '-af', filter, '-ac', '1', '-ar', '44100', wav]);
        await run(HEIGHTMAP, deviceArgs(wav, flags, out));
        return fs.readFileSync(out);
      },
    });
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      const dst = path.join(outDir, path.basename(file).replace(/\.[^.]+$/, '') + `.${best.fix}.wav`);
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-af', best.filter, dst], 900_000);
      best.wrote = dst;
    }
    return { file: path.basename(file), secs: +((Date.now() - t0) / 1000).toFixed(1), ...best };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  const outDir = oi >= 0 ? args.splice(oi, 2)[1] : null;
  if (!args.length) return console.error('usage: node tools/fixaudio.js [--out DIR] <media or wav>...');
  const brs = await import(pathToFileURL(path.join(ROOT, 'lib', 'brs.mjs')).href);
  const rows = [];
  for (const f of args) {
    try {
      const r = await fixOne(f, brs, outDir);
      rows.push(r);
      console.log(`${r.file}: ${r.fix} #${r.flagIndex}  fix ${JSON.stringify(r.scores.fix)}  flags ${r.scores.flags.join(' ')}  (${r.secs} s)${r.wrote ? ' -> ' + r.wrote : ''}`);
    } catch (e) {
      console.log(`${path.basename(f)}: FAILED ${e.message}`);
    }
  }
  const tally = {};
  for (const r of rows) tally[`${r.fix} #${r.flagIndex}`] = (tally[`${r.fix} #${r.flagIndex}`] || 0) + 1;
  console.log('picks:', JSON.stringify(tally));
})();
