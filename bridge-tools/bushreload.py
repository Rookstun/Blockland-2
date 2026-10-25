# re-place every smashable bush with the current Prefabs/bush.brz (2026-10-25: weapon-collision wire fix,
# pots/bushweapon.mjs). ALL AT ONCE (owner): one job = every clear (bush + sound + chip column), a pause,
# then every prefab load 8 up (its bush sits 8 below its prefab origin).
#   python3 bushreload.py bushes.json [from to]
import json, subprocess, sys
NODE = "/home/max/node22/bin/node"; TOOLS = "/home/max/omegga-server/bridge/tools"
spots = json.load(open(sys.argv[1]))
if len(sys.argv) > 2: spots = spots[int(sys.argv[2]):int(sys.argv[3])]
ops = [{"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z + 8} 16 16 26"} for x, y, z in (e["at"] for e in spots)]
ops.append({"op": "sleep", "ms": 3000})
ops += [{"op": "cmd", "line": f'br.Prefab.Load "bush" {x} {y} {z + 8} 0 16'} for x, y, z in (e["at"] for e in spots)]
ops.append({"op": "sleep", "ms": 3000})
subprocess.run([NODE, "job.mjs"], input=json.dumps({"ops": ops}), cwd=TOOLS, capture_output=True, text=True)
print(f"bushes {len(spots)}", flush=True)
