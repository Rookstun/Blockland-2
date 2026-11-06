// node --test dvi/  -> unit tests for the Daniel vs ISIS generator (dvi/gen.mjs).
// They check the data the chip is built from (sprites, scenery, story, songs, items, dialogue) and that the generated
// wirescript compiles with zero errors, without writing any .brz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { W, H, STRIP, generate, spriteTables, sceneryTables, SPRITES, AREAS, NODES, TALK, ITEMS, CUTSCENE, EATSCENE, SONGS, THEMES, NOTE, tuneOf, songNotes, COL } from './gen.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CKEYS = Object.keys(COL);

test('screen geometry: strips divide the picture', () => {
  assert.equal(H % STRIP, 0);
  assert.equal(W, 240);
  assert.equal(H, 160);
});

test('every sprite is rectangular and uses only palette colours', () => {
  for (const [name, art] of Object.entries(SPRITES)) {
    const w = art[0].length;
    for (const line of art) {
      assert.equal(line.length, w, `${name}: ragged row "${line}"`);
      for (const ch of line) assert.ok(ch === '.' || CKEYS.includes(ch), `${name}: unknown colour '${ch}'`);
    }
  }
});

test('sprite span tables: one index entry per row, spans inside the sprite and not overlapping', () => {
  const T = spriteTables();
  const rows = Object.values(SPRITES).flat();
  assert.equal(T.SI.length - 1, rows.length);
  rows.forEach((line, r) => {
    let last = -1;
    for (let t = T.SI[r]; t < T.SI[r + 1]; t++) {
      assert.ok(T.SS[t] >= 0 && T.SE[t] <= line.length && T.SS[t] < T.SE[t]);
      assert.ok(T.SS[t] >= last, 'spans in order');
      last = T.SE[t];
      assert.equal(line[T.SS[t]], CKEYS[T.SC[t]], 'span colour matches the art');
    }
  });
});

test('scenery tables: every slot covers all rows, spans in range, sorted, no overlap', () => {
  const S = sceneryTables();
  const slots = AREAS.length + 2; // places + Turkey rubble + the world map
  assert.equal(S.idx.length - 1, slots * H);
  for (let row = 0; row < slots * H; row++) {
    let last = 0;
    for (let t = S.idx[row]; t < S.idx[row + 1]; t++) {
      assert.ok(S.S[t] >= last && S.S[t] < S.E[t] && S.E[t] <= W, `slot row ${row}: bad span ${S.S[t]}..${S.E[t]}`);
      assert.ok(S.C[t] >= 0, 'known colour');
      last = S.E[t];
    }
  }
  // places keep scenery to the band above the ground (objects walk below it and never overlap it)
  for (let a = 0; a < AREAS.length + 1; a++) for (let r = 34; r < H; r++) assert.equal(S.idx[a * H + r + 1] - S.idx[a * H + r], 0, `place ${a} row ${r} has scenery`);
});

test('story: places in order on the map, 3 bosses, Bronx last', () => {
  let next = 0;
  for (const [name, x, y, first, last] of NODES) {
    assert.equal(first, next, `${name} starts where the previous place ended`);
    assert.ok(last >= first && x >= 0 && x < W && y >= 2 && y < H);
    next = last + 1;
  }
  assert.equal(next, AREAS.length, 'every area belongs to a place');
  assert.deepEqual(AREAS.map(a => a.boss).filter(b => b >= 0), [0, 1, 2]);
  assert.equal(NODES.at(-1)[0], 'THE BRONX');
  assert.ok(AREAS.some(a => a.name.includes('PLANET FITNESS')) && AREAS.some(a => a.name.includes("CHILI'S")));
});

test('objects stay on the screen and below the scenery band', () => {
  for (const a of AREAS) {
    for (const [x, y] of a.goons) assert.ok(x >= 0 && x + 17 <= W && y >= 34 && y + 20 <= H - 4, `${a.name} goon ${x},${y}`);
    for (const [x, y] of a.items) assert.ok(x >= 0 && x + 8 <= W && y >= 34 && y + 7 <= H - 4, `${a.name} item ${x},${y}`);
    for (const [x, y] of a.npcs) assert.ok(x >= 0 && x + 12 <= W && y >= 34 && y + 16 <= H - 4, `${a.name} guy ${x},${y}`);
  }
});

test('every town and city has its own song: A/B/C sections, a bassline, nothing copied', () => {
  for (const a of AREAS) assert.ok(SONGS[a.name], `${a.name} has no song`);
  const seen = new Set();
  for (const [name, song] of Object.entries({ ...SONGS, ...THEMES })) {
    const { mel, bass } = songNotes(song);
    assert.equal(mel.length, bass.length, `${name}: bass follows the melody step for step`);
    assert.ok(bass.some(n => n > 0) && bass.every(n => n === 0 || n < 1.5), `${name}: a bassline below the melody`);
    assert.ok(new Set(song.form).size >= 2, `${name}: more than one section`);
    if (SONGS[name]) assert.ok(mel.length >= 96 && new Set(song.form).size >= 3, `${name}: long and varied (A/B/C)`);
    for (const sec of new Set(song.form)) {
      const t = song[sec].replace(/ /g, '');
      assert.ok(!seen.has(t), `${name} ${sec} repeats another section`);
      seen.add(t);
    }
  }
  assert.throws(() => tuneOf('CZ'), /bad note/);
  assert.throws(() => songNotes({ form: 'A', bar: 4, A: 'CCCC', prog: { A: 'CC' } }), /bars/);
  assert.equal(NOTE.c, 2 * NOTE.C);
});

