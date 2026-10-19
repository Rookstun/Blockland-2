// usage: node restands.mjs stands.json go|dry [world.brdb copy] (stands.json = [{prefab, at, orient}]); case stands: 2 boxes, the button one reaching 18 along the button axis (the button sits 16 out, 7 down)
// re-place every listed shop stand (plastic text prefabs): check a stand button is at the spot in the saved
// world, clear it with a box sized to its kind, load the same prefab, report rejects
import fs from 'fs'; import path from 'path'; import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const root = path.join(process.env.HOME, 'omegga-server/bridge');
const L = JSON.parse(fs.readFileSync(process.argv[2])), DRY = process.argv[3] === 'dry';
const w = new m.WorldReader(new m.Brdb(new DatabaseSync(process.argv[4] ?? '/tmp/rs.brdb', { readOnly: true }))); const A = w.brickAssets();
const btn = []; try { for (const b of w.bricks(1)) { const a = A[b.asset_name_index]?.name ?? A[b.asset_name_index]; if (/Button/i.test(a)) btn.push(b.position); } } catch (e) { console.log('read err', e.message); }
const DIR = { 16: [0, -1], 17: [1, 0], 18: [0, 1], 19: [-1, 0] };
const found = L.filter(s => btn.some(p => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) < 30 && Math.abs(p[2] - s.at[2]) < 40));
const missing = L.filter(s => !found.includes(s));
console.log('stands', L.length, 'with a button at the spot', found.length, 'missing', missing.length);
for (const s of missing) console.log('  no stand at', s.prefab, s.at.join(','), s.orient);
if (DRY) process.exit(0);
const boxes = s => {
  const [x, y, z] = s.at, [dx, dy] = DIR[s.orient] ?? [0, -1];
  if (/_case$/.test(s.prefab)) { // button/chip box 4 toward the button, pedestal box 2 behind (CLAUDE.md CASE STAND CLEAR)
    const h = (a, c) => (dx ? [a, c] : [c, a]);
    const [h1x, h1y] = h(18, 18), [h2x, h2y] = h(12, 11);
    return [[x + 4 * dx, y + 4 * dy, z, h1x, h1y, 13], [x - 2 * dx, y - 2 * dy, z, h2x, h2y, 14]];
  }
  if (/_bare$/.test(s.prefab)) return [[x, y, z + 8, 16, 16, 22]];
  return [[x, y, z, 13, 13, 13]];
};
const job = async (ops, tag) => {
  const id = Date.now() + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 400) throw new Error('no result ' + id); await new Promise(r => setTimeout(r, 500)); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
let bad = 0;
for (let i = 0; i < found.length; i += 10) {
  const part = found.slice(i, i + 10);
  await job(part.flatMap(s => boxes(s).map(([x, y, z, a, b, c]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} ${a} ${b} ${c}`, captureMs: 120 }))), 'rclr' + i);
  await new Promise(r => setTimeout(r, 1500));
  const res = await job(part.map(s => ({ op: 'cmd', line: `br.Prefab.Load "${s.prefab}" ${s.at[0]} ${s.at[1]} ${s.at[2]} 0 ${s.orient}`, captureMs: 250 })), 'rld' + i);
  (res.results ?? []).forEach((r, k) => { const t = JSON.stringify(r); if (t.includes('overlapping') || t.includes('Missing brick')) { bad++; console.log('REJECT', part[k].prefab, part[k].at.join(','), part[k].orient); } });
  console.log('done', Math.min(found.length, i + 10), '/', found.length);
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`re-placed ${found.length}, ${bad} with rejects`);
