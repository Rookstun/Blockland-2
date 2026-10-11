import argparse
import json
import os
from PIL import Image, ImageDraw

# QA overlay: the extracted plan drawn ON TOP OF the source image it came
# from, so a misread (a wall that isn't in the drawing, a door where there's
# no gap, a marker that landed on the wrong wall) shows up as plan lines that
# don't sit on the ink. A plan drawn on blank white can only be compared to
# the drawing by eye, side by side -- which is how bad openings survived.
ap = argparse.ArgumentParser(description="render a QA overlay of the assembled floor plan")
ap.add_argument("--runs", default="floorplan_runs.json")
ap.add_argument("--image", default="jail.png",
                help="source image the plan was extracted from; drawn faded underneath the plan")
ap.add_argument("--out", default="floorplan_runs_overlay.png")
ap.add_argument("--scale", type=int, default=0,
                help="output px per source px (0 = auto: at least 3, and ~800px across)")
args = ap.parse_args()

with open(args.runs) as f:
    d = json.load(f)

# at least 3x with lines a third of a source pixel wide, so the faded ink stays
# visible on both sides of every plan line (at 2x a line hides the ink under it,
# and a plan line with NO ink beneath looks the same as a correct one)
SCALE = args.scale or max(3, round(800 / max(d["width"], d["height"])))
W, H = d["width"] * SCALE, d["height"] * SCALE

if not os.path.exists(args.image):
    raise SystemExit(f"source image not found: {args.image} (pass --image)")
src = Image.open(args.image).convert("RGB")
if src.size != (d["width"], d["height"]):
    raise SystemExit(f"{args.image} is {src.size[0]}x{src.size[1]} but the plan is "
                     f"{d['width']}x{d['height']} -- wrong source image?")
# Faded so the plan's lines read on top of it, NEAREST so each source pixel
# stays a crisp block the plan line can be checked against.
img = Image.blend(src, Image.new("RGB", src.size, (255, 255, 255)), 0.6)
img = img.resize((W, H), Image.NEAREST)
draw = ImageDraw.Draw(img)

TYPE_COLOR = {"door": (200, 120, 0), "window": (0, 160, 220)}
WALL_COLOR = (0, 0, 0)
LW = max(1, SCALE // 3)


def px(v):
    # centre of source pixel v, so a plan line lands in the middle of the ink
    return v * SCALE + SCALE / 2


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
        draw.line([(px(p0[0]), px(p0[1])), (px(p1[0]), px(p1[1]))], fill=WALL_COLOR, width=LW)
    for o in r["openings"]:
        if r["orient"] == "H":
            p0, p1 = (o["pos0"], r["line"]), (o["pos1"], r["line"])
        else:
            p0, p1 = (r["line"], o["pos0"]), (r["line"], o["pos1"])
        col = TYPE_COLOR[o["type"]]
        draw.line([(px(p0[0]), px(p0[1])), (px(p1[0]), px(p1[1]))], fill=col, width=LW + 2)

# legend, on its own strip below the drawing so it can't cover any of it
LEG = 70
out = Image.new("RGB", (W, H + LEG), (255, 255, 255))
out.paste(img, (0, 0))
draw = ImageDraw.Draw(out)
y = H + 8
draw.rectangle([10, y, 30, y + 12], fill=TYPE_COLOR["door"])
draw.text((36, y), "door opening", fill=(0, 0, 0))
draw.rectangle([10, y + 20, 30, y + 32], fill=TYPE_COLOR["window"])
draw.text((36, y + 20), "window opening", fill=(0, 0, 0))
draw.line([(10, y + 46), (30, y + 46)], fill=WALL_COLOR, width=3)
draw.text((36, y + 40), f"extracted wall  (faded underneath: {os.path.basename(args.image)})",
          fill=(0, 0, 0))

out.save(args.out)
print(f"wrote {args.out}")
