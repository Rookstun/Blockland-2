// Turns mapgen's out/spawners.json into one bridge job that stamps the
// in-game skeleton spawner prefabs (dungeon_spawner_1..7, saved on the server
// with br.Prefab.SaveRegion) at each spot, and the swamp zombies
// (swamp_zombie_1/2, made from them by zombie-prefabs.mjs).
//
//   node load-spawners.mjs NEW.json [OLD.json] | node job.mjs
//
// Loaded prefabs have no owner, so the bridge's owner clear can't remove
// them. Pass the previous placement list as OLD.json and its spots are
// cleared first with small ClearRegions (they only take bricks entirely
// inside the box, and the spawner brick needs about 25x25x8 around it).

import fs from 'fs';

const [newFile, oldFile] = process.argv.slice(2);
const read = f => {
  const text = f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '';
  return text ? JSON.parse(text) : [];
};
const ops = [];
for (const { at: [x, y, z] } of read(oldFile))
  ops.push({ op: 'cmd', line: `br.World.ClearRegion ${x} ${y} ${z} 25 25 8` }, { op: 'sleep', ms: 30 });
// dungeon spots name a skeleton tier; others (the swamp zombies) name their prefab
for (const { at: [x, y, z], tier, prefab } of read(newFile))
  ops.push({ op: 'cmd', line: `br.Prefab.Load "${prefab ?? `dungeon_spawner_${tier}`}" ${x} ${y} ${z} 0 16` }, { op: 'sleep', ms: 60 });
process.stdout.write(JSON.stringify({ ops }));
