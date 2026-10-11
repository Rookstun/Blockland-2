// onion.ws -- the Onion. Place this chip on the ground where you want the
// onion; it builds the onion around itself and runs the whole pikmin game.
//
// Chat commands:
//   /pikmin              become the captain (also builds the onion)
//   /pluck [n|all]       pluck n pikmin out of the onion (default 5); they follow you
//   /treasure [kind]     drop a treasure where you are aiming
//                        kind = pellet (1 pikmin), gem (3), chest (8); random if omitted
//   /pikmin_reset        remove every pikmin and treasure, refill the onion
//
// Controls (captain only, with nothing equipped):
//   Left mouse           throw a pikmin at the spot you are aiming at
//   Right mouse (hold)   whistle: pikmin near your cursor (or you) follow you
//   Q                    dismiss: followers stop and wait

// ---- states (keep in sync with pikmin_brain.ws) ----
const IDLE = 0
const FOLLOW = 1
const THROWN = 2

// ---- tuning ----
const MAX_PIKMIN = 60         // pikmin allowed on the field at once
const START_STOCK = 15        // pikmin waiting in the onion at the start
const PLUCK_DEFAULT = 5       // /pluck with no number plucks this many
const THROW_RANGE = 700.0     // max horizontal throw distance
const THROW_HEIGHT = 40.0     // throw starts this far above the captain's center
const WHISTLE_RADIUS = 220.0
const AIM_DIST = 4000.0
const SPROUT_MIN = 120.0      // new pikmin pop out landing this far from the onion...
const SPROUT_MAX = 260.0      // ...up to this far
const MOUTH_Z = 150.0         // where new pikmin pop out, above the onion base
const SPAWN_EVERY = 8         // ticks between pikmin spawns

// ---- captain ----
var captain: character = null
var captainId: string = ""
var hasCaptain: bool = false
var aimPoint: vector = Vec(0.0, 0.0, 0.0)
var prevLeft: bool = false
var prevQ: bool = false
var pluckQueue: int = 0       // pikmin still to pluck from /pluck

// ---- onion ----
var onionReady: bool = false
var onionPos: vector = Vec(0.0, 0.0, 0.0)
var onionBody: entity = null
var stock: int = START_STOCK
var pending: int = 0          // sprouts queued to pop out of the onion
var tick: int = 0

// ---- bookkeeping: one slot per pikmin ever spawned, indexed by pikmin idx ----
var states: int[]
var isFollow: int[]           // 1 while that pikmin follows (so .sum() counts them)
var nextTreasure: int = 0

mod setupOnion() {
  if !onionReady {
    onionPos = GetOwnTransform().Location
    onionBody = SpawnPrefab(prefab = $./onion_body.brz, lifetime = 0.0, limit = 1)
    onionBody.SetFrozen(true)
    onionBody.SetLocation(onionPos)
    onionReady = true
  }
}

on ChatCommand("pikmin", "Become the pikmin captain") -> (ctrl, args) {
  setupOnion()
  captain = ctrl.CharacterOf()
  captainId = ctrl.GetUserId()
  hasCaptain = true
  SendGlobalCustomEvent("pik.captain", captain)
  ctrl.ShowMessageBox(
    'Type <b>/pluck</b> (or <b>/pluck 10</b>, <b>/pluck all</b>) to pull pikmin out of the onion.<br>' ..
    '<b>Left click</b> throws a pikmin where you aim.<br>' ..
    'Hold <b>right click</b> to whistle pikmin back.<br>' ..
    '<b>Q</b> dismisses your squad.<br><br>' ..
    'Throw pikmin onto treasures - once enough grab one (pellet 1, gem 3, chest 8) ' ..
    'they carry it home and the onion makes more pikmin.<br>' ..
    'Spawn treasures with <b>/treasure</b>, <b>/treasure gem</b> or <b>/treasure chest</b>.<br>' ..
    'Unequip your tools/weapons first so clicks reach the pikmin.',
    title = "Pikmin Captain")
}

// Follow the captain across respawns.
on CharacterSpawned() -> (who) {
  if hasCaptain {
    let c = who.ControllerOf()
    if c.GetUserId() == captainId {
      captain = who
      SendGlobalCustomEvent("pik.captain", captain)
    }
  }
}

on ChatCommand("pluck", "Pluck pikmin out of the onion: /pluck, /pluck 10, /pluck all") -> (ctrl, args) {
  if !hasCaptain {
    ctrl.ShowStatusMessage("Type /pikmin first to become the captain.")
    return
  }
  setupOnion()
  let parsed = args.Trim().ParseInt()
  var n: int = PLUCK_DEFAULT
  if args.Contains("all") {
    n = stock
  } else {
    if parsed.Success && parsed.Value > 0 {
      n = parsed.Value
    }
  }
  pluckQueue = min(n, stock)
  if stock <= 0 {
    ctrl.ShowStatusMessage("The onion is empty - bring it treasure!")
  } else {
    ctrl.ShowStatusMessage("Plucking ${min(n, stock)} pikmin...")
  }
}

on ChatCommand("treasure", "Drop a treasure where you aim: pellet, gem or chest") -> (ctrl, args) {
  if !hasCaptain {
    ctrl.ShowStatusMessage("Type /pikmin first to become the captain.")
    return
  }
  setupOnion()
  var kind: int = 0
  if args.Contains("gem") {
    kind = 1
  } else {
    if args.Contains("chest") || args.Contains("big") {
      kind = 2
    } else {
      if args.Contains("pellet") {
        kind = 0
      } else {
        kind = Random(0, 2)
      }
    }
  }
  let tb = SpawnPrefab(prefab = $./treasure_brain.brz, lifetime = 0.0, limit = 40)
  tb.SetFrozen(true)
  nextTreasure += 1
  tb.SendGlobalCustomEvent("tr.init", nextTreasure, kind, aimPoint + Vec(0.0, 0.0, 20.0), onionPos)
}

