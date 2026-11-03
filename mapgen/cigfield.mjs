// renderman's "5 hundred cigarettes" (2026-11-02): a field of 500 spawned cigarettes (mapgen/cigarette.mjs pack, one per Prefab.Load),
// 20 columns x 25 rows, x 6600..9070 (130 apart), y -19000..-18280 (30 apart), on the ground. ONE bridge job of cmd ops, no sleeps.
//   node mapgen/cigfield.mjs > job.json ; ssh pzedlo.hopto.org 'cd ~/omegga-server/bridge/tools && ~/node22/bin/node job.mjs' < job.json
// Verified 2026-11-02: SaveRegion over the field reported 2500 bricks and 500 entities. Remove: br.World.ClearRegion 7800 -18640 40 1300 400 40
const ops = [];
for (let j = 0; j < 25; j++) for (let i = 0; i < 20; i++) ops.push({ op: 'cmd', line: `br.Prefab.Load "cigarette" ${6600 + 130 * i} ${-19000 + 30 * j} 0 0 16`, captureMs: 0 });
console.log(JSON.stringify({ ops }));
