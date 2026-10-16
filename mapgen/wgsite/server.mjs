// Brickgen: a misode-style worldgen generator site for mapgen.mjs (2026-10-15,
// owner: "make a misode.io website but for this worlds worldgen").
//
//   node mapgen/wgsite/server.mjs [--port 8788]     then open http://localhost:8788
//
// Schema = every tune() in mapgen.mjs (schema.mjs). Terrain previews run in
// the browser (terrain.mjs, an exact port of the heightmap); the sites and
// full stages run mapgen.mjs --preview here, and Build writes mapgen/out_<name>
// (never deploys). Previews share the old editor's cache (editor/cache).

import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { readSchema } from './schema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAPDIR = path.join(HERE, '..');
const MAPGEN = path.join(MAPDIR, 'mapgen.mjs');
const PRESETS = path.join(HERE, 'presets');
const CACHE = path.join(MAPDIR, 'editor', 'cache');
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1] || 8788) || 8788;
fs.mkdirSync(PRESETS, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// the live map's settings (CLAUDE.md: seed 487675143 x2 + out_rebuild_params.json)
const liveParams = () => { try { return JSON.parse(fs.readFileSync(path.join(MAPDIR, 'out_rebuild_params.json'), 'utf8')); } catch { return {}; } };
const LIVE = () => ({ name: 'live', seed: 487675143, scale: 2, params: liveParams() });

const STAGES = { height: ['--preview-height'], sites: [], full: ['--preview-full'] };
const jobs = new Map();
const current = { preview: null, build: null };
const codeStamp = () => fs.readdirSync(MAPDIR).filter(f => f.endsWith('.mjs')).map(f => f + fs.statSync(path.join(MAPDIR, f)).mtimeMs).join();
const keyOf = o => crypto.createHash('sha1').update(JSON.stringify(o) + codeStamp()).digest('hex').slice(0, 16);
const safeName = n => String(n || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

function startJob(kind, { seed, scale, params = {}, stage = 'sites', name }) {
  seed = Number(seed); scale = Number(scale);
  if (!Number.isFinite(seed) || !Number.isFinite(scale) || scale <= 0 || scale > 4) throw new Error('bad seed/scale');
  if (kind === 'preview' && !STAGES[stage]) throw new Error('bad stage');
  const key = keyOf({ seed, scale, params, stage: kind === 'preview' ? stage : 'build:' + name });
  const id = `${kind}_${key}`;
  const file = path.join(CACHE, `${key}.bin`);
  if (kind === 'preview' && fs.existsSync(file)) {
    jobs.set(id, { kind, state: 'done', log: ['(cached)'], started: Date.now(), ended: Date.now(), file, stage });
    return id;
  }
  const old = current[kind] && jobs.get(current[kind]);
  if (old && old.state === 'running') {
    if (current[kind] === id) return id;
    old.proc.kill(); old.state = 'cancelled';
  }
  const pfile = path.join(CACHE, `${key}.params.json`);
  fs.writeFileSync(pfile, JSON.stringify(params));
  const argv = [MAPGEN, '--seed', String(seed), '--scale', String(scale), '--params', pfile];
  let out = null;
  if (kind === 'preview') argv.push('--preview', file + '.tmp', ...STAGES[stage]);
  else {
    const n = safeName(name);
    if (!n) throw new Error('give the build a name');
    out = path.join(MAPDIR, `out_${n}`);
    argv.push('--out', out);
  }
  const job = { kind, state: 'running', log: [], started: Date.now(), file, stage, out, argv: argv.slice(1) };
  const proc = spawn(process.execPath, argv, { cwd: MAPDIR });
  job.proc = proc;
  const take = buf => {
    for (const line of String(buf).split('\n')) if (line.trim()) job.log.push(line.length > 400 ? line.slice(0, 400) + '...' : line);
    if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
  };
  proc.stderr.on('data', take);
  proc.stdout.on('data', () => {});
  proc.on('close', code => {
    job.ended = Date.now();
    if (job.state === 'cancelled') return;
    if (code === 0) {
      if (kind === 'preview') fs.renameSync(file + '.tmp', file);
      else fs.writeFileSync(path.join(out, 'mapgen_settings.json'), JSON.stringify({ seed, scale, params, built: new Date().toISOString() }, null, 1));
      job.state = 'done';
    } else {
      job.state = 'error';
      job.log.push(`mapgen exited with code ${code}`);
    }
  });
  jobs.set(id, job);
  current[kind] = id;
  return id;
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((ok, bad) => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e6) bad(new Error('too big')); });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } });
});
const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/app.mjs': 'app.mjs', '/terrain.mjs': 'terrain.mjs', '/worker.mjs': 'worker.mjs', '/style.css': 'style.css', '/groups.mjs': 'groups.mjs' };
const MIME = { html: 'text/html; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (STATIC[u.pathname]) {
      const f = STATIC[u.pathname];
      return send(res, 200, fs.readFileSync(path.join(HERE, f)), MIME[f.split('.').pop()]);
    }
    if (u.pathname === '/api/schema') {
      const K = Number(u.searchParams.get('scale') || 2);
      return send(res, 200, readSchema(MAPGEN, Number.isFinite(K) && K > 0 ? K : 2));
    }
    if (u.pathname === '/api/live') return send(res, 200, LIVE());
    if (u.pathname === '/api/presets')
      return send(res, 200, ['live', ...fs.readdirSync(PRESETS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()]);
    if (u.pathname === '/api/preset' && req.method === 'GET') {
      const n = safeName(u.searchParams.get('name'));
      if (n === 'live') return send(res, 200, LIVE());
      const f = path.join(PRESETS, n + '.json');
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f, 'utf8')) : send(res, 404, { error: 'no such preset' });
    }
    if (u.pathname === '/api/preset' && req.method === 'POST') {
      const b = await readBody(req), n = safeName(b.name);
      if (!n) return send(res, 400, { error: 'name: letters, digits, - and _' });
      if (n === 'live') return send(res, 400, { error: '"live" is the live map, pick another name' });
      fs.writeFileSync(path.join(PRESETS, n + '.json'), JSON.stringify({ name: n, seed: b.seed, scale: b.scale, params: b.params || {} }, null, 1));
      return send(res, 200, { ok: true, name: n });
    }
    if (u.pathname === '/api/run' && req.method === 'POST') return send(res, 200, { id: startJob('preview', await readBody(req)) });
    if (u.pathname === '/api/build' && req.method === 'POST') return send(res, 200, { id: startJob('build', await readBody(req)) });
    if (u.pathname === '/api/cancel' && req.method === 'POST') {
      const j = jobs.get((await readBody(req)).id);
      if (j && j.state === 'running') { j.proc.kill(); j.state = 'cancelled'; }
      return send(res, 200, { ok: true });
    }
    if (u.pathname === '/api/status') {
      const j = jobs.get(u.searchParams.get('id'));
      if (!j) return send(res, 404, { error: 'no such job' });
      const since = Number(u.searchParams.get('since') || 0);
      return send(res, 200, { state: j.state, kind: j.kind, stage: j.stage, out: j.out, ms: (j.ended || Date.now()) - j.started, log: j.log.slice(since), logLen: j.log.length });
    }
    if (u.pathname === '/api/preview') {
      const j = jobs.get(u.searchParams.get('id'));
      if (!j || j.state !== 'done' || j.kind !== 'preview') return send(res, 404, { error: 'not ready' });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
      return res.end(zlib.gzipSync(fs.readFileSync(j.file), { level: 3 }));
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`brickgen: http://localhost:${PORT}`));
