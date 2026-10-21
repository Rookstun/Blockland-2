// WEAPON BANK (2026-10-21, owner: "this is a weapon bank. when a player unlocks a weapon from a shop
// it should be here for them for free ... only things you buy show up here and you can only have
// 1 copy of a weapon at a time"). The owner's hand-built bank at the spawn (clipboard
// weaponbank/bank_owner.brz, live at -30,-1060): 3 B_Button (prev / take / next), a
// BP_ZoneProjector plate in front, 5 B_2x2f_Plate_Center item displays on the counter.
// Writes (run on the server, it reads the shop stand prefabs):
//   OUT/bank.brz         the 3 buttons + the plate again (same look) + ONE hidden microchip on the counter's
//                        back face holding every gate (owner 2026-10-21: "put your shit in microchips"; they floated 1600 up):
//                        press / step on / off the plate -> global custom event bank.prev|take|next|enter|leave
//                        (character); the bank chip (chip.mjs) does the rest. NO omegga (owner 2026-10-21: "dont use omegga").
//                        + the 5 display panels, plain plates, pushed back PANEL_BACK (owner: "push the panels back 1").
//   OUT/bankitem_<id>.brz  per catalog weapon (catalog id = itemcatalog.json index + 1) a hidden plate with
//                        the ItemSpawn of its shop stand (class, name, damage, speed, colours), pickup off:
//                        the chip spawns these over the panels while a player stands on the plate.
//   node gen.mjs <brs4 dist> <itemcatalog.json> <Prefabs dir> <bank_owner.brz> <out dir> [X Y Z ORIENT]
// (owner 2026-10-21: "put it near spawn") bank.brz is local to the counter's centre (the counter is in it
// now); X Y Z = where the counter centre goes, ORIENT 16 (as built) or 18 (turned 180 deg). Default =
// in front of the plaza spawn point (0,200): counter at 0,300 facing the spawn.
import fs from 'node:fs';
import path from 'node:path';

const [DIST, CATF, PREFABS, OWNERF, OUT, AX = '0', AY = '300', AZ = '634', AO = '18'] = process.argv.slice(2);
const AT = [+AX, +AY, +AZ], ORIENT = +AO;
if (ORIENT !== 16 && ORIENT !== 18) throw Error('orient 16 or 18 only');
const toWorld = ([x, y, z]) => ORIENT === 16 ? [AT[0] + x, AT[1] + y, AT[2] + z] : [AT[0] - x, AT[1] - y, AT[2] + z];
const lib = await import(new URL(`file://${path.resolve(DIST).replace(/\\/g, '/').replace(/^([A-Z]:)/, '/$1')}`).href);
const { World, brdb, WorldReader } = lib;
const C = brdb.COMPONENTS;
const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const CAT = JSON.parse(fs.readFileSync(CATF, 'utf8'));
const PANEL_BACK = 10; // local -y = away from the player
const OLD_GATES = { base: [-250, -220, 1600], n: 24 }; // the pre-chip gate field (clear box in bank.json)
const HIDE = { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } };
fs.mkdirSync(OUT, { recursive: true });

// ---- the owner's bricks
const own = WorldReader.from(fs.readFileSync(OWNERF));
const ownAssets = own.brickAssets(), ownExt = own.externalAssets();
const ownBricks = [...own.bricks(1)];
const ownComps = {};
for (const ci of own.brickChunkIndex(1)) {
  const bricks = [...WorldReader.prototype.bricks.call({ globalData: () => own.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => own.brickChunkSoa(e, i) }, 1)];
  let comps = []; try { comps = own.componentChunk(1, ci.index).components; } catch {}
  for (const c of comps) (ownComps[bricks[c.brickIndex].position.join()] ??= []).push(c);
}
const assetOf = b => ownAssets[b.asset_name_index]?.name ?? ownAssets[b.asset_name_index];
const buttons = ownBricks.filter(b => assetOf(b) === 'B_Button').sort((a, b) => a.position[0] - b.position[0]);
const plate = ownBricks.find(b => assetOf(b) === 'BP_ZoneProjector');
const displays = ownBricks.filter(b => assetOf(b) === 'B_2x2f_Plate_Center').sort((a, b) => a.position[0] - b.position[0]);
const counter = ownBricks.find(b => assetOf(b) === 'PB_DefaultMicroBrick');
if (!counter) throw Error('bank_owner: no counter');
const PIV = counter.position, loc = p => p.map((v, i) => v - PIV[i]);
if (buttons.length !== 3 || !plate || displays.length !== 5) throw Error(`bank_owner: ${buttons.length} buttons, plate ${!!plate}, ${displays.length} displays`);

