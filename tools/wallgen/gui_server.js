// Local web GUI for the floor-plan -> Brickadia pipeline: import a photo or
// sketch, set wall height / door + window bands / opening margins / colors,
// generate, preview, and export the .brs/.brz.
//
//   npm start        ->  http://localhost:3010
//
// It is a thin driver, not a second implementation: every request shells out
// to the same stage scripts run_pipeline.sh uses (01..05), passing the GUI's
// values as the flags those stages already accept. Anything the GUI can build,
// the printed command line in the log can rebuild by hand, and vice versa.

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const lib = require("./lib");

const ROOT = __dirname;
const RUNS = path.join(ROOT, "gui_runs");          // one working dir per source image
const UPLOADS = path.join(RUNS, "uploads");
const PRESET_FILE = path.join(RUNS, "preset.json"); // last-used settings
const PY = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const PORT = Number(process.env.PORT) || 3010;
const MAX_UPLOAD = "40mb";

fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.use(express.json({ limit: MAX_UPLOAD }));

// ------------------------------------------------------------------ helpers --

// Defaults shown in the GUI. The build-side ones come straight from lib.CONFIG
// so the GUI cannot drift from the pipeline's own defaults; the extract/plan
// ones mirror the argparse defaults in stages 01-03.
function defaults() {
  return {
    extract: { minRun: 6, mergeGap: 3, overlapMin: 4, inkThreshold: 200, tolerance: 40, minPixels: 2 },
    plan: { gapMax: 40, markSearch: 18, lineSnap: 4, doorCutW: 5, windowCutW: 9, margin: 2 },
    build: {
      wallCourses: lib.CONFIG.WALL_COURSES,
      courseHeight: lib.CONFIG.COURSE_H,
      doorOpenCourses: lib.CONFIG.DOOR_OPEN_COURSES,
      windowSillCourses: lib.CONFIG.WINDOW_SILL_COURSES,
      windowOpenCourses: lib.CONFIG.WINDOW_OPEN_COURSES,
      scale: lib.CONFIG.SCALE,
      stud: lib.CONFIG.STUD,
      cornerSnap: lib.CONFIG.CORNER_SNAP,
      planMargin: lib.CONFIG.MARGIN,
      storeys: lib.CONFIG.STOREYS,
      floorH: lib.CONFIG.FLOOR_H,
      floorMax: lib.CONFIG.FLOOR_MAX,
      ceilingH: lib.CONFIG.CEILING_H,
      ceilingDrop: lib.CONFIG.CEILING_DROP,
      roofH: lib.CONFIG.ROOF_H,
      roofOverhang: lib.CONFIG.ROOF_OVERHANG,
      roofStep: lib.CONFIG.ROOF_STEP,
      roofLayers: lib.CONFIG.ROOF_LAYERS,
      stairWidth: lib.CONFIG.STAIR_WIDTH,
      stairRise: lib.CONFIG.STAIR_RISE,
      stairRun: lib.CONFIG.STAIR_RUN,
    },
    style: {
      wallColor: "#121212",
      wallType: "brick",
      glass: false,
      glassColor: "#8ad8ff",
      glassAlpha: 176,
      material: "BMC_Plastic",
      glassMaterial: "BMC_Glass",
      floor: false,
      floorColor: "#6b6259",
      floorMaterial: "BMC_Plastic",
      ceiling: false,
      ceilingColor: "#d8d2c4",
      ceilingMaterial: "BMC_Plastic",
      roof: false,
      roofColor: "#7a3b2e",
      roofMaterial: "BMC_Plastic",
      stairs: true,
      stairsColor: "#8a7f73",
      stairsMaterial: "BMC_Plastic",
      intensity: 0,
    },
    importing: { maxDimension: 500 },
  };
}

const MATERIALS = ["BMC_Plastic", "BMC_Glass", "BMC_Glow", "BMC_Metallic", "BMC_Hologram"];

function num(value, { min, max, fallback, integer = false }) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  n = Math.min(max, Math.max(min, n));
  return integer ? Math.round(n) : n;
}

