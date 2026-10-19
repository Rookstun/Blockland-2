// RuneScape-style hitsplats (owner 2026-10-18: "add hitsplats"). Every hit
// spawns one of the splat<k>.brz variants (build.mjs: scruffy red star cluster + white damage number, both camera-facing
// TextDisplays drawn over the world) at the victim's chest for a second, then
// sends the number to it as an object event (delivered the next tick).

on CharacterDamaged() -> (victim, damage, attacker, attackerWeapon, attackerWeaponName) {
  if damage >= 0.5 {
    let at = victim.GetLocation()
    let off = at - GetOwnTransform().Location + Vec(Random(-8.0, 8.0), Random(-8.0, 8.0), 30.0 + Random(-6.0, 6.0))
    let txt = Fmt("{A:.0}", damage)
    let pick = Random(0, VARIANTS)
    //@DEBUG@
//@SPAWN@
  }
}

//@SELF@
