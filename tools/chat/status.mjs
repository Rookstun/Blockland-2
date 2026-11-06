// tools/chat/status.mjs busy|idle: Claude's in-game status (owner 2026-11-06: "a top screen indicator that reflects
// your current status ... automagically knows from your client ... like the CLI version's little star").
// Called by Claude Code hooks (.claude/settings.json: UserPromptSubmit/PreToolUse -> busy, Stop -> idle). It only
// talks to the server when the state CHANGES (state file next to this script), and does it in a detached ssh so the
// hook returns at once. On the server it re-places ONE beacon brick whose colour the claudestatus chip reads with a
// Sweep (orange = busy, grey = idle).
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BEACON = [-5600, -12600, 7900]; // under the claudestatus chip (claudestatus/build.mjs)
export const COLOURS = { busy: [217, 119, 87], idle: [128, 128, 128] };
const OWNER = { id: 'c1a0de00-0000-4b0b-9a11-0000005a7a75', name: 'Claude Status', display_name: 'Claude Status' };
const STATE = join(dirname(fileURLToPath(import.meta.url)), 'status.state');

const USAGE = join(dirname(fileURLToPath(import.meta.url)), 'usage.json');
// beacon 0 = state (colour); beacons 1 and 2 = 5-hour and weekly usage: a 2-tall brick whose CENTRE sits pct units up,
// so its top is pct + 1 (whole-percent precision; a height encoding could only do even numbers)
export function job(state, { h5 = 0, wk = 0 } = {}) {
  const col = (x, pct) => ({ asset: 'PB_DefaultMicroBrick', size: [4, 4, 1], position: [x, 0, Math.max(1, Math.min(100, Math.round(pct)))], color: [90, 90, 90], visibility: false });
  return { ops: [{ op: 'clear', owner: OWNER }, { op: 'bricks', at: BEACON, owner: OWNER, captureMs: 0,
    bricks: [{ asset: 'PB_DefaultMicroBrick', size: [4, 4, 2], position: [0, 0, 2], color: COLOURS[state], visibility: false }, col(20, h5), col(40, wk)] }] };
}
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
// send the current state + usage (detached: returns at once)
export function push(state) {
  state ??= (() => { try { return fs.readFileSync(STATE, 'utf8').trim(); } catch { return 'idle'; } })();
  const p = spawn('ssh', ['pzedlo.hopto.org', '~/node22/bin/node ~/omegga-server/bridge/tools/job.mjs'], { detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
  p.stdin.end(JSON.stringify(job(state, readJSON(USAGE))));
  p.unref();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const state = process.argv[2];
  if (!COLOURS[state]) { console.error('status.mjs busy|idle'); process.exit(1); }
  let last = '';
  try { last = fs.readFileSync(STATE, 'utf8').trim(); } catch {}
  if (last !== state) {
    fs.writeFileSync(STATE, state);
    push(state);
  }
}
