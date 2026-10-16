// Arrow pickup (2026-10-16, owner: "here is an arrow entity that i want u to physics spawn out
// of pots instead of whatever the fuck u made"): the owner's clipboard (pots/arrow_owner.brz) =
// 3 hidden gate bricks stacked 4 apart:
//   top     NOT                    (bShowPickupEnabled -> NOT -> Exec: the pickup was taken)
//   middle  ReadBrickGrid + the game's arrow ammo pickup (Component_ItemSpawn of BRPickupBase
//           BP_Pickup_Ammo_Arrows, spinning/bobbing) + a gyroscope that keeps it upright
//   bottom  DestroySpawnedPrefab   (Entity = this grid): the prefab goes once it is picked up
// Rebuilt here on a loose (not frozen) physics grid so pot_pool can throw it out of the pot.
// Replaces ammogen.mjs KIND=arrows (coin + GetAmmo/SetAmmo chip + brick model).
//   node arrowpickup.mjs -> Saved/Prefabs/arrows.brz   (run on the server, brs-js 3 like the coins)
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const w = new brs.World();
const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });
const g = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: false, owner_index: owner });
const hidden = { owner_index: owner, visibility: false };
const NOT = "BrickComponentType_WireGraph_Expr_LogicalNOT", RG = "BrickComponentType_Internal_ReadBrickGrid";
const DS = "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", IS = "Component_ItemSpawn";
const white = Array.from({ length: 8 }, () => ({ R: 255, G: 255, B: 255, A: 255 }));
const destroy = w.addBrick({ asset: "B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab", position: [0, 0, -4], ...hidden, components: [{ type: DS, data: {} }] }, { grid: g.grid });
const core = w.addBrick({ asset: "B_1x1_Gate_Internal_ReadBrickGrid", position: [0, 0, 0], ...hidden, components: [
  { type: RG, data: {} },
  { type: IS, data: { PickupClass: 0, bPickupEnabled: true, bPickupRespawnOnMinigameReset: true, PickupMinigameResetRespawnDelay: 0, bPickupAutoDisableOnPickup: true,
    PickupRespawnTime: 5, bRenderTranslucentWhenDisabled: true, DamageMultiplier: 1, WeaponSpeedMultiplier: 1, ItemNameOverride: "", ProjectileOverride: null,
    WeaponAmmoOverride: { bOverrideStartingAmmo: false, Resources: Array.from({ length: 8 }, () => ({ Loaded: 0, Reserve: 0 })) },
    PickupOffsetDirection: 4, PickupOffsetDistance: 5, PickupRotation: { Pitch: 0, Yaw: 0, Roll: 0 }, PickupScale: 1,
    bOverridePickupColors: false, PickupMeshColors: white, bPickupAnimationEnabled: true, PickupAnimationAxis: 2, bPickupAnimationAxisLocal: false,
    PickupSpinSpeed: 0.2, PickupBobSpeed: 0.1, PickupBobHeight: 4, PickupAnimationPhase: 0.37 } },
  { type: "Component_Internal_Gyroscope", data: { bEnabled: true, bDiscoverable: true, Strength: 25, Damping: 1, MaxForce: 0, TargetAxis: { X: 0, Y: 0, Z: 1 } } },
] }, { grid: g.grid });
const not = w.addBrick({ asset: "B_1x1_Gate_Expr_LogicalNOT", position: [0, 0, 4], ...hidden, components: [{ type: NOT, data: { bInput: true } }] }, { grid: g.grid });
const P = (brick, component_type, port) => ({ brick, component_type, port });
w.addWire(P(core, IS, "bShowPickupEnabled"), P(not, NOT, "bInput"));
w.addWire(P(not, NOT, "bOutput"), P(destroy, DS, "Exec"));
w.addWire(P(core, RG, "BrickGrid"), P(destroy, DS, "Entity"));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BRPickupBase", name: "BP_Pickup_Ammo_Arrows" }] });
fs.writeFileSync(path.join(PRE, "arrows.brz"), out);
console.log("arrows.brz", out.length, "bytes");
