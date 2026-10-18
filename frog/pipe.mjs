// Server side of the frog view (runs on the server through ONE ssh connection, started by frog/view/server.mjs):
//   stdout: JSON lines {t:'fe'|'fr', s:'<the chip line>'} from the game log, {t:'players', p:[...]} every 2 s
//   stdin:  JSON lines {cmd:'go 10 20'} -> br.Chat.Command /frog go 10 20 (bridge inbox, no waiting); {say:text} -> chat line
//   also {t:'chat'} for every player chat line and {t:'fq'} for /frog ask
// Keeps the frog's eyes on (/frog watch 30) while this runs.
import fs from 'fs'; import path from 'path'; import readline from 'readline';
const ROOT = path.join(process.env.HOME, 'omegga-server');
const LOGS = path.join(ROOT, 'data/logs'), INBOX = path.join(ROOT, 'bridge/inbox'), OUTBOX = path.join(ROOT, 'bridge/outbox');
const out = o => process.stdout.write(JSON.stringify(o) + '\n');
const mine = new Map(); // job id -> callback(result)

function job(ops, cb) {
  const id = `frog_${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`;
  fs.writeFileSync(path.join(INBOX, id + '.tmp'), JSON.stringify({ ops }));
  fs.renameSync(path.join(INBOX, id + '.tmp'), path.join(INBOX, id));
  mine.set(id, { cb, t: Date.now() });
}
setInterval(() => {
  for (const [id, j] of mine) {
    const f = path.join(OUTBOX, id);
    if (fs.existsSync(f)) {
      let r = null; try { r = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
      fs.rmSync(f, { force: true }); mine.delete(id); j.cb?.(r);
    } else if (Date.now() - j.t > 60000) mine.delete(id);
  }
}, 200);

const say = line => job([{ op: 'cmd', line: `br.Chat.Command /frog ${line.replace(/[^\w .\-]/g, '')}` }]);
// {say: text}: one chat line from the frog (br.Chat.Broadcast; console lines must stay < 500 chars)
const chat = text => job([{ op: 'say', msg: `<color="7dffa0">Frog</>: ${text.replace(/[\r\n"\\]/g, ' ').slice(0, 420)}` }]);
readline.createInterface({ input: process.stdin }).on('line', l => { try { const m = JSON.parse(l); if (m.cmd) say(m.cmd); if (m.say) chat(m.say); } catch {} });
process.stdin.on('end', () => process.exit(0));

say('watch 30'); setInterval(() => say('watch 30'), 20000);
let busy = false;
setInterval(() => {
  if (busy) return; busy = true;
  job([{ op: 'players' }], r => { busy = false; if (r?.ok) out({ t: 'players', p: r.results[0] }); });
}, 2000);

// tail the newest log
let file = null, pos = 0, rest = '';
function newest() {
  const fs_ = fs.readdirSync(LOGS).filter(f => f.startsWith('omegga-') && f.endsWith('.log'));
  let best = null, bm = 0;
  for (const f of fs_) { const m = fs.statSync(path.join(LOGS, f)).mtimeMs; if (m > bm) { bm = m; best = f; } }
  return best && path.join(LOGS, best);
}
setInterval(() => {
  const f = newest(); if (!f) return;
  if (f !== file) { file = f; pos = fs.statSync(f).size; rest = ''; }
  const size = fs.statSync(f).size; if (size <= pos) return;
  const fd = fs.openSync(f, 'r'), buf = Buffer.alloc(size - pos);
  fs.readSync(fd, buf, 0, buf.length, pos); fs.closeSync(fd); pos = size;
  const lines = (rest + buf.toString('utf8')).split('\n'); rest = lines.pop();
  for (const l of lines) {
    const ci = l.indexOf('LogChat: [SenderId: ');
    if (ci >= 0) {
      const m = /LogChat: \[SenderId: ([0-9a-f-]+)\] ([^:]+): (.*)$/.exec(l);
      if (m) out({ t: 'chat', id: m[1], name: m[2], msg: m[3].trim() });
      continue;
    }
    const i = l.indexOf('LogBrickadia: [Wire Graph] f');
    if (i < 0) continue;
    const s = l.slice(i + 27).trim();
    if (/^f[erq]\|/.test(s)) out({ t: s.slice(0, 2), s });
  }
}, 120);
