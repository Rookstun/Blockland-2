// /clear chip (owner 2026-10-21: "make /clear which removes someones inventory").
// The progress plugin's /clear <player> (host + config `allowed`) sends
//   server: br.Chat.Command /invclear <exact player name>
// -> FindPlayer -> character -> SetInventoryItem with no item in slots 0-9, logs "[invclear] <name>".
// Player-typed /invclear is ignored (only the server has an empty user id). Own owner (wire budget).
//   node invclear/chip.mjs <brs-js 4 dist.mjs> <out.brz>
// Live: br.Prefab.Load "invclear" -4000 -12000 8000 0 16; reload = br.World.ClearRegion -4000 -12000 8000 6 6 6 first.
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32c1ea-0000-4b0b-9a11-0000001c1ea0', name: 'Inventory Clear', display_name: 'Inventory Clear' } });
const { C, gate, wire, w } = k;

const cmd = gate(C.Event_ChatCommand, { CommandName: 'invclear', HelpText: 'server only' });
const who = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', who, 'Exec'); wire(cmd, 'PlayerState', who, 'PlayerState');
const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') }); wire(who, 'UserId', isServer, 'InputA');
const srv = gate(C.Exec_Branch); wire(isServer, 'bOutput', srv, 'bCond'); wire(who, 'ExecOut', srv, 'Exec');
const find = gate(C.Exec_FindPlayer, { Query: '' }); wire(srv, 'ExecOutA', find, 'Exec'); wire(cmd, 'Arguments', find, 'Query');
const chr = gate(C.Exec_Character_GetFromController); wire(find, 'ExecOut', chr, 'Exec'); wire(find, 'Player', chr, 'PlayerState');
let next = [chr, 'ExecOut'];
for (let s = 0; s < 10; s++) {
  const set = gate(C.Exec_Character_SetInventoryItem, { Slot: s });
  wire(...next, set, 'Exec'); wire(chr, 'Character', set, 'Character');
  next = [set, 'ExecOut'];
}
const f = gate(C.Expr_String_FormatText, { FormatString: '[invclear] {A}' }); wire(cmd, 'Arguments', f, 'InputA');
const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', pr, 'Text'); wire(...next, pr, 'Exec');

w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Inventory clear chip' } }));
console.log(out);
