// cabinet.mjs: the physical DDR machine (half scale, 1 player) around the chip.
//   buildCabinet(compiledChipBrz, voiceSynths) -> prefab .brz bytes
//
// Prefab local, ground z = 0, the dancers face +y. The world is left-handed:
// +x is the dancers' LEFT, so P1 (left stage) sits at +x and every lane row
// runs LEFT DOWN UP RIGHT from +x to -x.
//   stages  centred at x +48 (P1) / -48 (P2), y -124..-38: 3x3 panels, arrow
//           pads (TextDisplay arrows lit from pad<p><k>), the Seat in the
//           centre (Sitting Character -> the chip's player<p> port), bar behind.
//   cabinet x -78..78, y 0..35: the screen = TextDisplay bricks on its front
//           (y -2..0) wired from chip outs: title across the top, per player a
//           score/combo row, judgement, 4 receptors, 4 lanes (LineOffset <- scroll).
//   towers, marquee; the chip (with its synth speakers) behind the cabinet.
import * as brs from '../mapgen/lib/brs.mjs';

const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'soapstain22', display_name: 'renderman' };
const GRID_OFFSET = 1024; // the writer adds -1024 to inner-grid positions
const MB = 'PB_DefaultMicroBrick';
const FACE_MINUS_Y = 13;  // orientation: text face toward -y (casinogen/ruins)
const LANE_COL = [[255, 70, 210], [60, 210, 255], [90, 255, 120], [255, 170, 40]];
const ARROWS = ['←', '↓', '↑', '→'];
const FONT = 'IosevkaTerm'; // monospace, has the arrow glyphs
const TEXT = { // Font = index of FONT in the externalAssets (set per build). LineHeight = glyph height in units.
  Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 1,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};
const rgba = ([R, G, B]) => ({ R, G, B, A: 255 });
const GLOW = (c, i = 4) => ({ color: c, material: 'BMC_Glow', material_intensity: i });
const METAL = c => ({ color: c, material: 'BMC_Metallic' });
const TD = 'Component_TextDisplay';
const PINK = [255, 60, 200], CYAN = [60, 200, 255], BODY = [18, 18, 24];

