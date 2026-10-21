import json, subprocess
spots = [(8450, -5420, 588, 4), (1150, 130, 636, 3), (867, 1235, 736, 14), (1135, -645, 592, 0)]
offs = [(0, 0, 0), (20, 0, 0), (-20, 0, 0), (0, 20, 0), (0, -20, 0), (20, 20, 0), (-20, -20, 0), (20, -20, 0), (-20, 20, 0), (0, 0, 4), (0, 0, 8)]
def run(ops):
    open("/home/max/potjob.json", "w").write(json.dumps({"ops": ops}))
    subprocess.run("/home/max/node22/bin/node job.mjs /home/max/potjob.json > /home/max/potjob.out", shell=True, cwd="/home/max/omegga-server/bridge/tools")
    return open("/home/max/potjob.out").read()
for x, y, z, k in spots:
    for dx, dy, dz in offs:
        out = run([{"op": "cmd", "line": f'br.Prefab.Load "pot_{k}" {x+dx} {y+dy} {z+dz} 0 16', "captureMs": 600}])
        if "overlapping" not in out:
            print("placed", x, y, z, "->", x+dx, y+dy, z+dz); break
    else: print("FAILED", x, y, z)
