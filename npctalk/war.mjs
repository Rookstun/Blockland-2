// THE HOMELESS WAR (owner 2026-10-18: "make the fire homeless people and the water homeless
// people at war"). Two camps at the swamp (npctalk/war.json): Fire Homeless on the dry slope
// north of it, Water Homeless in the swamp. Each spot = one hidden bot spawner prefab
// (war_fire / war_water) loaded on its own (ground there is bumpy). They target bots, not
// players (bCanTargetBots: they may also swing at their own side and at passing skeletons),
// march on the battlefield between the camps (MoveTarget, MovementAmount 0.3) and respawn
// every 30 s, so the war never ends. Max health 90 / 95 (skeleton_drop names them).
// Owner "Homeless War" ea32a1c0-0000-4b0b-9a11-00000000f1e0 (clear: br.Bricks.Clear <id> 1).
//   node npctalk/war.mjs <brs-js 4 dist.mjs> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [dist, outDir] = process.argv.slice(2);
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
const WAR = JSON.parse(readFileSync(new URL('war.json', import.meta.url)));
mkdirSync(outDir, { recursive: true });
const OWNER = { id: 'ea32a1c0-0000-4b0b-9a11-00000000f1e0', name: 'Homeless War', display_name: 'Homeless War' };
const SKIN = [236, 194, 160];
const rgba = ([r, g, b]) => ({ R: r, G: g, B: b, A: 255 });

function base(file) {
  const r = lib.WorldReader.from(new Uint8Array(readFileSync(new URL(`roles/${file}`, import.meta.url))));
  const brick = [...r.bricks(1)][0];
  let data;
  for (const ref of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ref.index).components) if (c.typeName === 'Component_BotSpawn') data = c.data;
  return { brick, data, ext: [...r.externalAssets()] };
}
function skin(side, ext) {
  const idx = (type, name) => { let i = ext.findIndex(e => e.type === type && e.name === name); if (i < 0) { ext.push({ type, name }); i = ext.length - 1; } return i; };
  const part = (socket, name, col, decal = null) => ({ PartDescriptor: idx('BRPlayerPartDescriptor', name), DecalDescriptor: decal === null ? null : idx('BRPlayerDecalDescriptor', decal),
    SocketName: socket, Colors: Array.from({ length: 8 }, (_, i) => rgba(i === 0 ? col : col.map(v => Math.round(v * 0.7)))) });
  const [torso, arms, legs, shoes, hatC] = side.colors;
  return { Parts: [
    part('Part_Torso', 'PPD_Default_Torso', torso), part('Part_Head', 'PPD_Default_Head', SKIN, side.face),
    ...['R', 'L'].flatMap(s => [part(`Part_Arm_${s}`, 'PPD_Default_Arm', arms), part(`Part_Wrist_${s}`, 'PPD_Default_Wrist', arms), part(`Part_Hand_${s}`, 'PPD_Default_Hand', SKIN),
      part(`Part_Leg_${s}`, 'PPD_Default_Leg', legs), part(`Part_Ankle_${s}`, 'PPD_Default_Ankle', legs), part(`Part_Shoe_${s}`, 'PPD_Default_Shoe', shoes)]),
    part('Part_Hat', side.hat, hatC), part('Part_Pack_Accessory', 'PPD_Adventure_Pack', [90, 70, 50]),
  ] };
}

for (const side of WAR.sides) {
  const b = base(side.base), ext = b.ext;
  const w = new lib.World();
  const o = w.addOwner(OWNER);
  w.addBrick({ asset: 'B_Bot_Spawn_Point', position: [0, 0, 2], rotation: b.brick.rotation, direction: 4, color: [255, 255, 255], visibility: false,
    collision: { player: false, weapon: false, interaction: false, tool: true, physics: false }, owner_index: o,
    components: [{ type: 'Component_BotSpawn', data: { ...b.data, BotName: side.name, Skin: skin(side, ext), HealthMultiplier: side.hp, AttackDamageMultiplier: 0.5,
      bCanTargetBots: true, bCanTargetPlayers: false, AggroRange: 120, RespawnTime: 30, MovementAmount: 0.3, MovementRandomness: 40,
      MoveTarget: { X: WAR.battlefield[0], Y: WAR.battlefield[1], Z: WAR.battlefield[2] } } }] });
  w.makePrefab({});
  writeFileSync(`${outDir}/${side.prefab}.brz`, w.toBrz({ bundle: { description: side.name }, externalAssets: ext }));
}
console.log(`${WAR.sides.length} war spawners -> ${outDir}`);
