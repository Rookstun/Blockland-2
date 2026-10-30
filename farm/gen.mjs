// Farm plot (2026-10-29, owner clipboard farm_clip.brz: planter of light-brown dirt + 24 B_Small_Flower,
// grey stone basin with a water zone, metal bucket (physics grid) with a bearing-jointed handle).
// Loop: dip the bucket in the basin -> water shows inside it; tip it ~90 deg -> splash, bucket empties;
// tipped over the dirt -> dirt turns dark brown, the hidden flower stacks grow a layer every GROW/3 s; click the dirt
// (Button) when grown -> flowers hide, dirt dries, a flower bundle prop spawns.
// Two hidden chips talk by global events (multi-farm safe):
//   farm chip (world grid): basin zone Entered (tag 'bucket') -> farm.fill {bucket location};
//     farm.pour -> if the dirt zone holds the bucket and the dirt is dry: wet, restart grow stopwatch.
//   bucket chip (bucket grid): farm.fill within 80 of itself -> full; tipped (up.Z < 0.3) while full ->
//     empty, splash, farm.pour.
//   node farm/gen.mjs farm/farm_clip.brz farm/farm.brz
import fs from 'fs';
import { mk } from '../ea32test/lib.mjs';
const [IN, OUT] = process.argv.slice(2);
const DIST = new URL('../tools/brs4/dist.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const GROW = 30, MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
const DRY = [198, 133, 75], WET = [92, 52, 22], FLOWER = [83, 106, 12], WATER = [40, 110, 200];
const SHIFT = [315, 735, -594]; // clip's world-grid coords -> prefab space (its addedGlobalGridOffset, y/z snapped)

const { lib, w, C, gate, wire, num, ownerIdx: O } = await mk(DIST, { owner: MAP_OWNER });
const r = lib.WorldReader.from(fs.readFileSync(IN));
const gd = r.globalData();
const assets = [...gd.BasicBrickAssetNames, ...gd.ProceduralBrickAssetNames];
const comps = new Map(); // `${grid}:${brickIndex}` -> [{type, data}]
for (const g of r.gridIds()) for (const c of r.brickChunkIndex(g)) if (c.numComponents) for (const comp of r.componentChunk(g, c.index).components)
  comps.set(`${g}:${comp.brickIndex}`, [{ type: comp.typeName, data: comp.data }]);
const ents = new Map(r.entityChunk({ x: 0, y: 0, z: 0 }).map(e => [e.persistentIndex, e]));
const copy = (b, pos, extra = {}) => ({ asset: assets[b.asset_name_index], ...(b.asset_name_index >= gd.BasicBrickAssetNames.length ? { size: b.size } : {}),
  position: pos, direction: b.direction, rotation: b.rotation, collision: b.collision, visibility: b.visibility,
  material: gd.MaterialAssetNames[b.material_index], material_intensity: b.material_intensity, color: b.color, owner_index: O, ...extra });
const hid = { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } };
const changer = (color, vis, coll, extra = {}) => ({ type: 'Component_BrickPropertyChanger', data: { bVisibility: vis, bCollisionEnabled: coll,
  bCollisionEnabled_Player: coll, bCollisionEnabled_Player1: coll, bCollisionEnabled_Player2: coll, bCollisionEnabled_Player3: coll,
  bCollisionEnabled_Weapon: coll, bCollisionEnabled_Interaction: coll, bCollisionEnabled_Physics: coll,
  Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 5, Material: 0, ...extra } });

