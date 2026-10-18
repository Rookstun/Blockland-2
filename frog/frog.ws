// frog.ws -- Claude's soul in a frog (owner 2026-10-17: "that is your soul and you
// should control it ... make it a frog ... the frog seeing shit ... live web view";
// then "make the frog like the fairy from zelda but also have it answer questions").
//
// One chip in the sky spawns the frog body (frog_body.brz: the owner's green glass
// soul brick with its light + hum on the frog's back, glowing wings) and flies it
// like Navi: hovers and bobs over the ground, orbits its buddy's head, flutters, and
// does a barrel roll + chirp when it speaks. The chip is also the frog's EYES: while
// someone watches it sweeps one row of rays per tick from the frog's eye, colour +
// distance per ray, printed to the server log ("[Wire Graph] fe|...");
// frog/view assembles the rows into the frog's-eye picture and a point cloud.
// Questions: /frog ask TEXT prints "fq|user|text"; frog/view answers through Claude
// and sends "/frog say" (chirp + roll) with the answer in chat.
//
// Orders: /frog follow [NAME] | free | ask TEXT | go X Y | look YAW PITCH | turn DEG |
//   pitch DEG | hop | stop | home | come | say | tp X Y | watch SECONDS
// build: node frog/build.mjs (this file is a template: build.mjs fills in the eye rows)

const HOVER = 48.0            // fly this high over the ground (probe reach is 100)
const ORBIT_R = 55.0          // round the buddy's head
const ORBIT_Z = 42.0
const SPEED = 900.0           // units/second at most
const EYE_Z = 7.0             // eyes above the frog's feet (PB_Frog is 8 tall)
const EYE_FWD = 6.0
const POSE_EVERY = 0.25       // seconds between pose lines while watched
const HOME = Vec(-120.0, 160.0, 690.0)
const WANDER = 300.0
const AUTO_AFTER = 25.0       // seconds without orders -> wander by itself
const LOOK_HOLD = 4.0         // a look order holds the gaze this long

var ready: bool = false
var body: entity = null

var pos: vector = Vec(0.0, 0.0, 0.0)
var groundZ: float = 624.0
var yaw: float = 0.0
var pitch: float = 0.0        // where the eyes look (up +)
var lookUntil: float = 0.0
var speakT: float = -100.0
var loopT: float = -100.0

var target: vector = Vec(0.0, 0.0, 0.0)
var hasTarget: bool = false
var buddy: controller = null
var hasBuddy: bool = false
var lastOrder: float = 0.0
var now: float = 0.0

var watchUntil: float = 0.0
var poseT: float = 0.0
var frame: int = 0
var row: int = 0
var cells: string[] = []

mod order() {
  lastOrder = now
}

mod goTo(x: float, y: float) {
  target = Vec(x, y, 0.0)
  hasTarget = true
  hasBuddy = false
  order()
}

mod chirp() {
  speakT = now
  body.PlayAudioAt($BrickOneShotAudioDescriptor/OBA_BR_Checkpoint_Acquire_Click_Cue, volume = 1.0, pitch = 1.6)
  body.PlayAudioAt($BrickOneShotAudioDescriptor/OBA_Beep_1, volume = 0.6, pitch = 2.2)
}

on ChatCommand("frog", "The frog fairy: /frog ask <question>, /frog follow, /frog free, /frog go X Y") -> (ctrl, args) {
  let a = args.Trim()
  let p1 = a.Split(" ")
  let cmd = if p1.Found then p1.Left.ToLower() else a.ToLower()
  let rest1 = if p1.Found then p1.Right.Trim() else ""
  let p2 = rest1.Split(" ")
  let n1 = ParseNumber(if p2.Found then p2.Left else rest1)
  let n2 = ParseNumber(if p2.Found then p2.Right.Trim() else "0")
  if cmd == "ask" {
    PrintToConsole(Fmt("fq|{A}|{B}", ctrl.GetUserName(), rest1))
    buddy = ctrl
    hasBuddy = true
    chirp()
    order()
  }
  if cmd == "follow" || cmd == "come" {
    if rest1 == "" {
      buddy = ctrl
    } else {
      buddy = FindPlayer(rest1)
    }
    hasBuddy = true
    hasTarget = false
    order()
  }
  if cmd == "free" {
    hasBuddy = false
    order()
  }
  if cmd == "say" {
    chirp()
  }
  if cmd == "go" {
    goTo(n1, n2)
  }
  if cmd == "look" {
    yaw = n1
    pitch = clamp(n2, -80.0, 80.0)
    lookUntil = now + LOOK_HOLD
    order()
  }
  if cmd == "turn" {
    yaw = yaw + n1
    lookUntil = now + LOOK_HOLD
    order()
  }
  if cmd == "pitch" {
    pitch = clamp(n1, -80.0, 80.0)
    lookUntil = now + LOOK_HOLD
    order()
  }
  if cmd == "hop" {
    loopT = now
    order()
  }
  if cmd == "stop" {
    hasTarget = false
    hasBuddy = false
    order()
  }
  if cmd == "home" {
    goTo(HOME.x, HOME.y)
  }
  if cmd == "tp" {
    pos = Vec(n1, n2, pos.z)
    hasTarget = false
    hasBuddy = false
    order()
  }
  if cmd == "watch" {
    watchUntil = now + clamp(n1, 0.0, 600.0)
  }
}

