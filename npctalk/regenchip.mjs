// Regen chip (owner 2026-10-18: "the soda quest guy gives u +1 regen but a regen factor that's
// wired in to respect that going over the max health will cause the player to constantly take
// damage and will play a ticking sound"). One copy in the sky, its own owner (wire budget).
// Driven by the quests plugin once a second for every online player with Regen > 0:
//   server: br.Chat.Command /regen <player>|<regen>
//   health = DamageLimit - Damage, so overheal = Damage < 0
//   Damage < 0  -> +1 damage (overheal bleeds off) and a tick sound for that player only
//   else if Damage > 0 -> Damage = max(Damage - Regen, 0) (regen never overheals)
// 2026-10-19 (owner: "regen doesnt work"): the first version looped over FillArrayFromPlayers,
// which never fires its ExecOut in this game build (tested with every array type and a
// renderman-owned copy), so nothing ever ran. Player-typed /regen is ignored (server has no user id).
//   node npctalk/regenchip.mjs <brs-js 4 dist.mjs> <out.brz>      env REGEN_DEBUG=1 prints regen|damage|regen
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-0000000e6e60', name: 'Quest Regen', display_name: 'Quest Regen' } });
const { C, gate, wire, w } = k;
const EXT = [{ type: 'BrickOneShotAudioDescriptor', name: 'OBA_BR_Checkpoint_Acquire_Click_Cue' }];
const K = v => [gate(C.Var, { Value: k.num(v) }), 'Value'];
const cmp = (c, a, b) => { const x = gate(c), pa = c.PORTS.bInputA ? 'bInputA' : 'InputA', pb = c.PORTS.bInputB ? 'bInputB' : 'InputB'; wire(...a, x, pa); wire(...b, x, pb); return [x, c.PORTS.bOutput ? 'bOutput' : 'Output']; };

const cmd = gate(C.Event_ChatCommand, { CommandName: 'regen', HelpText: 'server only' });
const who = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', who, 'Exec'); wire(cmd, 'PlayerState', who, 'PlayerState');
const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') }); wire(who, 'UserId', isServer, 'InputA');
const srv = gate(C.Exec_Branch); wire(isServer, 'bOutput', srv, 'bCond'); wire(who, 'ExecOut', srv, 'Exec');
const s1 = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: 1 }); wire(cmd, 'Arguments', s1, 'Input');
const find = gate(C.Exec_FindPlayer, { Query: '' }); wire(srv, 'ExecOutA', find, 'Exec'); wire(s1, 'Left', find, 'Query');
const ps = [find, 'Player'];
const chr = gate(C.Exec_Character_GetFromController); wire(find, 'ExecOut', chr, 'Exec'); wire(...ps, chr, 'PlayerState');
const dmg = gate(C.Exec_Character_GetDamage); wire(chr, 'ExecOut', dmg, 'Exec'); wire(chr, 'Character', dmg, 'Character');
const rn = gate(C.Expr_String_ParseNumber); wire(s1, 'Right', rn, 'Input');
const D = [dmg, 'Damage'], R = [rn, 'Value'];
let next = [dmg, 'ExecOut'];
if (process.env.REGEN_DEBUG) {
  const f = gate(C.Expr_String_FormatText, { FormatString: 'regen|{A}|{B}' }); wire(...D, f, 'InputA'); wire(...R, f, 'InputB');
  const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); wire(...next, pr, 'Exec');
  next = [pr, 'ExecOut'];
}
const brOver = gate(C.Exec_Branch); wire(...cmp(C.Expr_CompareLess, D, K(0)), brOver, 'bCond'); wire(...next, brOver, 'Exec');
// overheal: bleed 1 a second + tick
const bleed = gate(C.Exec_Character_IncDamage, { Amount: 1 }); wire(brOver, 'ExecOutA', bleed, 'Exec'); wire(chr, 'Character', bleed, 'Character');
const play = gate(C.Exec_PlayClientAudio, { AudioDescriptor: 0, VolumeMultiplier: 1, PitchMultiplier: 1.5 }); wire(bleed, 'ExecOut', play, 'Exec'); wire(...ps, play, 'Player');
// regen up to max health
const can = cmp(C.Expr_LogicalAND, cmp(C.Expr_CompareGreater, R, K(0)), cmp(C.Expr_CompareGreater, D, K(0)));
const brRegen = gate(C.Exec_Branch); wire(...can, brRegen, 'bCond'); wire(brOver, 'ExecOutB', brRegen, 'Exec');
const set = gate(C.Exec_Character_SetDamage, { Damage: 0 }); wire(brRegen, 'ExecOutA', set, 'Exec'); wire(chr, 'Character', set, 'Character');
wire(...cmp(C.Expr_MathMax, cmp(C.Expr_MathSubtract, D, R), K(0)), set, 'Damage');

w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Quest regen chip' }, externalAssets: EXT }));
console.log(out);
