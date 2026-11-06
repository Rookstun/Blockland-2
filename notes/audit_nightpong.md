# Night Pong audit (2026-11-06, ponytail-audit, owner: "audit the night pong game using ponytail skill")

What this repo does: Night Pong is a pong game that runs entirely inside a Brickadia wire chip ("wirescript", compiled
to logic bricks). `pong/wgen.mjs` writes the chip source; `supersigmas/cabinet.mjs` + `tools/wsbundle.mjs` wrap the
compiled chip in an arcade cabinet (screen strips, seat, speaker). Load assumed: one player per machine, about 4 to 6
machines in the world at once, on one server thread that is already near full (85% of a core).

## Must fix

1. **Clearing the stock pong also wipes Rookstun's machine** (`pong/build.mjs:L9`, notes reload procedure)
   - **What this is:** The stock build and the chip now inside Rookstun's own machine (5671) share one owner, PONG b0e6.
   - **Problem:** The documented reload, `br.Bricks.Clear b0e6`, removes every PONG brick, so it also deletes the chip
     inside Rookstun's machine.
   - **Fix:** Give the stock build its own owner id, or reload by `ClearRegion` only (as done today). One line.
   - **If we skip it:** The next stock reload silently breaks Rookstun's machine.

2. **Every machine runs every server frame, even when nobody sits** (`pong/wgen.mjs:L437`, `noClock: true`)
   - **What this is:** The chip steps on `ServerUptime()`, which fires once a frame, and checks the seat inside.
   - **Problem:** Idle machines still fire a chip event every frame. With several copies and DVI on the same engine,
     that is constant load on a server thread that is already near full (reported lag).
   - **Fix:** Keep the frame tick only while seated: use the cabinet Clock gated by the seat (`clockWhenSeated`) at
     60 Hz instead of `ServerUptime` for release builds. Baseline240Engine already does this (`on tick`).
   - **If we skip it:** Each extra copy adds lag for everyone, all the time.

## Should fix

3. **Dead balls are never removed** (`pong/wgen.mjs:L140`, `L334`; same in Baseline240Engine `L125`, `L320`)
   - **What this is:** A new ball is pushed every 2 returns while fewer than 10 are alive.
   - **Problem:** Balls that fall out stay in the arrays until the game resets, and every frame loops over all of them.
     A long game (score 400) loops 200 entries per frame, mostly dead.
   - **Fix:** On death, swap the dead ball with the last one and shrink the arrays by one.
   - **If we skip it:** Long games get slower as they go.

4. **The live machine (Baseline240Engine) tears** (`pong/Baseline240Engine_wgen.mjs:L108`)
   - **What this is:** `setStrip` writes each screen strip straight to its output as soon as it is rebuilt.
   - **Problem:** The 4 strips can show different frames on one screen (tearing). HEAD fixed this with back
     buffers + one swap.
   - **Fix:** Copy HEAD's `pb*` back buffers + `publish()` into Baseline240Engine. About 10 lines.
   - **If we skip it:** Visible tearing on Rookstun's chosen machine.

5. **Quick taps can be missed** (`pong/Baseline240Engine_wgen.mjs`, `on tick`, `ba && lastBa == false`)
   - **What this is:** Space is read once per 20 Hz tick and compared with the last tick.
   - **Problem:** A press shorter than 50 ms starts and ends between two ticks and is never seen.
   - **Fix:** Latch it: `on Change(ba) { if ba { pressed = true } }`, and consume `pressed` in the tick.
   - **If we skip it:** "Press space to start" sometimes ignores a tap.

6. **The live version has no test** (`pong/wgen.test.mjs`)
   - **What this is:** The tests build and compile HEAD `pong/wgen.mjs` only.
   - **Problem:** Baseline240Engine (live at 5790) and rook120ea89 (live at 5671) are never compiled by a test, so a
     broken edit only shows up in game.
   - **Fix:** Add both files to the "compiles with zero wirescript errors" test loop. Three lines.
   - **If we skip it:** A typo ships straight to Rookstun's machines.

7. **Three near-copies of the same game** (`pong/wgen.mjs`, `pong/Baseline240Engine_wgen.mjs`, `pong/rook120ea89_wgen.mjs`)
   - **What this is:** Each live machine runs its own forked generator.
   - **Problem:** A fix (like 3) must be made three times, and the copies already drift (scoreboards differ).
   - **Fix:** Make Baseline240Engine the only generator (Rookstun's base, per his request) and rebuild 5671 from it;
     delete `rook120ea89_wgen.mjs`.
   - **If we skip it:** Fixes land in one copy and not the others.

Verdict: fix 1 first (one line, prevents breaking Rookstun's machine), then 2 (lag).
Lean: about -470 lines possible (one duplicate generator), no dependencies to drop.
Not checked: the multi-chip DMA idea (not built yet), the cabinet's audio and seat wiring in game, `tools/wsbundle.mjs`
beyond its one-chip limit, and nothing was run with a player seated.
