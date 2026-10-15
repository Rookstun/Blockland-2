// Talkable NPC body (owner 2026-10-15: "these npcs need like a cylinder with no
// hitbox on them that follows them"). One prefab per NPC (omegga-npctalk/npcs.json):
//   - its bot spawner: costume + settings from npc_<role>.brz (npcgen.mjs), homed to its spot
//   - a glowing hologram tube (7 x B_4x4_Round, no collision) spawned 2 s after load by an
//     Exec_PrefabSpawner, frozen, and moved onto the bot every 0.1 s (Entity_SetLocation)
//   - every 2 s the bot's position goes to the log ("npc.pos|<id>|<vector>") so the npctalk
//     plugin's talk radius follows NPCs that wander
// All gate bricks are hidden with no collision. Load each with its origin at the NPC's spot:
//   node npctalk/body.mjs <brs-js 4 dist.mjs> <outDir> [id...]   -> <outDir>/npcbody_<id>.brz
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, outDir, ...only] = process.argv.slice(2);
const NPCS = JSON.parse(readFileSync(new URL('../omegga-npctalk/npcs.json', import.meta.url)));
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
mkdirSync(outDir, { recursive: true });

const TUBE = { asset: 'B_4x4_Round', n: 7, color: [90, 220, 255], material: 'BMC_Hologram' };
const NOCOLL = { player: false, weapon: false, interaction: false, tool: true, physics: false };

function tubePrefab() {
  const w = new lib.World();
  const o = w.addOwner({ id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' });
  for (let i = 0; i < TUBE.n; i++)
    w.addBrick({ asset: TUBE.asset, position: [0, 0, (i - (TUBE.n - 1) / 2) * 12], color: TUBE.color, material: TUBE.material, material_intensity: 3, collision: NOCOLL, owner_index: o });
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'NPC tube' } });
}
const TUBE_BYTES = tubePrefab();

function roleSpawner(role) {
  const r = lib.WorldReader.from(new Uint8Array(readFileSync(new URL(`roles/npc_${role}.brz`, import.meta.url))));
  const brick = [...r.bricks(1)][0];
  let data;
  for (const ref of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ref.index).components) if (c.typeName === 'Component_BotSpawn') data = c.data;
  return { brick, data, ext: r.externalAssets() };
}

for (const npc of NPCS) {
  if (only.length && !only.includes(String(npc.id))) continue;
  const role = roleSpawner(npc.role);
  const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' }, mainBase: [-60, -60], rowStep: -20 });
  const { w, C, wire } = k;
  const hidden = { visibility: false, collision: NOCOLL };
  const gate = (c, data = {}) => k.gate(c, data, undefined, hidden);
  // the spawner, at the prefab origin = the spot
  const sp = { h: w.addBrick({ asset: 'B_Bot_Spawn_Point', position: [0, 0, 2], rotation: role.brick.rotation, direction: 4, color: [255, 255, 255],
    visibility: false, collision: role.brick.collision, owner_index: k.ownerIdx,
    components: [{ type: 'Component_BotSpawn', data: { ...role.data, MoveTarget: { X: npc.at[0], Y: npc.at[1], Z: npc.at[2] } } }] }), c: C.BotSpawn };
  // spawn the tube once, freeze it, keep its entity
  const tubePath = w.addPrefab(TUBE_BYTES);
  const sw = gate(C.Stopwatch, { Limit: 2, Time: 0, bRunning: true });
  const edge = gate(C.Expr_EdgeDetectorExec); wire(sw, 'Expired', edge, 'Input');
  const spawn = gate(C.Exec_PrefabSpawner, { Prefab: tubePath, SpawnOffset: { X: 0, Y: 0, Z: 60 }, SpawnOffsetRotation: { Pitch: 0, Yaw: 0, Roll: 0 }, SpawnVelocity: { X: 0, Y: 0, Z: 0 }, Lifetime: 0, Limit: 1, SpawnedEntityIds: [], SpawnedInstanceIds: [] });
  wire(edge, 'OnRisingEdge', spawn, 'Exec');
  const tube = gate(C.Var, { Value: { $variant: 'weak_object', value: null } });
  const keep = gate(C.Exec_Var_Set, { bChangeType: true }); wire(tube, 'VarRef', keep, 'VarRef'); wire(spawn, 'Entity', keep, 'Value');
  wire(spawn, 'ExecOut', keep, 'Exec');
  const freeze = gate(C.Exec_Entity_SetFrozen, { bFrozen: true }); wire(keep, 'ExecOut', freeze, 'Exec'); wire(spawn, 'Entity', freeze, 'Entity');
  // follow: every 0.1 s tube location = bot location
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.05, OffTimeSeconds: 0.05, IntervalSeconds: 0.1 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const loc = gate(C.Exec_Entity_GetLocation); wire(tick, 'OnRisingEdge', loc, 'Exec'); wire(sp, 'SpawnedCharacter', loc, 'Entity');
  const move = gate(C.Exec_Entity_SetLocation); wire(loc, 'ExecOut', move, 'Exec'); wire(tube, 'Value', move, 'Entity'); wire(loc, 'Vector', move, 'Vector');
  // report: every 2 s where the bot is
  const slow = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 1, OffTimeSeconds: 1, IntervalSeconds: 2 });
  const stick = gate(C.Expr_EdgeDetectorExec); wire(slow, 'Pulse', stick, 'Input');
  const loc2 = gate(C.Exec_Entity_GetLocation); wire(stick, 'OnRisingEdge', loc2, 'Exec'); wire(sp, 'SpawnedCharacter', loc2, 'Entity');
  const fmt = gate(C.Expr_String_FormatText, { FormatString: `npc.pos|${npc.id}|{A}` });
  const say = gate(C.Exec_PrintToConsole, { Text: '' }); wire(fmt, 'Output', say, 'Text');
  wire(loc2, 'ExecOut', say, 'Exec'); wire(loc2, 'Vector', fmt, 'InputA');
  w.makePrefab({});
  const bytes = w.toBrz({ bundle: { description: `NPC ${npc.name}` }, externalAssets: role.ext });
  writeFileSync(`${outDir}/npcbody_${npc.id}.brz`, bytes);
  console.log(`npcbody_${npc.id}.brz ${npc.name} (${npc.role}) ${bytes.length} bytes`);
}
