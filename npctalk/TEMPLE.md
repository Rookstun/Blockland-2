# Temple of the Stash: handoff (2026-10-18)

Indiana Jones set for main quest chapter 5 (Raiders of the Lost Stash, `omegga-quests/story.js`).
Live in world `site 2026-10-18` (active), saved. Also read the QUESTS / MAIN QUEST notes in `CLAUDE.md`.

## Owner requirements (in their words, cumulative)
- "Central grand stepped staircase / Exposed ancient red and ochre clay brickwork / Weathered, eroded
  mortar joints / Corbelled brick archways / Carved stone bas-reliefs depicting ancient symbols /
  Ferns rooted within brick masonry joints / trap floor tiles that shoot an arrow at you / spike pits
  and platforming"
- On v2 in game: "pit way too small. use micro bricks instead of regular bricks, tile block placed
  upside down, several rooms, players can jump 30 studs long 9 blocks tall and are 4 blocks tall exactly"
  -> PLAYER: 48 units tall, jump 300 long / 108 high. Build everything at that scale, micro bricks only, no tiles.
- On v3, with a picture of Ur-Nammu's ziggurat: "bricks should be 0 spaces apart. light component torches.
  wide area for traps, 5x5 tiles you have to jump on. ferns should use the fern brick. entrance at top.
  corridors. spikes instakill no message. dark gradient downward to spikes to make them seem deeper".

## Current build (v4, Ur-Nammu style): `npctalk/temple.mjs`
```
node npctalk/temple.mjs <abs path tools/brs4/dist.mjs> mapgen/out_site_1018vend npctalk/qout/temple3_live.json npctalk/qout
```
- Outputs: `qout/temple.brz` (brs-js 4 prefab, wires), `temple_clear0..5.json` (paced ClearRegions of the
  trees/bushes in the footprint; already run), `temple_load.json` (`br.Prefab.Load "temple" 2400 5250 200 0 16`),
  `temple_preview.json` (`node mapgen/isoview.mjs <json> CX CY HALF out.png [az] [elev] [upp] [zMin]`).
- Three battered tiers (TIERS: half extents at zb, every 10-high course steps in 2): T1 512x432 at z 240 -> top 700,
  T2 360x280 700 -> 880, T3 220x170 880 -> 1000. Local u = x-2400, v = y-5250. Every course = a ring of flush
  20x10 clay bricks (8 deep, ~10% recessed 2) + hidden filler back to the core; buttress pilasters 40 wide,
  8 proud, every 120.
- Outside: central stair (|u|<60, from v 440 z 700 north to the ground), side stairs along the north face
  (v 400..448, tops at |u| 80), landing u -80..80 v 400..440 z 700, upper stair |u|<50 from the landing south
  up through the gatehouse (towers + corbelled arch on T2 top) to the crenellated SHRINE on T3 = THE ENTRANCE
  (door north, plaque, torches).
- Inside (ROOMS): SHR shrine z 1000 -> WELL switchback stairwell (flight A 1000->880 south, landing, flight B
  880->760 north) -> C1 corridor -> ANT glyph antechamber z 760 -> S2 stair down the west wall -> HALL trap hall
  z 540 (u -320..200, v -300..140): 5x5 jump tiles (pitch 80, tile 28, GU0 -190 / GV0 -250) on pillars over PIT
  (bottom 380, 724 PB_Spike, Damage 100000 no message; walls + pillars darken toward the bottom) ->
  C3 corridor -> SAN sanctum (stash at u 320 v 0 = world 2720,5250 z ~595) -> E1 stair down -> E2 tunnel out
  the south face (floor 360).
- Traps: 10 trap tiles (hash < 0.36); each trap zone ORs into its ROW darts (west wall Direction 0, east wall 1)
  and its COLUMN darts (south wall 2, north wall 3: Y directions are a GUESS, X verified). Torches = glow flame
  bricks with Component_PointLight (Radius 420, Brightness 6, warm). Ferns = B_Fern on tier ledges, stair cheeks,
  antechamber corners.
- 26,963 bricks, 76 rejected on load; live + saved 2026-10-18. Old: temple_v1/v2/v3.mjs.

## Redeploy (after editing temple.mjs)
1. Clear the live temple: `br.Bricks.Clear ea32a1c0-0000-4b0b-9a11-0000000057a5 1` (owner "Stash Temple").
2. Regenerate (above). The trees are already cleared; the clear jobs are only needed on a fresh world.
3. scp `qout/temple.brz` to server `data/Saved/Prefabs/`, run `temple_load.json` with `bridge/tools/job.mjs`,
   check the log for "Brick is overlapping" counts, then `br.World.Save`.
4. If the footprint moves: refetch live bricks there (`bridge/tools/liveedit/fetch.mjs cx cy cz hx hy hz`;
   SaveRegion skips big terrain bricks, so terrain comes from the map chunks) and run the clear jobs.

## Traps learned
- Micro brick sizes/positions must be even (odd glyph pixel size threw "off-grid").
- Big ClearRegion boxes clear nothing; one per brick, paced 120 ms (back-to-back ones get dropped).
- Job stdout over 64 KB breaks JSON parsing: write job output to a file.
- Keep all text for the quest boxes free of quotes/apostrophes/pipes.

## Open / ideas
- Walk it in game: trap trigger (and the Y dart directions), instakill spikes, tile jumps, lights, stash swap,
  escape (45 s, 2200 from Green Gary).
- A boulder that actually rolls during the escape.
- More rooms/puzzles at player scale.
