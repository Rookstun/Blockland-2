// Builds the casino's house chip:  node casino_build.mjs  -> casino_house.brz (owner renderman)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const bytes = compileWs(readFileSync(join(here, 'casino.ws'), 'utf-8'), 'casino_house', '{}', '{}');
const { reown } = await import('./reown.mjs');
writeFileSync(join(here, 'casino_house.brz'), reown(bytes));
console.log(`wrote casino_house.brz (${bytes.length} bytes)`);
