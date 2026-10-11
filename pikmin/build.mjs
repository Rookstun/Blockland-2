#!/usr/bin/env node
// Builds pikmin_onion.brz -- load it in Brickadia and place it on the ground.
//
//   node build.mjs
//
// 1. Generates the brick bodies (pikmin, onion, treasures) with brs-js.
// 2. Compiles pikmin_brain.ws and treasure_brain.ws with those bodies embedded.
// 3. Compiles onion.ws with the brains + onion body embedded.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const brsDist = join(here, '..', 'dependencies', 'brs-js-master', 'brs-js-master', 'dist', 'dist.mjs');
const { World, brdb } = await import(pathToFileURL(brsDist).href);
const A = brdb.BRICK_ASSETS;

const outDir = join(here, 'build');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- bodies ---

const NO_COLLISION = { player: false, weapon: false, interaction: false, physics: false };

/** Save a list of bricks as a spawnable prefab. Positions are brick centers,
 *  sizes are half-extents (a 1x1 brick is [5, 5, 6]). z = 0 is the ground. */
function prefab(name, bricks, { collision = true } = {}) {
  const w = new World();
  for (const b of bricks) {
    w.addBrick({
      asset: b.asset ?? A.PB_DefaultBrick,
      size: b.size,
      position: b.pos,
      color: b.color,
      collision: collision ? true : NO_COLLISION,
    });
  }
  w.makePrefab();
  const bytes = w.toBrz({ bundle: { name } });
  writeFileSync(join(outDir, `${name}.brz`), bytes);
  return bytes;
}

const micro = (size, pos, color) => ({ asset: A.PB_DefaultMicroBrick, size, pos, color });

function pikminBody(color, name) {
  const dark = color.map(c => Math.round(c * 0.7));
  const leaf = [60, 170, 60];
  const eye = [255, 255, 255];
  const pupil = [20, 20, 20];
  // Faces +X. Feet at z = 0, leaf tip at z = 46.
  return prefab(
    name,
    [
      micro([1, 1, 3], [0, -2, 3], dark), // legs
      micro([1, 1, 3], [0, 2, 3], dark),
      { asset: A.B_1x1_Round, pos: [0, 0, 12], color }, // body 6..18
      micro([1, 1, 4], [0, -6, 13], dark), // arms
      micro([1, 1, 4], [0, 6, 13], dark),
      { asset: A.B_2x2_Round, pos: [0, 0, 24], color }, // head 18..30
      micro([1, 2, 2], [10, -4, 25], eye), // eyes
      micro([1, 2, 2], [10, 4, 25], eye),
      micro([1, 1, 1], [11, -4, 25], pupil),
      micro([1, 1, 1], [11, 4, 25], pupil),
      micro([2, 1, 1], [11, 0, 21], dark), // nose
      micro([1, 1, 6], [0, 0, 36], leaf), // stem 30..42
      { asset: A.B_1x1F_Round, pos: [0, 0, 44], color: leaf }, // leaf 42..46
    ],
    { collision: false }
  );
}

const bodies = {
  './pikmin_red.brz': pikminBody([220, 40, 40], 'pikmin_red'),
  './pikmin_yellow.brz': pikminBody([245, 210, 40], 'pikmin_yellow'),
  './pikmin_blue.brz': pikminBody([50, 100, 230], 'pikmin_blue'),

  // Pellet (weight 1): a flat yellow disc.
  './treasure_pellet.brz': prefab('treasure_pellet', [
    { asset: A.B_2x2F_Round, pos: [0, 0, 2], color: [240, 200, 40] },
    { asset: A.B_2x2F_Round, pos: [0, 0, 6], color: [250, 220, 60] },
    { asset: A.B_2x2F_Round, pos: [0, 0, 10], color: [240, 200, 40] },
    { asset: A.B_1x1F_Round, pos: [0, 0, 14], color: [255, 255, 255] },
  ]),

  // Gem (weight 3): a cyan crystal.
  './treasure_gem.brz': prefab('treasure_gem', [
    { asset: A.B_4x4_Round, pos: [0, 0, 6], color: [20, 150, 170] },
    { asset: A.B_2x2_Round, pos: [0, 0, 18], color: [40, 210, 230] },
    { asset: A.B_2x_Octo_Cone, pos: [0, 0, 34], color: [120, 240, 255] },
  ]),

  // Chest (weight 8): a wooden box with a gold lid and lock.
  './treasure_chest.brz': prefab('treasure_chest', [
    { size: [40, 30, 15], pos: [0, 0, 15], color: [120, 75, 35] },
    { size: [42, 32, 5], pos: [0, 0, 35], color: [230, 180, 40] },
    { size: [2, 32, 16], pos: [-20, 0, 16], color: [230, 180, 40] },
    { size: [2, 32, 16], pos: [20, 0, 16], color: [230, 180, 40] },
    micro([2, 4, 5], [42, 0, 26], [250, 220, 90]),
  ]),
};

