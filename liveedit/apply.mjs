// Server side (bridge/tools/liveedit/apply.mjs): apply one editor change set to the
// live world.  stdin: { clear: [[x,y,z,hx,hy,hz]...], groups: [{ owner: {id,name}, bricks: [...] }] }
// One ClearRegion per changed brick (its exact box + 1: only bricks entirely inside
// go), wait until the game has run them all (counted in the log, like deltadeploy.py),
// then one bricks op per owner so every brick keeps its owner. Prints a JSON report.
import fs from 'fs';
const BRIDGE = '/home/max/omegga-server/bridge', LOG = '/tmp/omegga_pty2.log';
const D = JSON.parse(fs.readFileSync(0, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DONE = /LogBrickCommands: (Cleared [0-9,]+ bricks|No bricks to clear)/g;
const doneCount = () => (fs.readFileSync(LOG, 'latin1').match(DONE) ?? []).length;
async function job(ops, wait = 300) {
  const id = `${Date.now()}_${Math.floor(Math.random() * 1e6)}_le.json`;
  fs.writeFileSync(`${BRIDGE}/inbox/${id}.tmp`, JSON.stringify({ ops }));
  fs.renameSync(`${BRIDGE}/inbox/${id}.tmp`, `${BRIDGE}/inbox/${id}`);
  const out = `${BRIDGE}/outbox/${id}`, t0 = Date.now();
  while (!fs.existsSync(out)) { if (Date.now() - t0 > wait * 1000) throw new Error('bridge timeout'); await sleep(300); }
  await sleep(300);
  const res = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  return res;
}
const report = { cleared: D.clear.length, loads: [] };
if (D.clear.length) {
  const base = doneCount();
  for (let i = 0; i < D.clear.length; i += 1500)
    await job(D.clear.slice(i, i + 1500).map(([x, y, z, a, b, c]) => ({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} ${a} ${b} ${c}` })), 120);
  const t0 = Date.now();
  while (doneCount() - base < D.clear.length && Date.now() - t0 < 120_000) await sleep(500);
  report.clearsRun = doneCount() - base;
}
for (const g of D.groups ?? []) {
  if (!g.bricks.length) continue;
  const res = await job([{ op: 'bricks', at: [0, 0, 0], owner: g.owner, captureMs: 3000, externalAssets: D.externalAssets ?? [], bricks: g.bricks }]);
  const r = res.results?.at(-1) ?? {};
  report.loads.push({ owner: g.owner?.name, count: r.count, issues: (r.log ?? []).filter(l => /overlap|rror|Missing/.test(l)).map(l => l.slice(0, 160)) });
}
process.stdout.write(JSON.stringify(report));
