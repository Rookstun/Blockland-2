// Loads the whole map in ONE prefab load (the owner's standing order), with a
// big chat announcement first.
//
//   node loadall.mjs [mapDir]      (default ~/omegga-server/bridge/map)
//
// Merges mapDir/chunk_*.json into a single bridge job and waits for it
// (up to an hour; job.mjs gives up after a minute).

import fs from 'fs';
import path from 'path';

const root = path.join(process.env.HOME, 'omegga-server/bridge');
const dir = process.argv[2] ?? path.join(root, 'map');
const QUOTE = '"I DONT CARE IF THE FUCKIN SERVER CRASHES JUST DO IT ALL AT ONCE"';

const bricks = [];
for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f)).sort())
  for (const op of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).ops) if (op.op === 'bricks') bricks.push(...op.bricks);
console.log(`loading ${bricks.length} bricks in one go`);

const job = {
  ops: [
    { op: 'say', msg: `<size="40"><color="ff4040"><b>${QUOTE}</></></>` },
    { op: 'say', msg: `<size="24"><b>Map update: all ${bricks.length.toLocaleString('en-US')} bricks going in at once.</></>` },
    { op: 'bricks', at: [0, 0, 0], captureMs: 30000, bricks },
    { op: 'say', msg: '<size="24"><b>Map update done.</> The spawn town is in the middle.</>' },
  ],
};
const id = `${Date.now()}_all.json`;
fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify(job));
fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
const out = path.join(root, 'outbox', id);
const t0 = Date.now();
while (!fs.existsSync(out)) {
  if (Date.now() - t0 > 3600e3) { console.error('timeout after an hour'); process.exit(1); }
  await new Promise(r => setTimeout(r, 1000));
}
const res = JSON.parse(fs.readFileSync(out, 'utf8'));
fs.rmSync(out);
const load = res.results?.[2];
console.log(JSON.stringify({ ok: res.ok, seconds: Math.round((Date.now() - t0) / 1000), count: load?.count, log: load?.log, error: res.error?.slice(0, 500) }, null, 1));
process.exit(res.ok ? 0 : 1);
