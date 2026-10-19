// Real estate build-permission chip: one copy in the sky, owned by renderman (admin owner: temp
// permissions are an admin thing). The realestate plugin drives it with a server chat command:
//   br.Chat.Command /plotperm <player>|<1|0>
// -> FindPlayer -> character -> Character_SetTempPermission BR.Permission.Building on/off.
// The plugin sends 1 every few seconds while a player stands on a lot they own or are trusted on
// (a respawn = new character = no temp permission), and 0 once when they step off. Player-typed
// /plotperm is ignored (only the server has an empty user id).
//   node realestate/permchip.mjs <brs-js 4 dist.mjs> <out.brz>     env PERM_DEBUG=1 prints plotperm|flag|hasBuilding
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: 'renderman' });
const { C, gate, wire, w } = k;

const cmd = gate(C.Event_ChatCommand, { CommandName: 'plotperm', HelpText: 'server only' });
const who = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', who, 'Exec'); wire(cmd, 'PlayerState', who, 'PlayerState');
const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') }); wire(who, 'UserId', isServer, 'InputA');
const srv = gate(C.Exec_Branch); wire(isServer, 'bOutput', srv, 'bCond'); wire(who, 'ExecOut', srv, 'Exec');
const s1 = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: 1 }); wire(cmd, 'Arguments', s1, 'Input');
const find = gate(C.Exec_FindPlayer, { Query: '' }); wire(srv, 'ExecOutA', find, 'Exec'); wire(s1, 'Left', find, 'Query');
const chr = gate(C.Exec_Character_GetFromController); wire(find, 'ExecOut', chr, 'Exec'); wire(find, 'Player', chr, 'PlayerState');
const fl = gate(C.Expr_String_ParseNumber); wire(s1, 'Right', fl, 'Input');
const on = gate(C.Expr_CompareGreater, { InputB: k.num(0) }); wire(fl, 'Value', on, 'InputA');
const set = gate(C.Exec_Character_SetTempPermission, { PermissionTagStr: 'BR.Permission.Building', bPermissionEnable: false });
wire(chr, 'ExecOut', set, 'Exec'); wire(chr, 'Character', set, 'Character'); wire(on, 'bOutput', set, 'bPermissionEnable');
if (process.env.PERM_DEBUG) {
  const has = gate(C.Exec_PlayerState_HasPermission, { PermissionName: 'BR.Permission.Building' });
  wire(set, 'ExecOut', has, 'Exec'); wire(find, 'Player', has, 'PlayerState');
  const f = gate(C.Expr_String_FormatText, { FormatString: 'plotperm|{A}|{B}' }); wire(fl, 'Value', f, 'InputA'); wire(has, 'bHasPermission', f, 'InputB');
  const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); wire(has, 'ExecOut', pr, 'Exec');
}

w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Real estate build permission chip' } }));
console.log(out);
