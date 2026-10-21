// WEAPON BANK, one prefab, all wires (owner 2026-10-21: "dont use omegga"; "the pedestals need the item component
// on them. dont spawn them in as entites"; "push the panels back 1"; "when the player leaves the zone the weapons
// should dissapear, keep the panels loaded just swap their items").
//   node weaponbank/build.mjs   -> weaponbank/bank.gen.ws, weaponbank/bank.brz
//   Load: br.Prefab.Load "bank" 0 0 0 0 16 (world coordinates)
// Bricks = the owner's live layout (bank_live.brz = Prefab.SaveRegion of the bank after the owner reworked it in game,
//   2026-10-21: counter 100x20 at 0,305, panels y 305, buttons y 293, chip 0,320): counter, 3 B_Button, BP_ZoneProjector
//   plate, 5 B_2x2f_Plate_Center panels each WITH an ItemSpawn (pickup off, colour override off; display settings from
//   the owner's first build bank_owner.brz). The player stands on the plate facing +y: their left is +x, so buttons and
//   panels run by x DESCENDING (prev, take, next; panel 0 = leftmost).
// One hidden B_1x1_Microchip flush on the counter's back holds everything else:
//   - press / plate enter / plate leave -> global event bank.act (character, op 0 enter 1 prev 2 next 3 take 4 leave)
//   - the logic (wirescript, generated here): owned[uid] = one char per weapon in display order, filled by
//     skeleton_drop's global event bank.inv (uid, "|name|..|" = the player's named slots: bought weapons; the free
//     Derringer by class); per press it works out which weapon each panel shows and fires showK (out tpK = weapon) or
//     hideK; take = AddInventoryItemAdv with the shop's stats unless the player holds it (by name) or took it < 15 s
//     ago, then InvName0/InvPend so skeleton_drop names the new slot.
//   - per panel: showK -> template ref (ArrayVar[tpK]) -> GetComponent -> Get/Set PickupClass, ItemNameOverride,
//     DamageMultiplier, WeaponSpeedMultiplier onto the panel's ItemSpawn; hideK -> bPickupEnabled false (owner: "dont
//     set the scale, just set allow pickup to false"; a disabled pickup still shows, so the last weapon stays up).
// 55 hidden template micro bricks (the weapon's ItemSpawn from items/bankitem_<id>.brz, scale 0 so they show nothing) on a
//   frozen loose brick grid inside the counter: an ItemSpawn can't attach on a microchip grid ("Failed to attach
//   component, reason: 3").
//     (The wirescript compiler can't write PickupClass, and wires can't write PickupMeshColors at all: every tier of a
//     weapon shows the game's default colours.)
// State lives in the chip's Map Vars (saved with the world). A rebuild starts from seeds.json.
// BANK_DEBUG=1 prints bankdbg|op|uid|first and bankdisp|slots per press.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundle } from '../tools/wsbundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CAT = JSON.parse(fs.readFileSync(path.join(here, 'itemcatalog.json'), 'utf8'));
const SEEDS = JSON.parse(fs.readFileSync(path.join(here, 'seeds.json'), 'utf8'));
const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const DEBUG = process.env.BANK_DEBUG === '1';
const SKY_Z = 20000; // templates: world-grid bricks this high (an empty chunk, out of sight; an ItemSpawn always draws its item)
const lib = await import(pathToFileURL(path.join(here, '..', 'tools', 'brs4', 'dist.mjs')).href);
const { WorldReader, brdb } = lib;
const C = brdb.COMPONENTS;

// ---- catalog order (display order)
const RANK = ['Weapon_Knife', 'Weapon_ArmingSword', 'Weapon_Sabre', 'Weapon_Spatha', 'Weapon_Longsword', 'Weapon_Zweihander', 'Weapon_Bow'];
const rank = id => { const r = RANK.indexOf(CAT[id - 1].item); return r < 0 ? RANK.length : r; };
const ORDER = CAT.map((e, i) => i + 1) // every shop item, sodas too (owner: "no item should be left out")
  .sort((a, b) => rank(a) - rank(b) || CAT[a - 1].price - CAT[b - 1].price || a - b);
const N = ORDER.length, ZERO = '0'.repeat(N);

