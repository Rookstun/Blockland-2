// run exact ClearRegions from clears.json: 150 per job, 1.5 s apart
import fs from 'fs'; import path from 'path';
const root = path.join(process.env.HOME, 'omegga-server/bridge');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const job = async ops => {
  const id = Date.now() + '_' + process.pid + '_x.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  for (let t = 0; !fs.existsSync(out); t++) { if (t > 600) throw new Error('no result'); await sleep(500); }
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
const c = JSON.parse(fs.readFileSync(process.argv[2]));
for (let i = 0; i < c.length; i += 150) {
  await job(c.slice(i, i + 150).map(([x, y, z, hx, hy, hz]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} ${hx} ${hy} ${hz}`, captureMs: 0 })));
  await sleep(1500); console.log('cleared', Math.min(c.length, i + 150));
}