// Onion: three legs holding up a stepped bulb, flower on top. Base at z = 0.
{
  const red = [200, 40, 45];
  const stalk = [235, 225, 200];
  const bricks = [];
  for (const deg of [0, 120, 240]) {
    const a = (deg * Math.PI) / 180;
    const x = Math.round((Math.cos(a) * 60) / 5) * 5;
    const y = Math.round((Math.sin(a) * 60) / 5) * 5;
    bricks.push({ size: [4, 4, 40], pos: [x, y, 40], color: stalk });
    bricks.push({ asset: A.B_2x2F_Round, pos: [x, y, 2], color: stalk }); // foot
  }
  // Bulb layers (half-width), 12 units tall each, from z = 80.
  const layers = [35, 50, 60, 65, 65, 60, 50, 35, 20];
  layers.forEach((hw, i) => {
    const z = 80 + i * 12 + 6;
    bricks.push({ size: [hw, hw - 10, 6], pos: [0, 0, z], color: red });
    bricks.push({ size: [hw - 10, hw, 6], pos: [0, 0, z], color: red });
  });
  const top = 80 + layers.length * 12;
  bricks.push({ asset: A.B_2x2F_Round, pos: [0, 0, top + 2], color: stalk });
  bricks.push({ size: [2, 2, 10], pos: [0, 0, top + 14], color: [60, 170, 60] });
  bricks.push({ asset: A.B_Flower, pos: [0, 0, top + 26], color: [255, 255, 255] });
  // Glowing mouth ring underneath the bulb.
  bricks.push({ asset: A.B_4x4_Round, pos: [0, 0, 74], color: [255, 230, 120] });
  bodies['./onion_body.brz'] = prefab('onion_body', bricks);
}

// --------------------------------------------------------------- compile ---

const sdk = join(here, 'tools', 'wirescript', 'pkg');
const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') {
  await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
}
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;

function compile(file, prefabs) {
  const source = readFileSync(join(here, file), 'utf-8');
  const registry = {};
  for (const [path, bytes] of Object.entries(prefabs)) registry[path] = Array.from(bytes);
  try {
    const bytes = compileWs(source, file.replace(/\.ws$/, ''), '{}', JSON.stringify(registry));
    return new Uint8Array(bytes);
  } catch (e) {
    console.error(`${file}:\n${e}`);
    process.exit(1);
  }
}

const pikminBrain = compile('pikmin_brain.ws', bodies);
writeFileSync(join(outDir, 'pikmin_brain.brz'), pikminBrain);

const treasureBrain = compile('treasure_brain.ws', bodies);
writeFileSync(join(outDir, 'treasure_brain.brz'), treasureBrain);

const onion = compile('onion.ws', {
  ...bodies,
  './pikmin_brain.brz': pikminBrain,
  './treasure_brain.brz': treasureBrain,
});
const outFile = join(here, 'pikmin_onion.brz');
writeFileSync(outFile, onion);

const kb = n => `${(n / 1024).toFixed(0)} KB`;
console.log(`pikmin_brain.brz   ${kb(pikminBrain.length)}`);
console.log(`treasure_brain.brz ${kb(treasureBrain.length)}`);
console.log(`pikmin_onion.brz   ${kb(onion.length)}  <- load this one`);
console.log(outFile);
