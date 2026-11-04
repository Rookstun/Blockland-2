// rope.ws -- one per player holding a grapple gun (faik + Penta 2026-11-03: "grapple hook gun ... realistic
// swing physics, bounds, elasticity ... sliders for elasticity and rope length"). grapple.ws spawns it 8000 up
// and sends rope.init. Every tick: LMB with the gun out fires the hook (a sweep along the aim); LMB again, RMB,
// putting the gun away or dying lets go. While hooked the rope is a one-sided spring-damper on the player
// (AddVelocity): it only pulls when stretched past its rest length, so you swing, fall slack and bounce.
// Elasticity e 0..1: rope stiffness K_STIFF..K_SOFT, and how much outward speed the rope eats (rigid = all).
// The rope is drawn as BEADS frozen micro-brick grids from the hand to the hook, sagging when slack.
// Every var is read once at the top of the tick and written last (a Var read after its Set is stale).
// build.mjs fills the BEAD_* markers.

@invisible

const RANGE = 4000.0
const K_STIFF = 120.0
const K_SOFT = 6.0
const MAXDV = 900.0

var who: controller
var ready: bool = false
var serial: int = 0
var hooked: bool = false
var anchor: vector = Vec(0.0, 0.0, 0.0)
var rest: float = 0.0
var elast: float = 0.35
var ropeLen: float = 600.0
var lmbPrev: bool = false
var home: vector = Vec(0.0, 0.0, 0.0)
// BEAD_VARS

mod park() {
// BEAD_PARK
}

mod die() {
// BEAD_KILL
  ReadBrickGrid().DestroySpawnedPrefab()
}

on GlobalCustomEvent("rope.init", isObject = true) -> (c: controller, e: float, l: float, s: int) {
  who = c
  elast = e
  ropeLen = l
  serial = s
  home = ReadBrickGrid().GetLocation()
// BEAD_SPAWN
  ready = true
}

on GlobalCustomEvent("grap.cfg") -> (e: float, l: float) {
  elast = e
  ropeLen = l
}

// a newer rope for the same player replaces this one
on GlobalCustomEvent("rope.kill") -> (uid: string, s: int) {
  if ready && s > serial && uid == who.GetUserId() {
    ready = false
    die()
  }
}

on ServerUptime() {
  let dt = min(DeltaTime(), 0.1)
  let r0 = ready
  let h0 = hooked
  let a0 = anchor
  let rs0 = rest
  let e0 = elast
  let L0 = ropeLen
  let lp = lmbPrev
  if r0 {
    if who.GetUserId() == "" {
      ready = false
      die()
    } else {
      let ch = who.CharacterOf()
      let p = ch.GetLocation()
      let alive = Magnitude(p) > 1.0
      let inp = ch.GetInputs()
      let holding = alive && ch.GetInventoryEntry(ch.GetCurrentInventorySlot()).Item == $BRItemBase/Weapon_Pistol
      let lmb = holding && inp.PressedLeftMouse
      lmbPrev = lmb
      if h0 && (!holding || inp.PressedRightMouse || (lmb && !lp)) {
        hooked = false
        park()
        ch.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_2_Release)
      } else if lmb && !lp {
        let aim = ch.GetAim()
        let r = Sweep(aim.Origin, aim.Direction, RANGE, ignore = ch, detectBricks = true, detectMap = true)
        on r.Hit {
          anchor = r.HitLocation
          rest = max(min(Distance(p, r.HitLocation), L0), 40.0)
          hooked = true
          ch.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_1_Press)
        }
        on r.Miss {
          who.ShowStatusMessage("The hook sails off into nothing and comes back looking embarrassed.")
        }
      } else if h0 {
        let v = ch.GetLinearVelocity()
        let d = p - a0
        let dist = Magnitude(d)
        let n = ScaleVec(d, 1.0 / max(dist, 1.0))
        let stretch = dist - rs0
        if stretch > 0.0 {
          let vr = Dot(v, n)
          let k = K_STIFF + (K_SOFT - K_STIFF) * e0
          let absorb = if vr > 0.0 then vr * (0.85 * (1.0 - e0) + 0.04) else vr * 0.04
          let dvr = clamp(0.0 - k * stretch * dt - absorb, 0.0 - MAXDV, MAXDV)
          ch.AddVelocity(linear = ScaleVec(n, dvr))
        }
        // slack rope sags: half the missing length, deepest mid-rope
        let sag = sqrt(max(rs0 * rs0 - dist * dist, 0.0)) * 0.5
        let hand = p + Vec(0.0, 0.0, 10.0)
        let span = a0 - hand
// BEAD_DRAW
      }
    }
  }
}
