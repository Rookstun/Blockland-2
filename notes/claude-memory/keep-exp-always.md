---
name: keep-exp-always
description: "Player XP/coins/items must survive every wipe, rebuild, world load or chip swap"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 79661f33-814e-42b7-b292-ab585f433eab
  modified: 2026-10-12T18:01:11.627Z
---

Owner (2026-10-12, during a full RPG map rebuild): "keep exp always".

**Why:** players lose their progress whenever the skeleton_drop chip or the world gets reset.
**How to apply:** before any wipe/rebuild/World.Load, make sure plugins/progress is loaded, then check the log afterwards for `leaderboard value XP` matching the saved values. See [[no-live-regens]].
