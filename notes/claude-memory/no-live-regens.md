---
name: no-live-regens
description: "Don't do full live map regens; ship diffs, but every diff must also live in the generator/deploy scripts so a future regen repeats it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bd07f7dc-cb4b-4a4c-bd20-49638c82346a
  modified: 2026-10-10T15:57:03.824Z
---

Avoid full live regens of the Brickadia map. Patch the live world with diffs instead, and make every diff reproducible: put the change into the source (mapgen, gen.js, prefab generators, loadextras.py, world-patch scripts) so the next full generation and deploy repeats it automatically.

**Why:** owner, 2026-10-10, after a full regen/redeploy of weed4. Hand-only live fixes get lost on the next generate.

**How to apply:** for any live change, (1) edit the generator or deploy script, (2) apply only the delta live (see CLAUDE.md partial-deploy rules), (3) never leave a fix that exists only in the world file. Related: [[upload-all-at-once]], [[omegga-bridge]].
