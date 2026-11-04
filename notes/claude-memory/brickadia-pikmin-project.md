---
name: brickadia-pikmin-project
description: "How the brickadia workspace builds game logic — Wirescript chips + brs-js bodies, compiled via vendored WASM SDK (no Rust installed)"
metadata:
  node_type: memory
  type: project
  originSessionId: 9c154136-e4e7-4d22-a1db-7358910e820e
  modified: 2026-09-29T22:29:37.129Z
---

Workspace `brickadia/` holds Brickadia game mods. `dependencies/` has brs-js (brick save read/write, prebuilt dist) and wirescript (language compiling to Brickadia wire-gate `.brz` chips). Rust/cargo/just are NOT installed; compile Wirescript with the prebuilt WASM SDK from https://wirescript.brickadia.dev/wirescript-sdk.zip (vendored at `pikmin/tools/wirescript`, `node check.mjs file.ws`).

`pikmin/` (built 2026-09-29): onion.ws main chip + per-entity brain prefabs (pikmin_brain.ws, treasure_brain.ws); `node build.mjs` makes brick bodies with brs-js and passes them to `wirescript_compile(src, name, filesJson, prefabsJson)` as a prefab registry keyed `./x.brz`. Untested in-game as of creation.

**Why:** SDK CLI's compile.mjs doesn't pass `.brz` prefabs; the build script does.
**How to apply:** For new Brickadia features, follow the same pattern (per-entity spawned brain chips, global custom events filtered by index). Gotcha: `from` is a reserved word in Wirescript.
