// LOOT CHESTS (2026-10-28, owner built a chest in `ok` at -645,-441 (servo lid) and said: "make it so there's a
// chance it drops when you defeat enemies ... this button in the middle, when you click it, it pops open the chest
// ... there could be an item inside, when you click it, it will add that item to your inventory or bank ... then
// the chest despawns. Make the chest a physical prop ... only the skeleton spawn pool, not the pot pool").
//   node chest/gen.mjs -> chest/out/chest_<catalog id>.brz (one per bank weapon) + chest/loot.ws + chest/loot.brz
// chest_<id>.brz = the owner's chest (chest_owner.brz = SaveRegion with moving grids) as TWO loose physics grids:
//   body (owner's 23 micro bricks + front button + servo + hidden gates) and the lid (owner's lid grid, closed on top),
//   servo joint worked out for the closed lid (see the joint comment; lid rotation identity = closed = angle 0).
//   lock button bHeld -> edge -> Toggle -> Select(0 shut / OPEN) -> servo TargetAngle
//   item plate on the floor: the weapon's ItemSpawn (bank template, pickup off = display only) + a Button "Take <name>":
//     edge -> SendCustomEventGlobal "chest.take" (Character, catalog id) -> DestroySpawnedPrefab (this grid)
// loot.brz = sky chip at -8580 -7400 8000 (renderman): chest.take -> AddInventoryItemAdv with the shop's stats +
//   InvName0/InvPend, so skeleton_drop names the slot and its bank.inv unlocks the weapon in the bank for good.
// skeleton_drop (server bridge/balance/sd/skeleton_drop/gen.js) rolls CHEST_PCT per kill and spawns a random chest_<id>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const lib = await import(pathToFileURL(path.join(ROOT, 'tools', 'brs4', 'dist.mjs')).href);
const { World, WorldReader, brdb } = lib;
const C = brdb.COMPONENTS;
if (!World.prototype.registerJoint) throw Error('run node tools/patch_brs4.mjs first (joint links)');
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'weaponbank', 'itemcatalog.json'), 'utf8'));
export const IDS = CAT.map((e, i) => i + 1).filter(id => !/^soda_/.test(CAT[id - 1].prefab)); // the bank's weapons
const OPEN = Number(process.env.CHEST_OPEN ?? 120); // owner: "set its direction to the opposite"
const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const GRID_DATA = { BouyancyScale: 0.2, MassScale: 0.5, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: '' }; // the owner's lid

// ---- the owner's chest
const src = WorldReader.from(fs.readFileSync(path.join(here, 'chest_owner.brz')));
const A = src.brickAssets(), M = src.materials(), EXT = src.externalAssets();
const CENTER = [-645, -441, 638]; // body centre (x -665..-625, y -471..-411, z 624..652)
const near = b => Math.abs(b.position[0] - CENTER[0]) <= 24 && Math.abs(b.position[1] - CENTER[1]) <= 32 && b.position[2] >= 622 && b.position[2] <= 656;
const comps = new Map(); // world brick index -> components
for (const ci of src.brickChunkIndex(1)) for (const c of src.componentChunk(1, ci.index).components) (comps.get(c.brickIndex) ?? comps.set(c.brickIndex, []).get(c.brickIndex)).push(c);
const world = [...src.bricks(1)].map((b, i) => ({ ...b, i, asset: A[b.asset_name_index] })).filter(near);
const body = world.filter(b => b.asset === 'PB_DefaultMicroBrick');
const button = world.find(b => (comps.get(b.i) ?? []).some(c => c.typeName === 'Component_Button'));
const servo = world.find(b => b.asset === 'B_Joint_Servo_Micro');
if (body.length !== 23 || !button || !servo) throw Error(`chest_owner: ${body.length} body bricks, button ${!!button}, servo ${!!servo}`);
const lidGrid = src.gridIds().find(g => g !== 1);
const lid = [...src.bricks(lidGrid)].map(b => ({ ...b, asset: A[b.asset_name_index], position: b.position.map(v => v + 1024) })); // reader is 1024 off on moving grids
if (lid.length !== 55) throw Error(`chest_owner: lid ${lid.length}`);
const loc = p => p.map((v, k) => v - CENTER[k]);

