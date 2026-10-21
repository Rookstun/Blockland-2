// Game balance from one JSON file (owner 2026-10-19: "a json file that i can type /reload and the values of
// that file will match the game ... change all enemy difficulties and weapon strengths and speed and types").
// Server tool, lives in ~/omegga-server/bridge/balance/ (the balance plugin runs it on /reload).
//   node balance.mjs dump [brdb]     write balance.json from the live world's spawners (newest save) + the stand prefabs
//   node balance.mjs apply [dry]     make the game match balance.json:
//     1. enemies: base spawner prefabs (dungeon_spawner_*, swamp_zombie_*, enemy_*, war_*) get the
//        Component_BotSpawn values by BotName; weapons: every shop_/bow_/gun_/soda_ stand prefab (plain,
//        _bare, _case) gets Component_ItemSpawn + AddInventoryItemAdv damage/speed/item by item name
//     2. skeleton_drop is rebuilt + swapped when enemy health or a weapon changed: it names enemies by max
//        health (100 x health, must stay unique) and gives bought items back with the catalog's stats
//     3. the live world: World.Save, scan it, re-place (clear + load a homed copy) every spawner whose live
//        values differ, and every listed stand (stands.json) whose prefab changed
// Lines starting with '#' are progress for the player who typed /reload.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { DatabaseSync } from 'node:sqlite';

const HOME = process.env.HOME, SRV = path.join(HOME, 'omegga-server');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PREFABS = path.join(SRV, 'data/Saved/Prefabs'), WORLDS = path.join(SRV, 'data/Saved/Worlds');
const BACKUP = path.join(SRV, 'data/Saved/balance_pre');
const BRIDGE = path.join(SRV, 'bridge'), TOOLS = path.join(BRIDGE, 'tools');
const FILE = path.join(HERE, 'balance.json'), STATE = path.join(HERE, 'state.json');
const SD = path.join(HERE, 'sd/skeleton_drop'); // skeleton_drop build copy (gen.js, build.mjs, coin prefabs)
const CATALOGS = [path.join(SD, 'itemcatalog.json'), path.join(SRV, 'plugins/progress/itemcatalog.json')];
const brs = await import(path.join(SRV, 'plugins/bridge/lib/brs.mjs'));
const brs4 = await import(path.join(HERE, 'sd/tools/brs4/dist.mjs')); // locally patched brs-js 4 (unknown component types)
const say = s => console.log('# ' + s);

const BASE = ['dungeon_spawner_1', 'dungeon_spawner_2', 'dungeon_spawner_3', 'dungeon_spawner_4', 'dungeon_spawner_5', 'dungeon_spawner_6', 'dungeon_spawner_7',
  'swamp_zombie_1', 'swamp_zombie_2', 'enemy_goblin', 'enemy_wood_goblin', 'enemy_wizard', 'war_fire', 'war_water'];
const STAND = /^(shop|bow|gun|soda)_[a-z0-9_]+\.brz$/;
// json key -> Component_BotSpawn field
const EF = { health: 'HealthMultiplier', damage: 'AttackDamageMultiplier', speed: 'RunSpeed', respawn: 'RespawnTime', aggroRange: 'AggroRange',
  gunSkill: 'GunSkill', aggression: 'Agression', reactionTime: 'ReactionTime', roam: 'MovementRandomness', jumpiness: 'Jumpyness', canJump: 'bCanJump' };
