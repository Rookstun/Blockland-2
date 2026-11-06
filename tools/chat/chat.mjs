// tools/chat/chat.mjs: Claude's in-game chat tool (owner 2026-11-06: "develop a tool specifically for communicating and
// listening to chat ... always has an accurate display of usage, with colors to identify when it's getting too close").
//   node tools/chat/chat.mjs usage 38 62          store the plan usage (5-hour %, weekly %) Claude just read with get_usage
//   node tools/chat/chat.mjs say "<text>"         broadcast "[claude 5h 38% wk 62%] text", each % coloured by how full it is
//   node tools/chat/chat.mjs listen               stream new chat lines that mention claude, compact: "name: text"
// The usage lives in tools/chat/usage.json (gitignored); a tag older than STALE_MIN minutes is shown with a "~".
// Colours: under 50% green, under 75% yellow, under 90% orange, 90%+ red.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOST = 'pzedlo.hopto.org', JOB = '~/node22/bin/node ~/omegga-server/bridge/tools/job.mjs';
const USAGE = join(dirname(fileURLToPath(import.meta.url)), 'usage.json'), STALE_MIN = 15;

export const colour = p => (p >= 90 ? 'ff4444' : p >= 75 ? 'ff9933' : p >= 50 ? 'eedd33' : '55dd55');
// game rich text: escape what the chat would read as markup
export const safe = s => String(s).replace(/\\/g, '\\\\').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '\\"');
export function tag({ h5, wk, at }, now = Date.now()) {
  const stale = !at || now - at > STALE_MIN * 60e3 ? '~' : '';
  return `[claude <color="${colour(h5)}">5h ${stale}${h5}%</> <color="${colour(wk)}">wk ${stale}${wk}%</>]`;
}
// one chat line from the server log -> "name: text", or null for lines Claude should not read (its own, the !ai bot's)
export function compact(line) {
  const m = /LogChat: (.*)$/.exec(line);
  if (!m || /^\[claude|^\[AI\]/.test(m[1])) return null;
  const p = /^\[SenderId: [^\]]+\] (.*)$/.exec(m[1]);
  return (p ? p[1] : m[1]).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const readUsage = () => { try { return JSON.parse(fs.readFileSync(USAGE, 'utf8')); } catch { return { h5: '?', wk: '?', at: 0 }; } };

function ssh(cmd, input) {
  return new Promise((res, rej) => {
    const p = spawn('ssh', [HOST, cmd], { stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', d => (out += d));
    p.on('close', code => (code ? rej(new Error(`ssh exit ${code}`)) : res(out)));
    if (input != null) p.stdin.end(input);
  });
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'usage') {
  const [h5, wk] = rest.slice(0, 2).map(Number), reset = rest[2] ?? null; // reset: ISO time the 5-hour window resets
  if (!(h5 >= 0 && wk >= 0)) throw new Error('usage: chat.mjs usage <5h%> <weekly%> [5h-reset-ISO]');
  fs.writeFileSync(USAGE, JSON.stringify({ h5, wk, reset, at: Date.now() }));
  const { push } = await import('./status.mjs');
  push(); // refresh the HUD beacons with the new numbers
} else if (cmd === 'say') {
  const text = rest.join(' ').trim();
  if (!text) throw new Error('usage: chat.mjs say "<text>"');
  const msg = `[claude] ${safe(text)}`; // usage moved to the status HUD (owner 2026-11-06); [claude] keeps the watcher from reading its own lines
  const out = await ssh(JOB, JSON.stringify({ ops: [{ op: 'say', msg }] }));
  if (!/"ok":true/.test(out)) throw new Error(`say failed: ${out.slice(0, 200)}`);
} else if (cmd === 'listen') {
  const p = spawn('ssh', [HOST, 'stdbuf -oL bash ~/claude_listen.sh'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buf = '';
  p.stdout.on('data', d => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) { const c = compact(l); if (c) process.stdout.write(c + '\n'); }
  });
  p.on('close', code => process.exit(code ?? 0));
} else if (cmd !== 'test') {
  console.error('chat.mjs usage <5h%> <wk%> | say "<text>" | listen');
  process.exit(1);
}
