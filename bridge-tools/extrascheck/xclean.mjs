// bricks of stray extras: live bricks near each stray (same owner) that are not in the target build -> exact ClearRegion boxes
// node xclean.mjs world.brdb stray.json TGT_CHUNK_DIR out_clears.json
import fs from 'fs'; import path from 'path'; import { DatabaseSync } from 'node:sqlite';
const m = await import(process.env.HOME + '/omegga-server/plugins/media/lib/brs4.mjs');
const [W, SF, TD, OUT] = process.argv.slice(2);
const r = v => Math.round(v);
const key = (a, p, s, c) => `${a}|${p.map(r)}|${a.startsWith('PB_') ? (s ?? []).map(r) : ''}|${(c ?? []).slice(0, 3).map(r)}`;
const tgt = new Set();
for (const f of fs.readdirSync(TD).filter(f => /^chunk_\d+\.json$/.test(f))) for (const o of JSON.parse(fs.readFileSync(path.join(TD, f))).ops) for (const b of o.bricks || []) tgt.add(key(b.asset ?? 'PB_DefaultBrick', b.position, b.size, b.color));
const KEEP_VEND = [[1111, -561], [688, 326]]; // sandro's own copies, not in any map list
const strays = JSON.parse(fs.readFileSync(SF)).filter(s => !(s[0] === 'vend' && KEEP_VEND.some(([x, y]) => Math.hypot(s[4][0] - x, s[4][1] - y) < 20)) && !(s[0] === 'vend' && s[4][0] === 707));
// non-procedural bricks read back with no size: clear boxes per asset (half extents + 1)
const BOX = { B_Bot_Spawn_Point: [25, 25, 8], B_Bush: [18, 18, 28], B_2x2F_Octo_Converter: [11, 11, 3], B_2x2_Round: [11, 11, 7], B_Button_Square: [6, 6, 6] };
const T = n => { try { return JSON.parse(fs.readFileSync(path.join(process.argv[6] ?? '.', n + '.json'))); } catch { return []; } };
const GOOD = ['spawners', 'npcs', 'shops', 'gems', 'bushes'].flatMap(T).map(e => e.at);
const R = { stand: [28, -40, 60], gempot: [22, -40, 70], spawn: [26, -16, 16], bush: [30, -30, 70], vend: [30, -70, 70] };
const wr = new m.WorldReader(new m.Brdb(new DatabaseSync(W, { readOnly: true })));
const A = wr.brickAssets(), names = wr.owners().UserNames;
const hit = new Map(), per = strays.map(() => 0);
for (const ci of wr.brickChunkIndex(1)) {
  let bricks; try { bricks = [...m.WorldReader.prototype.bricks.call({ globalData: () => wr.globalData(), brickChunkIndex: () => [ci], brickChunkSoa: (e, i) => wr.brickChunkSoa(e, i) }, 1)]; } catch { continue; }
  for (const b of bricks) {
    const p = b.position, on = names[b.owner_index];
    strays.forEach((s, i) => {
      const [dxy, z0, z1] = R[s[0]], q = s[4];
      if (on !== s[2] || Math.abs(p[0] - q[0]) > dxy || Math.abs(p[1] - q[1]) > dxy || p[2] - q[2] < z0 || p[2] - q[2] > z1) return;
      const a = A[b.asset_name_index]?.name ?? A[b.asset_name_index];
      if (tgt.has(key(a, p, b.size, b.color))) return;
      if (GOOD.some(g => Math.hypot(p[0] - g[0], p[1] - g[1]) < 22 && Math.abs(p[2] - g[2]) < 70)) return;
      const k = p.join(',');
      if (!hit.has(k)) { hit.set(k, [...p.map(r), ...(a.startsWith('PB_') ? (q => [q, q, q])(Math.max(...b.size.map(r)) + 1) : BOX[a] ?? [6, 6, 7]), a]); per[i]++; }
    });
  }
}
strays.forEach((s, i) => console.log(per[i], s[0], s[3], s[4].join(','), s[5]));
const out = [...hit.values()];
const byA = {}; for (const h of out) byA[h[6]] = (byA[h[6]] ?? 0) + 1; console.log(byA);
fs.writeFileSync(OUT, JSON.stringify(out)); console.log('clears', out.length, 'strays', strays.length);
