#!/usr/bin/env node
// Brickadia MCP server (stdio, no deps): bridge jobs over ssh + client window capture.
// Register: .mcp.json -> { "mcpServers": { "brickadia": { "command": "node", "args": ["tools/mcp/brickadia-mcp.mjs"] } } }
import { spawn } from "child_process";
import fs from "fs"; import os from "os"; import path from "path"; import { fileURLToPath } from "url";

const HOST = process.env.BR_HOST || "pzedlo.hopto.org";
const NODE = "~/node22/bin/node";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(cmd, args, input, ms = 90000) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let out = "", err = "";
    const t = setTimeout(() => { p.kill(); rej(new Error(`timeout after ${ms} ms`)); }, ms);
    p.stdout.on("data", d => out += d); p.stderr.on("data", d => err += d);
    p.on("error", e => { clearTimeout(t); rej(e); });
    p.on("close", code => { clearTimeout(t); res({ code, out, err }); });
    if (input != null) p.stdin.end(input); else p.stdin.end();
  });
}
const ssh = (line, input, ms) => run("ssh", ["-o", "ConnectTimeout=10", "-o", "BatchMode=yes", HOST, line], input, ms);

async function job(ops) {
  const r = await ssh(`${NODE} ~/omegga-server/bridge/tools/job.mjs`, JSON.stringify({ ops }));
  const txt = (r.out || r.err).trim();
  try { return JSON.parse(txt); } catch { return { ok: false, raw: txt, code: r.code }; }
}

const TOOLS = {
  players: {
    description: "List online players with positions (bridge 'players' op).",
    schema: { type: "object", properties: {} },
    run: async () => job([{ op: "players" }]),
  },
  cmd: {
    description: "Run a server console line (needs the br. prefix, e.g. 'br.World.Save'). captureMs > 0 returns the console lines printed in that window.",
    schema: { type: "object", properties: { line: { type: "string" }, captureMs: { type: "number" } }, required: ["line"] },
    run: async a => job([{ op: "cmd", line: a.line, captureMs: a.captureMs ?? 1500 }]),
  },
  job: {
    description: "Send raw bridge ops (players, cmd {line,captureMs}, bricks {at,bricks,owner,captureMs,externalAssets}, say {msg}, sleep {ms}, clear {owner}, emit {event,args}). 60 s limit. Map uploads = ONE bricks op. No chat announcements of changes.",
    schema: { type: "object", properties: { ops: { type: "array", items: { type: "object" } } }, required: ["ops"] },
    run: async a => job(a.ops),
  },
  log: {
    description: "Tail today's game log on the server (data/logs/omegga-<date>.log), optional grep filter (extended regex).",
    schema: { type: "object", properties: { lines: { type: "number" }, filter: { type: "string" } } },
    run: async a => {
      const n = Math.min(Math.max(a.lines | 0 || 60, 1), 2000);
      const f = a.filter ? ` | grep -E -- ${JSON.stringify(a.filter).replace(/\$/g, "\\$")}` : "";
      const r = await ssh(`cd ~/omegga-server/data/logs && L=$(ls -t omegga-*.log | head -1) && cat "$L"${f} | tail -n ${n}`, null, 30000);
      return r.out || r.err;
    },
  },
  screenshot: {
    description: "Capture the owner's Brickadia client window (works behind other windows). front=true focuses it first.",
    schema: { type: "object", properties: { front: { type: "boolean" } } },
    run: async a => {
      const out = path.join(os.tmpdir(), `brcap_${Date.now()}.png`);
      const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(ROOT, "eyes/gamecap.ps1"), out];
      if (a.front) args.push("-Front");
      const r = await run("powershell", args, null, 30000);
      if (!fs.existsSync(out)) throw new Error(`capture failed: ${(r.err || r.out).trim()}`);
      const data = fs.readFileSync(out).toString("base64"); fs.rmSync(out);
      return { image: data };
    },
  },
};

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }

async function handle(m) {
  if (m.method === "initialize")
    return { protocolVersion: m.params?.protocolVersion || "2024-11-05", capabilities: { tools: {} },
             serverInfo: { name: "brickadia", version: "1.0.0" } };
  if (m.method === "ping") return {};
  if (m.method === "tools/list")
    return { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.schema })) };
  if (m.method === "tools/call") {
    const t = TOOLS[m.params?.name];
    if (!t) throw Object.assign(new Error(`unknown tool ${m.params?.name}`), { code: -32602 });
    try {
      const r = await t.run(m.params.arguments || {});
      if (r && r.image) return { content: [{ type: "image", data: r.image, mimeType: "image/png" }] };
      return { content: [{ type: "text", text: typeof r === "string" ? r : JSON.stringify(r, null, 1) }] };
    } catch (e) { return { content: [{ type: "text", text: String(e.message || e) }], isError: true }; }
  }
  throw Object.assign(new Error(`method not found: ${m.method}`), { code: -32601 });
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", d => {
  buf += d; let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id === undefined) continue; // notifications
    handle(m).then(result => send({ jsonrpc: "2.0", id: m.id, result }),
                   e => send({ jsonrpc: "2.0", id: m.id, error: { code: e.code || -32603, message: String(e.message || e) } }));
  }
});
