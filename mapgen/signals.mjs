// Traffic signals (2026-10-26, owner: realistic roads "as if for a driver's test", working lights): one prefab
// (own owner, City Signals) with every signalised junction of roads.mjs. Per inbound leg a mast-arm pole on the
// far right corner: a 3-section head (red / yellow / green) over the lane, a street name blade on the arm, a
// cobra-head luminaire on top; pedestrian heads (hand / walking person) facing each crosswalk.
// Timing: one hidden microchip per junction, purely combinational (no exec loop):
//   t = (ServerUptime + offset) mod 52;  N-S green 0-20, yellow 20-24, all red 24-26,
//   E-W green 26-46, yellow 46-50, all red 50-52; WALK across a street for the first 14 s of the parallel green.
// offset = x / 51 ft/s (35 mph) so E-W greens run as a green wave. Each lens: a PointLight (bEnabled wired) and a
// BrickPropertyChanger (colour wired: dim lens <-> lit lens).
//   buildSignals(net, { T, names, F }) -> { bytes, stats }
import { right } from './roads.mjs';

export const SIGNAL_OWNER = { id: 'c1770000-0000-4b0b-9a11-00000000519a', name: 'City Signals', display_name: 'City Signals' };
const CYCLE = 52;
const LENS = { red: [[255, 36, 28], [72, 14, 12]], yellow: [[255, 186, 0], [78, 58, 8]], green: [[40, 255, 130], [10, 58, 30]], hand: [[255, 110, 30], [70, 32, 10]], walk: [[236, 242, 255], [58, 60, 64]] };

