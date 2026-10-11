// Pot v4 (2026-10-08, owner: "glass shatter with random pitch, drop coins, respawn after 2 minutes, no debris"):
// potgen3 plus a Random gate (0.8-1.25) feeding the emitter PitchMultiplier on each hit, 120 s respawn,
// and the microchip brick hidden inside the jar (it showed as a grey slab under the pot).
// Glass-sound pot (2026-10-07, owner: "just plays the glass shatter sound then disappears, no particles"): potgen2 minus the shards, plus a one-shot OBA_GlasShatter_1 emitter on the hit.
// Was: wired smashable pot (2026-10-06, owner: "make it with wires", "make it an entity hit").
// No plugin: the pot is a frozen dynamic grid (an entity), so a weapon hit on it fires
// BrickComponentType_WireGraph_Exec_WholeGridTargeted.Targeted. A microchip hidden in
// the jar holds the graph:
//   Targeted -> SetHidden (Visible := false)  -> jar BrickPropertyChanger: visibility + collisions off
//            -> GlassSound.Play (OBA_GlasShatter_1, no shards since 2026-10-07)
//            -> RespawnTimer.Restart (90 s)   -> Expired -> SetShown (Visible := true)
//            -> CoinSpawner (coin1 popped up)
// Output: Saved/Prefabs/pot.brz (centred so a load at ground + 12 stands it on the ground)
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const RESPAWN = Number(process.env.RESPAWN ?? 120), SHARD_S = 6;
const w = new brs.World();
const owner = w.addOwner({ id: "00000000-0000-0000-0000-000000000000", name: "pot" });
const POT = [176, 96, 58];
const changer = (vis, color) => ({ type: "Component_BrickPropertyChanger", data: { bVisibility: vis, bCollisionEnabled: vis, bCollisionEnabled_Player: vis, bCollisionEnabled_Player1: vis, bCollisionEnabled_Player2: vis, bCollisionEnabled_Player3: vis, bCollisionEnabled_Weapon: vis, bCollisionEnabled_Interaction: vis, bCollisionEnabled_Physics: vis, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 0, Material: 0 } });
// the pot: a frozen entity grid with the jar and the (hidden) shards
const pot = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: true, owner_index: owner });
const jar = w.addBrick({ asset: "B_Jar", position: [0, 0, 0], color: POT, owner_index: owner,
  components: [changer(true, POT)] }, { grid: pot.grid });
