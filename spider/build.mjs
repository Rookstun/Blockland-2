// WALKING SPIDER (owner 2026-11-05: "here is a spider leg. make a spider that can fully walk to a position on a map
// or towards a player boston dynamics style"; leg = owner clipboard spider/leg_owner.brz: 3 black 10x10x120 bars,
// joints 130 apart). node spider/build.mjs -> spider/seg.brz, body.brz, spider.gen.ws, spider.brz
// spider.brz = ONE hidden chip (owner renderman: SpawnPrefab needs an admin owner). On its first tick it spawns the
// body + 24 leg segments (frozen, collision off) where it stands; every tick after that it moves the body toward
// its goal and poses each leg by IK (segment 1 fixed 50 deg up, 2-bone IK for 2+3, knee up). A planted foot steps
// when it lags its home spot by STEP; a leg may not lift while a neighbour (same side front/back, or its mirror)
// is in the air. Foot targets = chained 100-unit Sweeps straight down (a Sweep reaches at most 100 units).
// /spider die removes the body + legs until the next command brings it back where the chip floats.
// Chat: /spider (follow me), /spider here, /spider goto X Y, /spider follow NAME, /spider stop, /spider where, /spider die
// Load: br.Prefab.Load "spider" x y z 0 16 with z = ground + 300 (UP: the chip floats, the spider stands below it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { reown, OWNER } from '../pots/reown.mjs';
import { bundle } from '../tools/wsbundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MAP_OWNER = { id: OWNER.id, name: OWNER.name, display_name: OWNER.display };
const L = 130, H = 100, R = 250, A1 = 50;        // segment length (owner's leg), body height, foot radius, seg 1 pitch
const STEP = 55, SETTLE = 15, LEAD = 0.3, SWING = 0.28, LIFT = 45;
const SPEED = 140, ACC = 220, TURN = 90, FOLLOW_GAP = 200, GOTO_GAP = 20;
const DROPS = 5;                                  // sweeps of 100 down from body z + 150
const UP = 300;                                   // the chip floats UP above the ground it was loaded for (at ground it overlaps the floor)

// ---- compiler (same as portal/build.mjs)
const sdk = path.join(here, '..', 'tools', 'wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
const diag = wasm.wirescript_diagnostics ?? wasm.default?.wirescript_diagnostics;
function compile(src, name, prefabs = {}) {
  let bad = 0;
  for (const d of JSON.parse(diag(src, name, '{}') || '[]')) { console.error(`${name}: ${d.severity} ${d.code} line ${d.startLine}: ${d.message}`); if (d.severity === 'error') bad++; }
  if (bad) process.exit(1);
  const reg = Object.fromEntries(Object.entries(prefabs).map(([k, v]) => [k, Array.from(v)]));
  return new Uint8Array(compileWs(src, name, '{}', JSON.stringify(reg)));
}
const lib = await import(pathToFileURL(path.join(here, '..', 'tools', 'brs4', 'dist.mjs')).href);
const OFF = { player: false, weapon: false, interaction: false, physics: false, tool: false };

// ---- plain prefabs (bricks on the world grid; SpawnPrefab makes each one its own moving grid, origin = 0,0,0)
function prefab(name, bricks, description) {
  const boxes = bricks.map(([s, p]) => ({ lo: p.map((v, i) => v - s[i]), hi: p.map((v, i) => v + s[i]) }));
  boxes.forEach((p, i) => boxes.slice(i + 1).forEach(q => {
    if (p.lo.every((v, k) => v < q.hi[k]) && q.lo.every((v, k) => v < p.hi[k])) throw Error(`${name}: overlap ${JSON.stringify(p)} ${JSON.stringify(q)}`);
  }));
  const w = new lib.World();
  const O = w.addOwner(MAP_OWNER);
  for (const [size, position, color, more = {}] of bricks)
    w.addBrick({ asset: 'PB_DefaultMicroBrick', size, position, color, owner_index: O, collision: OFF, ...more });
  w.makePrefab({});
  const out = w.toBrz({ bundle: { description } });
  fs.writeFileSync(path.join(here, `${name}.brz`), out);
  return out;
}
const BLACK = [0, 0, 0], GREY = [86, 86, 86], DARK = [34, 34, 36], GLOW = { material: 'BMC_Glow', material_intensity: 3 };
// leg segment: pivot (joint) at the origin, bone along +x to the next joint at x = L (owner's bar: 120 long, 10 thick)
const seg = prefab('seg', [
  [[6, 7, 7], [0, 0, 0], GREY],
  [[60, 5, 5], [66, 0, 0], BLACK],
], 'spider leg segment');
// body: faces +x, +y = its right; hips at x 45..-45, y +-40, z 0
const body = prefab('body', [
  [[60, 45, 18], [0, 0, 0], DARK],                 // thorax
  [[50, 38, 4], [0, 0, 22], GREY],                 // top plate
  [[16, 30, 14], [76, 0, 4], BLACK],               // sensor head
  [[1, 6, 3], [93, 13, 8], [255, 20, 10], GLOW],   // eyes
  [[1, 6, 3], [93, -13, 8], [255, 20, 10], GLOW],
  [[1, 3, 2], [93, 5, -2], [255, 20, 10], GLOW],
  [[1, 3, 2], [93, -5, -2], [255, 20, 10], GLOW],
  [[50, 40, 30], [-110, 0, 12], BLACK],            // abdomen
  [[30, 8, 2], [-110, 0, 44], [200, 25, 20]],      // red stripe on top
], 'spider body');

// ---- brain source (one block per leg, unrolled: no array reads after writes)
const f1 = v => (Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(4)));
const ANG = [40, 75, 105, 140];
const LEGS = [...Array(8).keys()].map(i => {
  const side = i < 4 ? 1 : -1, j = i % 4, th = ANG[j] * Math.PI / 180;
  return { i, side, j, hip: [45 - 30 * j, 40 * side, 0], home: [R * Math.cos(th), side * R * Math.sin(th)] };
});
const nb = i => { const s = i < 4 ? 0 : 4, j = i % 4; return [j > 0 && s + j - 1, j < 3 && s + j + 1, (i + 4) % 8].filter(x => x !== false); };
const wrap = e => `(${e} - 360.0 * floor((${e} + 180.0) / 360.0))`;
const world = (lx, ly) => [`(px + c * ${f1(lx)} - s * ${f1(ly)})`, `(py + s * ${f1(lx)} + c * ${f1(ly)})`];
const segPose = (e, at, a, yawVar) => `  ${e}.SetLocationRotation(${at}, Rotation(Rad2Deg(atan2(sin(${a}), abs(cos(${a})))), if cos(${a}) >= 0.0 then ${yawVar} else ${wrap(`(${yawVar} + 180.0)`)}, 0.0))`;

