// REAL ESTATE IN WIRES (owner 2026-10-20: "no omegga just use wires. players should be granted build
// perms when in the zone", "you never set the sign when its owned"). One prefab per lot = the pad's
// BP_ZoneProjector (build zone) + the owner's FOR SALE sign + ONE hidden microchip on the sign post holding
// every gate (owner 2026-10-21: "put your shit in microchips, spawn has a ton of floating shit"; the gates
// used to float 1600 over the lot):
//   E on the sign board (Component_Button) -> unowned: remember who + when, "type /confirm within 10 s"
//                                          -> owned: whose it is
//   /confirm (every lot chip hears it; only the one you clicked answers) -> coins >= price ->
//     coins -= price, owner = you, board text = SOLD to <name>, cash ding
//   character enters the zone -> SetTempPermission Building = (its player is the owner); leaves -> off
// Owner id/name live in Vars (saved with the world). Initial owners: --owners FILE {"<lot id>": {id, name}}.
//   node realestate/lotchip.mjs [--plots omegga-realestate/plots.json] [--owners realestate/site/owners.json] [--out realestate/out]
//   -> OUT/lot_<id>.brz (Prefab.Load "lot_<id>" x y ground 0 16) + OUT/load.json (bridge job: clears + loads)
// Pad geometry = plots.mjs (projector inset P 10, bank 30, sign outside the bank facing the plaza).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
import { saleSign, signText, SIGN_FONT } from './salesign.mjs';
import { worldBox } from '../mapgen/orient.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const DIST = ROOT + 'tools/brs4/dist.mjs';
const PLOTS = JSON.parse(readFileSync(opt('plots', ROOT + 'omegga-realestate/plots.json'), 'utf8'));
const OWNERS = (() => { try { return JSON.parse(readFileSync(opt('owners', ROOT + 'realestate/site/owners.json'), 'utf8')); } catch { return {}; } })();
const OUT = opt('out', ROOT + 'realestate/out');
const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' }; // admin: may pay coins + set temp permissions
const SPAWN = [-120, 160], BANK = 30, P = 10, DEPTH = 30, ZONE_H = 1200, CONFIRM_S = 10;
const HIDE = { visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } };
const EXT = [SIGN_FONT, { type: 'BrickOneShotAudioDescriptor', name: 'OBA_CashRegister_Ding' }];

