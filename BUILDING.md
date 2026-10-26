**NEVER PACE LOADS (owner, furious, 2026-10-26, said many times): every add goes out AT ONCE. Never a loop that waits for each bricks op to finish before sending the next, never gaps/sleeps between batches, never 'procedural' one-at-a-time placement. Drop ALL batch jobs into bridge/inbox in one go (pattern: ~/citygrid/blast.mjs / mapgen/citygrid_blast.mjs), then check the log once at the end.**

# Brickadia building rules (what the game accepts, and what looks right)

Read this before writing anything that places bricks. It is the shared
understanding of the game's geometry: what the engine allows, what the owner
expects, and the traps already hit. Items marked **(owner)** come straight from
the owner; **(measured)** were checked in-game or in logs; **(assumed)** are
working beliefs not yet confirmed. Open questions are at the end. When the owner
teaches a rule, add it here, not in CLAUDE.md (CLAUDE.md links here).

## 1. Units and the grid
- 1 stud = 10 units across, a brick is 12 tall, a plate 4. Sizes in brick data
  are HALF extents. **(measured)**
- Procedural bricks (PB_Default*): x/y half extents a multiple of 5, z a
  multiple of 2, or the game reports "Missing brick type". Micro bricks
  (PB_DefaultMicro*) snap to 2 units (1/5 stud), any whole half extent.
  **(measured)**
- Positions: integers; a brick centre at a half unit is off grid. **(measured)**
- Biggest pieces we use: terrain boxes up to 16 cells (64 studs) across and 50
  bricks tall; ClearRegion handled a 300 half-extent brick. **(measured)**
  The real maximum procedural size is not known (see open questions).

## 2. Overlap: what may share space
- The game rejects a brick whose box overlaps another brick IN THE SAME GRID
  ("Brick is overlapping in same grid"). Touching faces are fine. Everything
  we generate goes through `mapgen/builder.mjs`, which drops overlaps;
  generators throw if anything was dropped. **(measured)**
- The overlap test is on the axis-aligned BOX, even for wedges, corners and
  ramps: two wedges whose solid parts don't touch still clash if their boxes
  do. A rotated piece's local size must be permuted with its orientation
  (`orientFor` / `worldBox`), or the box is wrong and it gets rejected.
  **(measured)**
- Exceptions seen:
  - Several micro pieces at the SAME spot load fine: the media plugin stacks 4
    `PB_DefaultMicroWedgeHalfInnerCornerInverted` (or 2 micro ramps) in one cell
    for its 4-segment / diagonal pixels. **(measured)** Exactly when the game
    allows this is an open question.
  - Bricks on a different grid (a microchip's inner grid, a dynamic/entity
    grid) don't clash with the main grid. **(measured)**
  - Plants: the game rejects BOTH plant bricks when two touch or overlap within
    one load, so keep them 2-4 units clear of cell edges. Bush / Pine only on
    flat cells. **(measured)**
