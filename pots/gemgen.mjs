// Mineable gems (2026-10-16, owner: caves need "gems that you can mine that give you money").
// A crystal cluster on a 2 x 2-stud footprint (origin = the floor under its centre): four glowing
// shards (micro brick prisms with wedge-corner pyramid tips), the two big ones are targets. Hit one
// and every shard hides for 300 s (each shard has its own BrickPropertyChanger, all driven by one
// compare, as in the owner's bush: pots/bushown.mjs), a glass chime plays and the chip sends the
// global custom event "gem.mined" (location, kind); pot_pool pays the coins by kind (pot_pool.ws).
// Logic copied from the owner's bush: Target.bJustHit -> OR -> EdgeDetectorExec -> Branch(stopwatch
// expired) -> GetOwnTransform -> SendCustomEventGlobal; restart the stopwatch; Random -> sound; log.
//   node pots/gemgen.mjs <abs path tools/brs4/dist.mjs> <outdir>   -> gem_<kind>.brz (Latest format)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mk } from '../ea32test/lib.mjs';
import { orientFor } from '../mapgen/orient.mjs';

export const GEMS = [ // kind 1..4: what pot_pool pays (pot_pool.ws gem.mined)
  { key: 'amethyst', kind: 1, color: [176, 96, 255], deep: [120, 52, 200] },
  { key: 'emerald', kind: 2, color: [60, 230, 120], deep: [24, 150, 70] },
  { key: 'ruby', kind: 3, color: [255, 50, 80], deep: [170, 20, 44] },
  { key: 'diamond', kind: 4, color: [200, 250, 255], deep: [120, 210, 240] },
];
const REGROW = 300;
const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'renderman', display_name: 'renderman' }; // may pay money (as the pots)

const [dist, outDir] = process.argv.slice(2);
if (dist) for (const g of GEMS) {
  const k = await mk(dist, { owner: OWNER });
  const { w, C, gate, wire, num } = k, O = k.ownerIdx;
  const changer = color => ({ type: C.BrickPropertyChanger.NAME, data: { bVisibility: true, bCollisionEnabled: true, bCollisionEnabled_Player: true,
    bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true, bCollisionEnabled_Weapon: true,
    bCollisionEnabled_Interaction: true, bCollisionEnabled_Physics: true, Color: { R: color[0], G: color[1], B: color[2], A: 255 }, MaterialAlpha: 255, Material: 3 } });
  const shards = []; // { h, target }
  const glow = (color, extra) => ({ color, material: 'BMC_Glow', material_intensity: 4, owner_index: O, ...extra });
  // a shard: prism half a x a, body height hb from z0, then a 4-piece pyramid tip ht high
  const shard = (x, y, a, hb, ht, color, target) => {
    const comps = [changer(color)];
    if (target) comps.unshift({ type: C.Target.NAME, data: { OnTime: 0.5 } });
    shards.push({ h: w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [a, a, hb / 2], position: [x, y, hb / 2], ...glow(color), components: comps }), target, color });
    const q = a / 2;
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      // quadrant (sx, sy): high at the inner corner (toward the prism axis, -sx, -sy)
      const o = orientFor('PB_DefaultMicroWedgeCorner', [[-sx, 0], [0, -sy]], [q, q, ht / 2]);
      shards.push({ h: w.addBrick({ asset: 'PB_DefaultMicroWedgeCorner', ...o, position: [x + sx * q, y + sy * q, hb + ht / 2], ...glow(color), components: [changer(color)] }), color });
    }
  };
  shard(-4, -4, 6, 22, 12, g.color, true);    // the big one
  shard(6, 4, 4, 14, 8, g.deep, true);
  shard(6, -6, 4, 8, 6, g.color, false);
  shard(-6, 6, 4, 10, 8, g.deep, false);
  // speaker + chip hidden above the tips (invisible, no collision: house rule; under the floor they'd hit the cave's own bricks)
  const spk = { h: w.addBrick({ asset: 'B_1x1_SoundEmitter', position: [5, 0, 44], owner_index: O, visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false },
    components: [{ type: C.OneShotAudioEmitter.NAME, data: { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1, InnerRadius: 100, MaxDistance: 600, bSpatialization: true, bEnableRepeat: false, RepeatTime: 1, RepeatVariance: 0, RepeatCount: 1 } }] }), c: C.OneShotAudioEmitter };
  const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [5, 0, 56], owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
  w.registerMicrochipLink(chipBrick, grid);
  const G = (c, data = {}, extra) => gate(c, data, grid, extra);
  const tf = G(C.Exec_GetOwnTransform);
  const send = G(C.Exec_SendCustomEventGlobal, { EventName: 'gem.mined', DataIn1: { $variant: 'Vector', value: { X: 0, Y: 0, Z: 0 } }, DataIn2: { $variant: 'i64', value: g.kind },
    DataIn3: num(0), DataIn4: num(0), DataIn5: num(0), DataIn6: num(0), DataIn7: num(0), DataIn8: num(0) }, { size: [10, 5, 2] }); // (the owner's bush: this gate is [10, 5, 2])
  const sw = G(C.Stopwatch, { Limit: REGROW, Time: REGROW, bRunning: false });
  const br = G(C.Exec_Branch, { bCond: false });
  const or = G(C.Expr_LogicalOR, { bInputA: false, bInputB: false });
  const edge = G(C.Expr_EdgeDetectorExec, { Input: 0 });
  const ready = G(C.Expr_CompareGreaterOrEqual, { InputA: num(REGROW), InputB: num(REGROW) });
  const rnd = G(C.Exec_Random, { Min: num(0.8), Max: num(1.3) });
  const log = G(C.Exec_PrintToConsole, { Text: `[gem] ${g.key} mined` });
  wire(br, 'ExecOutA', tf, 'Exec'); wire(tf, 'ExecOut', send, 'ExecIn'); wire(tf, 'Location', send, 'DataIn1');
  wire(br, 'ExecOutA', sw, 'Restart'); wire(ready, 'bOutput', br, 'bCond'); wire(edge, 'OnRisingEdge', br, 'Exec');
  wire(or, 'bOutput', edge, 'Input'); wire(sw, 'Time', ready, 'InputA');
  wire(br, 'ExecOutA', rnd, 'Exec'); wire(rnd, 'Output', spk, 'PitchMultiplier'); wire(rnd, 'ExecOut', spk, 'Play'); wire(br, 'ExecOutA', log, 'Exec');
  const tg = shards.filter(s => s.target);
  wire({ h: tg[0].h, c: C.Target }, 'bJustHit', or, 'bInputA');
  wire({ h: tg[1].h, c: C.Target }, 'bJustHit', or, 'bInputB');
  for (const s of shards) for (const p of ['bVisibility', 'bCollisionEnabled', 'bCollisionEnabled_Player', 'bCollisionEnabled_Weapon', 'bCollisionEnabled_Interaction'])
    wire(ready, 'bOutput', { h: s.h, c: C.BrickPropertyChanger }, p);
  w.makePrefab({});
  const bytes = w.toBrz({ bundle: { description: `Mineable ${g.key} (hit: hides ${REGROW} s, gem.mined -> pot_pool coins)` },
    externalAssets: [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_GlasShatter_2' }] });
  writeFileSync(join(outDir, `gem_${g.key}.brz`), bytes);
  console.log(`gem_${g.key}.brz ${bytes.length} bytes, ${shards.length} shard bricks`);
}
