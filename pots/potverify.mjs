import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const r = new m.WorldReader(new m.Brdb(new DatabaseSync(process.argv[2], { readOnly: true })));
const A = r.brickAssets(); const nm = i => A[i]?.name ?? A[i];
let jarEnt = 0, worldPots = 0, colours = new Set(), chips = 0;
for (const g of r.gridIds()) {
  if (g === 1) {
    for (const ci of r.brickChunkIndex(1)) {
      let bricks; try { bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => r.brickChunkSoa(e, i) }, 1)]; } catch { continue; }
      let comps = []; try { comps = r.componentChunk(1, ci.index).components; } catch {}
      for (const c of comps) { const b = bricks[c.brickIndex]; if (b && nm(b.asset_name_index) === 'B_Jar' && c.typeName === 'Component_Target') { worldPots++; colours.add(b.color.join(',')); } }
    }
    continue;
  }
  let bs; try { bs = [...r.bricks(g)]; } catch { continue; }
  if (bs.some(b => nm(b.asset_name_index) === 'B_Jar')) jarEnt++;
}
console.log('world-grid pots', worldPots, 'colours', colours.size, 'jar entity grids', jarEnt);
