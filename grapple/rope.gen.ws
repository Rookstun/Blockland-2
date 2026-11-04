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
var b0: entity
var b1: entity
var b2: entity
var b3: entity
var b4: entity
var b5: entity
var b6: entity
var b7: entity
var b8: entity
var b9: entity
var b10: entity
var b11: entity
var b12: entity
var b13: entity
var b14: entity
var b15: entity
var b16: entity
var b17: entity
var b18: entity
var b19: entity

mod park() {
  b0.SetLocation(home)
  b1.SetLocation(home)
  b2.SetLocation(home)
  b3.SetLocation(home)
  b4.SetLocation(home)
  b5.SetLocation(home)
  b6.SetLocation(home)
  b7.SetLocation(home)
  b8.SetLocation(home)
  b9.SetLocation(home)
  b10.SetLocation(home)
  b11.SetLocation(home)
  b12.SetLocation(home)
  b13.SetLocation(home)
  b14.SetLocation(home)
  b15.SetLocation(home)
  b16.SetLocation(home)
  b17.SetLocation(home)
  b18.SetLocation(home)
  b19.SetLocation(home)
}

mod die() {
  b0.DestroySpawnedPrefab()
  b1.DestroySpawnedPrefab()
  b2.DestroySpawnedPrefab()
  b3.DestroySpawnedPrefab()
  b4.DestroySpawnedPrefab()
  b5.DestroySpawnedPrefab()
  b6.DestroySpawnedPrefab()
  b7.DestroySpawnedPrefab()
  b8.DestroySpawnedPrefab()
  b9.DestroySpawnedPrefab()
  b10.DestroySpawnedPrefab()
  b11.DestroySpawnedPrefab()
  b12.DestroySpawnedPrefab()
  b13.DestroySpawnedPrefab()
  b14.DestroySpawnedPrefab()
  b15.DestroySpawnedPrefab()
  b16.DestroySpawnedPrefab()
  b17.DestroySpawnedPrefab()
  b18.DestroySpawnedPrefab()
  b19.DestroySpawnedPrefab()
  ReadBrickGrid().DestroySpawnedPrefab()
}

on GlobalCustomEvent("rope.init", isObject = true) -> (c: controller, e: float, l: float, s: int) {
  who = c
  elast = e
  ropeLen = l
  serial = s
  home = ReadBrickGrid().GetLocation()
  let s0 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s0.SetFrozen(true)
  b0 = s0
  let s1 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s1.SetFrozen(true)
  b1 = s1
  let s2 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s2.SetFrozen(true)
  b2 = s2
  let s3 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s3.SetFrozen(true)
  b3 = s3
  let s4 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s4.SetFrozen(true)
  b4 = s4
  let s5 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s5.SetFrozen(true)
  b5 = s5
  let s6 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s6.SetFrozen(true)
  b6 = s6
  let s7 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s7.SetFrozen(true)
  b7 = s7
  let s8 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s8.SetFrozen(true)
  b8 = s8
  let s9 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s9.SetFrozen(true)
  b9 = s9
  let s10 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s10.SetFrozen(true)
  b10 = s10
  let s11 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s11.SetFrozen(true)
  b11 = s11
  let s12 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s12.SetFrozen(true)
  b12 = s12
  let s13 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s13.SetFrozen(true)
  b13 = s13
  let s14 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s14.SetFrozen(true)
  b14 = s14
  let s15 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s15.SetFrozen(true)
  b15 = s15
  let s16 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s16.SetFrozen(true)
  b16 = s16
  let s17 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s17.SetFrozen(true)
  b17 = s17
  let s18 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s18.SetFrozen(true)
  b18 = s18
  let s19 = SpawnPrefab(prefab = $./bead.brz, lifetime = 0.0, limit = 1)
  s19.SetFrozen(true)
  b19 = s19
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
        b0.SetLocation(hand + ScaleVec(span, 0.0250) - Vec(0.0, 0.0, sag * 0.0975))
        b1.SetLocation(hand + ScaleVec(span, 0.0750) - Vec(0.0, 0.0, sag * 0.2775))
        b2.SetLocation(hand + ScaleVec(span, 0.1250) - Vec(0.0, 0.0, sag * 0.4375))
        b3.SetLocation(hand + ScaleVec(span, 0.1750) - Vec(0.0, 0.0, sag * 0.5775))
        b4.SetLocation(hand + ScaleVec(span, 0.2250) - Vec(0.0, 0.0, sag * 0.6975))
        b5.SetLocation(hand + ScaleVec(span, 0.2750) - Vec(0.0, 0.0, sag * 0.7975))
        b6.SetLocation(hand + ScaleVec(span, 0.3250) - Vec(0.0, 0.0, sag * 0.8775))
        b7.SetLocation(hand + ScaleVec(span, 0.3750) - Vec(0.0, 0.0, sag * 0.9375))
        b8.SetLocation(hand + ScaleVec(span, 0.4250) - Vec(0.0, 0.0, sag * 0.9775))
        b9.SetLocation(hand + ScaleVec(span, 0.4750) - Vec(0.0, 0.0, sag * 0.9975))
        b10.SetLocation(hand + ScaleVec(span, 0.5250) - Vec(0.0, 0.0, sag * 0.9975))
        b11.SetLocation(hand + ScaleVec(span, 0.5750) - Vec(0.0, 0.0, sag * 0.9775))
        b12.SetLocation(hand + ScaleVec(span, 0.6250) - Vec(0.0, 0.0, sag * 0.9375))
        b13.SetLocation(hand + ScaleVec(span, 0.6750) - Vec(0.0, 0.0, sag * 0.8775))
        b14.SetLocation(hand + ScaleVec(span, 0.7250) - Vec(0.0, 0.0, sag * 0.7975))
        b15.SetLocation(hand + ScaleVec(span, 0.7750) - Vec(0.0, 0.0, sag * 0.6975))
        b16.SetLocation(hand + ScaleVec(span, 0.8250) - Vec(0.0, 0.0, sag * 0.5775))
        b17.SetLocation(hand + ScaleVec(span, 0.8750) - Vec(0.0, 0.0, sag * 0.4375))
        b18.SetLocation(hand + ScaleVec(span, 0.9250) - Vec(0.0, 0.0, sag * 0.2775))
        b19.SetLocation(hand + ScaleVec(span, 0.9750) - Vec(0.0, 0.0, sag * 0.0975))
      }
    }
  }
}
