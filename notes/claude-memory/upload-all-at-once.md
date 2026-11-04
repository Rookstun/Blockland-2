---
name: upload-all-at-once
description: ALL AT ONCE: whole job end to end without stopping (build -> delta -> deploy), all clears in one job, all adds in ONE bricks op; no chat announcements
metadata:
  node_type: memory
  type: feedback
  originSessionId: aaa412b0-f647-4ea1-b1dc-a93995cdee57
  modified: 2026-10-26T01:41:24.949Z
---

When updating the map on the pzedlo Omegga server, load everything in ONE prefab load instead of streaming chunks. Do NOT post anything to game chat about it.

**Why:** 2026-10-01 the owner asked for one-shot loads; 2026-10-13 "stop announcing changes"; 2026-10-25 "all at once" again (bushes in 25-spot batches); 2026-10-25 again, furious ("DO IT ALL AT ONCE IVE TOLD YOU TO WRITE IT DOWN EVERY SINGLE TIME"), after I stopped mid-task to report a plan (build running, "then I'll render, then delta, then deploy"). 2026-10-26 AGAIN, furious: city grid loaded by a loop awaiting each 8k bricks op + 1 s gap (~30 s per batch, 'procedural'); owner: never, ever, under any circumstance wait between placements.

**How to apply:**
- Never end a turn between steps to report or ask. Chain build -> mkdelta -> deploy (+ extras, verify, save) in ONE launched script and report once at the end.
- 2026-10-26 'NEVER EVER QUEUE BRICKS': not even 55 batches dropped into the inbox at once. ONE bricks op with every brick, one job.
- NEVER write or reuse a loader that awaits each bricks op before sending the next (housegrid_adds.mjs pattern is BANNED). Queue every batch into bridge/inbox at once (mapgen/citygrid_adds.mjs), check the log once at the end.
- Don't sit watching a deploy either (2026-10-26 'why are you waiting'): launch it, report, end the turn; check results next turn. City rebuilds: br.Bricks.Clear on the CITY owner (one command, no 40 s ClearRegion drain) then all adds.
- Deploy: all ClearRegions in one job, then ALL adds in ONE bricks op (not 8000 per op with 2 s gaps; set deploydelta ADD_CHUNK to the whole list).
- Prefab swaps (bushes, pots, stands): one job (all clears, a pause, all loads).
- No `say` op. See [[chat-commentary]], [[deploy-speed]], [[omegga-bridge]].
