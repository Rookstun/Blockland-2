// Shops from the wallgen tool, the shop twin of wallhouse.mjs: same wallgen
// model and validators, a plan made for trade.
//
// planShop({ W, D, storeys, seed, kind }) -> wallhouse-style result plus
// rooms { s1, a, fd, dw, hall }:
//   - the sales floor spans the whole front, s1 studs deep, behind a wide
//     double door (dw studs, centred on fd) flanked by big display windows
//   - behind it a storeroom and a workroom split at `a`, reached through a door
//     in the sales floor's back wall at `hall` (the counter leaves a gap there)
//   - upper storeys repeat the walls: living quarters over the shop
// kind (smithy | general | bakery | apothecary) only changes the shop fit-out
// (town.mjs) and the display window width.
import { H, V, door, win, even, windows, buildFromPlan } from './wallhouse.mjs';

export const SHOP_KINDS = ['smithy', 'general', 'bakery', 'apothecary'];
// weapon shops (2026-10-15, owner: "houses that use the walltool ... shops for swords
// and guns ... windows with merchandise"): kept out of SHOP_KINDS so the town's
// random shop picks don't reshuffle; wider display windows
export const WEAPON_KINDS = ['armory', 'gunsmith'];

function plan(W, D, kind, rnd, variant) {
  const s1 = even(D * (0.6 + 0.06 * rnd(1)));
  const a = even(W * (0.4 + 0.2 * rnd(2)));
  const fd = even(W / 2), dw = 6;
  // display windows either side of the door: 6 studs wide (4 for the smithy, whose fire wants walls)
  const ww = kind === 'smithy' ? 4 : WEAPON_KINDS.includes(kind) ? 10 : 6;
  const lw = even(fd / 2), rw = even((fd + W) / 2);
  const front = [door(fd, dw), win(lw, ww), win(rw, ww)];
  // the back room door sits in whichever back room is larger, clear of the split
  const hall = variant ? even(a / 2) : even((a + W) / 2);
  const runs = [
    H(0, 0, W, front),
    H(D, 0, W, windows(0, W, [0, a, W])),
    V(0, 0, D, windows(0, D, [0, s1, D])),
    V(W, 0, D, windows(0, D, [0, s1, D])),
    H(s1, 0, W, [door(hall)]),
    V(a, s1, D, [door(even((s1 + D) / 2))]),
  ];
  return { runs, rooms: { s1, a, fd, dw, hall, lw, rw, ww } };
}

export function planShop({ W, D, storeys = 1, seed = 1, kind = 'general' }) {
  if (!SHOP_KINDS.includes(kind) && !WEAPON_KINDS.includes(kind)) throw new Error(`wallshop: unknown kind ${kind}`);
  return buildFromPlan((rnd, variant) => plan(W, D, kind, rnd, variant), { W, D, storeys, seed, label: `wallshop(${kind})` });
}
