// Builds the pot pieces:  node build.mjs
//   pot_pool.brz  the loot-pool chip (pot_pool.ws, coins embedded), re-owned by the server owner
// (pot.brz itself is built on the server by bridge/tools/potgen5.mjs)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, '..', 'pikmin', 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const registry = {};
for (const c of ['coin1', 'coin10', 'coin25', 'heal_small', 'heal_medium', 'heal_large', 'arrows', 'ammo_blackpowder', 'ammo_explosive', 'ammo_heavy', 'ammo_light', 'ammo_magnum', 'ammo_medium', 'ammo_plasma', 'ammo_pulse', 'ammo_shotgun']) registry[`./${c}.brz`] = Array.from(readFileSync(join(here, `${c}.brz`)));
const bytes = compileWs(readFileSync(join(here, 'pot_pool.ws'), 'utf-8'), 'pot_pool', '{}', JSON.stringify(registry));
writeFileSync(join(here, 'pot_pool.compiled.brz'), new Uint8Array(bytes));
console.log(`compiled pot_pool (${bytes.length} bytes)`);
const { reown } = await import('./reown.mjs');
writeFileSync(join(here, 'pot_pool.brz'), reown(bytes));
console.log('wrote pot_pool.brz (owner renderman). Deploy: scp to data/Saved/Prefabs/, br.Prefab.Load "pot_pool" -8080 -7400 8000 0 16 (ONE copy)');
