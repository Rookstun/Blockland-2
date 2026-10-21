# pot v6 re-swap (2026-10-21): clear the first-pass world pots, load plan.json loads [x,y,z,colour]
import json, subprocess
plan = json.load(open("/home/max/potplan.json"))
def job(ops):
    open("/home/max/potjob.json", "w").write(json.dumps({"ops": ops}))
    subprocess.run("/home/max/node22/bin/node job.mjs /home/max/potjob.json > /home/max/potjob.out", shell=True, cwd="/home/max/omegga-server/bridge/tools")
job([{"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z + 4} 10 10 24", "captureMs": 150} for x, y, z in plan["clears"]] + [{"op": "sleep", "ms": 2000}])
job([{"op": "cmd", "line": f'br.Prefab.Load "pot_{k}" {x} {y} {z} 0 16', "captureMs": 250} for x, y, z, k in plan["loads"]] + [{"op": "sleep", "ms": 1500}])
print("done", len(plan["clears"]), len(plan["loads"]))
