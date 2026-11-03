// lib/cabinet.mjs: shared parts for arcade cabinets (from ddr/cabinet.mjs).
//   const cab = startCabinet(compiledChipBrz, { chipAt })
//   cab.box / cab.panel / cab.wireOut / cab.seat / cab.speakers ... then cab.finish()
// Prefab local: ground z = 0, the player faces +y, screens face -y (text bricks at
// y -2..0 in front of a body whose front face is y = 0).
import * as brs from '../../mapgen/lib/brs.mjs';

export const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'soapstain22', display_name: 'renderman' };
const GRID_OFFSET = 1024; // the writer adds -1024 to inner-grid positions
export const MB = 'PB_DefaultMicroBrick';
export const FACE_MINUS_Y = 13; // orientation: text face toward -y
export const TD = 'Component_TextDisplay';
export const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
export const GLOW = (c, i = 4) => ({ color: c, material: 'BMC_Glow', material_intensity: i });
export const METAL = c => ({ color: c, material: 'BMC_Metallic' });
export const TEXT = { // Font = index into externalAssets (set per build). LineHeight = glyph height in units.
  Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};

export function startCabinet(compiled, { chipAt = [0, 80, 2], plane = { X: 128, Y: 128, Z: 2 } } = {}) {
  const r = brs.WorldReader.from(compiled);
  const assets = r.brickAssets(), ext = r.externalAssets();
  const font = name => { let i = ext.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === name); if (i < 0) { ext.push({ type: 'BrickFontDescriptor', name }); i = ext.length - 1; } return i; };
  const comps = g => { const out = new Map(); for (const { index } of r.brickChunkIndex(g)) for (const c of r.componentChunk(g, index).components) (out.get(c.brickIndex) ?? out.set(c.brickIndex, []).get(c.brickIndex)).push({ type: c.typeName, data: c.data }); return out; };
  const wires = g => { const out = []; for (const { index } of r.brickChunkIndex(g)) { try { out.push(...r.wireChunk(g, index).local); } catch {} } return out; };

  const w = new brs.World();
  const owner = w.addOwner(OWNER);
  const box = (x0, y0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: owner });
  // a text panel facing -y: x0..x1, z0..z1, its back on y = yBack (front face 2 units further toward -y)
  const panel = (x0, x1, z0, z1, data, { yBack = 0, color = [6, 6, 10] } = {}) => w.addBrick({ asset: MB, color, direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3,
    size: [Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, 1], position: [(x0 + x1) / 2, yBack - 1, (z0 + z1) / 2], owner_index: owner, components: [{ type: TD, data: { ...TEXT, ...data } }] });

  // the chip and its gates, copied onto a microchip of our own
  const chip = w.addMicrochip({ position: chipAt, owner_index: owner, planeExtent: plane });
  const gates = [...r.bricks(2)], gcomps = comps(2), ref = [];
  for (let i = 0; i < gates.length; i++) {
    const b = gates[i];
    ref[i] = w.addBrick({ asset: assets[b.asset_name_index], size: b.size, position: b.position.map(v => v + GRID_OFFSET), direction: b.direction, rotation: b.rotation,
      color: b.color, owner_index: owner, components: gcomps.get(i) ?? [] }, { grid: chip.grid.grid });
  }
  const local = wires(2);
  for (const x of local) w.addWire({ brick: ref[x.source.brickIndex], component_type: x.source.componentType, port: x.source.port },
    { brick: ref[x.target.brickIndex], component_type: x.target.componentType, port: x.target.port });
  const outSrc = new Map(), inGate = new Map();
  gcomps.forEach((cs, i) => { for (const c of cs) {
    if (c.type === 'BrickComponentType_Internal_MicrochipOutput') { const feed = local.find(x => x.target.brickIndex === i); if (feed) outSrc.set(c.data.PortLabel, feed.source); }
    if (c.type === 'BrickComponentType_Internal_MicrochipInput') inGate.set(c.data.PortLabel, i);
  } });
  const wireOut = (port, brick, component_type, target) => {
    const src = outSrc.get(port);
    if (!src) throw new Error(`no out port "${port}" (have ${[...outSrc.keys()].join(', ')})`);
    w.addWire({ brick: ref[src.brickIndex], component_type: src.componentType, port: src.port }, { brick, component_type, port: target });
  };
  const wireIn = (port, brick, component_type, source) => {
    const ig = inGate.get(port);
    if (ig === undefined) throw new Error(`chip has no "${port}" input`);
    w.addWire({ brick, component_type, port: source }, { brick: ref[ig], component_type: 'BrickComponentType_Internal_MicrochipInput', port: 'RER_Input' });
  };
  // a seat facing +y whose sitter goes to the chip's `port` input (W/A/S/D via InputReader)
  const seat = (x, y, z, port = 'player', label = 'Play') => {
    const s = w.addBrick({ asset: 'B_Seat', position: [x, y, z], direction: 4, rotation: 0, color: [20, 20, 24], owner_index: owner,
      components: [{ type: 'Component_Internal_Seat', data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: label } }] });
    wireIn(port, s, 'Component_Internal_Seat', 'SittingCharacter');
    return s;
  };
  // synth speakers on the chip grid, pitch/volume from outs P<v>/V<v>
  const synthAssets = [];
  const speakers = (synths, { inner = 120, range = 400 } = {}) => {
    const maxX = Math.max(...gates.map(b => b.position[0] + GRID_OFFSET)), y0 = Math.min(...gates.map(b => b.position[1] + GRID_OFFSET));
    const gz = gates[0].position[2] + GRID_OFFSET;
    for (const s of synths) if (!synthAssets.includes(`BA_Synth_Basic_${s}`)) synthAssets.push(`BA_Synth_Basic_${s}`);
    synths.forEach((s, v) => {
      const sp = w.addBrick({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + (v % 4) * 10, y0 + Math.floor(v / 4) * 10, gz], color: [30, 30, 30], owner_index: owner,
        components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: -1, VolumeMultiplier: 0, PitchMultiplier: 1,
          InnerRadius: inner, MaxDistance: range, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] }, { grid: chip.grid.grid });
      sp._synth = `BA_Synth_Basic_${s}`;
      spk.push(sp);
      wireOut(`P${v}`, sp, 'Component_AudioEmitter', 'PitchMultiplier');
      wireOut(`V${v}`, sp, 'Component_AudioEmitter', 'VolumeMultiplier');
    });
  };
  const spk = [];
  const finish = () => {
    // audio descriptors come after the chip's own external assets
    for (const sp of spk) {
      const brick = w.gridBrickInputs[sp.grid][sp.index];
      brick.components[0].data.AudioDescriptor = ext.length + synthAssets.indexOf(sp._synth);
    }
    w.makePrefab({});
    return w.toBrz({ externalAssets: [...ext, ...synthAssets.map(name => ({ type: 'BrickAudioDescriptor', name }))] });
  };
  return { w, owner, box, panel, font, wireOut, wireIn, seat, speakers, finish };
}
