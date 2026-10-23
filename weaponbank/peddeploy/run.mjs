// drawn (faire) shop stands: _bare (hidden pedestal, floating) -> full stands with the pedestal on a bench/table/counter top (2026-10-23)
// delta out_site_1022tier -> out_site_1023stand (faire racks get a bench), stands from the two shops.json
//   node run.mjs   (server, ~/peddeploy)
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const H = process.env.HOME, root = path.join(H, 'omegga-server/bridge'), here = path.join(H, 'peddeploy');
const W = path.join(H, 'omegga-server/data/Saved/Worlds');
const job = async (ops, tag) => {
  const id = Date.now() + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 600) throw new Error('no result ' + id); await new Promise(r => setTimeout(r, 500)); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = { 16: [0, -1], 17: [1, 0], 18: [0, 1], 19: [-1, 0] };
const boxes = s => {
  const [x, y, z] = s.at, [dx, dy] = DIR[s.orient] ?? [0, -1];
  if (/_case$/.test(s.prefab)) { const h = (a, c) => (dx ? [a, c] : [c, a]); const [h1x, h1y] = h(18, 18), [h2x, h2y] = h(12, 11);
    return [[x + 4 * dx, y + 4 * dy, z, h1x, h1y, 13], [x - 2 * dx, y - 2 * dy, z, h2x, h2y, 14]]; }
  if (/_bare$/.test(s.prefab)) return [[x, y, z + 8, 16, 16, 22]];
  return [[x, y, z, 13, 13, 13]];
};
const { gone, new: add } = JSON.parse(fs.readFileSync(path.join(here, 'stands.json')));
const delta = JSON.parse(fs.readFileSync(path.join(here, 'delta.json')));
await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save'); await sleep(8000);
fs.copyFileSync(path.join(W, 'site 2026-10-18.brdb'), path.join(W, 'backup pre_pedestal site 2026-10-23.brdb')); console.log('backup ok');
const cl = [...gone.flatMap(boxes), ...delta.clear];
for (let i = 0; i < cl.length; i += 40) { await job(cl.slice(i, i + 40).map(c => ({ op: 'cmd', line: `br.World.ClearRegion ${c.join(' ')}`, captureMs: 120 })), 'pclr' + i); }
console.log('cleared', cl.length, 'boxes'); await sleep(3000);
const r = await job([{ op: 'bricks', at: [0, 0, 0], bricks: delta.add, owner: { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' }, externalAssets: delta.externalAssets, captureMs: 3000 }], 'padd');
const rs = JSON.stringify(r); console.log('adds', delta.add.length, 'overlap lines', (rs.match(/overlapping/g) || []).length);
await sleep(2000);
const res = await job(add.map(e => ({ op: 'cmd', line: `br.Prefab.Load "${e.prefab}" ${e.at[0]} ${e.at[1]} ${e.at[2]} 0 ${e.orient}`, captureMs: 250 })), 'pload');
let bad = 0; (res.results ?? []).forEach((x, i) => { const s = JSON.stringify(x); if (s.includes('overlapping') || s.includes('Missing brick')) { bad++; console.log('REJECT', add[i].prefab, add[i].at.join(',')); } });
console.log('stands: gone', gone.length, 'loaded', add.length, 'rejects', bad);
// keep the balance tool's stand list in step
const SJ = path.join(root, 'balance/stands.json'); const L = JSON.parse(fs.readFileSync(SJ, 'utf8'));
fs.copyFileSync(SJ, SJ + '.pre_pedestal');
const key = s => s.at.join(',') + '|' + s.prefab;
const goneK = new Set(gone.map(key)); const out = L.filter(s => !goneK.has(key(s)) && !/_bare$/.test(s.prefab)).concat(add.map(s => ({ prefab: s.prefab, at: s.at, orient: s.orient })));
fs.writeFileSync(SJ, JSON.stringify(out)); console.log('stands.json', L.length, '->', out.length);
await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save2'); console.log('saved');
