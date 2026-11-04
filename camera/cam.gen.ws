// cam.ws -- security camera + monitor (owner 2026-11-03: "we are going to make a camera", picked "security cam + monitor").
// The chip sits behind the monitor (world grid). It spawns the camera prop (cam_prop.brz, frozen) and keeps it at the pose;
// every tick it casts 2 rows of the W x H picture from the camera: ray = forward + right*u + up*v, chained 100-unit
// sweeps (a Sweep reaches at most 100 units) over bricks, map and players, HitColor shaded by the hit normal and fogged,
// sky on a miss. Rows -> NS text strips of coloured blocks (2 rows each) wired to the screen. build.mjs fills //@...@.
// /cam here = camera at your eye looking where you look; /cam fov N (20..120); /cam off | on.
// Vars are read once at the top of a tick and written last (a Var read after its Set is stale).

@invisible

const W = 32
const BLK = ["", "█", "██", "███", "████", "█████", "██████", "███████", "████████", "█████████", "██████████", "███████████", "████████████", "█████████████", "██████████████", "███████████████", "████████████████", "█████████████████", "██████████████████", "███████████████████", "████████████████████", "█████████████████████", "██████████████████████", "███████████████████████", "████████████████████████", "█████████████████████████", "██████████████████████████", "███████████████████████████", "████████████████████████████", "█████████████████████████████", "██████████████████████████████", "███████████████████████████████", "████████████████████████████████"]

var live: bool = true
var E: vector = Vec(8040.0, -20150.0, 160.0)
var yaw: float = 90.0
var pitch: float = -15.0
var fov: float = 70.0
var rr: int = 0
var prop: entity
var chk: float = 0.0
var px: string[] = ["000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000", "000000"]
var s0: string = ""
var s1: string = ""
var s2: string = ""
var s3: string = ""
var s4: string = ""
var s5: string = ""
var s6: string = ""
var s7: string = ""
var s8: string = ""

@right out strip0: string = s0
@right out strip1: string = s1
@right out strip2: string = s2
@right out strip3: string = s3
@right out strip4: string = s4
@right out strip5: string = s5
@right out strip6: string = s6
@right out strip7: string = s7
@right out strip8: string = s8

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

on ChatCommand("cam", "Security camera: /cam here | /cam fov N | /cam off | /cam on") -> (ctrl, args) {
  let a = args.Trim().ToLower()
  let sp = a.Split(" ")
  let cmd = if sp.Found then sp.Left else a
  if cmd == "here" {
    let aim = ctrl.CharacterOf().GetAim()
    let d = Normalize(aim.Direction)
    let y = Rad2Deg(atan2(d.y, d.x))
    let p = Rad2Deg(asin(clamp(d.z, -1.0, 1.0)))
    E = aim.Origin
    yaw = y
    pitch = p
    prop.SetLocationRotation(aim.Origin, Rotation(p, y, 0.0))
    ctrl.ShowStatusMessage("The camera is now watching from right where you are. It finds you fascinating. Step aside.")
  } else if cmd == "fov" {
    let f = clamp(ParseNumber(if sp.Found then sp.Right else "70"), 20.0, 120.0)
    fov = f
    ctrl.ShowStatusMessage(Fmt("Field of view: {A:.0} degrees. The camera squints accordingly.", f))
  } else if cmd == "off" {
    live = false
    ctrl.ShowStatusMessage("Camera off. Whatever happens now officially never happened.")
  } else if cmd == "on" {
    live = true
    ctrl.ShowStatusMessage("Camera on. Smile, or at least stop doing that.")
  } else {
    ctrl.ShowStatusMessage("/cam here | /cam fov N | /cam off | /cam on")
  }
}