export async function buildSignals(net, { T, names }) {
  const lib = await import(new URL('../tools/brs4/dist.mjs', import.meta.url).href);
  const { World, brdb } = lib;
  const C = brdb.COMPONENTS;
  const w = new World();
  const O = w.addOwner(SIGNAL_OWNER);
  const st = { junctions: 0, heads: 0, pedheads: 0, lights: 0, gates: 0 };
  const box = (x0, y0, z0, x1, y1, z1, color, extra = {}) => w.addBrick({ asset: 'PB_DefaultMicroBrick', size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, (z1 - z0) / 2],
    position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, owner_index: O, ...extra });
  const wire = (a, ap, b, bp) => { if (!a.c.PORTS[ap] || !b.c.PORTS[bp]) throw Error(`bad port ${a.c.NAME}.${ap} -> ${b.c.NAME}.${bp}`);
    w.addWire({ brick: a.h, component_type: a.c.NAME, port: a.c.PORTS[ap] }, { brick: b.h, component_type: b.c.NAME, port: b.c.PORTS[bp] }); };
  const num = v => ({ $variant: 'f64', value: v });
  const rgba = c => ({ R: c[0], G: c[1], B: c[2], A: 255 });
  const changer = color => ({ type: C.BrickPropertyChanger.NAME, data: { bVisibility: true, bCollisionEnabled: true, bCollisionEnabled_Player: true,
    bCollisionEnabled_Player1: true, bCollisionEnabled_Player2: true, bCollisionEnabled_Player3: true, bCollisionEnabled_Weapon: true,
    bCollisionEnabled_Interaction: true, bCollisionEnabled_Physics: true, Color: rgba(color), MaterialAlpha: 0, Material: 0 } });
  const point = (color, radius, b, on = false) => ({ type: C.PointLight.NAME, data: { bMatchBrickShape: true, bEnabled: on, Brightness: b, Radius: radius, Color: rgba(color), bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });
  const spot = color => ({ type: C.SpotLight.NAME, data: { Rotation: { Pitch: 270, Yaw: 0, Roll: 0 }, InnerConeAngle: 45, OuterConeAngle: 75, bEnabled: true, Brightness: 10, Radius: 1000, Color: rgba(color), bUseBrickColor: false, bCastShadows: false, RayTracingVisibility: 0 } });
  const TEXT = { Font: 0, Rotation: -90, Skew: 0, Kerning: 0, LineHeight: 0.8, WidthScale: 1, LineOffset: 0, Anchor: { X: 0.5, Y: 0.5 }, Offset: { X: 0, Y: 0, Z: 0 },
    Color: rgba([250, 250, 250]), MaterialSlider: 10, ShadingWidth: 2, OutlineColor: rgba([20, 20, 20]), OutlineWidth: 0, ScuffWidth: 0, GraffitiDepthLimit: 5, GraffitiAngleLimit: 45,
    GraffitiLayer: 0, bEnabled: true, Face: 4, bAlignToWedge: false, bOverrideColor: true, Typeface: 0, Billboard: 0, Material: 1, Shading: 0, bFlipShading: false, Outline: 0,
    bSharpCorners: true, bSharpOutlines: true, bOverrideOutlineColor: true, bForeground: false, Text: '' };
  // orientation whose local +Z faces (dx, dy) and local y runs down world -z (ruins.mjs codeFacing, base 3*4+1 faces -y)
  const FACE = { '0,-1': [3, 1], '1,0': null, '-1,0': null, '0,1': null };
  { // derive the other three from the -y one by turning about z (orient.mjs ORIENT tables, inlined: rotation r turns by r quarter turns)
    const { ORIENT } = await import('./orient.mjs');
    const base = 3 * 4 + 1, turnZ = ([x, y, z], k) => { for (let i = 0; i < k; i++) [x, y] = [-y, x]; return [x, y, z]; };
    for (let k = 0; k < 4; k++) {
      const want = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => turnZ(ORIENT[base](v), k).map(q => q + 0).join());
      for (let c = 0; c < 24; c++) if ([[1, 0, 0], [0, 1, 0], [0, 0, 1]].every((v, i) => ORIENT[c](v).map(q => q + 0).join() === want[i])) { const f = turnZ([0, -1, 0], k); FACE[f.slice(0, 2).map(q => q + 0).join()] = [c >> 2, c & 3]; }
    }
  }
  const blade = (x, y, z, f, text) => { const [d, r] = FACE[f.map(q => q + 0).join()];
    return w.addBrick({ asset: 'PB_DefaultMicroBrick', direction: d, rotation: r, size: [26, 5, 1], position: [x, y, z], color: [20, 110, 60], owner_index: O,
      components: [{ type: C.TextDisplay.NAME, data: { ...TEXT, Text: text } }] }); };

  const sig = [...net.nodes.values()].filter(n => n.control === 'signal');
  for (const n of sig) {
    // ---- the chip: t, then phase booleans
    const chipBrick = w.addBrick({ asset: 'B_1x1_Microchip', position: [n.cx, n.cy, 600], owner_index: O, visibility: false, collision: false, components: [{ type: 'Component_Internal_Microchip' }] });
    const grid = w.addBrickGrid({ type: 'Entity_MicrochipDynamicBrickGrid', location: { X: 0, Y: 0, Z: 40 }, data: { bCollapsed: true, PlaneCenter: { X: 0, Y: 0, Z: 0 }, PlaneExtent: { X: 60, Y: 60, Z: 2 } } });
    w.registerMicrochipLink(chipBrick, grid);
    let slot = 0;
    const gate = (c, data = {}) => { const i = slot++; st.gates++; return { h: w.addBrick({ asset: c.BRICK, position: [(i % 12) * 40, Math.floor(i / 12) * 40, 2], color: [200, 200, 200], owner_index: O, components: [{ type: c.NAME, data }] }, grid), c }; };
    const consts = new Map();
    const K = v => consts.get(v) ?? consts.set(v, [gate(C.Var, { Value: num(v) }), 'Value']).get(v);
    const P = v => Array.isArray(v) ? v : K(v);
    const ex = (c, ins, out) => { const g = gate(c); for (const [port, src] of Object.entries(ins)) wire(...P(src), g, port); return [g, out ?? (c.PORTS.bOutput ? 'bOutput' : 'Output')]; };
    const lt = (a, b) => ex(C.Expr_CompareLess, { InputA: a, InputB: b }), ge = (a, b) => ex(C.Expr_CompareGreaterOrEqual, { InputA: a, InputB: b });
    const and = (a, b) => ex(C.Expr_LogicalAND, { bInputA: a, bInputB: b }), not = a => ex(C.Expr_LogicalNOT, { bInput: a });
    const up = [gate(C.Expr_ServerUptime), 'Uptime'];
    const offset = Math.round(((n.cx / 510) % CYCLE) * 10) / 10; // green wave along x at 35 mph
    const t = ex(C.Expr_Floor, { Input: ex(C.Expr_MathModuloFloored, { InputA: ex(C.Expr_MathAdd, { InputA: up, InputB: offset }), InputB: CYCLE }) });
    const B = {};
    B.yG = lt(t, 20); B.yY = and(ge(t, 20), lt(t, 24)); B.yR = ge(t, 24);
    B.xG = and(ge(t, 26), lt(t, 46)); B.xY = and(ge(t, 46), lt(t, 50)); B.xR = not(and(ge(t, 26), lt(t, 50)));
    B.walkAcrossX = lt(t, 14); B.walkAcrossY = and(ge(t, 26), lt(t, 40)); // crossing an x-axis street = walking parallel to y traffic
    B.handAcrossX = not(B.walkAcrossX); B.handAcrossY = not(B.walkAcrossY);
    const color = c => { const g = gate(C.Expr_MakeColorSRGB, { R: 0, G: 0, B: 0, A: 255 }); wire(...K(c[0]), g, 'R'); wire(...K(c[1]), g, 'G'); wire(...K(c[2]), g, 'B'); return [g, 'Output']; };
    const sel = new Map();
    const lensColor = (kind, b) => { const key = kind + b; if (!sel.has(key)) sel.set(key, ex(C.Expr_Select, { InputA: color(LENS[kind][1]), InputB: color(LENS[kind][0]), bSelectB: B[b] })); return sel.get(key); };
    const lens = (x0, y0, x1, y1, z0, z1, kind, b, radius = 70) => {
      // the world caps light components, so a lens is a glow brick whose colour the chip switches dim <-> lit
      const h = box(x0, y0, z0, x1, y1, z1, LENS[kind][1], { material: 'BMC_Glow', components: [changer(LENS[kind][1])] });
      void radius;
      const [cg, cp] = lensColor(kind, b);
      wire(cg, cp, { h, c: C.BrickPropertyChanger }, 'Color');
      st.lights++;
    };
    // ---- per inbound leg: pole on the far right corner, mast arm over the lane, head facing the driver
    const legDirs = new Set(n.legs.filter(l => l.nb).map(l => l.s));
    const headsBefore = st.heads;
    for (const l of n.legs) {
      if (!l.nb || !l.inbound) continue;
      const d = [-l.v[0], -l.v[1]], r = right(d), ax = d[0] ? 'x' : 'y', ph = ax === 'x' ? 'x' : 'y';
      const at = (along, lat) => [n.cx + d[0] * along + r[0] * lat, n.cy + d[1] * along + r[1] * lat];
      const rect = (a0, a1, l0, l1, z0, z1, col, extra) => { const [p, q] = at(a0, l0), [s, u] = at(a1, l1); return box(Math.min(p, s), Math.min(q, u), z0, Math.max(p, s), Math.max(q, u), z1, col, extra); };
      const POLE = [208, 196, 120], DARK = [24, 24, 26], STEEL = [150, 152, 156];
      rect(134, 146, 134, 146, 8, 24, STEEL, { material: 'BMC_Metallic' }); // base
      rect(136, 144, 136, 144, 24, 264, POLE); // pole
      rect(138, 142, 40, 136, 196, 200, POLE); // mast arm over the lanes
      // head over the inbound lane (lateral 60): hanger, housing, backplate, three lenses on the face toward the driver
      rect(139, 141, 59, 61, 192, 196, DARK);
      rect(136, 144, 54, 66, 152, 192, [196, 168, 40]);
      rect(144, 146, 50, 70, 150, 194, DARK);
      lens(...rectXY(at, 134, 136, 56, 64), 180, 188, 'red', ph + 'R');
      lens(...rectXY(at, 134, 136, 56, 64), 168, 176, 'yellow', ph + 'Y');
      lens(...rectXY(at, 134, 136, 56, 64), 156, 164, 'green', ph + 'G');
      st.heads++;
      // street name blade on the arm: the street being crossed
      const cross = n.legs.find(q => q.run && (q.v[0] ? 'x' : 'y') !== ax)?.run;
      if (cross) { const [bx, by] = at(140, 96); blade(bx, by, 205, [-d[0], -d[1]], names(cross)); }
      // luminaire on the pole top: arm toward the road, cobra head with a down spot + lens glow
      rect(138, 142, 52, 136, 252, 256, STEEL, { material: 'BMC_Metallic' });
      rect(132, 148, 32, 52, 248, 258, [120, 124, 128], { material: 'BMC_Metallic' });
      rect(134, 146, 34, 50, 246, 248, [255, 236, 200], { material: 'BMC_Glass', components: st.heads === headsBefore + 1 ? [spot([226, 234, 255])] : [] }); // light budget: one lit luminaire per junction
      // pedestrian heads: across leg d (peds look toward this pole from the corner across, facing -r) and across leg r (facing -d)
      const peds = [[d, r], [r, d]];
      for (const [crossDir, faceAway] of peds) {
        const side = Object.entries({ E: [1, 0], W: [-1, 0], N: [0, 1], S: [0, -1] }).find(([, v]) => v[0] === crossDir[0] && v[1] === crossDir[1])[0];
        if (!legDirs.has(side)) continue;
        const f = [-faceAway[0], -faceAway[1]], streetAx = crossDir[0] ? 'x' : 'y';
        const c0 = [n.cx + d[0] * 140 + r[0] * 140 + f[0] * 4, n.cy + d[1] * 140 + r[1] * 140 + f[1] * 4];
        const L = f[0] ? [0, 1] : [1, 0], A = (o, lat) => [c0[0] + f[0] * o + L[0] * lat, c0[1] + f[1] * o + L[1] * lat];
        const rr = (o0, o1, l0, l1, z0, z1, col, extra) => { const [p, q] = A(o0, l0), [s, u] = A(o1, l1); return box(Math.min(p, s), Math.min(q, u), z0, Math.max(p, s), Math.max(q, u), z1, col, extra); };
        rr(0, 10, -6, 6, 80, 106, DARK);
        const [p0, q0] = A(10, -4), [p1, q1] = A(12, 4);
        lens(Math.min(p0, p1), Math.min(q0, q1), Math.max(p0, p1), Math.max(q0, q1), 94, 102, 'hand', 'handAcross' + streetAx.toUpperCase(), 40);
        lens(Math.min(p0, p1), Math.min(q0, q1), Math.max(p0, p1), Math.max(q0, q1), 83, 91, 'walk', 'walkAcross' + streetAx.toUpperCase(), 40);
        st.pedheads++;
      }
      // push button for the crosswalk ahead
      rect(130, 136, 139, 141, 40, 48, [210, 180, 40]);
    }
    st.junctions++;
  }
  w.makePrefab({});
  return { bytes: w.toBrz({ bundle: { description: 'City traffic signals' }, externalAssets: [{ type: 'BrickFontDescriptor', name: 'Bungee' }] }), stats: st };
}

// a lens rectangle in world coordinates from the leg frame (along a0..a1, lateral l0..l1) -> [x0, y0, x1, y1] for lens()
function rectXY(at, a0, a1, l0, l1) { const [p, q] = at(a0, l0), [s, u] = at(a1, l1); return [Math.min(p, s), Math.min(q, u), Math.max(p, s), Math.max(q, u)]; }
