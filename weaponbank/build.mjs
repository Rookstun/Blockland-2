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
const TEMPLATE_DROP = 330; // plaza floor top 624; the sewer under the town paths is ~470..550
const lib = await import(pathToFileURL(path.join(here, '..', 'tools', 'brs4', 'dist.mjs')).href);
const { WorldReader, brdb } = lib;
const C = brdb.COMPONENTS;

// ---- catalog order (display order)
const RANK = ['Weapon_Knife', 'Weapon_ArmingSword', 'Weapon_Sabre', 'Weapon_Spatha', 'Weapon_Longsword', 'Weapon_Zweihander', 'Weapon_Bow'];
const rank = id => { const r = RANK.indexOf(CAT[id - 1].item); return r < 0 ? RANK.length : r; };
const ORDER = CAT.map((e, i) => i + 1).filter(id => !/^soda_/.test(CAT[id - 1].prefab))
  .sort((a, b) => rank(a) - rank(b) || CAT[a - 1].price - CAT[b - 1].price || a - b);
const N = ORDER.length, ZERO = '0'.repeat(N);

// ---- the owner's bricks
const own = WorldReader.from(fs.readFileSync(path.join(here, process.env.BANK_GEOM ?? 'bank_live.brz')));
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
var viewer: string = ""
var names: string[] = [${ORDER.map(id => q(CAT[id - 1].name)).join(', ')}]
var catIds: int[] = [${ORDER.join(', ')}]
// what the 5 panels show (weapon index, -1 = none): set during a press, broadcast next tick as bank.view by ONE
// buffered flush at the very end (a buffer emit ends its exec chain)
let flush: exec
out view: exec
${K.map(k => `out v${k}: int`).join('\n')}
on flush {
  emit view
}

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
${K.map(k => `    out v${k} = -1`).join('\n')}
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
${DEBUG ? `    PrintToConsole("bankdisp|${SLOT.map(I).join(',')}")\n` : ''}${K.map(k => `    out v${k} = ${SLOT[k]}`).join('\n')}
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
// Weapon plates (owner 2026-10-21: "items dont match their colors"; wires can't write PickupMeshColors): every weapon
// has its own pedestal plate with its full shop ItemSpawn (class, name, stats, COLOURS) on its own frozen loose grid,
// parked HOME_DROP under the counter (inside the ground). A hidden microchip on that grid hears bank.view
// (DataOut1..5 = the weapon index on panels 0..4, -1 none) and moves its grid onto panel k (SetLocation of its own
// grid, ReadBrickGrid) or back home. The static panels on the counter stay; a shown plate sits exactly on its panel.
const HOME_DROP = TEMPLATE_DROP;
async function build() {
  const probe = WorldReader.from(compiled);
  const rootBrick = [...probe.bricks(1)].find(b => probe.brickAssets().map(a => a.name ?? a)[b.asset_name_index] === 'B_1x1_Microchip');
  const b = await bundle(compiled, { owner: MAP_OWNER, offset: CHIP_POS.map((v, i) => v - rootBrick.position[i]), hide: true });
  const { w, O } = b;
  const extra = [];
  const extIdx = a => { let i = extra.findIndex(x => x.type === a.type && x.name === a.name); if (i < 0) { extra.push(a); i = extra.length - 1; } return b.ext.length + i; };
  const remap = data => { const d = structuredClone(data); for (const k of ['PressSound', 'ReleaseSound', 'Font', 'PickupClass']) if (typeof d[k] === 'number') { const a = ownExt[d[k]]; if (a) d[k] = extIdx(a); } return d; };
  const brickOf = (bk, extra = {}) => ({ asset: assetOf(bk), size: bk.size, position: bk.position, direction: bk.direction, rotation: bk.rotation,
    color: bk.color, material_intensity: bk.material_intensity, collision: bk.collision, visibility: bk.visibility, owner_index: O, ...extra });
  // world grid: the owner's bricks; panels are plain pedestals now (the weapon plates carry the items)
  w.addBrick(brickOf(counter));
  const btn = buttons.map(bk => w.addBrick(brickOf(bk, { components: (ownComps[bk.position.join()] ?? []).map(c => ({ type: c.typeName, data: remap(c.data ?? {}) })) })));
  const zone = w.addBrick(brickOf(plate, { components: (ownComps[plate.position.join()] ?? []).map(c => ({ type: c.typeName,
    data: c.typeName === 'Component_Internal_AttachedZone' ? { ...c.data, bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true } : c.data })) }));
  displays.forEach(bk => w.addBrick(brickOf(bk)));

  // the logic chip's own extra gates: presses / plate -> bank.act; outs -> bank.view
  const maxX = Math.max(...b.rootPos.map(p => p[0])), minY = Math.min(...b.rootPos.map(p => p[1])), z = b.rootPos[0][2];
  let gi = 0;
  const gate = (c, data = {}) => ({ h: b.addInside({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}), position: [maxX + 40 + (gi % 12) * 40, minY + Math.floor(gi++ / 12) * 40, z],
    color: [200, 200, 200], components: [{ type: c.NAME, data }] }), c });
  const end = (x, port) => (x.c ? { brick: x.h, component_type: x.c.NAME, port: x.c.PORTS[port] } : x);
  const wire = (a, ap, c, cp) => { const A = end(a, ap), B = end(c, cp); if (!A.port || !B.port) throw Error(`bad port ${ap} -> ${cp}`); w.addWire(A, B); };
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
  const view = gate(C.Exec_SendCustomEventGlobal, { EventName: 'bank.view', ...Object.fromEntries(K.map(k => [`DataIn${k + 1}`, { $variant: 'i64', value: -1 }])),
    DataIn6: { $variant: 'f64', value: 0 }, DataIn7: { $variant: 'f64', value: 0 }, DataIn8: { $variant: 'f64', value: 0 } });
  wire(b.outSource('view'), null, view, 'ExecIn');
  K.forEach(k => wire(b.outSource('v' + k), null, view, `DataIn${k + 1}`));

  // the weapon plates
  const [CX, CY, CZ] = counter.position;
  const vec = (x, y, zz) => ({ X: x, Y: y, Z: zz });
  ORDER.forEach((id, p) => {
    const home = [CX - 100 + (p % 11) * 20, CY, CZ - HOME_DROP - Math.floor(p / 11) * 12];
    const G = w.addBrickGrid({ location: vec(...home), frozen: true, owner_index: O,
      data: { BouyancyScale: 0, MassScale: 1, bEnableGravity: false, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: '' } });
    const bk = displays[0];
    w.addBrick({ asset: assetOf(bk), size: bk.size, position: [0, 0, 0], direction: bk.direction, rotation: bk.rotation, color: bk.color, material_intensity: bk.material_intensity,
      owner_index: O, components: [{ type: 'Component_ItemSpawn', data: { ...item[id].data, PickupClass: extIdx(item[id].pickup), bPickupEnabled: false, bRenderTranslucentWhenDisabled: false } }] }, G);
    // its mover chip, hidden under the plate (moves with the grid)
    const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [0, 0, -8], owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] }, G);
    const CG = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 120, Y: 80, Z: 2 } } });
    w.registerMicrochipLink(chipBrick, CG);
    let j = 0;
    const g2 = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}), position: [(j % 6) * 40, Math.floor(j++ / 6) * 40, 2], color: [200, 200, 200], owner_index: O,
      components: [{ type: c.NAME, data }] }, CG), c });
    const ev = g2(C.Event_CustomGlobal, { EventName: 'bank.view', bIsObjectEvent: false, ...Object.fromEntries([1, 2, 3, 4, 5].map(k => [`DataOut${k}`, { $variant: 'i64', value: -1 }])),
      DataOut6: { $variant: 'f64', value: 0 }, DataOut7: { $variant: 'f64', value: 0 }, DataOut8: { $variant: 'f64', value: 0 } });
    let v = g2(C.Expr_MakeVector, { X: home[0], Y: home[1], Z: home[2] }), vp = 'Output';
    K.forEach(k => {
      const eq = g2(C.Expr_CompareEqual, { InputA: { $variant: 'i64', value: -1 }, InputB: { $variant: 'i64', value: p } }); wire(ev, `DataOut${k + 1}`, eq, 'InputA');
      const at = g2(C.Expr_MakeVector, { X: panelPos[k][0], Y: panelPos[k][1], Z: panelPos[k][2] });
      const sel = g2(C.Expr_Select, { InputA: { $variant: 'f64', value: 0 }, InputB: { $variant: 'f64', value: 0 } });
      wire(v, vp, sel, 'InputA'); wire(at, 'Output', sel, 'InputB'); wire(eq, 'bOutput', sel, 'bSelectB');
      v = sel; vp = 'Output';
    });
    const rg = g2(C.ReadBrickGrid);
    const mv = g2(C.Exec_Entity_SetLocation, { Vector: vec(...home) });
    wire(rg, 'BrickGrid', mv, 'Entity'); wire(v, vp, mv, 'Vector'); wire(ev, 'ExecOut', mv, 'Exec');
  });
  return b.finish({ extraAssets: extra, description: 'Weapon bank (all wires)' });
}
const bytes = await build();
fs.writeFileSync(path.join(here, 'bank.brz'), bytes);
console.log(`bank.brz ${bytes.length} bytes: ${N} weapons, ${seeds.length} players seeded${DEBUG ? ', debug' : ''}`);
