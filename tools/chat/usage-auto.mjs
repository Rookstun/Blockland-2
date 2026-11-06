// tools/chat/usage-auto.mjs: fetch the plan usage live from the Claude Code CLI login and push it to the status HUD
// (owner 2026-11-06: "the usage is not accurately updated fix it"). Run by the Stop hook (.claude/settings.json).
// Reads ~/.claude/.credentials.json (the CLI's own login; nothing else), calls the usage endpoint, writes usage.json
// and re-places the HUD beacons only when a number changed. OFF until tools/chat/usage-auto.on exists: that file is
// created only after the CLI account is checked to be the same one as the desktop app (the reset times must match),
// so a different account's numbers never reach the screen. Quiet and quick: any failure just leaves the old numbers.
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ON = join(here, 'usage-auto.on'), USAGE = join(here, 'usage.json');
if (!fs.existsSync(ON)) process.exit(0);
try {
  const tok = JSON.parse(fs.readFileSync(join(os.homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth.accessToken;
  const r = await fetch('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: `Bearer ${tok}`, 'anthropic-beta': 'oauth-2025-04-20' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) process.exit(0);
  const j = await r.json(), h5 = Math.round(j.five_hour?.utilization ?? NaN), wk = Math.round(j.seven_day?.utilization ?? NaN);
  if (!(h5 >= 0 && wk >= 0)) process.exit(0);
  let old = {};
  try { old = JSON.parse(fs.readFileSync(USAGE, 'utf8')); } catch {}
  fs.writeFileSync(USAGE, JSON.stringify({ h5, wk, at: Date.now() }));
  if (old.h5 !== h5 || old.wk !== wk) (await import('./status.mjs')).push();
} catch {}
