# Applies the prefab placements that differ between two map dirs to the live
# world (spawners, pots, smashable bushes, shops), the extras' half of a delta deploy
# (deltadeploy.py does the bricks).
#   python3 extrasdiff.py OLD_MAPDIR NEW_MAPDIR WORLD.brdb
# Spawners: the live one nearest each gone spot (it may have been lifted on
# load) is cleared; each new spot loads its own homed copy (homes.mjs), lifted a
# brick at a time if the game drops it for overlapping. Pots and bushes: cleared
# by a box round the prefab, loaded at the spot.
import json, os, subprocess, sys
OLD, NEW, WORLD = sys.argv[1].rstrip("/") + "/", sys.argv[2].rstrip("/") + "/", sys.argv[3]
TOOLS = "/home/max/omegga-server/bridge/tools"
PREFABS = "/home/max/omegga-server/data/Saved/Prefabs/"
NODE = "/home/max/node22/bin/node"


def job(ops):
    out = subprocess.run([NODE, "job.mjs"], input=json.dumps({"ops": ops}), cwd=TOOLS, capture_output=True, text=True).stdout
    try:
        return json.loads(out)["results"]
    except Exception:
        return []


def diff(name):
    a = json.load(open(OLD + name + ".json")) if os.path.exists(OLD + name + ".json") else []
    b = json.load(open(NEW + name + ".json")) if os.path.exists(NEW + name + ".json") else []
    k = lambda e: json.dumps(e, sort_keys=True)
    ka, kb = {k(e) for e in a}, {k(e) for e in b}
    return [e for e in a if k(e) not in kb], [e for e in b if k(e) not in ka]


# live spawner positions (homes may have lifted them)
live = json.loads(subprocess.run([NODE, "-e", """
import('/home/max/omegga-server/plugins/bridge/lib/brs.mjs').then(async brs => {
  const { DatabaseSync } = await import('node:sqlite');
  const r = new brs.Brdb(new DatabaseSync(process.argv[1], { readOnly: true })).worldReader(), out = [];
  for (const { index: idx } of r.brickChunkIndex(1)) { let cc; try { cc = r.componentChunk(1, idx); } catch { continue; }
    const rel = r.brickChunkSoa(1, idx).RelativePositions;
    for (const c of cc.components) if (c.typeName === 'Component_BotSpawn' && rel[c.brickIndex]) { const p = rel[c.brickIndex]; out.push([idx.x * 2048 + 1024 + p.X, idx.y * 2048 + 1024 + p.Y, idx.z * 2048 + 1024 + p.Z]); } }
  console.log(JSON.stringify(out));
});""", WORLD], capture_output=True, text=True).stdout or "[]")

gone, new = diff("spawners")
ops = []
for e in gone:
    x, y, z = e["at"]
    near = min(live, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2 + ((p[2] - z) / 4) ** 2, default=None)
    if near and abs(near[0] - x) < 30 and abs(near[1] - y) < 30 and -10 <= near[2] - z <= 60:
        ops.append({"op": "cmd", "line": f"br.World.ClearRegion {near[0]} {near[1]} {near[2]} 25 25 8", "captureMs": 200})
    else:
        print("spawner not found live:", e["at"])
job(ops)
print(f"spawners: cleared {len(ops)} of {len(gone)} gone")
placed = 0
for i, e in enumerate(new):
    x, y, z = e["at"]
    base = e.get("prefab") or f"dungeon_spawner_{e['tier']}"
    name = f"home_new_{x}_{y}".replace("-", "m")
    for lift in (0, 12, 24, 36, 48):
        subprocess.run([NODE, "homes.mjs", "prefab", PREFABS + base + ".brz", PREFABS + name + ".brz", str(x), str(y), str(z + lift)], cwd=TOOLS, capture_output=True)
        r = job([{"op": "cmd", "line": f'br.Prefab.Load "{name}" {x} {y} {z + lift} 0 16', "captureMs": 1200}])
        if "Component_BotSpawn" not in json.dumps(r):
            placed += 1
            break
    else:
        print("spawner not placed:", e["at"])
print(f"spawners: placed {placed} of {len(new)} new")

# shops (2026-10-13: terraces raised the ground and the stands stayed buried): stand
# prefabs are 10x12x12 half extents round the load point; a gone stand is cleared by
# a 13 box (no map brick fits wholly in one at a stand spot)
# (2026-10-16) the bush is the owner's build (pots/bushown.mjs): its bush sits 8 below the prefab origin,
# so it loads 8 up (LDZ) and clears with a box from the bush foot to the chip on top
LDZ = {"bushes": 8}
# (2026-10-16) cave gems (pots/gemgen.mjs): 20 x 20 footprint on the floor, chip on top at +58: box z .. z+62
for name, prefab, box, dz in (("pots", "pot", (10, 10, 21), 0), ("bushes", "bush", (16, 16, 24), 4), ("shops", None, (13, 13, 13), 0), ("gems", None, (12, 12, 31), 31)):
    gone, new = diff(name)
    if name == "shops":
        for e in new:
            e.setdefault("prefab", "shop_" + e.get("tier", "bronze"))
    # (2026-10-18) sandro's vending machine (town.mjs vending): 12 back/front x 21 a side round the load point, floor -37 .. top +58
    cbox = lambda e: ((13, 22, 50) if e.get("orient", 16) % 2 == 0 else (22, 13, 50), 11) if e.get("prefab") == "vending" else (box, dz)
    job([{"op": "cmd", "line": f"br.World.ClearRegion {e['at'][0]} {e['at'][1]} {e['at'][2] + cbox(e)[1]} {cbox(e)[0][0]} {cbox(e)[0][1]} {cbox(e)[0][2]}", "captureMs": 150} for e in gone])
    job([{"op": "cmd", "line": f'br.Prefab.Load "{e.get("prefab", prefab)}" {e["at"][0]} {e["at"][1]} {e["at"][2] + LDZ.get(name, 0)} 0 {e.get("orient", 16)}', "captureMs": 150} for e in new])
    print(f"{name}: cleared {len(gone)}, loaded {len(new)}")
