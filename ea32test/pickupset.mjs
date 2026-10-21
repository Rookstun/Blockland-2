// Probe (2026-10-21, weapon bank: "the pedestals need the item component on them"): can wires change an
// ItemSpawn's PickupClass? One display plate (Bronze-dagger-like ItemSpawn) + gates: 3 s after load
// GetComponent(plate, ItemSpawn) -> SetComponentProperty PickupClass = PickupReference(BP_ItemPickup_Longsword),
// then ItemNameOverride = "probe name", then PickupScale = 2. Logs ps|step.
// node ea32test/pickupset.mjs <abs tools/brs4/dist.mjs> out.brz
import { writeFileSync, readFileSync } from 'node:fs';
import { mk, brickRefs } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const EXT = [{ type: 'BRPickupBase', name: 'BP_ItemPickup_Knife' }, { type: 'BrickComponentTypeBase', name: 'Component_ItemSpawn' }, { type: 'BRPickupBase', name: 'BP_ItemPickup_Longsword' }];
const IS = 1, PLATE = [0, 0, 2];
async function build(refs) {
  const { w, C, gate, wire, print, onLoad, ownerIdx } = await mk(dist, { owner: 'renderman', mainBase: [0, 40], rowStep: 40, baseZ: 2 });
  // the bronze dagger display's ItemSpawn (weaponbank/items: its ext[0] = its BRPickupBase, same index here)
  const lib = await import(new URL('file:///' + dist.replace(/\\/g, '/')).href);
  const ir = lib.WorldReader.from(readFileSync(new URL('../weaponbank/items/bankitem_27.brz', import.meta.url)));
  let data; for (const ci of ir.brickChunkIndex(1)) for (const c of ir.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') data = c.data;
  if (ir.externalAssets()[data.PickupClass]?.name !== 'BP_ItemPickup_Knife') throw Error('unexpected pickup ' + JSON.stringify(ir.externalAssets()));
  data.bRenderTranslucentWhenDisabled = false; data.bPickupEnabled = false;
  w.addBrick({ asset: 'B_2x2f_Plate_Center', position: PLATE, color: [96, 109, 112], owner_index: ownerIdx, components: [{ type: 'Component_ItemSpawn', data }] });
  const ref = refs?.get(PLATE.join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 };
  const start = onLoad(3);
  const getc = gate(C.Exec_GetComponent, { Brick: ref, ComponentType: IS });
  wire(start, 'OnRisingEdge', getc, 'Exec');
  const r0 = { GridPersistentIndex: 0, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 4294967295 };
  const pick = gate(C.PickupReference, { Asset: 2 });
  const set1 = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'f64', value: 0 }, Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: 'PickupClass', ComponentType: IS });
  wire(getc, 'Component', set1, 'Component'); wire(pick, 'Value', set1, 'Value'); wire(getc, 'ExecOut', set1, 'Exec');
  const set2 = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'Str', value: 'probe name' }, Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: 'ItemNameOverride', ComponentType: IS });
  wire(getc, 'Component', set2, 'Component'); wire(set1, 'ExecOut', set2, 'Exec');
  const set3 = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'f64', value: 2 }, Component: { Brick: r0, ComponentTypeIndex: 0 }, PropertyName: 'PickupScale', ComponentType: IS });
  wire(getc, 'Component', set3, 'Component'); wire(set2, 'ExecOut', set3, 'Exec');
  const p = print('ps|done|{A}'); wire(getc, 'Component', p.f, 'InputA'); wire(set3, 'ExecOut', p.p, 'Exec');
  const p0 = print('ps|start'); wire(start, 'OnRisingEdge', p0.p, 'Exec');
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'pickup set probe' }, externalAssets: EXT });
}
const first = await build(null);
const refs = brickRefs((await mk(dist)).WorldReader, first);
if (!refs.get(PLATE.join(','))) throw Error('no plate ref');
writeFileSync(out, await build(refs));
console.log(out, 'ok');