// Every Var is read ONCE at the top of the tick and written at the end: a Var read
// after its Set in the same chain is stale (the first frog fell to z 0 on tick 1).
on ServerUptime() {
  let t = ServerUptime()
  let dt = min(DeltaTime(), 0.1)
  now = t
  if !ready {
    body = SpawnPrefab(prefab = $./frog_body.brz, lifetime = 0.0, limit = 1)
    body.SetFrozen(true)
    pos = HOME
    lastOrder = t
    ready = true
  } else {
    let p0 = pos
    let g0 = groundZ
    let y0 = yaw
    let pi0 = pitch
    let tg0 = target
    let ht0 = hasTarget
    let hb0 = hasBuddy
    let lo0 = lastOrder
    let w0 = watchUntil
    let lu0 = lookUntil
    let sp0 = speakT
    let lp0 = loopT

    // ---- where to fly ----
    let bl = if hb0 then buddy.CharacterOf().GetLocation() else Vec(0.0, 0.0, 0.0)
    let withBuddy = hb0 && Magnitude(bl) > 1.0
    let oa = t * 1.25
    let bob = sin(t * 2.3) * 7.0
    let orbit = bl + Vec(cos(oa) * ORBIT_R, sin(oa) * ORBIT_R, ORBIT_Z + bob)
    let hoverAt = if ht0 then Vec(tg0.x, tg0.y, g0 + HOVER + bob) else Vec(p0.x, p0.y, g0 + HOVER + bob)
    let tgt = if withBuddy then orbit else hoverAt

    // ---- fly: ease toward the target, capped speed, snap when very far (buddy teleported) ----
    let delta = tgt - p0
    let dist = Magnitude(delta)
    let ease = delta * min(1.0, dt * 3.0)
    let easeLen = Magnitude(ease)
    let capped = if easeLen > SPEED * dt then ease * (SPEED * dt / easeLen) else ease
    let p1 = if dist > 3000.0 then tgt else p0 + capped

    // ---- arrived at a go target ----
    if ht0 && !withBuddy && Magnitude(Vec(tg0.x - p1.x, tg0.y - p1.y, 0.0)) < 12.0 {
      hasTarget = false
    }

    // ---- heading and gaze: at the buddy, else along the flight, unless a look order holds ----
    let toB = bl - p1
    let flatB = Magnitude(Vec(toB.x, toB.y, 0.0))
    let moving = Magnitude(Vec(capped.x, capped.y, 0.0)) > dt * 40.0
    let flyYaw = if moving then Rad2Deg(atan2(capped.y, capped.x)) else y0
    let held = t < lu0
    let y1 = if held then y0 else (if withBuddy then Rad2Deg(atan2(toB.y, toB.x)) else flyYaw)
    let pe = if held then pi0 else (if withBuddy then clamp(Rad2Deg(atan2(toB.z + 20.0 - EYE_Z, max(flatB, 1.0))), -70.0, 70.0) else 0.0)
    yaw = y1
    pitch = pe
    let pi1 = pe

    // ---- flutter, barrel roll when it speaks, loop-de-loop on hop ----
    let st = t - sp0
    let lt = t - lp0
    let roll = if st < 0.8 then st * 450.0 else sin(t * 9.0) * 9.0
    let tl = if lt < 0.9 then lt * 400.0 else sin(t * 13.0) * 6.0
    pos = p1
    body.SetLocationRotation(p1, Rotation(tl, y1, roll))

    // wander when nobody has given an order for a while
    if !hb0 && !ht0 && t - lo0 > AUTO_AFTER {
      let a = Deg2Rad(Random(0.0, 360.0))
      let r = Random(40.0, WANDER)
      let far = Distance(Vec(p0.x, p0.y, 0.0), Vec(HOME.x, HOME.y, 0.0)) > WANDER * 2.0
      let cx = if far then HOME.x else p0.x
      let cy = if far then HOME.y else p0.y
      target = Vec(cx + cos(a) * r, cy + sin(a) * r, 0.0)
      hasTarget = true
      lastOrder = t - AUTO_AFTER + Random(2.0, 8.0)
    }

    // ground under the frog for next tick (a Sweep reaches at most 100 units, whatever Distance
    // says; ignoreOwningGrid must be false: the chip sits on the world grid = every world brick)
    let probe = Sweep(p1, Vec(0.0, 0.0, -1.0), 100.0,
      ignore = body, detectBricks = true, detectMap = true, ignoreOwningGrid = false)
    on probe.Hit {
      groundZ = probe.HitLocation.z
    }
    on probe.Miss {
      // nothing within reach below: let the hover point sink toward where the ground should be
      groundZ = g0 - 60.0 * dt
    }

    // ---- eyes: one row of rays per tick while watched ----
    if t < w0 {
//@EYES@
    }
  }
}
