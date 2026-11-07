// dmapong/gen.mjs: Night Pong with "hardware DMA channels" in pure wires (Rookstun, owner OK 2026-11-06: "just make his
// engine and keep super sigma derivatives"). Built on Rookstun's base, pong/Baseline240Engine_wgen.mjs (240 x 160, 8
// strips of 20 rows). Instead of one chip doing everything in series, three kinds of chips run side by side:
//   CPU      = Baseline240Engine's game logic unchanged (balls, paddle, bumper, sound, HUD); its drawing is cut out and
//              replaced by a BUS: every tick it writes nb, bx0..9, by0..9, px, over, won, vis on their own wires, then
//              bumps `frame` last.
//   CHANNEL  = 4 chips (k = 0..3), one per 40 rows (2 strips each). On every new frame each one rebuilds ALL of its rows
//              from the bus into back buffers (no shared state, so they never wait on each other), then reports `ready`.
//   SWAP     = 1 chip: when all channels report the same frame it sets `go` to that frame, and every channel shows its back
//              buffers at once, so the screen never mixes frames (tearing fix).
import { generate as baseline, W, H, STRIP } from '../pong/Baseline240Engine_wgen.mjs';

export { W, H, STRIP };
export const NCH = 5, NB = 10; // 5 channels x 16 rows: one 4-unit strip each (16 x 0.25), whole brick sizes
const PY = H - 12, PW = 28, BS = 4; // Baseline240Engine's paddle row, paddle width, ball size
// Screen at HALF resolution (Rookstun 2026-11-06: 120 x 80 on 30 x 20 micros): the game still runs on the 240 x 160 grid,
// the channels sample every 2nd logical pixel (output x' shows logical 2x'). OW/OH = output size.
export const SC = 2, OW = W / SC, OH = H / SC, ROWS = OH / NCH, OSTRIP = ROWS;
const FONT = { U: ['101', '101', '101', '101', '111'], R: ['110', '101', '110', '101', '101'], D: ['110', '101', '101', '101', '110'],
  I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'], '.': ['000', '000', '000', '000', '010'],
  W: ['101', '101', '101', '111', '101'], N: ['110', '101', '101', '101', '101'], A: ['010', '101', '111', '101', '101'],
  '!': ['010', '010', '010', '000', '010'], ' ': ['000', '000', '000', '000', '000'],
  G: ['011', '100', '101', '101', '011'], M: ['101', '111', '111', '101', '101'], E: ['111', '100', '110', '100', '111'],
  O: ['010', '101', '101', '101', '010'], V: ['101', '101', '101', '101', '010'] };
// the bumper (logical CX 60, CY 70, CR 32) redrawn at output size, the messages XORed in at full 3x5 size so they stay
// legible (at half size the text is wider than the circle: inside it is cut out, outside it is drawn)
export function bumperRows(msgs) {
  const cx = 60 / SC, cy = 70 / SC, cr = 32 / SC;
  return Array.from({ length: OH }, (_, r) => {
    const fill = new Array(OW).fill(false), cdy = cy - (r + 0.5);
    if (Math.abs(cdy) < cr) { const hw = Math.sqrt(cr * cr - cdy * cdy); for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) fill[x] = true; }
    for (const [txt, top] of msgs) {
      const gy = r - top, x0 = Math.round(cx - (txt.length * 4 - 1) / 2);
      if (gy >= 0 && gy < 5) [...txt].forEach((ch, k) => { for (let c = 0; c < 3; c++) if (FONT[ch][gy][c] === '1') fill[x0 + k * 4 + c] = !fill[x0 + k * 4 + c]; });
    }
    const iv = [];
    for (let x = 0; x < OW;) { if (!fill[x]) { x++; continue; } let e = x; while (e < OW && fill[e]) e++; iv.push([x, e]); x = e; }
    return iv;
  });
}
const CY2 = 70 / SC, WIN = [['U R DID IT.', CY2 - 6], ['WINRAR!', CY2 + 1]], OVER = [['GAME', CY2 - 6], ['OVER', CY2 + 1]];

