// Worldgen preview + editor (2026-10-06, owner: "make a preview and worldgen
// editor tool"). A local web page over mapgen.mjs: tune the generator's
// tunables (mapgen tune()), preview the result at three depths, save presets,
// and build a full output into a separate out_<name> dir (never mapgen/out,
// which must equal the live map; deploying stays a manual step).
//
//   node mapgen/editor/server.mjs [--port 8787]     then open http://localhost:8787
//
// Stages: height (bare heightmap, ~3 s), sites (+ town, river, roads, villages,
// dungeons, caves, ~20 s), full (every brick rasterised, ~1 min).

import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAPGEN = path.join(HERE, '..', 'mapgen.mjs');
const PRESETS = path.join(HERE, 'presets');
const CACHE = path.join(HERE, 'cache');
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1] || 8787) || 8787;
fs.mkdirSync(PRESETS, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// the live map's settings (CLAUDE.md): what "Reset" and a first visit load
const LIVE = { seed: 786559213, scale: 1.5, params: {} };
if (!fs.existsSync(path.join(PRESETS, 'live.json'))) fs.writeFileSync(path.join(PRESETS, 'live.json'), JSON.stringify(LIVE, null, 1));

const STAGES = { height: ['--preview-height'], sites: [], full: ['--preview-full'] };
const jobs = new Map(); // id -> { state, log, started, ended, file, proc, kind }
let current = { preview: null, build: null }; // one preview and one build at a time

// the generator's own files are part of the key, so editing mapgen invalidates old previews
const codeStamp = () => fs.readdirSync(path.join(HERE, '..')).filter(f => f.endsWith('.mjs')).map(f => f + fs.statSync(path.join(HERE, '..', f)).mtimeMs).join();
const keyOf = o => crypto.createHash('sha1').update(JSON.stringify(o) + codeStamp()).digest('hex').slice(0, 16);
const safeName = n => String(n || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

function startJob(kind, { seed, scale, params = {}, stage = 'sites', name }) {
  seed = Number(seed); scale = Number(scale);
  if (!Number.isFinite(seed) || !Number.isFinite(scale) || scale <= 0 || scale > 4) throw new Error('bad seed/scale');
  if (kind === 'preview' && !STAGES[stage]) throw new Error('bad stage');
  const key = keyOf({ seed, scale, params, stage: kind === 'preview' ? stage : 'build:' + name });
  const id = `${kind}_${key}`;
  const file = path.join(CACHE, `${key}.bin`);
  // cached preview: done already
  if (kind === 'preview' && fs.existsSync(file)) {
    jobs.set(id, { kind, state: 'done', log: ['(cached)'], started: Date.now(), ended: Date.now(), file, stage });
    return id;
  }
  const old = current[kind] && jobs.get(current[kind]);
  if (old && old.state === 'running') {
    if (current[kind] === id) return id; // the same run is already going
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
    out = path.join(HERE, '..', `out_${n}`);
    argv.push('--out', out);
  }
  const job = { kind, state: 'running', log: [], started: Date.now(), file, stage, out, argv: argv.slice(1) };
  const proc = spawn(process.execPath, argv, { cwd: path.join(HERE, '..') });
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
      if (kind === 'build') {
        // the settings that made it, next to the chunks
        fs.writeFileSync(path.join(out, 'mapgen_settings.json'), JSON.stringify({ seed, scale, params, built: new Date().toISOString() }, null, 1));
      }
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

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/' || u.pathname === '/index.html')
      return send(res, 200, fs.readFileSync(path.join(HERE, 'index.html')), 'text/html; charset=utf-8');
    if (u.pathname === '/api/live') return send(res, 200, LIVE);
    if (u.pathname === '/api/presets')
      return send(res, 200, fs.readdirSync(PRESETS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort());
    if (u.pathname === '/api/preset' && req.method === 'GET') {
      const f = path.join(PRESETS, safeName(u.searchParams.get('name')) + '.json');
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f, 'utf8')) : send(res, 404, { error: 'no such preset' });
    }
    if (u.pathname === '/api/preset' && req.method === 'POST') {
      const b = await readBody(req), n = safeName(b.name);
      if (!n) return send(res, 400, { error: 'name: letters, digits, - and _' });
      if (n === 'live') return send(res, 400, { error: '"live" is the live map, pick another name' });
      fs.writeFileSync(path.join(PRESETS, n + '.json'), JSON.stringify({ seed: b.seed, scale: b.scale, params: b.params || {} }, null, 1));
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
      return send(res, 200, { state: j.state, kind: j.kind, stage: j.stage, out: j.out, argv: j.argv, ms: (j.ended || Date.now()) - j.started, log: j.log.slice(since), logLen: j.log.length });
    }
    if (u.pathname === '/api/preview') {
      const j = jobs.get(u.searchParams.get('id'));
      if (!j || j.state !== 'done' || j.kind !== 'preview') return send(res, 404, { error: 'not ready' });
      const raw = fs.readFileSync(j.file);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
      return res.end(zlib.gzipSync(raw, { level: 3 }));
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`worldgen editor: http://localhost:${PORT}`));
