// Friendly NPC spawners (owner 2026-10-10: casino "along with npcs"): copies of
// the (hidden) tier-1 spawner prefab whose bot never targets anyone, never
// moves off its spot and wears a costume. HealthMultiplier 100 (max health
// 10000) marks staff: skeleton_drop gives no coins or XP for them.
//   node npcgen.mjs          -> Saved/Prefabs/npc_<role>.brz
// Each placed spot still gets its own homed copy (homes.mjs prefab), like any spawner.
import fs from "fs";
import * as brs from "/home/max/omegga-server/plugins/bridge/lib/brs.mjs";
const DIR = "/home/max/omegga-server/data/Saved/Prefabs/";
const C = (r, g, b) => ({ R: r, G: g, B: b, A: 255 });
const SKIN = C(232, 190, 156), HAIR = C(60, 40, 28);
const ROLES = {
  dealer: { name: "Casino Dealer", torso: C(150, 20, 34), arms: C(240, 240, 240), legs: C(24, 24, 28), shoes: C(16, 16, 18) },
  bouncer: { name: "Casino Bouncer", torso: C(20, 20, 24), arms: C(20, 20, 24), legs: C(20, 20, 24), shoes: C(10, 10, 12) },
  host: { name: "Casino Host", torso: C(236, 190, 60), arms: C(236, 190, 60), legs: C(30, 30, 36), shoes: C(16, 16, 18) },
};
const partColor = (role, socket) => /Torso/.test(socket) ? role.torso : /Head/.test(socket) ? SKIN : /Hand/.test(socket) ? SKIN : /Arm|Wrist/.test(socket) ? role.arms : /Leg|Ankle/.test(socket) ? role.legs : role.shoes;
const concat = parts => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
for (const [key, role] of Object.entries(ROLES)) {
  const r = brs.WorldReader.from(fs.readFileSync(DIR + "dungeon_spawner_1.brz")), X = r.fs;
  const node = id => { const children = [];
    X.folderNames.forEach((nm, i) => { if (X.folderParentIds[i] === id) children.push([nm, node(i)]); });
    X.fileNames.forEach((nm, i) => { if (X.fileParentIds[i] === id) children.push([nm, { type: "file", content: X.fileContentIds[i] < 0 ? new Uint8Array(0) : X.readBlob(X.fileContentIds[i]) }]); });
    return { type: "folder", children }; };
  const tree = node(-1).children;
  const find = p => p.split("/").reduce((t, h, i, a) => { const e = t.find(([nm]) => nm === h)[1]; return i === a.length - 1 ? e : e.children; }, tree);
  for (const { index: idx } of r.brickChunkIndex(1)) {
    const cpath = r.path(`Bricks/Grids/1/Components/${idx.x}_${idx.y}_${idx.z}.mps`);
    if (!X.findFileByPath(cpath)) continue;
    const cs = r.schemaAt(r.path("Bricks/ComponentsShared.schema"), X.findFileByPath(cpath).createdAt);
    const cc = r.componentChunk(1, idx);
    for (const c of cc.components) if (c.typeName === "Component_BotSpawn") {
      Object.assign(c.data, { BotName: role.name, bCanTargetPlayers: false, bCanTargetBots: false, Agression: 0, AggroRange: 0, MovementAmount: 0, MovementRandomness: 0,
        AttackMovementAmount: 0, Jumpyness: 0, bCanJump: false, HealthMultiplier: 100, AttackDamageMultiplier: 0, RespawnTime: 30 });
      for (const part of c.data.Skin.Parts) part.Colors = part.Colors.map((col, i) => (i === 0 ? partColor(role, part.SocketName) : /Head/.test(part.SocketName) && i === 1 ? HAIR : col));
    }
    find(cpath).content = concat([cs.encode("BRSavedComponentChunkSoA", cc.soa), ...cc.components.filter(c => c.structName).map(c => cs.encode(c.structName, c.data))]);
  }
  fs.writeFileSync(DIR + `npc_${key}.brz`, brs.brdb.writeBrzContainer(tree));
  console.log(`npc_${key}.brz`, role.name);
}
