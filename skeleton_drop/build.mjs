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
for (const c of ['coin1', 'coin10', 'coin25', 'heal_small', 'heal_medium', 'heal_large', 'arrows', 'ammo_blackpowder', 'ammo_explosive', 'ammo_heavy', 'ammo_light', 'ammo_magnum', 'ammo_medium', 'ammo_plasma', 'ammo_pulse', 'ammo_shotgun', 'item_soda', 'item_syringe', 'item_potion', 'item_bandage']) registry[`./${c}.brz`] = Array.from(readFileSync(join(here, `${c}.brz`)));
const bytes = compileWs(readFileSync(join(here, 'skeleton_drop.ws'), 'utf-8'), 'skeleton_drop', '{}', JSON.stringify(registry));
// (2026-10-16) the game (EA3.2) can't Prefab.Load the compiler's old-format output (its map Vars:
// "While reading dynamic map length: mpack_error_type"): migrate to the Latest format with brs-js 4
// (tools/to_latest.mjs; tools/brs4/dist.mjs is gitignored and locally patched for empty maps)
writeFileSync(join(here, 'skeleton_drop.ea3.brz'), new Uint8Array(bytes));
const { execFileSync } = await import('node:child_process');
execFileSync(process.execPath, [join(here, '..', 'tools', 'to_latest.mjs'), join(here, 'skeleton_drop.ea3.brz'), join(here, 'skeleton_drop.brz')], { stdio: 'inherit' });
console.log(`wrote skeleton_drop.brz (Latest format; compiled ${bytes.length} bytes)`);
