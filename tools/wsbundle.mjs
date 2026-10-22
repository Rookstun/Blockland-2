// wsbundle.mjs: re-emit a compiled Wirescript chip (tools/wspkg output, Latest format) through the brs-js 4
// World writer so more bricks can be added around and INSIDE it (speakers on the chip's own plane, screens,
// seats, clocks wired to its pins), then written as one prefab.
//   const b = await bundle(compiledBytes, { owner })
//   b.pin('frame')            -> handle of the outer rerouter pin of an @left/@right port (wire from/into RER_Output/RER_Input)
//   b.outSource('P0')         -> { brick, component_type, port } that feeds the out port inside the chip
//   b.addInside(brick)        -> add a brick on the chip's top plane (grid of the root microchip)
//   b.gates                   -> [{ grid, asset, comps: [{ type, data }] }] of the compiled chip (data is live: edit before finish)
//   b.w (World), b.C (COMPONENTS), b.finish({ extraAssets, description }) -> brz bytes
import fs from 'node:fs';

const DIST = new URL('./brs4/dist.mjs', import.meta.url);
const GRID_OFFSET = 1024; // the writer subtracts 1024 from inner-grid positions

export async function bundle(bytes, { owner, offset = [0, 0, 0], hide = false, bare = false } = {}) {
  // offset moves the chip (world-grid bricks + chip plane entities); hide = world-grid bricks of the chip invisible, no collision
  // bare = drop the outer rerouter pins: wire straight to/from the port gates (portGate(label).RER_Input / RER_Output)
  const lib = await import(DIST.href);
  const { World, WorldReader, brdb } = lib;
  const C = brdb.COMPONENTS;
  const r = WorldReader.from(bytes);
  // component types newer than brs4's schema: take them from the compiled file (tools/patch_brs4.mjs)
  const db = globalThis.__brs4_componentDb;
  if (!db) throw new Error('run node tools/patch_brs4.mjs first');
  (globalThis.__brs4_extraSchemas ??= []).push(r.schema(r.path('Bricks/ComponentsShared.schema')));
  const assets = r.brickAssets(), mats = r.materials();
  const ext = r.externalAssets() ?? [];
  const w = new World();
  const O = w.addOwner(owner ?? { id: '00000000-0000-0000-0000-00000000c0de', name: 'chip', display_name: 'chip' });

  // grids: 1 = world grid, others are entities (persistentIndex = grid id)
  const ents = new Map([...r.entities()].map(e => [e.persistentIndex, e]));
  const gridHandle = new Map([[1, { grid: 0 }]]);
  for (const g of r.gridIds()) {
    if (g === 1) continue;
    const e = ents.get(g);
    if (!e) throw new Error(`grid ${g} has no entity`);
    gridHandle.set(g, w.addBrickGrid({ type: e.typeName, location: { X: e.location.X + offset[0], Y: e.location.Y + offset[1], Z: e.location.Z + offset[2] }, rotation: e.rotation, frozen: e.frozen, sleeping: e.sleeping,
      owner_index: O, colors: Object.values(e.colors ?? {}), data: e.data }));
  }
  // bricks, keyed by (grid, chunk, index in chunk)
  const key = (g, c) => `${g}|${c.x},${c.y},${c.z}`;
  const handles = new Map(), all = [];
  for (const g of r.gridIds()) {
    const chunks = r.brickChunkIndex(g);
    const comps = new Map(), links = new Map();
    for (const ch of chunks) {
      const cc = r.componentChunk(g, ch.index);
      for (const c of cc.components) {
        const k = `${key(g, ch.index)}#${c.brickIndex}`;
        (comps.get(k) ?? comps.set(k, []).get(k)).push({ type: c.typeName, data: c.data });
        if (!db.has(c.typeName)) db.set(c.typeName, c.structName ?? 'None');
      }
      cc.soa.MicrochipBrickIndices.forEach((bi, j) => links.set(`${key(g, ch.index)}#${bi}`, cc.soa.MicrochipBrickGridReferences[j]));
    }
    let ci = 0, left = chunks[0]?.numBricks ?? 0, i = 0, list = [];
    if (chunks.length) handles.set(key(g, chunks[0].index), list);
    for (const b of r.bricks(g)) {
      while (left === 0) { ci++; i = 0; left = chunks[ci].numBricks; list = []; handles.set(key(g, chunks[ci].index), list); }
      const k = `${key(g, chunks[ci].index)}#${i}`;
      if (bare && g === 1 && (comps.get(k) ?? []).some(c => c.type === 'Component_Internal_Rerouter')) { list.push(null); i++; left--; continue; }
      const pos = g === 1 ? b.position.map((v, k) => v + offset[k]) : b.position.map(v => v + GRID_OFFSET);
      const h = w.addBrick({ asset: assets[b.asset_name_index], size: b.size, position: pos, direction: b.direction, rotation: b.rotation,
        collision: g === 1 && hide ? false : b.collision, visibility: g === 1 && hide ? false : b.visibility, material: mats[b.material_index], material_intensity: b.material_intensity,
        color: b.color, owner_index: O, components: comps.get(k) ?? [] }, gridHandle.get(g));
      list.push(h); all.push({ g, h, asset: assets[b.asset_name_index], comps: comps.get(k) ?? [], link: links.get(k) });
      i++; left--;
    }
  }
  for (const b of all) if (b.link !== undefined) w.registerMicrochipLink(b.h, gridHandle.get(b.link));
  // wires
  const wires = [];
  for (const g of r.gridIds()) for (const ch of r.brickChunkIndex(g)) {
    let wc; try { wc = r.wireChunk(g, ch.index); } catch { continue; }
    const here = handles.get(key(g, ch.index));
    for (const x of wc.local) wires.push([{ brick: here[x.source.brickIndex], component_type: x.source.componentType, port: x.source.port },
      { brick: here[x.target.brickIndex], component_type: x.target.componentType, port: x.target.port }]);
    for (const x of wc.remote) {
      const src = handles.get(key(x.source.gridId, x.source.chunk));
      wires.push([{ brick: src[x.source.brickIndex], component_type: x.source.componentType, port: x.source.port },
        { brick: here[x.target.brickIndex], component_type: x.target.componentType, port: x.target.port }]);
    }
  }
  if (bare) for (let i = wires.length - 1; i >= 0; i--) if (!wires[i][0].brick || !wires[i][1].brick) wires.splice(i, 1);
  for (const [a, b] of wires) w.addWire(a, b);

  // ports: MicrochipInput/Output gates on the root chip's plane, by PortLabel
  const root = all.find(b => b.g === 1 && b.asset === 'B_1x1_Microchip');
  const rootGrid = gridHandle.get(root.link);
  const same = (a, b) => a.grid === b.grid && a.index === b.index;
  const portGate = (label, kind) => {
    const b = all.find(x => same({ grid: x.h.grid }, rootGrid) && x.comps.some(c => c.type === kind && c.data?.PortLabel === label));
    if (!b) throw new Error(`no ${kind} port "${label}" (have ${all.filter(x => same({ grid: x.h.grid }, rootGrid)).flatMap(x => x.comps.filter(c => c.type === kind).map(c => c.data?.PortLabel)).join(', ')})`);
    return b.h;
  };
  const OUT = 'BrickComponentType_Internal_MicrochipOutput', IN = 'BrickComponentType_Internal_MicrochipInput';
  // the outer rerouter pin wired to/from a port gate
  const pin = label => {
    let g, outSide;
    try { g = portGate(label, OUT); outSide = true; } catch { g = portGate(label, IN); outSide = false; }
    const wr = wires.find(([a, b]) => outSide ? (same(a.brick, g) && b.component_type === 'Component_Internal_Rerouter') : (same(b.brick, g) && a.component_type === 'Component_Internal_Rerouter'));
    if (!wr) throw new Error(`port "${label}" has no outer pin (declare it @left/@right)`);
    return outSide ? wr[1].brick : wr[0].brick;
  };
  const outSource = label => {
    const g = portGate(label, OUT);
    const wr = wires.find(([, b]) => same(b.brick, g) && b.port === 'RER_Input');
    if (!wr) throw new Error(`out "${label}" is not fed`);
    return wr[0];
  };
  const rootPlane = ents.get(root.link).data;
  // inner-plane positions (writer frame) of the root plane's bricks: free spots for added bricks go past their max x
  const rootPos = [...r.bricks(root.link)].map(b => b.position.map(v => v + GRID_OFFSET));
  const addInside = brick => w.addBrick({ owner_index: O, ...brick }, rootGrid);
  const insideZ = all.find(x => same({ grid: x.h.grid }, rootGrid)) && [...r.bricks(root.link)][0].position[2] + GRID_OFFSET;
  // component refs baked into gate data ({Brick, ComponentTypeIndex}, e.g. a Var holding another Var's ref) index the
  // file's GLOBAL component type table, which the writer rebuilds: write once, then remap them to its table and write again.
  const srcTypes = r.globalData().ComponentTypeNames;
  const refs = [];
  const walk = o => { if (!o || typeof o !== 'object') return; if ('ComponentTypeIndex' in o && o.Brick && o.Brick.BrickIndexInChunk !== 4294967295) refs.push([o, srcTypes[o.ComponentTypeIndex]]); for (const v of Object.values(o)) walk(v); };
  for (const b of all) for (const c of b.comps) walk(c.data);
  const finish = ({ extraAssets = [], description = 'wsbundle' } = {}) => {
    w.makePrefab({});
    const opts = { bundle: { description }, externalAssets: [...ext, ...extraAssets] };
    let out = w.toBrz(opts);
    if (refs.length) {
      const names = WorldReader.from(out).globalData().ComponentTypeNames;
      for (const [o, name] of refs) { const i = names.indexOf(name); if (i < 0) throw new Error(`ref type ${name} not in the written table`); o.ComponentTypeIndex = i; }
      out = w.toBrz(opts);
      const again = WorldReader.from(out).globalData().ComponentTypeNames;
      if (refs.some(([o, name]) => again[o.ComponentTypeIndex] !== name)) throw new Error('component type table moved between writes');
    }
    return out;
  };
  // the chip's own gates (compiled components), e.g. to fill a brick[] var's ArrayVar with refs before finish()
  const gates = all.map(b => ({ grid: b.g, asset: b.asset, comps: b.comps }));
  const portIn = label => portGate(label, IN), portOut = label => portGate(label, OUT);
  return { lib, w, C, O, ext, pin, outSource, portIn, portOut, rootGrid, addInside, insideZ, rootPlane, rootPos, gates, finish };
}
