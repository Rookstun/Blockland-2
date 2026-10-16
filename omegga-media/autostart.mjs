// heightmap2brz builds its clock Timer stopped (bRunning false), so a device
// waits for its Resume button. Rewrite the component chunks with the timer
// running so it plays as soon as it loads; every other file is copied as is.
// `brs` = the brs-js 3 bundle (lib/brs.mjs). Shared by the plugin and tools/ogrid.mjs.
export function autoStart(brs, buf) {
  const { brdb, WorldReader } = brs;
  const reader = WorldReader.from(buf);
  const schema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
  const files = new Map(reader.fs.listPaths().map(p => [p, reader.fs.readFile(p)]));
  let started = 0;
  for (const p of files.keys()) {
    const m = p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
    if (!m) continue;
    const chunk = reader.componentChunk(Number(m[1]), { x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) });
    const timers = chunk.components.filter(c => c.typeName === 'BrickComponentType_WireGraphPseudo_Timer' && c.data);
    if (!timers.length) continue;
    for (const c of timers) c.data.bRunning = true;
    started += timers.length;
    const parts = [schema.encode('BRSavedComponentChunkSoA', chunk.soa)];
    for (const c of chunk.components) if (c.structName) parts.push(schema.encode(c.structName, c.data));
    files.set(p, new Uint8Array(Buffer.concat(parts.map(x => Buffer.from(x)))));
  }
  if (!started) return buf;
  // rebuild the folder tree for the bundle writer (same as bridge/tools/shopgen.mjs)
  const root = new Map();
  for (const [p, content] of files) {
    const parts = p.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.has(dir)) node.set(dir, new Map());
      node = node.get(dir);
    }
    node.set(parts.at(-1), content);
  }
  const toNodes = m => [...m].map(([n, v]) => [n, v instanceof Map ? brdb.folder(toNodes(v)) : brdb.file(v)]);
  return Buffer.from(brdb.writeBrzContainer(toNodes(root)));
}