// ---- world grid: planter, dirt, flowers, basin
const world = [...r.bricks(1)];
let basin, dirt; const flowers = [];
world.forEach((b, i) => {
  const pos = b.position.map((v, k) => v + SHIFT[k]);
  const own = comps.get(`1:${i}`) ?? [];
  if (own[0]?.type === 'Component_Internal_AttachedZone') {
    own[0].data = { ...own[0].data, bDetectEntities: true };
    basin = { c: C.AttachedZone, h: w.addBrick(copy(b, pos, { components: own })) };
  } else if (assets[b.asset_name_index] === 'B_Small_Flower') {
    flowers.push({ z: b.position[2], c: C.BrickPropertyChanger, h: w.addBrick(copy(b, pos, { ...hid, color: FLOWER, components: [changer(FLOWER, false, false)] })) });
  } else if (b.color.join() === DRY.join()) {
    const zone = { ...comps.get(`1:${world.findIndex((_, j) => comps.has(`1:${j}`))}`)[0].data, bWater: false, bDetectEntities: true,
      bDetectPlayers: false, bDetectPlayers1: false, bDetectPlayers2: false, bDetectPlayers3: false, bDetectProjectiles: false,
      TagFilter: 'bucket', ZoneStartDistance: 0, ZoneEndDistance: 120 };
    dirt = w.addBrick(copy(b, pos, { components: [
      { type: 'Component_Button', data: { bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Harvest' } },
      changer(DRY, true, true),
      { type: 'Component_Internal_AttachedZone', data: zone }] }));
  } else w.addBrick(copy(b, pos, { components: own }));
});
if (!basin || !dirt || flowers.length !== 24) throw Error(`layout: basin ${!!basin} dirt ${!!dirt} flowers ${flowers.length}`);

// ---- bucket + handle grids (positions = chunk-relative; the bearing re-joins the handle by geometry on load)
const BUCKET = 1497741, HANDLE = 1497742;
const grids = {};
for (const id of [BUCKET, HANDLE]) {
  const e = ents.get(id);
  grids[id] = w.addBrickGrid({ owner_index: O, location: e.location, rotation: e.rotation, sleeping: true,
    data: { ...e.data, ...(id === BUCKET ? { EntityTag: 'bucket' } : {}) } });
  [...r.bricks(id)].forEach((b, i) => w.addBrick(copy(b, b.position.map(v => v + 1024), { components: comps.get(`${id}:${i}`) ?? [] }), grids[id]));
}
const bg = grids[BUCKET];
const water = { c: C.BrickPropertyChanger, h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [6, 5, 1], position: [1, -2, 9], color: WATER, material: 'BMC_Glass',
  owner_index: O, ...hid, components: [changer(WATER, false, false, { Material: 1 })] }, bg) };
const splash = { c: C.OneShotAudioEmitter, h: w.addBrick({ asset: 'B_1x1_SoundEmitter', position: [1, -1, 2], color: [255, 255, 255], owner_index: O, ...hid,
  components: [{ type: 'Component_OneShotAudioEmitter', data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100,
    MaxDistance: 2500, bSpatialization: true, bEnableRepeat: false, RepeatTime: 1, RepeatVariance: 0, RepeatCount: 1 } }] }, bg) };

// hidden chip brick + its gate grid (brs-js addMicrochip can't hide the chip)
const chip = (position, parent, at) => {
  const h = w.addBrick({ asset: 'B_1x1_Microchip', position, color: [255, 255, 255], owner_index: O, ...hid, components: [{ type: 'Component_Internal_Microchip' }] }, parent);
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', owner_index: O, location: at,
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 240, Y: 80, Z: 2 } } });
  w.registerMicrochipLink(h, grid);
  return grid;
};
const vec0 = { $variant: 'Vector', value: { X: 0, Y: 0, Z: 0 } };
const evData = pre => ({ [`${pre}1`]: vec0, ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(i => [`${pre}${i}`, num(0)])) });
const big = { size: [10, 5, 2] };

