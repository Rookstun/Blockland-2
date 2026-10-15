// Shared helpers for EA3.2 chips written with brs-js 4.0.0 (Latest format).
// mk(distPath, { owner }) -> { w, C, gate, wire, print, loopChip, num, ... }
export async function mk(dist, { owner = 'test' } = {}) {
  const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
  const { World, brdb, WorldReader } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const OWNERS = {
    test: { id: 'ea320000-7e57-4c0d-9a11-000000000032', name: 'EA32 Test', display_name: 'EA32 Test' },
    renderman: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'renderman', display_name: 'renderman' },
  };
  const ownerIdx = w.addOwner(typeof owner === 'string' ? OWNERS[owner] : owner);

  // gates are laid out on a grid per brick grid (40 apart: some gate bricks are bigger than 1x1)
  const slots = new Map();
  const gate = (c, data = {}, grid, extra = {}) => {
    const k = grid ?? 'main', i = slots.get(k) ?? 0; slots.set(k, i + 1);
    const base = k === 'main' ? [0, -400] : [0, 0];
    const h = w.addBrick({
      asset: c.BRICK, position: [base[0] + (i % 12) * 40, base[1] - Math.floor(i / 12) * 40, 2], color: [200, 200, 200],
      owner_index: ownerIdx, components: [{ type: c.NAME, data }], ...extra,
    }, grid);
    return { h, c };
  };
  const wire = (a, ap, b, bp) => {
    if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] },
              { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
  };
  const num = v => ({ $variant: 'f64', value: v });
  const int = v => ({ $variant: 'i64', value: v });
  const str = v => ({ $variant: 'Str', value: v });
  // FormatText -> PrintToConsole; returns { f, p }
  const print = (fmtStr, grid) => {
    const f = gate(C.Expr_String_FormatText, { FormatString: fmtStr }, grid);
    const p = gate(C.Exec_PrintToConsole, { Text: '' }, grid);
    wire(f, 'Output', p, 'Text');
    return { f, p };
  };
  // a special microchip (loop/function) shell on `parent` + its inner grid
  const chip = (c, data, parent) => {
    const shell = gate(c, data, parent);
    const grid = w.addBrickGrid({
      type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
      data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } },
    });
    w.registerMicrochipLink(shell.h, grid);
    return { shell, grid };
  };
  // one-shot exec ~secs after load
  const onLoad = (secs = 3) => {
    const sw = gate(C.Stopwatch, { Limit: secs, Time: 0, bRunning: true });
    const edge = gate(C.Expr_EdgeDetectorExec);
    wire(sw, 'Expired', edge, 'Input');
    return edge; // port OnRisingEdge
  };
  const save = (path, description) => {
    w.makePrefab({});
    const bytes = w.toBrz({ bundle: { description } });
    return bytes;
  };
  return { lib, w, C, brdb, WorldReader, gate, wire, print, chip, onLoad, num, int, str, save, ownerIdx };
}

/** brick refs of the main-grid bricks in a written prefab, keyed by "x,y,z" (world position of the brick in the file) */
export function brickRefs(WorldReader, bytes) {
  const r = WorldReader.from(bytes);
  const out = new Map();
  // bricks() walks brickChunkIndex() in order, numBricks per chunk
  const chunks = r.brickChunkIndex(1);
  let ci = 0, left = chunks[0]?.numBricks ?? 0, i = 0;
  for (const b of r.bricks(1)) {
    while (left === 0) { ci++; i = 0; left = chunks[ci].numBricks; }
    const c = chunks[ci].index;
    out.set(b.position.join(','), { GridPersistentIndex: 1, ChunkIndex: { X: c.x, Y: c.y, Z: c.z }, BrickIndexInChunk: i });
    i++; left--;
  }
  return out;
}
