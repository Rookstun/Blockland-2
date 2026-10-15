// EA3.2 cross-grid probe: can a VALUE wire (Var.Value) go from the main grid
// into a loop chip's inner grid, and can an Exec_Var_Set inside the loop write
// a main-grid Var through a cross-grid VarRef? Prints "ea32 xg ...".
import { writeFileSync } from 'node:fs';
import { mk } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const k = await mk(dist);
const { C, gate, wire, print, chip, onLoad, num } = k;
const mainVar = gate(C.Var, { Value: num(7) });
const go = onLoad(3);
const { shell, grid } = chip(C.Microchip_CountFor, { Count: 2, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
wire(go, 'OnRisingEdge', shell, 'Exec');
const entry = gate(C.CallableEntry_CountFor, {}, grid);
const pr = print('ea32 xg i={A} mainVar={B}', grid);
wire(entry, 'Body', pr.p, 'Exec');
wire(entry, 'Index', pr.f, 'InputA');
const port = gate(C.MicrochipInput, { PortLabel: 'v', PortOrder: 0 }, grid);
wire(mainVar, 'Value', port, 'RER_Input');        // into the chip through its port
wire(port, 'RER_Output', pr.f, 'InputB');
const after = print('ea32 xg after mainVar={A}');
wire(shell, 'Completed', after.p, 'Exec');
wire(mainVar, 'Value', after.f, 'InputA');
writeFileSync(out, k.save(null, 'EA3.2 cross-grid probe'));