// ---- the owner's bricks
const own = WorldReader.from(fs.readFileSync(path.join(here, process.env.BANK_GEOM ?? 'bank_owner2.brz')));
const first0 = WorldReader.from(fs.readFileSync(path.join(here, 'bank_owner.brz')));
const ownAssets = own.brickAssets().map(a => a.name ?? a), ownExt = own.externalAssets();
const ownBricks = [...own.bricks(1)];
const ownComps = {};
for (const ci of own.brickChunkIndex(1)) {
  const bs = [...WorldReader.prototype.bricks.call({ globalData: () => own.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => own.brickChunkSoa(e, i) }, 1)];
  let comps = []; try { comps = own.componentChunk(1, ci.index).components; } catch {}
  for (const c of comps) (ownComps[bs[c.brickIndex].position.join()] ??= []).push(c);
}
const assetOf = b => ownAssets[b.asset_name_index];
const buttons = ownBricks.filter(b => assetOf(b) === 'B_Button').sort((a, b) => b.position[0] - a.position[0]);
const plate = ownBricks.find(b => assetOf(b) === 'BP_ZoneProjector');
const displays = ownBricks.filter(b => assetOf(b) === 'B_2x2f_Plate_Center').sort((a, b) => b.position[0] - a.position[0]);
const counter = ownBricks.filter(b => assetOf(b) === 'PB_DefaultMicroBrick').sort((a, b) => b.size[0] * b.size[1] * b.size[2] - a.size[0] * a.size[1] * a.size[2])[0];
const liveChip = ownBricks.find(b => assetOf(b) === 'B_1x1_Microchip');
if (buttons.length !== 3 || !plate || displays.length !== 5 || !counter) throw Error('bank_owner.brz: unexpected bricks');
const loc = p => p; // world frame
const panelPos = displays.map(b => b.position);
const CHIP_POS = liveChip ? liveChip.position : [counter.position[0], counter.position[1] + counter.size[1] + 5, counter.position[2]];
// the owner's display settings (offset, bob, spin) from the first build (its PickupClass is replaced below)
const ownSpawn = (() => { for (const ci of first0.brickChunkIndex(1)) for (const c of first0.componentChunk(1, ci.index).components) if (c.typeName === 'Component_ItemSpawn') return c.data; })();

// ---- item ItemSpawn data per weapon (items/bankitem_<id>.brz, made by gen.mjs on the server from the shop stands)
const item = {};
for (const id of ORDER) {
  const r = WorldReader.from(fs.readFileSync(path.join(here, 'items', `bankitem_${id}.brz`)));
  for (const ci of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ci.index).components)
    if (c.typeName === 'Component_ItemSpawn') item[id] = { data: c.data, pickup: r.externalAssets()[c.data.PickupClass] };
  if (!item[id]?.pickup) throw Error(`bankitem_${id}: no ItemSpawn`);
}

// ---- the logic chip (wirescript)
const q = s => JSON.stringify(s);
const I = v => '$' + '{' + v + '}';
const bitsOf = list => ORDER.map(id => (list.includes(id) ? '1' : '0')).join('');
const seeds = Object.entries(SEEDS).filter(([, l]) => l.some(id => ORDER.includes(id)));
const advArgs = e => [e.damage != null && `damage = ${e.damage.toFixed(3)}`, e.speed != null && `speed = ${e.speed.toFixed(3)}`, e.scale != null && `scale = ${e.scale.toFixed(3)}`,
  `itemName = ${q(e.name)}`, e.colors && `overrideColors = true, meshColors = [${e.colors.map(([r, g, b]) => `ColorSRGB(${r}, ${g}, ${b}, 255)`).join(', ')}]`].filter(Boolean).join(', ');
