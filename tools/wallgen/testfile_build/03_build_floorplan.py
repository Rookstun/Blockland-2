import json

GAP_MAX = 40  # widest real opening seen is ~31px; 52-53px gaps turned out to be
              # open space between separate structures, not doorways
MARK_SEARCH = 18       # px, marker-to-line tolerance for explaining a gap
LINE_SNAP = 4
DOOR_CUT_W = 5.0        # default half-width*2 for a synthesized door cut (px)
WINDOW_CUT_W = 9.0      # default width for a synthesized window cut (px)
MARGIN = 2.0            # min wall material to leave on each side of a synthesized cut

with open("wall_segments.json") as f:
    wd = json.load(f)
segs = wd["segments"]
with open("openings.json") as f:
    markers = json.load(f)


def line_key(coord, used):
    for lk in used:
        if abs(lk - coord) <= LINE_SNAP:
            return lk
    used.append(coord)
    return coord


used_h, used_v = [], []
groups = {}
for s in segs:
    if s["orient"] == "H":
        lk = line_key(s["y"], used_h)
    else:
        lk = line_key(s["x"], used_v)
    groups.setdefault((s["orient"], round(lk, 1)), []).append(s)

# NOTE: `line` here is only the bucket key used to group segments that
# *might* be the same physical wall -- it can be borrowed from an unrelated
# segment that happened to fall in the same LINE_SNAP-tolerance bucket. Each
# split-off run's reported coordinate is recomputed below from the mean of
# its OWN contributing segments' actual coordinates, not this bucket key.
def finalize(cur):
    # round -- averaging an even count of integer coords can land on .5,
    # and fractional pixel/stud positions have caused real downstream bugs.
    cur["line"] = round(sum(cur["_coords"]) / len(cur["_coords"]))
    del cur["_coords"]
    return cur


runs = []
for (orient, line), group in groups.items():
    if orient == "H":
        group.sort(key=lambda s: s["x0"])
        cur = {"orient": "H", "line": line, "start": group[0]["x0"], "end": group[0]["x1"],
               "openings": [], "_coords": [group[0]["y"]]}
        for s in group[1:]:
            gap0, gap1 = cur["end"], s["x0"]
            if gap1 - gap0 <= GAP_MAX:
                cur["openings"].append({"pos0": gap0, "pos1": gap1, "type": None})
                cur["end"] = s["x1"]
                cur["_coords"].append(s["y"])
            else:
                runs.append(finalize(cur))
                cur = {"orient": "H", "line": line, "start": s["x0"], "end": s["x1"],
                       "openings": [], "_coords": [s["y"]]}
        runs.append(finalize(cur))
    else:
        group.sort(key=lambda s: s["y0"])
        cur = {"orient": "V", "line": line, "start": group[0]["y0"], "end": group[0]["y1"],
               "openings": [], "_coords": [group[0]["x"]]}
        for s in group[1:]:
            gap0, gap1 = cur["end"], s["y0"]
            if gap1 - gap0 <= GAP_MAX:
                cur["openings"].append({"pos0": gap0, "pos1": gap1, "type": None})
                cur["end"] = s["y1"]
                cur["_coords"].append(s["x"])
            else:
                runs.append(finalize(cur))
                cur = {"orient": "V", "line": line, "start": s["y0"], "end": s["y1"],
                       "openings": [], "_coords": [s["x"]]}
        runs.append(finalize(cur))

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

for run, o in all_openings:
    if id(o) not in opening_done:
        o["type"] = "door"

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

with open("floorplan_runs.json", "w") as f:
    json.dump({
        "width": wd["width"], "height": wd["height"],
        "runs": runs,
        "unplaced_markers": orphans_unplaced,
    }, f, indent=2)

n_open = sum(len(r["openings"]) for r in runs)
print(f"runs={len(runs)} total_openings={n_open} synthesized={len(orphans_placed)} unplaced={len(orphans_unplaced)}")
for m in orphans_unplaced:
    print(" UNPLACED:", m)
