// Keeps balance/balance.json (this PC) and the server's bridge/balance/balance.json in step.
//   node balance/sync.mjs          watch: every save here is uploaded (then type /reload in game)
//   node balance/sync.mjs push     upload once
//   node balance/sync.mjs pull     download the server's copy (e.g. after a dump)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const LOCAL = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'balance.json');
const REMOTE = 'pzedlo.hopto.org:omegga-server/bridge/balance/balance.json';
const scp = (a, b) => execFileSync('scp', ['-q', a, b], { stdio: 'inherit' });

function push() {
  try { JSON.parse(fs.readFileSync(LOCAL, 'utf8')); } catch (e) { console.log(`not uploaded, bad JSON: ${e.message}`); return; }
  try { scp(LOCAL, REMOTE); } catch (e) { console.log(`upload failed (${e.message.split('\n')[0]}), will retry on the next save`); return; }
  console.log(`${new Date().toLocaleTimeString()} uploaded balance.json, type /reload in game`);
}

const mode = process.argv[2];
if (mode === 'push') push();
else if (mode === 'pull') { scp(REMOTE, LOCAL); console.log('downloaded', LOCAL); }
else {
  console.log('watching', LOCAL);
  let t = null, last = fs.readFileSync(LOCAL, 'utf8');
  fs.watch(LOCAL, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      let now; try { now = fs.readFileSync(LOCAL, 'utf8'); } catch { return; } // editors replace the file on save
      if (now !== last) { last = now; push(); }
    }, 300);
  });
}
process.on('uncaughtException', e => console.log('sync error:', e.message));
