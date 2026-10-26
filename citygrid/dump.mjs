import fs from 'fs';
const brs = await import('../tools/brs4/dist.mjs');
const f = process.argv[2];
const r = brs.WorldReader.from(fs.readFileSync(`prefabs/${f}.brz`));
const g = r.globalData();
const names = [...g.BasicBrickAssetNames, ...g.ProceduralBrickAssetNames];
console.log('basic', g.BasicBrickAssetNames, 'proc', g.ProceduralBrickAssetNames, 'mats', g.MaterialAssetNames, 'comps', g.ComponentTypeNames, 'ext', JSON.stringify(g.ExternalAssetReferences));
console.log('paths', r.fs.listPaths().join(' '));
for (const b of r.bricks()) console.log(names[b.asset_name_index], b.size.join(','), b.position.join(','), b.direction, b.rotation, b.color.join(','), b.material_index);
