#!/usr/bin/env bash
# Runs the full floor-plan -> Brickadia pipeline in order, stopping on the
# first failing stage. Usage: ./run_pipeline.sh [image.png]  (default jail.png)
set -euo pipefail
cd "$(dirname "$0")"

IMG="${1:-jail.png}"
PY="${PYTHON:-python}"

stage() {
  echo "==> $*"
  "$@"
}

stage "$PY" 01_extract_walls.py "$IMG"
stage "$PY" 02_extract_openings.py "$IMG"
stage "$PY" 03_build_floorplan.py
stage "$PY" 04_visualize_floorplan.py --image "$IMG"
stage node 05_generate_brick_walls.js

echo "==> pipeline complete"
