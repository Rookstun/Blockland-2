// Two melee bots that fight each other (owner 2026-10-28: vanilla dedicated server, 2 bots melee).
// Floor + 2 hidden spawners (Longsword vs Zweihander), bCanTargetBots, MoveTarget = own spot (homed).
//   node vanilla/duel.mjs <brs-js 4 dist.mjs> <out.brz>
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [dist, out] = process.argv.slice(2);
const lib = await import(pathToFileURL(dist).href);
const r = lib.WorldReader.from(new Uint8Array(readFileSync(new URL('../npctalk/roles/base_derringer.brz', import.meta.url))));
let base;
for (const ref of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ref.index).components) if (c.typeName === 'Component_BotSpawn') base = c.data;
const ext = [...r.externalAssets()];
const OWNER = { id: 'd0e1a5e0-0000-4b0b-9a11-0000000d0e11', name: 'Duel', display_name: 'Duel' };
const w = new lib.World();
const o = w.addOwner(OWNER);
w.addBrick({ asset: 'PB_DefaultBrick', size: [600, 600, 6], position: [0, 0, 6], color: [90, 90, 90], owner_index: o });
const sides = [{ name: 'Sir Hack', weapon: process.env.W1 || 'Weapon_Longsword', x: -150 }, { name: 'Lord Slash', weapon: process.env.W2 || 'Weapon_Zweihander', x: 150 }];
for (const s of sides) {
  ext.push({ type: 'BRItemBase', name: s.weapon });
  w.addBrick({ asset: 'B_Bot_Spawn_Point', position: [s.x, 0, 14], direction: 4, rotation: 0, color: [255, 255, 255], visibility: false,
    collision: { player: false, weapon: false, interaction: false, tool: true, physics: false }, owner_index: o,
    components: [{ type: 'Component_BotSpawn', data: { ...base, BotName: s.name, BotWeapon: ext.length - 1, HealthMultiplier: 1, AttackDamageMultiplier: 1,
      bCanTargetBots: true, bCanTargetPlayers: false, AggroRange: 300, RespawnTime: 5, MovementAmount: 0.3, MovementRandomness: 20, AttackMovementAmount: 1,
      Agression: 1, TeamCollisionChannel: s.x < 0 ? 1 : 2, MoveTarget: { X: s.x, Y: 0, Z: 14 } } }] });
}
w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'melee duel' }, externalAssets: ext }));
console.log('wrote', out);
