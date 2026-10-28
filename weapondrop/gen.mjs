// ENEMY WEAPON DROPS (2026-10-28, owner: "remove chests for now and just make a weapon spawn from enemies and give
// them a certain drop pool for each based on their tiers"; no spathas/sabres ever: "THEY ARE BROKEN").
//   node weapondrop/gen.mjs -> weapondrop/out/wd_<catalog id>.brz + weapondrop/out/wd_pools.json
// wd_<id>.brz = one loose physics grid: an invisible base brick (physics collision) carrying the weapon's ItemSpawn
//   (bank template = shop stand settings, pickup OFF = display) + gyroscope, and an invisible sensor brick around the
//   item (interaction only) with Button "Take <name>".
//   (owner: "they need to be bank items": a plain pickup can't tell who took it, so nothing names the slot)
//   click -> edge -> Var_Set taken -> edge (once) -> SendCustomEventGlobal chest.take (Character, catalog id)
//   -> DestroySpawnedPrefab. The loot sky chip (chest/gen.mjs, -8580 -7400 8000) gives the weapon with the shop's
//   stats + InvName0/InvPend, skeleton_drop names the slot and its bank.inv unlocks it in the bank.
// wd_pools.json = [{ maxHp, ids }] by enemy max health (100 x balance health); skeleton_drop (server
// bridge/balance/sd/skeleton_drop/gen.js) rolls WEAPON_PCT per bot kill and tosses one from the first pool with lim <= maxHp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const { World, WorldReader, brdb } = await import(pathToFileURL(path.join(ROOT, 'tools', 'brs4', 'dist.mjs')).href);
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'weaponbank', 'itemcatalog.json'), 'utf8'));
const id = name => { const i = CAT.findIndex(e => e.name === name); if (i < 0) throw Error(`not in catalog: ${name}`); return i + 1; };
const metal = (...tiers) => tiers.flatMap(t => ['Dagger', 'Sword', '2h Sword', 'Longsword'].map(k => `${t} ${k}`));
// enemy max HP: goblin 35, handaxe 50, wood goblin 55 | swamp zombie 60, wizard 65, arming 75, homeless 90/95 |
// spear 125, bloated 130 | longsword 200, bow 250 | zweihander 350 | battleaxe 500
const POOLS = [
  { maxHp: 55, names: [...metal('Bronze'), 'Bow', 'Derringer', 'Guard Pistol'] },
  { maxHp: 99, names: [...metal('Bronze', 'Iron'), 'Oak Bow', 'Revolver'] },
  { maxHp: 150, names: [...metal('Iron', 'Steel'), 'Willow Bow', 'Hunting Shotgun'] },
  { maxHp: 300, names: [...metal('Steel', 'Black', 'Mithril'), 'Maple Bow', 'Lever-Action Rifle'] },
  { maxHp: 400, names: [...metal('Mithril', 'Adamant'), 'Yew Bow', 'Bolt-Action Rifle'] },
  { maxHp: 4999, names: [...metal('Adamant', 'Rune'), 'Magic Bow', 'Magnum'] },
].map(p => ({ maxHp: p.maxHp, ids: p.names.map(id) }));
for (const p of POOLS) for (const i of p.ids) if (['Weapon_Spatha', 'Weapon_Sabre'].includes(CAT[i - 1].item)) throw Error('spatha/sabre in a pool');

