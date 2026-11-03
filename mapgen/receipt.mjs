// Rookstun's wish (2026-11-02, free wish): "a cvs receipt with text decals, really weird RXs specifically meant for Brickadians".
// A standing paper receipt (white panel, one monospace TextDisplay, 35 columns) on a little base. Front faces -y.
//   node mapgen/receipt.mjs X Y Z job.json
import fs from 'fs';
import { makeBuilder } from './builder.mjs';

const OWNER = { id: 'c1a5de00-0000-4000-8000-000000000011', name: 'receipt', display_name: 'receipt' };
const W = 35, LH = 9, LINES = [
  '        CVS/pharmacy',
  '     1 BRICK WAY, STUD CITY',
  '     TEL 1-800-PLATE-ZERO',
  '-----------------------------------',
  'EXTRACARE MEMBER  ****4 STUDS',
  'PHARMACIST: A. BASEPLATE, RPH',
  '-----------------------------------',
  'RX 0000101   QTY 30        $4.20',
  ' STUDDIUM 2MG CHEWABLE',
  ' TAKE ONE STUD DAILY WITH A WALL.',
  ' MAY CAUSE: SNAPPING, CLICKING.',
  '',
  'RX 0000102   QTY 12       $11.99',
  ' WEDGEZOLAM 5MG',
  ' FOR THE CORNERS YOU CANNOT FIT.',
  ' DO NOT OPERATE A MICROCHIP.',
  '',
  'RX 0000103   QTY 90        $0.01',
  ' PLATEBIOTIC 400MG CAPSULE',
  ' FOR BASEPLATE FLU. FINISH THE',
  ' WHOLE PLATE EVEN IF IT FEELS',
  ' FLAT.',
  '',
  'RX 0000104   QTY 1        $87.00',
  ' CLEARCOLLISION OINTMENT',
  ' APPLY TO WALLS YOU KEEP',
  ' WALKING INTO. NOT FOR DOORS.',
  '',
  'RX 0000105   QTY 6        $19.50',
  ' OVERLAPRIL 10MG',
  ' FOR BRICKS REJECTED BY THE',
  ' SERVER. TAKE WITH A SNAP.',
  '',
  'RX 0000106   QTY 14        $6.66',
  ' WIREX EXTRA STRENGTH',
  ' RELIEVES LOOPS, KNOTS, AND THE',
  ' SOUND OF A TWENTY HERTZ CLOCK.',
  '',
  'RX 0000107   QTY 3        $42.00',
  ' MICROBRICK PATCH (INVISIBLE)',
  ' WEAR ON ANY FLAT SURFACE.',
  ' YOU WILL NOT SEE IT WORKING.',
  '',
  'RX 0000108   QTY 60        $3.30',
  ' STUDFOLIC ACID',
  ' ESSENTIAL FOR GROWING PLATES.',
  '',
  'RX 0000109   QTY 2       $120.00',
  ' PHYSICS-B GEL',
  ' RESTORES GRAVITY. SIDE EFFECT:',
  ' FALLING.',
  '-----------------------------------',
  'SUBTOTAL                  $295.66',
  'EXTRACARE SAVINGS         -$0.02',
  'TAX (BRICK TAX 4.00%)      $11.83',
  'TOTAL                     $307.47',
  '-----------------------------------',
  'PAID WITH: 3 COINS AND A WINK',
  'YOU SAVED $0.02 TODAY!',
  '',
  'COUPON: $5 OFF YOUR NEXT SNAP',
  'EXPIRES WHEN THE SERVER RESTARTS',
  '',
  '|| ||| | |||| || ||| | ||||| ||',
  '|| ||| | |||| || ||| | ||||| ||',
  '      00471 0101 8812 3',
  '',
  '   THANK YOU FOR SHOPPING AT',
  '   THE ONLY STORE WITH A DOOR',
  '   YOU CAN WALK THROUGH.',
];

export function receipt() {
  const B = makeBuilder({ cell: 40 });
  const text = LINES.map(l => { if (l.length > W) throw new Error(`receipt line too long (${l.length}): ${l}`); return l; }).join('\n');
  const H = Math.ceil((LINES.length * LH + 30) / 2) * 2, PW = 80;
  if (!B.box(-90, -20, 0, 90, 24, 8, { asset: 'PB_DefaultMicroBrick', color: [90, 90, 96] }, 'base')) throw new Error('base dropped');
  const ok = B.box(-PW, 0, 8, PW, 4, 8 + H, {
    asset: 'PB_DefaultMicroBrick', color: [248, 248, 244],
    components: [{ type: 'Component_TextDisplay', data: {
      Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: LH, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 },
      Offset: { X: 0, Y: 0, Z: 0.2 }, Color: { R: 20, G: 20, B: 24, A: 255 }, MaterialSlider: 10, ShadingWidth: 0,
      OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0, ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45,
      GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true, Typeface: 0, Billboard: 0,
      Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true,
      bOverrideOutlineColor: true, bForeground: false, Text: text } }],
  }, 'paper');
  if (!ok) throw new Error(`paper dropped: ${B.dropped.at(-1)}`);
  return B.bricks;
}

if (process.argv[1]?.endsWith('receipt.mjs')) {
  const [X = 0, Y = 0, Z = 0] = process.argv.slice(2, 5).map(Number), out = process.argv[5] ?? 'receipt.json';
  const bricks = receipt().map(({ label, ...b }) => ({ ...b, position: [b.position[0] + X, b.position[1] + Y, b.position[2] + Z] }));
  fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000,
    externalAssets: [{ type: 'BrickFontDescriptor', name: 'IosevkaTerm' }], bricks }] }));
  console.error(`receipt: ${bricks.length} bricks`);
}
