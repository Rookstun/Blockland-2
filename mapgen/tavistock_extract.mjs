// Pull the owner's own work out of the live Tavistock house (2026-10-26, owner: "save my garage and lights from
// the world and put them into tavistock.mjs so a rebuild keeps them"). Input: a SaveRegion prefab of the house
// (br.Prefab.SaveRegion "tavistock_live" 1285 405 150 320 440 170 0). Every brick NOT owned by the generator's
// owner (Tavistock) is kept with its components and wires and written to mapgen/tavistock_owner.brz, positions
// relative to the house origin (deploy: br.Prefab.Load "tavistock_owner" <origin> 0 16). Also prints the
// generator bricks missing from the world (the owner removed them) as keys for tavistock.mjs REMOVED.
//   node mapgen/tavistock_extract.mjs live.brz [originX originY originZ]
import fs from 'fs';
const lib = await import(new URL('../tools/brs4/dist.mjs', import.meta.url).href);
const { World, WorldReader } = lib;

const [src, ox = 1000, oy = 0, oz = 0] = process.argv.slice(2);
const O = [+ox, +oy, +oz];
const r = WorldReader.from(fs.readFileSync(src));
const g = r.globalData();
const names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
const mats = g.MaterialAssetNames;
const owners = r.owners();
const gen = owners.UserNames.indexOf('Tavistock');
const chunks = r.brickChunkIndex(1);
if (chunks.length !== 1) throw Error(`expected one brick chunk, got ${chunks.length}`); // shortcut: one 0_0_0 chunk; per-chunk brick indices otherwise
const all = [...r.bricks(1)];
const comps = r.componentChunk(1, chunks[0].index).components;
const wires = r.wireChunk(1, chunks[0].index);
if (wires.remote.length) throw Error('remote wires not handled');

const w = new World();
const ownerIdx = new Map();
const keep = all.map((b, i) => [b, i]).filter(([b]) => b.owner_index !== gen);
const handle = new Map();
for (const [b, i] of keep) {
  if (!ownerIdx.has(b.owner_index)) {
    const id = owners.UserIds[b.owner_index];
    const hex = [id.A, id.B, id.C, id.D].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
    ownerIdx.set(b.owner_index, w.addOwner({ id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, name: owners.UserNames[b.owner_index], display_name: owners.DisplayNames[b.owner_index] }));
  }
  const c = comps.filter(x => x.brickIndex === i).map(x => ({ type: x.typeName, ...(x.data ? { data: x.data } : {}) }));
  handle.set(i, w.addBrick({
    asset: names[b.asset_name_index], size: b.size, position: b.position.map((v, k) => v - O[k]), direction: b.direction, rotation: b.rotation,
    color: b.color, material: mats[b.material_index], material_intensity: b.material_intensity, visibility: b.visibility, collision: b.collision,
    owner_index: ownerIdx.get(b.owner_index), ...(c.length ? { components: c } : {}),
  }));
}
let nw = 0;
for (const { source, target } of wires.local) {
  const a = handle.get(source.brickIndex), t = handle.get(target.brickIndex);
  if (!a || !t) { if (a || t) throw Error('wire between the owner\'s work and a generated brick'); continue; }
  w.addWire({ brick: a, component_type: source.componentType, port: source.port }, { brick: t, component_type: target.componentType, port: target.port });
  nw++;
}
const out = new URL('./tavistock_owner.brz', import.meta.url);
// brs-js 4's component schema is older than the game's: drop the fields it doesn't know (runtime state such as
// ChangeDetectorExec.InputLast) until it writes
const datas = w.gridBrickInputs.flat().flatMap(b => b.components ?? []).map(c => c.data).filter(Boolean);
let bytes;
for (let tries = 0; !bytes; tries++) {
  try { bytes = w.toBrz({ bundle: { description: 'Tavistock: the owner\'s own work (garage, lights)' }, externalAssets: r.externalAssets() }); } catch (e) { // sounds index this table
    const m = /has no field '(\w+)'/.exec(e.message);
    if (!m || tries > 50) throw e;
    console.error('dropping unknown field', m[1]);
    for (const d of datas) delete d[m[1]];
  }
}
fs.writeFileSync(out, bytes);
console.error(`kept ${keep.length} bricks, ${comps.filter(x => handle.has(x.brickIndex)).length} components, ${nw} wires -> ${out.pathname}`);

// generator bricks the owner removed (asset|position relative to the origin|size)
const tav = JSON.parse(fs.readFileSync(process.env.GEN ?? 'tav.json'));
const live = new Set(all.filter(b => b.owner_index === gen).map(b => `${names[b.asset_name_index]}|${b.position.map((v, k) => v - O[k]).join(',')}|${b.size.join(',')}`));
const removed = tav.map(b => `${b.asset}|${b.position.join(',')}|${(b.size ?? []).join(',')}`).filter(k => !live.has(k));
console.log(JSON.stringify(removed));
