// match live extras (comps.json from xscan) against a map dir's extras lists: node xmatch.mjs comps.json TGTDIR out.json
import fs from 'fs';
const [CF, T, OUT] = process.argv.slice(2);
const L = n => { try { return JSON.parse(fs.readFileSync(T + '/' + n + '.json')); } catch { return []; } };
const shops = L('shops'), lists = {
  spawn: [...L('spawners'), ...L('npcs')], stand: shops.filter(e => e.prefab !== 'vending'), vend: shops.filter(e => e.prefab === 'vending'),
  gem: L('gems'), pot: L('pots'), bush: L('bushes'), casino: L('casino'),
};
const kindOf = ([t, o, a]) => t === 'BotSpawn' ? 'spawn' : t === 'ItemSpawn' && /Octo/.test(a) ? 'stand' : t === 'Target' && a === 'B_Bush' ? 'bush'
  : t === 'Target' && a === 'PB_DefaultMicroBrick' ? 'gempot' : t === 'Button' && o === '-=[sandro]=-' ? 'vend' : null;
const tol = { spawn: [40, -12, 70], stand: [30, -40, 40], bush: [25, -20, 20], vend: [45, -60, 60], gem: [30, -10, 70], pot: [25, -10, 40], casino: [80, -20, 80] };
const near = (k, p) => (lists[k] ?? []).some(e => { const [dxy, z0, z1] = tol[k]; const dz = p[2] - e.at[2]; return Math.hypot(p[0] - e.at[0], p[1] - e.at[1]) < dxy && dz >= z0 && dz <= z1; });
const c = JSON.parse(fs.readFileSync(CF)), stray = [], cnt = {};
for (const e of c) {
  if (e[3][2] > 7000 || (e[1] !== 'abysmal garbage' && e[1] !== '-=[sandro]=-')) continue;
  const k = kindOf(e); if (!k) continue;
  const ok = k === 'gempot' ? near('gem', e[3]) || near('pot', e[3]) : near(k, e[3]) || near('casino', e[3]);
  // sandro's original machine
  if (k === 'vend' && Math.hypot(e[3][0] - 165, e[3][1] + 2076) < 50) { cnt['vend orig'] = (cnt['vend orig'] ?? 0) + 1; continue; }
  cnt[k + (ok ? ' ok' : ' STRAY')] = (cnt[k + (ok ? ' ok' : ' STRAY')] ?? 0) + 1;
  if (!ok) stray.push([k, ...e]);
}
console.log(cnt);
for (const s of stray) console.log(JSON.stringify(s));
// missing: target entries with no live extra near
const live = k => c.filter(e => kindOf(e) === k || (k === 'gem' || k === 'pot') && kindOf(e) === 'gempot');
for (const k of ['spawn', 'stand', 'bush', 'gem', 'pot', 'vend']) {
  const lv = live(k), [dxy, z0, z1] = tol[k];
  const miss = lists[k].filter(e => !lv.some(x => Math.hypot(x[3][0] - e.at[0], x[3][1] - e.at[1]) < dxy && x[3][2] - e.at[2] >= z0 && x[3][2] - e.at[2] <= z1));
  console.log('missing', k, miss.length, JSON.stringify(miss.slice(0, 6).map(e => e.at)));
}
fs.writeFileSync(OUT, JSON.stringify(stray));
