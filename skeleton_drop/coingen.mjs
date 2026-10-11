// Makes the coins and XP orbs from the hand-built coin25_orig.brz (gold,
// +25 "Money" on touch): coin1 brown / coin10 silver / coin25 gold pay into
// "coins" (what the shops spend). Patches the coin brick's colour, its
// BrickPropertyChanger colour and the IncrementLeaderboardValue amount;
// every other file in the bundle is copied through untouched.
//
//   node coingen.mjs        (writes coin1.brz, coin10.brz next to this script)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const brs = await import('../mapgen/lib/brs.mjs');
const src = fs.readFileSync(path.join(HERE, 'coin25_orig.brz'));

const COINS = [
  { key: 'coin1', value: 1, color: [128, 76, 36], board: 'coins' }, // brown (copper)
  { key: 'coin10', value: 10, color: [192, 194, 202], board: 'coins' }, // silver
  { key: 'coin25', value: 25, color: [246, 206, 42], board: 'coins' }, // gold
];

const reader = brs.WorldReader.from(src);
const paths = reader.fs.listPaths();
const cSchema = reader.schemaAt(reader.path('Bricks/ComponentsShared.schema'), 0);
const bSchema = reader.schemaAt(reader.path('Bricks/ChunksShared.schema'), 0);
const files = re => paths.map(p => p.match(re)).filter(Boolean).map(m => ({ path: m[0], grid: Number(m[1]), chunk: { x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) } }));
const componentFiles = files(/^World\/0\/Bricks\/Grids\/(\d+)\/Components\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
const brickFiles = files(/^World\/0\/Bricks\/Grids\/(\d+)\/Chunks\/(-?\d+)_(-?\d+)_(-?\d+)\.mps$/);
const assets = reader.brickAssets();

const encodeComponents = ({ soa, components }) => {
  const parts = [cSchema.encode('BRSavedComponentChunkSoA', soa)];
  for (const c of components) if (c.structName) parts.push(cSchema.encode(c.structName, c.data));
  return Buffer.concat(parts.map(p => Buffer.from(p)));
};

function bundle(entries) {
  const root = new Map();
  for (const [p, content] of entries) {
    const parts = p.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.has(dir)) node.set(dir, new Map());
      node = node.get(dir);
    }
    node.set(parts.at(-1), content);
  }
  const toNodes = m => [...m].map(([name, v]) => [name, v instanceof Map ? brs.brdb.folder(toNodes(v)) : brs.brdb.file(v)]);
  return brs.brdb.writeBrzContainer(toNodes(root));
}

// (owner 2026-10-08: "make coins wait 0.1 seconds so their sound can finish
// playing before deletion") the pickup used to wire IncrementLeaderboardValue
// .ExecOut straight into the OR that fires DestroySpawnedPrefab, which cut the
// pickup sound off. A new 0.1 s timer goes in between: ExecOut -> Timer.Restart,
// Timer.Expired -> that OR. The timer is a 17th brick on the chip grid, so the
// brick, component, wire and chunk-index files of that chunk all change.
const PICKUP_DELAY = 0.1;
const gd = reader.globalData();
const typeIdx = name => gd.ComponentTypeNames.indexOf(name), portIdx = name => gd.ComponentWirePortNames.indexOf(name);
const T_TIMER = typeIdx('BrickComponentType_WireGraphPseudo_Timer');
const chip = componentFiles.find(f => reader.componentChunk(f.grid, f.chunk).components.some(c => c.typeName.endsWith('IncrementLeaderboardValue')));
const chipKey = `${chip.chunk.x}_${chip.chunk.y}_${chip.chunk.z}`;
function addPickupDelay(out, copy) {
  const g = chip.grid;
  // the brick: a timer gate in a free spot on the chip
  const bsoa = structuredClone(reader.brickChunkSoa(g, chip.chunk));
  const n = bsoa.BrickTypeIndices.length, like = copy.components.find(c => c.typeName === 'BrickComponentType_WireGraphPseudo_Timer').brickIndex;
  const taken = new Set(bsoa.RelativePositions.map(p => `${p.X},${p.Y},${p.Z}`));
  let spot = null;
  for (let y = -25; y <= 25 && !spot; y += 10) for (let x = -35; x <= 25 && !spot; x += 10) if (!taken.has(`${x},${y},2`)) spot = { X: x, Y: y, Z: 2 };
  for (const k of ['BrickTypeIndices', 'OwnerIndices', 'OriginalOwnerIndices', 'Orientations', 'MaterialIndices', 'ColorsAndAlphas']) bsoa[k].push(structuredClone(bsoa[k][like]));
  bsoa.RelativePositions.push(spot);
  for (const k of Object.keys(bsoa).filter(k => /Flags/.test(k))) {
    const f = bsoa[k].Flags, bit = (f[like >> 3] >> (like & 7)) & 1;
    while (f.length * 8 < n + 1) f.push(0);
    f[n >> 3] |= bit << (n & 7);
  }
  out.set(`World/0/Bricks/Grids/${g}/Chunks/${chipKey}.mps`, new Uint8Array(bSchema.encode('BRSavedBrickChunkSoA', bsoa)));
  // the component: after the other timers (components are grouped by type, in counter order)
  let at = 0;
  for (const c of copy.soa.ComponentTypeCounters) { at += c.NumInstances; if (c.TypeIndex === T_TIMER) { c.NumInstances += 1; break; } }
  const proto = copy.components.find(c => c.typeName === 'BrickComponentType_WireGraphPseudo_Timer');
  copy.soa.ComponentBrickIndices.splice(at, 0, n);
  copy.components.splice(at, 0, { ...proto, brickIndex: n, data: { ...structuredClone(proto.data), Limit: PICKUP_DELAY, Time: PICKUP_DELAY, bRunning: false } });
  // the wires: ExecOut -> OR becomes Timer.Expired -> OR, plus ExecOut -> Timer.Restart
  const wPath = reader.path(`Bricks/Grids/${g}/Wires/${chipKey}.mps`), wSchema = reader.schemaAt(reader.path('Bricks/WiresShared.schema'), 0);
  const w = structuredClone(reader.decode(wPath, reader.path('Bricks/WiresShared.schema'), 'BRSavedWireChunkSoA'));
  const inc = copy.components.find(c => c.typeName.endsWith('IncrementLeaderboardValue')).brickIndex;
  const del = copy.components.find(c => c.typeName.endsWith('DestroySpawnedPrefab')).brickIndex;
  const orBrick = w.LocalWireSources[w.LocalWireTargets.findIndex(t => t.BrickIndexInChunk === del && t.PortIndex === portIdx('Exec'))].BrickIndexInChunk;
  const i = w.LocalWireSources.findIndex((s, k) => s.BrickIndexInChunk === inc && s.PortIndex === portIdx('ExecOut') && w.LocalWireTargets[k].BrickIndexInChunk === orBrick);
  if (i < 0) throw new Error('coingen: no ExecOut -> OR wire to delay');
  const execOut = { ...w.LocalWireSources[i] };
  w.LocalWireSources[i] = { BrickIndexInChunk: n, ComponentTypeIndex: T_TIMER, PortIndex: portIdx('Expired') };
  w.LocalWireSources.push(execOut);
  w.LocalWireTargets.push({ BrickIndexInChunk: n, ComponentTypeIndex: T_TIMER, PortIndex: portIdx('Restart') });
  const nw = w.LocalWireSources.length + w.RemoteWireSources.length;
  while (w.PendingPropagationFlags.Flags.length * 8 < nw) w.PendingPropagationFlags.Flags.push(0);
  out.set(`World/0/Bricks/Grids/${g}/Wires/${chipKey}.mps`, new Uint8Array(wSchema.encode('BRSavedWireChunkSoA', w)));
  // the chunk index counts
  const ciPath = reader.path(`Bricks/Grids/${g}/ChunkIndex.mps`), ciSchema = reader.schemaAt(reader.path('Bricks/ChunkIndexShared.schema'), 0);
  const ci = structuredClone(reader.decode(ciPath, reader.path('Bricks/ChunkIndexShared.schema'), 'BRSavedBrickChunkIndexSoA'));
  const c = ci.Chunk3DIndices.findIndex(q => q.X === chip.chunk.x && q.Y === chip.chunk.y && q.Z === chip.chunk.z);
  ci.NumBricks[c] += 1; ci.NumComponents[c] += 1; ci.NumWires[c] += 1;
  out.set(`World/0/Bricks/Grids/${g}/ChunkIndex.mps`, new Uint8Array(ciSchema.encode('BRSavedBrickChunkIndexSoA', ci)));
  return spot;
}

