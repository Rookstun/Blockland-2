// Check, preview and deploy a standalone build job (the mapgen/shoe.mjs pattern) so a non-Claude agent
// (Gemini CLI, see GEMINI.md) can't ship what the game rejects. Exits 1 on any problem.
//   node tools/gemini/ship.mjs JOB.json            check + render previews (JOB.south.png, JOB.east.png), no deploy
//   node tools/gemini/ship.mjs JOB.json --deploy   the same, then Clear the build's owner and load ALL bricks in ONE op
import fs from 'fs';
import { execFileSync } from 'child_process';
import { worldBox } from '../../mapgen/orient.mjs';
import { FIXED } from '../../mapgen/builder.mjs';

const [file, flag] = process.argv.slice(2);
if (!file) { console.error('usage: ship.mjs JOB.json [--deploy]'); process.exit(2); }
const MAP_OWNER = '891c4675-d18a-4ce1-a465-f4193ffe8b39';
const job = JSON.parse(fs.readFileSync(file, 'utf8'));
const err = [], bad = m => err.push(m);
const ops = job.ops ?? [];
const brickOps = ops.filter(o => o.op === 'bricks');
if (brickOps.length !== 1 || ops.length !== 1) bad(`job must be exactly ONE bricks op, has ${ops.length} ops / ${brickOps.length} bricks ops`);
const op = brickOps[0] ?? { bricks: [] };
const owner = op.owner;
if (!owner?.id || !owner?.name) bad('bricks op needs its own owner {id, name, display_name} (no owner = dies on reload)');
else if (owner.id === MAP_OWNER) bad('owner is the MAP owner: give the build its own owner id so Bricks.Clear only removes this build');
if (op.at && op.at.some(v => v !== 0)) bad('use at [0,0,0] with absolute brick positions');

const bricks = op.bricks ?? [];
if (!bricks.length) bad('no bricks');
const boxes = [];
bricks.forEach((b, i) => {
  const tag = `#${i} ${b.asset ?? '?'} ${JSON.stringify(b.position)}`;
  if (!b.asset) return bad(`${tag}: no asset`);
  if (!Array.isArray(b.position) || b.position.some(v => !Number.isInteger(v))) return bad(`${tag}: position must be 3 integers`);
  if ('label' in b) bad(`${tag}: strip the builder's label field before writing the job`);
  const s = b.size ?? [0, 0, 0];
  if (s.some(v => !Number.isInteger(v) || v < 0)) bad(`${tag}: size must be non-negative integer HALF extents`);
  if (b.asset.startsWith('PB_Default') && !b.asset.startsWith('PB_DefaultMicro')) {
    if (s[0] % 5 || s[1] % 5) bad(`${tag}: procedural x/y half extents must be multiples of 5 (got ${s}); use PB_DefaultMicroBrick`);
    if (s[2] % 2) bad(`${tag}: procedural z half extent must be even (got ${s[2]})`);
    if (/Tile$/.test(b.asset) && s[2] < 2) bad(`${tag}: tiles must be at least 4 thick (z half >= 2)`);
  }
  if (Math.max(...s) > 1700) bad(`${tag}: half extent ${Math.max(...s)} too long, split it (builder.slab)`);
  if (b.asset === 'B_1x1_Microchip' && (b.visibility !== false || b.collision !== false)) bad(`${tag}: microchips need visibility false + collision false`);
  if (b.color && (!Array.isArray(b.color) || b.color.length < 3 || b.color.some(v => !Number.isInteger(v) || v < 0 || v > 255))) bad(`${tag}: color must be [r,g,b] 0-255 integers`);
  if (b.direction != null && !(b.direction >= 0 && b.direction <= 5)) bad(`${tag}: direction 0-5`);
  if (b.rotation != null && !(b.rotation >= 0 && b.rotation <= 3)) bad(`${tag}: rotation 0-3`);
  const bx = worldBox(b, FIXED);
  if (bx[0][2] < 0) bad(`${tag}: below z 0`);
  boxes.push([bx, i]);
});
// overlap (same grid): sweep on x; group/multi-micro-at-one-spot exceptions are not allowed here on purpose
boxes.sort((a, b) => a[0][0][0] - b[0][0][0]);
let overlaps = 0;
for (let i = 0; i < boxes.length; i++) {
  const [[lo, hi], bi] = boxes[i];
  for (let j = i + 1; j < boxes.length && boxes[j][0][0][0] < hi[0]; j++) {
    const [[l2, h2], bj] = boxes[j];
    if (lo[1] < h2[1] && l2[1] < hi[1] && lo[2] < h2[2] && l2[2] < hi[2] && l2[0] < hi[0] && lo[0] < h2[0] && overlaps++ < 10)
      bad(`overlap: #${bi} ${bricks[bi].asset} ${JSON.stringify(bricks[bi].position)} and #${bj} ${bricks[bj].asset} ${JSON.stringify(bricks[bj].position)} (the game rejects both)`);
  }
}
if (overlaps > 10) bad(`... ${overlaps - 10} more overlaps`);

// previews: two isoview renders around the build's bounding box
if (bricks.length && !err.some(e => e.includes('position'))) {
  const lo = [0, 1, 2].map(k => boxes.reduce((m, [b]) => Math.min(m, b[0][k]), Infinity)), hi = [0, 1, 2].map(k => boxes.reduce((m, [b]) => Math.max(m, b[1][k]), -Infinity)); // no spread: 100k+ bricks overflow the stack
  const c = [0, 1].map(k => Math.round((lo[k] + hi[k]) / 2)), half = Math.ceil(Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 2) + 40;
  const upp = Math.max(1, Math.ceil(half / 300)), tmp = file.replace(/\.json$/, '') + '.bricks.json';
  fs.writeFileSync(tmp, JSON.stringify(bricks));
  for (const [name, az] of [['south', -90], ['east', 0]]) {
    const out = file.replace(/\.json$/, '') + `.${name}.png`;
    execFileSync('node', [new URL('../../mapgen/isoview.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), tmp, c[0], c[1], half, out, az, 30, upp].map(String), { stdio: 'inherit' });
    console.log(`preview ${out}`);
  }
  fs.unlinkSync(tmp);
  console.log(`${bricks.length} bricks, box ${lo} .. ${hi}`);
}
if (err.length) { console.error(`FAILED ${err.length} check(s):\n` + err.slice(0, 40).join('\n')); process.exit(1); }
console.log('checks OK');
if (flag !== '--deploy') process.exit(0);

const HOST = 'pzedlo.hopto.org';
const ssh = (cmd, input) => execFileSync('ssh', ['-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes', HOST, cmd], { input, maxBuffer: 64 << 20 }).toString();
const world = ssh('cd ~/omegga-server; f=$(ls -t data/logs/omegga-*.log | head -1); grep -o "Opening existing bundle at .*Worlds/[^ ]*" $f | tail -1').trim().split('/').pop();
console.log(`active world: ${world}`);
const run = o => ssh('cd ~/omegga-server/bridge/tools && ~/node22/bin/node job.mjs', JSON.stringify({ ops: o }));
// clear in one job, load in a second (cmd ops queue, a bricks load runs at once: CLAUDE.md)
console.log(run([{ op: 'cmd', line: `br.Bricks.Clear ${owner.id} 1`, captureMs: 2000 }]).slice(0, 2000));
const res = run([{ ...op, captureMs: op.captureMs ?? 4000 }]);
console.log(res.slice(0, 4000));
if (/Missing brick type|overlapping/i.test(res)) { console.error('GAME REJECTED BRICKS (see above)'); process.exit(1); }
