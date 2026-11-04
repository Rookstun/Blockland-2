##NEVER QUEUE CLEARS OR BUILDS. DO IT ALL AT ONCE

# Brickadia workspace (read first, don't re-derive)
Owner = renderman (in-game soapstain22 / 'abysmal garbage', id 891c4675-d18a-4ce1-a465-f4193ffe8b39). Terse: act, don't ask, short replies, chain build -> delta -> deploy in one go.
- ALL bricks in ONE `bricks` op in ONE job: no batches, chunks, queues, sleeps, pacing. Wipe a build with `br.Bricks.Clear <owner> 1` (own owner per build).
- Before world edits: check ACTIVE world (last `Opening existing bundle at .../Worlds/<name>` in the log; was `fun` 2026-11-01). Back up the .brdb first.
- NO LIVE REGENS: diffs only (`mapgen/mkdelta.mjs` + `bridge-tools/deploydelta.mjs`, always with extras), and bake every diff into the generators.
- Never restart the server with players online without asking. No chat announcements of changes. Never `claude -p` for in-game answers.
- Microchips: visibility false + collision false. Player = 60 units tall. Overlaps rejected: go through `mapgen/builder.mjs`.
- Local git repo: commit your own hunks after each change. Windows edits keep CRLF (`open(..., newline='')`).
- Style: smooth micro-wedge terrain, no visible undersides (MicroBrick/Tile), diverse architecture, Kingdom of Loathing writing.

## Where things are
- `BUILDING.md`: geometry rules, read before generating bricks.
- `notes/ops.md`: server/ssh/bridge job ops, deploy rules, game traps, units/orientation, mapgen CLI, MCP/eyes, Gemini (ship.mjs gate).
- `notes/`: wires, mapgen, houses, shops, items, plugins, media, arcade, bungus, history; `CLAUDE.md.pre_trim` = pre 10-07 notes. Grep before re-deriving; new write-ups go there, not here.
- `HANDOFF.md`: onboarding for a new collaborator; `notes/claude-memory/` = copy of the owner's Claude memory (feedback rules).
