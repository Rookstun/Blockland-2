// usage: node cabswap.mjs stands.json go|dry world.brdb-copy
// (2026-10-21, owner: every armory sword "positioned like the black longsword") swap every live shop_*_case wall-cabinet
// stand for shop_*_cab (barestand.mjs CAB=1: spawn brick on the felt, weapon standing up, button 50 lower).
// Clears the old stand (CLAUDE.md CASE STAND CLEAR boxes) + a low box for the owner's hand-lowered spawn/button, loads _cab.
import fs from 'fs'; import path from 'path'; import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const root = path.join(process.env.HOME, 'omegga-server/bridge');
const L = JSON.parse(fs.readFileSync(process.argv[2])).filter(s => /^shop_.*_case$/.test(s.prefab)), DRY = process.argv[3] !== 'go';
const w = new m.WorldReader(new m.Brdb(new DatabaseSync(process.argv[4], { readOnly: true }))); const A = w.brickAssets();
const btn = []; for (const b of w.bricks(1)) { const a = A[b.asset_name_index]?.name ?? A[b.asset_name_index]; if (a === 'B_Button_Square') btn.push(b.position); }
const DIR = { 16: [0, -1], 17: [1, 0], 18: [0, 1], 19: [-1, 0] };
const found = L.filter(s => btn.some(p => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) < 30 && p[2] - s.at[2] < 10 && p[2] - s.at[2] > -70));
console.log('case stands', L.length, 'live', found.length);
for (const s of L) if (!found.includes(s)) console.log('  not live', s.prefab, s.at.join(','), s.orient);
if (DRY) process.exit(0);
const boxes = s => {
  const [x, y, z] = s.at, [dx, dy] = DIR[s.orient], h = (a, c) => (dx ? [a, c] : [c, a]);
  const [h1x, h1y] = h(18, 18), [h2x, h2y] = h(12, 11), [h3x, h3y] = h(17, 11);
  return [[x + 4 * dx, y + 4 * dy, z, h1x, h1y, 13], [x - 2 * dx, y - 2 * dy, z, h2x, h2y, 14], [x + 4 * dx, y + 4 * dy, z - 57, h3x, h3y, 7]];
};
const job = async (ops, tag) => {
  const id = Date.now() + '_' + process.pid + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 400) throw new Error('no result ' + id); await new Promise(r => setTimeout(r, 500)); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
let bad = 0;
for (let i = 0; i < found.length; i += 10) {
  const part = found.slice(i, i + 10);
  await job(part.flatMap(s => boxes(s).map(([x, y, z, a, b, c]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} ${a} ${b} ${c}`, captureMs: 120 }))), 'cclr' + i);
  await new Promise(r => setTimeout(r, 1500));
  const res = await job(part.map(s => ({ op: 'cmd', line: `br.Prefab.Load "${s.prefab.replace(/_case$/, '_cab')}" ${s.at[0]} ${s.at[1]} ${s.at[2]} 0 ${s.orient}`, captureMs: 3000 })), 'cld' + i);
  (res.results ?? []).forEach((r, k) => { const t = JSON.stringify(r); if (t.includes('overlapping') || t.includes('Missing brick')) { bad++; console.log('REJECT', part[k].prefab, part[k].at.join(','), part[k].orient, t.slice(0, 300)); } });
  console.log('done', Math.min(found.length, i + 10), '/', found.length);
}
console.log(`swapped ${found.length}, ${bad} with rejects`);
