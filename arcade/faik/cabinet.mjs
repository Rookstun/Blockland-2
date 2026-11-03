// faik/cabinet.mjs: the FAIK PLATFORMER upright (pacman's machine reskinned: green body, orange trim, 26 x 56 char screen).
import { startCabinet, MB, TD, rgba, GLOW, METAL } from '../lib/cabinet.mjs';

export const FONT = 'IosevkaTerm';
export const LH = 4.0, WS = 1.0;
const BZ0 = 30, BZ1 = 148, BX = 62, BZ = (BZ0 + BZ1) / 2;
const TRIM = [255, 140, 30], GREEN = [20, 120, 70], BLACK = [8, 8, 12], HAT = [26, 26, 30], BAND = [40, 200, 210];

export function buildCabinet(compiled, gen) {
  const cab = startCabinet(compiled, { chipAt: [0, 74, 2] });
  const { box, panel, wireOut } = cab;
  const F = cab.font(FONT);
  const layer = { Font: F, LineHeight: LH, WidthScale: WS, Text: '' };

  box(-70, 0, 0, 70, 66, 196, { color: BLACK });
  for (const s of [-1, 1]) {
    box(s * 70, -10, 0, s * 76, 66, 196, { color: GREEN });
    box(s * 76, -10, 4, s * 78, 66, 8, GLOW(TRIM, 2));
    box(s * 76, -10, 188, s * 78, 66, 192, GLOW(TRIM, 2));
  }
  box(-78, -12, 196, 78, 68, 200, { color: BLACK });
  // marquee under a little top hat with a teal band
  box(-70, -10, 172, 70, 0, 196, { color: [10, 20, 10] });
  box(-70, -12, 172, 70, -10, 174, GLOW(TRIM, 3));
  box(-20, -12, 200, 20, -4, 214, { color: HAT }); box(-34, -14, 200, -20, -2, 202, { color: HAT }); box(20, -14, 200, 34, -2, 202, { color: HAT });
  box(-20, -14, 202, 20, -12, 206, GLOW(BAND, 3));
  cab.w.addBrick({ asset: MB, ...GLOW([20, 30, 20], 1), direction: 13 >> 2, rotation: 13 & 3, size: [66, 11, 1], position: [0, -11, 185], owner_index: cab.owner,
    components: [{ type: TD, data: { ...layer, Font: cab.font('BlackOpsOne'), WidthScale: 1, Text: 'FAIK', LineHeight: 14, Color: rgba(TRIM), OutlineColor: rgba(BAND), OutlineWidth: 2 } }] });
  box(-70, -6, 8, -64, 0, 172, { color: [16, 22, 16] });
  box(64, -6, 8, 70, 0, 172, { color: [16, 22, 16] });
  box(-64, -6, 166, 64, 0, 172, { color: [16, 22, 16] });
  box(-64, -8, 166, 64, -6, 168, GLOW(TRIM, 2));

  // screen: the level on the board panel (the chip swaps the text per level), coins right under it, sprites 2 units in front
  const board = panel(BX, -BX, BZ0, BZ1, { ...layer, Text: gen.walls, Color: rgba([60, 220, 120]) });
  wireOut('walls_t', board, TD, 'Text');
  const hud = panel(BX, -BX, 156, 166, { ...layer, LineHeight: 5, Text: 'FAIK PLATFORMER', Color: rgba([255, 255, 255]) });
  wireOut('hud_t', hud, TD, 'Text');
  const info = panel(BX, -BX, 148, 156, { ...layer, LineHeight: 4, Text: '', Color: rgba(TRIM) });
  wireOut('info_t', info, TD, 'Text');
  const coins = panel(BX, -BX, BZ0 - 2, BZ0, { ...layer, Offset: { X: 0, Y: BZ - (BZ0 - 1), Z: 0 }, Color: rgba([255, 215, 40]) });
  wireOut('dots_t', coins, TD, 'Text');
  const sprites = [['pac_t', null, [255, 255, 255]], ['g0_t', null, [255, 80, 80]], ['g1_t', null, [255, 150, 210]], ['g2_t', null, [40, 230, 255]], ['g3_t', null, [255, 170, 60]], ['msg_t', 'msg_c']];
  sprites.forEach(([t, c, fixed], i) => {
    const z1 = BZ0 - i * 2, z0 = z1 - 2;
    const b = panel(BX, -BX, z0, z1, { ...layer, Offset: { X: 0, Y: BZ - (z0 + 1), Z: 0 }, Color: rgba(fixed ?? [255, 255, 255]) }, { yBack: -2 });
    wireOut(t, b, TD, 'Text');
    if (c) wireOut(c, b, TD, 'Color');
  });
  const zLow = BZ0 - sprites.length * 2;
  box(-64, -2, 8, 64, 0, BZ0 - 2, { color: BLACK });
  box(-64, -4, 8, 64, -2, zLow, { color: BLACK });

  box(-70, -30, 0, 70, -6, 8, { color: BLACK });
  box(-70, -30, 8, 70, -6, 12, { color: GREEN });
  box(-70, -32, 0, 70, -30, 12, GLOW(TRIM, 2));
  box(-22, -20, 12, -18, -16, 28, METAL([60, 60, 60]));
  cab.w.addBrick({ asset: 'PB_DefaultPole', color: [220, 20, 20], size: [5, 5, 4], position: [-20, -18, 32], owner_index: cab.owner });
  for (const [x, c] of [[16, [255, 140, 30]], [32, [40, 200, 210]]]) cab.w.addBrick({ asset: 'PB_DefaultPole', color: c, size: [5, 5, 2], position: [x, -18, 14], owner_index: cab.owner });

  cab.w.addBrick({ asset: 'PB_DefaultPole', ...METAL([150, 150, 160]), size: [5, 5, 6], position: [0, -70, 6], owner_index: cab.owner });
  cab.seat(0, -70, 23, 'player', 'Play FAIK');
  cab.speakers(gen.synths);
  return cab.finish();
}
