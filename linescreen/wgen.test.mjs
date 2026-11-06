// node --test linescreen/wgen.test.mjs: span math gives a connected 1-px line; the chip compiles with zero errors
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, spanJS, W, H } from './wgen.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('lines are connected row to row and hit both endpoints', () => {
  for (const [a, b] of [[[0, 0], [63, 95]], [[63, 0], [0, 95]], [[10, 50], [50, 50]], [[5, 5], [5, 90]], [[0, 0], [63, 3]], [[30, 40], [30, 40]]]) {
    let prev = null;
    for (let r = 0; r < H; r++) {
      const s = spanJS(a, b, r);
      if (!s) continue;
      assert.ok(s[0] < s[1] && s[0] >= 0 && s[1] <= W, `row ${r} span ${s}`);
      if (prev) assert.ok(s[0] <= prev[1] && prev[0] <= s[1], `gap between rows at ${r}: ${prev} / ${s}`);
      prev = s;
    }
    const sa = spanJS(a, b, a[1]), sb = spanJS(a, b, b[1]);
    assert.ok(sa[0] <= a[0] && a[0] < sa[1], `start pixel ${a}`);
    assert.ok(sb[0] <= b[0] && b[0] < sb[1], `end pixel ${b}`);
  }
});

test('compiles with zero wirescript errors', async () => {
  const sdk = join(here, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  const ds = JSON.parse(diag(generate().src, 'linescreen', '{}') || '[]').filter(d => /error/i.test(d.severity));
  assert.deepEqual(ds.map(d => `${d.code} line ${d.startLine}: ${d.message}`), []);
});
