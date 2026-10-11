// pikmin_brain.ws -- the brain of ONE pikmin.
//
// onion.ws spawns one copy of this chip per pikmin (frozen, hidden inside the
// onion). The brain spawns its own brick body and drives it kinematically every
// tick: it walks, gets thrown along an arc, falls onto the ground, and grabs
// treasures. Nothing here talks to other pikmin; the onion and the treasures
// coordinate everything through global custom events, filtered by `idx`.

// ---- states (keep in sync with onion.ws / treasure_brain.ws) ----
const IDLE = 0
const FOLLOW = 1
const THROWN = 2
const LANDED = 3
const CARRY = 4

// ---- tuning (Brickadia units: a 1x1 brick is 10 wide, 12 tall) ----
const WALK_SPEED = 320.0      // following the captain
const RUN_SPEED = 650.0       // catching up when far behind
const GRAVITY = 1500.0        // our own fall acceleration (bodies are frozen)
const STEP_UP = 30.0          // how high a ledge a pikmin can walk up
const RING_PAD = 8.0          // gap between a treasure's edge and its carriers
const FOOT_Z = 0.0            // raise/lower the body if it floats or sinks
const SPIN_SPEED = 1080.0     // degrees/second of flip while flying
const GIVE_UP_TICKS = 30      // ticks after landing with no treasure -> idle

// ---- identity ----
var ready: bool = false
var idx: int = 0
var captain: character = null
var body: entity = null

// ---- motion ----
var pos: vector = Vec(0.0, 0.0, 0.0)
var groundZ: float = -100000.0
var vz: float = 0.0
var yaw: float = 0.0
var spin: float = 0.0
var state: int = IDLE
var tick: int = 0

// ---- throw ----
var throwFrom: vector = Vec(0.0, 0.0, 0.0)
var throwTo: vector = Vec(0.0, 0.0, 0.0)
var throwT: float = 0.0
var throwDur: float = 0.5
var landedTicks: int = 0

// ---- carry ----
var trId: int = -1
var trBody: entity = null
var trRadius: float = 0.0
var carryAngle: float = 0.0

mod report() {
  SendGlobalCustomEvent("pik.state", idx, state)
}

mod startThrow(src: vector, to: vector) {
  throwFrom = src
  throwTo = to
  throwT = 0.0
  let flat = Vec(to.x - src.x, to.y - src.y, 0.0)
  throwDur = clamp(0.35 + Magnitude(flat) / 1400.0, 0.35, 1.1)
  yaw = Rad2Deg(atan2(flat.y, flat.x))
  spin = 0.0
  state = THROWN
}

// ---- spawn / setup ----
on GlobalCustomEvent("pik.init", isObject = true) -> (
  cap: character, onion: vector, i: int, mode: int, src: vector, to: vector, colorIdx: int
) {
  captain = cap
  idx = i
  if colorIdx == 1 {
    body = SpawnPrefab(prefab = $./pikmin_yellow.brz, lifetime = 0.0, limit = 1)
  } else {
    if colorIdx == 2 {
      body = SpawnPrefab(prefab = $./pikmin_blue.brz, lifetime = 0.0, limit = 1)
    } else {
      body = SpawnPrefab(prefab = $./pikmin_red.brz, lifetime = 0.0, limit = 1)
    }
  }
  body.SetFrozen(true)
  pos = src
  groundZ = src.z
  if mode == THROWN {
    startThrow(src, to)
  } else {
    state = mode
  }
  body.SetLocation(pos)
  ready = true
  report()
}

on GlobalCustomEvent("pik.captain") -> (cap: character) {
  captain = cap
}

// ---- orders from the onion ----
on GlobalCustomEvent("pik.throw") -> (i: int, src: vector, to: vector) {
  if ready && i == idx && state == FOLLOW {
    startThrow(src, to)
    report()
  }
}

on GlobalCustomEvent("pik.whistle") -> (center: vector, radius: float, capPos: vector) {
  if ready && state != THROWN && state != FOLLOW {
    let nearCursor = Distance(pos, center) < radius
    let nearCaptain = Distance(pos, capPos) < 160.0
    if nearCursor || nearCaptain {
      if state == CARRY {
        SendGlobalCustomEvent("tr.leave", trId, idx)
        trId = -1
      }
      state = FOLLOW
      report()
    }
  }
}

