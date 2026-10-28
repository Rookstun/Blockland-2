// ENEMY WEAPON DROPS (2026-10-28, owner: "remove chests for now and just make a weapon spawn from enemies and give
// them a certain drop pool for each based on their tiers"; no spathas/sabres ever: "THEY ARE BROKEN").
//   node weapondrop/gen.mjs -> weapondrop/out/wd_<catalog id>.brz + weapondrop/out/wd_pools.json
// wd_<id>.brz = the arrows pickup pattern (pots/ammopickup.mjs): one loose physics grid, hidden gates:
//   ReadBrickGrid + the weapon's ItemSpawn (bank template = shop stand settings, pickup ON) + gyroscope,
//   bShowPickupEnabled -> NOT -> DestroySpawnedPrefab (gone once picked up).
// wd_pools.json = [{ maxHp, ids }] by enemy max health (100 x balance health); skeleton_drop (server
// bridge/balance/sd/skeleton_drop/gen.js) rolls WEAPON_PCT per bot kill and tosses one from the first pool with lim <= maxHp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const { World, WorldReader } = await import(pathToFileURL(path.join(ROOT, 'tools', 'brs4', 'dist.mjs')).href);
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
const NOT = 'BrickComponentType_Expr_LogicalNOT', RG = 'BrickComponentType_Internal_ReadBrickGrid';
const DS = 'BrickComponentType_Exec_Entity_DestroySpawnedPrefab', IS = 'Component_ItemSpawn';
function build(cid) {
  const tpl = WorldReader.from(fs.readFileSync(path.join(ROOT, 'weaponbank', 'items', `bankitem_${cid}.brz`)));
  let spawn;
  for (const ci of tpl.brickChunkIndex(1)) for (const c of tpl.componentChunk(1, ci.index).components) if (c.typeName === IS) spawn = structuredClone(c.data);
  if (!spawn) throw Error(`bankitem_${cid}: no ItemSpawn`);
  const ext = [tpl.externalAssets()[Number(spawn.PickupClass)]];
  Object.assign(spawn, { PickupClass: 0, bPickupEnabled: true, bPickupAutoDisableOnPickup: true, bRenderTranslucentWhenDisabled: true, PickupScale: 1 });
  const w = new World();
  const O = w.addOwner(MAP_OWNER);
  // loose grids need gravity data (the writer's default is antigravity)
  const g = w.addBrickGrid({ location: { X: 0, Y: 0, Z: 0 }, frozen: false, owner_index: O,
    data: { BouyancyScale: 0.2, MassScale: 0.1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: '' } });
  const hidden = { owner_index: O, visibility: false, collision: false };
  const destroy = w.addBrick({ asset: 'B_1x1_Gate_Exec_Entity_DestroySpawnedPrefab', position: [0, 0, -4], ...hidden, components: [{ type: DS, data: {} }] }, { grid: g.grid });
  const core = w.addBrick({ asset: 'B_1x1_Gate_Internal_ReadBrickGrid', position: [0, 0, 0], ...hidden, components: [
    { type: RG, data: {} }, { type: IS, data: spawn },
    { type: 'Component_Internal_Gyroscope', data: { bEnabled: true, bDiscoverable: true, Strength: 25, Damping: 1, MaxForce: 0, TargetAxis: { X: 0, Y: 0, Z: 1 } } }] }, { grid: g.grid });
  const not = w.addBrick({ asset: 'B_1x1_Gate_Expr_LogicalNOT', position: [0, 0, 4], ...hidden, components: [{ type: NOT, data: { bInput: true } }] }, { grid: g.grid });
  const P = (brick, component_type, port) => ({ brick, component_type, port });
  w.addWire(P(core, IS, 'bShowPickupEnabled'), P(not, NOT, 'bInput'));
  w.addWire(P(not, NOT, 'bOutput'), P(destroy, DS, 'Exec'));
  w.addWire(P(core, RG, 'BrickGrid'), P(destroy, DS, 'Entity'));
  w.makePrefab({ isPhysicsGrid: true });
  return w.toBrz({ externalAssets: ext });
}

const OUT = path.join(here, 'out');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const all = [...new Set(POOLS.flatMap(p => p.ids))];
for (const cid of all) fs.writeFileSync(path.join(OUT, `wd_${cid}.brz`), build(cid));
fs.writeFileSync(path.join(OUT, 'wd_pools.json'), JSON.stringify(POOLS));
console.log(`wrote ${all.length} weapon pickups, pools ${POOLS.map(p => `<=${p.maxHp}:${p.ids.length}`).join(' ')}`);
