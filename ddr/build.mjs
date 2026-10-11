// Builds the DDR cabinet prefab:  node build.mjs [--level easy|normal|hard] [songs dir] -> ddr.brz
// Every songs/*.mid becomes a song on the select screen (file name = title,
// optional songs/<name>.json { "title", "level", "track", "bpm" } overrides).
// Load it in game with br.Prefab.Load "ddr" x y z 0 16 (owned by renderman so
// it can pay coins).
import fs from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readMidi } from './midi.mjs';
import { makeSong, VOICES } from './chart.mjs';
import { generate } from './wsgen.mjs';
import { buildCabinet } from './cabinet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : 'normal';
const songDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--level') ?? join(here, 'songs');

const songs = fs.readdirSync(songDir).filter(f => /\.midi?$/i.test(f)).sort().map(f => {
  const base = f.replace(/\.midi?$/i, ''), cfgFile = join(songDir, base + '.json');
  const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
  const title = cfg.title ?? base.replace(/\s*\([^)]*\)?/g, '').replace(/^Cave Story - /, '').replace(/[_-]+/g, ' ').trim().toUpperCase();
  const s = makeSong(readMidi(fs.readFileSync(join(songDir, f))), { name: title, level: cfg.level ?? level, track: cfg.track, bpm: cfg.bpm, click: cfg.click });
  console.log(`${title}: ${s.bpm} bpm, ${s.length}s, ${s.steps} steps, voices ${s.voices.map(v => v.notes.length).join('/')}`);
  return s;
});
if (!songs.length) throw new Error(`no .mid files in ${songDir}`);
// keep only voices some song uses
const used = VOICES.map((_, v) => songs.some(s => s.voices[v].notes.length));
for (const s of songs) s.voices = s.voices.filter((_, v) => used[v]);
const voiceDefs = VOICES.filter((_, v) => used[v]);
const synths = voiceDefs.map(([synth]) => synth);

const src = generate(songs, voiceDefs);
fs.writeFileSync(join(here, 'ddr.gen.ws'), src);
const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default.wirescript_compile;
const compiled = compile(src, 'ddr', '{}', '{}');
fs.writeFileSync(join(here, 'ddr.chip.brz'), new Uint8Array(compiled));
console.log(`chip compiled: ${compiled.length} bytes`);
if (args.includes('--chip-only')) process.exit(0);
const out = buildCabinet(Buffer.from(compiled), synths);
fs.writeFileSync(join(here, 'ddr.brz'), out);
console.log(`wrote ddr.brz (${out.length} bytes)`);
