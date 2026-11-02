// 11214 Longbrooke Dr, Riverview FL 33579 (2026-11-01, руся in chat: 'a simpler house ... i will work with you to make
// it good'). 1995 two-storey Florida stucco house, 3,060 sq ft, 5 bed / 2.5 bath, two-storey foyer with an arched
// window, 2-car garage, back lanai. Plan = Zillow 3D tour blueprint (view-imx 8ca6df9a...), refs/longbrooke_bp.json;
// Floor 2 fitted on the walls at -230,-80 cm. Same raster + trapezoid/wedge mesher as brynwood.mjs.
//   longbrooke() -> { bricks, dropped, stats }      node mapgen/longbrooke.mjs [job.json] [--at X,Y]
import fs from 'fs';
import { makeBuilder, rng } from './builder.mjs';
import { N, NX, NY, T, cx, cy, eachCell, chamfer, shade, finLabel, finMat, plan, newPlan, makeMesher, STUCCO } from './brynwood.mjs';

const BP = JSON.parse(fs.readFileSync(new URL('./refs/longbrooke_bp.json', import.meta.url)));
const FL1 = 40, TOP1 = 140, FL2 = 150, TOP2 = 250;   // 10 ft / 10 ft storeys
const GLASS = { color: [176, 212, 228], material: 'BMC_Glass' }, IRON = [58, 44, 36], WHITE = [244, 240, 232];
const ROOF = [[96, 92, 88], [86, 82, 78], [104, 100, 94]];  // dimensional shingle greys

