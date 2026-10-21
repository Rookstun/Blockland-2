// Probe (2026-10-21, owner screenshot: the ItemSpawn has wire ports "Colors 1", "Colors 1.R" ...): which internal port
// name takes a wire into PickupMeshColors? One plate per candidate, a magenta LinearColor Var wired into it, and
// bOverridePickupColors wired true. Read the log ("Failed to connect wire") + colours back with SaveRegion.
//   node ea32test/colorport.mjs <abs tools/brs4/dist.mjs> out.brz
import { writeFileSync, readFileSync } from 'node:fs';
import { mk } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const lib = await import(new URL('file:///' + dist.replace(/\\/g, '/')).href);
const r = lib.WorldReader.from(readFileSync(new URL('../weaponbank/items/bankitem_27.brz', import.meta.url)));
let data; for (const ci of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') data = c.data;
const CANDS = ['PickupMeshColors.0', 'PickupMeshColors[0]', 'PickupMeshColors_0', 'PickupMeshColors.Colors 1', 'PickupMeshColors'];
const { w, C, gate, ownerIdx } = await mk(dist, { owner: 'renderman', mainBase: [0, 80], rowStep: 40, baseZ: 2 });
const col = gate(C.Var, { Value: { $variant: 'LinearColor', value: { R: 1, G: 0, B: 1, A: 1 } } });
const yes = gate(C.Var, { Value: { $variant: 'bool', value: true } });
CANDS.forEach((name, i) => {
  const h = w.addBrick({ asset: 'B_2x2f_Plate_Center', position: [i * 30, 0, 2], color: [96, 109, 112], owner_index: ownerIdx,
    components: [{ type: 'Component_ItemSpawn', data: { ...data, PickupClass: 0, ItemNameOverride: 'probe ' + i, bOverridePickupColors: false } }] });
  w.addWire({ brick: col.h, component_type: C.Var.NAME, port: 'Value' }, { brick: h, component_type: 'Component_ItemSpawn', port: name });
  w.addWire({ brick: yes.h, component_type: C.Var.NAME, port: 'Value' }, { brick: h, component_type: 'Component_ItemSpawn', port: 'bOverridePickupColors' });
});
w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'colour port probe' }, externalAssets: [{ type: 'BRPickupBase', name: 'BP_ItemPickup_Knife' }] }));
console.log(out, 'ok');
