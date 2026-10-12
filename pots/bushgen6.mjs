// Bush v6 (2026-10-12, owner: "bushes arent supposed to be an entity. put the microchip on the top over
// the audio one shot and make it a part of the geometry"): the smashable bush as plain world bricks.
// potgen5's bush was a frozen entity grid (its WholeGridTargeted hit gate only works on an entity).
// Now: the B_Bush is a world brick (players bump into it; weapons pass through it), ringed by eight
// invisible B_2x2F_Target plates (weapon collision only) whose bJustHit catches the swing; the one-shot
// twig sound sits on top of the bush and the microchip on top of that, both hidden, in the world grid.
// Logic as potgen5: a hit on a showing bush -> hide it (BrickPropertyChanger), restart the respawn
// timer, a twig snap at a random pitch, a "[bush] smashed" console line, and the global custom event
// "pot.smashed" with the chip's location (pot_pool.ws rolls the loot and drops it there).
//   node bushgen6.mjs   (on the server) -> Saved/Prefabs/bush.brz (centred: load at ground + 16)
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const RESPAWN = Number(process.env.RESPAWN ?? 120), HALF = 16, R = 14; // B_Bush half extents 14 x 14 x 16
const w = new brs.World();
const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });
const COLOR = [78, 140, 52];
const changer = vis => ({ type: "Component_BrickPropertyChanger", data: { bVisibility: vis, bCollisionEnabled: vis, bCollisionEnabled_Player: vis, bCollisionEnabled_Player1: vis, bCollisionEnabled_Player2: vis, bCollisionEnabled_Player3: vis, bCollisionEnabled_Weapon: false, bCollisionEnabled_Interaction: vis, bCollisionEnabled_Physics: vis, Color: { R: COLOR[0], G: COLOR[1], B: COLOR[2], A: 255 }, MaterialAlpha: 0, Material: 0 } });
// the bush: a world brick; weapons go through it to the targets
const bush = w.addBrick({ asset: "B_Bush", position: [0, 0, 0], color: COLOR, owner_index: owner, collision: { player: true, weapon: false, interaction: true, tool: true, physics: true }, components: [changer(true)] });
// eight hidden targets ringing it 30 out (two high on each side; at 16 they overlapped the bush), weapon collision only
const HIDDEN_TARGET = { visibility: false, collision: { player: false, weapon: true, interaction: false, tool: true, physics: false } };
const targets = [];
for (const z of [-6, 14]) {
  for (const sx of [-1, 1]) targets.push(w.addBrick({ asset: "B_2x2F_Target", position: [sx * 30, 0, z], direction: 0, rotation: 0, color: COLOR, owner_index: owner, ...HIDDEN_TARGET, components: [{ type: "Component_Target", data: {} }] }));
  for (const sy of [-1, 1]) targets.push(w.addBrick({ asset: "B_2x2F_Target", position: [0, sy * 30, z], direction: 2, rotation: 0, color: COLOR, owner_index: owner, ...HIDDEN_TARGET, components: [{ type: "Component_Target", data: {} }] }));
}
// the one-shot sound on top of the bush, the microchip on top of the sound: hidden, no collision
const sound = w.addBrick({ asset: "B_1x1_SoundEmitter", position: [0, 0, HALF + 6], owner_index: owner, visibility: false, collision: false,
  components: [{ type: "Component_OneShotAudioEmitter", data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100, MaxDistance: 2500, bSpatialization: true, bEnableRepeat: false, RepeatCount: 1, RepeatTime: 1, RepeatVariance: 0 } }] });
