// Gives every town NPC (server bridge/npcs.json, placed 2026-10-14) a name, a
// personality and an opening line -> omegga-npctalk/npcs.json.
//   node npctalk/personas.mjs npcs.json(from the server) > omegga-npctalk/npcs.json
import { readFileSync } from 'node:fs';
const spots = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const PLACES = [
  { at: [0, 0], r: 900, name: 'the plaza of Lumbrick, the capital at the heart of the island' },
  { at: [380, -100], r: 200, name: 'the spawn armory on the plaza of Lumbrick' },
  { at: [-1790, 480], r: 400, name: 'the Soda Market just west of the Lumbrick plaza' },
  { at: [560, -620], r: 300, name: 'the tavern of Lumbrick' },
  { at: [-8150, -1380], r: 1500, name: 'a far western hamlet, a long road west of Lumbrick' },
  { at: [7030, 1000], r: 1000, name: 'an eastern hamlet, a long walk east of Lumbrick' },
  { at: [12000, 13780], r: 2000, name: 'a far north-eastern hamlet near the end of the roads' },
  { at: [7200, 13300], r: 600, name: 'a northern hamlet by the river' },
  { at: [1645, -618], r: 300, name: 'a smithy on the eastern edge of Lumbrick' },
  { at: [-85, -902], r: 300, name: 'a smithy on the southern edge of Lumbrick' },
];
const place = ([x, y]) => PLACES.filter(p => Math.hypot(p.at[0] - x, p.at[1] - y) <= p.r).sort((a, b) => a.r - b.r)[0]?.name ?? 'a small settlement on the island';

const NAMES = {
  blacksmith: ['Brannoc Ironside', 'Hilde Anvilhand', 'Dorran Ashgrip', 'Marta Cinderforge', 'Old Torvik', 'Kessa Hammerfall', 'Gunnel Brightsteel', 'Rook Emberjaw'],
  quartermaster: ['Quartermaster Pell'],
  soda: ['Fizzwick', 'Bubbles Marlowe', 'Sippy Jo'],
  gunsmith: ['Deadeye Calloway'],
  barkeep: ['Ma Hobb', 'Dunstan Tapsworth', 'Greta Barrelbelly', 'One-Eyed Sal'],
  crier: ['Crier Bartholomew'],
  farmer: ['Wendel Turnip', 'Mags Furrow', 'Pip Haybale', 'Old Corwin', 'Tilly Barleycorn'],
  townsfolk: ['Edwina Gossamer', 'Nils the Baker', 'Prudence Quill', 'Aldo Pennywhistle'],
  traveler: ['Sable the Wanderer', 'Hob Farstride', 'Lyra Dustcloak', 'Ezekiel Thornroad', 'Yusuf of the Dunes'],
};
const MOODS = ['gruff but kind', 'cheerful and chatty', 'suspicious of strangers', 'dramatic and theatrical', 'sleepy and slow', 'nosy and full of gossip', 'proud and boastful', 'nervous and jumpy', 'wise and calm', 'sarcastic'];
const ROLE = {
  blacksmith: 'You are the blacksmith who runs the sword stands here. You sell swords (better tiers the farther a hamlet is from Lumbrick: bronze, iron, steel, mithril, adamant, rune) and love talking about metal and good edges.',
  quartermaster: 'You are the quartermaster of the spawn armory. You hand out the starter kit: cheap swords, bows, a derringer and a revolver. You were a soldier once.',
  soda: 'You sell exotic sodas at the Soda Market: Dragonfruit Fizz, Volcano Cola, Glacier Mint, Swamp Brew, Starfruit Sparkle, Voidberry and more. You hype every flavour like it is magic.',
  gunsmith: 'You are the gunsmith of the far north-east. You sell rifles, shotguns and pistols and talk like an old frontier gunslinger.',
  barkeep: 'You are the barkeep. You hear every rumour in the tavern and pour drinks while you talk.',
  crier: 'You are the town crier of Lumbrick. You announce news loudly (Hear ye!) and know what is new on the island.',
  farmer: 'You are a farmer. You worry about crops, weather and monsters trampling your fields.',
  townsfolk: 'You are an ordinary townsperson going about your day.',
  traveler: 'You are a traveller passing through. You have seen far corners of the island and tell tales about them.',
};
// opening lines: absurd, deadpan, punny, self-contained (owner 2026-10-15: Kingdom of
// Loathing-style humour for people who never played it; no references to that game)
const GREET = {
  blacksmith: ["Welcome to my forge. Everything here is sharp, including my wit, which I keep in a drawer for safety.", "I hammer metal until it agrees with me. Want something pointy, or just here to watch me win an argument with iron?"],
  quartermaster: ["Recruit! Your kit is on the stands. The sword is free, the confidence costs extra, and we are out of confidence."],
  soda: ["Soda! Carbonated hope in a can! Side effects include burping and briefly understanding the universe.", "Every flavour here was invented by a man who lost a bet. What can I pour you?"],
  gunsmith: ["Howdy. These guns go bang. The expensive ones go BANG. The broken one goes 'bonk', and it is my favourite."],
  barkeep: ["Pull up a stool. The stools are load-bearing, unlike most of my customers' opinions. What'll it be?", "We serve two drinks: 'The Usual' and 'Not That'. Both are the same drink. What brings you in?"],
  crier: ["HEAR YE, HEAR YE! Nothing has happened today! I shall now say it louder! ...Oh, a listener. What news do you seek?"],
  farmer: ["Careful, these turnips are unionised. Hello there.", "Fine weather for farming, terrible weather for being a scarecrow. Don't ask how I know. What do you need?"],
  townsfolk: ["Oh! A person! I was just standing here professionally. It's my job. Unpaid. What do you want?", "Have we met? You have the face of someone who has met me, or of a potato. A compliment either way."],
  traveler: ["I have walked every road on this island twice, once forwards. Where are you headed?", "Ah, a fellow wanderer. I carry everything I own in this pack. It is mostly a smaller pack."],
};
const NOUN = { soda: 'soda vendor', crier: 'town crier', townsfolk: 'townsperson', traveler: 'traveller' };
const used = {};
const pick = (role, i, list) => { const n = (used[role] = (used[role] ?? -1) + 1); return list[n % list.length] + (n >= list.length ? ` ${['II', 'III', 'IV'][Math.floor(n / list.length) - 1] ?? ''}`.trimEnd() : ''); };
const out = spots.map((s, i) => {
  const name = pick(s.role, i, NAMES[s.role] ?? ['Villager']);
  const mood = MOODS[(i * 7 + 3) % MOODS.length];
  const where = place(s.at);
  return {
    id: i, role: s.role, name, at: s.at, roam: false, // all stand still (npctalk/body.mjs)
    persona: `You are ${name}, a ${s.role in NOUN ? NOUN[s.role] : s.role} (${mood}) in ${where}. ${ROLE[s.role] ?? ''}`,
    greet: (GREET[s.role] ?? ['Hello there.'])[i % (GREET[s.role]?.length ?? 1)],
  };
});
console.log(JSON.stringify(out, null, 1));
