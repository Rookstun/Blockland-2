// giver.ws -- the portal pedestal's chip. Its button sends global "pg.give" (who); /portalgun works anywhere.
// Gives a Portal Gun (a 0-damage guard pistol) + a fresh pgun chip for you (pgun.ws, spawned 8000 up).

@invisible

var serial: int = 0

mod give(ch: character) {
  let c = ch.ControllerOf()
  ch.AddInventoryItemAdv($BRItemBase/Weapon_GuardPistol, damage = 0.0, itemName = "Portal Gun")
  let s = serial + 1
  serial = s
  SendGlobalCustomEvent("pg.kill", c.GetUserId(), s)
  let e = SpawnPrefab(prefab = $./pgun.brz, offset = Vec(0.0, 0.0, 8000.0), lifetime = 0.0, limit = 64)
  SendGlobalCustomEvent("pg.init", c, s, target = e)
  c.ShowStatusMessage("Portal Gun: left click = blue, right click = orange. Thinking with portals is optional and discouraged.")
}

on GlobalCustomEvent("pg.give") -> (who: character) {
  give(who)
}

on ChatCommand("portalgun", "Portal Gun: take one") -> (ctrl, args) {
  give(ctrl.CharacterOf())
}

// debug: /pgtest NAME|SIDE|X|Y|Z|DX|DY|DZ  (SIDE -1 = give NAME a gun; 0/1 = shoot blue/orange from X Y Z along DX DY DZ)
on ChatCommand("pgtest", "portal gun debug") -> (ctrl, args) {
  let a0 = args.Trim().Split("|")
  let a1 = a0.Right.Split("|")
  let a2 = a1.Right.Split("|")
  let a3 = a2.Right.Split("|")
  let a4 = a3.Right.Split("|")
  let a5 = a4.Right.Split("|")
  let a6 = a5.Right.Split("|")
  let a7 = a6.Right.Split("|")
  let pc = FindPlayer(a0.Left)
  let sd = ParseNumber(a1.Left)
  PrintToConsole(Fmt("pg|test|{A}|{B}", pc.GetUserId(), sd))
  if sd < -0.5 {
    give(pc.CharacterOf())
  } else {
    SendGlobalCustomEvent("pg.shoot", pc.GetUserId(), round(sd), Vec(ParseNumber(a2.Left), ParseNumber(a3.Left), ParseNumber(a4.Left)),
      Vec(ParseNumber(a5.Left), ParseNumber(a6.Left), ParseNumber(a7.Left)))
  }
}
