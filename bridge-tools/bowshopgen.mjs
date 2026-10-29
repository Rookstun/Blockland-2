// Makes the bow stands (bow_<key>.brz, 2026-10-06) from the owner's six hand-placed
// bow item spawns (live ~(-5..95, -355, 582): names, damage, speed and colours
// copied exactly), on the hand-built bronze sword stand. Priced on the sword
// ladder (bronze 50, iron 400, steel 1000, mithril 4000, adamant 8000, rune 20000).
// From gunshopgen.mjs, which makes the desert gun-store stands from the hand-built bronze
// sword shop: same button + chip + price Variable + item stand, with the item
// swapped for a gun (GlobalData's BRItemBase / BRPickupBase references, the
// way zombie-prefabs.mjs swaps a bot's weapon), the name, and the price.
// Damage stays x1 and the gun keeps its own colours (colour overrides cleared).
//
//   node gunshopgen.mjs        (reads Saved/Prefabs/shop_bronze.brz)

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const src = fs.readFileSync(path.join(PREFABS, 'shop_bronze.brz'));

// western guns, priced in "coins" against the sword ladder (bronze 150 .. rune 20000)
// colour slots 2-8 as on the owner's bows (string, arrow fletching, tip, ...)
const REST = [{ B: 255, G: 255, R: 255, A: 255 }, { B: 0, G: 0, R: 207, A: 255 }, { B: 170, G: 170, R: 170, A: 255 }, { B: 255, G: 255, R: 255, A: 255 }, { B: 255, G: 255, R: 255, A: 255 }, { B: 255, G: 255, R: 255, A: 255 }, { B: 255, G: 255, R: 255, A: 255 }];
const TIERS = [
  { key: 'bow', name: 'Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 50, damage: 0.5, speed: 1, colors: [{ B: 0, G: 31, R: 75, A: 255 }, ...REST] },
  { key: 'oak', name: 'Oak Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 400, damage: 0.8, speed: 1.15, colors: [{ B: 0, G: 137, R: 186, A: 255 }, ...REST] },
  { key: 'willow', name: 'Willow Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 1000, damage: 1, speed: 1.3, colors: [{ B: 130, G: 186, R: 183, A: 255 }, ...REST] },
  { key: 'maple', name: 'Maple Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 4000, damage: 1.1, speed: 1.45, colors: [{ B: 157, G: 140, R: 186, A: 255 }, ...REST] },
  { key: 'yew', name: 'Yew Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 8000, damage: 1.3, speed: 1.6, colors: [{ B: 0, G: 157, R: 185, A: 255 }, ...REST] },
  { key: 'magic', name: 'Magic Bow', item: 'Weapon_Bow', pickup: 'BP_ItemPickup_Bow', price: 20000, damage: 1.5, speed: 1.75, colors: [{ B: 255, G: 210, R: 4, A: 255 }, ...REST] },
];

const reader = brs.WorldReader.from(src);
const paths = reader.fs.listPaths();
const schema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
const componentFiles = paths
  .map(p => p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/))
  .filter(Boolean)
  .map(m => ({ path: m[0], grid: Number(m[1]), chunk: { x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) } }));

const encodeChunk = ({ soa, components }) => {
  const parts = [schema.encode('BRSavedComponentChunkSoA', soa)];
  for (const c of components) if (c.structName) parts.push(schema.encode(c.structName, c.data));
  return Buffer.concat(parts.map(p => Buffer.from(p)));
};

// The game writes some f64 fields compactly as f32, so re-encoded bytes can
// differ; each output is instead read back and compared value by value.
// (bigints as text; floats to 6 digits, since f32 fields read back as e.g. 0.6499999761)
const J = v => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : typeof x === 'number' && !Number.isInteger(x) ? Number(x.toPrecision(6)) : x));

const sameType = (old, v) => (typeof old === 'bigint' ? BigInt(v) : v);
const setVariant = (variant, v) => ({ ...variant, value: sameType(variant.value, v) });
const color = ([R, G, B]) => ({ B, G, R, A: 255 }); // same key order the game stores

function patch(c, t) {
  const d = c.data, p = t.price;
  switch (c.typeName) {
    case 'BrickComponentType_WireGraphPseudo_Var': d.Value = setVariant(d.Value, p); break;
    case 'Component_TextDisplay': d.Text = String(p); d.Material = typeof d.Material === 'bigint' ? 2n : 2; break; // Plastic (owner: graffiti text doesn't work)
    case 'Component_ItemSpawn':
      d.ItemNameOverride = t.name; d.DamageMultiplier = t.damage; d.WeaponSpeedMultiplier = t.speed; d.bOverridePickupColors = true; d.PickupMeshColors = structuredClone(t.colors); break;
    case 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv':
      d.ItemNameOverride = t.name; d.DamageMultiplier = t.damage; d.WeaponSpeedMultiplier = t.speed; d.bOverrideColors = true; d.MeshColors = structuredClone(t.colors); break;
    // cached values inside the chip, so a fresh copy reads right before its first press
    case 'BrickComponentType_WireGraph_Exec_Gamemode_IncrementLeaderboardValue': d.Value = sameType(d.Value, -p); break;
    case 'BrickComponentType_WireGraph_Expr_MathSubtract': d.InputA = setVariant(d.InputA, p); break;
    case 'BrickComponentType_WireGraph_Expr_MathNegate': d.Input = setVariant(d.Input, p); break;
    case 'BrickComponentType_WireGraph_Expr_CompareGreaterOrEqual': d.InputB = setVariant(d.InputB, p); break;
    case 'BrickComponentType_WireGraph_Expr_String_Concatenate':
      for (const k of ['InputA', 'InputB']) d[k] = d[k].replace(/\b50\b/, String(p)); break;
    case 'BrickComponentType_WireGraph_Exec_PlayerState_ShowStatusMessage': d.Message = d.Message.replace(/\b50\b/, String(p)); break;
  }
}

// rebuild the folder tree for the bundle writer
function bundle(files) {
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
  const toNodes = m => [...m].map(([name, v]) => [name, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}

for (const t of TIERS) {
  const files = new Map(paths.map(p => [p, reader.fs.readFile(p)]));
  const expected = new Map();
  for (const f of componentFiles) {
    const chunk = reader.componentChunk(f.grid, f.chunk);
    const copy = { soa: chunk.soa, components: chunk.components.map(c => ({ ...c, data: c.data && structuredClone(c.data) })) };
    for (const c of copy.components) if (c.data) patch(c, t);
    files.set(f.path, new Uint8Array(encodeChunk(copy)));
    expected.set(f.path, J(copy.components.map(c => c.data)));
  }
  const g = structuredClone(reader.globalData());
  for (const a of g.ExternalAssetReferences) {
    if (a.PrimaryAssetType === 'BRItemBase') a.PrimaryAssetName = t.item;
    if (a.PrimaryAssetType === 'BRPickupBase') a.PrimaryAssetName = t.pickup;
  }
  const gpath = reader.path('GlobalData.mps');
  files.set(gpath, new Uint8Array(reader.schema(reader.path('GlobalData.schema')).encode('BRSavedGlobalDataSoA', g)));
  const out = bundle(files);
  fs.writeFileSync(path.join(PREFABS, `bow_${t.key}.brz`), out);
  // read it back and confirm the values took
  const check = brs.WorldReader.from(Buffer.from(out));
  for (const f of componentFiles) {
    const got = check.componentChunk(f.grid, f.chunk).components.map(c => J(c.data));
    const want = JSON.parse(expected.get(f.path)).map(d => J(d));
    const bad = got.map((g, i) => (g === want[i] ? null : `#${i}\n  got  ${g.slice(0, 300)}\n  want ${want[i].slice(0, 300)}`)).filter(Boolean);
    if (bad.length) throw new Error(`bow_${t.key}: ${f.path} reads back different:\n${bad.join('\n')}`);
  }
  for (const p of paths) if (!componentFiles.some(f => f.path === p) && p !== gpath && !Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`bow_${t.key}: ${p} changed`);
  const seen = [];
  for (const f of componentFiles)
    for (const c of check.componentChunk(f.grid, f.chunk).components) {
      if (c.typeName === 'BrickComponentType_WireGraphPseudo_Var') seen.push(`price ${c.data.Value.value}`);
      if (c.typeName === 'Component_ItemSpawn') seen.push(`stand "${c.data.ItemNameOverride}" x${c.data.DamageMultiplier}`);
      if (c.typeName === 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') seen.push(`gives "${c.data.ItemNameOverride}" blade ${JSON.stringify(c.data.MeshColors[0])}`);
    }
  seen.push('item ' + check.globalData().ExternalAssetReferences.filter(a => /BRItemBase|BRPickupBase/.test(a.PrimaryAssetType)).map(a => a.PrimaryAssetName).join('/'));
  console.log(`bow_${t.key}.brz ${out.length} bytes: ${seen.join(', ')}`);
}
