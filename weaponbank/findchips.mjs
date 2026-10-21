// find every microchip grid listening for a global event name (world .brdb): node findchips.mjs <brs4> world.brdb bank.act
import fs from 'fs';
const [lib, file, name] = process.argv.slice(2);
const m = await import(new URL('file://' + lib));
const { DatabaseSync } = await import('node:sqlite');
const r = new m.WorldReader(new m.Brdb(new DatabaseSync(file, { readOnly: true })));
const names = r.owners().UserNames;
const ents = new Map([...r.entities()].map(e => [e.persistentIndex, e]));
for (const g of r.gridIds()) {
  const e = ents.get(g); if (!e || e.typeName !== 'Entity_MicrochipDynamicBrickGrid') continue;
  let hit = false;
  for (const ci of r.brickChunkIndex(g)) { let cs; try { cs = r.componentChunk(g, ci.index).components; } catch { continue; } if (cs.some(c => c.typeName === 'BrickComponentType_Event_CustomGlobal' && c.data?.EventName === name)) hit = true; }
  if (hit) console.log('grid', g, 'loc', JSON.stringify(e.location), 'owner', names[e.ownerIndex]);
}
