// THE COINS OF TRUTH (was The Vice Grips of Truth; owner 2026-10-22: no more vice grips, coins. Owner 2026-10-18: "make racist randal and hes about to say something
// racist and you have to stop him and this is the main quest ... lord of the rings style story
// through npc quests ... an indiana jones segment where you have to steal green gary's weed ...
// the whole point of the quest is to get the 8 vice grips of truth because they are magic";
// then "make it more retarded and use just bullshit high fantasy names like Gildo AND FRESNIF
// AND frogo and diddly and clarn fiddilohougan", "tim and eric show bullshit name").
// Randal NEVER finishes the sentence: something always interrupts him, and at the end the eight
// coins (a paid man must tell the truth) make him say it instead. Book II design: AGAIN.md.
//
// Step types (engine in omegga.main.js):
//   talk  { to, lines[] }                message boxes, one per line, OK walks through them
//   ask   { to, msg, yes[], no }         Yes/No box: Yes plays `yes` and moves on, No shows `no`
//   say   { to, line, reply }            OK/Cancel: deliver a message, they answer
//   kill  { who: npc key | 'skeleton', n }
//   reach { at:[x,y,z], r, zMin?, zMax?, hint, lines[] }   get there (checked every second)
//   escape{ from: npc key, dist, secs, retry: step index, ok[], fail[] }  get `dist` away in time
//   back  { line? }                       return to the giver
// step.grip = completing it hands over that Coin of Truth (key kept: saved progress uses it). Chapters with `auto` start by themselves
// when the one before (`after`) ends; `intro` lines play then.
// No quotes, apostrophes or pipes in any text: the chat command that opens the box can't carry them.

const COINS = ['Gildo', 'Fresnif Prime', 'Diddly Big Fizz', 'Snorbo the Damp', 'Wet Toby', 'Frogo Bunglebuns', 'Clampton Blazeballs', 'Dorp'];

const RANDAL_INTERRUPTS = [
  'Randal: You know what the problem with those people over there is? They- (a pigeon flies directly into his mouth and lives there now)',
  'Randal: I am not racist, but- (a man named Tobbin Spleenhammer walks past playing a lute made of ham. Everyone watches. It takes a while)',
  'Randal: Here is the thing about- (he sneezes so hard the rest of the sentence comes out of his ears as steam)',
  'Randal: Let me tell you something about- (a wizard named Doug Fondlewick appears, yells HOOBASTANK, and leaves)',
  'Randal: People like that always- (his hat blows off and he chases it into tomorrow)',
  'Randal: I just think that- (a cart of wet cabbages hits him at walking speed. Nobody is hurt. The cabbages are fine)',
];

