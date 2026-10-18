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

## Current build (v3): `npctalk/temple.mjs`
```
node npctalk/temple.mjs <abs path tools/brs4/dist.mjs> mapgen/out_site_1018vend npctalk/qout/temple3_live.json npctalk/qout
```
- Outputs: `qout/temple.brz` (brs-js 4 prefab, has wires), `temple_clear0..4.json` (paced ClearRegions of
  trees/bushes in the footprint), `temple_load.json` (`br.Prefab.Load "temple" 2400 5250 200 0 16`),
  `temple_preview.json` (for `node mapgen/isoview.mjs <json> CX CY HALF out.png [az] [elev] [upp] [zMin]`).
- Layout: 5-tier ziggurat centred world (2400, 5250), 920 x 900, tiers top 520/680/820/920/1000.
  Local coords u = x-2400, v = y-5250. Interior floor z 520.
  - Grand stair (decor) |u|<100 up the north face to a blind summit shrine + boulder.
  - Real entrance: side stair u -300..-180 north of the T1 face to the first ledge (z 520), corbelled
    portal in the T2 north face at u -280..-200.
  - Rooms (ROOMS in the file): G arrow gallery u -280..-200 v -60..380 (7 trap rows), A antechamber
    u -300..-60 v -270..-60, P pit hall u -40..200 v -270..130 (pit v -230..100, bottom 400, spikes,
    pillars 530/580/620/570, way-out steps on the west wall), S sanctum u -40..200 v 150..280 (stash at
    u 80 v 215 = world 2480,5465), E exit tunnel u 200..390 v 200..260 out the T2 east face.
- Mechanics: trap tile = `Component_Internal_AttachedZone` (players, ZoneEndDistance 60); per row the two
  zones' bOccupied OR'd (hidden gates above the summit) -> `Component_ProjectileSpawner` bEnabled on the
  dart bricks (ProjectileClass ext {type BRWeaponProjectile, name Projectile_Bow_Charged}, Direction 0 = X+,
  1 = X-, FireRate 2, DamageMultiplier 0.35). Firing proven in the sky by `npctalk/traptest.mjs`; the
  step-on trigger is NOT yet seen with a player. Spikes = PB_Spike + `Component_Damage` 25 / 0.5 s.
  Stash brick = `Component_Interact` ConsoleTag `event:quest:stash` (quests plugin THINGS.stash).
- Old versions: `temple_v1.mjs` (mossy tiers), `temple_v2.mjs` (small ziggurat, one room).

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
- Walk it in game: trap trigger, spike damage, pillar jumps, stash swap, escape (45 s, 2200 from Green Gary).
- A boulder that actually rolls during the escape.
- More rooms/puzzles at player scale.