const cutMod = (src, name) => {
  const i = src.indexOf(`mod ${name}(`);
  if (i < 0) throw Error(`no mod ${name}`);
  const j = src.indexOf('\n}\n', i);
  return [src.slice(0, i), src.slice(j + 3)];
};

export function cpuSrc() {
  let s = baseline().src;
  // the strips now come from the channels
  s = s.replace(/^@right out strip\d+: string = st\d+\n/gm, '');
  // drawing out: renderRow goes, flush() becomes the bus write
  let [a, b] = cutMod(s, 'renderRow'); s = a + b;
  [a, b] = cutMod(s, 'flush');
  s = a + 'mod flush() {\n  bus()\n}\n' + b;
  // after the seat empties, tell the channels to blank the screen
  [a, b] = cutMod(s, 'idle');
  const idleBody = s.slice(a.length, s.length - b.length);
  s = a + idleBody.replace(/\n}\n$/, '\n  bus()\n}\n') + b;
  const busVars = [
    'var frameO: int = 0', 'var nbO: int = 0', 'var pxO: float = 0.0', 'var overO: int = 0', 'var wonO: int = 0', 'var visO: int = 0',
    ...Array.from({ length: NB }, (_, i) => `var bxO${i}: float = 0.0\nvar byO${i}: float = 0.0`),
  ].join('\n');
  const busOuts = [
    '@right out frame_: int = frameO', '@right out nb_: int = nbO', '@right out px_: float = pxO', '@right out over_: int = overO', '@right out won_: int = wonO', '@right out vis_: int = visO',
    ...Array.from({ length: NB }, (_, i) => `@right out bx${i}_: float = bxO${i}\n@right out by${i}_: float = byO${i}`),
  ].join('\n');
  // bus(): the live balls (y on screen), at most NB, then the paddle and flags; frame goes LAST
  const busMod = `mod bus() {
  var n: int = 0
  n = 0
${Array.from({ length: NB }, (_, i) => `  byO${i} = ${H + 10}.0`).join('\n')}
  for i in 0..bx.length() {
    if by.get(i) < ${H}.0 && n < ${NB} {
${Array.from({ length: NB }, (_, i) => `      if n == ${i} {\n        bxO${i} = bx.get(i)\n        byO${i} = by.get(i)\n      }`).join('\n')}
      n += 1
    }
  }
  nbO = n
  pxO = px
  overO = over
  wonO = if won then 1 else 0
  visO = if was then 1 else 0
  frameO += 1
}
`;
  s = s.replace('var half: bool = false', `var half: bool = false\n${busVars}`);
  s = s.replace('@right out msg_:', `${busOuts}\n@right out msg_:`);
  s = s.replace('mod note(', `${busMod}mod note(`);
  return s;
}

