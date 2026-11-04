---
name: stairs-landings
description: "Every stair needs a 3x3-stud landing at top and bottom, a floor under it, and must not cross windows"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3eeb9633-6e8e-4446-a359-653fe94be9dc
  modified: 2026-10-05T15:39:27.279Z
---

Owner (2026-10-05, screenshot of a wallgen smith house): "all stairs NEED a 3x3 landing". In that house the flight had 1-stud landings, the floor under it was missing (grass showed through) and it ran across two windows.

**Why:** stairs that jam into the ceiling or start against a wall with no landing look broken and are awkward to walk.
**How to apply:** every stair generator (wallgen lib, town.mjs `building()`, shapedhouse, dungeons, anything new) needs ≥3 studs of clear landing at both ends, as wide as the flight. Keep the floor under floating treads. Never run a flight along a window or door. Check this before deploying. Related: [[windows-clear-of-doors]], [[mapgen-style]].
