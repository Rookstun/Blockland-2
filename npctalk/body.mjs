// Talkable NPC body (owner 2026-10-15: "make a cylinder that follows and stays upright,
// invisible through components, and follow the npc and go somewhere unreachable until
// the entity respawns; also the dudes look horrible"). One prefab per NPC
// (omegga-npctalk/npcs.json), loaded with its origin at the NPC's spot:
//   br.Prefab.Load "npcbody_<id>" x y z 0 16
// - bot spawner: settings from npc_<role>.brz (npcgen.mjs) but a HUMAN costume (default
//   body parts, role hat/accessories, a face; npcgen had cloned the skeleton enemy's
//   parts), homed to its spot, wanders round it (owner: "expect him to wander around")
// - its own talk rod: a small prefab (ONE resized PB_DefaultPole, interaction collision only,
//   Interact "Talk to <name>" with ConsoleTag event:npctalk:<id> -> the npctalk plugin)
//   spawned 2 s after load by an Exec_PrefabSpawner, frozen and made invisible with
//   Entity_SetVisible; every 0.1 s it is set (upright) onto the bot while the bot is within
//   15 m of home, above ground and not the last one that died, else parked 400 m up
// - all gates hidden, no collision, floating 2.5 m above the spot 40 apart (at floor
//   level they overlapped the floor and each other and were rejected)
//   node npctalk/body.mjs <brs-js 4 dist.mjs> <outDir> [id...]   -> <outDir>/npcbody_<id>.brz
// env NPCS = another NPC list (quest NPCs: omegga-quests/npcs.json), TAG = Interact
// ConsoleTag event name (default npctalk), PREFIX = prefab name prefix. An NPC's `bot`
// object overrides spawner settings (Daniel: killable, 2 min respawn). Every death of
// the NPC's bot logs "[Wire Graph] quest.died|<id>|<killer user id>".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, outDir, ...only] = process.argv.slice(2);
const NPCS = JSON.parse(readFileSync(process.env.NPCS ?? new URL('../omegga-npctalk/npcs.json', import.meta.url)));
const TAG = process.env.TAG ?? 'npctalk', PREFIX = process.env.PREFIX ?? 'npcbody_';
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
mkdirSync(outDir, { recursive: true });

