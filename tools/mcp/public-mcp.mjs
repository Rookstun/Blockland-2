#!/usr/bin/env node
// Public Brickadia MCP server (Streamable HTTP, stateless, no deps). Runs ON the game server next to the bridge plugin.
// Anyone can point their Claude at  http://HOST:PORT/mcp?key=<secret>&name=<display name>
// The key picks the brick owner, so a caller can only change bricks placed with the same key. Reads see everything.
// Run: PORT=8090 node public-mcp.mjs     (records live in ~/brickmcp/builds, needs ./brs4.mjs = tools/brs4/dist.mjs)
import http from "http"; import fs from "fs"; import path from "path"; import crypto from "crypto";

const PORT = +process.env.PORT || 8090;
const GUIDE = fs.readFileSync(new URL("GIVE_THIS_TO_YOUR_CLAUDE.md", import.meta.url), "utf8"); // served at GET /
const HOME = process.env.HOME || "/home/max";
const BRIDGE = path.join(HOME, "omegga-server/bridge");
const PREFABS = path.join(HOME, "omegga-server/data/Saved/Prefabs");
const DATA = path.join(HOME, "brickmcp/builds");
fs.mkdirSync(DATA, { recursive: true });

const MAX_PER_CALL = 5000, MAX_PER_OWNER = 50000, MIN_GAP_MS = 3000, BOUND = 100000, MAX_HALF = 500;
const MAX_COMPONENTS = 2000, MAX_DATA = 20000;
const READ_HALF = 1250, READ_HALF_Z = 5000, READ_GAP_MS = 5000, READ_MAX = 5000; // reads: 250x250 studs, 1 per 5 s
const MATERIALS = ["BMC_Plastic", "BMC_Glass", "BMC_TranslucentPlastic", "BMC_Glow", "BMC_Metallic", "BMC_Hologram"];
const brs = await import("./brs4.mjs"); // copy of tools/brs4/dist.mjs (brs-js 4, post-EA3.2 .brz)

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
// record per key: { next: id counter, bricks: [{ id, ...brick }], wires: [{ from: {id, component, port}, to: {...} }] }
const recFile = o => path.join(DATA, o.id + ".json");
function loadRec(o) {
  let r; try { r = JSON.parse(fs.readFileSync(recFile(o), "utf8")); } catch { r = null; }
  if (Array.isArray(r)) r = { next: r.length, bricks: r.map((b, id) => ({ id, ...b })), wires: [] }; // pre-wires records
  return r || { next: 0, bricks: [], wires: [] };
}
const saveRec = (o, r) => fs.writeFileSync(recFile(o), JSON.stringify(r));
const last = new Map();
function throttle(k, ms = MIN_GAP_MS, what = "build call") {
  const now = Date.now();
  if (now - (last.get(k) || 0) < ms) throw new Error(`slow down: one ${what} per ${ms / 1000} s`);
  last.set(k, now);
}

// ---- components (trust boundary). Denied: anything that reaches players, other people's bricks or the whole server.
const COMPS = brs.brdb.COMPONENTS;
const DENY = /^(Exec_Character_|Exec_Gamemode_|Event_Gamemode_|Event_ChatCommand|Exec_PlayerState_(ForceRespawn|SetCanRespawn|Show)|Exec_SetEnvironmentProperty|Exec_SpawnExplosion|ExplosionSpawner|Exec_PlayGlobalAudio|Exec_PrefabSpawner|Exec_Entity_(Teleport|RelativeTeleport|SetLocation|DestroySpawned)|Exec_(Add|Remove)Component|Exec_Set(Brick|Component)Property|Exec_FindPlayer|Exec_Zone_GetPlayers|Exec_PrintToConsole|Microchip|Internal_)/;
const short = t => String(t).replace(/^(BrickComponentType_|Component_)/, "");
const compInfo = t => COMPS[short(t)];
function cleanComponents(list, tag) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new Error(`${tag}: components = [{type, data}]`);
  return list.map(c => {
    if (!c || !compInfo(c.type)) throw new Error(`${tag}: unknown component type ${c?.type} (see the components tool)`);
    if (DENY.test(short(c.type))) throw new Error(`${tag}: component ${short(c.type)} is not allowed on this server`);
    if (JSON.stringify(c.data ?? {}).length > MAX_DATA) throw new Error(`${tag}: component data too big`);
    return { type: short(c.type), data: c.data ?? {} };
  });
}

