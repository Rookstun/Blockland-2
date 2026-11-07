// Size-cupcake table (Rookstun 2026-11-07: "a table. cupcakes that make me small, giant, and regular size. Use the newest
// player resizing features"). Three cupcakes on a small table, each a Component_Button: press -> EdgeDetectorExec ->
// Exec_Character_SetScale (the new character-scale gate; tools/brs4/dist.mjs was patched with its schema, read off
// Rookstun's own gate: struct BCSComponentVertex_Exec_Character_SetScale { Scale: f64 }, ports Character Scale Exec ExecOut).
// Gates hide under the table top (visibility + collision off). Table along x, cupcakes face -y.
//   node cupcakes/build.mjs -> cupcakes/cupcakes.brz ; br.Prefab.Load "cupcakes" X Y Z 0 16 (Z = ground)
import fs from 'node:fs';
import * as brs from '../tools/brs4/dist.mjs';

const C = brs.brdb.COMPONENTS;
const w = new brs.World();
const O = w.addOwner({ id: 'c1a0de00-0000-4b0b-9a11-00000ca4ce5a', name: 'Claude Cupcakes', display_name: 'Claude Cupcakes' });
const MB = 'PB_DefaultMicroBrick';
const box = (x0, y0, z0, x1, y1, z1, color, more = {}) => w.addBrick({ asset: MB, color, size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2],
  position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], owner_index: O, ...more });
// table: top 80 x 40 at z 28..32, four legs, a cloth runner
const WOOD = [120, 80, 46], LEG = [96, 64, 36];
box(-40, -20, 28, 40, 20, 32, WOOD);
for (const [x, y] of [[-36, -16], [32, -16], [-36, 12], [32, 12]]) box(x, y, 0, x + 4, y + 4, 28, LEG);
box(-36, -12, 32, 36, 12, 34, [240, 236, 228]);
// cupcakes: [x, scale, frosting colour, label]. The game clamps Character SetScale to 0.5 .. 2 (0.4 / 3 read back as 0.5 / 2)
const CAKES = [[-24, 0.5, [90, 150, 240], 'Eat me (tiny)'], [0, 1, [250, 250, 250], 'Eat me (normal)'], [24, 2, [230, 60, 70], 'Eat me (giant)']];
let gi = 0;
const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, position: [-30 + (gi % 7) * 10, -6 + Math.floor(gi++ / 7) * 10, 14], color: [200, 200, 200],
  owner_index: O, visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false }, components: [{ type: c.NAME, data }] }), c });
const port = (g, p) => ({ brick: g.h, component_type: g.c.NAME, port: g.c.PORTS[p] });
for (const [x, scale, frost, label] of CAKES) {
  box(x - 6, -6, 34, x + 6, 6, 44, [200, 150, 90]); // liner
  box(x - 7, -7, 44, x + 7, 7, 48, frost);
  const top = box(x - 5, -5, 48, x + 5, 5, 52, frost, { components: [{ type: C.Button.NAME, data: { PromptCustomLabel: label, bAllowNearbyInteraction: true, bHiddenInteraction: false } }] });
  box(x - 2, -2, 52, x + 2, 2, 56, [200, 20, 40]); // cherry
  const edge = gate(C.Expr_EdgeDetectorExec), set = gate(C.Exec_Character_SetScale, { Scale: scale });
  w.addWire({ brick: top, component_type: C.Button.NAME, port: 'bHeld' }, port(edge, 'Input'));
  w.addWire(port(edge, 'OnRisingEdge'), port(set, 'Exec'));
  w.addWire({ brick: top, component_type: C.Button.NAME, port: 'Character' }, port(set, 'Character'));
}
w.makePrefab({});
fs.writeFileSync(new URL('./cupcakes.brz', import.meta.url), w.toBrz({ bundle: { description: 'Size cupcakes' } }));
console.log('wrote cupcakes.brz');
