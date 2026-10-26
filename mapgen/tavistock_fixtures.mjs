// Tavistock working fixtures (2026-10-26, owner: "make working lights and light switches and doors for every room.
// they need a rerouter thats invisible or they will have wires showing"), copied from the owner's own pieces in
// the house (tavistock_owner.brz): their pole lamp, their wall switch -> invisible rerouter -> lamp wiring, and
// their servo garage door (a moving brick grid held by a servo joint).
//   lamp   = glass PB_DefaultPole with a PointLight under a metal B_1x1F_Round canopy (the owner's, 4 under the ceiling)
//   switch = B_Switch_Flipped 5 off the wall face, 35 over the floor; an invisible B_1x1_Reroute_Node beside it
//            fans out to the room's lamps, so the only wire from a visible brick is the 2-unit one into the rerouter
//   door   = a panel on its own grid, hung on a B_Joint_Servo_Micro at the hinge (joint as the game saves it:
//            offset = grid origin - servo, rotation identity for an upright servo); a handle switch on each face of
//            the door -> invisible XOR (either handle toggles) -> Select 0 / 90 -> servo TargetAngle
// Positions come from tavistock({...}).fixtures (output frame, relative to the house origin). Writes a prefab owned
// by the generator's owner, so a Bricks.Clear of Tavistock wipes it with the house.
//   node mapgen/tavistock_fixtures.mjs [out.brz]
import fs from 'fs';
import { tavistock } from './tavistock.mjs';
const lib = await import(new URL('../tools/brs4/dist.mjs', import.meta.url).href); // patched: tools/patch_brs4_joints.mjs
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
if (!World.prototype.registerJoint) throw Error('run node tools/patch_brs4.mjs first (joint links)');

const OWNER = { id: 'c1770000-0000-4b0b-9a11-0000000a3313', name: 'Tavistock', display_name: 'Tavistock' };
const ASSETS = [{ type: 'BrickAudioDescriptor', name: 'BA_Thumpy_Machine' }, { type: 'BrickOneShotAudioDescriptor', name: 'OBA_Lightswitch' }];
const WHITE = [244, 242, 236];
const { fixtures } = tavistock();
const w = new World();
const O = w.addOwner(OWNER);
const add = (b, grid) => w.addBrick({ owner_index: O, color: WHITE, ...b }, grid);
const wire = (a, ac, ap, b, bc, bp) => w.addWire({ brick: a, component_type: C[ac].NAME, port: C[ac].PORTS[ap] }, { brick: b, component_type: C[bc].NAME, port: C[bc].PORTS[bp] });
const hidden = { visibility: false, collision: false };
// a wall-mounted piece faces its normal: direction X+ 0, X- 1, Y+ 2, Y- 3 (rotation as the owner's switches had)
const facing = ([nx, ny]) => nx ? { direction: nx > 0 ? 0 : 1, rotation: 3 } : { direction: ny > 0 ? 2 : 3, rotation: 1 };
const sw = (position, normal, grid) => add({
  asset: 'B_Switch_Flipped', position, ...facing(normal),
  components: [{ type: C.AnimatedSwitch.NAME, data: { bEnabled: true, InteractSound: 1, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: '' } }],
}, grid);

let nLamps = 0;
for (const room of fixtures.rooms) {
  const [x, y, z] = room.switch.at, [nx, ny] = room.switch.normal;
  const s = sw([x + 5 * nx, y + 5 * ny, z + 35], room.switch.normal);
  const rr = add({ asset: 'B_1x1_Reroute_Node', position: [x + 3 * nx, y + 3 * ny, z + 45], ...facing(room.switch.normal), rotation: 3, ...hidden, components: [{ type: C.Rerouter.NAME }] });
  wire(s, 'AnimatedSwitch', 'bEnabled', rr, 'Rerouter', 'RER_Input');
  for (const { at: [lx, ly, c] } of room.lamps) {
    const pole = add({
      asset: 'PB_DefaultPole', size: [3, 3, 1], position: [lx, ly, c - 5], direction: 4, rotation: 2, color: [255, 255, 255], material: 'BMC_Glass',
      components: [{ type: C.PointLight.NAME, data: { bMatchBrickShape: true, bEnabled: true, Brightness: 20, Radius: 150, Color: { R: 255, G: 255, B: 255, A: 255 }, bUseBrickColor: true, bCastShadows: false, RayTracingVisibility: 0 } }],
    });
    add({ asset: 'B_1x1F_Round', position: [lx, ly, c - 2], direction: 5, rotation: 2, color: [193, 193, 193], material: 'BMC_Metallic' });
    wire(rr, 'Rerouter', 'RER_Output', pole, 'PointLight', 'bEnabled');
    nLamps++;
  }
}

