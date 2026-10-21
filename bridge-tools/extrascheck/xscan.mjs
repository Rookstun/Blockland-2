// extras in a world .brdb (main grid): node xscan.mjs world.brdb out.json
import fs from 'fs'; import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const r = new m.WorldReader(new m.Brdb(new DatabaseSync(process.argv[2], { readOnly: true })));
const A = r.brickAssets(), names = r.owners().UserNames;
const out = [], perOwner = {};
for (const ci of r.brickChunkIndex(1)) {
  let bricks, comps = [];
  try { bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => r.brickChunkSoa(e, i) }, 1)]; } catch { continue; }
  try { comps = r.componentChunk(1, ci.index).components; } catch {}
  for (const c of comps) {
    const b = bricks[c.brickIndex]; if (!b) continue;
    const on = names[b.owner_index] ?? '?';
    const k = on + '|' + c.typeName; perOwner[k] = (perOwner[k] ?? 0) + 1;
    if (/BotSpawn|ItemSpawn|Target|Button/.test(c.typeName))
      out.push([c.typeName.replace('Component_', ''), on, A[b.asset_name_index]?.name ?? A[b.asset_name_index], b.position.map(Math.round), c.typeName === 'Component_ItemSpawn' ? (c.data?.PickupClass?.name ?? c.data?.PickupClass ?? '') : (c.data?.BotName ?? '')]);
  }
}
for (const [k, v] of Object.entries(perOwner).sort()) if (/BotSpawn|ItemSpawn|Target|Button|Microchip/.test(k)) console.log(v, k);
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('extras', out.length);