const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const C = brdb.COMPONENTS;
function build(cid) {
  const tpl = WorldReader.from(fs.readFileSync(path.join(ROOT, 'weaponbank', 'items', `bankitem_${cid}.brz`)));
  let spawn;
  for (const ci of tpl.brickChunkIndex(1)) for (const c of tpl.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') spawn = structuredClone(c.data);
  if (!spawn) throw Error(`bankitem_${cid}: no ItemSpawn`);
  const ext = [tpl.externalAssets()[Number(spawn.PickupClass)]];
  Object.assign(spawn, { PickupClass: 0, bPickupEnabled: false, bRenderTranslucentWhenDisabled: false, PickupScale: 1, PickupOffsetDistance: 0 });
  const w = new World();
  const O = w.addOwner(MAP_OWNER);
  // loose grids need gravity data (the writer's default is antigravity)
  const G = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: false, owner_index: O,
    data: { BouyancyScale: 0.2, MassScale: 0.1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: '' } });
  const add = b => w.addBrick({ owner_index: O, direction: 4, rotation: 0, color: [200, 200, 200], ...b }, G);
  // owner: "one block for the item to be on, one block for the click sensor": the item sits on `base` (physics only),
  // `sensor` around the item takes the click (interaction only); both invisible
  const base = add({ asset: 'PB_DefaultMicroBrick', size: [6, 6, 2], position: [0, 0, 0], visibility: false,
    collision: { player: false, weapon: false, interaction: false, tool: true, physics: true }, components: [
    { type: 'Component_ItemSpawn', data: { ...spawn, PickupOffsetDirection: 4, PickupOffsetDistance: 16 } },
    { type: 'Component_Internal_Gyroscope', data: { bEnabled: true, bDiscoverable: true, Strength: 25, Damping: 1, MaxForce: 0, TargetAxis: { X: 0, Y: 0, Z: 1 } } }] });
  const sensor = add({ asset: 'PB_DefaultMicroBrick', size: [10, 10, 14], position: [0, 0, 16], visibility: false,
    collision: { player: false, weapon: false, interaction: true, tool: true, physics: false }, components: [
    { type: 'Component_Button', data: { PressSound: null, ReleaseSound: null, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: `Take ${CAT[cid - 1].name}` } }] });
  // hidden gates in a ring round the base (gate bricks are 10 wide; a column under it hung 100 into the ground)
  const RING = [[12, 0], [-12, 0], [0, 12], [0, -12], [12, 12], [-12, 12], [12, -12], [-12, -12]];
  let gi = 0;
  const gate = (c, data = {}, size) => ({ h: add({ asset: c.BRICK, position: [...RING[gi++], 0], visibility: false, collision: false, ...(size ? { size } : {}), components: [{ type: c.NAME, data }] }), c });
  const W = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: ap }, { brick: b.h, component_type: b.c.NAME, port: bp });
  const btn = { h: sensor, c: { NAME: 'Component_Button' } };
  const edge = gate(C.Expr_EdgeDetectorExec), set = gate(C.Exec_Var_Set, { Value: { $variant: 'bool', value: true } });
  const taken = gate(C.Var, { Value: { $variant: 'bool', value: false } }), once = gate(C.Expr_EdgeDetectorExec);
  const send = gate(C.Exec_SendCustomEventGlobal, { EventName: 'chest.take', DataIn1: { $variant: 'f64', value: 0 }, DataIn2: { $variant: 'i64', value: cid },
    ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(i => ['DataIn' + i, { $variant: 'f64', value: 0 }])) }, [5, 5, 2]);
  const grid = gate(C.ReadBrickGrid), kill = gate(C.Exec_Entity_DestroySpawnedPrefab);
  W(btn, 'bHeld', edge, 'Input'); W(edge, 'OnRisingEdge', set, 'Exec'); W(taken, 'VarRef', set, 'VarRef');
  W(taken, 'Value', once, 'Input'); W(btn, 'Character', send, 'DataIn1'); W(once, 'OnRisingEdge', send, 'ExecIn');
  W(send, 'ExecOut', kill, 'Exec'); W(grid, 'BrickGrid', kill, 'Entity');
  w.makePrefab({ isPhysicsGrid: true });
  return w.toBrz({ externalAssets: ext });
}

const OUT = path.join(here, 'out');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const all = [...new Set(POOLS.flatMap(p => p.ids))];
for (const cid of all) fs.writeFileSync(path.join(OUT, `wd_${cid}.brz`), build(cid));
fs.writeFileSync(path.join(OUT, 'wd_pools.json'), JSON.stringify(POOLS));
console.log(`wrote ${all.length} weapon pickups, pools ${POOLS.map(p => `<=${p.maxHp}:${p.ids.length}`).join(' ')}`);
