// Generates skeleton_drop.ws from the drop table below.
//   node coingen.mjs && node gen.js && node build.mjs
// [keyword, rolls, drop chance % per roll, brown %, silver %, XP] (gold = the rest).
// A dead character whose name contains the keyword (any case) uses that row
// (first match wins);
// any other name containing "skeleton" uses DEFAULT; everyone else drops nothing.
// XP goes straight onto the killer's "XP" leaderboard value; their "Level" is
// floor(sqrt(XP / XP_SCALE)) + 1 (L2 at 25 XP, L5 at 400, L10 at 2025).
const T = [
  ['handaxe', 2, 60, 85, 15, 5],
  ['arming', 2, 70, 75, 22, 8],
  ['spear', 3, 70, 65, 30, 12],
  ['longsword', 3, 80, 55, 35, 18],
  ['bow', 4, 80, 45, 40, 25],
  ['zweihander', 4, 90, 35, 45, 35],
  ['battleaxe', 5, 100, 25, 45, 50],
  // goblins and the Evil Wizard (enemy_* prefabs, 2026-10-03); 'wood goblin' first, its name also says goblin
  ['wood goblin', 3, 75, 70, 25, 10],
  ['goblin', 2, 70, 80, 18, 6],
  ['wizard', 5, 100, 20, 45, 60],
  // swamp zombies (swamp_zombie_1/2 prefabs); 'bloated' first, its name also says zombie
  ['bloated', 4, 90, 40, 45, 30],
  ['zombie', 3, 75, 60, 33, 15],
];
// (2026-10-10) bots come back with an empty display name, so every enemy fell
// to DEFAULT and no name could be shown. A bot's max health (GetDamage()
// .DamageLimit = 100 x the spawner's HealthMultiplier) is unique per type, so
// that is the key: keep these equal to 100 x bridge/tools/difficulty.mjs CURVE
// and spawnerfix.mjs (Wood Goblin 0.55, Bloated 1.3, Wizard 1.2 were nudged
// off 0.5 / 1.25 to stay unique).
const ENEMY = {
  'handaxe': [50, 'Handaxe Skeleton'], 'arming': [75, 'Arming Sword Skeleton'], 'spear': [125, 'Spear Skeleton'],
  'longsword': [200, 'Longsword Skeleton'], 'bow': [250, 'Bow Skeleton'], 'zweihander': [350, 'Zweihander Skeleton'],
  'battleaxe': [500, 'Battleaxe Skeleton'], 'wood goblin': [55, 'Wood Goblin'], 'goblin': [35, 'Goblin'],
  'wizard': [65, 'Evil Wizard'], 'casino staff': [10000, 'Casino Staff'], 'bloated': [130, 'Bloated Zombie'], 'zombie': [60, 'Swamp Zombie'],
};
{
  const seen = {};
  for (const [k, [hp]] of Object.entries(ENEMY)) { if (seen[hp]) throw new Error(`max health ${hp} used by ${seen[hp]} and ${k}`); seen[hp] = k; }
}
const DEFAULT = [3, 70, 65, 30, 12];
const COPPER = [2, 4];   // copper coins per copper roll (owner 2026-10-10: more coins)
const COIN_LIFE = 180;   // seconds a dropped coin lies there (was forever: with 2-4x the coins the spawn limits filled up)
const HEAL_PCT = 25;     // chance a kill also drops a health pickup (heal.brz, pots/healgen.mjs)
const BULLET_PCT = 15;   // chance a kill also drops bullets (bullets.brz: every gun ammo type)
const ARROW_PCT = 35;    // chance a kill also drops 10 arrows (arrows.brz, pots/arrowgen.mjs; owner 2026-10-11: players ran out of arrows)
const XP_SCALE = 25;

const MAX = Math.max(...T.map(t => t[1]));
const line = (n, [c, d, b, s, x]) => `//   ${n.padEnd(22)} ${c} rolls, ${String(d).padStart(3)}% drop, brown ${b}% silver ${s}% gold ${100 - b - s}%, ${x} XP`;
const table = T.map(([n, ...r]) => line(n, r)).join('\n') + '\n' + line('(any other skeleton)', DEFAULT);
const set = ([c, d, b, s, x]) => `
    xp = ${x}
    rolls = ${c}
    dropPct = ${d}
    brownPct = ${b}
    silverPct = ${s}
  }`;
