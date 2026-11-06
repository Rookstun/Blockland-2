// Text in bricks (2026-11-06: lorem ipsum for dirt/vix, "this prompt in text", vix's birthday): a dark wall with
// white 3x5 pixel letters, readable from the -y side (left-handed world: facing +y, +x is on the LEFT, so text runs -x).
// node mapgen/textwall.mjs X Y Z OWNER_TAG "TEXT" [WRAP] [PIXEL] > job.json   (X Y = wall's right-hand end as read)
import { makeBuilder } from './builder.mjs';

const [X = 0, Y = 0, Z = 0, TAG = 'text', TEXT = 'HELLO', WRAP = 48, P = 2] = process.argv.slice(2).map((v, i) => (i === 3 || i === 4 ? v : Number(v)));
const hex = [...TAG].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(12, '0').slice(-12);
const OWNER = { id: `c1a0de00-0000-4b0b-9a11-${hex}`, name: `Claude Text ${TAG}`, display_name: `Claude Text ${TAG}` };
const G = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
  "'": '010010000000000', '-': '000000111000000', ' ': '000000000000000',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001',
  5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
};
// word wrap
const lines = [];
for (const word of String(TEXT).toUpperCase().split(/\s+/)) {
  const last = lines.at(-1);
  if (last != null && (last + ' ' + word).length <= WRAP) lines[lines.length - 1] = last + ' ' + word;
  else lines.push(word);
}
const B = makeBuilder();
const MB = 'PB_DefaultMicroBrick';
const INK = { asset: MB, color: [245, 245, 235] }, WALL = { asset: MB, color: [35, 38, 45] }, FOOT = { asset: MB, color: [110, 108, 104] };
const cols = Math.max(...lines.map(l => l.length)) * 4 + 1, rows = lines.length * 7 + 1;
const W = cols * P, H = rows * P;
// wall spans x from 0 (right end as read) to -W; text pixels sit on its -y face
B.box(-W - 4, -6, 0, 4, 10, 8, FOOT, 'footing');
B.box(-W, 0, 8, 0, 4, 8 + H, WALL, 'wall');
lines.forEach((line, li) => {
  for (let r = 0; r < 5; r++) {
    // merge each pixel row of the line into runs
    let run = null;
    const px = [...line].flatMap(ch => [...(G[ch] ?? G['?']).slice(r * 3, r * 3 + 3)].map(Number).concat([0]));
    px.push(0);
    const z0 = 8 + H - (li * 7 + 1 + r + 1) * P;
    px.forEach((on, i) => {
      if (on && run === null) run = i;
      if (!on && run !== null) { B.box(-(1 + i) * P, -2, z0, -(1 + run) * P, 0, z0 + P, INK, 'ink'); run = null; }
    });
  }
});
if (B.dropped.length) throw new Error(`textwall: ${B.dropped.length} dropped: ${B.dropped[0]}`);
const bricks = B.bricks.map(({ label, ...b }) => b);
process.stderr.write(`textwall ${TAG}: ${lines.length} lines, ${W}x${H} units, ${bricks.length} bricks at ${X} ${Y} ${Z}\n`);
console.log(JSON.stringify({ ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: [X, Y, Z], owner: OWNER, captureMs: 4000, bricks }] }));
