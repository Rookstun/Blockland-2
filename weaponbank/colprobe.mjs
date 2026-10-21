// what does the compiler write for a color[] array var / a color Var? (to hand-build one)
import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const sdk = 'C:/Users/pooper/Documents/claudeBS/brickadia/tools/wspkg';
const wasm = await import(pathToFileURL(sdk + '/wasm.js').href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(sdk + '/wasm_bg.wasm') });
const compile = wasm.wirescript_compile ?? wasm.default?.wirescript_compile, diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
const src = `var cols: color[] = []
var one: color = ColorSRGB(10, 20, 30, 255)
on Clock(1.0) {
  cols.push(ColorSRGB(1, 2, 3, 255))
  PrintToConsole("\${one}")
}`;
console.log(diag(src, 'c', '{}'));
const out = new Uint8Array(compile(src, 'c', '{}', '{}'));
const l = await import(pathToFileURL('C:/Users/pooper/Documents/claudeBS/brickadia/tools/brs4/dist.mjs').href);
const r = l.WorldReader.from(out);
for (const g of r.gridIds()) for (const ci of r.brickChunkIndex(g)) { let cs = []; try { cs = r.componentChunk(g, ci.index).components; } catch {} for (const c of cs) if (/Var/.test(c.typeName)) console.log(g, c.typeName, JSON.stringify(c.data)); }
