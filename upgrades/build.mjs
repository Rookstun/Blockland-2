// Compiles upgrades.ws (the sky chip) with the current compiler, owned by renderman (pays coins).
//   node upgrades/gen.mjs && node upgrades/build.mjs -> upgrades/upgrades.brz
// Deploy: scp to data/Saved/Prefabs/, br.Prefab.Load "upgrades" -8420 -7400 8000 0 16 (ONE copy)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default.wirescript_compile;
const bytes = compile(readFileSync(join(here, 'upgrades.ws'), 'utf-8'), 'upgrades', '{}', '{}');
const { reown } = await import('../pots/reown.mjs');
writeFileSync(join(here, 'upgrades.brz'), reown(bytes));
console.log(`wrote upgrades/upgrades.brz (${bytes.length} bytes)`);
