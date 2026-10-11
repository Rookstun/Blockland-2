// Turn segmented builds into !ai part JSON (box parts on the stud x plate grid) + ASCII previews.
import fs from "fs"; import path from "path"; import { pathToFileURL } from "url"; import { createRequire } from "module";
const H = process.env.HOME;
const brs = await import(pathToFileURL(path.join(H, "omegga-server/plugins/bridge/lib/brs.mjs")).href);
const shapes = createRequire(import.meta.url)(path.join(H, "omegga-server/plugins/chatbot/lib/shapes.js"));
const [dir] = process.argv.slice(2); const MIN = +(process.env.MIN ?? 200), MAX = +(process.env.MAX ?? 20000);
const seg = JSON.parse(fs.readFileSync(path.join(dir, "segments.json")));
const r = brs.WorldReader.from(new Uint8Array(fs.readFileSync(seg.src)));
const B = [...r.bricks(1)]; const A = seg.assets, MAT = seg.mats;
const name = a => typeof a === "string" ? a : a?.name ?? a?.asset ?? JSON.stringify(a);
const SKIP = /Flower|Fern|Branch|Grass|Plant|Leaf|Hedge|Bush|Tree/i;
const half = a => /Wedge|Ramp/.test(a) ? (/TriangleCorner|OuterCorner|Corner$/.test(a) && !/Inner/.test(a) ? 0.33 : /Inner/.test(a) ? 0.67 : 0.5) : 1;
const hex = c => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const CV = 400, S = [10, 10, 4];
const owners = r.owners?.() ?? seg.owners; const ownerName = i => { const o = owners[i] ?? owners[i - 1]; return o?.name ?? o?.display_name ?? String(i); };
function encode(b) {
  const o = b.lo.map((v, k) => Math.floor(v / S[k]));
  const cells = new Map(); // key -> [cov, r, g, b, glass, glow, metal]
  for (const i of b.idx) {
    const br = B[i], an = name(A[br.asset_name_index]); if (SKIP.test(an)) continue;
    const e = br.size.some(v => v) ? br.size : [5, 5, 6], wt = half(an);
    const lo = br.position.map((p, k) => p - e[k]), hi = br.position.map((p, k) => p + e[k]);
    const c0 = lo.map((v, k) => Math.floor(v / S[k]) - o[k]), c1 = hi.map((v, k) => Math.ceil(v / S[k]) - 1 - o[k]);
    const m = MAT[br.material_index] ?? "";
    for (let x = c0[0]; x <= c1[0]; x++) { const ox = Math.min(hi[0], (x + o[0] + 1) * 10) - Math.max(lo[0], (x + o[0]) * 10);
      for (let y = c0[1]; y <= c1[1]; y++) { const oy = Math.min(hi[1], (y + o[1] + 1) * 10) - Math.max(lo[1], (y + o[1]) * 10);
        for (let z = c0[2]; z <= c1[2]; z++) { const oz = Math.min(hi[2], (z + o[2] + 1) * 4) - Math.max(lo[2], (z + o[2]) * 4);
          const v = ox * oy * oz * wt; if (v <= 0) continue; const k = (x * 4096 + y) * 4096 + z;
          let c = cells.get(k); if (!c) cells.set(k, c = [0, 0, 0, 0, 0, 0, 0]);
          c[0] += v; c[1] += v * br.color[0]; c[2] += v * br.color[1]; c[3] += v * br.color[2];
          if (/Glass|Translucent/.test(m)) c[4] += v; else if (/Glow/.test(m)) c[5] += v; else if (/Metal/.test(m)) c[6] += v; } } } }
  const filled = [];
  for (const [k, c] of cells) if (c[0] >= CV * 0.45) filled.push([Math.floor(k / 4096 / 4096), Math.floor(k / 4096) % 4096, k % 4096, c[1] / c[0], c[2] / c[0], c[3] / c[0], c[4] > c[0] / 2 ? "glass" : c[5] > c[0] / 2 ? "glow" : c[6] > c[0] / 2 ? "metal" : ""]);
  if (!filled.length) return null;
  // palette: k-means (k <= 10) seeded from the most common coarse colours
  const bins = new Map(); for (const f of filled) { const q = f.slice(3, 6).map(v => v >> 5).join(); bins.set(q, (bins.get(q) || 0) + 1); }
  let P = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q]) => q.split(",").map(v => v * 32 + 16));
  const near = f => { let bi = 0, bd = 1e9; P.forEach((p, i) => { const d = (p[0] - f[3]) ** 2 + (p[1] - f[4]) ** 2 + (p[2] - f[5]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  for (let it = 0; it < 6; it++) { const s = P.map(() => [0, 0, 0, 0]); for (const f of filled) { const a = s[near(f)]; a[0] += f[3]; a[1] += f[4]; a[2] += f[5]; a[3]++; } P = s.filter(a => a[3]).map(a => [a[0] / a[3], a[1] / a[3], a[2] / a[3]]); }
  const vox = new Map(), styles = new Map();
  for (const f of filled) { const key = `${hex(P[near(f)])}|${f[6]}|`; if (!styles.has(key)) styles.set(key, { color: key.split("|")[0], material: f[6] || undefined }); vox.set(`${f[0]},${f[1]},${f[2]}`, key); }
  const boxes = merge(vox, styles);
  return { boxes, voxels: filled.length };
}
function merge(vox, styles) { // greedy x, y, z like shapes.js but uncapped run lengths
  const out = [], used = new Set(), at = (i, j, k) => vox.get(`${i},${j},${k}`), free = (i, j, k, s) => at(i, j, k) === s && !used.has(`${i},${j},${k}`);
  const keys = [...vox.keys()].map(k => k.split(",").map(Number)).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, z] of keys) { if (used.has(`${x},${y},${z}`)) continue; const s = at(x, y, z);
    let w = 1; while (free(x + w, y, z, s)) w++;
    let l = 1; rowY: for (;;) { for (let a = 0; a < w; a++) if (!free(x + a, y + l, z, s)) break rowY; l++; }
    let h = 1; up: for (;;) { for (let a = 0; a < w; a++) for (let c = 0; c < l; c++) if (!free(x + a, y + c, z + h, s)) break up; h++; }
    for (let a = 0; a < w; a++) for (let c = 0; c < l; c++) for (let d = 0; d < h; d++) used.add(`${x + a},${y + c},${z + d}`);
    out.push({ type: "box", x, y, z, w, l, h, ...styles.get(s) }); }
  for (const b of out) if (!b.material) delete b.material;
  return out; }
const out = fs.createWriteStream(path.join(dir, "builds.jsonl")); let n = 0; const sizes = [];
seg.builds.forEach((b, id) => {
  if (b.n < MIN || b.n > MAX) return; const dd = b.hi.map((v, k) => (v - b.lo[k]) / S[k]); if (dd[0] * dd[1] * dd[2] > 3e6) return; const e = encode(b); if (!e || e.boxes.length < 3) return;
  const dim = b.hi.map((v, k) => Math.round((v - b.lo[k]) / S[k]));
  const rec = { id, owner: ownerName(b.owner), bricks: b.n, at: b.lo, dim, parts: e.boxes.length, chars: JSON.stringify(e.boxes).length, boxes: e.boxes };
  rec.preview = shapes.preview(e.boxes.map(x => ({ ...x }))); out.write(JSON.stringify(rec) + "\n"); n++; sizes.push(rec.parts); });
out.end(); sizes.sort((a, b) => a - b);
console.error("encoded", n, "parts p10/50/90", sizes[n * .1 | 0], sizes[n * .5 | 0], sizes[n * .9 | 0], "<=150 parts:", sizes.filter(s => s <= 150).length);
