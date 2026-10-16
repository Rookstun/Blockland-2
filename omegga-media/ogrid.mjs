// O-GRID (EA3.2, brs-js 4): video as a SQUARE grid of coloured letter O's on
// ONE text display, as few bricks as the game allows. A chunk prefab is
// 7 bricks: the screen (a micro brick holding the TextDisplay) + 6 hidden
// gates. Frames = strings of N x N "O"s, colour by rich-text runs
// <color="rrggbb">OOO</>, in an Any Value ArrayVar. A Stopwatch starts on
// load; a 20 Hz Clock fires ArrayVar_Get(Time x fps) whose Value is wired
// straight into the screen's Text (no Var, no Floor: the index truncates).
// The soundtrack is a heightmap2brz speech device cut from the SAME seconds of
// the source and loaded on the same tick; its timer also starts on load, so
// picture and sound share one zero.
//
// File coordinates: origin = floor under the screen's centre, screen facing -y.
// Brickadia is left-handed: seen from -y, +x runs LEFT, so column 0 sits at +x
// (handled by writing rows left to right as the viewer reads them: text does
// that itself).

export const OWNER = { id: '7e1e0715-0000-4b0b-9a11-00000000a0a0', name: 'O Grid', display_name: 'O Grid' };
/** One owner per viewer (own 10 ms wire budget, exact clears). */
export const ownerFor = hex12 => ({ id: `7e1e0715-0000-4b0b-9a11-${hex12}`, name: 'O Grid', display_name: 'O Grid' });

export const MAX_CHARS = 8000; // one wire string 34k chars failed to load; 4.8k and 12k loaded
const LEVELS = [16, 12, 9, 7, 6, 5, 4, 3, 2];

/**
 * rgb24 frames (n x n) -> one string per frame: n lines of n "O"s.
 * Runs of cells with the same quantised colour share one tag; cells darker
 * than `dark` are plain O's in the display's own (near black) colour. The
 * quantisation gets coarser until the frame fits `max` characters.
 */
export function oFrames(frames, n, { max = MAX_CHARS, dark = 0.06 } = {}) {
  const h2 = v => v.toString(16).padStart(2, '0');
  return frames.map(fr => {
    let s = '';
    for (const q of LEVELS) {
      const step = 255 / (q - 1);
      const lines = [];
      for (let r = 0; r < n; r++) {
        let line = '', run = 0, key = null;
        const flush = () => { if (run) line += key ? `<color="${key}">${'O'.repeat(run)}</>` : 'O'.repeat(run); run = 0; };
        for (let c = 0; c < n; c++) {
          const o = (r * n + c) * 3, R = fr[o], G = fr[o + 1], B = fr[o + 2];
          const k = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255 < dark ? null
            : [R, G, B].map(v => h2(Math.round(Math.round(v / step) * step))).join('');
          if (k !== key) { flush(); key = k; }
          run++;
        }
        flush();
        lines.push(line);
      }
      s = lines.join('\n');
      if (s.length <= max) return s;
    }
    return Array.from({ length: n }, () => 'O'.repeat(n)).join('\n'); // never fits: plain grid
  });
}

/**
 * Geometry. lh = line height (units); a glyph is charW x lh, so WidthScale
 * 1 / charW makes every cell lh x lh: n x n cells = a square picture.
 */
export function oLayout(n, { lh = 4, charW = 0.55, lift = 20 } = {}) {
  const side = Math.ceil((n * lh) / 4) * 4 + 8; // screen brick side (2 units of border each way, even halves)
  return { n, lh, charW, side, z0: lift, top: lift + side };
}

const FONTS = [{ type: 'BrickFontDescriptor', name: 'IosevkaTerm' }];

const TEXT = {
  Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 4, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 24, G: 24, B: 28, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '',
};

/** One chunk = screen + chip, 7 bricks. `dur` = seconds the chunk plays. */
export function buildOGrid(lib, L, strs, { fps, dur, owner = OWNER } = {}) {
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(owner);
  const hx = L.side / 2;
  const face = { type: C.TextDisplay.NAME, data: { ...TEXT, LineHeight: L.lh, WidthScale: +(1 / L.charW).toFixed(4), Text: strs[0] } };
  const screen = {
    h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [hx, 2, hx], position: [0, 0, L.z0 + hx], color: [6, 6, 8], owner_index: O, components: [face] }),
    c: C.TextDisplay,
  };
  // gates: one row behind the screen, out of sight
  let slot = 0;
  const gate = (c, data = {}) => {
    const i = slot++;
    const h = w.addBrick({ asset: c.BRICK, position: [-100 + i * 40, 40, L.z0 + 10], color: [200, 200, 200], owner_index: O,
      visibility: false, collision: false, components: [{ type: c.NAME, data }] });
    return { h, c };
  };
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  const frames = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: strs.map(value => ({ $variant: 'Str', value })) } });
  const sw = gate(C.Stopwatch, { Limit: dur + 30, Time: 0, bRunning: true });
  const idx = gate(C.Expr_MathMultiply, { InputB: { $variant: 'f64', value: fps } });
  wire(sw, 'Time', idx, 'InputA');
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.025, OffTimeSeconds: 0.025, IntervalSeconds: 0.05 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const get = gate(C.Exec_ArrayVar_Get);
  wire(frames, 'ArrayVarRef', get, 'ArrayVarRef'); wire(idx, 'Output', get, 'Index'); wire(tick, 'OnRisingEdge', get, 'Exec');
  wire(get, 'Value', screen, 'Text');
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'O grid' }, externalAssets: FONTS });
}

/** Clear boxes (file coords [centre, half]) of one chunk: screen + gate row. */
export function oBoxes(L) {
  const hx = L.side / 2;
  return [[[0, 0, L.z0 + hx], [hx, 2, hx]], [[0, 40, L.z0 + 10], [130, 10, 10]]];
}
