// cabinet.mjs: the physical DDR machine (half scale, 1 player) around the chip.
//   await buildCabinet(compiledChipBrz, voiceSynths, { drums: drumSynths }) -> prefab .brz bytes (Latest format)
//
// Prefab local, ground z = 0, the dancers face +y. The world is left-handed:
// +x is the dancers' LEFT, so P1 (left stage) sits at +x and every lane row
// runs LEFT DOWN UP RIGHT from +x to -x.
//   stages  centred at x +48 (P1) / -48 (P2), y -124..-38: 3x3 panels, arrow
//           pads (TextDisplay arrows lit from pad<p><k>), the Seat in the
//           centre (Sitting Character -> the chip's player<p> port), bar behind.
//   cabinet x -78..78, y 0..35: the screen = TextDisplay bricks on its front
//           (y -2..0) wired from chip outs: title across the top, per player a
//           score/combo, judgement, 4 receptors, 4 lanes of Offset-driven arrow sprites.
//   towers, marquee; the chip (with its synth speakers) behind the cabinet.
import { bundle } from '../tools/wsbundle.mjs';
import { K, STRIP_Z0, STRIP_H } from './wsgen.mjs';

const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'soapstain22', display_name: 'renderman' };
const MB = 'PB_DefaultMicroBrick';
const FACE_MINUS_Y = 13;  // orientation: text face toward -y (casinogen/ruins)
const LANE_COL = [[255, 70, 210], [60, 210, 255], [90, 255, 120], [255, 170, 40]];
const ARROWS = ['←', '↓', '↑', '→'];
const FONT = 'MonaspaceXenon', ARROW_FONT = 'MonaspaceXenon'; // owner's pick, words and arrows
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

