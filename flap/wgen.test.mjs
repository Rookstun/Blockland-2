// node --test flap/  -> Soggy Sparrow generator: options, sprite, zero-error wirescript compile (release + debug)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, W, H, STRIP } from './wgen.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('120x80, whole strips, frame tick, flap on ba', () => {
  const g = generate();
  assert.equal(g.W, W);
  assert.equal(g.H % STRIP, 0);
  assert.match(g.src, /on ServerUptime\(\) \{/);
  assert.match(g.src, /let press = ba && lastBa == false/);
  assert.ok(!/undefined|NaN/.test(g.src));
});

test('rows padded to full width', () => {
  assert.match(generate().src, /rows\[r\] = s \.\. SP\.Substring\(0, 120\.0 - cur\)/);
});

test('compiles with zero wirescript errors (release + debug)', async () => {
  const sdk = join(here, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  for (const opts of [{}, { debug: true }]) {
    const ds = JSON.parse(diag(generate(opts).src, 'flap', '{}') || '[]').filter(d => /error/i.test(d.severity));
    assert.deepEqual(ds.map(d => `${d.code} line ${d.startLine}: ${d.message}`), [], JSON.stringify(opts));
  }
});
