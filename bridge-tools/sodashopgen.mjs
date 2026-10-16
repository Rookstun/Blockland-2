// Makes the soda market stands (soda_<key>.brz, owner 2026-10-14: "a market for
// shops with exotic sodas") from the hand-built bronze sword shop, the way
// gunshopgen.mjs makes the gun stands: the item swapped for the game's one soda
// (Weapon_SodaCan / BP_ItemPickup_Soda), the name and price set, and the can
// recoloured per flavour (colour overrides on the stand and on the item given).
// Flavours live in mapgen/sodas.json (the market layout reads the same file).
// (2026-10-16, owner: "make sodas heal alot more") the item has no heal field; `heal` goes into
// the item's DamageMultiplier, which a heal item is assumed to scale its heal by (check in game).
//
//   node sodashopgen.mjs sodas.json   (reads Saved/Prefabs/shop_bronze.brz)
//
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const src = fs.readFileSync(path.join(PREFABS, 'shop_bronze.brz'));

const TIERS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map(t => ({ ...t, item: 'Weapon_SodaCan', pickup: 'BP_ItemPickup_Soda' }));

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

// can colour slots: 0 body, 1 accent, 2 lid (guesses; the rest left as they were)
const recolor = (list, t) => list.map((c, i) => (i === 0 ? color(t.body) : i === 1 ? color(t.accent) : i === 2 ? color([200, 200, 205]) : c));
function patch(c, t) {
  const d = c.data, p = t.price;
  switch (c.typeName) {
    case 'BrickComponentType_WireGraphPseudo_Var': d.Value = setVariant(d.Value, p); break;
    case 'Component_TextDisplay': d.Text = String(p); break;
    case 'Component_ItemSpawn':
      d.ItemNameOverride = t.name; d.DamageMultiplier = t.heal ?? 1; d.bOverridePickupColors = true; d.PickupMeshColors = recolor(d.PickupMeshColors, t); break;
    case 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv':
      d.ItemNameOverride = t.name; d.DamageMultiplier = t.heal ?? 1; d.bOverrideColors = true; d.MeshColors = recolor(d.MeshColors, t); break;
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
  fs.writeFileSync(path.join(PREFABS, `soda_${t.key}.brz`), out);
  // read it back and confirm the values took
  const check = brs.WorldReader.from(Buffer.from(out));
  for (const f of componentFiles) {
    const got = check.componentChunk(f.grid, f.chunk).components.map(c => J(c.data));
    const want = JSON.parse(expected.get(f.path)).map(d => J(d));
    const bad = got.map((g, i) => (g === want[i] ? null : `#${i}\n  got  ${g.slice(0, 300)}\n  want ${want[i].slice(0, 300)}`)).filter(Boolean);
    if (bad.length) throw new Error(`soda_${t.key}: ${f.path} reads back different:\n${bad.join('\n')}`);
  }
  for (const p of paths) if (!componentFiles.some(f => f.path === p) && p !== gpath && !Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`soda_${t.key}: ${p} changed`);
  const seen = [];
  for (const f of componentFiles)
    for (const c of check.componentChunk(f.grid, f.chunk).components) {
      if (c.typeName === 'BrickComponentType_WireGraphPseudo_Var') seen.push(`price ${c.data.Value.value}`);
      if (c.typeName === 'Component_ItemSpawn') seen.push(`stand "${c.data.ItemNameOverride}" x${c.data.DamageMultiplier}`);
      if (c.typeName === 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') seen.push(`gives "${c.data.ItemNameOverride}" can ${JSON.stringify(c.data.MeshColors[0])}`);
    }
  seen.push('item ' + check.globalData().ExternalAssetReferences.filter(a => /BRItemBase|BRPickupBase/.test(a.PrimaryAssetType)).map(a => a.PrimaryAssetName).join('/'));
  console.log(`soda_${t.key}.brz ${out.length} bytes: ${seen.join(', ')}`);
}
