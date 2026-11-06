// node --test pong/  -> unit tests for the Night Pong generator (pong/wgen.mjs): build options, the precomputed bumper
// spans, and a zero-error wirescript compile for the live 240x160 build and the other resolutions it supports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, W, H, STRIP } from './wgen.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const consts = (src, name) => JSON.parse(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))[1]);

test('live build: 240x160, 20-row strips, frame tick, no clock gate', () => {
  const g = generate();
  assert.equal(g.W, 240);
  assert.equal(g.H, 160);
  assert.equal(g.H % STRIP, 0);
  assert.equal(g.noClock, true);
  assert.match(g.src, /on ServerUptime\(\) \{/);
  assert.ok(!/undefined|NaN/.test(g.src));
});

test('bumper spans: plain, win text and game over text all inside the screen, text cut out of the plain disc', () => {
  const src = generate().src;
  const area = k => { const s = consts(src, `CS${k}`), e = consts(src, `CE${k}`); return s.reduce((n, x, i) => { assert.ok(x >= 0 && e[i] <= W && x < e[i]); return n + e[i] - x; }, 0); };
  const a0 = area(0), a1 = area(1), a2 = area(2);
  assert.ok(Math.abs(a0 - Math.PI * 32 * 32) < 200, `disc area ${a0}`);
  assert.ok(a1 < a0 && a2 < a0, 'messages remove pixels');
  for (const k of [0, 1, 2]) assert.equal(consts(src, `CI${k}`).length, H + 1, 'one index per row');
});

test('rows are padded to the full width (the TextDisplay centres short lines)', () => {
  assert.match(generate().src, /rows\[r\] = s \.\. SP\.Substring\(0, 240\.0 - cur\)/);
});

test('other resolutions still generate (W/H shadow the defaults)', () => {
  const g = generate({ cell: 0.1, W: 300, H: 200 });
  assert.match(g.src, /const SP = " {300}"/);
  assert.ok(!/undefined|NaN/.test(g.src));
});

test('compiles with zero wirescript errors (release + debug + 300x200)', async () => {
  const sdk = join(here, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  for (const opts of [{}, { debug: true }, { cell: 0.1, W: 300, H: 200 }]) {
    const ds = JSON.parse(diag(generate(opts).src, 'pong', '{}') || '[]').filter(d => /error/i.test(d.severity));
    assert.deepEqual(ds.map(d => `${d.code} line ${d.startLine}: ${d.message}`), [], JSON.stringify(opts));
  }
});
