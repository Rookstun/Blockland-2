// Showcase signs + arcade row (2026-11-02, owner in chat: "place all generated content with brick count sign
// explaining prompt", "and also include arcade games and houses"). One job: every arcade cabinet prefab in a row
// south of the fun-area gallery, and a sign per build (name, brick count, the request that made it, who asked) in
// front of each gallery build (below its name sign), each cabinet, and this session's builds. Owner 'Claude Signs'.
//   node bridge-tools/showcase.mjs SLOTS.jsonl ARCMETA.json job.json [--signs-only]   (SLOTS from mapgen/gallery.mjs's 5th arg)
import fs from 'fs';

const [slotsF, metaF, out] = process.argv.slice(2);
const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000005191a5', name: 'Claude Signs', display_name: 'Claude Signs' };
const fmt = n => n.toLocaleString('en-US');
const wrap = (s, w = 38) => { const o = []; let l = ''; for (const word of s.split(' ')) { if ((l + ' ' + word).trim().length > w) { o.push(l); l = word; } else l = (l + ' ' + word).trim(); } if (l) o.push(l); return o; };
const sign = (x, y, lines) => {
  const hw = Math.min(170, Math.max(60, Math.max(...lines.map(l => l.length)) * 4)), hh = 6 + lines.length * 8;
  return { asset: 'PB_DefaultMicroBrick', color: [24, 28, 40], size: [Math.round(hw), 3, hh], position: [Math.round(x), Math.round(y), hh], components: [{ type: 'Component_TextDisplay', data: {
    Font: 0, Rotation: 0, Skew: 0, Kerning: 0, LineHeight: 16, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 },
    Offset: { X: 0, Y: 0, Z: 0.2 }, Color: { R: 255, G: 236, B: 160, A: 255 }, MaterialSlider: 10, ShadingWidth: 0,
    OutlineColor: { R: 0, G: 0, B: 0, A: 255 }, OutlineWidth: 0, ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45,
    GraffitiLayer: 0, bEnabled: true, Face: 3, bAlignToWedge: false, bOverrideColor: true, Typeface: 0, Billboard: 0,
    Material: 0, Shading: 0, bFlipShading: false, Outline: 0, bSharpCorners: true, bSharpOutlines: true,
    bOverrideOutlineColor: true, bForeground: false, Text: lines.join('\n') } }] };
};
const card = (name, n, prompt, who) => [name, `${fmt(n)} bricks`, ...wrap(`"${prompt}"`), `- ${who}`];

