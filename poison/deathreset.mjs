// Poison Duration (leaderboard, set by the owner's "Poison on Damage" chip) survived death.
// Standalone chip, no edits to the owner's chip (brs-js 4 can't re-write its GetLeaderboardValue struct):
//   CharacterDied / CharacterSpawned -> PlayerState_GetFromEntity -> SetLeaderboardValue "Poison Duration" = 0
//   node poison/deathreset.mjs out.brz
import fs from 'fs';
const m = await import(new URL('../tools/brs4/dist.mjs', import.meta.url));
const C = m.brdb.COMPONENTS, w = new m.World();
const O = w.addOwner({ id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'abysmal garbage' });
// house rule: chip bricks invisible + no collision (addMicrochip can't, build by hand)
const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [0, 0, 2], owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 20 },
  data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 30, Y: 30, Z: 2 } } });
w.registerMicrochipLink(chipBrick, grid);
const gate = (c, data, pos) => ({ h: w.addBrick({ asset: c.BRICK, position: pos, color: [204, 166, 120], owner_index: O, components: [{ type: c.NAME, data }] }, grid), c });
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
[[C.Event_Gamemode_CharacterDied, -20], [C.Event_Gamemode_CharacterSpawned, 20]].forEach(([ev, y]) => {
  const e = gate(ev, {}, [-40, y, 2]);
  const ps = gate(C.Exec_PlayerState_GetFromEntity, {}, [0, y, 2]);
  const set = gate(C.Exec_Gamemode_SetLeaderboardValue, { Key: 'Poison Duration', Value: 0 }, [40, y, 2]);
  wire(e, 'ExecOut', ps, 'Exec'); wire(e, 'Character', ps, 'Entity');
  wire(ps, 'ExecOut', set, 'Exec'); wire(ps, 'PlayerState', set, 'PlayerState');
});
w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: 'Poison reset on death/respawn' } });
fs.writeFileSync(process.argv[2], bytes);
console.log(process.argv[2], bytes.length, 'bytes');
