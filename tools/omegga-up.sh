#!/usr/bin/env bash
# omegga-up.sh: check, port-forward and start a Brickadia Omegga server (Linux host).
#   ./omegga-up.sh check     read-only diagnostics (default)
#   ./omegga-up.sh forward   open ufw + UPnP router forward for the game/web ports (needs sudo for ufw)
#   ./omegga-up.sh start     check, then launch Omegga if it is not already running, then watch the log
#   ./omegga-up.sh errors    explain every failstate code
# Every failure prints  [Exx] what broke -> how to fix it.  Exit code = number of hard failures.
# Override paths with env vars: OMEGGA_DIR, BRICKADIA_DIR, NODE_DIR, PUBLIC_HOST.

OMEGGA_DIR=${OMEGGA_DIR:-$HOME/omegga-server}
BRICKADIA_DIR=${BRICKADIA_DIR:-$HOME/brickadia/Brickadia}
NODE_DIR=${NODE_DIR:-$HOME/node22/bin}
PUBLIC_HOST=${PUBLIC_HOST:-pzedlo.hopto.org}
BIN="$BRICKADIA_DIR/Binaries/Linux/BrickadiaServer-Linux-Shipping"
CFG="$OMEGGA_DIR/omegga-config.yml"
export PATH="$NODE_DIR:$PATH"

FAILS=0
ok()   { printf '  \e[32mok\e[0m   %s\n' "$*"; }
warn() { printf '  \e[33mwarn\e[0m [%s] %s\n         -> %s\n' "$1" "$2" "$3"; }
fail() { printf '  \e[31mFAIL\e[0m [%s] %s\n         -> %s\n' "$1" "$2" "$3"; FAILS=$((FAILS+1)); }

# config values (Omegga yml: omegga.port = web UI, server.port = game UDP)
cfg_port() { awk -v sec="$1:" '$1==sec{s=1;next} /^[^ ]/{s=0} s&&$1=="port:"{print $2;exit}' "$CFG" 2>/dev/null; }
GAME_PORT=$(cfg_port server); GAME_PORT=${GAME_PORT:-7777}
WEB_PORT=$(cfg_port omegga);  WEB_PORT=${WEB_PORT:-8080}

running() { pgrep -f "^$BIN" >/dev/null; }

check_install() {
  echo "== install"
  if ! command -v node >/dev/null; then
    fail E01 "node not found (looked in $NODE_DIR and PATH)" "install Node 18+ (e.g. unpack node-v22 linux-x64 into ~/node22) or set NODE_DIR"
  else
    local v; v=$(node -v | tr -d v | cut -d. -f1)
    if [ "$v" -lt 18 ]; then fail E02 "node $(node -v) is too old" "Omegga needs Node 18+: install a newer node and point NODE_DIR at it"
    else ok "node $(node -v)"; fi
  fi
  if ! command -v omegga >/dev/null; then
    fail E03 "omegga command not found" "npm i -g omegga  (with the same node as NODE_DIR)"
  else ok "omegga $(omegga --version 2>/dev/null | head -1)"; fi
  if [ ! -x "$BIN" ]; then
    fail E04 "Brickadia server binary missing: $BIN" "install/update the game server (~/update_game.sh here, or steamcmd / omegga's installer) or set BRICKADIA_DIR"
  else ok "server binary $BIN"; fi
  if [ ! -r "$CFG" ]; then
    fail E05 "no $CFG" "cd $OMEGGA_DIR && omegga init  (or restore omegga-config.yml.backup)"
  else ok "config: game udp $GAME_PORT, web tcp $WEB_PORT"; fi
  local free; free=$(df -Pk "$OMEGGA_DIR" 2>/dev/null | awk 'NR==2{print int($4/1048576)}')
  if [ -n "$free" ] && [ "$free" -lt 2 ]; then
    fail E06 "only ${free} GB free on the omegga disk" "free space: old data/logs/*.log, backup .brdb files in data/Saved/Worlds; world saves fail on a full disk"
  else ok "disk ${free:-?} GB free"; fi
  local mem; mem=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
  if [ "$mem" -lt 1500 ]; then warn E07 "only ${mem} MB RAM available" "big worlds need several GB: stop other processes or add swap, or the server gets OOM-killed"
  else ok "ram ${mem} MB available"; fi
}

