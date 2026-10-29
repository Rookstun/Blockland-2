// Bot melee vs bots (2026-10-28): the game's melee damage is client-predicted (ServerApplyMeleePredictedDamage),
// so a bot's swing only ever hurts players. On every bot swing, sweep in front of it and apply the damage here.
on CharacterFiredWeapon() -> (shooter, direction, start, weapon, weaponName) {
  if shooter.ControllerOf().GetUserName().Length() == 0 {
    let r = Sweep(start, direction, 90.0, radius = 25.0, ignore = shooter, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
    on r.Hit {
      if r.HitEntity.ControllerOf().GetUserName().Length() == 0 {
        r.HitEntity.IncDamage(35.0)
        PrintToConsole("[melee] ${weaponName} hit ${r.HitDistance}")
      }
    }
    on r.Miss {
      PrintToConsole("[melee] ${weaponName} miss")
    }
  }
}
