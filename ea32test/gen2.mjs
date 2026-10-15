// EA3.2 loop test (brs-js 4.0.0 World builder). ~3 s after load fires two
// For Loop chips: A = Count 5 / First 10 / Step 3 in one tick, B = Count 3
// with bRunAcrossTicks; each iteration and each Completed prints to the
// server log ("[Wire Graph] ea32 ..."). Read-only.
// node ea32test/gen2.mjs <brs4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
const lib = await import(new URL(`file:///${process.argv[2].replace(/\\/g, '/')}`).href);
const { World, brdb } = lib;
const C = brdb.COMPONENTS;
const w = new World();
const owner = w.addOwner
  ? w.addOwner(process.env.OWNER === 'renderman' ? { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'renderman', display_name: 'renderman' }
    : { id: 'ea320000-7e57-4c0d-9a11-000000000032', name: 'EA32 Test', display_name: 'EA32 Test' })
  : undefined;

let slot = 0;
const gate = (c, data = {}, grid) => {
  const i = slot++;
  const h = w.addBrick({
    asset: c.BRICK, position: [(i % 6) * 40, Math.floor(i / 6) * 40, 2], color: [200, 200, 200],
    ...(owner !== undefined ? { owner_index: owner } : {}),
    components: [{ type: c.NAME, data }],
  }, grid);
  return { h, c };
};
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] },
            { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
const print = (fmtStr, grid) => {
  const f = gate(C.Expr_String_FormatText, { FormatString: fmtStr }, grid);
  const p = gate(C.Exec_PrintToConsole, { Text: '' }, grid);
  wire(f, 'Output', p, 'Text');
  return { f, p };
};
// a loop microchip: shell on the main grid + inner grid with the entry gate
const loop = (data, label, body = true) => {
  const shell = gate(C.Microchip_CountFor, data);
  const grid = w.addBrickGrid({
    type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 14, Y: 14, Z: 2 } },
  });
  w.registerMicrochipLink(shell.h, grid);
  const entry = gate(C.CallableEntry_CountFor, {}, grid);
  if (body) {
    const up = gate(C.Expr_ServerUptime, {}, grid);
    const b = print(`ea32 ${label} i={A} t={B}`, grid);
    wire(entry, 'Body', b.p, 'Exec');
    wire(entry, 'Index', b.f, 'InputA');
    wire(up, 'Uptime', b.f, 'InputB');
  }
  const done = print(`ea32 ${label} done n={A} aborted={B} t={C}`);
  wire(gate(C.Expr_ServerUptime), 'Uptime', done.f, 'InputC');
  wire(shell, 'Completed', done.p, 'Exec');
  wire(shell, 'IterationsExecuted', done.f, 'InputA');
  wire(shell, 'bAborted', done.f, 'InputB');
  return shell;
};

const sw = gate(C.Stopwatch, { Limit: 3, Time: 0, bRunning: true });
const edge = gate(C.Expr_EdgeDetectorExec);
wire(sw, 'Expired', edge, 'Input');
const BIG = process.env.BIG ? +process.env.BIG : 0;
const ONLY = process.env.ONLY || 'AB';
const A = !ONLY.includes('A') ? null : BIG ? loop({ Count: BIG, FirstIndex: 0, Step: 1, bRunAcrossTicks: false }, 'bigA', false)
  : loop({ Count: 5, FirstIndex: 10, Step: 3, bRunAcrossTicks: false }, 'loopA');
const B = !ONLY.includes('B') ? null : BIG ? loop({ Count: BIG, FirstIndex: 0, Step: 1, bRunAcrossTicks: true }, 'bigB', false)
  : loop({ Count: 3, FirstIndex: 0, Step: 1, bRunAcrossTicks: true }, 'loopB');
if (A) wire(edge, 'OnRisingEdge', A, 'Exec');
if (B) wire(edge, 'OnRisingEdge', B, 'Exec');

w.makePrefab({});
const bytes = w.toBrz({ bundle: { description: 'EA3.2 loop test' } });
writeFileSync(process.argv[3], bytes);
console.log(`${process.argv[3]}: ${bytes.length} bytes, ${slot} bricks`);
