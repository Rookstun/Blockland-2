// Frog drone view: node frog/view/server.mjs -> http://localhost:8791
// One ssh connection runs frog/pipe.mjs on the server (eye rows, pose, players in; /frog orders out).
// The page gets everything over SSE (/events); POST /cmd {cmd} sends an order; the brain here is the
// frog's autopilot (on by default; /auto on|off): go see the nearest player, stare at them, look around.
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
  const remote = `cat > /tmp/frogpipe.mjs <<'FROGEOF'\n${src}\nFROGEOF\nexec ~/node22/bin/node /tmp/frogpipe.mjs`;
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
  } else if (m.t === 'players') {
    state.players = m.p.filter(x => x.pos); send('players', state.players);
  }
}

// ---- the brain (what Claude chose for its frog) ----
let lastGo = 0, lastLook = 0, target = null;
setInterval(() => {
  const f = state.pose; if (!state.auto || !f || Date.now() - f.t > 5000) return;
  const near = state.players.map(p => ({ p, d: Math.hypot(p.pos[0] - f.x, p.pos[1] - f.y) })).sort((a, b) => a.d - b.d)[0];
  const now = Date.now();
  if (near && near.d < 2500) {
    const [px, py, pz] = near.p.pos, dx = px - f.x, dy = py - f.y;
    if (near.d > 110 && now - lastGo > 2500) {
      const k = (near.d - 70) / near.d; order(`go ${(f.x + dx * k).toFixed(0)} ${(f.y + dy * k).toFixed(0)}`); lastGo = now;
      state.mood = `hopping to ${near.p.name}`;
    } else if (near.d <= 110 && now - lastLook > 1500) {
      const yaw = Math.atan2(dy, dx) * 180 / Math.PI, pitch = Math.atan2(pz + 20 - (f.z + 20), near.d) * 180 / Math.PI;
      order(`look ${yaw.toFixed(0)} ${Math.max(-60, Math.min(70, pitch)).toFixed(0)}`); lastLook = now;
      state.mood = `staring at ${near.p.name}`;
    }
  } else if (now - lastLook > 6000) {
    order(`look ${(f.yaw + (Math.random() * 140 - 70)).toFixed(0)} ${(Math.random() * 30 - 10).toFixed(0)}`); lastLook = now;
    state.mood = 'looking around';
  }
  send('mood', { mood: state.mood, auto: state.auto });
}, 700);

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
