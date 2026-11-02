// Wallpaper test for template houses (2026-11-02, owner in chat: "write a wallpaper unit test"). Slices each storey at
// two heights (the wainscot band and the paper band) on a 1-unit grid: every wall-core cell (F? wall / wall core /
// diagonal / notch) whose neighbour is indoor air (a floor brick top at the storey floor and a ceiling over it) is a
// bare plaster face = FAIL (spots summed per 20x20 area, with the wall's label). Windows, doors and glass are openings,
// not faces. 2026-11-02 longbrooke: F1 2786 units (792 in the unpapered garage, the rest = gaps where finishRoom's
// room rectangles stop short of a wall + every diagonal / notch face), F2 1362.
//   node mapgen/papertest.mjs longbrooke [brynwood whitetail ...]      exit 1 on any bare face
import { worldBox } from './orient.mjs';

const CORE = /^F\d (wall|wall core|diagonal|notch)$/, FINISH = /^(base|wall wains|wains|rail|wall paper|paper|crown|casing|casing head|stool)$/;

export function papertest(bricks, storeys) {
  const B = bricks.map(b => ({ label: b.label ?? '', box: worldBox({ ...b, asset: b.asset ?? 'PB_DefaultBrick' }) }));
  const out = [];
  for (const { name, floor, ceiling } of storeys) {
    const xs = B.map(b => b.box[0][0]), ys = B.map(b => b.box[0][1]);
    const X0 = Math.floor(Math.min(...xs)) - 4, Y0 = Math.floor(Math.min(...ys)) - 4;
    const W = Math.ceil(Math.max(...B.map(b => b.box[1][0])) - X0) + 8, D = Math.ceil(Math.max(...B.map(b => b.box[1][1])) - Y0) + 8;
    // indoor = a floor top at the storey floor (+-1) and something overhead at the ceiling (+-6)
    const fl = new Uint8Array(W * D), ce = new Uint8Array(W * D);
    const paint = (arr, [lo, hi]) => { for (let j = Math.floor(lo[1] - Y0); j < Math.ceil(hi[1] - Y0); j++) for (let i = Math.floor(lo[0] - X0); i < Math.ceil(hi[0] - X0); i++) arr[j * W + i] = 1; };
    for (const b of B) { if (Math.abs(b.box[1][2] - floor) <= 1) paint(fl, b.box); if (b.box[0][2] >= ceiling - 6 && b.box[0][2] <= ceiling + 6) paint(ce, b.box); }
    const bare = new Map(), bands = {};
    for (const z of [floor + 16, floor + 50]) {
      const kind = new Uint8Array(W * D), labelAt = [];          // 0 air, 1 core, 2 finish / opening / other
      for (const b of B) {
        const [lo, hi] = b.box;
        if (lo[2] > z || hi[2] <= z) continue;
        const k = CORE.test(b.label) ? 1 : 2;
        for (let j = Math.floor(lo[1] - Y0); j < Math.ceil(hi[1] - Y0); j++) for (let i = Math.floor(lo[0] - X0); i < Math.ceil(hi[0] - X0); i++) if (k === 2 || !kind[j * W + i]) { kind[j * W + i] = k; labelAt[j * W + i] = b.label; }
      }
      for (let j = 1; j < D - 1; j++) for (let i = 1; i < W - 1; i++) {
        if (kind[j * W + i] !== 1) continue;
        for (const d of [1, -1, W, -W]) {
          const q = j * W + i + d;
          if (!kind[q] && fl[q] && ce[q]) { const key = `${Math.floor((i + X0) / 20) * 20},${Math.floor((j + Y0) / 20) * 20} ${labelAt[j * W + i]}`; bare.set(key, (bare.get(key) ?? 0) + 1); }
        }
      }
    }
    for (const b of B) if (FINISH.test(b.label) && b.box[0][2] >= floor - 1 && b.box[1][2] <= ceiling + 1) (bands[b.label] ??= new Set()).add(`${Math.round(b.box[0][2] - floor)}..${Math.round(b.box[1][2] - floor)}`);
    out.push({ name, bareUnits: [...bare.values()].reduce((s, v) => s + v, 0), spots: [...bare.entries()].sort((a, b) => b[1] - a[1]), bands: Object.fromEntries(Object.entries(bands).map(([k, v]) => [k, [...v]])) });
  }
  return out;
}

if (process.argv[1]?.endsWith('papertest.mjs')) {
  process.env.LABELS = '1';
  let bad = 0;
  for (const name of process.argv.slice(2)) {
    const mod = await import(`./${name}.mjs`), h = mod[name]();
    // storeys: from the module's LONGBROOKE-style config when exported, else brynwood's defaults
    const cfg = Object.values(mod).find(v => v && v.z && v.grid);
    const [FL1, TOP1, FL2, TOP2] = cfg?.z ?? [40, 170, 180, 290];
    for (const r of papertest(h.bricks, [{ name: 'F1', floor: FL1, ceiling: TOP1 - 4 }, { name: 'F2', floor: FL2, ceiling: TOP2 - 4 }])) {
      const ok = r.bareUnits === 0;
      if (!ok) bad++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${r.name}: ${r.bareUnits} units of bare wall face${ok ? '' : ' at ' + r.spots.slice(0, 8).map(([k, v]) => `(${k}) ${v}`).join(', ')}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