check_ports() {
  echo "== ports"
  local u; u=$(ss -lunpH "sport = :$GAME_PORT" 2>/dev/null)
  if [ -z "$u" ]; then
    running && fail E08 "server process is up but nothing listens on udp $GAME_PORT" "server.port in $CFG changed after launch, or it is still booting: wait 30 s, else restart" \
            || ok "udp $GAME_PORT free (server not running)"
  elif grep -q BrickadiaServe <<<"$u"; then ok "udp $GAME_PORT held by BrickadiaServer"
  else fail E09 "udp $GAME_PORT is taken by something else: $u" "kill that process or change server.port in $CFG (then re-forward)"; fi
  local t; t=$(ss -ltnpH "sport = :$WEB_PORT" 2>/dev/null)
  if [ -z "$t" ]; then ok "tcp $WEB_PORT free"
  elif grep -q '"node"' <<<"$t"; then ok "tcp $WEB_PORT held by node (Omegga web UI)"
  else fail E10 "tcp $WEB_PORT is taken by something else: $t" "kill it or change omegga.port in $CFG"; fi
  if command -v ufw >/dev/null && sudo -n true 2>/dev/null; then
    local st; st=$(sudo -n ufw status 2>/dev/null)
    if grep -q 'Status: active' <<<"$st"; then
      grep -qE "^$GAME_PORT(/udp)? .*ALLOW" <<<"$st" && ok "ufw allows $GAME_PORT/udp" \
        || fail E11 "ufw is active and does not allow $GAME_PORT/udp" "sudo ufw allow $GAME_PORT/udp   (or: $0 forward)"
      grep -qE "^$WEB_PORT(/tcp)? .*ALLOW" <<<"$st" && ok "ufw allows $WEB_PORT/tcp" \
        || warn E12 "ufw does not allow $WEB_PORT/tcp (web UI only reachable locally)" "sudo ufw allow $WEB_PORT/tcp if you want the web UI from outside (set a password first)"
    else ok "ufw inactive"; fi
  else warn E13 "can't read the firewall (no ufw or no passwordless sudo)" "check by hand: sudo ufw status / sudo iptables -L -n; game needs $GAME_PORT/udp open"; fi
}

check_network() {
  echo "== network"
  local pub dns wan
  pub=$(curl -s -4 --max-time 5 https://api.ipify.org)
  [ -z "$pub" ] && { fail E14 "no internet (can't reach api.ipify.org)" "check the cable/wifi, default route (ip route) and DNS (/etc/resolv.conf)"; return; }
  ok "public ip $pub"
  dns=$(getent ahostsv4 "$PUBLIC_HOST" | awk 'NR==1{print $1}')
  if [ -z "$dns" ]; then warn E15 "$PUBLIC_HOST does not resolve" "fix the dynamic-DNS record (No-IP: log in, confirm the host so it doesn't expire) or set PUBLIC_HOST"
  elif [ "$dns" != "$pub" ]; then fail E16 "$PUBLIC_HOST -> $dns but your public ip is $pub" "dynamic DNS is stale: run/restart the No-IP DUC (noip2) or update the record by hand"
  else ok "$PUBLIC_HOST -> $pub"; fi
  if command -v upnpc >/dev/null; then
    wan=$(upnpc -s 2>/dev/null | awk -F'= ' '/ExternalIPAddress/{print $2}')
    if [ -z "$wan" ]; then warn E17 "router does not answer UPnP" "enable UPnP on the router, or forward $GAME_PORT/udp by hand to $(hostname -I | awk '{print $1}')"
    elif [ "$wan" != "$pub" ]; then fail E18 "router WAN ip $wan != public ip $pub (CGNAT / double NAT)" "port forwarding can't work: ask the ISP for a public IPv4 (or put the modem in bridge mode), else use a VPS tunnel (playit.gg, WireGuard to a VPS)"
    else
      upnpc -l 2>/dev/null | grep -qiE "UDP +$GAME_PORT->" && ok "router forwards udp $GAME_PORT (UPnP)" \
        || warn E19 "no UPnP mapping for udp $GAME_PORT" "$0 forward, or add a manual router rule: UDP $GAME_PORT -> $(hostname -I | awk '{print $1}'):$GAME_PORT"
    fi
  else warn E20 "upnpc not installed: can't see the router" "sudo apt install miniupnpc, or confirm by hand the router forwards UDP $GAME_PORT -> $(hostname -I | awk '{print $1}')"; fi
  case "$pub" in 100.6[4-9].*|100.[7-9]?.*|100.1[01]?.*|100.12[0-7].*) fail E18 "public ip $pub is in the CGNAT range" "see E18";; esac
  # shortcut: can't probe UDP from inside the LAN; ask a friend to join or use an outside port checker for $GAME_PORT/udp.
}

