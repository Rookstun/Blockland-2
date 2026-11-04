// node --test omegga-media/test  — /stream tv model checks (2026-11-03: slim cabinet, lane chips 3x2)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const libUrl = fs.existsSync(new URL('../lib/brs4.mjs', import.meta.url)) ? new URL('../lib/brs4.mjs', import.meta.url) : new URL('../../tools/brs4/dist.mjs', import.meta.url);
const lib = await import(libUrl);
const tg = await import(new URL('../tgrid.mjs', import.meta.url));
const owner = { id: '7e1e0715-0000-4b0b-9a11-000000000000', name: 'T', display_name: 'T' };
const CHIP_HALF = [5, 5, 6]; // B_1x1_Microchip reads back size 0: assume a full 1x1 brick

// the TV's loose grid (file grid 2), positions back to file coords (loose grids read 1024 off)
function tvBricks(cfg) {
  const L = tg.tvLayout(cfg);
  const r = lib.WorldReader.from(tg.buildTv(lib, L, { event: 'og.tv.t', owner, id: 't' }));
  const bricks = [...r.bricks(2)].map(b => ({ ...b, pos: b.position.map(v => v + 1024), half: b.size[0] ? b.size : CHIP_HALF, chip: !b.size[0] }));
  return { L, bricks };
}
const overlap = (a, b) => [0, 1, 2].every(i => Math.abs(a.pos[i] - b.pos[i]) < a.half[i] + b.half[i]);

for (const cfg of [{ tw: 16, th: 9, k: 10, cell: 0.6, lanes: 3 }, { tw: 16, th: 9, k: 10, cell: 0.4, lanes: 6 }, { tw: 16, th: 9, k: 10, cell: 0.6, lanes: 1 }]) {
  const name = `cell ${cfg.cell} lanes ${cfg.lanes}`;
  const { L, bricks } = tvBricks(cfg);
  const solid = bricks.filter(b => !b.chip), chips = bricks.filter(b => b.chip), tiles = solid.filter(b => b.half[1] === 2 && b.half[0] === L.tile / 2 && Math.abs(b.pos[1]) < 1e-9);

  test(`${name}: every tile, one chip per lane`, () => {
    assert.equal(tiles.length, L.tw * L.th);
    assert.equal(chips.length, cfg.lanes);
    assert.ok(solid.length - tiles.length <= 14, `cabinet bricks ${solid.length - tiles.length}`);
  });

  test(`${name}: cabinet hugs the screen (not stretched)`, () => {
    const w = Math.max(...solid.map(b => Math.abs(b.pos[0]) + b.half[0]));
    assert.ok(w <= L.width / 2 + 4, `half width ${w} vs screen ${L.width / 2}`);
  });

  test(`${name}: no overlapping bricks`, () => {
    for (let i = 0; i < bricks.length; i++) for (let j = i + 1; j < bricks.length; j++)
      assert.ok(!overlap(bricks[i], bricks[j]), `overlap ${JSON.stringify(bricks[i].pos)} ${JSON.stringify(bricks[j].pos)}`);
  });

  test(`${name}: chips hidden inside the back hump`, () => {
    for (const c of chips) {
      assert.equal(c.visibility, false);
      assert.equal(c.collision.player, false);
      assert.ok(c.pos[1] - CHIP_HALF[1] > 2, 'behind the screen');
    }
  });

  test(`${name}: stands on its foot (centre of mass over the foot, floor at 0)`, () => {
    const floor = Math.min(...solid.map(b => b.pos[2] - b.half[2]));
    assert.equal(floor, 0);
    const feet = solid.filter(b => b.pos[2] - b.half[2] === 0);
    const vol = b => b.half[0] * b.half[1] * b.half[2];
    const m = solid.reduce((s, b) => s + vol(b), 0);
    const com = [0, 1].map(i => solid.reduce((s, b) => s + vol(b) * b.pos[i], 0) / m);
    for (const i of [0, 1]) assert.ok(feet.some(f => Math.abs(com[i] - f.pos[i]) < f.half[i] - 2), `com axis ${i} ${com[i]} off the foot`);
  });
}

test('blank cartridge and packets still fit the 3-lane 10x10 TV', () => {
  const L = tg.tvLayout({ tw: 16, th: 9, k: 10, cell: 0.6, lanes: 3 });
  assert.ok(tg.blankCartridge(lib, L, { event: 'og.tv.t', owner }).length > 0);
  assert.ok(tg.perPacket(L) * tg.entryLen(L) < 32768);
});

test('6-lane TV played on 3 lanes: packets only on lanes 0-2, every tile still sent', () => {
  const L = tg.tvLayout({ tw: 16, th: 9, k: 10, cell: 0.6, lanes: 6 });
  const frames = [0, 1].map(f => Buffer.from(Array.from({ length: L.cols * L.rows * 3 }, (_, i) => (i * 7 + f * 101) % 256)));
  const enc = tg.encodeTiles(frames, L, tg.newState(L), { fps: 5, per: tg.perPacket(L), perSec: 20, full: [0], lanes: 3 });
  assert.ok(enc.packets.length > 0);
  assert.deepEqual([...new Set(enc.lane)].sort(), [0, 1, 2]);
  assert.ok(tg.buildCartridge(lib, L, enc, { event: 'og.tv.t', fps: 5, dur: 1, owner, inChip: true }).length > 0);
});
