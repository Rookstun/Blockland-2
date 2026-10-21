// Weapon shop fit-out check (2026-10-21): builds lone armories / gunsmiths through town.mjs `single`
// for many seeds and all four facings; fails on any overlap, prints stand counts and their spots.
//   node mapgen/wshoptest.mjs [N seeds] [--dump seed kind] (dump = bricks + stands JSON for isoview/elev)
import { build } from './town.mjs';
import { makeBuilder } from './builder.mjs';
import { orientFor } from './orient.mjs';

const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const WARES = {
  armory: ['steel', 'black'].flatMap(t => [`${t}_dagger`, t, `${t}_longsword`].map(tier => ({ tier }))),
  gunsmith: ['derringer', 'revolver', 'huntingshotgun', 'leveraction', 'boltaction', 'magnum'].map(g => ({ tier: g, prefab: 'gun_' + g })),
};
const one = (kind, seed, facing) => {
  const b = makeBuilder();
  const st = build({ put: (br, x, y, z) => b.add({ ...br, position: [x, y, z] }, br.asset ?? 'box'), free: (x0, y0, z0, x1, y1, z1) => b.free([x0, y0, z0], [x1, y1, z1]),
    orientFor, rnd: hash, plan: null, single: { type: kind, seed, facing, wares: WARES[kind] } });
  return { b, st };
};
const dump = process.argv.indexOf('--dump');
if (dump > 0) {
  const { b, st } = one(process.argv[dump + 2] ?? 'armory', +process.argv[dump + 1], [0, -1]);
  console.log(JSON.stringify({ bricks: b.bricks, stands: st.houseShops }));
} else {
  const n = +(process.argv[2] ?? 20);
  let bad = 0;
  for (const kind of ['armory', 'gunsmith']) for (let seed = 1; seed <= n; seed++) for (const facing of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
    const { b, st } = one(kind, seed * 977, facing);
    const sh = st.houseShops ?? [];
    const short = Object.keys(st.counts ?? st).filter(k => /short/.test(k));
    const off = b.bricks.filter(q => q.size[0] && !q.gameSize && (/^PB_DefaultMicro/.test(q.asset ?? '') ? q.size.some(v => !Number.isInteger(v)) : q.size[0] % 5 || q.size[1] % 5 || q.size[2] % 2));
    if (off.length) b.dropped.push('off grid ' + JSON.stringify(off[0]));
    if (b.dropped.length || sh.length < WARES[kind].length) { bad++; console.log(kind, seed, facing.join(','), 'dropped', b.dropped.length, b.dropped[0] ?? '', 'stands', sh.length); }
  }
  console.log(bad ? `${bad} bad` : 'all clean');
}