const legBlock = ({ i, hip, home }) => {
  const [hx, hy] = world(...hip), [mx, my] = world(...home);
  const drop = k => k === DROPS
    ? `${'  '.repeat(k + 2)}b${i} = Vec(gx${i}, gy${i}, pz - ${f1(H)})
${'  '.repeat(k + 2)}misses += 1`
    : `${'  '.repeat(k + 2)}let d${i}_${k} = Sweep(Vec(gx${i}, gy${i}, pz + ${f1(150 - 100 * k)}), Vec(0.0, 0.0, -1.0), 100.0, ignoreList = parts, detectBricks = true, detectMap = true)
${'  '.repeat(k + 2)}if d${i}_${k}.Hit {
${'  '.repeat(k + 3)}b${i} = d${i}_${k}.HitLocation
${'  '.repeat(k + 3)}hits += 1
${'  '.repeat(k + 2)}} else {
${drop(k + 1)}
${'  '.repeat(k + 2)}}`;
  return `
  // ---- leg ${i}
  let gx${i} = ${mx} + vx * ${f1(LEAD)}
  let gy${i} = ${my} + vy * ${f1(LEAD)}
  let lag${i} = sqrt((gx${i} - B${i}.x) * (gx${i} - B${i}.x) + (gy${i} - B${i}.y) * (gy${i} - B${i}.y))
  let want${i} = T${i} >= 1.0 && lag${i} > (if v2 > 5.0 then ${f1(STEP)} else ${f1(SETTLE)})
  let lift${i} = want${i}${nb(i).map(k => ` && T${k} >= 1.0`).join('')}${nb(i).filter(k => k < i).map(k => ` && !lift${k}`).join('')}
  let nt${i} = min(T${i} + dt / ${f1(SWING)}, 1.0)
  let ez${i} = nt${i} * nt${i} * (3.0 - 2.0 * nt${i})
  let F${i} = if T${i} < 1.0 then lerp(A${i}, B${i}, ez${i}) + Vec(0.0, 0.0, ${f1(LIFT)} * sin(3.14159265 * nt${i})) else B${i}
  if T${i} < 1.0 {
    t${i} = nt${i}
  } else {
    if lift${i} {
      a${i} = B${i}
      t${i} = 0.0
${drop(0)}
    }
  }
  let hpx${i} = ${hx}
  let hpy${i} = ${hy}
  let hpz${i} = pz2
  let wx${i} = F${i}.x - hpx${i}
  let wy${i} = F${i}.y - hpy${i}
  let hl${i} = max(sqrt(wx${i} * wx${i} + wy${i} * wy${i}), 1.0)
  let ux${i} = wx${i} / hl${i}
  let uy${i} = wy${i} / hl${i}
  let ly${i} = Rad2Deg(atan2(wy${i}, wx${i}))
  let k1${i} = Vec(hpx${i} + ux${i} * C1, hpy${i} + uy${i} * C1, hpz${i} + S1)
  let sx${i} = hl${i} - C1
  let sz${i} = F${i}.z - k1${i}.z
  let dd${i} = clamp(sqrt(sx${i} * sx${i} + sz${i} * sz${i}), 1.0, ${f1(2 * L - 1)})
  let ba${i} = atan2(sz${i}, sx${i})
  let al${i} = acos(dd${i} / ${f1(2 * L)})
  let a2${i} = ba${i} + al${i}
  let a3${i} = ba${i} - al${i}
  let k2${i} = k1${i} + Vec(ux${i} * ${f1(L)} * cos(a2${i}), uy${i} * ${f1(L)} * cos(a2${i}), ${f1(L)} * sin(a2${i}))
  e${i * 3}.SetLocationRotation(Vec(hpx${i}, hpy${i}, hpz${i}), Rotation(${f1(A1)}, ly${i}, 0.0))
${segPose(`e${i * 3 + 1}`, `k1${i}`, `a2${i}`, `ly${i}`)}
${segPose(`e${i * 3 + 2}`, `k2${i}`, `a3${i}`, `ly${i}`)}`;
};

