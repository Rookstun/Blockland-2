// Server-side city deploy (pzedlo: node citygrid_adds.mjs DIR). Owner rule: NEVER queue bricks.
// ONE job: wipe the City owner's bricks, then ONE bricks op with every brick of DIR/add.json. No batches,
// no waits; check the log afterwards.
import fs from "fs"; import path from "path";
const root = path.join(process.env.HOME, "omegga-server/bridge"), dir = path.resolve(process.argv[2] || ".");
const CITY = { id: "c1770000-0000-4b0b-9a11-00000000c177", name: "City" };
const { bricks, externalAssets } = JSON.parse(fs.readFileSync(path.join(dir, "add.json"), "utf8"));
const id = Date.now() + "_city.json";
fs.writeFileSync(path.join(root, "inbox", id + ".tmp"), JSON.stringify({ ops: [
  { op: "cmd", line: `br.Bricks.Clear ${CITY.id} 1`, captureMs: 0 },
  { op: "bricks", at: [0, 0, 0], owner: CITY, captureMs: 0, externalAssets, bricks },
] }));
fs.renameSync(path.join(root, "inbox", id + ".tmp"), path.join(root, "inbox", id));
console.log("sent", bricks.length, "bricks in one op:", id);
