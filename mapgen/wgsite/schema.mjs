// The site's settings schema, read straight from mapgen.mjs: every
// tune('key', default, 'note') call (default evaluated at a given scale K),
// with its line number and the preview stage that first reaches it.

import fs from 'fs';

// tune() keys built in loops (mapgen holy section): [key, default, note]
const LOOP_KEYS = [
  ...[['tavern', 2], ['warehouse', 2], ['chapel', 2], ['library', 1], ['dininghall', 1]].map(([k, n]) => [`roadside.${k}`, n, `${k}s standing alone by the roads`]),
  ...['armory', 'gunsmith'].map(k => [`wshop.${k}`, 3, `${k}s (weapon shops) by the roads`]),
  ...[['cottage', 14], ['townhouse', 10]].map(([k, n]) => [`roadside.${k}`, n, `lone ${k}s (HOUSE_TYPES) by the roads`]),
  ['roadside.splitlevel', 8, 'split-level ranch houses by the roads'],
  ['roadside.dutchcolonial', 6, 'Dutch Colonial houses (gambrel, porch, garage) by the roads'],
];

// split at the first top-level comma
function splitArg(s, i) {
  let depth = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (!depth) return j; depth--; }
    else if (c === ',' && !depth) return j;
  }
  return -1;
}

export function readSchema(file, K = 1) {
  const src = fs.readFileSync(file, 'utf8');
  const lineAt = []; // char offset -> line
  let line = 1;
  for (let i = 0; i < src.length; i++) { lineAt[i] = line; if (src[i] === '\n') line++; }
  const heightEnd = src.indexOf("if (PREVIEW && args.includes('--preview-height'))");
  const sitesEnd = src.indexOf("if (PREVIEW && !PREVIEW_FULL)");
  const out = {};
  const re = /\btune\('([A-Za-z0-9_.]+)',/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[1];
    if (out[key]) continue;
    const a = m.index + m[0].length, b = splitArg(src, a);
    if (b < 0) continue;
    const expr = src.slice(a, b).trim();
    let note = '';
    if (src[b] === ',') {
      const c = splitArg(src, b + 1);
      const n = src.slice(b + 1, c < 0 ? undefined : c).trim();
      if (/^'.*'$/s.test(n)) note = n.slice(1, -1).replace(/\\'/g, "'");
    }
    let def;
    try { def = new Function('K', `return (${expr});`)(K); } catch { continue; }
    out[key] = { def, expr, note, line: lineAt[m.index], stage: m.index < heightEnd ? 'height' : m.index < sitesEnd ? 'sites' : 'full' };
  }
  const hol = src.indexOf("tune('roadside.'");
  for (const [key, def, note] of LOOP_KEYS) out[key] = { def, expr: String(def), note, line: hol > 0 ? lineAt[hol] : 0, stage: 'sites' };
  return out;
}
