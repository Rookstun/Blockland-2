// rope.ws -- one per player holding a grapple gun (faik + Penta 2026-11-03: "grapple hook gun ... realistic
// swing physics, bounds, elasticity ... sliders for elasticity and rope length"). grapple.ws spawns it 8000 up
// and sends rope.init. Firing the gun (LMB) throws the hook (chained sweeps along the shot); firing again, RMB,
// putting the gun away or dying lets go. While hooked the rope is a one-sided spring-damper on the player
// (AddVelocity): it only pulls when stretched past its rest length, so you swing, fall slack and bounce.
// Elasticity e 0..1: rope stiffness K_STIFF..K_SOFT, and how much outward speed the rope eats (rigid = all).
// The rope is drawn as BEADS frozen micro-brick grids from the hand to the hook, sagging when slack.
// Every var is read once at the top of the tick and written last (a Var read after its Set is stale).
// build.mjs fills the BEAD_* markers.

@invisible

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
var hv: vector[] = [Vec(0.0, 0.0, 0.0)]
var hk: int[] = [0]
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
  if ready && s != serial && uid == who.GetUserId() {
    ready = false
    die()
  }
}

// the hook = firing the gun: with a gun out, left click fires it and never sets PressedLeftMouse (2026-11-03).
// A Sweep reaches at most 100 units: the throw is chained sweeps (build.mjs fills HOOK_CHAIN), first hit in hv/hk.
on CharacterFiredWeapon() -> (shooter, direction, start, weapon, weaponName) {
  if ready && weapon == $BRItemBase/Weapon_Pistol && shooter.ControllerOf().GetUserId() == who.GetUserId() {
    if hooked {
      hooked = false
      park()
      shooter.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_2_Release)
    } else {
      let ad = Normalize(direction)
      hk[0] = 0
      let h0 = Sweep(start, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
      on h0.Hit {
        hv[0] = h0.HitLocation
        hk[0] = 1
      }
      on h0.Miss {
        let h1 = Sweep(start + ad * 99.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
        on h1.Hit {
          hv[0] = h1.HitLocation
          hk[0] = 1
        }
        on h1.Miss {
          let h2 = Sweep(start + ad * 198.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
          on h2.Hit {
            hv[0] = h2.HitLocation
            hk[0] = 1
          }
          on h2.Miss {
            let h3 = Sweep(start + ad * 297.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
            on h3.Hit {
              hv[0] = h3.HitLocation
              hk[0] = 1
            }
            on h3.Miss {
              let h4 = Sweep(start + ad * 396.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
              on h4.Hit {
                hv[0] = h4.HitLocation
                hk[0] = 1
              }
              on h4.Miss {
                let h5 = Sweep(start + ad * 495.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                on h5.Hit {
                  hv[0] = h5.HitLocation
                  hk[0] = 1
                }
                on h5.Miss {
                  let h6 = Sweep(start + ad * 594.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                  on h6.Hit {
                    hv[0] = h6.HitLocation
                    hk[0] = 1
                  }
                  on h6.Miss {
                    let h7 = Sweep(start + ad * 693.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                    on h7.Hit {
                      hv[0] = h7.HitLocation
                      hk[0] = 1
                    }
                    on h7.Miss {
                      let h8 = Sweep(start + ad * 792.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                      on h8.Hit {
                        hv[0] = h8.HitLocation
                        hk[0] = 1
                      }
                      on h8.Miss {
                        let h9 = Sweep(start + ad * 891.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                        on h9.Hit {
                          hv[0] = h9.HitLocation
                          hk[0] = 1
                        }
                        on h9.Miss {
                          let h10 = Sweep(start + ad * 990.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                          on h10.Hit {
                            hv[0] = h10.HitLocation
                            hk[0] = 1
                          }
                          on h10.Miss {
                            let h11 = Sweep(start + ad * 1089.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                            on h11.Hit {
                              hv[0] = h11.HitLocation
                              hk[0] = 1
                            }
                            on h11.Miss {
                              let h12 = Sweep(start + ad * 1188.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                              on h12.Hit {
                                hv[0] = h12.HitLocation
                                hk[0] = 1
                              }
                              on h12.Miss {
                                let h13 = Sweep(start + ad * 1287.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                on h13.Hit {
                                  hv[0] = h13.HitLocation
                                  hk[0] = 1
                                }
                                on h13.Miss {
                                  let h14 = Sweep(start + ad * 1386.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                  on h14.Hit {
                                    hv[0] = h14.HitLocation
                                    hk[0] = 1
                                  }
                                  on h14.Miss {
                                    let h15 = Sweep(start + ad * 1485.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                    on h15.Hit {
                                      hv[0] = h15.HitLocation
                                      hk[0] = 1
                                    }
                                    on h15.Miss {
                                      let h16 = Sweep(start + ad * 1584.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                      on h16.Hit {
                                        hv[0] = h16.HitLocation
                                        hk[0] = 1
                                      }
                                      on h16.Miss {
                                        let h17 = Sweep(start + ad * 1683.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                        on h17.Hit {
                                          hv[0] = h17.HitLocation
                                          hk[0] = 1
                                        }
                                        on h17.Miss {
                                          let h18 = Sweep(start + ad * 1782.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                          on h18.Hit {
                                            hv[0] = h18.HitLocation
                                            hk[0] = 1
                                          }
                                          on h18.Miss {
                                            let h19 = Sweep(start + ad * 1881.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                            on h19.Hit {
                                              hv[0] = h19.HitLocation
                                              hk[0] = 1
                                            }
                                            on h19.Miss {
                                              let h20 = Sweep(start + ad * 1980.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                              on h20.Hit {
                                                hv[0] = h20.HitLocation
                                                hk[0] = 1
                                              }
                                              on h20.Miss {
                                                let h21 = Sweep(start + ad * 2079.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                on h21.Hit {
                                                  hv[0] = h21.HitLocation
                                                  hk[0] = 1
                                                }
                                                on h21.Miss {
                                                  let h22 = Sweep(start + ad * 2178.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                  on h22.Hit {
                                                    hv[0] = h22.HitLocation
                                                    hk[0] = 1
                                                  }
                                                  on h22.Miss {
                                                    let h23 = Sweep(start + ad * 2277.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                    on h23.Hit {
                                                      hv[0] = h23.HitLocation
                                                      hk[0] = 1
                                                    }
                                                    on h23.Miss {
                                                      let h24 = Sweep(start + ad * 2376.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                      on h24.Hit {
                                                        hv[0] = h24.HitLocation
                                                        hk[0] = 1
                                                      }
                                                      on h24.Miss {
                                                        let h25 = Sweep(start + ad * 2475.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                        on h25.Hit {
                                                          hv[0] = h25.HitLocation
                                                          hk[0] = 1
                                                        }
                                                        on h25.Miss {
                                                          let h26 = Sweep(start + ad * 2574.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                          on h26.Hit {
                                                            hv[0] = h26.HitLocation
                                                            hk[0] = 1
                                                          }
                                                          on h26.Miss {
                                                            let h27 = Sweep(start + ad * 2673.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                            on h27.Hit {
                                                              hv[0] = h27.HitLocation
                                                              hk[0] = 1
                                                            }
                                                            on h27.Miss {
                                                              let h28 = Sweep(start + ad * 2772.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                              on h28.Hit {
                                                                hv[0] = h28.HitLocation
                                                                hk[0] = 1
                                                              }
                                                              on h28.Miss {
                                                                let h29 = Sweep(start + ad * 2871.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                on h29.Hit {
                                                                  hv[0] = h29.HitLocation
                                                                  hk[0] = 1
                                                                }
                                                                on h29.Miss {
                                                                  let h30 = Sweep(start + ad * 2970.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                  on h30.Hit {
                                                                    hv[0] = h30.HitLocation
                                                                    hk[0] = 1
                                                                  }
                                                                  on h30.Miss {
                                                                    let h31 = Sweep(start + ad * 3069.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                    on h31.Hit {
                                                                      hv[0] = h31.HitLocation
                                                                      hk[0] = 1
                                                                    }
                                                                    on h31.Miss {
                                                                      let h32 = Sweep(start + ad * 3168.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                      on h32.Hit {
                                                                        hv[0] = h32.HitLocation
                                                                        hk[0] = 1
                                                                      }
                                                                      on h32.Miss {
                                                                        let h33 = Sweep(start + ad * 3267.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                        on h33.Hit {
                                                                          hv[0] = h33.HitLocation
                                                                          hk[0] = 1
                                                                        }
                                                                        on h33.Miss {
                                                                          let h34 = Sweep(start + ad * 3366.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                          on h34.Hit {
                                                                            hv[0] = h34.HitLocation
                                                                            hk[0] = 1
                                                                          }
                                                                          on h34.Miss {
                                                                            let h35 = Sweep(start + ad * 3465.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                            on h35.Hit {
                                                                              hv[0] = h35.HitLocation
                                                                              hk[0] = 1
                                                                            }
                                                                            on h35.Miss {
                                                                              let h36 = Sweep(start + ad * 3564.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                              on h36.Hit {
                                                                                hv[0] = h36.HitLocation
                                                                                hk[0] = 1
                                                                              }
                                                                              on h36.Miss {
                                                                                let h37 = Sweep(start + ad * 3663.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                                on h37.Hit {
                                                                                  hv[0] = h37.HitLocation
                                                                                  hk[0] = 1
                                                                                }
                                                                                on h37.Miss {
                                                                                  let h38 = Sweep(start + ad * 3762.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                                  on h38.Hit {
                                                                                    hv[0] = h38.HitLocation
                                                                                    hk[0] = 1
                                                                                  }
                                                                                  on h38.Miss {
                                                                                    let h39 = Sweep(start + ad * 3861.0, ad, 100.0, ignore = shooter, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
                                                                                    on h39.Hit {
                                                                                      hv[0] = h39.HitLocation
                                                                                      hk[0] = 1
                                                                                    }
                                                                                    on h39.Miss {
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
        anchor = hv[0]
        rest = max(min(Distance(shooter.GetLocation(), hv[0]), ropeLen), 40.0)
        hooked = true
        shooter.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_1_Press)
      } else {
        who.ShowStatusMessage("The hook sails off into nothing and comes back looking embarrassed.")
      }
    }
  }
}

on ServerUptime() {
  let dt = min(DeltaTime(), 0.1)
  let r0 = ready
  let h0 = hooked
  let a0 = anchor
  let rs0 = rest
  let e0 = elast
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
      if h0 && (!holding || inp.PressedRightMouse) {
        hooked = false
        park()
        ch.PlayAudioAt($BrickOneShotAudioDescriptor/BOSA_Buttons_Button_2_Release)
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
