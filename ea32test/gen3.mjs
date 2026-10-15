// EA3.2 function test (brs-js 4.0.0). Function chip f(x, y) = x * y whose
// body also prints x; ~3 s after load it is called twice in a row,
// f(6, 7) and f(12, 0.5), and each result prints. Test owner "EA32 Test"
// (not renderman: an owner over the 10 ms wire budget gets blocked).
// node ea32test/gen3.mjs <brs4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
const lib = await import(new URL(`file:///${process.argv[2].replace(/\\/g, '/')}`).href);
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
const w = new World();
const owner = w.addOwner({ id: 'ea320000-7e57-4c0d-9a11-000000000032', name: 'EA32 Test', display_name: 'EA32 Test' });

let slot = 0;
const gate = (c, data = {}, grid, extra = {}) => {
  const i = slot++;
  const h = w.addBrick({
    asset: c.BRICK, position: [(i % 6) * 40, Math.floor(i / 6) * 40, 2], color: [200, 200, 200],
    owner_index: owner, components: [{ type: c.NAME, data }], ...extra,
  }, grid);
  return { h, c };
};
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] },
            { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
const num = v => ({ $variant: 'f64', value: v });
const print = (fmtStr, grid) => {
  const f = gate(C.Expr_String_FormatText, { FormatString: fmtStr }, grid);
  const p = gate(C.Exec_PrintToConsole, { Text: '' }, grid);
  wire(f, 'Output', p, 'Text');
  return { f, p };
};

// definition chip
const def = gate(C.Microchip_FunctionDefinition);
const grid = w.addBrickGrid({
  type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
  data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } },
});
w.registerMicrochipLink(def.h, grid);
const entry = gate(C.CallableEntry_Function, {}, grid);
const x = gate(C.FunctionInput, { PortLabel: 'x', PortOrder: Number(process.env.XO ?? 0), DefaultValue: num(0), Value: num(0) }, grid, process.env.SWAPPOS ? { position: [200, 80, 2] } : {});
const y = gate(C.FunctionInput, { PortLabel: 'y', PortOrder: Number(process.env.YO ?? 1), DefaultValue: num(0), Value: num(0) }, grid, process.env.SWAPPOS ? { position: [0, 80, 2] } : {});
const out = gate(C.FunctionOutput, { PortLabel: 'xy', PortOrder: 0, DefaultValue: num(0) }, grid);
const mul = gate(C.Expr_MathSubtract, {}, grid);
wire(x, 'Value', mul, 'InputA');
wire(y, 'Value', mul, 'InputB');
wire(mul, 'Output', out, 'Value');
const body = print('ea32 fn body x={A} y={B}', grid);
wire(entry, 'Body', body.p, 'Exec');
wire(x, 'Value', body.f, 'InputA');
wire(y, 'Value', body.f, 'InputB');

// callers
const call = (a, b) => gate(C.FunctionCall, { Input0: num(a), Input1: num(b), InputSources: [1, 1, 0, 0, 0, 0, 0, 0] }, undefined, { size: [5, 5, 2] });
const sw = gate(C.Stopwatch, { Limit: 3, Time: 0, bRunning: true });
const edge = gate(C.Expr_EdgeDetectorExec);
wire(sw, 'Expired', edge, 'Input');
const c1 = call(6, 7), c2 = call(12, 0.5);
wire(def, 'Definition', c1, 'Definition');
wire(def, 'Definition', c2, 'Definition');
const r1 = print('ea32 fn call1 out={A} iters={B} aborted={C}');
const r2 = print('ea32 fn call2 out={A} iters={B} aborted={C}');
wire(edge, 'OnRisingEdge', c1, 'Exec');
wire(c1, 'Completed', r1.p, 'Exec');
wire(r1.p, 'ExecOut', c2, 'Exec');
wire(c2, 'Completed', r2.p, 'Exec');
for (const [c, r] of [[c1, r1], [c2, r2]]) {
  wire(c, 'Output0', r.f, 'InputA');
  wire(c, 'IterationsExecuted', r.f, 'InputB');
  wire(c, 'bAborted', r.f, 'InputC');
}

w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: 'EA3.2 function test' } });
writeFileSync(process.argv[3], bytes);
console.log(`${process.argv[3]}: ${bytes.length} bytes, ${slot} bricks`);
