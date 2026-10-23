# Brickadia workspace handoff (read first, don't re-derive)

Owner = renderman (in-game soapstain22, display name 'abysmal garbage'). Terse, token-limited: act, don't ask, short replies. Geometry rules: `BUILDING.md` (read before generating bricks; add new rules there). Per-topic detail lives in `notes/` (index at the bottom): grep it before re-deriving anything. Keep THIS file short: new feature write-ups go into the matching notes file, only rules/traps that apply everywhere go here.

## Current state (2026-10-22)
- ACTIVE WORLD = `test 2026-10-22` (cp of `site 2026-10-18`, for the owner's complaint fixes; AUTOLOAD still = `site 2026-10-18`, so a restart goes back to site). Main world = `site 2026-10-18` (map seed 2029224243 x2, params out_site_1021_params.json, MAPGEN_LENIENT=1, built with node --max-old-space-size=12288). Never load `site 2026-10-16` (micro-terrain experiment). Old RPG world `rizz` untouched since 10-16.
- Live map in site = out_site_1021full (river rework) + later deltas (cut walls, nobank, nosoda, notav, flush cabinets; newest base named in notes/mapgen.md + notes/shops.md). Not deployed yet: snow tier fix (~/tierdeploy), footpaths/grass tones. Details: notes/mapgen.md.

## Git
- Workspace is a LOCAL git repo (no remote = private; core.autocrlf false). Commit after each change; prefer git over new `.pre_*` backups. .gitignore drops mapgen/out*, editor cache, vendored tools, corpus data. Other sessions commit here too: commit only your own hunks.
- Windows edits: Python `open(..., newline='')`; `sed -i` turns CRLF files (town.mjs) into LF.

## MCP / Eyes
- `.mcp.json` server `brickadia` = tools/mcp/brickadia-mcp.mjs: players, cmd, job (raw bridge ops), frog, log (tail/grep game log), screenshot (gamecap).
- `powershell -NoProfile -ExecutionPolicy Bypass -File eyes/gamecap.ps1 [out.png] [-Front]` captures the owner's client window (works behind other windows), then Read the PNG. To look at a spot: `br.Chat.Command /TP "abysmal garbage" x y z 0` (moves the owner: ask if they're playing).
- No game needed: `mapgen/viewbox.mjs` (top-down), `mapgen/isoview.mjs` (3D), `mapgen/elev.mjs` (front elevation), `mapgen/caveeye.mjs` (first person in caves).

