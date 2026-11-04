# Brickadia workspace handoff (2026-11-04)

For a new collaborator who will work in this repo with Claude Code and SSH into the Brickadia server.
Goal: you get the same Claude that the owner has: same rules, same tools, same memory. Read this once,
then let Claude read the files it links to (it does that by itself through `CLAUDE.md`).

No secrets are in this file. Ask the owner (renderman) to add your SSH key; never commit keys, tokens or passwords.

---

## 1. Who and what

- **Owner** = renderman. In game: `soapstain22` / `abysmal garbage`, player id `891c4675-d18a-4ce1-a465-f4193ffe8b39`.
  That id is also the **map owner** of every map brick.
- **rusya / pycr / руся** (stikehbun) has owner-level authority. Claude says hi when seen.
- **The game**: Brickadia (EA 3.2+), a brick building game with wire logic ("microchips").
- **The server**: Omegga 1.20.0 (Node wrapper around the Brickadia dedicated server) on `pzedlo`.
  A second server, `bungus`, runs in WSL2 on a Windows box (`notes/bungus.md`).
- **The project**: one big procedurally generated RPG island (towns, caves, castles, biomes, shops, NPCs,
  quests, bots), plus many wire-only games and gadgets (arcade cabinets, DDR, Zelda-like, NES emulator,
  media player, cameras, portal gun, grapple...), plus Omegga plugins (progress/XP, bank, quests, discord, media...).

## 2. Get set up (one time)

1. **SSH.** Server `pzedlo.hopto.org`, port **2221**, user **max** (LAN address `192.168.4.131`). Put this in `~/.ssh/config`:
   ```
   Host pzedlo pzedlo.hopto.org
     HostName pzedlo.hopto.org   # on the owner's LAN: 192.168.4.131
     Port 2221
     User max
   ```
   Send the owner your public key (`~/.ssh/id_ed25519.pub`) to add to `~max/.ssh/authorized_keys`.
   Second server: `ssh -p 2223 bungus@192.168.5.137` (LAN only, `notes/bungus.md`).
2. **The repo (git).** Bare repo on the server:
   ```bash
   git clone pzedlo:git/brickadia.git brickadia
   ```
   (full URL: `ssh://max@pzedlo.hopto.org:2221/home/max/git/brickadia.git`, branch `main`). The owner's working copy pushes there
   (`origin`); pull before you work, commit only your own hunks, push after. Big outputs (`mapgen/out*`), vendored tools and
   corpus data are gitignored: ask for those if you will regen the map. Keep `core.autocrlf false`.
3. **Node 22** locally (all tools are plain `.mjs`, almost no npm deps). Python 3 for a few helpers.
   PowerShell only for `eyes/gamecap.ps1` (Windows).
   Claude's tools run `ssh pzedlo.hopto.org ...` with `BatchMode=yes`, so you need **key auth with no prompt**
   (ssh-agent). Test: `ssh pzedlo.hopto.org 'ls ~/omegga-server/plugins'`.
   The server is Ubuntu 24.04; Node is `~/node22/bin/node` (not on PATH by default).
4. **Claude Code** (CLI or desktop app), opened in the repo root. It loads automatically:
   - `CLAUDE.md` -> project rules (short; links to `BUILDING.md` and `notes/`).
   - `.mcp.json` -> the `brickadia` MCP server (`tools/mcp/brickadia-mcp.mjs`, no deps). Approve it on first start.
   - `.claude/launch.json` -> dev servers for the browser preview: `brickgen` (map editor :8788), `ddr` (chart editor :8792).
5. **The owner's memory.** Claude's per-user memory is not in git, so it is copied to `notes/claude-memory/`.
   Copy those files into your own Claude memory folder so your Claude has the same feedback rules:
   `~/.claude/projects/<your-repo-path-with-dashes>/memory/` (create it; `MEMORY.md` is the index).
   Or just tell Claude once: "read notes/claude-memory/ and save these as your memories".
