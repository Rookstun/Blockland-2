// LIVE PUPPET (2026-11-03, owner: camera tracker that drives a doll, one entity per joint; doll = owner
// clipboard puppet/doll_owner.brz, faces +x, +y = its right).
// Each body part = its own loose grid (antigravity, collision off) pivoting at its proximal joint, with a
// hidden chip on it: Event_CustomGlobal pup.<i> (x y z pitch yaw roll) -> SetLocationRotation(own grid).
// Omegga feeds it: bridge plugin TCP line -> `br.Chat.Command /pup <digits>` -> ONE hidden dispatcher chip in
// the sky parses 18 digits a part (x y z +500 relative to the anchor, pitch yaw roll +180) and fires the
// 17 events. puppet/track.py (webcam) sends the lines.
// node puppet/gen.mjs [anchorX anchorY anchorZ] -> puppet/puppet.brz + puppet/rig.json
import { readFileSync, writeFileSync } from 'node:fs';
const here = f => new URL(f, import.meta.url);
const lib = await import(here('../tools/brs4/dist.mjs'));
const { World, WorldReader, brdb } = lib;
const C = brdb.COMPONENTS;
const ANCHOR = process.argv.length > 4 ? process.argv.slice(2, 5).map(Number) : [8609, -24595, 0];
const DOLL0 = [8529, -24595, 0]; // owner's doll origin (feet centre, ground)
const DEBUG = !!process.env.PUP_DEBUG; // PUP_DEBUG=1: pupcmd|args and pupgot|x|y|z log lines
const OWNER = { id: 'b0d1e5a1-0000-4b0b-9a11-00000000d011', name: 'Puppet', display_name: 'Puppet' };

// part: owner brick indices, pivot (doll-relative), parent, rest bone direction
const R = [0, 1, 0], L = [0, -1, 0], UP = [0, 0, 1], DN = [0, 0, -1], FW = [1, 0, 0];
const PARTS = [
  ['pelvis', [12], [0, 0, 25], null, UP],
  ['torso', [13], [0, 0, 28], 'pelvis', UP],
  ['chest', [14], [0, 0, 34], 'torso', UP],
  ['neck', [0], [0, 0, 42], 'chest', UP],
  ['head', [11], [0, 0, 44], 'neck', UP],
  ['l_arm', [2], [0, -8, 39], 'chest', L],
  ['l_forearm', [1], [0, -18, 39], 'l_arm', L],
  ['l_hand', [8], [0, -28, 39], 'l_forearm', L],
  ['r_arm', [3], [0, 8, 39], 'chest', R],
  ['r_forearm', [15], [0, 18, 39], 'r_arm', R],
  ['r_hand', [16], [0, 28, 39], 'r_forearm', R],
  ['l_leg', [6], [0, -5, 22], 'pelvis', DN],
  ['l_shin', [4], [0, -5, 12], 'l_leg', DN],
  ['l_foot', [9], [0, -5, 2], 'l_shin', FW],
  ['r_leg', [7], [0, 5, 22], 'pelvis', DN],
  ['r_shin', [5], [0, 5, 12], 'r_leg', DN],
  ['r_foot', [10], [0, 5, 2], 'r_shin', FW],
];
const doll = [...WorldReader.from(readFileSync(here('doll_owner.brz'))).bricks(1)];
if (doll.length !== 17 || new Set(PARTS.flatMap(p => p[1])).size !== 17) throw Error('doll layout changed: ' + doll.length);

const w = new World();
const O = w.addOwner(OWNER);
const num = v => ({ $variant: 'f64', value: v }), str = v => ({ $variant: 'Str', value: v });
const wire = (a, ap, b, bp) => {
  if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
  w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] });
};
// hidden microchip (house rule: invisible, collision off) + its inner grid; returns a gate placer for it
const chip = (position, parent, ext) => {
  const brick = w.addBrick({ asset: 'B_1x1_Microchip', position, owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] }, parent);
  const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 },
    data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: ext[0], Y: ext[1], Z: 2 } } });
  w.registerMicrochipLink(brick, grid);
  let i = 0;
  return (c, data = {}, extra = {}) => {
    const h = w.addBrick({ asset: c.BRICK, position: [(i % 16) * 24 - 180, Math.floor(i / 16) * 24 - 200, 2], color: [200, 200, 200], owner_index: O, components: [{ type: c.NAME, data }], ...extra }, grid);
    i++;
    return { h, c };
  };
};
const print = (g, fmt, ins, exec) => {
  const f = g(C.Expr_String_FormatText, { FormatString: fmt }), pr = g(C.Exec_PrintToConsole, { Text: '' });
  ins.forEach(([a, ap], k) => wire(a, ap, f, 'Input' + 'ABCDEFG'[k]));
  wire(f, 'Output', pr, 'Text'); wire(exec[0], exec[1], pr, 'Exec');
};
const EV_SIZE = { size: [10, 5, 2] };
const DATA = (p, n) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(k => [`${p}${k}`, num(0)]));
const OFF = { X: 0, Y: 0, Z: 0 };
const NOCOLL = { player: false, weapon: false, interaction: false, tool: false, physics: false };

