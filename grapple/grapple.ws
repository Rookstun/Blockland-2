// grapple.ws -- the grapple board's chip (under the desk). The board's buttons send global "grap.set" (who, op):
//   op 0       take a Grapple Gun (a 0-damage pistol) + a fresh rope chip for you (rope.ws, spawned 8000 up)
//   op 1..10   elasticity slider: rigid .. bouncy
//   op 11..20  rope length slider: 150 .. 1500
// Settings are shared by everyone and broadcast to every rope chip ("grap.cfg"). /grapple gives a gun too.

@invisible

var elast: float = 0.33
var ropeLen: float = 600.0
var eStep: int = 4
var lStep: int = 4
var serial: int = 0

const BAR = "||||||||||"
const DOT = ".........."

mod show(c: controller, es: int, ls: int, len: float) {
  c.DisplayText("ELASTICITY  [${BAR.Substring(0, es)}${DOT.Substring(0, 10 - es)}]   ROPE  [${BAR.Substring(0, ls)}${DOT.Substring(0, 10 - ls)}] ${len}",
    fontSize = 28, typeface = Bold, anchorX = 0.5, anchorY = 0.2, pivotX = 0.5, pivotY = 0.5, outlineSize = 2, lifetime = 4.0, textId = 53300)
}

mod give(ch: character) {
  let c = ch.ControllerOf()
  ch.AddInventoryItemAdv($BRItemBase/Weapon_Pistol, damage = 0.0, itemName = "Grapple Gun")
  let s = (serial % 100) * 10000000000 + round(GetUnixTime()) + 1  // unique across desk reloads (rope.kill matches s != serial)
  serial = s
  SendGlobalCustomEvent("rope.kill", c.GetUserId(), s)
  let e = SpawnPrefab(prefab = $./rope.brz, offset = Vec(0.0, 0.0, 8000.0), lifetime = 0.0, limit = 64)
  SendGlobalCustomEvent("rope.init", c, elast, ropeLen, s, target = e)
  c.ShowStatusMessage("Grapple Gun: click to hook, click again or right click to let go. Mind the ceiling.")
}

on GlobalCustomEvent("grap.set") -> (who: character, op: int) {
  let c = who.ControllerOf()
  if op == 0 {
    give(who)
  } else if op <= 10 {
    let l = ropeLen
    eStep = op
    elast = (op - 1) / 9.0
    SendGlobalCustomEvent("grap.cfg", (op - 1) / 9.0, l)
    show(c, op, lStep, l)
  } else {
    let e = elast
    lStep = op - 10
    ropeLen = (op - 10) * 150.0
    SendGlobalCustomEvent("grap.cfg", e, (op - 10) * 150.0)
    show(c, eStep, op - 10, (op - 10) * 150.0)
  }
}

on ChatCommand("grapple", "Grapple Gun: take one") -> (ctrl, args) {
  give(ctrl.CharacterOf())
}
