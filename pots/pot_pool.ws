// Pot loot pool (owner 2026-10-10: "a chip that spawns from a spawn pool
// written as a custom global event"). Every pot's chip sends the global
// custom event "pot.smashed" with its own location when it breaks; this one
// chip (in the sky next to skeleton_drop, owned by the server owner so it may
// pay out money) rolls the pool and drops the loot at the pot.
//
// Pool (out of 100): gold coin25 5, silver coin10 15, arrows 20, a random gun
// ammo pickup 8, copper coin1 x1-3 44, nothing 8 (2026-10-17, owner: health
// pickups (the cake) removed)
// (2026-10-10: + heal, more copper; 2026-10-11: + arrows and bullets, players
// ran out of ammo).
// Edit the weights here, rebuild (node build.mjs), reload the chip.

// (2026-10-10, owner: "coins arent spawning correctly, offset") spawn the coin
// right at the pot (SpawnPrefab offset is relative to this chip, as in
// skeleton_drop): a coin is two grids (body + motor spinner) and SetLocation
// after spawning moved only one of them.
on GlobalCustomEvent("pot.smashed") -> (at: vector) {
  let roll = Random(1, 100)
  let off = at - GetOwnTransform().Location + Vec(0.0, 0.0, 24.0)
  let up = Vec(0.0, 0.0, 55.0)
  if roll <= 5 {
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = up, lifetime = 30.0, limit = 40)
  } else if roll <= 20 {
    SpawnPrefab(prefab = $./coin10.brz, offset = off, velocity = up, lifetime = 30.0, limit = 60)
  } else if roll <= 40 {
    // (2026-10-16) the owner's arrow pickup (pots/arrowpickup.mjs) on a loose physics grid: tossed up out of the pot
    SpawnPrefab(prefab = $./arrows.brz, offset = off, velocity = Vec(50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
  } else if roll <= 48 {
    // (2026-10-16, owner: "make a type for all of these") one of the game's 9 gun ammo pickups (pots/ammopickup.mjs)
    let a = Random(1, 9)
    if a == 1 {
      SpawnPrefab(prefab = $./ammo_blackpowder.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 2 {
      SpawnPrefab(prefab = $./ammo_explosive.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 3 {
      SpawnPrefab(prefab = $./ammo_heavy.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 4 {
      SpawnPrefab(prefab = $./ammo_light.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 5 {
      SpawnPrefab(prefab = $./ammo_magnum.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 6 {
      SpawnPrefab(prefab = $./ammo_medium.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 7 {
      SpawnPrefab(prefab = $./ammo_plasma.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 8 {
      SpawnPrefab(prefab = $./ammo_pulse.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    } else if a == 9 {
      SpawnPrefab(prefab = $./ammo_shotgun.brz, offset = off, velocity = Vec(-50.0, 30.0, 220.0), lifetime = 30.0, limit = 60)
    }
  } else if roll <= 92 {
    let n = Random(1, 3)
    SpawnPrefab(prefab = $./coin1.brz, offset = off, velocity = Vec(60.0 / 5.0, 0.0 / 5.0, 55.0), lifetime = 30.0, limit = 150)
    if n >= 2 {
      SpawnPrefab(prefab = $./coin1.brz, offset = off, velocity = Vec(-60.0 / 5.0, 40.0 / 5.0, 55.0), lifetime = 30.0, limit = 150)
    }
    if n >= 3 {
      SpawnPrefab(prefab = $./coin1.brz, offset = off, velocity = Vec(0.0 / 5.0, -60.0 / 5.0, 55.0), lifetime = 30.0, limit = 150)
    }
  }
}

// (2026-10-16, owner: "gems that you can mine that give you money") every cave gem (pots/gemgen.mjs)
// sends "gem.mined" (location, kind) when hit: amethyst 2 silver (20), emerald gold + silver (35),
// ruby 2 gold (50), diamond 4 gold (100)
on GlobalCustomEvent("gem.mined") -> (at: vector, kind: int) {
  let off = at - GetOwnTransform().Location + Vec(0.0, 0.0, 30.0)
  if kind == 1 {
    SpawnPrefab(prefab = $./coin10.brz, offset = off, velocity = Vec(50.0 / 5.0, 0.0 / 5.0, 55.0), lifetime = 30.0, limit = 60)
    SpawnPrefab(prefab = $./coin10.brz, offset = off, velocity = Vec(-50.0 / 5.0, 30.0 / 5.0, 55.0), lifetime = 30.0, limit = 60)
  } else if kind == 2 {
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(50.0 / 5.0, 0.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
    SpawnPrefab(prefab = $./coin10.brz, offset = off, velocity = Vec(-50.0 / 5.0, 30.0 / 5.0, 55.0), lifetime = 30.0, limit = 60)
  } else if kind == 3 {
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(50.0 / 5.0, 0.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(-50.0 / 5.0, 30.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
  } else {
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(50.0 / 5.0, 0.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(-50.0 / 5.0, 30.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(0.0 / 5.0, -50.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
    SpawnPrefab(prefab = $./coin25.brz, offset = off, velocity = Vec(30.0 / 5.0, 50.0 / 5.0, 55.0), lifetime = 30.0, limit = 40)
  }
}
