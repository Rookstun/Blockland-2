// rotorraid/gen.mjs: ROTOR RAID (Rookstun 2026-11-07: "a game like Raid on Bungeling Bay ... Baseline180Engine with the
// 30x20 screen ... isometric top down 3D-view ... volumetric shaded 16 bit graphics ... helicopter ~12 pixels ... people
// 8 pixels tall ... land on friendly helipads and airfields ... 1 mission ... actual text"). Original game on the DMA
// engine of 30w20h180Engine (dmapong): 180 x 120 output, 5 channels x 24 rows, a swap chip. The CPU runs the game and
// writes a bus (frame, camera, 24 packed objects); every channel draws its 24 rows from the pre-shaded map + sprites.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeTiles, mapImage, sprites, makePalette, SPR, MW, MH, IW, IH, MOX, MOY, MSC, FACTORIES, GUNS, TANKS, PEOPLE, START } from './world.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// 10 channels x 12 rows (one 2-unit strip each): half the work per channel event (5 x 24 rows ran out: panels went blank)
export const W = +(process.env.RR_W ?? 120), H = +(process.env.RR_H ?? 80), NCH = 10, ROWS = H / NCH, NOB = 24, STRIP = ROWS;
const NBK = IW / 64;
export const proj = (x, y, z) => [(x - y) * MSC + MOX, (x + y) * MSC / 2 - z * MSC + MOY];
export const BUS = ['frame', 'phase', 'camx', 'camy', ...Array.from({ length: NOB }, (_, i) => `o${i}`)];
const q = JSON.stringify, fill = (tpl, v) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in v)) throw Error(`template: no ${k}`); return v[k]; });
const BRIEF = ['MISSION 1: OPERATION SOGGY BISCUIT   (SPACE)', 'Grubb Island makes jam for very bad toast.', 'Blow up all 3 of its jam factories.',
  'Four accountants are stuck on the sandbar.', 'Land near them, then fly them home to the H.', 'WASD fly  SPACE gun  E missile  RMB lock target  Q land   SPACE: go'];
