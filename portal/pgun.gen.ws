// pgun.ws -- one per player holding a Portal Gun (owner 2026-11-03: "portal gun ... ray casting using sweeps ...
// brick color and player color ... a camera in which you can see the other side of the portal").
// giver.ws spawns it 8000 up and sends pg.init; it spawns this player's two portals (blue + orange prefabs, frozen).
// firing the gun (LMB) = blue portal where the shot goes, RMB = orange (aim ray = chained 100-unit sweeps:
// a Sweep reaches at most 100 units). Walk into one, come out of the other with your velocity turned through.
// CAMERA: each portal's face is a W x H screen of coloured text cells. Every tick 2 rows of one portal are cast:
// the ray from the owner's eye through that cell is carried through the portal (rotated 180 degrees about the
// portal's up axis) and swept out of the OTHER portal; HitColor (bricks, map and players) shaded by the hit normal
// and fogged by distance, sky on a miss. Rows go to the portal's screen chip as "pv" events.
// Every var is read once at the top of the tick and written last (a Var read after its Set is stale).
// build.mjs fills the //@...@ markers.

@invisible

const W = 16
const BLK = ["", "█", "██", "███", "████", "█████", "██████", "███████", "████████", "█████████", "██████████", "███████████", "████████████", "█████████████", "██████████████", "███████████████", "████████████████"]
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
var rmbPrev: bool = false
var rr: int = 0
var side: int = 0
var cool: float = 0.0
var px: string[] = ["000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000"]
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
        let a0 = Sweep(ao, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
        on a0.Hit {
          place(shot, a0.HitLocation, Normalize(a0.HitNormal), ad, oc, oon, ch)
        }
        on a0.Miss {
          let a1 = Sweep(ao + ad * 99.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
          on a1.Hit {
            place(shot, a1.HitLocation, Normalize(a1.HitNormal), ad, oc, oon, ch)
          }
          on a1.Miss {
            let a2 = Sweep(ao + ad * 198.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
            on a2.Hit {
              place(shot, a2.HitLocation, Normalize(a2.HitNormal), ad, oc, oon, ch)
            }
            on a2.Miss {
              let a3 = Sweep(ao + ad * 297.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
              on a3.Hit {
                place(shot, a3.HitLocation, Normalize(a3.HitNormal), ad, oc, oon, ch)
              }
              on a3.Miss {
                let a4 = Sweep(ao + ad * 396.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                on a4.Hit {
                  place(shot, a4.HitLocation, Normalize(a4.HitNormal), ad, oc, oon, ch)
                }
                on a4.Miss {
                  let a5 = Sweep(ao + ad * 495.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                  on a5.Hit {
                    place(shot, a5.HitLocation, Normalize(a5.HitNormal), ad, oc, oon, ch)
                  }
                  on a5.Miss {
                    let a6 = Sweep(ao + ad * 594.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                    on a6.Hit {
                      place(shot, a6.HitLocation, Normalize(a6.HitNormal), ad, oc, oon, ch)
                    }
                    on a6.Miss {
                      let a7 = Sweep(ao + ad * 693.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                      on a7.Hit {
                        place(shot, a7.HitLocation, Normalize(a7.HitNormal), ad, oc, oon, ch)
                      }
                      on a7.Miss {
                        let a8 = Sweep(ao + ad * 792.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                        on a8.Hit {
                          place(shot, a8.HitLocation, Normalize(a8.HitNormal), ad, oc, oon, ch)
                        }
                        on a8.Miss {
                          let a9 = Sweep(ao + ad * 891.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                          on a9.Hit {
                            place(shot, a9.HitLocation, Normalize(a9.HitNormal), ad, oc, oon, ch)
                          }
                          on a9.Miss {
                            let a10 = Sweep(ao + ad * 990.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                            on a10.Hit {
                              place(shot, a10.HitLocation, Normalize(a10.HitNormal), ad, oc, oon, ch)
                            }
                            on a10.Miss {
                              let a11 = Sweep(ao + ad * 1089.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                              on a11.Hit {
                                place(shot, a11.HitLocation, Normalize(a11.HitNormal), ad, oc, oon, ch)
                              }
                              on a11.Miss {
                                let a12 = Sweep(ao + ad * 1188.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                on a12.Hit {
                                  place(shot, a12.HitLocation, Normalize(a12.HitNormal), ad, oc, oon, ch)
                                }
                                on a12.Miss {
                                  let a13 = Sweep(ao + ad * 1287.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                  on a13.Hit {
                                    place(shot, a13.HitLocation, Normalize(a13.HitNormal), ad, oc, oon, ch)
                                  }
                                  on a13.Miss {
                                    let a14 = Sweep(ao + ad * 1386.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                    on a14.Hit {
                                      place(shot, a14.HitLocation, Normalize(a14.HitNormal), ad, oc, oon, ch)
                                    }
                                    on a14.Miss {
                                      let a15 = Sweep(ao + ad * 1485.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                      on a15.Hit {
                                        place(shot, a15.HitLocation, Normalize(a15.HitNormal), ad, oc, oon, ch)
                                      }
                                      on a15.Miss {
                                        let a16 = Sweep(ao + ad * 1584.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                        on a16.Hit {
                                          place(shot, a16.HitLocation, Normalize(a16.HitNormal), ad, oc, oon, ch)
                                        }
                                        on a16.Miss {
                                          let a17 = Sweep(ao + ad * 1683.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                          on a17.Hit {
                                            place(shot, a17.HitLocation, Normalize(a17.HitNormal), ad, oc, oon, ch)
                                          }
                                          on a17.Miss {
                                            let a18 = Sweep(ao + ad * 1782.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                            on a18.Hit {
                                              place(shot, a18.HitLocation, Normalize(a18.HitNormal), ad, oc, oon, ch)
                                            }
                                            on a18.Miss {
                                              let a19 = Sweep(ao + ad * 1881.0, ad, 100.0, ignore = ch, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                              on a19.Hit {
                                                place(shot, a19.HitLocation, Normalize(a19.HitNormal), ad, oc, oon, ch)
                                              }
                                              on a19.Miss {
                                                who.ShowStatusMessage("The portal flies off into the distance, looking for a wall it will never find.")
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
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

// blue = firing the gun: with a gun out, left click fires it and never shows up as PressedLeftMouse (2026-11-03)
on CharacterFiredWeapon() -> (shooter, direction, start, weapon, weaponName) {
  if ready && weapon == $BRItemBase/Weapon_GuardPistol && shooter.ControllerOf().GetUserId() == who.GetUserId() {
    shoot(0, start, Normalize(direction), c1, on1, shooter)
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
      let rmb = holding && inp.PressedRightMouse
      rmbPrev = rmb
      if rmb && !rp {
        let shot = 1
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
          let yo0 = 39.0 - (rw * 2.0 + 0.5) * 3.0
          let d0_0 = Normalize(SC + SR * -22.5 + SU * yo0 - E)
          let D0_0 = Normalize(DN * (0.0 - Dot(d0_0, SN)) - DR * Dot(d0_0, SR) + DU * Dot(d0_0, SU))
          let O0_0 = DC - DR * -22.5 + DU * yo0 + DN * 2.0
          let k0_0_0 = Sweep(O0_0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_0_0.Hit {
            px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_0.HitColor, 0.62 + 0.25 * k0_0_0.HitNormal.z + 0.13 * k0_0_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_0_0.Miss {
            let k0_0_1 = Sweep(O0_0 + D0_0 * 99.0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_0_1.Hit {
              px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_1.HitColor, 0.62 + 0.25 * k0_0_1.HitNormal.z + 0.13 * k0_0_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_0_1.Miss {
              let k0_0_2 = Sweep(O0_0 + D0_0 * 198.0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_0_2.Hit {
                px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_2.HitColor, 0.62 + 0.25 * k0_0_2.HitNormal.z + 0.13 * k0_0_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_0_2.Miss {
                let k0_0_3 = Sweep(O0_0 + D0_0 * 297.0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_0_3.Hit {
                  px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_3.HitColor, 0.62 + 0.25 * k0_0_3.HitNormal.z + 0.13 * k0_0_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_0_3.Miss {
                  let k0_0_4 = Sweep(O0_0 + D0_0 * 396.0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_0_4.Hit {
                    px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_4.HitColor, 0.62 + 0.25 * k0_0_4.HitNormal.z + 0.13 * k0_0_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_0_4.Miss {
                    let k0_0_5 = Sweep(O0_0 + D0_0 * 495.0, D0_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_0_5.Hit {
                      px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_5.HitColor, 0.62 + 0.25 * k0_0_5.HitNormal.z + 0.13 * k0_0_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_0_5.Miss {
                      px[0] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_0.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_1 = Normalize(SC + SR * -19.5 + SU * yo0 - E)
          let D0_1 = Normalize(DN * (0.0 - Dot(d0_1, SN)) - DR * Dot(d0_1, SR) + DU * Dot(d0_1, SU))
          let O0_1 = DC - DR * -19.5 + DU * yo0 + DN * 2.0
          let k0_1_0 = Sweep(O0_1, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_1_0.Hit {
            px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_0.HitColor, 0.62 + 0.25 * k0_1_0.HitNormal.z + 0.13 * k0_1_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_1_0.Miss {
            let k0_1_1 = Sweep(O0_1 + D0_1 * 99.0, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_1_1.Hit {
              px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_1.HitColor, 0.62 + 0.25 * k0_1_1.HitNormal.z + 0.13 * k0_1_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_1_1.Miss {
              let k0_1_2 = Sweep(O0_1 + D0_1 * 198.0, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_1_2.Hit {
                px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_2.HitColor, 0.62 + 0.25 * k0_1_2.HitNormal.z + 0.13 * k0_1_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_1_2.Miss {
                let k0_1_3 = Sweep(O0_1 + D0_1 * 297.0, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_1_3.Hit {
                  px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_3.HitColor, 0.62 + 0.25 * k0_1_3.HitNormal.z + 0.13 * k0_1_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_1_3.Miss {
                  let k0_1_4 = Sweep(O0_1 + D0_1 * 396.0, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_1_4.Hit {
                    px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_4.HitColor, 0.62 + 0.25 * k0_1_4.HitNormal.z + 0.13 * k0_1_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_1_4.Miss {
                    let k0_1_5 = Sweep(O0_1 + D0_1 * 495.0, D0_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_1_5.Hit {
                      px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_5.HitColor, 0.62 + 0.25 * k0_1_5.HitNormal.z + 0.13 * k0_1_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_1_5.Miss {
                      px[1] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_1.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_2 = Normalize(SC + SR * -16.5 + SU * yo0 - E)
          let D0_2 = Normalize(DN * (0.0 - Dot(d0_2, SN)) - DR * Dot(d0_2, SR) + DU * Dot(d0_2, SU))
          let O0_2 = DC - DR * -16.5 + DU * yo0 + DN * 2.0
          let k0_2_0 = Sweep(O0_2, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_2_0.Hit {
            px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_0.HitColor, 0.62 + 0.25 * k0_2_0.HitNormal.z + 0.13 * k0_2_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_2_0.Miss {
            let k0_2_1 = Sweep(O0_2 + D0_2 * 99.0, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_2_1.Hit {
              px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_1.HitColor, 0.62 + 0.25 * k0_2_1.HitNormal.z + 0.13 * k0_2_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_2_1.Miss {
              let k0_2_2 = Sweep(O0_2 + D0_2 * 198.0, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_2_2.Hit {
                px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_2.HitColor, 0.62 + 0.25 * k0_2_2.HitNormal.z + 0.13 * k0_2_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_2_2.Miss {
                let k0_2_3 = Sweep(O0_2 + D0_2 * 297.0, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_2_3.Hit {
                  px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_3.HitColor, 0.62 + 0.25 * k0_2_3.HitNormal.z + 0.13 * k0_2_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_2_3.Miss {
                  let k0_2_4 = Sweep(O0_2 + D0_2 * 396.0, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_2_4.Hit {
                    px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_4.HitColor, 0.62 + 0.25 * k0_2_4.HitNormal.z + 0.13 * k0_2_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_2_4.Miss {
                    let k0_2_5 = Sweep(O0_2 + D0_2 * 495.0, D0_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_2_5.Hit {
                      px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_5.HitColor, 0.62 + 0.25 * k0_2_5.HitNormal.z + 0.13 * k0_2_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_2_5.Miss {
                      px[2] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_2.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_3 = Normalize(SC + SR * -13.5 + SU * yo0 - E)
          let D0_3 = Normalize(DN * (0.0 - Dot(d0_3, SN)) - DR * Dot(d0_3, SR) + DU * Dot(d0_3, SU))
          let O0_3 = DC - DR * -13.5 + DU * yo0 + DN * 2.0
          let k0_3_0 = Sweep(O0_3, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_3_0.Hit {
            px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_0.HitColor, 0.62 + 0.25 * k0_3_0.HitNormal.z + 0.13 * k0_3_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_3_0.Miss {
            let k0_3_1 = Sweep(O0_3 + D0_3 * 99.0, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_3_1.Hit {
              px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_1.HitColor, 0.62 + 0.25 * k0_3_1.HitNormal.z + 0.13 * k0_3_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_3_1.Miss {
              let k0_3_2 = Sweep(O0_3 + D0_3 * 198.0, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_3_2.Hit {
                px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_2.HitColor, 0.62 + 0.25 * k0_3_2.HitNormal.z + 0.13 * k0_3_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_3_2.Miss {
                let k0_3_3 = Sweep(O0_3 + D0_3 * 297.0, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_3_3.Hit {
                  px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_3.HitColor, 0.62 + 0.25 * k0_3_3.HitNormal.z + 0.13 * k0_3_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_3_3.Miss {
                  let k0_3_4 = Sweep(O0_3 + D0_3 * 396.0, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_3_4.Hit {
                    px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_4.HitColor, 0.62 + 0.25 * k0_3_4.HitNormal.z + 0.13 * k0_3_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_3_4.Miss {
                    let k0_3_5 = Sweep(O0_3 + D0_3 * 495.0, D0_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_3_5.Hit {
                      px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_5.HitColor, 0.62 + 0.25 * k0_3_5.HitNormal.z + 0.13 * k0_3_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_3_5.Miss {
                      px[3] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_3.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_4 = Normalize(SC + SR * -10.5 + SU * yo0 - E)
          let D0_4 = Normalize(DN * (0.0 - Dot(d0_4, SN)) - DR * Dot(d0_4, SR) + DU * Dot(d0_4, SU))
          let O0_4 = DC - DR * -10.5 + DU * yo0 + DN * 2.0
          let k0_4_0 = Sweep(O0_4, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_4_0.Hit {
            px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_0.HitColor, 0.62 + 0.25 * k0_4_0.HitNormal.z + 0.13 * k0_4_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_4_0.Miss {
            let k0_4_1 = Sweep(O0_4 + D0_4 * 99.0, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_4_1.Hit {
              px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_1.HitColor, 0.62 + 0.25 * k0_4_1.HitNormal.z + 0.13 * k0_4_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_4_1.Miss {
              let k0_4_2 = Sweep(O0_4 + D0_4 * 198.0, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_4_2.Hit {
                px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_2.HitColor, 0.62 + 0.25 * k0_4_2.HitNormal.z + 0.13 * k0_4_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_4_2.Miss {
                let k0_4_3 = Sweep(O0_4 + D0_4 * 297.0, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_4_3.Hit {
                  px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_3.HitColor, 0.62 + 0.25 * k0_4_3.HitNormal.z + 0.13 * k0_4_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_4_3.Miss {
                  let k0_4_4 = Sweep(O0_4 + D0_4 * 396.0, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_4_4.Hit {
                    px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_4.HitColor, 0.62 + 0.25 * k0_4_4.HitNormal.z + 0.13 * k0_4_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_4_4.Miss {
                    let k0_4_5 = Sweep(O0_4 + D0_4 * 495.0, D0_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_4_5.Hit {
                      px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_5.HitColor, 0.62 + 0.25 * k0_4_5.HitNormal.z + 0.13 * k0_4_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_4_5.Miss {
                      px[4] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_4.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_5 = Normalize(SC + SR * -7.5 + SU * yo0 - E)
          let D0_5 = Normalize(DN * (0.0 - Dot(d0_5, SN)) - DR * Dot(d0_5, SR) + DU * Dot(d0_5, SU))
          let O0_5 = DC - DR * -7.5 + DU * yo0 + DN * 2.0
          let k0_5_0 = Sweep(O0_5, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_5_0.Hit {
            px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_0.HitColor, 0.62 + 0.25 * k0_5_0.HitNormal.z + 0.13 * k0_5_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_5_0.Miss {
            let k0_5_1 = Sweep(O0_5 + D0_5 * 99.0, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_5_1.Hit {
              px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_1.HitColor, 0.62 + 0.25 * k0_5_1.HitNormal.z + 0.13 * k0_5_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_5_1.Miss {
              let k0_5_2 = Sweep(O0_5 + D0_5 * 198.0, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_5_2.Hit {
                px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_2.HitColor, 0.62 + 0.25 * k0_5_2.HitNormal.z + 0.13 * k0_5_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_5_2.Miss {
                let k0_5_3 = Sweep(O0_5 + D0_5 * 297.0, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_5_3.Hit {
                  px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_3.HitColor, 0.62 + 0.25 * k0_5_3.HitNormal.z + 0.13 * k0_5_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_5_3.Miss {
                  let k0_5_4 = Sweep(O0_5 + D0_5 * 396.0, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_5_4.Hit {
                    px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_4.HitColor, 0.62 + 0.25 * k0_5_4.HitNormal.z + 0.13 * k0_5_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_5_4.Miss {
                    let k0_5_5 = Sweep(O0_5 + D0_5 * 495.0, D0_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_5_5.Hit {
                      px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_5.HitColor, 0.62 + 0.25 * k0_5_5.HitNormal.z + 0.13 * k0_5_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_5_5.Miss {
                      px[5] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_5.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_6 = Normalize(SC + SR * -4.5 + SU * yo0 - E)
          let D0_6 = Normalize(DN * (0.0 - Dot(d0_6, SN)) - DR * Dot(d0_6, SR) + DU * Dot(d0_6, SU))
          let O0_6 = DC - DR * -4.5 + DU * yo0 + DN * 2.0
          let k0_6_0 = Sweep(O0_6, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_6_0.Hit {
            px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_0.HitColor, 0.62 + 0.25 * k0_6_0.HitNormal.z + 0.13 * k0_6_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_6_0.Miss {
            let k0_6_1 = Sweep(O0_6 + D0_6 * 99.0, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_6_1.Hit {
              px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_1.HitColor, 0.62 + 0.25 * k0_6_1.HitNormal.z + 0.13 * k0_6_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_6_1.Miss {
              let k0_6_2 = Sweep(O0_6 + D0_6 * 198.0, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_6_2.Hit {
                px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_2.HitColor, 0.62 + 0.25 * k0_6_2.HitNormal.z + 0.13 * k0_6_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_6_2.Miss {
                let k0_6_3 = Sweep(O0_6 + D0_6 * 297.0, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_6_3.Hit {
                  px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_3.HitColor, 0.62 + 0.25 * k0_6_3.HitNormal.z + 0.13 * k0_6_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_6_3.Miss {
                  let k0_6_4 = Sweep(O0_6 + D0_6 * 396.0, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_6_4.Hit {
                    px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_4.HitColor, 0.62 + 0.25 * k0_6_4.HitNormal.z + 0.13 * k0_6_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_6_4.Miss {
                    let k0_6_5 = Sweep(O0_6 + D0_6 * 495.0, D0_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_6_5.Hit {
                      px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_5.HitColor, 0.62 + 0.25 * k0_6_5.HitNormal.z + 0.13 * k0_6_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_6_5.Miss {
                      px[6] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_6.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_7 = Normalize(SC + SR * -1.5 + SU * yo0 - E)
          let D0_7 = Normalize(DN * (0.0 - Dot(d0_7, SN)) - DR * Dot(d0_7, SR) + DU * Dot(d0_7, SU))
          let O0_7 = DC - DR * -1.5 + DU * yo0 + DN * 2.0
          let k0_7_0 = Sweep(O0_7, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_7_0.Hit {
            px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_0.HitColor, 0.62 + 0.25 * k0_7_0.HitNormal.z + 0.13 * k0_7_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_7_0.Miss {
            let k0_7_1 = Sweep(O0_7 + D0_7 * 99.0, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_7_1.Hit {
              px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_1.HitColor, 0.62 + 0.25 * k0_7_1.HitNormal.z + 0.13 * k0_7_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_7_1.Miss {
              let k0_7_2 = Sweep(O0_7 + D0_7 * 198.0, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_7_2.Hit {
                px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_2.HitColor, 0.62 + 0.25 * k0_7_2.HitNormal.z + 0.13 * k0_7_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_7_2.Miss {
                let k0_7_3 = Sweep(O0_7 + D0_7 * 297.0, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_7_3.Hit {
                  px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_3.HitColor, 0.62 + 0.25 * k0_7_3.HitNormal.z + 0.13 * k0_7_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_7_3.Miss {
                  let k0_7_4 = Sweep(O0_7 + D0_7 * 396.0, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_7_4.Hit {
                    px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_4.HitColor, 0.62 + 0.25 * k0_7_4.HitNormal.z + 0.13 * k0_7_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_7_4.Miss {
                    let k0_7_5 = Sweep(O0_7 + D0_7 * 495.0, D0_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_7_5.Hit {
                      px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_5.HitColor, 0.62 + 0.25 * k0_7_5.HitNormal.z + 0.13 * k0_7_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_7_5.Miss {
                      px[7] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_7.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_8 = Normalize(SC + SR * 1.5 + SU * yo0 - E)
          let D0_8 = Normalize(DN * (0.0 - Dot(d0_8, SN)) - DR * Dot(d0_8, SR) + DU * Dot(d0_8, SU))
          let O0_8 = DC - DR * 1.5 + DU * yo0 + DN * 2.0
          let k0_8_0 = Sweep(O0_8, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_8_0.Hit {
            px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_0.HitColor, 0.62 + 0.25 * k0_8_0.HitNormal.z + 0.13 * k0_8_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_8_0.Miss {
            let k0_8_1 = Sweep(O0_8 + D0_8 * 99.0, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_8_1.Hit {
              px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_1.HitColor, 0.62 + 0.25 * k0_8_1.HitNormal.z + 0.13 * k0_8_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_8_1.Miss {
              let k0_8_2 = Sweep(O0_8 + D0_8 * 198.0, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_8_2.Hit {
                px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_2.HitColor, 0.62 + 0.25 * k0_8_2.HitNormal.z + 0.13 * k0_8_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_8_2.Miss {
                let k0_8_3 = Sweep(O0_8 + D0_8 * 297.0, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_8_3.Hit {
                  px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_3.HitColor, 0.62 + 0.25 * k0_8_3.HitNormal.z + 0.13 * k0_8_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_8_3.Miss {
                  let k0_8_4 = Sweep(O0_8 + D0_8 * 396.0, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_8_4.Hit {
                    px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_4.HitColor, 0.62 + 0.25 * k0_8_4.HitNormal.z + 0.13 * k0_8_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_8_4.Miss {
                    let k0_8_5 = Sweep(O0_8 + D0_8 * 495.0, D0_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_8_5.Hit {
                      px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_5.HitColor, 0.62 + 0.25 * k0_8_5.HitNormal.z + 0.13 * k0_8_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_8_5.Miss {
                      px[8] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_8.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_9 = Normalize(SC + SR * 4.5 + SU * yo0 - E)
          let D0_9 = Normalize(DN * (0.0 - Dot(d0_9, SN)) - DR * Dot(d0_9, SR) + DU * Dot(d0_9, SU))
          let O0_9 = DC - DR * 4.5 + DU * yo0 + DN * 2.0
          let k0_9_0 = Sweep(O0_9, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_9_0.Hit {
            px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_0.HitColor, 0.62 + 0.25 * k0_9_0.HitNormal.z + 0.13 * k0_9_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_9_0.Miss {
            let k0_9_1 = Sweep(O0_9 + D0_9 * 99.0, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_9_1.Hit {
              px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_1.HitColor, 0.62 + 0.25 * k0_9_1.HitNormal.z + 0.13 * k0_9_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_9_1.Miss {
              let k0_9_2 = Sweep(O0_9 + D0_9 * 198.0, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_9_2.Hit {
                px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_2.HitColor, 0.62 + 0.25 * k0_9_2.HitNormal.z + 0.13 * k0_9_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_9_2.Miss {
                let k0_9_3 = Sweep(O0_9 + D0_9 * 297.0, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_9_3.Hit {
                  px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_3.HitColor, 0.62 + 0.25 * k0_9_3.HitNormal.z + 0.13 * k0_9_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_9_3.Miss {
                  let k0_9_4 = Sweep(O0_9 + D0_9 * 396.0, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_9_4.Hit {
                    px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_4.HitColor, 0.62 + 0.25 * k0_9_4.HitNormal.z + 0.13 * k0_9_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_9_4.Miss {
                    let k0_9_5 = Sweep(O0_9 + D0_9 * 495.0, D0_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_9_5.Hit {
                      px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_5.HitColor, 0.62 + 0.25 * k0_9_5.HitNormal.z + 0.13 * k0_9_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_9_5.Miss {
                      px[9] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_9.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_10 = Normalize(SC + SR * 7.5 + SU * yo0 - E)
          let D0_10 = Normalize(DN * (0.0 - Dot(d0_10, SN)) - DR * Dot(d0_10, SR) + DU * Dot(d0_10, SU))
          let O0_10 = DC - DR * 7.5 + DU * yo0 + DN * 2.0
          let k0_10_0 = Sweep(O0_10, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_10_0.Hit {
            px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_0.HitColor, 0.62 + 0.25 * k0_10_0.HitNormal.z + 0.13 * k0_10_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_10_0.Miss {
            let k0_10_1 = Sweep(O0_10 + D0_10 * 99.0, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_10_1.Hit {
              px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_1.HitColor, 0.62 + 0.25 * k0_10_1.HitNormal.z + 0.13 * k0_10_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_10_1.Miss {
              let k0_10_2 = Sweep(O0_10 + D0_10 * 198.0, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_10_2.Hit {
                px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_2.HitColor, 0.62 + 0.25 * k0_10_2.HitNormal.z + 0.13 * k0_10_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_10_2.Miss {
                let k0_10_3 = Sweep(O0_10 + D0_10 * 297.0, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_10_3.Hit {
                  px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_3.HitColor, 0.62 + 0.25 * k0_10_3.HitNormal.z + 0.13 * k0_10_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_10_3.Miss {
                  let k0_10_4 = Sweep(O0_10 + D0_10 * 396.0, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_10_4.Hit {
                    px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_4.HitColor, 0.62 + 0.25 * k0_10_4.HitNormal.z + 0.13 * k0_10_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_10_4.Miss {
                    let k0_10_5 = Sweep(O0_10 + D0_10 * 495.0, D0_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_10_5.Hit {
                      px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_5.HitColor, 0.62 + 0.25 * k0_10_5.HitNormal.z + 0.13 * k0_10_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_10_5.Miss {
                      px[10] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_10.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_11 = Normalize(SC + SR * 10.5 + SU * yo0 - E)
          let D0_11 = Normalize(DN * (0.0 - Dot(d0_11, SN)) - DR * Dot(d0_11, SR) + DU * Dot(d0_11, SU))
          let O0_11 = DC - DR * 10.5 + DU * yo0 + DN * 2.0
          let k0_11_0 = Sweep(O0_11, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_11_0.Hit {
            px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_0.HitColor, 0.62 + 0.25 * k0_11_0.HitNormal.z + 0.13 * k0_11_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_11_0.Miss {
            let k0_11_1 = Sweep(O0_11 + D0_11 * 99.0, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_11_1.Hit {
              px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_1.HitColor, 0.62 + 0.25 * k0_11_1.HitNormal.z + 0.13 * k0_11_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_11_1.Miss {
              let k0_11_2 = Sweep(O0_11 + D0_11 * 198.0, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_11_2.Hit {
                px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_2.HitColor, 0.62 + 0.25 * k0_11_2.HitNormal.z + 0.13 * k0_11_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_11_2.Miss {
                let k0_11_3 = Sweep(O0_11 + D0_11 * 297.0, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_11_3.Hit {
                  px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_3.HitColor, 0.62 + 0.25 * k0_11_3.HitNormal.z + 0.13 * k0_11_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_11_3.Miss {
                  let k0_11_4 = Sweep(O0_11 + D0_11 * 396.0, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_11_4.Hit {
                    px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_4.HitColor, 0.62 + 0.25 * k0_11_4.HitNormal.z + 0.13 * k0_11_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_11_4.Miss {
                    let k0_11_5 = Sweep(O0_11 + D0_11 * 495.0, D0_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_11_5.Hit {
                      px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_5.HitColor, 0.62 + 0.25 * k0_11_5.HitNormal.z + 0.13 * k0_11_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_11_5.Miss {
                      px[11] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_11.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_12 = Normalize(SC + SR * 13.5 + SU * yo0 - E)
          let D0_12 = Normalize(DN * (0.0 - Dot(d0_12, SN)) - DR * Dot(d0_12, SR) + DU * Dot(d0_12, SU))
          let O0_12 = DC - DR * 13.5 + DU * yo0 + DN * 2.0
          let k0_12_0 = Sweep(O0_12, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_12_0.Hit {
            px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_0.HitColor, 0.62 + 0.25 * k0_12_0.HitNormal.z + 0.13 * k0_12_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_12_0.Miss {
            let k0_12_1 = Sweep(O0_12 + D0_12 * 99.0, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_12_1.Hit {
              px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_1.HitColor, 0.62 + 0.25 * k0_12_1.HitNormal.z + 0.13 * k0_12_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_12_1.Miss {
              let k0_12_2 = Sweep(O0_12 + D0_12 * 198.0, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_12_2.Hit {
                px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_2.HitColor, 0.62 + 0.25 * k0_12_2.HitNormal.z + 0.13 * k0_12_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_12_2.Miss {
                let k0_12_3 = Sweep(O0_12 + D0_12 * 297.0, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_12_3.Hit {
                  px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_3.HitColor, 0.62 + 0.25 * k0_12_3.HitNormal.z + 0.13 * k0_12_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_12_3.Miss {
                  let k0_12_4 = Sweep(O0_12 + D0_12 * 396.0, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_12_4.Hit {
                    px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_4.HitColor, 0.62 + 0.25 * k0_12_4.HitNormal.z + 0.13 * k0_12_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_12_4.Miss {
                    let k0_12_5 = Sweep(O0_12 + D0_12 * 495.0, D0_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_12_5.Hit {
                      px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_5.HitColor, 0.62 + 0.25 * k0_12_5.HitNormal.z + 0.13 * k0_12_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_12_5.Miss {
                      px[12] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_12.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_13 = Normalize(SC + SR * 16.5 + SU * yo0 - E)
          let D0_13 = Normalize(DN * (0.0 - Dot(d0_13, SN)) - DR * Dot(d0_13, SR) + DU * Dot(d0_13, SU))
          let O0_13 = DC - DR * 16.5 + DU * yo0 + DN * 2.0
          let k0_13_0 = Sweep(O0_13, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_13_0.Hit {
            px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_0.HitColor, 0.62 + 0.25 * k0_13_0.HitNormal.z + 0.13 * k0_13_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_13_0.Miss {
            let k0_13_1 = Sweep(O0_13 + D0_13 * 99.0, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_13_1.Hit {
              px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_1.HitColor, 0.62 + 0.25 * k0_13_1.HitNormal.z + 0.13 * k0_13_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_13_1.Miss {
              let k0_13_2 = Sweep(O0_13 + D0_13 * 198.0, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_13_2.Hit {
                px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_2.HitColor, 0.62 + 0.25 * k0_13_2.HitNormal.z + 0.13 * k0_13_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_13_2.Miss {
                let k0_13_3 = Sweep(O0_13 + D0_13 * 297.0, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_13_3.Hit {
                  px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_3.HitColor, 0.62 + 0.25 * k0_13_3.HitNormal.z + 0.13 * k0_13_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_13_3.Miss {
                  let k0_13_4 = Sweep(O0_13 + D0_13 * 396.0, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_13_4.Hit {
                    px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_4.HitColor, 0.62 + 0.25 * k0_13_4.HitNormal.z + 0.13 * k0_13_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_13_4.Miss {
                    let k0_13_5 = Sweep(O0_13 + D0_13 * 495.0, D0_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_13_5.Hit {
                      px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_5.HitColor, 0.62 + 0.25 * k0_13_5.HitNormal.z + 0.13 * k0_13_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_13_5.Miss {
                      px[13] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_13.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_14 = Normalize(SC + SR * 19.5 + SU * yo0 - E)
          let D0_14 = Normalize(DN * (0.0 - Dot(d0_14, SN)) - DR * Dot(d0_14, SR) + DU * Dot(d0_14, SU))
          let O0_14 = DC - DR * 19.5 + DU * yo0 + DN * 2.0
          let k0_14_0 = Sweep(O0_14, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_14_0.Hit {
            px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_0.HitColor, 0.62 + 0.25 * k0_14_0.HitNormal.z + 0.13 * k0_14_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_14_0.Miss {
            let k0_14_1 = Sweep(O0_14 + D0_14 * 99.0, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_14_1.Hit {
              px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_1.HitColor, 0.62 + 0.25 * k0_14_1.HitNormal.z + 0.13 * k0_14_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_14_1.Miss {
              let k0_14_2 = Sweep(O0_14 + D0_14 * 198.0, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_14_2.Hit {
                px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_2.HitColor, 0.62 + 0.25 * k0_14_2.HitNormal.z + 0.13 * k0_14_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_14_2.Miss {
                let k0_14_3 = Sweep(O0_14 + D0_14 * 297.0, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_14_3.Hit {
                  px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_3.HitColor, 0.62 + 0.25 * k0_14_3.HitNormal.z + 0.13 * k0_14_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_14_3.Miss {
                  let k0_14_4 = Sweep(O0_14 + D0_14 * 396.0, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_14_4.Hit {
                    px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_4.HitColor, 0.62 + 0.25 * k0_14_4.HitNormal.z + 0.13 * k0_14_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_14_4.Miss {
                    let k0_14_5 = Sweep(O0_14 + D0_14 * 495.0, D0_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_14_5.Hit {
                      px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_5.HitColor, 0.62 + 0.25 * k0_14_5.HitNormal.z + 0.13 * k0_14_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_14_5.Miss {
                      px[14] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_14.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d0_15 = Normalize(SC + SR * 22.5 + SU * yo0 - E)
          let D0_15 = Normalize(DN * (0.0 - Dot(d0_15, SN)) - DR * Dot(d0_15, SR) + DU * Dot(d0_15, SU))
          let O0_15 = DC - DR * 22.5 + DU * yo0 + DN * 2.0
          let k0_15_0 = Sweep(O0_15, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k0_15_0.Hit {
            px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_0.HitColor, 0.62 + 0.25 * k0_15_0.HitNormal.z + 0.13 * k0_15_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_15_0.Miss {
            let k0_15_1 = Sweep(O0_15 + D0_15 * 99.0, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k0_15_1.Hit {
              px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_1.HitColor, 0.62 + 0.25 * k0_15_1.HitNormal.z + 0.13 * k0_15_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_15_1.Miss {
              let k0_15_2 = Sweep(O0_15 + D0_15 * 198.0, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k0_15_2.Hit {
                px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_2.HitColor, 0.62 + 0.25 * k0_15_2.HitNormal.z + 0.13 * k0_15_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_15_2.Miss {
                let k0_15_3 = Sweep(O0_15 + D0_15 * 297.0, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k0_15_3.Hit {
                  px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_3.HitColor, 0.62 + 0.25 * k0_15_3.HitNormal.z + 0.13 * k0_15_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_15_3.Miss {
                  let k0_15_4 = Sweep(O0_15 + D0_15 * 396.0, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k0_15_4.Hit {
                    px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_4.HitColor, 0.62 + 0.25 * k0_15_4.HitNormal.z + 0.13 * k0_15_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_15_4.Miss {
                    let k0_15_5 = Sweep(O0_15 + D0_15 * 495.0, D0_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k0_15_5.Hit {
                      px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_5.HitColor, 0.62 + 0.25 * k0_15_5.HitNormal.z + 0.13 * k0_15_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k0_15_5.Miss {
                      px[15] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D0_15.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let row0 = rowStr()
          let yo1 = 39.0 - (rw * 2.0 + 1.5) * 3.0
          let d1_0 = Normalize(SC + SR * -22.5 + SU * yo1 - E)
          let D1_0 = Normalize(DN * (0.0 - Dot(d1_0, SN)) - DR * Dot(d1_0, SR) + DU * Dot(d1_0, SU))
          let O1_0 = DC - DR * -22.5 + DU * yo1 + DN * 2.0
          let k1_0_0 = Sweep(O1_0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_0_0.Hit {
            px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_0.HitColor, 0.62 + 0.25 * k1_0_0.HitNormal.z + 0.13 * k1_0_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_0_0.Miss {
            let k1_0_1 = Sweep(O1_0 + D1_0 * 99.0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_0_1.Hit {
              px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_1.HitColor, 0.62 + 0.25 * k1_0_1.HitNormal.z + 0.13 * k1_0_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_0_1.Miss {
              let k1_0_2 = Sweep(O1_0 + D1_0 * 198.0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_0_2.Hit {
                px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_2.HitColor, 0.62 + 0.25 * k1_0_2.HitNormal.z + 0.13 * k1_0_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_0_2.Miss {
                let k1_0_3 = Sweep(O1_0 + D1_0 * 297.0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_0_3.Hit {
                  px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_3.HitColor, 0.62 + 0.25 * k1_0_3.HitNormal.z + 0.13 * k1_0_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_0_3.Miss {
                  let k1_0_4 = Sweep(O1_0 + D1_0 * 396.0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_0_4.Hit {
                    px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_4.HitColor, 0.62 + 0.25 * k1_0_4.HitNormal.z + 0.13 * k1_0_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_0_4.Miss {
                    let k1_0_5 = Sweep(O1_0 + D1_0 * 495.0, D1_0, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_0_5.Hit {
                      px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_5.HitColor, 0.62 + 0.25 * k1_0_5.HitNormal.z + 0.13 * k1_0_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_0_5.Miss {
                      px[0] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_0.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_1 = Normalize(SC + SR * -19.5 + SU * yo1 - E)
          let D1_1 = Normalize(DN * (0.0 - Dot(d1_1, SN)) - DR * Dot(d1_1, SR) + DU * Dot(d1_1, SU))
          let O1_1 = DC - DR * -19.5 + DU * yo1 + DN * 2.0
          let k1_1_0 = Sweep(O1_1, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_1_0.Hit {
            px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_0.HitColor, 0.62 + 0.25 * k1_1_0.HitNormal.z + 0.13 * k1_1_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_1_0.Miss {
            let k1_1_1 = Sweep(O1_1 + D1_1 * 99.0, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_1_1.Hit {
              px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_1.HitColor, 0.62 + 0.25 * k1_1_1.HitNormal.z + 0.13 * k1_1_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_1_1.Miss {
              let k1_1_2 = Sweep(O1_1 + D1_1 * 198.0, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_1_2.Hit {
                px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_2.HitColor, 0.62 + 0.25 * k1_1_2.HitNormal.z + 0.13 * k1_1_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_1_2.Miss {
                let k1_1_3 = Sweep(O1_1 + D1_1 * 297.0, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_1_3.Hit {
                  px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_3.HitColor, 0.62 + 0.25 * k1_1_3.HitNormal.z + 0.13 * k1_1_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_1_3.Miss {
                  let k1_1_4 = Sweep(O1_1 + D1_1 * 396.0, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_1_4.Hit {
                    px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_4.HitColor, 0.62 + 0.25 * k1_1_4.HitNormal.z + 0.13 * k1_1_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_1_4.Miss {
                    let k1_1_5 = Sweep(O1_1 + D1_1 * 495.0, D1_1, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_1_5.Hit {
                      px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_5.HitColor, 0.62 + 0.25 * k1_1_5.HitNormal.z + 0.13 * k1_1_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_1_5.Miss {
                      px[1] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_1.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_2 = Normalize(SC + SR * -16.5 + SU * yo1 - E)
          let D1_2 = Normalize(DN * (0.0 - Dot(d1_2, SN)) - DR * Dot(d1_2, SR) + DU * Dot(d1_2, SU))
          let O1_2 = DC - DR * -16.5 + DU * yo1 + DN * 2.0
          let k1_2_0 = Sweep(O1_2, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_2_0.Hit {
            px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_0.HitColor, 0.62 + 0.25 * k1_2_0.HitNormal.z + 0.13 * k1_2_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_2_0.Miss {
            let k1_2_1 = Sweep(O1_2 + D1_2 * 99.0, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_2_1.Hit {
              px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_1.HitColor, 0.62 + 0.25 * k1_2_1.HitNormal.z + 0.13 * k1_2_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_2_1.Miss {
              let k1_2_2 = Sweep(O1_2 + D1_2 * 198.0, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_2_2.Hit {
                px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_2.HitColor, 0.62 + 0.25 * k1_2_2.HitNormal.z + 0.13 * k1_2_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_2_2.Miss {
                let k1_2_3 = Sweep(O1_2 + D1_2 * 297.0, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_2_3.Hit {
                  px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_3.HitColor, 0.62 + 0.25 * k1_2_3.HitNormal.z + 0.13 * k1_2_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_2_3.Miss {
                  let k1_2_4 = Sweep(O1_2 + D1_2 * 396.0, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_2_4.Hit {
                    px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_4.HitColor, 0.62 + 0.25 * k1_2_4.HitNormal.z + 0.13 * k1_2_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_2_4.Miss {
                    let k1_2_5 = Sweep(O1_2 + D1_2 * 495.0, D1_2, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_2_5.Hit {
                      px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_5.HitColor, 0.62 + 0.25 * k1_2_5.HitNormal.z + 0.13 * k1_2_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_2_5.Miss {
                      px[2] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_2.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_3 = Normalize(SC + SR * -13.5 + SU * yo1 - E)
          let D1_3 = Normalize(DN * (0.0 - Dot(d1_3, SN)) - DR * Dot(d1_3, SR) + DU * Dot(d1_3, SU))
          let O1_3 = DC - DR * -13.5 + DU * yo1 + DN * 2.0
          let k1_3_0 = Sweep(O1_3, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_3_0.Hit {
            px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_0.HitColor, 0.62 + 0.25 * k1_3_0.HitNormal.z + 0.13 * k1_3_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_3_0.Miss {
            let k1_3_1 = Sweep(O1_3 + D1_3 * 99.0, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_3_1.Hit {
              px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_1.HitColor, 0.62 + 0.25 * k1_3_1.HitNormal.z + 0.13 * k1_3_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_3_1.Miss {
              let k1_3_2 = Sweep(O1_3 + D1_3 * 198.0, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_3_2.Hit {
                px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_2.HitColor, 0.62 + 0.25 * k1_3_2.HitNormal.z + 0.13 * k1_3_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_3_2.Miss {
                let k1_3_3 = Sweep(O1_3 + D1_3 * 297.0, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_3_3.Hit {
                  px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_3.HitColor, 0.62 + 0.25 * k1_3_3.HitNormal.z + 0.13 * k1_3_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_3_3.Miss {
                  let k1_3_4 = Sweep(O1_3 + D1_3 * 396.0, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_3_4.Hit {
                    px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_4.HitColor, 0.62 + 0.25 * k1_3_4.HitNormal.z + 0.13 * k1_3_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_3_4.Miss {
                    let k1_3_5 = Sweep(O1_3 + D1_3 * 495.0, D1_3, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_3_5.Hit {
                      px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_5.HitColor, 0.62 + 0.25 * k1_3_5.HitNormal.z + 0.13 * k1_3_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_3_5.Miss {
                      px[3] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_3.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_4 = Normalize(SC + SR * -10.5 + SU * yo1 - E)
          let D1_4 = Normalize(DN * (0.0 - Dot(d1_4, SN)) - DR * Dot(d1_4, SR) + DU * Dot(d1_4, SU))
          let O1_4 = DC - DR * -10.5 + DU * yo1 + DN * 2.0
          let k1_4_0 = Sweep(O1_4, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_4_0.Hit {
            px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_0.HitColor, 0.62 + 0.25 * k1_4_0.HitNormal.z + 0.13 * k1_4_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_4_0.Miss {
            let k1_4_1 = Sweep(O1_4 + D1_4 * 99.0, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_4_1.Hit {
              px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_1.HitColor, 0.62 + 0.25 * k1_4_1.HitNormal.z + 0.13 * k1_4_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_4_1.Miss {
              let k1_4_2 = Sweep(O1_4 + D1_4 * 198.0, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_4_2.Hit {
                px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_2.HitColor, 0.62 + 0.25 * k1_4_2.HitNormal.z + 0.13 * k1_4_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_4_2.Miss {
                let k1_4_3 = Sweep(O1_4 + D1_4 * 297.0, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_4_3.Hit {
                  px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_3.HitColor, 0.62 + 0.25 * k1_4_3.HitNormal.z + 0.13 * k1_4_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_4_3.Miss {
                  let k1_4_4 = Sweep(O1_4 + D1_4 * 396.0, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_4_4.Hit {
                    px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_4.HitColor, 0.62 + 0.25 * k1_4_4.HitNormal.z + 0.13 * k1_4_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_4_4.Miss {
                    let k1_4_5 = Sweep(O1_4 + D1_4 * 495.0, D1_4, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_4_5.Hit {
                      px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_5.HitColor, 0.62 + 0.25 * k1_4_5.HitNormal.z + 0.13 * k1_4_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_4_5.Miss {
                      px[4] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_4.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_5 = Normalize(SC + SR * -7.5 + SU * yo1 - E)
          let D1_5 = Normalize(DN * (0.0 - Dot(d1_5, SN)) - DR * Dot(d1_5, SR) + DU * Dot(d1_5, SU))
          let O1_5 = DC - DR * -7.5 + DU * yo1 + DN * 2.0
          let k1_5_0 = Sweep(O1_5, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_5_0.Hit {
            px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_0.HitColor, 0.62 + 0.25 * k1_5_0.HitNormal.z + 0.13 * k1_5_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_5_0.Miss {
            let k1_5_1 = Sweep(O1_5 + D1_5 * 99.0, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_5_1.Hit {
              px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_1.HitColor, 0.62 + 0.25 * k1_5_1.HitNormal.z + 0.13 * k1_5_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_5_1.Miss {
              let k1_5_2 = Sweep(O1_5 + D1_5 * 198.0, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_5_2.Hit {
                px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_2.HitColor, 0.62 + 0.25 * k1_5_2.HitNormal.z + 0.13 * k1_5_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_5_2.Miss {
                let k1_5_3 = Sweep(O1_5 + D1_5 * 297.0, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_5_3.Hit {
                  px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_3.HitColor, 0.62 + 0.25 * k1_5_3.HitNormal.z + 0.13 * k1_5_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_5_3.Miss {
                  let k1_5_4 = Sweep(O1_5 + D1_5 * 396.0, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_5_4.Hit {
                    px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_4.HitColor, 0.62 + 0.25 * k1_5_4.HitNormal.z + 0.13 * k1_5_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_5_4.Miss {
                    let k1_5_5 = Sweep(O1_5 + D1_5 * 495.0, D1_5, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_5_5.Hit {
                      px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_5.HitColor, 0.62 + 0.25 * k1_5_5.HitNormal.z + 0.13 * k1_5_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_5_5.Miss {
                      px[5] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_5.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_6 = Normalize(SC + SR * -4.5 + SU * yo1 - E)
          let D1_6 = Normalize(DN * (0.0 - Dot(d1_6, SN)) - DR * Dot(d1_6, SR) + DU * Dot(d1_6, SU))
          let O1_6 = DC - DR * -4.5 + DU * yo1 + DN * 2.0
          let k1_6_0 = Sweep(O1_6, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_6_0.Hit {
            px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_0.HitColor, 0.62 + 0.25 * k1_6_0.HitNormal.z + 0.13 * k1_6_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_6_0.Miss {
            let k1_6_1 = Sweep(O1_6 + D1_6 * 99.0, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_6_1.Hit {
              px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_1.HitColor, 0.62 + 0.25 * k1_6_1.HitNormal.z + 0.13 * k1_6_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_6_1.Miss {
              let k1_6_2 = Sweep(O1_6 + D1_6 * 198.0, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_6_2.Hit {
                px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_2.HitColor, 0.62 + 0.25 * k1_6_2.HitNormal.z + 0.13 * k1_6_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_6_2.Miss {
                let k1_6_3 = Sweep(O1_6 + D1_6 * 297.0, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_6_3.Hit {
                  px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_3.HitColor, 0.62 + 0.25 * k1_6_3.HitNormal.z + 0.13 * k1_6_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_6_3.Miss {
                  let k1_6_4 = Sweep(O1_6 + D1_6 * 396.0, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_6_4.Hit {
                    px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_4.HitColor, 0.62 + 0.25 * k1_6_4.HitNormal.z + 0.13 * k1_6_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_6_4.Miss {
                    let k1_6_5 = Sweep(O1_6 + D1_6 * 495.0, D1_6, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_6_5.Hit {
                      px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_5.HitColor, 0.62 + 0.25 * k1_6_5.HitNormal.z + 0.13 * k1_6_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_6_5.Miss {
                      px[6] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_6.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_7 = Normalize(SC + SR * -1.5 + SU * yo1 - E)
          let D1_7 = Normalize(DN * (0.0 - Dot(d1_7, SN)) - DR * Dot(d1_7, SR) + DU * Dot(d1_7, SU))
          let O1_7 = DC - DR * -1.5 + DU * yo1 + DN * 2.0
          let k1_7_0 = Sweep(O1_7, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_7_0.Hit {
            px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_0.HitColor, 0.62 + 0.25 * k1_7_0.HitNormal.z + 0.13 * k1_7_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_7_0.Miss {
            let k1_7_1 = Sweep(O1_7 + D1_7 * 99.0, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_7_1.Hit {
              px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_1.HitColor, 0.62 + 0.25 * k1_7_1.HitNormal.z + 0.13 * k1_7_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_7_1.Miss {
              let k1_7_2 = Sweep(O1_7 + D1_7 * 198.0, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_7_2.Hit {
                px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_2.HitColor, 0.62 + 0.25 * k1_7_2.HitNormal.z + 0.13 * k1_7_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_7_2.Miss {
                let k1_7_3 = Sweep(O1_7 + D1_7 * 297.0, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_7_3.Hit {
                  px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_3.HitColor, 0.62 + 0.25 * k1_7_3.HitNormal.z + 0.13 * k1_7_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_7_3.Miss {
                  let k1_7_4 = Sweep(O1_7 + D1_7 * 396.0, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_7_4.Hit {
                    px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_4.HitColor, 0.62 + 0.25 * k1_7_4.HitNormal.z + 0.13 * k1_7_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_7_4.Miss {
                    let k1_7_5 = Sweep(O1_7 + D1_7 * 495.0, D1_7, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_7_5.Hit {
                      px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_5.HitColor, 0.62 + 0.25 * k1_7_5.HitNormal.z + 0.13 * k1_7_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_7_5.Miss {
                      px[7] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_7.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_8 = Normalize(SC + SR * 1.5 + SU * yo1 - E)
          let D1_8 = Normalize(DN * (0.0 - Dot(d1_8, SN)) - DR * Dot(d1_8, SR) + DU * Dot(d1_8, SU))
          let O1_8 = DC - DR * 1.5 + DU * yo1 + DN * 2.0
          let k1_8_0 = Sweep(O1_8, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_8_0.Hit {
            px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_0.HitColor, 0.62 + 0.25 * k1_8_0.HitNormal.z + 0.13 * k1_8_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_8_0.Miss {
            let k1_8_1 = Sweep(O1_8 + D1_8 * 99.0, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_8_1.Hit {
              px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_1.HitColor, 0.62 + 0.25 * k1_8_1.HitNormal.z + 0.13 * k1_8_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_8_1.Miss {
              let k1_8_2 = Sweep(O1_8 + D1_8 * 198.0, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_8_2.Hit {
                px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_2.HitColor, 0.62 + 0.25 * k1_8_2.HitNormal.z + 0.13 * k1_8_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_8_2.Miss {
                let k1_8_3 = Sweep(O1_8 + D1_8 * 297.0, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_8_3.Hit {
                  px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_3.HitColor, 0.62 + 0.25 * k1_8_3.HitNormal.z + 0.13 * k1_8_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_8_3.Miss {
                  let k1_8_4 = Sweep(O1_8 + D1_8 * 396.0, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_8_4.Hit {
                    px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_4.HitColor, 0.62 + 0.25 * k1_8_4.HitNormal.z + 0.13 * k1_8_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_8_4.Miss {
                    let k1_8_5 = Sweep(O1_8 + D1_8 * 495.0, D1_8, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_8_5.Hit {
                      px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_5.HitColor, 0.62 + 0.25 * k1_8_5.HitNormal.z + 0.13 * k1_8_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_8_5.Miss {
                      px[8] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_8.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_9 = Normalize(SC + SR * 4.5 + SU * yo1 - E)
          let D1_9 = Normalize(DN * (0.0 - Dot(d1_9, SN)) - DR * Dot(d1_9, SR) + DU * Dot(d1_9, SU))
          let O1_9 = DC - DR * 4.5 + DU * yo1 + DN * 2.0
          let k1_9_0 = Sweep(O1_9, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_9_0.Hit {
            px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_0.HitColor, 0.62 + 0.25 * k1_9_0.HitNormal.z + 0.13 * k1_9_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_9_0.Miss {
            let k1_9_1 = Sweep(O1_9 + D1_9 * 99.0, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_9_1.Hit {
              px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_1.HitColor, 0.62 + 0.25 * k1_9_1.HitNormal.z + 0.13 * k1_9_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_9_1.Miss {
              let k1_9_2 = Sweep(O1_9 + D1_9 * 198.0, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_9_2.Hit {
                px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_2.HitColor, 0.62 + 0.25 * k1_9_2.HitNormal.z + 0.13 * k1_9_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_9_2.Miss {
                let k1_9_3 = Sweep(O1_9 + D1_9 * 297.0, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_9_3.Hit {
                  px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_3.HitColor, 0.62 + 0.25 * k1_9_3.HitNormal.z + 0.13 * k1_9_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_9_3.Miss {
                  let k1_9_4 = Sweep(O1_9 + D1_9 * 396.0, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_9_4.Hit {
                    px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_4.HitColor, 0.62 + 0.25 * k1_9_4.HitNormal.z + 0.13 * k1_9_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_9_4.Miss {
                    let k1_9_5 = Sweep(O1_9 + D1_9 * 495.0, D1_9, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_9_5.Hit {
                      px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_5.HitColor, 0.62 + 0.25 * k1_9_5.HitNormal.z + 0.13 * k1_9_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_9_5.Miss {
                      px[9] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_9.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_10 = Normalize(SC + SR * 7.5 + SU * yo1 - E)
          let D1_10 = Normalize(DN * (0.0 - Dot(d1_10, SN)) - DR * Dot(d1_10, SR) + DU * Dot(d1_10, SU))
          let O1_10 = DC - DR * 7.5 + DU * yo1 + DN * 2.0
          let k1_10_0 = Sweep(O1_10, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_10_0.Hit {
            px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_0.HitColor, 0.62 + 0.25 * k1_10_0.HitNormal.z + 0.13 * k1_10_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_10_0.Miss {
            let k1_10_1 = Sweep(O1_10 + D1_10 * 99.0, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_10_1.Hit {
              px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_1.HitColor, 0.62 + 0.25 * k1_10_1.HitNormal.z + 0.13 * k1_10_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_10_1.Miss {
              let k1_10_2 = Sweep(O1_10 + D1_10 * 198.0, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_10_2.Hit {
                px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_2.HitColor, 0.62 + 0.25 * k1_10_2.HitNormal.z + 0.13 * k1_10_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_10_2.Miss {
                let k1_10_3 = Sweep(O1_10 + D1_10 * 297.0, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_10_3.Hit {
                  px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_3.HitColor, 0.62 + 0.25 * k1_10_3.HitNormal.z + 0.13 * k1_10_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_10_3.Miss {
                  let k1_10_4 = Sweep(O1_10 + D1_10 * 396.0, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_10_4.Hit {
                    px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_4.HitColor, 0.62 + 0.25 * k1_10_4.HitNormal.z + 0.13 * k1_10_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_10_4.Miss {
                    let k1_10_5 = Sweep(O1_10 + D1_10 * 495.0, D1_10, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_10_5.Hit {
                      px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_5.HitColor, 0.62 + 0.25 * k1_10_5.HitNormal.z + 0.13 * k1_10_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_10_5.Miss {
                      px[10] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_10.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_11 = Normalize(SC + SR * 10.5 + SU * yo1 - E)
          let D1_11 = Normalize(DN * (0.0 - Dot(d1_11, SN)) - DR * Dot(d1_11, SR) + DU * Dot(d1_11, SU))
          let O1_11 = DC - DR * 10.5 + DU * yo1 + DN * 2.0
          let k1_11_0 = Sweep(O1_11, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_11_0.Hit {
            px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_0.HitColor, 0.62 + 0.25 * k1_11_0.HitNormal.z + 0.13 * k1_11_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_11_0.Miss {
            let k1_11_1 = Sweep(O1_11 + D1_11 * 99.0, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_11_1.Hit {
              px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_1.HitColor, 0.62 + 0.25 * k1_11_1.HitNormal.z + 0.13 * k1_11_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_11_1.Miss {
              let k1_11_2 = Sweep(O1_11 + D1_11 * 198.0, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_11_2.Hit {
                px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_2.HitColor, 0.62 + 0.25 * k1_11_2.HitNormal.z + 0.13 * k1_11_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_11_2.Miss {
                let k1_11_3 = Sweep(O1_11 + D1_11 * 297.0, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_11_3.Hit {
                  px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_3.HitColor, 0.62 + 0.25 * k1_11_3.HitNormal.z + 0.13 * k1_11_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_11_3.Miss {
                  let k1_11_4 = Sweep(O1_11 + D1_11 * 396.0, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_11_4.Hit {
                    px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_4.HitColor, 0.62 + 0.25 * k1_11_4.HitNormal.z + 0.13 * k1_11_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_11_4.Miss {
                    let k1_11_5 = Sweep(O1_11 + D1_11 * 495.0, D1_11, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_11_5.Hit {
                      px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_5.HitColor, 0.62 + 0.25 * k1_11_5.HitNormal.z + 0.13 * k1_11_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_11_5.Miss {
                      px[11] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_11.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_12 = Normalize(SC + SR * 13.5 + SU * yo1 - E)
          let D1_12 = Normalize(DN * (0.0 - Dot(d1_12, SN)) - DR * Dot(d1_12, SR) + DU * Dot(d1_12, SU))
          let O1_12 = DC - DR * 13.5 + DU * yo1 + DN * 2.0
          let k1_12_0 = Sweep(O1_12, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_12_0.Hit {
            px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_0.HitColor, 0.62 + 0.25 * k1_12_0.HitNormal.z + 0.13 * k1_12_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_12_0.Miss {
            let k1_12_1 = Sweep(O1_12 + D1_12 * 99.0, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_12_1.Hit {
              px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_1.HitColor, 0.62 + 0.25 * k1_12_1.HitNormal.z + 0.13 * k1_12_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_12_1.Miss {
              let k1_12_2 = Sweep(O1_12 + D1_12 * 198.0, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_12_2.Hit {
                px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_2.HitColor, 0.62 + 0.25 * k1_12_2.HitNormal.z + 0.13 * k1_12_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_12_2.Miss {
                let k1_12_3 = Sweep(O1_12 + D1_12 * 297.0, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_12_3.Hit {
                  px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_3.HitColor, 0.62 + 0.25 * k1_12_3.HitNormal.z + 0.13 * k1_12_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_12_3.Miss {
                  let k1_12_4 = Sweep(O1_12 + D1_12 * 396.0, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_12_4.Hit {
                    px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_4.HitColor, 0.62 + 0.25 * k1_12_4.HitNormal.z + 0.13 * k1_12_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_12_4.Miss {
                    let k1_12_5 = Sweep(O1_12 + D1_12 * 495.0, D1_12, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_12_5.Hit {
                      px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_5.HitColor, 0.62 + 0.25 * k1_12_5.HitNormal.z + 0.13 * k1_12_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_12_5.Miss {
                      px[12] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_12.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_13 = Normalize(SC + SR * 16.5 + SU * yo1 - E)
          let D1_13 = Normalize(DN * (0.0 - Dot(d1_13, SN)) - DR * Dot(d1_13, SR) + DU * Dot(d1_13, SU))
          let O1_13 = DC - DR * 16.5 + DU * yo1 + DN * 2.0
          let k1_13_0 = Sweep(O1_13, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_13_0.Hit {
            px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_0.HitColor, 0.62 + 0.25 * k1_13_0.HitNormal.z + 0.13 * k1_13_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_13_0.Miss {
            let k1_13_1 = Sweep(O1_13 + D1_13 * 99.0, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_13_1.Hit {
              px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_1.HitColor, 0.62 + 0.25 * k1_13_1.HitNormal.z + 0.13 * k1_13_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_13_1.Miss {
              let k1_13_2 = Sweep(O1_13 + D1_13 * 198.0, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_13_2.Hit {
                px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_2.HitColor, 0.62 + 0.25 * k1_13_2.HitNormal.z + 0.13 * k1_13_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_13_2.Miss {
                let k1_13_3 = Sweep(O1_13 + D1_13 * 297.0, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_13_3.Hit {
                  px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_3.HitColor, 0.62 + 0.25 * k1_13_3.HitNormal.z + 0.13 * k1_13_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_13_3.Miss {
                  let k1_13_4 = Sweep(O1_13 + D1_13 * 396.0, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_13_4.Hit {
                    px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_4.HitColor, 0.62 + 0.25 * k1_13_4.HitNormal.z + 0.13 * k1_13_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_13_4.Miss {
                    let k1_13_5 = Sweep(O1_13 + D1_13 * 495.0, D1_13, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_13_5.Hit {
                      px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_5.HitColor, 0.62 + 0.25 * k1_13_5.HitNormal.z + 0.13 * k1_13_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_13_5.Miss {
                      px[13] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_13.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_14 = Normalize(SC + SR * 19.5 + SU * yo1 - E)
          let D1_14 = Normalize(DN * (0.0 - Dot(d1_14, SN)) - DR * Dot(d1_14, SR) + DU * Dot(d1_14, SU))
          let O1_14 = DC - DR * 19.5 + DU * yo1 + DN * 2.0
          let k1_14_0 = Sweep(O1_14, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_14_0.Hit {
            px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_0.HitColor, 0.62 + 0.25 * k1_14_0.HitNormal.z + 0.13 * k1_14_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_14_0.Miss {
            let k1_14_1 = Sweep(O1_14 + D1_14 * 99.0, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_14_1.Hit {
              px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_1.HitColor, 0.62 + 0.25 * k1_14_1.HitNormal.z + 0.13 * k1_14_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_14_1.Miss {
              let k1_14_2 = Sweep(O1_14 + D1_14 * 198.0, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_14_2.Hit {
                px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_2.HitColor, 0.62 + 0.25 * k1_14_2.HitNormal.z + 0.13 * k1_14_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_14_2.Miss {
                let k1_14_3 = Sweep(O1_14 + D1_14 * 297.0, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_14_3.Hit {
                  px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_3.HitColor, 0.62 + 0.25 * k1_14_3.HitNormal.z + 0.13 * k1_14_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_14_3.Miss {
                  let k1_14_4 = Sweep(O1_14 + D1_14 * 396.0, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_14_4.Hit {
                    px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_4.HitColor, 0.62 + 0.25 * k1_14_4.HitNormal.z + 0.13 * k1_14_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_14_4.Miss {
                    let k1_14_5 = Sweep(O1_14 + D1_14 * 495.0, D1_14, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_14_5.Hit {
                      px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_5.HitColor, 0.62 + 0.25 * k1_14_5.HitNormal.z + 0.13 * k1_14_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_14_5.Miss {
                      px[14] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_14.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let d1_15 = Normalize(SC + SR * 22.5 + SU * yo1 - E)
          let D1_15 = Normalize(DN * (0.0 - Dot(d1_15, SN)) - DR * Dot(d1_15, SR) + DU * Dot(d1_15, SU))
          let O1_15 = DC - DR * 22.5 + DU * yo1 + DN * 2.0
          let k1_15_0 = Sweep(O1_15, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
          on k1_15_0.Hit {
            px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_0.HitColor, 0.62 + 0.25 * k1_15_0.HitNormal.z + 0.13 * k1_15_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_0.HitDistance + 0.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_15_0.Miss {
            let k1_15_1 = Sweep(O1_15 + D1_15 * 99.0, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
            on k1_15_1.Hit {
              px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_1.HitColor, 0.62 + 0.25 * k1_15_1.HitNormal.z + 0.13 * k1_15_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_1.HitDistance + 99.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_15_1.Miss {
              let k1_15_2 = Sweep(O1_15 + D1_15 * 198.0, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
              on k1_15_2.Hit {
                px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_2.HitColor, 0.62 + 0.25 * k1_15_2.HitNormal.z + 0.13 * k1_15_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_2.HitDistance + 198.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_15_2.Miss {
                let k1_15_3 = Sweep(O1_15 + D1_15 * 297.0, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                on k1_15_3.Hit {
                  px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_3.HitColor, 0.62 + 0.25 * k1_15_3.HitNormal.z + 0.13 * k1_15_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_3.HitDistance + 297.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_15_3.Miss {
                  let k1_15_4 = Sweep(O1_15 + D1_15 * 396.0, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                  on k1_15_4.Hit {
                    px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_4.HitColor, 0.62 + 0.25 * k1_15_4.HitNormal.z + 0.13 * k1_15_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_4.HitDistance + 396.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_15_4.Miss {
                    let k1_15_5 = Sweep(O1_15 + D1_15 * 495.0, D1_15, 100.0, detectBricks = true, detectMap = true, ignoreOwningGrid = false, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true)
                    on k1_15_5.Hit {
                      px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_5.HitColor, 0.62 + 0.25 * k1_15_5.HitNormal.z + 0.13 * k1_15_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_5.HitDistance + 495.0) / 700.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                    }
                    on k1_15_5.Miss {
                      px[15] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(D1_15.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                    }
                  }
                }
              }
            }
          }
          let row1 = rowStr()
          let sc = if sd == 0 then pe0 else pe1
          if dbg && rw == 6 {
            PrintToConsole(Fmt("pg|row|{A}|{B:.0}|{C:.0}|{D:.0}|{E}", sd, E.x, E.y, E.z, row0))
          }
          SendGlobalCustomEvent("pv", rw, row0 .. "\n" .. row1, target = sc)
          rr = if rw + 1 >= 13 then 0 else rw + 1
          side = if rw + 1 >= 13 then 1 - sd else sd
        }
      }
    }
  }
}
