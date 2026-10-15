// EA3.2 NPC talk probe. /talk (typed by a player) opens a text input box;
// what they type + who clicked prints to the log ("ea32 talk ..."). /npcsay
// prints its Arguments and whether it had a PlayerState (to see if a
// server-issued `br.Chat.Command /npcsay ...` reaches wires).
import { writeFileSync } from 'node:fs';
import { mk } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist);
const { C, gate, wire, print } = k;

const talk = gate(C.Event_ChatCommand, { CommandName: 'talk', HelpText: 'NPC talk probe' });
const box = gate(C.Exec_PlayerState_ShowTextInputBox, { Title: 'Old Mira', Message: 'Well met, traveller. What do you want to say?' });
wire(talk, 'ExecOut', box, 'Exec'); wire(talk, 'PlayerState', box, 'PlayerState');
const ok = print('ea32 talk ok text={A} clickedBy={B}');
wire(box, 'OkClicked', ok.p, 'Exec'); wire(box, 'Text', ok.f, 'InputA'); wire(box, 'ClickedBy', ok.f, 'InputB');
const no = print('ea32 talk declined by={A}');
wire(box, 'Declined', no.p, 'Exec'); wire(box, 'ClickedBy', no.f, 'InputA');
const after = print('ea32 talk shown (ExecOut)');
wire(box, 'ExecOut', after.p, 'Exec');

const say = gate(C.Event_ChatCommand, { CommandName: 'npcsay', HelpText: 'NPC reply probe' });
const uid = gate(C.Exec_PlayerState_GetUserId);
wire(say, 'ExecOut', uid, 'Exec'); wire(say, 'PlayerState', uid, 'PlayerState');
const sp = print('ea32 npcsay args={A} uid={B}');
wire(uid, 'ExecOut', sp.p, 'Exec'); wire(say, 'Arguments', sp.f, 'InputA'); wire(uid, 'UserId', sp.f, 'InputB');
writeFileSync(out, k.save(null, 'EA3.2 NPC talk probe'));
