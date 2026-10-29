// Sandbox -> combat: Unaffiliated gets weapon/physics/environment damage + friendly damage (bot vs bot), mode renamed.
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const { DatabaseSync } = await import("node:sqlite"); const zl = await import("node:zlib");
const db = new brs.Brdb(new DatabaseSync(process.argv[2]));
const sub = (name, parent) => db.db.prepare(`select folder_id from folders where name=? and parent_id ${parent == null ? "is null" : "=" + parent} and deleted_at is null`).get(name).folder_id;
const gm = sub("GameMode");
const patch = (folder, fn) => {
  const entries = new Map();
  for (const f of db.currentFiles(folder)) {
    const b = db.findBlob(f.contentId); const c = Buffer.from(b.compression ? zl.zstdDecompressSync(Buffer.from(b.content)) : b.content);
    const t = JSON.parse(c.toString()); const n = fn(f.name, t);
    entries.set(f.name, { type: "file", content: n ? new TextEncoder().encode(JSON.stringify(t, null, "\t")) : new Uint8Array(c) });
  }
  db.mergeFolder(folder, entries, Math.floor(Date.now() / 1000), null);
};
let hit = 0;
patch(sub("Teams", gm), (name, t) => { if (name !== "Unaffiliated.json") return false; hit++;
  t.bWeaponDamageMode = t.bPhysicsDamageMode = t.bEnvironmentDamageMode = true; t.bFriendlyDamage = true;
  t.Rules = (t.Rules || []).filter(r => !/ConsiderTeamHostile/.test(r.Class));
  t.Rules.push({ Class: "/Script/Brickadia.BRGameModeTeamRule_ConsiderTeamHostile", Properties: { TargetTeamName: "Unaffiliated" } });
  t.RulesNextId = Math.max(t.RulesNextId || 0, 10); return true; });
patch(sub("GameMode", gm), (name, t) => name === "Settings.json" && (t.GameModeName = "Melee Pit"));
if (hit !== 1) throw new Error("Unaffiliated: " + hit);
console.log("patched");
