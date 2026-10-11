// Makes zombie spawner prefabs from the skeleton spawners: human body parts
// instead of skeleton ones, rotten-green skin, ragged clothes, claws, slow and
// tough. Rewrites the prefab container in place (GlobalData + component chunk).
import fs from "fs"; import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const DIR = "/home/max/omegga-server/data/Saved/Prefabs/";
const concat = parts => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
function make(srcName, outName, botName, stats, palette) {
  const r = brs.WorldReader.from(fs.readFileSync(DIR + srcName + ".brz")), X = r.fs;
  const node = id => { const children = [];
    X.folderNames.forEach((n, i) => { if (X.folderParentIds[i] === id) children.push([n, node(i)]); });
    X.fileNames.forEach((n, i) => { if (X.fileParentIds[i] === id) children.push([n, { type: "file", content: X.fileContentIds[i] < 0 ? new Uint8Array(0) : X.readBlob(X.fileContentIds[i]) }]); });
    return { type: "folder", children }; };
  const tree = node(-1).children;
  const find = p => p.split("/").reduce((t, h, i, a) => { const e = t.find(([n]) => n === h)[1]; return i === a.length - 1 ? e : e.children; }, tree);
  // global data: swap skeleton parts and the weapon
  const g = structuredClone(r.globalData());
  const SWAP = { PPD_Skeleton_Torso: "PPD_Default_Torso", PPD_Head_Skeleton: "PPD_Default_Head", PPD_Skeleton_Arm: "PPD_Default_Arm",
    PPD_Skeleton_Wrist: "PPD_Default_Wrist", PPD_Skeleton_Hand: "PPD_Default_Hand", PPD_Skeleton_Leg: "PPD_Default_Leg", PPD_Skeleton_Ankle: "PPD_Default_Ankle" };
  for (const a of g.ExternalAssetReferences) {
    if (SWAP[a.PrimaryAssetName]) a.PrimaryAssetName = SWAP[a.PrimaryAssetName];
    else if (a.PrimaryAssetType === "BRItemBase") a.PrimaryAssetName = "Weapon_Claws";
  }
  const gs = r.schema(r.path("GlobalData.schema"));
  find(r.path("GlobalData.mps")).content = gs.encode("BRSavedGlobalDataSoA", g);
  // bot component
  const idx = [...r.brickChunkIndex(1)][0].index, cpath = r.path(`Bricks/Grids/1/Components/${idx.x}_${idx.y}_${idx.z}.mps`);
  const cs = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), X.findFileByPath(cpath).createdAt);
  const cc = r.componentChunk(1, idx), z = cc.components[0].data;
  Object.assign(z, stats, { BotName: botName });
  for (const p of z.Skin.Parts) {
    const c = palette[p.SocketName] ?? palette[p.SocketName.replace(/_[RL]$/, "")];
    if (c) p.Colors.forEach((col, k) => { if (col.A) Object.assign(col, { R: c[k % c.length][0], G: c[k % c.length][1], B: c[k % c.length][2] }); });
  }
  find(cpath).content = concat([cs.encode("BRSavedComponentChunkSoA", cc.soa), ...cc.components.map(c => cs.encode(c.structName, c.data))]);
  fs.writeFileSync(DIR + outName + ".brz", brs.brdb.writeBrzContainer(tree));
  const chk = brs.WorldReader.from(fs.readFileSync(DIR + outName + ".brz"));
  console.log(outName, chk.componentChunk(1, idx).components[0].data.BotName, chk.globalData().ExternalAssetReferences.map(a => a.PrimaryAssetName).join(","));
}
const SKIN = [[118, 150, 88]], ROT = [[96, 128, 70]];
const palette = (shirt, pants) => ({ Part_Torso: shirt, Part_Head: SKIN, Part_Arm: ROT, Part_Wrist: SKIN, Part_Hand: SKIN, Part_Leg: pants, Part_Ankle: pants, Part_Shoe: [[58, 44, 34]] });
const base = { RespawnTime: 8, CorpseTimeout: 8, Agression: 1, ReactionTime: 0.6, MovementRandomness: 20, Jumpyness: 0.1, MovementAmount: 0.35, AttackMovementAmount: 1, AggroRange: 1400, bCanJump: true, bCanTargetBots: false };
make("dungeon_spawner_1", "swamp_zombie_1", "Swamp Zombie", { ...base, RunSpeed: 0.75, HealthMultiplier: 1.5, AttackDamageMultiplier: 0.8 }, palette([[120, 104, 70], [96, 84, 58]], [[70, 62, 48]]));
make("dungeon_spawner_2", "swamp_zombie_2", "Bloated Zombie", { ...base, RunSpeed: 0.6, HealthMultiplier: 3, AttackDamageMultiplier: 1.3 }, palette([[150, 140, 60], [128, 118, 50]], [[92, 70, 40]]));
