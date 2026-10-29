// Every house we built, in a row on a flat world (owner 2026-10-29: 'place all the houses we built in this world',
// 'i just made a completely flat world'). ONE job: Bricks.Clear each house owner, ONE bricks op holding every house
// (per-brick owners, so each house still wipes on its own), the fixtures prefabs (lamps, switches, doors), save.
// Ground = z 0. Check the active world first (CLAUDE.md).   node mapgen/houses_flat.mjs [X0 Y0]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { worldBox } from './orient.mjs';
import { whitetail } from './whitetail.mjs';
import { tavistock } from './tavistock.mjs';
import { georgian } from './georgian.mjs';
import { witherspoon } from './witherspoon.mjs';
import { derwent } from './derwent.mjs';
import { dutchColonial } from './dutchcolonial.mjs';
import { splitLevel } from './splitlevel.mjs';

const HOST = 'pzedlo.hopto.org', GAP = 300;
const [X0, Y0] = [+(process.argv[2] ?? 2000), +(process.argv[3] ?? 2000)];
const id = s => `c1770000-0000-4b0b-9a11-${s.padStart(12, '0')}`;
const HOUSES = [
  { name: 'White Tail Ridge', id: id('718a1e'), make: whitetail, fixtures: 'whitetail' },
  { name: 'Tavistock', id: id('a3313'), make: tavistock, fixtures: 'tavistock', ownerWork: 'tavistock_owner' },
  { name: 'Georgian Estate', id: id('e0e91'), make: () => georgian({ seed: 1 }) },
  { name: 'Witherspoon House', id: id('e2542'), make: witherspoon },
  { name: 'Derwent House', id: id('de9e1'), make: derwent },
  { name: 'Dutch Colonial', id: id('d07c4'), make: () => dutchColonial({ seed: 1 }) },
  { name: 'Split Level', id: id('5b17'), make: () => splitLevel({ seed: 1 }) },
];

const local = f => new URL(f, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const bricks = [], loads = [], lots = [];
let x = X0;
for (const h of HOUSES) {
  const hb = h.make().bricks;
  const lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const b of hb) { const [l, u] = worldBox(b); for (const i of [0, 1]) { lo[i] = Math.min(lo[i], l[i]); hi[i] = Math.max(hi[i], u[i]); } }
  // house origin snapped to 10 so the stud grid stays on grid; fronts (min y) line up on Y0
  const at = [Math.ceil((x - lo[0]) / 10) * 10, Math.ceil((Y0 - lo[1]) / 10) * 10, 0];
  const owner = { id: h.id, name: h.name };
  for (const b of hb) bricks.push({ ...b, position: b.position.map((p, i) => p + at[i]), owner });
  // ClearRegion box (centre, half) of the lot: Bricks.Clear leaves door grids loose (tavistock_deploy.mjs)
  lots.push([(lo[0] + hi[0]) / 2 + at[0], (lo[1] + hi[1]) / 2 + at[1], 300, (hi[0] - lo[0]) / 2 + 20, (hi[1] - lo[1]) / 2 + 20, 300].map(Math.round));
  if (h.fixtures) {
    const out = local(`./${h.fixtures}_fixtures.brz`);
    execFileSync(process.execPath, [local('./tavistock_fixtures.mjs'), '--house', h.fixtures, '--owner', h.id, h.name, '--out', out], { stdio: 'inherit' });
    loads.push([`${h.fixtures}_fixtures`, out, at]);
  }
  if (h.ownerWork) loads.push([h.ownerWork, local(`./${h.ownerWork}.brz`), at]);
  console.error(`${h.name}: ${hb.length} bricks at ${at.join(',')} (x ${at[0] + lo[0]}..${at[0] + hi[0]})`);
  x = at[0] + hi[0] + GAP;
}
for (const [name, file] of loads) execFileSync('scp', ['-q', file, `${HOST}:omegga-server/data/Saved/Prefabs/${name}.brz`]);

const ops = [
  ...HOUSES.map(h => ({ op: 'cmd', line: `br.Bricks.Clear ${h.id} 1`, captureMs: 300 })),
  ...lots.map(b => ({ op: 'cmd', line: `br.World.ClearRegion ${b.join(' ')}`, captureMs: 300 })),
  { op: 'sleep', ms: 1500 },
  // legacy .brz has no metadata for atOriginalPosition: load at 0 (positions are world coordinates)
  { op: 'bricks', at: [0, 0, 0], owner: { id: HOUSES[0].id, name: HOUSES[0].name }, captureMs: 8000, bricks },
  ...loads.map(([name, , at]) => ({ op: 'cmd', line: `br.Prefab.Load "${name}" ${at.join(' ')} 0 16`, captureMs: 3000 })),
  { op: 'cmd', line: 'br.World.Save', captureMs: 3000 },
];
// long job: through the inbox (job.mjs stops at 60 s)
const tag = `houses_${Date.now()}`, tmp = path.join(os.tmpdir(), tag + '.json');
fs.writeFileSync(tmp, JSON.stringify({ ops }));
execFileSync('scp', ['-q', tmp, `${HOST}:omegga-server/bridge/inbox/${tag}.json.tmp`]);
execFileSync('ssh', [HOST, `mv ~/omegga-server/bridge/inbox/${tag}.json.tmp ~/omegga-server/bridge/inbox/${tag}.json`]);
console.log(`${bricks.length} bricks queued as one job; result: ~/omegga-server/bridge/outbox/${tag}.json`);
