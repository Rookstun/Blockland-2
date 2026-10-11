import json
import sys
from collections import deque
from PIL import Image
import numpy as np

IMG_PATH = sys.argv[1] if len(sys.argv) > 1 else "jail.png"

img = Image.open(IMG_PATH).convert("RGB")
arr = np.array(img).astype(int)
H, W = arr.shape[:2]

CATEGORIES = {
    "window": [(0, 255, 255)],                      # cyan
    "door": [(255, 0, 0), (0, 0, 255), (0, 255, 0), (255, 255, 0)],  # red, blue, green, yellow
}
TOL = 40


def color_mask(colors):
    m = np.zeros((H, W), dtype=bool)
    for (cr, cg, cb) in colors:
        d = np.abs(arr[:, :, 0] - cr) + np.abs(arr[:, :, 1] - cg) + np.abs(arr[:, :, 2] - cb)
        m |= d < TOL
    return m


def connected_components(mask):
    visited = np.zeros_like(mask, dtype=bool)
    comps = []
    ys, xs = np.where(mask)
    pts = set(zip(ys.tolist(), xs.tolist()))
    for (y0, x0) in list(pts):
        if visited[y0, x0]:
            continue
        q = deque([(y0, x0)])
        visited[y0, x0] = True
        comp = []
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
        comps.append(comp)
    return comps


openings = []
for label, colors in CATEGORIES.items():
    mask = color_mask(colors)
    comps = connected_components(mask)
    for comp in comps:
        if len(comp) < 2:
            continue
        ys = [p[0] for p in comp]
        xs = [p[1] for p in comp]
        y0, y1, x0, x1 = min(ys), max(ys), min(xs), max(xs)
        # integer pixel coords only -- a .5 centroid (even-width box) has
        # caused real downstream bugs (fractional brick positions), so round
        # instead of carrying the fraction through the rest of the pipeline.
        cy, cx = round((y0 + y1) / 2), round((x0 + x1) / 2)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        openings.append({
            "type": label,
            "cx": cx, "cy": cy,
            "x0": x0, "x1": x1, "y0": y0, "y1": y1,
            "w": w, "h": h, "npix": len(comp),
        })

with open("openings.json", "w") as f:
    json.dump(openings, f, indent=2)

for o in openings:
    print(o)
print(f"\n{len(openings)} opening markers found")
