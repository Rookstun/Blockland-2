// Fingerpost signs (owner 2026-10-13: "make signs indicating where things are, like iron
// steel copper", "experiment with the fonts"): a stone-footed timber post with up to four
// arrow boards stacked up it, each board pointing (+-x / +-y) toward a destination, text on
// both faces with the arrow on the side the place lies; every destination kind has its own
// font (EXTERNAL_ASSETS in ruins.mjs: index = SIGN_FONTS[kind]).
//
//   signpost(boards, seed) -> bricks, local units, origin = ground at the post's foot
//   boards: [{ dir: [dx, dy], text, kind }]
import { plaque } from './ruins.mjs';
import { orientFor } from './orient.mjs';

// font per kind of place (indexes into ruins.mjs EXTERNAL_ASSETS)
export const SIGN_FONTS = { town: 1, hamlet: 1, dungeon: 2, hazard: 3, magic: 4, trade: 5 };
const BOARD_COLORS = { town: [150, 112, 72], hamlet: [150, 112, 72], dungeon: [70, 60, 56], hazard: [96, 64, 44], magic: [70, 64, 110], trade: [120, 40, 36] };
const TEXT_COLORS = { dungeon: { R: 220, G: 70, B: 60, A: 255 }, magic: { R: 190, G: 170, B: 255, A: 255 }, trade: { R: 255, G: 214, B: 120, A: 255 } };

const MB = 'PB_DefaultMicroBrick', CORNER = 'PB_DefaultMicroWedgeCorner';
export function signpost(boards, seed = 1) {
  const out = [];
  const box = (x0, y0, z0, x1, y1, z1, color) => out.push({ asset: MB, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], color });
  const top = 64 + boards.length * 26;
  // foot: two stone courses, then the timber post with a pyramid cap
  box(-10, -10, 0, 10, 10, 6, [120, 116, 110]);
  box(-8, -8, 6, 8, 8, 10, [138, 134, 126]);
  box(-4, -4, 10, 4, 4, top, [96, 70, 46]);
  box(-6, -6, top, 6, 6, top + 4, [70, 52, 36]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x0 = sx < 0 ? -6 : 0, y0 = sy < 0 ? -6 : 0;
    out.push({ asset: CORNER, ...orientFor(CORNER, [[-sx, 0], [0, -sy]], [3, 3, 4]), position: [x0 + 3, y0 + 3, top + 8], color: [70, 52, 36] });
  }
  boards.forEach((bd, k) => {
    const [dx, dy] = bd.dir, z = top - 18 - k * 26, w = Math.max(30, Math.min(70, Math.ceil(bd.text.replace(/\n.*/s, '').length * 3.2 + 8)));
    const cx = dx * (w + 4), cy = dy * (w + 4);
    const font = SIGN_FONTS[bd.kind] ?? 0, color = BOARD_COLORS[bd.kind] ?? [150, 112, 72];
    // the two faces, back to back; viewer looking at a face along -n sees the place on their right when right . dir > 0
    for (const s of [1, -1]) {
      const n = [-dy * s, dx * s], v = [-n[0], -n[1]], right = [v[1], -v[0]];
      const onRight = right[0] * dx + right[1] * dy > 0;
      const [name, ...rest] = bd.text.split('\n');
      const line1 = onRight ? `${name} >` : `< ${name}`;
      const text = [line1, ...rest].join('\n');
      plaque({ put: (b, x, y, zz) => {
        const d = b.components[0].data;
        d.Font = font;
        if (TEXT_COLORS[bd.kind]) d.Color = TEXT_COLORS[bd.kind];
        out.push({ ...b, position: [x, y, zz] });
      }, text, facing: n, x: cx + n[0] * 1, y: cy + n[1] * 1, z, w, h: 10, color });
    }
    // a bracket under the board, from the post
    box(dx ? (dx > 0 ? 4 : -10) : -1, dy ? (dy > 0 ? 4 : -10) : -1, z - 14, dx ? (dx > 0 ? 10 : -4) : 1, dy ? (dy > 0 ? 10 : -4) : 1, z - 10, [70, 52, 36]);
  });
  return out;
}
