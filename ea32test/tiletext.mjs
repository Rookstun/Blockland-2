// Probe (2026-10-18, owner idea: /ogrid as 16:9 micro-brick tiles of 4x4 text driven by loops):
// can a For loop set a TextDisplay's Text through a brick ref?
// ArrayVar of brick refs -> ArrayVar_Get -> Get Component (ComponentType = external asset
// {BrickComponentTypeBase, Component_TextDisplay}, as the game saved it in the owner's build)
// -> Set Component Property 'Text'. Logs tt|step|index at each stage.
// node ea32test/tiletext.mjs <abs tools/brs4/dist.mjs> out.brz
import { writeFileSync } from 'node:fs';
import { mk, brickRefs } from './lib.mjs';

const [dist, out] = process.argv.slice(2);
const N = 4;
const tilePos = i => [i * 60 - 90, 0, 60];
const EXT = [{ type: 'BrickFontDescriptor', name: 'MonaspaceKrypton' }, { type: 'BrickComponentTypeBase', name: 'Component_TextDisplay' }];
const TD = 1; // index of Component_TextDisplay in EXT

async function build(refs) {
  const { w, C, gate, wire, print, chip, onLoad, num, ownerIdx } = await mk(dist, { owner: { id: 'ea320000-7e57-4c0d-9a11-0000007e7e70', name: 'Tile Text', display_name: 'Tile Text' } });
  const TEXT = { Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 6, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
    Color: { R: 255, G: 255, B: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 0, OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0,
    ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true,
    Typeface: 0, Billboard: 0, Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: 'x' };
  for (let i = 0; i < N; i++) w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [24, 2, 24], position: tilePos(i), color: [10, 10, 12], owner_index: ownerIdx, components: [{ type: C.TextDisplay.NAME, data: { ...TEXT } }] });

  const start = onLoad(3);
  const { shell, grid } = chip(C.Microchip_CountFor, { Count: N, FirstIndex: 0, Step: 1, bRunAcrossTicks: false });
  wire(start, 'OnRisingEdge', shell, 'Exec');
  const ig = (c, d = {}) => gate(c, d, grid);
  const entry = ig(C.CallableEntry_CountFor);
  const arr = ig(C.ArrayVar, { Value: { $elementType: 'WireValue', $array: Array.from({ length: N }, (_, i) => ({ $variant: 'BRSavedBrickRef',
    value: refs?.get(tilePos(i).join(',')) ?? { GridPersistentIndex: 1, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 0 } })) } });
  const get = ig(C.Exec_ArrayVar_Get); wire(arr, 'ArrayVarRef', get, 'ArrayVarRef'); wire(entry, 'Index', get, 'Index');
  const ref0 = { GridPersistentIndex: 0, ChunkIndex: { X: 0, Y: 0, Z: 0 }, BrickIndexInChunk: 4294967295 };
  const getc = ig(C.Exec_GetComponent, { Brick: ref0, ComponentType: TD });
  wire(get, 'Value', getc, 'Brick');
  const set = ig(C.Exec_SetComponentProperty, { Value: { $variant: 'Str', value: '' }, Component: { Brick: ref0, ComponentTypeIndex: 0 }, PropertyName: 'Text', ComponentType: TD });
  wire(getc, 'Component', set, 'Component');
  const f = ig(C.Expr_String_FormatText, { FormatString: '<color="ff4040">TILE</> {A}' }); wire(entry, 'Index', f, 'InputA'); wire(f, 'Output', set, 'Value');
  const p1 = print('tt|get|{A}', grid); wire(entry, 'Index', p1.f, 'InputA');
  const p2 = print('tt|comp|{A}', grid); wire(entry, 'Index', p2.f, 'InputA');
  const p3 = print('tt|set|{A}', grid); wire(entry, 'Index', p3.f, 'InputA');
  wire(entry, 'Body', get, 'Exec'); wire(get, 'ExecOut', p1.p, 'Exec'); wire(p1.p, 'ExecOut', getc, 'Exec');
  wire(getc, 'ExecOut', p2.p, 'Exec'); wire(p2.p, 'ExecOut', set, 'Exec'); wire(set, 'ExecOut', p3.p, 'Exec');
  const done = print('tt|done|{A}'); wire(shell, 'IterationsExecuted', done.f, 'InputA'); wire(shell, 'Completed', done.p, 'Exec');
  w.makePrefab({});
  return w.toBrz({ bundle: { description: 'tile text probe' }, externalAssets: EXT });
}

const first = await build(null);
const refs = brickRefs((await mk(dist)).WorldReader, first);
const bytes = await build(refs);
const missing = Array.from({ length: N }, (_, i) => refs.get(tilePos(i).join(','))).filter(r => !r).length;
if (missing) throw Error(`${missing} tile refs not found`);
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes`);
