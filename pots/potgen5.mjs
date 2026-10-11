// Pot v5 (2026-10-10, owner: "pots when broken need to make glass shatter 2", "owned by an admin
// to do admin stuff like spawning money", "a chip that spawns from a spawn pool written as a custom
// global event"): potgen4 with OBA_GlasShatter_2, owned by the server owner (renderman), and no coin
// spawner of its own: a hit sends the global custom event "pot.smashed" (the pot's location), and the
// pot_pool chip (pots/pot_pool.ws, in the sky) rolls the loot pool and drops it at the pot.
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
const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });
// KIND=bush (owner 2026-10-10: "bushes that are like if you attack them they work
// like pots"): the same wired entity with a B_Bush (half height 16, load at
// ground + 16), a twig-snap sound (no leaf sound in the game) -> bush.brz
const KIND = process.env.KIND ?? "pot";
const K = { pot: { asset: "B_Jar", color: [176, 96, 58], half: 12, sound: "OBA_GlasShatter_2", file: "pot.brz" },
  bush: { asset: "B_Bush", color: [78, 140, 52], half: 16, sound: "OBA_WoodCreak1_2", file: "bush.brz" } }[KIND];
const POT = K.color;
const changer = (vis, color) => ({ type: "Component_BrickPropertyChanger", data: { bVisibility: vis, bCollisionEnabled: vis, bCollisionEnabled_Player: vis, bCollisionEnabled_Player1: vis, bCollisionEnabled_Player2: vis, bCollisionEnabled_Player3: vis, bCollisionEnabled_Weapon: vis, bCollisionEnabled_Interaction: vis, bCollisionEnabled_Physics: vis, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 0, Material: 0 } });
// the pot: a frozen entity grid with the jar and the (hidden) shards
const pot = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: true, owner_index: owner });
const jar = w.addBrick({ asset: K.asset, position: [0, 0, 0], color: POT, owner_index: owner,
  components: [changer(true, POT)] }, { grid: pot.grid });
// the chip, hidden in the jar, and its gates
// the chip goes on the pot grid itself (w.addMicrochip would leave it in the world: the grey slab
// under the pot, and the hit gate would not watch the pot), hidden just under the jar (inside it, it overlapped and the jar was dropped)
const chipBrick = w.addBrick({ asset: "B_1x1_Microchip", position: [0, 0, -(K.half + 2)], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_Internal_Microchip" }] }, { grid: pot.grid });
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
const sound = w.addBrick({ asset: "B_1x1_SoundEmitter", position: [0, 0, K.half + 6], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_OneShotAudioEmitter", data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100, MaxDistance: 2500, bSpatialization: true, bEnableRepeat: false, RepeatCount: 1, RepeatTime: 1, RepeatVariance: 0 } }] }, { grid: pot.grid });
const pitch = gate("B_1x1_Gate_Exec_Random", "BrickComponentType_WireGraph_Exec_Random", { Min: { $variant: "f64", value: 0.8 }, Max: { $variant: "f64", value: 1.25 } });
// (2026-10-08) a console line per smash, so a hit shows in the server log (the pots plugin is gone: the pot is all wires)
const smashLog = gate("B_1x1_Gate_Exec_PrintToConsole", "BrickComponentType_WireGraph_Exec_PrintToConsole", { Text: `[${KIND}] smashed` });
// the loot: the pot's location goes out on the global custom event "pot.smashed" (pot_pool.ws rolls the pool)
const xform = gate("B_1x1_Gate_Exec_GetOwnTransform", "BrickComponentType_WireGraph_Exec_GetOwnTransform", {});
const zero = { $variant: "f64", value: 0 };
const send = gate("B_1x1_Gate_Pseudo_SendCustomEvent_Global", "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global",
  { EventName: "pot.smashed", DataIn1: { $variant: "Vector", value: { X: 0, Y: 0, Z: 0 } }, DataIn2: zero, DataIn3: zero, DataIn4: zero, DataIn5: zero, DataIn6: zero, DataIn7: zero, DataIn8: zero });
const P = (brick, component_type, port) => ({ brick, component_type, port });
const T = "BrickComponentType_WireGraph_Exec_WholeGridTargeted", TG = "BrickComponentType_WireGraph_Exec_Toggle", TM = "BrickComponentType_WireGraphPseudo_Timer", CH = "Component_BrickPropertyChanger", SP = "BrickComponentType_WireGraph_Exec_PrefabSpawner";
const XF = "BrickComponentType_WireGraph_Exec_GetOwnTransform", SG = "BrickComponentType_WireGraphPseudo_SendCustomEvent_Global";
const GE = "BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual", BR = "BrickComponentType_WireGraph_Exec_Branch";
w.addWire(P(respawn, TM, "Time"), P(shown, GE, "InputA"));
w.addWire(P(shown, GE, "bOutput"), P(live, BR, "bCond"));
w.addWire(P(hitGate, T, "Targeted"), P(live, BR, "Exec"));
const hit = P(live, BR, "ExecOutA"); // a hit on a showing pot
w.addWire(hit, P(respawn, TM, "Restart")); w.addWire(hit, P(pitch, "BrickComponentType_WireGraph_Exec_Random", "Exec"));
w.addWire(P(pitch, "BrickComponentType_WireGraph_Exec_Random", "Output"), P(sound, "Component_OneShotAudioEmitter", "PitchMultiplier"));
w.addWire(P(pitch, "BrickComponentType_WireGraph_Exec_Random", "ExecOut"), P(sound, "Component_OneShotAudioEmitter", "Play")); w.addWire(hit, P(xform, XF, "Exec"));
w.addWire(P(xform, XF, "ExecOut"), P(send, SG, "ExecIn")); w.addWire(P(xform, XF, "Location"), P(send, SG, "DataIn1")); w.addWire(hit, P(smashLog, "BrickComponentType_WireGraph_Exec_PrintToConsole", "Exec"));
for (const port of ["bVisibility", "bCollisionEnabled", "bCollisionEnabled_Player", "bCollisionEnabled_Weapon", "bCollisionEnabled_Interaction"]) w.addWire(P(shown, GE, "bOutput"), P(jar, CH, port));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BrickOneShotAudioDescriptor", name: K.sound }] });
fs.writeFileSync(path.join(PRE, K.file), out);
const r = brs.WorldReader.from(Buffer.from(out));
console.log(K.file, out.length, "bytes, grids", r.gridIds().join(","));