6. **Recommended Claude settings** (the owner's): model Opus, effort high, bypass-permissions mode
   (the owner works fast and lets Claude act), the `ponytail` plugin
   (marketplace `https://github.com/DietrichGebert/ponytail.git`, "smallest complete change" style).
7. Optional: Gemini CLI can stand in for Claude (`gemini --yolo` here; `GEMINI.md` is its playbook,
   `.gemini/settings.json` gives it the same MCP). Needs a login / `GEMINI_API_KEY`.

## 3. How the owner wants Claude to work (the "experience")

These are the rules that make it feel the same. They are in `CLAUDE.md` and `notes/claude-memory/`; summary:

- **Terse. Act, don't ask.** Short replies. Chain build -> delta -> deploy in one go, no stopping to report.
- **ALL bricks in ONE `bricks` op in ONE job.** Never batch, chunk, queue, sleep or pace. (The owner has been furious about this.)
  Clears: `br.Bricks.Clear <owner> 1`, one owner per standalone build.
- **Check the ACTIVE world before any world edit** (last `Opening existing bundle at .../Worlds/<name>` in the log;
  it was `fun` on 2026-11-01) and **back up the `.brdb` first** (`backup pre_<thing> <world> <date>`).
- **No live regens.** Change the live world by diffs only (`mapgen/mkdelta.mjs` + `bridge-tools/deploydelta.mjs`, always with extras),
  and bake every diff into the generator so a regen repeats it.
- **Never restart the server with players online without asking.** No chat announcements of changes.
  Never `claude -p` for in-game answers (in-game `!ai` runs on a separate model, see `notes/ops.md`).
- **Microchips invisible**: every chip brick `visibility false, collision false`.
- **Overlaps are rejected** by the game: build through `mapgen/builder.mjs`. Player = 60 units (5 bricks) tall.
- **Commit your own hunks after each change** (other sessions commit here too). Keep CRLF on Windows files.
- **Style**: smooth micro-wedge terrain, no visible undersides, diverse real-world architecture
  (house styles: dutch colonial, georgian, split-level, derwent, white tail, tavistock), semi-freeform layouts (no grids),
  stairs with 3x3 landings, windows never touching doors.
- **Writing in game** = Kingdom of Loathing humour, without naming KoL. Original games only (no copied names/art).
- **"Archive"/"legacy"** = delete from the world, not a labelled prop. Never put spathas/sabres in loot.
- **Player progress (XP, coins) must survive every wipe**: check the progress plugin restored it.

## 4. Where knowledge lives (Claude greps these before re-deriving anything)

| File | What |
|---|---|
| `CLAUDE.md` | Top rules + pointers (loaded every session). |
| `BUILDING.md` | Geometry: units, grid, overlap, orientation, what the game accepts. Read before generating bricks. |
| `notes/ops.md` | **Start here for the server**: SSH, bridge jobs, commands, deploy rules, game traps, units, mapgen CLI, MCP/eyes. |
| `notes/plugins.md` | Every plugin and wire system (bank, balance, quests, real estate, frog, discord, translate, portal gun, camera...). |
| `notes/mapgen.md` | Map generator state, live build bases, pending deltas. |
| `notes/houses.md`, `notes/shops.md`, `notes/items.md` | Houses, shop stands, weapon/item catalog. |
| `notes/wires.md` | Wire/microchip rules and budget (10 ms per owner per update). |
| `notes/media.md` | Video/audio/TTS on bricks. |
| `notes/arcade.md` | Wire-only arcade games and the cabinet pattern. |
| `notes/history.md` | Old worlds, backups, why things are the way they are. |
| `notes/bungus.md` | Second server (WSL2 on Windows). |
| `notes/claude-memory/` | Owner feedback rules (copy into your memory, step 2.5). |
| `CLAUDE.md.pre_trim` | Pre 2026-10-07 notes (grep only). |
| `GEMINI.md` | Same playbook written for a non-Claude agent; a good one-page summary too. |

New write-ups go into `notes/`, not into `CLAUDE.md`.

## 5. The server (pzedlo)

- Omegga in `~/omegga-server`. Real log: `data/logs/omegga-<date>.log`. Worlds: `data/Saved/Worlds/*.brdb` (230+, many backups).
  Prefabs: `data/Saved/Prefabs/*.brz`.
- Plugins live in `plugins/`: `autoload balance bridge buildbattle chatbot discord duel media npctalk progress quests terrain tpa translate`.
  Local sources = `omegga-<name>/` in the repo. Deploy: scp, then `node bridge/tools/reload.mjs <plugin...>`.
  `plugin.config` via `bridge/tools/rpc.mjs` REPLACES the whole config: always pass the full JSON.
- **The bridge** (our plugin) is how everything is built live: a file job inbox.
  `~/node22/bin/node ~/omegga-server/bridge/tools/job.mjs < job.json`, ops `players`, `cmd {line, captureMs}`,
  `bricks {at, bricks, owner, ...}`, `say`, `clear`, `emit`. Long jobs: write `bridge/inbox/<id>.json`, read `bridge/outbox/<id>`.
- Console commands need the `br.` prefix: `br.World.Load/Save`, `br.Prefab.Load "name" x y z 0 16`,
  `br.Prefab.SaveRegion`, `br.Bricks.Clear <id> 1`, `br.Chat.Command /TP "name" x y z 0`.
- After a machine reboot Omegga does not start by itself: `setsid nohup ~/restart_omegga.sh`, then load the world.
  Game update: `~/update_game.sh`. Timed auto-restarts are off.
- Long SSH work: `ssh -f host setsid -f bash -c '... > log 2>&1 < /dev/null'`, then poll with `tail`.
  A local `timeout` does not stop the remote command.
- Other Claude sessions use this server too; coordinate before big town deploys.

Full detail and every trap: `notes/ops.md`.

## 6. Claude's tools for this project

- **MCP `brickadia`** (`tools/mcp/brickadia-mcp.mjs`, host overridable with env `BR_HOST`):
  `players`, `cmd` (console line), `job` (raw bridge ops), `frog`, `log` (tail/grep the game log), `screenshot` (owner's game window).
- **Eyes**: `eyes/gamecap.ps1` screenshots the game client (owner's PC only). No game needed:
  `mapgen/viewbox.mjs` (top-down), `mapgen/isoview.mjs` (3D), `mapgen/elev.mjs` (elevation), `mapgen/caveeye.mjs` (first person in caves).
- **Ship gate**: `node tools/gemini/ship.mjs JOB.json [--deploy]` checks grid/overlap/owner/one-op and renders previews. Use it for standalone builds.
- **Brick files**: brs-js 4 (`tools/brs4/dist.mjs`, patched) reads/writes `.brz`; `tools/inspect_brz.mjs`; `tools/to_latest.mjs` converts old chips.
- **Wirescript** (language that compiles to wire chips): compiler `tools/wspkg` (current; the one under `pikmin/` is old), `tools/wsbundle.mjs`.
- **Map generator**: `node mapgen.mjs --seed N --scale K --out DIR`, stages in `mapgen/pipeline.mjs`,
  `mapgen/mkdelta.mjs OLD NEW out.json` for diffs, `mapgen/selfoverlap.mjs` before deploying, Brickgen web editor `mapgen/wgsite/server.mjs` (:8788).
- **Deploy**: `bridge-tools/deploydelta.mjs DIR WORLD TAG` (on the server), `bridge-tools/newworld.mjs`, `~/fulldeploy/fullworld.mjs`.
- **Gemini stand-in**: `GEMINI.md`, `.gemini/settings.json`.

## 7. Map of the repo

- **World**: `mapgen/` (generator, towns, houses, castles, caves, roads, rivers, signposts, citygrid...), `trees/`, `citygrid/`, `farm/`,
  `realestate/`, `pots/`, `chest/`, `weapondrop/`, `weaponbank/`, `upgrades/`, `npctalk/`, `skeleton_drop/`, `balance/`.
- **Server plumbing**: `omegga-bridge/` + `bridge/` + `bridge-tools/` (jobs, deploy, reload, rpc), `omegga-*/` (plugin sources), `vanilla/` (second clean server for experiments).
- **Wire games / gadgets** (each has a `build.mjs` or `gen.mjs` -> `.brz`): `ddr/` (+ chart editor), `zeldoy/`, `thirteen/`, `bogey/`, `clown/`, `freddy/`,
  `brickdoom/`, `dodge/`, `faik/`, `finches/`, `greasepaint/`, `itwasntme/`, `landgrab/`, `mildorsplume/`, `parry/`, `superpenisman/`, `supersigmas/`,
  `wordle/`, `nes/` (NES emulator in JS + on bricks), `pikmin/`, `frog/`, `hitsplat/`, `invclear/`, `portal/`, `grapple/`, `camera/`, `puppet/`,
  `tts/`, `speakspell/`, `wanted_system.ws`. `arcade_LEGACY_BROKEN_DO_NOT_USE/` = do not use.
- **Research / data**: `corpus/` (4M-brick player world segmented), `eyes/`, `probe/`, `ea32test/`, `levels/`, `samples/`, `prefabs_owner/` + `models_owner/` (owner's own clipboards: geometry references).
- `Clipboard_*.brz` in the root = owner's in-game clipboards dropped in for Claude to copy from.

## 8. Day-to-day loop (what a typical request looks like)

1. Owner says something short in chat ("make the castles look good", "add a portal gun").
2. Claude greps `notes/` + the related generator, reads helpers before using them.
3. Builds locally, checks (overlap / ship gate / preview images).
4. Checks the active world, backs it up, deploys in ONE job (or ships a delta with extras).
5. Reads the log / takes a screenshot to verify, commits, appends what it learned to `notes/`.
6. Short reply: what changed, where, what was not checked.

## 9. First things to try

```bash
ssh pzedlo.hopto.org 'ls ~/omegga-server/plugins'
```
Then in Claude: "who is online?" (MCP `players`), "what world is active?", "read notes/ops.md and tell me the deploy rules".
Don't edit the live world until the owner says it's fine.