const TEXT = {
  WIN: 'MISSION COMPLETE. The accountants are home and already invoicing you.   SPACE: again',
  NOLAND: 'That is not a landing spot. That is a tree, or the sea.',
  NOFUEL: 'OUT OF FUEL. Gravity was waiting the whole time.',
  SHOTDOWN: 'SHOT DOWN. Your helicopter is now modern sculpture.',
  DELIVER: 'Accountants delivered. They bill you for the ride.',
  BOARD: 'An accountant climbs aboard and files a complaint.',
  FACTORY: 'Factory down. Somewhere, a slice of toast weeps.',
};
let cache;
export function build() {
  if (cache) return cache;
  const pal = makePalette(), tiles = makeTiles(), map = mapImage(tiles, pal), spr = sprites(pal);
  cache = { tiles, map, sprites: spr, palette: pal.hex(), IW, IH, SPR, START, proj };
  return cache;
}
export function cpuSrc() {
  const g = build(), r = v => (Math.round(v * 1e6) / 1e6).toFixed(6);
  const spawn = [
    ...GUNS.map(([x, y]) => `  enemy(0, ${r(x)}, ${r(y)}, 3, 0.0, 0.0, 0.0, 0.0)`),
    ...TANKS.map(([[ax, ay], [bx, by]]) => `  enemy(1, ${r(ax)}, ${r(ay)}, 4, ${r(ax)}, ${r(ay)}, ${r(bx)}, ${r(by)})`),
    ...FACTORIES.map(([x, y]) => `  enemy(2, ${r(x)}, ${r(y)}, 12, 0.0, 0.0, 0.0, 0.0)`),
  ].join('\n');
  const people = PEOPLE.map(([x, y]) => `  ppx.push(${r(x)})\n  ppy.push(${r(y)})\n  pst.push(0)`).join('\n');
  return fill(fs.readFileSync(join(here, 'cpu.ws.tpl'), 'utf8'), {
    TILES: g.tiles.join(', '), DX: Array.from({ length: 8 }, (_, d) => r(Math.cos(d * Math.PI / 4))).join(', '), DY: Array.from({ length: 8 }, (_, d) => r(Math.sin(d * Math.PI / 4))).join(', '),
    SX: r(START[0]), SY: r(START[1]), MW, MH, MSC, HSC: MSC / 2, MOX, MOY, W, H, HALFW: W / 2, HALFH: H / 2, IW, IH, NOB, NPEOPLE: PEOPLE.length,
    OVARS: Array.from({ length: NOB }, (_, i) => `var oO${i}: int = -1`).join('\n'),
    OOUTS: Array.from({ length: NOB }, (_, i) => `@right out o${i}_: int = oO${i}`).join('\n'),
    OASSIGN: Array.from({ length: NOB }, (_, i) => `  oO${i} = if base + ${i} < n then floor(vals.get(base + ${i})) else -1`).join('\n'),
    SPAWN: spawn, PEOPLE: people, BRIEF: BRIEF.map(t => q(t)).join(', '), NBRIEF: BRIEF.length, WIN: q(TEXT.WIN),
    NOLAND: TEXT.NOLAND, NOFUEL: TEXT.NOFUEL, SHOTDOWN: TEXT.SHOTDOWN, DELIVER: TEXT.DELIVER, BOARD: TEXT.BOARD, FACTORY: TEXT.FACTORY,
    S_GUN: SPR.gun, S_GUNDEAD: SPR.gunDead, S_FACT: SPR.factory, S_FACTDEAD: SPR.factoryDead, S_TANK: SPR.tank0, S_PERSON: SPR.person0,
    S_BOOM0: SPR.boom0, S_BOOM1: SPR.boom1, S_EBULLET: SPR.ebullet0, S_MISSILE: SPR.missile, S_BULLET: SPR.bullet0, S_SHADOW: SPR.shadow, S_LOCK: SPR.lock,
  });
}
export function channelSrc(k) {
  const g = build(), R0 = k * ROWS, R1 = R0 + ROWS - 1;
  // MB[row * (NBK + 1) + b] = first span of the row ending past x = b * 64 (b = NBK: the row's end): channels walk only the visible spans
  const MP = [], MB = [], ME = []; // ME[row * (NBK + 1) + b] = first span starting at x >= b * 64
  for (const row of g.map) { const base = MP.length; for (let b = 0; b < NBK; b++) { const i = row.findIndex(([, e]) => e > b * 64); MB.push(base + (i < 0 ? row.length : i)); } MB.push(base + row.length);
    for (let b = 0; b <= NBK; b++) { const i = b === NBK ? -1 : row.findIndex(([a]) => a >= b * 64); ME.push(base + (i < 0 ? row.length : i)); } for (const [a, b, c] of row) MP.push(a + b * 1024 + c * 1048576); }
  const SRI = [], SRS = [0], SP = [];
  for (const s of g.sprites) { SRI.push(SRS.length - 1); for (const row of s.rows) { for (const [a, b, c] of row) SP.push(a + b * 64 + c * 4096); SRS.push(SP.length); } }
  if (g.sprites.some(s => s.w >= 64)) throw Error('sprite wider than 63 px');
  // big const tables -> chunks of CHUNK + a getter mod (wirescript const arrays fail past a few thousand entries)
  const CHUNK = 1000, consts = [], mods = [];
  for (const [name, arr] of [['MP', MP], ['MB', MB], ['ME', ME], ['SP', SP]]) {
    const parts = Array.from({ length: Math.ceil(arr.length / CHUNK) }, (_, i) => arr.slice(i * CHUNK, (i + 1) * CHUNK));
    parts.forEach((c, i) => consts.push(`const ${name}${i} = [${c.join(', ')}]`));
    mods.push(`mod ${name.toLowerCase()}(j: int) -> int {\n` + parts.map((_, i) => i < parts.length - 1 ? `  if j < ${(i + 1) * CHUNK} { return ${name}${i}[j - ${i * CHUNK}] }` : `  return ${name}${i}[j - ${i * CHUNK}]`).join('\n') + '\n}');
  }
  for (const t of [SRS]) if (t.length > CHUNK) throw Error('a constant table is over the chunk size: chunk it too');
  const unpack = Array.from({ length: NOB }, (_, i) => `  if o${i} >= 0 {
    let spr = o${i} / 262144
    let top = (o${i} / 512) % 512 - 128 - SAY[spr]
    if top <= ${R1} && top + SH[spr] > ${R0} {
      ox.push(o${i} % 512 - 128 - SAX[spr])
      oy.push(top)
      os.push(spr)
    }
  }`).join('\n');
  return fill(fs.readFileSync(join(here, 'channel.ws.tpl'), 'utf8'), {
    K: k, PH: Math.floor(k * 3 / NCH), R0, R1, W, H, IH, ROWS, ROWS1: ROWS - 1, BL: '█'.repeat(W),
    OINS: Array.from({ length: NOB }, (_, i) => `@left in o${i}: int`).join('\n'),
    COLS: g.palette.map(h => q(`<color="${h}">`)).join(', '), NBK, NBK1: NBK + 1, CHUNK, CHUNKCONSTS: consts.join('\n'), CHUNKMODS: mods.join('\n'),
    SRI: SRI.join(', '), SRS: SRS.join(', '),
    SH: g.sprites.map(s => s.h).join(', '), SAX: g.sprites.map(s => s.ax).join(', '), SAY: g.sprites.map(s => s.ay).join(', '), SW: g.sprites.map(s => s.w).join(', '), OUNPACK: unpack,
  });
}
export function swapSrc() {
  const r = Array.from({ length: NCH }, (_, k) => `r${k}`);
  return `// GENERATED by rotorraid/gen.mjs: frame swap for ${NCH} DMA channels
${r.map(v => `@left in ${v}: int`).join('\n')}
var goO: int = 0
@right out go_: int = goO
mod check() {
  if ${r.slice(1).map((v, i) => `${r[i]} == ${v}`).join(' && ')} {
    goO = r0
  }
}
${r.map(v => `on Change(${v}) {\n  check()\n}`).join('\n')}
`;
}
// cabinet options (the DMA cabinet reads W/H/STRIP/titleLH from here)
export const cabinetGen = () => ({ W, H, STRIP, src: cpuSrc(), titleLH: 1.1, synths: ['Square'], clockHz: 60, rmbPin: true }); // RotorRaid FastCabinetRender (Rookstun): only the clock is faster, the game speeds up with it
