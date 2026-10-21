// Pot v6 (2026-10-21, owner: "pots under no circumstance should be entities. move their microchip on top of the
// audio player without overlapping it and place all props as part of the map, also randomize their colors"):
// built like the owner's bush (pots/bushown.mjs): every brick on the WORLD grid (no frozen dynamic grid), owned by
// the map owner. The B_Jar is its own Component_Target + BrickPropertyChanger; the hidden sound emitter sits on the
// jar's top and the hidden microchip on the emitter's top (jar 0, emitter 18 half 6, chip 26 half 2). The chip:
// Target.bJustHit -> OR -> EdgeDetectorExec -> Branch (stopwatch Time >= 120 = jar showing) -> stopwatch Restart,
// random pitch -> emitter Play, GetOwnTransform -> global event pot.smashed (pot_pool rolls the loot), "[pot] smashed".
// Colours: POTS variants pot_0..pot_<N-1> (mapgen picks one per spot by hash, pots.json "prefab").
// Load at ground + 12 (jar centre), as before.
//   node pots/potgen6.mjs <abs tools/brs4/dist.mjs> <outdir>
import fs from 'fs'; import path from 'path';
import { mk } from '../ea32test/lib.mjs';
const [dist, outDir] = process.argv.slice(2);
export const POT_COLORS = [
  [176, 96, 58], [196, 120, 70], [150, 72, 44], [214, 170, 110], [232, 214, 178], [120, 84, 60],
  [62, 98, 160], [40, 70, 120], [70, 140, 150], [90, 130, 70], [60, 96, 54], [150, 50, 46],
  [120, 60, 120], [200, 160, 60], [48, 44, 48], [168, 172, 160],
];
const RESPAWN = 120, MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' };
fs.mkdirSync(outDir, { recursive: true });
for (const [k, color] of POT_COLORS.entries()) {
  const { w, C, gate, wire, num, ownerIdx: O } = await mk(dist, { owner: MAP_OWNER });
  const hid = { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } };
  const jar = { c: C.Target, h: w.addBrick({ asset: 'B_Jar', position: [0, 0, 0], color, owner_index: O, components: [
    { type: 'Component_Target', data: { OnTime: 0.5 } },
    { type: 'Component_BrickPropertyChanger', data: { bVisibility: false, bCollisionEnabled: false, bCollisionEnabled_Player: false, bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true, bCollisionEnabled_Weapon: false, bCollisionEnabled_Interaction: false, bCollisionEnabled_Physics: true, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 0, Material: 0 } }] }) };
  const changer = { c: C.BrickPropertyChanger, h: jar.h };
  const sound = { c: C.OneShotAudioEmitter, h: w.addBrick({ asset: 'B_1x1_SoundEmitter', position: [0, 0, 18], color: [255, 255, 255], owner_index: O, ...hid,
    components: [{ type: 'Component_OneShotAudioEmitter', data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100, MaxDistance: 2500, bSpatialization: true, bEnableRepeat: false, RepeatTime: 1, RepeatVariance: 0, RepeatCount: 1 } }] }) };
  const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [0, 0, 26], color: [255, 255, 255], owner_index: O, ...hid, components: [{ type: 'Component_Internal_Microchip' }] });
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', owner_index: O, location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 60, Y: 40, Z: 2 } } });
  w.registerMicrochipLink(chipBrick, grid);
  const g = (c, data = {}) => gate(c, data, grid);
  const sw = g(C.Stopwatch, { Limit: RESPAWN, Time: RESPAWN, bRunning: false });
  const shown = g(C.Expr_CompareGreaterOrEqual, { InputA: num(RESPAWN), InputB: num(RESPAWN) });
  const or = g(C.Expr_LogicalOR, { bInputA: false, bInputB: false });
  const edge = g(C.Expr_EdgeDetectorExec, { Input: 0 });
  const live = g(C.Exec_Branch, { bCond: true });
  const pitch = g(C.Exec_Random, { Min: num(0.8), Max: num(1.25) });
  const log = g(C.Exec_PrintToConsole, { Text: '[pot] smashed' });
  const xf = g(C.Exec_GetOwnTransform);
  const send = gate(C.Exec_SendCustomEventGlobal, { EventName: 'pot.smashed', DataIn1: { $variant: 'Vector', value: { X: 0, Y: 0, Z: 0 } },
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(i => [`DataIn${i}`, num(0)])) }, grid, { size: [10, 5, 2] });
  wire(jar, 'bJustHit', or, 'bInputB');
  wire(or, 'bOutput', edge, 'Input');
  wire(edge, 'OnRisingEdge', live, 'Exec');
  wire(sw, 'Time', shown, 'InputA');
  wire(shown, 'bOutput', live, 'bCond');
  wire(live, 'ExecOutA', sw, 'Restart');
  wire(live, 'ExecOutA', pitch, 'Exec');
  wire(pitch, 'Output', sound, 'PitchMultiplier');
  wire(pitch, 'ExecOut', sound, 'Play');
  wire(live, 'ExecOutA', log, 'Exec');
  wire(live, 'ExecOutA', xf, 'Exec');
  wire(xf, 'ExecOut', send, 'ExecIn');
  wire(xf, 'Location', send, 'DataIn1');
  for (const p of ['bVisibility', 'bCollisionEnabled', 'bCollisionEnabled_Player', 'bCollisionEnabled_Weapon', 'bCollisionEnabled_Interaction']) wire(shown, 'bOutput', changer, p);
  w.makePrefab({});
  const bytes = w.toBrz({ bundle: { description: `smashable pot ${k} (world grid)` }, externalAssets: [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_GlasShatter_2' }] });
  fs.writeFileSync(path.join(outDir, `pot_${k}.brz`), bytes);
}
console.log(`wrote ${POT_COLORS.length} pots to ${outDir}`);
