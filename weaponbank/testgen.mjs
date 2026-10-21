// test prefab: /bt<op> <player name> -> global event bank.act (that player's character, op) as the bank's buttons send it
import fs from 'node:fs';
const l = await import(new URL('../tools/brs4/dist.mjs', import.meta.url));
const { World, brdb } = l; const C = brdb.COMPONENTS;
const w = new World(); const oi = w.addOwner({ id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage', display_name: 'renderman' });
let gi = 0;
const gate = (c, data = {}) => ({ h: w.addBrick({ asset: c.BRICK, ...(c.BRICK.startsWith('PB_') ? { size: [10, 5, 2] } : {}), position: [(gi % 6) * 40, Math.floor(gi++ / 6) * 40, 2], color: [200, 200, 200], owner_index: oi, visibility: false, collision: false, components: [{ type: c.NAME, data }] }), c });
const wire = (a, ap, b, bp) => w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
for (const op of [0, 1, 2, 3, 4]) {
  const cmd = gate(C.Event_ChatCommand, { CommandName: 'bt' + op, HelpText: 'bank test' });
  const fp = gate(C.Exec_FindPlayer); wire(cmd, 'ExecOut', fp, 'Exec'); wire(cmd, 'Arguments', fp, 'Query');
  const s = gate(C.Exec_SendCustomEventGlobal, { EventName: 'bank.act', DataIn1: { $variant: 'weak_object', value: null }, DataIn2: { $variant: 'i64', value: op },
    ...Object.fromEntries([3, 4, 5, 6, 7, 8].map(k => [`DataIn${k}`, { $variant: 'f64', value: 0 }])) });
  const gc = gate(C.Exec_Character_GetFromController); wire(fp, 'ExecOut', gc, 'Exec'); wire(fp, 'Player', gc, 'PlayerState');
  wire(gc, 'ExecOut', s, 'ExecIn'); wire(gc, 'Character', s, 'DataIn1');
  const f = gate(C.Expr_String_FormatText, { FormatString: 'bt|' + op + '|{A}|{B}' }); wire(cmd, 'Arguments', f, 'InputA'); wire(fp, 'Player', f, 'InputB');
  const pr = gate(C.Exec_PrintToConsole, { Text: '' }); wire(s, 'ExecOut', pr, 'Exec'); wire(f, 'Output', pr, 'Text');
}
w.makePrefab({});
fs.writeFileSync(new URL('./banktest.brz', import.meta.url), w.toBrz({ bundle: { description: 'bank test' } }));
console.log('banktest.brz', gi, 'gates');
