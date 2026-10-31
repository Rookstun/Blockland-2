#!/bin/bash
# ~/nes/run.sh [rom] : (re)start the NES cabinet host on the server
cd ~/nes
for p in $(pgrep -f 'node.*[h]ost.mjs'); do kill $p; done
setsid nohup ~/node22/bin/node host.mjs "${1:-roms/BladeBuster.nes}" > host.log 2>&1 < /dev/null &