// ---- bucket chip (sits on the bucket floor, under the emitter)
{
  const be = ents.get(BUCKET).location;
  const grid = chip([1, -1, -6], bg, { X: be.X, Y: be.Y, Z: be.Z + 40 });
  const g = (c, data = {}, extra) => gate(c, data, grid, extra);
  const full = g(C.Var, { Value: num(0) });
  const fullB = g(C.Expr_CompareGreater, { InputA: num(0), InputB: num(0.5) });
  wire(full, 'Value', fullB, 'InputA');
  wire(fullB, 'bOutput', water, 'bVisibility');
  // fill: farm.fill carries the dipped bucket's location; only the bucket that is there fills
  const onFill = g(C.Event_CustomGlobal, { EventName: 'farm.fill', bIsObjectEvent: false, ...evData('DataOut') }, big);
  const xf1 = g(C.Exec_GetOwnTransform);
  const dist = g(C.Expr_VecDistance);
  const near = g(C.Expr_CompareLess, { InputA: num(0), InputB: num(80) });
  const isMe = g(C.Exec_Branch, { bCond: false });
  const setFull = g(C.Exec_Var_Set, { Value: num(1) });
  wire(onFill, 'ExecOut', xf1, 'Exec');
  wire(xf1, 'Location', dist, 'InputA'); wire(onFill, 'DataOut1', dist, 'InputB');
  wire(dist, 'Output', near, 'InputA'); wire(near, 'bOutput', isMe, 'bCond');
  wire(xf1, 'ExecOut', isMe, 'Exec');
  wire(isMe, 'ExecOutA', setFull, 'Exec'); wire(full, 'VarRef', setFull, 'VarRef');
  // pour: every 0.15 s, if full and tipped past ~72 deg
  const clock = g(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.05, OffTimeSeconds: 0.1, IntervalSeconds: 0.15 });
  const tick = g(C.Expr_EdgeDetectorExec);
  const isFull = g(C.Exec_Branch, { bCond: false });
  const xf2 = g(C.Exec_GetOwnTransform);
  const up = g(C.Expr_RotateVector, { Vector: { X: 0, Y: 0, Z: 1 } });
  const split = g(C.Expr_SplitVector);
  const tipped = g(C.Expr_CompareLess, { InputA: num(1), InputB: num(0.3) });
  const pour = g(C.Exec_Branch, { bCond: false });
  const setEmpty = g(C.Exec_Var_Set, { Value: num(0) });
  const send = g(C.Exec_SendCustomEventGlobal, { EventName: 'farm.pour', ...evData('DataIn') }, big);
  wire(clock, 'Pulse', tick, 'Input');
  wire(tick, 'OnRisingEdge', isFull, 'Exec'); wire(fullB, 'bOutput', isFull, 'bCond');
  wire(isFull, 'ExecOutA', xf2, 'Exec');
  wire(xf2, 'Rotation', up, 'Rotation'); wire(up, 'Output', split, 'Input');
  wire(split, 'Z', tipped, 'InputA'); wire(tipped, 'bOutput', pour, 'bCond');
  wire(xf2, 'ExecOut', pour, 'Exec');
  wire(pour, 'ExecOutA', setEmpty, 'Exec'); wire(full, 'VarRef', setEmpty, 'VarRef');
  wire(pour, 'ExecOutA', splash, 'Play');
  wire(pour, 'ExecOutA', send, 'ExecIn'); wire(xf2, 'Location', send, 'DataIn1');
}

// ---- spawned prop: flower bundle (loose physics grid)
const prop = (await mk(DIST, { owner: MAP_OWNER })).w;
prop.addBrick({ asset: 'PB_DefaultBrick', size: [15, 15, 2], position: [0, 0, 2], color: [150, 100, 50], owner_index: 1 });
for (const [x, y] of [[-7, -7], [7, 7]]) prop.addBrick({ asset: 'B_Small_Flower', position: [x, y, 10], color: [210, 60, 120], owner_index: 1 });
prop.makePrefab({ isPhysicsGrid: true });
const propPath = w.addPrefab(prop.toBrz({ bundle: { description: 'farm harvest: flower bundle' } }));

