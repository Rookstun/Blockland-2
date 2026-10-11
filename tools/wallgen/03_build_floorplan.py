import argparse
import json

# Defaults are the values tuned for jail.png; the GUI passes its own as flags.
ap = argparse.ArgumentParser(description="assemble wall runs and classify openings")
ap.add_argument("--gap-max", type=float, default=40,
                help="widest un-inked gap (px) still treated as an opening rather than open space "
                     "between separate structures")
ap.add_argument("--mark-search", type=float, default=18,
                help="marker-to-wall-line tolerance (px) for explaining a gap")
ap.add_argument("--line-snap", type=float, default=4,
                help="tolerance (px) for grouping segments onto one physical wall line")
ap.add_argument("--door-cut-w", type=float, default=5.0,
                help="width (px) of a door cut synthesized on solid wall")
ap.add_argument("--window-cut-w", type=float, default=9.0,
                help="width (px) of a window cut synthesized on solid wall")
ap.add_argument("--margin", type=float, default=2.0,
                help="minimum wall material (px) left on each side of a synthesized cut")
ap.add_argument("--junction-tol", type=float, default=0,
                help="extra slack (px), beyond the cross wall's own half-thickness, for an unmarked "
                     "gap's end to count as ending ON a perpendicular wall; a gap ending on walls at "
                     "both sides is split, not bridged. Keep it tiny: a doorway beside a corner has "
                     "its ends a few px from the corner walls and must stay a door")
ap.add_argument("--walls", default="wall_segments.json")
ap.add_argument("--openings", default="openings.json")
ap.add_argument("--out", default="floorplan_runs.json")
args = ap.parse_args()

GAP_MAX = args.gap_max
MARK_SEARCH = args.mark_search
LINE_SNAP = args.line_snap
DOOR_CUT_W = args.door_cut_w
WINDOW_CUT_W = args.window_cut_w
MARGIN = args.margin
JUNCTION_TOL = args.junction_tol

with open(args.walls) as f:
    wd = json.load(f)
segs = wd["segments"]
with open(args.openings) as f:
    markers = json.load(f)


# Chain segments into runs. A segment extends an existing run only if it lies
# on that run's own line (within LINE_SNAP of the run's LAST segment, not of a
# shared first-seen bucket) and starts at or after the run's end. The old
# bucket approach put every segment within LINE_SNAP of the first one onto one
# "line", so in a sketch with walls 2px apart, pieces of different walls got
# chained together -- producing inverted openings (pos1 < pos0) and doors
# spanning between unrelated walls. Two segments that overlap along the line
# but sit on different lines are different walls and never chain.
def set_line(run):
    # A run's line is the mean of its OWN segments' coordinates (kept in
    # `_parts`, so a piece split off later gets recomputed from just its own).
    # round -- averaging an even count of integer coords can land on .5,
    # and fractional pixel/stud positions have caused real downstream bugs.
    coords = [ln for (_, _, ln) in run["_parts"]]
    run["line"] = round(sum(coords) / len(coords))
    return run


runs = []
for orient in ("H", "V"):
    if orient == "H":
        span = lambda s: (s["x0"], s["x1"], s["y"])
    else:
        span = lambda s: (s["y0"], s["y1"], s["x"])
    open_runs = []
    for seg in sorted((s for s in segs if s["orient"] == orient), key=lambda s: span(s)[0]):
        a, b, ln = span(seg)
        best = None
        for cur in open_runs:
            dy = abs(ln - cur["_last"])
            if dy > LINE_SNAP:
                continue
            gap = a - cur["end"]
            if gap < 0 and dy != 0:
                continue          # overlapping but on another line: a different wall
            if gap > GAP_MAX:
                continue
            key = (dy, max(gap, 0))
            if best is None or key < best[0]:
                best = (key, cur)
        if best is None:
            open_runs.append({"orient": orient, "line": ln, "start": a, "end": b,
                              "openings": [], "_parts": [(a, b, ln)], "_last": ln})
            continue
        cur = best[1]
        if a > cur["end"]:
            # _l0/_l1: the line of the wall on each side of the gap, for the
            # junction test below (the run's averaged line can miss a corner).
            cur["openings"].append({"pos0": cur["end"], "pos1": a, "type": None,
                                    "_l0": cur["_last"], "_l1": ln})
        cur["end"] = max(cur["end"], b)
        cur["_parts"].append((a, b, ln))
        cur["_last"] = ln
    runs.extend(set_line(r) for r in open_runs)

# classify gap-based openings using nearby color markers.
# Greedy global nearest-match (by line-coordinate distance first, then
# position distance) so a marker can't "steal" a match on a different wall
# just because a looser tolerance happens to let it reach both.
all_openings = [(run, o) for run in runs for o in run["openings"]]
candidates = []
for run, o in all_openings:
    mid = (o["pos0"] + o["pos1"]) / 2
    for m in markers:
        m_line, m_pos = (m["cy"], m["cx"]) if run["orient"] == "H" else (m["cx"], m["cy"])
        line_d = abs(m_line - run["line"])
        if line_d > MARK_SEARCH:
            continue
        if not (o["pos0"] - MARK_SEARCH <= m_pos <= o["pos1"] + MARK_SEARCH):
            continue
        pos_d = min(abs(m_pos - o["pos0"]), abs(m_pos - o["pos1"]), abs(m_pos - mid))
        candidates.append((line_d, pos_d, id(o), o, id(m), m))