// compiled = tools/wspkg chip bytes (Latest format); synths = the P/V voices' synths, drums = the DP/DA drum voices' synths
export async function buildCabinet(compiled, synths, { drums = [], range = 3000, inner = 600 } = {}) {
  // one hidden chip lying behind the cabinet; bare: the seat and screen wire straight to its port gates
  const b = await bundle(compiled, { owner: OWNER, offset: [0, 42, 2], hide: true, bare: true });
  const { w, O: owner } = b;
  // non-synth speakers (car horns): pitch 1 = the sample's own pitch, not A440
  const ASSET = { HornSmall: 'BA_AMB_Component_Horn_Car_Small', HornGeneric: 'BA_AMB_Component_Horn_Car_Generic', Noise: 'BA_Synth_Noise_White', NoisePink: 'BA_Synth_Noise_Pink' };
  const asset = s => ASSET[s] ?? `BA_Synth_Basic_${s}`;
  const SYN = [...new Set([...synths, ...drums].map(asset))];
  const ext = [...b.ext, ...SYN.map(name => ({ type: 'BrickAudioDescriptor', name }))];
  const fontIdx = name => { let i = ext.findIndex(e => e.type === 'BrickFontDescriptor' && e.name === name); if (i < 0) { ext.push({ type: 'BrickFontDescriptor', name }); i = ext.length - 1; } return i; };
  TEXT.Font = fontIdx(FONT);
  const AF = fontIdx(ARROW_FONT);
  const box = (x0, y0, z0, x1, y1, z1, m = {}) => w.addBrick({ asset: MB, ...m, size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: owner });
  // a text panel on the cabinet front, x0..x1 (any order), z0..z1, facing the dancers
  const panel = (x0, x1, z0, z1, data) => w.addBrick({ asset: MB, color: [6, 6, 10], direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3,
    size: [Math.abs(x1 - x0) / 2, (z1 - z0) / 2, 1], position: [(x0 + x1) / 2, -1, (z0 + z1) / 2], owner_index: owner, components: [{ type: TD, data: { ...TEXT, ...data } }] });
  const wireOut = (port, brick, component_type, target) => w.addWire(b.outSource(port), { brick, component_type, port: target });

  // ---- synth speakers on the chip's own plane, past its gates: voices then drums
  const maxX = Math.max(...b.rootPos.map(p => p[0])), y0 = Math.min(...b.rootPos.map(p => p[1])), gz = b.rootPos[0][2];
  [...synths.map((s, v) => [s, `P${v}`, `V${v}`]), ...drums.map((s, d) => [s, `DP${d}`, `DA${d}`])].forEach(([s, pp, vp], v) => {
    const sp = b.addInside({ asset: 'B_1x1F_Speaker', position: [maxX + 20 + (v % 4) * 10, y0 + Math.floor(v / 4) * 10, gz], color: [30, 30, 30],
      components: [{ type: 'Component_AudioEmitter', data: { bEnabled: true, AudioDescriptor: b.ext.length + SYN.indexOf(asset(s)), VolumeMultiplier: 0, PitchMultiplier: 1,
        InnerRadius: inner, MaxDistance: range, bSpatialization: true, FocusAzimuth: 360, NonFocusAzimuth: 360, NonFocusVolumeAttenuation: 1 } }] });
    wireOut(pp, sp, 'Component_AudioEmitter', 'PitchMultiplier');
    wireOut(vp, sp, 'Component_AudioEmitter', 'VolumeMultiplier');
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
        components: [{ type: TD, data: { ...TEXT, Text: ARROWS[k], Font: AF, Rotation: 0, LineHeight: 22, Color: rgba([40, 40, 50]), OutlineWidth: 2 } }] });
      later.push(() => { wireOut(`pad${k}`, pad, TD, 'Color'); wireOut('rainbow_c', pad, TD, 'OutlineColor'); });
    }
    // the seat on the centre panel: W/A/S/D go through the chip's input splitter
    const seat = w.addBrick({ asset: 'B_Seat', position: [sx, -80, 21], direction: 4, rotation: 0, color: [20, 20, 24], owner_index: owner,
      components: [{ type: 'Component_Internal_Seat', data: { bAllowHeldItems: false, bAllowNearbyInteraction: false, PromptCustomLabel: 'Dance' } }] });
    w.addWire({ brick: seat, component_type: 'Component_Internal_Seat', port: 'SittingCharacter' }, { brick: b.portIn('player'), component_type: 'BrickComponentType_Internal_MicrochipInput', port: 'RER_Input' });
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
  const title = panel(70, -70, 98, 120, { Text: 'SIT DOWN TO DANCE', Color: rgba([255, 120, 230]), LineHeight: 4.5 });
  wireOut('title_t', title, TD, 'Text');
  const info = panel(70, 32, 78, 98, { Text: '', LineHeight: 6, Color: rgba([255, 255, 255]) });
  wireOut('info_t', info, TD, 'Text');
  const combo = panel(70, 32, 58, 78, { Text: '', LineHeight: 5.2, Color: rgba([255, 225, 60]) });
  wireOut('combo_t', combo, TD, 'Text');
  panel(70, 32, 16, 58, { Text: '' });
  const judge = panel(-32, -70, 74, 98, { Text: '', LineHeight: 7.5, Color: rgba([255, 255, 255]) });
  wireOut('judge_t', judge, TD, 'Text');
  wireOut('judge_c', judge, TD, 'Color');
  panel(32, -32, 16, STRIP_Z0, { Text: '' });                           // sill under the lanes
  const LANE_W = 16;
  for (let k = 0; k < 4; k++) {
    const x0 = 32 - k * LANE_W, x1 = x0 - LANE_W;                      // LEFT lane at +x (the dancer's left)
    const rec = panel(x0, x1, STRIP_Z0 + K * STRIP_H, 98, { Text: ARROWS[k], Font: AF, LineHeight: 7.5, OutlineWidth: 2, Color: rgba([70, 70, 80]) });
    wireOut(`rec${k}`, rec, TD, 'Color');
    wireOut('rainbow_c', rec, TD, 'OutlineColor');
    // K strips, each one arrow sprite slid up the lane by its Offset (Y = up)
    for (let j = 0; j < K; j++) {
      const spr = panel(x0, x1, STRIP_Z0 + j * STRIP_H, STRIP_Z0 + (j + 1) * STRIP_H, { Text: '', Font: AF, LineHeight: 8, OutlineWidth: 2, Color: rgba(LANE_COL[k]) });
      wireOut(`spr${k}${j}`, spr, TD, 'Text');
      wireOut(`off${k}${j}`, spr, TD, 'Offset');
      wireOut('rainbow_c', spr, TD, 'OutlineColor');
    }
  }
  panel(-32, -70, 16, 74, { Text: '' });                                // (Offset test markers measured: Y = up)
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

  return b.finish({ extraAssets: ext.slice(b.ext.length), description: 'DDR cabinet' });
}
