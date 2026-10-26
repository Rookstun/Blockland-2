// Pull the owner's own work out of the live Tavistock house (2026-10-26, owner: "save my garage and lights from
// the world and put them into tavistock.mjs so a rebuild keeps them"). Input: a SaveRegion prefab of the house
// (br.Prefab.SaveRegion "tavistock_live" 1285 405 150 320 440 170 1: the last 1 takes moving grids too). Every
// brick and moving grid NOT owned by the generator's owner (Tavistock) is kept with its components, joints and
// wires and written to mapgen/tavistock_owner.brz, positions relative to the house origin (deploy:
// br.Prefab.Load "tavistock_owner" <origin> 0 16). Also prints the generator bricks missing from the world (the
// owner removed them).
//   node mapgen/tavistock_extract.mjs live.brz [originX originY originZ]
import fs from 'fs';
const lib = await import(new URL('../tools/brs4/dist.mjs', import.meta.url).href); // patched: tools/patch_brs4.mjs
const { World, WorldReader } = lib;

const [src, ox = 1000, oy = 0, oz = 0] = process.argv.slice(2);
const O = [+ox, +oy, +oz];
const r = WorldReader.from(fs.readFileSync(src));
const g = r.globalData();
const names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
const mats = g.MaterialAssetNames;
const owners = r.owners();
const gen = owners.UserNames.indexOf('Tavistock');
// shortcut: every grid is one chunk (the house fits the main grid's 0_0_0, a door its own); per-chunk indices otherwise
const chunk = gid => {
  const c = r.brickChunkIndex(gid);
  if (c.length !== 1) throw Error(`grid ${gid}: ${c.length} chunks`);
  return c[0].index;
};
const compsOf = gid => { try { return r.componentChunk(gid, chunk(gid)); } catch { return { components: [], soa: null }; } };

const w = new World();
const ownerIdx = new Map();
const ownerOf = i => {
  if (!ownerIdx.has(i)) {
    const id = owners.UserIds[i];
    const hex = [id.A, id.B, id.C, id.D].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
    ownerIdx.set(i, w.addOwner({ id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, name: owners.UserNames[i], display_name: owners.DisplayNames[i] }));
  }
  return ownerIdx.get(i);
};
const handle = new Map(); // `${gid}:${index}` -> handle
const copy = (gid, b, i, pos, gh, owner) => {
  const c = compsOf(gid).components.filter(x => x.brickIndex === i).map(x => ({ type: x.typeName, ...(x.data ? { data: x.data } : {}) }));
  handle.set(`${gid}:${i}`, w.addBrick({
    asset: names[b.asset_name_index], size: b.size, position: pos, direction: b.direction, rotation: b.rotation,
    color: b.color, material: mats[b.material_index], material_intensity: b.material_intensity, visibility: b.visibility, collision: b.collision,
    owner_index: owner, ...(c.length ? { components: c } : {}),
  }, gh));
};

chunk(1);
const all = [...r.bricks(1)];
let nb = 0;
all.forEach((b, i) => { if (b.owner_index !== gen) { copy(1, b, i, b.position.map((v, k) => v - O[k]), undefined, ownerOf(b.owner_index)); nb++; } });

// moving grids (doors on servos): the entity as saved (location is in prefab space: world = location -
// addedGlobalGridOffset), bricks in the grid's own frame
const off = r.prefabJson()?.addedGlobalGridOffset ?? { x: 0, y: 0, z: 0 };
const ents = r.entityChunkIndex().chunks.flatMap(c => r.entityChunk(c.index));
const gridH = new Map();
for (const gid of r.gridIds().filter(x => x !== 1)) {
  const e = ents.find(x => x.persistentIndex === gid);
  if (!e) throw Error(`grid ${gid} has no entity`);
  if (e.ownerIndex === gen) continue;
  const gh = w.addBrickGrid({
    type: e.typeName, owner_index: ownerOf(e.ownerIndex), rotation: e.rotation, frozen: e.frozen, sleeping: e.sleeping, data: e.data,
    location: { X: e.location.X - off.x - O[0], Y: e.location.Y - off.y - O[1], Z: e.location.Z - off.z - O[2] },
    colors: Object.values(e.colors),
  });
  gridH.set(gid, gh);
  // brs-js 4 reads a moving grid's bricks 1024 off on every axis (its chunk offset) but writes them as given;
  // uncorrected, a test copy's door landed ~1.7k away from its servo
  [...r.bricks(gid)].forEach((b, i) => copy(gid, b, i, b.position.map(v => v + 1024), gh, ownerOf(b.owner_index)));
  nb += [...r.bricks(gid)].length;
}

// joints: a servo holding a door grid (needs tools/patch_brs4_joints.mjs; brs-js 4 alone writes none and the
// door loads loose and falls)
let nj = 0;
const cs = compsOf(1).soa;
cs?.JointBrickIndices.forEach((bi, k) => {
  const bh = handle.get(`1:${bi}`), gh = gridH.get(cs.JointEntityReferences[k]);
  if (!bh || !gh) { if (bh || gh) throw Error('joint between the owner work and a generated brick'); return; }
  w.registerJoint(bh, gh, cs.JointInitialRelativeOffsets[k], cs.JointInitialRelativeRotations[k]);
  nj++;
});

// wires live in the target's chunk: local = the source on the same grid, remote = the source on another grid (a
// door's Select on its grid driving its servo on the main grid)
let nw = 0;
for (const gid of r.gridIds()) {
  let wc;
  try { wc = r.wireChunk(gid, chunk(gid)); } catch { continue; }
  for (const { source, target, sg } of [...wc.local.map(x => ({ ...x, sg: gid })), ...wc.remote.map(x => ({ ...x, sg: x.source.gridId }))]) {
    const a = handle.get(`${sg}:${source.brickIndex}`), t = handle.get(`${gid}:${target.brickIndex}`);
    if (!a || !t) { if (a || t) throw Error('wire between the owner work and a generated brick'); continue; }
    w.addWire({ brick: a, component_type: source.componentType, port: source.port }, { brick: t, component_type: target.componentType, port: target.port });
    nw++;
  }
}

const out = new URL('./tavistock_owner.brz', import.meta.url);
// brs-js 4's component schema is older than the game's: drop the fields it doesn't know (runtime state such as
// ChangeDetectorExec.InputLast) until it writes
const datas = w.gridBrickInputs.flat().flatMap(b => b.components ?? []).map(c => c.data).filter(Boolean);
let bytes;
for (let tries = 0; !bytes; tries++) {
  try { bytes = w.toBrz({ bundle: { description: 'Tavistock: the owner\'s own work' }, externalAssets: r.externalAssets() }); } catch (e) { // sounds index this table
    const m = /has no field '(\w+)'/.exec(e.message);
    if (!m || tries > 50) throw e;
    console.error('dropping unknown field', m[1]);
    for (const d of datas) delete d[m[1]];
  }
}
fs.writeFileSync(out, bytes);
console.error(`kept ${gridH.size} moving grids, ${nj} joints, ${nb} bricks, ${datas.length} components with data, ${nw} wires -> ${out.pathname}`);

// generator bricks the owner removed (asset|position relative to the origin|size)
const tav = JSON.parse(fs.readFileSync(process.env.GEN ?? 'tav.json'));
const live = new Set(all.filter(b => b.owner_index === gen).map(b => `${names[b.asset_name_index]}|${b.position.map((v, k) => v - O[k]).join(',')}|${b.size.join(',')}`));
console.log(JSON.stringify(tav.map(b => `${b.asset}|${b.position.join(',')}|${(b.size ?? []).join(',')}`).filter(k => !live.has(k))));
