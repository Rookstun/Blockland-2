// Dumps every shop stand's give-item (AddInventoryItemAdv) + price into
// itemcatalog.json, the name -> item table gen.js restores inventories from.
//   (server) ~/node22/bin/node catalogdump.mjs > itemcatalog.json
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const SHOP = /^(shop_[a-z]+(_dagger|_longsword|_scimitar|_spatha|_2h)?|bow_[a-z]+|gun_[a-z]+|soda_[a-z]+)\.brz$/;
const num = v => (typeof v === 'bigint' ? Number(v) : typeof v === 'object' && v && 'value' in v ? num(v.value) : v);
const out = [];
for (const f of fs.readdirSync(PREFABS).filter(f => SHOP.test(f) && !f.includes('_copy')).sort()) {
  const r = brs.WorldReader.from(fs.readFileSync(path.join(PREFABS, f)));
  const files = r.fs.listPaths().map(p => p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/)).filter(Boolean);
  let give = null, price = null;
  for (const m of files) {
    for (const c of r.componentChunk(+m[1], { x: +m[2], y: +m[3], z: +m[4] }).components) {
      if (c.typeName === 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') give = c.data;
      if (c.typeName === 'BrickComponentType_WireGraphPseudo_Var') price = num(c.data.Value);
    }
  }
  if (!give) { console.error(`${f}: no AddInventoryItemAdv`); continue; }
  // ItemType indexes the bundle's external asset table
  const refs = r.globalData().ExternalAssetReferences;
  const ref = refs[num(give.ItemType)];
  if (!ref || ref.PrimaryAssetType !== 'BRItemBase') { console.error(`${f}: ItemType ${give.ItemType} -> ${JSON.stringify(ref)}`); continue; }
  const e = { name: give.ItemNameOverride, item: ref.PrimaryAssetName, price, prefab: f.replace(/\.brz$/, '') };
  for (const [k, v] of [['damage', give.DamageMultiplier], ['speed', give.WeaponSpeedMultiplier], ['scale', give.ItemScale]]) if (Math.abs(v - 1) > 1e-6) e[k] = +v.toPrecision(6);
  if (give.bOverrideColors) e.colors = give.MeshColors.map(c => [c.R, c.G, c.B]);
  out.push(e);
}
console.log(JSON.stringify(out, (k, x) => (typeof x === 'bigint' ? String(x) : x), 1));
