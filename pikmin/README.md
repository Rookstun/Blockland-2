# Pikmin for Brickadia

Load `pikmin_onion.brz` in Brickadia (load dialog) and place the chip on the ground. The onion gets built around it.

## Play

| Input | What it does |
|---|---|
| `/pikmin` | Become the captain. Also builds the onion. |
| `/pluck [n\|all]` | Pluck pikmin out of the onion (5 by default; the onion starts with 15). They follow you. |
| **Left click** | Throw a follower at the spot you're aiming at |
| Hold **right click** | Whistle: pikmin near your cursor or near you come and follow |
| **Q** | Dismiss: followers stop and wait |
| `/treasure [pellet\|gem\|chest]` | Drop a treasure where you're aiming (random kind if you leave it off) |
| `/pikmin_reset` | Remove every pikmin and treasure, and refill the onion |

Unequip tools and weapons first so your clicks go to the pikmin.

A thrown pikmin that lands next to a treasure grabs it. Each treasure needs a set number of pikmin before it moves: pellet 1, gem 3, chest 8. Extra carriers make it move faster. Once enough pikmin hold it, they carry it back to the onion. The onion sucks it up and spits out new pikmin (pellet +2, gem +5, chest +12). If the field is already full (60 pikmin), the new ones wait inside the onion.

## Files

- `onion.ws`: the main chip. It handles the captain's input, chat commands, the HUD, spawning, and tracking each pikmin's state.
- `pikmin_brain.ws`: one copy per pikmin. It moves its body every tick (follow, thrown arc, fall, carry).
- `treasure_brain.ws`: one copy per treasure. It keeps the carrier list and walks the treasure home when enough pikmin hold it.
- `build.mjs`: builds the brick bodies with brs-js, then compiles the chips with the bundled Wirescript SDK (`tools/wirescript`).

Rebuild after editing with `node build.mjs`.

## Tuning

All tuning values are `const`s at the top of each `.ws` file. The ones to change first if things look wrong in-game:

- `FOOT_Z` (pikmin_brain.ws): raise or lower the pikmin bodies if they float or sink into the ground.
- `WALK_SPEED`, `RUN_SPEED`, `GRAVITY` (pikmin_brain.ws)
- `THROW_RANGE`, `WHISTLE_RADIUS`, `PLUCK_DEFAULT`, `MAX_PIKMIN`, `START_STOCK` (onion.ws)
- `BASE_SPEED`, `GRAB_PAD`, `DELIVER_DIST` (treasure_brain.ws)
- Treasure weight and value are in the `tr.init` handler of treasure_brain.ws.

## Known limits

- Pikmin and treasures are moved directly by the chips, not by physics, so they walk through walls. They do follow the ground and fall off ledges.
- All events are global, so two onions in the same world would control each other's pikmin.
