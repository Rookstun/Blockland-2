// node mapgen/composite.mjs BASE NEW OUT CX CY R
// A build made of NEW inside the disc (world CX,CY radius R, by brick / extra centre) and BASE everywhere else:
// regenerate one region of a live map without the rest of it moving (2026-10-21, owner on the snow range:
// "nuke it regenerate it all"; a heightmap change there re-rolled sites map-wide). Chunks + extras jsons.
import fs from 'fs';
const [BASE, NEW, OUT, cx, cy, r] = process.argv.slice(2);
const inside = p => Math.hypot(p[0] - cx, p[1] - cy) < +r;
fs.mkdirSync(OUT, { recursive: true });
let ext = null;
const pick = (dir, keep) => {
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => /^chunk_\d+\.json$/.test(f)))
    for (const o of JSON.parse(fs.readFileSync(dir + '/' + f)).ops) {
      if (!o.bricks) continue;
      ext ??= o.externalAssets;
      for (const b of o.bricks) if (keep(b.position)) out.push(b);
    }
  return out;
};
const bricks = [...pick(BASE, p => !inside(p)), ...pick(NEW, inside)];
const CH = 20000;
for (let i = 0, n = 0; i < bricks.length; i += CH, n++)
  fs.writeFileSync(`${OUT}/chunk_${String(n).padStart(3, '0')}.json`, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], captureMs: 1500, ...(ext ? { externalAssets: ext } : {}), bricks: bricks.slice(i, i + CH) }] }));
for (const f of fs.readdirSync(BASE).filter(f => f.endsWith('.json') && !/^chunk_/.test(f) && f !== 'pipeline.json')) {
  const a = JSON.parse(fs.readFileSync(`${BASE}/${f}`));
  let b = []; try { b = JSON.parse(fs.readFileSync(`${NEW}/${f}`)); } catch {}
  if (!Array.isArray(a) || !a.every(e => Array.isArray(e?.at))) { fs.writeFileSync(`${OUT}/${f}`, JSON.stringify(a)); continue; }
  fs.writeFileSync(`${OUT}/${f}`, JSON.stringify([...a.filter(e => !inside(e.at)), ...(Array.isArray(b) ? b.filter(e => inside(e.at)) : [])]));
}
console.log(bricks.length, 'bricks ->', OUT);
