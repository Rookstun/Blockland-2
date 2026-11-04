// pgun.ws -- one per player holding a Portal Gun (owner 2026-11-03: "portal gun ... ray casting using sweeps ...
// brick color and player color ... a camera in which you can see the other side of the portal").
// giver.ws spawns it 8000 up and sends pg.init; it spawns this player's two portals (blue + orange prefabs, frozen).
// LMB with the gun out = blue portal on the surface you aim at, RMB = orange (aim ray = chained 100-unit sweeps:
// a Sweep reaches at most 100 units). Walk into one, come out of the other with your velocity turned through.
// CAMERA: each portal's face is a W x H screen of coloured text cells. Every tick 2 rows of one portal are cast:
// the ray from the owner's eye through that cell is carried through the portal (rotated 180 degrees about the
// portal's up axis) and swept out of the OTHER portal; HitColor (bricks, map and players) shaded by the hit normal
// and fogged by distance, sky on a miss. Rows go to the portal's screen chip as "pv" events.
// Every var is read once at the top of the tick and written last (a Var read after its Set is stale).
// build.mjs fills the //@...@ markers.

@invisible

const W = //@W@
const BLK = //@BLK@
const EXIT = 50.0
const MINOUT = 250.0
const VIEW = 3000.0

var who: controller
var ready: bool = false
var serial: int = 0
var pe0: entity
var pe1: entity
var on0: bool = false
var on1: bool = false
var c0: vector = Vec(0.0, 0.0, 0.0)
var n0: vector = Vec(1.0, 0.0, 0.0)
var r0: vector = Vec(0.0, -1.0, 0.0)
var u0: vector = Vec(0.0, 0.0, 1.0)
var c1: vector = Vec(0.0, 0.0, 0.0)
var n1: vector = Vec(1.0, 0.0, 0.0)
var r1: vector = Vec(0.0, -1.0, 0.0)
var u1: vector = Vec(0.0, 0.0, 1.0)
var lmbPrev: bool = false
var rmbPrev: bool = false
var rr: int = 0
var side: int = 0
var cool: float = 0.0
var px: string[] = //@PX@
var hv: vector[] = [Vec(0.0, 0.0, 0.0), Vec(0.0, 0.0, 1.0)]
var hk: int[] = [0]
var dbg: bool = false

mod die() {
  pe0.DestroySpawnedPrefab()
  pe1.DestroySpawnedPrefab()
  ReadBrickGrid().DestroySpawnedPrefab()
}

// one row of px as run-length coloured block text
mod rowStr() -> string {
  var s: string = ""
  var h: string = px[0]
  var n: int = 0
  for c in 0..W {
    let x = px[c]
    if x == h {
      n += 1
    } else {
      s = s .. "<color=\"" .. h .. "\">" .. BLK[n] .. "</>"
      h = x
      n = 1
    }
  }
  return s .. "<color=\"" .. h .. "\">" .. BLK[n] .. "</>"
}

// put portal sd on the surface at h with normal n; ad = the shooter's aim (picks "up" on floors and ceilings)
mod place(sd: int, h: vector, n: vector, ad: vector, oc: vector, oon: bool, ch: character) {
  let steep = abs(n.z) > 0.97
  let pd = if steep then (if n.z > 0.0 then 90.0 else -90.0) else Rad2Deg(asin(n.z))
  let yd = if steep then (if n.z > 0.0 then Rad2Deg(atan2(0.0 - ad.y, 0.0 - ad.x)) else Rad2Deg(atan2(ad.y, ad.x))) else Rad2Deg(atan2(n.y, n.x))
  let P = Deg2Rad(pd)
  let Y = Deg2Rad(yd)
  let N = Vec(cos(P) * cos(Y), cos(P) * sin(Y), sin(P))
  let U = Vec(0.0 - sin(P) * cos(Y), 0.0 - sin(P) * sin(Y), cos(P))
  let R = Vec(sin(Y), 0.0 - cos(Y), 0.0)
  let loc = h + N * 2.2
  if oon && Distance(loc, oc) < 70.0 {
    who.ShowStatusMessage("Two portals in one spot would only argue. Aim somewhere else.")
  } else {
    if sd == 0 {
      pe0.SetLocationRotation(loc, Rotation(pd, yd, 0.0))
      c0 = loc
      n0 = N
      r0 = R
      u0 = U
      on0 = true
    } else {
      pe1.SetLocationRotation(loc, Rotation(pd, yd, 0.0))
      c1 = loc
      n1 = N
      r1 = R
      u1 = U
      on1 = true
    }
    ch.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_1_Press)
    if dbg {
      PrintToConsole(Fmt("pg|place|{A}|{B:.1}|{C:.1}|{D:.1}|{E}", sd, loc.x, loc.y, loc.z, Fmt("{A:.2}|{B:.2}|{C:.2}|{D:.1}|{E:.1}", N.x, N.y, N.z, pd, yd)))
    }
  }
}

// fire portal shot (0 blue, 1 orange) from ao along ad: chained sweeps write the first hit into hv/hk, then one place()
mod shoot(shot: int, ao: vector, ad: vector, oc: vector, oon: bool, ch: character) {
  hk[0] = 0
//@AIM@
  if hk[0] == 1 {
    place(shot, hv[0], hv[1], ad, oc, oon, ch)
  } else {
    who.ShowStatusMessage("The portal flies off into the distance, looking for a wall it will never find.")
  }
}

