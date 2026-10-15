// NPC dialog chip (EA3.2 text input box), one copy in the sky serves every NPC.
//   server: br.Chat.Command /npcopen <playerName>|<title>|<message>
//     -> Show Text Input Box for that player (title = NPC name, message = what the NPC says)
//   player OK     -> log "[Wire Graph] npc.say|<userId>|<text>"
//   player Cancel -> log "[Wire Graph] npc.bye|<userId>"
// /npcopen typed by a PLAYER is ignored (only the server's has no PlayerState).
// The npctalk plugin does the rest (who is near which NPC, the LLM, the replies).
// node npctalk/chip.mjs <brs-js 4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' } });
const { C, gate, wire, print, num } = k;

const open = gate(C.Event_ChatCommand, { CommandName: 'npcopen', HelpText: 'server only' });
// only the server: a player's /npcopen has a user id
const who = gate(C.Exec_PlayerState_GetUserId);
wire(open, 'ExecOut', who, 'Exec'); wire(open, 'PlayerState', who, 'PlayerState');
const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') });
wire(who, 'UserId', isServer, 'InputA');
const gateB = gate(C.Exec_Branch); wire(isServer, 'bOutput', gateB, 'bCond'); wire(who, 'ExecOut', gateB, 'Exec');
// name|title|message
const split = (src, srcPort) => { const s = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: Number(process.env.OCC ?? 1) }); wire(src, srcPort, s, 'Input'); return s; };
const s1 = split(open, 'Arguments');           // Left = player name, Right = title|message
const s2 = split(s1, 'Right');                  // Left = title, Right = message
const find = gate(C.Exec_FindPlayer, { Query: '' });
wire(gateB, 'ExecOutA', find, 'Exec'); wire(s1, 'Left', find, 'Query');
const box = gate(C.Exec_PlayerState_ShowTextInputBox, { Title: '', Message: '' });
wire(find, 'ExecOut', box, 'Exec'); wire(find, 'Player', box, 'PlayerState');
wire(s2, 'Left', box, 'Title'); wire(s2, 'Right', box, 'Message');
const dbg = print('npc.open|{A}|{B}|{C}');
wire(box, 'ExecOut', dbg.p, 'Exec'); wire(s1, 'Left', dbg.f, 'InputA'); wire(s2, 'Left', dbg.f, 'InputB'); wire(find, 'Player', dbg.f, 'InputC');

// answers
const okId = gate(C.Exec_PlayerState_GetUserId);
wire(box, 'OkClicked', okId, 'Exec'); wire(box, 'ClickedBy', okId, 'PlayerState');
const say = print('npc.say|{A}|{B}');
wire(okId, 'ExecOut', say.p, 'Exec'); wire(okId, 'UserId', say.f, 'InputA'); wire(box, 'Text', say.f, 'InputB');
const byeId = gate(C.Exec_PlayerState_GetUserId);
wire(box, 'Declined', byeId, 'Exec'); wire(box, 'ClickedBy', byeId, 'PlayerState');
const bye = print('npc.bye|{A}');
wire(byeId, 'ExecOut', bye.p, 'Exec'); wire(byeId, 'UserId', bye.f, 'InputA');
void num;
writeFileSync(out, k.save(null, 'NPC dialog chip'));
console.log(out);
