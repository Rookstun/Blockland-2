// Spawner tuning (owner 2026-10-10: "enemies need their roam distance or random
// walking to 60", "make spawners invisible", "goblins are insanely hard to defeat").
// For every Component_BotSpawn:
//   MovementRandomness 60, goblin health/damage from GOBLINS, bCanTargetBots false
//   (2026-10-11 owner: "bots hit eachother forever"),
//   the spawner brick hidden with player/weapon collision off.
//   node spawnerfix.mjs world <file.brdb>   patch a world (run on a COPY, then World.Load it)
//   node spawnerfix.mjs prefabs             patch the base spawner prefabs (backups *.pre_fix1010.brz)
// difficulty.mjs CURVE holds the same goblin numbers, so a rerun of it agrees.
import fs from "fs";
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
export const ROAM = 60;
// [HealthMultiplier, AttackDamageMultiplier]. Max health (100 x HealthMultiplier) must stay unique per
// type: skeleton_drop (gen.js ENEMY) names enemies and picks XP by it. Wood Goblin 0.55, Bloated 1.3,
// Wizard 1.2 were nudged off 0.5 / 1.25 for that; Wizard then 0.65 / 0.4 (owner: "WIZARDS ARE TOO STRONG").
export const GOBLINS = { "Goblin": [0.35, 0.3], "Wood Goblin": [0.55, 0.4], "Bloated Zombie": [1.3, 1], "Evil Wizard": [0.65, 0.4] };
const concat = parts => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const clearBit = (f, i) => { if (f?.Flags && f.Flags[i >> 3] !== undefined) f.Flags[i >> 3] &= ~(1 << (i & 7)); };

/** patches one chunk: returns { comp, bricks } new bytes (null = unchanged) */
function patchChunk(r, idx, compSchema, brickSchema, log) {
  let cc;
  try { cc = r.componentChunk(1, idx); } catch { return { comp: null, bricks: null }; }
  const sp = cc.components.filter(c => c.typeName === "Component_BotSpawn" && c.data);
  if (!sp.length) return { comp: null, bricks: null };
  const soa = r.brickChunkSoa(1, idx);
  let hidden = 0;
  for (const c of sp) {
    const d = c.data;
    d.MovementRandomness = ROAM;
    if (d.bCanTargetBots) log.push("targetedBots");
    d.bCanTargetBots = false;
    if (GOBLINS[d.BotName]) [d.HealthMultiplier, d.AttackDamageMultiplier] = GOBLINS[d.BotName];
    if (c.brickIndex < soa.BrickTypeIndices.length) {
      for (const f of ["VisibilityFlags", "CollisionFlags_Player", "CollisionFlags_Weapon"]) clearBit(soa[f], c.brickIndex);
      hidden++;
    }
    log.push(d.BotName);
  }
  const comp = concat([compSchema.encode("BRSavedComponentChunkSoA", cc.soa), ...cc.components.filter(c => c.structName).map(c => compSchema.encode(c.structName, c.data))]);
  return { comp, bricks: hidden ? brickSchema.encode("BRSavedBrickChunkSoA", soa) : null };
}

const [mode, file] = process.argv.slice(2);
if (mode === "world") {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new brs.Brdb(new DatabaseSync(file));
  const r = db.worldReader();
  const cdir = r.path("Bricks/Grids/1/Components"), bdir = r.path("Bricks/Grids/1/Chunks");
  const brickOut = new Map(), compOut = new Map(), log = [];
  for (const f of db.currentFiles(db.folderIdOf(cdir))) {
    const m = f.name.match(/^(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (!m) continue;
    const idx = { x: +m[1], y: +m[2], z: +m[3] };
    const cs = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), db.findFileByPath(`${cdir}/${f.name}`).createdAt);
    const bs = r.schemaAt(r.path("Bricks/ChunksShared.schema"), db.findFileByPath(`${bdir}/${f.name}`).createdAt);
    const { comp, bricks } = patchChunk(r, idx, cs, bs, log);
    if (comp) compOut.set(f.name, comp);
    if (bricks) brickOut.set(f.name, bricks);
  }
  const now = Math.floor(Date.now() / 1000);
  for (const [dir, out] of [[cdir, compOut], [bdir, brickOut]]) {
    const folder = db.folderIdOf(dir), entries = new Map();
    for (const f of db.currentFiles(folder)) entries.set(f.name, { type: "file", content: out.get(f.name) ?? db.readBlob(f.contentId) });
    db.mergeFolder(folder, entries, now, null);
  }
  db.close?.();
  const tally = {}; for (const n of log) tally[n] = (tally[n] ?? 0) + 1;
  console.log(`spawners ${log.length}, component chunks ${compOut.size}, brick chunks ${brickOut.size}`, tally);
} else if (mode === "prefabs") {
  const DIR = "/home/max/omegga-server/data/Saved/Prefabs/";
  for (const n of ["dungeon_spawner_1", "dungeon_spawner_2", "dungeon_spawner_3", "dungeon_spawner_4", "dungeon_spawner_5", "dungeon_spawner_6", "dungeon_spawner_7", "swamp_zombie_1", "swamp_zombie_2", "enemy_goblin", "enemy_wood_goblin", "enemy_wizard"]) {
    if (!fs.existsSync(DIR + n + ".brz")) { console.log(n, "missing"); continue; }
    if (!fs.existsSync(DIR + n + ".pre_fix1010.brz")) fs.copyFileSync(DIR + n + ".brz", DIR + n + ".pre_fix1010.brz");
    const r = brs.WorldReader.from(fs.readFileSync(DIR + n + ".pre_fix1010.brz")), X = r.fs;
    const node = id => { const children = [];
      X.folderNames.forEach((nm, i) => { if (X.folderParentIds[i] === id) children.push([nm, node(i)]); });
      X.fileNames.forEach((nm, i) => { if (X.fileParentIds[i] === id) children.push([nm, { type: "file", content: X.fileContentIds[i] < 0 ? new Uint8Array(0) : X.readBlob(X.fileContentIds[i]) }]); });
      return { type: "folder", children }; };
    const tree = node(-1).children;
    const find = p => p.split("/").reduce((t, h, i, a) => { const e = t.find(([nm]) => nm === h)[1]; return i === a.length - 1 ? e : e.children; }, tree);
    const log = [];
    for (const { index: idx } of r.brickChunkIndex(1)) {
      const name = `${idx.x}_${idx.y}_${idx.z}.mps`;
      const cpath = r.path(`Bricks/Grids/1/Components/${name}`), bpath = r.path(`Bricks/Grids/1/Chunks/${name}`);
      if (!X.findFileByPath(cpath)) continue;
      const cs = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), X.findFileByPath(cpath).createdAt);
      const bs = r.schemaAt(r.path("Bricks/ChunksShared.schema"), X.findFileByPath(bpath).createdAt);
      const { comp, bricks } = patchChunk(r, idx, cs, bs, log);
      if (comp) find(cpath).content = comp;
      if (bricks) find(bpath).content = bricks;
    }
    fs.writeFileSync(DIR + n + ".brz", brs.brdb.writeBrzContainer(tree));
    console.log(n, log.join(", ") || "no spawner");
  }
} else {
  console.error("usage: spawnerfix.mjs world <file.brdb> | prefabs");
  process.exit(1);
}
