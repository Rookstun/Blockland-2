// Sidebar catalogue: tune() key prefixes -> generator pages (title, icon, blurb).
// The sidebar orders them by the generation pipeline (../pipeline.mjs): each page
// sits under the phase of the first stage that reads it. Keys whose prefix no stage
// lists land in "Other", so new tune() calls show up on their own.
import { PHASES, STAGES } from '/pipeline.mjs';

export const CATEGORIES = [
  { name: 'World', groups: [
    { id: 'world', title: 'World', icon: 'globe', blurb: 'Sea level. The sea is the game\'s water plane, so a new level also needs the sea environment preset re-applied after a deploy.' },
    { id: 'island', title: 'Island shape', icon: 'spline', blurb: 'A long island along a curved spine (Catmull-Rom through the points), starting behind the spawn town. Drag the handles on the preview: circles move points, squares set the half-width. The tail goes on past the far end and holds the death forest and volcano.' },
    { id: 'terrain', title: 'Terrain noise', icon: 'wave', blurb: 'The heightmap: lowland fbm hills, ridged mountains gated by a patch mask that grows up the island and round the Mountain Deep, and a ragged coast falling to the sea bed. Pick a noise layer on the preview to see each field on its own.' },
    { id: 'smooth', title: 'Smoothing', icon: 'slope', blurb: 'Micro wedge smoothing of terrain steps and the seabed.' },
  ] },
  { name: 'Water', groups: [
    { id: 'river', title: 'River', icon: 'river', blurb: 'The river through town: course, width, valley profile, water levels per reach, the valley cap that stops sawtooth risers, and rock weirs at level steps.' },
    { id: 'delta', title: 'River delta', icon: 'fan', blurb: 'A fan of distributary arms, creeks, sand banks, marsh and lagoons where the river meets the sea.' },
    { id: 'cove', title: 'Coves', icon: 'cove', blurb: 'Carved bays with sea stacks, an arch, kelp, moss and beaches along quiet coast.' },
  ] },
  { name: 'Biomes', groups: [
    { id: 'swamp', title: 'Swamp', icon: 'drop', blurb: 'A marsh near town with env water and zombies.' },
    { id: 'desert', title: 'Desert', icon: 'sun', blurb: 'Dunes, mesas and the gun store.' },
    { id: 'snow', title: 'Snow peaks', icon: 'snow', blurb: 'Ridged peaks raised over a region far up the island.' },
    { id: 'volcano', title: 'Volcano', icon: 'fire', blurb: 'Basalt cone at the tail tip with a crater lava lake, lava runs and a spiral road.' },
    { id: 'shrub', title: 'Shrubland', icon: 'leaf', blurb: 'Scrub ground patch.' },
    { id: 'nordic', title: 'Viking hamlet', icon: 'axe', blurb: 'A nordic hamlet with its own snowfall west of town.' },
    { id: 'death', title: 'Death forest', icon: 'skull', blurb: 'Dead trees, graves and skull pikes on the tail between the snow and the volcano.' },
  ] },
  { name: 'Settlements', groups: [
    { id: 'village', title: 'Hamlets', icon: 'house', blurb: 'Hamlets with shops tiered by distance from town.' },
    { id: 'ruins', title: 'Ruins', icon: 'ruin', blurb: 'Abandoned settlements.' },
    { id: 'goblins', title: 'Goblin camps', icon: 'tent', blurb: 'Camps with spawners.' },
    { id: 'outposts', title: 'Outposts', icon: 'tower', blurb: 'Lone outposts with two spawners each, tiered by progress.' },
    { id: 'spawnring', title: 'Spawn ring', icon: 'ring', blurb: 'Spawners round the spawn town.' },
    { id: 'henge', title: 'Wizard henge', icon: 'henge', blurb: 'Stone circle with wizards, near spawn on the side away from the river.' },
    { id: 'holy', title: 'Temples & shrines', icon: 'temple', blurb: 'Wayside shrines and temples.' },
    { id: 'roadside', title: 'Roadside buildings', icon: 'house', blurb: 'Taverns, warehouses, chapels, a library and a dining hall standing alone by the roads.' },
    { id: 'wshop', title: 'Weapon shops', icon: 'sword', blurb: 'Armories and gunsmiths on roomy lots by the roads (picked last so older sites keep their spots).' },
  ] },
  { name: 'Dungeons', groups: [
    { id: 'dungeon', title: 'Dungeons', icon: 'door', blurb: 'Buried Zelda temples shared settings. Each one sits at a point up the island (progress t, sideways offset) and swells a hill over itself where the land is low.' },
    { id: 'crypt', title: 'Hollow Crypt', icon: 'pin', blurb: '3 floors, tiers 1-3.' },
    { id: 'keep', title: 'Sunken Keep', icon: 'pin', blurb: '4 floors, tiers 2-5, plus the surface keep over its roof.' },
    { id: 'deep', title: 'Mountain Deep', icon: 'pin', blurb: '5 floors, tiers 3-7. Its anchor also centres a mountain ring (terrain.deepR / deepIn).' },
    { id: 'caves', title: 'Caves', icon: 'cave', blurb: 'Minecraft-style worm tunnels with caverns, or Zelda rooms.' },
  ] },
  { name: 'Roads & decor', groups: [
    { id: 'road', title: 'Roads', icon: 'road', blurb: 'Graded roads: embankments and the stud-fine ride surface.' },
    { id: 'checkpoint', title: 'Checkpoint shrines', icon: 'flag', blurb: 'Roadside checkpoint shrines.' },
    { id: 'signs', title: 'Fingerposts', icon: 'sign', blurb: 'Signposts pointing to the nearest places.' },
    { id: 'details', title: 'Details', icon: 'barrel', blurb: 'Logs, cairns, carts and other scatter.' },
    { id: 'bush', title: 'Bushes', icon: 'leaf', blurb: 'Smashable bushes.' },
  ] },
];

