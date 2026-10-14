// Server side (bridge/tools/liveedit/fetch.mjs): save a small region of the live world
// and print its bricks as JSON.   node fetch.mjs cx cy cz hx hy hz
import fs from 'fs';
import { execFileSync } from 'child_process';
const [cx, cy, cz, hx, hy, hz] = process.argv.slice(2).map(Number);
if (![cx, cy, cz, hx, hy, hz].every(Number.isFinite)) throw new Error('usage: fetch.mjs cx cy cz hx hy hz');
const TOOLS = '/home/max/omegga-server/bridge/tools', PREFABS = '/home/max/omegga-server/data/Saved/Prefabs';
const name = `le_${Date.now()}`, file = `${PREFABS}/${name}.brz`;
execFileSync('/home/max/node22/bin/node', ['job.mjs'], { cwd: TOOLS, input: JSON.stringify({ ops: [{ op: 'cmd', line: `br.Prefab.SaveRegion "${name}" ${cx} ${cy} ${cz} ${hx} ${hy} ${hz} 0`, captureMs: 300 }] }) });
// the save lands a moment later; wait until it stops growing
let last = -1;
for (let i = 0; i < 120; i++) {
  const size = fs.existsSync(file) ? fs.statSync(file).size : -1;
  if (size > 0 && size === last) break;
  last = size;
  execFileSync('sleep', ['0.25']);
}
if (!fs.existsSync(file)) { process.stdout.write(JSON.stringify({ bricks: [], owners: [], entities: 0, empty: true })); process.exit(0); }
const out = execFileSync('/home/max/node22/bin/node', [`${TOOLS}/liveedit/region.mjs`, file], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
fs.rmSync(file, { force: true });
process.stdout.write(out);