on ServerUptime() {
  let dt = min(DeltaTime(), 0.1)
  let on0 = live
  let E0 = E
  let y0 = yaw
  let p0 = pitch
  let f0 = fov
  let rw = rr
  let k0 = chk
  // the prop: (re)spawn it whenever it is gone (world reloads drop spawned prefabs; IsFrozen of nothing is false)
  if k0 + dt > 2.0 {
    chk = 0.0
    if !prop.IsFrozen() {
      let e = SpawnPrefab(prefab = $./cam_prop.brz, lifetime = 0.0, limit = 1)
      e.SetFrozen(true)
      e.SetLocationRotation(E0, Rotation(p0, y0, 0.0))
      prop = e
    }
  } else {
    chk = k0 + dt
  }
  if on0 {
    let ya = Deg2Rad(y0)
    let pa = Deg2Rad(p0)
    let F = Vec(cos(pa) * cos(ya), cos(pa) * sin(ya), sin(pa))
    let R = Vec(0.0 - sin(ya), cos(ya), 0.0)
    let U = Vec(0.0 - sin(pa) * cos(ya), 0.0 - sin(pa) * sin(ya), cos(pa))
    let TH = tan(Deg2Rad(f0) * 0.5)
    let TV = TH * 0.562500
    let O = E0 + F * 8.0
    let v0 = TV * (1.0 - (rw * 2.0 + 0.5) * 0.111111)
    let d0_0 = Normalize(F + R * (TH * -0.968750) + U * v0)
    let k0_0_0 = Sweep(O, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_0_0.Hit {
      px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_0.HitColor, 0.62 + 0.25 * k0_0_0.HitNormal.z + 0.13 * k0_0_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_0_0.Miss {
      let k0_0_1 = Sweep(O + d0_0 * 99.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_0_1.Hit {
        px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_1.HitColor, 0.62 + 0.25 * k0_0_1.HitNormal.z + 0.13 * k0_0_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_0_1.Miss {
        let k0_0_2 = Sweep(O + d0_0 * 198.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_0_2.Hit {
          px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_2.HitColor, 0.62 + 0.25 * k0_0_2.HitNormal.z + 0.13 * k0_0_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_0_2.Miss {
          let k0_0_3 = Sweep(O + d0_0 * 297.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_0_3.Hit {
            px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_3.HitColor, 0.62 + 0.25 * k0_0_3.HitNormal.z + 0.13 * k0_0_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_0_3.Miss {
            let k0_0_4 = Sweep(O + d0_0 * 396.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_0_4.Hit {
              px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_4.HitColor, 0.62 + 0.25 * k0_0_4.HitNormal.z + 0.13 * k0_0_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_0_4.Miss {
              let k0_0_5 = Sweep(O + d0_0 * 495.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_0_5.Hit {
                px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_5.HitColor, 0.62 + 0.25 * k0_0_5.HitNormal.z + 0.13 * k0_0_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_0_5.Miss {
                let k0_0_6 = Sweep(O + d0_0 * 594.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_0_6.Hit {
                  px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_6.HitColor, 0.62 + 0.25 * k0_0_6.HitNormal.z + 0.13 * k0_0_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_0_6.Miss {
                  let k0_0_7 = Sweep(O + d0_0 * 693.0, d0_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_0_7.Hit {
                    px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_0_7.HitColor, 0.62 + 0.25 * k0_0_7.HitNormal.z + 0.13 * k0_0_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_0_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_0_7.Miss {
                    px[0] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_0.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_1 = Normalize(F + R * (TH * -0.906250) + U * v0)
    let k0_1_0 = Sweep(O, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_1_0.Hit {
      px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_0.HitColor, 0.62 + 0.25 * k0_1_0.HitNormal.z + 0.13 * k0_1_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_1_0.Miss {
      let k0_1_1 = Sweep(O + d0_1 * 99.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_1_1.Hit {
        px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_1.HitColor, 0.62 + 0.25 * k0_1_1.HitNormal.z + 0.13 * k0_1_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_1_1.Miss {
        let k0_1_2 = Sweep(O + d0_1 * 198.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_1_2.Hit {
          px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_2.HitColor, 0.62 + 0.25 * k0_1_2.HitNormal.z + 0.13 * k0_1_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_1_2.Miss {
          let k0_1_3 = Sweep(O + d0_1 * 297.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_1_3.Hit {
            px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_3.HitColor, 0.62 + 0.25 * k0_1_3.HitNormal.z + 0.13 * k0_1_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_1_3.Miss {
            let k0_1_4 = Sweep(O + d0_1 * 396.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_1_4.Hit {
              px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_4.HitColor, 0.62 + 0.25 * k0_1_4.HitNormal.z + 0.13 * k0_1_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_1_4.Miss {
              let k0_1_5 = Sweep(O + d0_1 * 495.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_1_5.Hit {
                px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_5.HitColor, 0.62 + 0.25 * k0_1_5.HitNormal.z + 0.13 * k0_1_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_1_5.Miss {
                let k0_1_6 = Sweep(O + d0_1 * 594.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_1_6.Hit {
                  px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_6.HitColor, 0.62 + 0.25 * k0_1_6.HitNormal.z + 0.13 * k0_1_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_1_6.Miss {
                  let k0_1_7 = Sweep(O + d0_1 * 693.0, d0_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_1_7.Hit {
                    px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_1_7.HitColor, 0.62 + 0.25 * k0_1_7.HitNormal.z + 0.13 * k0_1_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_1_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_1_7.Miss {
                    px[1] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_1.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_2 = Normalize(F + R * (TH * -0.843750) + U * v0)
    let k0_2_0 = Sweep(O, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_2_0.Hit {
      px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_0.HitColor, 0.62 + 0.25 * k0_2_0.HitNormal.z + 0.13 * k0_2_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_2_0.Miss {
      let k0_2_1 = Sweep(O + d0_2 * 99.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_2_1.Hit {
        px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_1.HitColor, 0.62 + 0.25 * k0_2_1.HitNormal.z + 0.13 * k0_2_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_2_1.Miss {
        let k0_2_2 = Sweep(O + d0_2 * 198.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_2_2.Hit {
          px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_2.HitColor, 0.62 + 0.25 * k0_2_2.HitNormal.z + 0.13 * k0_2_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_2_2.Miss {
          let k0_2_3 = Sweep(O + d0_2 * 297.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_2_3.Hit {
            px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_3.HitColor, 0.62 + 0.25 * k0_2_3.HitNormal.z + 0.13 * k0_2_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_2_3.Miss {
            let k0_2_4 = Sweep(O + d0_2 * 396.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_2_4.Hit {
              px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_4.HitColor, 0.62 + 0.25 * k0_2_4.HitNormal.z + 0.13 * k0_2_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_2_4.Miss {
              let k0_2_5 = Sweep(O + d0_2 * 495.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_2_5.Hit {
                px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_5.HitColor, 0.62 + 0.25 * k0_2_5.HitNormal.z + 0.13 * k0_2_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_2_5.Miss {
                let k0_2_6 = Sweep(O + d0_2 * 594.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_2_6.Hit {
                  px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_6.HitColor, 0.62 + 0.25 * k0_2_6.HitNormal.z + 0.13 * k0_2_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_2_6.Miss {
                  let k0_2_7 = Sweep(O + d0_2 * 693.0, d0_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_2_7.Hit {
                    px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_2_7.HitColor, 0.62 + 0.25 * k0_2_7.HitNormal.z + 0.13 * k0_2_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_2_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_2_7.Miss {
                    px[2] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_2.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_3 = Normalize(F + R * (TH * -0.781250) + U * v0)
    let k0_3_0 = Sweep(O, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_3_0.Hit {
      px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_0.HitColor, 0.62 + 0.25 * k0_3_0.HitNormal.z + 0.13 * k0_3_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_3_0.Miss {
      let k0_3_1 = Sweep(O + d0_3 * 99.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_3_1.Hit {
        px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_1.HitColor, 0.62 + 0.25 * k0_3_1.HitNormal.z + 0.13 * k0_3_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_3_1.Miss {
        let k0_3_2 = Sweep(O + d0_3 * 198.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_3_2.Hit {
          px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_2.HitColor, 0.62 + 0.25 * k0_3_2.HitNormal.z + 0.13 * k0_3_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_3_2.Miss {
          let k0_3_3 = Sweep(O + d0_3 * 297.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_3_3.Hit {
            px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_3.HitColor, 0.62 + 0.25 * k0_3_3.HitNormal.z + 0.13 * k0_3_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_3_3.Miss {
            let k0_3_4 = Sweep(O + d0_3 * 396.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_3_4.Hit {
              px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_4.HitColor, 0.62 + 0.25 * k0_3_4.HitNormal.z + 0.13 * k0_3_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_3_4.Miss {
              let k0_3_5 = Sweep(O + d0_3 * 495.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_3_5.Hit {
                px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_5.HitColor, 0.62 + 0.25 * k0_3_5.HitNormal.z + 0.13 * k0_3_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_3_5.Miss {
                let k0_3_6 = Sweep(O + d0_3 * 594.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_3_6.Hit {
                  px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_6.HitColor, 0.62 + 0.25 * k0_3_6.HitNormal.z + 0.13 * k0_3_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_3_6.Miss {
                  let k0_3_7 = Sweep(O + d0_3 * 693.0, d0_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_3_7.Hit {
                    px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_3_7.HitColor, 0.62 + 0.25 * k0_3_7.HitNormal.z + 0.13 * k0_3_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_3_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_3_7.Miss {
                    px[3] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_3.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_4 = Normalize(F + R * (TH * -0.718750) + U * v0)
    let k0_4_0 = Sweep(O, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_4_0.Hit {
      px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_0.HitColor, 0.62 + 0.25 * k0_4_0.HitNormal.z + 0.13 * k0_4_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_4_0.Miss {
      let k0_4_1 = Sweep(O + d0_4 * 99.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_4_1.Hit {
        px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_1.HitColor, 0.62 + 0.25 * k0_4_1.HitNormal.z + 0.13 * k0_4_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_4_1.Miss {
        let k0_4_2 = Sweep(O + d0_4 * 198.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_4_2.Hit {
          px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_2.HitColor, 0.62 + 0.25 * k0_4_2.HitNormal.z + 0.13 * k0_4_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_4_2.Miss {
          let k0_4_3 = Sweep(O + d0_4 * 297.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_4_3.Hit {
            px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_3.HitColor, 0.62 + 0.25 * k0_4_3.HitNormal.z + 0.13 * k0_4_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_4_3.Miss {
            let k0_4_4 = Sweep(O + d0_4 * 396.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_4_4.Hit {
              px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_4.HitColor, 0.62 + 0.25 * k0_4_4.HitNormal.z + 0.13 * k0_4_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_4_4.Miss {
              let k0_4_5 = Sweep(O + d0_4 * 495.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_4_5.Hit {
                px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_5.HitColor, 0.62 + 0.25 * k0_4_5.HitNormal.z + 0.13 * k0_4_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_4_5.Miss {
                let k0_4_6 = Sweep(O + d0_4 * 594.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_4_6.Hit {
                  px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_6.HitColor, 0.62 + 0.25 * k0_4_6.HitNormal.z + 0.13 * k0_4_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_4_6.Miss {
                  let k0_4_7 = Sweep(O + d0_4 * 693.0, d0_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_4_7.Hit {
                    px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_4_7.HitColor, 0.62 + 0.25 * k0_4_7.HitNormal.z + 0.13 * k0_4_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_4_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_4_7.Miss {
                    px[4] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_4.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_5 = Normalize(F + R * (TH * -0.656250) + U * v0)
    let k0_5_0 = Sweep(O, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_5_0.Hit {
      px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_0.HitColor, 0.62 + 0.25 * k0_5_0.HitNormal.z + 0.13 * k0_5_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_5_0.Miss {
      let k0_5_1 = Sweep(O + d0_5 * 99.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_5_1.Hit {
        px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_1.HitColor, 0.62 + 0.25 * k0_5_1.HitNormal.z + 0.13 * k0_5_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_5_1.Miss {
        let k0_5_2 = Sweep(O + d0_5 * 198.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_5_2.Hit {
          px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_2.HitColor, 0.62 + 0.25 * k0_5_2.HitNormal.z + 0.13 * k0_5_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_5_2.Miss {
          let k0_5_3 = Sweep(O + d0_5 * 297.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_5_3.Hit {
            px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_3.HitColor, 0.62 + 0.25 * k0_5_3.HitNormal.z + 0.13 * k0_5_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_5_3.Miss {
            let k0_5_4 = Sweep(O + d0_5 * 396.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_5_4.Hit {
              px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_4.HitColor, 0.62 + 0.25 * k0_5_4.HitNormal.z + 0.13 * k0_5_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_5_4.Miss {
              let k0_5_5 = Sweep(O + d0_5 * 495.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_5_5.Hit {
                px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_5.HitColor, 0.62 + 0.25 * k0_5_5.HitNormal.z + 0.13 * k0_5_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_5_5.Miss {
                let k0_5_6 = Sweep(O + d0_5 * 594.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_5_6.Hit {
                  px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_6.HitColor, 0.62 + 0.25 * k0_5_6.HitNormal.z + 0.13 * k0_5_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_5_6.Miss {
                  let k0_5_7 = Sweep(O + d0_5 * 693.0, d0_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_5_7.Hit {
                    px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_5_7.HitColor, 0.62 + 0.25 * k0_5_7.HitNormal.z + 0.13 * k0_5_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_5_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_5_7.Miss {
                    px[5] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_5.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_6 = Normalize(F + R * (TH * -0.593750) + U * v0)
    let k0_6_0 = Sweep(O, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_6_0.Hit {
      px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_0.HitColor, 0.62 + 0.25 * k0_6_0.HitNormal.z + 0.13 * k0_6_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_6_0.Miss {
      let k0_6_1 = Sweep(O + d0_6 * 99.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_6_1.Hit {
        px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_1.HitColor, 0.62 + 0.25 * k0_6_1.HitNormal.z + 0.13 * k0_6_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_6_1.Miss {
        let k0_6_2 = Sweep(O + d0_6 * 198.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_6_2.Hit {
          px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_2.HitColor, 0.62 + 0.25 * k0_6_2.HitNormal.z + 0.13 * k0_6_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_6_2.Miss {
          let k0_6_3 = Sweep(O + d0_6 * 297.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_6_3.Hit {
            px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_3.HitColor, 0.62 + 0.25 * k0_6_3.HitNormal.z + 0.13 * k0_6_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_6_3.Miss {
            let k0_6_4 = Sweep(O + d0_6 * 396.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_6_4.Hit {
              px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_4.HitColor, 0.62 + 0.25 * k0_6_4.HitNormal.z + 0.13 * k0_6_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_6_4.Miss {
              let k0_6_5 = Sweep(O + d0_6 * 495.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_6_5.Hit {
                px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_5.HitColor, 0.62 + 0.25 * k0_6_5.HitNormal.z + 0.13 * k0_6_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_6_5.Miss {
                let k0_6_6 = Sweep(O + d0_6 * 594.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_6_6.Hit {
                  px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_6.HitColor, 0.62 + 0.25 * k0_6_6.HitNormal.z + 0.13 * k0_6_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_6_6.Miss {
                  let k0_6_7 = Sweep(O + d0_6 * 693.0, d0_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_6_7.Hit {
                    px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_6_7.HitColor, 0.62 + 0.25 * k0_6_7.HitNormal.z + 0.13 * k0_6_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_6_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_6_7.Miss {
                    px[6] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_6.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_7 = Normalize(F + R * (TH * -0.531250) + U * v0)
    let k0_7_0 = Sweep(O, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_7_0.Hit {
      px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_0.HitColor, 0.62 + 0.25 * k0_7_0.HitNormal.z + 0.13 * k0_7_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_7_0.Miss {
      let k0_7_1 = Sweep(O + d0_7 * 99.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_7_1.Hit {
        px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_1.HitColor, 0.62 + 0.25 * k0_7_1.HitNormal.z + 0.13 * k0_7_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_7_1.Miss {
        let k0_7_2 = Sweep(O + d0_7 * 198.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_7_2.Hit {
          px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_2.HitColor, 0.62 + 0.25 * k0_7_2.HitNormal.z + 0.13 * k0_7_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_7_2.Miss {
          let k0_7_3 = Sweep(O + d0_7 * 297.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_7_3.Hit {
            px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_3.HitColor, 0.62 + 0.25 * k0_7_3.HitNormal.z + 0.13 * k0_7_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_7_3.Miss {
            let k0_7_4 = Sweep(O + d0_7 * 396.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_7_4.Hit {
              px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_4.HitColor, 0.62 + 0.25 * k0_7_4.HitNormal.z + 0.13 * k0_7_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_7_4.Miss {
              let k0_7_5 = Sweep(O + d0_7 * 495.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_7_5.Hit {
                px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_5.HitColor, 0.62 + 0.25 * k0_7_5.HitNormal.z + 0.13 * k0_7_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_7_5.Miss {
                let k0_7_6 = Sweep(O + d0_7 * 594.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_7_6.Hit {
                  px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_6.HitColor, 0.62 + 0.25 * k0_7_6.HitNormal.z + 0.13 * k0_7_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_7_6.Miss {
                  let k0_7_7 = Sweep(O + d0_7 * 693.0, d0_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_7_7.Hit {
                    px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_7_7.HitColor, 0.62 + 0.25 * k0_7_7.HitNormal.z + 0.13 * k0_7_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_7_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_7_7.Miss {
                    px[7] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_7.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_8 = Normalize(F + R * (TH * -0.468750) + U * v0)
    let k0_8_0 = Sweep(O, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_8_0.Hit {
      px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_0.HitColor, 0.62 + 0.25 * k0_8_0.HitNormal.z + 0.13 * k0_8_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_8_0.Miss {
      let k0_8_1 = Sweep(O + d0_8 * 99.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_8_1.Hit {
        px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_1.HitColor, 0.62 + 0.25 * k0_8_1.HitNormal.z + 0.13 * k0_8_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_8_1.Miss {
        let k0_8_2 = Sweep(O + d0_8 * 198.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_8_2.Hit {
          px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_2.HitColor, 0.62 + 0.25 * k0_8_2.HitNormal.z + 0.13 * k0_8_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_8_2.Miss {
          let k0_8_3 = Sweep(O + d0_8 * 297.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_8_3.Hit {
            px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_3.HitColor, 0.62 + 0.25 * k0_8_3.HitNormal.z + 0.13 * k0_8_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_8_3.Miss {
            let k0_8_4 = Sweep(O + d0_8 * 396.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_8_4.Hit {
              px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_4.HitColor, 0.62 + 0.25 * k0_8_4.HitNormal.z + 0.13 * k0_8_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_8_4.Miss {
              let k0_8_5 = Sweep(O + d0_8 * 495.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_8_5.Hit {
                px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_5.HitColor, 0.62 + 0.25 * k0_8_5.HitNormal.z + 0.13 * k0_8_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_8_5.Miss {
                let k0_8_6 = Sweep(O + d0_8 * 594.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_8_6.Hit {
                  px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_6.HitColor, 0.62 + 0.25 * k0_8_6.HitNormal.z + 0.13 * k0_8_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_8_6.Miss {
                  let k0_8_7 = Sweep(O + d0_8 * 693.0, d0_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_8_7.Hit {
                    px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_8_7.HitColor, 0.62 + 0.25 * k0_8_7.HitNormal.z + 0.13 * k0_8_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_8_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_8_7.Miss {
                    px[8] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_8.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_9 = Normalize(F + R * (TH * -0.406250) + U * v0)
    let k0_9_0 = Sweep(O, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_9_0.Hit {
      px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_0.HitColor, 0.62 + 0.25 * k0_9_0.HitNormal.z + 0.13 * k0_9_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_9_0.Miss {
      let k0_9_1 = Sweep(O + d0_9 * 99.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_9_1.Hit {
        px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_1.HitColor, 0.62 + 0.25 * k0_9_1.HitNormal.z + 0.13 * k0_9_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_9_1.Miss {
        let k0_9_2 = Sweep(O + d0_9 * 198.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_9_2.Hit {
          px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_2.HitColor, 0.62 + 0.25 * k0_9_2.HitNormal.z + 0.13 * k0_9_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_9_2.Miss {
          let k0_9_3 = Sweep(O + d0_9 * 297.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_9_3.Hit {
            px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_3.HitColor, 0.62 + 0.25 * k0_9_3.HitNormal.z + 0.13 * k0_9_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_9_3.Miss {
            let k0_9_4 = Sweep(O + d0_9 * 396.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_9_4.Hit {
              px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_4.HitColor, 0.62 + 0.25 * k0_9_4.HitNormal.z + 0.13 * k0_9_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_9_4.Miss {
              let k0_9_5 = Sweep(O + d0_9 * 495.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_9_5.Hit {
                px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_5.HitColor, 0.62 + 0.25 * k0_9_5.HitNormal.z + 0.13 * k0_9_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_9_5.Miss {
                let k0_9_6 = Sweep(O + d0_9 * 594.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_9_6.Hit {
                  px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_6.HitColor, 0.62 + 0.25 * k0_9_6.HitNormal.z + 0.13 * k0_9_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_9_6.Miss {
                  let k0_9_7 = Sweep(O + d0_9 * 693.0, d0_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_9_7.Hit {
                    px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_9_7.HitColor, 0.62 + 0.25 * k0_9_7.HitNormal.z + 0.13 * k0_9_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_9_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_9_7.Miss {
                    px[9] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_9.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_10 = Normalize(F + R * (TH * -0.343750) + U * v0)
    let k0_10_0 = Sweep(O, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_10_0.Hit {
      px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_0.HitColor, 0.62 + 0.25 * k0_10_0.HitNormal.z + 0.13 * k0_10_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_10_0.Miss {
      let k0_10_1 = Sweep(O + d0_10 * 99.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_10_1.Hit {
        px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_1.HitColor, 0.62 + 0.25 * k0_10_1.HitNormal.z + 0.13 * k0_10_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_10_1.Miss {
        let k0_10_2 = Sweep(O + d0_10 * 198.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_10_2.Hit {
          px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_2.HitColor, 0.62 + 0.25 * k0_10_2.HitNormal.z + 0.13 * k0_10_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_10_2.Miss {
          let k0_10_3 = Sweep(O + d0_10 * 297.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_10_3.Hit {
            px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_3.HitColor, 0.62 + 0.25 * k0_10_3.HitNormal.z + 0.13 * k0_10_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_10_3.Miss {
            let k0_10_4 = Sweep(O + d0_10 * 396.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_10_4.Hit {
              px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_4.HitColor, 0.62 + 0.25 * k0_10_4.HitNormal.z + 0.13 * k0_10_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_10_4.Miss {
              let k0_10_5 = Sweep(O + d0_10 * 495.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_10_5.Hit {
                px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_5.HitColor, 0.62 + 0.25 * k0_10_5.HitNormal.z + 0.13 * k0_10_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_10_5.Miss {
                let k0_10_6 = Sweep(O + d0_10 * 594.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_10_6.Hit {
                  px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_6.HitColor, 0.62 + 0.25 * k0_10_6.HitNormal.z + 0.13 * k0_10_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_10_6.Miss {
                  let k0_10_7 = Sweep(O + d0_10 * 693.0, d0_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_10_7.Hit {
                    px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_10_7.HitColor, 0.62 + 0.25 * k0_10_7.HitNormal.z + 0.13 * k0_10_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_10_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_10_7.Miss {
                    px[10] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_10.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_11 = Normalize(F + R * (TH * -0.281250) + U * v0)
    let k0_11_0 = Sweep(O, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_11_0.Hit {
      px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_0.HitColor, 0.62 + 0.25 * k0_11_0.HitNormal.z + 0.13 * k0_11_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_11_0.Miss {
      let k0_11_1 = Sweep(O + d0_11 * 99.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_11_1.Hit {
        px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_1.HitColor, 0.62 + 0.25 * k0_11_1.HitNormal.z + 0.13 * k0_11_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_11_1.Miss {
        let k0_11_2 = Sweep(O + d0_11 * 198.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_11_2.Hit {
          px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_2.HitColor, 0.62 + 0.25 * k0_11_2.HitNormal.z + 0.13 * k0_11_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_11_2.Miss {
          let k0_11_3 = Sweep(O + d0_11 * 297.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_11_3.Hit {
            px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_3.HitColor, 0.62 + 0.25 * k0_11_3.HitNormal.z + 0.13 * k0_11_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_11_3.Miss {
            let k0_11_4 = Sweep(O + d0_11 * 396.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_11_4.Hit {
              px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_4.HitColor, 0.62 + 0.25 * k0_11_4.HitNormal.z + 0.13 * k0_11_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_11_4.Miss {
              let k0_11_5 = Sweep(O + d0_11 * 495.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_11_5.Hit {
                px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_5.HitColor, 0.62 + 0.25 * k0_11_5.HitNormal.z + 0.13 * k0_11_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_11_5.Miss {
                let k0_11_6 = Sweep(O + d0_11 * 594.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_11_6.Hit {
                  px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_6.HitColor, 0.62 + 0.25 * k0_11_6.HitNormal.z + 0.13 * k0_11_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_11_6.Miss {
                  let k0_11_7 = Sweep(O + d0_11 * 693.0, d0_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_11_7.Hit {
                    px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_11_7.HitColor, 0.62 + 0.25 * k0_11_7.HitNormal.z + 0.13 * k0_11_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_11_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_11_7.Miss {
                    px[11] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_11.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_12 = Normalize(F + R * (TH * -0.218750) + U * v0)
    let k0_12_0 = Sweep(O, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_12_0.Hit {
      px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_0.HitColor, 0.62 + 0.25 * k0_12_0.HitNormal.z + 0.13 * k0_12_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_12_0.Miss {
      let k0_12_1 = Sweep(O + d0_12 * 99.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_12_1.Hit {
        px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_1.HitColor, 0.62 + 0.25 * k0_12_1.HitNormal.z + 0.13 * k0_12_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_12_1.Miss {
        let k0_12_2 = Sweep(O + d0_12 * 198.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_12_2.Hit {
          px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_2.HitColor, 0.62 + 0.25 * k0_12_2.HitNormal.z + 0.13 * k0_12_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_12_2.Miss {
          let k0_12_3 = Sweep(O + d0_12 * 297.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_12_3.Hit {
            px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_3.HitColor, 0.62 + 0.25 * k0_12_3.HitNormal.z + 0.13 * k0_12_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_12_3.Miss {
            let k0_12_4 = Sweep(O + d0_12 * 396.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_12_4.Hit {
              px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_4.HitColor, 0.62 + 0.25 * k0_12_4.HitNormal.z + 0.13 * k0_12_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_12_4.Miss {
              let k0_12_5 = Sweep(O + d0_12 * 495.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_12_5.Hit {
                px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_5.HitColor, 0.62 + 0.25 * k0_12_5.HitNormal.z + 0.13 * k0_12_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_12_5.Miss {
                let k0_12_6 = Sweep(O + d0_12 * 594.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_12_6.Hit {
                  px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_6.HitColor, 0.62 + 0.25 * k0_12_6.HitNormal.z + 0.13 * k0_12_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_12_6.Miss {
                  let k0_12_7 = Sweep(O + d0_12 * 693.0, d0_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_12_7.Hit {
                    px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_12_7.HitColor, 0.62 + 0.25 * k0_12_7.HitNormal.z + 0.13 * k0_12_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_12_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_12_7.Miss {
                    px[12] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_12.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_13 = Normalize(F + R * (TH * -0.156250) + U * v0)
    let k0_13_0 = Sweep(O, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_13_0.Hit {
      px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_0.HitColor, 0.62 + 0.25 * k0_13_0.HitNormal.z + 0.13 * k0_13_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_13_0.Miss {
      let k0_13_1 = Sweep(O + d0_13 * 99.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_13_1.Hit {
        px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_1.HitColor, 0.62 + 0.25 * k0_13_1.HitNormal.z + 0.13 * k0_13_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_13_1.Miss {
        let k0_13_2 = Sweep(O + d0_13 * 198.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_13_2.Hit {
          px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_2.HitColor, 0.62 + 0.25 * k0_13_2.HitNormal.z + 0.13 * k0_13_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_13_2.Miss {
          let k0_13_3 = Sweep(O + d0_13 * 297.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_13_3.Hit {
            px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_3.HitColor, 0.62 + 0.25 * k0_13_3.HitNormal.z + 0.13 * k0_13_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_13_3.Miss {
            let k0_13_4 = Sweep(O + d0_13 * 396.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_13_4.Hit {
              px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_4.HitColor, 0.62 + 0.25 * k0_13_4.HitNormal.z + 0.13 * k0_13_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_13_4.Miss {
              let k0_13_5 = Sweep(O + d0_13 * 495.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_13_5.Hit {
                px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_5.HitColor, 0.62 + 0.25 * k0_13_5.HitNormal.z + 0.13 * k0_13_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_13_5.Miss {
                let k0_13_6 = Sweep(O + d0_13 * 594.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_13_6.Hit {
                  px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_6.HitColor, 0.62 + 0.25 * k0_13_6.HitNormal.z + 0.13 * k0_13_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_13_6.Miss {
                  let k0_13_7 = Sweep(O + d0_13 * 693.0, d0_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_13_7.Hit {
                    px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_13_7.HitColor, 0.62 + 0.25 * k0_13_7.HitNormal.z + 0.13 * k0_13_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_13_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_13_7.Miss {
                    px[13] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_13.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_14 = Normalize(F + R * (TH * -0.093750) + U * v0)
    let k0_14_0 = Sweep(O, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_14_0.Hit {
      px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_0.HitColor, 0.62 + 0.25 * k0_14_0.HitNormal.z + 0.13 * k0_14_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_14_0.Miss {
      let k0_14_1 = Sweep(O + d0_14 * 99.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_14_1.Hit {
        px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_1.HitColor, 0.62 + 0.25 * k0_14_1.HitNormal.z + 0.13 * k0_14_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_14_1.Miss {
        let k0_14_2 = Sweep(O + d0_14 * 198.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_14_2.Hit {
          px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_2.HitColor, 0.62 + 0.25 * k0_14_2.HitNormal.z + 0.13 * k0_14_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_14_2.Miss {
          let k0_14_3 = Sweep(O + d0_14 * 297.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_14_3.Hit {
            px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_3.HitColor, 0.62 + 0.25 * k0_14_3.HitNormal.z + 0.13 * k0_14_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_14_3.Miss {
            let k0_14_4 = Sweep(O + d0_14 * 396.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_14_4.Hit {
              px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_4.HitColor, 0.62 + 0.25 * k0_14_4.HitNormal.z + 0.13 * k0_14_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_14_4.Miss {
              let k0_14_5 = Sweep(O + d0_14 * 495.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_14_5.Hit {
                px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_5.HitColor, 0.62 + 0.25 * k0_14_5.HitNormal.z + 0.13 * k0_14_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_14_5.Miss {
                let k0_14_6 = Sweep(O + d0_14 * 594.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_14_6.Hit {
                  px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_6.HitColor, 0.62 + 0.25 * k0_14_6.HitNormal.z + 0.13 * k0_14_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_14_6.Miss {
                  let k0_14_7 = Sweep(O + d0_14 * 693.0, d0_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_14_7.Hit {
                    px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_14_7.HitColor, 0.62 + 0.25 * k0_14_7.HitNormal.z + 0.13 * k0_14_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_14_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_14_7.Miss {
                    px[14] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_14.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_15 = Normalize(F + R * (TH * -0.031250) + U * v0)
    let k0_15_0 = Sweep(O, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_15_0.Hit {
      px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_0.HitColor, 0.62 + 0.25 * k0_15_0.HitNormal.z + 0.13 * k0_15_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_15_0.Miss {
      let k0_15_1 = Sweep(O + d0_15 * 99.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_15_1.Hit {
        px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_1.HitColor, 0.62 + 0.25 * k0_15_1.HitNormal.z + 0.13 * k0_15_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_15_1.Miss {
        let k0_15_2 = Sweep(O + d0_15 * 198.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_15_2.Hit {
          px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_2.HitColor, 0.62 + 0.25 * k0_15_2.HitNormal.z + 0.13 * k0_15_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_15_2.Miss {
          let k0_15_3 = Sweep(O + d0_15 * 297.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_15_3.Hit {
            px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_3.HitColor, 0.62 + 0.25 * k0_15_3.HitNormal.z + 0.13 * k0_15_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_15_3.Miss {
            let k0_15_4 = Sweep(O + d0_15 * 396.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_15_4.Hit {
              px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_4.HitColor, 0.62 + 0.25 * k0_15_4.HitNormal.z + 0.13 * k0_15_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_15_4.Miss {
              let k0_15_5 = Sweep(O + d0_15 * 495.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_15_5.Hit {
                px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_5.HitColor, 0.62 + 0.25 * k0_15_5.HitNormal.z + 0.13 * k0_15_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_15_5.Miss {
                let k0_15_6 = Sweep(O + d0_15 * 594.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_15_6.Hit {
                  px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_6.HitColor, 0.62 + 0.25 * k0_15_6.HitNormal.z + 0.13 * k0_15_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_15_6.Miss {
                  let k0_15_7 = Sweep(O + d0_15 * 693.0, d0_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_15_7.Hit {
                    px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_15_7.HitColor, 0.62 + 0.25 * k0_15_7.HitNormal.z + 0.13 * k0_15_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_15_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_15_7.Miss {
                    px[15] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_15.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_16 = Normalize(F + R * (TH * 0.031250) + U * v0)
    let k0_16_0 = Sweep(O, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_16_0.Hit {
      px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_0.HitColor, 0.62 + 0.25 * k0_16_0.HitNormal.z + 0.13 * k0_16_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_16_0.Miss {
      let k0_16_1 = Sweep(O + d0_16 * 99.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_16_1.Hit {
        px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_1.HitColor, 0.62 + 0.25 * k0_16_1.HitNormal.z + 0.13 * k0_16_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_16_1.Miss {
        let k0_16_2 = Sweep(O + d0_16 * 198.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_16_2.Hit {
          px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_2.HitColor, 0.62 + 0.25 * k0_16_2.HitNormal.z + 0.13 * k0_16_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_16_2.Miss {
          let k0_16_3 = Sweep(O + d0_16 * 297.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_16_3.Hit {
            px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_3.HitColor, 0.62 + 0.25 * k0_16_3.HitNormal.z + 0.13 * k0_16_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_16_3.Miss {
            let k0_16_4 = Sweep(O + d0_16 * 396.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_16_4.Hit {
              px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_4.HitColor, 0.62 + 0.25 * k0_16_4.HitNormal.z + 0.13 * k0_16_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_16_4.Miss {
              let k0_16_5 = Sweep(O + d0_16 * 495.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_16_5.Hit {
                px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_5.HitColor, 0.62 + 0.25 * k0_16_5.HitNormal.z + 0.13 * k0_16_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_16_5.Miss {
                let k0_16_6 = Sweep(O + d0_16 * 594.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_16_6.Hit {
                  px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_6.HitColor, 0.62 + 0.25 * k0_16_6.HitNormal.z + 0.13 * k0_16_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_16_6.Miss {
                  let k0_16_7 = Sweep(O + d0_16 * 693.0, d0_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_16_7.Hit {
                    px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_16_7.HitColor, 0.62 + 0.25 * k0_16_7.HitNormal.z + 0.13 * k0_16_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_16_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_16_7.Miss {
                    px[16] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_16.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_17 = Normalize(F + R * (TH * 0.093750) + U * v0)
    let k0_17_0 = Sweep(O, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_17_0.Hit {
      px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_0.HitColor, 0.62 + 0.25 * k0_17_0.HitNormal.z + 0.13 * k0_17_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_17_0.Miss {
      let k0_17_1 = Sweep(O + d0_17 * 99.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_17_1.Hit {
        px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_1.HitColor, 0.62 + 0.25 * k0_17_1.HitNormal.z + 0.13 * k0_17_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_17_1.Miss {
        let k0_17_2 = Sweep(O + d0_17 * 198.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_17_2.Hit {
          px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_2.HitColor, 0.62 + 0.25 * k0_17_2.HitNormal.z + 0.13 * k0_17_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_17_2.Miss {
          let k0_17_3 = Sweep(O + d0_17 * 297.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_17_3.Hit {
            px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_3.HitColor, 0.62 + 0.25 * k0_17_3.HitNormal.z + 0.13 * k0_17_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_17_3.Miss {
            let k0_17_4 = Sweep(O + d0_17 * 396.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_17_4.Hit {
              px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_4.HitColor, 0.62 + 0.25 * k0_17_4.HitNormal.z + 0.13 * k0_17_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_17_4.Miss {
              let k0_17_5 = Sweep(O + d0_17 * 495.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_17_5.Hit {
                px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_5.HitColor, 0.62 + 0.25 * k0_17_5.HitNormal.z + 0.13 * k0_17_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_17_5.Miss {
                let k0_17_6 = Sweep(O + d0_17 * 594.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_17_6.Hit {
                  px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_6.HitColor, 0.62 + 0.25 * k0_17_6.HitNormal.z + 0.13 * k0_17_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_17_6.Miss {
                  let k0_17_7 = Sweep(O + d0_17 * 693.0, d0_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_17_7.Hit {
                    px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_17_7.HitColor, 0.62 + 0.25 * k0_17_7.HitNormal.z + 0.13 * k0_17_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_17_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_17_7.Miss {
                    px[17] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_17.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_18 = Normalize(F + R * (TH * 0.156250) + U * v0)
    let k0_18_0 = Sweep(O, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_18_0.Hit {
      px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_0.HitColor, 0.62 + 0.25 * k0_18_0.HitNormal.z + 0.13 * k0_18_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_18_0.Miss {
      let k0_18_1 = Sweep(O + d0_18 * 99.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_18_1.Hit {
        px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_1.HitColor, 0.62 + 0.25 * k0_18_1.HitNormal.z + 0.13 * k0_18_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_18_1.Miss {
        let k0_18_2 = Sweep(O + d0_18 * 198.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_18_2.Hit {
          px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_2.HitColor, 0.62 + 0.25 * k0_18_2.HitNormal.z + 0.13 * k0_18_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_18_2.Miss {
          let k0_18_3 = Sweep(O + d0_18 * 297.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_18_3.Hit {
            px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_3.HitColor, 0.62 + 0.25 * k0_18_3.HitNormal.z + 0.13 * k0_18_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_18_3.Miss {
            let k0_18_4 = Sweep(O + d0_18 * 396.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_18_4.Hit {
              px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_4.HitColor, 0.62 + 0.25 * k0_18_4.HitNormal.z + 0.13 * k0_18_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_18_4.Miss {
              let k0_18_5 = Sweep(O + d0_18 * 495.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_18_5.Hit {
                px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_5.HitColor, 0.62 + 0.25 * k0_18_5.HitNormal.z + 0.13 * k0_18_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_18_5.Miss {
                let k0_18_6 = Sweep(O + d0_18 * 594.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_18_6.Hit {
                  px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_6.HitColor, 0.62 + 0.25 * k0_18_6.HitNormal.z + 0.13 * k0_18_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_18_6.Miss {
                  let k0_18_7 = Sweep(O + d0_18 * 693.0, d0_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_18_7.Hit {
                    px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_18_7.HitColor, 0.62 + 0.25 * k0_18_7.HitNormal.z + 0.13 * k0_18_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_18_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_18_7.Miss {
                    px[18] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_18.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_19 = Normalize(F + R * (TH * 0.218750) + U * v0)
    let k0_19_0 = Sweep(O, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_19_0.Hit {
      px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_0.HitColor, 0.62 + 0.25 * k0_19_0.HitNormal.z + 0.13 * k0_19_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_19_0.Miss {
      let k0_19_1 = Sweep(O + d0_19 * 99.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_19_1.Hit {
        px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_1.HitColor, 0.62 + 0.25 * k0_19_1.HitNormal.z + 0.13 * k0_19_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_19_1.Miss {
        let k0_19_2 = Sweep(O + d0_19 * 198.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_19_2.Hit {
          px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_2.HitColor, 0.62 + 0.25 * k0_19_2.HitNormal.z + 0.13 * k0_19_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_19_2.Miss {
          let k0_19_3 = Sweep(O + d0_19 * 297.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_19_3.Hit {
            px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_3.HitColor, 0.62 + 0.25 * k0_19_3.HitNormal.z + 0.13 * k0_19_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_19_3.Miss {
            let k0_19_4 = Sweep(O + d0_19 * 396.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_19_4.Hit {
              px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_4.HitColor, 0.62 + 0.25 * k0_19_4.HitNormal.z + 0.13 * k0_19_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_19_4.Miss {
              let k0_19_5 = Sweep(O + d0_19 * 495.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_19_5.Hit {
                px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_5.HitColor, 0.62 + 0.25 * k0_19_5.HitNormal.z + 0.13 * k0_19_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_19_5.Miss {
                let k0_19_6 = Sweep(O + d0_19 * 594.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_19_6.Hit {
                  px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_6.HitColor, 0.62 + 0.25 * k0_19_6.HitNormal.z + 0.13 * k0_19_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_19_6.Miss {
                  let k0_19_7 = Sweep(O + d0_19 * 693.0, d0_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_19_7.Hit {
                    px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_19_7.HitColor, 0.62 + 0.25 * k0_19_7.HitNormal.z + 0.13 * k0_19_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_19_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_19_7.Miss {
                    px[19] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_19.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_20 = Normalize(F + R * (TH * 0.281250) + U * v0)
    let k0_20_0 = Sweep(O, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_20_0.Hit {
      px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_0.HitColor, 0.62 + 0.25 * k0_20_0.HitNormal.z + 0.13 * k0_20_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_20_0.Miss {
      let k0_20_1 = Sweep(O + d0_20 * 99.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_20_1.Hit {
        px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_1.HitColor, 0.62 + 0.25 * k0_20_1.HitNormal.z + 0.13 * k0_20_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_20_1.Miss {
        let k0_20_2 = Sweep(O + d0_20 * 198.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_20_2.Hit {
          px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_2.HitColor, 0.62 + 0.25 * k0_20_2.HitNormal.z + 0.13 * k0_20_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_20_2.Miss {
          let k0_20_3 = Sweep(O + d0_20 * 297.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_20_3.Hit {
            px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_3.HitColor, 0.62 + 0.25 * k0_20_3.HitNormal.z + 0.13 * k0_20_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_20_3.Miss {
            let k0_20_4 = Sweep(O + d0_20 * 396.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_20_4.Hit {
              px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_4.HitColor, 0.62 + 0.25 * k0_20_4.HitNormal.z + 0.13 * k0_20_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_20_4.Miss {
              let k0_20_5 = Sweep(O + d0_20 * 495.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_20_5.Hit {
                px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_5.HitColor, 0.62 + 0.25 * k0_20_5.HitNormal.z + 0.13 * k0_20_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_20_5.Miss {
                let k0_20_6 = Sweep(O + d0_20 * 594.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_20_6.Hit {
                  px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_6.HitColor, 0.62 + 0.25 * k0_20_6.HitNormal.z + 0.13 * k0_20_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_20_6.Miss {
                  let k0_20_7 = Sweep(O + d0_20 * 693.0, d0_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_20_7.Hit {
                    px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_20_7.HitColor, 0.62 + 0.25 * k0_20_7.HitNormal.z + 0.13 * k0_20_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_20_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_20_7.Miss {
                    px[20] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_20.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_21 = Normalize(F + R * (TH * 0.343750) + U * v0)
    let k0_21_0 = Sweep(O, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_21_0.Hit {
      px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_0.HitColor, 0.62 + 0.25 * k0_21_0.HitNormal.z + 0.13 * k0_21_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_21_0.Miss {
      let k0_21_1 = Sweep(O + d0_21 * 99.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_21_1.Hit {
        px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_1.HitColor, 0.62 + 0.25 * k0_21_1.HitNormal.z + 0.13 * k0_21_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_21_1.Miss {
        let k0_21_2 = Sweep(O + d0_21 * 198.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_21_2.Hit {
          px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_2.HitColor, 0.62 + 0.25 * k0_21_2.HitNormal.z + 0.13 * k0_21_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_21_2.Miss {
          let k0_21_3 = Sweep(O + d0_21 * 297.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_21_3.Hit {
            px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_3.HitColor, 0.62 + 0.25 * k0_21_3.HitNormal.z + 0.13 * k0_21_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_21_3.Miss {
            let k0_21_4 = Sweep(O + d0_21 * 396.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_21_4.Hit {
              px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_4.HitColor, 0.62 + 0.25 * k0_21_4.HitNormal.z + 0.13 * k0_21_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_21_4.Miss {
              let k0_21_5 = Sweep(O + d0_21 * 495.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_21_5.Hit {
                px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_5.HitColor, 0.62 + 0.25 * k0_21_5.HitNormal.z + 0.13 * k0_21_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_21_5.Miss {
                let k0_21_6 = Sweep(O + d0_21 * 594.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_21_6.Hit {
                  px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_6.HitColor, 0.62 + 0.25 * k0_21_6.HitNormal.z + 0.13 * k0_21_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_21_6.Miss {
                  let k0_21_7 = Sweep(O + d0_21 * 693.0, d0_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_21_7.Hit {
                    px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_21_7.HitColor, 0.62 + 0.25 * k0_21_7.HitNormal.z + 0.13 * k0_21_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_21_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_21_7.Miss {
                    px[21] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_21.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_22 = Normalize(F + R * (TH * 0.406250) + U * v0)
    let k0_22_0 = Sweep(O, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_22_0.Hit {
      px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_0.HitColor, 0.62 + 0.25 * k0_22_0.HitNormal.z + 0.13 * k0_22_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_22_0.Miss {
      let k0_22_1 = Sweep(O + d0_22 * 99.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_22_1.Hit {
        px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_1.HitColor, 0.62 + 0.25 * k0_22_1.HitNormal.z + 0.13 * k0_22_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_22_1.Miss {
        let k0_22_2 = Sweep(O + d0_22 * 198.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_22_2.Hit {
          px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_2.HitColor, 0.62 + 0.25 * k0_22_2.HitNormal.z + 0.13 * k0_22_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_22_2.Miss {
          let k0_22_3 = Sweep(O + d0_22 * 297.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_22_3.Hit {
            px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_3.HitColor, 0.62 + 0.25 * k0_22_3.HitNormal.z + 0.13 * k0_22_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_22_3.Miss {
            let k0_22_4 = Sweep(O + d0_22 * 396.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_22_4.Hit {
              px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_4.HitColor, 0.62 + 0.25 * k0_22_4.HitNormal.z + 0.13 * k0_22_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_22_4.Miss {
              let k0_22_5 = Sweep(O + d0_22 * 495.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_22_5.Hit {
                px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_5.HitColor, 0.62 + 0.25 * k0_22_5.HitNormal.z + 0.13 * k0_22_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_22_5.Miss {
                let k0_22_6 = Sweep(O + d0_22 * 594.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_22_6.Hit {
                  px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_6.HitColor, 0.62 + 0.25 * k0_22_6.HitNormal.z + 0.13 * k0_22_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_22_6.Miss {
                  let k0_22_7 = Sweep(O + d0_22 * 693.0, d0_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_22_7.Hit {
                    px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_22_7.HitColor, 0.62 + 0.25 * k0_22_7.HitNormal.z + 0.13 * k0_22_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_22_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_22_7.Miss {
                    px[22] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_22.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_23 = Normalize(F + R * (TH * 0.468750) + U * v0)
    let k0_23_0 = Sweep(O, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_23_0.Hit {
      px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_0.HitColor, 0.62 + 0.25 * k0_23_0.HitNormal.z + 0.13 * k0_23_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_23_0.Miss {
      let k0_23_1 = Sweep(O + d0_23 * 99.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_23_1.Hit {
        px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_1.HitColor, 0.62 + 0.25 * k0_23_1.HitNormal.z + 0.13 * k0_23_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_23_1.Miss {
        let k0_23_2 = Sweep(O + d0_23 * 198.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_23_2.Hit {
          px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_2.HitColor, 0.62 + 0.25 * k0_23_2.HitNormal.z + 0.13 * k0_23_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_23_2.Miss {
          let k0_23_3 = Sweep(O + d0_23 * 297.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_23_3.Hit {
            px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_3.HitColor, 0.62 + 0.25 * k0_23_3.HitNormal.z + 0.13 * k0_23_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_23_3.Miss {
            let k0_23_4 = Sweep(O + d0_23 * 396.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_23_4.Hit {
              px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_4.HitColor, 0.62 + 0.25 * k0_23_4.HitNormal.z + 0.13 * k0_23_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_23_4.Miss {
              let k0_23_5 = Sweep(O + d0_23 * 495.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_23_5.Hit {
                px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_5.HitColor, 0.62 + 0.25 * k0_23_5.HitNormal.z + 0.13 * k0_23_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_23_5.Miss {
                let k0_23_6 = Sweep(O + d0_23 * 594.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_23_6.Hit {
                  px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_6.HitColor, 0.62 + 0.25 * k0_23_6.HitNormal.z + 0.13 * k0_23_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_23_6.Miss {
                  let k0_23_7 = Sweep(O + d0_23 * 693.0, d0_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_23_7.Hit {
                    px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_23_7.HitColor, 0.62 + 0.25 * k0_23_7.HitNormal.z + 0.13 * k0_23_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_23_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_23_7.Miss {
                    px[23] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_23.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_24 = Normalize(F + R * (TH * 0.531250) + U * v0)
    let k0_24_0 = Sweep(O, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_24_0.Hit {
      px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_0.HitColor, 0.62 + 0.25 * k0_24_0.HitNormal.z + 0.13 * k0_24_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_24_0.Miss {
      let k0_24_1 = Sweep(O + d0_24 * 99.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_24_1.Hit {
        px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_1.HitColor, 0.62 + 0.25 * k0_24_1.HitNormal.z + 0.13 * k0_24_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_24_1.Miss {
        let k0_24_2 = Sweep(O + d0_24 * 198.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_24_2.Hit {
          px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_2.HitColor, 0.62 + 0.25 * k0_24_2.HitNormal.z + 0.13 * k0_24_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_24_2.Miss {
          let k0_24_3 = Sweep(O + d0_24 * 297.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_24_3.Hit {
            px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_3.HitColor, 0.62 + 0.25 * k0_24_3.HitNormal.z + 0.13 * k0_24_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_24_3.Miss {
            let k0_24_4 = Sweep(O + d0_24 * 396.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_24_4.Hit {
              px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_4.HitColor, 0.62 + 0.25 * k0_24_4.HitNormal.z + 0.13 * k0_24_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_24_4.Miss {
              let k0_24_5 = Sweep(O + d0_24 * 495.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_24_5.Hit {
                px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_5.HitColor, 0.62 + 0.25 * k0_24_5.HitNormal.z + 0.13 * k0_24_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_24_5.Miss {
                let k0_24_6 = Sweep(O + d0_24 * 594.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_24_6.Hit {
                  px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_6.HitColor, 0.62 + 0.25 * k0_24_6.HitNormal.z + 0.13 * k0_24_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_24_6.Miss {
                  let k0_24_7 = Sweep(O + d0_24 * 693.0, d0_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_24_7.Hit {
                    px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_24_7.HitColor, 0.62 + 0.25 * k0_24_7.HitNormal.z + 0.13 * k0_24_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_24_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_24_7.Miss {
                    px[24] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_24.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_25 = Normalize(F + R * (TH * 0.593750) + U * v0)
    let k0_25_0 = Sweep(O, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_25_0.Hit {
      px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_0.HitColor, 0.62 + 0.25 * k0_25_0.HitNormal.z + 0.13 * k0_25_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_25_0.Miss {
      let k0_25_1 = Sweep(O + d0_25 * 99.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_25_1.Hit {
        px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_1.HitColor, 0.62 + 0.25 * k0_25_1.HitNormal.z + 0.13 * k0_25_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_25_1.Miss {
        let k0_25_2 = Sweep(O + d0_25 * 198.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_25_2.Hit {
          px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_2.HitColor, 0.62 + 0.25 * k0_25_2.HitNormal.z + 0.13 * k0_25_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_25_2.Miss {
          let k0_25_3 = Sweep(O + d0_25 * 297.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_25_3.Hit {
            px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_3.HitColor, 0.62 + 0.25 * k0_25_3.HitNormal.z + 0.13 * k0_25_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_25_3.Miss {
            let k0_25_4 = Sweep(O + d0_25 * 396.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_25_4.Hit {
              px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_4.HitColor, 0.62 + 0.25 * k0_25_4.HitNormal.z + 0.13 * k0_25_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_25_4.Miss {
              let k0_25_5 = Sweep(O + d0_25 * 495.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_25_5.Hit {
                px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_5.HitColor, 0.62 + 0.25 * k0_25_5.HitNormal.z + 0.13 * k0_25_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_25_5.Miss {
                let k0_25_6 = Sweep(O + d0_25 * 594.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_25_6.Hit {
                  px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_6.HitColor, 0.62 + 0.25 * k0_25_6.HitNormal.z + 0.13 * k0_25_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_25_6.Miss {
                  let k0_25_7 = Sweep(O + d0_25 * 693.0, d0_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_25_7.Hit {
                    px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_25_7.HitColor, 0.62 + 0.25 * k0_25_7.HitNormal.z + 0.13 * k0_25_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_25_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_25_7.Miss {
                    px[25] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_25.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_26 = Normalize(F + R * (TH * 0.656250) + U * v0)
    let k0_26_0 = Sweep(O, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_26_0.Hit {
      px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_0.HitColor, 0.62 + 0.25 * k0_26_0.HitNormal.z + 0.13 * k0_26_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_26_0.Miss {
      let k0_26_1 = Sweep(O + d0_26 * 99.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_26_1.Hit {
        px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_1.HitColor, 0.62 + 0.25 * k0_26_1.HitNormal.z + 0.13 * k0_26_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_26_1.Miss {
        let k0_26_2 = Sweep(O + d0_26 * 198.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_26_2.Hit {
          px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_2.HitColor, 0.62 + 0.25 * k0_26_2.HitNormal.z + 0.13 * k0_26_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_26_2.Miss {
          let k0_26_3 = Sweep(O + d0_26 * 297.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_26_3.Hit {
            px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_3.HitColor, 0.62 + 0.25 * k0_26_3.HitNormal.z + 0.13 * k0_26_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_26_3.Miss {
            let k0_26_4 = Sweep(O + d0_26 * 396.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_26_4.Hit {
              px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_4.HitColor, 0.62 + 0.25 * k0_26_4.HitNormal.z + 0.13 * k0_26_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_26_4.Miss {
              let k0_26_5 = Sweep(O + d0_26 * 495.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_26_5.Hit {
                px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_5.HitColor, 0.62 + 0.25 * k0_26_5.HitNormal.z + 0.13 * k0_26_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_26_5.Miss {
                let k0_26_6 = Sweep(O + d0_26 * 594.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_26_6.Hit {
                  px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_6.HitColor, 0.62 + 0.25 * k0_26_6.HitNormal.z + 0.13 * k0_26_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_26_6.Miss {
                  let k0_26_7 = Sweep(O + d0_26 * 693.0, d0_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_26_7.Hit {
                    px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_26_7.HitColor, 0.62 + 0.25 * k0_26_7.HitNormal.z + 0.13 * k0_26_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_26_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_26_7.Miss {
                    px[26] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_26.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_27 = Normalize(F + R * (TH * 0.718750) + U * v0)
    let k0_27_0 = Sweep(O, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_27_0.Hit {
      px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_0.HitColor, 0.62 + 0.25 * k0_27_0.HitNormal.z + 0.13 * k0_27_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_27_0.Miss {
      let k0_27_1 = Sweep(O + d0_27 * 99.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_27_1.Hit {
        px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_1.HitColor, 0.62 + 0.25 * k0_27_1.HitNormal.z + 0.13 * k0_27_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_27_1.Miss {
        let k0_27_2 = Sweep(O + d0_27 * 198.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_27_2.Hit {
          px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_2.HitColor, 0.62 + 0.25 * k0_27_2.HitNormal.z + 0.13 * k0_27_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_27_2.Miss {
          let k0_27_3 = Sweep(O + d0_27 * 297.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_27_3.Hit {
            px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_3.HitColor, 0.62 + 0.25 * k0_27_3.HitNormal.z + 0.13 * k0_27_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_27_3.Miss {
            let k0_27_4 = Sweep(O + d0_27 * 396.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_27_4.Hit {
              px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_4.HitColor, 0.62 + 0.25 * k0_27_4.HitNormal.z + 0.13 * k0_27_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_27_4.Miss {
              let k0_27_5 = Sweep(O + d0_27 * 495.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_27_5.Hit {
                px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_5.HitColor, 0.62 + 0.25 * k0_27_5.HitNormal.z + 0.13 * k0_27_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_27_5.Miss {
                let k0_27_6 = Sweep(O + d0_27 * 594.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_27_6.Hit {
                  px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_6.HitColor, 0.62 + 0.25 * k0_27_6.HitNormal.z + 0.13 * k0_27_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_27_6.Miss {
                  let k0_27_7 = Sweep(O + d0_27 * 693.0, d0_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_27_7.Hit {
                    px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_27_7.HitColor, 0.62 + 0.25 * k0_27_7.HitNormal.z + 0.13 * k0_27_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_27_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_27_7.Miss {
                    px[27] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_27.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_28 = Normalize(F + R * (TH * 0.781250) + U * v0)
    let k0_28_0 = Sweep(O, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_28_0.Hit {
      px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_0.HitColor, 0.62 + 0.25 * k0_28_0.HitNormal.z + 0.13 * k0_28_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_28_0.Miss {
      let k0_28_1 = Sweep(O + d0_28 * 99.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_28_1.Hit {
        px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_1.HitColor, 0.62 + 0.25 * k0_28_1.HitNormal.z + 0.13 * k0_28_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_28_1.Miss {
        let k0_28_2 = Sweep(O + d0_28 * 198.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_28_2.Hit {
          px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_2.HitColor, 0.62 + 0.25 * k0_28_2.HitNormal.z + 0.13 * k0_28_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_28_2.Miss {
          let k0_28_3 = Sweep(O + d0_28 * 297.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_28_3.Hit {
            px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_3.HitColor, 0.62 + 0.25 * k0_28_3.HitNormal.z + 0.13 * k0_28_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_28_3.Miss {
            let k0_28_4 = Sweep(O + d0_28 * 396.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_28_4.Hit {
              px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_4.HitColor, 0.62 + 0.25 * k0_28_4.HitNormal.z + 0.13 * k0_28_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_28_4.Miss {
              let k0_28_5 = Sweep(O + d0_28 * 495.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_28_5.Hit {
                px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_5.HitColor, 0.62 + 0.25 * k0_28_5.HitNormal.z + 0.13 * k0_28_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_28_5.Miss {
                let k0_28_6 = Sweep(O + d0_28 * 594.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_28_6.Hit {
                  px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_6.HitColor, 0.62 + 0.25 * k0_28_6.HitNormal.z + 0.13 * k0_28_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_28_6.Miss {
                  let k0_28_7 = Sweep(O + d0_28 * 693.0, d0_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_28_7.Hit {
                    px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_28_7.HitColor, 0.62 + 0.25 * k0_28_7.HitNormal.z + 0.13 * k0_28_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_28_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_28_7.Miss {
                    px[28] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_28.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_29 = Normalize(F + R * (TH * 0.843750) + U * v0)
    let k0_29_0 = Sweep(O, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_29_0.Hit {
      px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_0.HitColor, 0.62 + 0.25 * k0_29_0.HitNormal.z + 0.13 * k0_29_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_29_0.Miss {
      let k0_29_1 = Sweep(O + d0_29 * 99.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_29_1.Hit {
        px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_1.HitColor, 0.62 + 0.25 * k0_29_1.HitNormal.z + 0.13 * k0_29_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_29_1.Miss {
        let k0_29_2 = Sweep(O + d0_29 * 198.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_29_2.Hit {
          px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_2.HitColor, 0.62 + 0.25 * k0_29_2.HitNormal.z + 0.13 * k0_29_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_29_2.Miss {
          let k0_29_3 = Sweep(O + d0_29 * 297.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_29_3.Hit {
            px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_3.HitColor, 0.62 + 0.25 * k0_29_3.HitNormal.z + 0.13 * k0_29_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_29_3.Miss {
            let k0_29_4 = Sweep(O + d0_29 * 396.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_29_4.Hit {
              px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_4.HitColor, 0.62 + 0.25 * k0_29_4.HitNormal.z + 0.13 * k0_29_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_29_4.Miss {
              let k0_29_5 = Sweep(O + d0_29 * 495.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_29_5.Hit {
                px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_5.HitColor, 0.62 + 0.25 * k0_29_5.HitNormal.z + 0.13 * k0_29_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_29_5.Miss {
                let k0_29_6 = Sweep(O + d0_29 * 594.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_29_6.Hit {
                  px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_6.HitColor, 0.62 + 0.25 * k0_29_6.HitNormal.z + 0.13 * k0_29_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_29_6.Miss {
                  let k0_29_7 = Sweep(O + d0_29 * 693.0, d0_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_29_7.Hit {
                    px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_29_7.HitColor, 0.62 + 0.25 * k0_29_7.HitNormal.z + 0.13 * k0_29_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_29_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_29_7.Miss {
                    px[29] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_29.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_30 = Normalize(F + R * (TH * 0.906250) + U * v0)
    let k0_30_0 = Sweep(O, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_30_0.Hit {
      px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_0.HitColor, 0.62 + 0.25 * k0_30_0.HitNormal.z + 0.13 * k0_30_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_30_0.Miss {
      let k0_30_1 = Sweep(O + d0_30 * 99.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_30_1.Hit {
        px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_1.HitColor, 0.62 + 0.25 * k0_30_1.HitNormal.z + 0.13 * k0_30_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_30_1.Miss {
        let k0_30_2 = Sweep(O + d0_30 * 198.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_30_2.Hit {
          px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_2.HitColor, 0.62 + 0.25 * k0_30_2.HitNormal.z + 0.13 * k0_30_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_30_2.Miss {
          let k0_30_3 = Sweep(O + d0_30 * 297.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_30_3.Hit {
            px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_3.HitColor, 0.62 + 0.25 * k0_30_3.HitNormal.z + 0.13 * k0_30_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_30_3.Miss {
            let k0_30_4 = Sweep(O + d0_30 * 396.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_30_4.Hit {
              px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_4.HitColor, 0.62 + 0.25 * k0_30_4.HitNormal.z + 0.13 * k0_30_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_30_4.Miss {
              let k0_30_5 = Sweep(O + d0_30 * 495.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_30_5.Hit {
                px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_5.HitColor, 0.62 + 0.25 * k0_30_5.HitNormal.z + 0.13 * k0_30_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_30_5.Miss {
                let k0_30_6 = Sweep(O + d0_30 * 594.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_30_6.Hit {
                  px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_6.HitColor, 0.62 + 0.25 * k0_30_6.HitNormal.z + 0.13 * k0_30_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_30_6.Miss {
                  let k0_30_7 = Sweep(O + d0_30 * 693.0, d0_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_30_7.Hit {
                    px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_30_7.HitColor, 0.62 + 0.25 * k0_30_7.HitNormal.z + 0.13 * k0_30_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_30_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_30_7.Miss {
                    px[30] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_30.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d0_31 = Normalize(F + R * (TH * 0.968750) + U * v0)
    let k0_31_0 = Sweep(O, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k0_31_0.Hit {
      px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_0.HitColor, 0.62 + 0.25 * k0_31_0.HitNormal.z + 0.13 * k0_31_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k0_31_0.Miss {
      let k0_31_1 = Sweep(O + d0_31 * 99.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k0_31_1.Hit {
        px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_1.HitColor, 0.62 + 0.25 * k0_31_1.HitNormal.z + 0.13 * k0_31_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k0_31_1.Miss {
        let k0_31_2 = Sweep(O + d0_31 * 198.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k0_31_2.Hit {
          px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_2.HitColor, 0.62 + 0.25 * k0_31_2.HitNormal.z + 0.13 * k0_31_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k0_31_2.Miss {
          let k0_31_3 = Sweep(O + d0_31 * 297.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k0_31_3.Hit {
            px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_3.HitColor, 0.62 + 0.25 * k0_31_3.HitNormal.z + 0.13 * k0_31_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k0_31_3.Miss {
            let k0_31_4 = Sweep(O + d0_31 * 396.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k0_31_4.Hit {
              px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_4.HitColor, 0.62 + 0.25 * k0_31_4.HitNormal.z + 0.13 * k0_31_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k0_31_4.Miss {
              let k0_31_5 = Sweep(O + d0_31 * 495.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k0_31_5.Hit {
                px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_5.HitColor, 0.62 + 0.25 * k0_31_5.HitNormal.z + 0.13 * k0_31_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k0_31_5.Miss {
                let k0_31_6 = Sweep(O + d0_31 * 594.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k0_31_6.Hit {
                  px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_6.HitColor, 0.62 + 0.25 * k0_31_6.HitNormal.z + 0.13 * k0_31_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k0_31_6.Miss {
                  let k0_31_7 = Sweep(O + d0_31 * 693.0, d0_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k0_31_7.Hit {
                    px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k0_31_7.HitColor, 0.62 + 0.25 * k0_31_7.HitNormal.z + 0.13 * k0_31_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k0_31_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k0_31_7.Miss {
                    px[31] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d0_31.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let row0 = rowStr()
    let v1 = TV * (1.0 - (rw * 2.0 + 1.5) * 0.111111)
    let d1_0 = Normalize(F + R * (TH * -0.968750) + U * v1)
    let k1_0_0 = Sweep(O, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_0_0.Hit {
      px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_0.HitColor, 0.62 + 0.25 * k1_0_0.HitNormal.z + 0.13 * k1_0_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_0_0.Miss {
      let k1_0_1 = Sweep(O + d1_0 * 99.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_0_1.Hit {
        px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_1.HitColor, 0.62 + 0.25 * k1_0_1.HitNormal.z + 0.13 * k1_0_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_0_1.Miss {
        let k1_0_2 = Sweep(O + d1_0 * 198.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_0_2.Hit {
          px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_2.HitColor, 0.62 + 0.25 * k1_0_2.HitNormal.z + 0.13 * k1_0_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_0_2.Miss {
          let k1_0_3 = Sweep(O + d1_0 * 297.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_0_3.Hit {
            px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_3.HitColor, 0.62 + 0.25 * k1_0_3.HitNormal.z + 0.13 * k1_0_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_0_3.Miss {
            let k1_0_4 = Sweep(O + d1_0 * 396.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_0_4.Hit {
              px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_4.HitColor, 0.62 + 0.25 * k1_0_4.HitNormal.z + 0.13 * k1_0_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_0_4.Miss {
              let k1_0_5 = Sweep(O + d1_0 * 495.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_0_5.Hit {
                px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_5.HitColor, 0.62 + 0.25 * k1_0_5.HitNormal.z + 0.13 * k1_0_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_0_5.Miss {
                let k1_0_6 = Sweep(O + d1_0 * 594.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_0_6.Hit {
                  px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_6.HitColor, 0.62 + 0.25 * k1_0_6.HitNormal.z + 0.13 * k1_0_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_0_6.Miss {
                  let k1_0_7 = Sweep(O + d1_0 * 693.0, d1_0, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_0_7.Hit {
                    px[0] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_0_7.HitColor, 0.62 + 0.25 * k1_0_7.HitNormal.z + 0.13 * k1_0_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_0_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_0_7.Miss {
                    px[0] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_0.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_1 = Normalize(F + R * (TH * -0.906250) + U * v1)
    let k1_1_0 = Sweep(O, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_1_0.Hit {
      px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_0.HitColor, 0.62 + 0.25 * k1_1_0.HitNormal.z + 0.13 * k1_1_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_1_0.Miss {
      let k1_1_1 = Sweep(O + d1_1 * 99.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_1_1.Hit {
        px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_1.HitColor, 0.62 + 0.25 * k1_1_1.HitNormal.z + 0.13 * k1_1_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_1_1.Miss {
        let k1_1_2 = Sweep(O + d1_1 * 198.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_1_2.Hit {
          px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_2.HitColor, 0.62 + 0.25 * k1_1_2.HitNormal.z + 0.13 * k1_1_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_1_2.Miss {
          let k1_1_3 = Sweep(O + d1_1 * 297.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_1_3.Hit {
            px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_3.HitColor, 0.62 + 0.25 * k1_1_3.HitNormal.z + 0.13 * k1_1_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_1_3.Miss {
            let k1_1_4 = Sweep(O + d1_1 * 396.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_1_4.Hit {
              px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_4.HitColor, 0.62 + 0.25 * k1_1_4.HitNormal.z + 0.13 * k1_1_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_1_4.Miss {
              let k1_1_5 = Sweep(O + d1_1 * 495.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_1_5.Hit {
                px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_5.HitColor, 0.62 + 0.25 * k1_1_5.HitNormal.z + 0.13 * k1_1_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_1_5.Miss {
                let k1_1_6 = Sweep(O + d1_1 * 594.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_1_6.Hit {
                  px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_6.HitColor, 0.62 + 0.25 * k1_1_6.HitNormal.z + 0.13 * k1_1_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_1_6.Miss {
                  let k1_1_7 = Sweep(O + d1_1 * 693.0, d1_1, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_1_7.Hit {
                    px[1] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_1_7.HitColor, 0.62 + 0.25 * k1_1_7.HitNormal.z + 0.13 * k1_1_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_1_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_1_7.Miss {
                    px[1] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_1.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_2 = Normalize(F + R * (TH * -0.843750) + U * v1)
    let k1_2_0 = Sweep(O, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_2_0.Hit {
      px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_0.HitColor, 0.62 + 0.25 * k1_2_0.HitNormal.z + 0.13 * k1_2_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_2_0.Miss {
      let k1_2_1 = Sweep(O + d1_2 * 99.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_2_1.Hit {
        px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_1.HitColor, 0.62 + 0.25 * k1_2_1.HitNormal.z + 0.13 * k1_2_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_2_1.Miss {
        let k1_2_2 = Sweep(O + d1_2 * 198.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_2_2.Hit {
          px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_2.HitColor, 0.62 + 0.25 * k1_2_2.HitNormal.z + 0.13 * k1_2_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_2_2.Miss {
          let k1_2_3 = Sweep(O + d1_2 * 297.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_2_3.Hit {
            px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_3.HitColor, 0.62 + 0.25 * k1_2_3.HitNormal.z + 0.13 * k1_2_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_2_3.Miss {
            let k1_2_4 = Sweep(O + d1_2 * 396.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_2_4.Hit {
              px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_4.HitColor, 0.62 + 0.25 * k1_2_4.HitNormal.z + 0.13 * k1_2_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_2_4.Miss {
              let k1_2_5 = Sweep(O + d1_2 * 495.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_2_5.Hit {
                px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_5.HitColor, 0.62 + 0.25 * k1_2_5.HitNormal.z + 0.13 * k1_2_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_2_5.Miss {
                let k1_2_6 = Sweep(O + d1_2 * 594.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_2_6.Hit {
                  px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_6.HitColor, 0.62 + 0.25 * k1_2_6.HitNormal.z + 0.13 * k1_2_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_2_6.Miss {
                  let k1_2_7 = Sweep(O + d1_2 * 693.0, d1_2, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_2_7.Hit {
                    px[2] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_2_7.HitColor, 0.62 + 0.25 * k1_2_7.HitNormal.z + 0.13 * k1_2_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_2_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_2_7.Miss {
                    px[2] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_2.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_3 = Normalize(F + R * (TH * -0.781250) + U * v1)
    let k1_3_0 = Sweep(O, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_3_0.Hit {
      px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_0.HitColor, 0.62 + 0.25 * k1_3_0.HitNormal.z + 0.13 * k1_3_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_3_0.Miss {
      let k1_3_1 = Sweep(O + d1_3 * 99.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_3_1.Hit {
        px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_1.HitColor, 0.62 + 0.25 * k1_3_1.HitNormal.z + 0.13 * k1_3_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_3_1.Miss {
        let k1_3_2 = Sweep(O + d1_3 * 198.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_3_2.Hit {
          px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_2.HitColor, 0.62 + 0.25 * k1_3_2.HitNormal.z + 0.13 * k1_3_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_3_2.Miss {
          let k1_3_3 = Sweep(O + d1_3 * 297.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_3_3.Hit {
            px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_3.HitColor, 0.62 + 0.25 * k1_3_3.HitNormal.z + 0.13 * k1_3_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_3_3.Miss {
            let k1_3_4 = Sweep(O + d1_3 * 396.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_3_4.Hit {
              px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_4.HitColor, 0.62 + 0.25 * k1_3_4.HitNormal.z + 0.13 * k1_3_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_3_4.Miss {
              let k1_3_5 = Sweep(O + d1_3 * 495.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_3_5.Hit {
                px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_5.HitColor, 0.62 + 0.25 * k1_3_5.HitNormal.z + 0.13 * k1_3_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_3_5.Miss {
                let k1_3_6 = Sweep(O + d1_3 * 594.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_3_6.Hit {
                  px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_6.HitColor, 0.62 + 0.25 * k1_3_6.HitNormal.z + 0.13 * k1_3_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_3_6.Miss {
                  let k1_3_7 = Sweep(O + d1_3 * 693.0, d1_3, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_3_7.Hit {
                    px[3] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_3_7.HitColor, 0.62 + 0.25 * k1_3_7.HitNormal.z + 0.13 * k1_3_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_3_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_3_7.Miss {
                    px[3] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_3.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_4 = Normalize(F + R * (TH * -0.718750) + U * v1)
    let k1_4_0 = Sweep(O, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_4_0.Hit {
      px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_0.HitColor, 0.62 + 0.25 * k1_4_0.HitNormal.z + 0.13 * k1_4_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_4_0.Miss {
      let k1_4_1 = Sweep(O + d1_4 * 99.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_4_1.Hit {
        px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_1.HitColor, 0.62 + 0.25 * k1_4_1.HitNormal.z + 0.13 * k1_4_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_4_1.Miss {
        let k1_4_2 = Sweep(O + d1_4 * 198.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_4_2.Hit {
          px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_2.HitColor, 0.62 + 0.25 * k1_4_2.HitNormal.z + 0.13 * k1_4_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_4_2.Miss {
          let k1_4_3 = Sweep(O + d1_4 * 297.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_4_3.Hit {
            px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_3.HitColor, 0.62 + 0.25 * k1_4_3.HitNormal.z + 0.13 * k1_4_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_4_3.Miss {
            let k1_4_4 = Sweep(O + d1_4 * 396.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_4_4.Hit {
              px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_4.HitColor, 0.62 + 0.25 * k1_4_4.HitNormal.z + 0.13 * k1_4_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_4_4.Miss {
              let k1_4_5 = Sweep(O + d1_4 * 495.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_4_5.Hit {
                px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_5.HitColor, 0.62 + 0.25 * k1_4_5.HitNormal.z + 0.13 * k1_4_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_4_5.Miss {
                let k1_4_6 = Sweep(O + d1_4 * 594.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_4_6.Hit {
                  px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_6.HitColor, 0.62 + 0.25 * k1_4_6.HitNormal.z + 0.13 * k1_4_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_4_6.Miss {
                  let k1_4_7 = Sweep(O + d1_4 * 693.0, d1_4, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_4_7.Hit {
                    px[4] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_4_7.HitColor, 0.62 + 0.25 * k1_4_7.HitNormal.z + 0.13 * k1_4_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_4_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_4_7.Miss {
                    px[4] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_4.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_5 = Normalize(F + R * (TH * -0.656250) + U * v1)
    let k1_5_0 = Sweep(O, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_5_0.Hit {
      px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_0.HitColor, 0.62 + 0.25 * k1_5_0.HitNormal.z + 0.13 * k1_5_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_5_0.Miss {
      let k1_5_1 = Sweep(O + d1_5 * 99.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_5_1.Hit {
        px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_1.HitColor, 0.62 + 0.25 * k1_5_1.HitNormal.z + 0.13 * k1_5_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_5_1.Miss {
        let k1_5_2 = Sweep(O + d1_5 * 198.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_5_2.Hit {
          px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_2.HitColor, 0.62 + 0.25 * k1_5_2.HitNormal.z + 0.13 * k1_5_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_5_2.Miss {
          let k1_5_3 = Sweep(O + d1_5 * 297.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_5_3.Hit {
            px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_3.HitColor, 0.62 + 0.25 * k1_5_3.HitNormal.z + 0.13 * k1_5_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_5_3.Miss {
            let k1_5_4 = Sweep(O + d1_5 * 396.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_5_4.Hit {
              px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_4.HitColor, 0.62 + 0.25 * k1_5_4.HitNormal.z + 0.13 * k1_5_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_5_4.Miss {
              let k1_5_5 = Sweep(O + d1_5 * 495.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_5_5.Hit {
                px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_5.HitColor, 0.62 + 0.25 * k1_5_5.HitNormal.z + 0.13 * k1_5_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_5_5.Miss {
                let k1_5_6 = Sweep(O + d1_5 * 594.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_5_6.Hit {
                  px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_6.HitColor, 0.62 + 0.25 * k1_5_6.HitNormal.z + 0.13 * k1_5_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_5_6.Miss {
                  let k1_5_7 = Sweep(O + d1_5 * 693.0, d1_5, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_5_7.Hit {
                    px[5] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_5_7.HitColor, 0.62 + 0.25 * k1_5_7.HitNormal.z + 0.13 * k1_5_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_5_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_5_7.Miss {
                    px[5] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_5.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_6 = Normalize(F + R * (TH * -0.593750) + U * v1)
    let k1_6_0 = Sweep(O, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_6_0.Hit {
      px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_0.HitColor, 0.62 + 0.25 * k1_6_0.HitNormal.z + 0.13 * k1_6_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_6_0.Miss {
      let k1_6_1 = Sweep(O + d1_6 * 99.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_6_1.Hit {
        px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_1.HitColor, 0.62 + 0.25 * k1_6_1.HitNormal.z + 0.13 * k1_6_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_6_1.Miss {
        let k1_6_2 = Sweep(O + d1_6 * 198.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_6_2.Hit {
          px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_2.HitColor, 0.62 + 0.25 * k1_6_2.HitNormal.z + 0.13 * k1_6_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_6_2.Miss {
          let k1_6_3 = Sweep(O + d1_6 * 297.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_6_3.Hit {
            px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_3.HitColor, 0.62 + 0.25 * k1_6_3.HitNormal.z + 0.13 * k1_6_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_6_3.Miss {
            let k1_6_4 = Sweep(O + d1_6 * 396.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_6_4.Hit {
              px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_4.HitColor, 0.62 + 0.25 * k1_6_4.HitNormal.z + 0.13 * k1_6_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_6_4.Miss {
              let k1_6_5 = Sweep(O + d1_6 * 495.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_6_5.Hit {
                px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_5.HitColor, 0.62 + 0.25 * k1_6_5.HitNormal.z + 0.13 * k1_6_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_6_5.Miss {
                let k1_6_6 = Sweep(O + d1_6 * 594.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_6_6.Hit {
                  px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_6.HitColor, 0.62 + 0.25 * k1_6_6.HitNormal.z + 0.13 * k1_6_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_6_6.Miss {
                  let k1_6_7 = Sweep(O + d1_6 * 693.0, d1_6, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_6_7.Hit {
                    px[6] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_6_7.HitColor, 0.62 + 0.25 * k1_6_7.HitNormal.z + 0.13 * k1_6_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_6_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_6_7.Miss {
                    px[6] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_6.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_7 = Normalize(F + R * (TH * -0.531250) + U * v1)
    let k1_7_0 = Sweep(O, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_7_0.Hit {
      px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_0.HitColor, 0.62 + 0.25 * k1_7_0.HitNormal.z + 0.13 * k1_7_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_7_0.Miss {
      let k1_7_1 = Sweep(O + d1_7 * 99.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_7_1.Hit {
        px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_1.HitColor, 0.62 + 0.25 * k1_7_1.HitNormal.z + 0.13 * k1_7_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_7_1.Miss {
        let k1_7_2 = Sweep(O + d1_7 * 198.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_7_2.Hit {
          px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_2.HitColor, 0.62 + 0.25 * k1_7_2.HitNormal.z + 0.13 * k1_7_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_7_2.Miss {
          let k1_7_3 = Sweep(O + d1_7 * 297.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_7_3.Hit {
            px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_3.HitColor, 0.62 + 0.25 * k1_7_3.HitNormal.z + 0.13 * k1_7_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_7_3.Miss {
            let k1_7_4 = Sweep(O + d1_7 * 396.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_7_4.Hit {
              px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_4.HitColor, 0.62 + 0.25 * k1_7_4.HitNormal.z + 0.13 * k1_7_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_7_4.Miss {
              let k1_7_5 = Sweep(O + d1_7 * 495.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_7_5.Hit {
                px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_5.HitColor, 0.62 + 0.25 * k1_7_5.HitNormal.z + 0.13 * k1_7_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_7_5.Miss {
                let k1_7_6 = Sweep(O + d1_7 * 594.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_7_6.Hit {
                  px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_6.HitColor, 0.62 + 0.25 * k1_7_6.HitNormal.z + 0.13 * k1_7_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_7_6.Miss {
                  let k1_7_7 = Sweep(O + d1_7 * 693.0, d1_7, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_7_7.Hit {
                    px[7] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_7_7.HitColor, 0.62 + 0.25 * k1_7_7.HitNormal.z + 0.13 * k1_7_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_7_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_7_7.Miss {
                    px[7] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_7.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_8 = Normalize(F + R * (TH * -0.468750) + U * v1)
    let k1_8_0 = Sweep(O, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_8_0.Hit {
      px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_0.HitColor, 0.62 + 0.25 * k1_8_0.HitNormal.z + 0.13 * k1_8_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_8_0.Miss {
      let k1_8_1 = Sweep(O + d1_8 * 99.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_8_1.Hit {
        px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_1.HitColor, 0.62 + 0.25 * k1_8_1.HitNormal.z + 0.13 * k1_8_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_8_1.Miss {
        let k1_8_2 = Sweep(O + d1_8 * 198.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_8_2.Hit {
          px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_2.HitColor, 0.62 + 0.25 * k1_8_2.HitNormal.z + 0.13 * k1_8_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_8_2.Miss {
          let k1_8_3 = Sweep(O + d1_8 * 297.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_8_3.Hit {
            px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_3.HitColor, 0.62 + 0.25 * k1_8_3.HitNormal.z + 0.13 * k1_8_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_8_3.Miss {
            let k1_8_4 = Sweep(O + d1_8 * 396.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_8_4.Hit {
              px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_4.HitColor, 0.62 + 0.25 * k1_8_4.HitNormal.z + 0.13 * k1_8_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_8_4.Miss {
              let k1_8_5 = Sweep(O + d1_8 * 495.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_8_5.Hit {
                px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_5.HitColor, 0.62 + 0.25 * k1_8_5.HitNormal.z + 0.13 * k1_8_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_8_5.Miss {
                let k1_8_6 = Sweep(O + d1_8 * 594.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_8_6.Hit {
                  px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_6.HitColor, 0.62 + 0.25 * k1_8_6.HitNormal.z + 0.13 * k1_8_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_8_6.Miss {
                  let k1_8_7 = Sweep(O + d1_8 * 693.0, d1_8, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_8_7.Hit {
                    px[8] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_8_7.HitColor, 0.62 + 0.25 * k1_8_7.HitNormal.z + 0.13 * k1_8_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_8_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_8_7.Miss {
                    px[8] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_8.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_9 = Normalize(F + R * (TH * -0.406250) + U * v1)
    let k1_9_0 = Sweep(O, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_9_0.Hit {
      px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_0.HitColor, 0.62 + 0.25 * k1_9_0.HitNormal.z + 0.13 * k1_9_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_9_0.Miss {
      let k1_9_1 = Sweep(O + d1_9 * 99.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_9_1.Hit {
        px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_1.HitColor, 0.62 + 0.25 * k1_9_1.HitNormal.z + 0.13 * k1_9_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_9_1.Miss {
        let k1_9_2 = Sweep(O + d1_9 * 198.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_9_2.Hit {
          px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_2.HitColor, 0.62 + 0.25 * k1_9_2.HitNormal.z + 0.13 * k1_9_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_9_2.Miss {
          let k1_9_3 = Sweep(O + d1_9 * 297.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_9_3.Hit {
            px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_3.HitColor, 0.62 + 0.25 * k1_9_3.HitNormal.z + 0.13 * k1_9_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_9_3.Miss {
            let k1_9_4 = Sweep(O + d1_9 * 396.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_9_4.Hit {
              px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_4.HitColor, 0.62 + 0.25 * k1_9_4.HitNormal.z + 0.13 * k1_9_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_9_4.Miss {
              let k1_9_5 = Sweep(O + d1_9 * 495.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_9_5.Hit {
                px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_5.HitColor, 0.62 + 0.25 * k1_9_5.HitNormal.z + 0.13 * k1_9_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_9_5.Miss {
                let k1_9_6 = Sweep(O + d1_9 * 594.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_9_6.Hit {
                  px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_6.HitColor, 0.62 + 0.25 * k1_9_6.HitNormal.z + 0.13 * k1_9_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_9_6.Miss {
                  let k1_9_7 = Sweep(O + d1_9 * 693.0, d1_9, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_9_7.Hit {
                    px[9] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_9_7.HitColor, 0.62 + 0.25 * k1_9_7.HitNormal.z + 0.13 * k1_9_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_9_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_9_7.Miss {
                    px[9] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_9.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_10 = Normalize(F + R * (TH * -0.343750) + U * v1)
    let k1_10_0 = Sweep(O, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_10_0.Hit {
      px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_0.HitColor, 0.62 + 0.25 * k1_10_0.HitNormal.z + 0.13 * k1_10_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_10_0.Miss {
      let k1_10_1 = Sweep(O + d1_10 * 99.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_10_1.Hit {
        px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_1.HitColor, 0.62 + 0.25 * k1_10_1.HitNormal.z + 0.13 * k1_10_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_10_1.Miss {
        let k1_10_2 = Sweep(O + d1_10 * 198.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_10_2.Hit {
          px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_2.HitColor, 0.62 + 0.25 * k1_10_2.HitNormal.z + 0.13 * k1_10_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_10_2.Miss {
          let k1_10_3 = Sweep(O + d1_10 * 297.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_10_3.Hit {
            px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_3.HitColor, 0.62 + 0.25 * k1_10_3.HitNormal.z + 0.13 * k1_10_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_10_3.Miss {
            let k1_10_4 = Sweep(O + d1_10 * 396.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_10_4.Hit {
              px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_4.HitColor, 0.62 + 0.25 * k1_10_4.HitNormal.z + 0.13 * k1_10_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_10_4.Miss {
              let k1_10_5 = Sweep(O + d1_10 * 495.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_10_5.Hit {
                px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_5.HitColor, 0.62 + 0.25 * k1_10_5.HitNormal.z + 0.13 * k1_10_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_10_5.Miss {
                let k1_10_6 = Sweep(O + d1_10 * 594.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_10_6.Hit {
                  px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_6.HitColor, 0.62 + 0.25 * k1_10_6.HitNormal.z + 0.13 * k1_10_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_10_6.Miss {
                  let k1_10_7 = Sweep(O + d1_10 * 693.0, d1_10, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_10_7.Hit {
                    px[10] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_10_7.HitColor, 0.62 + 0.25 * k1_10_7.HitNormal.z + 0.13 * k1_10_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_10_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_10_7.Miss {
                    px[10] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_10.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_11 = Normalize(F + R * (TH * -0.281250) + U * v1)
    let k1_11_0 = Sweep(O, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_11_0.Hit {
      px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_0.HitColor, 0.62 + 0.25 * k1_11_0.HitNormal.z + 0.13 * k1_11_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_11_0.Miss {
      let k1_11_1 = Sweep(O + d1_11 * 99.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_11_1.Hit {
        px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_1.HitColor, 0.62 + 0.25 * k1_11_1.HitNormal.z + 0.13 * k1_11_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_11_1.Miss {
        let k1_11_2 = Sweep(O + d1_11 * 198.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_11_2.Hit {
          px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_2.HitColor, 0.62 + 0.25 * k1_11_2.HitNormal.z + 0.13 * k1_11_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_11_2.Miss {
          let k1_11_3 = Sweep(O + d1_11 * 297.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_11_3.Hit {
            px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_3.HitColor, 0.62 + 0.25 * k1_11_3.HitNormal.z + 0.13 * k1_11_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_11_3.Miss {
            let k1_11_4 = Sweep(O + d1_11 * 396.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_11_4.Hit {
              px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_4.HitColor, 0.62 + 0.25 * k1_11_4.HitNormal.z + 0.13 * k1_11_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_11_4.Miss {
              let k1_11_5 = Sweep(O + d1_11 * 495.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_11_5.Hit {
                px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_5.HitColor, 0.62 + 0.25 * k1_11_5.HitNormal.z + 0.13 * k1_11_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_11_5.Miss {
                let k1_11_6 = Sweep(O + d1_11 * 594.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_11_6.Hit {
                  px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_6.HitColor, 0.62 + 0.25 * k1_11_6.HitNormal.z + 0.13 * k1_11_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_11_6.Miss {
                  let k1_11_7 = Sweep(O + d1_11 * 693.0, d1_11, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_11_7.Hit {
                    px[11] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_11_7.HitColor, 0.62 + 0.25 * k1_11_7.HitNormal.z + 0.13 * k1_11_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_11_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_11_7.Miss {
                    px[11] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_11.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_12 = Normalize(F + R * (TH * -0.218750) + U * v1)
    let k1_12_0 = Sweep(O, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_12_0.Hit {
      px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_0.HitColor, 0.62 + 0.25 * k1_12_0.HitNormal.z + 0.13 * k1_12_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_12_0.Miss {
      let k1_12_1 = Sweep(O + d1_12 * 99.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_12_1.Hit {
        px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_1.HitColor, 0.62 + 0.25 * k1_12_1.HitNormal.z + 0.13 * k1_12_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_12_1.Miss {
        let k1_12_2 = Sweep(O + d1_12 * 198.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_12_2.Hit {
          px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_2.HitColor, 0.62 + 0.25 * k1_12_2.HitNormal.z + 0.13 * k1_12_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_12_2.Miss {
          let k1_12_3 = Sweep(O + d1_12 * 297.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_12_3.Hit {
            px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_3.HitColor, 0.62 + 0.25 * k1_12_3.HitNormal.z + 0.13 * k1_12_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_12_3.Miss {
            let k1_12_4 = Sweep(O + d1_12 * 396.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_12_4.Hit {
              px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_4.HitColor, 0.62 + 0.25 * k1_12_4.HitNormal.z + 0.13 * k1_12_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_12_4.Miss {
              let k1_12_5 = Sweep(O + d1_12 * 495.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_12_5.Hit {
                px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_5.HitColor, 0.62 + 0.25 * k1_12_5.HitNormal.z + 0.13 * k1_12_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_12_5.Miss {
                let k1_12_6 = Sweep(O + d1_12 * 594.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_12_6.Hit {
                  px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_6.HitColor, 0.62 + 0.25 * k1_12_6.HitNormal.z + 0.13 * k1_12_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_12_6.Miss {
                  let k1_12_7 = Sweep(O + d1_12 * 693.0, d1_12, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_12_7.Hit {
                    px[12] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_12_7.HitColor, 0.62 + 0.25 * k1_12_7.HitNormal.z + 0.13 * k1_12_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_12_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_12_7.Miss {
                    px[12] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_12.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_13 = Normalize(F + R * (TH * -0.156250) + U * v1)
    let k1_13_0 = Sweep(O, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_13_0.Hit {
      px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_0.HitColor, 0.62 + 0.25 * k1_13_0.HitNormal.z + 0.13 * k1_13_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_13_0.Miss {
      let k1_13_1 = Sweep(O + d1_13 * 99.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_13_1.Hit {
        px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_1.HitColor, 0.62 + 0.25 * k1_13_1.HitNormal.z + 0.13 * k1_13_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_13_1.Miss {
        let k1_13_2 = Sweep(O + d1_13 * 198.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_13_2.Hit {
          px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_2.HitColor, 0.62 + 0.25 * k1_13_2.HitNormal.z + 0.13 * k1_13_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_13_2.Miss {
          let k1_13_3 = Sweep(O + d1_13 * 297.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_13_3.Hit {
            px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_3.HitColor, 0.62 + 0.25 * k1_13_3.HitNormal.z + 0.13 * k1_13_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_13_3.Miss {
            let k1_13_4 = Sweep(O + d1_13 * 396.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_13_4.Hit {
              px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_4.HitColor, 0.62 + 0.25 * k1_13_4.HitNormal.z + 0.13 * k1_13_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_13_4.Miss {
              let k1_13_5 = Sweep(O + d1_13 * 495.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_13_5.Hit {
                px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_5.HitColor, 0.62 + 0.25 * k1_13_5.HitNormal.z + 0.13 * k1_13_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_13_5.Miss {
                let k1_13_6 = Sweep(O + d1_13 * 594.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_13_6.Hit {
                  px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_6.HitColor, 0.62 + 0.25 * k1_13_6.HitNormal.z + 0.13 * k1_13_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_13_6.Miss {
                  let k1_13_7 = Sweep(O + d1_13 * 693.0, d1_13, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_13_7.Hit {
                    px[13] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_13_7.HitColor, 0.62 + 0.25 * k1_13_7.HitNormal.z + 0.13 * k1_13_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_13_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_13_7.Miss {
                    px[13] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_13.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_14 = Normalize(F + R * (TH * -0.093750) + U * v1)
    let k1_14_0 = Sweep(O, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_14_0.Hit {
      px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_0.HitColor, 0.62 + 0.25 * k1_14_0.HitNormal.z + 0.13 * k1_14_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_14_0.Miss {
      let k1_14_1 = Sweep(O + d1_14 * 99.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_14_1.Hit {
        px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_1.HitColor, 0.62 + 0.25 * k1_14_1.HitNormal.z + 0.13 * k1_14_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_14_1.Miss {
        let k1_14_2 = Sweep(O + d1_14 * 198.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_14_2.Hit {
          px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_2.HitColor, 0.62 + 0.25 * k1_14_2.HitNormal.z + 0.13 * k1_14_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_14_2.Miss {
          let k1_14_3 = Sweep(O + d1_14 * 297.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_14_3.Hit {
            px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_3.HitColor, 0.62 + 0.25 * k1_14_3.HitNormal.z + 0.13 * k1_14_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_14_3.Miss {
            let k1_14_4 = Sweep(O + d1_14 * 396.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_14_4.Hit {
              px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_4.HitColor, 0.62 + 0.25 * k1_14_4.HitNormal.z + 0.13 * k1_14_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_14_4.Miss {
              let k1_14_5 = Sweep(O + d1_14 * 495.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_14_5.Hit {
                px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_5.HitColor, 0.62 + 0.25 * k1_14_5.HitNormal.z + 0.13 * k1_14_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_14_5.Miss {
                let k1_14_6 = Sweep(O + d1_14 * 594.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_14_6.Hit {
                  px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_6.HitColor, 0.62 + 0.25 * k1_14_6.HitNormal.z + 0.13 * k1_14_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_14_6.Miss {
                  let k1_14_7 = Sweep(O + d1_14 * 693.0, d1_14, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_14_7.Hit {
                    px[14] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_14_7.HitColor, 0.62 + 0.25 * k1_14_7.HitNormal.z + 0.13 * k1_14_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_14_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_14_7.Miss {
                    px[14] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_14.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_15 = Normalize(F + R * (TH * -0.031250) + U * v1)
    let k1_15_0 = Sweep(O, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_15_0.Hit {
      px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_0.HitColor, 0.62 + 0.25 * k1_15_0.HitNormal.z + 0.13 * k1_15_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_15_0.Miss {
      let k1_15_1 = Sweep(O + d1_15 * 99.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_15_1.Hit {
        px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_1.HitColor, 0.62 + 0.25 * k1_15_1.HitNormal.z + 0.13 * k1_15_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_15_1.Miss {
        let k1_15_2 = Sweep(O + d1_15 * 198.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_15_2.Hit {
          px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_2.HitColor, 0.62 + 0.25 * k1_15_2.HitNormal.z + 0.13 * k1_15_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_15_2.Miss {
          let k1_15_3 = Sweep(O + d1_15 * 297.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_15_3.Hit {
            px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_3.HitColor, 0.62 + 0.25 * k1_15_3.HitNormal.z + 0.13 * k1_15_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_15_3.Miss {
            let k1_15_4 = Sweep(O + d1_15 * 396.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_15_4.Hit {
              px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_4.HitColor, 0.62 + 0.25 * k1_15_4.HitNormal.z + 0.13 * k1_15_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_15_4.Miss {
              let k1_15_5 = Sweep(O + d1_15 * 495.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_15_5.Hit {
                px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_5.HitColor, 0.62 + 0.25 * k1_15_5.HitNormal.z + 0.13 * k1_15_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_15_5.Miss {
                let k1_15_6 = Sweep(O + d1_15 * 594.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_15_6.Hit {
                  px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_6.HitColor, 0.62 + 0.25 * k1_15_6.HitNormal.z + 0.13 * k1_15_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_15_6.Miss {
                  let k1_15_7 = Sweep(O + d1_15 * 693.0, d1_15, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_15_7.Hit {
                    px[15] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_15_7.HitColor, 0.62 + 0.25 * k1_15_7.HitNormal.z + 0.13 * k1_15_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_15_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_15_7.Miss {
                    px[15] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_15.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_16 = Normalize(F + R * (TH * 0.031250) + U * v1)
    let k1_16_0 = Sweep(O, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_16_0.Hit {
      px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_0.HitColor, 0.62 + 0.25 * k1_16_0.HitNormal.z + 0.13 * k1_16_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_16_0.Miss {
      let k1_16_1 = Sweep(O + d1_16 * 99.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_16_1.Hit {
        px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_1.HitColor, 0.62 + 0.25 * k1_16_1.HitNormal.z + 0.13 * k1_16_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_16_1.Miss {
        let k1_16_2 = Sweep(O + d1_16 * 198.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_16_2.Hit {
          px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_2.HitColor, 0.62 + 0.25 * k1_16_2.HitNormal.z + 0.13 * k1_16_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_16_2.Miss {
          let k1_16_3 = Sweep(O + d1_16 * 297.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_16_3.Hit {
            px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_3.HitColor, 0.62 + 0.25 * k1_16_3.HitNormal.z + 0.13 * k1_16_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_16_3.Miss {
            let k1_16_4 = Sweep(O + d1_16 * 396.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_16_4.Hit {
              px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_4.HitColor, 0.62 + 0.25 * k1_16_4.HitNormal.z + 0.13 * k1_16_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_16_4.Miss {
              let k1_16_5 = Sweep(O + d1_16 * 495.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_16_5.Hit {
                px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_5.HitColor, 0.62 + 0.25 * k1_16_5.HitNormal.z + 0.13 * k1_16_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_16_5.Miss {
                let k1_16_6 = Sweep(O + d1_16 * 594.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_16_6.Hit {
                  px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_6.HitColor, 0.62 + 0.25 * k1_16_6.HitNormal.z + 0.13 * k1_16_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_16_6.Miss {
                  let k1_16_7 = Sweep(O + d1_16 * 693.0, d1_16, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_16_7.Hit {
                    px[16] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_16_7.HitColor, 0.62 + 0.25 * k1_16_7.HitNormal.z + 0.13 * k1_16_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_16_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_16_7.Miss {
                    px[16] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_16.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_17 = Normalize(F + R * (TH * 0.093750) + U * v1)
    let k1_17_0 = Sweep(O, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_17_0.Hit {
      px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_0.HitColor, 0.62 + 0.25 * k1_17_0.HitNormal.z + 0.13 * k1_17_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_17_0.Miss {
      let k1_17_1 = Sweep(O + d1_17 * 99.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_17_1.Hit {
        px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_1.HitColor, 0.62 + 0.25 * k1_17_1.HitNormal.z + 0.13 * k1_17_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_17_1.Miss {
        let k1_17_2 = Sweep(O + d1_17 * 198.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_17_2.Hit {
          px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_2.HitColor, 0.62 + 0.25 * k1_17_2.HitNormal.z + 0.13 * k1_17_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_17_2.Miss {
          let k1_17_3 = Sweep(O + d1_17 * 297.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_17_3.Hit {
            px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_3.HitColor, 0.62 + 0.25 * k1_17_3.HitNormal.z + 0.13 * k1_17_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_17_3.Miss {
            let k1_17_4 = Sweep(O + d1_17 * 396.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_17_4.Hit {
              px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_4.HitColor, 0.62 + 0.25 * k1_17_4.HitNormal.z + 0.13 * k1_17_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_17_4.Miss {
              let k1_17_5 = Sweep(O + d1_17 * 495.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_17_5.Hit {
                px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_5.HitColor, 0.62 + 0.25 * k1_17_5.HitNormal.z + 0.13 * k1_17_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_17_5.Miss {
                let k1_17_6 = Sweep(O + d1_17 * 594.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_17_6.Hit {
                  px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_6.HitColor, 0.62 + 0.25 * k1_17_6.HitNormal.z + 0.13 * k1_17_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_17_6.Miss {
                  let k1_17_7 = Sweep(O + d1_17 * 693.0, d1_17, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_17_7.Hit {
                    px[17] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_17_7.HitColor, 0.62 + 0.25 * k1_17_7.HitNormal.z + 0.13 * k1_17_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_17_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_17_7.Miss {
                    px[17] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_17.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_18 = Normalize(F + R * (TH * 0.156250) + U * v1)
    let k1_18_0 = Sweep(O, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_18_0.Hit {
      px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_0.HitColor, 0.62 + 0.25 * k1_18_0.HitNormal.z + 0.13 * k1_18_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_18_0.Miss {
      let k1_18_1 = Sweep(O + d1_18 * 99.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_18_1.Hit {
        px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_1.HitColor, 0.62 + 0.25 * k1_18_1.HitNormal.z + 0.13 * k1_18_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_18_1.Miss {
        let k1_18_2 = Sweep(O + d1_18 * 198.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_18_2.Hit {
          px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_2.HitColor, 0.62 + 0.25 * k1_18_2.HitNormal.z + 0.13 * k1_18_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_18_2.Miss {
          let k1_18_3 = Sweep(O + d1_18 * 297.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_18_3.Hit {
            px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_3.HitColor, 0.62 + 0.25 * k1_18_3.HitNormal.z + 0.13 * k1_18_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_18_3.Miss {
            let k1_18_4 = Sweep(O + d1_18 * 396.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_18_4.Hit {
              px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_4.HitColor, 0.62 + 0.25 * k1_18_4.HitNormal.z + 0.13 * k1_18_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_18_4.Miss {
              let k1_18_5 = Sweep(O + d1_18 * 495.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_18_5.Hit {
                px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_5.HitColor, 0.62 + 0.25 * k1_18_5.HitNormal.z + 0.13 * k1_18_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_18_5.Miss {
                let k1_18_6 = Sweep(O + d1_18 * 594.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_18_6.Hit {
                  px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_6.HitColor, 0.62 + 0.25 * k1_18_6.HitNormal.z + 0.13 * k1_18_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_18_6.Miss {
                  let k1_18_7 = Sweep(O + d1_18 * 693.0, d1_18, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_18_7.Hit {
                    px[18] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_18_7.HitColor, 0.62 + 0.25 * k1_18_7.HitNormal.z + 0.13 * k1_18_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_18_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_18_7.Miss {
                    px[18] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_18.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_19 = Normalize(F + R * (TH * 0.218750) + U * v1)
    let k1_19_0 = Sweep(O, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_19_0.Hit {
      px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_0.HitColor, 0.62 + 0.25 * k1_19_0.HitNormal.z + 0.13 * k1_19_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_19_0.Miss {
      let k1_19_1 = Sweep(O + d1_19 * 99.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_19_1.Hit {
        px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_1.HitColor, 0.62 + 0.25 * k1_19_1.HitNormal.z + 0.13 * k1_19_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_19_1.Miss {
        let k1_19_2 = Sweep(O + d1_19 * 198.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_19_2.Hit {
          px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_2.HitColor, 0.62 + 0.25 * k1_19_2.HitNormal.z + 0.13 * k1_19_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_19_2.Miss {
          let k1_19_3 = Sweep(O + d1_19 * 297.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_19_3.Hit {
            px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_3.HitColor, 0.62 + 0.25 * k1_19_3.HitNormal.z + 0.13 * k1_19_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_19_3.Miss {
            let k1_19_4 = Sweep(O + d1_19 * 396.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_19_4.Hit {
              px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_4.HitColor, 0.62 + 0.25 * k1_19_4.HitNormal.z + 0.13 * k1_19_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_19_4.Miss {
              let k1_19_5 = Sweep(O + d1_19 * 495.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_19_5.Hit {
                px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_5.HitColor, 0.62 + 0.25 * k1_19_5.HitNormal.z + 0.13 * k1_19_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_19_5.Miss {
                let k1_19_6 = Sweep(O + d1_19 * 594.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_19_6.Hit {
                  px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_6.HitColor, 0.62 + 0.25 * k1_19_6.HitNormal.z + 0.13 * k1_19_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_19_6.Miss {
                  let k1_19_7 = Sweep(O + d1_19 * 693.0, d1_19, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_19_7.Hit {
                    px[19] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_19_7.HitColor, 0.62 + 0.25 * k1_19_7.HitNormal.z + 0.13 * k1_19_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_19_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_19_7.Miss {
                    px[19] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_19.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_20 = Normalize(F + R * (TH * 0.281250) + U * v1)
    let k1_20_0 = Sweep(O, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_20_0.Hit {
      px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_0.HitColor, 0.62 + 0.25 * k1_20_0.HitNormal.z + 0.13 * k1_20_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_20_0.Miss {
      let k1_20_1 = Sweep(O + d1_20 * 99.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_20_1.Hit {
        px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_1.HitColor, 0.62 + 0.25 * k1_20_1.HitNormal.z + 0.13 * k1_20_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_20_1.Miss {
        let k1_20_2 = Sweep(O + d1_20 * 198.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_20_2.Hit {
          px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_2.HitColor, 0.62 + 0.25 * k1_20_2.HitNormal.z + 0.13 * k1_20_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_20_2.Miss {
          let k1_20_3 = Sweep(O + d1_20 * 297.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_20_3.Hit {
            px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_3.HitColor, 0.62 + 0.25 * k1_20_3.HitNormal.z + 0.13 * k1_20_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_20_3.Miss {
            let k1_20_4 = Sweep(O + d1_20 * 396.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_20_4.Hit {
              px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_4.HitColor, 0.62 + 0.25 * k1_20_4.HitNormal.z + 0.13 * k1_20_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_20_4.Miss {
              let k1_20_5 = Sweep(O + d1_20 * 495.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_20_5.Hit {
                px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_5.HitColor, 0.62 + 0.25 * k1_20_5.HitNormal.z + 0.13 * k1_20_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_20_5.Miss {
                let k1_20_6 = Sweep(O + d1_20 * 594.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_20_6.Hit {
                  px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_6.HitColor, 0.62 + 0.25 * k1_20_6.HitNormal.z + 0.13 * k1_20_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_20_6.Miss {
                  let k1_20_7 = Sweep(O + d1_20 * 693.0, d1_20, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_20_7.Hit {
                    px[20] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_20_7.HitColor, 0.62 + 0.25 * k1_20_7.HitNormal.z + 0.13 * k1_20_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_20_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_20_7.Miss {
                    px[20] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_20.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_21 = Normalize(F + R * (TH * 0.343750) + U * v1)
    let k1_21_0 = Sweep(O, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_21_0.Hit {
      px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_0.HitColor, 0.62 + 0.25 * k1_21_0.HitNormal.z + 0.13 * k1_21_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_21_0.Miss {
      let k1_21_1 = Sweep(O + d1_21 * 99.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_21_1.Hit {
        px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_1.HitColor, 0.62 + 0.25 * k1_21_1.HitNormal.z + 0.13 * k1_21_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_21_1.Miss {
        let k1_21_2 = Sweep(O + d1_21 * 198.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_21_2.Hit {
          px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_2.HitColor, 0.62 + 0.25 * k1_21_2.HitNormal.z + 0.13 * k1_21_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_21_2.Miss {
          let k1_21_3 = Sweep(O + d1_21 * 297.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_21_3.Hit {
            px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_3.HitColor, 0.62 + 0.25 * k1_21_3.HitNormal.z + 0.13 * k1_21_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_21_3.Miss {
            let k1_21_4 = Sweep(O + d1_21 * 396.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_21_4.Hit {
              px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_4.HitColor, 0.62 + 0.25 * k1_21_4.HitNormal.z + 0.13 * k1_21_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_21_4.Miss {
              let k1_21_5 = Sweep(O + d1_21 * 495.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_21_5.Hit {
                px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_5.HitColor, 0.62 + 0.25 * k1_21_5.HitNormal.z + 0.13 * k1_21_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_21_5.Miss {
                let k1_21_6 = Sweep(O + d1_21 * 594.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_21_6.Hit {
                  px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_6.HitColor, 0.62 + 0.25 * k1_21_6.HitNormal.z + 0.13 * k1_21_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_21_6.Miss {
                  let k1_21_7 = Sweep(O + d1_21 * 693.0, d1_21, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_21_7.Hit {
                    px[21] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_21_7.HitColor, 0.62 + 0.25 * k1_21_7.HitNormal.z + 0.13 * k1_21_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_21_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_21_7.Miss {
                    px[21] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_21.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_22 = Normalize(F + R * (TH * 0.406250) + U * v1)
    let k1_22_0 = Sweep(O, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_22_0.Hit {
      px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_0.HitColor, 0.62 + 0.25 * k1_22_0.HitNormal.z + 0.13 * k1_22_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_22_0.Miss {
      let k1_22_1 = Sweep(O + d1_22 * 99.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_22_1.Hit {
        px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_1.HitColor, 0.62 + 0.25 * k1_22_1.HitNormal.z + 0.13 * k1_22_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_22_1.Miss {
        let k1_22_2 = Sweep(O + d1_22 * 198.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_22_2.Hit {
          px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_2.HitColor, 0.62 + 0.25 * k1_22_2.HitNormal.z + 0.13 * k1_22_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_22_2.Miss {
          let k1_22_3 = Sweep(O + d1_22 * 297.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_22_3.Hit {
            px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_3.HitColor, 0.62 + 0.25 * k1_22_3.HitNormal.z + 0.13 * k1_22_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_22_3.Miss {
            let k1_22_4 = Sweep(O + d1_22 * 396.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_22_4.Hit {
              px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_4.HitColor, 0.62 + 0.25 * k1_22_4.HitNormal.z + 0.13 * k1_22_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_22_4.Miss {
              let k1_22_5 = Sweep(O + d1_22 * 495.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_22_5.Hit {
                px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_5.HitColor, 0.62 + 0.25 * k1_22_5.HitNormal.z + 0.13 * k1_22_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_22_5.Miss {
                let k1_22_6 = Sweep(O + d1_22 * 594.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_22_6.Hit {
                  px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_6.HitColor, 0.62 + 0.25 * k1_22_6.HitNormal.z + 0.13 * k1_22_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_22_6.Miss {
                  let k1_22_7 = Sweep(O + d1_22 * 693.0, d1_22, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_22_7.Hit {
                    px[22] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_22_7.HitColor, 0.62 + 0.25 * k1_22_7.HitNormal.z + 0.13 * k1_22_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_22_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_22_7.Miss {
                    px[22] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_22.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_23 = Normalize(F + R * (TH * 0.468750) + U * v1)
    let k1_23_0 = Sweep(O, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_23_0.Hit {
      px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_0.HitColor, 0.62 + 0.25 * k1_23_0.HitNormal.z + 0.13 * k1_23_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_23_0.Miss {
      let k1_23_1 = Sweep(O + d1_23 * 99.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_23_1.Hit {
        px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_1.HitColor, 0.62 + 0.25 * k1_23_1.HitNormal.z + 0.13 * k1_23_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_23_1.Miss {
        let k1_23_2 = Sweep(O + d1_23 * 198.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_23_2.Hit {
          px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_2.HitColor, 0.62 + 0.25 * k1_23_2.HitNormal.z + 0.13 * k1_23_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_23_2.Miss {
          let k1_23_3 = Sweep(O + d1_23 * 297.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_23_3.Hit {
            px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_3.HitColor, 0.62 + 0.25 * k1_23_3.HitNormal.z + 0.13 * k1_23_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_23_3.Miss {
            let k1_23_4 = Sweep(O + d1_23 * 396.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_23_4.Hit {
              px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_4.HitColor, 0.62 + 0.25 * k1_23_4.HitNormal.z + 0.13 * k1_23_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_23_4.Miss {
              let k1_23_5 = Sweep(O + d1_23 * 495.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_23_5.Hit {
                px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_5.HitColor, 0.62 + 0.25 * k1_23_5.HitNormal.z + 0.13 * k1_23_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_23_5.Miss {
                let k1_23_6 = Sweep(O + d1_23 * 594.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_23_6.Hit {
                  px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_6.HitColor, 0.62 + 0.25 * k1_23_6.HitNormal.z + 0.13 * k1_23_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_23_6.Miss {
                  let k1_23_7 = Sweep(O + d1_23 * 693.0, d1_23, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_23_7.Hit {
                    px[23] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_23_7.HitColor, 0.62 + 0.25 * k1_23_7.HitNormal.z + 0.13 * k1_23_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_23_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_23_7.Miss {
                    px[23] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_23.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_24 = Normalize(F + R * (TH * 0.531250) + U * v1)
    let k1_24_0 = Sweep(O, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_24_0.Hit {
      px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_0.HitColor, 0.62 + 0.25 * k1_24_0.HitNormal.z + 0.13 * k1_24_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_24_0.Miss {
      let k1_24_1 = Sweep(O + d1_24 * 99.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_24_1.Hit {
        px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_1.HitColor, 0.62 + 0.25 * k1_24_1.HitNormal.z + 0.13 * k1_24_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_24_1.Miss {
        let k1_24_2 = Sweep(O + d1_24 * 198.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_24_2.Hit {
          px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_2.HitColor, 0.62 + 0.25 * k1_24_2.HitNormal.z + 0.13 * k1_24_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_24_2.Miss {
          let k1_24_3 = Sweep(O + d1_24 * 297.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_24_3.Hit {
            px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_3.HitColor, 0.62 + 0.25 * k1_24_3.HitNormal.z + 0.13 * k1_24_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_24_3.Miss {
            let k1_24_4 = Sweep(O + d1_24 * 396.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_24_4.Hit {
              px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_4.HitColor, 0.62 + 0.25 * k1_24_4.HitNormal.z + 0.13 * k1_24_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_24_4.Miss {
              let k1_24_5 = Sweep(O + d1_24 * 495.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_24_5.Hit {
                px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_5.HitColor, 0.62 + 0.25 * k1_24_5.HitNormal.z + 0.13 * k1_24_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_24_5.Miss {
                let k1_24_6 = Sweep(O + d1_24 * 594.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_24_6.Hit {
                  px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_6.HitColor, 0.62 + 0.25 * k1_24_6.HitNormal.z + 0.13 * k1_24_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_24_6.Miss {
                  let k1_24_7 = Sweep(O + d1_24 * 693.0, d1_24, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_24_7.Hit {
                    px[24] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_24_7.HitColor, 0.62 + 0.25 * k1_24_7.HitNormal.z + 0.13 * k1_24_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_24_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_24_7.Miss {
                    px[24] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_24.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_25 = Normalize(F + R * (TH * 0.593750) + U * v1)
    let k1_25_0 = Sweep(O, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_25_0.Hit {
      px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_0.HitColor, 0.62 + 0.25 * k1_25_0.HitNormal.z + 0.13 * k1_25_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_25_0.Miss {
      let k1_25_1 = Sweep(O + d1_25 * 99.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_25_1.Hit {
        px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_1.HitColor, 0.62 + 0.25 * k1_25_1.HitNormal.z + 0.13 * k1_25_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_25_1.Miss {
        let k1_25_2 = Sweep(O + d1_25 * 198.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_25_2.Hit {
          px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_2.HitColor, 0.62 + 0.25 * k1_25_2.HitNormal.z + 0.13 * k1_25_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_25_2.Miss {
          let k1_25_3 = Sweep(O + d1_25 * 297.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_25_3.Hit {
            px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_3.HitColor, 0.62 + 0.25 * k1_25_3.HitNormal.z + 0.13 * k1_25_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_25_3.Miss {
            let k1_25_4 = Sweep(O + d1_25 * 396.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_25_4.Hit {
              px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_4.HitColor, 0.62 + 0.25 * k1_25_4.HitNormal.z + 0.13 * k1_25_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_25_4.Miss {
              let k1_25_5 = Sweep(O + d1_25 * 495.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_25_5.Hit {
                px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_5.HitColor, 0.62 + 0.25 * k1_25_5.HitNormal.z + 0.13 * k1_25_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_25_5.Miss {
                let k1_25_6 = Sweep(O + d1_25 * 594.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_25_6.Hit {
                  px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_6.HitColor, 0.62 + 0.25 * k1_25_6.HitNormal.z + 0.13 * k1_25_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_25_6.Miss {
                  let k1_25_7 = Sweep(O + d1_25 * 693.0, d1_25, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_25_7.Hit {
                    px[25] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_25_7.HitColor, 0.62 + 0.25 * k1_25_7.HitNormal.z + 0.13 * k1_25_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_25_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_25_7.Miss {
                    px[25] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_25.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_26 = Normalize(F + R * (TH * 0.656250) + U * v1)
    let k1_26_0 = Sweep(O, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_26_0.Hit {
      px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_0.HitColor, 0.62 + 0.25 * k1_26_0.HitNormal.z + 0.13 * k1_26_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_26_0.Miss {
      let k1_26_1 = Sweep(O + d1_26 * 99.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_26_1.Hit {
        px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_1.HitColor, 0.62 + 0.25 * k1_26_1.HitNormal.z + 0.13 * k1_26_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_26_1.Miss {
        let k1_26_2 = Sweep(O + d1_26 * 198.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_26_2.Hit {
          px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_2.HitColor, 0.62 + 0.25 * k1_26_2.HitNormal.z + 0.13 * k1_26_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_26_2.Miss {
          let k1_26_3 = Sweep(O + d1_26 * 297.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_26_3.Hit {
            px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_3.HitColor, 0.62 + 0.25 * k1_26_3.HitNormal.z + 0.13 * k1_26_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_26_3.Miss {
            let k1_26_4 = Sweep(O + d1_26 * 396.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_26_4.Hit {
              px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_4.HitColor, 0.62 + 0.25 * k1_26_4.HitNormal.z + 0.13 * k1_26_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_26_4.Miss {
              let k1_26_5 = Sweep(O + d1_26 * 495.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_26_5.Hit {
                px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_5.HitColor, 0.62 + 0.25 * k1_26_5.HitNormal.z + 0.13 * k1_26_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_26_5.Miss {
                let k1_26_6 = Sweep(O + d1_26 * 594.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_26_6.Hit {
                  px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_6.HitColor, 0.62 + 0.25 * k1_26_6.HitNormal.z + 0.13 * k1_26_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_26_6.Miss {
                  let k1_26_7 = Sweep(O + d1_26 * 693.0, d1_26, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_26_7.Hit {
                    px[26] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_26_7.HitColor, 0.62 + 0.25 * k1_26_7.HitNormal.z + 0.13 * k1_26_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_26_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_26_7.Miss {
                    px[26] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_26.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_27 = Normalize(F + R * (TH * 0.718750) + U * v1)
    let k1_27_0 = Sweep(O, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_27_0.Hit {
      px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_0.HitColor, 0.62 + 0.25 * k1_27_0.HitNormal.z + 0.13 * k1_27_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_27_0.Miss {
      let k1_27_1 = Sweep(O + d1_27 * 99.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_27_1.Hit {
        px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_1.HitColor, 0.62 + 0.25 * k1_27_1.HitNormal.z + 0.13 * k1_27_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_27_1.Miss {
        let k1_27_2 = Sweep(O + d1_27 * 198.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_27_2.Hit {
          px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_2.HitColor, 0.62 + 0.25 * k1_27_2.HitNormal.z + 0.13 * k1_27_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_27_2.Miss {
          let k1_27_3 = Sweep(O + d1_27 * 297.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_27_3.Hit {
            px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_3.HitColor, 0.62 + 0.25 * k1_27_3.HitNormal.z + 0.13 * k1_27_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_27_3.Miss {
            let k1_27_4 = Sweep(O + d1_27 * 396.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_27_4.Hit {
              px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_4.HitColor, 0.62 + 0.25 * k1_27_4.HitNormal.z + 0.13 * k1_27_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_27_4.Miss {
              let k1_27_5 = Sweep(O + d1_27 * 495.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_27_5.Hit {
                px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_5.HitColor, 0.62 + 0.25 * k1_27_5.HitNormal.z + 0.13 * k1_27_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_27_5.Miss {
                let k1_27_6 = Sweep(O + d1_27 * 594.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_27_6.Hit {
                  px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_6.HitColor, 0.62 + 0.25 * k1_27_6.HitNormal.z + 0.13 * k1_27_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_27_6.Miss {
                  let k1_27_7 = Sweep(O + d1_27 * 693.0, d1_27, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_27_7.Hit {
                    px[27] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_27_7.HitColor, 0.62 + 0.25 * k1_27_7.HitNormal.z + 0.13 * k1_27_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_27_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_27_7.Miss {
                    px[27] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_27.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_28 = Normalize(F + R * (TH * 0.781250) + U * v1)
    let k1_28_0 = Sweep(O, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_28_0.Hit {
      px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_0.HitColor, 0.62 + 0.25 * k1_28_0.HitNormal.z + 0.13 * k1_28_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_28_0.Miss {
      let k1_28_1 = Sweep(O + d1_28 * 99.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_28_1.Hit {
        px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_1.HitColor, 0.62 + 0.25 * k1_28_1.HitNormal.z + 0.13 * k1_28_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_28_1.Miss {
        let k1_28_2 = Sweep(O + d1_28 * 198.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_28_2.Hit {
          px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_2.HitColor, 0.62 + 0.25 * k1_28_2.HitNormal.z + 0.13 * k1_28_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_28_2.Miss {
          let k1_28_3 = Sweep(O + d1_28 * 297.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_28_3.Hit {
            px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_3.HitColor, 0.62 + 0.25 * k1_28_3.HitNormal.z + 0.13 * k1_28_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_28_3.Miss {
            let k1_28_4 = Sweep(O + d1_28 * 396.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_28_4.Hit {
              px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_4.HitColor, 0.62 + 0.25 * k1_28_4.HitNormal.z + 0.13 * k1_28_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_28_4.Miss {
              let k1_28_5 = Sweep(O + d1_28 * 495.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_28_5.Hit {
                px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_5.HitColor, 0.62 + 0.25 * k1_28_5.HitNormal.z + 0.13 * k1_28_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_28_5.Miss {
                let k1_28_6 = Sweep(O + d1_28 * 594.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_28_6.Hit {
                  px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_6.HitColor, 0.62 + 0.25 * k1_28_6.HitNormal.z + 0.13 * k1_28_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_28_6.Miss {
                  let k1_28_7 = Sweep(O + d1_28 * 693.0, d1_28, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_28_7.Hit {
                    px[28] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_28_7.HitColor, 0.62 + 0.25 * k1_28_7.HitNormal.z + 0.13 * k1_28_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_28_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_28_7.Miss {
                    px[28] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_28.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_29 = Normalize(F + R * (TH * 0.843750) + U * v1)
    let k1_29_0 = Sweep(O, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_29_0.Hit {
      px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_0.HitColor, 0.62 + 0.25 * k1_29_0.HitNormal.z + 0.13 * k1_29_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_29_0.Miss {
      let k1_29_1 = Sweep(O + d1_29 * 99.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_29_1.Hit {
        px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_1.HitColor, 0.62 + 0.25 * k1_29_1.HitNormal.z + 0.13 * k1_29_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_29_1.Miss {
        let k1_29_2 = Sweep(O + d1_29 * 198.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_29_2.Hit {
          px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_2.HitColor, 0.62 + 0.25 * k1_29_2.HitNormal.z + 0.13 * k1_29_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_29_2.Miss {
          let k1_29_3 = Sweep(O + d1_29 * 297.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_29_3.Hit {
            px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_3.HitColor, 0.62 + 0.25 * k1_29_3.HitNormal.z + 0.13 * k1_29_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_29_3.Miss {
            let k1_29_4 = Sweep(O + d1_29 * 396.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_29_4.Hit {
              px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_4.HitColor, 0.62 + 0.25 * k1_29_4.HitNormal.z + 0.13 * k1_29_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_29_4.Miss {
              let k1_29_5 = Sweep(O + d1_29 * 495.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_29_5.Hit {
                px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_5.HitColor, 0.62 + 0.25 * k1_29_5.HitNormal.z + 0.13 * k1_29_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_29_5.Miss {
                let k1_29_6 = Sweep(O + d1_29 * 594.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_29_6.Hit {
                  px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_6.HitColor, 0.62 + 0.25 * k1_29_6.HitNormal.z + 0.13 * k1_29_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_29_6.Miss {
                  let k1_29_7 = Sweep(O + d1_29 * 693.0, d1_29, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_29_7.Hit {
                    px[29] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_29_7.HitColor, 0.62 + 0.25 * k1_29_7.HitNormal.z + 0.13 * k1_29_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_29_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_29_7.Miss {
                    px[29] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_29.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_30 = Normalize(F + R * (TH * 0.906250) + U * v1)
    let k1_30_0 = Sweep(O, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_30_0.Hit {
      px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_0.HitColor, 0.62 + 0.25 * k1_30_0.HitNormal.z + 0.13 * k1_30_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_30_0.Miss {
      let k1_30_1 = Sweep(O + d1_30 * 99.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_30_1.Hit {
        px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_1.HitColor, 0.62 + 0.25 * k1_30_1.HitNormal.z + 0.13 * k1_30_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_30_1.Miss {
        let k1_30_2 = Sweep(O + d1_30 * 198.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_30_2.Hit {
          px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_2.HitColor, 0.62 + 0.25 * k1_30_2.HitNormal.z + 0.13 * k1_30_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_30_2.Miss {
          let k1_30_3 = Sweep(O + d1_30 * 297.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_30_3.Hit {
            px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_3.HitColor, 0.62 + 0.25 * k1_30_3.HitNormal.z + 0.13 * k1_30_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_30_3.Miss {
            let k1_30_4 = Sweep(O + d1_30 * 396.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_30_4.Hit {
              px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_4.HitColor, 0.62 + 0.25 * k1_30_4.HitNormal.z + 0.13 * k1_30_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_30_4.Miss {
              let k1_30_5 = Sweep(O + d1_30 * 495.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_30_5.Hit {
                px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_5.HitColor, 0.62 + 0.25 * k1_30_5.HitNormal.z + 0.13 * k1_30_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_30_5.Miss {
                let k1_30_6 = Sweep(O + d1_30 * 594.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_30_6.Hit {
                  px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_6.HitColor, 0.62 + 0.25 * k1_30_6.HitNormal.z + 0.13 * k1_30_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_30_6.Miss {
                  let k1_30_7 = Sweep(O + d1_30 * 693.0, d1_30, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_30_7.Hit {
                    px[30] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_30_7.HitColor, 0.62 + 0.25 * k1_30_7.HitNormal.z + 0.13 * k1_30_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_30_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_30_7.Miss {
                    px[30] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_30.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let d1_31 = Normalize(F + R * (TH * 0.968750) + U * v1)
    let k1_31_0 = Sweep(O, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
    on k1_31_0.Hit {
      px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_0.HitColor, 0.62 + 0.25 * k1_31_0.HitNormal.z + 0.13 * k1_31_0.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_0.HitDistance + 0.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
    }
    on k1_31_0.Miss {
      let k1_31_1 = Sweep(O + d1_31 * 99.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
      on k1_31_1.Hit {
        px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_1.HitColor, 0.62 + 0.25 * k1_31_1.HitNormal.z + 0.13 * k1_31_1.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_1.HitDistance + 99.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
      }
      on k1_31_1.Miss {
        let k1_31_2 = Sweep(O + d1_31 * 198.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
        on k1_31_2.Hit {
          px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_2.HitColor, 0.62 + 0.25 * k1_31_2.HitNormal.z + 0.13 * k1_31_2.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_2.HitDistance + 198.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
        }
        on k1_31_2.Miss {
          let k1_31_3 = Sweep(O + d1_31 * 297.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
          on k1_31_3.Hit {
            px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_3.HitColor, 0.62 + 0.25 * k1_31_3.HitNormal.z + 0.13 * k1_31_3.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_3.HitDistance + 297.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
          }
          on k1_31_3.Miss {
            let k1_31_4 = Sweep(O + d1_31 * 396.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
            on k1_31_4.Hit {
              px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_4.HitColor, 0.62 + 0.25 * k1_31_4.HitNormal.z + 0.13 * k1_31_4.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_4.HitDistance + 396.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
            }
            on k1_31_4.Miss {
              let k1_31_5 = Sweep(O + d1_31 * 495.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
              on k1_31_5.Hit {
                px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_5.HitColor, 0.62 + 0.25 * k1_31_5.HitNormal.z + 0.13 * k1_31_5.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_5.HitDistance + 495.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
              }
              on k1_31_5.Miss {
                let k1_31_6 = Sweep(O + d1_31 * 594.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                on k1_31_6.Hit {
                  px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_6.HitColor, 0.62 + 0.25 * k1_31_6.HitNormal.z + 0.13 * k1_31_6.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_6.HitDistance + 594.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                }
                on k1_31_6.Miss {
                  let k1_31_7 = Sweep(O + d1_31 * 693.0, d1_31, 100.0, detectBricks = true, detectMap = true, detectPlayers1 = true, detectPlayers2 = true, detectPlayers3 = true, detectPlayers4 = true, ignoreOwningGrid = false)
                  on k1_31_7.Hit {
                    px[31] = ColorBlend(ColorBlend(Color(0.0, 0.0, 0.0), k1_31_7.HitColor, 0.62 + 0.25 * k1_31_7.HitNormal.z + 0.13 * k1_31_7.HitNormal.x), Color(0.62, 0.75, 0.9), min((k1_31_7.HitDistance + 693.0) / 800.0, 1.0) * 0.45).ToHex().Substring(0, 6)
                  }
                  on k1_31_7.Miss {
                    px[31] = ColorBlend(Color(0.7, 0.8, 0.92), Color(0.25, 0.45, 0.85), clamp(d1_31.z, 0.0, 1.0)).ToHex().Substring(0, 6)
                  }
                }
              }
            }
          }
        }
      }
    }
    let row1 = rowStr()
    let t = row0 .. "\n" .. row1
    if rw == 0 {
      s0 = t
    } else if rw == 1 {
      s1 = t
    } else if rw == 2 {
      s2 = t
    } else if rw == 3 {
      s3 = t
    } else if rw == 4 {
      s4 = t
    } else if rw == 5 {
      s5 = t
    } else if rw == 6 {
      s6 = t
    } else if rw == 7 {
      s7 = t
    } else if rw == 8 {
      s8 = t
    }
    rr = if rw + 1 >= 9 then 0 else rw + 1
  }
}
