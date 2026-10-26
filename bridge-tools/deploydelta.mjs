// deploydelta.mjs DIR WORLD TAG   (server: node ~/deploydelta/deploydelta.mjs ~/xdeploy "site 2026-10-18" pre_thing)
// The one way to ship a mkdelta delta (2026-10-23, owner: "the game can handle 4000 updates per second",
// and a house change must never leave its shop stands / NPCs / pots behind):
//   DIR/delta.json   from mapgen/mkdelta.mjs (clear, add, externalAssets, extras)
//   DIR/old, DIR/new the OLD and NEW map dirs' extras jsons (spawners pots bushes shops gems npcs *.json)
// Steps: save, backup `backup TAG WORLD DATE`, ClearRegions (all in one job), adds (ALL in one op), extras through extrasdiff.py when delta.extras says any changed, then READ THE WORLD BACK per
// 5000-unit tile and repair: clears whose brick is still there, adds that never landed (3 passes), save.
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [DIR, WORLD, TAG] = process.argv.slice(2);
if (!DIR || !WORLD || !TAG) throw new Error('usage: deploydelta.mjs DIR WORLD TAG');
const H = process.env.HOME, SRV = path.join(H, 'omegga-server'), root = path.join(SRV, 'bridge'), W = path.join(SRV, 'data/Saved/Worlds');
const brs = await import(path.join(SRV, 'plugins/bridge/lib/brs.mjs'));
const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const job = async (ops, tag) => {
  const id = Date.now() + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 1200) throw new Error('no result ' + id); await sleep(500); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'delta.json'), 'utf8'));
const clr = c => ({ op: 'cmd', line: `br.World.ClearRegion ${c.join(' ')}`, captureMs: 0 });
const addOp = bricks => [{ op: 'bricks', at: [0, 0, 0], bricks, owner: OWNER, externalAssets: D.externalAssets, captureMs: 3000 }];
const bad = r => (JSON.stringify(r).match(/overlapping|Prefab not found/g) || []).length;

const VERIFY_ONLY = process.env.VERIFY_ONLY === '1'; // re-run just the read-back and repair
if (!VERIFY_ONLY) {
await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save'); await sleep(8000);
const date = new Date().toISOString().slice(0, 10);
fs.copyFileSync(path.join(W, WORLD + '.brdb'), path.join(W, `backup ${TAG} ${WORLD.replace(/ \d{4}-\d\d-\d\d$/, '')} ${date}.brdb`)); log('backup ok');

// (2026-10-25, owner: "DO IT ALL AT ONCE") every clear in one job, every add in ONE bricks op
const CC = +process.env.CLEAR_CHUNK || Infinity, AC = +process.env.ADD_CHUNK || Infinity;
for (let i = 0; i < D.clear.length; i += CC) await job(D.clear.slice(i, i + CC).map(clr), 'clr' + i);
log('cleared', D.clear.length); await sleep(8000);
for (let i = 0; i < D.add.length; i += AC) { const r = await job(addOp(D.add.slice(i, i + AC)), 'add' + i); log('added', Math.min(D.add.length, i + AC), '/', D.add.length, 'warnings', bad(r)); }

if (D.extras && Object.keys(D.extras).length) {
  log('extras', JSON.stringify(D.extras));
  const ex = path.join(root, 'tools/extrasdiff.py');
  const out = execFileSync('python3', [ex, path.join(DIR, 'old'), path.join(DIR, 'new'), path.join(W, WORLD + '.brdb')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  log(out.trim().split('\n').slice(-12).join(' | '));
}

}
// read the world back tile by tile and repair
const T = 5000, tiles = new Map();
const tileOf = (x, y) => Math.floor(x / T) + ',' + Math.floor(y / T);
const at = (m, k) => m.get(k) ?? m.set(k, { clear: [], add: [] }).get(k);
for (const c of D.clear) at(tiles, tileOf(c[0], c[1])).clear.push(c);
for (const b of D.add) at(tiles, tileOf(b.position[0], b.position[1])).add.push(b);
const pk = p => p.map(Math.round).join(',');
const readTile = async (k, n) => {
  const [tx, ty] = k.split(',').map(Number), name = `dd_${TAG}_${n}`;
  await job([{ op: 'cmd', line: `br.Prefab.SaveRegion "${name}" ${(tx + 0.5) * T} ${(ty + 0.5) * T} 3000 ${T / 2 + 100} ${T / 2 + 100} 3000 0`, captureMs: 15000 }], 'sr');
  const f = path.join(SRV, 'data/Saved/Prefabs', name + '.brz'), have = new Set();
  for (let t = 0, last = -1; t < 120; t++) { await sleep(1000); const z = fs.existsSync(f) ? fs.statSync(f).size : -1; if (z > 0 && z === last) break; last = z; } // big tiles take a while to write
  if (!fs.existsSync(f)) { log('tile', k, 'saved no prefab (empty region?)'); return have; }
  const r = brs.WorldReader.from(new Uint8Array(fs.readFileSync(f)));
  for (const b of r.bricks(1)) have.add(pk(b.position));
  fs.rmSync(f, { force: true }); return have;
};
let n = 0, finalMissing = 0, finalStill = 0;
for (const [k, t] of tiles) {
  n++;
  for (let pass = 1; pass <= 3; pass++) {
    const have = await readTile(k, n), addAt = new Set(t.add.map(b => pk(b.position)));
    const still = t.clear.filter(c => have.has(pk(c.slice(0, 3))) && !addAt.has(pk(c.slice(0, 3))));
    if (still.length) { await job(still.map(clr), 'rc'); await sleep(3000); }
    const have2 = still.length ? await readTile(k, n) : have;
    const miss = t.add.filter(b => !have2.has(pk(b.position)));
    if (miss.length) { const r = await job(addOp(miss), 'ra'); await sleep(3000); log(`tile ${k} pass ${pass}: re-cleared ${still.length}, re-added ${miss.length}, warnings ${bad(r)}`); }
    if (!still.length && !miss.length) { log(`tile ${k} ok (${t.clear.length} clears, ${t.add.length} adds)`); break; }
    if (pass === 3) { finalMissing += miss.length; finalStill += still.length; }
  }
}
await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save2');
log('saved; unrepaired: adds missing', finalMissing, 'clears still present', finalStill);
