// Deploy the Tavistock house to pzedlo in ONE job (owner rule: never queue bricks): wipe the generator's owner,
// one bricks op with every brick, save. The owner's own work (garage door servo, light switches, pole lamp:
// mapgen/tavistock_owner.brz, from tavistock_extract.mjs) is owned by the owner, so a wipe leaves it alone; pass
// --owner-work to also Prefab.Load it (a fresh world or a new spot). Check the active world first (CLAUDE.md).
//   node mapgen/tavistock_deploy.mjs [--owner-work] [--at X,Y,Z]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { tavistock } from './tavistock.mjs';

const HOST = 'pzedlo.hopto.org', OWNER = { id: 'c1770000-0000-4b0b-9a11-0000000a3313', name: 'Tavistock' };
const args = process.argv.slice(2);
const at = (args.includes('--at') ? args[args.indexOf('--at') + 1] : '1000,0,0').split(',').map(Number);
const ops = [
  { op: 'cmd', line: `br.Bricks.Clear ${OWNER.id} 1`, captureMs: 1500 },
  { op: 'bricks', at, owner: OWNER, captureMs: 3000, bricks: tavistock().bricks },
];
if (args.includes('--owner-work')) {
  execFileSync('scp', ['-q', new URL('./tavistock_owner.brz', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), `${HOST}:omegga-server/data/Saved/Prefabs/tavistock_owner.brz`]);
  ops.push({ op: 'cmd', line: `br.Prefab.Load "tavistock_owner" ${at.join(' ')} 0 16`, captureMs: 2000 });
}
ops.push({ op: 'cmd', line: 'br.World.Save', captureMs: 3000 });
const id = `${Date.now()}_tav.json`, tmp = path.join(os.tmpdir(), id);
fs.writeFileSync(tmp, JSON.stringify({ ops }));
execFileSync('scp', ['-q', tmp, `${HOST}:omegga-server/bridge/inbox/${id}.tmp`]);
execFileSync('ssh', [HOST, `mv ~/omegga-server/bridge/inbox/${id}.tmp ~/omegga-server/bridge/inbox/${id}`]);
console.log(`sent ${ops[1].bricks.length} bricks in one op: bridge/outbox/${id}`);
