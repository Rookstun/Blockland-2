// patch_brs4.mjs: lets the brs-js 4 writer emit component types newer than its bundled schema (the current
// wirescript compiler uses gates brs4 doesn't know, e.g. Exec_ArrayVar_Join). Idempotent.
//   node tools/patch_brs4.mjs [tools/brs4/dist.mjs]
// After it: globalThis.__brs4_componentDb (type -> struct name map, add entries) and
// globalThis.__brs4_extraSchemas (array of schemas, e.g. WorldReader.schema(...); missing structs are taken from them).
import fs from 'node:fs';
const file = process.argv[2] ?? new URL('./brs4/dist.mjs', import.meta.url);
let s = fs.readFileSync(file, 'utf8');
if (s.includes('__brs4_componentDb')) { console.log('already patched'); process.exit(0); } // re-copy dist.mjs to re-patch
const a = '//#region src/brdb/componentDb.ts\nvar aa = /* @__PURE__ */ new Map([';
if (!s.includes(a)) throw new Error('componentDb anchor not found');
s = s.replace(a, '//#region src/brdb/componentDb.ts\nvar aa = globalThis.__brs4_componentDb = /* @__PURE__ */ new Map([');
const b = '\t\tg.merge(t.extractStructsTransitive(e)), g.setFormat(t.format());';
if (!s.includes(b)) throw new Error('schema merge anchor not found');
// the game reads dynamic container element types by index into ITS order of the types table: keep the source file's order
s = s.replace(b, b + '\n\t\tfor (const x of globalThis.__brs4_extraSchemas ?? []) g.merge(x.extractStructsTransitive(e.filter((n) => !g.structs.has(n))));'
  + '\n\t\t{ const src = globalThis.__brs4_extraSchemas?.[0]; if (src?.types?.length) { const rest = g.types.filter((t) => !src.types.includes(t)); g.types.splice(0, g.types.length, ...src.types, ...rest); g.flatLayouts.clear(); } }');
fs.writeFileSync(file, s);
console.log('patched', String(file));