// ---- brick validation (trust boundary)
const int = v => Number.isInteger(v);
function clean(b, i) {
  const bad = m => { throw new Error(`brick ${i}: ${m}`); };
  if (!b || typeof b !== "object") bad("not an object");
  const asset = b.asset ?? "PB_DefaultBrick";
  if (!/^P?B_[A-Za-z0-9_]+$/.test(asset)) bad("asset must be a brick asset name (PB_... procedural or B_... basic)");
  const proc = asset.startsWith("PB_");
  const { position: p, color: c } = b, s = b.size ?? [0, 0, 0];
  if (!Array.isArray(p) || p.length !== 3 || !p.every(int)) bad("position = 3 integers");
  if (!p.every(v => Math.abs(v) <= BOUND)) bad(`position outside +-${BOUND}`);
  if (!Array.isArray(s) || s.length !== 3 || !s.every(v => int(v) && v >= (proc ? 1 : 0) && v <= MAX_HALF)) bad(`size = 3 half extents 1..${MAX_HALF} (basic B_ bricks: [0,0,0])`);
  if (/^PB_Default(?!Micro)/.test(asset) && (s[0] % 5 || s[1] % 5 || s[2] % 2)) bad("PB_Default (non-micro) size: x,y multiples of 5, z multiple of 2");
  if (c != null && !(Array.isArray(c) && c.length === 3 && c.every(v => int(v) && v >= 0 && v <= 255))) bad("color = [r,g,b] 0-255");
  const material = b.material ?? "BMC_Plastic";
  if (!MATERIALS.includes(material)) bad(`material one of ${MATERIALS.join(", ")}`);
  const direction = b.direction ?? 4, rotation = b.rotation ?? 0;
  if (!(int(direction) && direction >= 0 && direction <= 5)) bad("direction 0-5 (4 = upright)");
  if (!(int(rotation) && rotation >= 0 && rotation <= 3)) bad("rotation 0-3");
  const out = { position: p, size: s, color: c ?? [200, 200, 200], asset, material, direction, rotation };
  if (b.visible === false) out.visible = false;
  if (b.collide === false) out.collide = false;
  const comps = cleanComponents(b.components, `brick ${i}`);
  if (comps.length) out.components = comps;
  return out;
}
const inBox = (b, box) => b.position.every((v, k) => v >= box.min[k] && v <= box.max[k]);
const nComps = bricks => bricks.reduce((n, b) => n + (b.components?.length || 0), 0);

// wire end { brick, component?, port } -> { id, component, port }; `find` maps the caller's brick reference to a brick
function cleanEnd(e, find, toId, tag) {
  const b = e && find(e.brick);
  if (!b) throw new Error(`${tag}: no brick ${e?.brick}`);
  const comps = b.components || [];
  const c = e.component != null ? comps.find(x => x.type === short(e.component)) : comps.length === 1 ? comps[0] : null;
  if (!c) throw new Error(`${tag}: brick ${e.brick} ${comps.length ? "has components " + comps.map(x => x.type).join(", ") + ": name one" : "has no components"}`);
  const ports = Object.values(compInfo(c.type).PORTS || {});
  if (!ports.includes(e.port)) throw new Error(`${tag}: ${c.type} ports are ${ports.join(", ")}`);
  return { id: toId(e.brick), component: c.type, port: e.port };
}
const cleanWires = (list, find, toId) => {
  if (list != null && !Array.isArray(list)) throw new Error("wires = [{from:{brick,component?,port}, to:{...}}]");
  return (list || []).map((w, k) => ({ from: cleanEnd(w?.from, find, toId, `wire ${k} from`), to: cleanEnd(w?.to, find, toId, `wire ${k} to`) }));
};
const sameWire = (a, b) => ["from", "to"].every(e => a[e].id === b[e].id && a[e].component === b[e].component && a[e].port === b[e].port);