export function buildCabinet(compiled, synths, { range = 3000, inner = 600 } = {}) {
  const r = brs.WorldReader.from(compiled);
  const assets = r.brickAssets(), ext = r.externalAssets();
  if (!ext.some(e => e.type === 'BrickFontDescriptor' && e.name === FONT)) ext.push({ type: 'BrickFontDescriptor', name: FONT });
  TEXT.Font = ext.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === FONT);
  const comps = g => { const out = new Map(); for (const { index } of r.brickChunkIndex(g)) for (const c of r.componentChunk(g, index).components) (out.get(c.brickIndex) ?? out.set(c.brickIndex, []).get(c.brickIndex)).push({ type: c.typeName, data: c.data }); return out; };
  const wires = g => { const out = []; for (const { index } of r.brickChunkIndex(g)) { try { out.push(...r.wireChunk(g, index).local); } catch {} } return out; };

  const w = new brs.World();
  const owner = w.addOwner(OWNER);
  const box = (x0, y0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: owner });
  // a text panel on the cabinet front, x0..x1 (any order), z0..z1, facing the dancers
  const panel = (x0, x1, z0, z1, data) => w.addBrick({ asset: MB, color: [6, 6, 10], direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3,
    size: [Math.abs(x1 - x0) / 2, (z1 - z0) / 2, 1], position: [(x0 + x1) / 2, -1, (z0 + z1) / 2], owner_index: owner, components: [{ type: TD, data: { ...TEXT, ...data } }] });

  // ---- the chip and its gates (the pin rerouters are dropped: the Seats wire straight in)
  const chip = w.addMicrochip({ position: [0, 42, 2], owner_index: owner, planeExtent: { X: 128, Y: 128, Z: 2 } });
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

  // ---- synth speakers on the chip's inner grid
  const SYN = [...new Set(synths)].map(s => `BA_Synth_Basic_${s}`);
  const maxX = Math.max(...gates.map(b => b.position[0] + GRID_OFFSET)), y0 = Math.min(...gates.map(b => b.position[1] + GRID_OFFSET));
  const gz = gates[0].position[2] + GRID_OFFSET;
  synths.forEach((s, v) => {
    const sp = w.addBrick({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + (v % 4) * 10, y0 + Math.floor(v / 4) * 10, gz], color: [30, 30, 30], owner_index: owner,
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: ext.length + SYN.indexOf(`BA_Synth_Basic_${s}`), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: inner, MaxDistance: range, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] }, { grid: chip.grid.grid });
    wireOut(`P${v}`, sp, 'Component_AudioEmitter', 'PitchMultiplier');
    wireOut(`V${v}`, sp, 'Component_AudioEmitter', 'VolumeMultiplier');
  });

  // ---- the floor: walkway to the cabinet, then a stage per player
  box(-50, -38, 0, 50, -4, 6, METAL([40, 40, 46]));
  const later = []; // wires into stage bricks after the screen's
  const CY = [-106, -80, -54];                                     // rows: DOWN, seat, UP
  {
    const sx = 0, trim = PINK;
    const CX = [sx + 26, sx, sx - 26];                               // cols: LEFT (+x), centre, RIGHT
    box(sx - 41, -124, 0, sx + 41, -38, 6, METAL([40, 40, 46]));
    box(sx - 41, -124, 6, sx + 41, -122, 8, GLOW(trim, 3));
    box(sx - 41, -40, 6, sx + 41, -38, 8, GLOW(trim, 3));
    box(sx - 41, -122, 6, sx - 39, -40, 8, GLOW(trim, 3));
    box(sx + 39, -122, 6, sx + 41, -40, 8, GLOW(trim, 3));
    const padAt = [[0, 1], [1, 0], [1, 2], [2, 1]];                  // lane -> (col,row)
    for (let cx = 0; cx < 3; cx++) for (let cy = 0; cy < 3; cy++) {
      const x = CX[cx], y = CY[cy], k = padAt.findIndex(([a, b]) => a === cx && b === cy);
      box(x - 13, y - 13, 6, x + 13, y + 13, 8, METAL([150, 150, 160]));   // steel frame
      if (k < 0) { box(x - 11, y - 11, 8, x + 11, y + 11, 10, METAL(cx === 1 && cy === 1 ? [60, 60, 70] : [110, 110, 120])); continue; }
      const pad = w.addBrick({ asset: MB, color: LANE_COL[k].map(c => Math.round(c * 0.35)), size: [11, 11, 1], position: [x, y, 9], owner_index: owner,
        components: [{ type: TD, data: { ...TEXT, Text: ARROWS[k], Rotation: 0, LineHeight: 17, Color: rgba([40, 40, 50]), OutlineWidth: 2 } }] });
      later.push(() => { wireOut(`pad${k}`, pad, TD, 'Color'); wireOut('rainbow_c', pad, TD, 'OutlineColor'); });
    }
    // the seat on the centre panel: W/A/S/D go through the chip's input splitter
    const seat = w.addBrick({ asset: 'B_Seat', position: [sx, -80, 21], direction: 4, rotation: 0, color: [20, 20, 24], owner_index: owner,
      components: [{ type: 'Component_Internal_Seat', data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: 'Dance' } }] });
    const ig = inGate.get('player');
    if (ig === undefined) throw new Error('chip has no "player" input');
    w.addWire({ brick: seat, component_type: 'Component_Internal_Seat', port: 'SittingCharacter' }, { brick: ref[ig], component_type: 'BrickComponentType_Internal_MicrochipInput', port: 'RER_Input' });
    // safety bar behind, with a P1/P2 sign
    for (const x of [sx - 38, sx + 38]) box(x - 2, -122, 8, x + 2, -118, 54, METAL([200, 200, 210]));
    box(sx - 40, -122, 54, sx + 40, -118, 58, METAL([200, 200, 210]));
    box(sx - 40, -122, 58, sx + 40, -118, 60, GLOW(trim, 3));
  }

  // ---- cabinet body
  box(-78, 0, 0, 78, 36, 12, { color: BODY });                               // base
  box(-78, -4, 6, 78, 0, 12, { color: [24, 24, 32] });                        // kick plate
  box(-60, -6, 8, 60, -4, 10, GLOW(PINK, 2));                                 // logo strip
  box(-78, 0, 12, -72, 36, 140, { color: BODY });                             // screen surround
  box(72, 0, 12, 78, 36, 140, { color: BODY });
  box(-72, 0, 12, 72, 36, 14, { color: BODY });
  box(-72, 0, 122, 72, 36, 140, { color: BODY });
  box(-72, 2, 14, 72, 36, 122, { color: [4, 4, 6] });                         // screen back
  box(-72, 0, 14, -70, 2, 122, GLOW(CYAN, 3));                                // bezel neon
  box(70, 0, 14, 72, 2, 122, GLOW(CYAN, 3));
  box(-70, 0, 14, 70, 2, 16, GLOW(CYAN, 3));
  box(-70, 0, 120, 70, 2, 122, GLOW(CYAN, 3));
  box(-70, 0, 16, 70, 2, 120, { color: [4, 4, 6] });
  // the screen, in front of the black back, panels edge to edge (no gaps): title on top,
  // receptors + 4 lanes in the middle, score/combo on the dancer's left (+x), judgement on the right
  const title = panel(70, -70, 98, 120, { Text: 'SIT DOWN TO DANCE', Color: rgba([255, 120, 230]), LineHeight: 3 });
  wireOut('title_t', title, TD, 'Text');
  const info = panel(70, 32, 78, 98, { Text: '', LineHeight: 4, Color: rgba([255, 255, 255]) });
  wireOut('info_t', info, TD, 'Text');
  const combo = panel(70, 32, 58, 78, { Text: '', LineHeight: 3.5, Color: rgba([255, 225, 60]) });
  wireOut('combo_t', combo, TD, 'Text');
  panel(70, 32, 16, 58, { Text: '' });
  const judge = panel(-32, -70, 74, 98, { Text: '', LineHeight: 5, Color: rgba([255, 255, 255]) });
  wireOut('judge_t', judge, TD, 'Text');
  wireOut('judge_c', judge, TD, 'Color');
  const LANE_W = 16;
  for (let k = 0; k < 4; k++) {
    const x0 = 32 - k * LANE_W, x1 = x0 - LANE_W;                      // LEFT lane at +x (the dancer's left)
    const rec = panel(x0, x1, 90, 98, { Text: ARROWS[k], LineHeight: 5, OutlineWidth: 2, Color: rgba([70, 70, 80]) });
    wireOut(`rec${k}`, rec, TD, 'Color');
    wireOut('rainbow_c', rec, TD, 'OutlineColor');
    const lane = panel(x0, x1, 16, 90, { Text: '', LineHeight: 4, OutlineWidth: 2, Color: rgba(LANE_COL[k]) });
    wireOut(`lane${k}`, lane, TD, 'Text');
    wireOut('rainbow_c', lane, TD, 'OutlineColor');
  }
  // Offset test markers (which axis moves text on the face?): none / X / Y / Z by 8 units
  [[0, 0, 0], [8, 0, 0], [0, 8, 0], [0, 0, 8]].forEach(([X, Y, Z], i) =>
    panel(-32, -70, [16, 30, 44, 58][i], [30, 44, 58, 74][i], { Text: ['O', 'X', 'Y', 'Z'][i], LineHeight: 5, Offset: { X, Y, Z }, Color: rgba([255, 255, 255]) }));
  // beat lamps: dots above the screen + one on each marquee end, colour + real light pulse on the beat
  const LIGHT = { type: 'Component_PointLight', data: { bMatchBrickShape: false, bEnabled: true, Brightness: 0, Radius: 220, Color: rgba(PINK), bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } };
  const lamp = (x0, x1, z0, z1, y, text) => {
    const b = w.addBrick({ asset: MB, color: [10, 4, 14], direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3, size: [Math.abs(x1 - x0) / 2, (z1 - z0) / 2, 1],
      position: [(x0 + x1) / 2, y, (z0 + z1) / 2], owner_index: owner, components: [{ type: TD, data: { ...TEXT, Text: text, LineHeight: z1 - z0 - 2, Color: rgba([60, 20, 50]) } }, LIGHT] });
    wireOut('beat_c', b, TD, 'Color');
    wireOut('beat_b', b, 'Component_PointLight', 'Brightness');
    wireOut('lamp_c', b, 'Component_PointLight', 'Color');
  };
  lamp(60, -60, 126, 136, -1, '● ● ● ● ● ● ● ●');
  lamp(92, 82, 146, 158, -7, '●');
  lamp(-82, -92, 146, 158, -7, '●');
  for (const f of later) f();

  // ---- speaker towers
  for (const s of [-1, 1]) {
    const xa = s < 0 ? -94 : 78, xb = s < 0 ? -78 : 94, neon = s < 0 ? CYAN : PINK;
    box(xa, 2, 0, xb, 34, 110, { color: [24, 24, 32] });
    for (let z = 12; z < 100; z += 24) {
      box(xa + 2, 0, z, xb - 2, 2, z + 18, { color: [60, 60, 66] });        // grille
      box(xa + 4, -2, z + 4, xb - 4, 0, z + 14, GLOW(neon, 2));
    }
    box(s < 0 ? -96 : 94, 2, 0, s < 0 ? -94 : 96, 34, 110, GLOW(neon, 3));
  }
  // ---- marquee
  box(-96, -6, 140, 96, 36, 142, METAL([200, 200, 210]));
  box(-96, -4, 142, 96, 36, 162, { color: [30, 10, 40] });
  w.addBrick({ asset: MB, ...GLOW([60, 10, 80], 1), direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3, size: [92, 9, 1], position: [0, -5, 152], owner_index: owner,
    components: [{ type: TD, data: { ...TEXT, Text: 'DANCE DANCE\nBRICKOLUTION', Color: rgba([255, 230, 90]), OutlineColor: rgba([255, 40, 160]), OutlineWidth: 2, LineHeight: 7.5 } }] });
  box(-96, -6, 162, 96, 36, 164, METAL([200, 200, 210]));
  box(-80, -8, 140, 80, -6, 142, GLOW(PINK, 4));

  w.makePrefab({});
  return w.toBrz({ externalAssets: [...ext, ...SYN.map(name => ({ type: 'BrickAudioDescriptor', name }))] });
}
