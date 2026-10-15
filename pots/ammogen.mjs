// Ammo pickups (owner 2026-10-11: "arrows drops and bullets drops"). Built like
// heal.brz: a coin hovering where it drops (frozen grid); touching it grants
// ammo to the player's reserve (per game WeaponResource: GetAmmo, SetAmmo current + amount;
// GrantAmmo did nothing in game), plays the pickup sound, and 0.1 s later
// the prefab removes itself. Owned by the server owner (renderman).
//   KIND=arrows  node ammogen.mjs -> Saved/Prefabs/arrows.brz   (wood, 10 arrows)
//   KIND=bullets node ammogen.mjs -> Saved/Prefabs/bullets.brz  (brass, every gun ammo type:
//     the gun store's derringer/revolver/magnum/shotgun/rifles; which resource each uses
//     isn't listed anywhere, so all of them; resource names from the game's .utoc)
// Spawned by pot_pool.ws (pots and bushes) and skeleton_drop (bots).
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const KIND = process.env.KIND ?? "arrows";
const KINDS = {
  arrows: { color: [150, 96, 48], ammo: [["WeaponResource_Ammo_Arrow", 10]] },
  bullets: { color: [200, 160, 60], ammo: [["WeaponResource_Ammo_Light", 24], ["WeaponResource_Ammo_Medium", 20], ["WeaponResource_Ammo_Heavy", 10],
    ["WeaponResource_Ammo_Magnum", 12], ["WeaponResource_Ammo_Shotgun", 8], ["WeaponResource_Ammo_BlackPowder", 8]] },
};
const K = KINDS[KIND];
if (!K) throw new Error(`KIND must be ${Object.keys(KINDS).join(" or ")}`);
const w = new brs.World();
const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });

// frozen (owner 2026-10-10: "hearts fly away too fast"): it hovers where it drops
const g = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: true, owner_index: owner });
const coin = w.addBrick({ asset: "B_1x1_Coin", position: [0, 0, 0], color: K.color, owner_index: owner, material: "BMC_Glow", material_intensity: 2,
  components: [{ type: "Component_Touch", data: { BeginTouchSound: null, EndTouchSound: null, bCollisionEnabled_Player: true, bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true } }] }, { grid: g.grid });
// the chip rides on the coin's grid, hidden just under it
const chipBrick = w.addBrick({ asset: "B_1x1_Microchip", position: [0, 0, -8], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_Internal_Microchip" }] }, { grid: g.grid });
const chip = { brick: chipBrick, grid: w.addBrickGrid({ type: "Entity_MicrochipDynamicBrickGrid", location: { X: 0, Y: 0, Z: 30 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 24, Y: 24 + 20 * K.ammo.length, Z: 2 } } }) };
w.registerMicrochipLink(chip.brick, chip.grid);
let gx = 0; const at = () => [(gx % 2) * 20 - 10, Math.floor(gx++ / 2) * 20 - 10, 2];
const gate = (asset, type, data) => w.addBrick({ asset, position: at(), owner_index: owner, components: [{ type, data }] }, { grid: chip.grid.grid });
// per resource GetAmmo -> SetAmmo(current + amount), chained Exec -> ExecOut; externalAssets[1 + i] = resource i
// (2026-10-15, owner: "fix pots not dropping ammo": Character GrantAmmo did nothing in game: an arrows
// pickup read the toucher's reserve 20 before and 20 after a +10 grant)
const grants = K.ammo.map(([, amount], i) => ({
  get: gate("B_1x1_Gate_Exec_Character_GetAmmo", "BrickComponentType_WireGraph_Exec_Character_GetAmmo", {}),
  add: gate("B_1x1_Gate_Expr_MathAdd", "BrickComponentType_WireGraph_Expr_MathAdd", { InputA: { $variant: "i64", value: 0n }, InputB: { $variant: "i64", value: BigInt(amount) } }),
  set: gate("B_1x1_Gate_Exec_Character_SetAmmo", "BrickComponentType_WireGraph_Exec_Character_SetAmmo", { Amount: amount }),
  res: gate("B_1x1_Gate_WeaponResourceReference", "BrickComponentType_WireGraph_WeaponResourceReference", { Asset: 1 + i }),
}));
const delay = gate("B_1x1_Gate_Pseudo_Timer", "BrickComponentType_WireGraphPseudo_Timer", { Limit: 0.1, Time: 0.1, bRunning: false });
const self = gate("B_1x1_Gate_Internal_ReadBrickGrid", "BrickComponentType_Internal_ReadBrickGrid", {});
const destroy = gate("B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab", "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", {});
const sound = w.addBrick({ asset: "B_1x1_SoundEmitter", position: [0, 0, 8], owner_index: owner, visibility: false, collision: false,
  components: [{ type: "Component_OneShotAudioEmitter", data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1.5, InnerRadius: 15, MaxDistance: 400, bSpatialization: true, bEnableRepeat: false, RepeatTime: 1, RepeatVariance: 0, RepeatCount: 1 } }] }, { grid: g.grid });
const P = (brick, component_type, port) => ({ brick, component_type, port });
const TOUCH = "Component_Touch", GA = "BrickComponentType_WireGraph_Exec_Character_GetAmmo", SA = "BrickComponentType_WireGraph_Exec_Character_SetAmmo", ADD = "BrickComponentType_WireGraph_Expr_MathAdd", WR = "BrickComponentType_WireGraph_WeaponResourceReference", TM = "BrickComponentType_WireGraphPseudo_Timer";
const DS = "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", RG = "BrickComponentType_Internal_ReadBrickGrid";
// touch -> grant 1 -> grant 2 -> ... -> delay -> destroy
w.addWire(P(coin, TOUCH, "bTouching"), P(grants[0].get, GA, "Exec"));
w.addWire(P(coin, TOUCH, "bTouching"), P(sound, "Component_OneShotAudioEmitter", "Play"));
grants.forEach(({ get, add, set, res }, i) => {
  for (const [g, T] of [[get, GA], [set, SA]]) { w.addWire(P(coin, TOUCH, "Character"), P(g, T, "Character")); w.addWire(P(res, WR, "Value"), P(g, T, "Resource")); }
  w.addWire(P(get, GA, "Amount"), P(add, ADD, "InputA"));
  w.addWire(P(add, ADD, "Output"), P(set, SA, "Amount"));
  w.addWire(P(get, GA, "ExecOut"), P(set, SA, "Exec"));
  w.addWire(P(set, SA, "ExecOut"), i + 1 < grants.length ? P(grants[i + 1].get, GA, "Exec") : P(delay, TM, "Restart"));
});
w.addWire(P(delay, TM, "Expired"), P(destroy, DS, "Exec"));
w.addWire(P(self, RG, "BrickGrid"), P(destroy, DS, "Entity"));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BrickOneShotAudioDescriptor", name: "OSA_FragGrenade_Bounce" }, ...K.ammo.map(([name]) => ({ type: "BRWeaponResource", name }))] });
fs.writeFileSync(path.join(PRE, `${KIND}.brz`), out);
console.log(`${KIND}.brz`, out.length, "bytes,", JSON.stringify(K.ammo));
