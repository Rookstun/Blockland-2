import json
import sys
from PIL import Image
import numpy as np

IMG_PATH = sys.argv[1] if len(sys.argv) > 1 else "jail.png"
MIN_RUN = 6  # minimum pixel run length to count as a wall run (filters annotation dots/ticks)
MERGE_GAP = 3  # max row/col gap to merge adjacent thick-line rows/cols into one wall
OVERLAP_MIN = 4  # minimum x/y overlap (px) to consider two runs part of the same wall band

img = Image.open(IMG_PATH).convert("RGB")
arr = np.array(img).astype(int)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

# grayscale + dark => wall ink. Colored door/window markers are deliberately
# EXCLUDED here (not bridged in): a marker can either replace a short stretch
# of an otherwise-continuous wall (closet dividers) or sit at the edge of an
# already-blank gap (a window drawn as an actual opening). Bridging marker
# color into the wall mask fixes the first case but silently shrinks the
# second (eats into the real opening, making "wall" appear inside a window).
# Instead we rely on a low MIN_RUN so short wall stubs on either side of a
# marker survive on their own, and 03_build_floorplan.py's gap-merging
# bridges across the marker afterward using the *un-inked* gap width.
is_gray = (np.abs(r - g) < 12) & (np.abs(g - b) < 12) & (np.abs(r - b) < 12)
is_dark = (r < 200)
mask = is_gray & is_dark
H, W = mask.shape


def find_runs_1d(bool_row, min_len):
    runs = []
    start = None
    for i, v in enumerate(bool_row):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                runs.append((start, i - 1))
            start = None
    if start is not None and len(bool_row) - start >= min_len:
        runs.append((start, len(bool_row) - 1))
    return runs


def extract_bands(mask, axis_len_min):
    """axis 0 = rows (find horizontal runs per row); returns list of per-line runs: (line_idx, x0, x1)"""
    per_line = []
    for y in range(mask.shape[0]):
        for (x0, x1) in find_runs_1d(mask[y, :], axis_len_min):
            per_line.append((y, x0, x1))
    return per_line


def merge_bands(per_line, merge_gap, overlap_min):
    """Merge consecutive-row runs with overlapping x-range into wall segments.
    per_line: list of (line_idx, a0, a1) sorted implicitly by line_idx (rows) already."""
    per_line.sort(key=lambda t: t[0])
    active = []  # list of dict(lines=[idx,...], a0, a1, last_line)
    finished = []
    for (idx, a0, a1) in per_line:
        matched = None
        for band in active:
            ov = min(band["a1"], a1) - max(band["a0"], a0)
            if idx - band["last_line"] <= merge_gap and ov >= overlap_min:
                matched = band
                break
        if matched:
            matched["a0"] = min(matched["a0"], a0)
            matched["a1"] = max(matched["a1"], a1)
            matched["lines"].append(idx)
            matched["last_line"] = idx
        else:
            active.append({"lines": [idx], "a0": a0, "a1": a1, "last_line": idx})
        # retire bands not touched recently
        still = []
        for band in active:
            if idx - band["last_line"] > merge_gap:
                finished.append(band)
            else:
                still.append(band)
        active = still
    finished.extend(active)
    return finished


# horizontal wall lines: runs along each row
h_runs = extract_bands(mask, MIN_RUN)
h_bands = merge_bands(h_runs, MERGE_GAP, OVERLAP_MIN)

# vertical wall lines: runs along each column (transpose)
maskT = mask.T
v_runs = extract_bands(maskT, MIN_RUN)
v_bands = merge_bands(v_runs, MERGE_GAP, OVERLAP_MIN)

segments = []
for band in h_bands:
    # round -- an even-thickness band's row average lands on .5, and
    # fractional pixel positions have caused real downstream bugs.
    y_c = round(sum(band["lines"]) / len(band["lines"]))
    thickness = max(band["lines"]) - min(band["lines"]) + 1
    segments.append({
        "orient": "H",
        "x0": band["a0"], "x1": band["a1"],
        "y": y_c, "thickness": thickness,
    })
for band in v_bands:
    x_c = round(sum(band["lines"]) / len(band["lines"]))
    thickness = max(band["lines"]) - min(band["lines"]) + 1
    segments.append({
        "orient": "V",
        "y0": band["a0"], "y1": band["a1"],
        "x": x_c, "thickness": thickness,
    })

print(f"mask dark pixels: {mask.sum()}", file=sys.stderr)
print(f"H bands: {len(h_bands)}  V bands: {len(v_bands)}", file=sys.stderr)

with open("wall_segments.json", "w") as f:
    json.dump({"width": W, "height": H, "segments": segments}, f, indent=2)

print("wrote wall_segments.json")
