# Stamps a mapgen output's prefabs into the live world: spawners, shops, pots.
#   python3 loadextras.py MAPDIR
# Spawners that the game drops for overlapping (no Component_BotSpawn attached)
# are retried a brick higher, up to 4 bricks.
import json, subprocess, sys

M = sys.argv[1].rstrip("/") + "/"
TOOLS = "/home/max/omegga-server/bridge/tools"


def job(ops):
    json.dump({"ops": ops}, open("/tmp/extrasjob.json", "w"))
    out = subprocess.run(["node", "job.mjs", "/tmp/extrasjob.json"], cwd=TOOLS, capture_output=True, text=True).stdout
    return json.loads(out)["results"]


def load(prefab, x, y, z, orient=16):
    return {"op": "cmd", "line": f'br.Prefab.Load "{prefab}" {x} {y} {z} 0 {orient}', "captureMs": 250}


spawners = [(e.get("prefab") or f"dungeon_spawner_{e['tier']}", *e["at"]) for e in json.load(open(M + "spawners.json"))]
# Bot homes (owner 2026-10-10): each spot loads its own copy of the spawner
# prefab with Component_BotSpawn MoveTarget = that spot, or the bots wander
# off toward (0,0,0). homes.mjs prefab writes Prefabs/home_sp_<i>.brz.
PREFABS = "/home/max/omegga-server/data/Saved/Prefabs/"
for i, (p, x, y, z) in enumerate(spawners):
    subprocess.run(["node", "homes.mjs", "prefab", PREFABS + p + ".brz", PREFABS + f"home_sp_{i}.brz", str(x), str(y), str(z)], cwd=TOOLS, check=True, capture_output=True)
spawners = [(f"home_sp_{i}", x, y, z) for i, (p, x, y, z) in enumerate(spawners)]
res = job([load(p, x, y, z) for p, x, y, z in spawners])
todo = [s for s, r in zip(spawners, res) if "Component_BotSpawn" in json.dumps(r)]
print(f"spawners: {len(spawners) - len(todo)} of {len(spawners)} first time")
for lift in (12, 24, 36, 48):
    if not todo:
        break
    res = job([load(p, x, y, z + lift) for p, x, y, z in todo])
    todo = [s for s, r in zip(todo, res) if "Component_BotSpawn" in json.dumps(r)]
    print(f"  lifted {lift}: {len(todo)} still overlapping")
print("  not placed:", todo)

# bushes.json (2026-10-10): smashable bushes, prefab "bush" (potgen5.mjs KIND=bush)
import os
# gems.json (2026-10-16): mineable cave gems, prefab per entry (gem_<kind>, pots/gemgen.mjs), z = the floor
for name in ("shops", "pots", "bushes", "casino", "gems"):  # casino.json: the games (pots/casinogen.mjs prefabs)
    if not os.path.exists(M + name + ".json"):
        continue
    items = json.load(open(M + name + ".json"))
    # (2026-10-16) the owner's bush (pots/bushown.mjs) sits 8 below its prefab origin: loaded 8 up
    ops = [load(e.get("prefab", "bush" if name == "bushes" else "pot"), e["at"][0], e["at"][1], e["at"][2] + (8 if name == "bushes" else 0), e.get("orient", 16)) for e in items]
    res = [x for i in range(0, len(ops), 150) for x in job(ops[i:i + 150])]  # job.mjs waits 60 s at most
    bad = [o["line"] for o, r in zip(ops, res) if any(w in json.dumps(r) for w in ("not found", "overlapping", "Missing brick"))]
    print(f"{name}: {len(ops) - len(bad)} of {len(ops)} clean", bad[:5])

# World controllers that live in the world, not in the map: a full clear
# (BR.World.ClearAll) removes them, and without skeleton_drop nothing tracks
# hits, credits kills, drops coins or gives XP (2026-10-08 outage).
CONTROLLERS = [("skeleton_drop", -8260, -7400, 8000), ("speakspell", -8200, -7400, 8000), ("tts", -8140, -7400, 8000), ("pot_pool", -8080, -7400, 8000), ("casino_house", -8020, -7400, 8000),
               # Wordle bulletin board (wordle/gen.mjs, 2026-10-15): plaza lawn NE of the fountain, faces -y; ground z 624 in out_delta
               ("wordle", 560, 250, 624),
               # hitsplats (hitsplat/build.mjs, 2026-10-18): damage number over every hit
               ("hitsplat", -7800, -12000, 8000)]
res = job([load(p, x, y, z) for p, x, y, z in CONTROLLERS])
for (p, *_), r in zip(CONTROLLERS, res):
    print(f"controller {p}:", "clean" if not any(w in json.dumps(r) for w in ("not found", "overlapping", "Missing brick")) else r)

# Duel arena (arena/arenagen.mjs, plugin duel): sky colosseum at (-8200,-9400), floor z 8000.
ARENA = "/home/max/omegga-server/bridge/arena/arena_bricks.json"
OWNER = {"id": "891c4675-d18a-4ce1-a465-f4193ffe8b39", "name": "abysmal garbage"}
res = job([{"op": "bricks", "at": [0, 0, 0], "owner": OWNER, "captureMs": 4000, "bricks": json.load(open(ARENA))["bricks"]}])
print("arena:", "clean" if "overlapping" not in json.dumps(res) else "OVERLAPS")
