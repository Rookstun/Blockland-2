// Probe (2026-10-21, weapon bank): copy an ItemSpawn from a hidden template brick to a display plate, property by
// property (GetComponentProperty -> SetComponentProperty), incl. PickupClass (asset) and PickupMeshColors (array),
// which the wirescript compiler can't carry. Template = Rune Longsword display data, plate = Bronze Dagger. Logs pc|...
// node ea32test/pickupcopy.mjs <abs tools/brs4/dist.mjs> out.brz
import { writeFileSync, readFileSync } from 'node:fs';
import { mk, brickRefs } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const lib = await import(new URL('file:///' + dist.replace(/\\/g, '/')).href);
const spawnOf = id => {
  const r = lib.WorldReader.from(readFileSync(new URL(`../weaponbank/items/bankitem_${id}.brz`, import.meta.url)));
  for (const ci of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') return { data: c.data, ext: r.externalAssets() };
};
const dag = spawnOf(27), rune = spawnOf(46);
const EXT = [dag.ext[dag.data.PickupClass], rune.ext[rune.data.PickupClass], { type: 'BrickComponentTypeBase', name: 'Component_ItemSpawn' }];
const IS = 2, PLATE = [0, 0, 2], TPL = [40, 0, 2];
const PROPS = ['PickupClass', 'ItemNameOverride', 'DamageMultiplier', 'WeaponSpeedMultiplier', 'bOverridePickupColors'];
async function build(refs) {
  const { w, C, gate, wire, print, onLoad, ownerIdx } = await mk(dist, { owner: 'renderman', mainBase: [0, 40], rowStep: 40, baseZ: 2 });
  w.addBrick({ asset: 'B_2x2f_Plate_Center', position: PLATE, color: [96, 109, 112], owner_index: ownerIdx, components: [{ type: 'Component_ItemSpawn', data: { ...dag.data, PickupClass: 0 } }] });
  w.addBrick({ asset: 'B_2x2f_Plate_Center', position: TPL, color: [96, 109, 112], owner_index: ownerIdx, visibility: false, components: [{ type: 'Component_ItemSpawn', data: { ...rune.data, PickupClass: 1, PickupScale: 0 } }] });
  const R = p => refs?.get(p.join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 };
  const r0 = { GridPersistentIndex: 0, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 4294967295 };
  const start = onLoad(3);
  const gp = gate(C.Exec_GetComponent, { Brick: R(PLATE), ComponentType: IS });
  const gt = gate(C.Exec_GetComponent, { Brick: R(TPL), ComponentType: IS });
  const q0 = print('pc|start'); wire(start, 'OnRisingEdge', q0.p, 'Exec');
  wire(q0.p, 'ExecOut', gp, 'Exec');
  const q1 = print('pc|gotplate|{A}'); wire(gp, 'Component', q1.f, 'InputA'); wire(gp, 'ExecOut', q1.p, 'Exec');
  wire(q1.p, 'ExecOut', gt, 'Exec');
  const q2 = print('pc|gottpl|{A}'); wire(gt, 'Component', q2.f, 'InputA'); wire(gt, 'ExecOut', q2.p, 'Exec');
  let ex = [q2.p, 'ExecOut'];
  for (const prop of PROPS) {
    const g = gate(C.Exec_GetComponentProperty, { Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: prop, ComponentType: IS });
    wire(gt, 'Component', g, 'Component'); wire(ex[0], ex[1], g, 'Exec');
    const pg = print(`pc|got ${prop}`); wire(g, 'ExecOut', pg.p, 'Exec');
    const s = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'f64', value: 0 }, Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: prop, ComponentType: IS });
    wire(gp, 'Component', s, 'Component'); wire(g, 'Value', s, 'Value'); wire(pg.p, 'ExecOut', s, 'Exec');
    const p = print(`pc|set ${prop}`); wire(s, 'ExecOut', p.p, 'Exec');
    ex = [p.p, 'ExecOut'];
  }
  // colours: Set PickupMeshColors <- an ArrayVar of LinearColor (magenta x8)
  const cols = gate(C.ArrayVar, { Value: { $elementType: 'LinearColor', $array: Array.from({ length: 8 }, () => ({ R: 1, G: 0, B: 1, A: 1 })) } });
  const sc = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'f64', value: 0 }, Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: 'PickupMeshColors', ComponentType: IS });
  wire(gp, 'Component', sc, 'Component'); wire(cols, 'ArrayVarRef', sc, 'Value'); wire(ex[0], ex[1], sc, 'Exec');
  const pc = print('pc|set colours'); wire(sc, 'ExecOut', pc.p, 'Exec');
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'pickup copy probe' }, externalAssets: EXT });
}
const first = await build(null);
const refs = brickRefs((await mk(dist)).WorldReader, first);
writeFileSync(out, await build(refs));
console.log(out, 'ok');