// one DMA channel: rows r0 .. r0 + ROWS - 1, drawn into two back buffers (its two strips), shown on `go`
export function channelSrc(k) {
  const q = JSON.stringify, r0 = k * ROWS;
  // the bumper spans (output pixels) of THIS channel's rows only, per variant (0 plain, 1 win text, 2 game over), re-indexed from 0
  const part = v => {
    const rows = bumperRows([[], WIN, OVER][v]), idx = [0], s = [], e = [];
    for (let r = r0; r < r0 + ROWS; r++) { for (const [a, b] of rows[r]) { s.push(a); e.push(b); } idx.push(s.length); }
    return `const CI${v} = [${idx.join(', ')}]\nconst CS${v} = [${s.join(', ') || '0'}]\nconst CE${v} = [${e.join(', ') || '0'}]`;
  };
  // a logical span [a, b) covers output pixel x' when a <= 2x' < b: x' from ceil(a/2) to ceil(b/2)
  return `// GENERATED by dmapong/gen.mjs: DMA channel ${k} (output rows ${r0}..${r0 + ROWS - 1} of ${OW} x ${OH})
@left in frame: int
@left in nb: int
@left in px: float
@left in over: int
@left in won: int
@left in vis: int
@left in go: int
${Array.from({ length: NB }, (_, i) => `@left in bx${i}: float\n@left in by${i}: float`).join('\n')}

const SP = ${q(' '.repeat(OW))}
const BL = ${q('█'.repeat(OW))}
${part(0)}
${part(1)}
${part(2)}
var bxs: float[]
var bys: float[]
var is: float[]
var ie: float[]
var pbA: string = ""
var fA: int = -1
var pbO: string = ""
var fO: int = -1
var stA: string = ""
var readyO: int = 0
var s: string = ""
var cur: float = 0.0

@right out stripA_: string = stA
@right out ready_: int = readyO

mod row(lr: int) -> string {
  let r = (${r0} + lr) * ${SC}
  is.resize(0, 0.0)
  ie.resize(0, 0.0)
  for i in 0..nb {
    let y0 = floor(bys.get(i))
    if r >= y0 && r < y0 + ${BS} {
      let x0 = floor(bxs.get(i))
      is.push(floor((x0 + 1.0) / 2.0))
      ie.push(floor((x0 + ${BS + 1}.0) / 2.0))
    }
  }
  if r >= ${PY} && r < ${PY + 4} {
    is.push(floor((floor(px) + 1.0) / 2.0))
    ie.push(floor((floor(px) + ${PW + 1}.0) / 2.0))
  }
  if r < 2 {
    is.push(0.0)
    ie.push(${OW}.0)
  }
  if over > 0 {
    for j in CI2[lr]..CI2[lr + 1] {
      is.push(CS2[j])
      ie.push(CE2[j])
    }
  } else { if won > 0 {
    for j in CI1[lr]..CI1[lr + 1] {
      is.push(CS1[j])
      ie.push(CE1[j])
    }
  } else {
    for j in CI0[lr]..CI0[lr + 1] {
      is.push(CS0[j])
      ie.push(CE0[j])
    }
  } }
  is.sortMultiple(ie)
  s = ""
  cur = 0.0
  for j in 0..is.length() {
    let a = max(max(is.get(j), cur), 0.0)
    let b = min(ie.get(j), ${OW}.0)
    if b > a {
      s = s .. SP.Substring(0, a - cur) .. BL.Substring(0, b - a)
      cur = b
    }
  }
  return s .. SP.Substring(0, ${OW}.0 - cur)
}
// a new frame on the bus: copy the balls off their wires, draw both strips into the back buffers, report ready
on Change(frame) {
  // keep the previous frame too: go can arrive after the next frame already landed here (seam tearing, Rookstun 2026-11-06)
  pbO = pbA
  fO = fA
  fA = frame
  bxs.resize(0, 0.0)
  bys.resize(0, 0.0)
${Array.from({ length: NB }, (_, i) => `  bxs.push(bx${i})\n  bys.push(by${i})`).join('\n')}
  if vis > 0 {
    var acc: string = ""
    acc = ""
    for j in 0..${ROWS} {
      if j < ${ROWS - 1} { acc = acc .. row(j) .. "\\n" } else { acc = acc .. row(j) }
    }
    pbA = acc
  } else {
    pbA = ""
  }
  readyO = frame
}
// the swap chip says every channel has the same frame: show it
on Change(go) {
  if go == fA { stA = pbA } else { if go == fO { stA = pbO } }
}
`;
}

export function swapSrc() {
  return `// GENERATED by dmapong/gen.mjs: frame swap for ${NCH} DMA channels
${Array.from({ length: NCH }, (_, k) => `@left in r${k}: int`).join('\n')}
var goO: int = 0
@right out go_: int = goO
// go = the frame all 4 channels have ready. NOT a toggle: the 4 Change events of one frame all ran on the old state and
// flipped a bool 4 times (= no change, black screen, Rookstun 2026-11-06). Writing the same number again is harmless.
mod check() {
  if ${Array.from({ length: NCH - 1 }, (_, k) => `r${k} == r${k + 1}`).join(' && ')} {
    goO = r0
  }
}
${Array.from({ length: NCH }, (_, k) => `on Change(r${k}) {\n  check()\n}`).join('\n')}
`;
}

// the cabinet options Baseline240Engine builds with (its strips are wired from the channels instead of the CPU)
export function cabinetGen() {
  const g = baseline();
  return { ...g, W: OW, H: OH, STRIP: OSTRIP, src: cpuSrc() }; // the cabinet screen is the output size
}
