import fs from 'fs';
const [lib, file] = process.argv.slice(2);
const m = await import(new URL('file://' + lib));
const r = m.WorldReader.from(fs.readFileSync(file));
const assets = r.brickAssets().map(a => a.name ?? a);
for (const b of r.bricks(1)) console.log(assets[b.asset_name_index], b.position.join(), b.size.join(), b.color.join(), b.direction, b.rotation, b.material_index);
