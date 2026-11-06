// node --test blockyard/wgen.test.mjs: options + zero-error compile
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, W, H, STRIP, CW, CS, TUNE } from './wgen.mjs';
const here = dirname(fileURLToPath(import.meta.url));
test('grid fits the screen, whole strips, tune non-empty', () => {
  assert.equal(CW * CS, W);
  assert.equal(H % STRIP, 0);
  assert.ok(TUNE.length > 8);
  assert.ok(!/undefined|NaN/.test(generate().src));
});
test('compiles with zero wirescript errors', async () => {
  const sdk = join(here, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  const ds = JSON.parse(diag(generate().src, 'blockyard', '{}') || '[]').filter(d => /error/i.test(d.severity));
  assert.deepEqual(ds.map(d => `${d.code} line ${d.startLine}: ${d.message}`), []);
});
