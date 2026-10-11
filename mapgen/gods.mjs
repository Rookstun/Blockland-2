// Made-up gods for the shrines and temples (owner 2026-10-10: "shrines with
// fake gods that are procedurally generated dwarf fortress style").
//
// Like Dwarf Fortress: a god has a short native name of two syllables, an
// epithet "the <Adjective> <Noun>" translated from it, a shape it shows itself
// as, and two or three spheres it rules over. Everything comes from
// rnd(seed, k), so a seed always makes the same god.
//
//   makeGod(seed, rnd) -> { name, epithet, form, spheres, title, colour, sign }
//   sign: the text for a shrine or temple board

const SYL1 = ['Ur', 'Zas', 'Kol', 'Ab', 'Il', 'Ser', 'Tob', 'Dak', 'Mis', 'Nish', 'Ag', 'Vab', 'Os', 'Lor', 'Edz', 'Rith', 'Gem', 'Thob', 'Ast', 'Kub'];
const SYL2 = ['ist', 'ral', 'zul', 'ok', 'em', 'tar', 'ath', 'ib', 'un', 'rak', 'esh', 'ol', 'id', 'mon', 'ug', 'ber', 'aval', 'oth', 'is', 'en'];
const ADJ = ['Gilded', 'Rusted', 'Silent', 'Weeping', 'Burning', 'Hollow', 'Frozen', 'Mirthful', 'Sunken', 'Bleeding', 'Iron', 'Last', 'Patient', 'Bitter', 'Endless', 'Crooked', 'Pale', 'Thundering', 'Drowned', 'Velvet'];
const NOUN = ['Gate', 'Mire', 'Lantern', 'Anvil', 'Thorn', 'Tide', 'Crown', 'Ember', 'Bell', 'Hammer', 'Root', 'Veil', 'Spire', 'Grave', 'Feast', 'Oath', 'Coil', 'Mirror', 'Shard', 'Hearth'];
const FORM = ['a great horned toad', 'a woman made of smoke', 'a one-eyed raven', 'a bearded giant', 'a coiled serpent', 'a burning stag', 'a child of glass', 'a stone tortoise',
  'a three-headed hound', 'a cloud of moths', 'a weeping knight', 'an old man in chains', 'a golden boar', 'a skeletal horse', 'a dwarf of iron', 'a swarm of bees'];
// spheres, each with a colour for the shrine's light and idol
const SPHERES = [
  ['fire', [255, 120, 40]], ['death', [150, 120, 200]], ['mountains', [170, 160, 150]], ['music', [255, 210, 120]], ['war', [220, 50, 40]],
  ['wealth', [250, 200, 60]], ['the sea', [60, 150, 230]], ['caverns', [120, 110, 160]], ['beer', [230, 170, 60]], ['murder', [180, 20, 30]],
  ['oaths', [220, 220, 240]], ['the moon', [200, 220, 255]], ['rust', [180, 90, 50]], ['dreams', [200, 140, 255]], ['bones', [235, 228, 210]],
  ['the harvest', [200, 190, 80]], ['storms', [140, 180, 255]], ['jewels', [80, 230, 200]], ['mischief', [140, 255, 120]], ['the forge', [255, 160, 80]],
  ['night', [90, 90, 180]], ['fortresses', [190, 180, 160]], ['pigs', [240, 160, 170]], ['silence', [210, 210, 210]],
];
const TITLE = ['god', 'goddess', 'deity', 'god'];

export function makeGod(seed, rnd) {
  const r = k => rnd(Math.imul(seed, 2654435761) >>> 7, 900 + k); // scrambled: neighbouring seeds gave neighbouring names
  const at = (list, k) => list[Math.floor(r(k) * list.length) % list.length];
  const name = at(SYL1, 1) + at(SYL2, 2);
  const epithet = `the ${at(ADJ, 3)} ${at(NOUN, 4)}`;
  const n = r(5) < 0.35 ? 3 : 2, spheres = [];
  for (let k = 0; spheres.length < n && k < 20; k++) { const s = at(SPHERES, 10 + k); if (!spheres.includes(s)) spheres.push(s); }
  const title = at(TITLE, 6), form = at(FORM, 7);
  const names = spheres.map(s => s[0]);
  const list = names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join(' and ');
  return {
    name, epithet, form, title, spheres: names, colour: spheres[0][1],
    sign: `${name} ${epithet}\n${title} of ${list}`,
    lore: `${name} ${epithet}, ${title} of ${list}, appears as ${form}.`,
  };
}
