// Dump a prefab's component bricks + wires: node dump.mjs <brs4 lib> in.brz [ownerFilter]
import fs from 'fs';
const [lib, file, ownerF] = process.argv.slice(2);
const m = await import(new URL('file://' + lib));
const r = m.WorldReader.from(fs.readFileSync(file));
const names = r.owners().UserNames;
console.log('owners', names.join(' | '));
const ea = r.externalAssets();
for (const g of r.gridIds()) {
  for (const ci of r.brickChunkIndex(g)) {
    const bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => r.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => r.brickChunkSoa(e, i) }, g)];
    let comps = []; try { comps = r.componentChunk(g, ci.index).components; } catch {}
    const byB = {};
    for (const c of comps) (byB[c.brickIndex] ??= []).push(c);
    for (const [bi, cs] of Object.entries(byB)) {
      const b = bricks[bi]; const own = names[b.owner_index] ?? b.owner_index;
      if (ownerF && !String(own).includes(ownerF)) continue;
      console.log(`G${g} ${ci.index.x}_${ci.index.y}_${ci.index.z} #${bi} ${b.asset} pos ${b.position} size ${b.size} own ${own} vis ${b.visibility}`);
      for (const c of cs) { if (/Event|Gate|Button|ItemSpawn|Text|Var|Interact|Changer|Pressure|Zone|Microchip|Audio/.test(c.typeName) || true) console.log('   ', c.typeName, JSON.stringify(c.data, (k, v) => typeof v === 'bigint' ? String(v) : v)?.slice(0, 400)); }
    }
    let w; try { w = r.wireChunk(g, ci.index); } catch { continue; }
    for (const x of w.local) console.log(`  W G${g} #${x.source.brickIndex}.${x.source.port} -> #${x.target.brickIndex}.${x.target.port}`);
    for (const x of w.remote) console.log(`  RW G${x.source.gridId}#${x.source.brickIndex}.${x.source.port} -> G${g}#${x.target.brickIndex}.${x.target.port}`);
  }
}
console.log('entities'); try { for (const e of r.entities()) console.log(e.typeName, JSON.stringify(e.location), e.ownerIndex); } catch (e) { console.log('ent err', e.message); }
console.log('ext', JSON.stringify(ea).slice(0, 2000));
