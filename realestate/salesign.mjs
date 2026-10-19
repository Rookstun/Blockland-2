// FOR SALE sign = the owner's own build (2026-10-19, captured from the site world beside Lot 3 at
// -1764,1106 ground 672: "i want this to be the new real estate sign and when you click it it says
// click to buy? /confirm and then you have a 10 second window to buy it"): post, iron bar, two
// hangers, white board with the owner's TextDisplay. The board carries a Component_Interact
// (ConsoleTag event:plot:<id>) -> the realestate plugin -> "/confirm within 10 s".
// saleSign(id, x, y, g, [fx, fy], font, {studs, price}) = bricks for a bricks op: post at (x, y) on ground g, text facing (fx, fy).
import { turnBrick } from '../mapgen/orient.mjs';

export const SIGN_FONT = { type: 'BrickFontDescriptor', name: 'GlacialIndifferencePlus' };
const IRON = [86, 86, 86];
const TEXT = {
  Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 5.099999904632568, WidthScale: 1, LineOffset: -20, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
  Color: { B: 255, G: 255, R: 255, A: 255 }, MaterialSlider: 10, ShadingWidth: 2, OutlineColor: { B: 0, G: 0, R: 0, A: 255 }, OutlineWidth: 2,
  ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45, GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true,
  Typeface: 0, Billboard: 0, Material: 2, Shading: 0, bFlipShading: false, Outline: 2, bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false,
};

/** font = index of SIGN_FONT in the load's externalAssets */
export function saleSign(id, x, y, g, [fx, fy], font, { studs, price } = {}) {
  // owner's text + the lot's facts (owner: "put all that text on the sign like lot 3 and cost and studs")
  const facts = studs ? `\r\nLot ${id} · ${studs}x${studs} studs\r\n<color="1a7a1a">${price} coins</>\r\n<size="5">press E to buy</>` : '';
  const text = `<color="ff3333">For Sale</><size="7">\r\n<font="GlacialIndifference">by owner${facts}</></>`;
  const interact = { type: 'Component_Interact', data: { InteractSound: null, Message: '', ConsoleTag: `event:plot:${id}`,
    bAllowNearbyInteraction: true, bHiddenInteraction: false, PromptCustomLabel: `Buy Lot ${id}` } };
  const M = 'PB_DefaultMicroBrick';
  // local frame = the captured sign: text toward +x, board hanging on the +y side of the post
  const local = [
    { asset: M, size: [3, 4, 27], position: [0, 0, 27], direction: 4, rotation: 0, color: [96, 70, 46], components: [interact] },
    { asset: M, size: [15, 1, 1], position: [0, 19, 43], direction: 0, rotation: 1, color: IRON },
    { asset: M, size: [1, 1, 1], position: [0, 9, 41], direction: 4, rotation: 0, color: IRON },
    { asset: M, size: [1, 1, 1], position: [0, 29, 41], direction: 4, rotation: 0, color: IRON },
    { asset: M, size: [13, 9, 1], position: [0, 19, 31], direction: 0, rotation: 1, color: [255, 255, 255],
      components: [{ type: 'Component_TextDisplay', data: { ...TEXT, Text: text, Font: font } }, interact] },
  ];
  const r = { '1,0': 0, '0,1': 1, '-1,0': 2, '0,-1': 3 }[`${fx},${fy}`];
  return local.map(b => { const t = turnBrick(b, r); return { ...t, position: [t.position[0] + x, t.position[1] + y, t.position[2] + g] }; });
}