for (const coin of COINS) {
  const out = new Map(paths.map(p => [p, reader.fs.readFile(p)]));
  const [R, G, B] = coin.color;
  // the coin brick itself (B_1x1_Coin), wherever it is
  for (const f of brickFiles) {
    const soa = structuredClone(reader.brickChunkSoa(f.grid, f.chunk));
    let hit = false;
    soa.BrickTypeIndices.forEach((t, i) => {
      if (assets[t] === 'B_1x1_Coin') { soa.ColorsAndAlphas[i] = { ...soa.ColorsAndAlphas[i], R, G, B }; hit = true; }
    });
    if (hit) out.set(f.path, new Uint8Array(bSchema.encode('BRSavedBrickChunkSoA', soa)));
  }
  for (const f of componentFiles) {
    const chunk = reader.componentChunk(f.grid, f.chunk);
    const copy = { soa: chunk.soa, components: chunk.components.map(c => ({ ...c, data: c.data && structuredClone(c.data) })) };
    for (const c of copy.components) {
      if (c.typeName === 'BrickComponentType_WireGraph_Exec_Gamemode_IncrementLeaderboardValue') {
        c.data.Value = typeof c.data.Value === 'bigint' ? BigInt(coin.value) : coin.value;
        c.data.Key = coin.board;
      }
      if (c.typeName === 'Component_BrickPropertyChanger') c.data.Color = { ...c.data.Color, R, G, B };
      // the original was saved mid-countdown (15 s timer at 10.87): start fresh
      if (c.typeName === 'BrickComponentType_WireGraphPseudo_Timer' && c.data.Limit === 15) c.data.Time = 0;
    }
    if (f.path === chip.path) addPickupDelay(out, copy);
    out.set(f.path, new Uint8Array(encodeComponents(copy)));
  }
  const bytes = bundle(out);
  fs.writeFileSync(path.join(HERE, `${coin.key}.brz`), bytes);

  // read back
  const check = brs.WorldReader.from(Buffer.from(bytes));
  const seen = [];
  for (const g of check.gridIds()) {
    const a = check.brickAssets();
    for (const b of check.bricks(g)) if (a[b.asset_name_index] === 'B_1x1_Coin') seen.push(`coin brick ${JSON.stringify(b.color)}`);
  }
  for (const f of componentFiles)
    for (const c of check.componentChunk(f.grid, f.chunk).components) {
      if (c.typeName.endsWith('IncrementLeaderboardValue')) seen.push(`${c.data.Key} +${c.data.Value}`);
      if (c.typeName === 'Component_BrickPropertyChanger') seen.push(`changer ${c.data.Color.R},${c.data.Color.G},${c.data.Color.B}`);
    }
  console.log(`${coin.key}.brz ${bytes.length} bytes: ${seen.join(', ')}`);
}