// asset-reference fields in component data are indexes into the prefab's externalAssets
function build(id) {
  const e = CAT[id - 1];
  const tpl = WorldReader.from(fs.readFileSync(path.join(ROOT, 'weaponbank', 'items', `bankitem_${id}.brz`)));
  const tplExt = tpl.externalAssets();
  let spawn;
  for (const ci of tpl.brickChunkIndex(1)) for (const c of tpl.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') spawn = structuredClone(c.data);
  if (!spawn) throw Error(`bankitem_${id}: no ItemSpawn`);
  const ext = [...EXT, tplExt[Number(spawn.PickupClass)]];
  spawn.PickupClass = ext.length - 1;
  spawn.bPickupEnabled = false; spawn.bRenderTranslucentWhenDisabled = false; spawn.PickupScale = 0.8;

  const w = new World();
  const O = w.addOwner(MAP_OWNER);
  // owner: high servo torque holds the lid but "when you open it it flings itself": heavy body, light lid
  const B = w.addBrickGrid({ owner_index: O, location: { X: 0, Y: 0, Z: 0 }, sleeping: false, data: { ...GRID_DATA, MassScale: +(process.env.CHEST_BODY_MASS ?? 5) } });
  const L = w.addBrickGrid({ owner_index: O, location: { X: 0, Y: 0, Z: 24 }, sleeping: false, data: { ...GRID_DATA, MassScale: +(process.env.CHEST_LID_MASS ?? 0.1) } }); // lid closed: its rim (local z -10) on the body top (14)
  const add = (b, g) => w.addBrick({ owner_index: O, material_intensity: 5, ...b }, g);
  const copy = (b, g, p, components = []) => add({ asset: b.asset, size: b.size, position: p, direction: b.direction, rotation: b.rotation, color: b.color,
    material: M[b.material_index], collision: b.collision, visibility: b.visibility, components }, g);
  for (const b of body) copy(b, B, loc(b.position));
  const S = process.env.CHEST_STRIP ?? '';
  // the servo (body grid, local 19,-29,15) sits inside the lid's corner micro brick: jointed + overlapping = the physics
  // flings both grids. Servo collision off; CHEST_STRIP=corner also drops that lid brick
  for (const b of lid) if (!(S.includes('corner') && b.position.join() === '18,-28,-8')) copy(b, L, b.position);
  const lock = copy(button, B, loc(button.position), [{ type: 'Component_Button', data: { PressSound: 0, ReleaseSound: 1, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Open' } }]);
  const SV = loc(servo.position);
  const sv = copy({ ...servo, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } }, B, SV, [{ type: C.Servo.NAME, data: { bEnabled: true, TargetAngle: +(process.env.CHEST_T0 ?? 0), Power: 30000, ActiveDamping: 320, // owner 2026-10-28: "fixed this chest by setting its torque ridiculously high"
    ForceLimit: 0, bLimitAngle: false, LimitAngle: 0,
    CurrentAngle: 0, bAnglesArePercentages: false, bReversed: false, Damping: 1 } }]);
  // joint for the CLOSED lid (grid L, identity, origin (0,0,24)). Read off the owner's live chest (static servo at
  // angle 0): lid rotation = R * J, lid origin = servo + R * offset, with R mapping the servo's local Z (hinge axis)
  // to +Y. R = -90 deg about X -> J = conj(R) = +90 about X, offset = conj(R) d = (x, -z, y). (+90 about X = axis -Y:
  // the joint flipped the lid and flung both grids kilometres; the owner's saved values were taken with the lid elsewhere.)
  const d = [0 - SV[0], 0 - SV[1], 24 - SV[2]];
  if (!S.includes('joint')) w.registerJoint(sv, L, { X: d[0], Y: -d[2], Z: d[1] }, { X: Math.SQRT1_2, Y: 0, Z: 0, W: Math.SQRT1_2 });
  const plate = add({ asset: 'B_2x2f_Plate_Center', position: [0, 0, -8], direction: 4, rotation: 0, color: [90, 60, 30], components: [
    ...(S.includes('item') ? [] : [{ type: 'Component_ItemSpawn', data: spawn }]),
    { type: 'Component_Button', data: { PressSound: 0, ReleaseSound: 1, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: `Take ${e.name}` } }] }, B);

  // hidden gates inside the chest beside the item (a row under the floor stuck 60 out of the grid)
  // two columns x -11 / +11 (gate bricks are 10 wide: closer ones overlap and the game drops them), above the item plate
  let gi = 0;
  const gate = (c, data = {}, size) => { const h = add({ asset: c.BRICK, position: [gi % 2 ? 11 : -11, -20 + 10 * Math.floor(gi / 2), 4], direction: 4, rotation: 0, color: [200, 200, 200],
    visibility: false, collision: false, ...(size ? { size } : {}), components: [{ type: c.NAME, data }] }, B); gi++; return { h, c }; };
  const W = (a, ac, ap, b, bc, bp) => w.addWire({ brick: a, component_type: ac, port: ap }, { brick: b, component_type: bc, port: bp });
  const g = (x, p, y, q) => W(x.h, x.c.NAME, p, y.h, y.c.NAME, q);
  if (S.includes('gates')) { w.makePrefab({ isPhysicsGrid: process.env.CHEST_PHYS !== '0' }); return w.toBrz({ externalAssets: ext }); }
  const edge1 = gate(C.Expr_EdgeDetectorExec), tog = gate(C.Exec_Toggle);
  const sel = gate(C.Expr_Select, { bSelectB: false, InputA: { $variant: 'f64', value: 0 }, InputB: { $variant: 'f64', value: OPEN } });
  W(lock, 'Component_Button', 'bHeld', edge1.h, edge1.c.NAME, 'Input');
  g(edge1, 'OnRisingEdge', tog, 'Exec'); g(tog, 'Output', sel, 'bSelectB');
  W(sel.h, sel.c.NAME, 'Output', sv, C.Servo.NAME, 'TargetAngle');
  const edge2 = gate(C.Expr_EdgeDetectorExec);
  const send = gate(C.Exec_SendCustomEventGlobal, { EventName: 'chest.take', DataIn1: { $variant: 'f64', value: 0 }, DataIn2: { $variant: 'i64', value: id },
    ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(i => ['DataIn' + i, { $variant: 'f64', value: 0 }])) }, [5, 5, 2]);
  const grid = gate(C.ReadBrickGrid), kill = gate(C.Exec_Entity_DestroySpawnedPrefab);
  W(plate, 'Component_Button', 'bHeld', edge2.h, edge2.c.NAME, 'Input');
  W(plate, 'Component_Button', 'Character', send.h, send.c.NAME, 'DataIn1');
  g(edge2, 'OnRisingEdge', send, 'ExecIn'); g(send, 'ExecOut', kill, 'Exec'); g(grid, 'BrickGrid', kill, 'Entity');
  w.makePrefab({ isPhysicsGrid: process.env.CHEST_PHYS !== '0' });
  return w.toBrz({ externalAssets: ext, bundle: { description: `Loot chest: ${e.name}` } });
}

fs.mkdirSync(path.join(here, 'out'), { recursive: true });
if (process.env.CHEST_ONE) { fs.writeFileSync(path.join(here, 'out', 'test.brz'), build(+process.env.CHEST_ONE)); process.exit(0); }
for (const id of IDS) fs.writeFileSync(path.join(here, 'out', `chest_${id}.brz`), build(id));

// ---- the sky chip
const q = s => JSON.stringify(s);
const I = v => '$' + '{' + v + '}';
const advArgs = e => [e.damage != null && `damage = ${e.damage.toFixed(3)}`, e.speed != null && `speed = ${e.speed.toFixed(3)}`, e.scale != null && `scale = ${e.scale.toFixed(3)}`,
  `itemName = ${q(e.name)}`, e.colors && `overrideColors = true, meshColors = [${e.colors.map(([r, g, b]) => `ColorSRGB(${r}, ${g}, ${b}, 255)`).join(', ')}]`].filter(Boolean).join(', ');
const ws = `// generated by chest/gen.mjs: loot chests (see that file)
var names: Map<int, string> = { ${IDS.map(id => `${id}: ${q(CAT[id - 1].name)}`).join(', ')} }
on GlobalCustomEvent("chest.take") -> (who: character, id: int) {
  let pc = who.ControllerOf()
${IDS.map((id, p) => `  ${p ? '} else ' : ''}if id == ${id} {
    who.AddInventoryItemAdv($BRItemBase/${CAT[id - 1].item}, ${advArgs(CAT[id - 1])})`).join('\n')}
  }
  // skeleton_drop names the plain slot it finds next (as after a restart); its bank.inv then unlocks it in the bank
  pc.SetLeaderboard("InvName0", id)
${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => `  pc.SetLeaderboard("InvName${j}", 0)`).join('\n')}
  pc.SetLeaderboard("InvPend", 1)
  let nm = names.get(id)
  PrintToConsole("[chest] ${I('id')} ${I('nm')}")
  pc.ShowStatusMessage("<color=\\"ffd34d\\">${I('nm')}</> - yours now, and the bank remembers.")
}
`;
fs.writeFileSync(path.join(here, 'loot.ws'), ws);
const sdk = path.join(ROOT, 'tools', 'wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default.wirescript_compile;
const bytes = compile(ws, 'loot', '{}', '{}');
const { reown } = await import('../pots/reown.mjs');
fs.writeFileSync(path.join(here, 'loot.brz'), reown(bytes));
console.log(`wrote ${IDS.length} chests (open ${OPEN}) + loot.brz (${bytes.length} bytes)`);