function hexColor(value, fallback) {
  const s = String(value == null ? "" : value).trim();
  return /^#?[0-9a-fA-F]{6}$/.test(s) ? (s.startsWith("#") ? s : "#" + s) : fallback;
}

function material(value, fallback) {
  return MATERIALS.includes(value) ? value : fallback;
}

// Source images live either in gui_runs/uploads (imported) or in the project
// root (the checked-in jail.png / testfile.png). Anything else -- and any name
// with a path separator in it -- is refused rather than resolved.
function resolveImage(name) {
  const base = path.basename(String(name || ""));
  if (!base || base !== String(name)) throw new Error(`bad image name: ${name}`);
  for (const dir of [UPLOADS, ROOT]) {
    const p = path.join(dir, base);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  throw new Error(`image not found: ${base}`);
}

function slugFor(imagePath) {
  return path.basename(imagePath).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "plan";
}

function listImages() {
  const seen = new Map();
  for (const [dir, origin] of [[ROOT, "project"], [UPLOADS, "imported"]]) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(png|jpe?g|bmp|gif|webp)$/i.test(f)) continue;
      if (/_overlay\.png$/i.test(f) || /^v\d+_top_course/.test(f)) continue; // pipeline QA renders
      const stat = fs.statSync(path.join(dir, f));
      seen.set(f, { name: f, origin, bytes: stat.size, modified: stat.mtime });
    }
  }
  return [...seen.values()].sort((a, b) => b.modified - a.modified);
}

// Where a Brickadia client looks for saves. Returned to the GUI so "send to
// Brickadia" can show the real path (and say so plainly when there isn't one).
function buildsDir() {
  const candidates = process.platform === "win32"
    ? [path.join(process.env.LOCALAPPDATA || "", "Brickadia", "Saved", "Builds")]
    : [
        path.join(os.homedir(), ".config", "Epic", "Brickadia", "Saved", "Builds"),
        path.join(os.homedir(), "Library", "Application Support", "Epic", "Brickadia", "Saved", "Builds"),
      ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err.message) }));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// ------------------------------------------------------------------- routes --

app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "builder_gui.html")));

// lib.js for the 3D preview, so it lays floors with the generator's own code
// rather than a browser copy of it. lib.js is CommonJS with no requires; this
// hands it a `module` and exposes the exports as window.BrickLib.
app.get("/lib.js", (_req, res) => {
  const src = fs.readFileSync(path.join(ROOT, "lib.js"), "utf8");
  res.type("application/javascript").send(
    `window.BrickLib = (function () {\nconst module = { exports: {} };\n${src}\nreturn module.exports;\n})();\n`);
});

app.get("/api/config", (_req, res) => {
  let preset = null;
  try { preset = JSON.parse(fs.readFileSync(PRESET_FILE, "utf8")); } catch { /* none yet */ }
  res.json({
    defaults: defaults(),
    materials: MATERIALS,
    images: listImages(),
    buildsDir: buildsDir(),
    python: PY,
    preset,
  });
});

