// Bot homes (owner 2026-10-10: "all the bots that get placed have to set their
// home to their coordinates or they get lost"). Component_BotSpawn MoveTarget
// is the bots' home; the spawner prefabs carry (0,0,0), so every bot wandered
// off toward the world origin. This sets MoveTarget to the spawner brick's own
// world position.
//   node homes.mjs world <file.brdb>                 patch every spawner in a world (run on a COPY)
//   node homes.mjs prefab <src> <dst> <x> <y> <z>    copy prefab <src> to <dst> with MoveTarget (x,y,z)
// loadextras.py uses the prefab mode: each spot loads its own copy, homed there.
import fs from "fs";
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const CHUNK = 2048, HALF = 1024; // brdb chunk size and offset (brs.mjs ns/rs)
const concat = parts => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const encode = (schema, cc) => concat([schema.encode("BRSavedComponentChunkSoA", cc.soa), ...cc.components.filter(c => c.structName).map(c => schema.encode(c.structName, c.data))]);
/** sets MoveTarget on every spawner in a chunk; home(c, rel) -> [x,y,z] */
function patchChunk(r, schema, idx, home, log) {
  const cc = r.componentChunk(1, idx);
  const sp = cc.components.filter(c => c.typeName === "Component_BotSpawn" && c.data);
  if (!sp.length) return null;
  const rel = r.brickChunkSoa(1, idx).RelativePositions;
  let hit = 0;
  for (const c of sp) {
    const p = rel[c.brickIndex];
    if (!home && !p) { log.orphans = (log.orphans ?? 0) + 1; continue; } // component left over from a cleared brick
    const at = home ?? [idx.x * CHUNK + HALF + p.X, idx.y * CHUNK + HALF + p.Y, idx.z * CHUNK + HALF + p.Z];
    c.data.MoveTarget = { X: at[0], Y: at[1], Z: at[2] };
    log.push(`${c.data.BotName} -> ${at.join(",")}`);
    hit++;
  }
  return hit ? encode(schema, cc) : null;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "world") {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new brs.Brdb(new DatabaseSync(args[0]));
  const r = db.worldReader();
  const dir = r.path("Bricks/Grids/1/Components"), folder = db.folderIdOf(dir);
  const entries = new Map(), log = [];
  let changed = 0;
  for (const f of db.currentFiles(folder)) {
    let content = db.readBlob(f.contentId);
    const m = f.name.match(/^(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (m) {
      const idx = { x: +m[1], y: +m[2], z: +m[3] };
      const schema = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), db.findFileByPath(`${dir}/${f.name}`).createdAt);
      const out = patchChunk(r, schema, idx, null, log);
      if (out) { content = out; changed++; }
    }
    entries.set(f.name, { type: "file", content });
  }
  db.mergeFolder(folder, entries, Math.floor(Date.now() / 1000), null);
  db.close?.();
  console.log(`chunks changed ${changed}, spawners homed ${log.length}, orphan components skipped ${log.orphans ?? 0}`);
  console.log(log.slice(0, 5).join("\n"));
} else if (mode === "prefab") {
  const [src, dst, ...xyz] = args;
  const r = brs.WorldReader.from(fs.readFileSync(src)), X = r.fs;
  const node = id => { const children = [];
    X.folderNames.forEach((nm, i) => { if (X.folderParentIds[i] === id) children.push([nm, node(i)]); });
    X.fileNames.forEach((nm, i) => { if (X.fileParentIds[i] === id) children.push([nm, { type: "file", content: X.fileContentIds[i] < 0 ? new Uint8Array(0) : X.readBlob(X.fileContentIds[i]) }]); });
    return { type: "folder", children }; };
  const tree = node(-1).children;
  const find = p => p.split("/").reduce((t, h, i, a) => { const e = t.find(([nm]) => nm === h)[1]; return i === a.length - 1 ? e : e.children; }, tree);
  const log = [];
  for (const { index: idx } of r.brickChunkIndex(1)) {
    const cpath = r.path(`Bricks/Grids/1/Components/${idx.x}_${idx.y}_${idx.z}.mps`);
    if (!X.findFileByPath(cpath)) continue;
    const schema = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), X.findFileByPath(cpath).createdAt);
    const out = patchChunk(r, schema, idx, xyz.map(Number), log);
    if (out) find(cpath).content = out;
  }
  if (!log.length) throw new Error(`${src}: no spawner`);
  fs.writeFileSync(dst, brs.brdb.writeBrzContainer(tree));
} else {
  console.error("usage: homes.mjs world <file.brdb> | prefab <src> <dst> x y z");
  process.exit(1);
}
