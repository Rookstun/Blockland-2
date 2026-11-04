---
name: freeform-layouts
description: owner hates uniform grids; town/layout generation must be semi-freeform like the real world
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7ceb3c4d-51e2-4bbf-bd02-89444a455863
  modified: 2026-10-12T00:53:09.415Z
---

Layouts (towns, suburbs, any placement of many things) must be semi-freeform like the real world: some lines and grid-ish main roads, but non-uniform spacing, wandering/curving streets, cul-de-sacs, loops, irregular and concave blocks, varied lot sizes, leftover pockets. Never a repeated uniform grid of identical tiles.

**Why:** owner 2026-10-12: "the grid sucks and i like things semi freeform like real world with grids and lines and non uniform or concave geometry" (after a 5x15 grid suburb).
**How to apply:** start from a network (main lines + organic branches), place things along it with variation; render a top-down preview image and look at it before deploying (mapgen/town2.mjs --preview). Related: [[mapgen-style]].