## Server
- `ssh pzedlo.hopto.org` (user max). Node `~/node22/bin/node`. Omegga 1.20.0 in `~/omegga-server` (auto-restart daily 2 h / 48 h max uptime, auto-update hourly; after ANY restart check the world). Real log = `data/logs/omegga-<date>.log` (`/tmp/omegga_pty2.log` is buffered; filter `LogBRRemoteBundle`). After a machine reboot Omegga does NOT start by itself: `setsid nohup ~/restart_omegga.sh`, then load the world.
- Bridge job: `node ~/omegga-server/bridge/tools/job.mjs < job.json` (60 s limit; long jobs: write `bridge/inbox/<id>.json.tmp`, mv to `<id>.json` (must end .json), poll `bridge/outbox/<id>`). Ops: `players`, `cmd {line, captureMs}`, `bricks {at, bricks, owner?, captureMs, externalAssets?}`, `say`, `sleep {ms}`, `clear`, `emit`. Job stdout over 64 KB truncates: write output to a file.
- Map owner `{id: "891c4675-d18a-4ce1-a465-f4193ffe8b39", name: "abysmal garbage"}` (no owner = Claude Build, dies on reload). NO chat announcements of changes.
- Commands need `br.`: `br.World.Load/Save/SaveAs/ClearRegion`, `br.Prefab.Load "name" x y z 0 16` (puts the prefab ORIGIN at the point; keeps the prefab's owner), `br.Prefab.SaveRegion "name" cx cy cz hx hy hz 0`, `br.Server.Environment.LoadPreset "sea"`, `br.Chat.Command /TP "name" x y z 0`, `br.Server.Players.Kill "name"`, `br.Bricks.Clear <ownerId> 1`.
- Read bricks: SaveRegion -> `data/Saved/Prefabs/name.brz`; post-EA3.2 use brs-js 4 (`tools/brs4/dist.mjs`, patched; server copies) for reads/writes, old brs.mjs only for legacy tools. .brdb: copy it a few seconds after a save, open readOnly. brdb sizes of non-PB_ bricks are 0 and PB_ sizes are pre-rotation. Owner index: 0-based in brs reads (map owner = 0).
- Plugin deploys: scp, then `node bridge/tools/reload.mjs <plugin...>` (no args = all). Web API = tRPC (`bridge/tools/rpc.mjs <procedure> [json]`); `plugin.config <name> '<json>'` REPLACES the whole config: always pass the full JSON. Check the last TWO log files for running /stream /playvideo before a media reload (it kills them).
- NEVER restart the server with players online without asking. A local `timeout` on ssh does NOT stop the remote command: never chain restarts after slow commands.
- GAME UPDATE: server `~/update_game.sh` (setsid nohup; log ~/update_game.log). Omegga auto-update can miss builds.
- !ai runs on FCC (glm-5.3 via ~/.fcc/.env) on :8083; after a reboot: `PORT=8083 setsid nohup ~/.local/bin/fcc-server >> ~/fcc-server.log 2>&1 < /dev/null & disown`. Never use `claude -p` for in-game answers.
- Other sessions use this server (ListAgents; message before town deploys).

## SSH / deploy rules (learned the hard way)
- Long jobs: `ssh -f host setsid -f bash -c '... > log 2>&1 < /dev/null'` and return at once; poll with instant `tail` (no waits in the command). Never `pkill -f PATTERN` matching your own command line (use `[d]eltadeploy`).
- CHECK THE ACTIVE WORLD before any world edit (grep the log for the last `Opening existing bundle at .../Worlds/<name>`). Backup = `cp` of the .brdb after a save, named `backup pre_<thing> <world> <date>`, made from the ACTIVE world. Base worktrees must start from the commit the LIVE world was built from.
- NO LIVE REGENS: change the live world by diffs only, and every diff must also go into the generator/deploy scripts so a regen repeats it. No world-only fixes.
- Deltas: mkdelta old -> new (env BOXES limits regions), then clears via `clears.mjs` pattern (150-2000 ClearRegions per job, 1-1.5 s apart, never reads the log; deltadeploy.py re-reads the whole log = hung the machine twice), then adds in 3-8k-brick ops 2 s apart (20k with no gap = "Prefab not found" losses), then verify (saved .brdb vs adds). Clears after adds delete the new bricks: re-send adds after late clears. Whole-map changes: ~/fulldeploy/fullworld.mjs pattern (stale list from mapgen/mkstale.mjs, clear present stale, fill missing, re-read, 3 rounds). Then extrasdiff (spawners, shops, pots, bushes, gems), then check per-owner counts (own.mjs BACKUP NOW) for collateral.
- ClearRegion removes only bricks ENTIRELY inside; boxes holding ~1,800+ bricks silently clear nothing; back-to-back ClearRegions in one tick get dropped (pace them). B_ bricks without FIXED sizes (pine trees) need hand-sized boxes.
- `cmd` ops queue (~100/s) but `bricks` loads at once: clear in one job, wait for the log, load in a second.
- WIPE: no ClearAll. `br.Bricks.Clear <id> 1` per owner (list from .brdb), then `br.World.ClearRegion 0 0 0 60000 60000 30000`.
- GAME MODE: SaveAs-created worlds get Sandbox (no weapon damage) and SaveAs makes that name ACTIVE: make new worlds by `cp` of a combat world's .brdb + World.Load, redeploy INTO it, never SaveAs.

## Game traps
- MICROCHIPS ARE INVISIBLE: every B_1x1_Microchip brick gets `visibility: false, collision: false` (half 5,5,2; brs-js 4 `addMicrochip()` can't set it: add the chip brick by hand + `addBrickGrid` + `registerMicrochipLink`, see wordle/gen.mjs). Put gates in ONE hidden chip, no loose floating gate fields.
- WIRE BUDGET = 10 ms of callable work per update PER OWNER; over it loops abort and that owner's chips block 5 s: heavy chips get their own owner. A Var read after its Set in the same exec chain is STALE (use Exec_Var_Get). More wire rules: notes/wires.md.
- Post-EA3.2 the game can't Prefab.Load old-format wirescript chips: convert with `tools/to_latest.mjs`. Compiler = tools/wspkg (current), not the old pikmin pkg.
- Loose grids written by us need gravity data (brs addBrickGrid defaults = antigravity): `{BouyancyScale 0.2, MassScale 0.1, bEnableGravity true, bUseNewMassCalculation true, bReceivesDecals true}`.
- BOT CAP 300; spawners rejected for overlap: re-place at z+12/+24. Every spawner must be homed (MoveTarget = own position; bridge/tools/homes.mjs). Bots are identified by max health = 100 x HealthMultiplier: keep it unique per type (skeleton_drop ENEMY).
- Prefab loads below z 0 fail silently. B_SpawnPoint from prefab loads is ignored.
- Components in chunk JSON: `components: [{type, data}]`; asset-reference fields (TextDisplay Font) are indexes into `externalAssets` (ruins.mjs EXTERNAL_ASSETS); every loader merging chunks must pass it on.
- Plants: the game rejects BOTH when two touch within one load; keep 2-4 units off cell edges.
- Player = exactly 5 bricks (60 units) tall: size props/counters/doors to that (BUILDING.md).

## Units & geometry
- 1 stud = 10 units, brick height 12, plate 4. Sizes are HALF extents; procedural x/y half multiple of 5, z multiple of 2. Micro bricks snap to 2. Brickadia is LEFT-HANDED.
- Orientation = direction*4 + rotation (`mapgen/orient.mjs` ORIENT). Direction 4 = Z+. Rotation r = r quarter turns anticlockwise: (x,y) -> r1 (-y,x), r2 (-x,-y), r3 (y,-x).
- RampCorner(Inverted) dir 4: rot 0 slopes down toward (+x,+y), 1 (-x,+y), 2 (-x,-y), 3 (+x,-y). MicroWedge is natively a side wedge: use `orientFor()` and permute size with orientation.
- Overlaps are rejected in-game: everything goes through `mapgen/builder.mjs` (drops overlaps); generators throw if anything is dropped (MAPGEN_LENIENT=1 drops instead).

## Map generator (mapgen/)
- `node mapgen.mjs --seed N --scale K --out DIR [--params FILE] [--dry]`; summary JSON on stderr. Keep heavy loops inside functions. Check regressions by diffing against a reference out dir; `node mapgen/selfoverlap.mjs OUTDIR` before deploying; `node check-dungeons.mjs --seed N` must print 0/0.
- Stage order = `mapgen/pipeline.mjs` (new section = add a stage + a stage() call). Tunables via `tune(key, def, note)`; Brickgen editor `node mapgen/wgsite/server.mjs` (:8788; `node mapgen/wgsite/verify.mjs` must print "exact" after heightmap changes).
- Heightmap changes re-roll sites map-wide: pin sites (snow.at etc.) or composite (mapgen/composite.mjs).
- Stairs: 3x3 landings both ends, floor under treads, never across windows. Windows never touch doors.

## Style (owner's taste)
Smooth terrain with micro wedges. No visible undersides: ceilings/lintels/overhangs are PB_DefaultMicroBrick or PB_DefaultTile. Diverse architecture. Get people to say "That's creative". In-game writing = Kingdom of Loathing style.

## Notes index (notes/*.md, verbatim history; append new write-ups there)
- `wires.md`: EA3.2 format + new gates, brs-js 4, For loops, functions, wire budget, Mandelbrot, wsbundle, wirescript traps, text via brick refs.
- `mapgen.md`: Brickgen, pipeline, floating lots/SSH rules, tiered mountains, test world snow fix, river rework, footpaths/grass, cut walls, legacy buildings, caverns, ride surface, modules/features list.
- `houses.md`: house types, roadside houses, split-level, Dutch colonial, Georgian, Ren faire town, park + straight roads.
- `shops.md`: weapon shop refit, extras cleanup, stand prefabs (_bare/_case/_cab), armories, gun cases, sodas, vending.
- `items.md`: bushes, coins, bows/guns pricing, ammo/health/item pickups, pots v5/v6, XP chip skeleton_drop (inventory restore).
- `plugins.md`: weapon bank, /clear, /fix, balance /reload, live editor, trees, chatbot, hitsplats, frog, real estate, buildbattle, duel, tpa, discord, snes, quests + main quest, speak & spell, wanted system.
- `media.md`: /playvideo, /search, YouTube proxy, audio tuning, !tv, /textvideo, /ogrid (crashes, cartridges), /stream (panel, TV entity, HLS, universal links), tts, loading words.
- `arcade.md`: DDR (+ editor), Super Sigmas cabinet engine (Freddy, Super Penis Man, Zeldoy, Brick Doom, It Wasn't Me), Mildors Plume.
- `bungus.md`: second server on bungus (Windows + WSL2, UDP relay, autostart).
- `history.md`: 2026-10-07..10-18 world history (weed*/rizz/houses/site), old deploys, backups, corpus.
- `CLAUDE.md.pre_trim`: older notes still (pre 10-07 coords).