const K = [0, 1, 2, 3, 4], SLOT = ['l2', 'l1', 'cur', 'r1', 'r2'];
const ws = `// generated by weaponbank/build.mjs: the weapon bank at the plaza spawn (see that file)
var owned: Map<string, string> = { ${seeds.map(([u, l]) => `${q(u)}: ${q(bitsOf(l))}`).join(', ')} }
var ownedR: Map<string, string> = { ${seeds.map(([u, l]) => `${q(u)}: ${q([...bitsOf(l)].reverse().join(''))}`).join(', ')} }
var held: Map<string, string>
var sel: Map<string, int>
var gaveAt: Map<string, int>
var shown: Map<int, int>
var viewer: string = ""
var names: string[] = [${ORDER.map(id => q(CAT[id - 1].name)).join(', ')}]
var catIds: int[] = [${ORDER.join(', ')}]
// per panel: the press records act (1 show tpK, 2 hide) and ONE buffered flush at the very end fires them next tick
// (a buffer emit ends its exec chain: emitting per slot mid-handler ran only the first changed slot and no status line)
let flush: exec
${K.map(k => `out tp${k}: int
out show${k}: exec
out hide${k}: exec
var act${k}: int = 0
on flush {
  let a = act${k}
  act${k} = 0
  if a == 1 {
    emit show${k}
  } else if a == 2 {
    emit hide${k}
  }
}`).join('\n')}

// a purchase shows up as a named slot: unlock it
on GlobalCustomEvent("bank.inv") -> (uid: string, line: string) {
  held.set(uid, line)
  let o0 = owned.get(uid)
  let o = if o0.Length() == ${N} then o0 else ${q(ZERO)}
${ORDER.map((id, p) => `  let b${p} = if o.Substring(${p}, 1) == "1" || line.Contains(${q('|' + CAT[id - 1].name + '|')}) then "1" else "0"`).join('\n')}
  owned.set(uid, "${ORDER.map((_, p) => I('b' + p)).join('')}")
  ownedR.set(uid, "${ORDER.map((_, p) => I('b' + (N - 1 - p))).join('')}")
}

on GlobalCustomEvent("bank.act") -> (who: character, op: int) {
  let pc = who.ControllerOf()
  let uid = pc.GetUserId()
  let b0 = owned.get(uid)
  let bits = if b0.Length() == ${N} then b0 else ${q(ZERO)}
  let r0 = ownedR.get(uid)
  let rev = if r0.Length() == ${N} then r0 else ${q(ZERO)}
  let first = bits.Find("1")
${DEBUG ? `  PrintToConsole("bankdbg|${I('op')}|${I('uid')}|${I('first')}")\n` : ''}  // nothing to show: the user left, or has nothing yet
  let none = (op == 4 && uid == viewer) || (op != 4 && first < 0)
  if none {
${K.map(k => `    if shown.get(${k}) > 0 {
      act${k} = 2
    }`).join('\n')}
    shown.clear()
    viewer = ""
    if op != 4 {
      pc.ShowStatusMessage("<color=\\"ffd34d\\">Weapon bank</>: empty. Weapons you buy at the shops show up here, free to take again.")
    }
  } else if op != 4 {
    viewer = uid
    let sv = sel.get(uid) - 1
    let cur0 = if sv >= 0 && bits.Substring(sv, 1) == "1" then sv else first
    let nx = bits.Find("1", false, cur0 + 1)
    let pq = rev.Find("1", false, ${N} - cur0)
    let lastQ = rev.Find("1")
    let cur = if op == 1 then (if pq < 0 then ${N - 1} - lastQ else ${N - 1} - pq) else (if op == 2 then (if nx < 0 then first else nx) else cur0)
    sel.set(uid, cur + 1)
    let r1 = bits.Find("1", false, cur + 1)
    let r2 = if r1 < 0 then -1 else bits.Find("1", false, r1 + 1)
    let lq1 = rev.Find("1", false, ${N} - cur)
    let l1 = if lq1 < 0 then -1 else ${N - 1} - lq1
    let lq2 = if l1 < 0 then -1 else rev.Find("1", false, ${N} - l1)
    let l2 = if lq2 < 0 then -1 else ${N - 1} - lq2
${K.map(k => `    let was${k} = shown.get(${k}) - 1`).join('\n')}
${DEBUG ? `    PrintToConsole("bankdisp|${SLOT.map(I).join(',')}|was ${K.map(k => I('was' + k)).join(',')}")\n` : ''}${K.map(k => `    if was${k} != ${SLOT[k]} {
      if ${SLOT[k]} >= 0 {
        out tp${k} = ${SLOT[k]}
        act${k} = 1
      } else {
        act${k} = 2
      }
      shown.set(${k}, ${SLOT[k]} + 1)
    }`).join('\n')}
    let count = ${N} - bits.Replace("1", "").Length()
    let pos = bits.Substring(0, cur + 1).Replace("0", "").Length()
    let nm = names.get(cur)
    if op == 3 {
      let key = "${I('uid')}:${I('cur')}"
      let last = gaveAt.get(key)
      let now = GetUnixTime()
      if held.get(uid).Contains("|${I('nm')}|") || (last > 0 && now - last < 15) {
        pc.ShowStatusMessage("<color=\\"ff8888\\">You already have a ${I('nm')}.</> One at a time.")
      } else {
        gaveAt.set(key, now)
${ORDER.map((id, p) => `        ${p ? '} else ' : ''}if cur == ${p} {
          who.AddInventoryItemAdv($BRItemBase/${CAT[id - 1].item}, ${advArgs(CAT[id - 1])})`).join('\n')}
        }
        // skeleton_drop names the plain slot it finds next (as after a restart), so it keeps its name
        pc.SetLeaderboard("InvName0", catIds.get(cur))
${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => `        pc.SetLeaderboard("InvName${j}", 0)`).join('\n')}
        pc.SetLeaderboard("InvPend", 1)
        pc.ShowStatusMessage("<color=\\"88ff88\\">${I('nm')}</> taken from your bank.")
      }
    } else {
      pc.ShowStatusMessage("<color=\\"ffd34d\\">${I('nm')}</> (${I('pos')}/${I('count')}) - middle button: take it")
    }
  }
  buffer emit flush
}
`;
fs.writeFileSync(path.join(here, 'bank.gen.ws'), ws);
const sdk = path.join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
let bad = 0;
for (const d of JSON.parse(diag(ws, 'bank', '{}') || '[]')) { console.error(`${d.severity} ${d.code} line ${d.startLine}: ${d.message}`); if (d.severity === 'error') bad++; }
if (bad) process.exit(1);
const compiled = new Uint8Array(compile(ws, 'bank', '{}', '{}'));

// ---- the prefab
const R0 = { GridPersistentIndex: 0, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 4294967295 };
const NOREF = { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 };
const COPY = ['PickupClass', 'ItemNameOverride', 'DamageMultiplier', 'WeaponSpeedMultiplier'];
async function build(refs) {
  const probe = WorldReader.from(compiled);
  const rootBrick = [...probe.bricks(1)].find(b => probe.brickAssets().map(a => a.name ?? a)[b.asset_name_index] === 'B_1x1_Microchip');
  const b = await bundle(compiled, { owner: MAP_OWNER, offset: CHIP_POS.map((v, i) => v - rootBrick.position[i]), hide: true });
  const { w, O } = b;
  const extra = [];
  const extIdx = a => { let i = extra.findIndex(x => x.type === a.type && x.name === a.name); if (i < 0) { extra.push(a); i = extra.length - 1; } return b.ext.length + i; };
  const remap = data => { const d = structuredClone(data); for (const k of ['PressSound', 'ReleaseSound', 'Font', 'PickupClass']) if (typeof d[k] === 'number') { const a = ownExt[d[k]]; if (a) d[k] = extIdx(a); } return d; };
  const IS = extIdx({ type: 'BrickComponentTypeBase', name: 'Component_ItemSpawn' });
  const brickOf = (bk, extra = {}) => ({ asset: assetOf(bk), size: bk.size, position: loc(bk.position), direction: bk.direction, rotation: bk.rotation,
    color: bk.color, material_intensity: bk.material_intensity, collision: bk.collision, visibility: bk.visibility, owner_index: O, ...extra });
  // world grid: the owner's bricks, panels with ItemSpawn (nothing shown)
  w.addBrick(brickOf(counter));
  const btn = buttons.map(bk => w.addBrick(brickOf(bk, { components: (ownComps[bk.position.join()] ?? []).map(c => ({ type: c.typeName, data: remap(c.data ?? {}) })) })));
  const zone = w.addBrick(brickOf(plate, { components: (ownComps[plate.position.join()] ?? []).map(c => ({ type: c.typeName,
    data: c.typeName === 'Component_Internal_AttachedZone' ? { ...c.data, bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true } : c.data })) }));
  const panelData = { ...ownSpawn, PickupClass: extIdx(item[ORDER[0]].pickup), ProjectileOverride: null, bPickupEnabled: false, bRenderTranslucentWhenDisabled: true, bOverridePickupColors: false, ItemNameOverride: '', DamageMultiplier: 1, WeaponSpeedMultiplier: 1 };
  // panels: the owner's world-grid plates, each with an ItemSpawn (owner: "no entities or prefab spawning just change
  // the fucking item spawn or use add set get component")
  const panelH = displays.map(bk => w.addBrick(brickOf(bk, { components: [{ type: 'Component_ItemSpawn', data: panelData }] })));

  // inside the chip: gates on a field past the compiled gates
  const maxX = Math.max(...b.rootPos.map(p => p[0])), minY = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  let gi = 0;
  const HID = { visibility: false, collision: false };
  const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}), position: [maxX + 40 + (gi % 12) * 40, minY + Math.floor(gi++ / 12) * 40, z],
    color: [200, 200, 200], components: [{ type: c.NAME, data }] }), c });
  const wire = (a, ap, c, cp) => {
    const A = a.c ? { brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] } : a, B = c.c ? { brick: c.h, component_type: c.c.NAME, port: c.c.PORTS[cp] } : c;
    if (!A.port || !B.port) throw Error(`bad port ${ap} -> ${cp}`);
    w.addWire(A, B);
  };
  // presses / plate -> bank.act
  const send = (exec, character, op) => {
    const s = gate(C.Exec_SendCustomEventGlobal, { EventName: 'bank.act', DataIn1: { $variant: 'weak_object', value: null }, DataIn2: { $variant: 'i64', value: op },
      ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(k => [`DataIn${k}`, { $variant: 'f64', value: 0 }])) });
    wire(exec, null, s, 'ExecIn'); wire(character, null, s, 'DataIn1');
  };
  const BTN = 'Component_Internal_AnimatedButton';
  [1, 3, 2].forEach((op, i) => {
    const edge = gate(C.Expr_EdgeDetectorExec);
    wire({ brick: btn[i], component_type: BTN, port: 'bHeld' }, null, edge, 'Input');
    send({ brick: edge.h, component_type: edge.c.NAME, port: 'OnRisingEdge' }, { brick: btn[i], component_type: BTN, port: 'Character' }, op);
  });
  for (const [ev, op] of [[C.CharacterZoneEvent_Entered, 0], [C.CharacterZoneEvent_Left, 4]]) {
    const e = gate(ev); wire({ brick: zone, component_type: C.AttachedZone.NAME, port: 'ZoneRef' }, null, e, 'Zone');
    send({ brick: e.h, component_type: e.c.NAME, port: 'Exec' }, { brick: e.h, component_type: e.c.NAME, port: 'Character' }, op);
  }
  // templates: hidden world-grid micro bricks SKY_Z up over the bank (an ItemSpawn always draws its item: hidden brick,
  // PickupScale 0 and pickup off all still showed): one per shop item with its stand's ItemSpawn, plus EMPTY = a plain
  // knife (owner: "when not using an item slot make it a knife thats pickup is disabled with the display if pickup unavailable")
  const tplPos = [...ORDER, 0].map((_, p) => [counter.position[0] - 40 + (p % 11) * 8, counter.position[1], SKY_Z + Math.floor(p / 11) * 4]);
  const knife = Object.values(item).find(x => x.pickup.name === 'BP_ItemPickup_Knife');
  [...ORDER.map(id => ({ ...item[id].data, PickupClass: extIdx(item[id].pickup) })),
   { ...knife.data, PickupClass: extIdx(knife.pickup), ItemNameOverride: '', DamageMultiplier: 1, WeaponSpeedMultiplier: 1 }]
    .forEach((data, p) => w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [1, 1, 1], position: tplPos[p], color: [96, 109, 112], owner_index: O, ...HID,
      components: [{ type: 'Component_ItemSpawn', data: { ...data, bPickupEnabled: false, bOverridePickupColors: false } }] }));
  const tpls = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: ORDER.map((_, p) => ({ $variant: 'BRSavedBrickRef', value: refs?.tpl[p] ?? NOREF })) } });
  const EMPTY = refs?.tpl[N] ?? NOREF;
  // copy the template's item onto the panel, then the display flags
  const copyItem = (gt, gp, exec, translucent) => {
    let ex = exec;
    for (const prop of COPY) {
      const g = gate(C.Exec_GetComponentProperty, { Component: { Brick: R0, ComponentTypeIndex: 0 }, PropertyName: prop, ComponentType: IS });
      wire(gt, 'Component', g, 'Component'); wire(ex[0], ex[1], g, 'Exec');
      const s = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'f64', value: 0 }, Component: { Brick: R0, ComponentTypeIndex: 0 }, PropertyName: prop, ComponentType: IS });
      wire(gp, 'Component', s, 'Component'); wire(g, 'Value', s, 'Value'); wire(g, 'ExecOut', s, 'Exec');
      ex = [s, 'ExecOut'];
    }
    for (const [prop, v] of [['bPickupEnabled', false], ['bRenderTranslucentWhenDisabled', translucent]]) {
      const s = gate(C.Exec_SetComponentProperty, { Value: { $variant: 'bool', value: v }, Component: { Brick: R0, ComponentTypeIndex: 0 }, PropertyName: prop, ComponentType: IS });
      wire(gp, 'Component', s, 'Component'); wire(ex[0], ex[1], s, 'Exec');
      ex = [s, 'ExecOut'];
    }
    return ex;
  };
  // COLOURS (owner screenshot: the ItemSpawn's own wire ports "Colors 1".. = internal PickupMeshColors.0..7): no gate can
  // read or set them, but a WIRE into the component's port drives them. Table = every item's 8 shop colours (linear) +
  // its override flag, then the EMPTY knife (white, no override); per panel 8 + 1 ArrayVar_Get gates wired into the ports,
  // re-pointed at the shown item's row on every show / hide.
  const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const WHITE = { R: 1, G: 1, B: 1, A: 1 };
  const rows = [...ORDER.map(id => item[id].data), { bOverridePickupColors: false, PickupMeshColors: [] }];
  const colTable = gate(C.ArrayVar, { Value: { $elementType: 'LinearColor', $array: rows.flatMap(d => Array.from({ length: 8 }, (_, j) => {
    const c = d.PickupMeshColors?.[j]; return c ? { R: lin(c.R), G: lin(c.G), B: lin(c.B), A: (c.A ?? 255) / 255 } : WHITE; })) } });
  const ovTable = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: rows.map(d => ({ $variant: 'bool', value: !!d.bOverridePickupColors })) } });
  const paint = (k, ex, hx) => {
    const cur = gate(C.Var, { Value: { $variant: 'i64', value: N } });
    const kN = gate(C.Var, { Value: { $variant: 'i64', value: N } });
    const s1 = gate(C.Exec_Var_Set); wire(cur, 'VarRef', s1, 'VarRef'); wire(b.outSource('tp' + k), null, s1, 'Value'); wire(ex[0], ex[1], s1, 'Exec');
    const s2 = gate(C.Exec_Var_Set); wire(cur, 'VarRef', s2, 'VarRef'); wire(kN, 'Value', s2, 'Value'); wire(hx[0], hx[1], s2, 'Exec');
    const un = gate(C.Exec_Union); wire(s1, 'ExecOut', un, 'ExecA'); wire(s2, 'ExecOut', un, 'ExecB');
    const vg = gate(C.Exec_Var_Get); wire(cur, 'VarRef', vg, 'VarRef'); wire(un, 'ExecOut', vg, 'Exec'); // fresh value (a Var read after its Set in one chain is stale)
    const P = { brick: panelH[k], component_type: 'Component_ItemSpawn' };
    const og = gate(C.Exec_ArrayVar_Get); wire(ovTable, 'ArrayVarRef', og, 'ArrayVarRef'); wire(vg, 'Value', og, 'Index'); wire(vg, 'ExecOut', og, 'Exec');
    wire(og, 'Value', { ...P, port: 'bOverridePickupColors' }, null);
    const mul = gate(C.Expr_MathMultiply, { InputA: { $variant: 'i64', value: 0 }, InputB: { $variant: 'i64', value: 8 } }); wire(vg, 'Value', mul, 'InputA');
    let ex2 = [og, 'ExecOut'];
    for (let j = 0; j < 8; j++) {
      const add = gate(C.Expr_MathAdd, { InputA: { $variant: 'i64', value: 0 }, InputB: { $variant: 'i64', value: j } }); wire(mul, 'Output', add, 'InputA');
      const cg = gate(C.Exec_ArrayVar_Get); wire(colTable, 'ArrayVarRef', cg, 'ArrayVarRef'); wire(add, 'Output', cg, 'Index'); wire(ex2[0], ex2[1], cg, 'Exec');
      wire(cg, 'Value', { ...P, port: `PickupMeshColors.${j}` }, null);
      ex2 = [cg, 'ExecOut'];
    }
    return ex2;
  };
  // per panel: show = the item's template, solid; hide = the EMPTY knife, translucent
  K.forEach(k => {
    const pref = refs?.panel[k] ?? NOREF;
    const get = gate(C.Exec_ArrayVar_Get); wire(tpls, 'ArrayVarRef', get, 'ArrayVarRef'); wire(b.outSource('tp' + k), null, get, 'Index');
    wire(b.outSource('show' + k), null, get, 'Exec');
    const gt = gate(C.Exec_GetComponent, { Brick: R0, ComponentType: IS }); wire(get, 'Value', gt, 'Brick'); wire(get, 'ExecOut', gt, 'Exec');
    const gp = gate(C.Exec_GetComponent, { Brick: pref, ComponentType: IS }); wire(gt, 'ExecOut', gp, 'Exec');
    const ex = copyItem(gt, gp, [gp, 'ExecOut'], false);
    const ht = gate(C.Exec_GetComponent, { Brick: EMPTY, ComponentType: IS }); wire(b.outSource('hide' + k), null, ht, 'Exec');
    const hp = gate(C.Exec_GetComponent, { Brick: pref, ComponentType: IS }); wire(ht, 'ExecOut', hp, 'Exec');
    const hx = copyItem(ht, hp, [hp, 'ExecOut'], true);
    paint(k, ex, hx);
    if (DEBUG) {
      const dbg = (fmt, A, exec) => {
        const f = gate(C.Expr_String_FormatText, { FormatString: fmt }); if (A) wire(A[0], A[1], f, 'InputA');
        const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); wire(exec[0], exec[1], pr, 'Exec');
      };
      dbg(`bankshow|${k}|{A}`, [b.outSource('tp' + k), null], ex);
      dbg(`bankhide|${k}`, null, hx);
    }
  });
  return { bytes: b.finish({ extraAssets: extra, description: 'Weapon bank (all wires)' }), tplPos };
}
// refs of the panels (world grid) and templates (the chip's grid) in the written file, matched by position order
function readRefs(bytes) {
  const r = WorldReader.from(bytes);
  const assets = r.brickAssets().map(a => a.name ?? a);
  const found = { 1: [] }, inner = [];
  for (const g of r.gridIds()) {
    const chunks = r.brickChunkIndex(g);
    let ci = 0, left = chunks[0]?.numBricks ?? 0, i = 0;
    for (const bk of r.bricks(g)) {
      while (left === 0) { ci++; i = 0; left = chunks[ci].numBricks; }
      const c = chunks[ci].index;
      const ref = { GridPersistentIndex: g, ChunkIndex: { X: c.x, Y: c.y, Z: c.z }, BrickIndexInChunk: i };
      if (g === 1 && assets[bk.asset_name_index] === 'B_2x2f_Plate_Center') found[1].push({ pos: bk.position, ref });
      if (g === 1 && assets[bk.asset_name_index] === 'PB_DefaultMicroBrick' && bk.size.join() === '1,1,1') inner.push({ pos: bk.position, ref });
      i++; left--;
    }
  }
  const key = p => p.join(',');
  // same order as panelPos (x descending)
  const panel = panelPos.map(q => found[1].find(x => key(x.pos) === key(q))?.ref);
  if (panel.some(x => !x)) throw Error('panel refs not found');
  return { panel, inner };
}
const first = await build(null);
const r1 = readRefs(first.bytes);
const tpl = first.tplPos.map(q => r1.inner.find(x => x.pos.join() === q.join())?.ref);
if (r1.inner.length !== N + 1 || tpl.some(x => !x)) throw Error(`template refs: ${r1.inner.length} inner plates, ${tpl.filter(Boolean).length} matched`);
const second = await build({ panel: r1.panel, tpl });
// the refs must point at the same bricks after the second write
const r2 = readRefs(second.bytes);
if (JSON.stringify(r2.panel) !== JSON.stringify(r1.panel) || JSON.stringify(r2.inner) !== JSON.stringify(r1.inner)) throw Error('refs moved between writes');
fs.writeFileSync(path.join(here, 'bank.brz'), second.bytes);
console.log(`bank.brz ${second.bytes.length} bytes: ${N} weapons, ${seeds.length} players seeded${DEBUG ? ', debug' : ''}`);
