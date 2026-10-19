// Regen chip (owner 2026-10-18: "the soda quest guy gives u +1 regen but a regen factor that's
// wired in to respect that going over the max health will cause the player to constantly take
// damage and will play a ticking sound"). One copy in the sky, its own owner (wire budget).
// Driven by the quests plugin once a second for every online player with Regen > 0:
//   server: br.Chat.Command /regen <player>|<regen>|<cap>
//   cap = the player's max health for their level (skeleton_drop capHp: 100 x (1 + 5% per level
//   above 1)); health = DamageLimit - Damage, so the cap is Damage = DamageLimit - cap.
//   Damage > floor -> Damage = max(Damage - Regen, floor): regen stops AT the level cap.
// 2026-10-19 (owner: "the regen has to not go over your set health cap by your level or it creates
// the most annoying ticking sound ever"): healed to the game's 400+ max, then skeleton_drop pulled
// it back to the level cap = endless ticks; the overheal bleed + tick sound is gone too
// (skeleton_drop already trims anything over the cap).
// 2026-10-19 (owner: "regen doesnt work"): the first version looped over FillArrayFromPlayers,
// which never fires its ExecOut in this game build (tested with every array type and a
// renderman-owned copy), so nothing ever ran. Player-typed /regen is ignored (server has no user id).
//   node npctalk/regenchip.mjs <brs-js 4 dist.mjs> <out.brz>      env REGEN_DEBUG=1 prints regen|damage|regen|floor
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-0000000e6e60', name: 'Quest Regen', display_name: 'Quest Regen' } });
const { C, gate, wire, w } = k;
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
const s2 = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: 1 }); wire(s1, 'Right', s2, 'Input');
const rn = gate(C.Expr_String_ParseNumber); wire(s2, 'Left', rn, 'Input');
const cn = gate(C.Expr_String_ParseNumber); wire(s2, 'Right', cn, 'Input');
const D = [dmg, 'Damage'], R = [rn, 'Value'];
const floor = cmp(C.Expr_MathSubtract, [dmg, 'DamageLimit'], [cn, 'Value']); // Damage at the level cap
let next = [dmg, 'ExecOut'];
if (process.env.REGEN_DEBUG) {
  const f = gate(C.Expr_String_FormatText, { FormatString: 'regen|{A}|{B}|{C}' }); wire(...D, f, 'InputA'); wire(...R, f, 'InputB'); wire(...floor, f, 'InputC');
  const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); wire(...next, pr, 'Exec');
  next = [pr, 'ExecOut'];
}
const can = cmp(C.Expr_LogicalAND, cmp(C.Expr_CompareGreater, R, K(0)), cmp(C.Expr_CompareGreater, D, floor));
const brRegen = gate(C.Exec_Branch); wire(...can, brRegen, 'bCond'); wire(...next, brRegen, 'Exec');
const set = gate(C.Exec_Character_SetDamage, { Damage: 0 }); wire(brRegen, 'ExecOutA', set, 'Exec'); wire(chr, 'Character', set, 'Character');
wire(...cmp(C.Expr_MathMax, cmp(C.Expr_MathSubtract, D, R), floor), set, 'Damage');

w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Quest regen chip' } }));
console.log(out);
