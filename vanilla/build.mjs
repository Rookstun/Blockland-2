// Compiles melee.ws -> melee.brz. Deploy: Prefabs/melee.brz, br.Prefab.Load "melee" 1000 0 20 0 16 (ONE copy)



import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default.wirescript_compile;
const bytes = compile(readFileSync(join(here, 'melee.ws'), 'utf-8'), 'melee', '{}', '{}');
const { reown } = await import('../pots/reown.mjs');
writeFileSync(join(here, 'melee.brz'), reown(bytes));
console.log(`wrote vanilla/melee.brz (${bytes.length} bytes)`);
