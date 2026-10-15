// which board bricks are live: node readback.mjs <brs dist> region.brz prefab.brz ox oy oz
// (region = Prefab.SaveRegion over the board, world coords; prefab placed at ox oy oz)
const [dist, region, prefab, ox, oy, oz] = process.argv.slice(2);
const b = await import(dist); const fs = await import("node:fs");
const read = f => b.WorldReader.from(new Uint8Array(fs.readFileSync(f)));
const live = new Set();
for (const x of read(region).bricks(1)) live.add(x.position.join(","));
let ok = 0;
for (const x of read(prefab).bricks(1)) {
  const p = [x.position[0] + +ox, x.position[1] + +oy, x.position[2] + +oz].join(",");
  if (live.has(p)) ok++; else console.log("missing", JSON.stringify({ size: x.size, position: x.position, asset: x.asset_name_index }));
}
console.log("present", ok);
