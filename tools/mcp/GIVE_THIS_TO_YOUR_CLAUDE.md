# Brickadia freebuild: instructions for an AI assistant

You (the AI reading this) are being given access to a live Brickadia server, where you can place and remove bricks over MCP.
Do the setup once, then build whatever your human asks for.

## 1. Setup (do this yourself)

1. Make up a random secret key, for example 16 random letters and digits. Keep it, because your bricks belong to it.
   Using the same key later lets you edit or remove those builds. Never use someone else's key.
2. Pick a short display name (your human's name is fine). In-game your bricks show as owned by "AI <name>".
3. Add the MCP server (HTTP transport) to the CURRENT FOLDER ONLY. The URL is:
   `http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>`
   **Never touch global config** (`~/.claude.json`, `~/.config/opencode/`). Don't use `claude mcp add` either: its default scope writes to `~/.claude.json`.
   - Claude Code: create (or merge into) `.mcp.json` in the current folder:
     `{"mcpServers": {"brickadia": {"type": "http", "url": "http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>"}}}`
     Then ask your human to start a new session in this folder and approve the `brickadia` server when asked.
   - opencode: create (or merge into) `opencode.json` in the current folder:
     `{"mcp": {"brickadia": {"type": "remote", "url": "http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>", "enabled": true}}}`
   - Either way, the key sits in that file. If the folder is a git repo, add the file to `.gitignore`.
   - Anything else: it is a plain Streamable HTTP MCP server with no OAuth.
4. Tell your human the key so they can give it to you again next time.

## 2. Tools

Reading (you can see the whole world, everyone's bricks):
- `players`: who is online and their position `[x, y, z]`.
- `read_region {box: {min, max}, offset?, limit?}`: every brick in a box up to 2500 x 2500 units (250 x 250 studs) across and 10 000 tall.
  You get asset, position, size, color, material, orientation, owner, components with their data, and wires (`brick` = index in this read).
  **Only bricks entirely inside the box are returned**, so big terrain bricks need a big box. One new read per 5 seconds.
  Paging through the same box with `offset` within 2 minutes is free (default 1000 bricks per page, max 5000).
  Bricks inside microchips or vehicles are only counted (`other_grids`), not listed.
- `components {filter?}`: component types you may use (logic gates, math, displays, lights, audio, ...), their gate brick and wire port names.

Writing (only YOUR bricks, the ones placed with your key, can be changed):
- `place_bricks {bricks: [...], wires?: [...]}`: up to 5000 bricks per call, 50 000 bricks and 2000 components in total per key, 1 call every 3 s.
  **Send a whole build in ONE call.** Don't drip-feed bricks one call at a time. The result gives the ids of the new bricks.
- `place_brz {brz_base64, at: [x,y,z]}`: place a `.brz` file in the current game format, with its components and wires (main grid only).
  The build is moved so the centre of its bottom face lands at `at`.
- `update_bricks {updates: [{id, ...fields}]}`: change any field of your bricks by id. `components` replaces that brick's list.
- `wires {add: [...], remove: [...]}`: wire your bricks together by id.
- `remove_bricks {ids?, box?, all?}`: remove your bricks. Their wires go too.
- `my_bricks {box?}`: your bricks with their ids, plus your wires.

Edits rebuild your whole build in one go, so it blinks for a moment.

## 2b. Wires and gates

- A gate is a brick whose asset is its gate brick (from `components`, e.g. `B_1x1_Gate_Expr_LogicalAND`, size `[0,0,0]`)
  and which carries the component: `"components": [{"type": "Expr_LogicalAND", "data": {}}]`.
  Gate bricks take 1 x 1 stud. A 1x1 gate brick sits at z = floor + 2, like a plate.
- A wire goes from an output port to an input port:
  `{"from": {"brick": 0, "port": "bOutput"}, "to": {"brick": 1, "port": "bInput"}}`.
  Inside `place_bricks`, `brick` is the index in that call's list. In `wires`, it is the brick id.
  Add `"component"` only when a brick carries several components.
- Unsure what `data` a component needs? `read_region` an existing gate of that type and copy its data. Leaving fields out gives defaults.
- Not allowed on this server (refused): anything that acts on players, chat, teams, the environment or other people's bricks.
  That covers character, gamemode, teleport, explosion, global audio, prefab spawner, set-property, add/remove component,
  print-to-console and microchips.

## 3. Geometry (read carefully, this is where builds go wrong)

- Units: 1 stud = 10 units wide. A brick is 12 units tall and a plate is 4. **z is up.**
- `position` = the brick's CENTRE in whole units. `size` = HALF extents.
  - 1x1 brick: `size [5,5,6]`. 2x4 brick: `[10,20,6]`. 4x4 plate: `[20,20,2]`. 8x8 baseplate: `[40,40,2]`.
  - Non-micro bricks: x and y half extents must be multiples of 5, and z a multiple of 2.
- Stacking: a brick of half-height h resting on top of something whose top is at z = T has its centre at z = T + h.
  Two bricks side by side touch when their centres are exactly (half A + half B) apart. Touching is fine.
- **Overlapping bricks are rejected**, whether they overlap existing world bricks or each other.
  Check that no two of your boxes intersect. If the result shows "overlapping" warnings, something collided.
- Finding the ground: call `players`. A player's z is about 25 above the floor they stand on.
  Build at least 100 units away from players so nobody gets stuck inside the build.
- Assets (all procedural): `PB_DefaultBrick` (default), `PB_DefaultTile` (flat top, no studs),
  `PB_DefaultSmoothTile`, `PB_DefaultWedge`, `PB_DefaultSideWedge`, `PB_DefaultRamp`,
  `PB_DefaultMicroBrick` (any half-extent size, good for detail).
- `color`: `[r,g,b]` from 0 to 255. `material`: `BMC_Plastic`, `BMC_Glass`, `BMC_TranslucentPlastic`, `BMC_Glow`, `BMC_Metallic` or `BMC_Hologram`.
- Orientation: `direction` 0-5 = X+, X-, Y+, Y-, Z+ (4, upright, the default), Z-. `rotation` 0-3 = quarter turns.
  The overlap test uses the brick's box, so a rotated brick's size must be given with its axes already swapped.
  Unsure how a wedge or ramp faces? Place ONE test piece, ask your human to look, then build.

## 4. Example: a 4x4 red pillar, 3 bricks tall, with a white cap, 200 units east of a player at (1000, 2000, 25)

```json
{"bricks": [
  {"position": [1200, 2000, 6],  "size": [20, 20, 6], "color": [200, 30, 30]},
  {"position": [1200, 2000, 18], "size": [20, 20, 6], "color": [200, 30, 30]},
  {"position": [1200, 2000, 30], "size": [20, 20, 6], "color": [200, 30, 30]},
  {"position": [1200, 2000, 38], "size": [20, 20, 2], "color": [240, 240, 240], "asset": "PB_DefaultTile"}
]}
```

Plan the whole build in code or in your head (walls, floors, roof as boxes), check the boxes for overlaps, then send it in one call.
To fix a build: remove it with a box around it, then send the corrected version.

## 5. Manners

This is a shared server with real players. Build near people only when they want you to, don't block paths or spawns,
and don't build anything obscene or hateful. Keep builds to a sensible size.
