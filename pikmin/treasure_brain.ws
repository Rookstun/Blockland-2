// treasure_brain.ws -- the brain of ONE carryable item.
//
// onion.ws spawns one copy per treasure. It spawns the item's brick body, keeps
// the list of pikmin holding it, and once enough pikmin have hold of it, walks
// it back to the onion. The onion turns each delivered treasure into sprouts.

// ---- kinds: 0 pellet, 1 gem, 2 chest ----
// weight = pikmin needed to lift it, value = sprouts it yields,
// radius = how far out the carriers stand, maxCarriers = crowd limit.

// ---- tuning ----
const BASE_SPEED = 90.0       // walking speed with exactly `weight` carriers
const EXTRA_SPEED = 25.0      // bonus speed per carrier over `weight`
const MAX_SPEED = 260.0
const LIFT = 6.0              // raised off the ground while carried
const GRAVITY = 1500.0
const STEP_UP = 30.0
const GRAB_PAD = 45.0         // landing this close to the edge grabs it
const DELIVER_DIST = 90.0     // horizontal distance to the onion that counts as home
const MOUTH_Z = 150.0         // where treasures get sucked up to, above the onion base
const SUCK_TIME = 1.2

var ready: bool = false
var id: int = 0
var weight: int = 1
var value: int = 1
var radius: float = 20.0
var maxCarriers: int = 2
var onionPos: vector = Vec(0.0, 0.0, 0.0)
var body: entity = null

var pos: vector = Vec(0.0, 0.0, 0.0)
var groundZ: float = -100000.0
var vz: float = 0.0
var yaw: float = 0.0
var carriers: int[]

var delivering: bool = false
var suckT: float = 0.0
var suckFrom: vector = Vec(0.0, 0.0, 0.0)

mod announce() {
  SendGlobalCustomEvent("tr.count", id, carriers.length(), weight)
}

on GlobalCustomEvent("tr.init", isObject = true) -> (i: int, kind: int, at: vector, onion: vector) {
  id = i
  onionPos = onion
  if kind == 1 {
    weight = 3
    value = 5
    radius = 22.0
    maxCarriers = 8
    body = SpawnPrefab(prefab = $./treasure_gem.brz, lifetime = 0.0, limit = 1)
  } else {
    if kind == 2 {
      weight = 8
      value = 12
      radius = 42.0
      maxCarriers = 16
      body = SpawnPrefab(prefab = $./treasure_chest.brz, lifetime = 0.0, limit = 1)
    } else {
      weight = 1
      value = 2
      radius = 12.0
      maxCarriers = 3
      body = SpawnPrefab(prefab = $./treasure_pellet.brz, lifetime = 0.0, limit = 1)
    }
  }
  body.SetFrozen(true)
  pos = at
  groundZ = at.z
  body.SetLocation(pos)
  ready = true
}

// A pikmin landed somewhere; if it is next to us, take it on as a carrier.
on GlobalCustomEvent("pik.landed") -> (p: vector, pikIdx: int) {
  if ready && !delivering {
    let flatD = Distance(Vec(p.x, p.y, 0.0), Vec(pos.x, pos.y, 0.0))
    if flatD < radius + GRAB_PAD && abs(p.z - pos.z) < 120.0 {
      let f = carriers.find(pikIdx)
      if !f.Found && carriers.length() < maxCarriers {
        carriers.push(pikIdx)
        SendGlobalCustomEvent("tr.grab", pikIdx, id, body, radius)
        announce()
      } else {
        if f.Found {
          // Duplicate shout: confirm again so the pikmin is sure.
          SendGlobalCustomEvent("tr.grab", pikIdx, id, body, radius)
        }
      }
    }
  }
}

on GlobalCustomEvent("tr.leave") -> (tid: int, pikIdx: int) {
  if ready && tid == id {
    let f = carriers.find(pikIdx)
    if f.Found {
      carriers.remove(f.Index)
      announce()
    }
  }
}

on GlobalCustomEvent("pik.reset") {
  body.DestroySpawnedPrefab()
  ReadBrickGrid().DestroySpawnedPrefab()
}

on ServerUptime() {
  if ready {
    let dt = min(DeltaTime(), 0.1)

    if delivering {
      // Get sucked up into the onion, then turn into sprouts.
      suckT += dt
      let u = clamp(suckT / SUCK_TIME, 0.0, 1.0)
      pos = lerp(suckFrom, onionPos + Vec(0.0, 0.0, MOUTH_Z), u)
      yaw = yaw + 360.0 * dt
      body.SetLocationRotation(pos, Rotation(0.0, yaw, 0.0))
      if u >= 1.0 {
        SendGlobalCustomEvent("tr.delivered", id, value)
        body.DestroySpawnedPrefab()
        ReadBrickGrid().DestroySpawnedPrefab()
        ready = false
      }
    } else {
      let n = carriers.length()
      let carried = n >= weight
      if carried {
        let flat = Vec(onionPos.x - pos.x, onionPos.y - pos.y, 0.0)
        let d = Magnitude(flat)
        if d < DELIVER_DIST {
          delivering = true
          suckT = 0.0
          suckFrom = pos
          SendGlobalCustomEvent("tr.done", id)
          carriers.clear()
        } else {
          let speed = min(BASE_SPEED + EXTRA_SPEED * (n - weight), MAX_SPEED)
          pos = pos + flat * (min(d, speed * dt) / d)
          yaw = Rad2Deg(atan2(flat.y, flat.x))
        }
      }

      if pos.z > groundZ + 1.0 {
        vz = vz - GRAVITY * dt
        pos = Vec(pos.x, pos.y, max(pos.z + vz * dt, groundZ))
      } else {
        vz = 0.0
        pos = Vec(pos.x, pos.y, groundZ)
      }

      let lift = if carried then LIFT else 0.0
      body.SetLocationRotation(pos + Vec(0.0, 0.0, lift), Rotation(0.0, yaw, 0.0))

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
}
