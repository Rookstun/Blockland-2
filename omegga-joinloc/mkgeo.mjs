// Builds the compact IPv4 table the joinloc plugin reads, from DB-IP "IP to City Lite" (CC BY 4.0, db-ip.com).
//   node mkgeo.mjs dbip-city-lite-YYYY-MM.csv.gz  ->  geo.json (location strings) + geo.bin (u32 starts, ends, loc index)
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';
const src = process.argv[2], outDir = process.argv[3] ?? '.';
const names = new Intl.DisplayNames('en', { type: 'region' });
const split = line => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const ip4 = s => s.split('.').reduce((a, b) => a * 256 + +b, 0);
const locs = [], locIdx = new Map(), S = [], E = [], L = [];
const rl = readline.createInterface({ input: fs.createReadStream(src).pipe(zlib.createGunzip()) });
for await (const line of rl) {
  if (line.includes(':')) continue;                       // IPv6
  const [a, b, , cc, , city] = split(line);
  if (!a || !/^\d+\.\d+\.\d+\.\d+$/.test(a)) continue;
  let country = cc; try { country = names.of(cc) ?? cc; } catch {}
  const loc = city ? `${city}, ${cc}` : country;           // "New York, US" or just the country
  let i = locIdx.get(loc); if (i === undefined) { i = locs.length; locs.push(loc); locIdx.set(loc, i); }
  S.push(ip4(a)); E.push(ip4(b)); L.push(i);
}
fs.writeFileSync(`${outDir}/geo.json`, JSON.stringify({ n: S.length, locs }));
fs.writeFileSync(`${outDir}/geo.bin`, Buffer.concat([Uint32Array.from(S), Uint32Array.from(E), Uint32Array.from(L)].map(a => Buffer.from(a.buffer))));
console.log(`${S.length} ranges, ${locs.length} places`);