// item -> pickup asset (the game's names; most are BP_ItemPickup_<same>)
const WEAPONS = 'AntiMaterielRifle APCarbine ArmingSword AssaultRifle AutoShotgun Bandage Battleaxe Bazooka BoltActionRifle Bow BoxPistol BullpupRifle BullpupSMG ChargedLongsword Claws CoachGun CrystalKalis Derringer Dynamite FlintlockPistol GrenadeLauncher GuardPistol Handaxe HealthPotion HeavyAssaultRifle HeavySMG HeroSword HighPowerPistol HoloBlade HuntingShotgun ImpactGrenade ImpulseGrenade Knife LaserAxe LaserCleaver LeverActionRifle LightMachineGun Longsword MagnumPistol MediSyringe MicroSMG Minigun MissileLauncher PDW Pickaxe PipeBomb Pistol PlasmaPistol PlasmaSMG PulseCarbine PulseRifle QuadLauncher Revolver RoadFlare RocketJumper RocketLauncher Sabre SemiAutoRifle ServiceRifle ShadowClaws SharpClaws Shotgun SlugShotgun Sniper SodaCan Spatha Spear SportingShotgun StampedSMG StandardSubmachineGun StickGrenade SubmachineGun SuperShotgun SuppressedAssaultRifle SuppressedBullpupSMG SuppressedGuardPistol SuppressedHeavySMG SuppressedMicroSMG SuppressedPistol SuppressedServiceRifle TacticalShotgun TacticalSMG Tomahawk TwinCannon TypewriterSMG Zweihander'.split(' ').map(w => 'Weapon_' + w);
const PICKUP_ODD = { FlintlockPistol: 'Flintlock', HighPowerPistol: 'HIghPowerPistol', Sniper: 'SniperRifle', SuppressedServiceRifle: 'SuppressedServiceRIfle', SodaCan: 'Soda' };
const pickupOf = item => { const k = item.replace(/^Weapon_/, ''); return 'BP_ItemPickup_' + (PICKUP_ODD[k] ?? k); };