// ---- farm chip (on the planter rim beside the dirt)
{
  const chipPos = [-295 + SHIFT[0], -735 + SHIFT[1], 598 + SHIFT[2]];
  const grid = chip(chipPos, undefined, { X: chipPos[0], Y: chipPos[1], Z: chipPos[2] + 40 });
  const g = (c, data = {}, extra) => gate(c, data, grid, extra);
  const D = { c: C.AttachedZone, h: dirt }, BTN = { c: C.Button, h: dirt }, DC = { c: C.BrickPropertyChanger, h: dirt };
  // fill
  const entered = g(C.EntityZoneEvent_Entered, { TagFilter: 'bucket' });
  const loc = g(C.Exec_Entity_GetLocation);
  const fill = g(C.Exec_SendCustomEventGlobal, { EventName: 'farm.fill', ...evData('DataIn') }, big);
  wire(basin, 'ZoneRef', entered, 'Zone');
  wire(entered, 'Exec', loc, 'Exec'); wire(entered, 'Entity', loc, 'Entity');
  wire(loc, 'ExecOut', fill, 'ExecIn'); wire(loc, 'Vector', fill, 'DataIn1');
  // state: wet (0/1) + grow stopwatch
  const wet = g(C.Var, { Value: num(0) });
  const wetB = g(C.Expr_CompareGreater, { InputA: num(0), InputB: num(0.5) });
  const sw = g(C.Stopwatch, { Limit: GROW, Time: 0, bRunning: false });
  // stacks grow one flower at a time: layer k (bottom = 0) shows at GROW*(k+1)/layers; top layer = harvestable
  const layers = [...new Set(flowers.map(f => f.z))].sort((a, b) => a - b);
  const stage = layers.map((z, k) => {
    const at = g(C.Expr_CompareGreaterOrEqual, { InputA: num(0), InputB: num(GROW * (k + 1) / layers.length) });
    const on = g(C.Expr_LogicalAND, { bInputA: false, bInputB: false });
    wire(sw, 'Time', at, 'InputA'); wire(wetB, 'bOutput', on, 'bInputA'); wire(at, 'bOutput', on, 'bInputB');
    for (const f of flowers.filter(f => f.z === z)) wire(on, 'bOutput', f, 'bVisibility');
    return on;
  });
  const grown = stage.at(-1);
  const dry = g(C.Expr_MakeColorSRGB, { R: DRY[0], G: DRY[1], B: DRY[2], A: 255 });
  const wetC = g(C.Expr_MakeColorSRGB, { R: WET[0], G: WET[1], B: WET[2], A: 255 });
  const col = g(C.Expr_Select, { bSelectB: false });
  wire(wet, 'Value', wetB, 'InputA');
  wire(dry, 'Output', col, 'InputA'); wire(wetC, 'Output', col, 'InputB'); wire(wetB, 'bOutput', col, 'bSelectB');
  wire(col, 'Output', DC, 'Color');
  // pour over the dirt while dry -> wet + start growing
  const onPour = g(C.Event_CustomGlobal, { EventName: 'farm.pour', bIsObjectEvent: false, ...evData('DataOut') }, big);
  const over = g(C.Exec_Branch, { bCond: false });
  const isWet = g(C.Exec_Branch, { bCond: false });
  const setWet = g(C.Exec_Var_Set, { Value: num(1) });
  wire(onPour, 'ExecOut', over, 'Exec'); wire(D, 'bOccupied', over, 'bCond');
  wire(over, 'ExecOutA', isWet, 'Exec'); wire(wetB, 'bOutput', isWet, 'bCond');
  wire(isWet, 'ExecOutB', setWet, 'Exec'); wire(wet, 'VarRef', setWet, 'VarRef');
  wire(isWet, 'ExecOutB', sw, 'Restart');
  // harvest: click the dirt when grown
  const press = g(C.Expr_EdgeDetectorExec);
  const canHarvest = g(C.Exec_Branch, { bCond: false });
  const setDry = g(C.Exec_Var_Set, { Value: num(0) });
  const spawn = g(C.Exec_PrefabSpawner, { Prefab: propPath, SpawnOffset: { X: 30, Y: 0, Z: 30 } });
  const log = g(C.Exec_PrintToConsole, { Text: '[farm] harvested' });
  wire(BTN, 'bHeld', press, 'Input');
  wire(press, 'OnRisingEdge', canHarvest, 'Exec'); wire(grown, 'bOutput', canHarvest, 'bCond');
  wire(canHarvest, 'ExecOutA', setDry, 'Exec'); wire(wet, 'VarRef', setDry, 'VarRef');
  wire(canHarvest, 'ExecOutA', spawn, 'Exec');
  wire(canHarvest, 'ExecOutA', log, 'Exec');
}

w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: 'farm plot: bucket, basin, dirt, flowers' },
  externalAssets: [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_Water_Splash_Medium' }] });
fs.writeFileSync(OUT, bytes);

// self-check: read back, bucket/handle bricks match the clip exactly, every wire landed
const chk = lib.WorldReader.from(bytes);
const pos = (rd, g) => [...rd.bricks(g)].map(b => b.position.join()).sort();
const ids = chk.gridIds();
const orig = [BUCKET, HANDLE].map(g => pos(r, g).join('|'));
const got = ids.map(g => pos(chk, g).join('|'));
for (const o of orig.slice(1)) if (!got.includes(o)) throw Error('handle bricks moved');
if (!got.some(s => orig[0].split('|').every(p => s.includes(p)))) throw Error('bucket bricks moved');
let wires = 0; for (const g of ids) for (const c of chk.brickChunkIndex(g)) wires += c.numWires;
console.log('wrote', OUT, bytes.length, 'bytes; grids', ids.length, 'wires', wires);