// e walked into portal A (CA NA RA UA): out of portal B, offset and velocity turned through
mod warp(e: entity, CA: vector, NA: vector, RA: vector, UA: vector, CB: vector, NB: vector, RB: vector, UB: vector) {
  let p = e.GetLocation()
  let v = e.GetLinearVelocity()
  let d = p - CA
  let o1 = clamp(Dot(d, RA), -18.0, 18.0)
  let o2 = clamp(Dot(d, UA), -30.0, 30.0)
  let vt = NB * (0.0 - Dot(v, NA)) - RB * Dot(v, RA) + UB * Dot(v, UA)
  let v2 = vt + NB * max(MINOUT - Dot(vt, NB), 0.0)
  e.SetLocation(CB - RB * o1 + UB * o2 + NB * EXIT)
  e.AddVelocity(linear = v2 - v)
}

on GlobalCustomEvent("pg.init", isObject = true) -> (c: controller, s: int) {
  who = c
  serial = s
  let a = SpawnPrefab(prefab = $./portal_blue.brz, lifetime = 0.0, limit = 1)
  a.SetFrozen(true)
  pe0 = a
  let b = SpawnPrefab(prefab = $./portal_orange.brz, lifetime = 0.0, limit = 1)
  b.SetFrozen(true)
  pe1 = b
  ready = true
  PrintToConsole("pg|init|" .. c.GetUserId())
}

// debug (giver /pgtest): shoot as this player from o along d, and print placements + row 0 of each finished screen
on GlobalCustomEvent("pg.shoot") -> (uid: string, shot: int, o: vector, d: vector) {
  if ready && uid == who.GetUserId() {
    dbg = true
    shoot(shot, o, Normalize(d), if shot == 0 then c1 else c0, if shot == 0 then on1 else on0, who.CharacterOf())
  }
}

// a newer gun for the same player replaces this one
on GlobalCustomEvent("pg.kill") -> (uid: string, s: int) {
  if ready && s != serial && uid == who.GetUserId() {
    ready = false
    die()
  }
}

on ServerUptime() {
  let dt = min(DeltaTime(), 0.1)
  let rd = ready
  let lp = lmbPrev
  let rp = rmbPrev
  let A0 = on0
  let A1 = on1
  let C0 = c0
  let N0 = n0
  let R0 = r0
  let U0 = u0
  let C1 = c1
  let N1 = n1
  let R1 = r1
  let U1 = u1
  let cl = cool
  let sd = side
  let rw = rr
  if rd {
    if who.GetUserId() == "" {
      ready = false
      die()
    } else {
      let ch = who.CharacterOf()
      let p = ch.GetLocation()
      let alive = Magnitude(p) > 1.0
      let inp = ch.GetInputs()
      let holding = alive && ch.GetInventoryEntry(ch.GetCurrentInventorySlot()).Item == $BRItemBase/Weapon_GuardPistol
      let lmb = holding && inp.PressedLeftMouse
      let rmb = holding && inp.PressedRightMouse
      lmbPrev = lmb
      rmbPrev = rmb
      if (lmb && !lp) || (rmb && !rp) {
        let shot = if lmb && !lp then 0 else 1
        let aim = ch.GetAim()
        let ao = aim.Origin
        let ad = Normalize(aim.Direction)
        shoot(shot, ao, ad, if shot == 0 then C1 else C0, if shot == 0 then A1 else A0, ch)
      } else if A0 && A1 {
        // walk-through: a sphere swept up the middle of each portal, just in front of it
        if cl > 0.0 {
          cool = cl - dt
        } else {
          let t0 = Sweep(C0 + N0 * 14.0 - U0 * 30.0, U0, 60.0, radius = 14.0, detectBricks = false, detectMap = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on t0.Hit {
            warp(t0.HitEntity, C0, N0, R0, U0, C1, N1, R1, U1)
            cool = 0.4
          }
          on t0.Miss {
            let t1 = Sweep(C1 + N1 * 14.0 - U1 * 30.0, U1, 60.0, radius = 14.0, detectBricks = false, detectMap = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on t1.Hit {
              warp(t1.HitEntity, C1, N1, R1, U1, C0, N0, R0, U0)
              cool = 0.4
            }
          }
        }
        // camera: 2 rows of portal sd's screen, seen through portal sd from the owner's eye, cast out of the other
        if Distance(p, C0) < VIEW || Distance(p, C1) < VIEW {
          let SC = if sd == 0 then C0 else C1
          let SN = if sd == 0 then N0 else N1
          let SR = if sd == 0 then R0 else R1
          let SU = if sd == 0 then U0 else U1
          let DC = if sd == 0 then C1 else C0
          let DN = if sd == 0 then N1 else N0
          let DR = if sd == 0 then R1 else R0
          let DU = if sd == 0 then U1 else U0
          let eye = ch.GetAim().Origin
          let rel = eye - SC
          let E = if alive && Dot(rel, SN) > 10.0 && Magnitude(rel) < VIEW then eye else SC + SN * 150.0
//@ROWS@
          let sc = if sd == 0 then pe0 else pe1
          if dbg && rw == 6 {
            PrintToConsole(Fmt("pg|row|{A}|{B:.0}|{C:.0}|{D:.0}|{E}", sd, E.x, E.y, E.z, row0))
          }
          SendGlobalCustomEvent("pv", rw, row0 .. "\n" .. row1, target = sc)
          rr = if rw + 1 >= //@NS@ then 0 else rw + 1
          side = if rw + 1 >= //@NS@ then 1 - sd else sd
        }
      }
    }
  }
}