const MAIN = [
  { id: 'm1', main: 1, giver: 'randal', title: 'The Unfinished Sentence',
    ask: 'Racist Randal clears his throat and plants his big boots. You know, the problem with those people over there is that they- ... He is about to say something racist. Stop him?',
    no: 'You let him start. Luckily a pigeon flies into his mouth. The pigeon will not always be there. The pigeon has a family.',
    steps: [
      { do: 'talk', to: 'randal', lines: [
        'You lunge across the plaza and clamp your whole hand over Randal mouth. He keeps talking into your palm. It is warm and wet and extremely wordy.',
        'A hush falls over Lumbrick. A baby drops its breadcrumb. You cannot hold him forever. Your arm is already tired. It has been four seconds.',
        'An old prophecy comes to you, from a grandmother named Grumbo Teethingham who you never had: Only CLARN FIDDILOHOUGAN can close a mouth that loose. He lives by the big rocks east of town.',
      ] },
      { do: 'talk', to: 'clarn', grip: 1, lines: [
        'Clarn Fiddilohougan looks up from a bowl of soup he is not eating. Ah. A loose mouth on the plaza. I felt it in my knees. My knees are named Gorp and Lesser Gorp.',
        'Long ago, in the Before Times, the moneyer GILDO struck the Eight Coins of Truth in the moist mint-hole of FRESNIF. A paid man must tell the truth: press all eight into a fool palm, and only the truth may leave his face hole.',
        'Then Gildo sneezed, and the coins flew to the eight corners of the island. The island has eleven corners. Gildo was bad at shapes. Gildo is dead now. He died of shapes.',
        'Here. I have been using this one as a soup coaster. It is the Coin of Gildo. Go now, little Frogo. What? You are not Frogo? Everybody is Frogo to me. Go, Frogo.',
      ] },
    ], coins: 100, xp: 100 },

  { id: 'm2', main: 2, giver: 'clarn', after: 'm1', auto: true, title: 'The Fellowship of the Plaza',
    intro: ['Clarn Fiddilohougan: No Frogo carries eight coins alone. You need a FELLOWSHIP. There are three idiots on the plaza. That is a fellowship if you squint and are also an idiot.'],
    steps: [
      { do: 'talk', to: 'kevin', lines: ['Kevin: a quest?? like a real one?? ok yes. from now on call me DIDDLY OF THE MOIST HOLLOW. i do not know what it means. it just came to me'] },
      { do: 'talk', to: 'dustin', lines: ['Dustin: finally something to do. my fellowship name is Spaghett Nordo, Lord of Dinner. i am bringing a snack. the snack is also bored'] },
      { do: 'talk', to: 'daniel', grip: 2, lines: [
        'Daniel: hey guys what are we doing',
        'You tell him. You tell him everything: the sentence, the hand, the soup wizard, the eight coins, Gildo, the moist mint-hole of Fresnif. It takes eleven minutes. He nods the whole time.',
        'Daniel: oh. oh cool. i think i have one of those in my pocket. i thought it was a weird bird. i named it Fresnif Prime',
        'He hands you the Coin of Fresnif Prime. It is warm. Do not ask why it is warm. Daniel will tell you anyway. Do not let him.',
      ] },
    ], coins: 100, xp: 100 },

  { id: 'm3', main: 3, giver: 'fizz', after: 'm2', auto: true, title: 'The Two Sodas',
    intro: ['Diddly (Kevin) heard that Fizzwick at the Soda Market opens his cans with something shiny. Diddly heard this from Spaghett Nordo (Dustin), who heard it from a can.'],
    steps: [
      { do: 'talk', to: 'fizz', lines: [
        'Fizzwick: The Coin of Diddly Big Fizz! I open my cans with its edge. Every can opened this way tastes eleven percent more like a wizard named Bort.',
        'Fizzwick: I will part with it, but a Frogo must be refreshed, and my new soda needs calcium. Calcium means bones. Bones means skeletons. Go bonk five skeletons. Bonk them good.',
      ] },
      { do: 'kill', who: 'skeleton', n: 5 },
      { do: 'talk', to: 'fizz', grip: 3, lines: ['Fizzwick: Bone dry and fizzing! CALCIUM FIZZ. The drink of kings, and of guys whose skeletons are on the outside, like Dennis. Take the Coin of Diddly Big Fizz. Mind the foam. The foam bites.'] },
    ], coins: 150, xp: 150 },

  { id: 'm4', main: 4, giver: 'clarn', after: 'm3', auto: true, title: 'The Mines of Mor-Gem',
    intro: ['A carrier pigeon named Hondo Plunkett lands on your head. Note from Clarn: The fourth coin is deep in the gem cave west of the Soda Market, below the hill. Speak friend and enter. The password is friend. Or just walk in, it is a cave, Frogo.'],
    steps: [
      { do: 'reach', at: [-3600, 700, 600], r: 650, zMax: 900, hint: 'Go deep into the gem cave west of the Soda Market', grip: 4, lines: [
        'Among glowing purple rocks you find a skeleton named Snorbo holding a coin very sincerely. A note in its ribs says: I came for the gems and stayed for the coin. Mostly the coin. Also I live here now. Bye.',
        'You take the Coin of Snorbo the Damp. Somewhere in the dark a drum goes doom. Then, more quietly, doom. Then a little guy says sorry, that was me, I am Grondo, I have a drum.',
      ] },
    ], coins: 150, xp: 150 },

  // ---- the Indiana Jones segment. The set = npctalk/temple.mjs (Temple of the Stash: stepped mossy
  // tiers, dart holes, pressure plates, pedestal with THE STASH, boulder on the roof, plaque,
  // Gary's hammock). The boulder does not roll (yet): the text owns that.
  { id: 'm5', main: 5, giver: 'greengary', after: 'm4', auto: true, title: 'Raiders of the Lost Stash',
    intro: [
      'Word arrives through the swamp grapevine, which is mostly frogs named Gerald: the fifth coin is wrapped up in the legendary stash of GREEN GARY, hermit of the swamp, north of the big rocks.',
      'Also there is a war in that swamp. The Fire Homeless and the Water Homeless have been fighting since the Before Times over who gets the good bench. Do not pick a side. Both sides are wrong. Bring a hat.',
    ],
    steps: [
      { do: 'talk', to: 'greengary', lines: [
        'Green Gary snores in a hammock strung between two very tired posts. South of the swamp rises the TEMPLE OF THE STASH: a stepped mountain of red and ochre clay brick, built by Fresnif Construction LLC in the Before Times, and never once repointed.',
        'Three stairways climb its face and meet in the middle, then march up through a gatehouse to a little crenellated shrine on the very top. Ferns sprout from every ledge. Somewhere deep inside, something glows a gentle, suspicious green. It smells like a guy named Wet Toby.',
        'Green Gary (asleep): go in at the top, Plinko... the shrine has stairs down... the big room is all tiles over spikes... jump tile to tile... some tiles shoot arrows... the spikes do not hurt, they just end you... zzz',
        'Green Gary (still asleep): the stash is in the room past the tiles... and the back door goes down and out the south side... do not touch my stash, Plinko... zzz. You pat your pocket: one bag of oregano, roughly the same weight. Probably. You are not a scientist. You are Frogo.',
      ] },
      { do: 'ask', to: 'stash', msg: 'THE STASH sits on its pedestal, glowing. The plaque at the door said NO STEALING. SIGNED, GARY. Swap it for your bag of oregano in one smooth motion?',
        no: 'You stare at the stash. The stash stares back. Somewhere below, Green Gary mumbles about vibes and a guy named Plinko in his sleep.',
        yes: ['You swap them in one smooth motion. The pedestal goes click. Every dart hole goes pfft. The decorative boulder on the roof starts rocking. Far below, Green Gary opens one eye. It is red. RUN, FROGO. Get far away from the swamp, fast.'] },
      { do: 'escape', from: 'greengary', dist: 2200, secs: 45, retry: 1, grip: 5,
        fail: ['Green Gary catches you by the backpack. He is shockingly fast for a man in sandals. His sandals are named Lorbo and Flim.', 'He takes THE STASH back, pockets the oregano for later and makes you listen to his whole mixtape. It is all one song. The song is called Gary. Try again.'],
        ok: ['You burst out of the swamp, lungs on fire, stash in hand, past a Fire Homeless and a Water Homeless hitting each other with soup. Far behind you Green Gary yells something about bad karma and good snacks.',
          'Unwrapping THE STASH you find, at its heart, the Coin of Wet Toby. You give the rest to a passing goblin. He is having the best night of his life. His name is Pib.'] },
    ], coins: 200, xp: 200 },

  { id: 'm6', main: 6, giver: 'daniel', after: 'm5', auto: true, title: 'The Return of the Daniel',
    intro: ['Back in Lumbrick, Spaghett Nordo reports that Daniel has been acting weird. He keeps whispering my precious and hey guys what are we doing in the same breath, and calling himself Smeagle Diddlebottom.'],
    steps: [
      { do: 'talk', to: 'daniel', lines: [
        'Daniel: my precious... hey guys what are we doing... my PRECIOUS... my name is Smeagle Diddlebottom now',
        'Daniel has swallowed the sixth coin. Everybody knows how. He thought it was a mint. Daniel thinks everything is a mint. Clarn says this happens to a Daniel about once a week.',
        'There is only one way to get it back. Do not worry: Daniel always comes back. Usually in about two minutes. Usually as Daniel.',
      ] },
      { do: 'kill', who: 'daniel', n: 1 },
      { do: 'talk', to: 'daniel', grip: 6, lines: ['Daniel: hey guys what are we doing. also i woke up holding this coin. it says Frogo Bunglebuns on it. weird. you can have it. my only precious is you guys. and soup'] },
    ], coins: 200, xp: 200 },

  { id: 'm7', main: 7, giver: 'clarn', after: 'm6', auto: true, title: 'Mount Doom-ish',
    intro: ['Another pigeon. Same pigeon. Hondo Plunkett, again, looking tired. Note from Clarn: The seventh coin fell into the volcano at the far end of the island, past the snow and past the spooky forest. Coins of Truth do not melt. That is their whole thing. Climb to the top, Frogo.'],
    steps: [
      { do: 'reach', at: [15550, 15360, 1250], r: 1100, zMin: 1000, hint: 'Climb to the volcano crater at the far end of the island', grip: 7, lines: [
        'You climb the volcano. The heat is incredible. Your eyebrows file a formal complaint with Judge Dorbin Hotcheeks.',
        'On the crater lip, cooling in a puddle of lava, lies the Coin of Clampton Blazeballs. You pick it up with your sleeve. You no longer have that sleeve. Worth it. RIP sleeve.',
      ] },
    ], coins: 250, xp: 250 },

  { id: 'm8', main: 8, giver: 'gary', after: 'm7', auto: true, title: 'The Farthest Coin',
    intro: ['Down the volcano, at the very end of the map, regular Gary is waving. Not Green Gary. Regular Gary. Gary is always at the end of the map. That is where Gary is.'],
    steps: [
      { do: 'talk', to: 'gary', grip: 8, lines: [
        'Gary: oh hey. Kevin says hi probably. actually Kevin says sup. we are very close. he calls himself Diddly now. i support him',
        'Gary: this coin? it washed up here at the end of the map, where everything washes up eventually. it is the Coin of Dorp. i hold it to feel close to things. like Dorp',
        'Gary: take it. go stop Randal. and tell Kevin wyd from me',
      ] },
    ], coins: 250, xp: 250 },

  { id: 'm9', main: 9, giver: 'randal', after: 'm8', auto: true, title: 'The Return of the Truth',
    intro: ['Eight Coins of Truth clink in your pack: Gildo, Fresnif Prime, Diddly Big Fizz, Snorbo the Damp, Wet Toby, Frogo Bunglebuns, Clampton Blazeballs and Dorp. Somewhere on the plaza, Racist Randal is still mid-sentence. Go home, Frogo.'],
    steps: [
      { do: 'ask', to: 'randal', msg: 'Randal, held back all this time by a rotating cast of pigeons, opens his mouth once more: You know what the problem with those people- ... Pay him the Eight Coins of Truth?',
        no: 'You hesitate. A pigeon steps in for you, as pigeons do. It looks at you with disappointment. Its name is Clorp.',
        yes: [
          'You press all eight Coins of Truth into Randal palm, one at a time. He tries to make change. Nobody has change for truth. Clarn Fiddilohougan shows up to watch, eating his soup at last.',
          'The coins glow. The plaza holds its breath. Randal speaks: ...the problem with those people over there is that I have never actually met any of them. I was scared. I am lonely. And I am sorry.',
          'He bursts into tears. Diddly hugs him. Spaghett Nordo hugs him, mostly out of boredom. Daniel asks what we are doing, and for once everybody knows. Somewhere, Gildo smiles. Gildo is still dead.',
          'THE COINS OF TRUTH. THE END. Randal has joined a book club. The book club is called Fresnif. Nobody knows why.',
        ] },
    ], coins: 1000, xp: 1000 },
];

const IDLE = {
  randal: RANDAL_INTERRUPTS,
  randalReformed: ['Randal: hey friend. book club is reading a book about a guy named Plorbus who learns something. i relate', 'Randal: i met some of those people over there. they are great. one of them taught me to whittle a little Gildo'],
  clarn: ['Clarn Fiddilohougan: Seven down across, a wizard who is not grey and not white. Five letters. Hmm. Clarn. No. That is four. Hmm.', 'Clarn Fiddilohougan: Never trust a pigeon that knows your name. Unless it is Hondo Plunkett. Hondo is a professional.'],
  stash: ['THE STASH glows on its pedestal. It does not need you right now. It has Gary.', 'THE STASH hums faintly. It smells like oregano now. Somebody swapped it. Somebody named Frogo.'],
  greengary: ['Green Gary: whoa. hey. you look like someone who owes me oregano', 'Green Gary: the swamp provides, man. mostly mosquitoes. and war. there is a war. i do not pick sides. i pick snacks'],
};

module.exports = { MAIN, IDLE, COINS };