const src = `// GENERATED by spider/build.mjs: walking spider brain (one hidden chip). Edit build.mjs, not this file.
@invisible

const C1 = ${f1(L * Math.cos(A1 * Math.PI / 180))}
const S1 = ${f1(L * Math.sin(A1 * Math.PI / 180))}

var booted: bool = false
var dead: bool = false
var mode: int = 0
var ctl: controller
var goal: vector = Vec(0.0, 0.0, 0.0)
var pos: vector = Vec(0.0, 0.0, 0.0)
var yaw: float = 0.0
var speed: float = 0.0
var hits: int = 0
var misses: int = 0
var parts: entity[]
var bodyE: entity
${[...Array(24).keys()].map(k => `var e${k}: entity`).join('\n')}
${LEGS.map(({ i }) => `var a${i}: vector = Vec(0.0, 0.0, 0.0)\nvar b${i}: vector = Vec(0.0, 0.0, 0.0)\nvar t${i}: float = 1.0`).join('\n')}

on ChatCommand("spider", "Spider: /spider (follow me), here, goto X Y, follow NAME, stop, where, die") -> (c: controller, args: string) {
  let a = args.Trim()
  let al = a.ToLower()
  if a == "" || al == "come" || al == "me" {
    ctl = c
    dead = false
    mode = 1
    c.ShowStatusMessage("The spider turns all eight of its eyes toward you. Seven of them approve.")
  } else if al == "stop" {
    mode = 0
    c.ShowStatusMessage("The spider sits down and pretends this was its idea.")
  } else if al == "here" {
    goal = c.CharacterOf().GetLocation()
    dead = false
    mode = 2
    c.ShowStatusMessage("The spider memorizes this spot. It has a very small, very loyal brain.")
  } else if al.StartsWith("goto ") {
    let r = a.Substring(5, 200).Trim().Split(" ")
    goal = Vec(ParseNumber(r.Left), ParseNumber(r.Right.Trim()), 0.0)
    dead = false
    mode = 2
    c.ShowStatusMessage("The spider sets off with the confidence of something that cannot read a map.")
  } else if al.StartsWith("follow ") {
    let ch = FindPlayer(a.Substring(7, 200).Trim())
    ctl = ch.ControllerOf()
    dead = false
    mode = 1
    c.ShowStatusMessage("The spider picks up a scent. It is mostly fear, with notes of cheap cologne.")
  } else if al == "where" {
    PrintToConsole(Fmt("spider|{0}|{1}|{2}|{3}|{4}|hits {5}|misses {6}", pos.x, pos.y, pos.z, yaw, mode, hits, misses))
    c.ShowStatusMessage(Fmt("The spider is at {0}, {1}, {2}. It would like a raise.", round(pos.x), round(pos.y), round(pos.z)))
  } else if al == "die" {
    mode = 0
    bodyE.DestroySpawnedPrefab()
${[...Array(24).keys()].map(k => `    e${k}.DestroySpawnedPrefab()`).join('\n')}
    booted = false
    dead = true
    c.ShowStatusMessage("The spider folds up like a bad umbrella and is gone.")
  } else {
    c.ShowStatusMessage("The spider tilts its head. Try: /spider, here, goto X Y, follow NAME, stop, where, die")
  }
}

on Clock(interval = 0.0) {
  if dead {
  } else if !booted {
    let bb = SpawnPrefab(prefab = $./body.brz, lifetime = 0.0, limit = 1)
    bb.SetFrozen(true)
    bodyE = bb
${[...Array(24).keys()].map(k => `    let s${k} = SpawnPrefab(prefab = $./seg.brz, lifetime = 0.0, limit = 1)\n    s${k}.SetFrozen(true)\n    e${k} = s${k}`).join('\n')}
    parts = [bb, ${[...Array(24).keys()].map(k => `s${k}`).join(', ')}]
    let o = bb.GetLocation()
    pos = o + Vec(0.0, 0.0, ${f1(H - UP)})
    yaw = 0.0
    speed = 0.0
${LEGS.map(({ i, home }) => `    b${i} = Vec(o.x + ${f1(home[0])}, o.y + ${f1(home[1])}, o.z - ${f1(UP)})\n    t${i} = 1.0`).join('\n')}
    booted = true
  } else {
    // read every var once, then compute, then write
    let dt = clamp(DeltaTime(), 0.0, 0.05)
    let P = pos
    let Y = yaw
    let V = speed
    let M = mode
    let G = goal
${LEGS.map(({ i }) => `    let A${i} = a${i}\n    let B${i} = b${i}\n    let T${i} = t${i}`).join('\n')}
    let tgt = if M == 1 then ctl.CharacterOf().GetLocation() else G
    let dx = tgt.x - P.x
    let dy = tgt.y - P.y
    let dist = sqrt(dx * dx + dy * dy)
    let gap = if M == 1 then ${f1(FOLLOW_GAP)} else ${f1(GOTO_GAP)}
    let active = M != 0 && MagnitudeSq(tgt) > 1.0 && dist > gap
    let err = ${wrap('(Rad2Deg(atan2(dy, dx)) - Y)')}
    let turn = if active then clamp(err, 0.0 - ${f1(TURN)} * dt, ${f1(TURN)} * dt) else 0.0
    let y2 = ${wrap('(Y + turn)')}
    let vt = if active then ${f1(SPEED)} * clamp(1.0 - abs(err) / 70.0, 0.0, 1.0) * clamp((dist - gap) / 120.0, 0.25, 1.0) else 0.0
    let v2 = V + clamp(vt - V, 0.0 - ${f1(ACC)} * dt, ${f1(ACC)} * dt)
    let c = cos(Deg2Rad(y2))
    let s = sin(Deg2Rad(y2))
    let vx = c * v2
    let vy = s * v2
    let px = P.x + vx * dt
    let py = P.y + vy * dt
    let gz = (${LEGS.map(({ i }) => `B${i}.z`).join(' + ')}) / 8.0
    let pz = P.z
    let pz2 = P.z + (gz + ${f1(H)} - P.z) * min(1.0, 3.0 * dt)
    if M == 2 && !active {
      mode = 0
    }
    pos = Vec(px, py, pz2)
    yaw = y2
    speed = v2
    bodyE.SetLocationRotation(Vec(px, py, pz2), Rotation(0.0, y2, 0.0))
${LEGS.map(legBlock).join('\n')}
  }
}
`;
fs.writeFileSync(path.join(here, 'spider.gen.ws'), src);
const chip = reown(compile(src, 'spider', { './seg.brz': seg, './body.brz': body }));
const b = await bundle(chip, { owner: MAP_OWNER, hide: true });
const out = b.finish({ description: 'walking spider (spider/build.mjs)' });
fs.writeFileSync(path.join(here, 'spider.brz'), out);

// every microchip hidden (owner rule)
const r = lib.WorldReader.from(out), as = r.brickAssets().map(a => a.name ?? a);
const shown = [...r.bricks(1)].filter(x => as[x.asset_name_index] === 'B_1x1_Microchip' && (x.visibility !== false || x.collision?.player));
if (shown.length) throw Error(`spider.brz: ${shown.length} visible microchips`);
console.log('spider.brz', out.length, 'bytes; gates', r.gridIds().length, 'grids');
