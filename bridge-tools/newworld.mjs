// newworld.mjs DIR OLDEX WORLD   (2026-10-27, owner: "randomize seed"): replace the whole map with a fresh build.
//   DIR = mapgen out dir (chunks + extras jsons), OLDEX = the live build's extras jsons.
// Steps: wait until the game has run every queued ClearRegion (late clears eat new bricks), br.Bricks.Clear the map owner,
// ALL chunk bricks in ONE bricks op, save, extrasdiff.py OLDEX -> DIR, save.
import fs from 'fs'; import path from 'path'; import { execSync, execFileSync } from 'child_process';
const [DIR, OLDEX, WORLD] = process.argv.slice(2);
const SRV = path.join(process.env.HOME, 'omegga-server'), root = path.join(SRV, 'bridge');
const OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const job = async (ops, tag) => {
  const id = Date.now() + '_' + tag + '.json';
  fs.writeFileSync(path.join(root, 'inbox', id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(root, 'inbox', id + '.tmp'), path.join(root, 'inbox', id));
  const out = path.join(root, 'outbox', id);
  while (!fs.existsSync(out)) await sleep(1000);
  const res = JSON.parse(fs.readFileSync(out, 'utf8')); fs.rmSync(out); return res;
};
const lastClear = () => { // age of the last "Cleared" line in the newest game log
  const L = execSync(`ls -t ${SRV}/data/logs/omegga-*.log | head -1`).toString().trim();
  const t = execSync(`tail -c 2000000 "${L}" | grep -a "LogBrickCommands: Cleared\|No bricks to clear" | tail -1 || true`).toString();
  const m = /\[(\d{4})\.(\d\d)\.(\d\d)-(\d\d)\.(\d\d)\.(\d\d)/.exec(t);
  return m ? Date.now() - Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 1e9;
};
if (process.env.WAIT_CLEARS) { while (lastClear() < 15000) await sleep(5000); log('clear queue drained'); }
await job([{ op: 'cmd', line: `br.Bricks.Clear ${OWNER.id} 1`, captureMs: 10000 }], 'wipe'); await sleep(15000);
const bricks = []; let ext;
for (const f of fs.readdirSync(DIR).filter(f => /^chunk_\d+\.json$/.test(f)).sort())
  for (const o of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).ops) if (o.op === 'bricks') { for (const b of o.bricks) bricks.push(b); ext ??= o.externalAssets; }
log('loading', bricks.length);
// a 1.7M-brick bricks op is too big for the bridge job JSON (2026-10-27: nothing loaded, no error): write the brz here, ONE Prefab.Load
const brs = await import(path.join(SRV, 'plugins/bridge/lib/brs.mjs')), assets = [], materials = [], ix = (l, n) => { const i = l.indexOf(n); return i < 0 ? l.push(n) - 1 : i; };
const out = bricks.map(({ asset, material, label, group, ...b }) => ({ ...b, asset_name_index: ix(assets, asset ?? 'PB_DefaultBrick'), material_index: ix(materials, material ?? 'BMC_Plastic'), owner_index: 1 }));
fs.writeFileSync(path.join(SRV, 'data/Saved/Prefabs/newworld_all.brz'), brs.writeBrzLegacy({ brick_assets: assets, materials, brick_owners: [{ ...OWNER, bricks: out.length }], bricks: out }, ext ? { externalAssets: ext } : {}));
const r = await job([{ op: 'cmd', line: 'br.Prefab.Load "newworld_all" 0 0 0 0 16', captureMs: 40000 }], 'all');
const txt = JSON.stringify(r); if (!/overlapping|Prefab/.test(txt) && !r.ok) throw new Error('load failed ' + txt.slice(0, 500));
log('loaded; overlap lines', (txt.match(/overlapping[^"]*/g) || []).join(' '));
await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save'); await sleep(10000);
// old extras -> nothing -> new: clears every old extra (some have their own owners), loads every new one
const EMPTY = fs.mkdtempSync('/tmp/noex');
for (const [a, b] of [[OLDEX, EMPTY], [EMPTY, DIR]]) {
  const o = execFileSync('python3', [path.join(root, 'tools/extrasdiff.py'), a, b, path.join(SRV, 'data/Saved/Worlds', WORLD + '.brdb')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  log(o.trim().split('\n').slice(-12).join(' | '));
  await job([{ op: 'cmd', line: 'br.World.Save', captureMs: 5000 }], 'save3'); await sleep(10000);
}
log('done, saved');
