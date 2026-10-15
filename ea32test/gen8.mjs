// EA3.2 Var semantics probe: are Var writes visible to reads later in the
// same exec chain, and from one loop iteration to the next? Prints "ea32 rw ...".
import { writeFileSync } from 'node:fs';
import { mk } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist);
const { C, gate, wire, print, chip, onLoad, num } = k;
const go = onLoad(3);
const { shell, grid } = chip(C.Microchip_CountFor, { Count: 4, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
wire(go, 'OnRisingEdge', shell, 'Exec');
const entry = gate(C.CallableEntry_CountFor, {}, grid);
const a = gate(C.Var, { Value: num(0) }, grid);
const one = gate(C.Var, { Value: num(1) }, grid);
// chain per iteration: print a -> a = a + 10 -> print a -> a = a * 2 (via add twice) -> print a
const p1 = print('ea32 rw i={A} before a={B}', grid);
wire(entry, 'Body', p1.p, 'Exec'); wire(entry, 'Index', p1.f, 'InputA'); wire(a, 'Value', p1.f, 'InputB');
const add10 = gate(C.Expr_MathAdd, { InputB: num(10) }, grid); wire(a, 'Value', add10, 'InputA');
const s1 = gate(C.Exec_Var_Set, {}, grid); wire(a, 'VarRef', s1, 'VarRef'); wire(add10, 'Output', s1, 'Value');
wire(p1.p, 'ExecOut', s1, 'Exec');
const p2 = print('ea32 rw i={A} after+10 a={B} add10out={C}', grid);
wire(s1, 'ExecOut', p2.p, 'Exec'); wire(entry, 'Index', p2.f, 'InputA'); wire(a, 'Value', p2.f, 'InputB'); wire(add10, 'Output', p2.f, 'InputC');
const inc = gate(C.Exec_Var_Increment, { Value: num(1) }, grid); wire(a, 'VarRef', inc, 'VarRef');
wire(p2.p, 'ExecOut', inc, 'Exec');
const get = gate(C.Exec_Var_Get, {}, grid); wire(a, 'VarRef', get, 'VarRef'); wire(inc, 'ExecOut', get, 'Exec');
const p3 = print('ea32 rw i={A} after inc a={B} varget={C}', grid);
wire(get, 'ExecOut', p3.p, 'Exec'); wire(entry, 'Index', p3.f, 'InputA'); wire(a, 'Value', p3.f, 'InputB'); wire(get, 'Value', p3.f, 'InputC');
void one;
writeFileSync(out, k.save(null, 'EA3.2 var semantics probe'));
