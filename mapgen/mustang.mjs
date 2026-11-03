// Stratofortress's wish (2026-11-02, granted by the owner): a P-51 Mustang, about half scale, parked, nose toward +x.
// Natural-metal finish with an original red nose and blue band; wheels on the ground.
//   node mapgen/mustang.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000005', name: 'mustang', display_name: 'mustang' };

export function mustang() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`mustang: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const ALU = [196, 200, 208], ALU2 = [172, 176, 186], DARK = [54, 58, 66], RED = [190, 40, 36], BLUE = [40, 70, 160], YEL = [236, 196, 48], GLASS = [150, 200, 220];
  const metal = { material: 'BMC_Metallic', material_intensity: 5 }, glass = { material: 'BMC_Glass' };
  // fuselage
  box(130, -14, 40, 160, 14, 72, RED, 'cowl'); box(160, -9, 46, 172, 9, 64, RED, 'spinner');
  box(100, -16, 38, 130, 16, 72, ALU, 'forward fuselage', metal); box(40, -17, 34, 100, 17, 72, ALU, 'engine bay', metal);
  box(-40, -18, 34, 40, 18, 70, ALU, 'mid fuselage', metal);
  box(-80, -13, 38, -40, 13, 66, ALU, 'rear fuselage', metal); box(-100, -13, 38, -80, 13, 66, BLUE, 'blue band');
  box(-150, -9, 42, -100, 9, 60, ALU2, 'tail taper', metal); box(-180, -6, 46, -150, 6, 58, ALU2, 'tail cone', metal);
  box(-10, -8, 26, 30, 8, 34, DARK, 'belly scoop');
  for (const s of [-1, 1]) for (const x of [106, 114, 122]) box(x, s < 0 ? -18 : 16, 56, x + 4, s < 0 ? -16 : 18, 62, DARK, 'exhaust');
  // canopy: three glass panes between frame bars, rail on top, turtledeck behind
  for (const [a, b] of [[-30, -10], [-6, 14], [18, 34]]) box(a, -12, 70, b, 12, 86, GLASS, 'canopy', glass);
  for (const [a, b] of [[-10, -6], [14, 18]]) box(a, -12, 70, b, 12, 86, ALU2, 'canopy frame');
  box(-30, -12, 86, 34, 12, 88, ALU2, 'canopy rail'); box(-34, -12, 70, -30, 12, 88, ALU2, 'canopy frame'); box(34, -12, 70, 38, 12, 82, ALU2, 'windscreen frame');
  box(-70, -9, 66, -40, 9, 76, ALU, 'turtledeck', metal); box(-40, -9, 70, -34, 9, 76, ALU, 'turtledeck', metal);
  // wings, one half then mirrored by sign
  const segs = [[18, 60, -30, 50], [60, 110, -26, 44], [110, 150, -20, 38], [150, 172, -14, 32]];
  for (const s of [-1, 1]) {
    for (const [y0, y1, x0, x1] of segs) box(x0, s < 0 ? -y1 : y0, 34, x1, s < 0 ? -y0 : y1, 40, ALU, 'wing', metal);
    box(-14, s < 0 ? -182 : 172, 34, 32, s < 0 ? -172 : 182, 40, YEL, 'wing tip');
    // landing gear: wheel, strut
    box(2, s < 0 ? -48 : 36, 0, 24, s < 0 ? -36 : 48, 12, DARK, 'wheel'); box(10, s < 0 ? -44 : 40, 12, 16, s < 0 ? -40 : 44, 34, ALU2, 'gear strut');
    // tailplane
    box(-170, s < 0 ? -50 : 6, 60, -132, s < 0 ? -6 : 50, 64, ALU2, 'tailplane', metal);
  }
  box(-144, -4, 0, -136, 4, 8, DARK, 'tail wheel'); box(-142, -2, 8, -138, 2, 42, ALU2, 'tail strut');
  box(-170, -6, 60, -132, 6, 64, ALU2, 'tailplane root', metal);
  // fin and rudder
  box(-176, -3, 64, -140, 3, 86, ALU, 'fin', metal); box(-172, -3, 86, -144, 3, 100, ALU, 'fin', metal); box(-168, -3, 100, -148, 3, 108, RED, 'fin tip');
  // propeller: hub plus four blades
  box(172, -4, 52, 178, 4, 58, DARK, 'hub');
  box(172, -2, 10, 176, 2, 52, DARK, 'blade'); box(172, -2, 58, 176, 2, 100, DARK, 'blade');
  box(172, -46, 53, 176, -4, 57, DARK, 'blade'); box(172, 4, 53, 176, 46, 57, DARK, 'blade');
  return B.bricks;
}

if (process.argv[1]?.endsWith('mustang.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'mustang.json';
  const bricks = mustang().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`mustang: ${bricks.length} bricks`);
}
