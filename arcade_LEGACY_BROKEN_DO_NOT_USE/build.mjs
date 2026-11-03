// Builds an arcade cabinet prefab:  node arcade/build.mjs <game> [--chip-only]  -> arcade/out/<game>.brz
// Each game is arcade/<game>/gen.mjs (generate() -> Wirescript source + what its screen needs)
// and arcade/<game>/cabinet.mjs (the machine around the chip, built with lib/cabinet.mjs).
// Load in game with br.Prefab.Load "<game>" x y z 0 16 (owned by renderman so it can pay coins).
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const game = args.find(a => !a.startsWith('--'));
if (!game) throw new Error('usage: node arcade/build.mjs <game> [--chip-only]');
const dir = join(here, game);
const { generate } = await import(pathToFileURL(join(dir, 'gen.mjs')).href);
const gen = generate();
fs.writeFileSync(join(dir, `${game}.gen.ws`), gen.src);

const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default.wirescript_compile;
const diagnose = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
let compiled;
try {
  compiled = compile(gen.src, game, '{}', '{}');
} catch (e) {
  if (diagnose) {
    const d = diagnose(gen.src, game, '{}');
    console.error(typeof d === 'string' ? d : JSON.stringify(d, null, 1).slice(0, 6000));
  }
  throw e;
}
fs.mkdirSync(join(here, 'out'), { recursive: true });
fs.writeFileSync(join(here, 'out', `${game}.chip.brz`), new Uint8Array(compiled));
console.log(`${game}: chip compiled, ${compiled.length} bytes`);
if (args.includes('--chip-only')) process.exit(0);

const { buildCabinet } = await import(pathToFileURL(join(dir, 'cabinet.mjs')).href);
const out = buildCabinet(Buffer.from(compiled), gen);
fs.writeFileSync(join(here, 'out', `${game}.brz`), out);
console.log(`wrote arcade/out/${game}.brz (${out.length} bytes)`);