check_log() {
  echo "== log"
  local log; log=$(ls -t "$OMEGGA_DIR"/data/logs/omegga-*.log 2>/dev/null | head -1)
  [ -z "$log" ] && { warn E21 "no omegga log yet" "start it first ($0 start)"; return; }
  local tail; tail=$(tail -n 400 "$log")
  local pat code fix
  while IFS='@' read -r code pat fix; do
    grep -qiE "$pat" <<<"$tail" && fail "$code" "log: $(grep -iE "$pat" <<<"$tail" | tail -1 | cut -c1-150)" "$fix"
  done <<'EOF'
E22@EADDRINUSE@another Omegga/web server holds the web port: kill the old omegga (pgrep -af omegga) or change omegga.port
E23@bind.*(fail|in use)|Socket.*(fail|error).*bind@another server holds the game port: only one BrickadiaServer per port; kill the stale one
E24@could not find brickadia|brickadia (not installed|install.*fail)|binary.*not found@Omegga can't find the game: export BRICKADIA_DIR=$BRICKADIA_DIR before launching
E25@(auth|token|credential|login).*(fail|invalid|expired|denied)@hosting token/login rejected: re-run omegga with fresh credentials (omegga auth / delete data/Saved/Auth*) and check the account owns the game
E26@version mismatch|incompatible (version|client)|outdated (server|client)@players and server on different builds: update the server (~/update_game.sh) and restart when empty
E27@segmentation fault|signal 11|fatal error|unhandled exception@server crashed: read the lines above it; usually a bad plugin or a corrupt world, start once with plugins_off / load a backup .brdb
E28@out of memory|oom|cannot allocate@out of RAM: see E07
E29@plugin .*(error|failed to load)@a plugin crashed on load: fix it or move it to plugins_off, then reload
EOF
  grep -q 'Opening existing bundle at' <<<"$(cat "$log")" || warn E30 "no world load in the newest log" "load one: send br.World.Load \"<name>\" (Omegga console or bridge cmd op)"
  ok "scanned $(basename "$log")"
}

forward() {
  echo "== forward udp $GAME_PORT (game), tcp $WEB_PORT (web)"
  local lan; lan=$(hostname -I | awk '{print $1}')
  if command -v ufw >/dev/null; then
    sudo ufw allow "$GAME_PORT/udp" && ok "ufw $GAME_PORT/udp" || fail E11 "ufw allow failed" "run it yourself with sudo"
  fi
  if command -v upnpc >/dev/null; then
    upnpc -e brickadia -r "$GAME_PORT" UDP >/dev/null 2>&1 && ok "UPnP udp $GAME_PORT -> $lan" \
      || fail E17 "UPnP mapping refused" "enable UPnP on the router or add the rule by hand: UDP $GAME_PORT -> $lan:$GAME_PORT (give $lan a DHCP reservation so it doesn't move)"
  else
    warn E20 "no upnpc: forward by hand" "router admin page -> Port forwarding: UDP $GAME_PORT -> $lan:$GAME_PORT (and TCP $WEB_PORT only if the web UI must be public)"
  fi
}

start() {
  if running; then
    warn E31 "server already running (pid $(pgrep -f "^$BIN" | head -1))" "not touching it. To restart: check nobody is online first, then ~/restart_omegga.sh"
    return
  fi
  check_install
  [ "$FAILS" -gt 0 ] && { echo "fix the FAILs above before starting"; return; }
  echo "== start"
  cd "$OMEGGA_DIR" || return
  BRICKADIA_DIR="$BRICKADIA_DIR" setsid nohup script -qc "omegga -d -v" /tmp/omegga_pty2.log >/dev/null 2>&1 </dev/null &
  for _ in $(seq 1 60); do running && break; sleep 2; done
  running || { fail E32 "BrickadiaServer did not appear within 120 s" "read /tmp/omegga_pty2.log and $OMEGGA_DIR/data/logs/ (newest), then $0 check"; return; }
  ok "BrickadiaServer up; waiting for udp $GAME_PORT"
  for _ in $(seq 1 30); do ss -lunH "sport = :$GAME_PORT" | grep -q . && break; sleep 2; done
  check_ports; check_log
}

case "${1:-check}" in
  check)   check_install; check_ports; check_network; check_log ;;
  forward) forward ;;
  start)   start ;;
  errors)  grep -oE '(fail|warn) E[0-9]+ "[^"]*" "[^"]*"' "$0" | sort -u -k2,2 | sed -E 's/^(fail|warn) //'
           grep -E '^E[0-9]+@' "$0" | awk -F'@' '{print $1"  (log) "$3}' ;;
  *) echo "usage: $0 [check|forward|start|errors]"; exit 64 ;;
esac
echo "== $FAILS failure(s)"
exit "$FAILS"
