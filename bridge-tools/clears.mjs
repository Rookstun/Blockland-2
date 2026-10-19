// paced ClearRegions from clear.json starting at START, BATCH per job, no log reading
import fs from 'fs'; import path from 'path';
const root = path.join(process.env.HOME, 'omegga-server/bridge');
const [file, start = '0', batch = '150'] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(file)).clear;
const job = async (ops, tag) => {
  const id = Date.now() + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 300) throw new Error('no result ' + id); await new Promise(r => setTimeout(r, 500)); }
  fs.rmSync(out);
};
for (let i = +start; i < C.length; i += +batch) {
  const ops = C.slice(i, i + +batch).map(([x, y, z, hx, hy, hz]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} ${hx} ${hy} ${hz}`, captureMs: 0 }));
  await job(ops, 'clr' + i);
  console.log('cleared', Math.min(C.length, i + +batch), '/', C.length);
  await new Promise(r => setTimeout(r, 1500));
}
console.log('clears done');
