// Which wires from a bot spawner's SpawnedCharacter does the game accept?
// One NPC spawner on a plate + taps: Var_Set.Value, Entity_GetLocation.Entity,
// GetValueType.Input, FormatText.InputA (+ DistanceToTarget -> FormatText).
// Every 2 s prints "npcp ..." with what came through. Load in the sky on its plate.
import { readFileSync, writeFileSync } from 'node:fs';
import { mk } from '../ea32test/lib.mjs';
const [dist, out] = process.argv.slice(2);
const lib = await import(new URL(`file:///${dist.replace(/\\/g, '/')}`).href);
const r = lib.WorldReader.from(new Uint8Array(readFileSync(new URL('roles/npc_farmer.brz', import.meta.url))));
let data; for (const ref of r.brickChunkIndex(1)) for (const c of r.componentChunk(1, ref.index).components) if (c.typeName === 'Component_BotSpawn') data = c.data;
const k = await mk(dist, { mainBase: [-200, 200], rowStep: 40, baseZ: 6 });
const { w, C, gate, wire } = k;
w.addBrick({ asset: 'PB_DefaultTile', size: [300, 300, 2], position: [0, 0, 0], color: [60, 60, 70], owner_index: k.ownerIdx });
const sp = { h: w.addBrick({ asset: 'B_Bot_Spawn_Point', position: [0, 0, 4], color: [255, 255, 255], owner_index: k.ownerIdx,
  components: [{ type: 'Component_BotSpawn', data: { ...data, MovementAmount: 0, MovementRandomness: 0, MoveTarget: { X: 0, Y: 0, Z: 0 } } }] }), c: C.BotSpawn };
const vr = gate(C.Var, { Value: { $variant: 'f64', value: 0 } });
const clock = gate(C.Clock, { bEnabled: true, bPulseOn: false, OnTimeSeconds: 1, OffTimeSeconds: 1, IntervalSeconds: 2 });
const tick = gate(C.Expr_EdgeDetectorExec); wire(clock, 'Pulse', tick, 'Input');
const set = gate(C.Exec_Var_Set, { bChangeType: true }); wire(vr, 'VarRef', set, 'VarRef');
wire(sp, 'SpawnedCharacter', set, 'Value');                 // tap A
wire(tick, 'OnRisingEdge', set, 'Exec');
const loc = gate(C.Exec_Entity_GetLocation); wire(set, 'ExecOut', loc, 'Exec');
wire(sp, 'SpawnedCharacter', loc, 'Entity');                // tap B
const loc2 = gate(C.Exec_Entity_GetLocation); wire(loc, 'ExecOut', loc2, 'Exec');
wire(vr, 'Value', loc2, 'Entity');                          // via the Var
const vt = gate(C.Expr_GetValueType); wire(sp, 'SpawnedCharacter', vt, 'Input');   // tap C
const f = gate(C.Expr_String_FormatText, { FormatString: 'npcp direct={A} viaVar={B} type={C} raw={D} dist={E} varType={F}' });
wire(loc, 'Vector', f, 'InputA'); wire(loc2, 'Vector', f, 'InputB'); wire(vt, 'Type', f, 'InputC');
wire(sp, 'SpawnedCharacter', f, 'InputD');                  // tap D
wire(sp, 'DistanceToTarget', f, 'InputE');
const vt2 = gate(C.Expr_GetValueType); wire(vr, 'Value', vt2, 'Input'); wire(vt2, 'Type', f, 'InputF');
const p = gate(C.Exec_PrintToConsole, { Text: '' }); wire(f, 'Output', p, 'Text'); wire(loc2, 'ExecOut', p, 'Exec');
w.makePrefab({});
writeFileSync(out, w.toBrz({ bundle: { description: 'follow probe' }, externalAssets: r.externalAssets() }));
console.log(out);