candidates.sort(key=lambda c: (c[0], c[1]))
explained = set()
opening_done = set()
for line_d, pos_d, o_id, o, m_id, m in candidates:
    if o_id in opening_done or m_id in explained:
        continue
    o["type"] = m["type"]
    opening_done.add(o_id)
    explained.add(m_id)

# An unexplained gap whose ends BOTH land on a perpendicular wall isn't a
# doorway -- it's two separate walls that each stop at a cross wall, with open
# floor between them (e.g. two side-room walls ending at a central hall).
# Bridging it made a lintel float across the room. Split the run there instead.
# A gap with at least one free end is still taken as an unmarked door.
def meets_perpendicular(orient, line, pos):
    for s in segs:
        if s["orient"] == orient:
            continue
        if orient == "H":
            s_line, s_a, s_b = s["x"], s["y0"], s["y1"]
        else:
            s_line, s_a, s_b = s["y"], s["x0"], s["x1"]
        tol = s.get("thickness", 1) // 2 + JUNCTION_TOL
        if abs(s_line - pos) <= tol and s_a - tol <= line <= s_b + tol:
            return True
    return False


def crossed_inside(orient, lines, pos0, pos1):
    # A perpendicular wall touching this line strictly INSIDE the gap: the gap
    # is space between the ends of walls that run across it (e.g. the arms of
    # a spiral), not a doorway -- a door can't have a wall through its middle.
    for s in segs:
        if s["orient"] == orient:
            continue
        if orient == "H":
            s_line, s_a, s_b = s["x"], s["y0"], s["y1"]
        else:
            s_line, s_a, s_b = s["y"], s["x0"], s["x1"]
        tol = s.get("thickness", 1) // 2 + JUNCTION_TOL
        if pos0 + tol < s_line < pos1 - tol and any(s_a - tol <= ln <= s_b + tol for ln in lines):
            return True
    return False


split_runs, n_split = [], 0
for run in runs:
    pieces = [dict(run, openings=[])]
    for o in sorted(run["openings"], key=lambda o: o["pos0"]):
        if id(o) not in opening_done and (
                (meets_perpendicular(run["orient"], o["_l0"], o["pos0"])
                 and meets_perpendicular(run["orient"], o["_l1"], o["pos1"]))
                or crossed_inside(run["orient"], (o["_l0"], o["_l1"]), o["pos0"], o["pos1"])):
            pieces[-1]["end"] = o["pos0"]
            pieces.append(dict(run, start=o["pos1"], openings=[]))
            n_split += 1
            continue
        if id(o) not in opening_done:
            o["type"] = "door"
        pieces[-1]["openings"].append(o)
    for piece in pieces:
        piece["_parts"] = [p for p in run["_parts"] if piece["start"] <= p[0] and p[1] <= piece["end"]]
        split_runs.append(set_line(piece))
runs = split_runs

# synthesize cuts for orphan markers that land inside a run's span (on solid wall)
orphans_placed, orphans_unplaced = [], []
for m in markers:
    if id(m) in explained:
        continue
    m_type = m["type"]
    placed = False
    for run in runs:
        m_line, m_pos = (m["cy"], m["cx"]) if run["orient"] == "H" else (m["cx"], m["cy"])
        if abs(m_line - run["line"]) > MARK_SEARCH:
            continue
        if not (run["start"] <= m_pos <= run["end"]):
            continue
        # skip if inside an existing opening already
        if any(o["pos0"] - 1 <= m_pos <= o["pos1"] + 1 for o in run["openings"]):
            placed = True
            break
        width = WINDOW_CUT_W if m_type == "window" else DOOR_CUT_W
        p0, p1 = m_pos - width / 2, m_pos + width / 2
        p0 = round(max(p0, run["start"] + MARGIN))
        p1 = round(min(p1, run["end"] - MARGIN))
        if p1 - p0 < 2:
            continue
        run["openings"].append({"pos0": p0, "pos1": p1, "type": m_type, "synthesized": True})
        orphans_placed.append(m)
        placed = True
        break
    if not placed:
        orphans_unplaced.append(m)

for run in runs:
    run["openings"].sort(key=lambda o: o["pos0"])
    del run["_parts"], run["_last"]
    for o in run["openings"]:
        o.pop("_l0", None)
        o.pop("_l1", None)

with open(args.out, "w") as f:
    json.dump({
        "width": wd["width"], "height": wd["height"],
        "runs": runs,
        "unplaced_markers": orphans_unplaced,
    }, f, indent=2)

n_open = sum(len(r["openings"]) for r in runs)
print(f"runs={len(runs)} total_openings={n_open} synthesized={len(orphans_placed)} "
      f"unplaced={len(orphans_unplaced)} split_at_junctions={n_split}")
for m in orphans_unplaced:
    print(" UNPLACED:", m)
