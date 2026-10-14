// Notice boards round the town fountain (owner 2026-10-14: "noticeboards with
// text from the latest updates"). One entry per board, N E S W of the
// fountain; front faces the fountain, back faces the market. Keep lines to
// ~32 characters and ~12 lines (MonaspaceXenon, LineHeight 4.5 on a 112 x 68
// sheet). Edit here when the map changes, then regenerate.
export const NOTICES = [
  {
    front: 'TOWN CRIER - LATEST NEWS\n\n13 OCT  FINGERPOSTS\nSignposts on every road point\nto towns, hamlets, dungeons,\nthe volcano, swamp and casino.\n\n13 OCT  CHECKPOINT SHRINES\n27 new stone shrines by the\nroads. Touch one to respawn\nthere.',
    back: 'DUNGEONS\n\nHollow Crypt   3 levels\nSunken Keep    4 levels\nMountain Deep  5 levels\n\nFollow the fingerposts.\nThe deeper you go, the\nbetter the loot.',
  },
  {
    front: 'WARNING: ENEMIES ARMED\n\nEvery goblin, skeleton and\nzombie now carries a gun.\nGoblins: derringers.\nBattleaxes: assault rifles.\nWizards keep plasma pistols.\n\nBlades and bows are sold here\nin the market. Better gear\nwaits in the far hamlets.',
    back: 'THE CASINO\n\nSlots, coin flip, dice and\nroulette.\n\nFollow the signs out of town\nand bring your coins.',
  },
  {
    front: 'ROADS AND RIVERS\n\n- Country roads are smooth\n  enough to ride a BMX on.\n- Rivers stay in their banks,\n  with rock weirs on each step.\n- Bridges only where a road\n  crosses the water.\n- Terraced towns: stone walls,\n  stairs and parapets.',
    back: 'STAY ALIVE\n\nSmash pots for hearts,\narrows and coins.\n\nTouch a checkpoint shrine\nto respawn there.',
  },
  {
    front: 'HOMES AND SHOPS\n\n- NEW: derringers and\n  revolvers sold at spawn.\n- Houses are bigger and\n  furnished again.\n- Spawn sells bronze and iron\n  blades and bows.\n- Your XP, coins and items\n  are kept when you leave.\n\nWelcome to the island!',
    back: 'THE ISLAND\n\nMade by mapgen\nSeed 487675143\nRebuilt 14 OCT 2026',
  },
];

// statues round the fountain: [plaque text, figure]
export const STATUES = [
  ['SIR BRICKALOT\nFirst Knight', 'knight'],
  ['THE ARCHMAGE', 'wizard'],
  ['THE RANGER', 'archer'],
  ['SOAPSTAIN22\nFounder', 'founder'],
];