// requests, from notes/ and the generators' headers
const P = {
  office: ['build an office building to trick someone into thinking it was real', 'renderman'],
  chateaureve: ['research house, use tavistock model to create a new mapgen', 'renderman'],
  whitetail: ['design and build this house (718 White Tail Ridge Dr)', 'renderman'],
  brynwood: ['one to one floorplan ... experiment with diagonal geometry', 'renderman'],
  witherspoon: ['research house then build', 'renderman'],
  tungbastion: ['a Tung Tung Sahur megastructure bastion, brutalist', 'Fjompen'],
  tavistock: ['build a prototype, use floorplan and house photos', 'renderman'],
  longbrooke: ['remake it ... working door 3.0x6.2 ... dont use meshing', 'rus'],
  georgian: ['build this with the generator', 'renderman'],
  splitlevel: ['make houses that can look like this', 'renderman'],
  dutchcolonial: ['make this house in brickadia as a procgen house', 'renderman'],
  pizzahut: ['a Pizza Hut', 'renderman'],
  derwent: ['research this house ... build it', 'renderman'],
  mosque: ['a mosque', 'renderman'],
  explosion: ['build an explosion', 'Fjompen'],
  mousehouse: ['a house shaped like a cartoon mouse', 'Fjompen'],
  shoe: ['build me a shoe to live in just raw dog it', 'renderman'],
  tungsahur: ['a monument of the Tung Tung Sahur log', 'Fjompen'],
  quiltbottom: ['Princess Quiltbottom', 'Lasse'],
  bowling: ['two bowling balls with a pin between them', 'Lasse'],
  herobrine: ['Herobrine', 'Fjompen'],
  sushi: ['a sushi platter', 'a player'],
};
const ARC = [
  ['clown', 'CRACK CLOWN', 'clown rips people in half, eats them, collects crack', 'renderman'],
  ['superpenisman', 'SUPER PENIS MAN', 'Super Penis Man', 'renderman'],
  ['supersigmas', 'SUPER SIGMAS', 'rizz and mog alphas and looksmax', 'renderman'],
  ['freddy', 'FREDDY GOT FINGERED', 'the official freddy got fingered movie tie in game', 'renderman'],
  ['itwasntme', 'IT WASNT ME', 'It Wasnt Me', 'renderman'],
  ['zeldoy', 'ZELDOY', 'zelda but he diabetes and crohns and asthma', 'renderman'],
  ['brickdoom', 'BRICK DOOM', 'Brick Doom', 'renderman'],
  ['mildorsplume', 'MILDORS PLUME', 'make cave story using nothing but wires', 'renderman'],
  ['nes', 'NES', 'an NES on a chip', 'renderman'],
  ['thirteen', 'THIRTEEN CANDLES', 'a memorial walk', 'renderman'],
  ['pacman', 'PAC-MAN', 'games like ddr that are wire only ... Pac-Man', 'renderman'],
  ['ddr', 'DDR', 'a DDR cabinet, wires only', 'renderman'],
];
const slots = fs.readFileSync(slotsF, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const meta = JSON.parse(fs.readFileSync(metaF, 'utf8'));
const SIGNS_ONLY = process.argv.includes('--signs-only');   // cabinets already in the world
const bricks = [], ops = [];
for (const s of slots) bricks.push(sign(s.sx, s.sy - 20, card(s.text, s.n, ...P[s.name])));
// arcade row along y -16450, cabinets facing -y, 80 between
let x = 100;
for (const [k, name, prompt, who] of ARC) {
  const m = meta[k], cx = x - m.lo[0], cy = -16450, z = m.lo[2] < 0 ? 4 : 0;
  if (!SIGNS_ONLY) ops.push({ op: 'cmd', line: `br.Prefab.Load "${k}" ${cx} ${cy} ${z} 0 16`, captureMs: 1500 });
  bricks.push(sign(cx, cy + m.lo[1] - 30, card(name, m.n, prompt, who)));
  x = cx + m.hi[0] + 80;
}
// this session's builds
bricks.push(sign(2565, -11085, card('LONGBROOKE (rus site)', 3227, 'remake it ... working door 3.0x6.2 ... dont use meshing', 'rus')));
bricks.push(sign(-2440, -10950, card('CRACK CLOWN', meta.clown.n, 'put my clown murder game down please', 'renderman')));
bricks.push(sign(-2040, -11140, card('DDR', meta.ddr.n, 'make me ddr', 'Chay')));
bricks.push(sign(-2240, -11140, card('DDR5 STICK', 100, 'make me ddr5 ram', 'Chay')));
bricks.push(sign(-2240, -11262, card('TRIDENT Z5 ROYAL 64GB', 118, 'generate me a stick of trident z5 royal ddr5 ram 64 gb', 'Chay')));
bricks.push(sign(-4720, -10530, card('VANTABLACK HOUSE', 2834, 'make me a house painted with vantablack paint', 'Chay')));
bricks.push(sign(-2775, -10045, card('A BRICK', 1, 'build a brick', 'renderman')));
fs.writeFileSync(out, JSON.stringify({ ops: [{ op: 'clear', owner: OWNER.id }, ...ops, { op: 'bricks', at: [0, 0, 0], owner: OWNER, captureMs: 4000, externalAssets: [{ type: 'BrickFontDescriptor', name: 'MonaspaceXenon' }], bricks }] }));
console.log(`${ops.length} cabinets, ${bricks.length} signs, arcade row x 100..${x}`);
