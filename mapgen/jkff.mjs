// A JK flip-flop from primitive logic gates, laid out on a board (owner 2026-11-01: "build a simple circuit jk flip flop
// memory gate using primitive components right here"). Edge-triggered: next Q = (J and not Q) or (not K and Q) from
// NOT / AND / OR gates, latched by an edge detector on CLK into a Var. J / K / CLK are buttons (bHeld), Q and Qb light a
// lamp each. (Pure gate feedback loops, a master-slave latch, loaded with "Failed to connect wire in a cycle".)
//   node mapgen/jkff.mjs out.brz        then br.Prefab.Load "jkff" x y z 0 16
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const lib = await import(pathToFileURL(path.resolve('tools/brs4/dist.mjs')).href);
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
const OWNER = { id: 'a1f00000-0000-4b0b-9a11-00000000a1f0', name: 'JK flip-flop', display_name: 'JK flip-flop' };
const w = new World();
const O = w.addOwner(OWNER);
const MB = 'PB_DefaultMicroBrick';
const FONTS = [{ type: 'BrickFontDescriptor', name: 'Bungee' }];
const TEXT = {
  Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 8, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};
const box = (x0, y0, z0, x1, y1, z1, color, components) => w.addBrick({ asset: MB, color, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: O, ...(components ? { components } : {}) });
const label = (x, y, text, color = [255, 255, 255], size = 8) =>
  box(x - 12, y - 5, 4, x + 12, y + 5, 6, [20, 20, 28], [{ type: C.TextDisplay.NAME, data: { ...TEXT, Text: text, LineHeight: size, Color: { R: color[0], G: color[1], B: color[2], A: 255 } } }]);
const pin = (b, c, p) => ({ brick: b, component_type: c.NAME, port: c.PORTS[p] });

// ---- board
box(0, 0, 0, 260, 150, 4, [40, 44, 52]);
// ---- gates (the game refuses wires in a cycle, so the memory is a Var: no feedback wire loops)
const gate = (c, x, y, data) => w.addBrick({ asset: c.BRICK, position: [x, y, 10], color: [200, 200, 200], owner_index: O, components: [{ type: c.NAME, data }] });
const F = { $variant: 'bool', value: false };
const AA = C.Expr_LogicalAND, OO = C.Expr_LogicalOR, TT = C.Expr_LogicalNOT, VV = C.Var, SS = C.Exec_Var_Set, EE = C.Expr_EdgeDetectorExec;
const NK = gate(TT, 40, 70, { bInput: false }), T2 = gate(AA, 80, 70, { bInputA: false, bInputB: false });
const NQ = gate(TT, 120, 130, { bInput: false }), T1 = gate(AA, 80, 110, { bInputA: false, bInputB: false });
const OR = gate(OO, 120, 90, { bInputA: false, bInputB: false });
const ED = gate(EE, 40, 30, {}), SET = gate(SS, 120, 40, { Value: F }), QV = gate(VV, 180, 70, { Value: F });
const W = (src, sc, sp, dst, dc, dp) => w.addWire(pin(src, sc, sp), pin(dst, dc, dp));
// ---- inputs: J, K, CLK buttons (held while pressed)
const button = (x, y, text, color) => {
  const b = box(x - 6, y - 6, 4, x + 6, y + 6, 10, color, [{ type: C.Button.NAME, data: { bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: text } }]);
  label(x, y - 14, text, color);
  return b;
};
const BJ = button(14, 110, 'J', [80, 200, 255]), BK = button(14, 70, 'K', [255, 180, 60]), BC = button(14, 30, 'CLK', [255, 90, 90]);
// next Q = (J and not Q) or (not K and Q), latched into the Var on the clock's rising edge
W(BK, C.Button, 'bHeld', NK, TT, 'bInput');
W(NK, TT, 'bOutput', T2, AA, 'bInputA'); W(QV, VV, 'Value', T2, AA, 'bInputB');
W(BJ, C.Button, 'bHeld', T1, AA, 'bInputA'); W(QV, VV, 'Value', NQ, TT, 'bInput'); W(NQ, TT, 'bOutput', T1, AA, 'bInputB');
W(T1, AA, 'bOutput', OR, OO, 'bInputA'); W(T2, AA, 'bOutput', OR, OO, 'bInputB');
W(OR, OO, 'bOutput', SET, SS, 'Value');
W(BC, C.Button, 'bHeld', ED, EE, 'Input'); W(ED, EE, 'OnRisingEdge', SET, SS, 'Exec'); W(QV, VV, 'VarRef', SET, SS, 'VarRef');
// ---- lamps for Q and Qb
const lamp = (x, y, color, text, src, sc, sp) => {
  const b = box(x - 8, y - 8, 4, x + 8, y + 8, 14, color, [{ type: C.PointLight.NAME, data: { bEnabled: false, bUseBrickColor: true, Brightness: 12, Radius: 160 } }]);
  W(src, sc, sp, b, C.PointLight, 'bEnabled');
  label(x, y - 16, text, color);
};
lamp(240, 70, [90, 255, 120], 'Q', QV, VV, 'Value');
lamp(240, 110, [255, 90, 200], 'Qb', NQ, TT, 'bOutput');
label(130, 140, 'JK FLIP-FLOP', [255, 255, 255], 10);
label(130, 14, 'HOLD J/K, TAP CLK', [180, 180, 190], 6);

w.makePrefab({});
fs.writeFileSync(process.argv[2] ?? 'jkff.brz', w.toBrz({ bundle: { description: 'JK flip-flop from primitive gates' }, externalAssets: FONTS }));
console.error('wrote', process.argv[2] ?? 'jkff.brz');
