# sr.sh NAME cx cy cz hx hy hz : SaveRegion via the bridge job tool and dump it
cd ~/omegga-server
echo "{\"ops\":[{\"op\":\"cmd\",\"line\":\"br.Prefab.SaveRegion \\\"$1\\\" $2 $3 $4 $5 $6 $7 0\",\"captureMs\":2000}]}" | ~/node22/bin/node bridge/tools/job.mjs | grep -o 'Saved prefab with [0-9]* bricks' 
~/node22/bin/node bridge/wbank_dump.mjs $PWD/plugins/media/lib/brs4.mjs data/Saved/Prefabs/$1.brz | cut -c1-160
