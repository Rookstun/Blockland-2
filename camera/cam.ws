// cam.ws -- security camera + monitor (owner 2026-11-03: "we are going to make a camera", picked "security cam + monitor").
// The chip sits behind the monitor (world grid). It spawns the camera prop (cam_prop.brz, frozen); the picture is filmed
// from wherever the prop is (players can grab and carry it). Every tick 2 rows of the W x H picture from the prop: ray = forward + right*u + up*v, chained 100-unit
// sweeps (a Sweep reaches at most 100 units) over bricks, map and players, HitColor shaded by the hit normal and fogged,
// sky on a miss. Rows -> NS text strips of coloured blocks (2 rows each) wired to the screen. build.mjs fills //@...@.
// /cam here = camera at your eye looking where you look; /cam fov N (20..120); /cam off | on.
// Vars are read once at the top of a tick and written last (a Var read after its Set is stale).

@invisible

const W = //@W@
const BLK = //@BLK@

var live: bool = true
var E: vector = //@E0@
var yaw: float = //@YAW0@
var pitch: float = //@PITCH0@
var fov: float = 70.0
var rr: int = 0
var prop: entity
var chk: float = 0.0
var px: string[] = //@PX@
//@SVARS@

//@OUTS@

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
    prop.SetFrozen(true)
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
  // the view follows the prop: carry it, drop it, knock it over, it films from wherever it is. An empty entity (never
  // spawned, or dropped by a world reload) is at 0 0 0: then respawn it at the last remembered spot (E/yaw/pitch,
  // refreshed every 2 s). Freeze AFTER moving: a move wakes the grid.
  let lr = prop.GetLocationRotation()
  let pl = lr.Vector
  let have = Magnitude(pl) > 1.0
  if k0 + dt > 2.0 {
    chk = 0.0
    if have {
      let eu = lr.Rotation.ToEuler()
      E = pl
      yaw = eu.Yaw
      pitch = eu.Pitch
    } else {
      let e = SpawnPrefab(prefab = $./cam_prop.brz, lifetime = 0.0, limit = 4)
      e.SetLocationRotation(E0, Rotation(p0, y0, 0.0))
      e.SetFrozen(true)
      prop = e
      PrintToConsole(Fmt("cam|prop|{A:.0}|{B:.0}|{C:.0}", E0.x, E0.y, E0.z))
    }
  } else {
    chk = k0 + dt
  }
  if on0 && have {
    let F = Rotate(Vec(1.0, 0.0, 0.0), lr.Rotation)
    let R = Rotate(Vec(0.0, 1.0, 0.0), lr.Rotation)
    let U = Rotate(Vec(0.0, 0.0, 1.0), lr.Rotation)
    let TH = tan(Deg2Rad(f0) * 0.5)
    let TV = TH * //@ASPECT@
    let O = pl + F * 8.0
//@ROWS@
    let t = row0 .. "\n" .. row1
//@SET@
    rr = if rw + 1 >= //@NS@ then 0 else rw + 1
  }
}
