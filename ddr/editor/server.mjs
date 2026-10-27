// DDR editor / simulator / converter:  node ddr/editor/server.mjs -> http://localhost:8792
// Upload MIDIs into ddr/songs, edit each song's chart + track roles (songs/<name>.json),
// pick the cabinet's speaker set (ddr/soundset.json), play it in the browser simulator,
// build ddr.brz (+ the Latest-format copy) and optionally deploy it to the live cabinet.
// The page imports ddr/midi.mjs, chart.mjs and wsgen.mjs directly, so the chart and the
// timing it shows are the ones the chip gets.
import http from 'node:http';
import fs from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { VOICES } from '../chart.mjs';

const here = dirname(fileURLToPath(import.meta.url)), DDR = join(here, '..'), ROOT = join(DDR, '..');
const SONGS = join(DDR, 'songs'), OFF = join(DDR, 'songs_off'), SS = join(DDR, 'soundset.json');
const PORT = +(process.env.PORT || 8792);
const HOST = process.env.BR_HOST || 'pzedlo.hopto.org', NODE = '~/node22/bin/node';
// the live cabinet (site world sky spot, see CLAUDE.md DDR cabinet)
const CAB = { at: [-7200, -8400, 8000], clear: '-7200 -8480 8160 120 166 172' };
const LIB = new Set(['midi.mjs', 'chart.mjs', 'wsgen.mjs']);
const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

const safe = n => { const b = basename(String(n)); if (!b || b.startsWith('.') || /[\\/]/.test(b)) throw new Error('bad name'); return b; };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body)); };
const readBody = req => new Promise((ok, no) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });
const run = (cmd, args, opts = {}) => new Promise(ok => {
  const p = spawn(cmd, args, { windowsHide: true, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, ...opts }); let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('error', e => ok({ code: -1, out: out + e.message }));
  p.on('close', code => ok({ code, out }));
  if (opts.input != null) p.stdin.end(opts.input); else p.stdin.end();
});

function listSongs() {
  return fs.readdirSync(SONGS).filter(f => /\.midi?$/i.test(f)).sort().map(f => {
    const base = f.replace(/\.midi?$/i, ''), cf = join(SONGS, base + '.json');
    return { file: f, base, cfg: fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : {} };
  });
}
const soundset = () => fs.existsSync(SS) ? JSON.parse(fs.readFileSync(SS, 'utf8')) : { voices: VOICES };

let building = false;
async function build(log) {
  const b = await run(process.execPath, [join(DDR, 'build.mjs')], { cwd: DDR });
  log.push(b.out.trim());
  if (b.code !== 0) throw new Error('build failed');
  // build.mjs writes ddr.latest.brz itself (tools/wspkg output is already Latest)
  return { brz: fs.statSync(join(DDR, 'ddr.brz')).size, latest: fs.statSync(join(DDR, 'ddr.latest.brz')).size, chip: fs.statSync(join(DDR, 'ddr.chip.brz')).size };
}
async function deploy(log) {
  const ssh = ['-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes'];
  const c = await run('scp', [...ssh, join(DDR, 'ddr.latest.brz'), `${HOST}:omegga-server/data/Saved/Prefabs/ddr.brz`]);
  log.push('scp: ' + (c.code === 0 ? 'ok' : c.out));
  if (c.code !== 0) throw new Error('scp failed');
  const ops = [{ op: 'cmd', line: `br.World.ClearRegion ${CAB.clear}`, captureMs: 1500 }, { op: 'sleep', ms: 1500 },
    { op: 'cmd', line: `br.Prefab.Load "ddr" ${CAB.at.join(' ')} 0 16`, captureMs: 4000 }, { op: 'sleep', ms: 2000 },
    { op: 'cmd', line: 'br.World.Save', captureMs: 3000 }];
  const j = await run('ssh', [...ssh, HOST, `${NODE} ~/omegga-server/bridge/tools/job.mjs`], { input: JSON.stringify({ ops }) });
  log.push(j.out.trim().slice(0, 4000));
  if (j.code !== 0) throw new Error('job failed');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  try {
    if (p === '/' || p === '/index.html') return send(res, 200, fs.readFileSync(join(here, 'index.html')), 'text/html');
    if (p.startsWith('/lib/')) { const f = safe(p.slice(5)); if (!LIB.has(f)) return send(res, 404, 'no'); return send(res, 200, fs.readFileSync(join(DDR, f)), MIME['.mjs']); }
    if (p === '/api/songs') return send(res, 200, listSongs());
    if (p === '/api/defaults') return send(res, 200, { voices: VOICES, cab: CAB });
    if (p.startsWith('/api/midi/')) return send(res, 200, new Uint8Array(fs.readFileSync(join(SONGS, safe(p.slice(10))))), 'audio/midi');
    if (p === '/api/upload' && req.method === 'POST') {
      let name = safe(url.searchParams.get('name') || 'song.mid').replace(/\.midi?$/i, '') + '.mid';
      const buf = await readBody(req);
      if (buf.subarray(0, 4).toString('latin1') !== 'MThd') return send(res, 400, { error: 'not a MIDI file' });
      fs.writeFileSync(join(SONGS, name), buf);
      return send(res, 200, { file: name });
    }
    if (p.startsWith('/api/cfg/') && req.method === 'PUT') {
      const base = safe(p.slice(9)), cfg = JSON.parse((await readBody(req)).toString('utf8'));
      for (const k of Object.keys(cfg)) if (cfg[k] == null || cfg[k] === '') delete cfg[k];
      const f = join(SONGS, base + '.json');
      // steps one per line ({"row":3,"lane":0}) so the file stays readable
      const txt = JSON.stringify({ ...cfg, steps: cfg.steps ? '@STEPS@' : undefined }, null, 1)
        .replace('"@STEPS@"', () => '[' + cfg.steps.map(s => '\n  ' + JSON.stringify({ row: s.row, lane: s.lane })).join(',') + (cfg.steps.length ? '\n ' : '') + ']');
      if (Object.keys(cfg).length) fs.writeFileSync(f, txt); else if (fs.existsSync(f)) fs.unlinkSync(f);
      return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/song/') && req.method === 'DELETE') {  // never deleted: moved to songs_off/
      const base = safe(p.slice(10)); fs.mkdirSync(OFF, { recursive: true });
      for (const f of fs.readdirSync(SONGS)) if (f.replace(/\.(midi?|json)$/i, '') === base) fs.renameSync(join(SONGS, f), join(OFF, f));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/soundset') {
      if (req.method === 'PUT') { const ss = JSON.parse((await readBody(req)).toString('utf8')); fs.writeFileSync(SS, JSON.stringify(ss, null, 1)); return send(res, 200, { ok: true }); }
      return send(res, 200, soundset());
    }
    if ((p === '/api/build' || p === '/api/deploy') && req.method === 'POST') {
      if (building) return send(res, 409, { error: 'busy' });
      building = true; const log = [];
      try {
        const sizes = await build(log);
        if (p === '/api/deploy') await deploy(log);
        return send(res, 200, { ok: true, sizes, log: log.join('\n') });
      } catch (e) { return send(res, 500, { error: e.message, log: log.join('\n') }); } finally { building = false; }
    }
    if (p.startsWith('/out/')) {
      const f = safe(p.slice(5)); if (!['ddr.brz', 'ddr.latest.brz', 'ddr.chip.brz', 'ddr.gen.ws'].includes(f)) return send(res, 404, 'no');
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${f}"` });
      return res.end(fs.readFileSync(join(DDR, f)));
    }
    send(res, 404, 'not found', 'text/plain');
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log(`DDR editor on http://localhost:${PORT}`));
