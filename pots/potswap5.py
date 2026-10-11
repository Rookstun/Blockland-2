# Swaps the live pots for pot v5 and loads the pot_pool chip (2026-10-10).
import json, subprocess
pots = json.load(open("/tmp/map_biomes/pots.json"))
ops = [{"op": "say", "msg": "<b>Pots now shatter louder and the loot comes from the pot pool...</>"}]
for e in pots:
    x, y, z = e["at"]
    ops.append({"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z} 10 10 21", "captureMs": 120})
for e in pots:
    x, y, z = e["at"]
    ops.append({"op": "cmd", "line": f'br.Prefab.Load "{e.get("prefab", "pot")}" {x} {y} {z} 0 {e.get("orient", 16)}', "captureMs": 250})
ops.append({"op": "cmd", "line": 'br.Prefab.Load "pot_pool" -8080 -7400 8000 0 16', "captureMs": 800})
out = subprocess.run(["/home/max/node22/bin/node", "job.mjs"], input=json.dumps({"ops": ops}), cwd="/home/max/omegga-server/bridge/tools", capture_output=True, text=True).stdout
r = json.loads(out)["results"]
bad = [x for x in r if any(w in json.dumps(x) for w in ("overlapping", "not found", "Missing brick", "rror"))]
print(len(pots), "pots; results", len(r), "bad", len(bad))
print(json.dumps(bad[:2])[:600])
print(json.dumps(r[-1])[:500])