app.post("/api/preset", (req, res) => {
  fs.writeFileSync(PRESET_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// Import a photo/sketch. The browser has already downscaled it (see
// maxDimension in the GUI) -- stage 1 walks the mask row by row in Python, so
// a 12-megapixel phone photo would take minutes at full size, and 1 source
// pixel is 1 stud anyway.
app.post("/api/image", (req, res) => {
  try {
    const { name, dataUrl } = req.body || {};
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!m) return res.status(400).json({ ok: false, error: "expected a PNG/JPEG/WebP data URL" });
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const stem = path.basename(String(name || "import")).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "import";
    const file = `${stem}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, file), Buffer.from(m[2], "base64"));
    res.json({ ok: true, name: file, images: listImages() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message) });
  }
});

app.get("/api/image/:name", (req, res) => {
  try {
    res.sendFile(resolveImage(req.params.name));
  } catch (err) {
    res.status(404).json({ ok: false, error: String(err.message) });
  }
});

app.get("/api/overlay/:slug", (req, res) => {
  const p = path.join(RUNS, path.basename(req.params.slug), "overlay.png");
  if (!fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});

// The whole pipeline, with the GUI's numbers. Runs stages in a per-image
// working directory so a generate never overwrites the checked-in
// wall_segments.json / floorplan_runs.json / jail_walls.* in the project root.
app.post("/api/generate", async (req, res) => {
  const body = req.body || {};
  const d = defaults();
  const log = [];
  try {
    const imagePath = resolveImage(body.image);
    const slug = slugFor(imagePath);
    const workdir = path.join(RUNS, slug);
    fs.mkdirSync(workdir, { recursive: true });

    const ex = body.extract || {};
    const extract = {
      minRun: num(ex.minRun, { min: 1, max: 200, fallback: d.extract.minRun, integer: true }),
      mergeGap: num(ex.mergeGap, { min: 0, max: 50, fallback: d.extract.mergeGap, integer: true }),
      overlapMin: num(ex.overlapMin, { min: 0, max: 100, fallback: d.extract.overlapMin, integer: true }),
      inkThreshold: num(ex.inkThreshold, { min: 1, max: 254, fallback: d.extract.inkThreshold, integer: true }),
      tolerance: num(ex.tolerance, { min: 1, max: 400, fallback: d.extract.tolerance, integer: true }),
      minPixels: num(ex.minPixels, { min: 1, max: 5000, fallback: d.extract.minPixels, integer: true }),
    };
    const pl = body.plan || {};
    const plan = {
      gapMax: num(pl.gapMax, { min: 1, max: 500, fallback: d.plan.gapMax }),
      markSearch: num(pl.markSearch, { min: 1, max: 200, fallback: d.plan.markSearch }),
      lineSnap: num(pl.lineSnap, { min: 0, max: 50, fallback: d.plan.lineSnap }),
      doorCutW: num(pl.doorCutW, { min: 1, max: 200, fallback: d.plan.doorCutW }),
      windowCutW: num(pl.windowCutW, { min: 1, max: 200, fallback: d.plan.windowCutW }),
      margin: num(pl.margin, { min: 0, max: 100, fallback: d.plan.margin }),
    };
    const bd = body.build || {};
    const build = {
      wallCourses: num(bd.wallCourses, { min: 1, max: 60, fallback: d.build.wallCourses, integer: true }),
      courseHeight: num(bd.courseHeight, { min: 2, max: 120, fallback: d.build.courseHeight, integer: true }),
      doorOpenCourses: num(bd.doorOpenCourses, { min: 0, max: 60, fallback: d.build.doorOpenCourses, integer: true }),
      windowSillCourses: num(bd.windowSillCourses, { min: 0, max: 60, fallback: d.build.windowSillCourses, integer: true }),
      windowOpenCourses: num(bd.windowOpenCourses, { min: 0, max: 60, fallback: d.build.windowOpenCourses, integer: true }),
      scale: num(bd.scale, { min: 0.1, max: 8, fallback: d.build.scale }),
      stud: num(bd.stud, { min: 2, max: 100, fallback: d.build.stud, integer: true }),
      cornerSnap: num(bd.cornerSnap, { min: 0, max: 100, fallback: d.build.cornerSnap, integer: true }),
      planMargin: num(bd.planMargin, { min: 0, max: 500, fallback: d.build.planMargin, integer: true }),
      storeys: num(bd.storeys, { min: 1, max: 20, fallback: d.build.storeys, integer: true }),
      floorH: num(bd.floorH, { min: 2, max: 60, fallback: d.build.floorH, integer: true }),
      floorMax: num(bd.floorMax, { min: 1, max: 200, fallback: d.build.floorMax, integer: true }),
      ceilingH: num(bd.ceilingH, { min: 2, max: 60, fallback: d.build.ceilingH, integer: true }),
      ceilingDrop: num(bd.ceilingDrop, { min: 0, max: 60, fallback: d.build.ceilingDrop, integer: true }),
      roofH: num(bd.roofH, { min: 2, max: 60, fallback: d.build.roofH, integer: true }),
      roofOverhang: num(bd.roofOverhang, { min: 0, max: 20, fallback: d.build.roofOverhang, integer: true }),
      roofStep: num(bd.roofStep, { min: 0, max: 20, fallback: d.build.roofStep, integer: true }),
      roofLayers: num(bd.roofLayers, { min: 1, max: 200, fallback: d.build.roofLayers, integer: true }),
      stairWidth: num(bd.stairWidth, { min: 1, max: 20, fallback: d.build.stairWidth, integer: true }),
      stairRise: num(bd.stairRise, { min: 2, max: 60, fallback: d.build.stairRise, integer: true }),
      stairRun: num(bd.stairRun, { min: 1, max: 10, fallback: d.build.stairRun, integer: true }),
    };
    const st = body.style || {};
    const style = {
      wallColor: hexColor(st.wallColor, d.style.wallColor),
      wallType: st.wallType === "cave" ? "cave" : "brick",
      glass: Boolean(st.glass),
      glassColor: hexColor(st.glassColor, d.style.glassColor),
      glassAlpha: num(st.glassAlpha, { min: 0, max: 255, fallback: d.style.glassAlpha, integer: true }),
      material: material(st.material, d.style.material),
      glassMaterial: material(st.glassMaterial, d.style.glassMaterial),
      floor: Boolean(st.floor),
      floorColor: hexColor(st.floorColor, d.style.floorColor),
      floorMaterial: material(st.floorMaterial, d.style.floorMaterial),
      ceiling: Boolean(st.ceiling),
      ceilingColor: hexColor(st.ceilingColor, d.style.ceilingColor),
      ceilingMaterial: material(st.ceilingMaterial, d.style.ceilingMaterial),
      roof: Boolean(st.roof),
      roofColor: hexColor(st.roofColor, d.style.roofColor),
      roofMaterial: material(st.roofMaterial, d.style.roofMaterial),
      stairs: st.stairs === undefined ? d.style.stairs : Boolean(st.stairs),
      stairsColor: hexColor(st.stairsColor, d.style.stairsColor),
      stairsMaterial: material(st.stairsMaterial, d.style.stairsMaterial),
      intensity: num(st.intensity, { min: 0, max: 10, fallback: d.style.intensity, integer: true }),
    };

    const generatorConfig = {
      SCALE: build.scale,
      STUD: build.stud,
      COURSE_H: build.courseHeight,
      WALL_COURSES: build.wallCourses,
      DOOR_OPEN_COURSES: build.doorOpenCourses,
      WINDOW_SILL_COURSES: build.windowSillCourses,
      WINDOW_OPEN_COURSES: build.windowOpenCourses,
      CORNER_SNAP: build.cornerSnap,
      MARGIN: build.planMargin,
      STOREYS: build.storeys,
      FLOOR_H: build.floorH,
      FLOOR_MAX: build.floorMax,
      CEILING_H: build.ceilingH,
      CEILING_DROP: build.ceilingDrop,
      ROOF_H: build.roofH,
      ROOF_OVERHANG: build.roofOverhang,
      ROOF_STEP: build.roofStep,
      ROOF_LAYERS: build.roofLayers,
      STAIR_WIDTH: build.stairWidth,
      STAIR_RISE: build.stairRise,
      STAIR_RUN: build.stairRun,
    };

    const stages = [
      ["1. walls", PY, [path.join(ROOT, "01_extract_walls.py"), imagePath,
        "--min-run", extract.minRun, "--merge-gap", extract.mergeGap,
        "--overlap-min", extract.overlapMin, "--ink-threshold", extract.inkThreshold]],
      ["2. openings", PY, [path.join(ROOT, "02_extract_openings.py"), imagePath,
        "--tolerance", extract.tolerance, "--min-pixels", extract.minPixels]],
      ["3. floor plan", PY, [path.join(ROOT, "03_build_floorplan.py"),
        "--gap-max", plan.gapMax, "--mark-search", plan.markSearch, "--line-snap", plan.lineSnap,
        "--door-cut-w", plan.doorCutW, "--window-cut-w", plan.windowCutW, "--margin", plan.margin]],
      ["4. overlay", PY, [path.join(ROOT, "04_visualize_floorplan.py"), "--image", imagePath, "--out", "overlay.png"]],
      ["5. bricks", process.execPath, [path.join(ROOT, "05_generate_brick_walls.js"),
        "--out-prefix", slug,
        "--config", JSON.stringify(generatorConfig),
        "--wall-color", style.wallColor,
        "--wall-type", style.wallType,
        style.glass ? "--glass" : "--no-glass",
        "--glass-color", style.glassColor + style.glassAlpha.toString(16).padStart(2, "0"),
        "--material", style.material,
        "--glass-material", style.glassMaterial,
        ...["floor", "ceiling", "roof", "stairs"].flatMap((part) => [
          style[part] ? `--${part}` : `--no-${part}`,
          `--${part}-color`, style[part + "Color"],
          `--${part}-material`, style[part + "Material"],
        ]),
        "--intensity", style.intensity,
        "--description", `Generated from ${path.basename(imagePath)}`]],
    ];

    let stats = null;
    for (const [label, cmd, rawArgs] of stages) {
      const args = rawArgs.map(String);
      const started = Date.now();
      const r = await run(cmd, args, workdir);
      log.push({
        stage: label,
        command: [path.basename(cmd), ...args.map((a) => (/[\s{}"]/.test(a) ? JSON.stringify(a) : a))].join(" "),
        ms: Date.now() - started,
        code: r.code,
        output: [r.stderr.trim(), label.startsWith("5") ? "" : r.stdout.trim()].filter(Boolean).join("\n"),
      });
      if (r.code !== 0) {
        return res.json({ ok: false, error: `${label} failed`, log, settings: { extract, plan, build, style } });
      }
      if (label.startsWith("5")) {
        try { stats = JSON.parse(r.stdout.trim().split("\n").pop()); } catch { /* reported below */ }
      }
    }

    const planJson = JSON.parse(fs.readFileSync(path.join(workdir, "floorplan_runs.json"), "utf8"));
    const settings = { image: path.basename(imagePath), extract, plan, build, style };
    fs.writeFileSync(path.join(workdir, "settings.json"), JSON.stringify(settings, null, 2));

    res.json({
      ok: true,
      slug,
      stats,
      log,
      settings,
      plan: planJson,
      unplacedMarkers: (planJson.unplaced_markers || []).length,
      overlayUrl: `/api/overlay/${slug}?t=${Date.now()}`,
      files: ["brs", "brz"].map((fmt) => {
        const p = path.join(workdir, `${slug}.${fmt}`);
        return { format: fmt, name: `${slug}.${fmt}`, bytes: fs.existsSync(p) ? fs.statSync(p).size : 0 };
      }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message), log });
  }
});

app.get("/api/download", (req, res) => {
  const slug = path.basename(String(req.query.slug || ""));
  const format = String(req.query.format || "brz");
  if (!["brs", "brz"].includes(format)) return res.status(400).json({ ok: false, error: "format must be brs or brz" });
  const p = path.join(RUNS, slug, `${slug}.${format}`);
  if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: "nothing generated for that plan yet" });
  res.download(p, `${slug}.${format}`);
});

// Copy the generated save straight into the Brickadia builds folder. Only ever
// on an explicit click, only a .brs/.brz this server just generated, and it
// reports the exact destination path back so there's no guessing where it went.
app.post("/api/install", (req, res) => {
  try {
    const slug = path.basename(String(req.body?.slug || ""));
    const format = String(req.body?.format || "brz");
    if (!["brs", "brz"].includes(format)) throw new Error("format must be brs or brz");
    const src = path.join(RUNS, slug, `${slug}.${format}`);
    if (!fs.existsSync(src)) throw new Error("nothing generated for that plan yet");
    const dir = String(req.body?.dir || buildsDir() || "");
    if (!dir) throw new Error("no Brickadia builds folder found -- enter one to copy into");
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`not a folder: ${dir}`);
    const dest = path.join(dir, `${slug}.${format}`);
    const existed = fs.existsSync(dest);
    fs.copyFileSync(src, dest);
    res.json({ ok: true, dest, replaced: existed, bytes: fs.statSync(dest).size });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err.message) });
  }
});

app.listen(PORT, () => {
  console.log(`Brick builder GUI:  http://localhost:${PORT}`);
  console.log(`  python:        ${PY}`);
  console.log(`  working dirs:  ${RUNS}`);
  console.log(`  brickadia:     ${buildsDir() || "(builds folder not found)"}`);
});