const GRID_DATA = { BouyancyScale: 0.2, MassScale: 1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, bVisible: true, CollisionQuality: 0, EntityTag: '', CustomProperties: { $map: [] }, GameModeTeamName: '', bDetectableByAnyone: false };
for (const d of fixtures.doors) {
  const [hx, hy, hz] = d.hinge, [fx, fy] = d.free;
  const len = Math.hypot(fx - hx, fy - hy), u = [(fx - hx) / len, (fy - hy) / len], perp = [-u[1], u[0]];
  // panel: 22 long from 1 past the hinge axis, 4 thick, 58 tall from 2 over the sill
  const half = 11, origin = [hx + u[0] * (1 + half), hy + u[1] * (1 + half), d.z0 + 31];
  const servo = add({
    asset: 'B_Joint_Servo_Micro', position: [hx, hy, hz], direction: 4, rotation: 0,
    components: [{ type: C.Servo.NAME, data: { bEnabled: true, TargetAngle: 0, Power: 5e9, ActiveDamping: 5000, ForceLimit: 0, bLimitAngle: false, LimitAngle: 0, CurrentAngle: 0, bAnglesArePercentages: false, bReversed: false, Damping: 5e6 } }],
  });
  const grid = w.addBrickGrid({ owner_index: O, location: { X: origin[0], Y: origin[1], Z: origin[2] }, sleeping: true, data: GRID_DATA });
  add({ asset: 'PB_DefaultMicroBrick', size: u[0] ? [half, 2, 29] : [2, half, 29], position: [0, 0, 0], color: d.color }, grid);
  w.registerJoint(servo, grid, { X: origin[0] - hx, Y: origin[1] - hy, Z: origin[2] - hz }, { X: 0, Y: 0, Z: 0, W: 1 });
  // handles near the free edge, one on each face, at hand height (36 over the floor)
  const hs = [1, -1].map(side => sw([u[0] * 8 + perp[0] * 5 * side, u[1] * 8 + perp[1] * 5 * side, d.z0 + 36 - origin[2]], [perp[0] * side, perp[1] * side], grid));
  const at = k => [hx + u[0] * 10 * k, hy + u[1] * 10 * k, hz];
  const xor = add({ asset: C.Expr_LogicalXOR.BRICK, position: at(1), direction: 4, rotation: 0, ...hidden, components: [{ type: C.Expr_LogicalXOR.NAME, data: {} }] });
  const sel = add({ asset: C.Expr_Select.BRICK, position: at(2), direction: 4, rotation: 0, ...hidden, components: [{ type: C.Expr_Select.NAME, data: { bSelectB: false, InputA: { $variant: 'f64', value: 0 }, InputB: { $variant: 'f64', value: 90 } } }] });
  wire(hs[0], 'AnimatedSwitch', 'bEnabled', xor, 'Expr_LogicalXOR', 'bInputA');
  wire(hs[1], 'AnimatedSwitch', 'bEnabled', xor, 'Expr_LogicalXOR', 'bInputB');
  wire(xor, 'Expr_LogicalXOR', 'bOutput', sel, 'Expr_Select', 'bSelectB');
  wire(sel, 'Expr_Select', 'Output', servo, 'Servo', 'TargetAngle');
}
// handles start "on": both on = XOR off = closed
const out = process.argv[2] ?? new URL('./tavistock_fixtures.brz', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.writeFileSync(out, w.toBrz({ bundle: { description: 'Tavistock fixtures: lamps, switches, doors' }, externalAssets: ASSETS }));
console.error(`fixtures: ${fixtures.rooms.length} switches, ${nLamps} lamps, ${fixtures.doors.length} doors -> ${out}`);