on ChatCommand("pikmin_reset", "Remove all pikmin and treasures") -> (ctrl, args) {
  SendGlobalCustomEvent("pik.reset")
  states.clear()
  isFollow.clear()
  stock = START_STOCK
  pending = 0
  pluckQueue = 0
  ctrl.ShowStatusMessage("Pikmin reset. The onion holds ${START_STOCK} pikmin again.")
}

// Pikmin report their state whenever it changes (and every so often).
on GlobalCustomEvent("pik.state") -> (i: int, s: int) {
  if i < states.length() {
    states[i] = s
    isFollow[i] = s == FOLLOW
  }
}

on GlobalCustomEvent("tr.count") -> (id: int, n: int, w: int) {
  if hasCaptain {
    let c = captain.ControllerOf()
    if n >= w {
      c.ShowStatusMessage('<color="7CFC00">${n} / ${w}  - carrying it home!</>')
    } else {
      c.ShowStatusMessage("${n} / ${w} pikmin")
    }
  }
}

on GlobalCustomEvent("tr.delivered") -> (id: int, value: int) {
  pending += value
  onionBody.PlayAudioAt($BrickOneShotAudioDescriptor/OBA_UI_Goal_Tune_Cue)
  if hasCaptain {
    captain.ControllerOf().ShowStatusMessage('<color="FFD700">Treasure delivered! +${value} pikmin</>')
  }
}

on ServerUptime() {
  tick += 1

  if hasCaptain {
    let inp = captain.GetInputs()
    let cp = captain.GetLocation()

    // ---- throw (left click) ----
    let left = inp.PressedLeftMouse
    if left && !prevLeft {
      let f = isFollow.find(1)
      if f.Found {
        let dx = aimPoint.x - cp.x
        let dy = aimPoint.y - cp.y
        let d = max(sqrt(dx * dx + dy * dy), 0.01)
        let tooFar = d > THROW_RANGE
        let k = if tooFar then THROW_RANGE / d else 1.0
        let landZ = if tooFar then max(aimPoint.z, cp.z) else aimPoint.z
        let to = Vec(cp.x + dx * k, cp.y + dy * k, landZ)
        SendGlobalCustomEvent("pik.throw", f.Index, cp + Vec(0.0, 0.0, THROW_HEIGHT), to)
        states[f.Index] = THROWN
        isFollow[f.Index] = 0
      }
    }
    prevLeft = left

    // ---- whistle (hold right click) ----
    if inp.PressedRightMouse && tick % 6 == 0 {
      SendGlobalCustomEvent("pik.whistle", aimPoint, WHISTLE_RADIUS, cp)
    }

    // ---- dismiss (Q) ----
    let q = inp.PressedQ
    if q && !prevQ {
      SendGlobalCustomEvent("pik.dismiss")
    }
    prevQ = q

    // ---- HUD ----
    if tick % 15 == 0 {
      let c = captain.ControllerOf()
      let following = isFollow.sum()
      let field = states.length()
      c.DisplayText('<b>Pikmin</b>   squad <color="FF5050">${following}</>   field ${field}   onion ${stock + pending}',
        anchorX = 0.5, anchorY = 0.0, positionY = 60.0,
        fontSize = 26, justify = Center, lifetime = 1.0, textId = 71771)
    }

  }

  // ---- the one place pikmin get spawned ----
  let wantPluck = pluckQueue > 0 && stock > 0
  if onionReady && tick % SPAWN_EVERY == 0 && states.length() < MAX_PIKMIN {
    if wantPluck || pending > 0 {
      let mouth = onionPos + Vec(0.0, 0.0, MOUTH_Z)
      let ang = Random(0, 359) * 0.0174533
      let dist = SPROUT_MIN + (SPROUT_MAX - SPROUT_MIN) * Random(0, 100) * 0.01
      let ground = onionPos + Vec(cos(ang) * dist, sin(ang) * dist, 0.0)
      // Plucked pikmin join the squad; sprouts pop out and wait by the onion.
      let mode = if wantPluck then FOLLOW else THROWN
      let start = if wantPluck then ground else mouth
      if wantPluck {
        stock -= 1
        pluckQueue -= 1
      } else {
        pending -= 1
      }
      let brain = SpawnPrefab(prefab = $./pikmin_brain.brz, lifetime = 0.0, limit = MAX_PIKMIN)
      brain.SetFrozen(true)
      let i = states.length()
      states.push(mode)
      isFollow.push(mode == FOLLOW)
      brain.SendGlobalCustomEvent("pik.init", captain, onionPos, i, mode, start, ground, Random(0, 2))
    }
  }

  // Field is full: sprouts wait inside the onion instead.
  if pending > 0 && states.length() >= MAX_PIKMIN {
    stock += pending
    pending = 0
  }

  // ---- where is the captain aiming? (used next tick; kept last on the chain) ----
  if hasCaptain {
    let aim = captain.GetAim()
    let r = Sweep(aim.Origin, aim.Direction, AIM_DIST, ignore = captain,
      detectBricks = true, detectMap = true)
    on r.Hit {
      aimPoint = r.HitLocation
    }
    on r.Miss {
      aimPoint = aim.Origin + aim.Direction * AIM_DIST
    }
  }
}
