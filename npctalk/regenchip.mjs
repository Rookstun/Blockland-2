// Regen chip (owner 2026-10-18: "the soda quest guy gives u +1 regen but a regen factor that's
// wired in to respect that going over the max health will cause the player to constantly take
// damage and will play a ticking sound"). One copy in the sky, its own owner (wire budget).
// Every second, for every player (For Each over the player list):
//   health = DamageLimit - Damage, so overheal = Damage < 0
//   Damage < 0  -> +1 damage (overheal bleeds off) and a tick sound for that player only
//   else if Regen > 0 and Damage > 0 -> Damage = max(Damage - Regen, 0) (regen never overheals)
// Regen = the player's leaderboard value "Regen" (the quests plugin sets it: Fizzwick's quest).
//   node npctalk/regenchip.mjs <brs-js 4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-0000000e6e60', name: 'Quest Regen', display_name: 'Quest Regen' } });
const { C, gate, wire, w } = k;
const EXT = [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_BR_Checkpoint_Acquire_Click_Cue' }];

const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 0.5, OffTimeSeconds: 0.5, IntervalSeconds: 1 });
const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
const players = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: [] } });
const fill = gate(C.Exec_Gamemode_FillArrayFromPlayers, { bIncludeBuilderMode: false }); wire(tick, 'OnRisingEdge', fill, 'Exec'); wire(players, 'ArrayVarRef', fill, 'ArrayVarRef');
// the loop shell: a microchip brick, so invisible + no collision
const shell = gate(C.Microchip_ForEachArray, { bRunAcrossTicks: false }, undefined, { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } });
const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } } });
w.registerMicrochipLink(shell.h, grid);
wire(fill, 'ExecOut', shell, 'Exec'); wire(players, 'ArrayVarRef', shell, 'ArrayVarRef');

const ig = (c, data = {}) => gate(c, data, grid);
const K = v => [ig(C.Var, { Value: k.num(v) }), 'Value'];
const entry = ig(C.CallableEntry_ForEachArray);
const ps = [entry, 'Value'];
const chr = ig(C.Exec_Character_GetFromController); wire(entry, 'Body', chr, 'Exec'); wire(...ps, chr, 'PlayerState');
const lb = ig(C.Exec_Gamemode_GetLeaderboardValue, { Key: 'Regen' }); wire(chr, 'ExecOut', lb, 'Exec'); wire(...ps, lb, 'PlayerState');
const dmg = ig(C.Exec_Character_GetDamage); wire(lb, 'ExecOut', dmg, 'Exec'); wire(chr, 'Character', dmg, 'Character');
const D = [dmg, 'Damage'], R = [lb, 'Value'];
const cmp = (c, a, b) => { const x = ig(c), pa = c.PORTS.bInputA ? 'bInputA' : 'InputA', pb = c.PORTS.bInputB ? 'bInputB' : 'InputB'; wire(...a, x, pa); wire(...b, x, pb); return [x, c.PORTS.bOutput ? 'bOutput' : 'Output']; };
const over = cmp(C.Expr_CompareLess, D, K(0));
const brOver = ig(C.Exec_Branch); wire(...over, brOver, 'bCond'); wire(dmg, 'ExecOut', brOver, 'Exec');
// overheal: bleed 1 a second + tick
const bleed = ig(C.Exec_Character_IncDamage, { Amount: 1 }); wire(brOver, 'ExecOutA', bleed, 'Exec'); wire(chr, 'Character', bleed, 'Character');
// sound set in the gate's own data (an audio reference gate in the loop grid was dropped on load)
const play = ig(C.Exec_PlayClientAudio, { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1.5 }); wire(bleed, 'ExecOut', play, 'Exec'); wire(...ps, play, 'Player');
// regen up to max health
const can = cmp(C.Expr_LogicalAND, cmp(C.Expr_CompareGreater, R, K(0)), cmp(C.Expr_CompareGreater, D, K(0)));
const brRegen = ig(C.Exec_Branch); wire(...can, brRegen, 'bCond'); wire(brOver, 'ExecOutB', brRegen, 'Exec');
const set = ig(C.Exec_Character_SetDamage, { Damage: 0 }); wire(brRegen, 'ExecOutA', set, 'Exec'); wire(chr, 'Character', set, 'Character');
wire(...cmp(C.Expr_MathMax, cmp(C.Expr_MathSubtract, D, R), K(0)), set, 'Damage');

w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Quest regen chip' }, externalAssets: EXT }));
console.log(out);
