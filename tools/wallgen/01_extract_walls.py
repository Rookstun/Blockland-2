import argparse
import json
import sys
from PIL import Image
import numpy as np

# Defaults are the values tuned for jail.png. The GUI (gui_server.js) passes
# its own values as flags -- a phone photo of a sketch needs a different ink
# threshold than a clean digital drawing. The positional IMAGE stays optional
# so run_pipeline.sh and tests/test_pipeline.py keep working unchanged.
ap = argparse.ArgumentParser(description="extract wall runs from a floor-plan image")
ap.add_argument("image", nargs="?", default="jail.png")
ap.add_argument("--min-run", type=int, default=6,
                help="minimum pixel run length to count as a wall run (filters annotation dots/ticks)")
ap.add_argument("--merge-gap", type=int, default=3,
                help="max row/col gap to merge adjacent thick-line rows/cols into one wall")
ap.add_argument("--overlap-min", type=int, default=4,
                help="minimum x/y overlap (px) to consider two runs part of the same wall band")
ap.add_argument("--ink-threshold", type=int, default=200,
                help="a gray pixel darker than this counts as wall ink (raise for dim photos)")
ap.add_argument("--marker-tolerance", type=int, default=40,
                help="colour distance for recognising door/window marker ink (match 02's --tolerance)")
ap.add_argument("--out", default="wall_segments.json")
args = ap.parse_args()

IMG_PATH = args.image
MIN_RUN = args.min_run
MERGE_GAP = args.merge_gap
OVERLAP_MIN = args.overlap_min
INK_THRESHOLD = args.ink_threshold
MARKER_TOL = args.marker_tolerance

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
is_dark = (r < INK_THRESHOLD)
mask = is_gray & is_dark
H, W = mask.shape

# Door/window marker ink -- same five colours as 02_extract_openings.py. Used
# only so a wall stub shorter than MIN_RUN survives when it butts against a
# marker. Dropping such a stub (e.g. 4px of wall between a door marker and the
# corner past it) fuses the marker's gap with the open floor beyond, and the
# whole span turned into one oversized door/window with a lintel over the room.
MARKER_COLORS = [(0, 255, 255), (255, 0, 0), (0, 0, 255), (0, 255, 0), (255, 255, 0)]
marker = np.zeros((H, W), dtype=bool)
for (cr, cg, cb) in MARKER_COLORS:
    marker |= (np.abs(r - cr) + np.abs(g - cg) + np.abs(b - cb)) < MARKER_TOL


def find_runs_1d(bool_row, min_len, marker_row):
    runs = []
    n = len(bool_row)

    def keep(a, e):  # run covers [a, e)
        if e - a >= min_len:
            return True
        return (a > 0 and marker_row[a - 1]) or (e < n and marker_row[e])

    start = None
    for i, v in enumerate(bool_row):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if keep(start, i):
                runs.append((start, i - 1))
            start = None
    if start is not None and keep(start, n):
        runs.append((start, n - 1))
    return runs


def extract_bands(mask, marker, axis_len_min):
    """axis 0 = rows (find horizontal runs per row); returns list of per-line runs: (line_idx, x0, x1)"""
    per_line = []
    for y in range(mask.shape[0]):
        for (x0, x1) in find_runs_1d(mask[y, :], axis_len_min, marker[y, :]):
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
h_runs = extract_bands(mask, marker, MIN_RUN)
h_bands = merge_bands(h_runs, MERGE_GAP, OVERLAP_MIN)

# vertical wall lines: runs along each column (transpose)
maskT = mask.T
v_runs = extract_bands(maskT, marker.T, MIN_RUN)
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

with open(args.out, "w") as f:
    json.dump({"width": W, "height": H, "segments": segments}, f, indent=2)

print(f"wrote {args.out}")
