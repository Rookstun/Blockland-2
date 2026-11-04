---
name: windows-clear-of-doors
description: Windows must never touch or run into doorways; check door/window spacing in every generated building
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3eeb9633-6e8e-4446-a359-653fe94be9dc
  modified: 2026-10-05T15:22:41.055Z
---

Owner (2026-10-05, screenshot of the castle keep door): "you keep making this mistake with windows". Glass windows were placed right against the door, with panes cutting into the door frame. Cause: town.mjs `building()` `windows()` skipped windows near the door with `skip && ...`, so a door at coordinate 0 (keep at x 0, bank at y 0, and the old chapel before them) didn't count. Fixed with `skip != null` and a clearance of doorW/2 + 30.

**Why:** the owner has seen this repeatedly and it looks broken: thin wall slivers, and glass inside the door frame.
**How to apply:** for any generated facade, leave at least 2 studs of solid wall between every window opening (including its stone sill or lintel) and a door. Never use truthiness on coordinates (0 is valid). Before deploying a new building, list its openings per wall and check the spacing. Related: [[mapgen-style]].
