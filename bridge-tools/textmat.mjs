// Shop-stand text material (owner 2026-10-19: "the shop button text uses graffiti which doesnt work so use
// plastic"): every Component_TextDisplay in the given prefabs gets Material 2 = Plastic (EBRTextMaterial, read
// from the server binary's enum table: Unlit 0, Graffiti 1, Plastic 2, Metallic 3, Glow 4, TranslucentPlastic 5,
// Glass 6). Same read / re-encode / read-back check as shopgen.mjs; originals copied to Saved/textmat_pre/.
//   node textmat.mjs [glob-ish prefix list]   default: shop_ bow_ gun_ soda_ prefabs
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const brs = await import(pathToFileURL(path.join(process.env.HOME, 'omegga-server/plugins/bridge/lib/brs.mjs')).href);
const PREFABS = path.join(process.env.HOME, 'omegga-server/data/Saved/Prefabs');
const BACKUP = path.join(process.env.HOME, 'omegga-server/data/Saved/textmat_pre');
const PREFIX = process.argv.length > 2 ? process.argv.slice(2) : ['shop_', 'bow_', 'gun_', 'soda_'];
const PLASTIC = 2;
fs.mkdirSync(BACKUP, { recursive: true });

const J = v => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : typeof x === 'number' && !Number.isInteger(x) ? Number(x.toPrecision(6)) : x));
function bundle(files) {
  const root = new Map();
  for (const [p, content] of files) {
    const parts = p.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) { if (!node.has(dir)) node.set(dir, new Map()); node = node.get(dir); }
    node.set(parts.at(-1), content);
  }
  const toNodes = m => [...m].map(([name, v]) => [name, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}

let done = 0, same = 0, failed = 0;
for (const name of fs.readdirSync(PREFABS).filter(f => f.endsWith('.brz') && PREFIX.some(p => f.startsWith(p))).sort()) {
  try {
    const src = fs.readFileSync(path.join(PREFABS, name));
    const reader = brs.WorldReader.from(src);
    const paths = reader.fs.listPaths();
    const schema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
    const comps = paths.map(p => p.match(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/)).filter(Boolean)
      .map(m => ({ path: m[0], grid: Number(m[1]), chunk: { x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) } }));
    const files = new Map(paths.map(p => [p, reader.fs.readFile(p)]));
    const expected = new Map();
    let n = 0;
    for (const f of comps) {
      const chunk = reader.componentChunk(f.grid, f.chunk);
      const copy = { soa: chunk.soa, components: chunk.components.map(c => ({ ...c, data: c.data && structuredClone(c.data) })) };
      let touched = false;
      for (const c of copy.components) if (c.typeName === 'Component_TextDisplay' && c.data && Number(c.data.Material) !== PLASTIC) {
        c.data.Material = typeof c.data.Material === 'bigint' ? BigInt(PLASTIC) : PLASTIC; touched = true; n++;
      }
      if (!touched) continue;
      const parts = [schema.encode('BRSavedComponentChunkSoA', copy.soa)];
      for (const c of copy.components) if (c.structName) parts.push(schema.encode(c.structName, c.data));
      files.set(f.path, new Uint8Array(Buffer.concat(parts.map(p => Buffer.from(p)))));
      expected.set(f.path, J(copy.components.map(c => c.data)));
    }
    if (!n) { same++; continue; }
    const out = bundle(files);
    const check = brs.WorldReader.from(Buffer.from(out));
    for (const f of comps) {
      if (!expected.has(f.path)) continue;
      const got = check.componentChunk(f.grid, f.chunk).components.map(c => J(c.data));
      const want = JSON.parse(expected.get(f.path)).map(d => J(d));
      if (got.some((g, i) => g !== want[i])) throw new Error(`${f.path} reads back different`);
    }
    if (!fs.existsSync(path.join(BACKUP, name))) fs.copyFileSync(path.join(PREFABS, name), path.join(BACKUP, name));
    fs.writeFileSync(path.join(PREFABS, name), out);
    done++;
    console.log(`${name}: ${n} text displays -> plastic`);
  } catch (e) { failed++; console.log(`${name}: SKIPPED ${e.message.slice(0, 120)}`); }
}
console.log(`textmat: ${done} patched, ${same} already plastic / no text, ${failed} skipped`);