const OWNER = { id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' };
const ROD = { asset: 'PB_DefaultPole', size: [20, 20, 48] }; // ONE resized cylinder (owner: one interactable rod, not a stack)
const WANDER = { MovementAmount: 0.03, MovementRandomness: 60, HOME_R: 1500 }; // owner: they wander round their area
const TUBE_COLL = { player: false, weapon: false, interaction: true, tool: true, physics: false };
const NOCOLL = { player: false, weapon: false, interaction: false, tool: true, physics: false };
const PARK_UP = 40000;

// costumes: colours [torso, arms, legs, shoes], hats picked by id, optional accessories, face
const SKIN = [236, 194, 160];
const LOOK = {
  blacksmith: { c: [[96, 62, 36], [70, 70, 74], [44, 40, 38], [28, 20, 14]], hats: ['PPD_Hat_Bandana', 'PPD_Hat_Beanie', 'PPD_Hat_Builder'], torso: 'PPD_HalfVest', face: 'PDD_Face_Confident' },
  quartermaster: { c: [[30, 50, 110], [30, 50, 110], [70, 70, 76], [16, 16, 18]], hats: ['PPD_Hat_Officer'], torso: 'PPD_Bandolier', face: 'PDD_Face_Cool' },
  soda: { c: [[40, 190, 180], [240, 240, 240], [240, 120, 160], [240, 240, 240]], hats: ['PPD_Hat_Cap', 'PPD_Hat_Flat_Bill'], face: 'PDD_Face_Cute_Blush' },
  gunsmith: { c: [[92, 96, 58], [150, 120, 80], [60, 50, 40], [28, 20, 14]], hats: ['PPD_Hat_Cowboy'], torso: 'PPD_Bandolier', face: 'PDD_Face_Criminal' },
  barkeep: { c: [[230, 226, 214], [230, 226, 214], [70, 44, 30], [28, 20, 14]], hats: ['PPD_Hat_Paperboy', 'PPD_Hat_Flat_Bill', 'PPD_Hat_Beret', 'PPD_Hat_Fedora'], torso: 'PPD_HalfVest', face: 'PDD_Face_Chef' },
  crier: { c: [[110, 40, 130], [220, 180, 60], [40, 30, 50], [16, 16, 18]], hats: ['PPD_Hat_Bicorne'], face: 'PDD_Face_Confident' },
  farmer: { c: [[70, 120, 50], [200, 180, 130], [90, 70, 40], [40, 28, 18]], hats: ['PPD_Hat_Salakot', 'PPD_Hat_Bucket', 'PPD_Hat_Trapper'], belt: 'PPD_Cloth_Belt', face: 'PDD_Face_Cool' },
  townsfolk: { c: [[60, 90, 150], [60, 90, 150], [50, 50, 56], [28, 20, 14]], hats: ['PPD_Hat_Beret', 'PPD_Hat_Paperboy', 'PPD_Hat_PomPomBeanie', 'PPD_Hat_Bucket'], face: 'PDD_Face_Cute_Blush' },
  traveler: { c: [[130, 50, 50], [110, 90, 60], [70, 60, 50], [40, 28, 18]], hats: ['PPD_Hat_Hood', 'PPD_Hat_Fedora', 'PPD_Hat_Keffiyeh', 'PPD_Hat_Deerstalker'], pack: 'PPD_Adventure_Pack', belt: 'PPD_Cloth_Belt', face: 'PDD_Face_Confident' },
};
const rgba = ([r, g, b], a = 255) => ({ R: r, G: g, B: b, A: a });
function costume(npc, ext) {
  const L = LOOK[npc.role];
  const idx = (type, name) => { let i = ext.findIndex(e => e.type === type && e.name === name); if (i < 0) { ext.push({ type, name }); i = ext.length - 1; } return i; };
  const part = (socket, name, col, decal = null) => ({ PartDescriptor: idx('BRPlayerPartDescriptor', name), DecalDescriptor: decal === null ? null : idx('BRPlayerDecalDescriptor', decal),
    SocketName: socket, Colors: Array.from({ length: 8 }, (_, i) => rgba(i === 0 ? col : [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8].map(Math.round))) });
  const [torso, arms, legs, shoes] = L.c, hat = L.hats[npc.id % L.hats.length], acc = L.c[1];
  const parts = [
    part('Part_Torso', 'PPD_Default_Torso', torso), part('Part_Head', 'PPD_Default_Head', SKIN, L.face),
    ...['R', 'L'].flatMap(s => [part(`Part_Arm_${s}`, 'PPD_Default_Arm', arms), part(`Part_Wrist_${s}`, 'PPD_Default_Wrist', arms), part(`Part_Hand_${s}`, 'PPD_Default_Hand', SKIN),
      part(`Part_Leg_${s}`, 'PPD_Default_Leg', legs), part(`Part_Ankle_${s}`, 'PPD_Default_Ankle', legs), part(`Part_Shoe_${s}`, 'PPD_Default_Shoe', shoes)]),
    part('Part_Hat', hat, acc),
  ];
  if (L.torso) parts.push(part('Part_Torso_Accessory', L.torso, acc));
  if (L.pack) parts.push(part('Part_Pack_Accessory', L.pack, acc));
  if (L.belt) parts.push(part('Part_Belt_Accessory', L.belt, [60, 44, 30]));
  return { Parts: parts };
}

function roleSpawner(role) {
  const r = lib.WorldReader.from(new Uint8Array(readFileSync(new URL(`roles/npc_${role}.brz`, import.meta.url))));
  const brick = [...r.bricks(1)][0];
  let data;
  for (const ref of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ref.index).components) if (c.typeName === 'Component_BotSpawn') data = c.data;
  return { brick, data, ext: [...r.externalAssets()] };
}