const chipBrick = w.addBrick({ asset: "B_1x1_Microchip", position: [0, 0, HALF + 12 + 2], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_Internal_Microchip" }] });
const chip = { brick: chipBrick, grid: w.addBrickGrid({ type: "Entity_MicrochipDynamicBrickGrid", location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 64, Y: 104, Z: 2 } } }) };
w.registerMicrochipLink(chip.brick, chip.grid);
let gx = 0; const at = () => [(gx++ % 3) * 20 - 20, Math.floor((gx - 1) / 3) * 20 - 10, 2];
const gate = (asset, type, data) => w.addBrick({ asset, position: at(), owner_index: owner, components: [{ type, data }] }, { grid: chip.grid.grid });
const respawn = gate("B_1x1_Gate_Pseudo_Timer", "BrickComponentType_WireGraphPseudo_Timer", { Limit: RESPAWN, Time: RESPAWN, bRunning: false });
const shown = gate("B_1x1_Gate_Expr_CompareGreaterOrEqual", "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", { InputA: { $variant: "f64", value: RESPAWN }, InputB: { $variant: "f64", value: RESPAWN } });
const live = gate("B_1x1_Gate_Exec_Branch", "BrickComponentType_WireGraph_Exec_Branch", { bCond: true });
const pitch = gate("B_1x1_Gate_Exec_Random", "BrickComponentType_WireGraph_Exec_Random", { Min: { $variant: "f64", value: 0.8 }, Max: { $variant: "f64", value: 1.25 } });
const smashLog = gate("B_1x1_Gate_Exec_PrintToConsole", "BrickComponentType_WireGraph_Exec_PrintToConsole", { Text: "[bush] smashed" });
const xform = gate("B_1x1_Gate_Exec_GetOwnTransform", "BrickComponentType_WireGraph_Exec_GetOwnTransform", {});
const zero = { $variant: "f64", value: 0 };
const send = gate("B_1x1_Gate_Pseudo_SendCustomEvent_Global", "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global",
  { EventName: "pot.smashed", DataIn1: { $variant: "Vector", value: { X: 0, Y: 0, Z: 0 } }, DataIn2: zero, DataIn3: zero, DataIn4: zero, DataIn5: zero, DataIn6: zero, DataIn7: zero, DataIn8: zero });
const P = (brick, component_type, port) => ({ brick, component_type, port });
const TM = "BrickComponentType_WireGraphPseudo_Timer", GE = "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", BR = "BrickComponentType_WireGraph_Exec_Branch";
const RN = "BrickComponentType_WireGraph_Exec_Random", XF = "BrickComponentType_WireGraph_Exec_GetOwnTransform", SG = "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global", CH = "Component_BrickPropertyChanger";
w.addWire(P(respawn, TM, "Time"), P(shown, GE, "InputA"));
w.addWire(P(shown, GE, "bOutput"), P(live, BR, "bCond"));
// the eight targets' bJustHit are ORed (an input takes one wire: eight wires into the Branch's Exec
// connected only the first), then one EdgeDetectorExec turns the rising edge into the Branch's exec.
// While the bush is hidden the Branch ignores hits.
const OR = "BrickComponentType_WireGraph_Expr_LogicalOR", ED = "BrickComponentType_WireGraph_Expr_EdgeDetectorExec";
let level = targets.map(t => P(t, "Component_Target", "bJustHit"));
while (level.length > 1) {
  const next = [];
  for (let i = 0; i < level.length; i += 2) {
    if (i + 1 >= level.length) { next.push(level[i]); continue; }
    const g = gate("B_1x1_Gate_Expr_LogicalOR", OR, { bInputA: false, bInputB: false });
    w.addWire(level[i], P(g, OR, "bInputA")); w.addWire(level[i + 1], P(g, OR, "bInputB"));
    next.push(P(g, OR, "bOutput"));
  }
  level = next;
}
const edge = gate("B_1x1_Gate_Expr_EdgeDetectorExec", ED, { Input: 0 });
w.addWire(level[0], P(edge, ED, "Input"));
w.addWire(P(edge, ED, "OnRisingEdge"), P(live, BR, "Exec"));
const hit = P(live, BR, "ExecOutA");
w.addWire(hit, P(respawn, TM, "Restart")); w.addWire(hit, P(pitch, RN, "Exec"));
w.addWire(P(pitch, RN, "Output"), P(sound, "Component_OneShotAudioEmitter", "PitchMultiplier"));
w.addWire(P(pitch, RN, "ExecOut"), P(sound, "Component_OneShotAudioEmitter", "Play"));
w.addWire(hit, P(xform, XF, "Exec")); w.addWire(P(xform, XF, "ExecOut"), P(send, SG, "ExecIn")); w.addWire(P(xform, XF, "Location"), P(send, SG, "DataIn1"));
w.addWire(hit, P(smashLog, "BrickComponentType_WireGraph_Exec_PrintToConsole", "Exec"));
for (const port of ["bVisibility", "bCollisionEnabled", "bCollisionEnabled_Player", "bCollisionEnabled_Interaction"]) w.addWire(P(shown, GE, "bOutput"), P(bush, CH, port));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BrickOneShotAudioDescriptor", name: "OBA_WoodCreak1_2" }] });
const file = path.join(PRE, process.env.OUT ?? "bush.brz");
fs.writeFileSync(file, out);
const r = brs.WorldReader.from(Buffer.from(out));
console.log(path.basename(file), out.length, "bytes, grids", r.gridIds().join(","), "bricks", [...r.bricks(1)].length);
