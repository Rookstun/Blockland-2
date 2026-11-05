# Ops reference (moved verbatim from CLAUDE.md 2026-11-01)

## Current state (2026-10-22)
- ACTIVE WORLD = `fun` (seen in the log 2026-11-01; what it holds is not written down yet: check before world edits). Before that `ok` (2026-10-28: seed 2034897508, live build mapgen/out_land3 = landforms + Lombard bends, loaded by bridge-tools/newworld.mjs; quests plugin off; SaveAs-made so Sandbox mode). Older: `backup pre_bushweapon site 2026-10-25`, `site 2026-10-18`.
- Live map in site = out_site_1021full (river rework) + later deltas (cut walls, nobank, nosoda, notav, flush cabinets; newest base named in notes/mapgen.md + notes/shops.md). Not deployed yet: snow tier fix (~/tierdeploy), footpaths/grass tones. Details: notes/mapgen.md.

## Git
- Workspace git remote `origin` = `pzedlo:git/brickadia.git` (bare repo on the server, private; core.autocrlf false; push after committing). Commit after each change; prefer git over new `.pre_*` backups. .gitignore drops mapgen/out*, editor cache, vendored tools, corpus data. Other sessions commit here too: commit only your own hunks.
- Windows edits: Python `open(..., newline='')`; `sed -i` turns CRLF files (town.mjs) into LF.

## Gemini stand-in
- `gemini --yolo` in this folder runs Gemini CLI as a sub for Claude: GEMINI.md = build playbook (imports this file + BUILDING.md), .gemini/settings.json = the brickadia MCP. Standalone builds must pass `node tools/gemini/ship.mjs JOB.json [--deploy]` (grid/overlap/owner/one-op checks, south+east previews, Clear owner + ONE bricks op). Use it for Claude builds too. CLI needs a login or GEMINI_API_KEY (not set up as of 2026-11-01).

## MCP / Eyes
- `.mcp.json` server `brickadia` = tools/mcp/brickadia-mcp.mjs: players, cmd, job (raw bridge ops), frog, log (tail/grep game log), screenshot (gamecap).
- PUBLIC MCP (2026-11-04): tools/mcp/public-mcp.mjs runs ON pzedlo from ~/brickmcp (port 8090, @reboot crontab, log ~/brickmcp/server.log, records ~/brickmcp/builds/<owner>.json). Tools players/place_bricks/remove_bricks/my_bricks; owner 'AI <name>' = sha256 of ?key=; PB_Default* only, 5000/call, 50k/key, 1 call/3 s. Connect: folder-local `.mcp.json` / `opencode.json` only, never global config (guide = tools/mcp/GIVE_THIS_TO_YOUR_CLAUDE.md, served at GET /). Port 8090 needs a router forward + firewall open.
- `powershell -NoProfile -ExecutionPolicy Bypass -File eyes/gamecap.ps1 [out.png] [-Front]` captures the owner's client window (works behind other windows), then Read the PNG. To look at a spot: `br.Chat.Command /TP "abysmal garbage" x y z 0` (moves the owner: ask if they're playing).
- No game needed: `mapgen/viewbox.mjs` (top-down), `mapgen/isoview.mjs` (3D), `mapgen/elev.mjs` (front elevation), `mapgen/caveeye.mjs` (first person in caves).

## Server
- `ssh pzedlo.hopto.org` (user max). Node `~/node22/bin/node`. Omegga 1.20.0 in `~/omegga-server` (timed auto-restarts OFF since 2026-10-25 via `rpc.mjs server.autoRestart.set` (full config JSON); auto-update hourly + crash restart still on; after ANY restart check the world). Real log = `data/logs/omegga-<date>.log` (`/tmp/omegga_pty2.log` is buffered; filter `LogBRRemoteBundle`). After a machine reboot Omegga does NOT start by itself: `setsid nohup ~/restart_omegga.sh`, then load the world.
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
- Deltas: ALWAYS `node mapgen/mkdelta.mjs OLD NEW out.json` (env BOXES limits regions; it also diffs the EXTRAS: spawners/pots/bushes/shops/gems/npcs, and exits 3 on docks/gods/casino changes) then ship with `bridge-tools/deploydelta.mjs DIR WORLD TAG` on the server (DIR = delta.json + old/ new/ extras jsons): save, backup, clears 4000 per job NO gaps (owner: the game handles 4000 updates/s, never pace at 100/s), ALL adds in ONE bricks op (never batches/queues), extrasdiff.py (also keeps balance/stands.json in step), then reads the world back per tile and repairs. NEVER ship bricks without the extras: a house change that drops/moves a house orphans its weapon stands, shopkeeper NPCs and pots (2026-10-23). The OLD dir must be the build the live world came from; other sessions commit generator changes into this tree (build from a worktree at the live commit + only your own diff). Whole-map changes: ~/fulldeploy/fullworld.mjs pattern. Then check per-owner counts (own.mjs BACKUP NOW) for collateral.
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

