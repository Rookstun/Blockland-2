// Quest HUD chip (owner 2026-10-15: "a quest subsystem that has quests at the right
// side, runescape style"). One copy in the sky serves every player:
//   server: br.Chat.Command /questhud <playerName>|<text>
// draws <text> as one HUD text block on the RIGHT edge of that player's screen
// (TextId 7700, replaces the last one). Chat-command arguments can't carry newlines
// or quotes, so the text uses markers the chip turns into rich text:
//   ~ newline   {h} quest-list orange   {r} red (not started)   {y} yellow (in progress)
//   {g} green (done)   {w} white   {d} dim grey   {/} end colour   {b} {/b} bold
// A player-typed /questhud is ignored (only the server's has no PlayerState).
//   node npctalk/questhud.mjs <brs-js 4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist, { owner: { id: 'ea32a1c0-0000-4b0b-9a11-00000000a1c0', name: 'NPC Talk', display_name: 'NPC Talk' } });
const { C, gate, wire, print } = k;
const COLORS = { '{h}': 'ff981f', '{r}': 'ff4b3e', '{y}': 'ffde3a', '{g}': '4fe36c', '{w}': 'ffffff', '{d}': '9a9a9a' };

const cmd = gate(C.Event_ChatCommand, { CommandName: 'questhud', HelpText: 'server only' });
const who = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', who, 'Exec'); wire(cmd, 'PlayerState', who, 'PlayerState');
const isServer = gate(C.Expr_CompareEqual, { InputB: k.str('') }); wire(who, 'UserId', isServer, 'InputA');
const onlyServer = gate(C.Exec_Branch); wire(isServer, 'bOutput', onlyServer, 'bCond'); wire(who, 'ExecOut', onlyServer, 'Exec');
const split = gate(C.Expr_String_Split, { Delimiter: '|', bCaseSensitive: false, Occurrence: 1 }); wire(cmd, 'Arguments', split, 'Input');
// markers -> rich text
const nl = gate(C.Expr_String_CodepointToCharacter); wire(...[gate(C.Var, { Value: k.int(10) }), 'Value'], nl, 'Codepoint');
let text = [split, 'Right'];
const replace = (search, replacement, replPort) => {
  const r = gate(C.Expr_String_Replace, { Input: '', Search: search, Replacement: replacement ?? '', bCaseSensitive: true, Start: 0, MaxReplacements: -1 });
  wire(...text, r, 'Input'); if (replPort) wire(...replPort, r, 'Replacement');
  text = [r, 'Output'];
};
replace('~', null, [nl, 'Character']);
for (const [m, hex] of Object.entries(COLORS)) replace(m, `<color="${hex}">`);
replace('{b}', '<b>'); replace('{/b}', '</>'); replace('{/}', '</>');
const find = gate(C.Exec_FindPlayer, { Query: '' }); wire(onlyServer, 'ExecOutA', find, 'Exec'); wire(split, 'Left', find, 'Query');
const show = gate(C.Exec_PlayerState_DisplayText, {
  Text: '', Font: null, Typeface: 0, Anchor: { X: 1, Y: 0.22 }, Position: { X: -18, Y: 0 }, Angle: 0, ZOrder: 0, Scale: { X: 1, Y: 1 }, Pivot: { X: 1, Y: 0 },
  FontSize: 19, FontColor: { R: 1, G: 1, B: 1, A: 1 }, LetterSpacing: 0, Skew: 0, LineHeight: 1.15, OutlineSize: 2, OutlineColor: { R: 0, G: 0, B: 0, A: 1 },
  bMiteredOutline: false, WrapWidth: 0, ShadowOffset: { X: 1, Y: 1 }, ShadowColor: { R: 0, G: 0, B: 0, A: 0.6 }, Justification: 0, Transition: 0, Easing: 0,
  Lifetime: 86400, TextId: 7700,
});
wire(find, 'ExecOut', show, 'Exec'); wire(find, 'Player', show, 'PlayerState'); wire(...text, show, 'Text');
const dbg = print('questhud|{A}|{B}'); wire(show, 'ExecOut', dbg.p, 'Exec'); wire(split, 'Left', dbg.f, 'InputA'); wire(...text, dbg.f, 'InputB');
writeFileSync(out, k.save(null, 'Quest HUD chip'));
console.log(out);