on GlobalCustomEvent("pik.dismiss") {
  if ready && state == FOLLOW {
    state = IDLE
    report()
  }
}

on GlobalCustomEvent("pik.reset") {
  body.DestroySpawnedPrefab()
  ReadBrickGrid().DestroySpawnedPrefab()
}

// ---- treasure handshake ----
on GlobalCustomEvent("tr.grab") -> (i: int, id: int, tb: entity, radius: float) {
  if ready && i == idx {
    if state == LANDED {
      trId = id
      trBody = tb
      trRadius = radius
      let tp = tb.GetLocation()
      carryAngle = atan2(pos.y - tp.y, pos.x - tp.x)
      state = CARRY
      report()
    } else {
      // Already carrying something else, or whistled away: turn it down.
      if trId != id {
        SendGlobalCustomEvent("tr.leave", id, idx)
      }
    }
  }
}

on GlobalCustomEvent("tr.done") -> (id: int) {
  if ready && state == CARRY && trId == id {
    trId = -1
    state = IDLE
    report()
  }
}

// ---- per-tick simulation ----
on ServerUptime() {
  if ready {
    let dt = min(DeltaTime(), 0.1)
    tick += 1

    if state == THROWN {
      // Kinematic arc: lands exactly where the captain aimed.
      throwT += dt
      let u = clamp(throwT / throwDur, 0.0, 1.0)
      let arcH = 40.0 + Distance(throwFrom, throwTo) * 0.3
      pos = lerp(throwFrom, throwTo, u) + Vec(0.0, 0.0, 4.0 * arcH * u * (1.0 - u))
      spin = spin + SPIN_SPEED * dt
      vz = 0.0
      if u >= 1.0 {
        spin = 0.0
        state = LANDED
        landedTicks = 0
        SendGlobalCustomEvent("pik.landed", pos, idx)
        report()
      }
    } else {
      if state == FOLLOW {
        // Each pikmin keeps its own spot in a sunflower spiral around the captain.
        let cp = captain.GetLocation()
        let a = idx * 2.39996
        let r = 55.0 + 16.0 * sqrt(idx)
        let flat = Vec(cp.x + cos(a) * r - pos.x, cp.y + sin(a) * r - pos.y, 0.0)
        let d = Magnitude(flat)
        if d > 6.0 {
          let speed = if d > 400.0 then RUN_SPEED else WALK_SPEED
          pos = pos + flat * (min(d, speed * dt) / d)
          yaw = Rad2Deg(atan2(flat.y, flat.x))
        }
      }

      if state == CARRY {
        // Stand on a ring around the treasure, facing its center.
        let tp = trBody.GetLocation()
        let ring = trRadius + RING_PAD
        pos = Vec(tp.x + cos(carryAngle) * ring, tp.y + sin(carryAngle) * ring, pos.z)
        yaw = Rad2Deg(carryAngle) + 180.0
      }

      if state == LANDED {
        landedTicks += 1
        if landedTicks == 8 {
          // Say it again in case the first shout was missed.
          SendGlobalCustomEvent("pik.landed", pos, idx)
        }
        if landedTicks > GIVE_UP_TICKS {
          state = IDLE
          report()
        }
      }

      // Gravity against the ground height found by last tick's sweep.
      if pos.z > groundZ + 1.0 {
        vz = vz - GRAVITY * dt
        pos = Vec(pos.x, pos.y, max(pos.z + vz * dt, groundZ))
      } else {
        vz = 0.0
        pos = Vec(pos.x, pos.y, groundZ)
      }
    }

    body.SetLocationRotation(pos + Vec(0.0, 0.0, FOOT_Z), Rotation(spin, yaw, 0.0))

    // Self-heal the onion's bookkeeping a few times a second.
    if (tick + idx * 7) % 20 == 0 {
      report()
    }

    // Probe the ground under us for next tick.
    let probe = Sweep(pos + Vec(0.0, 0.0, STEP_UP), Vec(0.0, 0.0, -1.0), STEP_UP + 3000.0,
      ignore = body, detectBricks = true, detectMap = true)
    on probe.Hit {
      groundZ = probe.HitLocation.z
    }
    on probe.Miss {
      groundZ = pos.z - 3000.0
    }
  }
}
