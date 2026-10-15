// EA3.2 gate test chip (brs-js 4.0.0, Latest format). Fires once ~3 s after
// load: Stopwatch -> EdgeDetectorExec -> GetEnvironmentProperty x2 ->
// PrintToConsole x2 (server log "[Wire Graph] ea32 ..."). Read-only: changes nothing.
// node ea32test/gen.mjs <brs4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
const lib = await import(new URL(`file:///${process.argv[2].replace(/\\/g, '/')}`).href);
const { writeBrzLegacy, brdb } = lib;
const C = brdb.COMPONENTS;
const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'renderman', display_name: 'renderman' };

const gates = [
  ['sw', C.Stopwatch, { Limit: 3, Time: 0, bRunning: true }],
  ['edge', C.Expr_EdgeDetectorExec, {}],
  ['water', C.Exec_GetEnvironmentProperty, { Environment: 'water', PropertyName: 'waterHeight' }],
  ['tod', C.Exec_GetEnvironmentProperty, { Environment: 'sky', PropertyName: 'timeOfDay' }],
  ['up', C.Expr_ServerUptime, {}],
  ['vt', C.Expr_GetValueType, {}],
  ['fmt', C.Expr_String_FormatText, { FormatString: 'ea32 fmt A={A} B={B} C={C} D={D} 0={0}' }],
  ['p1', C.Exec_PrintToConsole, { Text: '' }],
  ['p2', C.Exec_PrintToConsole, { Text: '' }],
];
const idx = Object.fromEntries(gates.map((g, i) => [g[0], i]));
const assets = [...new Set(gates.map(g => g[1].BRICK))];
const save = {
  brick_assets: assets,
  brick_owners: [OWNER],
  bricks: gates.map(([, c, data], i) => ({
    asset_name_index: assets.indexOf(c.BRICK),
    position: [(i % 5) * 40, Math.floor(i / 5) * 40, 2],
    color: [200, 200, 200],
    owner_index: 1,
    components: [{ type: c.NAME, data }],
  })),
  wires: [],
};
const wire = (a, ap, b, bp) => {
  const [ga, gb] = [gates[idx[a]], gates[idx[b]]];
  if (!ga[1].PORTS[ap] || !gb[1].PORTS[bp]) throw Error(`bad port ${a}.${ap} -> ${b}.${bp}`);
  save.wires.push({
    source: { brick_index: idx[a], component_type: ga[1].NAME, port: ga[1].PORTS[ap] },
    target: { brick_index: idx[b], component_type: gb[1].NAME, port: gb[1].PORTS[bp] },
  });
};
wire('sw', 'Expired', 'edge', 'Input');
wire('edge', 'OnRisingEdge', 'water', 'Exec');
wire('water', 'ExecOut', 'tod', 'Exec');
wire('tod', 'ExecOut', 'p1', 'Exec');
wire('p1', 'ExecOut', 'p2', 'Exec');
wire('water', 'Value', 'p1', 'Text');      // variant -> str port, raw
wire('water', 'Value', 'fmt', 'InputA');
wire('tod', 'Value', 'fmt', 'InputB');
wire('up', 'Uptime', 'fmt', 'InputC');
wire('water', 'Value', 'vt', 'Input');
wire('vt', 'Type', 'fmt', 'InputD');
wire('fmt', 'Output', 'p2', 'Text');

const bytes = writeBrzLegacy(save, { bundle: { description: 'EA3.2 gate test' } });
writeFileSync(process.argv[3], bytes);
console.log(`${process.argv[3]}: ${bytes.length} bytes, ${save.bricks.length} gates, ${save.wires.length} wires`);
