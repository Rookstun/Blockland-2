// Builds skeleton_drop.brz with the coin prefabs embedded.
//   node coingen.mjs && node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;

const registry = {};
for (const c of ['coin1', 'coin10', 'coin25', 'heal', 'arrows', 'bullets']) registry[`./${c}.brz`] = Array.from(readFileSync(join(here, `${c}.brz`)));
const bytes = compileWs(readFileSync(join(here, 'skeleton_drop.ws'), 'utf-8'), 'skeleton_drop', '{}', JSON.stringify(registry));
writeFileSync(join(here, 'skeleton_drop.brz'), new Uint8Array(bytes));
console.log(`wrote skeleton_drop.brz (${bytes.length} bytes)`);
