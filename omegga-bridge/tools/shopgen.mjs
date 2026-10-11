// Makes the Bronze -> Rune item shops from the hand-built Bronze one.
//
//   node shopgen.mjs        (reads Saved/Prefabs/shop_bronze.brz, writes shop_<tier>.brz)
//
// The shop is a button + microchip + Variable gate (the price) + item stand.
// Per tier we patch component data in place: the price variable and the
// cached copies of it in the chip, the item name, blade colour and damage on
// both the stand and the chip's AddInventoryItemAdv. Every other file in the
// bundle is copied through untouched.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const src = fs.readFileSync(path.join(PREFABS, 'shop_bronze.brz'));

// RuneScape metal tiers: blade colour (item, then the stand's slightly
// brighter display copy), price (grindy: Rune is ~200 top-tier kills at ~100 coins), damage.
// Bronze's own price lives in the hand-built shop; shop_bronze_copy is unpatched.
const TIERS = [
  { key: 'bronze', name: 'Bronze', blade: [123, 72, 0], stand: [144, 98, 0], price: 150, damage: 0.5 },
  { key: 'iron', name: 'Iron', blade: [88, 86, 84], stand: [112, 110, 108], price: 400, damage: 0.65 },
  { key: 'steel', name: 'Steel', blade: [160, 160, 166], stand: [186, 186, 192], price: 1000, damage: 0.8 },
  { key: 'black', name: 'Black', blade: [26, 26, 28], stand: [40, 40, 44], price: 2000, damage: 1.0 },
  { key: 'mithril', name: 'Mithril', blade: [58, 58, 128], stand: [76, 76, 156], price: 4000, damage: 1.2 },
  { key: 'adamant', name: 'Adamant', blade: [42, 96, 56], stand: [58, 120, 72], price: 8000, damage: 1.5 },
  { key: 'rune', name: 'Rune', blade: [38, 150, 178], stand: [56, 176, 204], price: 20000, damage: 2.0 },
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
    case 'Component_TextDisplay': d.Text = String(p); break;
    case 'Component_ItemSpawn':
      d.ItemNameOverride = `${t.name} Sword`; d.DamageMultiplier = t.damage; d.PickupMeshColors[0] = color(t.stand); break;
    case 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv':
      d.ItemNameOverride = `${t.name} Sword`; d.DamageMultiplier = t.damage; d.MeshColors[0] = color(t.blade); break;
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
    if (t.key !== 'bronze') for (const c of copy.components) if (c.data) patch(c, t);
    files.set(f.path, new Uint8Array(encodeChunk(copy)));
    expected.set(f.path, J(copy.components.map(c => c.data)));
  }
  const out = bundle(files);
  fs.writeFileSync(path.join(PREFABS, `shop_${t.key}${t.key === 'bronze' ? '_copy' : ''}.brz`), out); // never overwrite the hand-built original
  // read it back and confirm the values took
  const check = brs.WorldReader.from(Buffer.from(out));
  for (const f of componentFiles) {
    const got = check.componentChunk(f.grid, f.chunk).components.map(c => J(c.data));
    const want = JSON.parse(expected.get(f.path)).map(d => J(d));
    const bad = got.map((g, i) => (g === want[i] ? null : `#${i}\n  got  ${g.slice(0, 300)}\n  want ${want[i].slice(0, 300)}`)).filter(Boolean);
    if (bad.length) throw new Error(`shop_${t.key}: ${f.path} reads back different:\n${bad.join('\n')}`);
  }
  for (const p of paths) if (!componentFiles.some(f => f.path === p) && !Buffer.from(check.fs.readFile(p)).equals(Buffer.from(reader.fs.readFile(p)))) throw new Error(`shop_${t.key}: ${p} changed`);
  const seen = [];
  for (const f of componentFiles)
    for (const c of check.componentChunk(f.grid, f.chunk).components) {
      if (c.typeName === 'BrickComponentType_WireGraphPseudo_Var') seen.push(`price ${c.data.Value.value}`);
      if (c.typeName === 'Component_ItemSpawn') seen.push(`stand "${c.data.ItemNameOverride}" x${c.data.DamageMultiplier}`);
      if (c.typeName === 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') seen.push(`gives "${c.data.ItemNameOverride}" blade ${JSON.stringify(c.data.MeshColors[0])}`);
    }
  console.log(`shop_${t.key}.brz ${out.length} bytes: ${seen.join(', ')}`);
}