// [{ name, phase, groups }] in pipeline order
export function pipelineCategories() {
  const meta = new Map(CATEGORIES.flatMap(c => c.groups).map(g => [g.id, g]));
  const seen = new Set();
  return PHASES.map(ph => ({
    name: ph.title, phase: ph,
    groups: STAGES.filter(st => st.phase === ph.id).flatMap(st => st.groups).filter(g => !seen.has(g) && seen.add(g)).map(g => meta.get(g) || { id: g, title: g, icon: 'dot', blurb: '' }),
  })).filter(c => c.groups.length);
}
export { PHASES, STAGES };

// keys previewed instantly in the browser (terrain.mjs); markers for these move live too
export const INSTANT = /^(terrain\.|island\.|sea$|deep\.(t|off)$)/;
export const MARKER = /^(crypt|keep|deep|henge)\.(t|off)$/;

export const groupOf = k => (k.includes('.') ? k.slice(0, k.indexOf('.')) : 'world');

// cross-field checks, shown like misode's validation errors: [message, keys]
export function validate(get) {
  const out = [];
  const chk = (bad, msg, ...keys) => { if (bad) out.push({ msg, keys }); };
  const sp = get('island.spine'), hf = get('island.half'), tl = get('island.tail'), th = get('island.tailHalf');
  chk(!Array.isArray(sp) || sp.length < 2, 'The spine needs at least 2 points.', 'island.spine');
  chk(Array.isArray(sp) && Array.isArray(hf) && sp.length !== hf.length, `Spine has ${sp?.length} points but ${hf?.length} half-widths.`, 'island.spine', 'island.half');
  chk(Array.isArray(tl) && Array.isArray(th) && tl.length !== th.length, `Tail has ${tl?.length} points but ${th?.length} half-widths.`, 'island.tail', 'island.tailHalf');
  chk(get('terrain.oceanStart') >= get('terrain.oceanEnd'), 'Coast falloff start must be below its end.', 'terrain.oceanStart', 'terrain.oceanEnd');
  chk(get('terrain.wildStart') >= 1, 'Mountains must start before progress 1.', 'terrain.wildStart');
  chk(get('terrain.deepIn') >= get('terrain.deepR'), 'Deep ring inner radius must be below the outer.', 'terrain.deepIn', 'terrain.deepR');
  chk(get('terrain.oceanFloor') >= get('sea'), 'The sea bed is above sea level: no sea.', 'terrain.oceanFloor', 'sea');
  chk(get('river.slope') > get('smooth.maxRise'), 'River valley slope is steeper than the tallest wedged step: bare risers.', 'river.slope', 'smooth.maxRise');
  chk(get('river.capSlope2') > get('smooth.maxRise'), 'Valley cap slope is steeper than the tallest wedged step.', 'river.capSlope2', 'smooth.maxRise');
  chk(get('volcano.crater') >= 1, 'Crater wider than the cone.', 'volcano.crater');
  for (const k of ['crypt.t', 'keep.t', 'deep.t', 'henge.t']) chk(get(k) < 0 || get(k) > 1, 'Progress runs 0 (town) to 1 (far end).', k);
  return out;
}
