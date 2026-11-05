#!/usr/bin/env node
// Public Brickadia MCP server (Streamable HTTP, stateless, no deps). Runs ON the game server next to the bridge plugin.
// Anyone can point their Claude at  http://HOST:PORT/mcp?key=<secret>&name=<display name>
// The key picks the brick owner, so a caller can only remove bricks placed with the same key.
// Run: PORT=8090 node public-mcp.mjs     (records live in ~/brickmcp/builds)
import http from "http"; import fs from "fs"; import path from "path"; import crypto from "crypto";

const PORT = +process.env.PORT || 8090;
const GUIDE = fs.readFileSync(new URL("GIVE_THIS_TO_YOUR_CLAUDE.md", import.meta.url), "utf8"); // served at GET /
const HOME = process.env.HOME || "/home/max";
const BRIDGE = path.join(HOME, "omegga-server/bridge");
const DATA = path.join(HOME, "brickmcp/builds");
fs.mkdirSync(DATA, { recursive: true });

const MAX_PER_CALL = 5000, MAX_PER_OWNER = 50000, MIN_GAP_MS = 3000, BOUND = 100000, MAX_HALF = 500;
const MATERIALS = ["BMC_Plastic", "BMC_Glass", "BMC_Glow", "BMC_Metallic", "BMC_Hologram"];

// ---- bridge job (same protocol as bridge/tools/job.mjs)
let chain = Promise.resolve(); // one job at a time from this server
function job(ops) {
  const p = chain.then(async () => {
    const id = `pubmcp_${Date.now()}_${Math.floor(Math.random() * 1e6)}.json`;
    fs.writeFileSync(path.join(BRIDGE, "inbox", id + ".tmp"), JSON.stringify({ ops }));
    fs.renameSync(path.join(BRIDGE, "inbox", id + ".tmp"), path.join(BRIDGE, "inbox", id));
    const out = path.join(BRIDGE, "outbox", id), t0 = Date.now();
    while (!fs.existsSync(out)) {
      if (Date.now() - t0 > 60000) throw new Error("game server did not answer (bridge timeout)");
      await new Promise(r => setTimeout(r, 200));
    }
    const res = JSON.parse(fs.readFileSync(out, "utf8")); fs.rmSync(out);
    if (!res.ok) throw new Error(res.error);
    return res.results;
  });
  chain = p.catch(() => {});
  return p;
}

