---
name: deploy-speed
description: "big map deltas must be fast and visible: tile-by-tile at full speed, no long polling"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 26f2f0d3-c5ab-42d0-8753-a25a92741c68
  modified: 2026-10-21T16:09:25.900Z
---

Ship big deltas FAST and visibly. Owner (2026-10-21): "faster", "just build really fucking fast nobody is here", "do it all at once you always make it take so much time and it takes so many token".

**Why:** clears-first ordering (~100 min of nothing appearing) and 150-per-1.5 s pacing made a 778k delta crawl and the owner saw no change; small polling turns burned tokens.

**How to apply:** use ~/rivdeploy/tiled.mjs pattern (each 2400-unit tile: clear every old brick touching it (+400 margin) then load its adds; tiles nearest players first; 1500 clears per job, 20k-brick add ops, ~no sleeps when nobody is online) = whole map in ~10 min. Launch once with setsid, chain save/extras/verify in the same script, then stop polling and report once. Never `pkill -f` a pattern that also appears in the ssh command line (killed my own shell twice). Related: [[upload-all-at-once]].

**Update 2026-10-23:** owner, again: "ive told you a million fucking times. the game can handle 4000 updates per second. adjust rate drastically". Never pace clears at 150/job with gaps: 4000+ ClearRegions per job, no sleeps; use bridge-tools/deploydelta.mjs (does it, plus extras and read-back repair). The pacing notes in older CLAUDE.md/notes are obsolete.