test('items: a list with ketchup in it, counts fit the 2-digit save packing', () => {
  assert.deepEqual(ITEMS.map(i => i[0]), ['PIEROGI', 'CIGARETTE', 'KETCHUP']);
  const pack = inv => inv[0] + inv[1] * 100 + inv[2] * 10000;
  const unpack = t => [t % 100, Math.floor(t / 100) % 100, Math.floor(t / 10000) % 100];
  for (const inv of [[0, 0, 0], [1, 0, 1], [99, 99, 99], [12, 3, 0]]) assert.deepEqual(unpack(pack(inv)), inv);
  const k = AREAS.flatMap(a => a.items.filter(i => i[2] === 2));
  assert.equal(k.length, 1, 'exactly one ketchup in the world');
});

test('dialogue and scenes fit the message line and need no escaping', () => {
  for (const line of [...Object.values(TALK).flat(), ...CUTSCENE, ...EATSCENE]) {
    assert.ok(!line.includes('"') && !line.includes('\\'), `needs escaping: ${line}`);
    assert.ok(line.length <= 110, `too long for the msg line: ${line}`);
  }
  assert.equal(CUTSCENE[0], 'I LOVE LIVING IN TURKEY.');
  assert.ok(EATSCENE.some(l => l.includes('BREATH')), 'the scream has its pause for breath');
});

test('generated chip source: no undefined/NaN, every table present', () => {
  for (const debug of [false, true]) {
    const g = generate({ debug });
    assert.ok(!/undefined|NaN/.test(g.src), 'no undefined/NaN in the source');
    for (const name of ['MUSA', 'BASSA', 'MI', 'BOSSMUS', 'BOSSBASS', 'MAPBASS', 'INAME', 'DLG', 'CUT', 'EAT', 'AI', 'SI']) assert.match(g.src, new RegExp(`const ${name} = \\[`));
    assert.equal(g.sitterPin, true);
    assert.deepEqual(g.synths, ['Square', 'Triangle', 'Triangle'], 'effects, melody, bass');
    assert.equal(g.src.includes('on ChatCommand("dvkey"'), debug, 'debug commands only in debug builds');
  }
});

test('generated chip compiles with zero wirescript errors', async () => {
  const sdk = join(here, '..', 'tools', 'wspkg');
  const wasm = await import(pathToFileURL(join(sdk, 'wasm.js')).href);
  if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(join(sdk, 'wasm_bg.wasm')) });
  const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
  for (const debug of [false, true]) {
    const ds = JSON.parse(diag(generate({ debug }).src, 'dvi', '{}') || '[]').filter(d => /error/i.test(d.severity));
    assert.deepEqual(ds.map(d => `${d.code} line ${d.startLine}: ${d.message}`), [], `debug=${debug}`);
  }
});

test('GBA polish: sprites are auto-shaded, skies are gradients, characters have shadows', async () => {
  const { gapRows, variant, mixHex } = await import('./gen.mjs');
  const shadedKeys = new Set(Object.values(SPRITES).flat().join('').split('').filter(c => c.charCodeAt(0) >= 0xC0));
  assert.ok(shadedKeys.size >= 10, `only ${shadedKeys.size} shade colours in the sprites`);
  for (const k of ['shadow', 'bshadow', 'platform']) assert.ok(SPRITES[k], `${k} sprite`);
  const G = gapRows();
  assert.equal(G.length, (AREAS.length + 1) * H, 'a gap colour per row of every place + the map');
  const lum = h => [0, 2, 4].reduce((n, i) => n + parseInt(h.slice(i, i + 2), 16), 0);
  for (let a = 0; a < AREAS.length; a++) assert.ok(lum(G[a * H + 3]) < lum(G[a * H + 33]), `${AREAS[a].name}: sky is darker at the top than at the horizon`);
  assert.equal(variant('b', '+'), variant('b', '+'), 'variants are cached');
  assert.equal(mixHex('000000', 'ffffff', 0.5), '808080');
});

test('lanes: Daniel always fits inside one strip, and every goon, guy, item and the man is reachable from a lane', () => {
  const SKY = 34, lanes = [];
  for (let y = Math.ceil(SKY / STRIP) * STRIP + 2; y <= (H / STRIP - 1) * STRIP + 2; y += STRIP) lanes.push(y);
  for (const y of lanes) assert.equal(Math.floor(y / STRIP), Math.floor((y + 17) / STRIP), `lane ${y} straddles a strip`);
  const reach = (top, bot) => lanes.some(py => py + 16 > top && py < bot);
  for (const a of AREAS) {
    for (const [, y] of a.goons) assert.ok(reach(y + 5, y + 20), `${a.name} goon at ${y}`);
    for (const [, y] of a.npcs) assert.ok(reach(y, y + 16), `${a.name} guy at ${y}`);
    for (const [, y] of a.items) assert.ok(reach(y, y + 4), `${a.name} item at ${y}`);
  }
  assert.ok(reach(70, 86), 'the man in Italy');
});
