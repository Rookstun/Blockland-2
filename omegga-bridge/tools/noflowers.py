# Clears every flower of a deployed map from the live world (owner 2026-10-10:
# "remove flowers"; mapgen now drops them at output, this is the live diff).
#   python3 noflowers.py FLOWERS.json     list of [x, y, z, hx, hy, hz] boxes (flower half extents + 1)
# One ClearRegion per flower: it only takes bricks entirely inside the box.
import json, subprocess, sys
boxes = json.load(open(sys.argv[1]))
TOOLS = "/home/max/omegga-server/bridge/tools"
for i in range(0, len(boxes), 1500):
    ops = [{"op": "cmd", "line": f"br.World.ClearRegion {x} {y} {z} {a} {b} {c}"} for x, y, z, a, b, c in boxes[i:i + 1500]]
    out = subprocess.run(["/home/max/node22/bin/node", "job.mjs"], input=json.dumps({"ops": ops}), cwd=TOOLS, capture_output=True, text=True)
    print(f"{min(i + 1500, len(boxes))}/{len(boxes)}", "ok" if out.returncode == 0 else out.stderr[:200], flush=True)