- Prefab loads: a prefab whose brick overlaps the world fails partly (the rest
  loads, e.g. a shop stand's button without its stand). Re-place 12-36 units
  higher. **(measured)**

## 3. Shapes and orientation
- Orientation code = direction * 4 + rotation; `mapgen/orient.mjs` ORIENT[]
  maps local to world axes. Direction 4 = Z+ (upright), 5 = Z- (face down).
  Rotation r = r quarter turns anticlockwise about +Z. **(measured)**
- `PB_DefaultMicroWedge` is natively a SIDE wedge (solid where local x + y <= 0,
  extruded along local z); use `orientFor` to make it rise toward a direction.
  **(measured)**
- Corner pieces (top surface, as used by the terrain smoothing and bmxcheck):
  `PB_DefaultMicroWedgeOuterCorner` = a cube with its low corner cut off;
  `PB_DefaultMicroWedgeTriangleCorner` = the tetrahedron at a corner
  (direction 4, rotation = the corner it rises toward: (-,-)0 (+,-)1 (+,+)2 (-,+)3);
  `PB_DefaultMicroWedgeCorner` rises where both slopes meet; `PB_DefaultMicroWedgeInnerCorner`
  fills a valley (roof valleys). **(measured / modelled)**
- `PB_DefaultRampCorner` / `RampCornerInverted`, direction 4: rotation 0 slopes
  down toward (+x,+y), 1 (-x,+y), 2 (-x,-y), 3 (+x,-y). **(measured)**
- `PB_DefaultMicroRamp`, rotation 0 rises toward -x. **(measured)**
- Tiles turned face down (direction 5) show their smooth face from below.
  **(measured)**

## 4. Looks: the owner's norms
- No stud or underside textures where they can show: regular bricks have an
  ugly bottom. Anything visible from below (ceilings, lintels, roof crowns,
  overhangs) is `PB_DefaultMicroBrick` or `PB_DefaultTile`; ceilings are tiles
  face down. **(owner)**
- Smooth terrain with micro wedges, not stair steps; every step of 1 to 6
  bricks gets a wedge or corner piece. **(owner)**
- No sheer walls along rivers (owner screenshot 2026-10-10): steps over 6
  bricks never get a wedge and show as grey stone cliffs, so the river corridor
  is slope-limited (mapgen riverValleyCap, 2 bricks per cell near the water).
  Cells under the sea plane are never smoothed. **(owner)**
- Roofs are coursed: each course a 1-plate lip with a micro wedge on top,
  stepping out over the one below (the owner's sample roof). Gable ends are laid
  in brick courses like the wall, never one slab per course. **(owner)**
- Stairs: a 3x3-stud landing at both ends, the floor carried under the treads,
  never across a window. Windows never touch doors. **(owner)**
- Shading: vary a whole brick by ONE factor; a factor per colour channel tints
  pale colours (pink / yellow / blue speckle on plaster). **(measured)**
- Caves are Minecraft-style tunnel systems (2026-10-07, mapgen caves.minecraft); detailed architecture, no
  props; RuneScape-like towns and hamlets; natural shapes, no perfect circles
  or flat plateaus. **(owner)**

- HAZARDS NEVER LABEL THEMSELVES (owner 2026-10-25, "spikes should NEVER say spikes"): Component_Damage Message ''. **(owner)**
- STAIRS ARE ARCHITECTURE (owner 2026-10-25, "stairs should NEVER look like this unless theres an extremely good reason"): no open pyramid of stacked studded slabs. A flight runs between stringers/cheek walls (bonded, sloped wedge copes), treads are smooth tiles, both ends get landings. greathall.mjs stair. **(owner)**
- BRICKWORK SHOWS (owner 2026-10-25): walls in bonded blocks (2-5 studs, joints staggered per course, shaded per block), not one long box per course. **(owner)**
- WINDOWS: arched heads, and NO player fits through an opening unless it is a deliberate secret: glaze it (BMC_Glass) or keep it under ~1 stud. **(owner)**
- WALKING SURFACES are smooth tiles (PB_DefaultSmoothTile, 4 high; a 2-high tile loads as "Missing brick type"). Big rooms must feel open: slabs on piers instead of solid blocks, light. Ceilings get real architecture (cornice, cove, coffers, an oculus/lantern), never a bare slab. **(owner)**

## 5. Players, bikes and bots
- PLAYER (owner 2026-10-19, exact, supersedes the 48 below): the character is exactly 5 bricks = 60 units tall. Tables 2 bricks (top 24 over the floor), counters 3 (36); a 44-high display table read as "gigantic". **(owner)**
- PLAYER (owner 2026-10-18, exact): 4 bricks = 48 units tall, jumps 300 long / 108 high. (Measured
  capsule estimate below said ~54.) **(owner)**
- STAIRS ARE BRICKWORK (owner 2026-10-18: "when your stairs extend from the floor it creates a striped
  pattern instead of the brick"): never build a step as its own column from the floor. Lay a stair in
  courses: rise = the wall's course height (10 on 10-high coursework), each course a running-bond row over
  every step at least that high, so the sides read as brick and the steps line up with the walls; run the
  stair flush against walls / battered faces (fill out to the face per course). npctalk/temple.mjs coursed().
  TREADS AT LEAST 12 DEEP: 10-unit treads (rise 10) could not be walked up at all (owner 2026-10-18,
  "all the stairs now no longer work"); rise 10 / run 12 works. **(owner)**
- WIRES SHOW: a wire is drawn as a line between its two bricks, through rooms. Keep gates in an invisible
  microchip in a pocket right beside the sensor / actuator and link far apart parts with a global custom
  event (Exec_SendCustomEventGlobal -> Event_CustomGlobal), never with long wires. **(owner)**
- PLAYER SCALE (2026-10-17, measured + owner): the players op's position (capsule centre) stands 25-28
  above the floor, so a player is about 54 units tall (shoulder ~42, eye ~48); 38-high counters read as
  shoulder height (owner). Furnish at real size x 0.31 units/cm: ceiling 76, door 64 x 30, sill 26, window
  head 62, counter 28, table 23, toilet seat 12, tub 16, fridge 56, stair riser 6 on a 1-stud tread.
  (The older 72 figure below is the clearance we kept, not the body.) **(measured / owner)**
- A player is about 6 bricks (72 units) tall and jumps about 6 more: keep 72
  of headroom on stairs and landings, 72 + 72 where they'd jump. **(measured)**
- BMX: paths must have no lips (sudden steps); slopes are wedge ramps.
  `mapgen/bmxcheck.mjs` measures lips and steep ramps on every path. How steep a
  ramp a bike can climb, and how tall a lip it can roll over, are open questions.
  **(owner / open)**
- Glass with collision off (river water) can be waded through. **(measured)**
- Server caps: 300 bots at once (one per B_Bot_Spawn_Point); world limit
  `MaxActiveComponents` 500000 (a world file without it refuses speakers);
  speaker range is capped at 40 studs. **(owner / measured)**
- Prefab loads: B_SpawnPoint bricks in a prefab are ignored ("Missing brick to
  attach component"); loads below z 0 fail silently. **(measured)**

## 5b. Water
- Real water is a ZONE, not a brick: `Component_Internal_AttachedZone` with
  `bWater: true` on any brick projects a water volume from the brick's top
  face out to `ZoneEndDistance` (units), with its own scattering, absorption
  and fog colours. The river uses the owner's settings (mapgen `WATER_ZONE`)
  on a thin gravel plate at the bed. **(owner / measured)**
- Generated bricks carry components as `components: [{ type, data }]`; the
  bridge's `bricks` op writes them (brs `writeBrzLegacy` -> new format).
  `BP_ZoneProjector` also exists as a dedicated projector brick. **(measured)**
- The sea is the environment water plane (`sea` preset), not a zone. The `sea` preset IS the owner's sky (blue sky/fog, clouds 0.25; restored 2026-10-14 from the pre_regen1014 world after the old 10-02 preset greyed the sky on every deploy; old one = sea.pre_1014.bp). If the owner changes the sky in-game, re-export it into sea.bp before the next deploy. **(owner)**

## 5c. Text
- Text is `Component_TextDisplay` on a brick face (Face 4 = the brick's local
  +Z; orient the brick so that face looks at the reader). Asset-type fields
  (`Font`) are indexes into the save's external asset table: pass
  `externalAssets` with the load or the whole load fails ("Asset index 5 is out
  of range, have 0 assets"). The shop font is BrickFontDescriptor/MonaspaceXenon.
  **(measured)**

## 6. Graphical quirks
- Lips under roof courses are drawn darker on purpose (0.82); seen from below
  they read as dark bands. **(measured)**
- Glass (BMC_Glass) water renders grey-dark from a distance under fog.
  **(assumed)**
- More to collect: z-fighting on coplanar faces, how glow / metallic look at
  distance, LOD pop-in on big maps.

## 7. Server-side commands that touch geometry
- `br.World.ClearRegion cx cy cz hx hy hz` removes bricks ENTIRELY inside the
  box, and entities; huge boxes over a full map silently clear nothing (~1,800+
  bricks) but work on an empty map. `br.Bricks.Clear <owner> 1` per owner;
  there is no ClearAll. Console commands queue at ~100/s while a bricks load
  runs at once: clear first, wait, then load. **(measured)**

## Open questions for the owner
1. The exact per-brick size limits (largest procedural brick, largest micro
   brick) and any per-world brick or component limits besides
   MaxActiveComponents.
2. When may two bricks overlap? (Micro pieces at one spot do; which asset
   pairs, and must they be in the same load?)
3. Which pieces can sit on top of each other in "very specific circumstances":
   is it about grids, about load order, or about the asset?
4. Corner and angle pieces: which ones exist and which we should prefer for
   roofs, valleys and terrain; anything that renders badly.
5. Player geometry: step height a player walks up without jumping, crouch
   height, how wide a gap a player fits through, BMX climb limits.
6. Graphical quirks you've seen in our builds that should become rules here.

## Text bricks & handedness (learned on the DDR cabinet, 2026-10-11)
- Component_TextDisplay does NOT auto-fit: `LineHeight` is the glyph height in world units (1 = specks). Text, Color, LineOffset are wireable (cross-grid wires from a chip work).
- The world is left-handed: a player facing +y has +x on their LEFT. Mirror x for anything laid out left-to-right for a viewer.
- Seat B_Seat direction 4 rotation 0 faces +y.

## Brick size limits (learned on the suburb loads, 2026-10-12)
All rejects show up in the log as "Missing brick type to create brick (N)":
- PB_DefaultBrick half height must be even (z halves 49, 9, 3 were rejected); x/y halves multiples of 5.
- PB_DefaultTile must be at least 4 thick (a 2-thick tile, z half 1, was rejected); use a micro brick for 2-thick layers.
- A micro brick 17100 long was rejected (3340 is fine); keep long strips split (suburb.mjs splits at 500).
- Long regular bricks are fine as such (3340-long bricks loaded; an earlier 3340 reject was its odd half height).
