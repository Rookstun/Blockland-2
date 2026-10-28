// The owner's upgrade panel (clipboard upgrades/panel_owner.brz: 5 columns x 6 hologram tiles on a black
// cube under a micro-wedge roof) with every tile a button "<Upgrade> Level N" (columns by x = gen.mjs UP
// order, rows by z = levels 1..6 upward) and ONE hidden microchip on the cube's back face:
//   tile bHeld -> EdgeDetectorExec -> SendCustomEventGlobal "upg" (DataIn1 = tile Character, DataIn2 = col*10 + level)
// The sky chip (upgrades.ws) does the rest.   node upgrades/panel.mjs -> upgrades/panel.brz
import { readFileSync, writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
import { UP, LEVELS } from './gen.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const DIST = ROOT + 'tools/brs4/dist.mjs';
const k = await mk(DIST, { owner: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' } });
const { w, C, wire, int, num } = k;
const src = k.WorldReader.from(readFileSync(ROOT + 'upgrades/panel_owner.brz'));
const A = src.brickAssets(), M = src.materials();
const bricks = [...src.bricks(1)];
const tiles = bricks.filter(b => A[b.asset_name_index] === 'PB_DefaultTile');
const xs = [...new Set(tiles.map(b => b.position[0]))].sort((a, b) => a - b);
const zs = [...new Set(tiles.map(b => b.position[2]))].sort((a, b) => a - b);
if (xs.length !== UP.length || zs.length !== LEVELS) throw Error(`panel is ${xs.length}x${zs.length}, want ${UP.length}x${LEVELS}`);

const btn = [];
for (const b of bricks) {
  const { asset_name_index, material_index, ...rest } = b;
  const isTile = A[asset_name_index] === 'PB_DefaultTile';
  const col = xs.indexOf(b.position[0]), lvl = zs.indexOf(b.position[2]) + 1;
  const h = w.addBrick({ ...rest, asset: A[asset_name_index], material: M[material_index], owner_index: k.ownerIdx,
    components: isTile ? [{ type: 'Component_Button', data: { PressSound: null, ReleaseSound: null, bAllowNearbyInteraction: true,
      bHiddenInteraction: false, PromptCustomLabel: `${UP[col][1]} Level ${lvl}` } }] : [] });
  if (isTile) btn.push({ h, c: C.Button, id: col * 10 + lvl });
}
const cube = bricks.find(b => A[b.asset_name_index] === 'PB_DefaultMicroBrick');
// chip flat on the cube's back face (tiles are on its +y face), hidden, no collision
const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [cube.position[0], cube.position[1] - cube.size[1] - 2, cube.position[2]],
  direction: 3, rotation: 0, owner_index: k.ownerIdx, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
const CG = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 220, Y: -200, Z: 0 }, PlaneExtent: { X: 260, Y: 260, Z: 2 } } });
w.registerMicrochipLink(chipBrick, CG);
const gate = (c, data = {}, extra) => k.gate(c, data, CG, extra);
let order = 0;
for (const b of btn) {
  const pin = port => { const g = gate(C.MicrochipInput, { PortLabel: `${b.id} ${port}`, PortOrder: order++ }); wire(b, port, g, 'RER_Input'); return g; };
  const held = pin('bHeld'), who = pin('Character');
  const edge = gate(C.Expr_EdgeDetectorExec); wire(held, 'RER_Output', edge, 'Input');
  const send = gate(C.Exec_SendCustomEventGlobal, { EventName: 'upg', DataIn1: num(0), DataIn2: int(b.id),
    ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(i => ['DataIn' + i, num(0)])) }, { size: [5, 5, 2] });
  wire(edge, 'OnRisingEdge', send, 'ExecIn'); wire(who, 'RER_Output', send, 'DataIn1');
}
w.makePrefab({});
writeFileSync(ROOT + 'upgrades/panel.brz', w.toBrz({ bundle: { description: 'Upgrade panel: 30 buttons -> global event upg' } }));
console.log(`wrote upgrades/panel.brz (${btn.length} buttons)`);