// casino staff (npcgen.mjs, HealthMultiplier 100 = max health 10000) drop nothing and give no XP
const pick = T.map(([n, ...r], i) => `${i ? ' else ' : '  if isBot && lim >= 5000 {\n    rolls = 0\n  } else '}if name.Contains("${n}") || (isBot && lim == ${ENEMY[n][0]}) {${set(r)}`).join('') +
  ` else if name.Contains("skeleton") || name.Length() == 0 {${set(DEFAULT)} else {
    rolls = 0
  }`;
// (owner 2026-10-10: "make bots drop lots more coins in volume like multiple
// copper coins") a copper roll drops COPPER[0]..COPPER[1] coins, fanned out
const copper = k => Array.from({ length: COPPER[1] }, (_, j) => {
  const sp = `SpawnPrefab(prefab = $./coin1.brz, offset = at, velocity = Vec(cos(ang${k} + ${(j * 1.3).toFixed(1)}) * FLING, sin(ang${k} + ${(j * 1.3).toFixed(1)}) * FLING, POP + ${j * 30}.0), lifetime = ${COIN_LIFE}.0, limit = 400)`;
  return j < COPPER[0] ? `        ${sp}
` : `        if n${k} >= ${j + 1} {
          ${sp}
        }
`;
}).join('');
const slot = k => `    if rolls >= ${k} && Random(0, 99) < dropPct {
      let ang${k} = Random(0, 359) * 0.0174533
      let vel${k} = Vec(cos(ang${k}) * FLING, sin(ang${k}) * FLING, POP)
      let roll${k} = Random(0, 99)
      if roll${k} < brownPct {
        let n${k} = Random(${COPPER[0]}, ${COPPER[1]})
${copper(k)}      } else if roll${k} < brownPct + silverPct {
        SpawnPrefab(prefab = $./coin10.brz, offset = at, velocity = vel${k}, lifetime = ${COIN_LIFE}.0, limit = 200)
      } else {
        SpawnPrefab(prefab = $./coin25.brz, offset = at, velocity = vel${k}, lifetime = ${COIN_LIFE}.0, limit = 200)
      }
    }
`;
// Wirescript strings interpolate ${...} too, so those are written as '$' + '{'
const I = v => '$' + '{' + v + '}';
// HUD, top centre: level, and XP toward the next level. Wirescript has no
// loops over players, so it is redrawn on events (spawn, kill, /level) with a
// long lifetime; the fixed text ids update it in place.
const hud = (c, total, lvl, pad) => `${pad}${c}.DisplayText("<b>Level ${I(lvl)}</>", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 40.0,
${pad}  fontSize = 34, justify = Center, outlineSize = 2, lifetime = 86400.0, textId = 52001)
${pad}${c}.DisplayText("XP ${I(total)} / ${I(XP_SCALE + " * " + lvl + " * " + lvl)}", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 82.0,
${pad}  fontSize = 22, justify = Center, outlineSize = 2, lifetime = 86400.0, textId = 52002)
${pad}${c}.DisplayText("<color=\\"f6ce2a\\">Coins ${I(c + '.GetLeaderboard("coins")')}</>", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 112.0,
${pad}  fontSize = 22, justify = Center, outlineSize = 2, lifetime = 86400.0, textId = 52003)
`;
// level teams (owner, 2026-10-03): teams "Level 1" .. "Level 50" made in-game; a
// player moves onto their level's team on level-up and on spawn, only if the
// team exists (an unknown name would drop them to the unaffiliated team)
// (2026-10-06, owner: "make people pinned to the chud team on join"): every
// spawn (a join included) and every level-up puts the player on "Chud" instead;
// the level teams are gone from the world. Only if the team exists.
// (2026-10-10: the real max comes from GetDamage().DamageLimit; the fixed 400
// guess left players at full health)
// health cap per level (owner 2026-10-08: "levelup doesnt subtract health if
// ever over max for level"): the game's max health is 400, a level allows
// BASE_HP * (1 + 5% per level above 1) (100 at level 1, ~145 at 10, ~345 at 50,
// the same toughness the old shrink-every-hit rule gave). Whenever a
// character's health is over that, the excess goes on as damage: on spawn, on
// level-up and on every HUD tick, so heals can't push it over either.
const HP_MAX = 400, BASE_HP = 100, HP_PER_LEVEL = 0.05;
const capHp = (ch, lvl, pad, k) => `${pad}let capMax${k} = ${BASE_HP}.0 * (1.0 + ${HP_PER_LEVEL} * (${lvl} - 1))
${pad}let capDmg${k} = ${ch}.GetDamage()
${pad}let capHp${k} = capDmg${k}.DamageLimit - capDmg${k}.Damage
${pad}if capHp${k} > capMax${k} {
${pad}  ${ch}.SetDamage(capDmg${k}.DamageLimit - capMax${k})
${pad}}
`;
const levelTeam = (c, lvl, pad) => `${pad}teamLvl = ${lvl}
${pad}let lteam = GetTeamByName("Chud")
${pad}if lteam.GetTeamName().Length() > 0 && ${c}.GetUserName().Length() > 0 {
${pad}  ${c}.SetTeam(lteam)
${pad}}
`;
const xpBlock = `    // XP and level for the killer. CharacterDied leaves the killer empty when a
    // bot dies, so fall back to the last player who damaged it (hitBy)
    kc = killer.ControllerOf()
    if kc.GetUserName().Length() == 0 {
      kc = hitBy.get(who)
    }
    hitBy.remove(who)
    PrintToConsole("[xp debug] C killer=${I('kc.GetUserName()')} lim=${I('lim')}")
    if kc.GetUserName().Length() > 0 {
      kc.DisplayText("<b>${I('enemyName(lim)')}</> defeated", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 150.0,
        fontSize = 24, justify = Center, outlineSize = 2, lifetime = 2.0, textId = 52010)
      kc.DisplayText("<b>${I('BARS[0]')}</>", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 182.0,
        fontSize = 22, justify = Center, outlineSize = 2, lifetime = 2.0, textId = 52011)
      kc.IncLeaderboard("XP", xp)
      let total = kc.GetLeaderboard("XP")
      let lvl = floor(sqrt(total / ${XP_SCALE}.0)) + 1
      kc.ShowStatusMessage("+${I('xp')} XP")
      if lvl > kc.GetLeaderboard("Level") {
        kc.SetLeaderboard("Level", lvl)
        kc.ShowStatusMessage("LEVEL UP! You are level ${I('lvl')}")
${levelTeam('kc', 'lvl', '        ')}        kc.ShowChatMessage("<color=\\"46aaff\\"><b>Level up!</> You reached level ${I('lvl')}. /level shows your progress.</>")
      }
${capHp('kc.CharacterOf()', 'lvl', '      ', 'K')}
  ${hud('kc', 'total', 'lvl', '      ')}
    }
`;
const SWORDS = [
  ['Bronze', 150, 0.5, [123, 72, 0]],
  ['Iron', 400, 0.65, [88, 86, 84]],
  ['Steel', 1000, 0.8, [160, 160, 166]],
  ['Black', 2000, 1.0, [26, 26, 28]],
  ['Mithril', 4000, 1.2, [58, 58, 128]],
  ['Adamant', 8000, 1.5, [42, 96, 56]],
  ['Rune', 20000, 2.0, [38, 150, 178]],
];
// keep the shop sword across leave/rejoin: a coin drop of exactly a sword's
// price (the shops charge by IncrementLeaderboardValue coins -price) records
// "SwordTier"; a spawn after 30 s unseen (a join) gives that sword back.
const swordTrack = (c, pad) => `${pad}let uid = ${c}.GetUserId()
${pad}let coinsNow = ${c}.GetLeaderboard("coins")
${pad}if invCoins.has(uid) {
${pad}  let spent = invCoins.get(uid) - coinsNow
` + SWORDS.map(([n, p], i) => `${pad}  ${i ? '} else ' : ''}if spent == ${p} {\n${pad}    ${c}.SetLeaderboard("SwordTier", ${i + 1})\n`).join('') + `${pad}  }
${pad}}
${pad}invCoins.set(uid, coinsNow)
${pad}invSeen.set(uid, GetUnixTime())
`;
// keep the whole inventory across leave/rejoin (owner 2026-10-07): while a
// player is online (invLive 1) the HUD loop snapshots every slot's item into
// invItem "<uid>:<slot>"; ControllerLeft stops the snapshots (invLive 0) so
// the copy survives; the first spawn after a (re)join puts each item back in
// its slot. Shop swords come back with their tier (SwordTier) stats. With no
// snapshot yet, the old rule: a spawn after 30 s unseen re-adds the sword.
const SLOTS = 10;
const swordAdv = (ch, pad, slotArg) => `${pad}let tier = ${ch}.ControllerOf().GetLeaderboard("SwordTier")
` + SWORDS.map(([n, p, d, [r, g, b]], i) => `${pad}${i ? '} else ' : ''}if tier == ${i + 1} {\n${pad}  ${ch}.${slotArg === null ? 'AddInventoryItemAdv($BRItemBase/Weapon_ArmingSword' : `SetInventoryItemAdv($BRItemBase/Weapon_ArmingSword, slot = ${slotArg}`}, damage = ${d.toFixed(2)}, itemName = "${n} Sword", overrideColors = true, meshColors = [ColorSRGB(${r}, ${g}, ${b}, 255)])\n`).join('') + `${pad}}
`;
const invSnap = (c, pad) => `${pad}if invLive.has(uid) && invLive.get(uid) == 1 {
${pad}  let ich = ${c}.CharacterOf()
` + Array.from({ length: SLOTS }, (_, k) => `${pad}  invItem.set("${I('uid')}:${k}", ich.GetInventoryEntry(${k}).Item)
`).join('') + `${pad}  invHas.set(uid, 1)
${pad}  // (owner 2026-10-11: "they NEED to keep the data") the slots go to the log
${pad}  // whenever they change; the progress plugin keeps them on disk
${pad}  let invLine = "${Array.from({ length: SLOTS }, (_, k) => I(`ich.GetInventoryEntry(${k}).Item`)).join('|')}"
${pad}  if !invLast.has(uid) || invLast.get(uid).Value != invLine {
${pad}    invLast.set(uid, invLine)
${pad}    PrintToConsole("[inv] ${I('uid')} ${I('invLine')}")
${pad}  }
${pad}}
`;
const swordGive = (ch, c, pad) => `${pad}let suid = ${c}.GetUserId()
${pad}if !invLive.has(suid) || invLive.get(suid) != 1 {
${pad}  if invHas.has(suid) {
${pad}    PrintToConsole("[inv-restored] ${I('suid')}")
` + Array.from({ length: SLOTS }, (_, k) => `${pad}    let it${k} = invItem.get("${I('suid')}:${k}").Value
${pad}    if it${k} == $BRItemBase/Weapon_ArmingSword && ${c}.GetLeaderboard("SwordTier") > 0 {
${swordAdv(ch, pad + '      ', k)}${pad}    } else {
${pad}      ${ch}.SetInventoryItem(it${k}, ${k})
${pad}    }
`).join('') + `${pad}  } else if !invSeen.has(suid) || GetUnixTime() - invSeen.get(suid) > 30 {
${pad}    // no snapshot here (a restart or a new chip): the progress plugin gives back the rest from disk
${swordAdv(ch, pad + '    ', null)}${pad}  }
${pad}  invLive.set(suid, 1)
${pad}}
${pad}invSeen.set(suid, GetUnixTime())
`;
const levelCmd = `
// HUD refresh: coins change outside this chip (coin pickups, shops), so every
// 0.25 s redraw the next player's HUD in turn
var hudPlayers: controller[]
var hudIdx: int = 0
var invCoins: Map<string, int>
var invSeen: Map<string, int>
var invLive: Map<string, int>
var invHas: Map<string, int>
var invLast: Map<string, string>
var invJoin: Map<string, int>
var invItem: Map<string, entity>
on ControllerLeft() -> (controller, userId, userName) {
  invLive.set(userId, 0)
}
on ControllerJoined() -> (controller, userId, userName) {
  invJoin.set(userId, GetUnixTime())
}
on Clock(interval = 0.25) {
  hudPlayers.fillFromPlayers()
  let n = hudPlayers.length()
  if n > 0 {
    if hudIdx >= n {
      hudIdx = 0
    }
    let hp = hudPlayers[hudIdx]
    // a new chip adopts whoever was in game before it loaded (no join seen) or
    // joined 30 s ago and more (their first spawn has been and gone): else
    // they'd only be tracked from a later spawn, which would look like a join
    let auid = hp.GetUserId()
    if !invLive.has(auid) && (!invJoin.has(auid) || GetUnixTime() - invJoin.get(auid) > 30) {
      invLive.set(auid, 1)
    }
${swordTrack('hp', '    ')}${invSnap('hp', '    ')}    let total = hp.GetLeaderboard("XP")
    let lvl = floor(sqrt(total / ${XP_SCALE}.0)) + 1
${capHp('hp.CharacterOf()', 'lvl', '    ', 'C')}${hud('hp', 'total', 'lvl', '    ')}    hudIdx = hudIdx + 1
  }
}

on ChatCommand("coins", "How many coins you have") -> (ctrl, args) {
  ctrl.ShowChatMessage("<color=\\"f6ce2a\\"><b>${I('ctrl.GetLeaderboard("coins")')} coins</></>")
}
on ChatCommand("level", "Your level and XP") -> (ctrl, args) {
  let total = ctrl.GetLeaderboard("XP")
  let lvl = floor(sqrt(total / ${XP_SCALE}.0)) + 1
  let next = ${XP_SCALE} * lvl * lvl
  ctrl.ShowChatMessage("<color=\\"46aaff\\"><b>Level ${I('lvl')}</></> - ${I('total')} XP, level ${I('lvl + 1')} at ${I('next')} XP. Kill skeletons for XP (tougher ones give more).")
${hud('ctrl', 'total', 'lvl', '  ')}}

on CharacterSpawned() -> (character) {
  let sc = character.ControllerOf()
${swordGive('character', 'sc', '  ')}  let total = sc.GetLeaderboard("XP")
  let lvl = floor(sqrt(total / ${XP_SCALE}.0)) + 1
  // players only: bots spawn too, with their own health (2026-10-08: capping
  // them as level-1 players left every enemy nearly dead)
  if sc.GetUserName().Length() > 0 {
${capHp('character', 'lvl', '    ', 'S')}  }
${levelTeam('sc', 'lvl', '  ')}${hud('sc', 'total', 'lvl', '  ')}}
`;

// enemy HUD (owner 2026-10-10: "give an enemy name and health bar that pops up
// in the hud when you are one on one fighting an enemy"): whenever a player
// hits a bot, or a bot hits a player, that player sees the bot's name and a
// 20-segment health bar under their level/XP/coins for a few seconds.
const BAR = 20;
const BARS = Array.from({ length: BAR + 1 }, (_, k) => `<color=\\"e03030\\">${'|'.repeat(k)}</><color=\\"555555\\">${'|'.repeat(BAR - k)}</>`);
const enemyNameMod = `// enemy name by max health (see ENEMY in gen.js)
mod enemyName(lim: int) -> string {
${Object.values(ENEMY).map(([hp, nm], i) => `  ${i ? '} else ' : ''}if lim == ${hp} {
    return "${nm}"
`).join('')}  }
  return "Enemy"
}
const BARS = [${BARS.map(b => '"' + b + '"').join(', ')}]
mod enemyHud(who: controller, bot: character) {
  let d = bot.GetDamage()
  let lim = floor(d.DamageLimit + 0.5)
  let left = max(d.DamageLimit - d.Damage, 0.0)
  let seg = floor(left / d.DamageLimit * ${BAR}.0 + 0.999)
  who.DisplayText("<b>${I('enemyName(lim)')}</>", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 150.0,
    fontSize = 24, justify = Center, outlineSize = 2, lifetime = 5.0, textId = 52010)
  who.DisplayText("<b>${I('BARS[seg]')}</>  ${I('floor(left + 0.5)')} / ${I('lim')}", anchorX = 0.5, anchorY = 0.0, pivotX = 0.5, pivotY = 0.0, positionX = 0.0, positionY = 182.0,
    fontSize = 22, justify = Center, outlineSize = 2, lifetime = 5.0, textId = 52011)
}
`;
const ws = `// skeleton_drop.ws -- generated by gen.js (edit the table there, then
// node gen.js && node build.mjs). When a dungeon skeleton dies, it drops coins
// where it died and gives the killer XP: each skeleton gets some rolls; each
// roll drops a coin with its drop chance, brown (+1) / silver (+10) / gold
// (+25) "coins" by its odds; the killer gets the XP on the leaderboard:
${table}
// Coins are flung out a little so they scatter. The chip also pulses Died
// and puts the spot on Location (world) / Offset (relative to this chip).

const FLING = 120.0   // sideways speed of a dropped coin
const POP = 250.0     // upward speed

var location: vector = Vec(0.0, 0.0, 0.0)
var offset: vector = Vec(0.0, 0.0, 0.0)
var rolls: int = 0
var xp: int = 0
var dropPct: int = 0
var brownPct: int = 0
var silverPct: int = 0
out Location: vector = location
out Offset: vector = offset
out Died: exec
var kc: controller
var teamLvl: int = 1
// who last hurt each character, for kill credit when CharacterDied gives no killer
var hitBy: Map<character, controller>
${enemyNameMod}on CharacterDamaged() -> (victim, damage, attacker, attackerWeapon, attackerWeaponName) {
  let ac = attacker.ControllerOf()
  PrintToConsole("[hit debug] victim=${I('victim.ControllerOf().GetUserName()')} attacker=${I('ac.GetUserName()')} weapon=${I('attackerWeaponName')} dmg=${I('damage')} total=${I('victim.GetDamage()')}")
  let vc = victim.ControllerOf()
  if ac.GetUserName().Length() > 0 {
    hitBy.set(victim, ac)
    if vc.GetUserName().Length() == 0 {
      enemyHud(ac, victim)
    }
  } else if vc.GetUserName().Length() > 0 && attacker.GetDamage().DamageLimit > 0.0 {
    enemyHud(vc, attacker)
  }
  // (2026-10-08) per-level health is now the real health, capped on spawn,
  // level-up and every HUD tick (capHp); the old rule here (shrink every hit by
  // the level bonus, then over 100 damage straight to 400) gave the same
  // toughness with a 400 health bar, and would kill a capped player outright
}

on CharacterDied() -> (who, killer, killerWeapon, killerWeaponName) {
  let name = who.ControllerOf().GetDisplayName().ToLower()
  let isBot = who.ControllerOf().GetUserName().Length() == 0
  let lim = floor(who.GetDamage().DamageLimit + 0.5)
  let dbgUser = who.ControllerOf().GetUserName()
  let dbgTag = who.GetTag()
  PrintToConsole("[xp debug] died: user=${I('dbgUser')} tag=${I('dbgTag')}")
${pick}
  PrintToConsole("[xp debug] A rolls=${I('rolls')} xp=${I('xp')} len=${I('name.Length()')}")
  if rolls > 0 {
    location = who.GetLocation()
    PrintToConsole("[xp debug] B at ${I('location')}")
    offset = location - GetOwnTransform().Location
    let at = offset + Vec(0.0, 0.0, 20.0)
${Array.from({ length: MAX }, (_, i) => slot(i + 1)).join('')}    if Random(0, 99) < ${HEAL_PCT} {
      SpawnPrefab(prefab = $./heal.brz, offset = at, lifetime = 60.0, limit = 100)
    }
    if Random(0, 99) < ${ARROW_PCT} {
      SpawnPrefab(prefab = $./arrows.brz, offset = at + Vec(0.0, 0.0, 12.0), lifetime = 60.0, limit = 100)
    }
    if Random(0, 99) < ${BULLET_PCT} {
      SpawnPrefab(prefab = $./bullets.brz, offset = at + Vec(0.0, 0.0, 24.0), lifetime = 60.0, limit = 100)
    }
${xpBlock}    emit Died
  }
}
${levelCmd}`;
require('fs').writeFileSync(require('path').join(__dirname, 'skeleton_drop.ws'), ws);
console.log(`wrote skeleton_drop.ws (${T.length} skeletons, up to ${MAX} rolls)`);
