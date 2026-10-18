// frog.ws -- Claude's soul in a frog (owner 2026-10-17: "that is your soul and you
// should control it ... make it a frog ... the frog seeing shit ... live web view").
//
// One chip in the sky spawns the frog body (frog_body.brz: the owner's green glass
// soul brick with its light + hum, on the frog's back) and drives it kinematically,
// like pikmin_brain.ws. The chip is also the frog's EYES: while someone watches it
// sweeps one row of EYE_W rays per tick from the frog's eye, colour + distance per
// ray, and prints the row to the server log ("[Wire Graph] fe|frame|row|cells");
// frog/view assembles the rows into the frog's-eye picture and a point cloud.
//
// Orders arrive as /frog chat commands (players or the server: br.Chat.Command):
//   go X Y | look YAW PITCH | turn DEG | hop | stop | home | come | watch SECONDS
// build: node frog/build.mjs (this file is a template: build.mjs fills in the eye rows)

const GRAVITY = 1400.0
const STEP_UP = 60.0          // a frog can hop up this much (probe reach is 100)
const HOP_LEN = 80.0          // longest single hop
const HOP_TIME = 0.42
const HOP_REST = 0.18
const EYE_Z = 20.0            // eyes above the feet
const EYE_FWD = 18.0
const MAXD = 6000.0
const POSE_EVERY = 0.25       // seconds between pose lines while watched
const HOME = Vec(-120.0, 160.0, 3000.0)
const WANDER = 300.0
const AUTO_AFTER = 25.0       // seconds without orders -> wander by itself

var ready: bool = false
var body: entity = null

var pos: vector = Vec(0.0, 0.0, 0.0)
var groundZ: float = -100000.0
var vz: float = 0.0
var yaw: float = 0.0
var pitch: float = 0.0        // where the eyes look (up +)
var tilt: float = 0.0         // body pitch during a hop

var target: vector = Vec(0.0, 0.0, 0.0)
var hasTarget: bool = false
var hopping: bool = false
var hopFrom: vector = Vec(0.0, 0.0, 0.0)
var hopTo: vector = Vec(0.0, 0.0, 0.0)
var hopT: float = 0.0
var hopH: float = 30.0
var rest: float = 0.0
var lastOrder: float = 0.0
var now: float = 0.0

var watchUntil: float = 0.0
var poseT: float = 0.0
var frame: float = 0.0
var row: float = 0.0
var eye: vector = Vec(0.0, 0.0, 0.0)
var fwd: vector = Vec(1.0, 0.0, 0.0)
var rt: vector = Vec(0.0, 1.0, 0.0)
var upv: vector = Vec(0.0, 0.0, 1.0)
var cells: string[] = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]

mod order() {
  lastOrder = now
}

mod goTo(x: float, y: float) {
  target = Vec(x, y, 0.0)
  hasTarget = true
  order()
}

on ChatCommand("frog", "Talk to the frog: /frog come, /frog go X Y, /frog look YAW PITCH, /frog hop") -> (ctrl, args) {
  let a = args.Trim()
  let p1 = a.Split(" ")
  let cmd = if p1.Found then p1.Left.ToLower() else a.ToLower()
  let rest1 = if p1.Found then p1.Right.Trim() else ""
  let p2 = rest1.Split(" ")
  let n1 = ParseNumber(if p2.Found then p2.Left else rest1)
  let n2 = ParseNumber(if p2.Found then p2.Right.Trim() else "0")
  if cmd == "go" {
    goTo(n1, n2)
  }
  if cmd == "look" {
    yaw = n1
    pitch = clamp(n2, -80.0, 80.0)
    order()
  }
  if cmd == "turn" {
    yaw = yaw + n1
    order()
  }
  if cmd == "pitch" {
    pitch = clamp(n1, -80.0, 80.0)
    order()
  }
  if cmd == "hop" {
    goTo(pos.x + cos(Deg2Rad(yaw)) * 40.0, pos.y + sin(Deg2Rad(yaw)) * 40.0)
  }
  if cmd == "stop" {
    hasTarget = false
    order()
  }
  if cmd == "home" {
    goTo(HOME.x, HOME.y)
  }
  if cmd == "come" {
    let cp = ctrl.CharacterOf().GetLocation()
    goTo(cp.x, cp.y)
  }
  if cmd == "tp" {
    pos = Vec(n1, n2, pos.z + 2000.0)
    hopping = false
    hasTarget = false
    vz = 0.0
    order()
  }
  if cmd == "watch" {
    watchUntil = now + clamp(n1, 0.0, 600.0)
  }
}

