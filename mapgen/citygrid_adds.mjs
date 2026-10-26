// Server-side city deploy (run on pzedlo: node citygrid_adds.mjs DIR [OLD_CLEAR.json]).
// Owner rule: NEVER pace. Every ClearRegion of the old city goes in ONE job; after the game has drained
// them (~100/s; adds sent sooner get eaten by late clears) every add_*.json is queued into the bridge
// inbox at once, then the results are tallied. City bricks belong to their own owner, so a later
// rebuild is one `br.Bricks.Clear <CITY id> 1`.
import fs from "fs"; import path from "path";
const root = path.join(process.env.HOME, "omegga-server/bridge"), dir = path.resolve(process.argv[2] || ".");
const CITY = { id: "c1770000-0000-4b0b-9a11-00000000c177", name: "City" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const put = (ops, tag) => {
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 7) + "_" + tag + ".json";
  fs.writeFileSync(path.join(root, "inbox", id + ".tmp"), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, "inbox", id + ".tmp"), path.join(root, "inbox", id));
  return id;
};
const result = async id => { const out = path.join(root, "outbox", id); while (!fs.existsSync(out)) await sleep(1000); await sleep(200); const r = JSON.parse(fs.readFileSync(out, "utf8")); fs.rmSync(out); return r; };

if (process.argv[3]) {
  const clear = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  await result(put(clear.map(c => ({ op: "cmd", line: `br.World.ClearRegion ${c.join(" ")}`, captureMs: 0 })), "cityclear"));
  console.log("clears queued", clear.length);
  await sleep(8000 + clear.length * 10);
}
const files = fs.readdirSync(dir).filter(f => /^add_\d+\.json$/.test(f)).sort();
const ids = files.map(f => { const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); return put([{ op: "bricks", at: [0, 0, 0], owner: CITY, captureMs: 3000, externalAssets, bricks }], "city_" + f); });
console.log("adds queued", files.length);
let sent = 0, over = 0;
for (const id of ids) {
  const r = (await result(id)).results?.[0];
  sent += r?.count ?? 0;
  over += (r?.log ?? []).map(l => /overlapping in same grid\. \((\d+)\)/.exec(l)).filter(Boolean).reduce((a, m) => a + +m[1], 0);
}
console.log(`adds done: ${sent} sent, ${over} overlap rejects (world is read-only if uploaded: Save As)`);
