// Health pickup (owner 2026-10-10: "add a health pickup item like a coin item").
// A red coin hovering where it drops (frozen grid): touching it heals HEAL health
// (Character IncDamage by -HEAL), plays the coin pickup sound pitched up, and
// 0.1 s later the prefab removes itself (as the coins do, so the sound finishes).
// Owned by the server owner (renderman), like the pots.
//   node healgen.mjs          -> Saved/Prefabs/heal.brz (run on the server)
// Spawned by pot_pool.ws (pots and bushes) and skeleton_drop (bots).
// (2026-10-16) the coin is an invisible touch trigger with a glowing pixel heart on its grid
// (the owner's cube + 2 rounded caps tilted 45 deg did not read as a heart).
import fs from "fs"; import path from "path";
const brs = await import(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs"));
const PRE = path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs");
const HEAL = Number(process.env.HEAL ?? 25);
const w = new brs.World();
const owner = w.addOwner({ id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "soapstain22", display_name: "renderman" });
const RED = [214, 32, 40];
// frozen (owner 2026-10-10: "hearts fly away too fast"): it hovers where it drops
const g = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: true, owner_index: owner });
const coin = w.addBrick({ asset: "B_1x1_Coin", position: [0, 0, 0], color: RED, owner_index: owner, material: "BMC_Glow", material_intensity: 2, visibility: false,
  components: [{ type: "Component_Touch", data: { BeginTouchSound: null, EndTouchSound: null, bCollisionEnabled_Player: true, bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true } }] }, { grid: g.grid });
// the heart (2026-10-16, owner: "hearts dont look like hearts": the tilted cube + 2 caps read
// as a box, a spawned prefab may drop the grid tilt too): an upright puffy pixel heart of
// 4-unit voxels, 7 wide x 6 tall, deeper in the middle, white glint top left. Walk-through
// (the coin does the touching), a stud behind the coin so no brick overlaps it.
const PIX = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
const V = 4, CY = 12;
const on = (i, r) => r >= 0 && r < PIX.length && PIX[r][i] === "X";
const depth = (i, r) => (on(i - 1, r) && on(i + 1, r) && on(i, r - 1) && on(i, r + 1)) ? 6 : 2; // half depth
for (let r = 0; r < PIX.length; r++) for (let i = 0; i < 7;) {
  if (!on(i, r)) { i++; continue; }
  const d = depth(i, r); let j = i; while (j + 1 < 7 && on(j + 1, r) && depth(j + 1, r) === d && !(r === 1 && j + 1 === 1)) j++;
  if (r === 1 && i === 1) j = i; // glint pixel on its own
  const glint = r === 1 && i === 1;
  w.addBrick({ asset: "PB_DefaultMicroBrick", size: [(j - i + 1) * V / 2, d, V / 2], position: [((i + j + 1) / 2) * V - 14, CY, 10 - r * V],
    color: glint ? [255, 235, 235] : [230, 30, 45], owner_index: owner, material: "BMC_Glow", material_intensity: glint ? 4 : 3, collision: false }, { grid: g.grid });
  i = j + 1;
}
// the chip rides on the coin's grid, hidden just under it
const chipBrick = w.addBrick({ asset: "B_1x1_Microchip", position: [0, 0, -8], owner_index: owner, visibility: false, collision: false, components: [{ type: "Component_Internal_Microchip" }] }, { grid: g.grid });
const chip = { brick: chipBrick, grid: w.addBrickGrid({ type: "Entity_MicrochipDynamicBrickGrid", location: { X: 0, Y: 0, Z: 30 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 24, Y: 24, Z: 2 } } }) };
w.registerMicrochipLink(chip.brick, chip.grid);
let gx = 0; const at = () => [(gx % 2) * 20 - 10, Math.floor(gx++ / 2) * 20 - 10, 2];
const gate = (asset, type, data) => w.addBrick({ asset, position: at(), owner_index: owner, components: [{ type, data }] }, { grid: chip.grid.grid });
const heal = gate("B_1x1_Gate_Exec_Character_IncDamage", "BrickComponentType_WireGraph_Exec_Character_IncDamage", { Amount: -HEAL });
const delay = gate("B_1x1_Gate_Pseudo_Timer", "BrickComponentType_WireGraphPseudo_Timer", { Limit: 0.1, Time: 0.1, bRunning: false });
const self = gate("B_1x1_Gate_Internal_ReadBrickGrid", "BrickComponentType_Internal_ReadBrickGrid", {});
const destroy = gate("B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab", "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", {});
const sound = w.addBrick({ asset: "B_1x1_SoundEmitter", position: [0, 0, 8], owner_index: owner, visibility: false, collision: false,
  components: [{ type: "Component_OneShotAudioEmitter", data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1.5, InnerRadius: 15, MaxDistance: 400, bSpatialization: true, bEnableRepeat: false, RepeatTime: 1, RepeatVariance: 0, RepeatCount: 1 } }] }, { grid: g.grid });
const P = (brick, component_type, port) => ({ brick, component_type, port });
const TOUCH = "Component_Touch", INC = "BrickComponentType_WireGraph_Exec_Character_IncDamage", TM = "BrickComponentType_WireGraphPseudo_Timer";
const DS = "BrickComponentType_WireGraph_Exec_Entity_DestroySpawnedPrefab", RG = "BrickComponentType_Internal_ReadBrickGrid";
w.addWire(P(coin, TOUCH, "bTouching"), P(heal, INC, "Exec"));
w.addWire(P(coin, TOUCH, "Character"), P(heal, INC, "Character"));
w.addWire(P(coin, TOUCH, "bTouching"), P(sound, "Component_OneShotAudioEmitter", "Play"));
w.addWire(P(heal, INC, "ExecOut"), P(delay, TM, "Restart"));
w.addWire(P(delay, TM, "Expired"), P(destroy, DS, "Exec"));
w.addWire(P(self, RG, "BrickGrid"), P(destroy, DS, "Entity"));
w.makePrefab({});
const out = w.toBrz({ externalAssets: [{ type: "BrickOneShotAudioDescriptor", name: "OSA_FragGrenade_Bounce" }] });
fs.writeFileSync(path.join(PRE, "heal.brz"), out);
console.log("heal.brz", out.length, "bytes, heals", HEAL);