const num = v => (typeof v === 'bigint' ? Number(v) : v);
const same = (a, b) => (typeof a === 'boolean' || typeof b === 'boolean' ? !!a === !!b : Math.abs(num(a) - num(b)) < 1e-4);
const typed = (old, v) => (typeof old === 'bigint' ? BigInt(Math.round(v)) : typeof old === 'boolean' ? !!v : v);
const r6 = v => +(+num(v)).toPrecision(6);
const J = v => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : typeof x === 'number' && !Number.isInteger(x) ? Number(x.toPrecision(6)) : x));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- prefab read / patch / write (brs-js 3, the way textmat.mjs / guns.mjs do it) ----------
function bundle(files) {
  const root = new Map();
  for (const [p, content] of files) {
    const parts = p.split('/'); let node = root;
    for (const d of parts.slice(0, -1)) { if (!node.has(d)) node.set(d, new Map()); node = node.get(d); }
    node.set(parts.at(-1), content);
  }
  const toNodes = m => [...m].map(([n, v]) => [n, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}
function openPrefab(file) {
  const r = brs.WorldReader.from(fs.readFileSync(file));
  const paths = r.fs.listPaths();
  const comps = paths.map(p => p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/)).filter(Boolean)
    .map(m => ({ path: m[0], grid: +m[1], chunk: { x: +m[2], y: +m[3], z: +m[4] } }));
  for (const f of comps) {
    const c = r.componentChunk(f.grid, f.chunk);
    f.soa = c.soa; f.components = c.components.map(x => ({ ...x, data: x.data && structuredClone(x.data) }));
  }
  return { r, paths, comps, global: structuredClone(r.globalData()) };
}
const assetName = (pf, type) => pf.global.ExternalAssetReferences.filter(a => a.PrimaryAssetType === type).map(a => a.PrimaryAssetName);
/** writes pf back to file (backup first time), checking every component reads back as written */
function savePrefab(pf, file, touched) {
  const files = new Map(pf.paths.map(p => [p, pf.r.fs.readFile(p)]));
  for (const f of pf.comps) {
    if (!touched.has(f.path)) continue;
    const schema = pf.r.schemaAt(pf.r.path('Bricks/ComponentsShared.schema'), pf.r.fs.findFileByPath(f.path).createdAt);
    const parts = [schema.encode('BRSavedComponentChunkSoA', f.soa)];
    for (const c of f.components) if (c.structName) parts.push(schema.encode(c.structName, c.data));
    files.set(f.path, new Uint8Array(Buffer.concat(parts.map(p => Buffer.from(p)))));
  }
  const gpath = pf.r.path('GlobalData.mps');
  if (touched.has('global')) files.set(gpath, new Uint8Array(pf.r.schema(pf.r.path('GlobalData.schema')).encode('BRSavedGlobalDataSoA', pf.global)));
  const out = bundle(files);
  const chk = brs.WorldReader.from(Buffer.from(out));
  for (const f of pf.comps) if (touched.has(f.path)) {
    const got = chk.componentChunk(f.grid, f.chunk).components.map(c => J(c.data)), want = f.components.map(c => J(c.data));
    if (got.some((g, i) => g !== want[i])) throw new Error(`${path.basename(file)}: ${f.path} reads back different`);
  }
  if (touched.has('global') && J(chk.globalData().ExternalAssetReferences) !== J(pf.global.ExternalAssetReferences)) throw new Error(`${path.basename(file)}: assets read back different`);
  fs.mkdirSync(BACKUP, { recursive: true });
  const b = path.join(BACKUP, path.basename(file));
  if (!fs.existsSync(b)) fs.copyFileSync(file, b);
  fs.writeFileSync(file, out);
}

// enemies: BotName -> { prefab, values }
function readEnemies() {
  const out = {};
  for (const n of BASE) {
    const file = path.join(PREFABS, n + '.brz');
    if (!fs.existsSync(file)) continue;
    const pf = openPrefab(file);
    for (const f of pf.comps) for (const c of f.components) if (c.typeName === 'Component_BotSpawn' && c.data) {
      const d = c.data, e = {};
      for (const [k, fld] of Object.entries(EF)) e[k] = typeof d[fld] === 'boolean' ? d[fld] : r6(d[fld]);
      e.weapon = pf.global.ExternalAssetReferences[num(d.BotWeapon)]?.PrimaryAssetName ?? null;
      out[d.BotName] = { prefab: n, values: e };
    }
  }
  return out;
}
// stands: prefab -> { name, item, damage, speed }
function readStands() {
  const out = {};
  for (const f of fs.readdirSync(PREFABS).filter(f => STAND.test(f)).sort()) {
    let pf; try { pf = openPrefab(path.join(PREFABS, f)); } catch (e) { say(`can't read ${f}: ${e.message.slice(0, 80)}`); continue; }
    let s = null;
    for (const ch of pf.comps) for (const c of ch.components) {
      if (c.typeName === 'Component_ItemSpawn' || c.typeName === 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') {
        if (!c.data.ItemNameOverride) continue;
        s ??= { name: c.data.ItemNameOverride, item: assetName(pf, 'BRItemBase')[0], damage: r6(c.data.DamageMultiplier), speed: r6(c.data.WeaponSpeedMultiplier) };
      }
    }
    if (s) out[f.replace(/\.brz$/, '')] = s;
  }
  return out;
}

// ---------- dump ----------
function dump(worldFile) {
  const en = readEnemies(), st = readStands();
  // live spawners win over the base prefabs (2026-10-19: every live spawner had respawn 10, the prefabs 120)
  if (worldFile) {
    const votes = {};
    for (const s of liveSpawners(worldFile)) if (en[s.name]) {
      const v = {}; for (const [k, fld] of Object.entries(EF)) v[k] = typeof s.data[fld] === 'boolean' ? s.data[fld] : r6(s.data[fld]);
      v.weapon = s.weapon; const key = JSON.stringify(v);
      ((votes[s.name] ??= {})[key] ??= [0, v])[0]++;
    }
    for (const [n, vs] of Object.entries(votes)) {
      const best = Object.values(vs).sort((a, b) => b[0] - a[0])[0][1];
      if (Object.keys(vs).length > 1) say(`${n}: live spawners disagree, using the most common values`);
      en[n].values = best;
    }
  }
  const weapons = {};
  // a name sold by several prefabs: the plain stand's values win (bare/case copies were made from it)
  for (const [p, s] of Object.entries(st).sort(([a], [b]) => (/_bare|_case/.test(a) ? 1 : 0) - (/_bare|_case/.test(b) ? 1 : 0)))
    weapons[s.name] ??= { item: s.item, damage: s.damage, speed: s.speed };
  const order = Object.keys(weapons).sort((a, b) => weapons[a].item.localeCompare(weapons[b].item) || a.localeCompare(b));
  const json = {
    _help: [
      'Edit, save, then type /reload in game. Only what changed gets re-placed (spawners/stands); bots respawn with the new values.',
      'enemies: health/damage are multipliers (health 1 = 100 hp). health x 100 must be a whole number and unique per enemy (skeleton_drop names enemies and gives XP by max health); 80, 90, 95, 101-107 and 10000 are taken by NPCs.',
      'enemies: speed = run speed, respawn = seconds (the game seems to cap it at 10), aggroRange = how far they notice you, gunSkill/aggression/reactionTime 0..1 style, roam = random walking, weapon = any name from weaponTypes.',
      'weapons: keyed by the shop name; damage/speed are multipliers; item = the weapon type the stand sells (weaponTypes). Changes reach new purchases and inventory restores, not items players already hold.',
    ],
    enemies: Object.fromEntries(Object.entries(en).map(([k, v]) => [k, v.values])),
    weapons: Object.fromEntries(order.map(k => [k, weapons[k]])),
    weaponTypes: WEAPONS,
  };
  fs.writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote ${FILE}: ${Object.keys(json.enemies).length} enemies, ${order.length} weapons`);
}

// ---------- bridge jobs (inbox/outbox, like restands.mjs) ----------
async function job(ops, tag) {
  const id = `${Date.now()}_${process.pid}_bal_${tag}.json`;
  fs.writeFileSync(path.join(BRIDGE, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(BRIDGE, 'inbox', id + '.tmp'), path.join(BRIDGE, 'inbox', id));
  const out = path.join(BRIDGE, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 600) throw new Error('bridge gave no result for ' + id); await sleep(500); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res.results ?? [];
}
const cmd = (line, captureMs = 150) => ({ op: 'cmd', line, captureMs });

// live spawners: [{name, pos, move, data}] from a saved world copy (brs-js 4, brs-js 3 for chunks it can't read)
function liveSpawners(file) {
  const out = [], seen = new Set();
  const add = (r, idx, cc) => {
    const rel = r.brickChunkSoa(1, idx).RelativePositions;
    for (const c of cc.components) if (c.typeName === 'Component_BotSpawn' && c.data && rel[c.brickIndex]) {
      const p = rel[c.brickIndex], pos = [idx.x * 2048 + 1024 + p.X, idx.y * 2048 + 1024 + p.Y, idx.z * 2048 + 1024 + p.Z];
      const key = pos.join(','); if (seen.has(key)) continue; seen.add(key);
      out.push({ name: c.data.BotName, pos, move: c.data.MoveTarget, data: c.data, weapon: r.__ext[num(c.data.BotWeapon)] });
    }
  };
  const w4 = new brs4.WorldReader(new brs4.Brdb(new DatabaseSync(file, { readOnly: true })));
  w4.__ext = w4.externalAssets().map(a => a.name);
  const bad = [];
  for (const { index } of w4.brickChunkIndex(1)) { try { add(w4, index, w4.componentChunk(1, index)); } catch { bad.push(index); } }
  if (bad.length) {
    const w3 = new brs.Brdb(new DatabaseSync(file, { readOnly: true })).worldReader();
    w3.__ext = w3.externalAssets().map(a => a.name);
    for (const idx of bad) { try { add(w3, idx, w3.componentChunk(1, idx)); } catch { } }
  }
  return out;
}

// button bricks on the world grid (shop stands' buttons), per chunk
function liveButtons(file) {
  const w = new brs4.WorldReader(new brs4.Brdb(new DatabaseSync(file, { readOnly: true })));
  const A = w.brickAssets().map(a => a?.name ?? a), out = [];
  for (const { index } of w.brickChunkIndex(1)) {
    let s; try { s = w.brickChunkSoa(1, index); } catch { continue; }
    s.BrickTypeIndices.forEach((t, i) => { if (/Button/i.test(A[t])) { const p = s.RelativePositions[i]; out.push([index.x * 2048 + 1024 + p.X, index.y * 2048 + 1024 + p.Y, index.z * 2048 + 1024 + p.Z]); } });
  }
  return out;
}
// clear boxes per stand kind (restands.mjs; CLAUDE.md CASE STAND CLEAR)
const DIRS = { 16: [0, -1], 17: [1, 0], 18: [0, 1], 19: [-1, 0] };
function standBoxes(s) {
  const [x, y, z] = s.at, [dx, dy] = DIRS[s.orient] ?? [0, -1];
  if (/_case$/.test(s.prefab)) {
    const h = (a, c) => (dx ? [a, c] : [c, a]);
    const [h1x, h1y] = h(18, 18), [h2x, h2y] = h(12, 11);
    return [[x + 4 * dx, y + 4 * dy, z, h1x, h1y, 13], [x - 2 * dx, y - 2 * dy, z, h2x, h2y, 14]];
  }
  if (/_bare$/.test(s.prefab)) return [[x, y, z + 8, 16, 16, 22]];
  return [[x, y, z, 13, 13, 13]];
}

// ---------- apply ----------
async function apply(dry) {
  const B = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const E = B.enemies ?? {}, W = B.weapons ?? {};
  // validate before touching anything
  const errs = [];
  for (const [n, e] of Object.entries(E)) {
    for (const k of Object.keys(e)) if (!(k in EF) && k !== 'weapon') errs.push(`${n}: unknown field ${k}`);
    if (e.weapon && !WEAPONS.includes(e.weapon)) errs.push(`${n}: unknown weapon ${e.weapon}`);
    if (e.health != null && Math.abs(e.health * 100 - Math.round(e.health * 100)) > 1e-6) errs.push(`${n}: health x 100 must be whole (${e.health})`);
    if (e.health != null && e.health <= 0) errs.push(`${n}: health must be > 0`);
  }
  for (const [n, w] of Object.entries(W)) {
    for (const k of Object.keys(w)) if (!['item', 'damage', 'speed'].includes(k)) errs.push(`${n}: unknown field ${k}`);
    if (w.item && !WEAPONS.includes(w.item)) errs.push(`${n}: unknown item ${w.item}`);
  }
  // skeleton_drop's own check (unique max health incl. NPCs) runs in gen.js
  try { execFileSync(process.execPath, [path.join(SD, 'gen.js')], { cwd: SD, env: { ...process.env, BALANCE: FILE, GEN_CHECK_ONLY: '1' }, stdio: 'pipe' }); }
  catch (e) { errs.push(String(e.stderr || e.message).split('\n').find(l => /Error:/.test(l)) ?? 'gen.js check failed'); }
  if (errs.length) { for (const e of errs.slice(0, 6)) say('ERROR ' + e); say('nothing changed'); process.exitCode = 1; return; }

  // 1a. enemy base prefabs
  const enemyChanged = new Set();
  for (const n of BASE) {
    const file = path.join(PREFABS, n + '.brz');
    if (!fs.existsSync(file)) continue;
    const pf = openPrefab(file), touched = new Set(), log = [];
    for (const f of pf.comps) for (const c of f.components) {
      const d = c.data, e = c.typeName === 'Component_BotSpawn' && d && E[d.BotName];
      if (!e) continue;
      for (const [k, fld] of Object.entries(EF)) if (e[k] != null && !same(d[fld], e[k])) { log.push(`${k} ${r6(d[fld])}->${e[k]}`); d[fld] = typed(d[fld], e[k]); touched.add(f.path); }
      if (e.weapon) {
        const refs = pf.global.ExternalAssetReferences, cur = refs[num(d.BotWeapon)];
        if (cur?.PrimaryAssetName !== e.weapon) {
          // the spawner's weapon is its bundle's one BRItemBase reference (guns.mjs): rename it
          if (cur?.PrimaryAssetType !== 'BRItemBase' || refs.filter(a => a.PrimaryAssetType === 'BRItemBase').length !== 1) { say(`${n}: can't swap weapon (asset table)`); continue; }
          log.push(`weapon ${cur.PrimaryAssetName}->${e.weapon}`); cur.PrimaryAssetName = e.weapon; touched.add('global');
        }
      }
      if (touched.size) enemyChanged.add(d.BotName);
    }
    if (touched.size) { if (!dry) savePrefab(pf, file, touched); say(`${n}: ${log.join(', ')}`); }
  }

  // 1b. stand prefabs
  const standChanged = new Set(); let weaponChanged = false;
  for (const f of fs.readdirSync(PREFABS).filter(f => STAND.test(f)).sort()) {
    const file = path.join(PREFABS, f);
    let pf; try { pf = openPrefab(file); } catch { continue; }
    const touched = new Set(); let name = null;
    for (const ch of pf.comps) for (const c of ch.components) {
      if (c.typeName !== 'Component_ItemSpawn' && c.typeName !== 'BrickComponentType_WireGraph_Exec_Character_AddInventoryItemAdv') continue;
      const w = c.data?.ItemNameOverride && W[c.data.ItemNameOverride];
      if (!w) continue;
      name = c.data.ItemNameOverride;
      if (w.damage != null && !same(c.data.DamageMultiplier, w.damage)) { c.data.DamageMultiplier = typed(c.data.DamageMultiplier, w.damage); touched.add(ch.path); }
      if (w.speed != null && !same(c.data.WeaponSpeedMultiplier, w.speed)) { c.data.WeaponSpeedMultiplier = typed(c.data.WeaponSpeedMultiplier, w.speed); touched.add(ch.path); }
    }
    const w = name && W[name];
    if (w?.item) for (const a of pf.global.ExternalAssetReferences) {
      if (a.PrimaryAssetType === 'BRItemBase' && a.PrimaryAssetName !== w.item) { a.PrimaryAssetName = w.item; touched.add('global'); }
      if (a.PrimaryAssetType === 'BRPickupBase' && a.PrimaryAssetName !== pickupOf(w.item)) { a.PrimaryAssetName = pickupOf(w.item); touched.add('global'); }
    }
    if (!touched.size) continue;
    if (!dry) savePrefab(pf, file, touched);
    standChanged.add(f.replace(/\.brz$/, '')); weaponChanged = true;
  }
  if (standChanged.size) say(`${standChanged.size} stand prefabs changed: ${[...standChanged].slice(0, 8).join(' ')}${standChanged.size > 8 ? ' ...' : ''}`);

  // 2. catalogs (inventory restore) keep their order: progress stores catalog ids
  for (const cf of CATALOGS) {
    if (!fs.existsSync(cf)) continue;
    const cat = JSON.parse(fs.readFileSync(cf, 'utf8')); let n = 0;
    for (const e of cat) {
      const w = W[e.name]; if (!w) continue;
      const want = { item: w.item ?? e.item, damage: w.damage ?? e.damage ?? 1, speed: w.speed ?? e.speed ?? 1 };
      if (want.item !== e.item || !same(want.damage, e.damage ?? 1) || !same(want.speed, e.speed ?? 1)) {
        n++; e.item = want.item;
        if (same(want.damage, 1)) delete e.damage; else e.damage = want.damage;
        if (same(want.speed, 1)) delete e.speed; else e.speed = want.speed;
      }
    }
    if (n && !dry) fs.writeFileSync(cf, JSON.stringify(cat, null, 1) + '\n');
    if (n) weaponChanged = true;
  }
  // enemy health = skeleton_drop's name key; weapons = its restore table
  const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const hp = Object.fromEntries(Object.entries(E).map(([k, e]) => [k, e.health]));
  const sdNeeded = weaponChanged || J(hp) !== J(st.hp ?? hp) || st.sdPending;
  if (dry) { say(`dry run: ${enemyChanged.size} enemy types, ${standChanged.size} stands${sdNeeded ? ', skeleton_drop rebuild' : ''}`); return; }

  // 3. skeleton_drop
  if (sdNeeded) {
    fs.writeFileSync(STATE, JSON.stringify({ ...st, hp, sdPending: true }));
    say('rebuilding skeleton_drop (enemy names/XP + item restore)...');
    execFileSync(process.execPath, [path.join(SD, 'gen.js')], { cwd: SD, env: { ...process.env, BALANCE: FILE }, stdio: 'pipe' });
    execFileSync(process.execPath, [path.join(SD, 'build.mjs')], { cwd: SD, stdio: 'pipe' });
    fs.copyFileSync(path.join(SD, 'skeleton_drop.brz'), path.join(PREFABS, 'skeleton_drop.brz'));
    await job([cmd('br.World.ClearRegion -8260 -7400 8000 6 6 6', 1500)], 'sdclr');
    const r = await job([cmd('br.Prefab.Load "skeleton_drop" -8260 -7400 8000 0 16', 3000)], 'sdld');
    say('skeleton_drop swapped' + (/overlapping|Missing brick|not found/.test(JSON.stringify(r)) ? ' WITH ERRORS' : ''));
    try { execFileSync(process.execPath, [path.join(TOOLS, 'reload.mjs'), 'progress'], { cwd: TOOLS, stdio: 'pipe' }); } catch { say('progress plugin reload failed'); }
  }
  fs.writeFileSync(STATE, JSON.stringify({ ...st, hp, sdPending: false }));

  // 4. live world: re-place what differs
  await job([cmd('br.World.Save', 5000)], 'save');
  await sleep(8000);
  const world = fs.readdirSync(WORLDS).filter(f => f.endsWith('.brdb')).map(f => [f, fs.statSync(path.join(WORLDS, f)).mtimeMs]).sort((a, b) => b[1] - a[1])[0][0];
  const copy = '/tmp/balance_scan.brdb';
  fs.copyFileSync(path.join(WORLDS, world), copy);
  const enemies = readEnemies(), live = liveSpawners(copy);
  const todo = live.filter(s => {
    const e = E[s.name], base = enemies[s.name];
    if (!e || !base) return false;
    return Object.entries(EF).some(([k, fld]) => e[k] != null && !same(s.data[fld], e[k])) || (e.weapon && s.weapon !== e.weapon);
  });
  say(`world "${world.replace(/\.brdb$/, '')}": ${live.length} spawners, ${todo.length} to re-place`);
  let placed = 0; const lost = [];
  for (let i = 0; i < todo.length; i += 15) {
    const part = todo.slice(i, i + 15);
    part.forEach((s, k) => {
      const m = s.move && (s.move.X || s.move.Y || s.move.Z) ? [s.move.X, s.move.Y, s.move.Z] : s.pos;
      s.prefab = `bal_sp_${i + k}`;
      execFileSync(process.execPath, ['homes.mjs', 'prefab', path.join(PREFABS, enemies[s.name].prefab + '.brz'), path.join(PREFABS, s.prefab + '.brz'), ...m.map(String)], { cwd: TOOLS, stdio: 'pipe' });
    });
    await job(part.map(s => cmd(`br.World.ClearRegion ${s.pos.join(' ')} 25 25 8`, 120)), 'spclr' + i);
    await sleep(1500);
    let left = part;
    for (const lift of [0, 12, 24, 36]) {
      if (!left.length) break;
      const res = await job(left.map(s => cmd(`br.Prefab.Load "${s.prefab}" ${s.pos[0]} ${s.pos[1]} ${s.pos[2] + lift} 0 16`, 400)), `spld${i}_${lift}`);
      const ok = left.filter((s, k) => !JSON.stringify(res[k] ?? '').includes('Component_BotSpawn'));
      placed += ok.length; left = left.filter(s => !ok.includes(s));
    }
    lost.push(...left);
    say(`spawners ${Math.min(i + 15, todo.length)}/${todo.length}`);
  }
  if (lost.length) say(`${lost.length} spawners not placed: ${lost.slice(0, 4).map(s => s.name + ' ' + s.pos.join(',')).join('; ')}`);

  // stands: every listed stand whose prefab changed this run
  const SL = path.join(HERE, 'stands.json');
  // the list is a union of old deploy lists: only spots with a shop button live count (others would clear map bricks)
  const btn = liveButtons(copy);
  const stands = (fs.existsSync(SL) ? JSON.parse(fs.readFileSync(SL, 'utf8')) : []).filter(s => standChanged.has(s.prefab)
    && btn.some(p => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) < 30 && Math.abs(p[2] - s.at[2]) < 40));
  // (the saved world can't tell where stands are: their items sit on 20k+ sub-grids) a stand is reloaded
  // only where its clear boxes removed something ("No bricks to clear" = no stand at that list spot)
  let restood = 0, rejects = 0;
  if (stands.length) say(`re-placing up to ${stands.length} shop stands...`);
  for (let i = 0; i < stands.length; i += 10) {
    const part = stands.slice(i, i + 10), boxes = part.map(standBoxes);
    const res = await job(boxes.flat().map(([x, y, z, a, b, c]) => cmd(`br.World.ClearRegion ${x} ${y} ${z} ${a} ${b} ${c}`, 150)), 'stclr' + i);
    let k = 0;
    const was = boxes.map(bx => bx.map(() => JSON.stringify(res[k++] ?? '')).some(t => !t.includes('No bricks to clear')));
    const go = part.filter((s, j) => was[j]);
    await sleep(1500);
    if (go.length) {
      const r = await job(go.map(s => cmd(`br.Prefab.Load "${s.prefab}" ${s.at[0]} ${s.at[1]} ${s.at[2]} 0 ${s.orient}`, 250)), 'stld' + i);
      r.forEach((x, j) => { if (/overlapping|Missing brick/.test(JSON.stringify(x))) { rejects++; console.log('REJECT', go[j].prefab, go[j].at.join(',')); } });
      restood += go.length;
    }
  }
  if (stands.length) say(`${restood} stands re-placed${rejects ? `, ${rejects} with rejects` : ''}`);
  await job([cmd('br.World.Save', 5000)], 'save2');
  say(`done: ${placed} spawners re-placed (${enemyChanged.size} enemy types changed), ${restood} stands, world saved`);
}

const [mode, arg] = process.argv.slice(2);
if (mode === 'dump') dump(arg ?? fs.readdirSync(WORLDS).filter(f => f.endsWith('.brdb') && !f.startsWith('backup')).map(f => path.join(WORLDS, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]);
else if (mode === 'apply') await apply(arg === 'dry');
else { console.error('usage: balance.mjs dump [world.brdb] | apply [dry]'); process.exit(1); }
