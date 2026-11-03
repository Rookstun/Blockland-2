// Wishes granted by the owner (2026-11-02, "give everyone 1 free build wish"): original models, no named characters' livery.
//   Groxenisu: a big chungus (a huge round grey rabbit holding a carrot)
//   Hannahsludge: slop (a trough of glistening green-brown slop with a ladle)
//   Obscure: Supreme Taco Man and his sidekick the Churro
//   node mapgen/wishes.mjs X Y Z job.json     (X,Y,Z = ground point of the row; models stand at x offsets, front faces -y)
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000001', name: 'wishes', display_name: 'wishes' };

export function wishes() {
  const B = makeBuilder({ cell: 40 });
  const box = (x0, y0, z0, x1, y1, z1, color, label, m = {}) => {
    if (!B.box(x0, y0, z0, x1, y1, z1, { asset: 'PB_DefaultMicroBrick', color, ...m }, label)) throw new Error(`wishes: ${label} dropped: ${B.dropped.at(-1)}`);
  };
  const GREY = [150, 152, 158], LGREY = [206, 206, 212], PINK = [236, 170, 176], WHITE = [246, 246, 240], BLACK = [26, 26, 28];
  const ORANGE = [232, 128, 36], GREEN = [70, 150, 60], BROWN = [112, 72, 40];

  // ---- big chungus: x -300..-100, front faces -y, 220 tall. Stepped round body, huge belly, tall ears.
  {
    const cx = -200;
    box(cx - 70, -60, 0, cx + 70, 60, 20, GREY, 'chungus feet');                    // base
    box(cx - 90, -80, 20, cx + 90, 80, 40, GREY, 'chungus belly low');
    box(cx - 90, -80, 80, cx + 90, 80, 100, GREY, 'chungus belly top');
    box(cx - 100, -70, 40, cx + 100, 70, 80, GREY, 'chungus belly wide');
    box(cx - 90, -80, 40, cx + 90, -70, 80, LGREY, 'chungus belly front');
    box(cx - 90, 70, 40, cx + 90, 80, 80, GREY, 'chungus belly back');
    box(cx - 70, -60, 100, cx + 70, 60, 140, GREY, 'chungus chest');
    box(cx - 50, -50, 140, cx + 50, 50, 190, GREY, 'chungus head');
    box(cx - 40, -56, 150, cx + 40, -50, 180, LGREY, 'chungus face');
    box(cx - 30, -58, 170, cx - 14, -56, 180, WHITE, 'eye'); box(cx + 14, -58, 170, cx + 30, -56, 180, WHITE, 'eye');
    box(cx - 24, -60, 172, cx - 18, -58, 178, BLACK, 'pupil'); box(cx + 18, -60, 172, cx + 24, -58, 178, BLACK, 'pupil');
    box(cx - 8, -58, 160, cx + 8, -56, 168, PINK, 'nose');
    box(cx - 20, -58, 152, cx + 20, -56, 156, [150, 70, 70], 'smile');
    box(cx - 40, -4, 190, cx - 20, 10, 250, GREY, 'ear left'); box(cx - 36, -8, 196, cx - 24, -4, 244, PINK, 'ear inner');
    box(cx + 20, -4, 190, cx + 40, 10, 250, GREY, 'ear right'); box(cx + 24, -8, 196, cx + 36, -4, 244, PINK, 'ear inner');
    box(cx - 112, -30, 60, cx - 100, 30, 100, GREY, 'arm left'); box(cx + 100, -30, 60, cx + 112, 30, 100, GREY, 'arm right');
    box(cx + 100, -70, 70, cx + 116, -30, 90, ORANGE, 'carrot');                      // carrot in right paw
    box(cx + 104, -90, 74, cx + 112, -70, 86, ORANGE, 'carrot tip');
    box(cx + 102, -50, 90, cx + 114, -40, 100, GREEN, 'carrot leaves');
    box(cx - 30, 80, 30, cx + 30, 96, 60, WHITE, 'tail');
  }

  // ---- slop: x -60..140, an iron trough of heaped green-brown slop, a ladle standing in it
  {
    const IRON = [58, 58, 64], SLOP = [96, 118, 52], SLOP2 = [128, 104, 48], SLOP3 = [74, 96, 44];
    box(-60, -50, 0, 140, -40, 40, IRON, 'trough front'); box(-60, 40, 0, 140, 50, 40, IRON, 'trough back');
    box(-60, -40, 0, -50, 40, 40, IRON, 'trough end'); box(130, -40, 0, 140, 40, 40, IRON, 'trough end');
    box(-50, -40, 0, 130, 40, 26, SLOP, 'slop fill');
    box(-30, -30, 26, 100, 30, 38, SLOP2, 'slop heap'); box(-10, -20, 38, 70, 20, 50, SLOP3, 'slop mound');
    box(20, -12, 50, 50, 12, 58, SLOP, 'slop crest');
    box(100, -34, 26, 124, -14, 34, [168, 150, 60], 'slop lump'); box(-48, 14, 26, -32, 34, 34, [168, 150, 60], 'slop lump');
    box(80, 10, 38, 88, 18, 44, [200, 60, 50], 'slop tomato'); box(0, -30, 38, 8, -22, 44, [220, 200, 120], 'slop crust');
    box(148, 0, 0, 156, 8, 10, IRON, 'ladle foot');                                  // a ladle leaning on the trough
    box(150, 2, 10, 154, 6, 66, [150, 108, 64], 'ladle handle');
    box(142, -4, 66, 162, 14, 80, IRON, 'ladle bowl');
    box(-60, 50, 40, 140, 54, 44, IRON, 'trough rim'); box(-60, -54, 40, 140, -50, 44, IRON, 'trough rim');
  }

  // ---- Supreme Taco Man: x 260..380, a standing taco in cape and mask; his sidekick the Churro: x 420..460
  {
    const SHELL = [232, 190, 84], SHELL2 = [208, 160, 60], LETT = [92, 170, 60], TOM = [208, 52, 44], CHEESE = [244, 200, 60], CAPE = [150, 24, 60];
    const cx = 320;
    // legs and boots
    box(cx - 24, -16, 0, cx - 8, 0, 8, BLACK, 'boot'); box(cx + 8, -16, 0, cx + 24, 0, 8, BLACK, 'boot');
    box(cx - 20, -8, 8, cx - 12, 0, 40, SHELL2, 'leg'); box(cx + 12, -8, 8, cx + 20, 0, 40, SHELL2, 'leg');
    // the taco: a tall folded shell seen from the front, filling spilling out the top
    box(cx - 50, -20, 40, cx + 50, 20, 130, SHELL, 'shell');
    box(cx - 56, -12, 60, cx - 50, 12, 120, SHELL2, 'shell fold'); box(cx + 50, -12, 60, cx + 56, 12, 120, SHELL2, 'shell fold');
    box(cx - 44, -26, 56, cx + 44, -20, 120, SHELL2, 'shell front');
    box(cx - 44, -18, 130, cx + 44, 18, 140, LETT, 'lettuce'); box(cx - 30, -16, 140, cx + 30, 16, 148, TOM, 'tomato'); box(cx - 14, -12, 148, cx + 14, 12, 154, CHEESE, 'cheese');
    // face on the front of the shell + mask
    box(cx - 36, -30, 92, cx + 36, -26, 104, BLACK, 'mask'); box(cx - 30, -32, 94, cx - 12, -30, 102, WHITE, 'eye'); box(cx + 12, -32, 94, cx + 30, -30, 102, WHITE, 'eye');
    box(cx - 24, -34, 96, cx - 18, -32, 100, BLACK, 'pupil'); box(cx + 18, -34, 96, cx + 24, -32, 100, BLACK, 'pupil');
    box(cx - 14, -30, 72, cx + 14, -26, 78, [150, 70, 70], 'grin');
    // arms: a fist raised, one on hip; cape behind
    box(cx - 70, -8, 90, cx - 56, 8, 110, SHELL2, 'arm hip'); box(cx + 56, -8, 100, cx + 70, 8, 150, SHELL2, 'arm raised'); box(cx + 56, -10, 150, cx + 74, 10, 164, SHELL, 'fist');
    box(cx - 54, 20, 50, cx + 54, 26, 136, CAPE, 'cape'); box(cx - 60, 26, 40, cx + 60, 30, 100, CAPE, 'cape flare');
    box(cx - 12, -30, 108, cx + 12, -26, 124, [212, 170, 60], 'emblem', { material: 'BMC_Metallic', material_intensity: 6 });
    // sidekick the churro: a short fat striped log standing upright, sugar-crusted, with a face and a tiny cape
    const kx = 440;
    for (let i = 0; i < 5; i++) {   // alternating ridge and body slabs, 80 tall
      box(kx - 16, -16, i * 16, kx + 16, 16, i * 16 + 4, [236, 196, 112], 'churro ridge');
      box(kx - 14, -14, i * 16 + 4, kx + 14, 14, i * 16 + 16, [214, 150, 70], 'churro');
    }
    box(kx - 10, -16, 52, kx + 10, -14, 64, [250, 238, 220], 'churro sugar');
    box(kx - 10, -18, 54, kx - 2, -16, 60, WHITE, 'eye'); box(kx + 2, -18, 54, kx + 10, -16, 60, WHITE, 'eye');
    box(kx - 8, -20, 56, kx - 4, -18, 58, BLACK, 'pupil'); box(kx + 4, -20, 56, kx + 8, -18, 58, BLACK, 'pupil');
    box(kx - 6, -16, 40, kx + 6, -14, 44, [150, 70, 70], 'smile');
    box(kx - 18, 16, 30, kx + 18, 20, 70, [28, 80, 150], 'tiny cape');
    box(kx - 22, -6, 36, kx - 14, 6, 48, [214, 150, 70], 'churro arm'); box(kx + 14, -6, 36, kx + 22, 6, 48, [214, 150, 70], 'churro arm');
  }
  return B.bricks;
}

if (process.argv[1]?.endsWith('wishes.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'wishes.json';
  const bricks = wishes().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, bricks }] }));
  console.error(`wishes: ${bricks.length} bricks`);
}
