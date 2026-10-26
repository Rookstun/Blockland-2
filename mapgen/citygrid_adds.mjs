// Server-side city deploy (run on pzedlo from ~/citygrid): ALL add_*.json queued into the bridge inbox at once (owner: never pace). Arg = number of batches to skip.
import fs from "fs"; import path from "path";
const root = path.join(process.env.HOME, "omegga-server/bridge"), dir = path.join(process.env.HOME, "citygrid");
const OWNER = { id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "abysmal garbage" };
const skip = +process.argv[2] || 0;
const files = fs.readdirSync(dir).filter(f => /^add_\d+\.json$/.test(f)).sort().slice(skip);
// every batch dropped into the inbox at once, no waiting between them
for (const f of files) {
  const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const id = Date.now() + "_city_" + f;
  fs.writeFileSync(path.join(root, "inbox", id + ".tmp"), JSON.stringify({ ops: [{ op: "bricks", at: [0, 0, 0], owner: OWNER, captureMs: 0, externalAssets, bricks }] }));
  fs.renameSync(path.join(root, "inbox", id + ".tmp"), path.join(root, "inbox", id));
}
console.log("queued", files.length);
