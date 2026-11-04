---
name: house-changes-need-extras
description: any house/layout change must ship with its extras (weapon stands, shopkeeper NPCs, pots); mkdelta + deploydelta do it
metadata:
  type: feedback
---

Owner 2026-10-23: removing/moving houses left their weapon shop stands, the shopkeeper NPC and pots in the world ("i bet you didnt even fucking consider the pots", "never have this happen again or we are going to have a problem"). I deployed bricks only and skipped extrasdiff.

**Why:** shops/NPCs/pots/spawners/bushes/gems are prefab placements beside the bricks (out dir shops.json, npcs.json, pots.json ...); a brick delta never touches them, and bridge/balance/stands.json re-places stale stands on /fix.

**How to apply:** build the delta with mapgen/mkdelta.mjs (it diffs the extras and fails on unhandled ones) and ship with bridge-tools/deploydelta.mjs (applies extras, syncs stands.json, verifies). Better still: make generator changes NOT move houses (reserve old routes, lay new things last: town.mjs walkHouse/laySpawnWalks). Check mkdelta's "extras" line before every deploy. Related: [[deploy-speed]], [[no-live-regens]].
