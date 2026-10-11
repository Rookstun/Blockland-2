// wsdevice.mjs: a Wirescript chip that plays the game's synth speakers.
//
// Wirescript has no speaker bricks, so this compiles the .ws, re-emits the
// chip brick for brick (gates, components, wires) through the brs World
// writer, and adds AudioEmitter speakers (B_1x1F_Speaker) on the chip's inner
// grid, each wired from the value that feeds one of the chip's `out` ports:
//   speakers: [{ sound: 'BA_Synth_Basic_Sine', pitch: 'P1', volume: 'V1' }]
// pitch/volume name `out` ports (the speaker's PitchMultiplier /
// VolumeMultiplier follow them); a number instead sets it once.
//
//   import { buildDevice } from './wsdevice.mjs'
//   fs.writeFileSync('x.brz', await buildDevice(wsSource, 'name', speakers))

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const sdk = join(root, 'pikmin', 'tools', 'wirescript', 'pkg');
let compileWs;
async function compiler() {
  if (compileWs) return compileWs;
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: readFileSync(join(sdk, 'wasm_bg.wasm')) });
  return (compileWs = wasm.wirescript_compile ?? wasm.default.wirescript_compile);
}
const brs = await import(pathToFileURL(join(root, 'mapgen', 'lib', 'brs.mjs')).href);

const GRID_OFFSET = 1024; // the writer adds -1024 to inner-grid positions

export async function buildDevice(source, name, speakers, { range = 3000, inner = 400, spatial = true } = {}) {
  const compiled = (await compiler())(source, name, '{}', '{}');
  const r = brs.WorldReader.from(Buffer.from(compiled));
  const assets = r.brickAssets();
  const comps = g => { const out = new Map(); for (const { index } of r.brickChunkIndex(g)) for (const c of r.componentChunk(g, index).components) (out.get(c.brickIndex) ?? out.set(c.brickIndex, []).get(c.brickIndex)).push({ type: c.typeName, data: c.data }); return out; };
  const wires = g => { const out = []; for (const { index } of r.brickChunkIndex(g)) { try { out.push(...r.wireChunk(g, index).local); } catch {} } return out; };

  const w = new brs.World();
  const owner = w.addOwner({ id: '00000000-0000-0000-0000-00000000c0de', name });
  // the chip itself (grid 1 brick 0) and its gates (grid 2)
  const chipBrick = [...r.bricks(1)][0];
  const chip = w.addMicrochip({ position: chipBrick.position, owner_index: owner, planeExtent: { X: 64, Y: 64, Z: 2 } });
  const c1 = comps(1).get(0) ?? [];
  // the label (TextDisplay) on the chip brick
  for (const c of c1) if (c.type !== 'Component_Internal_Microchip') w.bricks?.[chip.brick]?.components?.push?.(c);
  const gates = [...r.bricks(2)], gcomps = comps(2), ref = [];
  for (let i = 0; i < gates.length; i++) {
    const b = gates[i];
    ref[i] = w.addBrick({ asset: assets[b.asset_name_index], size: b.size, position: b.position.map((v, k) => (k < 2 ? v + GRID_OFFSET : v + GRID_OFFSET)), direction: b.direction, rotation: b.rotation,
      color: b.color, owner_index: owner, components: gcomps.get(i) ?? [] }, { grid: chip.grid.grid });
  }
  const local = wires(2);
  for (const x of local) w.addWire({ brick: ref[x.source.brickIndex], component_type: x.source.componentType, port: x.source.port },
    { brick: ref[x.target.brickIndex], component_type: x.target.componentType, port: x.target.port });
  // which wire source feeds each `out` port
  const outSrc = new Map();
  (gcomps.forEach((cs, i) => { for (const c of cs) if (c.type === 'BrickComponentType_Internal_MicrochipOutput') {
    const feed = local.find(x => x.target.brickIndex === i);
    if (feed) outSrc.set(c.data.PortLabel, feed.source);
  } }));
  // speakers in a row on the inner grid, beyond the gates
  const maxX = Math.max(...gates.map(b => b.position[0] + GRID_OFFSET)), y0 = Math.min(...gates.map(b => b.position[1] + GRID_OFFSET));
  const z = gates[0] ? gates[0].position[2] + GRID_OFFSET : 2;
  const sounds = [...new Set(speakers.map(s => s.sound))];
  speakers.forEach((s, k) => {
    const data = { bEnabled: true, AudioDescriptor: 1 + sounds.indexOf(s.sound), VolumeMultiplier: typeof s.volume === 'number' ? s.volume : 0, PitchMultiplier: typeof s.pitch === 'number' ? s.pitch : 1,
      InnerRadius: inner, MaxDistance: range, bSpatialization: spatial, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 };
    const sp = w.addBrick({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + (k % 4) * 10, y0 + Math.floor(k / 4) * 10, z], color: [30, 30, 30], owner_index: owner,
      components: [{ type: 'Component_AudioEmitter', data }] }, { grid: chip.grid.grid });
    for (const [port, out] of [['PitchMultiplier', s.pitch], ['VolumeMultiplier', s.volume]]) {
      if (typeof out !== 'string') continue;
      const src = outSrc.get(out);
      if (!src) throw new Error(`no out port "${out}" (have ${[...outSrc.keys()].join(', ')})`);
      w.addWire({ brick: ref[src.brickIndex], component_type: src.componentType, port: src.port }, { brick: sp, component_type: 'Component_AudioEmitter', port });
    }
  });
  w.makePrefab({});
  return w.toBrz({ externalAssets: [{ type: 'BrickFontDescriptor', name: 'MonaspaceXenon' }, ...sounds.map(s => ({ type: s.startsWith('OBA') ? 'BrickOneShotAudioDescriptor' : 'BrickAudioDescriptor', name: s }))] });
}