// ---- write: build a .brz with brs4 and Prefab.Load it, optionally wiping this owner first (one job)
const LOGF = l => /Prefab|[Bb]rick|rror|arning/.test(l) && !/DetailsInspection|LogNet|Bundles: Auto-closing|WRITE|Wire Graph/.test(l);
async function load(bricks, wires, me, wipe) {
  const ops = wipe ? [{ op: "cmd", line: `br.Bricks.Clear ${me.id} 1` }, { op: "sleep", ms: 500 }] : [];
  if (bricks.length) {
    const assets = [], at = new Map(bricks.map((b, i) => [b.id, i]));
    const idx = v => { const i = assets.indexOf(v); return i >= 0 ? i : assets.push(v) - 1; };
    const end = e => ({ brick_index: at.get(e.id), component_type: compInfo(e.component).NAME, port: e.port });
    const save = {
      brick_assets: assets, materials: MATERIALS, brick_owners: [{ ...me, bricks: bricks.length }],
      bricks: bricks.map(b => ({
        position: b.position, size: b.size, color: b.color, direction: b.direction, rotation: b.rotation,
        asset_name_index: idx(b.asset), material_index: MATERIALS.indexOf(b.material), owner_index: 1,
        visibility: b.visible !== false,
        ...(b.collide === false ? { collision: { player: false, weapon: false, interaction: false, tool: true, physics: false } } : {}),
        components: (b.components || []).map(c => ({ type: compInfo(c.type).NAME, data: c.data })),
      })),
      wires: wires.map(w => ({ source: end(w.from), target: end(w.to) })),
    };
    let bytes;
    try { bytes = brs.writeBrzLegacy(save); } catch (e) { throw new Error(`could not encode the build (bad component data?): ${e.message}`); }
    const ref = `pubmcp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    fs.writeFileSync(path.join(PREFABS, ref + ".brz"), bytes);
    setTimeout(() => fs.rmSync(path.join(PREFABS, ref + ".brz"), { force: true }), 15000);
    ops.push({ op: "cmd", line: `br.Prefab.Load "${ref}" 0 0 0 0 16`, captureMs: 1500 });
  }
  const res = await job(ops);
  return bricks.length ? res.at(-1).filter(LOGF).slice(0, 8) : [];
}

// ---- read a .brz main grid: bricks (index = position in the list), components, wires
function readBrz(bytes) {
  const r = brs.WorldReader.from(bytes);
  const names = r.brickAssets(), mats = r.materials(), grids = r.gridIds();
  let owners = []; try { owners = r.owners().UserNames; } catch {}
  const chunks = grids.includes(1) ? r.brickChunkIndex(1) : [];
  const start = new Map(), key = c => `${c.x},${c.y},${c.z}`;
  let n = 0;
  for (const ci of chunks) { start.set(key(ci.index), n); n += ci.numBricks; } // bricks() yields chunk by chunk in this order
  const bricks = [];
  for (const b of grids.includes(1) ? r.bricks(1) : []) {
    const o = { i: bricks.length, asset: names[b.asset_name_index], position: b.position, size: b.size, color: b.color };
    if (mats[b.material_index] !== "BMC_Plastic") o.material = mats[b.material_index];
    if (b.direction !== 4 || b.rotation !== 0) { o.direction = b.direction; o.rotation = b.rotation; }
    if (b.visibility === false) o.visible = false;
    if (b.collision && !b.collision.player) o.collide = false;
    o.owner = owners[b.owner_index] ?? null; // owner_index indexes the raw owner table
    bricks.push(o);
  }
  const wires = [];
  for (const ci of chunks) {
    const base = start.get(key(ci.index));
    if (ci.numComponents) for (const c of r.componentChunk(1, ci.index).components)
      if (bricks[base + c.brickIndex]) (bricks[base + c.brickIndex].components ||= []).push({ type: short(c.typeName), data: c.data });
    if (!ci.numWires) continue;
    const w = r.wireChunk(1, ci.index);
    const end = (e, b0) => ({ brick: b0 + e.brickIndex, component: short(e.componentType), port: e.port });
    for (const x of w.local) wires.push({ from: end(x.source, base), to: end(x.target, base) });
    for (const x of w.remote) if (x.source.gridId === 1 && start.has(key(x.source.chunk)))
      wires.push({ from: end(x.source, start.get(key(x.source.chunk))), to: end(x.target, base) });
  }
  return { bricks, wires, other_grids: grids.filter(g => g !== 1).length };
}

// add bricks (+ wires among them, `brick` = index in this list) to the caller's record, load only the new ones
async function place(input, inWires, me) {
  if (!Array.isArray(input) || !input.length) throw new Error("bricks: non-empty array");
  if (input.length > MAX_PER_CALL) throw new Error(`max ${MAX_PER_CALL} bricks per call`);
  const rec = loadRec(me), bricks = input.map(clean);
  if (rec.bricks.length + bricks.length > MAX_PER_OWNER) throw new Error(`you have ${rec.bricks.length} bricks; cap is ${MAX_PER_OWNER}. remove some first`);
  if (nComps(rec.bricks) + nComps(bricks) > MAX_COMPONENTS) throw new Error(`cap is ${MAX_COMPONENTS} components per key`);
  const wires = cleanWires(inWires, i => bricks[i], i => rec.next + i);
  throttle(me.id);
  bricks.forEach((b, i) => b.id = rec.next + i);
  const warnings = await load(bricks, wires, me, false);
  // shortcut: bricks the game rejected (overlap) still count in the record; read_region shows what really landed.
  rec.bricks.push(...bricks); rec.wires.push(...wires); rec.next += bricks.length; saveRec(me, rec);
  return { placed: bricks.length, ids: [bricks[0].id, bricks.at(-1).id], wires: wires.length, owner: me.name, total: rec.bricks.length, game_warnings: warnings };
}
// rewrite the caller's whole build after an edit: drop dangling wires, wipe their owner, reload everything in one job
async function reload(rec, me) {
  const byId = new Map(rec.bricks.map(b => [b.id, b]));
  const ok = e => byId.get(e.id)?.components?.some(c => c.type === e.component);
  const before = rec.wires.length;
  rec.wires = rec.wires.filter(w => ok(w.from) && ok(w.to));
  throttle(me.id);
  const warnings = await load(rec.bricks, rec.wires, me, true);
  saveRec(me, rec);
  return { bricks: rec.bricks.length, wires: rec.wires.length, wires_dropped: before - rec.wires.length, game_warnings: warnings };
}

const BRICK_SCHEMA = {
  type: "object",
  properties: {
    position: { type: "array", items: { type: "integer" }, description: "world centre [x,y,z] in units (1 stud = 10, brick = 12 tall, plate = 4, z up)" },
    size: { type: "array", items: { type: "integer" }, description: "HALF extents [x,y,z]; 1x1 brick [5,5,6], 2x4 plate [10,20,2]; basic B_ bricks (most gates) [0,0,0]" },
    color: { type: "array", items: { type: "integer" }, description: "[r,g,b] 0-255" },
    asset: { type: "string", description: "PB_DefaultBrick (default), PB_DefaultTile, PB_DefaultSmoothTile, PB_DefaultWedge, PB_DefaultSideWedge, PB_DefaultRamp, PB_DefaultMicroBrick, PB_DefaultMicroWedge, or a gate brick such as B_1x1_Gate_Expr_LogicalAND (components tool lists them)" },
    material: { type: "string", enum: MATERIALS },
    direction: { type: "integer", description: "0-5: X+,X-,Y+,Y-,Z+,Z-; 4 (upright) default" },
    rotation: { type: "integer", description: "0-3 quarter turns about the direction axis" },
    visible: { type: "boolean" }, collide: { type: "boolean" },
    components: { type: "array", items: { type: "object", properties: { type: { type: "string" }, data: { type: "object" } }, required: ["type"] },
                  description: "e.g. [{type:'Expr_LogicalAND', data:{}}]. Copy data shapes from read_region of existing gates." },
  },
  required: ["position"],
};
const END = { type: "object", properties: { brick: { type: "integer" }, component: { type: "string", description: "only needed when the brick has several components" }, port: { type: "string" } }, required: ["brick", "port"] };
const WIRE = { type: "object", properties: { from: END, to: END }, required: ["from", "to"] };
const BOX = { type: "object", properties: { min: { type: "array", items: { type: "integer" } }, max: { type: "array", items: { type: "integer" } } }, required: ["min", "max"] };
const readCache = new Map(); // key -> { box, t, data }: paging through a read doesn't re-save the region

const TOOLS = {
  players: {
    description: "List online players and their positions [x,y,z] (a player is ~60 units tall, z is ~25 above the floor they stand on).",
    schema: { type: "object", properties: {} },
    run: async () => (await job([{ op: "players" }]))[0].map(p => ({ name: p.name, pos: p.pos })),
  },
  read_region: {
    description: `Read every brick in a world box: asset, position, size, color, material, orientation, owner, components with their data, and wires (brick = index in this read). ` +
      `Box up to ${READ_HALF * 2}x${READ_HALF * 2} units (250x250 studs) across, ${READ_HALF_Z * 2} tall. One new read per ${READ_GAP_MS / 1000} s; ` +
      `paging (offset) through the same box within 2 minutes is free. Only bricks ENTIRELY inside the box are returned (big terrain bricks need a big box). Main grid only: bricks inside microchips/vehicles are counted in other_grids, not listed.`,
    schema: { type: "object", properties: { box: BOX, offset: { type: "integer" }, limit: { type: "integer", description: `max ${READ_MAX}, default 1000` } }, required: ["box"] },
    run: async (a, me) => {
      const { min, max } = a.box || {};
      if (![min, max].every(v => Array.isArray(v) && v.length === 3 && v.every(int))) throw new Error("box = {min:[x,y,z], max:[x,y,z]} integers");
      const c = [0, 1, 2].map(k => Math.round((min[k] + max[k]) / 2)), h = [0, 1, 2].map(k => Math.ceil((max[k] - min[k]) / 2));
      if (h.some(v => v < 1) || h[0] > READ_HALF || h[1] > READ_HALF || h[2] > READ_HALF_Z) throw new Error(`box too big: max ${READ_HALF * 2} x ${READ_HALF * 2} x ${READ_HALF_Z * 2} units`);
      const boxKey = JSON.stringify([min, max]);
      let hit = readCache.get(me.id);
      if (!hit || hit.box !== boxKey || Date.now() - hit.t > 120000) {
        throttle(me.id + ":read", READ_GAP_MS, "new read");
        const name = `pubmcp_read_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, file = path.join(PREFABS, name + ".brz");
        await job([{ op: "cmd", line: `br.Prefab.SaveRegion "${name}" ${c.join(" ")} ${h.join(" ")} 0` }]);
        let size = -1;
        for (let t0 = Date.now(); Date.now() - t0 < 20000; await new Promise(r => setTimeout(r, 300))) {
          const s = fs.existsSync(file) ? fs.statSync(file).size : -1;
          if (s > 0 && s === size) break; // written and stable
          size = s;
        }
        if (!fs.existsSync(file)) return { total: 0, bricks: [], wires: [], note: "nothing saved: the box is empty (or the game was busy, try again)" };
        try { hit = { box: boxKey, t: Date.now(), data: readBrz(fs.readFileSync(file)) }; } finally { fs.rmSync(file, { force: true }); }
        readCache.set(me.id, hit);
      }
      const off = Math.max(0, a.offset | 0), lim = Math.min(Math.max(a.limit | 0 || 1000, 1), READ_MAX), d = hit.data;
      const page = d.bricks.slice(off, off + lim);
      const inPage = i => i >= off && i < off + lim;
      return { total: d.bricks.length, offset: off, returned: page.length, other_grids: d.other_grids,
               bricks: page, wires: d.wires.filter(w => inPage(w.from.brick) || inPage(w.to.brick)) };
    },
  },
  components: {
    description: "List component types usable on this server (logic gates, displays, lights, ...): host brick asset and wire port names. filter = substring.",
    schema: { type: "object", properties: { filter: { type: "string" } } },
    run: async a => Object.entries(COMPS)
      .filter(([k]) => !DENY.test(k) && (!a.filter || k.toLowerCase().includes(String(a.filter).toLowerCase())))
      .map(([k, v]) => ({ type: k, brick: v.BRICK, ports: Object.values(v.PORTS || {}) })),
  },
  place_bricks: {
    description: `Place up to ${MAX_PER_CALL} bricks in ONE call (send a whole build at once; ${MAX_PER_OWNER} bricks and ${MAX_COMPONENTS} components max per key). ` +
      "Bricks may carry components (gates etc.); wires connect them: {from:{brick, component?, port}, to:{...}} where brick = index in THIS call's list. " +
      "Returns the ids given to the bricks (use them with update_bricks, wires, remove_bricks). " +
      "Units: 1 stud = 10, brick height 12, plate 4, sizes are HALF extents, positions integer centres, z up. Bricks overlapping anything are rejected by the game.",
    schema: { type: "object", properties: { bricks: { type: "array", items: BRICK_SCHEMA }, wires: { type: "array", items: WIRE } }, required: ["bricks"] },
    run: (a, me) => place(a.bricks, a.wires, me),
  },
  place_brz: {
    description: "Place a Brickadia .brz prefab/save (current game format), sent as base64 in brz_base64, with its components and wires (main grid only; denied components are dropped). " +
      "The build is moved so the centre of its bottom face lands at `at` [x,y,z]. Same limits as place_bricks.",
    schema: { type: "object", properties: { brz_base64: { type: "string" }, at: { type: "array", items: { type: "integer" } } }, required: ["brz_base64", "at"] },
    run: async (a, me) => {
      if (!(Array.isArray(a.at) && a.at.length === 3 && a.at.every(int))) throw new Error("at = 3 integers");
      let d;
      try { d = readBrz(Buffer.from(String(a.brz_base64), "base64")); } catch (e) { throw new Error(`not a readable .brz (current format only): ${e.message}`); }
      const keep = d.bricks.filter(b => /^P?B_/.test(b.asset || "") && MATERIALS.includes(b.material ?? "BMC_Plastic"));
      if (!keep.length) throw new Error(`no usable bricks in that file (${d.bricks.length} read)`);
      for (const b of keep) b.components = b.components?.filter(c => compInfo(c.type) && !DENY.test(c.type));
      const lo = k => Math.min(...keep.map(b => b.position[k] - b.size[k])), hi = k => Math.max(...keep.map(b => b.position[k] + b.size[k]));
      const sh = [Math.round(a.at[0] - (lo(0) + hi(0)) / 2), Math.round(a.at[1] - (lo(1) + hi(1)) / 2), a.at[2] - lo(2)];
      const newIdx = new Map(keep.map((b, j) => [b.i, j]));
      const has = e => keep[newIdx.get(e.brick)]?.components?.some(c => c.type === e.component);
      const wires = d.wires.filter(w => has(w.from) && has(w.to))
        .map(w => ({ from: { ...w.from, brick: newIdx.get(w.from.brick) }, to: { ...w.to, brick: newIdx.get(w.to.brick) } }));
      const res = await place(keep.map(({ i, owner, ...b }) => ({ ...b, position: b.position.map((v, k) => v + sh[k]) })), wires, me);
      return { ...res, dropped_bricks: d.bricks.length - keep.length, dropped_wires: d.wires.length - wires.length };
    },
  },
  update_bricks: {
    description: "Change YOUR bricks by id: any of position, size, color, asset, material, direction, rotation, visible, collide, components (replaces the list). " +
      "Wires whose component disappears are dropped. Reloads your whole build in one go.",
    schema: { type: "object", properties: { updates: { type: "array", items: { type: "object", properties: { id: { type: "integer" }, ...BRICK_SCHEMA.properties }, required: ["id"] } } }, required: ["updates"] },
    run: async (a, me) => {
      if (!Array.isArray(a.updates) || !a.updates.length) throw new Error("updates: non-empty array of {id, ...fields}");
      const rec = loadRec(me), byId = new Map(rec.bricks.map((b, k) => [b.id, k]));
      for (const [n, { id, ...u }] of a.updates.entries()) {
        const k = byId.get(id);
        if (k === undefined) throw new Error(`update ${n}: you have no brick with id ${id}`);
        const merged = { ...rec.bricks[k], ...u };
        if (u.visible === true) delete merged.visible;
        if (u.collide === true) delete merged.collide;
        rec.bricks[k] = { id, ...clean(merged, `update ${n}`) };
      }
      if (nComps(rec.bricks) > MAX_COMPONENTS) throw new Error(`cap is ${MAX_COMPONENTS} components per key`);
      return { updated: a.updates.length, ...(await reload(rec, me)) };
    },
  },
  wires: {
    description: "Add or remove wires between YOUR bricks, by brick id: {add:[{from:{brick:id, component?, port}, to:{...}}], remove:[same shape]}. Reloads your build.",
    schema: { type: "object", properties: { add: { type: "array", items: WIRE }, remove: { type: "array", items: WIRE } } },
    run: async (a, me) => {
      const rec = loadRec(me), byId = new Map(rec.bricks.map(b => [b.id, b]));
      const add = cleanWires(a.add, id => byId.get(id), id => id), rem = cleanWires(a.remove, id => byId.get(id), id => id);
      const before = rec.wires.length;
      rec.wires = rec.wires.filter(w => !rem.some(r => sameWire(w, r)));
      const removed = before - rec.wires.length;
      for (const w of add) if (!rec.wires.some(x => sameWire(x, w))) rec.wires.push(w);
      return { removed, ...(await reload(rec, me)) };
    },
  },
  remove_bricks: {
    description: "Remove YOUR bricks (only ones placed with your key): ids [..], and/or box {min,max} (bricks whose centre is inside), or all=true. Their wires go too.",
    schema: { type: "object", properties: { ids: { type: "array", items: { type: "integer" } }, box: BOX, all: { type: "boolean" } } },
    run: async (a, me) => {
      if (!a.all && !a.box && !a.ids) throw new Error("give ids, box or all=true");
      const rec = loadRec(me), ids = new Set(a.ids || []), n = rec.bricks.length;
      rec.bricks = a.all ? [] : rec.bricks.filter(b => !ids.has(b.id) && !(a.box && inBox(b, a.box)));
      if (rec.bricks.length === n) return { removed: 0, left: n };
      const r = await reload(rec, me);
      return { removed: n - rec.bricks.length, left: rec.bricks.length, wires: r.wires };
    },
  },
  my_bricks: {
    description: "What you have built: count, bounding box, bricks with ids (optionally only inside box; at most 1000 listed) and your wires.",
    schema: { type: "object", properties: { box: BOX } },
    run: async (a, me) => {
      const rec = loadRec(me), list = rec.bricks.filter(b => !a.box || inBox(b, a.box));
      const lo = [0, 1, 2].map(k => Math.min(...list.map(b => b.position[k])));
      const hi = [0, 1, 2].map(k => Math.max(...list.map(b => b.position[k])));
      return { owner: me.name, count: list.length, bbox: list.length ? { min: lo, max: hi } : null, bricks: list.slice(0, 1000), wires: rec.wires };
    },
  },
};

const INSTRUCTIONS = "Brickadia freebuild server. read_region to look at the world, place_bricks (whole build in one call, with gates/wires if you like), " +
  "update_bricks / wires / remove_bricks to edit your own bricks by id. Units: stud 10, brick 12 tall, plate 4; sizes are half extents; z up. " +
  "Bricks that overlap anything are rejected. Call players to find where people are and build near them, not on top of them. Be nice: no slurs or obscene builds.";

async function rpc(m, me) {
  if (m.method === "initialize")
    return { protocolVersion: m.params?.protocolVersion || "2025-03-26", capabilities: { tools: {} },
             serverInfo: { name: "brickadia-public", version: "1.1.0" }, instructions: INSTRUCTIONS };
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
  req.on("data", d => { size += d.length; if (size > 12e6) req.destroy(); else body += d; });
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
