// Live brick editor (owner 2026-10-13: "web editor for understanding and changing
// things on the live server in terms of brick type and pattern", "only for patterns
// and small shit like models and houses, do not render the entire world").
//
//   node liveedit/server.mjs [--port 8790]     then open http://localhost:8790
//
// Fetch a SMALL box of the live world (br.Prefab.SaveRegion on the server, read by
// bridge/tools/liveedit/region.mjs), look at it by brick type / colour / material /
// owner, select, recolour / pattern / swap type / material / delete, preview, deploy.
// A deploy clears exactly the changed bricks and re-lays them with their own owners
// (bridge/tools/liveedit/apply.mjs); bricks with components are locked. Every deploy
// is recorded in liveedit/edits/*.json: undo replays it backwards, and mapgen replays
// all of them on its output (no world-only fixes: a regen keeps the edits).
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { worldBox } from '../mapgen/orient.mjs';
import { FIXED } from '../mapgen/builder.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const EDITS = path.join(HERE, 'edits');
fs.mkdirSync(EDITS, { recursive: true });
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1] || 8790) || 8790;
const HOST = 'pzedlo.hopto.org', NODE = '~/node22/bin/node', TOOLS = '~/omegga-server/bridge/tools';
const MAP_OWNER = { id: '891c4675-d18a-4ce1-a465-f4193ffe8b39', name: 'abysmal garbage' };
const LIMIT = { hxy: 1000, hz: 800, bricks: 60000 }; // small things only

const ssh = (cmd, input) => new Promise((resolve, reject) => {
  const p = spawn('ssh', ['-o', 'BatchMode=yes', HOST, cmd]);
  const out = [], err = [];
  p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err.push(d));
  p.on('close', code => code === 0 ? resolve(Buffer.concat(out).toString()) : reject(new Error(`ssh exit ${code}: ${Buffer.concat(err).toString().slice(0, 400)}`)));
  if (input != null) p.stdin.end(input); else p.stdin.end();
});
const job = async ops => JSON.parse(await ssh(`${NODE} ${TOOLS}/job.mjs`, JSON.stringify({ ops })));

// only the brick fields the bridge's bricks op should carry
const clean = b => {
  const o = { asset: b.asset, position: b.position, direction: b.direction ?? 4, rotation: b.rotation ?? 0, color: b.color.slice(0, 3), material: b.material ?? 'BMC_Plastic', material_intensity: b.material_intensity ?? 5, size: b.size ?? [0, 0, 0] };
  if (b.collision) o.collision = { player: !!b.collision.player, weapon: !!b.collision.weapon, interaction: !!b.collision.interaction, tool: !!b.collision.tool };
  if (b.visibility === false) o.visibility = false;
  return o;
};

/** changes [{ before, after }] -> live world; returns the server's report */
async function apply(changes, owners) {
  const clear = changes.map(({ before }) => { const [lo, hi] = worldBox(before, FIXED); return [0, 1, 2].map(k => (lo[k] + hi[k]) / 2).concat([0, 1, 2].map(k => (hi[k] - lo[k]) / 2 + 1)); });
  const groups = new Map();
  for (const { before, after } of changes) {
    if (!after) continue;
    const o = owners[after.owner ?? before.owner] ?? MAP_OWNER;
    const k = o.id;
    (groups.get(k) ?? groups.set(k, { owner: { id: o.id, name: o.name }, bricks: [] }).get(k)).bricks.push(clean(after));
  }
  return JSON.parse(await ssh(`${NODE} ${TOOLS}/liveedit/apply.mjs`, JSON.stringify({ clear, groups: [...groups.values()] })));
}

const send = (res, code, body, type = 'application/json') => {
  const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const gz = buf.length > 4096;
  res.writeHead(code, { 'content-type': type, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
  res.end(gz ? zlib.gzipSync(buf) : buf);
};
const readBody = req => new Promise((resolve, reject) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch (e) { reject(e); } }); });
const STATIC = { '/': 'liveedit/index.html', '/index.html': 'liveedit/index.html', '/patterns.mjs': 'liveedit/patterns.mjs', '/mapgen/orient.mjs': 'mapgen/orient.mjs', '/mapgen/builder.mjs': 'mapgen/builder.mjs' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (STATIC[url.pathname]) return send(res, 200, fs.readFileSync(path.join(ROOT, STATIC[url.pathname]), 'utf8'), url.pathname.endsWith('.mjs') ? 'text/javascript' : 'text/html');
    if (url.pathname === '/api/players') {
      const r = await job([{ op: 'players' }]);
      return send(res, 200, r.results?.[0] ?? []);
    }
    if (url.pathname === '/api/fetch' && req.method === 'POST') {
      const q = await readBody(req);
      const half = [Math.min(LIMIT.hxy, Math.abs(+q.hx || 200)), Math.min(LIMIT.hxy, Math.abs(+q.hy || 200)), Math.min(LIMIT.hz, Math.abs(+q.hz || 200))].map(Math.round);
      const c = [+q.cx, +q.cy, +q.cz].map(Math.round);
      if (!c.every(Number.isFinite)) return send(res, 400, { error: 'bad centre' });
      const data = JSON.parse(await ssh(`${NODE} ${TOOLS}/liveedit/fetch.mjs ${c.join(' ')} ${half.join(' ')}`));
      if (data.bricks.length > LIMIT.bricks) return send(res, 400, { error: `${data.bricks.length} bricks: too big for the editor, take a smaller box` });
      return send(res, 200, { ...data, box: { center: c, half } });
    }
    if (url.pathname === '/api/deploy' && req.method === 'POST') {
      const q = await readBody(req);
      if (!Array.isArray(q.changes) || !q.changes.length) return send(res, 400, { error: 'no changes' });
      if (q.changes.some(c => c.before?.locked)) return send(res, 400, { error: 'locked bricks in the change set' });
      const report = await apply(q.changes, q.owners ?? []);
      const id = `${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.writeFileSync(path.join(EDITS, id + '.json'), JSON.stringify({ id, label: String(q.label ?? '').slice(0, 120), box: q.box, owners: q.owners, changes: q.changes, report }, null, 0));
      return send(res, 200, { id, report });
    }
    if (url.pathname === '/api/edits') {
      return send(res, 200, fs.readdirSync(EDITS).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 50).map(f => { const e = JSON.parse(fs.readFileSync(path.join(EDITS, f), 'utf8')); return { id: e.id, label: e.label, n: e.changes.length, undone: !!e.undone, box: e.box }; }));
    }
    if (url.pathname === '/api/undo' && req.method === 'POST') {
      const { id } = await readBody(req);
      const f = path.join(EDITS, path.basename(String(id)) + '.json');
      if (!fs.existsSync(f)) return send(res, 404, { error: 'no such edit' });
      const e = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (e.undone) return send(res, 400, { error: 'already undone' });
      // backwards: clear what the edit laid, lay what it replaced (deleted bricks come back)
      const back = e.changes.map(({ before, after }) => ({ before: after ?? before, after: before }));
      const report = await apply(back, e.owners ?? []);
      e.undone = new Date().toISOString(); e.undoReport = report;
      fs.writeFileSync(f, JSON.stringify(e));
      return send(res, 200, { report });
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err.message ?? err) });
  }
}).listen(PORT, () => console.log(`live editor on http://localhost:${PORT}`));
