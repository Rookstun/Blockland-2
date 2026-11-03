// 6-blade mechanical iris (2026-11-03, Hoogle in game: "6-blade mechanical iris. Overlapping curved blades, each on its own
// rigid bearing, 60 deg apart on a ring. Switch toggles open/closed. Use a gate-built ramp (counter or lerp loop) to drive
// all bearings smoothly from 0 to 60, no snapping.")
// Lies flat (axis +Z), prefab origin = centre of the base. Housing: base annulus + wall + top annulus (aperture r 60) that
// hides the pivots. Blade i = sickle (band round a curved centreline from its pivot) on its own loose grid, layer z 4+2i,
// held by B_Joint_RigidBearing_Micro on a post at pivot P_i (r 74, 60 deg apart). Blades are voxelised already turned to
// their place, so every bearing runs the same 0 -> OPEN. Blade shape from a coverage search: closed covers r<60 100%,
// open leaves ~8% of r<56 covered.
// BEARING FRAME (probed 2026-11-03): grid yaw = (bearing rotation 2 ? 180 : 0) - angle, so rot 0 + angle +60 = blades
// turn -60 deg (x toward -y), the opening direction of the search.
// Ramp (one hidden chip): Clock 0.05 s -> Var_Increment(v, clamp(target - v, -STEP, STEP)); target = switch ? OPEN : 0;
// v -> every bearing's TargetAngle. Linear, ends exactly on 0 / OPEN.
//   node mapgen/iris.mjs out.brz [--test]   (--test: no switch wire, target starts open: probes the bearing direction)
//   load: br.Prefab.Load "iris" X Y Z 0 16 (Z = ground top); remove: br.World.ClearRegion X Y Z+10 120 120 14
import fs from 'node:fs';
import { mk } from '../ea32test/lib.mjs';

const DIST = new URL('../tools/brs4/dist.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const OWNER = { id: '1215b1ad-0000-4000-8000-000000000006', name: 'Iris', display_name: 'Iris' };
const [OUT = 'iris.brz'] = process.argv.slice(2).filter(a => !a.startsWith('--')), TEST = process.argv.includes('--test');
const OPEN = 60, STEP = 2; // 60/2 * 0.05 s = 1.5 s per stroke
const RP = 74, RA = 60, RW0 = 104, RW1 = 112, TOP = 18;
const BLADE = { h0: -0.7, k: 0.012, L: 70, W: 24 }; // irisopt search result (scratch)
const STEEL = [96, 100, 108], BRASS = [176, 140, 72], BLADES = [[44, 46, 52], [58, 60, 68]];

const { lib, w, C, gate, wire, num, ownerIdx: O } = await mk(DIST, { owner: OWNER });
if (!lib.World.prototype.registerJoint) throw Error('run node tools/patch_brs4.mjs first (joint links)');
const hid = { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } };
const boxes = []; // main-grid AABBs (self-check: the game rejects overlaps)
const HALF = { B_Joint_RigidBearing_Micro: [1, 1, 1], B_Switch_Flipped: [5, 5, 3], B_1x1_Microchip: [5, 5, 2] };
const add = (b, grid) => (grid || boxes.push({ p: b.position, h: b.size ?? HALF[b.asset], a: b.asset }), addRaw(b, grid));
const addRaw = (b, grid) => w.addBrick({ asset: 'PB_DefaultMicroBrick', owner_index: O, direction: 4, rotation: 0, color: STEEL, material: 'BMC_Metallic', ...b }, grid);

// rows of 2-unit voxels (centres on even coords) merged along x -> micro bricks
const rows = (test, z, half, b, grid) => {
  let n = 0;
  for (let y = -RW1; y <= RW1; y += 2) {
    let x0 = null;
    for (let x = -RW1 - 2; x <= RW1 + 2; x += 2) {
      const on = x <= RW1 && test(x, y);
      if (on && x0 === null) x0 = x;
      if (!on && x0 !== null) { const len = (x - x0) / 2; add({ size: [len, 1, half], position: [x0 + len - 1, y, z], ...b }, grid); x0 = null; n++; }
    }
  }
  return n;
};
const ring = (r0, r1) => (x, y) => { const r = Math.hypot(x, y); return r >= r0 && r < r1; };

// ---- housing (world grid)
rows(ring(RA, RW1), 1, 1, {});                           // base annulus z 0..2
rows(ring(RW0, RW1), TOP / 2 + 1, TOP / 2 - 1, {});       // wall z 2..18
rows(ring(RA, RW1), TOP + 1, 1, { color: BRASS });        // top annulus z 18..20 (covers pivots)