export function longbrooke() {
  const B = makeBuilder({ cell: 40 }), stats = { n: 0, w: 0, drop: 0 }, meshNow = makeMesher(B, stats), rnd = rng(11214);
  const layers = [];
  const mesh = (lab, z0, z1, matOf, tag, extra) => { if (lab.some(v => v)) layers.push({ lab, z0, z1, matOf, tag, extra }); };
  const flush = () => {
    for (const L of layers) {
      const block = new Uint8Array(N);
      if (L.extra) block.set(L.extra);
      for (const O of layers) if (O !== L && O.z1 > L.z0 && L.z1 > O.z0) for (let k = 0; k < N; k++) if (O.lab[k]) block[k] = 1;
      meshNow(L.lab, L.z0, L.z1, L.matOf, L.tag, block);
    }
  };
  const lab = () => new Uint16Array(N);
  const P1 = newPlan(), P2 = newPlan();
  plan({ name: 'Floor 1', off: [0, 0], bp: BP }, P1);
  plan({ name: 'Floor 2', off: [-230, -80], bp: BP }, P2);

  // straight stair up +y (plan) in the stair room's width, top tread at the F2 stair well: 11 risers of 10 on 12 runs
  const NT = 10, SX0 = T(141, 0, [0, 0])[0], SX1 = T(36, 0, [0, 0])[0], SYT = T(0, 236, [0, 0])[1], SYB = SYT - 12 * NT;
  const stairT = new Int8Array(N).fill(-1);
  eachCell(SX0, SYB, SX1, SYT, (k, x, y) => { if (x > SX0 && x < SX1 && y > SYB && y < SYT) stairT[k] = Math.floor((y - SYB) / 12); });
  for (let k = 0; k < N; k++) if (stairT[k] >= 0) { P1.wall[k] = P1.rail[k] = 0; P2.wall[k] = P2.rail[k] = 0; }
  const grow = (fin, mask) => {
    let fr = [];
    for (let k = 0; k < N; k++) if (mask[k] && fin[k]) fr.push(k);
    while (fr.length) { const nx = []; for (const k of fr) for (const d of [1, -1, NX, -NX]) { const q = k + d; if (q >= 0 && q < N && mask[q] && !fin[q]) { fin[q] = fin[k]; nx.push(q); } } fr = nx; }
    for (let k = 0; k < N; k++) if (mask[k] && !fin[k]) fin[k] = 1;
  };
  grow(P1.fin, P1.fp); grow(P2.fin, P2.fp);

  { // pad + floor 1
    const pad = lab(), fin = lab();
    for (let k = 0; k < N; k++) if (P1.fp[k]) { pad[k] = 1; fin[k] = finLabel(P1.fin[k], k); }
    mesh(pad, 0, 36, () => ({ color: [214, 204, 186] }), 'pad');
    mesh(fin, 36, 40, finMat, 'floor 1');
  }
  function walls(P, fl, top) {
    const cuts = [fl, fl + 24, fl + 36, fl + 84, top];
    for (let b = 0; b < cuts.length - 1; b++) {
      const zA = cuts[b], zB = cuts[b + 1], mid = (zA + zB) / 2 - fl, L = lab();
      for (let k = 0; k < N; k++) {
        if (P.wall[k]) {
          const o = P.op[k];
          let v = 1;
          if (o === 1 && mid < 84) v = 0;
          else if (o === 2 && mid > 24 && mid < 96) v = P.glass[k] ? 2 : 0;
          else if (o === 3 && mid < 84) v = P.glass[k] ? 3 : 0;
          L[k] = v;
        } else if (P.rail[k] && mid < 36) L[k] = 4;
      }
      mesh(L, zA, zB, v => v === 1 ? { color: shade(STUCCO, 0.97 + rnd() * 0.03) } : v === 2 ? GLASS : v === 3 ? { color: WHITE } : { color: IRON }, 'walls');
    }
  }
  walls(P1, FL1, TOP1);
  // slab + floor 2: open over the foyer (open-to-below) and the stair's upper treads
  const hole = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (P2.kind[k] === 5 || stairT[k] >= 4) hole[k] = 1;
  {
    const sa = lab(), sb = lab();
    for (let k = 0; k < N; k++) if ((P1.fp[k] || P2.fp[k]) && !hole[k]) { sa[k] = 1; sb[k] = P2.fp[k] ? finLabel(P2.fin[k], k) : 1; }
    mesh(sa, TOP1, TOP1 + 6, () => ({ color: WHITE }), 'slab');
    mesh(sb, TOP1 + 6, FL2, v => v === 1 ? { color: WHITE } : finMat(v), 'floor 2');
  }
  walls(P2, FL2, TOP2);
  { const ce = lab(); for (let k = 0; k < N; k++) if (P2.fp[k]) ce[k] = 1; mesh(ce, TOP2, TOP2 + 10, () => ({ color: WHITE }), 'ceiling 2'); }
  for (let t = 0; t < NT; t++) {
    const tr = lab(), z = FL1 + 10 * (t + 1);
    for (let k = 0; k < N; k++) if (stairT[k] === t) tr[k] = 1;
    mesh(tr, FL1, z, () => ({ color: [210, 196, 170] }), 'stair');   // solid flight: coursed from the floor
  }
  { // porch + lanai steps: 3 treads of 12 down to the ground off the outdoor rooms' open edges
    const deck = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (P1.fp[k] && P1.kind[k] === 2 && !P1.wall[k]) deck[k] = 1;
    const dDeck = chamfer(deck), dFp = chamfer(P1.fp);
    for (let s = 0; s < 3; s++) {
      const L = lab();
      for (let k = 0; k < N; k++) if (!P1.fp[k] && !P1.wall[k] && dDeck[k] <= 6 * (3 - s) + 0.5 && dDeck[k] <= dFp[k] + 0.5) L[k] = 1;
      mesh(L, 10 * s, 10 * s + 10, () => ({ color: [222, 206, 178] }), 'steps');
    }
  }
  function roof(region, high, base, maxK, tag, extra) {
    const dOut = chamfer(region), eave = new Uint8Array(N), seed = new Uint8Array(N);
    for (let k = 0; k < N; k++) eave[k] = region[k] || (!high[k] && dOut[k] <= 8) ? 1 : 0;
    for (let k = 0; k < N; k++) seed[k] = eave[k] || high[k] ? 0 : 1;
    const d = chamfer(seed);
    for (let c = 0; c < maxK; c++) {
      const L = lab();
      let any = 0;
      for (let k = 0; k < N; k++) if (eave[k] && !high[k] && d[k] >= 1 + c * 5) { L[k] = 1; any = 1; }
      if (!any) break;
      const col = shade(ROOF[c % 3], 0.97 + rnd() * 0.03);
      mesh(L, base + c * 4, base + c * 4 + 4, () => ({ color: col }), tag, extra);
    }
  }
  {
    const r1 = new Uint8Array(N), r2 = new Uint8Array(N), hi = new Uint8Array(N), none = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (P2.fp[k] || P2.wall[k] || P2.rail[k]) { hi[k] = 1; if (P2.fp[k]) r2[k] = 1; }
      else if (P1.fp[k]) r1[k] = 1;
    }
    roof(r1, hi, FL2, 20, 'roof 1', P2.fp);
    roof(r2, none, TOP2 + 10, 30, 'roof 2');
  }
  flush();
  return { bricks: B.bricks, dropped: B.dropped, stats };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { bricks, dropped, stats } = longbrooke();
  const ai = process.argv.indexOf('--at'), at = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [0, 0];
  console.error(`longbrooke: ${bricks.length} bricks (${stats.w} wedges), ${stats.drop} dropped`);
  for (const d of dropped.slice(0, 8)) console.error('  ' + d);
  const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (out) {
    const owner = { id: 'c1770000-0000-4b0b-9a11-000000011214', name: 'Longbrooke House', display_name: 'Longbrooke House' };
    const bs = bricks.map(({ label, ...b }) => ({ ...b, position: [b.position[0] + at[0], b.position[1] + at[1], b.position[2]] }));
    fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner, captureMs: 15000, bricks: bs }] }));
  }
}
