import json
from PIL import Image, ImageDraw

with open("floorplan_runs.json") as f:
    d = json.load(f)

SCALE = 2
W, H = d["width"] * SCALE, d["height"] * SCALE
img = Image.new("RGB", (W, H), (255, 255, 255))
draw = ImageDraw.Draw(img)

TYPE_COLOR = {"door": (200, 120, 0), "window": (0, 160, 220)}

for r in d["runs"]:
    segs_solid = []
    pos = r["start"]
    for o in r["openings"]:
        segs_solid.append((pos, o["pos0"]))
        pos = o["pos1"]
    segs_solid.append((pos, r["end"]))
    for (a, b) in segs_solid:
        if b - a <= 0:
            continue
        if r["orient"] == "H":
            p0, p1 = (a, r["line"]), (b, r["line"])
        else:
            p0, p1 = (r["line"], a), (r["line"], b)
        draw.line([(p0[0]*SCALE, p0[1]*SCALE), (p1[0]*SCALE, p1[1]*SCALE)], fill=(0, 0, 0), width=3)
    for o in r["openings"]:
        if r["orient"] == "H":
            p0, p1 = (o["pos0"], r["line"]), (o["pos1"], r["line"])
        else:
            p0, p1 = (r["line"], o["pos0"]), (r["line"], o["pos1"])
        col = TYPE_COLOR[o["type"]]
        draw.line([(p0[0]*SCALE, p0[1]*SCALE), (p1[0]*SCALE, p1[1]*SCALE)], fill=col, width=5)

draw.rectangle([10, H-50, 30, H-35], fill=TYPE_COLOR["door"])
draw.text((35, H-50), "door opening", fill=(0,0,0))
draw.rectangle([10, H-30, 30, H-15], fill=TYPE_COLOR["window"])
draw.text((35, H-30), "window opening", fill=(0,0,0))

img.save("floorplan_runs_overlay.png")
print("wrote floorplan_runs_overlay.png")
