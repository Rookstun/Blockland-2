// node mapgen/mkstale.mjs TARGET OUT.json OLDDIR... (2026-10-21): every brick of the OLD builds that the TARGET
// build doesn't have, as [key, clearBox] for the server's fixworld.mjs (key = asset|pos|size (procedural)|rgb)
import fs from 'fs'; import { worldBox } from './orient.mjs'; import { FIXED } from './builder.mjs';
const [TGT, OUT, ...OLD] = process.argv.slice(2);
const r = Math.round;
const key = b => { const a = b.asset ?? 'PB_DefaultBrick'; return `${a}|${b.position.map(r)}|${a.startsWith('PB_') ? (b.size ?? []).map(r) : ''}|${(b.color ?? []).slice(0, 3).map(r)}`; };
const each = (dir, f) => { for (const c of fs.readdirSync(dir).filter(c => /^chunk_\d+\.json$/.test(c))) for (const o of JSON.parse(fs.readFileSync(`${dir}/${c}`)).ops) for (const b of o.bricks || []) f(b); };
const T = new Set(); each(TGT, b => T.add(key(b)));
const out = new Map();
for (const d of OLD) each(d, b => { const k = key(b); if (T.has(k) || out.has(k)) return; const [lo, hi] = worldBox(b, FIXED); out.set(k, [0, 1, 2].map(a => (lo[a] + hi[a]) / 2).concat([0, 1, 2].map(a => (hi[a] - lo[a]) / 2 + 1))); });
fs.writeFileSync(OUT, JSON.stringify([...out]));
console.log('target', T.size, 'stale candidates', out.size);
