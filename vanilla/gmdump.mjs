// dump every file under the GameMode folder of a .brdb (read-only)
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const { DatabaseSync } = await import("node:sqlite"); const zl = await import("node:zlib");
const db = new brs.Brdb(new DatabaseSync(process.argv[2], { readOnly: true }));
const walk = (id, path) => {
  for (const f of db.currentFiles(id)) { const b = db.findBlob(f.contentId); const s = Buffer.from(b.compression ? zl.zstdDecompressSync(Buffer.from(b.content)) : b.content).toString();
    console.log("==", path + "/" + f.name, s.replace(/"StartingInventory"[\s\S]*?\]/, '"StartingInventory":[..]').replace(/\s+/g, " ").slice(0, 700)); }
  for (const d of db.db.prepare("select folder_id, name from folders where parent_id=? and deleted_at is null").all(id)) walk(d.folder_id, path + "/" + d.name);
};
for (const d of db.db.prepare("select folder_id, name from folders where parent_id is null and deleted_at is null").all()) { console.log("#", d.name); if (d.name === "GameMode") walk(d.folder_id, "GameMode"); }