// ---- identity: owner uuid from sha256(key), or from the IP when no key is given
function identity(req, url) {
  const key = url.searchParams.get("key") || (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
              "ip:" + (req.headers["x-forwarded-for"] || req.socket.remoteAddress);
  const h = crypto.createHash("sha256").update("brickmcp:" + key).digest("hex");
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const name = (url.searchParams.get("name") || h.slice(0, 6)).replace(/[^\w \-]/g, "").slice(0, 24) || h.slice(0, 6);
  return { id, name: `AI ${name}` };
}
const recFile = o => path.join(DATA, o.id + ".json");
const loadRec = o => { try { return JSON.parse(fs.readFileSync(recFile(o), "utf8")); } catch { return []; } };
const saveRec = (o, bricks) => fs.writeFileSync(recFile(o), JSON.stringify(bricks));
const last = new Map();
function throttle(k) {
  const now = Date.now();
  if (now - (last.get(k) || 0) < MIN_GAP_MS) throw new Error(`slow down: one build call per ${MIN_GAP_MS / 1000} s`);
  last.set(k, now);
}

// ---- validation (trust boundary): only plain procedural bricks, no components/wires/chips
const int = v => Number.isInteger(v);
function clean(b, i) {
  const bad = m => { throw new Error(`brick ${i}: ${m}`); };
  if (!b || typeof b !== "object") bad("not an object");
  const asset = b.asset ?? "PB_DefaultBrick";
  if (!/^PB_Default[A-Za-z]*$/.test(asset)) bad("asset must be a PB_Default* procedural brick");
  const micro = asset.startsWith("PB_DefaultMicro");
  const { position: p, size: s, color: c } = b;
  if (!Array.isArray(p) || p.length !== 3 || !p.every(int)) bad("position = 3 integers");
  if (Math.abs(p[0]) > BOUND || Math.abs(p[1]) > BOUND || p[2] < -BOUND || p[2] > BOUND) bad(`position outside +-${BOUND}`);
  if (!Array.isArray(s) || s.length !== 3 || !s.every(v => int(v) && v >= 1 && v <= MAX_HALF)) bad(`size = 3 half extents 1..${MAX_HALF}`);
  if (!micro && (s[0] % 5 || s[1] % 5 || s[2] % 2)) bad("non-micro size: x,y multiples of 5, z multiple of 2");
  if (c != null && !(Array.isArray(c) && c.length === 3 && c.every(v => int(v) && v >= 0 && v <= 255))) bad("color = [r,g,b] 0-255");
  const material = b.material ?? "BMC_Plastic";
  if (!MATERIALS.includes(material)) bad(`material one of ${MATERIALS.join(", ")}`);
  const direction = b.direction ?? 4, rotation = b.rotation ?? 0;
  if (!(int(direction) && direction >= 0 && direction <= 5)) bad("direction 0-5 (4 = upright)");
  if (!(int(rotation) && rotation >= 0 && rotation <= 3)) bad("rotation 0-3");
  return { position: p, size: s, color: c ?? [200, 200, 200], asset, material, direction, rotation };
}
const inBox = (b, box) => b.position.every((v, k) => v >= box.min[k] && v <= box.max[k]);

const BRICK_SCHEMA = {
  type: "object",
  properties: {
    position: { type: "array", items: { type: "integer" }, description: "world centre [x,y,z] in units (1 stud = 10, brick = 12 tall, plate = 4, z up)" },
    size: { type: "array", items: { type: "integer" }, description: "HALF extents [x,y,z]; a 1x1 brick is [5,5,6], 2x4 plate [10,20,2]" },
    color: { type: "array", items: { type: "integer" }, description: "[r,g,b] 0-255" },
    asset: { type: "string", description: "PB_DefaultBrick (default), PB_DefaultTile, PB_DefaultSmoothTile, PB_DefaultWedge, PB_DefaultSideWedge, PB_DefaultRamp, PB_DefaultMicroBrick, PB_DefaultMicroWedge, ..." },
    material: { type: "string", enum: MATERIALS },
    direction: { type: "integer", description: "0-5: X+,X-,Y+,Y-,Z+,Z-; 4 (upright) default" },
    rotation: { type: "integer", description: "0-3 quarter turns about the direction axis" },
  },
  required: ["position", "size"],
};
const BOX = { type: "object", properties: { min: { type: "array", items: { type: "integer" } }, max: { type: "array", items: { type: "integer" } } }, required: ["min", "max"] };

const TOOLS = {
  players: {
    description: "List online players and their positions [x,y,z] (feet-ish; a player is ~60 units tall). Use a position to build next to someone.",
    schema: { type: "object", properties: {} },
    run: async () => (await job([{ op: "players" }]))[0].map(p => ({ name: p.name, pos: p.pos })),
  },
  place_bricks: {
    description: `Place up to ${MAX_PER_CALL} bricks in ONE call (send a whole build at once; ${MAX_PER_OWNER} max per key). ` +
      "World units: 1 stud = 10, brick height 12, plate 4, sizes are HALF extents, positions are integer centres, z is up. " +
      "Bricks overlapping existing bricks are silently rejected by the game, so build in open space (raise z or move). " +
      "Ground is roughly z = 0; a brick resting on it has z = its half height.",
    schema: { type: "object", properties: { bricks: { type: "array", items: BRICK_SCHEMA } }, required: ["bricks"] },
    run: async (a, me) => {
      if (!Array.isArray(a.bricks) || !a.bricks.length) throw new Error("bricks: non-empty array");
      if (a.bricks.length > MAX_PER_CALL) throw new Error(`max ${MAX_PER_CALL} bricks per call`);
      const bricks = a.bricks.map(clean), rec = loadRec(me);
      if (rec.length + bricks.length > MAX_PER_OWNER) throw new Error(`you have ${rec.length} bricks; cap is ${MAX_PER_OWNER}. remove some first`);
      throttle(me.id);
      const [r] = await job([{ op: "bricks", bricks, owner: me, at: [0, 0, 0], captureMs: 1500 }]);
      // shortcut: bricks the game rejected (overlap) still count in the record; re-read the world if that matters.
      saveRec(me, rec.concat(bricks));
      const rejected = (r.log || []).filter(l => /overlap|rror|Missing/i.test(l)).length;
      return { placed: bricks.length, owner: me.name, total: rec.length + bricks.length, game_warnings: rejected ? (r.log || []).slice(0, 5) : [] };
    },
  },
  remove_bricks: {
    description: "Remove YOUR bricks (only ones placed with your key). Give box {min,max} to remove those whose centre is inside, or all=true for everything you built.",
    schema: { type: "object", properties: { box: BOX, all: { type: "boolean" } } },
    run: async (a, me) => {
      if (!a.all && !a.box) throw new Error("give box or all=true");
      const rec = loadRec(me);
      const keep = a.all ? [] : rec.filter(b => !inBox(b, a.box));
      if (keep.length === rec.length) return { removed: 0, left: rec.length };
      throttle(me.id);
      // the game can't delete single bricks by owner: wipe this owner, then reload what stays, in one job
      const ops = [{ op: "clear", owner: me }, { op: "sleep", ms: 500 }];
      if (keep.length) ops.push({ op: "bricks", bricks: keep, owner: me, at: [0, 0, 0] });
      await job(ops);
      saveRec(me, keep);
      return { removed: rec.length - keep.length, left: keep.length };
    },
  },
  my_bricks: {
    description: "What you have built: count, bounding box, and the bricks themselves (optionally only inside box; at most 500 listed).",
    schema: { type: "object", properties: { box: BOX } },
    run: async (a, me) => {
      const rec = loadRec(me).filter(b => !a.box || inBox(b, a.box));
      const lo = [0, 1, 2].map(k => Math.min(...rec.map(b => b.position[k])));
      const hi = [0, 1, 2].map(k => Math.max(...rec.map(b => b.position[k])));
      return { owner: me.name, count: rec.length, bbox: rec.length ? { min: lo, max: hi } : null, bricks: rec.slice(0, 500) };
    },
  },
};

const INSTRUCTIONS = "Brickadia freebuild server. Build with place_bricks (whole build in one call), undo with remove_bricks. " +
  "Units: stud 10, brick 12 tall, plate 4; sizes are half extents; z up. Bricks that overlap anything are rejected. " +
  "Call players to find where people are and build near them, not on top of them. Be nice: no slurs or obscene builds.";

async function rpc(m, me) {
  if (m.method === "initialize")
    return { protocolVersion: m.params?.protocolVersion || "2025-03-26", capabilities: { tools: {} },
             serverInfo: { name: "brickadia-public", version: "1.0.0" }, instructions: INSTRUCTIONS };
  if (m.method === "ping") return {};
  if (m.method === "tools/list")
    return { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.schema })) };
  if (m.method === "tools/call") {
    const t = TOOLS[m.params?.name];
    if (!t) throw Object.assign(new Error(`unknown tool ${m.params?.name}`), { code: -32602 });
    try {
      const r = await t.run(m.params.arguments || {}, me);
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    } catch (e) { return { content: [{ type: "text", text: String(e.message || e) }], isError: true }; }
  }
  throw Object.assign(new Error(`method not found: ${m.method}`), { code: -32601 });
}
const reply = (m, p) => p.then(result => ({ jsonrpc: "2.0", id: m.id, result }),
  e => ({ jsonrpc: "2.0", id: m.id, error: { code: e.code || -32603, message: String(e.message || e) } }));

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/" && req.method === "GET") { res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" }).end(GUIDE); return; }
  if (url.pathname !== "/mcp") { res.writeHead(404).end("MCP endpoint is /mcp\n"); return; }
  if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
  let body = "", size = 0;
  req.on("data", d => { size += d.length; if (size > 4e6) req.destroy(); else body += d; });
  req.on("end", async () => {
    let msg;
    try { msg = JSON.parse(body); } catch { res.writeHead(400).end("bad json"); return; }
    const me = identity(req, url);
    const list = Array.isArray(msg) ? msg : [msg];
    const out = (await Promise.all(list.filter(m => m && m.id !== undefined && m.method).map(m => reply(m, rpc(m, me)))));
    if (!out.length) { res.writeHead(202).end(); return; } // notifications only
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(Array.isArray(msg) ? out : out[0]));
  });
}).listen(PORT, () => console.log(`brickadia public MCP on :${PORT}/mcp`));
