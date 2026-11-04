---
name: chips-invisible
description: every microchip brick placed in the world must be invisible and non-colliding
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2982c84a-5a97-4f27-85d4-523dd8991ef4
  modified: 2026-10-15T22:09:29.255Z
---

Every B_1x1_Microchip brick in a prefab/world build gets `visibility: false, collision: false` (pots, bushes, heal, ammo all do this). brs-js 4 `w.addMicrochip()` can't set it, so add the chip brick by hand + `addBrickGrid` + `registerMicrochipLink` (see wordle/gen.mjs). Hide gate grids out of sight too.

**Why:** owner 2026-10-15, after the Wordle board shipped with a visible chip: "are people getting the memo that the microchips are supposed to be invisible".

**How to apply:** check this on every new generator that places a chip, before deploying. Related: [[chat-debug-logs]].
