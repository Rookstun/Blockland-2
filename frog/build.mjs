// Builds the frog: node frog/build.mjs [W H HFOV]
//   frog/frog_body.brz  the frog (micro bricks, faces +X, feet at z 0) with the owner's soul brick
//                       (tools/Clipboard_2026-10-17_19-55-35.brz: green glass 1x1, point light, creepy hum) on its back
//   frog/frog.brz       the brain chip (frog.ws + generated eye rows), owned by "Frog Soul" (own wire budget)
//   frog/view/eye.json  eye geometry for the web view
// Load: br.Prefab.Load "frog" -8340 -7400 8000 0 16 (sky, next to the other chips); the body spawns at HOME.
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
import * as brs from '../mapgen/lib/brs.mjs';
import { reown } from '../pots/reown.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
export const OWNER = { id: 'f2060000-0000-4b0b-9a11-00000000f206', name: 'FrogSoul', display: 'Frog Soul' };
const [W, H, HFOV] = [+(process.argv[2] ?? 40), +(process.argv[3] ?? 24), +(process.argv[4] ?? 100)];

// ---- body ----
const w = new brs.World();
const owner = w.addOwner({ id: OWNER.id, name: OWNER.name, display_name: OWNER.display });
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
const C = { skin: [58, 140, 52], dark: [34, 92, 36], spot: [24, 66, 30], belly: [196, 206, 120], eye: [236, 222, 96], pupil: [12, 12, 12], mouth: [70, 30, 30], toe: [92, 170, 70] };
const boxes = [];
// box by EVEN corners [x0,x1) etc. -> micro brick
const box = (x0, x1, y0, y1, z0, z1, color, extra = {}) => boxes.push({ asset: 'PB_DefaultMicroBrick', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...extra });
for (const s of [-1, 1]) {
  const Y = (a, b) => s > 0 ? [a, b] : [-b, -a];
  box(-22, -8, ...Y(14, 20), 0, 10, C.dark);       // folded back thigh
  box(-8, 6, ...Y(14, 22), 0, 2, C.toe);           // back foot
  box(8, 14, ...Y(14, 18), 0, 8, C.skin);          // front leg
  box(14, 22, ...Y(12, 20), 0, 2, C.toe);          // front foot
  box(12, 20, ...Y(6, 14), 18, 26, C.eye);         // bulging eye
  box(20, 22, ...Y(8, 12), 20, 24, C.pupil);       // pupil
}
box(-18, 16, -14, 14, 2, 6, C.belly);              // belly
box(-18, 16, -14, 14, 6, 16, C.skin);              // body
box(16, 22, -14, 14, 8, 10, C.belly);              // chin
box(16, 22, -14, 14, 10, 12, C.mouth);             // mouth line
box(16, 22, -14, 14, 12, 18, C.skin);              // snout
// back hump, open round the soul (soul = 10x10x12 at x -6..4, y -5..5, z 16..28)
box(-16, -6, -12, 12, 16, 22, C.skin);
box(4, 12, -12, 12, 16, 18, C.skin);
box(-6, 4, -12, -6, 16, 22, C.skin); box(-6, 4, 6, 12, 16, 22, C.skin);
box(-14, -10, -10, -6, 22, 24, C.spot); box(-14, -10, 6, 10, 22, 24, C.spot); box(6, 10, -4, 4, 18, 20, C.spot);
box(12, 16, -14, -6, 16, 18, C.skin); box(12, 16, 6, 14, 16, 18, C.skin);
for (const b of boxes) w.addBrick({ ...b, owner_index: owner, collision: NOCOL });
// the soul, exactly as the owner made it
const soulR = (await import(pathToFileURL(path.join(here, '../tools/brs4/dist.mjs')).href)).WorldReader
  .from(fs.readFileSync(path.join(here, '../tools/Clipboard_2026-10-17_19-55-35.brz')));
const soulB = [...soulR.bricks(1)][0];
const soulC = soulR.componentChunk(1, soulR.brickChunkIndex(1)[0].index).components;
w.addBrick({ asset: 'PB_DefaultBrick', size: soulB.size, position: [-1, 0, 22], color: soulB.color, material: 'BMC_Glass',
  material_intensity: soulB.material_intensity, owner_index: owner, collision: NOCOL,
  components: soulC.map(c => ({ type: c.typeName, data: c.data })) });
w.makePrefab();
const body = w.toBrz({ externalAssets: soulR.externalAssets() });
fs.writeFileSync(path.join(here, 'frog_body.brz'), body);

