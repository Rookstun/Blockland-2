// Deploy the Tavistock house to pzedlo (owner rule: never queue bricks: one bricks op with every brick).
// Bricks.Clear of the generator's owner leaves the doors' moving grids behind, loose (2026-10-26: 9 old doors fell
// out of their frames), so a rebuild wipes the whole lot instead and puts the owner's own work back:
//   1. SaveRegion the house (with moving grids) -> tavistock_extract.mjs keeps everything the owner built
//      (tavistock_owner.brz: their garage door, hall door, lamp, switches, with joints and wires)
//   2. ONE job: Bricks.Clear Tavistock, ClearRegion the lot (now only the owner's work + loose grids, well under
//      ClearRegion's ~1,800-brick limit), the house in one bricks op, the fixtures prefab (lamps, switches, doors:
//      tavistock_fixtures.mjs), the owner's prefab, save.
// Check the active world first (CLAUDE.md).   node mapgen/tavistock_deploy.mjs [--at X,Y,Z]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { tavistock } from './tavistock.mjs';

const HOST = 'pzedlo.hopto.org', OWNER = { id: 'c1770000-0000-4b0b-9a11-0000000a3313', name: 'Tavistock' };
const args = process.argv.slice(2);
const at = (args.includes('--at') ? args[args.indexOf('--at') + 1] : '1000,0,0').split(',').map(Number);
const { bricks, W, D } = tavistock();
// the lot: the house frame (W x D studs from the origin) and 30 above the roofs
const box = [at[0] + W * 5, at[1] + D * 5, at[2] + 150, W * 5 + 20, D * 5 + 20, 170].map(Math.round).join(' ');
const local = f => new URL(f, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const tmp = path.join(os.tmpdir(), 'tavdeploy');
fs.mkdirSync(tmp, { recursive: true });
const job = (ops, name) => { // synchronous bridge job; output in a file (stdout over 64 KB truncates)
  fs.writeFileSync(path.join(tmp, name), JSON.stringify({ ops }));
  execFileSync('scp', ['-q', path.join(tmp, name), `${HOST}:/tmp/${name}`]);
  return JSON.parse(execFileSync('ssh', [HOST, `cd ~/omegga-server && timeout 58 ~/node22/bin/node bridge/tools/job.mjs < /tmp/${name}`], { maxBuffer: 1 << 26 }).toString());
};

// 1. keep the owner's work
job([{ op: 'cmd', line: `br.Prefab.SaveRegion "tavistock_live" ${box} 1`, captureMs: 3000 }], 'tav_save.json');
execFileSync('scp', ['-q', `${HOST}:omegga-server/data/Saved/Prefabs/tavistock_live.brz`, path.join(tmp, 'tavistock_live.brz')]);
fs.writeFileSync(path.join(tmp, 'gen.json'), JSON.stringify(bricks));
execFileSync(process.execPath, [local('./tavistock_extract.mjs'), path.join(tmp, 'tavistock_live.brz'), ...at.map(String)], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, GEN: path.join(tmp, 'gen.json') } });
execFileSync(process.execPath, [local('./tavistock_fixtures.mjs')], { stdio: 'inherit' });
for (const f of ['tavistock_owner.brz', 'tavistock_fixtures.brz']) execFileSync('scp', ['-q', local('./' + f), `${HOST}:omegga-server/data/Saved/Prefabs/${f}`]);

// 2. rebuild in one job
const res = job([
  { op: 'cmd', line: `br.Bricks.Clear ${OWNER.id} 1`, captureMs: 2000 },
  { op: 'cmd', line: `br.World.ClearRegion ${box}`, captureMs: 2000 },
  { op: 'sleep', ms: 1500 },
  { op: 'bricks', at, owner: OWNER, captureMs: 3000, bricks },
  { op: 'cmd', line: `br.Prefab.Load "tavistock_fixtures" ${at.join(' ')} 0 16`, captureMs: 3000 },
  { op: 'cmd', line: `br.Prefab.Load "tavistock_owner" ${at.join(' ')} 0 16`, captureMs: 3000 },
  { op: 'cmd', line: 'br.World.Save', captureMs: 3000 },
], 'tav_build.json');
const logs = res.results.flatMap(x => Array.isArray(x) ? x : x?.log ?? []);
console.log(`house ${res.results[3]?.count} bricks; problems:`, logs.filter(l => /issing|verlap|Failed/.test(l)));