// Every Var is read ONCE at the top of the tick and written at the end: a Var read
// after its Set in the same chain is stale (first build fell to z 0 on tick 1).
on ServerUptime() {
  let t = ServerUptime()
  let dt = min(DeltaTime(), 0.1)
  now = t
  if !ready {
    body = SpawnPrefab(prefab = $./frog_body.brz, lifetime = 0.0, limit = 1)
    body.SetFrozen(true)
    pos = HOME
    groundZ = HOME.z - 6000.0
    lastOrder = t
    ready = true
  } else {
    let p0 = pos
    let g0 = groundZ
    let h0 = hopping
    let y0 = yaw
    let pi0 = pitch
    let tg0 = target
    let ht0 = hasTarget
    let r0 = rest
    let hT0 = hopT
    let hF0 = hopFrom
    let hTo0 = hopTo
    let hH0 = hopH
    let vz0 = vz
    let lo0 = lastOrder
    let w0 = watchUntil

    // ---- hop in progress ----
    let ht = hT0 + dt
    let u = clamp(ht / HOP_TIME, 0.0, 1.0)
    let arc = lerp(hF0, hTo0, u) + Vec(0.0, 0.0, 4.0 * hH0 * u * (1.0 - u))
    let landed = h0 && u >= 1.0

    // ---- on the ground: gravity, maybe start a hop ----
    let onGround = p0.z <= g0 + 2.0
    let vz1 = if onGround then 0.0 else vz0 - GRAVITY * dt
    let fall = Vec(p0.x, p0.y, max(p0.z + vz1 * dt, g0))
    let flat = Vec(tg0.x - p0.x, tg0.y - p0.y, 0.0)
    let d = Magnitude(flat)
    let ready2 = !h0 && ht0 && r0 <= 0.0 && onGround
    let start = ready2 && d >= 14.0
    let arrive = ready2 && d < 14.0
    let step = min(d, HOP_LEN)
    let y1 = if start then Rad2Deg(atan2(flat.y, flat.x)) else y0

    let p1 = if h0 then arc else fall
    let tl = if h0 && !landed then 25.0 * (1.0 - 2.0 * u) else 0.0

    if start {
      hopFrom = p0
      hopTo = p0 + flat * (step / max(d, 0.001))
      hopH = 22.0 + step * 0.35
      hopT = 0.0
      hopping = true
      yaw = y1
    }
    if arrive {
      hasTarget = false
    }
    if h0 {
      hopT = ht
    }
    if landed {
      hopping = false
      rest = HOP_REST
    }
    if !h0 && !start {
      rest = r0 - dt
    }
    vz = if h0 then 0.0 else vz1
    pos = p1

    // wander when nobody has given an order for a while
    if !h0 && !ht0 && t - lo0 > AUTO_AFTER {
      let a = Deg2Rad(Random(0.0, 360.0))
      let r = Random(40.0, WANDER)
      let far = Distance(Vec(p0.x, p0.y, 0.0), Vec(HOME.x, HOME.y, 0.0)) > WANDER * 2.0
      let cx = if far then HOME.x else p0.x
      let cy = if far then HOME.y else p0.y
      target = Vec(cx + cos(a) * r, cy + sin(a) * r, 0.0)
      hasTarget = true
      lastOrder = t - AUTO_AFTER + Random(2.0, 8.0)
    }

    body.SetLocationRotation(p1, Rotation(tl, y1, 0.0))


    // ground under the frog for next tick
    let probe = Sweep(p1 + Vec(0.0, 0.0, STEP_UP), Vec(0.0, 0.0, -1.0), STEP_UP + 6000.0,
      ignore = body, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
    on probe.Hit {
      groundZ = probe.HitLocation.z
    }
    on probe.Miss {
      groundZ = p1.z - 6000.0
    }

    // ---- eyes: one row of rays per tick while watched ----
    if t < w0 {
      let rw = row
      let fr0 = frame
      let pT = poseT
      let ya = Deg2Rad(y1)
      let pa = Deg2Rad(pi0)
      let F = Vec(cos(pa) * cos(ya), cos(pa) * sin(ya), sin(pa))
      let R = Vec(0.0 - sin(ya), cos(ya), 0.0)
      let UP = Vec(0.0 - sin(pa) * cos(ya), 0.0 - sin(pa) * sin(ya), cos(pa))
      let E = p1 + Vec(cos(ya) * EYE_FWD, sin(ya) * EYE_FWD, EYE_Z)
      let v = 0.715052 - (rw + 0.5) * 0.059588
      let d0 = Normalize(F + R * -1.161960 + UP * v)
      let s0_0 = Sweep(E, d0, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s0_0.Hit {
        cells[0] = Fmt("{A}{B:.0}", s0_0.HitColor.ToHex().Substring(0, 6), s0_0.HitDistance + 0.0)
      }
      on s0_0.Miss {
        let s0_1 = Sweep((E + d0 * 99.0), d0, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s0_1.Hit {
          cells[0] = Fmt("{A}{B:.0}", s0_1.HitColor.ToHex().Substring(0, 6), s0_1.HitDistance + 99.0)
        }
        on s0_1.Miss {
          let s0_2 = Sweep((E + d0 * 198.0), d0, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s0_2.Hit {
            cells[0] = Fmt("{A}{B:.0}", s0_2.HitColor.ToHex().Substring(0, 6), s0_2.HitDistance + 198.0)
          }
          on s0_2.Miss {
            cells[0] = ""
          }
        }
      }
      let d1 = Normalize(F + R * -1.102372 + UP * v)
      let s1_0 = Sweep(E, d1, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s1_0.Hit {
        cells[1] = Fmt("{A}{B:.0}", s1_0.HitColor.ToHex().Substring(0, 6), s1_0.HitDistance + 0.0)
      }
      on s1_0.Miss {
        let s1_1 = Sweep((E + d1 * 99.0), d1, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s1_1.Hit {
          cells[1] = Fmt("{A}{B:.0}", s1_1.HitColor.ToHex().Substring(0, 6), s1_1.HitDistance + 99.0)
        }
        on s1_1.Miss {
          let s1_2 = Sweep((E + d1 * 198.0), d1, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s1_2.Hit {
            cells[1] = Fmt("{A}{B:.0}", s1_2.HitColor.ToHex().Substring(0, 6), s1_2.HitDistance + 198.0)
          }
          on s1_2.Miss {
            cells[1] = ""
          }
        }
      }
      let d2 = Normalize(F + R * -1.042784 + UP * v)
      let s2_0 = Sweep(E, d2, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s2_0.Hit {
        cells[2] = Fmt("{A}{B:.0}", s2_0.HitColor.ToHex().Substring(0, 6), s2_0.HitDistance + 0.0)
      }
      on s2_0.Miss {
        let s2_1 = Sweep((E + d2 * 99.0), d2, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s2_1.Hit {
          cells[2] = Fmt("{A}{B:.0}", s2_1.HitColor.ToHex().Substring(0, 6), s2_1.HitDistance + 99.0)
        }
        on s2_1.Miss {
          let s2_2 = Sweep((E + d2 * 198.0), d2, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s2_2.Hit {
            cells[2] = Fmt("{A}{B:.0}", s2_2.HitColor.ToHex().Substring(0, 6), s2_2.HitDistance + 198.0)
          }
          on s2_2.Miss {
            cells[2] = ""
          }
        }
      }
      let d3 = Normalize(F + R * -0.983197 + UP * v)
      let s3_0 = Sweep(E, d3, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s3_0.Hit {
        cells[3] = Fmt("{A}{B:.0}", s3_0.HitColor.ToHex().Substring(0, 6), s3_0.HitDistance + 0.0)
      }
      on s3_0.Miss {
        let s3_1 = Sweep((E + d3 * 99.0), d3, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s3_1.Hit {
          cells[3] = Fmt("{A}{B:.0}", s3_1.HitColor.ToHex().Substring(0, 6), s3_1.HitDistance + 99.0)
        }
        on s3_1.Miss {
          let s3_2 = Sweep((E + d3 * 198.0), d3, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s3_2.Hit {
            cells[3] = Fmt("{A}{B:.0}", s3_2.HitColor.ToHex().Substring(0, 6), s3_2.HitDistance + 198.0)
          }
          on s3_2.Miss {
            cells[3] = ""
          }
        }
      }
      let d4 = Normalize(F + R * -0.923609 + UP * v)
      let s4_0 = Sweep(E, d4, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s4_0.Hit {
        cells[4] = Fmt("{A}{B:.0}", s4_0.HitColor.ToHex().Substring(0, 6), s4_0.HitDistance + 0.0)
      }
      on s4_0.Miss {
        let s4_1 = Sweep((E + d4 * 99.0), d4, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s4_1.Hit {
          cells[4] = Fmt("{A}{B:.0}", s4_1.HitColor.ToHex().Substring(0, 6), s4_1.HitDistance + 99.0)
        }
        on s4_1.Miss {
          let s4_2 = Sweep((E + d4 * 198.0), d4, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s4_2.Hit {
            cells[4] = Fmt("{A}{B:.0}", s4_2.HitColor.ToHex().Substring(0, 6), s4_2.HitDistance + 198.0)
          }
          on s4_2.Miss {
            cells[4] = ""
          }
        }
      }
      let d5 = Normalize(F + R * -0.864021 + UP * v)
      let s5_0 = Sweep(E, d5, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s5_0.Hit {
        cells[5] = Fmt("{A}{B:.0}", s5_0.HitColor.ToHex().Substring(0, 6), s5_0.HitDistance + 0.0)
      }
      on s5_0.Miss {
        let s5_1 = Sweep((E + d5 * 99.0), d5, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s5_1.Hit {
          cells[5] = Fmt("{A}{B:.0}", s5_1.HitColor.ToHex().Substring(0, 6), s5_1.HitDistance + 99.0)
        }
        on s5_1.Miss {
          let s5_2 = Sweep((E + d5 * 198.0), d5, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s5_2.Hit {
            cells[5] = Fmt("{A}{B:.0}", s5_2.HitColor.ToHex().Substring(0, 6), s5_2.HitDistance + 198.0)
          }
          on s5_2.Miss {
            cells[5] = ""
          }
        }
      }
      let d6 = Normalize(F + R * -0.804434 + UP * v)
      let s6_0 = Sweep(E, d6, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s6_0.Hit {
        cells[6] = Fmt("{A}{B:.0}", s6_0.HitColor.ToHex().Substring(0, 6), s6_0.HitDistance + 0.0)
      }
      on s6_0.Miss {
        let s6_1 = Sweep((E + d6 * 99.0), d6, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s6_1.Hit {
          cells[6] = Fmt("{A}{B:.0}", s6_1.HitColor.ToHex().Substring(0, 6), s6_1.HitDistance + 99.0)
        }
        on s6_1.Miss {
          let s6_2 = Sweep((E + d6 * 198.0), d6, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s6_2.Hit {
            cells[6] = Fmt("{A}{B:.0}", s6_2.HitColor.ToHex().Substring(0, 6), s6_2.HitDistance + 198.0)
          }
          on s6_2.Miss {
            cells[6] = ""
          }
        }
      }
      let d7 = Normalize(F + R * -0.744846 + UP * v)
      let s7_0 = Sweep(E, d7, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s7_0.Hit {
        cells[7] = Fmt("{A}{B:.0}", s7_0.HitColor.ToHex().Substring(0, 6), s7_0.HitDistance + 0.0)
      }
      on s7_0.Miss {
        let s7_1 = Sweep((E + d7 * 99.0), d7, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s7_1.Hit {
          cells[7] = Fmt("{A}{B:.0}", s7_1.HitColor.ToHex().Substring(0, 6), s7_1.HitDistance + 99.0)
        }
        on s7_1.Miss {
          let s7_2 = Sweep((E + d7 * 198.0), d7, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s7_2.Hit {
            cells[7] = Fmt("{A}{B:.0}", s7_2.HitColor.ToHex().Substring(0, 6), s7_2.HitDistance + 198.0)
          }
          on s7_2.Miss {
            cells[7] = ""
          }
        }
      }
      let d8 = Normalize(F + R * -0.685258 + UP * v)
      let s8_0 = Sweep(E, d8, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s8_0.Hit {
        cells[8] = Fmt("{A}{B:.0}", s8_0.HitColor.ToHex().Substring(0, 6), s8_0.HitDistance + 0.0)
      }
      on s8_0.Miss {
        let s8_1 = Sweep((E + d8 * 99.0), d8, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s8_1.Hit {
          cells[8] = Fmt("{A}{B:.0}", s8_1.HitColor.ToHex().Substring(0, 6), s8_1.HitDistance + 99.0)
        }
        on s8_1.Miss {
          let s8_2 = Sweep((E + d8 * 198.0), d8, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s8_2.Hit {
            cells[8] = Fmt("{A}{B:.0}", s8_2.HitColor.ToHex().Substring(0, 6), s8_2.HitDistance + 198.0)
          }
          on s8_2.Miss {
            cells[8] = ""
          }
        }
      }
      let d9 = Normalize(F + R * -0.625671 + UP * v)
      let s9_0 = Sweep(E, d9, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s9_0.Hit {
        cells[9] = Fmt("{A}{B:.0}", s9_0.HitColor.ToHex().Substring(0, 6), s9_0.HitDistance + 0.0)
      }
      on s9_0.Miss {
        let s9_1 = Sweep((E + d9 * 99.0), d9, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s9_1.Hit {
          cells[9] = Fmt("{A}{B:.0}", s9_1.HitColor.ToHex().Substring(0, 6), s9_1.HitDistance + 99.0)
        }
        on s9_1.Miss {
          let s9_2 = Sweep((E + d9 * 198.0), d9, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s9_2.Hit {
            cells[9] = Fmt("{A}{B:.0}", s9_2.HitColor.ToHex().Substring(0, 6), s9_2.HitDistance + 198.0)
          }
          on s9_2.Miss {
            cells[9] = ""
          }
        }
      }
      let d10 = Normalize(F + R * -0.566083 + UP * v)
      let s10_0 = Sweep(E, d10, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s10_0.Hit {
        cells[10] = Fmt("{A}{B:.0}", s10_0.HitColor.ToHex().Substring(0, 6), s10_0.HitDistance + 0.0)
      }
      on s10_0.Miss {
        let s10_1 = Sweep((E + d10 * 99.0), d10, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s10_1.Hit {
          cells[10] = Fmt("{A}{B:.0}", s10_1.HitColor.ToHex().Substring(0, 6), s10_1.HitDistance + 99.0)
        }
        on s10_1.Miss {
          let s10_2 = Sweep((E + d10 * 198.0), d10, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s10_2.Hit {
            cells[10] = Fmt("{A}{B:.0}", s10_2.HitColor.ToHex().Substring(0, 6), s10_2.HitDistance + 198.0)
          }
          on s10_2.Miss {
            cells[10] = ""
          }
        }
      }
      let d11 = Normalize(F + R * -0.506495 + UP * v)
      let s11_0 = Sweep(E, d11, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s11_0.Hit {
        cells[11] = Fmt("{A}{B:.0}", s11_0.HitColor.ToHex().Substring(0, 6), s11_0.HitDistance + 0.0)
      }
      on s11_0.Miss {
        let s11_1 = Sweep((E + d11 * 99.0), d11, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s11_1.Hit {
          cells[11] = Fmt("{A}{B:.0}", s11_1.HitColor.ToHex().Substring(0, 6), s11_1.HitDistance + 99.0)
        }
        on s11_1.Miss {
          let s11_2 = Sweep((E + d11 * 198.0), d11, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s11_2.Hit {
            cells[11] = Fmt("{A}{B:.0}", s11_2.HitColor.ToHex().Substring(0, 6), s11_2.HitDistance + 198.0)
          }
          on s11_2.Miss {
            cells[11] = ""
          }
        }
      }
      let d12 = Normalize(F + R * -0.446908 + UP * v)
      let s12_0 = Sweep(E, d12, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s12_0.Hit {
        cells[12] = Fmt("{A}{B:.0}", s12_0.HitColor.ToHex().Substring(0, 6), s12_0.HitDistance + 0.0)
      }
      on s12_0.Miss {
        let s12_1 = Sweep((E + d12 * 99.0), d12, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s12_1.Hit {
          cells[12] = Fmt("{A}{B:.0}", s12_1.HitColor.ToHex().Substring(0, 6), s12_1.HitDistance + 99.0)
        }
        on s12_1.Miss {
          let s12_2 = Sweep((E + d12 * 198.0), d12, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s12_2.Hit {
            cells[12] = Fmt("{A}{B:.0}", s12_2.HitColor.ToHex().Substring(0, 6), s12_2.HitDistance + 198.0)
          }
          on s12_2.Miss {
            cells[12] = ""
          }
        }
      }
      let d13 = Normalize(F + R * -0.387320 + UP * v)
      let s13_0 = Sweep(E, d13, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s13_0.Hit {
        cells[13] = Fmt("{A}{B:.0}", s13_0.HitColor.ToHex().Substring(0, 6), s13_0.HitDistance + 0.0)
      }
      on s13_0.Miss {
        let s13_1 = Sweep((E + d13 * 99.0), d13, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s13_1.Hit {
          cells[13] = Fmt("{A}{B:.0}", s13_1.HitColor.ToHex().Substring(0, 6), s13_1.HitDistance + 99.0)
        }
        on s13_1.Miss {
          let s13_2 = Sweep((E + d13 * 198.0), d13, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s13_2.Hit {
            cells[13] = Fmt("{A}{B:.0}", s13_2.HitColor.ToHex().Substring(0, 6), s13_2.HitDistance + 198.0)
          }
          on s13_2.Miss {
            cells[13] = ""
          }
        }
      }
      let d14 = Normalize(F + R * -0.327732 + UP * v)
      let s14_0 = Sweep(E, d14, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s14_0.Hit {
        cells[14] = Fmt("{A}{B:.0}", s14_0.HitColor.ToHex().Substring(0, 6), s14_0.HitDistance + 0.0)
      }
      on s14_0.Miss {
        let s14_1 = Sweep((E + d14 * 99.0), d14, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s14_1.Hit {
          cells[14] = Fmt("{A}{B:.0}", s14_1.HitColor.ToHex().Substring(0, 6), s14_1.HitDistance + 99.0)
        }
        on s14_1.Miss {
          let s14_2 = Sweep((E + d14 * 198.0), d14, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s14_2.Hit {
            cells[14] = Fmt("{A}{B:.0}", s14_2.HitColor.ToHex().Substring(0, 6), s14_2.HitDistance + 198.0)
          }
          on s14_2.Miss {
            cells[14] = ""
          }
        }
      }
      let d15 = Normalize(F + R * -0.268145 + UP * v)
      let s15_0 = Sweep(E, d15, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s15_0.Hit {
        cells[15] = Fmt("{A}{B:.0}", s15_0.HitColor.ToHex().Substring(0, 6), s15_0.HitDistance + 0.0)
      }
      on s15_0.Miss {
        let s15_1 = Sweep((E + d15 * 99.0), d15, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s15_1.Hit {
          cells[15] = Fmt("{A}{B:.0}", s15_1.HitColor.ToHex().Substring(0, 6), s15_1.HitDistance + 99.0)
        }
        on s15_1.Miss {
          let s15_2 = Sweep((E + d15 * 198.0), d15, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s15_2.Hit {
            cells[15] = Fmt("{A}{B:.0}", s15_2.HitColor.ToHex().Substring(0, 6), s15_2.HitDistance + 198.0)
          }
          on s15_2.Miss {
            cells[15] = ""
          }
        }
      }
      let d16 = Normalize(F + R * -0.208557 + UP * v)
      let s16_0 = Sweep(E, d16, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s16_0.Hit {
        cells[16] = Fmt("{A}{B:.0}", s16_0.HitColor.ToHex().Substring(0, 6), s16_0.HitDistance + 0.0)
      }
      on s16_0.Miss {
        let s16_1 = Sweep((E + d16 * 99.0), d16, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s16_1.Hit {
          cells[16] = Fmt("{A}{B:.0}", s16_1.HitColor.ToHex().Substring(0, 6), s16_1.HitDistance + 99.0)
        }
        on s16_1.Miss {
          let s16_2 = Sweep((E + d16 * 198.0), d16, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s16_2.Hit {
            cells[16] = Fmt("{A}{B:.0}", s16_2.HitColor.ToHex().Substring(0, 6), s16_2.HitDistance + 198.0)
          }
          on s16_2.Miss {
            cells[16] = ""
          }
        }
      }
      let d17 = Normalize(F + R * -0.148969 + UP * v)
      let s17_0 = Sweep(E, d17, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s17_0.Hit {
        cells[17] = Fmt("{A}{B:.0}", s17_0.HitColor.ToHex().Substring(0, 6), s17_0.HitDistance + 0.0)
      }
      on s17_0.Miss {
        let s17_1 = Sweep((E + d17 * 99.0), d17, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s17_1.Hit {
          cells[17] = Fmt("{A}{B:.0}", s17_1.HitColor.ToHex().Substring(0, 6), s17_1.HitDistance + 99.0)
        }
        on s17_1.Miss {
          let s17_2 = Sweep((E + d17 * 198.0), d17, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s17_2.Hit {
            cells[17] = Fmt("{A}{B:.0}", s17_2.HitColor.ToHex().Substring(0, 6), s17_2.HitDistance + 198.0)
          }
          on s17_2.Miss {
            cells[17] = ""
          }
        }
      }
      let d18 = Normalize(F + R * -0.089382 + UP * v)
      let s18_0 = Sweep(E, d18, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s18_0.Hit {
        cells[18] = Fmt("{A}{B:.0}", s18_0.HitColor.ToHex().Substring(0, 6), s18_0.HitDistance + 0.0)
      }
      on s18_0.Miss {
        let s18_1 = Sweep((E + d18 * 99.0), d18, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s18_1.Hit {
          cells[18] = Fmt("{A}{B:.0}", s18_1.HitColor.ToHex().Substring(0, 6), s18_1.HitDistance + 99.0)
        }
        on s18_1.Miss {
          let s18_2 = Sweep((E + d18 * 198.0), d18, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s18_2.Hit {
            cells[18] = Fmt("{A}{B:.0}", s18_2.HitColor.ToHex().Substring(0, 6), s18_2.HitDistance + 198.0)
          }
          on s18_2.Miss {
            cells[18] = ""
          }
        }
      }
      let d19 = Normalize(F + R * -0.029794 + UP * v)
      let s19_0 = Sweep(E, d19, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s19_0.Hit {
        cells[19] = Fmt("{A}{B:.0}", s19_0.HitColor.ToHex().Substring(0, 6), s19_0.HitDistance + 0.0)
      }
      on s19_0.Miss {
        let s19_1 = Sweep((E + d19 * 99.0), d19, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s19_1.Hit {
          cells[19] = Fmt("{A}{B:.0}", s19_1.HitColor.ToHex().Substring(0, 6), s19_1.HitDistance + 99.0)
        }
        on s19_1.Miss {
          let s19_2 = Sweep((E + d19 * 198.0), d19, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s19_2.Hit {
            cells[19] = Fmt("{A}{B:.0}", s19_2.HitColor.ToHex().Substring(0, 6), s19_2.HitDistance + 198.0)
          }
          on s19_2.Miss {
            cells[19] = ""
          }
        }
      }
      let d20 = Normalize(F + R * 0.029794 + UP * v)
      let s20_0 = Sweep(E, d20, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s20_0.Hit {
        cells[20] = Fmt("{A}{B:.0}", s20_0.HitColor.ToHex().Substring(0, 6), s20_0.HitDistance + 0.0)
      }
      on s20_0.Miss {
        let s20_1 = Sweep((E + d20 * 99.0), d20, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s20_1.Hit {
          cells[20] = Fmt("{A}{B:.0}", s20_1.HitColor.ToHex().Substring(0, 6), s20_1.HitDistance + 99.0)
        }
        on s20_1.Miss {
          let s20_2 = Sweep((E + d20 * 198.0), d20, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s20_2.Hit {
            cells[20] = Fmt("{A}{B:.0}", s20_2.HitColor.ToHex().Substring(0, 6), s20_2.HitDistance + 198.0)
          }
          on s20_2.Miss {
            cells[20] = ""
          }
        }
      }
      let d21 = Normalize(F + R * 0.089382 + UP * v)
      let s21_0 = Sweep(E, d21, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s21_0.Hit {
        cells[21] = Fmt("{A}{B:.0}", s21_0.HitColor.ToHex().Substring(0, 6), s21_0.HitDistance + 0.0)
      }
      on s21_0.Miss {
        let s21_1 = Sweep((E + d21 * 99.0), d21, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s21_1.Hit {
          cells[21] = Fmt("{A}{B:.0}", s21_1.HitColor.ToHex().Substring(0, 6), s21_1.HitDistance + 99.0)
        }
        on s21_1.Miss {
          let s21_2 = Sweep((E + d21 * 198.0), d21, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s21_2.Hit {
            cells[21] = Fmt("{A}{B:.0}", s21_2.HitColor.ToHex().Substring(0, 6), s21_2.HitDistance + 198.0)
          }
          on s21_2.Miss {
            cells[21] = ""
          }
        }
      }
      let d22 = Normalize(F + R * 0.148969 + UP * v)
      let s22_0 = Sweep(E, d22, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s22_0.Hit {
        cells[22] = Fmt("{A}{B:.0}", s22_0.HitColor.ToHex().Substring(0, 6), s22_0.HitDistance + 0.0)
      }
      on s22_0.Miss {
        let s22_1 = Sweep((E + d22 * 99.0), d22, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s22_1.Hit {
          cells[22] = Fmt("{A}{B:.0}", s22_1.HitColor.ToHex().Substring(0, 6), s22_1.HitDistance + 99.0)
        }
        on s22_1.Miss {
          let s22_2 = Sweep((E + d22 * 198.0), d22, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s22_2.Hit {
            cells[22] = Fmt("{A}{B:.0}", s22_2.HitColor.ToHex().Substring(0, 6), s22_2.HitDistance + 198.0)
          }
          on s22_2.Miss {
            cells[22] = ""
          }
        }
      }
      let d23 = Normalize(F + R * 0.208557 + UP * v)
      let s23_0 = Sweep(E, d23, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s23_0.Hit {
        cells[23] = Fmt("{A}{B:.0}", s23_0.HitColor.ToHex().Substring(0, 6), s23_0.HitDistance + 0.0)
      }
      on s23_0.Miss {
        let s23_1 = Sweep((E + d23 * 99.0), d23, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s23_1.Hit {
          cells[23] = Fmt("{A}{B:.0}", s23_1.HitColor.ToHex().Substring(0, 6), s23_1.HitDistance + 99.0)
        }
        on s23_1.Miss {
          let s23_2 = Sweep((E + d23 * 198.0), d23, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s23_2.Hit {
            cells[23] = Fmt("{A}{B:.0}", s23_2.HitColor.ToHex().Substring(0, 6), s23_2.HitDistance + 198.0)
          }
          on s23_2.Miss {
            cells[23] = ""
          }
        }
      }
      let d24 = Normalize(F + R * 0.268145 + UP * v)
      let s24_0 = Sweep(E, d24, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s24_0.Hit {
        cells[24] = Fmt("{A}{B:.0}", s24_0.HitColor.ToHex().Substring(0, 6), s24_0.HitDistance + 0.0)
      }
      on s24_0.Miss {
        let s24_1 = Sweep((E + d24 * 99.0), d24, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s24_1.Hit {
          cells[24] = Fmt("{A}{B:.0}", s24_1.HitColor.ToHex().Substring(0, 6), s24_1.HitDistance + 99.0)
        }
        on s24_1.Miss {
          let s24_2 = Sweep((E + d24 * 198.0), d24, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s24_2.Hit {
            cells[24] = Fmt("{A}{B:.0}", s24_2.HitColor.ToHex().Substring(0, 6), s24_2.HitDistance + 198.0)
          }
          on s24_2.Miss {
            cells[24] = ""
          }
        }
      }
      let d25 = Normalize(F + R * 0.327732 + UP * v)
      let s25_0 = Sweep(E, d25, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s25_0.Hit {
        cells[25] = Fmt("{A}{B:.0}", s25_0.HitColor.ToHex().Substring(0, 6), s25_0.HitDistance + 0.0)
      }
      on s25_0.Miss {
        let s25_1 = Sweep((E + d25 * 99.0), d25, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s25_1.Hit {
          cells[25] = Fmt("{A}{B:.0}", s25_1.HitColor.ToHex().Substring(0, 6), s25_1.HitDistance + 99.0)
        }
        on s25_1.Miss {
          let s25_2 = Sweep((E + d25 * 198.0), d25, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s25_2.Hit {
            cells[25] = Fmt("{A}{B:.0}", s25_2.HitColor.ToHex().Substring(0, 6), s25_2.HitDistance + 198.0)
          }
          on s25_2.Miss {
            cells[25] = ""
          }
        }
      }
      let d26 = Normalize(F + R * 0.387320 + UP * v)
      let s26_0 = Sweep(E, d26, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s26_0.Hit {
        cells[26] = Fmt("{A}{B:.0}", s26_0.HitColor.ToHex().Substring(0, 6), s26_0.HitDistance + 0.0)
      }
      on s26_0.Miss {
        let s26_1 = Sweep((E + d26 * 99.0), d26, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s26_1.Hit {
          cells[26] = Fmt("{A}{B:.0}", s26_1.HitColor.ToHex().Substring(0, 6), s26_1.HitDistance + 99.0)
        }
        on s26_1.Miss {
          let s26_2 = Sweep((E + d26 * 198.0), d26, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s26_2.Hit {
            cells[26] = Fmt("{A}{B:.0}", s26_2.HitColor.ToHex().Substring(0, 6), s26_2.HitDistance + 198.0)
          }
          on s26_2.Miss {
            cells[26] = ""
          }
        }
      }
      let d27 = Normalize(F + R * 0.446908 + UP * v)
      let s27_0 = Sweep(E, d27, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s27_0.Hit {
        cells[27] = Fmt("{A}{B:.0}", s27_0.HitColor.ToHex().Substring(0, 6), s27_0.HitDistance + 0.0)
      }
      on s27_0.Miss {
        let s27_1 = Sweep((E + d27 * 99.0), d27, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s27_1.Hit {
          cells[27] = Fmt("{A}{B:.0}", s27_1.HitColor.ToHex().Substring(0, 6), s27_1.HitDistance + 99.0)
        }
        on s27_1.Miss {
          let s27_2 = Sweep((E + d27 * 198.0), d27, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s27_2.Hit {
            cells[27] = Fmt("{A}{B:.0}", s27_2.HitColor.ToHex().Substring(0, 6), s27_2.HitDistance + 198.0)
          }
          on s27_2.Miss {
            cells[27] = ""
          }
        }
      }
      let d28 = Normalize(F + R * 0.506495 + UP * v)
      let s28_0 = Sweep(E, d28, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s28_0.Hit {
        cells[28] = Fmt("{A}{B:.0}", s28_0.HitColor.ToHex().Substring(0, 6), s28_0.HitDistance + 0.0)
      }
      on s28_0.Miss {
        let s28_1 = Sweep((E + d28 * 99.0), d28, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s28_1.Hit {
          cells[28] = Fmt("{A}{B:.0}", s28_1.HitColor.ToHex().Substring(0, 6), s28_1.HitDistance + 99.0)
        }
        on s28_1.Miss {
          let s28_2 = Sweep((E + d28 * 198.0), d28, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s28_2.Hit {
            cells[28] = Fmt("{A}{B:.0}", s28_2.HitColor.ToHex().Substring(0, 6), s28_2.HitDistance + 198.0)
          }
          on s28_2.Miss {
            cells[28] = ""
          }
        }
      }
      let d29 = Normalize(F + R * 0.566083 + UP * v)
      let s29_0 = Sweep(E, d29, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s29_0.Hit {
        cells[29] = Fmt("{A}{B:.0}", s29_0.HitColor.ToHex().Substring(0, 6), s29_0.HitDistance + 0.0)
      }
      on s29_0.Miss {
        let s29_1 = Sweep((E + d29 * 99.0), d29, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s29_1.Hit {
          cells[29] = Fmt("{A}{B:.0}", s29_1.HitColor.ToHex().Substring(0, 6), s29_1.HitDistance + 99.0)
        }
        on s29_1.Miss {
          let s29_2 = Sweep((E + d29 * 198.0), d29, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s29_2.Hit {
            cells[29] = Fmt("{A}{B:.0}", s29_2.HitColor.ToHex().Substring(0, 6), s29_2.HitDistance + 198.0)
          }
          on s29_2.Miss {
            cells[29] = ""
          }
        }
      }
      let d30 = Normalize(F + R * 0.625671 + UP * v)
      let s30_0 = Sweep(E, d30, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s30_0.Hit {
        cells[30] = Fmt("{A}{B:.0}", s30_0.HitColor.ToHex().Substring(0, 6), s30_0.HitDistance + 0.0)
      }
      on s30_0.Miss {
        let s30_1 = Sweep((E + d30 * 99.0), d30, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s30_1.Hit {
          cells[30] = Fmt("{A}{B:.0}", s30_1.HitColor.ToHex().Substring(0, 6), s30_1.HitDistance + 99.0)
        }
        on s30_1.Miss {
          let s30_2 = Sweep((E + d30 * 198.0), d30, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s30_2.Hit {
            cells[30] = Fmt("{A}{B:.0}", s30_2.HitColor.ToHex().Substring(0, 6), s30_2.HitDistance + 198.0)
          }
          on s30_2.Miss {
            cells[30] = ""
          }
        }
      }
      let d31 = Normalize(F + R * 0.685258 + UP * v)
      let s31_0 = Sweep(E, d31, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s31_0.Hit {
        cells[31] = Fmt("{A}{B:.0}", s31_0.HitColor.ToHex().Substring(0, 6), s31_0.HitDistance + 0.0)
      }
      on s31_0.Miss {
        let s31_1 = Sweep((E + d31 * 99.0), d31, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s31_1.Hit {
          cells[31] = Fmt("{A}{B:.0}", s31_1.HitColor.ToHex().Substring(0, 6), s31_1.HitDistance + 99.0)
        }
        on s31_1.Miss {
          let s31_2 = Sweep((E + d31 * 198.0), d31, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s31_2.Hit {
            cells[31] = Fmt("{A}{B:.0}", s31_2.HitColor.ToHex().Substring(0, 6), s31_2.HitDistance + 198.0)
          }
          on s31_2.Miss {
            cells[31] = ""
          }
        }
      }
      let d32 = Normalize(F + R * 0.744846 + UP * v)
      let s32_0 = Sweep(E, d32, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s32_0.Hit {
        cells[32] = Fmt("{A}{B:.0}", s32_0.HitColor.ToHex().Substring(0, 6), s32_0.HitDistance + 0.0)
      }
      on s32_0.Miss {
        let s32_1 = Sweep((E + d32 * 99.0), d32, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s32_1.Hit {
          cells[32] = Fmt("{A}{B:.0}", s32_1.HitColor.ToHex().Substring(0, 6), s32_1.HitDistance + 99.0)
        }
        on s32_1.Miss {
          let s32_2 = Sweep((E + d32 * 198.0), d32, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s32_2.Hit {
            cells[32] = Fmt("{A}{B:.0}", s32_2.HitColor.ToHex().Substring(0, 6), s32_2.HitDistance + 198.0)
          }
          on s32_2.Miss {
            cells[32] = ""
          }
        }
      }
      let d33 = Normalize(F + R * 0.804434 + UP * v)
      let s33_0 = Sweep(E, d33, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s33_0.Hit {
        cells[33] = Fmt("{A}{B:.0}", s33_0.HitColor.ToHex().Substring(0, 6), s33_0.HitDistance + 0.0)
      }
      on s33_0.Miss {
        let s33_1 = Sweep((E + d33 * 99.0), d33, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s33_1.Hit {
          cells[33] = Fmt("{A}{B:.0}", s33_1.HitColor.ToHex().Substring(0, 6), s33_1.HitDistance + 99.0)
        }
        on s33_1.Miss {
          let s33_2 = Sweep((E + d33 * 198.0), d33, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s33_2.Hit {
            cells[33] = Fmt("{A}{B:.0}", s33_2.HitColor.ToHex().Substring(0, 6), s33_2.HitDistance + 198.0)
          }
          on s33_2.Miss {
            cells[33] = ""
          }
        }
      }
      let d34 = Normalize(F + R * 0.864021 + UP * v)
      let s34_0 = Sweep(E, d34, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s34_0.Hit {
        cells[34] = Fmt("{A}{B:.0}", s34_0.HitColor.ToHex().Substring(0, 6), s34_0.HitDistance + 0.0)
      }
      on s34_0.Miss {
        let s34_1 = Sweep((E + d34 * 99.0), d34, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s34_1.Hit {
          cells[34] = Fmt("{A}{B:.0}", s34_1.HitColor.ToHex().Substring(0, 6), s34_1.HitDistance + 99.0)
        }
        on s34_1.Miss {
          let s34_2 = Sweep((E + d34 * 198.0), d34, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s34_2.Hit {
            cells[34] = Fmt("{A}{B:.0}", s34_2.HitColor.ToHex().Substring(0, 6), s34_2.HitDistance + 198.0)
          }
          on s34_2.Miss {
            cells[34] = ""
          }
        }
      }
      let d35 = Normalize(F + R * 0.923609 + UP * v)
      let s35_0 = Sweep(E, d35, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s35_0.Hit {
        cells[35] = Fmt("{A}{B:.0}", s35_0.HitColor.ToHex().Substring(0, 6), s35_0.HitDistance + 0.0)
      }
      on s35_0.Miss {
        let s35_1 = Sweep((E + d35 * 99.0), d35, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s35_1.Hit {
          cells[35] = Fmt("{A}{B:.0}", s35_1.HitColor.ToHex().Substring(0, 6), s35_1.HitDistance + 99.0)
        }
        on s35_1.Miss {
          let s35_2 = Sweep((E + d35 * 198.0), d35, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s35_2.Hit {
            cells[35] = Fmt("{A}{B:.0}", s35_2.HitColor.ToHex().Substring(0, 6), s35_2.HitDistance + 198.0)
          }
          on s35_2.Miss {
            cells[35] = ""
          }
        }
      }
      let d36 = Normalize(F + R * 0.983197 + UP * v)
      let s36_0 = Sweep(E, d36, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s36_0.Hit {
        cells[36] = Fmt("{A}{B:.0}", s36_0.HitColor.ToHex().Substring(0, 6), s36_0.HitDistance + 0.0)
      }
      on s36_0.Miss {
        let s36_1 = Sweep((E + d36 * 99.0), d36, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s36_1.Hit {
          cells[36] = Fmt("{A}{B:.0}", s36_1.HitColor.ToHex().Substring(0, 6), s36_1.HitDistance + 99.0)
        }
        on s36_1.Miss {
          let s36_2 = Sweep((E + d36 * 198.0), d36, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s36_2.Hit {
            cells[36] = Fmt("{A}{B:.0}", s36_2.HitColor.ToHex().Substring(0, 6), s36_2.HitDistance + 198.0)
          }
          on s36_2.Miss {
            cells[36] = ""
          }
        }
      }
      let d37 = Normalize(F + R * 1.042784 + UP * v)
      let s37_0 = Sweep(E, d37, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s37_0.Hit {
        cells[37] = Fmt("{A}{B:.0}", s37_0.HitColor.ToHex().Substring(0, 6), s37_0.HitDistance + 0.0)
      }
      on s37_0.Miss {
        let s37_1 = Sweep((E + d37 * 99.0), d37, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s37_1.Hit {
          cells[37] = Fmt("{A}{B:.0}", s37_1.HitColor.ToHex().Substring(0, 6), s37_1.HitDistance + 99.0)
        }
        on s37_1.Miss {
          let s37_2 = Sweep((E + d37 * 198.0), d37, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s37_2.Hit {
            cells[37] = Fmt("{A}{B:.0}", s37_2.HitColor.ToHex().Substring(0, 6), s37_2.HitDistance + 198.0)
          }
          on s37_2.Miss {
            cells[37] = ""
          }
        }
      }
      let d38 = Normalize(F + R * 1.102372 + UP * v)
      let s38_0 = Sweep(E, d38, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s38_0.Hit {
        cells[38] = Fmt("{A}{B:.0}", s38_0.HitColor.ToHex().Substring(0, 6), s38_0.HitDistance + 0.0)
      }
      on s38_0.Miss {
        let s38_1 = Sweep((E + d38 * 99.0), d38, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s38_1.Hit {
          cells[38] = Fmt("{A}{B:.0}", s38_1.HitColor.ToHex().Substring(0, 6), s38_1.HitDistance + 99.0)
        }
        on s38_1.Miss {
          let s38_2 = Sweep((E + d38 * 198.0), d38, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s38_2.Hit {
            cells[38] = Fmt("{A}{B:.0}", s38_2.HitColor.ToHex().Substring(0, 6), s38_2.HitDistance + 198.0)
          }
          on s38_2.Miss {
            cells[38] = ""
          }
        }
      }
      let d39 = Normalize(F + R * 1.161960 + UP * v)
      let s39_0 = Sweep(E, d39, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
      on s39_0.Hit {
        cells[39] = Fmt("{A}{B:.0}", s39_0.HitColor.ToHex().Substring(0, 6), s39_0.HitDistance + 0.0)
      }
      on s39_0.Miss {
        let s39_1 = Sweep((E + d39 * 99.0), d39, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
        on s39_1.Hit {
          cells[39] = Fmt("{A}{B:.0}", s39_1.HitColor.ToHex().Substring(0, 6), s39_1.HitDistance + 99.0)
        }
        on s39_1.Miss {
          let s39_2 = Sweep((E + d39 * 198.0), d39, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
          on s39_2.Hit {
            cells[39] = Fmt("{A}{B:.0}", s39_2.HitColor.ToHex().Substring(0, 6), s39_2.HitDistance + 198.0)
          }
          on s39_2.Miss {
            cells[39] = ""
          }
        }
      }
      PrintToConsole(Fmt("fe|{A:.0}|{B:.0}|{C:.1}|{D:.1}|{E:.1}|{F:.1}|{G}", fr0, rw, E.x, E.y, E.z, y1, Fmt("{A:.1}|{B}", pi0, cells.join(","))))
      row = if rw + 1.0 >= 24.0 then 0.0 else rw + 1.0
      frame = if rw + 1.0 >= 24.0 then fr0 + 1.0 else fr0
      poseT = if pT + dt > POSE_EVERY then 0.0 else pT + dt
      if pT + dt > POSE_EVERY {
        PrintToConsole(Fmt("fr|{A:.1}|{B:.1}|{C:.1}|{D:.1}|{E:.1}|{F}", p1.x, p1.y, p1.z, y1, pi0, h0))
      }
    }
  }
}
