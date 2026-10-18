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
// (2026-10-17, owner: "wait this is its new body ... this") = the owner's clipboard frog/frog_owner.brz: ONE
// PB_Frog brick (green glass, as placed: rotation 2). The soul (tools/Clipboard_2026-10-17_19-55-35.brz)
// lives in it: its point light + creepy hum components go on the frog brick. Collision off (it orbits heads).
// (The earlier micro-brick frog with glow wings is in git history, 1fcf628..)
const w = new brs.World();
const owner = w.addOwner({ id: OWNER.id, name: OWNER.name, display_name: OWNER.display });
const NOCOL = { player: false, weapon: false, interaction: false, physics: false };
const brs4 = await import(pathToFileURL(path.join(here, '../tools/brs4/dist.mjs')).href);
const frogR = brs4.WorldReader.from(fs.readFileSync(path.join(here, 'frog_owner.brz')));
const frogB = [...frogR.bricks(1)][0];
const soulR = brs4.WorldReader.from(fs.readFileSync(path.join(here, '../tools/Clipboard_2026-10-17_19-55-35.brz')));
const soulC = soulR.componentChunk(1, soulR.brickChunkIndex(1)[0].index).components;
w.addBrick({ asset: frogR.brickAssets()[frogB.asset_name_index], size: frogB.size, position: [0, 0, frogB.size[2]],
  direction: frogB.direction, rotation: frogB.rotation, color: frogB.color, material: frogR.materials()[frogB.material_index],
  material_intensity: frogB.material_intensity, owner_index: owner, collision: NOCOL,
  components: soulC.map(c => ({ type: c.typeName, data: c.data })) });
const boxes = [];
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
      let pa = Deg2Rad(pi1)
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
eyes += `      PrintToConsole(Fmt("fe|{A:.0}|{B:.0}|{C:.1}|{D:.1}|{E:.1}|{F:.1}|{G}", fr0, rw, E.x, E.y, E.z, y1, Fmt("{A:.1}|{B}", pi1, cells.join(","))))
      row = if rw + 1.0 >= ${H}.0 then 0.0 else rw + 1.0
      frame = if rw + 1.0 >= ${H}.0 then fr0 + 1.0 else fr0
      poseT = if pT + dt > POSE_EVERY then 0.0 else pT + dt
      if pT + dt > POSE_EVERY {
        PrintToConsole(Fmt("fr|{A:.1}|{B:.1}|{C:.1}|{D:.1}|{E:.1}|{F}", p1.x, p1.y, p1.z, y1, pi1, hb0))
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
