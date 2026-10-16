// One-off (2026-10-16): the owner's hand-built props in the site world's far armory
// (15260,-460) -> ownerprops.json, bricks relative to each prop's floor centre.
//   node mapgen/models/capture_ownerprops.mjs BASE.brz WORLD.brdb   (brs-js 4 dist in tools/brs4)
// BASE.brz = Prefab.SaveRegion round the armory (main grid: stall, chest base, heart);
// the chest lid sits on a hinged grid (B_Joint_Bearing_Micro), read from the world
// file and turned onto the main grid (its rotation is a 90 degree yaw).
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { turnBrick } from '../orient.mjs';
const m = await import(new URL('../../tools/brs4/dist.mjs', import.meta.url));
const [BASE, WORLD] = process.argv.slice(2);
const FLOOR = 856;
const PROPS = { stall: { x: [15230, 15360], y: [-340, -290], c: [15295, -315] }, heart: { x: [15385, 15410], y: [-300, -280], c: [15396, -290] }, chest: { x: [15420, 15490], y: [-320, -270], c: [15454, -295] } };
const conv = (b, A, M) => {
  const o = { asset: A[b.asset_name_index]?.name ?? A[b.asset_name_index], size: b.size, position: b.position, direction: b.direction, rotation: b.rotation, color: b.color };
  const mat = M[b.material_index]?.name ?? M[b.material_index];
  if (mat && mat !== 'BMC_Plastic') { o.material = mat; o.intensity = b.material_intensity; }
  return o;
};
const base = m.WorldReader.from(fs.readFileSync(BASE));
const A = base.brickAssets(), M = base.materials();
const out = {};
for (const [k, P] of Object.entries(PROPS)) {
  out[k] = [...base.bricks(1)].filter(b => b.position[0] >= P.x[0] && b.position[0] <= P.x[1] && b.position[1] >= P.y[0] && b.position[1] <= P.y[1] && b.position[2] > FLOOR && b.position[2] < FLOOR + 120)
    .map(b => conv(b, A, M)).filter(b => !/Joint|Gate|Microchip|B_2x2_Round|Octo|Button/.test(b.asset));
}
const w = new m.WorldReader(new m.Brdb(new DatabaseSync(WORLD, { readOnly: true })));
const WA = w.brickAssets(), WM = w.materials();
const lid = [...w.entities()].find(e => e.typeName === 'Entity_DynamicBrickGrid' && Math.hypot(e.location.X - 15454, e.location.Y + 295) < 30);
for (const b of w.bricks(lid.persistentIndex)) {
  const r = turnBrick({ ...conv(b, WA, WM), position: b.position.map(v => v + 1024) }, 1);
  out.chest.push({ ...r, position: [lid.location.X + r.position[0], lid.location.Y + r.position[1], lid.location.Z + r.position[2]] });
}
for (const [k, P] of Object.entries(PROPS))
  out[k] = out[k].map(b => ({ ...b, position: [Math.round(b.position[0] - P.c[0]), Math.round(b.position[1] - P.c[1]), Math.round(b.position[2] - FLOOR)] }));
fs.writeFileSync(new URL('./ownerprops.json', import.meta.url), JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, v.length, 'bricks, z', Math.min(...v.map(b => b.position[2])), '..', Math.max(...v.map(b => b.position[2])));
