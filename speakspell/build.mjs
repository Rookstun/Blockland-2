// Builds speakspell.brz (the chip) from speakspell.ws:  node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const bytes = compileWs(readFileSync(join(here, 'speakspell.ws'), 'utf-8'), 'speakspell', '{}', '{}');
writeFileSync(join(here, 'speakspell.brz'), new Uint8Array(bytes));
console.log(`wrote speakspell.brz (${bytes.length} bytes)`);
