// Server-side city deploy (pzedlo: node citygrid_adds.mjs DIR). Owner rule: NEVER queue bricks.
// ONE job: wipe the City owner's bricks, then ONE bricks op with every brick of DIR/add.json. No batches,
// no waits; check the log afterwards. If DIR/citysignals.brz exists (roads.mjs / signals.mjs, wired traffic
// signals), it is copied to Saved/Prefabs and reloaded in the same job under its own owner (City Signals).
import fs from "fs"; import path from "path";
const root = path.join(process.env.HOME, "omegga-server/bridge"), dir = path.resolve(process.argv[2] || ".");
const CITY = { id: "c1770000-0000-4b0b-9a11-00000000c177", name: "City" };
const SIGNALS = { id: "c1770000-0000-4b0b-9a11-00000000519a", name: "City Signals" };
const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, "add.json"), "utf8"));
const sig = path.join(dir, "citysignals.brz");
const ops = [
  { op: "cmd", line: `br.Bricks.Clear ${CITY.id} 1`, captureMs: 0 },
  { op: "bricks", at: [0, 0, 0], owner: CITY, captureMs: 0, externalAssets, bricks },
];
if (fs.existsSync(sig)) {
  fs.copyFileSync(sig, path.join(process.env.HOME, "omegga-server/data/Saved/Prefabs/citysignals.brz"));
  ops.push({ op: "cmd", line: `br.Bricks.Clear ${SIGNALS.id} 1`, captureMs: 0 }, { op: "cmd", line: `br.Prefab.Load "citysignals" 0 0 0 0 16`, captureMs: 2000 });
}
const id = Date.now() + "_city.json";
fs.writeFileSync(path.join(root, "inbox", id + ".tmp"), JSON.stringify({ ops }));
fs.renameSync(path.join(root, "inbox", id + ".tmp"), path.join(root, "inbox", id));
console.log("sent", bricks.length, "bricks in one op" + (fs.existsSync(sig) ? " + signals prefab" : "") + ":", id);
