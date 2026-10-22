# BOOK II: THE AGAIN (design only, NOT BUILT)

Written 2026-10-22 for later. Follows Book I (story.js m1..m9, live). Owner rules for this book:
whole server works together, NO vice grips (10 coins instead), a statue at spawn that changes
with the coins in its slots, all 10 = huge boss fight, winning resets the server, frees everyone and
regenerates the world.

TODO when building: live Book I still talks about "Vice Grips of Truth" (story.js step.grip, m1-m9
text). Rename to the coins or reword so Book II doesn't contradict it. Book I's ending gives each
player their **Mark** (personal, needed to count toward a trial) instead of grips.

## The truth
Book I ends with Randal finally saying the truth:

> "Every few hours **the Again** comes. It folds the island up and puts it back the way it was.
> The monsters come back. The dead come back. You keep your strength, but the world forgets
> what you did. It has happened thousands of times."

Nobody believes him except **Daniel**, who has been killed in every loop and remembers all of it.
The Again is a god in **the Hollow Clock** under the volcano. It is why bots respawn, buildings
vanish overnight and new ones appear (restarts, regens, wipes = in-world). It was paid to do this
long ago with **10 coins**, the Unspent Coins. Put all 10 back in the Founder's hand and the
payment is returned: the Again has no job left, and it fights.

## The statue (spawn plaza)
**The Unspent**: a statue at spawn with 10 empty coin slots round its plinth. It changes with
every coin in the slots, so the whole server can see progress just by walking past.

