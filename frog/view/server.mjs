// Frog drone view: node frog/view/server.mjs -> http://localhost:8791
// One ssh connection runs frog/pipe.mjs on the server (eye rows, pose, players in; /frog orders out).
// The page gets everything over SSE (/events); POST /cmd {cmd} sends an order; the brain here is the
// frog's autopilot (on by default; auto on|off): Navi to the nearest player; answers questions via free-claude-code (FCC) on the server.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +(process.env.PORT ?? 8791), HOST = process.env.BR_HOST ?? 'pzedlo.hopto.org';
const EYE = JSON.parse(fs.readFileSync(path.join(here, 'eye.json'), 'utf8'));
const clients = new Set();
const state = { pose: null, players: [], auto: true, mood: 'waking up' };
const send = (ev, data) => { const s = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(s); };

// ---- ssh pipe ----
let pipe = null;
function startPipe() {
  const src = fs.readFileSync(path.join(here, '../pipe.mjs'), 'utf8');
  // copy the pipe script up and run it, all in one ssh session
  // (base64: Windows argument quoting mangled backslashes in a heredoc)
  const remote = `echo ${Buffer.from(src).toString('base64')} | base64 -d > /tmp/frogpipe.mjs && exec ~/node22/bin/node /tmp/frogpipe.mjs`;
  pipe = spawn('ssh', ['-o', 'ServerAliveInterval=15', '-o', 'BatchMode=yes', HOST, remote], { windowsHide: true });
  let buf = '';
  pipe.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { onMsg(JSON.parse(l)); } catch {} }
  });
  pipe.stderr.on('data', d => process.stderr.write('[pipe] ' + d));
  pipe.on('close', code => { console.log('pipe closed', code, '- restarting in 3 s'); pipe = null; setTimeout(startPipe, 3000); });
}
const order = cmd => { pipe?.stdin.write(JSON.stringify({ cmd }) + '\n'); send('order', { cmd, t: Date.now() }); };

function onMsg(m) {
  if (m.t === 'fe') {
    // fe|frame|row|ex|ey|ez|yaw|pitch|cells
    const p = m.s.split('|'); if (p.length < 9) return;
    const [frame, row] = [+p[1], +p[2]], eye = [+p[3], +p[4], +p[5]], yaw = +p[6], pitch = +p[7];
    const cells = p[8].split(',').map(c => c ? [parseInt(c.slice(0, 6), 16), +c.slice(6)] : null);
    send('row', { frame, row, eye, yaw, pitch, cells });
  } else if (m.t === 'fr') {
    const p = m.s.split('|');
    state.pose = { x: +p[1], y: +p[2], z: +p[3], yaw: +p[4], pitch: +p[5], hop: p[6] === 'true', t: Date.now() };
    send('pose', state.pose);
  } else if (m.t === 'answer') {
    answers.get(m.id)?.(m);
  } else if (m.t === 'fq') {
    const [, name, ...q] = m.s.split('|'); ask(name || 'friend', q.join('|'));
  } else if (m.t === 'chat') {
    const r = ADDRESS.exec(m.msg); if (r && r[1].length > 1) ask(m.name, r[1]);
  } else if (m.t === 'players') {
    state.players = m.p.filter(x => x.pos); send('players', state.players);
  }
}

// ---- the brain (what Claude chose for its frog): be a Navi to the nearest player ----
let buddy = null, lastBuddySwitch = 0;
const greeted = new Map(); // name -> last "Hey! Listen!"
setInterval(() => {
  const f = state.pose; if (!state.auto || !f || Date.now() - f.t > 5000) return;
  const near = state.players.map(p => ({ p, d: Math.hypot(p.pos[0] - f.x, p.pos[1] - f.y) })).sort((a, b) => a.d - b.d)[0];
  const now = Date.now();
  const want = near && near.d < 2500 ? near.p.name : null;
  if (want !== buddy && now - lastBuddySwitch > 8000) {
    buddy = want; lastBuddySwitch = now;
    if (buddy) {
      order(`follow ${buddy}`);
      if (now - (greeted.get(buddy) ?? 0) > 10 * 60000) { greeted.set(buddy, now); order('say'); speak(`Hey! Listen! ${buddy}, I answer questions now. Start a message with "frog" or type /frog ask.`); }
    } else order('free');
  }
  state.mood = buddy ? `fluttering round ${buddy}` : 'wandering, alone, glowing';
  send('mood', { mood: state.mood, auto: state.auto });
}, 1000);

