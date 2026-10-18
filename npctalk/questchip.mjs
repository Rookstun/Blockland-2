// Quest dialog chip (owner 2026-10-18: "click on the invisible circle ... dialogue and yes and no
// or yes and cancel ... task accepted makes ui noise"). One copy in the sky serves every player.
//   server: br.Chat.Command /qbox <player>|<y|o|m>|<title>|<message>
//     y = Yes/No box, o = OK/Cancel box, m = message box (OK only)
//     Yes/OK -> log "[Wire Graph] quest.yes|<userId>"   No/Cancel -> "quest.no|<userId>"
//   server: br.Chat.Command /qsfx <player>|<n>   UI sound for that player only:
//     1 accepted, 2 quest done, 3 message delivered
// Player-typed /qbox /qsfx are ignored (only the server's has no user id).
//   node npctalk/questchip.mjs <brs-js 4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' } });
const { C, gate, wire, w } = k;
const SOUNDS = ['OBA_UI_Checkpoint_Acquire_Tune_Cue', 'OBA_Bricktionary_Round_Win', 'OBA_DoorBell_1'];
const EXT = SOUNDS.map(name => ({ type: 'BrickOneShotAudioDescriptor', name }));
const print = fmt => { const f = gate(C.Expr_String_FormatText, { FormatString: fmt }); const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); return { f, p }; };
const split = (src, port) => { const s = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: 1 }); wire(src, port, s, 'Input'); return s; };
// server-only chat command -> [find, args-split]
function serverCmd(name) {
  const cmd = gate(C.Event_ChatCommand, { CommandName: name, HelpText: 'server only' });
  const who = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', who, 'Exec'); wire(cmd, 'PlayerState', who, 'PlayerState');
  const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') }); wire(who, 'UserId', isServer, 'InputA');
  const br = gate(C.Exec_Branch); wire(isServer, 'bOutput', br, 'bCond'); wire(who, 'ExecOut', br, 'Exec');
  const s1 = split(cmd, 'Arguments');
  const find = gate(C.Exec_FindPlayer, { Query: '' }); wire(br, 'ExecOutA', find, 'Exec'); wire(s1, 'Left', find, 'Query');
  return { find, s1 };
}

// ---- /qbox
{
  const { find, s1 } = serverCmd('qbox');
  const s2 = split(s1, 'Right'); // kind | title|message
  const s3 = split(s2, 'Right'); // title | message
  const is = ch => { const c = gate(C.Expr_CompareEqual, { InputB: k.str(ch) }); wire(s2, 'Left', c, 'InputA'); return c; };
  const bY = gate(C.Exec_Branch); wire(is('y'), 'bOutput', bY, 'bCond'); wire(find, 'ExecOut', bY, 'Exec');
  const bO = gate(C.Exec_Branch); wire(is('o'), 'bOutput', bO, 'bCond'); wire(bY, 'ExecOutB', bO, 'Exec');
  const answer = (box, okPort) => {
    wire(find, 'Player', box, 'PlayerState'); wire(s3, 'Left', box, 'Title'); wire(s3, 'Right', box, 'Message');
    for (const [port, tag] of [[okPort, 'yes'], ['Declined', 'no']]) {
      const id = gate(C.Exec_PlayerState_GetUserId); wire(box, port, id, 'Exec'); wire(box, 'ClickedBy', id, 'PlayerState');
      const p = print(`quest.${tag}|{A}`); wire(id, 'UserId', p.f, 'InputA'); wire(id, 'ExecOut', p.p, 'Exec');
    }
  };
  const yn = gate(C.Exec_PlayerState_ShowYesNoBox, { Title: '', Message: '' }); wire(bY, 'ExecOutA', yn, 'Exec'); answer(yn, 'YesClicked');
  const oc = gate(C.Exec_PlayerState_ShowOkCancelBox, { Title: '', Message: '' }); wire(bO, 'ExecOutA', oc, 'Exec'); answer(oc, 'OkClicked');
  const mb = gate(C.Exec_PlayerState_ShowMessageBox, { Title: '', Message: '' }); wire(bO, 'ExecOutB', mb, 'Exec'); answer(mb, 'OkClicked');
}

// ---- /qsfx
{
  const { find, s1 } = serverCmd('qsfx');
  const n = gate(C.Expr_String_ParseInt); wire(s1, 'Right', n, 'Input');
  const ref = i => gate(C.OneShotAudioReference, { Asset: i });
  const eq = v => { const c = gate(C.Expr_CompareEqual, { InputB: k.int(v) }); wire(n, 'Value', c, 'InputA'); return c; };
  const sel1 = gate(C.Expr_Select); wire(ref(0), 'Value', sel1, 'InputA'); wire(ref(1), 'Value', sel1, 'InputB'); wire(eq(2), 'bOutput', sel1, 'bSelectB');
  const sel2 = gate(C.Expr_Select); wire(sel1, 'Output', sel2, 'InputA'); wire(ref(2), 'Value', sel2, 'InputB'); wire(eq(3), 'bOutput', sel2, 'bSelectB');
  const play = gate(C.Exec_PlayClientAudio, { VolumeMultiplier: 1, PitchMultiplier: 1 });
  wire(find, 'ExecOut', play, 'Exec'); wire(find, 'Player', play, 'Player'); wire(sel2, 'Output', play, 'AudioDescriptor');
}
w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'Quest dialog chip' }, externalAssets: EXT }));
console.log(out);
