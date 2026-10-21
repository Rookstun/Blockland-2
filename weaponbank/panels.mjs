// read the bank's panel ItemSpawns from a world .brdb (loose grids: SaveRegion can't see them)
//   node panels.mjs <brs4 lib> world.brdb
import fs from 'fs';
const [lib, file] = process.argv.slice(2);
const m = await import(new URL('file://' + lib));
const { DatabaseSync } = await import('node:sqlite');
const r = new m.WorldReader(new m.Brdb(new DatabaseSync(file, { readOnly: true })));
const ext = r.externalAssets();
const ents = new Map([...r.entities()].map(e => [e.persistentIndex, e]));
for (const g of r.gridIds()) {
  const e = ents.get(g); if (!e || e.typeName !== 'Entity_DynamicBrickGrid') continue;
  if (Math.abs(e.location.X) > 5 || Math.abs(e.location.Y - 305) > 5) continue;
  for (const ci of r.brickChunkIndex(g)) {
    let cs; try { cs = r.componentChunk(g, ci.index).components; } catch { continue; }
    const bs = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (a, i) => r.brickChunkSoa(a, i) }, g)];
    const spawns = cs.filter(c => c.typeName === 'Component_ItemSpawn');
    console.log('grid', g, 'loc', JSON.stringify(e.location), 'spawns', spawns.length);
    if (spawns.length <= 5) for (const c of spawns) console.log('  ', bs[c.brickIndex].position.join(), ext[c.data.PickupClass]?.name, c.data.ItemNameOverride, c.data.bPickupEnabled);
  }
}
