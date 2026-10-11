// Unaffiliated keeps bFriendlyDamage TRUE: players sit on it after a world load (until the chip moves them to Chud);
// false made bots and players unable to hurt each other (2026-10-11). Bot-vs-bot is stopped by spawnerfix bCanTargetBots.
// Chud (player team) must ConsiderTeamHostile "Unaffiliated" (bots) or players can't hurt bots; + WaterDamage 100 (weed3 fix).
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const { DatabaseSync } = await import("node:sqlite"); const zl = await import("node:zlib");
const db = new brs.Brdb(new DatabaseSync(process.argv[2]));
const gm = db.db.prepare("select folder_id from folders where name=? and parent_id is null and deleted_at is null").get("GameMode").folder_id;
const folder = db.db.prepare("select folder_id from folders where name=? and parent_id=? and deleted_at is null").get("Teams", gm).folder_id;
const entries = new Map(); let hit = 0;
for (const f of db.currentFiles(folder)) {
  const b = db.findBlob(f.contentId); let c = Buffer.from(b.content); if (b.compression) c = Buffer.from(zl.zstdDecompressSync(c));
  let content = new Uint8Array(c);
  const t = JSON.parse(Buffer.from(c).toString());
  if (t.TeamName === "Chud") {
    hit++;
    t.Rules = (t.Rules || []).filter(r => !/ConsiderTeamHostile|WaterDamage/.test(r.Class));
    t.Rules.push({ Class: "/Script/Brickadia.BRGameModeTeamRule_ConsiderTeamHostile", Properties: { TargetTeamName: "Unaffiliated" } });
    t.Rules.push({ Class: "/Script/Brickadia.BRGameModeTeamRule_WaterDamage", Properties: { DamagePerSecond: 100 } });
    t.RulesNextId = Math.max(t.RulesNextId || 0, 30);
    t.bFriendlyDamage = true; delete t.MaxBots;
    content = new TextEncoder().encode(JSON.stringify(t, null, "\t"));
  }
  if (f.name === "Unaffiliated.json") { t.bFriendlyDamage = true; content = new TextEncoder().encode(JSON.stringify(t, null, "	")); }
  entries.set(f.name, { type: "file", content });
}
if (hit !== 1) throw new Error("Chud teams: " + hit);
db.mergeFolder(folder, entries, Math.floor(Date.now() / 1000), null);
for (const f of db.currentFiles(folder)) { const b = db.findBlob(f.contentId); console.log(f.name, Buffer.from(b.compression ? zl.zstdDecompressSync(Buffer.from(b.content)) : b.content).toString().replace(/"StartingInventory"[\s\S]*?"Rules"/, '"Rules"').replace(/\s+/g, " ").slice(0, 400)); }
