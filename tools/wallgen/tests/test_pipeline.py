"""Black-box regression tests for stages 1-3 (01_extract_walls.py,
02_extract_openings.py, 03_build_floorplan.py).

These build tiny synthetic fixture images on the fly and run the actual
pipeline scripts as subprocesses against them, rather than importing
functions -- the scripts are plain top-level scripts with hardcoded I/O
filenames, and reproducing the exact bugs from PIPELINE.md needs the real
mask/threshold/merge logic, not a reimplementation of it.

Run with: python3 -m unittest discover -s tests
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent.parent
BLACK = (0, 0, 0)
RED = (255, 0, 0)      # door
CYAN = (0, 255, 255)   # window


def make_image(width, height, pixels):
    """pixels: list of (x, y, color) to set; everything else white."""
    arr = np.full((height, width, 3), 255, dtype=np.uint8)
    for x, y, color in pixels:
        arr[y, x] = color
    return Image.fromarray(arr, "RGB")


def hline(x0, x1, y, color=BLACK):
    """inclusive [x0, x1] at row y"""
    return [(x, y, color) for x in range(x0, x1 + 1)]


def vline(y0, y1, x, color=BLACK):
    return [(x, y, color) for y in range(y0, y1 + 1)]


def block(x0, x1, y0, y1, color):
    return [(x, y, color) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


def run_pipeline(tmpdir, image, stages=("01", "02", "03")):
    """Save `image` as fixture.png in tmpdir and run the requested pipeline
    stages against it via subprocess, cwd=tmpdir. Returns dict of whichever
    output JSON files exist afterward."""
    fixture = Path(tmpdir) / "fixture.png"
    image.save(fixture)
    script_names = {
        "01": "01_extract_walls.py",
        "02": "02_extract_openings.py",
        "03": "03_build_floorplan.py",
    }
    for stage in stages:
        script = SCRIPT_DIR / script_names[stage]
        args = [sys.executable, str(script)]
        if stage in ("01", "02"):
            args.append(str(fixture))
        result = subprocess.run(args, cwd=tmpdir, capture_output=True, text=True)
        assert result.returncode == 0, (
            f"{script_names[stage]} failed (exit {result.returncode}):\n{result.stderr}"
        )
    out = {}
    for name in ("wall_segments.json", "openings.json", "floorplan_runs.json"):
        p = Path(tmpdir) / name
        if p.exists():
            out[name] = json.loads(p.read_text())
    return out


def find_no_frac(obj, path=""):
    """Recursively find any float in `obj` with a nonzero fractional part."""
    bad = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            bad += find_no_frac(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            bad += find_no_frac(v, f"{path}[{i}]")
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        if float(obj) % 1 != 0:
            bad.append((path, obj))
    return bad


class TestWallExtraction(unittest.TestCase):
    """Regression: a door/window marker replacing a chunk of a wall line
    used to split it into two stubs, each short enough to be dropped by
    MIN_RUN entirely -- silently deleting the wall. See PIPELINE.md."""

    def test_marker_split_wall_survives_as_two_stubs(self):
        # a 16px wall with a 4px red marker gap in the middle -> two 6px
        # stubs, exactly at MIN_RUN's threshold
        pixels = hline(10, 15, 10) + block(16, 19, 10, 10, RED) + hline(20, 25, 10)
        img = make_image(40, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img, stages=("01",))
            segs = out["wall_segments.json"]["segments"]
            h_segs = [s for s in segs if s["orient"] == "H"]
            self.assertEqual(len(h_segs), 2, f"expected both stubs to survive, got {h_segs}")

    def test_marker_split_wall_merges_back_into_one_run_with_a_door(self):
        pixels = hline(10, 15, 10) + block(16, 19, 10, 10, RED) + hline(20, 25, 10)
        img = make_image(40, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            runs = out["floorplan_runs.json"]["runs"]
            h_runs = [r for r in runs if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 1, f"stubs should merge into one run, got {h_runs}")
            self.assertEqual(h_runs[0]["start"], 10)
            self.assertEqual(h_runs[0]["end"], 25)
            self.assertEqual(len(h_runs[0]["openings"]), 1)
            self.assertEqual(h_runs[0]["openings"][0]["type"], "door")


class TestGapMerging(unittest.TestCase):
    """Regression: GAP_MAX used to be large enough (55px) to fuse two
    separate, unconnected structures into one wall with a single fake
    "door" spanning the empty space between them. See PIPELINE.md."""

    def test_separate_structures_stay_separate(self):
        # gap of 50px, comfortably over GAP_MAX (40)
        pixels = hline(10, 30, 10) + hline(80, 100, 10)
        img = make_image(120, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            runs = out["floorplan_runs.json"]["runs"]
            h_runs = [r for r in runs if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 2, f"separate structures got fused: {h_runs}")
            for r in h_runs:
                self.assertEqual(len(r["openings"]), 0)

    def test_close_structures_do_merge_with_an_opening(self):
        # sanity check the other direction: a real door-sized gap (10px)
        # should still bridge into one run
        pixels = hline(10, 30, 10) + hline(41, 60, 10)
        img = make_image(80, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            runs = out["floorplan_runs.json"]["runs"]
            h_runs = [r for r in runs if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 1)
            self.assertEqual(len(h_runs[0]["openings"]), 1)


class TestMarkerMatching(unittest.TestCase):
    """Regression: a marker could get matched to the wrong gap when a
    farther-line marker had a smaller raw position distance than the
    correct, same-line marker. The fix sorts candidates by line-distance
    first, position-distance second. See PIPELINE.md."""

    def test_closer_line_marker_wins_over_closer_position_marker(self):
        # V wall at x=100 with a 10px gap (y=50..60) that should read as a
        # window: the window marker sits exactly on the wall's line but is
        # not perfectly centered in the gap (pos distance 2). A decoy door
        # marker sits on a DIFFERENT wall 10px away in x, but happens to be
        # dead-center in this gap's y-range (pos distance 0). If the match
        # only minimized position distance, the decoy would win.
        pixels = (
            vline(0, 49, 100) + vline(60, 100, 100)
            + block(99, 100, 51, 52, CYAN)   # correct window marker, on-line
            + block(109, 110, 54, 55, RED)   # decoy door marker, off-line
        )
        img = make_image(130, 110, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            runs = out["floorplan_runs.json"]["runs"]
            v_runs = [r for r in runs if r["orient"] == "V" and r["openings"]]
            self.assertEqual(len(v_runs), 1)
            self.assertEqual(
                v_runs[0]["openings"][0]["type"], "window",
                "the on-line window marker should win over the off-line door decoy",
            )


class TestLineCoordinateAccuracy(unittest.TestCase):
    """Regression: two unrelated walls within LINE_SNAP of each other used
    to share a grouping "bucket," and a run split off from that bucket
    reported the BUCKET's first-seen coordinate instead of recomputing its
    own position from its own segments -- a silent 1-4px position error.
    See PIPELINE.md."""

    def test_split_run_reports_its_own_coordinate_not_a_borrowed_one(self):
        # wall1 at y=10 registers the bucket first; wall2 at y=13 is close
        # enough (LINE_SNAP=4) to join the same bucket, but far enough away
        # in x (gap=180 > GAP_MAX=40) that it must split into its own run.
        pixels = hline(10, 20, 10) + hline(200, 215, 13)
        img = make_image(230, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            runs = out["floorplan_runs.json"]["runs"]
            h_runs = sorted([r for r in runs if r["orient"] == "H"], key=lambda r: r["start"])
            self.assertEqual(len(h_runs), 2)
            self.assertEqual(h_runs[0]["line"], 10)
            self.assertEqual(
                h_runs[1]["line"], 13,
                f"second run should report its OWN line (13), not wall1's bucket coordinate (10); got {h_runs[1]['line']}",
            )


class TestNoFloatingLintels(unittest.TestCase):
    """Regression: an un-marked gap between two collinear walls that each
    end on a cross wall (side-room walls stopping at a central hall) was
    bridged into one run with a default "door" -- a lintel floating across
    the hall. And a wall stub shorter than MIN_RUN between a marker and a
    corner was dropped, fusing the marker's gap with the open floor past the
    corner into one oversized door/window. See PIPELINE.md."""

    def test_gap_between_two_cross_walls_is_not_a_door(self):
        # H walls at y=30: x 10..40 and 71..100, gap 41..70 (under GAP_MAX)
        # with cross walls at x=40 and x=71 -> open floor, not a doorway.
        pixels = (hline(10, 40, 30) + hline(71, 100, 30)
                  + vline(10, 60, 40) + vline(10, 60, 71))
        img = make_image(120, 80, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            h_runs = [r for r in out["floorplan_runs.json"]["runs"] if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 2, f"hall gap got bridged: {h_runs}")
            for r in h_runs:
                self.assertEqual(r["openings"], [])

    def test_gap_with_a_free_end_is_still_a_door(self):
        # same gap, but only one side ends on a cross wall -> unmarked door
        pixels = hline(10, 40, 30) + hline(71, 100, 30) + vline(10, 60, 40)
        img = make_image(120, 80, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            h_runs = [r for r in out["floorplan_runs.json"]["runs"] if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 1)
            self.assertEqual(len(h_runs[0]["openings"]), 1)

    def test_short_stub_between_marker_and_corner_is_kept(self):
        # V wall at x=50: ink 10..29, door marker 30..33, 4px stub 34..37
        # ending on an H cross wall at y=37, open floor to the next H wall
        # at y=52, ink again 52..70. The door must be just the marker.
        pixels = (vline(10, 29, 50) + vline(30, 33, 50, RED) + vline(34, 37, 50)
                  + hline(50, 90, 37) + hline(50, 90, 52) + vline(52, 70, 50))
        img = make_image(110, 80, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            doors = [o for r in out["floorplan_runs.json"]["runs"]
                     if r["orient"] == "V" and r["line"] == 50 for o in r["openings"]]
            self.assertEqual(len(doors), 1, f"got {doors}")
            self.assertLessEqual(doors[0]["pos1"] - doors[0]["pos0"], 6,
                                 f"door swallowed the open floor past the corner: {doors[0]}")


class TestGapCrossedByWall(unittest.TestCase):
    """Regression: an unmarked gap with a perpendicular wall running into it
    (e.g. the tops of a spiral's arms) was bridged into a door with walls
    through its middle. See PIPELINE.md."""

    def test_gap_with_a_wall_inside_is_not_a_door(self):
        # H y=20: x 10..30 and 41..60, gap 31..40; a V wall comes up to the
        # line at x=35 (its top pixel is on the line, like a spiral arm's top).
        # Neither gap end is on a cross wall.
        pixels = hline(10, 30, 20) + hline(41, 60, 20) + vline(20, 50, 35)
        img = make_image(80, 60, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            h_runs = [r for r in out["floorplan_runs.json"]["runs"] if r["orient"] == "H"]
            self.assertEqual(len(h_runs), 2, f"gap with a wall through it was bridged: {h_runs}")


class TestCloseParallelWalls(unittest.TestCase):
    """Regression: segments were grouped into first-seen LINE_SNAP buckets,
    so two different walls a few px apart that overlap along their length
    were chained as one "line" -- giving an inverted opening (pos1 < pos0)
    that stage 5 refuses to build. See PIPELINE.md."""

    def test_overlapping_walls_on_nearby_lines_stay_separate(self):
        # y=10: x 10..40, y=14: x 20..60 -- past stage 1's MERGE_GAP (3) so they
        # stay two segments, within LINE_SNAP (4), overlapping in x
        pixels = hline(10, 40, 10) + hline(20, 60, 14)
        img = make_image(80, 30, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            h_runs = sorted((r for r in out["floorplan_runs.json"]["runs"] if r["orient"] == "H"),
                            key=lambda r: r["line"])
            self.assertEqual([(r["line"], r["start"], r["end"]) for r in h_runs],
                             [(10, 10, 40), (14, 20, 60)])
            for r in h_runs:
                for o in r["openings"]:
                    self.assertLess(o["pos0"], o["pos1"], f"inverted opening {o}")


class TestNoFractionalValues(unittest.TestCase):
    """Invariant: no stage should ever emit a .5 (or any other fractional)
    coordinate. Every .5 found in this pipeline eventually caused a real
    bug once it propagated far enough (see PIPELINE.md), so this is
    checked as a hard invariant rather than left as an implicit
    assumption."""

    def test_no_fractional_values_in_any_output(self):
        # deliberately uses even-width marker boxes, which is exactly what
        # produces a .5 centroid if the rounding fix regresses
        pixels = (
            hline(10, 30, 10) + hline(41, 61, 10)  # even-width gap: 41..61 side lengths
            + block(34, 37, 10, 10, RED)  # 4px-wide (even) marker box
        )
        img = make_image(80, 20, pixels)
        with tempfile.TemporaryDirectory() as tmp:
            out = run_pipeline(tmp, img)
            for name, data in out.items():
                bad = find_no_frac(data)
                self.assertEqual(bad, [], f"{name} contains fractional values: {bad}")


if __name__ == "__main__":
    unittest.main()