// ---- eyes: one unrolled row of W sweeps ----
const t = Math.tan(HFOV * Math.PI / 360), tv = t * H / W;
const U = [...Array(W)].map((_, c) => (((c + 0.5) / W) * 2 - 1) * t);
let eyes = `      let rw = row
      let fr0 = frame
      let pT = poseT
      let ya = Deg2Rad(y1)
      let pa = Deg2Rad(pi0)
      let F = Vec(cos(pa) * cos(ya), cos(pa) * sin(ya), sin(pa))
      let R = Vec(0.0 - sin(ya), cos(ya), 0.0)
      let UP = Vec(0.0 - sin(pa) * cos(ya), 0.0 - sin(pa) * sin(ya), cos(pa))
      let E = p1 + Vec(cos(ya) * EYE_FWD, sin(ya) * EYE_FWD, EYE_Z)
      let v = ${tv.toFixed(6)} - (rw + 0.5) * ${(2 * tv / H).toFixed(6)}
`;
// a Sweep reaches only 100 units: each ray is SEG chained 100-unit segments (frog eyes see ~SEG*10 studs)
const SEG = +(process.env.FROG_SEG ?? 3);
const ray = (c, k, ind) => {
  const o = k === 0 ? 'E' : `(E + d${c} * ${(k * 99).toFixed(1)})`;
  let x = `${ind}let s${c}_${k} = Sweep(${o}, d${c}, 100.0, ignore = body, detectBricks = true, detectMap = true, detectPlayers1 = true, ignoreOwningGrid = false)
${ind}on s${c}_${k}.Hit {
${ind}  cells[${c}] = Fmt("{A}{B:.0}", s${c}_${k}.HitColor.ToHex().Substring(0, 6), s${c}_${k}.HitDistance + ${k * 99}.0)
${ind}}
${ind}on s${c}_${k}.Miss {
`;
  x += k + 1 < SEG ? ray(c, k + 1, ind + '  ') : `${ind}  cells[${c}] = ""
`;
  return x + `${ind}}
`;
};
for (let c = 0; c < W; c++) eyes += `      let d${c} = Normalize(F + R * ${U[c].toFixed(6)} + UP * v)
` + ray(c, 0, '      ');
eyes += `      PrintToConsole(Fmt("fe|{A:.0}|{B:.0}|{C:.1}|{D:.1}|{E:.1}|{F:.1}|{G}", fr0, rw, E.x, E.y, E.z, y1, Fmt("{A:.1}|{B}", pi0, cells.join(","))))
      row = if rw + 1.0 >= ${H}.0 then 0.0 else rw + 1.0
      frame = if rw + 1.0 >= ${H}.0 then fr0 + 1.0 else fr0
      poseT = if pT + dt > POSE_EVERY then 0.0 else pT + dt
      if pT + dt > POSE_EVERY {
        PrintToConsole(Fmt("fr|{A:.1}|{B:.1}|{C:.1}|{D:.1}|{E:.1}|{F}", p1.x, p1.y, p1.z, y1, pi0, h0))
      }`;
let src = fs.readFileSync(path.join(here, 'frog.ws'), 'utf8')
  .replace('//@EYES@', eyes)
  .replace('var frame: int = 0', 'var frame: float = 0.0').replace('var row: int = 0', 'var row: float = 0.0')
  .replace('var cells: string[] = []', `var cells: string[] = [${Array(W).fill('""').join(', ')}]`);
fs.writeFileSync(path.join(here, 'frog.gen.ws'), src);

// ---- compile ----
const sdk = path.join(here, '../tools/wspkg');
const wasm = await import(pathToFileURL(path.join(sdk, 'wasm.js')).href);
if (typeof wasm.default === 'function') await wasm.default({ module_or_path: fs.readFileSync(path.join(sdk, 'wasm_bg.wasm')) });
const compileWs = wasm.wirescript_compile ?? wasm.default?.wirescript_compile;
let chip;
try { chip = compileWs(src, 'frog', '{}', JSON.stringify({ './frog_body.brz': Array.from(body) })); }
catch (e) { console.error(String(e)); process.exit(1); }
fs.writeFileSync(path.join(here, 'frog.brz'), reown(new Uint8Array(chip), OWNER));
fs.mkdirSync(path.join(here, 'view'), { recursive: true });
fs.writeFileSync(path.join(here, 'view/eye.json'), JSON.stringify({ W, H, HFOV, tanH: t, tanV: tv, range: SEG * 99 }));
console.log(`frog_body.brz ${body.length} B (${boxes.length + 1} bricks), frog.brz ${chip.length} B, eyes ${W}x${H} hfov ${HFOV}`);
