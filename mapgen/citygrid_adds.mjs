// Server-side deploy of the housegrid chunks (run on pzedlo from ~/housegrid, see mapgen/housegrid.mjs).
// One bricks op per add_*.json, sequential, 2 s apart (20k with no gap = "Prefab not found" losses).
import fs from "fs"; import path from "path";
const root = path.join(process.env.HOME, "omegga-server/bridge"), dir = path.join(process.env.HOME, process.argv[2] || "citygrid");
const OWNER = { id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "abysmal garbage" };
const job = async (ops, tag) => {
  const id = Date.now() + "_" + tag + ".json";
  fs.writeFileSync(path.join(root, "inbox", id + ".tmp"), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, "inbox", id + ".tmp"), path.join(root, "inbox", id));
  const out = path.join(root, "outbox", id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 600) throw new Error("no result for " + id); await new Promise(r => setTimeout(r, 1000)); }
  const res = JSON.parse(fs.readFileSync(out, "utf8")); fs.rmSync(out); return res;
};
let total = 0, over = 0;
for (const f of fs.readdirSync(dir).filter(f => /^add_\d+\.json$/.test(f)).sort()) {
  const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const res = await job([{ op: "bricks", at: [0, 0, 0], owner: OWNER, captureMs: 6000, externalAssets, bricks }], f.replace(".json", ""));
  const r = res.results?.[0], log = r?.log ?? [];
  const ov = log.map(l => /Brick is overlapping in same grid\. \((\d+)\)/.exec(l)).filter(Boolean).reduce((a, m) => a + +m[1], 0);
  total += r?.count ?? 0; over += ov;
  console.log(`${f}: ${r?.count} bricks, ${ov} overlap rejects${res.error ? " ERROR " + String(res.error).slice(0, 200) : ""}`);
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`adds done: ${total} sent, ${over} overlap rejects`);
console.log("no save: uploaded world is read-only");
