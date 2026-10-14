// Server side of the live editor (runs on pzedlo from bridge/tools/liveedit/):
//   node region.mjs <prefab.brz>   -> JSON { bricks, owners } on stdout
// The prefab comes from br.Prefab.SaveRegion, whose brick positions are WORLD
// coordinates. Main grid only; a brick with any component (chips, spawners,
// buttons, zones...) comes back locked: the editor never re-lays those.
import fs from 'fs';
const brs = await import('/home/max/omegga-server/plugins/bridge/lib/brs.mjs');
const r = brs.WorldReader.from(fs.readFileSync(process.argv[2]));
const assets = r.brickAssets().map(a => a.name ?? a), mats = r.materials();
const hex = v => (v >>> 0).toString(16).padStart(8, '0');
const o = r.owners?.() ?? {};
const owners = (o.UserIds ?? []).map((u, i) => {
  const a = hex(u.A), b = hex(u.B), c = hex(u.C), d = hex(u.D);
  return { id: `${a}-${b.slice(0, 4)}-${b.slice(4)}-${c.slice(0, 4)}-${c.slice(4)}${d}`, name: o.UserNames?.[i] ?? '?', display: o.DisplayNames?.[i] ?? '' };
});
const bricks = [];
const it = r.bricks(1);
for (const c of r.brickChunkIndex(1)) {
  const comp = new Set();
  if (c.numComponents) try { for (const x of r.componentChunk(1, c.index).components) comp.add(x.brickIndex); } catch {}
  for (let i = 0; i < c.numBricks; i++) {
    const b = it.next().value;
    const x = {
      asset: assets[b.asset_name_index], position: b.position, direction: b.direction, rotation: b.rotation, color: b.color.slice(0, 3),
      material: mats[b.material_index] ?? 'BMC_Plastic', material_intensity: b.material_intensity, collision: b.collision, visibility: b.visibility, owner: b.owner_index,
    };
    if (b.size.some(v => v)) x.size = b.size;
    if (comp.has(i)) x.locked = true;
    bricks.push(x);
  }
}
let entities = 0;
try { for (const e of r.entities()) entities++; } catch {}
process.stdout.write(JSON.stringify({ bricks, owners, entities }));