// the chip, hidden in the jar, and its gates
// the chip goes on the pot grid itself (w.addMicrochip would leave it in the world: the grey slab
// under the pot, and the hit gate would not watch the pot), hidden just under the jar (inside it, it overlapped and the jar was dropped)
const chipBrick = w.addBrick({ asset: "B_1x1_Microchip", position: [0, 0, -14], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_Internal_Microchip" }] }, { grid: pot.grid });
const chip = { brick: chipBrick, grid: w.addBrickGrid({ type: "Entity_MicrochipDynamicBrickGrid", location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 34, Y: 44, Z: 2 } } }) };
w.registerMicrochipLink(chip.brick, chip.grid);
let gx = 0; const at = () => [(gx++ % 3) * 20 - 20, Math.floor((gx - 1) / 3) * 20 - 10, 2]; // 20 apart: at 10 the first gates overlapped and were dropped
const gate = (asset, type, data) => w.addBrick({ asset, position: at(), owner_index: owner, components: [{ type, data }] }, { grid: chip.grid.grid });
// toggles, as in the owner's coin (Var gates would not wire up): the jar shows while TV
// is on, the shards while TS is on; a hit flips both, each timer flips its own back
// the hit trigger: its own gate brick in the chip (as a component on a plain brick it failed to attach: reason 3)
const hitGate = gate("B_1x1_Gate_Exec_WholeGridTargeted", "BrickComponentType_WireGraph_Exec_WholeGridTargeted", {});
// (2026-10-08, owner: "the pots arent breaking") the pot's state is the respawn
// timer itself, not a toggle: one swing can fire Targeted twice, and two flips
// of a toggle put the jar straight back. The jar shows while the timer's Time
// >= its Limit (it starts there); a hit restarts it (Time 0: hidden) and the jar
// comes back when it runs out. A hit only counts while the jar shows (Branch),
// so a double hit can't drop two coins or restart the countdown.
const respawn = gate("B_1x1_Gate_Pseudo_Timer", "BrickComponentType_WireGraphPseudo_Timer", { Limit: RESPAWN, Time: RESPAWN, bRunning: false });
const shown = gate("B_1x1_Gate_Expr_CompareGreaterOrEqual", "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", { InputA: { $variant: "f64", value: RESPAWN }, InputB: { $variant: "f64", value: RESPAWN } });
const live = gate("B_1x1_Gate_Exec_Branch", "BrickComponentType_WireGraph_Exec_Branch", { bCond: true });
// the glass sound: an invisible, no-collision emitter sitting on the jar (in the chip grid it overlapped a gate)
const sound = w.addBrick({ asset: "B_1x1_SoundEmitter", position: [0, 0, 18], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_OneShotAudioEmitter", data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100, MaxDistance: 2500, bSpatialization: true, bEnableRepeat: false, RepeatCount: 1, RepeatTime: 1, RepeatVariance: 0 } }] }, { grid: pot.grid });
const pitch = gate("B_1x1_Gate_Exec_Random", "BrickComponentType_WireGraph_Exec_Random", { Min: { $variant: "f64", value: 0.8 }, Max: { $variant: "f64", value: 1.25 } });
// (2026-10-08) a console line per smash, so a hit shows in the server log (the pots plugin is gone: the pot is all wires)
const smashLog = gate("B_1x1_Gate_Exec_PrintToConsole", "BrickComponentType_WireGraph_Exec_PrintToConsole", { Text: "[pot] smashed" });
const coin = w.addPrefab(fs.readFileSync(path.join(PRE, "coin1.brz")));
const spawner = gate("B_1x1_Gate_Exec_PrefabSpawner", "BrickComponentType_WireGraph_Exec_PrefabSpawner", { Prefab: coin, SpawnOffset: { X: 0, Y: 0, Z: 24 }, SpawnOffsetRotation: { Pitch: 0, Yaw: 0, Roll: 0 }, SpawnVelocity: { X: 0, Y: 0, Z: 200 }, Lifetime: 30, Limit: 3 });
const P = (brick, component_type, port) => ({ brick, component_type, port });
const T = "BrickComponentType_WireGraph_Exec_WholeGridTargeted", TG = "BrickComponentType_WireGraph_Exec_Toggle", TM = "BrickComponentType_WireGraphPseudo_Timer", CH = "Component_BrickPropertyChanger", SP = "BrickComponentType_WireGraph_Exec_PrefabSpawner";
const GE = "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", BR = "BrickComponentType_WireGraph_Exec_Branch";
w.addWire(P(respawn, TM, "Time"), P(shown, GE, "InputA"));
w.addWire(P(shown, GE, "bOutput"), P(live, BR, "bCond"));
w.addWire(P(hitGate, T, "Targeted"), P(live, BR, "Exec"));
const hit = P(live, BR, "ExecOutA"); // a hit on a showing pot
w.addWire(hit, P(respawn, TM, "Restart")); w.addWire(hit, P(pitch, "BrickComponentType_WireGraph_Exec_Random", "Exec"));
w.addWire(P(pitch, "BrickComponentType_WireGraph_Exec_Random", "Output"), P(sound, "Component_OneShotAudioEmitter", "PitchMultiplier"));
w.addWire(P(pitch, "BrickComponentType_WireGraph_Exec_Random", "ExecOut"), P(sound, "Component_OneShotAudioEmitter", "Play")); w.addWire(hit, P(spawner, SP, "Exec")); w.addWire(hit, P(smashLog, "BrickComponentType_WireGraph_Exec_PrintToConsole", "Exec"));
for (const port of ["bVisibility", "bCollisionEnabled", "bCollisionEnabled_Player", "bCollisionEnabled_Weapon", "bCollisionEnabled_Interaction"]) w.addWire(P(shown, GE, "bOutput"), P(jar, CH, port));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BrickOneShotAudioDescriptor", name: "OBA_GlasShatter_1" }] });
fs.writeFileSync(path.join(PRE, "pot.brz"), out);
const r = brs.WorldReader.from(Buffer.from(out));
console.log("pot.brz", out.length, "bytes, grids", r.gridIds().join(","));
