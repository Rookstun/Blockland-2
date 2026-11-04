---
name: mapgen-style
description: "User's taste for the pzedlo big map (mapgen/mapgen.mjs) — Zelda caves, smooth terrain, no stud/underside textures in rooms"
metadata:
  node_type: memory
  type: feedback
  originSessionId: aaa412b0-f647-4ea1-b1dc-a93995cdee57
  modified: 2026-10-02T04:32:42.935Z
---

Dungeons (2026-10-02) come from `mapgen/dungeon.mjs`: Zelda temple style, 5x5 room grid per floor, 2x2-cell 3-floor atriums with galleries/balustrades/grand stairs, architectural detail only (plinth, dado, ashlar, pilasters, frieze, cornice, arched doors with keystones, light windows, view windows, coffered ceilings, patterned floors) and NO props — user asked for "attention to detail but no props, windows". After "give dungeons more room variation" (2026-10-02) rooms also merge into 2x1 halls / 2x2 great halls and each picks an interior (plain/colonnade/dais/basin), floor pattern and ceiling; `mapgen/check-dungeons.mjs --seed N` checks overlaps + flood-fill reachability. Live dungeons were swapped alone (ClearRegion each footprint + one bricks load + spawners) without a full map reload. Every generator uses the overlap guard in `mapgen/builder.mjs`; verify walkability with a gravity flood fill before deploying.

For `brickadia/mapgen/mapgen.mjs` maps, the user wants "Zelda caves, not Minecraft caves": doorways in cliff faces leading to a single room (old man + sword, chests, fires), not noise-carved tunnel networks. They want terrain smoothed with micro wedges rather than 1-brick stair steps, and called the brick-underside ceiling texture "dookie" — interior ceilings/floors use PB_DefaultTile (ceilings flipped, direction 5).

Map is 576 cells (~2300 studs), anchored at NE corner x 2900 / y 4900 to stay clear of other players' builds (big ownerless build at x 3000-6000, White House ~(-8400, 5700), spawner row y 5020). Spawn hub = 1000-stud walled town (`mapgen/town.mjs`: street grid, market square with fountain + 8 B_SpawnPoint, ~250 varied buildings incl. tavern/chapel — user said "too many houses", so on 2026-10-02 town.mjs got KEEP_INNER 0.45 / KEEP_OUTER 0.2 thinning (60 houses + tavern + chapel left) and the 132 dropped ones were ClearRegion'd live from out/town_removed.json), centre ~(-10660, -7700). Live seed as of 2026-10-01: 786559213 (pass --seed when rebuilding or the map changes). Load with `bridge/tools/loadall.mjs` (one prefab, ~480k bricks in ~33 s). A hand-requested manor (`mapgen/house.mjs` + `build-house.mjs`, overlap-guarded, owner "Claude house") replaced town block (1,5) at centre (-13040, -3720) on 2026-10-02 — a map rebuild would regenerate that block's cottages on top of it, so skip that block or rebuild the manor after.

**Why:** stated directly while reviewing the live map on 2026-10-01.
**How to apply:** keep caves Zelda-style when extending mapgen; prefer smooth tiles/wedges for visible surfaces. Wedge/ramp rotations need in-game confirmation via a test kit (see [[omegga-bridge]]).
