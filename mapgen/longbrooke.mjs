// 11214 Longbrooke Dr, Riverview FL 33579 (2026-11-01, руся in chat: 'a simpler house ... i will work with you to make
// it good'). 1995 two-storey Florida stucco house, 3,060 sq ft, 5 bed / 2.5 bath, two-storey foyer, 2-car garage,
// back lanai. Plan = Zillow 3D tour blueprint (view-imx 8ca6df9a...), refs/longbrooke_bp.json; Floor 2 fitted on the
// walls at -230,-80 cm.
// Rebuilt 2026-11-02 (руся: 'remake it ... use the working door that is 3.0x6.2 ... if theres a hallway smaller than
// that i wont be able to fit and dont use meshing') on the brynwood / White Tail template: stud-grid walls, 30 x 62
// leaf doors (the owner's working door), the plan's straight stair. The raster/mesher build is in git history.
//   longbrooke() -> { bricks, fixtures, lot, count }      node mapgen/longbrooke.mjs [job.json] [--at X,Y]
import fs from 'fs';
import { house } from './brynwood.mjs';

const FL1 = 40, TOP1 = 140, FL2 = 150;   // 10 ft storeys
const TR = [[226, 212, 186], [214, 198, 170]];
// the plan's straight stair (Stairs (Up), x -40..-10 between its two walls), rising -y: 11 treads of 10 rise / 10 run
// from the foyer at y 80 (a 30-deep strip in front of the foot) to the upper hall, which the top tread opens into (the
// wall + rails between the landing and the hall dropped, so it is 30+ deep, not a 20-deep slot)
export const SX0 = -40, SX1 = -10, SY0 = 80, NT = 11;

function stairs(P1, P2, { cj, ci, NI }) {
  const clear = (P, x0, y0, x1, y1) => { for (let y = y0; y < y1; y += 10) for (let x = x0; x < x1; x += 10) { const k = cj(y) * NI + ci(x); P.wall[k] = 0; P.rail[k] = 0; } };
  const yTop = SY0 - 10 * NT;
  clear(P1, SX0, yTop, SX1, SY0);
  clear(P2, -80, -60, -70, -30);   // the west bedroom's door opens off a closet with no way into the hall: opened up
  clear(P2, SX0, yTop, SX1, 70); clear(P2, SX1, yTop, 30, yTop + 10); clear(P2, 30, yTop - 10, 40, yTop + 30);
  return [{
    hole: [[SX0, yTop, SX1, 70]],   // headroom: treads 4+ sit under the opening
    build({ box }) {
      for (let k = 1; k <= NT; k++) { const y = SY0 - 10 * k; box(SX0, y, FL1, SX1, y + 10, FL1 + 10 * k, { color: TR[k % 2] }, 'stair tread'); }
    },
  }];
}

export const LONGBROOKE = {
  bp: JSON.parse(fs.readFileSync(new URL('./refs/longbrooke_bp.json', import.meta.url))),
  floors: { F1: { name: 'Floor 1', off: [0, 0] }, U: { name: 'Floor 2', off: [-230, -80] } },
  upper: ['U'], grid: [-260, -400, 70, 85], z: [FL1, TOP1, FL2, 250], head: 90, lanai: null, stairs, strict: true,
};
export const longbrooke = ({ seed = 11214 } = {}) => house(LONGBROOKE, seed);

if (process.argv[1]?.endsWith('longbrooke.mjs')) {
  const t0 = Date.now(), h = longbrooke();
  const ai = process.argv.indexOf('--at'), at = ai > 0 ? process.argv[ai + 1].split(',').map(Number) : [0, 0];
  const counts = {};
  for (const b of h.bricks) counts[b.asset] = (counts[b.asset] ?? 0) + 1;
  console.error(`longbrooke: ${h.count} bricks ${JSON.stringify(counts)}, soft drops ${JSON.stringify(h.soft)}, ${h.fixtures.rooms.length} rooms / ${h.fixtures.doors.length} doors, ${Date.now() - t0} ms`);
  const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (out) {
    const owner = { id: 'c1770000-0000-4b0b-9a11-000000011214', name: 'Longbrooke House', display_name: 'Longbrooke House' };
    const bs = h.bricks.map(b => ({ ...b, asset: b.asset ?? 'PB_DefaultBrick', position: [b.position[0] + at[0], b.position[1] + at[1], b.position[2]] }));
    fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner, captureMs: 15000, bricks: bs }] }));
  }
}