| Coins | Statue |
|---|---|
| 0 | Hooded stone figure, hand held out empty, head bowed. Clock face where its chest should be, ticking. |
| 1 | The coin slot glows. The clock in its chest skips a tick. |
| 2 | Hood cracks; stone face visible, eyes shut. |
| 3 | Moss and flowers grow on the plinth (the Again can't reset them anymore). |
| 4 | Head lifts. Eyes open, faint glow. |
| 5 | Chest clock hands stop. Plinth rings: "half paid". |
| 6 | Stone arm turns to bronze. |
| 7 | The whole statue bronze; a cape starts to move (wind, though there is none). |
| 8 | Its open hand closes into a fist round the coins. Ground cracks around the plinth. |
| 9 | Statue stands taller, light pours from the cracks, low hum across spawn. |
| 10 | Statue turns to face the volcano and points. The plinth opens: stairs down to the Hollow Clock. Server-wide message: "The Clock is open. Bring everyone." |

If a coin is lost, the statue goes back one stage (the moss dies, the eyes close, etc.).

`talk` the statue = which trials are open, pool totals, which coin is under threat, and the
helper list (top contributors by name).

## The 10 coin trials
None can be done solo. Types:
- **TOGETHER**: N players at different spots within a few seconds.
- **POOL**: server-wide total, built up over days.
- **HOLD**: players survive in an area for a set time.

Only players with their Mark (Book I done) count. Counts drop to 2 with 2-3 players online;
never below 2 (coin 8). Everyone who took part gets the credit and the same reward.

| # | Coin | Type | What the server has to do |
|---|---|---|---|
| 1 | **Coin of the Unfinished Sentence** | TOGETHER (4) | 4 players talk to Randal within 10 s; each hears a different word of his sentence and they put it together in chat |
| 2 | **Coin of Fellowship** | TOGETHER (3) | Players next to Kevin, Dustin and Daniel at the same moment say "bet" together |
| 3 | **Coin of Two Sodas** | POOL | 500 skeleton kills server-wide (Fizzwick counts them) |
| 4 | **Coin of Mor-Gem** | POOL | 200 gems mined server-wide; the coin is inside the 200th |
| 5 | **Coin of the Lost Stash** | HOLD (3+) | One player grabs it from Green Gary; 3+ others keep him chasing them while the carrier reaches the swamp edge |
| 6 | **Coin of the Daniel** | TOGETHER (5) | Daniel killed by 5 different players within 20 s (he swallowed it). Dustin is not allowed to be one of them and is furious |
| 7 | **Coin of Mount Doom-ish** | HOLD (4+) | Hold the volcano crater rim 3 min against both Homeless armies; everyone dead = restart |
| 8 | **Coin of the Farthest Reach** | TOGETHER (2) | One player at the end of the Death Forest and one at the top tier of the tallest mountain at the same moment; the coin appears in the middle of the island |
| 9 | **Coin of the House** | TOGETHER (4) | 4 players playing the 4 casino games (slots, flip, dice, roulette) on the same spin; all 4 must lose. The house always wins, so the house pays out the coin |
| 10 | **Coin of the Tide** | TOGETHER (3) + HOLD | 3 players under the sea arches of 3 different coves at once; then the coin washes up on one beach and they hold it 2 min against the Cove Hermit's crabs |

## The Again fights back (vigils)
- Before every rewind (real server restart) the statue marks one coin **under threat**: its slot
  flickers and chat is told which one.
- To keep it, at least one player must be standing at the statue when the rewind hits (the vigil).
- Nobody there = the coin goes back to its trial, the statue loses a stage. POOL trials restart at
  half ("the Again is lazy").
- Clarn shows up at every vigil and narrates it like a war.

## The raid: the Hollow Clock
Opens only with all 10 coins in the slots at once. 10-minute muster after the statue opens, then
the stairs close: whoever is inside fights.

1. **The Hands.** Hour and minute hand on opposite sides of the arena; each can only be hurt while
   someone stands on its counterweight plate (2+ teams: plate + attackers). Each broken hand
   takes 5 coins from the statue to pin it.
2. **The Reruns.** Every enemy type on the island at once, 4 waves from 4 gates. A fallen gate
   doubles the wave. NPC allies fight too: Dustin, Kevin, Green Gary, the united Homeless armies,
   plus echo NPCs (side quest S3).
3. **The Rewind.** Arena shrinks from the edges. 10 pendulums (one per coin): each one held still
   by a player buys 10 s. Survive 60 s, everyone alive reaches the clock face.
4. **Midnight.** The face cracks; inside is a small tired thing that has reset the world alone
   forever. Everyone in the raid votes (Yes/No, majority): let it rest, or kill it. Either way it
   stops. The vote and its margin go to chat.

**Raid lost:** "Again." Everyone thrown back to spawn, the Again takes 2 coins (statue drops 2 stages).

## The Unmaking (the real reset)
1. Everyone online is freed: server-wide message "The Again is dead. Nothing has to happen twice."
   Every NPC gets a last line (Daniel: "I get to stay dead if I want. I don't want to." Dustin hugs
   him). The statue walks off its plinth and leaves.
2. The world is unmade and regenerated: NEW SEED, new island.
3. Everyone keeps XP, levels, coins (progress plugin, keep-XP rule). Titles: **Breaker of the
   Again** (raiders), **Keeper of the Coin** (anyone who helped a trial or held a vigil),
   **Witness** (online at the Unmaking).
4. First monument on the new island lists every name the statue recorded.
5. Book III starts with Daniel at the new spawn: "...huh. it's different."

## Side quests
- **S1 Groundhog Kevin**: talk to Kevin in 3 different loops (after real restarts); the 3rd time
  he hands you a coin-shaped rock "from last time" (useless, sentimental).
- **S2 Daniel's Tally**: Dustin wants to break his record. Ask Daniel; yes = escape Dustin 30 s
  while Daniel cheers. Reward: a mark on Daniel's tally stick with your name.
- **S3 Things the Again Kept**: reach the spots of removed buildings (spawn bank, tavern, soda
  market, a temple); each has an echo NPC who doesn't know it's gone. All 4 = they fight in the raid.
- **S4 Clarn's Proof**: stand on the plaza through a real restart, talk to Clarn after. He has
  measured the Again to "about a while."

## Build notes
- Winning triggers a REAL full regen (new seed, wipe + load + extras + XP restore). Clashes with
  NO LIVE REGENS: allowed only as the boss-win exception, and the owner confirms each time.
- Rewind = the existing Omegga auto-restart (daily 2 h, 48 h max). Coin state + statue stage must
  survive restarts (plugin store), and the vigil check runs just before a restart.
- Statue = 11 stage prefabs (0-10), swapped at spawn per coin count (or one prefab with
  BrickPropertyChanger parts driven by a coin-count wire input).
- New pieces: statue + slots, coin trials (TOGETHER timing windows, server pools, HOLD zones),
  raid arena under the volcano, Again hands as high-health spawners, plates/gates/pendulums,
  raid vote, server-wide messages.
