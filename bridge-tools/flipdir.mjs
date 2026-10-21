// 2026-10-21 (owner: "some of the weapon shops have their item face set to -z when it needs to be +z"):
// set Component_ItemSpawn.PickupOffsetDirection to DIR (default 4 = Z+) in every existing *_bare / *_case
// stand prefab, nothing else changed (each read back). Originals -> Saved/standdir_pre/.
//   node flipdir.mjs [dry]      (server)
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs'), BAK = path.join(process.env.HOME, 'omegga-server/data/Saved/standdir_pre');
const DIR = Number(process.env.DIR ?? 4), DRY = process.argv[2] === 'dry';
function bundle(files) {
  const root = new Map();
  for (const [p, content] of files) { const parts = p.split('/'); let node = root; for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); } node.set(parts.at(-1), content); }
  const toNodes = m => [...m].map(([name, v]) => [name, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}
fs.mkdirSync(BAK, { recursive: true });
const tally = {};
for (const f of fs.readdirSync(PREFABS).filter(f => /^(shop|gun|bow)_[a-z0-9_]+_(bare|case)\.brz$/.test(f))) {
  const src = fs.readFileSync(path.join(PREFABS, f)), reader = brs.WorldReader.from(src), paths = reader.fs.listPaths();
  const cschema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
  const files = new Map(paths.map(p => [p, reader.fs.readFile(p)]));
  let n = 0, old = [];
  for (const p of paths) {
    const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/); if (!m) continue;
    const chunk = reader.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] });
    if (!chunk.components.some(c => c.typeName === 'Component_ItemSpawn')) continue;
    for (const c of chunk.components) if (c.typeName === 'Component_ItemSpawn') { old.push(c.data.PickupOffsetDirection); c.data.PickupOffsetDirection = DIR; n++; }
    const parts = [cschema.encode('BRSavedComponentChunkSoA', chunk.soa)];
    for (const c of chunk.components) if (c.structName) parts.push(cschema.encode(c.structName, c.data));
    files.set(p, new Uint8Array(Buffer.concat(parts.map(x => Buffer.from(x)))));
  }
  const k = `${n} spawn(s) dir ${old.join(',')}`; tally[k] = (tally[k] || 0) + 1;
  if (n !== 1) { console.log(f, 'SKIP', k); continue; }
  if (old[0] === DIR) continue;
  const out = bundle(files), check = brs.WorldReader.from(Buffer.from(out));
  for (const p of paths) {
    const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (m) { for (const c of check.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] }).components) if (c.typeName === 'Component_ItemSpawn' && c.data.PickupOffsetDirection !== DIR) throw new Error(f + ' read back wrong'); }
    else if (!Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`${f}: ${p} changed`);
  }
  if (!DRY) { if (!fs.existsSync(path.join(BAK, f))) fs.writeFileSync(path.join(BAK, f), src); fs.writeFileSync(path.join(PREFABS, f), out); }
}
console.log(DRY ? 'dry' : 'written', tally);
