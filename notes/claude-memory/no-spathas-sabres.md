---
name: no-spathas-sabres
description: "Spathas and sabres (scimitars) are broken: never put them in loot/chests/new item pools"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7b6b9b21-6ee8-4e11-a54c-8549ed2bfec8
  modified: 2026-10-28T20:17:20.202Z
---

Never include Weapon_Spatha or Weapon_Sabre (Spatha / Scimitar tiers) in loot chests or any new item pool or drop table.

**Why:** owner 2026-10-28, furious: "REMOVE SPATHAS AND SABRES ... NEVER EVER EVER HAVE THEM THEY ARE BROKEN".

**How to apply:** filter them out of anything generated from weaponbank/itemcatalog.json (chest/gen.mjs IDS already does). Shops/bank still list them as of 2026-10-28; ask before ripping them out there.
