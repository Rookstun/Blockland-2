// Diagnostic (2026-10-11): does CharacterFiredWeapon fire for bot melee swings?
on CharacterFiredWeapon() -> (shooter, weapon, weaponName, start, direction) {
  PrintToConsole("[probe] fired user=${shooter.ControllerOf().GetUserName()} name=${shooter.ControllerOf().GetDisplayName()} w=${weaponName} at=${start}")
}
