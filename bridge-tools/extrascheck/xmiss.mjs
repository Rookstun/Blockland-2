// write NEWDIR/{spawners,shops,bushes,gems}.json = target entries with no live extra near (comps.json from xscan); sodas skipped (removed on purpose 2026-10-21)
import fs from 'fs';
const [CF, T, OUT] = process.argv.slice(2);
const L = n => { try { return JSON.parse(fs.readFileSync(T + '/' + n + '.json')); } catch { return []; } };
const c = JSON.parse(fs.readFileSync(CF));
const lv = f => c.filter(f).map(e => e[3]);
const sets = {
  spawners: [L('spawners'), lv(e => e[0] === 'BotSpawn'), [40, -12, 70]],
  shops: [L('shops').filter(e => e.prefab !== 'vending' && !/^soda_/.test(e.prefab ?? '')), lv(e => e[0] === 'ItemSpawn'), [30, -40, 40]],
  bushes: [L('bushes'), lv(e => e[0] === 'Target' && e[2] === 'B_Bush'), [25, -20, 20]],
  gems: [L('gems'), lv(e => e[0] === 'Target' && e[2] === 'PB_DefaultMicroBrick'), [30, -10, 70]],
};
fs.mkdirSync(OUT, { recursive: true });
for (const [n, [t, live, [d, z0, z1]]] of Object.entries(sets)) {
  const miss = t.filter(e => !live.some(p => Math.hypot(p[0] - e.at[0], p[1] - e.at[1]) < d && p[2] - e.at[2] >= z0 && p[2] - e.at[2] <= z1));
  fs.writeFileSync(`${OUT}/${n}.json`, JSON.stringify(miss)); console.log(n, miss.length);
}
