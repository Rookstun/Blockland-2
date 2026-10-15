// mkdelta.mjs OLD NEW OUT.json: exact per-brick delta between two map dirs for
// bridge/tools/deltadeploy.py (clear = each removed brick's box + 1; adds = new
// bricks + kept bricks a clear box would take with it)
import fs from 'fs'; import { worldBox } from './orient.mjs'; import { FIXED } from './builder.mjs';
const [OLD, NEW, OUT] = process.argv.slice(2);
const read = dir => { const b = [], ext = []; for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f)).sort()) for (const o of JSON.parse(fs.readFileSync(`${dir}/${f}`)).ops) { for (const x of o.bricks || []) b.push(x); if (o.externalAssets && !ext.length) ext.push(...o.externalAssets); } return { b, ext }; };
const o = read(OLD), n = read(NEW);
const key = b => JSON.stringify(b);
const oldK = new Set(o.b.map(key)), newK = new Set(n.b.map(key));
// env BOXES='[[x0,y0,x1,y1],...]' (2026-10-15): only changes whose centre lies in a box
// (ship one feature while other sessions' unshipped generator changes stay out)
const BOXES = process.env.BOXES ? JSON.parse(process.env.BOXES) : null;
const inBox = b => !BOXES || BOXES.some(([x0, y0, x1, y1]) => b.position[0] >= x0 && b.position[0] <= x1 && b.position[1] >= y0 && b.position[1] <= y1);
const removed = o.b.filter(b => !newK.has(key(b)) && inBox(b)), added = n.b.filter(b => !oldK.has(key(b)) && inBox(b));
const clear = removed.map(b => { const [lo, hi] = worldBox(b, FIXED); return [0, 1, 2].map(a => (lo[a] + hi[a]) / 2).concat([0, 1, 2].map(a => (hi[a] - lo[a]) / 2 + 1)); });
// kept bricks entirely inside a clear box are taken with it: re-add them
const G = new Map(), C = 400;
clear.forEach((c, i) => { for (let x = Math.floor((c[0] - c[3]) / C); x <= Math.floor((c[0] + c[3]) / C); x++) for (let y = Math.floor((c[1] - c[4]) / C); y <= Math.floor((c[1] + c[4]) / C); y++) (G.get(x + ',' + y) ?? G.set(x + ',' + y, []).get(x + ',' + y)).push(i); });
const restore = [];
for (const b of n.b) { if (!oldK.has(key(b))) continue; const [lo, hi] = worldBox(b, FIXED);
  const cand = G.get(Math.floor(lo[0] / C) + ',' + Math.floor(lo[1] / C)) ?? [];
  if (cand.some(i => { const c = clear[i]; return [0, 1, 2].every(a => lo[a] >= c[a] - c[a + 3] && hi[a] <= c[a] + c[a + 3]); })) restore.push(b); }
fs.writeFileSync(OUT, JSON.stringify({ clear, add: [...added, ...restore], externalAssets: n.ext.length ? n.ext : o.ext }));
console.log(`removed ${removed.length}, added ${added.length}, restored ${restore.length}, ext ${n.ext.length}`);
