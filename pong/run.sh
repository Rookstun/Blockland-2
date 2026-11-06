#!/bin/bash
# ~/pong/run.sh [host args] : (re)start the PONG cabinet host (pong/host.mjs, copied as pongd.mjs so nes/run.sh's [h]ost.mjs kill misses it)
cd ~/pong
for p in $(pgrep -f 'node.*[p]ongd.mjs'); do kill $p; done
setsid nohup ~/node22/bin/node pongd.mjs "$@" > host.log 2>&1 < /dev/null &
