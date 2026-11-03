// pacman/cabinet.mjs: the upright PAC-MAN machine around the chip.
// Screen (faces -y): the maze walls on the board panel (y -2..0), the dots on a
// thin strip right under it in the same plane, and the pac / ghost / message
// layers on thin strips 2 units in front (y -4..-2). Every layer renders the
// same 31 x 56 character grid and is slid up onto the board's centre with its
// TextDisplay Offset (Y = up, world units), so they all line up.
// A stool in front (sit = play, W/A/S/D steer), joystick + buttons on the desk.
import { startCabinet, MB, TD, rgba, GLOW, METAL } from '../lib/cabinet.mjs';

// text metrics: tune after looking at it in game (IosevkaTerm advance = half its height)
export const FONT = 'IosevkaTerm';
export const LH = 3.0, WS = 1.3;   // LineHeight, WidthScale
const BZ0 = 30, BZ1 = 148;         // board panel z range
const BX = 62;                     // board panel half width
const BZ = (BZ0 + BZ1) / 2;        // board centre
const YELLOW = [255, 205, 0], BLUE = [30, 60, 230], BLACK = [8, 8, 12];

export function buildCabinet(compiled, gen) {
  const cab = startCabinet(compiled, { chipAt: [0, 74, 2] });
  const { box, panel, wireOut } = cab;
  const F = cab.font(FONT);
  const layer = { Font: F, LineHeight: LH, WidthScale: WS, Text: '' };

  // ---- body: black box, yellow side panels with blue trim, marquee on top
  box(-70, 0, 0, 70, 66, 196, { color: BLACK });
  for (const s of [-1, 1]) {
    const x0 = s * 70, x1 = s * 76;
    box(x0, -10, 0, x1, 66, 196, { color: YELLOW });
    box(s * 76, -10, 4, s * 78, 66, 8, GLOW(BLUE, 2));
    box(s * 76, -10, 188, s * 78, 66, 192, GLOW(BLUE, 2));
  }
  box(-78, -12, 196, 78, 68, 200, { color: BLACK });                  // roof
  // marquee
  box(-70, -10, 172, 70, 0, 196, { color: [20, 10, 0] });
  box(-70, -12, 172, 70, -10, 174, GLOW(YELLOW, 3));
  cab.w.addBrick({ asset: MB, ...GLOW([30, 20, 0], 1), direction: 13 >> 2, rotation: 13 & 3, size: [66, 11, 1], position: [0, -11, 185], owner_index: cab.owner,
    components: [{ type: TD, data: { ...layer, Font: cab.font('BlackOpsOne'), WidthScale: 1, Text: 'PAC-MAN', LineHeight: 14, Color: rgba(YELLOW), OutlineColor: rgba(BLUE), OutlineWidth: 2 } }] });
  // bezel round the screen
  box(-70, -6, 8, -64, 0, 172, { color: [16, 16, 22] });
  box(64, -6, 8, 70, 0, 172, { color: [16, 16, 22] });
  box(-64, -6, 166, 64, 0, 172, { color: [16, 16, 22] });
  box(-64, -8, 166, 64, -6, 168, GLOW(BLUE, 2));

  // ---- the screen
  const board = panel(BX, -BX, BZ0, BZ1, { ...layer, Text: gen.walls, Color: rgba([40, 70, 255]) });
  wireOut('walls_c', board, TD, 'Color');
  const hud = panel(BX, -BX, 156, 166, { ...layer, Font: F, LineHeight: 5, WidthScale: 1, Text: 'PAC-MAN', Color: rgba([255, 255, 255]) });
  wireOut('hud_t', hud, TD, 'Text');
  const info = panel(BX, -BX, 148, 156, { ...layer, Font: F, LineHeight: 4, WidthScale: 1, Text: '', Color: rgba(YELLOW) });
  wireOut('info_t', info, TD, 'Text');
  // the dots: same plane as the walls, on a strip under the board
  const dots = panel(BX, -BX, BZ0 - 2, BZ0, { ...layer, Offset: { X: 0, Y: BZ - (BZ0 - 1), Z: 0 }, Color: rgba([255, 190, 160]) });
  wireOut('dots_t', dots, TD, 'Text');
  // sprites: strips 2 units in front, one per layer, stacked downward
  const sprites = [['pac_t', null, YELLOW], ['g0_t', 'g0_c'], ['g1_t', 'g1_c'], ['g2_t', 'g2_c'], ['g3_t', 'g3_c'], ['msg_t', 'msg_c']];
  sprites.forEach(([t, c, fixed], i) => {
    const z1 = BZ0 - i * 2, z0 = z1 - 2;
    const b = panel(BX, -BX, z0, z1, { ...layer, Offset: { X: 0, Y: BZ - (z0 + 1), Z: 0 }, Color: rgba(fixed ?? [255, 255, 255]) }, { yBack: -2 });
    wireOut(t, b, TD, 'Text');
    if (c) wireOut(c, b, TD, 'Color');
  });
  // dark fill under the strips down to the desk
  const zLow = BZ0 - sprites.length * 2;
  box(-64, -2, 8, 64, 0, BZ0 - 2, { color: BLACK });
  box(-64, -4, 8, 64, -2, zLow, { color: BLACK });

  // ---- control desk with a joystick and two buttons (decoration: the stool is the controller)
  box(-70, -30, 0, 70, -6, 8, { color: BLACK });
  box(-70, -30, 8, 70, -6, 12, { color: YELLOW });
  box(-70, -32, 0, 70, -30, 12, GLOW(BLUE, 2));
  box(-22, -20, 12, -18, -16, 28, METAL([60, 60, 60]));
  cab.w.addBrick({ asset: 'PB_DefaultPole', color: [220, 20, 20], size: [5, 5, 4], position: [-20, -18, 32], owner_index: cab.owner });
  for (const [x, c] of [[16, [220, 20, 20]], [32, [30, 90, 255]]]) cab.w.addBrick({ asset: 'PB_DefaultPole', color: c, size: [5, 5, 2], position: [x, -18, 14], owner_index: cab.owner });

  // ---- stool (the controller)
  cab.w.addBrick({ asset: 'PB_DefaultPole', ...METAL([150, 150, 160]), size: [5, 5, 6], position: [0, -70, 6], owner_index: cab.owner });
  cab.seat(0, -70, 23, 'player', 'Play PAC-MAN');

  // ---- sound
  cab.speakers(gen.synths);
  return cab.finish();
}
