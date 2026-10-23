# bungus server (set up 2026-10-22)

Second Brickadia server on `bungus@192.168.5.137` (Windows 10 19045, 12 threads, 16 GB). Key auth (our ed25519 key in `C:\ProgramData\ssh\administrators_authorized_keys`); remote shell = cmd.exe.

- Runs in WSL2 distro `Ubuntu` (WSL 3.0.3), Linux user `bungus` (NOPASSWD sudo). Node 22 `~/node22`, Omegga 1.20.0 (`~/.npm-global`), server dir `~/omegga-server` (config has `credentials.token` = hosting token, account "Wire Wizard"), game via `omegga download` into `~/.config/omegga/steam_installs/main` (CL16374). Log: `/tmp/omegga_pty.log`.
- Win10 has no UDP portproxy: `C:\brickadia\relay.js` (node at `C:\brickadia\node`) relays UDP 7779 (game port; router forwards 7779 -> bungus, 7777 goes to pzedlo) Windows -> WSL IP (re-resolved every 30 s). All players appear with one IP (IP bans won't work). Web UI: netsh portproxy TCP 8080 -> WSL. Firewall rules for both (UDP 7779, TCP 8080).
- `C:\brickadia\boot.ps1` starts everything; a `wsl.exe ... sleep infinity` client must stay attached or WSL kills omegga when the last session ends.
- Autostart: scheduled task `BrickadiaOmegga` runs boot.ps1 AT LOGON of bungus (a SYSTEM task can't see the per-user distro). With nobody logged in, start it from ssh detached: `powershell -Command "Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{CommandLine='powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\brickadia\boot.ps1'}"`.
- WSL commands: `ssh bungus@192.168.5.137 'wsl.exe -d Ubuntu -u bungus -- bash -c "..."'` (pipes inside get eaten by cmd: scp a script to C:\Users\bungus and run it via /mnt/c).
