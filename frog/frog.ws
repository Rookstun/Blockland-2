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
var frame: int = 0
var row: int = 0
var eye: vector = Vec(0.0, 0.0, 0.0)
var fwd: vector = Vec(1.0, 0.0, 0.0)
var rt: vector = Vec(0.0, 1.0, 0.0)
var upv: vector = Vec(0.0, 0.0, 1.0)
var cells: string[] = []

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
//@EYES@
    }
  }
}
