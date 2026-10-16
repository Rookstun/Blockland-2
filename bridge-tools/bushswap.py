# swap every smashable bush in the live world for the owner's bush (pots/bushown.mjs -> Prefabs/bush.brz)
# per spot: clear the old one (bush + sound + chip column, and the 4 hidden target-plate spots 30 out),
# (paced: the server drops clears issued in the same tick) then load the new one 8 up (its bush sits 8 below its prefab origin)
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
        for dx, dy in ((30, 0), (-30, 0), (0, 30), (0, -30)):
            ops.append({"op": "cmd", "line": f"br.World.ClearRegion {x + dx} {y + dy} {z + 4} 20 20 20", "captureMs": 120})  # the target plates' bounds are wider than 2x2: a 20 box
    ops.append({"op": "sleep", "ms": 1500})
    for e in spots[i:i + B]:
        x, y, z = e["at"]
        ops.append({"op": "cmd", "line": f'br.Prefab.Load "bush" {x} {y} {z + 8} 0 16'})
    ops.append({"op": "sleep", "ms": 1500})
    job(ops)
    print(f"bushes {i + len(spots[i:i + B])}/{len(spots)}", flush=True)
