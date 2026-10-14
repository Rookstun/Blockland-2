// Every enemy gets a gun (owner 2026-10-13: "give every enemy in the world guns").
// Server tool (bridge/tools/guns.mjs). A Component_BotSpawn's BotWeapon is an index
// into the save's external assets (BRItemBase); harder enemies get heavier guns.
// Casino staff (npc_*) are not enemies and keep theirs; the Evil Wizard already
// carries a gun (plasma pistol).
//   node guns.mjs world <file.brdb>   patch a world (run on a COPY, then World.Load it)
//   node guns.mjs prefabs             patch the base spawner prefabs (backups *.pre_guns.brz):
//                                     their one BRItemBase reference is renamed to the gun
import fs from "fs";
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
export const GUNS = {
  "Goblin": "Weapon_Derringer",
  "Wood Goblin": "Weapon_Revolver",
  "Handaxe Skeleton": "Weapon_Pistol",
  "Arming Sword Skeleton": "Weapon_Revolver",
  "Spear Skeleton": "Weapon_HuntingShotgun",
  "Longsword Skeleton": "Weapon_LeverActionRifle",
  "Bow Skeleton": "Weapon_BoltActionRifle",
  "Zweihander Skeleton": "Weapon_MagnumPistol",
  "Battleaxe Skeleton": "Weapon_AssaultRifle",
  "Swamp Zombie": "Weapon_Pistol",
  "Bloated Zombie": "Weapon_HuntingShotgun",
};
const concat = parts => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

const [mode, file] = process.argv.slice(2);
if (mode === "world") {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new brs.Brdb(new DatabaseSync(file));
  const r = db.worldReader();
  const ext = r.externalAssets();
  const idxOf = name => ext.findIndex(e => e.type === "BRItemBase" && e.name === name);
  for (const g of new Set(Object.values(GUNS))) if (idxOf(g) < 0) throw new Error(`${g} is not in this world's external assets`);
  const cdir = r.path("Bricks/Grids/1/Components");
  const out = new Map(), tally = {};
  for (const f of db.currentFiles(db.folderIdOf(cdir))) {
    const m = f.name.match(/^(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (!m) continue;
    let cc;
    try { cc = r.componentChunk(1, { x: +m[1], y: +m[2], z: +m[3] }); } catch { continue; }
    let hit = 0;
    for (const c of cc.components) {
      if (c.typeName !== "Component_BotSpawn" || !c.data) continue;
      const gun = GUNS[c.data.BotName];
      const k = `${c.data.BotName} -> ${gun ?? "(unchanged) " + (ext[c.data.BotWeapon]?.name ?? c.data.BotWeapon)}`;
      tally[k] = (tally[k] ?? 0) + 1;
      if (!gun) continue;
      c.data.BotWeapon = idxOf(gun);
      hit++;
    }
    if (!hit) continue;
    const cs = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), db.findFileByPath(`${cdir}/${f.name}`).createdAt);
    out.set(f.name, concat([cs.encode("BRSavedComponentChunkSoA", cc.soa), ...cc.components.filter(c => c.structName).map(c => cs.encode(c.structName, c.data))]));
  }
  const folder = db.folderIdOf(cdir), entries = new Map();
  for (const f of db.currentFiles(folder)) entries.set(f.name, { type: "file", content: out.get(f.name) ?? db.readBlob(f.contentId) });
  db.mergeFolder(folder, entries, Math.floor(Date.now() / 1000), null);
  db.close?.();
  console.log(`component chunks changed ${out.size}`, JSON.stringify(tally, null, 1));
} else if (mode === "prefabs") {
  const DIR = "/home/max/omegga-server/data/Saved/Prefabs/";
  for (const n of ["dungeon_spawner_1", "dungeon_spawner_2", "dungeon_spawner_3", "dungeon_spawner_4", "dungeon_spawner_5", "dungeon_spawner_6", "dungeon_spawner_7", "swamp_zombie_1", "swamp_zombie_2", "enemy_goblin", "enemy_wood_goblin", "enemy_wizard"]) {
    if (!fs.existsSync(DIR + n + ".brz")) { console.log(n, "missing"); continue; }
    if (!fs.existsSync(DIR + n + ".pre_guns.brz")) fs.copyFileSync(DIR + n + ".brz", DIR + n + ".pre_guns.brz");
    const r = brs.WorldReader.from(fs.readFileSync(DIR + n + ".pre_guns.brz"));
    let name = null;
    for (const { index } of r.brickChunkIndex(1)) { let c; try { c = r.componentChunk(1, index); } catch { continue; } for (const x of c.components) if (x.typeName === "Component_BotSpawn") name = x.data.BotName; }
    const gun = GUNS[name];
    if (!gun) { fs.copyFileSync(DIR + n + ".pre_guns.brz", DIR + n + ".brz"); console.log(n, name, "kept its weapon"); continue; }
    const files = new Map(r.fs.listPaths().map(p => [p, r.fs.readFile(p)]));
    const g = structuredClone(r.globalData());
    const items = g.ExternalAssetReferences.filter(a => a.PrimaryAssetType === "BRItemBase");
    if (items.length !== 1) throw new Error(`${n}: ${items.length} BRItemBase references, expected 1`);
    const was = items[0].PrimaryAssetName;
    items[0].PrimaryAssetName = gun;
    files.set(r.path("GlobalData.mps"), new Uint8Array(r.schema(r.path("GlobalData.schema")).encode("BRSavedGlobalDataSoA", g)));
    const root = new Map();
    for (const [p, content] of files) { const parts = p.split("/"); let node = root; for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); } node.set(parts.at(-1), content); }
    const toNodes = m => [...m].map(([nm, v]) => [nm, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
    const buf = brs.brdb.writeBrzContainer(toNodes(root));
    const check = brs.WorldReader.from(Buffer.from(buf)).globalData().ExternalAssetReferences.filter(a => a.PrimaryAssetType === "BRItemBase").map(a => a.PrimaryAssetName);
    if (check[0] !== gun) throw new Error(`${n}: reads back ${check}`);
    fs.writeFileSync(DIR + n + ".brz", buf);
    console.log(n, name, was, "->", gun);
  }
} else {
  console.error("usage: guns.mjs world <file.brdb> | prefabs");
  process.exit(1);
}