// ---- blades
const inBlade = (lx, ly) => { // local: pivot at origin, +x = outward radial
  if (lx > 4) return false;
  let px = 0, py = 0, a = Math.PI + BLADE.h0;
  for (let s = 0; s <= BLADE.L; s += 1) { if (Math.hypot(lx - px, ly - py) < BLADE.W) return true; px += Math.cos(a); py += Math.sin(a); a += BLADE.k; }
  return false;
};
const GRID_DATA = { BouyancyScale: 0.2, MassScale: 1, bEnableGravity: true, bUseNewMassCalculation: true, bReceivesDecals: true, bVisible: true, CollisionQuality: 0, EntityTag: 'iris', CustomProperties: { $map: [] }, GameModeTeamName: '', bDetectableByAnyone: false };
const bearings = [];
let maxR = 0, nBlade = 0;
for (let i = 0; i < 6; i++) {
  const f = i * Math.PI / 3, P = [Math.round(RP * Math.cos(f) / 2) * 2, Math.round(RP * Math.sin(f) / 2) * 2], zc = 3 + 2 * i;
  for (let z = 3; z < zc; z += 2) add({ size: [1, 1, 1], position: [P[0], P[1], z], color: BRASS });   // post
  const brg = add({ asset: 'B_Joint_RigidBearing_Micro', position: [P[0], P[1], zc], direction: 4, rotation: 0, color: BRASS,
    components: [{ type: C.RigidBearing.NAME, data: { TargetAngle: 0, bAnglesArePercentages: false, bReversed: false, CurrentAngle: 0, InterpMode: 0, SmoothTime: 0.1, TopSpeed: 0 } }] });
  bearings.push({ c: C.RigidBearing, h: brg });
  const grid = w.addBrickGrid({ owner_index: O, location: { X: P[0], Y: P[1], Z: zc }, rotation: { X: 0, Y: 0, Z: 0, W: 1 }, sleeping: true, data: GRID_DATA });
  w.registerJoint(brg, grid, { X: 0, Y: 0, Z: 0 }, { X: 0, Y: 0, Z: 0, W: 1 });
  // grid-local (x, y) -> blade-local (outward radial frame at its pivot)
  const sweep = (x, y) => [0, 1, 2, 3, 4, 5, 6].every(k => { const t = -OPEN * k / 6 * Math.PI / 180; // stays inside the wall all stroke
    return Math.hypot(P[0] + x * Math.cos(t) - y * Math.sin(t), P[1] + x * Math.sin(t) + y * Math.cos(t)) <= RW0 - 2; });
  const test = (x, y) => sweep(x, y) && inBlade(x * Math.cos(f) + y * Math.sin(f), -x * Math.sin(f) + y * Math.cos(f));
  for (let x = -RW1; x <= RW1; x += 2) for (let y = -RW1; y <= RW1; y += 2) if (test(x, y))
    for (const t of [0, -OPEN * Math.PI / 180]) maxR = Math.max(maxR, Math.hypot(P[0] + x * Math.cos(t) - y * Math.sin(t), P[1] + x * Math.sin(t) + y * Math.cos(t)));
  nBlade += rows(test, 2, 1, { color: BLADES[i % 2], collision: { player: true, weapon: true, interaction: true, tool: true, physics: false } }, grid);
}
if (maxR > RW0) throw Error(`blade reaches r ${maxR.toFixed(1)} > wall ${RW0}`);

// ---- switch on the wall (outside, -y side) + hidden chip under the base
const sw = add({ asset: 'B_Switch_Flipped', position: [0, -RW1 - 5, 14], direction: 3, rotation: 1, color: BRASS, material: 'BMC_Plastic',
  components: [{ type: C.AnimatedSwitch.NAME, data: { bEnabled: false, InteractSound: 0, bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: 'Iris' } }] });
const chipBrick = add({ asset: 'B_1x1_Microchip', position: [0, -RW1 - 6, 5], ...hid, components: [{ type: 'Component_Internal_Microchip' }] });
const cg = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', owner_index: O, location: { X: 0, Y: -RW1 - 6, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 240, Y: 80, Z: 2 } } });
w.registerMicrochipLink(chipBrick, cg);
const g = (c, data = {}) => gate(c, data, cg);
const v = g(C.Var, { Value: num(0) });
const target = g(C.Expr_Select, { bSelectB: TEST, InputA: num(0), InputB: num(OPEN) });
const diff = g(C.Expr_MathSubtract, { InputA: num(0), InputB: num(0) });
const clamp = g(C.Expr_MathClamp, { Input: num(0), Min: num(-STEP), Max: num(STEP) });
const clock = g(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.02, OffTimeSeconds: 0.03, IntervalSeconds: 0.05 });
const tick = g(C.Expr_EdgeDetectorExec);
const inc = g(C.Exec_Var_Increment, { Value: num(0) });
if (!TEST) wire({ c: C.AnimatedSwitch, h: sw }, 'bEnabled', target, 'bSelectB');
wire(target, 'Output', diff, 'InputA'); wire(v, 'Value', diff, 'InputB');
wire(diff, 'Output', clamp, 'Input'); wire(clamp, 'Output', inc, 'Value');
wire(v, 'VarRef', inc, 'VarRef');
wire(clock, 'Pulse', tick, 'Input'); wire(tick, 'OnRisingEdge', inc, 'Exec');
for (const b of bearings) wire(v, 'Value', b, 'TargetAngle');

for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const A = boxes[i], B = boxes[j];
  if ([0, 1, 2].every(k => Math.abs(A.p[k] - B.p[k]) < A.h[k] + B.h[k])) throw Error(`overlap ${A.a} ${A.p} / ${B.a} ${B.p}`);
}
w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: '6-blade mechanical iris' }, externalAssets: [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_Lightswitch' }] });
fs.writeFileSync(OUT, bytes);
// self-check: read back grids + wires
const chk = lib.WorldReader.from(bytes);
let wires = 0; for (const gi of chk.gridIds()) for (const c of chk.brickChunkIndex(gi)) wires += c.numWires;
if (chk.gridIds().length !== 8 || wires !== 14 - (TEST ? 1 : 0)) throw Error(`grids ${chk.gridIds().length} wires ${wires}`);
console.log('wrote', OUT, bytes.length, 'bytes; blade bricks', nBlade, 'max blade r', maxR.toFixed(1), 'wires', wires);
