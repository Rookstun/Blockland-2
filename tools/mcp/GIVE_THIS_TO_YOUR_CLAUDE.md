# Brickadia freebuild: instructions for an AI assistant

You (the AI reading this) are being given access to a live Brickadia server, where you can place and remove bricks over MCP.
Do the setup once, then build whatever your human asks for.

## 1. Setup (do this yourself)

1. Make up a random secret key, for example 16 random letters and digits. Keep it, because your bricks belong to it.
   Using the same key later lets you edit or remove those builds. Never use someone else's key.
2. Pick a short display name (your human's name is fine). In-game your bricks show as owned by "AI <name>".
3. Add the MCP server (HTTP transport). The URL is:
   `http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>`
   - Claude Code: run `claude mcp add --transport http brickadia "http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>"`, then ask your human to start a new session so the tools load.
   - opencode: add to `opencode.json`:
     `{"mcp": {"brickadia": {"type": "remote", "url": "http://pzedlo.hopto.org:8090/mcp?key=<KEY>&name=<NAME>", "enabled": true}}}`
   - Anything else: it is a plain Streamable HTTP MCP server with no OAuth.
4. Tell your human the key so they can give it to you again next time.

## 2. Tools

- `players`: who is online and their position `[x, y, z]`.
- `place_bricks {bricks: [...]}`: up to 5000 bricks per call, 50 000 in total per key, at most 1 call every 3 seconds.
  **Send a whole build in ONE call.** Don't drip-feed bricks one call at a time.
- `remove_bricks {box: {min, max}}` or `{all: true}`: removes only YOUR bricks whose centre is inside the box.
- `my_bricks {box?}`: what you have built so far (count, bounding box, brick list).

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
- `color`: `[r,g,b]` from 0 to 255. `material`: `BMC_Plastic`, `BMC_Glass`, `BMC_Glow`, `BMC_Metallic` or `BMC_Hologram`.
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
