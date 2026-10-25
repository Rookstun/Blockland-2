# re-place every smashable bush with the current Prefabs/bush.brz (2026-10-25: weapon-collision wire fix,
# pots/bushweapon.mjs). Per spot: clear the bush + sound + chip column (paced: the server drops clears issued
# in the same tick), then load the prefab 8 up (its bush sits 8 below its prefab origin).
#   python3 bushreload.py bushes.json [from to]
import json, subprocess, sys
NODE = "/home/max/node22/bin/node"; TOOLS = "/home/max/omegga-server/bridge/tools"
spots = json.load(open(sys.argv[1]))
if len(sys.argv) > 2: spots = spots[int(sys.argv[2]):int(sys.argv[3])]
def job(ops):
    subprocess.run([NODE, "job.mjs"], input=json.dumps({"ops": ops}), cwd=TOOLS, capture_output=True, text=True)
B = 25
for i in range(0, len(spots), B):
    ops = []
    for e in spots[i:i + B]:
        x, y, z = e["at"]
        ops.append({"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z + 8} 16 16 26", "captureMs": 120})
    ops.append({"op": "sleep", "ms": 1500})
    for e in spots[i:i + B]:
        x, y, z = e["at"]
        ops.append({"op": "cmd", "line": f'br.Prefab.Load "bush" {x} {y} {z + 8} 0 16'})
    ops.append({"op": "sleep", "ms": 1500})
    job(ops)
    print(f"bushes {i + len(spots[i:i + B])}/{len(spots)}", flush=True)
