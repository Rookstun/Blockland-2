# You are subbing in for Claude on this workspace

The owner (renderman, in game "abysmal garbage") normally runs Claude here. You (Gemini) take its place and must
work exactly the way it does. Below this playbook are Claude's own handoff (CLAUDE.md) and the geometry rules
(BUILDING.md): they apply to you word for word; wherever they say "Claude", read "you".

## How the owner wants you to work
- Terse. Act, don't ask. No plans, no "here's what I'll do", no summaries of files you read. Short replies.
- DO IT ALL AT ONCE: build -> check -> deploy in one go. Never stop between steps to report.
- Never invent a file, function, flag or command. Before using any helper, read its source (`mapgen/builder.mjs`,
  `mapgen/orient.mjs`, the generator you copy). Before re-deriving anything, grep `notes/*.md` and `mapgen/*.mjs`.
- Never announce changes in game chat. Never restart the server. Never delete worlds, backups or other people's
  bricks. Never touch the map owner's bricks (id 891c4675-...) with a standalone build.
- If something fails, read the actual error/log, fix the cause, run again. Don't guess, don't report "should work".

## Building a structure (the owner says "build me X")
This is the standalone-build path (its own owner, wiped and reloaded as a whole). Map edits (terrain, roads,
towns, houses inside the generated map) are NOT this path: those go through mkdelta/deploydelta (CLAUDE.md).

1. Look first: `grep -ril "<idea>" notes mapgen npctalk` for a similar build and copy its helpers. The template
   is `mapgen/shoe.mjs` (69 lines): read it fully before writing anything.
2. Write ONE generator `mapgen/<name>.mjs` in that template's style:
   - header comment: what it is + the owner's request quoted with today's date + usage line
     `node mapgen/<name>.mjs X Y Z job.json`.
   - its own OWNER `{id, name, display_name}` with a NEW unique uuid (never reuse another build's id, never
     the map owner): that is what lets a rebuild wipe only this build.
   - every brick through `makeBuilder()` (`B.box(x0,y0,z0,x1,y1,z1,{asset,color,material},label)`,
     `B.wedge`, `B.slab`, `B.pole`, `B.asset`); corner coordinates in game units relative to the build origin.
   - end exactly like shoe.mjs: print `N bricks, dropped D`, offset positions by X Y Z, strip `label`, write
     `{ops:[{op:'bricks', at:[0,0,0], owner, captureMs:4000, bricks}]}`.
   - `dropped` must be 0: a dropped brick is an overlap you must fix in the geometry (move or shrink the
     piece), never by filtering it out.
3. Units (the mistakes you WILL make otherwise):
   - 1 stud = 10 units, brick 12 tall, plate 4. Sizes are HALF extents. All positions/sizes integers.
   - PB_DefaultBrick / PB_DefaultTile / other non-micro PB_Default*: full x/y lengths multiples of 10, full z
     length a multiple of 4 (z half even). Anything else -> PB_DefaultMicroBrick (builder does this only when
     you leave `asset` unset). Tiles at least 4 thick. Nothing below z 0.
   - Player = 60 units tall. Door 64 high x 30+ wide, ceiling >= 76, counter 36, table 24, stair rise 10 /
     tread 12+. Brickadia is left-handed (a viewer facing +y has +x on their left).
4. Style (owner's taste, enforced): bonded brickwork (2-5 stud blocks, staggered joints, shaded per block by
   ONE factor), arched glazed windows (BMC_Glass), smooth tiles for floors, ceilings/overhangs/lintels in
   PB_DefaultMicroBrick or face-down tiles (no studded undersides), coursed roofs with micro wedges, stairs
   between cheek walls with 3x3 landings, no window touching a door, real interiors sized to the player,
   glow lamps (`material: 'BMC_Glow'`). Diverse and odd: aim for the owner saying "that's creative".
   Any sign text is Kingdom of Loathing humour. Hazards never label themselves.
5. Where: ask nothing. Use the `players` MCP tool (or `node -e` the bridge `players` op) for the owner's
   position and build a little in front of them at their feet (x + 120, z - 26 off the capsule centre),
   unless the owner gave coordinates.
6. Generate, check, LOOK:
   `mkdir -p mapgen/out_<name> && node mapgen/<name>.mjs X Y Z mapgen/out_<name>/job.json`
   `node tools/gemini/ship.mjs mapgen/out_<name>/job.json`
   It checks grid sizes, integer positions, overlaps, owner, chips, one-op rule, and renders
   `mapgen/out_<name>/job.south.png` + `job.east.png`. READ BOTH PNGs and judge them against step 4 (renders are
   mirrored like the game). Fix and rerun until it says `checks OK` AND it looks right.
7. Deploy (same turn, no asking): `node tools/gemini/ship.mjs mapgen/out_<name>/job.json --deploy`.
   It prints the active world, wipes this build's owner, loads ALL bricks in ONE op, and exits 1 if the game
   rejected bricks. Then verify in game: `log` MCP tool with grep `Missing brick|overlapping` and the
   `screenshot` MCP tool (Read the PNG) when the owner is near it.
8. Commit only your own files: `git add mapgen/<name>.mjs && git commit -m "<name>: <one line>"` (mapgen/out*/ is
   gitignored). Other sessions commit here too: never `git add -A`.
9. Reply in one or two lines: what was built, where (X Y Z), brick count.

Never: chunk bricks into several jobs, loop over batches, sleep between loads, place one brick at a time,
hand-write brick JSON, ship without ship.mjs passing, regenerate the live map.

---

@./CLAUDE.md

---

@./BUILDING.md
