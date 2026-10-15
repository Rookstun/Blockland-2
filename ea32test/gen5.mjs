// EA3.2 framebuffer test: 4 pixel bricks whose refs sit in an ArrayVar; a
// For Loop recolours them with Set Brick Property and reads the colour back
// (Get Brick Property -> log "ea32 fb ..."). Two passes: the first build
// finds each pixel's chunk/index, the second embeds those refs.
// node ea32test/gen5.mjs <brs4 dist.mjs> <out.brz>
import { writeFileSync } from 'node:fs';
import { mk, brickRefs } from './lib.mjs';
const [dist, out] = process.argv.slice(2);
const PIX = [0, 1, 2, 3].map(i => [i * 10, 0, 5]);

async function build(refs) {
  const k = await mk(dist);
  const { w, C, gate, wire, print, chip, onLoad } = k;
  for (const p of PIX) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [5, 2, 5], position: p, color: [40, 40, 40], owner_index: k.ownerIdx });
  const go = onLoad(3);
  const { shell, grid } = chip(C.Microchip_CountFor, { Count: PIX.length, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
  wire(go, 'OnRisingEdge', shell, 'Exec');
  const entry = gate(C.CallableEntry_CountFor, {}, grid);
  const arr = gate(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: PIX.map(p => ({ $variant: 'BRSavedBrickRef', value: refs?.get(p.join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 } })) } }, grid);
  const get = gate(C.Exec_ArrayVar_Get, {}, grid);
  wire(arr, 'ArrayVarRef', get, 'ArrayVarRef');
  wire(entry, 'Body', get, 'Exec');
  wire(entry, 'Index', get, 'Index');
  const m60 = gate(C.Expr_MathMultiply, { InputB: k.num(60) }, grid);
  wire(entry, 'Index', m60, 'InputA');
  const inv = gate(C.Expr_MathSubtract, { InputA: k.num(255) }, grid);
  wire(m60, 'Output', inv, 'InputB');
  const col = gate(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 128, A: 255 }, grid);
  wire(m60, 'Output', col, 'R');
  wire(inv, 'Output', col, 'G');
  const set = gate(C.Exec_SetBrickProperty, { Property: 1 }, grid);
  wire(get, 'ExecOut', set, 'Exec');
  wire(get, 'Value', set, 'Brick');
  wire(col, 'Output', set, 'Value');
  const rd = gate(C.Exec_GetBrickProperty, { Property: 1 }, grid);
  wire(set, 'ExecOut', rd, 'Exec');
  wire(get, 'Value', rd, 'Brick');
  const pr = print('ea32 fb i={A} oob={B} set={C} read={D}', grid);
  wire(rd, 'ExecOut', pr.p, 'Exec');
  wire(entry, 'Index', pr.f, 'InputA');
  wire(get, 'bOutOfBounds', pr.f, 'InputB');
  wire(col, 'Output', pr.f, 'InputC');
  wire(rd, 'Value', pr.f, 'InputD');
  return k.save(null, 'EA3.2 framebuffer test');
}
const first = await build(null);
const refs = brickRefs((await mk(dist)).WorldReader, first);
const bytes = await build(refs);
writeFileSync(out, bytes);
console.log(out, bytes.length, 'refs', PIX.map(p => JSON.stringify(refs.get(p.join(',')))).join(' '));
