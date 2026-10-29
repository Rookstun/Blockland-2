// Tavistock working fixtures (2026-10-26, owner: "make working lights and light switches and doors for every room.
// they need a rerouter thats invisible or they will have wires showing"), copied from the owner's own pieces in
// the house (tavistock_owner.brz): their pole lamp, their wall switch -> invisible rerouter -> lamp wiring, and
// their servo garage door (a moving brick grid held by a servo joint).
//   lamp   = glass PB_DefaultPole with a PointLight under a metal B_1x1F_Round canopy (the owner's, 4 under the ceiling)
//   switch = B_Switch_Flipped 5 off the wall face, 35 over the floor; an invisible B_1x1_Reroute_Node beside it
//            fans out to the room's lamps, so the only wire from a visible brick is the 2-unit one into the rerouter
//   door   = the owner's working door (refs/door_owner.brz): click the door itself to swing it (see below)
// Positions come from tavistock({...}).fixtures (output frame, relative to the house origin). Writes a prefab owned
// by the generator's owner, so a Bricks.Clear of Tavistock wipes it with the house.
//   node mapgen/tavistock_fixtures.mjs [out.brz]
import fs from 'fs';
import { tavistock } from './tavistock.mjs';
const lib = await import(new URL('../tools/brs4/dist.mjs', import.meta.url).href); // patched: tools/patch_brs4_joints.mjs
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
if (!World.prototype.registerJoint) throw Error('run node tools/patch_brs4.mjs first (joint links)');

const OWNER = process.argv.includes('--owner') ? { id: process.argv[process.argv.indexOf('--owner') + 1], name: process.argv[process.argv.indexOf('--owner') + 2], display_name: process.argv[process.argv.indexOf('--owner') + 2] } : { id: 'c1770000-0000-4b0b-9a11-0000000a3313', name: 'Tavistock', display_name: 'Tavistock' };
const ASSETS = [{ type: 'BrickAudioDescriptor', name: 'BA_Thumpy_Machine' }, { type: 'BrickOneShotAudioDescriptor', name: 'OBA_Lightswitch' }, { type: 'BrickOneShotAudioDescriptor', name: 'OBA_Door_Wood3_Open' }];
const WHITE = [244, 242, 236];
// --turn 2: the house turned half round (city north lots, citygrid r 2): every position and normal negated in x, y;
// load the prefab at centre + (lx, ly). --owner ID NAME: another owner (city copies, not wiped with the main house)
const argv = process.argv.slice(2), opt = k => argv.includes(k) ? argv[argv.indexOf(k) + 1] : null;
const turn = +(opt('--turn') ?? 0);
// --house NAME: another house built on this template (mapgen/NAME.mjs exporting NAME(): whitetail, chateaureve)
const house = opt('--house') ?? 'tavistock';
const { fixtures } = house === 'tavistock' ? tavistock() : (await import(`./${house}.mjs`))[house]();
if (turn === 2) {
  const n = ([x, y, z]) => [-x, -y, z];
  for (const r of fixtures.rooms) { r.lamps.forEach(l => { l.at = n(l.at); }); r.switch.at = n(r.switch.at); r.switch.normal = r.switch.normal.map(v => -v); }
  for (const d of fixtures.doors) { d.a0 = n(d.a0); d.a1 = n(d.a1); }
}
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
// doors: the owner's working door (mapgen/refs/door_owner.brz, 2026-10-26) copied as is and turned to each opening.
// Its servo sits on the floor at the hinge (upright, rotation 2, TargetAngle 180 = shut); the joint holds the door
// grid at the servo itself (offset 0, rotation identity). On the grid: the panel IS the switch (click the door),
// wired to an invisible Select (shut 180 / open 90) whose output crosses to the servo; a knob on each face.
// Grid-local, panel toward -x from the hinge. Panel 62 tall exactly as theirs: the grid settles onto the sill (origin = floor top), so 62 fills a 62 opening (58 left a 4 gap, owner screenshot).
const DOOR_WOOD = [149, 96, 46], KNOB = [246, 206, 42];
const quat = k => ({ X: 0, Y: 0, Z: Math.sin(k * Math.PI / 4), W: Math.cos(k * Math.PI / 4) }); // k quarter turns about +Z
for (const d of fixtures.doors) {
  const [x0, y0, z] = d.a0, [x1, y1] = d.a1;
  const len = Math.hypot(x1 - x0, y1 - y0), u = [Math.round((x1 - x0) / len), Math.round((y1 - y0) / len)];
  const k = { '-1,0': 0, '0,-1': 1, '1,0': 2, '0,1': 3 }[u.join()]; // the turn that points grid -x along the opening
  const hinge = [x0 + u[0], y0 + u[1], z + 1];
  const servo = add({
    asset: 'B_Joint_Servo_Micro', position: hinge, direction: 4, rotation: (2 + k) % 4,
    components: [{ type: C.Servo.NAME, data: { bEnabled: true, TargetAngle: 180, Power: 100, ActiveDamping: 30, ForceLimit: 0, bLimitAngle: false, LimitAngle: 0, CurrentAngle: 0, bAnglesArePercentages: false, bReversed: false, Damping: 1 } }],
  });
  const grid = w.addBrickGrid({ owner_index: O, location: { X: hinge[0], Y: hinge[1], Z: hinge[2] }, rotation: quat(k), sleeping: true, data: GRID_DATA });
  w.registerJoint(servo, grid, { X: 0, Y: 0, Z: 0 }, { X: 0, Y: 0, Z: 0, W: 1 });
  for (const ky of [-2, 2]) add({ asset: 'PB_DefaultMicroBrick', size: [2, 1, 2], position: [-25, ky, 28], direction: 4, rotation: 2, color: KNOB, collision: false }, grid);
  const panel = add({
    asset: 'PB_DefaultMicroBrick', size: [15, 1, 31], position: [-14, 0, 31], direction: 4, rotation: 2, color: d.color ?? DOOR_WOOD,
    components: [{ type: C.Switch.NAME, data: { bEnabled: true, InteractSound: 2, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: '' } }],
  }, grid);
  const sel = add({ asset: C.Expr_Select.BRICK, position: [-16, -3, 29], direction: 3, rotation: 0, ...hidden, components: [{ type: C.Expr_Select.NAME, data: { bSelectB: true, InputA: { $variant: 'f64', value: 90 }, InputB: { $variant: 'f64', value: 180 } } }] }, grid);
  wire(panel, 'Switch', 'bEnabled', sel, 'Expr_Select', 'bSelectB');
  wire(sel, 'Expr_Select', 'Output', servo, 'Servo', 'TargetAngle');
}
const out = opt('--out') ?? new URL('./tavistock_fixtures.brz', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.writeFileSync(out, w.toBrz({ bundle: { description: 'Tavistock fixtures: lamps, switches, doors' }, externalAssets: ASSETS }));
console.error(`fixtures: ${fixtures.rooms.length} switches, ${nLamps} lamps, ${fixtures.doors.length} doors -> ${out}`);
