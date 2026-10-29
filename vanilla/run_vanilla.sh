#!/bin/bash
# Vanilla Brickadia dedicated server (no Omegga) beside the main one: port 7780, UserDir ~/vanilla/data.
# Console: echo "cmd" > /tmp/vanin ; log ~/vanilla/server.log. Stop: pkill -f "[U]serDir=/home/max/vanilla"
pkill -f "[t]ail -f /tmp/vanin"
rm -f /tmp/vanin; mkfifo /tmp/vanin
cd /home/max/brickadia/Brickadia
TOKEN=$(sed -n 's/.*-Token=\\"\([^\\]*\)\\".*/\1/p' ~/run_plain.sh)  # main server's hosting token
tail -f /tmp/vanin | ./Binaries/Linux/BrickadiaServer-Linux-Shipping -Environment="Plate" -NotInstalled -log -UserDir=/home/max/vanilla/data -port=7780 -Token="$TOKEN" > /home/max/vanilla/server.log 2>&1 &
sleep 60
# dedicated servers reject bot melee without this (notes/history.md 2026-10-11)
echo "br.Weapons.EnableHitValidation 0" > /tmp/vanin
echo 'br.Prefab.Load "duel" 0 0 20 0 16' > /tmp/vanin
wait