// ---- parts ----
const PIV = Object.fromEntries(PARTS.map(p => [p[0], p[2]]));
PARTS.forEach(([name, idx, piv], i) => {
  const G = w.addBrickGrid({ location: { X: piv[0], Y: piv[1], Z: piv[2] }, frozen: true, owner_index: O, // frozen: unfrozen grids got flung into the sky by physics between teleports
    data: { BouyancyScale: 0.2, MassScale: 0.1, bEnableGravity: false, bUseNewMassCalculation: true, bReceivesDecals: true, EntityTag: `pup.${name}` } });
  for (const k of idx) {
    const b = doll[k];
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size: b.size, direction: b.direction, rotation: b.rotation, color: b.color, owner_index: O, collision: NOCOLL,
      position: b.position.map((v, a) => v - DOLL0[a] - piv[a]) }, G);
  }
  const g = chip([-10, 0, 0], G, [220, 220]);
  const ev = g(C.Event_CustomGlobal, { EventName: `pup.${i}`, bIsObjectEvent: false, ...DATA('DataOut') }, EV_SIZE);
  const rg = g(C.ReadBrickGrid);
  const set = g(C.Exec_Entity_SetLocationRotation, { Vector: OFF, Rotation: { Pitch: 0, Yaw: 0, Roll: 0 } });
  wire(ev, 'ExecOut', set, 'Exec'); wire(rg, 'BrickGrid', set, 'Entity');
  ['Vector_X', 'Vector_Y', 'Vector_Z', 'Rotation_Pitch', 'Rotation_Yaw', 'Rotation_Roll'].forEach((port, k) => wire(ev, `DataOut${k + 1}`, set, port));
  if (DEBUG && i === 0) print(g, `pupgot|{A}|{B}|{C}`, [[ev, 'DataOut1'], [ev, 'DataOut2'], [ev, 'DataOut3']], [set, 'ExecOut']);
});

// ---- dispatcher: /pup <18 digits a part> -> pup.<i> events with world coords (sky over the anchor, main grid) ----
const D = chip([0, 0, 4000], undefined, [220, 220]);
const cmd = D(C.Event_ChatCommand, { CommandName: 'pup', HelpText: 'server only: puppet frame' });
let prev = [cmd, 'ExecOut'];
PARTS.forEach((_, i) => {
  const send = D(C.Exec_SendCustomEventGlobal, { EventName: `pup.${i}`, ...DATA('DataIn') }, EV_SIZE);
  for (let k = 0; k < 6; k++) {
    const s = D(C.Expr_String_Substring, { Start: i * 18 + k * 3, Length: 3 });
    wire(cmd, 'Arguments', s, 'Input');
    const p = D(C.Expr_String_ParseInt);
    wire(s, 'Output', p, 'Input');
    // x y z: +500 relative to the anchor -> world; angles: +180 (the game clamps rotator values over 180)
    const a = D(C.Expr_MathAdd, { InputA: num(0), InputB: num(k < 3 ? ANCHOR[k] - 500 : -180) });
    wire(p, 'Value', a, 'InputA');
    wire(a, 'Output', send, `DataIn${k + 1}`);
  }
  wire(prev[0], prev[1], send, 'ExecIn');
  prev = [send, 'ExecOut'];
});

if (DEBUG) print(D, 'pupcmd|{A}', [[cmd, 'Arguments']], [cmd, 'ExecOut']);

w.makePrefab({});
writeFileSync(here('puppet.brz'), w.toBrz({ bundle: { description: 'live puppet' } }));
writeFileSync(here('rig.json'), JSON.stringify({ anchor: ANCHOR, parts: PARTS.map(([name, , pivot, parent, dir]) => ({ name, pivot, parent, dir })) }, null, 1));
console.log('puppet.brz', PARTS.length, 'parts, anchor', ANCHOR.join(','));