mkdirSync(OUT, { recursive: true });
const load = [];
for (const p of PLOTS) {
  const { id, x, y, ground: g, half: I, studs, price } = p;
  const own = OWNERS[id] ?? null;
  const k = await mk(DIST, { owner: MAP_OWNER });
  const { w, C, wire, num, str } = k;
  let CG; // the chip's inner grid (made once the sign post is placed)
  const gate = (c, data = {}) => k.gate(c, data, CG);
  const raw = (h, c) => ({ h, c }); // a non-gate brick's component as a wire end

  // ---- bricks (local to the load point x, y, g)
  const zone = w.addBrick({ asset: 'BP_ZoneProjector', size: [I - P, I - P, 2], position: [0, 0, 2], color: [255, 255, 255], owner_index: k.ownerIdx,
    visibility: false, collision: { player: false, weapon: false, interaction: false, tool: true, physics: false },
    components: [{ type: 'Component_Internal_AttachedZone', data: { ZoneStartDistance: 0, ZoneEndDistance: DEPTH + ZONE_H, bIsBuildingZone: true,
      bIsLooseZone: false, bIsShareZone: false, bWater: false, bDetectPlayers: true, bDetectPlayers1: true, bDetectPlayers2: true, bDetectPlayers3: true } }] });
  const fx = Math.abs(SPAWN[0] - x) > Math.abs(SPAWN[1] - y) ? Math.sign(SPAWN[0] - x) : 0, fy = fx ? 0 : Math.sign(SPAWN[1] - y);
  const ox = fx * (I + BANK + 10) + (fy ? -I + 40 : 0), oy = fy * (I + BANK + 10) + (fx ? I - 40 : 0);
  const sign = saleSign(id, ox, oy, 0, [fx, fy], 0, { studs, price, button: true, text: signText(id, studs, price, own?.name) });
  let board;
  let post;
  for (const b of sign) { const h = w.addBrick({ ...b, owner_index: k.ownerIdx }); if (b.size.join() === '13,9,1') board = h; if (b.size[2] === 27) post = b; }
  // the chip sits on top of the post (invisible, no collision); value wires cross into it through
  // MicrochipInput gates (arcade cabinet pattern) and out through a MicrochipOutput
  const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [post.position[0], post.position[1], post.position[2] + 29], owner_index: k.ownerIdx,
    visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
  CG = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 220, Y: -140, Z: 0 }, PlaneExtent: { X: 260, Y: 180, Z: 2 } } });
  w.registerMicrochipLink(chipBrick, CG);
  const pin = (src, label, order) => { const g = gate(C.MicrochipInput, { PortLabel: label, PortOrder: order }); wire(src, src.c === C.AttachedZone ? 'ZoneRef' : label, g, 'RER_Input'); return { h: g.h, c: g.c, out: 'RER_Output' }; };
  const Zb = raw(zone, C.AttachedZone), Bb = raw(board, C.Button), T = raw(board, C.TextDisplay);
  const zIn = pin(Zb, 'ZoneRef', 0), hIn = pin(Bb, 'bHeld', 1), cIn = pin(Bb, 'Character', 2);

  // ---- state
  const ownerId = gate(C.Var, { Value: str(own?.id ?? '') });
  const ownerName = gate(C.Var, { Value: str(own?.name ?? '') });
  const pendId = gate(C.Var, { Value: str('-') }); // never '' (a server-issued command has an empty user id)
  const pendT = gate(C.Var, { Value: num(-1000) });
  const text = gate(C.Var, { Value: str(signText(id, studs, price, own?.name)) });
  const tOut = gate(C.MicrochipOutput, { PortLabel: 'Text', PortOrder: 0 }); wire(text, 'Value', tOut, 'RER_Input'); wire(tOut, 'RER_Output', T, 'Text');
  const uptime = gate(C.Expr_ServerUptime);
  const msg = (pl, exec, fmt, A) => { // status line + chat line to that player
    const f = gate(C.Expr_String_FormatText, { FormatString: fmt }); if (A) wire(A[0], A[1], f, 'InputA');
    const s = gate(C.Exec_PlayerState_ShowStatusMessage, { Message: '' }); wire(exec[0], exec[1], s, 'Exec'); wire(pl[0], pl[1], s, 'PlayerState'); wire(f, 'Output', s, 'Message');
    const c = gate(C.Exec_PlayerState_ShowChatMessage, { Message: '' }); wire(s, 'ExecOut', c, 'Exec'); wire(pl[0], pl[1], c, 'PlayerState'); wire(f, 'Output', c, 'Message');
    return c;
  };
  const getVar = (v, exec) => { const gv = gate(C.Exec_Var_Get); wire(v, 'VarRef', gv, 'VarRef'); wire(exec[0], exec[1], gv, 'Exec'); return gv; };
  const setVar = (v, exec, val) => { const sv = gate(C.Exec_Var_Set); wire(v, 'VarRef', sv, 'VarRef'); wire(exec[0], exec[1], sv, 'Exec'); wire(val[0], val[1], sv, 'Value'); return sv; };
  const konst = v => [gate(C.Var, { Value: typeof v === 'string' ? str(v) : num(v) }), 'Value'];
  const LOT = `<b>Lot ${id}</> · ${studs}x${studs} studs`;

  // ---- E on the board
  const edge = gate(C.Expr_EdgeDetectorExec); wire(hIn, 'RER_Output', edge, 'Input');
  const ps = gate(C.Exec_PlayerState_GetFromEntity); wire(edge, 'OnRisingEdge', ps, 'Exec'); wire(cIn, 'RER_Output', ps, 'Entity');
  const uid = gate(C.Exec_PlayerState_GetUserId); wire(ps, 'ExecOut', uid, 'Exec'); wire(ps, 'PlayerState', uid, 'PlayerState');
  const oNow = getVar(ownerId, [uid, 'ExecOut']), nNow = getVar(ownerName, [oNow, 'ExecOut']);
  const free = gate(C.Expr_CompareEqual, { InputB: str('') }); wire(oNow, 'Value', free, 'InputA');
  const br1 = gate(C.Exec_Branch); wire(free, 'bOutput', br1, 'bCond'); wire(nNow, 'ExecOut', br1, 'Exec');
  // for sale: remember the clicker
  const s1 = setVar(pendId, [br1, 'ExecOutA'], [uid, 'UserId']);
  const s2 = setVar(pendT, [s1, 'ExecOut'], [uptime, 'Uptime']);
  msg([ps, 'PlayerState'], [s2, 'ExecOut'], `<color="ffd34d">${LOT} · ${price} coins</> <color="ffffff">Click to buy? Type <b>/confirm</> within ${CONFIRM_S} seconds.</>`);
  // owned: yours / theirs
  const mine = gate(C.Expr_CompareEqual); wire(oNow, 'Value', mine, 'InputA'); wire(uid, 'UserId', mine, 'InputB');
  const br2 = gate(C.Exec_Branch); wire(mine, 'bOutput', br2, 'bCond'); wire(br1, 'ExecOutB', br2, 'Exec');
  msg([ps, 'PlayerState'], [br2, 'ExecOutA'], `<color="88ff88">${LOT} is yours. Stand on it and open build mode.</>`);
  msg([ps, 'PlayerState'], [br2, 'ExecOutB'], `<color="ffd34d">${LOT}</> <color="88ccff">belongs to {A}.</>`, [nNow, 'Value']);

  // ---- /confirm
  const cmd = gate(C.Event_ChatCommand, { CommandName: 'confirm', HelpText: 'buy the lot whose FOR SALE sign you just clicked' });
  const cu = gate(C.Exec_PlayerState_GetUserId); wire(cmd, 'ExecOut', cu, 'Exec'); wire(cmd, 'PlayerState', cu, 'PlayerState');
  const pI = getVar(pendId, [cu, 'ExecOut']), pT = getVar(pendT, [pI, 'ExecOut']), oI = getVar(ownerId, [pT, 'ExecOut']);
  const isMe = gate(C.Expr_CompareEqual); wire(cu, 'UserId', isMe, 'InputA'); wire(pI, 'Value', isMe, 'InputB');
  const br3 = gate(C.Exec_Branch); wire(isMe, 'bOutput', br3, 'bCond'); wire(oI, 'ExecOut', br3, 'Exec'); // not my click: stay quiet
  const clr = setVar(pendId, [br3, 'ExecOutA'], konst('-'));                                             // one try per click
  const age = gate(C.Expr_MathSubtract); wire(uptime, 'Uptime', age, 'InputA'); wire(pT, 'Value', age, 'InputB');
  const inTime = gate(C.Expr_CompareLessOrEqual, { InputB: num(CONFIRM_S) }); wire(age, 'Output', inTime, 'InputA');
  const notNeg = gate(C.Expr_CompareGreaterOrEqual, { InputB: num(0) }); wire(age, 'Output', notNeg, 'InputA'); // uptime restarts with the server
  const stillFree = gate(C.Expr_CompareEqual, { InputB: str('') }); wire(oI, 'Value', stillFree, 'InputA');
  const a1 = gate(C.Expr_LogicalAND); wire(inTime, 'bOutput', a1, 'bInputA'); wire(notNeg, 'bOutput', a1, 'bInputB');
  const a2 = gate(C.Expr_LogicalAND); wire(a1, 'bOutput', a2, 'bInputA'); wire(stillFree, 'bOutput', a2, 'bInputB');
  const br4 = gate(C.Exec_Branch); wire(a2, 'bOutput', br4, 'bCond'); wire(clr, 'ExecOut', br4, 'Exec');
  msg([cmd, 'PlayerState'], [br4, 'ExecOutB'], `<color="ff8888">Too slow: click the sign of Lot ${id} again.</>`);
  const coins = gate(C.Exec_Gamemode_GetLeaderboardValue, { Key: 'coins' }); wire(br4, 'ExecOutA', coins, 'Exec'); wire(cmd, 'PlayerState', coins, 'PlayerState');
  const rich = gate(C.Expr_CompareGreaterOrEqual, { InputB: num(price) }); wire(coins, 'Value', rich, 'InputA');
  const br5 = gate(C.Exec_Branch); wire(rich, 'bOutput', br5, 'bCond'); wire(coins, 'ExecOut', br5, 'Exec');
  msg([cmd, 'PlayerState'], [br5, 'ExecOutB'], `<color="ff8888">Lot ${id} costs ${price} coins. You have {A}.</>`, [coins, 'Value']);
  const pay = gate(C.Exec_Gamemode_IncrementLeaderboardValue, { Key: 'coins', Value: -price }); wire(br5, 'ExecOutA', pay, 'Exec'); wire(cmd, 'PlayerState', pay, 'PlayerState');
  const un = gate(C.Exec_PlayerState_GetUserName); wire(pay, 'ExecOut', un, 'Exec'); wire(cmd, 'PlayerState', un, 'PlayerState');
  const so1 = setVar(ownerId, [un, 'ExecOut'], [cu, 'UserId']);
  const so2 = setVar(ownerName, [so1, 'ExecOut'], [un, 'UserName']);
  const sold = gate(C.Expr_String_FormatText, { FormatString: signText(id, studs, price, '{A}') }); wire(un, 'UserName', sold, 'InputA');
  const so3 = setVar(text, [so2, 'ExecOut'], [sold, 'Output']);
  const ding = gate(C.Exec_PlayClientAudio, { AudioDescriptor: 1, VolumeMultiplier: 1, PitchMultiplier: 1 }); wire(so3, 'ExecOut', ding, 'Exec'); wire(cmd, 'PlayerState', ding, 'Player');
  const done = msg([cmd, 'PlayerState'], [ding, 'ExecOut'], `<color="88ff88">Lot ${id} is yours for ${price} coins. Stand on it and open build mode.</>`);
  const log = gate(C.Expr_String_FormatText, { FormatString: `realestate|bought|${id}|{A}|{B}` }); wire(un, 'UserName', log, 'InputA'); wire(cu, 'UserId', log, 'InputB');
  const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(done, 'ExecOut', pr, 'Exec'); wire(log, 'Output', pr, 'Text');

  // ---- build permission inside the zone
  const ent = gate(C.CharacterZoneEvent_Entered); wire(zIn, 'RER_Output', ent, 'Zone');
  const eps = gate(C.Exec_PlayerState_GetFromEntity); wire(ent, 'Exec', eps, 'Exec'); wire(ent, 'Character', eps, 'Entity');
  const eu = gate(C.Exec_PlayerState_GetUserId); wire(eps, 'ExecOut', eu, 'Exec'); wire(eps, 'PlayerState', eu, 'PlayerState');
  const eo = getVar(ownerId, [eu, 'ExecOut']), en = getVar(ownerName, [eo, 'ExecOut']);
  const eMine = gate(C.Expr_CompareEqual); wire(eu, 'UserId', eMine, 'InputA'); wire(eo, 'Value', eMine, 'InputB');
  const perm = gate(C.Exec_Character_SetTempPermission, { PermissionTagStr: 'BR.Permission.Building', bPermissionEnable: false });
  wire(en, 'ExecOut', perm, 'Exec'); wire(ent, 'Character', perm, 'Character'); wire(eMine, 'bOutput', perm, 'bPermissionEnable');
  const eb = gate(C.Exec_Branch); wire(eMine, 'bOutput', eb, 'bCond'); wire(perm, 'ExecOut', eb, 'Exec');
  const eFree = gate(C.Expr_CompareEqual, { InputB: str('') }); wire(eo, 'Value', eFree, 'InputA');
  const eb2 = gate(C.Exec_Branch); wire(eFree, 'bOutput', eb2, 'bCond'); wire(eb, 'ExecOutB', eb2, 'Exec');
  const st = (exec, fmt, A) => { const f = gate(C.Expr_String_FormatText, { FormatString: fmt }); if (A) wire(A[0], A[1], f, 'InputA');
    const s = gate(C.Exec_PlayerState_ShowStatusMessage, { Message: '' }); wire(exec[0], exec[1], s, 'Exec'); wire(eps, 'PlayerState', s, 'PlayerState'); wire(f, 'Output', s, 'Message'); };
  st([eb, 'ExecOutA'], `<color="88ff88">${LOT} · your lot · build mode is yours here</>`);
  st([eb2, 'ExecOutA'], `<color="ffd34d">${LOT} · FOR SALE ${price} coins · click the sign</>`);
  st([eb2, 'ExecOutB'], `<color="ffd34d">${LOT}</> <color="88ccff">owned by {A}</>`, [en, 'Value']);
  const left = gate(C.CharacterZoneEvent_Left); wire(zIn, 'RER_Output', left, 'Zone');
  const off = gate(C.Exec_Character_SetTempPermission, { PermissionTagStr: 'BR.Permission.Building', bPermissionEnable: false });
  wire(left, 'Exec', off, 'Exec'); wire(left, 'Character', off, 'Character');

  w.makePrefab({});
  writeFileSync(`${OUT}/lot_${id}.brz`, w.toBrz({ bundle: { description: `Real estate Lot ${id} (zone, sign, wires)` }, externalAssets: EXT }));

  // clear boxes for what this prefab replaces: the old projector + the old sign (each brick +1)
  const boxes = [[x, y, g + 2, I - P + 1, I - P + 1, 3]];
  boxes.push([x, y - 100, g + 1600, 241, 141, 12]); // the old gate field 1600 over the lot (gates before 2026-10-21)
  boxes.push([x + ox, y + oy, g + 29, 6, 6, 32]); // the post + the chip on its top (chip half 5,5,2)
  for (const b of saleSign(id, x + ox, y + oy, g, [fx, fy], 0, { studs, price })) {
    const [lo, hi] = worldBox(b); boxes.push(lo.map((v, i) => (v + hi[i]) / 2).concat(hi.map((v, i) => (v - lo[i]) / 2 + 1)));
  }
  load.push({ id, at: [x, y, g], boxes, owner: own });
  console.log(`lot ${id}: ${own ? 'owned by ' + own.name : 'for sale'}, sign ${x + ox},${y + oy}`);
}
writeFileSync(`${OUT}/load.json`, JSON.stringify(load, null, 1));
