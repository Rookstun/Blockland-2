// The casino's machines (owner 2026-10-10: casino at spawn). One prefab per
// game, front toward -y, standing on z = 0 (load at ground + the prefab's half
// height, as mapgen's casino.json gives it). Each has a button (press E) wired
// to a hidden chip that sends the global custom event "casino.play" (game,
// player); pots/casino.ws (the house chip) takes the bet and pays.
//   node casinogen.mjs     -> Saved/Prefabs/casino_<game>.brz (run on the server)
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const MB = "PB_DefaultMicroBrick";
// sign text (ruins.mjs TEXT): Font 0 = externalAssets[0]
const TEXT = {
  Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 3, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { B: 120, G: 220, R: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { B: 10, G: 10, R: 30, A: 255 }, OutlineWidth: 2,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};
const FACE_MINUS_Y = 13; // orientation code: a board's text face toward -y (ruins.mjs codeFacing for 0,-1)
const RED = [168, 28, 40], GOLD = { color: [236, 190, 60], material: "BMC_Metallic" }, FELT = [30, 110, 60], WOOD = [92, 56, 34];
const GLOW = (c, i = 5) => ({ color: c, material: "BMC_Glow", material_intensity: i });

const GAMES = {
  slots: { kind: 1, label: "SLOTS\n10 coins", build(box, pole) {
    box(-20, -15, 0, 20, 15, 40, { color: RED });
    box(-22, -25, 40, 22, 15, 44, { asset: MB, ...GOLD });            // the ledge the button sits on
    box(-20, -15, 44, 20, 15, 104, { color: RED });
    box(-16, -17, 60, 16, -15, 88, { asset: MB, ...GLOW([120, 230, 255], 4) }); // the reel window
    box(-20, -15, 104, 20, 15, 108, { asset: MB, ...GOLD });
    box(-12, -6, 108, 12, 6, 120, { asset: MB, ...GLOW([255, 60, 60], 6) });   // the top light
    pole(26, 0, 60, 92, 2, GOLD);                                       // the lever
    box(22, -4, 92, 30, 4, 100, { asset: MB, ...GLOW([255, 40, 40], 5) });
    return { button: [0, -20, 46], board: [0, -16, 24], chip: [17, 0, 110] };
  } },
  flip: { kind: 2, label: "COIN FLIP\n25 coins", build(box, pole) {
    pole(0, 0, 0, 36, 8, { color: WOOD });
    box(-30, -30, 36, 30, 30, 40, { color: WOOD });
    box(-28, -28, 40, 28, 28, 42, { asset: MB, color: FELT });
    box(-6, 4, 42, 6, 16, 44, { asset: MB, ...GOLD });                 // the coin
    return { button: [0, -16, 44], board: [0, -31, 26], boardH: 8, chip: [20, 20, 2] };
  } },
  dice: { kind: 3, label: "DICE\n50 coins", build(box, pole) {
    box(-40, -30, 0, 40, 30, 36, { color: WOOD });
    box(-40, -30, 36, 40, 30, 40, { color: WOOD });
    box(-36, -26, 40, 36, 26, 42, { asset: MB, color: FELT });
    box(-38, 26, 42, 38, 30, 50, { asset: MB, color: WOOD });          // back rail
    box(4, 4, 42, 12, 12, 50, { asset: MB, color: [240, 240, 236] });  // two dice
    box(16, 8, 42, 24, 16, 50, { asset: MB, color: [240, 240, 236] });
    return { button: [-20, -16, 42], board: [0, -31, 18], chip: [-30, 18, 44] };
  } },
  roulette: { kind: 4, label: "ROULETTE\nred 20", build(box, pole) {
    pole(0, 0, 0, 36, 10, { color: WOOD });
    box(-40, -40, 36, 40, 40, 40, { color: WOOD });
    box(-38, -38, 40, 38, 38, 42, { asset: MB, color: FELT });
    pole(0, 10, 42, 46, 24, { color: [150, 20, 30] });                 // the wheel
    pole(0, 10, 46, 48, 14, { color: [20, 20, 20] });
    pole(0, 10, 48, 56, 3, GOLD);
    return { button: [0, -26, 42], board: [0, -41, 20], chip: [26, 26, 2] };
  } },
};

for (const [name, g] of Object.entries(GAMES)) {
  const w = new brs.World();
  const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });
  const box = (x0, y0, z0, x1, y1, z1, m) => w.addBrick({ ...m, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: owner });
  const pole = (x, y, z0, z1, r, m) => w.addBrick({ asset: "PB_DefaultPole", ...m, size: [r, r, (z1 - z0) / 2], position: [x, y, (z0 + z1) / 2], owner_index: owner });
  const spots = g.build(box, pole);
  const [bx, by, bz] = spots.button;
  const button = w.addBrick({ asset: "B_Button", position: [bx, by, bz + 2], color: [220, 30, 30], owner_index: owner,
    components: [{ type: "Component_Internal_AnimatedButton", data: { PressSound: 1, ReleaseSound: 2, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: "Play" } }] });
  const [px, py, pz] = spots.board;
  w.addBrick({ asset: MB, direction: FACE_MINUS_Y >> 2, rotation: FACE_MINUS_Y & 3, color: [40, 16, 20], size: [18, spots.boardH ?? 10, 1], position: [px, py, pz], owner_index: owner,
    components: [{ type: "Component_TextDisplay", data: { ...TEXT, Text: g.label } }] });
  // the chip on or under the machine itself (behind it, it hit the back wall and the dealers)
  const chip = w.addMicrochip({ position: spots.chip, owner_index: owner, planeExtent: { X: 24, Y: 14, Z: 2 } });
  const send = w.addBrick({ asset: "B_1x1_Gate_Pseudo_SendCustomEvent_Global", position: [0, 0, 2], owner_index: owner,
    components: [{ type: "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global", data: { EventName: "casino.play", DataIn1: { $variant: "i64", value: g.kind }, DataIn2: { $variant: "weak_object", value: null },
      DataIn3: { $variant: "f64", value: 0 }, DataIn4: { $variant: "f64", value: 0 }, DataIn5: { $variant: "f64", value: 0 }, DataIn6: { $variant: "f64", value: 0 }, DataIn7: { $variant: "f64", value: 0 }, DataIn8: { $variant: "f64", value: 0 } } }] }, { grid: chip.grid.grid });
  const BTN = "Component_Internal_AnimatedButton", SG = "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global";
  w.addWire({ brick: button, component_type: BTN, port: "bHeld" }, { brick: send, component_type: SG, port: "ExecIn" });
  w.addWire({ brick: button, component_type: BTN, port: "Character" }, { brick: send, component_type: SG, port: "DataIn2" });
  w.makePrefab({});
  const out = w.toBrz({ externalAssets: [{ type: "BrickFontDescriptor", name: "MonaspaceXenon" },
    { type: "BrickOneShotAudioDescriptor", name: "BOSA_Buttons_Button_1_Press" }, { type: "BrickOneShotAudioDescriptor", name: "BOSA_Buttons_Button_1_Release" }] });
  fs.writeFileSync(path.join(PRE, `casino_${name}.brz`), out);
  console.log(`casino_${name}.brz`, out.length, "bytes");
}
