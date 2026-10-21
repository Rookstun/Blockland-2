// list bricks of a prefab: owner, asset, pos, size (to find a build's extent)
import fs from 'fs';
const [lib, file] = process.argv.slice(2);
const m = await import(new URL('file://' + lib));
const r = m.WorldReader.from(fs.readFileSync(file));
const names = r.owners().UserNames, assets = r.brickAssets().map(a => a.name ?? a);
const by = {};
for (const b of r.bricks(1)) { const k = names[b.owner_index]; (by[k] ??= []).push(b); }
for (const [k, bs] of Object.entries(by)) {
  const lo = [0,1,2].map(i => Math.min(...bs.map(b => b.position[i]))), hi = [0,1,2].map(i => Math.max(...bs.map(b => b.position[i])));
  console.log(k, bs.length, 'lo', lo.join(), 'hi', hi.join());
  const cnt = {}; for (const b of bs) { const a = assets[b.asset_name_index]; cnt[a] = (cnt[a] ?? 0) + 1; } console.log('  ', JSON.stringify(cnt));
}