function tubePrefab(npc) {
  const w = new lib.World();
  const o = w.addOwner(OWNER);
  w.addBrick({ asset: ROD.asset, size: ROD.size, position: [0, 0, 0], color: [90, 220, 255], material: 'BMC_Hologram', collision: TUBE_COLL, owner_index: o,
    components: [{ type: 'Component_Interact', data: { InteractSound: null, Message: '', ConsoleTag: `event:${TAG}:${npc.id}`, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: `Talk to ${npc.name}` } }] });
  w.makePrefab({});
  return w.toBrz({ bundle: { description: `talk rod ${npc.name}` } });
}

for (const npc of NPCS) {
  if (only.length && !only.includes(String(npc.id))) continue;
  const role = roleSpawner(npc.role);
  const ext = role.ext;
  const k = await mk(dist, { owner: OWNER, mainBase: [-220, 60], rowStep: 40, baseZ: 250 });
  const { w, C, wire } = k;
  const hidden = { visibility: false, collision: NOCOLL };
  const gate = (c, data = {}) => k.gate(c, data, undefined, hidden);
  const K = v => [gate(C.Var, { Value: k.num(v) }), 'Value'];
  const [sx, sy, sz] = npc.at;

  const sp = { h: w.addBrick({ asset: 'B_Bot_Spawn_Point', position: [0, 0, 2], rotation: role.brick.rotation, direction: 4, color: [255, 255, 255],
    visibility: false, collision: role.brick.collision, owner_index: k.ownerIdx,
    components: [{ type: 'Component_BotSpawn', data: { ...role.data, BotName: npc.name, Skin: costume(npc, ext),
      MovementAmount: WANDER.MovementAmount, MovementRandomness: WANDER.MovementRandomness, MoveTarget: { X: sx, Y: sy, Z: sz }, ...npc.bot } }] }), c: C.BotSpawn };

  // spawn the talk cylinder once, invisible + frozen, keep its entity
  const sw = gate(C.Stopwatch, { Limit: 2, Time: 0, bRunning: true });
  const edge = gate(C.Expr_EdgeDetectorExec); wire(sw, 'Expired', edge, 'Input');
  const spawn = gate(C.Exec_PrefabSpawner, { Prefab: w.addPrefab(tubePrefab(npc)), SpawnOffset: { X: 0, Y: 0, Z: 0 }, SpawnOffsetRotation: { Pitch: 0, Yaw: 0, Roll: 0 },
    SpawnVelocity: { X: 0, Y: 0, Z: 0 }, Lifetime: 0, Limit: 1, SpawnedEntityIds: [], SpawnedInstanceIds: [] });
  wire(edge, 'OnRisingEdge', spawn, 'Exec');
  const tube = gate(C.Var, { Value: k.num(0) });
  const keep = gate(C.Exec_Var_Set, { bChangeType: true }); wire(tube, 'VarRef', keep, 'VarRef'); wire(spawn, 'Entity', keep, 'Value'); wire(spawn, 'ExecOut', keep, 'Exec');
  const freeze = gate(C.Exec_Entity_SetFrozen, { bFrozen: true }); wire(keep, 'ExecOut', freeze, 'Exec'); wire(spawn, 'Entity', freeze, 'Entity');
  const hide = gate(C.Exec_Entity_SetVisible, { bVisible: false }); wire(freeze, 'ExecOut', hide, 'Exec'); wire(spawn, 'Entity', hide, 'Entity');

  // the last bot of this spawner that died (so a corpse is not followed)
  const dead = gate(C.Var, { Value: k.num(0) });
  const died = gate(C.Event_Gamemode_CharacterDied);
  const isMine = gate(C.Expr_CompareEqual); wire(died, 'Character', isMine, 'InputA'); wire(sp, 'SpawnedCharacter', isMine, 'InputB');
  const mineB = gate(C.Exec_Branch); wire(isMine, 'bOutput', mineB, 'bCond'); wire(died, 'ExecOut', mineB, 'Exec');
  const markDead = gate(C.Exec_Var_Set, { bChangeType: true }); wire(dead, 'VarRef', markDead, 'VarRef'); wire(died, 'Character', markDead, 'Value'); wire(mineB, 'ExecOutA', markDead, 'Exec');
  // who killed it -> log (quests plugin)
  const kps = gate(C.Exec_PlayerState_GetFromEntity); wire(markDead, 'ExecOut', kps, 'Exec'); wire(died, 'Killer', kps, 'Entity');
  const kid = gate(C.Exec_PlayerState_GetUserId); wire(kps, 'ExecOut', kid, 'Exec'); wire(kps, 'PlayerState', kid, 'PlayerState');
  const kf = gate(C.Expr_String_FormatText, { FormatString: `quest.died|${npc.id}|{A}` }); wire(kid, 'UserId', kf, 'InputA');
  const kp = gate(C.Exec_PrintToConsole, { Text: '' }); wire(kf, 'Output', kp, 'Text'); wire(kid, 'ExecOut', kp, 'Exec');

  // every 0.1 s: on the bot (upright) while it stands at its spot alive, else parked out of reach
  const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.05, OffTimeSeconds: 0.05, IntervalSeconds: 0.1 });
  const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
  const loc = gate(C.Exec_Entity_GetLocation); wire(tick, 'OnRisingEdge', loc, 'Exec'); wire(sp, 'SpawnedCharacter', loc, 'Entity');
  const vec = (x, y, z) => { const v = gate(C.Expr_MakeVector); wire(...K(x), v, 'X'); wire(...K(y), v, 'Y'); wire(...K(z), v, 'Z'); return [v, 'Output']; };
  const away = gate(C.Expr_VecDistance); wire(loc, 'Vector', away, 'InputA'); wire(...vec(sx, sy, sz + 40), away, 'InputB');
  const nearHome = gate(C.Expr_CompareLess); wire(away, 'Output', nearHome, 'InputA'); wire(...K(WANDER.HOME_R), nearHome, 'InputB');
  // an unspawned bot reads as (0,0,0): every spot is far above that
  const lz = gate(C.Expr_SplitVector); wire(loc, 'Vector', lz, 'Input');
  const up = gate(C.Expr_CompareGreater); wire(lz, 'Z', up, 'InputA'); wire(...K(sz - 300), up, 'InputB');
  const near = gate(C.Expr_LogicalAND); wire(nearHome, 'bOutput', near, 'bInputA'); wire(up, 'bOutput', near, 'bInputB');
  const alive = gate(C.Expr_CompareNotEqual); wire(sp, 'SpawnedCharacter', alive, 'InputA'); wire(dead, 'Value', alive, 'InputB');
  const ok = gate(C.Expr_LogicalAND); wire(near, 'bOutput', ok, 'bInputA'); wire(alive, 'bOutput', ok, 'bInputB');
  const br = gate(C.Exec_Branch); wire(ok, 'bOutput', br, 'bCond'); wire(loc, 'ExecOut', br, 'Exec');
  const follow = gate(C.Exec_Entity_SetLocationRotation); wire(br, 'ExecOutA', follow, 'Exec'); wire(tube, 'Value', follow, 'Entity'); wire(loc, 'Vector', follow, 'Vector');
  const park = gate(C.Exec_Entity_SetLocationRotation); wire(br, 'ExecOutB', park, 'Exec'); wire(tube, 'Value', park, 'Entity'); wire(...vec(sx, sy, sz + PARK_UP), park, 'Vector');

  w.makePrefab({});
  writeFileSync(`${outDir}/${PREFIX}${npc.id}.brz`, w.toBrz({ bundle: { description: `NPC ${npc.name}` }, externalAssets: ext }));
}
console.log(`${only.length || NPCS.length} NPC bodies -> ${outDir}`);