// ---- questions: "/frog ask ..." or a chat line starting with frog/froggy/navi/fairy -> claude -p -> chat ----
const SYS = `You are Frog: a small green frog with fairy wings and a glowing green glass soul on its back, flying around a Brickadia server (a multiplayer LEGO-like building game) as a Navi-style companion. A player named renderman made your soul and gave you life.
Answer the player's question truthfully and helpfully in at most 2 short sentences (under 220 characters). Dry, absurd, deadpan humour is welcome; occasionally open with "Hey! Listen!". Plain text only: no markdown, no emoji, no line breaks.
What you know about this world: players spawn in a town with a plaza and fountain; the town has an armory (swords), a gunsmith (guns, a free derringer), soda kiosks (sodas heal), a casino, and market stalls. Smash pots and bushes for coins, arrows, ammo and health. Bots (goblins, skeletons, zombies, wizards) roam and drop coins and XP; dungeons, ruins and keeps hold tougher ones; there is a death forest and a volcano far south past the snow. Limestone caverns hold glowing gems you can mine for gold. Coins buy gear; XP and coins are saved. Your commands: /frog follow, /frog free, /frog ask <question>.
If you do not know something about this specific server, say so briefly instead of inventing it.`;
const history = [];
const queue = []; let thinking = false; const lastAsk = new Map();
function ask(name, q) {
  q = q.trim().slice(0, 300); if (!q) return;
  if (Date.now() - (lastAsk.get(name) ?? 0) < 5000) return; lastAsk.set(name, Date.now());
  queue.push({ name, q }); send('qa', { name, q }); pump();
}
function pump() {
  if (thinking || !queue.length) return;
  const { name, q } = queue.shift(); thinking = true;
  const ctx = history.slice(-6).map(h => `${h.name} asked: ${h.q}\nYou answered: ${h.a}`).join('\n');
  const prompt = (ctx ? `Earlier:\n${ctx}\n\n` : '') + `${name} asks: ${q}`;
  // answered by free-claude-code on the server (pipe.mjs askFCC), never claude -p (owner: "only freeclaude")
  const id = ++askId;
  const kill = setTimeout(() => answers.get(id)?.({ text: '', err: 'timeout' }), 160000);
  answers.set(id, ({ text, err }) => {
    clearTimeout(kill); answers.delete(id); thinking = false;
    if (err) console.log('[brain]', err);
    let a = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').replace(/\s+/g, ' ').replace(/[*_`#]/g, '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/!{4,}/g, '!').trim();
    if (!a) a = 'My soul hums but no words come. Ask me again.';
    if (a.length > 300) a = a.slice(0, 297) + '...';
    history.push({ name, q, a }); while (history.length > 20) history.shift();
    if (name !== 'friend') order(`follow ${name}`); order('say'); speak(`${name}, ${a}`);
    send('qa', { name, q, a }); console.log(`[qa] ${name}: ${q} -> ${a}`);
    pump();
  });
  pipe?.stdin.write(JSON.stringify({ ask: { id, system: SYS, prompt } }) + '\n');
}
let askId = 0; const answers = new Map();
const speak = text => pipe?.stdin.write(JSON.stringify({ say: text }) + '\n');
const ADDRESS = /^(?:hey|hi|yo|ok|oi|oh)?[\s,]*(?:frog|froggy|navi|fairy)\b[\s,:!?.]*(.*)$/i;

// ---- http ----
http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`event: eye\ndata: ${JSON.stringify(EYE)}\n\n`);
    if (state.pose) res.write(`event: pose\ndata: ${JSON.stringify(state.pose)}\n\n`);
    res.write(`event: players\ndata: ${JSON.stringify(state.players)}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (req.url === '/cmd' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      try {
        const { cmd } = JSON.parse(b);
        if (/^auto (on|off)$/.test(cmd)) { state.auto = cmd.endsWith('on'); send('mood', { mood: state.auto ? 'autopilot on' : 'manual', auto: state.auto }); }
        else { if (!/^(look|turn|pitch)/.test(cmd)) state.auto = false; order(cmd); }
        res.end('ok');
      } catch (e) { res.statusCode = 400; res.end(String(e)); }
    }); return;
  }
  const f = req.url === '/' ? 'index.html' : req.url.slice(1);
  if (!/^[\w.-]+$/.test(f) || !fs.existsSync(path.join(here, f))) { res.statusCode = 404; return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'text/plain' });
  res.end(fs.readFileSync(path.join(here, f)));
}).listen(PORT, () => console.log(`frog view: http://localhost:${PORT}`));
startPipe();
