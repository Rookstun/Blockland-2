// RuneScape-style hitsplats (owner 2026-10-18: "add hitsplats"). Every hit
// spawns splat.brz (build.mjs: red dot + white damage number, both camera-facing
// TextDisplays drawn over the world) at the victim's chest for a second, then
// sends the number to it as an object event (delivered the next tick).

on CharacterDamaged() -> (victim, damage, attacker, attackerWeapon, attackerWeaponName) {
  if damage >= 0.5 {
    let at = victim.GetLocation()
    let splat = SpawnPrefab(prefab = $./splat.brz, offset = at - GetOwnTransform().Location + Vec(Random(-8.0, 8.0), Random(-8.0, 8.0), 30.0 + Random(-6.0, 6.0)), lifetime = 1.2, limit = 120)
    //@DEBUG@
    splat.SendGlobalCustomEvent("hs", Fmt("{A:.0}", damage))
  }
}

//@SELF@