// asset-reference fields in component data are indexes into the prefab's externalAssets
const REF = ['PressSound', 'ReleaseSound', 'Font', 'PickupClass', 'ProjectileOverride'];
const remap = (data, fromExt, toExt) => {
  const d = structuredClone(data);
  for (const k of REF) if (typeof d[k] === 'number' || typeof d[k] === 'bigint') {
    const a = fromExt[Number(d[k])]; if (!a) continue;
    let i = toExt.findIndex(x => x.type === a.type && x.name === a.name);
    if (i < 0) { toExt.push(a); i = toExt.length - 1; }
    d[k] = i;
  }
  return d;
};
const brickOf = (b, extra = {}) => ({ asset: assetOf(b), size: b.size, position: b.position, direction: b.direction, rotation: b.rotation,
  color: b.color, material_intensity: b.material_intensity, collision: b.collision, visibility: b.visibility, ...extra });

// ---- display plates
const tpl = displays[2], tplSpawn = ownComps[tpl.position.join()].find(c => c.typeName === 'Component_ItemSpawn').data;
const made = [];
CAT.forEach((e, i) => {
  if (/^soda_/.test(e.prefab)) return;
  const sr = WorldReader.from(fs.readFileSync(path.join(PREFABS, e.prefab + '.brz')));
  let spawn = null;
  for (const g of sr.gridIds()) for (const ci of sr.brickChunkIndex(g)) {
    let cs = []; try { cs = sr.componentChunk(g, ci.index).components; } catch {}
    spawn ??= cs.find(c => c.typeName === 'Component_ItemSpawn')?.data ?? null;
  }
  if (!spawn) throw Error(`${e.prefab}: no ItemSpawn`);
  const ext = [];
  const s = remap(spawn, sr.externalAssets(), ext);
  const d = remap(tplSpawn, ownExt, []); // the owner's display settings (offset, bob, spin, rotation)
  for (const k of Object.keys(s)) if (k === 'PickupClass' || k === 'ProjectileOverride' || /Name|Damage|Speed|Color|Colour|Projectile|Scale/.test(k) && !/^Pickup(Bob|Spin|Animation|Offset)/.test(k)) d[k] = s[k];
  d.bPickupEnabled = false; d.bRenderTranslucentWhenDisabled = false;
  if ('bShowPickupEnabled' in d) d.bShowPickupEnabled = true;
  const w = new World(); const oi = w.addOwner(MAP_OWNER);
  w.addBrick({ ...brickOf(tpl, { position: [0, 0, 0] }), ...HIDE, owner_index: oi, components: [{ type: 'Component_ItemSpawn', data: d }] });
  w.makePrefab({});
  fs.writeFileSync(path.join(OUT, `bankitem_${i + 1}.brz`), w.toBrz({ bundle: { description: `Weapon bank item: ${e.name}` }, externalAssets: ext }));
  made.push(`${i + 1} ${e.name} (${ext.find(x => x.type === 'BRPickupBase')?.name})`);
});

// ---- the bank: buttons + plate + gates
const w = new World(); const oi = w.addOwner(MAP_OWNER);
const EXT = [];
let gi = 0;
// the chip: touching the counter's back face (local -y), mid height; invisible, no collision
const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [0, -counter.size[1] - 5, 0], owner_index: oi, visibility: false, collision: false,
  components: [{ type: 'Component_Internal_Microchip' }] });
