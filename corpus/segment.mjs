// Split a world .brz into builds: per owner, union bricks whose boxes touch (GAP units slack).
import fs from "fs"; import path from "path"; import { pathToFileURL } from "url";
const brs = await import(pathToFileURL(path.join(process.env.HOME, "omegga-server/plugins/bridge/lib/brs.mjs")).href);
const [src, outDir] = process.argv.slice(2); const GAP = +(process.env.GAP ?? 2), CELL = 80;
const r = brs.WorldReader.from(new Uint8Array(fs.readFileSync(src)));
const assets = r.brickAssets(), mats = r.materials(), owners = r.owners();
const B = [...r.bricks(1)]; const N = B.length; console.error("bricks", N);
const lo = new Int32Array(N * 3), hi = new Int32Array(N * 3);
B.forEach((b, i) => { const e = b.size.some(v => v) ? b.size : [5, 5, 6];
  for (let k = 0; k < 3; k++) { lo[i*3+k] = b.position[k] - e[k]; hi[i*3+k] = b.position[k] + e[k]; } });
const par = new Int32Array(N).map((_, i) => i);
const find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
const touch = (a, b) => { for (let k = 0; k < 3; k++) if (lo[a*3+k] > hi[b*3+k] + GAP || lo[b*3+k] > hi[a*3+k] + GAP) return false; return true; };
const grid = new Map();
for (let i = 0; i < N; i++) {
  const o = B[i].owner_index, c0 = [], c1 = [];
  for (let k = 0; k < 3; k++) { c0[k] = Math.floor((lo[i*3+k] - GAP) / CELL); c1[k] = Math.floor((hi[i*3+k] + GAP) / CELL); }
  const span = (c1[0]-c0[0]+1)*(c1[1]-c0[1]+1)*(c1[2]-c0[2]+1); if (span > 4096) { console.error("huge brick", i, B[i].size); }
  for (let x = c0[0]; x <= c1[0]; x++) for (let y = c0[1]; y <= c1[1]; y++) for (let z = c0[2]; z <= c1[2]; z++) {
    const key = `${o},${x},${y},${z}`; let l = grid.get(key); if (!l) grid.set(key, l = []);
    for (const j of l) if (touch(i, j)) { const a = find(i), b = find(j); if (a !== b) par[a] = b; }
    l.push(i); } }
const groups = new Map(); for (let i = 0; i < N; i++) { const g = find(i); let l = groups.get(g); if (!l) groups.set(g, l = []); l.push(i); }
const builds = [];
for (const l of groups.values()) { const bl = [1e9,1e9,1e9], bh = [-1e9,-1e9,-1e9];
  for (const i of l) for (let k = 0; k < 3; k++) { bl[k] = Math.min(bl[k], lo[i*3+k]); bh[k] = Math.max(bh[k], hi[i*3+k]); }
  builds.push({ owner: B[l[0]].owner_index, n: l.length, lo: bl, hi: bh, idx: l }); }
builds.sort((a, b) => b.n - a.n);
const hist = {}; for (const b of builds) { const k = b.n < 20 ? "<20" : b.n < 200 ? "20-199" : b.n < 2000 ? "200-1999" : b.n < 20000 ? "2k-20k" : "20k+"; hist[k] = (hist[k] || 0) + 1; }
console.error("builds", builds.length, hist);
console.error("top", builds.slice(0, 12).map(b => [b.owner, b.n, b.hi.map((v, k) => Math.round((v - b.lo[k]) / 10))]));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "segments.json"), JSON.stringify({ src, assets, mats, owners, builds: builds.filter(b => b.n >= 20) }));