const CG = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 140, Y: 40, Z: 0 }, PlaneExtent: { X: 180, Y: 80, Z: 2 } } });
w.registerMicrochipLink(chipBrick, CG);
const gate = (c, data = {}) => {
  const i = gi++;
  const h = w.addBrick({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}), position: [(i % 8) * 40, Math.floor(i / 8) * 40, 2], color: [200, 200, 200],
    owner_index: oi, components: [{ type: c.NAME, data }] }, CG);
  return { h, c };
};
// outside values reach the chip's gates through MicrochipInput pins (arcade cabinet pattern)
let pins = 0;
const pin = (src, port) => { const g = gate(C.MicrochipInput, { PortLabel: port + pins, PortOrder: pins++ }); wire(src, port, g, 'RER_Input'); return { h: g.h, c: { ...g.c, PORTS: { ...g.c.PORTS, [port]: g.c.PORTS.RER_Output } } }; };
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
const copyBrick = (b, comps) => w.addBrick({ ...brickOf(b, { position: loc(b.position) }), owner_index: oi, components: comps.map(c => ({ type: c.typeName, data: remap(c.data ?? {}, ownExt, EXT) })) });
// -> global custom event bank.<act> (character), as the casino machines send casino.play
const report = (exec, character, act) => {
  const s = gate(C.Exec_SendCustomEventGlobal, { EventName: 'bank.' + act, DataIn1: { $variant: 'weak_object', value: null },
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(k => [`DataIn${k}`, { $variant: 'f64', value: 0 }])) });
  wire(exec[0], exec[1], s, 'ExecIn'); wire(character[0], character[1], s, 'DataIn1');
};
['prev', 'take', 'next'].forEach((act, i) => {
  const b = buttons[i];
  const h = copyBrick(b, ownComps[b.position.join()] ?? []);
  const B = { h, c: C.AnimatedButton };
  const edge = gate(C.Expr_EdgeDetectorExec); wire(pin(B, 'bHeld'), 'bHeld', edge, 'Input');
  report([edge, 'OnRisingEdge'], [pin(B, 'Character'), 'Character'], act);
});
{
  const zc = (ownComps[plate.position.join()] ?? []).map(c => c.typeName === 'Component_Internal_AttachedZone'
    ? { ...c, data: { ...c.data, bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true } } : c);
  const Z = { h: copyBrick(plate, zc), c: C.AttachedZone };
  const zr = pin(Z, 'ZoneRef');
  const ent = gate(C.CharacterZoneEvent_Entered); wire(zr, 'ZoneRef', ent, 'Zone');
  report([ent, 'Exec'], [ent, 'Character'], 'enter');
  const left = gate(C.CharacterZoneEvent_Left); wire(zr, 'ZoneRef', left, 'Zone');
  report([left, 'Exec'], [left, 'Character'], 'leave');
}
copyBrick(counter, []);
const panelAt = b => { const p = loc(b.position); return [p[0], p[1] - PANEL_BACK, p[2]]; };
for (const b of displays) w.addBrick({ ...brickOf(b, { position: panelAt(b) }), owner_index: oi });
w.makePrefab({});
fs.writeFileSync(path.join(OUT, 'bank.brz'), w.toBrz({ bundle: { description: 'Weapon bank: buttons + plate + gates' }, externalAssets: EXT }));
// where things are, for the plugin + reloads
fs.writeFileSync(path.join(OUT, 'bank.json'), JSON.stringify({
  at: AT, orient: ORIENT, slots: displays.map(b => toWorld(panelAt(b))), oldSlots: displays.map(b => toWorld(loc(b.position))),
  buttons: buttons.map(b => toWorld(loc(b.position))), plate: toWorld(loc(plate.position)), chip: toWorld([0, -counter.size[1] - 5, 0]), gates: gi, oldGates: { base: toWorld(OLD_GATES.base), n: OLD_GATES.n },
}, null, 1));
console.log(`bank.brz: 3 buttons + plate + ${gi} gates; ${made.length} displays\n  ${made.join('\n  ')}`);
